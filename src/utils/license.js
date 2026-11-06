import { offsets } from "../core/offsets.js";
import { getBase, getImage, getFunctions } from "../core/functions.js";

const REQUEST_BODY_PTR_OFFSET = 192;
const REQUEST_BODY_SIZE_OFFSET = 200;
const LICENSE_PATH = "/res/license.bin";

var licenseListener = null;
var requestBody = JSON.stringify({ features: [], connection: "Keep-Alive" });
var requestBodyBytes = null;
var requestTotal = 0;

export function setupLicense() {
    if (licenseListener) return;
    try {
        const off = offsets.LogicHttpRequest_encode;
        if (typeof off !== "number" || off <= 0) return;
        const image = getImage();
        if (!image || !image.path) return;
        const dir = image.path.slice(0, image.path.lastIndexOf("/"));
        const license = File.readAllBytes(dir + LICENSE_PATH);
        if (!license || license.byteLength === 0) return;
        const malloc = getFunctions().malloc;
        if (!malloc) return;
        requestBodyBytes = license;
        requestTotal = license.byteLength + requestBody.length + 1;
        licenseListener = Interceptor.attach(getBase().add(off), {
            onEnter(args) {
                try {
                    if (!args[0] || args[0].isNull()) return;
                    const buf = malloc(requestTotal);
                    if (!buf || buf.isNull()) return;
                    Memory.copy(buf, requestBodyBytes.unwrap(), requestBodyBytes.byteLength);
                    buf.add(requestBodyBytes.byteLength).writeUtf8String(requestBody);
                    args[0].add(REQUEST_BODY_PTR_OFFSET).writePointer(buf);
                    args[0].add(REQUEST_BODY_SIZE_OFFSET).writeS32(requestTotal);
                } catch (_) {}
            }
        });
        Interceptor.flush();
    } catch (_) {
        licenseListener = null;
    }
}
