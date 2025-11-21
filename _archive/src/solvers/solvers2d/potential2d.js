export class PotentialFlow2D {
    constructor(state) {
        this.state = state;
        const { nx, ny } = state.params;
        this.potential = new Float32Array(nx * ny);
        this.iterations = 40;
    }

    step() {
        if (this.state.params.dimension !== '2d') {
            return;
        }
        this._ensureCapacity();

        const { nx, ny, mach } = this.state.params;
        const { velocityX, velocityY, pressure, obstacle } = this.state.fields2d;
        const phi = this.potential;

        for (let it = 0; it < this.iterations; it++) {
            for (let j = 1; j < ny - 1; j++) {
                for (let i = 1; i < nx - 1; i++) {
                    const idx = j * nx + i;
                    if (obstacle[idx]) {
                        phi[idx] = 0;
                        continue;
                    }
                    phi[idx] =
                        0.25 *
                        (phi[idx - 1] + phi[idx + 1] + phi[idx - nx] + phi[idx + nx]);
                }
            }
        }

        for (let j = 1; j < ny - 1; j++) {
            for (let i = 1; i < nx - 1; i++) {
                const idx = j * nx + i;
                velocityX[idx] = (phi[idx + 1] - phi[idx - 1]) * 0.5 + mach * 0.4;
                velocityY[idx] = (phi[idx + nx] - phi[idx - nx]) * 0.5;
                pressure[idx] = 1 - 0.5 * (velocityX[idx] * velocityX[idx] + velocityY[idx] * velocityY[idx]);
            }
        }

        this._estimateForces();
        this.state.iterations += 1;
    }

    _estimateForces() {
        const { fields2d, params } = this.state;
        const { pressure, obstacle } = fields2d;
        const { nx, ny } = params;
        let drag = 0;
        let lift = 0;
        let area = 0;

        for (let j = 1; j < ny - 1; j++) {
            for (let i = 1; i < nx - 1; i++) {
                const idx = j * nx + i;
                if (!obstacle[idx]) continue;
                area += 1;
                drag += pressure[j * nx + (i + 1)] - pressure[j * nx + (i - 1)];
                lift += pressure[(j + 1) * nx + i] - pressure[(j - 1) * nx + i];
            }
        }

        const norm = Math.max(area, 1);
        this.state.drag = drag / norm;
        this.state.lift = lift / norm;
        this.state.ld = this.state.drag ? this.state.lift / this.state.drag : 0;
        this.state.strouhal = 0;
    }

    _ensureCapacity() {
        const { nx, ny } = this.state.params;
        const size = nx * ny;
        if (this.potential.length !== size) {
            this.potential = new Float32Array(size);
        }
    }
}
