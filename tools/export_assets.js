import * as THREE from 'three';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import fs from 'fs';
import path from 'path';

// Mock browser environment if needed
if (!global.window) global.window = {};
if (!global.document) global.document = {};

/**
 * Convert hex color to RGB 0-1 range (sRGB color space for MTL)
 * MTL files expect sRGB values, not linear
 */
function hexToRGB(hex) {
    const r = ((hex >> 16) & 0xFF) / 255;
    const g = ((hex >> 8) & 0xFF) / 255;
    const b = (hex & 0xFF) / 255;
    return { r, g, b };
}

/**
 * Create MTL (Material Library) file content
 * @param {Array} materials - Array of {name, color, properties}
 * @returns {string} MTL file content
 */
function createMTL(materials) {
    let mtl = '# Material Library\n';
    mtl += '# Created by export_assets.js\n\n';
    
    for (const mat of materials) {
        mtl += `newmtl ${mat.name}\n`;
        
        // Diffuse color (Kd)
        if (mat.color !== undefined) {
            const color = hexToRGB(mat.color);
            mtl += `Kd ${color.r.toFixed(6)} ${color.g.toFixed(6)} ${color.b.toFixed(6)}\n`;
        }
        
        // Ambient color (Ka) - usually 30% of diffuse
        if (mat.color !== undefined) {
            const color = hexToRGB(mat.color);
            mtl += `Ka ${(color.r * 0.3).toFixed(6)} ${(color.g * 0.3).toFixed(6)} ${(color.b * 0.3).toFixed(6)}\n`;
        }
        
        // Specular color (Ks)
        if (mat.specular !== undefined) {
            const spec = hexToRGB(mat.specular);
            mtl += `Ks ${spec.r.toFixed(6)} ${spec.g.toFixed(6)} ${spec.b.toFixed(6)}\n`;
        } else {
            mtl += `Ks 0.5 0.5 0.5\n`; // Default specular
        }
        
        // Specular exponent (Ns) - shininess
        mtl += `Ns ${mat.shininess || 30}\n`;
        
        // Transparency (d) - 1.0 = opaque, 0.0 = transparent
        mtl += `d ${mat.opacity !== undefined ? mat.opacity : 1.0}\n`;
        
        // Illumination model (illum)
        // 2 = highlight on (Phong), 1 = no specular (Lambert)
        mtl += `illum ${mat.illum || 2}\n`;
        
        // Texture map (if provided)
        if (mat.map) {
            mtl += `map_Kd ${mat.map}\n`;
        }
        
        mtl += '\n';
    }
    
    return mtl;
}

