import fs from 'fs';
import readline from 'readline';

async function analyze() {
    const fileStream = fs.createReadStream('/var/www/html/games/v1/assets/a10.obj');
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    const vertices = [null];
    const faces = [];

    for await (const line of rl) {
        if (line.startsWith('v ')) {
            const parts = line.trim().split(/\s+/);
            vertices.push({ x: parseFloat(parts[1]), y: parseFloat(parts[2]), z: parseFloat(parts[3]) });
        } else if (line.startsWith('f ')) {
            const parts = line.trim().split(/\s+/);
            const faceVerts = [];
            for (let i = 1; i < parts.length; i++) {
                const vIndex = parseInt(parts[i].split('/')[0]);
                faceVerts.push(vertices[vIndex]);
            }
            faces.push({
                avgY: faceVerts.reduce((s, v) => s + v.y, 0) / faceVerts.length,
                avgZ: faceVerts.reduce((s, v) => s + v.z, 0) / faceVerts.length,
                avgX: faceVerts.reduce((s, v) => s + v.x, 0) / faceVerts.length
            });
        }
    }

    // Filter for X columns [0.6, 2.8] and Y < 0.1
    const candidates = faces.filter(f =>
        (Math.abs(f.avgX) >= 0.6 && Math.abs(f.avgX) <= 2.8) &&
        f.avgY < 0.1
    );

    console.log(`Low-Y faces in column: ${candidates.length}`);

    const histogram = {};
    candidates.forEach(f => {
        const b = Math.floor(f.avgZ * 2) / 2; // 0.5 buckets
        const k = b.toFixed(1);
        if (!histogram[k]) histogram[k] = 0;
        histogram[k]++;
    });

    console.log("Z-Histogram of Low-Y faces:");
    Object.keys(histogram).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(k => {
        console.log(`Z ${k}: ${histogram[k]}`);
    });
}
analyze();
