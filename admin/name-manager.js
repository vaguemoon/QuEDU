/**
 * admin/name-manager.js — 班級學生姓名批次管理
 * 依賴：shared.js（db、showToast）、classes.js（currentRosterClassId）
 * Firestore：students/{id} → { seatNumber, name, classId, ... }
 */
'use strict';

var _nameStudents = []; // 目前班級的學生清單（依座號排序）

function loadNameManager() {
  var wrap = document.getElementById('name-manager-wrap');
  if (!wrap) return;
  if (!currentRosterClassId) {
    wrap.innerHTML = '<div style="padding:20px;color:var(--muted);font-weight:600">請先選擇班級。</div>';
    return;
  }
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  /* 同時查詢新格式（classId欄位）及舊格式（classIds陣列），取聯集 */
  var p1 = db.collection('students').where('classId', '==', currentRosterClassId).get();
  var p2 = db.collection('students').where('classIds', 'array-contains', currentRosterClassId).get();

  Promise.all([p1, p2])
    .then(function(results) {
      var seen = {};
      _nameStudents = [];
      results.forEach(function(snap) {
        snap.forEach(function(doc) {
          if (seen[doc.id]) return;
          seen[doc.id] = true;
          var d = doc.data();
          d._id = doc.id;
          _nameStudents.push(d);
        });
      });

      /* 依座號升序排列；無座號的排最後 */
      _nameStudents.sort(function(a, b) {
        return (a.seatNumber || 999) - (b.seatNumber || 999);
      });

      _renderNameTable(wrap);
    })
    .catch(function(e) {
      wrap.innerHTML =
        '<div style="color:var(--red);padding:20px;font-weight:700">載入失敗：' + e.message + '</div>';
    });
}

function _renderNameTable(wrap) {
  /* 分成「已有座號」與「未分配座號（舊帳號）」兩群 */
  var seated   = _nameStudents.filter(function(s) { return s.seatNumber; });
  var unseated = _nameStudents.filter(function(s) { return !s.seatNumber; });

  if (!seated.length && !unseated.length) {
    wrap.innerHTML =
      '<div style="text-align:center;padding:32px;color:var(--muted);font-weight:600">' +
      '此班級尚無學生帳號。<br>' +
      '<span style="font-size:.82rem">請先在建班時設定學生人數，或由學生加入班級。</span></div>';
    return;
  }

  var html = '';

  /* ── 已分配座號：顯示姓名編輯表格 ── */
  if (seated.length) {
    var rows = seated.map(function(s) {
      var name = escHtml(s.name || '');
      return '<tr>'
        + '<td style="width:70px;font-weight:900;color:var(--muted)">' + s.seatNumber + ' 號</td>'
        + '<td>'
          + '<input type="text" value="' + name + '" placeholder="未填寫"'
          + ' data-id="' + escHtml(s._id) + '"'
          + ' style="width:100%;border:1.5px solid var(--border);border-radius:7px;padding:7px 10px;'
          + 'font-size:.9rem;font-family:inherit;outline:none"'
          + ' onkeydown="if(event.key===\'Enter\')saveStudentName(this)">'
        + '</td>'
        + '<td style="width:70px">'
          + '<button class="btn-sm" onclick="saveStudentName(this.closest(\'tr\').querySelector(\'input\'))">儲存</button>'
        + '</td>'
        + '</tr>';
    }).join('');

    html +=
      '<table style="width:100%;border-collapse:collapse;margin-bottom:8px">'
      + '<thead><tr>'
        + '<th style="text-align:left;font-size:.72rem;font-weight:800;color:var(--muted);padding:8px 12px;border-bottom:2px solid var(--border)">座號</th>'
        + '<th style="text-align:left;font-size:.72rem;font-weight:800;color:var(--muted);padding:8px 12px;border-bottom:2px solid var(--border)">姓名</th>'
        + '<th style="border-bottom:2px solid var(--border)"></th>'
      + '</tr></thead>'
      + '<tbody>' + rows + '</tbody>'
      + '</table>'
      + '<div style="margin-top:8px;margin-bottom:20px;display:flex;gap:8px">'
        + '<button class="btn-save-lesson" style="padding:9px 18px" onclick="saveAllNames()">💾 全部儲存</button>'
        + '<span id="name-save-status" style="font-size:.82rem;font-weight:700;align-self:center"></span>'
      + '</div>';
  }

  /* ── 未分配座號（舊帳號遷移）── */
  if (unseated.length) {
    var migrRows = unseated.map(function(s) {
      var displayName = escHtml(s.name || s._id || '（未知）');
      return '<tr>'
        + '<td style="font-weight:700">' + displayName + '</td>'
        + '<td style="width:110px">'
          + '<input type="number" min="1" max="60" placeholder="座號"'
          + ' data-migrate-id="' + escHtml(s._id) + '"'
          + ' style="width:90px;border:1.5px solid var(--border);border-radius:7px;padding:6px 8px;'
          + 'font-size:.9rem;font-family:\'Courier New\',monospace;outline:none">'
        + '</td>'
        + '<td style="width:70px">'
          + '<button class="btn-sm" onclick="migrateStudent(\'' + escHtml(s._id) + '\',this)">指定</button>'
        + '</td>'
        + '</tr>';
    }).join('');

    html +=
      '<div style="margin-top:4px;padding:14px;background:#fffbeb;border-radius:10px;border:1.5px solid #fde68a">'
      + '<div style="font-size:.82rem;font-weight:800;color:#92400e;margin-bottom:10px">'
        + '⚠️ 以下 ' + unseated.length + ' 位學生無座號（舊帳號）——請指定座號以完成遷移'
      + '</div>'
      + '<table style="width:100%;border-collapse:collapse">'
        + '<thead><tr>'
          + '<th style="text-align:left;font-size:.72rem;font-weight:800;color:var(--muted);padding:6px 8px;border-bottom:1.5px solid var(--border)">帳號名稱</th>'
          + '<th style="text-align:left;font-size:.72rem;font-weight:800;color:var(--muted);padding:6px 8px;border-bottom:1.5px solid var(--border)">指定座號</th>'
          + '<th style="border-bottom:1.5px solid var(--border)"></th>'
        + '</tr></thead>'
        + '<tbody>' + migrRows + '</tbody>'
      + '</table>'
      + '</div>';
  }

  wrap.innerHTML = html;
}

