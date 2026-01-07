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

    // Previous box: X [0.6, 2.8], Z [0.5, 5.5]. Let's check Y range in this column.
    // Also check Left side.
    const engineX = [0.6, 2.8];
    const engineZ = [0.5, 5.5];

    const candidates = faces.filter(f =>
        Math.abs(f.avgX) >= engineX[0] && Math.abs(f.avgX) <= engineX[1] &&
        f.avgZ >= engineZ[0] && f.avgZ <= engineZ[1]
    );

    console.log(`Faces in engine columns: ${candidates.length}`);

    // Histogram Y
    const bucketSize = 0.2;
    const histogram = {};
    candidates.forEach(f => {
        const b = Math.floor(f.avgY / bucketSize) * bucketSize;
        const k = b.toFixed(1);
        if (!histogram[k]) histogram[k] = 0;
        histogram[k]++;
    });

    console.log("Y-Histogram in engine columns:");
    Object.keys(histogram).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(k => {
        console.log(`Y ${k}: ${histogram[k]}`);
    });
}
analyze();
