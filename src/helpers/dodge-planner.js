import { DODGE_CFG, PROJECTILE_DEDUP_WINDOW_MS } from "./dodge_profiles.js";
import { clamp, normalize2d, compareDodgePoints } from "./dodge_kinds.js";
import { projectileOwnerMemory, projectileThreats } from "./threat-memory.js";
import {
    performAutododgeMove,
    expireOldProjectileTracks,
    projectileClearanceAtPoint,
    isPointThreatenedByProjectile
} from "./projectile-motion.js";
import {
    isMoveCandidateAllowed,
    clearBattleState,
    setMaxObservedThreatSpeed
} from "./threat-policy.js";
import { clipLineAgainstProjectileBlockers, getCollisionMap } from "../utils/wallCache.js";

export const dodgeDirections = [];

export function rebuildDodgeDirections(precision = DODGE_CFG.N_DIRECTIONS, safetyMargin = DODGE_CFG.SAFETY_MARGIN, commitMs = DODGE_CFG.DODGE_COMMIT_MS) {
    DODGE_CFG.N_DIRECTIONS = clamp(precision | 0, 8, 40);
    DODGE_CFG.SAFETY_MARGIN = clamp(safetyMargin | 0, 0, 180);
    DODGE_CFG.DODGE_COMMIT_MS = clamp(commitMs | 0, 20, 250);

    dodgeDirections.length = 0;
    for (let i = 0; i < DODGE_CFG.N_DIRECTIONS; i++) {
        const a = (Math.PI * 2 * i) / DODGE_CFG.N_DIRECTIONS;
        dodgeDirections.push({
            x: Math.cos(a),
            y: Math.sin(a)
        });
    }
}

export function chooseAutododgeMove(myX, myY, myRadius) {
    projectileThreats.length = 0;
    let maxSpeed = 0;
    const margin = myRadius + DODGE_CFG.SAFETY_MARGIN;
    const useWalls = typeof getCollisionMap === "function" && !!getCollisionMap();

    for (const id in projectileOwnerMemory) {
        const mem = projectileOwnerMemory[id];
        if (mem.unconfirmed) continue;

        mem._svx = mem.dirX * mem.speed;
        mem._svy = mem.dirY * mem.speed;
        mem._dx = mem.x - myX;
        mem._dy = mem.y - myY;
        mem._rNoMove = margin + (mem.impactRadius || mem.radius);

        if (useWalls) {
            try {
                const range = Math.max(mem.range || 6000, mem.speed * 1.5);
                const ex = mem.x + mem.dirX * range;
                const ey = mem.y + mem.dirY * range;
                const clipped = clipLineAgainstProjectileBlockers(mem.x, mem.y, ex, ey);
                mem._clipDist = Math.hypot(clipped.x - mem.x, clipped.y - mem.y);
                mem._clipBlocked = !!clipped.blocked;
            } catch (_) {
                mem._clipDist = Infinity;
                mem._clipBlocked = false;
            }
        } else {
            mem._clipDist = Infinity;
            mem._clipBlocked = false;
        }

        if (!mem.ignored && mem.speed > maxSpeed) {
            maxSpeed = mem.speed;
        }
        projectileThreats.push(mem);
    }

    setMaxObservedThreatSpeed(maxSpeed);
    return projectileThreats.length;
}

export function scoreDodgePoint(dir, myX, myY, myRadius) {
    const nd = normalize2d(dir.x, dir.y);
    return expireOldProjectileTracks(myX, myY, myRadius, nd, DODGE_CFG.T_FIELD) >= 0;
}

export function collectCandidateDodgePoints(candDir, myX, myY, myRadius, intentDir) {
    let score = 0;
    if (!isMoveCandidateAllowed(myX, myY, candDir.x, candDir.y, myRadius)) {
        return 1e15;
    }

    const mvx = candDir.x * DODGE_CFG.CHAR_SPEED;
    const mvy = candDir.y * DODGE_CFG.CHAR_SPEED;

    for (let i = 0; i < projectileThreats.length; i++) {
        const threat = projectileThreats[i];
        if (threat.ignored) continue;

        const tHit = performAutododgeMove(threat, myX, myY, myRadius, candDir, DODGE_CFG.T_FIELD);
        if (tHit >= 0) {
            score += 4e7 + (DODGE_CFG.T_FIELD - tHit) * 4e7;
            if (tHit <= 0.15) {
                const away = normalize2d(myX - threat.x, myY - threat.y);
                score += (1 - (candDir.x * away.x + candDir.y * away.y)) * 5e6;
            }
        }

        const rNoMove = threat._rNoMove;
        const relVx = threat._svx - mvx;
        const relVy = threat._svy - mvy;
        const dx = threat._dx;
        const dy = threat._dy;
        const vSq = relVx * relVx + relVy * relVy;
        const b = 2 * (dx * relVx + dy * relVy);
        const c = dx * dx + dy * dy;

        let minDistSq = c;
        if (vSq > 1e-6) {
            const tClamp = Math.max(0, Math.min(DODGE_CFG.T_FIELD, -b / (2 * vSq)));
            minDistSq = c + b * tClamp + vSq * tClamp * tClamp;
        }

        const rSq = rNoMove * rNoMove;
        if (minDistSq < rSq) {
            score += 2e7 + (rSq - minDistSq) * 2000;
        } else {
            const gap = Math.sqrt(minDistSq) - rNoMove;
            if (gap < DODGE_CFG.MIN_CLEARANCE) {
                const deficit = DODGE_CFG.MIN_CLEARANCE - gap;
                score += (deficit * deficit * 1000) / (DODGE_CFG.MIN_CLEARANCE * DODGE_CFG.MIN_CLEARANCE);
            }
        }
    }

    if (intentDir.x !== 0 || intentDir.y !== 0) {
        score -= (candDir.x * intentDir.x + candDir.y * intentDir.y) * DODGE_CFG.INTENT_WEIGHT * 500;
    }
    return score;
}

