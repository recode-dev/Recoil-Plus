import { offsets } from "../core/offsets.js";
import { getFunctions } from "../core/functions.js";
import { battleState, enemyVelocityTracks, xraySelectedGid } from "../core/scanner.js";
import { selectBestTarget } from "./aimbot.js";
import { moveToPoint } from "../core/commands.js";
import { flags } from "../utils/flags.js";

// JirGear follow/spin module (ported into the antiafk slot to keep the file set).

export const followConfig = {
    distance: 1200,
    mode: "enemy",
    antiAfkEnabled: false,
    antiAfkIntervalMs: 2200
};

export const spinConfig = {
    speed: Math.PI / 4,
    radius: 25,
    rotationMode: "360"
};

export function setFollowOptions(opts = {}) {
    if (typeof opts.enabled === "boolean") flags.followEnabled = opts.enabled;
    if (typeof opts.distance === "number") followConfig.distance = Math.max(opts.distance | 0, 500);
    if (opts.mode === "enemy" || opts.mode === "teammate") followConfig.mode = opts.mode;
    if (typeof opts.antiAfkEnabled === "boolean") followConfig.antiAfkEnabled = opts.antiAfkEnabled;
    if (typeof opts.antiAfkIntervalMs === "number") followConfig.antiAfkIntervalMs = Math.max(opts.antiAfkIntervalMs | 0, 500);
}

export function setSpinOptions(opts = {}) {
    if (typeof opts.enabled === "boolean") flags.spinEnabled = opts.enabled;
    if (typeof opts.speed === "number") spinConfig.speed = opts.speed;
    if (typeof opts.radius === "number") spinConfig.radius = opts.radius | 0;
    if (opts.rotationMode === "SWING" || opts.rotationMode === "360") spinConfig.rotationMode = opts.rotationMode;
}

export const followVelocityMap = new Map();

var spinAngle = 0;
var lastSpinMs = 0;
var lastFollowMs = 0;
var lastFollowAntiAfkMs = 0;
var followAntiAfkToggle = false;

export function resetAntiAfk() {
    spinAngle = 0;
    lastSpinMs = 0;
    lastFollowMs = 0;
    lastFollowAntiAfkMs = 0;
    followAntiAfkToggle = false;
    followVelocityMap.clear();
}

// JirGear applySpinMovement, exact port.
export function applySpinMovement(bm) {
    if (!flags.spinEnabled || !bm || bm.isNull() || battleState.lastUpdate === 0) return false;
    try {
        const now = Date.now();
        if (now - lastSpinMs < 50) return false;
        lastSpinMs = now;
        spinAngle += spinConfig.speed || Math.PI / 4;
        if (spinAngle >= Math.PI * 2) spinAngle -= Math.PI * 2;
        const radius = Math.max(8, Math.min(spinConfig.radius || 25, 80));
        let x = battleState.myX | 0;
        let y = battleState.myY | 0;
        if (spinConfig.rotationMode === "SWING") {
            x = Math.round(battleState.myX + Math.sin(spinAngle) * radius);
        } else {
            x = Math.round(battleState.myX + Math.cos(spinAngle) * radius);
            y = Math.round(battleState.myY + Math.sin(spinAngle) * radius);
        }
        return moveToPoint(bm, x, y);
    } catch (_) {
        return false;
    }
}

// JirGear getFollowTargetPoint, exact port.
export function getFollowTargetPoint() {
    if (!flags.followEnabled || !battleState.enemies || battleState.enemies.length === 0) return null;
    let target = null;
    if (flags.xrayEnabled) {
        for (let i = 0; i < battleState.enemies.length; i++) {
            if ((battleState.enemies[i].gid | 0) === (xraySelectedGid | 0)) {
                target = battleState.enemies[i];
                break;
            }
        }
    }
    if (!target) target = selectBestTarget(0);
    if (!target) return null;
    const dx = target.x - battleState.myX;
    const dy = target.y - battleState.myY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= Math.max(100, followConfig.distance)) return null;
    const inv = 1 / Math.max(1, dist);
    return {
        x: Math.round(target.x - dx * inv * followConfig.distance),
        y: Math.round(target.y - dy * inv * followConfig.distance)
    };
}

