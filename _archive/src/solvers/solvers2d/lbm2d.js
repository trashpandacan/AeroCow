import { build2DObstacle } from '../../state/geometryBuilder.js';

const cx = [0, 1, 0, -1, 0, 1, -1, -1, 1];
const cy = [0, 0, 1, 0, -1, 1, 1, -1, -1];
const w = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36];
const opposite = [0, 3, 4, 1, 2, 7, 8, 5, 6];

export class LBMSolver2D {
    constructor(state) {
        this.state = state;
        this.tempDistribution = new Float32Array(state.fields2d.lbmDistribution.length);
        this.rebuildObstacle();
    }

    rebuildObstacle() {
        build2DObstacle(this.state);
    }

    step() {
        const { params } = this.state;
        if (params.dimension !== '2d') {
            return;
        }
        this._ensureBuffers();
        this._collide();
        this._stream();
        this._applyBoundaries();
        this._calculateVorticity();
        this._updateForces();
        this.state.iterations += 1;
    }

    _collide() {
        const { params, fields2d } = this.state;
        const { nx, ny, viscosity } = params;
        const { lbmDistribution: f, velocityX, velocityY, density, obstacle, pressure } = fields2d;
        const omega = 1 / (3 * viscosity + 0.5);

        for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
                const idx = j * nx + i;
                if (obstacle[idx]) continue;

                let rho = 0;
                let ux = 0;
                let uy = 0;
                const base = idx * 9;
                for (let k = 0; k < 9; k++) {
                    const fk = f[base + k];
                    rho += fk;
                    ux += fk * cx[k];
                    uy += fk * cy[k];
                }

                ux /= rho;
                uy /= rho;
                velocityX[idx] = ux;
                velocityY[idx] = uy;
                density[idx] = rho;
                pressure[idx] = rho;

                const u2 = ux * ux + uy * uy;
                for (let k = 0; k < 9; k++) {
                    const cu = 3 * (cx[k] * ux + cy[k] * uy);
                    const feq = w[k] * rho * (1 + cu + 0.5 * cu * cu - 1.5 * u2);
                    f[base + k] = f[base + k] - omega * (f[base + k] - feq);
                }
            }
        }
    }

    _stream() {
        const { params, fields2d } = this.state;
        const { nx, ny } = params;
        const { lbmDistribution: f, obstacle } = fields2d;
        this.tempDistribution.set(f);

        for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
                const idx = j * nx + i;
                const base = idx * 9;
                for (let k = 0; k < 9; k++) {
                    const x = i + cx[k];
                    const y = j + cy[k];
                    if (x < 0 || x >= nx || y < 0 || y >= ny) continue;
                    const nIdx = y * nx + x;
                    const nBase = nIdx * 9;
                    if (obstacle[nIdx]) {
                        f[base + opposite[k]] = this.tempDistribution[nBase + k];
                    } else {
                        f[nBase + k] = this.tempDistribution[base + k];
                    }
                }
            }
        }
    }

    _applyBoundaries() {
        const { params, fields2d } = this.state;
        const { nx, ny, mach } = params;
        const { velocityX, velocityY, lbmDistribution: f } = fields2d;
        const u0 = mach / Math.sqrt(3);

        for (let j = 0; j < ny; j++) {
            const idx = j * nx;
            const idxRight = j * nx + (nx - 1);
            velocityX[idx] = u0;
            velocityY[idx] = 0;
            velocityX[idxRight] = velocityX[idxRight - 1];
            velocityY[idxRight] = velocityY[idxRight - 1];
        }

        for (let i = 0; i < nx; i++) {
            const topIdx = i;
            const bottomIdx = (ny - 1) * nx + i;
            velocityX[topIdx] = velocityX[topIdx + nx];
            velocityY[topIdx] = 0;
            velocityX[bottomIdx] = velocityX[bottomIdx - nx];
            velocityY[bottomIdx] = 0;

            const topBase = topIdx * 9;
            const bottomBase = bottomIdx * 9;
            f[topBase + 2] = f[topBase + 4];
            f[bottomBase + 4] = f[bottomBase + 2];
        }
    }

    _calculateVorticity() {
        const { params, fields2d } = this.state;
        const { nx, ny } = params;
        const { velocityX, velocityY, vorticity, obstacle } = fields2d;

        for (let j = 1; j < ny - 1; j++) {
            for (let i = 1; i < nx - 1; i++) {
                const idx = j * nx + i;
                if (obstacle[idx]) {
                    vorticity[idx] = 0;
                    continue;
                }
                const dvx_dy = (velocityX[(j + 1) * nx + i] - velocityX[(j - 1) * nx + i]) * 0.5;
                const dvy_dx = (velocityY[j * nx + (i + 1)] - velocityY[j * nx + (i - 1)]) * 0.5;
                vorticity[idx] = dvy_dx - dvx_dy;
            }
        }
    }

    _updateForces() {
        const { params, fields2d } = this.state;
        const { nx, ny, mach, density0 } = params;
        const { pressure, velocityX, obstacle } = fields2d;
        let drag = 0;
        let lift = 0;
        let area = 0;

        for (let j = 1; j < ny - 1; j++) {
            for (let i = 1; i < nx - 1; i++) {
                const idx = j * nx + i;
                if (!obstacle[idx]) continue;
                area += 1;
                const right = j * nx + (i + 1);
                const left = j * nx + (i - 1);
                const up = (j + 1) * nx + i;
                const down = (j - 1) * nx + i;

                drag += (pressure[right] - pressure[left]) * 0.5;
                lift += (pressure[up] - pressure[down]) * 0.5;
                drag += 0.02 * (velocityX[right] - velocityX[left]);
            }
        }

        const u0 = mach / Math.sqrt(3);
        const dyn = 0.5 * density0 * u0 * u0 * Math.max(area, 1);
        const cd = dyn ? drag / dyn : 0;
        const cl = dyn ? lift / dyn : 0;
        this.state.drag = cd;
        this.state.lift = cl;
        this.state.ld = dyn ? cl / cd : 0;
        this.state.strouhal = Math.min(Math.abs(this.state.iterations ? (cl * 0.1) : 0), 1.0);
    }

    _ensureBuffers() {
        const needed = this.state.fields2d.lbmDistribution.length;
        if (this.tempDistribution.length !== needed) {
            this.tempDistribution = new Float32Array(needed);
        }
    }
}
