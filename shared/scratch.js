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
  var mode    = 'paper';
  var paused  = false;
  var canvas, ctx;   // 目前模式的畫布

  /* 筆跟橡皮擦各自記自己的粗細，切換工具時滑桿會跟著換範圍／換值 */
  var penWidth     = 2.5;
  var eraserWidth  = 24;
  var PEN_RANGE    = { min: 1, max: 10, step: .5 };
  var ERASER_RANGE = { min: 8, max: 60, step: 1  };

  /* 尺寸按鍵：單擊調一次，按住連續調整（平板長按不用一直戳）*/
  var HOLD_DELAY  = 450; // 按住多久後開始連續調整
  var HOLD_REPEAT = 90;  // 連續調整間隔
  var holdTimer, holdInterval;

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
      '<div class="scratch-top">'
      + '<div class="scratch-header">'
        + '<span class="scratch-title">✏️ 手寫草稿</span>'
        + '<div class="scratch-mode-seg">'
          + '<button class="scratch-mode-btn" id="scratch-mode-paper">📄 白紙</button>'
          + '<button class="scratch-mode-btn" id="scratch-mode-screen">🖍️ 畫在畫面上</button>'
        + '</div>'
        + '<button class="scratch-close" id="scratch-close" aria-label="關閉">✕</button>'
      + '</div>'
      + '<div class="scratch-toolbar">'
        + '<button class="scratch-tool active" id="scratch-pen" title="畫筆">' + PENCIL_SM + '</button>'
        + '<button class="scratch-tool" id="scratch-eraser" title="橡皮擦">' + ERASER_SM + '</button>'
        + '<div class="scratch-size-group">'
          + '<span class="scratch-size-label">粗細</span>'
          + '<button class="scratch-size-btn" id="scratch-size-minus" aria-label="縮小">−</button>'
          + '<span class="scratch-size-val" id="scratch-size-val"></span>'
          + '<button class="scratch-size-btn" id="scratch-size-plus" aria-label="放大">＋</button>'
        + '</div>'
        + '<span class="scratch-sep"></span>'
        + '<button class="scratch-pause-btn" id="scratch-pause">👆 點畫面作答</button>'
        + '<button class="scratch-clear-btn" id="scratch-clear">清除全部</button>'
      + '</div>'
      + '</div>'
      + '<canvas id="scratch-canvas" class="scratch-canvas"></canvas>'
      + '<canvas id="scratch-overlay" class="scratch-overlay"></canvas>';
    document.body.appendChild(panel);

    var eraserCursor = document.createElement('div');
    eraserCursor.id        = 'scratch-eraser-cursor';
    eraserCursor.className = 'scratch-eraser-cursor';
    document.body.appendChild(eraserCursor);

    btn.addEventListener('click', togglePanel);
    document.getElementById('scratch-close').addEventListener('click', closePanel);
    document.getElementById('scratch-pen').addEventListener('click', function () { setTool('pen'); });
    document.getElementById('scratch-eraser').addEventListener('click', function () { setTool('eraser'); });
    document.getElementById('scratch-clear').addEventListener('click', clearCanvas);
    document.getElementById('scratch-mode-paper').addEventListener('click', function () { setMode('paper'); });
    document.getElementById('scratch-mode-screen').addEventListener('click', function () { setMode('screen'); });
    document.getElementById('scratch-pause').addEventListener('click', function () { setPaused(!paused); });
    bindHoldStep(document.getElementById('scratch-size-minus'), -1);
    bindHoldStep(document.getElementById('scratch-size-plus'), 1);

    /* 兩種模式各一張畫布，切換模式時另一張的筆跡留著 */
    [document.getElementById('scratch-canvas'), document.getElementById('scratch-overlay')].forEach(function (c) {
      c.getContext('2d');
      setupDrawing(c);
    });
    var saved = 'paper';
    try { saved = localStorage.getItem('scratch-mode') || 'paper'; } catch (e) {}
    setMode(saved === 'screen' ? 'screen' : 'paper');
    updateSizeDisplay();
    /* 畫面尺寸一變（平板轉向），畫上去的位置就對不上了，直接清掉 */
    window.addEventListener('resize', function () { if (isOpen) { clearCanvas(); sizeCanvas(); } });
  }

  /* ── 模式：paper = 全畫面白紙；screen = 透明畫布疊在目前畫面上（劃掉數字、寫借位） ── */
  function setMode(m) {
    mode = m;
    try { localStorage.setItem('scratch-mode', m); } catch (e) {}
    canvas = document.getElementById(m === 'screen' ? 'scratch-overlay' : 'scratch-canvas');
    ctx    = canvas.getContext('2d');
    document.getElementById('scratch-panel').classList.toggle('mode-screen', m === 'screen');
    document.getElementById('scratch-mode-paper').classList.toggle('active', m === 'paper');
    document.getElementById('scratch-mode-screen').classList.toggle('active', m === 'screen');
    setPaused(false);
    setTool(tool);
    if (isOpen) requestAnimationFrame(sizeCanvas);
  }

  /* 畫在畫面上時，筆會擋住底下的按鈕；暫停畫筆讓手指點得到畫面，筆跡保留 */
  function setPaused(p) {
    paused = p;
    document.getElementById('scratch-panel').classList.toggle('paused', p);
    var b = document.getElementById('scratch-pause');
    b.classList.toggle('active', p);
    b.textContent = p ? '✏️ 繼續畫' : '👆 點畫面作答';
    if (p) hideEraserCursor();
  }

  /* ── 面板開關 ── */
  function togglePanel() { isOpen ? closePanel() : openPanel(); }

  function openPanel() {
    document.getElementById('scratch-panel').classList.add('open');
    document.getElementById('scratch-widget-btn').classList.add('s-active', 's-hidden');
    isOpen = true;
    requestAnimationFrame(sizeCanvas);
  }

  /* 關掉就清空兩張畫布（草稿是暫存的；畫在畫面上的筆跡也不該留到下一題） */
  function closePanel() {
    document.getElementById('scratch-panel').classList.remove('open');
    document.getElementById('scratch-widget-btn').classList.remove('s-active', 's-hidden');
    isOpen = false;
    ['scratch-canvas', 'scratch-overlay'].forEach(function (id) {
      var c = document.getElementById(id);
      c.getContext('2d').clearRect(0, 0, c.width, c.height);
    });
    setPaused(false);
  }

  /* ── 工具切換 ── */
  function setTool(t) {
    tool = t;
    document.getElementById('scratch-pen').classList.toggle('active', t === 'pen');
    document.getElementById('scratch-eraser').classList.toggle('active', t === 'eraser');
    /* 橡皮擦用自訂的圓圈游標顯示實際擦取範圍，原生游標關掉；
       畫筆維持原本的十字準星就好 */
    canvas.style.cursor = t === 'eraser' ? 'none' : 'crosshair';
    if (t === 'pen') hideEraserCursor();
    updateSizeDisplay();
  }

  /* 尺寸按鍵：pointerdown 先調一次，按住一段時間後開始連續調整，
     鬆開／移出／取消都要停止 —— 用 setPointerCapture 確保手指移出按鍵範圍
     時 pointerup 還是會正確收到 */
  function bindHoldStep(el, dir) {
    el.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      stepSize(dir);
      clearHoldTimers();
      holdTimer = setTimeout(function () {
        holdInterval = setInterval(function () { stepSize(dir); }, HOLD_REPEAT);
      }, HOLD_DELAY);
    });
    el.addEventListener('pointerup',     clearHoldTimers);
    el.addEventListener('pointercancel', clearHoldTimers);
    el.addEventListener('pointerleave',  clearHoldTimers);
  }

  function clearHoldTimers() {
    if (holdTimer)    { clearTimeout(holdTimer);   holdTimer = null; }
    if (holdInterval) { clearInterval(holdInterval); holdInterval = null; }
  }

  /* 用按鍵調整目前工具的粗細（平板用滑軌不好精準控制，改用按鍵）*/
  function stepSize(dir) {
    var range = tool === 'pen' ? PEN_RANGE : ERASER_RANGE;
    var value = tool === 'pen' ? penWidth  : eraserWidth;
    value = Math.max(range.min, Math.min(range.max, value + dir * range.step));
    value = Math.round(value * 10) / 10;
    if (tool === 'pen') penWidth = value; else eraserWidth = value;
    updateSizeDisplay();
  }

  /* 切換工具或調整粗細後，同步數字顯示；如果橡皮擦游標正顯示中，
     大小也要跟著換 */
  function updateSizeDisplay() {
    var valEl = document.getElementById('scratch-size-val');
    var value = tool === 'pen' ? penWidth : eraserWidth;
    if (valEl) valEl.textContent = value;
    if (tool === 'eraser') {
      var cursorEl = document.getElementById('scratch-eraser-cursor');
      if (cursorEl) { cursorEl.style.width = eraserWidth + 'px'; cursorEl.style.height = eraserWidth + 'px'; }
    }
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
    /* 尺寸沒變就不要重設——重設寬高會把畫布清空，切換模式回來筆跡要還在 */
    if (canvas.width === Math.round(w * dpr) && canvas.height === Math.round(h * dpr)) return;
    canvas.width  = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';
  }

  /* ── 繪圖（Pointer Events，同時支援滑鼠與觸控） ── */
  /* 兩張畫布都綁，但只有目前模式那張看得到（canvas／ctx 指向它） */
  function setupDrawing(c) {
    c.addEventListener('pointerdown', function (e) {
      drawing = true;
      canvas.setPointerCapture(e.pointerId);
      var p = canvasPos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      applyStyle();
      moveEraserCursor(e);
      e.preventDefault();
    });

    c.addEventListener('pointermove', function (e) {
      moveEraserCursor(e);
      if (!drawing) return;
      var p = canvasPos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      e.preventDefault();
    });

    c.addEventListener('pointerup', function (e) {
      drawing = false;
      ctx.closePath();
      e.preventDefault();
    });

    c.addEventListener('pointercancel', function () { drawing = false; });
    c.addEventListener('pointerenter', function (e) { moveEraserCursor(e); });
    c.addEventListener('pointerleave', hideEraserCursor);
  }

  /* ── 橡皮擦範圍游標：畫一個跟目前粗細一樣大的圓圈跟著游標／手指走，
     平板上手指會擋住觸點本身，觸控時往上偏移一段距離才看得到 ── */
  function moveEraserCursor(e) {
    if (tool !== 'eraser') return;
    var cursorEl = document.getElementById('scratch-eraser-cursor');
    if (!cursorEl) return;
    var offsetY = e.pointerType === 'touch' ? -(eraserWidth / 2 + 36) : 0;
    cursorEl.style.left  = e.clientX + 'px';
    cursorEl.style.top   = (e.clientY + offsetY) + 'px';
    cursorEl.style.width  = eraserWidth + 'px';
    cursorEl.style.height = eraserWidth + 'px';
    cursorEl.classList.add('show');
  }

  function hideEraserCursor() {
    var cursorEl = document.getElementById('scratch-eraser-cursor');
    if (cursorEl) cursorEl.classList.remove('show');
  }

  function applyStyle() {
    if (tool === 'pen') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#000';
      ctx.lineWidth   = penWidth;
    } else {
      /* destination-out 讓畫素透明，顯示 CSS background（白紙）或底下的畫面 */
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth   = eraserWidth;
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
