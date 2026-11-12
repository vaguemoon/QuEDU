/* addsub.js — 加減趣：低年級加減法計算（數字鍵盤作答）
 *
 * 範圍（LEVELS）：湊十 → 10 以內 → 20 以內不進退位／進退位 → 二位數不進退位／進退位 → 三位數
 * 題型（FORMATS）：橫式、填空（求加數／被加數…）、直式（逐位填答，上方小格可寫進位借位）、連加連減
 * 練習：答錯第一次給方法提示（不講答案）、再錯才公布解法；測驗：每題一次機會，錯的下一輪再考，
 *       第一輪答對 9 題以上該範圍標「測驗通過」。進度存 students/{id}/progress/addsub。
 * 提示依數字大小自動切換：20 以內用十格框圓點（進退位加上湊十法／拆十法），二位數以上用直式逐位說明。
 * 依賴：shared.js（db、initFirebase、sfxCorrect、sfxWrong、sfxCelebrate、showToast）
 */
'use strict';

var ROUND_SIZE = 10;
var MASTER_MIN = 9;   // 測驗第一輪答對幾題以上算通過

var OPS = [
  { id: 'add', icon: '➕', name: '加法',     ex: '8 + 7' },
  { id: 'sub', icon: '➖', name: '減法',     ex: '15 − 9' },
  { id: 'mix', icon: '🔀', name: '加減混合', ex: '加法、減法都有' }
];
var LEVELS = [
  { id: 'ten',  icon: '🔟', name: '湊十',            ex: '7 + □ = 10', fmts: ['fill'] },
  { id: 'w10',  icon: '🍎', name: '10 以內',         ex: '6 + 3、9 − 4', fmts: ['h', 'fill', 'chain'] },
  { id: 'w20n', icon: '🍊', name: '20 以內・不進退位', ex: '12 + 5、18 − 6', fmts: ['h', 'fill', 'v', 'chain'] },
  { id: 'w20c', icon: '🍇', name: '20 以內・進退位',   ex: '8 + 7、15 − 9', fmts: ['h', 'fill', 'v', 'chain'] },
  { id: 'd2n',  icon: '🧱', name: '二位數・不進退位',  ex: '34 + 25、68 − 23', fmts: ['h', 'fill', 'v'] },
  { id: 'd2c',  icon: '🏗️', name: '二位數・進退位',    ex: '47 + 38、62 − 27', fmts: ['h', 'fill', 'v'] },
  { id: 'd3',   icon: '🏰', name: '三位數',           ex: '356 + 278', fmts: ['h', 'fill', 'v'] }
];
var FORMATS = [
  { id: 'h',     icon: '➡️', name: '橫式',     ex: '8 + 7 = □' },
  { id: 'fill',  icon: '🔲', name: '填空',     ex: '□ + 4 = 9' },
  { id: 'v',     icon: '⬇️', name: '直式',     ex: '一位一位算' },
  { id: 'chain', icon: '🔗', name: '連加連減', ex: '3 + 4 + 2' }
];
var SIGN = { '+': '+', '-': '−' };
var COL_NAME = ['個位', '十位', '百位', '千位'];

var cfg = { op: 'add', level: 'w10', fmt: 'h' };
try { var _saved = JSON.parse(localStorage.getItem('addsub-cfg') || 'null'); if (_saved) cfg = Object.assign(cfg, _saved); } catch (e) {}
var levelStatus = {};   // { 'w20c_add': 'practiced' | 'mastered' }
var round = null;
var lastMode = 'practice';

/* ══ 數字工具 ══ */
function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function digitAt(n, p) { return Math.floor(n / Math.pow(10, p)) % 10; }
function nDigits(n) { return String(n).length; }
/* 這一步有沒有進位／退位（只要有任一位 x 的位數不夠／超過就算） */
function hasCross(x, op, y) {
  for (var p = 0; p < 3; p++) {
    var dx = digitAt(x, p), dy = digitAt(y, p);
    if (op === '+' ? dx + dy >= 10 : dx < dy) return true;
  }
  return false;
}
function calc(x, op, y) { return op === '+' ? x + y : x - y; }