function createF16() {
    const group = new THREE.Group();
    group.name = "F16";

    // Fuselage (Body) - Cylinder along Z axis
    const fuselageGeo = new THREE.CylinderGeometry(0.5, 0.5, 4, 16);
    fuselageGeo.rotateX(Math.PI / 2); // Rotate to lie on Z axis
    const fuselageMat = new THREE.MeshPhongMaterial({ color: 0x555555 });
    fuselageMat.name = 'Fuselage'; // Name for MTL reference
    const fuselage = new THREE.Mesh(fuselageGeo, fuselageMat);
    fuselage.name = "Fuselage";
    group.add(fuselage);

    // Nose cone - Pointing towards -Z
    // User wanted "pointy cone". Longer and sharper.
    const noseGeo = new THREE.ConeGeometry(0.5, 2.5, 32);
    noseGeo.rotateX(-Math.PI / 2); // Point to -Z
    const nose = new THREE.Mesh(noseGeo, fuselageMat);
    nose.name = "Nose";
    nose.position.z = -3.25; // Fuselage ends at -2. Nose len 2.5, center at 1.25. -2 - 1.25 = -3.25
    group.add(nose);

    // Wings (Swept Delta / Cropped Delta)
    const wingShape = new THREE.Shape();
    // Define right wing shape (Local XY, where X is span, Y is -Z (back))
    // Root chord: 3 units? Fuselage is 4 long.
    // Let's center it roughly.
    // Points: (x, y)
    wingShape.moveTo(0.5, 1);   // Root, Leading Edge (near front)
    wingShape.lineTo(3.5, -0.5); // Tip, Leading Edge (swept back)
    wingShape.lineTo(3.5, -1.5); // Tip, Trailing Edge 
    wingShape.lineTo(0.5, -2);   // Root, Trailing Edge
    wingShape.lineTo(0.5, 1);    // Close

    const wingExtrudeSettings = { steps: 1, depth: 0.1, bevelEnabled: false };
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, wingExtrudeSettings);
    // Geometry is extruded along Z (thickness).
    // Our shape was X=Span, Y=Length.
    // So thickness is Z (Up/Down in local, but depends on rotation).
    // We want thickness to be Y (Up/Down).
    // Rotate geometry so created Z becomes Y, created Y becomes Z?
    // Current: X, Y, Z(thick). 
    // Target: X(span), Y(thick), Z(length).
    // Rotate X -90?
    // Y -> -Z. Z -> Y.
    wingGeo.rotateX(-Math.PI / 2);

    const wingMat = new THREE.MeshPhongMaterial({ color: 0x444444 });
    wingMat.name = 'Wings';
    const rightWing = new THREE.Mesh(wingGeo, wingMat);
    rightWing.name = "Wings_Right";
    rightWing.position.z = 0;
    group.add(rightWing);

    // Left Wing (Explicit Shape)
    const leftShape = new THREE.Shape();
    leftShape.moveTo(-0.5, 1);
    leftShape.lineTo(-3.5, -0.5);
    leftShape.lineTo(-3.5, -1.5);
    leftShape.lineTo(-0.5, -2);
    leftShape.lineTo(-0.5, 1);

    const leftGeo = new THREE.ExtrudeGeometry(leftShape, wingExtrudeSettings);
    leftGeo.rotateX(-Math.PI / 2);

    const leftWing = new THREE.Mesh(leftGeo, wingMat);
    leftWing.name = "Wings_Left";
    leftWing.position.z = 0;
    group.add(leftWing);

    // Wingtip Cannons (Laser Cannons)
    const cannonGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.5, 8);
    cannonGeo.rotateX(Math.PI / 2); // Point along Z

    const leftCannon = new THREE.Mesh(cannonGeo, wingMat);
    leftCannon.name = "CannonLeft";
    leftCannon.position.set(-3.5, 0, 0.5); // Tip of left wing
    group.add(leftCannon);

    const rightCannon = new THREE.Mesh(cannonGeo, wingMat);
    rightCannon.name = "CannonRight";
    rightCannon.position.set(3.5, 0, 0.5); // Tip of right wing
    group.add(rightCannon);

    // Tail (Vertical Stabilizer / Rudder)
    // Trapezoid shape, swept back.
    const tailShape = new THREE.Shape();
    // Drawing in local side view (X = Length, Y = Height)
    // 0,0 is Bottom Leading Edge anchor.
    tailShape.moveTo(0, 0);
    tailShape.lineTo(1.5, 0);    // Bottom Trailing
    tailShape.lineTo(1.1, 1.8);  // Top Trailing (Tapered)
    tailShape.lineTo(0.6, 1.8);  // Top Leading (Swept back 0.6)
    tailShape.lineTo(0, 0);      // Close

    const tailExtrudeSettings = { steps: 1, depth: 0.1, bevelEnabled: false }; // Depth is Thickness
    const tailGeo = new THREE.ExtrudeGeometry(tailShape, tailExtrudeSettings);

    // Rotate so Shape X becomes World Z, Shape Y becomes World Y.
    // Extrude Z (thickness) becomes World X.
    // Rotate Y -90 deg (-PI/2)
    // X -> Z
    // Z -> X? No right hand rule.
    // Rotate Y -90: X(1,0,0) -> (0,0,1). Z(0,0,1) -> (-1,0,0).
    // So Thickness (Z) becomes -X. Center it?
    // We can center geometry or adjust mesh position.
    tailGeo.rotateY(-Math.PI / 2);
    tailGeo.center(); // Center it to make positioning easier

    const tail = new THREE.Mesh(tailGeo, wingMat);
    tail.name = "Tail";
    // Fuselage is length 4 (-2 to 2).
    // Tail should be at the back (near 1.5 to 2).
    // Height: sits on fuselage (radius 0.5).
    // Geometry is centered. Height is 1.8. Center Y is 0.9.
    // So Y position = 0.5 (fuselage top) + 0.9 = 1.4.
    // Z position = 1.6?
    tail.position.set(0, 1.4, 1.6);
    group.add(tail);

    // Horizontal stabilizers
    const stabGeo = new THREE.BoxGeometry(2.5, 0.1, 1.2);
    const stabilizers = new THREE.Mesh(stabGeo, wingMat);
    stabilizers.name = "Stabilizers";
    stabilizers.position.set(0, 0, 1.9);
    group.add(stabilizers);

    // Landing Gear
    const gearMat = new THREE.MeshPhongMaterial({ color: 0x333333 });
    gearMat.name = 'Gear'; // Material name for MTL reference
    const wheelGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16);
    wheelGeo.rotateZ(Math.PI / 2); // Wheel rolls along Z
    // Shorten Strut: 1.0 -> 0.5
    const strutGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.5);

    // Front Gear
    // Pivot is near fuselage bottom: (0, -0.5, -1.5)
    // Strut length 0.5. Top at -0.5. Center at -0.75. Bottom at -1.0.
    const frontStrut = new THREE.Mesh(strutGeo, gearMat);
    frontStrut.position.set(0, -0.75, -1.5);
    const frontWheel = new THREE.Mesh(wheelGeo, gearMat);
    frontWheel.position.set(0, -1.0, -1.5);

    const gearFront = new THREE.Group();
    gearFront.name = "GearFront";
    gearFront.add(frontStrut);
    gearFront.add(frontWheel);
    group.add(gearFront); // Add to F16 group

    // Left Gear (Wing/Fuselage side)
    // Pivot: (0.8, -0.5, 0.5)
    // Fold Inwards (Rotate Z).
    const leftStrut = new THREE.Mesh(strutGeo, gearMat);
    leftStrut.position.set(0.8, -0.75, 0.5);
    const leftWheel = new THREE.Mesh(wheelGeo, gearMat);
    leftWheel.position.set(0.8, -1.0, 0.5);

    const gearLeft = new THREE.Group();
    gearLeft.name = "GearLeft";
    gearLeft.add(leftStrut);
    gearLeft.add(leftWheel);
    group.add(gearLeft);

    // Right Gear
    const rightStrut = new THREE.Mesh(strutGeo, gearMat);
    rightStrut.position.set(-0.8, -0.75, 0.5);
    const rightWheel = new THREE.Mesh(wheelGeo, gearMat);
    rightWheel.position.set(-0.8, -1.0, 0.5);

    const gearRight = new THREE.Group();
    gearRight.name = "GearRight";
    gearRight.add(rightStrut);
    gearRight.add(rightWheel);
    group.add(gearRight);

    // CRITICAL for Headless Export: Update Matrices!
    // Without this, positions/rotations are ignored by exporter if it relies on baked World Matrix
    // or if local 'matrix' isn't composed from pos/rot/scale yet.
    group.traverse(child => {
        child.updateMatrix();
    });
    group.updateMatrixWorld(true);

    return group;
}

