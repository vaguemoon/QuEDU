/**
 * admin/school-admin.js — 校務管理：全校學生名單（Main）、學年升級工具
 * 依賴：shared.js（db、showToast）、init.js（currentTeacher、currentSchoolId、currentSchoolName）
 */
'use strict';

var _saAllStudents   = [];
var _saClassMap      = {};   // classId → { name, grade, classNumber }
var _saClasses       = [];   // 完整班級資料（行政班）
var _saLoaded          = false;
var _saClassesLoaded   = false;
var _saSubjectLoaded   = false;
var _saTeachersLoaded  = false;
var _saCurrentClassTab = 'homeroom';

/* ════════════════════════════════
   Sub-view 切換
   ════════════════════════════════ */
function switchSaView(view, btn) {
  ['classes', 'students', 'teachers', 'tools'].forEach(function(v) {
    var el = document.getElementById('sa-view-' + v);
    if (el) el.style.display = v === view ? '' : 'none';
  });
  document.querySelectorAll('#panel-school-admin .app-tabs-mini .app-tab-mini').forEach(function(b) {
    b.classList.remove('active');
  });
  if (btn) btn.classList.add('active');
  if (view === 'classes') {
    if (_saCurrentClassTab === 'homeroom' && !_saClassesLoaded) loadSaClasses();
    else if (_saCurrentClassTab === 'subject' && !_saSubjectLoaded) loadSaSubjectClasses();
  }
  if (view === 'students' && !_saLoaded)          loadMainRoster();
  if (view === 'teachers' && !_saTeachersLoaded)  loadSaTeachers();
}

/* ════════════════════════════════
   全校學生名單（Main）
   ════════════════════════════════ */
function loadMainRoster() {
  if (!currentSchoolId) return;
  var wrap = document.getElementById('sa-roster-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  Promise.all([
    db.collection('students').where('schoolId', '==', currentSchoolId).get(),
    db.collection('classes').where('schoolId',  '==', currentSchoolId).get()
  ]).then(function(results) {
    _saClassMap = {};
    results[1].forEach(function(doc) {
      var d = doc.data();
      _saClassMap[doc.id] = { name: d.name || '', grade: d.grade || _gradeFromName(d.name), classNumber: d.classNumber || 0 };
    });

    _saAllStudents = [];
    results[0].forEach(function(doc) {
      var d       = doc.data();
      var classId = d.classId || (d.classIds && d.classIds[0]) || '';
      _saAllStudents.push({
        id:          doc.id,
        name:        d.name       || '',
        pin:         d.pin        || '0000',
        grade:       d.grade      || 0,
        classNumber: d.classNumber || 0,
        classId:     classId,
        seatNumber:  d.seatNumber || 0,
        status:      d.status     || 'active',
        classIds:    d.classIds   || []
      });
    });

    /* 找出 _saClassMap 缺少的 classId（schoolId 為空的舊班級） */
    var missing = {}, missingIds = [];
    _saAllStudents.forEach(function(s) {
      if (s.classId && !_saClassMap[s.classId] && !missing[s.classId]) {
        missing[s.classId] = true;
        missingIds.push(s.classId);
      }
    });

    var fetchPromise = missingIds.length
      ? Promise.all(missingIds.map(function(id) { return db.collection('classes').doc(id).get(); }))
          .then(function(docs) {
            var batch = db.batch();
            var hasPatch = false;
            docs.forEach(function(doc) {
              if (!doc.exists) return;
              var d = doc.data();
              _saClassMap[doc.id] = { name: d.name || '', grade: d.grade || _gradeFromName(d.name), classNumber: d.classNumber || 0 };
              batch.update(doc.ref, { schoolId: currentSchoolId, schoolName: currentSchoolName || '' });
              hasPatch = true;
            });
            return hasPatch ? batch.commit() : Promise.resolve();
          })
      : Promise.resolve();

    return fetchPromise;
  }).then(function() {
    /* 用完整 map 補齊學生的 grade / classNumber */
    _saAllStudents.forEach(function(s) {
      var cls = s.classId ? _saClassMap[s.classId] : null;
      if (cls) {
        if (!s.grade)       s.grade       = cls.grade;
        if (!s.classNumber) s.classNumber = cls.classNumber;
      }
    });
    _saLoaded = true;
    _updateSaStats();
    _rebuildSaClassFilter();
    filterMainRoster();
  }).catch(function(e) {
    var wrap = document.getElementById('sa-roster-wrap');
    if (wrap) wrap.innerHTML = '<div style="color:var(--red);padding:20px;font-weight:700">載入失敗：' + e.message + '</div>';
  });
}

function _updateSaStats() {
  var active   = _saAllStudents.filter(function(s) { return s.status !== 'archived'; }).length;
  var archived = _saAllStudents.length - active;
  var totalEl  = document.getElementById('sa-stat-total');
  var actEl    = document.getElementById('sa-stat-active');
  var archEl   = document.getElementById('sa-stat-archived');
  if (totalEl) totalEl.textContent  = _saAllStudents.length;
  if (actEl)   actEl.textContent    = active;
  if (archEl)  archEl.textContent   = archived;
}

function _rebuildSaClassFilter() {
  var grade   = parseInt(document.getElementById('sa-filter-grade').value) || 0;
  var sel     = document.getElementById('sa-filter-class');
  var current = sel ? sel.value : '';

  /* 收集此年級下出現的 classId，保留順序 */
  var seen = {};
  var classIds = [];
  _saAllStudents.forEach(function(s) {
    if (grade && s.grade !== grade) return;
    if (s.classId && !seen[s.classId]) {
      seen[s.classId] = true;
      classIds.push(s.classId);
    }
  });
  classIds.sort(function(a, b) {
    var na = _saClassMap[a] ? _saClassMap[a].name : a;
    var nb = _saClassMap[b] ? _saClassMap[b].name : b;
    return na.localeCompare(nb, 'zh-TW');
  });

  if (sel) {
    sel.innerHTML = '<option value="">全部班級</option>'
      + classIds
          .filter(function(id) { return !!_saClassMap[id]; })
          .map(function(id) {
            var name = _saClassMap[id].name;
            return '<option value="' + escHtml(id) + '"' + (id === current ? ' selected' : '') + '>' + escHtml(name) + '</option>';
          }).join('');
  }
}

