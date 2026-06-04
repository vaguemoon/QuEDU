/**
 * admin/init.js — 後台初始化、登出、分頁切換
 * 依賴：shared.js（initFirebase、db、auth、showToast）
 */
'use strict';

var currentTeacher     = null; // Firebase Auth User 物件
var currentTeacherRole = 'teacher'; // 'teacher' | 'school-admin'

/* ── 暗色模式 ── */
(function() {
  if (localStorage.getItem('admin-dark') === '1') {
    document.body.classList.add('dark');
  }
})();

function toggleDarkMode() {
  var isDark = document.body.classList.toggle('dark');
  localStorage.setItem('admin-dark', isDark ? '1' : '0');
  var btn = document.getElementById('dark-mode-btn');
  if (btn) btn.textContent = isDark ? '☀️ 亮色模式' : '🌙 暗色模式';
  var frame = document.getElementById('tool-modal-frame');
  if (frame && frame.contentWindow) {
    frame.contentWindow.postMessage({ type: 'admin-dark', dark: isDark }, '*');
  }
}

/* ── 子 APP 登錄表（新增 APP 時只需在此加一筆）── */
var APP_REGISTRY = [
  { id: 'chinese',      label: '識字趣', icon: '📖', color: 'var(--blue)',   progress: 'hanzi'    },
  { id: 'multiply',     label: '乘法趣', icon: '✖️',  color: 'var(--green)',  progress: 'multiply' },
  { id: 'chinese-quiz', label: '語文測驗', icon: '📝', color: 'var(--orange)', progress: null       }
];

function onFirebaseReady() {
  loadClasses();
  loadTeacherSchool();
  _applyTeacherRole(currentTeacherRole);
}

function _applyTeacherRole(role) {
  var tab = document.getElementById('tab-school-admin');
  if (tab) tab.style.display = role === 'school-admin' ? '' : 'none';
}

/* ── 教師資料快取（sessionStorage，當次瀏覽器工作階段有效）── */
function _saveTeacherCache(uid, schoolId, schoolName, role) {
  try {
    sessionStorage.setItem('admin_tc', JSON.stringify({
      uid: uid, schoolId: schoolId, schoolName: schoolName, role: role
    }));
  } catch(e) {}
}
function _loadTeacherCache(uid) {
  try {
    var c = JSON.parse(sessionStorage.getItem('admin_tc'));
    return (c && c.uid === uid) ? c : null;
  } catch(e) { return null; }
}
function _clearTeacherCache() {
  try { sessionStorage.removeItem('admin_tc'); } catch(e) {}
}

window.addEventListener('load', function() {
  var btn = document.getElementById('dark-mode-btn');
  if (btn && document.body.classList.contains('dark')) btn.textContent = '☀️ 亮色模式';

  initFirebase();

  (function waitAuth() {
    if (!auth) { setTimeout(waitAuth, 150); return; }
    auth.onAuthStateChanged(function(user) {
      if (!user) {
        _clearTeacherCache();
        window.location.href = '../index.html';
        return;
      }
      currentTeacher = user;
      var emailEl = document.getElementById('teacher-email-display');
      if (emailEl) emailEl.textContent = user.email;

      (function waitDb() {
        if (!db) { setTimeout(waitDb, 150); return; }

        /* ── 快速路徑：有快取就立刻啟動，不等 Firestore ── */
        var cache = _loadTeacherCache(user.uid);
        if (cache && cache.schoolId) {
          currentTeacherRole = cache.role || 'teacher';
          currentSchoolId    = cache.schoolId;
          currentSchoolName  = cache.schoolName || '';
          _applyTeacherRole(currentTeacherRole);
          onFirebaseReady();
        }

        /* ── 背景驗證（快取命中時為背景，未命中時為主路徑）── */
        db.collection('teachers').doc(user.uid).get().then(function(doc) {
          if (doc.exists && doc.data().blocked) {
            _clearTeacherCache();
            auth.signOut().then(function() { window.location.href = '../index.html'; });
            return;
          }
          var role      = (doc.exists && doc.data().role) || 'teacher';
          var schoolId  = doc.exists ? (doc.data().schoolId  || '') : '';
          var schoolName = doc.exists ? (doc.data().schoolName || '') : '';

          // 更新快取
          if (schoolId) _saveTeacherCache(user.uid, schoolId, schoolName, role);

          // 記錄登入時間（fire-and-forget）
          db.collection('teachers').doc(user.uid).set({
            uid: user.uid, email: user.email || '',
            displayName: user.displayName || '',
            lastLoginAt: new Date().toISOString()
          }, { merge: true }).catch(function() {});

          if (!cache) {
            // 首次載入（無快取）— 正常流程
            currentTeacherRole = role;
            if (!schoolId) {
              showSchoolRequiredOverlay();
            } else {
              currentSchoolId   = schoolId;
              currentSchoolName = schoolName || '（未知學校）';
              _applyTeacherRole(currentTeacherRole);
              onFirebaseReady();
            }
          } else {
            // 快取已啟動 — 若角色變了就更新 UI
            if (role !== currentTeacherRole) {
              currentTeacherRole = role;
              _applyTeacherRole(role);
            }
          }
        }).catch(function() {
          if (!cache) onFirebaseReady();
        });
      })();
    });
  })();
});