/* ══ 出題 ══ */
function genPair(level, op) {
  var wantCross = Math.random() < 0.75;
  for (var t = 0; t < 1000; t++) {
    var a, b;
    if (level === 'ten') { a = ri(1, 9); return op === '+' ? [a, 10 - a] : [10, a]; }
    if (level === 'w10') {
      if (op === '+') { a = ri(1, 9); b = ri(1, 10 - a); } else { a = ri(2, 10); b = ri(1, a - 1); }
      return [a, b];
    }
    if (level === 'w20n') {
      if (op === '+') { a = ri(11, 18); b = ri(1, 9); if (a % 10 + b > 9) continue; return Math.random() < 0.35 ? [b, a] : [a, b]; }
      a = ri(11, 19); b = ri(1, a % 10); return [a, b];
    }
    if (level === 'w20c') {
      if (op === '+') { a = ri(2, 9); b = ri(2, 9); if (a + b < 11) continue; return [a, b]; }
      a = ri(11, 18); b = ri(2, 9); if (b <= a % 10) continue; return [a, b];
    }
    if (level === 'd2n') {
      if (op === '+') { a = ri(10, 88); b = ri(10, 88); if (a + b > 99 || hasCross(a, '+', b)) continue; return [a, b]; }
      a = ri(21, 99); b = ri(10, a - 10); if (hasCross(a, '-', b)) continue; return [a, b];
    }
    if (level === 'd2c') {
      if (op === '+') { a = ri(11, 89); b = ri(11, 89); if (a + b > 99 || !hasCross(a, '+', b)) continue; return [a, b]; }
      a = ri(21, 98); b = ri(11, a - 1); if (!hasCross(a, '-', b)) continue; return [a, b];
    }
    if (level === 'd3') {
      if (op === '+') { a = ri(100, 899); b = ri(100, 899); if (a + b > 999) continue; }
      else { a = ri(201, 999); b = ri(100, a - 1); }
      if (wantCross && !hasCross(a, op, b)) continue;
      return [a, b];
    }
  }
  return op === '+' ? [3, 4] : [7, 2];
}

/* 連加連減：三個數，每一步的結果都在範圍內；w20n 每一步都不進退位，w20c 至少一步進退位 */
function genChain(level, opPick) {
  var limit = level === 'w10' ? 10 : 20;
  for (var t = 0; t < 2000; t++) {
    var ops = opPick === 'add' ? ['+', '+'] : opPick === 'sub' ? ['-', '-'] : pick([['+', '-'], ['-', '+']]);
    var first = (level === 'w10' || ops[0] === '+') ? ri(1, level === 'w10' ? 9 : 12) : ri(level === 'w10' ? 3 : 11, limit);
    var terms = [first, ri(1, 9), ri(1, 9)];
    var v = terms[0], ok = true, crossCnt = 0;
    for (var i = 0; i < 2; i++) {
      if (hasCross(v, ops[i], terms[i + 1])) crossCnt++;
      v = calc(v, ops[i], terms[i + 1]);
      if (v < 1 || v > limit) { ok = false; break; }
    }
    if (!ok) continue;
    if (level === 'w20n' && crossCnt) continue;
    if (level === 'w20c' && !crossCnt) continue;
    return { terms: terms, ops: ops, result: v };
  }
  return { terms: [3, 4, 2], ops: ['+', '+'], result: 9 };
}

function makeQuestion() {
  var fmt = cfg.fmt;
  var opId = cfg.op === 'mix' ? pick(['add', 'sub']) : cfg.op;
  var q;
  if (fmt === 'chain') {
    var c = genChain(cfg.level, cfg.op);
    q = { fmt: 'chain', terms: c.terms, ops: c.ops, result: c.result, unknown: 'r' };
  } else {
    var op = opId === 'add' ? '+' : '-';
    var p = genPair(cfg.level, op);
    q = { fmt: fmt, terms: p, ops: [op], result: calc(p[0], op, p[1]), unknown: 'r' };
    if (cfg.level === 'ten') q.unknown = op === '+' ? pick([0, 1]) : pick([1, 'r']);
    else if (fmt === 'fill') q.unknown = pick([0, 1]);
  }
  q.answer = q.unknown === 'r' ? q.result : q.terms[q.unknown];
  return q;
}

/* ══ 首頁選單 ══ */
function statusKey(level, op) { return level + '_' + op; }

