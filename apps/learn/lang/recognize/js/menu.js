/**
 * menu.js — 字詞列表頁與進度列
 */
'use strict';

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
      btn.onclick = function() { speakText(c); };
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
      btn.onclick = function() { speakText(w); };
      wordGrid.appendChild(btn);
    });
    wordSec.appendChild(wordGrid);
    body.appendChild(wordSec);
  }

  // 底部按鈕列
  var bar = document.getElementById('menu-action-bar');
  if (bar) {
    var total = chars.length + words.length;
    bar.innerHTML = total
      ? '<button class="btn-action btn-practice" onclick="startPractice()">🎯 練習模式</button>' +
        '<button class="btn-action btn-exam" onclick="startExam()">📝 測驗模式</button>'
      : '<div class="menu-empty">這一課沒有生字或詞語</div>';
  }
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
