import * as THREE from 'https://esm.sh/three@0.160.0';

export class ThreeRenderer {
    constructor(container, state) {
        this.container = container;
        this.state = state;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#05070f');
        this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
        this.camera.position.set(120, 80, 120);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        const light = new THREE.DirectionalLight(0xffffff, 0.8);
        light.position.set(50, 120, 100);
        this.scene.add(light);
        this.scene.add(new THREE.AmbientLight(0x224466));

        this.pointCloud = null;
        this.isoMaterial = new THREE.PointsMaterial({
            size: 2,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
        });

        this._setupInteraction();
        window.addEventListener('resize', () => this.resize());
        this.resize();
    }

    resize() {
        const rect = this.container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            return;
        }
        this.renderer.setSize(rect.width, rect.height);
        this.camera.aspect = rect.width / rect.height;
        this.camera.updateProjectionMatrix();
    }

    updateVolume() {
        if (this.state.params.dimension !== '3d') {
            if (this.pointCloud) {
                this.pointCloud.visible = false;
            }
            return;
        }

        this.isoMaterial.opacity = this.state.visualLayers.iso ? 0.9 : 0.4;

        const { nx, ny, nz } = this.state.params;
        const fields = this.state.fields3d;
        const positions = [];
        const colors = [];
        const stride = Math.max(1, Math.floor(nx / 40));
        const invNx = 1 / nx;
        const invNy = 1 / ny;
        const invNz = 1 / nz;

        for (let z = 2; z < nz - 2; z += stride) {
            for (let y = 2; y < ny - 2; y += stride) {
                for (let x = 2; x < nx - 2; x += stride) {
                    const idx = z * nx * ny + y * nx + x;
                    if (fields.obstacle[idx]) continue;

                    let r = 0, g = 0, b = 0;

                    // Check if we are in Schlieren mode (using Pressure/Density gradient)
                    // We can reuse 'layerPressure' or add a specific toggle.
                    // For now, let's use layerPressure to show Density Gradient in 3D if Euler solver is active
                    // Or just check if density varies significantly.

                    const isEuler = this.state.params.solver === 'euler3d';

                    if (isEuler && this.state.visualLayers.pressure) {
                        // Schlieren: Magnitude of Density Gradient
                        // |grad(rho)|
                        const rho = fields.density[idx];
                        const rho_x = fields.density[idx + 1];
                        const rho_y = fields.density[idx + nx];
                        const rho_z = fields.density[idx + nx * ny];

                        const dx = (rho_x - rho);
                        const dy = (rho_y - rho);
                        const dz = (rho_z - rho);
                        const grad = Math.sqrt(dx * dx + dy * dy + dz * dz) * 10; // Scale for visibility

                        // Grayscale or "Hot" colormap for shocks
                        const val = Math.min(1, grad);
                        r = val;
                        g = val;
                        b = val;

                        // Make transparent if no gradient
                        if (val < 0.05) continue;

                    } else {
                        // Standard Velocity Magnitude
                        const vx = fields.velocityX[idx];
                        const vy = fields.velocityY[idx];
                        const vz = fields.velocityZ[idx];
                        const vel = Math.sqrt(vx * vx + vy * vy + vz * vz);
                        const color = new THREE.Color().setHSL(0.6 - vel * 0.5, 0.8, 0.5);
                        r = color.r;
                        g = color.g;
                        b = color.b;
                    }

                    positions.push(
                        (x * invNx - 0.5) * nx,
                        (y * invNy - 0.5) * ny,
                        (z * invNz - 0.5) * nz
                    );
                    colors.push(r, g, b);
                }
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        if (this.pointCloud) {
            this.scene.remove(this.pointCloud);
            this.pointCloud.geometry.dispose();
        }

        this.pointCloud = new THREE.Points(geometry, this.isoMaterial);
        this.scene.add(this.pointCloud);
    }

    render() {
        if (!this.container.classList.contains('hidden')) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    _setupInteraction() {
        this.isDragging = false;
        this.azimuth = Math.PI / 4;
        this.polar = Math.PI / 3;
        this.distance = 160;
        let lastX = 0;
        let lastY = 0;

        const onPointerDown = (event) => {
            this.isDragging = true;
            lastX = event.clientX;
            lastY = event.clientY;
        };

        const onPointerMove = (event) => {
            if (!this.isDragging) return;
            const dx = event.clientX - lastX;
            const dy = event.clientY - lastY;
            lastX = event.clientX;
            lastY = event.clientY;
            this.azimuth -= dx * 0.005;
            this.polar = clamp(this.polar - dy * 0.005, 0.2, Math.PI - 0.2);
            this._updateCamera();
        };

        const onPointerUp = () => {
            this.isDragging = false;
        };

        const onWheel = (event) => {
            this.distance = clamp(this.distance + event.deltaY * 0.2, 40, 400);
            this._updateCamera();
        };

        this.container.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        this.container.addEventListener('wheel', onWheel);

        this._updateCamera();
    }

    _updateCamera() {
        const x = this.distance * Math.sin(this.polar) * Math.cos(this.azimuth);
        const z = this.distance * Math.sin(this.polar) * Math.sin(this.azimuth);
        const y = this.distance * Math.cos(this.polar);
        this.camera.position.set(x, y, z);
        this.camera.lookAt(0, 0, 0);
    }
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}
