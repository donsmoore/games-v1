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

            let totalX = 0, totalY = 0, totalZ = 0;
            for (const v of faceVerts) { totalX += v.x; totalY += v.y; totalZ += v.z; }
            faces.push({
                avgX: totalX / faceVerts.length,
                avgY: totalY / faceVerts.length,
                avgZ: totalZ / faceVerts.length
            });
        }
    }

    // Check the box we used: X [0.6, 2.8] & Left side, Z [0.5, 5.5]
    // We want to see the histogram of Y in this box to find the gap between Wing and Engine.

    const candidates = faces.filter(f =>
        (Math.abs(f.avgX) >= 0.6 && Math.abs(f.avgX) <= 2.8) &&
        (f.avgZ >= 0.5 && f.avgZ <= 5.5)
    );

    // Sort by Y to find gaps
    const ys = candidates.map(c => c.avgY).sort((a, b) => a - b);

    console.log(`Total faces in target column: ${candidates.length}`);
    console.log("Y-Histogram (0.1 buckets):");

    const histogram = {};
    candidates.forEach(f => {
        const b = Math.floor(f.avgY * 10) / 10;
        const k = b.toFixed(1);
        if (!histogram[k]) histogram[k] = 0;
        histogram[k]++;
    });

    Object.keys(histogram).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(k => {
        const count = histogram[k];
        const bar = '#'.repeat(Math.ceil(count / 5));
        console.log(`${k}: ${count} ${bar}`);
    });

}
analyze();
