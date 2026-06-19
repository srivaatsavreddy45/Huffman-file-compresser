/**
 * huffman.js — Full Huffman Coding Engine
 * Frequency analysis → Min-heap tree → Bit encoding → Zero-loss decoding
 */

"use strict";

/* ── Min-Heap (priority queue) ────────────────────────────── */
class MinHeap {
  constructor() { this.heap = []; }

  push(node) {
    this.heap.push(node);
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  get size() { return this.heap.length; }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.heap[parent].freq <= this.heap[i].freq) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  _sinkDown(i) {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.heap[l].freq < this.heap[smallest].freq) smallest = l;
      if (r < n && this.heap[r].freq < this.heap[smallest].freq) smallest = r;
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}

/* ── Huffman Node ─────────────────────────────────────────── */
class HNode {
  constructor(char, freq, left = null, right = null) {
    this.char  = char;   // null for internal nodes
    this.freq  = freq;
    this.left  = left;
    this.right = right;
  }
  get isLeaf() { return this.left === null && this.right === null; }
}

/* ── Core HuffmanCoder class ──────────────────────────────── */
class HuffmanCoder {

  /**
   * Build frequency map from text.
   * @param {string} text
   * @returns {Map<string,number>}
   */
  static buildFrequencyMap(text) {
    const freq = new Map();
    for (const ch of text) {
      freq.set(ch, (freq.get(ch) || 0) + 1);
    }
    return freq;
  }

  /**
   * Build Huffman tree from frequency map.
   * @param {Map<string,number>} freqMap
   * @returns {HNode} root
   */
  static buildTree(freqMap) {
    if (freqMap.size === 0) throw new Error("Empty input");

    const heap = new MinHeap();
    for (const [char, freq] of freqMap) {
      heap.push(new HNode(char, freq));
    }

    // Edge case: single unique character
    if (heap.size === 1) {
      const only = heap.pop();
      return new HNode(null, only.freq, only, new HNode('\0', 0));
    }

    while (heap.size > 1) {
      const left  = heap.pop();
      const right = heap.pop();
      heap.push(new HNode(null, left.freq + right.freq, left, right));
    }

    return heap.pop();
  }

  /**
   * Generate code table from tree.
   * @param {HNode} root
   * @returns {Map<string,string>} char → bitstring
   */
  static buildCodeTable(root) {
    const codes = new Map();
    const traverse = (node, prefix) => {
      if (!node) return;
      if (node.isLeaf) {
        codes.set(node.char, prefix || '0'); // single-char edge case
        return;
      }
      traverse(node.left,  prefix + '0');
      traverse(node.right, prefix + '1');
    };
    traverse(root, '');
    return codes;
  }

  /**
   * Encode text to a bitstring.
   * @param {string} text
   * @param {Map<string,string>} codeTable
   * @returns {string} bitstring e.g. "010110..."
   */
  static encode(text, codeTable) {
    const parts = [];
    for (const ch of text) {
      parts.push(codeTable.get(ch));
    }
    return parts.join('');
  }

  /**
   * Decode a bitstring back to text using the tree.
   * @param {string} bits
   * @param {HNode} root
   * @returns {string}
   */
  static decode(bits, root) {
    if (!root) return '';
    const out = [];
    let node = root;
    for (const bit of bits) {
      node = bit === '0' ? node.left : node.right;
      if (node.isLeaf) {
        out.push(node.char);
        node = root;
      }
    }
    return out.join('');
  }

  /**
   * Pack a bitstring into a Uint8Array (with a padding byte at the front).
   * Format: [paddingBits (1 byte)] [packed bytes...]
   * @param {string} bits
   * @returns {Uint8Array}
   */
  static packBits(bits) {
    const padding = (8 - (bits.length % 8)) % 8;
    const padded  = bits + '0'.repeat(padding);
    const bytes   = new Uint8Array(1 + padded.length / 8);
    bytes[0] = padding;
    for (let i = 0; i < padded.length; i += 8) {
      bytes[1 + i / 8] = parseInt(padded.slice(i, i + 8), 2);
    }
    return bytes;
  }

  /**
   * Unpack a Uint8Array back to a bitstring.
   * @param {Uint8Array} bytes
   * @returns {string}
   */
  static unpackBits(bytes) {
    const padding = bytes[0];
    let bits = '';
    for (let i = 1; i < bytes.length; i++) {
      bits += bytes[i].toString(2).padStart(8, '0');
    }
    return bits.slice(0, bits.length - padding);
  }