/* ── 強制學校選擇 Overlay ── */
function showSchoolRequiredOverlay() {
  var overlay = document.getElementById('school-required-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  _loadSchoolsForOverlay();
}

function _loadSchoolsForOverlay() {
  var list = document.getElementById('school-required-list');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:.88rem">載入中…</div>';
  db.collection('schools').where('active', '==', true).get()
    .then(function(snap) {
      var schools = [];
      snap.forEach(function(doc) {
        schools.push({ id: doc.id, name: doc.data().name || '（未命名）' });
      });
      schools.sort(function(a, b) { return a.name.localeCompare(b.name, 'zh-TW'); });
      if (!schools.length) {
        list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:.88rem">目前尚無學校，請聯絡系統管理員。</div>';
        return;
      }
      list.innerHTML = schools.map(function(s) {
        var escapedId   = _escInit(s.id);
        var escapedName = _escInit(s.name);
        var htmlName    = s.name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        return '<button class="school-required-item" onclick="selectSchoolFromOverlay(\'' + escapedId + '\',\'' + escapedName + '\')">'
          + '<span class="school-required-item-name">' + htmlName + '</span>'
          + '<span class="school-required-item-arrow">→</span>'
          + '</button>';
      }).join('');
    })
    .catch(function(e) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--red);font-size:.88rem">載入失敗：' + e.message + '</div>';
    });
}

function selectSchoolFromOverlay(schoolId, schoolName) {
  db.collection('teachers').doc(currentTeacher.uid).set({
    schoolId:   schoolId,
    schoolName: schoolName
  }, { merge: true })
    .then(function() {
      var overlay = document.getElementById('school-required-overlay');
      if (overlay) overlay.style.display = 'none';
      onFirebaseReady();
    })
    .catch(function(e) {
      alert('儲存失敗：' + e.message);
    });
}

function _escInit(s) {
  return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
}

function doLogout() {
  if (auth) {
    auth.signOut().then(function() {
      window.location.href = '../index.html';
    });
  } else {
    window.location.href = '../index.html';
  }
}

function switchTab(tab) {
  if (document.getElementById('tool-modal').style.display === 'flex') closeToolModal();
  ['classes', 'database', 'quiz-zone', 'tools', 'print', 'school-admin'].forEach(function(t) {
    var panel  = document.getElementById('panel-' + t);
    var tabBtn = document.getElementById('tab-' + t);
    if (panel)  panel.style.display = t === tab ? '' : 'none';
    if (tabBtn) tabBtn.classList.toggle('active', t === tab);
  });
  document.getElementById('panel-student').style.display = 'none';
  if (tab === 'classes')      { backToClasses(); loadClasses(); }
  if (tab === 'database')     { _initDatabaseTab(); }
  if (tab === 'quiz-zone')    { _initQuizZoneTab(); }
  if (tab === 'school-admin') { if (!_saLoaded) loadMainRoster(); }
}

/* ── 題庫年級組合 ── */
function updateQbGrade() {
  var v = document.getElementById('qb-version').value;
  var s = document.getElementById('qb-volume').value;
  document.getElementById('qb-grade').value = (v && s) ? v + s : '';
}

/* ── 資料庫：初始化（切換至資料庫 tab 時呼叫）── */
function _initDatabaseTab() {
  var activeBtn = document.querySelector('.db-nav-btn.active');
  var viewId = activeBtn ? activeBtn.id.replace('dbnav-', '') : 'chinese-bank';
  switchDbView(viewId, activeBtn);
}

/* ── 資料庫：切換左欄項目 ── */
function switchDbView(viewId, btn) {
  ['chinese-bank', 'word-image', 'audio-chinese', 'math-bank', 'audio-math'].forEach(function(v) {
    var el = document.getElementById('dbview-' + v);
    if (el) el.style.display = v === viewId ? '' : 'none';
  });
  document.querySelectorAll('.db-nav-btn').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  if (viewId === 'chinese-bank')  loadQuizBankStats();
  if (viewId === 'word-image')    loadWordImageTab();
  if (viewId === 'math-bank')     loadMathBankStats();
  if (viewId === 'audio-chinese') loadAudioClipsTab('chinese');
  if (viewId === 'audio-math')    loadAudioClipsTab('math');
}

/* ── 測驗區：初始化 ── */
function _initQuizZoneTab() {
  var sv = document.getElementById('qz-sessions-view');
  var wv = document.getElementById('ec-wizard-view');
  if (sv) sv.style.display = '';
  if (wv) wv.style.display = 'none';
  var activeBtn = document.querySelector('#qz-sessions-view > .app-tabs-mini .app-tab-mini.active');
  var type = activeBtn ? (activeBtn.getAttribute('data-type') || 'quiz') : 'quiz';
  switchQzSessionType(type, activeBtn);
}

/* ── 測驗區：科目切換（語文 / 數學）── */
function switchQzSessionType(type, btn) {
  ['quiz', 'math'].forEach(function(t) {
    var el = document.getElementById('qz-sessions-' + t);
    if (el) el.style.display = t === type ? '' : 'none';
  });
  document.querySelectorAll('#qz-sessions-view > .app-tabs-mini .app-tab-mini').forEach(function(b) {
    b.classList.remove('active');
  });
  if (btn) btn.classList.add('active');
  if (type === 'quiz') loadQuizSessions();
  if (type === 'math') loadMathQuizSessions();
}
