/**
 * hub.js — 學習 Hub、科目卡片、個人設定、班級加入、系統設定
 * 依賴：shared.js（db、applyTheme、showToast、THEMES、soundEnabled）
 *        auth.js（currentStudent、showPanel、doLogout）
 */
'use strict';

/* 科目清單：新增科目只改這裡
 *
 * 設計準則：每個科目必須實作 getLevel(sid) → Promise<string>
 *   - 回傳顯示在卡片下方的等級標籤（例如「練字LV2」「乘法LV3」）
 *   - 若尚無進度，回傳預設等級字串（例如「乘法LV1」）
 *   - badgeClass 決定標籤顏色（'green' / 'orange' / 'blue' …）
 */
var SUBJECTS = [
  {
    id: 'chinese', file: 'apps/learn/lang/chinese/index.html',
    icon: '國', name: '練字趣', desc: '國小國字筆順學習',
    type: 'learn', category: 'chinese',
    theme: 'theme-blue', badge: '練字LV1', badgeClass: 'green',
    // 等級：讀自練字趣成就系統寫入的 stats/profile.title
    getLevel: function(sid) {
      return db.collection('students').doc(sid).collection('stats').doc('profile').get()
        .then(function(doc) {
          return (doc.exists && doc.data().title) ? doc.data().title : '練字LV1';
        });
    },
    activity: function(sid) {
      return db.collection('students').doc(sid).collection('progress').doc('hanzi').get()
        .then(function(doc) {
          if (!doc.exists) return null;
          var cs = doc.data().charStatus || {};
          var m  = Object.values(cs).filter(function(v) { return v === 'mastered'; }).length;
          return m ? { sub: '通過測驗 ' + m + ' 字', score: m + ' 字' } : null;
        });
    }
  },
  {
    id: 'convert', file: 'apps/learn/math/convert/index.html',
    icon: '↔', name: '換算趣', desc: '各種單位換算',
    type: 'learn', category: 'math',
    theme: 'theme-green', badge: '換算LV1', badgeClass: 'green',
    getLevel: function(sid) {
      return db.collection('students').doc(sid).collection('stats').doc('convertProfile').get()
        .then(function(doc) {
          return (doc.exists && doc.data().title) ? doc.data().title : '換算LV1';
        }).catch(function() { return '換算LV1'; });
    },
    activity: function(sid) {
      return db.collection('students').doc(sid).collection('progress').doc('convert').get()
        .then(function(doc) {
          if (!doc.exists) return null;
          var c = doc.data().totalCorrect || 0;
          return c ? { sub: '累計答對 ' + c + ' 題', score: c + ' 題' } : null;
        });
    }
  },
  {
    id: 'multiply', file: 'apps/learn/math/multiply/index.html',
    icon: '✖️', name: '乘法趣', desc: '0 到 10 的乘法練習',
    type: 'learn', category: 'math',
    theme: 'theme-orange', badge: '乘法LV1', badgeClass: 'green',
    // 等級：讀自乘法趣成就系統寫入的 stats/multiplyProfile.title
    getLevel: function(sid) {
      return db.collection('students').doc(sid).collection('stats').doc('multiplyProfile').get()
        .then(function(doc) {
          return (doc.exists && doc.data().title) ? doc.data().title : '乘法LV1';
        });
    },
    activity: function(sid) {
      return db.collection('students').doc(sid).collection('progress').doc('multiply').get()
        .then(function(doc) {
          if (!doc.exists) return null;
          var d = doc.data();
          var c = d.totalCorrect || 0;
          return c ? { sub: '累計答對 ' + c + ' 題', score: c + ' 題' } : null;
        });
    }
  },
  {
    id: 'exam-reader', file: 'apps/quiz/word-to-reader/index.html',
    icon: '🎧', name: '考卷報讀', desc: '老師分享的有聲考卷',
    type: 'quiz', studentMode: true,
    theme: 'theme-teal', badge: '考卷報讀', badgeClass: 'green',
    getLevel: function() { return Promise.resolve('考卷報讀'); },
    activity: function(sid) {
      return db.collection('students').doc(sid).collection('activities')
        .where('app', '==', 'exam-reader')
        .get()
        .then(function(snap) {
          if (snap.empty) return null;
          return { sub: '已使用 ' + snap.size + ' 次', score: snap.size + ' 次' };
        });
    }
  },
  {
    id: 'recognize', file: 'apps/learn/lang/recognize/index.html',
    icon: '🔊', name: '認字趣', desc: '聽音辨字・選字選詞',
    type: 'learn', category: 'chinese',
    theme: 'theme-teal', badge: '認字LV1', badgeClass: 'green',
    getLevel: function(sid) {
      return db.collection('students').doc(sid).collection('progress').doc('recognize').get()
        .then(function(doc) {
          if (!doc.exists) return '認字LV1';
          var cs = doc.data().charStatus || {};
          var ws = doc.data().wordStatus || {};
          var m = Object.values(cs).concat(Object.values(ws)).filter(function(v){ return v === 'mastered'; }).length;
          if (m >= 100) return '認字LV5';
          if (m >= 50)  return '認字LV4';
          if (m >= 20)  return '認字LV3';
          if (m >= 5)   return '認字LV2';
          return '認字LV1';
        }).catch(function(){ return '認字LV1'; });
    },
    activity: function(sid) {
      return db.collection('students').doc(sid).collection('progress').doc('recognize').get()
        .then(function(doc) {
          if (!doc.exists) return null;
          var cs = doc.data().charStatus || {};
          var ws = doc.data().wordStatus || {};
          var m = Object.values(cs).concat(Object.values(ws)).filter(function(v){ return v === 'mastered'; }).length;
          return m ? { sub: '精熟 ' + m + ' 字詞', score: m + ' 字詞' } : null;
        });
    }
  },
  {
    id: 'math-quiz', file: 'apps/quiz/math-quiz/index.html',
    icon: '🔢', name: '數學測驗', desc: '四則運算練習測驗',
    type: 'quiz', studentMode: true,
    theme: 'theme-green', badge: '數學測驗', badgeClass: 'green',
    getLevel: function(sid) {
      return db.collection('students').doc(sid).collection('activities')
        .where('app', '==', 'math-quiz')
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get()
        .then(function(snap) {
          if (snap.empty) return '數學測驗';
          var d = snap.docs[0].data();
          return '最近 ' + d.score + ' 分';
        })
        .catch(function() { return '數學測驗'; });
    },
    activity: function(sid) {
      return db.collection('students').doc(sid).collection('activities')
        .where('app', '==', 'math-quiz')
        .get()
        .then(function(snap) {
          if (snap.empty) return null;
          return { sub: '已完成 ' + snap.size + ' 次練習', score: snap.size + ' 次' };
        });
    }
  },
  {
    id: 'chinese-quiz', file: 'apps/quiz/chinese-quiz/index.html',
    icon: '📝', name: '語文測驗', desc: '詞語填空與選擇題練習',
    type: 'quiz', studentMode: true,
    theme: 'theme-purple', badge: '語文測驗', badgeClass: 'blue',
    getLevel: function(sid) {
      // 讀最近一次語文測驗的分數當作標籤
      return db.collection('students').doc(sid).collection('activities')
        .where('app', '==', 'chinese-quiz')
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get()
        .then(function(snap) {
          if (snap.empty) return '語文測驗';
          var d = snap.docs[0].data();
          return '最近 ' + d.score + ' 分';
        })
        .catch(function() { return '語文測驗'; });
    },
    activity: function(sid) {
      return db.collection('students').doc(sid).collection('activities')
        .where('app', '==', 'chinese-quiz')
        .get()
        .then(function(snap) {
          if (snap.empty) return null;
          var total = snap.size;
          return { sub: '已完成 ' + total + ' 次練習', score: total + ' 次' };
        });
    }
  }
];

