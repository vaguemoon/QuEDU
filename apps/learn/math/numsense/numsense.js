/* numsense.js — 基礎數感：低年級的數感（不考計算）
 *
 * 項目（ITEMS）：
 *   數字的寫法  國字 → 數字，十位／個位分兩格由左往右填，專治「十二寫成 21」「五十三寫成 35」
 *   位值        看積木寫數、53 = □ 個十 □ 個一、□ 個十和 □ 個一合起來
 *   數的順序    一個一個往後數／倒著數／2 個 2 個數／5 個、10 個一數，數列填空
 *   百數表      看左右、看上下（多 10 少 10）、只看到一小塊的拼圖塊
 *   單數與雙數  20 以內看圓點兩兩配對、100 以內看個位
 * 練習：一定要自己答對才能下一題；第一次錯給方法提示（不講答案），之後再錯公布解法但答案要自己填。
 * 測驗：每題一次機會，錯的下一輪重考，第一輪答對 9 題以上該程度標「測驗通過」。
 * 進度存 students/{id}/progress/numsense（totalCorrect、status.{item_level}）。
 * 依賴：shared.js（db、initFirebase、sfxCorrect、sfxWrong、sfxCelebrate、showToast、escHtml、pickBestZhVoice）
 */
'use strict';

var ROUND_SIZE = 10;
var MASTER_MIN = 9;
var MIX = { id: 'mix', icon: '🔀', name: '綜合', ex: '上面幾種混合' };

var ITEMS = [
  { id: 'write', icon: '✏️', name: '數字的寫法', ex: '五十三 → 53', levels: [
    { id: 'teen', icon: '🔟', name: '十幾', ex: '十二 → 12' },
    { id: 'tens', icon: '🧱', name: '幾十幾', ex: '五十三 → 53' },
    { id: 'mix',  icon: '🔀', name: '綜合（含整十）', ex: '三十 → 30、十七 → 17' }
  ] },
  { id: 'place', icon: '🟦', name: '位值', ex: '53 是 5 個十和 3 個一', levels: [
    { id: 'blocks', icon: '🧱', name: '看積木寫數', ex: '5 條十、3 個一 → 53' },
    { id: 'split',  icon: '✂️', name: '拆成幾個十、幾個一', ex: '53 = □ 個十 □ 個一' },
    { id: 'join',   icon: '🔗', name: '合起來是多少', ex: '5 個十和 3 個一 = □' },
    MIX
  ] },
  { id: 'seq', icon: '🔢', name: '數的順序', ex: '23、24、□、26', levels: [
    { id: 'up',    icon: '➡️', name: '一個一個往後數', ex: '47、48、□、50' },
    { id: 'down',  icon: '⬅️', name: '倒著數', ex: '52、51、□、49' },
    { id: 'by2',   icon: '2️⃣', name: '2 個 2 個數', ex: '14、16、□、20' },
    { id: 'by510', icon: '🖐️', name: '5 個、10 個一數', ex: '15、20、□、30' },
    MIX
  ] },
  { id: 'chart', icon: '🗓️', name: '百數表', ex: '找出被遮住的數', levels: [
    { id: 'lr',    icon: '↔️', name: '看左右', ex: '46 的右邊是 □' },
    { id: 'ud',    icon: '↕️', name: '看上下', ex: '36 的下面是 □' },
    { id: 'piece', icon: '🧩', name: '拼圖塊', ex: '只看到一小塊' },
    MIX
  ] },
  { id: 'oddeven', icon: '⚖️', name: '單數與雙數', ex: '7 是單數、8 是雙數', levels: [
    { id: 'e20',  icon: '🔵', name: '20 以內（看圓點）', ex: '13 → 單數' },
    { id: 'e100', icon: '💯', name: '100 以內（看個位）', ex: '48 → 雙數' }
  ] }
];

