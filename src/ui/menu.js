import { uiOffsets, initNativeUi, nativeUi, alloc, allocUtf8, makeScString, setXY, setScale, setMovieClipText } from "./native.js";
import { flags } from "../utils/flags.js";
import { DODGE_CFG, combatConfig } from "../helpers/dodge_profiles.js";
import { dodgeDirections, rebuildDodgeDirections } from "../helpers/dodge-planner.js";
import { aimbotConfig, ballAssistConfig, setXraySelected } from "../features/aimbot.js";
import { followConfig, spinConfig } from "../features/antiafk.js";
import { holdToShootConfig } from "../features/holdtoshoot.js";
import { battleTickConfig } from "../core/commands.js";
import { battleState, xraySelectedGid } from "../core/scanner.js";
import { getThreatCount } from "../features/autododge.js";

// JirGear menu port: 16 pages (R C K D B T U V O X S H A M E F),
// config persisted to localStorage under the JirGear key with JirGear field names.
const CONFIG_STORAGE_KEY = "JirGearPlus_cfg_v1";
const FREE_MODE = true;
const MOD_VERSION = "15";

export const cameraConfig = {
    mode: 3,
    zoom: 1,
    offsetX: 0,
    offsetY: 0
};

export const espConfig = {
    scale: 1,
    lineWidth: 2,
    showNames: true,
    showDistance: true,
    showTracer: true,
    showHitbox: true,
    showCircle: true,
    showAimLine: false,
    tracerColor: [1, 1, 0.15, 0.85],
    hitboxColor: [1, 0.2, 0.2, 0.9],
    circleColor: [0.2, 0.9, 0.95, 0.55],
    enemyRangeColor: [0, 0, 0, 0.6],
    aimLineColor: [1, 1, 0.15, 0.95],
    teamFilterEnemies: true,
    teamFilterSelf: true,
    teamFilterTeammates: false
};

export const shaderConfig = {
    offX: 0,
    offY: 0,
    bias: 0,
    contrast: 1,
    lift: 0,
    strongDark: 0.75,
    softDark: 0.85,
    night: 0,
    diffuse: [0.55, 0.62, 0.92],
    specular: [0.35, 0.42, 0.7],
    outline: 1,
    rtx: 0,
    charContrast: 1,
    charSaturation: 1,
    outlineColor: [1, 1, 1],
    charTint: [1, 1, 1],
    charBrightness: 1
};

var debugTextScale = 1;

var menuInitialized = false;
var bootComplete = false;
var menuOpen = false;
var menuPagesBuilt = false;
var currentPage = "R";
var modMenuButton = null;
var menuSprite = null;
var menuContainer = null;
var titleLabel = null;
var subtitleLabel = null;
var killauraShortcutButton = null;
var autododgeShortcutButton = null;
var followButton = null;
var followTargetButton = null;
var spinToggleButton = null;
var spinRotationButton = null;
var spinSpeedLabel = null;
var spinRadiusLabel = null;
var debugTextField = null;
var debugTitleLabel = null;
var cornerStatusLabel = null;
var rainbowOffset = 0;
var rainbowStep = 0;

const buttonCallbacks = {};
const buttonMovieClips = {};

const rootPageItems = [];
const battlePageItems = [];
const killauraPageItems = [];
const autododgePageItems = [];
const ballAssistPageItems = [];
const holdToShootPageItems = [];
const utilityPageItems = [];
const visualPageItems = [];
const otherPageItems = [];
const xrayPageItems = [];
const spinPageItems = [];
const shaderPageItems = [];
const aimPageItems = [];
const cameraPageItems = [];
const espPageItems = [];
const followPageItems = [];

const killauraControls = {};
const autododgeControls = {};
const ballAssistControls = {};
const holdToShootControls = {};
const utilityControls = {};
const aimPageControls = {};
const spinPageControls = {};
const shaderEditorControls = {};
const cameraControls = {};
const espControls = {};
const followControls = {};
const xrayEnemyRows = [];

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

function fmt2(t) {
    return Number(t).toFixed(2);
}

function clamp(t, e, n) {
    return Math.max(e, Math.min(n, t));
}

function hasSameVtable(t, e) {
    try {
        return !t || t.isNull() || e === null ? false : t.readPointer().equals(e);
    } catch (_) {
        return false;
    }
}

function getMovieClip(name) {
    try {
        const mc = nativeUi.ResourceManager_getMovieClip(allocUtf8("sc/ui.sc"), allocUtf8(name), 1);
        if (mc && !mc.isNull() && mc.toInt32() !== -1) return mc;
    } catch (_) {}
    return null;
}

function getButtonMovieClip(name) {
    return getMovieClip(name) || getMovieClip("map_editor_big_exit_button") || getMovieClip("map_editor_exit_button");
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

function setLabelTextSafe(labelObj, text) {
    try {
        if (!labelObj || !labelObj.ptr || labelObj.ptr.isNull()) return;
        setMovieClipText(labelObj.mc, text);
    } catch (_) {}
}

function createButton(parent, x, y, text, scale, pageItems, callback, clipName) {
    try {
        const btn = alloc(544);
        if (!btn || btn.isNull()) return null;
        nativeUi.GameButton_GameButton(btn);
        const mc = getButtonMovieClip(clipName);
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
        if (pageItems) pageItems.push({ ptr: btn, x: x, y: y });
        return btn;
    } catch (_) {
        return null;
    }
}

function createTextLabel(parent, x, y, text, scale, pageItems) {
    try {
        const mc = getButtonMovieClip();
        if (!mc || mc.isNull()) return null;
        const tf = nativeUi.MovieClip_getFieldByName(mc, allocUtf8("txt"));
        if (!tf || tf.isNull()) return null;
        if (scale !== 1) setScale(tf, scale);
        setMovieClipText(mc, text);
        setXY(tf, x, y);
        nativeUi.Sprite_addChild(parent, tf);
        const item = { ptr: tf, mc: mc, x: x, y: y };
        if (pageItems) pageItems.push(item);
        return item;
    } catch (_) {
        return null;
    }
}

function createSlider(parent, x, y, label, scale, pageItems, getter, setter, min, max, step, fmt) {
    const labelEl = createTextLabel(parent, x - 80, y - 36, "", 0.66, pageItems);
    const ptr = createButton(parent, x, y, "", scale, pageItems, () => {
        try {
            let v = Number(getter()) + step;
            if (v > max) v = min;
            setter(v);
            refreshAutododgePage();
            refreshHoldToShootPage();
        } catch (_) {}
    });
    return {
        ptr: ptr,
        label: label,
        labelEl: labelEl,
        getValue: getter,
        min: min,
        max: max,
        fmt: fmt || (m => String(m | 0))
    };
}

function refreshSliderLabel(slider) {
    try {
        if (!slider || !slider.ptr) return;
        const v = Number(slider.getValue());
        const n = Math.max(1, slider.max - slider.min);
        const o = clamp((v - slider.min) / n, 0, 1);
        const i = Math.max(0, Math.min(10, Math.round(o * 10)));
        let bar = "";
        for (let a = 0; a < 10; a++) bar += a < i ? "=" : "-";
        setLabelTextSafe(slider.labelEl, `<cffffff>${slider.label}: ${slider.fmt(v)}</c>`);
        setButtonTextSafe(slider.ptr, `<cffffff>${slider.label} ${slider.fmt(v)}</c>\n<c87CEFA>[${bar}]</c>`);
    } catch (_) {}
}

function setSwitchFrame(btn, on) {
    try {
        if (!btn || btn.isNull()) return;
        const mc = buttonMovieClips[btn.toString()];
        if (mc && !mc.isNull()) nativeUi.MovieClip_gotoAndStopFrameIndex(mc, on ? 2 : 1);
    } catch (_) {}
}

// JirGear config persistence (exact JirGear storage key and field names).
export function saveConfigToLocalStorage() {
    try {
        if (typeof localStorage === "undefined") return;
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({
            isSpinEnabled: flags.spinEnabled,
            spinSpeed: spinConfig.speed,
            spinRadius: spinConfig.radius,
            spinRotationMode: spinConfig.rotationMode,
            cameraEnabled: flags.cameraEnabled,
            cameraMode: cameraConfig.mode,
            cameraZoom: cameraConfig.zoom,
            cameraOffsetX: cameraConfig.offsetX,
            cameraOffsetY: cameraConfig.offsetY,
            followEnabled: flags.followEnabled,
            followDistance: followConfig.distance,
            followMode: followConfig.mode,
            followAntiAfkEnabled: followConfig.antiAfkEnabled,
            pinEnabled: flags.pinEnabled,
            sprayEnabled: flags.sprayEnabled,
            pinIntervalMs: battleTickConfig.pinIntervalMs,
            sprayIntervalMs: battleTickConfig.sprayIntervalMs,
            isXrayEnabled: flags.xrayEnabled,
            xraySelectedGid: xraySelectedGid,
            aopAimEnabled: flags.aimEnabled,
            aopPredictEnabled: aimbotConfig.predictEnabled,
            aopProjectileSpeed: aimbotConfig.projectileSpeed,
            aopLeadScale: aimbotConfig.leadScale,
            aopMaxRange: aimbotConfig.maxRange,
            aopReactionMs: aimbotConfig.reactionMs,
            aopTargetMode: aimbotConfig.targetMode,
            aopDebugEnabled: flags.debugEnabled,
            debugTextScale: debugTextScale,
            epsteinEnabled: flags.epsteinEnabled,
            espEnabled: flags.espEnabled,
            espScale: espConfig.scale,
            espLineWidth: espConfig.lineWidth,
            espShowNames: espConfig.showNames,
            espShowDistance: espConfig.showDistance,
            espShowTracer: espConfig.showTracer,
            espShowHitbox: espConfig.showHitbox,
            espShowCircle: espConfig.showCircle,
            espShowAimLine: espConfig.showAimLine,
            espTracerColor: espConfig.tracerColor,
            espHitboxColor: espConfig.hitboxColor,
            espCircleColor: espConfig.circleColor,
            espEnemyRangeColor: espConfig.enemyRangeColor,
            espAimLineColor: espConfig.aimLineColor,
            espTeamFilterEnemies: espConfig.teamFilterEnemies,
            espTeamFilterSelf: espConfig.teamFilterSelf,
            espTeamFilterTeammates: espConfig.teamFilterTeammates,
            serverIPEnabled: flags.serverIPEnabled,
            killauraEnabled: flags.killauraEnabled,
            killauraMainAttack: flags.killauraMainAttack,
            killauraGadget: flags.killauraGadget,
            killauraSuper: flags.killauraSuper,
            killauraNoWall: flags.killauraNoWall,
            killauraNoBall: flags.killauraNoBall,
            autododgeEnabled: flags.autododgeEnabled,
            ballAssistEnabled: flags.ballAssistEnabled,
            ballAssistTarget: ballAssistConfig.target,
            ballAssistSearchDegrees: ballAssistConfig.searchDegrees,
            ballAssistBounceLimit: ballAssistConfig.bounceLimit,
            combatAuraRange: combatConfig.combatAuraRange,
            combatDodgeRange: combatConfig.combatDodgeRange,
            combatFireInterval: combatConfig.combatFireInterval,
            combatDodgeCooldown: combatConfig.combatDodgeCooldown,
            combatDodgeAccel: combatConfig.combatDodgeAccel,
            combatDodgeDecel: combatConfig.combatDodgeDecel,
            combatDodgeChangeDelay: combatConfig.combatDodgeChangeDelay,
            combatDodgeReturnDelay: combatConfig.combatDodgeReturnDelay,
            combatDodgeDamage: combatConfig.combatDodgeDamage,
            combatDodgeShift: combatConfig.combatDodgeShift,
            combatDodgeShiftDelay: combatConfig.combatDodgeShiftDelay,
            combatDodgeChance: combatConfig.combatDodgeChance,
            combatDodgeMaxAngle: combatConfig.combatDodgeMaxAngle,
            dodgePrecision: DODGE_CFG.N_DIRECTIONS,
            dodgeSafetyMargin: DODGE_CFG.SAFETY_MARGIN,
            dodgeCommitMs: DODGE_CFG.DODGE_COMMIT_MS,
            combatDodgeContinuous: combatConfig.combatDodgeContinuous,
            combatDodgeCircular: combatConfig.combatDodgeCircular,
            combatDodgeAlways: combatConfig.combatDodgeAlways,
            combatDodgeQuickAccess: combatConfig.combatDodgeQuickAccess,
            combatDodgeRequireHold: combatConfig.combatDodgeRequireHold,
            holdToShootEnabled: flags.holdToShootEnabled,
            holdToShootAim: holdToShootConfig.aim,
            holdToShootRangeCheck: holdToShootConfig.rangeCheck,
            holdToShootDelayMs: holdToShootConfig.delayMs,
            shaderCfg: shaderConfig
        }));
    } catch (_) {}
}

