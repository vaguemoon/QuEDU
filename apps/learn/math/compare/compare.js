/* compare.js — 比較趣
 *
 * 最基本的項目「比大小」：兩個整數直接比（10 以內～一萬以內），規則與出題見「比大小」那段。
 *
 * 「不用算比大小」：不用計算，判斷「A 運算 B」跟 A 誰大
 *
 * 判斷的關鍵都在 B（另一個數）：
 *   加：B > 0 → 和變大；B = 0 → 不變
 *   減：B > 0 → 差變小；B = 0 → 不變
 *   乘：B > 1 → 積變大；B = 1 → 不變；B < 1 → 積變小
 *   除：B > 1 → 商變小；B = 1 → 不變；B < 1 → 商變大
 * 出題時先決定 B 落在哪一類（gt／eq／lt，相對於 0 或 1），再依數字種類（整數／小數／分數）
 * 產生 A、B。數一律用「分子／分母」整數存，比大小、判斷是不是 1 都不會有浮點誤差。
 *
 * 另一個項目「估一估」：876 比較接近 800 還是 900？（四捨五入、概數的前置練習）
 *   數一律用整數 v 加上倍率 s 存（3.7 存成 v=37, s=10），不會有浮點誤差；
 *   剛好在正中間的數（25、850、3.5）不出題——到底算接近哪邊是四捨五入的規定，不是估算。
 * 依賴：shared.js（db、initFirebase、sfxCorrect、sfxWrong、sfxCelebrate）
 */
'use strict';

var ROUND_SIZE = 10;

var MODES = [
  { id: 'num', icon: '🔢', name: '比大小', ex: '47 □ 74',
    sub: '比較兩個數誰比較大、誰比較小，在□裡填 >、= 或 <' },
  { id: 'op',  icon: '⚖️', name: '不用算比大小', ex: '0.72 × 1.5 □ 0.72',
    sub: '不用計算，判斷算出來的答案比原來的數大、小，還是一樣' },
  { id: 'est', icon: '🎯', name: '估一估：比較接近誰', ex: '876 → 800 或 900？',
    sub: '不用精確算，看看整數、小數、分數比較接近哪一個數' }
];
/* 估一估：先選數字（整數／小數／分數），再選程度。
   整數 digits：只出跟範圍對應的位數（接近幾百就只出三位數，不出 9606 這種） */
var EST_CATS = [
  { id: 'int',  icon: '🔢', name: '整數', ex: '876 → 800 或 900' },
  { id: 'dec',  icon: '🔸', name: '小數', ex: '3.47 → 3.4 或 3.5' },
  { id: 'frac', icon: '🍕', name: '分數', ex: '2又3/4 → 2 或 3' }
];
var EST_LEVELS = {
  int: [
    { id: 'ten', icon: '🔟', name: '接近幾十', ex: '23 → 20 或 30', unit: 10,    digits: 2 },
    { id: 'hun', icon: '💯', name: '接近幾百', ex: '876 → 800 或 900', unit: 100,   digits: 3 },
    { id: 'tho', icon: '🧱', name: '接近幾千', ex: '3462 → 3000 或 4000', unit: 1000,  digits: 4 },
    { id: 'wan', icon: '🏙️', name: '接近幾萬', ex: '46800 → 40000 或 50000', unit: 10000, digits: 5 }
  ],
  dec: [
    { id: 'd1',  icon: '1️⃣', name: '一位小數→整數', ex: '3.7 → 3 或 4' },
    { id: 'd2',  icon: '2️⃣', name: '二位小數→整數', ex: '14.23 → 14 或 15' },
    { id: 'd2t', icon: '🔍', name: '二位小數→一位小數', ex: '3.47 → 3.4 或 3.5' }
  ],
  frac: [
    { id: 'fp', icon: '🍰', name: '真分數：接近 0 還是 1', ex: '3/5 → 0 或 1' },
    { id: 'fm', icon: '🍕', name: '帶分數：接近哪個整數', ex: '2又3/4 → 2 或 3' }
  ]
};
['int', 'dec', 'frac'].forEach(function(c) {
  EST_LEVELS[c].push({ id: 'mix', icon: '🔀', name: '綜合', ex: '上面幾種混合' });
});

var OPS = [
  { id: 'add', icon: '➕', name: '加法', ex: '46 + 28 □ 46' },
  { id: 'sub', icon: '➖', name: '減法', ex: '80 − 19 □ 80' },
  { id: 'mul', icon: '✖️', name: '乘法', ex: '0.72 × 1.5 □ 0.72' },
  { id: 'div', icon: '➗', name: '除法', ex: '0.72 ÷ 0.24 □ 0.72' },
  { id: 'mix', icon: '🔀', name: '綜合', ex: '加減乘除混合' }
];
var NUMS = [
  { id: 'int',  icon: '🔢', name: '整數', ex: '36、125' },
  { id: 'dec',  icon: '🔸', name: '小數', ex: '0.72、3.6' },
  { id: 'frac', icon: '🍕', name: '分數', ex: '3/4、2又1/3' },
  { id: 'mix',  icon: '🔀', name: '綜合', ex: '三種混合' }
];
var OP_SIGN = { add: '+', sub: '−', mul: '×', div: '÷' };

