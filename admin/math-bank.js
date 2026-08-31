/**
 * admin/math-bank.js — 數學題組管理
 * 格式：年級、類別、題幹、答案（xlsx）→ Firestore mathQuestions
 * 依賴：shared.js（db、showToast）、init.js（currentTeacher）
 */
'use strict';

var _mbRows   = [];
var _mbErrors = [];

/* ════════════════════════════
   進入點
   ════════════════════════════ */
function loadMathBankStats() {
  if (!db || !currentTeacher) { setTimeout(loadMathBankStats, 300); return; }
  var wrap = document.getElementById('mb-stats-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  db.collection('mathQuestions')
    .where('teacherUid', '==', currentTeacher.uid)
    .get()
    .then(function(snap) {
      if (snap.empty) {
        wrap.innerHTML = '<p style="color:var(--muted);font-size:.88rem;padding:8px 0">尚未上傳任何數學題組</p>';
        return;
      }
      var grades = {};
      snap.forEach(function(doc) {
        var d = doc.data();
        var g = d.grade || '未分年級';
        if (!grades[g]) grades[g] = { total: 0, cats: {} };
        grades[g].total++;
        if (d.category) grades[g].cats[d.category] = (grades[g].cats[d.category] || 0) + 1;
      });

      var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px">';
      Object.keys(grades).sort().forEach(function(g) {
        var s   = grades[g];
        var cats = Object.keys(s.cats).map(function(c) { return c + ' ×' + s.cats[c]; }).join('、');
        html +=
          '<div style="border:1.5px solid var(--border);border-radius:12px;padding:14px 16px;background:var(--gray-lt)">' +
            '<div style="font-size:.95rem;font-weight:900;color:var(--text);margin-bottom:4px">' + _mbEsc(g) + '</div>' +
            '<div style="font-size:1.6rem;font-weight:900;color:var(--blue);line-height:1">' + s.total + '</div>' +
            '<div style="font-size:.72rem;color:var(--muted);font-weight:700;margin-top:2px">題</div>' +
            (cats ? '<div style="font-size:.72rem;color:var(--muted);margin-top:6px;line-height:1.6">' + _mbEsc(cats) + '</div>' : '') +
            '<button onclick="_mbDeleteGrade(\'' + _mbEscQ(g) + '\')" ' +
              'style="margin-top:10px;padding:4px 10px;border:1.5px solid var(--red);border-radius:6px;' +
              'background:white;color:var(--red);font-size:.72rem;font-weight:800;cursor:pointer;font-family:inherit">' +
              '刪除此年級</button>' +
          '</div>';
      });
      html += '</div>';
      wrap.innerHTML = html;
    })
    .catch(function(e) {
      wrap.innerHTML = '<p style="color:var(--red);font-size:.88rem">載入失敗：' + e.message + '</p>';
    });
}

/* ════════════════════════════
   Excel 預覽
   ════════════════════════════ */
function previewMathBank() {
  var fileEl = document.getElementById('mb-file');
  if (!fileEl || !fileEl.files[0]) return;
  _mbRows = []; _mbErrors = [];

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var wb   = XLSX.read(e.target.result, { type: 'array' });
      var ws   = wb.Sheets[wb.SheetNames[0]];
      var data = XLSX.utils.sheet_to_json(ws, { defval: '' });

      data.forEach(function(row, i) {
        var question = String(row['題幹'] || '').trim();
        var answer   = String(row['答案'] || '').trim();
        if (!question || !answer) {
          _mbErrors.push('第 ' + (i + 2) + ' 列：題幹或答案為空，略過');
          return;
        }
        _mbRows.push({
          grade:    String(row['年級']  || '').trim(),
          category: String(row['類別']  || '').trim(),
          question: question,
          answer:   answer
        });
      });
      _mbRenderPreview();
    } catch(ex) {
      showToast('❌ 讀取 Excel 失敗：' + ex.message);
    }
  };
  reader.readAsArrayBuffer(fileEl.files[0]);
}