export function loadConfigFromLocalStorage() {
    try {
        if (typeof localStorage === "undefined") return;
        const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
        if (!raw) return;
        const e = JSON.parse(raw);
        if (!e || typeof e != "object") return;
        if (typeof e.isSpinEnabled === "boolean") flags.spinEnabled = e.isSpinEnabled;
        if (typeof e.spinSpeed === "number") spinConfig.speed = e.spinSpeed;
        if (typeof e.spinRadius === "number") spinConfig.radius = e.spinRadius;
        if (typeof e.spinRotationMode === "string") spinConfig.rotationMode = e.spinRotationMode;
        if (typeof e.cameraEnabled === "boolean") flags.cameraEnabled = e.cameraEnabled;
        if (typeof e.cameraMode === "number") cameraConfig.mode = e.cameraMode | 0;
        if (typeof e.cameraZoom === "number") cameraConfig.zoom = e.cameraZoom;
        if (typeof e.cameraOffsetX === "number") cameraConfig.offsetX = e.cameraOffsetX | 0;
        if (typeof e.cameraOffsetY === "number") cameraConfig.offsetY = e.cameraOffsetY | 0;
        if (typeof e.followEnabled === "boolean") flags.followEnabled = e.followEnabled;
        if (typeof e.followDistance === "number") followConfig.distance = e.followDistance | 0;
        if (e.followMode === "enemy" || e.followMode === "teammate") followConfig.mode = e.followMode;
        if (typeof e.followAntiAfkEnabled === "boolean") followConfig.antiAfkEnabled = e.followAntiAfkEnabled;
        if (typeof e.pinEnabled === "boolean") flags.pinEnabled = e.pinEnabled;
        if (typeof e.sprayEnabled === "boolean") flags.sprayEnabled = e.sprayEnabled;
        if (typeof e.pinIntervalMs === "number") battleTickConfig.pinIntervalMs = e.pinIntervalMs | 0;
        if (typeof e.sprayIntervalMs === "number") battleTickConfig.sprayIntervalMs = e.sprayIntervalMs | 0;
        if (typeof e.isXrayEnabled === "boolean") flags.xrayEnabled = e.isXrayEnabled;
        if (typeof e.xraySelectedGid === "number") xraySelectedGid = e.xraySelectedGid | 0;
        if (typeof e.aopAimEnabled === "boolean") flags.aimEnabled = e.aopAimEnabled;
        if (typeof e.aopPredictEnabled === "boolean") aimbotConfig.predictEnabled = e.aopPredictEnabled;
        if (typeof e.aopProjectileSpeed === "number") aimbotConfig.projectileSpeed = e.aopProjectileSpeed | 0;
        if (typeof e.aopLeadScale === "number") aimbotConfig.leadScale = e.aopLeadScale;
        if (typeof e.aopMaxRange === "number") aimbotConfig.maxRange = e.aopMaxRange | 0;
        if (typeof e.aopReactionMs === "number") aimbotConfig.reactionMs = e.aopReactionMs | 0;
        if (typeof e.aopTargetMode === "string") aimbotConfig.targetMode = e.aopTargetMode;
        if (typeof e.aopDebugEnabled === "boolean") flags.debugEnabled = e.aopDebugEnabled;
        if (typeof e.debugTextScale === "number") debugTextScale = e.debugTextScale;
        if (typeof e.epsteinEnabled === "boolean") flags.epsteinEnabled = e.epsteinEnabled;
        if (typeof e.espEnabled === "boolean") flags.espEnabled = e.espEnabled;
        if (typeof e.espScale === "number") espConfig.scale = e.espScale;
        if (typeof e.espLineWidth === "number") espConfig.lineWidth = e.espLineWidth;
        if (typeof e.espShowNames === "boolean") espConfig.showNames = e.espShowNames;
        if (typeof e.espShowDistance === "boolean") espConfig.showDistance = e.espShowDistance;
        if (typeof e.espShowTracer === "boolean") espConfig.showTracer = e.espShowTracer;
        if (typeof e.espShowHitbox === "boolean") espConfig.showHitbox = e.espShowHitbox;
        if (typeof e.espShowCircle === "boolean") espConfig.showCircle = e.espShowCircle;
        if (typeof e.espShowAimLine === "boolean") espConfig.showAimLine = e.espShowAimLine;
        if (Array.isArray(e.espTracerColor) && e.espTracerColor.length >= 3) espConfig.tracerColor = e.espTracerColor;
        if (Array.isArray(e.espHitboxColor) && e.espHitboxColor.length >= 3) espConfig.hitboxColor = e.espHitboxColor;
        if (Array.isArray(e.espCircleColor) && e.espCircleColor.length >= 3) espConfig.circleColor = e.espCircleColor;
        if (Array.isArray(e.espEnemyRangeColor) && e.espEnemyRangeColor.length >= 3) espConfig.enemyRangeColor = e.espEnemyRangeColor;
        if (Array.isArray(e.espAimLineColor) && e.espAimLineColor.length >= 3) espConfig.aimLineColor = e.espAimLineColor;
        if (typeof e.espTeamFilterEnemies === "boolean") espConfig.teamFilterEnemies = e.espTeamFilterEnemies;
        if (typeof e.espTeamFilterSelf === "boolean") espConfig.teamFilterSelf = e.espTeamFilterSelf;
        if (typeof e.espTeamFilterTeammates === "boolean") espConfig.teamFilterTeammates = e.espTeamFilterTeammates;
        if (typeof e.serverIPEnabled === "boolean") flags.serverIPEnabled = e.serverIPEnabled;
        if (typeof e.killauraEnabled === "boolean") flags.killauraEnabled = e.killauraEnabled;
        if (typeof e.killauraMainAttack === "boolean") flags.killauraMainAttack = e.killauraMainAttack;
        if (typeof e.killauraGadget === "boolean") flags.killauraGadget = e.killauraGadget;
        if (typeof e.killauraSuper === "boolean") flags.killauraSuper = e.killauraSuper;
        if (typeof e.killauraNoWall === "boolean") flags.killauraNoWall = e.killauraNoWall;
        if (typeof e.killauraNoBall === "boolean") flags.killauraNoBall = e.killauraNoBall;
        if (typeof e.autododgeEnabled === "boolean") flags.autododgeEnabled = e.autododgeEnabled;
        if (typeof e.ballAssistEnabled === "boolean") flags.ballAssistEnabled = e.ballAssistEnabled;
        if (e.ballAssistTarget === "top" || e.ballAssistTarget === "bottom") ballAssistConfig.target = e.ballAssistTarget;
        if (typeof e.ballAssistSearchDegrees === "number") ballAssistConfig.searchDegrees = e.ballAssistSearchDegrees | 0;
        if (typeof e.ballAssistBounceLimit === "number") ballAssistConfig.bounceLimit = e.ballAssistBounceLimit | 0;
        if (typeof e.combatAuraRange === "number") combatConfig.combatAuraRange = e.combatAuraRange | 0;
        if (typeof e.combatDodgeRange === "number") combatConfig.combatDodgeRange = e.combatDodgeRange | 0;
        if (typeof e.combatFireInterval === "number") combatConfig.combatFireInterval = e.combatFireInterval | 0;
        if (typeof e.combatDodgeCooldown === "number") combatConfig.combatDodgeCooldown = e.combatDodgeCooldown | 0;
        if (typeof e.combatDodgeAccel === "number") combatConfig.combatDodgeAccel = e.combatDodgeAccel;
        if (typeof e.combatDodgeDecel === "number") combatConfig.combatDodgeDecel = e.combatDodgeDecel;
        if (typeof e.combatDodgeChangeDelay === "number") combatConfig.combatDodgeChangeDelay = e.combatDodgeChangeDelay | 0;
        if (typeof e.combatDodgeReturnDelay === "number") combatConfig.combatDodgeReturnDelay = e.combatDodgeReturnDelay | 0;
        if (typeof e.combatDodgeDamage === "number") combatConfig.combatDodgeDamage = e.combatDodgeDamage | 0;
        if (typeof e.combatDodgeShift === "number") combatConfig.combatDodgeShift = e.combatDodgeShift | 0;
        if (typeof e.combatDodgeShiftDelay === "number") combatConfig.combatDodgeShiftDelay = e.combatDodgeShiftDelay | 0;
        if (typeof e.combatDodgeChance === "number") combatConfig.combatDodgeChance = e.combatDodgeChance | 0;
        if (typeof e.combatDodgeMaxAngle === "number") combatConfig.combatDodgeMaxAngle = e.combatDodgeMaxAngle | 0;
        if (typeof e.dodgePrecision === "number") DODGE_CFG.N_DIRECTIONS = e.dodgePrecision | 0;
        if (typeof e.dodgeSafetyMargin === "number") DODGE_CFG.SAFETY_MARGIN = e.dodgeSafetyMargin | 0;
        if (typeof e.dodgeCommitMs === "number") DODGE_CFG.DODGE_COMMIT_MS = e.dodgeCommitMs | 0;
        if (typeof e.combatDodgeContinuous === "boolean") combatConfig.combatDodgeContinuous = e.combatDodgeContinuous;
        if (typeof e.combatDodgeCircular === "boolean") combatConfig.combatDodgeCircular = e.combatDodgeCircular;
        if (typeof e.combatDodgeAlways === "boolean") combatConfig.combatDodgeAlways = e.combatDodgeAlways;
        if (typeof e.combatDodgeQuickAccess === "boolean") combatConfig.combatDodgeQuickAccess = e.combatDodgeQuickAccess;
        if (typeof e.combatDodgeRequireHold === "boolean") combatConfig.combatDodgeRequireHold = e.combatDodgeRequireHold;
        if (typeof e.holdToShootEnabled === "boolean") flags.holdToShootEnabled = e.holdToShootEnabled;
        if (typeof e.holdToShootAim === "boolean") holdToShootConfig.aim = e.holdToShootAim;
        if (typeof e.holdToShootRangeCheck === "boolean") holdToShootConfig.rangeCheck = e.holdToShootRangeCheck;
        if (typeof e.holdToShootDelayMs === "number") holdToShootConfig.delayMs = e.holdToShootDelayMs | 0;
        const n = e.shaderCfg;
        if (n && typeof n === "object") {
            if (typeof n.offX === "number") shaderConfig.offX = n.offX;
            if (typeof n.offY === "number") shaderConfig.offY = n.offY;
            if (typeof n.bias === "number") shaderConfig.bias = n.bias;
            if (typeof n.contrast === "number") shaderConfig.contrast = n.contrast;
            if (typeof n.lift === "number") shaderConfig.lift = n.lift;
            if (typeof n.strongDark === "number") shaderConfig.strongDark = n.strongDark;
            if (typeof n.softDark === "number") shaderConfig.softDark = n.softDark;
            if (typeof n.night === "number") shaderConfig.night = n.night;
            if (Array.isArray(n.diffuse) && n.diffuse.length >= 3) shaderConfig.diffuse = [n.diffuse[0], n.diffuse[1], n.diffuse[2]];
            if (Array.isArray(n.specular) && n.specular.length >= 3) shaderConfig.specular = [n.specular[0], n.specular[1], n.specular[2]];
            if (typeof n.outline === "number") shaderConfig.outline = n.outline;
            if (typeof n.rtx === "number") shaderConfig.rtx = n.rtx;
            if (typeof n.charContrast === "number") shaderConfig.charContrast = n.charContrast;
            if (typeof n.charSaturation === "number") shaderConfig.charSaturation = n.charSaturation;
            if (Array.isArray(n.outlineColor) && n.outlineColor.length >= 3) shaderConfig.outlineColor = [n.outlineColor[0], n.outlineColor[1], n.outlineColor[2]];
            if (Array.isArray(n.charTint) && n.charTint.length >= 3) shaderConfig.charTint = [n.charTint[0], n.charTint[1], n.charTint[2]];
            if (typeof n.charBrightness === "number") shaderConfig.charBrightness = n.charBrightness;
        }
    } catch (_) {}
}

export function resetConfigToDefaults() {
    flags.spinEnabled = false;
    spinConfig.speed = Math.PI / 4;
    spinConfig.radius = 25;
    spinConfig.rotationMode = "360";
    flags.cameraEnabled = false;
    cameraConfig.mode = 3;
    cameraConfig.zoom = 1;
    cameraConfig.offsetX = 0;
    cameraConfig.offsetY = 0;
    flags.followEnabled = false;
    followConfig.distance = 1200;
    flags.pinEnabled = false;
    flags.sprayEnabled = false;
    battleTickConfig.pinIntervalMs = 800;
    battleTickConfig.sprayIntervalMs = 600;
    flags.xrayEnabled = false;
    xraySelectedGid = 0;
    flags.aimEnabled = false;
    aimbotConfig.predictEnabled = true;
    aimbotConfig.projectileSpeed = 3200;
    aimbotConfig.leadScale = 1;
    aimbotConfig.maxRange = 9000;
    aimbotConfig.reactionMs = 0;
    aimbotConfig.targetMode = "NEAR";
    flags.debugEnabled = false;
    debugTextScale = 1;
    flags.epsteinEnabled = false;
    flags.espEnabled = false;
    espConfig.scale = 1;
    espConfig.lineWidth = 2;
    espConfig.showNames = true;
    espConfig.showDistance = true;
    flags.killauraEnabled = false;
    flags.killauraMainAttack = true;
    flags.killauraGadget = false;
    flags.killauraSuper = false;
    flags.killauraNoWall = false;
    flags.killauraNoBall = true;
    flags.autododgeEnabled = false;
    flags.ballAssistEnabled = false;
    ballAssistConfig.target = "bottom";
    ballAssistConfig.searchDegrees = 90;
    ballAssistConfig.bounceLimit = 3;
    combatConfig.combatAuraRange = 4200;
    combatConfig.combatDodgeRange = 900;
    combatConfig.combatFireInterval = 1000;
    combatConfig.combatDodgeCooldown = 90;
    combatConfig.combatDodgeAccel = 8.5;
    combatConfig.combatDodgeDecel = 7.5;
    combatConfig.combatDodgeChangeDelay = 50;
    combatConfig.combatDodgeReturnDelay = 125;
    combatConfig.combatDodgeDamage = 0;
    combatConfig.combatDodgeShift = 15;
    combatConfig.combatDodgeShiftDelay = 50;
    combatConfig.combatDodgeChance = 100;
    combatConfig.combatDodgeMaxAngle = 140;
    DODGE_CFG.N_DIRECTIONS = 24;
    DODGE_CFG.SAFETY_MARGIN = 60;
    DODGE_CFG.DODGE_COMMIT_MS = 70;
    combatConfig.combatDodgeChangeDelay = DODGE_CFG.DODGE_COMMIT_MS;
    combatConfig.combatDodgeShift = DODGE_CFG.SAFETY_MARGIN;
    combatConfig.combatDodgeContinuous = true;
    combatConfig.combatDodgeCircular = true;
    combatConfig.combatDodgeAlways = true;
    combatConfig.combatDodgeQuickAccess = true;
    combatConfig.combatDodgeRequireHold = false;
    flags.holdToShootEnabled = false;
    holdToShootConfig.aim = false;
    holdToShootConfig.rangeCheck = false;
    holdToShootConfig.delayMs = 50;
    shaderConfig.offX = 0;
    shaderConfig.offY = 0;
    shaderConfig.bias = 0;
    shaderConfig.contrast = 1;
    shaderConfig.lift = 0;
    shaderConfig.strongDark = 0.75;
    shaderConfig.softDark = 0.85;
    shaderConfig.night = 0;
    shaderConfig.diffuse = [0.55, 0.62, 0.92];
    shaderConfig.specular = [0.35, 0.42, 0.7];
    shaderConfig.outline = 1;
    shaderConfig.rtx = 0;
    shaderConfig.charContrast = 1;
    shaderConfig.charSaturation = 1;
    shaderConfig.outlineColor = [1, 1, 1];
    shaderConfig.charTint = [1, 1, 1];
    shaderConfig.charBrightness = 1;
    dodgeDirections.length = 0;
    for (let i = 0; i < DODGE_CFG.N_DIRECTIONS; i++) {
        const a = (Math.PI * 2 * i) / DODGE_CFG.N_DIRECTIONS;
        dodgeDirections.push({ x: Math.cos(a), y: Math.sin(a) });
    }
}

