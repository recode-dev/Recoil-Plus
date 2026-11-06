import { offsets } from "./offsets.js";
import { getFunctions } from "./functions.js";

var base = null;
var prevEnemyPos = new Map();

export var scanData = {
    battleMode: null,
    ownCharacter: null,
    weaponSkill: null,
    myTeamId: 0,
    myX: 0,
    myY: 0,
    myRadius: 60,
    mySpeed: 720,
    enemies: [],
    projectiles: [],
    lastUpdate: 0
};

export function initScanner(baseIn = Process.mainModule.base) {
    base = baseIn;
    prevEnemyPos.clear();
}

export function resetScanner() {
    scanData.battleMode = null;
    scanData.ownCharacter = null;
    scanData.weaponSkill = null;
    scanData.enemies = [];
    scanData.projectiles = [];
    scanData.lastUpdate = 0;
    prevEnemyPos.clear();
}

export function updateScanner(bm, now = Date.now()) {
    if (!base || !bm || bm.isNull()) return false;

    const fns = getFunctions();
    const own = fns.LogicBattleModeClient_getOwnCharacter(bm);
    if (!own || own.isNull()) {
        resetScanner();
        return false;
    }

    const dt = scanData.lastUpdate > 0 ? Math.max(0.016, (now - scanData.lastUpdate) / 1000) : 0.016;

    scanData.battleMode = bm;
    scanData.ownCharacter = own;
    scanData.myTeamId = fns.LogicBattleModeClient_getOwnPlayerTeam(bm);
    scanData.myX = fns.LogicGameObjectClient_getX(own);
    scanData.myY = fns.LogicGameObjectClient_getY(own);
    scanData.weaponSkill = fns.LogicCharacterClient_getWeaponSkillClient(own);

    const ownData = fns.LogicGameObjectClient_getData(own);
    if (ownData && !ownData.isNull()) {
        scanData.myRadius = fns.LogicCharacterData_getCollisionRadius(ownData) || 60;
        try {
            scanData.mySpeed = ownData.add(offsets.LogicCharacterData_speed).readS32() || 720;
        } catch (_) {
            scanData.mySpeed = 720;
        }
    }

    const objMgr = bm.add(offsets.LogicBattleModeClient_gameObjectManager).readPointer();
    if (!objMgr || objMgr.isNull()) return false;

    const count = objMgr.add(offsets.LogicGameObjectManagerClient_gameObjectCount).readU32();
    const objArray = objMgr.readPointer();
    if (!objArray || objArray.isNull() || count <= 0 || count > 1200) {
        scanData.enemies = [];
        scanData.projectiles = [];
        return false;
    }

    const enemies = [];
    const projectiles = [];
    const charVtable = base.add(offsets.vtable_LogicCharacterData);
    const projVtable = base.add(offsets.vtable_LogicProjectileData);

    for (let i = 0; i < count; i++) {
        try {
            const obj = objArray.add(i * 8).readPointer();
            if (!obj || obj.isNull() || obj.equals(own)) continue;

            const team = obj.add(offsets.LogicGameObjectClient_currentTeamIndex).readU32();
            if (team === scanData.myTeamId) continue;

            const data = fns.LogicGameObjectClient_getData(obj);
            if (!data || data.isNull()) continue;

            const vt = data.readPointer();

            if (vt.equals(charVtable)) {
                const stateFlags = obj.add(offsets.LogicGameObjectClient_state).readU32();
                const isDead = (stateFlags & 1) !== 0;
                if (isDead) continue;

                const gid = fns.LogicGameObjectClient_getGlobalID(obj);
                const ex = fns.LogicGameObjectClient_getX(obj);
                const ey = fns.LogicGameObjectClient_getY(obj);
                const dx = ex - scanData.myX;
                const dy = ey - scanData.myY;
                const distSq = dx * dx + dy * dy;

                let vx = 0;
                let vy = 0;
                const prev = prevEnemyPos.get(gid);
                if (prev) {
                    vx = (ex - prev.x) / dt;
                    vy = (ey - prev.y) / dt;
                }
                prevEnemyPos.set(gid, { x: ex, y: ey, ts: now });

                enemies.push({
                    gid: gid,
                    ptr: obj,
                    data: data,
                    x: ex,
                    y: ey,
                    vx: vx,
                    vy: vy,
                    distSq: distSq,
                    dist: Math.sqrt(distSq),
                    isImmune: (stateFlags & 0x20) !== 0
                });
            } else if (vt.equals(projVtable)) {
                const px = fns.LogicGameObjectClient_getX(obj);
                const py = fns.LogicGameObjectClient_getY(obj);
                const toPlayerX = scanData.myX - px;
                const toPlayerY = scanData.myY - py;
                const distSq = toPlayerX * toPlayerX + toPlayerY * toPlayerY;

                let speed = 2500;
                let radius = 100;
                try {
                    speed = fns.LogicProjectileData_getSpeed(data) || 2500;
                    radius = fns.LogicProjectileData_getRadius(data) || 100;
                } catch (_) {}

                const rawAngle = obj.add(offsets.Projectile_getAngle).readI32();
                const rad = (rawAngle * Math.PI) / 180;

                projectiles.push({
                    ptr: obj,
                    data: data,
                    x: px,
                    y: py,
                    toPlayerX: toPlayerX,
                    toPlayerY: toPlayerY,
                    distSq: distSq,
                    speed: speed,
                    radius: radius,
                    angle: rawAngle,
                    rad: rad,
                    vx: Math.cos(rad) * speed,
                    vy: Math.sin(rad) * speed
                });
            }
        } catch (_) {}
    }

    scanData.enemies = enemies;
    scanData.projectiles = projectiles;
    scanData.lastUpdate = now;
    return true;
}