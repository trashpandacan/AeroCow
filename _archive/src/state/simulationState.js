const D2Q9 = {
    cx: [0, 1, 0, -1, 0, 1, -1, -1, 1],
    cy: [0, 0, 1, 0, -1, 1, 1, -1, -1],
    cz: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    w: [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36],
};

const D3Q19 = {
    cx: [
        0, 1, -1, 0, 0, 0, 0,
        1, -1, 1, -1, 1, -1,
        0, 0, 0, 0, 1, -1,
    ],
    cy: [
        0, 0, 0, 1, -1, 0, 0,
        1, -1, -1, 1, 0, 0,
        1, -1, 0, 0, 0, 0,
    ],
    cz: [
        0, 0, 0, 0, 0, 1, -1,
        0, 0, 0, 0, 1, -1,
        -1, 1, 1, -1, 0, 0,
    ],
    w: [
        1 / 3,
        1 / 18, 1 / 18, 1 / 18, 1 / 18, 1 / 18, 1 / 18,
        1 / 36, 1 / 36, 1 / 36, 1 / 36, 1 / 36, 1 / 36,
        1 / 36, 1 / 36, 1 / 36, 1 / 36, 1 / 36, 1 / 36,
    ],
};

const DEFAULTS = {
    dimension: '2d',
    solver: 'lbm2d',
    nx: 256,
    ny: 128,
    nz: 64,
    dx: 1.0,
    dt: 0.01,
    mach: 0.15,
    reynolds: 5000,
    viscosity: 0.02,
    density0: 1.0,
};

export class SimulationState {
    constructor() {
        this.params = { ...DEFAULTS };
        this.iterations = 0;
        this.isPaused = false;
        this.visualLayers = {
            velocity: true,
            pressure: false,
            vorticity: true,
            stream: false,
            iso: false,
            windTunnel: true,
        };
        this.geometry = {
            type: 'airfoil',
            angle: 0,
            customMesh: null,
            customBounds: null,
            presetId: null,
        };
        this.fields2d = this._create2DFields();
        this.fields3d = this._create3DFields();
        this.drag = 0;
        this.lift = 0;
        this.ld = 0;
        this.strouhal = 0;
    }

    setDimension(dimension) {
        if (dimension !== '2d' && dimension !== '3d') {
            return;
        }
        this.params.dimension = dimension;
        this.resizeGrid(this.params.nx, this.params.ny, this.params.nz);
    }

    setSolver(solver) {
        this.params.solver = solver;
    }

    resizeGrid(nx, ny, nz = this.params.nz) {
        this.params.nx = nx;
        this.params.ny = ny;
        this.params.nz = nz;
        this.fields2d = this._create2DFields();
        this.fields3d = this._create3DFields();
        this.iterations = 0;
    }

    updateParams(partial) {
        Object.assign(this.params, partial);
    }

    updateGeometry(partial) {
        Object.assign(this.geometry, partial);
        if (partial.type && partial.type !== 'custom') {
            this.geometry.customMesh = null;
            this.geometry.customBounds = null;
            this.geometry.presetId = null;
        }
        if ('presetId' in partial && partial.presetId === null) {
            this.geometry.presetId = null;
        }
    }

    toggleLayer(key, value) {
        if (key in this.visualLayers) {
            this.visualLayers[key] = value;
        }
    }

    setPaused(flag) {
        this.isPaused = flag;
    }

    get activeFields() {
        return this.params.dimension === '3d' ? this.fields3d : this.fields2d;
    }

    resetFields() {
        this.fields2d = this._create2DFields();
        this.fields3d = this._create3DFields();
        this.iterations = 0;
        this.drag = 0;
        this.lift = 0;
        this.ld = 0;
        this.strouhal = 0;
    }

    _create2DFields() {
        const { nx, ny, mach } = this.params;
        const cellCount = nx * ny;
        const fields = {
            velocityX: new Float32Array(cellCount),
            velocityY: new Float32Array(cellCount),
            pressure: new Float32Array(cellCount),
            vorticity: new Float32Array(cellCount),
            density: new Float32Array(cellCount),
            obstacle: new Uint8Array(cellCount),
            streamMask: new Float32Array(cellCount),
            lbmDistribution: new Float32Array(cellCount * 9),
        };

        const cs = 1 / Math.sqrt(3);
        const u0 = mach * cs;
        for (let i = 0; i < cellCount; i++) {
            fields.velocityX[i] = u0;
            fields.velocityY[i] = 0;
            fields.pressure[i] = 1;
            fields.density[i] = 1;
            fields.vorticity[i] = 0;
        }
        this._initializeLBMDistribution(fields, D2Q9);
        return fields;
    }

    _create3DFields() {
        const { nx, ny, nz, mach } = this.params;
        const cellCount = nx * ny * nz;
        const fields = {
            velocityX: new Float32Array(cellCount),
            velocityY: new Float32Array(cellCount),
            velocityZ: new Float32Array(cellCount),
            pressure: new Float32Array(cellCount),
            vorticity: new Float32Array(cellCount),
            density: new Float32Array(cellCount),
            obstacle: new Uint8Array(cellCount),
            lbmDistribution: new Float32Array(cellCount * 19),
        };

        const cs = 1 / Math.sqrt(3);
        const u0 = mach * cs;
        for (let i = 0; i < cellCount; i++) {
            fields.velocityX[i] = u0;
            fields.velocityY[i] = 0;
            fields.velocityZ[i] = 0;
            fields.pressure[i] = 1;
            fields.density[i] = 1;
            fields.vorticity[i] = 0;
        }
        this._initializeLBMDistribution(fields, D3Q19);
        return fields;
    }

    _initializeLBMDistribution(fields, model) {
        const { lbmDistribution } = fields;
        if (!lbmDistribution) return;
        const q = model.w.length;
        const cellCount = fields.density.length;
        for (let idx = 0; idx < cellCount; idx++) {
            const ux = fields.velocityX[idx] || 0;
            const uy = fields.velocityY ? fields.velocityY[idx] || 0 : 0;
            const uz = fields.velocityZ ? fields.velocityZ[idx] || 0 : 0;
            const rho = fields.density[idx] || 1;
            const u2 = ux * ux + uy * uy + uz * uz;
            for (let k = 0; k < q; k++) {
                const cu = 3 * (model.cx[k] * ux + model.cy[k] * uy + model.cz[k] * uz);
                lbmDistribution[idx * q + k] = model.w[k] * rho * (1 + cu + 0.5 * cu * cu - 1.5 * u2);
            }
        }
    }
}
