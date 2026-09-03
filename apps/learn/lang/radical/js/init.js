/**
 * init.js — 應用程式啟動與自動登入
 */
'use strict';

window.addEventListener('load', function() {
  initFirebase();
  applyTheme(currentTheme);

  showPage('entry', false);
  PAGE_STACK = ['entry'];

  (function waitDb() {
    if (!db) { setTimeout(waitDb, 200); return; }
    _rkAutoLogin();
  })();
});

function _rkAutoLogin() {
  try {
    var saved = sessionStorage.getItem('hub_student');
    if (!saved) { renderEntryPage(); return; }
    var hub = JSON.parse(saved);
    var id  = hub.id;

    if (hub.isGuest) {
      currentStudent = {
        name: hub.name, pin: null, id: 'guest',
        nickname: hub.nickname || '訪客', avatar: hub.avatar || '👤', isGuest: true
      };
      _rkApplyTopbar();
      renderEntryPage();
      return;
    }

    /* 教師預覽模式（班級管理→學生視角） */
    if (hub.isPreview) {
      var previewClassIds = hub.classIds || [];
      currentStudent = {
        name: hub.name || hub.nickname || '老師', pin: '', id: id,
        nickname: hub.nickname || hub.name || '老師', avatar: hub.avatar || '👨‍🏫',
        isPreview: true
      };
      _rkApplyTopbar();
      loadAssignedSets(previewClassIds);
      return;
    }

    Promise.all([
      db.collection('students').doc(id).get(),
      db.collection('students').doc(id).collection('progress').doc('radical').get()
    ]).then(function(results) {
      var sDoc = results[0], pDoc = results[1];
      if (!sDoc.exists) { renderEntryPage(); return; }

      var sData = sDoc.data();
      var pData = pDoc.exists ? pDoc.data() : {};

      currentStudent = {
        name: hub.name, pin: hub.pin, id: id,
        nickname: sData.nickname || '', avatar: sData.avatar || '🐣'
      };
      radicalStatus = pData.radicalStatus || {};

      _rkApplyTopbar();
      showToast('👋 歡迎 ' + (currentStudent.nickname || currentStudent.name) + '！');

      var classIds = [];
      if (sData.classId) classIds.push(sData.classId);
      (sData.classIds || []).forEach(function(cid) {
        if (cid && classIds.indexOf(cid) === -1) classIds.push(cid);
      });
      loadAssignedSets(classIds);
    }).catch(function(e) {
      console.warn('autoLogin error:', e);
      renderEntryPage();
    });
  } catch (e) {
    renderEntryPage();
  }
}

function _rkApplyTopbar() {
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
