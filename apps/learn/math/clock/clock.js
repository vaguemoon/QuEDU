/* clock.js — 時間趣：認識圓形時鐘
 *
 * 項目（ITEMS）：
 *   看時鐘寫時間  看指針，用數字鍵盤填「□ 時 □ 分」（整點只填時）
 *   撥時鐘        看「7 時 30 分」，拖曳指針撥出來，按「撥好了」
 * 程度：整點／半點／5 分 5 分數／幾時幾分（每 1 分）／綜合
 * 指針是連動的（跟真的時鐘一樣）：撥分針轉過 12，時針會跟著走一格；撥時針時分針不動，
 * 時針只停在跟目前分鐘相符的位置（7 時 30 分 → 時針在 7 和 8 中間），所以畫面上不會出現不可能的時間。
 * 練習：不限題數、不顯示答對數；一定要自己答對才能下一題；第一次錯給方法提示，之後再錯公布解法（答案還是要自己填／撥）。
 * 測驗：每題一次機會，錯的下一輪重考，第一輪答對 9 題以上該程度標「測驗通過」。
 * 進度存 students/{id}/progress/clock（totalCorrect、status.{item_level}）。
 * 依賴：shared.js（quApp、sfxCorrect、sfxWrong、sfxCelebrate、showToast、escHtml、pickBestZhVoice）
 */
'use strict';

var ROUND_SIZE = 10;
var MASTER_MIN = 9;

var LEVELS = [
  { id: 'hour', icon: '🕐', name: '整點',         ex: '3 時' },
  { id: 'half', icon: '🕧', name: '半點',         ex: '3 時 30 分' },
  { id: 'min5', icon: '🖐️', name: '5 分 5 分數',  ex: '3 時 25 分' },
  { id: 'min1', icon: '⏱️', name: '幾時幾分',     ex: '3 時 27 分' },
  { id: 'mix',  icon: '🔀', name: '綜合',         ex: '上面幾種混合' }
];
var ITEMS = [
  { id: 'read', icon: '👀', name: '看時鐘寫時間', ex: '看指針 → □ 時 □ 分' },
  { id: 'set',  icon: '🖐️', name: '撥時鐘',       ex: '7 時 30 分 → 撥指針' }
];

var cfg = { item: 'read', level: 'hour' };
try { var _saved = JSON.parse(localStorage.getItem('clock-cfg') || 'null'); if (_saved) cfg = Object.assign(cfg, _saved); } catch (e) {}
var levelStatus = {};   // { 'read_hour': 'practiced' | 'mastered' }
var round = null;
var lastMode = 'practice';

/* ══ 工具 ══ */
function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function itemOf(id) { return ITEMS.find(function(i) { return i.id === id; }); }
function levelOf(id) { return LEVELS.find(function(l) { return l.id === id; }); }
function nextHour(h) { return h % 12 + 1; }
function timeText(h, m) { return h + ' 時' + (m ? ' ' + m + ' 分' : ''); }
/* 畫面上的時間：數字用等寬字、「時」「分」用一般字型 */
function timeHtml(h, m) {
  return '<span class="tn">' + h + '</span> 時' + (m ? ' <span class="tn">' + m + '</span> 分' : '');
}

/* 唸法：7 時 30 分唸「七點三十分」、2 時唸「兩點整」、3 時 5 分唸「三點零五分」 */
var CN_D = '零一二三四五六七八九';
function cnNum(n) {
  if (n < 10) return CN_D[n];
  var t = Math.floor(n / 10), o = n % 10;
  return (t === 1 ? '' : CN_D[t]) + '十' + (o ? CN_D[o] : '');
}
function cnTime(h, m) {
  return (h === 2 ? '兩' : cnNum(h)) + '點' + (m === 0 ? '整' : (m < 10 ? '零' + CN_D[m] : cnNum(m)) + '分');
}

