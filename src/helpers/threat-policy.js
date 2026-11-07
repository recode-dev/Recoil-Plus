import { DODGE_CFG } from "./dodge_profiles.js";
import { performAutododgeMove, expireOldProjectileTracks } from "./projectile-motion.js";
import { projectileThreats } from "./threat-memory.js";

var cachedUrgentT = DODGE_CFG.T_URGENT_MIN;
var cachedUrgentTs = 0;
var maxObservedThreatSpeed = 0;

export function setMaxObservedThreatSpeed(spd) {
    maxObservedThreatSpeed = spd;
}

export function hasUrgentProjectileThreat() {
    const now = Date.now();
    if (now - cachedUrgentTs < 16) return cachedUrgentT;
    const speedNorm = (Math.max(420, Math.min(900, DODGE_CFG.CHAR_SPEED || 720)) - 420) / 480;
    let t = DODGE_CFG.T_URGENT_MIN + (1 - speedNorm) * (DODGE_CFG.T_URGENT_MAX - DODGE_CFG.T_URGENT_MIN);
    if (maxObservedThreatSpeed > 1800) {
        t += Math.min(0.25, (maxObservedThreatSpeed - 1800) / 1080 * 0.25);
    }
    cachedUrgentT = t;
    cachedUrgentTs = now;
    return t;
}

export function isMoveCandidateAllowed(x, y, dx, dy, r) {
    return true;
}

export function clearBattleState(threat, myX, myY, myRadius, moveDir) {
    return performAutododgeMove(threat, myX, myY, myRadius, moveDir, hasUrgentProjectileThreat()) >= 0;
}

export function updateProjectileThreats(moveDir, myX, myY, myRadius) {
    if (!isMoveCandidateAllowed(myX, myY, moveDir.x, moveDir.y, myRadius)) return true;
    for (let i = 0; i < projectileThreats.length; i++) {
        if (performAutododgeMove(projectileThreats[i], myX, myY, myRadius, moveDir, DODGE_CFG.T_FIELD) >= 0) {
            return true;
        }
    }
    return false;
}

export function isProjectileDataVtable(dirA, dirB, myX, myY, myRadius, intentDir, collectCandidateDodgePointsFn) {
    if (!dirA || !dirB || !isMoveCandidateAllowed(myX, myY, dirA.x, dirA.y, myRadius)) return false;
    const urgent = hasUrgentProjectileThreat();
    const tA = expireOldProjectileTracks(myX, myY, myRadius, dirA, urgent);
    const tB = expireOldProjectileTracks(myX, myY, myRadius, dirB, urgent);

    if (tA < 0 && tB < 0) {
        return collectCandidateDodgePointsFn(dirA, myX, myY, myRadius, intentDir) <= collectCandidateDodgePointsFn(dirB, myX, myY, myRadius, intentDir) * 1.25;
    }
    if (tA >= 0 && tB >= 0) {
        return tA >= tB - 0.05;
    }
    return false;
}

export function getProjectileOwnerBrawler(myX, myY, myRadius) {
    return expireOldProjectileTracks(myX, myY, myRadius, { x: 0, y: 0 }, DODGE_CFG.T_RELEASE + 0.1) < 0;
}
