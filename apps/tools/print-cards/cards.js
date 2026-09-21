'use strict';

var _p       = new URLSearchParams(window.location.search);
var label    = _p.get('label') || '';
var charsStr = _p.get('chars') || '';
var testMode = _p.get('test') === '1';

/* 測驗單允許同一個字重複出現（每次都各自獨立隨機遮蔽），
   學習單維持原本的去重（每個字只出現一張卡） */
var chars = [];
if (testMode) {
  Array.from(charsStr).forEach(function(c) { if (c.trim()) chars.push(c); });
} else {
  Array.from(charsStr).forEach(function(c) { if (c.trim() && !chars.includes(c)) chars.push(c); });
}

var _titleBase = testMode
  ? ('生字測驗　' + label).trim()
  : (label ? '生字圖卡　' + label : '生字圖卡');
document.getElementById('lesson-title').textContent = _titleBase;
document.title = _titleBase;

var totalChars = chars.length;
var doneCount  = 0;

var wrapper = document.getElementById('cards-wrapper');

if (testMode) {
  buildTestPages();
} else {
  buildLearningPages();
}

/* ══ 每頁都印一次的課次標籤 ══ */
function buildLessonHeader() {
  var el = document.createElement('div');
  el.className = 'print-page-lesson';
  el.textContent = testMode ? ('生字測驗　' + label).trim() : label;
  return el;
}

/* ══ 第一頁專用：班級／姓名填寫列 ══ */
function buildNameHeader() {
  var header = document.createElement('div');
  header.className = 'print-page-header';
  header.innerHTML =
    '<span>班級：<span class="fill-line"></span></span>' +
    '<span>姓名：<span class="fill-line"></span></span>';
  return header;
}

updateStatus();

/* ══════════════════════════════════════════════════════
   學習單：橫式生字練習格
   一列橫排：[參考格] + 4 組[練習格]。每一格都是「同一個圓角外框，
   左半字、右半注音、中間一條直線」的同一種格子（.hzp-unit），
   不是兩個分開的形狀拼在一起：外框（含圓角、底色）只在最外層畫
   一次，中間的線是內部的 border-left，divider 不會跑到框外面。
   第一組練習格是仿寫底稿（字跟注音都淡色，供描摹）；後面 3 組
   寫字格空白，注音也刻意留白讓學生自己寫，不印答案。
   遮蔽不適合放在學習單裡（見測驗單），這裡完全沒有遮蔽功能。
   ══════════════════════════════════════════════════════ */
function buildLearningPages() {
  var CARDS_PER_PAGE = 5;

  for (var p = 0; p < chars.length; p += CARDS_PER_PAGE) {
    var page = document.createElement('div');
    page.className = 'print-page hzp-page';
    page.appendChild(buildLessonHeader());
    if (p === 0) page.appendChild(buildNameHeader());

    var grid = document.createElement('div');
    grid.className = 'print-page-grid';
    chars.slice(p, p + CARDS_PER_PAGE).forEach(function(c) { grid.appendChild(buildHorizontalCard(c)); });
    page.appendChild(grid);

    wrapper.appendChild(page);
  }

  /* Stagger fetch + render 200 ms apart to respect API rate limit */
  chars.forEach(function(c, idx) {
    setTimeout(function() { fetchAndRender(c); }, idx * 200);
  });
}

function buildHorizontalCard(char) {
  var card = document.createElement('div');
  card.className = 'char-card hzp-card';

  var row = document.createElement('div');
  row.className = 'hzp-row';

  row.appendChild(buildHzpUnit(char, 'ref'));
  for (var i = 0; i < 4; i++) {
    row.appendChild(buildHzpUnit(char, i === 0 ? 'trace' : 'blank'));
  }
  card.appendChild(row);

  // 部首（跟萌典 API 一起抓，見 fetchAndRender）＋ 造詞欄（一格就好）
  var wordLine = document.createElement('div');
  wordLine.className = 'hzp-word-line';
  wordLine.innerHTML =
    '<span class="hzp-radical-title">部首：</span>' +
    '<span class="hzp-radical-value" id="rd-' + char + '">—</span>' +
    '<span class="hzp-radical-zy" id="rdzy-' + char + '"></span>' +
    '<span class="hzp-word-title">造詞：</span>' +
    '<span class="hzp-word-blank"></span>';
  card.appendChild(wordLine);

  return card;
}

