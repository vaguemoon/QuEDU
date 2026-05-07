/**
 * super-admin/schools.js — 學校管理：手風琴列表 + 教師帳號管理
 * Firestore：
 *   schools/{schoolId}  → { name, active, createdAt, createdBy }
 *   teachers/{uid}      → { email, displayName, lastLoginAt, blocked, schoolId, schoolName }
 */
'use strict';

var _allSchools     = [];  // [{ id, name, active, createdAt }]
var _allTeachers    = [];  // [{ id, email, displayName, lastLoginAt, blocked, schoolId }]
var _openSchools    = {};  // { schoolId: true/false } 手風琴開關狀態
var _activeTab      = {};  // { schoolId: 'teachers'|'students' }
var _schoolStudents = {};  // { schoolId: { loaded: bool, classes: [...] } } 學生快取

/* ════════════════════════════════
   載入（學校 + 教師 並行）
   ════════════════════════════════ */
function loadSchools() {
  if (!db) { setTimeout(loadSchools, 400); return; }

  var wrap = document.getElementById('schools-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  Promise.all([
    db.collection('schools').get(),
    db.collection('teachers').get()
  ])
  .then(function(results) {
    _allSchools = [];
    results[0].forEach(function(doc) {
      var d = doc.data();
      _allSchools.push({ id: doc.id, name: d.name || '（未命名）', active: d.active !== false, createdAt: d.createdAt || 0 });
    });
    _allSchools.sort(function(a, b) { return a.name.localeCompare(b.name, 'zh-TW'); });

    _allTeachers = [];
    results[1].forEach(function(doc) {
      var d = doc.data();
      _allTeachers.push({
        id:          doc.id,
        email:       d.email        || '—',
        displayName: d.displayName  || '—',
        lastLoginAt: d.lastLoginAt  || '',
        blocked:     !!d.blocked,
        schoolId:    d.schoolId     || '',
        schoolName:  d.schoolName   || '',
        role:        d.role         || 'teacher'
      });
    });

    _renderSchools(wrap);
    refreshBulkSchoolSelect();
  })
  .catch(function(e) {
    wrap.innerHTML = '<div style="color:var(--red);padding:20px;font-weight:700">載入失敗：' + e.message + '</div>';
  });
}

/* ════════════════════════════════
   渲染手風琴列表
   ════════════════════════════════ */
function _renderSchools(wrap) {
  var html = '';

  /* ── 各學校 ── */
  _allSchools.forEach(function(school) {
    var teachers = _allTeachers.filter(function(t) { return t.schoolId === school.id; });
    var isOpen   = !!_openSchools[school.id];
    var statusBadge = school.active
      ? '<span class="badge badge-green" style="font-size:.72rem">啟用中</span>'
      : '<span class="badge badge-red"   style="font-size:.72rem">已停用</span>';
    var toggleBtn = school.active
      ? '<button class="btn-sm-red"   onclick="event.stopPropagation();setSchoolActive(\'' + escHtml(school.id) + '\',false)">停用</button>'
      : '<button class="btn-sm-green" onclick="event.stopPropagation();setSchoolActive(\'' + escHtml(school.id) + '\',true)">啟用</button>';

    html +=
      '<div class="school-accordion">'
      + '<div class="school-acc-header" onclick="toggleSchoolAccordion(\'' + escHtml(school.id) + '\')">'
        + '<span class="school-acc-name">' + escHtml(school.name) + '</span>'
        + '<span class="school-acc-count">' + teachers.length + ' 位教師</span>'
        + statusBadge
        + toggleBtn
        + '<span class="school-acc-arrow' + (isOpen ? ' open' : '') + '" id="arr-' + escHtml(school.id) + '">▼</span>'
      + '</div>'
      + '<div class="school-acc-body" id="body-' + escHtml(school.id) + '" style="display:' + (isOpen ? '' : 'none') + '">'
        + _renderSchoolTabs(school.id, teachers)
      + '</div>'
      + '</div>';
  });

  /* ── 其他（未登錄學校）── */
  var others = _allTeachers.filter(function(t) { return !t.schoolId; });
  var othersOpen = !!_openSchools['__others__'];
  html +=
    '<div class="school-accordion">'
    + '<div class="school-acc-header" style="background:#fffbeb" onclick="toggleSchoolAccordion(\'__others__\')">'
      + '<span class="school-acc-name">⚠️ 其他（未選擇學校）</span>'
      + '<span class="school-acc-count">' + others.length + ' 位教師</span>'
      + '<span style="font-size:.72rem;font-weight:700;color:#92400e;background:#fef3c7;padding:2px 8px;border-radius:999px">潛在客戶</span>'
      + '<span class="school-acc-arrow' + (othersOpen ? ' open' : '') + '" id="arr-__others__">▼</span>'
    + '</div>'
    + '<div class="school-acc-body" id="body-__others__" style="display:' + (othersOpen ? '' : 'none') + '">'
      + _renderTeacherTable(others, '')
    + '</div>'
    + '</div>';

  /* ── 新增學校表單 ── */
  html +=
    '<div style="margin-top:16px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
    + '<input id="new-school-name" type="text" class="add-admin-input" placeholder="輸入學校名稱（例如：太平國小）" onkeydown="if(event.key===\'Enter\')addSchool()">'
    + '<button class="btn-save-lesson" style="padding:9px 18px" onclick="addSchool()"><span>＋</span><span>新增學校</span></button>'
    + '</div>'
    + '<div id="add-school-status" style="margin-top:8px;font-size:.82rem;font-weight:700"></div>';

  wrap.innerHTML = html;
}

