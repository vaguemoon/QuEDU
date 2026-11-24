'use strict';

/* ════════════════════════════════════════
   角與三角形：角的分類（angle）、三角形的分類（triangle）
   看圖選「銳角／直角／鈍角」，可以用三角板（直角）比比看；
   答完在每個角標上 銳／直／鈍（比照課本把角的種類貼上記號）
   ════════════════════════════════════════ */

var ANG_KINDS = ['acute', 'right', 'obtuse'];
var ANG_NAME  = { acute: '銳角', right: '直角', obtuse: '鈍角' };
var ANG_SHORT = { acute: '銳', right: '直', obtuse: '鈍' };
var ANG_W = 400, ANG_H = 320, ANG_PAD = 34;
var _SVG_NS_ANG = 'http://www.w3.org/2000/svg';

var angAnswered = false;
var _angTimer = null;

function isAngleModule(mod) { return mod === 'angle' || mod === 'triangle' || mod === 'side'; }

function _angKind(deg) { return deg < 90 ? 'acute' : deg === 90 ? 'right' : 'obtuse'; }
function _dir(deg) { var r = deg * Math.PI / 180; return { x: Math.cos(r), y: Math.sin(r) }; }  /* 數學座標（y 向上） */
function _norm(v) { var l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; }

/* ── 出題：三種各占三分之一，相鄰兩題不出同一種圖形方向 ── */

function _angPickKinds(n) {
  var out = [];
  while (out.length < n) out = out.concat(shuffle(ANG_KINDS));
  return out.slice(0, n);
}

function _makeAngleQ(kind) {
  /* 角度離 90 度至少 15 度，用眼睛加三角板就分得出來 */
  var deg = kind === 'right' ? 90 : kind === 'acute' ? _ri(4, 15) * 5 : _ri(21, 32) * 5;
  var rot = _ri(0, 359);
  var V = { x: 0, y: 0 };
  var l1 = 1, l2 = 0.8 + Math.random() * 0.25;
  if (Math.random() < 0.5) { var t = l1; l1 = l2; l2 = t; }
  var d1 = _dir(rot), d2 = _dir(rot + deg);
  var P1 = { x: d1.x * l1, y: d1.y * l1 }, P2 = { x: d2.x * l2, y: d2.y * l2 };
  /* 三角板：直角頂點放在角的頂點，一邊貼著第一條邊 */
  var leg = Math.min(l1, 0.8), dp = _dir(rot + 90);
  var ruler = [V, { x: d1.x * leg, y: d1.y * leg }, { x: dp.x * leg * 0.75, y: dp.y * leg * 0.75 }];
  return { module: 'angle', kind: kind, deg: deg, V: V, P1: P1, P2: P2, ruler: ruler };
}

function _makeTriangleQ(kind) {
  var A, B, C;
  if (kind === 'right') {
    A = 90; B = _ri(5, 13) * 5; C = 90 - B;                       /* 另外兩角 25～65 */
  } else if (kind === 'obtuse') {
    A = _ri(21, 30) * 5; B = _ri(3, Math.floor((180 - A - 15) / 5)) * 5; C = 180 - A - B;
  } else {
    do { A = _ri(8, 15) * 5; B = _ri(8, 15) * 5; C = 180 - A - B; }  /* 三個角都在 40～75 */
    while (C < 40 || C > 75);
  }
  var angs = shuffle([A, B, C]);
  /* P0 在原點、P1 在 (1,0)，用正弦定理找 P2 */
  var a0 = angs[0], a1 = angs[1], a2 = angs[2];
  var s = Math.sin(a1 * Math.PI / 180) / Math.sin(a2 * Math.PI / 180);
  var pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: Math.cos(a0 * Math.PI / 180) * s, y: Math.sin(a0 * Math.PI / 180) * s }];
  var rot = _ri(0, 359) * Math.PI / 180, c = Math.cos(rot), sn = Math.sin(rot);
  pts = pts.map(function(p) { return { x: p.x * c - p.y * sn, y: p.x * sn + p.y * c }; });
  var maxI = angs.indexOf(Math.max(a0, a1, a2));
  var V = pts[maxI], U = pts[(maxI + 1) % 3], W = pts[(maxI + 2) % 3];
  var d1 = _norm({ x: U.x - V.x, y: U.y - V.y });
  var dp = { x: -d1.y, y: d1.x };
  if (dp.x * (W.x - V.x) + dp.y * (W.y - V.y) < 0) dp = { x: -dp.x, y: -dp.y };
  var leg = Math.min(Math.hypot(U.x - V.x, U.y - V.y), 0.7);
  var ruler = [V, { x: V.x + d1.x * leg, y: V.y + d1.y * leg }, { x: V.x + dp.x * leg * 0.75, y: V.y + dp.y * leg * 0.75 }];
  return { module: 'triangle', kind: kind, pts: pts, angs: angs, maxI: maxI, ruler: ruler };
}

function generateAnglePool(mod) {
  return _angPickKinds(ROUND_SIZE).map(function(k) {
    return mod === 'angle' ? _makeAngleQ(k) : _makeTriangleQ(k);
  });
}

