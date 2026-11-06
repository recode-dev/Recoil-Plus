import { battleState } from "../core/scan.js";
import { moveToPoint } from "../core/commands.js";
import { clipLineAgainstProjectileBlockers, getCollisionMap } from "../utils/walls.js";

function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

const DODGE_CFG = {
    SAFETY_MARGIN: 60,
    MOVING_EXTRA_MARGIN: 20,
    T_URGENT_MIN: 0.42,
    T_URGENT_MAX: 0.78,
    T_FIELD: 1.05,
    T_RELEASE: 0.2,
    MIN_CLEARANCE: 70,
    DODGE_COMMIT_MS: 70,
    DODGE_MAX_MS: 520,
    DODGE_BUFFER_MS: 60,
    N_DIRECTIONS: 24,
    STEP_SIZE: 150,
    MAX_SEARCH_DIST: 1500,
    ARRIVAL_THRESHOLD: 42,
    STALE_MS: 300,
    PERP_WEIGHT: 1.8,
    AWAY_WEIGHT: 2.2,
    INTENT_WEIGHT: 1,
    CHAR_SPEED: 720,
    LAG_COMPENSATION_S: 0.03
};

const EXTRA_RADIUS_BY_BRAWLER_ID = {
    6: 220,
    9: 240,
    22: 260,
    37: 240,
    40: 180,
    48: 220,
    82: 200
};

const PROJECTILE_IMPACT_RADIUS_BY_BRAWLER_ID = {
    1: 17,
    3: 34,
    4: 34,
    5: 50,
    7: 50,
    8: 83,
    10: 50,
    12: 17,
    13: 50,
    14: 23,
    15: 34,
    16: 17,
    17: 33,
    19: 50,
    20: 50,
    21: 50,
    23: 33,
    24: 50,
    25: 83,
    27: 17,
    28: 67,
    29: 50,
    30: 67,
    31: 67,
    32: 17,
    35: 17,
    36: 13,
    37: 17,
    38: 50,
    39: 50,
    40: 67,
    41: 17,
    42: 50,
    43: 100,
    44: 23,
    45: 50,
    46: 34,
    47: 17,
    49: 83,
    50: 17,
    51: 83,
    52: 50,
    53: 33,
    54: 100,
    56: 33,
    57: 33,
    58: 50,
    59: 33,
    60: 50,
    61: 50,
    62: 83,
    63: 33,
    64: 17,
    65: 33,
    68: 34,
    70: 33,
    72: 33,
    73: 67,
    74: 50,
    78: 42,
    79: 33,
    80: 67,
    81: 100,
    83: 50,
    84: 50,
    88: 34,
    89: 33,
    90: 57,
    91: 33,
    92: 75,
    98: 33
};

const LOB_OR_MELEE_BRAWLERS = new Set(["EL_PRIMO", "MORTIS", "ROSA", "BIBI", "JACKY", "EDGAR", "BUZZ", "FANG", "SAM", "HANK", "DOUG", "MICO", "KIT", "DRACO", "LILY", "SAMURAI", "GLADIATOR", "BULL", "DARRYL", "FRANK", "ASH", "BARLEY", "DYNAMIKE", "TICK", "SPROUT", "GROM", "TWINS", "WILLOW", "SQUEAK", "JUJU", "SHADOWDEMON", "POCO", "EMZ", "SHADE", "KAZE", "ALLI", "TRUNK", "GIGI"]);

const NEAREST_OWNER_MAX_DIST_SQ = 950 * 950;
const PROJECTILE_DEDUP_WINDOW_MS = 200;

export const autododgeConfig = {
    enabled: true,
    range: 900,
    precision: 24,
    safetyMargin: 60,
    commitMs: 70
};