function renderPickers() {
  var lv = LEVELS.find(function(l) { return l.id === cfg.level; }) || LEVELS[1];
  if (lv.fmts.indexOf(cfg.fmt) === -1) cfg.fmt = lv.fmts[0];

  function card(item, on, onclick, extraCls, disabled) {
    return '<button class="pick-card' + (on ? ' on' : '') + (extraCls || '') + '"' + (disabled ? ' disabled' : '') +
      ' onclick="' + onclick + '">' +
      '<span class="pick-icon">' + item.icon + '</span>' +
      '<span class="pick-name">' + item.name + '</span>' +
      '<span class="pick-ex">' + escHtml(item.ex) + '</span></button>';
  }
  document.getElementById('op-grid').innerHTML = OPS.map(function(o) {
    return card(o, o.id === cfg.op, "setCfg('op','" + o.id + "')");
  }).join('');
  document.getElementById('level-grid').innerHTML = LEVELS.map(function(l) {
    var st = levelStatus[statusKey(l.id, cfg.op)];
    return card(l, l.id === cfg.level, "setCfg('level','" + l.id + "')", st ? ' st-' + st : '');
  }).join('');
  document.getElementById('fmt-grid').innerHTML = FORMATS.map(function(f) {
    var ok = lv.fmts.indexOf(f.id) !== -1;
    return card(f, f.id === cfg.fmt, "setCfg('fmt','" + f.id + "')", '', !ok);
  }).join('');
}

function setCfg(k, v) {
  cfg[k] = v;
  try { localStorage.setItem('addsub-cfg', JSON.stringify(cfg)); } catch (e) {}
  renderPickers();
}

function showPage(name) {
  document.querySelectorAll('.page').forEach(function(el) { el.classList.remove('active'); });
  document.getElementById('page-' + name).classList.add('active');
  document.getElementById('topbar-back').classList.toggle('hidden', name === 'home');
  window.scrollTo(0, 0);
}

function goHome() { round = null; renderPickers(); showPage('home'); }

/* ══ 一輪 ══ */
function startRound(mode) {
  lastMode = mode;
  var qs = [];
  for (var i = 0; i < ROUND_SIZE; i++) qs.push(makeQuestion());
  round = { mode: mode, qs: qs, idx: 0, correct: 0, failed: [], roundNo: 1, firstRoundCorrect: 0,
            totalAnswered: 0, totalCorrect: 0 };
  var lv = LEVELS.find(function(l) { return l.id === cfg.level; });
  var op = OPS.find(function(o) { return o.id === cfg.op; });
  var fm = FORMATS.find(function(f) { return f.id === cfg.fmt; });
  document.getElementById('hud-mode').textContent =
    (mode === 'exam' ? '📝 測驗' : '🎯 練習') + '・' + op.name + '・' + lv.name + '・' + fm.name;
  showPage('game');
  renderQuestion();
}

function curQ() { return round.qs[round.idx]; }

function renderQuestion() {
  var q = curQ();
  q.tries = 0; q.done = false; q.mark = null;
  var hudR = document.getElementById('hud-round');
  hudR.classList.toggle('hidden', round.mode !== 'exam');
  hudR.textContent = 'Round ' + round.roundNo;
  document.getElementById('hud-progress').textContent = '第 ' + (round.idx + 1) + ' / ' + round.qs.length + ' 題';
  document.getElementById('hud-correct').textContent = round.correct;
  document.getElementById('q-hint').textContent =
    q.fmt === 'v' ? '用直式算，從個位開始填' : q.fmt === 'fill' || cfg.level === 'ten' ? '□ 裡應該填多少？' : '算算看，答案是多少？';
  resetInput(q);
  hideFeedback();
  setKeypad(true);
  renderInput();
}

/* ── 作答狀態 ── */
var inp = null;
function resetInput(q) {
  if (q.fmt === 'v') {
    var W = Math.max(nDigits(q.terms[0]), nDigits(q.terms[1]), nDigits(q.result));
    inp = { W: W, ans: [], carry: [], active: { t: 'ans', p: 0 }, lastAns: 0 };
    for (var i = 0; i < W; i++) { inp.ans.push(''); inp.carry.push(''); }
  } else {
    inp = { slot: '', max: nDigits(q.answer) + 1 };
  }
}

function inputValue() {
  if (!inp.ans) return inp.slot === '' ? null : parseInt(inp.slot, 10);
  var s = '', started = false;
  for (var p = inp.W - 1; p >= 0; p--) {
    if (inp.ans[p] === '') { if (started) return NaN; continue; }
    started = true; s += inp.ans[p];
  }
  return s === '' ? null : parseInt(s, 10);
}

