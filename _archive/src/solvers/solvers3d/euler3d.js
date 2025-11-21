import { build3DObstacle } from '../../state/geometryBuilder.js';

export class EulerSolver3D {
    constructor(state) {
        this.state = state;
        this.gamma = 1.4;
        this.cfl = 0.5; // Courant number
        
        // We need an extra buffer for the next time step state
        // U_new = U_old - dt * Fluxes
        // We have 5 variables: rho, rhou, rhov, rhow, E
        // We can reuse lbmDistribution to store the "New" state and "Energy"
        // lbmDistribution is nx*ny*nz*19. We have plenty of room.
        // Mapping:
        // 0: Energy (current)
        // 1: New Density
        // 2: New Momentum X
        // 3: New Momentum Y
        // 4: New Momentum Z
        // 5: New Energy
        
        this.rebuildObstacle();
        this.initialize();
    }

    rebuildObstacle() {
        build3DObstacle(this.state);
    }

    initialize() {
        const { params, fields3d } = this.state;
        const { nx, ny, nz, mach } = params;
        const { density, velocityX, velocityY, velocityZ, pressure, lbmDistribution } = fields3d;
        
        // Initialize uniform flow
        const rho0 = 1.0;
        const p0 = 1.0 / this.gamma; // Normalized so speed of sound c = 1 at T=1? 
        // Actually, let's set c_inf = 1.
        // p = rho * T / gamma. If T=1, rho=1, then p = 1/gamma.
        // c = sqrt(gamma * p / rho) = sqrt(gamma * (1/gamma) / 1) = 1.
        
        const u0 = mach; // Since c=1
        const v0 = 0;
        const w0 = 0;
        const E0 = p0 / (this.gamma - 1) + 0.5 * rho0 * (u0*u0 + v0*v0 + w0*w0);

        for (let i = 0; i < nx * ny * nz; i++) {
            density[i] = rho0;
            velocityX[i] = u0;
            velocityY[i] = v0;
            velocityZ[i] = w0;
            pressure[i] = p0;
            lbmDistribution[i * 19 + 0] = E0; // Store Energy in slot 0
        }
    }

    step(dt) {
        if (this.state.params.dimension !== '3d') return;

        // 1. Calculate Time Step (Stability)
        // dt = CFL * dx / (|u| + c)
        // Assuming dx = 1
        const maxSpeed = this.getMaxWaveSpeed();
        const timeStep = this.cfl / (maxSpeed + 1e-6);

        // 2. Update
        this._update(timeStep);
        
        // 3. Update derived fields (Pressure, Vorticity, Forces)
        this._updateDerived();
        
        this.state.iterations++;
    }

    getMaxWaveSpeed() {
        const { density, velocityX, velocityY, velocityZ, pressure } = this.state.fields3d;
        const len = density.length;
        let maxS = 0;
        for (let i = 0; i < len; i += 100) { // Sample for speed
             const u = velocityX[i];
             const v = velocityY[i];
             const w = velocityZ[i];
             const p = pressure[i];
             const rho = density[i];
             const c = Math.sqrt(this.gamma * p / rho);
             const q = Math.sqrt(u*u + v*v + w*w);
             if (q + c > maxS) maxS = q + c;
        }
        return maxS;
    }

