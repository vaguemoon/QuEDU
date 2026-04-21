/**
 * admin/quiz-sessions.js — 教師測驗代碼管理（建立、列表、關閉）
 * 依賴：shared.js（db、showToast）、init.js（currentTeacher）
 */
'use strict';

var _qsGradeOptions  = [];
var _qsLessonOptions = {};

/* ── 自選測驗狀態 ── */
var _qsCustomStep       = 1;
var _qsCustomName       = '';
var _qsCustomGrade      = '';
var _qsCustomLesson     = '';
var _qsCustomLessonName = '';
var _qsCustomQuestions  = [];  /* [{ id, type, question, answer, options }] */
var _qsCustomSelected   = {};  /* { docId: true } */
var _qsCustomActiveTab  = '';  /* 目前頁籤的題型 */

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
   出題方式選擇 Modal
   ════════════════════════════════════════ */
function showModeSelectModal() {
  var modal = document.getElementById('qs-mode-modal');
  if (modal) modal.style.display = 'flex';
}

function hideModeSelectModal() {
  var modal = document.getElementById('qs-mode-modal');
  if (modal) modal.style.display = 'none';
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
      wrap.innerHTML = '<p style="color:var(--muted);font-size:.88rem;padding:16px 0">尚未建立任何測驗。點擊「＋ 新增測驗」開始出題。</p>';
      return;
    }

    var sessions = [];
    snap.forEach(function(doc) { sessions.push({ id: doc.id, data: doc.data() }); });
    sessions.sort(function(a, b) {
      if (a.data.active !== b.data.active) return a.data.active ? -1 : 1;
      return (b.data.createdAt || '').localeCompare(a.data.createdAt || '');
    });

    var html = '<div style="display:flex;flex-direction:column;gap:10px">';
    sessions.forEach(function(s) {
      var d      = s.data;
      var active = d.active !== false;
      var date   = d.createdAt ? d.createdAt.slice(0, 10) : '—';
      var counts = d.counts || {};
      var total  = (counts.explain || 0) + (counts.fillIn || 0) + (counts.mc || 0);
      var borderCol = active ? 'var(--blue)' : 'var(--border)';
      var bgCol     = active ? 'var(--blue-lt,#eef5fc)' : 'var(--gray-lt)';
      var nameCol   = active ? 'var(--blue-dk,#2d6fa8)' : 'var(--muted)';
      var stats     = scoreMap[s.id];

      var typeBadge = d.type === 'custom'
        ? '<span style="font-size:.65rem;font-weight:800;background:#dbeafe;color:#1d4ed8;' +
          'border:1px solid #bfdbfe;border-radius:4px;padding:1px 6px;margin-left:6px;vertical-align:middle">自選</span>'
        : '<span style="font-size:.65rem;font-weight:800;background:var(--gray-lt);color:var(--muted);' +
          'border:1px solid var(--border);border-radius:4px;padding:1px 6px;margin-left:6px;vertical-align:middle">隨機</span>';

      html += '<div style="border:2px solid ' + borderCol + ';border-radius:12px;padding:14px 16px;background:' + bgCol + '">';
      html += '<div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap">';

      /* Info */
      html += '<div style="flex:1;min-width:160px">';
      html += '<div style="font-size:1rem;font-weight:900;color:' + nameCol + '">' + _qsEsc(d.name || '未命名') + typeBadge + '</div>';
      html += '<div style="font-size:.78rem;font-weight:700;color:var(--muted);margin-top:2px">' +
        _qsEsc(d.grade || '') + '　第 ' + _qsEsc(d.lesson || '') + ' 課　' + _qsEsc(d.lessonName || '') + '</div>';
      html += '<div style="font-size:.75rem;color:var(--muted);margin-top:2px">建立：' + date +
        '　解釋 ' + (counts.explain || 0) + '／填空 ' + (counts.fillIn || 0) + '／選擇 ' + (counts.mc || 0) + '　共 ' + total + ' 題</div>';

      /* 最高成績 + 折疊式學生名單 */
      if (stats && stats.count > 0) {
        /* 學生清單，依最高分排序 */
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
      html += '</div>';/* end flex row */

      /* Actions */
      html += '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">';
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
      /* 分享狀態徽章（非同步填入） */
      html += '<div class="qs-share-status" data-session-id="' + s.id + '" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px"></div>';

      html += '</div>';
    });
    html += '</div>';
    wrap.innerHTML = html;
    _refreshAllShareStatus();
  }).catch(function(e) {
    wrap.innerHTML = '<p style="color:var(--red);font-size:.88rem">讀取失敗：' + _qsEsc(e.message) + '</p>';
  });
}