/* ════════════════════════════════
   學校手風琴內的頁籤
   ════════════════════════════════ */
function _renderSchoolTabs(schoolId, teachers) {
  var sid = escHtml(schoolId);
  return '<div style="padding:10px 14px 0">'
    + '<div style="display:flex;gap:4px;border-bottom:2px solid var(--border);margin-bottom:0">'
      + '<button class="sa-tab-btn active">教師（' + teachers.length + '）</button>'
    + '</div>'
  + '</div>'
  + '<div id="sa-tab-teachers-' + sid + '">'
    + _renderTeacherTable(teachers, schoolId)
  + '</div>';
}

/* ════════════════════════════════
   學生名單（依學校 lazy-load）
   ════════════════════════════════ */
function loadSchoolStudents(schoolId) {
  var wrap = document.getElementById('sa-students-wrap-' + schoolId);
  if (!wrap) return;
  /* 已載入過則直接 re-render（不重打 Firestore）*/
  if (_schoolStudents[schoolId] && _schoolStudents[schoolId].loaded) {
    _renderSchoolStudents(wrap, _schoolStudents[schoolId].classes);
    return;
  }
  wrap.innerHTML = '<div style="text-align:center;padding:20px"><div class="spinner"></div></div>';

  Promise.all([
    db.collection('classes').where('schoolId', '==', schoolId).where('classType', '==', 'homeroom').get(),
    db.collection('students').where('schoolId', '==', schoolId).get()
  ]).then(function(results) {
    var classMap = {};
    results[0].forEach(function(doc) {
      var d = doc.data();
      classMap[doc.id] = { id: doc.id, schoolId: schoolId, name: d.name || '（未命名）', grade: d.grade || 0, classNumber: d.classNumber || 0, students: [] };
    });
    results[1].forEach(function(doc) {
      var d = doc.data();
      var cls = classMap[d.classId];
      if (cls) {
        cls.students.push({ id: doc.id, seat: d.seatNumber || 0, name: d.name || '', pin: d.pin || '0000' });
      }
    });

    var classes = Object.values(classMap);
    classes.sort(function(a, b) {
      if (a.grade !== b.grade) return a.grade - b.grade;
      return a.classNumber - b.classNumber;
    });
    classes.forEach(function(cls) {
      cls.students.sort(function(a, b) { return a.seat - b.seat; });
    });

    _schoolStudents[schoolId] = { loaded: true, classes: classes };
    _renderSchoolStudents(wrap, classes);
  }).catch(function(e) {
    wrap.innerHTML = '<div style="color:var(--red);padding:14px;font-size:.85rem">載入失敗：' + e.message + '</div>';
  });
}