/* ── 舊帳號遷移：指定座號 ── */
function migrateStudent(studentId, btn) {
  var row    = btn.closest('tr');
  var input  = row.querySelector('input[data-migrate-id]');
  var seat   = parseInt(input.value);
  if (!seat || seat < 1 || seat > 60) {
    showToast('請輸入有效座號（1–60）');
    return;
  }

  var cls = currentClasses.find(function(c) { return c.id === currentRosterClassId; }) || {};

  db.collection('students').doc(studentId).update({
    seatNumber:  seat,
    classId:     currentRosterClassId,
    schoolId:    currentSchoolId   || '',
    schoolName:  currentSchoolName || '',
    grade:       cls.grade       || 0,
    classNumber: cls.classNumber || 0
  })
  .then(function() {
    showToast('✅ 已指定座號 ' + seat + ' 號');
    loadNameManager();
  })
  .catch(function(e) { showToast('操作失敗：' + e.message); });
}

/* ── 儲存單筆 ── */
function saveStudentName(input) {
  var id   = input.getAttribute('data-id');
  var name = input.value.trim();
  if (!id) return;

  db.collection('students').doc(id).update({ name: name })
    .then(function() {
      input.style.borderColor = 'var(--green)';
      setTimeout(function() { input.style.borderColor = ''; }, 1500);
    })
    .catch(function(e) { showToast('儲存失敗：' + e.message); });
}

/* ── 全部儲存 ── */
function saveAllNames() {
  var inputs  = document.querySelectorAll('#name-manager-wrap input[data-id]');
  var status  = document.getElementById('name-save-status');
  var batch   = db.batch();
  var count   = 0;

  inputs.forEach(function(input) {
    var id   = input.getAttribute('data-id');
    var name = input.value.trim();
    if (!id) return;
    batch.update(db.collection('students').doc(id), { name: name });
    count++;
  });

  if (!count) return;
  status.style.color = 'var(--muted)';
  status.textContent = '儲存中…';

  batch.commit()
    .then(function() {
      status.style.color = 'var(--green)';
      status.textContent = '✅ 已儲存 ' + count + ' 筆';
      setTimeout(function() { status.textContent = ''; }, 2500);
    })
    .catch(function(e) {
      status.style.color = 'var(--red)';
      status.textContent = '儲存失敗：' + e.message;
    });
}

/* ════════════════════════════════
   Excel 匯入
   ════════════════════════════════ */
var _excelImportMap = {}; // { seatNumber: name }

