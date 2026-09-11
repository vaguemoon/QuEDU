/**
 * snap.js — 部件拼貼遊戲（磁吸式雙軌結構拼貼板）
 * 依 currentDecompItems（{char, type:'lr'|'tb', first, second}）逐字出題，
 * 用 Pointer Events 拖曳部件到正確的顏色房間；兩塊都放好後由學生按「確定」才判定對錯，
 * 不是放下去就立刻批對——放錯時兩塊都彈回發牌區重新來過。
 */
'use strict';

var snapQueue   = [];
var snapIdx     = 0;
var snapCurrent = null;
var snapPlaced  = { first: null, second: null }; // { first: pieceEl|null, second: pieceEl|null }

var _snapZhVoice   = null;
var _snapDragEl     = null;
var _snapDragOffX   = 0;
var _snapDragOffY   = 0;

/* ── 語音（沿用系統統一的中文語音挑選規則） ── */
function _rkSnapLoadVoice() {
  if (!window.speechSynthesis) return;
  var voices = window.speechSynthesis.getVoices();
  if (voices && voices.length) _snapZhVoice = pickBestZhVoice(voices);
}
if (window.speechSynthesis) {
  _rkSnapLoadVoice();
  window.speechSynthesis.onvoiceschanged = _rkSnapLoadVoice;
}

function _rkSnapSpeak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  var utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'zh-TW';
  if (_snapZhVoice) utt.voice = _snapZhVoice;
  window.speechSynthesis.speak(utt);
}

function _rkSfxSnap() {
  playTone(1200, 'square', 0.045, 0.16);
  playTone(700,  'square', 0.04,  0.10, 0.03);
}

/* ── 「選擇模式」頁：第五張卡片依 currentDecompItems 顯示/隱藏 ── */
function _rkRenderDecompCard() {
  var card = document.getElementById('mode-card-snap');
  if (card) card.classList.toggle('hidden', !currentDecompItems.length);
}

/* ── 進入遊戲 ── */
function startSnap() {
  if (!currentDecompItems.length) { showToast('這裡還沒有可以拼貼的字'); return; }
  snapQueue = shuffle(currentDecompItems);
  snapIdx = 0;
  showPage('snap');
  _rkSnapLoadNext();
}

function _rkSnapLoadNext() {
  if (snapIdx >= snapQueue.length) {
    showToast('🎉 這一輪都拼完了，再玩一次！');
    snapQueue = shuffle(currentDecompItems);
    snapIdx = 0;
  }
  snapCurrent = snapQueue[snapIdx++];
  snapPlaced  = { first: null, second: null };
  _rkSnapRenderBoard();
}

/* ── 畫面渲染 ── */
function _rkSnapRenderBoard() {
  var q = snapCurrent;
  var statusEl = document.getElementById('snap-status');
  var progEl   = document.getElementById('snap-progress');
  var boardEl  = document.getElementById('snap-board');
  var zoneA    = document.getElementById('snap-zone-first');
  var zoneB    = document.getElementById('snap-zone-second');
  var trayEl   = document.getElementById('snap-tray');
  var bigEl    = document.getElementById('snap-board-char');
  var nextBtn  = document.getElementById('snap-next-btn');

  var confirmBtn = document.getElementById('snap-confirm-btn');

  if (statusEl) statusEl.textContent = '拖曳部件到正確的顏色房間';
  if (progEl)   progEl.textContent   = snapIdx + ' / ' + snapQueue.length;
  if (boardEl)  boardEl.className    = 'snap-board ' + (q.type === 'tb' ? 'snap-board-tb' : 'snap-board-lr');
  if (bigEl)    { bigEl.textContent = ''; bigEl.classList.remove('show'); }
  if (nextBtn)  nextBtn.classList.add('hidden');
  if (confirmBtn) { confirmBtn.classList.remove('hidden'); confirmBtn.disabled = true; }

  [zoneA, zoneB].forEach(function(z) {
    if (!z) return;
    z.classList.remove('snap-zone-merged');
  });

  if (!trayEl) return;
  trayEl.innerHTML = '';
  shuffle([
    { id: 'first',  value: q.first  },
    { id: 'second', value: q.second }
  ]).forEach(function(p) {
    var el = document.createElement('div');
    el.className   = 'snap-piece';
    el.textContent = p.value;
    _rkSnapAttachDrag(el, p.id);
    trayEl.appendChild(el);
  });
}

