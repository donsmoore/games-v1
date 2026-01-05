// Generate X-Wing Fighter Model (Star Wars inspired)
// 50% larger than F-16 with distinctive X-Wing features

const fs = require('fs');
const path = require('path');

// X-Wing is 50% larger than F-16 (F-16 is ~16 units long)
// X-Wing will be ~24 units long with 20 unit wingspan (when wings are in X position)

const vertices = [];
const faces = [];

let vIndex = 1; // OBJ indices start at 1

function addVertex(x, y, z) {
    vertices.push(`v ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}`);
}

function addFace(material, ...indices) {
    faces.push({ material, indices });
}

// ========================================
// 1. FUSELAGE (Long cylindrical body)
// ========================================
const fuselageLength = 24;
const fuselageRadius = 0.8;
const segments = 16;

// Front nose cone (pointed)
addVertex(0, 0, fuselageLength / 2 + 2); // Tip of nose
const noseTipIndex = vIndex++;

// Nose ring
for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = Math.cos(angle) * fuselageRadius * 0.5;
    const y = Math.sin(angle) * fuselageRadius * 0.5;
    addVertex(x, y, fuselageLength / 2);
}
const noseRingStart = vIndex;
vIndex += segments;

// Middle body rings (3 sections)
for (let section = 0; section < 4; section++) {
    const z = fuselageLength / 2 - (section + 1) * 6;
    const radius = fuselageRadius;
    
    for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        addVertex(x, y, z);
    }
}
const bodyRingsStart = vIndex;
vIndex += segments * 4;

// Faces for fuselage
// Nose cone
for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    addFace('Fuselage', noseTipIndex, noseRingStart + i, noseRingStart + next);
}

// Body segments
for (let section = 0; section < 4; section++) {
    const ringStart = noseRingStart + section * segments;
    const nextRingStart = noseRingStart + (section + 1) * segments;
    
    for (let i = 0; i < segments; i++) {
        const next = (i + 1) % segments;
        // Quad split into 2 triangles
        addFace('Fuselage', ringStart + i, nextRingStart + i, nextRingStart + next);
        addFace('Fuselage', ringStart + i, nextRingStart + next, ringStart + next);
    }
}

// ========================================
// 2. COCKPIT BUBBLE (Raised canopy on top)
// ========================================
const cockpitZ = fuselageLength / 2 - 8; // Position
const cockpitLength = 4;
const cockpitWidth = 1.2;
const cockpitHeight = 1.0;

// Cockpit vertices (bubble shape)
const cockpitVertices = [];
for (let i = 0; i <= 8; i++) {
    const tZ = (i / 8) * cockpitLength - cockpitLength / 2;
    const z = cockpitZ + tZ;
    
    // Height profile (dome shape)
    const heightFactor = 1 - Math.pow((i - 4) / 4, 2);
    const h = cockpitHeight * heightFactor;
    
    // Width profile
    const widthFactor = 1 - Math.abs(i - 4) / 4 * 0.3;
    const w = cockpitWidth * widthFactor;
    
    addVertex(-w / 2, fuselageRadius + h * 0.5, z); // Left
    addVertex(0, fuselageRadius + h, z); // Top
    addVertex(w / 2, fuselageRadius + h * 0.5, z); // Right
}
const cockpitStart = vIndex;
vIndex += 27; // 9 slices * 3 vertices

// Cockpit faces
for (let i = 0; i < 8; i++) {
    const base = cockpitStart + i * 3;
    const next = base + 3;
    
    // Left side
    addFace('Cockpit', base, base + 1, next + 1);
    addFace('Cockpit', base, next + 1, next);
    
    // Right side
    addFace('Cockpit', base + 1, base + 2, next + 2);
    addFace('Cockpit', base + 1, next + 2, next + 1);
}

// ========================================
// 3. WINGS IN X CONFIGURATION (4 wings)
// ========================================
const wingLength = 10; // From fuselage to tip
const wingWidth = 0.5;
const wingThickness = 0.3;
const wingRootZ = fuselageLength / 2 - 14; // Position along fuselage

