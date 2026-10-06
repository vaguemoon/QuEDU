'use strict';

var _trLevel     = null;
var _trRows      = [];   // [{ samples, covered, color, done, inkGroupEl }]
var _trActiveRow = -1;   // 目前正在描的行；-1 表示沒有在拖曳
var _trDragging  = false;
var _trCurSeg    = null; // { onTrack, el, pts }
var TR_TOLERANCE   = 16;
var TR_START_TOL   = 30;
var TR_PASS_RATIO  = 0.92; // 幾乎每個點都要碰到才算過關，不能只描一部分
var TR_END_SAMPLES = 3;    // 結尾這幾個取樣點至少要碰到一個，不能半路放開手就過關

function openTracing(levelIdx) {
  currentModule   = 'tracing';
  currentLevelIdx = levelIdx;
  _trLevel = TRACING_LEVELS[levelIdx];

  if (_trLevel.type === 'worksheet') {
    _trRows = _trLevel.rows.map(function(row) {
      var samples = buildTraceSamples({ type: 'multi', parts: row.parts }, row.samples || 56);
      return {
        samples: samples,
        covered: samples.map(function() { return false; }),
        color: row.color || null,
        done: false,
        inkGroupEl: null
      };
    });
    document.getElementById('game-hint').textContent = '從每一行的箭頭開始，一行一行描完！';
  } else {
    var samples = buildTraceSamples(_trLevel, _trLevel.samples || 72);
    _trRows = [{
      samples: samples,
      covered: samples.map(function() { return false; }),
      color: null,
      done: false,
      inkGroupEl: null
    }];
    document.getElementById('game-hint').textContent = '從箭頭開始，順著虛線描出來！';
  }

  document.getElementById('game-title').textContent = _trLevel.title;
  renderTracing();
  showPage('game');
}

function _trUpdateStats() {
  var el = document.getElementById('game-progress');
  if (!el) return;
  if (_trRows.length > 1) {
    var doneCount = _trRows.filter(function(r) { return r.done; }).length;
    el.textContent = doneCount + ' / ' + _trRows.length + ' 行';
  } else {
    var row = _trRows[0];
    var doneN = row.covered.filter(Boolean).length;
    el.textContent = Math.round(doneN / row.covered.length * 100) + '%';
  }
}

function renderTracing() {
  var svg = document.getElementById('motor-svg');
  svg.innerHTML = '';
  svg.setAttribute('viewBox', '0 0 200 200');
  _trUpdateStats();

  _trRows.forEach(function(row, ri) {
    var samples = row.samples;

    var d = 'M ' + samples.map(function(p) { return p.x + ',' + p.y; }).join(' L ');
    var guide = document.createElementNS(SVGNS, 'path');
    guide.setAttribute('d', d);
    guide.setAttribute('class', 'trace-guide' + (row.done ? ' trace-row-done' : ''));
    svg.appendChild(guide);

    var glowGroup = document.createElementNS(SVGNS, 'g');
    svg.appendChild(glowGroup);
    samples.forEach(function(p, idx) {
      if (idx % 6 !== 0) return;
      var dot = document.createElementNS(SVGNS, 'circle');
      dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y); dot.setAttribute('r', 3.5);
      dot.setAttribute('class', 'trace-glow-dot' + (row.done ? ' lit' : ''));
      dot.setAttribute('data-row', ri);
      dot.setAttribute('data-idx', idx);
      glowGroup.appendChild(dot);
    });

    // 起點箭頭（純 SVG 三角形，不用 emoji — 不同裝置的字型對 SVG text 內 emoji 支援不穩定）
    var p0 = samples[0], p1 = samples[Math.min(4, samples.length - 1)];
    var angle = Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI;
    var arrow = document.createElementNS(SVGNS, 'polygon');
    arrow.setAttribute('points', '-7,-6 7,0 -7,6');
    arrow.setAttribute('class', 'trace-start-arrow' + (row.done ? ' trace-row-done' : ''));
    arrow.setAttribute('transform', 'translate(' + p0.x + ' ' + p0.y + ') rotate(' + angle + ')');
    svg.appendChild(arrow);

    // 終點標記（同心圓靶心）——封閉圖形（如三角形/正方形/星星）首尾是同一點，
    // 這時候不額外畫終點靶心，不然會跟起點箭頭疊在一起；封閉起來本身就是完成的訊號
    var pEnd = samples[samples.length - 1];
    if (dist(pEnd, p0) > 4) {
      var flagOuter = document.createElementNS(SVGNS, 'circle');
      flagOuter.setAttribute('cx', pEnd.x); flagOuter.setAttribute('cy', pEnd.y); flagOuter.setAttribute('r', 9);
      flagOuter.setAttribute('class', 'trace-end-flag-outer' + (row.done ? ' trace-row-done' : ''));
      svg.appendChild(flagOuter);
      var flagInner = document.createElementNS(SVGNS, 'circle');
      flagInner.setAttribute('cx', pEnd.x); flagInner.setAttribute('cy', pEnd.y); flagInner.setAttribute('r', 3.5);
      flagInner.setAttribute('class', 'trace-end-flag-inner' + (row.done ? ' trace-row-done' : ''));
      svg.appendChild(flagInner);
    }

    var inkGroup = document.createElementNS(SVGNS, 'g');
    if (row.color) inkGroup.style.setProperty('--row-color', row.color);
    svg.appendChild(inkGroup);
    row.inkGroupEl = inkGroup;
  });

  svg.onpointerdown   = _trPointerDown;
  svg.onpointermove   = _trPointerMove;
  svg.onpointerup     = _trPointerUp;
  svg.onpointercancel = _trPointerUp;
}

