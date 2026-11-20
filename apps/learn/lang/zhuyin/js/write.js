/**
 * write.js — 仿寫練習＋仿寫測驗（單音／結合韻共用）
 * 練習比照練字趣：同一格依步驟切換「看筆順 → 跟著寫（有淺色字）→ 自己默寫（沒有淺色字）」，
 * 右邊放圖片與口訣；結合韻兩個符號由上往下各一格，寫完第一格接著寫第二格。
 * 筆畫資料來自 strokes.js（HanziWriter charDataLoader）。
 */
'use strict';

var zwList      = [];    // 目前這區可仿寫的項目（單音＝符號，結合韻＝兩個符號的字串）
var zwIdx       = 0;
var zwStepName  = 'ref'; // 'ref' 看筆順｜'trace' 跟著寫｜'dict' 自己默寫
var zwTraced    = false; // 這個符號跟著寫完過一次，才開放默寫（比照練字趣寫完才出現「開始默寫」）
var zwWriters   = [];    // 目前格子裡的 HanziWriter（每個符號一個）
var zwMistakes  = 0;     // 默寫寫錯幾筆
var zwRunToken  = 0;     // 換題／換步驟後讓舊的動畫／測驗回呼失效

function _zwWriterOpts(sz, extra) {
  return Object.assign({
    width: sz, height: sz, padding: Math.round(sz * 0.05),
    charDataLoader: zyCharDataLoader,
    strokeColor: '#2d6fa8', outlineColor: '#c8dff5', highlightColor: '#ffd54f',
    drawingColor: '#2d6fa8', drawingWidth: Math.max(6, Math.round(sz * 0.03)),
    showCharacter: false, showOutline: true, leniency: 1.3, showHintAfterMisses: 3
  }, extra || {});
}

/* ── 進入練習：全部練習（依固定順序）／自選練習（只練勾選的）／點選單上某個符號直接從它開始 ── */
function startZwPractice(selectedItems, startAt) {
  zwList = (selectedItems && selectedItems.length)
    ? zyActiveSymbols().filter(function(s) { return selectedItems.indexOf(s) !== -1; })
    : zyActiveSymbols().slice();
  if (!zwList.length) { showToast('請先選擇要練習的符號'); return; }
  zwIdx = Math.max(0, zwList.indexOf(startAt));
  showPage('zy-write');
  renderZyWrite();
}

function zwStep(d) {
  var n = zwIdx + d;
  if (n < 0 || n >= zwList.length) return;
  zwIdx = n;
  renderZyWrite();
}

/* 換一個符號：回到第一步看筆順 */
function renderZyWrite() {
  var item = zwList[zwIdx];
  document.getElementById('zw-symbol').textContent = item;
  document.getElementById('zw-prev').disabled = zwIdx === 0;
  document.getElementById('zw-next').disabled = zwIdx === zwList.length - 1;
  zwTraced = false;
  _zwRenderSide(item);
  zySpeakSymbol(item);
  zwSetStep('ref');
}

/* 右邊：老師建的圖片＋口訣（點了唸口訣），沒有圖片就放大符號 */
function _zwRenderSide(item) {
  var d = zyActiveData()[item] || {};
  document.getElementById('zw-side').innerHTML =
    (d.imageUrl
      ? '<img class="zw-side-img" src="' + escHtml(d.imageUrl) + '" alt="" onclick="zySpeakPhrase(zwList[zwIdx])">'
      : '<div class="zw-side-sym" onclick="zySpeakSymbol(zwList[zwIdx])">' + escHtml(item) + '</div>') +
    (d.phrase ? '<div class="zw-side-phrase" onclick="zySpeakPhrase(zwList[zwIdx])">' + escHtml(d.phrase) + '</div>' : '') +
    '<div class="zw-side-hint">🔊 點一下可以再聽一次</div>';
}

/* 依視窗高度決定格子大小：結合韻上下兩格，要一起塞進一個畫面不用捲動 */
function _zwBoxSize(count) {
  var avail = window.innerHeight - 340;
  var sz = count > 1 ? (avail - 12) / count : avail;
  return Math.round(Math.max(150, Math.min(sz, 400)));
}

