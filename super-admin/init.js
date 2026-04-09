/**
 * super-admin/init.js — 管理者後台初始化、Auth 驗證、分頁切換、登出
 * 依賴：shared.js（initFirebase、db、auth、showToast）
 */
'use strict';

var currentAdmin = null; // Firebase Auth User

/* ── 頁面載入後啟動 ── */
window.addEventListener('load', function() {
  initFirebase();

  (function waitAuth() {
    if (!auth) { setTimeout(waitAuth, 150); return; }
    auth.onAuthStateChanged(function(user) {
      if (!user) {
        window.location.href = 'super-admin-login.html';
        return;
      }
      // 二次驗證：確認仍在 superAdmins 白名單
      (function waitDb() {
        if (!db) { setTimeout(waitDb, 150); return; }
        var emailKey = user.email.replace(/\./g, '_');
        db.collection('superAdmins').doc(emailKey).get()
          .then(function(doc) {
            if (!doc.exists || doc.data().enabled === false) {
              auth.signOut().then(function() {
                window.location.href = 'super-admin-login.html';
              });
              return;
            }
            currentAdmin = user;
            var el = document.getElementById('admin-email-display');
            if (el) el.textContent = user.email;
            onAdminReady();
          })
          .catch(function() {
            window.location.href = 'super-admin-login.html';
          });
      })();
    });
  })();
});

/* ── 驗證通過後初始化 ── */
function onAdminReady() {
  loadOverview();
}

/* ── 登出 ── */
function doLogout() {
  if (auth) {
    auth.signOut().then(function() {
      window.location.href = 'super-admin-login.html';
    });
  } else {
    window.location.href = 'super-admin-login.html';
  }
}

/* ── 分頁切換 ── */
var TABS = ['overview', 'accounts', 'curriculum', 'invites', 'settings'];

function switchTab(tab) {
  TABS.forEach(function(t) {
    document.getElementById('panel-' + t).style.display = t === tab ? '' : 'none';
    document.getElementById('tab-'   + t).classList.toggle('active', t === tab);
  });
  if (tab === 'overview')   loadOverview();
  if (tab === 'accounts')   loadAccounts();
  if (tab === 'curriculum') loadVersions();
  if (tab === 'invites')    loadInvites();
  if (tab === 'settings')   loadSettings();
}
