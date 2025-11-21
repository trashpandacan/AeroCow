function nacaThickness(x, t = 0.12) {
    const sqrtX = Math.sqrt(Math.max(x, 0));
    return 5 * t * (0.2969 * sqrtX - 0.126 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1015 * x * x * x * x);
}

export function build2DObstacle(state) {
    const { fields2d, geometry, params } = state;
    const { nx, ny } = params;
    const { obstacle } = fields2d;
    obstacle.fill(0);

    switch (geometry.type) {
        case 'airfoil':
            voxelizeAirfoil(obstacle, nx, ny, geometry.angle);
            break;
        case 'cylinder':
            voxelizeCylinder(obstacle, nx, ny);
            break;
        case 'wing':
            voxelizeWingSection(obstacle, nx, ny, geometry.angle);
            break;
        case 'sphere':
            voxelizeSphereSlice(obstacle, nx, ny);
            break;
        case 'custom':
            if (geometry.customMesh && geometry.customMesh.length) {
                voxelizeCustomMesh2D(obstacle, nx, ny, geometry);
            } else if (geometry.customBounds) {
                voxelizeCustomBounds2D(obstacle, nx, ny, geometry.customBounds);
            } else {
                voxelizeSphereSlice(obstacle, nx, ny);
            }
            break;
        default:
            voxelizeSphereSlice(obstacle, nx, ny);
    }
}

export function build3DObstacle(state) {
    const { fields3d, geometry, params } = state;
    const { obstacle } = fields3d;
    const { nx, ny, nz } = params;
    obstacle.fill(0);

    switch (geometry.type) {
        case 'sphere':
            placeSphere(obstacle, nx, ny, nz);
            break;
        case 'wing':
            placeWing(obstacle, nx, ny, nz, geometry.angle);
            break;
        case 'airfoil':
            placeAirfoilVolume(obstacle, nx, ny, nz, geometry.angle);
            break;
        case 'cylinder':
            placeCylinder(obstacle, nx, ny, nz);
            break;
        case 'cow':
            placeCow(obstacle, nx, ny, nz, geometry.angle);
            break;
        case 'custom':
            if (geometry.customMesh && geometry.customMesh.length) {
                placeCustomMesh(obstacle, nx, ny, nz, geometry);
            } else if (geometry.customBounds) {
                placeCustomBounds(obstacle, nx, ny, nz, geometry.customBounds);
            } else {
                placeCustomBlob(obstacle, nx, ny, nz);
            }
            break;
        default:
            placeSphere(obstacle, nx, ny, nz);
    }
}

