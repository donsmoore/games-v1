const fs = require('fs');
const path = require('path');

// Restore from backup first
const backupPath = path.join(__dirname, '../assets/a10.obj.backup');
const objPath = path.join(__dirname, '../assets/a10.obj');

fs.copyFileSync(backupPath, objPath);
console.log('✓ Restored A-10 from backup');

const objContent = fs.readFileSync(objPath, 'utf8');

// Parse vertices
const lines = objContent.split('\n');
const vertices = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('v ')) {
        const parts = line.split(/\s+/);
        vertices.push({
            x: parseFloat(parts[1]),
            y: parseFloat(parts[2]),
            z: parseFloat(parts[3]),
            index: vertices.length + 1
        });
    }
}

console.log(`Total vertices: ${vertices.length}`);

// Cockpit criteria: elevated (Y > 0.6) and forward (Z < -4.5)
const cockpitVertexIndices = new Set();
vertices.forEach((v, idx) => {
    if (v.y > 0.6 && v.z < -4.5) {
        cockpitVertexIndices.add(idx + 1); // 1-indexed
    }
});

console.log(`Found ${cockpitVertexIndices.size} cockpit vertices`);

// Process the OBJ file and mark cockpit faces
let outputLines = [];
let currentMaterial = null;
let cockpitFaceCount = 0;
let inCockpitSection = false;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (trimmed.startsWith('usemtl ')) {
        currentMaterial = trimmed.split(' ')[1];
        outputLines.push(line);
    } else if (trimmed.startsWith('f ')) {
        // Check if this face uses cockpit vertices
        const faceVertices = trimmed.match(/\d+/g).map(Number);
        const hasCockpitVertex = faceVertices.some(v => cockpitVertexIndices.has(v));
        
        if (hasCockpitVertex && currentMaterial !== 'A10Cockpit') {
            // Switch to cockpit material
            outputLines.push('usemtl A10Cockpit');
            currentMaterial = 'A10Cockpit';
            inCockpitSection = true;
            cockpitFaceCount++;
        } else if (!hasCockpitVertex && currentMaterial === 'A10Cockpit') {
            // Switch back to body material
            outputLines.push('usemtl A10Body');
            currentMaterial = 'A10Body';
            inCockpitSection = false;
        }
        
        if (hasCockpitVertex) {
            cockpitFaceCount++;
        }
        
        outputLines.push(line);
    } else {
        outputLines.push(line);
    }
}

console.log(`Applied cockpit material to ${cockpitFaceCount} faces`);

// Write output
fs.writeFileSync(objPath, outputLines.join('\n'));
console.log('✓ Cockpit material properly applied to A-10 model');

