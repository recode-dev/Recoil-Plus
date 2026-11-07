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

export function writeManualFirePoint(battleScreen, x, y) {
    if (!battleScreen || battleScreen.isNull()) return false;
    try {
        const xi = x | 0;
        const yi = y | 0;

        // Dynamic offsets from offsets.js if present
        if (typeof offsets.BattleScreen_shootStickX === "number" && typeof offsets.BattleScreen_shootStickY === "number") {
            try {
                battleScreen.add(offsets.BattleScreen_shootStickX).writeS32(xi);
                battleScreen.add(offsets.BattleScreen_shootStickY).writeS32(yi);
                battleScreen.add(offsets.BattleScreen_shootStickX - 152).writeS32(xi);
                battleScreen.add(offsets.BattleScreen_shootStickY - 152).writeS32(yi);
            } catch (_) {}
        }

        // Inline offsets as in jirgear
        try {
            battleScreen.add(3844).writeS32(xi);
            battleScreen.add(3848).writeS32(yi);
            battleScreen.add(3692).writeS32(xi);
            battleScreen.add(3696).writeS32(yi);
            battleScreen.add(1644).writeS32(0);
        } catch (_) {}

        return true;
    } catch (_) {
        return false;
    }
}

export function fireMainAttack(battleScreen, ownCharacter, x, y, hold) {
    try {
        if (!battleScreen || battleScreen.isNull() || !ownCharacter || ownCharacter.isNull()) return false;
        const fns = getFunctions();

        writeManualFirePoint(battleScreen, x, y);

        // Native fire as in jirgear (BattleScreen_handleAutoShoot / fireWrapperFn)
        if (fns.BattleScreen_handleAutoShoot) {
            try {
                fns.BattleScreen_handleAutoShoot(battleScreen, ownCharacter);
                return true;
            } catch (_) {}
        }
        if (fns.BattleScreen_tryToActivateSkill) {
            try {
                const skill = fns.LogicCharacterClient_getWeaponSkillClient ? fns.LogicCharacterClient_getWeaponSkillClient(ownCharacter) : null;
                fns.BattleScreen_tryToActivateSkill(battleScreen, ownCharacter, skill, x | 0, y | 0, hold ? 1 : 0, 0);
                return true;
            } catch (_) {}
        }
        if (fns.BattleScreen_activateSkill) {
            try {
                const skill = fns.LogicCharacterClient_getWeaponSkillClient ? fns.LogicCharacterClient_getWeaponSkillClient(ownCharacter) : null;
                fns.BattleScreen_activateSkill(battleScreen, x | 0, y | 0, ownCharacter, skill, hold ? 1 : 0, 0);
                return true;
            } catch (_) {}
        }
        return false;
    } catch (_) {
        return false;
    }
}
