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

    // Sort all faces by Y ascending
    faces.sort((a, b) => a.avgY - b.avgY);

    // Look at bottom 500 faces
    const bottomFaces = faces.slice(0, 500);
    const minY = bottomFaces[0].avgY;
    const maxY = bottomFaces[bottomFaces.length - 1].avgY;

    console.log(`Lowest Y: ${minY.toFixed(3)}, 500th Lowest Y: ${maxY.toFixed(3)}`);

    // Cluster them by X/Z to find the "3 wheels"
    // We expect 1 Nose wheel (Center X~0) and 2 Main wheels (Left/Right X offset)

    // Filter for Y < minY + 0.5 (arbitrary threshold for "wheel height")
    const wheelCandidates = faces.filter(f => f.avgY < minY + 0.5);

    console.log(`Faces in lowest 0.5 units: ${wheelCandidates.length}`);

    // Simple clustering
    // Nose: X near 0
    // Left: X < -1
    // Right: X > 1

    const nose = wheelCandidates.filter(f => Math.abs(f.avgX) < 0.5);
    const left = wheelCandidates.filter(f => f.avgX < -1.0);
    const right = wheelCandidates.filter(f => f.avgX > 1.0);

    console.log(`Nose Candidates: ${nose.length}`);
    if (nose.length > 0) {
        const z = nose.map(f => f.avgZ);
        console.log(`  Z-range: ${Math.min(...z).toFixed(2)} to ${Math.max(...z).toFixed(2)}`);
        const y = nose.map(f => f.avgY);
        console.log(`  Y-range: ${Math.min(...y).toFixed(2)} to ${Math.max(...y).toFixed(2)}`);
    }

    console.log(`Left Candidates: ${left.length}`);
    if (left.length > 0) {
        const z = left.map(f => f.avgZ);
        console.log(`  Z-range: ${Math.min(...z).toFixed(2)} to ${Math.max(...z).toFixed(2)}`);
        const x = left.map(f => f.avgX);
        console.log(`  X-range: ${Math.min(...x).toFixed(2)} to ${Math.max(...x).toFixed(2)}`);
        const y = left.map(f => f.avgY);
        console.log(`  Y-range: ${Math.min(...y).toFixed(2)} to ${Math.max(...y).toFixed(2)}`);
    }

    console.log(`Right Candidates: ${right.length}`);
    if (right.length > 0) {
        const z = right.map(f => f.avgZ);
        console.log(`  Z-range: ${Math.min(...z).toFixed(2)} to ${Math.max(...z).toFixed(2)}`);
        const x = right.map(f => f.avgX);
        console.log(`  X-range: ${Math.min(...x).toFixed(2)} to ${Math.max(...x).toFixed(2)}`);
        const y = right.map(f => f.avgY);
        console.log(`  Y-range: ${Math.min(...y).toFixed(2)} to ${Math.max(...y).toFixed(2)}`);
    }
}
analyze();