// ---- Boot / interaction state (JirGear parity) ----
var menuButton = null;
var debugButton = null;
var stagePtrForStatus = null;
var shaderTitleLabel = null;
var utilityTitleLabel = null;
var battleTitleLabel = null;
var shaderDayPresetButton = null;
var shaderNightPresetButton = null;
var shaderHardPresetButton = null;
var shaderSoftPresetButton = null;
var debugLines = [];

const pinSprayControls = {};
const keepAliveObjects = [];

// ---- Color helpers (JirGear exact) ----
const COLOR_PALETTE = [
    { name: "Red", rgba: [1, 0.2, 0.2, 0.9] },
    { name: "Orange", rgba: [1, 0.55, 0, 0.85] },
    { name: "Yellow", rgba: [1, 1, 0.15, 0.95] },
    { name: "Green", rgba: [0.2, 0.95, 0.3, 0.9] },
    { name: "Cyan", rgba: [0.2, 0.9, 0.95, 0.85] },
    { name: "Blue", rgba: [0.25, 0.45, 1, 0.9] },
    { name: "Magenta", rgba: [1, 0.2, 0.85, 0.9] },
    { name: "White", rgba: [1, 1, 1, 0.9] }
];

function hsvToHex(t, e, n) {
    n /= 100;
    const o = e * Math.min(n, 1 - n) / 100;
    const r = a => {
        const x = (a + t / 30) % 12;
        const l = n - o * Math.max(Math.min(x - 3, 9 - x, 1), -1);
        return Math.round(255 * l).toString(16).padStart(2, "0");
    };
    return `${r(0)}${r(8)}${r(4)}`;
}

function rgbaToHex6(t) {
    const e = Math.max(0, Math.min(255, Math.round(t[0] * 255)));
    const n = Math.max(0, Math.min(255, Math.round(t[1] * 255)));
    const o = Math.max(0, Math.min(255, Math.round(t[2] * 255)));
    return ((e << 16) | (n << 8) | o).toString(16).padStart(6, "0").toUpperCase();
}

function getPaletteColorName(t) {
    for (let n = 0; n < COLOR_PALETTE.length; n++) {
        const o = COLOR_PALETTE[n].rgba;
        if (Math.abs(o[0] - t[0]) < 0.05 && Math.abs(o[1] - t[1]) < 0.05 && Math.abs(o[2] - t[2]) < 0.05) return COLOR_PALETTE[n].name;
    }
    return "Custom";
}

function nextPaletteColor(t) {
    let n = -1;
    for (let i = 0; i < COLOR_PALETTE.length; i++) {
        const r = COLOR_PALETTE[i].rgba;
        if (Math.abs(r[0] - t[0]) < 0.05 && Math.abs(r[1] - t[1]) < 0.05 && Math.abs(r[2] - t[2]) < 0.05) {
            n = i;
            break;
        }
    }
    return COLOR_PALETTE[(n + 1) % COLOR_PALETTE.length].rgba.slice();
}

// ---- Debug text (JirGear exact) ----
function debugLog(t) {
    const e = `${t}`;
    try {
        console.log(e);
    } catch (_) {}
    for (debugLines.push(e); debugLines.length > 6;) debugLines.shift();
    if (flags.debugEnabled) try {
        debugTextField && debugTextField.ptr && !debugTextField.ptr.isNull() &&
            nativeUi.TextField_setText(debugTextField.ptr, makeScString(`<cA8FFB0>${debugLines.join("\n")}</c>`));
    } catch (_) {}
}

function setDebugTextVisible(t) {
    try {
        if (!debugTextField || !debugTextField.ptr || debugTextField.ptr.isNull()) return;
        setScale(debugTextField.ptr, 2.8 * debugTextScale);
        setXY(debugTextField.ptr, t ? debugTextField.x : -9999, t ? debugTextField.y : -9999);
    } catch (_) {}
}

function refreshDebugButton() {
    debugButton && (setButtonTextSafe(debugButton, flags.debugEnabled ? "<c00ff66>Debug: ON</c>" : "<cff5050>Debug: OFF</c>"), saveConfigToLocalStorage());
}

function refreshAimPage() {
    setButtonTextSafe(aimPageControls.enabled, flags.aimEnabled ? "<c00ff66>Aim: ON</c>" : "<cff5050>Aim: OFF</c>");
    setButtonTextSafe(aimPageControls.predict, aimbotConfig.predictEnabled ? "<c00ff66>Predict: ON</c>" : "<cff5050>Predict: OFF</c>");
    setButtonTextSafe(aimPageControls.mode, `<cFFF799>Mode: ${aimbotConfig.targetMode}</c>`);
    setLabelTextSafe(aimPageControls.speed, `<cffffff>Speed proj ${aimbotConfig.projectileSpeed}</c>`);
    setLabelTextSafe(aimPageControls.lead, `<cffffff>Predict ${fmt2(aimbotConfig.leadScale)}</c>`);
    setLabelTextSafe(aimPageControls.range, `<cffffff>Range ${aimbotConfig.maxRange}</c>`);
    setLabelTextSafe(aimPageControls.reaction, `<cffffff>Reaction ${aimbotConfig.reactionMs}ms</c>`);
    saveConfigToLocalStorage();
}

function refreshKillauraPage() {
    setSwitchFrame(killauraControls.enabled, flags.killauraEnabled);
    setSwitchFrame(killauraControls.predict, aimbotConfig.predictEnabled);
    setSwitchFrame(killauraControls.mode, true);
    setSwitchFrame(killauraControls.main, flags.killauraMainAttack);
    setSwitchFrame(killauraControls.gadget, flags.killauraGadget);
    setSwitchFrame(killauraControls.superBtn, flags.killauraSuper);
    setSwitchFrame(killauraControls.noWall, flags.killauraNoWall);
    setSwitchFrame(killauraControls.noBall, flags.killauraNoBall);
    setButtonTextSafe(killauraControls.enabled, flags.killauraEnabled ? "<c00ff66>Enabled: ON</c>" : "<cff5050>Enabled: OFF</c>");
    setButtonTextSafe(killauraControls.predict, aimbotConfig.predictEnabled ? "<c00ff66>Predict: ON</c>" : "<cff5050>Predict: OFF</c>");
    setButtonTextSafe(killauraControls.mode, `<cFFF799>Mode: ${aimbotConfig.targetMode}</c>`);
    setButtonTextSafe(killauraControls.main, flags.killauraMainAttack ? "<c00ff66>Main: ON</c>" : "<cff5050>Main: OFF</c>");
    setButtonTextSafe(killauraControls.gadget, flags.killauraGadget ? "<c00ff66>Gadget: ON</c>" : "<cff5050>Gadget: OFF</c>");
    setButtonTextSafe(killauraControls.superBtn, flags.killauraSuper ? "<c00ff66>Super: ON</c>" : "<cff5050>Super: OFF</c>");
    setButtonTextSafe(killauraControls.noWall, flags.killauraNoWall ? "<c00ff66>No wall: ON</c>" : "<cff5050>No wall: OFF</c>");
    setButtonTextSafe(killauraControls.noBall, flags.killauraNoBall ? "<c00ff66>No ball: ON</c>" : "<cff5050>No ball: OFF</c>");
    setLabelTextSafe(killauraControls.modeLabel, `<cFFF799>Mode: ${aimbotConfig.targetMode}</c>`);
    setLabelTextSafe(killauraControls.range, `<cffffff>Range ${combatConfig.combatAuraRange}</c>`);
    setLabelTextSafe(killauraControls.fireInt, `<cffffff>Fire ${combatConfig.combatFireInterval}ms</c>`);
    setLabelTextSafe(killauraControls.reaction, `<cffffff>Reaction ${aimbotConfig.reactionMs}ms</c>`);
    setLabelTextSafe(killauraControls.lead, `<cffffff>Lead ${fmt2(aimbotConfig.leadScale)}</c>`);
    refreshBattleButtons();
    saveConfigToLocalStorage();
}

function refreshAutododgePage() {
    setSwitchFrame(autododgeControls.enabled, flags.autododgeEnabled);
    setSwitchFrame(autododgeControls.continuous, combatConfig.combatDodgeContinuous);
    setSwitchFrame(autododgeControls.circular, combatConfig.combatDodgeCircular);
    setSwitchFrame(autododgeControls.always, combatConfig.combatDodgeAlways);
    setSwitchFrame(autododgeControls.quick, combatConfig.combatDodgeQuickAccess);
    setSwitchFrame(autododgeControls.hold, combatConfig.combatDodgeRequireHold);
    setButtonTextSafe(autododgeControls.enabled, flags.autododgeEnabled ? "<c00ff66>Enabled: ON</c>" : "<cff5050>Enabled: OFF</c>");
    refreshSliderLabel(autododgeControls.rangeSlider);
    refreshSliderLabel(autododgeControls.cooldownSlider);
    refreshSliderLabel(autododgeControls.commitSlider);
    refreshSliderLabel(autododgeControls.safetySlider);
    refreshSliderLabel(autododgeControls.precisionSlider);
    setLabelTextSafe(autododgeControls.vision, `<cffffff>Threats ${getThreatCount()}</c>`);
    refreshBattleButtons();
    saveConfigToLocalStorage();
}

function refreshHoldToShootPage() {
    setSwitchFrame(holdToShootControls.enabled, flags.holdToShootEnabled);
    setSwitchFrame(holdToShootControls.aim, holdToShootConfig.aim);
    setSwitchFrame(holdToShootControls.range, holdToShootConfig.rangeCheck);
    setButtonTextSafe(holdToShootControls.enabled, flags.holdToShootEnabled ? "<c00ff66>Enabled: ON</c>" : "<cff5050>Enabled: OFF</c>");
    setButtonTextSafe(holdToShootControls.aim, holdToShootConfig.aim ? "<c00ff66>Aim: ON</c>" : "<cff5050>Aim: OFF</c>");
    setButtonTextSafe(holdToShootControls.range, holdToShootConfig.rangeCheck ? "<c00ff66>Range: ON</c>" : "<cff5050>Range: OFF</c>");
    refreshSliderLabel(holdToShootControls.delaySlider);
    saveConfigToLocalStorage();
}

function refreshBallAssistPage() {
    setSwitchFrame(ballAssistControls.enabled, flags.ballAssistEnabled);
    setSwitchFrame(ballAssistControls.target, ballAssistConfig.target === "top");
    setButtonTextSafe(ballAssistControls.enabled, flags.ballAssistEnabled ? "<c00ff66>Enabled: ON</c>" : "<cff5050>Enabled: OFF</c>");
    setButtonTextSafe(ballAssistControls.target, `<cFFF799>Target: ${ballAssistConfig.target}</c>`);
    setLabelTextSafe(ballAssistControls.targetLabel, `<cFFF799>Target: ${ballAssistConfig.target}</c>`);
    setLabelTextSafe(ballAssistControls.degrees, `<cffffff>Search ${ballAssistConfig.searchDegrees}°</c>`);
    setLabelTextSafe(ballAssistControls.bounces, `<cffffff>Bounces ${ballAssistConfig.bounceLimit}</c>`);
    saveConfigToLocalStorage();
}

function refreshSpinPage() {
    setButtonTextSafe(spinToggleButton, `${flags.spinEnabled ? "<c00ff66>" : "<cff5050>"}Spin: ${flags.spinEnabled ? "ON" : "OFF"}</c>`);
    setLabelTextSafe(spinSpeedLabel, `<c87CEFA>Speed ${fmt2(spinConfig.speed)}</c>`);
    setLabelTextSafe(spinRadiusLabel, `<c87CEFA>Radius ${spinConfig.radius | 0}</c>`);
    setButtonTextSafe(spinRotationButton, `<cFFF799>Rotation: ${spinConfig.rotationMode === "SWING" ? "SWING" : "360"}</c>`);
    saveConfigToLocalStorage();
}

function refreshFollowShortcut() {
    setButtonTextSafe(followButton, flags.followEnabled ? (followConfig.mode === "enemy" ? "<c00ff66>Follow: Enemy</c>" : "<c00ff66>Follow: Team</c>") : "<cff5050>Follow: OFF</c>");
    try {
        followTargetButton && setButtonTextSafe(followTargetButton, followConfig.mode === "enemy" ? "<cFFD700>Enemy</c>" : "<c00FFFF>Teammate</c>");
    } catch (_) {}
    saveConfigToLocalStorage();
}

function refreshFollowPage() {
    try {
        setButtonTextSafe(followControls.enabled, flags.followEnabled ? "<c00ff66>Follow: ON</c>" : "<cff5050>Follow: OFF</c>");
    } catch (_) {}
    try {
        setButtonTextSafe(followControls.enemy, followConfig.mode === "enemy" ? "<c00ff66>Enemy</c>" : "<cffffff>Enemy</c>");
    } catch (_) {}
    try {
        setButtonTextSafe(followControls.team, followConfig.mode === "teammate" ? "<c00ff66>Team</c>" : "<cffffff>Team</c>");
    } catch (_) {}
    try {
        setButtonTextSafe(followControls.antiAfk, followConfig.antiAfkEnabled ? "<c00ff66>Anti-AFK: ON</c>" : "<cff5050>Anti-AFK: OFF</c>");
    } catch (_) {}
    try {
        followControls.distance && setButtonTextSafe(followControls.distance, `<cffffff>Dist ${followConfig.distance | 0}</c>`);
    } catch (_) {}
    refreshFollowShortcut();
    saveConfigToLocalStorage();
}

function refreshBattleButtons() {
    setButtonTextSafe(killauraShortcutButton, flags.killauraEnabled ? "<c00ff66>Killaura: ON</c>" : "<cff5050>Killaura: OFF</c>");
    setButtonTextSafe(autododgeShortcutButton, flags.autododgeEnabled ? "<c00ff66>Autododge: ON</c>" : "<cff5050>Autododge: OFF</c>");
}

