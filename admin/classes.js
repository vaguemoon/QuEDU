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
    var inactive   = !cls.active;
    var isHomeroom = cls.classType === 'homeroom';
    var eid = escHtml(cls.id);

    var nameBlock = isHomeroom
      ? '<div class="class-name" id="cn-display-' + eid + '">' +
          escHtml(cls.name) +
          '<span style="font-size:.68rem;font-weight:800;color:#1e40af;background:#dbeafe;padding:2px 7px;border-radius:999px;margin-left:8px;vertical-align:middle">行政班</span>' +
        '</div>'
      : '<div class="class-name" id="cn-display-' + eid + '">' +
          escHtml(cls.name) +
          '<button class="btn-cls-edit" onclick="startEditClassName(\'' + eid + '\',\'' + escHtml(cls.name) + '\')" title="編輯班級名稱">✏️</button>' +
        '</div>' +
        '<div class="class-name-edit-row" id="cn-edit-' + eid + '" style="display:none">' +
          '<input class="class-name-input" id="cn-input-' + eid + '" type="text" maxlength="40"' +
            ' onkeydown="if(event.key===\'Enter\')saveClassName(\'' + eid + '\');if(event.key===\'Escape\')cancelEditClassName(\'' + eid + '\')">' +
          '<button class="btn-sm-green" onclick="saveClassName(\'' + eid + '\')">儲存</button>' +
          '<button class="btn-sm-cancel" onclick="cancelEditClassName(\'' + eid + '\')">取消</button>' +
        '</div>' +
        '<div id="cn-error-' + eid + '" style="font-size:.75rem;color:var(--red);font-weight:700;margin-top:4px"></div>';

    var topActions = isHomeroom
      ? ''
      : '<div class="class-top-actions">' +
          '<button class="btn-share-class" onclick="showShareModal(\'' + escHtml(cls.name) + '\',\'' + cls.inviteCode + '\')">📤 分享</button>' +
          '<button class="btn-cls-toggle" onclick="toggleClassActive(\'' + cls.id + '\',' + !cls.active + ')">' +
            (cls.active ? '停用' : '啟用') + '</button>' +
          '<button class="btn-cls-delete" onclick="confirmDeleteClass(\'' + cls.id + '\',\'' + escHtml(cls.name) + '\')">刪除</button>' +
        '</div>';

    var footer = isHomeroom
      ? '<div class="class-footer" id="cs-' + cls.id + '">' +
          '<span class="class-stat" id="cs-count-' + cls.id + '" style="color:var(--muted);font-size:.78rem">載入中…</span>' +
          '<button class="btn-view-students" onclick="viewClassStudents(\'' + cls.id + '\',\'' + escHtml(cls.name) + '\')">查看學生 →</button>' +
        '</div>'
      : '<div class="class-footer" id="cs-' + cls.id + '">' +
          '<span class="class-stat" id="cs-count-' + cls.id + '" style="color:var(--muted);font-size:.78rem">載入中…</span>' +
          '<button class="btn-roster-add" onclick="showRosterAddModal(\'' + eid + '\',\'' + escHtml(cls.name) + '\')">👥 從名冊加入</button>' +
          '<button class="btn-view-students" onclick="viewClassStudents(\'' + cls.id + '\',\'' + escHtml(cls.name) + '\')">查看學生 →</button>' +
        '</div>';

    var codeRow = isHomeroom ? '' :
      '<div class="class-code-row">' +
        '<span class="class-code">' + cls.inviteCode + '</span>' +
        '<span class="class-status-badge ' + (cls.active ? 'badge-green' : 'badge-gray') + '">' +
          (cls.active ? '邀請中' : '已停用') + '</span>' +
        '<button class="btn-copy-code" onclick="copyCode(\'' + cls.inviteCode + '\')">複製邀請碼</button>' +
      '</div>';

    return '<div class="class-card' + (inactive ? ' class-inactive' : '') + '" id="card-' + eid + '">' +
      '<div class="class-card-top">' +
        '<div class="class-info">' +
          nameBlock +
          codeRow +
        '</div>' +
        topActions +
      '</div>' +
      footer +
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
  document.getElementById('new-class-name').value = '';
  document.getElementById('class-modal-error').textContent = '';
  var btnEl = document.getElementById('btn-create-class');
  btnEl.disabled = false; btnEl.textContent = '建立班級';
}
function hideCreateClassModal() {
  document.getElementById('class-modal').style.display = 'none';
}

