import { offsets } from "./offsets.js";
import { getFunctions, getBase } from "./functions.js";

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

export function setBattleScreenPtr(p) {
    battleScreenPtr = p;
}

export const powerupClassIds = new Set([171, 172, 173, 174, 175, 176, 177, 179]);
export const powerupNameNeedles = ["BOXPICKUPSPEEDUP", "BOXPICKUPHEALTHUP", "BOXPICKUPSHIELD", "BOXPICKUPDAMAGEUP", "BOXPICKUPBOULDER", "BOXPICKUPSHURIKEN", "BOXPICKUPSPEEDER", "BOXPICKUPBOMB", "POWERUPCRATE", "POWERUPSPAWN"];

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

export const DEFAULT_RANGE_BY_BRAWLER_ID = {
    0: 2800,
    1: 3300,
    2: 2000,
    3: 3300,
    4: 3500,
    5: 2800,
    6: 2700,
    7: 3300,
    8: 2200,
    9: 2700,
    10: 1100,
    11: 1000,
    12: 3200,
    13: 2600,
    14: 3200,
    15: 3700,
    16: 3300,
    17: 2900,
    18: 2200,
    19: 3200,
    20: 2200,
    21: 2100,
    22: 3200,
    23: 3500,
    24: 1300,
    25: 3100,
    26: 1300,
    27: 3700,
    28: 2200,
    29: 3700,
    30: 2400,
    31: 2600,
    32: 3100,
    34: 1200,
    35: 3100,
    36: 3200,
    37: 1800,
    38: 2400,
    39: 3200,
    40: 3100,
    41: 3400,
    42: 3700,
    43: 700,
    44: 3300,
    45: 2800,
    46: 3700,
    47: 2800,
    48: 2800,
    49: 1000,
    50: 3100,
    51: 1700,
    52: 3300,
    53: 3300,
    54: 1000,
    56: 3400,
    57: 1500,
    58: 3300,
    59: 3300,
    60: 1100,
    61: 3400,
    62: 2000,
    63: 3100,
    64: 3300,
    65: 3300,
    67: 2700,
    68: 3200,
    69: 1200,
    70: 2000,
    71: 1200,
    72: 3300,
    73: 2400,
    74: 3300,
    75: 1500,
    76: 1300,
    77: 2700,
    78: 2900,
    79: 3700,
    80: 1500,
    81: 700,
    82: 2300,
    83: 2800,
    84: 1800,
    85: 1000,
    86: 1300,
    87: 2300,
    88: 2800,
    89: 2300,
    90: 2900,
    91: 3100,
    92: 3100,
    93: 1000,
    94: 200,
    95: 1200,
    98: 3700,
    99: 1200
};

export const PROJECTILE_SPEED_BY_BRAWLER_ID = {
    0: 3100,
    1: 4000,
    2: 2853,
    3: 2700,
    4: 3478,
    5: 2174,
    6: 1750,
    7: 2870,
    8: 2718,
    9: 1900,
    10: 3261,
    12: 3261,
    13: 2500,
    14: 2800,
    15: 4000,
    16: 4130,
    17: 3152,
    18: 4000,
    19: 3400,
    20: 5000,
    21: 3200,
    23: 3500,
    24: 5000,
    25: 3000,
    27: 4500,
    28: 3500,
    29: 3255,
    30: 1500,
    31: 3000,
    32: 4000,
    35: 3000,
    36: 4000,
    37: 1700,
    38: 3500,
    39: 4000,
    40: 3500,
    41: 4000,
    42: 4000,
    43: 3500,
    44: 3800,
    45: 3300,
    46: 4000,
    47: 4000,
    49: 4000,
    50: 3100,
    51: 5000,
    52: 4000,
    53: 4500,
    54: 3200,
    56: 3500,
    57: 3650,
    58: 3800,
    59: 3600,
    60: 5000,
    61: 4000,
    62: 4200,
    63: 3300,
    64: 3804,
    65: 3800,
    67: 1750,
    68: 3000,
    70: 3800,
    72: 4000,
    73: 1750,
    74: 4200,
    77: 2000,
    78: 4500,
    79: 4000,
    80: 3800,
    81: 3500,
    82: 2200,
    83: 3500,
    84: 2800,
    87: 1750,
    88: 3000,
    89: 3000,
    90: 3500,
    91: 3000,
    92: 3700,
    98: 4000
};

