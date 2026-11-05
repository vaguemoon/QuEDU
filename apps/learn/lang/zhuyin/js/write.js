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
    width: sz, height: sz, padding: Math.round(sz * 0.08),
    charDataLoader: zyCharDataLoader,
    strokeColor: '#2d6fa8', outlineColor: '#c8dff5', highlightColor: '#ffd54f',
    drawingColor: '#2d6fa8', drawingWidth: Math.max(6, Math.round(sz * 0.03)),
    showCharacter: false, showOutline: true, leniency: 1.3, showHintAfterMisses: 3
  }, extra || {});
}

/* ── 選符號 ── */
function enterZyWriteMenu() {
  zwList = zyActiveSymbols().slice();
  var body = document.getElementById('zy-write-menu-body');
  if (body) {
    body.innerHTML = _zyGroupsForSection().map(function(g) {
      return '<div class="menu-section"><div class="menu-section-title">' + g.title + '</div>' +
        '<div class="menu-item-grid">' + g.items.map(function(s) {
          return '<button class="menu-item-btn" onclick="openZyWrite(\'' + s + '\')">' + s + '</button>';
        }).join('') + '</div></div>';
    }).join('');
  }
  showPage('zy-write-menu');
}

function openZyWrite(item) {
  zwIdx = Math.max(0, zwList.indexOf(item));
  showPage('zy-write');
  renderZyWrite();
  zySpeakSymbol(item);
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
        _zwSetMsg('🎉 寫得好！' + (zwIdx < zwList.length - 1 ? '按「下一個」繼續' : '這一區都練完了'), 'ok');
      }
    }
  });
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

/* 平板轉向／視窗縮放時重排格子大小 */
var _zwResizeTimer = null;
window.addEventListener('resize', function() {
  if (currentPage !== 'zy-write') return;
  clearTimeout(_zwResizeTimer);
  _zwResizeTimer = setTimeout(renderZyWrite, 250);
});