var selectedAvatar = '🐣';
var AVATARS = ['🐣','🐱','🐶','🐻','🐼','🦊','🐸','🐧','🦁','🐯','🐨','🐮','🐷','🐙','🦋','🌟','🌈','🎈','🚀','🎯'];

// ── Hub 渲染 ──

function _renderSubjectCards(subjects) {
  return subjects.map(function(s) {
    return '<div class="subject-card ' + s.theme + '" onclick="openSubject(\'' + s.id + '\')">' +
      '<span class="subject-icon">' + s.icon + '</span>' +
      '<div class="subject-name">' + s.name + '</div>' +
      '<div class="subject-desc">' + s.desc + '</div>' +
      '<div class="subject-badge ' + s.badgeClass + '" id="badge-' + s.id + '">' + s.badge + '</div></div>';
  }).join('');
}

function renderHub() {
  if (!currentStudent) return;
  document.getElementById('hub-avatar').textContent = currentStudent.avatar || '🐣';
  document.getElementById('hub-name').textContent   = currentStudent.nickname || currentStudent.name;

  var learnSubjects = SUBJECTS.filter(function(s) { return s.type !== 'quiz'; });
  var quizSubjects  = SUBJECTS.filter(function(s) { return s.type === 'quiz'; });

  // 學習區分國語／數學兩個區塊
  var learnGrid = document.getElementById('subjects-grid');
  learnGrid.style.gridTemplateColumns = ''; // 由子 grid 自行控制
  var groups = [
    { key: 'chinese', label: '📖 國語' },
    { key: 'math',    label: '🔢 數學' }
  ];
  learnGrid.innerHTML = groups.map(function(g) {
    var subs = learnSubjects.filter(function(s) { return s.category === g.key; });
    if (!subs.length) return '';
    return '<div class="hub-subject-group">' +
      '<div class="hub-group-title">' + g.label + '</div>' +
      '<div class="subjects-grid" style="grid-template-columns:repeat(2,1fr)">' +
      _renderSubjectCards(subs) + '</div></div>';
  }).join('');

  var quizGrid = document.getElementById('quiz-grid');
  quizGrid.style.gridTemplateColumns = quizSubjects.length === 1 ? '1fr' : '1fr 1fr';
  quizGrid.innerHTML = _renderSubjectCards(quizSubjects);

  loadSubjectBadges();
}

