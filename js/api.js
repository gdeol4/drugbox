/* ============================================================
   api.js — AWS Lambda Function URL API Calls
   ============================================================ */

const LambdaAPI = (() => {

  /**
   * Normalize the raw Lambda response into the shape the UI expects.
   * Lambda returns: basic_rdkit, mordred_2d, mordred_2d_count, limits, etc.
   * UI expects: descriptors, mordred, warnings, limits, raw.
   */
  function normalizeLambdaResults(raw) {
    const basic = raw.basic_rdkit || {};

    const descriptors = {
      MW: basic.MolWt,
      logP: basic.MolLogP,
      TPSA: basic.TPSA,
      HBD: basic.NumHDonors,
      HBA: basic.NumHAcceptors,
      RotBonds: basic.NumRotatableBonds,
      HeavyAtoms: basic.NumHeavyAtoms,
      RingCount: basic.RingCount ?? basic.NumRings,
      AromaticRings: basic.NumAromaticRings,
      FracCsp3: basic.FractionCSP3,
    };

    // Rule-based drug-likeness warnings (Lipinski / Veber style)
    const warnings = [];
    if (descriptors.MW != null && descriptors.MW > 500) {
      warnings.push('Molecular weight is above 500 g/mol.');
    }
    if (descriptors.logP != null && descriptors.logP > 5) {
      warnings.push('LogP is above 5.');
    }
    if (descriptors.HBD != null && descriptors.HBD > 5) {
      warnings.push('Hydrogen bond donor count is above 5.');
    }
    if (descriptors.HBA != null && descriptors.HBA > 10) {
      warnings.push('Hydrogen bond acceptor count is above 10.');
    }
    if (descriptors.TPSA != null && descriptors.TPSA > 140) {
      warnings.push('TPSA is above 140 Å².');
    }

    return {
      input_smiles: raw.input_smiles,
      canonical_smiles: raw.canonical_smiles,
      descriptors,
      mordred: {
        count: raw.mordred_2d_count,
        values: raw.mordred_2d || {},
      },
      limits: raw.limits || null,
      warnings,
      // Keep raw for JSON debug view
      raw,
    };
  }

  /**
   * Send a canonical SMILES to the Lambda backend for analysis.
   * @param {string} canonicalSmiles
   * @returns {Promise<object>} Normalized result object
   */
  async function analyzeMolecule(canonicalSmiles) {
    if (!canonicalSmiles) {
      throw new Error('No SMILES to analyze');
    }

    const url = APP_CONFIG.lambdaUrl;

    if (!url || url.includes('your-function-url')) {
      throw new Error(
        'Lambda Function URL not configured. Please set APP_CONFIG.lambdaUrl in js/config.js'
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), APP_CONFIG.apiTimeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ smiles: canonicalSmiles }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(
          `Lambda returned ${response.status} ${response.statusText}${errorBody ? ': ' + errorBody : ''}`
        );
      }

      const rawData = await response.json();

      // Validate response structure
      if (!rawData || typeof rawData !== 'object') {
        throw new Error('Lambda returned invalid JSON');
      }

      // Normalize into UI-friendly shape
      return normalizeLambdaResults(rawData);

    } catch (err) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        throw new Error(`Request timed out after ${APP_CONFIG.apiTimeout / 1000}s`);
      }

      // Network / CORS errors — log full details to console
      console.error('[API] Fetch failed:', {
        message: err.message,
        name: err.name,
        cause: err.cause,
      });
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        throw new Error('Network error: could not reach Lambda. Check URL and CORS settings.');
      }

      throw err;
    }
  }

  /**
   * Health check / ping the Lambda to verify connectivity.
   * @returns {Promise<boolean>}
   */
  async function ping() {
    try {
      const response = await fetch(APP_CONFIG.lambdaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ping: true }),
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (_) {
      return false;
    }
  }

  return { analyzeMolecule, ping };

})();

