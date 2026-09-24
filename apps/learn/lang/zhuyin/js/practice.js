/**
 * practice.js — 練習模式（聽音選字／看字選音 共用）
 * 第一輪按固定順序出題，之後隨機出題。答錯可重選；精熟度星數依首次答對率即時更新，無結算頁。
 * 星數門檻：0星<60%、1星≥60%、2星≥70%、3星≥80%（且已見範圍內全部符號）
 */
'use strict';

var zpSeenSymbols     = null;
var zpFirstCorrect    = 0;
var zpTotalAnswered   = 0;
var zpIsFirstAttempt  = true;
var zpCurrentQ        = null;
var zpVocabCount      = 0;

var zpFirstRoundQueue = [];
var zpFirstRoundIdx   = 0;
var zpPrevStars       = 0;
var zpActiveSymbols   = [];
var zpPendingBtn      = null; // 看字選音：已試聽、等待「確認答案」的選項按鈕

function startZyPractice(selectedItems) {
  zpActiveSymbols = (selectedItems && selectedItems.length)
    ? zyAllSymbols.filter(function(s) { return selectedItems.indexOf(s) !== -1; })
    : zyAllSymbols.slice();
  zpVocabCount = zpActiveSymbols.length;
  if (!zpVocabCount) { showToast('請先選擇要練習的符號'); return; }

  zpSeenSymbols     = new Set();
  zpFirstCorrect    = 0;
  zpTotalAnswered   = 0;
  zpPrevStars       = 0;
  zpFirstRoundQueue = shuffle(zpActiveSymbols).map(function(s) {
    return { answer: s, options: buildZpOptions(s) };
  });
  zpFirstRoundIdx = 0;

  showPage('zy-practice');
  _zySetDirectionTitle();
  updateZpProgress();
  updateZpMastery();
  zpNextQuestion();
}

function buildZpOptions(answer) {
  var extraPool = zyAllSymbols.filter(function(x) { return zpActiveSymbols.indexOf(x) === -1; });
  return buildZyOptions(answer, zpActiveSymbols, extraPool);
}

function zpNextQuestion() {
  if (zpFirstRoundIdx < zpFirstRoundQueue.length) {
    zpCurrentQ = zpFirstRoundQueue[zpFirstRoundIdx++];
  } else {
    var s = zpActiveSymbols[Math.floor(Math.random() * zpActiveSymbols.length)];
    zpCurrentQ = { answer: s, options: buildZpOptions(s) };
  }
  zpIsFirstAttempt = true;
  if (!zpCurrentQ) return;
  zpSeenSymbols.add(zpCurrentQ.answer);
  renderZpQuestion();
}

function renderZpQuestion() {
  var q       = zpCurrentQ;
  var numEl   = document.getElementById('prac-q-num');
  var gridEl  = document.getElementById('prac-option-grid');
  var promptEl   = document.getElementById('prac-prompt');
  var audioBtn   = document.getElementById('prac-audio-btn');
  var confirmBtn = document.getElementById('prac-confirm-btn');
  if (numEl) numEl.textContent = '已答 ' + zpTotalAnswered + ' 題';

  zpPendingBtn = null;
  if (confirmBtn) { confirmBtn.style.display = zyDirection === 'read' ? '' : 'none'; confirmBtn.disabled = true; }

  if (zyDirection === 'listen') {
    if (audioBtn) audioBtn.style.display = '';
    if (promptEl) promptEl.innerHTML = '';
    if (gridEl) {
      gridEl.innerHTML = q.options.map(function(opt) {
        return '<button class="option-btn" data-value="' + opt + '" onclick="onZpOption(this)">' + opt + '</button>';
      }).join('');
    }
    zySpeakSymbol(q.answer);
  } else {
    if (audioBtn) audioBtn.style.display = 'none';
    /* 提示符號改成純顯示，不可點擊——點了會直接聽到正解，等於洩題 */
    if (promptEl) promptEl.innerHTML = '<div class="zy-quiz-prompt-symbol">' + q.answer + '</div>';
    if (gridEl) {
      gridEl.innerHTML = q.options.map(function(opt, i) {
        return '<button class="option-btn zy-audio-option" data-value="' + opt + '" onclick="onZpOption(this)">' +
          '<span class="zy-audio-option-icon">🔊</span><span>選項 ' + (i + 1) + '</span></button>';
      }).join('');
    }
  }
}

