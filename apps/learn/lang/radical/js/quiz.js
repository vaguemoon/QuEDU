/**
 * quiz.js — 四選一練習：看部件選字（c2w）／看字選部件（w2c）共用
 * 每答對一題累計到對應部件的首次答對率，用來更新熟練度。
 */
'use strict';

var quizDirection      = 'c2w';
var quizQueue          = [];
var quizIdx            = 0;
var quizCurrentQ       = null;
var quizAnswered       = 0;
var quizIsFirstAttempt = true;
var quizStats          = {}; // { radical: { correct, total } }

function startQuiz(direction) {
  var radicals = getDistinctRadicals();
  if (radicals.length < 2) { showToast('這個練習集的部件種類不足，無法出題'); return; }
  if (direction === 'w2c' && !currentSetItems.length) { showToast('這個練習集還沒有字'); return; }

  quizDirection = direction;
  quizAnswered  = 0;
  quizStats     = {};
  quizQueue     = _rkBuildQuizQueue(direction);
  quizIdx       = 0;

  var typeEl = document.getElementById('quiz-q-type');
  if (typeEl) typeEl.textContent = direction === 'c2w' ? '看部件選字' : '看字選部件';

  showPage('quiz');
  _rkQuizNext();
}

function _rkBuildQuizQueue(direction) {
  if (direction === 'c2w') {
    return shuffle(getDistinctRadicals().map(function(r) {
      var chars = getCharsForRadical(r);
      return { radical: r, prompt: r, answer: chars[Math.floor(Math.random() * chars.length)] };
    }));
  }
  return shuffle(currentSetItems.map(function(it) {
    return { radical: it.radical, prompt: it.char, answer: it.radical };
  }));
}

function _rkUnique(arr) {
  var seen = {}, out = [];
  arr.forEach(function(x) { if (!seen[x]) { seen[x] = true; out.push(x); } });
  return out;
}

function _rkBuildQuizOptions(q) {
  if (quizDirection === 'c2w') {
    var otherChars = _rkUnique(currentSetItems.filter(function(it) { return it.radical !== q.radical; })
      .map(function(it) { return it.char; }));
    var distractors = shuffle(otherChars).slice(0, 3);
    return shuffle([q.answer].concat(distractors));
  }
  // w2c：誘答選項是其他部件，數量依練習集實際部件種類動態調整（最多3個、最少0個）
  var otherRadicals = getDistinctRadicals().filter(function(r) { return r !== q.radical; });
  var distractors2   = shuffle(otherRadicals).slice(0, 3);
  return shuffle([q.answer].concat(distractors2));
}

function _rkQuizNext() {
  if (quizIdx >= quizQueue.length) {
    showToast('🎉 這一輪練習完成，繼續下一輪！');
    quizQueue = _rkBuildQuizQueue(quizDirection);
    quizIdx = 0;
  }
  quizCurrentQ = quizQueue[quizIdx++];
  quizIsFirstAttempt = true;
  _rkRenderQuizQuestion();
}

function _rkRenderQuizQuestion() {
  var q = quizCurrentQ;
  var numEl    = document.getElementById('quiz-q-num');
  var promptEl = document.getElementById('quiz-prompt');
  var gridEl   = document.getElementById('quiz-option-grid');
  var progEl   = document.getElementById('quiz-progress-fill');

  if (numEl) numEl.textContent = '已答 ' + quizAnswered + ' 題';
  if (progEl) progEl.style.width = Math.round((quizIdx / quizQueue.length) * 100) + '%';
  if (promptEl) promptEl.textContent = q.prompt;

  var options = _rkBuildQuizOptions(q);
  if (gridEl) {
    gridEl.innerHTML = options.map(function(opt) {
      return '<button class="option-btn" data-value="' + opt + '" onclick="_rkOnQuizOption(this)">' + opt + '</button>';
    }).join('');
  }
}

function _rkOnQuizOption(btn) {
  var q       = quizCurrentQ;
  var chosen  = btn.dataset.value;
  var allBtns = document.querySelectorAll('#quiz-option-grid .option-btn');
  allBtns.forEach(function(b) { b.disabled = true; });

  if (!quizStats[q.radical]) quizStats[q.radical] = { correct: 0, total: 0 };

  if (chosen === q.answer) {
    btn.classList.add('correct');
    quizAnswered++;
    if (quizIsFirstAttempt) {
      quizStats[q.radical].correct++;
      quizStats[q.radical].total++;
      updateRadicalMastery(q.radical, quizStats[q.radical].correct, quizStats[q.radical].total);
    }
    setTimeout(_rkQuizNext, 650);
  } else {
    btn.classList.add('wrong');
    if (quizIsFirstAttempt) {
      quizStats[q.radical].total++;
      updateRadicalMastery(q.radical, quizStats[q.radical].correct, quizStats[q.radical].total);
    }
    quizIsFirstAttempt = false;
    setTimeout(function() {
      allBtns.forEach(function(b) { if (!b.classList.contains('wrong')) b.disabled = false; });
    }, 450);
  }
}
