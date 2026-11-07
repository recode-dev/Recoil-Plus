import { uiOffsets, initNativeUi, nativeUi, alloc, allocUtf8, setXY, setScale, setMovieClipText } from "./native.js";
import { flags } from "../utils/flags.js";

var menuInitialized = false;
var menuOpen = false;
var menuButtonPtr = null;
var menuContainerPtr = null;
var menuSpritePtr = null;
const buttonCallbacks = new Map();

function pulseScale(ptr, baseScale) {
    try {
        setScale(ptr, baseScale * 0.9);
        setTimeout(() => {
            try {
                setScale(ptr, baseScale);
            } catch (_) {}
        }, 80);
    } catch (_) {}
}

function createButton(parent, x, y, text, scale, callback, exportName) {
    try {
        const btn = alloc(2048);
        if (!btn || btn.isNull()) return null;
        nativeUi.GameButton_GameButton(btn);
        const mc = nativeUi.ResourceManager_getMovieClip(allocUtf8("sc/ui.sc"), allocUtf8(exportName || "map_editor_big_exit_button"), 1);
        if (mc && !mc.isNull()) {
            nativeUi.CustomButton_setMovieClip(btn, mc, 1);
            nativeUi.MovieClip_gotoAndStopFrameIndex(mc, 1);
        }
        if (scale !== 1) setScale(btn, scale);
        setXY(btn, x, y);
        if (text) setMovieClipText(mc, text);
        if (callback) {
            buttonCallbacks.set(btn.toString(), { func: callback, scale: scale, mc: mc });
        }
        nativeUi.Sprite_addChild(parent, btn);
        return { ptr: btn, mc: mc };
    } catch (_) {
        return null;
    }
}

