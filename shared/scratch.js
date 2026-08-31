/* shared/scratch.js — 手寫草稿 Widget
 * 使用方式：<link rel="stylesheet" href="shared/scratch.css">
 *           <script src="shared/scratch.js"></script>
 *           <script>initScratchWidget();</script>
 */
(function () {
  'use strict';

  var isOpen  = false;
  var tool    = 'pen';
  var drawing = false;
  var canvas, ctx;

  var PENCIL_LG =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"'
    + ' stroke="currentColor" stroke-width="2.2"'
    + ' stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>'
    + '</svg>';

  var PENCIL_SM =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"'
    + ' stroke="currentColor" stroke-width="2.2"'
    + ' stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>'
    + '</svg>';

  var ERASER_SM =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"'
    + ' stroke="currentColor" stroke-width="2.2"'
    + ' stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/>'
    + '<path d="M22 21H7"/>'
    + '<path d="m5 11 9 9"/>'
    + '</svg>';

  /* ── 注入 DOM ── */
  function injectHTML() {
    var btn = document.createElement('button');
    btn.id        = 'scratch-widget-btn';
    btn.className = 'scratch-btn';
    btn.title     = '手寫草稿';
    btn.setAttribute('aria-label', '手寫草稿');
    btn.innerHTML = PENCIL_LG;
    document.body.appendChild(btn);

    var panel = document.createElement('div');
    panel.id        = 'scratch-panel';
    panel.className = 'scratch-panel';
    panel.innerHTML =
      '<div class="scratch-header">'
        + '<span class="scratch-title">✏️ 手寫草稿</span>'
        + '<button class="scratch-close" id="scratch-close" aria-label="關閉">✕</button>'
      + '</div>'
      + '<div class="scratch-toolbar">'
        + '<button class="scratch-tool active" id="scratch-pen" title="畫筆">' + PENCIL_SM + '</button>'
        + '<button class="scratch-tool" id="scratch-eraser" title="橡皮擦">' + ERASER_SM + '</button>'
        + '<span class="scratch-sep"></span>'
        + '<button class="scratch-clear-btn" id="scratch-clear">清除全部</button>'
      + '</div>'
      + '<canvas id="scratch-canvas" class="scratch-canvas"></canvas>';
    document.body.appendChild(panel);

    btn.addEventListener('click', togglePanel);
    document.getElementById('scratch-close').addEventListener('click', closePanel);
    document.getElementById('scratch-pen').addEventListener('click', function () { setTool('pen'); });
    document.getElementById('scratch-eraser').addEventListener('click', function () { setTool('eraser'); });
    document.getElementById('scratch-clear').addEventListener('click', clearCanvas);

    canvas = document.getElementById('scratch-canvas');
    ctx    = canvas.getContext('2d');
    setupDrawing();
    window.addEventListener('resize', function () { if (isOpen) { clearCanvas(); sizeCanvas(); } });
  }

  /* ── 面板開關 ── */
  function togglePanel() { isOpen ? closePanel() : openPanel(); }

  function openPanel() {
    document.getElementById('scratch-panel').classList.add('open');
    document.getElementById('scratch-widget-btn').classList.add('s-active');
    isOpen = true;
    requestAnimationFrame(sizeCanvas);
  }

  function closePanel() {
    document.getElementById('scratch-panel').classList.remove('open');
    document.getElementById('scratch-widget-btn').classList.remove('s-active');
    isOpen = false;
  }

  /* ── 工具切換 ── */
  function setTool(t) {
    tool = t;
    document.getElementById('scratch-pen').classList.toggle('active', t === 'pen');
    document.getElementById('scratch-eraser').classList.toggle('active', t === 'eraser');
    canvas.style.cursor = t === 'eraser' ? 'cell' : 'crosshair';
  }

  /* ── 清空畫布 ── */
  function clearCanvas() {
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  /* ── 畫布尺寸（高 DPI 支援） ── */
  function sizeCanvas() {
    if (!canvas || !isOpen) return;
    var dpr = window.devicePixelRatio || 1;
    var w   = canvas.offsetWidth;
    var h   = canvas.offsetHeight;
    if (!w || !h) return;
    canvas.width  = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.scale(dpr, dpr);
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';
  }

  /* ── 繪圖（Pointer Events，同時支援滑鼠與觸控） ── */
  function setupDrawing() {
    canvas.addEventListener('pointerdown', function (e) {
      drawing = true;
      canvas.setPointerCapture(e.pointerId);
      var p = canvasPos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      applyStyle();
      e.preventDefault();
    });

    canvas.addEventListener('pointermove', function (e) {
      if (!drawing) return;
      var p = canvasPos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      e.preventDefault();
    });

    canvas.addEventListener('pointerup', function (e) {
      drawing = false;
      ctx.closePath();
      e.preventDefault();
    });

    canvas.addEventListener('pointercancel', function () { drawing = false; });
  }

  function applyStyle() {
    if (tool === 'pen') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#000';
      ctx.lineWidth   = 2.5;
    } else {
      /* destination-out 讓畫素透明，顯示 CSS background（白色） */
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth   = 24;
    }
  }

  function canvasPos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /* ── 公開 API ── */
  window.initScratchWidget = function () {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectHTML);
    } else {
      injectHTML();
    }
  };
})();