/* 比大小：兩個整數直接比，依數的範圍分程度 */
var NUM_LEVELS = [
  { id: 'n10',    icon: '🖐️', name: '10 以內',   ex: '7 □ 4',       max: 10 },
  { id: 'n20',    icon: '🔟', name: '20 以內',   ex: '15 □ 18',     max: 20 },
  { id: 'n100',   icon: '💯', name: '100 以內',  ex: '47 □ 74',     max: 100 },
  { id: 'n1000',  icon: '🧱', name: '1000 以內', ex: '352 □ 325',   max: 1000 },
  { id: 'n10000', icon: '🏙️', name: '一萬以內',  ex: '4087 □ 4870', max: 10000 },
  { id: 'mix',    icon: '🔀', name: '綜合',      ex: '上面幾種混合' }
];

var cfg = { mode: 'num', numLv: 'n10', op: 'div', num: 'dec', estCat: 'int', est: 'hun' };
var round = null; // { qs:[], idx, correct, answered }

/* ══ 數字 ══ */
function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function gcd(a, b) { return b ? gcd(b, a % b) : a; }

function mkInt(k) {
  return { n: k, d: 1, html: String(k), text: String(k) };
}
/* 小數：m / 10^dp，m 的個位不能是 0（不然 0.70 這種寫法很怪） */
function mkDec(m, dp) {
  var d = Math.pow(10, dp);
  var s = (m / d).toFixed(dp);
  return { n: m, d: d, html: s, text: s };
}
function randDec(minM, maxM, dp) {
  var m;
  do { m = ri(minM, maxM); } while (m % 10 === 0);
  return mkDec(m, dp);
}
/* 分數：mixed=true 且是假分數時寫成帶分數 */
function mkFrac(n, d, mixed) {
  var o = { n: n, d: d };
  if (mixed && n > d && n % d !== 0) {
    var w = Math.floor(n / d), r = n % d;
    o.html = '<span class="mixed">' + w + fracHtml(r, d) + '</span>';
    o.text = w + '又' + r + '/' + d;
  } else {
    o.html = fracHtml(n, d);
    o.text = n + '/' + d;
  }
  return o;
}
function fracHtml(n, d) {
  return '<span class="frac"><span class="frac-n">' + n + '</span><span class="frac-d">' + d + '</span></span>';
}
/* 隨機最簡分數，分子介於 [minN(d), maxN(d)] */
function randFrac(minN, maxN, mixed) {
  for (var t = 0; t < 50; t++) {
    var d = ri(2, 9), lo = minN(d), hi = maxN(d);
    if (hi < lo) continue;
    var n = ri(lo, hi);
    if (n > 0 && gcd(n, d) === 1 && n !== d) return mkFrac(n, d, mixed && Math.random() < 0.5);
  }
  return mkFrac(1, 2, false);
}
function cmp(x, y) { var l = x.n * y.d, r = y.n * x.d; return l > r ? 1 : l < r ? -1 : 0; }
function isOne(x)  { return x.n === x.d; }
function isZero(x) { return x.n === 0; }

/* A：被加數／被減數／被乘數／被除數（一定大於 0） */
function genA(num) {
  if (num === 'int') return mkInt(ri(12, 999));
  if (num === 'dec') return Math.random() < 0.5 ? randDec(2, 999, 1) : randDec(2, 999, 2);
  return randFrac(function() { return 1; }, function(d) { return 3 * d; }, true);
}

/* B 依類別產生：乘除的 gt/eq/lt 是相對於 1，加減的 gt/eq 是相對於 0 */
function genB(op, num, cat) {
  if (op === 'add' || op === 'sub') {
    if (cat === 'eq') return mkInt(0);
    if (num === 'int')  return mkInt(ri(1, 99));
    if (num === 'dec')  return Math.random() < 0.5 ? randDec(1, 99, 1) : randDec(1, 99, 2);
    return randFrac(function() { return 1; }, function(d) { return 2 * d; }, true);
  }
  if (cat === 'eq') {
    /* 分數的「1」大多寫成 4/4 這種分子分母一樣的形式——學生要認得出它就是 1 */
    if (num === 'frac' && Math.random() < 0.7) { var dd = ri(2, 9); return { n: dd, d: dd, html: fracHtml(dd, dd), text: dd + '/' + dd }; }
    return mkInt(1);
  }
  if (cat === 'gt') {
    if (num === 'int') return mkInt(ri(2, 12));
    if (num === 'dec') return Math.random() < 0.5 ? randDec(11, 99, 1) : randDec(101, 999, 2);
    return randFrac(function(d) { return d + 1; }, function(d) { return 3 * d; }, true);
  }
  /* lt：比 1 小的正數（整數沒有，呼叫端不會要求） */
  if (num === 'dec') return Math.random() < 0.5 ? randDec(1, 9, 1) : randDec(1, 99, 2);
  return randFrac(function() { return 1; }, function(d) { return d - 1; }, false);
}

