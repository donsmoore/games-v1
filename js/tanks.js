import * as THREE from 'three';
import { getHeight } from './terrain.js?v=33';

export class TankManager {
    constructor(scene, terrainManager = null, tankModel = null) {
        this.scene = scene;
        this.terrainManager = terrainManager;
        this.tankModel = tankModel; // Pre-loaded tank model from assets.js
        this.tanks = [];
        this.projectiles = [];

        // Tank dimensions (model is already scaled at 4x in OBJ)
        this.tankScale = 1.0; // Model is pre-scaled
        this.collisionRadius = 40; // Collision radius for 4x scale tank

        this.spawnTimer = 0;
        this.maxTanks = 20;
        this.initialSpawnDone = false;

        // Projectile settings
        this.projectileMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
        this.projectileSpeed = 80;
        this.projectileGravity = -40;
        this.fireRange = 300;
        this.globalFireCooldown = 1.0;
        this.globalFireTimer = 0;
    }

    setTerrainManager(tm) {
        this.terrainManager = tm;
    }

    setTankModel(model) {
        this.tankModel = model;
    }

    createTankModel() {
        if (!this.tankModel) {
            console.warn("Tank model not loaded yet!");
            return null;
        }

        // Clone the pre-loaded model
        const tank = this.tankModel.clone();

        // Find turret and barrel meshes
        let turret = null;
        let barrel = null;

        tank.traverse((child) => {
            if (child.isMesh) {
                // Ensure unique materials so we can change them if needed
                child.material = child.material.clone();

                // Match names from OBJ groups
                if (child.name.includes('Turret')) {
                    turret = child;
                }
                if (child.name.includes('Barrel')) {
                    barrel = child;
                }
            }
        });

        // Set up hierarchy: Barrel should be a child of Turret
        if (turret && barrel) {
            // Re-parent barrel to turret so it rotates with it
            turret.add(barrel);
        }

        // Set up userData
        tank.userData = {
            isTank: true,
            health: 3,
            velocity: new THREE.Vector3(),
            target: null,
            state: 'idle',
            stateTimer: 0,
            collisionRadius: this.collisionRadius,
            turret: turret,
            barrel: barrel,
            fireCooldownTimer: 0
        };

        return tank;
    }

    createProjectile(startPos, targetPos, launchAngle) {
        // Create tank round (black ball)
        const geo = new THREE.SphereGeometry(1.0, 8, 8);
        const projectile = new THREE.Mesh(geo, this.projectileMat);
        projectile.position.copy(startPos);
        projectile.castShadow = true;

        // Calculate initial velocity for arcing trajectory
        const dx = targetPos.x - startPos.x;
        const dy = targetPos.y - startPos.y;
        const dz = targetPos.z - startPos.z;
        const horizontalDist = Math.sqrt(dx * dx + dz * dz);

        // Use provided launch angle for arc
        const flightTime = horizontalDist / this.projectileSpeed;

        const horizontalSpeed = this.projectileSpeed * Math.cos(launchAngle);
        const verticalSpeed = this.projectileSpeed * Math.sin(launchAngle) +
            (0.5 * Math.abs(this.projectileGravity) * flightTime * 0.5); // Compensate for gravity

        // Direction vector (horizontal)
        const dirX = dx / horizontalDist;
        const dirZ = dz / horizontalDist;

        const velocity = new THREE.Vector3(
            dirX * horizontalSpeed,
            verticalSpeed,
            dirZ * horizontalSpeed
        );

        this.projectiles.push({
            mesh: projectile,
            velocity: velocity,
            age: 0
        });

        this.scene.add(projectile);
    }

    spawnTank(playerPos, immediate = false) {
        if (this.tanks.length >= this.maxTanks) return;

        const angle = Math.random() * Math.PI * 2;
        // Spawn closer: 100-300m instead of 200-600m
        const dist = immediate ? (80 + Math.random() * 150) : (100 + Math.random() * 200);

        const x = playerPos.x + Math.cos(angle) * dist;
        const z = playerPos.z + Math.sin(angle) * dist;
        const y = getHeight(x, z);

        if (y < 0) return;

        if (this.checkObstacleCollision(x, z, this.collisionRadius)) {
            return;
        }

        const tank = this.createTankModel();
        tank.position.set(x, y, z);

        this.scene.add(tank);
        this.tanks.push(tank);
    }

    // Pre-spawn tanks at game start
    initialSpawn(playerPos) {
        if (this.initialSpawnDone) return;
        this.initialSpawnDone = true;

        // Spawn 5 tanks immediately
        for (let i = 0; i < 5; i++) {
            this.spawnTank(playerPos, true);
        }
    }