function _mbRenderPreview() {
  var errWrap = document.getElementById('mb-errors');
  var preWrap = document.getElementById('mb-preview-wrap');
  var countEl = document.getElementById('mb-total-count');

  if (errWrap) {
    if (_mbErrors.length) {
      errWrap.style.display = '';
      errWrap.innerHTML =
        '<div style="background:var(--yel-lt);border:1.5px solid #fde047;border-radius:8px;' +
        'padding:10px 14px;font-size:.78rem;color:var(--yellow);font-weight:700;line-height:1.7">' +
        _mbErrors.map(_mbEsc).join('<br>') + '</div>';
    } else {
      errWrap.style.display = 'none';
    }
  }

  if (!_mbRows.length) {
    showToast('⚠️ 未找到有效題目，請確認欄位名稱');
    if (preWrap) preWrap.style.display = 'none';
    return;
  }
  if (countEl) countEl.textContent = _mbRows.length;

  var table = document.getElementById('mb-preview-table');
  if (table) {
    var headers = ['年級', '類別', '題幹', '答案'];
    table.innerHTML =
      '<thead><tr>' +
      headers.map(function(h) {
        return '<th style="text-align:left;padding:6px 10px;font-size:.72rem;font-weight:800;' +
               'color:var(--muted);border-bottom:2px solid var(--border)">' + h + '</th>';
      }).join('') +
      '</tr></thead><tbody>' +
      _mbRows.slice(0, 10).map(function(r) {
        return '<tr>' +
          [r.grade, r.category, r.question, r.answer].map(function(v) {
            return '<td style="padding:6px 10px;font-size:.82rem;border-bottom:1px solid var(--border)">' +
                   _mbEsc(v || '—') + '</td>';
          }).join('') + '</tr>';
      }).join('') + '</tbody>';
  }
  if (preWrap) preWrap.style.display = '';
}

/* ════════════════════════════
   上傳至 Firestore
   ════════════════════════════ */
function uploadMathBank() {
  if (!_mbRows.length || !currentTeacher) return;
  var btn = document.getElementById('btn-mb-upload');
  if (btn) { btn.disabled = true; btn.textContent = '上傳中…'; }

  var uid = currentTeacher.uid;
  var now = new Date().toISOString();

  /* Firestore batch 上限 500，分批處理 */
  var chunks = [];
  for (var i = 0; i < _mbRows.length; i += 400) chunks.push(_mbRows.slice(i, i + 400));

  var chain = Promise.resolve();
  chunks.forEach(function(chunk) {
    chain = chain.then(function() {
      var batch = db.batch();
      chunk.forEach(function(r) {
        batch.set(db.collection('mathQuestions').doc(), {
          teacherUid: uid,
          grade:      r.grade,
          category:   r.category,
          question:   r.question,
          answer:     r.answer,
          uploadedAt: now
        });
      });
      return batch.commit();
    });
  });

  chain
    .then(function() {
      showToast('✅ 已上傳 ' + _mbRows.length + ' 題數學題組');
      clearMathBankPreview();
      loadMathBankStats();
    })
    .catch(function(e) {
      showToast('❌ 上傳失敗：' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = '⬆️ 上傳至 Firebase'; }
    });
}

function clearMathBankPreview() {
  _mbRows = []; _mbErrors = [];
  var fileEl = document.getElementById('mb-file');
  if (fileEl) fileEl.value = '';
  var preWrap = document.getElementById('mb-preview-wrap');
  if (preWrap) preWrap.style.display = 'none';
  var errWrap = document.getElementById('mb-errors');
  if (errWrap) errWrap.style.display = 'none';
  var btn = document.getElementById('btn-mb-upload');
  if (btn) { btn.disabled = false; btn.textContent = '⬆️ 上傳至 Firebase'; }
}

/* ════════════════════════════
   刪除（按年級）
   ════════════════════════════ */
function _mbDeleteGrade(grade) {
  if (!confirm('確定要刪除「' + grade + '」的所有數學題組嗎？此動作無法復原。')) return;
  db.collection('mathQuestions')
    .where('teacherUid', '==', currentTeacher.uid)
    .where('grade', '==', grade)
    .get()
    .then(function(snap) {
      var chunks = [];
      var all    = [];
      snap.forEach(function(doc) { all.push(doc.ref); });
      for (var i = 0; i < all.length; i += 400) chunks.push(all.slice(i, i + 400));
      var chain = Promise.resolve();
      chunks.forEach(function(c) {
        chain = chain.then(function() {
          var batch = db.batch();
          c.forEach(function(ref) { batch.delete(ref); });
          return batch.commit();
        });
      });
      return chain;
    })
    .then(function() {
      showToast('✅ 已刪除「' + grade + '」的數學題組');
      loadMathBankStats();
    })
    .catch(function(e) { showToast('❌ 刪除失敗：' + e.message); });
}

/* ════════════════════════════
   下載範例 Excel
   ════════════════════════════ */
function downloadMbTemplate() {
  var ws = XLSX.utils.aoa_to_sheet([
    ['年級', '類別', '題幹', '答案'],
    ['三上', '加法', '45 + 38 = ?', '83'],
    ['三上', '減法', '72 - 35 = ?', '37'],
    ['三上', '乘法', '12 × 8 = ?', '96'],
    ['三上', '除法', '96 ÷ 8 = ?', '12'],
    ['三上', '應用題', '小明有45顆糖，再買了38顆，共有幾顆？', '83']
  ]);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '數學題組');
  XLSX.writeFile(wb, '數學題組範例.xlsx');
}

/* ── 工具函式 ── */
function _mbEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function _mbEscQ(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
