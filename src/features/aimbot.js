import { offsets } from "../core/offsets.js";
import { getFunctions } from "../core/functions.js";
import { battleState, ballPresent, enemyVelocityTracks, battleScreenPtr, battleModeClientPtr, xraySelectedGid, looksLikeLiveGameObject, FREE_MODE } from "../core/scanner.js";
import { writeManualFirePoint } from "../core/commands.js";
import { flags } from "../utils/flags.js";
import { getCollisionMap, raycastTilesClear, lineBlockedByBallOrWall } from "../utils/wallCache.js";
import { combatConfig } from "../helpers/dodge_profiles.js";
import {
    powerupClassIds,
    powerupNameNeedles,
    PROJECTILE_SPEED_BY_BRAWLER_ID,
    DEFAULT_RANGE_BY_BRAWLER_ID,
    RANGE_BY_BRAWLER_NAME
} from "../utils/brawlerName.js";

// JirGear aim config (aimPredictEnabled / aimProjectileSpeed / aimLeadScale /
// aimMaxRange / aimReactionMs / aimTargetMode).
export const aimbotConfig = {
    predictEnabled: true,
    projectileSpeed: 3200,
    leadScale: 1,
    maxRange: 9000,
    reactionMs: 0,
    targetMode: "NEAR"
};

export const ballAssistConfig = {
    target: "bottom",
    searchDegrees: 90,
    bounceLimit: 3
};

var lastAimFireMs = 0;
var aimFireCooldownMs = 0;
var lastBallAssistMs = 0;

export function resetAimbot() {
    lastAimFireMs = 0;
    aimFireCooldownMs = 0;
    lastBallAssistMs = 0;
}

export function setXraySelected(gid) {
    xraySelectedGid = gid | 0;
    if (xraySelectedGid === 0) flags.xrayEnabled = false;
    else flags.xrayEnabled = true;
}

export function getCurrentAttackRange() {
    return battleState.myBrawlerName && RANGE_BY_BRAWLER_NAME[battleState.myBrawlerName] || DEFAULT_RANGE_BY_BRAWLER_ID[battleState.myBrawlerId] || combatConfig.combatAuraRange || aimbotConfig.maxRange;
}

function predictEnemyPosition(myX, myY, enemy, projectileSpeed) {
    const track = enemyVelocityTracks.get(enemy.gid);
    if (!aimbotConfig.predictEnabled || !track) {
        return { x: enemy.x, y: enemy.y };
    }
    const dx = enemy.x - myX;
    const dy = enemy.y - myY;
    let t = Math.sqrt(dx * dx + dy * dy) / Math.max(500, projectileSpeed || aimbotConfig.projectileSpeed || 3200);
    if (t < 0) t = 0;
    if (t > 1.35) t = 1.35;
    t *= 0.8 * aimbotConfig.leadScale;
    return { x: Math.round(enemy.x + track.vx * t), y: Math.round(enemy.y + track.vy * t) };
}

function predictEnemyPositionByGid(gid, myX, myY) {
    for (let i = 0; i < battleState.enemies.length; i++) {
        const enemy = battleState.enemies[i];
        if (String(enemy.gid) === String(gid)) {
            const speed = PROJECTILE_SPEED_BY_BRAWLER_ID[battleState.myBrawlerId] || aimbotConfig.projectileSpeed || 3200;
            return predictEnemyPosition(myX, myY, enemy, speed);
        }
    }
    return null;
}

function distancePointToSegmentSq(t, e, n, o, i, r) {
    const a = i - n;
    const l = r - o;
    const f = t - n;
    const u = e - o;
    const d = a * a + l * l;
    let y = d > 0 ? (f * a + u * l) / d : 0;
    if (y < 0) y = 0;
    else if (y > 1) y = 1;
    const g = n + a * y;
    const x = o + l * y;
    const M = t - g;
    const A = e - x;
    return M * M + A * A;
}

export function isTargetAllowed(target) {
    if (!target) return false;
    const noBall = FREE_MODE ? true : flags.killauraNoBall;
    const noWall = FREE_MODE ? true : flags.killauraNoWall;
    return !(noBall && ballPresent || noWall && lineBlockedByBallOrWall(battleState.myX, battleState.myY, target.x, target.y));
}

