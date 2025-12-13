import * as THREE from 'three';

function makeBuilding({ stories, width, depth, floorHeight = 4 }) {
    const height = stories * floorHeight;
    const geo = new THREE.BoxGeometry(width, height, depth);

    // Vertex colors for windows: black window band on every floor
    const colors = [];
    const cWhite = new THREE.Color(0xffffff);
    const cBlack = new THREE.Color(0x000000);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i) + height / 2; // shift to 0..height
        const floorY = y % floorHeight;
        // Window band roughly middle of each floor
        const isWindow = floorY > 1.0 && floorY < 2.6;
        const col = isWindow ? cBlack : cWhite;
        colors.push(col.r, col.g, col.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.85,
        metalness: 0.0
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.baseHalfExtents = { x: width / 2, y: height / 2, z: depth / 2 };
    mesh.userData.height = height;
    mesh.userData.stories = stories;
    return mesh;
}

export const buildingPrefabs = [
    makeBuilding({ stories: 2, width: 12, depth: 10 }),
    makeBuilding({ stories: 4, width: 14, depth: 12 }),
    makeBuilding({ stories: 6, width: 16, depth: 14 })
];

