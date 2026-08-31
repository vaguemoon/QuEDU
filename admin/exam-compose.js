/**
 * admin/exam-compose.js — 試卷編製精靈
 * 步驟：基本資料 → 選題 → 排版（大題分組）→ 輸出
 * 依賴：shared.js（db、showToast）、init.js（currentTeacher）
 */
'use strict';

/* ─── 狀態 ─── */
var _ecSessionId  = null;      // 編輯中的 quizSession id（null = 新建）
var _ecStep       = 1;
var _ecName       = '';
var _ecSubject    = 'chinese';
var _ecGrade      = '';        // 版本+冊次，e.g. "康軒三上"
var _ecVersion    = '';        // 版本，e.g. "康軒"
var _ecVolume     = '';        // 冊次，e.g. "三上"
var _ecLesson     = '';        // 課次號碼，e.g. "七"；空字串=全冊/跨課次
var _ecLessonName = '';        // 課次名稱，e.g. "走進博物館"
var _ecSections   = [];        // [{ title, key, collapsed, questions:[{id,label}] }]
var _ecAllQ       = [];        // 從 Firestore 讀入（含 id）
var _ecAllQSub    = '';        // _ecAllQ 對應的 subject（快取判斷用）
var _ecSelected   = {};        // { docId: true }
var _ecMatchSections = [];   // [{title,source,gradeLesson,categoryId,pairCount,wordIds:[],words:[]}]

/* 中文數字排序表 */
var _CN_MAP = {
  '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,
  '十':10,'十一':11,'十二':12,'十三':13,'十四':14,'十五':15,
  '十六':16,'十七':17,'十八':18,'十九':19,'二十':20
};
/* 語文大題預設順序 */
var _EC_TYPE_ORDER = ['詞語填空', '詞語解釋', '選擇題'];
/* 大題編號（中文數字） */
var _EC_CN = ['一','二','三','四','五','六','七','八','九','十'];

/* ════════════════════════════════
   View 切換
   ════════════════════════════════ */
function _ecToggleView(view) {
  var sv = document.getElementById('qz-sessions-view');
  var wv = document.getElementById('ec-wizard-view');
  if (sv) sv.style.display = view === 'list'   ? '' : 'none';
  if (wv) wv.style.display = view === 'wizard' ? '' : 'none';
}

function _ecShowList() {
  _ecToggleView('list');
  if (typeof loadQuizSessions === 'function') loadQuizSessions();
}

/* ════════════════════════════════
   精靈 Wizard
   ════════════════════════════════ */
function _ecNewDraft() {
  _ecSessionId  = null;
  _ecName       = '';
  _ecSubject    = 'chinese';
  _ecGrade      = '';
  _ecVersion    = '';
  _ecVolume     = '';
  _ecLesson     = '';
  _ecLessonName = '';
  _ecSections      = [];
  _ecSelected      = {};
  _ecAllQ          = [];
  _ecMatchSections = [];
  _ecOpenWizard(1);
}

/* ── 從測驗列表編輯已發布的試卷 ── */
function _ecEditSession(sessionId) {
  if (!db || !currentTeacher) { showToast('Firebase 未就緒'); return; }
  db.collection('quizSessions').doc(sessionId).get().then(function(doc) {
    if (!doc.exists) { showToast('找不到此測驗'); return; }
    var d        = doc.data();
    _ecSessionId  = sessionId;
    _ecName       = d.name       || '';
    _ecSubject    = d.subject    || 'chinese';
    _ecGrade      = d.grade      || '';
    _ecVersion    = d.version    || '';
    _ecVolume     = d.volume     || '';
    _ecLesson     = d.lesson     || '';
    _ecLessonName = d.lessonName || '';
    _ecSelected      = {};
    _ecSections      = [];
    _ecAllQ          = [];
    _ecMatchSections = (d.matchSections || []).slice();

    var questionIds = d.questionIds || [];
    questionIds.forEach(function(id) { _ecSelected[id] = true; });

    if (!questionIds.length) { _ecOpenWizard(1); return; }

    /* 暫時載入選中的題目以建立大題結構，之後清空讓步驟二重新載入完整題庫 */
    var coll = _ecSubject === 'math' ? 'mathQuestions' : 'questions';
    Promise.all(questionIds.map(function(qId) {
      return db.collection(coll).doc(qId).get();
    })).then(function(qdocs) {
      _ecAllQ = [];
      qdocs.forEach(function(qd) {
        if (qd.exists) _ecAllQ.push(Object.assign({ id: qd.id }, qd.data()));
      });
      _ecBuildSections();
      _ecAllQ = [];  /* 清空，讓步驟二重新載入完整題庫供追加選題 */
      _ecOpenWizard(1);
    }).catch(function(e) { showToast('載入題目失敗：' + e.message); });
  }).catch(function(e) { showToast('載入失敗：' + e.message); });
}

/* ── 從測驗列表列印已發布的試卷 ── */
function _ecPrintSession(sessionId) {
  if (!db || !currentTeacher) return;
  db.collection('quizSessions').doc(sessionId).get().then(function(doc) {
    if (!doc.exists) { showToast('找不到此測驗'); return; }
    var d           = doc.data();
    var questionIds = d.questionIds || [];
    if (!questionIds.length) { showToast('試卷中無題目'); return; }

    var coll = d.subject === 'math' ? 'mathQuestions' : 'questions';
    Promise.all(questionIds.map(function(qId) {
      return db.collection(coll).doc(qId).get();
    })).then(function(qdocs) {
      var grouped = {};
      qdocs.forEach(function(qd) {
        if (!qd.exists) return;
        var qdata = qd.data();
        var type  = qdata.type || '其他';
        var label = qdata.question || qdata.word || '';
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push({ id: qd.id, label: label, type: type,
                              answer: qdata.answer || qdata.word || '',
                              options: qdata.options || null });
      });

      var sections = [];
      var idx      = 0;
      _EC_TYPE_ORDER.forEach(function(type) {
        if (grouped[type] && grouped[type].length) {
          sections.push({ title: (_EC_CN[idx] || String(idx + 1)) + '、' + type,
                          key: type, questions: grouped[type] });
          idx++;
        }
      });
      Object.keys(grouped).forEach(function(type) {
        if (_EC_TYPE_ORDER.indexOf(type) === -1 && grouped[type].length) {
          sections.push({ title: (_EC_CN[idx] || String(idx + 1)) + '、' + type,
                          key: type, questions: grouped[type] });
          idx++;
        }
      });

      _ecDoPrint(d.name || '試卷', sections, d.subject || 'chinese', d.matchSections || []);
    }).catch(function(e) { showToast('載入失敗：' + e.message); });
  }).catch(function(e) { showToast('載入失敗：' + e.message); });
}

