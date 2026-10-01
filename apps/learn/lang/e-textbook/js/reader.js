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
  etStopReadAloud();
  etCloseLookup();

  etRenderText();
  etRenderProgress();
  renderFoundWordsPanel();

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
    return '<div class="et-line" data-line-idx="' + li + '">' + spans + '</div>';
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

/* ── 全文朗讀模式：逐句自動朗讀＋反白跟讀，可暫停/上一句/下一句 ── */
var etReading       = false;
var etReadingLineIdx = 0;

function etToggleReadAloud() {
  if (etReading) etStopReadAloud(); else etStartReadAloud();
}

function etStartReadAloud() {
  if (!etLines.length) { showToast('這一課還沒有課文全文'); return; }
  etReading = true;
  etReadingLineIdx = 0;
  _etSetReadToggleLabel();
  etShowReadControls(true);
  etReadCurrentLine();
}

function etStopReadAloud() {
  if (!etReading) { etClearReadingHighlight(); etShowReadControls(false); return; }
  etReading = false;
  etCancelSpeak();
  _etSetReadToggleLabel();
  etShowReadControls(false);
  etClearReadingHighlight();
}

function etReadCurrentLine() {
  etClearReadingHighlight();
  var lineEl = document.querySelector('.et-line[data-line-idx="' + etReadingLineIdx + '"]');
  if (lineEl) {
    lineEl.classList.add('et-line-reading');
    lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  var line = etLines[etReadingLineIdx];
  if (!line) { etFinishReadAloud(); return; }
  etSpeakWithCallback(line.text, function() {
    if (!etReading) return; // 使用者中途按了停止
    etReadingLineIdx++;
    if (etReadingLineIdx >= etLines.length) { etFinishReadAloud(); return; }
    etReadCurrentLine();
  });
}

function etFinishReadAloud() {
  etReading = false;
  _etSetReadToggleLabel();
  etShowReadControls(false);
  etClearReadingHighlight();
  sfxCelebrate();
  saveEtProgress(false);
}

function etClearReadingHighlight() {
  document.querySelectorAll('.et-line-reading').forEach(function(el) { el.classList.remove('et-line-reading'); });
}

function etReadPrev() {
  if (!etReading) return;
  etReadingLineIdx = Math.max(0, etReadingLineIdx - 1);
  etReadCurrentLine();
}
function etReadNext() {
  if (!etReading) return;
  etReadingLineIdx = Math.min(etLines.length - 1, etReadingLineIdx + 1);
  etReadCurrentLine();
}
function etShowReadControls(show) {
  var el = document.getElementById('et-read-controls');
  if (el) el.style.display = show ? '' : 'none';
}
function _etSetReadToggleLabel() {
  var btn = document.getElementById('et-read-toggle');
  if (btn) btn.textContent = etReading ? '⏹ 停止朗讀' : '📖 開始朗讀';
}

/* ── 語速切換（正常／慢速，這個 App 服務對象常需要比一般更慢的語速） ── */
function etSetRate(mode) {
  etRate = (mode === 'slow') ? ET_RATE_SLOW : ET_RATE_NORMAL;
  var nBtn = document.getElementById('et-rate-normal');
  var sBtn = document.getElementById('et-rate-slow');
  if (nBtn) nBtn.classList.toggle('active', mode !== 'slow');
  if (sBtn) sBtn.classList.toggle('active', mode === 'slow');
}
