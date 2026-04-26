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
          onFirebaseReady();
        }).catch(function() {
          // Firestore 讀取失敗時仍允許進入，不中斷教師工作
          onFirebaseReady();
        });
      })();
    });
  })();
});

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
  ['classes', 'quiz', 'tools'].forEach(function(t) {
    document.getElementById('panel-'+t).style.display = t===tab ? '' : 'none';
    document.getElementById('tab-'+t).classList.toggle('active', t===tab);
  });
  document.getElementById('panel-student').style.display = 'none';
  if (tab === 'classes') { backToClasses(); loadClasses(); }
  if (tab === 'quiz')    { loadQuizBankStats(); loadQuizSessions(); }
}

/* ── 題庫年級組合 ── */
function updateQbGrade() {
  var v = document.getElementById('qb-version').value;
  var s = document.getElementById('qb-volume').value;
  document.getElementById('qb-grade').value = (v && s) ? v + s : '';
}

/* ── 語文練習內子頁籤 ── */
function switchQuizTab(subId, btn) {
  ['bank', 'sessions'].forEach(function(id) {
    var el = document.getElementById('qpanel-' + id);
    if (el) el.style.display = id === subId ? '' : 'none';
  });
  var tabs = document.querySelectorAll('#panel-quiz .app-tab-mini');
  tabs.forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
}
