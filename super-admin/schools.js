/**
 * super-admin/schools.js — 學校管理：手風琴列表 + 教師帳號管理
 * Firestore：
 *   schools/{schoolId}  → { name, active, createdAt, createdBy }
 *   teachers/{uid}      → { email, displayName, lastLoginAt, blocked, schoolId, schoolName }
 */
'use strict';

var _allSchools  = [];  // [{ id, name, active, createdAt }]
var _allTeachers = [];  // [{ id, email, displayName, lastLoginAt, blocked, schoolId }]
var _openSchools = {};  // { schoolId: true/false } 手風琴開關狀態

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
        schoolName:  d.schoolName   || ''
      });
    });

    _renderSchools(wrap);
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
        + _renderTeacherTable(teachers, school.id)
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

    /* 指定學校：顯示 inline select */
    var assignCell = _renderAssignCell(t);

    return '<tr>'
      + '<td><strong>' + escHtml(t.displayName) + '</strong></td>'
      + '<td style="color:var(--muted);font-size:.82rem">' + escHtml(t.email) + '</td>'
      + '<td style="color:var(--muted);font-size:.78rem">' + lastLogin + '</td>'
      + '<td>' + statusBadge + '</td>'
      + '<td style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' + blockBtn + assignCell + '</td>'
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

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
