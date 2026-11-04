/* compare.js — 比大小趣：不用計算，判斷「A 運算 B」跟 A 誰大
 *
 * 判斷的關鍵都在 B（另一個數）：
 *   加：B > 0 → 和變大；B = 0 → 不變
 *   減：B > 0 → 差變小；B = 0 → 不變
 *   乘：B > 1 → 積變大；B = 1 → 不變；B < 1 → 積變小
 *   除：B > 1 → 商變小；B = 1 → 不變；B < 1 → 商變大
 * 出題時先決定 B 落在哪一類（gt／eq／lt，相對於 0 或 1），再依數字種類（整數／小數／分數）
 * 產生 A、B。數一律用「分子／分母」整數存，比大小、判斷是不是 1 都不會有浮點誤差。
 * 依賴：shared.js（db、initFirebase、sfxCorrect、sfxWrong、sfxCelebrate）
 */
'use strict';

var ROUND_SIZE = 10;

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

var cfg = { op: 'div', num: 'dec' };
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
  document.getElementById('op-grid').innerHTML  = OPS.map(function(o) { return card(o, cfg.op, 'setOp'); }).join('');
  document.getElementById('num-grid').innerHTML = NUMS.map(function(o) { return card(o, cfg.num, 'setNum'); }).join('');
}
function setOp(id)  { cfg.op = id;  renderPickers(); }
function setNum(id) { cfg.num = id; renderPickers(); }

function goHome() { round = null; showPage('home'); }

function startRound() {
  var qs = [];
  for (var i = 0; i < ROUND_SIZE; i++) qs.push(makeQuestion());
  round = { qs: qs, idx: 0, correct: 0, answered: false };
  var opName  = OPS.find(function(o) { return o.id === cfg.op; }).name;
  var numName = NUMS.find(function(o) { return o.id === cfg.num; }).name;
  document.getElementById('hud-mode').textContent = opName + '・' + numName;
  showPage('game');
  renderQuestion();
}

function exprHtml(q, filled) {
  var box = '<span class="ans-box' + (filled ? ' filled' : '') + '" id="ans-box">' + (filled ? escHtml(filled) : '') + '</span>';
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
  document.querySelectorAll('.ans-btn').forEach(function(b) { b.disabled = false; b.classList.remove('picked', 'right', 'wrong'); });
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
    if (b.textContent === q.ans) b.classList.add('right');
    else if (b.textContent === sym) b.classList.add('wrong');
  });
  try { ok ? sfxCorrect() : sfxWrong(); } catch (e) {}

  /* 答對：簡短一行規則就好；答錯：規則＋數線，學生看懂再自己按下一題 */
  var ex = document.getElementById('explain');
  ex.classList.remove('hidden');
  ex.classList.toggle('is-wrong', !ok);
  document.getElementById('explain-head').textContent = ok ? '⭕ 答對了！' : '再想一想：正確答案是「' + q.ans + '」';
  document.getElementById('explain-rule').textContent = explain(q);
  document.getElementById('explain-line').innerHTML = ok ? '' : numberLineSvg(q);
  document.getElementById('explain-final').innerHTML = ok ? '' :
    '所以 <span class="final-expr">' + exprHtml(q, q.ans).replace(' id="ans-box"', '') + '</span>';
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
var currentStudent = null;
function saveProgress(correct, total) {
  if (!db || !currentStudent) return;
  var inc = firebase.firestore.FieldValue.increment;
  var key = cfg.op + '_' + cfg.num;
  var data = { totalCorrect: inc(correct), totalAnswered: inc(total), totalRounds: inc(1), lastStudied: new Date().toISOString() };
  data['modeStats.' + key + '.correct']  = inc(correct);
  data['modeStats.' + key + '.answered'] = inc(total);
  var ref = db.collection('students').doc(currentStudent.id).collection('progress').doc('compare');
  /* update 的點號路徑才會寫進巢狀欄位；文件還不存在時 update 會失敗，改用 set 建立 */
  ref.update(data).catch(function() {
    var first = { totalCorrect: correct, totalAnswered: total, totalRounds: 1, lastStudied: data.lastStudied, modeStats: {} };
    first.modeStats[key] = { correct: correct, answered: total };
    return ref.set(first);
  }).catch(function(e) { console.warn('saveProgress error:', e); });
}

function backToHub() {
  try { window.parent.postMessage({ type: 'compare-back-to-hub' }, '*'); } catch (e) {}
}

/* 鍵盤：> = < 直接作答，Enter／空白鍵下一題 */
document.addEventListener('keydown', function(e) {
  if (!round || !document.getElementById('page-game').classList.contains('active')) return;
  if (!round.answered && (e.key === '>' || e.key === '<' || e.key === '=')) { e.preventDefault(); answer(e.key); }
  else if (round.answered && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); nextQuestion(); }
});

window.addEventListener('load', function() {
  try { initFirebase(); } catch (e) {}
  renderPickers();
  showPage('home');
  try {
    var hub = JSON.parse(sessionStorage.getItem('hub_student') || 'null');
    if (hub && hub.id) {
      currentStudent = { id: hub.id, name: hub.name };
      document.getElementById('topbar-name').textContent = hub.nickname || hub.name || '—';
      (function load() {
        if (!db) { setTimeout(load, 200); return; }
        db.collection('students').doc(hub.id).get().then(function(doc) {
          if (!doc.exists) return;
          var d = doc.data();
          document.getElementById('topbar-avatar').textContent = d.avatar || '🐣';
          if (d.nickname) document.getElementById('topbar-name').textContent = d.nickname;
        }).catch(function() {});
      })();
    }
  } catch (e) {}
});
