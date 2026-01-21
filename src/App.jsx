import React, { Suspense, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Stats, TransformControls, OrbitControls } from '@react-three/drei'
import { Leva, useControls } from 'leva'
import { FluidSimulation } from './simulation/FluidSimulation'
import { FluidVisualizer } from './components/FluidVisualizer'
import { ShockwaveVisualizer } from './components/ShockwaveVisualizer'
import { Streamlines } from './components/Streamlines'
import { Cow } from './components/Cow'

function App() {
  const { visualization, speed } = useControls({
    visualization: { value: 'All', options: ['Density', 'Shockwaves', 'Streamlines', 'All'] },
    speed: { value: 2.0, min: 0, max: 10, step: 0.1, label: 'Wind Speed' }
  })

  const cowRef = useRef()

  return (
    <>
      <Leva collapsed={false} />
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
        <color attach="background" args={['#050510']} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} />

        <Suspense fallback={null}>
          <FluidSimulation obstacleRef={cowRef} speed={speed}>
            {/* Visualizations render behind the cow */}
            {(visualization === 'Density' || visualization === 'All') && <FluidVisualizer />}
            {(visualization === 'Shockwaves' || visualization === 'All') && <ShockwaveVisualizer />}
            {(visualization === 'Streamlines' || visualization === 'All') && <Streamlines />}

            {/* Visible cow with transform controls */}
            <TransformControls mode="rotate">
              <Cow ref={cowRef} scale={2} />
            </TransformControls>
          </FluidSimulation>
        </Suspense>

        <OrbitControls enableRotate={false} enablePan={false} />
        <Stats />
      </Canvas>

      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        pointerEvents: 'none',
        fontFamily: 'var(--font-mono)',
        fontSize: '2rem',
        fontWeight: 'bold',
        color: 'var(--primary-color)',
        textShadow: '0 0 10px var(--primary-color)'
      }}>
        AEROCOW LAB <span style={{ fontSize: '1rem', color: 'var(--text-dim)' }}>v2.0</span>
      </div>
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        pointerEvents: 'none',
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-dim)',
        fontSize: '0.8rem'
      }}>
        Wind Tunnel Simulation - Flow from Left to Right
      </div>
    </>
  )
}

export default App

