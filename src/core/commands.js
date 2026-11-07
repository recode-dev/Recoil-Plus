import { offsets } from "./offsets.js";
import { getFunctions } from "./functions.js";
import { flags } from "../utils/flags.js";

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
            const ci = fns.malloc(64);
            if (fns.memset) fns.memset(ci, 0, 64);
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

        if (typeof offsets.BattleScreen_shootStickX === "number" && typeof offsets.BattleScreen_shootStickY === "number") {
            try {
                battleScreen.add(offsets.BattleScreen_shootStickX).writeS32(xi);
                battleScreen.add(offsets.BattleScreen_shootStickY).writeS32(yi);
                battleScreen.add(offsets.BattleScreen_shootStickX - 152).writeS32(xi);
                battleScreen.add(offsets.BattleScreen_shootStickY - 152).writeS32(yi);
            } catch (_) {}
        }

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

export function fireAtPoint(type) {
    try {
        const fns = getFunctions();
        const inst = fns.BattleMode_getInstance();
        if (!inst || inst.isNull()) return false;
        const mgr = inst.add(offsets.BattleMode_clientInputManager).readPointer();
        if (!mgr || mgr.isNull()) return false;
        const ci = fns.malloc(100);
        if (fns.memset) fns.memset(ci, 0, 100);
        fns.ClientInput_ctor(ci, type | 0);
        fns.ClientInputManager_addInput(mgr, ci);
        return true;
    } catch (_) {
        return false;
    }
}

export const battleTickConfig = {
    pinIntervalMs: 800,
    sprayIntervalMs: 600
};

var lastPinMs = 0;
var lastSprayMs = 0;

export function resetBattleTick() {
    lastPinMs = 0;
    lastSprayMs = 0;
}

export function battleTickUpdate(now) {
    if (flags.pinEnabled && now - lastPinMs >= battleTickConfig.pinIntervalMs) {
        if (fireAtPoint(9)) lastPinMs = now;
    }
    if (flags.sprayEnabled && now - lastSprayMs >= battleTickConfig.sprayIntervalMs) {
        if (fireAtPoint(15)) lastSprayMs = now;
    }
}

export function fireMainAttack(battleScreen, ownCharacter, x, y, hold) {
    try {
        if (!battleScreen || battleScreen.isNull() || !ownCharacter || ownCharacter.isNull()) return false;
        const fns = getFunctions();

        writeManualFirePoint(battleScreen, x, y);

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

export function fireSuperAttack(battleScreen, ownCharacter, x, y) {
    try {
        if (!battleScreen || battleScreen.isNull() || !ownCharacter || ownCharacter.isNull()) return false;
        const fns = getFunctions();
        writeManualFirePoint(battleScreen, x, y);
        if (fns.BattleScreen_activateSkill) {
            try {
                const skill = fns.LogicCharacterClient_getWeaponSkillClient ? fns.LogicCharacterClient_getWeaponSkillClient(ownCharacter) : null;
                fns.BattleScreen_activateSkill(battleScreen, x | 0, y | 0, ownCharacter, skill, 0, 0);
                return true;
            } catch (_) {}
        }
        return false;
    } catch (_) {
        return false;
    }
}