/* ── 拖曳（Pointer Events：滑鼠／觸控通用） ── */
function _rkSnapAttachDrag(el, pieceId) {
  el.dataset.pieceId = pieceId;

  el.addEventListener('pointerdown', function(e) {
    e.preventDefault();
    if (_snapDragEl) return;
    _snapDragEl = el;
    // 如果這塊本來已經停在某個房間，先把那個房間騰出來，並恢復成發牌區的樣子
    if (snapPlaced.first === el)  snapPlaced.first  = null;
    if (snapPlaced.second === el) snapPlaced.second = null;
    _rkSnapUpdateConfirmBtn();
    el.classList.remove('parked');
    el.style.transition = '';
    el.style.width  = '120px';
    el.style.height = '120px';
    el.style.justifyContent = '';
    el.style.alignItems     = '';

    var rect = el.getBoundingClientRect();
    _snapDragOffX = e.clientX - rect.left;
    _snapDragOffY = e.clientY - rect.top;
    el.style.position = 'fixed';
    el.style.left   = rect.left + 'px';
    el.style.top    = rect.top + 'px';
    el.style.width  = rect.width + 'px';
    el.style.height = rect.height + 'px';
    el.style.zIndex = 999;
    el.classList.add('dragging');
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
  });

  el.addEventListener('pointermove', function(e) {
    if (_snapDragEl !== el) return;
    el.style.left = (e.clientX - _snapDragOffX) + 'px';
    el.style.top  = (e.clientY - _snapDragOffY) + 'px';
  });

  el.addEventListener('pointerup', function(e) {
    if (_snapDragEl !== el) return;
    _snapDragEl = null;
    _rkSnapEndDrag(el, pieceId, e.clientX, e.clientY);
  });

  el.addEventListener('pointercancel', function() {
    if (_snapDragEl !== el) return;
    _snapDragEl = null;
    _rkSnapReturnToTray(el);
  });
}

function _rkSnapEndDrag(el, pieceId, x, y) {
  el.classList.remove('dragging');

  var zoneA = document.getElementById('snap-zone-first');
  var zoneB = document.getElementById('snap-zone-second');
  var overA = zoneA && _rkSnapPointInRect(x, y, zoneA.getBoundingClientRect());
  var overB = zoneB && _rkSnapPointInRect(x, y, zoneB.getBoundingClientRect());
  var targetSlot = overA ? 'first' : (overB ? 'second' : null);

  // 沒放進任何房間，或那個房間已經有另一塊了 → 退回發牌區
  if (!targetSlot || snapPlaced[targetSlot]) { _rkSnapReturnToTray(el); return; }

  _rkSnapParkPiece(el, pieceId, targetSlot);
}