function refreshShaderPage() {
    setButtonTextSafe(shaderSoftPresetButton, "<c87CEFA>Soft</c>");
    setButtonTextSafe(shaderDayPresetButton, "<cA0FFA0>Day</c>");
    setButtonTextSafe(shaderNightPresetButton, "<c9BB7FF>Night</c>");
    setButtonTextSafe(shaderHardPresetButton, "<cFFD27F>Hard</c>");
    setButtonTextSafe(shaderEditorControls.noline, "<cFFFFFF>NoLine</c>");
    setButtonTextSafe(shaderEditorControls.rtxPreset, "<c9FFFFF>RTX</c>");
    setButtonTextSafe(shaderEditorControls.ice, "<c75D7FF>Ice</c>");
    setButtonTextSafe(shaderEditorControls.gold, "<cFFD45A>Gold</c>");
    setButtonTextSafe(shaderEditorControls.neon, "<c40FF99>Neon</c>");
    setButtonTextSafe(shaderEditorControls.red, "<cFF6060>Red</c>");
    setLabelTextSafe(shaderEditorControls.offsetX, `<cffffff>Shadow X ${fmt2(shaderConfig.offX)}</c>`);
    setLabelTextSafe(shaderEditorControls.offsetY, `<cffffff>Shadow Y ${fmt2(shaderConfig.offY)}</c>`);
    setLabelTextSafe(shaderEditorControls.dark, `<cffffff>Dark ${fmt2(shaderConfig.strongDark)}</c>`);
    setLabelTextSafe(shaderEditorControls.contrast, `<cffffff>Contrast ${fmt2(shaderConfig.contrast)}</c>`);
    setLabelTextSafe(shaderEditorControls.nightVal, `<cffffff>Night ${fmt2(shaderConfig.night)}</c>`);
    setLabelTextSafe(shaderEditorControls.bias, `<cffffff>Bias ${fmt2(shaderConfig.bias)}</c>`);
    setLabelTextSafe(shaderEditorControls.outline, `<cffffff>Outline ${fmt2(shaderConfig.outline)}</c>`);
    setLabelTextSafe(shaderEditorControls.rtx, `<cffffff>RTX ${fmt2(shaderConfig.rtx)}</c>`);
    setLabelTextSafe(shaderEditorControls.tintR, `<cffffff>R ${fmt2(shaderConfig.charTint[0])}</c>`);
    setLabelTextSafe(shaderEditorControls.tintG, `<cffffff>G ${fmt2(shaderConfig.charTint[1])}</c>`);
    setLabelTextSafe(shaderEditorControls.tintB, `<cffffff>B ${fmt2(shaderConfig.charTint[2])}</c>`);
    setLabelTextSafe(shaderEditorControls.charLight, `<cffffff>Light ${fmt2(shaderConfig.charBrightness)}</c>`);
    saveConfigToLocalStorage();
}

function applyShaderPreset(t) {
    if (t === "day") {
        shaderConfig.offX = 0, shaderConfig.offY = 0, shaderConfig.bias = 0, shaderConfig.contrast = 1, shaderConfig.lift = 0,
            shaderConfig.strongDark = 0.75, shaderConfig.softDark = 0.85, shaderConfig.night = 0, shaderConfig.outline = 1, shaderConfig.rtx = 0,
            shaderConfig.charContrast = 1, shaderConfig.charSaturation = 1, shaderConfig.charTint = [1, 1, 1], shaderConfig.charBrightness = 1,
            shaderConfig.outlineColor = [1, 1, 1];
    } else if (t === "night") {
        shaderConfig.offX = 0.012, shaderConfig.offY = -0.018, shaderConfig.bias = 0, shaderConfig.contrast = 1.16, shaderConfig.lift = -0.03,
            shaderConfig.strongDark = 0.54, shaderConfig.softDark = 0.68, shaderConfig.night = 1, shaderConfig.outline = 0.85, shaderConfig.rtx = 0.22,
            shaderConfig.charContrast = 1.08, shaderConfig.charSaturation = 0.92, shaderConfig.charTint = [0.72, 0.82, 1.18], shaderConfig.charBrightness = 0.96,
            shaderConfig.outlineColor = [0.65, 0.85, 1];
    } else if (t === "hard") {
        shaderConfig.offX = 0.02, shaderConfig.offY = -0.03, shaderConfig.bias = -0.001, shaderConfig.contrast = 1.35, shaderConfig.lift = -0.07,
            shaderConfig.strongDark = 0.42, shaderConfig.softDark = 0.58, shaderConfig.night = 0.45, shaderConfig.outline = 1.2, shaderConfig.rtx = 0.3,
            shaderConfig.charContrast = 1.18, shaderConfig.charSaturation = 1.08, shaderConfig.charTint = [1.08, 0.96, 0.88], shaderConfig.charBrightness = 1.05,
            shaderConfig.outlineColor = [1, 0.86, 0.55];
    } else if (t === "soft") {
        shaderConfig.offX = 0.006, shaderConfig.offY = -0.008, shaderConfig.bias = 0.001, shaderConfig.contrast = 0.92, shaderConfig.lift = 0.04,
            shaderConfig.strongDark = 0.82, shaderConfig.softDark = 0.91, shaderConfig.night = 0.18, shaderConfig.outline = 0.7, shaderConfig.rtx = 0.12,
            shaderConfig.charContrast = 0.96, shaderConfig.charSaturation = 0.98, shaderConfig.charTint = [1, 1, 1], shaderConfig.charBrightness = 1,
            shaderConfig.outlineColor = [0.9, 0.95, 1];
    } else if (t === "noline") {
        shaderConfig.outline = 0, shaderConfig.rtx = 0.05, shaderConfig.charContrast = 1.02, shaderConfig.charSaturation = 1;
    } else if (t === "rtx") {
        shaderConfig.outline = 0.55, shaderConfig.rtx = 0.8, shaderConfig.charContrast = 1.26, shaderConfig.charSaturation = 1.12,
            shaderConfig.charTint = [1.08, 1.06, 1], shaderConfig.charBrightness = 1.12, shaderConfig.outlineColor = [0.75, 0.95, 1],
            shaderConfig.night = clamp(shaderConfig.night + 0.2, 0, 1);
    } else if (t === "ice") {
        shaderConfig.charTint = [0.55, 0.85, 1.35], shaderConfig.outlineColor = [0.45, 0.95, 1], shaderConfig.charBrightness = 1.06,
            shaderConfig.charSaturation = 1.08, shaderConfig.rtx = 0.35;
    } else if (t === "gold") {
        shaderConfig.charTint = [1.35, 1.02, 0.45], shaderConfig.outlineColor = [1, 0.72, 0.2], shaderConfig.charBrightness = 1.08,
            shaderConfig.charSaturation = 1.12, shaderConfig.rtx = 0.45;
    } else if (t === "neon") {
        shaderConfig.charTint = [0.65, 1.35, 0.9], shaderConfig.outlineColor = [0.2, 1, 0.55], shaderConfig.charBrightness = 1.18,
            shaderConfig.charSaturation = 1.35, shaderConfig.rtx = 0.7;
    } else if (t === "red") {
        shaderConfig.charTint = [1.35, 0.5, 0.45], shaderConfig.outlineColor = [1, 0.2, 0.15], shaderConfig.charBrightness = 1.04,
            shaderConfig.charSaturation = 1.18;
    }
    refreshShaderPage();
}

function refreshUtilityPage() {
    setSwitchFrame(utilityControls.epstein, flags.epsteinEnabled);
    setSwitchFrame(utilityControls.esp, flags.espEnabled);
    setSwitchFrame(utilityControls.ipGrabber, flags.serverIPEnabled);
    setSwitchFrame(utilityControls.camera, flags.cameraEnabled);
    setButtonTextSafe(utilityControls.epstein, flags.epsteinEnabled ? "<c00ff66>Epstein: ON</c>" : "<cff5050>Epstein: OFF</c>");
    setButtonTextSafe(utilityControls.esp, flags.espEnabled ? "<c00ff66>ESP: ON</c>" : "<cff5050>ESP: OFF</c>");
    setButtonTextSafe(utilityControls.ipGrabber, flags.serverIPEnabled ? "<c00ff66>Server IP: ON</c>" : "<cff5050>Server IP: OFF</c>");
    setButtonTextSafe(utilityControls.camera, flags.cameraEnabled ? "<c00ff66>Camera: ON</c>" : "<cff5050>Camera: OFF</c>");
    saveConfigToLocalStorage();
}

function refreshPinSprayPage() {
    setSwitchFrame(pinSprayControls.pin, flags.pinEnabled);
    setSwitchFrame(pinSprayControls.spray, flags.sprayEnabled);
    setButtonTextSafe(pinSprayControls.pin, flags.pinEnabled ? "<c00ff66>Pin: ON</c>" : "<cff5050>Pin: OFF</c>");
    setButtonTextSafe(pinSprayControls.spray, flags.sprayEnabled ? "<c00ff66>Spray: ON</c>" : "<cff5050>Spray: OFF</c>");
    setLabelTextSafe(pinSprayControls.pinInterval, `<cffffff>Pin delay ${battleTickConfig.pinIntervalMs}ms</c>`);
    setLabelTextSafe(pinSprayControls.sprayInterval, `<cffffff>Spray delay ${battleTickConfig.sprayIntervalMs}ms</c>`);
    saveConfigToLocalStorage();
}

function refreshCameraPage() {
    setSwitchFrame(cameraControls.enabled, flags.cameraEnabled);
    setButtonTextSafe(cameraControls.enabled, flags.cameraEnabled ? "<c00ff66>Camera: ON</c>" : "<cff5050>Camera: OFF</c>");
    try {
        cameraControls.modeSlider && refreshSliderLabel(cameraControls.modeSlider);
    } catch (_) {}
    try {
        cameraControls.zoomSlider && refreshSliderLabel(cameraControls.zoomSlider);
    } catch (_) {}
    try {
        cameraControls.offsetXSlider && refreshSliderLabel(cameraControls.offsetXSlider);
    } catch (_) {}
    try {
        cameraControls.offsetYSlider && refreshSliderLabel(cameraControls.offsetYSlider);
    } catch (_) {}
    refreshUtilityPage();
}

function refreshEspPage() {
    setSwitchFrame(espControls.enabled, flags.espEnabled);
    setButtonTextSafe(espControls.enabled, flags.espEnabled ? "<c00ff66>ESP: ON</c>" : "<cff5050>ESP: OFF</c>");
    setSwitchFrame(espControls.tracer, espConfig.showTracer);
    setSwitchFrame(espControls.hitbox, espConfig.showHitbox);
    setSwitchFrame(espControls.circle, espConfig.showCircle);
    setSwitchFrame(espControls.aimLine, espConfig.showAimLine);
    setButtonTextSafe(espControls.tracer, espConfig.showTracer ? "<c00ff66>Tracer: ON</c>" : "<cff5050>Tracer: OFF</c>");
    setButtonTextSafe(espControls.hitbox, espConfig.showHitbox ? "<c00ff66>Hitbox: ON</c>" : "<cff5050>Hitbox: OFF</c>");
    setButtonTextSafe(espControls.circle, espConfig.showCircle ? "<c00ff66>Circle: ON</c>" : "<cff5050>Circle: OFF</c>");
    setButtonTextSafe(espControls.aimLine, espConfig.showAimLine ? "<c00ff66>AimLine: ON</c>" : "<cff5050>AimLine: OFF</c>");
    const t = rgbaToHex6(espConfig.tracerColor);
    const e = rgbaToHex6(espConfig.hitboxColor);
    const n = rgbaToHex6(espConfig.circleColor);
    const o = rgbaToHex6(espConfig.aimLineColor);
    setButtonTextSafe(espControls.tracerColor, `<c${t}>Trc: ${getPaletteColorName(espConfig.tracerColor)}</c>`);
    setButtonTextSafe(espControls.hitboxColor, `<c${e}>Hit: ${getPaletteColorName(espConfig.hitboxColor)}</c>`);
    setButtonTextSafe(espControls.circleColor, `<c${n}>Cir: ${getPaletteColorName(espConfig.circleColor)}</c>`);
    setButtonTextSafe(espControls.aimColor, `<c${o}>Aim: ${getPaletteColorName(espConfig.aimLineColor)}</c>`);
    setSwitchFrame(espControls.filterEnemies, espConfig.teamFilterEnemies);
    setSwitchFrame(espControls.filterSelf, espConfig.teamFilterSelf);
    setSwitchFrame(espControls.filterTeammates, espConfig.teamFilterTeammates);
    setButtonTextSafe(espControls.filterEnemies, espConfig.teamFilterEnemies ? "<c00ff66>Enemies</c>" : "<cff5050>Enemies</c>");
    setButtonTextSafe(espControls.filterSelf, espConfig.teamFilterSelf ? "<c00ff66>Self</c>" : "<cff5050>Self</c>");
    setButtonTextSafe(espControls.filterTeammates, espConfig.teamFilterTeammates ? "<c00ff66>Teammates</c>" : "<cff5050>Teammates</c>");
    setLabelTextSafe(espControls.line, `<cffffff>Line ${fmt2(espConfig.lineWidth)}</c>`);
    refreshUtilityPage();
}

function scaleMenuContainer(t) {
    try {
        if (!menuSprite || menuSprite.isNull()) return;
        setScale(menuSprite, t);
    } catch (_) {}
}

function buildCornerStatus(t) {
    if (cornerStatusLabel || !t || t.isNull()) return;
    try {
        stagePtrForStatus = t;
        cornerStatusLabel = createTextLabel(t, 20, 18, "<cFF00FF>JirGear+</c> <cFFFFFF>:</c> <cFFD45A>loading...</c>", 1.3, []);
        if (cornerStatusLabel && cornerStatusLabel.ptr && !cornerStatusLabel.ptr.isNull()) {
            try {
                addToStage(t, cornerStatusLabel.ptr);
            } catch (_) {}
            try {
                setXY(cornerStatusLabel.ptr, 20, 18);
            } catch (_) {}
        }
    } catch (e) {
        try {
            console.log("[corner] build err: " + e);
        } catch (_) {}
    }
}

function setCornerStatus(t, e) {
    try {
        if (!cornerStatusLabel || !cornerStatusLabel.ptr || cornerStatusLabel.ptr.isNull()) return;
        const o = `<cFF00FF>JirGear+</c> <cFFFFFF>:</c> <c${e || "FFD45A"}>${t}</c>`;
        setLabelTextSafe(cornerStatusLabel, o);
        try {
            setXY(cornerStatusLabel.ptr, 20, 18);
        } catch (_) {}
    } catch (_) {}
}

