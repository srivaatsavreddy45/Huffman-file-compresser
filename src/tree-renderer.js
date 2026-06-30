/* tree-renderer.js — canvas Huffman tree visualizer */
"use strict";

class TreeRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.zoom = 1;
    this._root = null;
  }

  setZoom(z) {
    this.zoom = z;
    if (this._root) this.render(this._root);
  }

  static charLabel(ch) {
    const map = { ' ': 'SP', '\n': '\\n', '\t': '\\t', '\r': '\\r', '\0': 'NUL' };
    return map[ch] || (ch.charCodeAt(0) < 32 ? `#${ch.charCodeAt(0)}` : ch);
  }

  exportPNG(filename = 'huffman-tree.png') {
    const link = document.createElement('a');
    link.download = filename;
    link.href = this.canvas.toDataURL('image/png');
    link.click();
  }

  render(root) {
    this._root = root;
    const { ctx, canvas } = this;

    // assign x (leaf order, averaged up) and depth to every node
    let leafIndex = 0, maxDepth = 0;
    const nodes = [];
    (function assign(node, depth) {
      if (!node) return;
      node._depth = depth;
      maxDepth = Math.max(maxDepth, depth);
      if (node.isLeaf) {
        node._x = leafIndex++;
      } else {
        assign(node.left, depth + 1);
        assign(node.right, depth + 1);
        node._x = (node.left._x + node.right._x) / 2;
      }
      nodes.push(node);
    })(root, 0);

    const R = 22, HGAP = 56, VGAP = 72, PAD = 60;
    const W = Math.max(640, leafIndex * HGAP + PAD * 2);
    const H = (maxDepth + 1) * VGAP + PAD * 2;
    canvas.width = Math.ceil(W * this.zoom);
    canvas.height = Math.ceil(H * this.zoom);
    ctx.setTransform(this.zoom, 0, 0, this.zoom, 0, 0);
    ctx.fillStyle = '#161922';
    ctx.fillRect(0, 0, W, H);

    const x = n => PAD + n._x * HGAP, y = n => PAD + n._depth * VGAP;

    (function drawEdges(node) {
      if (!node) return;
      for (const [child, bit, dx] of [[node.left, '0', -8], [node.right, '1', 4]]) {
        if (!child) continue;
        ctx.beginPath();
        ctx.moveTo(x(node), y(node));
        ctx.lineTo(x(child), y(child));
        ctx.strokeStyle = '#2a3040';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#6b7896';
        ctx.font = '11px monospace';
        ctx.fillText(bit, (x(node) + x(child)) / 2 + dx, (y(node) + y(child)) / 2);
        drawEdges(child);
      }
    })(root);

    (function drawNodes(node) {
      if (!node) return;
      const cx = x(node), cy = y(node);
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = node.isLeaf ? '#00e5a0' : '#1e2330';
      ctx.fill();
      ctx.strokeStyle = node.isLeaf ? '#007aff' : '#2a3040';
      ctx.lineWidth = node.isLeaf ? 2 : 1.5;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (node.isLeaf && node.char !== null) {
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(TreeRenderer.charLabel(node.char), cx, cy - 4);
        ctx.font = '9px monospace';
        ctx.fillText(node.freq, cx, cy + 7);
      } else {
        ctx.fillStyle = '#6b7896';
        ctx.font = '10px monospace';
        ctx.fillText(node.freq, cx, cy);
      }
      drawNodes(node.left);
      drawNodes(node.right);
    })(root);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}

window.TreeRenderer = TreeRenderer;
