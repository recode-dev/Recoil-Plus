import { offsets } from "../core/offsets.js";
import { getFunctions } from "../core/functions.js";
import { battleState, enemyVelocityTracks, ballPresent, FREE_MODE, PROJECTILE_SPEED_BY_BRAWLER_ID, DEFAULT_RANGE_BY_BRAWLER_ID, RANGE_BY_BRAWLER_NAME, powerupClassIds } from "../core/scan.js";
import { getCollisionMap, raycastTilesClear } from "../utils/walls.js";

export const aimbotConfig = {
    enabled: true,
    predictEnabled: true,
    projectileSpeed: 3200,
    leadScale: 1,
    maxRange: 9000,
    reactionMs: 0,
    targetMode: "NEAR"
};

export function setAimbotOptions(opts = {}) {
    if (typeof opts.enabled === "boolean") aimbotConfig.enabled = opts.enabled;
    if (typeof opts.predictEnabled === "boolean") aimbotConfig.predictEnabled = opts.predictEnabled;
    if (typeof opts.projectileSpeed === "number") aimbotConfig.projectileSpeed = opts.projectileSpeed | 0;
    if (typeof opts.leadScale === "number") aimbotConfig.leadScale = opts.leadScale;
    if (typeof opts.maxRange === "number") aimbotConfig.maxRange = opts.maxRange | 0;
    if (typeof opts.reactionMs === "number") aimbotConfig.reactionMs = opts.reactionMs | 0;
    if (opts.targetMode === "NEAR" || opts.targetMode === "FAST" || opts.targetMode === "LOWID") aimbotConfig.targetMode = opts.targetMode;
}

export var lastAimFireMs = 0;

export function resetAimbot() {
    lastAimFireMs = 0;
}

export function getCurrentAttackRange() {
    return battleState.myBrawlerName && RANGE_BY_BRAWLER_NAME[battleState.myBrawlerName] || DEFAULT_RANGE_BY_BRAWLER_ID[battleState.myBrawlerId] || aimbotConfig.maxRange;
}

function predictEnemyPosition(myX, myY, enemy, projectileSpeed) {
    const track = enemyVelocityTracks.get(enemy.gid);
    if (!aimbotConfig.predictEnabled || !track) {
        return { x: enemy.x, y: enemy.y };
    }
    let t = Math.sqrt((enemy.x - myX) * (enemy.x - myX) + (enemy.y - myY) * (enemy.y - myY)) / Math.max(500, projectileSpeed || aimbotConfig.projectileSpeed || 3200);
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

function distancePointToSegmentSq(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const fx = px - ax;
    const fy = py - ay;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 0 ? (fx * dx + fy * dy) / lenSq : 0;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    const cx = ax + dx * t;
    const cy = ay + dy * t;
    const ex = px - cx;
    const ey = py - cy;
    return ex * ex + ey * ey;
}

export function lineBlockedByBallOrWall(fromX, fromY, toX, toY) {
    try {
        if (getCollisionMap()) return !raycastTilesClear(fromX, fromY, toX, toY, 64);
    } catch (_) {}
    try {
        const pickups = battleState.pickups || [];
        for (let i = 0; i < pickups.length; i++) {
            const p = pickups[i];
            if (p && distancePointToSegmentSq(p.x, p.y, fromX, fromY, toX, toY) < 52900) return true;
        }
    } catch (_) {}
    return false;
}

export function isTargetAllowed(target) {
    if (!target) return false;
    const noBall = FREE_MODE ? true : true;
    const noWall = FREE_MODE ? true : true;
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

export function onFireEnter(args) {
    if (!aimbotConfig.enabled) return;
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
        if (!isFinite(aim.x) || !isFinite(aim.y)) return;
        bs.add(offsets.BattleScreen_shootStickX).writeS32(aim.x | 0);
        bs.add(offsets.BattleScreen_shootStickY).writeS32(aim.y | 0);
        args[3] = ptr(aim.x | 0);
        args[4] = ptr(aim.y | 0);
    } catch (_) {}
}

export function onActivateSkillEnter(args) {
    if (!aimbotConfig.enabled) return;
    try {
        const bs = args[0];
        const target = selectBestTarget(getCurrentAttackRange());
        if (!target) return;
        const aim = getAimPoint(target);
        const now = Date.now();
        if (aimbotConfig.reactionMs > 0 && now - lastAimFireMs < aimbotConfig.reactionMs) return;
        lastAimFireMs = now;
        if (!isFinite(aim.x) || !isFinite(aim.y)) return;
        if (bs && !bs.isNull()) {
            bs.add(offsets.BattleScreen_shootStickX).writeS32(aim.x | 0);
            bs.add(offsets.BattleScreen_shootStickY).writeS32(aim.y | 0);
        }
        args[1] = ptr(aim.x | 0);
        args[2] = ptr(aim.y | 0);
    } catch (_) {}
}

export function onGetClosestTargetLeave(ret) {
    if (!aimbotConfig.enabled) return ret;
    try {
        if (!ret.isNull()) {
            const fns = getFunctions();
            const data = fns.LogicGameObjectClient_getData(ret);
            if (data && !data.isNull()) {
                let isPickup = false;
                try {
                    if (powerupClassIds.has(data.add(offsets.LogicCharacterData_characterClassId).readU32())) isPickup = true;
                } catch (_) {}
                if (!isPickup) {
                    try {
                        const name = data.add(offsets.LogicData_name).readPointer().readCString();
                        if (name && (name.toUpperCase().indexOf("BOXPICKUP") >= 0 || name.toUpperCase().indexOf("POWERUP") >= 0)) isPickup = true;
                    } catch (_) {}
                }
                if (isPickup) return ptr(0);
            }
        }
    } catch (_) {}
    return ret;
}
