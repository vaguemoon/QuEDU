/**
 * game.js — 選擇頁與遊戲迴圈
 * 負責：openCategory()、renderSelectPage()、startGame()、loadQuestion()、
 *        renderQuestion()、虛擬鍵盤、答題判斷、結果頁
 * 依賴：state.js、questions.js、shared.js（sfxTap、sfxCorrect、sfxWrong、showToast）
 */
'use strict';

// ── 選擇頁狀態 ──
var selectSubtype    = '';
var selectDifficulty = 'easy';

var CAT_CONFIG = {
  length: {
    icon: '📏', name: '長度換算', noDifficulty: true,
    subtypes: [
      { id: 'mm-cm', label: 'mm ↔ cm' },
      { id: 'cm-m',  label: 'cm ↔ m'  },
      { id: 'm-km',  label: 'm ↔ km'  },
      { id: 'mixed', label: '🎲 混合'  }
    ]
  },
  weight: {
    icon: '⚖️', name: '重量換算', noDifficulty: true,
    subtypes: [
      { id: 'g-kg',  label: 'g ↔ kg'  },
      { id: 'kg-t',  label: 'kg ↔ t'  },
      { id: 'mixed', label: '🎲 混合'  }
    ]
  },
  volume: {
    icon: '🧪', name: '容量換算', noDifficulty: true,
    subtypes: [
      { id: 'ml-l', label: 'ml ↔ L' }
    ]
  },
  time: {
    icon: '⏰', name: '時間換算',
    subtypes: [
      { id: 'large-to-small', label: '大到小' },
      { id: 'small-to-large', label: '小到大' }
    ]
  },
  money: {
    icon: '💰', name: '貨幣換算',
    subtypes: [
      { id: 'exchange',       label: '鈔換零錢' },
      { id: 'change-to-bill', label: '零錢換鈔' },
      { id: 'mixed',          label: '🎲 混合'  }
    ]
  },
  percent: {
    icon: '📊', name: '百分率換算', noDifficulty: true,
    subtypes: [
      { id: 'pct-to-dec',  label: '百分率→小數' },
      { id: 'dec-to-pct',  label: '小數→百分率' },
      { id: 'pct-to-frac', label: '百分率→分數' },
      { id: 'frac-to-pct', label: '分數→百分率' },
      { id: 'mixed',       label: '🎲 混合'     }
    ]
  }
};

var _TIME_ITEM_DEFS = [
  { id: 'day-hour', ltsLabel: '日→時', stlLabel: '時→日' },
  { id: 'hour-min', ltsLabel: '時→分', stlLabel: '分→時' },
  { id: 'min-sec',  ltsLabel: '分→秒', stlLabel: '秒→分' }
];

// ════════════════════════════════════════
//  選擇頁
// ════════════════════════════════════════

function openCategory(cat) {
  sfxTap();
  currentCategory  = cat;
  selectSubtype    = CAT_CONFIG[cat].subtypes[0].id;
  selectDifficulty = 'easy';
  selectTimeItems  = { 'day-hour': false, 'hour-min': false, 'min-sec': false };
  renderSelectPage();
  showPage('select');
}

