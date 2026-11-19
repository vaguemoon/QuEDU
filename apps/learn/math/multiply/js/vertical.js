/**
 * vertical.js — 直式乘法（練習＋測驗，數字鍵盤逐格作答）
 *
 * 範圍（VM_LEVELS）：二位數／三位數 × 一位數、二位數／三位數 × 二位數。
 * 作答：每一格都由學生自己寫，系統依序亮起下一格（寫到哪裡才出現到哪裡）：
 *   乘：從個位開始，寫積的個位 → 在被乘數下一位的上面寫進位（沒有進位按 0）；最前面一位乘出來的數全部寫下來。
 *   × 二位數：先乘個位寫第一列，再乘十位寫第二列（個位不寫 0，往左移一格），十位的進位寫在個位進位的上面一排；
 *   最後兩列相加，相加的進位寫在第二列下面。進位一定要寫（使用者決定）。
 * 練習：每格寫完馬上檢查，第一次錯給提示，再錯公布算法，答案仍要自己填才能往下。
 * 測驗：像在紙上寫，不檢查、不提示、不標底色，⌫ 往回擦一格；寫完按 ✓ 交卷整題批改，
 *       進位只是輔助不批改；錯的下一輪再考，第一輪答對九成以上標「測驗通過」。
 * 進度存 students/{id}/progress/multiply 的 verticalStatus.{level}，答題數併入 totalCorrect／totalAttempts。
 * 依賴：shared.js（sfxCorrect、sfxWrong、sfxCelebrate、showToast、escHtml）、nav.js、state.js
 */
'use strict';

var VM_COUNTS = [3, 5, 10];
var VM_LEVELS = [
  { id: 'v21', icon: '🍎', name: '二位數 × 一位數', ex: '47 × 6、83 × 4',     a: 2, b: 1 },
  { id: 'v31', icon: '🍊', name: '三位數 × 一位數', ex: '358 × 7、405 × 6',   a: 3, b: 1 },
  { id: 'v22', icon: '🧱', name: '二位數 × 二位數', ex: '46 × 23、78 × 35',   a: 2, b: 2 },
  { id: 'v32', icon: '🏰', name: '三位數 × 二位數', ex: '237 × 46、508 × 19', a: 3, b: 2 }
];

var vmCfg = { level: 'v21', count: 10 };
try { var _vmSaved = JSON.parse(localStorage.getItem('multiply-vertical-cfg') || 'null'); if (_vmSaved) vmCfg = Object.assign(vmCfg, _vmSaved); } catch (e) {}
var verticalStatus = {};   // { v21: 'practiced' | 'mastered' }（init.js 從 progress/multiply 載入）
var verticalBest = {};     // { v21: 3 | 5 | 10 }  測驗通過時最多的題數，決定外框顏色（init.js 載入）

/* 加上外框之前通過的沒有記題數，當作最少的 3 題 */
function vmBest(key) { return verticalStatus[key] === 'mastered' ? (verticalBest[key] || 3) : 0; }
var vmRound = null;
var vmLastMode = 'practice';

