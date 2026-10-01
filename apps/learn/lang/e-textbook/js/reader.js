/**
 * reader.js — 課文閱讀畫面：逐字顯示、單字發音、拖曳圈詞、生字詞查詢、全文朗讀跟讀
 */
'use strict';

var etCelebratedAll = false;

/* ── 課文清單頁 ── */
function renderEtLessonList() {
  var wrap = document.getElementById('et-list-wrap');
  if (!wrap) return;
  if (!etLessonList.length) {
    wrap.innerHTML = '<div class="et-empty">老師還沒有分享課文給這個班級。</div>';
    return;
  }
  wrap.innerHTML = etLessonList.map(function(l) {
    var label = l.lessonName ? (l.grade + '　第 ' + l.lesson + ' 課　' + l.lessonName) : (l.grade + '　第 ' + l.lesson + ' 課');
    return '<button class="et-lesson-card" onclick="enterEtLesson(\'' + l.docId + '\')">' +
      '<span class="et-lesson-icon">📖</span>' +
      '<span class="et-lesson-label">' + label + '</span>' +
      '<span class="et-lesson-arrow">→</span>' +
      '</button>';
  }).join('');
}

function enterEtLesson(docId) {
  openEtLesson(docId);
  showPage('reader');
  renderReaderPage();
}

/* ── 進入點：畫出這一篇課文 ── */
function renderReaderPage() {
  if (!etCurrentLesson) return;
  etCancelSpeak();
  etClearReadingHighlight();
  etCloseLookup();

  etRenderText();
  etRenderProgress();
  renderFoundWordsPanel();
  _etRenderRateUI();
  _etRenderFontSizeUI();

  var titleEl = document.getElementById('topbar-title');
  var label = etCurrentLesson.lessonName || ('第 ' + etCurrentLesson.lesson + ' 課');
  if (titleEl) titleEl.innerHTML = '📖 <span>' + label + '</span>';
}

/* 配套生字詞非同步載入完成後補畫面 */
function _etOnVocabLoaded() {
  etRenderProgress();
  renderFoundWordsPanel();
}

/* 已找到進度非同步載入完成後補畫面 */
function _etOnProgressLoaded() {
  var words = Object.keys(etVocab);
  var found = words.filter(function(w) { return etFoundWords[w]; }).length;
  etCelebratedAll = words.length > 0 && found === words.length;
  etHighlightFoundWords();
  etRenderProgress();
  renderFoundWordsPanel();
}

/* ── 課文渲染：逐行逐字，中文字可互動，標點/空白純顯示 ── */
function etRenderText() {
  var wrap = document.getElementById('et-text-wrap');
  if (!wrap) return;
  if (!etLines.length) {
    wrap.innerHTML = '<div class="et-empty">這一課還沒有課文全文，請請老師到後台補上。</div>';
    return;
  }
  wrap.innerHTML = etLines.map(function(line, li) {
    if (line.blank) {
      return '<div class="et-line et-line-blank" data-line-idx="' + li + '"></div>';
    }
    var spans = line.chars.map(function(c, ci) {
      if (c.interactive) {
        return '<span class="et-char" data-line="' + li + '" data-ci="' + ci + '">' + c.ch + '</span>';
      }
      return '<span class="et-punct">' + c.ch + '</span>';
    }).join('');
    return '<div class="et-line" data-line-idx="' + li + '">' +
      '<button class="et-line-speak-btn" onclick="etSpeakLine(' + li + ')">🔊</button>' +
      '<span class="et-line-text">' + spans + '</span>' +
      '</div>';
  }).join('');
  etHighlightFoundWords();
  etAttachPointerHandlers();
}

/* 把「已找到」的生字詞標記到對應字元 span 上（在每行文字裡找出所有出現位置） */
function etHighlightFoundWords() {
  var words = Object.keys(etFoundWords);
  if (!words.length) return;
  document.querySelectorAll('.et-line').forEach(function(lineEl) {
    var li = parseInt(lineEl.dataset.lineIdx, 10);
    var line = etLines[li];
    if (!line) return;
    words.forEach(function(word) {
      var idx = line.text.indexOf(word);
      while (idx !== -1) {
        for (var k = 0; k < word.length; k++) {
          var span = lineEl.querySelector('.et-char[data-ci="' + (idx + k) + '"]');
          if (span) span.classList.add('et-char-found');
        }
        idx = line.text.indexOf(word, idx + 1);
      }
    });
  });
}

