/**
 * admin/sa-bulk-import.js — 班級學生名單批次匯入（校管理員用）
 * 依賴：shared.js（db、showToast）、init.js（currentSchoolId、currentSchoolName）
 * 格式 B（三欄）：班級名稱 | 座號 | 姓名（如「3年1班」）
 * SheetJS (xlsx) 已在 index.html 載入
 */
'use strict';

var _saBulkParsed = null;

function triggerSaBulkImport() {
  if (!currentSchoolId) { showToast('請先設定學校'); return; }
  document.getElementById('sa-bulk-trigger-modal').style.display = 'flex';
}

function closeSaBulkTrigger() {
  document.getElementById('sa-bulk-trigger-modal').style.display = 'none';
}

function handleSaBulkFile(input) {
  var file = input.files[0];
  input.value = '';
  closeSaBulkTrigger();
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var wb   = XLSX.read(e.target.result, { type: 'array' });
      var ws   = wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      var parsed = _parseSaBulkRows(rows);
      if (!parsed) return;
      _saBulkParsed = parsed;
      _showSaBulkPreview(parsed);
    } catch(err) {
      showToast('讀取失敗：' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

/* ════════════════════════════════
   解析 Excel（格式 B：班級名稱 | 座號 | 姓名）
   ════════════════════════════════ */
function _parseSaBulkRows(rows) {
  rows = rows.filter(function(r) {
    return r.some(function(c) { return String(c).trim() !== ''; });
  });
  if (!rows.length) { showToast('檔案無有效資料'); return null; }

  var firstCell = String(rows[0][0] || '').trim();
  var isHeader  = /年級|班|座號|姓名|grade|class|seat|name/i.test(firstCell);
  var dataRows  = isHeader ? rows.slice(1) : rows;

  var classMap = {};
  var errors   = [];

  dataRows.forEach(function(r, idx) {
    var lineNum     = (isHeader ? idx + 2 : idx + 1);
    var className   = String(r[0] || '').trim();
    var seat        = parseInt(r[1]) || 0;
    var studentName = String(r[2] || '').trim();

    if (!className || !seat || !studentName) {
      if (studentName || seat) errors.push('第 ' + lineNum + ' 行資料不完整，已略過');
      return;
    }

    if (!classMap[className]) {
      var m = className.match(/(\d+)[年年](\d+)[班班]/);
      classMap[className] = {
        grade:       m ? parseInt(m[1]) : 0,
        classNumber: m ? parseInt(m[2]) : 0,
        name:        className,
        students:    []
      };
    }
    classMap[className].students.push({ seat: seat, name: studentName });
  });

  var classes = Object.values(classMap);
  if (!classes.length) { showToast('找不到有效學生資料，請確認格式（班級名稱｜座號｜姓名）'); return null; }

  classes.sort(function(a, b) { return a.name.localeCompare(b.name, 'zh-TW'); });
  classes.forEach(function(cls) {
    cls.students.sort(function(a, b) { return a.seat - b.seat; });
  });

  return {
    schoolId:   currentSchoolId,
    schoolName: currentSchoolName || '',
    classes:    classes,
    errors:     errors
  };
}

/* ════════════════════════════════
   預覽 Modal
   ════════════════════════════════ */
function _showSaBulkPreview(parsed) {
  var totalStudents = parsed.classes.reduce(function(s, c) { return s + c.students.length; }, 0);
  var modal    = document.getElementById('sa-bulk-preview-modal');
  var summary  = document.getElementById('sa-bulk-preview-summary');
  var tableEl  = document.getElementById('sa-bulk-preview-table');
  var warnEl   = document.getElementById('sa-bulk-preview-warn');

  summary.textContent = parsed.schoolName + '・' + parsed.classes.length + ' 個班級・' + totalStudents + ' 位學生';

  tableEl.innerHTML = parsed.classes.map(function(cls) {
    var rows = cls.students.map(function(s) {
      return '<tr style="border-bottom:1px solid var(--border)">'
        + '<td style="padding:6px 16px;color:var(--muted);font-size:.78rem;width:60px">' + s.seat + ' 號</td>'
        + '<td style="padding:6px 8px;font-weight:700;font-size:.85rem">' + _saEsc(s.name) + '</td>'
        + '</tr>';
    }).join('');

    return '<details style="border-bottom:1.5px solid var(--border)">'
      + '<summary style="padding:12px 20px;cursor:pointer;font-weight:800;font-size:.92rem;list-style:none;display:flex;align-items:center;gap:8px">'
        + '<span style="flex:1">' + _saEsc(cls.name) + '</span>'
        + '<span style="font-size:.75rem;font-weight:700;color:var(--muted)">' + cls.students.length + ' 人</span>'
        + '<span style="font-size:.7rem;color:var(--muted);margin-left:8px">▼</span>'
      + '</summary>'
      + '<table style="width:100%;border-collapse:collapse;background:#f8fafc"><tbody>' + rows + '</tbody></table>'
      + '</details>';
  }).join('');

  if (parsed.errors.length) {
    warnEl.style.display = '';
    warnEl.textContent   = '⚠️ ' + parsed.errors.join('；');
  } else {
    warnEl.style.display = 'none';
  }

  document.getElementById('sa-bulk-confirm-btn').disabled = false;
  modal.style.display = 'flex';
}

function closeSaBulkPreview() {
  document.getElementById('sa-bulk-preview-modal').style.display = 'none';
}

/* ════════════════════════════════
   確認匯入
   ════════════════════════════════ */
function confirmSaBulkImport() {
  if (!_saBulkParsed) return;
  var btn = document.getElementById('sa-bulk-confirm-btn');
  btn.disabled = true; btn.textContent = '匯入中…';

  var parsed = _saBulkParsed;

  Promise.all([
    db.collection('classes')
      .where('schoolId', '==', parsed.schoolId)
      .where('classType', '==', 'homeroom')
      .get(),
    db.collection('students')
      .where('schoolId', '==', parsed.schoolId)
      .get()
  ]).then(function(results) {
    var existingClasses  = {};
    var existingStudents = {};

    results[0].forEach(function(doc) {
      var d = doc.data();
      var key = d.grade && d.classNumber ? d.grade + '_' + d.classNumber : d.name;
      existingClasses[key]    = doc.id;
      if (d.name) existingClasses[d.name] = doc.id;
    });
    results[1].forEach(function(doc) {
      var d = doc.data();
      if (d.classId && d.seatNumber) {
        existingStudents[d.classId + '_' + d.seatNumber] = doc.id;
      }
    });

    return _processSaBulkImport(parsed, existingClasses, existingStudents);
  })
  .then(function(stats) {
    closeSaBulkPreview();
    _saBulkParsed = null;
    showToast('✅ 匯入完成：新建 ' + stats.newClasses + ' 個班級、' + stats.newStudents + ' 位學生'
      + (stats.updatedStudents ? '，更新 ' + stats.updatedStudents + ' 位姓名' : ''));
    loadMainRoster();
  })
  .catch(function(e) {
    btn.disabled = false; btn.textContent = '✅ 確認匯入';
    showToast('匯入失敗：' + e.message);
  });
}

function _processSaBulkImport(parsed, existingClasses, existingStudents) {
  var stats      = { newClasses: 0, newStudents: 0, updatedStudents: 0 };
  var classIdMap = {};

  var classPromises = parsed.classes.map(function(cls) {
    var key = cls.grade && cls.classNumber ? cls.grade + '_' + cls.classNumber : cls.name;
    if (existingClasses[key]) {
      classIdMap[cls.name] = existingClasses[key];
      return Promise.resolve();
    }
    if (existingClasses[cls.name]) {
      classIdMap[cls.name] = existingClasses[cls.name];
      return Promise.resolve();
    }
    var code = _saGenCode();
    return db.collection('classes').add({
      name:         cls.name,
      grade:        cls.grade,
      classNumber:  cls.classNumber,
      classType:    'homeroom',
      schoolId:     parsed.schoolId,
      schoolName:   parsed.schoolName,
      teacherUid:   '',
      teacherEmail: '',
      inviteCode:   code,
      active:       true,
      createdAt:    new Date().toISOString()
    }).then(function(ref) {
      classIdMap[cls.name] = ref.id;
      stats.newClasses++;
    });
  });

  return Promise.all(classPromises).then(function() {
    var ops = [];
    parsed.classes.forEach(function(cls) {
      var classId = classIdMap[cls.name];
      if (!classId) return;
      cls.students.forEach(function(s) {
        var existId = existingStudents[classId + '_' + s.seat];
        if (existId) {
          ops.push({ type: 'update', ref: db.collection('students').doc(existId), data: { name: s.name } });
          stats.updatedStudents++;
        } else {
          ops.push({ type: 'create', ref: db.collection('students').doc(), data: {
            schoolId:    parsed.schoolId,
            schoolName:  parsed.schoolName,
            classId:     classId,
            classIds:    [classId],
            grade:       cls.grade,
            classNumber: cls.classNumber,
            seatNumber:  s.seat,
            name:        s.name,
            pin:         '0000',
            createdAt:   Date.now(),
            lastSeen:    null
          }});
          stats.newStudents++;
        }
      });
    });

    var BATCH_SIZE = 499;
    var batches = [];
    for (var i = 0; i < ops.length; i += BATCH_SIZE) {
      var batch = db.batch();
      ops.slice(i, i + BATCH_SIZE).forEach(function(op) {
        if (op.type === 'update') batch.update(op.ref, op.data);
        else                      batch.set(op.ref, op.data);
      });
      batches.push(batch.commit());
    }
    return Promise.all(batches).then(function() { return stats; });
  });
}

/* _saGenCode() and _saEsc() provided by school-admin.js */
