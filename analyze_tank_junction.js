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
                avgX: faceVerts.reduce((s, v) => s + v.x, 0) / faceVerts.length,
                avgZ: faceVerts.reduce((s, v) => s + v.z, 0) / faceVerts.length
            });
        }
    }

    // Previous Box: X[1.5, 3.5], Y[-1.5, -0.1]
    // Let's look closely at Y in [-0.8, 0.2] to finding the gap/pylon neck.

    // Filter for X in target column and Z in target length
    const candidates = faces.filter(f =>
        (Math.abs(f.avgX) >= 1.5 && Math.abs(f.avgX) <= 3.5) &&
        (f.avgZ >= -3.0 && f.avgZ <= 1.0) &&
        (f.avgY >= -1.0 && f.avgY <= 0.2)
    );

    console.log(`Faces in Tank Top transition zone: ${candidates.length}`);

    const histogramY = {};
    candidates.forEach(f => {
        const b = Math.floor(f.avgY * 20) / 20; // 0.05 buckets
        const k = b.toFixed(2);
        if (!histogramY[k]) histogramY[k] = 0;
        histogramY[k]++;
    });

    console.log("Y-Histogram (0.05 buckets):");
    Object.keys(histogramY).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(k => {
        const count = histogramY[k];
        const bar = '#'.repeat(Math.ceil(count / 2));
        console.log(`${k}: ${count} ${bar}`);
    });
}
analyze();
