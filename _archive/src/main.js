import { SimulationState } from './state/simulationState.js';
import { build2DObstacle, build3DObstacle } from './state/geometryBuilder.js';
import { createSolver } from './solvers/solverFactory.js';
import { FieldRenderer } from './renderers/fieldRenderer.js';
import { ThreeRenderer } from './renderers/threeRenderer.js?v=2';
import { ControlPanel } from './ui/controlPanel.js';
import { parseSTL } from './utils/stlParser.js';
import { presetMeshes } from './assets/presetMeshes.js';

const canvas = document.getElementById('fieldCanvas');
const threeContainer = document.getElementById('threeContainer');
const fpsValue = document.getElementById('fpsValue');
const iterationsValue = document.getElementById('iterationsValue');
const dragCoeffEl = document.getElementById('dragCoeff');
const liftCoeffEl = document.getElementById('liftCoeff');
const ldRatioEl = document.getElementById('ldRatio');
const strouhalEl = document.getElementById('strouhal');
const activeSolverEl = document.getElementById('activeSolver');
const activeModeEl = document.getElementById('activeMode');
const startStopBtn = document.getElementById('startStopBtn');

const state = new SimulationState();
build2DObstacle(state);
build3DObstacle(state);

function refreshSolver() {
    solver = createSolver(state.params.solver, state);
}

let solver;
refreshSolver();
const fieldRenderer = new FieldRenderer(canvas, state);
const threeRenderer = new ThreeRenderer(threeContainer, state);
const controlPanel = new ControlPanel(state);
controlPanel.setMeshPresets(presetMeshes);

let lastTime = performance.now();
let frameCount = 0;
let lastFpsUpdate = performance.now();
let volumeDirty = true;

function setSolver(key) {
    state.setSolver(key);
    refreshSimulation({ resetFields: true });
    updateStatus();
}

function setDimension(dimension) {
    state.setDimension(dimension);
    updateViewVisibility();
    refreshSimulation({ resizeCanvas: true });
    updateStatus();
}

function rebuildGeometry() {
    if (state.params.dimension === '2d') {
        build2DObstacle(state);
    } else {
        build3DObstacle(state);
    }
    volumeDirty = true;
}

function updateViewVisibility() {
    if (state.params.dimension === '2d') {
        canvas.classList.remove('hidden');
        threeContainer.classList.add('hidden');
    } else {
        canvas.classList.add('hidden');
        threeContainer.classList.remove('hidden');
        threeRenderer.resize();
    }
    activeModeEl.textContent = state.params.dimension === '2d' ? '2D Field' : '3D Volume';
}

function updateStatus() {
    const solverMap = {
        lbm2d: 'LBM 2D',
        ns2d: 'Navier-Stokes 2D',
        potential2d: 'Potential 2D',
        vortex2d: 'Vortex Lattice',
        lbm3d: 'LBM 3D',
        euler3d: 'Euler 3D',
    };
    activeSolverEl.textContent = solverMap[state.params.solver] || state.params.solver;
}

function syncControlPanel() {
    controlPanel.dimensionSelect.value = state.params.dimension;
    controlPanel.solverSelect.value = state.params.solver;
    controlPanel.gridResolution.value = state.params.nx;
    controlPanel.resolutionValue.textContent = `${state.params.nx}×${state.params.ny}`;
    controlPanel.depthResolution.value = state.params.nz;
    controlPanel.depthValue.textContent = state.params.nz;
    controlPanel.objectSelect.value = state.geometry.type;
    controlPanel.angleSlider.value = state.geometry.angle;
    controlPanel.angleValue.textContent = `${state.geometry.angle}°`;
    controlPanel.reynoldsSlider.value = state.params.reynolds;
    controlPanel.reynoldsValue.textContent = Number(state.params.reynolds).toLocaleString();
    controlPanel.machSlider.value = state.params.mach;
    controlPanel.machValue.textContent = state.params.mach.toFixed(2);
    controlPanel.setMeshPresetValue(state.geometry.presetId || '');
}

function refreshSimulation({ resetFields = false, resizeCanvas = false } = {}) {
    if (resetFields) {
        state.resetFields();
    }
    rebuildGeometry();
    refreshSolver();
    volumeDirty = true;
    if (resizeCanvas) {
        fieldRenderer.resize();
        threeRenderer.resize();
    }
    syncControlPanel();
}