function _updateOrphanBanner() {
  var orphans  = _saAllStudents.filter(function(s) { return s.classId && !_saClassMap[s.classId]; });
  var existing = document.getElementById('sa-orphan-banner');
  if (!orphans.length) { if (existing) existing.remove(); return; }
  if (!existing) {
    existing = document.createElement('div');
    existing.id = 'sa-orphan-banner';
    var rw = document.getElementById('sa-roster-wrap');
    if (rw && rw.parentNode) rw.parentNode.insertBefore(existing, rw);
  }
  existing.innerHTML = '<div style="background:#fef9c3;border:1.5px solid #fde047;border-radius:12px;padding:14px 18px;margin-bottom:14px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">'
    + '<span style="font-size:.88rem;font-weight:700;color:#713f12;flex:1">⚠ 發現 ' + orphans.length + ' 位學生的班級資料異常（班級已不存在）。</span>'
    + '<button onclick="deleteOrphanStudents()" style="padding:7px 14px;border:none;border-radius:8px;background:#dc2626;color:white;font-size:.82rem;font-weight:800;cursor:pointer;font-family:inherit;flex-shrink:0">🗑 清除這些學生</button>'
    + '</div>';
}

function deleteOrphanStudents() {
  var orphans = _saAllStudents.filter(function(s) { return s.classId && !_saClassMap[s.classId]; });
  if (!orphans.length) return;
  if (!confirm('確定要刪除 ' + orphans.length + ' 位班級資料異常的學生嗎？\n（這些學生無姓名且對應班級不存在，操作無法復原）')) return;
  var BATCH_SIZE = 400;
  var batch = db.batch(); var count = 0; var batches = [];
  orphans.forEach(function(s) {
    batch.delete(db.collection('students').doc(s.id));
    if (++count === BATCH_SIZE) { batches.push(batch.commit()); batch = db.batch(); count = 0; }
  });
  if (count > 0) batches.push(batch.commit());
  Promise.all(batches).then(function() {
    showToast('✅ 已刪除 ' + orphans.length + ' 位異常學生');
    _saLoaded = false; loadMainRoster();
  }).catch(function(e) { showToast('❌ 刪除失敗：' + e.message); });
}

function filterMainRoster() {
  _updateOrphanBanner();
  _rebuildSaClassFilter();
  var grade      = parseInt(document.getElementById('sa-filter-grade').value) || 0;
  var classId    = document.getElementById('sa-filter-class').value;
  var statusFilt = document.getElementById('sa-filter-status').value;
  var search     = (document.getElementById('sa-search').value || '').trim();

  var filtered = _saAllStudents.filter(function(s) {
    if (grade   && s.grade   !== grade)   return false;
    if (classId && s.classId !== classId) return false;
    if (statusFilt === 'active'   && s.status === 'archived') return false;
    if (statusFilt === 'archived' && s.status !== 'archived') return false;
    if (search && s.name.indexOf(search) === -1)              return false;
    return true;
  });

  _renderSaRoster(filtered);
}

function _renderSaRoster(students) {
  var wrap = document.getElementById('sa-roster-wrap');
  if (!wrap) return;

  if (!students.length) {
    wrap.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:.88rem;font-weight:600">沒有符合條件的學生</div>';
    return;
  }

  students.sort(function(a, b) {
    if (a.grade !== b.grade) return a.grade - b.grade;
    if (a.classNumber !== b.classNumber) return a.classNumber - b.classNumber;
    /* 若 classNumber 相同（含都是 0），依班級名稱排序 */
    var na = a.classId && _saClassMap[a.classId] ? _saClassMap[a.classId].name : '';
    var nb = b.classId && _saClassMap[b.classId] ? _saClassMap[b.classId].name : '';
    if (na !== nb) return na.localeCompare(nb, 'zh-TW');
    return a.seatNumber - b.seatNumber;
  });

  var html = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">'
    + '<thead style="background:#f1f5f9"><tr>'
    + '<th style="text-align:left;padding:8px 12px;font-size:.7rem;font-weight:800;color:var(--muted)">座號</th>'
    + '<th style="text-align:left;padding:8px 12px;font-size:.7rem;font-weight:800;color:var(--muted)">姓名</th>'
    + '<th style="text-align:left;padding:8px 12px;font-size:.7rem;font-weight:800;color:var(--muted)">年班</th>'
    + '<th style="text-align:left;padding:8px 12px;font-size:.7rem;font-weight:800;color:var(--muted)">PIN</th>'
    + '<th style="text-align:left;padding:8px 12px;font-size:.7rem;font-weight:800;color:var(--muted)">狀態</th>'
    + '<th></th>'
    + '</tr></thead><tbody>';

  html += students.map(function(s) {
    var eid      = _saEsc(s.id);
    var nameStr  = s.name || '（未填姓名）';
    var classStr = s.classId && _saClassMap[s.classId]
      ? _saClassMap[s.classId].name
      : (s.grade ? s.grade + '年' + (s.classNumber ? s.classNumber + '班' : '—') : '—');
    var statusBadge = s.status === 'archived'
      ? '<span style="font-size:.68rem;font-weight:800;color:#9a3412;background:#ffedd5;padding:2px 7px;border-radius:999px">封存</span>'
      : '<span style="font-size:.68rem;font-weight:800;color:#166534;background:#dcfce7;padding:2px 7px;border-radius:999px">在學</span>';
    var rowStyle = s.status === 'archived' ? 'border-bottom:1px solid var(--border);opacity:.55' : 'border-bottom:1px solid var(--border)';
    var archiveBtn = s.status !== 'archived'
      ? '<button onclick="archiveStudent(\'' + eid + '\')" style="padding:3px 9px;border:1.5px solid #fca5a5;border-radius:6px;background:white;color:#dc2626;font-size:.72rem;font-weight:700;cursor:pointer;font-family:inherit">封存</button>'
      : '<button onclick="restoreStudent(\'' + eid + '\')" style="padding:3px 9px;border:1.5px solid var(--border);border-radius:6px;background:white;color:var(--muted);font-size:.72rem;font-weight:700;cursor:pointer;font-family:inherit">恢復</button>';

    return '<tr id="sa-row-' + eid + '" style="' + rowStyle + '">'
      + '<td style="padding:8px 12px;font-family:\'Courier New\',monospace;font-size:.82rem;color:var(--muted)">' + (s.seatNumber || '—') + '</td>'
      + '<td style="padding:8px 12px;font-weight:700" id="sa-name-' + eid + '">' + escHtml(nameStr) + '</td>'
      + '<td style="padding:8px 12px;font-size:.82rem;color:var(--muted)">' + classStr + '</td>'
      + '<td style="padding:8px 12px;font-family:\'Courier New\',monospace;font-size:.82rem;color:var(--muted)">' + escHtml(s.pin) + '</td>'
      + '<td style="padding:8px 12px">' + statusBadge + '</td>'
      + '<td style="padding:6px 12px;white-space:nowrap">'
      + '<button onclick="openSaEditModal(\'' + eid + '\',\'' + _saEsc(s.name) + '\',\'' + _saEsc(s.pin) + '\')" style="padding:3px 9px;border:1.5px solid var(--border);border-radius:6px;background:white;font-size:.72rem;font-weight:700;cursor:pointer;font-family:inherit;margin-right:4px">編輯</button>'
      + archiveBtn
      + '</td>'
      + '</tr>';
  }).join('');

  html += '</tbody></table></div>';
  wrap.innerHTML = html;
}

