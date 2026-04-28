/**
 * menu.js — 字詞列表頁與進度列
 */
'use strict';

var menuSelectMode    = false;
var pracSelectedItems = new Set();

function renderMenu() {
  if (!currentLessonData) return;
  var lesson = currentLessonData;
  var chars  = lesson.chars || [];
  var words  = lesson.words || [];

  // 進度列
  renderMenuProgress(chars, words);

  var body = document.getElementById('menu-body');
  if (!body) return;
  body.innerHTML = '';
  menuSelectMode = false;
  pracSelectedItems.clear();
  body.classList.remove('menu-select-mode');

  // 單字區
  if (chars.length) {
    var charSec = document.createElement('div');
    charSec.className = 'menu-section';
    charSec.innerHTML = '<div class="menu-section-title">🔤 本課生字</div>';
    var charGrid = document.createElement('div');
    charGrid.className = 'menu-item-grid';
    chars.forEach(function(c) {
      var st  = charStatus[c] || 'new';
      var btn = document.createElement('button');
      btn.className = 'menu-item-btn menu-item-' + st;
      btn.textContent = c;
      btn.dataset.item = c;
      btn.onclick = function() { onMenuItemClick(this, c); };
      charGrid.appendChild(btn);
    });
    charSec.appendChild(charGrid);
    body.appendChild(charSec);
  }

  // 詞語區
  if (words.length) {
    var wordSec = document.createElement('div');
    wordSec.className = 'menu-section';
    wordSec.innerHTML = '<div class="menu-section-title">📝 本課詞語</div>';
    var wordGrid = document.createElement('div');
    wordGrid.className = 'menu-word-grid';
    words.forEach(function(w) {
      var st  = wordStatus[w] || 'new';
      var btn = document.createElement('button');
      btn.className = 'menu-item-btn menu-word-btn menu-item-' + st;
      btn.textContent = w;
      btn.dataset.item = w;
      btn.onclick = function() { onMenuItemClick(this, w); };
      wordGrid.appendChild(btn);
    });
    wordSec.appendChild(wordGrid);
    body.appendChild(wordSec);
  }

  renderNormalActionBar();
}

function onMenuItemClick(btn, item) {
  if (menuSelectMode) {
    toggleSelectItem(item, btn);
  } else {
    speakText(item);
  }
}

function toggleSelectItem(item, btn) {
  if (pracSelectedItems.has(item)) {
    pracSelectedItems.delete(item);
    btn.classList.remove('menu-item-selected');
  } else {
    pracSelectedItems.add(item);
    btn.classList.add('menu-item-selected');
  }
  speakText(item);
  updateSelectCount();
}

function selectAll() {
  var lesson = currentLessonData;
  var all = (lesson.chars || []).concat(lesson.words || []);
  all.forEach(function(item) { pracSelectedItems.add(item); });
  document.querySelectorAll('#menu-body .menu-item-btn').forEach(function(btn) {
    btn.classList.add('menu-item-selected');
  });
  updateSelectCount();
}

function updateSelectCount() {
  var btn = document.getElementById('btn-start-select');
  if (!btn) return;
  var n = pracSelectedItems.size;
  btn.textContent = n ? '開始練習（' + n + ' 個）' : '開始練習（全部）';
}

function enterSelectMode() {
  menuSelectMode = true;
  pracSelectedItems.clear();
  var body = document.getElementById('menu-body');
  if (body) body.classList.add('menu-select-mode');
  document.querySelectorAll('#menu-body .menu-item-btn').forEach(function(btn) {
    btn.classList.remove('menu-item-selected');
  });
  renderSelectActionBar();
}

function exitSelectMode() {
  menuSelectMode = false;
  pracSelectedItems.clear();
  var body = document.getElementById('menu-body');
  if (body) body.classList.remove('menu-select-mode');
  document.querySelectorAll('#menu-body .menu-item-btn').forEach(function(btn) {
    btn.classList.remove('menu-item-selected');
  });
  renderNormalActionBar();
}

function startSelectPractice() {
  var selected = pracSelectedItems.size ? Array.from(pracSelectedItems) : null;
  exitSelectMode();
  startPractice(selected);
}

function renderNormalActionBar() {
  var bar = document.getElementById('menu-action-bar');
  if (!bar) return;
  var lesson = currentLessonData;
  var total = ((lesson && lesson.chars) || []).length + ((lesson && lesson.words) || []).length;
  bar.innerHTML = total
    ? '<button class="btn-action btn-practice" onclick="startPractice()">🎯 全部練習</button>' +
      '<button class="btn-action btn-select-mode" onclick="enterSelectMode()">✏️ 自選練習</button>' +
      '<button class="btn-action btn-exam" onclick="startExam()">📝 測驗模式</button>'
    : '<div class="menu-empty">這一課沒有生字或詞語</div>';
}

function renderSelectActionBar() {
  var bar = document.getElementById('menu-action-bar');
  if (!bar) return;
  bar.innerHTML =
    '<button class="btn-action btn-select-all" onclick="selectAll()">☑ 全選</button>' +
    '<button class="btn-action btn-start-select" id="btn-start-select" onclick="startSelectPractice()">開始練習（全部）</button>' +
    '<button class="btn-action btn-cancel-select" onclick="exitSelectMode()">✕ 取消</button>';
}

function renderMenuProgress(chars, words) {
  var all   = chars.concat(words);
  var total = all.length;
  if (!total) return;

  var mastered  = all.filter(function(x) {
    return charStatus[x] === 'mastered' || wordStatus[x] === 'mastered';
  }).length;
  var practiced = all.filter(function(x) {
    return charStatus[x] === 'practiced' || wordStatus[x] === 'practiced';
  }).length;

  var mastPct = Math.round(mastered  / total * 100);
  var pracPct = Math.round(practiced / total * 100);
  var newPct  = 100 - mastPct - pracPct;

  var segMastered  = document.getElementById('prog-mastered');
  var segPracticed = document.getElementById('prog-practiced');
  var segNew       = document.getElementById('prog-new');
  var counts       = document.getElementById('prog-counts');

  if (segMastered)  segMastered.style.width  = mastPct + '%';
  if (segPracticed) segPracticed.style.width = pracPct + '%';
  if (segNew)       segNew.style.width       = newPct  + '%';
  if (counts) {
    counts.textContent =
      '已精熟 ' + mastered + ' ・已練習 ' + practiced + ' ・待學習 ' + (total - mastered - practiced);
  }
}
