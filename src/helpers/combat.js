import { offsets } from "../core/offsets.js";
import { getFunctions } from "../core/functions.js";
import { scanData } from "../core/scan.js";
import { projectileLineClear } from "../features/walls.js";
import { sendAttack } from "../core/commands.js";

const STICKY_RANGE_BUFFER = 250;
const UNBOUNDED_DIST_SQ = 1e18;

var stickyTargetGid = null;

export function resetCombat() {
    stickyTargetGid = null;
}

export function isTargetReachable(enemy, myX, myY) {
    if (!enemy || enemy.isImmune) return false;
    return projectileLineClear(myX, myY, enemy.x, enemy.y);
}

export function pickBestTarget(myX, myY, maxRange = 4200) {
    const enemies = scanData.enemies || [];
    if (enemies.length === 0) {
        stickyTargetGid = null;
        return null;
    }

    const rangeSq = maxRange > 0 ? (maxRange * maxRange) : UNBOUNDED_DIST_SQ;
    const stickyRangeSq = maxRange > 0 ? ((maxRange + STICKY_RANGE_BUFFER) * (maxRange + STICKY_RANGE_BUFFER)) : UNBOUNDED_DIST_SQ;

    let best = null;

    if (stickyTargetGid !== null) {
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            if (enemy.gid !== stickyTargetGid) continue;

            const dx = enemy.x - myX;
            const dy = enemy.y - myY;
            if (dx * dx + dy * dy <= stickyRangeSq && isTargetReachable(enemy, myX, myY)) {
                best = enemy;
            }
            break;
        }
        if (!best) {
            stickyTargetGid = null;
        }
    }

    if (!best) {
        let bestDistSq = rangeSq;
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            const dx = enemy.x - myX;
            const dy = enemy.y - myY;
            const distSq = dx * dx + dy * dy;

            if (distSq >= bestDistSq) continue;
            if (!isTargetReachable(enemy, myX, myY)) continue;

            bestDistSq = distSq;
            best = enemy;
        }
    }

    if (best) {
        stickyTargetGid = best.gid;
    }
    return best;
}

export function hasAmmo(ownChar) {
    if (!ownChar || ownChar.isNull()) return true;
    const fns = getFunctions();
    try {
        const weaponSkill = fns.LogicCharacterClient_getWeaponSkillClient(ownChar);
        if (!weaponSkill || weaponSkill.isNull()) return true;
        return true;
    } catch (_) {
        return true;
    }
}

export function executeFire(targetPoint, weaponSkill, isHold = false) {
    if (!targetPoint || !weaponSkill || weaponSkill.isNull()) return false;
    return sendAttack(targetPoint.x, targetPoint.y, weaponSkill, isHold);
}