/* mode: 'ref'（參考格，字＋正確注音）／'trace'（仿寫底稿，字＋注音都淡色）／
   'blank'（寫字格空白，注音也空白讓學生寫） */
function buildHzpUnit(char, mode) {
  var unit = document.createElement('div');
  unit.className = 'hzp-unit';

  var left = document.createElement('div');
  left.className = 'hzp-unit-char';
  if (mode === 'ref') {
    var hzTarget = document.createElement('div');
    hzTarget.className = 'hz-target';
    hzTarget.id = 'hz-' + char;
    left.appendChild(hzTarget);
    left.appendChild(buildTianGrid());
  } else {
    if (mode === 'trace') {
      var hzDiv = document.createElement('div');
      hzDiv.className = 'practice-hz';
      hzDiv.id = 'phz-' + char;
      left.appendChild(hzDiv);
    }
    left.appendChild(buildPracticeTian());
  }
  unit.appendChild(left);

  var right = document.createElement('span');
  right.className = 'hzp-unit-zy';
  if (mode === 'ref') {
    right.classList.add('zy-target');
    right.dataset.zyFor = char;
  } else if (mode === 'trace') {
    right.classList.add('zy-target', 'faint');
    right.dataset.zyFor = char;
  }
  // mode === 'blank'：右半留空，不掛 zy-target，不會被自動填入答案
  unit.appendChild(right);

  return unit;
}

function buildPracticeTian() {
  var ns  = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'practice-tian');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  function line(x1, y1, x2, y2) {
    var el = document.createElementNS(ns, 'line');
    el.setAttribute('x1', x1); el.setAttribute('y1', y1);
    el.setAttribute('x2', x2); el.setAttribute('y2', y2);
    el.setAttribute('stroke', '#c8dff5');
    el.setAttribute('stroke-width', '1.2');
    el.setAttribute('stroke-dasharray', '5 4');
    svg.appendChild(el);
  }

  line(50, 1, 50, 99);
  line(1,  50, 99, 50);
  return svg;
}

/* ══ 注音解析：分離聲調符號 ══ */
var _TONES = { 'ˊ': 'flex-start', 'ˇ': 'center', 'ˋ': 'flex-end', '˙': 'flex-start' };

function renderZhuyinHtml(zy) {
  if (!zy || zy === '—') return '<span class="zy-wrapper"><span class="zy-body">—</span></span>';
  var last  = zy[zy.length - 1];
  var align = _TONES[last];
  if (align) {
    var body  = zy.slice(0, -1);
    return '<span class="zy-wrapper">' +
      '<span class="zy-body">' + body + '</span>' +
      '<span class="zy-tone" style="align-self:' + align + '">' + last + '</span>' +
      '</span>';
  }
  // 一聲（無聲調符號）
  return '<span class="zy-wrapper"><span class="zy-body">' + zy + '</span></span>';
}

/* ══ 田字格 SVG overlay ══ */
function buildTianGrid() {
  var ns  = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'tian-svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  function line(x1, y1, x2, y2) {
    var el = document.createElementNS(ns, 'line');
    el.setAttribute('x1', x1); el.setAttribute('y1', y1);
    el.setAttribute('x2', x2); el.setAttribute('y2', y2);
    el.setAttribute('stroke', '#b8d4f0');
    el.setAttribute('stroke-width', '1.4');
    el.setAttribute('stroke-dasharray', '5 4');
    svg.appendChild(el);
  }

  line(50, 1, 50, 99); // vertical
  line(1, 50, 99, 50); // horizontal

  return svg;
}

/* ══ 部首本身的注音 ══
   部首（例如「手」）也是一個字，要另外查一次萌典拿它自己的注音；
   同一個部首常常被好幾個生字共用，用 cache 記下來避免重複查 */
