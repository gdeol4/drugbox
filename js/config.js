/* ============================================================
   config.js — App Configuration & Constants
   ============================================================ */

const APP_CONFIG = {
  // AWS Lambda Function URL — replace with your actual URL
  lambdaUrl: 'https://ng2aky5o32wuxycbgcoseufvjq0ynkgw.lambda-url.us-east-1.on.aws/',

  // CORS workaround: if Lambda returns double origin header, use this proxy prefix
  // Set to empty string to disable
  corsProxy: '',

  // Request timeout in milliseconds
  apiTimeout: 30000,

  // Debounce delay for SMILES validation (ms)
  debounceMs: 400,

  // Maximum SMILES length
  maxSmilesLength: 2000,

  // RDKit.js loading
  rdkit: {
    // Whether to use the minimal build (faster load, fewer features)
    minimal: true,
    // Init timeout
    initTimeout: 15000,
  },

  // 3Dmol.js
  threeD: {
    enabled: false, // set to true to enable 3D viewer
  },
};

// Freeze to prevent accidental mutation
Object.freeze(APP_CONFIG);
