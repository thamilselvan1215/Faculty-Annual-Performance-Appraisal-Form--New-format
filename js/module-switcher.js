/**
 * Global Module Switcher
 * Manages top-level navigation between:
 * 1. Faculty Annual Performance Appraisal Form (FPAS - Existing Module, 700 Marks)
 * 2. Faculty Performance Appraisal Report (PAR - New Module, FPI System)
 * 
 * Preserves full memory, DOM state, and calculations between module toggles.
 */
(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.AppModuleSwitcher = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MODULE_KEYS = {
    FPAS: 'fpas',
    PAR: 'par'
  };

  let activeModule = MODULE_KEYS.PAR; // Default to new module or allow URL hash / stored pref

  function initSwitcher() {
    // Check URL hash if specified (e.g. #fpas or #par)
    const hash = window.location.hash.toLowerCase();
    if (hash.includes('fpas')) {
      activeModule = MODULE_KEYS.FPAS;
    } else {
      activeModule = MODULE_KEYS.PAR;
    }

    applyActiveModule(activeModule);
  }

  function switchTo(moduleKey) {
    activeModule = moduleKey;
    applyActiveModule(moduleKey);
    // Update hash without triggering reload
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, null, '#' + moduleKey);
    }
  }

  function applyActiveModule(moduleKey) {
    const fpasContainer = document.getElementById('module-fpas-container');
    const parContainer = document.getElementById('module-par-container');
    const btnFpas = document.getElementById('btn-nav-fpas');
    const btnPar = document.getElementById('btn-nav-par');

    if (moduleKey === MODULE_KEYS.FPAS) {
      if (fpasContainer) fpasContainer.style.display = 'block';
      if (parContainer) parContainer.style.display = 'none';
      if (btnFpas) btnFpas.classList.add('active');
      if (btnPar) btnPar.classList.remove('active');
      document.body.classList.remove('active-module-par');
      document.body.classList.add('active-module-fpas');
    } else {
      if (fpasContainer) fpasContainer.style.display = 'none';
      if (parContainer) parContainer.style.display = 'block';
      if (btnFpas) btnFpas.classList.remove('active');
      if (btnPar) btnPar.classList.add('active');
      document.body.classList.remove('active-module-fpas');
      document.body.classList.add('active-module-par');

      // Initialize PAR app if needed
      if (window.ParApp && typeof window.ParApp.renderDashboard === 'function') {
        window.ParApp.renderDashboard();
      }
    }
  }

  function getActiveModule() {
    return activeModule;
  }

  return {
    MODULE_KEYS,
    initSwitcher,
    switchTo,
    getActiveModule
  };
});