function createTree() {
    const group = new THREE.Group();
    group.name = "Tree";

    // Trunk - 10x larger geometry (no transform needed)
    const trunkGeo = new THREE.CylinderGeometry(2.0, 3.0, 15.0, 8); // Was 0.2, 0.3, 1.5
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    trunkMat.name = 'Trunk'; // Material name for MTL reference
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.name = "Trunk";
    trunk.position.y = 7.5; // Was 0.75
    group.add(trunk);

    // Leaves (Cone) - 10x larger geometry
    const leavesGeo = new THREE.ConeGeometry(12.0, 30.0, 8); // Was 1.2, 3
    const leavesMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });
    leavesMat.name = 'Leaves'; // Material name for MTL reference
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.name = "Leaves";
    leaves.position.y = 25.0; // Was 2.5
    group.add(leaves);

    // No scaling needed - geometry is already correct size

    // Update Matrices
    group.traverse(child => {
        child.updateMatrix();
    });
    group.updateMatrixWorld(true);

    return group;
}

function createRoundTree() {
    const group = new THREE.Group();
    group.name = "RoundTree";

    // Trunk (Cylinder) - 5x larger geometry (no transform needed)
    const trunkGeo = new THREE.CylinderGeometry(2.5, 4.0, 15.0, 8); // Was 0.5, 0.8, 3
    trunkGeo.translate(0, 7.5, 0); // Base at 0 (was 1.5)
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    trunkMat.name = 'Trunk'; // Material name for MTL reference
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.name = "Trunk";
    group.add(trunk);

    // Leaves (Sphere) - 5x larger geometry
    const leavesGeo = new THREE.SphereGeometry(17.5, 8, 8); // Was 3.5
    leavesGeo.translate(0, 25.0, 0); // On top of trunk (was 5)
    const leavesMat = new THREE.MeshLambertMaterial({ color: 0x2E8B57 }); // SeaGreen
    leavesMat.name = 'Leaves'; // Material name for MTL reference
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.name = "Leaves";
    group.add(leaves);

    // No scaling needed - geometry is already correct size

    // Update Matrices
    group.traverse(child => {
        child.updateMatrix();
    });
    group.updateMatrixWorld(true);

    return group;
}