function renderSelectPage() {
  var cfg = CAT_CONFIG[currentCategory];
  var el  = document.getElementById('select-body');
  if (!el) return;

  var html = '';

  html += '<div class="select-section">';
  html += '<div class="select-label">換算類型</div>';
  html += '<div class="type-btn-group">';
  cfg.subtypes.forEach(function(st) {
    html += '<button id="st-' + st.id + '" class="type-btn' + (st.id === selectSubtype ? ' active' : '') +
      '" onclick="setSubtype(\'' + st.id + '\')">' + st.label + '</button>';
  });
  html += '</div></div>';

  if (!cfg.noDifficulty) {
    html += '<div class="select-section">';
    html += '<div class="select-label">難度</div>';
    html += '<div class="type-btn-group">';
    [
      { id: 'easy', label: '初階' },
      { id: 'hard', label: '進階' }
    ].forEach(function(d) {
      html += '<button id="diff-' + d.id + '" class="type-btn' + (d.id === selectDifficulty ? ' active' : '') +
        '" onclick="setDifficulty(\'' + d.id + '\')">' + d.label + '</button>';
    });
    html += '</div></div>';
  }

  if (currentCategory === 'time') {
    var isHard = selectDifficulty === 'hard';
    html += '<div class="select-section">';
    html += '<div class="select-label">換算項目' + (isHard ? '（可多選）' : '（單選）') + '</div>';
    html += '<div class="time-items-group">';
    _TIME_ITEM_DEFS.forEach(function(item) {
      var label   = selectSubtype === 'large-to-small' ? item.ltsLabel : item.stlLabel;
      var checked = selectTimeItems[item.id];
      if (isHard) {
        html += '<label class="time-item-label' + (checked ? ' active' : '') + '">' +
          '<input type="checkbox" class="time-item-input" value="' + item.id + '"' +
          (checked ? ' checked' : '') +
          ' onchange="toggleTimeItem(\'' + item.id + '\')">' +
          label + '</label>';
      } else {
        html += '<label class="time-item-label' + (checked ? ' active' : '') + '">' +
          '<input type="radio" class="time-item-input" name="time-item" value="' + item.id + '"' +
          (checked ? ' checked' : '') +
          ' onchange="selectSingleTimeItem(\'' + item.id + '\')">' +
          label + '</label>';
      }
    });
    html += '</div></div>';
  }

  html += '<button class="btn-start-big" onclick="startGame()">開始練習 →</button>';

  el.innerHTML = html;

  var titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.innerHTML = cfg.icon + ' <span>' + cfg.name + '</span>';
}

function setSubtype(st) {
  sfxTap();
  selectSubtype = st;
  renderSelectPage();
}

function setDifficulty(d) {
  sfxTap();
  selectDifficulty = d;
  if (d === 'easy') {
    var kept = false;
    _TIME_ITEM_DEFS.forEach(function(item) {
      if (kept) { selectTimeItems[item.id] = false; }
      else if (selectTimeItems[item.id]) { kept = true; }
    });
  }
  renderSelectPage();
}

function toggleTimeItem(id) {
  selectTimeItems[id] = !selectTimeItems[id];
  renderSelectPage();
}

function selectSingleTimeItem(id) {
  _TIME_ITEM_DEFS.forEach(function(item) {
    selectTimeItems[item.id] = (item.id === id);
  });
  renderSelectPage();
}

// ════════════════════════════════════════
//  遊戲迴圈
// ════════════════════════════════════════

function startGame() {
  if (currentCategory === 'time') {
    var hasItem = _TIME_ITEM_DEFS.some(function(item) { return selectTimeItems[item.id]; });
    if (!hasItem) { showToast('請至少選一個換算項目！'); return; }
  }
  currentSubtype    = selectSubtype;
  currentDifficulty = selectDifficulty;
  currentTimeItems  = { 'day-hour': selectTimeItems['day-hour'], 'hour-min': selectTimeItems['hour-min'], 'min-sec': selectTimeItems['min-sec'] };
  gamePool    = generateQuestionPool(currentCategory, currentSubtype, currentDifficulty);
  if (gamePool.length === 0) { showToast('沒有可用題目，請換一種設定！'); return; }
  gamePoolIdx  = 0;
  gameCorrect  = 0;
  gameTotal    = 0;
  gameStreak   = 0;
  fillInputStr = '';
  fillInputArr = [];
  activeFillIdx = 0;
  answerCount   = 1;
  if (currentCategory === 'money' && typeof sbRenderBank === 'function') sbRenderBank();
  showPage('game');
  loadQuestion();
}

function loadQuestion() {
  var nextBtn = document.getElementById('game-next-btn');
  if (nextBtn) nextBtn.classList.add('hidden');

  if (gamePoolIdx >= gamePool.length) { showResult(); return; }

  gameQ         = gamePool[gamePoolIdx];
  answerCount   = gameQ.answerCount;
  fillInputStr  = '';
  fillInputArr  = [];
  for (var _i = 0; _i < answerCount; _i++) fillInputArr.push('');
  activeFillIdx = 0;

  renderQuestion();
  updateGameStats();
  enableGameInput();

  if (currentCategory === 'money' && typeof sbInitForQuestion === 'function') {
    setTimeout(function() { sbInitForQuestion(gameQ); }, 60);
  }
  if (currentCategory === 'time' && typeof tsInitForQuestion === 'function') {
    setTimeout(function() { tsInitForQuestion(gameQ); }, 60);
  }
  var isMeasure = (currentCategory === 'length' || currentCategory === 'weight' || currentCategory === 'volume');
  if (isMeasure && typeof msInitForQuestion === 'function') {
    setTimeout(function() { msInitForQuestion(gameQ); }, 60);
  }
}

