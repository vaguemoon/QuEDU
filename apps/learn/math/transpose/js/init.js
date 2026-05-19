'use strict';

var AVATARS = ['🐣','🐱','🐶','🐻','🐼','🦊','🐸','🐧','🦁','🐯','🐨','🐮','🐷','🐙','🦋','🌟','🌈','🎈','🚀','🎯'];

window.addEventListener('load', function() {
  initFirebase();
  applyTheme(currentTheme);
  applySound();
  initSoundWrapper();

  showPage('home', false);
  PAGE_STACK = ['home'];

  document.addEventListener('keydown', handleFillKeydown);

  // 點其他地方收起選單
  document.addEventListener('click', function(e) {
    var student = document.getElementById('topbar-student');
    var menu    = document.getElementById('topbar-logout-menu');
    if (menu && !menu.classList.contains('hidden') && student && !student.contains(e.target)) {
      menu.classList.add('hidden');
    }
  });

  // 自動登入
  try {
    var saved = sessionStorage.getItem('hub_student');
    if (saved) {
      var hubStudent = JSON.parse(saved);
      (function autoLogin() {
        if (!db) { setTimeout(autoLogin, 200); return; }
        db.collection('students').doc(hubStudent.id).get()
          .then(function(sDoc) {
            if (!sDoc.exists) return;
            var sData = sDoc.data();
            currentStudent = {
              id:       hubStudent.id,
              name:     hubStudent.name,
              pin:      hubStudent.pin,
              nickname: sData.nickname || '',
              avatar:   sData.avatar   || '🐣'
            };
            var avEl = document.getElementById('topbar-avatar');
            var nmEl = document.getElementById('topbar-name');
            if (avEl) avEl.textContent = currentStudent.avatar;
            if (nmEl) nmEl.textContent = currentStudent.nickname || currentStudent.name;
            showToast('👋 歡迎 ' + (currentStudent.nickname || currentStudent.name) + '！');
          })
          .catch(function(e) { console.warn('autoLogin error:', e); });
      })();
    }
  } catch(e) { console.warn('sessionStorage error:', e); }
});

// ── Topbar 學生選單 ──
function toggleLogoutMenu() {
  var menu = document.getElementById('topbar-logout-menu');
  if (menu) menu.classList.toggle('hidden');
}

function sendLogout(evt) {
  if (evt) evt.stopPropagation();
  try { window.parent.postMessage({ type: 'transpose-logout' }, '*'); } catch(e) {}
}

function goToSettings(evt) {
  if (evt) evt.stopPropagation();
  var menu = document.getElementById('topbar-logout-menu');
  if (menu) menu.classList.add('hidden');
  if (typeof renderThemeGrid === 'function') renderThemeGrid();
  renderSettingsAvatarGrid();
  applySound();
  showPage('settings');
}

// ── 設定頁 ──
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
