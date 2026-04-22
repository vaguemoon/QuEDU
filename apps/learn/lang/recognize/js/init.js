/**
 * init.js — 應用程式啟動與自動登入
 */
'use strict';

window.addEventListener('load', function() {
  initFirebase();
  applyTheme(currentTheme);
  applySound();
  initSoundWrapper();

  showPage('curriculum', false);
  PAGE_STACK = ['curriculum'];

  try {
    var saved = sessionStorage.getItem('hub_student');
    if (saved) {
      var hubStudent = JSON.parse(saved);

      (function autoLogin() {
        if (!db) { setTimeout(autoLogin, 200); return; }

        var id = hubStudent.name + '_' + hubStudent.pin;
        Promise.all([
          db.collection('students').doc(id).get(),
          db.collection('students').doc(id).collection('progress').doc('recognize').get()
        ]).then(function(results) {
          var sDoc = results[0], pDoc = results[1];
          if (!sDoc.exists) return;

          var sData = sDoc.data();
          var pData = pDoc.exists ? pDoc.data() : {};

          currentStudent = {
            name:     hubStudent.name,
            pin:      hubStudent.pin,
            id:       id,
            nickname: sData.nickname || '',
            avatar:   sData.avatar   || '🐣'
          };

          var avEl = document.getElementById('topbar-avatar');
          var nmEl = document.getElementById('topbar-name');
          if (avEl) avEl.textContent = currentStudent.avatar;
          if (nmEl) nmEl.textContent = currentStudent.nickname || currentStudent.name;

          charStatus = pData.charStatus || {};
          wordStatus = pData.wordStatus || {};

          setTimeout(loadCurriculumVersions, 300);
          showToast('👋 歡迎 ' + (currentStudent.nickname || currentStudent.name) + '！');
        }).catch(function(e){ console.warn('autoLogin error:', e); });
      })();

    } else {
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
  try { window.parent.postMessage({ type: 'recognize-logout' }, '*'); } catch(e) {}
}

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

function goToSettings(evt) {
  if (evt) evt.stopPropagation();
  var menu = document.getElementById('topbar-logout-menu');
  if (menu) menu.classList.add('hidden');
  if (typeof renderThemeGrid === 'function') renderThemeGrid();
  renderSettingsAvatarGrid();
  if (typeof applySound === 'function') applySound();
  showPage('settings');
}

document.addEventListener('click', function(e) {
  var student = document.getElementById('topbar-student');
  var menu    = document.getElementById('topbar-logout-menu');
  if (menu && !menu.classList.contains('hidden') && student && !student.contains(e.target)) {
    menu.classList.add('hidden');
  }
});
