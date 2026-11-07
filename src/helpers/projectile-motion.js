import { DODGE_CFG } from "./dodge_profiles.js";
import { distSqPointToSegment } from "./dodge_kinds.js";
import { projectileThreats } from "./threat-memory.js";

export function performAutododgeMove(threat, myX, myY, myRadius, moveDir, tMax) {
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
    if (tHit > tMax) return -1;

    if (threat._clipBlocked && isFinite(threat._clipDist) && threat.speed * (tHit + DODGE_CFG.LAG_COMPENSATION_S) > threat._clipDist + (threat.impactRadius || threat.radius)) {
        return -1;
    }
    return tHit;
}

export function expireOldProjectileTracks(myX, myY, myRadius, moveDir, tMax) {
    let earliest = -1;
    for (let i = 0; i < projectileThreats.length; i++) {
        const t = performAutododgeMove(projectileThreats[i], myX, myY, myRadius, moveDir, tMax);
        if (t < 0) continue;
        if (earliest < 0 || t < earliest) earliest = t;
    }
    return earliest;
}

export function projectileClearanceAtPoint(px, py, myRadius) {
    let minClearance = Infinity;
    for (let i = 0; i < projectileThreats.length; i++) {
        const threat = projectileThreats[i];
        if (threat.ignored) continue;
        const t = Math.min(DODGE_CFG.T_FIELD, Math.max(0.25, (threat.range || 9000) / Math.max(1, threat.speed)));
        const ex = threat.x + threat._svx * t;
        const ey = threat.y + threat._svy * t;
        const margin = myRadius + (threat.impactRadius || threat.radius) + DODGE_CFG.SAFETY_MARGIN;
        const d = Math.sqrt(distSqPointToSegment(px, py, threat.x, threat.y, ex, ey)) - margin;
        if (d < minClearance) minClearance = d;
    }
    return minClearance;
}

export function isPointThreatenedByProjectile(px, py, myRadius) {
    for (let i = 0; i < projectileThreats.length; i++) {
        const threat = projectileThreats[i];
        if (threat.ignored) continue;
        const t = Math.min(DODGE_CFG.T_FIELD, Math.max(0.25, (threat.range || 9000) / Math.max(1, threat.speed)));
        const ex = threat.x + threat._svx * t;
        const ey = threat.y + threat._svy * t;
        const margin = myRadius + (threat.impactRadius || threat.radius) + DODGE_CFG.SAFETY_MARGIN;
        if (distSqPointToSegment(px, py, threat.x, threat.y, ex, ey) <= margin * margin) {
            return true;
        }
    }
    return false;
}
