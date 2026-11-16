/* divide.js — 除法趣：直式除法（數字鍵盤逐格作答）
 *
 * 範圍（LEVELS）：除以一位數／二位數 × 整除／有餘數。重點在除以二位數的「試商」。
 * 作答：直式的每一格都由學生自己寫（商、乘積、相減的差、移下來的數），系統依序亮起下一格；
 *       第一個商要寫在哪一位由學生自己點；直式寫完再寫橫式答案（商 … 餘數）。
 * 練習：每格寫完馬上檢查，第一次錯給提示（不講答案），再錯公布算法，但答案仍要自己填才能往下。
 * 測驗：直式任一格寫錯或橫式答錯，這題就算錯並公布解法；錯的下一輪再考，第一輪答對 9 題以上標「測驗通過」。
 * 進度存 students/{id}/progress/divide。
 * 依賴：shared.js（quApp、sfxCorrect、sfxWrong、sfxCelebrate、showToast、escHtml）
 */
'use strict';

var ROUND_SIZE = 10;
var MASTER_MIN = 9;   // 測驗第一輪答對幾題以上算通過

var LEVELS = [
  { id: 'd1e', icon: '🍎', name: '除以一位數・整除',   ex: '84 ÷ 4、612 ÷ 6',  div: 1, rem: false },
  { id: 'd1r', icon: '🍊', name: '除以一位數・有餘數', ex: '95 ÷ 4、743 ÷ 6',  div: 1, rem: true },
  { id: 'd2e', icon: '🧱', name: '除以二位數・整除',   ex: '672 ÷ 21、96 ÷ 24', div: 2, rem: false },
  { id: 'd2r', icon: '🏰', name: '除以二位數・有餘數', ex: '589 ÷ 23、87 ÷ 19', div: 2, rem: true }
];

var cfg = { level: 'd2e' };
try { var _saved = JSON.parse(localStorage.getItem('divide-cfg') || 'null'); if (_saved) cfg = Object.assign(cfg, _saved); } catch (e) {}
var levelStatus = {};   // { d2e: 'practiced' | 'mastered' }
var round = null;
var lastMode = 'practice';

function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function curLevel() { return LEVELS.find(function(l) { return l.id === cfg.level; }) || LEVELS[0]; }

/* ══ 直式版面 ══
 * 把 N ÷ d 拆成學生要寫的格子，依書寫順序排成 seq：
 *   est 除以二位數時，先在除數上方寫「把除數四捨五入成整十」的估計值（用來估商，乘的時候仍用原本的除數）
 *   q   商（寫在這一步被除數最後一位的上面）
 *   prod 除數 × 商（從個位往左寫）
 *   diff 相減的差（從個位往左寫；差是 0 而且後面還要移位時不寫 0，最後的餘數 0 要寫）
 *   bd  把被除數的下一位移下來
 * 不夠分的那一步（商 0）不寫乘積，直接再移下一位（課本的簡寫）。
 * rows 是商與被除數下面的每一列（乘積列、差列），cells 以被除數的位置（由左數 0 起）為欄。
 * 有一列會寫成「0 開頭的兩位以上」（例如 2400 ÷ 6 的 00）就不出這題，回傳 null。
 */
