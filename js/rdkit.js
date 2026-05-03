/* ============================================================
   rdkit.js — RDKit.js Initialization & Molecule Operations
   ============================================================ */

const RDKitService = (() => {

  let RDKitModule = null;
  let initPromise = null;

  /**
   * Initialize RDKit.js. Returns a promise that resolves when ready.
   * Safe to call multiple times — returns the same promise.
   */
  function init() {
    if (RDKitModule) {
      return Promise.resolve(RDKitModule);
    }
    if (initPromise) {
      return initPromise;
    }

    initPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('RDKit.js initialization timed out'));
      }, APP_CONFIG.rdkit.initTimeout);

      try {
        window
          .initRDKitModule()
          .then((instance) => {
            clearTimeout(timeout);
            RDKitModule = instance;
            console.log('[RDKit] Initialized successfully');
            resolve(RDKitModule);
          })
          .catch((err) => {
            clearTimeout(timeout);
            console.error('[RDKit] Init failed:', err);
            reject(err);
          });
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });

    return initPromise;
  }

  /**
   * Get a molecule object from a SMILES string.
   * Returns { mol, error } — mol is null if parsing failed.
   */
  function getMolecule(smiles) {
    if (!RDKitModule) {
      return { mol: null, error: 'RDKit not initialized' };
    }
    try {
      const mol = RDKitModule.get_mol(smiles);
      if (!mol || mol.is_valid() === false) {
        return { mol: null, error: 'Invalid SMILES: could not parse molecule' };
      }
      return { mol, error: null };
    } catch (e) {
      return { mol: null, error: `RDKit error: ${e.message}` };
    }
  }

  /**
   * Get canonical SMILES from a molecule.
   */
  function getCanonicalSmiles(mol) {
    if (!mol) return null;
    try {
      return mol.get_smiles();
    } catch (e) {
      console.error('[RDKit] get_smiles error:', e);
      return null;
    }
  }

  /**
   * Get 2D SVG drawing from a molecule.
   * Returns an SVG string.
   */
  function getSVG(mol, width = 400, height = 250) {
    if (!mol) return null;
    try {
      return mol.get_svg(width, height);
    } catch (e) {
      console.error('[RDKit] get_svg error:', e);
      return null;
    }
  }

  /**
   * Calculate basic frontend descriptors from a molecule.
   * Returns an object with available descriptors.
   */
  function getDescriptors(mol) {
    if (!mol) return null;
    const desc = {};
    try {
      // Molecular weight
      try { desc.MW = parseFloat(mol.get_descriptors().AMW.toFixed(2)); } catch (_) {}
      // LogP
      try { desc.logP = parseFloat(mol.get_descriptors().CrippenClogP.toFixed(2)); } catch (_) {}
      // HBA
      try { desc.HBA = mol.get_descriptors().NumHAcceptors; } catch (_) {}
      // HBD
      try { desc.HBD = mol.get_descriptors().NumHDonors; } catch (_) {}
      // Rotatable bonds
      try { desc.RotBonds = mol.get_descriptors().NumRotatableBonds; } catch (_) {}
      // TPSA
      try { desc.TPSA = parseFloat(mol.get_descriptors().TPSA.toFixed(2)); } catch (_) {}
      // Heavy atom count
      try { desc.HeavyAtoms = mol.get_descriptors().HeavyAtomCount; } catch (_) {}
      // Ring count
      try { desc.RingCount = mol.get_descriptors().NumRings; } catch (_) {}
      // Aromatic rings
      try { desc.AromaticRings = mol.get_descriptors().NumAromaticRings; } catch (_) {}
      // Fraction Csp3
      try { desc.FracCsp3 = parseFloat(mol.get_descriptors().FractionCSP3.toFixed(3)); } catch (_) {}
    } catch (e) {
      console.warn('[RDKit] Descriptor calculation warning:', e.message);
    }
    return Object.keys(desc).length > 0 ? desc : null;
  }

  /**
   * Clean up a molecule object to free WASM memory.
   */
  function destroyMolecule(mol) {
    if (mol && typeof mol.delete === 'function') {
      try { mol.delete(); } catch (_) {}
    }
  }

  /**
   * Check if RDKit is ready.
   */
  function isReady() {
    return RDKitModule !== null;
  }

  return {
    init,
    getMolecule,
    getCanonicalSmiles,
    getSVG,
    getDescriptors,
    destroyMolecule,
    isReady,
  };

})();