export function setAutododgeOptions(opts = {}) {
    if (typeof opts.enabled === "boolean") autododgeConfig.enabled = opts.enabled;
    if (typeof opts.range === "number") autododgeConfig.range = opts.range | 0;
    if (typeof opts.precision === "number") autododgeConfig.precision = opts.precision | 0;
    if (typeof opts.safetyMargin === "number") autododgeConfig.safetyMargin = opts.safetyMargin | 0;
    if (typeof opts.commitMs === "number") autododgeConfig.commitMs = opts.commitMs | 0;
}

const projectileOwnerMemory = {};
const projectileThreats = [];
const dodgeDirections = [];

let maxSeenSpeed = 0;
let urgentT = 0.9;
let urgentAt = 0;
let safePointX = 0;
let safePointY = 0;
let committedDir = null;
let commitUntil = 0;
let commitAt = 0;
let lastDir = null;
let lastDodgeAt = 0;

function rebuildDodgeDirections() {
    DODGE_CFG.N_DIRECTIONS = clamp(autododgeConfig.precision | 0, 8, 40);
    DODGE_CFG.SAFETY_MARGIN = clamp(autododgeConfig.safetyMargin | 0, 0, 180);
    DODGE_CFG.DODGE_COMMIT_MS = clamp(autododgeConfig.commitMs | 0, 20, 250);
    dodgeDirections.length = 0;
    for (let i = 0; i < DODGE_CFG.N_DIRECTIONS; i++) {
        const a = Math.PI * 2 * i / DODGE_CFG.N_DIRECTIONS;
        dodgeDirections.push({ x: Math.cos(a), y: Math.sin(a) });
    }
}

rebuildDodgeDirections();

function normalize2d(x, y) {
    const len = Math.sqrt(x * x + y * y);
    return len < 1e-6 ? { x: 1, y: 0 } : { x: x / len, y: y / len };
}

function sameDirection(a, b) {
    return !!(a && b && a.x * b.x + a.y * b.y > 0.98);
}

function isMoveCandidateAllowed(px, py, dirX, dirY, myRadius) {
    return true;
}

function clearBattleState(threat, myX, myY, myRadius, dir) {
    return performAutododgeMove(threat, myX, myY, myRadius, dir, hasUrgentProjectileThreat()) >= 0;
}

function distSqPointToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-10) {
        const ex = px - ax;
        const ey = py - ay;
        return ex * ex + ey * ey;
    }
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const ex = px - cx;
    const ey = py - cy;
    return ex * ex + ey * ey;
}

function projectileClearanceAtPoint(px, py, myRadius) {
    let clearance = Infinity;
    for (let i = 0; i < projectileThreats.length; i++) {
        const threat = projectileThreats[i];
        if (threat.ignored) continue;
        const t = Math.min(DODGE_CFG.T_FIELD, Math.max(0.25, (threat.range || 9000) / Math.max(1, threat.speed)));
        const ex = threat.x + threat._svx * t;
        const ey = threat.y + threat._svy * t;
        const margin = myRadius + (threat.impactRadius || threat.radius) + DODGE_CFG.SAFETY_MARGIN;
        const d = Math.sqrt(distSqPointToSegment(px, py, threat.x, threat.y, ex, ey)) - margin;
        if (d < clearance) clearance = d;
    }
    return clearance;
}

function isPointThreatenedByProjectile(px, py, myRadius) {
    for (let i = 0; i < projectileThreats.length; i++) {
        const threat = projectileThreats[i];
        if (threat.ignored) continue;
        const t = Math.min(DODGE_CFG.T_FIELD, Math.max(0.25, (threat.range || 9000) / Math.max(1, threat.speed)));
        const ex = threat.x + threat._svx * t;
        const ey = threat.y + threat._svy * t;
        const margin = myRadius + (threat.impactRadius || threat.radius) + DODGE_CFG.SAFETY_MARGIN;
        if (distSqPointToSegment(px, py, threat.x, threat.y, ex, ey) <= margin * margin) return true;
    }
    return false;
}

