import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const assetsDir = path.resolve(__dirname, '../assets');
const inputFileName = 'NewBuilding.obj';
const inputFilePath = path.join(assetsDir, inputFileName);
const backupFilePath = path.join(assetsDir, inputFileName.replace('.obj', '_BEFORE_ZFIX.obj'));

function fixZFighting() {
    console.log(`Loading ${inputFileName}...`);
    
    // Create backup
    const originalContent = fs.readFileSync(inputFilePath, 'utf8');
    if (!fs.existsSync(backupFilePath)) {
        fs.writeFileSync(backupFilePath, originalContent);
        console.log(`✓ Created backup: ${path.basename(backupFilePath)}`);
    }
    
    const lines = originalContent.split('\n');
    const vertices = []; // Store all vertices: { x, y, z, line }
    const normals = [];  // Store all normals: { x, y, z }
    const newLines = [];
    
    let currentMaterial = null;
    const offsetDistance = 0.3; // Offset by 0.3 units
    const materialsToOffset = ['Doors', 'png_window_4_by_paradise234_d5i7f6m'];
    
    // First pass: collect all vertices and normals
    for (const line of lines) {
        if (line.startsWith('v ')) {
            const parts = line.split(/\s+/);
            vertices.push({
                x: parseFloat(parts[1]),
                y: parseFloat(parts[2]),
                z: parseFloat(parts[3]),
                originalLine: line
            });
        } else if (line.startsWith('vn ')) {
            const parts = line.split(/\s+/);
            normals.push({
                x: parseFloat(parts[1]),
                y: parseFloat(parts[2]),
                z: parseFloat(parts[3])
            });
        }
    }
    
    console.log(`Found ${vertices.length} vertices and ${normals.length} normals`);
    
    // Second pass: process faces and offset vertices for specific materials
    const facesToOffset = [];
    let vertexIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.startsWith('usemtl ')) {
            currentMaterial = line.substring(7).trim();
        } else if (line.startsWith('f ') && currentMaterial && materialsToOffset.includes(currentMaterial)) {
            // Parse face: f v1/vt1/vn1 v2/vt2/vn2 v3/vt3/vn3 ...
            const parts = line.substring(2).trim().split(/\s+/);
            const faceData = parts.map(p => {
                const indices = p.split('/');
                return {
                    v: parseInt(indices[0]) - 1,  // vertex index (0-based)
                    vn: indices[2] ? parseInt(indices[2]) - 1 : null  // normal index (0-based)
                };
            });
            
            // Get the face normal (use the first vertex's normal)
            const normalIdx = faceData[0].vn;
            if (normalIdx !== null && normalIdx < normals.length) {
                facesToOffset.push({
                    lineIndex: i,
                    faceData: faceData,
                    normal: normals[normalIdx],
                    material: currentMaterial
                });
            }
        }
    }
    
    console.log(`Found ${facesToOffset.length} faces to offset`);
    
    // Track which vertices have been offset
    const offsetVertices = new Set();
    
    // Offset vertices
    for (const face of facesToOffset) {
        for (const faceVertex of face.faceData) {
            const vIdx = faceVertex.v;
            if (!offsetVertices.has(vIdx)) {
                const v = vertices[vIdx];
                const n = face.normal;
                
                // Offset vertex in normal direction
                v.x += n.x * offsetDistance;
                v.y += n.y * offsetDistance;
                v.z += n.z * offsetDistance;
                
                offsetVertices.add(vIdx);
            }
        }
    }
    
    console.log(`Offset ${offsetVertices.size} vertices`);
    
    // Third pass: write output with modified vertices
    let vIdx = 0;
    for (const line of lines) {
        if (line.startsWith('v ') && !line.startsWith('vn') && !line.startsWith('vt')) {
            const v = vertices[vIdx];
            newLines.push(`v ${v.x} ${v.y} ${v.z}`);
            vIdx++;
        } else {
            newLines.push(line);
        }
    }
    
    fs.writeFileSync(inputFilePath, newLines.join('\n'));
    console.log(`✓ ${inputFileName} updated successfully`);
    console.log(`  Offset distance: ${offsetDistance} units`);
    console.log(`  Materials fixed: ${materialsToOffset.join(', ')}`);
}

fixZFighting();