    _update(dt) {
        const { params, fields3d } = this.state;
        const { nx, ny, nz } = params;
        const { density, velocityX, velocityY, velocityZ, pressure, obstacle, lbmDistribution } = fields3d;
        
        const slice = nx * ny;
        
        // Helper for indexing
        // We use a simplified Lax-Friedrichs or Rusanov flux for stability
        // U_new[i] = 0.5*(U[i+1]+U[i-1]) - 0.5*dt/dx * (F[i+1] - F[i-1])
        // But in 3D.
        // Let's use a first-order upwind or Lax-Friedrichs for simplicity and robustness with shocks.
        // Standard Lax-Friedrichs:
        // U_new = (Avg neighbors) - dt/2dx * (Flux diffs)
        // This is very dissipative but stable for shocks.
        
        // Pointers to "New" state in lbmDistribution
        // 1: New Rho, 2: New MomX, 3: New MomY, 4: New MomZ, 5: New E
        
        for (let z = 1; z < nz - 1; z++) {
            for (let y = 1; y < ny - 1; y++) {
                for (let x = 1; x < nx - 1; x++) {
                    const idx = z * slice + y * nx + x;
                    if (obstacle[idx]) continue;

                    // Current State
                    const rho = density[idx];
                    const u = velocityX[idx];
                    const v = velocityY[idx];
                    const w = velocityZ[idx];
                    const E = lbmDistribution[idx * 19 + 0];
                    const p = pressure[idx];

                    // Flux calculation is expensive. 
                    // Let's do a gathered loop or just compute on the fly.
                    // For performance in JS, minimizing object creation is key.
                    
                    // We need neighbors
                    const idx_xp = idx + 1; const idx_xm = idx - 1;
                    const idx_yp = idx + nx; const idx_ym = idx - nx;
                    const idx_zp = idx + slice; const idx_zm = idx - slice;

                    // Compute Flux Divergence
                    // dF/dx + dG/dy + dH/dz
                    // Using central difference for flux: (F(i+1) - F(i-1)) / 2dx
                    // Plus artificial dissipation (Lax-Friedrichs part)
                    // Dissipation: epsilon * (U(i+1) - 2U(i) + U(i-1))
                    
                    // Let's implement standard Lax-Friedrichs step:
                    // U_new = (U_xp + U_xm + U_yp + U_ym + U_zp + U_zm) / 6 
                    //         - dt/(2*dx) * (F_xp - F_xm + G_yp - G_ym + H_zp - H_zm)
                    
                    // 1. Average State (Lax Mean)
                    // This is extremely diffusive. Maybe too much.
                    // Let's try MacCormack? No, oscillations near shocks.
                    // Let's stick to Lax-Friedrichs for "Bulletproof" shock capturing first.
                    
                    // Conserved Variables at neighbors
                    // We need to reconstruct U from primitives at neighbors
                    
                    let netFluxRho = 0;
                    let netFluxMomX = 0;
                    let netFluxMomY = 0;
                    let netFluxMomZ = 0;
                    let netFluxE = 0;
                    
                    // X-Direction Fluxes
                    // F = [rho*u, rho*u^2+p, rho*u*v, rho*u*w, (E+p)*u]
                    const getF = (i) => {
                        const r = density[i]; const ux = velocityX[i]; const uy = velocityY[i]; const uz = velocityZ[i]; const pr = pressure[i]; const en = lbmDistribution[i*19+0];
                        return [r*ux, r*ux*ux+pr, r*ux*uy, r*ux*uz, (en+pr)*ux];
                    };
                    
                    const F_xp = getF(idx_xp);
                    const F_xm = getF(idx_xm);
                    
                    netFluxRho += (F_xp[0] - F_xm[0]);
                    netFluxMomX += (F_xp[1] - F_xm[1]);
                    netFluxMomY += (F_xp[2] - F_xm[2]);
                    netFluxMomZ += (F_xp[3] - F_xm[3]);
                    netFluxE += (F_xp[4] - F_xm[4]);

                    // Y-Direction Fluxes
                    // G = [rho*v, rho*v*u, rho*v^2+p, rho*v*w, (E+p)*v]
                    const getG = (i) => {
                        const r = density[i]; const ux = velocityX[i]; const uy = velocityY[i]; const uz = velocityZ[i]; const pr = pressure[i]; const en = lbmDistribution[i*19+0];
                        return [r*uy, r*uy*ux, r*uy*uy+pr, r*uy*uz, (en+pr)*uy];
                    };

                    const G_yp = getG(idx_yp);
                    const G_ym = getG(idx_ym);
                    
                    netFluxRho += (G_yp[0] - G_ym[0]);
                    netFluxMomX += (G_yp[1] - G_ym[1]);
                    netFluxMomY += (G_yp[2] - G_ym[2]);
                    netFluxMomZ += (G_yp[3] - G_ym[3]);
                    netFluxE += (G_yp[4] - G_ym[4]);

                    // Z-Direction Fluxes
                    // H = [rho*w, rho*w*u, rho*w*v, rho*w^2+p, (E+p)*w]
                    const getH = (i) => {
                        const r = density[i]; const ux = velocityX[i]; const uy = velocityY[i]; const uz = velocityZ[i]; const pr = pressure[i]; const en = lbmDistribution[i*19+0];
                        return [r*uz, r*uz*ux, r*uz*uy, r*uz*uz+pr, (en+pr)*uz];
                    };

                    const H_zp = getH(idx_zp);
                    const H_zm = getH(idx_zm);
                    
                    netFluxRho += (H_zp[0] - H_zm[0]);
                    netFluxMomX += (H_zp[1] - H_zm[1]);
                    netFluxMomY += (H_zp[2] - H_zm[2]);
                    netFluxMomZ += (H_zp[3] - H_zm[3]);
                    netFluxE += (H_zp[4] - H_zm[4]);

                    // Lax Average (Dissipation)
                    // U_avg = (U_xp + U_xm + U_yp + U_ym + U_zp + U_zm) / 6
                    // This is very diffusive.
                    // Alternative: U_new = U_old - dt/2dx * FluxDiff + Dissipation
                    // Dissipation = alpha * (U_xp - 2U + U_xm + ...)
                    
                    // Let's use a simple central difference + artificial viscosity
                    // U_new = U - dt/2dx * (FluxDiff) + visc * (Laplacian U)
                    
                    const visc = 0.1; // Artificial viscosity coefficient
                    
                    const getU = (i) => {
                        const r = density[i]; const ux = velocityX[i]; const uy = velocityY[i]; const uz = velocityZ[i]; const en = lbmDistribution[i*19+0];
                        return [r, r*ux, r*uy, r*uz, en];
                    };
                    
                    const U = getU(idx);
                    const U_xp = getU(idx_xp); const U_xm = getU(idx_xm);
                    const U_yp = getU(idx_yp); const U_ym = getU(idx_ym);
                    const U_zp = getU(idx_zp); const U_zm = getU(idx_zm);
                    
                    const lapRho = (U_xp[0] + U_xm[0] + U_yp[0] + U_ym[0] + U_zp[0] + U_zm[0] - 6*U[0]);
                    const lapMomX = (U_xp[1] + U_xm[1] + U_yp[1] + U_ym[1] + U_zp[1] + U_zm[1] - 6*U[1]);
                    const lapMomY = (U_xp[2] + U_xm[2] + U_yp[2] + U_ym[2] + U_zp[2] + U_zm[2] - 6*U[2]);
                    const lapMomZ = (U_xp[3] + U_xm[3] + U_yp[3] + U_ym[3] + U_zp[3] + U_zm[3] - 6*U[3]);
                    const lapE = (U_xp[4] + U_xm[4] + U_yp[4] + U_ym[4] + U_zp[4] + U_zm[4] - 6*U[4]);

                    // Update
                    const base = idx * 19;
                    lbmDistribution[base + 1] = U[0] - 0.5 * dt * netFluxRho + visc * lapRho;
                    lbmDistribution[base + 2] = U[1] - 0.5 * dt * netFluxMomX + visc * lapMomX;
                    lbmDistribution[base + 3] = U[2] - 0.5 * dt * netFluxMomY + visc * lapMomY;
                    lbmDistribution[base + 4] = U[3] - 0.5 * dt * netFluxMomZ + visc * lapMomZ;
                    lbmDistribution[base + 5] = U[4] - 0.5 * dt * netFluxE + visc * lapE;
                }
            }
        }

        // Write back to primary fields
        for (let z = 1; z < nz - 1; z++) {
            for (let y = 1; y < ny - 1; y++) {
                for (let x = 1; x < nx - 1; x++) {
                    const idx = z * slice + y * nx + x;
                    if (obstacle[idx]) continue;
                    
                    const base = idx * 19;
                    const newRho = lbmDistribution[base + 1];
                    const newMomX = lbmDistribution[base + 2];
                    const newMomY = lbmDistribution[base + 3];
                    const newMomZ = lbmDistribution[base + 4];
                    const newE = lbmDistribution[base + 5];
                    
                    density[idx] = newRho;
                    velocityX[idx] = newMomX / newRho;
                    velocityY[idx] = newMomY / newRho;
                    velocityZ[idx] = newMomZ / newRho;
                    lbmDistribution[base + 0] = newE;
                    
                    // Update Pressure
                    // p = (gamma - 1) * (E - 0.5 * rho * u^2)
                    const v2 = (velocityX[idx]**2 + velocityY[idx]**2 + velocityZ[idx]**2);
                    pressure[idx] = (this.gamma - 1) * (newE - 0.5 * newRho * v2);
                }
            }
        }
        
        // Apply Boundaries (Inlet/Outlet)
        this._applyBoundaries();
    }
    
