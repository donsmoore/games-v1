import fs from 'fs';
import readline from 'readline';

async function fix() {
    const inputPath = '/var/www/html/games/v1/assets/a10.obj';
    const outputPath = '/var/www/html/games/v1/assets/a10_final.obj';

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

    // 1. Precise Wheel Boxes (Tires Only)
    const wheelBoxes = [
        { minX: -0.5, maxX: 0.5, minY: -3.0, maxY: -1.6, minZ: -4.8, maxZ: -3.8 },
        { minX: -3.5, maxX: -2.0, minY: -3.0, maxY: -1.6, minZ: -1.0, maxZ: 0.5 },
        { minX: 2.0, maxX: 3.5, minY: -3.0, maxY: -1.6, minZ: -1.0, maxZ: 0.5 }
    ];

    // 2. Precise Tank Boxes (Cylinder Body Only)
    const tankBoxes = [
        { minX: -2.9, maxX: -2.4, minY: -1.6, maxY: -0.5, minZ: -3.0, maxZ: 1.0 },
        { minX: 2.4, maxX: 2.9, minY: -1.6, maxY: -0.5, minZ: -3.0, maxZ: 1.0 }
    ];

    // 3. Cleanup Boxes (Revert mistakes to Grey)
    const strutCleanup = [
        { minX: -0.5, maxX: 0.5, minY: -1.6, maxY: -0.5, minZ: -4.8, maxZ: -3.8 },
        { minX: -3.5, maxX: -2.0, minY: -1.6, maxY: -0.5, minZ: -1.0, maxZ: 0.5 },
        { minX: 2.0, maxX: 3.5, minY: -1.6, maxY: -0.5, minZ: -1.0, maxZ: 0.5 }
    ];

    const tankCleanup = [
        { minX: -4.0, maxX: -1.0, minY: -1.5, maxY: 0.1, minZ: -3.0, maxZ: 1.0 },
        { minX: 1.0, maxX: 4.0, minY: -1.5, maxY: 0.1, minZ: -3.0, maxZ: 1.0 }
    ];

    console.log("Applying FINAL PRECISION fix...");

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

            // Check Cleanup
            let inCleanup = false;
            for (const box of strutCleanup) {
                if (avgX >= box.minX && avgX <= box.maxX && avgY >= box.minY && avgY <= box.maxY && avgZ >= box.minZ && avgZ <= box.maxZ) inCleanup = true;
            }
            for (const box of tankCleanup) {
                if (avgX >= box.minX && avgX <= box.maxX && avgY >= box.minY && avgY <= box.maxY && avgZ >= box.minZ && avgZ <= box.maxZ) inCleanup = true;
            }

            if (inCleanup) {
                targetMaterial = 'A10Body';
            }

            // Apply Precise Material
            for (const box of wheelBoxes) {
                if (avgX >= box.minX && avgX <= box.maxX && avgY >= box.minY && avgY <= box.maxY && avgZ >= box.minZ && avgZ <= box.maxZ) {
                    targetMaterial = 'A10Wheel';
                }
            }
            for (const box of tankBoxes) {
                if (avgX >= box.minX && avgX <= box.maxX && avgY >= box.minY && avgY <= box.maxY && avgZ >= box.minZ && avgZ <= box.maxZ) {
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