function renderQuestion() {
  var q    = gameQ;
  var qaEl = document.getElementById('game-question-area');
  if (!qaEl) return;

  var html = '';

  if (q.answerFormat === 'fraction') {
    // 百分率→分數：垂直堆疊分子/分母輸入框
    html = '<span class="q-segment">' + q.prompt + ' = </span>' +
           '<div class="frac-input-wrap">' +
           '<div class="fill-box fill-box-active" id="game-fill-box-0" onclick="setActiveFillBox(0)">＿</div>' +
           '<div class="frac-input-line"></div>' +
           '<div class="fill-box" id="game-fill-box-1" onclick="setActiveFillBox(1)">＿</div>' +
           '</div>';
  } else {
    var parts = q.prompt.split('？');
    var prefix = '';
    if (q.fracDisplay) {
      // 分數→百分率：在題目前方顯示分數
      var fd = q.fracDisplay;
      prefix = '<div class="q-frac">' +
               '<div class="q-frac-num">' + fd.num + '</div>' +
               '<div class="q-frac-line"></div>' +
               '<div class="q-frac-den">' + fd.den + '</div>' +
               '</div>' +
               '<span class="q-segment"> = </span>';
    }
    if (q.answerCount === 1) {
      html = prefix +
             '<span class="q-segment">' + parts[0] + '</span>' +
             '<div class="fill-box" id="game-fill-box">＿</div>' +
             (parts[1] ? '<span class="q-segment">' + parts[1] + '</span>' : '');
    } else if (q.fracDisplay) {
      // frac-to-pct：fill-box-0 以上下格式呈現（分子輸入框 / 100）
      html = prefix +
             '<div class="frac-input-wrap">' +
             '<div class="fill-box fill-box-active" id="game-fill-box-0" onclick="setActiveFillBox(0)">＿</div>' +
             '<div class="frac-input-line"></div>' +
             '<div class="q-frac-den">100</div>' +
             '</div>' +
             '<span class="q-segment"> = </span>' +
             '<div class="fill-box" id="game-fill-box-1" onclick="setActiveFillBox(1)">＿</div>' +
             '<span class="q-segment">%</span>';
    } else {
      html = prefix;
      for (var i = 0; i < q.answerCount; i++) {
        html += '<span class="q-segment">' + (parts[i] || '') + '</span>';
        html += '<div class="fill-box' + (i === 0 ? ' fill-box-active' : '') +
                '" id="game-fill-box-' + i + '" onclick="setActiveFillBox(' + i + ')">＿</div>';
      }
      if (parts[q.answerCount]) {
        html += '<span class="q-segment">' + parts[q.answerCount] + '</span>';
      }
    }
  }
  qaEl.innerHTML = html;

  if (q.answerCount > 1) {
    updateMultiDisplay();
  } else {
    updateSingleDisplay();
  }

  var dotKey = document.getElementById('fill-dot-key');
  if (dotKey) dotKey.classList.toggle('hidden', q.answerFormat !== 'decimal');

  var isMoney   = currentCategory === 'money';
  var isTime    = currentCategory === 'time';
  var isMeasure = (currentCategory === 'length' || currentCategory === 'weight' || currentCategory === 'volume');
  var isRightPanel = isMoney || isTime || isMeasure;
  var gameRight  = document.getElementById('game-right');
  var gameLayout = document.getElementById('game-layout');
  if (gameRight)  gameRight.classList.toggle('hidden', !isRightPanel);
  if (gameLayout) gameLayout.classList.toggle('game-layout-single', !isRightPanel);
  var sbContainer = document.getElementById('sb-container');
  var tsContainer = document.getElementById('ts-container');
  var msContainer = document.getElementById('ms-container');
  if (sbContainer) sbContainer.classList.toggle('hidden', !isMoney);
  if (tsContainer) tsContainer.classList.toggle('hidden', !isTime);
  if (msContainer) msContainer.classList.toggle('hidden', !isMeasure);
}

