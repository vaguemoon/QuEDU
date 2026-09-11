/**
 * memory.js — 意象部件配對消除機：部件文字卡 ↔ 部件意象圖片卡配對
 * 依 radicalMeaningPool（全校共用，App 啟動時載入）出題：
 * 優先用目前練習集自己的部件，不夠時混入其他常見部件補足一輪。
 */
'use strict';

var memoryCards       = []; // [{ id, kind:'radical'|'image', value, imageUrl, phrase, radical, pairKey, flipped, matched, hint }]
var memoryFlipped     = [];
var memoryMoves       = 0;
var memoryMatched     = 0;
var memoryBusy        = false;
var memoryRadicals    = [];
var memoryWrongStreak = 0;
var MEMORY_MAX_PAIRS  = 3;
var MEMORY_MIN_PAIRS  = 2;

var _memZhVoice = null;

/* ── 語音（沿用系統統一的中文語音挑選規則） ── */
function _rkMemoryLoadVoice() {
  if (!window.speechSynthesis) return;
  var voices = window.speechSynthesis.getVoices();
  if (voices && voices.length) _memZhVoice = pickBestZhVoice(voices);
}
if (window.speechSynthesis) {
  _rkMemoryLoadVoice();
  window.speechSynthesis.onvoiceschanged = _rkMemoryLoadVoice;
}
function _rkMemorySpeak(text) {
  if (!window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  var utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'zh-TW';
  if (_memZhVoice) utt.voice = _memZhVoice;
  window.speechSynthesis.speak(utt);
}

/* ── 進入遊戲：優先用目前練習集自己的部件，不夠時混入其他常見部件 ── */
function startMemory() {
  var ownRadicals = getDistinctRadicals().filter(function(r) { return radicalMeaningPool[r]; });
  var poolRadicals = Object.keys(radicalMeaningPool).filter(function(r) { return ownRadicals.indexOf(r) === -1; });

  var picked = shuffle(ownRadicals).slice(0, MEMORY_MAX_PAIRS);
  if (picked.length < MEMORY_MAX_PAIRS) {
    picked = picked.concat(shuffle(poolRadicals).slice(0, MEMORY_MAX_PAIRS - picked.length));
  }

  if (picked.length < MEMORY_MIN_PAIRS) {
    showToast('部件意象圖庫的資料還不夠，請老師到後台「部件圖庫」建立部件意象圖片');
    return;
  }

  memoryRadicals = picked;
  showPage('memory');
  _rkBuildMemoryRound();
}

function _rkBuildMemoryRound() {
  memoryCards = [];
  shuffle(memoryRadicals).forEach(function(r, i) {
    var data = radicalMeaningPool[r];
    if (!data) return;
    var pairKey = 'p' + i;
    memoryCards.push({ id: 'r' + i, kind: 'radical', value: r, imageUrl: '', phrase: data.phrase, radical: r, pairKey: pairKey, flipped: false, matched: false, hint: false });
    memoryCards.push({ id: 'c' + i, kind: 'image',   value: '', imageUrl: data.imageUrl, phrase: data.phrase, radical: r, pairKey: pairKey, flipped: false, matched: false, hint: false });
  });
  memoryCards = shuffle(memoryCards);

  memoryFlipped     = [];
  memoryMoves       = 0;
  memoryMatched     = 0;
  memoryBusy        = false;
  memoryWrongStreak = 0;

  var statusEl = document.getElementById('memory-status');
  if (statusEl) statusEl.textContent = '翻開卡片，配對部件與意象圖片';
  _rkUpdateMemoryMoves();
  _rkRenderMemoryGrid();
}

function _rkUpdateMemoryMoves() {
  var el = document.getElementById('memory-moves');
  if (el) el.textContent = '已翻 ' + memoryMoves + ' 次';
}

function _rkRenderMemoryGrid() {
  var grid = document.getElementById('memory-grid');
  if (!grid) return;
  grid.style.gridTemplateColumns = 'repeat(' + (memoryCards.length <= 4 ? 2 : 3) + ', 1fr)';
  grid.innerHTML = memoryCards.map(function(card) {
    var cls = 'rk-memory-card' + (card.flipped ? ' flipped' : '') + (card.matched ? ' matched' : '') + (card.hint ? ' hint' : '');
    var front = card.kind === 'image'
      ? '<img class="rk-memory-img" src="' + card.imageUrl + '" alt="">'
      : escHtml(card.value);
    return '<div class="' + cls + '" id="rk-memcard-' + card.id + '" onclick="_rkFlipCard(\'' + card.id + '\')">' +
      '<div class="rk-memory-card-inner">' +
        '<div class="rk-memory-face rk-memory-face-back">🧩</div>' +
        '<div class="rk-memory-face rk-memory-face-front">' + front + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function _rkFlipCard(id) {
  if (memoryBusy) return;
  var card = memoryCards.find(function(c) { return c.id === id; });
  if (!card || card.flipped || card.matched) return;

  card.flipped = true;
  memoryFlipped.push(card);
  _rkRenderMemoryGrid();

  if (memoryFlipped.length === 2) {
    memoryMoves++;
    _rkUpdateMemoryMoves();
    memoryBusy = true;

    var a = memoryFlipped[0], b = memoryFlipped[1];
    var isMatch = a.pairKey === b.pairKey && a.kind !== b.kind;

    if (isMatch) {
      memoryWrongStreak = 0;
      var elA = document.getElementById('rk-memcard-' + a.id);
      var elB = document.getElementById('rk-memcard-' + b.id);
      _rkMemoryMergeEffect(elA, elB, a.phrase);
      setTimeout(function() {
        a.matched = true; b.matched = true;
        memoryFlipped = [];
        memoryBusy = false;
        memoryMatched++;
        _rkRenderMemoryGrid();
        updateRadicalMastery(a.radical, 1, 1);
        _rkCheckMemoryDone();
      }, 500);
    } else {
      sfxWrong();
      memoryWrongStreak++;
      var showHint = memoryWrongStreak >= 2;
      if (showHint) _rkMemoryGiveHint();
      setTimeout(function() {
        a.flipped = false; b.flipped = false;
        if (showHint) memoryWrongStreak = 0;
        _rkRenderMemoryGrid();
        memoryFlipped = [];
        memoryBusy = false;
      }, 800);
    }
  }
}

/* ── 配對成功：兩張卡靠攏融合、星芒特效、音效、唸出口訣 ── */
function _rkMemoryMergeEffect(elA, elB, phrase) {
  sfxCelebrate();
  if (phrase) _rkMemorySpeak(phrase);
  if (!elA || !elB) return;

  var rectA = elA.getBoundingClientRect();
  var rectB = elB.getBoundingClientRect();
  var midX  = (rectA.left + rectA.width / 2 + rectB.left + rectB.width / 2) / 2;
  var midY  = (rectA.top  + rectA.height / 2 + rectB.top  + rectB.height / 2) / 2;

  [elA, elB].forEach(function(el) {
    var r = el.getBoundingClientRect();
    el.style.position   = 'fixed';
    el.style.left       = r.left + 'px';
    el.style.top        = r.top + 'px';
    el.style.width      = r.width + 'px';
    el.style.height     = r.height + 'px';
    el.style.zIndex     = 600;
    el.style.transition = 'left .4s ease-in, top .4s ease-in, transform .4s ease-in, opacity .4s ease-in .15s';
    requestAnimationFrame(function() {
      el.style.left      = (midX - r.width / 2) + 'px';
      el.style.top        = (midY - r.height / 2) + 'px';
      el.style.transform = 'scale(1.25)';
      el.style.opacity    = '0';
    });
  });

  _rkMemorySparkleBurst(midX, midY);
}

function _rkMemorySparkleBurst(x, y) {
  var host = document.body;
  var glyphs = ['✨', '⭐', '✨', '🌟', '✨', '⭐'];
  glyphs.forEach(function(g, i) {
    var angle = (Math.PI * 2 / glyphs.length) * i;
    var dist  = 60 + Math.random() * 30;
    var el = document.createElement('span');
    el.className   = 'rk-memory-sparkle';
    el.textContent = g;
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    el.style.setProperty('--dx', Math.round(Math.cos(angle) * dist) + 'px');
    el.style.setProperty('--dy', Math.round(Math.sin(angle) * dist) + 'px');
    host.appendChild(el);
    setTimeout(function() { el.remove(); }, 750);
  });
}

/* ── 連續兩次配對錯誤：亮起正確配對的邊框（不翻開內容）給視覺提示 ── */
function _rkMemoryGiveHint() {
  var unmatched = memoryCards.filter(function(c) { return !c.matched && !c.flipped; });
  if (!unmatched.length) return;
  var targetKey = unmatched[Math.floor(Math.random() * unmatched.length)].pairKey;

  memoryCards.forEach(function(c) {
    if (c.pairKey === targetKey && !c.matched && !c.flipped) c.hint = true;
  });
  _rkRenderMemoryGrid();

  setTimeout(function() {
    memoryCards.forEach(function(c) { c.hint = false; });
    _rkRenderMemoryGrid();
  }, 1800);
}

function _rkCheckMemoryDone() {
  var totalPairs = memoryCards.length / 2;
  if (memoryMatched < totalPairs) return;
  var statusEl = document.getElementById('memory-status');
  if (statusEl) statusEl.textContent = '🎉 全部配對成功！換一輪…';
  setTimeout(_rkBuildMemoryRound, 1200);
}