function _trNearestSample(samples, pt) {
  var best = 0, bestDist = Infinity;
  samples.forEach(function(p, idx) {
    var d = dist(pt, p);
    if (d < bestDist) { bestDist = d; best = idx; }
  });
  return { idx: best, dist: bestDist };
}

function _trPointerDown(e) {
  var svg = document.getElementById('motor-svg');
  var pt = svgPointFromEvent(svg, e);

  var best = -1, bestDist = TR_START_TOL;
  _trRows.forEach(function(row, ri) {
    if (row.done) return;
    var d = dist(pt, row.samples[0]);
    if (d < bestDist) { bestDist = d; best = ri; }
  });
  if (best === -1) {
    showToast(_trRows.length > 1 ? '請從某一行的箭頭開始喔！' : '請從箭頭 ➤ 的地方開始喔！');
    return;
  }
  e.preventDefault();

  _trActiveRow = best;
  _trDragging  = true;
  var row = _trRows[best];
  row.covered = row.samples.map(function() { return false; });
  row.inkGroupEl.innerHTML = '';
  _trCurSeg = null;
  _trMarkCovered(best, 0);
  _trAppendInkPoint(pt, true);
  try { svg.setPointerCapture(e.pointerId); } catch(err) {}
}

function _trPointerMove(e) {
  if (!_trDragging) return;
  var svg = document.getElementById('motor-svg');
  var pt = svgPointFromEvent(svg, e);
  var row = _trRows[_trActiveRow];
  var near = _trNearestSample(row.samples, pt);
  var onTrack = near.dist <= TR_TOLERANCE;
  if (onTrack) _trMarkCovered(_trActiveRow, near.idx);
  _trAppendInkPoint(pt, onTrack);
  _trUpdateRowProgressGlow();
}

function _trPointerUp(e) {
  if (!_trDragging) return;
  _trDragging = false;
  var ri  = _trActiveRow;
  _trActiveRow = -1;
  var row = _trRows[ri];

  var doneCount = row.covered.filter(Boolean).length;
  var pct = doneCount / row.covered.length;
  var reachedEnd = row.covered.slice(-TR_END_SAMPLES).indexOf(true) !== -1;

  if (pct >= TR_PASS_RATIO && reachedEnd) {
    row.done = true;
    renderTracing(); // 重繪成「已完成」樣式（虛線/發光點/箭頭都變暗），順便清掉其他行未完成的墨水線
    var allDone = _trRows.every(function(r) { return r.done; });
    if (allDone) {
      addStar('tracing', _trLevel.id);
      showResult(true, _trLevel.title, 'tracing');
    } else {
      showToast('✨ 這行完成了！繼續下一行～');
    }
  } else if (_trRows.length > 1) {
    showToast('再描一次這行看看！');
  } else {
    showResult(false, _trLevel.title, 'tracing');
  }
}

function _trMarkCovered(ri, idx) {
  var row = _trRows[ri];
  for (var k = Math.max(0, idx - 1); k <= Math.min(row.covered.length - 1, idx + 1); k++) {
    row.covered[k] = true;
  }
  var nearestGlowIdx = Math.round(idx / 6) * 6;
  var glowDot = document.querySelector('.trace-glow-dot[data-row="' + ri + '"][data-idx="' + nearestGlowIdx + '"]');
  if (glowDot) glowDot.classList.add('lit');
}

function _trUpdateRowProgressGlow() {
  var row = _trRows[_trActiveRow];
  var doneN = row.covered.filter(Boolean).length;
  if (_trRows.length === 1) {
    var el = document.getElementById('game-progress');
    if (el) el.textContent = Math.round(doneN / row.covered.length * 100) + '%';
  }
}

function _trAppendInkPoint(pt, onTrack) {
  var row = _trRows[_trActiveRow];
  if (!_trCurSeg || _trCurSeg.onTrack !== onTrack) {
    var el = document.createElementNS(SVGNS, 'path');
    el.setAttribute('class', 'trace-ink ' + (onTrack ? 'trace-ink-on' : 'trace-ink-off'));
    row.inkGroupEl.appendChild(el);
    var startPt = _trCurSeg ? _trCurSeg.pts[_trCurSeg.pts.length - 1] : pt;
    _trCurSeg = { onTrack: onTrack, el: el, pts: [startPt] };
  }
  _trCurSeg.pts.push(pt);
  _trCurSeg.el.setAttribute('d', 'M ' + _trCurSeg.pts.map(function(p) { return p.x + ',' + p.y; }).join(' L '));
}
