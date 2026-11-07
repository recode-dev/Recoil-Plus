import { offsets } from "./offsets.js";
import { getFunctions, getBase } from "./functions.js";
import { powerupClassIds, powerupNameNeedles } from "../utils/brawlerName.js";
import { flags } from "../utils/flags.js";
import { battleTickUpdate } from "./commands.js";

export const FREE_MODE = true;

export const battleState = {
    ownCharacter: null,
    myX: 0,
    myY: 0,
    myRadius: 60,
    mySpeed: 720,
    myBrawlerId: 0,
    myBrawlerName: null,
    ownTeam: 0,
    myTeamId: 0,
    enemies: [],
    pickups: [],
    projectiles: [],
    lastUpdate: 0
};

export var ballPresent = false;
export var battleScreenPtr = null;
export var battleModeClientPtr = null;
export var xraySelectedGid = 0;

export function setBattleScreenPtr(p) {
    battleScreenPtr = p;
}

export const BRAWLER_NAMES_BY_ID = {
    0: "Shelly",
    1: "Colt",
    2: "Bull",
    3: "Brock",
    4: "Rico",
    5: "Spike",
    6: "Barley",
    7: "Jessie",
    8: "Nita",
    9: "Dynamike",
    10: "El Primo",
    11: "Mortis",
    12: "Crow",
    13: "Poco",
    14: "Bo",
    15: "Piper",
    16: "Pam",
    17: "Tara",
    18: "Darryl",
    19: "Penny",
    20: "Frank",
    21: "Gene",
    22: "Tick",
    23: "Leon",
    24: "Rosa",
    25: "Carl",
    26: "Bibi",
    27: "8-Bit",
    28: "Sandy",
    29: "Bea",
    30: "Emz",
    31: "Mr. P",
    32: "Max",
    34: "Jacky",
    35: "Gale",
    36: "Nani",
    37: "Sprout",
    38: "Surge",
    39: "Colette",
    40: "Amber",
    41: "Lou",
    42: "Byron",
    43: "Edgar",
    44: "Ruffs",
    45: "Stu",
    46: "Squeak",
    47: "Belle",
    48: "Buzz",
    49: "Griff",
    50: "Ash",
    51: "Meg",
    52: "Lola",
    53: "Fang",
    54: "Eve",
    55: "Janet",
    56: "Otis",
    57: "Sam",
    58: "Mandy",
    59: "Gus",
    60: "Buzz Lightyear",
    61: "Charlie",
    62: "Mico",
    63: "Kit",
    64: "Larry And Lawrie",
    65: "Melodie",
    66: "Angelo",
    67: "Berry",
    68: "Clancy",
    69: "Moe",
    70: "Kenji",
    71: "Juju",
    72: "Shade",
    73: "Ollie",
    74: "Lumi",
    75: "Finx",
    76: "Kaze",
    77: "Alli",
    78: "Trunk",
    79: "Gigi",
    80: "Jae",
    81: "Pierce",
    82: "Twins",
    83: "Moe",
    84: "Kenji",
    85: "Juju"
};

export const enemyVelocityTracks = new Map();
export const projectileTrackMap = new Map();