/* 內部共用：切換到指定步驟，skipValidation=true 時跳過前進驗證 */
function _ecGotoStep(n, skipValidation) {
  if (!skipValidation && n > _ecStep) {
    if (_ecStep === 1 && !_ecValidateStep1()) return;
    if (_ecStep === 2 && !_ecValidateStep2()) return;
  }
  _ecStep = n;
  _ecUpdateStepBar();
  [1, 2, 3, 4].forEach(function(i) {
    var el = document.getElementById('ec-panel-' + i);
    if (el) el.style.display = i === n ? '' : 'none';
  });
  if (n === 2) _ecLoadQuestions();
  if (n === 3) _ecRenderLayout();
  if (n === 4) _ecRenderPreview();
}

function _ecOpenWizard(step) {
  _ecToggleView('wizard');
  _ecSyncStep1Form();
  _ecGotoStep(step, true);
}

function _ecUpdateStepBar() {
  [1, 2, 3, 4].forEach(function(i) {
    var el = document.getElementById('ec-stp-' + i);
    if (!el) return;
    el.className = 'ec-step-dot' +
      (i === _ecStep ? ' active' : '') +
      (i <  _ecStep  ? ' done'   : '');
  });
  [1, 2, 3].forEach(function(i) {
    var el = document.getElementById('ec-conn-' + i);
    if (!el) return;
    el.className = 'ec-step-connector' + (i < _ecStep ? ' done' : '');
  });
}

function _ecSyncStep1Form() {
  var n   = document.getElementById('ec-name');
  var s   = document.getElementById('ec-subject');
  var ver = document.getElementById('ec-version');
  var vol = document.getElementById('ec-volume');
  if (n)   n.value   = _ecName;
  if (s)   s.value   = _ecSubject;
  if (ver) ver.value = _ecVersion;
  if (vol) {
    vol.value = _ecVolume;
    _ecUpdateLessonOptions();  /* 觸發課次選單載入 */
  }
}

function _ecGoStep(n) { _ecGotoStep(n, false); }

/* ── Step 1 驗證 ── */
function _ecValidateStep1() {
  _ecName    = ((document.getElementById('ec-name')    || {}).value || '').trim();
  _ecSubject = ((document.getElementById('ec-subject') || {}).value || 'chinese');
  _ecVersion = ((document.getElementById('ec-version') || {}).value || '');
  _ecVolume  = ((document.getElementById('ec-volume')  || {}).value || '');
  _ecGrade   = _ecVersion ? _ecVersion + _ecVolume : _ecVolume;

  var lessonEl  = document.getElementById('ec-lesson');
  _ecLesson     = lessonEl ? lessonEl.value : '';
  var selOpt    = lessonEl && lessonEl.selectedIndex >= 0 ? lessonEl.options[lessonEl.selectedIndex] : null;
  _ecLessonName = selOpt ? (selOpt.getAttribute('data-name') || '') : '';

  var err = document.getElementById('ec-step1-err');
  if (!_ecName)   { if (err) err.textContent = '請輸入試卷名稱'; return false; }
  if (!_ecVolume) { if (err) err.textContent = '請選擇冊次'; return false; }
  if (err) err.textContent = '';
  return true;
}