/* ── 遊戲流程 ── */

function angStart() {
  gamePool    = currentModule === 'side' ? generateSidePool(currentShape) : generateAnglePool(currentModule);
  gamePoolIdx = 0;
  gameCorrect = 0;
  gameTotal   = 0;
  PAGE_CONFIG.angle.title = currentModule === 'angle' ? '∠ <span>角的分類</span>'
    : currentModule === 'side' ? '△ <span>' + SIDE_ASK[currentShape] + '</span>' : '△ <span>三角形的分類</span>';
  showPage('angle');
  angLoad();
}

function angLoad() {
  clearTimeout(_angTimer);
  if (currentPage !== 'angle') return;   /* 自動下一題的計時器到時，學生已經按「結束練習」離開 */
  if (gamePoolIdx >= gamePool.length) { showResult(); return; }
  gameQ = gamePool[gamePoolIdx];
  angAnswered = false;
  _hintUsed = false;
  var isSide = gameQ.module === 'side';
  document.getElementById('ang-svg').classList.toggle('hidden', isSide);
  document.getElementById('side-grid').classList.toggle('hidden', !isSide);
  if (isSide) { sideLoad(); return; }
  var isTri = gameQ.module === 'triangle';
  document.getElementById('ang-prompt').textContent = isTri
    ? '這是什麼三角形？' : '這個角是銳角、直角，還是鈍角？';
  document.getElementById('ang-choices').innerHTML = ANG_KINDS.map(function(k) {
    return '<button class="ang-choice ang-choice--' + k + '" data-k="' + k + '" onclick="angChoose(\'' + k + '\')">' +
      ANG_NAME[k] + (isTri ? '三角形' : '') + '</button>';
  }).join('');
  _angMsg('', '');
  document.getElementById('ang-hint').classList.remove('hidden');
  document.getElementById('ang-next').classList.add('hidden');
  _angStats();
  angDraw(false, false);
}

function _angStats() {
  document.getElementById('ang-qnum').textContent = Math.min(gamePoolIdx + 1, gamePool.length);
  document.getElementById('ang-correct').textContent = gameCorrect;
  document.getElementById('ang-remain').textContent = gamePool.length - gamePoolIdx;
}

function _angMsg(html, cls) {
  var el = document.getElementById('ang-msg');
  el.innerHTML = html;
  el.className = 'ang-msg' + (cls ? ' ' + cls : '');
}

function angHint() {
  if (!gameQ || angAnswered) return;
  sfxTap();
  _hintUsed = true;
  angDraw(true, false);
  _angMsg(gameQ.module === 'triangle'
    ? '先找出<b>最大的角</b>，用三角板的直角比比看。'
    : '用三角板的直角比比看：另一條邊在三角板<b>裡面</b>、<b>剛好貼齊</b>，還是在<b>外面</b>？', 'ang-msg--hint');
}

function angChoose(k) {
  if (!gameQ || angAnswered) return;
  angAnswered = true;
  gameTotal++;
  var ok = k === gameQ.kind;
  document.querySelectorAll('#ang-choices .ang-choice').forEach(function(b) {
    b.disabled = true;
    if (b.dataset.k === gameQ.kind) b.classList.add('is-correct');
    else if (b.dataset.k === k) b.classList.add('is-wrong');
  });
  document.getElementById('ang-hint').classList.add('hidden');
  angDraw(!ok || _hintUsed, true);
  if (ok && !_hintUsed) {
    gameCorrect++;
    sfxCorrect();
    _angMsg('答對了！' + _angExplain(), 'ang-msg--ok');
  } else if (ok) {
    _angMsg('答案正確，但已看提示，不計分。' + _angExplain(), 'ang-msg--ok');
  } else {
    sfxWrong();
    _angMsg('答案是<b>' + ANG_NAME[gameQ.kind] + (gameQ.module === 'triangle' ? '三角形' : '') + '</b>。' + _angExplain(), 'ang-msg--wrong');
  }
  _angStats();
  gamePoolIdx++;
  /* 答對自動下一題；答錯留著圖和說明，讓學生看完自己按下一題 */
  if (ok) _angTimer = setTimeout(angLoad, _hintUsed ? 2200 : 1600);
  else document.getElementById('ang-next').classList.remove('hidden');
}

function angNext() { sfxTap(); angLoad(); }

function _angExplain() {
  var q = gameQ;
  if (q.module === 'angle') {
    return '<br>' + (q.kind === 'acute' ? '這個角比直角<b>小</b>，所以是銳角。'
      : q.kind === 'right' ? '這個角和三角板的直角<b>一樣大</b>，所以是直角。'
      : '這個角比直角<b>大</b>，所以是鈍角。');
  }
  return '<br>' + (q.kind === 'acute' ? '三個角<b>都是銳角</b>，所以是銳角三角形。'
    : q.kind === 'right' ? '最大的角是<b>直角</b>，所以是直角三角形。'
    : '最大的角是<b>鈍角</b>，所以是鈍角三角形。');
}

