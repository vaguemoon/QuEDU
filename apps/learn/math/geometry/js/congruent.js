'use strict';

/* ════════════════════════════════════════
   全等圖形（congruent）：找對應點、對應邊、對應角
   比照課本：甲、乙兩個全等三角形，乙是甲轉過（有時翻過）再移開的，
   問「點 B 的對應點是點＿」「DF 的對應邊是＿」「∠E 是幾度」等；
   提示「把甲疊上去看看」＝甲的分身轉一轉、翻一翻，疊到乙上面
   ════════════════════════════════════════ */

var CONG_MODES = ['point', 'side', 'angle', 'mix'];
var CONG_MODE_NAME = { point: '對應點', side: '對應邊', angle: '對應角', mix: '綜合練習' };
var CONG_MODE_ICON = {
  point: '<svg viewBox="0 0 40 36"><polygon points="5,31 35,31 13,5"/><circle cx="13" cy="5" r="3.5"/></svg>',
  side:  '<svg viewBox="0 0 40 36"><polygon points="5,31 35,31 13,5"/><line x1="5" y1="31" x2="35" y2="31"/></svg>',
  angle: '<svg viewBox="0 0 40 36"><polygon points="5,31 35,31 13,5"/><path d="M15,31 A10,10 0 0 0 9.6,22"/></svg>',
  mix:   '<svg viewBox="0 0 40 36"><polygon points="3,31 19,31 8,10"/><polygon points="37,31 21,31 32,10"/></svg>'
};
/* 每種模式出哪些題型：對應邊也問「幾公分」，對應角也問「幾度」 */
var CONG_KINDS = { point: ['point'], side: ['side', 'len'], angle: ['angle', 'deg'], mix: ['point', 'side', 'angle', 'len', 'deg'] };
var CONG_W = 620, CONG_H = 320;
var CONG_CA = { x: 155, y: 172 }, CONG_CB = { x: 465, y: 172 }, CONG_R = 112;

var _congAnim = 0;

/* ── 出題 ── */

function _congNames() {
  var pairs = [['A', 'B', 'C'], ['D', 'E', 'F']];
  if (Math.random() < 0.3) pairs = [['P', 'Q', 'R'], ['X', 'Y', 'Z']];
  return { a: pairs[0], b: shuffle(pairs[1]) };   /* 乙的字母打亂，點 A 不一定對到點 D */
}

function _makeCongQ(kind) {
  /* 三個角兩兩差 15 度以上，才看得出哪個角對哪個角；三成是直角三角形（比照課本第 4 題） */
  var angs = shuffle(_sideAngles(Math.random() < 0.3 ? 'right' : 'scalene'));
  var sin = angs.map(function(d) { return Math.sin(d * Math.PI / 180); });
  var k = (_ri(40, 80) / 10) / Math.max.apply(null, sin);
  var lens = sin.map(function(s) { return Math.round(s * k * 10) / 10; });   /* 邊 i 是頂點 i 對面的邊 */
  var c2 = sin[1] * k, a0 = angs[0] * Math.PI / 180;
  var raw = [{ x: 0, y: 0 }, { x: sin[2] * k, y: 0 }, { x: Math.cos(a0) * c2, y: Math.sin(a0) * c2 }];
  var r0 = _ri(0, 359) * Math.PI / 180;
  raw = raw.map(function(p) { return { x: p.x * Math.cos(r0) - p.y * Math.sin(r0), y: -(p.x * Math.sin(r0) + p.y * Math.cos(r0)) }; });
  var g = { x: (raw[0].x + raw[1].x + raw[2].x) / 3, y: (raw[0].y + raw[1].y + raw[2].y) / 3 };
  var far = Math.max.apply(null, raw.map(function(p) { return Math.hypot(p.x - g.x, p.y - g.y); }));
  var rel = raw.map(function(p) { return { x: (p.x - g.x) * CONG_R / far, y: (p.y - g.y) * CONG_R / far }; });
  /* 乙 = 甲（以重心為準）翻轉 → 旋轉 → 移到右邊；提示動畫照同一個式子內插 */
  var flip = Math.random() < 0.3;
  var rot = _ri(0, 11) * 30 + _ri(-10, 10);
  var q = { module: 'congruent', kind: kind, angs: angs, lens: lens, rel: rel, flip: flip, rot: rot, names: _congNames() };
  q.A = _congPlace(q, 0);
  q.B = _congPlace(q, 1);
  var i = _ri(0, 2), j = (i + _ri(1, 2)) % 3;
  if (kind === 'point' || kind === 'angle' || kind === 'deg') q.ask = i;
  else q.ask = [Math.min(i, j), Math.max(i, j)];   /* 邊用兩個頂點表示 */
  return q;
}

