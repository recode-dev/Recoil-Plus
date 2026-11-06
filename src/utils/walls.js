import { offsets } from "../core/offsets.js";

const SUBTILES_PER_TILE = 300;
const FLAG_BLOCKS_PROJECTILE = 64;
const FLAG_BLOCKS_MOVEMENT = 128;

var tileMapWidth = 0;
var tileMapHeight = 0;
var tileFlagsBytes = null;
var lastTileMapPtr = null;

export var wallsConfig = {
    enabled: true
};

export function setWallsOptions(opts = {}) {
    if (typeof opts.enabled === "boolean") wallsConfig.enabled = opts.enabled;
}

export function refreshTileCollisionCache(tileMapPtr) {
    if (!tileMapPtr || tileMapPtr.isNull()) return false;
    if (lastTileMapPtr && !lastTileMapPtr.isNull() && lastTileMapPtr.equals(tileMapPtr) && tileFlagsBytes) {
        return true;
    }

    try {
        const width = tileMapPtr.add(offsets.LogicTileMap_width).readS32();
        const height = tileMapPtr.add(offsets.LogicTileMap_height).readS32();
        if (width <= 0 || width > 120 || height <= 0 || height > 120) return false;

        const tilesArray = tileMapPtr.add(offsets.LogicTileMap_tiles).readPointer();
        if (!tilesArray || tilesArray.isNull()) return false;

        const totalTiles = width * height;
        const flags = new Uint8Array(totalTiles);

        for (let i = 0; i < totalTiles; i++) {
            try {
                const tilePtr = tilesArray.add(i * 8).readPointer();
                if (!tilePtr || tilePtr.isNull()) continue;

                const tileDataPtr = tilePtr.readPointer();
                if (!tileDataPtr || tileDataPtr.isNull()) continue;

                const rawFlags = tileDataPtr.add(offsets.LogicTileData_blocksMovement).readU16();
                const blocksMovement = (rawFlags & 0xff) !== 0;
                const blocksProjectiles = ((rawFlags >> 8) & 0xff) !== 0;

                let mask = 0;
                if (blocksMovement) mask |= FLAG_BLOCKS_MOVEMENT;
                if (blocksProjectiles) mask |= FLAG_BLOCKS_PROJECTILE;

                flags[i] = mask;
            } catch (_) {}
        }

        tileMapWidth = width;
        tileMapHeight = height;
        tileFlagsBytes = flags;
        lastTileMapPtr = tileMapPtr;
        return true;
    } catch (_) {
        return false;
    }
}

export function raycastTilesClear(startX, startY, endX, endY, flagMask) {
    if (!wallsConfig.enabled || !tileFlagsBytes || tileMapWidth <= 0 || tileMapHeight <= 0) {
        return true;
    }

    let x0 = (startX / SUBTILES_PER_TILE) | 0;
    let y0 = (startY / SUBTILES_PER_TILE) | 0;
    const x1 = (endX / SUBTILES_PER_TILE) | 0;
    const y1 = (endY / SUBTILES_PER_TILE) | 0;

    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let maxSteps = 120;

    while (maxSteps-- > 0) {
        if (x0 >= 0 && x0 < tileMapWidth && y0 >= 0 && y0 < tileMapHeight) {
            const idx = y0 * tileMapWidth + x0;
            if ((tileFlagsBytes[idx] & flagMask) !== 0) {
                return false;
            }
        }

        if (x0 === x1 && y0 === y1) break;

        const e2 = 2 * err;
        if (e2 >= dy) {
            err += dy;
            x0 += sx;
        }
        if (e2 <= dx) {
            err += dx;
            y0 += sy;
        }
    }

    return true;
}

export function projectileLineClear(startX, startY, endX, endY) {
    return raycastTilesClear(startX, startY, endX, endY, FLAG_BLOCKS_PROJECTILE);
}

export function movementLineClear(startX, startY, endX, endY) {
    return raycastTilesClear(startX, startY, endX, endY, FLAG_BLOCKS_MOVEMENT);
}

export function isTileBlocked(tileX, tileY, flagMask = FLAG_BLOCKS_MOVEMENT) {
    if (!tileFlagsBytes || tileX < 0 || tileX >= tileMapWidth || tileY < 0 || tileY >= tileMapHeight) {
        return true;
    }
    return (tileFlagsBytes[tileY * tileMapWidth + tileX] & flagMask) !== 0;
}