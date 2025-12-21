# Asset System Guide

## Overview

Your game now supports **three methods** for defining how 3D models look:

1. **MTL Files** (Material Libraries) - Highest priority
2. **Vertex Colors** - Medium priority  
3. **Fallback Materials** - Lowest priority (coded in JavaScript)

The loader automatically uses the best available option.

---

## 1. MTL Files (Material Libraries)

### What are MTL files?

MTL files define materials (colors, textures, shininess) that OBJ files reference. They're plain text files that sit alongside your .obj files.

### Current MTL Files:

- `f16.mtl` - F-16 fighter jet materials
- `pine_tree.mtl` - Pine tree materials  
- `round_tree.mtl` - Round tree materials
- `building_2.mtl`, `building_3.mtl`, `building_5.mtl` - Building materials

### MTL File Format Example:

```mtl
# Material Library
newmtl Trunk
Kd 0.545 0.270 0.074    # Diffuse color (RGB 0-1)
Ka 0.163 0.081 0.022    # Ambient color
Ks 0.5 0.5 0.5          # Specular color (shininess)
Ns 10                    # Specular exponent (0-1000)
d 1.0                    # Transparency (0=transparent, 1=opaque)
illum 2                  # Illumination model (1=no spec, 2=spec)
map_Kd texture.png       # Optional texture map
```

### How to Edit MTL Files:

**Option 1: Text Editor** (Simple)
```bash
nano assets/pine_tree.mtl
```

Change RGB values:
- `Kd 1.0 0.0 0.0` = Red
- `Kd 0.0 1.0 0.0` = Green  
- `Kd 0.0 0.0 1.0` = Blue
- `Kd 1.0 1.0 0.0` = Yellow

**Option 2: Blender** (Advanced)
1. Import OBJ: `File → Import → Wavefront (.obj)`
2. Edit materials in Shading workspace
3. Export OBJ: `File → Export → Wavefront (.obj)`
   - ✅ Check "Write Materials"
   - ✅ Check "Objects as OBJ Objects"

### Adding Textures via MTL:

1. Place texture image in `/assets/` (e.g., `cockpit_glass.png`)
2. Edit MTL file:
   ```mtl
   newmtl Cockpit
   Kd 1.0 1.0 1.0
   map_Kd cockpit_glass.png
   ```
3. The texture will be automatically loaded!

**Supported texture formats:** PNG, JPG, JPEG, GIF

---

## 2. Vertex Colors

### What are vertex colors?

Colors baked directly into the 3D model geometry. Each vertex (point) can have its own color.

### How to Add Vertex Colors:

#### **In Blender:**

1. **Import your model**
   ```
   File → Import → Wavefront (.obj)
   ```

2. **Enter Vertex Paint mode**
   - Select object
   - Switch to "Vertex Paint" mode (top left dropdown)

3. **Paint colors**
   - Use brush to paint directly on model
   - Colors are stored per-vertex
   - Great for organic/hand-painted looks

4. **Export with vertex colors**
   ```
   File → Export → Wavefront (.obj)
   ✅ Check "Write Colors" (if available)
   ```

### Advantages:
- ✅ No texture files needed
- ✅ Smooth color gradients
- ✅ Great for stylized/low-poly art
- ✅ Small file sizes

### Limitations:
- ❌ Limited detail (depends on vertex count)
- ❌ Not all OBJ exporters support vertex colors

---

## 3. Fallback Materials (Coded)

If no MTL file or vertex colors are found, the game uses hardcoded materials defined in `js/assets.js`.

### How Materials are Assigned:

Materials are based on **part names** in the 3D model:

#### **F-16:**
- Parts named "Cockpit" → Light blue, transparent
- Parts named "Gear", "Cannon" → Dark grey
- Parts named "Wings", "Tail", "Stabilizers" → Grey
- Everything else → Grey

#### **Trees:**
- Parts named "Trunk" → Brown
- Everything else → Green

#### **Buildings:**
- Parts named "BuildingBody" → White
- Parts named "Window" → Black

### Naming Convention:

Part names are **case-sensitive** and use `includes()` matching:
- ✅ "Trunk" → Matches
- ✅ "TrunkBig" → Matches  
- ✅ "MainTrunk" → Matches
- ❌ "trunk" → Doesn't match (lowercase)

**How to name parts in Blender:**
1. Select object in Outliner
2. Double-click name to rename
3. Use descriptive names: "Cockpit", "LeftWing", "FrontWindow"

---

## Loading Priority (How the Game Decides)

```
┌─────────────────────────────────┐
│   1. Check for .mtl file        │
│   (f16.mtl, pine_tree.mtl, etc) │
└────────────┬────────────────────┘
             │
             ├─ Found? → Use MTL materials + textures
             │
             └─ Not found ↓
┌─────────────────────────────────┐
│   2. Check for vertex colors    │
│   (colors baked in OBJ)         │
└────────────┬────────────────────┘
             │
             ├─ Found? → Use vertex colors
             │
             └─ Not found ↓
┌─────────────────────────────────┐
│   3. Use fallback materials     │
│   (hardcoded by part name)      │
└─────────────────────────────────┘
```

