/**
 * admin/exam-compose.js — 試卷編製精靈
 * 步驟：基本資料 → 選題 → 排版（大題分組）→ 輸出
 * 依賴：shared.js（db、showToast）、init.js（currentTeacher）
 */
'use strict';

/* ─── 狀態 ─── */
var _ecDraftId  = null;
var _ecStep     = 1;
var _ecName     = '';
var _ecSubject  = 'chinese';
var _ecGrade    = '';
var _ecSections = [];  // [{ title, key, collapsed, questions:[{id,label}] }]
var _ecAllQ     = [];  // 從 Firestore 讀入（含 id）
var _ecSelected = {};  // { docId: true }

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
   進入點
   ════════════════════════════════ */
function loadExamComposeTab() {
  if (!db || !currentTeacher) { setTimeout(loadExamComposeTab, 300); return; }
  _ecShowList();
}

/* ════════════════════════════════
   列表 View
   ════════════════════════════════ */
function _ecShowList() {
  _ecToggleView('list');
  _ecLoadDrafts();
}

function _ecToggleView(view) {
  var lv = document.getElementById('ec-list-view');
  var wv = document.getElementById('ec-wizard-view');
  if (lv) lv.style.display = view === 'list'   ? '' : 'none';
  if (wv) wv.style.display = view === 'wizard' ? '' : 'none';
}

