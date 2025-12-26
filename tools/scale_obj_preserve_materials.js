/**
 * Scale OBJ files by directly modifying vertex coordinates
 * This preserves all material assignments, groups, and other OBJ data
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const assetsDir = path.join(__dirname, '..', 'assets');

function scaleOBJ(inputPath, outputPath, backupPath, scale) {
    // Create backup if it doesn't exist
    if (!fs.existsSync(backupPath)) {
        console.log(`  Creating backup: ${path.basename(backupPath)}`);
        fs.copyFileSync(inputPath, backupPath);
    } else {
        console.log(`  Restoring from backup: ${path.basename(backupPath)}`);
        fs.copyFileSync(backupPath, inputPath);
    }
    
    // Read the OBJ file
    const content = fs.readFileSync(inputPath, 'utf8');
    const lines = content.split('\n');
    
    let vertexCount = 0;
    let normalCount = 0;
    const outputLines = [];
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Scale vertex positions (v x y z)
        if (trimmed.startsWith('v ') && !trimmed.startsWith('vn') && !trimmed.startsWith('vt')) {
            const parts = trimmed.split(/\s+/);
            if (parts.length >= 4) {
                const x = parseFloat(parts[1]) * scale;
                const y = parseFloat(parts[2]) * scale;
                const z = parseFloat(parts[3]) * scale;
                outputLines.push(`v ${x} ${y} ${z}`);
                vertexCount++;
            } else {
                outputLines.push(line);
            }
        }
        // Don't scale normals (vn) - keep them normalized
        else if (trimmed.startsWith('vn ')) {
            outputLines.push(line);
            normalCount++;
        }
        // Keep everything else as-is (vt, f, usemtl, g, o, mtllib, etc.)
        else {
            outputLines.push(line);
        }
    }
    
    // Write the scaled file
    fs.writeFileSync(outputPath, outputLines.join('\n'));
    
    console.log(`  Scaled ${vertexCount} vertices, preserved ${normalCount} normals`);
    console.log(`  All materials and groups preserved`);
}

// Scale configuration
const assetsToScale = [
    {
        input: 'Lowpoly_tree_sample.obj',
        output: 'Lowpoly_tree_sample.obj',
        backup: 'Lowpoly_tree_sample_ORIGINAL.obj',
        scale: 2.0,
        description: 'Lowpoly Tree (2x larger)'
    },
    {
        input: 'Building.obj',
        output: 'Building.obj',
        backup: 'Building_ORIGINAL.obj',
        scale: 6.0,
        description: 'City Building (6x larger)'
    }
];

console.log('Scaling OBJ assets while preserving materials...\n');

for (const asset of assetsToScale) {
    console.log(`Processing: ${asset.description}`);
    console.log(`  Scale factor: ${asset.scale}x`);
    
    const inputPath = path.join(assetsDir, asset.input);
    const outputPath = path.join(assetsDir, asset.output);
    const backupPath = path.join(assetsDir, asset.backup);
    
    scaleOBJ(inputPath, outputPath, backupPath, asset.scale);
    
    console.log(`  ✓ Saved: ${asset.output}\n`);
}

console.log('✓ All assets scaled successfully!');
console.log('  Materials, textures, and groups preserved');

