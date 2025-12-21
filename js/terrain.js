import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

// Spacing constants to keep runways and mountains apart across chunks
const RUNWAY_SAFE_RADIUS = 120; // runway footprint + buffer
const MOUNTAIN_RADIUS_ESTIMATE = 150; // conservative base radius estimate pre-build
const RUNWAY_MOUNTAIN_BUFFER = 80; // extra gap to avoid visual overlap

export function getHeight(x, z) {
    // Bias height up so most is land (above -2).
    // Using simple noise: range approx -10 to +10.
    // We lift it by 5 so range is -5 to +15.
    return Math.sin(x * 0.05) * Math.cos(z * 0.05) * 5 + Math.sin(x * 0.01) * 5 + 4;
}

export class TerrainManager {
    constructor(scene, treeModel, runwayTexture, roundTreeModel, buildingModels = [], palmTreeModel = null, mushroomTreeModel = null, baobabTreeModel = null) {
        this.scene = scene;
        this.treeModel = treeModel;
        this.runwayTexture = runwayTexture;
        this.roundTreeModel = roundTreeModel;
        this.palmTreeModel = palmTreeModel;
        this.mushroomTreeModel = mushroomTreeModel;
        this.baobabTreeModel = baobabTreeModel;
        this.buildingModels = buildingModels;
        this.chunks = {};
        this.chunkSize = 1000;
        this.currentChunk = { x: Infinity, z: Infinity };
        this.activeTrees = [];
        this.activeBaobabTrees = [];
        this.activeBuildings = [];
        this.globalRunways = [];
        this.globalMountains = [];
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
                    this.chunks[key] = new Chunk(
                        x,
                        z,
                        this.chunkSize,
                        this.scene,
                        this.treeModel,
                        this.runwayTexture,
                        this.roundTreeModel,
                        this.buildingModels,
                        this,
                        this.palmTreeModel,
                        this.mushroomTreeModel,
                        this.baobabTreeModel
                    );
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
        this.activeBaobabTrees = [];
        this.activeBuildings = [];
        for (const key in this.chunks) {
            this.activeTrees.push(...this.chunks[key].trees);
            this.activeBaobabTrees.push(...this.chunks[key].baobabTrees);
            if (this.chunks[key].buildings) this.activeBuildings.push(...this.chunks[key].buildings);
        }
    }

