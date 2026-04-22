/**
 * dictation.js — 默寫模式（自由手寫 Canvas）
 * 負責：switchToDict()、initDictCanvas()、手寫事件、submitDictation()、selfEval()
 * 依賴：state.js、menu.js（updateProgressBar、renderMenu）、shared.js（sfx 系列、showToast）
 */
'use strict';

/**
 * 進入默寫模式：切換面板、初始化 Canvas
 */
function switchToDict() {
  sfxSwipe();
  currentMode = 'dict';
  dictScore   = -1;

  document.getElementById('panel-practice').style.display = 'none';
  document.getElementById('panel-dict').style.display     = '';

  var wrap = document.getElementById('dict-canvas-wrap');
  if (wrap) wrap.style.display = '';

  document.getElementById('mode-icon').textContent  = '📝';
  document.getElementById('mode-title').textContent = '默寫測驗';
  document.getElementById('mode-sub').textContent   = '靠自己的記憶把字寫出來';

  var bb = document.getElementById('bottom-bar');
  if (bb) bb.style.display = 'none';

  var oldFbar = document.getElementById('dict-float-bar');
  if (oldFbar) oldFbar.remove();

  var oldOv = document.getElementById('dict-overlay');
  if (oldOv) oldOv.remove();

  setTimeout(function(){ initDictCanvas(); }, 80);
}

/**
 * 初始化 Canvas（重建元素以清除舊事件監聽器、設定正確尺寸）
 */
function initDictCanvas() {
  var wrap = document.getElementById('dict-canvas-wrap');
  if (!wrap) return;
  var sz = Math.round(wrap.getBoundingClientRect().width) || 340;
  dSize = sz;

  var old = document.getElementById('dict-canvas');
  if (!old) return;
  var neo   = old.cloneNode(false);
  neo.id    = 'dict-canvas';
  neo.width = sz; neo.height = sz;
  neo.style.width = sz + 'px'; neo.style.height = sz + 'px';
  old.parentNode.replaceChild(neo, old);

  dCanvas = neo;
  dCtx    = dCanvas.getContext('2d');
  dDrawing = false; dAllStrokes = []; dCurrentStroke = [];

  // 滑鼠事件
  dCanvas.addEventListener('mousedown',  dStart);
  dCanvas.addEventListener('mousemove',  dMove);
  dCanvas.addEventListener('mouseup',    dEnd);
  dCanvas.addEventListener('mouseleave', dEnd);
  // 觸控事件（passive:false 防止捲頁）
  dCanvas.addEventListener('touchstart',  function(e){ e.preventDefault(); dStart(e.touches[0]); }, { passive: false });
  dCanvas.addEventListener('touchmove',   function(e){ e.preventDefault(); dMove(e.touches[0]);  }, { passive: false });
  dCanvas.addEventListener('touchend',    function(e){ e.preventDefault(); dEnd();               }, { passive: false });
  dCanvas.addEventListener('touchcancel', function(e){ e.preventDefault(); dEnd();               }, { passive: false });
}

// ── 手寫筆觸處理 ──

function dPos(e) {
  var r = dCanvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (dCanvas.width  / r.width),
    y: (e.clientY - r.top)  * (dCanvas.height / r.height)
  };
}

function dStart(e) {
  dDrawing = true; dCurrentStroke = [];
  var p = dPos(e);
  dCurrentStroke.push([Math.round(p.x), Math.round(p.y)]);
  dCtx.beginPath(); dCtx.moveTo(p.x, p.y);
}

function dMove(e) {
  if (!dDrawing) return;
  var p = dPos(e);
  if (dCurrentStroke.length === 0 || dCurrentStroke.length % 3 === 0) {
    dCurrentStroke.push([Math.round(p.x), Math.round(p.y)]);
  }
  dCtx.lineTo(p.x, p.y);
  dCtx.strokeStyle = '#1e2d3d';
  dCtx.lineWidth   = Math.max(5, Math.round(dSize * 0.016));
  dCtx.lineCap = 'round'; dCtx.lineJoin = 'round';
  dCtx.stroke();
}

function dEnd() {
  if (!dDrawing) return;
  dDrawing = false; dCtx.closePath();
  if (dCurrentStroke.length > 1) dAllStrokes.push(dCurrentStroke.slice());
  dCurrentStroke = [];
}

