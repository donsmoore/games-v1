import fs from 'fs';
import readline from 'readline';

async function fix() {
    const inputPath = '/var/www/html/games/v1/assets/a10.obj';
    const outputPath = '/var/www/html/games/v1/assets/a10_fixed.obj';

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

    // Define the bounding box for the "Blue Cockpit"
    // Based on previous analysis:
    // Existing Blue: Z[-5.66, -4.55], Y[0.41, 1.16]
    // Nearby Candidates: Z clusters at -6.0, -5.5, -5.0, -4.5, -4.0
    // We will expand the Z range to cover -6.2 to -3.8 (covering the gaps)
    // And expand Y slightly.
    const box = {
        minX: -1.0, maxX: 1.0, // Generous X (fuselage width)
        minY: 0.35, maxY: 1.5, // Slightly expanded Y
        minZ: -6.5, maxZ: -3.5 // Expanded Z to catch back/front halves
    };

    console.log("Applying fix with box:", box);

    // Pass 2: Process and write
    const writeStream = fs.createWriteStream(outputPath);
    const stream2 = fs.createReadStream(inputPath);
    const rl2 = readline.createInterface({ input: stream2, crlfDelay: Infinity });

    let fileMaterial = 'default'; // The material identified in the source file
    let activeOutputMaterial = 'default'; // The material currently active in the output file

    // We need to emit the initial mtllib line
    // And handle material changes.

    for await (const line of rl2) {
        if (line.startsWith('mtllib')) {
            writeStream.write(line + '\n');
        } else if (line.startsWith('v ') || line.startsWith('vn ') || line.startsWith('vt ') || line.startsWith('o ') || line.startsWith('g ') || line.startsWith('#') || line.trim() === '') {
            writeStream.write(line + '\n');
        } else if (line.startsWith('usemtl ')) {
            fileMaterial = line.trim().split(/\s+/)[1];
            // Do not write usemtl immediately! determining face material overrides it.
            // But wait, if there are no faces following (e.g. end of file or group change without faces), we might lose it?
            // Actually, in OBJ, usemtl applies to subsequent 'f'.
            // So we can just update 'fileMaterial'.
            // However, we must ensure that if we have non-face lines (like 'g'), we might want to sync the state?
            // Actually, safest is: just update 'fileMaterial' state.
            // When we encounter a Face, we determine its *desired* material.
            // If *desired* != *activeOutputMaterial*, we write `usemtl desired`.
            // If the line is NOT a face, we don't output `usemtl` directives from the source, 
            // because we are managing `usemtl` output dynamically before faces.
        } else if (line.startsWith('f ')) {
            // Determine coordinate
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

            // Check box
            if (avgX >= box.minX && avgX <= box.maxX &&
                avgY >= box.minY && avgY <= box.maxY &&
                avgZ >= box.minZ && avgZ <= box.maxZ) {
                targetMaterial = 'A10Cockpit';
            }

            // Output state change if needed
            if (targetMaterial !== activeOutputMaterial) {
                writeStream.write(`usemtl ${targetMaterial}\n`);
                activeOutputMaterial = targetMaterial;
            }
            writeStream.write(line + '\n');
        } else {
            // Catch-all for other lines (s, etc)
            writeStream.write(line + '\n');
        }
    }

    writeStream.end();
    console.log("Done writing to " + outputPath);
}

fix();
