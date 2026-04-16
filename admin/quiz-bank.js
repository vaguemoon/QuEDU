/**
 * quiz-bank.js — 語文題庫管理（上傳 xlsx、顯示統計）
 * 依賴：shared.js（db、showToast）、SheetJS（XLSX）
 */
'use strict';

var qbParsedData = null;  // 解析後的題目陣列

/* ══════════════════════════════════════════
   xlsx 預覽
   ══════════════════════════════════════════ */
function previewQuizBank() {
  var gradeEl = document.getElementById('qb-grade');
  var fileEl  = document.getElementById('qb-file');
  var grade   = gradeEl.value;

  if (!grade) {
    showToast('請先選擇年級！');
    fileEl.value = '';
    return;
  }

  var file = fileEl.files[0];
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var wb = XLSX.read(e.target.result, { type: 'array' });
      var ws = wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      qbParsedData = [];
      var errors = [];

      rows.forEach(function(row, i) {
        var lesson     = String(row['課次'] || '').trim();
        var lessonName = String(row['課名'] || '').trim();
        var type       = String(row['題型'] || '').trim();
        var question   = String(row['題幹'] || '').trim();
        var answer     = String(row['答案'] || '').trim();

        if (!lesson || !type || !question || !answer) {
          errors.push('第 ' + (i+2) + ' 列：欄位不完整');
          return;
        }

        var validTypes = ['詞語解釋', '詞語填空', '選擇題'];
        if (validTypes.indexOf(type) === -1) {
          errors.push('第 ' + (i+2) + ' 列：題型「' + type + '」無效');
          return;
        }

        var options = [];
        if (type === '選擇題') {
          // 支援 "題幹|A. 選項|B. 選項|C. 選項" 格式
          var parts = question.split('|');
          if (parts.length >= 4) {
            question = parts[0].trim();
            options  = [parts[1].trim(), parts[2].trim(), parts[3].trim()];
          } else {
            // 嘗試從題幹內文解析 A. B. C.
            var m = question.match(/^(.*?)\s*([A-C][.．、].+)$/s);
            if (m) {
              question = m[1].trim();
              var optStr = m[2];
              options = optStr.split(/(?=[A-C][.．、])/).map(function(s){ return s.trim(); }).filter(Boolean);
            }
          }
        }

        qbParsedData.push({
          grade: grade, lesson: lesson, lessonName: lessonName,
          type: type, question: question, answer: answer, options: options,
          createdAt: new Date().toISOString()
        });
      });

      if (errors.length > 0) {
        showToast('⚠️ 有 ' + errors.length + ' 列資料格式有誤，已略過。');
        console.warn('xlsx 格式問題：', errors);
      }

      if (qbParsedData.length === 0) {
        showToast('❌ 無法解析任何有效題目，請確認格式。');
        return;
      }

      renderQuizBankPreview();

    } catch(err) {
      showToast('❌ 解析失敗：' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function renderQuizBankPreview() {
  document.getElementById('qb-total-count').textContent = qbParsedData.length;

  var table = document.getElementById('qb-preview-table');
  var headers = ['課次', '課名', '題型', '題幹', '答案'];
  var html = '<tr>' + headers.map(function(h) {
    return '<th style="text-align:left;padding:6px 10px;border-bottom:2px solid var(--border);font-weight:800;font-size:.78rem;color:var(--muted)">' + h + '</th>';
  }).join('') + '</tr>';

  qbParsedData.slice(0, 10).forEach(function(row, i) {
    var bg = i % 2 === 0 ? 'var(--gray-lt)' : '#fff';
    html += '<tr style="background:' + bg + '">';
    html += '<td style="padding:6px 10px;border-bottom:1px solid var(--border)">' + row.lesson + '</td>';
    html += '<td style="padding:6px 10px;border-bottom:1px solid var(--border)">' + row.lessonName + '</td>';
    html += '<td style="padding:6px 10px;border-bottom:1px solid var(--border)">' + row.type + '</td>';
    html += '<td style="padding:6px 10px;border-bottom:1px solid var(--border);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + row.question + '</td>';
    html += '<td style="padding:6px 10px;border-bottom:1px solid var(--border)">' + row.answer + '</td>';
    html += '</tr>';
  });

  table.innerHTML = html;
  document.getElementById('qb-preview-wrap').style.display = '';
}

function clearQuizBankPreview() {
  qbParsedData = null;
  document.getElementById('qb-file').value = '';
  document.getElementById('qb-preview-wrap').style.display = 'none';
  document.getElementById('qb-preview-table').innerHTML = '';
}

/* ══════════════════════════════════════════
   上傳至 Firestore
   ══════════════════════════════════════════ */
function uploadQuizBank() {
  if (!qbParsedData || qbParsedData.length === 0) return;
  if (!db) { showToast('Firebase 未就緒'); return; }

  var btn = document.querySelector('#qb-preview-wrap .btn-primary');
  btn.disabled = true;
  btn.textContent = '上傳中...';

  var grade = document.getElementById('qb-grade').value;

  // 批次寫入（每批最多 500 筆，Firestore 限制）
  var batches = [];
  var currentBatch = db.batch();
  var count = 0;

  qbParsedData.forEach(function(item) {
    var ref = db.collection('questions').doc();
    currentBatch.set(ref, item);
    count++;
    if (count % 499 === 0) {
      batches.push(currentBatch);
      currentBatch = db.batch();
    }
  });
  batches.push(currentBatch);

  Promise.all(batches.map(function(b) { return b.commit(); }))
    .then(function() {
      showToast('✅ 成功上傳 ' + qbParsedData.length + ' 筆題目！');
      clearQuizBankPreview();
      loadQuizBankStats();
    })
    .catch(function(e) {
      showToast('❌ 上傳失敗：' + e.message);
      btn.disabled = false;
      btn.textContent = '⬆️ 上傳至 Firebase';
    });
}

/* ══════════════════════════════════════════
   統計顯示
   ══════════════════════════════════════════ */
function loadQuizBankStats() {
  var wrap = document.getElementById('qb-stats-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  if (!db) { setTimeout(loadQuizBankStats, 300); return; }

  db.collection('questions').get().then(function(snap) {
    var total = snap.size;
    if (total === 0) {
      wrap.innerHTML = '<p style="color:var(--muted);font-size:.88rem;padding:16px 0">尚未上傳任何題目。</p>';
      return;
    }

    // 統計各年級、各題型
    var gradeMap = {};
    snap.forEach(function(doc) {
      var d = doc.data();
      if (!gradeMap[d.grade]) gradeMap[d.grade] = { total: 0, types: {} };
      gradeMap[d.grade].total++;
      gradeMap[d.grade].types[d.type] = (gradeMap[d.grade].types[d.type] || 0) + 1;
    });

    var html = '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">' +
      '<div class="stat-card stat-blue" style="flex:1;min-width:120px"><div class="stat-num">' + total + '</div><div class="stat-lbl">總題數</div></div>' +
      '<div class="stat-card stat-green" style="flex:1;min-width:120px"><div class="stat-num">' + Object.keys(gradeMap).length + '</div><div class="stat-lbl">涵蓋年級</div></div>' +
      '</div>';

    html += '<table style="width:100%;border-collapse:collapse;font-size:.85rem">';
    html += '<tr><th style="text-align:left;padding:8px 12px;border-bottom:2px solid var(--border);font-weight:800;color:var(--muted)">年級</th>' +
      '<th style="text-align:right;padding:8px 12px;border-bottom:2px solid var(--border);font-weight:800;color:var(--muted)">詞語解釋</th>' +
      '<th style="text-align:right;padding:8px 12px;border-bottom:2px solid var(--border);font-weight:800;color:var(--muted)">詞語填空</th>' +
      '<th style="text-align:right;padding:8px 12px;border-bottom:2px solid var(--border);font-weight:800;color:var(--muted)">選擇題</th>' +
      '<th style="text-align:right;padding:8px 12px;border-bottom:2px solid var(--border);font-weight:800;color:var(--muted)">小計</th></tr>';

    Object.keys(gradeMap).sort().forEach(function(g, i) {
      var gd = gradeMap[g];
      var bg = i % 2 === 0 ? 'var(--gray-lt)' : '#fff';
      html += '<tr style="background:' + bg + '">';
      html += '<td style="padding:8px 12px;border-bottom:1px solid var(--border);font-weight:700">' + g + '</td>';
      html += '<td style="text-align:right;padding:8px 12px;border-bottom:1px solid var(--border)">' + (gd.types['詞語解釋'] || 0) + '</td>';
      html += '<td style="text-align:right;padding:8px 12px;border-bottom:1px solid var(--border)">' + (gd.types['詞語填空'] || 0) + '</td>';
      html += '<td style="text-align:right;padding:8px 12px;border-bottom:1px solid var(--border)">' + (gd.types['選擇題'] || 0) + '</td>';
      html += '<td style="text-align:right;padding:8px 12px;border-bottom:1px solid var(--border);font-weight:800">' + gd.total + '</td>';
      html += '</tr>';
    });
    html += '</table>';
    wrap.innerHTML = html;
  }).catch(function(e) {
    wrap.innerHTML = '<p style="color:var(--red);font-size:.88rem">讀取失敗：' + e.message + '</p>';
  });
}
