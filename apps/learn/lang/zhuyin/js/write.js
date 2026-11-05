/**
 * write.js — 仿寫練習（單音／結合韻共用）
 * 左邊播範例筆順、右邊跟著描寫；結合韻兩個符號由上往下各一格，寫完第一格接著寫第二格。
 * 筆畫資料來自 strokes.js（HanziWriter charDataLoader）。
 */
'use strict';

var zwList      = [];    // 目前這區可仿寫的項目（單音＝符號，結合韻＝兩個符號的字串）
var zwIdx       = 0;
var zwRefW      = [];    // 範例 HanziWriter（每個符號一個）
var zwQuizW     = [];    // 練習格 HanziWriter
var zwQuizPos   = 0;     // 目前正在寫第幾格
var zwOutline   = true;  // 練習格是否顯示淺色字（描紅）
var zwRunToken  = 0;     // 換題後讓舊的動畫／測驗回呼失效

try { zwOutline = localStorage.getItem('zw-outline') !== 'off'; } catch (e) {}

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
  zySpeakSymbol(zwList[zwIdx]);
}

function zwStep(d) {
  var n = zwIdx + d;
  if (n < 0 || n >= zwList.length) return;
  zwIdx = n;
  renderZyWrite();
  zySpeakSymbol(zwList[zwIdx]);
}

/* 依視窗高度決定格子大小：結合韻上下兩格，要一起塞進一個畫面不用捲動 */
function _zwBoxSize(count) {
  var col  = document.querySelector('#page-zy-write .zw-col');
  var colW = col ? col.getBoundingClientRect().width - 8 : 360;
  var avail = window.innerHeight - 300;
  var sz = count > 1 ? (avail - 12) / count : avail;
  return Math.round(Math.max(150, Math.min(sz, colW, 400)));
}

function renderZyWrite() {
  var token = ++zwRunToken;
  var item = zwList[zwIdx];
  var syms = Array.from(item);

  document.getElementById('zw-symbol').textContent = item;
  document.getElementById('zw-prev').disabled = zwIdx === 0;
  document.getElementById('zw-next').disabled = zwIdx === zwList.length - 1;
  _zwSetMsg('', '');
  _zwSyncOutlineBtn();

  var refWrap  = document.getElementById('zw-ref');
  var quizWrap = document.getElementById('zw-quiz');
  refWrap.innerHTML = ''; quizWrap.innerHTML = '';
  var sz = _zwBoxSize(syms.length);

  zwRefW = []; zwQuizW = []; zwQuizPos = 0;
  syms.forEach(function(s, i) {
    refWrap.insertAdjacentHTML('beforeend',
      '<div class="zw-box" id="zw-ref-' + i + '" style="width:' + sz + 'px;height:' + sz + 'px"></div>');
    quizWrap.insertAdjacentHTML('beforeend',
      '<div class="zw-box zw-quiz-box" id="zw-quiz-' + i + '" style="width:' + sz + 'px;height:' + sz + 'px"></div>');
    zwRefW.push(HanziWriter.create('zw-ref-' + i, s, _zwWriterOpts(sz, {
      strokeColor: '#ff8c42', strokeAnimationSpeed: .8, delayBetweenStrokes: 450
    })));
    zwQuizW.push(HanziWriter.create('zw-quiz-' + i, s, _zwWriterOpts(sz, { showOutline: zwOutline })));
  });

  setTimeout(function() { if (token === zwRunToken) zwPlayRef(); }, 300);
  _zwStartQuiz(0, token);
}

/* 範例動畫：結合韻依序播完第一個再播第二個 */
function zwPlayRef() {
  var token = zwRunToken;
  zwRefW.forEach(function(w) { w.hideCharacter(); });
  (function play(i) {
    if (token !== zwRunToken || i >= zwRefW.length) return;
    zwRefW[i].animateCharacter({ onComplete: function() { setTimeout(function() { play(i + 1); }, 300); } });
  })(0);
}