function makeQuestion() {
  var op  = cfg.op  === 'mix' ? pick(['add', 'sub', 'mul', 'div']) : cfg.op;
  var num = cfg.num === 'mix' ? pick(['int', 'dec', 'frac']) : cfg.num;
  var cat;
  if (op === 'add' || op === 'sub') {
    cat = Math.random() < 0.2 ? 'eq' : 'gt';
  } else {
    var r = Math.random();
    if (num === 'int') cat = r < 0.25 ? 'eq' : 'gt';          /* 整數沒有比 1 小的正數 */
    else cat = r < 0.2 ? 'eq' : r < 0.6 ? 'gt' : 'lt';
  }
  var A = genA(num), B;
  for (var t = 0; t < 50; t++) {
    B = genB(op, num, cat);
    if (op !== 'sub' || cmp(B, A) < 0) break;               /* 減法不出負數 */
  }
  if (op === 'sub' && cmp(B, A) >= 0) B = mkInt(0), cat = 'eq';

  var ans;
  if (op === 'add') ans = cat === 'eq' ? '=' : '>';
  else if (op === 'sub') ans = cat === 'eq' ? '=' : '<';
  else if (op === 'mul') ans = cat === 'gt' ? '>' : cat === 'eq' ? '=' : '<';
  else ans = cat === 'gt' ? '<' : cat === 'eq' ? '=' : '>';
  return { op: op, num: num, cat: cat, A: A, B: B, ans: ans };
}

/* ══ 規則說明 ══ */
var RESULT_NAME = { add: '和', sub: '差', mul: '積', div: '商' };
var BASE_NAME   = { add: '被加數', sub: '被減數', mul: '被乘數', div: '被除數' };
var OTHER_NAME  = { add: '加數', sub: '減數', mul: '乘數', div: '除數' };

function explain(q) {
  var other = OTHER_NAME[q.op], res = RESULT_NAME[q.op], base = BASE_NAME[q.op];
  var bt = q.B.text;
  var oneNote = (q.cat === 'eq' && q.B.d !== 1) ? bt + ' 就是 1，' : '';
  var rule;
  if (q.op === 'add') rule = q.cat === 'eq' ? '加 0，' + res + '不變，還是等於' + base + '。'
                                            : '加數 ' + bt + ' 比 0 大，加完以後' + res + '會比' + base + '大。';
  else if (q.op === 'sub') rule = q.cat === 'eq' ? '減 0，' + res + '不變，還是等於' + base + '。'
                                                 : '減數 ' + bt + ' 比 0 大，減完以後' + res + '會比' + base + '小。';
  else if (q.cat === 'eq') rule = oneNote + (q.op === 'mul' ? '乘以 1' : '除以 1') + '，' + res + '不變，還是等於' + base + '。';
  else {
    var bigger = q.cat === 'gt';
    var grows = q.op === 'mul' ? bigger : !bigger;
    rule = other + ' ' + bt + ' 比 1 ' + (bigger ? '大' : '小') + '，' + res + '會比' + base + (grows ? '大' : '小') + '。';
  }
  return rule;
}

/* 數線：標出 0、參考點（加減是 0、乘除是 1）跟 B 的位置，讓「B 比 1 大還是小」看得見 */
function numberLineSvg(q) {
  var ref = (q.op === 'add' || q.op === 'sub') ? 0 : 1;
  var bv = q.B.n / q.B.d;
  var max = Math.max(2, bv * 1.15, ref + 1);
  var W = 560, L = 30, R = W - 30, Y = 46;
  function x(v) { return L + (R - L) * v / max; }
  var refColor = 'var(--cmp-ref)', bColor = cmp(q.B, { n: ref, d: 1 }) === 0 ? 'var(--cmp-eq)'
    : (bv > ref ? 'var(--cmp-gt)' : 'var(--cmp-lt)');
  var s = '<svg viewBox="0 0 ' + W + ' 96" class="nl-svg" role="img" aria-label="數線">' +
    '<line x1="' + L + '" y1="' + Y + '" x2="' + (R + 14) + '" y2="' + Y + '" stroke="var(--text)" stroke-width="2.5"/>' +
    '<polygon points="' + (R + 18) + ',' + Y + ' ' + (R + 8) + ',' + (Y - 6) + ' ' + (R + 8) + ',' + (Y + 6) + '" fill="var(--text)"/>' +
    '<line x1="' + x(0) + '" y1="' + (Y - 8) + '" x2="' + x(0) + '" y2="' + (Y + 8) + '" stroke="var(--text)" stroke-width="2.5"/>' +
    '<text x="' + x(0) + '" y="' + (Y + 30) + '" text-anchor="middle" class="nl-num">0</text>';
  if (ref === 1) {
    s += '<line x1="' + x(1) + '" y1="' + (Y - 12) + '" x2="' + x(1) + '" y2="' + (Y + 12) + '" stroke="' + refColor + '" stroke-width="4"/>' +
         '<text x="' + x(1) + '" y="' + (Y + 30) + '" text-anchor="middle" class="nl-num nl-ref">1</text>';
  }
  s += '<circle cx="' + x(bv) + '" cy="' + Y + '" r="9" fill="' + bColor + '"/>' +
       '<text x="' + x(bv) + '" y="' + (Y - 18) + '" text-anchor="middle" class="nl-num nl-b" fill="' + bColor + '">' + escHtml(q.B.text) + '</text>';
  return s + '</svg>';
}

