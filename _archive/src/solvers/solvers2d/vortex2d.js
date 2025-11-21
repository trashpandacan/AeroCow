export class VortexLattice2D {
    constructor(state) {
        this.state = state;
        const { nx, ny } = state.params;
        this.gammaField = new Float32Array(nx * ny);
    }

    step() {
        if (this.state.params.dimension !== '2d') {
            return;
        }
        this._ensureCapacity();

        const { nx, ny, mach } = this.state.params;
        const { velocityX, velocityY, vorticity, obstacle } = this.state.fields2d;

        // Shed a vortex sheet near trailing edge
        const teY = Math.floor(ny * 0.5);
        for (let i = 2; i < nx - 2; i++) {
            const idx = teY * nx + i;
            const gamma = Math.sin((this.state.iterations * 0.05 + i * 0.01));
            this.gammaField[idx] = 0.95 * this.gammaField[idx] + 0.05 * gamma;
        }

        // Induce velocity from gammaField using Biot-Savart approximation
        for (let j = 2; j < ny - 2; j++) {
            for (let i = 2; i < nx - 2; i++) {
                const idx = j * nx + i;
                if (obstacle[idx]) {
                    velocityX[idx] = 0;
                    velocityY[idx] = 0;
                    continue;
                }

                let u = mach * 0.7;
                let v = 0;
                for (let y = teY - 12; y <= teY + 12; y++) {
                    const gammaIdx = y * nx + i;
                    const dy = (j - y) || 0.5;
                    const strength = this.gammaField[gammaIdx];
                    v += strength / (dy * Math.PI * 4);
                }
                velocityX[idx] = u;
                velocityY[idx] = v;
                vorticity[idx] = v * 0.6;
            }
        }

        this.state.drag = 0.01 + 0.02 * Math.abs(Math.sin(this.state.iterations / 80));
        this.state.lift = 0.6 * Math.sin(this.state.iterations / 100);
        this.state.ld = this.state.drag ? this.state.lift / this.state.drag : 0;
        this.state.strouhal = 0.2;
        this.state.iterations += 1;
    }

    _ensureCapacity() {
        const { nx, ny } = this.state.params;
        const size = nx * ny;
        if (this.gammaField.length !== size) {
            this.gammaField = new Float32Array(size);
        }
    }
}
