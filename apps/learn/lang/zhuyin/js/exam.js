/**
 * exam.js — 測驗模式（聽音選字／看字選音 共用，無限輪次，直到全部答對）
 * 一律涵蓋全部 37 個符號，不受練習頁自選範圍影響（跟認字趣的測驗模式一致）。
 */
'use strict';

var zeRound1           = [];
var zeCurrentRound     = 1;
var zeCurrentQuestions = [];
var zeCurrentCorrect   = 0;
var zeCurrentFailed    = [];
var zeRoundHistory     = [];
var zeIdx              = 0;
var zePendingBtn       = null; // 看字選音：已試聽、等待「確認答案」的選項按鈕

function startZyExam() {
  zeRound1 = shuffle(zyAllSymbols.map(function(s) {
    return { answer: s, options: buildZyOptions(s, zyAllSymbols, []) };
  }));
  if (!zeRound1.length) { showToast('沒有可測驗的符號'); return; }
  zeCurrentRound     = 1;
  zeCurrentQuestions = zeRound1.slice();
  zeCurrentCorrect   = 0;
  zeCurrentFailed    = [];
  zeRoundHistory     = [];
  zeIdx              = 0;
  showPage('zy-exam');
  _zySetDirectionTitle();
  renderZeQuestion();
}

function renderZeQuestion() {
  var q = zeCurrentQuestions[zeIdx];
  if (!q) { endZeRound(); return; }

  var total     = zeCurrentQuestions.length;
  var numEl     = document.getElementById('exam-q-num');
  var progEl    = document.getElementById('exam-progress-fill');
  var roundEl   = document.getElementById('exam-round-label');
  var gridEl    = document.getElementById('exam-option-grid');
  var promptEl  = document.getElementById('exam-prompt');
  var audioWrap = document.getElementById('exam-audio-wrap');
  var confirmBtn = document.getElementById('exam-confirm-btn');

  if (numEl)   numEl.textContent   = '第 ' + (zeIdx + 1) + ' 題 / 共 ' + total + ' 題';
  if (progEl)  progEl.style.width  = Math.round((zeIdx / total) * 100) + '%';
  if (roundEl) roundEl.textContent = 'Round ' + zeCurrentRound;

  zePendingBtn = null;
  if (confirmBtn) { confirmBtn.style.display = zyDirection === 'read' ? '' : 'none'; confirmBtn.disabled = true; }

  if (zyDirection === 'listen') {
    if (audioWrap) audioWrap.style.display = '';
    if (promptEl)  promptEl.innerHTML = '';
    if (gridEl) {
      gridEl.innerHTML = q.options.map(function(opt) {
        return '<button class="option-btn" data-value="' + opt + '" onclick="onZeOption(this)">' + opt + '</button>';
      }).join('');
    }
    zySpeakSymbol(q.answer);
  } else {
    if (audioWrap) audioWrap.style.display = 'none';
    /* 提示符號改成純顯示，不可點擊——點了會直接聽到正解，等於洩題 */
    if (promptEl) promptEl.innerHTML = '<div class="zy-quiz-prompt-symbol">' + q.answer + '</div>';
    if (gridEl) {
      gridEl.innerHTML = q.options.map(function(opt, i) {
        return '<button class="option-btn zy-audio-option" data-value="' + opt + '" onclick="onZeOption(this)">' +
          '<span class="zy-audio-option-icon">🔊</span><span>選項 ' + (i + 1) + '</span></button>';
      }).join('');
    }
  }
}

/* 看字選音：點選項只是試聽＋標記待確認，不會馬上判對錯；
   聽音選字維持原本點了就直接送出答案 */
function onZeOption(btn) {
  if (zyDirection === 'read') {
    zySpeakSymbol(btn.dataset.value);
    if (zePendingBtn) zePendingBtn.classList.remove('pending-select');
    zePendingBtn = btn;
    btn.classList.add('pending-select');
    var confirmBtn = document.getElementById('exam-confirm-btn');
    if (confirmBtn) confirmBtn.disabled = false;
    return;
  }
  _commitZeAnswer(btn);
}

function onZeConfirm() {
  if (!zePendingBtn) return;
  var btn = zePendingBtn;
  zePendingBtn = null;
  var confirmBtn = document.getElementById('exam-confirm-btn');
  if (confirmBtn) confirmBtn.disabled = true;
  _commitZeAnswer(btn);
}

function _commitZeAnswer(btn) {
  var q       = zeCurrentQuestions[zeIdx];
  var chosen  = btn.dataset.value;
  var allBtns = document.querySelectorAll('#exam-option-grid .option-btn');
  allBtns.forEach(function(b) { b.disabled = true; b.classList.remove('pending-select'); });

  if (chosen === q.answer) {
    btn.classList.add('correct');
    sfxCorrect();
    zeCurrentCorrect++;
  } else {
    allBtns.forEach(function(b) {
      if (b.dataset.value === q.answer) b.classList.add('correct');
    });
    btn.classList.add('wrong');
    sfxWrong();
    zeCurrentFailed.push(q);
    if (zyDirection === 'read') setTimeout(function() { zySpeakSymbol(q.answer); }, 300);
  }

  setTimeout(function() { zeIdx++; renderZeQuestion(); }, 750);
}