/* ══ 出題 ══ */
function makeQuestion() {
  var lv = cfg.level === 'mix' ? pick(LEVELS.filter(function(l) { return l.id !== 'mix'; })).id : cfg.level;
  var h = ri(1, 12), m;
  if (lv === 'hour') m = 0;
  else if (lv === 'half') m = 30;
  /* 多出一些分鐘過了一半的題目：時針已經很靠近下一個數，最容易把時看成下一個 */
  else if (lv === 'min5') m = Math.random() < 0.3 ? ri(7, 11) * 5 : ri(1, 11) * 5;
  else { do { m = Math.random() < 0.3 ? ri(31, 59) : ri(1, 59); } while (m % 5 === 0 && Math.random() < 0.8); }
  var q = { item: cfg.item, level: lv, h: h, m: m };
  if (q.item === 'read') {
    q.slots = [{ ans: String(h), w: 2, lab: '時' }];
    if (lv !== 'hour') q.slots.push({ ans: String(m), w: 2, lab: '分' });
  } else {
    /* 撥時鐘從 12 時開始撥；題目剛好是 12 時就從 3 時開始 */
    q.start = (h === 12 && m === 0) ? 180 : 0;
  }
  return q;
}
/* 撥分針一次跳幾分：每 1 分的程度才要一格一格撥 */
function minuteStep(q) { return q.level === 'min1' ? 1 : 5; }

/* ══ 時鐘 SVG ══
   座標中心在 (0,0)，往上是 12 點；角度 0 = 12 點方向、順時針增加 */
var R_FACE = 135;
function clockSvg(o) {
  var s = '<svg class="clock" id="clock-svg" viewBox="-168 -168 336 336" role="img" aria-label="時鐘">' +
    '<circle r="' + R_FACE + '" class="ck-face"/>';
  for (var i = 0; i < 60; i++) {
    var big = i % 5 === 0, a = i * 6 * Math.PI / 180, r1 = big ? 115 : 125;
    s += '<line x1="' + (Math.sin(a) * r1).toFixed(1) + '" y1="' + (-Math.cos(a) * r1).toFixed(1) +
         '" x2="' + (Math.sin(a) * 132).toFixed(1) + '" y2="' + (-Math.cos(a) * 132).toFixed(1) +
         '" class="' + (big ? 'ck-tick-big' : 'ck-tick') + '"/>';
  }
  for (var n = 1; n <= 12; n++) {
    var b = n * 30 * Math.PI / 180;
    s += '<text x="' + (Math.sin(b) * 96).toFixed(1) + '" y="' + (-Math.cos(b) * 96 + 10).toFixed(1) + '" class="ck-num">' + n + '</text>';
    /* 外圈的分鐘數（練習才有，幫忙 5 分 5 分數） */
    if (o.minLabels) s += '<text x="' + (Math.sin(b) * 152).toFixed(1) + '" y="' + (-Math.cos(b) * 152 + 6).toFixed(1) + '" class="ck-min">' + (n * 5 % 60) + '</text>';
  }
  if (o.ghost) s += handsSvg(o.ghost.h, o.ghost.m, 'ck-ghost', '');
  s += handsSvg(o.h, o.m, '', o.drag ? ' ck-drag' : '');
  return s + '<circle r="9" class="ck-pin"/></svg>';
}
function hourAngle(h, m) { return (h % 12) * 30 + m * 0.5; }
function handsSvg(h, m, cls, dragCls) {
  var idp = cls ? '' : ' id="hand-';
  return '<g class="ck-hand ck-hand-h ' + cls + dragCls + '"' + (idp ? idp + 'h"' : '') + ' transform="rotate(' + hourAngle(h, m) + ')">' +
           '<line x1="0" y1="14" x2="0" y2="-66"/>' + (dragCls ? '<line class="ck-hit" x1="0" y1="0" x2="0" y2="-72" data-hand="h"/>' : '') + '</g>' +
         '<g class="ck-hand ck-hand-m ' + cls + dragCls + '"' + (idp ? idp + 'm"' : '') + ' transform="rotate(' + (m * 6) + ')">' +
           '<line x1="0" y1="18" x2="0" y2="-112"/>' + (dragCls ? '<line class="ck-hit" x1="0" y1="0" x2="0" y2="-118" data-hand="m"/>' : '') + '</g>';
}

/* ══ 首頁選單 ══ */
function statusKey(item, level) { return item + '_' + level; }

