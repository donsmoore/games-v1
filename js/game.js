import * as THREE from 'three';
import { TerrainManager, getHeight } from './terrain.js?v=2';
import { loadF16, loadTree, loadRunwayTexture } from './assets.js';
import { updateControls, getPlaneObject, resetSpeed, planeSpeed } from './controls.js?v=2';

// Global variables
let camera, scene, renderer;
let plane;
let clock;
let startY = 10;
let terrainManager;

// Camera Control Variables
let isLooking = false;
let camYaw = 0;
let camPitch = 0;

// Explosion Vars
let isCrashed = false;
let isTaxiing = false;
let readyToLand = false;
let taxiTarget = null;
let explosions = [];
let bullets = [];

init();
// Animation handled inside init via requestAnimationFrame on load

async function init() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue
    scene.fog = new THREE.Fog(0x87CEEB, 200, 1000);

    // Camera setup
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 10, 20);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    clock = new THREE.Clock();

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(100, 200, 50);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 100;
    dirLight.shadow.camera.bottom = -100;
    dirLight.shadow.camera.left = -100;
    dirLight.shadow.camera.right = 100;
    // Enhance shadow quality
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // Environment & Infinite Terrain
    const treeModel = await loadTree();

    // Load Runway Texture for TerrainManager
    const runwayTex = loadRunwayTexture();
    runwayTex.wrapS = THREE.RepeatWrapping;
    runwayTex.wrapT = THREE.RepeatWrapping;

    terrainManager = new TerrainManager(scene, treeModel, runwayTex);
    terrainManager.update(new THREE.Vector3(0, 0, 0));

    // Global start height - Calculate based on runway height at 0,0
    let maxRunwayHeight = -Infinity;
    // Scan area corresponding to the runway at 0,0 (same as in TerrainManager)
    for (let x = -10; x <= 10; x += 10) {
        for (let z = -50; z <= 50; z += 10) {
            const h = getHeight(x, z);
            if (h > maxRunwayHeight) maxRunwayHeight = h;
        }
    }
    const runwaySurfaceY = maxRunwayHeight + 0.2;
    startY = runwaySurfaceY + 1.0; // Align wheels to surface (Wheels are approx -1.0 local Y)

    // Assets & Player
    plane = await loadF16();
    plane.position.set(0, startY, 40); // Start on runway
    scene.add(plane);
    // Initialize controls with the plane
    // We'll handle this linking logic in controls.js likely, or pass it here.

    // Event listeners
    window.addEventListener('resize', onWindowResize);

    setupMinimap();

    // Start loop
    animate();

    // Mouse Look Listeners
    document.addEventListener('mousedown', (e) => {
        if (e.button === 1) { // Middle Mouse
            isLooking = true;
            e.preventDefault(); // Prevent scroll
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (e.button === 1) {
            isLooking = false;
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (isLooking) {
            const sensitivity = 0.005;
            camYaw += e.movementX * sensitivity;
            camPitch += e.movementY * sensitivity;

            // Layout pitch limits? -PI/2 to PI/2
            camPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camPitch));
        }
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    // Update game logic
    if (plane && !isCrashed) {
        if (isTaxiing) {
            updateTaxi(delta);
            // Simple camera follow during taxi (no look)
            const offset = new THREE.Vector3(0, 5, 20).applyMatrix4(plane.matrixWorld);
            camera.position.lerp(offset, 0.1);
            camera.lookAt(plane.position);
        } else {
            terrainManager.update(plane.position);
            updateControls(plane, delta);

            // Camera follow logic
            const relativeCameraOffset = new THREE.Vector3(0, 5, 20);

            if (isLooking) {
                relativeCameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), -camYaw);
                relativeCameraOffset.applyAxisAngle(new THREE.Vector3(1, 0, 0), -camPitch);
            } else {
                camYaw = 0;
                camPitch = 0;
            }

            const cameraOffset = relativeCameraOffset.applyMatrix4(plane.matrixWorld);
            camera.position.lerp(cameraOffset, 0.1);
            camera.lookAt(plane.position);

            // Altitude Logic
            if (plane.position.y > 30) {
                readyToLand = true;
            }

            // Collision Detection
            let onRunway = false;

            // 0. Runway Check
            const runways = terrainManager.getRunways();
            for (const r of runways) {
                const dx = Math.abs(plane.position.x - r.position.x);
                const dz = Math.abs(plane.position.z - r.position.z);

                // Runway 20x100
                if (dx < 10 && dz < 50) {
                    const surfaceY = r.position.y + 15;
                    if (plane.position.y < surfaceY + 2.0) {
                        if (readyToLand) {
                            // Touchdown
                            // planeSpeed * 800 is km/h
                            if (planeSpeed * 800 < 400) {
                                startTaxi(r);
                                onRunway = true;
                                readyToLand = false;
                            } else {
                                console.log("Too fast to land!", planeSpeed * 800);
                                triggerCrash();
                                onRunway = true;
                            }
                        } else {
                            // On runway, taking off
                            onRunway = true;
                        }
                        break;
                    }
                }
            }

            if (!onRunway) {
                // 1. Ground
                const groundHeight = getHeight(plane.position.x, plane.position.z);
                if (plane.position.y < groundHeight + 0.5) {
                    triggerCrash();
                }

                // 2. Trees
                const trees = terrainManager.getTrees();
                for (const tree of trees) {
                    // Cylinder Collision Check
                    const dx = plane.position.x - tree.position.x;
                    const dz = plane.position.z - tree.position.z;
                    const distXZ = Math.sqrt(dx * dx + dz * dz);

                    // Adjust hit box
                    const hitRadius = 10 * tree.scale.x;
                    const hitHeight = 45 * tree.scale.y;

                    if (distXZ < hitRadius && plane.position.y < tree.position.y + hitHeight) {
                        console.log("Tree Hit!");
                        triggerCrash();
                        break;
                    }
                }
            }
        }
    }

    updateBullets(delta);
    updateExplosions(delta);

    renderer.render(scene, camera);
    drawMinimap();
}

