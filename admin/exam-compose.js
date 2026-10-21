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
var _ecAllLessonTexts = [];    // 課文編輯的課文（lessonTexts），語文科才會查；課次下拉/句子重組選句子用
var _ecSelected   = {};        // { docId: true }
var _ecMatchSections = [];   // [{title,source,gradeLesson,categoryId,pairCount,wordIds:[],words:[]}]

/* 一般題目（詞語解釋／詞語填空／選擇題／數學）編輯 modal 狀態 */
var _qeDocId      = null;
var _qeOptions    = [];        // 選擇題專用：選項文字陣列
var _qeCorrectIdx = 0;         // 選擇題專用：目前標記為正確答案的選項 index

/* 默寫生字 modal 狀態——生字來源是「練字趣」的 curriculum collection（版本/冊次/課次→chars），
   跟 questions/lessonTexts 是完全不同的資料體系，查過的課快取起來，篩選/搜尋時重畫列表不用每次重查 */
var _dctDocId   = null;    // 編輯中的 questions 文件 id（null=新增）
var _dctChar    = '';      // 目前這一題的字
var _dctLesson  = '';
var _dctLessonName = '';
var _dctCurrCache  = {};   // { '版本|冊次|課次': ['字1','字2',...] | null(查過但沒資料) }
var _dctZhuyinOpts = [];   // 目前這個字從萌典查到的讀音 [{bopomofo, def, words}]
var _dctHasSharedDef = false; // 目前這個字的字義是不是借自「詞語解釋」——是的話萌典查到結果不要蓋過去

