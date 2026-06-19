/**
 * ui.js — UI Controller
 * Handles file input, drag-drop, tab switching, progress, download, and verify.
 */

"use strict";

(function () {

  /* ── DOM refs ─────────────────────────────────────────── */
  const dropZone     = document.getElementById('dropZone');
  const fileInput    = document.getElementById('fileInput');
  const statsBar     = document.getElementById('statsBar');
  const progressWrap = document.getElementById('progressWrap');
  const progressBar  = document.getElementById('progressBar');
  const progressLabel= document.getElementById('progressLabel');
  const actions      = document.getElementById('actions');
  const tabs         = document.getElementById('tabs');
  const tabContent   = document.getElementById('tabContent');
  const verifyPanel  = document.getElementById('verifyPanel');

  const origSizeEl   = document.getElementById('origSize');
  const compSizeEl   = document.getElementById('compSize');
  const reductionEl  = document.getElementById('reduction');
  const ratioEl      = document.getElementById('ratio');
  const entropyEl    = document.getElementById('entropy');

  const btnDownloadBin  = document.getElementById('btnDownloadBin');
  const btnDownloadText = document.getElementById('btnDownloadText');
  const btnDecompress  = document.getElementById('btnDecompress');
  const btnReset       = document.getElementById('btnReset');
  const btnExportTree  = document.getElementById('btnExportTree');
  const treeZoom       = document.getElementById('treeZoom');
  const treeCanvas     = document.getElementById('treeCanvas');
  const binaryView     = document.getElementById('binaryView');
  const verifyIcon     = document.getElementById('verifyIcon');
  const verifyMsg      = document.getElementById('verifyMsg');
  const decompressedPreview = document.getElementById('decompressedPreview');

  /* ── State ────────────────────────────────────────────── */
  let state = {
    originalText:     null,
    result:           null,
    treeRenderer:     null,
    filename:         'output',
    decompressedText: null
  };

  /* ── Drag & drop ──────────────────────────────────────── */
  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  });
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) loadFile(fileInput.files[0]);
  });

  /* ── Load + compress ──────────────────────────────────── */
  function loadFile(file) {
    if (!file.name.endsWith('.txt') && file.type !== 'text/plain') {
      alert('Please select a .txt file.');
      return;
    }
    state.filename = file.name.replace(/\.txt$/, '');

    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target.result;
      if (!text || text.length === 0) {
        alert('File is empty.');
        return;
      }
      state.originalText = text;
      runCompression(text);
    };
    reader.readAsText(file);
  }

  function runCompression(text) {
    // Show progress
    showProgress('Analysing frequencies…', 10);

    // Use setTimeout to let the UI repaint before heavy work
    setTimeout(() => {
      showProgress('Building Huffman tree…', 35);

      setTimeout(() => {
        showProgress('Encoding bitstream…', 65);

        setTimeout(() => {
          try {
            const result = HuffmanCoder.compress(text);
            state.result = result;

            showProgress('Packing bytes…', 90);

            setTimeout(() => {
              showProgress('Done!', 100);
              setTimeout(() => {
                hideProgress();
                renderResults(result);
              }, 400);
            }, 150);

          } catch (err) {
            hideProgress();
            alert('Compression error: ' + err.message);
          }
        }, 100);
      }, 80);
    }, 50);
  }

  /* ── Render results ───────────────────────────────────── */
  function renderResults(result) {
    const { stats, freqMap, codeTable, tree, bitstring } = result;

    // Stats bar
    origSizeEl.textContent  = formatBytes(stats.origBytes);
    compSizeEl.textContent  = formatBytes(stats.compBytes);
    reductionEl.textContent = stats.reduction + '%';
    ratioEl.textContent     = stats.ratio + 'x';
    entropyEl.textContent   = stats.entropy;
    statsBar.style.display  = 'grid';

    // Actions
    actions.style.display  = 'flex';
    tabs.style.display     = 'flex';
    tabContent.style.display = 'block';
    verifyPanel.style.display = 'none';
    dropZone.style.display = 'none';

    // Frequency table
    renderFreqTable(freqMap, state.originalText.length);

    // Code table
    renderCodeTable(freqMap, codeTable);

    // Tree
    if (!state.treeRenderer) {
      state.treeRenderer = new TreeRenderer(treeCanvas);
    }
    state.treeRenderer.render(tree);

    // Binary preview
    renderBinaryPreview(bitstring);

    // Activate first tab
    activateTab('frequency');
  }

  /* ── Frequency table ──────────────────────────────────── */
  function renderFreqTable(freqMap, total) {
    const tbody = document.querySelector('#freqTable tbody');
    tbody.innerHTML = '';

    const sorted = [...freqMap.entries()].sort((a, b) => b[1] - a[1]);
    const maxFreq = sorted[0][1];

    for (const [ch, freq] of sorted) {
      const prob = (freq / total * 100).toFixed(2);
      const pct  = (freq / maxFreq * 100).toFixed(1);
      const tr   = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeChar(ch)}</td>
        <td>${freq.toLocaleString()}</td>
        <td>${prob}%</td>
        <td class="freq-bar-cell">
          <div class="freq-bar-bg">
            <div class="freq-bar-fill" style="width:${pct}%"></div>
          </div>
        </td>`;
      tbody.appendChild(tr);
    }
  }

  /* ── Code table ───────────────────────────────────────── */
  function renderCodeTable(freqMap, codeTable) {
    const tbody = document.querySelector('#codeTable tbody');
    tbody.innerHTML = '';

    const sorted = [...codeTable.entries()].sort((a, b) => a[1].length - b[1].length);
    for (const [ch, code] of sorted) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeChar(ch)}</td>
        <td>${(freqMap.get(ch) || 0).toLocaleString()}</td>
        <td style="color:var(--accent);letter-spacing:0.05em">${code}</td>
        <td>${code.length}</td>`;
      tbody.appendChild(tr);
    }
  }

  /* ── Binary preview ───────────────────────────────────── */
  function renderBinaryPreview(bits) {
    const preview = bits.slice(0, 2000);
    let html = '';
    for (const b of preview) {
      html += `<span class="bit-${b}">${b}</span>`;
    }
    if (bits.length > 2000) html += `<span style="color:var(--muted)"> … (${(bits.length - 2000).toLocaleString()} more bits)</span>`;
    binaryView.innerHTML = html;
  }

  /* ── Tabs ─────────────────────────────────────────────── */
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });

  function activateTab(name) {
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${name}`));
  }

  /* ── Tree zoom ────────────────────────────────────────── */
  treeZoom.addEventListener('input', () => {
    if (state.treeRenderer) state.treeRenderer.setZoom(parseFloat(treeZoom.value));
  });

  /* ── Export tree PNG ──────────────────────────────────── */
  btnExportTree.addEventListener('click', () => {
    if (state.treeRenderer) state.treeRenderer.exportPNG(`huffman-tree-${state.filename}.png`);
  });

  /* ── Download .huff ───────────────────────────────────── */
  btnDownloadBin.addEventListener('click', () => {
    if (!state.result) return;
    const blob = new Blob([state.result.fileBuffer], { type: 'application/octet-stream' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${state.filename}.huff`;
    a.click();
    URL.revokeObjectURL(url);
  });

  /* ── Decompress & verify ──────────────────────────────── */
  btnDecompress.addEventListener('click', () => {
    if (!state.result || !state.originalText) return;

    try {
      const decompressed = HuffmanCoder.decompress(state.result.fileBuffer);
      const match = decompressed === state.originalText;
      state.decompressedText = decompressed;

      verifyPanel.style.display = 'block';
      verifyIcon.textContent = match ? '✅' : '';
      verifyMsg.textContent  = match
        ? 'Decompressed text matches original — lossless ✓'
        : 'Decompressed text';
      verifyMsg.style.color = match ? 'var(--accent)' : 'var(--danger)';
      decompressedPreview.value = decompressed.length > 5000
        ? decompressed.slice(0, 5000) + `\n…[preview truncated — showing 5,000 of ${decompressed.length.toLocaleString()} characters. Use "Download Decompressed Text" for the full file.]`
        : decompressed;
    } catch (err) {
      alert('Decompression error: ' + err.message);
    }
  });

  /* ── Download decompressed text ───────────────────────── */
  btnDownloadText.addEventListener('click', () => {
    if (state.decompressedText === null) return;
    const blob = new Blob([state.decompressedText], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${state.filename}-decompressed.txt`;
    a.click();
    URL.revokeObjectURL(url);
  });

  /* ── Reset ────────────────────────────────────────────── */
  btnReset.addEventListener('click', reset);

  function reset() {
    state = { originalText: null, result: null, treeRenderer: null, filename: 'output', decompressedText: null };
    dropZone.style.display  = '';
    statsBar.style.display  = 'none';
    actions.style.display   = 'none';
    tabs.style.display      = 'none';
    tabContent.style.display = 'none';
    verifyPanel.style.display = 'none';
    progressWrap.style.display = 'none';
    fileInput.value = '';
  }

  /* ── Progress helpers ─────────────────────────────────── */
  function showProgress(label, pct) {
    progressWrap.style.display = 'block';
    progressBar.style.width    = pct + '%';
    progressLabel.textContent  = label;
  }

  function hideProgress() {
    progressWrap.style.display = 'none';
    progressBar.style.width    = '0%';
  }

  /* ── Utility ──────────────────────────────────────────── */
  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function escapeChar(ch) {
    const map = { ' ': '<code>SPACE</code>', '\n': '<code>\\n</code>', '\t': '<code>\\t</code>', '\r': '<code>\\r</code>' };
    if (map[ch]) return map[ch];
    if (ch.charCodeAt(0) < 32) return `<code>#${ch.charCodeAt(0)}</code>`;
    return `<code>${ch.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</code>`;
  }

})();
