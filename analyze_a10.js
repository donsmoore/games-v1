import fs from 'fs';
import readline from 'readline';

async function analyze() {
    // Check if file exists first
    if (!fs.existsSync('/var/www/html/games/v1/assets/a10.obj')) {
        console.error("File not found!");
        return;
    }

    const fileStream = fs.createReadStream('/var/www/html/games/v1/assets/a10.obj');
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const vertices = [null]; // 1-based indexing for OBJ
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

            // Compute centroid Z
            let totalZ = 0;
            let totalY = 0;
            for (const v of faceVerts) totalZ += v.z;
            for (const v of faceVerts) totalY += v.y;
            const avgZ = totalZ / faceVerts.length;
            const avgY = totalY / faceVerts.length;

            faces.push({
                material: currentMaterial,
                avgZ: avgZ,
                avgY: avgY,
                line: line // store for debugging if needed, but risky for memory? No, safe enough.
            });
        }
    }

    // specific stats for A10Cockpit
    const cockpitFaces = faces.filter(f => f.material === 'A10Cockpit');
    const bodyFaces = faces.filter(f => f.material === 'A10Body');

    if (cockpitFaces.length === 0) {
        console.log("No A10Cockpit faces found!");
        return;
    }

    // Stats
    const minZ = Math.min(...cockpitFaces.map(f => f.avgZ));
    const maxZ = Math.max(...cockpitFaces.map(f => f.avgZ));
    const minY = Math.min(...cockpitFaces.map(f => f.avgY));
    const maxY = Math.max(...cockpitFaces.map(f => f.avgY));

    console.log(`A10Cockpit Faces: ${cockpitFaces.length}`);
    console.log(`Z-range: ${minZ.toFixed(2)} to ${maxZ.toFixed(2)}`);
    console.log(`Y-range: ${minY.toFixed(2)} to ${maxY.toFixed(2)}`);

    console.log("\nPotential segments to change:");

    // Check faces with similar Y (height) as cockpit
    const candidates = bodyFaces.filter(f =>
        f.avgY >= minY - 0.2 && f.avgY <= maxY + 0.2
    );

    // Histogram of Z for candidates
    const bucketSize = 0.5;
    const histogram = {};

    candidates.forEach(f => {
        const bucket = Math.floor(f.avgZ / bucketSize) * bucketSize;
        const key = bucket.toFixed(1);
        if (!histogram[key]) histogram[key] = 0;
        histogram[key]++;
    });

    console.log("Z-Histogram of nearby A10Body faces (same Y-height):");
    Object.keys(histogram).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(k => {
        console.log(`Z ${k}: ${histogram[k]} faces`);
    });

}

analyze();