function compareDodgePoints(a, b) {
    return a.dist !== b.dist ? a.dist - b.dist : b.clearance - a.clearance;
}

function scoreDodgePoint(myX, myY, myRadius, dirX, dirY) {
    const dir = normalize2d(dirX, dirY);
    return expireOldProjectileTracks(myX, myY, myRadius, dir, DODGE_CFG.T_FIELD) >= 0;
}

function findSafeDodgePoint(myX, myY, myRadius, preferredDir) {
    const candidates = [];
    if (preferredDir && (preferredDir.x !== 0 || preferredDir.y !== 0)) candidates.push(normalize2d(preferredDir.x, preferredDir.y));
    for (let i = 0; i < dodgeDirections.length; i++) candidates.push(dodgeDirections[i]);
    const points = [];
    let bestDist = Infinity;
    for (let i = 0; i < candidates.length; i++) {
        const dir = candidates[i];
        if (!scoreDodgePoint(myX, myY, myRadius, dir.x, dir.y)) {
            for (let d = DODGE_CFG.STEP_SIZE; d <= DODGE_CFG.MAX_SEARCH_DIST && !(d > bestDist); d += DODGE_CFG.STEP_SIZE) {
                const px = myX + dir.x * d;
                const py = myY + dir.y * d;
                if (isPointThreatenedByProjectile(px, py, myRadius)) continue;
                const clearance = projectileClearanceAtPoint(px, py, myRadius);
                if (!(clearance < DODGE_CFG.MIN_CLEARANCE)) {
                    points.push({ x: px, y: py, dist: d, clearance: clearance });
                    if (d < bestDist) bestDist = d;
                    break;
                }
            }
        }
    }
    return points.length === 0 ? null : (points.sort(compareDodgePoints), points[0]);
}

function hasUrgentProjectileThreat() {
    const now = Date.now();
    if (now - urgentAt < 16) return urgentT;
    const speedNorm = (Math.max(420, Math.min(900, DODGE_CFG.CHAR_SPEED || 720)) - 420) / 480;
    let t = DODGE_CFG.T_URGENT_MIN + (1 - speedNorm) * (DODGE_CFG.T_URGENT_MAX - DODGE_CFG.T_URGENT_MIN);
    if (maxSeenSpeed > 1800) t += Math.min(0.25, (maxSeenSpeed - 1800) / 1080 * 0.25);
    urgentT = t;
    urgentAt = now;
    return t;
}

function startDodgeCommit(brawlerName, ignored) {
    return ignored ? true : brawlerName ? LOB_OR_MELEE_BRAWLERS.has(String(brawlerName).toUpperCase()) : false;
}

function projectileRadiusForBrawler(radius, speed, brawlerId) {
    const extra = brawlerId && EXTRA_RADIUS_BY_BRAWLER_ID[brawlerId] || 0;
    if (extra > 0) return Math.max(radius, extra);
    const impact = brawlerId ? PROJECTILE_IMPACT_RADIUS_BY_BRAWLER_ID[brawlerId] : undefined;
    if (impact !== undefined) return Math.max(radius, impact);
    if (speed > 0 && speed < 1200 && radius > 0 && radius < 120) return Math.min(220, radius * 2.25);
    return radius || 8;
}

function nearestEnemyForProjectileOwner(px, py, enemies) {
    let best = null;
    let bestDistSq = NEAREST_OWNER_MAX_DIST_SQ;
    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        const dx = px - enemy.x;
        const dy = py - enemy.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > bestDistSq) continue;
        bestDistSq = distSq;
        best = enemy;
    }
    return best ? { brawlerId: best.brawlerId || 0, brawlerName: best.brawlerName || best.name || null, x: best.x, y: best.y } : null;
}

