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

function _ecMatchSourceChange(source) {
  var currRow = document.getElementById('ec-match-curriculum-row');
  var custRow = document.getElementById('ec-match-custom-row');
  if (currRow) currRow.style.display = source === 'curriculum' ? '' : 'none';
  if (custRow) custRow.style.display = source === 'custom'     ? '' : 'none';
  var listEl = document.getElementById('ec-match-word-list');
  if (listEl) listEl.innerHTML = '<span style="color:var(--muted)">請先選擇來源</span>';
}

function _ecMatchLoadCustomCategories() {
  if (!db || !currentTeacher) return;
  var catSel = document.getElementById('ec-match-category');
  if (!catSel) return;
  db.collection('customCategories').where('teacherUid', '==', currentTeacher.uid).get()
    .then(function(snap) {
      if (!snap.size) {
        catSel.innerHTML = '<option value="">（尚無自訂類別）</option>';
        return;
      }
      catSel.innerHTML = '<option value="">選擇類別…</option>' +
        snap.docs.map(function(doc) {
          return '<option value="' + _ecEscA(doc.id) + '">' + _ecEsc(doc.data().name || doc.id) + '</option>';
        }).join('');
    }).catch(function() {});
}

function _ecMatchUpdateGrade() {
  var publisher = ((document.getElementById('ec-match-publisher') || {}).value || '');
  var gradeNum  = ((document.getElementById('ec-match-grade-num') || {}).value || '');
  var semester  = ((document.getElementById('ec-match-version')   || {}).value || '');
  var lessonSel = document.getElementById('ec-match-lesson');
  var listEl    = document.getElementById('ec-match-word-list');
  if (!lessonSel) return;
  if (listEl) listEl.innerHTML = '<span style="color:var(--muted)">請先選擇來源</span>';
  if (!publisher || !gradeNum || !semester) {
    lessonSel.innerHTML = '<option value="">課次</option>';
    return;
  }
  var gradeKey = publisher + gradeNum + semester;
  lessonSel.innerHTML = '<option value="">載入中…</option>';
  db.collection('wordImages')
    .where('gradeLesson', '>=', gradeKey + '_')
    .where('gradeLesson', '<',  gradeKey + '_')
    .get()
    .then(function(snap) {
      var lessons = {};
      snap.forEach(function(doc) {
        var gl = doc.data().gradeLesson || '';
        var us = gl.indexOf('_');
        if (us >= 0) lessons[gl.slice(us + 1)] = true;
      });
      var list = Object.keys(lessons).sort(function(a, b) {
        var na = _CN_MAP[a], nb = _CN_MAP[b];
        if (na !== undefined && nb !== undefined) return na - nb;
        return String(a).localeCompare(String(b));
      });
      if (!list.length) {
        lessonSel.innerHTML = '<option value="">（此版本無圖庫）</option>';
        return;
      }
      lessonSel.innerHTML = '<option value="">選擇課次…</option>' +
        list.map(function(l) {
          return '<option value="' + _ecEscA(l) + '">第 ' + _ecEsc(l) + ' 課</option>';
        }).join('');
    }).catch(function() { lessonSel.innerHTML = '<option value="">課次</option>'; });
}

function _ecMatchLoadWordList() {
  var srcEl  = document.querySelector('input[name="ec-match-source"]:checked');
  var listEl = document.getElementById('ec-match-word-list');
  if (!srcEl || !listEl) return;
  var src = srcEl.value;
  var query;

  if (src === 'curriculum') {
    var publisher = ((document.getElementById('ec-match-publisher') || {}).value || '');
    var gradeNum  = ((document.getElementById('ec-match-grade-num') || {}).value || '');
    var semester  = ((document.getElementById('ec-match-version')   || {}).value || '');
    var lesson    = ((document.getElementById('ec-match-lesson')    || {}).value || '');
    if (!publisher || !gradeNum || !semester || !lesson) {
      listEl.innerHTML = '<span style="color:var(--muted)">請先選擇版本、年級、冊次和課次</span>';
      return;
    }
    query = db.collection('wordImages').where('gradeLesson', '==', publisher + gradeNum + semester + '_' + lesson);
  } else {
    var catId = ((document.getElementById('ec-match-category') || {}).value || '');
    if (!catId) {
      listEl.innerHTML = '<span style="color:var(--muted)">請先選擇自訂類別</span>';
      return;
    }
    query = db.collection('wordImages')
      .where('teacherUid', '==', currentTeacher.uid)
      .where('customCategoryId', '==', catId);
  }

  listEl.innerHTML = '<span style="color:var(--muted)">讀取中…</span>';
  query.get().then(function(snap) {
    if (!snap.size) {
      listEl.innerHTML = '<span style="color:var(--muted)">此來源尚無圖片，請先至圖庫上傳</span>';
      return;
    }
    var html = '';
    snap.forEach(function(doc) {
      var d   = doc.data();
      var id  = doc.id;
      var w   = d.word     || '';
      var img = d.imageUrl || '';
      html += '<label style="display:flex;align-items:center;gap:8px;padding:5px 2px;cursor:pointer;' +
        'border-bottom:1px solid var(--border,#e0e0e0)">' +
        '<input type="checkbox" class="ec-match-word-cb" value="' + _ecEscA(id) +
          '" data-word="' + _ecEscA(w) + '" style="flex-shrink:0">' +
        '<img src="' + _ecEsc(img) + '" style="width:36px;height:36px;object-fit:cover;border-radius:5px;flex-shrink:0">' +
        '<span style="font-size:.88rem;font-weight:700">' + _ecEsc(w) + '</span>' +
      '</label>';
    });
    listEl.innerHTML = html;
  }).catch(function() {
    listEl.innerHTML = '<span style="color:var(--wrong,#c62828)">載入失敗</span>';
  });
}

function _ecConfirmMatchSection() {
  var listEl     = document.getElementById('ec-match-word-list');
  var confirmBtn = document.getElementById('ec-match-confirm-btn');
  var checked    = listEl ? listEl.querySelectorAll('.ec-match-word-cb:checked') : [];

  if (checked.length < 2) { showToast('請至少勾選 2 個詞語'); return; }

  var srcEl = document.querySelector('input[name="ec-match-source"]:checked');
  var src   = srcEl ? srcEl.value : 'curriculum';
  var gradeLesson = '', categoryId = '';

  if (src === 'curriculum') {
    var publisher = ((document.getElementById('ec-match-publisher') || {}).value || '');
    var gradeNum  = ((document.getElementById('ec-match-grade-num') || {}).value || '');
    var semester  = ((document.getElementById('ec-match-version')   || {}).value || '');
    var lesson    = ((document.getElementById('ec-match-lesson')    || {}).value || '');
    gradeLesson   = publisher + gradeNum + semester + '_' + lesson;
  } else {
    categoryId = ((document.getElementById('ec-match-category') || {}).value || '');
  }

  var wordIds = [], words = [];
  [].forEach.call(checked, function(cb) {
    wordIds.push(cb.value);
    words.push(cb.dataset.word || '');
  });

  _ecMatchSections.push({
    title: '連連看', source: src,
    gradeLesson: gradeLesson, categoryId: categoryId,
    pairCount: wordIds.length,
    wordIds: wordIds, words: words
  });
  _ecCloseMatchModal();
  _ecRenderLayout();
  showToast('已加入連連看：共 ' + wordIds.length + ' 組詞語圖片');
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