/* ══ 比大小 ══ */
/* 隨便抽兩個數，大部分題目位數不同、一眼就看得出來，練不到「同位數要從最高位比」。
   所以兩位數以上會刻意出：數字對調（47／74，十位個位寫反的孩子最會錯）、
   最高位相同只差在後面某一位（352／358），另外約 15% 出一樣的數練「=」 */
var PLACE_NAME = ['個', '十', '百', '千', '萬'];

function numLevel(id) { return NUM_LEVELS.find(function(l) { return l.id === id; }); }

function makeNumQuestion() {
  var lvId = cfg.numLv === 'mix'
    ? pick(NUM_LEVELS.filter(function(l) { return l.id !== 'mix'; })).id : cfg.numLv;
  var max = numLevel(lvId).max, lo = max === 10 ? 0 : 1;
  var a = ri(lo, max), b, r = Math.random();
  if (r < 0.15) b = a;
  else {
    for (var t = 0; t < 100; t++) {
      if (max >= 100 && r < 0.45) b = swapDigits(a);
      else if (max >= 20 && r < 0.75) b = changeLowDigit(a, max);
      else if (max >= 100 && r < 0.88) b = ri(lo, Math.pow(10, String(a).length - 1) - 1); /* 位數比較少的數 */
      else b = ri(lo, max);
      if (b !== null && b !== a && b >= lo && b <= max) break;
      a = ri(lo, max); b = null;
    }
    if (b === null || b === a) b = a === max ? a - 1 : a + 1;
    if (Math.random() < 0.5) { var tmp = a; a = b; b = tmp; }                            /* 大的不要老是在左邊 */
  }
  return { kind: 'num', lv: lvId, a: a, b: b, ans: a > b ? '>' : a < b ? '<' : '=' };
}

/* 數字重新排列（不能變成 0 開頭）：47 → 74、352 → 325／532… */
function swapDigits(n) {
  var d = String(n).split('');
  if (d.length < 2) return null;
  for (var t = 0; t < 20; t++) {
    var s = d.slice().sort(function() { return Math.random() - 0.5; });
    if (s[0] !== '0' && s.join('') !== d.join('')) return parseInt(s.join(''), 10);
  }
  return null;
}
/* 最高位不變，換掉後面某一位的數字 */
function changeLowDigit(n, max) {
  var d = String(n).split('');
  if (d.length < 2) return ri(Math.max(0, n - 3), Math.min(max, n + 3));
  var i = ri(1, d.length - 1);
  d[i] = String(ri(0, 9));
  return parseInt(d.join(''), 10);
}