function vmRi(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function vmLevel() { return VM_LEVELS.find(function(l) { return l.id === vmCfg.level; }) || VM_LEVELS[0]; }
function vmMasterMin(n) { return Math.ceil(n * 0.9); }

/* ══ 直式版面 ══
 * 格子的 key 是「列名_位」，位由個位 0 往左數。列：
 *   c2 乘十位時的進位、c1 乘個位時的進位（都寫在被乘數上面）、A 被乘數、B 乘數、
 *   p1 第一列（× 個位）、p2 第二列（× 十位，從十位開始）、ac 相加的進位、sum 積
 * × 一位數只有 c1、A、B、p1（p1 就是積）。seq 是學生寫的順序。 */
function buildMul(A, B) {
  var Ad = String(A).split('').reverse().map(Number), Bd = String(B).split('').reverse().map(Number);
  var L = { A: A, B: B, P: A * B, a: Ad.length, b: Bd.length, Ad: Ad, Bd: Bd, W: String(A * B).length, seq: [], want: {} };
  function push(it) { L.want[it.key] = it.want; L.seq.push(it); }

  for (var k = 0; k < Bd.length; k++) {
    var m = Bd[k], pr = k ? 'p2' : 'p1', cr = k ? 'c2' : 'c1', cin = 0;
    for (var i = 0; i < Ad.length; i++) {
      var val = Ad[i] * m + cin, last = i === Ad.length - 1;
      var base = { mk: k, i: i, m: m, ai: Ad[i], cin: cin, val: val, last: last, cr: cr };
      push(Object.assign({ k: 'prod', key: pr + '_' + (i + k), want: val % 10 }, base));
      if (!last) {
        push(Object.assign({ k: 'carry', key: cr + '_' + (i + 1), want: Math.floor(val / 10) }, base));
        cin = Math.floor(val / 10);
      } else if (val >= 10) {
        push(Object.assign({ k: 'prod', key: pr + '_' + (i + 1 + k), want: Math.floor(val / 10), high: true }, base));
      }
    }
  }

  if (Bd.length === 2) {
    var p1 = String(A * Bd[0]).split('').reverse().map(Number);
    var p2 = [undefined].concat(String(A * Bd[1]).split('').reverse().map(Number));   // 往左移一格
    var top = Math.max(p1.length, p2.length) - 1, c = 0;
    L.sumFirst = L.seq.length;
    for (var j = 0; j <= top; j++) {
      var s = (p1[j] || 0) + (p2[j] || 0) + c;
      var sb = { j: j, d1: p1[j], d2: p2[j], cin: c, sum: s, last: j === top };
      push(Object.assign({ k: 'sum', key: 'sum_' + j, want: s % 10 }, sb));
      if (j < top) {
        /* 個位只有一個數，不會進位，不用寫 */
        if (j > 0) push(Object.assign({ k: 'acarry', key: 'ac_' + (j + 1), want: Math.floor(s / 10) }, sb));
        c = Math.floor(s / 10);
      } else if (s >= 10) {
        push(Object.assign({ k: 'sum', key: 'sum_' + (j + 1), want: Math.floor(s / 10), high: true }, sb));
      }
    }
  }
  return L;
}

/* ══ 出題 ══ */
function vmMakeQuestion(lv, used) {
  for (var t = 0; t < 500; t++) {
    var A = vmRi(Math.pow(10, lv.a - 1), Math.pow(10, lv.a) - 1), B;
    if (lv.b === 1) B = vmRi(2, 9);
    else do { B = vmRi(12, 99); } while (B % 10 === 0);   // 個位是 0 的乘數課本有另外的簡寫，不出
    if (A % 100 === 0 || used[A + 'x' + B]) continue;
    used[A + 'x' + B] = true;
    return { L: buildMul(A, B) };
  }
  return { L: buildMul(lv.a === 2 ? 47 : 358, lv.b === 1 ? 6 : 23) };
}

/* ══ 範圍選擇頁 ══ */
function initVertical() {
  vmRenderPickers();
  showPage('vertical');
}

function vmRenderPickers() {
  document.getElementById('vm-level-grid').innerHTML = VM_LEVELS.map(function(l) {
    var st = verticalStatus[l.id], best = vmBest(l.id);
    return '<button class="vm-pick' + (l.id === vmCfg.level ? ' on' : '') + (st ? ' st-' + st : '') + (best ? ' pass-' + best : '') +
      '" onclick="vmSetLevel(\'' + l.id + '\')">' +
      '<span class="vm-pick-icon">' + l.icon + '</span>' +
      '<span class="vm-pick-name">' + l.name + '</span>' +
      '<span class="vm-pick-ex">' + escHtml(l.ex) + '</span></button>';
  }).join('');
  if (VM_COUNTS.indexOf(vmCfg.count) < 0) vmCfg.count = 10;
  document.getElementById('vm-count-seg').innerHTML = VM_COUNTS.map(function(n) {
    return '<button class="vm-count-btn' + (n === vmCfg.count ? ' on' : '') + '" onclick="vmSetCount(' + n + ')">' + n + '</button>';
  }).join('');
}

function vmSaveCfg() { try { localStorage.setItem('multiply-vertical-cfg', JSON.stringify(vmCfg)); } catch (e) {} }
function vmSetLevel(id) { vmCfg.level = id; vmSaveCfg(); vmRenderPickers(); }
function vmSetCount(n) { vmCfg.count = n; vmSaveCfg(); vmRenderPickers(); }

function vmGoPicker() {
  vmRound = null;
  vmRenderPickers();
  PAGE_STACK = ['home', 'vertical'];
  showPage('vertical', false);
}

/* ══ 一輪 ══ */
function vmStartRound(mode) {
  vmLastMode = mode;
  var lv = vmLevel(), used = {}, qs = [];
  for (var i = 0; i < vmCfg.count; i++) qs.push(vmMakeQuestion(lv, used));
  vmRound = { mode: mode, lv: lv, qs: qs, idx: 0, correct: 0, failed: [], roundNo: 1,
              firstRoundCorrect: 0, firstRoundTotal: 0, totalAnswered: 0, totalCorrect: 0 };
  document.getElementById('vm-hud-mode').textContent = (mode === 'exam' ? '📝 測驗' : '🎯 練習') + '・' + lv.name;
  PAGE_STACK = ['home', 'vertical', 'vgame'];
  showPage('vgame', false);
  vmRenderQuestion();
}

function vmQ() { return vmRound.qs[vmRound.idx]; }

function vmRenderQuestion() {
  var q = vmQ();
  q.done = false; q.errors = 0; q.revealed = false;
  q.st = { pos: 0, vals: {}, bad: null, errs: {}, phase: 'grid', wrong: null };
  var hudR = document.getElementById('vm-hud-round');
  hudR.classList.toggle('hidden', vmRound.mode !== 'exam');
  hudR.textContent = 'Round ' + vmRound.roundNo;
  document.getElementById('vm-hud-progress').textContent = '第 ' + (vmRound.idx + 1) + ' / ' + vmRound.qs.length + ' 題';
  document.getElementById('vm-hud-correct').textContent = vmRound.correct;
  vmHideFeedback();
  vmSetKeypad(true);
  vmRender();
}

/* ── 畫面 ── */
function vmItem(q) { return q.L.seq[q.st.pos]; }
function vmActiveKey(q) { return q.done || q.st.phase !== 'grid' ? null : vmItem(q).key; }

/* 練習時用底色標出這一格要用到的數（測驗不標） */
function vmHighlight(q) {
  var hl = {};
  if (vmRound.mode === 'exam' || q.done || q.st.phase !== 'grid') return hl;
  var it = vmItem(q);
  if (it.k === 'prod' || it.k === 'carry') {
    hl['A_' + it.i] = hl['B_' + it.mk] = true;
    if (it.i > 0) hl[it.cr + '_' + it.i] = true;   // 上一位的進位
  } else {
    hl['p1_' + it.j] = hl['p2_' + it.j] = true;
    if (it.j > 1) hl['ac_' + it.j] = true;
  }
  return hl;
}

function vmCellHtml(q, key, row, col, act, hl, small) {
  var s = q.st, txt = '', cls = 'vm-in' + (small ? ' vm-small' : '');
  var isCarry = /^(c1|c2|ac)_/.test(key);
  if (s.bad && s.bad.key === key) { txt = s.bad.v; cls += ' bad'; }
  else if (s.wrong && s.wrong[key]) {
    /* 測驗批改：錯的格子補上正確數字，學生寫的劃掉放在角落 */
    txt = q.L.want[key] + (s.vals[key] !== undefined ? '<s class="vm-was">' + s.vals[key] + '</s>' : '');
    cls += ' filled fix';
  }
  else if (s.vals[key] !== undefined) { txt = isCarry && s.vals[key] === 0 ? '' : s.vals[key]; cls += ' filled'; }   // 沒有進位的 0 不顯示
  else if (q.revealed && q.L.want[key] !== undefined) { txt = isCarry && !q.L.want[key] ? '' : q.L.want[key]; cls += ' filled shown'; }
  if (key === act) cls += ' active';
  if (hl[key]) cls += ' hl';
  return '<div class="' + cls + '" style="grid-row:' + row + ';grid-column:' + col + '">' + txt + '</div>';
}

function vmRender() {
  var q = vmQ(), L = q.L, s = q.st, W = L.W;
  var act = vmActiveKey(q), hl = vmHighlight(q), h = [];
  var two = L.b === 2;
  var ROWS = two ? ['c2', 'c1', 'A', 'B', 'L1', 'p1', 'p2', 'ac', 'L2', 'sum'] : ['c1', 'A', 'B', 'L1', 'p1'];
  function rowOf(name) { return ROWS.indexOf(name) + 1; }
  function colOf(c) { return W + 1 - c; }   // 第 1 欄放 ×，位越高越左邊
  function put(row, col, span, cls, txt) {
    h.push('<div class="' + cls + '" style="grid-row:' + row + ';grid-column:' + col + (span > 1 ? ' / span ' + span : '') + '">' + txt + '</div>');
  }
  L.Ad.forEach(function(v, i) { put(rowOf('A'), colOf(i), 1, 'vm-num' + (hl['A_' + i] ? ' hl' : ''), v); });
  L.Bd.forEach(function(v, k) { put(rowOf('B'), colOf(k), 1, 'vm-num' + (hl['B_' + k] ? ' hl' : ''), v); });
  put(rowOf('B'), 1, 1, 'vm-num vm-op', '×');
  put(rowOf('L1'), 1, W + 1, 'vm-line', '');
  /* 學生要寫的格子：寫到哪裡才出現到哪裡 */
  L.seq.forEach(function(it, idx) {
    if (!q.done && idx > s.pos) return;
    var parts = it.key.split('_'), row = parts[0], c = +parts[1];
    h.push(vmCellHtml(q, it.key, rowOf(row), colOf(c), act, hl, row === 'c1' || row === 'c2' || row === 'ac'));
  });
  if (two && (q.done || s.pos >= L.sumFirst)) put(rowOf('L2'), 1, W + 1, 'vm-line', '');
  document.getElementById('vm-area').innerHTML =
    '<div class="vm-grid" style="grid-template-columns:repeat(' + (W + 1) + ',1.3em)">' + h.join('') + '</div>';
  document.getElementById('vm-hint').innerHTML = vmStepLabel(q);
}

function vmStepLabel(q) {
  var s = q.st;
  if (q.done) return '';
  if (s.phase === 'submit') return '寫好了嗎？按 ✓ 交卷';
  var it = vmItem(q), exam = vmRound.mode === 'exam';
  if (it.k === 'carry' || it.k === 'acarry') return '有進位就寫在上面的小格子，沒有進位按 0';
  if (exam) return '一格一格寫下去，寫錯可以按 ⌫ 擦掉';
  if (it.k === 'sum') return it.high ? '最前面一位，加出來的數全部寫下來' : '把兩列加起來，從個位開始寫';
  if (it.high) return '最前面一位，乘出來的數全部寫下來';
  if (it.last) return '最前面一位，乘出來的數全部寫下來，先寫個位';
  if (it.i === 0 && it.mk === 1) return '換用十位的 ' + it.m + ' 去乘，從十位開始寫（個位不寫 0）';
  if (it.i === 0) return '用 ' + it.m + ' 去乘，從個位開始寫';
  return '乘乘看，別忘了加上進位';
}

/* ══ 作答 ══ */
function vmPressKey(k) {
  if (!vmRound || vmQ().done) return;
  var q = vmQ(), s = q.st;
  if (vmRound.mode === 'exam') { vmPressExam(q, k); return; }
  if (s.bad) { s.bad = null; if (k === 'del') { vmRender(); return; } }
  if (k === 'del') return;
  var it = vmItem(q);
  if (k === 'ok') {
    if (it.k !== 'carry' && it.k !== 'acarry') { showToast('寫完一格會自動跳到下一格'); return; }
    k = '0';   // 進位格按 ✓ 當作「沒有進位」
  }
  var v = +k;
  if (v !== it.want) { vmWrong(q, v, it); return; }
  s.vals[it.key] = v;
  s.pos++;
  vmHideFeedback();
  if (s.pos >= q.L.seq.length) { vmOnRight(q); return; }
  vmRender();
}

function vmWrong(q, v, it) {
  var s = q.st;
  q.errors++;
  try { sfxWrong(); } catch (e) {}
  var n = s.errs[s.pos] = (s.errs[s.pos] || 0) + 1;
  s.bad = { key: it.key, v: v };
  var body = vmHintHtml(it, v, n);
  if (n === 1) vmShowFeedback('hint', '💡 再想一想', body);
  else vmShowFeedback('bad', '看看算法，再自己寫進去', body);
  /* 寫錯的數字用紅色留在格子裡對照提示，按下一個鍵才換掉 */
  vmRender();
}

function vmNum(n) { return '<span class="vm-fb-num">' + n + '</span>'; }

function vmHintHtml(it, v, n) {
  if (it.k === 'prod') {
    var expr = it.m + ' × ' + it.ai + (it.cin ? ' + ' + it.cin : '');
    if (it.high) return '前面算出 ' + vmNum(expr + ' = ' + it.val) + '，十位的 ' + vmNum(Math.floor(it.val / 10)) + ' 也要寫下來';
    var forgot = it.cin && v === (it.m * it.ai) % 10 ? '別忘了加上進位 ' + vmNum(it.cin) + ' 喔！<br>' : '';
    if (n >= 2) return forgot + vmNum(expr + ' = ' + it.val) + '，' + (it.last ? '全部寫下來，這一格寫 ' : '這一格寫個位 ') + vmNum(it.val % 10);
    return forgot + '算算看 ' + vmNum(it.m + ' × ' + it.ai) + (it.cin ? ' 再加上進位 ' + vmNum(it.cin) : '') + ' 是多少？' + (it.last ? '先寫個位' : '這一格寫個位');
  }
  if (it.k === 'carry') {
    var c = Math.floor(it.val / 10);
    if (it.val < 10) return '剛剛算出 ' + vmNum(it.val) + '，不到 10，沒有進位，按 ' + vmNum(0);
    return '剛剛算出 ' + vmNum(it.val) + '，十位的 ' + (n >= 2 ? vmNum(c) + ' ' : '') + '要進位，寫在上面';
  }
  var adds = [it.d1, it.d2].filter(function(x) { return x !== undefined; });
  var sumExpr = adds.join(' + ') + (it.cin ? ' + ' + it.cin : '');
  if (it.k === 'acarry') {
    if (it.sum < 10) return '剛剛加出 ' + vmNum(it.sum) + '，不到 10，沒有進位，按 ' + vmNum(0);
    return '剛剛加出 ' + vmNum(it.sum) + '，十位的 ' + (n >= 2 ? vmNum(Math.floor(it.sum / 10)) + ' ' : '') + '要進位，寫在上面';
  }
  if (it.high) return '前面加出 ' + vmNum(it.sum) + '，十位的 ' + vmNum(Math.floor(it.sum / 10)) + ' 也要寫下來';
  var forgotA = it.cin && v === (it.sum - it.cin) % 10 ? '別忘了加上進位 ' + vmNum(it.cin) + ' 喔！<br>' : '';
  if (n >= 2) return forgotA + vmNum(sumExpr + ' = ' + it.sum) + '，這一格寫 ' + vmNum(it.sum % 10);
  return forgotA + (adds.length === 1 && !it.cin ? '這一行只有 ' + vmNum(adds[0]) + '，直接寫下來' : '把這一行的數加起來' + (it.cin ? '，還有進位 ' + vmNum(it.cin) : ''));
}

/* 測驗：寫什麼都收下，照順序跳下一格，交卷時才批改 */
function vmPressExam(q, k) {
  var s = q.st;
  if (k === 'del') { vmErase(q); return; }
  if (s.phase === 'submit') {
    if (k === 'ok') vmGrade(q);
    return;
  }
  var it = vmItem(q);
  if (k === 'ok') {
    if (it.k !== 'carry' && it.k !== 'acarry') { showToast('還沒寫完'); return; }
    k = '0';
  }
  s.vals[it.key] = +k;
  s.pos++;
  if (s.pos >= q.L.seq.length) s.phase = 'submit';
  vmRender();
}

function vmErase(q) {
  var s = q.st;
  if (s.pos === 0) return;
  s.phase = 'grid';
  s.pos--;
  delete s.vals[q.L.seq[s.pos].key];
  vmRender();
}

/* 測驗交卷：積的每一格（含部分積）都對才算對；進位只是輔助，不批改 */
function vmGrade(q) {
  var s = q.st, wrong = {};
  q.L.seq.forEach(function(it) {
    if (it.k !== 'carry' && it.k !== 'acarry' && s.vals[it.key] !== it.want) wrong[it.key] = true;
  });
  if (!Object.keys(wrong).length) { vmOnRight(q); return; }
  q.errors++;
  s.wrong = wrong;
  try { sfxWrong(); } catch (e) {}
  q.done = true; q.revealed = true;
  vmRound.failed.push(q);
  vmRound.totalAnswered++;
  vmRender();
  vmSetKeypad(false);
  vmShowFeedback('bad', '答案是 ' + q.L.A + ' × ' + q.L.B + ' = ' + q.L.P, '紅框是寫錯的地方，綠色是正確的數字', true);
}

function vmOnRight(q) {
  q.done = true;
  var first = q.errors === 0;
  if (first) vmRound.correct++;
  vmRound.totalAnswered++; vmRound.totalCorrect++;
  document.getElementById('vm-hud-correct').textContent = vmRound.correct;
  try { sfxCorrect(); } catch (e) {}
  vmRender();
  vmSetKeypad(false);
  vmShowFeedback('ok', first ? '⭕ 全部答對了！' : '⭕ 完成了！', vmNum(q.L.A + ' × ' + q.L.B + ' = ' + q.L.P));
  setTimeout(function() { if (vmRound && vmQ() === q) vmNextQuestion(); }, 1100);
}

function vmNextQuestion() {
  if (!vmRound || !vmQ().done) return;
  vmRound.idx++;
  if (vmRound.idx >= vmRound.qs.length) { vmFinishRound(); return; }
  vmRenderQuestion();
}

/* ══ 鍵盤、回饋 ══ */
function vmSetKeypad(on) {
  document.querySelectorAll('#vm-keypad .vm-key').forEach(function(b) { b.disabled = !on; });
}
function vmHideFeedback() {
  document.getElementById('vm-feedback').classList.add('hidden');
  document.getElementById('vm-btn-next').classList.add('hidden');
}
function vmShowFeedback(kind, head, body, withNext) {
  var fb = document.getElementById('vm-feedback');
  fb.classList.remove('hidden', 'is-ok', 'is-bad');
  if (kind === 'ok' || kind === 'bad') fb.classList.add('is-' + kind);
  document.getElementById('vm-fb-head').textContent = head;
  document.getElementById('vm-fb-body').innerHTML = body || '';
  var nb = document.getElementById('vm-btn-next');
  nb.classList.toggle('hidden', !withNext);
  nb.textContent = vmRound.idx + 1 >= vmRound.qs.length ? '看結果 ▶' : '下一題 ▶';
}

/* ══ 一輪結束 ══ */
function vmFinishRound() {
  var r = vmRound, n = r.qs.length, c = r.correct;
  if (r.roundNo === 1) { r.firstRoundCorrect = c; r.firstRoundTotal = n; }
  var icon = document.getElementById('vm-result-icon'), title = document.getElementById('vm-result-title');
  var score = document.getElementById('vm-result-score'), sub = document.getElementById('vm-result-sub');
  var again = document.getElementById('vm-btn-again');
  score.innerHTML = '<b>' + c + '</b> / ' + n + ' 題答對';

  if (r.mode === 'exam' && r.failed.length) {
    icon.textContent = '📊';
    title.textContent = 'Round ' + r.roundNo + ' 結算';
    sub.textContent = '還有 ' + r.failed.length + ' 題要再挑戰，答對才算完成';
    again.textContent = '開始 Round ' + (r.roundNo + 1) + ' ▶';
    again.onclick = vmNextExamRound;
    showPage('vresult', false);
    return;
  }

  var key = r.lv.id, prev = verticalStatus[key];
  if (r.mode === 'exam') {
    var total = r.firstRoundTotal, need = vmMasterMin(total), passed = r.firstRoundCorrect >= need;
    var newBest = 0;
    if (passed) {
      if (total > vmBest(key)) newBest = verticalBest[key] = total;
      verticalStatus[key] = 'mastered';
    } else if (prev !== 'mastered') verticalStatus[key] = 'practiced';
    icon.textContent = passed ? '🏆' : '💪';
    title.textContent = passed ? '測驗通過！' : '全部完成！';
    score.innerHTML = '第一輪 <b>' + r.firstRoundCorrect + '</b> / ' + total + ' 題答對';
    sub.textContent = passed ? (newBest ? '這個範圍換上 ' + total + ' 題通過的' + { 3: '綠', 5: '金', 10: '彩虹' }[total] + '色外框'
        : '這個範圍已經有 ' + vmBest(key) + ' 題通過的外框了')
      : '第一輪' + (need === total ? '要全部答對' : '答對 ' + need + ' 題以上') + '才算通過，多練習再來測驗吧' + (r.roundNo > 1 ? '（共 ' + r.roundNo + ' 輪）' : '');
    try { passed ? sfxCelebrate() : sfxCorrect(); } catch (e) {}
  } else {
    if (!prev) verticalStatus[key] = 'practiced';
    icon.textContent = c === n ? '🏆' : c >= n * 0.7 ? '🎉' : '💪';
    title.textContent = c === n ? '全部一次答對，太厲害了！' : c >= n * 0.7 ? '做得很好！' : '再練習一次吧！';
    sub.textContent = '一格都沒寫錯的題數';
    try { if (c === n) sfxCelebrate(); } catch (e) {}
  }
  again.textContent = '再一次';
  again.onclick = function() { vmStartRound(vmLastMode); };
  vmSaveProgress(r.totalCorrect, r.totalAnswered, key, verticalStatus[key], r.mode === 'exam' && newBest);
  vmRenderPickers();   // 按返回回到選範圍頁時要看到新的狀態
  showPage('vresult', false);
}

/* 測驗下一輪：只考上一輪錯的（題目不換） */
function vmNextExamRound() {
  var r = vmRound;
  r.qs = r.failed.slice(); r.failed = []; r.idx = 0; r.correct = 0; r.roundNo++;
  showPage('vgame', false);
  vmRenderQuestion();
}

/* ══ 紀錄：students/{id}/progress/multiply（verticalStatus 是 map，set + merge 會逐欄合併） ══ */
function vmSaveProgress(correct, answered, key, st, best) {
  totalCorrect += correct;
  totalAttempts += answered;
  if (!db || !currentStudent) return;
  var data = { totalCorrect: totalCorrect, totalAttempts: totalAttempts, lastStudied: new Date().toISOString() };
  if (st) { data.verticalStatus = {}; data.verticalStatus[key] = st; }
  if (best) { data.verticalBest = {}; data.verticalBest[key] = best; }
  db.collection('students').doc(currentStudent.id).collection('progress').doc('multiply')
    .set(data, { merge: true })
    .catch(function(e) { console.warn('vmSaveProgress error:', e); });
}

/* ══ 鍵盤與觸控 ══ */
document.getElementById('vm-keypad').addEventListener('click', function(e) {
  var b = e.target.closest('.vm-key');
  if (b && !b.disabled) vmPressKey(b.dataset.k);
});
document.addEventListener('keydown', function(e) {
  if (currentPage !== 'vgame' || !vmRound) return;
  if (vmQ().done) {
    if ((e.key === 'Enter' || e.key === ' ') && !document.getElementById('vm-btn-next').classList.contains('hidden')) { e.preventDefault(); vmNextQuestion(); }
    return;
  }
  if (/^[0-9]$/.test(e.key)) { e.preventDefault(); vmPressKey(e.key); }
  else if (e.key === 'Backspace') { e.preventDefault(); vmPressKey('del'); }
  else if (e.key === 'Enter') { e.preventDefault(); vmPressKey('ok'); }
});
