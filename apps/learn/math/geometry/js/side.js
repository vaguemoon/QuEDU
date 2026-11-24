'use strict';

/* ════════════════════════════════════════
   等腰與正三角形（side）：看邊長分類
   比照課本「量一量，再回答問題」：一次給 甲乙丙丁 四個三角形，
   問「哪些是等腰三角形／正三角形／等腰直角三角形？」（選擇頁選一種，整輪只問這種），點選所有符合的再按檢查；
   邊長用眼睛判斷不出來，每條邊一開始就標好長度（公分），沒有提示按鈕
   ════════════════════════════════════════ */

var SIDE_KINDS = ['iso', 'equi', 'isoright'];   /* 選擇頁一次選一種練，不混合 */
var SIDE_LABELS = ['甲', '乙', '丙', '丁'];
var SIDE_W = 200, SIDE_H = 160, SIDE_PAD = 30;
var SIDE_ASK = { iso: '等腰三角形', equi: '正三角形', isoright: '等腰直角三角形' };
var SIDE_RULE = {
  iso:      '有兩條邊一樣長的三角形，就是等腰三角形。',
  equi:     '三條邊都一樣長的三角形，就是正三角形。',
  isoright: '有兩條邊一樣長、又有一個直角的三角形，就是等腰直角三角形。'
};

var sidePicked = [];

/* ── 各種三角形的三個角（度） ── */

function _sideAngles(type) {
  if (type === 'equi')     return [60, 60, 60];
  if (type === 'isoright') return [90, 45, 45];
  if (type === 'iso') {
    /* 頂角避開 60（會變正三角形）、90（等腰直角），也避開 50、70 這種看起來幾乎是正三角形的 */
    var apex = [30, 40, 80, 100, 110, 120][_ri(0, 5)];
    return [apex, (180 - apex) / 2, (180 - apex) / 2];
  }
  if (type === 'right') return [90].concat(shuffle([[25, 65], [30, 60], [35, 55], [60, 30], [65, 25]][_ri(0, 4)]));
  /* scalene：三個角兩兩差 15 度以上，邊長才看得出不一樣；也不要接近直角 */
  var a, b, c;
  do { a = _ri(5, 25) * 5; b = _ri(5, 25) * 5; c = 180 - a - b; }
  while (c < 25 || Math.abs(a - b) < 15 || Math.abs(b - c) < 15 || Math.abs(a - c) < 15 ||
         [a, b, c].some(function(x) { return Math.abs(x - 90) < 12; }));
  return [a, b, c];
}

/* 由三個角做出三角形：最長邊 5～8 公分，隨機旋轉；邊 i 是頂點 i 對面那條邊 */
function _sideTri(type) {
  var angs = shuffle(_sideAngles(type));
  var sin = angs.map(function(d) { return Math.sin(d * Math.PI / 180); });
  var k = (_ri(50, 80) / 10) / Math.max.apply(null, sin);
  /* 用正弦定理直接算邊長：角一樣，邊長就完全一樣，四捨五入後也不會差 0.1 */
  var lens = sin.map(function(s) { return Math.round(s * k * 10) / 10; });
  var c2 = sin[1] * k, a0 = angs[0] * Math.PI / 180;     /* P0→P2 長度是邊 1 */
  var pts = [{ x: 0, y: 0 }, { x: sin[2] * k, y: 0 }, { x: Math.cos(a0) * c2, y: Math.sin(a0) * c2 }];
  var rot = _ri(0, 359) * Math.PI / 180, cs = Math.cos(rot), sn = Math.sin(rot);
  pts = pts.map(function(p) { return { x: p.x * cs - p.y * sn, y: p.x * sn + p.y * cs }; });
  return { type: type, angs: angs, lens: lens, pts: pts };
}

function _sideIs(tri, kind) {
  var t = tri.type;
  if (kind === 'equi') return t === 'equi';
  if (kind === 'isoright') return t === 'isoright';
  return t === 'iso' || t === 'isoright';   /* 等腰直角三角形也是等腰三角形 */
}

function _makeSideQ(kind) {
  var good, bad;
  if (kind === 'equi') {
    good = ['equi'].concat(Math.random() < 0.35 ? ['equi'] : []);
    bad = shuffle(['iso', 'iso', 'scalene', 'isoright', 'right']);
  } else if (kind === 'isoright') {
    good = ['isoright'].concat(Math.random() < 0.25 ? ['isoright'] : []);
    bad = shuffle(['iso', 'right', 'right', 'equi', 'scalene']);
  } else {
    /* 問等腰時不放正三角形：正三角形也算等腰，但先不考這一層 */
    good = shuffle(['iso', 'iso', 'isoright']).slice(0, _ri(1, 2));
    bad = shuffle(['scalene', 'scalene', 'right']);
  }
  var types = shuffle(good.concat(bad.slice(0, 4 - good.length)));
  var tris = types.map(_sideTri);
  return { module: 'side', kind: kind, tris: tris,
           answer: tris.map(function(t) { return _sideIs(t, kind); }) };
}

function generateSidePool(kind) {
  var pool = [];
  for (var i = 0; i < ROUND_SIZE; i++) pool.push(_makeSideQ(kind));
  return pool;
}

/* ── 流程 ── */