function showMenuPage(t) {
    currentPage = t;
    [].concat(battlePageItems, killauraPageItems, autododgePageItems, ballAssistPageItems, holdToShootPageItems, utilityPageItems, visualPageItems, otherPageItems, xrayPageItems, spinPageItems, shaderPageItems, aimPageItems, cameraPageItems, espPageItems, followPageItems, rootPageItems).forEach(n => {
        if (n && n.ptr && !n.ptr.isNull()) setXY(n.ptr, -9999, -9999);
    });
    if (t === "R") rootPageItems.forEach(n => {
        if (n && n.ptr && !n.ptr.isNull()) setXY(n.ptr, n.x, n.y);
    });
    let e = [];
    if (t === "C") e = battlePageItems;
    else if (t === "K") e = killauraPageItems;
    else if (t === "D") e = autododgePageItems;
    else if (t === "B") e = ballAssistPageItems;
    else if (t === "T") e = holdToShootPageItems;
    else if (t === "U") e = utilityPageItems;
    else if (t === "V") e = visualPageItems;
    else if (t === "O") e = otherPageItems;
    else if (t === "X") e = xrayPageItems;
    else if (t === "S") e = spinPageItems;
    else if (t === "H") e = shaderPageItems;
    else if (t === "A") e = aimPageItems;
    else if (t === "M") e = cameraPageItems;
    else if (t === "E") e = espPageItems;
    else if (t === "F") e = followPageItems;
    e.forEach(n => {
        if (n && n.ptr && !n.ptr.isNull()) setXY(n.ptr, n.x, n.y);
    });
    if (t === "K") refreshKillauraPage();
    if (t === "D") refreshAutododgePage();
    if (t === "B") refreshBallAssistPage();
    if (t === "T") refreshHoldToShootPage();
    if (t === "A") refreshAimPage();
    if (t === "S") refreshSpinPage();
    if (t === "V") refreshUtilityPage();
    if (t === "O") refreshPinSprayPage();
    if (t === "H") refreshShaderPage();
    if (t === "M") refreshCameraPage();
    if (t === "E") refreshEspPage();
    if (t === "F") refreshFollowPage();
    if (t === "C") refreshBattleButtons();
    if (["X", "S", "H", "A", "K", "D", "B", "T", "M", "E", "F"].includes(t)) {
        titleLabel && setXY(titleLabel.ptr, -9999, -9999);
        subtitleLabel && setXY(subtitleLabel.ptr, -9999, -9999);
    } else {
        titleLabel && setXY(titleLabel.ptr, titleLabel.x, titleLabel.y);
        subtitleLabel && setXY(subtitleLabel.ptr, subtitleLabel.x, subtitleLabel.y);
    }
}

function buildMenuPages() {
    if (menuPagesBuilt || !menuSprite || menuSprite.isNull()) return;
    menuPagesBuilt = true;
    titleLabel = createTextLabel(menuSprite, -250, 80, "JirGear", 1.35, rootPageItems);
    createTextLabel(menuSprite, 280, 82, `<c87CEFA>v${MOD_VERSION}</c>`, 1, rootPageItems);
    subtitleLabel = createTextLabel(menuSprite, 88, 80, "t.me/JirGearPlus", 1.3, rootPageItems);
    createButton(menuSprite, -210, 140, "Battle", 1, rootPageItems, () => showMenuPage("C"));
    createButton(menuSprite, -70, 140, "Utility", 1, rootPageItems, () => showMenuPage("U"));
    createButton(menuSprite, 70, 140, "Visual", 1, rootPageItems, () => showMenuPage("V"));
    createButton(menuSprite, 210, 140, "Other", 1, rootPageItems, () => showMenuPage("O"));

    // --- Battle page ---
    createTextLabel(menuSprite, -54, 82, "<c87CEFA>Battle</c>", 1.7, battlePageItems);
    killauraShortcutButton = createButton(menuSprite, -170, 190, "", 1, battlePageItems, () => showMenuPage("K"));
    autododgeShortcutButton = createButton(menuSprite, 70, 190, "", 1, battlePageItems, () => showMenuPage("D"));
    FREE_MODE
        ? createButton(menuSprite, -170, 245, "<cff5050>Ball</c> <cffd45a>PAID</c>", 0.95, battlePageItems, () => {
            try {
                menuOpen = false;
                menuSprite && !menuSprite.isNull() && setXY(menuSprite, -9999, -9999);
            } catch (_) {}
            try {
                debugLog("Ball assist is paid only — @JirGearPlus");
            } catch (_) {}
        })
        : createButton(menuSprite, -170, 245, "Ball", 1, battlePageItems, () => showMenuPage("B"));
    followButton = createButton(menuSprite, 70, 245, "Follow", 0.92, battlePageItems, () => {
        refreshFollowPage();
        showMenuPage("F");
    });
    createButton(menuSprite, -170, 295, "Aim", 1, battlePageItems, () => {
        refreshAimPage();
        showMenuPage("A");
    });
    FREE_MODE
        ? createButton(menuSprite, 70, 295, "<cff5050>X-ray</c> <cffd45a>PAID only</c>", 0.95, battlePageItems, () => {
            try {
                menuOpen = false;
                menuSprite && !menuSprite.isNull() && setXY(menuSprite, -9999, -9999);
            } catch (_) {}
            try {
                debugLog("X-ray is paid only — @JirGearPlus");
            } catch (_) {}
        })
        : createButton(menuSprite, 70, 295, "X-ray", 1, battlePageItems, () => {
            const t = battleState.enemies;
            xrayEnemyRows.forEach(e => {
                e.e = null;
                setXY(e.ptr, -9999, -9999);
            });
            t.forEach((e, n) => {
                if (n >= xrayEnemyRows.length) return;
                const o = xrayEnemyRows[n];
                o.e = e;
                o.x = -200 + (n % 2) * 230;
                o.y = 200 + Math.floor(n / 2) * 70;
                setButtonTextSafe(o.ptr, `${xraySelectedGid === e.gid ? "<c00ff00>" : "<cff0000>"}${e.name} [${e.gid}]</c>`);
            });
            showMenuPage("X");
        });
    createButton(menuSprite, -170, 350, "Hold", 0.92, battlePageItems, () => {
        refreshHoldToShootPage();
        showMenuPage("T");
    });
    createButton(menuSprite, -50, 400, "Spin", 1, battlePageItems, () => {
        refreshSpinPage();
        showMenuPage("S");
    });
    createButton(menuSprite, -50, 520, "Back", 0.92, battlePageItems, () => showMenuPage("R"));

    // --- Killaura page ---
    createTextLabel(menuSprite, -100, 76, "<c87CEFA>Killaura</c>", 1.7, killauraPageItems);
    createTextLabel(menuSprite, -340, 78, `<c87CEFA>v${MOD_VERSION}</c>`, 0.9, killauraPageItems);
    killauraControls.enabled = createButton(menuSprite, -190, 145, "", 0.72, killauraPageItems, () => {
        flags.killauraEnabled = !flags.killauraEnabled;
        refreshKillauraPage();
    }, "privacy_switch_item");
    killauraControls.predict = createButton(menuSprite, -10, 145, "", 0.72, killauraPageItems, () => {
        aimbotConfig.predictEnabled = !aimbotConfig.predictEnabled;
        refreshKillauraPage();
    }, "privacy_switch_item");
    killauraControls.mode = createButton(menuSprite, 150, 145, "", 0.72, killauraPageItems, () => {
        aimbotConfig.targetMode = aimbotConfig.targetMode === "NEAR" ? "FAST" : aimbotConfig.targetMode === "FAST" ? "LOWID" : "NEAR";
        refreshKillauraPage();
    }, "privacy_switch_item");
    killauraControls.main = createButton(menuSprite, -50, 205, "", 0.85, killauraPageItems, () => {
        flags.killauraMainAttack = !flags.killauraMainAttack;
        refreshKillauraPage();
    }, "privacy_switch_item");
    killauraControls.gadget = null;
    killauraControls.superBtn = null;
    killauraControls.noWall = createButton(menuSprite, -100, 265, "", 0.72, killauraPageItems, () => {
        flags.killauraNoWall = !flags.killauraNoWall;
        refreshKillauraPage();
    }, "privacy_switch_item");
    killauraControls.noBall = createButton(menuSprite, 110, 265, "", 0.72, killauraPageItems, () => {
        flags.killauraNoBall = !flags.killauraNoBall;
        refreshKillauraPage();
    }, "privacy_switch_item");
    killauraControls.modeLabel = createTextLabel(menuSprite, -48, 318, "", 0.82, killauraPageItems);
    killauraControls.range = createTextLabel(menuSprite, -190, 365, "", 0.78, killauraPageItems);
    createButton(menuSprite, 64, 354, "-", 0.64, killauraPageItems, () => {
        combatConfig.combatAuraRange = (clamp(combatConfig.combatAuraRange - 250, 500, 12000)) | 0;
        refreshKillauraPage();
    });
    createButton(menuSprite, 132, 354, "+", 0.64, killauraPageItems, () => {
        combatConfig.combatAuraRange = (clamp(combatConfig.combatAuraRange + 250, 500, 12000)) | 0;
        refreshKillauraPage();
    });
    killauraControls.fireInt = createTextLabel(menuSprite, -190, 410, "", 0.78, killauraPageItems);
    createButton(menuSprite, 64, 399, "-", 0.64, killauraPageItems, () => {
        combatConfig.combatFireInterval = (clamp(combatConfig.combatFireInterval - 50, 50, 2000)) | 0;
        refreshKillauraPage();
    });
    createButton(menuSprite, 132, 399, "+", 0.64, killauraPageItems, () => {
        combatConfig.combatFireInterval = (clamp(combatConfig.combatFireInterval + 50, 50, 2000)) | 0;
        refreshKillauraPage();
    });
    killauraControls.reaction = createTextLabel(menuSprite, -190, 455, "", 0.78, killauraPageItems);
    createButton(menuSprite, 64, 444, "-", 0.64, killauraPageItems, () => {
        aimbotConfig.reactionMs = (clamp(aimbotConfig.reactionMs - 25, 0, 500)) | 0;
        refreshKillauraPage();
    });
    createButton(menuSprite, 132, 444, "+", 0.64, killauraPageItems, () => {
        aimbotConfig.reactionMs = (clamp(aimbotConfig.reactionMs + 25, 0, 500)) | 0;
        refreshKillauraPage();
    });
    killauraControls.lead = createTextLabel(menuSprite, -190, 500, "", 0.78, killauraPageItems);
    createButton(menuSprite, 64, 489, "-", 0.64, killauraPageItems, () => {
        aimbotConfig.leadScale = clamp(aimbotConfig.leadScale - 0.05, 0, 2);
        refreshKillauraPage();
    });
    createButton(menuSprite, 132, 489, "+", 0.64, killauraPageItems, () => {
        aimbotConfig.leadScale = clamp(aimbotConfig.leadScale + 0.05, 0, 2);
        refreshKillauraPage();
    });
    createButton(menuSprite, -40, 538, "Back", 0.82, killauraPageItems, () => showMenuPage("C"));

    // --- Autododge page ---
    createTextLabel(menuSprite, -100, 74, "<c87CEFA>Autododge</c>", 1.7, autododgePageItems);
    createTextLabel(menuSprite, -340, 76, `<c87CEFA>v${MOD_VERSION}</c>`, 0.9, autododgePageItems);
    autododgeControls.enabled = createButton(menuSprite, -190, 140, "", 0.72, autododgePageItems, () => {
        flags.autododgeEnabled = !flags.autododgeEnabled;
        refreshAutododgePage();
    }, "privacy_switch_item");
    autododgeControls.rangeSlider = createSlider(menuSprite, -165, 212, "Range", 0.78, autododgePageItems, () => combatConfig.combatDodgeRange, t => {
        combatConfig.combatDodgeRange = (clamp(t, 300, 3000)) | 0;
    }, 300, 3000, 150);
    autododgeControls.cooldownSlider = createSlider(menuSprite, -165, 272, "Cooldown", 0.78, autododgePageItems, () => combatConfig.combatDodgeCooldown, t => {
        combatConfig.combatDodgeCooldown = (clamp(t, 0, 400)) | 0;
    }, 0, 400, 25, t => `${t | 0}ms`);
    autododgeControls.commitSlider = createSlider(menuSprite, -165, 332, "Commit", 0.78, autododgePageItems, () => combatConfig.combatDodgeChangeDelay, t => {
        combatConfig.combatDodgeChangeDelay = (clamp(t, 20, 250)) | 0;
        DODGE_CFG.DODGE_COMMIT_MS = combatConfig.combatDodgeChangeDelay;
    }, 20, 250, 10, t => `${t | 0}ms`);
    autododgeControls.safetySlider = createSlider(menuSprite, -165, 392, "Safety", 0.78, autododgePageItems, () => DODGE_CFG.SAFETY_MARGIN, t => {
        DODGE_CFG.SAFETY_MARGIN = (clamp(t, 0, 180)) | 0;
        combatConfig.combatDodgeShift = DODGE_CFG.SAFETY_MARGIN;
    }, 0, 180, 10);
    autododgeControls.precisionSlider = createSlider(menuSprite, -165, 452, "Precision", 0.78, autododgePageItems, () => DODGE_CFG.N_DIRECTIONS, t => {
        DODGE_CFG.N_DIRECTIONS = (clamp(t, 8, 40)) | 0;
        dodgeDirections.length = 0;
        for (let e = 0; e < DODGE_CFG.N_DIRECTIONS; e++) {
            const n = (Math.PI * 2 * e) / DODGE_CFG.N_DIRECTIONS;
            dodgeDirections.push({ x: Math.cos(n), y: Math.sin(n) });
        }
    }, 8, 40, 4);
    autododgeControls.vision = createTextLabel(menuSprite, 115, 468, "", 0.7, autododgePageItems);
    createButton(menuSprite, -40, 536, "Back", 0.92, autododgePageItems, () => showMenuPage("C"));

    buildMenuPagesPart2();
    buildMenuPagesPart3();

    refreshAimPage();
    refreshSpinPage();
    refreshShaderPage();
    refreshKillauraPage();
    refreshAutododgePage();
    refreshHoldToShootPage();
    refreshBallAssistPage();
    refreshUtilityPage();
    refreshPinSprayPage();
    refreshCameraPage();
    refreshEspPage();
    refreshBattleButtons();
    refreshFollowShortcut();
    showMenuPage("R");
}

