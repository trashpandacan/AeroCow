#!/usr/bin/env node
import { runRegressionSuite } from './testHelpers.js';

async function run() {
    console.log('🔎 Running AeroCow regression checks...');
    await runRegressionSuite();
    console.log('✅ Regression checks passed.\n');
}

run().catch((error) => {
    console.error('❌ Regression checks failed.');
    console.error(error);
    process.exit(1);
});
