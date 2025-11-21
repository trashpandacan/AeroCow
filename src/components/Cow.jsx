import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

export function Cow(props) {
    const group = useRef()

    useFrame((state) => {
        // group.current.rotation.y = Math.sin(state.clock.elapsedTime) * 0.2
    })

    const materialProps = {
        color: "#ffffff",
        emissive: "#444444", // Slight glow
        emissiveIntensity: 0.5,
        roughness: 0.2,
        metalness: 0.8
    }

    return (
        <group ref={group} {...props}>
            {/* Body */}
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[0.6, 0.4, 0.3]} />
                <meshStandardMaterial {...materialProps} />
            </mesh>
            {/* Head */}
            <mesh position={[0.4, 0.1, 0]}>
                <boxGeometry args={[0.2, 0.2, 0.2]} />
                <meshStandardMaterial {...materialProps} />
            </mesh>
            {/* Legs */}
            <mesh position={[-0.2, -0.3, 0.1]}>
                <boxGeometry args={[0.1, 0.3, 0.1]} />
                <meshStandardMaterial {...materialProps} />
            </mesh>
            <mesh position={[0.2, -0.3, 0.1]}>
                <boxGeometry args={[0.1, 0.3, 0.1]} />
                <meshStandardMaterial {...materialProps} />
            </mesh>
            <mesh position={[-0.2, -0.3, -0.1]}>
                <boxGeometry args={[0.1, 0.3, 0.1]} />
                <meshStandardMaterial {...materialProps} />
            </mesh>
            <mesh position={[0.2, -0.3, -0.1]}>
                <boxGeometry args={[0.1, 0.3, 0.1]} />
                <meshStandardMaterial {...materialProps} />
            </mesh>

            {/* Wireframe Overlay for "Tech" look */}
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[0.605, 0.405, 0.305]} />
                <meshBasicMaterial color="#00f3ff" wireframe transparent opacity={0.3} />
            </mesh>
            <mesh position={[0.4, 0.1, 0]}>
                <boxGeometry args={[0.205, 0.205, 0.205]} />
                <meshBasicMaterial color="#00f3ff" wireframe transparent opacity={0.3} />
            </mesh>
        </group>
    )
}