    checkObstacleCollision(x, z, radius) {
        if (!this.terrainManager) return false;

        const { activeTrees, activeBaobabTrees } = this.terrainManager.getTrees();
        for (const tree of activeTrees) {
            const dx = x - tree.position.x;
            const dz = z - tree.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            const treeRadius = (tree.userData && tree.userData.baseRadius) ?
                tree.userData.baseRadius * tree.scale.x : 10;

            if (dist < radius + treeRadius) {
                return true;
            }
        }

        for (const tree of activeBaobabTrees) {
            const dx = x - tree.position.x;
            const dz = z - tree.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            const treeRadius = (tree.userData && tree.userData.baseRadius) ?
                tree.userData.baseRadius * tree.scale.x : 25;

            if (dist < radius + treeRadius) {
                return true;
            }
        }

        const buildings = this.terrainManager.getBuildings ? this.terrainManager.getBuildings() : [];
        for (const bld of buildings) {
            const dx = x - bld.position.x;
            const dz = z - bld.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < radius + 20) {
                return true;
            }
        }

        const mountains = this.terrainManager.getMountains ? this.terrainManager.getMountains() : [];
        for (const m of mountains) {
            const dx = x - m.position.x;
            const dz = z - m.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            const mRadius = (m.userData && m.userData.baseRadius) || 120;
            if (dist < radius + mRadius) {
                return true;
            }
        }

