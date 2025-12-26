/**
 * Script to scale asset geometry directly (not via transform)
 * This modifies the actual vertex positions in the OBJ file
 */

import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const assetsDir = path.join(__dirname, '..', 'assets');

// Asset scaling configuration
const assetsToScale = [
    {
        input: 'Lowpoly_tree_sample.obj',
        output: 'Lowpoly_tree_sample.obj',
        backup: 'Lowpoly_tree_sample_ORIGINAL.obj',
        scale: 2.0,  // 100% larger = 2x
        mtl: 'Lowpoly_tree_sample.mtl',
        description: 'Lowpoly Tree (2x larger)'
    },
    {
        input: 'Building.obj',
        output: 'Building.obj',
        backup: 'Building_ORIGINAL.obj',
        scale: 6.0,  // 500% larger = 6x
        mtl: 'Building.mtl',
        description: 'City Building (6x larger)'
    }
];

const loader = new OBJLoader();
const exporter = new OBJExporter();

for (const asset of assetsToScale) {
    console.log(`\nProcessing: ${asset.description}`);
    console.log(`  Scale factor: ${asset.scale}x`);
    
    const inputPath = path.join(assetsDir, asset.input);
    const outputPath = path.join(assetsDir, asset.output);
    const backupPath = path.join(assetsDir, asset.backup);
    
    // Create backup if it doesn't exist
    if (!fs.existsSync(backupPath)) {
        console.log(`  Creating backup: ${asset.backup}`);
        fs.copyFileSync(inputPath, backupPath);
    } else {
        console.log(`  Backup already exists: ${asset.backup}`);
        console.log(`  Restoring from backup...`);
        fs.copyFileSync(backupPath, inputPath);
    }
    
    // Load the OBJ file
    const objData = fs.readFileSync(inputPath, 'utf8');
    const object = loader.parse(objData);
    
    console.log(`  Loaded object with ${object.children.length} children`);
    
    // Scale all geometry
    object.traverse((child) => {
        if (child.isMesh && child.geometry) {
            // Scale the geometry's vertices directly
            child.geometry.scale(asset.scale, asset.scale, asset.scale);
        }
    });
    
    console.log(`  Scaled all geometry by ${asset.scale}x`);
    
    // Export the modified object
    const result = exporter.parse(object);
    
    // Add the mtllib reference at the top
    const finalOutput = `# Scaled by scale_assets.js
# Scale factor: ${asset.scale}x
# Original: ${asset.backup}
mtllib ${asset.mtl}
${result}`;
    
    // Write the scaled file
    fs.writeFileSync(outputPath, finalOutput);
    
    console.log(`  ✓ Saved: ${asset.output}`);
}

console.log('\n✓ All assets scaled successfully!');
console.log('  Original files backed up with _ORIGINAL suffix');

