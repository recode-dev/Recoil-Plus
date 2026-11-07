export const uiOffsets = Object.freeze({
    Stage_sm_pInstance: 0x1125e28,
    Stage_addChild: 0xba2d54,
    Sprite_addChild: 0xb9d680,
    Sprite_Sprite: 0xb9d410,
    GameButton_GameButton: 0xbb8afc,
    CustomButton_CustomButton: 0xbb8190,
    ResourceManager_getMovieClip: 0xb454f0,
    CustomButton_setMovieClip: 0xbb8618,
    MovieClip_gotoAndStopFrameIndex: 0xb89274,
    MovieClip_getFieldByName: 0xb8a074,
    TextField_setText: 0xbb5c40,
    CustomButton_buttonPressed: 0xbb82d8,
    String_String: 0xd3f6bc,
    DisplayObject_setXY: 0xb854a8,
    DisplayObject_x: 0x20,
    DisplayObject_y: 0x24,
    DisplayObject_scaleX: 0x10,
    DisplayObject_scaleY: 0x1c
});

const _pinnedAllocations = [];

export function alloc(size) {
    try {
        const p = Memory.alloc(size);
        p.writeByteArray(new Uint8Array(size));
        _pinnedAllocations.push(p);
        return p;
    } catch (_) {
        return NULL;
    }
}

export var nativeUi = null;

export function initNativeUi(base) {
    if (nativeUi) return nativeUi;
    try {
        nativeUi = {
            Stage_addChild: new NativeFunction(base.add(uiOffsets.Stage_addChild), "void", ["pointer", "pointer"]),
            Sprite_addChild: new NativeFunction(base.add(uiOffsets.Sprite_addChild), "pointer", ["pointer", "pointer"]),
            Sprite_Sprite: new NativeFunction(base.add(uiOffsets.Sprite_Sprite), "void", ["pointer", "int"]),
            GameButton_GameButton: new NativeFunction(base.add(uiOffsets.GameButton_GameButton), "void", ["pointer"]),
            ResourceManager_getMovieClip: new NativeFunction(base.add(uiOffsets.ResourceManager_getMovieClip), "pointer", ["pointer", "pointer", "ulong"]),
            CustomButton_setMovieClip: new NativeFunction(base.add(uiOffsets.CustomButton_setMovieClip), "void", ["pointer", "pointer", "int"]),
            MovieClip_gotoAndStopFrameIndex: new NativeFunction(base.add(uiOffsets.MovieClip_gotoAndStopFrameIndex), "void", ["pointer", "int"]),
            MovieClip_getFieldByName: new NativeFunction(base.add(uiOffsets.MovieClip_getFieldByName), "pointer", ["pointer", "pointer"]),
            TextField_setText: new NativeFunction(base.add(uiOffsets.TextField_setText), "void", ["pointer", "pointer"]),
            String_String: new NativeFunction(base.add(uiOffsets.String_String), "pointer", ["pointer", "pointer"]),
            DisplayObject_setXY: new NativeFunction(base.add(uiOffsets.DisplayObject_setXY), "void", ["pointer", "float", "float"])
        };
    } catch (_) {
        nativeUi = null;
    }
    return nativeUi;
}

export function allocUtf8(str) {
    try {
        const p = Memory.allocUtf8String(str);
        _pinnedAllocations.push(p);
        return p;
    } catch (_) {
        return NULL;
    }
}

export function makeScString(str) {
    const sc = alloc(32);
    if (sc && !sc.isNull() && nativeUi && nativeUi.String_String) {
        try {
            nativeUi.String_String(sc, allocUtf8(str));
        } catch (_) {}
    }
    return sc;
}

export function setXY(ptr, x, y) {
    if (!ptr || ptr.isNull()) return;
    try {
        ptr.add(uiOffsets.DisplayObject_x).writeFloat(x);
        ptr.add(uiOffsets.DisplayObject_y).writeFloat(y);
    } catch (_) {}
    try {
        if (nativeUi && nativeUi.DisplayObject_setXY) {
            nativeUi.DisplayObject_setXY(ptr, x, y);
        }
    } catch (_) {}
}

export function setScale(ptr, scale) {
    if (!ptr || ptr.isNull()) return;
    try {
        ptr.add(uiOffsets.DisplayObject_scaleX).writeFloat(scale);
        ptr.add(uiOffsets.DisplayObject_scaleY).writeFloat(scale);
    } catch (_) {}
}

export function setMovieClipText(mc, text) {
    try {
        if (!mc || mc.isNull() || !nativeUi || !nativeUi.MovieClip_getFieldByName || !nativeUi.TextField_setText) return;
        const tf = nativeUi.MovieClip_getFieldByName(mc, allocUtf8("txt"));
        if (!tf || tf.isNull()) return;
        const sc = makeScString(text);
        nativeUi.TextField_setText(tf, sc);
    } catch (_) {}
}