function updateSingleDisplay() {
  var el = document.getElementById('game-fill-box');
  if (el) el.textContent = fillInputStr || '＿';
}

function updateMultiDisplay() {
  for (var i = 0; i < answerCount; i++) {
    var el = document.getElementById('game-fill-box-' + i);
    if (el) el.textContent = fillInputArr[i] || '＿';
  }
  highlightActiveFillBox();
}

function highlightActiveFillBox() {
  for (var i = 0; i < answerCount; i++) {
    var el = document.getElementById('game-fill-box-' + i);
    if (el) el.classList.toggle('fill-box-active', i === activeFillIdx);
  }
}

function setActiveFillBox(idx) {
  activeFillIdx = idx;
  highlightActiveFillBox();
}

function updateGameStats() {
  var sEl = document.getElementById('game-streak');
  var cEl = document.getElementById('game-correct');
  var rEl = document.getElementById('game-remain');
  if (sEl) sEl.textContent = gameStreak;
  if (cEl) cEl.textContent = gameCorrect;
  if (rEl) rEl.textContent = gamePool.length - gamePoolIdx;
}

// ── 虛擬鍵盤 ──

function fillAppend(d) {
  sfxTap();
  if (answerCount > 1) {
    if (fillInputArr[activeFillIdx].length >= 5) return;
    fillInputArr[activeFillIdx] += String(d);
    updateMultiDisplay();
  } else {
    if (fillInputStr.length >= 6) return;
    if (d === '.' && fillInputStr.indexOf('.') >= 0) return;
    fillInputStr += String(d);
    updateSingleDisplay();
  }
}

function fillBackspace() {
  sfxTap();
  if (answerCount > 1) {
    fillInputArr[activeFillIdx] = fillInputArr[activeFillIdx].slice(0, -1);
    updateMultiDisplay();
  } else {
    fillInputStr = fillInputStr.slice(0, -1);
    updateSingleDisplay();
  }
}

function onGameSubmit() {
  if (answerCount > 1) {
    if (activeFillIdx < answerCount - 1 && fillInputArr[activeFillIdx] !== '') {
      setActiveFillBox(activeFillIdx + 1);
      return;
    }
    if (activeFillIdx === answerCount - 1) {
      for (var i = 0; i < answerCount; i++) {
        if (fillInputArr[i] === '') { showToast('請填入全部答案！'); return; }
      }
      var isCorrect;
      if (gameQ.answerFormat === 'fraction') {
        var uNum = parseInt(fillInputArr[0], 10);
        var uDen = parseInt(fillInputArr[1], 10);
        isCorrect = uDen !== 0 && uNum * gameQ.answer[1] === uDen * gameQ.answer[0];
      } else {
        isCorrect = true;
        for (var i = 0; i < answerCount; i++) {
          if (parseInt(fillInputArr[i], 10) !== gameQ.answer[i]) { isCorrect = false; break; }
        }
      }
      onGameResult(isCorrect);
    }
  } else {
    if (!fillInputStr) return;
    if (gameQ.answerFormat === 'decimal') {
      var fVal = parseFloat(fillInputStr);
      onGameResult(!isNaN(fVal) && Math.abs(fVal - gameQ.answer[0]) < 1e-9);
    } else {
      var val = parseInt(fillInputStr, 10);
      onGameResult(val === gameQ.answer[0]);
    }
  }
}

function handleFillKeydown(e) {
  if (currentPage !== 'game') return;
  if (e.key >= '0' && e.key <= '9') { fillAppend(e.key); return; }
  if (e.key === '.' && gameQ && gameQ.answerFormat === 'decimal') { fillAppend('.'); return; }
  if (e.key === 'Backspace') { fillBackspace(); return; }
  if (e.key === 'Enter') { onGameSubmit(); }
}

// ── 答題結果 ──

