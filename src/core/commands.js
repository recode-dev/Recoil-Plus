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

export function fireMainAttack(battleScreen, ownCharacter, x, y, hold) {
    try {
        if (!battleScreen || battleScreen.isNull() || !ownCharacter || ownCharacter.isNull()) return false;
        const fns = getFunctions();
        const skill = fns.LogicCharacterClient_getWeaponSkillClient(ownCharacter);
        if (!skill || skill.isNull()) return false;

        battleScreen.add(offsets.BattleScreen_shootStickX).writeS32(x | 0);
        battleScreen.add(offsets.BattleScreen_shootStickY).writeS32(y | 0);

        if (fns.BattleScreen_tryToActivateSkill) {
            fns.BattleScreen_tryToActivateSkill(battleScreen, ownCharacter, skill, x | 0, y | 0, hold ? 1 : 0, 0);
            return true;
        } else if (fns.BattleScreen_activateSkill) {
            fns.BattleScreen_activateSkill(battleScreen, x | 0, y | 0, ownCharacter, skill, hold ? 1 : 0, 0);
            return true;
        } else if (fns.BattleScreen_handleAutoShoot) {
            return fns.BattleScreen_handleAutoShoot(battleScreen, ownCharacter);
        }
        return false;
    } catch (_) {
        return false;
    }
}
