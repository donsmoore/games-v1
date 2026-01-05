// Rotate A-10 model 90 degrees clockwise around Y-axis (vertical)
const fs = require('fs');
const path = require('path');

const inputObjPath = path.join(__dirname, '../assets/a10.obj');
const backupObjPath = path.join(__dirname, '../assets/a10_BACKUP_ROTATION.obj');

console.log('Reading A-10 model...');
const objContent = fs.readFileSync(inputObjPath, 'utf8');
const lines = objContent.split('\n');

console.log(`Processing ${lines.length} lines...`);
const outputLines = [];
let vertexCount = 0;

// Rotation: 90 degrees clockwise around Y-axis = -90 degrees = -π/2
// cos(-90°) = 0, sin(-90°) = -1
// Rotation matrix for -90° around Y:
// x' = z
// y' = y
// z' = -x

for (let line of lines) {
    const trimmed = line.trim();
    
    // Process vertex lines (v x y z)
    if (trimmed.startsWith('v ')) {
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 4) {
            let x = parseFloat(parts[1]);
            let y = parseFloat(parts[2]);
            let z = parseFloat(parts[3]);
            
            // Rotate 90° clockwise around Y-axis
            const xRotated = z;
            const yRotated = y;
            const zRotated = -x;
            
            outputLines.push(`v ${xRotated.toFixed(6)} ${yRotated.toFixed(6)} ${zRotated.toFixed(6)}`);
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
            
            // Rotate normals too
            const nxRotated = nz;
            const nyRotated = ny;
            const nzRotated = -nx;
            
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

// Create backup of current version
console.log('Creating backup of current version...');
fs.copyFileSync(inputObjPath, backupObjPath);

// Write rotated version
console.log('Writing rotated model...');
fs.writeFileSync(inputObjPath, outputLines.join('\n'));

console.log('✓ A-10 rotated successfully!');
console.log(`  - Processed ${vertexCount} vertices`);
console.log(`  - Rotated 90° clockwise around Y-axis`);
console.log(`  - A-10 should now face forward`);
console.log(`  - Backup saved as: a10_BACKUP_ROTATION.obj`);

