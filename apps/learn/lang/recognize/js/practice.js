/**
 * practice.js — 練習模式
 * 第一輪按課本順序出題，之後隨機出題。
 * 答錯可重選；精熟度星數依首次答對率即時更新，無結算頁。
 * 星數門檻：0星<60%、1星≥60%、2星≥70%、3星≥80%（且已見全部字詞）
 */
'use strict';

var pracSeenWords      = null;
var pracFirstCorrect   = 0;
var pracTotalAnswered  = 0;
var pracIsFirstAttempt = true;
var pracCurrentQ       = null;
var pracVocabCount     = 0;

var pracFirstRoundQueue = [];
var pracFirstRoundIdx   = 0;
var pracPrevStars       = 0;
var pracActiveChars     = [];
var pracActiveWords     = [];

function startPractice(selectedItems) {
  var lesson = currentLessonData;
  if (!lesson) { showToast('請先選擇課程'); return; }
  var allChars = lesson.chars || [];
  var allWords = lesson.words || [];
  if (selectedItems && selectedItems.length) {
    pracActiveChars = allChars.filter(function(c) { return selectedItems.indexOf(c) !== -1; });
    pracActiveWords = allWords.filter(function(w) { return selectedItems.indexOf(w) !== -1; });
  } else {
    pracActiveChars = allChars;
    pracActiveWords = allWords;
  }
  pracVocabCount = pracActiveChars.length + pracActiveWords.length;
  if (!pracVocabCount) { showToast('這一課沒有題目'); return; }

  pracSeenWords       = new Set();
  pracFirstCorrect    = 0;
  pracTotalAnswered   = 0;
  pracPrevStars       = 0;
  pracFirstRoundQueue = buildOrderedQuestions();
  pracFirstRoundIdx   = 0;

  showPage('practice');
  updatePracProgress();
  updateMastery();
  pracNextQuestion();
}

function buildOrderedQuestions() {
  var charQs = pracActiveChars.map(function(c) {
    return { type: 'char', answer: c, options: buildPracOptions(c, 'char') };
  });
  var wordQs = pracActiveWords.map(function(w) {
    return { type: 'word', answer: w, options: buildPracOptions(w, 'word') };
  });
  var result = [], ci = 0, wi = 0;
  while (ci < charQs.length || wi < wordQs.length) {
    if (ci < charQs.length) result.push(charQs[ci++]);
    if (wi < wordQs.length) result.push(wordQs[wi++]);
  }
  return result;
}

function buildRandomQuestion() {
  var pool = pracActiveChars.map(function(c) { return { type: 'char', answer: c }; })
             .concat(pracActiveWords.map(function(w) { return { type: 'word', answer: w }; }));
  if (!pool.length) return null;
  var item = pool[Math.floor(Math.random() * pool.length)];
  return {
    type:    item.type,
    answer:  item.answer,
    options: buildPracOptions(item.answer, item.type)
  };
}

function buildPracOptions(answer, type) {
  var lesson      = currentLessonData;
  var allItems    = type === 'char' ? (lesson.chars || []) : (lesson.words || []);
  var activeItems = type === 'char' ? pracActiveChars : pracActiveWords;
  var gradeItems  = type === 'char' ? gradePool.chars : gradePool.words;
  var extraPool   = allItems.filter(function(x) {
    return activeItems.indexOf(x) === -1;
  }).concat(gradeItems);
  return buildOptions(answer, activeItems, extraPool);
}

function pracNextQuestion() {
  if (pracFirstRoundIdx < pracFirstRoundQueue.length) {
    pracCurrentQ = pracFirstRoundQueue[pracFirstRoundIdx++];
  } else {
    pracCurrentQ = buildRandomQuestion();
  }
  pracIsFirstAttempt = true;
  if (!pracCurrentQ) return;
  pracSeenWords.add(pracCurrentQ.answer);
  renderPracticeQuestion();
}

function renderPracticeQuestion() {
  var q      = pracCurrentQ;
  var numEl  = document.getElementById('prac-q-num');
  var typeEl = document.getElementById('prac-q-type');
  var gridEl = document.getElementById('prac-option-grid');
  if (numEl)  numEl.textContent  = '已答 ' + pracTotalAnswered + ' 題';
  if (typeEl) typeEl.textContent = q.type === 'char' ? '聽音選字' : '聽音選詞';
  if (gridEl) {
    gridEl.innerHTML = q.options.map(function(opt) {
      return '<button class="option-btn" data-value="' + opt +
             '" onclick="onPracticeOption(this)">' + opt + '</button>';
    }).join('');
  }
  speakText(q.answer);
}

function onPracticeOption(btn) {
  var q       = pracCurrentQ;
  var chosen  = btn.dataset.value;
  var allBtns = document.querySelectorAll('#prac-option-grid .option-btn');
  allBtns.forEach(function(b) { b.disabled = true; });

  if (chosen === q.answer) {
    btn.classList.add('correct');
    sfxCorrect();
    pracTotalAnswered++;
    if (pracIsFirstAttempt) pracFirstCorrect++;
    updatePracProgress();
    updateMastery();
    setTimeout(function() { pracNextQuestion(); }, 700);
  } else {
    btn.classList.add('wrong');
    sfxWrong();
    pracIsFirstAttempt = false;
    setTimeout(function() {
      allBtns.forEach(function(b) {
        if (!b.classList.contains('wrong')) b.disabled = false;
      });
    }, 500);
  }
}

function updatePracProgress() {
  var progEl = document.getElementById('prac-progress-fill');
  if (!progEl || !pracVocabCount) return;
  var pct = Math.min(100, Math.round(pracSeenWords.size / pracVocabCount * 100));
  progEl.style.width = pct + '%';
}

function updateMastery() {
  var infoEl = document.getElementById('prac-bar-info');
  if (!infoEl) return;

  // 第一輪未完成前：無星，顯示提示
  if (pracSeenWords.size < pracVocabCount) {
    for (var j = 1; j <= 3; j++) {
      var s = document.getElementById('prac-star-' + j);
      if (s) s.className = 'prac-star';
    }
    infoEl.textContent = '再多練習幾題吧！';
    return;
  }

  var rate  = pracTotalAnswered ? pracFirstCorrect / pracTotalAnswered : 0;
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

  if (stars === 3 && pracPrevStars < 3) sfxCelebrate();
  pracPrevStars = stars;

  var nextNeeded = stars === 0 ? 60 : stars === 1 ? 70 : stars === 2 ? 80 : null;
  infoEl.textContent = nextNeeded
    ? '目前：' + pct + '%｜' + (stars + 1) + '星需 ≥' + nextNeeded + '%'
    : '目前：' + pct + '%｜已達最高星！';
}

function replayPracticeAudio() {
  if (pracCurrentQ) speakText(pracCurrentQ.answer);
}
