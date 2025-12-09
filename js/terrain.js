import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

export function getHeight(x, z) {
    // Bias height up so most is land (above -2).
    // Using simple noise: range approx -10 to +10.
    // We lift it by 5 so range is -5 to +15.
    return Math.sin(x * 0.05) * Math.cos(z * 0.05) * 5 + Math.sin(x * 0.01) * 5 + 4;
}

export class TerrainManager {
    constructor(scene, treeModel, runwayTexture, roundTreeModel) {
        this.scene = scene;
        this.treeModel = treeModel;
        this.runwayTexture = runwayTexture;
        this.roundTreeModel = roundTreeModel; // Store new model
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
                    this.chunks[key] = new Chunk(x, z, this.chunkSize, this.scene, this.treeModel, this.runwayTexture, this.roundTreeModel);
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

    getMountains() {
        const mountains = [];
        for (const key in this.chunks) {
            if (this.chunks[key].mountain) mountains.push(this.chunks[key].mountain);
        }
        return mountains;
    }
}

class Chunk {
    constructor(cx, cz, size, scene, treeModel, runwayTexture, roundTreeModel) {
        this.scene = scene;
        this.treeModel = treeModel;
        this.runwayTexture = runwayTexture;
        this.roundTreeModel = roundTreeModel;
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
                    // Random Tree Type
                    let tree;
                    // Check if roundTreeModel exists (Chunk constructor update needed to pass it)
                    // We need to update Chunk constructor first.
                    // Assuming this.roundTreeModel is available on the Chunk instance
                    // Wait, I need to update the constructor signature below.
                    // For now, let's assume it's passed.

                    if (this.roundTreeModel && Math.random() > 0.5) {
                        tree = this.roundTreeModel.clone();
                    } else {
                        tree = this.treeModel.clone();
                    }

                    tree.position.set(tx, ty, tz);

                    // Scale: Random multiplier (0.5 to 1.0)
                    // Use multiplyScalar to preserve the model's base scale
                    const s = 0.5 + Math.random() * 0.5;
                    tree.scale.multiplyScalar(s);

                    scene.add(tree);
                    this.trees.push(tree);
                }
            }
        }

        // 3. Runway (One per chunk)
        if (runwayTexture) {
            const rwGeo = new THREE.BoxGeometry(20, 30, 100);

            // Apply vertex flaring logic BEFORE rotation/translation
            // Flare the bottom 100% more (2.5x width at base)
            const pos = rwGeo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const y = pos.getY(i);
                if (y < 0) {
                    pos.setX(i, pos.getX(i) * 2.5); // 100% more flare (was 1.5)
                    pos.setZ(i, pos.getZ(i) * 1.2);
                }
            }
            rwGeo.computeVertexNormals();

            const topMat = new THREE.MeshLambertMaterial({ map: runwayTexture });
            const sideMat = new THREE.MeshLambertMaterial({ color: 0x111111 }); // Black
            const mats = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];

            const runway = new THREE.Mesh(rwGeo, mats);

            // Calculate Random Position
            // Center of chunk: cx * size, cz * size
            // Offset: 10% to 30% of size (size = 1000 => 100 to 300)
            const minOffset = size * 0.10;
            const maxOffset = size * 0.30;
            const offsetDist = minOffset + Math.random() * (maxOffset - minOffset);
            const offsetAngle = Math.random() * Math.PI * 2;

            const offsetX = Math.cos(offsetAngle) * offsetDist;
            const offsetZ = Math.sin(offsetAngle) * offsetDist;

            const rX = cx * size + offsetX;
            const rZ = cz * size + offsetZ;

            // Calculate Random Rotation
            const rotY = Math.random() * Math.PI * 2;
            runway.rotation.y = rotY;

            // Height Calculation
            let maxH = -Infinity;
            // Scan area in LOCAL space to cover the rotated runway footprint
            // Bounding radius is approx sqrt(10^2 + 50^2) ~= 51
            // Let's scan a safe radius around rX, rZ
            for (let dx = -60; dx <= 60; dx += 20) {
                for (let dz = -60; dz <= 60; dz += 20) {
                    const h = getHeight(rX + dx, rZ + dz);
                    if (h > maxH) maxH = h;
                }
            }
            const rY = maxH + 0.2;

            runway.position.set(rX, rY - 15, rZ); // -15 because height is 30, center at 0
            runway.receiveShadow = true;
            runway.updateMatrixWorld(true); // Ensure world matrix is up to date

            scene.add(runway);
            this.runways.push(runway);

            // Clear trees in runway area
            // Use OBB (Oriented Bounding Box) logic or simple safe radius
            // Safe radius: 60 units
            for (let i = this.trees.length - 1; i >= 0; i--) {
                const t = this.trees[i];
                const dx = t.position.x - rX;
                const dz = t.position.z - rZ;
                const dist = Math.sqrt(dx * dx + dz * dz);

                if (dist < 80) { // slightly larger than safe scan to be sure
                    scene.remove(t);
                    this.trees.splice(i, 1);
                }
            }
        }

        // 4. Mountain Range (One per chunk with 3-5 peaks)
        // Random position within chunk (avoiding center where runway might be)
        const mOffsetAngle = Math.random() * Math.PI * 2;
        const mOffsetDist = size * 0.3 + Math.random() * size * 0.15; // 30-45% from center
        const mX = cx * size + Math.cos(mOffsetAngle) * mOffsetDist;
        const mZ = cz * size + Math.sin(mOffsetAngle) * mOffsetDist;
        const mBaseY = getHeight(mX, mZ);

        // Multi-Peak Mountain using merged geometries
        const numPeaks = 3 + Math.floor(Math.random() * 3); // 3-5 peaks
        const mergedGeometries = [];

        // Ground color (green/brown like terrain)
        const groundColor = new THREE.Color(0x3b7d3b); // Green base
        const snowColor = new THREE.Color(0xFFFFFF); // White snow

        let maxRadius = 0;

        for (let p = 0; p < numPeaks; p++) {
            // Each peak has slightly different size and position
            const peakHeight = 60 + Math.random() * 100; // 60-160 units tall
            const peakRadius = 40 + Math.random() * 30; // 40-70 units radius
            maxRadius = Math.max(maxRadius, peakRadius);

            // Offset each peak from center (first peak at center)
            const peakOffsetDist = p === 0 ? 0 : 20 + Math.random() * 40;
            const peakOffsetAngle = Math.random() * Math.PI * 2;
            const peakX = peakOffsetDist * Math.cos(peakOffsetAngle);
            const peakZ = peakOffsetDist * Math.sin(peakOffsetAngle);

            // Create cone geometry
            const radialSegments = 8;
            const heightSegments = 5;
            const peakGeo = new THREE.ConeGeometry(peakRadius, peakHeight, radialSegments, heightSegments);

            // Add vertex colors for snow gradient
            const peakPositions = peakGeo.attributes.position;
            const peakColors = [];

            for (let i = 0; i < peakPositions.count; i++) {
                const y = peakPositions.getY(i);
                // Height factor: 0 at base, 1 at top
                const heightFactor = (y + peakHeight / 2) / peakHeight;

                // Snow starts at 75% height, fully white at top
                let color = groundColor.clone();
                if (heightFactor > 0.75) {
                    const snowFactor = (heightFactor - 0.75) / 0.25; // 0 to 1 in top 25%
                    color.lerp(snowColor, snowFactor);
                }

                peakColors.push(color.r, color.g, color.b);

                // Get current vertex position
                const x = peakPositions.getX(i);
                const z = peakPositions.getZ(i);

                // Base flaring: expand lower half to ~1.4x radius (doubles surface area)
                // Flare factor: 1.4 at base, 1.0 at 50% height, 1.0 above
                let flareFactor = 1.0;
                if (heightFactor < 0.5) {
                    // Linear flare from 1.4 at bottom to 1.0 at midpoint
                    flareFactor = 1.4 - (heightFactor / 0.5) * 0.4;
                }

                // Add slight random displacement for natural look
                let expansion = flareFactor;
                if (heightFactor < 0.9 && heightFactor > 0.1) {
                    expansion *= 1 + (Math.random() - 0.5) * 0.2;
                    const noise = (Math.random() - 0.5) * 8;
                    peakPositions.setY(i, y + noise);
                }

                peakPositions.setX(i, x * expansion);
                peakPositions.setZ(i, z * expansion);
            }

            peakGeo.setAttribute('color', new THREE.Float32BufferAttribute(peakColors, 3));

            // Translate peak to its position
            peakGeo.translate(peakX, peakHeight / 2, peakZ);

            peakGeo.computeVertexNormals();
            mergedGeometries.push(peakGeo);
        }

        // Merge all peak geometries
        const mountainGeo = BufferGeometryUtils.mergeGeometries(mergedGeometries, false);

        const mountainMat = new THREE.MeshLambertMaterial({
            vertexColors: true,
            flatShading: true
        });

        const mountain = new THREE.Mesh(mountainGeo, mountainMat);
        mountain.position.set(mX, mBaseY, mZ);
        mountain.castShadow = true;
        mountain.receiveShadow = true;

        // Store collision data (account for flared base: 1.4x maxRadius)
        mountain.userData.baseRadius = maxRadius * 1.4; // Just the flared peak radius
        mountain.userData.maxHeight = 160; // Max possible peak height

        scene.add(mountain);
        this.mountain = mountain;

        // Clear trees near mountain
        for (let i = this.trees.length - 1; i >= 0; i--) {
            const t = this.trees[i];
            const dx = t.position.x - mX;
            const dz = t.position.z - mZ;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < maxRadius + 40) { // Clear trees within mountain range radius
                scene.remove(t);
                this.trees.splice(i, 1);
            }
        }

        // 5. Add pine trees around mountain range (10-15 trees)
        // Place trees OUTSIDE the mountain base, on the surrounding ground
        if (this.treeModel) {
            const numTrees = 10 + Math.floor(Math.random() * 6); // 10-15

            // Use stored baseRadius for consistency
            const treeRadius = mountain.userData.baseRadius || maxRadius * 1.4;

            // Place trees around the outer edge of the mountain
            for (let i = 0; i < numTrees; i++) {
                const treeAngle = Math.random() * Math.PI * 2;
                // Place at 100-130% of the mountain's base radius (outside the collision zone)
                const treeDist = treeRadius * (1.0 + Math.random() * 0.3);
                const tX = mX + Math.cos(treeAngle) * treeDist;
                const tZ = mZ + Math.sin(treeAngle) * treeDist;
                const tY = getHeight(tX, tZ);

                // Skip if underwater
                if (tY < -1) continue;

                // Pine trees only
                const tree = this.treeModel.clone();

                tree.position.set(tX, tY, tZ);

                // Random scale (0.5-1.0)
                const s = 0.5 + Math.random() * 0.5;
                tree.scale.multiplyScalar(s);

                scene.add(tree);
                this.trees.push(tree);
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

        // Dispose mountain
        if (this.mountain) {
            this.scene.remove(this.mountain);
            this.mountain.geometry.dispose();
            this.mountain.material.dispose();
            this.mountain = null;
        }
    }
}
