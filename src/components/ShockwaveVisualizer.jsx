import { useContext, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { FluidContext } from '../simulation/FluidContext'
import * as THREE from 'three'
import baseVert from '../shaders/base.vert?raw'
import schlierenFrag from '../shaders/schlieren.frag?raw'
import { useControls } from 'leva'

export function ShockwaveVisualizer() {
    const { pressure, velocity } = useContext(FluidContext)

    const { intensity } = useControls('Schlieren', {
        intensity: { value: 30.0, min: 0, max: 200, step: 1, label: 'Intensity' }
    })

    const material = useMemo(() => new THREE.ShaderMaterial({
        uniforms: {
            uVelocity: { value: null },
            uPressure: { value: null },
            texelSize: { value: new THREE.Vector2(1 / 256, 1 / 256) },
            intensity: { value: 30.0 }
        },
        vertexShader: baseVert,
        fragmentShader: schlierenFrag,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    }), [])

    useFrame(() => {
        if (velocity?.read && pressure?.read) {
            material.uniforms.uVelocity.value = velocity.read.texture
            material.uniforms.uPressure.value = pressure.read.texture
            material.uniforms.intensity.value = intensity
        }
    })

    return (
        <mesh position={[0, 0, 0.02]}>
            <planeGeometry args={[10, 10]} />
            <primitive object={material} attach="material" />
        </mesh>
    )
}