function placeCow(obstacle, nx, ny, nz, angleDeg) {
    const angle = angleDeg * Math.PI / 180;
    const cx = nx * 0.35;
    const cy = ny * 0.5;
    const cz = nz * 0.5;
    const scale = Math.min(nx, ny, nz) * 0.008; // Scale factor

    // Helper to rotate point around center
    const rotate = (x, y, z) => {
        const dx = x;
        const dy = y;
        const dz = z;
        // Rotate around Z axis (yaw) or Y axis (pitch)? 
        // Let's rotate around Y axis (pitch) as per angle of attack
        // x' = x cos - z sin
        // z' = x sin + z cos
        const rx = dx * Math.cos(angle) - dz * Math.sin(angle);
        const rz = dx * Math.sin(angle) + dz * Math.cos(angle);
        return { x: rx, y: dy, z: rz };
    };

    // Primitives
    const shapes = [
        // Body (Ellipsoid)
        { type: 'ellipsoid', x: 0, y: 0, z: 0, rx: 18, ry: 10, rz: 10 },
        // Head (Sphere)
        { type: 'sphere', x: 22, y: 6, z: 0, r: 7 },
        // Legs (Cylinders)
        { type: 'cylinder', x: 10, y: -12, z: 5, r: 3, h: 12 },
        { type: 'cylinder', x: 10, y: -12, z: -5, r: 3, h: 12 },
        { type: 'cylinder', x: -10, y: -12, z: 5, r: 3, h: 12 },
        { type: 'cylinder', x: -10, y: -12, z: -5, r: 3, h: 12 },
        // Udder (Sphere)
        { type: 'sphere', x: -2, y: -10, z: 0, r: 4 },
        // Horns
        { type: 'cone', x: 24, y: 12, z: 3, r: 1, h: 6, dx: 0.5, dy: 1, dz: 0.2 },
        { type: 'cone', x: 24, y: 12, z: -3, r: 1, h: 6, dx: 0.5, dy: 1, dz: -0.2 },
    ];

    const slice = nx * ny;

    for (let z = 0; z < nz; z++) {
        for (let y = 0; y < ny; y++) {
            for (let x = 0; x < nx; x++) {
                // Transform grid point to local space relative to cow center
                // We iterate grid, so we need inverse transform?
                // Or just iterate bounding box of cow?
                // Iterating whole grid is safer for now.

                const dx = x - cx;
                const dy = y - cy;
                const dz = z - cz;

                // Inverse rotate to check against axis-aligned shapes
                const rx = dx * Math.cos(-angle) - dz * Math.sin(-angle);
                const ry = dy;
                const rz = dx * Math.sin(-angle) + dz * Math.cos(-angle);

                // Check shapes
                let hit = false;
                for (const s of shapes) {
                    const lx = rx / scale - s.x;
                    const ly = ry / scale - s.y;
                    const lz = rz / scale - s.z;

                    if (s.type === 'sphere') {
                        if (lx * lx + ly * ly + lz * lz < s.r * s.r) { hit = true; break; }
                    } else if (s.type === 'ellipsoid') {
                        if ((lx * lx) / (s.rx * s.rx) + (ly * ly) / (s.ry * s.ry) + (lz * lz) / (s.rz * s.rz) < 1) { hit = true; break; }
                    } else if (s.type === 'cylinder') {
                        // Vertical cylinder (y-axis)
                        // Check height
                        if (ly > -s.h / 2 && ly < s.h / 2) {
                            if (lx * lx + lz * lz < s.r * s.r) { hit = true; break; }
                        }
                    } else if (s.type === 'cone') {
                        // Approximate cone
                        const dist = Math.sqrt(lx * lx + ly * ly + lz * lz);
                        if (dist < s.h) hit = true; // Just a blob for now
                    }
                }

                if (hit) {
                    obstacle[z * slice + y * nx + x] = 1;
                }
            }
        }
    }
}

function voxelizeAirfoil(obstacle, nx, ny, angleDeg) {
    const angle = angleDeg * Math.PI / 180;
    const centerX = Math.floor(nx * 0.3);
    const centerY = Math.floor(ny * 0.5);
    const chord = Math.floor(nx * 0.4);
    const thickness = ny * 0.15;

    for (let xi = 0; xi < chord; xi++) {
        const xNorm = xi / chord;
        const thicknessNorm = nacaThickness(xNorm);
        const half = thicknessNorm * thickness;

        for (let yi = -half; yi <= half; yi++) {
            const x = centerX + Math.cos(angle) * (xi - chord / 2) - Math.sin(angle) * yi;
            const y = centerY + Math.sin(angle) * (xi - chord / 2) + Math.cos(angle) * yi;
            const gx = Math.floor(x);
            const gy = Math.floor(y);
            if (gx >= 2 && gx < nx - 2 && gy >= 2 && gy < ny - 2) {
                obstacle[gy * nx + gx] = 1;
            }
        }
    }
}

function voxelizeCylinder(obstacle, nx, ny) {
    const radius = Math.min(nx, ny) * 0.08;
    const cx = Math.floor(nx * 0.3);
    const cy = Math.floor(ny * 0.5);
    const radius2 = radius * radius;

    for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
            const dx = i - cx;
            const dy = j - cy;
            if (dx * dx + dy * dy <= radius2) {
                obstacle[j * nx + i] = 1;
            }
        }
    }
}

function voxelizeWingSection(obstacle, nx, ny, angleDeg) {
    const angle = angleDeg * Math.PI / 180;
    const centerX = Math.floor(nx * 0.28);
    const centerY = Math.floor(ny * 0.5);
    const span = Math.floor(ny * 0.35);
    const chord = Math.floor(nx * 0.35);

    for (let xi = -chord / 2; xi < chord / 2; xi++) {
        const localSpan = span * (1 - Math.abs(xi) / (chord / 2));
        for (let yi = -localSpan; yi <= localSpan; yi++) {
            const x = centerX + Math.cos(angle) * xi - Math.sin(angle) * yi;
            const y = centerY + Math.sin(angle) * xi + Math.cos(angle) * yi;
            const gx = Math.floor(x);
            const gy = Math.floor(y);
            if (gx >= 2 && gx < nx - 2 && gy >= 2 && gy < ny - 2) {
                obstacle[gy * nx + gx] = 1;
            }
        }
    }
}

