/**
 * admin/exam-compose-select.js — 試卷編製精靈 Step 2：選題
 * 原本是 exam-compose.js 的一部分，照章節拆成獨立檔案，內容沒有改。
 * 共用的狀態變數（_ec*、_qe*、_dct*）宣告在 exam-compose.js；各檔的函式都是全域的，可以互相呼叫。
 * 依賴：shared.js（db、showToast）、init.js（currentTeacher）、exam-compose.js
 */
'use strict';

/* ════════════════════════════════
   Step 2：選題
   ════════════════════════════════ */
function _ecLoadQuestions() {
  var wrap = document.getElementById('ec-q-list');
  if (!wrap) return;

  if (_ecAllQ.length && _ecAllQSub === _ecSubject) {
    _ecBuildFilters();
    _ecFilterAndRender();
    return;
  }

  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  var coll = _ecSubject === 'math' ? 'mathQuestions' : 'questions';

  var qQ  = db.collection(coll).where('teacherUid', '==', currentTeacher.uid).get();
  /* 課次清單／句子重組挑句子都需要課文編輯的資料，語文科才查；數學科沒有這個概念 */
  var qLT = _ecSubject === 'chinese'
    ? db.collection('lessonTexts').where('teacherUid', '==', currentTeacher.uid).get()
    : Promise.resolve({ forEach: function() {} });

  Promise.all([qQ, qLT]).then(function(results) {
    _ecAllQ = [];
    results[0].forEach(function(doc) { _ecAllQ.push(Object.assign({ id: doc.id }, doc.data())); });
    _ecAllQSub = _ecSubject;

    _ecAllLessonTexts = [];
    results[1].forEach(function(doc) { _ecAllLessonTexts.push(Object.assign({ docId: doc.id }, doc.data())); });

    if (!_ecAllQ.length && !_ecAllLessonTexts.length) {
      wrap.innerHTML = '<p style="color:var(--muted);padding:16px;font-size:.88rem">題庫中尚無題目。請先至「資料庫」上傳題目。</p>';
      return;
    }
    _ecBuildFilters();
    _ecFilterAndRender();
  }).catch(function(e) {
    wrap.innerHTML = '<p style="color:var(--red);font-size:.88rem">載入失敗：' + e.message + '</p>';
  });
}

function _ecBuildFilters() {
  var gradeEl     = document.getElementById('ec-filter-grade');
  var gradeLockEl = document.getElementById('ec-filter-grade-lock');
  var typeEl      = document.getElementById('ec-filter-type');

  /* 年級：有 _ecGrade 就鎖定顯示 chip，否則顯示下拉 */
  if (_ecGrade) {
    if (gradeEl)     { gradeEl.style.display = 'none'; gradeEl.value = _ecGrade; }
    if (gradeLockEl) { gradeLockEl.style.display = ''; gradeLockEl.textContent = _ecGrade; }
  } else {
    if (gradeLockEl) gradeLockEl.style.display = 'none';
    var grades = {};
    _ecAllQ.forEach(function(q) { if (q.grade) grades[q.grade] = true; });
    if (gradeEl) {
      gradeEl.style.display = '';
      gradeEl.innerHTML = '<option value="">全部年級</option>' +
        Object.keys(grades).sort(function(a, b) {
          return (_CN_MAP[a] || 999) - (_CN_MAP[b] || 999);
        }).map(function(g) {
          return '<option value="' + _ecEscA(g) + '">' + _ecEsc(g) + '</option>';
        }).join('');
    }
  }

  /* 課次 / 類別（依目前年級篩選） */
  _ecUpdateCatFilter();

  /* 題型（語文專用）——固定題型（_EC_TYPE_ORDER）一律先列出來，不等實際有資料才出現，
     這樣「句子重組」這種需要另外建立的題型，老師選了篩選才看得到「+ 新增」的入口 */
  if (typeEl) {
    if (_ecSubject === 'chinese') {
      var prevType = typeEl.value;
      var types = {};
      _EC_TYPE_ORDER.forEach(function(t) { types[t] = true; });
      _ecAllQ.forEach(function(q) { if (q.type) types[q.type] = true; });
      typeEl.innerHTML = '<option value="">全部題型</option>' +
        Object.keys(types).sort(function(a, b) {
          var ia = _EC_TYPE_ORDER.indexOf(a); if (ia < 0) ia = 999;
          var ib = _EC_TYPE_ORDER.indexOf(b); if (ib < 0) ib = 999;
          return ia - ib;
        }).map(function(t) {
          return '<option value="' + _ecEscA(t) + '">' + _ecEsc(t) + '</option>';
        }).join('');
      typeEl.value = prevType;
      typeEl.style.display = '';
    } else {
      typeEl.style.display = 'none';
    }
  }
}

