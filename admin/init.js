/**
 * admin/init.js — 後台初始化、登出、分頁切換
 * 依賴：shared.js（initFirebase、db、auth、showToast）
 */
'use strict';

var currentTeacher = null; // Firebase Auth User 物件

function onFirebaseReady() {
  loadCourseOverview();
}

window.addEventListener('load', function() {
  initFirebase();

  // 等 auth 初始化後，監聽登入狀態
  (function waitAuth() {
    if (!auth) { setTimeout(waitAuth, 150); return; }
    auth.onAuthStateChanged(function(user) {
      if (!user) {
        // 未登入 → 回登入頁
        window.location.href = 'index.html';
        return;
      }
      currentTeacher = user;
      // 更新後台頂列顯示教師 Email
      var emailEl = document.getElementById('teacher-email-display');
      if (emailEl) emailEl.textContent = user.email;
      // 等 Firestore 就緒
      (function waitDb() {
        if (!db) { setTimeout(waitDb, 150); return; }
        onFirebaseReady();
      })();
    });
  })();
});

function doLogout() {
  if (auth) {
    auth.signOut().then(function() {
      window.location.href = 'index.html';
    });
  } else {
    window.location.href = 'index.html';
  }
}

function switchTab(tab) {
  ['overview','classes','curriculum'].forEach(function(t) {
    document.getElementById('panel-'+t).style.display = t===tab ? '' : 'none';
    document.getElementById('tab-'+t).classList.toggle('active', t===tab);
  });
  document.getElementById('panel-student').style.display = 'none';
  if (tab === 'overview')   loadCourseOverview();
  if (tab === 'classes')    loadClasses();
  if (tab === 'curriculum') loadVersions();
}
