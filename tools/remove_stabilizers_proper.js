import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { URL as NodeURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const assetsDir = path.resolve(__dirname, '../assets');
const inputFileName = 'f16.obj';
const inputFilePath = path.join(assetsDir, inputFileName);
const backupFilePath = path.join(assetsDir, 'f16_WITH_STABILIZERS.obj');
const mtlFileName = 'f16.mtl';

async function removeStabilizers() {
    console.log(`Loading ${inputFileName}...`);

    // Read files
    const objContent = fs.readFileSync(inputFilePath, 'utf8');
    const mtlContent = fs.readFileSync(path.join(assetsDir, mtlFileName), 'utf8');

    // Create backup if it doesn't exist
    if (!fs.existsSync(backupFilePath)) {
        fs.writeFileSync(backupFilePath, objContent);
        console.log(`✓ Created backup: ${path.basename(backupFilePath)}`);
    }

    // Parse OBJ manually (Three.js OBJLoader needs URLs)
    const loader = new OBJLoader();
    
    // Parse the OBJ content directly
    const object = loader.parse(objContent);
    
    // Load MTL
    const mtlLoader = new MTLLoader();
    const materials = mtlLoader.parse(mtlContent, '');
    materials.preload();

    console.log(`Loaded object with ${object.children.length} children`);

    // Find and remove Stabilizers
    let stabilizersObject = null;
    for (let i = object.children.length - 1; i >= 0; i--) {
        const child = object.children[i];
        if (child.name === 'Stabilizers') {
            stabilizersObject = child;
            object.remove(child);
            console.log(`✓ Removed Stabilizers mesh (child ${i})`);
            break;
        }
    }

    if (!stabilizersObject) {
        console.log('⚠ No object named "Stabilizers" found.');
        console.log('Available objects:', object.children.map(c => c.name));
        return;
    }

    // Re-export the modified object
    const exporter = new OBJExporter();
    const modifiedObjContent = exporter.parse(object);

    // Add mtllib reference at the top
    const finalObjContent = `mtllib ${mtlFileName}\n${modifiedObjContent}`;

    fs.writeFileSync(inputFilePath, finalObjContent);
    console.log(`✓ ${inputFileName} updated successfully`);
    console.log(`  Stabilizers removed`);
    console.log(`  Vertex indices renumbered correctly`);
    console.log(`  Backup saved as: ${path.basename(backupFilePath)}`);
}

removeStabilizers().catch(console.error);

