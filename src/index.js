import { offsets } from "./core/offsets.js";
import { initFunctions, FUNCTION_RVA } from "./core/functions.js";
import { updateBattleScan, resetBattleScan, setBattleScreenPtr } from "./core/scan.js";
import { installTileMapWatcher } from "./utils/walls.js";
import { onFireEnter, onGetClosestTargetLeave, resetAimbot, setAimbotOptions } from "./features/aimbot.js";
import { tryKillauraFire, resetKillaura, setKillauraOptions } from "./features/killaura.js";
import { onUpdateMovementEnter, resetHoldToShoot, setHoldToShootOptions } from "./features/holdtoshoot.js";
import { updateAutododge, resetAutododge, setAutododgeOptions } from "./features/autododge.js";

const MODULE_NAME = "Nulls Brawl";
const retryIntervalMs = 500;
const retryMaxAttempts = 40;

const requestBodyPtrOffset = 192;
const requestBodySizeOffset = 200;
const licensePath = "/res/license.bin";

class LicenseProvider {
    #listener = null;
    #body = JSON.stringify({ features: [], connection: "Keep-Alive" });
    #bodyBytes = null;
    #total = 0;

    setup(mod) {
        if (this.#listener) return;
        try {
            const off = offsets.LogicHttpRequest_encode;
            if (typeof off !== "number" || off <= 0) return;
            if (!mod || !mod.path) return;
            const dir = mod.path.slice(0, mod.path.lastIndexOf("/"));
            const license = File.readAllBytes(dir + licensePath);
            if (!license || license.byteLength === 0) return;
            const mallocAddr = Module.findGlobalExportByName("malloc");
            if (!mallocAddr || mallocAddr.isNull()) return;
            const malloc = new NativeFunction(mallocAddr, "pointer", ["size_t"]);
            this.#bodyBytes = license;
            this.#total = license.byteLength + this.#body.length + 1;
            this.#listener = Interceptor.attach(mod.base.add(off), {
                onEnter: (args) => {
                    try {
                        if (!args[0] || args[0].isNull()) return;
                        const buf = malloc(this.#total);
                        if (!buf || buf.isNull()) return;
                        Memory.copy(buf, this.#bodyBytes.unwrap(), this.#bodyBytes.byteLength);
                        buf.add(this.#bodyBytes.byteLength).writeUtf8String(this.#body);
                        args[0].add(requestBodyPtrOffset).writePointer(buf);
                        args[0].add(requestBodySizeOffset).writeS32(this.#total);
                    } catch (_) {}
                }
            });
            Interceptor.flush();
        } catch (_) {
            this.#listener = null;
        }
    }
}

const licenseProvider = new LicenseProvider();

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
    initFunctions(mod.base);
    try {
        licenseProvider.setup(mod);
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

    Interceptor.attach(mod.base.add(FUNCTION_RVA.BattleScreen_fire), {
        onEnter(args) {
            try {
                onFireEnter(args);
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
    }
};

startAgent();