/* 年級變動時：重建課次清單 → 重新渲染 */
function _ecOnGradeChange() {
  _ecUpdateCatFilter();
  _ecFilterAndRender();
}

/* 依目前年級選取值重建課次 / 類別下拉 */
function _ecUpdateCatFilter() {
  var catEl  = document.getElementById('ec-filter-cat');
  if (!catEl) return;
  var prevCat = catEl.value; /* 重建清單後要是還選得到同一課，就留著不要跳回「全部課次」 */
  var grade  = _ecGrade || ((document.getElementById('ec-filter-grade') || {}).value || '');
  var catKey = _ecSubject === 'math' ? 'category' : 'lesson';
  var pholder = _ecSubject === 'math' ? '全部類別' : '全部課次';

  var cats = {}, lessonNames = {};
  _ecAllQ.forEach(function(q) {
    if (grade && q.grade !== grade) return;
    if (q[catKey]) cats[q[catKey]] = true;
    if (_ecSubject === 'chinese' && q.lesson && q.lessonName) lessonNames[q.lesson] = q.lessonName;
  });
  /* 課次清單不能只看 questions——課文編輯可能已經存了課文、但這一課還沒出過任何題目，
     questions 裡查不到，這裡也要補上，否則「選到課次才看得到課文」這個功能自己就先卡住了 */
  if (_ecSubject === 'chinese') {
    (_ecAllLessonTexts || []).forEach(function(lt) {
      if (grade && lt.grade !== grade) return;
      if (lt.lesson) cats[lt.lesson] = true;
      if (lt.lesson && lt.lessonName) lessonNames[lt.lesson] = lt.lessonName;
    });
  }

  catEl.innerHTML = '<option value="">' + pholder + '</option>' +
    Object.keys(cats).sort(function(a, b) {
      var na = _CN_MAP[a], nb = _CN_MAP[b];
      if (na !== undefined && nb !== undefined) return na - nb;
      return String(a).localeCompare(String(b));
    }).map(function(c) {
      var lbl = lessonNames[c] ? c + ' ' + lessonNames[c] : c;
      return '<option value="' + _ecEscA(c) + '">' + _ecEsc(lbl) + '</option>';
    }).join('');
  catEl.value = prevCat; /* 選不到（例如年級真的換了）瀏覽器會自動留空，效果等同原本強制重置 */
}

