// Rotate A-10 180 degrees and scale down by 50%
const fs = require('fs');
const path = require('path');

const inputObjPath = path.join(__dirname, '../assets/a10.obj');
const backupObjPath = path.join(__dirname, '../assets/a10_BACKUP_FINAL.obj');

console.log('Reading A-10 model...');
const objContent = fs.readFileSync(inputObjPath, 'utf8');
const lines = objContent.split('\n');

console.log(`Processing ${lines.length} lines...`);
const outputLines = [];
let vertexCount = 0;

// Rotation: 180 degrees around Y-axis
// cos(180°) = -1, sin(180°) = 0
// Rotation matrix for 180° around Y:
// x' = -x
// y' = y
// z' = -z

for (let line of lines) {
    const trimmed = line.trim();
    
    // Process vertex lines (v x y z)
    if (trimmed.startsWith('v ')) {
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 4) {
            let x = parseFloat(parts[1]);
            let y = parseFloat(parts[2]);
            let z = parseFloat(parts[3]);
            
            // Step 1: Rotate 180° around Y-axis
            const xRotated = -x;
            const yRotated = y;
            const zRotated = -z;
            
            // Step 2: Scale down by 50% (0.5x)
            const xFinal = xRotated * 0.5;
            const yFinal = yRotated * 0.5;
            const zFinal = zRotated * 0.5;
            
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
            
            // Rotate normals (but don't scale - they're unit vectors)
            const nxRotated = -nx;
            const nyRotated = ny;
            const nzRotated = -nz;
            
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

// Write fixed version
console.log('Writing fixed model...');
fs.writeFileSync(inputObjPath, outputLines.join('\n'));

console.log('✓ A-10 fixed successfully!');
console.log(`  - Processed ${vertexCount} vertices`);
console.log(`  - Rotated 180° around Y-axis (now facing forward)`);
console.log(`  - Scaled down by 50% (0.5x)`);
console.log(`  - Total scale from original: 2.5% (0.025x)`);
console.log(`  - Backup saved as: a10_BACKUP_FINAL.obj`);

