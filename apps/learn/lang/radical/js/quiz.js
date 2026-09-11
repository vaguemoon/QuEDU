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

/* 常見部件備援清單：練習集本身部件種類不足時，用來補足四選一的誘答選項（不算進練習集內容本身） */
var RK_FALLBACK_RADICALS = [
  { radical: '水', char: '河' }, { radical: '木', char: '林' }, { radical: '火', char: '炎' },
  { radical: '心', char: '想' }, { radical: '手', char: '打' }, { radical: '口', char: '吃' },
  { radical: '日', char: '明' }, { radical: '月', char: '期' }, { radical: '人', char: '他' },
  { radical: '女', char: '媽' }, { radical: '子', char: '孩' }, { radical: '土', char: '地' },
  { radical: '山', char: '峰' }, { radical: '石', char: '碗' }, { radical: '田', char: '男' },
  { radical: '目', char: '看' }, { radical: '耳', char: '聽' }, { radical: '足', char: '跳' },
  { radical: '衣', char: '裡' }, { radical: '言', char: '說' }, { radical: '金', char: '銀' },
  { radical: '竹', char: '筆' }, { radical: '米', char: '粉' }, { radical: '禾', char: '種' },
  { radical: '雨', char: '雪' }, { radical: '鳥', char: '鴨' }, { radical: '魚', char: '鯉' },
  { radical: '車', char: '輪' }, { radical: '門', char: '間' }
];

function startQuiz(direction) {
  var radicals = getDistinctRadicals();
  if (!radicals.length) { showToast('這個練習集還沒有部件內容，無法出題'); return; }
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
    if (distractors.length < 3) {
      var usedC = {}; distractors.forEach(function(c) { usedC[c] = true; }); usedC[q.answer] = true;
      distractors = distractors.concat(_rkFallbackOptions(q.radical, usedC, true)).slice(0, 3);
    }
    return shuffle([q.answer].concat(distractors));
  }
  // w2c：誘答選項是其他部件，練習集本身種類不足時，用常見部件備援清單補足
  var otherRadicals = getDistinctRadicals().filter(function(r) { return r !== q.radical; });
  var distractors2   = shuffle(otherRadicals).slice(0, 3);
  if (distractors2.length < 3) {
    var usedR = {}; distractors2.forEach(function(r) { usedR[r] = true; }); usedR[q.radical] = true;
    distractors2 = distractors2.concat(_rkFallbackOptions(q.radical, usedR, false)).slice(0, 3);
  }
  return shuffle([q.answer].concat(distractors2));
}

/* 從常見部件備援清單抽誘答選項；isChar=true 回傳字，否則回傳部件本身 */
function _rkFallbackOptions(excludeRadical, exclude, isChar) {
  var pool = RK_FALLBACK_RADICALS.filter(function(fb) {
    var val = isChar ? fb.char : fb.radical;
    return fb.radical !== excludeRadical && !exclude[val];
  });
  return shuffle(pool).map(function(fb) { return isChar ? fb.char : fb.radical; });
}

function _rkQuizNext() {
  if (quizIdx >= quizQueue.length) {
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
  if (promptEl) {
    if (quizDirection === 'c2w') {
      var variant = getRadicalVariant(q.prompt);
      promptEl.innerHTML = escHtml(q.prompt) +
        (variant ? '<span class="rk-prompt-variant">（' + escHtml(variant) + '）</span>' : '');
    } else {
      promptEl.textContent = q.prompt;
    }
  }

  var options = _rkBuildQuizOptions(q);
  if (gridEl) {
    gridEl.innerHTML = options.map(function(opt) {
      var inner = escHtml(opt);
      if (quizDirection === 'w2c') {
        var variant = getRadicalVariant(opt);
        if (variant) inner += '<span class="rk-prompt-variant">（' + escHtml(variant) + '）</span>';
      }
      return '<button class="option-btn" data-value="' + opt + '" onclick="_rkOnQuizOption(this)">' + inner + '</button>';
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
    sfxCorrect();
    quizAnswered++;
    if (quizIsFirstAttempt) {
      quizStats[q.radical].correct++;
      quizStats[q.radical].total++;
      updateRadicalMastery(q.radical, quizStats[q.radical].correct, quizStats[q.radical].total);
    }
    setTimeout(_rkQuizNext, 650);
  } else {
    btn.classList.add('wrong');
    sfxWrong();
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
