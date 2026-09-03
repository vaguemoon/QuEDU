'use strict';

var _p       = new URLSearchParams(window.location.search);
var label    = _p.get('label') || '';
var charsStr = _p.get('chars') || '';
var practice = _p.get('practice') === '1';

var chars = [];
Array.from(charsStr).forEach(function(c) {
  if (c.trim() && !chars.includes(c)) chars.push(c);
});

document.getElementById('lesson-title').textContent = label || '生字圖卡';
document.title = label ? '生字圖卡　' + label : '生字圖卡';

var totalChars = chars.length;
var doneCount  = 0;

/* ── Build pages (4 cards per page, 2×2) ── */
var wrapper = document.getElementById('cards-wrapper');

for (var p = 0; p < chars.length; p += 4) {
  var page = document.createElement('div');
  page.className = 'print-page';
  if (p === 0) page.appendChild(buildNameHeader());

  var grid = document.createElement('div');
  grid.className = 'print-page-grid';
  chars.slice(p, p + 4).forEach(function(c) { grid.appendChild(buildCard(c)); });
  page.appendChild(grid);

  wrapper.appendChild(page);
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

/* Stagger fetch + render 200 ms apart to respect API rate limit */
chars.forEach(function(c, idx) {
  setTimeout(function() { fetchAndRender(c); }, idx * 200);
});

/* ══ Card builder ══ */
function buildCard(char) {
  var card = document.createElement('div');
  card.className = 'char-card';

  // Course label (full width, top)
  var lbl = document.createElement('div');
  lbl.className = 'card-label';
  lbl.textContent = label;
  card.appendChild(lbl);

  // Body: [side info | char box]
  var body = document.createElement('div');
  body.className = 'card-body';

  // Left char box (grid-stacked: hz-target + tian-svg)
  var wrap = document.createElement('div');
  wrap.className = 'card-char-wrap';

  var hzTarget = document.createElement('div');
  hzTarget.className = 'hz-target';
  hzTarget.id = 'hz-' + char;
  wrap.appendChild(hzTarget);
  wrap.appendChild(buildTianGrid());
  body.appendChild(wrap);

  // Right side info column (注音 vertical, 部首 below)
  var sideInfo = document.createElement('div');
  sideInfo.className = 'card-side-info';
  sideInfo.innerHTML =
    '<div class="side-info-item">' +
      '<span class="info-label">注音</span>' +
      '<span class="info-value info-zhuyin" id="zy-' + char + '">—</span>' +
    '</div>' +
    '<div class="side-info-item">' +
      '<span class="info-label">部首</span>' +
      '<span class="info-value" id="rd-' + char + '">—</span>' +
    '</div>';
  body.appendChild(sideInfo);

  card.appendChild(body);

  if (practice) {
    card.appendChild(buildPracticeRow(char));
  }

  return card;
}

/* ══ Practice row: 3 田字格 boxes spanning full card width ══ */
function buildPracticeRow(char) {
  var row = document.createElement('div');
  row.className = 'practice-row';
  for (var i = 0; i < 3; i++) {
    var box = document.createElement('div');
    box.className = 'practice-box';
    if (i === 0) {
      // 第一格：HanziWriter 仿寫底稿（極淡字形）
      var hzDiv = document.createElement('div');
      hzDiv.className = 'practice-hz';
      hzDiv.id = 'phz-' + char;
      box.appendChild(hzDiv);
    }
    box.appendChild(buildPracticeTian());
    row.appendChild(box);
  }
  return row;
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

/* ══ 萌典 API + HanziWriter ══ */
function fetchAndRender(char) {
  fetch('https://www.moedict.tw/' + encodeURIComponent(char) + '.json')
    .then(function(res) { return res.ok ? res.json() : null; })
    .then(function(data) {
      if (data) {
        var radical = (data.radical || '').replace(/<[^>]+>/g, '').trim() || '—';
        var zhuyin  = (data.heteronyms && data.heteronyms[0] && data.heteronyms[0].bopomofo) || '—';
        var zyEl = document.getElementById('zy-' + char);
        var rdEl = document.getElementById('rd-' + char);
        if (zyEl) zyEl.innerHTML = renderZhuyinHtml(zhuyin);
        if (rdEl) rdEl.textContent = radical;
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
      showCharacter: false,
      showOutline:   true,
      outlineColor:  '#b8d4f0',
      strokeColor:   '#4a90d9',
      onLoadCharDataSuccess: function() {
        var svg = target.querySelector('svg');
        if (svg && !svg.getAttribute('viewBox')) {
          svg.setAttribute('viewBox', '0 0 ' + sz + ' ' + sz);
        }
        if (practice) renderPracticeGuide(char);
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