/* ── 拖曳圈詞（Pointer Events，滑鼠／觸控通用；限定同一行內，跨行不成立） ── */
var etDragging     = false;
var etDragLineIdx  = null;
var etDragStartCi  = null;
var etDragEndCi    = null;

function etAttachPointerHandlers() {
  var wrap = document.getElementById('et-text-wrap');
  if (!wrap || wrap.dataset.ptrBound) return;
  wrap.dataset.ptrBound = '1';
  wrap.addEventListener('pointerdown',   etOnPointerDown);
  wrap.addEventListener('pointermove',   etOnPointerMove);
  wrap.addEventListener('pointerup',     etOnPointerUp);
  wrap.addEventListener('pointercancel', etOnPointerCancel);
}

function _etCharSpanAt(x, y) {
  var el = document.elementFromPoint(x, y);
  return (el && el.classList && el.classList.contains('et-char')) ? el : null;
}

function etOnPointerDown(e) {
  var span = _etCharSpanAt(e.clientX, e.clientY);
  if (!span) return;
  etDragging    = true;
  etDragLineIdx = parseInt(span.dataset.line, 10);
  etDragStartCi = etDragEndCi = parseInt(span.dataset.ci, 10);
  try { document.getElementById('et-text-wrap').setPointerCapture(e.pointerId); } catch (err) {}
  etUpdateDragHighlight();
  e.preventDefault();
}

function etOnPointerMove(e) {
  if (!etDragging) return;
  var span = _etCharSpanAt(e.clientX, e.clientY);
  if (span && parseInt(span.dataset.line, 10) === etDragLineIdx) {
    etDragEndCi = parseInt(span.dataset.ci, 10);
    etUpdateDragHighlight();
  }
  e.preventDefault();
}

function etOnPointerUp(e) {
  if (!etDragging) return;
  etDragging = false;
  etFinalizeSelection();
  e.preventDefault();
}
function etOnPointerCancel() { etDragging = false; }

function etUpdateDragHighlight() {
  var lo = Math.min(etDragStartCi, etDragEndCi);
  var hi = Math.max(etDragStartCi, etDragEndCi);
  document.querySelectorAll('.et-char').forEach(function(s) {
    var sameLine = parseInt(s.dataset.line, 10) === etDragLineIdx;
    var ci = parseInt(s.dataset.ci, 10);
    s.classList.toggle('et-char-selecting', sameLine && ci >= lo && ci <= hi);
  });
}

function etFinalizeSelection() {
  var lo = Math.min(etDragStartCi, etDragEndCi);
  var hi = Math.max(etDragStartCi, etDragEndCi);
  document.querySelectorAll('.et-char-selecting').forEach(function(s) { s.classList.remove('et-char-selecting'); });
  var line = etLines[etDragLineIdx];
  if (!line) return;
  var text = line.chars.slice(lo, hi + 1).map(function(c) { return c.ch; }).join('');
  if (!text) return;
  etHandleCircledText(text);
}

/* ── 圈到／點到文字後：一律先發音＋查詢，符合本課生字詞的話額外標記＋算進度 ── */
function etHandleCircledText(text) {
  etSpeak(text);
  var matched = etMatchOfficial(text);
  showEtLookupPopup(text, matched);
  if (matched && !etFoundWords[text]) {
    etFoundWords[text] = true;
    sfxCorrect();
    saveEtProgress(false);
    etHighlightFoundWords();
    etRenderProgress();
    renderFoundWordsPanel();
  }
}

/* ── 查詢彈窗：本課生字詞優先顯示老師自己的解釋，其餘退回萌典 ── */
function showEtLookupPopup(text, matched) {
  var popup = document.getElementById('et-lookup-popup');
  if (!popup) return;
  document.getElementById('et-lookup-word').textContent = text;
  document.getElementById('et-lookup-bopomofo').textContent = '查詢中…';
  document.getElementById('et-lookup-def').textContent = '';

  var imgEl = document.getElementById('et-lookup-image');
  if (etWordImageMap[text]) {
    imgEl.src = etWordImageMap[text];
    imgEl.style.display = '';
  } else {
    imgEl.style.display = 'none';
  }

  var badge = document.getElementById('et-lookup-found-badge');
  if (badge) badge.style.display = matched ? '' : 'none';

  popup.style.display = '';
  popup.classList.add('show');

  lookupWord(text).then(function(info) {
    var bEl = document.getElementById('et-lookup-bopomofo');
    var dEl = document.getElementById('et-lookup-def');
    if (bEl) bEl.textContent = info.bopomofo || (info.fromTeacher ? '（老師的解釋）' : '（查無注音）');
    if (dEl) dEl.textContent = info.def || '（查無解釋）';
  });
}

