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
var _ecSecKeyOrder = [];        // 老師排過的大題題型順序（含暫時被取消勾選、不在 _ecSections 裡的題型）
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
  _ecSecKeyOrder   = [];
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
    _ecSecKeyOrder   = [];
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
      _ecApplySectionOrder(d.sectionOrder);
      _ecApplySectionPoints(d.sectionPoints);
      _ecApplyBreakData(d.sectionPageBreaks, d.breakBeforeQuestionIds);
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
      var breakIdSet = {};
      (d.breakBeforeQuestionIds || []).forEach(function(id) { breakIdSet[id] = true; });
      var grouped = {};
      qdocs.forEach(function(qd) {
        if (!qd.exists) return;
        var qdata = qd.data();
        var type  = qdata.type || '其他';
        var label = qdata.question || qdata.word || '';
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push({ id: qd.id, label: label, type: type,
                              answer: qdata.answer || qdata.word || '',
                              options: qdata.options || null, zhuyin: qdata.zhuyin || '', hintWord: qdata.hintWord || '',
                              breakBefore: !!breakIdSet[qd.id] });
      });

      var sectionPoints = d.sectionPoints || {};
      var sectionPageBreaks = d.sectionPageBreaks || {};
      var sections = [];
      var idx      = 0;
      /* 大題順序：先照存檔的 sectionOrder（Step 3 拖曳過的順序），再補預設題型順序，最後其他題型 */
      var typeSeq = (d.sectionOrder || []).slice();
      _EC_TYPE_ORDER.forEach(function(type) { if (typeSeq.indexOf(type) === -1) typeSeq.push(type); });
      typeSeq.forEach(function(type) {
        if (grouped[type] && grouped[type].length) {
          sections.push({ title: (_EC_CN[idx] || String(idx + 1)) + '、' + type,
                          key: type, questions: grouped[type], points: sectionPoints[type],
                          pageBreakBefore: !!sectionPageBreaks[type] });
          idx++;
        }
      });
      Object.keys(grouped).forEach(function(type) {
        if (typeSeq.indexOf(type) === -1 && grouped[type].length) {
          sections.push({ title: (_EC_CN[idx] || String(idx + 1)) + '、' + type,
                          key: type, questions: grouped[type], points: sectionPoints[type],
                          pageBreakBefore: !!sectionPageBreaks[type] });
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