function _saEsc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/* ════════════════════════════════
   編輯學生 Modal（name + pin 限定）
   ════════════════════════════════ */
var _saEditId = '';

function openSaEditModal(id, name, pin) {
  _saEditId = id;
  document.getElementById('sa-edit-name').value       = name;
  document.getElementById('sa-edit-pin').value        = pin;
  document.getElementById('sa-edit-err').textContent  = '';
  var btn = document.getElementById('sa-edit-save');
  btn.disabled = false; btn.textContent = '儲存';
  document.getElementById('sa-edit-modal').style.display = 'flex';
  document.getElementById('sa-edit-name').focus();
}

function closeSaEditModal() {
  document.getElementById('sa-edit-modal').style.display = 'none';
}

function saveSaStudent() {
  var name  = document.getElementById('sa-edit-name').value.trim();
  var pin   = document.getElementById('sa-edit-pin').value.trim();
  var errEl = document.getElementById('sa-edit-err');
  var btn   = document.getElementById('sa-edit-save');
  errEl.textContent = '';
  if (!/^\d{4}$/.test(pin)) { errEl.textContent = 'PIN 須為 4 位數字'; return; }
  btn.disabled = true; btn.textContent = '儲存中…';

  db.collection('students').doc(_saEditId).update({ name: name, pin: pin })
    .then(function() {
      var s = _saAllStudents.find(function(x) { return x.id === _saEditId; });
      if (s) { s.name = name; s.pin = pin; }
      var nameEl = document.getElementById('sa-name-' + _saEditId);
      if (nameEl) nameEl.textContent = name || '（未填姓名）';
      closeSaEditModal();
      showToast('✅ 已儲存');
    })
    .catch(function(e) {
      errEl.textContent = '儲存失敗：' + e.message;
      btn.disabled = false; btn.textContent = '儲存';
    });
}

/* ════════════════════════════════
   新增學生 Modal（轉入生）
   ════════════════════════════════ */
function openSaAddStudentModal() {
  document.getElementById('sa-add-name').value      = '';
  document.getElementById('sa-add-grade').value     = '';
  document.getElementById('sa-add-classnum').value  = '';
  document.getElementById('sa-add-seat').value      = '';
  document.getElementById('sa-add-pin').value       = '0000';
  document.getElementById('sa-add-err').textContent = '';
  var btn = document.getElementById('sa-add-save');
  btn.disabled = false; btn.textContent = '新增';
  document.getElementById('sa-add-modal').style.display = 'flex';
  document.getElementById('sa-add-name').focus();
}

function closeSaAddStudentModal() {
  document.getElementById('sa-add-modal').style.display = 'none';
}

function saveSaNewStudent() {
  var name     = document.getElementById('sa-add-name').value.trim();
  var grade    = parseInt(document.getElementById('sa-add-grade').value)    || 0;
  var classNum = parseInt(document.getElementById('sa-add-classnum').value) || 0;
  var seat     = parseInt(document.getElementById('sa-add-seat').value)     || 0;
  var pin      = document.getElementById('sa-add-pin').value.trim();
  var errEl    = document.getElementById('sa-add-err');
  var btn      = document.getElementById('sa-add-save');
  errEl.textContent = '';
  if (!name)                    { errEl.textContent = '請輸入姓名'; return; }
  if (!/^\d{4}$/.test(pin))    { errEl.textContent = 'PIN 須為 4 位數字'; return; }
  btn.disabled = true; btn.textContent = '新增中…';

  db.collection('students').add({
    name:        name,
    pin:         pin,
    grade:       grade,
    classNumber: classNum,
    seatNumber:  seat,
    schoolId:    currentSchoolId   || '',
    schoolName:  currentSchoolName || '',
    classId:     '',
    classIds:    [],
    status:      'active',
    createdAt:   Date.now(),
    lastSeen:    null
  })
  .then(function(ref) {
    _saAllStudents.push({ id: ref.id, name: name, pin: pin, grade: grade, classNumber: classNum, seatNumber: seat, status: 'active', classIds: [] });
    _updateSaStats();
    closeSaAddStudentModal();
    filterMainRoster();
    showToast('✅ 已新增「' + name + '」');
  })
  .catch(function(e) {
    errEl.textContent = '新增失敗：' + e.message;
    btn.disabled = false; btn.textContent = '新增';
  });
}

/* ════════════════════════════════
   封存 / 恢復學生
   ════════════════════════════════ */
function archiveStudent(id) {
  var s    = _saAllStudents.find(function(x) { return x.id === id; });
  var name = s ? (s.name || id) : id;
  if (!confirm('確定要封存「' + name + '」？\n學習紀錄保留，不會刪除。')) return;
  db.collection('students').doc(id).update({ status: 'archived' })
    .then(function() {
      if (s) s.status = 'archived';
      _updateSaStats();
      filterMainRoster();
      showToast('已封存「' + name + '」');
    })
    .catch(function(e) { showToast('操作失敗：' + e.message); });
}

function restoreStudent(id) {
  var s    = _saAllStudents.find(function(x) { return x.id === id; });
  var name = s ? (s.name || id) : id;
  if (!confirm('確定要恢復「' + name + '」為在學狀態？')) return;
  db.collection('students').doc(id).update({ status: 'active' })
    .then(function() {
      if (s) s.status = 'active';
      _updateSaStats();
      filterMainRoster();
      showToast('✅ 已恢復「' + name + '」');
    })
    .catch(function(e) { showToast('操作失敗：' + e.message); });
}

/* ════════════════════════════════
   生成原班（從 Main 自動建班）
   ════════════════════════════════ */