function _zwStartQuiz(i, token) {
  zwQuizPos = i;
  document.querySelectorAll('#zw-quiz .zw-quiz-box').forEach(function(el, k) {
    el.classList.toggle('zw-active', k === i && zwQuizW.length > 1);
  });
  zwQuizW[i].quiz({
    onMistake: function() { flashBox('zw-quiz-' + i, 'red'); sfxWrong(); },
    onCorrectStroke: function() { sfxCorrect(); },
    onComplete: function() {
      if (token !== zwRunToken) return;
      flashBox('zw-quiz-' + i, 'green');
      if (i + 1 < zwQuizW.length) {
        _zwStartQuiz(i + 1, token);
      } else {
        document.querySelectorAll('#zw-quiz .zw-quiz-box').forEach(function(el) { el.classList.remove('zw-active'); });
        sfxPass();
        _zwMarkPracticed(zwList[zwIdx]);
        _zwSetMsg('🎉 寫得好！' + (zwIdx < zwList.length - 1 ? '按「下一個」繼續' : '都練完了，可以去測驗囉'), 'ok');
      }
    }
  });
}

/* 練習寫完一次：還沒學過的標成「已練習」（精熟只能靠測驗取得） */
function _zwMarkPracticed(item) {
  var map = zyActiveStatusMap('write');
  if (!map[item] || map[item] === 'new') { map[item] = 'practiced'; saveZySymbolStatus(); }
}

function zwRestart() {
  var token = ++zwRunToken;
  _zwSetMsg('', '');
  zwQuizW.forEach(function(w) { w.cancelQuiz(); w.hideCharacter(); });
  _zwStartQuiz(0, token);
}

function zwToggleOutline() {
  zwOutline = !zwOutline;
  try { localStorage.setItem('zw-outline', zwOutline ? 'on' : 'off'); } catch (e) {}
  zwQuizW.forEach(function(w) { if (zwOutline) w.showOutline(); else w.hideOutline(); });
  _zwSyncOutlineBtn();
}

function _zwSyncOutlineBtn() {
  var b = document.getElementById('zw-outline-btn');
  if (b) b.textContent = zwOutline ? '👻 隱藏淺色字' : '👁 顯示淺色字';
}

function _zwSetMsg(text, cls) {
  var el = document.getElementById('zw-msg');
  if (!el) return;
  el.textContent = text;
  el.className = 'zw-msg' + (cls ? ' zw-msg-' + cls : '');
}

/* ══ 仿寫測驗 ══
   比照練字趣：聽讀音、不給範例和淺色字，整題錯 3 筆以內算通過；同一筆連錯 3 次才露出淺色字提示。
   沒通過的下一輪再考，直到全部通過；輪次結算／最終結果頁與聽音選字共用（exam.js 的 ze* 狀態）。 */
var zweWriters  = [];
var zweMistakes = 0;
var zweToken    = 0;
var ZWE_PASS_MISTAKES = 3;

function startZwExam() {
  zeRound1 = shuffle(zyActiveSymbols()).map(function(s) { return { answer: s }; });
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
  var streak = 0;
  document.querySelectorAll('#zwe-boxes .zw-quiz-box').forEach(function(el, k) {
    el.classList.toggle('zw-active', k === i && zweWriters.length > 1);
  });
  zweWriters[i].quiz({
    onMistake: function() {
      zweMistakes++; streak++;
      flashBox('zwe-box-' + i, 'red'); sfxWrong();
      if (streak === 3) zweWriters[i].showOutline();
    },
    onCorrectStroke: function() { streak = 0; flashBox('zwe-box-' + i, 'green'); sfxCorrect(); },
    onComplete: function() {
      if (token !== zweToken) return;
      if (i + 1 < zweWriters.length) { _zweQuiz(i + 1, token); return; }
      _zweRecord(zweMistakes <= ZWE_PASS_MISTAKES, token);
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
  _zwResizeTimer = setTimeout(renderZyWrite, 250);
});