        return false;
    }

    update(delta, playerPos, playerSpeed = 100, playerAltitude = 100) {
        // playerSpeed and playerAltitude are used to determine if the player has "taken off"
        // Default values of 100 ensure tanks still fire in scenes where these aren't passed (if any)

        // Initial spawn
        this.initialSpawn(playerPos);

        // Regular spawn logic
        this.spawnTimer += delta;
        if (this.spawnTimer > 0.5) {
            this.spawnTimer = 0;
            this.spawnTank(playerPos);
        }

        // Update global fire cooldown
        if (this.globalFireTimer > 0) {
            this.globalFireTimer -= delta;
        }

        // Update tanks
        for (let i = this.tanks.length - 1; i >= 0; i--) {
            const tank = this.tanks[i];

            if (tank.userData.health <= 0) {
                this.removeTank(i);
                continue;
            }

            // Check if player is in range and aim turret
            const distToPlayer = tank.position.distanceTo(playerPos);

            if (tank.userData.turret) {
                // Calculate direction to player (world space)
                const toPlayerX = playerPos.x - tank.position.x;
                const toPlayerZ = playerPos.z - tank.position.z;

                // Turret center height in model is y=9
                const turretBaseY = tank.position.y + 9;
                const toPlayerY = playerPos.y - turretBaseY;
                const horizontalDist = Math.sqrt(toPlayerX * toPlayerX + toPlayerZ * toPlayerZ);

                // Rotate turret to face player (Y axis rotation)
                const turretAngle = Math.atan2(toPlayerX, toPlayerZ);
                // Convert to local rotation (relative to tank body)
                tank.userData.turret.rotation.y = turretAngle - tank.rotation.y;

                // Calculate barrel elevation angle for arc
                const launchAngle = 0.3 + Math.atan2(toPlayerY, horizontalDist) * 0.5;

                // Set barrel pitch (X rotation)
                if (tank.userData.barrel) {
                    tank.userData.barrel.rotation.x = -launchAngle;
                }

                // Fire if in range, global cooldown allows, and player has taken off
                const hasTakenOff = playerSpeed > 20 && playerAltitude > 5;
                if (distToPlayer < this.fireRange && this.globalFireTimer <= 0 && hasTakenOff) {
                    // Use barrel tip if available
                    const barrelTip = new THREE.Vector3();
                    if (tank.userData.barrel) {
                        const localTip = new THREE.Vector3(0, 0, 16); // Barrel is 16 units long
                        tank.userData.barrel.localToWorld(localTip);
                        barrelTip.copy(localTip);
                    } else {
                        tank.userData.turret.getWorldPosition(barrelTip);
                        barrelTip.y += 2;
                    }



                    // Add some inaccuracy
                    const inaccuracy = 8;
                    const aimTarget = playerPos.clone();
                    aimTarget.x += (Math.random() - 0.5) * inaccuracy;
                    aimTarget.y += (Math.random() - 0.5) * inaccuracy;
                    aimTarget.z += (Math.random() - 0.5) * inaccuracy;

                    this.createProjectile(barrelTip, aimTarget, launchAngle);
                    this.globalFireTimer = this.globalFireCooldown; // Global cooldown
                }
            }

            // AI movement
            tank.userData.stateTimer -= delta;

            if (tank.userData.stateTimer <= 0) {
                if (Math.random() > 0.3) {
                    tank.userData.state = 'moving';
                    tank.userData.stateTimer = 5 + Math.random() * 10;

                    const angle = Math.random() * Math.PI * 2;
                    const dist = 50 + Math.random() * 100;
                    tank.userData.target = new THREE.Vector3(
                        tank.position.x + Math.cos(angle) * dist,
                        0,
                        tank.position.z + Math.sin(angle) * dist
                    );
                } else {
                    tank.userData.state = 'idle';
                    tank.userData.stateTimer = 2 + Math.random() * 3;
                    tank.userData.target = null;
                }
            }

            if (tank.userData.state === 'moving' && tank.userData.target) {
                const dx = tank.userData.target.x - tank.position.x;
                const dz = tank.userData.target.z - tank.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                if (dist < 1) {
                    tank.userData.state = 'idle';
                    tank.userData.stateTimer = 2;
                } else {
                    const speed = 8;
                    const moveDist = speed * delta;

                    const dirX = dx / dist;
                    const dirZ = dz / dist;

                    const newX = tank.position.x + dirX * moveDist;
                    const newZ = tank.position.z + dirZ * moveDist;

                    if (!this.checkObstacleCollision(newX, newZ, this.collisionRadius * 0.5)) {
                        tank.position.x = newX;
                        tank.position.z = newZ;

                        const lookTarget = new THREE.Vector3(tank.userData.target.x, tank.position.y, tank.userData.target.z);
                        tank.lookAt(lookTarget);
                    } else {
                        tank.userData.state = 'idle';
                        tank.userData.stateTimer = 1;
                    }
                }
            }

            // Ensure height (check terrain AND runways)
            let h = getHeight(tank.position.x, tank.position.z);

            // Check if on a runway (use runway surface height if so)
            if (this.terrainManager) {
                const runways = this.terrainManager.getRunways ? this.terrainManager.getRunways() : [];
                for (const r of runways) {
                    // Convert tank pos to runway local space
                    const localPos = tank.position.clone();
                    r.worldToLocal(localPos);

                    // Runway is 20x100 (x: -10..10, z: -50..50)
                    if (Math.abs(localPos.x) < 15 && Math.abs(localPos.z) < 55) {
                        // On runway - use runway surface height
                        const runwaySurfaceY = r.position.y + 15;
                        h = Math.max(h, runwaySurfaceY);
                        break;
                    }
                }
            }

            if (h < -1) {
                tank.userData.health = 0;
            } else {
                tank.position.y = h;
            }

            // Distance cull
            if (tank.position.distanceTo(playerPos) > 1500) {
                this.removeTank(i);
            }
        }

        // Update projectiles
        this.updateProjectiles(delta, playerPos);
    }

    updateProjectiles(delta, playerPos) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];

            // Apply gravity
            p.velocity.y += this.projectileGravity * delta;

            // Move
            p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));

            // Rotate to face velocity direction
            if (p.velocity.length() > 0.1) {
                p.mesh.lookAt(p.mesh.position.clone().add(p.velocity));
            }

            p.age += delta;

            // Check ground collision
            const groundY = getHeight(p.mesh.position.x, p.mesh.position.z);
            if (p.mesh.position.y < groundY + 0.5) {
                // Hit ground - remove
                this.removeProjectile(i);
                continue;
            }

            // Check player collision (simple distance check)
            const distToPlayer = p.mesh.position.distanceTo(playerPos);
            if (distToPlayer < 5) {
                // Hit player! Return this info to game.js
                p.hitPlayer = true;
            }

            // Remove if too old
            if (p.age > 10) {
                this.removeProjectile(i);
            }
        }
    }

    // Check if any projectile hit the player (called from game.js)
    checkPlayerHit(playerPos) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            if (p.hitPlayer) {
                this.removeProjectile(i);
                return true;
            }
        }
        return false;
    }

    removeProjectile(index) {
        const p = this.projectiles[index];
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        this.projectiles.splice(index, 1);
    }

    removeTank(index) {
        const tank = this.tanks[index];
        this.scene.remove(tank);
        tank.traverse(o => {
            if (o.geometry) o.geometry.dispose();
        });
        this.tanks.splice(index, 1);
    }

    getTanks() {
        return this.tanks;
    }

    getProjectiles() {
        return this.projectiles;
    }
}
