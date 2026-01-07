import fs from 'fs';
import readline from 'readline';

async function fix() {
    const inputPath = '/var/www/html/games/v1/assets/a10.obj';
    const outputPath = '/var/www/html/games/v1/assets/a10_engines_full.obj';

    // Pass 1: Read vertices
    const fileStream = fs.createReadStream(inputPath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    const vertices = [null];
    for await (const line of rl) {
        if (line.startsWith('v ')) {
            const parts = line.trim().split(/\s+/);
            vertices.push({ x: parseFloat(parts[1]), y: parseFloat(parts[2]), z: parseFloat(parts[3]) });
        }
    }

    // Updated bounds based on Y analysis
    // X columns: [0.6, 2.8] and [-2.8, -0.6]
    // Z range: [0.5, 5.5]
    // Y range: [-1.0, 2.2] (extended down from 0.5 to cover -0.8 range)

    const boxes = [
        { minX: -2.8, maxX: -0.6, minY: -1.0, maxY: 2.2, minZ: 0.5, maxZ: 5.5 },
        { minX: 0.6, maxX: 2.8, minY: -1.0, maxY: 2.2, minZ: 0.5, maxZ: 5.5 }
    ];

    console.log("Applying FULL engine fix (top and bottom)...");

    const writeStream = fs.createWriteStream(outputPath);
    const stream2 = fs.createReadStream(inputPath);
    const rl2 = readline.createInterface({ input: stream2, crlfDelay: Infinity });

    let fileMaterial = 'default';
    let activeOutputMaterial = 'default';

    for await (const line of rl2) {
        if (line.startsWith('mtllib')) {
            writeStream.write(line + '\n');
        } else if (line.startsWith('v ') || line.startsWith('vn ') || line.startsWith('vt ') || line.startsWith('o ') || line.startsWith('g ') || line.startsWith('#') || line.trim() === '') {
            writeStream.write(line + '\n');
        } else if (line.startsWith('usemtl ')) {
            fileMaterial = line.trim().split(/\s+/)[1];
            // Don't write immediately, we conditionally override
        } else if (line.startsWith('f ')) {
            const parts = line.trim().split(/\s+/);
            const faceVerts = [];
            for (let i = 1; i < parts.length; i++) {
                const vIndex = parseInt(parts[i].split('/')[0]);
                faceVerts.push(vertices[vIndex]);
            }

            let avgX = 0, avgY = 0, avgZ = 0;
            for (const v of faceVerts) { avgX += v.x; avgY += v.y; avgZ += v.z; }
            avgX /= faceVerts.length;
            avgY /= faceVerts.length;
            avgZ /= faceVerts.length;

            let targetMaterial = fileMaterial;

            for (const box of boxes) {
                if (avgX >= box.minX && avgX <= box.maxX &&
                    avgY >= box.minY && avgY <= box.maxY &&
                    avgZ >= box.minZ && avgZ <= box.maxZ) {
                    targetMaterial = 'A10Engine';
                }
            }

            if (targetMaterial !== activeOutputMaterial) {
                writeStream.write(`usemtl ${targetMaterial}\n`);
                activeOutputMaterial = targetMaterial;
            }
            writeStream.write(line + '\n');
        } else {
            writeStream.write(line + '\n');
        }
    }

    writeStream.end();
    console.log("Done writing to " + outputPath);
}

fix();