function sideLoad() {
  sidePicked = [false, false, false, false];
  document.getElementById('ang-prompt').textContent = '下面哪些圖形是' + SIDE_ASK[gameQ.kind] + '？';
  document.getElementById('ang-choices').innerHTML =
    '<div class="side-tip">邊長單位是公分。點選所有符合的圖形，再按檢查</div>' +
    '<button class="ang-choice ang-check" id="side-check" onclick="sideCheck()" disabled>檢查答案</button>';
  _angMsg('', '');
  /* 邊長用看的分不出來，一開始就標好長度，沒有提示按鈕 */
  document.getElementById('ang-hint').classList.add('hidden');
  document.getElementById('ang-next').classList.add('hidden');
  _angStats();
  sideDraw(false);
}

function sideToggle(i) {
  if (angAnswered) return;
  sfxTap();
  sidePicked[i] = !sidePicked[i];
  document.getElementById('side-check').disabled = sidePicked.indexOf(true) < 0;
  sideDraw(false);
}

function sideCheck() {
  if (angAnswered || sidePicked.indexOf(true) < 0) return;
  angAnswered = true;
  gameTotal++;
  var q = gameQ;
  var ok = q.answer.every(function(a, i) { return a === sidePicked[i]; });
  document.getElementById('side-check').disabled = true;
  sideDraw(true);
  var names = q.answer.map(function(a, i) { return a ? SIDE_LABELS[i] : null; }).filter(Boolean).join('、');
  var why = '<br>' + SIDE_RULE[q.kind];
  if (ok) {
    gameCorrect++;
    sfxCorrect();
    _angMsg('答對了！' + why, 'ang-msg--ok');
  } else {
    sfxWrong();
    _angMsg('答案是<b>' + names + '</b>。' + why, 'ang-msg--wrong');
  }
  _angStats();
  gamePoolIdx++;
  /* 這裡圖多、要比對邊長，答對也不自動跳，讓學生看完自己按 */
  document.getElementById('ang-next').classList.remove('hidden');
}

/* ── 繪圖 ── */

function sideDraw(reveal) {
  var q = gameQ, grid = document.getElementById('side-grid');
  if (!q || !grid) return;
  /* 比例尺：各圖盡量放大，但不超過「四個圖共用比例」的 1.5 倍，
     免得 3 公分的邊畫得比別格 6 公分的邊還長 */
  var fits = q.tris.map(function(t) {
    var xs = t.pts.map(function(p) { return p.x; }), ys = t.pts.map(function(p) { return p.y; });
    var w = Math.max.apply(null, xs) - Math.min.apply(null, xs), h = Math.max.apply(null, ys) - Math.min.apply(null, ys);
    return Math.min((SIDE_W - 2 * SIDE_PAD) / w, (SIDE_H - 2 * SIDE_PAD) / h);
  });
  var common = Math.min.apply(null, fits);
  grid.innerHTML = '';
  q.tris.forEach(function(t, i) {
    var btn = document.createElement('button');
    var cls = 'side-card';
    if (sidePicked[i]) cls += ' is-picked';
    if (reveal) cls += q.answer[i] ? (sidePicked[i] ? ' is-correct' : ' is-missed') : (sidePicked[i] ? ' is-wrong' : '');
    btn.className = cls;
    btn.onclick = function() { sideToggle(i); };
    var svg = _el('svg', { viewBox: '0 0 ' + SIDE_W + ' ' + SIDE_H, xmlns: _SVG_NS_ANG });
    btn.appendChild(svg);
    grid.appendChild(btn);

    var sc = Math.min(fits[i], common * 1.5);
    var xs = t.pts.map(function(p) { return p.x; }), ys = t.pts.map(function(p) { return p.y; });
    var cx = (Math.max.apply(null, xs) + Math.min.apply(null, xs)) / 2, cy = (Math.max.apply(null, ys) + Math.min.apply(null, ys)) / 2;
    var P = t.pts.map(function(p) { return { x: SIDE_W / 2 + (p.x - cx) * sc, y: SIDE_H / 2 - (p.y - cy) * sc }; });
    var G = { x: (P[0].x + P[1].x + P[2].x) / 3, y: (P[0].y + P[1].y + P[2].y) / 3 };
    _el('polygon', { points: P.map(_pt).join(' '), 'class': 'side-tri' }, svg);
    var lb = _el('text', { x: 16, y: 24, 'class': 'side-name' }, svg);   /* 名稱放左上角，細長的三角形裡塞不下 */
    lb.textContent = SIDE_LABELS[i];

    /* 邊 j（頂點 j 對面）：一樣長的邊畫等長記號；量一量後標長度 */
    [0, 1, 2].forEach(function(j) {
      var A = P[(j + 1) % 3], B = P[(j + 2) % 3];
      var M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
      var out = _norm({ x: M.x - G.x, y: M.y - G.y });
      var same = t.lens.filter(function(l) { return l === t.lens[j]; }).length > 1;
      if (reveal && same) {
        var d = _norm({ x: B.x - A.x, y: B.y - A.y });
        _el('line', { x1: M.x - d.y * 7, y1: M.y + d.x * 7, x2: M.x + d.y * 7, y2: M.y - d.x * 7, 'class': 'side-tick' }, svg);
      }
      var tx = _el('text', { x: M.x + out.x * 21, y: M.y + out.y * 19 + 5, 'class': 'side-len' + (reveal && same ? ' side-len--same' : '') }, svg);
      tx.textContent = t.lens[j];
    });
    if (reveal && t.angs.indexOf(90) >= 0) {
      var r = t.angs.indexOf(90);
      _rightMark(svg, P[r], P[(r + 1) % 3], P[(r + 2) % 3]);
    }
  });
}
