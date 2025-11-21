import React, { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree, createPortal } from '@react-three/fiber'
import * as THREE from 'three'
import { useFBO } from '@react-three/drei'
import { ObstacleManager } from './ObstacleManager'

// Import Shaders
import baseVert from '../shaders/base.vert?raw'
import advectionFrag from '../shaders/advection.frag?raw'
import divergenceFrag from '../shaders/divergence.frag?raw'
import jacobiFrag from '../shaders/jacobi.frag?raw'
import gradientFrag from '../shaders/gradient.frag?raw'
import displayFrag from '../shaders/display.frag?raw'
import splatFrag from '../shaders/splat.frag?raw'
import boundaryFrag from '../shaders/boundary.frag?raw'
import inflowFrag from '../shaders/inflow.frag?raw'

const SIM_RES = 256
const ITERATIONS = 20

export const FluidContext = React.createContext()

function createDoubleFBO(width, height, options) {
    const fbo1 = new THREE.WebGLRenderTarget(width, height, options)
    const fbo2 = new THREE.WebGLRenderTarget(width, height, options)
    return {
        read: fbo1,
        write: fbo2,
        swap: function () {
            const temp = this.read
            this.read = this.write
            this.write = temp
        }
    }
}

export function FluidSimulation({ children, obstacles, speed = 1.0 }) {
    const { gl, size } = useThree()

    // FBO Options: FloatType for precision
    const options = useMemo(() => ({
        type: THREE.HalfFloatType, // or FloatType if supported
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
        stencilBuffer: false
    }), [])

    // FBOs
    const density = useMemo(() => createDoubleFBO(SIM_RES, SIM_RES, options), [options])
    const velocity = useMemo(() => createDoubleFBO(SIM_RES, SIM_RES, options), [options])
    const divergence = useFBO(SIM_RES, SIM_RES, options)
    const pressure = useMemo(() => createDoubleFBO(SIM_RES, SIM_RES, options), [options])
    const obstacle = useFBO(SIM_RES, SIM_RES, options)

    // Materials
    const advectionMat = useMemo(() => new THREE.ShaderMaterial({
        uniforms: {
            uVelocity: { value: null },
            uSource: { value: null },
            dt: { value: 0.016 },
            dissipation: { value: 1.0 }, // 0.98 for fading
            texelSize: { value: new THREE.Vector2(1 / SIM_RES, 1 / SIM_RES) }
        },
        vertexShader: baseVert,
        fragmentShader: advectionFrag
    }), [])

    const divergenceMat = useMemo(() => new THREE.ShaderMaterial({
        uniforms: {
            uVelocity: { value: null },
            texelSize: { value: new THREE.Vector2(1 / SIM_RES, 1 / SIM_RES) }
        },
        vertexShader: baseVert,
        fragmentShader: divergenceFrag
    }), [])

    const jacobiMat = useMemo(() => new THREE.ShaderMaterial({
        uniforms: {
            uPressure: { value: null },
            uDivergence: { value: null },
            alpha: { value: -1.0 },
            rBeta: { value: 0.25 },
            texelSize: { value: new THREE.Vector2(1 / SIM_RES, 1 / SIM_RES) }
        },
        vertexShader: baseVert,
        fragmentShader: jacobiFrag
    }), [])

    const gradientMat = useMemo(() => new THREE.ShaderMaterial({
        uniforms: {
            uPressure: { value: null },
            uVelocity: { value: null },
            texelSize: { value: new THREE.Vector2(1 / SIM_RES, 1 / SIM_RES) }
        },
        vertexShader: baseVert,
        fragmentShader: gradientFrag
    }), [])

    const splatMat = useMemo(() => new THREE.ShaderMaterial({
        uniforms: {
            uTarget: { value: null },
            aspectRatio: { value: 1.0 },
            color: { value: new THREE.Vector3() },
            point: { value: new THREE.Vector2() },
            radius: { value: 0.005 }
        },
        vertexShader: baseVert,
        fragmentShader: splatFrag
    }), [])

    const boundaryMat = useMemo(() => new THREE.ShaderMaterial({
        uniforms: {
            uVelocity: { value: null },
            uObstacle: { value: null }
        },
        vertexShader: baseVert,
        fragmentShader: boundaryFrag
    }), [])

    const inflowMat = useMemo(() => new THREE.ShaderMaterial({
        uniforms: {
            uVelocity: { value: null },
            speed: { value: 1.0 }
        },
        vertexShader: baseVert,
        fragmentShader: inflowFrag
    }), [])

    // Fullscreen Quad Camera
    const camera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), [])
    const scene = useMemo(() => {
        const scene = new THREE.Scene()
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
        scene.add(plane)
        return scene
    }, [])
    const mesh = scene.children[0]

    useFrame(({ clock }) => {
        const dt = 0.016 // Fixed dt for stability

        // 0. Inflow (Wind Tunnel)
        mesh.material = inflowMat
        inflowMat.uniforms.uVelocity.value = velocity.read.texture
        inflowMat.uniforms.speed.value = speed
        gl.setRenderTarget(velocity.write)
        gl.render(scene, camera)
        velocity.swap()

        // 0.5 Inject Smoke (Density)
        mesh.material = splatMat
        splatMat.uniforms.uTarget.value = density.read.texture
        splatMat.uniforms.point.value.set(0.0, 0.5) // Left side
        splatMat.uniforms.color.value.set(0.2, 0.2, 0.2) // Constant smoke
        splatMat.uniforms.radius.value = 0.05
        gl.setRenderTarget(density.write)
        gl.render(scene, camera)
        density.swap()

        // 1. Advect Velocity
        mesh.material = advectionMat
        advectionMat.uniforms.uVelocity.value = velocity.read.texture
        advectionMat.uniforms.uSource.value = velocity.read.texture
        advectionMat.uniforms.dt.value = dt
        advectionMat.uniforms.dissipation.value = 1.0
        gl.setRenderTarget(velocity.write)
        gl.render(scene, camera)
        velocity.swap()

        // 1.5 Boundary (Obstacle)
        mesh.material = boundaryMat
        boundaryMat.uniforms.uVelocity.value = velocity.read.texture
        boundaryMat.uniforms.uObstacle.value = obstacle.texture
        gl.setRenderTarget(velocity.write)
        gl.render(scene, camera)
        velocity.swap()

        // 2. Advect Density
        mesh.material = advectionMat // Reuse advection mat
        advectionMat.uniforms.uVelocity.value = velocity.read.texture
        advectionMat.uniforms.uSource.value = density.read.texture
        advectionMat.uniforms.dissipation.value = 0.99 // Fade out density
        gl.setRenderTarget(density.write)
        gl.render(scene, camera)
        density.swap()


        // 4. Divergence
        mesh.material = divergenceMat
        divergenceMat.uniforms.uVelocity.value = velocity.read.texture
        gl.setRenderTarget(divergence)
        gl.render(scene, camera)

        // 5. Pressure (Jacobi)
        mesh.material = jacobiMat
        jacobiMat.uniforms.uDivergence.value = divergence.texture
        for (let i = 0; i < ITERATIONS; i++) {
            jacobiMat.uniforms.uPressure.value = pressure.read.texture
            gl.setRenderTarget(pressure.write)
            gl.render(scene, camera)
            pressure.swap()
        }

        // 6. Gradient Subtraction
        mesh.material = gradientMat
        gradientMat.uniforms.uPressure.value = pressure.read.texture
        gradientMat.uniforms.uVelocity.value = velocity.read.texture
        gl.setRenderTarget(velocity.write)
        gl.render(scene, camera)
        velocity.swap()

        // 7. Boundary again (enforce no-slip after pressure solve)
        mesh.material = boundaryMat
        boundaryMat.uniforms.uVelocity.value = velocity.read.texture
        boundaryMat.uniforms.uObstacle.value = obstacle.texture
        gl.setRenderTarget(velocity.write)
        gl.render(scene, camera)
        velocity.swap()

        // Reset render target
        gl.setRenderTarget(null)
    })

    return (
        <FluidContext.Provider value={{ density, velocity, pressure, obstacle }}>
            <ObstacleManager targetFBO={obstacle}>
                {obstacles}
            </ObstacleManager>
            {children}
        </FluidContext.Provider>
    )
}
