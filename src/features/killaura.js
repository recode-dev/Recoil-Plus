import { getFunctions } from "../core/functions.js";
import { battleState, battleScreenPtr, battleModeClientPtr, FREE_MODE } from "../core/scanner.js";
import { getCurrentAttackRange, isTargetAllowed, selectBestTarget, getAimPoint } from "./aimbot.js";
import { flags } from "../utils/flags.js";
import { combatConfig } from "../helpers/dodge_profiles.js";

// JirGear killaura booleans live in flags (killauraEnabled / killauraMainAttack /
// killauraGadget / killauraSuper / killauraNoWall / killauraNoBall);
// combatAuraRange / combatFireInterval live in combatConfig.

var lastKillauraFireMs = 0;

export function resetKillaura() {
    lastKillauraFireMs = 0;
}

export function setKillauraOptions(opts = {}) {
    if (typeof opts.mainAttack === "boolean") flags.killauraMainAttack = opts.mainAttack;
    if (typeof opts.gadget === "boolean") flags.killauraGadget = opts.gadget;
    if (typeof opts.superAttack === "boolean") flags.killauraSuper = opts.superAttack;
    if (typeof opts.noWall === "boolean") flags.killauraNoWall = opts.noWall;
    if (typeof opts.noBall === "boolean") flags.killauraNoBall = opts.noBall;
    if (typeof opts.fireInterval === "number") combatConfig.combatFireInterval = opts.fireInterval | 0;
    if (typeof opts.auraRange === "number") combatConfig.combatAuraRange = opts.auraRange | 0;
}

export function tryKillauraFire(now) {
    if (!flags.killauraEnabled || !battleScreenPtr || battleScreenPtr.isNull() ||
        (combatConfig.combatFireInterval > 0 && now - lastKillauraFireMs < combatConfig.combatFireInterval) ||
        !battleModeClientPtr || battleModeClientPtr.isNull()) return false;
    const fns = getFunctions();
    const ownChar = fns.LogicBattleModeClient_getOwnCharacter(battleModeClientPtr);
    if (!ownChar || ownChar.isNull()) return false;
    const range = getCurrentAttackRange();
    const effectiveRange = FREE_MODE ? range : Math.min(range || combatConfig.combatAuraRange, combatConfig.combatAuraRange);
    const target = selectBestTarget(effectiveRange);
    if (!target || !isTargetAllowed(target)) return false;
    const aim = getAimPoint(target);
    try {
        battleScreenPtr.add(3844).writeS32(aim.x | 0);
        battleScreenPtr.add(3848).writeS32(aim.y | 0);
        battleScreenPtr.add(3692).writeS32(aim.x | 0);
        battleScreenPtr.add(3696).writeS32(aim.y | 0);
        battleScreenPtr.add(1644).writeS32(0);
        if (flags.killauraMainAttack && fns.BattleScreen_handleAutoShoot) {
            fns.BattleScreen_handleAutoShoot(battleScreenPtr, ownChar);
        }
        lastKillauraFireMs = now;
        return true;
    } catch (_) {
        return false;
    }
}