function switchHubTab(tab) {
  ['learn', 'quiz', 'profile'].forEach(function(t) {
    var panel  = document.getElementById('hub-panel-' + t);
    var tabBtn = document.getElementById('hub-tab-' + t);
    var btmBtn = document.getElementById('hub-bottom-' + t);
    var active = t === tab;
    if (panel)  panel.classList.toggle('active', active);
    if (tabBtn) tabBtn.classList.toggle('active', active);
    if (btmBtn) btmBtn.classList.toggle('active', active);
  });
  if (tab === 'profile') _populateProfilePanel();
}

function loadSubjectBadges() {
  if (!currentStudent || !db) return;
  SUBJECTS.forEach(function(s) {
    if (typeof s.getLevel !== 'function') return;
    s.getLevel(currentStudent.id).then(function(label) {
      var el = document.getElementById('badge-' + s.id);
      if (el && label) el.textContent = label;
    }).catch(function() {});
  });
}

// ── 子項目 iframe ──

function openSubject(id) {
  var s = SUBJECTS.find(function(x) { return x.id === id; });
  if (!s || !currentStudent) return;
  var ids = currentStudent.classIds || [];
  if (s.studentMode && !ids.length) {
    /* classIds 可能因舊 session 未載入，先從 Firestore 補抓 */
    if (db) {
      db.collection('students').doc(currentStudent.id).get().then(function(doc) {
        var d = doc.exists ? doc.data() : {};
        var fetched = d.classIds || (d.classId ? [d.classId] : []);
        if (fetched.length) {
          currentStudent.classIds = fetched;
          sessionStorage.setItem('hub_student', JSON.stringify(currentStudent));
          openSubject(id);
        } else {
          showToast('請先在個人設定中加入班級');
        }
      }).catch(function() { showToast('請先在個人設定中加入班級'); });
    } else {
      showToast('請先在個人設定中加入班級');
    }
    return;
  }
  sessionStorage.setItem('hub_student', JSON.stringify(currentStudent));
  /* Load the iframe AFTER the panel slide animation finishes (370 ms).
     Loading it simultaneously caused the iframe layout to interrupt the
     CSS transition, leaving the screen stuck in a half-slid state. */
  document.getElementById('subject-frame').src = 'about:blank';
  showPanel('subject');
  setTimeout(function() {
    var url = s.file;
    if (s.studentMode && ids.length) {
      url += '?mode=student&classIds=' + encodeURIComponent(ids.join(','));
    }
    document.getElementById('subject-frame').src = url;
  }, 380);
}
function returnToHub() {
  var frame = document.getElementById('subject-frame');
  if (frame) frame.src = 'about:blank';
  showPanel('hub'); loadActivity();
}

// ── 近期記錄 ──

function loadActivity() {
  if (!db || !currentStudent) return;
  var list = document.getElementById('activity-list');
  if (!list) return;
  list.innerHTML = '<div class="activity-empty">載入中…</div>';
  Promise.all(SUBJECTS.map(function(s) {
    return s.activity(currentStudent.id)
      .then(function(r) { return r ? { icon: s.icon, name: s.name, sub: r.sub, score: r.score } : null; })
      .catch(function() { return null; });
  })).then(function(results) {
    var valid = results.filter(Boolean);
    list.innerHTML = valid.length
      ? valid.map(function(a) {
          return '<div class="activity-row"><div class="activity-icon">' + a.icon + '</div>' +
            '<div class="activity-info"><div class="activity-title">' + a.name + '</div>' +
            '<div class="activity-sub">' + a.sub + '</div></div>' +
            '<div class="activity-score">' + a.score + '</div></div>';
        }).join('')
      : '<div class="activity-empty">還沒有學習記錄，快去練習吧！🚀</div>';
  });
}

