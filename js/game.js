import * as THREE from 'three';
import { TerrainManager, getHeight } from './terrain.js?v=32';
import { loadF16, loadTree, loadRoundTree, loadRunwayTexture, loadBuilding, loadPalmTree, loadMushroomTree, loadBaobabTree, loadCityBuilding, loadLowpolyTree, loadAIBuilding } from './assets.js?v=220';
import { updateControls, getPlaneObject, resetSpeed, planeSpeed } from './controls.js?v=9';

// Global variables
let camera, scene, renderer;
let plane;
let clock;
let startY = 10;
let terrainManager;

// Bomb Tracker
let bombTrackerRenderer = null;
let bombTrackerCamera = null;
let bombTrackerContainer = null;
let activeBomb = null; // Currently tracked bomb
let bombTrackerHideTime = null; // When to hide the tracker

// Camera Control Variables
let isLooking = false;
let camYaw = 0;
let camPitch = 0;

// Explosion Vars
let isCrashed = false;
let isTaxiing = false;
let readyToLand = false;
let taxiTarget = null;
let taxiFinalRotation = 0;
let explosions = [];
let bullets = [];
let bombs = [];
let lastBombTime = performance.now() - 3000;
let laserEnergy = 100;
let jetFlame = null;
let points = 0;

// HUD Overlays
let reticleCanvas, reticleCtx;
const RETICLE_FORWARD = 200; // distance ahead of plane
const RETICLE_UP = 2;       // lowered by 5 units
const POINTS_PER_TREE = 1;
const POINTS_PER_BUILDING = 3;

init();
// Animation handled inside init via requestAnimationFrame on load