/* ════════════════════════════════════════
   新增測驗 Modal
   ════════════════════════════════════════ */
function showCreateSessionModal() {
  hideModeSelectModal();
  if (!db || !currentTeacher) { showToast('Firebase 未就緒'); return; }

  Promise.all([
    db.collection('questions').where('teacherUid', '==', currentTeacher.uid).get(),
    db.collection('questions').where('teacherUid', '==', 'shared').get()
  ]).then(function(results) {
    var gradeMap = {};
    results.forEach(function(snap) {
      snap.forEach(function(doc) {
        var d = doc.data();
        var g = d.grade || '', l = d.lesson || '';
        if (!g || !l) return;
        if (!gradeMap[g]) gradeMap[g] = {};
        if (!gradeMap[g][l]) gradeMap[g][l] = d.lessonName || '';
      });
    });

    _qsGradeOptions  = Object.keys(gradeMap).sort();
    _qsLessonOptions = {};
    _qsGradeOptions.forEach(function(g) {
      _qsLessonOptions[g] = Object.keys(gradeMap[g]).map(function(l) {
        return { lesson: l, lessonName: gradeMap[g][l] };
      }).sort(function(a, b) {
        var na = _qsCnToInt(a.lesson), nb = _qsCnToInt(b.lesson);
        if (na !== null && nb !== null) return na - nb;
        return a.lesson.localeCompare(b.lesson, 'zh-TW');
      });
    });

    var gradeEl = document.getElementById('qs-grade');
    if (gradeEl) {
      var gradeOpts = '<option value="">── 請選擇 ──</option>';
      _qsGradeOptions.forEach(function(g) {
        gradeOpts += '<option value="' + _qsEsc(g) + '">' + _qsEsc(g) + '</option>';
      });
      gradeEl.innerHTML = gradeOpts;
    }
    _updateSessionLessonOptions();
    document.getElementById('qs-modal-error').textContent = '';
    document.getElementById('qs-name').value              = '';
    document.getElementById('qs-count-explain').value     = '3';
    document.getElementById('qs-count-fillin').value      = '3';
    document.getElementById('qs-count-mc').value          = '4';

    var modal = document.getElementById('qs-modal');
    if (modal) modal.style.display = 'flex';
  }).catch(function(e) { showToast('載入年級失敗：' + e.message); });
}

function _updateSessionLessonOptions() {
  var gradeEl  = document.getElementById('qs-grade');
  var lessonEl = document.getElementById('qs-lesson');
  if (!gradeEl || !lessonEl) return;
  var grade   = gradeEl.value;
  var lessons = grade ? (_qsLessonOptions[grade] || []) : [];
  var opts = '<option value="">── 請選擇 ──</option>';
  lessons.forEach(function(item) {
    opts += '<option value="' + _qsEsc(item.lesson) + '" data-name="' + _qsEsc(item.lessonName) + '">' +
      '第 ' + _qsEsc(item.lesson) + ' 課　' + _qsEsc(item.lessonName) + '</option>';
  });
  lessonEl.innerHTML = opts;
}

function hideCreateSessionModal() {
  var modal = document.getElementById('qs-modal');
  if (modal) modal.style.display = 'none';
}

/* ════════════════════════════════════════
   建立測驗（寫入 quizSessions）
   ════════════════════════════════════════ */
