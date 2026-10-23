/**
 * FPAS Actions Column Manager
 * Adds "Actions" column containing:
 * - 📎 File: Attach documentary evidence
 * - Ø Nil: Quickly set remarks to 'Nil' and score to 0
 * - ✕: Clear row (score, remarks, attachment)
 * Automatically recalculates totals and preserves clean print layout.
 */
(function (root) {
  'use strict';

  const DB_NAME = 'FPAS_Evidence_DB';
  const DB_VERSION = 1;
  const STORE_NAME = 'evidence_files';
  let dbPromise = null;

  function getDB() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  async function saveFile(key, file) {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const record = {
          key: key,
          name: file.name,
          size: file.size,
          type: file.type,
          data: file,
          uploadedAt: new Date().toISOString()
        };
        store.put(record);
        tx.oncomplete = () => resolve(record);
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('Could not save file to IndexedDB', err);
    }
  }

  async function getFile(key) {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      return null;
    }
  }

  async function deleteFile(key) {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('Could not delete file from IndexedDB', err);
    }
  }

  function downloadFileRecord(record) {
    if (!record || !record.data) return;
    const url = URL.createObjectURL(record.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = record.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function init() {
    const fpasContainer = document.getElementById('module-fpas-container') || document.body;
    const tables = fpasContainer.querySelectorAll('table');

    let globalRowCounter = 0;

    tables.forEach((table) => {
      const thead = table.querySelector('thead');
      if (!thead) return;

      const headerRows = thead.querySelectorAll('tr');
      let remarksTh = null;
      let targetHeaderRow = null;

      headerRows.forEach((tr) => {
        const ths = tr.querySelectorAll('th');
        ths.forEach((th) => {
          if (th.textContent.trim().toLowerCase() === 'remarks') {
            remarksTh = th;
            targetHeaderRow = tr;
          }
        });
      });

      if (!remarksTh || !targetHeaderRow) return;

      // Don't inject multiple times
      if (targetHeaderRow.querySelector('.fpas-actions-col-th')) return;

      // 1. Add "Actions" TH next to Remarks
      const actionTh = document.createElement('th');
      actionTh.className = 'no-print fpas-actions-col-th';
      actionTh.textContent = 'Actions';
      remarksTh.insertAdjacentElement('afterend', actionTh);

      // 2. Iterate TBODY rows
      const tbody = table.querySelector('tbody');
      if (!tbody) return;

      const rows = tbody.querySelectorAll('tr');
      rows.forEach((tr) => {
        const remarksTd = tr.querySelector('td.remarks-col');
        if (!remarksTd) {
          // Check if this row spans all columns (e.g., colspan=5)
          const singleTd = tr.querySelector('td[colspan]');
          if (singleTd) {
            const currentSpan = parseInt(singleTd.getAttribute('colspan') || '1', 10);
            if (currentSpan >= 4) {
              singleTd.setAttribute('colspan', String(currentSpan + 1));
            }
          }
          return;
        }

        // Create Actions TD
        const actionTd = document.createElement('td');
        actionTd.className = 'no-print fpas-action-cell';

        const textarea = remarksTd.querySelector('textarea');
        const scoreInput = tr.querySelector('td.score-input input');

        // Check if actionable row
        if (textarea || scoreInput) {
          globalRowCounter++;
          const scoreClass = scoreInput
            ? Array.from(scoreInput.classList).find(c => c !== 'score' && c !== 'cell-input')
            : null;
          const rowKey = scoreClass || `fpas_row_${globalRowCounter}`;

          actionTd.innerHTML = `
            <div class="fpas-row-action-btns">
              <button type="button" class="fpas-btn-action btn-file" title="Attach file document">
                <span class="fpas-btn-icon">📎</span>
                <span class="fpas-btn-label">File</span>
              </button>
              <button type="button" class="fpas-btn-action btn-nil" title="Set Remarks as Nil and Score to 0">
                <span class="fpas-btn-icon">Ø</span>
                <span class="fpas-btn-label">Nil</span>
              </button>
              <button type="button" class="fpas-btn-action btn-clear" title="Clear this row">
                <span class="fpas-btn-icon">✕</span>
              </button>
            </div>
            <div class="fpas-file-badge" style="display:none;">
              <span class="file-name" title="Click to view/download"></span>
              <span class="file-del" title="Remove attachment">✕</span>
            </div>
            <input type="file" class="fpas-hidden-file-input" style="display:none;" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip" />
          `;

          const btnFile = actionTd.querySelector('.btn-file');
          const btnNil = actionTd.querySelector('.btn-nil');
          const btnClear = actionTd.querySelector('.btn-clear');
          const fileInput = actionTd.querySelector('.fpas-hidden-file-input');
          const badge = actionTd.querySelector('.fpas-file-badge');
          const fileNameEl = badge.querySelector('.file-name');
          const fileDelEl = badge.querySelector('.file-del');

          let attachedRecord = null;

          // Check if existing file in IndexedDB
          getFile(rowKey).then((record) => {
            if (record) {
              attachedRecord = record;
              fileNameEl.textContent = '📎 ' + record.name;
              fileNameEl.title = `Download ${record.name} (${(record.size / 1024).toFixed(1)} KB)`;
              badge.style.display = 'flex';
            }
          });

          // File button click
          btnFile.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
          });

          // File input change
          fileInput.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            if (file.size > 25 * 1024 * 1024) {
              alert('File size exceeds 25MB limit.');
              return;
            }

            try {
              const record = await saveFile(rowKey, file);
              attachedRecord = record;
              fileNameEl.textContent = '📎 ' + file.name;
              fileNameEl.title = `Download ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
              badge.style.display = 'flex';
            } catch (err) {
              console.error(err);
              alert('Failed to save file: ' + err.message);
            }
            fileInput.value = '';
          });

          // Download file click
          fileNameEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (attachedRecord) downloadFileRecord(attachedRecord);
          });

          // Remove file click
          fileDelEl.addEventListener('click', async (e) => {
            e.stopPropagation();
            await deleteFile(rowKey);
            attachedRecord = null;
            badge.style.display = 'none';
            fileNameEl.textContent = '';
          });

          // Nil button click
          btnNil.addEventListener('click', (e) => {
            e.stopPropagation();
            if (textarea) textarea.value = 'Nil';
            if (scoreInput) {
              scoreInput.value = '0';
              scoreInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (typeof root.calcTotals === 'function') {
              root.calcTotals();
            }
          });

          // Clear button click
          btnClear.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (textarea) textarea.value = '';
            if (scoreInput) {
              scoreInput.value = '';
              scoreInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (attachedRecord) {
              await deleteFile(rowKey);
              attachedRecord = null;
              badge.style.display = 'none';
              fileNameEl.textContent = '';
            }
            if (typeof root.calcTotals === 'function') {
              root.calcTotals();
            }
          });
        }

        remarksTd.insertAdjacentElement('afterend', actionTd);
      });
    });
  }

  root.FpasActions = { init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
