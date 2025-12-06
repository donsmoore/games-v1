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

export function loadRunwayTexture() {
    const loader = new THREE.TextureLoader();
    // Placeholder - we will generate this image
    return loader.load('assets/runway.png');
}
