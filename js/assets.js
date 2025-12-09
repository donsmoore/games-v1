import * as THREE from 'three';

import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

const loader = new OBJLoader();

export function loadF16() {
    return new Promise((resolve) => {
        loader.load('assets/f16.obj?v=' + Date.now(), (group) => {
            group.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;

                    // Remove horizontal stabilizers (rear elevator)
                    if (child.name === 'Stabilizers') {
                        child.visible = false;
                    }

                    // Apply Materials
                    if (child.name.includes('Cockpit')) {
                        child.material = new THREE.MeshPhongMaterial({
                            color: 0x88CCFF,
                            shininess: 100,
                            transparent: true,
                            opacity: 0.7,
                            side: THREE.DoubleSide
                        });
                    } else if (child.name.includes('Gear') || child.parent.name.includes('Gear') || child.name.includes('Cannon')) {
                        child.material = new THREE.MeshPhongMaterial({
                            color: 0x333333,
                            side: THREE.DoubleSide
                        });
                    } else if (child.name.includes('Wings') || child.name.includes('Tail') || child.name.includes('Stabilizers')) {
                        child.material = new THREE.MeshPhongMaterial({
                            color: 0x444444,
                            side: THREE.DoubleSide
                        });
                    } else {
                        // Fuselage, Nose
                        child.material = new THREE.MeshPhongMaterial({
                            color: 0x555555,
                            side: THREE.DoubleSide
                        });
                    }
                }
            });
            resolve(group);
        });
    });
}

export function loadTree() {
    return new Promise((resolve) => {
        loader.load('assets/tree.obj?v=' + Date.now(), (group) => {
            group.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    if (child.name.includes('Trunk')) {
                        child.material = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
                    } else {
                        // Leaves
                        child.material = new THREE.MeshLambertMaterial({ color: 0x228B22 });
                    }
                }
            });
            resolve(group);
        });
    });
}

// Procedural Round Tree
export function loadRoundTree() {
    return new Promise((resolve) => {
        const group = new THREE.Group();

        // 1. Trunk (Cylinder)
        // Match approximate size of OBJ tree trunk
        const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 3, 8);
        trunkGeo.translate(0, 1.5, 0); // Base at 0
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        trunk.name = 'Trunk';
        group.add(trunk);

        // 2. Leaves (Sphere)
        const leavesGeo = new THREE.SphereGeometry(3.5, 8, 8); // Low poly look
        leavesGeo.translate(0, 5, 0); // On top of trunk
        const leavesMat = new THREE.MeshLambertMaterial({ color: 0x2E8B57 }); // SeaGreen
        const leaves = new THREE.Mesh(leavesGeo, leavesMat);
        leaves.castShadow = true;
        leaves.receiveShadow = true;
        leaves.name = 'Leaves';
        group.add(leaves);

        // Tag for hitbox calculation
        group.userData.treeType = 'round';
        group.userData.baseRadius = 3.5;
        group.userData.baseHeight = 8.5;

        // Scale to match overall tree size logic
        // Making round trees 50% smaller than before (was 10, now 5)
        group.scale.set(5, 5, 5);

        resolve(group);
    });
}

export function loadRunwayTexture() {
    const loader = new THREE.TextureLoader();
    // Placeholder - we will generate this image
    return loader.load('assets/runway.png');
}
