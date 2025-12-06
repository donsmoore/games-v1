import * as THREE from 'three';

export function getHeight(x, z) {
    // Bias height up so most is land (above -2).
    // Using simple noise: range approx -10 to +10.
    // We lift it by 5 so range is -5 to +15.
    return Math.sin(x * 0.05) * Math.cos(z * 0.05) * 5 + Math.sin(x * 0.01) * 5 + 4;
}

export class TerrainManager {
    constructor(scene, treeModel, runwayTexture) {
        this.scene = scene;
        this.treeModel = treeModel;
        this.runwayTexture = runwayTexture;
        this.chunks = {};
        this.chunkSize = 1000;
        this.currentChunk = { x: Infinity, z: Infinity };
        this.activeTrees = [];
    }

    update(pos) {
        // Calculate which chunk the player is in
        // Shift +0.5 to center the grid better? Math.floor handles standard caching.
        const cx = Math.floor((pos.x + this.chunkSize / 2) / this.chunkSize);
        const cz = Math.floor((pos.z + this.chunkSize / 2) / this.chunkSize);

        if (this.currentChunk.x !== cx || this.currentChunk.z !== cz) {
            this.currentChunk = { x: cx, z: cz };
            this.updateChunks(cx, cz);
        }
    }

    updateChunks(centerCX, centerCZ) {
        const keepKeys = new Set();
        // Load 3x3 grid (current + neighbors)
        // Range: -1 to +1 chunk index
        for (let x = centerCX - 1; x <= centerCX + 1; x++) {
            for (let z = centerCZ - 1; z <= centerCZ + 1; z++) {
                const key = `${x},${z}`;
                keepKeys.add(key);
                if (!this.chunks[key]) {
                    this.chunks[key] = new Chunk(x, z, this.chunkSize, this.scene, this.treeModel, this.runwayTexture);
                }
            }
        }

        // Unload old
        for (const key in this.chunks) {
            if (!keepKeys.has(key)) {
                this.chunks[key].dispose();
                delete this.chunks[key];
            }
        }

        // Rebuild active trees list for collision
        this.activeTrees = [];
        for (const key in this.chunks) {
            this.activeTrees.push(...this.chunks[key].trees);
        }
    }

    getTrees() {
        return this.activeTrees;
    }

    getRunways() {
        const runways = [];
        for (const key in this.chunks) {
            if (this.chunks[key].runways) runways.push(...this.chunks[key].runways);
        }
        return runways;
    }
}

