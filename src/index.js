import { offsets } from "./core/offsets.js";
import { initFunctions, getFunctions } from "./core/functions.js";
import { aimbotConfig, selectBestTarget, getAimPoint, setAimbotOptions } from "./features/aimbot.js";
import { killauraConfig, updateKillaura, resetKillaura, setKillauraOptions } from "./features/killaura.js";
import { holdToShootConfig, updateHoldToShoot, resetHoldToShoot, setHoldToShootOptions } from "./features/holdtoshoot.js";
import { autododgeConfig, updateAutododge, resetAutododge, setAutododgeOptions } from "./features/autododge.js";

var _started = false;
var lastBM = null;

function onBattleUpdate(bm) {
    if (!lastBM || !lastBM.equals(bm)) {
        lastBM = bm;
        resetKillaura();
        resetHoldToShoot();
        resetAutododge();
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

    updateAutododge(myX, myY, myTeam, objArray, count, now);

    const target = selectBestTarget(ownChar, myX, myY, myTeam, objArray, count);
    if (!target) return;

    const aimPoint = getAimPoint(target, myX, myY);
    const aimTarget = {
        x: aimPoint ? aimPoint.x : target.x,
        y: aimPoint ? aimPoint.y : target.y,
        distSq: target.distSq
    };

    const weaponSkill = fns.LogicCharacterClient_getWeaponSkillClient(ownChar);

    if (holdToShootConfig.enabled) {
        updateHoldToShoot(aimTarget, weaponSkill, now);
    } else if (killauraConfig.enabled) {
        updateKillaura(aimTarget, weaponSkill, now);
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
    setAimbot(opts) {
        setAimbotOptions(opts);
    },
    setKillaura(opts) {
        setKillauraOptions(opts);
    },
    setHoldToShoot(opts) {
        setHoldToShootOptions(opts);
    },
    setAutododge(opts) {
        setAutododgeOptions(opts);
    }
};

startAgent();