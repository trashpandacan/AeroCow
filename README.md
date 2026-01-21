# AeroCow - Wind Tunnel Fluid Simulation

A real-time wind tunnel fluid dynamics simulator built with React, Three.js, and WebGL shaders. Watch smoke flow around a 3D cow model with interactive visualization modes.

## Features

- **GPU-accelerated Navier-Stokes fluid simulation** (256x256 resolution)
- **Three visualization modes:**
  - **Density** - Smoke/fluid visualization with cyan coloring
  - **Shockwaves (Schlieren)** - Vorticity and pressure gradient visualization
  - **Streamlines** - Particle-based flow visualization
  - **All** - Combined view of all visualization modes
- **Interactive cow obstacle** - Rotate the cow using TransformControls
- **Wind speed control** - Adjust flow velocity in real-time

## Tech Stack

- **React 19** with React Three Fiber
- **Three.js** for 3D rendering
- **WebGL shaders** for GPU-based fluid simulation
- **Leva** for UI controls
- **Vite** for fast development builds

## How It Works

The simulation implements a 2D incompressible Navier-Stokes solver using GPU shaders:

1. **Inflow** - Wind enters from the left boundary
2. **Density Injection** - Smoke is continuously injected
3. **Advection** - Velocity and density are advected using semi-Lagrangian method
4. **Boundary Conditions** - No-slip condition at obstacle (cow) surface
5. **Pressure Solve** - Jacobi iteration (20 iterations)
6. **Gradient Subtraction** - Makes flow divergence-free

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Controls

- **Visualization dropdown** - Switch between Density, Shockwaves, Streamlines, or All
- **Wind Speed slider** - Adjust the inflow velocity (0-10)
- **Schlieren Intensity** - Adjust shockwave visualization sensitivity
- **Transform Controls** - Click and drag to rotate the cow

## Project Structure

```
src/
├── App.jsx                      # Main application
├── components/
│   ├── Cow.jsx                  # 3D cow model
│   ├── FluidVisualizer.jsx      # Density visualization
│   ├── ShockwaveVisualizer.jsx  # Schlieren visualization
│   └── Streamlines.jsx          # Particle streamlines
├── simulation/
│   ├── FluidSimulation.jsx      # Core simulation loop
│   ├── FluidContext.js          # React context for FBO access
│   └── ObstacleManager.jsx      # Obstacle rendering
└── shaders/
    ├── advection.frag           # Semi-Lagrangian advection
    ├── boundary.frag            # Obstacle boundary conditions
    ├── display.frag             # Density visualization
    ├── divergence.frag          # Velocity divergence
    ├── gradient.frag            # Pressure gradient
    ├── inflow.frag              # Wind tunnel inflow
    ├── jacobi.frag              # Pressure solver
    ├── schlieren.frag           # Vorticity visualization
    └── splat.frag               # Density injection
```

## License

MIT