function pressKey(k) {
  if (!round || curQ().done) return;
  if (k === 'ok') { submit(); return; }
  var q = curQ();
  q.mark = null;
  if (!inp.ans) {
    if (k === 'del') inp.slot = inp.slot.slice(0, -1);
    else if (inp.slot === '0') inp.slot = k;
    else if (inp.slot.length < inp.max) inp.slot += k;
  } else if (inp.active.t === 'carry') {
    var cp = inp.active.p;
    inp.carry[cp] = k === 'del' ? '' : k;
    inp.active = { t: 'ans', p: inp.lastAns };
  } else {
    var p = inp.active.p;
    if (k === 'del') {
      if (inp.ans[p] !== '') inp.ans[p] = '';
      else if (p > 0) { inp.active.p = p - 1; inp.ans[p - 1] = ''; }
    } else {
      inp.ans[p] = k;
      if (p + 1 < inp.W) inp.active.p = p + 1;
    }
    inp.lastAns = inp.active.p;
  }
  renderInput();
}

function selectCell(t, p) {
  if (!round || curQ().done || !inp.ans) return;
  if (t === 'ans') inp.lastAns = p;
  inp.active = { t: t, p: p };
  renderInput();
}

/* ── 題目畫面 ── */
function exprTokens(q, slotHtml) {
  var parts = [];
  function val(i) { return q.unknown === i ? slotHtml : '<span class="num">' + q.terms[i] + '</span>'; }
  parts.push(val(0));
  for (var i = 0; i < q.ops.length; i++) parts.push('<span class="op">' + SIGN[q.ops[i]] + '</span>', val(i + 1));
  parts.push('<span class="op">=</span>', q.unknown === 'r' ? slotHtml : '<span class="num">' + q.result + '</span>');
  return parts.join('');
}

function renderInput() {
  var q = curQ(), area = document.getElementById('q-area');
  if (q.fmt !== 'v') {
    var cls = 'slot' + (q.done ? '' : ' active') + (q.mark ? ' ' + q.mark : '');
    area.innerHTML = '<div class="expr">' + exprTokens(q, '<span class="' + cls + '">' + escHtml(inp.slot) + '</span>') + '</div>';
    return;
  }
  var W = inp.W, a = q.terms[0], b = q.terms[1], h = '';
  function digitCell(n, p) { return '<div class="vt-cell">' + (p < nDigits(n) ? digitAt(n, p) : '') + '</div>'; }
  /* 進位／借位小格（個位上方不需要） */
  h += '<div></div>';
  for (var p = W - 1; p >= 0; p--) {
    if (p === 0) { h += '<div></div>'; continue; }
    var act = !q.done && inp.active.t === 'carry' && inp.active.p === p;
    h += '<div class="vt-carry' + (inp.carry[p] ? ' filled' : '') + (act ? ' active' : '') + '" onclick="selectCell(\'carry\',' + p + ')">' + inp.carry[p] + '</div>';
  }
  h += '<div class="vt-cell"></div>';
  for (p = W - 1; p >= 0; p--) h += digitCell(a, p);
  h += '<div class="vt-cell vt-op">' + SIGN[q.ops[0]] + '</div>';
  for (p = W - 1; p >= 0; p--) h += digitCell(b, p);
  h += '<div class="vt-line" style="grid-column:1 / -1"></div>';
  h += '<div class="vt-cell"></div>';
  for (p = W - 1; p >= 0; p--) {
    var actA = !q.done && inp.active.t === 'ans' && inp.active.p === p;
    var mk = '';
    if (q.mark) {
      var want = p < nDigits(q.result) ? String(digitAt(q.result, p)) : '';
      mk = inp.ans[p] === want ? (want === '' ? '' : ' right') : ' wrong';
    }
    h += '<div class="vt-ans' + (actA ? ' active' : '') + mk + '" onclick="selectCell(\'ans\',' + p + ')">' + inp.ans[p] + '</div>';
  }
  area.innerHTML = '<div><div class="vt" style="grid-template-columns:repeat(' + (W + 1) + ',auto)">' + h + '</div>' +
    '<div class="vt-note">上面的小格可以寫進位、借位（不計分）</div></div>';
}