function voxelizeSphereSlice(obstacle, nx, ny) {
    const radius = Math.min(nx, ny) * 0.12;
    const cx = Math.floor(nx * 0.3);
    const cy = Math.floor(ny * 0.5);
    const radius2 = radius * radius;

    for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
            const dx = i - cx;
            const dy = j - cy;
            if (dx * dx + dy * dy <= radius2 * 0.8) {
                obstacle[j * nx + i] = 1;
            }
        }
    }
}

function voxelizeCustomBounds2D(obstacle, nx, ny, bounds) {
    const width = bounds.maxX - bounds.minX || 1;
    const height = bounds.maxY - bounds.minY || 1;
    const scaleX = (nx * 0.35) / width;
    const scaleY = (ny * 0.4) / height;
    const halfW = Math.max(4, Math.floor((width * scaleX) / 2));
    const halfH = Math.max(4, Math.floor((height * scaleY) / 2));
    const centerX = Math.floor(nx * 0.3);
    const centerY = Math.floor(ny * 0.5);

    for (let y = -halfH; y <= halfH; y++) {
        for (let x = -halfW; x <= halfW; x++) {
            const gx = centerX + x;
            const gy = centerY + y;
            if (gx > 2 && gx < nx - 2 && gy > 2 && gy < ny - 2) {
                obstacle[gy * nx + gx] = 1;
            }
        }
    }
}

function placeSphere(obstacle, nx, ny, nz) {
    const radius = Math.min(nx, ny, nz) * 0.12;
    const cx = Math.floor(nx * 0.28);
    const cy = Math.floor(ny * 0.5);
    const cz = Math.floor(nz * 0.5);
    const radius2 = radius * radius;

    for (let z = 0; z < nz; z++) {
        for (let y = 0; y < ny; y++) {
            for (let x = 0; x < nx; x++) {
                const dx = x - cx;
                const dy = y - cy;
                const dz = z - cz;
                if (dx * dx + dy * dy + dz * dz <= radius2) {
                    obstacle[z * nx * ny + y * nx + x] = 1;
                }
            }
        }
    }
}

function placeWing(obstacle, nx, ny, nz, angleDeg) {
    const angle = angleDeg * Math.PI / 180;
    const cx = Math.floor(nx * 0.28);
    const cy = Math.floor(ny * 0.5);
    const span = ny * 0.4;
    const chord = nx * 0.4;
    const thickness = Math.max(2, Math.floor(nz * 0.1));

    for (let y = -span / 2; y < span / 2; y++) {
        const localChord = chord * (1 - Math.abs(y) / (span / 2));
        for (let x = -localChord / 2; x < localChord / 2; x++) {
            for (let z = -thickness; z <= thickness; z++) {
                const gx = Math.floor(cx + Math.cos(angle) * x - Math.sin(angle) * z);
                const gy = Math.floor(cy + y);
                const gz = Math.floor(nz / 2 + Math.sin(angle) * x + Math.cos(angle) * z);
                if (gx >= 2 && gx < nx - 2 && gy >= 2 && gy < ny - 2 && gz >= 2 && gz < nz - 2) {
                    obstacle[gz * nx * ny + gy * nx + gx] = 1;
                }
            }
        }
    }
}

function placeAirfoilVolume(obstacle, nx, ny, nz, angleDeg) {
    const angle = angleDeg * Math.PI / 180;
    const centerX = Math.floor(nx * 0.3);
    const centerY = Math.floor(ny * 0.5);
    const chord = nx * 0.35;
    const thickness = ny * 0.12;
    const depth = Math.max(4, Math.floor(nz * 0.2));

    for (let xi = -chord / 2; xi < chord / 2; xi++) {
        const localThickness = thickness * (1 - Math.abs(xi) / (chord / 2));
        for (let yi = -localThickness; yi <= localThickness; yi++) {
            for (let zi = -depth; zi <= depth; zi++) {
                const x = centerX + Math.cos(angle) * xi - Math.sin(angle) * yi;
                const y = centerY + Math.sin(angle) * xi + Math.cos(angle) * yi;
                const z = Math.floor(nz / 2 + zi);
                const gx = Math.floor(x);
                const gy = Math.floor(y);
                if (gx >= 2 && gx < nx - 2 && gy >= 2 && gy < ny - 2 && z >= 2 && z < nz - 2) {
                    obstacle[z * nx * ny + gy * nx + gx] = 1;
                }
            }
        }
    }
}

