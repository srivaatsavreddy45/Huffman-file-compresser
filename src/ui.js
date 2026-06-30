/* ui.js — file input, drag-drop, tab switching, progress, download, verify */
"use strict";

(function () {
  const $ = id => document.getElementById(id);
  const dropZone = $('dropZone'), fileInput = $('fileInput'), statsBar = $('statsBar');
  const progressWrap = $('progressWrap'), progressBar = $('progressBar'), progressLabel = $('progressLabel');
  const actions = $('actions'), tabs = $('tabs'), tabContent = $('tabContent'), verifyPanel = $('verifyPanel');
  const treeCanvas = $('treeCanvas'), treeZoom = $('treeZoom'), binaryView = $('binaryView');
  const verifyIcon = $('verifyIcon'), verifyMsg = $('verifyMsg'), decompressedPreview = $('decompressedPreview');

  let state = { originalText: null, result: null, treeRenderer: null, filename: 'output', decompressedText: null };

  /* drag & drop */
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  });
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => fileInput.files[0] && loadFile(fileInput.files[0]));

  function loadFile(file) {
    if (!file.name.endsWith('.txt') && file.type !== 'text/plain') return alert('Please select a .txt file.');
    state.filename = file.name.replace(/\.txt$/, '');
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target.result;
      if (!text) return alert('File is empty.');
      state.originalText = text;
      runCompression(text);
    };
    reader.readAsText(file);
  }

  function runCompression(text) {
    progressWrap.style.display = 'block';
    progressBar.style.width = '40%';
    progressLabel.textContent = 'Building Huffman tree…';

    setTimeout(() => {
      try {
        progressBar.style.width = '100%';
        progressLabel.textContent = 'Done!';
        const result = HuffmanCoder.compress(text);
        state.result = result;
        setTimeout(() => { progressWrap.style.display = 'none'; renderResults(result); }, 200);
      } catch (err) {
        progressWrap.style.display = 'none';
        alert('Compression error: ' + err.message);
      }
    }, 150);
  }

  function renderResults({ stats, freqMap, codeTable, tree, bitstring }) {
    $('origSize').textContent = formatBytes(stats.origBytes);
    $('compSize').textContent = formatBytes(stats.compBytes);
    $('reduction').textContent = stats.reduction + '%';
    $('ratio').textContent = stats.ratio + 'x';
    $('entropy').textContent = stats.entropy;
    statsBar.style.display = 'grid';

    actions.style.display = 'flex';
    tabs.style.display = 'flex';
    tabContent.style.display = 'block';
    verifyPanel.style.display = 'none';
    dropZone.style.display = 'none';

    renderTable('freqTable', [...freqMap.entries()].sort((a, b) => b[1] - a[1]), ([ch, freq]) => {
      const maxFreq = freqMap.size ? Math.max(...freqMap.values()) : 1;
      return `<td>${escapeChar(ch)}</td><td>${freq.toLocaleString()}</td>
        <td>${(freq / state.originalText.length * 100).toFixed(2)}%</td>
        <td><div class="freq-bar-bg"><div class="freq-bar-fill" style="width:${(freq / maxFreq * 100).toFixed(1)}%"></div></div></td>`;
    });

    renderTable('codeTable', [...codeTable.entries()].sort((a, b) => a[1].length - b[1].length), ([ch, code]) =>
      `<td>${escapeChar(ch)}</td><td>${(freqMap.get(ch) || 0).toLocaleString()}</td>
       <td style="color:var(--accent)">${code}</td><td>${code.length}</td>`);

    if (!state.treeRenderer) state.treeRenderer = new TreeRenderer(treeCanvas);
    state.treeRenderer.render(tree);

    const preview = bitstring.slice(0, 2000);
    binaryView.innerHTML = [...preview].map(b => `<span class="bit-${b}">${b}</span>`).join('') +
      (bitstring.length > 2000 ? `<span style="color:var(--muted)"> … (${(bitstring.length - 2000).toLocaleString()} more bits)</span>` : '');

    activateTab('frequency');
  }

  function renderTable(id, rows, rowHtml) {
    $(id).querySelector('tbody').innerHTML = rows.map(r => `<tr>${rowHtml(r)}</tr>`).join('');
  }

  document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => activateTab(btn.dataset.tab)));
  function activateTab(name) {
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${name}`));
  }

  treeZoom.addEventListener('input', () => state.treeRenderer?.setZoom(parseFloat(treeZoom.value)));
  $('btnExportTree').addEventListener('click', () => state.treeRenderer?.exportPNG(`huffman-tree-${state.filename}.png`));

  function download(content, type, filename) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  $('btnDownloadBin').addEventListener('click', () => {
    if (state.result) download(state.result.fileBuffer, 'application/octet-stream', `${state.filename}.huff`);
  });

  $('btnDecompress').addEventListener('click', () => {
    if (!state.result || !state.originalText) return;
    try {
      const decompressed = HuffmanCoder.decompress(state.result.fileBuffer);
      const match = decompressed === state.originalText;
      state.decompressedText = decompressed;

      verifyPanel.style.display = 'block';
      verifyIcon.textContent = match ? '✅' : '';
      verifyMsg.textContent = match ? 'Decompressed text matches original — lossless ✓' : 'Decompressed text does not match original';
      verifyMsg.style.color = match ? 'var(--accent)' : 'var(--danger)';
      decompressedPreview.value = decompressed.length > 5000
        ? decompressed.slice(0, 5000) + `\n…[preview truncated — showing 5,000 of ${decompressed.length.toLocaleString()} characters. Use "Download Decompressed Text" for the full file.]`
        : decompressed;
    } catch (err) {
      alert('Decompression error: ' + err.message);
    }
  });

  $('btnDownloadText').addEventListener('click', () => {
    if (state.decompressedText !== null) download(state.decompressedText, 'text/plain;charset=utf-8', `${state.filename}-decompressed.txt`);
  });

  $('btnReset').addEventListener('click', () => {
    state = { originalText: null, result: null, treeRenderer: null, filename: 'output', decompressedText: null };
    dropZone.style.display = '';
    [statsBar, actions, tabs, tabContent, verifyPanel, progressWrap].forEach(el => el.style.display = 'none');
    fileInput.value = '';
  });

  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function escapeChar(ch) {
    const map = { ' ': 'SPACE', '\n': '\\n', '\t': '\\t', '\r': '\\r' };
    if (map[ch]) return `<code>${map[ch]}</code>`;
    if (ch.charCodeAt(0) < 32) return `<code>#${ch.charCodeAt(0)}</code>`;
    return `<code>${ch.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code>`;
  }
})();
