import { uiOffsets, initNativeUi, nativeUi, alloc, allocUtf8, makeScString, setXY, setScale, setMovieClipText } from "./native.js";
import { flags } from "../utils/flags.js";

var menuInitialized = false;
var bootComplete = false;
var menuOpen = false;
var menuButton = null;
var menuContainer = null;
var menuSprite = null;

const buttonCallbacks = {};
const buttonMovieClips = {};

function pulseScale(ptr, baseScale) {
    try {
        ptr.add(uiOffsets.DisplayObject_scaleX).writeFloat(baseScale * 0.88);
        ptr.add(uiOffsets.DisplayObject_scaleY).writeFloat(baseScale * 0.88);
        setTimeout(() => {
            try {
                ptr.add(uiOffsets.DisplayObject_scaleX).writeFloat(baseScale);
                ptr.add(uiOffsets.DisplayObject_scaleY).writeFloat(baseScale);
            } catch (_) {}
        }, 70);
    } catch (_) {}
}

function setButtonTextSafe(buttonPtr, text) {
    try {
        const mc = buttonMovieClips[buttonPtr.toString()];
        if (mc && !mc.isNull() && nativeUi && nativeUi.MovieClip_getFieldByName && nativeUi.TextField_setText) {
            const tf = nativeUi.MovieClip_getFieldByName(mc, allocUtf8("txt"));
            if (tf && !tf.isNull()) {
                const sc = makeScString(text);
                nativeUi.TextField_setText(tf, sc);
            }
        }
    } catch (_) {}
}

