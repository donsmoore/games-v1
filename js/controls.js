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


export function updateControls(plane, delta, minAlt = -Infinity, laserEnergy = 100) {
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
        // Only allow pitch down if we are safely above the ground (5m buffer)
        if (plane.position.y > minAlt + 5.0) {
            plane.rotateX(-delta * pitchSpeed);
        }
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

    // Update UI (Progress Bars)
    const speedPct = Math.min(100, Math.max(0, (planeSpeed / MAX_SPEED) * 100));
    const altVal = Math.max(0, plane.position.y);
    const altPct = Math.min(100, Math.max(0, (altVal / 500) * 100));

    const speedBar = document.getElementById('speed-bar');
    const speedVal = document.getElementById('speed-val');
    if (speedBar) speedBar.style.width = `${speedPct}%`;
    if (speedVal) speedVal.innerText = `${Math.round(planeSpeed * 800)} km/h`;

    const altBar = document.getElementById('alt-bar');
    const altValText = document.getElementById('alt-val');
    if (altBar) altBar.style.width = `${altPct}%`;
    if (altValText) altValText.innerText = `${Math.round(altVal)} m`;

    // Laser
    const laserBar = document.getElementById('laser-bar');
    const laserVal = document.getElementById('laser-val');
    if (laserBar) laserBar.style.width = `${laserEnergy}%`;
    if (laserVal) laserVal.innerText = `${Math.round(laserEnergy)}%`;
}
