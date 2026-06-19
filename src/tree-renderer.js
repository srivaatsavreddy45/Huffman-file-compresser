/**
 * tree-renderer.js — Canvas Huffman Tree Visualizer
 * Renders the binary tree with node labels, frequencies, and edges.
 */

"use strict";

class TreeRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.zoom   = 1;
    this._root  = null;
    this._layout = null;
  }

  setZoom(z) {
    this.zoom = z;
    if (this._root) this.render(this._root);
  }

  /**
   * Layout the tree: assign x/y positions.
   * Uses a simple recursive approach with horizontal spacing.
   */
  _layout_tree(root) {
    // First pass: count leaves for x-spacing
    const nodeList = [];
    let leafIndex = 0;

    const assignX = (node, depth) => {
      if (!node) return;
      node._depth = depth;
      if (node.isLeaf) {
        node._x = leafIndex++;
      } else {
        assignX(node.left,  depth + 1);
        assignX(node.right, depth + 1);
        node._x = (node.left._x + node.right._x) / 2;
      }
      nodeList.push(node);
    };
    assignX(root, 0);
    return { nodeList, leafCount: leafIndex };
  }

  render(root) {
    this._root = root;
    const canvas = this.canvas;
    const ctx    = this.ctx;

    // Compute layout
    const { nodeList, leafCount } = this._layout_tree(root);

    // Sizing
    const NODE_R  = 22;
    const H_GAP   = 56;   // horizontal gap between leaves
    const V_GAP   = 72;   // vertical gap between levels
    const PAD     = 60;

    // Determine max depth
    let maxDepth = 0;
    for (const n of nodeList) if (n._depth > maxDepth) maxDepth = n._depth;

    const W = Math.max(640, leafCount * H_GAP + PAD * 2);
    const H = (maxDepth + 1) * V_GAP + PAD * 2;

    canvas.width  = Math.ceil(W * this.zoom);
    canvas.height = Math.ceil(H * this.zoom);

    ctx.scale(this.zoom, this.zoom);
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#161922';
    ctx.fillRect(0, 0, W, H);

    // Helpers: actual x/y from tree coordinates
    const nx = n => PAD + n._x * H_GAP;
    const ny = n => PAD + n._depth * V_GAP;

    // Draw edges first
    const drawEdges = (node) => {
      if (!node) return;
      if (node.left) {
        ctx.beginPath();
        ctx.moveTo(nx(node), ny(node));
        ctx.lineTo(nx(node.left), ny(node.left));
        ctx.strokeStyle = '#2a3040';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Edge label
        const ex = (nx(node) + nx(node.left)) / 2 - 8;
        const ey = (ny(node) + ny(node.left)) / 2;
        ctx.fillStyle = '#6b7896';
        ctx.font = '11px monospace';
        ctx.fillText('0', ex, ey);
        drawEdges(node.left);
      }
      if (node.right) {
        ctx.beginPath();
        ctx.moveTo(nx(node), ny(node));
        ctx.lineTo(nx(node.right), ny(node.right));
        ctx.strokeStyle = '#2a3040';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        const ex = (nx(node) + nx(node.right)) / 2 + 4;
        const ey = (ny(node) + ny(node.right)) / 2;
        ctx.fillStyle = '#6b7896';
        ctx.font = '11px monospace';
        ctx.fillText('1', ex, ey);
        drawEdges(node.right);
      }
    };
    drawEdges(root);

    // Draw nodes
    const drawNodes = (node) => {
      if (!node) return;

      const x = nx(node);
      const y = ny(node);
      const isLeaf = node.isLeaf;

      // Circle
      ctx.beginPath();
      ctx.arc(x, y, NODE_R, 0, Math.PI * 2);

      if (isLeaf) {
        ctx.fillStyle = '#00e5a0';
        ctx.fill();
        ctx.strokeStyle = '#007aff';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillStyle = '#1e2330';
        ctx.fill();
        ctx.strokeStyle = '#2a3040';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Character label (leaf nodes)
      if (isLeaf && node.char !== null) {
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = TreeRenderer.charLabel(node.char);
        ctx.fillText(label, x, y - 4);
        ctx.font = '9px monospace';
        ctx.fillText(node.freq, x, y + 7);
      } else {
        // Internal node: show frequency
        ctx.fillStyle = '#6b7896';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.freq, x, y);
      }

      drawNodes(node.left);
      drawNodes(node.right);
    };
    drawNodes(root);

    // Reset scale for next render
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /**
   * Convert special chars to readable labels.
   */
  static charLabel(ch) {
    const map = { ' ': 'SP', '\n': '\\n', '\t': '\\t', '\r': '\\r', '\0': 'NUL' };
    return map[ch] || (ch.charCodeAt(0) < 32 ? `#${ch.charCodeAt(0)}` : ch);
  }

  /**
   * Export canvas as PNG and trigger download.
   */
  exportPNG(filename = 'huffman-tree.png') {
    const link = document.createElement('a');
    link.download = filename;
    link.href = this.canvas.toDataURL('image/png');
    link.click();
  }
}

window.TreeRenderer = TreeRenderer;
