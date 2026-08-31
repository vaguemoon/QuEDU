/**
 * exam.js — 測驗模式（無限輪次，直到全部答對）
 */
'use strict';

var examRound1           = [];
var examCurrentRound     = 1;
var examCurrentQuestions = [];
var examCurrentCorrect   = 0;
var examCurrentFailed    = [];
var examRoundHistory     = [];
var examIdx              = 0;

function startExam() {
  examRound1 = buildAllQuestions();
  if (!examRound1.length) { showToast('這一課沒有題目'); return; }
  examCurrentRound     = 1;
  examCurrentQuestions = examRound1.slice();
  examCurrentCorrect   = 0;
  examCurrentFailed    = [];
  examRoundHistory     = [];
  examIdx              = 0;
  showPage('exam');
  renderExamQuestion();
}

function renderExamQuestion() {
  var q = examCurrentQuestions[examIdx];
  if (!q) { endExamRound(); return; }

  var total   = examCurrentQuestions.length;
  var numEl   = document.getElementById('exam-q-num');
  var progEl  = document.getElementById('exam-progress-fill');
  var roundEl = document.getElementById('exam-round-label');
  var typeEl  = document.getElementById('exam-q-type');
  var gridEl  = document.getElementById('exam-option-grid');

  if (numEl)   numEl.textContent   = '第 ' + (examIdx + 1) + ' 題 / 共 ' + total + ' 題';
  if (progEl)  progEl.style.width  = Math.round((examIdx / total) * 100) + '%';
  if (roundEl) roundEl.textContent = 'Round ' + examCurrentRound;
  if (typeEl)  typeEl.textContent  = q.type === 'char' ? '聽音選字' : '聽音選詞';

  if (gridEl) {
    gridEl.innerHTML = q.options.map(function(opt) {
      return '<button class="option-btn" data-value="' + opt + '" onclick="onExamOption(this)">' + opt + '</button>';
    }).join('');
  }

  speakText(q.answer);
}

function onExamOption(btn) {
  var q       = examCurrentQuestions[examIdx];
  var chosen  = btn.dataset.value;
  var allBtns = document.querySelectorAll('#exam-option-grid .option-btn');

  allBtns.forEach(function(b) { b.disabled = true; });

  if (chosen === q.answer) {
    btn.classList.add('correct');
    sfxCorrect();
    examCurrentCorrect++;
  } else {
    allBtns.forEach(function(b) {
      if (b.dataset.value === q.answer) b.classList.add('correct');
    });
    btn.classList.add('wrong');
    sfxWrong();
    examCurrentFailed.push(q);
  }

  setTimeout(function() { examIdx++; renderExamQuestion(); }, 750);
}

function replayExamAudio() {
  var q = examCurrentQuestions[examIdx];
  if (q) speakText(q.answer);
}

function endExamRound() {
  examRoundHistory.push({
    round:     examCurrentRound,
    correct:   examCurrentCorrect,
    total:     examCurrentQuestions.length,
    questions: examCurrentQuestions.slice(),
    failed:    examCurrentFailed.slice()
  });
  renderRoundResult();
}

function renderRoundResult() {
  var h        = examRoundHistory[examRoundHistory.length - 1];
  var failed   = h.failed;
  var correct  = h.correct;
  var total    = h.total;
  var questions = examCurrentQuestions;

  var iconEl   = document.getElementById('round-icon');
  var titleEl  = document.getElementById('round-title');
  var subEl    = document.getElementById('round-sub');
  var passGrid = document.getElementById('round-pass-grid');
  var failGrid = document.getElementById('round-fail-grid');
  var passSec  = document.getElementById('round-pass-section');
  var failSec  = document.getElementById('round-fail-section');
  var nextBtn  = document.getElementById('btn-next-round');

  if (iconEl)  iconEl.textContent  = failed.length === 0 ? '🎉' : '📊';
  if (titleEl) titleEl.textContent = 'Round ' + examCurrentRound + ' 結算';
  if (subEl)   subEl.textContent   = '答對 ' + correct + ' / ' + total + ' 題';

  var passItems = questions.filter(function(q) { return failed.indexOf(q) === -1; });

  if (passGrid && passSec) {
    passSec.style.display = passItems.length ? '' : 'none';
    passGrid.innerHTML = passItems.map(function(q) {
      return '<span class="round-chip round-pass" onclick="speakText(\'' + q.answer + '\')">' + q.answer + '</span>';
    }).join('');
  }
  if (failGrid && failSec) {
    failSec.style.display = failed.length ? '' : 'none';
    failGrid.innerHTML = failed.map(function(q) {
      return '<span class="round-chip round-fail" onclick="speakText(\'' + q.answer + '\')">' + q.answer + '</span>';
    }).join('');
  }

  if (nextBtn) {
    if (failed.length > 0) {
      nextBtn.textContent = '開始 Round ' + (examCurrentRound + 1) + ' →';
    } else {
      nextBtn.textContent = '查看最終結果 →';
    }
  }

  if (failed.length === 0) {
    if (examCurrentRound === 1) sfxGrandCelebrate();
    else sfxCelebrate();
  }

  showPage('exam-round-result');
}

function startNextRound() {
  if (examCurrentFailed.length > 0) {
    var nextQuestions    = examCurrentFailed.slice();
    examCurrentRound++;
    examCurrentQuestions = nextQuestions;
    examCurrentCorrect   = 0;
    examCurrentFailed    = [];
    examIdx              = 0;
    showPage('exam');
    renderExamQuestion();
  } else {
    finishExam();
  }
}

function finishExam() {
  // 建立每題首次答對的輪次對照表
  var firstPassRound = {};
  examRoundHistory.forEach(function(h) {
    h.questions.forEach(function(q) {
      if (h.failed.indexOf(q) === -1 && !firstPassRound[q.answer]) {
        firstPassRound[q.answer] = h.round;
      }
    });
  });

  examRound1.forEach(function(q) {
    var statusMap  = q.type === 'char' ? charStatus : wordStatus;
    var roundPassed = firstPassRound[q.answer];
    if (roundPassed === 1) {
      statusMap[q.answer] = 'mastered';
    } else if (roundPassed) {
      if (statusMap[q.answer] !== 'mastered') statusMap[q.answer] = 'practiced';
    }
  });
  saveProgress();

  var total  = examRound1.length;
  var rounds = examRoundHistory.length;

  var iconEl   = document.getElementById('exam-result-icon');
  var titleEl  = document.getElementById('exam-result-title');
  var subEl    = document.getElementById('exam-result-sub');
  var roundsEl = document.getElementById('exam-result-rounds');

  if (iconEl)  iconEl.textContent  = rounds === 1 ? '🏆' : '🎉';
  if (titleEl) titleEl.textContent = '全部答對！';
  if (subEl)   subEl.textContent   = '共 ' + total + ' 題，經過 ' + rounds + ' 輪完成';
  if (roundsEl) {
    roundsEl.innerHTML = examRoundHistory.map(function(h) {
      return '<div class="result-detail">Round ' + h.round + '：' + h.correct + ' / ' + h.total + ' 答對</div>';
    }).join('');
  }

  showPage('exam-result');
  if (rounds === 1) sfxGrandCelebrate();
  else sfxCelebrate();

  renderMenu();
}
