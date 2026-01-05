// Add material assignments to A-10 OBJ file
const fs = require('fs');
const path = require('path');

const objPath = path.join(__dirname, '../assets/a10.obj');
const backupPath = path.join(__dirname, '../assets/a10_BACKUP_PREMTL.obj');

console.log('Reading A-10 OBJ file...');
const content = fs.readFileSync(objPath, 'utf8');
const lines = content.split('\n');

console.log('Creating backup...');
fs.copyFileSync(objPath, backupPath);

console.log('Adding material assignments...');
const outputLines = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Add material assignment when we encounter a group
    if (trimmed.startsWith('g ')) {
        outputLines.push(line);
        outputLines.push('usemtl A10Body');
        continue;
    }
    
    outputLines.push(line);
}

console.log('Writing updated OBJ file...');
fs.writeFileSync(objPath, outputLines.join('\n'));

console.log('✓ A-10 materials added successfully!');
console.log('  - Added material assignments to all mesh groups');
console.log('  - Using A10Body material (military grey)');
console.log('  - Backup saved as: a10_BACKUP_PREMTL.obj');