function handleExcelFile(input) {
  var file = input.files[0];
  input.value = '';
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var wb   = XLSX.read(e.target.result, { type: 'array' });
      var ws   = wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      _parseExcelRows(rows);
    } catch(err) {
      showToast('讀取失敗：' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function _parseExcelRows(rows) {
  /* 過濾全空行 */
  rows = rows.filter(function(r) {
    return r.some(function(c) { return String(c).trim() !== ''; });
  });
  if (!rows.length) { showToast('檔案無有效資料'); return; }

  /* 偵測格式：首行第一格是否為純數字 → 兩欄（座號、姓名）格式
     否則判斷是否含「座號/姓名」等標頭，或直接當單欄姓名列表 */
  var firstCell = String(rows[0][0] || '').trim();
  var isHeader  = /座號|號碼|編號|姓名|name|seat/i.test(firstCell) && !/^\d+$/.test(firstCell);
  var dataRows  = isHeader ? rows.slice(1) : rows;
  var hasSeatCol = /^\d+$/.test(String(dataRows[0] ? dataRows[0][0] : '').trim());

  var importMap = {};

  if (hasSeatCol) {
    /* 兩欄格式：A=座號, B=姓名 */
    dataRows.forEach(function(r) {
      var seat = parseInt(r[0]);
      var name = String(r[1] || '').trim();
      if (seat >= 1 && name) importMap[seat] = name;
    });
  } else {
    /* 單欄格式：依行順序對應座號 1、2、3… */
    dataRows.forEach(function(r, i) {
      var name = String(r[0] || '').trim();
      if (name) importMap[i + 1] = name;
    });
  }

  if (!Object.keys(importMap).length) {
    showToast('找不到有效資料，請確認格式（A欄座號、B欄姓名，或單欄姓名）');
    return;
  }

  _excelImportMap = importMap;
  _showExcelPreviewModal();
}

function _showExcelPreviewModal() {
  var seated = _nameStudents.filter(function(s) { return s.seatNumber; });
  var modal  = document.getElementById('excel-preview-modal');
  var list   = document.getElementById('excel-preview-list');
  var summary = document.getElementById('excel-preview-summary');

  var matched = 0;
  var rows = seated.map(function(s) {
    var incoming = _excelImportMap[s.seatNumber];
    var current  = s.name || '';
    var changed  = incoming && incoming !== current;
    if (incoming) matched++;
    var rowStyle = changed ? 'background:#f0fdf4' : '';
    var tag      = changed ? '<span style="font-size:.68rem;font-weight:800;color:var(--green);background:#dcfce7;padding:1px 6px;border-radius:6px;margin-left:6px">更新</span>' : '';
    return '<tr style="' + rowStyle + '">'
      + '<td style="padding:8px 12px;font-weight:900;color:var(--muted);width:60px">' + s.seatNumber + ' 號</td>'
      + '<td style="padding:8px 12px;font-weight:700">'
          + (incoming ? escHtml(incoming) : '<span style="color:var(--muted)">—</span>')
          + tag
      + '</td>'
      + '<td style="padding:8px 12px;font-size:.78rem;color:var(--muted)">'
          + (current ? escHtml(current) : '（未填）')
      + '</td>'
      + '</tr>';
  }).join('');

  /* 列出 Excel 中有、但座號在班級不存在的行 */
  var extras = [];
  Object.keys(_excelImportMap).forEach(function(seat) {
    var found = seated.some(function(s) { return s.seatNumber === parseInt(seat); });
    if (!found) extras.push(seat);
  });

  list.innerHTML =
    '<table style="width:100%;border-collapse:collapse">'
    + '<thead><tr style="border-bottom:2px solid var(--border)">'
      + '<th style="text-align:left;padding:8px 12px;font-size:.72rem;color:var(--muted)">座號</th>'
      + '<th style="text-align:left;padding:8px 12px;font-size:.72rem;color:var(--muted)">匯入姓名</th>'
      + '<th style="text-align:left;padding:8px 12px;font-size:.72rem;color:var(--muted)">目前姓名</th>'
    + '</tr></thead>'
    + '<tbody>' + rows + '</tbody>'
    + '</table>'
    + (extras.length ? '<div style="padding:10px 12px;font-size:.75rem;color:#92400e;background:#fffbeb;border-top:1px solid #fde68a">'
        + '⚠️ Excel 中座號 ' + extras.join('、') + ' 號在班級中不存在，將略過。</div>' : '');

  summary.textContent = '共比對 ' + seated.length + ' 位學生，將更新 ' + matched + ' 筆姓名';
  document.getElementById('excel-confirm-btn').disabled = matched === 0;
  modal.style.display = 'flex';
}

function closeExcelPreview() {
  document.getElementById('excel-preview-modal').style.display = 'none';
  _excelImportMap = {};
}

function confirmExcelImport() {
  var btn   = document.getElementById('excel-confirm-btn');
  var batch = db.batch();
  var count = 0;

  _nameStudents.forEach(function(s) {
    if (!s.seatNumber) return;
    var name = _excelImportMap[s.seatNumber];
    if (!name) return;
    batch.update(db.collection('students').doc(s._id), { name: name });
    count++;
  });

  if (!count) { closeExcelPreview(); return; }

  btn.disabled = true;
  btn.textContent = '匯入中…';

  batch.commit()
    .then(function() {
      closeExcelPreview();
      showToast('✅ 已匯入 ' + count + ' 筆姓名');
      loadNameManager();
    })
    .catch(function(e) {
      btn.disabled = false;
      btn.textContent = '✅ 確認匯入';
      showToast('匯入失敗：' + e.message);
    });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
