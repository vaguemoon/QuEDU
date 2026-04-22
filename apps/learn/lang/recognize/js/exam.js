/**
 * exam.js — 測驗模式（兩輪制 + 每輪結算畫面）
 * Round 1 全部題目 → Round 1 結算 → Round 2（答錯的）→ Round 2 結算 → 最終結果
 */
'use strict';

var examRound1   = [];
var examRound2   = [];
var examRound    = 1;
var examIdx      = 0;
var examCorrect  = 0;
var examR2Correct= 0;
var examFailedR1 = [];
var examFailedR2 = [];

function startExam() {
  examRound1    = buildAllQuestions();
  if (!examRound1.length) { showToast('這一課沒有題目'); return; }
  examRound2    = [];
  examRound     = 1;
  examIdx       = 0;
  examCorrect   = 0;
  examR2Correct = 0;
  examFailedR1  = [];
  examFailedR2  = [];
  showPage('exam');
  renderExamQuestion();
}

function currentRoundQuestions() {
  return examRound === 1 ? examRound1 : examRound2;
}

function renderExamQuestion() {
  var questions = currentRoundQuestions();
  var q         = questions[examIdx];
  if (!q) { endExamRound(); return; }

  var total   = questions.length;
  var numEl   = document.getElementById('exam-q-num');
  var progEl  = document.getElementById('exam-progress-fill');
  var roundEl = document.getElementById('exam-round-label');
  var typeEl  = document.getElementById('exam-q-type');
  var gridEl  = document.getElementById('exam-option-grid');

  if (numEl)   numEl.textContent   = '第 ' + (examIdx + 1) + ' 題 / 共 ' + total + ' 題';
  if (progEl)  progEl.style.width  = Math.round((examIdx / total) * 100) + '%';
  if (roundEl) roundEl.textContent = 'Round ' + examRound;
  if (typeEl)  typeEl.textContent  = q.type === 'char' ? '聽音選字' : '聽音選詞';

  if (gridEl) {
    gridEl.innerHTML = q.options.map(function(opt) {
      return '<button class="option-btn" data-value="' + opt + '" onclick="onExamOption(this)">' + opt + '</button>';
    }).join('');
  }

  speakText(q.answer);
}

function onExamOption(btn) {
  var questions = currentRoundQuestions();
  var q         = questions[examIdx];
  var chosen    = btn.dataset.value;
  var allBtns   = document.querySelectorAll('#exam-option-grid .option-btn');

  allBtns.forEach(function(b) { b.disabled = true; });

  if (chosen === q.answer) {
    btn.classList.add('correct');
    sfxCorrect();
    if (examRound === 1) examCorrect++;
    else examR2Correct++;
  } else {
    allBtns.forEach(function(b) {
      if (b.dataset.value === q.answer) b.classList.add('correct');
    });
    btn.classList.add('wrong');
    sfxWrong();
    if (examRound === 1) examFailedR1.push(q);
    else examFailedR2.push(q);
  }

  setTimeout(function() { examIdx++; renderExamQuestion(); }, 750);
}

function replayExamAudio() {
  var questions = currentRoundQuestions();
  var q = questions[examIdx];
  if (q) speakText(q.answer);
}

function endExamRound() {
  // 顯示本輪結算畫面
  renderRoundResult();
}

function renderRoundResult() {
  var questions = currentRoundQuestions();
  var failed    = examRound === 1 ? examFailedR1 : examFailedR2;
  var correct   = examRound === 1 ? examCorrect  : examR2Correct;
  var total     = questions.length;

  var iconEl   = document.getElementById('round-icon');
  var titleEl  = document.getElementById('round-title');
  var subEl    = document.getElementById('round-sub');
  var passGrid = document.getElementById('round-pass-grid');
  var failGrid = document.getElementById('round-fail-grid');
  var passSec  = document.getElementById('round-pass-section');
  var failSec  = document.getElementById('round-fail-section');
  var nextBtn  = document.getElementById('btn-next-round');

  if (iconEl)  iconEl.textContent  = failed.length === 0 ? '🎉' : '📊';
  if (titleEl) titleEl.textContent = 'Round ' + examRound + ' 結算';
  if (subEl)   subEl.textContent   = '答對 ' + correct + ' / ' + total + ' 題';

  var passItems = questions.filter(function(q) {
    return failed.indexOf(q) === -1;
  });

  if (passGrid && passSec) {
    passSec.style.display = passItems.length ? '' : 'none';
    passGrid.innerHTML = passItems.map(function(q) {
      return '<span class="round-chip round-pass">' + q.answer + '</span>';
    }).join('');
  }
  if (failGrid && failSec) {
    failSec.style.display = failed.length ? '' : 'none';
    failGrid.innerHTML = failed.map(function(q) {
      return '<span class="round-chip round-fail">' + q.answer + '</span>';
    }).join('');
  }

  // 按鈕文字
  if (nextBtn) {
    if (examRound === 1 && failed.length > 0) {
      nextBtn.textContent = '開始 Round 2 →';
      nextBtn.style.display = '';
    } else {
      nextBtn.textContent = '查看最終結果 →';
      nextBtn.style.display = '';
    }
  }

  // 全對時慶祝音效
  if (failed.length === 0) {
    if (examRound === 1) sfxGrandCelebrate();
    else sfxCelebrate();
  }

  showPage('exam-round-result');
}

function startNextRound() {
  if (examRound === 1 && examFailedR1.length > 0) {
    examRound2 = examFailedR1.slice();
    examRound  = 2;
    examIdx    = 0;
    showPage('exam');
    renderExamQuestion();
  } else {
    finishExam();
  }
}

function finishExam() {
  // 更新進度狀態
  examRound1.forEach(function(q) {
    var passedR1 = examFailedR1.indexOf(q) === -1;
    var inR2     = examRound2.indexOf(q) !== -1;
    var passedR2 = inR2 && examFailedR2.indexOf(q) === -1;
    var statusMap = q.type === 'char' ? charStatus : wordStatus;
    if (passedR1) {
      statusMap[q.answer] = 'mastered';
    } else if (passedR2) {
      if (statusMap[q.answer] !== 'mastered') statusMap[q.answer] = 'practiced';
    }
  });
  saveProgress();

  var r2Total  = examRound2.length;
  var r2Passed = r2Total - examFailedR2.length;
  var passed   = examCorrect + r2Passed;
  var total    = examRound1.length;
  var pct      = total ? Math.round(passed / total * 100) : 0;

  var iconEl  = document.getElementById('exam-result-icon');
  var titleEl = document.getElementById('exam-result-title');
  var subEl   = document.getElementById('exam-result-sub');
  var r1El    = document.getElementById('exam-result-r1');
  var r2El    = document.getElementById('exam-result-r2');

  if (iconEl)  iconEl.textContent  = pct >= 80 ? '🎉' : pct >= 60 ? '👏' : '💪';
  if (titleEl) titleEl.textContent = '測驗完成！';
  if (subEl)   subEl.textContent   = '最終得分 ' + pct + ' 分（' + passed + ' / ' + total + ' 題答對）';
  if (r1El)    r1El.textContent    = 'Round 1：' + examCorrect + ' / ' + examRound1.length + ' 答對';
  if (r2El) {
    r2El.textContent = r2Total ? 'Round 2：' + r2Passed + ' / ' + r2Total + ' 答對' : '';
  }

  showPage('exam-result');
  if (pct === 100) sfxGrandCelebrate();
  else if (pct >= 80) sfxCelebrate();
  else sfxPass();

  renderMenu();
}
