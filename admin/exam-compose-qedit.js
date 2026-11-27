/**
 * admin/exam-compose-qedit.js — 試卷編製精靈：一般題目（詞語解釋／詞語填空／選擇題／數學）編輯 modal
 * 原本是 exam-compose.js 的一部分，照章節拆成獨立檔案，內容沒有改。
 * 共用的狀態變數（_ec*、_qe*、_dct*）宣告在 exam-compose.js；各檔的函式都是全域的，可以互相呼叫。
 * 依賴：shared.js（db、showToast）、init.js（currentTeacher）、exam-compose.js
 */
'use strict';

/* ════════════════════════════════
   一般題目（詞語解釋／詞語填空／選擇題／數學）編輯 modal
   句子重組結構特殊（要分段），有自己專用的拆解編輯器；這些題型就是純文字題幹/答案
   （選擇題多幾個選項），共用一個簡單的文字編輯 modal 就夠，不用另外各做一套 */
function _ecOpenQeditModal(docId) {
  var q = null;
  for (var k = 0; k < _ecAllQ.length; k++) { if (_ecAllQ[k].id === docId) { q = _ecAllQ[k]; break; } }
  if (!q) return;
  var modal = document.getElementById('qedit-modal');
  if (!modal) return;

  _qeDocId = docId;
  var isMath   = _ecSubject === 'math';
  var isChoice = q.type === '選擇題';

  document.getElementById('qedit-modal-title').textContent = '✎ 編輯' + (q.type ? '「' + q.type + '」' : '') + '題目';
  document.getElementById('qedit-grade-display').textContent = q.grade || _ecGrade || '';
  document.getElementById('qedit-lesson-wrap').style.display     = isMath ? 'none' : '';
  document.getElementById('qedit-lessonname-wrap').style.display = isMath ? 'none' : '';
  document.getElementById('qedit-category-wrap').style.display   = isMath ? '' : 'none';
  document.getElementById('qedit-lesson').value      = q.lesson || '';
  document.getElementById('qedit-lesson-name').value = q.lessonName || '';
  document.getElementById('qedit-category').value    = q.category || '';
  document.getElementById('qedit-question').value    = q.question || '';
  document.getElementById('qedit-question-hint').textContent =
    (q.type === '詞語填空') ? '（空格請用「（　）」表示）' : '';

  document.getElementById('qedit-options-wrap').style.display = isChoice ? '' : 'none';
  document.getElementById('qedit-answer-wrap').style.display  = isChoice ? 'none' : '';
  document.getElementById('qedit-answer').value = q.answer || '';

  if (isChoice) {
    var opts = (q.options && q.options.length ? q.options : ['', '']).slice();
    var correctIdx = opts.indexOf(q.answer);
    _qeOptions    = opts;
    _qeCorrectIdx = correctIdx >= 0 ? correctIdx : 0;
    _qeRenderOptions();
  }

  var statusEl = document.getElementById('qedit-status');
  if (statusEl) { statusEl.style.color = 'var(--muted)'; statusEl.textContent = ''; }

  modal.style.display = 'flex';
}

function _qeRenderOptions() {
  var wrap = document.getElementById('qedit-options-list');
  if (!wrap) return;
  wrap.innerHTML = _qeOptions.map(function(opt, i) {
    return '<div style="display:flex;align-items:center;gap:8px">' +
      '<input type="radio" name="qedit-correct"' + (i === _qeCorrectIdx ? ' checked' : '') +
        ' onchange="_qeCorrectIdx=' + i + '" title="標記為正確答案" style="flex-shrink:0;width:16px;height:16px;cursor:pointer">' +
      '<input type="text" value="' + _ecEscA(opt) + '" oninput="_qeOptions[' + i + ']=this.value" ' +
        'style="flex:1;padding:7px 10px;border:1.5px solid var(--border);border-radius:7px;font-size:.88rem;font-family:inherit;box-sizing:border-box">' +
      (_qeOptions.length > 2
        ? '<button type="button" onclick="_qeRemoveOption(' + i + ')" title="刪除這個選項" ' +
            'style="flex-shrink:0;width:26px;height:26px;border:1.5px solid var(--border);border-radius:6px;background:white;color:var(--muted);cursor:pointer;font-size:.9rem;line-height:1;font-family:inherit">×</button>'
        : '') +
    '</div>';
  }).join('');
}

function _qeAddOption() {
  if (_qeOptions.length >= 4) { showToast('選擇題最多 4 個選項'); return; }
  _qeOptions.push('');
  _qeRenderOptions();
}

function _qeRemoveOption(i) {
  if (_qeOptions.length <= 2) return;
  _qeOptions.splice(i, 1);
  if (_qeCorrectIdx >= _qeOptions.length) _qeCorrectIdx = _qeOptions.length - 1;
  else if (_qeCorrectIdx > i) _qeCorrectIdx--;
  _qeRenderOptions();
}

function _qeCloseModal() {
  var modal = document.getElementById('qedit-modal');
  if (modal) modal.style.display = 'none';
  _qeDocId = null;
}