/* t=0 甲的位置、t=1 乙的位置 */
function _congPlace(q, t) {
  var th = q.rot * t * Math.PI / 180, fy = q.flip ? 1 - 2 * t : 1;
  var c = { x: CONG_CA.x + (CONG_CB.x - CONG_CA.x) * t, y: CONG_CA.y };
  return q.rel.map(function(p) {
    var x = p.x, y = p.y * fy;
    return { x: c.x + x * Math.cos(th) - y * Math.sin(th), y: c.y + x * Math.sin(th) + y * Math.cos(th) };
  });
}

function generateCongPool(mode) {
  var kinds = [];
  while (kinds.length < ROUND_SIZE) kinds = kinds.concat(shuffle(CONG_KINDS[mode]));
  return kinds.slice(0, ROUND_SIZE).map(_makeCongQ);
}

/* ── 文字 ── */

function _ovl(s) { return '<span class="ovl">' + s + '</span>'; }
function _congSideName(names, ij) { return [names[ij[0]], names[ij[1]]].sort().join(''); }

/* 題目、選項、答案；len/deg 問的是乙，其他問的是甲 */
function _congText(q) {
  var a = q.names.a, b = q.names.b;
  if (q.kind === 'point') return { ask: '點 ' + a[q.ask] + ' 的對應點是哪一點？',
    opts: b.slice().sort().map(function(n) { return { k: n, html: '點 ' + n }; }), ans: b[q.ask] };
  if (q.kind === 'angle') return { ask: '∠' + a[q.ask] + ' 的對應角是哪一個角？',
    opts: b.slice().sort().map(function(n) { return { k: n, html: '∠' + n }; }), ans: b[q.ask] };
  if (q.kind === 'side') return { ask: _ovl(_congSideName(a, q.ask)) + ' 的對應邊是哪一條邊？',
    opts: [[0, 1], [0, 2], [1, 2]].map(function(ij) { return _congSideName(b, ij); }).sort()
      .map(function(n) { return { k: n, html: _ovl(n) }; }), ans: _congSideName(b, q.ask) };
  if (q.kind === 'len') {
    var opp = 3 - q.ask[0] - q.ask[1];
    return { ask: _ovl(_congSideName(b, q.ask)) + ' 是幾公分？',
      opts: q.lens.slice().sort(function(x, y) { return x - y; }).map(function(l) { return { k: String(l), html: l + ' 公分' }; }),
      ans: String(q.lens[opp]) };
  }
  return { ask: '∠' + b[q.ask] + ' 是幾度？',
    opts: q.angs.slice().sort(function(x, y) { return x - y; }).map(function(d) { return { k: String(d), html: d + ' 度' }; }),
    ans: String(q.angs[q.ask]) };
}

function _congExplain(q) {
  var a = q.names.a, b = q.names.b;
  var move = q.flip ? '把甲<b>翻過來</b>再轉一轉，' : '把甲轉一轉，';
  if (q.kind === 'point') return move + '可以疊到乙上：點 ' + a[q.ask] + ' 疊在<b>點 ' + b[q.ask] + '</b> 上。';
  if (q.kind === 'angle') return move + '可以疊到乙上：∠' + a[q.ask] + ' 疊在 <b>∠' + b[q.ask] + '</b> 上，對應角一樣大。';
  if (q.kind === 'side') return move + '可以疊到乙上：' + _ovl(_congSideName(a, q.ask)) + ' 疊在 <b>' + _ovl(_congSideName(b, q.ask)) + '</b> 上，對應邊一樣長。';
  if (q.kind === 'len') {
    var opp = 3 - q.ask[0] - q.ask[1];
    return _ovl(_congSideName(b, q.ask)) + ' 的對應邊是 ' + _ovl(_congSideName(a, q.ask)) + '，對應邊一樣長，所以是 <b>' + q.lens[opp] + ' 公分</b>。';
  }
  return '∠' + b[q.ask] + ' 的對應角是 ∠' + a[q.ask] + '，對應角一樣大，所以是 <b>' + q.angs[q.ask] + ' 度</b>。';
}

