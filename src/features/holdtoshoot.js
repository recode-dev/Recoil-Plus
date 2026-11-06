import { offsets } from "../core/offsets.js";
import { battleState } from "../core/scan.js";
import { aimbotConfig, selectBestTarget, getAimPoint } from "./aimbot.js";
import { fireMainAttack, sendSkillInput } from "../core/commands.js";

export const holdToShootConfig = {
    enabled: true,
    aim: false,
    rangeCheck: false,
    delayMs: 50
};

export function setHoldToShootOptions(opts = {}) {
    if (typeof opts.enabled === "boolean") holdToShootConfig.enabled = opts.enabled;
    if (typeof opts.aim === "boolean") holdToShootConfig.aim = opts.aim;
    if (typeof opts.rangeCheck === "boolean") holdToShootConfig.rangeCheck = opts.rangeCheck;
    if (typeof opts.delayMs === "number") holdToShootConfig.delayMs = Math.min(Math.max(opts.delayMs | 0, 0), 1000);
}

var prevAttackHeld = false;
var prevSuperHeld = false;
var lastAttackFireMs = 0;
var lastSuperFireMs = 0;

export function resetHoldToShoot() {
    prevAttackHeld = false;
    prevSuperHeld = false;
    lastAttackFireMs = 0;
    lastSuperFireMs = 0;
}

function readAimPoint() {
    try {
        if (!battleScreenPtr || battleScreenPtr.isNull()) return null;
        const dx = battleScreenPtr.add(offsets.BattleScreen_shootStickX).readS32();
        const dy = battleScreenPtr.add(offsets.BattleScreen_shootStickY).readS32();
        if (!isFinite(dx) || !isFinite(dy)) return null;
        return { x: (battleState.myX + dx) | 0, y: (battleState.myY + dy) | 0 };
    } catch (_) {
        return null;
    }
}

export function handleMovementAndCombatAssist(battleScreen, attackHeld, superHeld, now) {
    if (!holdToShootConfig.enabled || !battleScreen || battleScreen.isNull() || !battleState.ownCharacter || battleState.ownCharacter.isNull()) {
        prevAttackHeld = false;
        prevSuperHeld = false;
        return;
    }
    if (attackHeld && !prevAttackHeld) lastAttackFireMs = now;
    if (superHeld && !prevSuperHeld) lastSuperFireMs = now;
    prevAttackHeld = !!attackHeld;
    prevSuperHeld = !!superHeld;
    if (!attackHeld && !superHeld) return;
    let aim = null;
    if (holdToShootConfig.aim) {
        const target = selectBestTarget(holdToShootConfig.rangeCheck ? aimbotConfig.maxRange : 0);
        if (target) aim = getAimPoint(target);
    }
    if (!aim) {
        aim = readAimPoint();
    }
    if (!aim) {
        aim = { x: battleState.myX, y: battleState.myY };
    }
    const delay = Math.max(80, holdToShootConfig.delayMs | 0);
    if (attackHeld && now - lastAttackFireMs >= delay) {
        fireMainAttack(battleScreen, battleState.ownCharacter, aim.x, aim.y, true);
        lastAttackFireMs = now;
    }
    if (superHeld && now - lastSuperFireMs >= delay) {
        sendSkillInput(aim.x | 0, aim.y | 0);
        lastSuperFireMs = now;
    }
}

export function onUpdateMovementEnter(args, now) {
    const battleScreen = args[0];
    if (!battleScreen || battleScreen.isNull()) return;
    let attackHeld = false;
    let superHeld = false;
    try {
        attackHeld = battleScreen.add(offsets.BattleScreen_attackButtonHeld).readU8() === 1;
        superHeld = battleScreen.add(offsets.BattleScreen_superButtonHeld).readU8() === 1;
    } catch (_) {}
    handleMovementAndCombatAssist(battleScreen, attackHeld, superHeld, now);
}
