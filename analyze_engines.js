import fs from 'fs';
import readline from 'readline';

async function analyze() {
    const fileStream = fs.createReadStream('/var/www/html/games/v1/assets/a10.obj');
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const vertices = [null];
    const faces = [];

    for await (const line of rl) {
        if (line.startsWith('v ')) {
            const parts = line.trim().split(/\s+/);
            vertices.push({
                x: parseFloat(parts[1]),
                y: parseFloat(parts[2]),
                z: parseFloat(parts[3])
            });
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

    // Focus on Z [1.0 to 5.0] and Y > 0.5
    const candidates = faces.filter(f => f.avgZ >= 1.0 && f.avgZ <= 5.0 && f.avgY > 0.5);

    console.log(`Found ${candidates.length} faces in high-rear zone.`);

    // Histogram X
    const bucketSize = 0.2;
    const histogram = {};
    candidates.forEach(f => {
        const b = Math.floor(f.avgX / bucketSize) * bucketSize;
        const k = b.toFixed(1);
        if (!histogram[k]) histogram[k] = 0;
        histogram[k]++;
    });

    console.log("X-Histogram in candidate zone:");
    Object.keys(histogram).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(k => {
        console.log(`X ${k}: ${histogram[k]}`);
    });
}
analyze();
