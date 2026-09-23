/**
 * menu.js — 注音符號表渲染
 */
'use strict';

function renderZhuyinGrid() {
  var wrap = document.getElementById('zy-grid-wrap');
  if (!wrap) return;

  wrap.innerHTML =
    '<div class="zy-section-title">聲符</div>' +
    '<div class="zy-grid">' + ZHUYIN_INITIALS.map(_zySymbolCardHtml).join('') + '</div>' +
    '<div class="zy-section-title">韻符</div>' +
    '<div class="zy-grid">' + ZHUYIN_FINALS.map(_zySymbolCardHtml).join('') + '</div>';
}

function _zySymbolCardHtml(symbol) {
  var d = zhuyinData[symbol] || {};
  var imgInner = d.imageUrl
    ? '<img class="zy-image" src="' + d.imageUrl + '" alt="">'
    : '<div class="zy-image zy-image-empty">🖼️</div>';

  return '<div class="zy-card">' +
    '<button class="zy-symbol" onclick="zySpeakSymbol(\'' + symbol + '\')">' + symbol + '</button>' +
    '<button class="zy-image-btn" onclick="zySpeakPhrase(\'' + symbol + '\')">' + imgInner + '</button>' +
  '</div>';
}

/* ══ 練習／測驗：方向選單（聽音選字／看字選音 共用同一套頁面） ══ */

var zyMenuSelectMode = false;
var zySelectedItems  = new Set();

function enterZyDirection(direction) {
  zyDirection = direction;
  renderZyMenu();
  showPage('zy-menu');
  _zySetDirectionTitle();
}

function _zySetDirectionTitle() {
  var label = zyDirection === 'listen' ? '🎧 <span>聽音選字</span>' : '👀 <span>看字選音</span>';
  var titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.innerHTML = label;
  var plain = zyDirection === 'listen' ? '聽音選字' : '看字選音';
  var typeEls = [document.getElementById('prac-q-type'), document.getElementById('exam-q-type')];
  typeEls.forEach(function(el) { if (el) el.textContent = plain; });
}

function backToZyMenu() {
  renderZyMenu();
  showPage('zy-menu');
  _zySetDirectionTitle();
}

function renderZyMenu() {
  renderZyMenuProgress();

  var body = document.getElementById('zy-menu-body');
  if (!body) return;
  body.innerHTML = '';
  zyMenuSelectMode = false;
  zySelectedItems.clear();
  body.classList.remove('menu-select-mode');

  var initSec = document.createElement('div');
  initSec.className = 'menu-section';
  initSec.innerHTML = '<div class="menu-section-title">聲符</div>';
  var initGrid = document.createElement('div');
  initGrid.className = 'menu-item-grid';
  ZHUYIN_INITIALS.forEach(function(s) { initGrid.appendChild(_zyMenuItemBtn(s)); });
  initSec.appendChild(initGrid);
  body.appendChild(initSec);

  var finSec = document.createElement('div');
  finSec.className = 'menu-section';
  finSec.innerHTML = '<div class="menu-section-title">韻符</div>';
  var finGrid = document.createElement('div');
  finGrid.className = 'menu-item-grid';
  ZHUYIN_FINALS.forEach(function(s) { finGrid.appendChild(_zyMenuItemBtn(s)); });
  finSec.appendChild(finGrid);
  body.appendChild(finSec);

  renderZyNormalActionBar();
}

function _zyMenuItemBtn(symbol) {
  var statusMap = zyDirection === 'listen' ? zySymbolStatus.listenStatus : zySymbolStatus.readStatus;
  var st  = statusMap[symbol] || 'new';
  var btn = document.createElement('button');
  btn.className   = 'menu-item-btn menu-item-' + st;
  btn.dataset.item = symbol;
  btn.textContent  = symbol;
  btn.onclick = function() { onZyMenuItemClick(this, symbol); };
  return btn;
}

function onZyMenuItemClick(btn, symbol) {
  if (zyMenuSelectMode) {
    zyToggleSelectItem(symbol, btn);
  } else {
    zySpeakSymbol(symbol);
  }
}

