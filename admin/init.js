/**
 * admin/init.js — 後台初始化、登出、分頁切換
 * 依賴：shared.js（initFirebase、db、auth、showToast）
 */
'use strict';

var currentTeacher = null; // Firebase Auth User 物件

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
}

window.addEventListener('load', function() {
  var btn = document.getElementById('dark-mode-btn');
  if (btn && document.body.classList.contains('dark')) btn.textContent = '☀️ 亮色模式';

  initFirebase();

  // 等 auth 初始化後，監聽登入狀態
  (function waitAuth() {
    if (!auth) { setTimeout(waitAuth, 150); return; }
    auth.onAuthStateChanged(function(user) {
      if (!user) {
        // 未登入 → 回登入頁
        window.location.href = '../index.html';
        return;
      }
      currentTeacher = user;
      // 更新後台頂列顯示教師 Email
      var emailEl = document.getElementById('teacher-email-display');
      if (emailEl) emailEl.textContent = user.email;
      // 等 Firestore 就緒
      (function waitDb() {
        if (!db) { setTimeout(waitDb, 150); return; }
        // 檢查是否被管理者封鎖
        db.collection('teachers').doc(user.uid).get().then(function(doc) {
          if (doc.exists && doc.data().blocked) {
            auth.signOut().then(function() {
              window.location.href = '../index.html';
            });
            return;
          }
          // 記錄教師登入資料（供管理者後台帳號管理使用）
          db.collection('teachers').doc(user.uid).set({
            uid:          user.uid,
            email:        user.email || '',
            displayName:  user.displayName || '',
            lastLoginAt:  new Date().toISOString()
          }, { merge: true }).catch(function() {});
          // 強制設定學校：若教師尚未選擇學校則顯示必填 overlay
          var hasSchool = doc.exists && !!doc.data().schoolId;
          if (!hasSchool) {
            showSchoolRequiredOverlay();
          } else {
            onFirebaseReady();
          }
        }).catch(function() {
          // Firestore 讀取失敗時仍允許進入，不中斷教師工作
          onFirebaseReady();
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
  ['classes', 'database', 'quiz-zone', 'tools'].forEach(function(t) {
    document.getElementById('panel-'+t).style.display = t===tab ? '' : 'none';
    document.getElementById('tab-'+t).classList.toggle('active', t===tab);
  });
  document.getElementById('panel-student').style.display = 'none';
  if (tab === 'classes')   { backToClasses(); loadClasses(); }
  if (tab === 'database')  { _initDatabaseTab(); }
  if (tab === 'quiz-zone') { _initQuizZoneTab(); }
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
