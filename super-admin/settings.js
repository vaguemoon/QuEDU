/**
 * super-admin/settings.js — 系統設定：維護模式、公告、管理者帳號
 * 依賴：shared.js（db、showToast）、super-admin/init.js（currentAdmin）
 *
 * Firestore 結構：
 *   siteSettings/main → { maintenanceMode: bool, announcement: string }
 *   superAdmins/{email_key} → { email, displayName, enabled, addedAt }
 */
'use strict';

var _siteSettings = { maintenanceMode: false, announcement: '' };

function loadSettings() {
  if (!db) { setTimeout(loadSettings, 400); return; }
  loadSiteSettings();
  loadAdminsList();
}

/* ── 系統開關 ── */
function loadSiteSettings() {
  var wrap = document.getElementById('settings-controls');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  db.collection('siteSettings').doc('main').get()
    .then(function(doc) {
      if (doc.exists) {
        _siteSettings = Object.assign(_siteSettings, doc.data());
      }
      renderSettingsControls();
    })
    .catch(function() { renderSettingsControls(); });
}

function renderSettingsControls() {
  var wrap = document.getElementById('settings-controls');
  if (!wrap) return;

  var mm = _siteSettings.maintenanceMode;
  var ann = _siteSettings.announcement || '';

  wrap.innerHTML =
    /* 維護模式 */
    '<div class="toggle-row">'
    + '<div><div class="toggle-label">🔧 維護模式</div>'
    + '<div class="toggle-sub">開啟後，學生與教師頁面將顯示維護中訊息</div></div>'
    + '<div class="toggle-switch ' + (mm ? 'on' : '') + '" id="toggle-maintenance" onclick="toggleMaintenance()"></div>'
    + '</div>'
    /* 公告訊息 */
    + '<div style="padding:14px 0">'
    + '<div class="toggle-label" style="margin-bottom:8px">📢 首頁公告訊息</div>'
    + '<div class="toggle-sub" style="margin-bottom:10px">顯示在學生/教師選擇頁面上方（留空則不顯示）</div>'
    + '<textarea id="announcement-input" rows="3" placeholder="例如：本週五（5/10）系統維護，不開放登入。"'
    + ' style="width:100%;border:2px solid var(--border);border-radius:8px;padding:10px 12px;font-size:.9rem;font-family:inherit;outline:none;resize:vertical">'
    + escHtml(ann)
    + '</textarea>'
    + '<div style="margin-top:8px;display:flex;gap:8px">'
    + '<button class="btn-save-lesson" style="padding:9px 18px" onclick="saveAnnouncement()">'
    + '<span>💾</span><span>儲存公告</span></button>'
    + '<span id="ann-status" style="font-size:.82rem;font-weight:700;align-self:center"></span>'
    + '</div>'
    + '</div>';
}

function toggleMaintenance() {
  _siteSettings.maintenanceMode = !_siteSettings.maintenanceMode;
  var sw = document.getElementById('toggle-maintenance');
  if (sw) sw.classList.toggle('on', _siteSettings.maintenanceMode);

  db.collection('siteSettings').doc('main').set(
    { maintenanceMode: _siteSettings.maintenanceMode },
    { merge: true }
  ).then(function() {
    showToast(_siteSettings.maintenanceMode ? '🔧 維護模式已開啟' : '✅ 維護模式已關閉');
  }).catch(function(e) {
    showToast('儲存失敗：' + e.message);
    _siteSettings.maintenanceMode = !_siteSettings.maintenanceMode; // 還原
    var sw2 = document.getElementById('toggle-maintenance');
    if (sw2) sw2.classList.toggle('on', _siteSettings.maintenanceMode);
  });
}

function saveAnnouncement() {
  var val = (document.getElementById('announcement-input').value || '').trim();
  db.collection('siteSettings').doc('main').set(
    { announcement: val },
    { merge: true }
  ).then(function() {
    _siteSettings.announcement = val;
    var el = document.getElementById('ann-status');
    if (el) { el.textContent = '✅ 已儲存'; el.style.color='var(--green)'; }
    showToast('✅ 公告已更新');
  }).catch(function(e) {
    showToast('儲存失敗：' + e.message);
  });
}

/* ── 管理者帳號列表 ── */
function loadAdminsList() {
  var wrap = document.getElementById('admins-list-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  db.collection('superAdmins').get()
    .then(function(snap) {
      if (snap.empty) {
        wrap.innerHTML = '<div style="color:var(--muted);font-size:.88rem;padding:8px 0">尚無管理者資料。</div>';
        return;
      }

      var rows = [];
      snap.forEach(function(doc) {
        var d = doc.data();
        var email   = d.email || doc.id.replace(/_/g, '.');
        var enabled = d.enabled !== false;
        var badge   = enabled
          ? '<span class="badge badge-green">啟用</span>'
          : '<span class="badge badge-gray">停用</span>';

        // 不能停用自己
        var isSelf = currentAdmin && currentAdmin.email === email;
        var btn = isSelf
          ? '<span style="font-size:.75rem;color:var(--muted)">(自己)</span>'
          : (enabled
            ? '<button class="btn-sm-red"   onclick="setAdminEnabled(\'' + escHtml(doc.id) + '\',false)">停用</button>'
            : '<button class="btn-sm-green" onclick="setAdminEnabled(\'' + escHtml(doc.id) + '\',true)">啟用</button>');

        rows.push(
          '<tr>'
          + '<td>' + escHtml(email) + '</td>'
          + '<td>' + badge + '</td>'
          + '<td>' + btn + '</td>'
          + '</tr>'
        );
      });

      wrap.innerHTML =
        '<table class="sa-table" style="margin-bottom:0">'
        + '<thead><tr><th>Email</th><th>狀態</th><th>操作</th></tr></thead>'
        + '<tbody>' + rows.join('') + '</tbody>'
        + '</table>';
    })
    .catch(function(e) {
      wrap.innerHTML = '<div style="color:var(--red);font-size:.88rem">載入失敗：' + e.message + '</div>';
    });
}

function setAdminEnabled(docId, enabled) {
  db.collection('superAdmins').doc(docId).update({ enabled: enabled })
    .then(function() {
      showToast(enabled ? '✅ 管理者帳號已啟用' : '管理者帳號已停用');
      loadAdminsList();
    })
    .catch(function(e) { showToast('操作失敗：' + e.message); });
}

function addAdmin() {
  var input  = document.getElementById('new-admin-email');
  var status = document.getElementById('add-admin-status');
  var email  = (input ? input.value : '').trim().toLowerCase();
  if (status) { status.textContent = ''; }

  if (!email || !email.includes('@')) {
    if (status) { status.textContent = '請輸入有效的 Email'; status.style.color='var(--red)'; }
    return;
  }

  var emailKey = email.replace(/\./g, '_');
  db.collection('superAdmins').doc(emailKey).set({
    email:     email,
    enabled:   true,
    addedAt:   new Date().toISOString(),
    addedBy:   currentAdmin ? currentAdmin.email : '—'
  })
    .then(function() {
      if (input)  input.value = '';
      if (status) { status.textContent = '✅ 已新增：' + email; status.style.color='var(--green)'; }
      showToast('✅ 管理者已新增：' + email);
      loadAdminsList();
    })
    .catch(function(e) {
      if (status) { status.textContent = '新增失敗：' + e.message; status.style.color='var(--red)'; }
    });
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