function trackProjectiles(now, projectiles, enemies) {
    const seen = {};
    for (let i = 0; i < projectiles.length; i++) {
        const proj = projectiles[i];
        const gid = String(proj.gid);
        seen[gid] = true;
        if (projectileOwnerMemory[gid]) {
            const mem = projectileOwnerMemory[gid];
            const dx = proj.x - mem.lastX;
            const dy = proj.y - mem.lastY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 5) {
                mem.dirX = dx / dist;
                mem.dirY = dy / dist;
                mem.unconfirmed = false;
                if (!mem.ownerLocked) {
                    const owner = nearestEnemyForProjectileOwner(mem.x, mem.y, enemies || []);
                    if (owner) {
                        mem.ownerLocked = true;
                        mem.ownerBrawlerId = owner.brawlerId;
                        mem.ownerBrawlerName = owner.brawlerName || null;
                        mem.impactRadius = projectileRadiusForBrawler(proj.radius || mem.radius, proj.speed || mem.speed, owner.brawlerId);
                        mem.ignored = startDodgeCommit(mem.ownerBrawlerName, false);
                    }
                }
            }
            mem.speed = Math.max(100, proj.speed || mem.speed || 1200);
            mem.radius = Math.max(1, proj.radius || mem.radius || 8);
            mem.range = proj.range || mem.range || 9000;
            mem.x = proj.x;
            mem.y = proj.y;
            mem.lastX = proj.x;
            mem.lastY = proj.y;
            mem.lastSeen = now;
        } else {
            const owner = nearestEnemyForProjectileOwner(proj.x, proj.y, enemies || []);
            let dirX = 0;
            let dirY = 0;
            let unconfirmed = true;
            if (proj.spawnAngle !== null && proj.spawnAngle !== undefined && isFinite(proj.spawnAngle) && proj.spawnAngle !== 0) {
                dirX = Math.cos(proj.spawnAngle);
                dirY = Math.sin(proj.spawnAngle);
                unconfirmed = false;
            } else if (owner) {
                const dir = normalize2d(proj.x - owner.x, proj.y - owner.y);
                dirX = dir.x;
                dirY = dir.y;
                unconfirmed = false;
            }
            const ownerName = owner ? owner.brawlerName : null;
            const speed = Math.max(100, proj.speed || 1200);
            const radius = Math.max(1, proj.radius || 8);
            projectileOwnerMemory[gid] = {
                gid: gid,
                x: proj.x,
                y: proj.y,
                dirX: dirX,
                dirY: dirY,
                speed: speed,
                radius: radius,
                impactRadius: projectileRadiusForBrawler(radius, speed, owner ? owner.brawlerId : 0),
                lastX: proj.x,
                lastY: proj.y,
                lastSeen: now,
                unconfirmed: unconfirmed,
                ownerBrawlerId: owner ? owner.brawlerId : 0,
                ownerBrawlerName: ownerName,
                ownerLocked: !!owner,
                spawnTime: now,
                range: proj.range || 9000,
                ignored: startDodgeCommit(ownerName, false)
            };
        }
    }
    for (const gid in projectileOwnerMemory) {
        if (!seen[gid] && now - projectileOwnerMemory[gid].lastSeen > DODGE_CFG.STALE_MS) delete projectileOwnerMemory[gid];
    }
}

