import { offsets } from "./offsets.js";

var base = null;
var _n = null;

function _nf(name, ret, args) {
    const off = offsets[name];
    if (typeof off !== "number" || off <= 0) return null;
    try {
        return new NativeFunction(base.add(off), ret, args);
    } catch (_) {
        return null;
    }
}

function _sys(name, ret, args) {
    try {
        const p = _sysAddr(name);
        return p ? new NativeFunction(p, ret, args) : null;
    } catch (_) {
        return null;
    }
}

function _sysAddr(name) {
    try {
        const p = Module.findGlobalExportByName(name) || Module.findExportByName("libSystem.B.dylib", name) || Module.findExportByName(null, name);
        return p && !p.isNull() ? p : null;
    } catch (_) {
        return null;
    }
}

export function initFunctions(baseIn = Process.mainModule.base) {
    if (_n) return _n;
    base = baseIn;

    const mallocPtr = _sysAddr("malloc");
    const freePtr = _sysAddr("free");

    _n = {
        BattleMode_getInstance: _nf("BattleMode_getInstance", "pointer", []),
        LogicBattleModeClient_update: _nf("LogicBattleModeClient_update", "void", ["pointer", "float"]),
        LogicBattleModeClient_getOwnCharacter: _nf("LogicBattleModeClient_getOwnCharacter", "pointer", ["pointer"]),
        LogicBattleModeClient_getOwnPlayerTeam: _nf("LogicBattleModeClient_getOwnPlayerTeam", "uint32", ["pointer"]),
        LogicBattleModeClient_setClientPredictionMoveTo: _nf("LogicBattleModeClient_setClientPredictionMoveTo", "void", ["pointer", "int32", "int32", "bool"]),

        LogicGameObjectClient_getX: _nf("LogicGameObjectClient_getX", "int32", ["pointer"]),
        LogicGameObjectClient_getY: _nf("LogicGameObjectClient_getY", "int32", ["pointer"]),
        LogicGameObjectClient_getData: _nf("LogicGameObjectClient_getData", "pointer", ["pointer"]),
        LogicGameObjectClient_getGlobalID: _nf("LogicGameObjectClient_getGlobalID", "uint32", ["pointer"]),
        LogicGameObjectManagerClient_findGameObject: _nf("LogicGameObjectManagerClient_findGameObject", "pointer", ["pointer", "int32", "int32"]),

        LogicCharacterClient_getWeaponSkillClient: _nf("LogicCharacterClient_getWeaponSkillClient", "pointer", ["pointer"]),
        LogicCharacterData_getCollisionRadius: _nf("LogicCharacterData_getCollisionRadius", "uint32", ["pointer"]),
        LogicProjectileData_getSpeed: _nf("LogicProjectileData_getSpeed", "uint32", ["pointer"]),
        LogicProjectileData_getRadius: _nf("LogicProjectileData_getRadius", "uint32", ["pointer"]),

        LogicTileMap_getTile: _nf("LogicTileMap_getTile", "pointer", ["pointer", "uint32", "uint32"]),

        ClientInputManager_addInput: _nf("ClientInputManager_addInput", "void", ["pointer", "pointer"]),
        ClientInput_ctor: _nf("ClientInput_ctor", "pointer", ["pointer", "int32"]),

        BattleScreen_updateMovement: _nf("BattleScreen_updateMovement", "void", ["pointer", "pointer", "pointer"]),
        BattleScreen_updateAutoshoot: _nf("BattleScreen_updateAutoshoot", "void", ["pointer", "pointer"]),
        BattleScreen_tryToActivateSkill: _nf("BattleScreen_tryToActivateSkill", "void", ["pointer", "pointer", "pointer", "int32", "int32", "bool", "int32"]),
        BattleScreen_activateSkill: _nf("BattleScreen_activateSkill", "bool", ["int32", "int32", "pointer", "pointer", "bool", "int32"]),
        BattleScreen_getClosestTargetForAutoshoot: _nf("BattleScreen_getClosestTargetForAutoshoot", "pointer", ["pointer", "pointer", "int32", "bool", "bool", "pointer", "bool", "bool"]),

        malloc: mallocPtr ? new NativeFunction(mallocPtr, "pointer", ["size_t"]) : null,
        free: freePtr ? new NativeFunction(freePtr, "void", ["pointer"]) : null,
        memset: _sys("memset", "pointer", ["pointer", "int", "size_t"]),
    };

    Object.freeze(_n);
    return _n;
}

export function getFunctions() {
    if (!_n) throw new Error("Functions not initialized! Call initFunctions(base) first.");
    return _n;
}

export function getBase() {
    if (!base) throw new Error("Functions not initialized! Call initFunctions(base) first.");
    return base;
}