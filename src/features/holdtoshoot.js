import { battleState } from "../core/scanner.js";
import { getFunctions } from "../core/functions.js";
import { aimbotConfig, selectBestTarget, getAimPoint } from "./aimbot.js";
import { flags } from "../utils/flags.js";

// JirGear hold-to-shoot config (holdToShootAim / holdToShootRangeCheck /
// holdToShootDelayMs); the enable flag is flags.holdToShootEnabled.
export const holdToShootConfig = {
    aim: false,
    rangeCheck: false,
    delayMs: 50
};

export function setHoldToShootOptions(opts = {}) {
    if (typeof opts.enabled === "boolean") flags.holdToShootEnabled = opts.enabled;
    if (typeof opts.aim === "boolean") holdToShootConfig.aim = opts.aim;
    if (typeof opts.rangeCheck === "boolean") holdToShootConfig.rangeCheck = opts.rangeCheck;
    if (typeof opts.delayMs === "number") holdToShootConfig.delayMs = Math.min(Math.max(opts.delayMs | 0, 0), 1000);
}

var holdAttack = false;
var holdSuper = false;
var holdAttackFireMs = 0;
var holdSuperFireMs = 0;

export function resetHoldToShoot() {
    holdAttack = false;
    holdSuper = false;
    holdAttackFireMs = 0;
    holdSuperFireMs = 0;
}

// JirGear handleMovementAndCombatAssist, exact port.
export function handleMovementAndCombatAssist(battleScreen, attackHeld, superHeld, now) {
    if (!flags.holdToShootEnabled || !battleScreen || battleScreen.isNull() || !battleState.ownCharacter || battleState.ownCharacter.isNull()) {
        holdAttack = false;
        holdSuper = false;
        return;
    }
    if (attackHeld && !holdAttack) holdAttackFireMs = now;
    if (superHeld && !holdSuper) holdSuperFireMs = now;
    holdAttack = !!attackHeld;
    holdSuper = !!superHeld;
    if (!attackHeld && !superHeld) return;

    let aim = null;
    if (holdToShootConfig.aim) {
        const target = selectBestTarget(holdToShootConfig.rangeCheck ? aimbotConfig.maxRange : 0);
        if (target) aim = getAimPoint(target);
    }
    if (!aim) {
        try {
            aim = {
                x: battleScreen.add(3844).readS32(),
                y: battleScreen.add(3848).readS32()
            };
        } catch (_) {
            aim = { x: battleState.myX, y: battleState.myY };
        }
    }
    try {
        battleScreen.add(3844).writeS32(aim.x | 0);
        battleScreen.add(3848).writeS32(aim.y | 0);
    } catch (_) {}

    const delay = Math.max(80, holdToShootConfig.delayMs | 0);
    if (attackHeld && now - holdAttackFireMs >= delay) {
        try {
            const fns = getFunctions();
            if (fns.BattleScreen_handleAutoShoot) {
                fns.BattleScreen_handleAutoShoot(battleScreen, battleState.ownCharacter);
                holdAttackFireMs = now;
            }
        } catch (_) {}
    }
    if (superHeld && now - holdSuperFireMs >= delay) {
        try {
            const fns = getFunctions();
            if (fns.BattleScreen_activateSkill) {
                const skill = fns.LogicCharacterClient_getWeaponSkillClient ? fns.LogicCharacterClient_getWeaponSkillClient(battleState.ownCharacter) : null;
                fns.BattleScreen_activateSkill(battleScreen, aim.x | 0, aim.y | 0, battleState.ownCharacter, skill, 1, 0);
                holdSuperFireMs = now;
            }
        } catch (_) {}
    }
}

export function onUpdateMovementEnter(args, now) {
    const battleScreen = args[0];
    if (!battleScreen || battleScreen.isNull()) return;
    let attackHeld = false;
    let superHeld = false;
    try {
        attackHeld = battleScreen.add(3793).readU8() === 1;
        superHeld = battleScreen.add(3794).readU8() === 1;
    } catch (_) {}
    handleMovementAndCombatAssist(battleScreen, attackHeld, superHeld, now);
}
