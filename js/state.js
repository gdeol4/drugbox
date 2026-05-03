/* ============================================================
   state.js — Alpine.js Reactive State Store
   ============================================================ */

/**
 * Alpine.data() component for the main app.
 * This is the single source of truth for all UI state.
 */
function appInit() {
  return {
    // --- SMILES State ---
    smilesInput: '',
    canonicalSmiles: null,
    isValid: null,        // null = not checked, true/false
    errorMessage: null,

    // --- RDKit State ---
    rdkitLoaded: false,
    rdkitError: null,

    // --- Preview State ---
    moleculeSVG: null,
    has3D: false,
    frontendDescriptors: {},   // safe empty object, never null

    // --- Lambda API State ---
    isLoading: false,
    lambdaResults: null,        // null = no results yet; UI guards with x-show
    apiError: null,
    resultTimestamp: null,

    // --- UI State ---
    showRaw: false,
    clock: '',

    // --- Internal ---
    _debounceTimer: null,
    _lastSmiles: '',

    /**
     * Boot sequence: init RDKit, start clock, init 3D viewer.
     */
    async boot() {
      this.updateClock();
      setInterval(() => this.updateClock(), 1000);

      // Init 3D viewer - wait for $3Dmol global
      const waitFor3Dmol = () => {
        if (window.$3Dmol) {
          const canvas = document.getElementById('mol2d-canvas');
          if (canvas) {
            const viewer = MoleculePreview.init3DViewer(canvas);
            if (viewer) {
              this.has3D = true;
              console.log('[App] 3D viewer ready');
              return;
            }
          }
        }
        // Retry
        if (attempts < 50) {
          attempts++;
          setTimeout(waitFor3Dmol, 200);
        }
      };
      let attempts = 0;
      waitFor3Dmol();

      try {
        await RDKitService.init();
        this.rdkitLoaded = true;
      } catch (err) {
        console.error('[App] RDKit init failed:', err);
        this.rdkitError = err.message || 'RDKit failed to load';
        this.rdkitLoaded = false;
      }
    },

    /**
     * Update the on-screen clock.
     */
    updateClock() {
      const now = new Date();
      this.clock = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    },

    /**
     * Called on SMILES input change (debounced).
     */
    onSmilesChange() {
      // Clear previous timer
      if (this._debounceTimer) {
        clearTimeout(this._debounceTimer);
      }

      const input = this.smilesInput.trim();

      // If empty, reset everything
      if (!input) {
        this.resetValidation();
        return;
      }

      // Debounce
      this._debounceTimer = setTimeout(() => {
        this.validateAndPreview(input);
      }, APP_CONFIG.debounceMs);
    },

    /**
     * Validate SMILES and generate preview.
     */
    validateAndPreview(smiles) {
      if (!this.rdkitLoaded) {
        this.isValid = null;
        this.errorMessage = 'RDKit not loaded yet...';
        return;
      }

      const result = SMILESValidator.validate(smiles);

      this.isValid = result.valid;
      this.errorMessage = result.error;
      this.canonicalSmiles = result.canonical;
      this.frontendDescriptors = result.frontendDescriptors;

      // Draw preview - 3D if available, else 2D SVG
      if (result.valid && result.canonical) {
        const canvas = document.getElementById('mol2d-canvas');
        if (canvas) {
          if (MoleculePreview.is3DReady()) {
            // Try 3D first
            const ok = MoleculePreview.draw3D(result.canonical);
            if (ok) {
              this.moleculeSVG = null;
              this.has3D = true;
              const vd = document.getElementById('3dmol-viewer');
              if (vd) vd.style.display = '';
            } else {
              // 3D failed, fall back to 2D
              this.has3D = false;
              const vd = document.getElementById('3dmol-viewer');
              if (vd) vd.style.display = 'none';
              const svg = MoleculePreview.draw2D(result.canonical, canvas);
              this.moleculeSVG = svg;
            }
          } else {
            this.has3D = false;
            const vd = document.getElementById('3dmol-viewer');
            if (vd) vd.style.display = 'none';
            const svg = MoleculePreview.draw2D(result.canonical, canvas);
            this.moleculeSVG = svg;
          }
        }
      } else {
        this.moleculeSVG = null;
        this.has3D = false;
      }

      // Clear previous Lambda results when input changes
      this.lambdaResults = null;
      this.apiError = null;
      this.showRaw = false;
    },

    /**
     * Reset validation state.
     */
    resetValidation() {
      this.isValid = null;
      this.errorMessage = null;
      this.canonicalSmiles = null;
      this.moleculeSVG = null;
      this.has3D = false;
      this.frontendDescriptors = {};
      this.lambdaResults = null;
      this.apiError = null;
      this.showRaw = false;
    },

    /**
     * Run Lambda analysis.
     */
    async runAnalysis() {
      if (this.isValid !== true || !this.canonicalSmiles) {
        return;
      }

      this.isLoading = true;
      this.apiError = null;
      this.lambdaResults = null;
      this.showRaw = false;

      try {
        const data = await LambdaAPI.analyzeMolecule(this.canonicalSmiles);
        this.lambdaResults = data;
        this.resultTimestamp = new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      } catch (err) {
        console.error('[App] Lambda error:', err);
        this.apiError = err.message || 'Unknown error during analysis';
      } finally {
        this.isLoading = false;
      }
    },
  };
}
