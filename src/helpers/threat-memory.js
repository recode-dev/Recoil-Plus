import { DODGE_CFG, NEAREST_OWNER_MAX_DIST_SQ } from "./dodge_profiles.js";
import { normalize2d, startDodgeCommit, projectileRadiusForBrawler } from "./dodge_kinds.js";

export const projectileOwnerMemory = {};
export const projectileThreats = [];

export function nearestEnemyForProjectileOwner(px, py, enemies) {
    let nearest = null;
    let nearestDistSq = NEAREST_OWNER_MAX_DIST_SQ;
    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        const dx = px - enemy.x;
        const dy = py - enemy.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= nearestDistSq) {
            nearestDistSq = distSq;
            nearest = enemy;
        }
    }
    return nearest ? {
        brawlerId: nearest.brawlerId || 0,
        brawlerName: nearest.brawlerName || nearest.name || null,
        x: nearest.x,
        y: nearest.y
    } : null;
}

export function trackProjectiles(now, projectiles, enemies) {
    const seen = {};
    for (let i = 0; i < projectiles.length; i++) {
        const proj = projectiles[i];
        const gid = String(proj.gid);
        seen[gid] = true;

        if (projectileOwnerMemory[gid]) {
            const mem = projectileOwnerMemory[gid];
            const dx = proj.x - mem.lastX;
            const dy = proj.y - mem.lastY;
            const dist = Math.hypot(dx, dy);

            if (dist > 5) {
                mem.dirX = dx / dist;
                mem.dirY = dy / dist;
                mem.unconfirmed = false;

                if (!mem.ownerLocked) {
                    const owner = nearestEnemyForProjectileOwner(mem.x, mem.y, enemies || []);
                    if (owner) {
                        mem.ownerLocked = true;
                        mem.ownerBrawlerId = owner.brawlerId;
                        mem.ownerBrawlerName = owner.brawlerName || null;
                        mem.impactRadius = projectileRadiusForBrawler(proj.radius || mem.radius, proj.speed || mem.speed, owner.brawlerId);
                        mem.ignored = startDodgeCommit(mem.ownerBrawlerName, !!proj.isBeam);
                    }
                }
            }

            mem.speed = Math.max(100, proj.speed || mem.speed || 1200);
            mem.radius = Math.max(1, proj.radius || mem.radius || 8);
            mem.range = proj.range || mem.range || 9000;
            mem.x = proj.x;
            mem.y = proj.y;
            mem.lastX = proj.x;
            mem.lastY = proj.y;
            mem.lastSeen = now;
        } else {
            const owner = nearestEnemyForProjectileOwner(proj.x, proj.y, enemies || []);
            let dirX = 0;
            let dirY = 0;
            let unconfirmed = true;

            if (proj.spawnAngle !== null && proj.spawnAngle !== undefined && isFinite(proj.spawnAngle) && proj.spawnAngle !== 0) {
                dirX = Math.cos(proj.spawnAngle);
                dirY = Math.sin(proj.spawnAngle);
                unconfirmed = false;
            } else if (owner) {
                const dir = normalize2d(proj.x - owner.x, proj.y - owner.y);
                dirX = dir.x;
                dirY = dir.y;
                unconfirmed = false;
            }

            const ownerName = owner ? owner.brawlerName : null;
            const speed = Math.max(100, proj.speed || 1200);
            const radius = Math.max(1, proj.radius || 8);

            projectileOwnerMemory[gid] = {
                gid: gid,
                x: proj.x,
                y: proj.y,
                dirX: dirX,
                dirY: dirY,
                speed: speed,
                radius: radius,
                impactRadius: projectileRadiusForBrawler(radius, speed, owner ? owner.brawlerId : 0),
                lastX: proj.x,
                lastY: proj.y,
                lastSeen: now,
                unconfirmed: unconfirmed,
                ownerBrawlerId: owner ? owner.brawlerId : 0,
                ownerBrawlerName: ownerName,
                ownerLocked: !!owner,
                spawnTime: now,
                range: proj.range || 9000,
                ignored: startDodgeCommit(ownerName, !!proj.isBeam)
            };
        }
    }

    for (const id in projectileOwnerMemory) {
        if (!seen[id] && now - projectileOwnerMemory[id].lastSeen > DODGE_CFG.STALE_MS) {
            delete projectileOwnerMemory[id];
        }
    }
}

export function clearExpiredEnemyTracks() {
    for (const k in projectileOwnerMemory) delete projectileOwnerMemory[k];
    projectileThreats.length = 0;
}