function buildLayout(N, d) {
  var D = String(N).split('').map(Number), n = D.length;
  var c = 0, P = D[0];
  while (P < d && c < n - 1) { c++; P = P * 10 + D[c]; }
  var L = { N: N, d: d, D: D, n: n, c0: c, q: Math.floor(N / d), r: N % d,
            rows: [], seq: [], want: {}, steps: [] };
  var cur = -1, curStart = 0;   // 這一步的被除數在哪一列（-1 = 被除數本身）、從哪一欄開始

  function push(item, rowIdx) {
    item.rowIdx = rowIdx;
    if (rowIdx >= 0) {
      var row = L.rows[rowIdx];
      row.cells[item.col] = item.want;
      row.idx[item.col] = L.seq.length;
      if (row.first === undefined) row.first = L.seq.length;
    }
    L.want[item.key] = item.want;
    L.seq.push(item);
  }

  if (d >= 10) {
    L.est = Math.round(d / 10) * 10;
    String(L.est).split('').forEach(function(ch, i) { push({ k: 'est', key: 'e_' + i, col: i, want: +ch }, -1); });
  }
  L.qFirst = L.seq.length;   // 第一個商在 seq 的位置（學生要自己點商寫在哪一位）

  for (;;) {
    var qd = Math.floor(P / d), base = { P: P, qd: qd, pRow: cur, pStart: curStart, pEnd: c };
    var step = { P: P, qd: qd, r: P, bring: null };
    push(Object.assign({ k: 'q', key: 'q_' + c, col: c, want: qd }, base), -1);
    if (qd > 0) {
      var prod = qd * d, ps = String(prod), r = P - prod, i;
      step.prod = prod; step.r = r;
      L.rows.push({ kind: 'prod', cells: {}, idx: {}, line: [curStart, c] });
      var pri = L.rows.length - 1, pStart = c - ps.length + 1;
      for (i = ps.length - 1; i >= 0; i--) {
        push(Object.assign({ k: 'prod', key: 'r' + pri + '_' + (pStart + i), col: pStart + i, want: +ps[i], prod: prod }, base), pri);
      }
      L.rows.push({ kind: 'diff', cells: {}, idx: {} });
      cur = L.rows.length - 1;
      var rs = (r > 0 || c === n - 1) ? String(r) : '', rStart = c - rs.length + 1;
      for (i = rs.length - 1; i >= 0; i--) {
        push(Object.assign({ k: 'diff', key: 'r' + cur + '_' + (rStart + i), col: rStart + i, want: +rs[i], prod: prod, diff: r }, base), cur);
      }
      curStart = rs ? rStart : null;
      P = r;
    }
    L.steps.push(step);
    if (c === n - 1) break;
    c++;
    if (curStart === null) curStart = c;
    push({ k: 'bd', key: 'r' + cur + '_' + c, col: c, want: D[c], zeroBefore: step.qd > 0 && step.r === 0 }, cur);
    P = P * 10 + D[c];
    step.bring = D[c]; step.next = P;
  }

  for (var k = 0; k < L.rows.length; k++) {
    var cols = Object.keys(L.rows[k].cells).map(Number).sort(function(a, b) { return a - b; });
    if (cols.length > 1 && L.rows[k].cells[cols[0]] === 0) return null;
  }
  return L;
}

/* ══ 出題：先決定除數、商、餘數，再算出被除數 ══ */
function makeQuestion(lv, used) {
  for (var t = 0; t < 3000; t++) {
    var d, nd;
    if (lv.div === 1) { d = ri(2, 9); nd = Math.random() < 0.35 ? 2 : 3; }
    /* 除數到 94 為止：95 以上估成 100，除數上方只有兩格寫不下 */
    else { do { d = ri(11, 94); } while (d % 10 === 0); nd = Math.random() < 0.2 ? 2 : 3; }
    var lo = nd === 2 ? 10 : 100, hi = nd === 2 ? 99 : 999;
    var r = lv.rem ? ri(1, d - 1) : 0;
    var qMin = Math.max(2, Math.ceil((lo - r) / d)), qMax = Math.floor((hi - r) / d);
    if (qMin > qMax) continue;
    var N = ri(qMin, qMax) * d + r;
    if (used[N + '/' + d]) continue;
    var L = buildLayout(N, d);
    if (!L) continue;
    used[N + '/' + d] = true;
    return { L: L };
  }
  return { L: buildLayout(lv.div === 1 ? 84 : 672, lv.div === 1 ? 4 : 21) };
}

/* ══ 首頁 ══ */
function renderPickers() {
  document.getElementById('level-grid').innerHTML = LEVELS.map(function(l) {
    var st = levelStatus[l.id];
    return '<button class="pick-card' + (l.id === cfg.level ? ' on' : '') + (st ? ' st-' + st : '') +
      '" onclick="setLevel(\'' + l.id + '\')">' +
      '<span class="pick-icon">' + l.icon + '</span>' +
      '<span class="pick-name">' + l.name + '</span>' +
      '<span class="pick-ex">' + escHtml(l.ex) + '</span></button>';
  }).join('');
}