/* 中文數字排序表 */
var _CN_MAP = {
  '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,
  '十':10,'十一':11,'十二':12,'十三':13,'十四':14,'十五':15,
  '十六':16,'十七':17,'十八':18,'十九':19,'二十':20
};
/* 語文大題預設順序 */
var _EC_TYPE_ORDER = ['詞語填空', '詞語解釋', '選擇題', '句子重組', '默寫生字'];
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
                              options: qdata.options || null, zhuyin: qdata.zhuyin || '', hintWord: qdata.hintWord || '' });
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

  /* 課次清單不能只看 questions——課文編輯（lessonTexts）可能已經存了課文、但這一課還沒出過任何
     題目，questions 裡完全查不到，課次選單就會漏掉它（使用者實際遇到的狀況：課文編輯裡「運動會」
     已經存在，這裡卻選不到）。兩邊都查，用課次號碼聯集起來，課名優先用 lessonTexts 的（比較可能
     是老師正式打的課名），questions 那邊沒有獨立的課文課名欄位可比，只能當備援。 */
  var qQuestions   = db.collection('questions').where('teacherUid', '==', currentTeacher.uid).where('grade', '==', _ecGrade).get();
  var qLessonTexts = db.collection('lessonTexts').where('teacherUid', '==', currentTeacher.uid).where('grade', '==', _ecGrade).get();

  Promise.all([qQuestions, qLessonTexts]).then(function(results) {
    var lessonMap = {};
    results[0].forEach(function(doc) {
      var d = doc.data();
      if (d.lesson && !lessonMap[d.lesson]) lessonMap[d.lesson] = d.lessonName || '';
    });
    results[1].forEach(function(doc) {
      var d = doc.data();
      if (!d.lesson) return;
      if (!lessonMap[d.lesson] || d.lessonName) lessonMap[d.lesson] = d.lessonName || lessonMap[d.lesson] || '';
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
      opts += '<option value="" disabled style="color:var(--muted)">（此年級還沒有題庫或課文，可忽略）</option>';
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
      ? _ecEsc(q.question) + '　<span style="color:var(--muted)">' + _ecEsc(q.zhuyin || '') + '　' + _ecEsc(q.answer || '') + '</span>'
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
                    answer: q.answer || q.word || '', options: q.options || null,
                    zhuyin: q.zhuyin || '', hintWord: q.hintWord || '' };
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
                       options: q.options || null, zhuyin: q.zhuyin || '', hintWord: q.hintWord || '' });
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
  var dictSkipped = 0;
  /* 默寫生字目前只有列印版面，chinese-quiz 網頁測驗還沒有寫字作答的介面——不排除的話會
     掉進 renderQuestion() 的預設 fallback（當成「詞語解釋」讓學生打字），答案格式對不起來，
     學生會看到一題完全答不出來的怪題目。線上測驗先跳過這個題型，只收其他能線上作答的題。 */
  _ecSections.forEach(function(sec) {
    (sec.questions || []).forEach(function(q) {
      if (q.type === '默寫生字') { dictSkipped++; return; }
      questionIds.push(q.id); totalQ++;
    });
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
  if (dictSkipped) {
    confirmMsg += '\n\n（默寫生字目前只能列印，' + dictSkipped + ' 題默寫生字不會出現在線上測驗裡，學生只會在網頁上看到其他題型）';
  }
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

    /* 默寫生字：不是逐題一行的 q-list，是看注音+字義、在田字格裡寫字的方格排版，
       跟其他題型的版面完全不同，整段獨立處理、不走下面共用的 <ol class="q-list"> */
    if (key === '默寫生字') {
      body += '<p class="dict-hint">看注音和意思，在格子裡寫出正確的國字。</p>';
      body += '<div class="dict-grid">';
      qs.forEach(function(q) {
        /* 造詞提示是選填的——萌典查到的造詞不一定適合這一課的程度，老師可以留空不顯示 */
        var blanked = q.hintWord ? q.hintWord.split(q.label).join('（　）') : '';
        body += '<div class="dict-card">' +
          '<div class="dict-meaning">' + _ecEsc(q.answer || '') + '</div>' +
          '<div class="dict-box-row"><div class="grid-box"></div>' +
            '<span class="dict-zhuyin-v">' + _ecEsc(q.zhuyin || '') + '</span>' +
          '</div>' +
          (blanked ? '<div class="dict-hintword">例：' + _ecEsc(blanked) + '</div>' : '') +
          '</div>';
      });
      body += '</div></div>';
      sn++;
      return; // forEach callback，等同 continue 到下一個 section
    }

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

  /* ─── CSS ───
     注意：字型路徑用 new URL(相對路徑, 目前頁面網址) 算出絕對網址，不能用
     window.location.origin + 絕對路徑——這個網站是部署在子路徑下（如 GitHub Pages 的
     /QuEDU/），origin 不含子路徑，會漏掉前綴導致字型 404，學生端完全看不到注音字型 */
  var _fontUrl2 = new URL('../assets/font/BPMFZIHIKAISTD-REGULAR.woff2', window.location.href).href;
  var _fontUrl  = new URL('../assets/font/BPMFZIHIKAISTD-REGULAR.TTF', window.location.href).href;
  var css = [
    '@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&display=swap");',
    '@font-face{font-family:"BpmfZihiKai";src:url("' + _fontUrl2 + '") format("woff2"),url("' + _fontUrl + '") format("truetype");font-display:swap}',
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
    /* 默寫生字
       版面改過一次：原本注音是格子上方一個藍底藥丸、格子用 max-width+aspect-ratio 撐大小、
       十字線是偽元素的漸層背景畫出來的。這三個都在使用者實際用瀏覽器列印（不是預覽）時
       出了狀況：aspect-ratio 在印表機轉換時沒有確實撐出格子高度、漸層背景色在「背景圖形」
       沒勾選時整個被拿掉、注音藥丸的底色也一樣被拿掉。改成：格子用明確的 width+height（不依賴
       aspect-ratio）、十字線改用 border 畫（border 不受背景列印設定影響，永遠印得出來）、
       注音拿掉底色、改成直書（書寫模式 vertical-rl）放在格子右邊——這也是教育現場常見的
       注音標示方式。另外格子縮小、整組 card 間距收緊，讓一頁能放下 4 排 x 3 欄＝12 個字。 */
    '.dict-hint{font-size:9.5pt;color:#3d3d5c;margin:0 0 10px}',
    '.dict-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 16px}',
    '.dict-card{display:flex;flex-direction:column;align-items:center;gap:3px}',
    '.dict-meaning{font-size:8.3pt;color:#3d3d5c;line-height:1.4;padding:0 4px;text-align:center;min-height:2.3em}',
    '.dict-box-row{display:flex;align-items:stretch;gap:5px}',
    '.grid-box{position:relative;width:92px;height:92px;flex-shrink:0;',
              'border:1.5px solid #d4cfc0;border-radius:4px;background:#fff}',
    '.grid-box::before{content:"";position:absolute;left:0;right:0;top:50%;border-top:1px dashed #d4cfc0}',
    '.grid-box::after{content:"";position:absolute;top:0;bottom:0;left:50%;border-left:1px dashed #d4cfc0}',
    '.dict-zhuyin-v{writing-mode:vertical-rl;text-orientation:upright;font-size:10.5pt;',
                   'font-weight:800;color:#2563eb;letter-spacing:1px;display:flex;align-items:center}',
    '.dict-hintword{font-size:9.5pt;font-weight:700;color:#1a1a2e;margin-top:1px}',
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
      /* Chrome 的「背景圖形」預設是關的，有背景色/背景圖樣式的元素（配對題的圖片格、答案池）
         沒開這個設定會被整個拿掉；強制打開不依賴使用者自己去列印對話框裡勾選 */
      '*{print-color-adjust:exact;-webkit-print-color-adjust:exact}',
      /* 大題本身可能比一頁還高，不能整塊 break-inside:avoid——否則瀏覽器只能把整塊往下一頁推，
         導致上一頁被擠成空白。改成只保護「單一題目」跟「大題標題」不被從中間切斷，
         大題允許正常跨頁，跨到下一頁自然接著排。 */
      '.sec-header{break-after:avoid}',
      '.q-item{break-inside:avoid}',
      '.match-item{break-inside:avoid}',
      '.pool-box{break-inside:avoid}',
      '.dict-card{break-inside:avoid}',
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
function _ecEscJs(s) { return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

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

/* 句子重組：開窗用 Step 1 已經選好的年級/課次預填，存檔完（_srOnSaved hook，定義在
   admin/quiz-bank.js 的 _srSaveQuestion 裡）直接把新題目塞進 _ecAllQ 並勾選起來，
   這份測驗馬上就帶著這一題，不用使用者自己再去選題清單裡找 */
/* lesson/lessonName 選填——從課文挑句子點進來時，帶的是「目前篩選中的那一課」，不一定跟
   Step 1 選的是同一課（老師可能在 Step 2 另外切了課次篩選瀏覽）；單純按「+新增」才退回用
   Step 1 的 _ecLesson/_ecLessonName */
function _ecOpenSrModal(prefillSentence, lesson, lessonName) {
  var modal = document.getElementById('sr-modal');
  if (!modal) return;
  _srEditDocId = null;
  document.getElementById('sr-modal-title').textContent = '🧩 新增句子重組題';
  document.getElementById('sr-delete-btn').style.display = 'none';
  document.getElementById('sr-save-btn').textContent = '加入這份測驗';
  document.getElementById('sr-grade').value = _ecGrade;
  document.getElementById('sr-grade-display').textContent = _ecGrade || '（請先回第一步選版本冊次）';
  document.getElementById('sr-lesson').value = lesson || _ecLesson || '';
  document.getElementById('sr-lesson-name').value = lessonName || _ecLessonName || '';
  document.getElementById('sr-sentence').value = prefillSentence || '';
  document.getElementById('sr-pieces-wrap').style.display = 'none';
  var statusEl = document.getElementById('sr-status');
  if (statusEl) { statusEl.style.color = 'var(--muted)'; statusEl.textContent = ''; }

  _srOnSaved   = _ecSrOnSavedHandler;
  _srOnDeleted = _ecSrOnDeletedHandler;
  modal.style.display = 'flex';
  if (prefillSentence) _srSegmentSentence(); /* 從課文點句子進來的，直接先拆好給老師看，不用再按一次 */
}

/* 點清單裡已經存在的句子重組題 → 用同一個 modal，但是編輯模式：直接用存檔時的片段
   （不重新跑斷詞，保留老師原本調整過的分界），存檔時更新同一份文件，並多顯示刪除按鈕 */
function _ecOpenSrModalForEdit(docId) {
  var q = null;
  for (var k = 0; k < _ecAllQ.length; k++) { if (_ecAllQ[k].id === docId) { q = _ecAllQ[k]; break; } }
  if (!q) return;
  var modal = document.getElementById('sr-modal');
  if (!modal) return;

  _srEditDocId = docId;
  document.getElementById('sr-modal-title').textContent = '🧩 編輯句子重組題';
  document.getElementById('sr-delete-btn').style.display = '';
  document.getElementById('sr-save-btn').textContent = '儲存變更';
  document.getElementById('sr-grade').value = q.grade || _ecGrade;
  document.getElementById('sr-grade-display').textContent = q.grade || _ecGrade || '';
  document.getElementById('sr-lesson').value = q.lesson || '';
  document.getElementById('sr-lesson-name').value = q.lessonName || '';
  document.getElementById('sr-sentence').value = (q.options || []).join('');
  var statusEl = document.getElementById('sr-status');
  if (statusEl) { statusEl.style.color = 'var(--muted)'; statusEl.textContent = ''; }

  /* 既有片段直接當 atom，邊界全部設成「分開」——保留老師原本存檔時的合併結果，
     不用重新跑一次斷詞；想整個重新拆解還是可以再按一次「拆解句子」 */
  _srAtoms = (q.options || []).slice();
  _srBoundaries = _srAtoms.map(function() { return true; }).slice(0, _srAtoms.length - 1);
  document.getElementById('sr-pieces-wrap').style.display = '';
  _srRenderPieces();

  _srOnSaved   = _ecSrOnSavedHandler;
  _srOnDeleted = _ecSrOnDeletedHandler;
  modal.style.display = 'flex';
}

function _ecSrOnSavedHandler(docId, data, isEdit) {
  var idx = -1;
  for (var k = 0; k < _ecAllQ.length; k++) { if (_ecAllQ[k].id === docId) { idx = k; break; } }
  if (idx !== -1) {
    _ecAllQ[idx] = Object.assign({ id: docId }, data);
  } else {
    _ecAllQ.push(Object.assign({ id: docId }, data));
    if (!isEdit) _ecSelected[docId] = true; /* 新增的題目自動勾選進這份測驗；編輯既有題目不動原本的勾選狀態 */
  }
  _ecBuildFilters();
  _ecFilterAndRender();
  _srCloseModal();
}

function _ecSrOnDeletedHandler(docId) { _ecRemoveQFromList(docId); }

/* ════════════════════════════════
   默寫生字
   生字清單直接取自「練字趣」（apps/learn/lang/chinese）在用的 curriculum collection，
   不是另外開一套輸入工具手動打字——老師在練字趣後台維護好一次「這一課有哪些生字」，
   這裡跟詞語填空/句子重組一樣選到「默寫生字」篩選值才出現「選字」入口（不要做獨立區塊）。
   字義刻意跟「詞語解釋」共用同一筆資料（_ecAllQ 裡找同一個字的詞語解釋答案），
   同一個字不用老師分兩個地方各打一次意思。注音是唯一沒有既有資料可以借的欄位，
   開 modal 時即時查萌典（跟練字趣 char-info.js 同一個公開 API），抓不到或是多音字
   自己選都可以，最後存檔的是老師確認過的文字，不是每次都重新查。 */

/* 查某一課在 curriculum 裡的生字陣列；查過的課快取住，避免篩選/搜尋時重複打 Firestore。
   curriculum 文件結構跟教師帳號無關（全校共用的課程資料），docId 是 grade+'_l'+lessonNum
   這個慣例（admin/curriculum-data.js 建立時就是這樣命名），用數字課次直接查 doc 比 where 查詢快。 */
function _ecFetchCurriculumChars(version, volume, lesson, cb) {
  var key = version + '|' + volume + '|' + lesson;
  if (_dctCurrCache.hasOwnProperty(key)) { cb(_dctCurrCache[key]); return; }
  var lessonNum = _CN_MAP[lesson];
  if (!db || !version || !volume || lessonNum === undefined) { cb(null); return; }

  db.collection('curriculum').where('name', '==', version).limit(1).get()
    .then(function(verSnap) {
      if (verSnap.empty) { _dctCurrCache[key] = null; cb(null); return; }
      var verId = verSnap.docs[0].id;
      return db.collection('curriculum').doc(verId).collection('lessons')
        .doc(volume + '_l' + lessonNum).get();
    })
    .then(function(lDoc) {
      if (!lDoc) return; // 上一步已經 cb 過了（找不到版本）
      var chars = (lDoc.exists && lDoc.data().chars) ? lDoc.data().chars : null;
      _dctCurrCache[key] = chars;
      cb(chars);
    })
    .catch(function() { _dctCurrCache[key] = null; cb(null); });
}

/* Step 2 選題面板裡「默寫生字」篩選值專屬的選字入口——列出這一課的生字，已經出過題的
   字顯示「✓ 已出題」可以點去編輯，還沒出的字顯示「＋」可以點去新增 */
function _ecRenderDictCreateRow(grade, lesson) {
  var row = document.getElementById('ec-dict-create-row');
  if (!row) return;
  if (!_ecVersion || !_ecVolume || !lesson) {
    row.innerHTML = '<div style="font-size:.82rem;color:var(--muted)">請先在上方選擇特定課次（默寫生字的生字清單跟著課次走）</div>';
    return;
  }
  row.innerHTML = '<div style="font-size:.82rem;color:var(--muted)">讀取生字清單中…</div>';
  var lessonName = ((_ecAllLessonTexts || []).filter(function(x) { return x.grade === grade && x.lesson === lesson; })[0] || {}).lessonName || _ecLessonName || '';

  _ecFetchCurriculumChars(_ecVersion, _ecVolume, lesson, function(chars) {
    if (!chars || !chars.length) {
      row.innerHTML = '<div style="font-size:.82rem;color:var(--muted)">練字趣裡還沒有「' + _ecEsc(_ecVersion + _ecVolume) +
        ' 第' + _ecEsc(lesson) + '課」的生字資料，請先到練字趣後台的「課程版本」維護這一課的生字。</div>';
      return;
    }
    var existing = {}; // char -> 完整題目物件
    _ecAllQ.forEach(function(q) {
      if (q.type === '默寫生字' && q.grade === grade && q.lesson === lesson) existing[q.question] = q;
    });
    row.innerHTML = '<div style="font-size:.78rem;color:var(--muted);font-weight:700;margin-bottom:6px">選這一課的生字來出題（右下角全選／全不選也會套用在這裡）：</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px">' +
      chars.map(function(c) {
        var q = existing[c];
        var selected = q && _ecSelected[q.id];
        /* 批次全選建的題目如果查不到注音或字義，欄位會留空，用 ⚠️ 標記提醒老師自己點進去補，
           不要跟真的填完整的 ✓ 混在一起分不出來 */
        var incomplete = q && (!q.zhuyin || !q.answer);
        var color, bg, mark, action;
        if (!q) {
          color = 'var(--border)'; bg = 'white'; mark = '';
          action = '_ecOpenDictModal(\'' + _ecEscJs(c) + '\',\'' + _ecEscJs(lesson) + '\',\'' + _ecEscJs(lessonName) + '\')';
        } else if (!selected) {
          /* 已經出過題、但目前沒選進這份測驗（使用者在下面清單取消勾選過）——灰階顯示，
             點一下直接選回來，不用重新開 modal、不會弄丟已經查好的注音/字義 */
          color = 'var(--muted)'; bg = 'var(--gray-lt,#f5f5f5)'; mark = '';
          action = '_ecToggleDictCharSelect(\'' + _ecEscJs(q.id) + '\')';
        } else {
          color = incomplete ? '#c9780c' : 'var(--green,#2e7d32)';
          bg    = incomplete ? '#fdf3e3' : '#eaf6ec';
          mark  = incomplete ? ' ⚠️' : ' ✓';
          action = '_ecOpenDictModalForEdit(\'' + _ecEscJs(q.id) + '\')';
        }
        return '<button type="button" onclick="' + action + '" ' +
          'style="padding:6px 14px;border:1.5px solid ' + color + ';border-radius:8px;' +
          'background:' + bg + ';font-size:1rem;font-weight:800;cursor:pointer;font-family:inherit;color:' + color + '">' +
          _ecEsc(c) + mark + '</button>';
      }).join('') +
      '</div>';
  });
}

/* 新增：點生字清單裡還沒出題的字 */
function _ecOpenDictModal(char, lesson, lessonName) {
  var modal = document.getElementById('dict-modal');
  if (!modal) return;
  _dctDocId = null; _dctChar = char; _dctLesson = lesson; _dctLessonName = lessonName;

  document.getElementById('dict-modal-title').textContent = '✍️ 新增默寫生字';
  document.getElementById('dict-char-display').textContent = char;
  document.getElementById('dict-lesson-display').textContent = (_ecVersion + _ecVolume) + ' 第' + lesson + '課' + (lessonName ? '　' + lessonName : '');
  document.getElementById('dict-zhuyin').value = '';
  document.getElementById('dict-zhuyin-opts').innerHTML = '';
  document.getElementById('dict-hint').value = '';
  document.getElementById('dict-hint-opts').innerHTML = '';
  document.getElementById('dict-delete-btn').style.display = 'none';
  document.getElementById('dict-save-btn').textContent = '加入這份測驗';

  /* 字義：優先借同一個字在這一課的「詞語解釋」答案；借不到的話等等 _dctFetchZhuyin 查完萌典，
     用萌典本身的解釋頂上去（練字趣的字義欄位就是同一個 API 來的），兩邊都沒有才讓老師自己打 */
  var sharedDef = _ecAllQ.filter(function(q) {
    return q.type === '詞語解釋' && q.grade === _ecGrade && q.lesson === lesson && q.question === char;
  })[0];
  _dctHasSharedDef = !!sharedDef;
  document.getElementById('dict-meaning').value = sharedDef ? sharedDef.answer : '';

  var statusEl = document.getElementById('dict-status');
  if (statusEl) { statusEl.style.color = 'var(--muted)'; statusEl.textContent = sharedDef ? '字義已帶入「詞語解釋」裡的答案，可以直接改' : '查詢萌典字典中…'; }

  modal.style.display = 'flex';
  _dctFetchZhuyin(char);
}

/* 編輯：點生字清單裡已經出過題的字（顯示 ✓），或是 Step2 清單裡點這一題 */
function _ecOpenDictModalForEdit(docId) {
  var q = null;
  for (var k = 0; k < _ecAllQ.length; k++) { if (_ecAllQ[k].id === docId) { q = _ecAllQ[k]; break; } }
  if (!q) return;
  var modal = document.getElementById('dict-modal');
  if (!modal) return;
  _dctDocId = docId; _dctChar = q.question; _dctLesson = q.lesson; _dctLessonName = q.lessonName;

  document.getElementById('dict-modal-title').textContent = '✍️ 編輯默寫生字';
  document.getElementById('dict-char-display').textContent = q.question;
  document.getElementById('dict-lesson-display').textContent = (q.grade || _ecGrade) + ' 第' + q.lesson + '課' + (q.lessonName ? '　' + q.lessonName : '');
  document.getElementById('dict-zhuyin').value = q.zhuyin || '';
  document.getElementById('dict-zhuyin-opts').innerHTML = '';
  document.getElementById('dict-meaning').value = q.answer || '';
  document.getElementById('dict-hint').value = q.hintWord || '';
  document.getElementById('dict-hint-opts').innerHTML = '';
  document.getElementById('dict-delete-btn').style.display = '';
  document.getElementById('dict-save-btn').textContent = '儲存變更';

  var statusEl = document.getElementById('dict-status');
  if (statusEl) { statusEl.style.color = 'var(--muted)'; statusEl.textContent = ''; }

  modal.style.display = 'flex';
}

/* 選字區裡「已出題但目前沒選進這份測驗」的灰色 chip 點一下直接選回來——題目資料已經存在
   （注音/字義都還在），不需要重新開 modal，純粹是把它加回 _ecSelected 再重畫 */
function _ecToggleDictCharSelect(docId) {
  _ecSelected[docId] = true;
  var el = document.getElementById('ec-selected-count');
  if (el) el.textContent = Object.keys(_ecSelected).length;
  _ecFilterAndRender();
}

function _dctStripHtml(str) {
  if (!str) return '';
  return String(str).replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/* 從萌典一個讀音底下的所有 definitions.example 裡抓造詞——跟 char-info.js 的 wordDefPairs
   同一套邏輯（例句裡用「」框起來的就是詞例，2～4 字、含目標字、去重，最多抓 5 個），
   移過來是因為默寫生字跟練字趣要的格式不一樣（這裡只要詞本身拿去挖空用，不需要連著解釋） */
function _dctExtractWords(char, heteronym) {
  var words = []; var seen = {};
  (heteronym.definitions || []).forEach(function(d) {
    if (!d.example || words.length >= 5) return;
    d.example.forEach(function(ex) {
      if (words.length >= 5) return;
      var cleaned = _dctStripHtml(ex).replace(/～/g, char);
      var matches = cleaned.match(/「([^」]+)」/g) || [];
      matches.forEach(function(m) {
        if (words.length >= 5) return;
        var word = m.replace(/「|」/g, '').trim();
        if (word.length >= 2 && word.length <= 4 && word.indexOf(char) !== -1 && !seen[word]) {
          seen[word] = true;
          words.push(word);
        }
      });
    });
  });
  return words;
}

/* 查萌典抓一個字的所有讀音＋對應解釋＋造詞——跟練字趣 char-info.js 用同一個公開 API，解釋
   欄位就是練字趣「字義」卡片顯示的同一筆資料（截圖裡「表現、表演。為英語show的音譯。」那個），
   造詞欄位就是練字趣「造詞」卡片顯示的同一批詞（截圖裡「山谷／河谷」那個）。
   純查詢邏輯跟「查完要不要畫 UI」分開：單一新增 modal 用這個結果畫可點選的讀音按鈕
   （_dctFetchZhuyin），批次全選用這個結果直接挑第一個讀音自動建檔（_ecBulkCreateMissingDictChars）。
   查不到就回傳空陣列，由呼叫端決定怎麼辦，不是只有一種用法 */
function _dctLookupZhuyin(char, cb) {
  fetch('https://www.moedict.tw/' + encodeURIComponent(char) + '.json')
    .then(function(res) { if (!res.ok) throw new Error('not found'); return res.json(); })
    .then(function(data) {
      var seen = {}; var opts = [];
      (data.heteronyms || []).forEach(function(h) {
        var bp = h.bopomofo || '';
        if (!bp || seen[bp]) return;
        seen[bp] = true;
        var def = (h.definitions && h.definitions[0]) ? _dctStripHtml(h.definitions[0].def) : '';
        opts.push({ bopomofo: bp, def: def, words: _dctExtractWords(char, h) });
      });
      cb(opts);
    })
    .catch(function() { cb([]); });
}

/* 新增 modal 專用：查完畫成可點選的讀音按鈕，查不到或老師不滿意都可以直接改 #dict-zhuyin
   這個輸入框，不依賴這次查詢成功。字義如果沒有借到「詞語解釋」的答案，這裡用第一個讀音
   查到的萌典解釋頂上去（練字趣顯示的字義就是這筆資料），一樣只是預填，老師可以直接改。
   造詞提示（挖空放在寫字格下面那行）同一次查詢順便帶出來，換讀音時造詞選項會跟著換
   （不同讀音的造詞不一樣），但不會動已經填進 #dict-hint 的文字，避免蓋掉老師自己選/打的 */
function _dctFetchZhuyin(char) {
  var optsEl = document.getElementById('dict-zhuyin-opts');
  if (optsEl) optsEl.innerHTML = '<span style="font-size:.78rem;color:var(--muted)">查詢注音中…</span>';
  _dctLookupZhuyin(char, function(opts) {
    if (_dctChar !== char) return; // modal 已經切換到別的字，這次結果不要套用
    _dctZhuyinOpts = opts;
    var statusEl  = document.getElementById('dict-status');
    var meaningEl = document.getElementById('dict-meaning');

    if (!_dctHasSharedDef && meaningEl && !meaningEl.value.trim() && opts.length && opts[0].def) {
      meaningEl.value = opts[0].def;
      if (statusEl) { statusEl.style.color = 'var(--muted)'; statusEl.textContent = '注音和字義都已帶入萌典字典的解釋，可以直接改'; }
    } else if (!_dctHasSharedDef && statusEl && statusEl.textContent === '查詢萌典字典中…') {
      statusEl.textContent = '';
    }

    _dctRenderHintOpts(opts.length ? (opts[0].words || []) : []);
    var hintEl = document.getElementById('dict-hint');
    if (hintEl && !hintEl.value.trim() && opts.length && opts[0].words && opts[0].words.length) {
      hintEl.value = opts[0].words[0];
    }

    if (!optsEl) return;
    if (!opts.length) { optsEl.innerHTML = '<span style="font-size:.78rem;color:var(--muted)">查無資料，請自行輸入</span>'; return; }
    optsEl.innerHTML = opts.map(function(o, i) {
      return '<button type="button" onclick="_dctSelectZhuyinOpt(' + i + ')" ' +
        'style="padding:4px 12px;border:1.5px solid var(--blue);border-radius:7px;background:' + (i === 0 ? 'var(--blue)' : 'white') + ';' +
        'color:' + (i === 0 ? 'white' : 'var(--blue)') + ';font-weight:800;font-size:.85rem;cursor:pointer;font-family:inherit;margin-right:6px">' +
        _ecEsc(o.bopomofo) + '</button>';
    }).join('');
    if (!document.getElementById('dict-zhuyin').value) document.getElementById('dict-zhuyin').value = opts[0].bopomofo;
  });
}

/* 讀音按鈕點了之後：換注音＋把造詞選項換成這個讀音底下查到的那批（不同讀音的造詞不一樣） */
function _dctSelectZhuyinOpt(i) {
  var o = _dctZhuyinOpts[i];
  if (!o) return;
  document.getElementById('dict-zhuyin').value = o.bopomofo;
  _dctRenderHintOpts(o.words || []);
}

function _dctRenderHintOpts(words) {
  var el = document.getElementById('dict-hint-opts');
  if (!el) return;
  if (!words.length) { el.innerHTML = '<span style="font-size:.78rem;color:var(--muted)">查無造詞，可自行輸入</span>'; return; }
  el.innerHTML = words.map(function(w) {
    return '<button type="button" onclick="document.getElementById(\'dict-hint\').value=\'' + _ecEscJs(w) + '\'" ' +
      'style="padding:4px 12px;border:1.5px solid var(--blue);border-radius:7px;background:white;' +
      'color:var(--blue);font-weight:800;font-size:.85rem;cursor:pointer;font-family:inherit;margin-right:6px">' +
      _ecEsc(w) + '</button>';
  }).join('');
}

/* 「全選」套用到默寫生字：把這一課還沒出題的生字一次全部建好——逐字查萌典注音（挑第一個
   讀音，多音字老師事後可以點進去改）、借同一個字的「詞語解釋」答案當字義，字跟字之間錯開
   150ms 查詢避免一次塞爆萌典 API（跟練字趣 preloadCharInfoAll 同樣的節流手法）。
   查不到注音或借不到字義不會整個跳過不建，還是會建檔，只是那個欄位留空，靠 _ecRenderDictCreateRow
   畫出來的「⚠️」標記提醒老師自己點進去補，不會因為某個字查詢失敗就整批卡住。

   這個過程要跑好幾秒（逐字查詢+節流），使用者等不及重複按「全選」的話，第二次呼叫一開始算
   出來的 existing／queue 會是第一次呼叫還沒寫完時的舊快照，兩邊都會排進同一批字，造成
   同一個字被建立兩次（真的在正式環境發生過：連續按兩次，跑到一半的那幾個字重複建檔）。
   用一個簡單的執行中旗標擋掉重複呼叫，不是靠停用按鈕這種 UI 層的做法（UI 可能漏接事件），
   直接在函式本體擋，不管從哪裡呼叫都安全 */
var _dctBulkRunning = false;

function _ecBulkCreateMissingDictChars(grade, lesson) {
  if (!db || !_ecVersion || !_ecVolume || !lesson) return;
  if (_dctBulkRunning) { showToast('批次建立還在進行中，請稍候…'); return; }

  _ecFetchCurriculumChars(_ecVersion, _ecVolume, lesson, function(chars) {
    if (!chars || !chars.length) return;
    var lessonName = ((_ecAllLessonTexts || []).filter(function(x) { return x.grade === grade && x.lesson === lesson; })[0] || {}).lessonName || _ecLessonName || '';
    var existing = {};
    _ecAllQ.forEach(function(q) { if (q.type === '默寫生字' && q.grade === grade && q.lesson === lesson) existing[q.question] = true; });
    var queue = chars.filter(function(c) { return !existing[c]; });
    if (!queue.length) return;

    _dctBulkRunning = true;
    var btn = document.getElementById('ec-select-all-btn');
    if (btn) { btn.disabled = true; btn.textContent = '建立中…'; }

    var created = 0;
    showToast('批次建立默寫生字中…（共 ' + queue.length + ' 字）');

    function next(i) {
      if (i >= queue.length) {
        _dctBulkRunning = false;
        if (btn) { btn.disabled = false; btn.textContent = '全選'; }
        showToast('✅ 已建立 ' + created + ' 題默寫生字（查不到注音/字義的已用 ⚠️ 標記，可點進去補）');
        _ecBuildFilters();
        _ecFilterAndRender();
        return;
      }
      var c = queue[i];
      var sharedDef = _ecAllQ.filter(function(q) {
        return q.type === '詞語解釋' && q.grade === grade && q.lesson === lesson && q.question === c;
      })[0];
      _dctLookupZhuyin(c, function(opts) {
        var meaning  = sharedDef ? sharedDef.answer : ((opts[0] && opts[0].def) ? opts[0].def : '');
        var hintWord = (opts[0] && opts[0].words && opts[0].words.length) ? opts[0].words[0] : '';
        var data = {
          grade: grade, lesson: lesson, lessonName: lessonName,
          type: '默寫生字', question: c, answer: meaning, zhuyin: opts[0] ? opts[0].bopomofo : '', hintWord: hintWord,
          options: [], teacherUid: currentTeacher ? currentTeacher.uid : '', createdAt: new Date().toISOString()
        };
        db.collection('questions').add(data).then(function(ref) {
          var full = Object.assign({ id: ref.id }, data);
          _ecAllQ.push(full);
          _ecSelected[ref.id] = true;
          created++;
        }).catch(function() {}).then(function() {
          setTimeout(function() { next(i + 1); }, 150);
        });
      });
    }
    next(0);
  });
}

function _dctCloseModal() {
  var modal = document.getElementById('dict-modal');
  if (modal) modal.style.display = 'none';
  _dctDocId = null; _dctChar = ''; _dctZhuyinOpts = [];
}

function _dctSaveQuestion() {
  if (!db || !_dctChar) return;
  var statusEl = document.getElementById('dict-status');
  function fail(msg) { if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = msg; } }

  var zhuyin  = document.getElementById('dict-zhuyin').value.trim();
  var meaning = document.getElementById('dict-meaning').value.trim();
  var hintWord = document.getElementById('dict-hint').value.trim();
  if (!zhuyin)  { fail('注音不能空白'); return; }
  if (!meaning) { fail('字義不能空白'); return; }
  if (hintWord && hintWord.indexOf(_dctChar) === -1) { fail('造詞提示裡要包含「' + _dctChar + '」這個字才能挖空，請修改或清空'); return; }

  var data = {
    grade: _ecGrade, lesson: _dctLesson, lessonName: _dctLessonName,
    type: '默寫生字', question: _dctChar, answer: meaning, zhuyin: zhuyin, hintWord: hintWord, options: [],
    teacherUid: currentTeacher ? currentTeacher.uid : ''
  };

  var isEdit = !!_dctDocId;
  var p = isEdit
    ? db.collection('questions').doc(_dctDocId).set(data)
    : db.collection('questions').add(Object.assign({ createdAt: new Date().toISOString() }, data));

  p.then(function(refOrNothing) {
    var docId = isEdit ? _dctDocId : refOrNothing.id;
    var full  = Object.assign({ id: docId }, data, isEdit ? {} : { createdAt: new Date().toISOString() });
    var idx = -1;
    for (var k = 0; k < _ecAllQ.length; k++) { if (_ecAllQ[k].id === docId) { idx = k; break; } }
    if (idx !== -1) {
      _ecAllQ[idx] = full;
    } else {
      _ecAllQ.push(full);
      if (!isEdit) _ecSelected[docId] = true;
    }
    _ecBuildFilters();
    _ecFilterAndRender();
    showToast(isEdit ? '✅ 已儲存變更' : '✅ 已加入「' + _dctChar + '」');
    _dctCloseModal();
  }).catch(function(e) { fail('儲存失敗：' + e.message); });
}

function _dctDeleteQuestion() {
  if (!db || !_dctDocId) return;
  if (!confirm('「' + _dctChar + '」這一題默寫生字要刪除嗎？此操作無法復原。')) return;
  var docId = _dctDocId;
  db.collection('questions').doc(docId).delete().then(function() {
    showToast('✅ 已刪除');
    _ecRemoveQFromList(docId);
    _dctCloseModal();
  }).catch(function(e) { showToast('❌ 刪除失敗：' + e.message); });
}

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