function generateHomeroomClasses() {
  if (!currentSchoolId) { showToast('請先設定學校'); return; }

  var groups = {};
  _saAllStudents.forEach(function(s) {
    if (s.status === 'archived' || !s.grade || !s.classNumber) return;
    var key = s.grade + '_' + s.classNumber;
    if (!groups[key]) groups[key] = { grade: s.grade, classNumber: s.classNumber, studentIds: [] };
    groups[key].studentIds.push(s.id);
  });

  var groupKeys = Object.keys(groups);
  if (!groupKeys.length) {
    showToast('沒有可生成班級的學生資料（需有年級與班號）');
    return;
  }

  if (!confirm('依全校學生名單自動建立原班班級？\n將生成 ' + groupKeys.length + ' 個班別（已存在者跳過）。')) return;

  db.collection('classes')
    .where('schoolId', '==', currentSchoolId)
    .where('classType', '==', 'homeroom')
    .get()
    .then(function(snap) {
      var existingClassIds = {};
      snap.forEach(function(doc) {
        var d   = doc.data();
        var key = (d.grade || 0) + '_' + (d.classNumber || 0);
        existingClassIds[key] = doc.id;
      });

      var toCreate = groupKeys.filter(function(k) { return !existingClassIds[k]; });
      var createJobs = toCreate.map(function(key) {
        var g    = groups[key];
        var code = _saGenCode();
        return db.collection('classes').add({
          name:         g.grade + '年' + g.classNumber + '班',
          grade:        g.grade,
          classNumber:  g.classNumber,
          classType:    'homeroom',
          schoolId:     currentSchoolId   || '',
          schoolName:   currentSchoolName || '',
          teacherUid:   currentTeacher.uid,
          teacherEmail: currentTeacher.email || '',
          inviteCode:   code,
          active:       true,
          createdAt:    new Date().toISOString()
        }).then(function(ref) {
          existingClassIds[key] = ref.id;
        });
      });

      return Promise.all(createJobs).then(function() {
        var BATCH_SIZE  = 400;
        var batch       = db.batch();
        var batchCount  = 0;
        var batches     = [];
        _saAllStudents.forEach(function(s) {
          if (s.status === 'archived') return;
          var key     = s.grade + '_' + s.classNumber;
          var classId = existingClassIds[key];
          if (!classId || s.classIds.indexOf(classId) !== -1) return;
          batch.update(db.collection('students').doc(s.id), {
            classId:  classId,
            classIds: firebase.firestore.FieldValue.arrayUnion(classId)
          });
          s.classIds.push(classId);
          batchCount++;
          if (batchCount === BATCH_SIZE) {
            batches.push(batch.commit());
            batch = db.batch(); batchCount = 0;
          }
        });
        if (batchCount > 0) batches.push(batch.commit());
        return Promise.all(batches).then(function() { return toCreate.length; });
      });
    })
    .then(function(created) {
      if (created === 0) {
        showToast('所有班級均已存在，無需重新生成。');
      } else {
        showToast('✅ 已生成 ' + created + ' 個班級並更新學生');
      }
    })
    .catch(function(e) { showToast('生成失敗：' + e.message); });
}

function _saGenCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code  = '';
  for (var i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/* ════════════════════════════════
   學年升級工具
   ════════════════════════════════ */
function batchGradeUp() {
  if (!currentSchoolId) return;
  var targets = _saAllStudents.filter(function(s) {
    return s.status !== 'archived' && s.grade > 0 && s.grade < 6;
  });
  if (!targets.length) { showToast('沒有可升級的學生（1–5 年）'); return; }
  if (!confirm('確定要將 ' + targets.length + ' 位在學學生（1–5 年）的年級 +1？\n此操作無法復原。')) return;

  var BATCH_SIZE = 400;
  var batch = db.batch(); var count = 0; var batches = [];
  targets.forEach(function(s) {
    batch.update(db.collection('students').doc(s.id), { grade: s.grade + 1 });
    s.grade++;
    if (++count === BATCH_SIZE) { batches.push(batch.commit()); batch = db.batch(); count = 0; }
  });
  if (count > 0) batches.push(batch.commit());
  Promise.all(batches)
    .then(function() {
      filterMainRoster();
      showToast('✅ 已升級 ' + targets.length + ' 位學生');
    })
    .catch(function(e) { showToast('升級失敗：' + e.message); });
}

function archiveGraduation() {
  if (!currentSchoolId) return;
  var grade6 = _saAllStudents.filter(function(s) {
    return s.status !== 'archived' && s.grade === 6;
  });
  if (!grade6.length) { showToast('目前沒有六年級在學學生'); return; }
  if (!confirm('確定要封存 ' + grade6.length + ' 位六年級學生（畢業）？\n學習紀錄保留。')) return;

  var BATCH_SIZE = 400;
  var batch = db.batch(); var count = 0; var batches = [];
  grade6.forEach(function(s) {
    batch.update(db.collection('students').doc(s.id), { status: 'archived' });
    s.status = 'archived';
    if (++count === BATCH_SIZE) { batches.push(batch.commit()); batch = db.batch(); count = 0; }
  });
  if (count > 0) batches.push(batch.commit());
  Promise.all(batches)
    .then(function() {
      _updateSaStats();
      filterMainRoster();
      showToast('✅ 已封存 ' + grade6.length + ' 位六年級學生');
    })
    .catch(function(e) { showToast('封存失敗：' + e.message); });
}

function archiveAllClasses() {
  if (!currentSchoolId) return;
  if (!confirm('確定要封存此學校所有啟用中的班級（設為停用）？\n歷史資料保留，此操作無法復原。')) return;

  db.collection('classes').where('schoolId', '==', currentSchoolId).where('active', '==', true).get()
    .then(function(snap) {
      if (snap.empty) { showToast('目前沒有啟用中的班級'); return; }
      var BATCH_SIZE = 400;
      var batch = db.batch(); var count = 0; var batches = [];
      snap.forEach(function(doc) {
        batch.update(doc.ref, { active: false });
        if (++count === BATCH_SIZE) { batches.push(batch.commit()); batch = db.batch(); count = 0; }
      });
      if (count > 0) batches.push(batch.commit());
      return Promise.all(batches).then(function() {
        showToast('✅ 已封存 ' + snap.size + ' 個班級');
      });
    })
    .catch(function(e) { showToast('操作失敗：' + e.message); });
}

/* ════════════════════════════════
   重新分班 Modal
   ════════════════════════════════ */
function openReassignModal() {
  document.getElementById('sa-reassign-grade').value    = '';
  document.getElementById('sa-reassign-classnum').value = '';
  document.getElementById('sa-reassign-target').innerHTML = '<option value="">── 請選目標班級 ──</option>';
  document.getElementById('sa-reassign-count').textContent = '已選 0 人';
  document.getElementById('sa-reassign-confirm').disabled  = true;
  document.getElementById('sa-reassign-modal').style.display = 'flex';
  _loadReassignTargets();
  _renderReassignList();
}

function _loadReassignTargets() {
  db.collection('classes').where('schoolId', '==', currentSchoolId).get()
    .then(function(snap) {
      var classes = [];
      snap.forEach(function(doc) {
        var d = doc.data();
        classes.push({ id: doc.id, name: d.name || '（未命名）', active: d.active !== false });
      });
      classes.sort(function(a, b) { return a.name.localeCompare(b.name, 'zh-TW'); });
      var sel = document.getElementById('sa-reassign-target');
      sel.innerHTML = '<option value="">── 請選目標班級 ──</option>'
        + classes.map(function(c) {
            return '<option value="' + _saEsc(c.id) + '">'
              + escHtml(c.name) + (c.active ? '' : '（停用）') + '</option>';
          }).join('');
    }).catch(function() {});
}

function filterReassignList() {
  _renderReassignList();
}

function _renderReassignList() {
  var grade    = parseInt(document.getElementById('sa-reassign-grade').value)    || 0;
  var classNum = parseInt(document.getElementById('sa-reassign-classnum').value) || 0;

  var filtered = _saAllStudents.filter(function(s) {
    if (s.status === 'archived')             return false;
    if (grade    && s.grade       !== grade)    return false;
    if (classNum && s.classNumber !== classNum) return false;
    return true;
  });
  filtered.sort(function(a, b) {
    if (a.grade !== b.grade) return a.grade - b.grade;
    if (a.classNumber !== b.classNumber) return a.classNumber - b.classNumber;
    return a.seatNumber - b.seatNumber;
  });

  var listEl = document.getElementById('sa-reassign-list');
  if (!filtered.length) {
    listEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);font-size:.85rem">沒有符合條件的學生</div>';
    updateReassignCount();
    return;
  }

  listEl.innerHTML = '<table style="width:100%;border-collapse:collapse">'
    + filtered.map(function(s) {
        var eid      = _saEsc(s.id);
        var classStr = s.grade ? s.grade + '年' + (s.classNumber ? s.classNumber + '班' : '') : '—';
        return '<tr style="border-bottom:1px solid var(--border)">'
          + '<td style="padding:8px 16px;width:40px"><input type="checkbox" class="reassign-chk" data-id="' + eid + '" onchange="updateReassignCount()"></td>'
          + '<td style="padding:8px 4px;font-family:\'Courier New\',monospace;font-size:.8rem;color:var(--muted);width:48px">' + (s.seatNumber || '—') + '</td>'
          + '<td style="padding:8px 8px;font-weight:700">' + escHtml(s.name || '（未填）') + '</td>'
          + '<td style="padding:8px 8px;font-size:.8rem;color:var(--muted)">' + classStr + '</td>'
          + '</tr>';
      }).join('')
    + '</table>';
  updateReassignCount();
}

