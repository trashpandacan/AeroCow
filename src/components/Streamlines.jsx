import { useContext, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { FluidContext } from '../simulation/FluidContext'
import * as THREE from 'three'

const SIM_RES = 256

export function Streamlines({ count = 500 }) {
    const { velocity } = useContext(FluidContext)
    const { gl } = useThree()
    const linesRef = useRef()

    // Float buffer for reading HalfFloat velocity texture
    const velocityBuffer = useRef(new Float32Array(SIM_RES * SIM_RES * 4))
    const frameCount = useRef(0)

    // Create particle data - particles live in world space [-5, 5]
    const particles = useMemo(() => {
        const data = []
        for (let i = 0; i < count; i++) {
            data.push({
                x: -5 + Math.random() * 2, // Start on left side
                y: (Math.random() - 0.5) * 8, // Spread vertically
                life: 0.5 + Math.random() * 0.5
            })
        }
        return data
    }, [count])

    // Geometry for line segments (each particle = 2 points = 6 floats for position)
    const geometry = useMemo(() => {
        const geo = new THREE.BufferGeometry()
        const positions = new Float32Array(count * 6) // 2 points * 3 coords each
        const colors = new Float32Array(count * 6)
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        return geo
    }, [count])

    const material = useMemo(() => new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    }), [])

    // Convert world coordinates to UV (texture coordinates)
    // World: [-5, 5] -> UV: [0, 1]
    const worldToUV = (wx, wy) => {
        return {
            u: (wx + 5) / 10,
            v: (wy + 5) / 10
        }
    }

    // Sample velocity from buffer at UV coordinates
    // Returns velocity in world-space units per second
    const sampleVelocity = (wx, wy, velData) => {
        const { u, v } = worldToUV(wx, wy)
        const clampedU = Math.max(0, Math.min(0.999, u))
        const clampedV = Math.max(0, Math.min(0.999, v))

        const ix = Math.floor(clampedU * (SIM_RES - 1))
        const iy = Math.floor(clampedV * (SIM_RES - 1))
        const idx = (iy * SIM_RES + ix) * 4

        // Velocity is stored as float values in RG channels
        // These are in grid-units per second, convert to world-space
        const vx = velData[idx] * 0.002      // Scale factor for visible movement
        const vy = velData[idx + 1] * 0.002

        return { vx, vy }
    }

    useFrame(() => {
        if (!velocity?.read || !linesRef.current) return

        frameCount.current++

        // Read velocity texture every 3 frames to reduce GPU stalls
        if (frameCount.current % 3 === 0) {
            try {
                gl.readRenderTargetPixels(
                    velocity.read,
                    0, 0, SIM_RES, SIM_RES,
                    velocityBuffer.current
                )
            } catch {
                // Fallback if reading fails
            }
        }

        const positions = geometry.attributes.position.array
        const colors = geometry.attributes.color.array

        particles.forEach((p, i) => {
            const oldX = p.x
            const oldY = p.y

            // Sample velocity at particle position
            const { vx, vy } = sampleVelocity(p.x, p.y, velocityBuffer.current)

            // Advect particle
            p.x += vx
            p.y += vy
            p.life -= 0.005

            // Reset if out of bounds or dead
            if (p.x > 5.5 || p.x < -5.5 || Math.abs(p.y) > 5.5 || p.life <= 0) {
                // Respawn on left edge
                p.x = -5 + Math.random() * 0.5
                p.y = (Math.random() - 0.5) * 8
                p.life = 0.7 + Math.random() * 0.3
            }

            // Create line segment from old to new position
            const idx = i * 6
            positions[idx] = oldX
            positions[idx + 1] = oldY
            positions[idx + 2] = 0.05 // Slightly in front
            positions[idx + 3] = p.x
            positions[idx + 4] = p.y
            positions[idx + 5] = 0.05

            // Color based on speed - cyan to white gradient
            const speed = Math.sqrt(vx * vx + vy * vy) * 100
            const c = Math.min(1, speed * 2)

            // Cyan base with brightness based on speed
            colors[idx] = 0.0 + c * 0.8
            colors[idx + 1] = 0.8 + c * 0.2
            colors[idx + 2] = 1.0
            colors[idx + 3] = 0.0 + c * 0.8
            colors[idx + 4] = 0.8 + c * 0.2
            colors[idx + 5] = 1.0
        })

        geometry.attributes.position.needsUpdate = true
        geometry.attributes.color.needsUpdate = true
    })

    return <lineSegments ref={linesRef} geometry={geometry} material={material} />
}