**Console Output:**
```javascript
✓ MTL loaded: assets/f16.mtl
✓ Using MTL material for Fuselage: Fuselage
  ✓ Texture map found: assets/metal_texture.png
ℹ No MTL file found for assets/pine_tree.obj, checking vertex colors...
✓ Using vertex colors for Trunk
ℹ Using fallback material for Leaves
```

---

## Practical Examples

### Example 1: Change F-16 Color (Simple)

**Edit `assets/f16.mtl`:**
```mtl
newmtl Fuselage
Kd 0.8 0.0 0.0    # Change to red (was grey)
Ka 0.2 0.0 0.0
Ks 0.5 0.5 0.5
Ns 30
d 1.0
illum 2
```

Reload game → F-16 body is now red!

### Example 2: Add Camo Texture to F-16

1. Place `camo.png` in `/var/www/html/games/v1/assets/`

2. Edit `assets/f16.mtl`:
   ```mtl
   newmtl Fuselage
   Kd 1.0 1.0 1.0
   Ka 0.3 0.3 0.3
   Ks 0.5 0.5 0.5
   Ns 30
   d 1.0
   illum 2
   map_Kd camo.png    # Add this line!
   ```

3. Reload game → F-16 has camo texture!

### Example 3: Vertex Paint a Custom Tree

1. **In Blender:**
   - Import `pine_tree.obj`
   - Enter Vertex Paint mode
   - Paint brown trunk, green leaves, add color variations
   - Export OBJ (with vertex colors if possible)

2. **Replace file:**
   ```bash
   cp ~/my_painted_tree.obj /var/www/html/games/v1/assets/pine_tree.obj
   ```

3. Reload game → Hand-painted tree appears!

### Example 4: Create New Asset with Materials

1. **Model in Blender**
2. **Name parts** (e.g., "Body", "Wheels", "Windows")
3. **Assign materials** in Blender's Shading workspace
4. **Export:**
   ```
   File → Export → Wavefront (.obj)
   ✅ Write Materials
   ✅ Objects as OBJ Objects  
   ✅ Path Mode: Strip Path
   ```
5. **Copy files:**
   ```bash
   cp my_car.obj /var/www/html/games/v1/assets/
   cp my_car.mtl /var/www/html/games/v1/assets/
   ```
6. **Load in game:**
   ```javascript
   import { loadOBJWithMaterials } from './assets.js';
   const car = await loadOBJWithMaterials('assets/my_car.obj', ...);
   ```

---

## Tips & Best Practices

### Performance:
- **Textures:** Use power-of-2 sizes (256x256, 512x512, 1024x1024)
- **Vertex Colors:** Increase poly count for smoother gradients
- **MTL Files:** Faster than vertex colors, cleaner than fallback

### Workflow:
1. **Start with MTL files** - easiest to edit
2. **Add textures** for detail
3. **Use vertex colors** for stylized/painted looks
4. **Fallback materials** are last resort

### Blender Tips:
- Use UV mapping for textures (`U → Unwrap`)
- Export with "Selection Only" to export individual objects
- Test exports by re-importing before using in game

### Debugging:
- Open browser console (F12) to see loading messages
- Check for texture path errors
- Verify MTL filename matches OBJ reference

---

## File Locations

```
/var/www/html/games/v1/
├── assets/
│   ├── f16.obj + f16.mtl
│   ├── pine_tree.obj + pine_tree.mtl
│   ├── round_tree.obj + round_tree.mtl
│   ├── building_2.obj + building_2.mtl
│   ├── building_3.obj + building_3.mtl
│   ├── building_5.obj + building_5.mtl
│   ├── runway.png
│   ├── favicon.png
│   └── [your texture files here]
├── js/
│   └── assets.js          # Loader logic
└── tools/
    └── export_assets.js   # Asset generation script
```

---

## Regenerating Assets

If you modify the generator functions in `tools/export_assets.js`:

```bash
cd /var/www/html/games/v1
node tools/export_assets.js
```

This regenerates all OBJ and MTL files.

---

## Common Issues

### "No MTL file found"
- Check filename matches: `f16.obj` needs `f16.mtl`
- Check first line of OBJ: `mtllib f16.mtl`

### "Texture not loading"
- Verify texture file exists in `/assets/`
- Check MTL file path: `map_Kd texture.png` (no path prefix)
- Check browser console for 404 errors

### "Colors look wrong"
- MTL uses RGB 0-1 range (not 0-255)
- Convert: RGB(139,69,19) → Kd 0.545 0.270 0.074
- Formula: value / 255

### "Vertex colors not showing"
- Verify OBJ exporter supports vertex colors
- Try manually adding `v r g b` after vertex positions in OBJ
- Fallback to MTL if needed

---

## Resources

- **Blender:** https://www.blender.org/
- **OBJ Format Spec:** http://paulbourke.net/dataformats/obj/
- **MTL Format Spec:** http://paulbourke.net/dataformats/mtl/
- **Three.js Docs:** https://threejs.org/docs/

---

**Questions?** Check browser console (F12) for detailed loading messages!