class Chunk {
    constructor(cx, cz, size, scene, treeModel, runwayTexture) {
        this.scene = scene;
        this.trees = [];
        this.runways = [];
        this.mesh = null;

        const startX = cx * size - size / 2;
        const startZ = cz * size - size / 2;

        // 1. Create Ground
        // Reduced resolution for speed if generating constantly? 
        // 1000 size, 50 segs = 20 units/seg. Good enough.
        const geometry = new THREE.PlaneGeometry(size, size, 50, 50);

        const positions = geometry.attributes.position;
        const colors = [];
        const color = new THREE.Color();

        for (let i = 0; i < positions.count; i++) {
            // PlaneGeometry is created at 0,0. We need to apply offset manually to Vertex Data
            // OR we can just generate Z based on world coords.
            // PlaneGeometry vertices: x from -size/2 to size/2.

            // World X = meshPos.x + localX
            // We haven't moved mesh yet.
            const localX = positions.getX(i);
            const localY = positions.getY(i); // This is Z in world space before rotation

            // Apply World Offset to position logic (centered at startX + size/2, startZ + size/2 ?)
            // Actually, let's offset the mesh position to (cx*size, 0, cz*size).
            // So local (0,0) is center of chunk.

            const worldX = (cx * size) + localX;
            const worldZ = (cz * size) - localY; // Plane is X-Y. Rotated -90 X => Y becomes Z.
            // Wait, PlaneGeometry default faces +Z. 
            // X is Right, Y is Up. 
            // After rotateX(-PI/2): X is Right, Y is Forward (-Z?).
            // Let's stick to standard:
            // getX, getY (local).
            // WorldX = (cx*size) + localX.
            // WorldZ = (cz*size) + localY (after rotation logic applied mentally).

            const h = getHeight(worldX, worldZ);
            positions.setZ(i, h); // Set Z (which becomes Y up)

            // Color Logic (Same as before)
            color.setHex(0x3b7d3b); // Green
            const noise = Math.random() * 0.2 - 0.1;

            if (h > 8) {
                color.setHex(0x5a5a5a); // Rock
            } else if (h < 0) {
                color.setHex(0xc2b280); // Sand
            } else {
                color.r = Math.max(0, Math.min(1, color.r + noise));
                color.g = Math.max(0, Math.min(1, color.g + noise));
                color.b = Math.max(0, Math.min(1, color.b + noise));
            }
            colors.push(color.r, color.g, color.b);
        }

        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.computeVertexNormals();
        geometry.rotateX(-Math.PI / 2);

        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.8,
            metalness: 0.1,
            side: THREE.DoubleSide
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(cx * size, 0, cz * size);
        this.mesh.receiveShadow = true;
        scene.add(this.mesh);

        // 2. Scatter Trees
        if (treeModel) {
            // 20 trees per chunk? (1000x1000 is large, original was 2000x2000 with 50 trees)
            // Original: 2000x2000 = 4M units^2. 50 trees.
            // Chunk: 1000x1000 = 1M units^2.
            // Should have ~12 trees to match density. Let's do 20 for "forest".
            for (let i = 0; i < 20; i++) {
                const tLocalX = (Math.random() - 0.5) * size;
                const tLocalZ = (Math.random() - 0.5) * size;

                const tx = (cx * size) + tLocalX;
                const tz = (cz * size) + tLocalZ;

                // Exclusion zone around 0,0 for Runway (if chunk is 0,0)
                if (cx === 0 && cz === 0) {
                    if (Math.abs(tx) < 50 && Math.abs(tz) < 200) continue;
                }

                const ty = getHeight(tx, tz);
                if (ty > -1) {
                    const tree = treeModel.clone();
                    tree.position.set(tx, ty, tz);

                    // Scale: Base 1.0 (OBJ is 10x baked)
                    const s = 1.0 * (0.5 + Math.random() * 0.5);
                    tree.scale.set(s, s, s);

                    scene.add(tree);
                    this.trees.push(tree);
                }
            }
        }

        // 3. Runway (One per chunk)
        if (runwayTexture) {
            const rwGeo = new THREE.BoxGeometry(20, 30, 100);
            // ... vertex flaring logic ...
            const pos = rwGeo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const y = pos.getY(i);
                if (y < 0) {
                    pos.setX(i, pos.getX(i) * 1.5);
                    pos.setZ(i, pos.getZ(i) * 1.1);
                }
            }
            rwGeo.computeVertexNormals();

            const topMat = new THREE.MeshLambertMaterial({ map: runwayTexture });
            const sideMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
            const mats = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];

            const runway = new THREE.Mesh(rwGeo, mats);

            // Position
            // Center of chunk: cx*size, cz*size
            // Height: Find max height in this area?
            // Simplification: Check center height or a few points.
            // Let's stick to center.
            const rX = cx * size;
            const rZ = cz * size;

            let maxH = -Infinity;
            // Scan area where runway will be (20x100)
            for (let dx = -10; dx <= 10; dx += 10) {
                for (let dz = -50; dz <= 50; dz += 10) {
                    const h = getHeight(rX + dx, rZ + dz);
                    if (h > maxH) maxH = h;
                }
            }
            const rY = maxH + 0.2;

            runway.position.set(rX, rY - 15, rZ); // -15 because height is 30, center at 0
            runway.receiveShadow = true;

            scene.add(runway);
            this.runways.push(runway); // Store for disposal and minimap

            // Clear trees in runway area?
            // We already generated trees.
            // Maybe remove trees that are too close to runway?
            // Iterate this.trees and remove if close.
            for (let i = this.trees.length - 1; i >= 0; i--) {
                const t = this.trees[i];
                const dx = t.position.x - rX;
                const dz = t.position.z - rZ;
                if (Math.abs(dx) < 30 && Math.abs(dz) < 80) {
                    scene.remove(t);
                    this.trees.splice(i, 1);
                }
            }
        }
    }

    dispose() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();

        for (const t of this.trees) {
            this.scene.remove(t);
            // Don't dispose tree geometry/material as it is shared cloned resource
        }
        this.trees = [];

        for (const r of this.runways) {
            this.scene.remove(r);
            r.geometry.dispose();
            // Don't dispose material if shared? Actually recreated each time here.
            if (Array.isArray(r.material)) r.material.forEach(m => m.dispose());
            else r.material.dispose();
        }
        this.runways = [];
    }
}