export function parseProjectileObject(myX, myY, myRadius, curDir, intentDir) {
    const groups = new Map();
    for (let i = 0; i < projectileThreats.length; i++) {
        const threat = projectileThreats[i];
        if (!clearBattleState(threat, myX, myY, myRadius, curDir)) continue;
        const key = threat.ownerLocked
            ? `${threat.ownerBrawlerId}_${Math.floor(threat.spawnTime / PROJECTILE_DEDUP_WINDOW_MS)}`
            : threat.gid;
        let g = groups.get(key);
        if (!g) {
            g = [];
            groups.set(key, g);
        }
        g.push(threat);
    }
    if (groups.size === 0) return null;

    let dirs = [];
    for (const group of groups.values()) {
        let avgDirX = 0;
        let avgDirY = 0;
        let avgX = 0;
        let avgY = 0;
        for (let j = 0; j < group.length; j++) {
            const threat = group[j];
            avgDirX += threat.dirX;
            avgDirY += threat.dirY;
            avgX += threat.x;
            avgY += threat.y;
        }
        const n = group.length || 1;
        avgDirX /= n;
        avgDirY /= n;
        avgX /= n;
        avgY /= n;

        const away = normalize2d(myX - avgX, myY - avgY);
        const perpA = normalize2d(-avgDirY, avgDirX);
        const perpB = normalize2d(avgDirY, -avgDirX);

        dirs.push(normalize2d(perpA.x * DODGE_CFG.PERP_WEIGHT + away.x * DODGE_CFG.AWAY_WEIGHT, perpA.y * DODGE_CFG.PERP_WEIGHT + away.y * DODGE_CFG.AWAY_WEIGHT));
        dirs.push(normalize2d(perpB.x * DODGE_CFG.PERP_WEIGHT + away.x * DODGE_CFG.AWAY_WEIGHT, perpB.y * DODGE_CFG.PERP_WEIGHT + away.y * DODGE_CFG.AWAY_WEIGHT));
    }

    dirs = dirs.concat(dodgeDirections);

    let bestDir = null;
    let bestScore = 1e18;
    for (let i = 0; i < dirs.length; i++) {
        const score = collectCandidateDodgePoints(dirs[i], myX, myY, myRadius, intentDir);
        if (score < bestScore) {
            bestScore = score;
            bestDir = dirs[i];
        }
    }

    return bestDir ? { dir: bestDir } : null;
}

export function findSafeDodgePoint(myX, myY, myRadius, primaryDir) {
    const candidates = [];
    if (primaryDir && (primaryDir.x !== 0 || primaryDir.y !== 0)) {
        candidates.push(normalize2d(primaryDir.x, primaryDir.y));
    }
    for (let i = 0; i < dodgeDirections.length; i++) {
        candidates.push(dodgeDirections[i]);
    }

    const points = [];
    let bestDist = Infinity;

    for (let i = 0; i < candidates.length; i++) {
        const dir = candidates[i];
        if (scoreDodgePoint(dir, myX, myY, myRadius)) continue;

        for (let dist = DODGE_CFG.STEP_SIZE; dist <= DODGE_CFG.MAX_SEARCH_DIST; dist += DODGE_CFG.STEP_SIZE) {
            if (dist > bestDist) break;
            const px = myX + dir.x * dist;
            const py = myY + dir.y * dist;

            if (isPointThreatenedByProjectile(px, py, myRadius)) continue;

            const clearance = projectileClearanceAtPoint(px, py, myRadius);
            if (clearance < DODGE_CFG.MIN_CLEARANCE) continue;

            points.push({ x: px, y: py, dist: dist, clearance: clearance });
            if (dist < bestDist) bestDist = dist;
            break;
        }
    }

    if (points.length === 0) return null;
    points.sort(compareDodgePoints);
    return points[0];
}
