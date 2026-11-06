import { getFunctions } from "../core/functions.js";
import { battleState, battleScreenPtr, battleModeClientPtr, FREE_MODE } from "../core/scan.js";
import { getCurrentAttackRange, isTargetAllowed, selectBestTarget, getAimPoint } from "./aimbot.js";
import { sendAttack } from "../core/commands.js";

export const killauraConfig = {
    enabled: true,
    mainAttack: true,
    gadget: false,
    superAttack: false,
    noWall: false,
    noBall: true,
    auraRange: 4200,
    fireInterval: 1000
};

export function setKillauraOptions(opts = {}) {
    if (typeof opts.enabled === "boolean") killauraConfig.enabled = opts.enabled;
    if (typeof opts.mainAttack === "boolean") killauraConfig.mainAttack = opts.mainAttack;
    if (typeof opts.gadget === "boolean") killauraConfig.gadget = opts.gadget;
    if (typeof opts.superAttack === "boolean") killauraConfig.superAttack = opts.superAttack;
    if (typeof opts.noWall === "boolean") killauraConfig.noWall = opts.noWall;
    if (typeof opts.noBall === "boolean") killauraConfig.noBall = opts.noBall;
    if (typeof opts.auraRange === "number") killauraConfig.auraRange = opts.auraRange | 0;
    if (typeof opts.fireInterval === "number") killauraConfig.fireInterval = opts.fireInterval | 0;
}

var lastKillauraFireMs = 0;

export function resetKillaura() {
    lastKillauraFireMs = 0;
}

export function tryKillauraFire(now) {
    if (!killauraConfig.enabled || !battleScreenPtr || battleScreenPtr.isNull() || killauraConfig.fireInterval > 0 && now - lastKillauraFireMs < killauraConfig.fireInterval || !battleModeClientPtr || battleModeClientPtr.isNull()) return false;
    const fns = getFunctions();
    const ownChar = fns.LogicBattleModeClient_getOwnCharacter(battleModeClientPtr);
    if (!ownChar || ownChar.isNull()) return false;
    const range = getCurrentAttackRange();
    const effectiveRange = FREE_MODE ? range : Math.min(range || killauraConfig.auraRange, killauraConfig.auraRange);
    const target = selectBestTarget(effectiveRange);
    if (!target || !isTargetAllowed(target)) return false;
    const aim = getAimPoint(target);
    try {
        sendAttack(aim.x | 0, aim.y | 0, false);
        lastKillauraFireMs = now;
        return true;
    } catch (_) {
        return false;
    }
}
