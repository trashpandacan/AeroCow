import { useFrame } from '@react-three/fiber'
import React, { useContext, useMemo } from 'react'
import { FluidContext } from '../simulation/FluidSimulation'
import * as THREE from 'three'
import baseVert from '../shaders/base.vert?raw'
import displayFrag from '../shaders/display.frag?raw'

export function FluidVisualizer() {
    const { density } = useContext(FluidContext)

    const material = useMemo(() => new THREE.ShaderMaterial({
        uniforms: {
            uTexture: { value: null }
        },
        vertexShader: baseVert,
        fragmentShader: displayFrag,
        transparent: true,
        side: THREE.DoubleSide
    }), [])

    // Update texture every frame
    // Actually, we can just assign it once if the texture object doesn't change (it's the same FBO attachment)
    // But since we swap FBOs, the 'read' texture object changes reference?
    // In my implementation:
    // const density = useMemo(...) -> createDoubleFBO
    // density.read is an object. density.swap() swaps the references inside the object.
    // So density.read points to a RenderTarget.
    // The texture is density.read.texture.
    // When we swap, density.read becomes the other RenderTarget.
    // So the texture reference DOES change.
    // We need to update the uniform every frame.

    // Wait, in FluidSimulation.jsx:
    // <FluidContext.Provider value={{ density: density.read.texture ... }}>
    // The value passed to provider is evaluated at render time.
    // But FluidSimulation doesn't re-render every frame! It uses useFrame.
    // So the Context value is STALE. It points to the initial 'read' texture.
    // AND, since we swap inside the object `density`, `density.read` changes.
    // BUT `density` object itself is stable.

    // Correct approach: Pass the `density` object (the DoubleFBO wrapper) via context,
    // and let the visualizer read `density.read.texture` in useFrame.

    // I need to update FluidSimulation.jsx to pass the wrapper, not the texture.
    // Or, I can just use a ref in the context?

    // Let's update FluidSimulation.jsx first.
    // But for now, let's write this component assuming I fix that.

    useFrame(() => {
        if (density.read) {
            material.uniforms.uTexture.value = density.read.texture
        }
    })

    return (
        <mesh>
            <planeGeometry args={[10, 10]} />
            <primitive object={material} attach="material" />
        </mesh>
    )
}