/* ── 流程 ── */

function congLoad() {
  cancelAnimationFrame(_congAnim);
  var t = _congText(gameQ);
  gameQ.text = t;
  document.getElementById('ang-prompt').innerHTML = t.ask;
  document.getElementById('ang-choices').innerHTML = t.opts.map(function(o) {
    return '<button class="ang-choice" data-k="' + o.k + '" onclick="congChoose(\'' + o.k + '\')">' + o.html + '</button>';
  }).join('');
  _angMsg('', '');
  document.getElementById('ang-hint').textContent = '🔄 把甲疊上去看看';
  document.getElementById('ang-hint').classList.remove('hidden');
  document.getElementById('ang-next').classList.add('hidden');
  _angStats();
  congDraw(false);
}

function congHint() {
  sfxTap();
  _hintUsed = true;
  _angMsg(gameQ.flip ? '甲要<b>翻過來</b>再轉一轉，才疊得上乙。看看甲的每個點落在哪裡。'
    : '把甲轉一轉、移過去，疊到乙上面。看看甲的每個點落在哪裡。', 'ang-msg--hint');
  var q = gameQ, t0 = performance.now();
  cancelAnimationFrame(_congAnim);
  (function step(now) {
    if (gameQ !== q) return;
    var s = Math.min(1, (now - t0) / 1600);
    congDraw(angAnswered, 0.5 - Math.cos(s * Math.PI) / 2);
    if (s < 1) _congAnim = requestAnimationFrame(step);
  })(t0);
}

function congChoose(k) {
  if (!gameQ || angAnswered) return;
  angAnswered = true;
  gameTotal++;
  var q = gameQ, ans = q.text.ans, ok = k === ans;
  document.querySelectorAll('#ang-choices .ang-choice').forEach(function(b) {
    b.disabled = true;
    if (b.dataset.k === ans) b.classList.add('is-correct');
    else if (b.dataset.k === k) b.classList.add('is-wrong');
  });
  document.getElementById('ang-hint').classList.add('hidden');
  cancelAnimationFrame(_congAnim);
  congDraw(true, _hintUsed ? 1 : null);
  var why = '<br>' + _congExplain(q);
  if (ok && !_hintUsed) {
    gameCorrect++;
    sfxCorrect();
    _angMsg('答對了！' + why, 'ang-msg--ok');
  } else if (ok) {
    _angMsg('答案正確，但已看提示，不計分。' + why, 'ang-msg--ok');
  } else {
    sfxWrong();
    var right = q.text.opts.filter(function(o) { return o.k === ans; })[0];
    _angMsg('答案是<b>' + right.html + '</b>。' + why, 'ang-msg--wrong');
  }
  _angStats();
  gamePoolIdx++;
  /* 要對照兩個圖，答對也不自動跳，比照等腰與正三角形 */
  document.getElementById('ang-next').classList.remove('hidden');
}

/* ── 繪圖 ── */

function _congCentroid(P) { return { x: (P[0].x + P[1].x + P[2].x) / 3, y: (P[0].y + P[1].y + P[2].y) / 3 }; }

/* 頂點名稱放在三角形外面（從重心往外推） */
function _congVertexNames(svg, P, names, cls, inward) {
  var G = _congCentroid(P);
  P.forEach(function(V, i) {
    var d = _norm({ x: V.x - G.x, y: V.y - G.y }), r = inward ? -22 : 18;
    var t = _el('text', { x: V.x + d.x * r, y: V.y + d.y * r + 6, 'class': cls }, svg);
    t.textContent = names[i];
  });
}

/* 角的度數標在角裡面（沿角平分線） */
function _congAngleNums(svg, P, angs) {
  P.forEach(function(V, i) {
    var A = P[(i + 1) % 3], B = P[(i + 2) % 3];
    var a = _norm({ x: A.x - V.x, y: A.y - V.y }), b = _norm({ x: B.x - V.x, y: B.y - V.y });
    var bis = _norm({ x: a.x + b.x, y: a.y + b.y });
    var half = angs[i] * Math.PI / 360;
    var room = 0.45 * Math.min(Math.hypot(A.x - V.x, A.y - V.y), Math.hypot(B.x - V.x, B.y - V.y));
    var d = Math.min(Math.max(28, 16 / Math.sin(half)), room);
    var t = _el('text', { x: V.x + bis.x * d, y: V.y + bis.y * d + 5, 'class': 'cong-num' }, svg);
    t.textContent = angs[i] + '°';
  });
}

