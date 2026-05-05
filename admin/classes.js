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
    var eid = escHtml(cls.id);
    return '<div class="class-card' + (inactive ? ' class-inactive' : '') + '" id="card-' + eid + '">' +
      '<div class="class-card-top">' +
        '<div class="class-info">' +
          '<div class="class-name" id="cn-display-' + eid + '">' +
            escHtml(cls.name) +
            '<button class="btn-cls-edit" onclick="startEditClassName(\'' + eid + '\',\'' + escHtml(cls.name) + '\')" title="編輯班級名稱">✏️</button>' +
          '</div>' +
          '<div class="class-name-edit-row" id="cn-edit-' + eid + '" style="display:none">' +
            '<input class="class-name-input" id="cn-input-' + eid + '" type="text" maxlength="40"' +
              ' onkeydown="if(event.key===\'Enter\')saveClassName(\'' + eid + '\');if(event.key===\'Escape\')cancelEditClassName(\'' + eid + '\')">' +
            '<button class="btn-sm-green" onclick="saveClassName(\'' + eid + '\')">儲存</button>' +
            '<button class="btn-sm-cancel" onclick="cancelEditClassName(\'' + eid + '\')">取消</button>' +
          '</div>' +
          '<div id="cn-error-' + eid + '" style="font-size:.75rem;color:var(--red);font-weight:700;margin-top:4px"></div>' +
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

/* ── 班級名稱自動帶入 ── */
function updateClassNamePreview() {
  var grade  = document.getElementById('new-class-grade').value;
  var number = document.getElementById('new-class-number').value;
  var nameEl = document.getElementById('new-class-name');
  if (grade && grade !== '0' && number) {
    nameEl.value = grade + '年' + number + '班';
  }
}

/* ── 新增班級 Modal ── */
function showCreateClassModal() {
  document.getElementById('class-modal').style.display = 'flex';
  document.getElementById('new-class-grade').value = '';
  document.getElementById('new-class-number').value = '';
  document.getElementById('new-class-name').value = '';
  document.getElementById('new-class-student-count').value = '0';
  document.getElementById('class-modal-error').textContent = '';
  var btnEl = document.getElementById('btn-create-class');
  btnEl.disabled = false; btnEl.textContent = '建立班級';
}
function hideCreateClassModal() {
  document.getElementById('class-modal').style.display = 'none';
}

function createClass() {
  var name         = document.getElementById('new-class-name').value.trim();
  var grade        = parseInt(document.getElementById('new-class-grade').value) || 0;
  var classNumber  = parseInt(document.getElementById('new-class-number').value) || 0;
  var studentCount = parseInt(document.getElementById('new-class-student-count').value) || 0;
  var errEl        = document.getElementById('class-modal-error');
  var btnEl        = document.getElementById('btn-create-class');
  errEl.textContent = '';

  if (!name) { errEl.textContent = '請輸入班級名稱'; return; }
  if (studentCount < 0 || studentCount > 60) { errEl.textContent = '學生人數請填 0–60'; return; }
  if (!db || !currentTeacher) return;

  /* ── 重複偵測 ── */
  var nameLower = name.toLowerCase();
  var dupName = currentClasses.some(function(c) {
    return c.name.toLowerCase() === nameLower;
  });
  if (dupName) { errEl.textContent = '班級名稱「' + name + '」已存在，請勿重複建立。'; return; }
  if (grade && classNumber) {
    var dupNum = currentClasses.some(function(c) {
      return c.grade === grade && c.classNumber === classNumber;
    });
    if (dupNum) { errEl.textContent = grade + '年' + classNumber + '班已存在，請勿重複建立。'; return; }
  }

  btnEl.disabled = true;
  btnEl.textContent = studentCount > 0 ? '建立中（產生帳號）…' : '建立中…';

  var code    = generateInviteCode();
  var classId = null;

  db.collection('classes').where('inviteCode', '==', code).get()
    .then(function(snap) {
      if (!snap.empty) code = generateInviteCode();
      return db.collection('classes').add({
        name:         name,
        grade:        grade,
        classNumber:  classNumber,
        schoolId:     currentSchoolId   || '',
        schoolName:   currentSchoolName || '',
        teacherUid:   currentTeacher.uid,
        teacherEmail: currentTeacher.email || '',
        inviteCode:   code,
        active:       true,
        createdAt:    new Date().toISOString()
      });
    })
    .then(function(ref) {
      classId = ref.id;
      if (studentCount <= 0) return Promise.resolve();
      return _generateStudentAccounts(classId, grade, classNumber, studentCount);
    })
    .then(function() {
      hideCreateClassModal();
      loadClasses();
      var msg = studentCount > 0
        ? '🎉 班級「' + name + '」建立成功，已產生 ' + studentCount + ' 個座號帳號！'
        : '🎉 班級「' + name + '」建立成功！';
      showToast(msg);
    })
    .catch(function(e) {
      errEl.textContent = '建立失敗：' + e.message;
      btnEl.disabled = false; btnEl.textContent = '建立班級';
    });
}

