import fs from 'fs';
import readline from 'readline';

async function fix() {
    const inputPath = '/var/www/html/games/v1/assets/a10.obj';
    const outputPath = '/var/www/html/games/v1/assets/a10_tanks_refined.obj';

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

    // Lower maxY from -0.1 to -0.4 to avoid wing intersection
    const boxes = [
        { minX: -3.5, maxX: -1.5, minY: -1.5, maxY: -0.4, minZ: -3.0, maxZ: 1.0 },
        { minX: 1.5, maxX: 3.5, minY: -1.5, maxY: -0.4, minZ: -3.0, maxZ: 1.0 }
    ];

    // cleanup box to revert potential damage from previous run
    // Revert everything in the previous "danger zone" to Body material
    // Previous "danger zone" was Y up to -0.1. So revert region Y[-0.4, 0.0]
    const cleanupBox = { minX: -4.0, maxX: 4.0, minY: -0.5, maxY: 0.1, minZ: -4.0, maxZ: 2.0 };

    console.log("Applying REFINED TANK fix...");

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
            // Don't emit immediately
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

            // Cleanup: If in danger zone, revert to A10Body
            if (Math.abs(avgX) >= 1.0 && Math.abs(avgX) <= 4.0 &&
                avgY >= cleanupBox.minY && avgY <= cleanupBox.maxY &&
                avgZ >= cleanupBox.minZ && avgZ <= cleanupBox.maxZ) {
                targetMaterial = 'A10Body';
            }

            // Apply new tank material
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