function _ecFilterAndRender() {
  var grade  = _ecGrade || ((document.getElementById('ec-filter-grade')  || {}).value || '');
  var cat    = ((document.getElementById('ec-filter-cat')    || {}).value || '');
  var type   = ((document.getElementById('ec-filter-type')   || {}).value || '');
  var search = (((document.getElementById('ec-filter-search') || {}).value || '')).trim().toLowerCase();
  var catKey = _ecSubject === 'math' ? 'category' : 'lesson';

  var filtered = _ecAllQ.filter(function(q) {
    if (grade && q.grade   !== grade) return false;
    if (cat   && q[catKey] !== cat)   return false;
    if (type  && q.type    !== type)  return false;
    /* 默寫生字的清單只顯示「目前有勾選進這份測驗」的題目——生字來源是上面的選字區，字出完題
       之後本來就會自動勾選，取消勾選代表「這次不考這個字」，不該繼續佔著清單；要再考回來
       到上面選字區把那個字點回來就好（見 _ecRenderDictCreateRow／_ecToggleDictCharSelect），
       不是靠這裡的清單重新勾選——兩邊入口只留一個，不要做出兩套都能切換選取狀態的重複介面 */
    if (q.type === '默寫生字' && !_ecSelected[q.id]) return false;
    if (search) {
      var t = String(q.question || q.word || '').toLowerCase();
      if (t.indexOf(search) < 0) return false;
    }
    return true;
  });

  var cntEl = document.getElementById('ec-selected-count');
  if (cntEl) cntEl.textContent = Object.keys(_ecSelected).length;

  /* 句子重組這個題型沒有 Excel 批次匯入（需要照本課語詞即時拆解，沒辦法用表格打），篩到這個
     題型時在清單上方放一個「+ 新增」入口——只在選到這個題型才出現，不是額外獨立的區塊。
     如果同時選了specific 課次，直接把那一課的課文列出來，點句子就能直接帶進新增視窗，
     不用老師自己切去課文編輯複製貼上 */
  var srRow = document.getElementById('ec-sr-create-row');
  if (srRow) {
    if (type === '句子重組') { srRow.style.display = ''; _ecRenderSrCreateRow(grade, cat); }
    else { srRow.style.display = 'none'; }
  }

  /* 默寫生字：生字清單跟著課次走（來自練字趣），同樣只在篩到這個題型才出現入口 */
  var dictRow = document.getElementById('ec-dict-create-row');
  if (dictRow) {
    if (type === '默寫生字') { dictRow.style.display = ''; _ecRenderDictCreateRow(grade, cat); }
    else { dictRow.style.display = 'none'; }
  }

  var wrap = document.getElementById('ec-q-list');
  if (!wrap) return;

  if (!filtered.length) {
    wrap.innerHTML = '<p style="color:var(--muted);font-size:.85rem;padding:12px">找不到符合條件的題目</p>';
    return;
  }

  var shown = filtered.slice(0, 150);
  wrap.innerHTML = shown.map(function(q) {
    var chk   = _ecSelected[q.id] ? ' checked' : '';
    /* 句子重組看不出題幹跟答案的分別——直接把切好的片段用分隔號接起來顯示，老師一眼就看得出
       斷詞斷在哪，不用另外點開才知道 */
    var text  = q.type === '句子重組' && q.options && q.options.length
      ? q.options.map(_ecEsc).join('<span style="color:var(--blue);font-weight:900">｜</span>')
      : q.type === '默寫生字'
      ? _ecEsc(q.question) + '　<span style="color:var(--muted)">' + _ecEsc(q.zhuyin || '') +
        (q.hintWord ? '　「' + _ecEsc(q.hintWord) + '」' : '　<span style="color:#c9780c">（還沒填語詞）</span>') + '</span>'
      : _ecEsc(q.question || q.word || '—');
    var badge = _ecSubject === 'chinese' && q.type
      ? ' <span style="font-size:.7rem;color:var(--muted)">[' + _ecEsc(q.type) + ']</span>'
      : (_ecSubject === 'math' && q.answer
          ? ' <span style="font-size:.7rem;color:var(--muted)">答：' + _ecEsc(q.answer) + '</span>'
          : '');
    /* checkbox 跟「點題目開編輯/刪除視窗」分開，不能再用 <label> 整包包起來（點哪裡都會
       觸發 checkbox），checkbox 自己管自己的勾選，文字部分自己管自己的點擊 */
    return '<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 4px;border-bottom:1px solid var(--border)">' +
      '<input type="checkbox"' + chk + ' onchange="_ecToggleQ(\'' + q.id + '\',this.checked)"' +
        ' style="margin-top:3px;width:16px;height:16px;flex-shrink:0;cursor:pointer">' +
      '<span style="font-size:.85rem;line-height:1.5;cursor:pointer" onclick="_ecOpenQuestionPopup(\'' + q.id + '\')" ' +
        'title="點一下可以編輯或刪除這一題">' + text + badge + ' <span style="color:var(--muted);font-size:.72rem">✎</span></span>' +
    '</div>';
  }).join('');

  if (filtered.length > 150) {
    wrap.innerHTML += '<p style="font-size:.75rem;color:var(--muted);text-align:center;padding:8px">僅顯示前 150 題，請使用篩選縮小範圍</p>';
  }
}

function _ecToggleQ(id, checked) {
  if (checked) _ecSelected[id] = true;
  else         delete _ecSelected[id];
  var el = document.getElementById('ec-selected-count');
  if (el) el.textContent = Object.keys(_ecSelected).length;

  /* 默寫生字取消勾選要讓這一題整個從清單消失、選字區的 chip 退回「可以再點回來」的狀態
     （見 _ecFilterAndRender／_ecRenderDictCreateRow），跟其他題型「取消勾選但題目還留在
     清單裡方便重新勾選」的瀏覽式選題行為不一樣，所以這裡需要整個重畫；其他題型維持原本
     輕量行為，不要每勾一下就整個重繪整張清單 */
  if (!checked) {
    var q = null;
    for (var k = 0; k < _ecAllQ.length; k++) { if (_ecAllQ[k].id === id) { q = _ecAllQ[k]; break; } }
    if (q && q.type === '默寫生字') _ecFilterAndRender();
  }
}

