import {
    DODGE_CFG,
    EXTRA_RADIUS_BY_BRAWLER_ID,
    PROJECTILE_IMPACT_RADIUS_BY_BRAWLER_ID,
    LOB_OR_MELEE_BRAWLERS
} from "./dodge_profiles.js";

export function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

export function normalize2d(x, y) {
    const len = Math.sqrt(x * x + y * y);
    return len < 1e-6 ? { x: 1, y: 0 } : { x: x / len, y: y / len };
}

export function sameDirection(a, b) {
    return !!(a && b && a.x * b.x + a.y * b.y > 0.98);
}

export function distSqPointToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-10) {
        const ex = px - x1;
        const ey = py - y1;
        return ex * ex + ey * ey;
    }
    let u = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    if (u < 0) u = 0;
    else if (u > 1) u = 1;
    const cx = x1 + u * dx;
    const cy = y1 + u * dy;
    const ex = px - cx;
    const ey = py - cy;
    return ex * ex + ey * ey;
}

export function startDodgeCommit(brawlerName, isBeam) {
    if (isBeam) return true;
    if (!brawlerName) return false;
    return LOB_OR_MELEE_BRAWLERS.has(String(brawlerName).toUpperCase());
}

export function projectileRadiusForBrawler(radius, speed, brawlerId) {
    const extra = (brawlerId && EXTRA_RADIUS_BY_BRAWLER_ID[brawlerId]) || 0;
    if (extra > 0) return Math.max(radius, extra);
    const impact = brawlerId ? PROJECTILE_IMPACT_RADIUS_BY_BRAWLER_ID[brawlerId] : undefined;
    if (impact !== undefined) return Math.max(radius, impact);
    if (speed > 0 && speed < 1200 && radius > 0 && radius < 120) {
        return Math.min(220, radius * 2.25);
    }
    return radius || 8;
}

export function compareDodgePoints(a, b) {
    if (a.dist !== b.dist) return a.dist - b.dist;
    return b.clearance - a.clearance;
}
