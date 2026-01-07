import fs from 'fs';
import readline from 'readline';

async function fix() {
    const inputPath = '/var/www/html/games/v1/assets/a10.obj';
    const outputPath = '/var/www/html/games/v1/assets/a10_tanks.obj';

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

    // Tank Boxes (Inner wing stations)
    // Left: X[-3.5, -1.5]
    // Right: X[1.5, 3.5]
    // Y: [-1.5, -0.1]
    // Z: [-3.0, 1.0]

    const boxes = [
        { minX: -3.5, maxX: -1.5, minY: -1.5, maxY: -0.1, minZ: -3.0, maxZ: 1.0 },
        { minX: 1.5, maxX: 3.5, minY: -1.5, maxY: -0.1, minZ: -3.0, maxZ: 1.0 }
    ];

    console.log("Applying TANK fix...");

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
                    targetMaterial = 'A10Tank';
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
