import * as THREE from 'three';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const assetsDir = path.resolve(__dirname, '../assets');

function randomColor() {
    return {
        r: Math.random() * 0.8 + 0.1, // 0.1 to 0.9
        g: Math.random() * 0.8 + 0.1,
        b: Math.random() * 0.8 + 0.1
    };
}

function realisticBuildingColors() {
    // Choose a random building style
    const styles = [
        {
            name: 'Modern Concrete',
            walls: { r: 0.55, g: 0.55, b: 0.53 },      // Light grey
            windows: { r: 0.20, g: 0.30, b: 0.45 },    // Blue-tinted glass
            accents: { r: 0.35, g: 0.35, b: 0.33 },    // Dark grey
            base: { r: 0.25, g: 0.25, b: 0.23 }        // Very dark grey
        },
        {
            name: 'Beige Office',
            walls: { r: 0.70, g: 0.65, b: 0.55 },      // Beige/tan
            windows: { r: 0.18, g: 0.25, b: 0.35 },    // Dark blue glass
            accents: { r: 0.50, g: 0.45, b: 0.38 },    // Brown
            base: { r: 0.40, g: 0.35, b: 0.28 }        // Dark brown
        },
        {
            name: 'Red Brick',
            walls: { r: 0.55, g: 0.30, b: 0.25 },      // Red brick
            windows: { r: 0.15, g: 0.20, b: 0.25 },    // Very dark glass
            accents: { r: 0.65, g: 0.60, b: 0.55 },    // Light beige trim
            base: { r: 0.35, g: 0.20, b: 0.18 }        // Dark brick
        },
        {
            name: 'White Modern',
            walls: { r: 0.85, g: 0.85, b: 0.83 },      // Off-white
            windows: { r: 0.22, g: 0.35, b: 0.50 },    // Blue glass
            accents: { r: 0.45, g: 0.45, b: 0.43 },    // Medium grey
            base: { r: 0.30, g: 0.30, b: 0.28 }        // Dark grey
        },
        {
            name: 'Brown Stone',
            walls: { r: 0.48, g: 0.42, b: 0.35 },      // Brown stone
            windows: { r: 0.12, g: 0.18, b: 0.22 },    // Almost black glass
            accents: { r: 0.58, g: 0.52, b: 0.45 },    // Light brown
            base: { r: 0.28, g: 0.24, b: 0.20 }        // Dark brown
        },
        {
            name: 'Blue Glass Tower',
            walls: { r: 0.60, g: 0.62, b: 0.65 },      // Light grey/silver
            windows: { r: 0.25, g: 0.40, b: 0.60 },    // Bright blue glass
            accents: { r: 0.35, g: 0.37, b: 0.40 },    // Dark grey
            base: { r: 0.20, g: 0.22, b: 0.25 }        // Almost black
        }
    ];

    const style = styles[Math.floor(Math.random() * styles.length)];
    console.log(`  Style: ${style.name}`);
    
    return [
        style.walls,    // Main wall color
        style.windows,  // Window color
        style.accents,  // Accent bands
        style.base      // Base/roof color
    ];
}

function createMTL(materials) {
    let mtl = '# AI Generated Building MTL\n';
    mtl += `# Created: ${new Date().toISOString()}\n`;
    mtl += `# Material Count: ${materials.length}\n\n`;

    materials.forEach(mat => {
        mtl += `newmtl ${mat.name}\n`;
        mtl += `Ns 225.000000\n`;
        mtl += `Ka 1.000000 1.000000 1.000000\n`;
        mtl += `Kd ${mat.r.toFixed(6)} ${mat.g.toFixed(6)} ${mat.b.toFixed(6)}\n`;
        mtl += `Ks 0.500000 0.500000 0.500000\n`;
        mtl += `Ke 0.000000 0.000000 0.000000\n`;
        mtl += `Ni 1.450000\n`;
        mtl += `d 1.000000\n`;
        mtl += `illum 2\n\n`;
    });

    return mtl;
}