function updateReassignCount() {
  var checked  = document.querySelectorAll('.reassign-chk:checked').length;
  var targetId = document.getElementById('sa-reassign-target').value;
  document.getElementById('sa-reassign-count').textContent = '已選 ' + checked + ' 人';
  document.getElementById('sa-reassign-confirm').disabled  = !checked || !targetId;
}

function closeReassignModal() {
  document.getElementById('sa-reassign-modal').style.display = 'none';
}

function confirmReassign() {
  var boxes    = document.querySelectorAll('.reassign-chk:checked');
  var targetId = document.getElementById('sa-reassign-target').value;
  if (!boxes.length || !targetId) return;

  var btn = document.getElementById('sa-reassign-confirm');
  btn.disabled = true; btn.textContent = '分班中…';

  var BATCH_SIZE = 400;
  var batch = db.batch(); var count = 0; var batches = [];
  boxes.forEach(function(box) {
    var sid = box.getAttribute('data-id');
    batch.update(db.collection('students').doc(sid), {
      classId:  targetId,
      classIds: firebase.firestore.FieldValue.arrayUnion(targetId)
    });
    var s = _saAllStudents.find(function(x) { return x.id === sid; });
    if (s && s.classIds.indexOf(targetId) === -1) s.classIds.push(targetId);
    if (++count === BATCH_SIZE) { batches.push(batch.commit()); batch = db.batch(); count = 0; }
  });
  if (count > 0) batches.push(batch.commit());
  Promise.all(batches)
    .then(function() {
      closeReassignModal();
      showToast('✅ 已將 ' + boxes.length + ' 位學生加入目標班級');
    })
    .catch(function(e) {
      btn.disabled = false; btn.textContent = '確認分班';
      showToast('分班失敗：' + e.message);
    });
}

/* ════════════════════════════════
   班級管理（sub-view: classes）
   ════════════════════════════════ */

/* 從班名解析年級與班次，用於排序 */
function _saParseClassName(name) {
  var GRADE = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6 };
  var ORDER = { '甲':1,'乙':2,'丙':3,'丁':4,'戊':5,'己':6,'庚':7,'辛':8,'壬':9,'癸':10 };
  var n = name || '';
  var grade = 0, order = 99;
  var gm = n.match(/^([一二三四五六])年/);
  if (gm) grade = GRADE[gm[1]] || 0;
  var rest = n.replace(/^[一二三四五六]年/, '');
  for (var i = 0; i < rest.length; i++) {
    if (ORDER[rest[i]] !== undefined) { order = ORDER[rest[i]]; break; }
  }
  return { grade: grade, order: order };
}