function setLevel(id) {
  cfg.level = id;
  try { localStorage.setItem('divide-cfg', JSON.stringify(cfg)); } catch (e) {}
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
  var lv = curLevel(), used = {}, qs = [];
  for (var i = 0; i < ROUND_SIZE; i++) qs.push(makeQuestion(lv, used));
  round = { mode: mode, lv: lv, qs: qs, idx: 0, correct: 0, failed: [], roundNo: 1, firstRoundCorrect: 0,
            totalAnswered: 0, totalCorrect: 0 };
  document.getElementById('hud-mode').textContent = (mode === 'exam' ? '📝 測驗' : '🎯 練習') + '・' + lv.name;
  showPage('game');
  renderQuestion();
}

function curQ() { return round.qs[round.idx]; }

function renderQuestion() {
  var q = curQ();
  q.done = false; q.errors = 0; q.revealed = false;
  q.st = { pos: 0, qCol: 0, vals: {}, bad: null, errs: {}, placeErr: 0,
           phase: 'grid', h: { q: '', r: '', act: 'q', mark: null }, hErr: 0 };
  var hudR = document.getElementById('hud-round');
  hudR.classList.toggle('hidden', round.mode !== 'exam');
  hudR.textContent = 'Round ' + round.roundNo;
  document.getElementById('hud-progress').textContent = '第 ' + (round.idx + 1) + ' / ' + round.qs.length + ' 題';
  document.getElementById('hud-correct').textContent = round.correct;
  /* 除數的倍數表：只在練習、除以二位數時提供，預設收起來 */
  var showMult = round.mode === 'practice' && round.lv.div === 2;
  var mb = document.getElementById('btn-mult');
  mb.classList.toggle('hidden', !showMult);
  mb.textContent = '📋 ' + q.L.d + ' 的倍數';
  document.getElementById('mult-box').classList.add('hidden');
  document.getElementById('mult-box').innerHTML = multTable(q.L.d);
  hideFeedback();
  setKeypad(true);
  render();
}

function multTable(d) {
  var h = '';
  for (var i = 1; i <= 9; i++) h += '<div><span class="fb-num">' + d + ' × ' + i + ' = ' + d * i + '</span></div>';
  return h;
}
function toggleMult() { document.getElementById('mult-box').classList.toggle('hidden'); }

/* ── 畫面 ── */
var BRK_SVG = '<svg viewBox="0 0 20 60" preserveAspectRatio="none"><path d="M3 0 Q20 30 3 60" fill="none" stroke="currentColor" stroke-width="4" vector-effect="non-scaling-stroke"/></svg>';

function activeKey(q) {
  var s = q.st;
  if (q.done || s.phase !== 'grid') return null;
  return s.pos === q.L.qFirst ? 'q_' + s.qCol : q.L.seq[s.pos].key;
}

/* 目前這一步的被除數（或要移下來的那一位）用底色標出來；第一步不標，不然等於告訴學生商寫在哪 */
function highlightSet(q) {
  var s = q.st, hl = {};
  if (q.done || s.phase !== 'grid' || s.pos <= q.L.qFirst) return hl;
  var it = q.L.seq[s.pos];
  if (it.k === 'bd') { hl['D_' + it.col] = true; return hl; }
  for (var j = it.pStart; j <= it.pEnd; j++) hl[it.pRow < 0 ? 'D_' + j : 'r' + it.pRow + '_' + j] = true;
  return hl;
}

function cellHtml(q, key, row, col, act, hl, click) {
  var s = q.st, txt = '', cls = 'dv-in';
  if (s.bad && s.bad.key === key) { txt = s.bad.v; cls += ' bad'; }
  else if (s.vals[key] !== undefined) { txt = s.vals[key]; cls += ' filled'; }
  else if (q.revealed && q.L.want[key] !== undefined) { txt = q.L.want[key]; cls += ' filled shown'; }
  if (key === act) cls += ' active';
  if (hl[key]) cls += ' hl';
  return '<div class="' + cls + '" style="grid-row:' + row + ';grid-column:' + col + '"' + (click || '') + '>' + txt + '</div>';
}