function buildMenuPagesPart2() {
    // --- Ball Assist page ---
    createTextLabel(menuSprite, -70, 74, "<c87CEFA>Ball Assist</c>", 1.7, ballAssistPageItems);
    createTextLabel(menuSprite, -340, 76, `<c87CEFA>v${MOD_VERSION}</c>`, 0.9, ballAssistPageItems);
    ballAssistControls.enabled = createButton(menuSprite, -190, 145, "", 0.72, ballAssistPageItems, () => {
        flags.ballAssistEnabled = !flags.ballAssistEnabled;
        refreshBallAssistPage();
    }, "privacy_switch_item");
    ballAssistControls.target = createButton(menuSprite, 0, 145, "", 0.72, ballAssistPageItems, () => {
        ballAssistConfig.target = ballAssistConfig.target === "bottom" ? "top" : "bottom";
        refreshBallAssistPage();
    }, "privacy_switch_item");
    ballAssistControls.targetLabel = null;
    ballAssistControls.degrees = createTextLabel(menuSprite, -214, 260, "", 0.86, ballAssistPageItems);
    createButton(menuSprite, -42, 250, "-", 0.82, ballAssistPageItems, () => {
        ballAssistConfig.searchDegrees = (clamp(ballAssistConfig.searchDegrees - 10, 0, 180)) | 0;
        refreshBallAssistPage();
    });
    createButton(menuSprite, 38, 250, "+", 0.82, ballAssistPageItems, () => {
        ballAssistConfig.searchDegrees = (clamp(ballAssistConfig.searchDegrees + 10, 0, 180)) | 0;
        refreshBallAssistPage();
    });
    ballAssistControls.bounces = createTextLabel(menuSprite, -214, 330, "", 0.86, ballAssistPageItems);
    createButton(menuSprite, -42, 320, "-", 0.82, ballAssistPageItems, () => {
        ballAssistConfig.bounceLimit = (clamp(ballAssistConfig.bounceLimit - 1, 0, 10)) | 0;
        refreshBallAssistPage();
    });
    createButton(menuSprite, 38, 320, "+", 0.82, ballAssistPageItems, () => {
        ballAssistConfig.bounceLimit = (clamp(ballAssistConfig.bounceLimit + 1, 0, 10)) | 0;
        refreshBallAssistPage();
    });
    createButton(menuSprite, -40, 536, "Back", 0.92, ballAssistPageItems, () => showMenuPage("C"));

    // --- Hold to Shoot page ---
    createTextLabel(menuSprite, -92, 74, "<c87CEFA>Hold to Shoot</c>", 1.45, holdToShootPageItems);
    createTextLabel(menuSprite, 240, 76, `<c87CEFA>v${MOD_VERSION}</c>`, 0.9, holdToShootPageItems);
    holdToShootControls.enabled = createButton(menuSprite, -190, 145, "", 0.72, holdToShootPageItems, () => {
        flags.holdToShootEnabled = !flags.holdToShootEnabled;
        refreshHoldToShootPage();
    }, "privacy_switch_item");
    holdToShootControls.aim = createButton(menuSprite, -10, 145, "", 0.72, holdToShootPageItems, () => {
        holdToShootConfig.aim = !holdToShootConfig.aim;
        refreshHoldToShootPage();
    }, "privacy_switch_item");
    holdToShootControls.range = createButton(menuSprite, 150, 145, "", 0.72, holdToShootPageItems, () => {
        holdToShootConfig.rangeCheck = !holdToShootConfig.rangeCheck;
        refreshHoldToShootPage();
    }, "privacy_switch_item");
    holdToShootControls.delaySlider = createSlider(menuSprite, -165, 270, "Aim Wait", 0.78, holdToShootPageItems, () => holdToShootConfig.delayMs, t => {
        holdToShootConfig.delayMs = (clamp(t, 0, 1000)) | 0;
    }, 0, 1000, 25, t => `${t | 0}ms`);
    createButton(menuSprite, -40, 536, "Back", 0.92, holdToShootPageItems, () => showMenuPage("C"));

    // --- Follow page ---
    createTextLabel(menuSprite, -68, 74, "<c87CEFA>Follow</c>", 1.6, followPageItems);
    createTextLabel(menuSprite, -340, 76, `<c87CEFA>v${MOD_VERSION}</c>`, 0.9, followPageItems);
    followControls.enabled = createButton(menuSprite, -120, 150, "", 0.95, followPageItems, () => {
        flags.followEnabled = !flags.followEnabled;
        refreshFollowPage();
    }, "privacy_switch_item");
    createTextLabel(menuSprite, -64, 220, "<cffffff>Target</c>", 0.95, followPageItems);
    followControls.enemy = createButton(menuSprite, -160, 280, "Enemy", 0.95, followPageItems, () => {
        followConfig.mode = "enemy";
        refreshFollowPage();
    });
    followControls.team = createButton(menuSprite, 30, 280, "Team", 0.95, followPageItems, () => {
        followConfig.mode = "teammate";
        refreshFollowPage();
    });
    followControls.distance = createTextLabel(menuSprite, -210, 360, "", 0.88, followPageItems);
    createButton(menuSprite, 50, 350, "-", 0.82, followPageItems, () => {
        followConfig.distance = (clamp(followConfig.distance - 100, 100, 5000)) | 0;
        refreshFollowPage();
    });
    createButton(menuSprite, 130, 350, "+", 0.82, followPageItems, () => {
        followConfig.distance = (clamp(followConfig.distance + 100, 100, 5000)) | 0;
        refreshFollowPage();
    });
    followControls.antiAfk = createButton(menuSprite, -120, 420, "", 0.92, followPageItems, () => {
        followConfig.antiAfkEnabled = !followConfig.antiAfkEnabled;
        refreshFollowPage();
    });
    createButton(menuSprite, -40, 536, "Back", 0.92, followPageItems, () => showMenuPage("C"));

    // --- Aim page ---
    createTextLabel(menuSprite, -46, 74, "<c87CEFA>Aim</c>", 1.7, aimPageItems);
    createTextLabel(menuSprite, -340, 76, `<c87CEFA>v${MOD_VERSION}</c>`, 0.9, aimPageItems);
    aimPageControls.enabled = createButton(menuSprite, -190, 145, "", 0.98, aimPageItems, () => {
        flags.aimEnabled = !flags.aimEnabled;
        refreshAimPage();
        debugLog(`aim ${flags.aimEnabled ? "ON" : "OFF"} enemies=${battleState.enemies.length} ban=${battleState.pickups.length}`);
    });
    aimPageControls.predict = createButton(menuSprite, 10, 145, "", 0.98, aimPageItems, () => {
        aimbotConfig.predictEnabled = !aimbotConfig.predictEnabled;
        refreshAimPage();
        debugLog(`predict ${aimbotConfig.predictEnabled ? "ON" : "OFF"}`);
    });
    aimPageControls.mode = createButton(menuSprite, 210, 145, "", 0.9, aimPageItems, () => {
        aimbotConfig.targetMode = aimbotConfig.targetMode === "NEAR" ? "FAST" : aimbotConfig.targetMode === "FAST" ? "LOWID" : "NEAR";
        refreshAimPage();
        debugLog(`mode ${aimbotConfig.targetMode}`);
    });
    aimPageControls.speed = createTextLabel(menuSprite, -205, 230, "", 0.9, aimPageItems);
    createButton(menuSprite, 60, 220, "-", 0.82, aimPageItems, () => {
        aimbotConfig.projectileSpeed = (clamp(aimbotConfig.projectileSpeed - 250, 500, 12000)) | 0;
        refreshAimPage();
    });
    createButton(menuSprite, 140, 220, "+", 0.82, aimPageItems, () => {
        aimbotConfig.projectileSpeed = (clamp(aimbotConfig.projectileSpeed + 250, 500, 12000)) | 0;
        refreshAimPage();
    });
    aimPageControls.lead = createTextLabel(menuSprite, -205, 295, "", 0.9, aimPageItems);
    createButton(menuSprite, 60, 285, "-", 0.82, aimPageItems, () => {
        aimbotConfig.leadScale = clamp(aimbotConfig.leadScale - 0.05, 0, 2);
        refreshAimPage();
    });
    createButton(menuSprite, 140, 285, "+", 0.82, aimPageItems, () => {
        aimbotConfig.leadScale = clamp(aimbotConfig.leadScale + 0.05, 0, 2);
        refreshAimPage();
    });
    aimPageControls.range = createTextLabel(menuSprite, -205, 360, "", 0.9, aimPageItems);
    createButton(menuSprite, 60, 350, "-", 0.82, aimPageItems, () => {
        aimbotConfig.maxRange = (clamp(aimbotConfig.maxRange - 500, 1000, 20000)) | 0;
        refreshAimPage();
    });
    createButton(menuSprite, 140, 350, "+", 0.82, aimPageItems, () => {
        aimbotConfig.maxRange = (clamp(aimbotConfig.maxRange + 500, 1000, 20000)) | 0;
        refreshAimPage();
    });
    aimPageControls.reaction = createTextLabel(menuSprite, -205, 425, "", 0.9, aimPageItems);
    createButton(menuSprite, 60, 415, "-", 0.82, aimPageItems, () => {
        aimbotConfig.reactionMs = (clamp(aimbotConfig.reactionMs - 25, 0, 500)) | 0;
        refreshAimPage();
    });
    createButton(menuSprite, 140, 415, "+", 0.82, aimPageItems, () => {
        aimbotConfig.reactionMs = (clamp(aimbotConfig.reactionMs + 25, 0, 500)) | 0;
        refreshAimPage();
    });
    createButton(menuSprite, -40, 525, "Back", 0.92, aimPageItems, () => showMenuPage("C"));
}

