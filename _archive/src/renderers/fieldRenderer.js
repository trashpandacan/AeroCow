export class FieldRenderer {
    constructor(canvas, state) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.state = state;
        this.offscreen = document.createElement('canvas');
        this.offCtx = this.offscreen.getContext('2d');
        this.particles = this._createParticles();
        this.windTrails = this._createWindTrails();
        this.overlayTime = 0;
        this.lastOverlayUpdate = performance.now();
        this.resize();
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.windTrails = this._createWindTrails();
    }

    draw() {
        const { params, visualLayers } = this.state;
        const now = performance.now();
        const delta = Math.min((now - this.lastOverlayUpdate) / 1000, 0.1);
        this.overlayTime += delta;
        this.lastOverlayUpdate = now;
        if (params.dimension !== '2d') {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            return;
        }

        const { nx, ny } = params;
        const fields = this.state.fields2d;

        if (this.offscreen.width !== nx || this.offscreen.height !== ny) {
            this.offscreen.width = nx;
            this.offscreen.height = ny;
        }

        const imageData = this.offCtx.createImageData(nx, ny);
        const pixels = imageData.data;

        for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
                const idx = j * nx + i;
                const color = this._sampleColor(idx, visualLayers, fields);
                const di = ((ny - 1 - j) * nx + i) * 4;
                pixels[di] = color[0];
                pixels[di + 1] = color[1];
                pixels[di + 2] = color[2];
                pixels[di + 3] = color[3];
            }
        }

        this.offCtx.putImageData(imageData, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.offscreen, 0, 0, this.canvas.width, this.canvas.height);

        if (visualLayers.stream) {
            this._drawParticles();
        }
        if (visualLayers.windTunnel) {
            this._drawWindTunnelOverlay(delta);
        }
    }

    _sampleColor(idx, layers, fields) {
        const { velocityX, velocityY, pressure, vorticity, obstacle } = fields;

        if (obstacle[idx]) {
            return [10, 15, 25, 255];
        }

        const velMag = Math.sqrt(velocityX[idx] * velocityX[idx] + velocityY[idx] * velocityY[idx]);
        const velNorm = Math.min(velMag * 4, 1);
        const pressureNorm = Math.min(Math.max((pressure[idx] - 0.5) * 1.5, 0), 1);
        const vort = Math.min(Math.abs(vorticity[idx]) * 3, 1);

        let r = 12, g = 18, b = 26;
        if (layers.velocity) {
            r += 80 * velNorm;
            g += 160 * velNorm;
            b += 250 * velNorm;
        }
        if (layers.pressure) {
            r = r * 0.6 + 255 * pressureNorm;
            g = g * 0.6 + 80 * (1 - pressureNorm);
        }
        if (layers.vorticity) {
            r += 120 * vort;
            b += 60 * vort;
        }
        return [Math.min(r, 255), Math.min(g, 255), Math.min(b, 255), 255];
    }

    _createParticles(count = 200) {
        return Array.from({ length: count }, () => ({
            x: Math.random(),
            y: Math.random(),
            life: Math.random(),
        }));
    }

    _drawParticles() {
        const { nx, ny } = this.state.params;
        const { velocityX, velocityY } = this.state.fields2d;

        this.ctx.save();
        this.ctx.lineWidth = 1.2;
        this.ctx.strokeStyle = 'rgba(255,255,255,0.3)';

        for (const particle of this.particles) {
            const gridX = clamp(Math.floor(particle.x * nx), 0, nx - 1);
            const gridY = clamp(Math.floor(particle.y * ny), 0, ny - 1);
            const idx = gridY * nx + gridX;
            const vx = velocityX[idx];
            const vy = velocityY[idx];
            const px = particle.x * this.canvas.width;
            const py = (1 - particle.y) * this.canvas.height;
            const newX = particle.x + vx * 0.002;
            const newY = particle.y + vy * 0.002;

            this.ctx.beginPath();
            this.ctx.moveTo(px, py);
            this.ctx.lineTo(px + vx * 12, py - vy * 12);
            this.ctx.stroke();

            particle.x = newX;
            particle.y = newY;
            particle.life -= 0.01;
            if (particle.life <= 0 || newX < 0 || newX > 1 || newY < 0 || newY > 1) {
                particle.x = Math.random() * 0.2;
                particle.y = Math.random();
                particle.life = 1;
            }
        }

        this.ctx.restore();
    }

    _createWindTrails(count = 28) {
        return Array.from({ length: count }, (_, index) => ({
            x: Math.random() * 1.2 - 0.2,
            baseY: (index + Math.random() * 0.4) / count,
            speed: 0.08 + Math.random() * 0.12,
            amplitude: 0.01 + Math.random() * 0.02,
            curve: 0.2 + Math.random() * 0.4,
            scale: 0.35 + Math.random() * 0.4,
            phase: Math.random() * Math.PI * 2,
            tint: 0.85 + Math.random() * 0.3,
        }));
    }

    _drawWindTunnelOverlay(delta) {
        if (!this.windTrails || this.windTrails.length === 0) {
            this.windTrails = this._createWindTrails();
        }
        const width = this.canvas.width;
        const height = this.canvas.height;

        this.ctx.save();
        this.ctx.lineWidth = 1.4;
        this.ctx.globalCompositeOperation = 'screen';
        this.ctx.shadowBlur = 12;

        for (const trail of this.windTrails) {
            const startX = trail.x * width;
            const length = width * trail.scale;
            const amplitudePx = trail.amplitude * height;
            const wave = Math.sin(this.overlayTime * 2 + trail.phase) * amplitudePx;
            const startY = clamp(trail.baseY * height + wave, 0, height);
            const ctrlY = startY + Math.sin(this.overlayTime * 3 + trail.phase * 1.3) * amplitudePx * 0.6;
            const endY = startY + Math.cos(this.overlayTime * 2.4 + trail.phase) * amplitudePx * trail.curve;

            const colorStrength = Math.min(1, 0.5 + trail.tint * 0.5);
            const r = Math.floor(100 + 80 * colorStrength);
            const g = Math.floor(200 + 40 * colorStrength);
            const b = 255;
            this.ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.28)`;
            this.ctx.shadowColor = `rgba(0, 180, 255, 0.25)`;

            this.ctx.beginPath();
            this.ctx.moveTo(startX, startY);
            this.ctx.quadraticCurveTo(startX + length * 0.4, ctrlY, startX + length, endY);
            this.ctx.stroke();

            trail.x += trail.speed * delta;
            if (startX > width + length * 0.25) {
                this._reseedTrail(trail);
            }
        }
        this.ctx.restore();
    }

    _reseedTrail(trail) {
        trail.x = -0.25;
        trail.baseY = Math.random();
        trail.speed = 0.08 + Math.random() * 0.12;
        trail.amplitude = 0.01 + Math.random() * 0.02;
        trail.curve = 0.2 + Math.random() * 0.4;
        trail.scale = 0.35 + Math.random() * 0.4;
        trail.phase = Math.random() * Math.PI * 2;
        trail.tint = 0.85 + Math.random() * 0.3;
    }
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
