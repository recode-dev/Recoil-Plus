import { sendAttack } from "../core/commands.js";

var lastAttackMs = 0;

export var killauraConfig = {
    enabled: true,
    range: 4200,
    intervalMs: 150
};

export function setKillauraOptions(opts = {}) {
    if (typeof opts.enabled === "boolean") killauraConfig.enabled = opts.enabled;
    if (typeof opts.range === "number") killauraConfig.range = opts.range;
    if (typeof opts.intervalMs === "number") killauraConfig.intervalMs = opts.intervalMs;
}

export function resetKillaura() {
    lastAttackMs = 0;
}

export function updateKillaura(target, weaponSkill, now) {
    if (!killauraConfig.enabled || !target || !weaponSkill || weaponSkill.isNull()) return false;
    if (now - lastAttackMs < killauraConfig.intervalMs) return false;

    const rangeSq = killauraConfig.range * killauraConfig.range;
    if (target.distSq <= rangeSq) {
        lastAttackMs = now;
        return sendAttack(target.x, target.y, weaponSkill, false);
    }
    return false;
}