/* 規則：位數不同 → 位數多的大；同位數 → 從最高位往下找第一個不一樣的位；10 以內／20 以內看數線 */
function numFirstDiff(q) {
  var sa = String(q.a), sb = String(q.b);
  for (var i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return i;
  return -1;
}
function numExplain(q) {
  var big = Math.max(q.a, q.b), small = Math.min(q.a, q.b);
  if (q.a === q.b) return '兩個數一樣，所以填「=」。';
  var la = String(q.a).length, lb = String(q.b).length;
  if (numLevel(q.lv).max <= 20) return '在數線上，' + big + ' 在 ' + small + ' 的右邊，越右邊的數越大，所以 ' + big + ' 比較大。';
  if (la !== lb) return q.a + ' 是' + cnDigits(la) + '位數，' + q.b + ' 是' + cnDigits(lb) + '位數，位數多的比較大，所以 ' + big + ' 比較大。';
  var sa = String(q.a), sb = String(q.b), i = numFirstDiff(q), out = '從最高位開始比：';
  for (var k = 0; k < i; k++) out += PLACE_NAME[la - 1 - k] + '位都是 ' + sa[k] + '，';
  var da = +sa[i], db = +sb[i];
  return out + PLACE_NAME[la - 1 - i] + '位 ' + Math.max(da, db) + ' 比 ' + Math.min(da, db) + ' 大，所以 ' + big + ' 比較大。';
}
function cnDigits(n) { return ['', '一', '二', '三', '四', '五'][n]; }

/* 答錯時的圖：20 以內畫數線，其他畫位值表、標出決定大小的那一位 */
function numVisual(q) {
  if (numLevel(q.lv).max <= 20) return numLineSvg(q);
  var la = String(q.a).length, lb = String(q.b).length, n = Math.max(la, lb);
  var diff = (la === lb && q.a !== q.b) ? n - 1 - numFirstDiff(q) : -1; /* 決定大小的位（0＝個位） */
  function row(v) {
    var s = String(v), cells = '';
    for (var p = n - 1; p >= 0; p--) {
      var ch = p < s.length ? s[s.length - 1 - p] : '';
      cells += '<td class="' + (p === diff ? 'pv-key' : '') + '">' + ch + '</td>';
    }
    return '<tr>' + cells + '</tr>';
  }
  var head = '';
  for (var p = n - 1; p >= 0; p--) head += '<th class="' + (p === diff ? 'pv-key' : '') + '">' + PLACE_NAME[p] + '位</th>';
  return '<table class="pv-table"><tr>' + head + '</tr>' + row(q.a) + row(q.b) + '</table>';
}
function numLineSvg(q) {
  var max = numLevel(q.lv).max, W = 600, L = 30, R = 570, Y = 50;
  function x(v) { return L + (R - L) * v / max; }
  var s = '<svg viewBox="0 0 ' + W + ' 96" class="nl-svg" role="img" aria-label="數線">' +
    '<line x1="' + L + '" y1="' + Y + '" x2="' + R + '" y2="' + Y + '" stroke="var(--text)" stroke-width="2.5"/>';
  for (var v = 0; v <= max; v++) {
    s += '<line x1="' + x(v) + '" y1="' + (Y - 7) + '" x2="' + x(v) + '" y2="' + (Y + 7) + '" stroke="var(--text)" stroke-width="2"/>';
    if (max <= 10 || v % 5 === 0) s += '<text x="' + x(v) + '" y="' + (Y + 30) + '" text-anchor="middle" class="nl-num">' + v + '</text>';
  }
  [[q.a, 'var(--cmp-gt)'], [q.b, 'var(--cmp-lt)']].forEach(function(p) {
    s += '<circle cx="' + x(p[0]) + '" cy="' + Y + '" r="9" fill="' + p[1] + '"/>' +
         '<text x="' + x(p[0]) + '" y="' + (Y - 16) + '" text-anchor="middle" class="nl-num nl-b" fill="' + p[1] + '">' + p[0] + '</text>';
  });
  return s + '</svg>';
}

/* ══ 估一估 ══ */
/* 題目裡的數一律存成「分子 v ／ 分母 s」整數：整數 s=1、小數 s=10/100、分數 s=分母。
   lo/hi 是兩個選項（同樣以 s 為分母），所以三種數字共用同一套出題／說明／數線。
   estVal(q, num, den) 把 num/den 依題目的數字種類寫成 {text, html}，中間點用 den=2s 傳進來 */
function estVal(q, num, den) {
  var g = gcd(num, den); num /= g; den /= g;
  if (den === 1) return { text: String(num), html: String(num), w: num };
  if (q.cat === 'dec') {
    var t = String(parseFloat((num / den).toFixed(4)));            /* 3.50 → 3.5 */
    return { text: t, html: t };
  }
  var w = Math.floor(num / den), r = num % den;
  return { text: (w ? w + '又' : '') + r + '/' + den,
           html: w ? '<span class="mixed">' + w + fracHtml(r, den) + '</span>' : fracHtml(r, den),
           w: w, r: r, d: den };
}
function estText(q, num) { return estVal(q, num, q.s).text; }

function estLevel(cat, id) { return EST_LEVELS[cat].find(function(l) { return l.id === id; }); }

function makeEstQuestion() {
  var cat = cfg.estCat;
  var lvId = cfg.est === 'mix'
    ? pick(EST_LEVELS[cat].filter(function(l) { return l.id !== 'mix'; })).id : cfg.est;
  var lv = estLevel(cat, lvId);
  var v, s, unitS;
  for (var t = 0; t < 200; t++) {
    if (lvId === 'd1')       { s = 10;  unitS = 10;  v = ri(1, 499); }
    else if (lvId === 'd2')  { s = 100; unitS = 100; v = ri(1, 4999); if (v % 10 === 0) continue; } /* 不要 3.70 */
    else if (lvId === 'd2t') { s = 100; unitS = 10;  v = ri(1, 1999); }
    else if (cat === 'frac') {
      s = unitS = ri(3, 12);
      var r0 = ri(1, s - 1);
      if (gcd(r0, s) !== 1) continue;                                   /* 只出最簡分數 */
      v = (lvId === 'fm' ? ri(1, 9) * s : 0) + r0;
    } else {
      s = 1; unitS = lv.unit;
      v = ri(Math.pow(10, lv.digits - 1), Math.pow(10, lv.digits) - 1);
    }
    var r = v % unitS;
    if (r !== 0 && r * 2 !== unitS) break;              /* 剛好整十（沒得選）或正中間（四捨五入的規定）不出 */
  }
  var lo = v - v % unitS, hi = lo + unitS;
  var q = { kind: 'est', cat: cat, lv: lv, v: v, s: s, lo: lo, hi: hi };
  q.ans = estText(q, v * 2 < lo + hi ? lo : hi);
  return q;
}

/* 中間點：(lo+hi)/2，分母用 2s 才會是整數 */
function estMid(q) { return estVal(q, q.lo + q.hi, 2 * q.s); }

function estExplain(q) {
  var x = estVal(q, q.v, q.s).html, mid = estMid(q).html, big = q.v * 2 > q.lo + q.hi;
  return '中間點是 ' + mid + '，' + x + ' 比 ' + mid + (big ? ' 大' : ' 小') +
         '，所以比較接近 ' + escHtml(q.ans) + '。';
}
function estFinal(q) {
  function h(n) { return estVal(q, n, q.s).html; }
  return h(q.v) + ' 離 ' + h(q.lo) + ' 差 ' + h(q.v - q.lo) +
         '，離 ' + h(q.hi) + ' 差 ' + h(q.hi - q.v) + '，離 ' + escHtml(q.ans) + ' 比較近。';
}

/* SVG 裡寫一個數：分數畫成上下疊的直式（整數部分寫在左邊） */
function svgVal(val, x, y, cls, fill) {
  var f = fill ? ' fill="' + fill + '"' : '';
  if (val.d === undefined) {
    return '<text x="' + x + '" y="' + y + '" text-anchor="middle" class="' + cls + '"' + f + '>' + escHtml(val.text) + '</text>';
  }
  var out = '', fx = x;
  if (val.w) {
    out += '<text x="' + (x - 2) + '" y="' + y + '" text-anchor="end" class="' + cls + '"' + f + '>' + val.w + '</text>';
    fx = x + 12;
  }
  var lineC = fill || 'var(--text)';
  return out +
    '<text x="' + fx + '" y="' + (y - 12) + '" text-anchor="middle" class="' + cls + ' nl-frac"' + f + '>' + val.r + '</text>' +
    '<line x1="' + (fx - 11) + '" y1="' + (y - 6) + '" x2="' + (fx + 11) + '" y2="' + (y - 6) + '" stroke="' + lineC + '" stroke-width="2"/>' +
    '<text x="' + fx + '" y="' + (y + 10) + '" text-anchor="middle" class="' + cls + ' nl-frac"' + f + '>' + val.d + '</text>';
}

/* 數線：兩端、中間點、這個數的位置，下面用括號標出離兩端各差多少，近的那段用綠色。
   刻度：分數照分母切，小數／整數切十等份 */
function estLineSvg(q) {
  var W = 600, L = 50, R = 550, Y = 66;
  var span = q.hi - q.lo, isFrac = q.cat === 'frac';
  function x(v) { return L + (R - L) * (v - q.lo) / span; }
  var xv = x(q.v), xm = (L + R) / 2, nearLo = q.v * 2 < q.lo + q.hi;
  var ticks = isFrac ? q.s : 10;
  var s = '<svg viewBox="0 0 ' + W + ' 170" class="nl-svg" role="img" aria-label="數線">' +
    '<line x1="' + (L - 16) + '" y1="' + Y + '" x2="' + (R + 16) + '" y2="' + Y + '" stroke="var(--text)" stroke-width="2.5"/>';
  for (var i = 0; i <= ticks; i++) {
    var tx = L + (R - L) * i / ticks, h = (i === 0 || i === ticks) ? 12 : 6;
    s += '<line x1="' + tx + '" y1="' + (Y - h) + '" x2="' + tx + '" y2="' + (Y + h) + '" stroke="var(--text)" stroke-width="' + (h > 6 ? 3 : 1.5) + '"/>';
  }
  s += '<line x1="' + xm + '" y1="' + (Y - 16) + '" x2="' + xm + '" y2="' + (Y + 14) + '" stroke="var(--cmp-ref)" stroke-width="3" stroke-dasharray="5 4"/>' +
       svgVal(estVal(q, q.lo, q.s), L, Y + 38, 'nl-num') +
       svgVal(estVal(q, q.hi, q.s), R, Y + 38, 'nl-num') +
       svgVal(estMid(q), xm, Y + 38, 'nl-num nl-mid', 'var(--cmp-ref)');
  /* 離兩端的距離 */
  function seg(a, b, near, val) {
    var c = near ? 'var(--cmp-ok)' : 'var(--muted)', yy = Y + 58;
    var tx = Math.min(R - 40, Math.max(L + 40, (a + b) / 2));
    var path = '<path d="M' + a + ' ' + (yy - 8) + ' V' + yy + ' H' + b + ' V' + (yy - 8) + '" fill="none" stroke="' + c + '" stroke-width="' + (near ? 4 : 2.5) + '"/>';
    if (val.d === undefined) return path + svgVal({ text: '差 ' + val.text }, tx, yy + 28, 'nl-dist', c);
    return path +
           '<text x="' + (tx - 6) + '" y="' + (yy + 30) + '" text-anchor="end" class="nl-dist" fill="' + c + '">差</text>' +
           svgVal(val, tx + (val.w ? 22 : 10), yy + 30, 'nl-dist', c);
  }
  s += seg(L, xv, nearLo, estVal(q, q.v - q.lo, q.s)) + seg(xv, R, !nearLo, estVal(q, q.hi - q.v, q.s));
  s += '<circle cx="' + xv + '" cy="' + Y + '" r="9" fill="var(--cmp-gt)"/>' +
       svgVal(estVal(q, q.v, q.s), Math.min(R, Math.max(L, xv)), Y - (isFrac ? 26 : 28), 'nl-num nl-b', 'var(--cmp-gt)');
  return s + '</svg>';
}

/* ══ 畫面 ══ */
function showPage(name) {
  document.querySelectorAll('.page').forEach(function(el) { el.classList.remove('active'); });
  document.getElementById('page-' + name).classList.add('active');
  document.getElementById('topbar-back').classList.toggle('hidden', name === 'home');
}

function renderPickers() {
  function card(item, cur, setter) {
    return '<button class="pick-card' + (item.id === cur ? ' on' : '') + '" onclick="' + setter + '(\'' + item.id + '\')">' +
      '<span class="pick-icon">' + item.icon + '</span>' +
      '<span class="pick-name">' + item.name + '</span>' +
      '<span class="pick-ex">' + escHtml(item.ex) + '</span></button>';
  }
  document.getElementById('mode-grid').innerHTML = MODES.map(function(o) { return card(o, cfg.mode, 'setMode'); }).join('');
  document.getElementById('home-sub').textContent = MODES.find(function(m) { return m.id === cfg.mode; }).sub;
  document.getElementById('home-num').classList.toggle('hidden', cfg.mode !== 'num');
  document.getElementById('home-op').classList.toggle('hidden', cfg.mode !== 'op');
  document.getElementById('numlv-grid').innerHTML = NUM_LEVELS.map(function(o) { return card(o, cfg.numLv, 'setNumLv'); }).join('');
  document.getElementById('home-est').classList.toggle('hidden', cfg.mode !== 'est');
  document.getElementById('op-grid').innerHTML  = OPS.map(function(o) { return card(o, cfg.op, 'setOp'); }).join('');
  document.getElementById('num-grid').innerHTML = NUMS.map(function(o) { return card(o, cfg.num, 'setNum'); }).join('');
  document.getElementById('estcat-grid').innerHTML = EST_CATS.map(function(o) { return card(o, cfg.estCat, 'setEstCat'); }).join('');
  document.getElementById('est-grid').innerHTML = EST_LEVELS[cfg.estCat].map(function(o) { return card(o, cfg.est, 'setEst'); }).join('');
}
function setMode(id) { cfg.mode = id; renderPickers(); }
function setNumLv(id) { cfg.numLv = id; renderPickers(); }
function setOp(id)  { cfg.op = id;  renderPickers(); }
function setNum(id) { cfg.num = id; renderPickers(); }
function setEst(id) { cfg.est = id; renderPickers(); }
/* 換數字種類時，程度回到該種類的第一個 */
function setEstCat(id) { if (cfg.estCat !== id) { cfg.estCat = id; cfg.est = EST_LEVELS[id][0].id; } renderPickers(); }

function goHome() { round = null; showPage('home'); }

function startRound() {
  var qs = [];
  var est = cfg.mode === 'est';
  var gen = est ? makeEstQuestion : cfg.mode === 'num' ? makeNumQuestion : makeQuestion;
  for (var i = 0; i < ROUND_SIZE; i++) qs.push(gen());
  round = { qs: qs, idx: 0, correct: 0, answered: false };
  if (cfg.mode === 'num') {
    document.getElementById('hud-mode').textContent = '比大小・' + numLevel(cfg.numLv).name;
  } else if (est) {
    document.getElementById('hud-mode').textContent = '估一估・' +
      EST_CATS.find(function(c) { return c.id === cfg.estCat; }).name + '・' + estLevel(cfg.estCat, cfg.est).name;
  } else {
    var opName  = OPS.find(function(o) { return o.id === cfg.op; }).name;
    var numName = NUMS.find(function(o) { return o.id === cfg.num; }).name;
    document.getElementById('hud-mode').textContent = opName + '・' + numName;
  }
  showPage('game');
  renderQuestion();
}

function exprHtml(q, filled) {
  var box = '<span class="ans-box' + (filled ? ' filled' : '') + (q.kind === 'est' ? ' ans-box-wide' : '') + '" id="ans-box">' +
            (filled ? escHtml(filled) : '') + '</span>';
  if (q.kind === 'est') {
    return '<span class="num">' + estVal(q, q.v, q.s).html + '</span>' +
      '<span class="est-word">比較接近</span>' + box + '<span class="est-word">？</span>';
  }
  if (q.kind === 'num') return '<span class="num">' + q.a + '</span>' + box + '<span class="num">' + q.b + '</span>';
  return '<span class="num">' + q.A.html + '</span>' +
    '<span class="op">' + OP_SIGN[q.op] + '</span>' +
    '<span class="num">' + q.B.html + '</span>' + box +
    '<span class="num">' + q.A.html + '</span>';
}

function renderQuestion() {
  var q = round.qs[round.idx];
  round.answered = false;
  document.getElementById('hud-progress').textContent = '第 ' + (round.idx + 1) + ' / ' + round.qs.length + ' 題';
  document.getElementById('hud-correct').textContent = round.correct;
  document.getElementById('q-expr').innerHTML = exprHtml(q, '');
  document.getElementById('explain').classList.add('hidden');
  var opts = q.kind === 'est' ? [estText(q, q.lo), estText(q, q.hi)] : ['>', '=', '<'];
  document.getElementById('q-hint').textContent = q.kind === 'est' ? '不用精確計算，選出比較接近的數'
    : q.kind === 'num' ? '哪個數比較大？在□裡填入 >、= 或 <' : '不用計算，在□裡填入 >、= 或 <';
  document.getElementById('ans-row').innerHTML = opts.map(function(o) {
    return '<button class="ans-btn' + (q.kind === 'est' ? ' ans-btn-num' : '') + '" data-v="' + escHtml(o) + '" onclick="answer(this.dataset.v)">' +
      escHtml(o) + '</button>';
  }).join('');
}

function answer(sym) {
  if (!round || round.answered) return;
  round.answered = true;
  var q = round.qs[round.idx], ok = sym === q.ans;
  if (ok) round.correct++;
  document.getElementById('hud-correct').textContent = round.correct;
  document.getElementById('q-expr').innerHTML = exprHtml(q, q.ans);
  document.getElementById('ans-box').classList.add('right'); /* 格子裡一律填正確答案，用綠色 */
  document.querySelectorAll('.ans-btn').forEach(function(b) {
    b.disabled = true;
    if (b.dataset.v === q.ans) b.classList.add('right');
    else if (b.dataset.v === sym) b.classList.add('wrong');
  });
  try { ok ? sfxCorrect() : sfxWrong(); } catch (e) {}

  /* 答對：簡短一行規則就好；答錯：規則＋數線，學生看懂再自己按下一題 */
  var ex = document.getElementById('explain');
  ex.classList.remove('hidden');
  ex.classList.toggle('is-wrong', !ok);
  document.getElementById('explain-head').textContent = ok ? '⭕ 答對了！' : '再想一想：正確答案是「' + q.ans + '」';
  if (q.kind === 'num') {
    document.getElementById('explain-rule').textContent = numExplain(q);
    document.getElementById('explain-line').innerHTML = ok ? '' : numVisual(q);
    document.getElementById('explain-final').innerHTML = ok ? '' :
      '所以 <span class="final-expr">' + exprHtml(q, q.ans).replace(' id="ans-box"', '') + '</span>';
  } else if (q.kind === 'est') {
    document.getElementById('explain-rule').innerHTML = estExplain(q);
    document.getElementById('explain-line').innerHTML = ok ? '' : estLineSvg(q);
    document.getElementById('explain-final').innerHTML = ok ? '' : estFinal(q);
  } else {
    document.getElementById('explain-rule').textContent = explain(q);
    document.getElementById('explain-line').innerHTML = ok ? '' : numberLineSvg(q);
    document.getElementById('explain-final').innerHTML = ok ? '' :
      '所以 <span class="final-expr">' + exprHtml(q, q.ans).replace(' id="ans-box"', '') + '</span>';
  }
  document.getElementById('btn-next').textContent = round.idx + 1 >= round.qs.length ? '看結果 ▶' : '下一題 ▶';
  document.getElementById('btn-next').focus();
}

function nextQuestion() {
  if (!round || !round.answered) return;
  round.idx++;
  if (round.idx >= round.qs.length) { finishRound(); return; }
  renderQuestion();
}

function finishRound() {
  var c = round.correct, n = round.qs.length;
  document.getElementById('result-correct').textContent = c;
  document.getElementById('result-total').textContent = n;
  document.getElementById('result-icon').textContent = c === n ? '🏆' : c >= n * 0.7 ? '🎉' : '💪';
  document.getElementById('result-title').textContent = c === n ? '全部答對，太厲害了！' : c >= n * 0.7 ? '做得很好！' : '再練習一次吧！';
  try { if (c === n) sfxCelebrate(); } catch (e) {}
  showPage('result');
  saveProgress(c, n);
}

/* ══ 紀錄：students/{id}/progress/compare，Hub 卡片讀 totalCorrect ══ */
function saveProgress(correct, total) {
  var inc = firebase.firestore.FieldValue.increment;
  var key = cfg.mode === 'est' ? 'est_' + cfg.estCat + '_' + cfg.est
          : cfg.mode === 'num' ? 'num_' + cfg.numLv : cfg.op + '_' + cfg.num;
  /* 各模式的累計放在巢狀的 modeStats.{key}；quApp.saveRound 用 set + merge 寫入，巢狀物件會跟既有資料合併 */
  var modeStats = {};
  modeStats[key] = { correct: inc(correct), answered: inc(total) };
  quApp.saveRound(correct, total, { modeStats: modeStats });
}

function backToHub() { quApp.backToHub(); }

/* 鍵盤：> = < 直接作答（估一估用 ← → 選左右），Enter／空白鍵下一題 */
document.addEventListener('keydown', function(e) {
  if (!round || !document.getElementById('page-game').classList.contains('active')) return;
  var q = round.qs[round.idx];
  if (!round.answered && q.kind === 'est' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault(); answer(estText(q, e.key === 'ArrowLeft' ? q.lo : q.hi));
  }
  else if (!round.answered && q.kind !== 'est' && (e.key === '>' || e.key === '<' || e.key === '=')) { e.preventDefault(); answer(e.key); }
  else if (round.answered && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); nextQuestion(); }
});

window.addEventListener('load', function() {
  renderPickers();
  showPage('home');
  quApp.start({ id: 'compare', progress: 'compare' });
});