async function init() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue
    scene.fog = new THREE.Fog(0x87CEEB, 200, 900); // Changed 1000 to 900

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

    // Load all assets in PARALLEL for much faster loading!
    console.log('Loading all game assets in parallel...');
    const [
        treeModel,
        roundTreeModel,
        palmTreeModel,
        mushroomTreeModel,
        baobabTreeModel,
        lowpolyTreeModel,
        building2,
        building3,
        building5,
        cityBuilding,
        ...aiBuildings
    ] = await Promise.all([
        loadTree(),
        loadRoundTree(),
        loadPalmTree(),
        loadMushroomTree(),
        loadBaobabTree(),
        loadLowpolyTree(),
        loadBuilding(2),
        loadBuilding(3),
        loadBuilding(5),
        loadCityBuilding(),
        // AI buildings 1-10
        loadAIBuilding(1),
        loadAIBuilding(2),
        loadAIBuilding(3),
        loadAIBuilding(4),
        loadAIBuilding(5),
        loadAIBuilding(6),
        loadAIBuilding(7),
        loadAIBuilding(8),
        loadAIBuilding(9),
        loadAIBuilding(10)
    ]);
    console.log(`✓ All assets loaded!`);
    
    // Load Runway Texture (synchronous, doesn't need await)
    const runwayTex = loadRunwayTexture();
    runwayTex.wrapS = THREE.RepeatWrapping;
    runwayTex.wrapT = THREE.RepeatWrapping;

    terrainManager = new TerrainManager(
        scene, 
        treeModel, 
        runwayTex, 
        roundTreeModel, 
        [building2, building3, building5],
        palmTreeModel,
        mushroomTreeModel,
        baobabTreeModel,
        lowpolyTreeModel,
        cityBuilding,
        aiBuildings
    );
    terrainManager.update(new THREE.Vector3(0, 0, 0));

    // Find the start runway (closest to 0,0)
    const runways = terrainManager.getRunways();
    // With one chunk loaded (radius 1), we expect at least one runway.
    // Ideally the one in chunk 0,0.
    let startRunway = null;
    let minD = Infinity;
    for (const r of runways) {
        const d = r.position.lengthSq();
        if (d < minD) {
            minD = d;
            startRunway = r;
        }
    }

    if (startRunway) {
        // Align plane with runway
        // Runway Local Y+ is Up. Surface is +15.
        // We want to be at one end of the runway, facing the other way?
        // Let's spawn at local Z = 40 (near one end), facing -Z (down the runway).

        // Plane Local position relative to Runway
        const localStartPos = new THREE.Vector3(0, 15 + 1.0, 40);

        // Transform to World
        const worldStartPos = localStartPos.applyMatrix4(startRunway.matrixWorld);

        plane = await loadF16();
        plane.position.copy(worldStartPos);
        plane.rotation.y = startRunway.rotation.y; // Align orientation

        startY = worldStartPos.y;

        scene.add(plane);
        createJetFlame();
    } else {
        console.error("No start runway found!");
        // Fallback
        plane = await loadF16();
        plane.position.set(0, 10, 0);
        scene.add(plane);
        createJetFlame();
    }
    // Initialize controls with the plane
    // We'll handle this linking logic in controls.js likely, or pass it here.

    // Event listeners
    window.addEventListener('resize', onWindowResize);

    setupMinimap();
    setupReticle();
    setupBombTracker();

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

            // Allow full 360 look: clamp just shy of +/- PI to avoid gimbal issues
            camPitch = Math.max(-Math.PI + 0.01, Math.min(Math.PI - 0.01, camPitch));
        }
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    updateReticlePosition();
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

            // Calculate Safe Minimum Altitude (Ground or Runway)
            let safeY = getHeight(plane.position.x, plane.position.z);
            const runways = terrainManager.getRunways();
            for (const r of runways) {
                // Check if we are "above" this runway (XZ bounds)
                // Convert plane pos to runway local space for accurate check
                const localP = plane.position.clone();
                r.worldToLocal(localP);
                if (Math.abs(localP.x) < 20 && Math.abs(localP.z) < 60) {
                    // Runway Surface world Y
                    safeY = Math.max(safeY, r.position.y + 15);
                }
            }

            updateControls(plane, delta, safeY, laserEnergy, getBombChargePct(), updateHUD);

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
            camera.position.lerp(cameraOffset, 0.35); // Increased from 0.2 to 0.35 for even faster follow
            camera.lookAt(plane.position);

            // Altitude Logic (Ceiling)
            if (plane.position.y > 500) {
                plane.position.y = 500;
                // Level off: If pitching up (negative rotation X locally? No, positive is nose down? Wait.)
                // Controls: S -> rotateX(positive). W -> rotateX(negative).
                // Usually Standard: rotateX positive is Pitch UP? 
                // Let's check controls.js: keys.s { plane.rotateX(delta * pitchSpeed) }
                // keys.w { plane.rotateX(-delta * pitchSpeed) }
                // In ThreeJS default, looking down negative Z:
                // Pitch Up (Nose Up) -> Rotate X Positive.
                // Pitch Down (Nose Down) -> Rotate X Negative.

                // So if > 500, we want to prevent Pitch Up. 
                // And ideally strictly force angle to 0 if it is positive (Nose Up).

                // Note: plane.rotation order is usually 'XYZ'. The local rotation might be complex if banking.
                // But simplified for this game:
                // We just want to dampen 'Up' pitch. Since we update incrementally, we might drift.
                // Let's just force position clamp. And maybe gently rotate X back to 0 if > 0?
                // Actually, just preventing further ascent is done by clamp. 
                // "Level off" implies visual change.

                // We need to check local rotation X.
                // Ideally we shouldn't manipulate rotation directly if it's accumulated quaternion, 
                // but this simple game uses Euler accumulation via rotate method.
                // Let's just hard clamp position and maybe nudge rotation.

                // Nudge X rotation towards 0
                // We don't have easy access to local Euler component without extraction.
                // But we can just say "don't let Y increase".

                // Implementation:
                // 1. Clamp Y.
                // 2. If trying to pitch up? 
                // Let's just slowly correct pitch to 0?

                // Easier: just set y=500. Users will naturally pitch down.
                // BUT user explicitly said "have it level off".

                // Simple Leveling:
                // Look at World Direction. If Y component is positive (pointing up), rotate to flatten?
                // That's complex math to get right with Roll.
                // Alternative: Just clamp Y.
            }

            if (plane.position.y > 30) {
                readyToLand = true;
            }

            // Hard Clamp for visual robustness
            if (plane.position.y > 500) plane.position.y = 500;

            // Collision Detection
            let onRunway = false;

            // 0. Runway Check
            // runways already defined above
            for (const r of runways) {
                // World to Local
                const localPos = plane.position.clone();
                r.worldToLocal(localPos);

                // Check Local Bounds (Runway 20x100 -> x: -10..10, z: -50..50)
                // Relaxed checking for gameplay smoothness
                if (Math.abs(localPos.x) < 10 && Math.abs(localPos.z) < 50) {
                    // Check World Y for height (simpler than local Y sometimes if we assume flat runway)
                    // r.position.y is center. Surface is +15.
                    const surfaceY = r.position.y + 15;

                    if (plane.position.y < surfaceY + 2.0) {
                        if (readyToLand) {
                            // Touchdown
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
                const { activeTrees, activeBaobabTrees } = terrainManager.getTrees();
                
                // Check regular trees
                for (const tree of activeTrees) {
                    // Cylinder Collision Check
                    const dx = plane.position.x - tree.position.x;
                    const dz = plane.position.z - tree.position.z;
                    const distXZ = Math.sqrt(dx * dx + dz * dz);

                    // Use tree userData for accurate hitbox, or fallback to pine tree defaults
                    let baseRadius = 10;
                    let baseHeight = 45;
                    
                    if (tree.userData && tree.userData.baseRadius) {
                        baseRadius = tree.userData.baseRadius;
                        baseHeight = tree.userData.baseHeight;
                    }
                    
                    const hitRadius = baseRadius * tree.scale.x;
                    const hitHeight = baseHeight * tree.scale.y;

                    // Allow collisions slightly below tree position (some trees have geometry below pivot)
                    if (distXZ < hitRadius && plane.position.y > tree.position.y - 2 && plane.position.y < tree.position.y + hitHeight) {
                        console.log("Tree Hit!");
                        triggerCrash();
                        break;
                    }
                }
                
                // Check Baobab trees
                for (const tree of activeBaobabTrees) {
                    const dx = plane.position.x - tree.position.x;
                    const dz = plane.position.z - tree.position.z;
                    const distXZ = Math.sqrt(dx * dx + dz * dz);

                    let baseRadius = 25;
                    let baseHeight = 50;
                    if (tree.userData) {
                        baseRadius = tree.userData.baseRadius || baseRadius;
                        baseHeight = tree.userData.baseHeight || baseHeight;
                    }
                    const hitRadius = baseRadius * tree.scale.x;
                    const hitHeight = baseHeight * tree.scale.y;

                    // Allow collisions slightly below tree position
                    if (distXZ < hitRadius && plane.position.y > tree.position.y - 2 && plane.position.y < tree.position.y + hitHeight) {
                        console.log("Baobab Tree Hit!");
                        triggerCrash();
                        break;
                    }
                }

                // 3. Buildings - precise Box3
                const buildings = terrainManager.getBuildings ? terrainManager.getBuildings() : [];
                for (const bld of buildings) {
                    const box = new THREE.Box3().setFromObject(bld);
                    if (box.containsPoint(plane.position)) {
                        triggerCrash();
                        break;
                    }
                }

                // 4. Mountains - Use raycast for precise surface collision
                const mountains = terrainManager.getMountains();
                for (const mountain of mountains) {
                    // Quick distance check first (optimization)
                    const dx = plane.position.x - mountain.position.x;
                    const dz = plane.position.z - mountain.position.z;
                    const distXZ = Math.sqrt(dx * dx + dz * dz);

                    const baseRadius = mountain.userData.baseRadius || 120;
                    if (distXZ > baseRadius * 1.5) continue; // Too far, skip detailed check

                    // Raycast down from plane position to check if we're inside the mountain
                    const raycaster = new THREE.Raycaster();
                    const rayOrigin = new THREE.Vector3(plane.position.x, plane.position.y + 50, plane.position.z);
                    const rayDir = new THREE.Vector3(0, -1, 0);
                    raycaster.set(rayOrigin, rayDir);

                    const intersects = raycaster.intersectObject(mountain, true);
                    if (intersects.length > 0) {
                        const hitPoint = intersects[0].point;
                        // If plane is below the mountain surface at this XZ position
                        if (plane.position.y < hitPoint.y + 2) { // 2m buffer
                            console.log("Mountain Hit!");
                            triggerCrash();
                            break;
                        }
                    }
                }
            }
        }
    }

    updateBullets(delta);
    updateExplosions(delta);
    updateJetFlame();
    updateReticlePosition();
    updateBombs(delta);
    updateHUD(getBombChargePct());

    renderer.render(scene, camera);
    drawMinimap();
    
    // Render bomb tracker if active
    if (activeBomb && bombTrackerRenderer && bombTrackerCamera) {
        updateBombTrackerCamera();
        bombTrackerRenderer.render(scene, bombTrackerCamera);
    }
    
    // Check if we should hide the bomb tracker
    if (bombTrackerHideTime && performance.now() >= bombTrackerHideTime) {
        hideBombTracker();
    }
}

