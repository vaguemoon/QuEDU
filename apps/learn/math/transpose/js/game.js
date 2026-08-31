'use strict';

// ════════════════════════════════════════
//  遊戲核心邏輯
// ════════════════════════════════════════

// ── 開始遊戲（由首頁題型卡呼叫）──
function startGame(topic) {
  currentTopic = topic;
  hearts       = 3;
  streak       = 0;
  maxStreak    = 0;
  totalCorrect = 0;
  gamePool     = buildPool(topic, 20);
  gamePoolIdx  = 0;
  showPage('game');
  loadNextQuestion();
}

// ── 載入下一題 ──
function loadNextQuestion() {
  fillInputStr = '';
  dragPhase    = 'dragging';

  if (gamePoolIdx >= gamePool.length) {
    gamePool    = buildPool(currentTopic, 20);
    gamePoolIdx = 0;
  }
  gameQ = gamePool[gamePoolIdx++];
  if (gameQ.type === 'twoStep') gameQ.dragStep = 0;

  renderEquation(gameQ);
  hideFillPad();
  hideNextBtn();
  updateHUD();

  // 顯示拖曳提示（一開始）
  showDragHint();
}

// ── drag.js 拖曳完成後呼叫此函式 ──
function onTermDropped() {
  if (gameQ.type === 'twoStep' && gameQ.dragStep === 0) {
    gameQ.dragStep = 1;
    renderEquation(gameQ);
  } else {
    // 所有拖曳完成，進入填空
    dragPhase = 'filling';
    renderEquation(gameQ);
    showFillPad();
    hideDragHint();
  }
}

// ════════════════════════════════════════
//  填空鍵盤
// ════════════════════════════════════════
function fillAppend(d) {
  if (fillInputStr.length >= 2) return;
  sfxTap();
  fillInputStr += String(d);
  updateFillDisplay();
}

function fillBackspace() {
  sfxTap();
  fillInputStr = fillInputStr.slice(0, -1);
  updateFillDisplay();
}

function onFillSubmit() {
  if (!fillInputStr) return;
  var entered = parseInt(fillInputStr, 10);
  disableFillPad();

  if (entered === gameQ.unknown) {
    onCorrect();
  } else {
    onWrong();
  }
}

// ════════════════════════════════════════
//  正確 / 錯誤處理
// ════════════════════════════════════════
function onCorrect() {
  sfxCorrect();
  streak++;
  totalCorrect++;
  if (streak > maxStreak) maxStreak = streak;
  updateHUD();
  flashEqRow('flash-green');
  setTimeout(loadNextQuestion, 500);
}

function onWrong() {
  sfxWrong();
  streak = 0;
  hearts--;
  updateHUD();
  flashEqRow('flash-red');
  // 顯示正確答案
  var el = document.getElementById('fill-display');
  if (el) { el.textContent = gameQ.unknown; el.className = 'eq-blank fill-correct'; }
  if (hearts <= 0) {
    setTimeout(showGameOver, 900);
  } else {
    setTimeout(loadNextQuestion, 1200);
  }
}

// ════════════════════════════════════════
//  遊戲結束
// ════════════════════════════════════════
function showGameOver() {
  var el = document.getElementById('gameover-streak');
  if (el) el.textContent = '最高連勝：' + maxStreak;
  var overlay = document.getElementById('gameover-overlay');
  if (overlay) overlay.classList.add('show');
}

function closeGameOver() {
  var overlay = document.getElementById('gameover-overlay');
  if (overlay) overlay.classList.remove('show');
}

function restartSameTopic() {
  closeGameOver();
  startGame(currentTopic);
}

function goBackHome() {
  closeGameOver();
  PAGE_STACK = ['home'];
  showPage('home', false);
}

// ── 顯示結果頁（一池題目完成）──
function showResult() {
  var el;
  el = document.getElementById('result-streak');
  if (el) el.textContent = maxStreak;
  el = document.getElementById('result-correct');
  if (el) el.textContent = totalCorrect;
  el = document.getElementById('result-hearts');
  if (el) el.textContent = '❤️'.repeat(hearts) + '🖤'.repeat(3 - hearts);
  PAGE_STACK.push('result');
  showPage('result', false);
}

// ════════════════════════════════════════
//  HUD 更新
// ════════════════════════════════════════
function updateHUD() {
  // 愛心
  for (var i = 0; i < 3; i++) {
    var h = document.getElementById('heart-' + i);
    if (h) h.textContent = i < hearts ? '❤️' : '🖤';
  }
  // 連勝
  var sv = document.getElementById('streak-val');
  if (sv) {
    sv.textContent = streak;
    sv.classList.remove('anim-pop');
    void sv.offsetWidth;
    sv.classList.add('anim-pop');
  }
}

// ════════════════════════════════════════
//  視覺回饋
// ════════════════════════════════════════
function flashEqRow(cls) {
  var row = document.getElementById('eq-row');
  if (!row) return;
  row.classList.remove('flash-green', 'flash-red');
  void row.offsetWidth;
  row.classList.add(cls);
}

// ════════════════════════════════════════
//  UI 顯示 / 隱藏
// ════════════════════════════════════════
function showFillPad() {
  var el = document.getElementById('fill-pad');
  if (el) el.style.display = '';
  enableFillPad();
}

function hideFillPad() {
  var el = document.getElementById('fill-pad');
  if (el) el.style.display = 'none';
}

function enableFillPad() {
  document.querySelectorAll('#fill-pad .fill-btn').forEach(function(b) { b.disabled = false; });
}

function disableFillPad() {
  document.querySelectorAll('#fill-pad .fill-btn').forEach(function(b) { b.disabled = true; });
}

function hideNextBtn() {
  var el = document.getElementById('next-btn');
  if (el) el.classList.add('hidden');
}

function showDragHint() {
  var el = document.getElementById('drag-hint');
  if (el) el.style.opacity = '1';
}

function hideDragHint() {
  var el = document.getElementById('drag-hint');
  if (el) el.style.opacity = '0';
}

// ════════════════════════════════════════
//  鍵盤支援
// ════════════════════════════════════════
function handleFillKeydown(e) {
  if (currentPage !== 'game' || dragPhase !== 'filling') return;
  if (e.key >= '0' && e.key <= '9') { fillAppend(e.key); return; }
  if (e.key === 'Backspace') { fillBackspace(); return; }
  if (e.key === 'Enter') { onFillSubmit(); }
}
