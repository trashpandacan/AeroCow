#!/usr/bin/env node
import { runSmokeSuite } from './testHelpers.js';

async function main() {
    const summary = await runSmokeSuite();
    console.log(`Smoke test: ${summary.presetCount} preset meshes parsed, state verified.`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