function loadSaClasses() {
  if (!currentSchoolId) return;
  var wrap = document.getElementById('sa-classes-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  Promise.all([
    db.collection('classes').where('schoolId', '==', currentSchoolId).where('classType', '==', 'homeroom').get(),
    db.collection('students').where('schoolId', '==', currentSchoolId).get()
  ]).then(function(results) {
    var countMap = {};
    results[1].forEach(function(doc) {
      var cid = doc.data().classId || '';
      if (cid) countMap[cid] = (countMap[cid] || 0) + 1;
    });

    _saClasses = [];
    results[0].forEach(function(doc) {
      var d = doc.data();
      _saClasses.push({
        id:           doc.id,
        name:         d.name         || '（未命名）',
        grade:        d.grade        || 0,
        classType:    d.classType    || 'homeroom',
        teacherUid:   d.teacherUid   || '',
        teacherEmail: d.teacherEmail || '',
        active:       d.active       !== false,
        studentCount: countMap[doc.id] || 0
      });
    });

    _saClasses.sort(function(a, b) {
      var ka = _saParseClassName(a.name), kb = _saParseClassName(b.name);
      if (ka.grade !== kb.grade) return ka.grade - kb.grade;
      if (ka.order !== kb.order) return ka.order - kb.order;
      return a.name.localeCompare(b.name, 'zh-TW');
    });

    _saClasses.forEach(function(c) {
      _saClassMap[c.id] = { name: c.name, grade: c.grade, classNumber: 0 };
    });

    _saClassesLoaded = true;
    _renderSaClasses(wrap);
  }).catch(function(e) {
    wrap.innerHTML = '<div style="color:var(--red);padding:20px;font-weight:700">載入失敗：' + e.message + '</div>';
  });
}

function _renderSaClasses(wrap) {
  if (!_saClasses.length) {
    wrap.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:.88rem;font-weight:600">此學校尚無行政班</div>';
    return;
  }

  var html = _saClasses.map(function(cls) {
    var eid       = _saEsc(cls.id);
    var activeTag = cls.active
      ? '<span style="font-size:.68rem;font-weight:800;color:#166534;background:#dcfce7;padding:2px 7px;border-radius:999px">啟用</span>'
      : '<span style="font-size:.68rem;font-weight:800;color:#9a3412;background:#ffedd5;padding:2px 7px;border-radius:999px">停用</span>';
    var teacherDisplay = cls.teacherEmail
      ? escHtml(cls.teacherEmail)
      : '<span style="color:var(--muted)">（校管理員）</span>';

    return '<details style="border:1.5px solid var(--border);border-radius:12px;margin-bottom:10px;overflow:hidden" id="sa-cls-' + eid + '">'
      + '<summary style="list-style:none;display:flex;align-items:center;gap:10px;padding:14px 18px;cursor:pointer;background:#f8fafc;user-select:none;flex-wrap:wrap"'
      +   ' onmouseover="this.style.background=\'#f1f5f9\'" onmouseout="this.style.background=\'#f8fafc\'">'
      +   '<span style="font-weight:900;font-size:.95rem;flex:1;min-width:100px">' + escHtml(cls.name) + '</span>'
      +   activeTag
      + '</summary>'
      + '<div style="padding:14px 18px;display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px">'
      +   '<div><div style="font-size:.68rem;font-weight:800;color:var(--muted);margin-bottom:3px">學生人數</div>'
      +     '<div style="font-weight:800;font-size:.9rem">' + cls.studentCount + ' 人</div></div>'
      +   '<div><div style="font-size:.68rem;font-weight:800;color:var(--muted);margin-bottom:3px">負責教師</div>'
      +     '<div style="font-weight:700;font-size:.82rem;word-break:break-all">' + teacherDisplay + '</div></div>'
      +   '<div><div style="font-size:.68rem;font-weight:800;color:var(--muted);margin-bottom:3px">啟用狀態</div>'
      +     '<div>' + activeTag + '</div></div>'
      + '</div>'
      + '<div style="padding:0 18px 14px 18px;display:flex;gap:8px;flex-wrap:wrap">'
      +   '<button onclick="event.preventDefault();openSaAssignTeacherModal(\'' + eid + '\',\'' + _saEsc(cls.teacherEmail) + '\')"'
      +     ' style="padding:6px 14px;border:1.5px solid var(--blue);border-radius:8px;background:white;color:var(--blue);font-size:.78rem;font-weight:800;cursor:pointer;font-family:inherit">👤 指派教師</button>'
      +   '<button onclick="event.preventDefault();_saViewClassStudents(\'' + eid + '\',\'' + _saEsc(cls.name) + '\')"'
      +     ' style="padding:6px 14px;border:1.5px solid var(--border);border-radius:8px;background:white;color:var(--text);font-size:.78rem;font-weight:800;cursor:pointer;font-family:inherit">👥 查看名單 →</button>'
      + '</div>'
      + '</details>';
  }).join('');

  wrap.innerHTML = html;
}

function _saViewClassStudents(classId, className) {
  var tab = document.getElementById('tab-classes');
  if (tab) tab.click();
  setTimeout(function() { viewClassStudents(classId, className); }, 100);
}

/* ════════════════════════════════
   班級管理 Tab 切換（行政班 / 一般班）
   ════════════════════════════════ */
function switchSaClassTab(tab, btn) {
  _saCurrentClassTab = tab;
  ['homeroom', 'subject'].forEach(function(t) {
    var panel  = document.getElementById('sa-cls-panel-' + t);
    var tabBtn = document.getElementById('sa-cls-tab-' + t);
    if (panel)  panel.style.display  = t === tab ? '' : 'none';
    if (tabBtn) tabBtn.classList.toggle('active', t === tab);
  });
  if (tab === 'homeroom' && !_saClassesLoaded) loadSaClasses();
  if (tab === 'subject'  && !_saSubjectLoaded) loadSaSubjectClasses();
}

/* ════════════════════════════════
   一般班級（教師自建）
   ════════════════════════════════ */
var _saSubjectClasses  = [];
var _saSubjectTeachers = {}; // teacherUid → email

function loadSaSubjectClasses() {
  if (!currentSchoolId) return;
  var wrap = document.getElementById('sa-subject-classes-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  Promise.all([
    db.collection('classes').where('schoolId', '==', currentSchoolId).where('classType', '==', 'subject').get(),
    db.collection('students').where('schoolId', '==', currentSchoolId).get(),
    db.collection('teachers').where('schoolId', '==', currentSchoolId).get()
  ]).then(function(results) {
    var countMap = {};
    results[1].forEach(function(doc) {
      var cid = doc.data().classId || '';
      if (cid) countMap[cid] = (countMap[cid] || 0) + 1;
    });

    _saSubjectTeachers = {};
    results[2].forEach(function(doc) {
      _saSubjectTeachers[doc.id] = doc.data().email || doc.id;
    });

    _saSubjectClasses = [];
    results[0].forEach(function(doc) {
      var d = doc.data();
      _saSubjectClasses.push({
        id:           doc.id,
        name:         d.name         || '（未命名）',
        teacherUid:   d.teacherUid   || '',
        teacherEmail: d.teacherEmail || '',
        active:       d.active       !== false,
        studentCount: countMap[doc.id] || 0
      });
    });

    _saSubjectClasses.sort(function(a, b) {
      var ka = _saParseClassName(a.name), kb = _saParseClassName(b.name);
      if (ka.grade !== kb.grade) return ka.grade - kb.grade;
      if (ka.order !== kb.order) return ka.order - kb.order;
      return a.name.localeCompare(b.name, 'zh-TW');
    });

    _saSubjectLoaded = true;
    _renderSaSubjectClasses(wrap);
  }).catch(function(e) {
    wrap.innerHTML = '<div style="color:var(--red);padding:20px;font-weight:700">載入失敗：' + e.message + '</div>';
  });
}

