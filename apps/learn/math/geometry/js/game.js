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

/* 首頁的大項；面積/體積/表面積進「選形狀」頁，角與三角形直接開始 */
var CATEGORIES = {
  angle: {
    label: '角與三角形',
    items: [
      { id: 'angle',    icon: '∠', title: '角的分類',     sub: '銳角・直角・鈍角' },
      { id: 'triangle', icon: '△', title: '三角形的分類', sub: '銳角・直角・鈍角三角形' },
      { id: 'side',     icon: '⟁', title: '等腰與正三角形', sub: '等腰・正・等腰直角三角形' },
      { id: 'congruent', icon: '⧉', title: '全等圖形',     sub: '對應點・對應邊・對應角' }
    ]
  },
  measure: {
    label: '面積與體積',
    items: [
      { id: 'area',    icon: '▭', title: '面積計算',   sub: '長方形・三角形・圓形⋯' },
      { id: 'volume',  icon: '▣', title: '體積計算',   sub: '正方體・長方體・圓柱⋯' },
      { id: 'surface', icon: '⬡', title: '表面積計算', sub: '展開圖・各面加總' }
    ]
  }
};

/* ════════════════════════════════════════
   首頁 → 大項 → 選擇頁
   ════════════════════════════════════════ */

function openCategory(cat) {
  sfxTap();
  currentCategory = cat;
  var c = CATEGORIES[cat];
  PAGE_CONFIG.cat.title = '📐 <span>' + c.label + '</span>';
  document.getElementById('cat-title').textContent = c.label;
  document.getElementById('cat-items').innerHTML = c.items.map(function(it) {
    return '<button class="module-card module-card--' + it.id + '" onclick="openItem(\'' + it.id + '\')">' +
      '<div class="module-card-icon">' + it.icon + '</div>' +
      '<div class="module-card-info"><div class="module-card-title">' + it.title + '</div>' +
      '<div class="module-card-sub">' + it.sub + '</div></div></button>';
  }).join('');
  showPage('cat');
}

/* 每個項目都先到選擇頁：選形狀／三角形種類（角的分類、三角形的分類沒有）＋題數 */
function openItem(id) { openModule(id); }

/* 結果頁的「換項目／換形狀／換種類」：重設返回路徑，免得按返回又回到結果頁 */
function resultSwitch() {
  PAGE_STACK = _hasShapes(currentModule) ? ['home', 'cat', 'select'] : ['home', 'cat'];
  showPage(PAGE_STACK[PAGE_STACK.length - 1], false);
}

/* 選擇頁上要選的東西：面積/體積/表面積選形狀，等腰與正三角形選種類 */
var SIDE_ICON = {
  iso:      '<svg viewBox="0 0 40 36"><polygon points="20,3 33,33 7,33"/></svg>',
  equi:     '<svg viewBox="0 0 40 36"><polygon points="20,4 37,33 3,33"/></svg>',
  isoright: '<svg viewBox="0 0 40 36"><polygon points="6,4 6,33 35,33"/><polyline points="6,26 13,26 13,33"/></svg>'
};

/* 各項目在選擇頁要選什麼；null＝只選題數 */
function _selectOpts(mod) {
  var cfg = MODULE_CONFIG[mod];
  if (cfg) return { keys: cfg.shapes, page: '選擇形狀', hint: '選擇要練習的形狀和題數',
    icon: function(k) { return _shapeIcon(mod, k); }, label: function(k) { return _shapeLabel(mod, k); } };
  if (mod === 'side') return { keys: SIDE_KINDS, page: '選擇種類', hint: '選擇要練習哪一種三角形，還有題數',
    icon: function(k) { return SIDE_ICON[k]; }, label: function(k) { return SIDE_ASK[k]; } };
  if (mod === 'congruent') return { keys: CONG_MODES, page: '選擇種類', hint: '選擇要練習找對應點、對應邊還是對應角，還有題數',
    icon: function(k) { return CONG_MODE_ICON[k]; }, label: function(k) { return CONG_MODE_NAME[k]; } };
  return null;
}

