// ScString (Supercell String) helpers — verified against v69_252 darwin arm64.
// Layout: +0x4 length (int32), +0x8 data (SSO inline buffer when length <= 7,
// heap pointer otherwise). String ctor: String_String (see uiOffsets in ui/native.js).

export const SCSTRING_OFFSETS = Object.freeze({
    length: 0x4,
    data: 0x8
});

export const SCSTRING_INLINE_MAX = 7;

const _pinned = [];

function _pin(size) {
    try {
        const p = Memory.alloc(size);
        p.writeByteArray(new Uint8Array(size));
        _pinned.push(p);
        return p;
    } catch (_) {
        return NULL;
    }
}

let _stringCtor = null;

export function setStringCtor(ctor) {
    _stringCtor = ctor;
}

export function readScString(ptr) {
    try {
        if (!ptr || ptr.isNull()) return null;
        const len = ptr.add(SCSTRING_OFFSETS.length).readU32();
        if (len === 0 || len > 1024) return null;
        const dataField = ptr.add(SCSTRING_OFFSETS.data);
        const data = len <= SCSTRING_INLINE_MAX ? dataField : dataField.readPointer();
        if (!data || data.isNull()) return null;
        const s = data.readCString();
        return s || null;
    } catch (_) {
        return null;
    }
}

export function makeScString(str) {
    const sc = _pin(32);
    if (sc && !sc.isNull() && _stringCtor) {
        try {
            _stringCtor(sc, _pinUtf8(str));
        } catch (_) {}
    }
    return sc;
}

function _pinUtf8(str) {
    try {
        const p = Memory.allocUtf8String(str);
        _pinned.push(p);
        return p;
    } catch (_) {
        return NULL;
    }
}
