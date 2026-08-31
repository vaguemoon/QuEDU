/**
 * super-admin/bulk-import.js — 全校學生名單批次匯入
 * 依賴：shared.js（db、showToast）、schools.js（_allSchools）
 * SheetJS (xlsx) 已在 index.html 載入
 *
 * 支援 Excel 格式：
 *   格式 A（四欄）：年級 | 班號 | 座號 | 姓名
 *   格式 B（三欄）：班級名稱 | 座號 | 姓名（如「3年1班」）
 */
'use strict';

var _bulkParsed = null; // { schoolId, schoolName, classes: [{ grade, classNumber, name, students: [{seat,name}] }] }

/* ── 同步學校選單（loadSchools 後呼叫）── */
function refreshBulkSchoolSelect() {
  var sel = document.getElementById('bulk-import-school');
  if (!sel) return;
  var prev = sel.value;
  sel.innerHTML = '<option value="">── 請選擇學校 ──</option>'
    + (_allSchools || []).map(function(s) {
        return '<option value="' + _bEsc(s.id) + '" data-name="' + _bEsc(s.name) + '">' + _bEsc(s.name) + '</option>';
      }).join('');
  if (prev) sel.value = prev;
}

function triggerBulkImport() {
  var schoolId = document.getElementById('bulk-import-school').value;
  if (!schoolId) {
    _bulkStatus('請先選擇目標學校', 'red');
    return;
  }
  document.getElementById('bulk-import-file').click();
}

function handleBulkImportFile(input) {
  var file = input.files[0];
  input.value = '';
  if (!file) return;

  var schoolSel  = document.getElementById('bulk-import-school');
  var schoolId   = schoolSel.value;
  var schoolName = schoolSel.options[schoolSel.selectedIndex]
    ? (schoolSel.options[schoolSel.selectedIndex].getAttribute('data-name') || '')
    : '';

  if (!schoolId) { _bulkStatus('請先選擇目標學校', 'red'); return; }

  document.getElementById('bulk-import-filename').textContent = file.name;
  _bulkStatus('解析中…', 'muted');

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var wb   = XLSX.read(e.target.result, { type: 'array' });
      var ws   = wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      var parsed = _parseBulkRows(rows, schoolId, schoolName);
      if (!parsed) return;
      _bulkParsed = parsed;
      _showBulkPreview(parsed);
    } catch(err) {
      _bulkStatus('讀取失敗：' + err.message, 'red');
    }
  };
  reader.readAsArrayBuffer(file);
}

/* ════════════════════════════════
   解析 Excel
   ════════════════════════════════ */
function _parseBulkRows(rows, schoolId, schoolName) {
  /* 過濾全空行 */
  rows = rows.filter(function(r) {
    return r.some(function(c) { return String(c).trim() !== ''; });
  });
  if (!rows.length) { _bulkStatus('檔案無有效資料', 'red'); return null; }

  /* 偵測標頭列 */
  var firstCell = String(rows[0][0] || '').trim();
  var isHeader  = /年級|班|座號|姓名|grade|class|seat|name/i.test(firstCell);
  var dataRows  = isHeader ? rows.slice(1) : rows;

  /* 偵測格式：格式 A = 四欄（年級/班號/座號/姓名）或格式 B = 三欄（班名/座號/姓名）*/
  var sample      = dataRows[0] || [];
  var col0        = String(sample[0] || '').trim();
  var isFourCol   = /^\d+$/.test(col0); // 第一欄是純數字 → 格式 A

  var classMap = {}; // key: "grade_classNum" or className → { grade, classNumber, name, students[] }
  var errors   = [];

  dataRows.forEach(function(r, idx) {
    var lineNum = (isHeader ? idx + 2 : idx + 1);
    var grade, classNumber, className, seat, studentName;

    if (isFourCol) {
      grade       = parseInt(r[0]) || 0;
      classNumber = parseInt(r[1]) || 0;
      seat        = parseInt(r[2]) || 0;
      studentName = String(r[3] || '').trim();
      className   = grade + '年' + classNumber + '班';
    } else {
      className   = String(r[0] || '').trim();
      seat        = parseInt(r[1]) || 0;
      studentName = String(r[2] || '').trim();
      /* 嘗試從班級名稱解析年級/班號 */
      var m = className.match(/(\d+)[年年](\d+)[班班]/);
      grade       = m ? parseInt(m[1]) : 0;
      classNumber = m ? parseInt(m[2]) : 0;
    }

    if (!className || !seat || !studentName) {
      if (studentName || seat) errors.push('第 ' + lineNum + ' 行資料不完整，已略過');
      return;
    }
    if (!classMap[className]) {
      classMap[className] = { grade: grade, classNumber: classNumber, name: className, students: [] };
    }
    classMap[className].students.push({ seat: seat, name: studentName });
  });

  var classes = Object.values(classMap);
  if (!classes.length) { _bulkStatus('找不到有效學生資料，請確認格式', 'red'); return null; }

  /* 依班級名稱排序、班內依座號排序 */
  classes.sort(function(a, b) { return a.name.localeCompare(b.name, 'zh-TW'); });
  classes.forEach(function(cls) {
    cls.students.sort(function(a, b) { return a.seat - b.seat; });
  });

  _bulkStatus('', '');
  return { schoolId: schoolId, schoolName: schoolName, classes: classes, errors: errors };
}