function createPalmTree() {
    const group = new THREE.Group();
    group.name = "PalmTree";

    // Trunk - Tall, slightly curved cylinder (10x scale baked in)
    const trunkGeo = new THREE.CylinderGeometry(2.0, 3.0, 30.0, 8); // Tall trunk
    trunkGeo.translate(0, 15.0, 0); // Base at 0
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B7355 }); // Lighter brown
    trunkMat.name = 'Trunk';
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.name = "Trunk";
    group.add(trunk);

    // Palm Leaves - 6 flat planes arranged in star pattern
    const leafGeo = new THREE.PlaneGeometry(20.0, 8.0); // Long flat leaf
    const leafMat = new THREE.MeshLambertMaterial({ 
        color: 0x228B22,
        side: THREE.DoubleSide 
    });
    leafMat.name = 'Leaves';

    for (let i = 0; i < 6; i++) {
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.name = "Leaves";
        
        const angle = (i / 6) * Math.PI * 2;
        leaf.position.set(0, 30.0, 0); // Top of trunk
        leaf.rotation.y = angle;
        leaf.rotation.x = -Math.PI / 6; // Droop down slightly
        
        group.add(leaf);
    }

    group.traverse(child => {
        child.updateMatrix();
    });
    group.updateMatrixWorld(true);

    return group;
}

function createMushroomTree() {
    const group = new THREE.Group();
    group.name = "MushroomTree";

    // Stalk/Trunk - Short thick cylinder (5x scale baked in)
    const stalkGeo = new THREE.CylinderGeometry(3.0, 3.5, 10.0, 8);
    stalkGeo.translate(0, 5.0, 0); // Base at 0
    const stalkMat = new THREE.MeshLambertMaterial({ color: 0xF5DEB3 }); // Wheat/tan color
    stalkMat.name = 'Stalk';
    const stalk = new THREE.Mesh(stalkGeo, stalkMat);
    stalk.name = "Stalk";
    group.add(stalk);

    // Mushroom Cap - Flattened sphere/hemisphere
    const capGeo = new THREE.SphereGeometry(15.0, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    capGeo.scale(1, 0.5, 1); // Flatten it
    capGeo.translate(0, 10.0, 0); // On top of stalk
    const capMat = new THREE.MeshLambertMaterial({ color: 0xFF6347 }); // Tomato red
    capMat.name = 'Cap';
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.name = "Cap";
    group.add(cap);

    // Spots on cap (optional white spots)
    const spotGeo = new THREE.SphereGeometry(2.0, 6, 6);
    const spotMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF }); // White
    spotMat.name = 'Spots';

    // Add 3-5 random spots
    for (let i = 0; i < 4; i++) {
        const spot = new THREE.Mesh(spotGeo, spotMat);
        spot.name = "Spots";
        
        const angle = (i / 4) * Math.PI * 2 + Math.random() * 0.5;
        const radius = 8 + Math.random() * 4;
        spot.position.set(
            Math.cos(angle) * radius,
            10.5 + Math.random() * 2,
            Math.sin(angle) * radius
        );
        
        group.add(spot);
    }

    group.traverse(child => {
        child.updateMatrix();
    });
    group.updateMatrixWorld(true);

    return group;
}

