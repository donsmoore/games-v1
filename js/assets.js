import * as THREE from 'three';

import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';

const objLoader = new OBJLoader();
const mtlLoader = new MTLLoader();

/**
 * Advanced OBJ loader with MTL, texture, and vertex color support
 * 
 * Loading priority:
 * 1. If .mtl file exists → Use materials from MTL (with textures)
 * 2. If geometry has vertex colors → Use vertex colors
 * 3. Otherwise → Fall back to provided material callback
 * 
 * @param {string} objPath - Path to .obj file (e.g., 'assets/model.obj')
 * @param {Function} fallbackMaterialFn - Function(child) that assigns materials if no MTL/colors found
 * @param {Object} options - Additional options
 * @returns {Promise<THREE.Group>}
 */
async function loadOBJWithMaterials(objPath, fallbackMaterialFn, options = {}) {
    const basePath = objPath.substring(0, objPath.lastIndexOf('/') + 1);
    const filename = objPath.split('/').pop(); // Just the filename
    const mtlFilename = filename.replace('.obj', '.mtl');
    
    return new Promise((resolve, reject) => {
        // Try to load MTL file first
        mtlLoader.setPath(basePath);
        mtlLoader.load(
            mtlFilename + '?v=' + Date.now(),
            
            // MTL loaded successfully
            (materials) => {
                console.log(`✓ MTL loaded: ${basePath}${mtlFilename}`);
                materials.preload();
                objLoader.setMaterials(materials);
                
                // Load OBJ with materials
                objLoader.load(
                    objPath + '?v=' + Date.now(),
                    (group) => {
                        processLoadedGroup(group, null, options);
                        resolve(group);
                    },
                    undefined,
                    (error) => reject(error)
                );
            },
            
            // MTL loading in progress
            undefined,
            
            // MTL not found or error - load OBJ without materials
            () => {
                console.log(`ℹ No MTL file found for ${objPath}, checking vertex colors...`);
                objLoader.setMaterials(null); // Clear any previous materials
                
                objLoader.load(
                    objPath + '?v=' + Date.now(),
                    (group) => {
                        processLoadedGroup(group, fallbackMaterialFn, options);
                        resolve(group);
                    },
                    undefined,
                    (error) => reject(error)
                );
            }
        );
    });
}

/**
 * Process loaded group - handle vertex colors and fallback materials
 */
function processLoadedGroup(group, fallbackMaterialFn, options) {
    group.traverse((child) => {
        if (child.isMesh) {
            // Enable shadows
            child.castShadow = options.castShadow !== false;
            child.receiveShadow = options.receiveShadow !== false;
            
            // Check if material was loaded from MTL
            const hasMTLMaterial = child.material && 
                                   child.material.name && 
                                   child.material.name !== '';
            
            // Check if geometry has vertex colors
            const hasVertexColors = child.geometry.attributes.color !== undefined;
            
            if (hasMTLMaterial) {
                // Material from MTL file - keep it but ensure proper settings
                console.log(`✓ Using MTL material for ${child.name}: ${child.material.name}`);
                
                // Enhance MTL material with shadows and proper sides
                if (child.material.map) {
                    console.log(`  ✓ Texture map found: ${child.material.map.image?.src || 'loading...'}`);
                }
                
                // Ensure double-sided if needed
                if (options.doubleSided) {
                    child.material.side = THREE.DoubleSide;
                }
                
            } else if (hasVertexColors) {
                // Use vertex colors from OBJ file
                console.log(`✓ Using vertex colors for ${child.name}`);
                
                // Create material that uses vertex colors
                const materialType = options.materialType || 'phong';
                let material;
                
                if (materialType === 'standard') {
                    material = new THREE.MeshStandardMaterial({
                        vertexColors: true,
                        roughness: options.roughness || 0.8,
                        metalness: options.metalness || 0.1,
                        side: options.doubleSided ? THREE.DoubleSide : THREE.FrontSide
                    });
                } else if (materialType === 'lambert') {
                    material = new THREE.MeshLambertMaterial({
                        vertexColors: true,
                        side: options.doubleSided ? THREE.DoubleSide : THREE.FrontSide
                    });
                } else { // phong
                    material = new THREE.MeshPhongMaterial({
                        vertexColors: true,
                        shininess: options.shininess || 30,
                        side: options.doubleSided ? THREE.DoubleSide : THREE.FrontSide
                    });
                }
                
                child.material = material;
                
            } else if (fallbackMaterialFn) {
                // No MTL, no vertex colors - use fallback function
                console.log(`ℹ Using fallback material for ${child.name}`);
                fallbackMaterialFn(child);
            }
            
            // Special handling for specific parts
            if (options.onMeshProcessed) {
                options.onMeshProcessed(child);
            }
        }
    });
}

/**
 * Load F-16 fighter jet
 */
export function loadF16() {
    return loadOBJWithMaterials(
        'assets/f16.obj',
        (child) => {
            // Fallback materials if no MTL/vertex colors
            if (child.name.includes('Cockpit')) {
                child.material = new THREE.MeshPhongMaterial({
                    color: 0x88CCFF,
                    shininess: 100,
                    transparent: true,
                    opacity: 0.7,
                    side: THREE.DoubleSide
                });
            } else if (child.name.includes('Gear') || child.parent.name.includes('Gear') || child.name.includes('Cannon')) {
                child.material = new THREE.MeshPhongMaterial({
                    color: 0x333333,
                    side: THREE.DoubleSide
                });
            } else if (child.name.includes('Wings') || child.name.includes('Tail') || child.name.includes('Stabilizers')) {
                child.material = new THREE.MeshPhongMaterial({
                    color: 0x444444,
                    side: THREE.DoubleSide
                });
            } else {
                // Fuselage, Nose
                child.material = new THREE.MeshPhongMaterial({
                    color: 0x555555,
                    side: THREE.DoubleSide
                });
            }
        },
        {
            doubleSided: true,
            materialType: 'phong',
            onMeshProcessed: (child) => {
                // Hide stabilizers
                if (child.name === 'Stabilizers') {
                    child.visible = false;
                }
            }
        }
    );
}