function replayZeAudio() {
  var q = zeCurrentQuestions[zeIdx];
  if (q && zyDirection === 'listen') zySpeakSymbol(q.answer);
}

function endZeRound() {
  zeRoundHistory.push({
    round:     zeCurrentRound,
    correct:   zeCurrentCorrect,
    total:     zeCurrentQuestions.length,
    questions: zeCurrentQuestions.slice(),
    failed:    zeCurrentFailed.slice()
  });
  renderZeRoundResult();
}

function renderZeRoundResult() {
  var h       = zeRoundHistory[zeRoundHistory.length - 1];
  var failed  = h.failed;
  var correct = h.correct;
  var total   = h.total;
  var questions = zeCurrentQuestions;

  var iconEl   = document.getElementById('round-icon');
  var titleEl  = document.getElementById('round-title');
  var subEl    = document.getElementById('round-sub');
  var passGrid = document.getElementById('round-pass-grid');
  var failGrid = document.getElementById('round-fail-grid');
  var passSec  = document.getElementById('round-pass-section');
  var failSec  = document.getElementById('round-fail-section');
  var nextBtn  = document.getElementById('btn-next-round');

  if (iconEl)  iconEl.textContent  = failed.length === 0 ? '🎉' : '📊';
  if (titleEl) titleEl.textContent = 'Round ' + zeCurrentRound + ' 結算';
  if (subEl)   subEl.textContent   = '答對 ' + correct + ' / ' + total + ' 題';

  var passItems = questions.filter(function(q) { return failed.indexOf(q) === -1; });

  if (passGrid && passSec) {
    passSec.style.display = passItems.length ? '' : 'none';
    passGrid.innerHTML = passItems.map(function(q) {
      return '<span class="round-chip round-pass" onclick="zySpeakSymbol(\'' + q.answer + '\')">' + q.answer + '</span>';
    }).join('');
  }
  if (failGrid && failSec) {
    failSec.style.display = failed.length ? '' : 'none';
    failGrid.innerHTML = failed.map(function(q) {
      return '<span class="round-chip round-fail" onclick="zySpeakSymbol(\'' + q.answer + '\')">' + q.answer + '</span>';
    }).join('');
  }

  if (nextBtn) {
    nextBtn.textContent = failed.length > 0
      ? '開始 Round ' + (zeCurrentRound + 1) + ' →'
      : '查看最終結果 →';
  }

  if (failed.length === 0) {
    if (zeCurrentRound === 1) sfxGrandCelebrate();
    else sfxCelebrate();
  }

  showPage('zy-exam-round-result');
}

function startZeNextRound() {
  if (zeCurrentFailed.length > 0) {
    zeCurrentRound++;
    zeCurrentQuestions = zeCurrentFailed.slice();
    zeCurrentCorrect   = 0;
    zeCurrentFailed    = [];
    zeIdx              = 0;
    showPage('zy-exam');
    _zySetDirectionTitle();
    renderZeQuestion();
  } else {
    finishZeExam();
  }
}

function finishZeExam() {
  var firstPassRound = {};
  zeRoundHistory.forEach(function(h) {
    h.questions.forEach(function(q) {
      if (h.failed.indexOf(q) === -1 && !firstPassRound[q.answer]) {
        firstPassRound[q.answer] = h.round;
      }
    });
  });

  var statusMap = zyDirection === 'listen' ? zySymbolStatus.listenStatus : zySymbolStatus.readStatus;
  zeRound1.forEach(function(q) {
    var roundPassed = firstPassRound[q.answer];
    if (roundPassed === 1) {
      statusMap[q.answer] = 'mastered';
    } else if (roundPassed) {
      if (statusMap[q.answer] !== 'mastered') statusMap[q.answer] = 'practiced';
    }
  });
  saveZySymbolStatus();

  var total  = zeRound1.length;
  var rounds = zeRoundHistory.length;

  var iconEl   = document.getElementById('exam-result-icon');
  var titleEl  = document.getElementById('exam-result-title');
  var subEl    = document.getElementById('exam-result-sub');
  var roundsEl = document.getElementById('exam-result-rounds');

  if (iconEl)  iconEl.textContent  = rounds === 1 ? '🏆' : '🎉';
  if (titleEl) titleEl.textContent = '全部答對！';
  if (subEl)   subEl.textContent   = '共 ' + total + ' 題，經過 ' + rounds + ' 輪完成';
  if (roundsEl) {
    roundsEl.innerHTML = zeRoundHistory.map(function(h) {
      return '<div class="result-detail">Round ' + h.round + '：' + h.correct + ' / ' + h.total + ' 答對</div>';
    }).join('');
  }

  showPage('zy-exam-result');
  _zySetDirectionTitle();
  if (rounds === 1) sfxGrandCelebrate();
  else sfxCelebrate();

  renderZyMenu();
}
