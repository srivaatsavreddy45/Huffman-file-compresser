/* huffman.js — frequency analysis, min-heap tree build, bit packing, lossless decode */
"use strict";

class MinHeap {
  constructor() { this.heap = []; }
  get size() { return this.heap.length; }
  push(node) {
    this.heap.push(node);
    let i = this.heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.heap[p].freq <= this.heap[i].freq) break;
      [this.heap[p], this.heap[i]] = [this.heap[i], this.heap[p]];
      i = p;
    }
  }
  pop() {
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length) {
      this.heap[0] = last;
      let i = 0, n = this.heap.length;
      while (true) {
        let m = i, l = 2 * i + 1, r = 2 * i + 2;
        if (l < n && this.heap[l].freq < this.heap[m].freq) m = l;
        if (r < n && this.heap[r].freq < this.heap[m].freq) m = r;
        if (m === i) break;
        [this.heap[m], this.heap[i]] = [this.heap[i], this.heap[m]];
        i = m;
      }
    }
    return top;
  }
}

class HNode {
  constructor(char, freq, left = null, right = null) {
    this.char = char; this.freq = freq; this.left = left; this.right = right;
  }
  get isLeaf() { return !this.left && !this.right; }
}

class HuffmanCoder {
  static buildFrequencyMap(text) {
    const freq = new Map();
    for (const ch of text) freq.set(ch, (freq.get(ch) || 0) + 1);
    return freq;
  }

  static buildTree(freqMap) {
    if (freqMap.size === 0) throw new Error("Empty input");
    const heap = new MinHeap();
    for (const [char, freq] of freqMap) heap.push(new HNode(char, freq));
    if (heap.size === 1) {
      const only = heap.pop();
      return new HNode(null, only.freq, only, new HNode('\0', 0));
    }
    while (heap.size > 1) {
      const left = heap.pop(), right = heap.pop();
      heap.push(new HNode(null, left.freq + right.freq, left, right));
    }
    return heap.pop();
  }

  static buildCodeTable(root) {
    const codes = new Map();
    (function walk(node, prefix) {
      if (!node) return;
      if (node.isLeaf) { codes.set(node.char, prefix || '0'); return; }
      walk(node.left, prefix + '0');
      walk(node.right, prefix + '1');
    })(root, '');
    return codes;
  }

  static encode(text, codeTable) {
    let bits = '';
    for (const ch of text) bits += codeTable.get(ch);
    return bits;
  }

  static decode(bits, root) {
    const out = [];
    let node = root;
    for (const bit of bits) {
      node = bit === '0' ? node.left : node.right;
      if (node.isLeaf) { out.push(node.char); node = root; }
    }
    return out.join('');
  }

  // [1 padding byte][packed bytes]
  static packBits(bits) {
    const padding = (8 - (bits.length % 8)) % 8;
    const padded = bits + '0'.repeat(padding);
    const bytes = new Uint8Array(1 + padded.length / 8);
    bytes[0] = padding;
    for (let i = 0; i < padded.length; i += 8) bytes[1 + i / 8] = parseInt(padded.slice(i, i + 8), 2);
    return bytes;
  }

  static unpackBits(bytes) {
    const padding = bytes[0];
    let bits = '';
    for (let i = 1; i < bytes.length; i++) bits += bytes[i].toString(2).padStart(8, '0');
    return bits.slice(0, bits.length - padding);
  }

  static serializeHeader(freqMap) {
    // Array of [char, freq] pairs (not an object) — object keys that look like
    // integers get silently reordered by JS, which would change tie-breaking
    // order in the min-heap and produce a different tree on decode.
    return new TextEncoder().encode(JSON.stringify([...freqMap]));
  }

  static deserializeHeader(bytes) {
    return new Map(JSON.parse(new TextDecoder().decode(bytes)));
  }

  // [4 byte header length][header JSON][packed data]
  static buildFileBuffer(headerBytes, dataBytes) {
    const buf = new Uint8Array(4 + headerBytes.length + dataBytes.length);
    new DataView(buf.buffer).setUint32(0, headerBytes.length);
    buf.set(headerBytes, 4);
    buf.set(dataBytes, 4 + headerBytes.length);
    return buf;
  }

  static parseFileBuffer(buf) {
    const hLen = new DataView(buf.buffer, buf.byteOffset, 4).getUint32(0);
    return { headerBytes: buf.slice(4, 4 + hLen), dataBytes: buf.slice(4 + hLen) };
  }

  static entropy(freqMap, total) {
    let H = 0;
    for (const freq of freqMap.values()) {
      const p = freq / total;
      if (p > 0) H -= p * Math.log2(p);
    }
    return H;
  }

  static compress(text) {
    const freqMap = HuffmanCoder.buildFrequencyMap(text);
    const tree = HuffmanCoder.buildTree(freqMap);
    const codeTable = HuffmanCoder.buildCodeTable(tree);
    const bitstring = HuffmanCoder.encode(text, codeTable);
    const packedBytes = HuffmanCoder.packBits(bitstring);
    const headerBytes = HuffmanCoder.serializeHeader(freqMap);
    const fileBuffer = HuffmanCoder.buildFileBuffer(headerBytes, packedBytes);

    const origBytes = new TextEncoder().encode(text).length;
    const compBytes = fileBuffer.length;

    return {
      bitstring, packedBytes, fileBuffer, codeTable, tree, freqMap,
      stats: {
        origBytes, compBytes,
        reduction: parseFloat(((1 - compBytes / origBytes) * 100).toFixed(1)),
        ratio: parseFloat((origBytes / compBytes).toFixed(2)),
        entropy: parseFloat(HuffmanCoder.entropy(freqMap, text.length).toFixed(4))
      }
    };
  }

  static decompress(fileBuffer) {
    const { headerBytes, dataBytes } = HuffmanCoder.parseFileBuffer(fileBuffer);
    const freqMap = HuffmanCoder.deserializeHeader(headerBytes);
    const tree = HuffmanCoder.buildTree(freqMap);
    return HuffmanCoder.decode(HuffmanCoder.unpackBits(dataBytes), tree);
  }
}

window.HuffmanCoder = HuffmanCoder;
window.HNode = HNode;