function _congSideNums(svg, P, lens) {
  var G = _congCentroid(P);
  [0, 1, 2].forEach(function(j) {
    var A = P[(j + 1) % 3], B = P[(j + 2) % 3];
    var M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
    /* 往邊的法線方向推出去（不是往重心反方向，細長三角形才不會壓到線）；字寬約 28px */
    var n = _norm({ x: -(B.y - A.y), y: B.x - A.x });
    if (n.x * (M.x - G.x) + n.y * (M.y - G.y) < 0) n = { x: -n.x, y: -n.y };
    var off = 12 + Math.abs(n.x) * 16;
    var t = _el('text', { x: M.x + n.x * off, y: M.y + n.y * off + 5, 'class': 'cong-num' }, svg);
    t.textContent = lens[j];
  });
}

/* 標出問的點／邊／角（揭曉時甲、乙兩邊都標） */
function _congMark(svg, P, q) {
  if (q.kind === 'point') { _el('circle', { cx: P[q.ask].x, cy: P[q.ask].y, r: 7, 'class': 'cong-hi-dot' }, svg); return; }
  if (q.kind === 'side' || q.kind === 'len') {
    var A = P[q.ask[0]], B = P[q.ask[1]];
    _el('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, 'class': 'cong-hi-line' }, svg);
    return;
  }
  var V = P[q.ask], U = P[(q.ask + 1) % 3], W = P[(q.ask + 2) % 3], r = 26;
  var a = _norm({ x: U.x - V.x, y: U.y - V.y }), b = _norm({ x: W.x - V.x, y: W.y - V.y });
  var sweep = a.x * b.y - a.y * b.x > 0 ? 1 : 0;
  _el('path', { d: 'M' + _pt({ x: V.x + a.x * r, y: V.y + a.y * r }) + ' A' + r + ' ' + r + ' 0 0 ' + sweep + ' ' +
    _pt({ x: V.x + b.x * r, y: V.y + b.y * r }), 'class': 'cong-hi-arc' }, svg);
}

/* ghost：提示動畫的進度（0～1），null 表示不畫甲的分身 */
function congDraw(reveal, ghost) {
  var q = gameQ, svg = document.getElementById('ang-svg');
  if (!q || !svg) return;
  svg.innerHTML = '';
  var a = q.names.a, b = q.names.b;
  var lbA = _el('text', { x: CONG_CA.x, y: 30, 'class': 'cong-title cong-title--a' }, svg); lbA.textContent = '甲';
  var lbB = _el('text', { x: CONG_CB.x, y: 30, 'class': 'cong-title cong-title--b' }, svg); lbB.textContent = '乙';
  _el('polygon', { points: q.A.map(_pt).join(' '), 'class': 'cong-tri cong-tri--a' }, svg);
  _el('polygon', { points: q.B.map(_pt).join(' '), 'class': 'cong-tri cong-tri--b' }, svg);

  /* 問「幾公分／幾度」時，甲標上三邊長／三個角的度數 */
  if (q.kind === 'len') _congSideNums(svg, q.A, q.lens);
  if (q.kind === 'deg') _congAngleNums(svg, q.A, q.angs);
  /* 問甲的點邊角時先標甲；問乙的幾公分幾度時先標乙；揭曉後兩邊都標 */
  var askB = q.kind === 'len' || q.kind === 'deg';
  if (reveal || !askB) _congMark(svg, q.A, q);
  if (reveal || askB) _congMark(svg, q.B, q);

  _congVertexNames(svg, q.A, a, 'cong-name');
  _congVertexNames(svg, q.B, b, 'cong-name');

  if (ghost != null) {
    var G = _congPlace(q, ghost);
    _el('polygon', { points: G.map(_pt).join(' '), 'class': 'cong-ghost' }, svg);
    _congVertexNames(svg, G, a, 'cong-ghost-name', true);
  }
}