function createBaobabTree() {
    const group = new THREE.Group();
    group.name = "BaobabTree";

    // Trunk - Very thick, tapered cylinder (5x larger than normal trees, so 50x base)
    // Wider in middle (bottle-shaped)
    const trunkBottomGeo = new THREE.CylinderGeometry(15.0, 20.0, 40.0, 8);
    trunkBottomGeo.translate(0, 20.0, 0);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B7355 }); // Light brown
    trunkMat.name = 'Trunk';
    const trunkBottom = new THREE.Mesh(trunkBottomGeo, trunkMat);
    trunkBottom.name = "Trunk";
    group.add(trunkBottom);

    // Top of trunk - slightly narrower
    const trunkTopGeo = new THREE.CylinderGeometry(12.0, 15.0, 20.0, 8);
    trunkTopGeo.translate(0, 50.0, 0);
    const trunkTop = new THREE.Mesh(trunkTopGeo, trunkMat);
    trunkTop.name = "Trunk";
    group.add(trunkTop);

    // Small branches at top - 4-6 thin cylinders
    const branchMat = new THREE.MeshLambertMaterial({ color: 0x654321 }); // Dark brown
    branchMat.name = 'Branches';
    
    for (let i = 0; i < 5; i++) {
        const branchGeo = new THREE.CylinderGeometry(1.5, 2.0, 15.0, 6);
        const branch = new THREE.Mesh(branchGeo, branchMat);
        branch.name = "Branches";
        
        const angle = (i / 5) * Math.PI * 2;
        const branchX = Math.cos(angle) * 8;
        const branchZ = Math.sin(angle) * 8;
        
        branch.position.set(branchX, 60.0 + Math.random() * 5, branchZ);
        branch.rotation.z = (Math.random() - 0.5) * 0.5; // Slight angle
        branch.rotation.x = (Math.random() - 0.5) * 0.5;
        
        group.add(branch);
    }

    // Small leaves/foliage clusters at branch ends
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });
    leafMat.name = 'Leaves';
    
    for (let i = 0; i < 5; i++) {
        const leafGeo = new THREE.SphereGeometry(6.0, 6, 6); // 50% larger (was 4.0, now 6.0)
        const leaves = new THREE.Mesh(leafGeo, leafMat);
        leaves.name = "Leaves";
        
        const angle = (i / 5) * Math.PI * 2;
        const leafX = Math.cos(angle) * 10; // Closer to branches (was 15, now 10)
        const leafZ = Math.sin(angle) * 10; // Closer to branches (was 15, now 10)
        
        leaves.position.set(leafX, 65.0 + Math.random() * 3, leafZ); // Lower Y (was 68.0, now 65.0)
        
        group.add(leaves);
    }

    group.traverse(child => {
        child.updateMatrix();
    });
    group.updateMatrixWorld(true);

    return group;
}