// ── 清除重寫 ──

function clearDictCanvas() {
  sfxTap();
  if (!dCtx) return;
  dCtx.clearRect(0, 0, dCanvas.width, dCanvas.height);
  dDrawing = false; dictScore = -1;
  dAllStrokes = []; dCurrentStroke = [];
  var ov = document.getElementById('dict-overlay');
  if (ov) ov.remove();
}

// ── 交卷與自評 ──

/**
 * 交卷：檢查畫布是否有墨水，縮圖並顯示對照結果
 */
function submitDictation() {
  sfxTap();
  var char = chars[currentIdx];
  if (!dCtx) return;

  var px = dCtx.getImageData(0, 0, dCanvas.width, dCanvas.height).data;
  var hasInk = false;
  for (var i = 3; i < px.length; i += 4) { if (px[i] > 20) { hasInk = true; break; } }
  if (!hasInk) { showToast('\u{1F4DD} 還沒寫喔！請先在格子裡寫字！'); return; }

  var thumbSz = 120;
  var tc = document.createElement('canvas');
  tc.width = thumbSz; tc.height = thumbSz;
  tc.getContext('2d').drawImage(dCanvas, 0, 0, thumbSz, thumbSz);
  var thumbUrl = tc.toDataURL();

  var old = document.getElementById('dict-overlay');
  if (old) old.remove();

  var wrap = document.getElementById('dict-canvas-wrap');
  if (!wrap) return;

  var ov = document.createElement('div');
  ov.id = 'dict-overlay';
  ov.style.cssText = 'position:absolute;inset:0;z-index:10;background:rgba(240,244,248,0.96);border-radius:inherit;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;';
  ov.innerHTML =
    '<div style="background:white;border-radius:14px;border:1px solid #c8dff5;padding:14px;width:100%;display:flex;flex-direction:column;gap:10px;">' +
      '<div style="display:flex;gap:8px;align-items:center;">' +
        '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">' +
          '<div style="font-size:11px;color:#8da4b8;">你寫的</div>' +
          '<img src="' + thumbUrl + '" style="width:100%;aspect-ratio:1;border-radius:8px;border:1px solid #c8dff5;background:#f5f8fc;display:block;">' +
        '</div>' +
        '<div style="font-size:16px;color:#b0bec5;">↔</div>' +
        '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">' +
          '<div style="font-size:11px;color:#8da4b8;">正確字形</div>' +
          '<div style="width:100%;aspect-ratio:1;border-radius:8px;border:1px solid #c8dff5;background:#f5f8fc;display:flex;align-items:center;justify-content:center;font-size:7rem;color:#2d6fa8;font-family:\'標楷體\',DFKai-SB,\'BiauKai\',serif;">' + char + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="font-size:12px;color:#5a7080;text-align:center;">你覺得寫得像嗎？</div>' +
      '<div style="display:flex;gap:8px;">' +
        '<button onclick="selfEval(&quot;great&quot;)" style="flex:1;padding:10px 4px;border-radius:10px;font-size:13px;font-weight:500;background:#e8f8ee;color:#27500A;border:1px solid #97C459;cursor:pointer;">⭕ 像！</button>' +
        '<button onclick="selfEval(&quot;retry&quot;)" style="flex:1;padding:10px 4px;border-radius:10px;font-size:13px;font-weight:500;background:#feecec;color:#791F1F;border:1px solid #F09595;cursor:pointer;">✖ 不像</button>' +
      '</div>' +
    '</div>';

  wrap.appendChild(ov);
  sfxSwipe();
}

/**
 * 自評：學生決定自己是否寫得正確
 * @param {'great'|'retry'} result
 */
function selfEval(result) {
  if (result === 'great') {
    sfxCelebrate();
    var char = chars[currentIdx];
    markDictated(char);
    if (dAllStrokes.length > 0 && dSize > 0) {
      var ns = dAllStrokes.map(function(s) {
        return s.map(function(pt) {
          return [Math.round(pt[0] / dSize * 1000) / 1000, Math.round(pt[1] / dSize * 1000) / 1000];
        });
      });
      saveStroke(char, ns);
    }
    saveProgress(); updateProgressBar(); renderMenu();
    goBack();
  } else {
    sfxWrong();
    clearDictCanvas();
  }
}
