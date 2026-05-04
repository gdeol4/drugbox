/* ============================================================
   state.js — Alpine.js Reactive State Store
   ============================================================ */

const TIME_FORMAT = { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' };

const DESCRIPTOR_TOOLTIPS = {
  MW: 'Molecular Weight (g/mol)',
  logP: 'Octanol-water partition coefficient — lipophilicity',
  TPSA: 'Topological Polar Surface Area — passive oral bioavailability indicator',
  HBA: 'Hydrogen Bond Acceptors count',
  HBD: 'Hydrogen Bond Donors count',
  RotBonds: 'Rotatable bonds — molecular flexibility',
  HeavyAtoms: 'Number of heavy (non-H) atoms',
  RingCount: 'Total ring count',
  AromaticRings: 'Number of aromatic rings',
  FracCsp3: 'Fraction of sp3-hybridized carbons — saturation index',
};

const ADMET_TOOLTIPS = {
  BBB: 'Blood-Brain Barrier permeability',
  PPB: 'Plasma Protein Binding',
  CYP2D6: 'Cytochrome P450 2D6 inhibition',
  CYP3A4: 'Cytochrome P450 3A4 inhibition',
  hERG: 'hERG potassium channel inhibition — cardiotoxicity risk',
  AMES: 'Ames mutagenicity test',
  Caco2: 'Caco-2 cell permeability — oral absorption',
  HIA: 'Human Intestinal Absorption',
  Pgp: 'P-glycoprotein substrate — efflux transporter',
  logS: 'Aqueous solubility',
  LD50: 'Acute toxicity (lethal dose 50%)',
  SkinSensitisation: 'Skin sensitization potential',
  Hepatotoxicity: 'Liver toxicity risk',
};

// Precomputed denominators for QED Gaussian desirability functions
const QED_DENOM = {
  MW:     2 * 150 ** 2,
  logP:   2 * 2.5 ** 2,
  HBA:    2 * 3 ** 2,
  HBD:    2 * 2 ** 2,
  TPSA:   2 * 50 ** 2,
  RotBonds: 2 * 5 ** 2,
};

function buildCSVRows(header, source) {
  const rows = [header];
  for (const [k, v] of Object.entries(source)) {
    rows.push(k + ',' + (typeof v === 'number' ? v.toFixed(4) : v));
  }
  return rows;
}

function appInit() {
  return {
    // --- SMILES State ---
    smilesInput: '',
    canonicalSmiles: null,
    isValid: null,
    errorMessage: null,

    // --- RDKit State ---
    rdkitLoaded: false,
    rdkitError: null,

    // --- Preview State ---
    moleculeSVG: null,
    has3D: false,
    frontendDescriptors: {},

    // --- Lambda API State ---
    isLoading: false,
    lambdaResults: null,
    apiError: null,
    resultTimestamp: null,

    // --- UI State ---
    showRaw: false,
    clock: '',
    activeTab: 'input',
    tabAlert: null,
    analysisDone: false,

    // --- Internal ---
    _debounceTimer: null,

    async boot() {
      this.updateClock();
      setInterval(() => this.updateClock(), 1000);

      let attempts = 0;
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
        if (attempts < 50) { attempts++; setTimeout(waitFor3Dmol, 200); }
      };
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

    updateClock() {
      this.clock = new Date().toLocaleTimeString('en-US', TIME_FORMAT);
    },

    switchTab(tab) {
      this.activeTab = tab;
      if (this.tabAlert === tab) {
        this.tabAlert = null;
      }
    },

    onSmilesChange() {
      if (this._debounceTimer) clearTimeout(this._debounceTimer);
      const input = this.smilesInput.trim();
      if (!input) { this.resetValidation(); return; }
      this._debounceTimer = setTimeout(() => {
        this.validateAndPreview(input);
      }, APP_CONFIG.debounceMs);
    },

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

      if (result.valid && result.canonical) {
        const canvas = document.getElementById('mol2d-canvas');
        if (canvas) {
          const vd = document.getElementById('3dmol-viewer');
          const use3D = MoleculePreview.is3DReady() && MoleculePreview.draw3D(result.canonical);
          if (use3D) {
            this.moleculeSVG = null;
            this.has3D = true;
            if (vd) vd.style.display = '';
          } else {
            this.has3D = false;
            if (vd) vd.style.display = 'none';
            this.moleculeSVG = MoleculePreview.draw2D(result.canonical, canvas);
          }
        }
      } else {
        this.moleculeSVG = null;
        this.has3D = false;
      }

      this.lambdaResults = null;
      this.apiError = null;
      this.showRaw = false;
      this.analysisDone = false;
    },

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
      this.analysisDone = false;
    },

    async runAnalysis() {
      if (this.isValid !== true || !this.canonicalSmiles) return;
      this.isLoading = true;
      this.apiError = null;
      this.lambdaResults = null;
      this.showRaw = false;

      try {
        const [data, admetData] = await Promise.all([
          LambdaAPI.analyzeMolecule(this.canonicalSmiles),
          LambdaAPI.analyzeADMET(this.canonicalSmiles),
        ]);

        if (admetData) {
          data.admet = admetData;
        }

        this.lambdaResults = data;
        this.resultTimestamp = new Date().toLocaleTimeString('en-US', TIME_FORMAT);
        this.analysisDone = true;
        this.tabAlert = 'analysis';
      } catch (err) {
        console.error('[App] Lambda error:', err);
        this.apiError = err.message || 'Unknown error during analysis';
      } finally {
        this.isLoading = false;
      }
    },

    // --- Computed ---

    get hasLipinskiViolation() {
      const d = this.lambdaResults?.descriptors;
      if (!d) return false;
      return (d.MW > 500) || (d.logP > 5) || (d.HBD > 5) || (d.HBA > 10);
    },

    get hasVeberViolation() {
      const d = this.lambdaResults?.descriptors;
      if (!d) return false;
      return (d.RotBonds > 10) || (d.TPSA > 140);
    },

    get qedScore() {
      const d = this.lambdaResults?.descriptors;
      if (!d) return 0;

      const mw   = d.MW || 300;
      const logp = d.logP || 0;
      const hba  = d.HBA || 0;
      const hbd  = d.HBD || 0;
      const tpsa = d.TPSA || 0;
      const rot  = d.RotBonds || 0;

      const d_mw   = Math.exp(-((mw - 350) ** 2) / QED_DENOM.MW);
      const d_logp = Math.exp(-((logp - 2.5) ** 2) / QED_DENOM.logP);
      const d_hba  = hba <= 5 ? 1 : Math.exp(-((hba - 5) ** 2) / QED_DENOM.HBA);
      const d_hbd  = hbd <= 2 ? 1 : Math.exp(-((hbd - 2) ** 2) / QED_DENOM.HBD);
      const d_tpsa = tpsa <= 80 ? 1 : Math.exp(-((tpsa - 80) ** 2) / QED_DENOM.TPSA);
      const d_rot  = rot <= 5 ? 1 : Math.exp(-((rot - 5) ** 2) / QED_DENOM.RotBonds);

      return Math.pow(d_mw * d_logp * d_hba * d_hbd * d_tpsa * d_rot, 1/6);
    },

    // --- Computed ---

    get formattedTimestamp() {
      return this.resultTimestamp ? '[' + this.resultTimestamp + ']' : '';
    },

    get hasMordred() {
      return !!(this.lambdaResults?.mordred?.values);
    },

    // --- Tooltip helpers ---

    getDescriptorTooltip(key) {
      return DESCRIPTOR_TOOLTIPS[key] || '';
    },

    getAdmetTooltip(key) {
      return ADMET_TOOLTIPS[key] || '';
    },

    // --- CSV Download (Mordred + ADMET only) ---

    downloadCSV(type) {
      let rows = [];
      let filename = '';

      if (type === 'mordred' && this.lambdaResults?.mordred?.values) {
        filename = 'mordred_descriptors.csv';
        rows = buildCSVRows('Descriptor,Value', this.lambdaResults.mordred.values);
      } else if (type === 'admet' && this.lambdaResults?.admet) {
        filename = 'admet_properties.csv';
        rows = buildCSVRows('Property,Value', this.lambdaResults.admet);
      }

      if (rows.length <= 1) return;

      const csv = rows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  };
}