export function selectBestTarget(range) {
    const maxRange = typeof range === "number" ? range : getCurrentAttackRange();
    let best = null;
    let bestScore = 1e18;
    for (let i = 0; i < battleState.enemies.length; i++) {
        const enemy = battleState.enemies[i];
        const dx = enemy.x - battleState.myX;
        const dy = enemy.y - battleState.myY;
        const distSq = dx * dx + dy * dy;
        if (maxRange > 0 && distSq > maxRange * maxRange || !isTargetAllowed(enemy)) continue;
        const track = enemyVelocityTracks.get(enemy.gid);
        const speed = track ? Math.sqrt(track.vx * track.vx + track.vy * track.vy) : 0;
        let score = distSq;
        if (aimbotConfig.targetMode === "FAST") score = distSq - speed * 420;
        else if (aimbotConfig.targetMode === "LOWID") score = (enemy.brawlerId || 0) * 1e5 + distSq * 0.01;
        if (score < bestScore) {
            bestScore = score;
            best = enemy;
        }
    }
    return best;
}

export function getAimPoint(target) {
    return predictEnemyPositionByGid(target.gid, battleState.myX, battleState.myY) || { x: target.x, y: target.y };
}

function readCStringSafe(t) {
    try {
        if (!t || t.isNull()) return null;
        const s = t.readCString();
        return !s || s.length < 3 || s.length > 96 ? null : s;
    } catch (_) {
        return null;
    }
}

function scanHeroNameAtKnownOffsets(t) {
    if (!t || t.isNull()) return null;
    for (let e = 0; e <= 256; e += 8) {
        try {
            const s = readCStringSafe(t.add(e).readPointer());
            if (!s) continue;
            const u = s.toUpperCase();
            if (u.indexOf("BOXPICKUP") >= 0 || u.indexOf("POWERUP") >= 0) return s;
        } catch (_) {}
    }
    return null;
}

// JirGear getBrawlerName: classId probe bound to the valid v69 classId offset
// (u8 then u32 read, powerupClassIds membership), optional name-needle scan.
export function getBrawlerName(data, scanNames) {
    if (!data || data.isNull()) return false;
    if (scanNames) {
        const found = scanHeroNameAtKnownOffsets(data);
        if (found) {
            const u = found.toUpperCase();
            if (u.indexOf("BOXPICKUP") >= 0 || u.indexOf("POWERUP") >= 0 || powerupNameNeedles.indexOf(u) >= 0) return true;
        }
    }
    const probeOffsets = [offsets.LogicCharacterData_characterClassId];
    for (let i = 0; i < probeOffsets.length; i++) {
        try {
            if (powerupClassIds.has(data.add(probeOffsets[i]).readU8())) return true;
        } catch (_) {}
        try {
            if (powerupClassIds.has(data.add(probeOffsets[i]).readU32())) return true;
        } catch (_) {}
    }
    return false;
}

function findXrayTargetObject() {
    try {
        const fns = getFunctions();
        const inst = fns.BattleMode_getInstance();
        if (!inst || inst.isNull()) return null;
        const mgr = inst.add(offsets.LogicBattleModeClient_gameObjectManager).readPointer();
        if (!mgr || mgr.isNull()) return null;
        const o = fns.LogicGameObjectManagerClient_findGameObject(mgr, xraySelectedGid, 0);
        if (o && !o.isNull() && looksLikeLiveGameObject(o) && o.add(offsets.LogicGameObjectClient_state).readU32() === 0) return o;
    } catch (_) {}
    return null;
}

function sendXraySelectedInput() {
    try {
        const fns = getFunctions();
        const inst = fns.BattleMode_getInstance();
        if (!inst || inst.isNull()) return;
        const mgr = inst.add(offsets.BattleMode_clientInputManager).readPointer();
        if (!mgr || mgr.isNull()) return;
        const ci = fns.malloc(64);
        fns.ClientInput_ctor(ci, 0);
        ci.add(20).writeU8(1);
        ci.add(21).writeU8(1);
        ci.add(16).writeS32(xraySelectedGid | 0);
        fns.ClientInputManager_addInput(mgr, ci);
    } catch (_) {}
}

// JirGear fireWrapperFn onEnter: aim the main attack fire (no arg rewrite).
export function onFireEnter(args) {
    if (!flags.aimEnabled) return;
    try {
        const bs = args[0];
        if (!bs || bs.isNull()) return;
        const target = selectBestTarget();
        if (!target) return;
        try {
            if (getCollisionMap() && !raycastTilesClear(battleState.myX, battleState.myY, target.x, target.y, 64)) return;
        } catch (_) {}
        if (ballPresent) return;
        const aim = getAimPoint(target);
        const now = Date.now();
        if (aimbotConfig.reactionMs > 0 && now - lastAimFireMs < aimbotConfig.reactionMs) return;
        lastAimFireMs = now;
        writeManualFirePoint(bs, aim.x, aim.y);
    } catch (_) {}
}