/* 點清單裡一題既有題目：句子重組有現成的拆解編輯器，直接開那個編輯模式；
   其他題型（Excel 匯入，詞語填空/解釋/選擇題/數學）結構單純（純文字題幹/答案，選擇題多幾個
   選項），開共用的純文字編輯 modal（_ecOpenQeditModal），不用再回「資料庫」重新匯入 */
function _ecOpenQuestionPopup(docId) {
  var q = null;
  for (var k = 0; k < _ecAllQ.length; k++) { if (_ecAllQ[k].id === docId) { q = _ecAllQ[k]; break; } }
  if (!q) return;
  if (q.type === '句子重組') { _ecOpenSrModalForEdit(docId); return; }
  if (q.type === '默寫生字') { _ecOpenDictModalForEdit(docId); return; }
  _ecOpenQeditModal(docId);
}

/* 句子重組 modal 的「刪除」跟一般題目 qedit modal 的「刪除」共用同一套「從 _ecAllQ/_ecSelected
   移除＋重繪」收尾邏輯——跟題型無關，純粹是清單狀態管理 */
function _ecRemoveQFromList(docId) {
  var kept = [];
  for (var k = 0; k < _ecAllQ.length; k++) { if (_ecAllQ[k].id !== docId) kept.push(_ecAllQ[k]); }
  _ecAllQ = kept;
  delete _ecSelected[docId];
  _ecBuildFilters();
  _ecFilterAndRender();
}

function _ecSelectAll() {
  var grade  = _ecGrade || ((document.getElementById('ec-filter-grade')  || {}).value || '');
  var cat    = ((document.getElementById('ec-filter-cat')    || {}).value || '');
  var type   = ((document.getElementById('ec-filter-type')   || {}).value || '');
  var search = (((document.getElementById('ec-filter-search') || {}).value || '')).trim().toLowerCase();
  var catKey = _ecSubject === 'math' ? 'category' : 'lesson';

  _ecAllQ.filter(function(q) {
    if (grade && q.grade   !== grade) return false;
    if (cat   && q[catKey] !== cat)   return false;
    if (type  && q.type    !== type)  return false;
    if (search) {
      var t = String(q.question || q.word || '').toLowerCase();
      if (t.indexOf(search) < 0) return false;
    }
    return true;
  }).forEach(function(q) { _ecSelected[q.id] = true; });

  /* 默寫生字的字不是「既有題目」，大部分根本還沒出題，單純勾選不夠——「全選」對這個題型
     來說真正該做的是把這一課還沒出題的生字一次全部建好（逐字查注音、借字義）再勾起來 */
  if (type === '默寫生字' && cat) _ecBulkCreateMissingDictChars(grade, cat);

  _ecFilterAndRender();
}

function _ecDeselectAll() {
  var grade  = _ecGrade || ((document.getElementById('ec-filter-grade')  || {}).value || '');
  var cat    = ((document.getElementById('ec-filter-cat')    || {}).value || '');
  var type   = ((document.getElementById('ec-filter-type')   || {}).value || '');
  var search = (((document.getElementById('ec-filter-search') || {}).value || '')).trim().toLowerCase();
  var catKey = _ecSubject === 'math' ? 'category' : 'lesson';

  _ecAllQ.filter(function(q) {
    if (grade && q.grade   !== grade) return false;
    if (cat   && q[catKey] !== cat)   return false;
    if (type  && q.type    !== type)  return false;
    if (search) {
      var t = String(q.question || q.word || '').toLowerCase();
      if (t.indexOf(search) < 0) return false;
    }
    return true;
  }).forEach(function(q) { delete _ecSelected[q.id]; });

  _ecFilterAndRender();
}

function _ecValidateStep2() {
  var cnt = Object.keys(_ecSelected).length;
  var err = document.getElementById('ec-step2-err');
  if (!cnt && !_ecMatchSections.length) { if (err) err.textContent = '請至少選擇一道題目'; return false; }
  if (err) err.textContent = '';
  _ecBuildSections();
  return true;
}
