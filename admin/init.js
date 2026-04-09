/**
 * admin/init.js — 後台初始化、登出、分頁切換
 * 依賴：shared.js（initFirebase、db、auth、showToast）
 */
'use strict';

var currentTeacher = null; // Firebase Auth User 物件

function onFirebaseReady() {
  loadClasses();
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
        // 檢查是否被管理者封鎖
        db.collection('teachers').doc(user.uid).get().then(function(doc) {
          if (doc.exists && doc.data().blocked) {
            auth.signOut().then(function() {
              window.location.href = 'index.html';
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
      window.location.href = 'index.html';
    });
  } else {
    window.location.href = 'index.html';
  }
}

function switchTab(tab) {
  ['classes'].forEach(function(t) {
    document.getElementById('panel-'+t).style.display = t===tab ? '' : 'none';
    document.getElementById('tab-'+t).classList.toggle('active', t===tab);
  });
  document.getElementById('panel-student').style.display = 'none';
  if (tab === 'classes') { backToClasses(); loadClasses(); }
}
