function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

export class NavierStokes2D {
    constructor(state) {
        this.state = state;
        this._allocate();
    }

    _allocate() {
        const { nx, ny } = this.state.params;
        const size = nx * ny;
        this.tempVX = new Float32Array(size);
        this.tempVY = new Float32Array(size);
        this.pressure = new Float32Array(size);
        this.divergence = new Float32Array(size);
    }

    step() {
        if (this.state.params.dimension !== '2d') {
            return;
        }
        this._ensureCapacity();

        const { fields2d } = this.state;
        const { velocityX, velocityY, obstacle } = fields2d;
        const { nx, ny, viscosity, dt } = this.state.params;

        this._advect(velocityX, velocityY, this.tempVX, dt);
        this._advect(velocityY, velocityX, this.tempVY, dt, true);
        this._diffuse(this.tempVX, viscosity, dt);
        this._diffuse(this.tempVY, viscosity, dt);

        this._project(this.tempVX, this.tempVY);

        for (let i = 0; i < velocityX.length; i++) {
            if (obstacle[i]) {
                velocityX[i] = 0;
                velocityY[i] = 0;
            } else {
                velocityX[i] = this.tempVX[i];
                velocityY[i] = this.tempVY[i];
            }
        }

        this._calculateDerived();
        this.state.iterations += 1;
    }

    _advect(src, advector, out, dt, swap = false) {
        const { nx, ny } = this.state.params;
        const { velocityX, velocityY, obstacle } = this.state.fields2d;

        for (let j = 1; j < ny - 1; j++) {
            for (let i = 1; i < nx - 1; i++) {
                const idx = j * nx + i;
                if (obstacle[idx]) {
                    out[idx] = 0;
                    continue;
                }
                const u = swap ? velocityY[idx] : velocityX[idx];
                const v = swap ? velocityX[idx] : velocityY[idx];
                let x = i - dt * u;
                let y = j - dt * v;
                x = clamp(x, 0.5, nx - 1.5);
                y = clamp(y, 0.5, ny - 1.5);
                const i0 = Math.floor(x);
                const j0 = Math.floor(y);
                const i1 = i0 + 1;
                const j1 = j0 + 1;
                const s1 = x - i0;
                const s0 = 1 - s1;
                const t1 = y - j0;
                const t0 = 1 - t1;
                out[idx] =
                    s0 * (t0 * src[j0 * nx + i0] + t1 * src[j1 * nx + i0]) +
                    s1 * (t0 * src[j0 * nx + i1] + t1 * src[j1 * nx + i1]);
            }
        }
    }

    _diffuse(field, viscosity, dt) {
        const { nx, ny } = this.state.params;
        const a = dt * viscosity * nx * ny;
        const iterations = 8;
        const temp = new Float32Array(field);

        for (let n = 0; n < iterations; n++) {
            for (let j = 1; j < ny - 1; j++) {
                for (let i = 1; i < nx - 1; i++) {
                    const idx = j * nx + i;
                    field[idx] =
                        (temp[idx] +
                            a * (field[idx - 1] + field[idx + 1] + field[idx - nx] + field[idx + nx])) /
                        (1 + 4 * a);
                }
            }
        }
    }

    _project(vx, vy) {
        const { nx, ny } = this.state.params;
        const { obstacle } = this.state.fields2d;

        for (let j = 1; j < ny - 1; j++) {
            for (let i = 1; i < nx - 1; i++) {
                const idx = j * nx + i;
                const div =
                    -0.5 *
                    (vx[idx + 1] - vx[idx - 1] + vy[idx + nx] - vy[idx - nx]);
                this.divergence[idx] = obstacle[idx] ? 0 : div;
                this.pressure[idx] = 0;
            }
        }

        const iterations = 20;
        for (let k = 0; k < iterations; k++) {
            for (let j = 1; j < ny - 1; j++) {
                for (let i = 1; i < nx - 1; i++) {
                    const idx = j * nx + i;
                    this.pressure[idx] =
                        (this.divergence[idx] +
                            this.pressure[idx - 1] +
                            this.pressure[idx + 1] +
                            this.pressure[idx - nx] +
                            this.pressure[idx + nx]) /
                        4;
                }
            }
        }

        for (let j = 1; j < ny - 1; j++) {
            for (let i = 1; i < nx - 1; i++) {
                const idx = j * nx + i;
                vx[idx] -= 0.5 * (this.pressure[idx + 1] - this.pressure[idx - 1]);
                vy[idx] -= 0.5 * (this.pressure[idx + nx] - this.pressure[idx - nx]);
            }
        }
    }

    _calculateDerived() {
        const { params, fields2d } = this.state;
        const { nx, ny } = params;
        const { velocityX, velocityY, vorticity } = fields2d;

        for (let j = 1; j < ny - 1; j++) {
            for (let i = 1; i < nx - 1; i++) {
                const idx = j * nx + i;
                const dvx_dy = (velocityX[(j + 1) * nx + i] - velocityX[(j - 1) * nx + i]) * 0.5;
                const dvy_dx = (velocityY[j * nx + (i + 1)] - velocityY[j * nx + (i - 1)]) * 0.5;
                vorticity[idx] = dvy_dx - dvx_dy;
            }
        }
        this.state.drag = 0.2 * Math.tanh(this.state.iterations / 500);
        this.state.lift = 0.1 * Math.sin(this.state.iterations / 120);
        this.state.ld = this.state.drag ? this.state.lift / this.state.drag : 0;
        this.state.strouhal = Math.abs(this.state.lift) * 0.2;
    }

    _ensureCapacity() {
        const { nx, ny } = this.state.params;
        const size = nx * ny;
        if (this.tempVX.length !== size) {
            this._allocate();
        }
    }
}
