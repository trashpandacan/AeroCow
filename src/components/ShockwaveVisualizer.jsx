import React, { useContext, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { FluidContext } from '../simulation/FluidSimulation'
import * as THREE from 'three'
import baseVert from '../shaders/base.vert?raw'
import schlierenFrag from '../shaders/schlieren.frag?raw'
import { useControls } from 'leva'

export function ShockwaveVisualizer() {
    const { pressure } = useContext(FluidContext)

    const { intensity } = useControls({
        intensity: { value: 10.0, min: 0, max: 100, step: 1, label: 'Shockwave Intensity' }
    })

    const material = useMemo(() => new THREE.ShaderMaterial({
        uniforms: {
            uPressure: { value: null },
            texelSize: { value: new THREE.Vector2(1 / 256, 1 / 256) },
            intensity: { value: 10.0 }
        },
        vertexShader: baseVert,
        fragmentShader: schlierenFrag,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending // Additive for "glow"
    }), [])

    useFrame(() => {
        if (pressure.read) {
            material.uniforms.uPressure.value = pressure.read.texture
            material.uniforms.intensity.value = intensity
        }
    })

    return (
        <mesh position={[0, 0, 0.01]}> {/* Slightly in front */}
            <planeGeometry args={[10, 10]} />
            <primitive object={material} attach="material" />
        </mesh>
    )
}
