/* ============================================================
   api.js — AWS Lambda Function URL API Calls
   ============================================================ */

const LambdaAPI = (() => {

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
      raw,
    };
  }

  /**
   * Generic fetch helper — POST JSON, return parsed JSON.
   */
  async function postJSON(body) {
    const url = APP_CONFIG.lambdaUrl;
    if (!url || url.includes('your-function-url')) {
      throw new Error('Lambda Function URL not configured. Set APP_CONFIG.lambdaUrl in js/config.js');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), APP_CONFIG.apiTimeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error('Lambda returned ' + response.status + ' ' + response.statusText + (errorBody ? ': ' + errorBody : ''));
      }

      const rawData = await response.json();
      if (!rawData || typeof rawData !== 'object') {
        throw new Error('Lambda returned invalid JSON');
      }
      return rawData;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Request timed out after ' + (APP_CONFIG.apiTimeout / 1000) + 's');
      }
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        throw new Error('Network error: could not reach Lambda. Check URL and CORS settings.');
      }
      throw err;
    }
  }

  /**
   * Analyze molecule — basic descriptors + Mordred.
   */
  async function analyzeMolecule(canonicalSmiles) {
    if (!canonicalSmiles) throw new Error('No SMILES to analyze');
    const raw = await postJSON({ smiles: canonicalSmiles });
    return normalizeLambdaResults(raw);
  }

  /**
   * Analyze ADMET — called separately with include_admet flag.
   * Lambda returns admet properties when this flag is set.
   */
  async function analyzeADMET(canonicalSmiles) {
    if (!canonicalSmiles) return null;
    try {
      const raw = await postJSON({ smiles: canonicalSmiles, include_admet: true });
      // Lambda may return admet at top level or nested
      return raw.admet || raw.admet_properties || null;
    } catch (err) {
      console.warn('[API] ADMET fetch failed (non-fatal):', err.message);
      return null;
    }
  }

  async function ping() {
    try {
      await postJSON({ ping: true });
      return true;
    } catch (_) {
      return false;
    }
  }

  return { analyzeMolecule, analyzeADMET, ping };

})();
