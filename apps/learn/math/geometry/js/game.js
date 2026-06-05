'use strict';

/* ════════════════════════════════════════
   模組 / 形狀設定
   ════════════════════════════════════════ */

var MODULE_CONFIG = {
  area: {
    label: '面積計算', unit: '平方公分',
    shapes: ['rectangle','square','triangle','parallelogram','trapezoid','rhombus','circle']
  },
  volume: {
    label: '體積計算', unit: '立方公分',
    shapes: ['cube','rectangular_prism','cylinder','triangular_prism']
  },
  surface: {
    label: '表面積計算', unit: '平方公分',
    shapes: ['cube','rectangular_prism','cylinder','triangular_prism']
  }
};

function _shapeLabel(module, shape) {
  return (getShapeMap(module)[shape] || {}).label || shape;
}

function _shapeIcon(module, shape) {
  return (getShapeMap(module)[shape] || {}).icon || '■';
}

/* ════════════════════════════════════════
   首頁 → 選擇頁
   ════════════════════════════════════════ */

function openModule(mod) {
  sfxTap();
  currentModule = mod;
  currentShape  = MODULE_CONFIG[mod].shapes[0];
  renderSelectPage();
  showPage('select');
}

function renderSelectPage() {
  var cfg = MODULE_CONFIG[currentModule];
  var el  = document.getElementById('select-body');
  if (!el) return;

  var html = '<div class="select-title">' + cfg.label + '</div>';
  html += '<div class="select-hint">選擇要練習的形狀，開始 10 題練習</div>';
  html += '<div class="shape-grid">';
  cfg.shapes.forEach(function(sh) {
    var sel = sh === currentShape ? ' selected' : '';
    html += '<button class="shape-btn' + sel + '" onclick="selectShape(\'' + sh + '\')">' +
      '<span class="shape-btn-icon">' + _shapeIcon(currentModule, sh) + '</span>' +
      '<span class="shape-btn-label">' + _shapeLabel(currentModule, sh) + '</span>' +
      '</button>';
  });
  html += '</div>';
  html += '<button class="btn-start-big" onclick="startGame()">開始練習 →</button>';
  el.innerHTML = html;
}

function selectShape(sh) {
  sfxTap();
  currentShape = sh;
  renderSelectPage();
}

/* ════════════════════════════════════════
   遊戲迴圈
   ════════════════════════════════════════ */

function startGame() {
  sfxTap();
  gamePool    = generateQuestionPool(currentModule, currentShape);
  gamePoolIdx = 0;
  gameCorrect = 0;
  gameTotal   = 0;
  fillInputStr = '';
  showPage('game');
  loadQuestion();
}

function loadQuestion() {
  if (gamePoolIdx >= gamePool.length) { showResult(); return; }
  gameQ = gamePool[gamePoolIdx];
  fillInputStr = '';
  clearHintTimers();
  renderQuestion();
  updateGameStats();
  enableGameInput();
  initSandbox(gameQ);
}

function renderQuestion() {
  var q   = gameQ;
  var el  = document.getElementById('game-question-area');
  if (!el) return;

  var parts = q.prompt.split('？');
  var html  = '<div class="q-text">' + parts[0] + '</div>';
  html += '<div class="q-blank-row">';
  html += '<div class="fill-box" id="game-fill-box">＿</div>';
  if (parts[1]) html += '<span class="q-text">' + parts[1].trim() + '</span>';
  html += '</div>';
  el.innerHTML = html;

  var dotKey = document.getElementById('fill-dot-key');
  if (dotKey) dotKey.classList.toggle('hidden', !q.isCircular);
}

function updateGameStats() {
  var qn = document.getElementById('game-qnum');
  var cr = document.getElementById('game-correct');
  var re = document.getElementById('game-remain');
  if (qn) qn.textContent = gamePoolIdx + 1;
  if (cr) cr.textContent = gameCorrect;
  if (re) re.textContent = gamePool.length - gamePoolIdx;
}

/* ════════════════════════════════════════
   虛擬鍵盤
   ════════════════════════════════════════ */

function fillAppend(d) {
  sfxTap();
  if (fillInputStr.length >= 8) return;
  if (d === '.' && fillInputStr.indexOf('.') >= 0) return;
  fillInputStr += String(d);
  _updateFillDisplay();
}

function fillBackspace() {
  sfxTap();
  fillInputStr = fillInputStr.slice(0, -1);
  _updateFillDisplay();
}

function _updateFillDisplay() {
  var el = document.getElementById('game-fill-box');
  if (el) el.textContent = fillInputStr || '＿';
}

function onGameSubmit() {
  if (!fillInputStr) return;
  var user = parseFloat(fillInputStr);
  if (isNaN(user)) return;
  var correct = Math.abs(user - gameQ.answer) < 0.005;
  onGameResult(correct);
}

function handleFillKeydown(e) {
  if (currentPage !== 'game') return;
  if (e.key >= '0' && e.key <= '9') { fillAppend(e.key); return; }
  if (e.key === '.' && gameQ && gameQ.isCircular) { fillAppend('.'); return; }
  if (e.key === 'Backspace') { fillBackspace(); return; }
  if (e.key === 'Enter') { onGameSubmit(); }
}