export const RANGE_BY_BRAWLER_NAME = {
    "8-BIT": 3700,
    ALLI: 200,
    AMBER: 3100,
    ANGELO: 3700,
    ASH: 1700,
    BARLEY: 2700,
    BEA: 3700,
    BELLE: 3700,
    BERRY: 2300,
    BIBI: 1300,
    BO: 3200,
    BONNIE: 3300,
    BROCK: 3300,
    BULL: 2000,
    BUSTER: 2000,
    BUZZ: 1000,
    BYRON: 3700,
    CARL: 3100,
    CHARLIE: 3300,
    CHESTER: 3100,
    CHUCK: 2400,
    CLANCY: 2800,
    COLETTE: 3200,
    COLT: 3300,
    CORDELIUS: 2000,
    CROW: 3200,
    DARRYL: 2200,
    DOUG: 1200,
    DRACO: 1500,
    DYNAMIKE: 2700,
    EDGAR: 700,
    EL_PRIMO: 1100,
    EMZ: 2400,
    EVE: 3400,
    FANG: 1000,
    FINX: 3100,
    FRANK: 2200,
    GALE: 3100,
    GENE: 2100,
    GIGI: 1200,
    GRAY: 3300,
    GRIFF: 3100,
    GROM: 2800,
    GUS: 3400,
    HANK: 1200,
    JACKY: 1200,
    JAE: 3100,
    JANET: 1500,
    JESSIE: 3300,
    JUJU: 2300,
    KAZE: 1000,
    KENJI: 1000,
    KIT: 1300,
    LARRY_AND_LAWRIE: 2700,
    LEON: 3500,
    LILY: 700,
    LOLA: 3300,
    LOU: 3400,
    LUMI: 2900,
    MAISIE: 3200,
    MANDY: 3300,
    MAX: 3100,
    MEEPLE: 2800,
    MEG: 3300,
    MELODIE: 2900,
    MICO: 1500,
    MOE: 1800,
    MORTIS: 1000,
    MR_P: 2600,
    NANI: 3200,
    NITA: 2200,
    OLLIE: 2300,
    OTIS: 3300,
    PAM: 3300,
    PEARL: 3300,
    PENNY: 3200,
    PIERCE: 3700,
    PIPER: 3700,
    POCO: 2600,
    RICO: 3500,
    ROSA: 1300,
    RUFFS: 3300,
    SAM: 1100,
    SANDY: 2200,
    SHADE: 1300,
    SHELLY: 2800,
    SPIKE: 2800,
    SPROUT: 1800,
    SQUEAK: 2800,
    STU: 2800,
    SURGE: 2400,
    TARA: 2900,
    TICK: 3200,
    TRUNK: 1200,
    WILLOW: 2700
};

export const enemyVelocityTracks = new Map();
export const projectileTrackMap = new Map();

function looksLikeLiveGameObject(t) {
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

function updateEnemyVelocityTrack(enemy, now) {
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
                    battleState.myBrawlerName = readHeroNameFromHeroData(data);
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
    const charVtable = getBase().add(offsets.vtable_LogicCharacterData);
    ballPresent = false;
    for (let i = 0; i < count; i++) {
        try {
            const obj = objArray.add(i * 8).readPointer();
            if (!obj || obj.isNull() || obj.equals(own) || !looksLikeLiveGameObject(obj)) continue;
            const objTeam = obj.add(offsets.LogicGameObjectClient_currentTeamIndex).readU32();
            const state = obj.add(offsets.LogicGameObjectClient_state).readU32();
            const data = fns.LogicGameObjectClient_getData(obj);
            if (!data || data.isNull()) continue;
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
            if ((state & 1) !== 0) continue;
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
                brawlerName: name,
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
    for (let i = 0; i < enemies.length; i++) updateEnemyVelocityTrack(enemies[i], now);
    for (const [gid, track] of enemyVelocityTracks) {
        if (now - track.lastSeen > 2000) enemyVelocityTracks.delete(gid);
    }
    for (const [gid, track] of projectileTrackMap) {
        if (now - track.lastSeen > 2000) projectileTrackMap.delete(gid);
    }
}