/* 看字選音：點選項只是試聽＋標記待確認，不會馬上判對錯；
   聽音選字維持原本點了就直接送出答案 */
function onZpOption(btn) {
  if (zyDirection === 'read') {
    zySpeakSymbol(btn.dataset.value);
    if (zpPendingBtn) zpPendingBtn.classList.remove('pending-select');
    zpPendingBtn = btn;
    btn.classList.add('pending-select');
    var confirmBtn = document.getElementById('prac-confirm-btn');
    if (confirmBtn) confirmBtn.disabled = false;
    return;
  }
  _commitZpAnswer(btn);
}

function onZpConfirm() {
  if (!zpPendingBtn) return;
  var btn = zpPendingBtn;
  zpPendingBtn = null;
  var confirmBtn = document.getElementById('prac-confirm-btn');
  if (confirmBtn) confirmBtn.disabled = true;
  _commitZpAnswer(btn);
}

function _commitZpAnswer(btn) {
  var q       = zpCurrentQ;
  var chosen  = btn.dataset.value;
  var allBtns = document.querySelectorAll('#prac-option-grid .option-btn');
  allBtns.forEach(function(b) { b.disabled = true; b.classList.remove('pending-select'); });

  if (chosen === q.answer) {
    btn.classList.add('correct');
    sfxCorrect();
    zpTotalAnswered++;
    if (zpIsFirstAttempt) zpFirstCorrect++;
    updateZpProgress();
    updateZpMastery();
    setTimeout(function() { zpNextQuestion(); }, 700);
  } else {
    btn.classList.add('wrong');
    sfxWrong();
    zpIsFirstAttempt = false;
    setTimeout(function() {
      allBtns.forEach(function(b) {
        if (!b.classList.contains('wrong')) b.disabled = false;
      });
      /* 看字選音重試：確認鍵要等下一次試聽選擇才會再打開 */
      if (zyDirection === 'read') {
        var confirmBtn = document.getElementById('prac-confirm-btn');
        if (confirmBtn) confirmBtn.disabled = true;
      }
    }, 500);
  }
}

function updateZpProgress() {
  var progEl = document.getElementById('prac-progress-fill');
  if (!progEl || !zpVocabCount) return;
  var pct = Math.min(100, Math.round(zpSeenSymbols.size / zpVocabCount * 100));
  progEl.style.width = pct + '%';
}

function updateZpMastery() {
  var infoEl = document.getElementById('prac-bar-info');
  if (!infoEl) return;

  if (zpSeenSymbols.size < zpVocabCount) {
    for (var j = 1; j <= 3; j++) {
      var s = document.getElementById('prac-star-' + j);
      if (s) s.className = 'prac-star';
    }
    infoEl.textContent = '再多練習幾題吧！';
    return;
  }

  var rate  = zpTotalAnswered ? zpFirstCorrect / zpTotalAnswered : 0;
  var pct   = Math.round(rate * 100);
  var stars = rate >= 0.80 ? 3 : rate >= 0.70 ? 2 : rate >= 0.60 ? 1 : 0;

  for (var i = 1; i <= 3; i++) {
    var el = document.getElementById('prac-star-' + i);
    if (!el) continue;
    var wasFilled = el.classList.contains('filled');
    el.className  = 'prac-star' + (i <= stars ? ' filled' : '');
    if (i <= stars && !wasFilled) {
      el.classList.add('pop');
      el.addEventListener('animationend', function() { this.classList.remove('pop'); }, { once: true });
    }
  }

  if (stars === 3 && zpPrevStars < 3) sfxCelebrate();
  zpPrevStars = stars;

  var nextNeeded = stars === 0 ? 60 : stars === 1 ? 70 : stars === 2 ? 80 : null;
  infoEl.textContent = nextNeeded
    ? '目前：' + pct + '%｜' + (stars + 1) + '星需 ≥' + nextNeeded + '%'
    : '目前：' + pct + '%｜已達最高星！';
}

function replayZpAudio() {
  if (zpCurrentQ && zyDirection === 'listen') zySpeakSymbol(zpCurrentQ.answer);
}
