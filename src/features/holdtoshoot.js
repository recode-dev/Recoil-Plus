import { sendAttack, sendReleaseAttack } from "../core/commands.js";

var lastHoldMs = 0;
var isHolding = false;

export var holdToShootConfig = {
    enabled: true,
    delayMs: 120
};

export function setHoldToShootOptions(opts = {}) {
    if (typeof opts.enabled === "boolean") holdToShootConfig.enabled = opts.enabled;
    if (typeof opts.delayMs === "number") holdToShootConfig.delayMs = opts.delayMs;
}

export function resetHoldToShoot() {
    lastHoldMs = 0;
    isHolding = false;
}

export function updateHoldToShoot(target, weaponSkill, now) {
    if (!holdToShootConfig.enabled || !target || !weaponSkill || weaponSkill.isNull()) {
        if (isHolding) {
            isHolding = false;
        }
        return false;
    }

    if (!isHolding) {
        isHolding = true;
        lastHoldMs = now;
        return sendAttack(target.x, target.y, weaponSkill, true);
    } else if (now - lastHoldMs >= holdToShootConfig.delayMs) {
        isHolding = false;
        return sendReleaseAttack(target.x, target.y, weaponSkill);
    }

    return false;
}