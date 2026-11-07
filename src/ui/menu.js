import { uiOffsets, initNativeUi, nativeUi, alloc, allocUtf8, makeScString, setXY, setScale, setMovieClipText } from "./native.js";
import { flags } from "../utils/flags.js";

var menuInitialized = false;
var bootComplete = false;
var menuOpen = false;
var modMenuButton = null;
var menuSprite = null;

const buttonCallbacks = {};
const buttonMovieClips = {};

function pulseScale(ptr, baseScale) {
    try {
        setScale(ptr, baseScale * 0.88);
        setTimeout(() => {
            try {
                setScale(ptr, baseScale);
            } catch (_) {}
        }, 70);
    } catch (_) {}
}

function getMovieClip(name) {
    try {
        const mc = nativeUi.ResourceManager_getMovieClip(allocUtf8("sc/ui.sc"), allocUtf8(name), 1);
        if (mc && !mc.isNull() && mc.toInt32() !== -1) return mc;
    } catch (_) {}
    return null;
}

function getButtonMovieClip() {
    return getMovieClip("map_editor_exit_button") || getMovieClip("map_editor_big_exit_button");
}

function addToStage(stagePtr, itemPtr) {
    try {
        const guiLayer = stagePtr.add(6944).readPointer();
        if (guiLayer && !guiLayer.isNull()) {
            nativeUi.Sprite_addChild(guiLayer, itemPtr);
            return true;
        }
    } catch (_) {}
    try {
        nativeUi.Stage_addChild(stagePtr, itemPtr);
        return true;
    } catch (_) {}
    return false;
}

function setButtonTextSafe(buttonPtr, text) {
    try {
        const mc = buttonMovieClips[buttonPtr.toString()];
        if (mc && !mc.isNull()) {
            setMovieClipText(mc, text);
        }
    } catch (_) {}
}

function createButton(parent, x, y, text, scale, callback) {
    try {
        const btn = alloc(544);
        if (!btn || btn.isNull()) return null;
        nativeUi.GameButton_GameButton(btn);
        const mc = getButtonMovieClip();
        if (mc && !mc.isNull()) {
            nativeUi.CustomButton_setMovieClip(btn, mc, 1);
            nativeUi.MovieClip_gotoAndStopFrameIndex(mc, 1);
        }
        if (scale !== 1) setScale(btn, scale);
        setXY(btn, x, y);
        if (mc && !mc.isNull()) {
            buttonMovieClips[btn.toString()] = mc;
            if (text) setMovieClipText(mc, text);
        }
        if (callback) {
            buttonCallbacks[btn.toString()] = { func: callback, origScale: scale, mc: mc, ptr: btn };
        }
        nativeUi.Sprite_addChild(parent, btn);
        return { ptr: btn, mc: mc };
    } catch (_) {
        return null;
    }
}

function createTextLabel(parent, x, y, text, scale) {
    try {
        const mc = getButtonMovieClip();
        if (!mc || mc.isNull()) return null;
        const tf = nativeUi.MovieClip_getFieldByName(mc, allocUtf8("txt"));
        if (!tf || tf.isNull()) return null;
        if (scale !== 1) setScale(tf, scale);
        setMovieClipText(mc, text);
        setXY(tf, x, y);
        nativeUi.Sprite_addChild(parent, tf);
        return { ptr: tf, mc: mc };
    } catch (_) {
        return null;
    }
}