/* ════════════════════════════════════════
   答題結果
   ════════════════════════════════════════ */

function onGameResult(isCorrect) {
  gameTotal++;
  disableGameInput();
  var fillEl = document.getElementById('game-fill-box');
  if (isCorrect) {
    gameCorrect++;
    sfxCorrect();
    if (fillEl) { fillEl.textContent = gameQ.answer; fillEl.classList.add('fill-box-correct'); }
    updateGameStats();
    gamePoolIdx++;
    setTimeout(loadQuestion, 700);
  } else {
    sfxWrong();
    if (fillEl) { fillEl.textContent = gameQ.answer; fillEl.classList.add('fill-box-correct'); }
    updateGameStats();
    playHint();
    setTimeout(function() {
      gamePoolIdx++;
      loadQuestion();
    }, 4000);
  }
}

function enableGameInput() {
  var pad = document.getElementById('game-fill-pad');
  if (pad) pad.querySelectorAll('button').forEach(function(b) { b.disabled = false; });
}

function disableGameInput() {
  var pad = document.getElementById('game-fill-pad');
  if (pad) pad.querySelectorAll('button').forEach(function(b) { b.disabled = true; });
}

/* ════════════════════════════════════════
   沙盒統一入口
   ════════════════════════════════════════ */

var _hintTimers = [];
var _animStopped = false;
var _SVG_NS_GAME = 'http://www.w3.org/2000/svg';

function clearHintTimers() {
  _animStopped = true;
  _hintTimers.forEach(function(t) { clearTimeout(t); });
  _hintTimers = [];
  var svg = document.getElementById('sandbox-svg');
  if (svg) {
    var old = svg.querySelector('#hint-group');
    if (old) svg.removeChild(old);
  }
}

function initSandbox(q) {
  clearHintTimers();
  if (q.module === 'area')    areaDrawShape(q);
  else if (q.module === 'volume')  volDrawShape(q);
  else if (q.module === 'surface') surfDrawShape(q);
}

function playHint() {
  if (!gameQ) return;
  clearHintTimers();
  _animStopped = false;
  if (gameQ.module === 'area')    areaPlayHint(gameQ);
  else if (gameQ.module === 'volume')  volPlayHint(gameQ);
  else if (gameQ.module === 'surface') surfPlayHint(gameQ);
}

/* formula steps util — renders into SVG hint-group (viewBox y=220..300) */
function showFormulaSteps(steps) {
  var svg = document.getElementById('sandbox-svg');
  if (!svg) return;

  /* remove previous hint group */
  var old = svg.querySelector('#hint-group');
  if (old) svg.removeChild(old);

  var g = document.createElementNS(_SVG_NS_GAME, 'g');
  g.id = 'hint-group';

  /* translucent background strip */
  var bg = document.createElementNS(_SVG_NS_GAME, 'rect');
  bg.setAttribute('x', '0'); bg.setAttribute('y', '216');
  bg.setAttribute('width', '300'); bg.setAttribute('height', '84');
  bg.setAttribute('fill', 'rgba(255,255,255,0.95)');
  g.appendChild(bg);

  /* separator line */
  var ln = document.createElementNS(_SVG_NS_GAME, 'line');
  ln.setAttribute('x1', '10'); ln.setAttribute('y1', '218');
  ln.setAttribute('x2', '290'); ln.setAttribute('y2', '218');
  ln.setAttribute('stroke', '#d0dff0'); ln.setAttribute('stroke-width', '1');
  g.appendChild(ln);

  svg.appendChild(g);

  var FILL = { 'step-formula': '#2d6fa8', 'step-sub': '#c0660a', 'step-answer': '#1e8449' };
  var startY = 233;

  steps.forEach(function(item, i) {
    var t = setTimeout(function() {
      var txt = document.createElementNS(_SVG_NS_GAME, 'text');
      txt.setAttribute('x', '12');
      txt.setAttribute('y', String(startY + i * 20));
      txt.setAttribute('font-size', '11');
      txt.setAttribute('font-family', 'Courier New, monospace');
      txt.setAttribute('font-weight', item.cls === 'step-formula' ? '900' : '700');
      txt.setAttribute('fill', FILL[item.cls] || '#333');
      txt.textContent = item.text;
      g.appendChild(txt);
    }, i * 750);
    _hintTimers.push(t);
  });
}

/* ════════════════════════════════════════
   結果頁
   ════════════════════════════════════════ */

function showResult() {
  sfxGrandCelebrate();
  var pct = gameTotal > 0 ? gameCorrect / gameTotal : 0;
  var iconEl  = document.getElementById('result-icon');
  var titleEl = document.getElementById('result-title');
  var subEl   = document.getElementById('result-sub');
  if (iconEl)  iconEl.textContent  = pct >= 0.9 ? '🎉' : pct >= 0.6 ? '👏' : '💪';
  if (titleEl) titleEl.textContent = pct >= 0.9 ? '太厲害了！' : pct >= 0.6 ? '表現不錯！' : '繼續加油！';
  if (subEl)   subEl.textContent   = '答對 ' + gameCorrect + ' / ' + gameTotal + ' 題';
  showPage('result', false);
  PAGE_STACK = ['home', 'select', 'result'];
}