function createTextLabel(parent, x, y, text, scale) {
    try {
        const mc = nativeUi.ResourceManager_getMovieClip(allocUtf8("sc/ui.sc"), allocUtf8("map_editor_big_exit_button"), 1);
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

function onButtonClicked(btn) {
    try {
        if (!btn || btn.isNull()) return;
        if (menuButtonPtr && !menuButtonPtr.isNull() && btn.toInt32() === menuButtonPtr.toInt32()) {
            menuOpen = !menuOpen;
            pulseScale(menuButtonPtr, 1.0);
            if (menuOpen) {
                setXY(menuSpritePtr, 500, 30);
            } else {
                setXY(menuSpritePtr, -9999, -9999);
            }
            return;
        }
        const entry = buttonCallbacks.get(btn.toString());
        if (entry && entry.func) {
            pulseScale(btn, entry.scale || 1.0);
            entry.func();
        }
    } catch (_) {}
}

function buildMenu(stagePtr) {
    try {
        menuContainerPtr = alloc(2048);
        if (!menuContainerPtr || menuContainerPtr.isNull()) return;
        nativeUi.GameButton_GameButton(menuContainerPtr);
        setXY(menuContainerPtr, 500, -30);
        nativeUi.Stage_addChild(stagePtr, menuContainerPtr);

        menuButtonPtr = alloc(2048);
        if (!menuButtonPtr || menuButtonPtr.isNull()) return;
        nativeUi.GameButton_GameButton(menuButtonPtr);
        const btnMc = nativeUi.ResourceManager_getMovieClip(allocUtf8("sc/ui.sc"), allocUtf8("map_editor_big_exit_button"), 1);
        if (btnMc && !btnMc.isNull()) {
            nativeUi.CustomButton_setMovieClip(menuButtonPtr, btnMc, 1);
            nativeUi.MovieClip_gotoAndStopFrameIndex(btnMc, 1);
        }
        setXY(menuButtonPtr, 500, 30);
        nativeUi.Stage_addChild(stagePtr, menuButtonPtr);
        setMovieClipText(btnMc, "Menu");

        menuSpritePtr = alloc(2048);
        if (!menuSpritePtr || menuSpritePtr.isNull()) return;
        nativeUi.Sprite_Sprite(menuSpritePtr, 1);
        setXY(menuSpritePtr, -9999, -9999);
        nativeUi.Sprite_addChild(menuContainerPtr, menuSpritePtr);

        createTextLabel(menuSpritePtr, -100, 50, "<c87CEFA>Recoil+</c>", 1.4);

        const aimBtn = createButton(menuSpritePtr, -120, 110, flags.aimbot ? "<c00ff66>Aimbot: ON</c>" : "<cff5050>Aimbot: OFF</c>", 0.85, () => {
            flags.aimbot = !flags.aimbot;
            setMovieClipText(aimBtn.mc, flags.aimbot ? "<c00ff66>Aimbot: ON</c>" : "<cff5050>Aimbot: OFF</c>");
            nativeUi.MovieClip_gotoAndStopFrameIndex(aimBtn.mc, flags.aimbot ? 2 : 1);
        });

        const killauraBtn = createButton(menuSpritePtr, -120, 170, flags.killaura ? "<c00ff66>Killaura: ON</c>" : "<cff5050>Killaura: OFF</c>", 0.85, () => {
            flags.killaura = !flags.killaura;
            setMovieClipText(killauraBtn.mc, flags.killaura ? "<c00ff66>Killaura: ON</c>" : "<cff5050>Killaura: OFF</c>");
            nativeUi.MovieClip_gotoAndStopFrameIndex(killauraBtn.mc, flags.killaura ? 2 : 1);
        });

        const dodgeBtn = createButton(menuSpritePtr, -120, 230, flags.autododge ? "<c00ff66>AutoDodge: ON</c>" : "<cff5050>AutoDodge: OFF</c>", 0.85, () => {
            flags.autododge = !flags.autododge;
            setMovieClipText(dodgeBtn.mc, flags.autododge ? "<c00ff66>AutoDodge: ON</c>" : "<cff5050>AutoDodge: OFF</c>");
            nativeUi.MovieClip_gotoAndStopFrameIndex(dodgeBtn.mc, flags.autododge ? 2 : 1);
        });

        const holdBtn = createButton(menuSpritePtr, -120, 290, flags.holdToShoot ? "<c00ff66>HoldToShoot: ON</c>" : "<cff5050>HoldToShoot: OFF</c>", 0.85, () => {
            flags.holdToShoot = !flags.holdToShoot;
            setMovieClipText(holdBtn.mc, flags.holdToShoot ? "<c00ff66>HoldToShoot: ON</c>" : "<cff5050>HoldToShoot: OFF</c>");
            nativeUi.MovieClip_gotoAndStopFrameIndex(holdBtn.mc, flags.holdToShoot ? 2 : 1);
        });

        const afkBtn = createButton(menuSpritePtr, -120, 350, flags.antiAfk ? "<c00ff66>AntiAFK: ON</c>" : "<cff5050>AntiAFK: OFF</c>", 0.85, () => {
            flags.antiAfk = !flags.antiAfk;
            setMovieClipText(afkBtn.mc, flags.antiAfk ? "<c00ff66>AntiAFK: ON</c>" : "<cff5050>AntiAFK: OFF</c>");
            nativeUi.MovieClip_gotoAndStopFrameIndex(afkBtn.mc, flags.antiAfk ? 2 : 1);
        });

        createButton(menuSpritePtr, -120, 420, "Close", 0.85, () => {
            menuOpen = false;
            setXY(menuSpritePtr, -9999, -9999);
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
                    const btn = args[0];
                    if (btn && !btn.isNull()) onButtonClicked(btn);
                } catch (_) {}
            }
        });

        const stageGlobal = mod.base.add(uiOffsets.Stage_sm_pInstance);
        const bootTimer = setInterval(() => {
            try {
                const stagePtr = stageGlobal.readPointer();
                if (stagePtr && !stagePtr.isNull()) {
                    clearInterval(bootTimer);
                    buildMenu(stagePtr);
                }
            } catch (_) {}
        }, 500);
    } catch (_) {}
}