function onGameResult(isCorrect) {
  gameTotal++;
  if (isCorrect) {
    gameStreak++;
    gameCorrect++;
    totalCorrect++;
    if (gameStreak > bestStreak) bestStreak = gameStreak;
    sfxCorrect();
    _flashFillBoxes('fill-box-correct');
    updateGameStats();
    if (typeof checkAchievements === 'function') checkAchievements();
    saveProgress();
    gamePoolIdx++;
    disableGameInput();
    setTimeout(loadQuestion, 500);
  } else {
    gameStreak = 0;
    sfxWrong();
    _showCorrectAnswer();
    updateGameStats();
    disableGameInput();
    var nextBtn = document.getElementById('game-next-btn');
    if (nextBtn) nextBtn.classList.remove('hidden');
  }
}

function _flashFillBoxes(cls) {
  if (answerCount > 1) {
    for (var i = 0; i < answerCount; i++) {
      var el = document.getElementById('game-fill-box-' + i);
      if (el) { el.textContent = gameQ.answer[i]; el.classList.add(cls); }
    }
  } else {
    var el = document.getElementById('game-fill-box');
    if (el) { el.textContent = gameQ.answer[0]; el.classList.add(cls); }
  }
}

function _showCorrectAnswer() {
  if (answerCount > 1) {
    for (var i = 0; i < answerCount; i++) {
      var el = document.getElementById('game-fill-box-' + i);
      if (el) {
        // 分數答錯：以 pctValue/100 形式顯示
        if (gameQ.answerFormat === 'fraction') {
          el.textContent = i === 0 ? gameQ.pctValue : 100;
        } else {
          el.textContent = gameQ.answer[i];
        }
        el.classList.remove('fill-box-active');
        el.classList.add('fill-box-correct');
      }
    }
  } else {
    var el = document.getElementById('game-fill-box');
    if (el) { el.textContent = gameQ.answer[0]; el.classList.add('fill-box-correct'); }
  }
}

function doNextQuestion() {
  sfxTap();
  gamePoolIdx++;
  document.querySelectorAll('.fill-box').forEach(function(b) {
    b.classList.remove('fill-box-correct', 'fill-box-wrong', 'fill-box-active');
  });
  loadQuestion();
}

function enableGameInput() {
  var pad = document.getElementById('game-fill-pad');
  if (pad) pad.querySelectorAll('button').forEach(function(btn) { btn.disabled = false; });
}

function disableGameInput() {
  var pad = document.getElementById('game-fill-pad');
  if (pad) pad.querySelectorAll('button').forEach(function(btn) { btn.disabled = true; });
}

// ════════════════════════════════════════
//  貨幣實物視覺化
// ════════════════════════════════════════

var _GV_BILLS = [100, 200, 500, 1000];

function _gvIsBill(denom) { return _GV_BILLS.indexOf(denom) >= 0; }

function _gvCoinHtml(denom) {
  return '<div class="gv-coin gv-coin-' + denom + '">' + denom + '</div>';
}

function _gvBillHtml(denom) {
  return '<div class="gv-bill gv-bill-' + denom + '">' + denom + '<br>元</div>';
}

function _gvMoneyHtml(denom) {
  return _gvIsBill(denom) ? _gvBillHtml(denom) : _gvCoinHtml(denom);
}

function renderMoneyVisual(q) {
  var el = document.getElementById('game-visual');
  if (!el) return;
  var v = q && q.visual;
  if (!v) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');

  var html = '';

  if (v.mode === 'exchange') {
    // 鈔換零錢：來源幣 → 目標幣 × ？
    html += '<div class="gv-row">';
    html += '<div class="gv-item">' + _gvMoneyHtml(v.fromDenom) + '<div class="gv-label">' + v.fromDenom + ' 元</div></div>';
    html += '<div class="gv-arrow">→</div>';
    html += '<div class="gv-item">' + _gvMoneyHtml(v.toDenom) + '<div class="gv-label">' + v.toDenom + ' 元 × ？</div></div>';
    html += '</div>';

  } else if (v.mode === 'coins-to-bill') {
    // 零錢換鈔：展示所有硬幣（每排 5 個，最多 20 個）
    var shown = Math.min(v.coinCount, 20);
    html += '<div class="gv-coin-grid">';
    for (var i = 0; i < shown; i++) html += _gvCoinHtml(v.coinDenom);
    if (v.coinCount > 20) {
      html += '<span class="gv-more">…共 ' + v.coinCount + ' 個</span>';
    }
    html += '</div>';
    html += '<div class="gv-hint">共 ' + v.coinCount + ' 個 ' + v.coinDenom + ' 元 = ？ 張 ' + v.billDenom + ' 元</div>';
  }

  el.innerHTML = html;
}

