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

    // Look for things below the wings (Y < 0 maybe?) but not the wheels (we know wheels are lowest, Y < -1.6)
    // So let's look for Y in range [-1.5, 0.0]
    // And X outside fuselage (Fuselage X ~ [-1, 1]?)

    const candidates = faces.filter(f =>
        f.avgY >= -1.5 && f.avgY <= -0.1 &&
        Math.abs(f.avgX) > 1.5
    );

    console.log(`Potential tank faces: ${candidates.length}`);

    const histogramX = {};
    candidates.forEach(f => {
        const b = Math.floor(f.avgX * 2) / 2;
        const k = b.toFixed(1);
        if (!histogramX[k]) histogramX[k] = 0;
        histogramX[k]++;
    });

    console.log("X-Histogram (0.5 buckets):");
    Object.keys(histogramX).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(k => {
        console.log(`X ${k}: ${histogramX[k]}`);
    });

    // Also Z range
    const histogramZ = {};
    candidates.forEach(f => {
        const b = Math.floor(f.avgZ * 2) / 2;
        const k = b.toFixed(1);
        if (!histogramZ[k]) histogramZ[k] = 0;
        histogramZ[k]++;
    });

    console.log("\nZ-Histogram (0.5 buckets):");
    Object.keys(histogramZ).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(k => {
        console.log(`Z ${k}: ${histogramZ[k]}`);
    });

}
analyze();