    _applyBoundaries() {
        const { params, fields3d } = this.state;
        const { nx, ny, nz, mach } = params;
        const { density, velocityX, velocityY, velocityZ, pressure, lbmDistribution } = fields3d;
        
        // Inlet (x=0): Supersonic inflow -> Fixed Dirichlet
        const rho0 = 1.0;
        const p0 = 1.0 / this.gamma;
        const u0 = mach;
        const E0 = p0 / (this.gamma - 1) + 0.5 * rho0 * u0 * u0;
        
        for (let z = 0; z < nz; z++) {
            for (let y = 0; y < ny; y++) {
                const idx = z * nx * ny + y * nx;
                density[idx] = rho0;
                velocityX[idx] = u0;
                velocityY[idx] = 0;
                velocityZ[idx] = 0;
                pressure[idx] = p0;
                lbmDistribution[idx * 19 + 0] = E0;
            }
        }
        
        // Outlet (x=nx-1): Supersonic outflow -> Zero gradient (Neumann)
        for (let z = 0; z < nz; z++) {
            for (let y = 0; y < ny; y++) {
                const idx = z * nx * ny + y * nx + (nx - 1);
                const prev = idx - 1;
                density[idx] = density[prev];
                velocityX[idx] = velocityX[prev];
                velocityY[idx] = velocityY[prev];
                velocityZ[idx] = velocityZ[prev];
                pressure[idx] = pressure[prev];
                lbmDistribution[idx * 19 + 0] = lbmDistribution[prev * 19 + 0];
            }
        }
    }

    _updateDerived() {
        // Calculate Vorticity for visualization
        // Reuse the LBM vorticity calc logic or similar
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
        
        // Estimate Drag/Lift (Pressure integration)
        // F = sum(p * n)
        // Simplified: just sum pressure on obstacle boundary
        // TODO: Implement proper force integration if needed.
        // For now, just zero them or keep previous to avoid NaN
        this.state.drag = 0;
        this.state.lift = 0;
    }
}