function createBuilding(stories = 2, floorHeight = 4, width = 12, depth = 10) {
    const group = new THREE.Group();
    group.name = `Building_${stories}F`;

    const height = stories * floorHeight;

    // Body
    const bodyGeo = new THREE.BoxGeometry(width, height, depth);
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0xffffff });
    bodyMat.name = 'BuildingBody'; // Material name for MTL reference
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.name = 'BuildingBody';
    body.position.y = height / 2;
    group.add(body);

    // Windows: 2 per side per floor -> 8 per floor, 4 sides
    const windowMat = new THREE.MeshPhongMaterial({ color: 0x000000 });
    windowMat.name = 'Window'; // Material name for MTL reference
    const winW = width * 0.2;
    const winH = floorHeight * 0.4;
    const winGeo = new THREE.PlaneGeometry(winW, winH);

    const yOffset = floorHeight * 0.5;
    const zOffset = depth / 2 + 0.01;
    const xOffset = width / 2 + 0.01;
    const insetX = width * 0.2;
    const insetZ = depth * 0.2;

    for (let f = 0; f < stories; f++) {
        const y = f * floorHeight + yOffset;

        // Front (+Z)
        const front1 = new THREE.Mesh(winGeo, windowMat);
        front1.name = 'Window';
        front1.position.set(-insetX, y, zOffset);
        group.add(front1);
        const front2 = front1.clone();
        front2.position.x = insetX;
        group.add(front2);

        // Back (-Z)
        const back1 = front1.clone();
        back1.position.set(-insetX, y, -zOffset);
        back1.rotateY(Math.PI);
        group.add(back1);
        const back2 = back1.clone();
        back2.position.x = insetX;
        group.add(back2);

        // Right (+X)
        const right1 = front1.clone();
        right1.position.set(xOffset, y, insetZ);
        right1.rotateY(-Math.PI / 2);
        group.add(right1);
        const right2 = right1.clone();
        right2.position.z = -insetZ;
        group.add(right2);

        // Left (-X)
        const left1 = front1.clone();
        left1.position.set(-xOffset, y, insetZ);
        left1.rotateY(Math.PI / 2);
        group.add(left1);
        const left2 = left1.clone();
        left2.position.z = -insetZ;
        group.add(left2);
    }

    group.traverse(child => child.updateMatrix());
    group.updateMatrixWorld(true);
    return group;
}

// Ensure assets dir exists
const assetsDir = path.resolve('assets');
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir);
}

const exporter = new OBJExporter();

// Export F16 with MTL
const f16 = createF16();
const f16Obj = exporter.parse(f16);
const f16ObjWithMTL = `mtllib f16.mtl\n${f16Obj}`;
fs.writeFileSync(path.join(assetsDir, 'f16.obj'), f16ObjWithMTL);

const f16Materials = [
    { name: 'Fuselage', color: 0x555555, shininess: 30 },
    { name: 'Cockpit', color: 0x88CCFF, shininess: 100, opacity: 0.7 },
    { name: 'Wings', color: 0x444444, shininess: 30 },
    { name: 'Gear', color: 0x333333, shininess: 20 }
];
fs.writeFileSync(path.join(assetsDir, 'f16.mtl'), createMTL(f16Materials));
console.log('✓ F16 OBJ + MTL exported');

// Export Pine Tree with MTL
const tree = createTree();
const treeObj = exporter.parse(tree);
const treeObjWithMTL = `mtllib pine_tree.mtl\n${treeObj}`;
fs.writeFileSync(path.join(assetsDir, 'pine_tree.obj'), treeObjWithMTL);

const treeMaterials = [
    { name: 'Trunk', color: 0x8B4513, shininess: 10, illum: 1 },
    { name: 'Leaves', color: 0x228B22, shininess: 5, illum: 1 }
];
fs.writeFileSync(path.join(assetsDir, 'pine_tree.mtl'), createMTL(treeMaterials));
console.log('✓ Pine Tree OBJ + MTL exported');

// Export Round Tree with MTL
const roundTree = createRoundTree();
const roundTreeObj = exporter.parse(roundTree);
const roundTreeObjWithMTL = `mtllib round_tree.mtl\n${roundTreeObj}`;
fs.writeFileSync(path.join(assetsDir, 'round_tree.obj'), roundTreeObjWithMTL);

const roundTreeMaterials = [
    { name: 'Trunk', color: 0x8B4513, shininess: 10, illum: 1 },
    { name: 'Leaves', color: 0x2E8B57, shininess: 5, illum: 1 }
];
fs.writeFileSync(path.join(assetsDir, 'round_tree.mtl'), createMTL(roundTreeMaterials));
console.log('✓ Round Tree OBJ + MTL exported');

