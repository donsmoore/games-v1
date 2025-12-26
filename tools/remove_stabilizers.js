import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const assetsDir = path.resolve(__dirname, '../assets');
const inputFileName = 'f16.obj';
const inputFilePath = path.join(assetsDir, inputFileName);
const backupFilePath = path.join(assetsDir, inputFileName.replace('.obj', '_WITH_STABILIZERS.obj'));

function removeStabilizers() {
    console.log(`Loading ${inputFileName}...`);

    // Read the original file content
    const originalContent = fs.readFileSync(inputFilePath, 'utf8');
    const lines = originalContent.split('\n');

    // Create a backup if it doesn't exist
    if (!fs.existsSync(backupFilePath)) {
        fs.writeFileSync(backupFilePath, originalContent);
        console.log(`✓ Created backup: ${path.basename(backupFilePath)}`);
    }

    // Find the Stabilizers object and remove it
    let inStabilizers = false;
    let removedLines = 0;
    const newLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Check if we're entering the Stabilizers object
        if (line.trim() === 'o Stabilizers') {
            inStabilizers = true;
            console.log(`Found Stabilizers at line ${i + 1}`);
            removedLines++;
            continue;
        }
        
        // Check if we're leaving the Stabilizers object (next object definition)
        if (inStabilizers && line.startsWith('o ') && line.trim() !== 'o Stabilizers') {
            inStabilizers = false;
            console.log(`End of Stabilizers at line ${i + 1}, removed ${removedLines} lines`);
            newLines.push(line);
            continue;
        }
        
        // Skip lines that are part of Stabilizers
        if (inStabilizers) {
            removedLines++;
            continue;
        }
        
        // Keep all other lines
        newLines.push(line);
    }

    // Write the modified content
    const finalContent = newLines.join('\n');
    fs.writeFileSync(inputFilePath, finalContent);
    
    console.log(`✓ ${inputFileName} updated successfully`);
    console.log(`  Removed ${removedLines} lines (Stabilizers object)`);
    console.log(`  Backup saved as: ${path.basename(backupFilePath)}`);
}

removeStabilizers();
