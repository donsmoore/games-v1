import * as THREE from 'three';
import { getHeight } from './terrain.js?v=33';

export class AIPlaneManager {
    constructor(scene, terrainManager = null, f16Model = null) {
        this.scene = scene;
        this.terrainManager = terrainManager;
        this.f16Model = f16Model; // Pre-loaded F16 model
        this.planes = [];
        this.lasers = [];

        this.maxPlanes = 6;
        this.spawnTimer = 0;
        this.spawnInterval = 5.0; // Seconds between spawns

        // Weapon settings
        this.fireRange = 400;
        this.fireCooldown = 3.0; // Seconds
        this.laserSpeed = 600;
        this.laserMat = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
        this.laserGeo = new THREE.CylinderGeometry(0.8, 0.8, 16, 8);
        this.laserGeo.rotateX(Math.PI / 2); // Align with Z

        // Flight settings
        this.flightSpeed = 40; // Units per second
    }

    setTerrainManager(tm) {
        this.terrainManager = tm;
    }

    createAIPlaneModel() {
        if (!this.f16Model) {
            console.warn("F16 model not loaded yet!");
            return null;
        }

        const model = this.f16Model.clone();

        // Scale up for visibility (4x like tanks)
        model.scale.set(4, 4, 4);

        // Setup plane specific data
        model.userData = {
            health: 2,
            targetPos: new THREE.Vector3(),
            state: 'wandering',
            stateTimer: 0,
            fireCooldownTimer: 0,
            velocity: new THREE.Vector3(0, 0, -this.flightSpeed),
            turnSpeed: 1.5 // Rad/s
        };

        return model;
    }

    spawnPlane(playerPos) {
        if (this.planes.length >= this.maxPlanes) return;

        const distance = 150 + Math.random() * 250; // Spawn even closer
        const angle = Math.random() * Math.PI * 2;
        const x = playerPos.x + Math.cos(angle) * distance;
        const z = playerPos.z + Math.sin(angle) * distance;

        // Ground-relative altitude
        const groundY = getHeight(x, z);
        let y = groundY + 50 + Math.random() * 200; // 50-250m above ground

        // Clamp to game max altitude
        if (y > 480) y = 480;
        if (y < groundY + 10) y = groundY + 10; // Ensure at least 10m off ground

        const plane = this.createAIPlaneModel();
        if (!plane) return;

        plane.position.set(x, y, z);

        // Initial heading towards player area
        const target = playerPos.clone();
        target.y = y;
        plane.lookAt(target);
        plane.rotateY(Math.PI); // CRITICAL: Point NOSE at player

        this.scene.add(plane);
        this.planes.push(plane);
        console.log("AI Plane spawned at RelAlt:", Math.round(y - groundY), "WorldAlt:", Math.round(y));
    }

    fireLaser(plane, playerPos) {
        const laser = new THREE.Mesh(this.laserGeo, this.laserMat);

        // Spawn slightly in front of plane (adjusted for 4x scale)
        const shootPos = new THREE.Vector3(0, 0, -20).applyQuaternion(plane.quaternion).add(plane.position);
        laser.position.copy(shootPos);
        laser.quaternion.copy(plane.quaternion);

        const velocity = new THREE.Vector3(0, 0, -1);
        velocity.applyQuaternion(plane.quaternion).multiplyScalar(this.laserSpeed);

        this.lasers.push({
            mesh: laser,
            velocity: velocity,
            age: 0,
            hitPlayer: false
        });

        this.scene.add(laser);
    }