function _renderSchoolStudents(wrap, classes) {
  if (!classes.length) {
    wrap.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);font-size:.85rem">此學校尚未匯入學生名單。</div>';
    return;
  }

  var totalStudents = classes.reduce(function(s, c) { return s + c.students.length; }, 0);

  var html = '<div style="margin-bottom:10px;font-size:.78rem;font-weight:700;color:var(--muted)">'
    + classes.length + ' 個原班・共 ' + totalStudents + ' 位學生'
    + '<button onclick="_refreshSchoolStudents(\'' + escHtml(wrap.id.replace('sa-students-wrap-','')) + '\')"'
      + ' style="margin-left:10px;background:none;border:none;cursor:pointer;font-size:.78rem;color:var(--blue);font-weight:700;padding:0">🔄 重新整理</button>'
  + '</div>';

  html += classes.map(function(cls) {
    var sid = escHtml(cls.id);
    var studentRows = cls.students.length
      ? cls.students.map(function(s) {
          var eid  = escHtml(s.id);
          var eSid = escHtml(cls.schoolId || '');
          return '<tr id="sa-srow-' + eid + '" style="border-bottom:1px solid var(--border)">'
            + '<td style="padding:6px 10px;width:56px;font-weight:900;color:var(--muted);font-size:.78rem">' + s.seat + ' 號</td>'
            + '<td style="padding:6px 8px;font-weight:700;font-size:.85rem" id="sa-sname-' + eid + '">' + escHtml(s.name || '（未填）') + '</td>'
            + '<td style="padding:6px 8px;font-family:\'Courier New\',monospace;font-size:.78rem;color:var(--muted)" id="sa-spin-' + eid + '">' + escHtml(s.pin) + '</td>'
            + '<td style="padding:4px 8px;white-space:nowrap">'
              + '<button class="btn-sm" onclick="openStudentEditModal(\'' + eid + '\',\'' + escHtml(s.name) + '\',\'' + escHtml(s.pin) + '\',\'' + eSid + '\')">編輯</button>'
              + ' <button class="btn-sm-red" style="font-size:.72rem;padding:3px 8px" onclick="deleteSchoolStudent(\'' + eid + '\',\'' + escHtml(s.name || s.seat + '號') + '\',\'' + eSid + '\')">刪除</button>'
            + '</td>'
            + '</tr>';
        }).join('')
      : '<tr><td colspan="4" style="padding:12px;text-align:center;color:var(--muted);font-size:.82rem">此班無學生</td></tr>';

    return '<details style="border:1.5px solid var(--border);border-radius:10px;margin-bottom:8px;overflow:hidden">'
      + '<summary style="padding:10px 14px;cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;background:#f8fafc;font-weight:800;font-size:.88rem">'
        + '<span style="flex:1">' + escHtml(cls.name) + '</span>'
        + '<span style="font-size:.72rem;font-weight:700;color:var(--muted);background:white;padding:2px 8px;border-radius:999px;border:1px solid var(--border)">'
          + cls.students.length + ' 人</span>'
      + '</summary>'
      + '<table style="width:100%;border-collapse:collapse">'
        + '<thead style="background:#f1f5f9"><tr>'
          + '<th style="text-align:left;padding:6px 10px;font-size:.68rem;color:var(--muted);font-weight:800">座號</th>'
          + '<th style="text-align:left;padding:6px 8px;font-size:.68rem;color:var(--muted);font-weight:800">姓名</th>'
          + '<th style="text-align:left;padding:6px 8px;font-size:.68rem;color:var(--muted);font-weight:800">PIN</th>'
          + '<th></th>'
        + '</tr></thead>'
        + '<tbody>' + studentRows + '</tbody>'
      + '</table>'
    + '</details>';
  }).join('');

  wrap.innerHTML = html;
}

function _refreshSchoolStudents(schoolId) {
  if (_schoolStudents[schoolId]) _schoolStudents[schoolId].loaded = false;
  loadSchoolStudents(schoolId);
}

/* ════════════════════════════════
   學生編輯 Modal
   ════════════════════════════════ */
var _editStudentId  = '';
var _editSchoolId   = '';

function openStudentEditModal(studentId, name, pin, schoolId) {
  _editStudentId = studentId;
  _editSchoolId  = schoolId;
  document.getElementById('sa-edit-student-name').value = name;
  document.getElementById('sa-edit-student-pin').value  = pin;
  document.getElementById('sa-edit-student-err').textContent = '';
  var saveBtn = document.getElementById('sa-edit-student-save');
  saveBtn.disabled = false; saveBtn.textContent = '儲存';
  document.getElementById('sa-edit-student-modal').style.display = 'flex';
  document.getElementById('sa-edit-student-name').focus();
}

function closeStudentEditModal() {
  document.getElementById('sa-edit-student-modal').style.display = 'none';
}

function saveSchoolStudent() {
  var name    = document.getElementById('sa-edit-student-name').value.trim();
  var pin     = document.getElementById('sa-edit-student-pin').value.trim();
  var errEl   = document.getElementById('sa-edit-student-err');
  var saveBtn = document.getElementById('sa-edit-student-save');
  errEl.textContent = '';

  if (!/^\d{4}$/.test(pin)) { errEl.textContent = 'PIN 須為 4 位數字'; return; }

  saveBtn.disabled = true; saveBtn.textContent = '儲存中…';

  db.collection('students').doc(_editStudentId).update({ name: name, pin: pin })
    .then(function() {
      /* 更新快取 */
      _updateStudentCache(_editSchoolId, _editStudentId, { name: name, pin: pin });
      /* 就地更新畫面，不重渲染整個列表 */
      var nameEl = document.getElementById('sa-sname-' + _editStudentId);
      var pinEl  = document.getElementById('sa-spin-' + _editStudentId);
      if (nameEl) nameEl.textContent = name || '（未填）';
      if (pinEl)  pinEl.textContent  = pin;
      closeStudentEditModal();
      showToast('✅ 已儲存');
    })
    .catch(function(e) {
      errEl.textContent = '儲存失敗：' + e.message;
      saveBtn.disabled = false; saveBtn.textContent = '儲存';
    });
}