// X-Wing configuration: 4 wings at 45° angles (top-right, top-left, bottom-right, bottom-left)
const wingAngles = [45, 135, -45, -135]; // degrees

for (let w = 0; w < 4; w++) {
    const angle = (wingAngles[w] * Math.PI) / 180;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    
    // Wing root (at fuselage)
    const rootX = cosA * fuselageRadius;
    const rootY = sinA * fuselageRadius;
    
    // Wing tip
    const tipX = cosA * (fuselageRadius + wingLength);
    const tipY = sinA * (fuselageRadius + wingLength);
    
    // Wing vertices (simple rectangular wing)
    // Root leading edge
    addVertex(rootX, rootY, wingRootZ + wingWidth);
    // Root trailing edge
    addVertex(rootX, rootY, wingRootZ - wingWidth);
    // Tip leading edge
    addVertex(tipX, tipY, wingRootZ + wingWidth * 0.6);
    // Tip trailing edge
    addVertex(tipX, tipY, wingRootZ - wingWidth * 0.6);
    
    const wingStart = vIndex;
    vIndex += 4;
    
    // Wing faces (top and bottom)
    addFace('Wings', wingStart, wingStart + 1, wingStart + 2);
    addFace('Wings', wingStart + 1, wingStart + 3, wingStart + 2);
    addFace('Wings', wingStart, wingStart + 2, wingStart + 1); // Bottom (reverse winding)
    addFace('Wings', wingStart + 1, wingStart + 2, wingStart + 3);
}

// ========================================
// 4. ENGINE NACELLES (at wing tips)
// ========================================
for (let w = 0; w < 4; w++) {
    const angle = (wingAngles[w] * Math.PI) / 180;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    
    const centerX = cosA * (fuselageRadius + wingLength);
    const centerY = sinA * (fuselageRadius + wingLength);
    
    // Engine cylinder (4 sides for simplicity)
    const engineRadius = 0.5;
    const engineLength = 3;
    
    for (let i = 0; i < 4; i++) {
        const eAngle = (i / 4) * Math.PI * 2;
        const ex = Math.cos(eAngle) * engineRadius;
        const ey = Math.sin(eAngle) * engineRadius;
        
        // Front
        addVertex(centerX + ex, centerY + ey, wingRootZ + engineLength / 2);
        // Back
        addVertex(centerX + ex, centerY + ey, wingRootZ - engineLength / 2);
    }
    
    const engineStart = vIndex;
    vIndex += 8;
    
    // Engine faces
    for (let i = 0; i < 4; i++) {
        const next = (i + 1) % 4;
        const front1 = engineStart + i * 2;
        const back1 = engineStart + i * 2 + 1;
        const front2 = engineStart + next * 2;
        const back2 = engineStart + next * 2 + 1;
        
        addFace('Engines', front1, back1, back2);
        addFace('Engines', front1, back2, front2);
    }
    
    // Engine front cap (glowing)
    const capCenter = vIndex;
    addVertex(centerX, centerY, wingRootZ + engineLength / 2);
    vIndex++;
    
    for (let i = 0; i < 4; i++) {
        const next = (i + 1) % 4;
        addFace('EngineGlow', capCenter, engineStart + i * 2, engineStart + next * 2);
    }
    
    // Engine back (exhaust)
    const exhaustCenter = vIndex;
    addVertex(centerX, centerY, wingRootZ - engineLength / 2);
    vIndex++;
    
    for (let i = 0; i < 4; i++) {
        const next = (i + 1) % 4;
        addFace('EngineGlow', exhaustCenter, engineStart + next * 2 + 1, engineStart + i * 2 + 1);
    }
}