    getTrees() {
        return { activeTrees: this.activeTrees, activeBaobabTrees: this.activeBaobabTrees };
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

    getBuildings() {
        return this.activeBuildings;
    }
    
    unregisterTree(tree) {
        this.activeTrees = this.activeTrees.filter(t => t !== tree);
        if (tree.userData && tree.userData.chunk) {
            const arr = tree.userData.chunk.trees;
            const idx = arr.indexOf(tree);
            if (idx >= 0) arr.splice(idx, 1);
        }
    }
    
    unregisterBaobabTree(tree) {
        this.activeBaobabTrees = this.activeBaobabTrees.filter(t => t !== tree);
        if (tree.userData && tree.userData.chunk) {
            const arr = tree.userData.chunk.baobabTrees;
            const idx = arr.indexOf(tree);
            if (idx >= 0) arr.splice(idx, 1);
        }
    }

    registerBuilding(building) {
        this.activeBuildings.push(building);
    }

    unregisterBuilding(building) {
        this.activeBuildings = this.activeBuildings.filter(b => b !== building);
        if (building.userData && building.userData.chunk) {
            const arr = building.userData.chunk.buildings;
            const idx = arr.indexOf(building);
            if (idx >= 0) arr.splice(idx, 1);
        }
    }

    registerRunway(runway) {
        this.globalRunways.push(runway);
    }

    unregisterRunway(runway) {
        this.globalRunways = this.globalRunways.filter(r => r !== runway);
    }

    registerMountain(mountain) {
        this.globalMountains.push(mountain);
    }

    unregisterMountain(mountain) {
        this.globalMountains = this.globalMountains.filter(m => m !== mountain);
    }
}

class Chunk {
    constructor(cx, cz, size, scene, treeModel, runwayTexture, roundTreeModel, buildingModels, manager, palmTreeModel, mushroomTreeModel, baobabTreeModel) {
        this.scene = scene;
        this.treeModel = treeModel;
        this.runwayTexture = runwayTexture;
        this.roundTreeModel = roundTreeModel;
        this.palmTreeModel = palmTreeModel;
        this.mushroomTreeModel = mushroomTreeModel;
        this.baobabTreeModel = baobabTreeModel;
        this.buildingModels = buildingModels;
        this.manager = manager;
        this.trees = [];
        this.baobabTrees = [];
        this.runways = [];
        this.buildings = [];
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
                    // Random Tree Type - equal distribution
                    let tree;
                    const treeTypes = [];
                    
                    // Build available tree types array
                    if (this.treeModel) treeTypes.push(this.treeModel);
                    if (this.roundTreeModel) treeTypes.push(this.roundTreeModel);
                    if (this.palmTreeModel) treeTypes.push(this.palmTreeModel);
                    if (this.mushroomTreeModel) treeTypes.push(this.mushroomTreeModel);
                    
                    // Pick random tree type
                    if (treeTypes.length > 0) {
                        const randomType = treeTypes[Math.floor(Math.random() * treeTypes.length)];
                        tree = randomType.clone();
                    } else {
                        continue; // No tree models available
                    }

                    tree.position.set(tx, ty, tz);

                    // Scale: Random multiplier (0.5 to 1.0)
                    // Use multiplyScalar to preserve the model's base scale
                    const s = 0.5 + Math.random() * 0.5;
                    tree.scale.multiplyScalar(s);
                    
                    // Store reference to chunk for unregistering
                    tree.userData.chunk = this;

                    scene.add(tree);
                    this.trees.push(tree);
                }
            }
        }

        // 3. Scatter Baobab Trees (Boss Trees) - 10 per chunk, separate from regular trees
        if (this.baobabTreeModel) {
            for (let i = 0; i < 10; i++) {
                const tLocalX = (Math.random() - 0.5) * size;
                const tLocalZ = (Math.random() - 0.5) * size;

                const tx = (cx * size) + tLocalX;
                const tz = (cz * size) + tLocalZ;

                // Exclusion zone around 0,0 for Runway
                if (cx === 0 && cz === 0) {
                    if (Math.abs(tx) < 100 && Math.abs(tz) < 250) continue;
                }

                const ty = getHeight(tx, tz);
                if (ty > -1) {
                    const tree = this.baobabTreeModel.clone();
                    tree.position.set(tx, ty, tz);

                    // No scale variation for boss trees - keep them impressively large
                    
                    // Store reference to chunk for unregistering
                    tree.userData.chunk = this;
                    
                    scene.add(tree);
                    this.baobabTrees.push(tree);
                }
            }
        }

        // 4. Mountain Range (One per chunk with 3-5 peaks)
        // Choose a position that is far from ALL runways (cross-chunk)
        const runwaysForCheck = this.manager ? this.manager.globalRunways : [];
        const maxMountainAttempts = 12;
        const chunkCenterX = cx * size;
        const chunkCenterZ = cz * size;

        let mX = chunkCenterX;
        let mZ = chunkCenterZ;
        let placedMountain = false;

        for (let attempt = 0; attempt < maxMountainAttempts; attempt++) {
            const mOffsetAngle = Math.random() * Math.PI * 2;
            const mOffsetDist = size * 0.3 + Math.random() * size * 0.15; // 30-45% from center
            const candidateX = chunkCenterX + Math.cos(mOffsetAngle) * mOffsetDist;
            const candidateZ = chunkCenterZ + Math.sin(mOffsetAngle) * mOffsetDist;

            let tooCloseToRunway = false;
            for (const r of runwaysForCheck) {
                const runwayRadius = (r.userData && r.userData.safeRadius) || RUNWAY_SAFE_RADIUS;
                const dist = Math.hypot(candidateX - r.position.x, candidateZ - r.position.z);
                if (dist < (MOUNTAIN_RADIUS_ESTIMATE + runwayRadius + RUNWAY_MOUNTAIN_BUFFER)) {
                    tooCloseToRunway = true;
                    break;
                }
            }

            if (!tooCloseToRunway) {
                mX = candidateX;
                mZ = candidateZ;
                placedMountain = true;
                break;
            }
        }

        if (!placedMountain && runwaysForCheck.length > 0) {
            // Fallback: place opposite the nearest runway
            let nearestRunway = runwaysForCheck[0];
            let nearestDist = Math.hypot(mX - nearestRunway.position.x, mZ - nearestRunway.position.z);
            for (const r of runwaysForCheck) {
                const d = Math.hypot(chunkCenterX - r.position.x, chunkCenterZ - r.position.z);
                if (d < nearestDist) {
                    nearestRunway = r;
                    nearestDist = d;
                }
            }
            const angleOppositeRunway = Math.atan2(nearestRunway.position.z - chunkCenterZ, nearestRunway.position.x - chunkCenterX) + Math.PI;
            const fallbackDist = size * 0.45;
            mX = chunkCenterX + Math.cos(angleOppositeRunway) * fallbackDist;
            mZ = chunkCenterZ + Math.sin(angleOppositeRunway) * fallbackDist;
        }

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
        if (this.manager) {
            this.manager.registerMountain(mountain);
        }

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

        // 4. Add pine trees around mountain range (10-15 trees)
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

        // 5. Runway (One per chunk) - placed after mountain to keep separation
        if (runwayTexture) {
            const rwGeo = new THREE.BoxGeometry(20, 30, 100);

            // Apply vertex flaring logic BEFORE rotation/translation
            const pos = rwGeo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const y = pos.getY(i);
                if (y < 0) {
                    pos.setX(i, pos.getX(i) * 2.5);
                    pos.setZ(i, pos.getZ(i) * 1.2);
                }
            }
            rwGeo.computeVertexNormals();

            const topMat = new THREE.MeshLambertMaterial({ map: runwayTexture });
            const sideMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
            const mats = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];

            const runway = new THREE.Mesh(rwGeo, mats);

            // Separation logic from mountain
            const minOffset = size * 0.10;
            const maxOffset = size * 0.30;
            const runwaySafeRadius = RUNWAY_SAFE_RADIUS; // covers 20x100 footprint with margin
            const mountainsForCheck = this.manager ? this.manager.globalMountains : (this.mountain ? [this.mountain] : []);
            const separationBuffer = RUNWAY_MOUNTAIN_BUFFER;

            let rX = cx * size;
            let rZ = cz * size;
            let rotY = 0;
            let placed = false;
            const maxAttempts = 10;

            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                const offsetDist = minOffset + Math.random() * (maxOffset - minOffset);
                const offsetAngle = Math.random() * Math.PI * 2;
                const offsetX = Math.cos(offsetAngle) * offsetDist;
                const offsetZ = Math.sin(offsetAngle) * offsetDist;

                rX = cx * size + offsetX;
                rZ = cz * size + offsetZ;

                let tooCloseToMountain = false;
                for (const m of mountainsForCheck) {
                    const mRadius = (m.userData && m.userData.baseRadius) || MOUNTAIN_RADIUS_ESTIMATE;
                    const distToMountain = Math.hypot(rX - m.position.x, rZ - m.position.z);
                    if (distToMountain < runwaySafeRadius + mRadius + separationBuffer) {
                        tooCloseToMountain = true;
                        break;
                    }
                }
                if (tooCloseToMountain) continue;

                rotY = Math.random() * Math.PI * 2;
                placed = true;
                break;
            }

            if (!placed && mountainsForCheck.length > 0) {
                let nearestMountain = mountainsForCheck[0];
                let nearestDist = Math.hypot(rX - nearestMountain.position.x, rZ - nearestMountain.position.z);
                for (const m of mountainsForCheck) {
                    const d = Math.hypot(cx * size - m.position.x, cz * size - m.position.z);
                    if (d < nearestDist) {
                        nearestMountain = m;
                        nearestDist = d;
                    }
                }
                const angleOppositeMountain = Math.atan2(nearestMountain.position.z - cz * size, nearestMountain.position.x - cx * size) + Math.PI;
                const fallbackDist = maxOffset;
                rX = cx * size + Math.cos(angleOppositeMountain) * fallbackDist;
                rZ = cz * size + Math.sin(angleOppositeMountain) * fallbackDist;
                rotY = Math.random() * Math.PI * 2;
            }

            runway.rotation.y = rotY;

            // Height Calculation
            let maxH = -Infinity;
            for (let dx = -60; dx <= 60; dx += 20) {
                for (let dz = -60; dz <= 60; dz += 20) {
                    const h = getHeight(rX + dx, rZ + dz);
                    if (h > maxH) maxH = h;
                }
            }
            const rY = maxH + 0.2;

            runway.position.set(rX, rY - 15, rZ);
            runway.receiveShadow = true;
            runway.updateMatrixWorld(true);
            runway.userData = runway.userData || {};
            runway.userData.safeRadius = runwaySafeRadius;

            scene.add(runway);
            this.runways.push(runway);
            if (this.manager) {
                this.manager.registerRunway(runway);
            }

            // Clear trees in runway area
            for (let i = this.trees.length - 1; i >= 0; i--) {
                const t = this.trees[i];
                const dx = t.position.x - rX;
                const dz = t.position.z - rZ;
                const dist = Math.sqrt(dx * dx + dz * dz);

                if (dist < 80) {
                    scene.remove(t);
                    this.trees.splice(i, 1);
                }
            }
        }

        // 6. Cities / Buildings (destructible) using prefab assets
        const numCities = 2; // ensure multiple chances per chunk
        const buildingsBefore = this.buildings.length;
        const prefabCount = this.buildingModels ? this.buildingModels.length : 0;

        const placeBuilding = (bx, bz, scale = 1) => {
            if (!prefabCount) return;
            const prefab = this.buildingModels[Math.floor(Math.random() * prefabCount)];
            if (!prefab.userData || !prefab.userData.baseHalfExtents) {
                const box = new THREE.Box3().setFromObject(prefab);
                const size = new THREE.Vector3();
                box.getSize(size);
                prefab.userData = prefab.userData || {};
                prefab.userData.baseHalfExtents = { x: size.x * 0.5, y: size.y * 0.5, z: size.z * 0.5 };
            }
            const building = prefab.clone(true);
            const s = scale * (0.9 + Math.random() * 0.2);
            building.scale.setScalar(s);
            const base = prefab.userData.baseHalfExtents;
            const box = new THREE.Box3().setFromObject(building);
            const size = new THREE.Vector3();
            box.getSize(size);
            const halfExtents = { x: size.x * 0.5, y: size.y * 0.5, z: size.z * 0.5 };
            const groundY = getHeight(bx, bz);
            // Align bottom of bounding box to ground
            building.position.set(bx, groundY - box.min.y, bz);
            // Refresh box after move for accuracy
            const boxPlaced = new THREE.Box3().setFromObject(building);
            const sizePlaced = new THREE.Vector3();
            boxPlaced.getSize(sizePlaced);
            const halfPlaced = { x: sizePlaced.x * 0.5, y: sizePlaced.y * 0.5, z: sizePlaced.z * 0.5 };

            // Prevent overlap with already placed buildings (simple AABB check in XZ with small buffer)
            const buffer = 2;
            for (const existing of this.buildings) {
                const he = existing.userData && existing.userData.halfExtents;
                if (!he) continue;
                const dx = Math.abs(bx - existing.position.x);
                const dz = Math.abs(bz - existing.position.z);
                if (dx < (halfPlaced.x + he.x + buffer) && dz < (halfPlaced.z + he.z + buffer)) {
                    return; // skip placement
                }
            }

            building.userData = {
                ...prefab.userData,
                halfExtents: halfPlaced,
                chunk: this
            };
            building.castShadow = true;
            building.receiveShadow = true;
            this.scene.add(building);
            this.buildings.push(building);
            if (this.manager) this.manager.registerBuilding(building);
        };

        for (let c = 0; c < numCities; c++) {
            const cityRadius = size * (0.15 + Math.random() * 0.15); // 15-30% of chunk
            const cityAngle = Math.random() * Math.PI * 2;
            const cityX = cx * size + Math.cos(cityAngle) * cityRadius;
            const cityZ = cz * size + Math.sin(cityAngle) * cityRadius;

            const buildingsInCity = 4 + Math.floor(Math.random() * 5); // 4-8 buildings
            for (let b = 0; b < buildingsInCity; b++) {
                const bx = cityX + (Math.random() - 0.5) * 80;
                const bz = cityZ + (Math.random() - 0.5) * 80;

                // Avoid placing too close to runway or mountain
                let skip = false;
                for (const r of this.runways) {
                    const dist = Math.hypot(bx - r.position.x, bz - r.position.z);
                    if (dist < 100) { skip = true; break; }
                }
                if (!skip && this.mountain) {
                    const distM = Math.hypot(bx - this.mountain.position.x, bz - this.mountain.position.z);
                    if (distM < ((this.mountain.userData && this.mountain.userData.baseRadius) || 150) + 40) skip = true;
                }
                if (skip) continue;

                const groundY = getHeight(bx, bz);
                if (groundY < -2) continue; // avoid water

                placeBuilding(bx, bz);
            }
        }

        // Fallback: ensure at least one building per chunk
        if (this.buildings.length === buildingsBefore) {
            const bx = cx * size + (Math.random() - 0.5) * 200;
            const bz = cz * size + (Math.random() - 0.5) * 200;
            const groundY = getHeight(bx, bz);
            if (groundY > -2) {
                placeBuilding(bx, bz, 1);
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

        for (const t of this.baobabTrees) {
            this.scene.remove(t);
            // Don't dispose tree geometry/material as it is shared cloned resource
        }
        this.baobabTrees = [];

        for (const r of this.runways) {
            if (this.manager) {
                this.manager.unregisterRunway(r);
            }
            this.scene.remove(r);
            r.geometry.dispose();
            // Don't dispose material if shared? Actually recreated each time here.
            if (Array.isArray(r.material)) r.material.forEach(m => m.dispose());
            else r.material.dispose();
        }
        this.runways = [];

        // Dispose mountain
        if (this.mountain) {
            if (this.manager) {
                this.manager.unregisterMountain(this.mountain);
            }
            this.scene.remove(this.mountain);
            this.mountain.geometry.dispose();
            this.mountain.material.dispose();
            this.mountain = null;
        }

        // Dispose buildings
        for (const b of this.buildings) {
            if (this.manager) this.manager.unregisterBuilding(b);
            this.scene.remove(b);
            if (b.geometry) b.geometry.dispose();
            if (b.material) {
                if (Array.isArray(b.material)) b.material.forEach(m => m.dispose());
                else b.material.dispose();
            }
        }
        this.buildings = [];
    }
}
