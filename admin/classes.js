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

/* ── 複製邀請碼 ── */
function copyCode(code) {
  var text = code;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
      .then(function() { showToast('✅ 邀請碼已複製：' + code); })
      .catch(function() { fallbackCopy(text, code); });
  } else {
    fallbackCopy(text, code);
  }
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
    var inactive = !cls.active;
    return '<div class="class-card' + (inactive ? ' class-inactive' : '') + '">' +
      '<div class="class-card-top">' +
        '<div class="class-info">' +
          '<div class="class-name">' + escHtml(cls.name) + '</div>' +
          '<div class="class-code-row">' +
            '<span class="class-code">' + cls.inviteCode + '</span>' +
            '<span class="class-status-badge ' + (cls.active ? 'badge-green' : 'badge-gray') + '">' +
              (cls.active ? '邀請中' : '已停用') + '</span>' +
            '<button class="btn-copy-code" onclick="copyCode(\'' + cls.inviteCode + '\')">複製邀請碼</button>' +
          '</div>' +
        '</div>' +
        '<div class="class-top-actions">' +
          '<button class="btn-share-class" onclick="showShareModal(\'' + escHtml(cls.name) + '\',\'' + cls.inviteCode + '\')">📤 分享</button>' +
          '<button class="btn-cls-toggle" onclick="toggleClassActive(\'' + cls.id + '\',' + !cls.active + ')">' +
            (cls.active ? '停用' : '啟用') + '</button>' +
          '<button class="btn-cls-delete" onclick="confirmDeleteClass(\'' + cls.id + '\',\'' + escHtml(cls.name) + '\')">刪除</button>' +
        '</div>' +
      '</div>' +
      '<div class="class-assign-section">' +
        /* ── APP 頁籤列 ── */
        '<div class="app-tabs-mini">' +
          '<button class="app-tab-mini active" id="cls-tabbtn-chinese-' + cls.id + '"' +
            ' onclick="switchClassTab(\'' + cls.id + '\',\'chinese\',this)">📖 識字趣</button>' +
          '<button class="app-tab-mini" id="cls-tabbtn-multiply-' + cls.id + '"' +
            ' onclick="switchClassTab(\'' + cls.id + '\',\'multiply\',this)">✖️ 乘法趣</button>' +
        '</div>' +
        /* ── 識字趣指派面板 ── */
        '<div id="cls-tab-chinese-' + cls.id + '">' +
          '<div class="class-assign-label">📝 今日指派生字</div>' +
          '<div class="class-assign-row">' +
            '<input type="text" class="class-assign-input" id="assign-' + cls.id + '"' +
              ' placeholder="輸入今日指派生字，例如：山水火土木" maxlength="30"' +
              ' value="' + escHtml((cls.assignedChars || []).join('')) + '">' +
            '<button class="btn-assign-save" onclick="saveAssignedChars(\'' + cls.id + '\')">儲存</button>' +
          '</div>' +
          '<div class="class-assign-preview" id="assign-count-' + cls.id + '">' +
            ((cls.assignedChars && cls.assignedChars.length) ? '目前指派 ' + cls.assignedChars.length + ' 字：' + cls.assignedChars.join(' ') : '尚未指派') +
          '</div>' +
        '</div>' +
        /* ── 乘法趣面板 ── */
        '<div id="cls-tab-multiply-' + cls.id + '" style="display:none">' +
          '<div class="class-assign-label">✖️ 乘法趣指派</div>' +
          '<div style="font-size:.82rem;color:var(--muted);font-weight:600;padding:6px 0">' +
            '乘法趣讓學生自由練習 0–10 所有乘法表，無需手動指派。' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="class-footer" id="cs-' + cls.id + '">' +
        '<span class="class-stat" id="cs-count-' + cls.id + '" style="color:var(--muted);font-size:.78rem">載入中…</span>' +
        '<button class="btn-view-students" onclick="viewClassStudents(\'' + cls.id + '\',\'' + escHtml(cls.name) + '\')">查看學生 →</button>' +
      '</div>' +
    '</div>';
  }).join('');

  /* 非同步載入各班學生數 */
  currentClasses.forEach(function(cls) {
    db.collection('students').where('classIds', 'array-contains', cls.id).get()
      .then(function(snap) {
        var el = document.getElementById('cs-count-' + cls.id);
        if (el) el.textContent = '👥 ' + snap.size + ' 位學生已加入';
      }).catch(function() {});
  });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── 儲存今日指派生字 ── */
