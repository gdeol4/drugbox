/* ============================================================
   preview.js � 2D Molecule Drawing & 3Dmol.js Viewer
   ============================================================ */

const MoleculePreview = (() => {

  let _3DViewer = null;
  let _3DInitialized = false;

  /**
   * Draw a 2D molecule into a target DOM element.
   */
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

    console.log('[Preview] Drawing 2D:', canonicalSmiles, width, height);
    const svg = RDKitService.getSVG(mol, Math.floor(width), Math.floor(height));
    RDKitService.destroyMolecule(mol);

    return svg;
  }

  /**
   * Initialize the 3Dmol.js viewer in the preview canvas.
   * Transparent background to blend with the terminal screen.
   */
    function init3DViewer(targetEl) {
      const Dmol = window.$3Dmol;
      if (!targetEl || !Dmol) {
        return null;
      }

      // Remove existing viewer if any
      const existing = document.getElementById('3dmol-viewer');
      if (existing) existing.remove();

      // Create a child div for 3Dmol
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

      viewer.setBackgroundColor(0x0a0a0a);
      _3DViewer = viewer;
      _3DInitialized = true;
      console.log('[Preview] 3Dmol viewer created');

      return viewer;
    }

  /**
   * Render a 3D molecule from SMILES into the viewer.
   */
    function draw3D(canonicalSmiles) {
      if (!_3DViewer || !canonicalSmiles) {
        console.warn('[Preview] draw3D: no viewer or smiles', !!_3DViewer, canonicalSmiles);
        return false;
      }

      console.log('[Preview] draw3D:', canonicalSmiles);
      const { mol, error } = RDKitService.getMolecule(canonicalSmiles);
      if (error || !mol) {
        console.warn('[Preview] Cannot generate 3D:', error);
        return false;
      }

      try {
        // Try to get molblock directly (2D coords) - 3Dmol can display it
        const molBlock = mol.get_molblock
          ? mol.get_molblock()
          : mol.get_new_molblock
            ? mol.get_new_molblock()
            : null;

                if (molBlock) {
          console.log('[Preview] MolBlock length:', molBlock.length);
          _3DViewer.removeAllModels();
          _3DViewer.addModel(molBlock, 'sdf');

          _3DViewer.setStyle({}, {
            stick: {
              radius: 0.15,
              colorscheme: 'whiteCarbon',
            },
          });

          _3DViewer.zoomTo();
          _3DViewer.render();
          console.log('[Preview] 3D render complete');
          RDKitService.destroyMolecule(mol);
          return true;
        }
      } catch (e) {
        console.warn('[Preview] 3D failed:', e.message);
      }

      RDKitService.destroyMolecule(mol);
      return false;
    }

  /**
   * Check if 3D viewer is initialized.
   */
  function is3DReady() {
    return _3DInitialized && _3DViewer !== null;
  }

  /**
   * Resize the 3D viewer (call on container resize).
   */
  function resize3D() {
    if (_3DViewer) {
      _3DViewer.resize();
      _3DViewer.render();
    }
  }

  return { draw2D, init3DViewer, draw3D, is3DReady, resize3D };

})();