var cfg = { item: 'write', level: 'teen' };
try { var _saved = JSON.parse(localStorage.getItem('numsense-cfg') || 'null'); if (_saved) cfg = Object.assign(cfg, _saved); } catch (e) {}
var levelStatus = {};   // { 'write_teen': 'practiced' | 'mastered' }
var round = null;
var lastMode = 'practice';

/* ══ 工具 ══ */
function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function itemOf(id) { return ITEMS.find(function(i) { return i.id === id; }); }
function levelOf(item, id) { return itemOf(item).levels.find(function(l) { return l.id === id; }); }

var CN_D = '零一二三四五六七八九';
/* 1～99 的國字讀法：十二、二十、五十三（開頭的一十讀成十） */
function cnNum(n) {
  if (n < 10) return CN_D[n];
  var t = Math.floor(n / 10), o = n % 10;
  return (t === 1 ? '' : CN_D[t]) + '十' + (o ? CN_D[o] : '');
}
function numSpan(n, cls) { return '<span class="fb-num' + (cls ? ' ' + cls : '') + '">' + n + '</span>'; }

/* ══ 出題 ══ */
function makeQuestion() {
  var it = itemOf(cfg.item), lv = cfg.level;
  if (lv === 'mix' && cfg.item !== 'write') lv = pick(it.levels.filter(function(l) { return l.id !== 'mix'; })).id;
  var q = { item: cfg.item, level: lv };
  ({ write: genWrite, place: genPlace, seq: genSeq, chart: genChart, oddeven: genOddEven })[cfg.item](q);
  return q;
}

/* 十位／個位兩格（數字的寫法、位值共用） */
function digitSlots(n) {
  return [{ ans: String(Math.floor(n / 10)), w: 1, lab: '十位', cls: 'ten' },
          { ans: String(n % 10),             w: 1, lab: '個位', cls: 'one' }];
}

function genWrite(q) {
  var n;
  if (q.level === 'teen') n = Math.random() < 0.1 ? 10 : ri(11, 19);
  else if (q.level === 'tens') n = Math.random() < 0.2 ? ri(2, 9) * 10 : ri(21, 99);
  else n = Math.random() < 0.25 ? ri(1, 9) * 10 : ri(11, 99);
  q.n = n; q.slots = digitSlots(n);
}

function genPlace(q) {
  var n = ri(1, 9) * 10 + (Math.random() < 0.12 ? 0 : ri(1, 9));
  q.n = n;
  q.slots = q.level === 'split'
    ? [{ ans: String(Math.floor(n / 10)), w: 1, cls: 'ten' }, { ans: String(n % 10), w: 1, cls: 'one' }]
    : digitSlots(n);
}

function genSeq(q) {
  var step, start, len = 5;
  for (var t = 0; t < 200; t++) {
    if (q.level === 'up' || q.level === 'down') {
      step = q.level === 'up' ? 1 : -1;
      /* 一半的題目跨過整十（48、49、50…），最容易卡住 */
      var base = Math.random() < 0.5 ? ri(1, 9) * 10 - ri(1, 3) : ri(1, 95);
      start = step > 0 ? base : base + 4;
    } else if (q.level === 'by2') {
      step = 2; start = ri(1, 90);
    } else if (Math.random() < 0.5) {
      step = 5; start = ri(1, 15) * 5;
    } else {
      step = 10; start = ri(1, 9) + (Math.random() < 0.4 ? 0 : 10 * ri(0, 4));  /* 3、13、23… 十位在變 */
    }
    var last = start + step * (len - 1);
    if (Math.min(start, last) >= 1 && Math.max(start, last) <= 100) break;
  }
  q.list = [];
  for (var i = 0; i < len; i++) q.list.push(start + step * i);
  q.step = step;
  q.blank = Math.random() < 0.2 ? 0 : ri(1, len - 1);
  q.slots = [{ ans: String(q.list[q.blank]), w: 3 }];
}

/* 百數表：1～100 排成 10 × 10；row = 第幾排（0 起）、col = 第幾格 */
function hcRow(n) { return Math.floor((n - 1) / 10); }
function hcCol(n) { return (n - 1) % 10; }

