'use strict';

// ════════════════════════════════════════
//  拖曳引擎 (Pointer Events — 滑鼠 + 觸控)
// ════════════════════════════════════════

var _dragEl         = null;
var _dragClone      = null;
var _chipOrigRect   = null;
var _eqSignRect     = null;
var _chipStartedRight = false; // 起始位置是否在等號右側
var _dragging       = false;
var _crossed        = false;
var _startClientX   = 0;
var _startClientY   = 0;
var _cloneStartLeft = 0;
var _cloneStartTop  = 0;

// 每次 renderEquation 後呼叫，綁定所有 .term-chip.draggable
function initDragChips() {
  document.querySelectorAll('.term-chip.draggable').forEach(function(chip) {
    chip.removeEventListener('pointerdown', onDragStart);
    chip.addEventListener('pointerdown', onDragStart);
  });
}

function onDragStart(e) {
  e.preventDefault();
  var chip = e.currentTarget;
  if (chip.classList.contains('locked')) return;

  _dragEl       = chip;
  _dragging     = true;
  _crossed      = false;
  _startClientX = e.clientX;
  _startClientY = e.clientY;

  // 記錄原始晶片位置
  _chipOrigRect = chip.getBoundingClientRect();

  // 記錄等號位置
  var signEl = document.querySelector('#eq-row .eq-sign');
  _eqSignRect = signEl ? signEl.getBoundingClientRect() : null;

  // 判斷晶片初始在等號哪一側
  if (_eqSignRect) {
    _chipStartedRight = _chipOrigRect.left > _eqSignRect.right;
  }

  // 建立浮動 clone
  _dragClone = chip.cloneNode(true);
  _dragClone.style.cssText = [
    'position:fixed',
    'pointer-events:none',
    'z-index:500',
    'left:' + _chipOrigRect.left + 'px',
    'top:' + _chipOrigRect.top + 'px',
    'width:' + _chipOrigRect.width + 'px',
    'margin:0',
    'transition:none',
    'transform:scale(1.15) translateY(-6px)',
    'box-shadow:0 8px 28px rgba(44,100,160,.35)'
  ].join(';');
  document.body.appendChild(_dragClone);
  _cloneStartLeft = _chipOrigRect.left;
  _cloneStartTop  = _chipOrigRect.top;

  // 隱藏原始晶片
  chip.style.visibility = 'hidden';

  // Pointer capture（觸控必要）
  try { chip.setPointerCapture(e.pointerId); } catch(err) {}

  chip.addEventListener('pointermove', onDragMove);
  chip.addEventListener('pointerup',   onDragEnd);
  chip.addEventListener('pointercancel', onDragCancel);
}

function onDragMove(e) {
  if (!_dragging || !_dragClone) return;
  var dx = e.clientX - _startClientX;
  var dy = e.clientY - _startClientY;
  _dragClone.style.left = (_cloneStartLeft + dx) + 'px';
  _dragClone.style.top  = (_cloneStartTop  + dy) + 'px';

  // 判斷是否越過等號
  if (_eqSignRect) {
    var cloneCenterX = (_cloneStartLeft + dx) + _chipOrigRect.width / 2;
    var signCenterX  = _eqSignRect.left + _eqSignRect.width / 2;
    var nowCrossed = _chipStartedRight
      ? cloneCenterX < signCenterX
      : cloneCenterX > signCenterX;
    if (nowCrossed !== _crossed) {
      _crossed = nowCrossed;
      if (_crossed) {
        _dragClone.classList.add('term-chip--crossed');
      } else {
        _dragClone.classList.remove('term-chip--crossed');
      }
    }
  }
}

function onDragEnd(e) {
  if (!_dragging) return;
  cleanupListeners();

  if (_crossed && _dragClone) {
    flyAndLand();
  } else {
    springBack();
  }
}

function onDragCancel(e) {
  cleanupListeners();
  springBack();
}

function cleanupListeners() {
  if (_dragEl) {
    _dragEl.removeEventListener('pointermove', onDragMove);
    _dragEl.removeEventListener('pointerup',   onDragEnd);
    _dragEl.removeEventListener('pointercancel', onDragCancel);
  }
  _dragging = false;
}

// ── 成功越過：飛行動畫後觸發移項 ──
function flyAndLand() {
  if (!_dragClone || !_dragEl) return;

  // 計算目標位置（等號另一側的鏡像）
  var targetLeft, signCenter;
  if (_eqSignRect) {
    signCenter = _eqSignRect.left + _eqSignRect.width / 2;
    if (_chipStartedRight) {
      targetLeft = signCenter - _chipOrigRect.width - 20;
    } else {
      targetLeft = signCenter + 20;
    }
  } else {
    targetLeft = _cloneStartLeft;
  }
  var targetTop = _chipOrigRect.top;

  // 中途翻轉符號文字
  var originalText = _dragEl.textContent.trim();
  var sign = originalText.charAt(0);
  var rest = originalText.slice(1);
  var flippedText = flipOp(sign) + rest;

  setTimeout(function() {
    if (_dragClone) _dragClone.textContent = flippedText;
  }, 160);

  _dragClone.style.transition = 'left 300ms cubic-bezier(0.34,1.56,0.64,1), top 300ms cubic-bezier(0.34,1.56,0.64,1), transform 300ms cubic-bezier(0.34,1.56,0.64,1)';
  _dragClone.style.transform = 'scale(1) translateY(0)';
  _dragClone.style.left = targetLeft + 'px';
  _dragClone.style.top  = targetTop  + 'px';

  _dragClone.addEventListener('transitionend', function onEnd() {
    _dragClone.removeEventListener('transitionend', onEnd);
    if (_dragClone && _dragClone.parentNode) _dragClone.parentNode.removeChild(_dragClone);
    _dragClone = null;
    if (_dragEl) { _dragEl.style.visibility = ''; _dragEl = null; }
    onTermDropped();
  });
}

// ── 未越過：彈回 ──
function springBack() {
  if (!_dragClone) {
    if (_dragEl) { _dragEl.style.visibility = ''; _dragEl = null; }
    return;
  }
  _dragClone.style.transition = 'left 260ms cubic-bezier(0.34,1.56,0.64,1), top 260ms cubic-bezier(0.34,1.56,0.64,1), transform 260ms ease';
  _dragClone.style.transform  = 'scale(1) translateY(0)';
  _dragClone.style.left = _cloneStartLeft + 'px';
  _dragClone.style.top  = _cloneStartTop  + 'px';

  _dragClone.addEventListener('transitionend', function onEnd() {
    _dragClone.removeEventListener('transitionend', onEnd);
    if (_dragClone && _dragClone.parentNode) _dragClone.parentNode.removeChild(_dragClone);
    _dragClone = null;
    if (_dragEl) { _dragEl.style.visibility = ''; _dragEl = null; }
  });
}
