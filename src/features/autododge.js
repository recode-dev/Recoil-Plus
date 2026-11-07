import { battleState } from "../core/scanner.js";
import { moveToPoint } from "../core/commands.js";
import { flags } from "../utils/flags.js";
import { DODGE_CFG, combatConfig } from "../helpers/dodge_profiles.js";
import { normalize2d, sameDirection } from "../helpers/dodge_kinds.js";
import { projectileThreats, trackProjectiles, clearExpiredEnemyTracks } from "../helpers/threat-memory.js";
import { expireOldProjectileTracks, isPointThreatenedByProjectile } from "../helpers/projectile-motion.js";
import {
    hasUrgentProjectileThreat,
    updateProjectileThreats,
    isProjectileDataVtable,
    getProjectileOwnerBrawler
} from "../helpers/threat-policy.js";
import {
    rebuildDodgeDirections,
    chooseAutododgeMove,
    collectCandidateDodgePoints,
    parseProjectileObject,
    findSafeDodgePoint
} from "../helpers/dodge-planner.js";

rebuildDodgeDirections();

let safePointX = 0;
let safePointY = 0;
let committedDir = null;
let commitUntil = 0;
let commitAt = 0;
let lastDir = null;
var lastMoveAssistMs = 0;
var lastImpactMs = -1;

function resetDodgeState() {
    committedDir = null;
    commitUntil = 0;
    commitAt = 0;
    lastDir = null;
    safePointX = 0;
    safePointY = 0;
    lastMoveAssistMs = 0;
    lastImpactMs = -1;
}

// JirGear clearExpiredEnemyTracks: wipes projectile owner memory, threats and
// the whole commit state machine.
export function resetAutododge() {
    clearExpiredEnemyTracks();
    resetDodgeState();
}

export function getThreatCount() {
    return projectileThreats.length;
}

// JirGear tryHoldToShoot (autododge engine entry), exact port.
export function updateAutododge(bm, now) {
    if (!flags.autododgeEnabled || !bm || bm.isNull() || battleState.lastUpdate === 0) {
        if (!flags.autododgeEnabled) resetAutododge();
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
    lastImpactMs = tImpact >= 0 ? Math.round(tImpact * 1000) : -1;
    const threatened = tImpact >= 0 || isPointThreatenedByProjectile(myX, myY, myRadius);

    if (committedDir && now >= commitUntil && getProjectileOwnerBrawler(myX, myY, myRadius)) {
        resetDodgeState();
        return false;
    }

    let dir = null;
    if (committedDir && !updateProjectileThreats(committedDir, myX, myY, myRadius)) {
        dir = committedDir;
    }

    if (!dir && threatened) {
        const parsed = parseProjectileObject(myX, myY, myRadius, zeroDir, zeroDir);
        const parsedDir = parsed ? parsed.dir : zeroDir;
        const safe = findSafeDodgePoint(myX, myY, myRadius, parsedDir);
        if (safe) {
            safePointX = Math.round(safe.x);
            safePointY = Math.round(safe.y);
            dir = normalize2d(safePointX - myX, safePointY - myY);
            if (lastDir && isProjectileDataVtable(lastDir, dir, myX, myY, myRadius, zeroDir, collectCandidateDodgePoints)) dir = lastDir;
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
    if (!committedDir || !sameDirection(committedDir, dir)) {
        committedDir = dir;
        commitAt = now;
        commitUntil = now + DODGE_CFG.DODGE_COMMIT_MS;
    }

    const range = combatConfig.combatDodgeRange || 900;
    const targetX = safePointX || Math.round(myX + dir.x * range);
    const targetY = safePointY || Math.round(myY + dir.y * range);
    if (Math.hypot(targetX - myX, targetY - myY) <= DODGE_CFG.ARRIVAL_THRESHOLD && !threatened) {
        resetDodgeState();
        return false;
    }

    return moveToPoint(bm, targetX, targetY) ? (lastMoveAssistMs = now, true) : false;
}
