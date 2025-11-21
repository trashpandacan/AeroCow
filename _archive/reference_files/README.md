# AeroCow – Browser CFD Playground

AeroCow is a browser-native aerodynamic sandbox that blends approachable UI controls with research-style CFD solvers. The project focuses on giving students and engineers rapid feedback on aerodynamic ideas while keeping the codebase modular: solvers stay pure, state owns typed arrays, renderers handle Canvas/Three.js work, and UI bindings emit events instead of mutating globals.

## Current Scope

- Real-time 2D and 3D simulations that share a single `SimulationState` and typed-array storage.
- Solver families under `src/solvers/**` (LBM, Navier–Stokes, potential flow, vortex lattice, D3Q19 LBM).
- Dual renderers: a 2D Canvas heatmap (`FieldRenderer`) and a Three.js volume/iso surface renderer for 3D grids.
- Geometry pipelines in `src/state/geometryBuilder.js` for airfoils, cylinders, wings, spheres, and imported STL meshes with preset libraries under `assets/`.
- Instrumented UI (`ControlPanel`) covering solver selection, grid resolution, scenario presets, STL uploads, visual layers, and simulation lifecycle controls.
- Stats bar reporting iterations, FPS, drag, lift, L/D, and Strouhal numbers each frame.

## Architecture At A Glance

| Directory | Responsibility |
| --- | --- |
| `index.html`, `styles/main.css` | Layout scaffolding, field canvas, Three.js mount, control panel. |
| `src/main.js` | Entry point that wires state, solvers, renderers, and UI events. |
| `src/state/` | Simulation parameters, typed-array allocation, procedural geometry voxelizers. |
| `src/solvers/` | Deterministic physics kernels (2D: LBM, Navier–Stokes, potential, vortex. 3D: LBM). |
| `src/renderers/` | 2D heatmap overlays and 3D marching / iso-surface volume rendering via Three.js. |
| `src/ui/` | Control panel bindings, scenario buttons, layer toggles, STL upload plumbing. |
| `src/utils/` | STL parsing helpers and future shared utilities. |
| `assets/` | Preset meshes (`.stl`), textures, and scenario assets kept out of the project root. |

## Capabilities

### Simulation & Solvers
- D2Q9 LBM with BGK collision, body-force inlet, and bounce-back obstacle handling.
- Semi-Lagrangian incompressible Navier–Stokes solver with implicit diffusion and pressure projection.
- Potential-flow and vortex-lattice modes for rapid conceptual sweeps.
- Experimental D3Q19 LBM volume solver driving the Three.js renderer.
- All solvers consume the same typed arrays, so switching solvers reuses the grid without rehydrating DOM nodes.

### Geometry & Assets
- Procedural voxelizers for airfoils, cylinders, wings, spheres, and blended primitives with angle-of-attack support.
- STL ingestion via `parseSTL` with bounds normalization, plus curated presets (`Aero Cow`, `Utah Teapot`, `Humanoid`, `Space Invader`) selectable directly from the control panel.
- Scenario shortcuts (cylinder, airfoil, wing, cavity) that set solver, dimension, grid, and flow parameters in one click.

### Visualization & Analysis
- 2D field modes for velocity magnitude, pressure, vorticity, and streamlines that can be toggled independently.
- 3D iso-surface volume rendering with adjustable depth resolution and live mesh updates.
- Performance HUD showing FPS and iteration counters, plus live drag, lift, L/D, and Strouhal readouts sourced from `SimulationState`.
- Pause/resume/reset hooks wired to the state machine for deterministic stepping while reviewing flow features.

## Desired Functionality

Near-term targets:
- Harden the D3Q19 solver and iso-surface renderer (memory pooling, throttled updates, NaN monitoring).
- Broaden mesh workflows with additional presets, STL drag-and-drop, and better bounding-box heuristics.
- Expand scenario coverage (transonic wing, vortex street, cavity oscillation) to highlight solver strengths.
- Add data export hooks (JSON snapshots, PNG/GLB captures) and richer HUD statistics.

Longer-term goals:
- WebGL compute or WebGPU acceleration for >256³ grids.
- Turbulence modeling options (Smagorinsky LES, RANS closures) plus parameterized inflow profiles.
- Multi-element and moving-geometry support via extended voxelizers and dynamic obstacle masks.
- Integrated regression harness to compare solver outputs against canonical benchmarks.

## Running The Simulator

1. Install nothing—only a modern browser is required.
2. Serve the repo so ES modules resolve:  
   ```bash
   python3 -m http.server 4173
   ```
3. Visit `http://localhost:4173/` and open `index.html`.
4. Pick a solver/dimension, choose an analytic geometry or STL preset, then drag sliders (Re, Mach, angle, grid, depth) to explore the flow.
5. Use the scenario buttons for one-click canonical setups or upload your own STL to voxelize a new obstacle.

## Manual Testing Checklist

- Exercise every solver (LBM 2D/3D, Navier–Stokes, potential, vortex) after changes; watch FPS and iteration readouts.
- Drag each control to its extrema (Re, Mach, angle, grid/depth resolution) and confirm no NaNs or typed-array reallocation warnings appear in DevTools.
- For geometry tweaks: upload a sample STL, verify voxelization bounds, and ensure preset dropdowns stay in sync with the object selector.
- In 3D mode, orbit the camera, toggle iso surfaces, and confirm FPS remains ≥30 on a modern laptop.
- Inspect the stats bar (`dragCoeff`, `liftCoeff`, `ldRatio`, `strouhal`) each run for stability.

## Automated Regression Checks

- Run `npm test` to execute the Node.js built-in test runner (`node --test`). The suite wraps the historical smoke and regression scripts, so it still parses preset STL files, allocates grids, and drives every solver plus the static HTTP server.
- VS Code can surface the tests in the Testing panel automatically because they live under `tests/*.test.js` and use the `node:test` module. Hit the play button beside `smoke` or `regression` to re-run subsets while iterating on solver or asset changes.

## Contributing

- Keep solver logic pure and deterministic inside `src/solvers/**`; push DOM/Three.js work into renderers and UI modules.
- When adding new tooling (TypeScript, linting, etc.) wire optional npm scripts but keep the base stack bundler-free.
- Document numerical assumptions (grid size, CFL, collision parameters) inside commit bodies and PR descriptions.
- Separate PRs for solver math, UI polish, and docs so reviewers can reason about physical impacts.

## License & Attribution

Educational/research use only; results should be validated against trusted CFD codes (OpenFOAM, SU2, etc.) before design decisions. Inspired by open-source CFD communities, GPU Gems references, and classic SIGGRAPH fluid courses.
