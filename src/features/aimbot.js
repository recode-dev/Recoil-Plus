import { offsets } from "../core/offsets.js";
import { getFunctions } from "../core/functions.js";

export var aimbotConfig = {
    enabled: true,
    leadFactor: 0.15,
    maxRange: 5000
};

export function setAimbotOptions(opts = {}) {
    if (typeof opts.enabled === "boolean") aimbotConfig.enabled = opts.enabled;
    if (typeof opts.leadFactor === "number") aimbotConfig.leadFactor = opts.leadFactor;
    if (typeof opts.maxRange === "number") aimbotConfig.maxRange = opts.maxRange;
}

export function selectBestTarget(ownChar, myX, myY, myTeam, objArray, count, maxRange = aimbotConfig.maxRange) {
    const fns = getFunctions();
    const charVtable = Process.mainModule.base.add(offsets.vtable_LogicCharacterData);
    let best = null;
    let bestDistSq = maxRange > 0 ? (maxRange * maxRange) : Infinity;

    for (let i = 0; i < count; i++) {
        const obj = objArray.add(i * 8).readPointer();
        if (!obj || obj.isNull() || obj.equals(ownChar)) continue;

        const team = obj.add(offsets.LogicGameObjectClient_currentTeamIndex).readU32();
        if (team === myTeam) continue;

        const data = fns.LogicGameObjectClient_getData(obj);
        if (!data || data.isNull()) continue;

        const vt = data.readPointer();
        if (!vt.equals(charVtable)) continue;

        const ex = fns.LogicGameObjectClient_getX(obj);
        const ey = fns.LogicGameObjectClient_getY(obj);
        const dx = ex - myX;
        const dy = ey - myY;
        const distSq = dx * dx + dy * dy;

        if (distSq < bestDistSq) {
            bestDistSq = distSq;
            best = {
                ptr: obj,
                x: ex,
                y: ey,
                distSq: distSq
            };
        }
    }
    return best;
}

export function getAimPoint(target, myX, myY) {
    if (!target) return null;
    if (!aimbotConfig.leadFactor || aimbotConfig.leadFactor <= 0) {
        return { x: target.x, y: target.y };
    }
    const dx = target.x - myX;
    const dy = target.y - myY;
    return {
        x: (target.x + dx * aimbotConfig.leadFactor) | 0,
        y: (target.y + dy * aimbotConfig.leadFactor) | 0
    };
}