function genChart(q) {
  var t, ref, hidden = {};
  if (q.level === 'piece') {
    var c;
    do { c = ri(12, 89); } while (hcCol(c) === 0 || hcCol(c) === 9);
    t = pick([c - 1, c + 1, c - 10, c + 10]);
    q.center = c; q.target = t; q.ref = c;
    q.slots = [{ ans: String(t), w: 3 }];
    return;
  }
  if (q.level === 'lr') {
    t = ri(2, 99);
    ref = hcCol(t) === 0 ? t + 1 : hcCol(t) === 9 ? t - 1 : t + pick([-1, 1]);
  } else {
    t = ri(11, 90);
    ref = t + pick([-10, 10]);
    if (ref < 1 || ref > 100) ref = t - 10;
    /* 左右都遮住，只能看上下 */
    if (hcCol(t) > 0) hidden[t - 1] = true;
    if (hcCol(t) < 9) hidden[t + 1] = true;
  }
  for (var n = 1; n <= 100; n++) if (Math.random() < 0.3) hidden[n] = true;
  hidden[t] = true;
  delete hidden[ref];
  q.target = t; q.ref = ref; q.hidden = hidden;
  q.slots = [{ ans: String(t), w: 3 }];
}

function genOddEven(q) {
  q.n = q.level === 'e20' ? ri(1, 20) : ri(21, 99);
  q.choices = ['單數', '雙數'];
  q.answerIdx = q.n % 2 === 1 ? 0 : 1;
}

/* ══ 首頁選單 ══ */
function statusKey(item, level) { return item + '_' + level; }

function renderPickers() {
  var it = itemOf(cfg.item) || ITEMS[0];
  if (!it.levels.some(function(l) { return l.id === cfg.level; })) cfg.level = it.levels[0].id;
  function card(x, on, onclick, extraCls) {
    return '<button class="pick-card' + (on ? ' on' : '') + (extraCls || '') + '" onclick="' + onclick + '">' +
      '<span class="pick-icon">' + x.icon + '</span>' +
      '<span class="pick-name">' + x.name + '</span>' +
      '<span class="pick-ex">' + escHtml(x.ex) + '</span></button>';
  }
  document.getElementById('item-grid').innerHTML = ITEMS.map(function(i) {
    return card(i, i.id === cfg.item, "setItem('" + i.id + "')");
  }).join('');
  document.getElementById('level-grid').innerHTML = it.levels.map(function(l) {
    var st = levelStatus[statusKey(cfg.item, l.id)];
    return card(l, l.id === cfg.level, "setLevel('" + l.id + "')", st ? ' st-' + st : '');
  }).join('');
}
function saveCfg() { try { localStorage.setItem('numsense-cfg', JSON.stringify(cfg)); } catch (e) {} }
function setItem(id) { if (cfg.item !== id) { cfg.item = id; cfg.level = itemOf(id).levels[0].id; } saveCfg(); renderPickers(); }
function setLevel(id) { cfg.level = id; saveCfg(); renderPickers(); }

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
  document.getElementById('hud-mode').textContent = (mode === 'exam' ? '📝 測驗' : '🎯 練習') + '・' +
    itemOf(cfg.item).name + '・' + levelOf(cfg.item, cfg.level).name;
  showPage('game');
  renderQuestion();
}

function curQ() { return round.qs[round.idx]; }

var Q_HINT = {
  write: '寫成數字：先填十位，再填個位',
  blocks: '一條是 10，數一數，寫成數字',
  split: '把數拆開',
  join: '合起來是多少？先填十位，再填個位',
  seq: '□ 裡應該是多少？',
  chart: '百數表裡藍色的格子是多少？',
  oddeven: '這個數是單數還是雙數？'
};