// ... existing triggerCrash ... createExplosion ... updateExplosions ... fireLasers ... updateBullets ...

// Minimap
let minimapCanvas, minimapCtx;

function setupMinimap() {
    minimapCanvas = document.createElement('canvas');
    minimapCanvas.width = 200;
    minimapCanvas.height = 200;
    minimapCanvas.style.position = 'absolute';
    minimapCanvas.style.top = '10px';
    minimapCanvas.style.right = '10px';
    minimapCanvas.style.border = '2px solid white';
    minimapCanvas.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    minimapCanvas.style.borderRadius = '50%'; // Rounded
    document.body.appendChild(minimapCanvas);
    minimapCtx = minimapCanvas.getContext('2d');
}

function drawMinimap() {
    if (!minimapCtx || !plane) return;

    const size = 200;
    // Range should match chunk size approx? User said "size as the starting land area" (2000).
    const range = 2000;
    const scale = size / range;

    minimapCtx.clearRect(0, 0, size, size);

    minimapCtx.save();
    minimapCtx.translate(size / 2, size / 2);

    // Clip circle
    minimapCtx.beginPath();
    minimapCtx.arc(0, 0, size / 2, 0, Math.PI * 2);
    minimapCtx.clip();

    // Background Grid lines? 
    // Draw North indicator?

    // Map Fixed (North Up). Rotate Plane Icon.

    const px = plane.position.x;
    const pz = plane.position.z;

    // Draw Runways (Grey Rects)
    const runways = terrainManager.getRunways();
    minimapCtx.fillStyle = '#AAAAAA';
    for (const r of runways) {
        // Runways are 20x100 (aligned z)
        const rx = (r.position.x - px) * scale;
        const rz = (r.position.z - pz) * scale;

        // Draw
        minimapCtx.fillRect(rx - (20 * scale) / 2, rz - (100 * scale) / 2, 20 * scale, 100 * scale);
    }

    // Draw Trees (Green Dots)
    const trees = terrainManager.getTrees();
    minimapCtx.fillStyle = '#00FF00';
    for (const t of trees) {
        const tx = (t.position.x - px) * scale;
        const tz = (t.position.z - pz) * scale;

        minimapCtx.beginPath();
        minimapCtx.arc(tx, tz, 2, 0, Math.PI * 2);
        minimapCtx.fill();
    }

    // Draw Plane (Red Triangle)
    minimapCtx.fillStyle = 'red';
    // Rotate context to match plane Heading
    // Plane rotation Y: 0 is North (-Z) in standard ThreeJS? 
    // If plane.rotation.y = 0, facing -Z.
    // On Canvas, -Y is Up.
    // So 0 rotation should map to Up.
    minimapCtx.rotate(-plane.rotation.y); // Rotate icon

    minimapCtx.beginPath();
    minimapCtx.moveTo(0, -6);
    minimapCtx.lineTo(5, 6);
    minimapCtx.lineTo(-5, 6);
    minimapCtx.fill();

    minimapCtx.restore();
}

