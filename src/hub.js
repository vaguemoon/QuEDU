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
    id: 'chinese', file: 'chinese/index.html',
    icon: '國', name: '練字趣', desc: '國小國字筆順學習',
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
    id: 'multiply', file: 'multiply/index.html',
    icon: '✖️', name: '乘法趣', desc: '0 到 10 的乘法練習',
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
  }
];

var selectedAvatar = '🐣';
var AVATARS = ['🐣','🐱','🐶','🐻','🐼','🦊','🐸','🐧','🦁','🐯','🐨','🐮','🐷','🐙','🦋','🌟','🌈','🎈','🚀','🎯'];

// ── Hub 渲染 ──

function renderHub() {
  if (!currentStudent) return;
  document.getElementById('hub-avatar').textContent = currentStudent.avatar || '🐣';
  document.getElementById('hub-name').textContent   = currentStudent.nickname || currentStudent.name;
  var grid = document.getElementById('subjects-grid');
  grid.style.gridTemplateColumns = SUBJECTS.length === 1 ? '1fr' : '1fr 1fr';
  grid.innerHTML = SUBJECTS.map(function(s) {
    return '<div class="subject-card ' + s.theme + '" onclick="openSubject(\'' + s.id + '\')">' +
      '<span class="subject-icon">' + s.icon + '</span>' +
      '<div class="subject-name">' + s.name + '</div>' +
      '<div class="subject-desc">' + s.desc + '</div>' +
      '<div class="subject-badge ' + s.badgeClass + '" id="badge-' + s.id + '">' + s.badge + '</div></div>';
  }).join('');
  loadSubjectBadges();
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
  sessionStorage.setItem('hub_student', JSON.stringify(currentStudent));
  document.getElementById('subject-frame').src = s.file;
  showPanel('subject');
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

function showProfile() {
  if (!currentStudent) return;
  document.getElementById('profile-nickname').value     = currentStudent.nickname || '';
  document.getElementById('profile-avatar-big').textContent = currentStudent.avatar || '🐣';
  document.getElementById('profile-header-name').textContent = currentStudent.nickname || currentStudent.name;
  selectedAvatar = currentStudent.avatar || '🐣';
  renderAvatarGrid(); _renderHubThemeGrid(); applySoundUI();
  loadStudentClass();
  showPanel('profile');
}

// ── 班級加入 ──

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function loadStudentClass() {
  if (!db || !currentStudent) return;
  var wrap = document.getElementById('class-join-wrap');
  if (!wrap) return;
  db.collection('students').doc(currentStudent.id).get().then(function(doc) {
    var classId = doc.exists ? doc.data().classId : null;
    if (classId) {
      db.collection('classes').doc(classId).get().then(function(cdoc) {
        if (cdoc.exists) {
          var cls = cdoc.data();
          wrap.innerHTML =
            '<div class="class-joined-row">' +
              '<div>' +
                '<div class="class-joined-name">🏫 ' + escHtml(cls.name) + '</div>' +
                '<div class="class-joined-code">邀請碼：' + cls.inviteCode + '</div>' +
              '</div>' +
              '<button class="btn-leave-class" onclick="leaveClass()">離開班級</button>' +
            '</div>';
        } else { renderJoinForm(wrap); }
      }).catch(function() { renderJoinForm(wrap); });
    } else { renderJoinForm(wrap); }
  }).catch(function() { renderJoinForm(wrap); });
}
function renderJoinForm(wrap) {
  wrap.innerHTML =
    '<div class="join-class-row">' +
      '<input id="join-code-input" type="text" placeholder="輸入 6 碼邀請碼" maxlength="6"' +
        ' class="join-code-input"' +
        ' oninput="this.value=this.value.toUpperCase()">' +
      '<button class="btn-join-class" onclick="joinClass()">加入</button>' +
    '</div>' +
    '<div id="join-class-error" class="join-class-error"></div>';
}
function joinClass() {
  var input = document.getElementById('join-code-input');
  var code  = (input ? input.value.trim().toUpperCase() : '');
  var errEl = document.getElementById('join-class-error');
  if (errEl) errEl.textContent = '';
  if (code.length !== 6) { showJoinError('請輸入 6 碼邀請碼'); return; }
  if (!db || !currentStudent) return;
  db.collection('classes').where('inviteCode','==',code).where('active','==',true).get()
    .then(function(snap) {
      if (snap.empty) { showJoinError('找不到這個邀請碼，請確認是否正確或班級已停用'); return; }
      var classId = snap.docs[0].id;
      return db.collection('students').doc(currentStudent.id).set({ classId: classId }, { merge: true })
        .then(function() {
          currentStudent.classId = classId;
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
function leaveClass() {
  if (!confirm('確定要離開目前的班級嗎？')) return;
  if (!db || !currentStudent) return;
  db.collection('students').doc(currentStudent.id)
    .update({ classId: firebase.firestore.FieldValue.delete() })
    .then(function() {
      delete currentStudent.classId;
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
  if (e.data.type === 'hanzi-back-to-hub'    || e.data.type === 'multiply-back-to-hub') returnToHub();
  else if (e.data.type === 'hanzi-logout'   || e.data.type === 'multiply-logout')     doLogout();
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

// ── 系統設定（維護模式 / 公告） ──

function checkSiteSettings() {
  if (!db) { setTimeout(checkSiteSettings, 400); return; }
  db.collection('siteSettings').doc('main').get()
    .then(function(doc) {
      if (!doc.exists) return;
      var data = doc.data();
      if (data.maintenanceMode) {
        var overlay = document.getElementById('maintenance-overlay');
        if (overlay) overlay.style.display = 'flex';
      }
      if (data.announcement && data.announcement.trim()) {
        var banner = document.getElementById('announcement-banner');
        var text   = document.getElementById('announcement-text');
        if (banner && text) {
          text.textContent = data.announcement.trim();
          banner.style.display = 'flex';
        }
      }
    })
    .catch(function() {});
}

// ── 啟動 ──

window.addEventListener('load', function() {
  initFirebase(); applyTheme(currentTheme);
  checkSiteSettings();
  try {
    var saved = sessionStorage.getItem('hub_student');
    if (saved) {
      var student = JSON.parse(saved);
      currentStudent = student; selectedAvatar = student.avatar || '🐣';
      currentPanel = 'login';
      renderHub(); showPanel('hub');
      (function waitDb() { if (!db) { setTimeout(waitDb, 200); return; } loadActivity(); })();
    }
  } catch (e) {}
});
