/**
 * init.js — 應用程式啟動與自動登入
 */
'use strict';

window.addEventListener('load', function() {
  initFirebase();
  applyTheme(currentTheme);
  applySound();
  initSoundWrapper();

  showPage('grid', false);
  PAGE_STACK = ['grid'];

  (function waitDb() {
    if (!db) { setTimeout(waitDb, 200); return; }
    loadZhuyinData();
    _zyAutoLogin();
  })();
});

function _zyAutoLogin() {
  try {
    var saved = sessionStorage.getItem('hub_student');
    if (!saved) return;
    var hub = JSON.parse(saved);

    if (hub.isGuest) {
      currentStudent = {
        name: hub.name, pin: null, id: 'guest',
        nickname: hub.nickname || '訪客', avatar: hub.avatar || '👤', isGuest: true
      };
      _zyApplyTopbar();
      return;
    }

    /* 教師預覽模式（班級管理→學生視角） */
    if (hub.isPreview) {
      currentStudent = {
        name: hub.name || hub.nickname || '老師', pin: '', id: hub.id,
        nickname: hub.nickname || hub.name || '老師', avatar: hub.avatar || '👨‍🏫',
        isPreview: true
      };
      _zyApplyTopbar();
      return;
    }

    db.collection('students').doc(hub.id).get().then(function(sDoc) {
      if (!sDoc.exists) return;
      var sData = sDoc.data();
      currentStudent = {
        name: hub.name, pin: hub.pin, id: hub.id,
        nickname: sData.nickname || '', avatar: sData.avatar || '🐣'
      };
      _zyApplyTopbar();
    }).catch(function(e) { console.warn('autoLogin error:', e); });
  } catch (e) {}
}

function _zyApplyTopbar() {
  var avEl = document.getElementById('topbar-avatar');
  var nmEl = document.getElementById('topbar-name');
  if (avEl) avEl.textContent = currentStudent.avatar;
  if (nmEl) nmEl.textContent = (currentStudent.isPreview ? '[預覽] ' : '') + (currentStudent.nickname || currentStudent.name);
}

/* ── 頭像設定 ── */
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
  if (db && currentStudent.id && !currentStudent.isGuest && !currentStudent.isPreview) {
    db.collection('students').doc(currentStudent.id).update({ avatar: av }).catch(function() {});
  }
  renderSettingsAvatarGrid();
}

function goToSettings(evt) {
  if (evt) evt.stopPropagation();
  var menu = document.getElementById('topbar-logout-menu');
  if (menu) menu.classList.add('hidden');
  if (typeof renderThemeGrid === 'function') renderThemeGrid();
  renderSettingsAvatarGrid();
  showPage('settings');
}
