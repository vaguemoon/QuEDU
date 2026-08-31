'use strict';

var _PHONICS_FALLBACK = [
  'sh','ch','th','bl','br','st','sk','tr','dr','fl',
  'fr','cl','cr','sn','sw','sp','pl','pr','gr','gl'
];

/* ── 測驗狀態 ── */
var quizQueue        = [];
var quizCurrent      = 0;
var quizScore        = 0;
var quizTotal        = 0;
var quizWrong        = [];
var quizRoundCorrect = [];
var quizSeen         = {};
var quizRound        = 1;
var quizAnswered     = false;
var currentQuizMode  = '';   // 'phonics' | 'words' | 'expr-listen' | 'expr-read'

var _quizGroupPool = [];  // phonics 干擾音組池
var _quizItemPool  = [];  // words / expressions 干擾項目池

/* ════════════════════════════
   進入點
   ════════════════════════════ */
function startQuiz(mode) {
  if (!englishImages.length) { showToast('此單元尚無圖片，請等老師上傳'); return; }

  currentQuizMode = mode || currentQuizMode;
  if (!currentQuizMode) {
    currentQuizMode = currentSection === 'phonics' ? 'phonics'
                    : currentSection === 'words'   ? 'words'
                    : 'expr-listen';
  }

  quizQueue        = shuffle(englishImages.slice());
  quizCurrent      = 0;
  quizScore        = 0;
  quizTotal        = quizQueue.length;
  quizWrong        = [];
  quizRoundCorrect = [];
  quizSeen         = {};
  quizRound        = 1;
  quizAnswered     = false;

  if (currentQuizMode === 'phonics') {
    var sectionGroups = (_allGroups[currentGrade] && _allGroups[currentGrade][currentSection]) || [];
    _quizGroupPool = sectionGroups.slice();
    _PHONICS_FALLBACK.forEach(function(g) {
      if (_quizGroupPool.indexOf(g) === -1) _quizGroupPool.push(g);
    });
  } else {
    _buildItemPool();
  }

  /* 更新 topbar 標題 */
  var titles = { phonics: '看圖猜音', words: '看圖選字', 'expr-listen': '聽音選圖', 'expr-read': '看圖選句' };
  if (window._PAGE_TITLES) _PAGE_TITLES['quiz'] = titles[currentQuizMode] || '英文測驗';

  _renderQuiz();
  showPage('quiz');
}

/* ════════════════════════════
   干擾選項池
   ════════════════════════════ */
function _buildItemPool() {
  /* Rule C: 同 Unit 先，不足再跨 Unit 補 */
  var pool = englishImages.slice();
  var sectionData = ((_allData[currentGrade] || {})[currentSection]) || {};
  Object.keys(sectionData).forEach(function(u) {
    if (u !== currentUnit) {
      (sectionData[u] || []).forEach(function(item) { pool.push(item); });
    }
  });
  _quizItemPool = pool;
}

function _buildGroupOptions(correctGroup) {
  var pool = _quizGroupPool.filter(function(g) { return g !== correctGroup; });
  return shuffle([correctGroup].concat(shuffle(pool).slice(0, 3)));
}

function _buildItemOptions(correctItem) {
  var others = _quizItemPool.filter(function(it) { return it.word !== correctItem.word; });
  return shuffle([correctItem].concat(shuffle(others).slice(0, 3)));
}

/* ════════════════════════════
   渲染分派
   ════════════════════════════ */
function _renderQuiz() {
  if (quizCurrent >= quizQueue.length) {
    if (quizWrong.length === 0) renderResultPage(quizScore, quizTotal, quizRound);
    else _renderRoundResult();
    showPage('result');
    return;
  }
  quizAnswered = false;
  var item = quizQueue[quizCurrent];
  if      (currentQuizMode === 'phonics')     _renderQuizPhonics(item);
  else if (currentQuizMode === 'words')       _renderQuizWords(item);
  else if (currentQuizMode === 'expr-listen') _renderQuizExprListen(item);
  else if (currentQuizMode === 'expr-read')   _renderQuizExprRead(item);
}

