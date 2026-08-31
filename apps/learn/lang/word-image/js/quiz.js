'use strict';

var quizQueue        = [];
var quizCurrent      = 0;
var quizScore        = 0;
var quizTotal        = 0;
var quizWrong        = [];
var quizRoundCorrect = [];
var quizSeen         = {};
var quizRound        = 1;
var quizAnswered     = false;

function startQuiz() {
  if (wordImages.length < 2) { showToast('需要至少 2 個詞語才能進行測驗'); return; }
  currentMode      = 'quiz';
  quizQueue        = shuffle(wordImages.slice());
  quizCurrent      = 0;
  quizScore        = 0;
  quizTotal        = quizQueue.length;
  quizWrong        = [];
  quizRoundCorrect = [];
  quizSeen         = {};
  quizRound        = 1;
  quizAnswered     = false;
  _renderQuiz();
  showPage('quiz');
}

function _speakWord(word, cb) {
  if (!window.speechSynthesis) { setTimeout(cb, 900); return; }
  window.speechSynthesis.cancel();
  var utt = new SpeechSynthesisUtterance(word);
  utt.lang = 'zh-TW';
  var done = false;
  function finish() { if (!done) { done = true; cb(); } }
  utt.onend  = finish;
  utt.onerror = finish;
  setTimeout(finish, 3000);
  window.speechSynthesis.speak(utt);
}

function _renderQuiz() {
  if (quizCurrent >= quizQueue.length) {
    if (quizWrong.length === 0) {
      renderResultPage(quizScore, quizTotal, quizRound);
    } else {
      _renderRoundResult();
    }
    showPage('result');
    return;
  }

  var item    = quizQueue[quizCurrent];
  var n       = quizQueue.length;
  var pct     = Math.round(quizCurrent / n * 100);
  var numOpts = Math.min(4, wordImages.length);
  var distractors = shuffle(
    wordImages.filter(function(w) { return w.word !== item.word; })
  ).slice(0, numOpts - 1);
  var opts = shuffle([item].concat(distractors));

  quizAnswered = false;

  var roundLabel = quizRound > 1
    ? '<div class="wi-quiz-round-badge">🔄 第 ' + quizRound + ' 輪・錯題重練</div>'
    : '';

  var optsHtml = opts.map(function(opt, i) {
    return '<button class="wi-quiz-opt" id="qopt-' + i + '" onclick="answerQuiz(' + i + ')">' +
      _escHtml(opt.word) + '</button>';
  }).join('');

  var inner = document.querySelector('#page-quiz .wi-page-inner');
  if (!inner) return;
  inner.innerHTML =
    roundLabel +
    '<div class="wi-quiz-wrap">' +
      '<div class="wi-quiz-progress-bar">' +
        '<div class="wi-quiz-progress-fill" style="width:' + pct + '%"></div>' +
      '</div>' +
      '<div class="wi-browse-counter">' + (quizCurrent + 1) + ' / ' + n + '</div>' +
      '<div class="wi-quiz-img-wrap"><img src="' + _escAttr(item.imageUrl) + '" alt=""></div>' +
      '<div class="wi-quiz-question">這個詞語是？</div>' +
      '<div class="wi-quiz-opts" id="quiz-opts">' + optsHtml + '</div>' +
    '</div>';

  inner.dataset.correctWord = item.word;
  inner.dataset.optWords    = JSON.stringify(opts.map(function(o) { return o.word; }));
}

function answerQuiz(optIdx) {
  if (quizAnswered) return;
  quizAnswered = true;

  var inner    = document.querySelector('#page-quiz .wi-page-inner');
  var correct  = inner.dataset.correctWord;
  var optWords = JSON.parse(inner.dataset.optWords);
  var chosen   = optWords[optIdx];
  var isRight  = chosen === correct;

  document.querySelectorAll('.wi-quiz-opt').forEach(function(btn, i) {
    btn.disabled = true;
    if (optWords[i] === correct) btn.classList.add('correct');
    else if (i === optIdx && !isRight) btn.classList.add('wrong');
  });

  if (isRight) {
    sfxCorrect();
    if (!quizSeen[correct]) quizScore++;
    quizRoundCorrect.push(quizQueue[quizCurrent]);
  } else {
    sfxWrong();
    quizSeen[correct] = true;
    quizWrong.push(quizQueue[quizCurrent]);
  }
  recordResult(correct, isRight);

  setTimeout(function() {
    _speakWord(correct, function() {
      quizCurrent++;
      _renderQuiz();
    });
  }, isRight ? 300 : 200);
}

function _nextRound() {
  quizRound++;
  quizQueue        = shuffle(quizWrong.slice());
  quizWrong        = [];
  quizRoundCorrect = [];
  quizCurrent      = 0;
  quizAnswered     = false;
  _renderQuiz();
  showPage('quiz');
}

function _renderRoundResult() {
  var inner = document.querySelector('#page-result .wi-page-inner');
  if (!inner) return;

  var n       = quizQueue.length;
  var correct = quizRoundCorrect.length;
  var wrong   = quizWrong.length;

  var thumbHtml = function(item, isWrong) {
    var imgPart = item.imageUrl
      ? '<img src="' + _escAttr(item.imageUrl) + '" alt="">'
      : '<div class="wi-settle-thumb-noimg">🖼️</div>';
    return '<div class="wi-settle-thumb' + (isWrong ? ' wi-settle-thumb-wrong' : ' wi-settle-thumb-correct') +
      '" data-speak="' + _escAttr(item.word) + '" onclick="wiSpeak(event,this)">' +
      imgPart +
      '<div class="wi-settle-thumb-label">' + _escHtml(item.word) + '</div>' +
    '</div>';
  };

  var correctSection = correct > 0
    ? '<div class="wi-settle-section">' +
        '<div class="wi-settle-section-title wi-settle-correct-title">✅ 答對 ' + correct + ' 個</div>' +
        '<div class="wi-settle-thumbs">' +
          quizRoundCorrect.map(function(it) { return thumbHtml(it, false); }).join('') +
        '</div>' +
      '</div>'
    : '';

  var wrongSection = wrong > 0
    ? '<div class="wi-settle-section">' +
        '<div class="wi-settle-section-title wi-settle-wrong-title">❌ 答錯 ' + wrong + ' 個，下輪再練</div>' +
        '<div class="wi-settle-thumbs">' +
          quizWrong.map(function(it) { return thumbHtml(it, true); }).join('') +
        '</div>' +
      '</div>'
    : '';

  inner.innerHTML =
    '<div class="wi-settle-wrap">' +
      '<div class="wi-settle-round">第 ' + quizRound + ' 輪結算</div>' +
      '<div class="wi-settle-score">' + correct + ' / ' + n + ' 答對</div>' +
      correctSection +
      wrongSection +
      '<button class="wi-btn-primary wi-settle-continue" onclick="_nextRound()">繼續練習 →</button>' +
    '</div>';
}