/* ── 刪除學生 ── */
function deleteSchoolStudent(studentId, label, schoolId) {
  if (!confirm('確定要刪除「' + label + '」的所有資料？\n此操作無法復原！')) return;
  db.collection('students').doc(studentId).delete()
    .then(function() {
      /* 從快取移除 */
      _removeStudentFromCache(schoolId, studentId);
      /* 移除 DOM 列 */
      var row = document.getElementById('sa-srow-' + studentId);
      if (row) row.remove();
      showToast('已刪除學生資料');
    })
    .catch(function(e) { showToast('刪除失敗：' + e.message); });
}

/* ── 快取操作 ── */
function _updateStudentCache(schoolId, studentId, updates) {
  var cache = _schoolStudents[schoolId];
  if (!cache) return;
  cache.classes.forEach(function(cls) {
    cls.students.forEach(function(s) {
      if (s.id === studentId) { Object.assign(s, updates); }
    });
  });
}

function _removeStudentFromCache(schoolId, studentId) {
  var cache = _schoolStudents[schoolId];
  if (!cache) return;
  cache.classes.forEach(function(cls) {
    cls.students = cls.students.filter(function(s) { return s.id !== studentId; });
  });
}

/* ════════════════════════════════
   教師表格（共用：school 內 + 其他）
   ════════════════════════════════ */