function renderPickers() {
  if (!itemOf(cfg.item)) cfg.item = ITEMS[0].id;
  if (!levelOf(cfg.level)) cfg.level = LEVELS[0].id;
  function card(x, on, onclick, extraCls) {
    return '<button class="pick-card' + (on ? ' on' : '') + (extraCls || '') + '" onclick="' + onclick + '">' +
      '<span class="pick-icon">' + x.icon + '</span>' +
      '<span class="pick-name">' + x.name + '</span>' +
      '<span class="pick-ex">' + escHtml(x.ex) + '</span></button>';
  }
  document.getElementById('item-grid').innerHTML = ITEMS.map(function(i) {
    return card(i, i.id === cfg.item, "setItem('" + i.id + "')");
  }).join('');
  document.getElementById('level-grid').innerHTML = LEVELS.map(function(l) {
    var st = levelStatus[statusKey(cfg.item, l.id)];
    return card(l, l.id === cfg.level, "setLevel('" + l.id + "')", st ? ' st-' + st : '');
  }).join('');
}
function saveCfg() { try { localStorage.setItem('clock-cfg', JSON.stringify(cfg)); } catch (e) {} }
function setItem(id) { cfg.item = id; saveCfg(); renderPickers(); }
function setLevel(id) { cfg.level = id; saveCfg(); renderPickers(); }

function showPage(name) {
  document.querySelectorAll('.page').forEach(function(el) { el.classList.remove('active'); });
  document.getElementById('page-' + name).classList.add('active');
  document.getElementById('topbar-back').classList.toggle('hidden', name === 'home');
  window.scrollTo(0, 0);
}
function goHome() { flushPractice(); round = null; renderPickers(); showPage('home'); }

/* ══ 一輪 ══
   練習：不限題數、不顯示題號和答對數，一直出新題，按「換題目」離開；
   測驗：固定 ROUND_SIZE 題，有結算 */
function startRound(mode) {
  lastMode = mode;
  var qs = [], practice = mode === 'practice';
  for (var i = 0; i < (practice ? 1 : ROUND_SIZE); i++) qs.push(makeQuestion());
  round = { mode: mode, qs: qs, idx: 0, correct: 0, failed: [], roundNo: 1, firstRoundCorrect: 0,
            totalAnswered: 0, totalCorrect: 0, savedAnswered: 0, savedCorrect: 0 };
  document.getElementById('hud-mode').textContent = (mode === 'exam' ? '📝 測驗' : '🎯 練習') + '・' +
    itemOf(cfg.item).name + '・' + levelOf(cfg.level).name;
  document.getElementById('hud-progress').classList.toggle('hidden', practice);
  document.querySelector('.hud-score').classList.toggle('hidden', practice);
  showPage('game');
  renderQuestion();
}

/* 練習沒有結算頁：每答 10 題、還有離開時，把還沒存的答題數和「練習過」寫進紀錄 */
var PRACTICE_SAVE_EVERY = 10;
function flushPractice() {
  var r = round;
  if (!r || r.mode !== 'practice' || r.totalAnswered === r.savedAnswered) return;
  var key = statusKey(cfg.item, cfg.level), st = null;
  if (!levelStatus[key]) st = levelStatus[key] = 'practiced';
  saveProgress(r.totalCorrect - r.savedCorrect, r.totalAnswered - r.savedAnswered, key, st);
  r.savedAnswered = r.totalAnswered; r.savedCorrect = r.totalCorrect;
}

function curQ() { return round.qs[round.idx]; }

var inp = null;   // 看時鐘：{ vals: [...], active: 0 }；撥時鐘：{ t: 0～719 分鐘 }
function renderQuestion() {
  var q = curQ();
  q.tries = 0; q.done = false; q.mark = null; q.showAns = false;
  var hudR = document.getElementById('hud-round');
  hudR.classList.toggle('hidden', round.mode !== 'exam');
  hudR.textContent = 'Round ' + round.roundNo;
  document.getElementById('hud-progress').textContent = '第 ' + (round.idx + 1) + ' / ' + round.qs.length + ' 題';
  document.getElementById('hud-correct').textContent = round.correct;
  document.getElementById('q-hint').textContent = q.item === 'read'
    ? (q.slots.length > 1 ? '時鐘上是幾時幾分？' : '時鐘上是幾時？')
    : '拖曳時鐘的指針，撥出下面的時間';
  resetInput(q);
  hideFeedback();
  document.querySelector('.game-body').classList.toggle('no-keypad', q.item !== 'read');
  setKeypad(true);
  renderArea();
  if (q.item === 'set') sayText(cnTime(q.h, q.m));
}

function resetInput(q) {
  inp = q.item === 'read' ? { vals: q.slots.map(function() { return ''; }), active: 0 } : { t: q.start };
}

/* 練習時鐘外圈標分鐘數；測驗不標 */
function minLabelsOn(q) { return round.mode === 'practice' && q.level !== 'hour' && q.level !== 'half'; }