function _wrapHtml(pct, n, contentHtml, extraClass) {
  var badge = quizRound > 1
    ? '<div class="en-quiz-round-badge">🔄 第 ' + quizRound + ' 輪・錯題重練</div>' : '';
  return badge +
    '<div class="en-quiz-wrap' + (extraClass ? ' ' + extraClass : '') + '">' +
      '<div class="en-quiz-progress-bar"><div class="en-quiz-progress-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="en-browse-counter">' + (quizCurrent + 1) + ' / ' + n + '</div>' +
      contentHtml +
    '</div>';
}

/* ── 發音 (phonics)：看圖猜音組 ── */
function _renderQuizPhonics(item) {
  var n    = quizQueue.length;
  var pct  = Math.round(quizCurrent / n * 100);
  var opts = _buildGroupOptions(item.phoneticGroup || '');

  var optsHtml = opts.map(function(g, i) {
    return '<button class="en-quiz-opt" id="qopt-' + i + '" onclick="answerQuiz(' + i + ')">' + _escHtml(g) + '</button>';
  }).join('');

  var inner = document.querySelector('#page-quiz .en-page-inner');
  inner.innerHTML = _wrapHtml(pct, n,
    '<div class="en-quiz-img-wrap"><img src="' + _escAttr(item.imageUrl) + '" alt=""></div>' +
    '<button class="en-quiz-speak-btn" data-word="' + _escAttr(item.word) + '" onclick="enSpeak(null,this.dataset.word)" title="發音">🔊</button>' +
    '<div class="en-quiz-question">這個字的開頭音是？</div>' +
    '<div class="en-quiz-opts" id="quiz-opts">' + optsHtml + '</div>'
  );
  inner.dataset.correctKey = item.phoneticGroup || '';
  inner.dataset.optKeys    = JSON.stringify(opts);
  setTimeout(function() { enSpeak(null, item.word); }, 400);
}

/* ── 生字 (words)：看圖選字 ── */
function _renderQuizWords(item) {
  var n    = quizQueue.length;
  var pct  = Math.round(quizCurrent / n * 100);
  var opts = _buildItemOptions(item);

  var optsHtml = opts.map(function(opt, i) {
    return '<button class="en-quiz-opt en-quiz-word-opt" id="qopt-' + i + '" onclick="answerQuiz(' + i + ')">' +
      _escHtml(opt.word) + '</button>';
  }).join('');

  var inner = document.querySelector('#page-quiz .en-page-inner');
  inner.innerHTML = _wrapHtml(pct, n,
    '<div class="en-quiz-img-wrap"><img src="' + _escAttr(item.imageUrl) + '" alt=""></div>' +
    '<div class="en-quiz-question">這張圖片的英文單字是？</div>' +
    '<div class="en-quiz-opts" id="quiz-opts">' + optsHtml + '</div>'
  );
  inner.dataset.correctKey = item.word;
  inner.dataset.optKeys    = JSON.stringify(opts.map(function(o) { return o.word; }));
}

/* ── 常用語 (expr-listen)：聽音選圖 ── */
function _renderQuizExprListen(item) {
  var n    = quizQueue.length;
  var pct  = Math.round(quizCurrent / n * 100);
  var opts = _buildItemOptions(item);

  var optsHtml = opts.map(function(opt, i) {
    return '<button class="en-quiz-img-opt" id="qopt-' + i + '" onclick="answerQuiz(' + i + ')">' +
      '<img src="' + _escAttr(opt.imageUrl) + '" alt="">' +
    '</button>';
  }).join('');

  var inner = document.querySelector('#page-quiz .en-page-inner');
  inner.innerHTML = _wrapHtml(pct, n,
    '<div class="en-quiz-listen-prompt">' +
      '<button class="en-quiz-speak-big" data-word="' + _escAttr(item.word) + '" onclick="enSpeak(null,this.dataset.word)">🔊</button>' +
      '<div class="en-quiz-question">聽到的英語是哪一張圖？</div>' +
    '</div>' +
    '<div class="en-quiz-img-opts" id="quiz-opts">' + optsHtml + '</div>',
    'en-quiz-wrap-listen'
  );
  inner.dataset.correctKey = item.word;
  inner.dataset.optKeys    = JSON.stringify(opts.map(function(o) { return o.word; }));
  setTimeout(function() { enSpeak(null, item.word); }, 400);
}