function render() {
  var q = curQ(), L = q.L, s = q.st, m = String(L.d).length, n = L.n;
  var act = activeKey(q), hl = highlightSet(q), h = [];
  function colOf(j) { return m + 2 + j; }
  function put(row, col, span, cls, txt) {
    h.push('<div class="' + cls + '" style="grid-row:' + row + ';grid-column:' + col + (span > 1 ? ' / span ' + span : '') + '">' + txt + '</div>');
  }
  /* 第 1 列：商。還沒寫第一個商之前，每一位上面都有格子，讓學生自己決定從哪一位開始 */
  for (var j = 0; j < n; j++) {
    if (j < L.c0 && (q.done || s.pos > L.qFirst)) continue;
    h.push(cellHtml(q, 'q_' + j, 1, colOf(j), act, hl, !q.done && s.pos === L.qFirst ? ' onclick="selectQ(' + j + ')"' : ''));
  }
  /* 除數上方：估成的整十數 */
  if (L.est) String(L.est).split('').forEach(function(ch, i) { h.push(cellHtml(q, 'e_' + i, 1, i + 1, act, hl).replace('dv-in', 'dv-in dv-est')); });
  /* 第 2 列：除號的橫線；第 3 列：除數 ) 被除數 */
  put(2, m + 1, n + 1, 'dv-line', '');
  String(L.d).split('').forEach(function(ch, i) { put(3, i + 1, 1, 'dv-num dv-divisor', ch); });
  put(3, m + 1, 1, 'dv-brk', BRK_SVG);
  L.D.forEach(function(v, j) { put(3, colOf(j), 1, 'dv-num' + (hl['D_' + j] ? ' hl' : ''), v); });
  /* 下面的乘積列、差列：寫到哪裡才出現到哪裡 */
  var R = 4;
  for (var k = 0; k < L.rows.length; k++) {
    var row = L.rows[k];
    if (!q.done && row.first > s.pos) break;
    Object.keys(row.idx).forEach(function(col) {
      if (q.done || row.idx[col] <= s.pos) h.push(cellHtml(q, 'r' + k + '_' + col, R, colOf(+col), act, hl));
    });
    if (row.kind === 'prod') {
      put(R + 1, colOf(row.line[0]), row.line[1] - row.line[0] + 1, 'dv-line', '');
      R += 2;
    } else R += 1;
  }
  var grid = '<div class="dv" style="grid-template-columns:repeat(' + m + ',1.3em) .6em repeat(' + n + ',1.3em)">' + h.join('') + '</div>';

  /* 橫式答案 */
  var hz = '';
  if (s.phase === 'h' || q.done) {
    var needR = round.lv.rem;
    var slot = function(name) {
      var cls = 'slot' + (!q.done && s.h.act === name ? ' active' : '') + (s.h.mark && s.h.mark.slot === name ? ' ' + s.h.mark.cls : '');
      var v = s.h[name];
      if (q.revealed) { v = String(name === 'q' ? L.q : L.r); cls += ' right'; }
      return '<span class="' + cls + '"' + (q.done ? '' : ' onclick="selectSlot(\'' + name + '\')"') + '>' + escHtml(v) + '</span>';
    };
    hz = '<div class="dv-h"><span class="num">' + L.N + '</span><span class="op">÷</span><span class="num">' + L.d + '</span>' +
      '<span class="op">=</span>' + slot('q') + (needR ? '<span class="op">…</span>' + slot('r') : '') + '</div>';
  }
  document.getElementById('q-area').innerHTML = '<div class="dv-wrap">' + grid + hz + '</div>';
  document.getElementById('q-hint').textContent = stepLabel(q);
}

