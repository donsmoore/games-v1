const fs = require('fs');
const path = require('path');

const objPath = path.join(__dirname, '../assets/a10.obj');
const objContent = fs.readFileSync(objPath, 'utf8');

// Parse vertices
const lines = objContent.split('\n');
const vertices = [];
const faces = [];
let inMeshGroup = null;

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
    } else if (line.startsWith('g ')) {
        inMeshGroup = line;
    } else if (line.startsWith('f ') && inMeshGroup) {
        faces.push({
            group: inMeshGroup,
            line: line,
            lineIndex: i
        });
    }
}

console.log(`Total vertices: ${vertices.length}`);
console.log(`Total faces: ${faces.length}`);

// Find vertices that are likely cockpit (high Y, forward Z)
// Analyze Z range
const zValues = vertices.map(v => v.z);
const minZ = Math.min(...zValues);
const maxZ = Math.max(...zValues);
console.log(`Z range: ${minZ.toFixed(2)} to ${maxZ.toFixed(2)}`);

// Find highest Y values (cockpit is raised)
const yValues = vertices.map(v => v.y);
const maxY = Math.max(...yValues);
const minY = Math.min(...yValues);
console.log(`Y range: ${minY.toFixed(2)} to ${maxY.toFixed(2)}`);

// Cockpit criteria: high Y (above 0.6) and forward Z (< -4.5)
const cockpitVertexIndices = new Set();
vertices.forEach((v, idx) => {
    // Cockpit is typically elevated and at the front
    if (v.y > 0.6 && v.z < -4.5) {
        cockpitVertexIndices.add(idx + 1); // 1-indexed
    }
});

console.log(`Found ${cockpitVertexIndices.size} cockpit vertices`);

// Find faces that use cockpit vertices
const cockpitFaceIndices = new Set();
faces.forEach((face, idx) => {
    const faceVertices = face.line.match(/\d+/g).map(Number);
    const hasCockpitVertex = faceVertices.some(v => cockpitVertexIndices.has(v));
    if (hasCockpitVertex) {
        cockpitFaceIndices.add(face.lineIndex);
    }
});

console.log(`Found ${cockpitFaceIndices.size} cockpit faces`);

// Create new OBJ with cockpit material
let outputLines = [...lines];
let insertedMaterial = false;

for (let i = 0; i < outputLines.length; i++) {
    const line = outputLines[i];
    
    // Insert cockpit material before cockpit faces
    if (cockpitFaceIndices.has(i) && !insertedMaterial) {
        outputLines.splice(i, 0, 'usemtl A10Cockpit');
        insertedMaterial = true;
        console.log(`Inserted cockpit material at line ${i}`);
        break;
    }
}

// Write output
fs.writeFileSync(objPath, outputLines.join('\n'));
console.log('✓ Cockpit material applied to A-10 model');