/* ══ 作答判定 ══ */
function submit() {
  var q = curQ();
  var v = inputValue();
  if (v === null) { showToast('先輸入答案喔'); return; }
  if (isNaN(v)) { showToast('中間還有格子沒填'); return; }
  q.tries++;
  if (v === q.answer) { onRight(q); return; }
  try { sfxWrong(); } catch (e) {}
  q.mark = 'wrong';
  /* 練習：一定要自己答對才能下一題，不給下一題按鈕。
     第一次錯給方法提示（不講答案）；之後再錯就公布解法，但答案還是要學生自己填進去 */
  if (round.mode === 'practice') {
    renderInput();
    if (q.tries === 1) showFeedback('hint', '💡 再想一想', explainHtml(q, false));
    else showFeedback('bad', '看看解法，再把答案填進去', explainHtml(q, true));
    /* 紅色留一下讓學生看到哪裡錯，再清掉重寫 */
    setTimeout(function() {
      if (curQ() !== q || q.done) return;
      q.mark = null; resetInput(q); renderInput();
    }, 900);
    return;
  }
  /* 測驗答錯：公布解法 */
  q.done = true;
  if (round.idx < round.qs.length && round.mode === 'exam') round.failed.push(q);
  revealAnswer(q);
  renderInput();
  setKeypad(false);
  showFeedback('bad', '答案是 ' + q.answer, explainHtml(q, true), true);
  round.totalAnswered++;
}

function onRight(q) {
  q.done = true; q.mark = 'right';
  var first = q.tries === 1;
  if (first || round.mode === 'exam') round.correct++;
  round.totalAnswered++; round.totalCorrect++;
  document.getElementById('hud-correct').textContent = round.correct;
  try { sfxCorrect(); } catch (e) {}
  renderInput();
  setKeypad(false);
  showFeedback('ok', first ? '⭕ 答對了！' : '⭕ 這次對了！', '');
  setTimeout(function() { if (curQ() === q) nextQuestion(); }, 900);
}

/* 把正確答案填進格子（綠色） */
function revealAnswer(q) {
  if (!inp.ans) { inp.slot = String(q.answer); }
  else for (var p = 0; p < inp.W; p++) inp.ans[p] = p < nDigits(q.result) ? String(digitAt(q.result, p)) : '';
  q.mark = 'right';
}

function nextQuestion() {
  if (!round || !curQ().done) return;
  round.idx++;
  if (round.idx >= round.qs.length) { finishRound(); return; }
  renderQuestion();
}