/* ════════════════════════════════
   預覽 Modal
   ════════════════════════════════ */
function _showBulkPreview(parsed) {
  var totalStudents = parsed.classes.reduce(function(s, c) { return s + c.students.length; }, 0);
  var modal    = document.getElementById('bulk-preview-modal');
  var summary  = document.getElementById('bulk-preview-summary');
  var tableEl  = document.getElementById('bulk-preview-table');
  var warnEl   = document.getElementById('bulk-preview-warn');

  summary.textContent = parsed.schoolName + '・' + parsed.classes.length + ' 個班級・' + totalStudents + ' 位學生';

  tableEl.innerHTML = parsed.classes.map(function(cls) {
    var rows = cls.students.map(function(s) {
      return '<tr style="border-bottom:1px solid var(--border)">'
        + '<td style="padding:6px 16px;color:var(--muted);font-size:.78rem;width:60px">' + s.seat + ' 號</td>'
        + '<td style="padding:6px 8px;font-weight:700;font-size:.85rem">' + _bEscHtml(s.name) + '</td>'
        + '</tr>';
    }).join('');

    return '<details style="border-bottom:1.5px solid var(--border)">'
      + '<summary style="padding:12px 20px;cursor:pointer;font-weight:800;font-size:.92rem;list-style:none;display:flex;align-items:center;gap:8px">'
        + '<span style="flex:1">' + _bEscHtml(cls.name) + '</span>'
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

  document.getElementById('bulk-confirm-btn').disabled = false;
  modal.style.display = 'flex';
}

function closeBulkPreview() {
  document.getElementById('bulk-preview-modal').style.display = 'none';
}

/* ════════════════════════════════
   確認匯入
   ════════════════════════════════ */
function confirmBulkImport() {
  if (!_bulkParsed) return;
  var btn = document.getElementById('bulk-confirm-btn');
  btn.disabled = true; btn.textContent = '匯入中…';

  var parsed = _bulkParsed;

  /* 先讀取此學校既有的原班清單與學生，做去重 */
  Promise.all([
    db.collection('classes')
      .where('schoolId', '==', parsed.schoolId)
      .where('classType', '==', 'homeroom')
      .get(),
    db.collection('students')
      .where('schoolId', '==', parsed.schoolId)
      .get()
  ]).then(function(results) {
    /* 建立查找表 */
    var existingClasses  = {}; // "grade_classNum" or "name" → classId
    var existingStudents = {}; // "classId_seat" → docId

    results[0].forEach(function(doc) {
      var d = doc.data();
      var key = d.grade && d.classNumber ? d.grade + '_' + d.classNumber : d.name;
      existingClasses[key] = doc.id;
      if (d.name) existingClasses[d.name] = doc.id;
    });
    results[1].forEach(function(doc) {
      var d = doc.data();
      if (d.classId && d.seatNumber) {
        existingStudents[d.classId + '_' + d.seatNumber] = doc.id;
      }
    });

    /* 逐班處理：先建好 classId 映射，再批量寫學生 */
    return _processImport(parsed, existingClasses, existingStudents);
  })
  .then(function(stats) {
    closeBulkPreview();
    _bulkParsed = null;
    document.getElementById('bulk-import-filename').textContent = '';
    _bulkStatus(
      '✅ 匯入完成：新建 ' + stats.newClasses + ' 個班級、' + stats.newStudents + ' 位學生'
        + (stats.updatedStudents ? '，更新 ' + stats.updatedStudents + ' 位姓名' : ''),
      'green'
    );
    loadSchools();
  })
  .catch(function(e) {
    btn.disabled = false; btn.textContent = '✅ 確認匯入';
    _bulkStatus('匯入失敗：' + e.message, 'red');
  });
}

function _processImport(parsed, existingClasses, existingStudents) {
  var stats = { newClasses: 0, newStudents: 0, updatedStudents: 0 };
  var classIdMap = {}; // parsedClassName → classId (resolved)

  /* 先解析每個班級的 classId：存在就用，不存在就建 */
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
    /* 建新班級 */
    var code = _bulkGenCode();
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
    /* 批次寫入學生（500 docs/batch 上限）*/
    var ops    = []; // { type:'create'|'update', ref, data }
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

    /* 分批 commit */
    var BATCH_SIZE = 499;
    var batches = [];
    for (var i = 0; i < ops.length; i += BATCH_SIZE) {
      var batch = db.batch();
      ops.slice(i, i + BATCH_SIZE).forEach(function(op) {
        if (op.type === 'update') {
          batch.update(op.ref, op.data);
        } else {
          batch.set(op.ref, op.data);
        }
      });
      batches.push(batch.commit());
    }
    return Promise.all(batches).then(function() { return stats; });
  });
}

/* ── 工具函式 ── */
function _bulkGenCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code  = '';
  for (var i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function _bulkStatus(msg, color) {
  var el = document.getElementById('bulk-import-status');
  if (!el) return;
  el.textContent   = msg;
  el.style.color   = color === 'red' ? 'var(--red)' : color === 'green' ? 'var(--green)' : 'var(--muted)';
}

function _bEsc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _bEscHtml(s) { return _bEsc(s); }
