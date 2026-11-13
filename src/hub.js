/**
 * hub.js — 學習 Hub、科目卡片、個人設定、班級加入、系統設定
 * 依賴：shared.js（db、applyTheme、showToast、THEMES、soundEnabled）
 *        auth.js（currentStudent、showPanel、doLogout）
 */
'use strict';

/* 科目清單：App 的基本資料與學習摘要算法在 shared/apps.js（QU_APPS），新增科目改那裡。
 * 這裡只補 Hub 卡片專用的「等級標籤」：
 *   _SUBJECT_LEVELS[id](sid) → Promise<string>，顯示在卡片下方（例如「練字LV2」「乘法LV3」）
 *   沒有列在這裡的科目，卡片固定顯示 QU_APPS 裡的 badge
 */
function _levelFromStats(statsDoc, fallback) {
  return function(sid) {
    return db.collection('students').doc(sid).collection('stats').doc(statsDoc).get()
      .then(function(doc) {
        return (doc.exists && doc.data().title) ? doc.data().title : fallback;
      }).catch(function() { return fallback; });
  };
}
function _levelFromLastScore(appId, fallback) {
  // 讀最近一次測驗的分數當作標籤
  return function(sid) {
    return db.collection('students').doc(sid).collection('activities')
      .where('app', '==', appId)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get()
      .then(function(snap) {
        if (snap.empty) return fallback;
        return '最近 ' + snap.docs[0].data().score + ' 分';
      })
      .catch(function() { return fallback; });
  };
}
function _levelFromProgress(progressDoc, fallback, toLevel) {
  return function(sid) {
    return db.collection('students').doc(sid).collection('progress').doc(progressDoc).get()
      .then(function(doc) { return doc.exists ? toLevel(doc.data()) : fallback; })
      .catch(function() { return fallback; });
  };
}

var _SUBJECT_LEVELS = {
  // 等級：讀自各 App 成就系統寫入的 stats/*.title
  'chinese':  _levelFromStats('profile',         '練字LV1'),
  'convert':  _levelFromStats('convertProfile',  '換算LV1'),
  'multiply': _levelFromStats('multiplyProfile', '乘法LV1'),
  'word-image': _levelFromProgress('wordImage', '詞語趣', function(d) {
    var words = d.words || {};
    var mastered = Object.keys(words).filter(function(k) {
      var w = words[k];
      return w.correct > 0 && w.correct >= w.wrong;
    }).length;
    if (mastered >= 50) return '詞語LV4';
    if (mastered >= 20) return '詞語LV3';
    if (mastered >= 5)  return '詞語LV2';
    return '詞語LV1';
  }),
  'recognize': _levelFromProgress('recognize', '認字LV1', function(d) {
    var m = _quCountMastered(d.charStatus) + _quCountMastered(d.wordStatus);
    if (m >= 100) return '認字LV5';
    if (m >= 50)  return '認字LV4';
    if (m >= 20)  return '認字LV3';
    if (m >= 5)   return '認字LV2';
    return '認字LV1';
  }),
  'radical': _levelFromProgress('radical', '部件LV1', function(d) {
    var m = _quCountMastered(d.radicalStatus);
    if (m >= 30) return '部件LV5';
    if (m >= 15) return '部件LV4';
    if (m >= 8)  return '部件LV3';
    if (m >= 3)  return '部件LV2';
    return '部件LV1';
  }),
  'math-quiz':    _levelFromLastScore('math-quiz',    '數學測驗'),
  'chinese-quiz': _levelFromLastScore('chinese-quiz', '語文測驗'),
  'english-quiz': _levelFromLastScore('english-quiz', '英文測驗')
};

var SUBJECTS = QU_APPS.map(function(app) {
  var s = Object.assign({}, app);
  s.getLevel = _SUBJECT_LEVELS[app.id] || function() { return Promise.resolve(app.badge); };
  // 近期記錄：沒有摘要文字的（只知道用過）不列出
  s.activity = function(sid) {
    return quAppSummary(app, sid, db).then(function(r) { return (r && r.sub) ? r : null; });
  };
  return s;
});

var selectedAvatar = '🐣';
var AVATARS = ['🐣','🐱','🐶','🐻','🐼','🦊','🐸','🐧','🦁','🐯','🐨','🐮','🐷','🐙','🦋','🌟','🌈','🎈','🚀','🎯'];

