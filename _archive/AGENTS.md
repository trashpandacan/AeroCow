# Repository Guidelines

## Project Structure & Module Organization
`index.html` now only wires up layout scaffolding and loads `styles/main.css` plus the modular JS entry point `src/main.js`. Business logic is split into small modules: `src/state/` (simulation parameters, geometry builders), `src/solvers/` (2D and 3D solver families), `src/renderers/` (2D canvas heatmap + Three.js volume), `src/ui/` (control panel bindings), and `src/utils/` (STL parsing and helpers). Keep physics code pure inside `src/solvers/**`, push DOM work to `src/ui`, and use the state classes for shared typed arrays or configuration. Add assets (textures, presets) under `assets/` to keep the root clean.

## Build, Test, and Development Commands
The stack is browser-native; no bundler is required. During development run a static server so module imports resolve: `python3 -m http.server 4173` then open `http://localhost:4173/` and load `index.html`. macOS users can also run `open index.html` for a quick file preview, but note that STL uploads and module scripts may be blocked under the `file://` protocol. Keep third-party tooling optional—add npm scripts only if you introduce a build step (for example, TypeScript or linting).

## Coding Style & Naming Conventions
Use ES modules with explicit imports (`from './state/simulationState.js'`). Prefer `const` for bindings, `let` for reassignments, and avoid `var`. Functions and variables use `camelCase`, classes use `PascalCase`, CSS selectors stay in `kebab-case`. Maintain 4-space indent in JS and CSS, and add short comments only when the math or GPU mapping is non-obvious. Keep solver internals deterministic and side-effect free; UI components should emit events instead of mutating global state.

## Testing Guidelines
Testing is currently manual. After each change, serve the app locally, step through every solver (LBM, Navier–Stokes, potential, vortex, 3D LBM), and drag all sliders to their extremes. Watch the stats bar (`dragCoeff`, `liftCoeff`, `ldRatio`, `strouhal`) for NaNs or spikes, and inspect DevTools for typed-array allocation warnings. When editing geometry import paths, upload a sample STL to confirm voxelization. For 3D work, verify iso-surface rendering under multiple camera angles and ensure FPS stays above 30 on a modern laptop.

## Commit & Pull Request Guidelines
Follow concise, imperative commit subjects such as `feat: add D3Q19 solver` or `refactor: split geometry builder`. Describe solver/math changes in the body, including assumptions (grid size, CFL choice). Pull requests must include: summary of physical features touched, reproduction steps (server command + UI scenario), screenshots/GIFs for UI/visualization tweaks, and notes on manual testing coverage (solvers exercised, Reynolds/Mach ranges). Keep UI polish, solver changes, and documentation updates in separate PRs so reviewers can reason about numerical impacts.
