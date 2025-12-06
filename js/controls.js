export let planeSpeed = 0;
export function resetSpeed() { planeSpeed = 0; }
const MAX_SPEED = 2.0;

let keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    w: false,
    s: false,
    a: false,
    d: false,
    Shift: false,
    Control: false
};

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key) || e.key === "Shift" || e.key === "Control") keys[e.key] = true;
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key) || e.key === "Shift" || e.key === "Control") keys[e.key] = false;
});

export function getPlaneObject() {
    // Just a helper if needed
}


export function updateControls(plane, delta) {
    if (!plane) return;

    // Throttle
    // Arrow Up = Speed Up
    // Arrow Down = Slow Down
    if (keys.Shift || keys.ArrowUp) {
        planeSpeed += delta * 1.0;
    } else if (keys.Control || keys.ArrowDown) {
        planeSpeed -= delta * 1.0;
    }

    // Clamp speed
    if (planeSpeed < 0.0) planeSpeed = 0.0;
    if (planeSpeed > MAX_SPEED) planeSpeed = MAX_SPEED;

    // Control Inputs
    const pitchSpeed = 1.0;
    const rollSpeed = 2.0;
    const yawSpeed = 0.5;

    // Pitch (Elevator) - W/S Only
    // S -> Up (Pull back)
    // W -> Down (Push forward)
    if (keys.s) {
        plane.rotateX(delta * pitchSpeed);
    }
    if (keys.w) {
        plane.rotateX(-delta * pitchSpeed);
    }

    // Roll (Ailerons) - A/D Only
    if (keys.a) {
        plane.rotateZ(delta * rollSpeed); // Bank Left
    }
    if (keys.d) {
        plane.rotateZ(-delta * rollSpeed); // Bank Right
    }

    // Yaw (Rudder) - Left/Right Arrows Only
    if (keys.ArrowLeft) {
        plane.rotateY(delta * yawSpeed); // Yaw Left
    }
    if (keys.ArrowRight) {
        plane.rotateY(-delta * yawSpeed); // Yaw Right
    }

    // Move Forward (along local -Z)
    plane.translateZ(-planeSpeed * 40 * delta);

    // Update UI
    const speedometer = document.getElementById('speedometer');
    if (speedometer) speedometer.innerText = `Speed: ${Math.round(planeSpeed * 800)} km/h`;
    const altitudeDiv = document.getElementById('altitude');
    if (altitudeDiv) altitudeDiv.innerText = `Alt: ${Math.round(plane.position.y)} m`;
}
