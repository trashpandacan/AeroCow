export class ControlPanel extends EventTarget {
    constructor(state) {
        super();
        this.state = state;
        this._queryElements();
        this._bindEvents();
        this._updateReadouts();
    }

    _queryElements() {
        this.dimensionSelect = document.getElementById('dimensionSelect');
        this.solverSelect = document.getElementById('solverSelect');
        this.gridResolution = document.getElementById('gridResolution');
        this.depthResolution = document.getElementById('depthResolution');
        this.resolutionValue = document.getElementById('resolutionValue');
        this.depthValue = document.getElementById('depthValue');
        this.objectSelect = document.getElementById('objectSelect');
        this.meshPreset = document.getElementById('meshPreset');
        this.uploadButton = document.getElementById('uploadGeometry');
        this.angleSlider = document.getElementById('angleSlider');
        this.angleValue = document.getElementById('angleValue');
        this.reynoldsSlider = document.getElementById('reynoldsSlider');
        this.reynoldsValue = document.getElementById('reynoldsValue');
        this.machSlider = document.getElementById('machSlider');
        this.machValue = document.getElementById('machValue');
        this.layerVelocity = document.getElementById('layerVelocity');
        this.layerPressure = document.getElementById('layerPressure');
        this.layerVorticity = document.getElementById('layerVorticity');
        this.layerStream = document.getElementById('layerStream');
        this.layerWindTunnel = document.getElementById('layerWindTunnel');
        this.layerIso = document.getElementById('layerIso');
        this.scenarioButtons = document.querySelectorAll('[data-scenario]');
        this.startStopBtn = document.getElementById('startStopBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.geometryUpload = document.getElementById('geometryUpload');
    }

    _bindEvents() {
        this.dimensionSelect.addEventListener('change', () => {
            this.dispatchEvent(new CustomEvent('dimensionchange', { detail: this.dimensionSelect.value }));
        });
        this.solverSelect.addEventListener('change', () => {
            this.dispatchEvent(new CustomEvent('solverchange', { detail: this.solverSelect.value }));
        });
        this.gridResolution.addEventListener('input', () => {
            const value = Number(this.gridResolution.value);
            this.resolutionValue.textContent = `${value}×${Math.floor(value / 2)}`;
        });
        this.gridResolution.addEventListener('change', () => {
            const value = Number(this.gridResolution.value);
            this.dispatchEvent(new CustomEvent('resolutionchange', { detail: value }));
        });
        this.depthResolution.addEventListener('input', () => {
            this.depthValue.textContent = this.depthResolution.value;
        });
        this.depthResolution.addEventListener('change', () => {
            this.dispatchEvent(new CustomEvent('depthchange', { detail: Number(this.depthResolution.value) }));
        });
        this.objectSelect.addEventListener('change', () => {
            const type = this.objectSelect.value;
            if (type === 'custom') {
                this.geometryUpload.click();
            } else {
                if (this.meshPreset) {
                    this.meshPreset.value = '';
                }
                this.dispatchEvent(new CustomEvent('geometrychange', { detail: { type, resetCustom: true } }));
            }
        });
        if (this.meshPreset) {
            this.meshPreset.addEventListener('change', () => {
                const value = this.meshPreset.value;
                if (!value) {
                    this.dispatchEvent(new CustomEvent('presetmesh', { detail: null }));
                    return;
                }
                this.objectSelect.value = 'custom';
                this.dispatchEvent(new CustomEvent('presetmesh', { detail: value }));
            });
        }
        this.uploadButton.addEventListener('click', () => {
            this.objectSelect.value = 'custom';
            this.geometryUpload.click();
        });
        this.geometryUpload.addEventListener('change', (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                this.dispatchEvent(new CustomEvent('geometryupload', { detail: reader.result }));
            };
            reader.readAsText(file);
        });
        this.angleSlider.addEventListener('input', () => {
            this.angleValue.textContent = `${this.angleSlider.value}°`;
        });
        this.angleSlider.addEventListener('change', () => {
            this.dispatchEvent(new CustomEvent('geometrychange', { detail: { angle: Number(this.angleSlider.value) } }));
        });
        this.reynoldsSlider.addEventListener('input', () => {
            this.reynoldsValue.textContent = Number(this.reynoldsSlider.value).toLocaleString();
        });
        this.reynoldsSlider.addEventListener('change', () => {
            this.dispatchEvent(new CustomEvent('paramchange', { detail: { reynolds: Number(this.reynoldsSlider.value) } }));
        });
        this.machSlider.addEventListener('input', () => {
            this.machValue.textContent = Number(this.machSlider.value).toFixed(2);
        });
        this.machSlider.addEventListener('change', () => {
            this.dispatchEvent(new CustomEvent('paramchange', { detail: { mach: Number(this.machSlider.value) } }));
        });

        this.layerVelocity.addEventListener('change', () => this._emitLayer('velocity', this.layerVelocity.checked));
        this.layerPressure.addEventListener('change', () => this._emitLayer('pressure', this.layerPressure.checked));
        this.layerVorticity.addEventListener('change', () => this._emitLayer('vorticity', this.layerVorticity.checked));
        this.layerStream.addEventListener('change', () => this._emitLayer('stream', this.layerStream.checked));
        this.layerWindTunnel.addEventListener('change', () => this._emitLayer('windTunnel', this.layerWindTunnel.checked));
        this.layerIso.addEventListener('change', () => this._emitLayer('iso', this.layerIso.checked));

        this.scenarioButtons.forEach((button) =>
            button.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('scenario', { detail: button.dataset.scenario }));
            })
        );

        this.startStopBtn.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('togglepause'));
        });
        this.resetBtn.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('reset'));
        });
    }

    _emitLayer(layer, value) {
        this.dispatchEvent(new CustomEvent('layerchange', { detail: { layer, value } }));
    }

    _updateReadouts() {
        this.resolutionValue.textContent = `${this.gridResolution.value}×${Math.floor(this.gridResolution.value / 2)}`;
        this.depthValue.textContent = this.depthResolution.value;
        this.angleValue.textContent = `${this.angleSlider.value}°`;
        this.reynoldsValue.textContent = Number(this.reynoldsSlider.value).toLocaleString();
        this.machValue.textContent = Number(this.machSlider.value).toFixed(2);
    }

    setMeshPresets(presets) {
        if (!this.meshPreset) return;
        this.meshPreset.innerHTML = '';
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = 'None (analytic primitive)';
        this.meshPreset.appendChild(emptyOption);
        presets.forEach((preset) => {
            const option = document.createElement('option');
            option.value = preset.id;
            option.textContent = `${preset.label} — ${preset.recommended || ''}`.trim();
            option.dataset.description = preset.description || '';
            this.meshPreset.appendChild(option);
        });
    }

    setMeshPresetValue(id) {
        if (this.meshPreset) {
            this.meshPreset.value = id || '';
        }
    }

    setMeshPresetBusy(flag) {
        if (this.meshPreset) {
            this.meshPreset.disabled = flag;
        }
    }
}