function buildMenuPagesPart3() {
    // --- Spin Editor page ---
    utilityTitleLabel = createTextLabel(menuSprite, -74, 166, "<c87CEFA>Spin Editor</c>", 1.55, spinPageItems);
    createTextLabel(menuSprite, 240, 168, `<c87CEFA>v${MOD_VERSION}</c>`, 0.9, spinPageItems);
    spinToggleButton = createButton(menuSprite, -112, 238, "", 1.02, spinPageItems, () => {
        flags.spinEnabled = !flags.spinEnabled;
        refreshSpinPage();
    });
    createButton(menuSprite, -178, 318, "-", 0.82, spinPageItems, () => {
        spinConfig.speed = clamp(spinConfig.speed - 0.08, 0.08, 1.6);
        refreshSpinPage();
    });
    spinSpeedLabel = createTextLabel(menuSprite, -74, 322, "", 1, spinPageItems);
    createButton(menuSprite, 82, 318, "+", 0.82, spinPageItems, () => {
        spinConfig.speed = clamp(spinConfig.speed + 0.08, 0.08, 1.6);
        refreshSpinPage();
    });
    createButton(menuSprite, -178, 388, "-", 0.82, spinPageItems, () => {
        spinConfig.radius = (clamp(spinConfig.radius - 5, 5, 120)) | 0;
        refreshSpinPage();
    });
    spinRadiusLabel = createTextLabel(menuSprite, -74, 392, "", 1, spinPageItems);
    createButton(menuSprite, 82, 388, "+", 0.82, spinPageItems, () => {
        spinConfig.radius = (clamp(spinConfig.radius + 5, 5, 120)) | 0;
        refreshSpinPage();
    });
    spinRotationButton = createButton(menuSprite, -112, 458, "", 1.02, spinPageItems, () => {
        spinConfig.rotationMode = spinConfig.rotationMode === "360" ? "SWING" : "360";
        refreshSpinPage();
    });
    createButton(menuSprite, -46, 528, "Back", 0.92, spinPageItems, () => showMenuPage("C"));

    // --- Utility page ---
    createTextLabel(menuSprite, -70, 82, "<c87CEFA>Utility</c>", 1.7, utilityPageItems);
    createTextLabel(menuSprite, -340, 84, `<c87CEFA>v${MOD_VERSION}</c>`, 0.9, utilityPageItems);
    createTextLabel(menuSprite, -50, 280, "<cffffff>Soon?</c>", 1.6, utilityPageItems);
    createButton(menuSprite, -46, 520, "Back", 0.92, utilityPageItems, () => showMenuPage("R"));

    // --- Visual page ---
    createTextLabel(menuSprite, -58, 82, "<c87CEFA>Visual</c>", 1.7, visualPageItems);
    createTextLabel(menuSprite, -340, 84, `<c87CEFA>v${MOD_VERSION}</c>`, 0.9, visualPageItems);
    utilityControls.epstein = createButton(menuSprite, -110, 145, "", 0.72, visualPageItems, () => {
        flags.epsteinEnabled = !flags.epsteinEnabled;
        refreshUtilityPage();
    }, "privacy_switch_item");
    utilityControls.esp = createButton(menuSprite, -110, 205, "", 0.72, visualPageItems, () => {
        flags.espEnabled = !flags.espEnabled;
        refreshUtilityPage();
    }, "privacy_switch_item");
    utilityControls.ipGrabber = createButton(menuSprite, -110, 265, "", 0.72, visualPageItems, () => {
        flags.serverIPEnabled = !flags.serverIPEnabled;
        refreshUtilityPage();
    }, "privacy_switch_item");
    utilityControls.camera = createButton(menuSprite, -110, 325, "", 0.72, visualPageItems, () => {
        flags.cameraEnabled = !flags.cameraEnabled;
        refreshUtilityPage();
    }, "privacy_switch_item");
    createButton(menuSprite, -160, 392, "ESP cfg", 0.82, visualPageItems, () => {
        refreshEspPage();
        showMenuPage("E");
    });
    createButton(menuSprite, 70, 392, "Camera cfg", 0.82, visualPageItems, () => {
        refreshCameraPage();
        showMenuPage("M");
    });
    createButton(menuSprite, -46, 456, "Shader Editor", 0.82, visualPageItems, () => {
        refreshShaderPage();
        showMenuPage("H");
    });
    createButton(menuSprite, -46, 520, "Back", 0.92, visualPageItems, () => showMenuPage("R"));

    // --- Other page ---
    createTextLabel(menuSprite, -62, 86, "<c87CEFA>Other</c>", 1.7, otherPageItems);
    createTextLabel(menuSprite, 240, 88, `<c87CEFA>v${MOD_VERSION}</c>`, 0.9, otherPageItems);
    createTextLabel(menuSprite, -40, 150, "<c87CEFA>Cfg</c>", 1.15, otherPageItems);
    createButton(menuSprite, -170, 212, "Save", 0.82, otherPageItems, () => {
        saveConfigToLocalStorage();
        debugLog("cfg saved");
    });
    createButton(menuSprite, -34, 212, "Load", 0.82, otherPageItems, () => {
        loadConfigFromLocalStorage();
        refreshAimPage();
        refreshSpinPage();
        refreshKillauraPage();
        refreshAutododgePage();
        refreshHoldToShootPage();
        refreshBallAssistPage();
        refreshDebugButton();
        refreshShaderPage();
        refreshPinSprayPage();
        refreshUtilityPage();
        refreshCameraPage();
        refreshEspPage();
        refreshFollowShortcut();
        refreshBattleButtons();
        debugLog("cfg loaded");
    });
    createButton(menuSprite, 102, 212, "Reset", 0.82, otherPageItems, () => {
        resetConfigToDefaults();
        refreshAimPage();
        refreshSpinPage();
        refreshKillauraPage();
        refreshAutododgePage();
        refreshHoldToShootPage();
        refreshBallAssistPage();
        refreshDebugButton();
        refreshShaderPage();
        refreshPinSprayPage();
        refreshUtilityPage();
        refreshCameraPage();
        refreshEspPage();
        refreshFollowShortcut();
        refreshBattleButtons();
        saveConfigToLocalStorage();
        debugLog("cfg reset");
    });
    pinSprayControls.pin = createButton(menuSprite, -170, 282, "", 0.72, otherPageItems, () => {
        flags.pinEnabled = !flags.pinEnabled;
        refreshPinSprayPage();
    }, "privacy_switch_item");
    pinSprayControls.spray = createButton(menuSprite, 40, 282, "", 0.72, otherPageItems, () => {
        flags.sprayEnabled = !flags.sprayEnabled;
        refreshPinSprayPage();
    }, "privacy_switch_item");
    pinSprayControls.pinInterval = createTextLabel(menuSprite, -214, 348, "", 0.76, otherPageItems);
    createButton(menuSprite, 92, 337, "-", 0.58, otherPageItems, () => {
        battleTickConfig.pinIntervalMs = (clamp(battleTickConfig.pinIntervalMs - 100, 100, 5000)) | 0;
        refreshPinSprayPage();
    });
    createButton(menuSprite, 164, 337, "+", 0.58, otherPageItems, () => {
        battleTickConfig.pinIntervalMs = (clamp(battleTickConfig.pinIntervalMs + 100, 100, 5000)) | 0;
        refreshPinSprayPage();
    });
    pinSprayControls.sprayInterval = createTextLabel(menuSprite, -214, 398, "", 0.76, otherPageItems);
    createButton(menuSprite, 92, 387, "-", 0.58, otherPageItems, () => {
        battleTickConfig.sprayIntervalMs = (clamp(battleTickConfig.sprayIntervalMs - 100, 100, 5000)) | 0;
        refreshPinSprayPage();
    });
    createButton(menuSprite, 164, 387, "+", 0.58, otherPageItems, () => {
        battleTickConfig.sprayIntervalMs = (clamp(battleTickConfig.sprayIntervalMs + 100, 100, 5000)) | 0;
        refreshPinSprayPage();
    });
    debugButton = createButton(menuSprite, -92, 442, "Debug: ON", 0.78, otherPageItems, () => {
        flags.debugEnabled = !flags.debugEnabled;
        refreshDebugButton();
        setDebugTextVisible(flags.debugEnabled);
        flags.debugEnabled && debugLog(`debug ON enemies=${battleState.enemies.length} ban=${battleState.pickups.length}`);
    });
    createButton(menuSprite, -170, 490, "Debug -", 0.62, otherPageItems, () => {
        debugTextScale = clamp(debugTextScale - 0.1, 0.6, 2.2);
        setDebugTextVisible(flags.debugEnabled);
        debugLog(`debug scale ${fmt2(debugTextScale)}`);
        saveConfigToLocalStorage();
    });
    createButton(menuSprite, 50, 490, "Debug +", 0.62, otherPageItems, () => {
        debugTextScale = clamp(debugTextScale + 0.1, 0.6, 2.2);
        setDebugTextVisible(flags.debugEnabled);
        debugLog(`debug scale ${fmt2(debugTextScale)}`);
        saveConfigToLocalStorage();
    });
    createButton(menuSprite, -46, 520, "Back", 0.92, otherPageItems, () => showMenuPage("R"));
    refreshDebugButton();
    refreshKillauraPage();
    refreshAutododgePage();
    refreshUtilityPage();
    refreshPinSprayPage();

    // --- Shader Editor page ---
    shaderTitleLabel = createTextLabel(menuSprite, -72, 86, "<c87CEFA>Shader Editor</c>", 1.32, shaderPageItems);
    createTextLabel(menuSprite, 240, 88, `<c87CEFA>v${MOD_VERSION}</c>`, 0.9, shaderPageItems);
    shaderDayPresetButton = createButton(menuSprite, -220, 132, "Day", 0.58, shaderPageItems, () => applyShaderPreset("day"));
    shaderNightPresetButton = createButton(menuSprite, -132, 132, "Night", 0.58, shaderPageItems, () => applyShaderPreset("night"));
    shaderHardPresetButton = createButton(menuSprite, -44, 132, "Hard", 0.58, shaderPageItems, () => applyShaderPreset("hard"));
    shaderSoftPresetButton = createButton(menuSprite, 44, 132, "Soft", 0.58, shaderPageItems, () => applyShaderPreset("soft"));
    shaderEditorControls.noline = createButton(menuSprite, 132, 132, "NoLine", 0.54, shaderPageItems, () => applyShaderPreset("noline"));
    shaderEditorControls.rtxPreset = createButton(menuSprite, 220, 132, "RTX", 0.54, shaderPageItems, () => applyShaderPreset("rtx"));
    shaderEditorControls.ice = createButton(menuSprite, -132, 166, "Ice", 0.5, shaderPageItems, () => applyShaderPreset("ice"));
    shaderEditorControls.gold = createButton(menuSprite, -44, 166, "Gold", 0.5, shaderPageItems, () => applyShaderPreset("gold"));
    shaderEditorControls.neon = createButton(menuSprite, 44, 166, "Neon", 0.5, shaderPageItems, () => applyShaderPreset("neon"));
    shaderEditorControls.red = createButton(menuSprite, 132, 166, "Red", 0.5, shaderPageItems, () => applyShaderPreset("red"));
    createTextLabel(menuSprite, -232, 212, "<cAAAAAA>World</c>", 0.76, shaderPageItems);
    createTextLabel(menuSprite, 52, 212, "<cAAAAAA>Character</c>", 0.76, shaderPageItems);
    shaderEditorControls.offsetX = createTextLabel(menuSprite, -232, 242, "", 0.66, shaderPageItems);
    createButton(menuSprite, -104, 238, "-", 0.48, shaderPageItems, () => {
        shaderConfig.offX = clamp(shaderConfig.offX - 0.004, -0.08, 0.08);
        refreshShaderPage();
    });
    createButton(menuSprite, -44, 238, "+", 0.48, shaderPageItems, () => {
        shaderConfig.offX = clamp(shaderConfig.offX + 0.004, -0.08, 0.08);
        refreshShaderPage();
    });
    shaderEditorControls.offsetY = createTextLabel(menuSprite, -232, 282, "", 0.66, shaderPageItems);
    createButton(menuSprite, -104, 278, "-", 0.48, shaderPageItems, () => {
        shaderConfig.offY = clamp(shaderConfig.offY - 0.004, -0.08, 0.08);
        refreshShaderPage();
    });
    createButton(menuSprite, -44, 278, "+", 0.48, shaderPageItems, () => {
        shaderConfig.offY = clamp(shaderConfig.offY + 0.004, -0.08, 0.08);
        refreshShaderPage();
    });
    shaderEditorControls.dark = createTextLabel(menuSprite, -232, 322, "", 0.66, shaderPageItems);
    createButton(menuSprite, -104, 318, "-", 0.48, shaderPageItems, () => {
        shaderConfig.strongDark = clamp(shaderConfig.strongDark + 0.04, 0.25, 0.95);
        shaderConfig.softDark = clamp(shaderConfig.softDark + 0.04, 0.35, 1);
        refreshShaderPage();
    });
    createButton(menuSprite, -44, 318, "+", 0.48, shaderPageItems, () => {
        shaderConfig.strongDark = clamp(shaderConfig.strongDark - 0.04, 0.25, 0.95);
        shaderConfig.softDark = clamp(shaderConfig.softDark - 0.04, 0.35, 1);
        refreshShaderPage();
    });
    shaderEditorControls.contrast = createTextLabel(menuSprite, -232, 362, "", 0.66, shaderPageItems);
    createButton(menuSprite, -104, 358, "-", 0.48, shaderPageItems, () => {
        shaderConfig.contrast = clamp(shaderConfig.contrast - 0.05, 0.5, 2);
        refreshShaderPage();
    });
    createButton(menuSprite, -44, 358, "+", 0.48, shaderPageItems, () => {
        shaderConfig.contrast = clamp(shaderConfig.contrast + 0.05, 0.5, 2);
        refreshShaderPage();
    });
    shaderEditorControls.nightVal = createTextLabel(menuSprite, -232, 402, "", 0.66, shaderPageItems);
    createButton(menuSprite, -104, 398, "-", 0.48, shaderPageItems, () => {
        shaderConfig.night = clamp(shaderConfig.night - 0.1, 0, 1);
        refreshShaderPage();
    });
    createButton(menuSprite, -44, 398, "+", 0.48, shaderPageItems, () => {
        shaderConfig.night = clamp(shaderConfig.night + 0.1, 0, 1);
        refreshShaderPage();
    });
    shaderEditorControls.bias = createTextLabel(menuSprite, -232, 442, "", 0.66, shaderPageItems);
    createButton(menuSprite, -104, 438, "-", 0.48, shaderPageItems, () => {
        shaderConfig.bias = clamp(shaderConfig.bias - 0.0005, -0.01, 0.01);
        refreshShaderPage();
    });
    createButton(menuSprite, -44, 438, "+", 0.48, shaderPageItems, () => {
        shaderConfig.bias = clamp(shaderConfig.bias + 0.0005, -0.01, 0.01);
        refreshShaderPage();
    });
    shaderEditorControls.outline = createTextLabel(menuSprite, 52, 242, "", 0.66, shaderPageItems);
    createButton(menuSprite, 178, 238, "-", 0.48, shaderPageItems, () => {
        shaderConfig.outline = clamp(shaderConfig.outline - 0.1, 0, 2);
        refreshShaderPage();
    });
    createButton(menuSprite, 238, 238, "+", 0.48, shaderPageItems, () => {
        shaderConfig.outline = clamp(shaderConfig.outline + 0.1, 0, 2);
        refreshShaderPage();
    });
    shaderEditorControls.rtx = createTextLabel(menuSprite, 52, 282, "", 0.66, shaderPageItems);
    createButton(menuSprite, 178, 278, "-", 0.48, shaderPageItems, () => {
        shaderConfig.rtx = clamp(shaderConfig.rtx - 0.1, 0, 1.5);
        refreshShaderPage();
    });
    createButton(menuSprite, 238, 278, "+", 0.48, shaderPageItems, () => {
        shaderConfig.rtx = clamp(shaderConfig.rtx + 0.1, 0, 1.5);
        refreshShaderPage();
    });
    shaderEditorControls.tintR = createTextLabel(menuSprite, 52, 322, "", 0.66, shaderPageItems);
    createButton(menuSprite, 178, 318, "-", 0.48, shaderPageItems, () => {
        shaderConfig.charTint[0] = clamp(shaderConfig.charTint[0] - 0.08, 0.1, 2);
        refreshShaderPage();
    });
    createButton(menuSprite, 238, 318, "+", 0.48, shaderPageItems, () => {
        shaderConfig.charTint[0] = clamp(shaderConfig.charTint[0] + 0.08, 0.1, 2);
        refreshShaderPage();
    });
    shaderEditorControls.tintG = createTextLabel(menuSprite, 52, 362, "", 0.66, shaderPageItems);
    createButton(menuSprite, 178, 358, "-", 0.48, shaderPageItems, () => {
        shaderConfig.charTint[1] = clamp(shaderConfig.charTint[1] - 0.08, 0.1, 2);
        refreshShaderPage();
    });
    createButton(menuSprite, 238, 358, "+", 0.48, shaderPageItems, () => {
        shaderConfig.charTint[1] = clamp(shaderConfig.charTint[1] + 0.08, 0.1, 2);
        refreshShaderPage();
    });
    shaderEditorControls.tintB = createTextLabel(menuSprite, 52, 402, "", 0.66, shaderPageItems);
    createButton(menuSprite, 178, 398, "-", 0.48, shaderPageItems, () => {
        shaderConfig.charTint[2] = clamp(shaderConfig.charTint[2] - 0.08, 0.1, 2);
        refreshShaderPage();
    });
    createButton(menuSprite, 238, 398, "+", 0.48, shaderPageItems, () => {
        shaderConfig.charTint[2] = clamp(shaderConfig.charTint[2] + 0.08, 0.1, 2);
        refreshShaderPage();
    });
    shaderEditorControls.charLight = createTextLabel(menuSprite, 52, 442, "", 0.66, shaderPageItems);
    createButton(menuSprite, 178, 438, "-", 0.48, shaderPageItems, () => {
        shaderConfig.charBrightness = clamp(shaderConfig.charBrightness - 0.08, 0.3, 2);
        refreshShaderPage();
    });
    createButton(menuSprite, 238, 438, "+", 0.48, shaderPageItems, () => {
        shaderConfig.charBrightness = clamp(shaderConfig.charBrightness + 0.08, 0.3, 2);
        refreshShaderPage();
    });
    createButton(menuSprite, -24, 494, "Back", 0.82, shaderPageItems, () => showMenuPage("R"));

    // --- Camera cfg page ---
    createTextLabel(menuSprite, -70, 86, "<c87CEFA>Camera cfg</c>", 1.5, cameraPageItems);
    createTextLabel(menuSprite, 240, 88, `<c87CEFA>v${MOD_VERSION}</c>`, 0.9, cameraPageItems);
    cameraControls.enabled = createButton(menuSprite, -100, 145, "", 0.82, cameraPageItems, () => {
        flags.cameraEnabled = !flags.cameraEnabled;
        refreshCameraPage();
    }, "privacy_switch_item");
    cameraControls.modeSlider = createSlider(menuSprite, -90, 225, "Mode", 0.72, cameraPageItems, () => cameraConfig.mode, t => {
        cameraConfig.mode = (clamp(t, 0, 8)) | 0;
    }, 0, 8, 1);
    cameraControls.zoomSlider = createSlider(menuSprite, -90, 285, "Zoom", 0.72, cameraPageItems, () => cameraConfig.zoom, t => {
        cameraConfig.zoom = clamp(t, 0.5, 2);
    }, 0.5, 2, 0.05, t => `${(+t).toFixed(2)}x`);
    cameraControls.offsetXSlider = createSlider(menuSprite, -90, 345, "OffsetX", 0.72, cameraPageItems, () => cameraConfig.offsetX, t => {
        cameraConfig.offsetX = (clamp(t, -500, 500)) | 0;
    }, -500, 500, 10);
    cameraControls.offsetYSlider = createSlider(menuSprite, -90, 405, "OffsetY", 0.72, cameraPageItems, () => cameraConfig.offsetY, t => {
        cameraConfig.offsetY = (clamp(t, -500, 500)) | 0;
    }, -500, 500, 10);
    createButton(menuSprite, -40, 520, "Back", 0.92, cameraPageItems, () => showMenuPage("V"));

    // --- ESP cfg page ---
    createTextLabel(menuSprite, -50, 86, "<c87CEFA>ESP cfg</c>", 1.5, espPageItems);
    createTextLabel(menuSprite, 240, 88, `<c87CEFA>v${MOD_VERSION}</c>`, 0.9, espPageItems);
    espControls.enabled = createButton(menuSprite, -200, 130, "", 0.72, espPageItems, () => {
        flags.espEnabled = !flags.espEnabled;
        refreshEspPage();
    }, "privacy_switch_item");
    espControls.tracer = createButton(menuSprite, -60, 130, "", 0.72, espPageItems, () => {
        espConfig.showTracer = !espConfig.showTracer;
        refreshEspPage();
    }, "privacy_switch_item");
    espControls.hitbox = createButton(menuSprite, 80, 130, "", 0.72, espPageItems, () => {
        espConfig.showHitbox = !espConfig.showHitbox;
        refreshEspPage();
    }, "privacy_switch_item");
    espControls.circle = createButton(menuSprite, 220, 130, "", 0.72, espPageItems, () => {
        espConfig.showCircle = !espConfig.showCircle;
        refreshEspPage();
    }, "privacy_switch_item");
    espControls.tracerColor = createButton(menuSprite, -200, 200, "", 0.7, espPageItems, () => {
        espConfig.tracerColor = nextPaletteColor(espConfig.tracerColor);
        refreshEspPage();
    });
    espControls.hitboxColor = createButton(menuSprite, -60, 200, "", 0.7, espPageItems, () => {
        espConfig.hitboxColor = nextPaletteColor(espConfig.hitboxColor);
        refreshEspPage();
    });
    espControls.circleColor = createButton(menuSprite, 80, 200, "", 0.7, espPageItems, () => {
        espConfig.circleColor = nextPaletteColor(espConfig.circleColor);
        refreshEspPage();
    });
    espControls.aimColor = createButton(menuSprite, 220, 200, "", 0.7, espPageItems, () => {
        espConfig.aimLineColor = nextPaletteColor(espConfig.aimLineColor);
        refreshEspPage();
    });
    createTextLabel(menuSprite, -200, 250, "<cFFFFFF>Show on:</c>", 0.95, espPageItems);
    espControls.filterEnemies = createButton(menuSprite, -120, 290, "", 0.72, espPageItems, () => {
        espConfig.teamFilterEnemies = !espConfig.teamFilterEnemies;
        refreshEspPage();
    }, "privacy_switch_item");
    espControls.filterSelf = createButton(menuSprite, 20, 290, "", 0.72, espPageItems, () => {
        espConfig.teamFilterSelf = !espConfig.teamFilterSelf;
        refreshEspPage();
    }, "privacy_switch_item");
    espControls.filterTeammates = createButton(menuSprite, 160, 290, "", 0.72, espPageItems, () => {
        espConfig.teamFilterTeammates = !espConfig.teamFilterTeammates;
        refreshEspPage();
    }, "privacy_switch_item");
    espControls.aimLine = createButton(menuSprite, -60, 350, "", 0.72, espPageItems, () => {
        espConfig.showAimLine = !espConfig.showAimLine;
        refreshEspPage();
    }, "privacy_switch_item");
    espControls.line = createTextLabel(menuSprite, -214, 400, "", 0.82, espPageItems);
    createButton(menuSprite, 92, 389, "-", 0.64, espPageItems, () => {
        espConfig.lineWidth = clamp(espConfig.lineWidth - 0.25, 0.5, 8);
        refreshEspPage();
    });
    createButton(menuSprite, 164, 389, "+", 0.64, espPageItems, () => {
        espConfig.lineWidth = clamp(espConfig.lineWidth + 0.25, 0.5, 8);
        refreshEspPage();
    });
    createButton(menuSprite, -40, 520, "Back", 0.92, espPageItems, () => showMenuPage("V"));

    // --- X-ray page (rows live at -9999 until the battle page populates them) ---
    battleTitleLabel = createTextLabel(menuSprite, -80, 120, "X-ray Targets", 1.6, xrayPageItems);
    createTextLabel(menuSprite, 240, 122, `<c87CEFA>v${MOD_VERSION}</c>`, 0.9, xrayPageItems);
    for (let t = 0; t < 6; t++) {
        createButton(menuSprite, -9999, -9999, "", 0.95, xrayPageItems, () => {
            const n = xrayEnemyRows[t];
            if (n && n.e) {
                xraySelectedGid = n.e.gid;
                flags.xrayEnabled = true;
                try {
                    console.log(`[xray] select gid=${n.e.gid} selected=${xraySelectedGid} name=${n.e.name}`);
                } catch (_) {}
                xrayEnemyRows.forEach(o => {
                    if (o.e) setButtonTextSafe(o.ptr, `${o.e.gid === xraySelectedGid ? "<c00ff00>" : "<cff0000>"}${o.e.name} [${o.e.gid}]</c>`);
                });
            }
        });
        const e = xrayPageItems[xrayPageItems.length - 1];
        if (e) {
            e.e = null;
            xrayEnemyRows.push(e);
        }
    }
    createButton(menuSprite, -50, 500, "Back", 1, xrayPageItems, () => showMenuPage("C"));
}