var inp = null;   // { vals: [...], active: 0 }
function renderQuestion() {
  var q = curQ();
  q.tries = 0; q.done = false; q.mark = null; q.showRef = false; q.wrongIdx = -1;
  var hudR = document.getElementById('hud-round');
  hudR.classList.toggle('hidden', round.mode !== 'exam');
  hudR.textContent = 'Round ' + round.roundNo;
  document.getElementById('hud-progress').textContent = '第 ' + (round.idx + 1) + ' / ' + round.qs.length + ' 題';
  document.getElementById('hud-correct').textContent = round.correct;
  document.getElementById('q-hint').textContent = Q_HINT[q.item === 'place' ? q.level : q.item];
  resetInput(q);
  hideFeedback();
  document.querySelector('.game-body').classList.toggle('no-keypad', !q.slots);
  setKeypad(true);
  renderArea();
  if (q.item === 'write') sayCn(q.n);
}

function resetInput(q) {
  inp = { vals: (q.slots || []).map(function() { return ''; }), active: 0 };
}

/* ── 作答格 ── */
function slotHtml(i) {
  var q = curQ(), s = q.slots[i];
  var cls = 'slot';
  if (!q.done && inp.active === i) cls += ' active';
  if (q.mark) cls += ' ' + q.mark;
  return '<span class="' + cls + '" data-slot="' + i + '">' + escHtml(inp.vals[i]) + '</span>';
}
function pvSlots() {
  var q = curQ();
  return '<div class="pv">' + q.slots.map(function(s, i) {
    return '<div class="pv-label ' + s.cls + '">' + s.lab + '</div>' + slotHtml(i);
  }).join('') + '</div>';
}

/* 積木：t 條十、o 個一 */
function blocksHtml(t, o) {
  var rods = '', ones = '';
  for (var i = 0; i < t; i++) rods += '<div class="blk-rod">' + new Array(11).join('<i></i>') + '</div>';
  for (var j = 0; j < o; j++) ones += '<div class="blk-one"></div>';
  return '<div class="blocks">' +
    (t ? '<div><div class="blk-tens">' + rods + '</div></div>' : '') +
    (o ? '<div><div class="blk-ones">' + ones + '</div></div>' : '') + '</div>';
}

function chartHtml(q) {
  var h = '', n;
  if (q.level === 'piece') {
    var c = q.center, cells = [c - 11, c - 10, c - 9, c - 1, c, c + 1, c + 9, c + 10, c + 11];
    cells.forEach(function(v, i) {
      if (i % 2 === 0 && i !== 4) { h += '<div class="hc-c none"></div>'; return; }
      h += chartCell(q, v, v === c ? false : true);
    });
    return '<div class="hc hc-piece">' + h + '</div>';
  }
  for (n = 1; n <= 100; n++) h += chartCell(q, n, !!q.hidden[n]);
  return '<div class="hc">' + h + '</div>';
}
function chartCell(q, n, hid) {
  if (n === q.target) {
    var cls = 'hc-c target' + (q.mark === 'right' ? ' right' : '');
    return '<div class="' + cls + '" data-slot="0">' + (inp.vals[0] ? escHtml(inp.vals[0]) : '?') + '</div>';
  }
  if (q.showRef && n === q.ref) return '<div class="hc-c ref">' + n + '</div>';
  return '<div class="hc-c' + (hid ? ' hid' : '') + '">' + (hid ? '' : n) + '</div>';
}