// Taxi Logic
function startTaxi(runway) {
    if (isTaxiing) return;
    console.log("Landing successful! Taxiing...");
    isTaxiing = true;

    const instructions = document.getElementById('instructions');
    if (instructions) instructions.innerHTML = "<h1 style='color:green;'>LANDED! TAXIING...</h1>";

    // Target: Start point of runway (Z + 40 relative to runway center)
    // Runway center is 0. +40 is near "start" (camera behind).
    // Ensure accurate height.
    taxiTarget = new THREE.Vector3(runway.position.x, runway.position.y + 15 + 1.0, runway.position.z + 40);
}

function updateTaxi(delta) {
    if (!taxiTarget || !plane) return;

    // Move towards target
    const dir = new THREE.Vector3().subVectors(taxiTarget, plane.position);
    // Ignore small Y diffs
    dir.y = 0;
    const dist = dir.length();

    if (dist < 0.5) {
        // Arrived
        isTaxiing = false;
        taxiTarget = null;

        // Final Snap
        plane.rotation.set(0, 0, 0);
        resetSpeed();

        const instructions = document.getElementById('instructions');
        if (instructions) instructions.innerHTML = "Pitch: W/S | Roll: A/D<br>Throttle: Up/Down Arrows | Rudder: Left/Right Arrows<br>R: Reset";
        console.log("Taxi complete. Ready.");
        return;
    }

    dir.normalize();
    // Taxi speed
    plane.position.add(dir.multiplyScalar(30 * delta));

    // Smooth Surface Height follow
    // Just keep wheels on runway Y
    // taxiTarget.y is safe.
    plane.position.y = taxiTarget.y;

    // Rotate to face target
    const lookT = plane.position.clone().add(dir);
    plane.lookAt(lookT);
}
function triggerCrash() {
    console.log("CRASH!");
    isCrashed = true;

    // UI Feedback
    const instructions = document.getElementById('instructions');
    if (instructions) instructions.innerHTML = "<h1 style='color:red;'>CRASHED!</h1>";

    // Boom
    createExplosion(plane.position);

    // Hide Plane
    plane.visible = false;

    // Reset after 2 seconds
    setTimeout(() => {
        plane.position.set(0, startY, 40);
        plane.rotation.set(0, 0, 0);
        resetSpeed();
        plane.visible = true;
        isCrashed = false;

        // Reset UI
        if (instructions) {
            instructions.innerHTML = "Pitch: W/S | Roll: A/D<br>Throttle: Up/Down Arrows | Rudder: Left/Right Arrows<br>R: Reset";
        }
    }, 2000);
}

function createExplosion(position, size = 1.0) {
    const geometry = new THREE.SphereGeometry(2, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color: 0xFF4500 }); // OrangeRed
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(position);
    scene.add(sphere);
    explosions.push({ mesh: sphere, age: 0, size: size });
}

