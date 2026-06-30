# HuffZip — Real-Time .txt Compressor (Huffman Coding)
https://srivaatsavreddy45.github.io/Huffman-file-compresser/

> Browser-native lossless compression for `.txt` files using Huffman Coding.  
> Achieves **50–60% size reduction** · Zero server · No data leaves your device.

---

## Features

- **Full Huffman pipeline** — frequency analysis → min-heap tree → binary encoding/decoding
- **Frequency Table** — every character ranked by occurrence with visual bars
- **Huffman Code Table** — each character's assigned bitcode and length
- **Interactive Tree Visualizer** — zoomable canvas rendering, export as PNG
- **Binary Preview** — first 2 000 bits of the encoded bitstream, colour-coded
- **Lossless verification** — decompress in-browser and confirm byte-perfect match
- **Download `.huff`** — self-contained binary file (header + packed bits)
- **Responsive UI** — works on desktop, tablet, and mobile
- **Zero dependencies** — vanilla HTML, CSS, and JavaScript

---

## Project Structure

```
huffman-compressor/
├── index.html            # App shell
├── assets/
│   └── style.css         # Design tokens & layout
├── src/
│   ├── huffman.js        # Core algorithm (MinHeap, HNode, HuffmanCoder)
│   ├── tree-renderer.js  # Canvas tree visualizer (TreeRenderer)
│   └── ui.js             # UI controller (drag-drop, tabs, download, verify)
└── README.md
```

---

## How to Run (Windows — all methods)

### Method 1: Double-click (simplest)

> Works in Chrome 89+, Edge 89+, Firefox 90+

1. Open File Explorer and navigate to the `huffman-compressor` folder.
2. Double-click **`index.html`**.
3. The app opens in your default browser.

> ⚠️ If the browser shows a blank page or security warning, use Method 2.

---

### Method 2: Python local server (recommended)

Python ships with a built-in HTTP server. No installation required if Python is already present.

**Check if Python is installed:**
```cmd
python --version
```
If not installed → download from https://www.python.org/downloads/ (check "Add to PATH").

**Start the server:**
```cmd
cd path\to\huffman-compressor
python -m http.server 8080
```

**Open in browser:**
```
http://localhost:8080
```

To stop the server: press `Ctrl + C` in the Command Prompt window.

---

### Method 3: Node.js `serve` package

**Install Node.js** from https://nodejs.org (LTS version).

**Install `serve` globally (one-time):**
```cmd
npm install -g serve
```

**Run:**
```cmd
cd path\to\huffman-compressor
serve .
```

Open the URL shown (usually `http://localhost:3000`).

---

### Method 4: VS Code Live Server (if using VS Code)

1. Install the **Live Server** extension by Ritwick Dey.
2. Open the `huffman-compressor` folder in VS Code.
3. Right-click `index.html` → **Open with Live Server**.
4. Browser opens automatically at `http://127.0.0.1:5500`.

---

### Method 5: Node.js one-liner (no package needed)

```cmd
cd path\to\huffman-compressor
node -e "require('http').createServer((q,r)=>{require('fs').readFile('.'+q.url.replace(/\/$/,'/index.html'),function(e,d){r.writeHead(e?404:200);r.end(d)})}).listen(8080,()=>console.log('http://localhost:8080'))"
```

---

## Using the App

1. **Drop or browse** a `.txt` file onto the upload zone.
2. Watch the **progress bar** as the file is analysed and encoded.
3. View **stats** — original size, compressed size, % reduction, ratio, and Shannon entropy.
4. Explore the tabs:
   - **Frequency Table** — character distribution
   - **Huffman Codes** — assigned bit patterns, shortest = most frequent
   - **Tree Visualizer** — the actual binary tree; use the zoom slider; export PNG
   - **Binary Preview** — raw bitstream colour-coded (0 = dim, 1 = green)
5. Click **Download Compressed (.huff)** to save the binary file.
6. Click **Decompress & Verify** to reconstruct the text in-browser and confirm lossless match.
7. Click **Reset** to load a new file.

---

## .huff File Format

```
[4 bytes — header length (uint32 big-endian)]
[N bytes — JSON header: { "char": frequency, … }]
[1 byte  — padding bit count]
[M bytes — packed Huffman bitstream]
```

The file is self-contained: the frequency map in the header is used to rebuild the tree and decode the payload.

---

## Algorithm Details

| Step | Description |
|------|-------------|
| Frequency analysis | Count occurrences of every unique character in O(n) |
| Min-heap | Priority queue ordered by frequency |
| Tree construction | Repeatedly merge two lowest-frequency nodes until one root remains |
| Code assignment | Traverse tree: left edge = 0, right edge = 1 |
| Encoding | Replace each character with its Huffman code |
| Bit packing | Pack bitstring into bytes; store padding count in first byte |
| Header | Serialize frequency map as JSON; prepend with 4-byte length |
| Decoding | Parse header → rebuild tree → unpack bits → walk tree |

**Shannon Entropy** (lower bound on achievable compression):
```
H = -Σ p(x) · log₂(p(x))
```

---

## Browser Compatibility

| Browser | Minimum Version |
|---------|----------------|
| Chrome  | 89+ |
| Edge    | 89+ |
| Firefox | 90+ |
| Safari  | 14+ |

---

## License

MIT — free to use, modify, and distribute.