function zwSetStep(step) {
  if (step === 'dict' && !zwTraced) return;
  var token = ++zwRunToken;
  zwStepName = step;
  zwMistakes = 0;
  ['ref', 'trace', 'dict'].forEach(function(s) {
    document.getElementById('zw-tab-' + s).classList.toggle('active', s === step);
  });
  document.getElementById('zw-tab-dict').disabled = !zwTraced;
  _zwSetMsg(step === 'ref' ? '' : step === 'trace' ? '照著淺色字寫寫看' : '不看淺色字，自己寫出來', '');

  var syms = Array.from(zwList[zwIdx]);
  var wrap = document.getElementById('zw-boxes');
  wrap.innerHTML = '';
  var sz = _zwBoxSize(syms.length);
  zwWriters = syms.map(function(s, i) {
    wrap.insertAdjacentHTML('beforeend',
      '<div class="zw-box' + (step === 'ref' ? '' : ' zw-quiz-box') + '" id="zw-box-' + i + '" style="width:' + sz + 'px;height:' + sz + 'px"></div>');
    return HanziWriter.create('zw-box-' + i, s, _zwWriterOpts(sz, step === 'ref'
      ? { strokeColor: '#ff8c42', strokeAnimationSpeed: .8, delayBetweenStrokes: 450 }
      : { showOutline: step === 'trace' }));
  });

  if (step === 'ref') {
    _zwSetCtrl('<button class="zw-btn zw-btn-light" onclick="zwPlayRef()">▶ 再播一次</button>' +
               '<button class="zw-btn" onclick="zwSetStep(\'trace\')">✍️ 換我跟著寫 →</button>');
    setTimeout(function() { if (token === zwRunToken) zwPlayRef(); }, 300);
  } else {
    _zwSetCtrl('<button class="zw-btn zw-btn-light" onclick="zwSetStep(zwStepName)">🔄 重寫</button>');
    _zwQuiz(0, token);
  }
}

/* 範例動畫：結合韻依序播完第一個再播第二個 */
function zwPlayRef() {
  if (zwStepName !== 'ref') return;
  var token = zwRunToken;
  zwWriters.forEach(function(w) { w.hideCharacter(); });
  (function play(i) {
    if (token !== zwRunToken || i >= zwWriters.length) return;
    zwWriters[i].animateCharacter({ onComplete: function() { setTimeout(function() { play(i + 1); }, 300); } });
  })(0);
}

function _zwQuiz(i, token) {
  var step = zwStepName;
  document.querySelectorAll('#zw-boxes .zw-quiz-box').forEach(function(el, k) {
    el.classList.toggle('zw-active', k === i && zwWriters.length > 1);
  });
  zwWriters[i].quiz({
    onMistake: function() {
      flashBox('zw-box-' + i, 'red'); sfxWrong();
      if (step !== 'dict') return;
      zwMistakes++;
      zwWriters[i].showOutline(); // 默寫寫錯就露出淺色字，讓他照著寫完
      if (zwMistakes === 1) _zwSetMsg('寫錯了，先照淺色字寫完，再默寫一次', 'bad');
    },
    onCorrectStroke: function() { sfxCorrect(); },
    onComplete: function() {
      if (token !== zwRunToken) return;
      flashBox('zw-box-' + i, 'green');
      if (i + 1 < zwWriters.length) { _zwQuiz(i + 1, token); return; }
      document.querySelectorAll('#zw-boxes .zw-quiz-box').forEach(function(el) { el.classList.remove('zw-active'); });
      if (step === 'trace') _zwTraceDone(); else _zwDictDone();
    }
  });
}

function _zwTraceDone() {
  sfxPass();
  zwTraced = true;
  document.getElementById('zw-tab-dict').disabled = false;
  _zwMarkPracticed(zwList[zwIdx]);
  _zwSetMsg('🎉 寫得好！接著不看淺色字，自己默寫一次', 'ok');
  _zwSetCtrl('<button class="zw-btn zw-btn-light" onclick="zwSetStep(\'trace\')">🔄 再跟著寫一次</button>' +
             '<button class="zw-btn" onclick="zwSetStep(\'dict\')">📝 開始默寫 →</button>');
}

function _zwDictDone() {
  var last = zwIdx === zwList.length - 1;
  if (zwMistakes === 0) {
    sfxCelebrate();
    _zwSetMsg('🏆 默寫成功！' + (last ? '都練完了，可以去測驗囉' : ''), 'ok');
    _zwSetCtrl('<button class="zw-btn zw-btn-light" onclick="zwSetStep(\'dict\')">🔄 再默寫一次</button>' +
               (last ? '' : '<button class="zw-btn" onclick="zwStep(1)">下一個 ▶</button>'));
  } else {
    _zwSetMsg('寫完了，有 ' + zwMistakes + ' 筆寫錯，再默寫一次看看', 'bad');
    _zwSetCtrl('<button class="zw-btn zw-btn-light" onclick="zwSetStep(\'ref\')">👁 再看一次筆順</button>' +
               '<button class="zw-btn" onclick="zwSetStep(\'dict\')">🔄 再默寫一次</button>');
  }
}

/* 練習寫完一次：還沒學過的標成「已練習」（精熟只能靠測驗取得） */
function _zwMarkPracticed(item) {
  var map = zyActiveStatusMap('write');
  if (!map[item] || map[item] === 'new') { map[item] = 'practiced'; saveZySymbolStatus(); }
}

function _zwSetCtrl(html) {
  document.getElementById('zw-ctrl').innerHTML = html;
}

function _zwSetMsg(text, cls) {
  var el = document.getElementById('zw-msg');
  if (!el) return;
  el.textContent = text;
  el.className = 'zw-msg' + (cls ? ' zw-msg-' + cls : '');
}