function saveAssignedChars(classId) {
  var input = document.getElementById('assign-' + classId);
  if (!input || !db) return;
  var raw     = input.value.trim();
  var charArr = Array.from(new Set(
    raw.replace(/\s/g, '').split('').filter(function(c) { return c; })
  ));
  input.value = charArr.join('');
  db.collection('classes').doc(classId).update({ assignedChars: charArr })
    .then(function() {
      showToast('✅ 已儲存指派生字（' + charArr.length + ' 字）');
      var previewEl = document.getElementById('assign-count-' + classId);
      if (previewEl) {
        previewEl.textContent = charArr.length
          ? '目前指派 ' + charArr.length + ' 字：' + charArr.join(' ')
          : '尚未指派';
      }
      var cls = currentClasses.find(function(c) { return c.id === classId; });
      if (cls) cls.assignedChars = charArr;
    })
    .catch(function(e) { showToast('儲存失敗：' + e.message); });
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

function fallbackCopy(text, code) {
  var ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); showToast('✅ 邀請碼已複製：' + code); }
  catch(e) { showToast('請手動複製邀請碼'); }
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

/* ── 分享 Modal ── */
var APP_URL = 'https://vaguemoon.github.io/QuEDU/';
var _shareCode = '';
var _shareQR   = null;

function showShareModal(className, inviteCode) {
  _shareCode = inviteCode;

  document.getElementById('share-modal-classname').textContent = className;
  document.getElementById('share-url-text').textContent        = APP_URL;
  document.getElementById('share-invite-code').textContent     = inviteCode;

  /* 產生 QR Code（清除舊的再重建） */
  var qrEl = document.getElementById('share-qrcode');
  qrEl.innerHTML = '';
  if (typeof QRCode !== 'undefined') {
    new QRCode(qrEl, {
      text:          APP_URL,
      width:         160,
      height:        160,
      correctLevel:  QRCode.CorrectLevel.M
    });
  }

  document.getElementById('share-modal').style.display = 'flex';
}

function hideShareModal() {
  document.getElementById('share-modal').style.display = 'none';
}

function copyShareUrl() {
  _copyText(APP_URL, 'App 網址已複製！');
}

function copyShareCode() {
  _copyText(_shareCode, '邀請碼已複製：' + _shareCode);
}

function _copyText(text, msg) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
      .then(function() { showToast('✅ ' + msg); })
      .catch(function() { _fallback(text, msg); });
  } else {
    _fallback(text, msg);
  }
}

function _fallback(text, msg) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); showToast('✅ ' + msg); }
  catch(e) { showToast('請手動複製'); }
  document.body.removeChild(ta);
}

function nativeShare() {
  if (navigator.share) {
    navigator.share({
      title: '上學趣 — 國字學習 App',
      text:  '上學趣 App 邀請您加入班級！\n班級邀請碼：' + _shareCode + '\n加入後就能開始練習！',
      url:   APP_URL
    }).catch(function() {});
  } else {
    /* 桌面版瀏覽器：直接複製完整文字 */
    _copyText(
      '上學趣 App 邀請您加入班級！\n班級邀請碼：' + _shareCode + '\n加入後就能開始練習！\n' + APP_URL,
      '分享文字已複製，貼到 LINE 或 Email 傳給家長！'
    );
  }
}

/* ── 班級卡片：切換 APP 頁籤 ── */
function switchClassTab(classId, appId, btn) {
  ['chinese', 'multiply'].forEach(function(id) {
    var tabBtn  = document.getElementById('cls-tabbtn-' + id + '-' + classId);
    var tabPane = document.getElementById('cls-tab-'    + id + '-' + classId);
    if (tabBtn)  tabBtn.classList.toggle('active', id === appId);
    if (tabPane) tabPane.style.display = id === appId ? '' : 'none';
  });
}

/* ── 切換到班級學生名單 ── */
var currentRosterClassId = null;

function viewClassStudents(classId, className) {
  currentRosterClassId = classId;
  document.getElementById('classes-list-view').style.display = 'none';
  document.getElementById('class-roster-view').style.display = '';
  document.getElementById('roster-class-name').textContent = className;
  loadClassRoster(classId);
}

function backToClasses() {
  document.getElementById('class-roster-view').style.display = 'none';
  document.getElementById('classes-list-view').style.display = '';
}

function refreshRoster() {
  if (currentRosterClassId) loadClassRoster(currentRosterClassId);
}
