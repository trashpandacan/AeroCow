import { build3DObstacle } from '../../state/geometryBuilder.js';

const cx = [
    0, 1, -1, 0, 0, 0, 0,
    1, -1, 1, -1, 1, -1,
    0, 0, 0, 0, 1, -1
];
const cy = [
    0, 0, 0, 1, -1, 0, 0,
    1, -1, -1, 1, 0, 0,
    1, -1, 0, 0, 0, 0
];
const cz = [
    0, 0, 0, 0, 0, 1, -1,
    0, 0, 0, 0, 1, -1,
    -1, 1, 1, -1, 0, 0
];
const w = [
    1 / 3,
    1 / 18, 1 / 18, 1 / 18, 1 / 18, 1 / 18, 1 / 18,
    1 / 36, 1 / 36, 1 / 36, 1 / 36, 1 / 36, 1 / 36,
    1 / 36, 1 / 36, 1 / 36, 1 / 36, 1 / 36, 1 / 36,
];
const opposite = [0, 2, 1, 4, 3, 6, 5, 9, 8, 7, 10, 12, 11, 15, 14, 13, 16, 19, 18];

export class LBMSolver3D {
    constructor(state) {
        this.state = state;
        this.tempDistribution = new Float32Array(state.fields3d.lbmDistribution.length);
        this.rebuildObstacle();
    }

    rebuildObstacle() {
        build3DObstacle(this.state);
    }

    step() {
        if (this.state.params.dimension !== '3d') {
            return;
        }

        this._ensureBuffers();
        this._collide();
        this._stream();
        this._applyBoundaries();
        this._calculateVorticity();
        this._estimateLoads();
        this.state.iterations += 1;
    }

    _collide() {
        const { params, fields3d } = this.state;
        const { nx, ny, nz, viscosity } = params;
        const { lbmDistribution: f, velocityX, velocityY, velocityZ, density, obstacle, pressure } = fields3d;
        const omega = 1 / (3 * viscosity + 0.5);

        for (let z = 0; z < nz; z++) {
            for (let y = 0; y < ny; y++) {
                for (let x = 0; x < nx; x++) {
                    const idx = z * nx * ny + y * nx + x;
                    if (obstacle[idx]) continue;

                    const base = idx * 19;
                    let rho = 0;
                    let ux = 0;
                    let uy = 0;
                    let uz = 0;
                    for (let k = 0; k < 19; k++) {
                        const fk = f[base + k];
                        rho += fk;
                        ux += fk * cx[k];
                        uy += fk * cy[k];
                        uz += fk * cz[k];
                    }

                    ux /= rho;
                    uy /= rho;
                    uz /= rho;
                    velocityX[idx] = ux;
                    velocityY[idx] = uy;
                    velocityZ[idx] = uz;
                    density[idx] = rho;
                    pressure[idx] = rho;

                    const u2 = ux * ux + uy * uy + uz * uz;
                    for (let k = 0; k < 19; k++) {
                        const cu = 3 * (cx[k] * ux + cy[k] * uy + cz[k] * uz);
                        const feq = w[k] * rho * (1 + cu + 0.5 * cu * cu - 1.5 * u2);
                        f[base + k] = f[base + k] - omega * (f[base + k] - feq);
                    }
                }
            }
        }
    }

    _stream() {
        const { params, fields3d } = this.state;
        const { nx, ny, nz } = params;
        const { lbmDistribution: f, obstacle } = fields3d;
        this.tempDistribution.set(f);

        for (let z = 0; z < nz; z++) {
            for (let y = 0; y < ny; y++) {
                for (let x = 0; x < nx; x++) {
                    const idx = z * nx * ny + y * nx + x;
                    const base = idx * 19;
                    for (let k = 0; k < 19; k++) {
                        const nxPos = x + cx[k];
                        const nyPos = y + cy[k];
                        const nzPos = z + cz[k];
                        if (nxPos < 0 || nxPos >= nx || nyPos < 0 || nyPos >= ny || nzPos < 0 || nzPos >= nz) {
                            continue;
                        }
                        const nIdx = nzPos * nx * ny + nyPos * nx + nxPos;
                        const nBase = nIdx * 19;
                        if (obstacle[nIdx]) {
                            f[base + opposite[k]] = this.tempDistribution[nBase + k];
                        } else {
                            f[nBase + k] = this.tempDistribution[base + k];
                        }
                    }
                }
            }
        }
    }