function renderArea() {
  var q = curQ(), area = document.getElementById('q-area'), h = '';
  if (q.item === 'write') {
    h = '<div class="cn-word">' + cnNum(q.n) + '<button class="btn-say" onclick="sayCn(curQ().n)" title="再聽一次">🔊</button></div>' + pvSlots();
  } else if (q.item === 'place') {
    var t = Math.floor(q.n / 10), o = q.n % 10;
    if (q.level === 'blocks') h = blocksHtml(t, o) + pvSlots();
    else if (q.level === 'split') h = '<div class="q-text">' + numSpan(q.n) + ' = ' + slotHtml(0) + ' 個十 和 ' + slotHtml(1) + ' 個一</div>';
    else h = '<div class="q-text"><span class="c-ten">' + numSpan(t) + ' 個十</span> 和 <span class="c-one">' + numSpan(o) + ' 個一</span> 合起來是</div>' + pvSlots();
  } else if (q.item === 'seq') {
    h = '<div class="seq">' + q.list.map(function(v, i) {
      return i === q.blank ? slotHtml(0) : '<span>' + v + '</span>';
    }).join('<span class="sep">、</span>') + '</div>';
  } else if (q.item === 'chart') {
    h = '<div class="hc-wrap">' + chartHtml(q) + '</div>';
  } else {
    h = '<div class="big-num">' + q.n + '</div><div class="choice-row">' + q.choices.map(function(c, i) {
      var cls = 'choice-btn';
      if (q.done && i === q.answerIdx) cls += ' right';
      else if (i === q.wrongIdx) cls += ' wrong';
      return '<button class="' + cls + '"' + (q.done || i === q.wrongIdx ? ' disabled' : '') + ' onclick="choose(' + i + ')">' + c + '</button>';
    }).join('') + '</div>';
  }
  area.innerHTML = h;
}

/* 國字唸給學生聽（不會唸國字也能作答） */
var _zhVoice = null;
function sayCn(n) {
  try {
    if (!window.speechSynthesis) return;
    if (!_zhVoice) _zhVoice = pickBestZhVoice(speechSynthesis.getVoices());
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(cnNum(n));
    u.lang = 'zh-TW'; u.rate = 0.85;
    if (_zhVoice) u.voice = _zhVoice;
    speechSynthesis.speak(u);
  } catch (e) {}
}
try { if (window.speechSynthesis) speechSynthesis.onvoiceschanged = function() { _zhVoice = pickBestZhVoice(speechSynthesis.getVoices()); }; } catch (e) {}

/* ── 鍵盤輸入 ── */
function pressKey(k) {
  if (!round) return;
  var q = curQ();
  if (q.done || !q.slots) return;
  if (k === 'ok') { submit(); return; }
  q.mark = null;
  var a = inp.active, s = q.slots[a];
  if (k === 'del') {
    if (inp.vals[a] !== '') inp.vals[a] = inp.vals[a].slice(0, -1);
    else if (a > 0) { inp.active = a - 1; inp.vals[a - 1] = ''; }
  } else {
    if (inp.vals[a] === '0' && s.w > 1) inp.vals[a] = k;
    else if (inp.vals[a].length < s.w) inp.vals[a] += k;
    else if (s.w === 1) inp.vals[a] = k;
    /* 一格一個數字的，填完自動跳到下一格（十位 → 個位） */
    if (s.w === 1 && a + 1 < q.slots.length) inp.active = a + 1;
  }
  renderArea();
}

function selectSlot(i) {
  if (!round) return;
  var q = curQ();
  if (q.done || !q.slots || i >= q.slots.length) return;
  inp.active = i;
  renderArea();
}

/* ══ 作答判定 ══ */
function submit() {
  var q = curQ();
  for (var i = 0; i < q.slots.length; i++) {
    if (inp.vals[i] === '') { showToast(q.slots.length > 1 ? '還有格子沒填' : '先輸入答案喔'); return; }
  }
  q.tries++;
  var ok = q.slots.every(function(s, i) { return parseInt(inp.vals[i], 10) === parseInt(s.ans, 10); });
  if (ok) { onRight(q); return; }
  onWrong(q);
}

function choose(i) {
  if (!round) return;
  var q = curQ();
  if (q.done || i === q.wrongIdx) return;
  q.tries++;
  if (i === q.answerIdx) { onRight(q); return; }
  q.wrongIdx = i;
  onWrong(q);
}

/* 十位、個位寫反了（21 ↔ 12）——這個 App 最想抓的錯 */
function isSwapped(q) {
  if (!q.slots || q.slots.length !== 2 || q.level === 'split') return false;
  return inp.vals[0] === q.slots[1].ans && inp.vals[1] === q.slots[0].ans && q.slots[0].ans !== q.slots[1].ans;
}

