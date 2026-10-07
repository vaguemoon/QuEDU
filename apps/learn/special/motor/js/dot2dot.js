'use strict';

var SVGNS = 'http://www.w3.org/2000/svg';

var _d2dLevel      = null;
var _d2dMode       = null;   // 這一次玩到的出題方式（'zhuyin' 或 'number'），開關卡時決定一次、全程不變
var _d2dLabels     = null;   // 這一次玩到的標籤（每次開關卡都重新隨機產生，見 dot2dot-data.js）
var _d2dProgress   = 0;      // 已完成的邊數（0 ~ N-1）
var _d2dDragFrom   = -1;     // 拖曳起點的 point index
var _d2dRubberLine = null;
var _d2dLastPt     = null;   // 最後一次 pointermove 的座標（pointercancel 事件座標不可信，需用這個備援）

function openDot2Dot(levelIdx) {
  currentModule   = 'dot2dot';
  currentLevelIdx = levelIdx;
  _d2dLevel    = DOT2DOT_LEVELS[levelIdx];
  _d2dMode     = _d2dPickMode(_d2dLevel);
  _d2dLabels   = generateDot2DotLabels(_d2dLevel, _d2dMode);
  _d2dProgress = 0;
  document.getElementById('game-title').textContent = _d2dLevel.title;
  document.getElementById('game-hint').textContent = _d2dMode === 'zhuyin'
    ? '從綠色「起點」開始，照注音順序一個接一個連起來！'
    : '從綠色「起點」開始，數字一個接一個連起來！（不一定從 1 開始喔）';
  showSandbox('motor-sandbox');
  renderDot2Dot();
  showPage('game');
  setTimeout(function() {
    speakDotLabel(_d2dLabels[0], _d2dMode === 'zhuyin');
  }, 400); // 等畫面切換動畫跑完再唸，不然聲音會卡在轉場中間
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
  var labels = _d2dLabels;

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
    // 起點標示：不能只靠數字/注音符號本身暗示「這是第一個」（例如注音關卡不一定從 ㄅ 開始），
    // 所以第一個點在還沒連出去之前，一律用顏色＋「起點」字樣明確標出來
    var isStart = (idx === 0 && _d2dProgress === 0);
    var g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', 'd2d-dot' + (idx < _d2dProgress ? ' done' : '') + (isStart ? ' d2d-dot-start' : ''));
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

    if (isStart) {
      var tagBelow = p.y < 40; // 點太靠近畫布上緣時，字牌改標在下面，避免被裁掉
      var tag = document.createElementNS(SVGNS, 'text');
      tag.setAttribute('x', p.x); tag.setAttribute('y', tagBelow ? p.y + 26 : p.y - 18);
      tag.setAttribute('text-anchor', 'middle');
      tag.setAttribute('class', 'd2d-start-tag');
      tag.textContent = tagBelow ? '起點 ▲' : '▼ 起點';
      g.appendChild(tag);
    }

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
  sfxCorrect();
  showToast('✨ 接對了！');
  setTimeout(function() {
    speakDotLabel(_d2dLabels[_d2dProgress], _d2dMode === 'zhuyin');
  }, 180); // 讓短音效先播完，唸出來的符號/數字才不會被蓋過去

  document.querySelectorAll('#d2d-dot-group .d2d-dot').forEach(function(g) {
    var idx = Number(g.getAttribute('data-idx'));
    g.classList.toggle('done', idx <= _d2dProgress);
    if (idx === 0) {
      // 第一段連出去之後，起點標示就沒用了（而且會疊在已變暗的點上很奇怪），拿掉
      g.classList.remove('d2d-dot-start');
      var tag = g.querySelector('.d2d-start-tag');
      if (tag) tag.remove();
    }
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
  sfxWrong();
  // 原本這裡寫死「數字」+索引號，注音關卡會唸/顯示錯——改用這次實際產生的標籤
  showToast('再試試看，從 ' + _d2dLabels[_d2dProgress] + ' 接到 ' + _d2dLabels[_d2dProgress + 1] + ' 哦！');
}

function _d2dOnComplete() {
  addStar('dot2dot', _d2dLevel.id);
  showResult(_d2dLevel.title, 'dot2dot');
}