function revealMoneyVisual(q) {
  var el = document.getElementById('game-visual');
  if (!el || !q || !q.visual) return;
  var v = q.visual;
  var html = '';

  if (v.mode === 'exchange') {
    // 顯示正確的目標硬幣數量
    var count = q.answer[0];
    var showCoins = count <= 10;
    html += '<div class="gv-row gv-row-reveal">';
    html += '<div class="gv-item">' + _gvMoneyHtml(v.fromDenom) + '<div class="gv-label">' + v.fromDenom + ' 元</div></div>';
    html += '<div class="gv-arrow">=</div>';
    if (showCoins) {
      html += '<div class="gv-coin-grid gv-coin-grid-sm">';
      for (var i = 0; i < count; i++) html += _gvCoinHtml(v.toDenom);
      html += '</div>';
    } else {
      html += '<div class="gv-item">' + _gvMoneyHtml(v.toDenom) + '<div class="gv-label">× ' + count + ' 個</div></div>';
    }
    html += '</div>';

  } else if (v.mode === 'coins-to-bill') {
    // 分組顯示：每組 coinsPerBill 個硬幣 = 1 張鈔票
    var coinsPerBill = v.billDenom / v.coinDenom;
    var numBills = Math.floor(v.coinCount / coinsPerBill);
    var remainder = v.coinCount % coinsPerBill;

    html += '<div class="gv-groups">';
    for (var b = 0; b < numBills; b++) {
      html += '<div class="gv-group">';
      html += '<div class="gv-group-coins">';
      var groupShown = Math.min(coinsPerBill, 10);
      for (var c = 0; c < groupShown; c++) html += _gvCoinHtml(v.coinDenom);
      if (coinsPerBill > 10) html += '<span class="gv-more">×' + coinsPerBill + '</span>';
      html += '</div>';
      html += '<div class="gv-group-eq">= ' + _gvBillHtml(v.billDenom) + '</div>';
      html += '</div>';
    }
    if (remainder > 0) {
      html += '<div class="gv-group gv-remainder">';
      html += '<div class="gv-group-coins">';
      for (var r = 0; r < remainder; r++) html += _gvCoinHtml(v.coinDenom);
      html += '</div>';
      html += '<div class="gv-remainder-label">剩 ' + remainder + ' 個</div>';
      html += '</div>';
    }
    html += '</div>';
  }

  el.innerHTML = html;
}

// ════════════════════════════════════════
//  結果頁
// ════════════════════════════════════════

function showResult() {
  var pct   = gameTotal > 0 ? gameCorrect / gameTotal : 0;
  var stars = pct >= 0.9 ? 3 : pct >= 0.7 ? 2 : 1;

  sfxGrandCelebrate();

  totalRounds++;
  var catStat = categoryStats[currentCategory];
  if (catStat) { catStat.rounds++; catStat.stars += stars; }
  saveProgress();
  if (typeof checkAchievements === 'function') checkAchievements();

  var iconEl  = document.getElementById('result-icon');
  var titleEl = document.getElementById('result-title');
  var subEl   = document.getElementById('result-sub');
  var starsEl = document.getElementById('result-stars');

  if (iconEl) iconEl.textContent   = stars === 3 ? '🎉' : stars === 2 ? '👏' : '💪';
  if (titleEl) titleEl.textContent = stars === 3 ? '太厲害了！' : stars === 2 ? '表現不錯！' : '繼續加油！';
  if (subEl)   subEl.textContent   = '答對 ' + gameCorrect + ' / ' + gameTotal + ' 題';
  if (starsEl) starsEl.textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);

  showPage('result', false);
  PAGE_STACK = ['home', 'select', 'result'];
}