function onWrong(q) {
  try { sfxWrong(); } catch (e) {}
  var swapped = isSwapped(q);
  q.mark = 'wrong';
  if (round.mode === 'practice') {
    /* 練習：一定要自己答對才能下一題，不給下一題按鈕 */
    if (q.tries >= 2) q.showRef = true;
    if (q.tries === 1) q.showRef = q.item === 'chart';
    renderArea();
    var head = swapped ? '🔄 十位和個位寫反了！' : q.tries === 1 ? '💡 再想一想' : '看看解法，再把答案填進去';
    showFeedback(q.tries === 1 || swapped ? 'hint' : 'bad', head, explainHtml(q, q.tries >= 2));
    setTimeout(function() {
      if (curQ() !== q || q.done) return;
      q.mark = null; resetInput(q); renderArea();
    }, 900);
    return;
  }
  /* 測驗答錯：公布答案，錯的下一輪重考 */
  q.done = true;
  if (round.idx < round.qs.length) round.failed.push(q);
  revealAnswer(q);
  renderArea();
  setKeypad(false);
  showFeedback('bad', (swapped ? '十位和個位寫反了！' : '答案是 ') + answerText(q), explainHtml(q, true), true);
  round.totalAnswered++;
}

function answerText(q) {
  if (q.choices) return q.choices[q.answerIdx];
  if (q.item === 'place' && q.level === 'split') return q.slots[0].ans + ' 個十 和 ' + q.slots[1].ans + ' 個一';
  return String(q.item === 'seq' || q.item === 'chart' ? q.slots[0].ans : q.n);
}

function onRight(q) {
  q.done = true; q.mark = 'right';
  var first = q.tries === 1;
  if (first || round.mode === 'exam') round.correct++;
  round.totalAnswered++; round.totalCorrect++;
  document.getElementById('hud-correct').textContent = round.correct;
  try { sfxCorrect(); } catch (e) {}
  renderArea();
  setKeypad(false);
  showFeedback('ok', first ? '⭕ 答對了！' : '⭕ 這次對了！', '');
  setTimeout(function() { if (round && curQ() === q) nextQuestion(); }, 900);
}

