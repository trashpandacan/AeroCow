import assert from 'assert/strict';
import fs from 'fs';
import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import { setTimeout as delay } from 'timers/promises';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const rootDir = path.resolve(__dirname, '..');
export const testServerPort = 4173;

export function resolveFromRoot(...segments) {
    return path.resolve(rootDir, ...segments);
}

export async function importModule(relativePath) {
    const absolute = resolveFromRoot(relativePath);
    return import(pathToFileURL(absolute).href);
}

export async function runSmokeSuite() {
    const { parseSTL } = await importModule('src/utils/stlParser.js');
    const { presetMeshes } = await importModule('src/assets/presetMeshes.js');

    presetMeshes.forEach((preset) => {
        const assetPath = resolveFromRoot('src', preset.path);
        if (!fs.existsSync(assetPath)) {
            throw new Error(`Missing preset asset: ${assetPath}`);
        }
        const text = fs.readFileSync(assetPath, 'utf8');
        const mesh = parseSTL(text);
        if (!mesh || !mesh.vertices || mesh.vertices.length === 0) {
            throw new Error(`Failed to parse preset mesh ${preset.id}`);
        }
    });

    const { SimulationState } = await importModule('src/state/simulationState.js');
    const state = new SimulationState();
    state.resizeGrid(128, 64, 48);
    if (state.fields2d.velocityX.length !== 128 * 64) {
        throw new Error('2D field allocation mismatch');
    }
    if (state.fields3d.velocityX.length !== 128 * 64 * 48) {
        throw new Error('3D field allocation mismatch');
    }

    return {
        presetCount: presetMeshes.length,
        grids: {
            twoD: state.fields2d.velocityX.length,
            threeD: state.fields3d.velocityX.length,
        },
    };
}

export async function runSolverSuite() {
    const { SimulationState } = await importModule('src/state/simulationState.js');
    const { build2DObstacle, build3DObstacle } = await importModule('src/state/geometryBuilder.js');
    const { createSolver } = await importModule('src/solvers/solverFactory.js');

    const configs = [
        { key: 'lbm2d', dimension: '2d', steps: 6, grid: [96, 48] },
        { key: 'ns2d', dimension: '2d', steps: 3, grid: [64, 32] },
        { key: 'potential2d', dimension: '2d', steps: 2, grid: [80, 40] },
        { key: 'vortex2d', dimension: '2d', steps: 4, grid: [72, 36] },
        { key: 'lbm3d', dimension: '3d', steps: 3, grid: [48, 32, 24] },
    ];

    for (const config of configs) {
        const state = new SimulationState();
        state.setDimension(config.dimension);
        if (config.dimension === '3d') {
            state.resizeGrid(...config.grid);
        } else {
            state.resizeGrid(config.grid[0], config.grid[1], state.params.nz);
        }
        state.setSolver(config.key);
        if (config.dimension === '2d') {
            build2DObstacle(state);
        } else {
            build3DObstacle(state);
        }
        const solver = createSolver(config.key, state);
        const originalIterations = state.iterations;
        for (let i = 0; i < config.steps; i++) {
            solver.step();
        }
        assert.ok(state.iterations >= originalIterations + config.steps, `Solver ${config.key} did not advance iterations`);
        assertFiniteBuffer(state.activeFields.velocityX, `${config.key} velocityX`);
        assertFiniteBuffer(state.activeFields.pressure ?? state.activeFields.vorticity, `${config.key} pressure/vorticity`);
        assertFiniteNumber(state.drag, `${config.key} drag`);
        assertFiniteNumber(state.lift, `${config.key} lift`);
        assertFiniteNumber(state.ld, `${config.key} L/D`);
        assertFiniteNumber(state.strouhal, `${config.key} Strouhal`);
        if (config.dimension === '2d') {
            assert.ok(state.fields2d.obstacle.some((value) => value > 0), `${config.key} missing 2D obstacle voxels`);
        } else {
            assert.ok(state.fields3d.obstacle.some((value) => value > 0), `${config.key} missing 3D obstacle voxels`);
        }
    }

    return { solvers: configs.map((config) => config.key) };
}

export async function runStaticServerSuite() {
    const server = spawn('python3', ['-m', 'http.server', String(testServerPort)], {
        cwd: rootDir,
        stdio: 'ignore',
    });
    try {
        await delay(800);
        const indexResp = await httpRequest('/');
        assert.strictEqual(indexResp.status, 200, 'index.html did not load via HTTP');
        assert.ok(indexResp.body.includes('Preset Mesh Library'), 'index.html missing control panel markup');
        assert.ok(indexResp.body.includes('src/main.js'), 'index.html missing module entrypoint');

        const cssResp = await httpRequest('/styles/main.css');
        assert.strictEqual(cssResp.status, 200, 'main.css missing via HTTP');
        assert.ok(cssResp.body.includes('.control-panel'), 'main.css is unexpectedly empty');

        const mainResp = await httpRequest('/src/main.js');
        assert.strictEqual(mainResp.status, 200, 'main.js missing via HTTP');
        assert.ok(mainResp.body.includes('SimulationState'), 'main.js contents look incorrect');

        const stlHead = await httpRequest('/assets/aero-cow.stl', 'HEAD');
        assert.strictEqual(stlHead.status, 200, 'Preset STL not reachable via HTTP');
        assert.ok(Number(stlHead.headers['content-length']) > 1024, 'STL asset response too small');
    } finally {
        server.kill();
    }
}

export async function runRegressionSuite() {
    const solverSummary = await runSolverSuite();
    await runStaticServerSuite();
    return solverSummary;
}

function httpRequest(pathname, method = 'GET') {
    const options = {
        hostname: '127.0.0.1',
        port: testServerPort,
        path: pathname,
        method,
    };
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    body: Buffer.concat(chunks).toString('utf8'),
                    headers: res.headers,
                });
            });
        });
        req.on('error', reject);
        req.end();
    });
}

function assertFiniteNumber(value, label) {
    assert.ok(Number.isFinite(value), `${label} is not finite (received ${value})`);
}

function assertFiniteBuffer(buffer, label) {
    if (!buffer || typeof buffer.length !== 'number') {
        throw new Error(`${label} buffer missing`);
    }
    for (let i = 0; i < buffer.length; i++) {
        if (!Number.isFinite(buffer[i])) {
            throw new Error(`${label} contains non-finite value at index ${i}`);
        }
    }
}
