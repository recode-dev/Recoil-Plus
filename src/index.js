import { offsets } from "./offsets.js";
import { initFunctions, getFunctions } from "./functions.js";
import { sendMove, sendAttack, setBattleScreenAim, resetBattleScreenAim } from "./commands.js";

var _started = false;
var lastBM = null;
var lastKillauraMs = 0;
var lastDodgeMs = 0;

export var config = {
    aimbot: true,
    killaura: true,
    autododge: true,

    killauraRange: 4200,
    killauraIntervalMs: 150,
    dodgeRange: 1100,
    dodgeCooldownMs: 80,
    aimLeadFactor: 0.15
};

export function handleAimbot(ownChar, myX, myY, myTeam, objArray, count) {
    const fns = getFunctions();
    const charVtable = Process.mainModule.base.add(offsets.vtable_LogicCharacterData);
    let best = null;
    let bestDistSq = Infinity;

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
                x: (ex + dx * config.aimLeadFactor) | 0,
                y: (ey + dy * leadFactor) | 0,
                distSq: distSq
            };
        }
    }
    return best;
}

export function handleKillaura(target, weaponSkill, now) {
    if (!config.killaura || !target || now - lastKillauraMs < config.killauraIntervalMs) return;
    if (target.distSq <= config.killauraRange * config.killauraRange) {
        lastKillauraMs = now;
        sendAttack(target.x, target.y, weaponSkill, false);
    }
}

export function handleAutododge(myX, myY, myTeam, objArray, count, now) {
    if (!config.autododge || now - lastDodgeMs < config.dodgeCooldownMs) return;

    const fns = getFunctions();
    const projVtable = Process.mainModule.base.add(offsets.vtable_LogicProjectileData);
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

        if (distSq < config.dodgeRange * config.dodgeRange && distSq > 0) {
            const rawAngle = obj.add(offsets.Projectile_getAngle).readI32();
            const rad = (rawAngle * Math.PI) / 180;
            const vx = Math.cos(rad);
            const vy = Math.sin(rad);

            const dot = (toPlayerX * vx + toPlayerY * vy) / Math.sqrt(distSq);
            if (dot > 0.6) {
                dodgeVecX += -vy;
                dodgeVecY += vx;
                countThreats++;
            }
        }
    }

    if (countThreats > 0) {
        lastDodgeMs = now;
        const targetX = (myX + (dodgeVecX / countThreats) * 850) | 0;
        const targetY = (myY + (dodgeVecY / countThreats) * 850) | 0;
        sendMove(targetX, targetY);
    }
}

function onBattleUpdate(bm) {
    if (!lastBM || !lastBM.equals(bm)) {
        lastBM = bm;
    }

    const now = Date.now();
    const fns = getFunctions();
    const ownChar = fns.LogicBattleModeClient_getOwnCharacter(bm);
    if (!ownChar || ownChar.isNull()) return;

    const myTeam = fns.LogicBattleModeClient_getOwnPlayerTeam(bm);
    const myX = fns.LogicGameObjectClient_getX(ownChar);
    const myY = fns.LogicGameObjectClient_getY(ownChar);

    const objMgr = bm.add(offsets.LogicBattleModeClient_gameObjectManager).readPointer();
    if (!objMgr || objMgr.isNull()) return;

    const count = objMgr.add(offsets.LogicGameObjectManagerClient_gameObjectCount).readU32();
    const objArray = objMgr.readPointer();
    if (!objArray || objArray.isNull()) return;

    handleAutododge(myX, myY, myTeam, objArray, count, now);

    const target = handleAimbot(ownChar, myX, myY, myTeam, objArray, count);
    if (target) {
        const weaponSkill = fns.LogicCharacterClient_getWeaponSkillClient(ownChar);
        handleKillaura(target, weaponSkill, now);
    }
}

export function startAgent() {
    if (_started) return true;

    const base = Process.mainModule.base;
    initFunctions(base);

    Interceptor.attach(base.add(offsets.LogicBattleModeClient_update), {
        onEnter(args) {
            try {
                const bm = args[0];
                if (!bm || bm.isNull()) return;
                onBattleUpdate(bm);
            } catch (_) {}
        }
    });

    _started = true;
    return true;
}

rpc.exports = {
    start() {
        return startAgent();
    },
    toggle(key, val) {
        if (key in config) {
            config[key] = !!val;
        }
    }
};

startAgent();