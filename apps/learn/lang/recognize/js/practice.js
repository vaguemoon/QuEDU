/**
 * practice.js — 練習模式
 * 規則：答錯立即提示（紅框），可重選；答對自動進下題
 */
'use strict';

var practiceQuestions = [];
var practiceIdx       = 0;
var practiceCorrect   = 0;
var practiceTried     = 0; // 出題總數（不含重試）

function startPractice() {
  practiceQuestions = buildAllQuestions();
  if (!practiceQuestions.length) { showToast('這一課沒有題目'); return; }
  practiceIdx     = 0;
  practiceCorrect = 0;
  practiceTried   = 0;
  showPage('practice');
  renderPracticeQuestion();
}

function renderPracticeQuestion() {
  var q = practiceQuestions[practiceIdx];
  if (!q) { endPractice(); return; }

  var total   = practiceQuestions.length;
  var numEl   = document.getElementById('prac-q-num');
  var progEl  = document.getElementById('prac-progress-fill');
  var typeEl  = document.getElementById('prac-q-type');
  var gridEl  = document.getElementById('prac-option-grid');
  if (numEl)  numEl.textContent  = '第 ' + (practiceIdx + 1) + ' 題 / 共 ' + total + ' 題';
  if (progEl) progEl.style.width = Math.round((practiceIdx / total) * 100) + '%';
  if (typeEl) typeEl.textContent = q.type === 'char' ? '聽音選字' : '聽音選詞';

  if (gridEl) {
    gridEl.innerHTML = q.options.map(function(opt) {
      return '<button class="option-btn" data-value="' + opt + '" onclick="onPracticeOption(this)">' + opt + '</button>';
    }).join('');
  }

  speakText(q.answer);
}

function onPracticeOption(btn) {
  var q       = practiceQuestions[practiceIdx];
  var chosen  = btn.dataset.value;
  var allBtns = document.querySelectorAll('#prac-option-grid .option-btn');

  allBtns.forEach(function(b) { b.disabled = true; });

  if (chosen === q.answer) {
    btn.classList.add('correct');
    sfxCorrect();
    practiceCorrect++;
    setTimeout(function() { practiceIdx++; renderPracticeQuestion(); }, 700);
  } else {
    btn.classList.add('wrong');
    sfxWrong();
    // 允許重試：延遲後重新啟用其他按鈕，保持錯誤選項紅框且禁用
    setTimeout(function() {
      allBtns.forEach(function(b) {
        if (!b.classList.contains('wrong')) b.disabled = false;
      });
    }, 500);
  }
}

function replayPracticeAudio() {
  var q = practiceQuestions[practiceIdx];
  if (q) speakText(q.answer);
}

function endPractice() {
  var total  = practiceQuestions.length;
  var pct    = total ? Math.round(practiceCorrect / total * 100) : 0;
  var iconEl = document.getElementById('prac-result-icon');
  var titleEl= document.getElementById('prac-result-title');
  var subEl  = document.getElementById('prac-result-sub');
  if (iconEl)  iconEl.textContent  = pct >= 80 ? '🎉' : pct >= 60 ? '👏' : '💪';
  if (titleEl) titleEl.textContent = '練習完成！';
  if (subEl)   subEl.textContent   = '答對 ' + practiceCorrect + ' / ' + total + ' 題（' + pct + ' %）';
  showPage('practice-result');
  sfxPass();
}