function _renderSaSubjectClasses(wrap) {
  if (!_saSubjectClasses.length) {
    wrap.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:.88rem;font-weight:600">此學校尚無一般班級</div>';
    return;
  }

  var html = _saSubjectClasses.map(function(cls) {
    var eid       = _saEsc(cls.id);
    var activeTag = cls.active
      ? '<span style="font-size:.68rem;font-weight:800;color:#166534;background:#dcfce7;padding:2px 7px;border-radius:999px">啟用</span>'
      : '<span style="font-size:.68rem;font-weight:800;color:#9a3412;background:#ffedd5;padding:2px 7px;border-radius:999px">停用</span>';
    var ownerEmail = cls.teacherEmail || _saSubjectTeachers[cls.teacherUid] || cls.teacherUid || '—';

    return '<details style="border:1.5px solid var(--border);border-radius:12px;margin-bottom:10px;overflow:hidden">'
      + '<summary style="list-style:none;display:flex;align-items:center;gap:10px;padding:14px 18px;cursor:pointer;background:#f8fafc;user-select:none;flex-wrap:wrap"'
      +   ' onmouseover="this.style.background=\'#f1f5f9\'" onmouseout="this.style.background=\'#f8fafc\'">'
      +   '<span style="font-weight:900;font-size:.95rem;flex:1;min-width:100px">' + escHtml(cls.name) + '</span>'
      +   activeTag
      + '</summary>'
      + '<div style="padding:14px 18px;display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px">'
      +   '<div><div style="font-size:.68rem;font-weight:800;color:var(--muted);margin-bottom:3px">學生人數</div>'
      +     '<div style="font-weight:800;font-size:.9rem">' + cls.studentCount + ' 人</div></div>'
      +   '<div><div style="font-size:.68rem;font-weight:800;color:var(--muted);margin-bottom:3px">建立教師</div>'
      +     '<div style="font-weight:700;font-size:.82rem;word-break:break-all">' + escHtml(ownerEmail) + '</div></div>'
      +   '<div><div style="font-size:.68rem;font-weight:800;color:var(--muted);margin-bottom:3px">啟用狀態</div>'
      +     '<div>' + activeTag + '</div></div>'
      + '</div>'
      + '<div style="padding:0 18px 14px 18px;display:flex;gap:8px;flex-wrap:wrap">'
      +   '<button onclick="event.preventDefault();_saToggleSubjectClass(\'' + eid + '\',' + !cls.active + ',\'' + _saEsc(cls.name) + '\')"'
      +     ' style="padding:6px 14px;border:1.5px solid var(--border);border-radius:8px;background:white;font-size:.78rem;font-weight:800;cursor:pointer;font-family:inherit">'
      +     (cls.active ? '停用' : '啟用') + '</button>'
      +   '<button onclick="event.preventDefault();_saDeleteSubjectClass(\'' + eid + '\',\'' + _saEsc(cls.name) + '\')"'
      +     ' style="padding:6px 14px;border:1.5px solid #fca5a5;border-radius:8px;background:white;color:var(--red);font-size:.78rem;font-weight:800;cursor:pointer;font-family:inherit">刪除</button>'
      +   '<button onclick="event.preventDefault();_saViewClassStudents(\'' + eid + '\',\'' + _saEsc(cls.name) + '\')"'
      +     ' style="padding:6px 14px;border:1.5px solid var(--border);border-radius:8px;background:white;color:var(--text);font-size:.78rem;font-weight:800;cursor:pointer;font-family:inherit">👥 查看學生 →</button>'
      + '</div>'
      + '</details>';
  }).join('');

  wrap.innerHTML = html;
}

function _saToggleSubjectClass(classId, newActive, name) {
  db.collection('classes').doc(classId).update({ active: newActive })
    .then(function() {
      _saSubjectLoaded = false;
      loadSaSubjectClasses();
      showToast(newActive ? '✅ 班級已啟用' : '班級已停用');
    })
    .catch(function(e) { showToast('操作失敗：' + e.message); });
}

function _saDeleteSubjectClass(classId, name) {
  if (!confirm('確定要刪除班級「' + name + '」嗎？\n（學生資料不受影響）')) return;
  db.collection('classes').doc(classId).delete()
    .then(function() {
      _saSubjectLoaded = false;
      loadSaSubjectClasses();
      showToast('已刪除班級「' + name + '」');
    })
    .catch(function(e) { showToast('刪除失敗：' + e.message); });
}

/* ════════════════════════════════
   教師管理（sub-view: teachers）
   ════════════════════════════════ */
