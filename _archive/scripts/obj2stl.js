#!/usr/bin/env node
/**
 * Minimal OBJ -> ASCII STL converter for triangle meshes.
 * Supports faces defined as "f v1 v2 v3" or with texture/normal indices ("f v1/vt1/vn1 ...").
 */
import fs from 'fs';

if (process.argv.length < 4) {
    console.error('Usage: node scripts/obj2stl.js input.obj output.stl');
    process.exit(1);
}

const inputPath = process.argv[2];
const outputPath = process.argv[3];

const text = fs.readFileSync(inputPath, 'utf8');
const lines = text.split(/\r?\n/);

const vertices = [];
const triangles = [];

for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('v ')) {
        const [, ...coords] = line.split(/\s+/);
        if (coords.length < 3) continue;
        vertices.push(coords.slice(0, 3).map(Number));
    } else if (line.startsWith('f ')) {
        const [, ...faceTokens] = line.split(/\s+/);
        if (faceTokens.length < 3) continue;
        const indices = faceTokens.map((token) => {
            const idx = token.split('/')[0];
            return parseInt(idx, 10) - 1;
        });
        for (let i = 1; i < indices.length - 1; i++) {
            triangles.push([indices[0], indices[i], indices[i + 1]]);
        }
    }
}

function computeNormal(a, b, c) {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz) || 1;
    nx /= length;
    ny /= length;
    nz /= length;
    return [nx, ny, nz];
}

let stl = 'solid obj\n';
for (const tri of triangles) {
    const a = vertices[tri[0]];
    const b = vertices[tri[1]];
    const c = vertices[tri[2]];
    if (!a || !b || !c) continue;
    const [nx, ny, nz] = computeNormal(a, b, c);
    stl += `  facet normal ${nx} ${ny} ${nz}\n`;
    stl += '    outer loop\n';
    stl += `      vertex ${a[0]} ${a[1]} ${a[2]}\n`;
    stl += `      vertex ${b[0]} ${b[1]} ${b[2]}\n`;
    stl += `      vertex ${c[0]} ${c[1]} ${c[2]}\n`;
    stl += '    endloop\n';
    stl += '  endfacet\n';
}
stl += 'endsolid obj\n';

fs.writeFileSync(outputPath, stl);
console.log(`Wrote ${triangles.length} triangles to ${outputPath}`);
