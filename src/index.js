import { offsets } from "./core/offsets.js";
import { initFunctions } from "./core/functions.js";
import { updateBattleScan, resetBattleScan, setBattleScreenPtr, battleModeClientPtr } from "./core/scanner.js";
import { battleTickUpdate, resetBattleTick, moveToPoint } from "./core/commands.js";
import { installTileMapWatcher } from "./utils/wallCache.js";
import { setupLicense } from "./utils/license.js";
import { onFireEnter, onActivateSkillEnter, onGetClosestTargetLeave, resetAimbot, ballAssist } from "./features/aimbot.js";
import { tryKillauraFire, resetKillaura } from "./features/killaura.js";
import { onUpdateMovementEnter, resetHoldToShoot } from "./features/holdtoshoot.js";
import { updateAutododge, resetAutododge } from "./features/autododge.js";
import { applySpinMovement, collectEnemiesAndPickups, getFollowTargetPoint, resetAntiAfk } from "./features/antiafk.js";
import { flags } from "./utils/flags.js";
import { initMenu } from "./ui/menu.js";

export { flags };

const MODULE_NAME = "Nulls Brawl";
const retryIntervalMs = 500;
const retryMaxAttempts = 40;

// JirGear references checkBattleExit on a 1s interval; in the source it is
// undefined (the ReferenceError is swallowed), i.e. a no-op. Ported as no-op.
function checkBattleExit() {}

// JirGear battle pipeline (LogicBattleModeClient_update onEnter), exact order:
// battleTickUpdate -> scan -> tryHoldToShoot(dodge) -> spin -> follow -> killaura -> ballAssist -> ESP(dormant).
function onBattleUpdate(bm) {
    const now = Date.now();
    try {
        battleTickUpdate(now);
    } catch (_) {}
    try {
        updateBattleScan(bm, now);
    } catch (_) {}
    let dodgeRan = false;
    try {
        dodgeRan = updateAutododge(bm, now);
    } catch (_) {}
    let spinRan = false;
    try {
        spinRan = !dodgeRan && applySpinMovement(bm);
    } catch (_) {}
    try {
        if (!dodgeRan && !spinRan) collectEnemiesAndPickups(bm);
    } catch (_) {}
    try {
        tryKillauraFire(now);
    } catch (_) {}
    try {
        ballAssist(bm);
    } catch (_) {}
}

function findModule() {
    try {
        return Process.getModuleByName(MODULE_NAME);
    } catch (_) {
        return null;
    }
}

var _installed = false;
var _attempts = 0;
var _retryTimer = null;

function finishInstall(mod) {
    initFunctions(mod.base, mod);
    try {
        setupLicense();
    } catch (_) {}
    installTileMapWatcher(mod.base);

    // JirGear order: config load + button hook + boot start BEFORE battle hooks.
    try {
        initMenu(mod);
    } catch (_) {}

    Interceptor.attach(mod.base.add(offsets.LogicBattleModeClient_update), {
        onEnter(args) {
            try {
                const bm = args[0];
                if (!bm || bm.isNull()) return;
                onBattleUpdate(bm);
            } catch (_) {}
        }
    });

    Interceptor.attach(mod.base.add(offsets.BattleScreen_updateMovement), {
        onEnter(args) {
            try {
                const bs = args[0];
                if (bs && !bs.isNull()) {
                    setBattleScreenPtr(bs);
                    const now = Date.now();
                    try {
                        onUpdateMovementEnter(args, now);
                    } catch (_) {}
                    try {
                        if (flags.followEnabled && !flags.spinEnabled && !flags.autododgeEnabled) {
                            const bm = battleModeClientPtr;
                            if (bm && !bm.isNull()) {
                                const p = getFollowTargetPoint();
                                if (p) moveToPoint(bm, p.x, p.y);
                            }
                        }
                    } catch (_) {}
                    try {
                        tryKillauraFire(now);
                    } catch (_) {}
                }
            } catch (_) {}
        }
    });

    Interceptor.attach(mod.base.add(offsets.BattleScreen_updateAutoshoot), {
        onEnter(args) {
            try {
                const bs = args[0];
                if (bs && !bs.isNull()) {
                    setBattleScreenPtr(bs);
                    tryKillauraFire(Date.now());
                }
            } catch (_) {}
        }
    });

    Interceptor.attach(mod.base.add(offsets.BattleScreen_handleAutoShoot), {
        onEnter(args) {
            try {
                const bs = args[0];
                if (bs && !bs.isNull()) {
                    setBattleScreenPtr(bs);
                    onFireEnter(args);
                }
            } catch (_) {}
        }
    });

    Interceptor.attach(mod.base.add(offsets.BattleScreen_tryToActivateSkill), {
        onEnter(args) {
            try {
                const bs = args[0];
                if (bs && !bs.isNull()) {
                    setBattleScreenPtr(bs);
                    onFireEnter(args);
                }
            } catch (_) {}
        }
    });

    Interceptor.attach(mod.base.add(offsets.BattleScreen_activateSkill), {
        onEnter(args) {
            try {
                const bs = args[0];
                if (bs && !bs.isNull()) {
                    setBattleScreenPtr(bs);
                    onActivateSkillEnter(args);
                }
            } catch (_) {}
        }
    });

    Interceptor.attach(mod.base.add(offsets.BattleScreen_getClosestTargetForAutoshoot), {
        onLeave(retval) {
            try {
                const replaced = onGetClosestTargetLeave(retval);
                if (replaced && !replaced.equals(retval)) retval.replace(replaced);
            } catch (_) {}
        }
    });

    setInterval(checkBattleExit, 1000);

    _installed = true;
    return true;
}

function scheduleRetry() {
    if (_retryTimer !== null) return;
    _retryTimer = setTimeout(() => {
        _retryTimer = null;
        if (_installed || _attempts >= retryMaxAttempts) return;
        _attempts++;
        const mod = findModule();
        if (mod) finishInstall(mod);
        else scheduleRetry();
    }, retryIntervalMs);
}

export function startAgent() {
    if (_installed) return true;
    const mod = findModule();
    if (mod) return finishInstall(mod);
    scheduleRetry();
    return false;
}

export function resetBattle() {
    resetBattleScan();
    resetKillaura();
    resetHoldToShoot();
    resetAutododge();
    resetAimbot();
    resetAntiAfk();
    resetBattleTick();
}

startAgent();
