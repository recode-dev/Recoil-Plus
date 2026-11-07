import { offsets } from "../core/offsets.js";
import { getFunctions } from "../core/functions.js";
import { battleState } from "../core/scanner.js";
import { distSqPointToSegment } from "../helpers/dodge_kinds.js";

const SUBTILES_PER_TILE = 300;
const FLAG_BLOCKS_PROJECTILE = 64;
const FLAG_BLOCKS_MOVEMENT = 128;

var tileMapWidth = 0;
var tileMapHeight = 0;
var tileFlagsBytes = null;
var lastTileMapPtr = null;
var currentTileMapPtr = null;
var tileMapHookInstalled = false;
var tileMapPollInstalled = false;

export var wallsConfig = {
    enabled: true
};

export function installTileMapWatcher(imageBase) {
    if (tileMapHookInstalled) return;
    try {
        Interceptor.attach(imageBase.add(offsets.LogicTileMap_getTile), {
            onEnter(args) {
                currentTileMapPtr = args[0];
            }
        });
        tileMapHookInstalled = true;
    } catch (_) {}

    if (!tileMapPollInstalled) {
        tileMapPollInstalled = true;
        setInterval(() => {
            if (currentTileMapPtr && !currentTileMapPtr.isNull()) {
                try {
                    refreshTileCollisionCache(currentTileMapPtr);
                } catch (_) {}
            }
        }, 1000);
    }
}

export function refreshTileCollisionCache(tileMapPtr) {
    if (!tileMapPtr || tileMapPtr.isNull()) return;
    if (lastTileMapPtr && !lastTileMapPtr.isNull() && lastTileMapPtr.equals(tileMapPtr) && tileFlagsBytes) {
        return;
    }

    try {
        const w = tileMapPtr.add(offsets.LogicTileMap_width).readS32();
        const h = tileMapPtr.add(offsets.LogicTileMap_height).readS32();
        if (w <= 0 || w > 120 || h <= 0 || h > 120) return;

        const tilesArray = tileMapPtr.add(offsets.LogicTileMap_tiles).readPointer();
        if (tilesArray.isNull()) return;

        const count = w * h;
        if (count <= 0 || count > 14400) return;

        const bytes = new Uint8Array(count);
        for (let i = 0; i < count; i++) {
            try {
                const tilePtr = tilesArray.add(i * Process.pointerSize).readPointer();
                if (tilePtr.isNull()) continue;
                const tileData = tilePtr.readPointer();
                if (tileData.isNull()) continue;

                let flags = 0;
                try {
                    const blkMove = tileData.add(offsets.LogicTileData_blocksMovement).readU8();
                    if (blkMove) flags |= FLAG_BLOCKS_MOVEMENT;
                } catch (_) {}
                try {
                    const blkProj = tileData.add(offsets.LogicTileData_blocksProjectiles).readU8();
                    if (blkProj) flags |= FLAG_BLOCKS_PROJECTILE;
                } catch (_) {}

                bytes[i] = flags;
            } catch (_) {}
        }

        tileFlagsBytes = bytes;
        tileMapWidth = w;
        tileMapHeight = h;
        lastTileMapPtr = tileMapPtr;
    } catch (_) {}
}

export function getCollisionMap() {
    return tileFlagsBytes;
}

export function getMapWidth() {
    return tileMapWidth;
}

export function getMapHeight() {
    return tileMapHeight;
}

export function raycastTilesClear(x0, y0, x1, y1, flag) {
    const map = getCollisionMap();
    if (!map) return true;
    const w = getMapWidth();
    const h = getMapHeight();
    if (w <= 0 || h <= 0) return true;

    let gx0 = (x0 / SUBTILES_PER_TILE) | 0;
    let gy0 = (y0 / SUBTILES_PER_TILE) | 0;
    const gx1 = (x1 / SUBTILES_PER_TILE) | 0;
    const gy1 = (y1 / SUBTILES_PER_TILE) | 0;

    const dx = Math.abs(gx1 - gx0);
    const dy = -Math.abs(gy1 - gy0);
    const sx = gx0 < gx1 ? 1 : -1;
    const sy = gy0 < gy1 ? 1 : -1;
    let err = dx + dy;
    let maxSteps = 120;

    while (maxSteps-- > 0) {
        if (gx0 >= 0 && gx0 < w && gy0 >= 0 && gy0 < h) {
            if ((map[gy0 * w + gx0] & flag) !== 0) {
                return false;
            }
        }
        if (gx0 === gx1 && gy0 === gy1) break;
        const e2 = 2 * err;
        if (e2 >= dy) {
            err += dy;
            gx0 += sx;
        }
        if (e2 <= dx) {
            err += dx;
            gy0 += sy;
        }
    }
    return true;
}