export function looksLikeLiveGameObject(t) {
    try {
        if (!t || t.isNull() || t.readPointer().isNull()) return false;
        const a = t.add(16).readPointer();
        const b = t.add(20).readPointer();
        return !(a.isNull() && b.isNull());
    } catch (_) {
        return false;
    }
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

function readHeroNameFromHeroData(t) {
    try {
        const p = t.add(offsets.LogicData_name).readPointer();
        const s = readCStringSafe(p);
        if (s && s.indexOf("hero_icon_") === 0) return s.substring(10).toUpperCase();
    } catch (_) {}
    return null;
}

export function updateEnemyVelocityTrack(enemy, now) {
    const track = enemyVelocityTracks.get(enemy.gid);
    if (!track) {
        const fresh = { x: enemy.x, y: enemy.y, ts: now, vx: 0, vy: 0, lastSeen: now };
        enemyVelocityTracks.set(enemy.gid, fresh);
        return fresh;
    }
    const dt = now - track.ts;
    if (dt > 0 && dt < 350) {
        const k = 1000 / dt;
        const vx = (enemy.x - track.x) * k;
        const vy = (enemy.y - track.y) * k;
        track.vx = track.vx * 0.65 + vx * 0.35;
        track.vy = track.vy * 0.65 + vy * 0.35;
    }
    track.x = enemy.x;
    track.y = enemy.y;
    track.ts = now;
    track.lastSeen = now;
    return track;
}

export function resetBattleScan() {
    battleState.ownCharacter = null;
    battleState.myX = 0;
    battleState.myY = 0;
    battleState.enemies = [];
    battleState.pickups = [];
    battleState.projectiles = [];
    battleState.lastUpdate = 0;
    enemyVelocityTracks.clear();
    projectileTrackMap.clear();
}

export function updateBattleScan(bm, now) {
    if (!bm || bm.isNull()) return;
    battleModeClientPtr = bm;

    battleTickUpdate(now);

    const fns = getFunctions();
    const own = fns.LogicBattleModeClient_getOwnCharacter(bm);
    if (own && !own.isNull() && looksLikeLiveGameObject(own)) {
        battleState.ownCharacter = own;
        battleState.myX = fns.LogicGameObjectClient_getX(own);
        battleState.myY = fns.LogicGameObjectClient_getY(own);
        try {
            const data = fns.LogicGameObjectClient_getData(own);
            if (data && !data.isNull()) {
                const radius = fns.LogicCharacterData_getCollisionRadius(data) | 0;
                if (radius >= 20 && radius <= 220) battleState.myRadius = radius;
                const speed = data.add(offsets.LogicCharacterData_speed).readU32();
                if (speed >= 300 && speed <= 2500) battleState.mySpeed = speed;
                try {
                    const cls = data.add(offsets.LogicCharacterData_characterClassId).readU32();
                    battleState.myBrawlerId = cls;
                    const namePtr = data.add(offsets.LogicData_name).readPointer();
                    if (namePtr && !namePtr.isNull()) {
                        const s = namePtr.readCString();
                        if (s && s.indexOf("hero_icon_") === 0) battleState.myBrawlerName = s.substring(10).toUpperCase();
                    }
                } catch (_) {}
            }
        } catch (_) {}
    }
    const team = fns.LogicBattleModeClient_getOwnPlayerTeam(bm);
    battleState.myTeamId = team;
    battleState.ownTeam = team;

    const objMgr = bm.add(offsets.LogicBattleModeClient_gameObjectManager).readPointer();
    if (!objMgr || objMgr.isNull()) return;
    const objArray = objMgr.add(offsets.LogicGameObjectManagerClient_gameObjectsArray).readPointer();
    if (!objArray || objArray.isNull()) return;
    const count = objMgr.add(offsets.LogicGameObjectManagerClient_gameObjectCount).readU32();
    if (count === 0 || count > 1200) return;

    const enemies = [];
    const pickups = [];
    const projectiles = [];
    const projVtable = getBase().add(offsets.vtable_LogicProjectileData);

    ballPresent = false;
    for (let i = 0; i < count; i++) {
        try {
            const obj = objArray.add(i * 8).readPointer();
            if (!obj || obj.isNull() || obj.equals(own) || !looksLikeLiveGameObject(obj)) continue;
            let objTeam = 4294967295;
            let dead = false;
            try {
                objTeam = obj.add(offsets.LogicGameObjectClient_currentTeamIndex).readU32();
            } catch (_) {}
            try {
                dead = obj.add(offsets.LogicGameObjectClient_state).readU32() !== 0;
            } catch (_) {}
            const data = fns.LogicGameObjectClient_getData(obj);
            if (!data || data.isNull() || dead) continue;
            try {
                if (data.readPointer().equals(projVtable)) {
                    if (objTeam === team) continue;
                    const gid = fns.LogicGameObjectClient_getGlobalID(obj);
                    const px = fns.LogicGameObjectClient_getX(obj);
                    const py = fns.LogicGameObjectClient_getY(obj);
                    const track = projectileTrackMap.get(gid);
                    if (!track) {
                        projectileTrackMap.set(gid, { x: px, y: py, ts: now, vx: 0, vy: 0, lastSeen: now });
                    } else {
                        const dt = now - track.ts;
                        if (dt > 0 && dt < 250) {
                            const k = 1000 / dt;
                            track.vx = (px - track.x) * k;
                            track.vy = (py - track.y) * k;
                        }
                        track.x = px;
                        track.y = py;
                        track.ts = now;
                        track.lastSeen = now;
                    }
                    let speed = 1200;
                    let radius = 8;
                    let spawnAngle = null;
                    try {
                        speed = fns.LogicProjectileData_getSpeed(data) || speed;
                    } catch (_) {}
                    try {
                        radius = fns.LogicProjectileData_getRadius(data) || radius;
                    } catch (_) {}
                    try {
                        const a = obj.add(184).readFloat();
                        if (isFinite(a)) spawnAngle = a;
                    } catch (_) {}
                    projectiles.push({ gid: gid, x: px, y: py, speed: speed, radius: radius, spawnAngle: spawnAngle });
                    continue;
                }
            } catch (_) {}
            let brawlerId = -1;
            try {
                brawlerId = data.add(offsets.LogicCharacterData_characterClassId).readU32();
            } catch (_) {
                continue;
            }
            if (objTeam === team) continue;
            let name = BRAWLER_NAMES_BY_ID[brawlerId] || null;
            if (!name) name = readHeroNameFromHeroData(data);
            if (!name) {
                try {
                    const px = fns.LogicGameObjectClient_getX(obj);
                    const py = fns.LogicGameObjectClient_getY(obj);
                    const dx = px - battleState.myX;
                    const dy = py - battleState.myY;
                    if (dx * dx + dy * dy < 48400) ballPresent = true;
                    pickups.push({ gid: fns.LogicGameObjectClient_getGlobalID(obj), name: "non-brawler", x: px, y: py });
                } catch (_) {}
                continue;
            }
            let collisionRadius = 60;
            try {
                const cr = fns.LogicCharacterData_getCollisionRadius(data) | 0;
                if (cr >= 30 && cr <= 180) collisionRadius = cr;
            } catch (_) {}
            enemies.push({
                gid: fns.LogicGameObjectClient_getGlobalID(obj),
                name: name,
                ptr: obj,
                x: fns.LogicGameObjectClient_getX(obj),
                y: fns.LogicGameObjectClient_getY(obj),
                brawlerId: brawlerId,
                brawlerName: name || BRAWLER_NAMES_BY_ID[brawlerId] || null,
                collisionRadius: collisionRadius,
                isBrawler: true,
                isProjectile: false
            });
        } catch (_) {}
    }

    if (!ballPresent) {
        for (let i = 0; i < count; i++) {
            try {
                const obj = objArray.add(i * 8).readPointer();
                if (!obj || obj.isNull() || obj.equals(own)) continue;
                const px = fns.LogicGameObjectClient_getX(obj);
                const py = fns.LogicGameObjectClient_getY(obj);
                const dx = px - battleState.myX;
                const dy = py - battleState.myY;
                if (dx * dx + dy * dy < 8100) {
                    ballPresent = true;
                    break;
                }
            } catch (_) {}
        }
    }
    if (!ballPresent) {
        for (let i = 0; i < pickups.length; i++) {
            const p = pickups[i];
            const dx = p.x - battleState.myX;
            const dy = p.y - battleState.myY;
            if (dx * dx + dy * dy < 280 * 280) {
                ballPresent = true;
                break;
            }
        }
    }

    battleState.enemies = enemies;
    battleState.pickups = pickups;
    battleState.projectiles = projectiles;
    battleState.lastUpdate = now;

    if (flags.xrayEnabled && xraySelectedGid !== 0) {
        let found = false;
        for (let i = 0; i < enemies.length; i++) {
            if ((enemies[i].gid | 0) === (xraySelectedGid | 0)) {
                found = true;
                break;
            }
        }
        if (!found) {
            xraySelectedGid = 0;
            flags.xrayEnabled = false;
        }
    }

    for (let i = 0; i < enemies.length; i++) updateEnemyVelocityTrack(enemies[i], now);
    for (const [gid, track] of enemyVelocityTracks) {
        if (now - track.lastSeen > 2000) enemyVelocityTracks.delete(gid);
    }
    for (const [gid, track] of projectileTrackMap) {
        if (now - track.lastSeen > 2000) projectileTrackMap.delete(gid);
    }
}
