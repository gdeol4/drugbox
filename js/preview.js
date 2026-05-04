/* ============================================================
   preview.js — 2D Molecule Drawing & 3Dmol.js Viewer
   ============================================================ */

const MoleculePreview = (() => {

  let _3DViewer = null;
  let _3DInitialized = false;

  function draw2D(canonicalSmiles, targetEl) {
    if (!canonicalSmiles || !targetEl) return null;

    const { mol, error } = RDKitService.getMolecule(canonicalSmiles);
    if (error || !mol) {
      console.warn('[Preview] Cannot draw:', error);
      return null;
    }

    const rect = targetEl.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width - 20, 200), 500);
    const height = Math.min(Math.max(width * 0.65, 150), 300);

    const svg = RDKitService.getSVG(mol, Math.floor(width), Math.floor(height));
    RDKitService.destroyMolecule(mol);

    return svg;
  }

  function init3DViewer(targetEl) {
    const Dmol = window.$3Dmol;
    if (!targetEl || !Dmol) {
      return null;
    }

    const existing = document.getElementById('3dmol-viewer');
    if (existing) existing.remove();

    const viewerDiv = document.createElement('div');
    viewerDiv.id = '3dmol-viewer';
    viewerDiv.style.width = '100%';
    viewerDiv.style.height = '100%';
    viewerDiv.style.position = 'absolute';
    viewerDiv.style.top = '0';
    viewerDiv.style.left = '0';
    viewerDiv.style.zIndex = '1';
    targetEl.appendChild(viewerDiv);

    const viewer = Dmol.createViewer(viewerDiv, {
      backgroundColor: 0x0a0a0a,
      antialias: true,
    });

    _3DViewer = viewer;
    _3DInitialized = true;

    return viewer;
  }

  function draw3D(canonicalSmiles) {
    if (!_3DViewer || !canonicalSmiles) {
      console.warn('[Preview] draw3D: no viewer or smiles', !!_3DViewer, canonicalSmiles);
      return false;
    }

    const { mol, error } = RDKitService.getMolecule(canonicalSmiles);
    if (error || !mol) {
      console.warn('[Preview] Cannot generate 3D:', error);
      return false;
    }

    try {
      const getFn = mol.get_molblock || mol.get_new_molblock;
      const molBlock = getFn ? getFn.call(mol) : null;

      if (molBlock) {
        _3DViewer.removeAllModels();
        _3DViewer.addModel(molBlock, 'sdf');
        _3DViewer.setStyle({}, { stick: { radius: 0.15, colorscheme: 'whiteCarbon' } });
        _3DViewer.zoomTo();
        _3DViewer.render();
        RDKitService.destroyMolecule(mol);
        return true;
      }
    } catch (e) {
      console.warn('[Preview] 3D failed:', e.message);
    }

    RDKitService.destroyMolecule(mol);
    return false;
  }

  function is3DReady() {
    return _3DInitialized && _3DViewer !== null;
  }

  function resize3D() {
    if (_3DViewer) {
      _3DViewer.resize();
      _3DViewer.render();
    }
  }

  return { draw2D, init3DViewer, draw3D, is3DReady, resize3D };

})();
