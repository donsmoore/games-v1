import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadF16, loadBuilding, loadTree, loadRoundTree, loadPalmTree, loadMushroomTree, loadBaobabTree } from './assets.js?v=12';

let renderer, scene, camera, controls;
let currentAsset = null;

const LS_KEY = 'assets-viewer-default';
const assetPicker = document.getElementById('asset-picker');

const loaders = {
    f16: async () => {
        const obj = await loadF16();
        obj.position.set(0, 5, 0);
        return obj;
    },
    pine: async () => {
        const obj = await loadTree();
        obj.position.set(0, 0, 0);
        return obj;
    },
    round: async () => {
        const obj = await loadRoundTree();
        obj.position.set(0, 0, 0);
        return obj;
    },
    palm: async () => {
        const obj = await loadPalmTree();
        obj.position.set(0, 0, 0);
        return obj;
    },
    mushroom: async () => {
        const obj = await loadMushroomTree();
        obj.position.set(0, 0, 0);
        return obj;
    },
    baobab: async () => {
        const obj = await loadBaobabTree();
        obj.position.set(0, 0, 0);
        return obj;
    },
    b2: async () => {
        const obj = await loadBuilding(2);
        obj.position.set(0, 0, 0);
        return obj;
    },
    b3: async () => {
        const obj = await loadBuilding(3);
        obj.position.set(0, 0, 0);
        return obj;
    },
    b5: async () => {
        const obj = await loadBuilding(5);
        obj.position.set(0, 0, 0);
        return obj;
    }
};

init();
animate();

async function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
    camera.position.set(40, 25, 60);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7);
    hemi.position.set(0, 200, 0);
    scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(50, 100, 50);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    scene.add(dir);

    // Ground
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(500, 500),
        new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid helper
    const grid = new THREE.GridHelper(500, 50, 0x555555, 0x333333);
    scene.add(grid);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.ROTATE,
        RIGHT: THREE.MOUSE.PAN
    };

    // Picker
    const saved = localStorage.getItem(LS_KEY) || 'f16';
    if (assetPicker) {
        assetPicker.value = saved;
        assetPicker.addEventListener('change', () => {
            const val = assetPicker.value;
            localStorage.setItem(LS_KEY, val);
            loadAsset(val);
        });
    }

    await loadAsset(saved);

    window.addEventListener('resize', onResize);
}

function fitCameraToObject(object, camera, controls) {
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let distance = maxDim / (2 * Math.tan(fov / 2));
    distance *= 1.6; // padding

    const dir = new THREE.Vector3(1, 0.5, 1).normalize();
    const newPos = center.clone().add(dir.multiplyScalar(distance));
    camera.position.copy(newPos);
    camera.lookAt(center);
    if (controls) {
        controls.target.copy(center);
        controls.update();
    }
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();
    renderer.render(scene, camera);
}

async function loadAsset(key) {
    if (!loaders[key]) return;
    const obj = await loaders[key]();

    if (currentAsset) {
        scene.remove(currentAsset);
    }
    currentAsset = obj;
    scene.add(obj);
    fitCameraToObject(obj, camera, controls);
}