function _ecLoadDrafts() {
  var wrap = document.getElementById('ec-drafts-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  db.collection('examDrafts')
    .where('teacherUid', '==', currentTeacher.uid)
    .get()
    .then(function(snap) {
      var drafts = [];
      snap.forEach(function(doc) { drafts.push({ id: doc.id, d: doc.data() }); });
      drafts.sort(function(a, b) {
        var ta = a.d.updatedAt || a.d.createdAt || '';
        var tb = b.d.updatedAt || b.d.createdAt || '';
        return tb > ta ? 1 : -1;
      });

      if (!drafts.length) {
        wrap.innerHTML = '<p style="color:var(--muted);font-size:.88rem;padding:8px 0">尚未建立任何試卷。點擊「＋ 新增試卷」開始。</p>';
        return;
      }

      wrap.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px">' +
        drafts.map(function(x) {
          var d   = x.d;
          var cnt = 0;
          (d.sections || []).forEach(function(s) { cnt += (s.questions || []).length; });
          if (!cnt && d.items) cnt = (d.items || []).filter(function(it) { return it.type === 'question'; }).length;
          var sub = d.subject === 'math' ? '數學' : '語文';
          var dt  = (d.updatedAt || d.createdAt || '').slice(0, 10);
          return '<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;' +
                 'border:1.5px solid var(--border);border-radius:12px;background:white">' +
            '<div style="flex:1;min-width:0">' +
              '<div style="font-weight:900;font-size:.95rem;color:var(--text);' +
              'white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + _ecEsc(d.name || '未命名試卷') + '</div>' +
              '<div style="font-size:.75rem;color:var(--muted);margin-top:3px">' +
                sub + (d.grade ? ' · ' + _ecEsc(d.grade) : '') + ' · ' + cnt + ' 題' + (dt ? ' · ' + dt : '') +
              '</div>' +
            '</div>' +
            '<button onclick="_ecEditDraft(\'' + x.id + '\')" style="' + _ecBtn('blue') + '">編輯</button>' +
            '<button onclick="_ecPrintDraft(\'' + x.id + '\')" style="' + _ecBtn('') + '">列印</button>' +
            '<button onclick="_ecDeleteDraft(\'' + x.id + '\')" style="' + _ecBtn('red') + '">刪除</button>' +
          '</div>';
        }).join('') +
      '</div>';
    })
    .catch(function(e) {
      wrap.innerHTML = '<p style="color:var(--red);font-size:.88rem">載入失敗：' + e.message + '</p>';
    });
}

function _ecDeleteDraft(id) {
  if (!confirm('確定要刪除這份試卷草稿嗎？')) return;
  db.collection('examDrafts').doc(id).delete()
    .then(function() { showToast('已刪除試卷草稿'); _ecLoadDrafts(); })
    .catch(function(e) { showToast('刪除失敗：' + e.message); });
}

function _ecEditDraft(id) {
  db.collection('examDrafts').doc(id).get().then(function(doc) {
    if (!doc.exists) { showToast('找不到此試卷'); return; }
    var d      = doc.data();
    _ecDraftId = id;
    _ecName    = d.name    || '';
    _ecSubject = d.subject || 'chinese';
    _ecGrade   = d.grade   || '';

    /* 載入大題結構（相容舊格式 items） */
    if (d.sections && d.sections.length) {
      _ecSections = d.sections.map(function(s) {
        return { title: s.title || s.key || '', key: s.key || '', collapsed: false,
                 questions: (s.questions || []).slice() };
      });
    } else if (d.items) {
      var qs = (d.items || []).filter(function(it) { return it.type === 'question'; });
      _ecSections = qs.length ? [{ title: '題目', key: '', collapsed: false, questions: qs }] : [];
    } else {
      _ecSections = [];
    }

    _ecSelected = {};
    _ecSections.forEach(function(sec) {
      (sec.questions || []).forEach(function(q) { _ecSelected[q.id] = true; });
    });
    _ecAllQ = [];
    _ecOpenWizard(1);
  }).catch(function(e) { showToast('載入失敗：' + e.message); });
}

/* ════════════════════════════════
   精靈 Wizard
   ════════════════════════════════ */
function _ecNewDraft() {
  _ecDraftId  = null;
  _ecName     = '';
  _ecSubject  = 'chinese';
  _ecGrade    = '';
  _ecSections = [];
  _ecSelected = {};
  _ecAllQ     = [];
  _ecOpenWizard(1);
}

function _ecOpenWizard(step) {
  _ecToggleView('wizard');
  _ecStep = step;
  _ecSyncStep1Form();
  _ecUpdateStepBar();
  [1, 2, 3, 4].forEach(function(i) {
    var el = document.getElementById('ec-panel-' + i);
    if (el) el.style.display = i === step ? '' : 'none';
  });
  if (step === 2) _ecLoadQuestions();
  if (step === 3) _ecRenderLayout();
  if (step === 4) _ecRenderPreview();
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
  var n = document.getElementById('ec-name');
  var s = document.getElementById('ec-subject');
  var g = document.getElementById('ec-grade');
  if (n) n.value = _ecName;
  if (s) s.value = _ecSubject;
  if (g) g.value = _ecGrade;
}

function _ecGoStep(n) {
  if (n > _ecStep) {
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

/* ── Step 1 驗證 ── */
function _ecValidateStep1() {
  _ecName    = ((document.getElementById('ec-name')    || {}).value || '').trim();
  _ecSubject = ((document.getElementById('ec-subject') || {}).value || 'chinese');
  _ecGrade   = ((document.getElementById('ec-grade')   || {}).value || '').trim();
  var err = document.getElementById('ec-step1-err');
  if (!_ecName) { if (err) err.textContent = '請輸入試卷名稱'; return false; }
  if (err) err.textContent = '';
  return true;
}

/* ════════════════════════════════
   Step 2：選題
   ════════════════════════════════ */
function _ecLoadQuestions() {
  var wrap = document.getElementById('ec-q-list');
  if (!wrap) return;

  if (_ecAllQ.length && _ecAllQ._sub === _ecSubject) {
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
    _ecAllQ._sub = _ecSubject;
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
  var gradeEl = document.getElementById('ec-filter-grade');
  var typeEl  = document.getElementById('ec-filter-type');

  /* 年級 */
  var grades = {};
  _ecAllQ.forEach(function(q) { if (q.grade) grades[q.grade] = true; });
  if (gradeEl) {
    gradeEl.innerHTML = '<option value="">全部年級</option>' +
      Object.keys(grades).sort(function(a, b) {
        return (_CN_MAP[a] || 999) - (_CN_MAP[b] || 999);
      }).map(function(g) {
        return '<option value="' + _ecEscA(g) + '"' + (g === _ecGrade ? ' selected' : '') + '>' + _ecEsc(g) + '</option>';
      }).join('');
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
  var grade  = ((document.getElementById('ec-filter-grade') || {}).value || '');
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
  var grade  = ((document.getElementById('ec-filter-grade')  || {}).value || '');
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

function _ecValidateStep2() {
  var cnt = Object.keys(_ecSelected).length;
  var err = document.getElementById('ec-step2-err');
  if (!cnt) { if (err) err.textContent = '請至少選擇一道題目'; return false; }
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
      var sec   = null;
      for (var i = 0; i < _ecSections.length; i++) {
        if (_ecSections[i].key === key) { sec = _ecSections[i]; break; }
      }
      if (sec) {
        sec.questions.push({ id: q.id, label: label });
      } else {
        _ecSections.push({ title: key, key: key, collapsed: false, questions: [{ id: q.id, label: label }] });
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
    groups[key].push({ id: q.id, label: q.question || q.word || '' });
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
  var cntEl = document.getElementById('ec-layout-count');
  if (cntEl) cntEl.textContent = totalQ;

  if (!_ecSections.length) {
    wrap.innerHTML = '<p style="color:var(--muted);font-size:.85rem;padding:12px">尚未選擇任何題目</p>';
    return;
  }

  var bs = 'padding:3px 8px;border:1px solid var(--border);border-radius:6px;background:white;' +
           'cursor:pointer;font-size:.75rem;font-family:inherit';

  /* 累計題號（跨大題連續編號） */
  var globalNum = 0;

  wrap.innerHTML = _ecSections.map(function(sec, si) {
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
        globalNum++;
        return '<div style="display:flex;align-items:center;gap:8px;padding:7px 6px;' +
               (qi < qCount - 1 ? 'border-bottom:1px solid var(--border)' : '') + '">' +
          '<span style="color:var(--muted);font-size:.8rem;font-weight:700;min-width:24px">' + globalNum + '</span>' +
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
  var el = document.getElementById('ec-preview-summary');
  if (!el) return;
  el.innerHTML =
    '<div style="font-size:1.08rem;font-weight:900;color:var(--text)">' + _ecEsc(_ecName) + '</div>' +
    '<div style="font-size:.82rem;color:var(--muted);margin-top:4px">' +
      (_ecSubject === 'math' ? '數學' : '語文') +
      (_ecGrade ? ' · ' + _ecEsc(_ecGrade) : '') +
      ' · 共 ' + _ecSections.length + ' 大題，' + totalQ + ' 題' +
    '</div>' +
    (_ecSections.length ? '<div style="margin-top:8px;font-size:.8rem;color:var(--muted);line-height:1.8">' +
      _ecSections.map(function(sec) {
        return '<span style="display:inline-block;margin-right:12px">▪ ' + _ecEsc(sec.title) +
               '（' + (sec.questions || []).length + ' 題）</span>';
      }).join('') + '</div>' : '');
}

/* ── 儲存草稿 ── */
function _ecSaveDraft() {
  if (!_ecName) { showToast('請先填寫試卷名稱（步驟一）'); return; }
  var btn = document.getElementById('ec-btn-save');
  if (btn) { btn.disabled = true; btn.textContent = '儲存中…'; }

  var now     = new Date().toISOString();
  var docData = {
    teacherUid: currentTeacher.uid,
    name:       _ecName,
    subject:    _ecSubject,
    grade:      _ecGrade,
    sections:   _ecSections.map(function(sec) {
      return {
        title:     sec.title,
        key:       sec.key,
        questions: (sec.questions || []).map(function(q) { return { id: q.id, label: q.label || '' }; })
      };
    }),
    updatedAt: now
  };

  var p = _ecDraftId
    ? db.collection('examDrafts').doc(_ecDraftId).set(docData, { merge: true })
    : db.collection('examDrafts')
        .add(Object.assign({ createdAt: now }, docData))
        .then(function(ref) { _ecDraftId = ref.id; });

  p.then(function() {
    showToast('✅ 草稿已儲存');
    if (btn) { btn.disabled = false; btn.textContent = '💾 儲存草稿'; }
  }).catch(function(e) {
    showToast('儲存失敗：' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = '💾 儲存草稿'; }
  });
}

/* ── 發布為線上測驗 ── */
function _ecPublishOnline() {
  var totalQ = 0;
  var questionIds = [];
  _ecSections.forEach(function(sec) {
    (sec.questions || []).forEach(function(q) { questionIds.push(q.id); totalQ++; });
  });
  if (!totalQ) { showToast('試卷中尚無題目'); return; }
  if (!confirm('確定要將「' + _ecName + '」發布為線上測驗？\n發布後可從「線上測驗」頁籤管理、派發班級。')) return;

  var btn = document.getElementById('ec-btn-publish');
  if (btn) { btn.disabled = true; btn.textContent = '建立中…'; }

  var code = _ecGenCode();
  var coll = _ecSubject === 'math' ? 'mathQuizSessions' : 'quizSessions';
  var docData = _ecSubject === 'math'
    ? { teacherUid: currentTeacher.uid, quizType: 'exam', name: _ecName, code: code,
        grade: _ecGrade, questionIds: questionIds, totalQuestions: totalQ,
        active: true, createdAt: new Date().toISOString() }
    : { type: 'exam', name: _ecName, code: code, teacherUid: currentTeacher.uid,
        grade: _ecGrade, questionIds: questionIds,
        counts: { total: totalQ }, active: true, createdAt: new Date().toISOString() };

  db.collection(coll).add(docData)
    .then(function(ref) {
      showToast('✅ 線上測驗已建立！代碼：' + code);
      if (btn) { btn.disabled = false; btn.textContent = '📤 發布為線上測驗'; }
      /* 發布後立即開啟分享至班級視窗 */
      if (typeof showQuizShareModal === 'function' && _ecSubject !== 'math') {
        setTimeout(function() { showQuizShareModal(ref.id, _ecName); }, 400);
      } else if (typeof _mqOpenShareModal === 'function' && _ecSubject === 'math') {
        loadMathQuizSessions();
      } else {
        loadQuizSessions();
      }
    })
    .catch(function(e) {
      showToast('發布失敗：' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = '📤 發布為線上測驗'; }
    });
}

/* ── 列印（從精靈 Step 4）── */
function _ecPrint() {
  if (!_ecSections.length) { showToast('試卷內容為空'); return; }
  _ecDoPrint(_ecName, _ecSections, _ecSubject);
}

/* ── 列印草稿（從列表）── */
function _ecPrintDraft(id) {
  db.collection('examDrafts').doc(id).get().then(function(doc) {
    if (!doc.exists) { showToast('找不到此試卷'); return; }
    var d = doc.data();

    var sections;
    if (d.sections && d.sections.length) {
      sections = d.sections;
    } else if (d.items) {
      var qs = (d.items || []).filter(function(it) { return it.type === 'question'; });
      sections = qs.length ? [{ title: '題目', questions: qs }] : [];
    } else {
      showToast('試卷中無題目'); return;
    }

    /* 若 label 存在就直接列印 */
    var hasLabels = sections.every(function(sec) {
      return (sec.questions || []).every(function(q) { return !!q.label; });
    });
    if (hasLabels) { _ecDoPrint(d.name || '試卷', sections, d.subject || 'chinese'); return; }

    /* 補抓題目文字 */
    var coll = d.subject === 'math' ? 'mathQuestions' : 'questions';
    var qMap  = {};
    var qIds  = [];
    sections.forEach(function(sec) { (sec.questions || []).forEach(function(q) { qIds.push(q.id); }); });
    Promise.all(qIds.map(function(qId) {
      return db.collection(coll).doc(qId).get().then(function(qdoc) { if (qdoc.exists) qMap[qId] = qdoc.data(); });
    })).then(function() {
      var rich = sections.map(function(sec) {
        return Object.assign({}, sec, {
          questions: (sec.questions || []).map(function(q) {
            var qd = qMap[q.id] || {};
            return Object.assign({}, q, { label: qd.question || qd.word || q.label || q.id });
          })
        });
      });
      _ecDoPrint(d.name || '試卷', rich, d.subject || 'chinese');
    });
  }).catch(function(e) { showToast('載入失敗：' + e.message); });
}

function _ecDoPrint(name, sections, subject) {
  var win = window.open('', '_blank');
  if (!win) { showToast('請允許瀏覽器彈出視窗後再試'); return; }

  var qNum  = 0;
  var lines = sections.map(function(sec) {
    var secLines = [
      '<h3 style="margin:20px 0 6px;font-size:13pt;border-left:3px solid #333;padding-left:8px">' +
        _ecEsc(sec.title || '') + '</h3>'
    ];
    (sec.questions || []).forEach(function(q) {
      qNum++;
      var text = subject === 'math'
        ? _ecEsc(q.label || q.id) + '　＝　__________'
        : _ecEsc(q.label || q.id);
      secLines.push('<p style="margin:7px 0;font-size:12pt">' + qNum + '．' + text + '</p>');
    });
    return secLines.join('');
  }).join('');

  win.document.write(
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<title>' + _ecEsc(name) + '</title>' +
    '<style>' +
      'body{font-family:"Noto Sans TC",sans-serif;margin:40px;line-height:2.2}' +
      'h1{font-size:17pt;margin-bottom:4px}' +
      'h3{border-left:3px solid #333;padding-left:8px;font-size:13pt;margin:20px 0 6px}' +
      '@media print{body{margin:15mm}button{display:none}}' +
    '</style></head><body>' +
    '<h1>' + _ecEsc(name) + '</h1>' +
    '<p style="font-size:10pt;color:#555;border-bottom:1px solid #ccc;padding-bottom:8px;margin-bottom:16px">' +
      '班級：__________________　姓名：__________________　得分：__________</p>' +
    lines +
    '<p style="margin-top:30px;text-align:center">' +
      '<button onclick="window.print()" style="padding:8px 24px;font-size:11pt;cursor:pointer">🖨 列印</button>' +
    '</p></body></html>'
  );
  win.document.close();
}

/* ════════════════════════════════
   工具
   ════════════════════════════════ */
function _ecEsc(s)  { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function _ecEscA(s) { return String(s).replace(/"/g,'&quot;'); }

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