function buildMenuPages() {
    try {
        createTextLabel(menuSprite, 0, 0, "<c87CEFA>Recoil+</c>", 1.3);

        const aimBtn = createButton(menuSprite, 0, 45, flags.aimbot ? "<c00ff66>Aimbot: ON</c>" : "<cff5050>Aimbot: OFF</c>", 0.8, () => {
            flags.aimbot = !flags.aimbot;
            const txt = flags.aimbot ? "<c00ff66>Aimbot: ON</c>" : "<cff5050>Aimbot: OFF</c>";
            setButtonTextSafe(aimBtn.ptr, txt);
            if (aimBtn.mc && !aimBtn.mc.isNull()) nativeUi.MovieClip_gotoAndStopFrameIndex(aimBtn.mc, flags.aimbot ? 2 : 1);
        });

        const killauraBtn = createButton(menuSprite, 0, 95, flags.killaura ? "<c00ff66>Killaura: ON</c>" : "<cff5050>Killaura: OFF</c>", 0.8, () => {
            flags.killaura = !flags.killaura;
            const txt = flags.killaura ? "<c00ff66>Killaura: ON</c>" : "<cff5050>Killaura: OFF</c>";
            setButtonTextSafe(killauraBtn.ptr, txt);
            if (killauraBtn.mc && !killauraBtn.mc.isNull()) nativeUi.MovieClip_gotoAndStopFrameIndex(killauraBtn.mc, flags.killaura ? 2 : 1);
        });

        const dodgeBtn = createButton(menuSprite, 0, 145, flags.autododge ? "<c00ff66>AutoDodge: ON</c>" : "<cff5050>AutoDodge: OFF</c>", 0.8, () => {
            flags.autododge = !flags.autododge;
            const txt = flags.autododge ? "<c00ff66>AutoDodge: ON</c>" : "<cff5050>AutoDodge: OFF</c>";
            setButtonTextSafe(dodgeBtn.ptr, txt);
            if (dodgeBtn.mc && !dodgeBtn.mc.isNull()) nativeUi.MovieClip_gotoAndStopFrameIndex(dodgeBtn.mc, flags.autododge ? 2 : 1);
        });

        const holdBtn = createButton(menuSprite, 0, 195, flags.holdToShoot ? "<c00ff66>HoldToShoot: ON</c>" : "<cff5050>HoldToShoot: OFF</c>", 0.8, () => {
            flags.holdToShoot = !flags.holdToShoot;
            const txt = flags.holdToShoot ? "<c00ff66>HoldToShoot: ON</c>" : "<cff5050>HoldToShoot: OFF</c>";
            setButtonTextSafe(holdBtn.ptr, txt);
            if (holdBtn.mc && !holdBtn.mc.isNull()) nativeUi.MovieClip_gotoAndStopFrameIndex(holdBtn.mc, flags.holdToShoot ? 2 : 1);
        });

        const afkBtn = createButton(menuSprite, 0, 245, flags.antiAfk ? "<c00ff66>AntiAFK: ON</c>" : "<cff5050>AntiAFK: OFF</c>", 0.8, () => {
            flags.antiAfk = !flags.antiAfk;
            const txt = flags.antiAfk ? "<c00ff66>AntiAFK: ON</c>" : "<cff5050>AntiAFK: OFF</c>";
            setButtonTextSafe(afkBtn.ptr, txt);
            if (afkBtn.mc && !afkBtn.mc.isNull()) nativeUi.MovieClip_gotoAndStopFrameIndex(afkBtn.mc, flags.antiAfk ? 2 : 1);
        });

        createButton(menuSprite, 0, 305, "Close", 0.8, () => {
            menuOpen = false;
            setXY(menuSprite, -9999, -9999);
        });
    } catch (_) {}
}

export function initMenu(mod) {
    if (menuInitialized) return;
    menuInitialized = true;
    try {
        initNativeUi(mod.base);

        Interceptor.attach(mod.base.add(uiOffsets.CustomButton_buttonPressed), {
            onEnter(args) {
                try {
                    const e = args[0];
                    if (!e || e.isNull()) return;
                    if (modMenuButton && e.toInt32() === modMenuButton.toInt32()) {
                        pulseScale(modMenuButton, 0.85);
                        menuOpen = !menuOpen;
                        if (menuOpen) {
                            setXY(menuSprite, 160, 60);
                        } else {
                            setXY(menuSprite, -9999, -9999);
                        }
                        return;
                    }
                    const cb = buttonCallbacks[e.toString()];
                    if (cb && cb.func) {
                        pulseScale(e, cb.origScale || 0.8);
                        cb.func(e);
                    }
                } catch (_) {}
            }
        });

        const stageGlobal = mod.base.add(uiOffsets.Stage_sm_pInstance);
        const bootInterval = setInterval(() => {
            if (bootComplete) {
                clearInterval(bootInterval);
                return;
            }
            try {
                const stagePtr = stageGlobal.readPointer();
                if (!stagePtr || stagePtr.isNull()) return;

                const btnMc = getButtonMovieClip();
                if (!btnMc || btnMc.isNull()) return;

                if (!modMenuButton || modMenuButton.isNull()) {
                    modMenuButton = alloc(544);
                    if (!modMenuButton || modMenuButton.isNull()) return;
                    nativeUi.GameButton_GameButton(modMenuButton);
                    nativeUi.CustomButton_setMovieClip(modMenuButton, btnMc, 1);
                    nativeUi.MovieClip_gotoAndStopFrameIndex(btnMc, 1);
                    setScale(modMenuButton, 0.85);
                    setXY(modMenuButton, 50, 50);
                    buttonMovieClips[modMenuButton.toString()] = btnMc;
                    setMovieClipText(btnMc, "MENU");
                    addToStage(stagePtr, modMenuButton);
                }

                if (!menuSprite || menuSprite.isNull()) {
                    menuSprite = alloc(544);
                    if (!menuSprite || menuSprite.isNull()) return;
                    nativeUi.Sprite_Sprite(menuSprite, 1);
                    setXY(menuSprite, -9999, -9999);
                    addToStage(stagePtr, menuSprite);

                    buildMenuPages();

                    bootComplete = true;
                    clearInterval(bootInterval);
                }
            } catch (_) {}
        }, 300);
    } catch (_) {}
}
