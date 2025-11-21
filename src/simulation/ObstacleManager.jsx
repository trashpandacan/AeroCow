import React, { useMemo, useRef } from 'react'
import { useFrame, useThree, createPortal } from '@react-three/fiber'
import * as THREE from 'three'

export function ObstacleManager({ children, targetFBO }) {
    const { gl } = useThree()

    const scene = useMemo(() => {
        const s = new THREE.Scene()
        s.background = new THREE.Color(0x000000) // Black background = no obstacle
        return s
    }, [])

    const camera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10), [])
    camera.position.z = 1

    // We need to sync the children to this scene
    // But R3F renders children to the default scene.
    // We can use createPortal to render children into our obstacle scene.

    useFrame(() => {
        if (targetFBO) {
            gl.setRenderTarget(targetFBO)
            gl.render(scene, camera)
            gl.setRenderTarget(null)
        }
    })

    return createPortal(
        <>
            <ambientLight intensity={1} />
            <mesh>
                {/* Background plane to ensure 0 alpha? No, clear color handles it. */}
            </mesh>
            {/* Override material to render white */}
            <group>
                {React.Children.map(children, child => (
                    <meshBasicMaterial color="white" />
                ))}
                {/* This material override is tricky with Portal. 
            Better to just let the children render white materials.
        */}
                {children}
            </group>
        </>,
        scene
    )
}
