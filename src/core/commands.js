import { offsets } from "./offsets.js";
import { getFunctions } from "./functions.js";

export function moveToPoint(battleModeClientPtr, x, y) {
    try {
        if (!battleModeClientPtr || battleModeClientPtr.isNull()) return false;
        const fns = getFunctions();
        if (fns.LogicBattleModeClient_setClientPredictionMoveTo) {
            fns.LogicBattleModeClient_setClientPredictionMoveTo(battleModeClientPtr, x | 0, y | 0, 1);
        }
        const battle = fns.BattleMode_getInstance();
        const mgr = (battle && !battle.isNull() ? battle : battleModeClientPtr).add(offsets.BattleMode_clientInputManager).readPointer();
        if (mgr && !mgr.isNull()) {
            const ci = fns.malloc(72);
            if (fns.memset) fns.memset(ci, 0, 72);
            fns.ClientInput_ctor(ci, 2);
            ci.add(offsets.ClientInput_x).writeS32(x | 0);
            ci.add(offsets.ClientInput_y).writeS32(y | 0);
            fns.ClientInputManager_addInput(mgr, ci);
        }
        return true;
    } catch (_) {
        return false;
    }
}

export function sendSkillInput(x, y) {
    try {
        const fns = getFunctions();
        const battle = fns.BattleMode_getInstance();
        if (!battle || battle.isNull()) return false;
        const mgr = battle.add(offsets.BattleMode_clientInputManager).readPointer();
        if (!mgr || mgr.isNull()) return false;
        const ci = fns.malloc(72);
        if (fns.memset) fns.memset(ci, 0, 72);
        fns.ClientInput_ctor(ci, 10);
        ci.add(offsets.ClientInput_x).writeS32(x | 0);
        ci.add(offsets.ClientInput_y).writeS32(y | 0);
        fns.ClientInputManager_addInput(mgr, ci);
        return true;
    } catch (_) {
        return false;
    }
}

export function sendAttack(x, y, hold) {
    try {
        const fns = getFunctions();
        const battle = fns.BattleMode_getInstance();
        if (!battle || battle.isNull()) return false;
        const mgr = battle.add(offsets.BattleMode_clientInputManager).readPointer();
        if (!mgr || mgr.isNull()) return false;
        const ci = fns.malloc(72);
        if (fns.memset) fns.memset(ci, 0, 72);
        fns.ClientInput_ctor(ci, 0);
        ci.add(offsets.ClientInput_x).writeS32(x | 0);
        ci.add(offsets.ClientInput_y).writeS32(y | 0);
        if (hold) ci.add(0x18).writeU8(1);
        fns.ClientInputManager_addInput(mgr, ci);
        return true;
    } catch (_) {
        return false;
    }
}
