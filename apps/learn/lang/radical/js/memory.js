/**
 * memory.js — 翻牌配對遊戲：部件卡與含有該部件的字卡配對
 */
'use strict';

var memoryCards    = []; // [{ id, kind:'radical'|'char', value, radical, flipped, matched }]
var memoryFlipped   = [];
var memoryMoves     = 0;
var memoryMatched   = 0;
var memoryBusy      = false;
var MEMORY_MAX_PAIRS = 6;

function startMemory() {
  var radicals = getDistinctRadicals();
  if (radicals.length < 2) { showToast('這個練習集的部件種類不足，無法開始遊戲'); return; }

  showPage('memory');
  _rkBuildMemoryRound();
}

function _rkBuildMemoryRound() {
  var radicals = shuffle(getDistinctRadicals()).slice(0, MEMORY_MAX_PAIRS);
  memoryCards  = [];
  radicals.forEach(function(r, i) {
    var chars = getCharsForRadical(r);
    var pickChar = chars[Math.floor(Math.random() * chars.length)];
    memoryCards.push({ id: 'r' + i, kind: 'radical', value: r,        radical: r, flipped: false, matched: false });
    memoryCards.push({ id: 'c' + i, kind: 'char',    value: pickChar, radical: r, flipped: false, matched: false });
  });
  memoryCards = shuffle(memoryCards);

  memoryFlipped = [];
  memoryMoves   = 0;
  memoryMatched = 0;
  memoryBusy    = false;

  var statusEl = document.getElementById('memory-status');
  if (statusEl) statusEl.textContent = '翻開卡片，配對部件與字';
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
  grid.innerHTML = memoryCards.map(function(card) {
    var cls = 'rk-memory-card' + (card.flipped ? ' flipped' : '') + (card.matched ? ' matched' : '');
    return '<div class="' + cls + '" onclick="_rkFlipCard(\'' + card.id + '\')">' +
      '<div class="rk-memory-card-inner">' +
        '<div class="rk-memory-face rk-memory-face-back">🧩</div>' +
        '<div class="rk-memory-face rk-memory-face-front">' + escHtml(card.value) + '</div>' +
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
    var isMatch = a.radical === b.radical && a.kind !== b.kind;

    if (isMatch) {
      setTimeout(function() {
        a.matched = true; b.matched = true;
        memoryFlipped = [];
        memoryBusy = false;
        memoryMatched++;
        _rkRenderMemoryGrid();
        updateRadicalMastery(a.radical, 1, 1);
        _rkCheckMemoryDone();
      }, 400);
    } else {
      setTimeout(function() {
        a.flipped = false; b.flipped = false;
        memoryFlipped = [];
        memoryBusy = false;
        _rkRenderMemoryGrid();
      }, 800);
    }
  }
}

function _rkCheckMemoryDone() {
  var totalPairs = memoryCards.length / 2;
  if (memoryMatched < totalPairs) return;
  var statusEl = document.getElementById('memory-status');
  if (statusEl) statusEl.textContent = '🎉 全部配對成功！換一輪…';
  setTimeout(_rkBuildMemoryRound, 1200);
}