    update(delta, playerPos, playerSpeedMS = 100, playerAlt = 100) {
        // Spawning
        this.spawnTimer += delta;
        if (this.spawnTimer > this.spawnInterval) {
            this.spawnTimer = 0;
            this.spawnPlane(playerPos);
        }

        // Only track/shoot if player is airborne (same as tanks)
        const isPlayerAirborne = playerAlt > 5.0 && playerSpeedMS > 20.0;

        // Update Planes
        for (let i = this.planes.length - 1; i >= 0; i--) {
            const plane = this.planes[i];
            const data = plane.userData;

            if (data.health <= 0) {
                this.removePlane(i);
                continue;
            }

            // AI Logic: Persistence / Orbit / Intercept
            data.stateTimer -= delta;
            if (data.stateTimer <= 0) {
                const distToPlayer = plane.position.distanceTo(playerPos);

                if (!isPlayerAirborne) {
                    // If player is on ground, wander casually at a distance
                    const angle = Math.random() * Math.PI * 2;
                    const wanderDist = 800 + Math.random() * 400;
                    data.targetPos.set(
                        playerPos.x + Math.cos(angle) * wanderDist,
                        150 + Math.random() * 100,
                        playerPos.z + Math.sin(angle) * wanderDist
                    );
                    data.state = 'wandering';
                    data.stateTimer = 10;
                } else if (distToPlayer > 500) {
                    // Too far? Head directly towards the player's general area
                    data.targetPos.copy(playerPos);
                    data.targetPos.y += (Math.random() - 0.5) * 40;
                    data.state = 'intercepting';
                    data.stateTimer = 2 + Math.random() * 2;
                } else {
                    // Close enough? ORBIT the player. 
                    const orbitRadius = 400 + Math.random() * 200; // Even larger orbit
                    const angle = Math.random() * Math.PI * 2;
                    data.targetPos.set(
                        playerPos.x + Math.cos(angle) * orbitRadius,
                        playerPos.y + (Math.random() - 0.5) * 100,
                        playerPos.z + Math.sin(angle) * orbitRadius
                    );
                    data.state = 'orbiting';
                    data.stateTimer = 5 + Math.random() * 5;
                }
            }

            // Smoothing turn towards target
            const targetRotation = new THREE.Quaternion();
            const originalRotation = plane.quaternion.clone();

            plane.lookAt(data.targetPos);
            plane.rotateY(Math.PI); // Point NOSE at target
            targetRotation.copy(plane.quaternion);
            plane.quaternion.copy(originalRotation);

            // SIGNIFICANTLY slowed turn speed for realism (was 3.0, now 0.75 - approx 400% slower)
            plane.quaternion.slerp(targetRotation, delta * 0.75);

            // Move Forward
            plane.translateZ(-this.flightSpeed * delta);

            // Terrain Collision
            const currentGroundY = getHeight(plane.position.x, plane.position.z);
            if (plane.position.y < currentGroundY + 5) {
                data.health = 0;
            }

            // Combat logic: Casual firing (ONLY if player is airborne)
            data.fireCooldownTimer -= delta;
            if (isPlayerAirborne && data.fireCooldownTimer <= 0) {
                const distToPlayer = plane.position.distanceTo(playerPos);
                const toPlayer = new THREE.Vector3().subVectors(playerPos, plane.position).normalize();
                const forwardVec = new THREE.Vector3(0, 0, -1).applyQuaternion(plane.quaternion);
                const dot = toPlayer.dot(forwardVec);

                if (distToPlayer < this.fireRange && dot > 0.8) {
                    this.fireLaser(plane, playerPos);
                    data.fireCooldownTimer = 3.0 + Math.random() * 3.0; // Slower fire
                }
            }

            // Distance cull
            if (plane.position.distanceTo(playerPos) > 2000) {
                this.removePlane(i);
            }
        }

        // Update Lasers
        this.updateLasers(delta, playerPos);
    }

    updateLasers(delta, playerPos) {
        for (let i = this.lasers.length - 1; i >= 0; i--) {
            const l = this.lasers[i];

            l.mesh.position.add(l.velocity.clone().multiplyScalar(delta));
            l.age += delta;

            // Player collision
            const dist = l.mesh.position.distanceTo(playerPos);
            if (dist < 10) {
                l.hitPlayer = true;
            }

            // Ground/Removal check
            const groundY = getHeight(l.mesh.position.x, l.mesh.position.z);
            if (l.age > 5 || l.mesh.position.y < groundY) {
                this.removeLaser(i);
            }
        }
    }

    checkPlayerHit() {
        for (let i = this.lasers.length - 1; i >= 0; i--) {
            if (this.lasers[i].hitPlayer) {
                this.removeLaser(i);
                return true;
            }
        }
        return false;
    }

    removePlane(index) {
        const p = this.planes[index];
        this.scene.remove(p);
        p.traverse(o => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) {
                if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
                else o.material.dispose();
            }
        });
        this.planes.splice(index, 1);
    }

    removeLaser(index) {
        const l = this.lasers[index];
        this.scene.remove(l.mesh);
        l.mesh.geometry.dispose();
        this.lasers.splice(index, 1);
    }

    getPlanes() {
        return this.planes;
    }
}