export function projectileLineClear(x0, y0, x1, y1) {
    return raycastTilesClear(x0, y0, x1, y1, FLAG_BLOCKS_PROJECTILE);
}

export function movementLineClear(x0, y0, x1, y1) {
    return raycastTilesClear(x0, y0, x1, y1, FLAG_BLOCKS_MOVEMENT);
}

export function clipLineAgainstProjectileBlockers(x0, y0, x1, y1) {
    const result = { x: x1, y: y1, blocked: false };
    const w = getMapWidth();
    const h = getMapHeight();
    if (!w || !h) return result;

    const dx = x1 - x0;
    const dy = y1 - y0;
    if (Math.hypot(dx, dy) < 1e-6) return result;

    const gx0 = (x0 / SUBTILES_PER_TILE) | 0;
    const gy0 = (y0 / SUBTILES_PER_TILE) | 0;
    const gx1 = (x1 / SUBTILES_PER_TILE) | 0;
    const gy1 = (y1 / SUBTILES_PER_TILE) | 0;

    if (gx0 < 0 || gy0 < 0 || gx0 >= w || gy0 >= h) {
        result.x = x0;
        result.y = y0;
        result.blocked = true;
        return result;
    }

    const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
    const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;

    const nextTileX = (stepX > 0 ? gx0 + 1 : gx0) * SUBTILES_PER_TILE;
    const nextTileY = (stepY > 0 ? gy0 + 1 : gy0) * SUBTILES_PER_TILE;

    let tMaxX = dx !== 0 ? (nextTileX - x0) / dx : Infinity;
    let tMaxY = dy !== 0 ? (nextTileY - y0) / dy : Infinity;
    const tDeltaX = dx !== 0 ? Math.abs(SUBTILES_PER_TILE / dx) : Infinity;
    const tDeltaY = dy !== 0 ? Math.abs(SUBTILES_PER_TILE / dy) : Infinity;

    let cx = gx0;
    let cy = gy0;
    const map = getCollisionMap();
    const isPassable = (tx, ty) => tx >= 0 && ty >= 0 && tx < w && ty < h && (map[ty * w + tx] & FLAG_BLOCKS_PROJECTILE) === 0;

    const maxIters = 2 * (w + h);
    let iter = 0;
    while ((cx !== gx1 || cy !== gy1) && iter++ < maxIters) {
        if (tMaxX < tMaxY) {
            cx += stepX;
            if (!isPassable(cx, cy)) {
                result.x = x0 + dx * tMaxX;
                result.y = y0 + dy * tMaxX;
                result.blocked = true;
                return result;
            }
            tMaxX += tDeltaX;
        } else {
            cy += stepY;
            if (!isPassable(cx, cy)) {
                result.x = x0 + dx * tMaxY;
                result.y = y0 + dy * tMaxY;
                result.blocked = true;
                return result;
            }
            tMaxY += tDeltaY;
        }
    }
    return result;
}

export function lineBlockedByBallOrWall(fromX, fromY, toX, toY) {
    try {
        if (getCollisionMap()) return !raycastTilesClear(fromX, fromY, toX, toY, 64);
    } catch (_) {}
    try {
        const pickups = battleState.pickups || [];
        for (let i = 0; i < pickups.length; i++) {
            const p = pickups[i];
            if (p && distSqPointToSegment(p.x, p.y, fromX, fromY, toX, toY) < 52900) return true;
        }
    } catch (_) {}
    return false;
}