function _rkSnapPointInRect(x, y, rect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/* ── 停在房間裡（不管對不對，先卡住位置，靠近中線擺放，並放大、去掉外框）── */
var SNAP_PARK_SIZE = 160;

function _rkSnapParkPiece(el, pieceId, slot) {
  var boardEl = document.getElementById('snap-board');
  var zone    = document.getElementById('snap-zone-' + slot);
  if (!boardEl || !zone) return;

  var boardRect = boardEl.getBoundingClientRect();
  var zoneRect  = zone.getBoundingClientRect();
  var gap = 2;
  var w = SNAP_PARK_SIZE, h = SNAP_PARK_SIZE;
  var left, top;

  // 字在方塊裡貼齊靠中線那一側，不要置中，這樣兩個部件的筆畫才會真的靠近
  if (snapCurrent.type === 'tb') {
    var centerY = boardRect.top + boardRect.height / 2;
    left = zoneRect.left + (zoneRect.width - w) / 2;
    top  = slot === 'first' ? (centerY - h - gap) : (centerY + gap);
    el.style.justifyContent = 'center';
    el.style.alignItems     = slot === 'first' ? 'flex-end' : 'flex-start';
  } else {
    var centerX = boardRect.left + boardRect.width / 2;
    top  = zoneRect.top + (zoneRect.height - h) / 2;
    left = slot === 'first' ? (centerX - w - gap) : (centerX + gap);
    el.style.alignItems     = 'center';
    el.style.justifyContent = slot === 'first' ? 'flex-end' : 'flex-start';
  }

  el.classList.add('parked');
  el.style.transition = 'left .18s ease-out, top .18s ease-out, width .18s ease-out, height .18s ease-out';
  el.style.width  = w + 'px';
  el.style.height = h + 'px';
  el.style.left = left + 'px';
  el.style.top  = top + 'px';
  _rkSfxSnap();
  snapPlaced[slot] = el;

  setTimeout(function() { el.style.transition = ''; }, 190);
  _rkSnapUpdateConfirmBtn();
}

/* ── 「確定」按鈕：兩塊都放好才會亮起 ── */
function _rkSnapUpdateConfirmBtn() {
  var btn = document.getElementById('snap-confirm-btn');
  if (!btn) return;
  btn.disabled = !(snapPlaced.first && snapPlaced.second);
}

function _rkSnapConfirm() {
  var btn = document.getElementById('snap-confirm-btn');
  if (!btn || btn.disabled) return;

  var correct = snapPlaced.first  && snapPlaced.first.dataset.pieceId  === 'first'
             && snapPlaced.second && snapPlaced.second.dataset.pieceId === 'second';

  if (correct) {
    _rkSnapCompleteChar();
  } else {
    _rkSnapWrongConfirm();
  }
}

/* ── 按確定後發現放錯：兩塊都彈回發牌區，重新來過 ── */
function _rkSnapWrongConfirm() {
  var statusEl = document.getElementById('snap-status');
  if (statusEl) statusEl.textContent = '放錯了，再試一次！';

  if (snapPlaced.first)  _rkSnapReturnToTray(snapPlaced.first);
  if (snapPlaced.second) _rkSnapReturnToTray(snapPlaced.second);
  snapPlaced = { first: null, second: null };
  _rkSnapUpdateConfirmBtn();
}

function _rkSnapReturnToTray(el) {
  var trayEl = document.getElementById('snap-tray');
  if (!trayEl) return;
  el.classList.remove('parked');
  el.style.width  = '120px';
  el.style.height = '120px';
  el.style.justifyContent = '';
  el.style.alignItems     = '';
  var rect = trayEl.getBoundingClientRect();
  el.style.transition = 'left .4s cubic-bezier(.34,1.2,.64,1), top .4s cubic-bezier(.34,1.2,.64,1), width .3s, height .3s';
  el.style.left = (rect.left + rect.width / 2 - el.offsetWidth  / 2) + 'px';
  el.style.top  = (rect.top  + rect.height / 2 - el.offsetHeight / 2) + 'px';
  setTimeout(function() {
    el.style.position   = '';
    el.style.left        = '';
    el.style.top         = '';
    el.style.width       = '';
    el.style.height      = '';
    el.style.transition  = '';
    el.style.zIndex      = '';
    el.classList.remove('dragging');
  }, 420);
}

/* ── 兩塊都拼對：合併底色、唸出整字、閃爍回饋，等學生按「下一個」再換字 ── */
function _rkSnapCompleteChar() {
  var zoneA   = document.getElementById('snap-zone-first');
  var zoneB   = document.getElementById('snap-zone-second');
  var bigEl   = document.getElementById('snap-board-char');
  var nextBtn = document.getElementById('snap-next-btn');
  var confirmBtn = document.getElementById('snap-confirm-btn');
  var statusEl = document.getElementById('snap-status');

  if (snapPlaced.first)  snapPlaced.first.remove();
  if (snapPlaced.second) snapPlaced.second.remove();

  if (zoneA) zoneA.classList.add('snap-zone-merged');
  if (zoneB) zoneB.classList.add('snap-zone-merged');
  if (bigEl) {
    bigEl.textContent = snapCurrent.char;
    bigEl.classList.add('show');
  }
  if (statusEl)    statusEl.textContent = '🎉 拼對了！';
  if (confirmBtn)  confirmBtn.classList.add('hidden');
  if (nextBtn)     nextBtn.classList.remove('hidden');

  _rkSnapSpeak(snapCurrent.char);
  decompStatus[snapCurrent.char] = 'done';
  saveProgress();
  if (typeof renderDecompProgress === 'function') renderDecompProgress();
}

/* ── 學生按「下一個」才換下一個字 ── */
function _rkSnapConfirmNext() {
  var nextBtn = document.getElementById('snap-next-btn');
  if (nextBtn) nextBtn.classList.add('hidden');
  _rkSnapLoadNext();
}
