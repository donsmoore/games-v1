import * as THREE from 'three';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import fs from 'fs';
import path from 'path';

// Mock browser environment if needed
if (!global.window) global.window = {};
if (!global.document) global.document = {};

function createF16() {
    const group = new THREE.Group();
    group.name = "F16";

    // Fuselage (Body) - Cylinder along Z axis
    const fuselageGeo = new THREE.CylinderGeometry(0.5, 0.5, 4, 16);
    fuselageGeo.rotateX(Math.PI / 2); // Rotate to lie on Z axis
    const fuselageMat = new THREE.MeshPhongMaterial({ color: 0x555555 });
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

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 1.5, 8);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.name = "Trunk";
    trunk.position.y = 0.75;
    group.add(trunk);

    // Leaves (Cone)
    const leavesGeo = new THREE.ConeGeometry(1.2, 3, 8);
    const leavesMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.name = "Leaves";
    leaves.position.y = 2.5;
    group.add(leaves);

    // Scale Up 10x
    group.scale.set(10, 10, 10);

    // Update Matrices
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
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.name = 'BuildingBody';
    body.position.y = height / 2;
    group.add(body);

    // Windows: 2 per side per floor -> 8 per floor, 4 sides
    const windowMat = new THREE.MeshPhongMaterial({ color: 0x000000 });
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

// Export F16
const f16 = createF16();
const f16Obj = exporter.parse(f16);
fs.writeFileSync(path.join(assetsDir, 'f16.obj'), f16Obj);
console.log('F16 OBJ exported');

// Export Tree
const tree = createTree();
const treeObj = exporter.parse(tree);
fs.writeFileSync(path.join(assetsDir, 'tree.obj'), treeObj);
console.log('Tree OBJ exported');

// Export Buildings
const b2 = createBuilding(2, 4, 12, 10);
const b3 = createBuilding(3, 4, 12, 10);
const b5 = createBuilding(5, 4, 14, 12);
fs.writeFileSync(path.join(assetsDir, 'building_2.obj'), exporter.parse(b2));
fs.writeFileSync(path.join(assetsDir, 'building_3.obj'), exporter.parse(b3));
fs.writeFileSync(path.join(assetsDir, 'building_5.obj'), exporter.parse(b5));
console.log('Buildings OBJ exported (2F, 3F, 5F)');
