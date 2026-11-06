import { offsets } from "../core/offsets.js";
import { getFunctions } from "../core/functions.js";
import { sendMove } from "../core/commands.js";

var lastDodgeMs = 0;

export var autododgeConfig = {
    enabled: true,
    range: 1100,
    cooldownMs: 80,
    dodgeDistance: 850,
    threatDotThreshold: 0.6
};

export function setAutododgeOptions(opts = {}) {
    if (typeof opts.enabled === "boolean") autododgeConfig.enabled = opts.enabled;
    if (typeof opts.range === "number") autododgeConfig.range = opts.range;
    if (typeof opts.cooldownMs === "number") autododgeConfig.cooldownMs = opts.cooldownMs;
    if (typeof opts.dodgeDistance === "number") autododgeConfig.dodgeDistance = opts.dodgeDistance;
    if (typeof opts.threatDotThreshold === "number") autododgeConfig.threatDotThreshold = opts.threatDotThreshold;
}

export function resetAutododge() {
    lastDodgeMs = 0;
}

export function updateAutododge(myX, myY, myTeam, objArray, count, now) {
    if (!autododgeConfig.enabled || now - lastDodgeMs < autododgeConfig.cooldownMs) return false;

    const fns = getFunctions();
    const projVtable = Process.mainModule.base.add(offsets.vtable_LogicProjectileData);
    const rangeSq = autododgeConfig.range * autododgeConfig.range;

    let dodgeVecX = 0;
    let dodgeVecY = 0;
    let countThreats = 0;

    for (let i = 0; i < count; i++) {
        const obj = objArray.add(i * 8).readPointer();
        if (!obj || obj.isNull()) continue;

        const team = obj.add(offsets.LogicGameObjectClient_currentTeamIndex).readU32();
        if (team === myTeam) continue;

        const data = fns.LogicGameObjectClient_getData(obj);
        if (!data || data.isNull()) continue;

        const vt = data.readPointer();
        if (!vt.equals(projVtable)) continue;

        const px = fns.LogicGameObjectClient_getX(obj);
        const py = fns.LogicGameObjectClient_getY(obj);
        const toPlayerX = myX - px;
        const toPlayerY = myY - py;
        const distSq = toPlayerX * toPlayerX + toPlayerY * toPlayerY;

        if (distSq < rangeSq && distSq > 0) {
            const rawAngle = obj.add(offsets.Projectile_getAngle).readI32();
            const rad = (rawAngle * Math.PI) / 180;
            const vx = Math.cos(rad);
            const vy = Math.sin(rad);

            const dist = Math.sqrt(distSq);
            const dot = (toPlayerX * vx + toPlayerY * vy) / dist;

            if (dot > autododgeConfig.threatDotThreshold) {
                dodgeVecX += -vy;
                dodgeVecY += vx;
                countThreats++;
            }
        }
    }

    if (countThreats > 0) {
        lastDodgeMs = now;
        const targetX = (myX + (dodgeVecX / countThreats) * autododgeConfig.dodgeDistance) | 0;
        const targetY = (myY + (dodgeVecY / countThreats) * autododgeConfig.dodgeDistance) | 0;
        sendMove(targetX, targetY);
        return true;
    }

    return false;
}