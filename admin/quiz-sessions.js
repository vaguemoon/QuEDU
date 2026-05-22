/**
 * admin/quiz-sessions.js — 教師測驗代碼管理（建立、列表、關閉）
 * 依賴：shared.js（db、showToast）、init.js（currentTeacher）
 */
'use strict';

/* ── 測驗列表快取（供篩選使用）── */
var _qsAllSessions = [];
var _qsAllScoreMap = {};

/* ── 6 碼代碼產生（A-Z 0-9，排除易混淆字符 O/0/I/1）── */
function _genCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code  = '';
  for (var i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function _qsEsc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _qsCnToInt(s) {
  var map = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,
              '十':10,'十一':11,'十二':12,'十三':13,'十四':14,'十五':15,
              '十六':16,'十七':17,'十八':18 };
  if (map[s] !== undefined) return map[s];
  var n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

/* ════════════════════════════════════════
   載入測驗列表
   ════════════════════════════════════════ */
function loadQuizSessions() {
  var wrap = document.getElementById('qs-list-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  if (!db || !currentTeacher) { setTimeout(loadQuizSessions, 300); return; }

  var EMPTY_SNAP = { forEach: function(){} };
  Promise.all([
    db.collection('quizSessions').where('teacherUid', '==', currentTeacher.uid).get(),
    db.collection('quizResults').where('teacherUid',  '==', currentTeacher.uid).get()
      .catch(function() { return EMPTY_SNAP; })   /* 規則未部署時降級，不阻斷列表載入 */
  ]).then(function(results) {
    var snap       = results[0];
    var resultSnap = results[1];

    /* 依 sessionId 統計：整體最高分、作答人次、各學生最高分 */
    var scoreMap = {};
    resultSnap.forEach(function(doc) {
      var d   = doc.data();
      var sid = d.sessionId;
      if (!sid) return;
      if (!scoreMap[sid]) scoreMap[sid] = { max: 0, count: 0, students: {} };
      scoreMap[sid].count++;
      if (d.score > scoreMap[sid].max) scoreMap[sid].max = d.score;
      /* per-student best */
      var stId   = d.studentId || ('_' + scoreMap[sid].count);
      var stName = d.studentName || d.studentNickname || '匿名';
      if (!scoreMap[sid].students[stId] || d.score > scoreMap[sid].students[stId].max) {
        scoreMap[sid].students[stId] = { name: stName, max: d.score };
      }
    });

    if (snap.size === 0) {
      _qsAllSessions = [];
      _qsAllScoreMap = {};
      _qsShowFilterBar(false);
      wrap.innerHTML = '<p style="color:var(--muted);font-size:.88rem;padding:16px 0">尚未建立任何測驗。點擊「＋ 新增測驗」開始出題。</p>';
      return;
    }

    var sessions = [];
    snap.forEach(function(doc) { sessions.push({ id: doc.id, data: doc.data() }); });
    sessions.sort(function(a, b) {
      if (a.data.active !== b.data.active) return a.data.active ? -1 : 1;
      return (b.data.createdAt || '').localeCompare(a.data.createdAt || '');
    });

    _qsAllSessions = sessions;
    _qsAllScoreMap = scoreMap;
    _qsShowFilterBar(true);
    _qsPopulateGradeFilter();
    _qsRenderList();
  }).catch(function(e) {
    wrap.innerHTML = '<p style="color:var(--red);font-size:.88rem">讀取失敗：' + _qsEsc(e.message) + '</p>';
  });
}

/* ── 顯示／隱藏篩選列 ── */
function _qsShowFilterBar(show) {
  var bar = document.getElementById('qs-filter-bar');
  if (!bar) return;
  bar.style.display = show ? 'flex' : 'none';
}

/* ── 填充年級下拉選單 ── */
function _qsPopulateGradeFilter() {
  var sel = document.getElementById('qs-filter-grade');
  if (!sel) return;
  var grades = {};
  _qsAllSessions.forEach(function(s) { if (s.data.grade) grades[s.data.grade] = true; });
  var currentVal = sel.value;
  var opts = '<option value="">全部年級</option>';
  Object.keys(grades).sort().forEach(function(g) {
    opts += '<option value="' + _qsEsc(g) + '"' + (g === currentVal ? ' selected' : '') + '>' + _qsEsc(g) + '</option>';
  });
  sel.innerHTML = opts;
  _qsPopulateLessonFilter();
}

/* ── 填充課次下拉選單（依選定年級過濾）── */
function _qsPopulateLessonFilter() {
  var sel = document.getElementById('qs-filter-lesson');
  if (!sel) return;
  var grade = (document.getElementById('qs-filter-grade') || {}).value || '';
  var lessons = {};
  _qsAllSessions.forEach(function(s) {
    if (s.data.lesson && (!grade || s.data.grade === grade)) {
      lessons[s.data.lesson] = s.data.lessonName || '';
    }
  });
  var currentVal = sel.value;
  var keys = Object.keys(lessons).sort(function(a, b) {
    var na = _qsCnToInt(a), nb = _qsCnToInt(b);
    if (na !== null && nb !== null) return na - nb;
    return a.localeCompare(b, 'zh-TW');
  });
  var opts = '<option value="">全部課次</option>';
  keys.forEach(function(l) {
    var label = '第 ' + l + ' 課' + (lessons[l] ? '　' + lessons[l] : '');
    opts += '<option value="' + _qsEsc(l) + '"' + (l === currentVal ? ' selected' : '') + '>' + _qsEsc(label) + '</option>';
  });
  sel.innerHTML = opts;
}

/* ── 年級變更：重建課次選單再渲染 ── */
function _qsFilterGradeChanged() {
  var lessonSel = document.getElementById('qs-filter-lesson');
  if (lessonSel) lessonSel.value = '';
  _qsPopulateLessonFilter();
  _qsRenderList();
}

/* ── 篩選變更時呼叫 ── */
function _qsFilterChanged() {
  _qsRenderList();
}

/* ── 依篩選條件渲染列表 ── */
function _qsRenderList() {
  var wrap = document.getElementById('qs-list-wrap');
  if (!wrap) return;

  var filterStatus = (document.getElementById('qs-filter-status') || {}).value || '';
  var filterGrade  = (document.getElementById('qs-filter-grade')  || {}).value || '';
  var filterLesson = (document.getElementById('qs-filter-lesson') || {}).value || '';
  var filterSearch = ((document.getElementById('qs-filter-search') || {}).value || '').trim().toLowerCase();

  var filtered = _qsAllSessions.filter(function(s) {
    var d      = s.data;
    var active = d.active !== false;
    if (filterStatus === 'active' && !active)  return false;
    if (filterStatus === 'closed' &&  active)  return false;
    if (filterGrade  && d.grade  !== filterGrade)  return false;
    if (filterLesson && d.lesson !== filterLesson) return false;
    if (filterSearch && (d.name || '').toLowerCase().indexOf(filterSearch) === -1) return false;
    return true;
  });

  var countEl = document.getElementById('qs-filter-count');
  if (countEl) {
    countEl.textContent = filterStatus || filterGrade || filterLesson || filterSearch
      ? '共 ' + filtered.length + '／' + _qsAllSessions.length + ' 筆'
      : '共 ' + _qsAllSessions.length + ' 筆';
  }

  if (!filtered.length) {
    wrap.innerHTML = '<p style="color:var(--muted);font-size:.88rem;padding:16px 0">沒有符合條件的測驗。</p>';
    return;
  }

  var html = '<div style="display:flex;flex-direction:column;gap:10px">';
  filtered.forEach(function(s) {
    var d      = s.data;
    var active = d.active !== false;
    var date   = d.createdAt ? d.createdAt.slice(0, 10) : '—';
    var counts = d.counts || {};
    var total  = d.type === 'exam'
      ? (counts.total || (d.questionIds || []).length || 0)
      : (counts.explain || 0) + (counts.fillIn || 0) + (counts.mc || 0);
    var borderCol = active ? 'var(--blue)' : 'var(--border)';
    var bgCol     = active ? 'var(--blue-lt,#eef5fc)' : 'var(--gray-lt)';
    var nameCol   = active ? 'var(--blue-dk,#2d6fa8)' : 'var(--muted)';
    var stats     = _qsAllScoreMap[s.id];

    var typeBadge = d.type === 'custom'
      ? '<span style="font-size:.65rem;font-weight:800;background:#dbeafe;color:#1d4ed8;' +
        'border:1px solid #bfdbfe;border-radius:4px;padding:1px 6px;margin-left:6px;vertical-align:middle">自選</span>'
      : d.type === 'exam'
      ? '<span style="font-size:.65rem;font-weight:800;background:#fef3c7;color:#92400e;' +
        'border:1px solid #fde68a;border-radius:4px;padding:1px 6px;margin-left:6px;vertical-align:middle">試卷</span>'
      : '<span style="font-size:.65rem;font-weight:800;background:var(--gray-lt);color:var(--muted);' +
        'border:1px solid var(--border);border-radius:4px;padding:1px 6px;margin-left:6px;vertical-align:middle">隨機</span>';

    html += '<div style="border:2px solid ' + borderCol + ';border-radius:12px;padding:14px 16px;background:' + bgCol + '">';
    html += '<div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap">';

    /* Info */
    html += '<div style="flex:1;min-width:160px">';
    html += '<div style="font-size:1rem;font-weight:900;color:' + nameCol + '">' + _qsEsc(d.name || '未命名') + typeBadge + '</div>';
    var metaParts = [];
    if (d.grade) metaParts.push(_qsEsc(d.grade));
    if (d.lesson) {
      var lessonStr = '第 ' + _qsEsc(d.lesson) + ' 課';
      if (d.lessonName) lessonStr += '　' + _qsEsc(d.lessonName);
      metaParts.push(lessonStr);
    }
    html += '<div style="font-size:.78rem;font-weight:700;color:var(--muted);margin-top:2px">' +
      (metaParts.length ? metaParts.join('　') : '') + '</div>';
    var matchCount  = counts.match || (d.matchSections || []).reduce(function(s, m){ return s + (m.pairCount || 0); }, 0);
    var countDetail = d.type === 'exam'
      ? '共 ' + total + ' 題' + (matchCount ? '　詞圖配對 ' + matchCount + ' 組' : '')
      : '解釋 ' + (counts.explain || 0) + '／填空 ' + (counts.fillIn || 0) + '／選擇 ' + (counts.mc || 0) + '　共 ' + total + ' 題';
    html += '<div style="font-size:.75rem;color:var(--muted);margin-top:2px">建立：' + date + '　' + countDetail + '</div>';

    /* 最高成績 + 折疊式學生名單 */
    if (stats && stats.count > 0) {
      var stuList = Object.keys(stats.students).map(function(id) {
        return stats.students[id];
      }).sort(function(a, b) { return b.max - a.max; });

      var stuRows = '';
      stuList.forEach(function(st) {
        stuRows +=
          '<div style="display:flex;justify-content:space-between;align-items:center;' +
          'padding:4px 0;border-bottom:1px solid var(--border)">' +
            '<span style="font-weight:700;color:var(--text)">' + _qsEsc(st.name) + '</span>' +
            '<span style="font-weight:900;color:var(--green,#2aab5a);font-size:.88rem">' + st.max + ' 分</span>' +
          '</div>';
      });

      html +=
        '<details style="margin-top:8px;font-size:.75rem"' +
        ' ontoggle="var t=this.querySelector(\'.qs-toggle-hint\');if(t)t.textContent=this.open?\'▾ 收合\':\'▾ 學生測驗結果\'">' +
          '<summary style="cursor:pointer;list-style:none;user-select:none;outline:none;' +
          'display:inline-flex;align-items:center;gap:6px;' +
          'background:var(--blue-lt,#eef5fc);color:var(--blue-dk,#2d6fa8);' +
          'border:1.5px solid var(--blue,#5b9dd9);border-radius:7px;' +
          'padding:5px 12px;font-weight:800;font-size:.78rem;' +
          'transition:background .15s,color .15s">' +
            '<span class="qs-toggle-hint">▾ 學生測驗結果</span>' +
            '<span style="font-size:.72rem;font-weight:600;opacity:.8">（' + stuList.length + ' 人 · 最高 ' + stats.max + ' 分）</span>' +
          '</summary>' +
          '<div style="margin-top:8px;background:white;border:1px solid var(--border);border-radius:8px;' +
          'padding:6px 10px;max-height:200px;overflow-y:auto">' +
            stuRows +
          '</div>' +
        '</details>';
    } else {
      html += '<div style="font-size:.75rem;color:var(--muted);margin-top:5px;font-weight:600">尚無作答紀錄</div>';
    }
    html += '</div>';

    /* Status badge */
    if (active) {
      html += '<span style="font-size:.68rem;font-weight:800;background:var(--green);color:white;border-radius:4px;padding:2px 7px;align-self:flex-start">進行中</span>';
    } else {
      html += '<span style="font-size:.68rem;font-weight:800;background:var(--muted);color:white;border-radius:4px;padding:2px 7px;align-self:flex-start">已關閉</span>';
    }
    html += '</div>';

    /* Actions */
    html += '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">';
    if (d.type === 'exam') {
      html += '<button onclick="_ecEditSession(\'' + _qsEscJs(s.id) + '\')" ' +
        'style="padding:5px 14px;border:1.5px solid var(--blue);border-radius:7px;background:white;' +
        'font-size:.78rem;font-weight:800;cursor:pointer;font-family:inherit;color:var(--blue)">✏️ 編輯</button>';
      html += '<button onclick="_ecPrintSession(\'' + _qsEscJs(s.id) + '\')" ' +
        'style="padding:5px 14px;border:1.5px solid var(--border);border-radius:7px;background:white;' +
        'font-size:.78rem;font-weight:800;cursor:pointer;font-family:inherit;color:var(--text)">🖨 列印</button>';
    }
    if (active) {
      html += '<button onclick="showQuizShareModal(\'' + _qsEscJs(s.id) + '\',\'' + _qsEscJs(d.name || '') + '\')" ' +
        'style="padding:5px 14px;border:1.5px solid var(--blue);border-radius:7px;background:var(--blue-lt,#eef5fc);' +
        'font-size:.78rem;font-weight:800;cursor:pointer;font-family:inherit;color:var(--blue-dk,#2d6fa8)">📤 分享給班級</button>';
      html += '<button onclick="closeQuizSession(\'' + _qsEscJs(s.id) + '\')" ' +
        'style="padding:5px 14px;border:1.5px solid var(--muted);border-radius:7px;background:white;' +
        'font-size:.78rem;font-weight:800;cursor:pointer;font-family:inherit;color:var(--muted)">關閉測驗</button>';
    }
    html += '<button onclick="deleteQuizSession(\'' + _qsEscJs(s.id) + '\')" ' +
      'style="padding:5px 14px;border:1.5px solid var(--red);border-radius:7px;background:white;' +
      'font-size:.78rem;font-weight:800;cursor:pointer;font-family:inherit;color:var(--red)">刪除</button>';
    html += '</div>';
    html += '<div class="qs-share-status" data-session-id="' + s.id + '" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px"></div>';

    html += '</div>';
  });
  html += '</div>';
  wrap.innerHTML = html;
  _refreshAllShareStatus();
}


/* ════════════════════════════════════════
   關閉 / 刪除測驗
   ════════════════════════════════════════ */
function closeQuizSession(id) {
  if (!confirm('關閉後學生將無法再使用此代碼入場，確定？')) return;
  db.collection('quizSessions').doc(id).update({ active: false })
    .then(function() { showToast('測驗已關閉'); loadQuizSessions(); })
    .catch(function(e) { showToast('❌ ' + e.message); });
}

async function deleteQuizSession(id) {
  if (!confirm('確定刪除此測驗記錄？此操作無法復原。')) return;
  try {
    // 先找出所有已分享此測驗的班級，一併刪除子集合紀錄
    var sharedClassIds = await _getSessionSharedClasses(id);
    var batch = db.batch();
    sharedClassIds.forEach(function(classId) {
      batch.delete(db.collection('classes').doc(classId).collection('sharedQuizSessions').doc(id));
    });
    batch.delete(db.collection('quizSessions').doc(id));
    await batch.commit();
    showToast('已刪除');
    loadQuizSessions();
  } catch(e) {
    showToast('❌ ' + e.message);
  }
}


/* ════════════════════════════════════════
   試卷分享給班級
   ════════════════════════════════════════ */

var _qsClassCache    = null;  /* 教師班級快取 */
var _qsShareSessionId   = null;  /* 目前正在分享的 sessionId */

function _qsEscJs(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function _loadClassesForShare() {
  if (_qsClassCache) return _qsClassCache;
  if (!db || !currentTeacher) return [];
  var snap = await db.collection('classes')
    .where('teacherUid', '==', currentTeacher.uid).get();
  _qsClassCache = snap.docs.map(function(d) {
    return { id: d.id, name: d.data().name };
  });
  return _qsClassCache;
}

async function _getSessionSharedClasses(sessionId) {
  var classes = await _loadClassesForShare();
  if (!classes.length) return [];
  var sharedIds = [];
  await Promise.all(classes.map(async function(cls) {
    var doc = await db.collection('classes').doc(cls.id)
      .collection('sharedQuizSessions').doc(sessionId).get();
    if (doc.exists) sharedIds.push(cls.id);
  }));
  return sharedIds;
}

async function _refreshAllShareStatus() {
  var els = document.querySelectorAll('.qs-share-status[data-session-id]');
  if (!els.length) return;
  var classes = await _loadClassesForShare().catch(function() { return []; });
  if (!classes.length) return;
  els.forEach(function(el) {
    var sessionId = el.dataset.sessionId;
    _getSessionSharedClasses(sessionId).then(function(sharedIds) {
      el.innerHTML = sharedIds.map(function(cid) {
        var cls = classes.find(function(c) { return c.id === cid; });
        if (!cls) return '';
        return '<span style="font-size:.68rem;font-weight:700;padding:2px 7px;border-radius:20px;' +
          'background:#e0f2fe;color:#0369a1;white-space:nowrap">' + _qsEsc(cls.name) + '</span>';
      }).join(' ');
    }).catch(function() {});
  });
}

async function showQuizShareModal(sessionId, sessionName) {
  if (!db || !currentTeacher) { showToast('Firebase 未就緒'); return; }
  _qsShareSessionId = sessionId;

  var modal    = document.getElementById('qs-share-modal');
  var nameEl   = document.getElementById('qs-share-doc-name');
  var listEl   = document.getElementById('qs-share-class-list');
  var loadEl   = document.getElementById('qs-share-loading');
  var confirmBtn = document.getElementById('qs-share-confirm-btn');
  if (!modal) return;

  nameEl.textContent    = '《' + sessionName + '》';
  listEl.innerHTML      = '';
  loadEl.style.display  = 'block';
  confirmBtn.disabled   = true;
  confirmBtn.onclick    = saveQuizShareSettings;
  modal.style.display   = 'flex';

  try {
    var classes   = await _loadClassesForShare();
    var sharedIds = await _getSessionSharedClasses(sessionId);
    loadEl.style.display = 'none';
    confirmBtn.disabled  = false;

    if (!classes.length) {
      listEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--muted);font-size:.85rem;font-weight:600">尚未建立任何班級</div>';
      return;
    }
    listEl.innerHTML = classes.map(function(cls) {
      var checked = sharedIds.indexOf(cls.id) !== -1 ? 'checked' : '';
      return '<label style="display:flex;align-items:center;gap:10px;padding:10px 6px;' +
        'border-bottom:1px solid var(--border);cursor:pointer;font-weight:700;font-size:.9rem">' +
        '<input type="checkbox" value="' + cls.id + '" ' + checked +
        ' style="width:18px;height:18px;cursor:pointer">' +
        _qsEsc(cls.name) + '</label>';
    }).join('');
  } catch(e) {
    loadEl.style.display = 'none';
    confirmBtn.disabled  = false;
    listEl.innerHTML = '<div style="color:var(--red);font-size:.85rem;padding:8px">載入失敗：' + _qsEsc(e.message) + '</div>';
  }
}

function closeQuizShareModal() {
  var modal = document.getElementById('qs-share-modal');
  if (modal) modal.style.display = 'none';
  _qsShareSessionId = null;
}

async function saveQuizShareSettings() {
  if (!_qsShareSessionId || !db || !currentTeacher) return;
  var confirmBtn = document.getElementById('qs-share-confirm-btn');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '儲存中…'; }

  var checks = document.querySelectorAll('#qs-share-class-list input[type=checkbox]');

  try {
    /* 取得 session 基本資料供分享文件儲存 */
    var sessionDoc = await db.collection('quizSessions').doc(_qsShareSessionId).get();
    var sd = sessionDoc.exists ? sessionDoc.data() : {};

    var batch = db.batch();
    checks.forEach(function(cb) {
      var ref = db.collection('classes').doc(cb.value)
        .collection('sharedQuizSessions').doc(_qsShareSessionId);
      if (cb.checked) {
        batch.set(ref, {
          name:       sd.name       || '',
          grade:      sd.grade      || '',
          lesson:     sd.lesson     || '',
          lessonName: sd.lessonName || '',
          sharedAt:   firebase.firestore.FieldValue.serverTimestamp()
        });
      } else {
        batch.delete(ref);
      }
    });
    await batch.commit();

    showToast('✅ 分享設定已儲存');
    closeQuizShareModal();
    _refreshAllShareStatus();
  } catch(e) {
    showToast('❌ 儲存失敗：' + e.message);
  } finally {
    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = '✅ 確認分享'; }
  }
}