/* ── 依版本+冊次動態載入課次選單 ── */
function _ecUpdateLessonOptions() {
  var version  = ((document.getElementById('ec-version') || {}).value || '');
  var volume   = ((document.getElementById('ec-volume')  || {}).value || '');
  var lessonEl = document.getElementById('ec-lesson');
  if (!lessonEl) return;

  _ecGrade = version ? version + volume : volume;

  if (!volume) {
    lessonEl.innerHTML = '<option value="">全冊 / 跨課次</option>';
    return;
  }

  if (!db || !currentTeacher) {
    lessonEl.innerHTML = '<option value="">全冊 / 跨課次</option>';
    return;
  }
  lessonEl.innerHTML = '<option value="">載入中…</option>';

  Promise.all([
    db.collection('questions').where('teacherUid', '==', currentTeacher.uid).where('grade', '==', _ecGrade).get(),
    db.collection('questions').where('teacherUid', '==', 'shared').where('grade', '==', _ecGrade).get()
      .catch(function() { return { forEach: function(){} }; })
  ]).then(function(snaps) {
    var lessonMap = {};
    snaps.forEach(function(snap) {
      snap.forEach(function(doc) {
        var d = doc.data();
        if (d.lesson) lessonMap[d.lesson] = d.lessonName || '';
      });
    });

    var lessons = Object.keys(lessonMap).sort(function(a, b) {
      var na = _CN_MAP[a], nb = _CN_MAP[b];
      if (na !== undefined && nb !== undefined) return na - nb;
      var ia = parseInt(a, 10), ib = parseInt(b, 10);
      if (!isNaN(ia) && !isNaN(ib)) return ia - ib;
      return String(a).localeCompare(String(b));
    });

    var opts = '<option value="">全冊 / 跨課次</option>';
    lessons.forEach(function(l) {
      var name     = lessonMap[l] ? lessonMap[l] : '';
      var selected = l === _ecLesson ? ' selected' : '';
      opts += '<option value="' + _ecEscA(l) + '" data-name="' + _ecEscA(name) + '"' + selected + '>' +
        '第 ' + _ecEsc(l) + ' 課' + (name ? '　' + _ecEsc(name) : '') + '</option>';
    });
    if (!lessons.length) {
      opts += '<option value="" disabled style="color:var(--muted)">（此年級無題庫，可忽略）</option>';
    }
    lessonEl.innerHTML = opts;
    if (_ecLesson) lessonEl.value = _ecLesson;
  }).catch(function() {
    lessonEl.innerHTML = '<option value="">全冊 / 跨課次</option>';
  });
}

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
  var queries = [db.collection(coll).where('teacherUid', '==', currentTeacher.uid).get()];
  if (_ecSubject === 'chinese') {
    queries.push(db.collection(coll).where('teacherUid', '==', 'shared').get()
      .catch(function() { return { forEach: function() {} }; }));
  }

  Promise.all(queries).then(function(snaps) {
    _ecAllQ = [];
    snaps.forEach(function(snap) {
      snap.forEach(function(doc) { _ecAllQ.push(Object.assign({ id: doc.id }, doc.data())); });
    });
    _ecAllQSub = _ecSubject;
    if (!_ecAllQ.length) {
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

  /* 題型（語文專用） */
  if (typeEl) {
    if (_ecSubject === 'chinese') {
      var types = {};
      _ecAllQ.forEach(function(q) { if (q.type) types[q.type] = true; });
      typeEl.innerHTML = '<option value="">全部題型</option>' +
        Object.keys(types).sort(function(a, b) {
          var ia = _EC_TYPE_ORDER.indexOf(a); if (ia < 0) ia = 999;
          var ib = _EC_TYPE_ORDER.indexOf(b); if (ib < 0) ib = 999;
          return ia - ib;
        }).map(function(t) {
          return '<option value="' + _ecEscA(t) + '">' + _ecEsc(t) + '</option>';
        }).join('');
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
  var grade  = _ecGrade || ((document.getElementById('ec-filter-grade') || {}).value || '');
  var catKey = _ecSubject === 'math' ? 'category' : 'lesson';
  var pholder = _ecSubject === 'math' ? '全部類別' : '全部課次';

  var cats = {}, lessonNames = {};
  _ecAllQ.forEach(function(q) {
    if (grade && q.grade !== grade) return;
    if (q[catKey]) cats[q[catKey]] = true;
    if (_ecSubject === 'chinese' && q.lesson && q.lessonName) lessonNames[q.lesson] = q.lessonName;
  });

  catEl.innerHTML = '<option value="">' + pholder + '</option>' +
    Object.keys(cats).sort(function(a, b) {
      var na = _CN_MAP[a], nb = _CN_MAP[b];
      if (na !== undefined && nb !== undefined) return na - nb;
      return String(a).localeCompare(String(b));
    }).map(function(c) {
      var lbl = lessonNames[c] ? c + ' ' + lessonNames[c] : c;
      return '<option value="' + _ecEscA(c) + '">' + _ecEsc(lbl) + '</option>';
    }).join('');
  catEl.value = '';
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
    if (search) {
      var t = String(q.question || q.word || '').toLowerCase();
      if (t.indexOf(search) < 0) return false;
    }
    return true;
  });

  var cntEl = document.getElementById('ec-selected-count');
  if (cntEl) cntEl.textContent = Object.keys(_ecSelected).length;

  var wrap = document.getElementById('ec-q-list');
  if (!wrap) return;

  if (!filtered.length) {
    wrap.innerHTML = '<p style="color:var(--muted);font-size:.85rem;padding:12px">找不到符合條件的題目</p>';
    return;
  }

  var shown = filtered.slice(0, 150);
  wrap.innerHTML = shown.map(function(q) {
    var chk   = _ecSelected[q.id] ? ' checked' : '';
    var text  = _ecEsc(q.question || q.word || '—');
    var badge = _ecSubject === 'chinese' && q.type
      ? ' <span style="font-size:.7rem;color:var(--muted)">[' + _ecEsc(q.type) + ']</span>'
      : (_ecSubject === 'math' && q.answer
          ? ' <span style="font-size:.7rem;color:var(--muted)">答：' + _ecEsc(q.answer) + '</span>'
          : '');
    return '<label style="display:flex;align-items:flex-start;gap:10px;padding:8px 4px;cursor:pointer;border-bottom:1px solid var(--border)">' +
      '<input type="checkbox"' + chk + ' onchange="_ecToggleQ(\'' + q.id + '\',this.checked)"' +
        ' style="margin-top:3px;width:16px;height:16px;flex-shrink:0;cursor:pointer">' +
      '<span style="font-size:.85rem;line-height:1.5">' + text + badge + '</span>' +
    '</label>';
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

/* ════════════════════════════════
   大題分組邏輯
   ════════════════════════════════ */
function _ecBuildSections() {
  var groupKey = _ecSubject === 'math' ? 'category' : 'type';

  /* 建立 id → 題目 lookup */
  var qLookup = {};
  _ecAllQ.forEach(function(q) { qLookup[q.id] = q; });

  if (_ecSections.length) {
    /* 增量更新：保留現有排序，移除取消勾選的題目，加入新選的 */
    _ecSections.forEach(function(sec) {
      sec.questions = sec.questions.filter(function(q) { return !!_ecSelected[q.id]; });
    });
    _ecSections = _ecSections.filter(function(sec) { return sec.questions.length > 0; });

    var placed = {};
    _ecSections.forEach(function(sec) {
      sec.questions.forEach(function(q) { placed[q.id] = true; });
    });

    _ecAllQ.forEach(function(q) {
      if (!_ecSelected[q.id] || placed[q.id]) return;
      var key   = q[groupKey] || '其他';
      var label = q.question || q.word || '';
      var qobj  = { id: q.id, label: label, type: q.type || key,
                    answer: q.answer || q.word || '', options: q.options || null };
      var sec   = null;
      for (var i = 0; i < _ecSections.length; i++) {
        if (_ecSections[i].key === key) { sec = _ecSections[i]; break; }
      }
      if (sec) {
        sec.questions.push(qobj);
      } else {
        _ecSections.push({ title: key, key: key, collapsed: false, questions: [qobj] });
      }
    });

    _ecRenumberSections();
    return;
  }

  /* 全新建立 */
  var groups = {}, order = [];
  _ecAllQ.forEach(function(q) {
    if (!_ecSelected[q.id]) return;
    var key = q[groupKey] || '其他';
    if (!groups[key]) { groups[key] = []; order.push(key); }
    groups[key].push({ id: q.id, label: q.question || q.word || '',
                       type: q.type || key, answer: q.answer || q.word || '',
                       options: q.options || null });
  });

  /* 排序大題 */
  if (_ecSubject === 'chinese') {
    order.sort(function(a, b) {
      var ia = _EC_TYPE_ORDER.indexOf(a); if (ia < 0) ia = 999;
      var ib = _EC_TYPE_ORDER.indexOf(b); if (ib < 0) ib = 999;
      return ia - ib;
    });
  } else {
    order.sort();
  }

  _ecSections = order.map(function(key, i) {
    return {
      title:     (_EC_CN[i] || String(i + 1)) + '、' + key,
      key:       key,
      collapsed: false,
      questions: groups[key]
    };
  });
}

function _ecRenumberSections() {
  _ecSections.forEach(function(sec, i) {
    /* 更新序號（保留「、」後面的自訂文字） */
    var idx  = sec.title.indexOf('、');
    var body = idx >= 0 ? sec.title.slice(idx + 1) : sec.key;
    sec.title = (_EC_CN[i] || String(i + 1)) + '、' + body;
  });
}

/* ════════════════════════════════
   Step 3：排版（大題 + 摺疊）
   ════════════════════════════════ */
function _ecRenderLayout() {
  var wrap = document.getElementById('ec-layout-list');
  if (!wrap) return;

  var totalQ = 0;
  _ecSections.forEach(function(sec) { totalQ += (sec.questions || []).length; });
  _ecMatchSections.forEach(function(msec) { totalQ += msec.pairCount || 0; });
  var cntEl = document.getElementById('ec-layout-count');
  if (cntEl) cntEl.textContent = totalQ;

  if (!_ecSections.length && !_ecMatchSections.length) {
    wrap.innerHTML = '<p style="color:var(--muted);font-size:.85rem;padding:12px">尚未選擇任何題目</p>';
    return;
  }

  var bs = 'padding:3px 8px;border:1px solid var(--border);border-radius:6px;background:white;' +
           'cursor:pointer;font-size:.75rem;font-family:inherit';

  var textHtml = _ecSections.map(function(sec, si) {
    var qCount    = (sec.questions || []).length;
    var collapsed = !!sec.collapsed;
    var arrow     = collapsed ? '▶' : '▼';
    var radius    = collapsed ? '10px' : '10px 10px 0 0';

    var header =
      '<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;' +
      'background:var(--blue-lt,#eff6ff);border-radius:' + radius + ';' +
      'border:1.5px solid var(--blue);cursor:pointer;user-select:none" ' +
      'onclick="_ecToggleSection(' + si + ')">' +
        '<span style="font-size:.8rem;color:var(--blue);font-weight:900;min-width:14px">' + arrow + '</span>' +
        '<span style="font-size:.92rem;font-weight:900;color:var(--blue-dk,#1d4ed8);flex:1">' + _ecEsc(sec.title) + '</span>' +
        '<span style="font-size:.75rem;color:var(--muted);font-weight:700;margin-right:4px">' + qCount + ' 題</span>' +
        '<button onclick="event.stopPropagation();_ecEditSectionTitle(' + si + ')" style="' + bs + ';color:var(--blue)">改標題</button>' +
      '</div>';

    var body = '';
    if (!collapsed) {
      var rows = (sec.questions || []).map(function(q, qi) {
        return '<div style="display:flex;align-items:center;gap:8px;padding:7px 6px;' +
               (qi < qCount - 1 ? 'border-bottom:1px solid var(--border)' : '') + '">' +
          '<span style="color:var(--muted);font-size:.8rem;font-weight:700;min-width:24px">' + (qi + 1) + '</span>' +
          '<span style="font-size:.85rem;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
            _ecEsc(q.label || q.id) + '</span>' +
          '<button onclick="_ecMoveQ(' + si + ',' + qi + ',-1)" style="' + bs + ';color:var(--muted)">▲</button>' +
          '<button onclick="_ecMoveQ(' + si + ',' + qi + ',1)"  style="' + bs + ';color:var(--muted)">▼</button>' +
          '<button onclick="_ecRemoveQ(' + si + ',' + qi + ')"  style="' + bs + ';color:var(--red);border-color:#fecaca">✕</button>' +
        '</div>';
      }).join('');
      body = '<div style="border:1.5px solid var(--blue);border-top:none;border-radius:0 0 10px 10px;padding:4px 10px">' + rows + '</div>';
    }

    return '<div style="margin-bottom:10px">' + header + body + '</div>';
  }).join('');

  var matchHtml = _ecMatchSections.map(function(msec, i) {
    var secNum    = _EC_CN[_ecSections.length + i] || String(_ecSections.length + i + 1);
    var fullTitle = secNum + '、' + _ecEsc(msec.title);
    var srcDesc   = msec.source === 'curriculum'
      ? _ecEsc(msec.gradeLesson.replace('_', ' 第') + ' 課')
      : '自訂類別';
    return '<div style="margin-bottom:10px">' +
      '<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;' +
      'background:var(--orange-lt,#fff7ed);border-radius:10px;border:1.5px solid var(--orange,#f97316)">' +
        '<span style="font-size:.92rem;font-weight:900;color:var(--orange-dk,#c2410c);flex:1">🖼 ' + fullTitle + '</span>' +
        '<span style="font-size:.75rem;color:var(--muted);margin-right:4px">' +
          msec.pairCount + ' 組 · ' + srcDesc + '</span>' +
        '<button onclick="_ecEditMatchSectionTitle(' + i + ')" style="' + bs + ';color:var(--orange,#f97316)">改標題</button>' +
        '<button onclick="_ecRemoveMatchSection(' + i + ')" style="' + bs + ';color:var(--red);border-color:#fecaca">✕</button>' +
      '</div>' +
    '</div>';
  }).join('');

  wrap.innerHTML = textHtml + matchHtml;
}

function _ecToggleSection(si) {
  if (_ecSections[si]) {
    _ecSections[si].collapsed = !_ecSections[si].collapsed;
    _ecRenderLayout();
  }
}

function _ecEditSectionTitle(si) {
  var sec = _ecSections[si];
  if (!sec) return;
  var text = prompt('請輸入大題標題', sec.title || '');
  if (text === null || !text.trim()) return;
  sec.title = text.trim();
  _ecRenderLayout();
}

function _ecMoveQ(si, qi, dir) {
  var sec = _ecSections[si];
  if (!sec) return;
  var j = qi + dir;
  if (j < 0 || j >= sec.questions.length) return;
  var tmp = sec.questions[qi]; sec.questions[qi] = sec.questions[j]; sec.questions[j] = tmp;
  _ecRenderLayout();
}

function _ecRemoveQ(si, qi) {
  var sec = _ecSections[si];
  if (!sec) return;
  var q = sec.questions[qi];
  if (q) delete _ecSelected[q.id];
  sec.questions.splice(qi, 1);
  if (!sec.questions.length) {
    _ecSections.splice(si, 1);
    _ecRenumberSections();
  }
  _ecRenderLayout();
}

/* ════════════════════════════════
   Step 4：輸出
   ════════════════════════════════ */
function _ecRenderPreview() {
  var totalQ = 0;
  _ecSections.forEach(function(sec) { totalQ += (sec.questions || []).length; });
  var matchTotal = 0;
  _ecMatchSections.forEach(function(msec) { matchTotal += msec.pairCount || 0; });
  var el = document.getElementById('ec-preview-summary');
  if (!el) return;
  var metaStr = _ecSubject === 'math' ? '數學' : '語文';
  if (_ecGrade)     metaStr += ' · ' + _ecEsc(_ecGrade);
  if (_ecLesson)    metaStr += ' · 第 ' + _ecEsc(_ecLesson) + ' 課' + (_ecLessonName ? '　' + _ecEsc(_ecLessonName) : '');
  else if (_ecGrade) metaStr += ' · 全冊／跨課次';
  var totalSec = _ecSections.length + _ecMatchSections.length;
  metaStr += ' · 共 ' + totalSec + ' 大題，' + (totalQ + matchTotal) + ' 題';

  var textSecHtml = _ecSections.map(function(sec) {
    return '<span style="display:inline-block;margin-right:12px">▪ ' + _ecEsc(sec.title) +
           '（' + (sec.questions || []).length + ' 題）</span>';
  }).join('');
  var matchSecHtml = _ecMatchSections.map(function(msec, i) {
    var secNum = _EC_CN[_ecSections.length + i] || String(_ecSections.length + i + 1);
    return '<span style="display:inline-block;margin-right:12px">🖼 ' + secNum + '、' +
           _ecEsc(msec.title) + '（' + msec.pairCount + ' 組）</span>';
  }).join('');

  el.innerHTML =
    '<div style="font-size:1.08rem;font-weight:900;color:var(--text)">' + _ecEsc(_ecName) + '</div>' +
    '<div style="font-size:.82rem;color:var(--muted);margin-top:4px">' + metaStr + '</div>' +
    (totalSec ? '<div style="margin-top:8px;font-size:.8rem;color:var(--muted);line-height:1.8">' +
      textSecHtml + matchSecHtml + '</div>' : '');
}

/* ── 發布／更新線上測驗 ── */
function _ecPublishOnline() {
  var totalQ      = 0;
  var questionIds = [];
  _ecSections.forEach(function(sec) {
    (sec.questions || []).forEach(function(q) { questionIds.push(q.id); totalQ++; });
  });
  var matchTotal = 0;
  _ecMatchSections.forEach(function(msec) { matchTotal += msec.pairCount || 0; });
  if (!totalQ && !matchTotal) { showToast('試卷中尚無題目'); return; }

  var matchSectionsData = _ecMatchSections.map(function(msec) {
    return {
      title: msec.title, source: msec.source,
      gradeLesson: msec.gradeLesson || '', categoryId: msec.categoryId || '',
      pairCount: msec.pairCount, wordIds: msec.wordIds || [], words: msec.words || []
    };
  });

  var isUpdate = !!_ecSessionId;
  var confirmMsg = isUpdate
    ? '確定要儲存對「' + _ecName + '」的修改？'
    : '確定要將「' + _ecName + '」發布為線上測驗？';
  if (!confirm(confirmMsg)) return;

  var btn = document.getElementById('ec-btn-publish');
  if (btn) { btn.disabled = true; btn.textContent = isUpdate ? '儲存中…' : '建立中…'; }

  var coll = _ecSubject === 'math' ? 'mathQuizSessions' : 'quizSessions';

  var p;
  var lessonFields = { version: _ecVersion, volume: _ecVolume, lesson: _ecLesson, lessonName: _ecLessonName };

  if (isUpdate) {
    /* 更新既有測驗，保留 code / active / createdAt */
    var updateData = Object.assign(
      { name: _ecName, grade: _ecGrade, questionIds: questionIds,
        matchSections: matchSectionsData, updatedAt: new Date().toISOString() },
      lessonFields
    );
    if (_ecSubject === 'math') updateData.totalQuestions = totalQ;
    else                       updateData.counts = { total: totalQ, match: matchTotal };
    p = db.collection(coll).doc(_ecSessionId).update(updateData)
          .then(function() { return { id: _ecSessionId, isUpdate: true }; });
  } else {
    var code    = _ecGenCode();
    var newData = _ecSubject === 'math'
      ? Object.assign({ teacherUid: currentTeacher.uid, quizType: 'exam', name: _ecName, code: code,
          grade: _ecGrade, questionIds: questionIds, totalQuestions: totalQ,
          active: true, createdAt: new Date().toISOString() }, lessonFields)
      : Object.assign({ type: 'exam', name: _ecName, code: code, teacherUid: currentTeacher.uid,
          grade: _ecGrade, questionIds: questionIds, matchSections: matchSectionsData,
          counts: { total: totalQ, match: matchTotal },
          active: true, createdAt: new Date().toISOString() }, lessonFields);
    p = db.collection(coll).add(newData)
          .then(function(ref) { return { id: ref.id, code: code, isUpdate: false }; });
  }

  p.then(function(result) {
    if (btn) { btn.disabled = false; btn.textContent = '📤 發布為線上測驗'; }
    _ecSessionId = null;
    if (result.isUpdate) {
      showToast('✅ 測驗已更新');
      _ecShowList();
    } else {
      showToast('✅ 線上測驗已建立！代碼：' + result.code);
      _ecShowList();
      if (typeof showQuizShareModal === 'function' && _ecSubject !== 'math') {
        setTimeout(function() { showQuizShareModal(result.id, _ecName); }, 400);
      }
    }
  }).catch(function(e) {
    showToast('失敗：' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = '📤 發布為線上測驗'; }
  });
}

/* ── 列印（從精靈 Step 4，先預覽再列印）── */
function _ecPrint() {
  if (!_ecSections.length && !_ecMatchSections.length) { showToast('試卷內容為空'); return; }
  _ecDoPrint(_ecName, _ecSections, _ecSubject, _ecMatchSections);
}

/* 列印入口：若有配對大題則先非同步抓圖片 URL，再開印刷視窗 */
function _ecDoPrint(name, sections, subject, matchSections) {
  matchSections = matchSections || [];
  var allWordIds = [];
  matchSections.forEach(function(ms) {
    (ms.wordIds || []).forEach(function(id) { allWordIds.push(id); });
  });

  if (allWordIds.length && db) {
    Promise.all(allWordIds.map(function(wid) {
      return db.collection('wordImages').doc(wid).get();
    })).then(function(wdocs) {
      var imgMap = {};
      wdocs.forEach(function(wd) { if (wd.exists) imgMap[wd.id] = wd.data().imageUrl || ''; });
      _ecOpenPrintWindow(name, sections, subject, matchSections, imgMap);
    }).catch(function() {
      _ecOpenPrintWindow(name, sections, subject, matchSections, {});
    });
  } else {
    _ecOpenPrintWindow(name, sections, subject, matchSections, {});
  }
}

function _ecOpenPrintWindow(name, sections, subject, matchSections, imgMap) {
  var win = window.open('', '_blank');
  if (!win) { showToast('請允許瀏覽器彈出視窗後再試'); return; }
  win.document.write(_ecBuildPrintHtml(name, sections, subject, matchSections, imgMap));
  win.document.close();
}

/* 產生完整列印 HTML */
function _ecBuildPrintHtml(name, sections, subject, matchSections, imgMap) {
  var CN = ['一','二','三','四','五','六','七','八','九','十'];
  var DRAG_TYPES = ['詞語填空', '詞語解釋'];

  /* ─── 大題 HTML ─── */
  var body = '';
  var sn   = 0;

  sections.forEach(function(sec) {
    var key    = sec.key || '';
    var isDrag = DRAG_TYPES.indexOf(key) >= 0;
    var isMC   = key === '選擇題';
    var qs     = sec.questions || [];

    body += '<div class="sec-block">';
    body += '<div class="sec-header">' + _ecEsc(sec.title || '') + '</div>';

    /* 答案池（拖曳型大題） */
    if (isDrag && qs.length) {
      var poolWords = qs.map(function(q) {
        return q.answer || _ecExtractFillAnswer(q.label);
      }).filter(Boolean);
      /* Fisher-Yates shuffle */
      for (var pi = poolWords.length - 1; pi > 0; pi--) {
        var pj = Math.floor(Math.random() * (pi + 1));
        var pt = poolWords[pi]; poolWords[pi] = poolWords[pj]; poolWords[pj] = pt;
      }
      body += '<div class="pool-box">';
      body += '<span class="pool-label">答案池</span>';
      poolWords.forEach(function(w) {
        body += '<span class="pool-chip">' + _ecEsc(w) + '</span>';
      });
      body += '</div>';
    }

    /* 題目列表 */
    body += '<ol class="q-list">';
    qs.forEach(function(q, j) {
      body += '<li class="q-item"><span class="q-num">' + (j + 1) + '.</span><span class="q-body">';

      if (key === '詞語解釋') {
        var ans    = q.answer || '';
        var blankW = Math.max(ans.length * 1.6, 3).toFixed(1) + 'em';
        body += _ecEsc(q.label) +
                '<span class="q-uline" style="width:' + blankW + '"></span>';

      } else if (key === '詞語填空') {
        body += _ecRenderFillBlank(q.label);

      } else if (isMC) {
        body += '<span class="q-text">' + _ecEsc(q.label) + '</span>';
        body += '<div class="mc-opts">';
        (q.options || []).forEach(function(opt) {
          body += '<div class="mc-opt">○ ' + _ecEsc(opt) + '</div>';
        });
        body += '</div>';

      } else if (subject === 'math') {
        body += _ecEsc(q.label) + '<span class="q-uline" style="width:5em"></span>＝<span class="q-uline" style="width:5em"></span>';

      } else {
        body += _ecEsc(q.label);
      }

      body += '</span></li>';
    });
    body += '</ol></div>';
    sn++;
  });

  /* ─── 配對大題 ─── */
  matchSections.forEach(function(ms) {
    var secTitle = (CN[sn] || String(sn + 1)) + '、' + (ms.title || '連連看');
    var wids   = ms.wordIds || [];
    var wwords = ms.words   || [];

    /* 左欄（圖片，保持原序）；右欄（詞語，隨機排列） */
    var rightWords = wwords.slice();
    for (var ri = rightWords.length - 1; ri > 0; ri--) {
      var rj = Math.floor(Math.random() * (ri + 1));
      var rt = rightWords[ri]; rightWords[ri] = rightWords[rj]; rightWords[rj] = rt;
    }

    body += '<div class="sec-block">';
    body += '<div class="sec-header">' + _ecEsc(secTitle) + '</div>';
    body += '<p class="match-hint">請以直線連接左方圖片與右方對應詞語</p>';
    body += '<div class="match-wrap">';

    /* 左欄 */
    body += '<div class="match-col match-col-l">';
    wids.forEach(function(wid, i) {
      var imgSrc = imgMap[wid] || '';
      body += '<div class="match-item">';
      if (imgSrc) body += '<img class="match-img" src="' + _ecEscA(imgSrc) + '" alt="">';
      else        body += '<div class="match-img match-img-empty">' + _ecEsc(wwords[i] || '') + '</div>';
      body += '<span class="match-ep match-ep-r">●</span>';
      body += '</div>';
    });
    body += '</div>';

    /* 中間空白連線區 */
    body += '<div class="match-col match-col-mid"></div>';

    /* 右欄 */
    body += '<div class="match-col match-col-r">';
    rightWords.forEach(function(w) {
      body += '<div class="match-item">';
      body += '<span class="match-ep match-ep-l">●</span>';
      body += '<span class="match-word">' + _ecEsc(w) + '</span>';
      body += '</div>';
    });
    body += '</div>';

    body += '</div></div>';
    sn++;
  });

  /* ─── CSS ─── */
  var _fontUrl = window.location.origin + '/assets/font/BPMFZIHIKAISTD-REGULAR.TTF';
  var css = [
    '@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&display=swap");',
    '@font-face{font-family:"BpmfZihiKai";src:url("' + _fontUrl + '") format("truetype")}',
    '*{box-sizing:border-box}',
    'body{font-family:"BpmfZihiKai",serif;color:#1a1a2e;background:#fff;',
         'margin:0;padding:18mm 20mm;font-size:12pt;line-height:2.8}',
    'html.hide-ruby body{font-family:"Noto Sans TC",sans-serif;line-height:1.9}',
    '.sheet-title{font-size:17pt;font-weight:900;text-align:center;letter-spacing:.3em;margin-bottom:4px}',
    '.sheet-lesson{font-size:11pt;text-align:center;color:#3d3d5c;margin-bottom:14px}',
    '.sheet-meta{display:flex;gap:2.5em;font-size:11pt;padding-bottom:10px;',
                'border-bottom:2px solid #1a1a2e;margin-bottom:22px;flex-wrap:wrap}',
    '.sheet-meta-item{display:inline-flex;gap:.4em;align-items:baseline}',
    '.sheet-meta-line{display:inline-block;border-bottom:1.5px solid #1a1a2e;min-width:7em}',
    '.sec-block{margin-bottom:18px}',
    '.sec-header{border-left:4px solid #1a1a2e;padding:2px 0 2px 10px;',
                'font-size:13pt;font-weight:900;margin-bottom:10px}',
    /* 答案池 */
    '.pool-box{border:1.5px dashed #d4cfc0;border-radius:8px;',
              'padding:8px 12px;margin-bottom:12px;',
              'display:flex;flex-wrap:wrap;gap:6px;align-items:center;background:#ede8e0}',
    '.pool-label{font-size:9pt;font-weight:700;color:#3d3d5c;margin-right:4px;flex-shrink:0}',
    '.pool-chip{font-size:11pt;font-weight:700;border:1.5px solid #d4cfc0;',
               'border-radius:6px;padding:2px 10px;background:#fff}',
    /* 題目列表 */
    '.q-list{list-style:none;padding:0;margin:0}',
    '.q-item{display:flex;gap:6px;align-items:baseline;padding:6px 0;',
             'border-bottom:1px solid #ede8e0;flex-wrap:wrap}',
    '.q-num{font-weight:700;flex-shrink:0;min-width:1.8em}',
    '.q-body{flex:1;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px;line-height:2}',
    '.q-text{width:100%}',
    /* 底線空格 */
    '.q-uline{display:inline-block;border-bottom:1.5px solid #1a1a2e;',
              'min-width:3em;height:1.3em;vertical-align:baseline;margin:0 2px}',
    /* 選擇題 */
    '.mc-opts{width:100%;padding-left:.5em;margin-top:2px}',
    '.mc-opt{line-height:1.9}',
    /* 配對題 */
    '.match-hint{font-size:10pt;color:#3d3d5c;margin:0 0 12px}',
    '.match-wrap{display:flex;align-items:flex-start;gap:0}',
    '.match-col{display:flex;flex-direction:column}',
    '.match-col-l{gap:8px;align-items:flex-end}',
    '.match-col-mid{flex:1;min-width:40px}',
    '.match-col-r{gap:8px;align-items:flex-start}',
    '.match-item{display:flex;align-items:center;gap:6px;height:104px}',
    '.match-img{width:93px;height:93px;object-fit:cover;border-radius:6px;border:1px solid #d4cfc0}',
    '.match-img-empty{width:93px;height:93px;display:flex;align-items:center;justify-content:center;',
                      'font-size:11pt;font-weight:700;border:1px solid #d4cfc0;border-radius:6px}',
    '.match-ep{font-size:8pt;color:#aaa;line-height:1}',
    '.match-ep-r{margin-left:4px}',
    '.match-ep-l{margin-right:4px}',
    '.match-word{font-size:12pt;font-weight:700}',
    /* 列印按鈕列 */
    '.print-bar{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:28px}',
    '.print-btn{padding:9px 24px;font-size:11pt;cursor:pointer;font-weight:700;',
                'font-family:inherit;border:1.5px solid #1a1a2e;border-radius:8px;background:#fff}',
    '.print-sz-label{font-size:11pt;display:flex;align-items:center;gap:4px;font-family:inherit}',
    '.print-sz-input{width:3.8em;font-size:11pt;text-align:center;font-family:inherit;',
                    'border:1.5px solid #1a1a2e;border-radius:6px;padding:6px 4px}',
    '@media print{',
      '@page{size:A4 portrait;margin:15mm}',
      'body{padding:0}',
      '.print-bar{display:none}',
      '.sec-block{break-inside:avoid}',
    '}'
  ].join('');

  /* ─── 頁首 ─── */
  var header =
    '<div class="sheet-title">' + _ecEsc(name) + '</div>' +
    '<div class="sheet-meta">' +
      '<span class="sheet-meta-item">班級：<span class="sheet-meta-line"></span></span>' +
      '<span class="sheet-meta-item">姓名：<span class="sheet-meta-line"></span></span>' +
      '<span class="sheet-meta-item">得分：<span class="sheet-meta-line" style="min-width:4em"></span></span>' +
    '</div>';

  var toggleJs = [
    '<script>',
    'function _toggleRuby(btn){',
    '  var on=document.documentElement.classList.toggle("hide-ruby");',
    '  btn.textContent=on?"📖 顯示注音":"📖 隱藏注音";',
    '}',
    'function _setFontSize(v){',
    '  var pt=Math.min(Math.max(parseInt(v)||12,8),36);',
    '  document.body.style.fontSize=pt+"pt";',
    '}',
    '<\/script>'
  ].join('');

  return '<!doctype html><html lang="zh-TW"><head>' +
    '<meta charset="utf-8">' +
    '<title>' + _ecEsc(name) + '</title>' +
    '<style>' + css + '</style>' +
    '</head><body>' +
    header + body +
    '<div class="print-bar">' +
      '<label class="print-sz-label">字體大小' +
        '<input id="sz-input" class="print-sz-input" type="number" value="12" min="8" max="36"' +
               ' oninput="_setFontSize(this.value)">pt' +
      '</label>' +
      '<button class="print-btn" onclick="_toggleRuby(this)">📖 隱藏注音</button>' +
      '<button class="print-btn" onclick="window.print()">🖨 列印</button>' +
    '</div>' +
    toggleJs +
    '</body></html>';
}

/* 將 詞語填空 題目的（答案）替換成底線空格 */
function _ecRenderFillBlank(label) {
  var m      = label.match(/[（(]([^）)]+)[）)]/);
  var ans    = m ? m[1].trim() : '';
  var blankW = ans ? Math.max(ans.length * 1.6, 3).toFixed(1) + 'em' : '4em';
  var blank  = '<span class="q-uline" style="width:' + blankW + '"></span>';
  var parts  = label.split(/[（(][^）)]*[）)]/);
  return parts.map(function(p) { return _ecEsc(p); }).join(blank);
}

/* 同上，但各段文字用 _zhToRuby 標注音 */
function _ecRenderFillBlankRuby(label) {
  var m      = label.match(/[（(]([^）)]+)[）)]/);
  var ans    = m ? m[1].trim() : '';
  var blankW = ans ? Math.max(ans.length * 1.6, 3).toFixed(1) + 'em' : '4em';
  var blank  = '<span class="q-uline" style="width:' + blankW + '"></span>';
  var parts  = label.split(/[（(][^）)]*[）)]/);
  return parts.map(function(p) { return _zhToRuby(p); }).join(blank);
}

/* 從 詞語填空 題目文字中提取括號內的答案 */
function _ecExtractFillAnswer(label) {
  var m = (label || '').match(/[（(]([^）)]+)[）)]/);
  return m ? m[1].trim() : '';
}

