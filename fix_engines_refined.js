import fs from 'fs';
import readline from 'readline';

async function fix() {
    const inputPath = '/var/www/html/games/v1/assets/a10.obj';
    const outputPath = '/var/www/html/games/v1/assets/a10_engines_refined.obj';

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

    // Refined bounds:
    // Increased minZ from 0.5 to 1.2 to avoid trailing edge of wings (clump at Z=0.5)
    // Increased minY from -1.0 to -0.2 to avoid wing roots/low fuselage
    const boxes = [
        { minX: -2.8, maxX: -0.6, minY: -0.2, maxY: 2.2, minZ: 1.2, maxZ: 5.5 },
        { minX: 0.6, maxX: 2.8, minY: -0.2, maxY: 2.2, minZ: 1.2, maxZ: 5.5 }
    ];

    console.log("Applying REFINED engine fix (avoiding wings)...");

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
            // Don't write immediately
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

            // NOTE: We need to handle the "previous" fixes too?
            // Wait, I am running this on `a10.obj`.
            // `a10.obj` ALREADY has the cockpit fix and the "bad" engine fix.
            // If I run this, I am essentially iterating over the file.
            // Faces that were "A10Engine" (badly applied) will be read in as "A10Engine".
            // I should revert them to Body/Dark/Light/Whatever?
            // "fileMaterial" will capture the CURRENT assignment.

            // Issue: If I only apply "A10Engine" to the NEW box, the faces OUTSIDE the new box (but inside the old box) will REMAIN "A10Engine" because `fileMaterial` will be "A10Engine" for them!

            // To undo the "bad" parts, I need to know what they SHOULD be.
            // But I don't know the original material map easily.
            // Option 1: Re-apply "A10Body" (base grey) to everything first? No, I lose Cockpit.
            // Option 2: Use the BACKUP? There's `a10_BACKUP_FINAL.obj` but I don't know if that has the Cockpit fix.
            // Actually, the cockpit fix touches a different Zone (Z -6.5 to -3.5). My engine zone is Z > 0.

            // So I can assume faces in the "Old Engine Box" (Z 0.5+) should be reverted to A10Body IF they are not in the "New Engine Box".
            // Or I can just force EVERYTHING in a broader "Cleanup Box" to A10Body, and then apply A10Engine to the "New Box".

            // Cleanup Box: X [-3, 3], Y [-2, 3], Z [0.5, 6].
            // If Inside Cleanup Box -> Set to A10Body.
            // Then check New Engine Box -> If Inside -> Set to A10Engine.

            const cleanupBox = { minX: -3.0, maxX: 3.0, minY: -2.0, maxY: 3.0, minZ: 0.0, maxZ: 6.0 };

            if (avgX >= cleanupBox.minX && avgX <= cleanupBox.maxX &&
                avgY >= cleanupBox.minY && avgY <= cleanupBox.maxY &&
                avgZ >= cleanupBox.minZ && avgZ <= cleanupBox.maxZ) {
                targetMaterial = 'A10Body'; // Reset region to grey
            }

            for (const box of boxes) {
                if (avgX >= box.minX && avgX <= box.maxX &&
                    avgY >= box.minY && avgY <= box.maxY &&
                    avgZ >= box.minZ && avgZ <= box.maxZ) {
                    targetMaterial = 'A10Engine'; // Apply refined grey
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
