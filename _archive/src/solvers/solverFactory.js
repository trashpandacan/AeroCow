import { LBMSolver2D } from './solvers2d/lbm2d.js';
import { NavierStokes2D } from './solvers2d/navier2d.js';
import { PotentialFlow2D } from './solvers2d/potential2d.js';
import { VortexLattice2D } from './solvers2d/vortex2d.js';
import { LBMSolver3D } from './solvers3d/lbm3d.js';
import { EulerSolver3D } from './solvers3d/euler3d.js';

export function createSolver(key, state) {
    switch (key) {
        case 'lbm2d':
            return new LBMSolver2D(state);
        case 'ns2d':
            return new NavierStokes2D(state);
        case 'potential2d':
            return new PotentialFlow2D(state);
        case 'vortex2d':
            return new VortexLattice2D(state);
        case 'lbm3d':
            return new LBMSolver3D(state);
        case 'euler3d':
            return new EulerSolver3D(state);
        default:
            return new LBMSolver2D(state);
    }
}