var _radicalZyCache = {};
function fetchRadicalZhuyin(radicalChar, char) {
  var el = document.getElementById('rdzy-' + char);
  if (!el || !radicalChar || radicalChar === '—') return;

  if (_radicalZyCache.hasOwnProperty(radicalChar)) {
    if (_radicalZyCache[radicalChar]) el.innerHTML = renderZhuyinHtml(_radicalZyCache[radicalChar]);
    return;
  }
  fetch('https://www.moedict.tw/' + encodeURIComponent(radicalChar) + '.json')
    .then(function(res) { return res.ok ? res.json() : null; })
    .then(function(data) {
      var zy = (data && data.heteronyms && data.heteronyms[0] && data.heteronyms[0].bopomofo) || '';
      _radicalZyCache[radicalChar] = zy;
      if (zy) {
        var target = document.getElementById('rdzy-' + char);
        if (target) target.innerHTML = renderZhuyinHtml(zy);
      }
    })
    .catch(function() { _radicalZyCache[radicalChar] = ''; });
}

/* ══ 萌典 API + HanziWriter（學習單用） ══ */
function fetchAndRender(char) {
  fetch('https://www.moedict.tw/' + encodeURIComponent(char) + '.json')
    .then(function(res) { return res.ok ? res.json() : null; })
    .then(function(data) {
      if (data) {
        var radical = (data.radical || '').replace(/<[^>]+>/g, '').trim() || '—';
        var zhuyin  = (data.heteronyms && data.heteronyms[0] && data.heteronyms[0].bopomofo) || '—';
        var rdEl = document.getElementById('rd-' + char);
        if (rdEl) rdEl.textContent = radical;
        fetchRadicalZhuyin(radical, char);

        // 同一個字的注音要同時填進：右側參考欄 + 練習格旁邊的注音格
        var zyHtml = renderZhuyinHtml(zhuyin);
        document.querySelectorAll('.zy-target[data-zy-for="' + char + '"]').forEach(function(el) {
          el.innerHTML = zyHtml;
        });
      }
    })
    .catch(function() {})
    .then(function() { renderWriter(char); });
}

function renderWriter(char) {
  var target = document.getElementById('hz-' + char);
  if (!target) { markDone(); return; }

  requestAnimationFrame(function() {
    var sz = target.getBoundingClientRect().width || 200;
    HanziWriter.create(target, char, {
      width: sz, height: sz,
      padding:       Math.round(sz * 0.08),
      showCharacter: true,
      showOutline:   true,
      outlineColor:  '#b8d4f0',
      strokeColor:   '#8bb8e0',
      radicalColor:  '#e2574a',
      onLoadCharDataSuccess: function() {
        var svg = target.querySelector('svg');
        if (svg && !svg.getAttribute('viewBox')) {
          svg.setAttribute('viewBox', '0 0 ' + sz + ' ' + sz);
        }
        renderPracticeGuide(char);
        markDone();
      },
      onLoadCharDataError: markDone
    });
  });
}

function renderPracticeGuide(char) {
  var pTarget = document.getElementById('phz-' + char);
  if (!pTarget) return;
  requestAnimationFrame(function() {
    var sz = pTarget.getBoundingClientRect().width || 120;
    var writer = HanziWriter.create(pTarget, char, {
      width: sz, height: sz,
      padding:       Math.round(sz * 0.08),
      showCharacter: true,
      showOutline:   false,
      strokeColor:   'rgba(74,144,217,0.22)'
    });
    // Add viewBox for correct print scaling
    requestAnimationFrame(function() {
      var svg = pTarget.querySelector('svg');
      if (svg && !svg.getAttribute('viewBox')) {
        svg.setAttribute('viewBox', '0 0 ' + sz + ' ' + sz);
      }
    });
  });
}

/* ══════════════════════════════════════════════════════
   測驗單：只有遮蔽字，沒有注音／部首／造詞／寫字格。
   5 個一行、置中排列；同一個字重複出現時，每次的遮蔽區塊都是
   獨立隨機產生（不像學習單那樣用字本身當 key 快取），所以格子
   要用「第幾個位置」(idx) 當 id，不能用字本身，才不會因為重複
   字而 id 衝突。
   ══════════════════════════════════════════════════════ */
function buildTestPages() {
  var COLS_PER_ROW    = 5;
  var ROWS_PER_PAGE   = 7;
  var TEST_PER_PAGE   = COLS_PER_ROW * ROWS_PER_PAGE;

  for (var p = 0; p < chars.length; p += TEST_PER_PAGE) {
    var page = document.createElement('div');
    page.className = 'print-page test-page';
    page.appendChild(buildLessonHeader());
    if (p === 0) page.appendChild(buildNameHeader());

    var grid = document.createElement('div');
    grid.className = 'test-grid';
    chars.slice(p, p + TEST_PER_PAGE).forEach(function(c, i) {
      grid.appendChild(buildTestBox(p + i));
    });
    page.appendChild(grid);

    wrapper.appendChild(page);
  }

  chars.forEach(function(c, idx) {
    setTimeout(function() { renderTestBox(c, idx); }, idx * 80);
  });
}