function loadSaTeachers() {
  if (!currentSchoolId) return;
  var wrap = document.getElementById('sa-teachers-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  db.collection('teachers').where('schoolId', '==', currentSchoolId).get()
    .then(function(snap) {
      var teachers = [];
      snap.forEach(function(doc) {
        var d = doc.data();
        teachers.push({ uid: doc.id, email: d.email || '', displayName: d.displayName || '',
          lastLoginAt: d.lastLoginAt || '', blocked: d.blocked || false, role: d.role || 'teacher' });
      });
      teachers.sort(function(a, b) { return a.email.localeCompare(b.email); });
      _saTeachersLoaded = true;
      _renderSaTeachers(wrap, teachers);
    })
    .catch(function(e) {
      wrap.innerHTML = '<div style="color:var(--red);padding:20px;font-weight:700">載入失敗：' + e.message + '</div>';
    });
}

function _renderSaTeachers(wrap, teachers) {
  if (!teachers.length) {
    wrap.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:.88rem;font-weight:600">此學校尚無教師帳號</div>';
    return;
  }
  wrap.innerHTML = '<table style="width:100%;border-collapse:collapse">'
    + '<thead><tr>'
    +   '<th style="text-align:left;font-size:.72rem;font-weight:800;color:var(--muted);padding:8px 12px;border-bottom:2px solid var(--border)">教師</th>'
    +   '<th style="text-align:left;font-size:.72rem;font-weight:800;color:var(--muted);padding:8px 12px;border-bottom:2px solid var(--border)">最後登入</th>'
    +   '<th style="text-align:left;font-size:.72rem;font-weight:800;color:var(--muted);padding:8px 12px;border-bottom:2px solid var(--border)">狀態</th>'
    +   '<th style="padding:8px 12px;border-bottom:2px solid var(--border)"></th>'
    + '</tr></thead><tbody>'
    + teachers.map(function(t) {
        var eid       = _saEsc(t.uid);
        var login     = t.lastLoginAt ? t.lastLoginAt.slice(0, 10) : '—';
        var isBlocked = t.blocked;
        var badge     = isBlocked
          ? '<span style="font-size:.68rem;font-weight:800;color:#9a3412;background:#ffedd5;padding:2px 8px;border-radius:999px">封鎖中</span>'
          : '<span style="font-size:.68rem;font-weight:800;color:#166534;background:#dcfce7;padding:2px 8px;border-radius:999px">正常</span>';
        var roleBadge = t.role === 'school-admin'
          ? ' <span style="font-size:.65rem;font-weight:800;color:#1e40af;background:#dbeafe;padding:2px 6px;border-radius:999px">校管理者</span>'
          : '';
        var btnLabel = isBlocked ? '解除封鎖' : '封鎖';
        var btnColor = isBlocked ? 'var(--green)' : 'var(--red)';
        var btnBg    = isBlocked ? 'var(--green-lt)' : '#fff5f5';
        var btnBd    = isBlocked ? '#86efac' : '#fecaca';
        var nameCell = t.displayName
          ? escHtml(t.displayName) + roleBadge
            + '<div style="font-size:.75rem;color:var(--muted);font-weight:500;margin-top:2px">' + escHtml(t.email) + '</div>'
          : escHtml(t.email) + roleBadge;
        return '<tr style="border-bottom:1px solid var(--border)">'
          + '<td style="padding:11px 12px;font-size:.88rem;font-weight:700">' + nameCell + '</td>'
          + '<td style="padding:11px 12px;font-size:.82rem;color:var(--muted);font-weight:600">' + login + '</td>'
          + '<td style="padding:11px 12px">' + badge + '</td>'
          + '<td style="padding:11px 12px;text-align:right">'
          +   '<button style="padding:5px 12px;border:1.5px solid ' + btnBd + ';border-radius:7px;background:' + btnBg + ';font-size:.75rem;font-weight:700;cursor:pointer;font-family:inherit;color:' + btnColor + '"'
          +     ' onclick="toggleSaTeacherBlock(\'' + eid + '\',' + !isBlocked + ')">' + btnLabel + '</button>'
          + '</td>'
          + '</tr>';
      }).join('')
    + '</tbody></table>';
}

function toggleSaTeacherBlock(uid, block) {
  var msg = block ? '確定要封鎖此教師帳號？封鎖後對方無法登入後台。' : '確定要解除封鎖？';
  if (!confirm(msg)) return;
  db.collection('teachers').doc(uid).update({ blocked: block })
    .then(function() {
      showToast(block ? '✅ 已封鎖教師帳號' : '✅ 已解除封鎖');
      _saTeachersLoaded = false; loadSaTeachers();
    })
    .catch(function(e) { showToast('操作失敗：' + e.message); });
}

/* ════════════════════════════════
   指派教師 Modal
   ════════════════════════════════ */
var _saAssignClassId = '';

function openSaAssignTeacherModal(classId, currentTeacherEmail) {
  _saAssignClassId = classId;
  var cls = _saClasses.find(function(c) { return c.id === classId; });
  var clsName = cls ? cls.name : classId;
  document.getElementById('sa-assign-teacher-classname').textContent = '班級：' + clsName;
  document.getElementById('sa-assign-teacher-err').textContent = '';
  var btn = document.getElementById('sa-assign-teacher-save');
  btn.disabled = false; btn.textContent = '儲存';

  var sel = document.getElementById('sa-assign-teacher-select');
  sel.innerHTML = '<option value="">（校管理員負責，不指派）</option>';

  if (!currentSchoolId) {
    document.getElementById('sa-assign-teacher-modal').style.display = 'flex';
    return;
  }

  db.collection('teachers').where('schoolId', '==', currentSchoolId).get()
    .then(function(snap) {
      snap.forEach(function(doc) {
        var d   = doc.data();
        if (d.blocked) return;
        var opt = document.createElement('option');
        opt.value       = doc.id + '|' + (d.email || '');
        opt.textContent = d.displayName ? d.displayName + '（' + (d.email || '') + '）' : (d.email || doc.id);
        if (d.email === currentTeacherEmail) opt.selected = true;
        sel.appendChild(opt);
      });
    })
    .catch(function() {})
    .finally(function() {
      document.getElementById('sa-assign-teacher-modal').style.display = 'flex';
    });
}

function closeSaAssignTeacherModal() {
  document.getElementById('sa-assign-teacher-modal').style.display = 'none';
  _saAssignClassId = '';
}

function saveSaAssignTeacher() {
  if (!_saAssignClassId) return;
  var sel   = document.getElementById('sa-assign-teacher-select');
  var val   = sel.value; // '' or 'uid|email'
  var btn   = document.getElementById('sa-assign-teacher-save');
  var errEl = document.getElementById('sa-assign-teacher-err');
  errEl.textContent = '';
  btn.disabled = true; btn.textContent = '儲存中…';

  var uid   = '';
  var email = '';
  if (val) {
    var parts = val.split('|');
    uid   = parts[0] || '';
    email = parts[1] || '';
  }

  db.collection('classes').doc(_saAssignClassId).update({
    teacherUid:   uid,
    teacherEmail: email
  }).then(function() {
    var cls = _saClasses.find(function(c) { return c.id === _saAssignClassId; });
    if (cls) { cls.teacherUid = uid; cls.teacherEmail = email; }
    closeSaAssignTeacherModal();
    var wrap = document.getElementById('sa-classes-wrap');
    if (wrap) _renderSaClasses(wrap);
    showToast(email ? '✅ 已指派「' + email + '」為負責教師' : '✅ 已改為校管理員負責');
  }).catch(function(e) {
    errEl.textContent = '儲存失敗：' + e.message;
    btn.disabled = false; btn.textContent = '儲存';
  });
}