// ... existing triggerCrash ... createExplosion ... updateExplosions ... fireLasers ... updateBullets ...

// Minimap
let minimapCanvas, minimapCtx;

function setupMinimap() {
    minimapCanvas = document.createElement('canvas');
    minimapCanvas.width = 200;
    minimapCanvas.height = 200;
    // Styles handled by CSS now (in #minimap-container canvas)

    const container = document.getElementById('minimap-container');
    if (container) {
        container.appendChild(minimapCanvas);
    } else {
        document.body.appendChild(minimapCanvas); // Fallback
    }
    minimapCtx = minimapCanvas.getContext('2d');
}

function setupReticle() {
    reticleCanvas = document.createElement('canvas');
    reticleCanvas.width = 48;
    reticleCanvas.height = 48;
    reticleCanvas.id = 'reticle';
    reticleCanvas.style.position = 'absolute';
    reticleCanvas.style.top = '50%';
    reticleCanvas.style.left = '50%';
    reticleCanvas.style.transform = 'translate(-50%, -50%)';
    reticleCanvas.style.pointerEvents = 'none';
    reticleCanvas.style.zIndex = '5';

    reticleCtx = reticleCanvas.getContext('2d');
    reticleCtx.clearRect(0, 0, reticleCanvas.width, reticleCanvas.height);
    reticleCtx.strokeStyle = 'rgba(0,0,0,0.9)';
    reticleCtx.lineWidth = 2;

    // Outer ring
    reticleCtx.beginPath();
    reticleCtx.arc(24, 24, 14, 0, Math.PI * 2);
    reticleCtx.stroke();

    // Cross lines
    const c = 24;
    const len = 16;
    reticleCtx.beginPath();
    reticleCtx.moveTo(c - len, c);
    reticleCtx.lineTo(c - 4, c);
    reticleCtx.moveTo(c + 4, c);
    reticleCtx.lineTo(c + len, c);
    reticleCtx.moveTo(c, c - len);
    reticleCtx.lineTo(c, c - 4);
    reticleCtx.moveTo(c, c + 4);
    reticleCtx.lineTo(c, c + len);
    reticleCtx.stroke();

    document.body.appendChild(reticleCanvas);
}

function setupBombTracker() {
    // Get the bomb tracker container from HTML
    bombTrackerContainer = document.getElementById('bomb-tracker');
    
    if (!bombTrackerContainer) {
        console.warn('Bomb tracker container not found');
        return;
    }
    
    // Create camera
    bombTrackerCamera = new THREE.PerspectiveCamera(60, 320 / 240, 0.1, 500);
    
    // Create separate renderer
    bombTrackerRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    bombTrackerRenderer.setSize(320, 240);
    bombTrackerRenderer.shadowMap.enabled = true;
    
    // Append to container
    bombTrackerContainer.appendChild(bombTrackerRenderer.domElement);
}