/* ── 常用語 (expr-read)：看圖選句 ── */
function _renderQuizExprRead(item) {
  var n    = quizQueue.length;
  var pct  = Math.round(quizCurrent / n * 100);
  var opts = _buildItemOptions(item);

  var optsHtml = opts.map(function(opt, i) {
    return '<button class="en-quiz-text-opt" id="qopt-' + i + '" onclick="answerQuiz(' + i + ')">' +
      _escHtml(opt.word) + '</button>';
  }).join('');

  var inner = document.querySelector('#page-quiz .en-page-inner');
  inner.innerHTML = _wrapHtml(pct, n,
    '<div class="en-quiz-img-wrap"><img src="' + _escAttr(item.imageUrl) + '" alt=""></div>' +
    '<div class="en-quiz-question">這張圖片對應的英語句子是？</div>' +
    '<div class="en-quiz-text-opts" id="quiz-opts">' + optsHtml + '</div>'
  );
  inner.dataset.correctKey = item.word;
  inner.dataset.optKeys    = JSON.stringify(opts.map(function(o) { return o.word; }));
}

/* ════════════════════════════
   答題
   ════════════════════════════ */
function answerQuiz(optIdx) {
  if (quizAnswered) return;
  quizAnswered = true;

  var inner   = document.querySelector('#page-quiz .en-page-inner');
  var correct = inner.dataset.correctKey;
  var optKeys = JSON.parse(inner.dataset.optKeys);
  var chosen  = optKeys[optIdx];
  var isRight = chosen === correct;

  document.querySelectorAll('#quiz-opts > button').forEach(function(btn, i) {
    btn.disabled = true;
    if (optKeys[i] === correct)        btn.classList.add('correct');
    else if (i === optIdx && !isRight) btn.classList.add('wrong');
  });

  if (isRight) {
    sfxCorrect();
    if (!quizSeen[quizCurrent]) quizScore++;
    quizRoundCorrect.push(quizQueue[quizCurrent]);
  } else {
    sfxWrong();
    quizSeen[quizCurrent] = true;
    quizWrong.push(quizQueue[quizCurrent]);
  }
  recordResult(quizQueue[quizCurrent].word, isRight);

  setTimeout(function() {
    enSpeak(null, quizQueue[quizCurrent].word);
    setTimeout(function() { quizCurrent++; _renderQuiz(); }, 1100);
  }, isRight ? 300 : 200);
}

/* ════════════════════════════
   重練 / 下一輪
   ════════════════════════════ */
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
  var inner   = document.querySelector('#page-result .en-page-inner');
  if (!inner) return;
  var n       = quizQueue.length;
  var correct = quizRoundCorrect.length;
  var wrong   = quizWrong.length;

  var thumb = function(item, isWrong) {
    return '<div class="en-settle-thumb' + (isWrong ? ' en-settle-thumb-wrong' : ' en-settle-thumb-correct') + '">' +
      '<img src="' + _escAttr(item.imageUrl) + '" alt="">' +
      '<div class="en-settle-thumb-label">' + _escHtml(item.word) + '</div>' +
    '</div>';
  };

  inner.innerHTML =
    '<div class="en-settle-wrap">' +
      '<div class="en-settle-round">第 ' + quizRound + ' 輪結算</div>' +
      '<div class="en-settle-score">' + correct + ' / ' + n + ' 答對</div>' +
      (correct > 0
        ? '<div class="en-settle-section"><div class="en-settle-section-title en-settle-correct-title">✅ 答對 ' + correct + ' 個</div>' +
          '<div class="en-settle-thumbs">' + quizRoundCorrect.map(function(it){ return thumb(it, false); }).join('') + '</div></div>'
        : '') +
      (wrong > 0
        ? '<div class="en-settle-section"><div class="en-settle-section-title en-settle-wrong-title">❌ 答錯 ' + wrong + ' 個，下輪再練</div>' +
          '<div class="en-settle-thumbs">' + quizWrong.map(function(it){ return thumb(it, true); }).join('') + '</div></div>'
        : '') +
      '<button class="en-btn-primary en-settle-continue" onclick="_nextRound()">繼續練習 →</button>' +
    '</div>';
}