/**
 * Load Pine Tree
 */
export function loadTree() {
    return loadOBJWithMaterials(
        'assets/pine_tree.obj',
        (child) => {
            // Fallback materials
            if (child.name.includes('Trunk')) {
                child.material = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
            } else {
                // Leaves
                child.material = new THREE.MeshLambertMaterial({ color: 0x228B22 });
            }
        },
        {
            materialType: 'lambert'
        }
    );
}

/**
 * Load Round Tree
 */
export function loadRoundTree() {
    return loadOBJWithMaterials(
        'assets/round_tree.obj',
        (child) => {
            // Fallback materials
            if (child.name.includes('Trunk')) {
                child.material = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
            } else {
                // Leaves
                child.material = new THREE.MeshLambertMaterial({ color: 0x2E8B57 });
            }
        },
        {
            materialType: 'lambert'
        }
    ).then((group) => {
        // Tag for hitbox calculation
        group.userData.treeType = 'round';
        group.userData.baseRadius = 17.5;  // Was 3.5, now 5x larger (baked scale)
        group.userData.baseHeight = 42.5;  // Was 8.5, now 5x larger (baked scale)
        return group;
    });
}

/**
 * Load Palm Tree
 */
export function loadPalmTree() {
    return loadOBJWithMaterials(
        'assets/palm_tree.obj',
        (child) => {
            // Fallback materials
            if (child.name.includes('Trunk')) {
                child.material = new THREE.MeshLambertMaterial({ color: 0x8B7355 });
            } else {
                // Leaves
                child.material = new THREE.MeshLambertMaterial({ 
                    color: 0x228B22,
                    side: THREE.DoubleSide 
                });
            }
        },
        {
            materialType: 'lambert',
            doubleSided: true
        }
    ).then((group) => {
        // Tag for hitbox calculation
        group.userData.treeType = 'palm';
        group.userData.baseRadius = 15.0; // Leaf spread radius
        group.userData.baseHeight = 30.0; // Trunk height
        return group;
    });
}

/**
 * Load Mushroom Tree
 */
export function loadMushroomTree() {
    return loadOBJWithMaterials(
        'assets/mushroom_tree.obj',
        (child) => {
            // Fallback materials
            if (child.name.includes('Stalk')) {
                child.material = new THREE.MeshLambertMaterial({ color: 0xF5DEB3 });
            } else if (child.name.includes('Cap')) {
                child.material = new THREE.MeshLambertMaterial({ color: 0xFF6347 });
            } else {
                // Spots
                child.material = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
            }
        },
        {
            materialType: 'lambert'
        }
    ).then((group) => {
        // Tag for hitbox calculation
        group.userData.treeType = 'mushroom';
        group.userData.baseRadius = 15.0; // Cap radius
        group.userData.baseHeight = 17.5; // Total height (stalk + cap)
        return group;
    });
}

/**
 * Load Baobab Tree (Boss Tree with HP)
 */
export function loadBaobabTree() {
    return loadOBJWithMaterials(
        'assets/baobab_tree.obj',
        (child) => {
            // Fallback materials
            if (child.name.includes('Trunk')) {
                child.material = new THREE.MeshLambertMaterial({ color: 0x8B7355 });
            } else if (child.name.includes('Branches')) {
                child.material = new THREE.MeshLambertMaterial({ color: 0x654321 });
            } else {
                // Leaves
                child.material = new THREE.MeshLambertMaterial({ color: 0x228B22 });
            }
        },
        {
            materialType: 'lambert'
        }
    ).then((group) => {
        // Tag for hitbox calculation and HP system
        group.userData.treeType = 'baobab';
        group.userData.baseRadius = 20.0; // Thick trunk radius
        group.userData.baseHeight = 70.0; // Total height
        group.userData.maxHP = 10; // Requires 10 hits
        group.userData.currentHP = 10; // Current health
        group.userData.isBossTree = true; // Special flag
        return group;
    });
}

/**
 * Load Building
 */
export async function loadBuilding(type = 2) {
    const map = { 2: 'building_2', 3: 'building_3', 5: 'building_5' };
    const key = map[type] || 'building_2';
    
    const group = await loadOBJWithMaterials(
        `assets/${key}.obj`,
        (child) => {
            // Fallback materials
            if (child.name.includes('BuildingBody')) {
                child.material = new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    roughness: 0.85,
                    metalness: 0.0
                });
            } else if (child.name.includes('Window')) {
                child.material = new THREE.MeshStandardMaterial({
                    color: 0x000000,
                    roughness: 0.8,
                    metalness: 0.0
                });
            }
        },
        {
            materialType: 'standard'
        }
    );
    
    // Compute base half extents for placement/collision
    const box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box.getSize(size);
    group.userData.baseHalfExtents = {
        x: size.x * 0.5,
        y: size.y * 0.5,
        z: size.z * 0.5
    };
    
    return group;
}

/**
 * Load Runway Texture
 */
export function loadRunwayTexture() {
    const loader = new THREE.TextureLoader();
    return loader.load('assets/runway.png');
}
