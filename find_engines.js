import fs from 'fs';
import readline from 'readline';

async function analyze() {
    if (!fs.existsSync('/var/www/html/games/v1/assets/a10.obj')) {
        console.error("File not found!");
        return;
    }

    const fileStream = fs.createReadStream('/var/www/html/games/v1/assets/a10.obj');
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const vertices = [null];
    const faces = [];
    let currentMaterial = 'default';

    for await (const line of rl) {
        if (line.startsWith('v ')) {
            const parts = line.trim().split(/\s+/);
            vertices.push({
                x: parseFloat(parts[1]),
                y: parseFloat(parts[2]),
                z: parseFloat(parts[3])
            });
        } else if (line.startsWith('usemtl ')) {
            currentMaterial = line.trim().split(/\s+/)[1];
        } else if (line.startsWith('f ')) {
            const parts = line.trim().split(/\s+/);
            const faceVerts = [];
            for (let i = 1; i < parts.length; i++) {
                const vIndex = parseInt(parts[i].split('/')[0]);
                faceVerts.push(vertices[vIndex]);
            }

            let totalX = 0, totalY = 0, totalZ = 0;
            for (const v of faceVerts) { totalX += v.x; totalY += v.y; totalZ += v.z; }
            faces.push({
                material: currentMaterial,
                avgX: totalX / faceVerts.length,
                avgY: totalY / faceVerts.length,
                avgZ: totalZ / faceVerts.length
            });
        }
    }

    // Determine bounds of the whole model
    const allX = faces.map(f => f.avgX);
    const allY = faces.map(f => f.avgY);
    const allZ = faces.map(f => f.avgZ);

    console.log("Model Bounds:");
    console.log(`X: ${Math.min(...allX).toFixed(2)} to ${Math.max(...allX).toFixed(2)}`);
    console.log(`Y: ${Math.min(...allY).toFixed(2)} to ${Math.max(...allY).toFixed(2)}`);
    console.log(`Z: ${Math.min(...allZ).toFixed(2)} to ${Math.max(...allZ).toFixed(2)}`);

    // Search for engines. 
    // Characteristics:
    // 1. High Y (above the wings/body).
    // 2. Located in the rear? (Check Z relative to cockpit).
    // Cockpit was Z[-6.5 to -3.5]. So rear is likely Z > -3.5? Or if model is reversed?
    // Let's assume engines are "separated" from the body by spacing in X?
    // Or just look for high Y clusters.

    // Look for faces with Y > 1.0 (Cockpit was up to 1.5, likely canopy top).
    // Let's iterate various Z bands and check X-spread.

    const zBuckets = {};
    faces.forEach(f => {
        const b = Math.floor(f.avgZ);
        if (!zBuckets[b]) zBuckets[b] = [];
        zBuckets[b].push(f);
    });

    console.log("\nAnalysis by Z-slice (looking for high Y structures):");
    const sortedKeys = Object.keys(zBuckets).sort((a, b) => a - b);
    for (const key of sortedKeys) {
        const slice = zBuckets[key];
        // Filter for high Y
        const highFaces = slice.filter(f => f.avgY > 0.5); // Body seems to be around 0?
        if (highFaces.length > 5) {
            const ys = highFaces.map(f => f.avgY);
            const xs = highFaces.map(f => f.avgX);
            const minY = Math.min(...ys), maxY = Math.max(...ys);
            const minX = Math.min(...xs), maxX = Math.max(...xs);
            console.log(`Z [${key} to ${parseInt(key) + 1}]: ${highFaces.length} faces > Y 0.5. Y-Range: ${minY.toFixed(1)}-${maxY.toFixed(1)}. X-Range: ${minX.toFixed(1)}-${maxX.toFixed(1)}`);
        }
    }
}

analyze();
