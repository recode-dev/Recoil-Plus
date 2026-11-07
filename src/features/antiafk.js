import { battleState } from "../core/scan.js";
import { moveToPoint } from "../core/commands.js";
import { flags } from "../utils/flags.js";

export const antiAfkConfig = {
    enabled: true,
    intervalMs: 2200
};

export function setAntiAfkOptions(opts = {}) {
    if (typeof opts.enabled === "boolean") antiAfkConfig.enabled = opts.enabled;
    if (typeof opts.intervalMs === "number") antiAfkConfig.intervalMs = Math.max(opts.intervalMs | 0, 500);
}

var lastAntiAfkMs = 0;
var antiAfkToggle = false;

export function resetAntiAfk() {
    lastAntiAfkMs = 0;
    antiAfkToggle = false;
}

export function updateAntiAfk(battleModeClientPtr, now) {
    if (!flags.antiAfk || !antiAfkConfig.enabled || !battleModeClientPtr || battleModeClientPtr.isNull() || battleState.lastUpdate === 0) return false;
    const interval = Math.max(1000, antiAfkConfig.intervalMs | 0);
    if (now - lastAntiAfkMs < interval) return false;
    lastAntiAfkMs = now;
    antiAfkToggle = !antiAfkToggle;
    const delta = antiAfkToggle ? 12 : -12;
    const targetX = (battleState.myX | 0) + delta;
    const targetY = (battleState.myY | 0) - delta;
    try {
        return moveToPoint(battleModeClientPtr, targetX, targetY);
    } catch (_) {
        return false;
    }
}