function updateExplosions(delta) {
    for (let i = explosions.length - 1; i >= 0; i--) {
        const exp = explosions[i];
        exp.age += delta;

        // Expand (Linear)
        const currentScale = (1.0 + exp.age * 10.0) * exp.size;
        exp.mesh.scale.setScalar(currentScale);

        if (exp.age > 2.0) {
            scene.remove(exp.mesh);
            exp.mesh.geometry.dispose();
            exp.mesh.material.dispose();
            explosions.splice(i, 1);
        }
    }
}

function fireLasers() {
    if (!plane || isCrashed) return;

    console.log("Attempting to fire...");

    // Find Cannons by name
    const leftC = plane.getObjectByName("CannonLeft");
    const rightC = plane.getObjectByName("CannonRight");

    console.log("Cannons Found:", !!leftC, !!rightC);

    const shoot = (originObj, offset) => {
        if (!originObj) {
            console.log("No Origin Object");
            return;
        }

        const pos = new THREE.Vector3();

        // Use Bounding Box center because OBJ origin is likely 0,0,0 with baked vertices
        const box = new THREE.Box3().setFromObject(originObj);
        box.getCenter(pos);

        // If fallback to plane, add offset
        if (offset) {
            // For fallback, we need to manually offset from the center we just found (which is plane center)
            // Reset pos to plane position first? 
            // setFromObject(plane) gives plane bounds.
            // Actually, if offset is provided, ignore the box center of the "originObj" (which is plane) 
            // and use plane position + offset.
            originObj.getWorldPosition(pos);
            pos.add(offset.applyQuaternion(plane.quaternion));
        }

        console.log("Spawning laser at:", pos.x.toFixed(2), pos.y.toFixed(2), pos.z.toFixed(2));

        // Laser Mesh (Red Bolt) - Thicker (0.4)
        const geo = new THREE.CylinderGeometry(0.4, 0.4, 8, 8);
        geo.rotateX(Math.PI / 2); // Align length with Z
        const mat = new THREE.MeshBasicMaterial({ color: 0xFF0000 }); // Red
        const laser = new THREE.Mesh(geo, mat);

        laser.position.copy(pos);
        console.log("Shoot Pos:", laser.position);
        laser.quaternion.copy(plane.quaternion); // Align with plane

        scene.add(laser);

        // Velocity (Forward -Z local)
        const dir = new THREE.Vector3(0, 0, -1);
        dir.applyQuaternion(plane.quaternion);
        dir.multiplyScalar(800); // 800 units/s (Fast!)

        bullets.push({ mesh: laser, velocity: dir, dist: 0 });
    };

    if (!leftC || !rightC) {
        console.warn("Cannons not found! Using fallback slots.");
        shoot(plane, new THREE.Vector3(-3.5, 0, 0));
        shoot(plane, new THREE.Vector3(3.5, 0, 0));
    } else {
        shoot(leftC);
        shoot(rightC);
    }
}

function updateBullets(delta) {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];

        const move = b.velocity.clone().multiplyScalar(delta);
        b.mesh.position.add(move);
        b.dist += move.length();

        let hit = false;

        // Tree Collisions
        const trees = terrainManager.getTrees();
        for (let j = trees.length - 1; j >= 0; j--) {
            const tree = trees[j];

            // Check Hit (Cylinder: Radius 15, Height 50)
            const dx = b.mesh.position.x - tree.position.x;
            const dz = b.mesh.position.z - tree.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < 15 && b.mesh.position.y > tree.position.y && b.mesh.position.y < tree.position.y + 50) {
                // Hit!
                console.log("Laser hit tree!");
                createExplosion(tree.position, 0.5); // Half size for trees

                // Remove Tree
                scene.remove(tree);
                trees.splice(j, 1);

                hit = true;
                break;
            }
        }

        // Cleanup (Hit or Distance)
        if (hit || b.dist > 1000) {
            scene.remove(b.mesh);
            b.mesh.geometry.dispose();
            b.mesh.material.dispose();
            bullets.splice(i, 1);
        }
    }
}

// Fire Listener
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        fireLasers();
    }
});
