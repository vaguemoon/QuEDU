/**
 * init.js — 應用程式啟動與自動登入
 * 負責：window.load 事件、從 sessionStorage 自動登入、載入進度與成就、
 *        Topbar 學生選單（toggleLogoutMenu、sendLogout、goToSettings、goToAchievement）、
 *        設定頁頭像選擇（renderSettingsAvatarGrid、selectSettingsAvatar）
 * 依賴：shared.js、nav.js、state.js、game.js、achievement.js（均須在此之前載入）
 */
'use strict';

window.addEventListener('load', function() {
  // 1. 初始化 Firebase、套用主題與音效
  initFirebase();
  applyTheme(currentTheme);
  applySound();
  initSoundWrapper();

  // 2. 顯示起始頁
  showPage('home', false);
  PAGE_STACK = ['home'];

  // 3. 鍵盤填空支援
  document.addEventListener('keydown', handleFillKeydown);

  // 4. 點其他地方收起學生選單
  document.addEventListener('click', function(e) {
    var student = document.getElementById('topbar-student');
    var menu    = document.getElementById('topbar-logout-menu');
    if (menu && !menu.classList.contains('hidden') && student && !student.contains(e.target)) {
      menu.classList.add('hidden');
    }
  });

  // 5. 自動登入（從 Hub 的 sessionStorage）
  try {
    var saved = sessionStorage.getItem('hub_student');
    if (saved) {
      var hubStudent = JSON.parse(saved);
      (function autoLogin() {
        if (!db) { setTimeout(autoLogin, 200); return; }
        var id = hubStudent.name + '_' + hubStudent.pin;

        Promise.all([
          db.collection('students').doc(id).get(),
          db.collection('students').doc(id).collection('progress').doc('multiply').get()
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

          // 更新 Topbar
          var avEl = document.getElementById('topbar-avatar');
          var nmEl = document.getElementById('topbar-name');
          if (avEl) avEl.textContent = currentStudent.avatar;
          if (nmEl) nmEl.textContent = currentStudent.nickname || currentStudent.name;

          // 載入進度
          masteredFill       = pData.masteredFill       || [];
          masteredReverse    = pData.masteredReverse    || [];
          masteredMixed      = pData.masteredMixed      || [];
          totalCorrect       = pData.totalCorrect       || 0;
          totalAttempts      = pData.totalAttempts      || 0;
          maxStreak          = pData.maxStreak          || 0;
          examCompletedCount = pData.examCompletedCount || 0;

          showToast('👋 歡迎 ' + (currentStudent.nickname || currentStudent.name) + '！');

          // 載入成就後處理每日登入
          loadAchStats(function() {
            handleDailyLogin();
          });

        }).catch(function(e) { console.warn('autoLogin error:', e); });
      })();
    }
  } catch(e) { console.warn('sessionStorage error:', e); }
});

// ════════════════════════════════════════
//  Topbar 學生選單
// ════════════════════════════════════════

function toggleLogoutMenu() {
  var menu = document.getElementById('topbar-logout-menu');
  if (menu) menu.classList.toggle('hidden');
}

function sendLogout(evt) {
  if (evt) evt.stopPropagation();
  try { window.parent.postMessage({ type: 'multiply-logout' }, '*'); } catch(e) {}
}

function goToSettings(evt) {
  if (evt) evt.stopPropagation();
  var menu = document.getElementById('topbar-logout-menu');
  if (menu) menu.classList.add('hidden');
  if (typeof renderThemeGrid === 'function') renderThemeGrid();
  renderSettingsAvatarGrid();
  if (typeof applySound === 'function') applySound();
  showPage('settings');
}

function goToAchievement(evt) {
  if (evt) evt.stopPropagation();
  var menu = document.getElementById('topbar-logout-menu');
  if (menu) menu.classList.add('hidden');
  showPage('achievement');
}

// ════════════════════════════════════════
//  設定頁
// ════════════════════════════════════════

var AVATARS = ['🐣','🐱','🐶','🐻','🐼','🦊','🐸','🐧','🦁','🐯','🐨','🐮','🐷','🐙','🦋','🌟','🌈','🎈','🚀','🎯'];

function renderSettingsAvatarGrid() {
  var grid = document.getElementById('settings-avatar-grid');
  if (!grid) return;
  var current = (currentStudent && currentStudent.avatar) ? currentStudent.avatar : '🐣';
  grid.innerHTML = AVATARS.map(function(av) {
    return '<button class="avatar-btn' + (av === current ? ' selected' : '') +
      '" onclick="selectSettingsAvatar(\'' + av + '\')">' + av + '</button>';
  }).join('');
}

function selectSettingsAvatar(av) {
  if (!currentStudent) return;
  currentStudent.avatar = av;
  var avEl = document.getElementById('topbar-avatar');
  if (avEl) avEl.textContent = av;
  if (db && currentStudent.id) {
    db.collection('students').doc(currentStudent.id).update({ avatar: av }).catch(function(){});
  }
  renderSettingsAvatarGrid();
}
