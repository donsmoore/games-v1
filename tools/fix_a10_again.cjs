// Fix A-10 again: rotate 180° around X-axis and scale down by 50%
const fs = require('fs');
const path = require('path');

const inputObjPath = path.join(__dirname, '../assets/a10.obj');
const backupObjPath = path.join(__dirname, '../assets/a10_BACKUP2.obj');

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
            
            // Step 1: Rotate 180 degrees around X-axis (to flip upside down to right-side up)
            // Rotation matrix for 180° around X:
            // x' = x
            // y' = -y
            // z' = -z
            const xRotated = x;
            const yRotated = -y;
            const zRotated = -z;
            
            // Step 2: Scale down to 50% (0.5x) of current size
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
            
            // Rotate normals too (but don't scale them - normals are unit vectors)
            const nxRotated = nx;
            const nyRotated = -ny;
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

console.log('✓ A-10 fixed again successfully!');
console.log(`  - Processed ${vertexCount} vertices`);
console.log(`  - Rotated 180° around X-axis (now right-side up)`);
console.log(`  - Scaled down to 50% of previous size (0.5x)`);
console.log(`  - Total scale from original: 0.05x (5% of original size)`);
console.log(`  - Backup saved as: a10_BACKUP2.obj`);