function createBuilding(params) {
    const {
        width = 12,
        depth = 18,
        floors = 10,
        floorHeight = 3.5,
        windowsPerFloorX = 4,
        windowsPerFloorZ = 6,
        buildingName = 'AI-building-001'
    } = params;

    const group = new THREE.Group();
    group.name = buildingName;

    // Generate 4 realistic building colors
    const colors = realisticBuildingColors();

    const materials = colors.map((c, i) => ({
        name: `${buildingName}_mat${i + 1}`,
        ...c
    }));

    // Create materials for Three.js
    const mat1 = new THREE.MeshLambertMaterial({ color: new THREE.Color(colors[0].r, colors[0].g, colors[0].b) });
    mat1.name = materials[0].name;
    
    const mat2 = new THREE.MeshLambertMaterial({ color: new THREE.Color(colors[1].r, colors[1].g, colors[1].b) });
    mat2.name = materials[1].name;
    
    const mat3 = new THREE.MeshLambertMaterial({ color: new THREE.Color(colors[2].r, colors[2].g, colors[2].b) });
    mat3.name = materials[2].name;
    
    const mat4 = new THREE.MeshLambertMaterial({ color: new THREE.Color(colors[3].r, colors[3].g, colors[3].b) });
    mat4.name = materials[3].name;

    const totalHeight = floors * floorHeight;

    // Create groups for each material to keep them separated
    const bodyGroup = new THREE.Group();
    bodyGroup.name = 'Body';
    const windowGroup = new THREE.Group();
    windowGroup.name = 'Windows';
    const accentGroup = new THREE.Group();
    accentGroup.name = 'Accents';
    const baseRoofGroup = new THREE.Group();
    baseRoofGroup.name = 'BaseRoof';

    // Main building body - positioned to sit on ground (y=0)
    const bodyGeometry = new THREE.BoxGeometry(width, totalHeight, depth);
    const bodyMesh = new THREE.Mesh(bodyGeometry, mat1);
    bodyMesh.name = 'MainBody';
    bodyMesh.position.y = totalHeight / 2; // Center at half height so base is at y=0
    bodyGroup.add(bodyMesh);

    // Windows on each floor
    const windowWidth = width / (windowsPerFloorX + 1) * 0.6;
    const windowHeight = floorHeight * 0.5;
    const windowDepth = 0.8; // Make windows more prominent

    for (let floor = 0; floor < floors; floor++) {
        const floorY = (floor + 0.5) * floorHeight;

        // Front face windows (Z+)
        for (let i = 0; i < windowsPerFloorX; i++) {
            const windowX = -width / 2 + (i + 1) * (width / (windowsPerFloorX + 1));
            const windowGeometry = new THREE.BoxGeometry(windowWidth, windowHeight, windowDepth);
            const windowMesh = new THREE.Mesh(windowGeometry, mat2);
            windowMesh.name = `Window_F${floor}_${i}`;
            windowMesh.position.set(windowX, floorY, depth / 2 + windowDepth / 2);
            windowGroup.add(windowMesh);
        }

        // Back face windows (Z-)
        for (let i = 0; i < windowsPerFloorX; i++) {
            const windowX = -width / 2 + (i + 1) * (width / (windowsPerFloorX + 1));
            const windowGeometry = new THREE.BoxGeometry(windowWidth, windowHeight, windowDepth);
            const windowMesh = new THREE.Mesh(windowGeometry, mat2);
            windowMesh.name = `Window_B${floor}_${i}`;
            windowMesh.position.set(windowX, floorY, -depth / 2 - windowDepth / 2);
            windowGroup.add(windowMesh);
        }

        // Left face windows (X-)
        for (let i = 0; i < windowsPerFloorZ; i++) {
            const windowZ = -depth / 2 + (i + 1) * (depth / (windowsPerFloorZ + 1));
            const windowGeometry = new THREE.BoxGeometry(windowDepth, windowHeight, windowWidth);
            const windowMesh = new THREE.Mesh(windowGeometry, mat2);
            windowMesh.name = `Window_L${floor}_${i}`;
            windowMesh.position.set(-width / 2 - windowDepth / 2, floorY, windowZ);
            windowGroup.add(windowMesh);
        }

        // Right face windows (X+)
        for (let i = 0; i < windowsPerFloorZ; i++) {
            const windowZ = -depth / 2 + (i + 1) * (depth / (windowsPerFloorZ + 1));
            const windowGeometry = new THREE.BoxGeometry(windowDepth, windowHeight, windowWidth);
            const windowMesh = new THREE.Mesh(windowGeometry, mat2);
            windowMesh.name = `Window_R${floor}_${i}`;
            windowMesh.position.set(width / 2 + windowDepth / 2, floorY, windowZ);
            windowGroup.add(windowMesh);
        }
    }

    // Accent bands every 3 floors
    for (let floor = 3; floor < floors; floor += 3) {
        const bandY = floor * floorHeight;
        const bandGeometry = new THREE.BoxGeometry(width + 0.6, floorHeight * 0.2, depth + 0.6);
        const bandMesh = new THREE.Mesh(bandGeometry, mat3);
        bandMesh.name = `Band_${floor}`;
        bandMesh.position.y = bandY;
        accentGroup.add(bandMesh);
    }

    // Base
    const baseGeometry = new THREE.BoxGeometry(width + 1, floorHeight * 0.8, depth + 1);
    const baseMesh = new THREE.Mesh(baseGeometry, mat4);
    baseMesh.name = 'Base';
    baseMesh.position.y = floorHeight * 0.4;
    baseRoofGroup.add(baseMesh);

    // Roof
    const roofGeometry = new THREE.BoxGeometry(width + 0.5, floorHeight * 0.3, depth + 0.5);
    const roofMesh = new THREE.Mesh(roofGeometry, mat4);
    roofMesh.name = 'Roof';
    roofMesh.position.y = totalHeight + floorHeight * 0.15;
    baseRoofGroup.add(roofMesh);

    // Add all groups to main group
    group.add(bodyGroup);
    group.add(windowGroup);
    group.add(accentGroup);
    group.add(baseRoofGroup);

    return { group, materials };
}

