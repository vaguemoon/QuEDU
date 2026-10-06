'use strict';

var _gridLevel          = null;
var _gridRound          = null;
var _gridSelectedCell   = -1;   // 目前選到的目標格索引，-1 = 沒選
var _gridCorrectCount   = 0;
var _gridTotalToFill    = 0;
var _gridAnswered       = [];   // 每一格是否已經填對
var _gridRoundsCompleted = 0;   // 無限挑戰模式用：這次進來已經連續答完幾輪

function openGrid(levelIdx) {
  currentModule   = 'grid';
  currentLevelIdx = levelIdx;
  _gridLevel = GRID_LEVELS[levelIdx];
  _gridRoundsCompleted = 0;
  document.getElementById('game-title').textContent = _gridLevel.title;
  document.getElementById('game-hint').textContent = _gridLevel.labelMode === 'zhuyin'
    ? '看圖例把球換成注音符號，填進右邊一樣的格子！'
    : '看圖例把球換成數字，填進右邊一樣的格子！';
  showSandbox('grid-sandbox');
  _startGridRound();
  showPage('game');
}

function _startGridRound() {
  _gridRound = generateGridRound(_gridLevel);
  _gridSelectedCell = -1;
  _gridCorrectCount = 0;
  _gridTotalToFill = _gridRound.cells.filter(function(c) { return c.filled; }).length;
  _gridAnswered = _gridRound.cells.map(function() { return false; });
  _renderGrid();
}

function _gridUpdateStats() {
  var el = document.getElementById('game-progress');
  if (!el) return;
  el.textContent = _gridLevel.endless
    ? '已完成 ' + _gridRoundsCompleted + ' 輪'
    : _gridCorrectCount + ' / ' + _gridTotalToFill;
}

function _gridCellSvg(renderFn) {
  var svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 40 40');
  renderFn(svg);
  return svg;
}

function _renderGrid() {
  _gridUpdateStats();

  var legendEl = document.getElementById('grid-legend');
  legendEl.innerHTML = '';
  _gridRound.legend.forEach(function(entry) {
    var box = document.createElement('div');
    box.className = 'grid-legend-item';
    box.appendChild(_gridCellSvg(GRID_BALL_TYPES[entry.ball].render));
    var eq = document.createElement('span');
    eq.className = 'grid-legend-eq';
    eq.textContent = '=';
    box.appendChild(eq);
    var val = document.createElement('span');
    val.className = 'grid-legend-num';
    val.textContent = entry.value;
    box.appendChild(val);
    legendEl.appendChild(box);
  });

  var srcEl = document.getElementById('grid-source');
  srcEl.innerHTML = '';
  srcEl.style.gridTemplateColumns = 'repeat(' + _gridRound.cols + ', 1fr)';
  _gridRound.cells.forEach(function(cell) {
    var box = document.createElement('div');
    box.className = 'grid-cell';
    if (cell.filled) box.appendChild(_gridCellSvg(GRID_BALL_TYPES[cell.ball].render));
    srcEl.appendChild(box);
  });

  var tgtEl = document.getElementById('grid-target');
  tgtEl.innerHTML = '';
  tgtEl.style.gridTemplateColumns = 'repeat(' + _gridRound.cols + ', 1fr)';
  _gridRound.cells.forEach(function(cell, idx) {
    var box = document.createElement('div');
    box.className = 'grid-cell';
    if (cell.filled) {
      box.classList.add('grid-cell-target');
      box.setAttribute('data-idx', idx);
      if (_gridAnswered[idx]) {
        box.classList.add('grid-cell-done');
        box.textContent = cell.value;
      } else {
        box.addEventListener('click', function() { _selectGridCell(idx, box); });
      }
    }
    tgtEl.appendChild(box);
  });

  _renderGridPicker();
}

function _selectGridCell(idx, boxEl) {
  _gridSelectedCell = idx;
  document.querySelectorAll('.grid-cell-target').forEach(function(el) { el.classList.remove('selected'); });
  boxEl.classList.add('selected');
  document.getElementById('grid-picker').classList.remove('hidden');
}

function _renderGridPicker() {
  var picker = document.getElementById('grid-picker');
  picker.innerHTML = '';
  var values = _gridRound.legend.map(function(e) { return e.value; });
  if (_gridLevel.labelMode !== 'zhuyin') values.sort(function(a, b) { return a - b; });
  values.forEach(function(v) {
    var btn = document.createElement('button');
    btn.className = 'grid-picker-btn';
    btn.textContent = v;
    btn.addEventListener('click', function() { _onGridValuePick(v, btn); });
    picker.appendChild(btn);
  });
  picker.classList.add('hidden');
}

function _onGridValuePick(v, btnEl) {
  if (_gridSelectedCell === -1) {
    showToast('先點要填的格子喔！');
    return;
  }
  var idx  = _gridSelectedCell;
  var cell = _gridRound.cells[idx];

  if (v === cell.value) {
    sfxCorrect();
    flashBox('grid-sandbox', 'green');
    speakDotLabel(v, _gridLevel.labelMode === 'zhuyin');
    _gridAnswered[idx] = true;
    _gridCorrectCount++;
    _gridSelectedCell = -1;
    _renderGrid();
    if (_gridCorrectCount >= _gridTotalToFill) {
      _gridRoundsCompleted++;
      if (_gridLevel.endless) {
        setTimeout(function() {
          addStar('grid', _gridLevel.id);
          showToast('🎉 這輪全部填對了！換下一輪～');
          _startGridRound();
        }, 700);
      } else {
        setTimeout(function() {
          addStar('grid', _gridLevel.id);
          showResult(_gridLevel.title, 'grid');
        }, 600);
      }
    }
  } else {
    sfxWrong();
    flashBox('grid-sandbox', 'red');
    if (navigator.vibrate) { try { navigator.vibrate(80); } catch (e) {} }
    btnEl.classList.add('grid-picker-wrong');
    setTimeout(function() { btnEl.classList.remove('grid-picker-wrong'); }, 400);
  }
}