function placeCylinder(obstacle, nx, ny, nz) {
    const radius = Math.min(ny, nz) * 0.15;
    const cx = Math.floor(nx * 0.35);
    const cy = Math.floor(ny * 0.5);
    const cz = Math.floor(nz * 0.5);
    const radius2 = radius * radius;

    for (let y = 0; y < ny; y++) {
        for (let z = 0; z < nz; z++) {
            const dy = y - cy;
            const dz = z - cz;
            if (dy * dy + dz * dz <= radius2) {
                for (let x = cx - radius; x < cx + radius; x++) {
                    const gx = Math.floor(x);
                    if (gx >= 2 && gx < nx - 2) {
                        obstacle[z * nx * ny + y * nx + gx] = 1;
                    }
                }
            }
        }
    }
}

function placeCustomBlob(obstacle, nx, ny, nz) {
    const cx = Math.floor(nx * 0.3);
    const cy = Math.floor(ny * 0.5);
    const cz = Math.floor(nz * 0.5);
    for (let z = -8; z <= 8; z++) {
        for (let y = -12; y <= 12; y++) {
            for (let x = -20; x <= 20; x++) {
                const gx = cx + x + Math.sin(z * 0.3) * 3;
                const gy = cy + y + Math.cos(x * 0.1) * 2;
                const gz = cz + z;
                if (gx > 2 && gx < nx - 2 && gy > 2 && gy < ny - 2 && gz > 2 && gz < nz - 2) {
                    obstacle[gz * nx * ny + gy * nx + gx] = 1;
                }
            }
        }
    }
}

function placeCustomBounds(obstacle, nx, ny, nz, bounds) {
    const width = bounds.maxX - bounds.minX || 1;
    const height = bounds.maxY - bounds.minY || 1;
    const depth = bounds.maxZ - bounds.minZ || 1;
    const scaleX = (nx * 0.35) / width;
    const scaleY = (ny * 0.35) / height;
    const scaleZ = (nz * 0.35) / depth;

    const halfW = Math.max(3, Math.floor((width * scaleX) / 2));
    const halfH = Math.max(3, Math.floor((height * scaleY) / 2));
    const halfD = Math.max(3, Math.floor((depth * scaleZ) / 2));

    const centerX = Math.floor(nx * 0.32);
    const centerY = Math.floor(ny * 0.5);
    const centerZ = Math.floor(nz * 0.5);

    for (let z = -halfD; z <= halfD; z++) {
        for (let y = -halfH; y <= halfH; y++) {
            for (let x = -halfW; x <= halfW; x++) {
                const gx = centerX + x;
                const gy = centerY + y;
                const gz = centerZ + z;
                if (gx > 2 && gx < nx - 2 && gy > 2 && gy < ny - 2 && gz > 2 && gz < nz - 2) {
                    obstacle[gz * nx * ny + gy * nx + gx] = 1;
                }
            }
        }
    }
}

function voxelizeCustomMesh2D(obstacle, nx, ny, geometry) {
    const mesh = geometry.customMesh;
    if (!mesh || mesh.length === 0) {
        voxelizeCustomBounds2D(obstacle, nx, ny, geometry.customBounds || getBoundsFromMesh(mesh));
        return;
    }
    const bounds = geometry.customBounds || getBoundsFromMesh(mesh);
    const placement = computePlacement(bounds, nx, ny, null);

    const stamp = (gx, gy) => {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const x = gx + dx;
                const y = gy + dy;
                if (x > 1 && x < nx - 1 && y > 1 && y < ny - 1) {
                    obstacle[y * nx + x] = 1;
                }
            }
        }
    };

    for (let i = 0; i < mesh.length; i += 3) {
        const grid = mapToGrid(mesh[i], mesh[i + 1], mesh[i + 2], placement);
        stamp(grid.x, grid.y);
    }

    for (let i = 0; i < mesh.length; i += 9) {
        const cx = (mesh[i] + mesh[i + 3] + mesh[i + 6]) / 3;
        const cy = (mesh[i + 1] + mesh[i + 4] + mesh[i + 7]) / 3;
        const cz = (mesh[i + 2] + mesh[i + 5] + mesh[i + 8]) / 3;
        const grid = mapToGrid(cx, cy, cz, placement);
        stamp(grid.x, grid.y);
    }

    solidify2D(obstacle, nx, ny);
}