function createClass() {
  var name         = document.getElementById('new-class-name').value.trim();
  var grade        = 0;
  var classNumber  = 0;
  var classType    = 'subject';
  var studentCount = 0;
  var errEl        = document.getElementById('class-modal-error');
  var btnEl        = document.getElementById('btn-create-class');
  errEl.textContent = '';

  if (!name) { errEl.textContent = '請輸入班級名稱'; return; }
  if (!db || !currentTeacher) return;

  btnEl.disabled = true;
  btnEl.textContent = '檢查中…';

  /* ── 全校查重（含行政班與其他教師班） ── */
  var nameLower  = name.toLowerCase();
  var checkQuery = currentSchoolId
    ? db.collection('classes').where('schoolId', '==', currentSchoolId).get()
    : Promise.resolve({ forEach: function() {} });

  checkQuery.then(function(snap) {
    var dup = false;
    snap.forEach(function(doc) {
      if ((doc.data().name || '').toLowerCase() === nameLower) dup = true;
    });
    /* 舊式：同教師自建班查重（schoolId 可能空） */
    if (!dup) {
      dup = currentClasses.some(function(c) { return c.name.toLowerCase() === nameLower; });
    }
    if (dup) {
      errEl.textContent = '班級名稱「' + name + '」在此學校已存在，請使用其他名稱。';
      btnEl.disabled = false; btnEl.textContent = '建立班級';
      return;
    }
    _doCreateClass(name, grade, classNumber, classType, studentCount, errEl, btnEl);
  }).catch(function() {
    _doCreateClass(name, grade, classNumber, classType, studentCount, errEl, btnEl);
  });
}