// ========================================
// 5. LASER CANNONS (4 small cylinders at wing tips)
// ========================================
for (let w = 0; w < 4; w++) {
    const angle = (wingAngles[w] * Math.PI) / 180;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    
    const centerX = cosA * (fuselageRadius + wingLength + 0.3);
    const centerY = sinA * (fuselageRadius + wingLength + 0.3);
    
    // Laser cannon (small cylinder)
    const cannonRadius = 0.15;
    const cannonLength = 2;
    
    for (let i = 0; i < 4; i++) {
        const cAngle = (i / 4) * Math.PI * 2;
        const cx = Math.cos(cAngle) * cannonRadius;
        const cy = Math.sin(cAngle) * cannonRadius;
        
        addVertex(centerX + cx, centerY + cy, wingRootZ + cannonLength);
        addVertex(centerX + cx, centerY + cy, wingRootZ - cannonLength);
    }
    
    const cannonStart = vIndex;
    vIndex += 8;
    
    for (let i = 0; i < 4; i++) {
        const next = (i + 1) % 4;
        const front1 = cannonStart + i * 2;
        const back1 = cannonStart + i * 2 + 1;
        const front2 = cannonStart + next * 2;
        const back2 = cannonStart + next * 2 + 1;
        
        addFace('Weapons', front1, back1, back2);
        addFace('Weapons', front1, back2, front2);
    }
}

// ========================================
// Write OBJ file
// ========================================
let objContent = '# X-Wing Fighter\n';
objContent += '# Generated procedurally\n';
objContent += `mtllib xwing.mtl\n\n`;

// Add vertices
objContent += vertices.join('\n') + '\n\n';

// Group faces by material
const materialGroups = {};
faces.forEach(face => {
    if (!materialGroups[face.material]) {
        materialGroups[face.material] = [];
    }
    materialGroups[face.material].push(face.indices);
});

// Write faces
for (const [material, faceList] of Object.entries(materialGroups)) {
    objContent += `usemtl ${material}\n`;
    faceList.forEach(indices => {
        objContent += `f ${indices.join(' ')}\n`;
    });
    objContent += '\n';
}

fs.writeFileSync(path.join(__dirname, '../assets/xwing.obj'), objContent);

// ========================================
// Write MTL file
// ========================================
let mtlContent = '# X-Wing Fighter Materials\n\n';

// Fuselage - White/Grey
mtlContent += `newmtl Fuselage
Ka 0.8 0.8 0.8
Kd 0.9 0.9 0.9
Ks 0.5 0.5 0.5
Ns 50.0
d 1.0
illum 2

`;

// Cockpit - Blue tinted glass
mtlContent += `newmtl Cockpit
Ka 0.1 0.2 0.3
Kd 0.2 0.4 0.6
Ks 0.8 0.9 1.0
Ns 200.0
d 0.7
illum 2

`;

// Wings - White/Grey with red accents
mtlContent += `newmtl Wings
Ka 0.7 0.7 0.7
Kd 0.85 0.85 0.85
Ks 0.4 0.4 0.4
Ns 40.0
d 1.0
illum 2

`;

// Engines - Dark metal
mtlContent += `newmtl Engines
Ka 0.2 0.2 0.2
Kd 0.3 0.3 0.35
Ks 0.6 0.6 0.7
Ns 80.0
d 1.0
illum 2

`;

// Engine Glow - Bright blue
mtlContent += `newmtl EngineGlow
Ka 0.2 0.4 1.0
Kd 0.4 0.6 1.0
Ks 0.8 0.9 1.0
Ns 100.0
d 1.0
illum 2

`;

// Weapons - Red/Orange (laser cannons)
mtlContent += `newmtl Weapons
Ka 0.4 0.2 0.1
Kd 0.6 0.3 0.2
Ks 0.7 0.5 0.4
Ns 60.0
d 1.0
illum 2

`;

fs.writeFileSync(path.join(__dirname, '../assets/xwing.mtl'), mtlContent);

console.log('✓ X-Wing fighter generated successfully!');
console.log('  - xwing.obj');
console.log('  - xwing.mtl');
console.log('  Length: ~24 units (50% larger than F-16)');
console.log('  Wingspan: ~20 units (in X configuration)');
console.log('  Features: 4 wings, cockpit bubble, 4 engines, 4 laser cannons');