/* ════════════════════════════════
   工具
   ════════════════════════════════ */
function _ecEsc(s)  { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function _ecEscA(s) { return String(s).replace(/"/g,'&quot;'); }

/* 將字串轉成帶 <ruby> 標記的 HTML（逐字查注音字典）*/
function _zhToRuby(s) {
  var dict = window._zhDict;
  return String(s).split('').map(function(ch) {
    var zy = dict && dict[ch];
    if (zy) return '<ruby>' + _ecEsc(ch) + '<rt>' + zy + '</rt></ruby>';
    return _ecEsc(ch);
  }).join('');
}
/* 產生 6 位隨機碼（不含易混淆字元） */
function _ecGenCode() {
  var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = '';
  for (var i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)];
  return r;
}

function _ecBtn(color) {
  return 'flex-shrink:0;padding:5px 12px;border-radius:8px;background:white;font-size:.78rem;font-weight:800;cursor:pointer;font-family:inherit;' +
    (color === 'red'  ? 'border:1.5px solid #fecaca;color:var(--red)'
    : color === 'blue' ? 'border:1.5px solid var(--blue);color:var(--blue)'
    :                    'border:1.5px solid var(--border);color:var(--text)');
}

/* ════════════════════════════════
   詞圖配對 modal
   ════════════════════════════════ */
function _ecOpenMatchModal() {
  var modal  = document.getElementById('ec-match-modal');
  if (!modal) return;
  var listEl = document.getElementById('ec-match-word-list');
  if (listEl) listEl.innerHTML = '<span style="color:var(--muted)">請先選擇來源</span>';
  var pubSel    = document.getElementById('ec-match-publisher');
  var lessonSel = document.getElementById('ec-match-lesson');
  if (pubSel)    pubSel.value    = '';
  if (lessonSel) lessonSel.innerHTML = '<option value="">課次</option>';
  var radCurr = document.querySelector('input[name="ec-match-source"][value="curriculum"]');
  if (radCurr) { radCurr.checked = true; _ecMatchSourceChange('curriculum'); }
  _ecMatchLoadCustomCategories();
  modal.style.display = 'flex';
}

function _ecCloseMatchModal() {
  var modal = document.getElementById('ec-match-modal');
  if (modal) modal.style.display = 'none';
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