    _applyBoundaries() {
        const { params, fields3d } = this.state;
        const { nx, ny, nz, mach } = params;
        const { velocityX, velocityY, velocityZ } = fields3d;
        const inlet = mach / Math.sqrt(3);

        for (let y = 0; y < ny; y++) {
            for (let z = 0; z < nz; z++) {
                const inletIdx = z * nx * ny + y * nx;
                velocityX[inletIdx] = inlet;
                velocityY[inletIdx] = 0;
                velocityZ[inletIdx] = 0;

                const outletIdx = z * nx * ny + y * nx + (nx - 1);
                velocityX[outletIdx] = velocityX[outletIdx - 1];
                velocityY[outletIdx] = velocityY[outletIdx - 1];
                velocityZ[outletIdx] = velocityZ[outletIdx - 1];
            }
        }
    }

    _calculateVorticity() {
        const { params, fields3d } = this.state;
        const { nx, ny, nz } = params;
        const { velocityX, velocityY, velocityZ, vorticity, obstacle } = fields3d;
        const slice = nx * ny;

        for (let z = 1; z < nz - 1; z++) {
            for (let y = 1; y < ny - 1; y++) {
                for (let x = 1; x < nx - 1; x++) {
                    const idx = z * slice + y * nx + x;
                    if (obstacle[idx]) {
                        vorticity[idx] = 0;
                        continue;
                    }

                    const dw_dy = (velocityZ[idx + nx] - velocityZ[idx - nx]) * 0.5;
                    const dv_dz = (velocityY[idx + slice] - velocityY[idx - slice]) * 0.5;
                    const du_dz = (velocityX[idx + slice] - velocityX[idx - slice]) * 0.5;
                    const dw_dx = (velocityZ[idx + 1] - velocityZ[idx - 1]) * 0.5;
                    const dv_dx = (velocityY[idx + 1] - velocityY[idx - 1]) * 0.5;
                    const du_dy = (velocityX[idx + nx] - velocityX[idx - nx]) * 0.5;
                    const wx = dw_dy - dv_dz;
                    const wy = du_dz - dw_dx;
                    const wz = dv_dx - du_dy;
                    vorticity[idx] = Math.sqrt(wx * wx + wy * wy + wz * wz);
                }
            }
        }
    }

    _estimateLoads() {
        const { params, fields3d } = this.state;
        const { nx, ny, nz } = params;
        const { obstacle, velocityX, velocityY, velocityZ } = fields3d;
        let drag = 0;
        let lift = 0;
        let side = 0;
        let area = 0;
        const slice = nx * ny;

        for (let z = 1; z < nz - 1; z++) {
            for (let y = 1; y < ny - 1; y++) {
                for (let x = 1; x < nx - 1; x++) {
                    const idx = z * slice + y * nx + x;
                    if (!obstacle[idx]) continue;
                    area += 1;
                    drag += velocityX[idx + 1] - velocityX[idx - 1];
                    lift += velocityY[idx + nx] - velocityY[idx - nx];
                    side += velocityZ[idx + slice] - velocityZ[idx - slice];
                }
            }
        }

        const norm = Math.max(area, 1);
        this.state.drag = drag / norm;
        this.state.lift = lift / norm;
        this.state.sideForce = side / norm;
        this.state.ld = this.state.drag ? this.state.lift / this.state.drag : 0;
        this.state.strouhal = Math.abs(this.state.lift) * 0.05;
    }

    _ensureBuffers() {
        const needed = this.state.fields3d.lbmDistribution.length;
        if (this.tempDistribution.length !== needed) {
            this.tempDistribution = new Float32Array(needed);
        }
    }
}