/* ── 繪圖 ── */

/* 把題目的點（數學座標）縮放置中到 SVG；三角板的點也算進去，按提示時圖形才不會跳動 */
function _angFit(points) {
  var xs = points.map(function(p) { return p.x; }), ys = points.map(function(p) { return p.y; });
  var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
  var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
  var sc = Math.min((ANG_W - 2 * ANG_PAD) / Math.max(maxX - minX, 0.01), (ANG_H - 2 * ANG_PAD) / Math.max(maxY - minY, 0.01));
  var ox = (ANG_W - (maxX - minX) * sc) / 2, oy = (ANG_H - (maxY - minY) * sc) / 2;
  return function(p) { return { x: ox + (p.x - minX) * sc, y: oy + (maxY - p.y) * sc }; };
}

function _el(tag, attrs, parent) {
  var e = document.createElementNS(_SVG_NS_ANG, tag);
  Object.keys(attrs).forEach(function(k) { e.setAttribute(k, attrs[k]); });
  if (parent) parent.appendChild(e);
  return e;
}

function _pt(p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }

/* 角的記號：在頂點沿角平分線放一個圓圈，寫 銳／直／鈍 */
function _angLabel(svg, V, A, B, kind) {
  var a = _norm({ x: A.x - V.x, y: A.y - V.y }), b = _norm({ x: B.x - V.x, y: B.y - V.y });
  var bis = _norm({ x: a.x + b.x, y: a.y + b.y });
  /* 角越尖，圓圈要放越裡面才不會壓到兩條邊；但不超過較短那條邊的一半 */
  var half = Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y))) / 2;
  var room = 0.5 * Math.min(Math.hypot(A.x - V.x, A.y - V.y), Math.hypot(B.x - V.x, B.y - V.y));
  var d = Math.min(Math.max(kind === 'right' ? 44 : 30, 17 / Math.sin(half)), room);
  var c = { x: V.x + bis.x * d, y: V.y + bis.y * d };
  _el('circle', { cx: c.x, cy: c.y, r: 14, 'class': 'ang-tag ang-tag--' + kind }, svg);
  var t = _el('text', { x: c.x, y: c.y + 5, 'class': 'ang-tag-txt' }, svg);
  t.textContent = ANG_SHORT[kind];
}

/* 直角記號（小方塊） */
function _rightMark(svg, V, A, B) {
  var a = _norm({ x: A.x - V.x, y: A.y - V.y }), b = _norm({ x: B.x - V.x, y: B.y - V.y }), s = 16;
  _el('polyline', { points: [
    _pt({ x: V.x + a.x * s, y: V.y + a.y * s }),
    _pt({ x: V.x + a.x * s + b.x * s, y: V.y + a.y * s + b.y * s }),
    _pt({ x: V.x + b.x * s, y: V.y + b.y * s })].join(' '), 'class': 'ang-rmark' }, svg);
}

function angDraw(showRuler, reveal) {
  var q = gameQ, svg = document.getElementById('ang-svg');
  if (!q || !svg) return;
  svg.innerHTML = '';
  var all = q.module === 'angle' ? [q.V, q.P1, q.P2] : q.pts.slice();
  var f = _angFit(all.concat(q.ruler));
  var R = q.ruler.map(f);

  if (showRuler) {
    _el('polygon', { points: R.map(_pt).join(' '), 'class': 'ang-ruler' }, svg);
    _rightMark(svg, R[0], R[1], R[2]);
  }

  if (q.module === 'angle') {
    var V = f(q.V), P1 = f(q.P1), P2 = f(q.P2);
    /* 圓弧標出是哪一個角（直角也畫圓弧，不畫方塊，免得直接看出答案） */
    var r = 30, a = _norm({ x: P1.x - V.x, y: P1.y - V.y }), b = _norm({ x: P2.x - V.x, y: P2.y - V.y });
    if (!reveal || q.kind !== 'right') {
      _el('path', { d: 'M' + _pt({ x: V.x + a.x * r, y: V.y + a.y * r }) + ' A' + r + ' ' + r + ' 0 0 0 ' +
        _pt({ x: V.x + b.x * r, y: V.y + b.y * r }), 'class': 'ang-arc' }, svg);
    }
    _el('polyline', { points: [P1, V, P2].map(_pt).join(' '), 'class': 'ang-line' }, svg);
    _el('circle', { cx: V.x, cy: V.y, r: 4, 'class': 'ang-dot' }, svg);
    if (reveal) {
      if (q.kind === 'right') _rightMark(svg, V, P1, P2);
      _angLabel(svg, V, P1, P2, q.kind);
    }
    return;
  }

  var P = q.pts.map(f);
  _el('polygon', { points: P.map(_pt).join(' '), 'class': 'ang-tri' }, svg);
  if (reveal) {
    P.forEach(function(V, i) {
      var A = P[(i + 1) % 3], B = P[(i + 2) % 3], k = _angKind(q.angs[i]);
      if (k === 'right') _rightMark(svg, V, A, B);
      _angLabel(svg, V, A, B, k);
    });
  }
}
