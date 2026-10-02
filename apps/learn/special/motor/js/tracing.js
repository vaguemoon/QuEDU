'use strict';

var _trLevel    = null;
var _trSamples  = [];
var _trCovered  = [];
var _trDragging = false;
var _trInkGroup = null;
var _trCurSeg   = null; // { onTrack, el, pts }
var TR_TOLERANCE  = 16;
var TR_START_TOL  = 30;
var TR_PASS_RATIO = 0.7;

function openTracing(levelIdx) {
  currentModule   = 'tracing';
  currentLevelIdx = levelIdx;
  _trLevel   = TRACING_LEVELS[levelIdx];
  _trSamples = buildTraceSamples(_trLevel, _trLevel.samples || 72);
  _trCovered = _trSamples.map(function() { return false; });
  document.getElementById('game-title').textContent = _trLevel.title;
  document.getElementById('game-hint').textContent = '從箭頭開始，順著虛線描出來！';
  renderTracing();
  showPage('game');
}

function _trUpdateStats() {
  var done = _trCovered.filter(Boolean).length;
  var pct = Math.round(done / _trCovered.length * 100);
  var el = document.getElementById('game-progress');
  if (el) el.textContent = pct + '%';
}

function renderTracing() {
  var svg = document.getElementById('motor-svg');
  svg.innerHTML = '';
  svg.setAttribute('viewBox', '0 0 200 200');
  _trUpdateStats();

  var d = 'M ' + _trSamples.map(function(p) { return p.x + ',' + p.y; }).join(' L ');

  var guide = document.createElementNS(SVGNS, 'path');
  guide.setAttribute('d', d);
  guide.setAttribute('class', 'trace-guide');
  svg.appendChild(guide);

  // 追蹤發光點（每隔幾個取樣點放一個小圓點，描到時會亮起來）
  var glowGroup = document.createElementNS(SVGNS, 'g');
  glowGroup.id = 'trace-glow-group';
  svg.appendChild(glowGroup);
  _trSamples.forEach(function(p, idx) {
    if (idx % 6 !== 0) return;
    var dot = document.createElementNS(SVGNS, 'circle');
    dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y); dot.setAttribute('r', 3.5);
    dot.setAttribute('class', 'trace-glow-dot');
    dot.setAttribute('data-idx', idx);
    glowGroup.appendChild(dot);
  });

  // 起點箭頭（純 SVG 三角形，不用 emoji — 不同裝置的字型對 SVG text 內 emoji 支援不穩定）
  var p0 = _trSamples[0], p1 = _trSamples[Math.min(4, _trSamples.length - 1)];
  var angle = Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI;
  var arrow = document.createElementNS(SVGNS, 'polygon');
  arrow.setAttribute('points', '-7,-6 7,0 -7,6');
  arrow.setAttribute('class', 'trace-start-arrow');
  arrow.setAttribute('transform', 'translate(' + p0.x + ' ' + p0.y + ') rotate(' + angle + ')');
  svg.appendChild(arrow);

  // 終點標記（同心圓靶心）——封閉圖形（如三角形/正方形/星星）首尾是同一點，
  // 這時候不額外畫終點靶心，不然會跟起點箭頭疊在一起；封閉起來本身就是完成的訊號
  var pEnd = _trSamples[_trSamples.length - 1];
  if (dist(pEnd, p0) > 4) {
    var flagOuter = document.createElementNS(SVGNS, 'circle');
    flagOuter.setAttribute('cx', pEnd.x); flagOuter.setAttribute('cy', pEnd.y); flagOuter.setAttribute('r', 9);
    flagOuter.setAttribute('class', 'trace-end-flag-outer');
    svg.appendChild(flagOuter);
    var flagInner = document.createElementNS(SVGNS, 'circle');
    flagInner.setAttribute('cx', pEnd.x); flagInner.setAttribute('cy', pEnd.y); flagInner.setAttribute('r', 3.5);
    flagInner.setAttribute('class', 'trace-end-flag-inner');
    svg.appendChild(flagInner);
  }

  _trInkGroup = document.createElementNS(SVGNS, 'g');
  _trInkGroup.id = 'trace-ink-group';
  svg.appendChild(_trInkGroup);

  svg.onpointerdown = _trPointerDown;
  svg.onpointermove = _trPointerMove;
  svg.onpointerup   = _trPointerUp;
  svg.onpointercancel = _trPointerUp;
}

function _trNearestSample(pt) {
  var best = 0, bestDist = Infinity;
  _trSamples.forEach(function(p, idx) {
    var d = dist(pt, p);
    if (d < bestDist) { bestDist = d; best = idx; }
  });
  return { idx: best, dist: bestDist };
}

function _trPointerDown(e) {
  var svg = document.getElementById('motor-svg');
  var pt = svgPointFromEvent(svg, e);
  if (dist(pt, _trSamples[0]) > TR_START_TOL) {
    showToast('請從箭頭 ➤ 的地方開始喔！');
    return;
  }
  _trDragging = true;
  _trCovered = _trSamples.map(function() { return false; });
  _trInkGroup.innerHTML = '';
  _trCurSeg = null;
  _trMarkCovered(0);
  _trAppendInkPoint(pt, true);
  try { svg.setPointerCapture(e.pointerId); } catch(err) {}
}

function _trPointerMove(e) {
  if (!_trDragging) return;
  var svg = document.getElementById('motor-svg');
  var pt = svgPointFromEvent(svg, e);
  var near = _trNearestSample(pt);
  var onTrack = near.dist <= TR_TOLERANCE;
  if (onTrack) _trMarkCovered(near.idx);
  _trAppendInkPoint(pt, onTrack);
  _trUpdateStats();
}

function _trPointerUp(e) {
  if (!_trDragging) return;
  _trDragging = false;
  var doneCount = _trCovered.filter(Boolean).length;
  var pct = doneCount / _trCovered.length;
  if (pct >= TR_PASS_RATIO) {
    addStar('tracing', _trLevel.id);
    showResult(true, _trLevel.title, 'tracing');
  } else {
    showResult(false, _trLevel.title, 'tracing');
  }
}

function _trMarkCovered(idx) {
  for (var k = Math.max(0, idx - 1); k <= Math.min(_trCovered.length - 1, idx + 1); k++) {
    _trCovered[k] = true;
  }
  var nearestGlowIdx = Math.round(idx / 6) * 6;
  var glowDot = document.querySelector('#trace-glow-group [data-idx="' + nearestGlowIdx + '"]');
  if (glowDot) glowDot.classList.add('lit');
}

function _trAppendInkPoint(pt, onTrack) {
  if (!_trCurSeg || _trCurSeg.onTrack !== onTrack) {
    var el = document.createElementNS(SVGNS, 'path');
    el.setAttribute('class', 'trace-ink ' + (onTrack ? 'trace-ink-on' : 'trace-ink-off'));
    _trInkGroup.appendChild(el);
    var startPt = _trCurSeg ? _trCurSeg.pts[_trCurSeg.pts.length - 1] : pt;
    _trCurSeg = { onTrack: onTrack, el: el, pts: [startPt] };
  }
  _trCurSeg.pts.push(pt);
  _trCurSeg.el.setAttribute('d', 'M ' + _trCurSeg.pts.map(function(p) { return p.x + ',' + p.y; }).join(' L '));
}
