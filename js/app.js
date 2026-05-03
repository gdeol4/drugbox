/* ============================================================
   app.js — Entry Point, Global Error Handling, Wiring
   ============================================================ */

/**
 * This file serves as the main entry point.
 * Most logic lives in state.js (Alpine component), rdkit.js,
 * validate.js, preview.js, and api.js.
 *
 * This file handles:
 *  - Global error catching
 *  - Console branding
 *  - Any post-boot wiring that doesn't belong in Alpine
 */

(function () {
  'use strict';

  // --- Console Branding ---
  console.log(
    '%c MOLECTRL v1.0 %c Molecular Analysis Terminal ',
    'background:#0a0a0a;color:#33ff77;font-family:monospace;font-size:1.2em;padding:4px 8px;border:1px solid #33ff77;',
    'color:#888;font-family:monospace;'
  );
  console.log(
    '%c RDKit.js + Alpine.js + Bulma // Lambda Backend ',
    'color:#666;font-family:monospace;font-size:0.8em;'
  );

  // --- Global Unhandled Error Logging ---
  window.addEventListener('error', function (event) {
    console.error('[MOLECTRL] Unhandled error:', event.error || event.message);
  });

  window.addEventListener('unhandledrejection', function (event) {
    console.error('[MOLECTRL] Unhandled promise rejection:', event.reason);
  });

  // --- Service Worker Registration (future PWA) ---
  // if ('serviceWorker' in navigator) {
  //   navigator.serviceWorker.register('/sw.js');
  // }

})();