// Export Palm Tree with MTL
const palmTree = createPalmTree();
const palmTreeObj = exporter.parse(palmTree);
const palmTreeObjWithMTL = `mtllib palm_tree.mtl\n${palmTreeObj}`;
fs.writeFileSync(path.join(assetsDir, 'palm_tree.obj'), palmTreeObjWithMTL);

const palmTreeMaterials = [
    { name: 'Trunk', color: 0x8B7355, shininess: 10, illum: 1 },
    { name: 'Leaves', color: 0x228B22, shininess: 5, illum: 1 }
];
fs.writeFileSync(path.join(assetsDir, 'palm_tree.mtl'), createMTL(palmTreeMaterials));
console.log('✓ Palm Tree OBJ + MTL exported');

// Export Mushroom Tree with MTL
const mushroomTree = createMushroomTree();
const mushroomTreeObj = exporter.parse(mushroomTree);
const mushroomTreeObjWithMTL = `mtllib mushroom_tree.mtl\n${mushroomTreeObj}`;
fs.writeFileSync(path.join(assetsDir, 'mushroom_tree.obj'), mushroomTreeObjWithMTL);

const mushroomTreeMaterials = [
    { name: 'Stalk', color: 0xF5DEB3, shininess: 10, illum: 1 },
    { name: 'Cap', color: 0xFF6347, shininess: 15, illum: 1 },
    { name: 'Spots', color: 0xFFFFFF, shininess: 20, illum: 1 }
];
fs.writeFileSync(path.join(assetsDir, 'mushroom_tree.mtl'), createMTL(mushroomTreeMaterials));
console.log('✓ Mushroom Tree OBJ + MTL exported');

// Export Baobab Tree with MTL
const baobabTree = createBaobabTree();
const baobabTreeObj = exporter.parse(baobabTree);
const baobabTreeObjWithMTL = `mtllib baobab_tree.mtl\n${baobabTreeObj}`;
fs.writeFileSync(path.join(assetsDir, 'baobab_tree.obj'), baobabTreeObjWithMTL);

const baobabTreeMaterials = [
    { name: 'Trunk', color: 0x8B7355, shininess: 10, illum: 1 },
    { name: 'Branches', color: 0x654321, shininess: 8, illum: 1 },
    { name: 'Leaves', color: 0x228B22, shininess: 5, illum: 1 }
];
fs.writeFileSync(path.join(assetsDir, 'baobab_tree.mtl'), createMTL(baobabTreeMaterials));
console.log('✓ Baobab Tree OBJ + MTL exported');

// Export Buildings with MTL
const b2 = createBuilding(2, 4, 12, 10);
const b3 = createBuilding(3, 4, 12, 10);
const b5 = createBuilding(5, 4, 14, 12);

const buildingMaterials = [
    { name: 'BuildingBody', color: 0xffffff, shininess: 20 },
    { name: 'Window', color: 0x000000, shininess: 50 }
];

const b2Obj = `mtllib building_2.mtl\n${exporter.parse(b2)}`;
fs.writeFileSync(path.join(assetsDir, 'building_2.obj'), b2Obj);
fs.writeFileSync(path.join(assetsDir, 'building_2.mtl'), createMTL(buildingMaterials));

const b3Obj = `mtllib building_3.mtl\n${exporter.parse(b3)}`;
fs.writeFileSync(path.join(assetsDir, 'building_3.obj'), b3Obj);
fs.writeFileSync(path.join(assetsDir, 'building_3.mtl'), createMTL(buildingMaterials));

const b5Obj = `mtllib building_5.mtl\n${exporter.parse(b5)}`;
fs.writeFileSync(path.join(assetsDir, 'building_5.obj'), b5Obj);
fs.writeFileSync(path.join(assetsDir, 'building_5.mtl'), createMTL(buildingMaterials));

console.log('✓ Buildings OBJ + MTL exported (2F, 3F, 5F)');
