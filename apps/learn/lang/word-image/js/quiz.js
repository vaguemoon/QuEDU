'use strict';

var quizQueue    = [];   // 本輪題目
var quizCurrent  = 0;
var quizScore    = 0;    // 首輪答對數
var quizTotal    = 0;    // 本次唯一詞語數
var quizWrong    = [];   // 本輪答錯（下輪重練）
var quizSeen     = {};   // 已答錯過的詞語（不重複計分）
var quizRound    = 1;
var quizAnswered = false;

function startQuiz() {
  if (wordImages.length < 2) { showToast('需要至少 2 個詞語才能進行測驗'); return; }
  currentMode  = 'quiz';
  quizQueue    = shuffle(wordImages.slice());
  quizCurrent  = 0;
  quizScore    = 0;
  quizTotal    = quizQueue.length;
  quizWrong    = [];
  quizSeen     = {};
  quizRound    = 1;
  quizAnswered = false;
  _renderQuiz();
  showPage('quiz');
}

function _renderQuiz() {
  if (quizCurrent >= quizQueue.length) {
    if (quizWrong.length > 0) {
      quizRound++;
      quizQueue   = shuffle(quizWrong.slice());
      quizWrong   = [];
      quizCurrent = 0;
      _renderQuiz();
    } else {
      renderResultPage(quizScore, quizTotal, quizRound);
      showPage('result');
    }
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

  if (isRight) sfxCorrect(); else sfxWrong();

  if (isRight) {
    if (!quizSeen[correct]) quizScore++;
  } else {
    quizSeen[correct] = true;
    quizWrong.push(quizQueue[quizCurrent]);
  }
  recordResult(correct, isRight);

  setTimeout(function() {
    quizCurrent++;
    _renderQuiz();
  }, isRight ? 700 : 1400);
}