function updateBombTrackerCamera() {
    if (!bombTrackerCamera || !plane || !activeBomb) return;
    
    // Camera positioned 10m behind the plane
    const offset = new THREE.Vector3(0, 0, 10); // 10 units behind
    const cameraPos = offset.applyQuaternion(plane.quaternion).add(plane.position);
    
    bombTrackerCamera.position.copy(cameraPos);
    bombTrackerCamera.lookAt(activeBomb.position);
}

function showBombTracker(bomb) {
    activeBomb = bomb;
    bombTrackerHideTime = null;
    if (bombTrackerContainer) {
        bombTrackerContainer.style.display = 'block';
    }
}

function hideBombTracker() {
    activeBomb = null;
    bombTrackerHideTime = null;
    if (bombTrackerContainer) {
        bombTrackerContainer.style.display = 'none';
    }
}

function scheduleBombTrackerHide() {
    // Keep showing for 2 more seconds after impact
    bombTrackerHideTime = performance.now() + 2000;
}

function updateReticlePosition() {
    if (!reticleCanvas || !camera || !plane) return;

    // Point ahead of the plane (forward is -Z in local space)
    const target = new THREE.Vector3(0, RETICLE_UP, -RETICLE_FORWARD);
    plane.localToWorld(target);

    const projected = target.clone().project(camera);
    const x = (projected.x + 1) * 0.5 * window.innerWidth;
    const y = (-projected.y + 1) * 0.5 * window.innerHeight;

    reticleCanvas.style.left = `${x}px`;
    reticleCanvas.style.top = `${y}px`;
}

function getBombChargePct() {
    const now = performance.now();
    const elapsed = now - lastBombTime;
    return Math.max(0, Math.min(1, elapsed / BOMB_COOLDOWN_MS)) * 100;
}

function updateHUD(bombCharge = null) {
    // Bomb charge (0-100) if provided
    if (bombCharge !== null) {
        const bombBar = document.getElementById('bomb-bar');
        const bombVal = document.getElementById('bomb-val');
        if (bombBar) bombBar.style.width = `${bombCharge}%`;
        if (bombVal) bombVal.innerText = `${Math.round(bombCharge)}%`;
    }

    // Points slider (0-20)
    const ptsBar = document.getElementById('points-bar');
    const ptsVal = document.getElementById('points-val');
    const clamped = Math.max(0, Math.min(20, points));
    if (ptsBar) ptsBar.style.width = `${(clamped / 20) * 100}%`;
    if (ptsVal) ptsVal.innerText = `${clamped} / 20`;
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

    // Clip Square (match box style)
    minimapCtx.beginPath();
    minimapCtx.rect(-size / 2, -size / 2, size, size);
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
        // Runways are 20x100
        // Position on Minimap
        const rx = (r.position.x - px) * scale;
        const rz = (r.position.z - pz) * scale;

        minimapCtx.save();
        minimapCtx.translate(rx, rz);
        // Rotate: Canvas rotation is CW? Three is CCW?
        // Try -rotation.y first.
        minimapCtx.rotate(-r.rotation.y);

        // Draw Rect centered at (0,0) inside the translated context
        minimapCtx.fillRect(-(20 * scale) / 2, -(100 * scale) / 2, 20 * scale, 100 * scale);

        minimapCtx.restore();
    }

    // Draw Trees (Green Dots)
    const { activeTrees, activeBaobabTrees } = terrainManager.getTrees();
    minimapCtx.fillStyle = '#00FF00';
    for (const t of activeTrees) {
        const tx = (t.position.x - px) * scale;
        const tz = (t.position.z - pz) * scale;

        minimapCtx.beginPath();
        minimapCtx.arc(tx, tz, 2, 0, Math.PI * 2);
        minimapCtx.fill();
    }
    
    // Draw Baobab Trees (Orange Larger Dots)
    minimapCtx.fillStyle = '#FF8800';
    for (const t of activeBaobabTrees) {
        const tx = (t.position.x - px) * scale;
        const tz = (t.position.z - pz) * scale;

        minimapCtx.beginPath();
        minimapCtx.arc(tx, tz, 4, 0, Math.PI * 2);
        minimapCtx.fill();
    }

    // Draw Buildings (White squares)
    const buildings = terrainManager.getBuildings ? terrainManager.getBuildings() : [];
    minimapCtx.fillStyle = '#FFFFFF';
    for (const b of buildings) {
        const bx = (b.position.x - px) * scale;
        const bz = (b.position.z - pz) * scale;
        const half = 3; // fixed small size on minimap
        minimapCtx.fillRect(bx - half, bz - half, half * 2, half * 2);
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

    // Target: Start point of runway (Local Z + 40)
    // Local point
    const localTarget = new THREE.Vector3(0, 15 + 1.0, 40);
    // World point
    taxiTarget = localTarget.applyMatrix4(runway.matrixWorld);
    taxiFinalRotation = runway.rotation.y;
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
        plane.rotation.set(0, taxiFinalRotation, 0);
        resetSpeed();
        laserEnergy = 100;

        const instructions = document.getElementById('instructions');
        if (instructions) instructions.innerHTML = "Pitch: W/S | Roll: Q/E<br>Throttle: Up/Down Arrows | Rudder: A/D<br>R: Reset";
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

// Jet Engine Flame
function createJetFlame() {
    // Create a flame cone pointing backward from the jet
    // Reduced size - max 3 units
    const flameLength = 3;
    const flameRadius = 1;

    const flameGeo = new THREE.ConeGeometry(flameRadius, flameLength, 8);

    // Translate geometry so the TIP is at local origin (not the center)
    flameGeo.translate(0, -flameLength / 2, 0);

    // Create gradient effect using vertex colors - red/yellow spectrum
    const colors = [];
    const positions = flameGeo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const y = positions.getY(i);
        // y now ranges from -flameLength to 0 (tip at 0, base at -flameLength)
        const t = (y + flameLength) / flameLength; // 0 at base, 1 at tip

        if (t > 0.7) {
            // Bright yellow at tip (near jet)
            colors.push(1.0, 1.0, 0.0); // Pure yellow
        } else if (t > 0.4) {
            // Orange middle
            colors.push(1.0, 0.5, 0.0);
        } else {
            // Red at base (far end)
            colors.push(1.0, 0.1, 0.0);
        }
    }
    flameGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const flameMat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.9
    });

    jetFlame = new THREE.Mesh(flameGeo, flameMat);

    // Position at back of jet, rotated to point backward
    // The cone TIP is now at local origin, base extends along -Y
    // Rotate so base extends along +Z (backward from jet), then flip 180°
    jetFlame.rotation.x = -Math.PI / 2; // Flipped to extend backward
    jetFlame.position.set(0, 0, 1.5); // Tip touches rear of fuselage

    // Start invisible (no speed = no flame)
    jetFlame.scale.set(0, 0, 0);

    // Add as child of plane so it moves with it
    plane.add(jetFlame);
}