function chooseAutododgeMove(myX, myY, myRadius) {
    projectileThreats.length = 0;
    maxSeenSpeed = 0;
    const margin = myRadius + DODGE_CFG.SAFETY_MARGIN;
    const useWalls = typeof getCollisionMap === "function" && !!getCollisionMap();
    for (const gid in projectileOwnerMemory) {
        const mem = projectileOwnerMemory[gid];
        if (mem.unconfirmed) continue;
        mem._svx = mem.dirX * mem.speed;
        mem._svy = mem.dirY * mem.speed;
        mem._dx = mem.x - myX;
        mem._dy = mem.y - myY;
        mem._rNoMove = margin + (mem.impactRadius || mem.radius);
        if (useWalls) {
            try {
                const range = Math.max(mem.range || 9000, mem.speed * 1.5);
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
        if (!mem.ignored && mem.speed > maxSeenSpeed) maxSeenSpeed = mem.speed;
        projectileThreats.push(mem);
    }
}

function performAutododgeMove(threat, myX, myY, myRadius, moveDir, tLimit) {
    if (threat.ignored) return -1;
    const mvx = moveDir.x * DODGE_CFG.CHAR_SPEED;
    const mvy = moveDir.y * DODGE_CFG.CHAR_SPEED;
    const moving = moveDir.x !== 0 || moveDir.y !== 0;
    const r = myRadius + (threat.impactRadius || threat.radius) + DODGE_CFG.SAFETY_MARGIN + (moving ? DODGE_CFG.MOVING_EXTRA_MARGIN : 0);
    const px = threat.x + threat._svx * DODGE_CFG.LAG_COMPENSATION_S;
    const py = threat.y + threat._svy * DODGE_CFG.LAG_COMPENSATION_S;
    const dx = px - myX;
    const dy = py - myY;
    if (dx * dx + dy * dy <= r * r) return 0;
    const relVx = threat._svx - mvx;
    const relVy = threat._svy - mvy;
    const vSq = relVx * relVx + relVy * relVy;
    if (vSq < 1e-6) return -1;
    const b = 2 * (dx * relVx + dy * relVy);
    const c = dx * dx + dy * dy - r * r;
    const disc = b * b - 4 * vSq * c;
    if (disc < 0) return -1;
    const sq = Math.sqrt(disc);
    const t0 = (-b - sq) / (2 * vSq);
    if ((-b + sq) / (2 * vSq) < 0) return -1;
    const tHit = t0 >= 0 ? t0 : 0;
    if (tHit > tLimit || threat._clipBlocked && isFinite(threat._clipDist) && threat.speed * (tHit + DODGE_CFG.LAG_COMPENSATION_S) > threat._clipDist + (threat.impactRadius || threat.radius)) return -1;
    return tHit;
}

function expireOldProjectileTracks(myX, myY, myRadius, moveDir, tLimit) {
    let best = -1;
    for (let i = 0; i < projectileThreats.length; i++) {
        const t = performAutododgeMove(projectileThreats[i], myX, myY, myRadius, moveDir, tLimit);
        if (t >= 0 && (best < 0 || t < best)) best = t;
    }
    return best;
}

function collectCandidateDodgePoints(dir, myX, myY, myRadius, intent) {
    let score = 0;
    if (!isMoveCandidateAllowed(myX, myY, myRadius)) return 1e15;
    const mvx = dir.x * DODGE_CFG.CHAR_SPEED;
    const mvy = dir.y * DODGE_CFG.CHAR_SPEED;
    for (let i = 0; i < projectileThreats.length; i++) {
        const threat = projectileThreats[i];
        if (threat.ignored) continue;
        const tHit = performAutododgeMove(threat, myX, myY, myRadius, dir, DODGE_CFG.T_FIELD);
        if (tHit >= 0) {
            score += 4e7 + (DODGE_CFG.T_FIELD - tHit) * 4e7;
            if (tHit <= 0.15) {
                const away = normalize2d(myX - threat.x, myY - threat.y);
                score += (1 - (dir.x * away.x + dir.y * away.y)) * 5e6;
            }
        }
        const rNoMove = threat._rNoMove;
        const relVx = threat._svx - mvx;
        const relVy = threat._svy - mvy;
        const dx = threat._dx;
        const dy = threat._dy;
        const vSq = relVx * relVx + relVy * relVy;
        let minDistSq = dx * dx + dy * dy;
        if (vSq > 1e-6) {
            const tClamp = Math.max(0, Math.min(DODGE_CFG.T_FIELD, -(dx * relVx + dy * relVy) / (2 * vSq)));
            minDistSq = minDistSq + (dx * relVx + dy * relVy) * tClamp + vSq * tClamp * tClamp;
        }
        const rSq = rNoMove * rNoMove;
        if (minDistSq < rSq) {
            score += 2e7 + (rSq - minDistSq) * 2e3;
        } else {
            const gap = Math.sqrt(minDistSq) - rNoMove;
            if (gap < DODGE_CFG.MIN_CLEARANCE) {
                const deficit = DODGE_CFG.MIN_CLEARANCE - gap;
                score += deficit * deficit * 1e3 / (DODGE_CFG.MIN_CLEARANCE * DODGE_CFG.MIN_CLEARANCE);
            }
        }
    }
    if (intent.x !== 0 || intent.y !== 0) score -= (dir.x * intent.x + dir.y * intent.y) * DODGE_CFG.INTENT_WEIGHT * 500;
    return score;
}

function updateProjectileThreats(dir, myX, myY, myRadius) {
    if (!isMoveCandidateAllowed(myX, myY, myRadius)) return true;
    for (let i = 0; i < projectileThreats.length; i++) {
        if (performAutododgeMove(projectileThreats[i], myX, myY, myRadius, dir, DODGE_CFG.T_FIELD) >= 0) return true;
    }
    return false;
}

function parseProjectileObject(myX, myY, myRadius, intent) {
    const groups = new Map();
    for (let i = 0; i < projectileThreats.length; i++) {
        const threat = projectileThreats[i];
        if (!clearBattleState(threat, myX, myY, myRadius, intent)) continue;
        const key = threat.ownerLocked ? threat.ownerBrawlerId + "_" + Math.floor(threat.spawnTime / PROJECTILE_DEDUP_WINDOW_MS) : threat.gid;
        let list = groups.get(key);
        if (!list) {
            list = [];
            groups.set(key, list);
        }
        list.push(threat);
    }
    if (groups.size === 0) return null;
    const dirs = [];
    for (const list of groups.values()) {
        let sx = 0;
        let sy = 0;
        let px = 0;
        let py = 0;
        for (let i = 0; i < list.length; i++) {
            sx += list[i].dirX;
            sy += list[i].dirY;
            px += list[i].x;
            py += list[i].y;
        }
        const n = list.length || 1;
        sx /= n;
        sy /= n;
        px /= n;
        py /= n;
        const away = normalize2d(myX - px, myY - py);
        const perpA = normalize2d(-sy, sx);
        const perpB = normalize2d(sy, -sx);
        dirs.push(normalize2d(perpA.x * DODGE_CFG.PERP_WEIGHT + away.x * DODGE_CFG.AWAY_WEIGHT, perpA.y * DODGE_CFG.PERP_WEIGHT + away.y * DODGE_CFG.AWAY_WEIGHT));
        dirs.push(normalize2d(perpB.x * DODGE_CFG.PERP_WEIGHT + away.x * DODGE_CFG.AWAY_WEIGHT, perpB.y * DODGE_CFG.PERP_WEIGHT + away.y * DODGE_CFG.AWAY_WEIGHT));
    }
    const all = dirs.concat(dodgeDirections);
    let best = null;
    let bestScore = 1e18;
    for (let i = 0; i < all.length; i++) {
        const score = collectCandidateDodgePoints(all[i], myX, myY, myRadius, intent);
        if (score < bestScore) {
            bestScore = score;
            best = all[i];
        }
    }
    return best ? { dir: best } : null;
}

function isProjectileDataVtable(candidateDir, dir, myX, myY, myRadius, intent) {
    if (!candidateDir || !dir || !isMoveCandidateAllowed(myX, myY, myRadius)) return false;
    const urgent = hasUrgentProjectileThreat();
    const tA = expireOldProjectileTracks(myX, myY, myRadius, candidateDir, urgent);
    const tB = expireOldProjectileTracks(myX, myY, myRadius, dir, urgent);
    if (tA < 0 && tB < 0) return collectCandidateDodgePoints(candidateDir, myX, myY, myRadius, intent) <= collectCandidateDodgePoints(dir, myX, myY, myRadius, intent) * 1.25;
    if (tA >= 0 && tB >= 0) return tA >= tB - 0.05;
    return false;
}

function getProjectileOwnerBrawler(myX, myY, myRadius) {
    return expireOldProjectileTracks(myX, myY, myRadius, { x: 0, y: 0 }, DODGE_CFG.T_RELEASE + 0.1) < 0;
}

export function clearExpiredEnemyTracks() {
    for (const gid in projectileOwnerMemory) delete projectileOwnerMemory[gid];
    projectileThreats.length = 0;
    committedDir = null;
    commitUntil = 0;
    commitAt = 0;
    lastDir = null;
    lastDodgeAt = 0;
    safePointX = 0;
    safePointY = 0;
}

export function resetAutododge() {
    clearExpiredEnemyTracks();
}

export function updateAutododge(battleModeClientPtr, now) {
    if (!autododgeConfig.enabled || !battleModeClientPtr || battleModeClientPtr.isNull() || battleState.lastUpdate === 0) {
        if (!autododgeConfig.enabled) clearExpiredEnemyTracks();
        return false;
    }
    const myX = battleState.myX | 0;
    const myY = battleState.myY | 0;
    const myRadius = battleState.myRadius || 60;
    DODGE_CFG.CHAR_SPEED = battleState.mySpeed || 720;
    trackProjectiles(now, battleState.projectiles || [], battleState.enemies || []);
    chooseAutododgeMove(myX, myY, myRadius);
    if ((battleState.projectiles || []).length === 0 && projectileThreats.length === 0 && !committedDir) return false;
    const zeroDir = { x: 0, y: 0 };
    const tImpact = expireOldProjectileTracks(myX, myY, myRadius, zeroDir, hasUrgentProjectileThreat());
    const threatened = tImpact >= 0 || isPointThreatenedByProjectile(myX, myY, myRadius);
    if (committedDir && now >= commitUntil && getProjectileOwnerBrawler(myX, myY, myRadius)) {
        committedDir = null;
        commitAt = 0;
        commitUntil = 0;
        safePointX = 0;
        safePointY = 0;
        return false;
    }
    let dir = null;
    if (committedDir && !updateProjectileThreats(committedDir, myX, myY, myRadius)) {
        dir = committedDir;
    }
    if (!dir && threatened) {
        const parsed = parseProjectileObject(myX, myY, myRadius, zeroDir);
        const parsedDir = parsed ? parsed.dir : zeroDir;
        const safe = findSafeDodgePoint(myX, myY, myRadius, parsedDir);
        if (safe) {
            safePointX = Math.round(safe.x);
            safePointY = Math.round(safe.y);
            dir = normalize2d(safePointX - myX, safePointY - myY);
            if (lastDir && isProjectileDataVtable(lastDir, dir, myX, myY, myRadius, zeroDir)) dir = lastDir;
        } else if (parsed) {
            dir = parsed.dir;
        }
    }
    if (!dir) {
        committedDir = null;
        safePointX = 0;
        safePointY = 0;
        return false;
    }
    lastDir = dir;
    lastDodgeAt = now;
    if (!committedDir || !sameDirection(committedDir, dir)) {
        committedDir = dir;
        commitAt = now;
        commitUntil = now + DODGE_CFG.DODGE_COMMIT_MS;
    }
    const range = autododgeConfig.range || 900;
    const targetX = safePointX || Math.round(myX + dir.x * range);
    const targetY = safePointY || Math.round(myY + dir.y * range);
    if (Math.hypot(targetX - myX, targetY - myY) <= DODGE_CFG.ARRIVAL_THRESHOLD && !threatened) {
        committedDir = null;
        safePointX = 0;
        safePointY = 0;
        return false;
    }
    return moveToPoint(battleModeClientPtr, targetX, targetY) ? true : false;
}
