import test from 'node:test';
import assert from 'node:assert/strict';
import { runSmokeSuite } from '../scripts/testHelpers.js';

test('preset meshes parse and shared state allocates buffers', async () => {
    const summary = await runSmokeSuite();
    assert.ok(summary.presetCount >= 1, 'expected at least one preset mesh');
    assert.strictEqual(summary.grids.twoD, 128 * 64, '2D field allocation mismatch');
    assert.strictEqual(summary.grids.threeD, 128 * 64 * 48, '3D field allocation mismatch');
});