/* ══ 仿寫測驗 ══
   聽讀音、不給範例和淺色字；注音筆畫少，整題一筆都不能錯才算通過。錯了這題就不算了，
   所以一錯就露出淺色字讓他照著寫完。沒通過的下一輪再考，直到全部通過；
   輪次結算／最終結果頁與聽音選字共用（exam.js 的 ze* 狀態）。 */
var zweWriters  = [];
var zweMistakes = 0;
var zweToken    = 0;

function startZwExam(selectedItems) {
  var targets = (selectedItems && selectedItems.length)
    ? zyActiveSymbols().filter(function(s) { return selectedItems.indexOf(s) !== -1; })
    : zyActiveSymbols();
  zeLastSelection = (selectedItems && selectedItems.length) ? selectedItems.slice() : null;
  zeRound1 = shuffle(targets).map(function(s) { return { answer: s }; });
  zeCurrentRound     = 1;
  zeCurrentQuestions = zeRound1.slice();
  zeCurrentCorrect   = 0;
  zeCurrentFailed    = [];
  zeRoundHistory     = [];
  zeIdx              = 0;
  showPage('zy-write-exam');
  renderZwExamQuestion();
}

function renderZwExamQuestion() {
  var token = ++zweToken;
  var q = zeCurrentQuestions[zeIdx];
  if (!q) { endZeRound(); return; }
  var total = zeCurrentQuestions.length;
  document.getElementById('zwe-q-num').textContent = '第 ' + (zeIdx + 1) + ' 題 / 共 ' + total + ' 題';
  document.getElementById('zwe-round-label').textContent = 'Round ' + zeCurrentRound;
  document.getElementById('zwe-progress-fill').style.width = Math.round(zeIdx / total * 100) + '%';
  _zweSetMsg('', '');

  var syms = Array.from(q.answer);
  var wrap = document.getElementById('zwe-boxes');
  wrap.innerHTML = '';
  var avail = window.innerHeight - 330;
  var sz = Math.round(Math.max(150, Math.min(syms.length > 1 ? (avail - 12) / 2 : avail, 400)));
  zweWriters = []; zweMistakes = 0;
  syms.forEach(function(s, i) {
    wrap.insertAdjacentHTML('beforeend',
      '<div class="zw-box zw-quiz-box" id="zwe-box-' + i + '" style="width:' + sz + 'px;height:' + sz + 'px"></div>');
    zweWriters.push(HanziWriter.create('zwe-box-' + i, s, _zwWriterOpts(sz, { showOutline: false })));
  });
  _zweQuiz(0, token);
  setTimeout(function() { if (token === zweToken) zySpeakSymbol(q.answer); }, 300);
}

function _zweQuiz(i, token) {
  document.querySelectorAll('#zwe-boxes .zw-quiz-box').forEach(function(el, k) {
    el.classList.toggle('zw-active', k === i && zweWriters.length > 1);
  });
  zweWriters[i].quiz({
    onMistake: function() {
      zweMistakes++;
      flashBox('zwe-box-' + i, 'red'); sfxWrong();
      if (zweMistakes === 1) _zweSetMsg('寫錯了一筆，這題下一輪再考，先照淺色字把它寫完', 'bad');
      zweWriters[i].showOutline();
    },
    onCorrectStroke: function() { flashBox('zwe-box-' + i, 'green'); sfxCorrect(); },
    onComplete: function() {
      if (token !== zweToken) return;
      if (i + 1 < zweWriters.length) { _zweQuiz(i + 1, token); return; }
      _zweRecord(zweMistakes === 0, token);
    }
  });
}

var _zweRecordedToken = 0;
function _zweRecord(passed, token) {
  if (_zweRecordedToken === token) return; // 寫完後的等待期間又按「跳過」不要重複記錄
  _zweRecordedToken = token;
  var q = zeCurrentQuestions[zeIdx];
  if (passed) { zeCurrentCorrect++; sfxCelebrate(); _zweSetMsg('⭕ 通過！', 'ok'); }
  else        { zeCurrentFailed.push(q); _zweSetMsg('再練習一下，下一輪再考', 'bad'); }
  setTimeout(function() {
    if (token !== zweToken) return;
    zeIdx++;
    renderZwExamQuestion();
  }, 900);
}

function zweSkip() {
  var token = zweToken;
  zweWriters.forEach(function(w) { try { w.cancelQuiz(); } catch (e) {} });
  _zweRecord(false, token);
}

function zwePlayVoice() {
  var q = zeCurrentQuestions[zeIdx];
  if (q) zySpeakSymbol(q.answer);
}

function _zweSetMsg(text, cls) {
  var el = document.getElementById('zwe-msg');
  if (!el) return;
  el.textContent = text;
  el.className = 'zw-msg' + (cls ? ' zw-msg-' + cls : '');
}

/* 平板轉向／視窗縮放時重排格子大小 */
var _zwResizeTimer = null;
window.addEventListener('resize', function() {
  if (currentPage !== 'zy-write') return;
  clearTimeout(_zwResizeTimer);
  _zwResizeTimer = setTimeout(function() { zwSetStep(zwStepName); }, 250);
});
