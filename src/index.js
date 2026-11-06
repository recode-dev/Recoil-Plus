import { offsets } from "./offsets.js";
import { initFunctions, getFunctions } from "./functions.js";
import { sendMove, sendAttack, setBattleScreenAim, resetBattleScreenAim } from "./commands.js";

var _started = false;
var lastBM = null;

export var state = {
    aimbot: true,
    autododge: true,
    esp: true,
    killaura: false
};

function onBattleUpdate(bm) {
    if (!lastBM || !lastBM.equals(bm)) {
        lastBM = bm;
    }

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

    let closestEnemy = null;
    let closestDistSq = Infinity;

    for (let i = 0; i < count; i++) {
        const obj = objArray.add(i * 8).readPointer();
        if (!obj || obj.isNull() || obj.equals(ownChar)) continue;

        const team = obj.add(offsets.LogicGameObjectClient_currentTeamIndex).readU32();
        if (team === myTeam) continue;

        const data = fns.LogicGameObjectClient_getData(obj);
        if (!data || data.isNull()) continue;

        const vt = data.readPointer();
        if (vt.equals(Process.mainModule.base.add(offsets.vtable_LogicCharacterData))) {
            const ex = fns.LogicGameObjectClient_getX(obj);
            const ey = fns.LogicGameObjectClient_getY(obj);
            const dx = ex - myX;
            const dy = ey - myY;
            const distSq = dx * dx + dy * dy;

            if (distSq < closestDistSq) {
                closestDistSq = distSq;
                closestEnemy = { ptr: obj, x: ex, y: ey, distSq: distSq };
            }
        }
    }

    if (state.aimbot && closestEnemy) {
        const weaponSkill = fns.LogicCharacterClient_getWeaponSkillClient(ownChar);
        if (state.killaura && closestEnemy.distSq < 1500 * 1500) {
            sendAttack(closestEnemy.x, closestEnemy.y, weaponSkill);
        }
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
    toggle(feature, val) {
        if (feature in state) {
            state[feature] = !!val;
        }
    }
};

startAgent();