function generateBuilding(buildingName, params) {
    console.log(`\n🏗️  Generating ${buildingName}...`);
    
    const { group, materials } = createBuilding({ ...params, buildingName });
    
    console.log(`  Width: ${params.width} units`);
    console.log(`  Depth: ${params.depth} units`);
    console.log(`  Floors: ${params.floors}`);
    console.log(`  Total Height: ${params.floors * params.floorHeight} units`);
    console.log(`  Colors: ${materials.length} materials`);
    materials.forEach((mat, i) => {
        const r = Math.round(mat.r * 255);
        const g = Math.round(mat.g * 255);
        const b = Math.round(mat.b * 255);
        console.log(`    ${mat.name}: RGB(${r}, ${g}, ${b})`);
    });

    // Export OBJ - manually combine to preserve material assignments
    const exporter = new OBJExporter();
    let finalObjContent = `# AI Generated Building\n`;
    finalObjContent += `# ${new Date().toISOString()}\n`;
    finalObjContent += `mtllib ${buildingName}.mtl\n`;
    finalObjContent += `o ${buildingName}\n\n`;

    let vertexOffset = 0;
    let normalOffset = 0;
    let uvOffset = 0;

    // Export each child group separately to maintain material assignments
    group.children.forEach((childGroup, groupIdx) => {
        childGroup.children.forEach((mesh, meshIdx) => {
            if (!mesh.isMesh) return;

            const material = mesh.material;
            const geometry = mesh.geometry.clone();
            
            // Apply mesh position to geometry
            geometry.translate(mesh.position.x, mesh.position.y, mesh.position.z);

            finalObjContent += `\n# ${mesh.name || `Mesh_${groupIdx}_${meshIdx}`}\n`;
            finalObjContent += `usemtl ${material.name}\n`;

            const pos = geometry.attributes.position;
            const normal = geometry.attributes.normal;
            const uv = geometry.attributes.uv;
            const index = geometry.index;

            // Write vertices
            for (let i = 0; i < pos.count; i++) {
                finalObjContent += `v ${pos.getX(i).toFixed(6)} ${pos.getY(i).toFixed(6)} ${pos.getZ(i).toFixed(6)}\n`;
            }

            // Write normals
            if (normal) {
                for (let i = 0; i < normal.count; i++) {
                    finalObjContent += `vn ${normal.getX(i).toFixed(6)} ${normal.getY(i).toFixed(6)} ${normal.getZ(i).toFixed(6)}\n`;
                }
            }

            // Write UVs
            if (uv) {
                for (let i = 0; i < uv.count; i++) {
                    finalObjContent += `vt ${uv.getX(i).toFixed(6)} ${uv.getY(i).toFixed(6)}\n`;
                }
            }

            // Write faces
            if (index) {
                for (let i = 0; i < index.count; i += 3) {
                    const a = index.getX(i) + 1 + vertexOffset;
                    const b = index.getX(i + 1) + 1 + vertexOffset;
                    const c = index.getX(i + 2) + 1 + vertexOffset;
                    
                    if (normal && uv) {
                        finalObjContent += `f ${a}/${a}/${a} ${b}/${b}/${b} ${c}/${c}/${c}\n`;
                    } else if (normal) {
                        finalObjContent += `f ${a}//${a} ${b}//${b} ${c}//${c}\n`;
                    } else {
                        finalObjContent += `f ${a} ${b} ${c}\n`;
                    }
                }
            }

            vertexOffset += pos.count;
            if (normal) normalOffset += normal.count;
            if (uv) uvOffset += uv.count;
        });
    });

    const objPath = path.join(assetsDir, `${buildingName}.obj`);
    fs.writeFileSync(objPath, finalObjContent);
    console.log(`  ✓ Saved: ${buildingName}.obj (${group.children.reduce((sum, g) => sum + g.children.length, 0)} meshes)`);

    // Export MTL
    const mtlContent = createMTL(materials);
    const mtlPath = path.join(assetsDir, `${buildingName}.mtl`);
    fs.writeFileSync(mtlPath, mtlContent);
    console.log(`  ✓ Saved: ${buildingName}.mtl`);
}

// Generate AI-building-002 through AI-building-010
console.log('\n🏗️  Starting bulk building generation...\n');
console.log('=' .repeat(60));

for (let i = 2; i <= 10; i++) {
    const buildingName = `AI-building-${String(i).padStart(3, '0')}`;
    
    const params = {
        width: 10 + Math.random() * 8,      // 10-18 units
        depth: 14 + Math.random() * 10,     // 14-24 units
        floors: 8 + Math.floor(Math.random() * 7),  // 8-14 floors
        floorHeight: 3.2 + Math.random() * 1,       // 3.2-4.2 units per floor
        windowsPerFloorX: 3 + Math.floor(Math.random() * 3), // 3-5 windows
        windowsPerFloorZ: 4 + Math.floor(Math.random() * 4)  // 4-7 windows
    };
    
    generateBuilding(buildingName, params);
    console.log('=' .repeat(60));
}

console.log('\n✅ All buildings generated successfully!');
console.log(`   Created: AI-building-002 through AI-building-010 (9 buildings)`);
console.log('   Refresh asset viewer to see them all!');