function _doCreateClass(name, grade, classNumber, classType, studentCount, errEl, btnEl) {
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
        classType:    classType,
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

/* ════════════════════════════════
   從名冊加入學生（科任班用）
   ════════════════════════════════ */
var _rosterAddTargetId    = '';  // 目標科任班 classId
var _rosterAddAllStudents = [];  // 全校學生快取（from main）
var _rosterAddClassMap    = {};  // classId → { name, grade, classNumber }

/* 從班名解析年級（一年甲班 → 1，五年體班 → 5） */
function _gradeFromName(name) {
  var m = (name || '').match(/^([一二三四五六])年/);
  return m ? ({ '一':1,'二':2,'三':3,'四':4,'五':5,'六':6 }[m[1]] || 0) : 0;
}

function showRosterAddModal(subjectClassId, subjectClassName) {
  _rosterAddTargetId    = subjectClassId;
  _rosterAddAllStudents = [];
  _rosterAddClassMap    = {};
  document.getElementById('roster-add-modal').style.display = 'flex';
  document.getElementById('roster-add-target-name').textContent = '加入目標：' + subjectClassName;
  document.getElementById('roster-add-grade').value = '';
  document.getElementById('roster-add-class').innerHTML = '<option value="">全部班級</option>';
  document.getElementById('roster-add-list').innerHTML =
    '<div style="text-align:center;padding:24px;color:var(--muted)">載入中…</div>';
  document.getElementById('roster-add-hint').textContent = '';
  document.getElementById('roster-add-count').textContent = '已選 0 人';
  document.getElementById('roster-add-confirm').disabled = true;
  document.getElementById('roster-add-select-all').disabled = true;

  if (!currentSchoolId) {
    document.getElementById('roster-add-list').innerHTML =
      '<div style="padding:20px;color:var(--red);font-size:.85rem;font-weight:700">請先設定所屬學校</div>';
    return;
  }

  Promise.all([
    db.collection('students').where('schoolId', '==', currentSchoolId).get(),
    db.collection('classes').where('schoolId',  '==', currentSchoolId).get()
  ]).then(function(results) {
    results[1].forEach(function(doc) {
      var d = doc.data();
      _rosterAddClassMap[doc.id] = { name: d.name || '', grade: d.grade || _gradeFromName(d.name), classNumber: d.classNumber || 0 };
    });

    results[0].forEach(function(doc) {
      var d = doc.data();
      if (d.status === 'archived') return;
      var classId = d.classId || (d.classIds && d.classIds[0]) || '';
      _rosterAddAllStudents.push({
        id:         doc.id,
        name:       d.name       || '',
        seatNumber: d.seatNumber || 0,
        grade:      d.grade      || 0,
        classId:    classId,
        classIds:   d.classIds   || []
      });
    });

    /* 補抓 schoolId 為空的舊班級文件 */
    var missing = {}, missingIds = [];
    _rosterAddAllStudents.forEach(function(s) {
      if (s.classId && !_rosterAddClassMap[s.classId] && !missing[s.classId]) {
        missing[s.classId] = true;
        missingIds.push(s.classId);
      }
    });
    return missingIds.length
      ? Promise.all(missingIds.map(function(id) { return db.collection('classes').doc(id).get(); }))
          .then(function(docs) {
            docs.forEach(function(doc) {
              if (!doc.exists) return;
              var d = doc.data();
              _rosterAddClassMap[doc.id] = { name: d.name || '', grade: d.grade || _gradeFromName(d.name), classNumber: d.classNumber || 0 };
            });
          })
      : Promise.resolve();
  }).then(function() {
    /* 用 classMap 補齊學生的 grade（學生文件上可能為 0） */
    _rosterAddAllStudents.forEach(function(s) {
      var cls = s.classId ? _rosterAddClassMap[s.classId] : null;
      if (cls && !s.grade) s.grade = cls.grade;
    });
    _rosterAddAllStudents.sort(function(a, b) {
      if (a.grade !== b.grade) return a.grade - b.grade;
      var ca = _rosterAddClassMap[a.classId], cb = _rosterAddClassMap[b.classId];
      var na = ca ? ca.classNumber : 0, nb = cb ? cb.classNumber : 0;
      if (na && nb && na !== nb) return na - nb;
      var nameA = ca ? ca.name : '', nameB = cb ? cb.name : '';
      if (nameA !== nameB) return nameA.localeCompare(nameB, 'zh-TW');
      return a.seatNumber - b.seatNumber;
    });
    _renderRosterAddStudents();
  }).catch(function(e) {
    document.getElementById('roster-add-list').innerHTML =
      '<div style="padding:16px;color:var(--red);font-size:.85rem">載入失敗：' + e.message + '</div>';
  });
}

/* 年級選擇時：重建班級下拉選單（用班名，不用班號）*/
function loadRosterAddClasses() {
  var grade = parseInt(document.getElementById('roster-add-grade').value) || 0;
  var seen = {}, classIds = [];
  _rosterAddAllStudents.forEach(function(s) {
    if (grade && s.grade !== grade) return;
    if (s.classId && !seen[s.classId]) { seen[s.classId] = true; classIds.push(s.classId); }
  });
  classIds.sort(function(a, b) {
    var ca = _rosterAddClassMap[a], cb = _rosterAddClassMap[b];
    var na = ca ? ca.classNumber : 0, nb = cb ? cb.classNumber : 0;
    if (na && nb && na !== nb) return na - nb;
    return (ca ? ca.name : a).localeCompare(cb ? cb.name : b, 'zh-TW');
  });
  document.getElementById('roster-add-class').innerHTML = '<option value="">全部班級</option>'
    + classIds.map(function(id) {
        var cls = _rosterAddClassMap[id];
        return '<option value="' + escHtml(id) + '">' + escHtml(cls ? cls.name : id) + '</option>';
      }).join('');
  _renderRosterAddStudents();
}

/* 班級選擇時：重繪名單 */
function loadRosterAddStudents() {
  _renderRosterAddStudents();
}

function _renderRosterAddStudents() {
  var grade   = parseInt(document.getElementById('roster-add-grade').value) || 0;
  var classId = document.getElementById('roster-add-class').value;
  var listEl  = document.getElementById('roster-add-list');

  var filtered = _rosterAddAllStudents.filter(function(s) {
    if (grade   && s.grade   !== grade)   return false;
    if (classId && s.classId !== classId) return false;
    return true;
  });

  if (!filtered.length) {
    listEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);font-size:.85rem">沒有符合條件的學生</div>';
    document.getElementById('roster-add-select-all').disabled = true;
    return;
  }

  listEl.innerHTML = '<table style="width:100%;border-collapse:collapse">'
    + filtered.map(function(s) {
        var cls       = _rosterAddClassMap[s.classId];
        var classStr  = cls ? cls.name : (s.grade ? s.grade + '年' : '—');
        var label     = s.seatNumber ? s.seatNumber + ' 號' : '—';
        var nameStr   = s.name || '（未填姓名）';
        var alreadyIn = s.classIds.indexOf(_rosterAddTargetId) !== -1;
        var already   = alreadyIn
          ? '<span style="font-size:.7rem;color:var(--green);font-weight:800;margin-left:6px">已在班</span>' : '';
        return '<tr style="border-bottom:1px solid var(--border)">'
          + '<td style="padding:8px 16px;width:40px">'
          +   '<input type="checkbox" class="roster-add-chk" data-id="' + escHtml(s.id) + '"'
          +   (alreadyIn ? ' disabled checked' : '')
          +   ' onchange="updateRosterAddCount()">'
          + '</td>'
          + '<td style="padding:8px 4px;font-weight:900;color:var(--muted);width:50px">' + label + '</td>'
          + '<td style="padding:8px 8px;font-weight:700">' + escHtml(nameStr) + already + '</td>'
          + '<td style="padding:8px 8px;font-size:.8rem;color:var(--muted)">' + escHtml(classStr) + '</td>'
          + '</tr>';
      }).join('')
    + '</table>';

  document.getElementById('roster-add-select-all').disabled = false;
  updateRosterAddCount();
}