/* ── 批次產生座號帳號 ── */
function _generateStudentAccounts(classId, grade, classNumber, count) {
  var BATCH_SIZE = 500;
  var batches    = [];
  var batch      = db.batch();
  var batchCount = 0;

  for (var i = 1; i <= count; i++) {
    var ref = db.collection('students').doc();
    batch.set(ref, {
      schoolId:    currentSchoolId   || '',
      schoolName:  currentSchoolName || '',
      classId:     classId,
      classIds:    [classId],
      grade:       grade,
      classNumber: classNumber,
      seatNumber:  i,
      name:        '',
      pin:         '0000',
      createdAt:   Date.now(),
      lastSeen:    null
    });
    batchCount++;
    if (batchCount === BATCH_SIZE) {
      batches.push(batch.commit());
      batch      = db.batch();
      batchCount = 0;
    }
  }
  if (batchCount > 0) batches.push(batch.commit());
  return Promise.all(batches);
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

/* ── 切換到班級學生名單 ── */
var currentRosterClassId = null;

function viewClassStudents(classId, className) {
  currentRosterClassId = classId;
  document.getElementById('classes-list-view').style.display = 'none';
  document.getElementById('class-roster-view').style.display = '';
  document.getElementById('roster-class-name').textContent = className;
  var namesLabel = document.getElementById('roster-names-class-name');
  if (namesLabel) namesLabel.textContent = className;
  /* 切回進度頁籤（預設） */
  var progressView = document.getElementById('roster-progress-view');
  var namesView    = document.getElementById('roster-names-view');
  if (progressView) progressView.style.display = '';
  if (namesView)    namesView.style.display    = 'none';
  var tabs = document.querySelectorAll('#roster-app-tabs .app-tab-mini');
  tabs.forEach(function(b, i) { b.classList.toggle('active', i === 0); });
  loadClassRoster(classId);
}

function backToClasses() {
  document.getElementById('class-roster-view').style.display = 'none';
  document.getElementById('classes-list-view').style.display = '';
}

function refreshRoster() {
  if (currentRosterClassId) loadClassRoster(currentRosterClassId);
}

/* ── 班級名稱 inline 編輯 ── */
function startEditClassName(classId, currentName) {
  document.getElementById('cn-display-' + classId).style.display = 'none';
  var editRow = document.getElementById('cn-edit-' + classId);
  editRow.style.display = 'flex';
  var input = document.getElementById('cn-input-' + classId);
  input.value = currentName;
  input.focus();
  input.select();
  document.getElementById('cn-error-' + classId).textContent = '';
}

function cancelEditClassName(classId) {
  document.getElementById('cn-edit-' + classId).style.display = 'none';
  document.getElementById('cn-display-' + classId).style.display = '';
  document.getElementById('cn-error-' + classId).textContent = '';
}

function saveClassName(classId) {
  var input  = document.getElementById('cn-input-' + classId);
  var errEl  = document.getElementById('cn-error-' + classId);
  var newName = input.value.trim();
  errEl.textContent = '';

  if (!newName) { errEl.textContent = '班級名稱不能為空'; return; }

  /* 重複偵測（排除自身） */
  var nameLower = newName.toLowerCase();
  var dup = currentClasses.some(function(c) {
    return c.id !== classId && c.name.toLowerCase() === nameLower;
  });
  if (dup) { errEl.textContent = '班級名稱「' + newName + '」已存在，請更換名稱。'; return; }

  input.disabled = true;
  db.collection('classes').doc(classId).update({ name: newName })
    .then(function() {
      /* 更新本地快取 */
      var cls = currentClasses.find(function(c) { return c.id === classId; });
      if (cls) cls.name = newName;
      /* 更新顯示文字（不重新整理整個列表，保留開啟狀態）*/
      var displayEl = document.getElementById('cn-display-' + classId);
      if (displayEl) {
        displayEl.innerHTML = escHtml(newName)
          + '<button class="btn-cls-edit" onclick="startEditClassName(\'' + classId + '\',\'' + escHtml(newName).replace(/'/g,'&#39;') + '\')" title="編輯班級名稱">✏️</button>';
      }
      cancelEditClassName(classId);
      showToast('✅ 班級名稱已更新為「' + newName + '」');
    })
    .catch(function(e) {
      errEl.textContent = '儲存失敗：' + e.message;
      input.disabled = false;
    });
}
