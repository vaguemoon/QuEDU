'use strict';

var SVGNS = 'http://www.w3.org/2000/svg';

var _d2dLevel      = null;
var _d2dProgress   = 0;      // 已完成的邊數（0 ~ N-1）
var _d2dDragFrom   = -1;     // 拖曳起點的 point index
var _d2dRubberLine = null;
var _d2dLastPt     = null;   // 最後一次 pointermove 的座標（pointercancel 事件座標不可信，需用這個備援）

function openDot2Dot(levelIdx) {
  currentModule   = 'dot2dot';
  currentLevelIdx = levelIdx;
  _d2dLevel    = DOT2DOT_LEVELS[levelIdx];
  _d2dProgress = 0;
  document.getElementById('game-title').textContent = _d2dLevel.title;
  document.getElementById('game-hint').textContent = '把數字 1 拖到 2、2 拖到 3⋯依序連起來！';
  renderDot2Dot();
  showPage('game');
}

function _d2dUpdateStats() {
  var el = document.getElementById('game-progress');
  if (el) el.textContent = _d2dProgress + ' / ' + _d2dLevel.points.length;
}

function renderDot2Dot() {
  var svg = document.getElementById('motor-svg');
  svg.innerHTML = '';
  svg.setAttribute('viewBox', '0 0 200 200');
  _d2dUpdateStats();

  var pts = _d2dLevel.points;
  var labels = _d2dLevel.labels;

  // 已完成的線段
  var lineGroup = document.createElementNS(SVGNS, 'g');
  lineGroup.id = 'd2d-line-group';
  svg.appendChild(lineGroup);
  for (var i = 0; i < _d2dProgress; i++) {
    _d2dDrawSegment(pts[i], pts[i + 1], false);
  }

  // 橡皮筋線（拖曳用）
  _d2dRubberLine = document.createElementNS(SVGNS, 'line');
  _d2dRubberLine.setAttribute('class', 'd2d-rubber');
  _d2dRubberLine.style.display = 'none';
  svg.appendChild(_d2dRubberLine);

  // 點
  var dotGroup = document.createElementNS(SVGNS, 'g');
  dotGroup.id = 'd2d-dot-group';
  svg.appendChild(dotGroup);
  pts.forEach(function(p, idx) {
    var g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', 'd2d-dot' + (idx < _d2dProgress ? ' done' : ''));
    g.setAttribute('data-idx', idx);

    var c = document.createElementNS(SVGNS, 'circle');
    c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', 11);
    g.appendChild(c);

    var t = document.createElementNS(SVGNS, 'text');
    t.setAttribute('x', p.x); t.setAttribute('y', p.y);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('dominant-baseline', 'central');
    t.textContent = labels ? labels[idx] : (idx + 1);
    g.appendChild(t);

    dotGroup.appendChild(g);
  });

  svg.onpointerdown   = _d2dPointerDown;
  svg.onpointermove   = _d2dPointerMove;
  svg.onpointerup     = _d2dPointerUp;
  svg.onpointercancel = _d2dPointerUp;
}

function _d2dDrawSegment(p1, p2, animate) {
  var group = document.getElementById('d2d-line-group');
  var line = document.createElementNS(SVGNS, 'line');
  line.setAttribute('x1', p1.x); line.setAttribute('y1', p1.y);
  line.setAttribute('x2', p2.x); line.setAttribute('y2', p2.y);
  line.setAttribute('class', 'd2d-line-done' + (animate ? ' d2d-line-new' : ''));
  group.appendChild(line);
}

function _d2dNearestDot(pt, excludeIdx) {
  var pts = _d2dLevel.points;
  var best = -1, bestDist = 28; // 抓取/放開的容許半徑
  pts.forEach(function(p, idx) {
    if (idx === excludeIdx) return;
    var d = dist(pt, p);
    if (d < bestDist) { bestDist = d; best = idx; }
  });
  return best;
}

function _d2dPointerDown(e) {
  var svg = document.getElementById('motor-svg');
  var pt = svgPointFromEvent(svg, e);
  var idx = _d2dNearestDot(pt, -1);
  if (idx === -1) return;
  e.preventDefault(); // 沒加這行，桌機滑鼠會觸發瀏覽器原生拖曳 SVG <text> 內容，而不是我們自己的拖線邏輯
  _d2dDragFrom = idx;
  _d2dLastPt = pt;
  var p = _d2dLevel.points[idx];
  _d2dRubberLine.setAttribute('x1', p.x); _d2dRubberLine.setAttribute('y1', p.y);
  _d2dRubberLine.setAttribute('x2', p.x); _d2dRubberLine.setAttribute('y2', p.y);
  _d2dRubberLine.style.display = '';
  try { svg.setPointerCapture(e.pointerId); } catch(err) {}
}

function _d2dPointerMove(e) {
  if (_d2dDragFrom === -1) return;
  var svg = document.getElementById('motor-svg');
  var pt = svgPointFromEvent(svg, e);
  _d2dLastPt = pt;
  _d2dRubberLine.setAttribute('x2', pt.x);
  _d2dRubberLine.setAttribute('y2', pt.y);
}

function _d2dPointerUp(e) {
  if (_d2dDragFrom === -1) return;
  var svg = document.getElementById('motor-svg');
  // pointercancel 事件座標不可信（規格上允許為 0,0），改用最後一次 move 的座標判斷
  var pt = (e.type === 'pointercancel' && _d2dLastPt) ? _d2dLastPt : svgPointFromEvent(svg, e);
  var toIdx = _d2dNearestDot(pt, _d2dDragFrom);
  var fromIdx = _d2dDragFrom;
  _d2dDragFrom = -1;
  _d2dRubberLine.style.display = 'none';

  if (toIdx === -1) return; // 沒放到點上，直接取消

  var need = [_d2dProgress, _d2dProgress + 1];
  var got  = [fromIdx, toIdx].sort(function(a, b) { return a - b; });

  if (got[0] === need[0] && got[1] === need[1] && _d2dProgress < _d2dLevel.points.length - 1) {
    _d2dOnCorrectEdge();
  } else {
    _d2dOnWrongEdge();
  }
}

function _d2dOnCorrectEdge() {
  var pts = _d2dLevel.points;
  _d2dDrawSegment(pts[_d2dProgress], pts[_d2dProgress + 1], true);
  _d2dProgress++;
  _d2dUpdateStats();
  showToast('✨ 接對了！');

  document.querySelectorAll('#d2d-dot-group .d2d-dot').forEach(function(g) {
    var idx = Number(g.getAttribute('data-idx'));
    g.classList.toggle('done', idx <= _d2dProgress);
  });

  if (_d2dProgress === pts.length - 1) {
    setTimeout(function() {
      _d2dDrawSegment(pts[pts.length - 1], pts[0], true); // 收尾連回第一點
      setTimeout(_d2dOnComplete, 500);
    }, 300);
  }
}

function _d2dOnWrongEdge() {
  if (navigator.vibrate) { try { navigator.vibrate(80); } catch(e) {} }
  showToast('再試試看，從數字 ' + (_d2dProgress + 1) + ' 接到 ' + (_d2dProgress + 2) + ' 哦！');
}

function _d2dOnComplete() {
  addStar('dot2dot', _d2dLevel.id);
  showResult(true, _d2dLevel.title, 'dot2dot');
}
