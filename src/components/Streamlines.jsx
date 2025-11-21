import React, { useContext, useMemo, useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { FluidContext } from '../simulation/FluidSimulation'
import * as THREE from 'three'

export function Streamlines({ count = 400 }) {
    const { velocity } = useContext(FluidContext)
    const { gl } = useThree()
    const linesRef = useRef()
    const pixelBuffer = useRef(new Uint8Array(256 * 256 * 4))
    const readFBO = useRef()

    // Initialize read FBO
    useEffect(() => {
        readFBO.current = new THREE.WebGLRenderTarget(256, 256, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.UnsignedByteType
        })
    }, [])

    // Create particle data
    const particles = useMemo(() => {
        const data = []
        for (let i = 0; i < count; i++) {
            data.push({
                x: Math.random() * 0.3 - 1.0,
                y: Math.random() * 2 - 1,
                life: Math.random()
            })
        }
        return data
    }, [count])

    const geometry = useMemo(() => {
        const geo = new THREE.BufferGeometry()
        const positions = new Float32Array(count * 6)
        const colors = new Float32Array(count * 6)
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        return geo
    }, [count])

    const material = useMemo(() => new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    }), [])

    // Sample velocity from texture
    const sampleVelocity = (x, y, velData) => {
        const u = Math.max(0, Math.min(0.999, x * 0.5 + 0.5))
        const v = Math.max(0, Math.min(0.999, y * 0.5 + 0.5))
        const ix = Math.floor(u * 255)
        const iy = Math.floor(v * 255)
        const idx = (iy * 256 + ix) * 4

        // Velocity is stored in RG channels, normalized to [0,255]
        const vx = (velData[idx] / 255.0 - 0.5) * 2.0
        const vy = (velData[idx + 1] / 255.0 - 0.5) * 2.0
        return { vx, vy }
    }

    useFrame(({ clock }) => {
        if (!velocity.read || !linesRef.current) return

        // Read velocity texture every few frames (expensive operation)
        if (clock.elapsedTime % 0.1 < 0.016) {
            gl.readRenderTargetPixels(
                velocity.read,
                0, 0, 256, 256,
                pixelBuffer.current
            )
        }

        const positions = geometry.attributes.position.array
        const colors = geometry.attributes.color.array

        particles.forEach((p, i) => {
            const oldX = p.x
            const oldY = p.y

            // Sample velocity at particle position
            const { vx, vy } = sampleVelocity(p.x, p.y, pixelBuffer.current)

            // Advect particle
            p.x += vx * 0.02
            p.y += vy * 0.02
            p.life -= 0.003

            // Reset if out of bounds
            if (p.x > 1.2 || p.life <= 0 || Math.abs(p.y) > 1.2) {
                p.x = -1.0 - Math.random() * 0.2
                p.y = Math.random() * 2 - 1
                p.life = 0.8 + Math.random() * 0.2
            }

            // Create line segment
            const idx = i * 6
            positions[idx] = oldX
            positions[idx + 1] = oldY
            positions[idx + 2] = 0.02
            positions[idx + 3] = p.x
            positions[idx + 4] = p.y
            positions[idx + 5] = 0.02

            // Color based on speed
            const speed = Math.sqrt(vx * vx + vy * vy)
            const c = Math.min(1, speed * 3)
            colors[idx] = 0.2 + c * 0.6
            colors[idx + 1] = 0.6 + c * 0.4
            colors[idx + 2] = 1.0
            colors[idx + 3] = 0.2 + c * 0.6
            colors[idx + 4] = 0.6 + c * 0.4
            colors[idx + 5] = 1.0
        })

        geometry.attributes.position.needsUpdate = true
        geometry.attributes.color.needsUpdate = true
    })

    return <lineSegments ref={linesRef} geometry={geometry} material={material} />
}