function createButton(parent, x, y, text, scale, callback, exportName) {
    try {
        const btn = alloc(2048);
        if (!btn || btn.isNull()) return null;
        nativeUi.GameButton_GameButton(btn);
        const mc = nativeUi.ResourceManager_getMovieClip(allocUtf8("sc/ui.sc"), allocUtf8(exportName || "map_editor_big_exit_button"), 1);
        if (mc && !mc.isNull() && mc.toInt32() !== -1) {
            nativeUi.CustomButton_setMovieClip(btn, mc, 1);
            nativeUi.MovieClip_gotoAndStopFrameIndex(mc, 1);
        }
        if (scale !== 1) setScale(btn, scale);
        setXY(btn, x, y);
        if (mc && !mc.isNull() && mc.toInt32() !== -1) {
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
        const mc = nativeUi.ResourceManager_getMovieClip(allocUtf8("sc/ui.sc"), allocUtf8("map_editor_big_exit_button"), 1);
        if (!mc || mc.isNull() || mc.toInt32() === -1) return null;
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
        createTextLabel(menuSprite, -100, 50, "<c87CEFA>Recoil+</c>", 1.4);

        const aimBtn = createButton(menuSprite, -120, 110, flags.aimbot ? "<c00ff66>Aimbot: ON</c>" : "<cff5050>Aimbot: OFF</c>", 0.85, () => {
            flags.aimbot = !flags.aimbot;
            const txt = flags.aimbot ? "<c00ff66>Aimbot: ON</c>" : "<cff5050>Aimbot: OFF</c>";
            setButtonTextSafe(aimBtn.ptr, txt);
            if (aimBtn.mc && !aimBtn.mc.isNull()) nativeUi.MovieClip_gotoAndStopFrameIndex(aimBtn.mc, flags.aimbot ? 2 : 1);
        });

        const killauraBtn = createButton(menuSprite, -120, 170, flags.killaura ? "<c00ff66>Killaura: ON</c>" : "<cff5050>Killaura: OFF</c>", 0.85, () => {
            flags.killaura = !flags.killaura;
            const txt = flags.killaura ? "<c00ff66>Killaura: ON</c>" : "<cff5050>Killaura: OFF</c>";
            setButtonTextSafe(killauraBtn.ptr, txt);
            if (killauraBtn.mc && !killauraBtn.mc.isNull()) nativeUi.MovieClip_gotoAndStopFrameIndex(killauraBtn.mc, flags.killaura ? 2 : 1);
        });

        const dodgeBtn = createButton(menuSprite, -120, 230, flags.autododge ? "<c00ff66>AutoDodge: ON</c>" : "<cff5050>AutoDodge: OFF</c>", 0.85, () => {
            flags.autododge = !flags.autododge;
            const txt = flags.autododge ? "<c00ff66>AutoDodge: ON</c>" : "<cff5050>AutoDodge: OFF</c>";
            setButtonTextSafe(dodgeBtn.ptr, txt);
            if (dodgeBtn.mc && !dodgeBtn.mc.isNull()) nativeUi.MovieClip_gotoAndStopFrameIndex(dodgeBtn.mc, flags.autododge ? 2 : 1);
        });

        const holdBtn = createButton(menuSprite, -120, 290, flags.holdToShoot ? "<c00ff66>HoldToShoot: ON</c>" : "<cff5050>HoldToShoot: OFF</c>", 0.85, () => {
            flags.holdToShoot = !flags.holdToShoot;
            const txt = flags.holdToShoot ? "<c00ff66>HoldToShoot: ON</c>" : "<cff5050>HoldToShoot: OFF</c>";
            setButtonTextSafe(holdBtn.ptr, txt);
            if (holdBtn.mc && !holdBtn.mc.isNull()) nativeUi.MovieClip_gotoAndStopFrameIndex(holdBtn.mc, flags.holdToShoot ? 2 : 1);
        });

        const afkBtn = createButton(menuSprite, -120, 350, flags.antiAfk ? "<c00ff66>AntiAFK: ON</c>" : "<cff5050>AntiAFK: OFF</c>", 0.85, () => {
            flags.antiAfk = !flags.antiAfk;
            const txt = flags.antiAfk ? "<c00ff66>AntiAFK: ON</c>" : "<cff5050>AntiAFK: OFF</c>";
            setButtonTextSafe(afkBtn.ptr, txt);
            if (afkBtn.mc && !afkBtn.mc.isNull()) nativeUi.MovieClip_gotoAndStopFrameIndex(afkBtn.mc, flags.antiAfk ? 2 : 1);
        });

        createButton(menuSprite, -120, 420, "Close", 0.85, () => {
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
                    if (menuButton && e.toInt32() === menuButton.toInt32()) {
                        pulseScale(menuButton, 1.0);
                        menuOpen = !menuOpen;
                        if (menuOpen) {
                            setXY(menuSprite, 500, 30);
                        } else {
                            setXY(menuSprite, -9999, -9999);
                        }
                        return;
                    }
                    const cb = buttonCallbacks[e.toString()];
                    if (cb && cb.func) {
                        pulseScale(e, cb.origScale || 1.0);
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

                if (!menuContainer || menuContainer.isNull()) {
                    try {
                        menuContainer = alloc(2048);
                        nativeUi.GameButton_GameButton(menuContainer);
                        setXY(menuContainer, 500, -30);
                        nativeUi.Stage_addChild(stagePtr, menuContainer);
                    } catch (_) {
                        menuContainer = null;
                        return;
                    }
                }

                if (!menuButton || menuButton.isNull()) {
                    try {
                        const r = nativeUi.ResourceManager_getMovieClip(allocUtf8("sc/ui.sc"), allocUtf8("map_editor_big_exit_button"), 1);
                        if (!r || r.isNull() || r.toInt32() === -1) {
                            return;
                        }
                        menuButton = alloc(2048);
                        nativeUi.GameButton_GameButton(menuButton);
                        nativeUi.CustomButton_setMovieClip(menuButton, r, 1);
                        nativeUi.MovieClip_gotoAndStopFrameIndex(r, 1);
                        setXY(menuButton, 500, 30);
                        nativeUi.Stage_addChild(stagePtr, menuButton);
                        buttonMovieClips[menuButton.toString()] = r;
                        setButtonTextSafe(menuButton, "Menu");
                    } catch (_) {
                        menuButton = null;
                        return;
                    }
                }

                if (!menuSprite || menuSprite.isNull()) {
                    try {
                        menuSprite = alloc(2048);
                        nativeUi.Sprite_Sprite(menuSprite, 1);
                        setXY(menuSprite, -9999, -9999);
                        nativeUi.Sprite_addChild(menuContainer, menuSprite);

                        buildMenuPages();

                        bootComplete = true;
                        clearInterval(bootInterval);
                    } catch (_) {
                        menuSprite = null;
                        return;
                    }
                }
            } catch (_) {}
        }, 500);
    } catch (_) {}
}