function slotHtml(i) {
  var q = curQ(), cls = 'slot';
  if (!q.done && inp.active === i) cls += ' active';
  if (q.mark) cls += ' ' + q.mark;
  return '<span class="' + cls + '" data-slot="' + i + '">' + escHtml(inp.vals[i]) + '</span>';
}

function renderArea() {
  var q = curQ(), area = document.getElementById('q-area'), side;
  var ghost = q.showAns ? { h: q.h, m: q.m } : null;
  if (q.item === 'read') {
    side = '<div class="time-ans">' + q.slots.map(function(s, i) {
      return slotHtml(i) + '<span class="time-unit">' + s.lab + '</span>';
    }).join('') + '</div>' +
      '<div class="hand-legend"><span class="lg-h">短針＝時針</span><span class="lg-m">長針＝分針</span></div>';
    area.innerHTML = clockSvg({ h: q.h, m: q.m, minLabels: minLabelsOn(q) || q.showAns }) + '<div class="q-side">' + side + '</div>';
  } else {
    var h = Math.floor(inp.t / 60) || 12, m = inp.t % 60;
    side = '<div class="set-target">撥出<b>' + timeHtml(q.h, q.m) + '</b>' +
        '<button class="btn-say" onclick="sayText(cnTime(curQ().h, curQ().m))" title="再聽一次">🔊</button></div>' +
      '<div class="hand-legend"><span class="lg-h">短針＝時針</span><span class="lg-m">長針＝分針</span></div>' +
      '<div class="set-now">現在是 <b id="set-now">' + timeHtml(h, m) + '</b></div>' +
      '<button class="btn-done" id="btn-done" onclick="submitSet()"' + (q.done ? ' disabled' : '') + '>✓ 撥好了</button>';
    area.innerHTML = clockSvg({ h: h, m: m, minLabels: minLabelsOn(q) || q.showAns, drag: !q.done, ghost: ghost }) +
      '<div class="q-side">' + side + '</div>';
    /* 「現在是幾時幾分」只在練習顯示，測驗要自己看指針 */
    document.querySelector('.set-now').classList.toggle('hidden', round.mode === 'exam');
  }
}

