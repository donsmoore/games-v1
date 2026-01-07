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

    // 1. Analyze Wheels (Nose, Left, Right)
    // Nose X[-0.5, 0.5]
    // Left X[-3.5, -2.0]
    // Right X[2.0, 3.5]
    // Current Box MaxY was -1.5. Struts are likely above this? User says they are black.
    // Wait, the struts might be IN the box I defined [-3.0, -1.5].
    // I need to see if the wheel ends lower than -1.5.

    const analyzeColumn = (name, minX, maxX) => {
        const candidates = faces.filter(f =>
            f.avgX >= minX && f.avgX <= maxX && f.avgY < -1.0
        );
        console.log(`\n${name} Candidates (Y < -1.0): ${candidates.length}`);

        const hist = {};
        candidates.forEach(f => {
            const b = Math.floor(f.avgY * 20) / 20;
            const k = b.toFixed(2);
            if (!hist[k]) hist[k] = 0;
            hist[k]++;
        });

        Object.keys(hist).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(k => {
            console.log(`  Y ${k}: ${hist[k]}`);
        });
    }

    analyzeColumn("Nose Wheel", -0.5, 0.5);
    analyzeColumn("Left Wheel", -3.5, -2.0);

    // 2. Analyze Tanks (Left, Right)
    // Box was X[-3.5, -1.5], Y[-1.5, -0.4].
    // Check X-width at different Y levels to see if we can narrow the box.
    const tankCandidates = faces.filter(f =>
        f.avgX >= -3.5 && f.avgX <= -1.5 && f.avgY >= -1.5 && f.avgY <= 0.0
    );

    console.log(`\nLeft Tank Candidates: ${tankCandidates.length}`);
    // Group by Y band
    const yBands = {};
    tankCandidates.forEach(f => {
        const band = Math.floor(f.avgY * 5) / 5; // 0.2 bands
        if (!yBands[band]) yBands[band] = [];
        yBands[band].push(f);
    });

    Object.keys(yBands).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(band => {
        const dw = yBands[band];
        const xs = dw.map(f => f.avgX);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        console.log(`  Y Band ${band}: ${dw.length} faces. X-Range: ${minX.toFixed(2)} to ${maxX.toFixed(2)}`);
    });

}
analyze();
