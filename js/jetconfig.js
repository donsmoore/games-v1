/**
 * Jet Configuration System
 * Makes it easy to swap between different aircraft
 */

import * as THREE from 'three';

// ========================================
// JET SELECTION (Change this to swap jets)
// ========================================
export const ACTIVE_JET = 'A10'; // Options: 'F16', 'A10'

// ========================================
// Jet Configurations
// ========================================
export const JET_CONFIGS = {
    F16: {
        name: 'F-16 Fighting Falcon',
        assetLoader: 'loadF16',
        cannonPositions: {
            // F-16 uses named objects in the model
            useNamedObjects: true,
            leftName: 'CannonLeft',
            rightName: 'CannonRight',
            // Fallback positions if named objects not found
            fallbackLeft: { x: -3.5, y: 0, z: 0 },
            fallbackRight: { x: 3.5, y: 0, z: 0 }
        },
        stats: {
            speed: 1.0,
            handling: 1.0
        }
    },
    A10: {
        name: 'A-10 Thunderbolt II (Warthog)',
        assetLoader: 'loadA10',
        cannonPositions: {
            // A-10 fires from outermost underwing pylons
            useNamedObjects: false,
            // Offset from plane center (underwing pylons)
            // X: left/right, Y: up/down, Z: forward/back
            leftOffset: { x: -9.5, y: -2.2, z: 1.0 },  // Left outer pylon: 1.5m further out, 1.7m lower
            rightOffset: { x: 9.5, y: -2.2, z: 1.0 }   // Right outer pylon: 1.5m further out, 1.7m lower
        },
        stats: {
            speed: 0.85,  // Slightly slower than F-16
            handling: 0.9 // Slightly less maneuverable
        }
    }
};

/**
 * Get current active jet configuration
 */
export function getActiveJetConfig() {
    return JET_CONFIGS[ACTIVE_JET];
}

/**
 * Get cannon positions for current jet
 */
export function getCannonPositions(plane) {
    const config = getActiveJetConfig();
    const positions = { left: null, right: null };
    
    if (config.cannonPositions.useNamedObjects) {
        // Try to find named objects
        positions.left = plane.getObjectByName(config.cannonPositions.leftName);
        positions.right = plane.getObjectByName(config.cannonPositions.rightName);
        
        // Use fallback if not found
        if (!positions.left || !positions.right) {
            console.warn(`Named cannons not found for ${config.name}, using fallback positions`);
            return {
                left: null,
                right: null,
                useFallback: true,
                fallbackLeft: new THREE.Vector3(
                    config.cannonPositions.fallbackLeft.x,
                    config.cannonPositions.fallbackLeft.y,
                    config.cannonPositions.fallbackLeft.z
                ),
                fallbackRight: new THREE.Vector3(
                    config.cannonPositions.fallbackRight.x,
                    config.cannonPositions.fallbackRight.y,
                    config.cannonPositions.fallbackRight.z
                )
            };
        }
    } else {
        // Use offset positions
        return {
            left: null,
            right: null,
            useOffsets: true,
            offsetLeft: new THREE.Vector3(
                config.cannonPositions.leftOffset.x,
                config.cannonPositions.leftOffset.y,
                config.cannonPositions.leftOffset.z
            ),
            offsetRight: new THREE.Vector3(
                config.cannonPositions.rightOffset.x,
                config.cannonPositions.rightOffset.y,
                config.cannonPositions.rightOffset.z
            )
        };
    }
    
    return positions;
}

