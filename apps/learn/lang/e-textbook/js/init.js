/**
 * init.js — 應用程式啟動與自動登入
 */
'use strict';

window.addEventListener('load', function() {
  initFirebase();
  applyTheme(currentTheme);
  applySound();
  initSoundWrapper();

  showPage('list', false);
  PAGE_STACK = ['list'];

  (function waitDb() {
    if (!db) { setTimeout(waitDb, 200); return; }
    _etAutoLogin();
    loadEtWordImageMap();
  })();
});

function _etAutoLogin() {
  try {
    var saved = sessionStorage.getItem('hub_student');
    if (!saved) { loadEtLessonList(); return; }
    var hub = JSON.parse(saved);

    if (hub.isGuest) {
      currentStudent = {
        name: hub.name, pin: null, id: 'guest',
        nickname: hub.nickname || '訪客', avatar: hub.avatar || '👤', isGuest: true,
        classIds: hub.classIds || []
      };
      _etApplyTopbar();
      loadEtLessonList();
      return;
    }

    if (hub.isPreview) {
      currentStudent = {
        name: hub.name || hub.nickname || '老師', pin: '', id: hub.id,
        nickname: hub.nickname || hub.name || '老師', avatar: hub.avatar || '👨‍🏫',
        isPreview: true, classIds: hub.classIds || []
      };
      _etApplyTopbar();
      loadEtLessonList();
      return;
    }

    db.collection('students').doc(hub.id).get().then(function(sDoc) {
      var sData = sDoc.exists ? sDoc.data() : {};
      currentStudent = {
        name: hub.name, pin: hub.pin, id: hub.id,
        nickname: sData.nickname || '', avatar: sData.avatar || '🐣',
        /* classIds 由 Hub 的 studentMode 機制保證已載好，直接沿用 */
        classIds: hub.classIds || (sData.classIds || (sData.classId ? [sData.classId] : []))
      };
      _etApplyTopbar();
      showToast('👋 歡迎 ' + (currentStudent.nickname || currentStudent.name) + '！');
      loadEtLessonList();
    }).catch(function(e) {
      console.warn('autoLogin error:', e);
      loadEtLessonList();
    });
  } catch (e) {
    loadEtLessonList();
  }
}

function _etApplyTopbar() {
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