function setKeypad(on) {
  document.querySelectorAll('#keypad .key').forEach(function(k) { k.disabled = !on; });
}
function hideFeedback() {
  document.getElementById('feedback').classList.add('hidden');
  document.getElementById('btn-next').classList.add('hidden');
}
function showFeedback(kind, head, body, withNext) {
  var fb = document.getElementById('feedback');
  fb.classList.remove('hidden', 'is-ok', 'is-bad');
  if (kind === 'ok') fb.classList.add('is-ok');
  if (kind === 'bad') fb.classList.add('is-bad');
  document.getElementById('fb-head').textContent = head;
  document.getElementById('fb-body').innerHTML = body || '';
  var nb = document.getElementById('btn-next');
  nb.classList.toggle('hidden', !withNext);
  nb.textContent = round.idx + 1 >= round.qs.length ? '看結果 ▶' : '下一題 ▶';
  /* 解法比較長時會超出畫面，捲到看得到（下一題按鈕也要看得到） */
  if (kind !== 'ok') setTimeout(function() { try { fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {} }, 50);
}

/* ══ 一輪結束 ══ */
function finishRound() {
  var r = round, n = r.qs.length, c = r.correct;
  if (r.roundNo === 1) r.firstRoundCorrect = c;
  var icon = document.getElementById('result-icon'), title = document.getElementById('result-title');
  var score = document.getElementById('result-score'), sub = document.getElementById('result-sub');
  var again = document.getElementById('btn-again');
  score.innerHTML = '<b>' + c + '</b> / ' + n + ' 題答對';

  if (r.mode === 'exam' && r.failed.length) {
    icon.textContent = '📊';
    title.textContent = 'Round ' + r.roundNo + ' 結算';
    sub.textContent = '還有 ' + r.failed.length + ' 題要再挑戰，答對才算完成';
    again.textContent = '開始 Round ' + (r.roundNo + 1) + ' ▶';
    again.onclick = nextExamRound;
    showPage('result');
    return;
  }

  var key = statusKey(cfg.level, cfg.op), prev = levelStatus[key];
  if (r.mode === 'exam') {
    var passed = r.firstRoundCorrect >= MASTER_MIN;
    if (passed) levelStatus[key] = 'mastered';
    else if (prev !== 'mastered') levelStatus[key] = 'practiced';
    icon.textContent = passed ? '🏆' : '💪';
    title.textContent = passed ? '測驗通過！' : '全部完成！';
    score.innerHTML = '第一輪 <b>' + r.firstRoundCorrect + '</b> / ' + ROUND_SIZE + ' 題答對';
    sub.textContent = passed ? '這個範圍標上 ✓ 測驗通過'
      : '第一輪答對 ' + MASTER_MIN + ' 題以上才算通過，多練習再來測驗吧' + (r.roundNo > 1 ? '（共 ' + r.roundNo + ' 輪）' : '');
    try { passed ? sfxCelebrate() : sfxCorrect(); } catch (e) {}
  } else {
    if (!prev) levelStatus[key] = 'practiced';
    icon.textContent = c === n ? '🏆' : c >= n * 0.7 ? '🎉' : '💪';
    title.textContent = c === n ? '全部一次答對，太厲害了！' : c >= n * 0.7 ? '做得很好！' : '再練習一次吧！';
    sub.textContent = '一次就答對的題數';
    try { if (c === n) sfxCelebrate(); } catch (e) {}
  }
  again.textContent = '再一次';
  again.onclick = function() { startRound(lastMode); };
  saveProgress(r.totalCorrect, r.totalAnswered, key, levelStatus[key]);
  showPage('result');
}

/* 測驗下一輪：只考上一輪錯的（題目不換，讓學生把錯的弄懂） */
function nextExamRound() {
  var r = round;
  r.qs = r.failed.slice(); r.failed = []; r.idx = 0; r.correct = 0; r.roundNo++;
  showPage('game');
  renderQuestion();
}

/* ══ 提示／解法 ══ */
function numSpan(n) { return '<span class="fb-num">' + n + '</span>'; }
function eq(x, op, y, z, reveal) {
  return numSpan(x) + ' ' + SIGN[op] + ' ' + numSpan(y) + ' = ' + (reveal ? numSpan(z) : '？');
}

/* 填空題換成學生真正要算的那一條：□ + 4 = 9 → 9 − 4 */
function coreOf(q) {
  var a = q.terms[0], b = q.terms[1], c = q.result, op = q.ops[0];
  if (q.unknown === 'r') return { x: a, op: op, y: b, z: c };
  if (op === '+') return q.unknown === 0 ? { x: c, op: '-', y: b, z: a } : { x: c, op: '-', y: a, z: b };
  return q.unknown === 0 ? { x: c, op: '+', y: b, z: a } : { x: a, op: '-', y: c, z: b };
}

function explainHtml(q, reveal) {
  if (q.fmt === 'chain') return chainHint(q, reveal);
  var core = coreOf(q), lines = [];
  if (cfg.level === 'ten' && q.ops[0] === '+') {
    var known = q.terms[q.unknown === 0 ? 1 : 0];
    lines.push(numSpan(known) + ' 和多少合起來是 ' + numSpan(10) + '？點一點空格，數一數有幾個。');
    lines.push(tenFrames(known, reveal ? 10 - known : 0, 0, false));
    return lines.join('<br>');
  }
  if (q.unknown !== 'r') lines.push('可以想成：' + eq(core.x, core.op, core.y, core.z, reveal));
  /* 十格框只適合「其中一個數是一位數」的 20 以內；兩個都是十幾（13 − 11、10 + 10）改用直式說明 */
  var small = core.op === '+' ? (core.z <= 20 && (core.x < 10 || core.y < 10)) : (core.x <= 20 && core.y < 10);
  if (small) lines.push(smallHint(core, reveal));
  else lines.push(columnHint(core, reveal));
  return lines.join('<br>');
}

/* 20 以內：十格框＋湊十法／拆十法 */
function smallHint(c, reveal) {
  var x = c.x, y = c.y, h = '';
  if (c.op === '+') {
    if (x < 10 && y < 10 && x + y > 10) {
      var big = Math.max(x, y), small = Math.min(x, y), need = 10 - big;
      h = '湊十法：把 ' + numSpan(small) + ' 拆成 ' + numSpan(need) + ' 和 ' + numSpan(small - need) + '，' +
          eq(big, '+', need, 10, true) + '，' + eq(10, '+', small - need, x + y, reveal);
    } else if (x >= 10 || y >= 10) {
      var ten = x >= 10 ? x : y, one = x >= 10 ? y : x;
      h = '十位的 1 不變，個位 ' + eq(ten % 10, '+', one, ten % 10 + one, reveal) + (reveal ? '，所以是 ' + numSpan(x + y) : '');
    } else {
      h = reveal ? eq(x, '+', y, x + y, true) : numSpan(x) + ' 個再加 ' + numSpan(y) + ' 個，一共有幾個？';
    }
    return h + tenFrames(x, y, 0, false);
  }
  var cross = x > 10 && y > x % 10;
  if (cross) {
    h = '拆十法：把 ' + numSpan(x) + ' 拆成 ' + numSpan(10) + ' 和 ' + numSpan(x % 10) + '，' +
        eq(10, '-', y, 10 - y, true) + '，' + eq(10 - y, '+', x % 10, x - y, reveal);
  } else if (x > 10) {
    h = '十位的 1 不變，個位 ' + eq(x % 10, '-', y, x % 10 - y, reveal) + (reveal ? '，所以是 ' + numSpan(x - y) : '');
  } else {
    h = reveal ? eq(x, '-', y, x - y, true) : numSpan(x) + ' 個拿走 ' + numSpan(y) + ' 個，還剩幾個？';
  }
  return h + tenFrames(x, 0, y, cross);
}

/* 十格框：a 個藍點、b 個橘點；minus 個打叉（拆十法時從第一個整十框打叉） */
function tenFrames(a, b, minus, crossFromTen) {
  var total = a + b, frames = Math.max(1, Math.ceil(total / 10)), cells = [];
  for (var i = 0; i < frames * 10; i++) {
    var cls = '';
    if (i < a) cls = 'tf-a';
    else if (i < total) cls = 'tf-b';
    if (minus && i < a) {
      var crossed = crossFromTen ? (i >= 10 - minus && i < 10) : (i >= a - minus);
      if (crossed) cls = 'tf-x';
    }
    /* 每一格都畫格線，空格才數得出來 */
    cells.push(cls ? '<div class="tf-cell"><div class="tf-dot ' + cls + '"></div></div>'
                   : '<div class="tf-cell tf-empty"></div>');
  }
  var h = '<div class="tf-row">';
  for (var f = 0; f < frames; f++) h += '<div class="tf">' + cells.slice(f * 10, f * 10 + 10).join('') + '</div>';
  return h + '</div>';
}

/* 點數空格：點一下空格出現另一種顏色的圓，再點一下拿掉（滑鼠、觸控都用 Pointer Events） */
document.addEventListener('pointerdown', function(e) {
  var cell = e.target.closest && e.target.closest('.tf-empty');
  if (!cell) return;
  e.preventDefault();
  var dot = cell.querySelector('.tf-tap');
  if (dot) cell.removeChild(dot);
  else cell.insertAdjacentHTML('beforeend', '<div class="tf-dot tf-tap"></div>');
});

/* 二位數以上：直式逐位說明＋小直式（進位／借位用紅字標在上方） */
function columnHint(c, reveal) {
  var x = c.x, y = c.y, op = c.op, z = c.z;
  var W = Math.max(nDigits(x), nDigits(y), nDigits(z));
  var steps = [], marks = [], carry = 0;
  var xs = [];   // 減法：被減數各位「被借走之後」的值（借位會一路改寫）
  for (var k = 0; k < W; k++) xs.push(digitAt(x, k));
  for (var p = 0; p < W; p++) {
    var dx = digitAt(x, p), dy = digitAt(y, p), name = COL_NAME[p];
    if (p >= nDigits(x) && p >= nDigits(y) && !carry) break;
    if (op === '+') {
      var s = dx + dy + carry;
      var txt = name + '：' + numSpan(dx) + ' + ' + numSpan(dy) + (carry ? ' + ' + numSpan(1) + '（進位）' : '') + ' = ' + (reveal ? numSpan(s) : '？');
      if (s >= 10) { txt += '，滿十，寫 ' + (reveal ? numSpan(s % 10) : '？') + '，進 1 到' + COL_NAME[p + 1]; marks[p + 1] = '1'; }
      steps.push(txt);
      carry = s >= 10 ? 1 : 0;
    } else {
      var have = xs[p];
      var txt2 = name + '：' + (have !== dx ? (dx === 0 ? '0 借位後變成 ' : '被借走 1，剩 ') + numSpan(have) + '，' : '');
      if (have < dy) {
        /* 往左找第一個不是 0 的位數借；中間的 0 先變 10 再借出 1，剩 9 */
        var q = p + 1;
        while (q < W && xs[q] === 0) q++;
        xs[q] -= 1; marks[q] = String(xs[q]);
        for (var m = q - 1; m > p; m--) { xs[m] = 9; marks[m] = '9'; }
        txt2 += numSpan(have) + ' 不夠減 ' + numSpan(dy) + '，' +
          (q === p + 1 ? '向' + COL_NAME[q] + '借 1，'
                       : COL_NAME[p + 1] + '是 0 不能借，先向' + COL_NAME[q] + '借 1，' + COL_NAME[p + 1] + '變成 10 再借 1 給' + name + '（' + COL_NAME[p + 1] + '剩 9），') +
          eq(have + 10, '-', dy, have + 10 - dy, reveal);
      } else {
        txt2 += eq(have, '-', dy, have - dy, reveal);
      }
      steps.push(txt2);
    }
  }
  var g = '';
  for (p = W - 1; p >= 0; p--) g += '<div class="mv-carry">' + (marks[p] || '') + '</div>';
  g = '<div></div>' + g;
  g += '<div></div>'; for (p = W - 1; p >= 0; p--) g += '<div>' + (p < nDigits(x) ? digitAt(x, p) : '') + '</div>';
  g += '<div>' + SIGN[op] + '</div>'; for (p = W - 1; p >= 0; p--) g += '<div>' + (p < nDigits(y) ? digitAt(y, p) : '') + '</div>';
  g += '<div class="mv-line" style="grid-column:1 / -1;width:auto"></div>';
  g += '<div></div>'; for (p = W - 1; p >= 0; p--) g += '<div class="mv-ans">' + (reveal && p < nDigits(z) ? digitAt(z, p) : '') + '</div>';
  return '<div class="mini-vt" style="grid-template-columns:repeat(' + (W + 1) + ',auto)">' + g + '</div><br>' +
    '<span class="fb-steps">' + steps.join('<br>') + '</span>';
}

/* 連加連減：由左往右一步一步算 */
function chainHint(q, reveal) {
  var t = q.terms, o = q.ops, mid = calc(t[0], o[0], t[1]);
  if (!reveal) {
    return '由左往右算：先算 ' + eq(t[0], o[0], t[1], mid, false) + '，再把算出來的數 ' + SIGN[o[1]] + ' ' + numSpan(t[2]) +
      smallHint({ x: t[0], op: o[0], y: t[1], z: mid }, false);
  }
  return '由左往右算：<br>先算 ' + eq(t[0], o[0], t[1], mid, true) + '<br>再算 ' + eq(mid, o[1], t[2], q.result, true);
}

/* ══ 紀錄：students/{id}/progress/addsub ══ */
var currentStudent = null;
function saveProgress(correct, answered, key, st) {
  if (!db || !currentStudent) return;
  var inc = firebase.firestore.FieldValue.increment;
  var data = { totalCorrect: inc(correct), totalAnswered: inc(answered), totalRounds: inc(1),
               lastStudied: new Date().toISOString(), status: {} };
  if (st) data.status[key] = st;
  db.collection('students').doc(currentStudent.id).collection('progress').doc('addsub')
    .set(data, { merge: true })
    .catch(function(e) { console.warn('saveProgress error:', e); });
}

function loadProgress() {
  if (!db || !currentStudent) return;
  db.collection('students').doc(currentStudent.id).collection('progress').doc('addsub').get()
    .then(function(doc) {
      if (doc.exists) { levelStatus = doc.data().status || {}; renderPickers(); }
    }).catch(function() {});
}

function backToHub() {
  try { window.parent.postMessage({ type: 'addsub-back-to-hub' }, '*'); } catch (e) {}
}

/* ══ 鍵盤與觸控 ══ */
document.getElementById('keypad').addEventListener('click', function(e) {
  var b = e.target.closest('.key');
  if (b && !b.disabled) pressKey(b.dataset.k);
});
document.addEventListener('keydown', function(e) {
  if (!round || !document.getElementById('page-game').classList.contains('active')) return;
  var q = curQ();
  if (q.done) {
    if ((e.key === 'Enter' || e.key === ' ') && !document.getElementById('btn-next').classList.contains('hidden')) { e.preventDefault(); nextQuestion(); }
    return;
  }
  if (/^[0-9]$/.test(e.key)) { e.preventDefault(); pressKey(e.key); }
  else if (e.key === 'Backspace') { e.preventDefault(); pressKey('del'); }
  else if (e.key === 'Enter') { e.preventDefault(); pressKey('ok'); }
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
        loadProgress();
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