/* ══ 撥時鐘：拖曳指針（Pointer Events，滑鼠、手指通用） ══ */
var drag = null;   // { hand: 'h'|'m' }
function pointerAngle(svg, e) {
  var r = svg.getBoundingClientRect();
  var x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
  return { a: (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360, d: Math.sqrt(x * x + y * y) / (r.width / 336) };
}
function angDiff(a, b) { var d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

function onClockDown(e) {
  if (!round) return;
  var q = curQ(), svg = e.target.closest('#clock-svg');
  if (!svg || q.item !== 'set' || q.done) return;
  e.preventDefault();
  var p = pointerAngle(svg, e), hit = e.target.closest('[data-hand]');
  var h = Math.floor(inp.t / 60), m = inp.t % 60;
  var hand = hit ? hit.dataset.hand : null;
  if (!hand) {
    /* 沒點在指針上：選角度比較近的那根；兩根差不多近時，點在內圈算時針、外圈算分針 */
    var dh = angDiff(p.a, hourAngle(h, m)), dm = angDiff(p.a, m * 6);
    hand = Math.abs(dh - dm) < 15 ? (p.d < 80 ? 'h' : 'm') : (dh < dm ? 'h' : 'm');
  }
  drag = { hand: hand };
  try { svg.setPointerCapture(e.pointerId); } catch (err) {}
  document.getElementById('hand-' + hand).classList.add('ck-active');
  moveHand(p.a);
}
function onClockMove(e) {
  if (!drag) return;
  e.preventDefault();
  moveHand(pointerAngle(document.getElementById('clock-svg'), e).a);
}
function onClockUp() {
  if (!drag) return;
  var el = document.getElementById('hand-' + drag.hand);
  if (el) el.classList.remove('ck-active');
  drag = null;
}

function moveHand(a) {
  var q = curQ(), h = Math.floor(inp.t / 60), m = inp.t % 60;
  if (drag.hand === 'm') {
    var step = minuteStep(q), nm = Math.round(a / 6 / step) * step % 60;
    var d = nm - m;
    if (d > 30) d -= 60; else if (d < -30) d += 60;
    inp.t = (inp.t + d + 720) % 720;                       /* 轉過 12，時針跟著走 */
  } else {
    var nh = ((Math.round((a - m * 0.5) / 30) % 12) + 12) % 12;
    inp.t = nh * 60 + m;
  }
  h = Math.floor(inp.t / 60); m = inp.t % 60;
  document.getElementById('hand-h').setAttribute('transform', 'rotate(' + hourAngle(h, m) + ')');
  document.getElementById('hand-m').setAttribute('transform', 'rotate(' + (m * 6) + ')');
  document.getElementById('set-now').innerHTML = timeHtml(h || 12, m);
}

function submitSet() {
  var q = curQ();
  if (!round || q.done || q.item !== 'set') return;
  q.tries++;
  if (inp.t === (q.h % 12) * 60 + q.m) { onRight(q); return; }
  onWrong(q);
}

/* ── 看時鐘：鍵盤輸入 ── */
function pressKey(k) {
  if (!round) return;
  var q = curQ();
  if (q.done || q.item !== 'read') return;
  if (k === 'ok') { submitRead(); return; }
  q.mark = null;
  var a = inp.active, s = q.slots[a];
  if (k === 'del') {
    if (inp.vals[a] !== '') inp.vals[a] = inp.vals[a].slice(0, -1);
    else if (a > 0) { inp.active = a - 1; inp.vals[a - 1] = ''; }
  } else {
    if (inp.vals[a] === '0') inp.vals[a] = k;
    else if (inp.vals[a].length < s.w) inp.vals[a] += k;
    else inp.vals[a] = k;
    /* 時：打 2～9 或打滿兩位就跳到分；打 1 先停著（可能是 10、11、12），要填分就點分的格子 */
    if (a === 0 && q.slots.length > 1 && (inp.vals[0].length === 2 || +inp.vals[0] >= 2)) inp.active = 1;
  }
  renderArea();
}
function selectSlot(i) {
  if (!round) return;
  var q = curQ();
  if (q.done || q.item !== 'read' || i >= q.slots.length) return;
  inp.active = i;
  renderArea();
}

function submitRead() {
  var q = curQ();
  for (var i = 0; i < q.slots.length; i++) {
    if (inp.vals[i] === '') { showToast(q.slots.length > 1 ? '時和分都要填' : '先輸入答案喔'); return; }
  }
  q.tries++;
  var ok = q.slots.every(function(s, i) { return parseInt(inp.vals[i], 10) === parseInt(s.ans, 10); });
  if (ok) { onRight(q); return; }
  onWrong(q);
}

/* ══ 作答判定 ══ */
/* 常見錯誤：時看成下一個（時針已經很靠近下一個數）、長短針看反、分針指到 4 就寫 4 分 */
function readMistake(q) {
  var uh = parseInt(inp.vals[0], 10), um = q.slots.length > 1 ? parseInt(inp.vals[1], 10) : 0;
  if (q.m % 5 === 0 && q.m && uh === q.m / 5 && um === q.h * 5 % 60) return 'swap';
  if (q.m && um === q.m && uh === nextHour(q.h)) return 'nexthour';
  if (uh === q.h && q.m % 5 === 0 && q.m && um === q.m / 5) return 'minnum';
  return '';
}
function setMistake(q) {
  var h = Math.floor(inp.t / 60) || 12, m = inp.t % 60;
  if (m !== q.m && h === q.h) return 'min';
  if (m === q.m && h !== q.h) return 'hour';
  return 'both';
}

var MISTAKE_HEAD = {
  swap: '🔄 長針和短針看反了！',
  nexthour: '⏰ 時針還沒走到 ',
  minnum: '🖐️ 分針指的數字不是分鐘喔！',
  min: '分針（長針）還不對',
  hour: '時針（短針）還不對'
};

function onWrong(q) {
  try { sfxWrong(); } catch (e) {}
  var mk = q.item === 'read' ? readMistake(q) : setMistake(q);
  var head = mk === 'nexthour' ? MISTAKE_HEAD.nexthour + nextHour(q.h) + '！' : MISTAKE_HEAD[mk] || '';
  q.mark = 'wrong';
  if (round.mode === 'practice') {
    /* 練習：一定要自己答對才能下一題；第二次錯起把正確的指針畫出來 */
    if (q.tries >= 2) q.showAns = true;
    renderArea();
    showFeedback(q.tries === 1 ? 'hint' : 'bad', head || (q.tries === 1 ? '💡 再想一想' : '看看解法，再試一次'), explainHtml(q, q.tries >= 2));
    if (q.item === 'read') {
      setTimeout(function() {
        if (curQ() !== q || q.done) return;
        q.mark = null; resetInput(q); renderArea();
      }, 900);
    }
    return;
  }
  /* 測驗答錯：公布答案，錯的下一輪重考 */
  q.done = true; q.showAns = true;
  round.failed.push(q);
  if (q.item === 'read') { q.slots.forEach(function(s, i) { inp.vals[i] = s.ans; }); q.mark = 'right'; }
  renderArea();
  setKeypad(false);
  showFeedback('bad', (head ? head + ' ' : '') + '答案是 ' + timeText(q.h, q.m), explainHtml(q, true), true);
  round.totalAnswered++;
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
  var said = cnTime(q.h, q.m);
  showFeedback('ok', first ? '⭕ 答對了！' : '⭕ 這次對了！', '<span class="fb-said">🔊 ' + escHtml(said) + '</span>');
  /* 唸完才換題（至少停 900ms）；有些平板 onend 不會觸發，最多等 5 秒 */
  var spoke = false, waited = false, gone = false;
  function go() { if (gone || !spoke || !waited) return; gone = true; if (round && curQ() === q) nextQuestion(); }
  setTimeout(function() { waited = true; go(); }, 900);
  setTimeout(function() { spoke = waited = true; go(); }, 5000);
  setTimeout(function() { sayText(said, function() { spoke = true; go(); }); }, 350);
}

function nextQuestion() {
  if (!round || !curQ().done) return;
  if (round.mode === 'practice') {
    if (round.totalAnswered - round.savedAnswered >= PRACTICE_SAVE_EVERY) flushPractice();
    round.qs = [makeQuestion()]; round.idx = 0;
    renderQuestion();
    return;
  }
  round.idx++;
  if (round.idx >= round.qs.length) { finishRound(); return; }
  renderQuestion();
}

/* ══ 提示／解法（reveal=false 只講方法，true 連答案一起） ══ */
function explainHtml(q, reveal) {
  var h = q.h, m = q.m, k = Math.floor(m / 5), r = m % 5, L = [];
  var hr = '<span class="c-h">', mn = '<span class="c-m">', end = '</span>';
  if (!reveal) {
    if (q.item === 'set') {
      var mk = setMistake(q);
      if (mk !== 'hour') L.push(mn + '分針（長針）' + end + (m === 0 ? '要指到 12。' : '從 12 開始，5 分 5 分數到 ' + m + ' 分。'));
      if (mk !== 'min') L.push(hr + '時針（短針）' + end + (m === 0 ? '要指到 ' + h + '。' : '要在 ' + h + ' 和 ' + nextHour(h) + ' 的中間' + (m >= 30 ? '，比較靠近 ' + nextHour(h) : '') + '。'));
      return L.join('<br>');
    }
    if (m === 0) return mn + '長針' + end + '指在 12，就是整點；' + hr + '短針' + end + '指到幾，就是幾時。';
    return '先看' + hr + '短針（時針）' + end + '：它剛走過哪個數，就是幾時。<br>' +
           '再看' + mn + '長針（分針）' + end + '：從 12 開始，5 分 5 分往下數' + (q.level === 'min1' ? '，再數多出來的小格' : '') + '。';
  }
  if (m === 0) return mn + '長針' + end + '指在 12 → 整點；' + hr + '短針' + end + '指在 ' + h + ' → ' + h + ' 時';
  L.push(hr + '短針' + end + '在 ' + h + ' 和 ' + nextHour(h) + ' 的中間，剛走過 ' + h + ' → ' + hr + h + ' 時' + end +
         (m >= 30 ? '（還沒走到 ' + nextHour(h) + '，所以不是 ' + nextHour(h) + ' 時）' : ''));
  if (r === 0) L.push(mn + '長針' + end + '指到 ' + (k || 12) + ' → ' + k + ' 個 5 分 → ' + mn + m + ' 分' + end);
  else L.push(mn + '長針' + end + '過了 ' + (k || 12) + ' 再走 ' + r + ' 小格 → ' + (k * 5) + ' 分再多 ' + r + ' 分 → ' + mn + m + ' 分' + end);
  return L.join('<br>') + (q.item === 'set' ? '<br><span class="fb-note">虛線是正確的指針位置</span>' : '');
}

/* ══ 一輪結束 ══ */
function finishRound() {
  var r = round, n = r.qs.length, c = r.correct;
  if (r.roundNo === 1) r.firstRoundCorrect = c;
  var icon = document.getElementById('result-icon'), title = document.getElementById('result-title');
  var score = document.getElementById('result-score'), sub = document.getElementById('result-sub');
  var again = document.getElementById('btn-again');
  score.innerHTML = '<b>' + c + '</b> / ' + n + ' 題答對';

  if (r.failed.length) {
    icon.textContent = '📊';
    title.textContent = 'Round ' + r.roundNo + ' 結算';
    sub.textContent = '還有 ' + r.failed.length + ' 題要再挑戰，答對才算完成';
    again.textContent = '開始 Round ' + (r.roundNo + 1) + ' ▶';
    again.onclick = nextExamRound;
    showPage('result');
    return;
  }

  var key = statusKey(cfg.item, cfg.level), prev = levelStatus[key];
  var passed = r.firstRoundCorrect >= MASTER_MIN;
  if (passed) levelStatus[key] = 'mastered';
  else if (prev !== 'mastered') levelStatus[key] = 'practiced';
  icon.textContent = passed ? '🏆' : '💪';
  title.textContent = passed ? '測驗通過！' : '全部完成！';
  score.innerHTML = '第一輪 <b>' + r.firstRoundCorrect + '</b> / ' + ROUND_SIZE + ' 題答對';
  sub.textContent = passed ? '這個程度標上 ✓ 測驗通過'
    : '第一輪答對 ' + MASTER_MIN + ' 題以上才算通過，多練習再來測驗吧' + (r.roundNo > 1 ? '（共 ' + r.roundNo + ' 輪）' : '');
  try { passed ? sfxCelebrate() : sfxCorrect(); } catch (e) {}
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

/* ══ 語音 ══ */
var _zhVoice = null;
function sayText(text, onEnd) {
  try {
    if (!window.speechSynthesis) throw 0;
    if (!_zhVoice) _zhVoice = pickBestZhVoice(speechSynthesis.getVoices());
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-TW'; u.rate = 0.85;
    if (_zhVoice) u.voice = _zhVoice;
    if (onEnd) u.onend = u.onerror = onEnd;
    speechSynthesis.speak(u);
  } catch (e) { if (onEnd) onEnd(); }
}
try { if (window.speechSynthesis) speechSynthesis.onvoiceschanged = function() { _zhVoice = pickBestZhVoice(speechSynthesis.getVoices()); }; } catch (e) {}

/* ══ 紀錄：students/{id}/progress/clock（讀寫走 shared.js 的 quApp） ══ */
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

function backToHub() { flushPractice(); quApp.backToHub(); }
window.addEventListener('pagehide', flushPractice);   // 直接關掉分頁也盡量存

/* ══ 輸入事件 ══ */
document.getElementById('keypad').addEventListener('click', function(e) {
  var b = e.target.closest('.key');
  if (b && !b.disabled) pressKey(b.dataset.k);
});
var qArea = document.getElementById('q-area');
qArea.addEventListener('pointerdown', function(e) {
  var s = e.target.closest('[data-slot]');
  if (s) { selectSlot(parseInt(s.dataset.slot, 10)); return; }
  onClockDown(e);
});
qArea.addEventListener('pointermove', onClockMove);
qArea.addEventListener('pointerup', onClockUp);
qArea.addEventListener('pointercancel', onClockUp);
document.addEventListener('keydown', function(e) {
  if (!round || !document.getElementById('page-game').classList.contains('active')) return;
  var q = curQ();
  if (q.done) {
    if ((e.key === 'Enter' || e.key === ' ') && !document.getElementById('btn-next').classList.contains('hidden')) { e.preventDefault(); nextQuestion(); }
    return;
  }
  if (q.item === 'set') { if (e.key === 'Enter') { e.preventDefault(); submitSet(); } return; }
  if (/^[0-9]$/.test(e.key)) { e.preventDefault(); pressKey(e.key); }
  else if (e.key === 'Backspace') { e.preventDefault(); pressKey('del'); }
  else if (e.key === 'Enter') { e.preventDefault(); pressKey('ok'); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); selectSlot(0); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); selectSlot(1); }
});

window.addEventListener('load', function() {
  renderPickers();
  showPage('home');
  quApp.start({ id: 'clock', progress: 'clock', onReady: loadProgress });
});
