import { offsets } from "../core/offsets.js";
import { battleState } from "../core/scan.js";
import { aimbotConfig, selectBestTarget, getAimPoint } from "./aimbot.js";
import { fireMainAttack } from "../core/commands.js";

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
        const x = battleScreenPtr.add(offsets.BattleScreen_shootStickX).readS32();
        const y = battleScreenPtr.add(offsets.BattleScreen_shootStickY).readS32();
        if (!isFinite(x) || !isFinite(y) || (x === 0 && y === 0)) return null;
        return { x: x, y: y };
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
}

export function onUpdateMovementEnter(args, now) {
    const battleScreen = args[0];
    if (!battleScreen || battleScreen.isNull()) return;
    let attackHeld = false;
    let superHeld = false;
    try {
        attackHeld = battleScreen.add(0x1041).readU8() === 1;
        superHeld = battleScreen.add(0x1042).readU8() === 1;
    } catch (_) {}
    handleMovementAndCombatAssist(battleScreen, attackHeld, superHeld, now);
}