// ── 個人設定 ──

function _populateProfilePanel() {
  if (!currentStudent) return;
  document.getElementById('profile-nickname').value          = currentStudent.nickname || '';
  document.getElementById('profile-avatar-big').textContent = currentStudent.avatar || '🐣';
  selectedAvatar = currentStudent.avatar || '🐣';
  renderAvatarGrid(); _renderHubThemeGrid(); applySoundUI();
  loadStudentClass();
}

function showProfile() {
  switchHubTab('profile');
}

// ── 班級加入（支援複數班級） ──

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function loadStudentClass() {
  if (!db || !currentStudent) return;
  var wrap = document.getElementById('class-join-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div style="color:var(--muted);font-size:.85rem;font-weight:600">載入中…</div>';

  db.collection('students').doc(currentStudent.id).get().then(function(doc) {
    var d = doc.exists ? doc.data() : {};
    var ids = d.classIds || (d.classId ? [d.classId] : []);
    currentStudent.classIds = ids;
    sessionStorage.setItem('hub_student', JSON.stringify(currentStudent));

    if (!ids.length) { _renderJoinUI(wrap, []); return; }

    Promise.all(ids.map(function(cid) {
      return db.collection('classes').doc(cid).get()
        .then(function(cdoc) { return cdoc.exists ? { id: cid, data: cdoc.data() } : null; })
        .catch(function() { return null; });
    })).then(function(results) {
      _renderJoinUI(wrap, results.filter(Boolean));
    });
  }).catch(function() { _renderJoinUI(wrap, []); });
}

function _renderJoinUI(wrap, classes) {
  var html = '';
  classes.forEach(function(cls) {
    html +=
      '<div class="class-joined-row">' +
        '<div>' +
          '<div class="class-joined-name">🏫 ' + escHtml(cls.data.name) + '</div>' +
          '<div class="class-joined-code">邀請碼：' + escHtml(cls.data.inviteCode) + '</div>' +
        '</div>' +
        '<button class="btn-leave-class" onclick="leaveClass(\'' + cls.id + '\')">離開</button>' +
      '</div>';
  });
  html +=
    '<div class="join-class-row" style="margin-top:' + (classes.length ? '12px' : '0') + '">' +
      '<input id="join-code-input" type="text" placeholder="輸入 6 碼邀請碼" maxlength="6"' +
        ' class="join-code-input" oninput="this.value=this.value.toUpperCase()">' +
      '<button class="btn-join-class" onclick="joinClass()">加入</button>' +
    '</div>' +
    '<div id="join-class-error" class="join-class-error"></div>';
  wrap.innerHTML = html;
}

function joinClass() {
  var input = document.getElementById('join-code-input');
  var code  = (input ? input.value.trim().toUpperCase() : '');
  if (code.length !== 6) { showJoinError('請輸入 6 碼邀請碼'); return; }
  if (!db || !currentStudent) return;
  var existing = currentStudent.classIds || [];
  db.collection('classes').where('inviteCode','==',code).where('active','==',true).get()
    .then(function(snap) {
      if (snap.empty) { showJoinError('找不到這個邀請碼，請確認是否正確或班級已停用'); return; }
      var classId = snap.docs[0].id;
      if (existing.indexOf(classId) !== -1) { showJoinError('你已經在這個班級了'); return; }
      return db.collection('students').doc(currentStudent.id)
        .update({ classIds: firebase.firestore.FieldValue.arrayUnion(classId) })
        .then(function() {
          currentStudent.classIds = existing.concat([classId]);
          sessionStorage.setItem('hub_student', JSON.stringify(currentStudent));
          showToast('✅ 已加入班級！');
          loadStudentClass();
        });
    })
    .catch(function(e) { showJoinError('加入失敗：' + e.message); });
}

function showJoinError(msg) {
  var el = document.getElementById('join-class-error');
  if (el) el.textContent = msg;
}

function leaveClass(classId) {
  if (!confirm('確定要離開這個班級嗎？')) return;
  if (!db || !currentStudent) return;
  db.collection('students').doc(currentStudent.id)
    .update({ classIds: firebase.firestore.FieldValue.arrayRemove(classId) })
    .then(function() {
      currentStudent.classIds = (currentStudent.classIds || []).filter(function(id) { return id !== classId; });
      sessionStorage.setItem('hub_student', JSON.stringify(currentStudent));
      showToast('已離開班級');
      loadStudentClass();
    })
    .catch(function(e) { showToast('操作失敗：' + e.message); });
}

// ── 頭像選擇 ──

function renderAvatarGrid() {
  document.getElementById('avatar-grid').innerHTML = AVATARS.map(function(av) {
    return '<button class="avatar-btn' + (av === selectedAvatar ? ' selected' : '') +
      '" onclick="selectAvatar(\'' + av + '\')">' + av + '</button>';
  }).join('');
}
function selectAvatar(av) {
  selectedAvatar = av;
  document.getElementById('profile-avatar-big').textContent = av;
  renderAvatarGrid();
}

// ── 主題選擇（Hub 用） ──

function _renderHubThemeGrid() {
  var cur = localStorage.getItem('theme') || 'blue';
  document.getElementById('theme-grid').innerHTML = THEMES.map(function(t) {
    return '<button class="theme-btn' + (t.id === cur ? ' selected' : '') +
      '" style="background:' + t.bg + ';color:' + t.blueDk + '" onclick="selectTheme(\'' + t.id + '\')">' + t.name + '</button>';
  }).join('');
}
function selectTheme(id) { applyTheme(id); _renderHubThemeGrid(); }

// ── 音效開關 UI ──

function applySoundUI() {
  var on  = soundEnabled;
  var btn  = document.getElementById('sound-toggle');
  var knob = document.getElementById('sound-knob');
  if (!btn) return;
  btn.style.background = on ? 'var(--blue)' : '#ccc';
  knob.style.left = on ? '27px' : '3px';
}
function toggleSoundUI() {
  soundEnabled = !soundEnabled;
  localStorage.setItem('soundEnabled', soundEnabled);
  applySoundUI();
}

// ── 儲存個人設定 ──

function saveProfile() {
  if (!currentStudent || !db) return;
  var nickname = document.getElementById('profile-nickname').value.trim();
  currentStudent.nickname = nickname;
  currentStudent.avatar   = selectedAvatar;
  sessionStorage.setItem('hub_student', JSON.stringify(currentStudent));
  db.collection('students').doc(currentStudent.id)
    .set({ nickname: nickname, avatar: selectedAvatar }, { merge: true })
    .then(function() { showToast('✅ 已儲存！'); renderHub(); showPanel('hub'); })
    .catch(function() { showToast('儲存失敗，請重試'); });
}

// ── 接收 iframe 訊息 ──

window.addEventListener('message', function(e) {
  if (!e.data) return;
  if (e.data.type === 'hanzi-back-to-hub' || e.data.type === 'multiply-back-to-hub' || e.data.type === 'chinese-quiz-back-to-hub' || e.data.type === 'math-quiz-back-to-hub' || e.data.type === 'exam-reader-back-to-hub' || e.data.type === 'recognize-back-to-hub' || e.data.type === 'convert-back-to-hub') returnToHub();
  else if (e.data.type === 'hanzi-logout' || e.data.type === 'multiply-logout' || e.data.type === 'recognize-logout') doLogout();
});

// ── 管理者隱藏入口：連點學校名稱 5 次 ──

(function() {
  var taps = 0, timer = null;
  document.addEventListener('click', function(e) {
    if (!e.target || e.target.id !== 'school-name-tap') { taps = 0; return; }
    taps++;
    clearTimeout(timer);
    if (taps >= 5) { taps = 0; window.location.href = 'super-admin/login.html'; return; }
    timer = setTimeout(function() { taps = 0; }, 1500);
  });
})();

// ── 啟動 ──

window.addEventListener('load', function() {
  var saved = sessionStorage.getItem('hub_student');
  if (!saved) { window.location.href = 'login.html'; return; }
  try {
    var student = JSON.parse(saved);
    currentStudent = student;
    selectedAvatar = student.avatar || '🐣';
  } catch(e) { window.location.href = 'login.html'; return; }

  currentPanel = 'hub';
  renderHub();

  var welcome = sessionStorage.getItem('hub_welcome');
  if (welcome) {
    sessionStorage.removeItem('hub_welcome');
    setTimeout(function() { showToast(welcome); }, 200);
  }

  (function waitDb() { if (!db) { setTimeout(waitDb, 200); return; } loadActivity(); })();
});