// ---- Menu boot (JirGear boot loop: 250ms interval, 8s delay) ----
export function initMenu(mod) {
    if (menuInitialized) return;
    menuInitialized = true;
    const base = mod.base;
    try {
        initNativeUi(base);
        loadConfigFromLocalStorage();
        rebuildDodgeDirections();

        // Button pressed hook (jirgear OFFSETS.ButtonCallback)
        Interceptor.attach(base.add(uiOffsets.CustomButton_buttonPressed), {
            onEnter(args) {
                try {
                    const e = args[0];
                    if (!e || e.isNull()) return;
                    if (FREE_MODE && keepAliveObjects.length > 0) {
                        const n = e.toString();
                        for (let o = 0; o < keepAliveObjects.length; o++) {
                            const i = keepAliveObjects[o];
                            if (i && i.ptr && i.ptr.toString() === n) {
                                try {
                                    i.callback(i);
                                } catch (_) {}
                                return;
                            }
                        }
                    }
                    if (menuButton && e.toInt32() === menuButton.toInt32()) {
                        pulseScale(e, 1);
                        menuOpen = !menuOpen;
                        if (menuSprite && !menuSprite.isNull()) {
                            if (menuOpen) {
                                scaleMenuContainer(1);
                                buildMenuPages();
                                setXY(menuSprite, 0, 0);
                                showMenuPage(currentPage);
                            } else {
                                setXY(menuSprite, -9999, -9999);
                            }
                        }
                        return;
                    }
                    const cb = buttonCallbacks[e.toString()];
                    if (cb) {
                        pulseScale(e, cb.origScale);
                        cb.func(e);
                    }
                } catch (_) {}
            }
        });

        let bootTickCount = 0;
        const bootDelayUntilMs = Date.now() + 8000;
        const bootInterval = setInterval(() => {
            if (bootComplete) {
                clearInterval(bootInterval);
                return;
            }
            if (Date.now() < bootDelayUntilMs) return;
            bootTickCount++;
            let t = NULL;
            try {
                t = base.add(uiOffsets.Stage_sm_pInstance).readPointer();
            } catch (r) {
                return;
            }
            if (!t || t.isNull()) return;

            // FREE mode drifting watermark
            if (FREE_MODE && !globalThis.__JG_wmInstalled) try {
                const r = "JirGearStatus:";
                const a = "Free";
                const l = [
                    { x: 20, y: 20, sc: 0.55, dx: 6, dy: 4 },
                    { x: 540, y: 20, sc: 0.55, dx: -6, dy: 4 },
                    { x: 20, y: 780, sc: 0.55, dx: 6, dy: -4 },
                    { x: 540, y: 780, sc: 0.55, dx: -6, dy: -4 },
                    { x: 280, y: 10, sc: 0.5, dx: 5, dy: 3 },
                    { x: 280, y: 800, sc: 0.5, dx: 5, dy: -3 }
                ];
                const f = [];
                const u = `<cffffff>${r}</c><cff3030>${a}</c>`;
                for (let y = 0; y < l.length; y++) {
                    const g = l[y];
                    try {
                        const x = createTextLabel(t, g.x, g.y, u, g.sc, f);
                        if (x) {
                            x._phase = y * 0.9;
                            x._driftX = g.dx;
                            x._driftY = g.dy;
                        }
                    } catch (_) {}
                }
                let d = 0;
                setInterval(() => {
                    d++;
                    for (let y = 0; y < f.length; y++) {
                        const g = f[y];
                        if (!g || !g.ptr || g.ptr.isNull()) continue;
                        try {
                            const x = d * 0.12 + (g._phase || 0);
                            const M = Math.sin(x) * (g._driftX || 6);
                            const A = Math.cos(x * 0.8) * (g._driftY || 4);
                            setXY(g.ptr, g.x + M, g.y + A);
                        } catch (_) {}
                    }
                }, 250);
                globalThis.__JG_wmInstalled = true;
            } catch (r) {}

            // menu container
            if (!menuContainer || menuContainer.isNull()) try {
                menuContainer = alloc(2048);
                if (!menuContainer || menuContainer.isNull()) throw new Error("alloc failed");
                nativeUi.GameButton_GameButton(menuContainer);
                setXY(menuContainer, 500, -30);
                addToStage(t, menuContainer);
            } catch (r) {
                menuContainer = null;
                return;
            }

            // menu toggle button
            if (!menuButton || menuButton.isNull()) try {
                menuButton = alloc(2048);
                if (!menuButton || menuButton.isNull()) throw new Error("alloc failed");
                nativeUi.GameButton_GameButton(menuButton);
                const r = getMovieClip("map_editor_big_exit_button");
                if (r && !r.isNull()) {
                    nativeUi.CustomButton_setMovieClip(menuButton, r, 1);
                    nativeUi.MovieClip_gotoAndStopFrameIndex(r, 1);
                    buttonMovieClips[menuButton.toString()] = r;
                    try {
                        setMovieClipText(r, "Menu");
                    } catch (_) {}
                }
                setXY(menuButton, 500, 30);
                addToStage(t, menuButton);
            } catch (r) {
                menuButton = null;
                return;
            }

            // corner status
            try {
                buildCornerStatus(t);
                setCornerStatus("FREE Edition — @JirGearPlus", "00FF66");
            } catch (_) {}

            // debug text field
            try {
                const r = getMovieClip("map_editor_big_exit_button");
                const a = r && !r.isNull() ? nativeUi.MovieClip_getFieldByName(r, allocUtf8("txt")) : null;
                if (a && !a.isNull()) {
                    setScale(a, 2.8);
                    setXY(a, 10, 42);
                    addToStage(t, a);
                    debugTextField = { ptr: a, x: 10, y: 58 };
                    try {
                        debugTitleLabel = createTextLabel(t, 10, 20, "<c00ff66>Debug Mode</c>", 1.25, []);
                    } catch (_) {}
                    setDebugTextVisible(flags.debugEnabled);
                    debugLog("ready");
                    setInterval(() => {
                        if (flags.debugEnabled) {
                            debugLog(`scan aim=${flags.aimEnabled ? 1 : 0} spin=${flags.spinEnabled ? 1 : 0} xray=${flags.xrayEnabled ? 1 : 0} enemies=${battleState.enemies.length} ban=${battleState.pickups.length}`);
                        }
                    }, 1500);
                }
            } catch (_) {}

            // menu sprite
            if (!menuSprite || menuSprite.isNull()) try {
                menuSprite = alloc(2048);
                if (!menuSprite || menuSprite.isNull()) throw new Error("alloc failed");
                nativeUi.Sprite_Sprite(menuSprite, 0);
                setXY(menuSprite, -9999, -9999);
                nativeUi.Sprite_addChild(menuContainer, menuSprite);
            } catch (r) {
                menuSprite = null;
                return;
            }

            // rainbow title (50ms)
            const e = FREE_MODE ? "JirGear+ FREE" : "JirGear+";
            const n = FREE_MODE ? "@JirGearPlus" : "t.me/JirGearPlus";
            let o = 0;
            let i = 0;
            setInterval(() => {
                if (!menuOpen || ["X", "S", "H"].includes(currentPage)) return;
                if (!titleLabel || !titleLabel.ptr || titleLabel.ptr.isNull()) return;
                if (!subtitleLabel || !subtitleLabel.ptr || subtitleLabel.ptr.isNull()) return;
                try {
                    let r = "";
                    for (let g = 0; g < e.length; g++) {
                        const x = (o + g * 25) % 360;
                        r += `<c${hsvToHex(x, 100, 60)}>${e[g]}</c>`;
                    }
                    setLabelTextSafe(titleLabel, r);
                    let a = "";
                    for (let g = 0; g < n.length; g++) {
                        const x = (o + g * 15 + 180) % 360;
                        a += `<c${hsvToHex(x, 100, 60)}>${n[g]}</c>`;
                    }
                    setLabelTextSafe(subtitleLabel, a);
                    o = (o + 12) % 360;
                    i++;
                    const l = i * 0.08;
                    try {
                        setXY(titleLabel.ptr, titleLabel.x + Math.sin(l) * 40, titleLabel.y + Math.cos(l * 0.7) * 8);
                    } catch (_) {}
                    try {
                        setXY(subtitleLabel.ptr, subtitleLabel.x + Math.sin(l * 1.1 + 1.5) * 50, subtitleLabel.y + Math.cos(l * 0.9 + 0.8) * 8);
                    } catch (_) {}
                } catch (_) {}
            }, 50);

            bootComplete = true;
            clearInterval(bootInterval);
        }, 250);
    } catch (W) {
        try {
            console.log("[Menu ERROR] setupOverlay failed: " + W);
        } catch (_) {}
    }
}