function updateRosterAddCount() {
  var checked = document.querySelectorAll('.roster-add-chk:not([disabled]):checked').length;
  document.getElementById('roster-add-count').textContent = '已選 ' + checked + ' 人';
  document.getElementById('roster-add-confirm').disabled = checked === 0;
}

function toggleAllRosterStudents() {
  var boxes    = document.querySelectorAll('.roster-add-chk:not([disabled])');
  var allChecked = Array.prototype.every.call(boxes, function(b) { return b.checked; });
  boxes.forEach(function(b) { b.checked = !allChecked; });
  var btn = document.getElementById('roster-add-select-all');
  btn.textContent = allChecked ? '全選' : '取消全選';
  updateRosterAddCount();
}

function closeRosterAddModal() {
  document.getElementById('roster-add-modal').style.display = 'none';
  _rosterAddTargetId = '';
}

function confirmRosterAdd() {
  var boxes = document.querySelectorAll('.roster-add-chk:not([disabled]):checked');
  if (!boxes.length) return;

  var btn = document.getElementById('roster-add-confirm');
  btn.disabled = true; btn.textContent = '加入中…';

  var batch = db.batch();
  boxes.forEach(function(box) {
    var sid = box.getAttribute('data-id');
    batch.update(db.collection('students').doc(sid), {
      classIds: firebase.firestore.FieldValue.arrayUnion(_rosterAddTargetId)
    });
  });

  batch.commit()
    .then(function() {
      closeRosterAddModal();
      showToast('✅ 已加入 ' + boxes.length + ' 位學生');
      loadClasses();
    })
    .catch(function(e) {
      btn.disabled = false; btn.textContent = '加入班級';
      showToast('加入失敗：' + e.message);
    });
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