function revealAnswer(q) {
  if (q.slots) q.slots.forEach(function(s, i) { inp.vals[i] = s.ans; });
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
  if (kind !== 'ok') setTimeout(function() { try { fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {} }, 50);
}

/* ══ 提示／解法（reveal=false 只講方法，true 連答案一起） ══ */
function pvTable(n) {
  return '<div class="pvt"><div class="h-ten">十位</div><div class="h-one">個位</div>' +
    '<div class="d d-ten">' + Math.floor(n / 10) + '</div><div class="d d-one">' + (n % 10) + '</div></div>';
}

function explainHtml(q, reveal) {
  var t, o, L = [];
  if (q.item === 'write') {
    t = Math.floor(q.n / 10); o = q.n % 10;
    var tenWord = t === 1 ? '十' : CN_D[t] + '十', oneWord = o ? CN_D[o] : '';
    if (!reveal) {
      L.push('「<span class="c-ten">' + tenWord + '</span>」是幾個十？寫在<span class="c-ten">十位</span>（左邊）。');
      L.push(o ? '「<span class="c-one">' + oneWord + '</span>」是幾個一？寫在<span class="c-one">個位</span>（右邊）。'
               : '後面沒有幾個一了，<span class="c-one">個位</span>要寫幾？');
      L.push(blocksHtml(t, o));
    } else {
      L.push('「<span class="c-ten">' + tenWord + '</span>」是 ' + numSpan(t, 'c-ten') + ' 個十 → 十位寫 ' + numSpan(t, 'c-ten'));
      L.push(o ? '「<span class="c-one">' + oneWord + '</span>」是 ' + numSpan(o, 'c-one') + ' 個一 → 個位寫 ' + numSpan(o, 'c-one')
               : '沒有一 → 個位寫 ' + numSpan(0, 'c-one'));
      L.push(pvTable(q.n) + '<br>' + cnNum(q.n) + ' 寫成 ' + numSpan(q.n));
    }
    return L.join('<br>');
  }
  if (q.item === 'place') {
    t = Math.floor(q.n / 10); o = q.n % 10;
    if (!reveal) {
      if (q.level === 'blocks') L.push('一條是 10。數一數有幾條，寫在<span class="c-ten">十位</span>；再數單個的有幾個，寫在<span class="c-one">個位</span>。');
      else if (q.level === 'split') L.push(numSpan(q.n) + ' 的<span class="c-ten">十位</span>是幾，就是幾個十；<span class="c-one">個位</span>是幾，就是幾個一。');
      else L.push('幾個十寫在<span class="c-ten">十位</span>，幾個一寫在<span class="c-one">個位</span>。');
      if (q.level !== 'blocks') L.push(blocksHtml(t, o));
    } else {
      L.push(numSpan(t, 'c-ten') + ' 個十 和 ' + numSpan(o, 'c-one') + ' 個一 合起來是 ' + numSpan(q.n));
      L.push(pvTable(q.n));
    }
    return L.join('<br>');
  }
  if (q.item === 'seq') {
    var st = q.step, word = st > 0 ? '多 ' + st : '少 ' + (-st);
    if (!reveal) return '看看排在一起的數：後面的數都比前面的' + word + '。' +
      '<div class="seq-arrows">' + q.list.slice(1).map(function() { return '<span class="seq-step">' + (st > 0 ? '+' + st : '−' + (-st)) + '</span>'; }).join('') + '</div>';
    if (q.blank > 0) {
      var prev = q.list[q.blank - 1];
      return numSpan(prev) + ' 再' + word + '是 ' + numSpan(q.list[q.blank]) + '（' + numSpan(prev) + ' ' + (st > 0 ? '+' : '−') + ' ' + Math.abs(st) + ' = ' + numSpan(q.list[q.blank]) + '）';
    }
    var nx = q.list[1];
    return '□ 在最前面：比後面的 ' + numSpan(nx) + ' 往回' + (st > 0 ? '少 ' + st : '多 ' + (-st)) + '，是 ' + numSpan(q.list[0]);
  }
  if (q.item === 'chart') {
    var d = q.target - q.ref;
    var where = d === 1 ? '右邊' : d === -1 ? '左邊' : d === 10 ? '下面' : '上面';
    var rule = d === 1 ? '往右一格多 1' : d === -1 ? '往左一格少 1' : d === 10 ? '往下一格多 10' : '往上一格少 10';
    if (!reveal) return '黃色的格子是 ' + numSpan(q.ref) + '，藍色格子在它的' + where + '。百數表' + rule + '。';
    return numSpan(q.ref) + (d > 0 ? ' + ' : ' − ') + Math.abs(d) + ' = ' + numSpan(q.target) + '（' + rule + '）';
  }
  /* 單雙數 */
  var n = q.n, k = q.level === 'e20' ? n : n % 10;
  var pairs = '<div class="pairs">';
  for (var i = 0; i < Math.floor(k / 2); i++) pairs += '<div class="pair"><div class="dot"></div><div class="dot"></div></div>';
  if (k % 2) pairs += '<div class="pair' + (reveal ? ' lone' : '') + '"><div class="dot"></div><div></div></div>';
  pairs += '</div>';
  var ans = q.choices[q.answerIdx];
  if (q.level === 'e20') {
    if (!reveal) return '兩個兩個一組，看看最後有沒有剩下一個。' + pairs;
    return pairs + (k % 2 ? '剩下 1 個沒有配對，' : '剛好全部配對，') + numSpan(n) + ' 是' + ans + '。';
  }
  if (!reveal) return '看<span class="c-one">個位</span>就知道：個位是 0、2、4、6、8 是雙數；1、3、5、7、9 是單數。';
  return numSpan(n) + ' 的個位是 ' + numSpan(k, 'c-one') + '，' + k + ' 是' + ans + '，所以 ' + numSpan(n) + ' 是' + ans + '。' + (k ? pairs : '');
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

  var key = statusKey(cfg.item, cfg.level), prev = levelStatus[key];
  if (r.mode === 'exam') {
    var passed = r.firstRoundCorrect >= MASTER_MIN;
    if (passed) levelStatus[key] = 'mastered';
    else if (prev !== 'mastered') levelStatus[key] = 'practiced';
    icon.textContent = passed ? '🏆' : '💪';
    title.textContent = passed ? '測驗通過！' : '全部完成！';
    score.innerHTML = '第一輪 <b>' + r.firstRoundCorrect + '</b> / ' + ROUND_SIZE + ' 題答對';
    sub.textContent = passed ? '這個程度標上 ✓ 測驗通過'
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

/* 測驗下一輪：只考上一輪錯的（題目不換） */
function nextExamRound() {
  var r = round;
  r.qs = r.failed.slice(); r.failed = []; r.idx = 0; r.correct = 0; r.roundNo++;
  showPage('game');
  renderQuestion();
}

/* ══ 紀錄：students/{id}/progress/numsense ══ */
var currentStudent = null;
function saveProgress(correct, answered, key, st) {
  if (!db || !currentStudent) return;
  var inc = firebase.firestore.FieldValue.increment;
  var data = { totalCorrect: inc(correct), totalAnswered: inc(answered), totalRounds: inc(1),
               lastStudied: new Date().toISOString(), status: {} };
  if (st) data.status[key] = st;
  db.collection('students').doc(currentStudent.id).collection('progress').doc('numsense')
    .set(data, { merge: true })
    .catch(function(e) { console.warn('saveProgress error:', e); });
}

function loadProgress() {
  if (!db || !currentStudent) return;
  db.collection('students').doc(currentStudent.id).collection('progress').doc('numsense').get()
    .then(function(doc) {
      if (doc.exists) { levelStatus = doc.data().status || {}; renderPickers(); }
    }).catch(function() {});
}

function backToHub() {
  try { window.parent.postMessage({ type: 'numsense-back-to-hub' }, '*'); } catch (e) {}
}

/* ══ 鍵盤與觸控 ══ */
document.getElementById('keypad').addEventListener('click', function(e) {
  var b = e.target.closest('.key');
  if (b && !b.disabled) pressKey(b.dataset.k);
});
/* 點作答格（含百數表的藍色格子）切換要填哪一格；滑鼠、觸控共用 Pointer Events */
document.getElementById('q-area').addEventListener('pointerdown', function(e) {
  var s = e.target.closest('[data-slot]');
  if (s) selectSlot(parseInt(s.dataset.slot, 10));
});
document.addEventListener('keydown', function(e) {
  if (!round || !document.getElementById('page-game').classList.contains('active')) return;
  var q = curQ();
  if (q.done) {
    if ((e.key === 'Enter' || e.key === ' ') && !document.getElementById('btn-next').classList.contains('hidden')) { e.preventDefault(); nextQuestion(); }
    return;
  }
  if (q.choices) {
    if (e.key === '1' || e.key === 'ArrowLeft') { e.preventDefault(); choose(0); }
    else if (e.key === '2' || e.key === 'ArrowRight') { e.preventDefault(); choose(1); }
    return;
  }
  if (/^[0-9]$/.test(e.key)) { e.preventDefault(); pressKey(e.key); }
  else if (e.key === 'Backspace') { e.preventDefault(); pressKey('del'); }
  else if (e.key === 'Enter') { e.preventDefault(); pressKey('ok'); }
  else if (e.key === 'ArrowLeft' && inp.active > 0) { e.preventDefault(); selectSlot(inp.active - 1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); selectSlot(inp.active + 1); }
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