// JirGear activateSkill onEnter: xray target lock first, then aim gate
// (aimEnabled || (killauraEnabled && (killauraSuper || killauraGadget))).
export function onActivateSkillEnter(args) {
    try {
        const bs = args[0];
        if (bs && !bs.isNull()) battleScreenPtr = bs;
        if (flags.xrayEnabled && xraySelectedGid !== 0) {
            try {
                const fns = getFunctions();
                const o = findXrayTargetObject();
                if (o) {
                    args[1] = ptr(fns.LogicGameObjectClient_getX(o) | 0);
                    args[2] = ptr(fns.LogicGameObjectClient_getY(o) | 0);
                    sendXraySelectedInput();
                }
            } catch (_) {}
        }
        if (flags.aimEnabled || flags.killauraEnabled && (flags.killauraSuper || flags.killauraGadget)) {
            try {
                const target = selectBestTarget(getCurrentAttackRange());
                if (target) {
                    const aim = getAimPoint(target);
                    const now = Date.now();
                    if (aimbotConfig.reactionMs > 0 && now - lastAimFireMs < aimbotConfig.reactionMs) return;
                    lastAimFireMs = now;
                    if (bs && !bs.isNull()) {
                        writeManualFirePoint(bs, aim.x, aim.y);
                    }
                    args[1] = ptr(aim.x | 0);
                    args[2] = ptr(aim.y | 0);
                    if (now - aimFireCooldownMs > 420) {
                        aimFireCooldownMs = now;
                    }
                    return;
                }
            } catch (_) {}
            return;
        }
    } catch (_) {}
}

// JirGear getClosestTargetForAutoshoot onLeave: block pickups/boxes, then xray swap.
export function onGetClosestTargetLeave(ret) {
    if (flags.aimEnabled) {
        try {
            if (!ret.isNull()) {
                const fns = getFunctions();
                const data = fns.LogicGameObjectClient_getData(ret);
                if (data && !data.isNull() && getBrawlerName(data, false)) {
                    return ptr(0);
                }
            }
        } catch (_) {}
    }
    if (flags.xrayEnabled && xraySelectedGid !== 0) {
        const o = findXrayTargetObject();
        if (o) return o;
    }
    return ret;
}

// JirGear ball assist (ic): aim the ball toward the chosen wall point.
export function ballAssist(bm) {
    if (!flags.ballAssistEnabled || !bm || bm.isNull() || !battleScreenPtr || battleScreenPtr.isNull() || !battleModeClientPtr || battleModeClientPtr.isNull()) return;
    const now = Date.now();
    if (now - lastBallAssistMs < 200) return;
    try {
        const fns = getFunctions();
        const ownChar = fns.LogicBattleModeClient_getOwnCharacter(bm);
        if (!ownChar || ownChar.isNull()) return;
        const mgr = bm.add(offsets.LogicBattleModeClient_gameObjectManager).readPointer();
        if (!mgr || mgr.isNull()) return;
        const arr = mgr.add(offsets.LogicGameObjectManagerClient_gameObjectsArray).readPointer();
        if (!arr || arr.isNull()) return;
        const count = mgr.add(offsets.LogicGameObjectManagerClient_gameObjectCount).readU32();
        if (count < 1 || count > 300) return;
        const targetY = ballAssistConfig.target === "bottom" ? 12000 : 1000;
        const targetX = 5000;
        for (let i = 0; i < count; i++) {
            try {
                const obj = arr.add(i * 8).readPointer();
                if (!obj || obj.isNull() || !looksLikeLiveGameObject(obj)) continue;
                const data = fns.LogicGameObjectClient_getData(obj);
                if (!data || data.isNull()) continue;
                const x = fns.LogicGameObjectClient_getX(obj) | 0;
                const y = fns.LogicGameObjectClient_getY(obj) | 0;
                if (x > 2000 && x < 8000 && y > 3000 && y < 11000) {
                    const dx = targetX - x;
                    const dy = targetY - y;
                    const angle = Math.atan2(dy, dx);
                    const sx = (x + Math.cos(angle) * 3000) | 0;
                    const sy = (y + Math.sin(angle) * 3000) | 0;
                    battleScreenPtr.add(3844).writeS32(sx);
                    battleScreenPtr.add(3848).writeS32(sy);
                    battleScreenPtr.add(3692).writeS32(sx);
                    battleScreenPtr.add(3696).writeS32(sy);
                    battleScreenPtr.add(1644).writeS32(0);
                    lastBallAssistMs = now;
                    break;
                }
            } catch (_) {}
        }
    } catch (_) {}
}