function buildTestBox(idx) {
  var box = document.createElement('div');
  box.className = 'test-box';

  var hzTarget = document.createElement('div');
  hzTarget.className = 'hz-target';
  hzTarget.id = 'hzt-' + idx;
  box.appendChild(hzTarget);
  box.appendChild(buildTianGrid());
  box.appendChild(buildMaskOverlay(buildMask(), '#eeeeee'));

  return box;
}

function renderTestBox(char, idx) {
  var target = document.getElementById('hzt-' + idx);
  if (!target) { markDone(); return; }

  requestAnimationFrame(function() {
    var sz = target.getBoundingClientRect().width || 120;
    HanziWriter.create(target, char, {
      width: sz, height: sz,
      padding:       Math.round(sz * 0.08),
      showCharacter: true,
      showOutline:   true,
      outlineColor:  '#b8d4f0',
      strokeColor:   '#8bb8e0',
      radicalColor:  '#e2574a',
      onLoadCharDataSuccess: function() {
        var svg = target.querySelector('svg');
        if (svg && !svg.getAttribute('viewBox')) {
          svg.setAttribute('viewBox', '0 0 ' + sz + ' ' + sz);
        }
        markDone();
      },
      onLoadCharDataError: markDone
    });
  });
}

/* ══ 遮蔽區塊：每次呼叫都各自獨立隨機決定一塊圓形/矩形遮蔽區
   （座標為 0–100 的相對比例，蓋住約 30–40% 字面積） ══ */
function buildMask() {
  // 字的筆畫實際只佔整個方框的一部分（框內還有留白），遮蔽區大小要用
  // 「佔邊長的比例」來抓，不能直接用「佔整個方框面積的 30–40%」——
  // 那樣算出來的圓/矩形邊長會逼近整個方框寬度，等於把字整個蓋住
  // 字本身多半集中在方框中央，遮蔽區的「中心點」也要往中央集中，
  // 不能貼著邊緣／角落亂放，否則常常整塊都蓋在字外面的留白處
  var cx = 50 + (Math.random() - 0.5) * 44; // 中心落在 28–72
  var cy = 50 + (Math.random() - 0.5) * 44;

  if (Math.random() < 0.5) {
    var d = 36 + Math.random() * 16; // 直徑佔邊長 36–52%
    return { shape: 'circle', cx: cx, cy: cy, r: d / 2 };
  }
  var w = 34 + Math.random() * 16; // 佔邊長 34–50%
  var h = 28 + Math.random() * 14; // 佔邊長 28–42%
  return { shape: 'rect', cx: cx, cy: cy, w: w, h: h };
}

function buildMaskOverlay(mask, color) {
  var ns  = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'mask-overlay');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  var el;
  if (mask.shape === 'circle') {
    el = document.createElementNS(ns, 'circle');
    el.setAttribute('cx', mask.cx);
    el.setAttribute('cy', mask.cy);
    el.setAttribute('r', mask.r);
  } else {
    el = document.createElementNS(ns, 'rect');
    el.setAttribute('x', mask.cx - mask.w / 2);
    el.setAttribute('y', mask.cy - mask.h / 2);
    el.setAttribute('width', mask.w);
    el.setAttribute('height', mask.h);
    el.setAttribute('rx', 4);
  }
  el.setAttribute('fill', color);
  svg.appendChild(el);
  return svg;
}

function markDone() {
  doneCount++;
  updateStatus();
  if (doneCount >= totalChars) {
    var btn = document.getElementById('btn-print');
    var st  = document.getElementById('loading-status');
    if (btn) { btn.textContent = '🖨️ 列印圖卡'; btn.classList.add('ready'); }
    if (st)  st.textContent = '共 ' + totalChars + ' 字，全部載入完成';
  }
}

function updateStatus() {
  if (doneCount >= totalChars) return;
  var st = document.getElementById('loading-status');
  if (st) st.textContent = '載入中… ' + doneCount + ' / ' + totalChars;
}
