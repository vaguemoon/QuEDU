/**
 * menu.js — 注音符號表渲染（單音／結合韻 兩大區共用同一套畫面）
 */
'use strict';

/* 依目前 zySection 回傳分組清單，單音分聲符／韻符，結合韻分ㄧ系／ㄨ系／ㄩ系 */
function _zyGroupsForSection() {
  return zySection === 'combined'
    ? [
        { title: 'ㄧ系', items: ZY_COMBINED_YI },
        { title: 'ㄨ系', items: ZY_COMBINED_WU },
        { title: 'ㄩ系', items: ZY_COMBINED_YU }
      ]
    : [
        { title: '聲符', items: ZHUYIN_INITIALS },
        { title: '韻符', items: ZHUYIN_FINALS }
      ];
}

function _zySectionLabel() { return zySection === 'combined' ? '結合韻' : '單音'; }
function _zySectionIcon()  { return zySection === 'combined' ? '🔗' : '🔡'; }

/* 由 nav.js 的 showPage() 統一呼叫：不管頁面是透過明確的 enterXxx() 進入、
   還是透過「← 返回」這種通用路徑到達，標題都補回目前區域／方向對應的正確內容，
   不會出現空白 Topbar */
function _zyRefreshTitleFor(name) {
  var titleEl = document.getElementById('topbar-title');
  if (name === 'mode-select') {
    if (titleEl) titleEl.innerHTML = _zySectionIcon() + ' <span>' + _zySectionLabel() + '</span>';
  } else if (name === 'grid') {
    if (titleEl) titleEl.innerHTML = '🗂️ <span>' + _zySectionLabel() + '・符號瀏覽</span>';
  } else if (name === 'zy-menu' || name === 'zy-practice' || name === 'zy-exam' ||
             name === 'zy-exam-round-result' || name === 'zy-exam-result') {
    if (zyDirection) _zySetDirectionTitle();
  }
}

function renderZhuyinGrid() {
  var wrap = document.getElementById('zy-grid-wrap');
  if (!wrap) return;

  wrap.innerHTML = _zyGroupsForSection().map(function(g) {
    return '<div class="zy-section-title">' + g.title + '</div>' +
      '<div class="zy-grid">' + g.items.map(_zySymbolCardHtml).join('') + '</div>';
  }).join('');
}

function _zySymbolCardHtml(symbol) {
  var d = zyActiveData()[symbol] || {};
  var imgInner = d.imageUrl
    ? '<img class="zy-image" src="' + d.imageUrl + '" alt="">'
    : '<div class="zy-image zy-image-empty">🖼️</div>';

  return '<div class="zy-card">' +
    '<button class="zy-symbol" onclick="zySpeakSymbol(\'' + symbol + '\')">' + symbol + '</button>' +
    '<button class="zy-image-btn" onclick="zySpeakPhrase(\'' + symbol + '\')">' + imgInner + '</button>' +
  '</div>';
}

/* ══ 單音／結合韻：頂層區域選擇 ══ */

function enterZySection(section) {
  zySection = section;
  showPage('mode-select');
  var titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.innerHTML = _zySectionIcon() + ' <span>' + _zySectionLabel() + '</span>';
}

/* 從模式選擇卡片進入「符號瀏覽」——重繪網格（資料/分組會依目前 zySection 而不同） */
function enterZyGrid() {
  renderZhuyinGrid();
  showPage('grid');
  var titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.innerHTML = '🗂️ <span>' + _zySectionLabel() + '・符號瀏覽</span>';
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
  var modeLabel  = zyDirection === 'listen' ? '聽音選字' : '看字選音';
  var modeIcon   = zyDirection === 'listen' ? '🎧' : '👀';
  var titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.innerHTML = modeIcon + ' <span>' + _zySectionLabel() + '・' + modeLabel + '</span>';
  var typeEls = [document.getElementById('prac-q-type'), document.getElementById('exam-q-type')];
  typeEls.forEach(function(el) { if (el) el.textContent = modeLabel; });
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

  _zyGroupsForSection().forEach(function(g) {
    var sec = document.createElement('div');
    sec.className = 'menu-section';
    sec.innerHTML = '<div class="menu-section-title">' + g.title + '</div>';
    var grid = document.createElement('div');
    grid.className = 'menu-item-grid';
    g.items.forEach(function(s) { grid.appendChild(_zyMenuItemBtn(s)); });
    sec.appendChild(grid);
    body.appendChild(sec);
  });

  renderZyNormalActionBar();
}

function _zyMenuItemBtn(symbol) {
  var statusMap = zyActiveStatusMap(zyDirection);
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
  zyActiveSymbols().forEach(function(s) { zySelectedItems.add(s); });
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
  var all       = zyActiveSymbols();
  var total     = all.length;
  var statusMap = zyActiveStatusMap(zyDirection);

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