var _HUB_BACK_TYPES   = quAppBackTypes();
var _HUB_LOGOUT_TYPES = quAppLogoutTypes();

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

  var bAvatar = document.getElementById('hub-bottom-avatar');
  var bName   = document.getElementById('hub-bottom-name');
  if (bAvatar) bAvatar.textContent = currentStudent.avatar || '🐣';
  if (bName) {
    var nm = currentStudent.nickname || currentStudent.name || '';
    bName.textContent = nm.length > 5 ? nm.slice(0, 5) + '…' : (nm || '個人');
  }

  var learnSubjects = SUBJECTS.filter(function(s) { return s.type !== 'quiz'; });
  var quizSubjects  = SUBJECTS.filter(function(s) { return s.type === 'quiz'; });

  // 學習區分國語／英文／數學三個區塊，各自一整排（欄數與卡片寬度交給 .subjects-grid 的 CSS 控制）
  var learnGrid = document.getElementById('subjects-grid');
  var groups = [
    { key: 'chinese', label: '📖 國語' },
    { key: 'english', label: '🌐 英文' },
    { key: 'math',    label: '🔢 數學' },
    { key: 'special', label: '🎯 特需' }
  ];
  learnGrid.innerHTML = groups.map(function(g) {
    var subs = learnSubjects.filter(function(s) { return s.category === g.key; });
    if (!subs.length) return '';
    return '<div class="hub-subject-group">' +
      '<div class="hub-group-title">' + g.label + '</div>' +
      '<div class="subjects-grid">' +
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
  if (!currentStudent) return;
  var nickname = document.getElementById('profile-nickname').value.trim();
  currentStudent.nickname = nickname;
  currentStudent.avatar   = selectedAvatar;
  sessionStorage.setItem('hub_student', JSON.stringify(currentStudent));
  if (currentStudent.isGuest || !db) {
    showToast('✅ 已儲存（訪客模式，重新整理後重置）');
    renderHub(); showPanel('hub'); return;
  }
  db.collection('students').doc(currentStudent.id)
    .set({ nickname: nickname, avatar: selectedAvatar }, { merge: true })
    .then(function() { showToast('✅ 已儲存！'); renderHub(); showPanel('hub'); })
    .catch(function() { showToast('儲存失敗，請重試'); });
}

// ── 修改 PIN 碼 ──

function changePIN() {
  if (!currentStudent || currentStudent.isGuest || !db) {
    showToast('訪客模式無法修改 PIN');
    return;
  }
  var oldPin  = (document.getElementById('pin-old').value  || '').trim();
  var newPin1 = (document.getElementById('pin-new1').value || '').trim();
  var newPin2 = (document.getElementById('pin-new2').value || '').trim();
  var status  = document.getElementById('pin-change-status');

  if (oldPin.length !== 4 || newPin1.length !== 4 || newPin2.length !== 4) {
    status.style.color = 'var(--red)';
    status.textContent = 'PIN 碼必須是 4 位數字';
    return;
  }
  if (!/^\d{4}$/.test(oldPin) || !/^\d{4}$/.test(newPin1)) {
    status.style.color = 'var(--red)';
    status.textContent = '請只輸入數字';
    return;
  }
  if (newPin1 !== newPin2) {
    status.style.color = 'var(--red)';
    status.textContent = '兩次新 PIN 碼不一致';
    return;
  }
  if (oldPin !== currentStudent.pin) {
    status.style.color = 'var(--red)';
    status.textContent = '目前 PIN 碼不正確';
    return;
  }
  status.style.color = 'var(--muted)';
  status.textContent = '儲存中…';

  db.collection('students').doc(currentStudent.id)
    .update({ pin: newPin1 })
    .then(function() {
      currentStudent.pin = newPin1;
      sessionStorage.setItem('hub_student', JSON.stringify(currentStudent));
      document.getElementById('pin-old').value  = '';
      document.getElementById('pin-new1').value = '';
      document.getElementById('pin-new2').value = '';
      status.style.color = 'var(--green)';
      status.textContent = '✅ PIN 碼已更新';
    })
    .catch(function(e) {
      status.style.color = 'var(--red)';
      status.textContent = '更新失敗：' + e.message;
    });
}

// ── 老師公告 / 班級任務 ──

var _hubTasksClasses   = [];
var _hubCompletedTasks = {};

function loadHubTasks() {
  if (!db || !currentStudent || currentStudent.isGuest) return;
  var ids = currentStudent.classIds || [];
  if (ids.length) {
    _doLoadHubTasks(ids);
  } else {
    db.collection('students').doc(currentStudent.id).get()
      .then(function(doc) {
        var d = doc.exists ? doc.data() : {};
        var fetched = d.classIds || (d.classId ? [d.classId] : []);
        currentStudent.classIds = fetched;
        sessionStorage.setItem('hub_student', JSON.stringify(currentStudent));
        _doLoadHubTasks(fetched);
      }).catch(function() {});
  }
}

function _doLoadHubTasks(classIds) {
  if (!classIds.length) return;
  Promise.all([
    Promise.all(classIds.map(function(cid) {
      return db.collection('classes').doc(cid).get()
        .then(function(doc) {
          if (!doc.exists) return null;
          var d = doc.data();
          return { id: cid, name: d.name || '', tasks: d.tasks || [] };
        }).catch(function() { return null; });
    })),
    db.collection('students').doc(currentStudent.id).get()
  ]).then(function(res) {
    _hubTasksClasses   = res[0].filter(function(r) { return r && r.tasks.length; });
    _hubCompletedTasks = (res[1].exists ? res[1].data().completedTasks : null) || {};
    if (_hubTasksClasses.length) {
      var section = document.getElementById('hub-tasks-section');
      if (section) section.style.display = '';
      renderHubTasks();
    }
  }).catch(function() {});
}

function renderHubTasks() {
  var wrap = document.getElementById('hub-tasks-wrap');
  if (!wrap) return;
  wrap.innerHTML = _hubTasksClasses.map(function(cls) {
    return '<div class="hub-task-group">' +
      '<div class="hub-task-class">' + escHtml(cls.name) + '</div>' +
      cls.tasks.map(function(t) {
        var done = !!_hubCompletedTasks[t.id];
        var eid = t.id.replace(/['"]/g, '');
        return '<div class="hub-task-row' + (done ? ' hub-task-done' : '') +
          '" onclick="toggleHubTask(\'' + eid + '\')">' +
          '<div class="hub-task-check">' + (done ? '✅' : '⬜') + '</div>' +
          '<div class="hub-task-text">' + escHtml(t.text) + '</div>' +
          '</div>';
      }).join('') +
      '</div>';
  }).join('');
}

function toggleHubTask(taskId) {
  if (!currentStudent || currentStudent.isGuest || !db) return;
  var newVal = !_hubCompletedTasks[taskId];
  if (newVal) { _hubCompletedTasks[taskId] = true; } else { delete _hubCompletedTasks[taskId]; }
  renderHubTasks();
  db.collection('students').doc(currentStudent.id).set(
    { completedTasks: _hubCompletedTasks }, { merge: true }
  ).catch(function(e) {
    if (newVal) { delete _hubCompletedTasks[taskId]; } else { _hubCompletedTasks[taskId] = true; }
    renderHubTasks();
    showToast('儲存失敗：' + e.message);
  });
}

// ── 接收 iframe 訊息 ──

window.addEventListener('message', function(e) {
  if (!e.data) return;
  if (_HUB_BACK_TYPES.indexOf(e.data.type) !== -1) returnToHub();
  else if (_HUB_LOGOUT_TYPES.indexOf(e.data.type) !== -1) doLogout();
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

  if (currentStudent.isPreview) {
    var logoutBtn = document.querySelector('.btn-logout-hub');
    if (logoutBtn) logoutBtn.textContent = '← 退出預覽';
    var overlayTitle = document.querySelector('#logout-overlay .overlay-title');
    var overlaySub   = document.querySelector('#logout-overlay .overlay-sub');
    var overlayConfirm = document.querySelector('#logout-overlay .btn-confirm');
    if (overlayTitle)   overlayTitle.textContent  = '要退出預覽嗎？';
    if (overlaySub)     overlaySub.textContent    = '將返回教師後台。';
    if (overlayConfirm) overlayConfirm.textContent = '退出預覽';
    var pinSection = document.getElementById('pin-change-section');
    if (pinSection) pinSection.style.display = 'none';
    (function waitDb() { if (!db) { setTimeout(waitDb, 200); return; } loadActivity(); loadHubTasks(); })();
    return;
  }

  if (currentStudent.isGuest) {
    /* 訪客：隱藏 PIN 修改與班級管理，不載入 Firestore 資料 */
    var pinSection = document.getElementById('pin-change-section');
    if (pinSection) pinSection.style.display = 'none';
    var classWrap = document.getElementById('class-join-wrap');
    if (classWrap) classWrap.innerHTML =
      '<div style="color:var(--muted);font-size:.85rem;font-weight:600">訪客模式不支援班級功能。</div>';
    return;
  }

  (function waitDb() { if (!db) { setTimeout(waitDb, 200); return; } loadActivity(); loadHubTasks(); })();
});
