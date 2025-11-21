import test from 'node:test';
import assert from 'node:assert/strict';
import { runSolverSuite, runStaticServerSuite } from '../scripts/testHelpers.js';

test('solver suite advances all solvers without NaNs', async () => {
    const summary = await runSolverSuite();
    assert.deepStrictEqual(summary.solvers, ['lbm2d', 'ns2d', 'potential2d', 'vortex2d', 'lbm3d']);
});

test('static server exposes core assets', async () => {
    await runStaticServerSuite();
});
