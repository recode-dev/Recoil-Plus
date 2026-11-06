import { offsets } from "./offsets.js";
import { getFunctions } from "./functions.js";

const cachedScStrings = {};

export function allocUtf8(text) {
    const fns = getFunctions();
    const len = text.length;
    const buf = fns.malloc(len + 1);
    buf.writeUtf8String(text);
    return buf;
}

export function makeScString(text) {
    if (cachedScStrings[text]) {
        return cachedScStrings[text];
    }

    const fns = getFunctions();
    const sc = fns.malloc(32);
    sc.writeByteArray(new Uint8Array(32).buffer);

    const utf8Buf = allocUtf8(text);
    fns.StringCtor(sc, utf8Buf);
    fns.free(utf8Buf);

    cachedScStrings[text] = sc;
    return sc;
}

export function readScString(ptr, maxLen = 256) {
    try {
        if (!ptr || ptr.isNull()) return null;

        const lengthOffset = offsets.ScString_length || 4;
        const dataOffset = offsets.ScString_data || 8;

        const len = ptr.add(lengthOffset).readU32();
        if (len <= 0 || len > maxLen) return null;

        let str = null;
        try {
            str = ptr.add(dataOffset).readUtf8String(len);
        } catch (_) {}

        if (str && str.length > 0) return str;

        try {
            const heapPtr = ptr.add(dataOffset).readPointer();
            if (heapPtr && !heapPtr.isNull()) {
                str = heapPtr.readUtf8String(len);
            }
        } catch (_) {}

        return str;
    } catch (_) {
        return null;
    }
}

export function freeCachedScStrings() {
    const fns = getFunctions();
    for (const key of Object.keys(cachedScStrings)) {
        const ptr = cachedScStrings[key];
        if (ptr && !ptr.isNull()) {
            if (fns.ScString_destruct) {
                fns.ScString_destruct(ptr);
            }
            fns.free(ptr);
        }
        delete cachedScStrings[key];
    }
}