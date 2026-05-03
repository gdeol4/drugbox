/* ============================================================
   validate.js — SMILES Validation & Cleanup Logic
   ============================================================ */

const SMILESValidator = (() => {

  /**
   * Basic pre-checks before passing to RDKit.
   * Returns { ok, error }
   */
  function preCheck(smiles) {
    if (!smiles || typeof smiles !== 'string') {
      return { ok: false, error: 'No input provided' };
    }

    const trimmed = smiles.trim();

    if (trimmed.length === 0) {
      return { ok: false, error: 'SMILES string is empty' };
    }

    if (trimmed.length > APP_CONFIG.maxSmilesLength) {
      return { ok: false, error: `SMILES too long (max ${APP_CONFIG.maxSmilesLength} chars)` };
    }

    // Basic sanity: check for obviously invalid characters
    // SMILES uses: A-Z, a-z, c, n, o, s, p, [, ], (, ), =, #, /, \, @, +, -, ., 0-9, %, H, etc.
    const suspicious = /[^A-Za-z0-9\[\]\(\)=#\/\\@+\-.%]/g;
    const matches = trimmed.match(suspicious);
    if (matches) {
      return {
        ok: false,
        error: `Invalid characters in SMILES: "${matches.join('')}"`,
      };
    }

    return { ok: true, error: null, cleaned: trimmed };
  }

  /**
   * Full validation using RDKit.
   * Returns { valid, canonical, error, frontendDescriptors }
   */
  function validate(smiles) {
    // Pre-check
    const pre = preCheck(smiles);
    if (!pre.ok) {
      return {
        valid: false,
        canonical: null,
        error: pre.error,
        frontendDescriptors: {},
      };
    }

    // RDKit parse
    const { mol, error } = RDKitService.getMolecule(pre.cleaned);
    if (error || !mol) {
      return {
        valid: false,
        canonical: null,
        error: error || 'Could not parse SMILES',
        frontendDescriptors: {},
      };
    }

    // Get canonical SMILES
    const canonical = RDKitService.getCanonicalSmiles(mol);
    if (!canonical) {
      RDKitService.destroyMolecule(mol);
      return {
        valid: false,
        canonical: null,
        error: 'Could not generate canonical SMILES',
        frontendDescriptors: {},
      };
    }

    // Get frontend descriptors
    const frontendDescriptors = RDKitService.getDescriptors(mol) || {};

    // Clean up
    RDKitService.destroyMolecule(mol);

    return {
      valid: true,
      canonical,
      error: null,
      frontendDescriptors,
    };
  }

  return { preCheck, validate };

})();
