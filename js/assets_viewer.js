import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';

let renderer, scene, camera, controls;
let currentAsset = null;
let assetManifest = [];

const LS_KEY = 'assets-viewer-default';
const assetPicker = document.getElementById('asset-picker');

init();
animate();

async function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
    camera.position.set(40, 25, 60);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7);
    hemi.position.set(0, 200, 0);
    scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(50, 100, 50);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    scene.add(dir);

    // Ground
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(500, 500),
        new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid helper
    const grid = new THREE.GridHelper(500, 50, 0x555555, 0x333333);
    scene.add(grid);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.ROTATE,
        RIGHT: THREE.MOUSE.PAN
    };

    // Load asset manifest and populate picker
    await loadManifest();
    populatePicker();

    // Load saved or first asset
    const saved = localStorage.getItem(LS_KEY) || (assetManifest[0]?.id);
    if (assetPicker && saved) {
        assetPicker.value = saved;
        await loadAsset(saved);
    }

    window.addEventListener('resize', onResize);
}

async function loadManifest() {
    try {
        // Dynamically scan assets folder via PHP script
        const response = await fetch(`assets/list_assets.php?t=${Date.now()}`);
        assetManifest = await response.json();
        console.log(`✓ Dynamically loaded ${assetManifest.length} assets`);
        assetManifest.forEach(asset => {
            console.log(`  - ${asset.name} (${asset.objFile})`);
        });
    } catch (error) {
        console.error('Failed to load assets:', error);
        console.log('Tip: Make sure PHP is enabled on your server');
        assetManifest = [];
    }
}

function populatePicker() {
    if (!assetPicker) return;

    // Clear existing options
    assetPicker.innerHTML = '';

    // Add options from manifest
    assetManifest.forEach(asset => {
        const option = document.createElement('option');
        option.value = asset.id;
        option.textContent = asset.name;
        assetPicker.appendChild(option);
    });

    // Add change listener
    assetPicker.addEventListener('change', () => {
        const val = assetPicker.value;
        localStorage.setItem(LS_KEY, val);
        loadAsset(val);
    });
}

function fitCameraToObject(object, camera, controls) {
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let distance = maxDim / (2 * Math.tan(fov / 2));
    distance *= 1.6; // padding

    const dir = new THREE.Vector3(1, 0.5, 1).normalize();
    const newPos = center.clone().add(dir.multiplyScalar(distance));
    camera.position.copy(newPos);
    camera.lookAt(center);
    if (controls) {
        controls.target.copy(center);
        controls.update();
    }
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();
    renderer.render(scene, camera);
}

async function loadAsset(assetId) {
    const asset = assetManifest.find(a => a.id === assetId);
    if (!asset) {
        console.error(`Asset not found: ${assetId}`);
        return;
    }

    try {
        console.log(`Loading asset: ${asset.name}`);
        
        // Remove current asset
        if (currentAsset) {
            scene.remove(currentAsset);
        }

        // Load OBJ with MTL
        const obj = await loadOBJWithMTL(`assets/${asset.objFile}`, `assets/${asset.mtlFile}`);
        obj.position.set(0, 0, 0);
        
        // Debug: Check what we got
        console.log(`Object loaded, children: ${obj.children.length}`);
        let meshCount = 0;
        obj.traverse(child => {
            if (child.isMesh) {
                meshCount++;
                console.log(`  Mesh ${meshCount}: ${child.name}, has material: ${!!child.material}, wireframe: ${child.material?.wireframe}, hasTexture: ${!!child.material?.map}`);
            }
        });
        console.log(`Total meshes found: ${meshCount}`);

        // Special positioning for certain assets
        if (asset.id === 'f16') {
            obj.position.y = 5;
        }

        currentAsset = obj;
        scene.add(obj);
        fitCameraToObject(obj, camera, controls);
        
        console.log(`✓ Loaded: ${asset.name}`);
    } catch (error) {
        console.error(`Failed to load asset ${asset.name}:`, error);
    }
}

function loadOBJWithMTL(objPath, mtlPath) {
    return new Promise((resolve, reject) => {
        const mtlLoader = new MTLLoader();
        const objLoader = new OBJLoader();

        // Extract base path for MTL loader
        const basePath = objPath.substring(0, objPath.lastIndexOf('/') + 1);
        mtlLoader.setPath(basePath);

        // Extract just the filename for MTL
        const mtlFilename = mtlPath.substring(mtlPath.lastIndexOf('/') + 1);

        // Try to load MTL first
        mtlLoader.load(
            encodeURIComponent(mtlFilename) + '?v=' + Date.now(),
            (materials) => {
                console.log(`✓ MTL loaded: ${mtlFilename}`);
                materials.preload();
                
                // Debug: Check materials and textures
                Object.keys(materials.materials).forEach(matName => {
                    const mat = materials.materials[matName];
                    if (mat.map) {
                        console.log(`  Material ${matName} has diffuse texture`);
                    } else {
                        console.log(`  Material ${matName} - no textures, using color`);
                    }
                });
                
                objLoader.setMaterials(materials);
                
                // Load OBJ with materials
                objLoader.load(
                    objPath + '?v=' + Date.now(),
                    (object) => {
                        console.log(`OBJ loaded, type: ${object.type}, children: ${object.children.length}`);
                        
                        // Enable shadows and check materials
                        object.traverse((child) => {
                            console.log(`  Traversing: ${child.type} - ${child.name}`);
                            if (child.isMesh) {
                                child.castShadow = true;
                                child.receiveShadow = true;
                                
                                // Debug: Check if wireframe is on
                                if (child.material) {
                                    if (child.material.wireframe) {
                                        console.warn(`  Wireframe is ON for ${child.name}!`);
                                        child.material.wireframe = false;
                                    }
                                    
                                    // Check if texture loaded
                                    if (child.material.map) {
                                        console.log(`  ✓ ${child.name} has texture map`);
                                    } else {
                                        console.log(`  ⚠ ${child.name} has NO texture (using color only)`);
                                    }
                                }
                            }
                        });
                        resolve(object);
                    },
                    undefined,
                    reject
                );
            },
            undefined,
            (error) => {
                // MTL failed, try loading OBJ without materials
                console.warn(`MTL not found for ${objPath}, loading OBJ only`);
                objLoader.load(
                    objPath + '?v=' + Date.now(),
                    (object) => {
                        // Apply default material
                        object.traverse((child) => {
                            if (child.isMesh) {
                                child.material = new THREE.MeshLambertMaterial({ color: 0xcccccc });
                                child.castShadow = true;
                                child.receiveShadow = true;
                            }
                        });
                        resolve(object);
                    },
                    undefined,
                    reject
                );
            }
        );
    });
}