function stepLabel(q) {
  var s = q.st;
  if (q.done) return '';
  if (s.phase === 'h') return round.lv.rem ? '直式算完了！把答案寫成橫式：商 … 餘數' : '直式算完了！把答案寫成橫式';
  var it = q.L.seq[s.pos];
  if (it.k === 'est') return '先把除數 ' + q.L.d + ' 想成整十數（四捨五入），寫在 ' + q.L.d + ' 的上面';
  if (s.pos === q.L.qFirst) return '商要從哪一位開始寫？點那一格，寫上商';
  if (it.k === 'q') return q.L.est ? '用 ' + q.L.est + ' 估一估，寫上商' : '估一估，寫上商';
  if (it.k === 'prod') return q.L.est ? '乘乘看：用原本的除數 ' + q.L.d + ' × 商，從個位開始寫' : '乘乘看：除數 × 商，從個位開始寫';
  if (it.k === 'diff') return '減減看，從個位開始寫';
  return it.zeroBefore ? '減完剛好是 0（0 不用寫），把被除數的下一位移下來' : '把被除數的下一位移下來';
}

/* ══ 作答 ══ */
function selectQ(col) {
  if (!round) return;
  var q = curQ();
  if (q.done || q.st.pos !== q.L.qFirst) return;
  q.st.qCol = col; q.st.bad = null;
  render();
}

function selectSlot(name) {
  if (!round) return;
  var q = curQ();
  if (q.done || q.st.phase !== 'h') return;
  q.st.h.act = name;
  render();
}

function pressKey(k) {
  if (!round || curQ().done) return;
  var q = curQ(), s = q.st;
  if (s.phase === 'h') { pressH(q, k); return; }
  if (k === 'ok') { showToast('寫完一格會自動跳到下一格'); return; }
  if (s.bad) { s.bad = null; if (k === 'del') { render(); return; } }
  if (k === 'del') return;
  var v = +k, it = L_item(q);
  if (s.pos === q.L.qFirst && s.qCol !== it.col) { wrongCell(q, v, 'place'); return; }
  if (v !== it.want) { wrongCell(q, v, it.k); return; }
  s.vals[it.key] = v;
  s.pos++;
  if (s.pos >= q.L.seq.length) s.phase = 'h';
  hideFeedback();
  render();
}

function L_item(q) { return q.L.seq[q.st.pos]; }

function wrongCell(q, v, kind) {
  var s = q.st, it = L_item(q);
  q.errors++;
  try { sfxWrong(); } catch (e) {}
  if (round.mode === 'exam') { failQuestion(q); return; }
  var n = kind === 'place' ? ++s.placeErr : (s.errs[s.pos] = (s.errs[s.pos] || 0) + 1);
  var bad = { key: kind === 'place' ? 'q_' + s.qCol : it.key, v: v };
  s.bad = bad;
  var hint = hintHtml(q, kind, v, n);
  if (kind === 'place' && n >= 2) s.qCol = q.L.c0;   // 公布位置後游標移過去，商還是要自己寫
  if (n === 1) showFeedback('hint', '💡 再想一想', hint);
  else showFeedback('bad', '看看算法，再自己寫進去', hint);
  render();
  setTimeout(function() {
    if (round && curQ() === q && s.bad === bad) { s.bad = null; render(); }
  }, 900);
}

function pressH(q, k) {
  var s = q.st, h = s.h, needR = round.lv.rem;
  h.mark = null;
  if (k === 'ok') {
    if (h.act === 'q' && needR && h.r === '') { if (h.q === '') { showToast('先寫商'); return; } h.act = 'r'; render(); return; }
    submitH(q); return;
  }
  var max = String(h.act === 'q' ? q.L.q : q.L.r).length + 1;
  if (k === 'del') h[h.act] = h[h.act].slice(0, -1);
  else if (h[h.act] === '0') h[h.act] = k;
  else if (h[h.act].length < max) h[h.act] += k;
  render();
}