function _qeSave() {
  if (!_qeDocId || !db) return;
  var q = null;
  for (var k = 0; k < _ecAllQ.length; k++) { if (_ecAllQ[k].id === _qeDocId) { q = _ecAllQ[k]; break; } }
  if (!q) return;
  var isMath   = _ecSubject === 'math';
  var isChoice = q.type === '選擇題';
  var statusEl = document.getElementById('qedit-status');
  function fail(msg) { if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = msg; } }

  var question = document.getElementById('qedit-question').value.trim();
  if (!question) { fail('題幹不能空白'); return; }

  var patch = { question: question };
  if (isMath) {
    patch.category = document.getElementById('qedit-category').value.trim();
  } else {
    patch.lesson = document.getElementById('qedit-lesson').value.trim();
    patch.lessonName = document.getElementById('qedit-lesson-name').value.trim();
    if (!patch.lesson) { fail('課次不能空白'); return; }
  }

  if (isChoice) {
    var opts = _qeOptions.map(function(o) { return o.trim(); }).filter(Boolean);
    if (opts.length < 2) { fail('選擇題至少需要 2 個選項'); return; }
    if (_qeCorrectIdx >= opts.length) _qeCorrectIdx = 0;
    patch.options = opts;
    patch.answer  = opts[_qeCorrectIdx];
  } else {
    var answer = document.getElementById('qedit-answer').value.trim();
    if (!answer) { fail('答案不能空白'); return; }
    patch.answer  = answer;
    patch.options = [];
  }

  var coll  = isMath ? 'mathQuestions' : 'questions';
  var docId = _qeDocId;
  db.collection(coll).doc(docId).update(patch).then(function() {
    var idx = -1;
    for (var k = 0; k < _ecAllQ.length; k++) { if (_ecAllQ[k].id === docId) { idx = k; break; } }
    if (idx !== -1) _ecAllQ[idx] = Object.assign({}, _ecAllQ[idx], patch);
    _ecBuildFilters();
    _ecFilterAndRender();
    showToast('✅ 已儲存變更');
    _qeCloseModal();
  }).catch(function(e) { fail('儲存失敗：' + e.message); });
}

function _qeDelete() {
  if (!_qeDocId || !db) return;
  var q = null;
  for (var k = 0; k < _ecAllQ.length; k++) { if (_ecAllQ[k].id === _qeDocId) { q = _ecAllQ[k]; break; } }
  var label = q ? (q.question || '（無題幹）') : '（無題幹）';
  if (!confirm('「' + label + '」\n\n確定要刪除這一題嗎？此操作無法復原。')) return;
  var isMath = _ecSubject === 'math';
  var coll   = isMath ? 'mathQuestions' : 'questions';
  var docId  = _qeDocId;
  db.collection(coll).doc(docId).delete().then(function() {
    showToast('✅ 已刪除這一題');
    _ecRemoveQFromList(docId);
    _qeCloseModal();
  }).catch(function(e) { showToast('❌ 刪除失敗：' + e.message); });
}

/* 句子重組的「+新增」入口：沒選特定課次時只有按鈕；選了特定課次，而且課文編輯那邊剛好
   有這一課的課文，就把課文列出來（按標點斷句），點一句直接帶進新增視窗並預先拆好詞 */
function _ecRenderSrCreateRow(grade, lesson) {
  var row = document.getElementById('ec-sr-create-row');
  if (!row) return;
  var html = '<button onclick="_ecOpenSrModal()" class="btn btn-secondary" style="font-size:.8rem;padding:6px 14px">🧩 新增一題句子重組題</button>';

  if (lesson) {
    var lt = (_ecAllLessonTexts || []).filter(function(x) { return x.grade === grade && x.lesson === lesson; })[0];
    if (lt && lt.fullText) {
      var sentences = lt.fullText
        .split(/[。！？\n]+/)
        .map(function(s) { return s.replace(/^［圖:[^］]+］$/, '').trim(); })
        .filter(Boolean);
      if (sentences.length) {
        html += '<div style="margin-top:10px;font-size:.78rem;color:var(--muted);font-weight:700">' +
          '或從「' + _ecEsc(lt.lessonName || ('第' + lesson + '課')) + '」課文挑一句：</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">' +
          sentences.map(function(s) {
            return '<button type="button" onclick="_ecOpenSrModal(\'' + _ecEscJs(s) + '\',\'' +
              _ecEscJs(lesson) + '\',\'' + _ecEscJs(lt.lessonName || '') + '\')" ' +
              'style="padding:6px 12px;border:1.5px solid var(--border);border-radius:8px;background:white;' +
              'font-size:.82rem;cursor:pointer;font-family:inherit">' + _ecEsc(s) + '</button>';
          }).join('') +
          '</div>';
      }
    }
  }
  row.innerHTML = html;
}

function _ecRemoveMatchSection(i) {
  _ecMatchSections.splice(i, 1);
  _ecRenderLayout();
}

function _ecEditMatchSectionTitle(i) {
  var msec = _ecMatchSections[i];
  if (!msec) return;
  var text = prompt('請輸入大題標題', msec.title || '');
  if (text === null || !text.trim()) return;
  msec.title = text.trim();
  _ecRenderLayout();
}