function _hasShapes(mod) { return !!_selectOpts(mod); }

function openModule(mod) {
  sfxTap();
  currentModule = mod;
  var o = _selectOpts(mod);
  currentShape = o ? o.keys[0] : '';
  PAGE_CONFIG.select.title = '📋 <span>' + (o ? o.page : '選擇題數') + '</span>';
  renderSelectPage();
  showPage('select');
}

function renderSelectPage() {
  var el = document.getElementById('select-body');
  if (!el) return;
  var cfg = MODULE_CONFIG[currentModule], o = _selectOpts(currentModule);
  var item = CATEGORIES.angle.items.filter(function(it) { return it.id === currentModule; })[0];

  var html = '<div class="select-title">' + (cfg ? cfg.label : item.title) + '</div>';
  html += '<div class="select-hint">' + (o ? o.hint : '選擇要練習的題數') + '</div>';
  if (o) {
    html += '<div class="shape-grid">';
    o.keys.forEach(function(sh) {
      var sel = sh === currentShape ? ' selected' : '';
      html += '<button class="shape-btn' + sel + '" onclick="selectShape(\'' + sh + '\')">' +
        '<span class="shape-btn-icon">' + o.icon(sh) + '</span>' +
        '<span class="shape-btn-label">' + o.label(sh) + '</span>' +
        '</button>';
    });
    html += '</div>';
  }
  html += '<div class="count-pick"><span class="count-label">題數</span><span class="count-seg">' +
    ROUND_COUNTS.map(function(n) {
      return '<button class="count-btn' + (n === ROUND_SIZE ? ' on' : '') + '" onclick="setRoundSize(' + n + ')">' + n + '</button>';
    }).join('') + '</span></div>';
  html += '<button class="btn-start-big" onclick="startGame()">開始練習 →</button>';
  el.innerHTML = html;
}

function selectShape(sh) {
  sfxTap();
  currentShape = sh;
  renderSelectPage();
}

function setRoundSize(n) {
  sfxTap();
  ROUND_SIZE = n;
  try { localStorage.setItem('geometry-cfg', JSON.stringify({ count: n })); } catch (e) {}
  renderSelectPage();
}

/* ════════════════════════════════════════
   遊戲迴圈
   ════════════════════════════════════════ */

function startGame() {
  sfxTap();
  if (isAngleModule(currentModule)) { angStart(); return; }
  gamePool   = generateQuestionPool(currentModule, currentShape);
  gamePoolIdx = 0;
  gameCorrect = 0;
  gameTotal   = 0;
  fillInputStr = '';
  showPage('game');
  loadQuestion();
}

var _hintUsed = false;

function loadQuestion() {
  if (gamePoolIdx >= gamePool.length) { showResult(); return; }
  gameQ = gamePool[gamePoolIdx];
  fillInputStr = '';
  _hintUsed = false;
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
  if (isCorrect && !_hintUsed) {
    gameCorrect++;
    sfxCorrect();
    if (fillEl) { fillEl.textContent = gameQ.answer; fillEl.classList.add('fill-box-correct'); }
    updateGameStats();
    gamePoolIdx++;
    setTimeout(loadQuestion, 700);
  } else if (isCorrect && _hintUsed) {
    /* 看過提示後答對：顯示正確但不計分 */
    if (fillEl) { fillEl.textContent = gameQ.answer; fillEl.classList.add('fill-box-correct'); }
    updateGameStats();
    showToast('答案正確，但已看提示，不計分');
    gamePoolIdx++;
    setTimeout(loadQuestion, 1200);
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
  _hintUsed = true;
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
  var sw = document.getElementById('result-switch');
  if (sw) sw.textContent = MODULE_CONFIG[currentModule] ? '換形狀' : _hasShapes(currentModule) ? '換種類' : '換項目';
  showPage('result', false);
  PAGE_STACK = ['home', 'cat', 'select', 'result'];
}