function submitH(q) {
  var s = q.st, h = s.h, L = q.L, needR = round.lv.rem;
  if (h.q === '') { showToast('先寫商'); return; }
  if (needR && h.r === '') { showToast('還要寫餘數'); h.act = 'r'; render(); return; }
  var qOk = +h.q === L.q, rOk = !needR || +h.r === L.r;
  if (qOk && rOk) { onRight(q); return; }
  q.errors++;
  try { sfxWrong(); } catch (e) {}
  if (round.mode === 'exam') { failQuestion(q); return; }
  s.hErr++;
  var slot = qOk ? 'r' : 'q';
  h.mark = { slot: slot, cls: 'wrong' };
  var body;
  if (s.hErr === 1) body = slot === 'q' ? '商就是直式最上面那一排的數' : '餘數就是直式最下面剩下來的數';
  else body = '直式上面的商是 ' + numSpan(L.q) + (needR ? '，最下面剩下 ' + numSpan(L.r) + '，所以寫成 ' + numSpan(L.N + ' ÷ ' + L.d + ' = ' + L.q + ' … ' + L.r) : '');
  showFeedback(s.hErr === 1 ? 'hint' : 'bad', s.hErr === 1 ? '💡 再想一想' : '看看答案，再自己寫進去', body);
  render();
  setTimeout(function() {
    if (round && curQ() === q && !q.done && h.mark) { h[slot] = ''; h.act = slot; h.mark = null; render(); }
  }, 900);
}

function onRight(q) {
  q.done = true;
  q.st.h.mark = { slot: 'q', cls: 'right' };
  var first = q.errors === 0;
  if (first) round.correct++;
  round.totalAnswered++; round.totalCorrect++;
  document.getElementById('hud-correct').textContent = round.correct;
  try { sfxCorrect(); } catch (e) {}
  render();
  document.querySelectorAll('#q-area .slot').forEach(function(el) { el.classList.add('right'); });
  setKeypad(false);
  showFeedback('ok', first ? '⭕ 全部答對了！' : '⭕ 完成了！', '');
  setTimeout(function() { if (round && curQ() === q) nextQuestion(); }, 1100);
}

/* 測驗寫錯：這題算錯，把整個直式與答案補上 */
function failQuestion(q) {
  q.done = true; q.revealed = true; q.st.bad = null; q.st.h.mark = null;
  round.failed.push(q);
  round.totalAnswered++;
  render();
  setKeypad(false);
  showFeedback('bad', '答案是 ' + answerText(q.L), solutionHtml(q.L), true);
}

function nextQuestion() {
  if (!round || !curQ().done) return;
  round.idx++;
  if (round.idx >= round.qs.length) { finishRound(); return; }
  renderQuestion();
}

/* ══ 提示／解法 ══ */
function numSpan(n) { return '<span class="fb-num">' + n + '</span>'; }
function answerText(L) { return L.N + ' ÷ ' + L.d + ' = ' + L.q + (round.lv.rem ? ' … ' + L.r : ''); }

