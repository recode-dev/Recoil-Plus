import { offsets } from "./offsets.js";
import { getFunctions } from "./functions.js";

const CMD_BUF_SIZE = 72;
const _zeroBuf = new Uint8Array(CMD_BUF_SIZE).buffer;

export function sendCommand(cmdType, fillFn) {
    try {
        const fns = getFunctions();
        const battle = fns.BattleMode_getInstance();
        if (!battle || battle.isNull()) return false;

        const mgr = battle.add(offsets.BattleMode_clientInputManager).readPointer();
        if (!mgr || mgr.isNull()) return false;

        const ci = fns.malloc(CMD_BUF_SIZE);
        if (!ci || ci.isNull()) return false;

        ci.writeByteArray(_zeroBuf);
        fns.ClientInput_ctor(ci, cmdType | 0);

        if (fillFn) {
            fillFn(ci, battle);
        }

        fns.ClientInputManager_addInput(mgr, ci);
        return true;
    } catch (_) {
        return false;
    }
}

export function sendMove(x, y) {
    return sendCommand(2, (ci) => {
        ci.add(offsets.ClientInput_x).writeS32(x | 0);
        ci.add(offsets.ClientInput_y).writeS32(y | 0);
    });
}

export function sendAttack(x, y, skillPtr = NULL, isHold = false) {
    return sendCommand(0, (ci) => {
        ci.add(offsets.ClientInput_x).writeS32(x | 0);
        ci.add(offsets.ClientInput_y).writeS32(y | 0);
        if (skillPtr && !skillPtr.isNull()) {
            ci.add(0x30).writePointer(skillPtr);
        }
        if (isHold) {
            ci.add(0x18).writeU8(1);
        }
    });
}

export function sendReleaseAttack(x, y, skillPtr = NULL) {
    return sendCommand(14, (ci) => {
        ci.add(offsets.ClientInput_x).writeS32(x | 0);
        ci.add(offsets.ClientInput_y).writeS32(y | 0);
        if (skillPtr && !skillPtr.isNull()) {
            ci.add(0x30).writePointer(skillPtr);
        }
    });
}

export function setBattleScreenAim(battleScreenPtr, x, y, isUlti = false) {
    if (!battleScreenPtr || battleScreenPtr.isNull()) return false;
    try {
        if (isUlti) {
            battleScreenPtr.add(offsets.BattleScreen_ultiStickX).writeS32(x | 0);
            battleScreenPtr.add(offsets.BattleScreen_ultiStickY).writeS32(y | 0);
        } else {
            battleScreenPtr.add(offsets.BattleScreen_shootStickX).writeS32(x | 0);
            battleScreenPtr.add(offsets.BattleScreen_shootStickY).writeS32(y | 0);
            battleScreenPtr.add(offsets.BattleScreen_isShootStickActive).writeU8(1);
        }
        return true;
    } catch (_) {
        return false;
    }
}

export function resetBattleScreenAim(battleScreenPtr) {
    if (!battleScreenPtr || battleScreenPtr.isNull()) return false;
    try {
        battleScreenPtr.add(offsets.BattleScreen_shootStickX).writeS32(-300);
        battleScreenPtr.add(offsets.BattleScreen_shootStickY).writeS32(-300);
        battleScreenPtr.add(offsets.BattleScreen_ultiStickX).writeS32(-300);
        battleScreenPtr.add(offsets.BattleScreen_ultiStickY).writeS32(-300);
        battleScreenPtr.add(offsets.BattleScreen_isShootStickActive).writeU8(0);
        return true;
    } catch (_) {
        return false;
    }
}