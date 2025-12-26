import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const assetsDir = path.resolve(__dirname, '../assets');

function fixMTLPaths() {
    console.log('Fixing MTL texture paths for Residential Buildings...\n');
    
    // Find all Residential Buildings MTL files
    const files = fs.readdirSync(assetsDir);
    const mtlFiles = files.filter(f => f.startsWith('Residential Buildings') && f.endsWith('.mtl'));
    
    console.log(`Found ${mtlFiles.length} MTL files to fix\n`);
    
    let totalFixed = 0;
    
    mtlFiles.forEach(mtlFile => {
        const mtlPath = path.join(assetsDir, mtlFile);
        let content = fs.readFileSync(mtlPath, 'utf8');
        
        console.log(`Processing: ${mtlFile}`);
        let fileFixed = 0;
        
        // Replace ALL absolute paths (both single and double backslash) with relative paths
        // This regex finds any C:\ or similar drive letter path
        content = content.replace(
            /([A-Z]):\\(?:\\)?(?:Users\\(?:\\)?)?[^\\]+(?:\\(?:\\)?[^\\]+)*(?:\\(?:\\)?textures(?:\\(?:\\)?|\/))([^\s\\]+\.(png|jpg|jpeg|PNG|JPG|JPEG))/gi,
            (match, drive, filename, ext) => {
                console.log(`  Fixed: ${filename}`);
                fileFixed++;
                totalFixed++;
                return `textures/${filename}`;
            }
        );
        
        // Write the fixed content back
        fs.writeFileSync(mtlPath, content);
        console.log(`  ✓ Saved ${mtlFile} (${fileFixed} paths fixed)\n`);
    });
    
    console.log(`✓ Complete! Fixed ${totalFixed} texture paths across ${mtlFiles.length} MTL files`);
    console.log('All texture paths now point to: textures/filename.ext');
}

fixMTLPaths();