  /**
   * Serialize frequency map to JSON bytes for embedding in the .huff file.
   * @param {Map<string,number>} freqMap
   * @returns {Uint8Array}
   */
  static serializeHeader(freqMap) {
    const obj = {};
    for (const [ch, freq] of freqMap) obj[ch] = freq;
    const json = JSON.stringify(obj);
    const enc  = new TextEncoder();
    return enc.encode(json);
  }

  /**
   * Deserialize frequency map from bytes.
   * @param {Uint8Array} bytes
   * @returns {Map<string,number>}
   */
  static deserializeHeader(bytes) {
    const dec  = new TextDecoder();
    const json = dec.decode(bytes);
    const obj  = JSON.parse(json);
    return new Map(Object.entries(obj).map(([k, v]) => [k, v]));
  }

  /**
   * Build a complete .huff binary file:
   *   [4 bytes: header length (uint32 BE)] [header JSON bytes] [packed data bytes]
   * @param {Uint8Array} headerBytes
   * @param {Uint8Array} dataBytes
   * @returns {Uint8Array}
   */
  static buildFileBuffer(headerBytes, dataBytes) {
    const buf = new Uint8Array(4 + headerBytes.length + dataBytes.length);
    const hLen = headerBytes.length;
    buf[0] = (hLen >>> 24) & 0xff;
    buf[1] = (hLen >>> 16) & 0xff;
    buf[2] = (hLen >>>  8) & 0xff;
    buf[3] =  hLen         & 0xff;
    buf.set(headerBytes, 4);
    buf.set(dataBytes,   4 + hLen);
    return buf;
  }

  /**
   * Parse a .huff file buffer back into header + data.
   * @param {Uint8Array} buf
   * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
   */
  static parseFileBuffer(buf) {
    const hLen = (buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3];
    return {
      headerBytes: buf.slice(4, 4 + hLen),
      dataBytes:   buf.slice(4 + hLen)
    };
  }

  /**
   * Calculate Shannon entropy for the frequency map.
   * @param {Map<string,number>} freqMap
   * @param {number} total
   * @returns {number} bits per character
   */
  static entropy(freqMap, total) {
    let H = 0;
    for (const freq of freqMap.values()) {
      const p = freq / total;
      if (p > 0) H -= p * Math.log2(p);
    }
    return H;
  }

  /**
   * Full pipeline: text → { bitstring, packedBytes, fileBuffer, codeTable, tree, freqMap, stats }
   * @param {string} text
   * @returns {object}
   */
  static compress(text) {
    const freqMap     = HuffmanCoder.buildFrequencyMap(text);
    const tree        = HuffmanCoder.buildTree(freqMap);
    const codeTable   = HuffmanCoder.buildCodeTable(tree);
    const bitstring   = HuffmanCoder.encode(text, codeTable);
    const packedBytes = HuffmanCoder.packBits(bitstring);
    const headerBytes = HuffmanCoder.serializeHeader(freqMap);
    const fileBuffer  = HuffmanCoder.buildFileBuffer(headerBytes, packedBytes);

    const origBytes  = new TextEncoder().encode(text).length;
    const compBytes  = fileBuffer.length;
    const reduction  = ((1 - compBytes / origBytes) * 100).toFixed(1);
    const ratio      = (origBytes / compBytes).toFixed(2);
    const ent        = HuffmanCoder.entropy(freqMap, text.length).toFixed(4);

    return {
      bitstring, packedBytes, fileBuffer, codeTable, tree, freqMap,
      stats: {
        origBytes, compBytes,
        reduction: parseFloat(reduction),
        ratio:     parseFloat(ratio),
        entropy:   parseFloat(ent)
      }
    };
  }

  /**
   * Full pipeline: fileBuffer → decompressed text
   * @param {Uint8Array} fileBuffer
   * @returns {string}
   */
  static decompress(fileBuffer) {
    const { headerBytes, dataBytes } = HuffmanCoder.parseFileBuffer(fileBuffer);
    const freqMap  = HuffmanCoder.deserializeHeader(headerBytes);
    const tree     = HuffmanCoder.buildTree(freqMap);
    const bitstring = HuffmanCoder.unpackBits(dataBytes);
    return HuffmanCoder.decode(bitstring, tree);
  }
}

// Export for browser globals
window.HuffmanCoder = HuffmanCoder;
window.HNode        = HNode;