function _renderTeacherTable(teachers, schoolId) {
  if (!teachers.length) {
    return '<div style="padding:16px;text-align:center;color:var(--muted);font-size:.85rem;font-weight:600">目前無教師</div>';
  }

  var rows = teachers.map(function(t) {
    var lastLogin = t.lastLoginAt
      ? new Date(t.lastLoginAt).toLocaleString('zh-TW', { year:'numeric', month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' })
      : '—';
    var statusBadge = t.blocked
      ? '<span class="badge badge-red">已封鎖</span>'
      : '<span class="badge badge-green">正常</span>';
    var blockBtn = t.blocked
      ? '<button class="btn-sm-green" onclick="setTeacherBlocked(\'' + escHtml(t.id) + '\',false)">解除封鎖</button>'
      : '<button class="btn-sm-red"   onclick="setTeacherBlocked(\'' + escHtml(t.id) + '\',true)">封鎖</button>';
    var isAdmin   = t.role === 'school-admin';
    var roleBadge = isAdmin
      ? '<span class="badge" style="background:#dbeafe;color:#1e40af;font-size:.68rem;margin-left:4px">校管理者</span>'
      : '';
    var roleBtn   = isAdmin
      ? '<button class="btn-sm" onclick="setTeacherRole(\'' + escHtml(t.id) + '\',\'teacher\')">移除管理者</button>'
      : '<button class="btn-sm" onclick="setTeacherRole(\'' + escHtml(t.id) + '\',\'school-admin\')">設校管理者</button>';

    /* 指定學校：顯示 inline select */
    var assignCell = _renderAssignCell(t);

    return '<tr>'
      + '<td><strong>' + escHtml(t.displayName) + '</strong>' + roleBadge + '</td>'
      + '<td style="color:var(--muted);font-size:.82rem">' + escHtml(t.email) + '</td>'
      + '<td style="color:var(--muted);font-size:.78rem">' + lastLogin + '</td>'
      + '<td>' + statusBadge + '</td>'
      + '<td style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' + blockBtn + roleBtn + assignCell + '</td>'
      + '</tr>';
  }).join('');

  return '<div style="overflow-x:auto">'
    + '<table class="sa-table">'
    + '<thead><tr><th>姓名</th><th>Email</th><th>最後登入</th><th>狀態</th><th>操作</th></tr></thead>'
    + '<tbody>' + rows + '</tbody>'
    + '</table></div>';
}

function _renderAssignCell(t) {
  var options = _allSchools.map(function(s) {
    var sel = s.id === t.schoolId ? ' selected' : '';
    return '<option value="' + escHtml(s.id) + '"' + sel + '>' + escHtml(s.name) + '</option>';
  }).join('');
  return '<select onchange="assignTeacherSchool(\'' + escHtml(t.id) + '\',this)"'
    + ' style="border:1.5px solid var(--border);border-radius:6px;padding:4px 7px;font-size:.78rem;font-family:inherit;max-width:130px">'
    + '<option value="">── 未選擇 ──</option>'
    + options
    + '</select>';
}

/* ════════════════════════════════
   手風琴開關
   ════════════════════════════════ */
function toggleSchoolAccordion(schoolId) {
  var body  = document.getElementById('body-' + schoolId);
  var arrow = document.getElementById('arr-' + schoolId);
  if (!body) return;
  var isOpen = body.style.display !== 'none';
  body.style.display  = isOpen ? 'none' : '';
  _openSchools[schoolId] = !isOpen;
  if (arrow) arrow.classList.toggle('open', !isOpen);
}

/* ════════════════════════════════
   封鎖 / 解封鎖教師
   ════════════════════════════════ */
function setTeacherBlocked(uid, blocked) {
  if (!db) return;
  if (!confirm('確定要' + (blocked ? '封鎖' : '解除封鎖') + '此教師帳號？')) return;
  db.collection('teachers').doc(uid).update({ blocked: blocked })
    .then(function() {
      showToast(blocked ? '已封鎖此教師' : '✅ 已解除封鎖');
      loadSchools();
    })
    .catch(function(e) { showToast('操作失敗：' + e.message); });
}

/* ════════════════════════════════
   指定教師學校
   ════════════════════════════════ */
function assignTeacherSchool(uid, selectEl) {
  var schoolId = selectEl.value;
  var school   = _allSchools.find(function(s) { return s.id === schoolId; });
  var schoolName = school ? school.name : '';

  db.collection('teachers').doc(uid).update({ schoolId: schoolId, schoolName: schoolName })
    .then(function() {
      showToast(schoolId ? '✅ 已指定學校：' + schoolName : '已清除學校');
      /* 更新 _allTeachers 緩存，避免重新載入 */
      var t = _allTeachers.find(function(x) { return x.id === uid; });
      if (t) { t.schoolId = schoolId; t.schoolName = schoolName; }
      var wrap = document.getElementById('schools-wrap');
      if (wrap) _renderSchools(wrap);
    })
    .catch(function(e) { showToast('指定失敗：' + e.message); selectEl.value = ''; });
}

/* ════════════════════════════════
   啟用 / 停用學校
   ════════════════════════════════ */
function setSchoolActive(schoolId, active) {
  if (!db) return;
  if (!confirm('確定要' + (active ? '啟用' : '停用') + '此學校？')) return;
  db.collection('schools').doc(schoolId).update({ active: active })
    .then(function() {
      showToast(active ? '✅ 學校已啟用' : '學校已停用');
      loadSchools();
    })
    .catch(function(e) { showToast('操作失敗：' + e.message); });
}

/* ════════════════════════════════
   新增學校
   ════════════════════════════════ */
function addSchool() {
  if (!db) return;
  var input  = document.getElementById('new-school-name');
  var status = document.getElementById('add-school-status');
  if (!input) return;
  var name = (input.value || '').trim();
  if (!name) { status.style.color = 'var(--red)'; status.textContent = '請輸入學校名稱。'; return; }

  status.style.color = 'var(--muted)'; status.textContent = '建立中…';
  db.collection('schools').add({
    name:      name,
    active:    true,
    createdAt: Date.now(),
    createdBy: currentAdmin ? currentAdmin.uid : ''
  })
  .then(function() {
    input.value = '';
    status.style.color = 'var(--green)'; status.textContent = '✅ 學校「' + name + '」已建立。';
    loadSchools();
  })
  .catch(function(e) { status.style.color = 'var(--red)'; status.textContent = '建立失敗：' + e.message; });
}

/* ════════════════════════════════
   設定 / 移除校管理者角色
   ════════════════════════════════ */
function setTeacherRole(uid, role) {
  var label = role === 'school-admin' ? '設為校管理者' : '移除管理者權限';
  if (!confirm('確定要' + label + '？')) return;
  db.collection('teachers').doc(uid).update({ role: role })
    .then(function() {
      showToast(role === 'school-admin' ? '✅ 已設為校管理者' : '已移除管理者權限');
      var t = _allTeachers.find(function(x) { return x.id === uid; });
      if (t) t.role = role;
      var wrap = document.getElementById('schools-wrap');
      if (wrap) _renderSchools(wrap);
    })
    .catch(function(e) { showToast('操作失敗：' + e.message); });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
