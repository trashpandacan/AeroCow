import React, { forwardRef } from 'react'

export const Cow = forwardRef(function Cow(props, ref) {
    const materialProps = {
        color: "#ffffff",
        emissive: "#00f3ff",
        emissiveIntensity: 0.3,
        roughness: 0.2,
        metalness: 0.8
    }

    return (
        <group ref={ref} {...props}>
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
})