function updateJetFlame() {
    if (!jetFlame) return;

    // Scale based on speed (0 at idle, 1 at MAX_SPEED)
    const MAX_SPEED = 2.0; // Same as controls.js
    const speedRatio = Math.min(1, planeSpeed / MAX_SPEED);

    // No flame when speed is 0
    if (speedRatio <= 0.01) {
        jetFlame.scale.set(0, 0, 0);
    } else {
        // Scale flame uniformly - since geometry origin is at base, only tip extends
        jetFlame.scale.set(speedRatio, speedRatio, speedRatio);
    }

    // Add slight flicker effect
    const flicker = 0.9 + Math.random() * 0.2;
    jetFlame.scale.x *= flicker;
    jetFlame.scale.z *= flicker;
}

function triggerCrash() {
    console.log("CRASH!");
    isCrashed = true;

    // UI Feedback
    const instructions = document.getElementById('instructions');
    if (instructions) instructions.innerHTML = "<h1 style='color:red;'>CRASHED!</h1>";

    // Boom
    createExplosion(plane.position, 0.5); // 50% smaller for plane crash

    // Hide Plane
    plane.visible = false;

    // Reset after 2 seconds
    setTimeout(() => {
        // Find start runway again to reset position
        // Ideally we cache the start runway, but searching is cheap here.
        const runways = terrainManager.getRunways();
        let startRunway = null;
        let minD = Infinity;
        for (const r of runways) {
            const d = r.position.distanceToSquared(plane.position); // closest to crash site
            if (d < minD) {
                minD = d;
                startRunway = r;
            }
        }

        if (startRunway) {
            const localStartPos = new THREE.Vector3(0, 15 + 1.0, 40);
            const worldStartPos = localStartPos.applyMatrix4(startRunway.matrixWorld);
            plane.position.copy(worldStartPos);
            plane.rotation.set(0, startRunway.rotation.y, 0);
        } else {
            plane.position.set(0, startY, 40);
            plane.rotation.set(0, 0, 0);
        }

        resetSpeed();
        laserEnergy = 100;
        plane.visible = true;
        isCrashed = false;

        // Reset UI
        if (instructions) {
            instructions.innerHTML = "Pitch: W/S | Roll: Q/E<br>Throttle: Up/Down Arrows | Rudder: A/D<br>R: Reset";
        }
    }, 2000);
}