async function loadPresetMesh(presetId) {
    if (!presetId) {
        return;
    }
    const preset = presetMeshes.find((entry) => entry.id === presetId);
    if (!preset) {
        return;
    }
    controlPanel.setMeshPresetBusy(true);
    try {
        const response = await fetch(preset.path);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${preset.path}`);
        }
        const buffer = await response.arrayBuffer();
        const mesh = parseSTL(buffer);
        if (!mesh) {
            throw new Error('Unable to parse STL');
        }
        state.updateGeometry({
            type: 'custom',
            customMesh: mesh.vertices,
            customBounds: mesh.bounds,
            presetId,
        });
        refreshSimulation({ resetFields: true });
        controlPanel.objectSelect.value = 'custom';
    } catch (error) {
        console.error('Preset mesh load failed', error);
        fpsValue.textContent = 'ERR';
    } finally {
        controlPanel.setMeshPresetBusy(false);
    }
}

function applyScenario(key) {
    const scenarios = {
        cylinder: {
            solver: 'lbm2d',
            dimension: '2d',
            nx: 256,
            ny: 128,
            geometry: { type: 'cylinder', angle: 0 },
            mach: 0.15,
            reynolds: 3900,
        },
        airfoil: {
            solver: 'lbm2d',
            dimension: '2d',
            nx: 320,
            ny: 160,
            geometry: { type: 'airfoil', angle: 4 },
            mach: 0.3,
            reynolds: 1e5,
        },
        wing: {
            solver: 'lbm3d',
            dimension: '3d',
            nx: 192,
            ny: 96,
            nz: 64,
            geometry: { type: 'wing', angle: 8 },
            mach: 0.2,
            reynolds: 6000,
        },
        cavity: {
            solver: 'lbm3d',
            dimension: '3d',
            nx: 160,
            ny: 160,
            nz: 80,
            geometry: { type: 'sphere', angle: 0 },
            mach: 0.05,
            reynolds: 2000,
        },
    };

    const scenario = scenarios[key];
    if (!scenario) return;
    const nx = scenario.nx || state.params.nx;
    const ny = scenario.ny || state.params.ny;
    const nz = scenario.nz || state.params.nz;
    state.params.dimension = scenario.dimension;
    state.params.solver = scenario.solver;
    state.resizeGrid(nx, ny, nz);
    state.updateParams({
        mach: scenario.mach,
        reynolds: scenario.reynolds,
    });
    state.updateGeometry({
        ...scenario.geometry,
        presetId: null,
        customMesh: null,
        customBounds: null,
    });
    controlPanel.setMeshPresetValue('');
    refreshSimulation({ resetFields: true, resizeCanvas: true });
    updateViewVisibility();
    updateStatus();
}

controlPanel.addEventListener('dimensionchange', (event) => {
    setDimension(event.detail);
});

controlPanel.addEventListener('solverchange', (event) => {
    setSolver(event.detail);
});

controlPanel.addEventListener('resolutionchange', (event) => {
    const nx = Number(event.detail);
    const ny = Math.floor(nx / 2);
    state.resizeGrid(nx, ny, state.params.nz);
    refreshSimulation({ resizeCanvas: true });
});

controlPanel.addEventListener('depthchange', (event) => {
    const nz = Number(event.detail);
    state.resizeGrid(state.params.nx, state.params.ny, nz);
    refreshSimulation({ resizeCanvas: true });
});

controlPanel.addEventListener('geometrychange', (event) => {
    const detail = event.detail || {};
    const payload = {};
    if (typeof detail.angle === 'number') {
        payload.angle = detail.angle;
    }
    if (detail.type) {
        payload.type = detail.type;
        if (detail.resetCustom) {
            payload.customMesh = null;
            payload.customBounds = null;
            payload.presetId = null;
            controlPanel.setMeshPresetValue('');
        }
    }
    state.updateGeometry(payload);
    refreshSimulation({ resetFields: true });
});

controlPanel.addEventListener('geometryupload', (event) => {
    const mesh = parseSTL(event.detail);
    if (!mesh) return;
    state.updateGeometry({
        type: 'custom',
        customMesh: mesh.vertices,
        customBounds: mesh.bounds,
        presetId: null,
    });
    controlPanel.setMeshPresetValue('');
    refreshSimulation({ resetFields: true });
});

controlPanel.addEventListener('paramchange', (event) => {
    const partial = { ...event.detail };
    if (partial.reynolds) {
        partial.viscosity = Math.min(0.2, Math.max(0.002, 5000 / partial.reynolds));
    }
    state.updateParams(partial);
    refreshSimulation({ resetFields: true });
});

controlPanel.addEventListener('layerchange', (event) => {
    const { layer, value } = event.detail;
    state.toggleLayer(layer, value);
    if (layer === 'iso') {
        volumeDirty = true;
    }
});

controlPanel.addEventListener('scenario', (event) => {
    applyScenario(event.detail);
});

controlPanel.addEventListener('togglepause', () => {
    state.setPaused(!state.isPaused);
    startStopBtn.textContent = state.isPaused ? 'Resume' : 'Pause';
});

controlPanel.addEventListener('reset', () => {
    refreshSimulation({ resetFields: true });
});

controlPanel.addEventListener('presetmesh', (event) => {
    const presetId = event.detail;
    if (!presetId) {
        state.updateGeometry({ presetId: null });
        controlPanel.setMeshPresetValue('');
        return;
    }
    loadPresetMesh(presetId);
});

window.addEventListener('resize', () => {
    fieldRenderer.resize();
    threeRenderer.resize();
});

updateViewVisibility();
updateStatus();
fieldRenderer.resize();
syncControlPanel();

function loop(now) {
    const delta = now - lastTime;
    lastTime = now;

    if (!state.isPaused) {
        solver.step(delta);
        if (state.params.dimension === '3d') {
            if (volumeDirty || state.iterations % 8 === 0) {
                threeRenderer.updateVolume();
                volumeDirty = false;
            }
        }
    }

    if (state.params.dimension === '2d') {
        fieldRenderer.draw();
    } else {
        threeRenderer.render();
    }

    updateStats(delta);
    frameCount += 1;
    if (now - lastFpsUpdate > 1000) {
        fpsValue.textContent = frameCount.toFixed(0);
        frameCount = 0;
        lastFpsUpdate = now;
    }

    requestAnimationFrame(loop);
}

function updateStats() {
    iterationsValue.textContent = state.iterations.toString();
    dragCoeffEl.textContent = (state.drag || 0).toFixed(4);
    liftCoeffEl.textContent = (state.lift || 0).toFixed(4);
    ldRatioEl.textContent = Number.isFinite(state.ld) ? state.ld.toFixed(2) : '0.00';
    strouhalEl.textContent = (state.strouhal || 0).toFixed(2);
}

requestAnimationFrame(loop);