function createQuizSession() {
  var name     = (document.getElementById('qs-name').value || '').trim();
  var grade    = document.getElementById('qs-grade').value;
  var lessonEl = document.getElementById('qs-lesson');
  var lesson   = lessonEl.value;
  var lessonName = lessonEl.selectedIndex >= 0
    ? (lessonEl.options[lessonEl.selectedIndex].getAttribute('data-name') || '') : '';
  var explain = parseInt(document.getElementById('qs-count-explain').value, 10) || 0;
  var fillIn  = parseInt(document.getElementById('qs-count-fillin').value,  10) || 0;
  var mc      = parseInt(document.getElementById('qs-count-mc').value,      10) || 0;
  var errEl   = document.getElementById('qs-modal-error');

  if (!name)                        { errEl.textContent = '請填寫測驗名稱'; return; }
  if (!grade)                       { errEl.textContent = '請選擇年級'; return; }
  if (!lesson)                      { errEl.textContent = '請選擇課次'; return; }
  if (explain + fillIn + mc === 0)  { errEl.textContent = '至少設定一種題型的題數'; return; }
  errEl.textContent = '';

  if (!db || !currentTeacher) { showToast('Firebase 未就緒'); return; }

  var btn = document.getElementById('btn-create-session');
  if (btn) { btn.disabled = true; btn.textContent = '建立中…'; }

  /* 第一步：從題庫撈題並固定抽樣 */
  Promise.all([
    db.collection('questions').where('teacherUid', '==', 'shared').where('grade', '==', grade).get(),
    db.collection('questions').where('teacherUid', '==', currentTeacher.uid).where('grade', '==', grade).get()
  ]).then(function(results) {
    var seen = {};
    var pool = { '詞語解釋': [], '詞語填空': [], '選擇題': [] };
    results.forEach(function(snap) {
      snap.docs.forEach(function(doc) {
        if (seen[doc.id]) return;
        seen[doc.id] = true;
        var d = doc.data();
        if (d.lesson === lesson && d.type && pool[d.type]) {
          pool[d.type].push(doc.id);
        }
      });
    });

    /* 各題型隨機抽樣，不足時取全部 */
    function sampleIds(arr, n) {
      var a = arr.slice();
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a.slice(0, n);
    }

    var questionIds = [].concat(
      sampleIds(pool['詞語填空'], fillIn),
      sampleIds(pool['詞語解釋'], explain),
      sampleIds(pool['選擇題'],   mc)
    );

    if (!questionIds.length) {
      if (btn) { btn.disabled = false; btn.textContent = '建立'; }
      errEl.textContent = '此課次題庫中沒有符合的題目，請先上傳題庫';
      return;
    }

    /* 第二步：確保代碼唯一後寫入 */
    function tryCreate() {
      var code = _genCode();
      db.collection('quizSessions')
        .where('code', '==', code)
        .where('active', '==', true)
        .get()
        .then(function(snap) {
          if (!snap.empty) return tryCreate();
          return db.collection('quizSessions').add({
            type:        'random',
            name:        name,
            code:        code,
            teacherUid:  currentTeacher.uid,
            grade:       grade,
            lesson:      lesson,
            lessonName:  lessonName,
            counts:      { explain: explain, fillIn: fillIn, mc: mc },
            questionIds: questionIds,
            createdAt:   new Date().toISOString(),
            active:      true
          });
        })
        .then(function() {
          hideCreateSessionModal();
          showToast('✅ 測驗代碼「' + code + '」已建立！');
          loadQuizSessions();
          if (btn) { btn.disabled = false; btn.textContent = '建立'; }
        })
        .catch(function(e) {
          showToast('❌ 建立失敗：' + e.message);
          if (btn) { btn.disabled = false; btn.textContent = '建立'; }
        });
    }
    tryCreate();
  }).catch(function(e) {
    showToast('❌ 撈取題庫失敗：' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = '建立'; }
  });
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
   自選測驗 Modal
   ════════════════════════════════════════ */
function showCustomSessionModal() {
  hideModeSelectModal();
  if (!db || !currentTeacher) { showToast('Firebase 未就緒'); return; }

  _qsCustomStep       = 1;
  _qsCustomName       = '';
  _qsCustomGrade      = '';
  _qsCustomLesson     = '';
  _qsCustomLessonName = '';
  _qsCustomQuestions  = [];
  _qsCustomSelected   = {};
  _qsCustomActiveTab  = '';

  Promise.all([
    db.collection('questions').where('teacherUid', '==', currentTeacher.uid).get(),
    db.collection('questions').where('teacherUid', '==', 'shared').get()
  ]).then(function(results) {
    var gradeMap = {};
    results.forEach(function(snap) {
      snap.forEach(function(doc) {
        var d = doc.data();
        var g = d.grade || '', l = d.lesson || '';
        if (!g || !l) return;
        if (!gradeMap[g]) gradeMap[g] = {};
        if (!gradeMap[g][l]) gradeMap[g][l] = d.lessonName || '';
      });
    });

    _qsGradeOptions  = Object.keys(gradeMap).sort();
    _qsLessonOptions = {};
    _qsGradeOptions.forEach(function(g) {
      _qsLessonOptions[g] = Object.keys(gradeMap[g]).map(function(l) {
        return { lesson: l, lessonName: gradeMap[g][l] };
      }).sort(function(a, b) {
        var na = _qsCnToInt(a.lesson), nb = _qsCnToInt(b.lesson);
        if (na !== null && nb !== null) return na - nb;
        return a.lesson.localeCompare(b.lesson, 'zh-TW');
      });
    });

    _renderCustomStep1();
    var modal = document.getElementById('qs-custom-modal');
    if (modal) modal.style.display = 'flex';
  }).catch(function(e) { showToast('載入年級失敗：' + e.message); });
}

function hideCustomSessionModal() {
  var modal = document.getElementById('qs-custom-modal');
  if (modal) modal.style.display = 'none';
}

/* ── 步驟 1：基本資訊 ── */
function _renderCustomStep1() {
  var subtitle = document.getElementById('qs-custom-subtitle');
  if (subtitle) subtitle.textContent = '步驟 1／2　設定基本資訊';

  var body = document.getElementById('qs-custom-body');
  if (!body) return;

  var gradeOptions = '<option value="">── 請選擇 ──</option>';
  _qsGradeOptions.forEach(function(g) {
    gradeOptions += '<option value="' + _qsEsc(g) + '"' +
      (g === _qsCustomGrade ? ' selected' : '') + '>' + _qsEsc(g) + '</option>';
  });

  var lessonOptions = '<option value="">── 請選擇 ──</option>';
  if (_qsCustomGrade && _qsLessonOptions[_qsCustomGrade]) {
    _qsLessonOptions[_qsCustomGrade].forEach(function(item) {
      lessonOptions += '<option value="' + _qsEsc(item.lesson) + '" data-name="' + _qsEsc(item.lessonName) + '"' +
        (item.lesson === _qsCustomLesson ? ' selected' : '') + '>' +
        '第 ' + _qsEsc(item.lesson) + ' 課　' + _qsEsc(item.lessonName) + '</option>';
    });
  }

  body.innerHTML = [
    '<label style="font-size:.78rem;font-weight:800;color:var(--muted);display:block;margin-bottom:5px">測驗名稱</label>',
    '<input id="qsc-name" type="text" placeholder="例如：第七課自選測驗" maxlength="30" value="' + _qsEsc(_qsCustomName) + '"',
    '  style="width:100%;border:2px solid var(--border);border-radius:8px;padding:9px 12px;font-size:.95rem;font-family:inherit;outline:none;margin-bottom:14px">',
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">',
    '  <div>',
    '    <label style="font-size:.78rem;font-weight:800;color:var(--muted);display:block;margin-bottom:5px">年級</label>',
    '    <select id="qsc-grade" onchange="_qsCustomUpdateLesson()"',
    '      style="width:100%;padding:9px 12px;border:2px solid var(--border);border-radius:8px;font-size:.9rem;font-family:inherit">',
    gradeOptions,
    '    </select>',
    '  </div>',
    '  <div>',
    '    <label style="font-size:.78rem;font-weight:800;color:var(--muted);display:block;margin-bottom:5px">課次</label>',
    '    <select id="qsc-lesson"',
    '      style="width:100%;padding:9px 12px;border:2px solid var(--border);border-radius:8px;font-size:.9rem;font-family:inherit">',
    lessonOptions,
    '    </select>',
    '  </div>',
    '</div>',
    '<div id="qsc-step1-error" style="font-size:.82rem;font-weight:700;color:var(--red);min-height:20px;margin-bottom:12px"></div>',
    '<div style="display:flex;gap:10px">',
    '  <button onclick="hideCustomSessionModal()"',
    '    style="flex:1;padding:11px;border:2px solid var(--border);border-radius:10px;background:var(--gray-lt);font-size:.9rem;font-weight:800;cursor:pointer;font-family:inherit;color:var(--gray)">取消</button>',
    '  <button onclick="_qsCustomNextStep()"',
    '    style="flex:2;padding:11px;border:none;border-radius:10px;background:linear-gradient(135deg,var(--blue),var(--blue-dk));color:white;font-size:.9rem;font-weight:900;cursor:pointer;font-family:inherit">選擇題目 →</button>',
    '</div>'
  ].join('');
}

function _qsCustomUpdateLesson() {
  var gradeEl  = document.getElementById('qsc-grade');
  var lessonEl = document.getElementById('qsc-lesson');
  if (!gradeEl || !lessonEl) return;
  var grade   = gradeEl.value;
  var lessons = grade ? (_qsLessonOptions[grade] || []) : [];
  var opts = '<option value="">── 請選擇 ──</option>';
  lessons.forEach(function(item) {
    opts += '<option value="' + _qsEsc(item.lesson) + '" data-name="' + _qsEsc(item.lessonName) + '">' +
      '第 ' + _qsEsc(item.lesson) + ' 課　' + _qsEsc(item.lessonName) + '</option>';
  });
  lessonEl.innerHTML = opts;
}

function _qsCustomNextStep() {
  var nameEl   = document.getElementById('qsc-name');
  var gradeEl  = document.getElementById('qsc-grade');
  var lessonEl = document.getElementById('qsc-lesson');
  var errEl    = document.getElementById('qsc-step1-error');

  var name   = (nameEl   ? nameEl.value   : '').trim();
  var grade  =  gradeEl  ? gradeEl.value  : '';
  var lesson =  lessonEl ? lessonEl.value : '';
  var lessonName = lessonEl && lessonEl.selectedIndex >= 0
    ? (lessonEl.options[lessonEl.selectedIndex].getAttribute('data-name') || '') : '';

  if (!name)   { if (errEl) errEl.textContent = '請填寫測驗名稱';  return; }
  if (!grade)  { if (errEl) errEl.textContent = '請選擇年級';      return; }
  if (!lesson) { if (errEl) errEl.textContent = '請選擇課次';      return; }
  if (errEl) errEl.textContent = '';

  _qsCustomName       = name;
  _qsCustomGrade      = grade;
  _qsCustomLesson     = lesson;
  _qsCustomLessonName = lessonName;
  _qsCustomStep       = 2;

  _loadCustomBankQuestions(grade, lesson);
}

/* ── 載入題庫（供步驟 2 使用）── */
function _loadCustomBankQuestions(grade, lesson) {
  var body = document.getElementById('qs-custom-body');
  if (!body) return;
  body.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  var subtitle = document.getElementById('qs-custom-subtitle');
  if (subtitle) subtitle.textContent = '步驟 2／2　選擇題目';

  Promise.all([
    db.collection('questions').where('teacherUid', '==', 'shared').where('grade', '==', grade).get(),
    db.collection('questions').where('teacherUid', '==', currentTeacher.uid).where('grade', '==', grade).get()
  ]).then(function(results) {
    var seen      = {};
    var questions = [];
    results.forEach(function(snap) {
      snap.docs.forEach(function(doc) {
        if (seen[doc.id]) return;
        seen[doc.id] = true;
        var d = doc.data();
        if (d.lesson === lesson && d.type && d.question && d.answer) {
          questions.push({ id: doc.id, type: d.type, question: d.question,
                           answer: d.answer, options: d.options || [] });
        }
      });
    });
    _qsCustomQuestions = questions;
    _renderCustomStep2();
  }).catch(function(e) {
    if (body) body.innerHTML = '<p style="color:var(--red);font-size:.88rem;padding:16px 0">載入題目失敗：' + _qsEsc(e.message) + '</p>';
  });
}

/* ── 步驟 2：頁籤式勾選題目 ── */
function _renderCustomStep2() {
  var body = document.getElementById('qs-custom-body');
  if (!body) return;

  var TYPE_ORDER = ['詞語填空', '詞語解釋', '選擇題'];
  var grouped    = {};
  TYPE_ORDER.forEach(function(t) { grouped[t] = []; });
  _qsCustomQuestions.forEach(function(q) {
    if (grouped[q.type]) grouped[q.type].push(q);
  });

  /* 確定有效頁籤（有題目的題型） */
  var activeTabs = TYPE_ORDER.filter(function(t) { return grouped[t].length > 0; });
  var hasAny     = activeTabs.length > 0;

  /* 預設選第一個有題目的頁籤 */
  if (!_qsCustomActiveTab || !grouped[_qsCustomActiveTab] || !grouped[_qsCustomActiveTab].length) {
    _qsCustomActiveTab = activeTabs[0] || '';
  }

  var html = '';

  /* ── 課次資訊列 ── */
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:6px">';
  html += '<div style="font-size:.82rem;font-weight:800;color:var(--muted)">📚 ' +
    _qsEsc(_qsCustomGrade) + '　第 ' + _qsEsc(_qsCustomLesson) + ' 課　' + _qsEsc(_qsCustomLessonName) + '</div>';
  html += '<div id="qsc-selected-count" style="font-size:.82rem;font-weight:900;color:var(--blue)">已選 0 題</div>';
  html += '</div>';

  if (!hasAny) {
    html += '<p style="color:var(--muted);font-size:.88rem;padding:12px 0">此課次無可用題目，請返回選擇其他課次。</p>';
  } else {
    /* ── 頁籤列 ── */
    html += '<div style="display:flex;border-bottom:2px solid var(--border);margin-bottom:0;gap:0" id="qsc-tab-bar">';
    activeTabs.forEach(function(type) {
      var qs        = grouped[type];
      var selCount  = qs.filter(function(q) { return _qsCustomSelected[q.id]; }).length;
      var isActive  = type === _qsCustomActiveTab;
      var tabStyle  = isActive
        ? 'flex:1;padding:10px 8px;border:none;border-bottom:3px solid var(--blue);background:white;' +
          'font-size:.85rem;font-weight:900;color:var(--blue);cursor:pointer;font-family:inherit;' +
          'border-radius:0;margin-bottom:-2px'
        : 'flex:1;padding:10px 8px;border:none;border-bottom:3px solid transparent;background:var(--gray-lt);' +
          'font-size:.85rem;font-weight:700;color:var(--muted);cursor:pointer;font-family:inherit;' +
          'border-radius:0;margin-bottom:-2px';
      html += '<button id="qsc-tab-' + _qsEsc(type) + '" onclick="_qsCustomSwitchTab(\'' + _qsEsc(type) + '\')" style="' + tabStyle + '">';
      html += _qsEsc(type);
      html += ' <span id="qsc-tab-count-' + _qsEsc(type) + '" style="font-size:.72rem;font-weight:700;' +
        (selCount ? 'color:var(--blue)' : 'color:var(--muted)') + '">' +
        selCount + '／' + qs.length + '</span>';
      html += '</button>';
    });
    html += '</div>';

    /* ── 頁籤內容面板 ── */
    html += '<div id="qsc-tab-panel" style="border:2px solid var(--border);border-top:none;border-radius:0 0 12px 12px;padding:16px;min-height:200px">';
    html += _buildTabPanel(_qsCustomActiveTab, grouped[_qsCustomActiveTab] || []);
    html += '</div>';
  }

  html += '<div id="qsc-step2-error" style="font-size:.82rem;font-weight:700;color:var(--red);min-height:20px;margin-top:12px;margin-bottom:4px"></div>';
  html += '<div style="display:flex;gap:10px;margin-top:4px">';
  html += '<button onclick="_qsCustomBackStep()" style="flex:1;padding:11px;border:2px solid var(--border);border-radius:10px;background:var(--gray-lt);font-size:.9rem;font-weight:800;cursor:pointer;font-family:inherit;color:var(--gray)">← 返回</button>';
  if (hasAny) {
    html += '<button id="btn-create-custom" onclick="createCustomSession()" ' +
      'style="flex:2;padding:11px;border:none;border-radius:10px;background:linear-gradient(135deg,var(--blue),var(--blue-dk));color:white;font-size:.9rem;font-weight:900;cursor:pointer;font-family:inherit">建立自選測驗</button>';
  }
  html += '</div>';

  body.innerHTML = html;
  _qsCustomUpdateSelectedCount();
}

/* 產生單一頁籤的題目清單 HTML */
function _buildTabPanel(type, qs) {
  if (!qs.length) return '<p style="color:var(--muted);font-size:.88rem;padding:8px 0">此題型無題目。</p>';
  var allChecked = qs.every(function(q) { return _qsCustomSelected[q.id]; });
  var html = '';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
  html += '<span style="font-size:.78rem;font-weight:800;color:var(--muted)">共 ' + qs.length + ' 題</span>';
  html += '<button onclick="_qsCustomToggleAll(\'' + _qsEsc(type) + '\')" ' +
    'style="font-size:.75rem;padding:4px 12px;border:1.5px solid var(--border);border-radius:6px;' +
    'background:white;cursor:pointer;font-family:inherit;color:var(--muted);font-weight:800">' +
    (allChecked ? '取消全選' : '全部勾選') + '</button>';
  html += '</div>';
  html += '<div style="display:flex;flex-direction:column;gap:7px">';
  qs.forEach(function(q) {
    var checked  = _qsCustomSelected[q.id] ? ' checked' : '';
    var borderCol = _qsCustomSelected[q.id] ? 'var(--blue)' : 'var(--border)';
    var bgCol     = _qsCustomSelected[q.id] ? 'var(--blue-lt,#eef5fc)' : 'white';
    html += '<label id="qsc-label-' + _qsEsc(q.id) + '" style="display:flex;align-items:flex-start;gap:12px;padding:11px 14px;' +
      'border:2px solid ' + borderCol + ';border-radius:10px;cursor:pointer;background:' + bgCol + ';transition:border-color .12s,background .12s">';
    html += '<input type="checkbox" value="' + _qsEsc(q.id) + '"' + checked +
      ' onchange="_qsCustomToggleQ(\'' + _qsEsc(q.id) + '\',this.checked)"' +
      ' style="margin-top:3px;flex-shrink:0;width:17px;height:17px;accent-color:var(--blue)">';
    html += '<div style="flex:1;min-width:0">';
    html += '<div style="font-size:.92rem;font-weight:700;line-height:1.6;color:var(--text,#1a1a1a)">' + _qsEsc(q.question) + '</div>';
    html += '<div style="font-size:.76rem;color:var(--muted);font-weight:600;margin-top:3px">答：' + _qsEsc(q.answer) + '</div>';
    html += '</div></label>';
  });
  html += '</div>';
  return html;
}

/* 切換頁籤 */
function _qsCustomSwitchTab(type) {
  _qsCustomActiveTab = type;
  var TYPE_ORDER = ['詞語填空', '詞語解釋', '選擇題'];
  var grouped    = {};
  TYPE_ORDER.forEach(function(t) { grouped[t] = []; });
  _qsCustomQuestions.forEach(function(q) {
    if (grouped[q.type]) grouped[q.type].push(q);
  });
  var activeTabs = TYPE_ORDER.filter(function(t) { return grouped[t].length > 0; });

  /* 更新頁籤按鈕樣式 */
  activeTabs.forEach(function(t) {
    var btn = document.getElementById('qsc-tab-' + t);
    if (!btn) return;
    var isActive = t === type;
    btn.style.borderBottom  = isActive ? '3px solid var(--blue)' : '3px solid transparent';
    btn.style.background    = isActive ? 'white' : 'var(--gray-lt)';
    btn.style.color         = isActive ? 'var(--blue)' : 'var(--muted)';
    btn.style.fontWeight    = isActive ? '900' : '700';
  });

  /* 更新面板內容 */
  var panel = document.getElementById('qsc-tab-panel');
  if (panel) panel.innerHTML = _buildTabPanel(type, grouped[type] || []);
}

function _qsCustomToggleQ(id, checked) {
  if (checked) _qsCustomSelected[id] = true;
  else         delete _qsCustomSelected[id];
  /* 更新 label 外框顏色 */
  var label = document.getElementById('qsc-label-' + id);
  if (label) {
    label.style.borderColor = checked ? 'var(--blue)' : 'var(--border)';
    label.style.background  = checked ? 'var(--blue-lt,#eef5fc)' : 'white';
  }
  _qsCustomUpdateSelectedCount();
}

function _qsCustomToggleAll(type) {
  var ofType     = _qsCustomQuestions.filter(function(q) { return q.type === type; });
  var allChecked = ofType.every(function(q) { return _qsCustomSelected[q.id]; });
  ofType.forEach(function(q) {
    if (allChecked) delete _qsCustomSelected[q.id];
    else            _qsCustomSelected[q.id] = true;
  });
  ofType.forEach(function(q) {
    var cb    = document.querySelector('input[value="' + q.id + '"]');
    var label = document.getElementById('qsc-label-' + q.id);
    if (cb) cb.checked = !allChecked;
    if (label) {
      label.style.borderColor = !allChecked ? 'var(--blue)' : 'var(--border)';
      label.style.background  = !allChecked ? 'var(--blue-lt,#eef5fc)' : 'white';
    }
  });
  /* 更新「全部勾選/取消全選」按鈕文字 */
  var panel = document.getElementById('qsc-tab-panel');
  if (panel) {
    var toggleBtn = panel.querySelector('button');
    if (toggleBtn) toggleBtn.textContent = allChecked ? '全部勾選' : '取消全選';
  }
  _qsCustomUpdateSelectedCount();
}

function _qsCustomUpdateSelectedCount() {
  var n     = Object.keys(_qsCustomSelected).length;
  var total = document.getElementById('qsc-selected-count');
  if (total) total.textContent = '已選 ' + n + ' 題';

  /* 同步各頁籤的 N／M 小字 */
  var TYPE_ORDER = ['詞語填空', '詞語解釋', '選擇題'];
  TYPE_ORDER.forEach(function(type) {
    var countEl = document.getElementById('qsc-tab-count-' + type);
    if (!countEl) return;
    var qs       = _qsCustomQuestions.filter(function(q) { return q.type === type; });
    var selCount = qs.filter(function(q) { return _qsCustomSelected[q.id]; }).length;
    countEl.textContent = selCount + '／' + qs.length;
    countEl.style.color = selCount ? 'var(--blue)' : 'var(--muted)';
  });
}

function _qsCustomBackStep() {
  _qsCustomStep = 1;
  var subtitle = document.getElementById('qs-custom-subtitle');
  if (subtitle) subtitle.textContent = '步驟 1／2　設定基本資訊';
  _renderCustomStep1();
}

/* ════════════════════════════════════════
   建立自選測驗（寫入 quizSessions）
   ════════════════════════════════════════ */
function createCustomSession() {
  var selectedIds = Object.keys(_qsCustomSelected);
  var errEl       = document.getElementById('qsc-step2-error');

  if (!selectedIds.length) {
    if (errEl) errEl.textContent = '請至少勾選一道題目';
    return;
  }
  if (errEl) errEl.textContent = '';
  if (!db || !currentTeacher) { showToast('Firebase 未就緒'); return; }

  var btn = document.getElementById('btn-create-custom');
  if (btn) { btn.disabled = true; btn.textContent = '建立中…'; }

  /* 依題型順序排列 questionIds */
  var TYPE_ORDER  = ['詞語填空', '詞語解釋', '選擇題'];
  var questionIds = [];
  TYPE_ORDER.forEach(function(type) {
    _qsCustomQuestions.forEach(function(q) {
      if (q.type === type && _qsCustomSelected[q.id]) questionIds.push(q.id);
    });
  });

  /* 計算各題型數量 */
  var counts = { explain: 0, fillIn: 0, mc: 0 };
  _qsCustomQuestions.forEach(function(q) {
    if (!_qsCustomSelected[q.id]) return;
    if (q.type === '詞語解釋')      counts.explain++;
    else if (q.type === '詞語填空') counts.fillIn++;
    else if (q.type === '選擇題')   counts.mc++;
  });

  function tryCreate() {
    var code = _genCode();
    db.collection('quizSessions')
      .where('code', '==', code)
      .where('active', '==', true)
      .get()
      .then(function(snap) {
        if (!snap.empty) return tryCreate();
        return db.collection('quizSessions').add({
          type:        'custom',
          name:        _qsCustomName,
          code:        code,
          teacherUid:  currentTeacher.uid,
          grade:       _qsCustomGrade,
          lesson:      _qsCustomLesson,
          lessonName:  _qsCustomLessonName,
          questionIds: questionIds,
          counts:      counts,
          createdAt:   new Date().toISOString(),
          active:      true
        });
      })
      .then(function() {
        hideCustomSessionModal();
        showToast('✅ 自選測驗代碼「' + code + '」已建立！');
        loadQuizSessions();
        if (btn) { btn.disabled = false; btn.textContent = '建立自選測驗'; }
      })
      .catch(function(e) {
        showToast('❌ 建立失敗：' + e.message);
        if (btn) { btn.disabled = false; btn.textContent = '建立自選測驗'; }
      });
  }
  tryCreate();
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

  nameEl.textContent   = '《' + sessionName + '》';
  listEl.innerHTML     = '';
  loadEl.style.display = 'block';
  confirmBtn.disabled  = true;
  modal.style.display  = 'flex';

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
