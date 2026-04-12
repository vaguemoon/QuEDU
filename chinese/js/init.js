/**
 * init.js — 應用程式啟動與自動登入
 * 負責：window.load 事件、waitHW()、從 sessionStorage 自動登入、載入課程
 * 依賴：shared.js（initFirebase、applyTheme、initSoundWrapper）、所有其他模組
 */
'use strict';

/**
 * 等待 HanziWriter 函式庫載入完畢後執行 callback
 * CDN 較慢時會不斷重試
 */
function waitHW(cb) {
  if (typeof HanziWriter !== 'undefined') { cb(); return; }
  setTimeout(function(){ waitHW(cb); }, 100);
}

window.addEventListener('load', function() {
  // 1. 初始化 Firebase、套用主題與音效
  initFirebase();
  applyTheme(currentTheme);
  applySound();
  initSoundWrapper();
  waitHW(function(){});

  // 2. 顯示起始頁
  showPage('mode-select', false);
  PAGE_STACK = ['mode-select'];

  // 3. 嘗試從 sessionStorage 自動登入（由 index.html hub 寫入）
  try {
    var saved = sessionStorage.getItem('hub_student');
    if (saved) {
      var hubStudent = JSON.parse(saved);

      (function autoLogin() {
        if (!db) { setTimeout(autoLogin, 200); return; }

        var id = hubStudent.name + '_' + hubStudent.pin;
        Promise.all([
          db.collection('students').doc(id).get(),
          db.collection('students').doc(id).collection('progress').doc('hanzi').get()
        ]).then(function(results) {
          var sDoc = results[0], pDoc = results[1];
          if (!sDoc.exists) return;

          var sData = sDoc.data();
          var pData = pDoc.exists ? pDoc.data() : {};

          // 設定目前學生
          currentStudent = {
            name:     hubStudent.name,
            pin:      hubStudent.pin,
            id:       id,
            nickname: sData.nickname || '',
            avatar:   sData.avatar   || '🐣'
          };

          // 更新頂端列學生資訊
          var avEl = document.getElementById('topbar-avatar');
          var nmEl = document.getElementById('topbar-name');
          if (avEl) avEl.textContent = currentStudent.avatar;
          if (nmEl) nmEl.textContent = currentStudent.nickname || currentStudent.name;

          // 載入學習進度
          charStatus = pData.charStatus || {};

          // 非同步載入班級指派生字（不阻塞主流程）
          if (sData.classId) {
            db.collection('classes').doc(sData.classId).get().then(function(clsDoc) {
              if (clsDoc.exists && clsDoc.data().assignedChars && clsDoc.data().assignedChars.length) {
                teacherAssignedChars = clsDoc.data().assignedChars.slice();
              }
            }).catch(function() {});
          }

          // 載入課程選單
          setTimeout(loadCurriculumVersions, 300);
          showToast('👋 歡迎 ' + (currentStudent.nickname || currentStudent.name) + '！');

          // 載入成就統計，完成後處理每日登入
          loadAchStats(function() {
            handleDailyLogin();
          });

        }).catch(function(e){ console.warn('autoLogin error:', e); });
      })();

    } else {
      // 沒有登入資訊，仍載入課程（訪客模式）
      setTimeout(loadCurriculumVersions, 500);
    }
  } catch(e) {
    setTimeout(loadCurriculumVersions, 500);
  }
});

/* ── 頂端列學生選單 ── */
function toggleLogoutMenu() {
  var menu = document.getElementById('topbar-logout-menu');
  if (menu) menu.classList.toggle('hidden');
}

function sendLogout(evt) {
  if (evt) evt.stopPropagation();
  try { window.parent.postMessage({ type: 'hanzi-logout' }, '*'); } catch(e) {}
}

function goToSettings(evt) {
  if (evt) evt.stopPropagation();
  var menu = document.getElementById('topbar-logout-menu');
  if (menu) menu.classList.add('hidden');
  if (typeof renderThemeGrid === 'function') renderThemeGrid();
  if (typeof applySound === 'function') applySound();
  showPage('settings');
}

function goToAchievement(evt) {
  if (evt) evt.stopPropagation();
  var menu = document.getElementById('topbar-logout-menu');
  if (menu) menu.classList.add('hidden');
  if (typeof renderAchievementPage === 'function') renderAchievementPage();
  showPage('achievement');
}

/* 點其他地方時收起選單 */
document.addEventListener('click', function(e) {
  var student = document.getElementById('topbar-student');
  var menu    = document.getElementById('topbar-logout-menu');
  if (menu && !menu.classList.contains('hidden') && student && !student.contains(e.target)) {
    menu.classList.add('hidden');
  }
});