// JirGear findClosestVisibleObjectForTeam, exact port (v69 offset binding).
export function findClosestVisibleObjectForTeam(bm, ownChar, ownTeam, now) {
    try {
        const fns = getFunctions();
        const mgr = bm.add(offsets.LogicBattleModeClient_gameObjectManager).readPointer();
        if (!mgr || mgr.isNull()) return null;
        const arr = mgr.add(offsets.LogicGameObjectManagerClient_gameObjectsArray).readPointer();
        if (!arr || arr.isNull()) return null;
        const count = mgr.add(offsets.LogicGameObjectManagerClient_gameObjectCount).readU32() | 0;
        let best = null;
        let bestDist = 1 / 0;
        for (let i = 0; i < count; i++) {
            try {
                const obj = arr.add(i * 8).readPointer();
                if (!obj || obj.isNull() || (ownChar && !ownChar.isNull() && obj.equals(ownChar))) continue;
                const data = fns.LogicGameObjectClient_getData(obj);
                if (!data || data.isNull()) continue;
                if ((obj.add(offsets.LogicGameObjectClient_currentTeamIndex).readU32() | 0) !== (ownTeam | 0)) continue;
                if (obj.add(offsets.LogicGameObjectClient_state).readU32() !== 0) continue;
                const x = fns.LogicGameObjectClient_getX(obj);
                const y = fns.LogicGameObjectClient_getY(obj);
                const gid = fns.LogicGameObjectClient_getGlobalID(obj);
                const dx = x - battleState.myX;
                const dy = y - battleState.myY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                let track = followVelocityMap.get(gid);
                if (!track) {
                    track = { x: x, y: y, ts: now, vx: 0, vy: 0, lastSeen: now };
                    followVelocityMap.set(gid, track);
                } else {
                    const dt = now - track.ts;
                    if (dt > 0 && dt < 300) {
                        const k = 1000 / dt;
                        track.vx = (x - track.x) * k;
                        track.vy = (y - track.y) * k;
                    }
                    track.x = x;
                    track.y = y;
                    track.ts = now;
                    track.lastSeen = now;
                }
                if (dist < bestDist) {
                    bestDist = dist;
                    best = { gid: gid, x: x, y: y };
                }
            } catch (_) {}
        }
        for (const [gid, track] of followVelocityMap) {
            if (now - track.lastSeen > 3000) followVelocityMap.delete(gid);
        }
        return best;
    } catch (_) {
        return null;
    }
}

// JirGear collectEnemiesAndPickups (follow, with anti-AFK inside), exact port.
export function collectEnemiesAndPickups(bm) {
    if (!flags.followEnabled || !bm || bm.isNull()) return false;
    try {
        const now = Date.now();
        if (now - lastFollowMs < 25) return false;
        lastFollowMs = now;
        const ownChar = battleState.ownCharacter;
        const ownTeam = battleState.ownTeam | 0;
        let target = null;
        if (followConfig.mode === "enemy") {
            if (flags.xrayEnabled) {
                for (let i = 0; i < battleState.enemies.length; i++) {
                    if ((battleState.enemies[i].gid | 0) === (xraySelectedGid | 0)) {
                        target = battleState.enemies[i];
                        break;
                    }
                }
            }
            if (!target) target = selectBestTarget(0);
        } else {
            target = findClosestVisibleObjectForTeam(bm, ownChar, ownTeam, now);
        }
        if (!target) return false;
        let vx = 0;
        let vy = 0;
        try {
            const track = followConfig.mode === "enemy" ? enemyVelocityTracks.get(target.gid) : followVelocityMap.get(target.gid);
            if (track) {
                vx = track.vx || 0;
                vy = track.vy || 0;
            }
        } catch (_) {}
        const lead = Math.max(0.04, Math.min(0.55, (followConfig.distance | 0) / 3000));
        const fx = target.x + vx * lead;
        const fy = target.y + vy * lead;
        if (followConfig.antiAfkEnabled && now - lastFollowAntiAfkMs >= Math.max(1500, followConfig.antiAfkIntervalMs | 0)) {
            lastFollowAntiAfkMs = now;
            followAntiAfkToggle = !followAntiAfkToggle;
            const delta = followAntiAfkToggle ? 10 : -10;
            return moveToPoint(bm, (battleState.myX | 0) + delta, (battleState.myY | 0) - delta);
        }
        const dx = fx - battleState.myX;
        const dy = fy - battleState.myY;
        if (Math.sqrt(dx * dx + dy * dy) <= 25) return false;
        return moveToPoint(bm, Math.round(fx), Math.round(fy));
    } catch (_) {
        return false;
    }
}