function zyToggleSelectItem(symbol, btn) {
  if (zySelectedItems.has(symbol)) {
    zySelectedItems.delete(symbol);
    btn.classList.remove('menu-item-selected');
  } else {
    zySelectedItems.add(symbol);
    btn.classList.add('menu-item-selected');
  }
  zySpeakSymbol(symbol);
  zyUpdateSelectCount();
}

function zySelectAll() {
  zyAllSymbols.forEach(function(s) { zySelectedItems.add(s); });
  document.querySelectorAll('#zy-menu-body .menu-item-btn').forEach(function(btn) {
    btn.classList.add('menu-item-selected');
  });
  zyUpdateSelectCount();
}

function zyUpdateSelectCount() {
  var btn = document.getElementById('zy-btn-start-select');
  if (!btn) return;
  var n = zySelectedItems.size;
  btn.textContent = n ? '開始練習（' + n + ' 個）' : '開始練習（全部）';
}

function zyEnterSelectMode() {
  zyMenuSelectMode = true;
  zySelectedItems.clear();
  var body = document.getElementById('zy-menu-body');
  if (body) body.classList.add('menu-select-mode');
  document.querySelectorAll('#zy-menu-body .menu-item-btn').forEach(function(btn) {
    btn.classList.remove('menu-item-selected');
  });
  renderZySelectActionBar();
}

function zyExitSelectMode() {
  zyMenuSelectMode = false;
  zySelectedItems.clear();
  var body = document.getElementById('zy-menu-body');
  if (body) body.classList.remove('menu-select-mode');
  document.querySelectorAll('#zy-menu-body .menu-item-btn').forEach(function(btn) {
    btn.classList.remove('menu-item-selected');
  });
  renderZyNormalActionBar();
}

function zyStartSelectPractice() {
  var selected = zySelectedItems.size ? Array.from(zySelectedItems) : null;
  zyExitSelectMode();
  startZyPractice(selected);
}

function renderZyNormalActionBar() {
  var bar = document.getElementById('zy-menu-action-bar');
  if (!bar) return;
  bar.innerHTML =
    '<button class="btn-action btn-practice" onclick="startZyPractice()">🎯 全部練習</button>' +
    '<button class="btn-action btn-select-mode" onclick="zyEnterSelectMode()">✏️ 自選練習</button>' +
    '<button class="btn-action btn-exam" onclick="startZyExam()">📝 測驗模式</button>';
}

function renderZySelectActionBar() {
  var bar = document.getElementById('zy-menu-action-bar');
  if (!bar) return;
  bar.innerHTML =
    '<button class="btn-action btn-select-all" onclick="zySelectAll()">☑ 全選</button>' +
    '<button class="btn-action btn-start-select" id="zy-btn-start-select" onclick="zyStartSelectPractice()">開始練習（全部）</button>' +
    '<button class="btn-action btn-cancel-select" onclick="zyExitSelectMode()">✕ 取消</button>';
}

function renderZyMenuProgress() {
  var all       = zyAllSymbols;
  var total     = all.length;
  var statusMap = zyDirection === 'listen' ? zySymbolStatus.listenStatus : zySymbolStatus.readStatus;

  var mastered  = all.filter(function(s) { return statusMap[s] === 'mastered';  }).length;
  var practiced = all.filter(function(s) { return statusMap[s] === 'practiced'; }).length;

  var mastPct = Math.round(mastered  / total * 100);
  var pracPct = Math.round(practiced / total * 100);
  var newPct  = 100 - mastPct - pracPct;

  var segMastered  = document.getElementById('zy-prog-mastered');
  var segPracticed = document.getElementById('zy-prog-practiced');
  var segNew       = document.getElementById('zy-prog-new');
  var counts       = document.getElementById('zy-prog-counts');

  if (segMastered)  segMastered.style.width  = mastPct + '%';
  if (segPracticed) segPracticed.style.width = pracPct + '%';
  if (segNew)       segNew.style.width       = newPct  + '%';
  if (counts) {
    counts.textContent =
      '已精熟 ' + mastered + ' ・已練習 ' + practiced + ' ・待學習 ' + (total - mastered - practiced);
  }
}
