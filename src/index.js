import { offsets } from "./core/offsets.js";
import { initFunctions } from "./core/functions.js";
import { updateBattleScan, resetBattleScan, setBattleScreenPtr } from "./core/scan.js";
import { installTileMapWatcher } from "./utils/walls.js";
import { setupLicense } from "./utils/license.js";
import { onFireEnter, onActivateSkillEnter, onGetClosestTargetLeave, resetAimbot, setAimbotOptions } from "./features/aimbot.js";
import { tryKillauraFire, resetKillaura, setKillauraOptions } from "./features/killaura.js";
import { onUpdateMovementEnter, resetHoldToShoot, setHoldToShootOptions } from "./features/holdtoshoot.js";
import { updateAutododge, resetAutododge, setAutododgeOptions } from "./features/autododge.js";
import { flags } from "./flags.js";

export { flags };

const MODULE_NAME = "Nulls Brawl";
const retryIntervalMs = 500;
const retryMaxAttempts = 40;

var lastBattle = null;

function onBattleUpdate(bm) {
    if (!lastBattle || !lastBattle.equals(bm)) {
        lastBattle = bm;
        resetBattleScan();
        resetKillaura();
        resetHoldToShoot();
        resetAutododge();
        resetAimbot();
    }
    const now = Date.now();
    try {
        updateBattleScan(bm, now);
    } catch (_) {}
    try {
        updateAutododge(bm, now);
    } catch (_) {}
    try {
        tryKillauraFire(now);
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
                    try {
                        const now = Date.now();
                        onUpdateMovementEnter(args, now);
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

rpc.exports = {
    start() {
        return startAgent();
    },
    setAimbot(opts) {
        setAimbotOptions(opts || {});
    },
    setKillaura(opts) {
        setKillauraOptions(opts || {});
    },
    setHoldToShoot(opts) {
        setHoldToShootOptions(opts || {});
    },
    setAutododge(opts) {
        setAutododgeOptions(opts || {});
    },
    getFlags() {
        return flags;
    },
    setFlags(opts) {
        if (opts && typeof opts === "object") {
            Object.assign(flags, opts);
        }
    }
};

startAgent();
