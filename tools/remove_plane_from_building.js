/**
 * Script to properly remove the Plane/ground object from Building.obj
 * This loads the OBJ, removes the plane mesh, and re-exports with correct vertex indices
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
const inputFile = path.join(assetsDir, 'Building.obj');
const backupFile = path.join(assetsDir, 'Building_BACKUP.obj');
const outputFile = path.join(assetsDir, 'Building.obj');

console.log('Loading Building.obj...');

// Check if we need to restore from backup first
if (fs.existsSync(backupFile)) {
    console.log('Found backup file, restoring original...');
    fs.copyFileSync(backupFile, inputFile);
}

// Read the OBJ file
const objData = fs.readFileSync(inputFile, 'utf8');

const loader = new OBJLoader();
const object = loader.parse(objData);

console.log(`Loaded object with ${object.children.length} children`);

// Find and remove the Plane object
let removedCount = 0;
const childrenToRemove = [];

object.traverse((child) => {
    if (child.isMesh && child.name.toLowerCase().includes('plane')) {
        console.log(`Found plane object: ${child.name}`);
        childrenToRemove.push(child);
        removedCount++;
    }
});

childrenToRemove.forEach(child => {
    child.parent.remove(child);
});

console.log(`Removed ${removedCount} plane object(s)`);

// Export the modified object
const exporter = new OBJExporter();
const result = exporter.parse(object);

// Add the mtllib reference at the top
const finalOutput = `# Modified by remove_plane_from_building.js
# Original: Building.obj
mtllib Building.mtl
${result}`;

// Create backup of original if it doesn't exist
if (!fs.existsSync(backupFile)) {
    console.log('Creating backup of original file...');
    fs.copyFileSync(inputFile, backupFile);
}

// Write the new file
fs.writeFileSync(outputFile, finalOutput);

console.log('✓ Building.obj updated successfully');
console.log(`  Backup saved as: Building_BACKUP.obj`);
console.log(`  Output saved as: Building,.obj`);

