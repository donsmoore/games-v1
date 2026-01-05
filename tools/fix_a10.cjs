// Fix A-10 model: scale down to 1/10th size and rotate 90° to make it upright
const fs = require('fs');
const path = require('path');

const inputObjPath = path.join(__dirname, '../assets/a10.obj');
const outputObjPath = path.join(__dirname, '../assets/a10_fixed.obj');
const backupObjPath = path.join(__dirname, '../assets/a10_ORIGINAL.obj');

console.log('Reading A-10 model...');
const objContent = fs.readFileSync(inputObjPath, 'utf8');
const lines = objContent.split('\n');

console.log(`Processing ${lines.length} lines...`);
const outputLines = [];
let vertexCount = 0;

for (let line of lines) {
    const trimmed = line.trim();
    
    // Process vertex lines (v x y z)
    if (trimmed.startsWith('v ')) {
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 4) {
            let x = parseFloat(parts[1]);
            let y = parseFloat(parts[2]);
            let z = parseFloat(parts[3]);
            
            // Step 1: Rotate 90 degrees around X-axis (to make upright)
            // Rotation matrix for 90° around X:
            // x' = x
            // y' = -z
            // z' = y
            const xRotated = x;
            const yRotated = -z;
            const zRotated = y;
            
            // Step 2: Scale down to 1/10th size
            const xFinal = xRotated * 0.1;
            const yFinal = yRotated * 0.1;
            const zFinal = zRotated * 0.1;
            
            outputLines.push(`v ${xFinal.toFixed(6)} ${yFinal.toFixed(6)} ${zFinal.toFixed(6)}`);
            vertexCount++;
        } else {
            outputLines.push(line);
        }
    }
    // Process vertex texture coordinates (vt u v)
    else if (trimmed.startsWith('vt ')) {
        // Keep texture coordinates as-is
        outputLines.push(line);
    }
    // Process vertex normals (vn x y z)
    else if (trimmed.startsWith('vn ')) {
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 4) {
            let nx = parseFloat(parts[1]);
            let ny = parseFloat(parts[2]);
            let nz = parseFloat(parts[3]);
            
            // Rotate normals too (but don't scale them - normals are unit vectors)
            const nxRotated = nx;
            const nyRotated = -nz;
            const nzRotated = ny;
            
            outputLines.push(`vn ${nxRotated.toFixed(6)} ${nyRotated.toFixed(6)} ${nzRotated.toFixed(6)}`);
        } else {
            outputLines.push(line);
        }
    }
    // Keep all other lines as-is (faces, materials, etc.)
    else {
        outputLines.push(line);
    }
}

// Create backup of original
console.log('Creating backup of original...');
fs.copyFileSync(inputObjPath, backupObjPath);

// Write fixed version
console.log('Writing fixed model...');
fs.writeFileSync(outputObjPath, outputLines.join('\n'));

// Replace original with fixed version
console.log('Replacing original with fixed version...');
fs.copyFileSync(outputObjPath, inputObjPath);
fs.unlinkSync(outputObjPath);

console.log('✓ A-10 fixed successfully!');
console.log(`  - Processed ${vertexCount} vertices`);
console.log(`  - Scaled down to 1/10th size (0.1x)`);
console.log(`  - Rotated 90° around X-axis (now upright)`);
console.log(`  - Original backed up as: a10_ORIGINAL.obj`);

