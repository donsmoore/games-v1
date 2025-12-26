import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const assetsDir = path.resolve(__dirname, '../assets');
const inputFile = path.join(assetsDir, 'ManyBuildings.obj');

async function extractBuildings() {
    console.log('Loading ManyBuildings.obj (73MB - this may take a minute)...');
    
    // Read the file content
    const objContent = fs.readFileSync(inputFile, 'utf8');
    console.log('✓ File loaded, parsing...');
    
    // Parse the OBJ
    const loader = new OBJLoader();
    const object = loader.parse(objContent);
    
    console.log(`✓ Parsed! Found ${object.children.length} objects`);
    
    // Find all building objects
    const buildingObjects = [];
    object.children.forEach(child => {
        if (child.name && child.name.includes('building_')) {
            buildingObjects.push(child);
        }
    });
    
    console.log(`✓ Found ${buildingObjects.length} buildings`);
    
    // Extract first 10 buildings
    const exporter = new OBJExporter();
    const numToExtract = Math.min(10, buildingObjects.length);
    
    for (let i = 0; i < numToExtract; i++) {
        const building = buildingObjects[i];
        const buildingNum = String(i + 1).padStart(3, '0'); // 001, 002, etc.
        const objFileName = `ManyBuildings-${buildingNum}.obj`;
        const mtlFileName = `ManyBuildings-${buildingNum}.mtl`;
        const objFilePath = path.join(assetsDir, objFileName);
        const mtlFilePath = path.join(assetsDir, mtlFileName);
        
        console.log(`\nExtracting building ${i + 1}/10: ${building.name}`);
        
        // Create a temporary group to hold just this building
        const tempGroup = new THREE.Group();
        tempGroup.add(building.clone());
        
        // Export to OBJ
        const objOutput = exporter.parse(tempGroup);
        
        // Add mtllib reference
        const finalObjContent = `mtllib ${mtlFileName}\n${objOutput}`;
        
        // Write OBJ file
        fs.writeFileSync(objFilePath, finalObjContent);
        console.log(`  ✓ Saved: ${objFileName}`);
        
        // Create a simple grey MTL file
        const mtlContent = `# Material Library for ${objFileName}
# Auto-generated

newmtl Material
Kd 0.60 0.60 0.60
Ka 0.20 0.20 0.20
Ks 0.30 0.30 0.30
Ns 80
d 1
illum 2

newmtl default
Kd 0.60 0.60 0.60
Ka 0.20 0.20 0.20
Ks 0.30 0.30 0.30
Ns 80
d 1
illum 2
`;
        
        // Write MTL file
        fs.writeFileSync(mtlFilePath, mtlContent);
        console.log(`  ✓ Saved: ${mtlFileName}`);
    }
    
    console.log('\n✓ Extraction complete!');
    console.log(`  Extracted ${numToExtract} buildings`);
    console.log(`  Files: ManyBuildings-001.obj through ManyBuildings-${String(numToExtract).padStart(3, '0')}.obj`);
    console.log('  Refresh asset viewer to see them!');
}

extractBuildings().catch(err => {
    console.error('Error:', err);
    console.error('\nNote: This is a very large file (73MB).');
    console.error('If you run out of memory, try extracting fewer buildings or splitting manually.');
});