function placeCustomMesh(obstacle, nx, ny, nz, geometry) {
    const mesh = geometry.customMesh;
    if (!mesh || mesh.length === 0) {
        placeCustomBlob(obstacle, nx, ny, nz);
        return;
    }
    const bounds = geometry.customBounds || getBoundsFromMesh(mesh);
    const placement = computePlacement(bounds, nx, ny, nz);
    const slice = nx * ny;

    const stamp = (gx, gy, gz) => {
        for (let dz = -1; dz <= 1; dz++) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const x = gx + dx;
                    const y = gy + dy;
                    const z = gz + dz;
                    if (x > 1 && x < nx - 1 && y > 1 && y < ny - 1 && z > 1 && z < nz - 1) {
                        obstacle[z * slice + y * nx + x] = 1;
                    }
                }
            }
        }
    };

    for (let i = 0; i < mesh.length; i += 3) {
        const grid = mapToGrid(mesh[i], mesh[i + 1], mesh[i + 2], placement);
        stamp(grid.x, grid.y, grid.z);
    }

    for (let i = 0; i < mesh.length; i += 9) {
        const cx = (mesh[i] + mesh[i + 3] + mesh[i + 6]) / 3;
        const cy = (mesh[i + 1] + mesh[i + 4] + mesh[i + 7]) / 3;
        const cz = (mesh[i + 2] + mesh[i + 5] + mesh[i + 8]) / 3;
        const grid = mapToGrid(cx, cy, cz, placement);
        stamp(grid.x, grid.y, grid.z);
    }

    solidify3D(obstacle, nx, ny, nz);
}

function mapToGrid(x, y, z, placement) {
    return {
        x: Math.floor(placement.centerX + placement.scale * (x - placement.meshCenterX)),
        y: Math.floor(placement.centerY + placement.scale * (y - placement.meshCenterY)),
        z: placement.centerZ !== null ? Math.floor(placement.centerZ + placement.scale * (z - placement.meshCenterZ)) : 0,
    };
}

function computePlacement(bounds, nx, ny, nz) {
    const width = Math.max(bounds.maxX - bounds.minX, 1e-3);
    const height = Math.max(bounds.maxY - bounds.minY, 1e-3);
    const depth = Math.max(bounds.maxZ - bounds.minZ, 1e-3);
    const targetWidth = nx * 0.35;
    const targetHeight = ny * 0.55;
    const targetDepth = nz ? nz * 0.55 : depth;
    const scale = Math.min(targetWidth / width, targetHeight / height, targetDepth / depth);
    return {
        scale,
        centerX: Math.floor(nx * 0.32),
        centerY: Math.floor(ny * 0.5),
        centerZ: nz ? Math.floor(nz * 0.5) : null,
        meshCenterX: (bounds.minX + bounds.maxX) / 2,
        meshCenterY: (bounds.minY + bounds.maxY) / 2,
        meshCenterZ: (bounds.minZ + bounds.maxZ) / 2,
    };
}

function getBoundsFromMesh(mesh) {
    const bounds = {
        minX: Infinity,
        minY: Infinity,
        minZ: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
        maxZ: -Infinity,
    };
    for (let i = 0; i < mesh.length; i += 3) {
        const x = mesh[i];
        const y = mesh[i + 1];
        const z = mesh[i + 2];
        bounds.minX = Math.min(bounds.minX, x);
        bounds.minY = Math.min(bounds.minY, y);
        bounds.minZ = Math.min(bounds.minZ, z);
        bounds.maxX = Math.max(bounds.maxX, x);
        bounds.maxY = Math.max(bounds.maxY, y);
        bounds.maxZ = Math.max(bounds.maxZ, z);
    }
    return bounds;
}

function solidify2D(obstacle, nx, ny) {
    for (let y = 0; y < ny; y++) {
        let inside = false;
        for (let x = 0; x < nx; x++) {
            const idx = y * nx + x;
            if (obstacle[idx]) {
                inside = !inside;
            } else if (inside) {
                obstacle[idx] = 1;
            }
        }
    }
}

function solidify3D(obstacle, nx, ny, nz) {
    const slice = nx * ny;
    for (let z = 0; z < nz; z++) {
        for (let y = 0; y < ny; y++) {
            let inside = false;
            for (let x = 0; x < nx; x++) {
                const idx = z * slice + y * nx + x;
                if (obstacle[idx]) {
                    inside = !inside;
                } else if (inside) {
                    obstacle[idx] = 1;
                }
            }
        }
    }
}