function etCloseLookup() {
  var popup = document.getElementById('et-lookup-popup');
  if (popup) { popup.classList.remove('show'); popup.style.display = 'none'; }
}

/* ── 進度條：本課配套生字詞找到幾個 ── */
function etRenderProgress() {
  var words = Object.keys(etVocab);
  var total = words.length;
  var found = words.filter(function(w) { return etFoundWords[w]; }).length;
  var pct   = total ? Math.round(found / total * 100) : 0;

  var fill   = document.getElementById('et-progress-fill');
  var counts = document.getElementById('et-progress-counts');
  if (fill)   fill.style.width = pct + '%';
  if (counts) counts.textContent = total ? ('已找到 ' + found + ' / ' + total + ' 個生字詞') : '這一課沒有設定生字詞';

  if (total && found === total && !etCelebratedAll) {
    etCelebratedAll = true;
    sfxGrandCelebrate();
    saveEtProgress(true);
    showToast('🎉 太棒了！本課生字詞都找到了！');
  }
}

/* ── 找到清單面板：純複習用，不跨 App 跳轉 ── */
function renderFoundWordsPanel() {
  var panel = document.getElementById('et-found-panel');
  if (!panel) return;
  var found = Object.keys(etVocab).filter(function(w) { return etFoundWords[w]; });

  var html = '<div class="et-found-title">🔍 本課已找到的生字詞</div>';
  if (!found.length) {
    html += '<div class="et-found-empty">在課文裡拖曳圈選文字，找找看本課的生字詞吧！</div>';
  } else {
    html += '<div class="et-found-chips">' + found.map(function(w) {
      return '<span class="et-found-chip" onclick="etSpeak(\'' + w + '\')">' + w + '</span>';
    }).join('') + '</div>';
  }
  panel.innerHTML = html;
}

/* ── 單句發音：點每句前面的喇叭，只唸那一句，唸的時候反白那一行 ── */
function etSpeakLine(li) {
  var line = etLines[li];
  if (!line || line.blank || !line.text) return;
  etClearReadingHighlight();
  var lineEl = document.querySelector('.et-line[data-line-idx="' + li + '"]');
  if (lineEl) lineEl.classList.add('et-line-reading');
  etSpeakWithCallback(line.text, function() {
    if (lineEl) lineEl.classList.remove('et-line-reading');
  });
}

function etClearReadingHighlight() {
  document.querySelectorAll('.et-line-reading').forEach(function(el) { el.classList.remove('et-line-reading'); });
}

/* ── 語速調整（－／＋按鍵，0.5～1.2，這個 App 服務對象常需要比一般更慢的語速），
   記住這台裝置上次設定的值；用 Math.round 避免浮點數相加產生 0.1+0.2=0.30000000000000004 這種誤差 ── */
function etAdjustRate(dir) {
  var next = Math.round((etRate + dir * ET_RATE_STEP) * 10) / 10;
  etRate = Math.min(ET_RATE_MAX, Math.max(ET_RATE_MIN, next));
  _etSaveNum('et-rate', etRate);
  _etRenderRateUI();
}
function _etRenderRateUI() {
  var valEl = document.getElementById('et-rate-value');
  if (valEl) valEl.textContent = etRate.toFixed(1) + 'x';
}

/* ── 字體大小調整（Ａ－／Ａ＋），記住這台裝置上次設定的值 ── */
function etAdjustFontSize(dir) {
  etFontSize = Math.min(ET_FONT_MAX, Math.max(ET_FONT_MIN, etFontSize + dir * ET_FONT_STEP));
  _etSaveNum('et-font-size', etFontSize);
  _etRenderFontSizeUI();
}
function _etRenderFontSizeUI() {
  var wrap = document.getElementById('et-text-wrap');
  if (wrap) wrap.style.setProperty('--et-font-size', etFontSize + 'rem');
}
