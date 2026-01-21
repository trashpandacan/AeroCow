import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Create a white material for obstacle rendering
const whiteMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide
})

// Create cow geometry (same as Cow component but merged into single geometry)
function createCowGeometry() {
    const group = new THREE.Group()

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.6, 0.4, 0.3)
    const body = new THREE.Mesh(bodyGeo, whiteMaterial)
    group.add(body)

    // Head
    const headGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2)
    const head = new THREE.Mesh(headGeo, whiteMaterial)
    head.position.set(0.4, 0.1, 0)
    group.add(head)

    // Legs
    const legGeo = new THREE.BoxGeometry(0.1, 0.3, 0.1)

    const leg1 = new THREE.Mesh(legGeo, whiteMaterial)
    leg1.position.set(-0.2, -0.3, 0.1)
    group.add(leg1)

    const leg2 = new THREE.Mesh(legGeo, whiteMaterial)
    leg2.position.set(0.2, -0.3, 0.1)
    group.add(leg2)

    const leg3 = new THREE.Mesh(legGeo, whiteMaterial)
    leg3.position.set(-0.2, -0.3, -0.1)
    group.add(leg3)

    const leg4 = new THREE.Mesh(legGeo, whiteMaterial)
    leg4.position.set(0.2, -0.3, -0.1)
    group.add(leg4)

    return group
}

export function ObstacleManager({ targetFBO, obstacleRef }) {
    const { gl } = useThree()

    // Create obstacle scene with black background
    const scene = useMemo(() => {
        const s = new THREE.Scene()
        s.background = new THREE.Color(0x000000)
        return s
    }, [])

    // Orthographic camera matching visualization space
    // World [-5, 5] x [-5, 5] maps to UV [0, 1] x [0, 1]
    const camera = useMemo(() => {
        const cam = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100)
        cam.position.set(0, 0, 10)
        cam.lookAt(0, 0, 0)
        return cam
    }, [])

    // Create cow geometry for obstacle rendering
    const obstacleCow = useMemo(() => {
        const cow = createCowGeometry()
        cow.scale.set(2, 2, 2) // Match visible cow scale
        return cow
    }, [])

    // Add cow to scene
    useMemo(() => {
        scene.add(obstacleCow)
        return () => scene.remove(obstacleCow)
    }, [scene, obstacleCow])

    useFrame(() => {
        // Sync obstacle cow transform with visible cow
        if (obstacleRef?.current) {
            // Copy world matrix from visible cow
            obstacleRef.current.updateMatrixWorld(true)
            obstacleCow.position.copy(obstacleRef.current.position)
            obstacleCow.rotation.copy(obstacleRef.current.rotation)
            obstacleCow.scale.copy(obstacleRef.current.scale)
        }

        // Render obstacle to texture
        if (targetFBO) {
            gl.setRenderTarget(targetFBO)
            gl.clear()
            gl.render(scene, camera)
            gl.setRenderTarget(null)
        }
    })

    return null
}