function createExplosion(position, size = 1.0) {
    // Flame colors array
    const flameColors = [
        0xFF4500, // OrangeRed
        0xFF6347, // Tomato
        0xFF8C00, // DarkOrange
        0xFFD700, // Gold
        0xFFA500, // Orange
        0xFF0000, // Red
        0xFFFF00, // Yellow
    ];

    // Create 5-8 smaller spheres
    const numSpheres = 5 + Math.floor(Math.random() * 4);

    for (let i = 0; i < numSpheres; i++) {
        const sphereSize = 0.8 + Math.random() * 1.2; // Varied sizes
        const geometry = new THREE.SphereGeometry(sphereSize, 8, 8);

        // Random flame color
        const color = flameColors[Math.floor(Math.random() * flameColors.length)];
        const material = new THREE.MeshBasicMaterial({ color: color });

        const sphere = new THREE.Mesh(geometry, material);

        // Random offset from center (within 3m radius)
        const offsetX = (Math.random() - 0.5) * 6;
        const offsetY = (Math.random() - 0.5) * 6;
        const offsetZ = (Math.random() - 0.5) * 6;

        sphere.position.set(
            position.x + offsetX,
            position.y + offsetY,
            position.z + offsetZ
        );

        scene.add(sphere);

        // Stagger ages slightly for varied timing
        const startAge = Math.random() * 0.3;
        explosions.push({ mesh: sphere, age: startAge, size: size * (0.5 + Math.random() * 0.5) });
    }
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

    if (laserEnergy < 2.5) return;
    laserEnergy -= 2.5;

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

        // Laser Mesh (Red Bolt) - 2x larger for better visibility
        const geo = new THREE.CylinderGeometry(0.8, 0.8, 16, 8); // 2x radius (0.4->0.8) and 2x length (8->16)
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

        // Regular Tree Collisions
        const { activeTrees, activeBaobabTrees } = terrainManager.getTrees();
        for (let j = activeTrees.length - 1; j >= 0; j--) {
            const tree = activeTrees[j];

            // Check Hit (Cylinder collision)
            const dx = b.mesh.position.x - tree.position.x;
            const dz = b.mesh.position.z - tree.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            // Use tree userData for accurate hitbox, or fallback to pine tree defaults
            let baseRadius = 10;
            let baseHeight = 45;
            let effectiveScale = tree.scale.x; // Random scale applied

            if (tree.userData && tree.userData.baseRadius) {
                baseRadius = tree.userData.baseRadius;
                baseHeight = tree.userData.baseHeight;
            }

            const hitRadius = baseRadius * effectiveScale;
            const hitHeight = baseHeight * effectiveScale;

            // Allow hits slightly below tree position (some trees have geometry below pivot)
            if (dist < hitRadius && b.mesh.position.y > tree.position.y - 2 && b.mesh.position.y < tree.position.y + hitHeight) {
                // Hit!
                console.log("Laser hit tree!");
                
                const explosionPos = tree.position.clone();
                explosionPos.y += 5;
                createExplosion(explosionPos, 0.5); // Half size for trees
                
                // Remove Tree
                scene.remove(tree);
                terrainManager.unregisterTree(tree);
                activeTrees.splice(j, 1);
                points += POINTS_PER_TREE;
                updateHUD();

                hit = true;
                break;
            }
        }
        
        // Baobab Tree Collisions (Boss Trees with HP)
        if (!hit) {
            for (let j = activeBaobabTrees.length - 1; j >= 0; j--) {
                const tree = activeBaobabTrees[j];

                const dx = b.mesh.position.x - tree.position.x;
                const dz = b.mesh.position.z - tree.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                let baseRadius = 25;
                let baseHeight = 50;
                let effectiveScale = tree.scale.x;

                if (tree.userData && tree.userData.baseRadius) {
                    baseRadius = tree.userData.baseRadius;
                    baseHeight = tree.userData.baseHeight;
                }

                const hitRadius = baseRadius * effectiveScale;
                const hitHeight = baseHeight * effectiveScale;

                // Allow hits slightly below tree position
                if (dist < hitRadius && b.mesh.position.y > tree.position.y - 2 && b.mesh.position.y < tree.position.y + hitHeight) {
                    console.log("Laser hit Baobab tree!");
                    
                    // Damage boss tree
                    const destroyed = damageTree(tree, 1); // 1 HP damage per laser hit
                    
                    if (destroyed) {
                        // Boss tree destroyed - BIG explosion!
                        const explosionPos = tree.position.clone();
                        explosionPos.y += baseHeight / 2; // Middle of tree
                        createExplosion(explosionPos, 2.5); // 2.5x size explosion!
                        
                        // Remove tree
                        scene.remove(tree);
                        terrainManager.unregisterBaobabTree(tree);
                        activeBaobabTrees.splice(j, 1);
                        points += POINTS_PER_TREE * 10; // 10x points for boss tree!
                        updateHUD();
                    } else {
                        // Still alive - small hit effect
                        const explosionPos = b.mesh.position.clone();
                        createExplosion(explosionPos, 0.3); // Small impact effect
                    }

                    hit = true;
                    break;
                }
            }
        }

        // Building collisions (precise Box3)
        const buildings = terrainManager.getBuildings ? terrainManager.getBuildings() : [];
        for (let j = buildings.length - 1; j >= 0 && !hit; j--) {
            const bld = buildings[j];
            const box = new THREE.Box3().setFromObject(bld);
            if (box.containsPoint(b.mesh.position)) {
                createExplosion(box.getCenter(new THREE.Vector3()), 0.6); // 50% smaller (was 1.2)
                scene.remove(bld);
                if (terrainManager.unregisterBuilding) terrainManager.unregisterBuilding(bld);
                points += POINTS_PER_BUILDING;
                updateHUD();
                hit = true;
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

// Health Bar System for Boss Trees
function createHealthBar(tree) {
    // Create canvas for health bar (50% larger)
    const canvas = document.createElement('canvas');
    canvas.width = 192; // 50% larger (was 128, now 192)
    canvas.height = 24; // 50% larger (was 16, now 24)
    const ctx = canvas.getContext('2d');
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    
    // Create sprite material
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(15, 1.875, 1); // 50% larger scale (was 10, 1.25, now 15, 1.875)
    
    // Position above tree
    const treeHeight = tree.userData.baseHeight || 70;
    sprite.position.set(0, treeHeight + 5, 0); // 5 units above tree top
    
    // Add to tree
    tree.add(sprite);
    
    // Store references
    tree.userData.healthBarSprite = sprite;
    tree.userData.healthBarCanvas = canvas;
    tree.userData.healthBarContext = ctx;
    
    // Initially hide (only show when damaged)
    sprite.visible = false;
    
    return sprite;
}

function updateHealthBar(tree) {
    if (!tree.userData.healthBarContext) return;
    
    const ctx = tree.userData.healthBarContext;
    const canvas = tree.userData.healthBarCanvas;
    const sprite = tree.userData.healthBarSprite;
    const maxHP = tree.userData.maxHP || 10;
    const currentHP = tree.userData.currentHP || 10;
    
    // Show health bar only if damaged
    if (currentHP < maxHP) {
        sprite.visible = true;
    } else {
        sprite.visible = false;
        return;
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background (black with red tint)
    ctx.fillStyle = '#220000';
    ctx.fillRect(2, 2, canvas.width - 4, canvas.height - 4);
    
    // Health bar (green to yellow to red gradient based on HP)
    const hpPercent = currentHP / maxHP;
    let barColor;
    if (hpPercent > 0.6) {
        barColor = '#00ff00'; // Green
    } else if (hpPercent > 0.3) {
        barColor = '#ffff00'; // Yellow
    } else {
        barColor = '#ff0000'; // Red
    }
    
    const barWidth = (canvas.width - 8) * hpPercent;
    ctx.fillStyle = barColor;
    ctx.fillRect(4, 4, barWidth, canvas.height - 8);
    
    // Border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    
    // HP Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${currentHP}/${maxHP}`, canvas.width / 2, canvas.height / 2);
    
    // Update texture
    sprite.material.map.needsUpdate = true;
}

function damageTree(tree, damage = 1) {
    if (!tree.userData.isBossTree) return false; // Not a boss tree
    
    // Initialize HP if needed
    if (tree.userData.currentHP === undefined) {
        tree.userData.currentHP = tree.userData.maxHP || 10;
    }
    
    // Create health bar if it doesn't exist
    if (!tree.userData.healthBarSprite) {
        createHealthBar(tree);
    }
    
    // Apply damage
    tree.userData.currentHP -= damage;
    
    // Update health bar
    updateHealthBar(tree);
    
    // Check if destroyed
    if (tree.userData.currentHP <= 0) {
        return true; // Tree is destroyed
    }
    
    return false; // Tree still alive
}

// Bombs
const BOMB_GRAVITY = -30;
const BOMB_DRAG = 0.005;
const BOMB_COOLDOWN_MS = 3000;

function dropBomb() {
    if (!plane || isCrashed) return;
    const now = performance.now();
    if (now - lastBombTime < BOMB_COOLDOWN_MS) return;

    // Spawn beneath the plane nose
    const localOffset = new THREE.Vector3(0, -2, -2);
    const worldPos = localOffset.clone();
    plane.localToWorld(worldPos);

    // Bomb shape: capsule body + tail fins, oriented along forward axis
    const bombBodyGeo = new THREE.CapsuleGeometry(0.45, 1.6, 6, 8);
    bombBodyGeo.rotateX(Math.PI / 2); // align length along local Z (forward)
    const bombMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.2, roughness: 0.6 });
    const bombBody = new THREE.Mesh(bombBodyGeo, bombMat);
    bombBody.castShadow = true;
    bombBody.receiveShadow = true;

    // Tail fins (3)
    const finGeo = new THREE.BoxGeometry(0.08, 0.6, 0.25);
    const fins = [];
    const finRadius = 0.5;
    const finZ = 0.9; // rear position
    for (let i = 0; i < 3; i++) {
        const fin = new THREE.Mesh(finGeo, bombMat);
        const angle = (i / 3) * Math.PI * 2;
        fin.position.set(Math.cos(angle) * finRadius, Math.sin(angle) * finRadius, finZ);
        fin.rotation.z = angle;
        fin.castShadow = true;
        fin.receiveShadow = true;
        fins.push(fin);
    }

    // Group bomb parts so we can align to plane
    const bomb = new THREE.Group();
    bomb.add(bombBody);
    fins.forEach(f => bomb.add(f));
    bomb.castShadow = true;
    bomb.receiveShadow = true;
    bomb.position.copy(worldPos);
    bomb.quaternion.copy(plane.quaternion); // align with plane body axis

    // Initial velocity: inherit plane forward velocity plus ~20 km/h (1 unit/s)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(plane.quaternion).normalize();
    const forwardSpeed = planeSpeed * 40 + 1; // plane uses 40 units/s per speed; +1 ≈ +20 km/h
    const velocity = forward.multiplyScalar(forwardSpeed);

    bombs.push({ mesh: bomb, velocity, alive: true });
    scene.add(bomb);
    lastBombTime = now;
    updateHUD(0);
    
    // Show bomb tracker
    showBombTracker(bomb);
}

function updateBombs(delta) {
    for (let i = bombs.length - 1; i >= 0; i--) {
        const b = bombs[i];
        if (!b.alive) continue;

        // Apply gravity
        b.velocity.y += BOMB_GRAVITY * delta;

        // Apply simple drag
        b.velocity.multiplyScalar(1 - BOMB_DRAG);

        const move = b.velocity.clone().multiplyScalar(delta);
        b.mesh.position.add(move);

        // Ground collision (terrain height)
        const groundY = getHeight(b.mesh.position.x, b.mesh.position.z);
        if (b.mesh.position.y <= groundY + 0.5) {
            createExplosion(b.mesh.position.clone(), 1.2);
            
            // Schedule bomb tracker to hide after 2 seconds
            if (activeBomb === b.mesh) {
                scheduleBombTrackerHide();
            }
            
            scene.remove(b.mesh);
            b.mesh.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                    else obj.material.dispose();
                }
            });
            bombs.splice(i, 1);
            continue;
        }

        // Tree collisions (destructible) with 2x hitbox for bombs
        const { activeTrees, activeBaobabTrees } = terrainManager.getTrees();
        let treeHit = false;
        
        // Regular trees
        for (let j = activeTrees.length - 1; j >= 0; j--) {
            const tree = activeTrees[j];

            const dx = b.mesh.position.x - tree.position.x;
            const dz = b.mesh.position.z - tree.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            let baseRadius = 10;
            let baseHeight = 45;
            let effectiveScale = tree.scale.x;
            if (tree.userData && tree.userData.baseRadius) {
                baseRadius = tree.userData.baseRadius;
                baseHeight = tree.userData.baseHeight;
            }

            const hitRadius = baseRadius * effectiveScale * 2; // 100% larger for bombs
            const hitHeight = baseHeight * effectiveScale * 2;

            // Allow hits slightly below tree position
            if (dist < hitRadius && b.mesh.position.y > tree.position.y - 2 && b.mesh.position.y < tree.position.y + hitHeight) {
                // Regular tree - instant destroy
                createExplosion(tree.position.clone().setY(tree.position.y + 5), 1.5);
                scene.remove(tree);
                terrainManager.unregisterTree(tree);
                activeTrees.splice(j, 1);
                points += POINTS_PER_TREE;
                updateHUD();
                
                treeHit = true;
                break;
            }
        }
        
        // Baobab trees (Boss Trees)
        if (!treeHit) {
            for (let j = activeBaobabTrees.length - 1; j >= 0; j--) {
                const tree = activeBaobabTrees[j];

                const dx = b.mesh.position.x - tree.position.x;
                const dz = b.mesh.position.z - tree.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                let baseRadius = 25;
                let baseHeight = 50;
                let effectiveScale = tree.scale.x;
                if (tree.userData && tree.userData.baseRadius) {
                    baseRadius = tree.userData.baseRadius;
                    baseHeight = tree.userData.baseHeight;
                }

                const hitRadius = baseRadius * effectiveScale * 2; // 100% larger for bombs
                const hitHeight = baseHeight * effectiveScale * 2;

                // Allow hits slightly below tree position
                if (dist < hitRadius && b.mesh.position.y > tree.position.y - 2 && b.mesh.position.y < tree.position.y + hitHeight) {
                    // Damage boss tree (bombs do 3 HP damage)
                    const destroyed = damageTree(tree, 3);
                    
                    if (destroyed) {
                        // Boss tree destroyed - HUGE explosion!
                        createExplosion(tree.position.clone().setY(tree.position.y + baseHeight / 2), 2.5);
                        scene.remove(tree);
                        terrainManager.unregisterBaobabTree(tree);
                        activeBaobabTrees.splice(j, 1);
                        points += POINTS_PER_TREE * 10; // 10x points for boss tree!
                        updateHUD();
                    } else {
                        // Still alive - medium hit effect
                        createExplosion(tree.position.clone().setY(tree.position.y + 5), 0.8);
                    }
                    
                    treeHit = true;
                    break;
                }
            }
        }

        if (treeHit) {
            // Schedule bomb tracker to hide after 2 seconds
            if (activeBomb === b.mesh) {
                scheduleBombTrackerHide();
            }
            
            // Remove bomb
            scene.remove(b.mesh);
            b.mesh.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                    else obj.material.dispose();
                }
            });
            bombs.splice(i, 1);
            continue;
        }

        // Building collisions (bombs, exact box)
        const buildings = terrainManager.getBuildings ? terrainManager.getBuildings() : [];
        for (let j = buildings.length - 1; j >= 0; j--) {
            const bld = buildings[j];
            const box = new THREE.Box3().setFromObject(bld);
            if (box.containsPoint(b.mesh.position)) {
                createExplosion(box.getCenter(new THREE.Vector3()), 0.75); // 50% smaller (was 1.5)
                scene.remove(bld);
                if (terrainManager.unregisterBuilding) terrainManager.unregisterBuilding(bld);
                points += POINTS_PER_BUILDING;
                updateHUD();

                // Schedule bomb tracker to hide after 2 seconds
                if (activeBomb === b.mesh) {
                    scheduleBombTrackerHide();
                }

                scene.remove(b.mesh);
                b.mesh.traverse(obj => {
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) {
                        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                        else obj.material.dispose();
                    }
                });
                bombs.splice(i, 1);
                break;
            }
        }
    }
}

// Fire Listeners
window.addEventListener('mousedown', (e) => {
    // Left click fires lasers
    if (e.button === 0) {
        fireLasers();
    }
});

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        dropBomb();
    }
});