function hintHtml(q, kind, v, n) {
  var L = q.L, d = L.d, it = L_item(q);
  if (kind === 'est') {
    var ones = d % 10;
    return n >= 2 ? numSpan(d) + ' 的個位是 ' + numSpan(ones) + '，' + (ones >= 5 ? '5 以上要進位' : '比 5 小要捨去') + '，所以想成 ' + numSpan(L.est)
                  : '把 ' + numSpan(d) + ' 四捨五入到十位：個位 4 以下捨去、5 以上進位，想成最接近的整十數';
  }
  if (kind === 'place') {
    var c0 = L.c0, P0 = it.P;
    if (n >= 2) return '被除數前面的 ' + numSpan(P0) + ' 才夠分給 ' + numSpan(d) + '，商要寫在 ' + numSpan(L.D[c0]) + ' 的上面';
    var qc = q.st.qCol;
    if (qc < c0) {
      var pre = +L.D.slice(0, qc + 1).join('');
      return numSpan(pre) + ' 比 ' + numSpan(d) + ' 小，不夠分，商不能寫在這一位。點旁邊的格子再寫';
    }
    return '前面的數就已經夠分給 ' + numSpan(d) + ' 了，商要寫在更前面的位置';
  }
  if (kind === 'q') {
    var P = it.P, qd = it.qd;
    if (n >= 2) {
      if (qd === 0) return numSpan(P) + ' 比 ' + numSpan(d) + ' 小，不夠分，商寫 ' + numSpan(0);
      return numSpan(d + ' × ' + qd + ' = ' + qd * d) + '，沒有超過 ' + numSpan(P) + '；' +
             numSpan(d + ' × ' + (qd + 1) + ' = ' + (qd + 1) * d) + '，超過了。所以商是 ' + numSpan(qd);
    }
    var t;
    if (v * d > P) t = numSpan(d + ' × ' + v + ' = ' + v * d) + '，比 ' + numSpan(P) + ' 大，不夠減，商要小一點';
    else t = numSpan(d + ' × ' + v + ' = ' + v * d) + '，' + numSpan(P + ' − ' + v * d + ' = ' + (P - v * d)) +
             '，剩下的比 ' + numSpan(d) + ' 大，還可以再分，商要大一點';
    if (L.est) t += '<br>用估的 ' + numSpan(L.est) + ' 想想 ' + numSpan(P) + ' 裡面大約有幾個 ' + numSpan(L.est) + '，再用 ' + numSpan(d) + ' 乘乘看';
    return t;
  }
  if (kind === 'prod') {
    /* 常見錯誤：拿估的整十數去乘（62 估成 60，就算成 60 × 商） */
    var usedEst = false;
    if (L.est) {
      var place = Math.pow(10, it.pEnd - it.col);
      usedEst = v === Math.floor(L.est * it.qd / place) % 10;
    }
    var warn = usedEst ? '乘的時候要用原本的除數 ' + numSpan(d) + '，不是估的 ' + numSpan(L.est) + ' 喔！<br>' : '';
    return warn + (n >= 2 ? numSpan(d + ' × ' + it.qd + ' = ' + it.prod) + '，照位置寫在被除數下面'
                          : '算算看 ' + numSpan(d + ' × ' + it.qd) + ' 是多少？從個位開始寫');
  }
  if (kind === 'diff') {
    return n >= 2 ? numSpan(it.P + ' − ' + it.prod + ' = ' + it.diff)
                  : '算算看 ' + numSpan(it.P + ' − ' + it.prod) + '，從個位開始減，不夠減要借位';
  }
  return n >= 2 ? '被除數的下一位是 ' + numSpan(it.want) + '，把它移下來寫在這一格'
                : '看看被除數的下一位（標了底色的那一位）是多少，把它移下來';
}

function solutionHtml(L) {
  var lines = [];
  if (L.est) lines.push('把 ' + numSpan(L.d) + ' 想成 ' + numSpan(L.est) + ' 來估商，乘的時候用 ' + numSpan(L.d));
  if (L.c0 > 0) lines.push('被除數前面的 ' + numSpan(L.steps[0].P) + ' 才夠分，商從 ' + numSpan(L.D[L.c0]) + ' 的上面開始寫');
  L.steps.forEach(function(st) {
    var t = st.qd > 0
      ? numSpan(st.P) + ' ÷ ' + numSpan(L.d) + '：商 ' + numSpan(st.qd) + '，' + numSpan(L.d + ' × ' + st.qd + ' = ' + st.prod) + '，' + numSpan(st.P + ' − ' + st.prod + ' = ' + st.r)
      : numSpan(st.P) + ' 比 ' + numSpan(L.d) + ' 小，不夠分，商寫 ' + numSpan(0);
    if (st.bring !== null) t += '，移下 ' + numSpan(st.bring) + ' → ' + numSpan(st.next);
    lines.push(t);
  });
  return '<span class="fb-steps">' + lines.join('<br>') + '</span>';
}

/* ══ 鍵盤、回饋 ══ */
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

  var key = r.lv.id, prev = levelStatus[key];
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
    sub.textContent = '一格都沒寫錯的題數';
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

/* ══ 紀錄：students/{id}/progress/divide（讀寫走 shared.js 的 quApp） ══ */
function saveProgress(correct, answered, key, st) {
  /* 沒有狀態要記的時候不要送空的 status：set + merge 遇到空物件會把整個 status 蓋成空的 */
  var extra = null;
  if (st) { extra = { status: {} }; extra.status[key] = st; }
  quApp.saveRound(correct, answered, extra);
}

function loadProgress() {
  quApp.loadProgress().then(function(data) {
    if (data) { levelStatus = data.status || {}; renderPickers(); }
  });
}

function backToHub() { quApp.backToHub(); }

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
  renderPickers();
  showPage('home');
  quApp.start({ id: 'divide', progress: 'divide', onReady: loadProgress });
});
