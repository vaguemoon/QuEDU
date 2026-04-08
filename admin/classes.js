/**
 * admin/classes.js — 班級管理：建立班級、邀請碼、啟用/停用
 * 依賴：shared.js（db、showToast）、admin/init.js（currentTeacher）
 */
'use strict';

var currentClasses = [];

/* ── 產生邀請碼（6碼，排除易混淆字元）── */
function generateInviteCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = '';
  for (var i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/* ── 取得邀請連結 ── */
function getInviteLink(code) {
  var base = window.location.href.replace(/\/admin\.html.*$/, '/index.html');
  return base + '?join=' + code;
}

/* ── 載入此教師的所有班級 ── */
function loadClasses() {
  var wrap = document.getElementById('classes-wrap');
  if (!wrap || !currentTeacher) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  db.collection('classes')
    .where('teacherUid', '==', currentTeacher.uid)
    .get()
    .then(function(snap) {
      currentClasses = [];
      snap.forEach(function(doc) {
        var d = doc.data();
        d.id = doc.id;
        currentClasses.push(d);
      });
      currentClasses.sort(function(a, b) {
        return (a.createdAt || '') < (b.createdAt || '') ? 1 : -1;
      });
      renderClasses();
    })
    .catch(function(e) {
      wrap.innerHTML = '<div style="color:var(--red);padding:20px">載入失敗：' + e.message + '</div>';
    });
}

/* ── 渲染班級卡片列表 ── */
function renderClasses() {
  var wrap = document.getElementById('classes-wrap');
  if (!wrap) return;

  if (!currentClasses.length) {
    wrap.innerHTML =
      '<div class="class-empty">' +
        '<div style="font-size:2.5rem;margin-bottom:12px">🏫</div>' +
        '<div style="font-weight:700;color:var(--muted)">還沒有班級</div>' +
        '<div style="font-size:.82rem;color:var(--muted);margin-top:6px">點右上角「＋ 新增班級」建立第一個班級</div>' +
      '</div>';
    return;
  }

  wrap.innerHTML = currentClasses.map(function(cls) {
    var link = getInviteLink(cls.inviteCode);
    var inactive = !cls.active;
    return '<div class="class-card' + (inactive ? ' class-inactive' : '') + '">' +
      '<div class="class-card-top">' +
        '<div class="class-info">' +
          '<div class="class-name">' + escHtml(cls.name) + '</div>' +
          '<div class="class-code-row">' +
            '<span class="class-code">' + cls.inviteCode + '</span>' +
            '<span class="class-status-badge ' + (cls.active ? 'badge-green' : 'badge-gray') + '">' +
              (cls.active ? '邀請中' : '已停用') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="class-top-actions">' +
          '<button class="btn-cls-toggle" onclick="toggleClassActive(\'' + cls.id + '\',' + !cls.active + ')">' +
            (cls.active ? '停用' : '啟用') + '</button>' +
          '<button class="btn-cls-delete" onclick="confirmDeleteClass(\'' + cls.id + '\',\'' + escHtml(cls.name) + '\')">刪除</button>' +
        '</div>' +
      '</div>' +
      '<div class="class-link-row">' +
        '<div class="class-link-text" title="' + link + '">' + link + '</div>' +
        '<button class="btn-copy-link" onclick="copyInviteLink(\'' + link + '\')">複製連結</button>' +
      '</div>' +
      '<div class="class-footer" id="cs-' + cls.id + '">' +
        '<span style="color:var(--muted);font-size:.78rem">載入學生數…</span>' +
      '</div>' +
    '</div>';
  }).join('');

  /* 非同步載入各班學生數 */
  currentClasses.forEach(function(cls) {
    db.collection('students').where('classId', '==', cls.id).get()
      .then(function(snap) {
        var el = document.getElementById('cs-' + cls.id);
        if (el) el.innerHTML =
          '<span class="class-stat">👥 ' + snap.size + ' 位學生已加入</span>';
      }).catch(function() {});
  });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── 啟用 / 停用班級 ── */
function toggleClassActive(classId, newActive) {
  db.collection('classes').doc(classId).update({ active: newActive })
    .then(function() {
      loadClasses();
      showToast(newActive ? '✅ 班級已啟用' : '班級已停用');
    })
    .catch(function(e) { showToast('操作失敗：' + e.message); });
}

/* ── 刪除班級 ── */
function confirmDeleteClass(classId, name) {
  if (!confirm('確定要刪除班級「' + name + '」嗎？\n（學生資料不會刪除，但將不再屬於此班級）')) return;
  db.collection('classes').doc(classId).delete()
    .then(function() {
      loadClasses();
      showToast('已刪除班級「' + name + '」');
    })
    .catch(function(e) { showToast('刪除失敗：' + e.message); });
}

/* ── 複製邀請連結 ── */
function copyInviteLink(link) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(link)
      .then(function() { showToast('✅ 邀請連結已複製！'); })
      .catch(function() { fallbackCopy(link); });
  } else {
    fallbackCopy(link);
  }
}
function fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); showToast('✅ 邀請連結已複製！'); }
  catch(e) { showToast('請手動複製連結'); }
  document.body.removeChild(ta);
}

/* ── 新增班級 Modal ── */
function showCreateClassModal() {
  document.getElementById('class-modal').style.display = 'flex';
  document.getElementById('new-class-name').value = '';
  document.getElementById('class-modal-error').textContent = '';
  var btnEl = document.getElementById('btn-create-class');
  btnEl.disabled = false; btnEl.textContent = '建立班級';
  setTimeout(function() { document.getElementById('new-class-name').focus(); }, 100);
}
function hideCreateClassModal() {
  document.getElementById('class-modal').style.display = 'none';
}

function createClass() {
  var name  = document.getElementById('new-class-name').value.trim();
  var errEl = document.getElementById('class-modal-error');
  var btnEl = document.getElementById('btn-create-class');
  errEl.textContent = '';
  if (!name) { errEl.textContent = '請輸入班級名稱'; return; }
  if (!db || !currentTeacher) return;

  btnEl.disabled = true; btnEl.textContent = '建立中…';

  /* 確保邀請碼不重複 */
  var code = generateInviteCode();
  db.collection('classes').where('inviteCode', '==', code).get()
    .then(function(snap) {
      if (!snap.empty) code = generateInviteCode(); // 碰撞時重新產生
      return db.collection('classes').add({
        name:         name,
        teacherUid:   currentTeacher.uid,
        teacherEmail: currentTeacher.email || '',
        inviteCode:   code,
        active:       true,
        createdAt:    new Date().toISOString()
      });
    })
    .then(function() {
      hideCreateClassModal();
      loadClasses();
      showToast('🎉 班級「' + name + '」建立成功！');
    })
    .catch(function(e) {
      errEl.textContent = '建立失敗：' + e.message;
      btnEl.disabled = false; btnEl.textContent = '建立班級';
    });
}
