/**
 * quiz-bank.js — 語文題庫管理（上傳 xlsx、顯示統計、刪除課次）
 * 依賴：shared.js（db、showToast）、SheetJS（XLSX）
 */
'use strict';

var qbParsedData = null;  /* 解析後的有效題目陣列 */

/* ── Key map for delete buttons (avoids inline HTML escaping issues) ── */
var _qbDelKeys  = {};
var _qbDelCount = 0;

/* ── Helpers ── */
function _qbEsc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _cnNumToInt(s) {
  var map = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,
              '十':10,'十一':11,'十二':12,'十三':13,'十四':14,'十五':15,
              '十六':16,'十七':17,'十八':18 };
  if (map[s] !== undefined) return map[s];
  var n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

/* ════════════════════════════════════════
   Inline error display
   ════════════════════════════════════════ */
function _showQbErrors(errors) {
  var el = document.getElementById('qb-errors');
  if (!el) return;
  var visible = errors.slice(0, 5);
  var html = '<div style="background:var(--red-lt);border:1.5px solid var(--red);border-radius:8px;padding:10px 14px">' +
    '<div style="font-size:.78rem;font-weight:800;color:var(--red);margin-bottom:6px">⚠️ ' + errors.length + ' 列格式有誤，已略過：</div>' +
    '<ul style="padding-left:16px;font-size:.78rem;color:var(--red);line-height:1.7">';
  visible.forEach(function(e) { html += '<li>' + _qbEsc(e) + '</li>'; });
  if (errors.length > 5) html += '<li style="color:var(--muted)">…還有 ' + (errors.length - 5) + ' 筆</li>';
  html += '</ul></div>';
  el.innerHTML = html;
  el.style.display = '';
}

function _clearQbErrors() {
  var el = document.getElementById('qb-errors');
  if (el) { el.innerHTML = ''; el.style.display = 'none'; }
}

/* ════════════════════════════════════════
   xlsx 解析 & 預覽
   ════════════════════════════════════════ */
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

  _clearQbErrors();

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var wb   = XLSX.read(e.target.result, { type: 'array' });
      var ws   = wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      qbParsedData = [];
      var errors   = [];

      rows.forEach(function(row, i) {
        var lesson     = String(row['課次'] || '').trim();
        var lessonName = String(row['課名'] || '').trim();
        var type       = String(row['題型'] || '').trim();
        var question   = String(row['題幹'] || '').trim();
        var answer     = String(row['答案'] || '').trim();
        /* 新格式：獨立選項欄 */
        var opt1 = String(row['選項一'] || '').trim();
        var opt2 = String(row['選項二'] || '').trim();
        var opt3 = String(row['選項三'] || '').trim();
        var opt4 = String(row['選項四'] || '').trim();

        if (!lesson || !type || !question || !answer) {
          errors.push('第 ' + (i + 2) + ' 列：欄位不完整（課次／題型／題幹／答案為必填）');
          return;
        }

        var validTypes = ['詞語解釋', '詞語填空', '選擇題'];
        if (validTypes.indexOf(type) === -1) {
          errors.push('第 ' + (i + 2) + ' 列：題型「' + type + '」無效，需為詞語解釋／詞語填空／選擇題');
          return;
        }

        var options = [];
        if (type === '選擇題') {
          var colOpts = [opt1, opt2, opt3, opt4].filter(Boolean);

          if (colOpts.length >= 2) {
            /* ── 新格式：選項來自獨立欄位 ── */
            options = colOpts;
            var ansNum = parseInt(answer, 10);
            var ansIdx;
            if (!isNaN(ansNum) && ansNum >= 1 && ansNum <= options.length) {
              ansIdx = ansNum - 1;
            } else if (/^[A-D]$/i.test(answer)) {
              ansIdx = answer.toUpperCase().charCodeAt(0) - 65;
            }
            if (ansIdx !== undefined && ansIdx >= 0 && ansIdx < options.length) {
              answer = options[ansIdx];
            } else {
              errors.push('第 ' + (i + 2) + ' 列：答案「' + answer + '」無效，請填入 1～' + options.length + ' 的數字');
              return;
            }
          } else {
            /* ── 舊格式：題幹內 | 分隔，保持向下相容 ── */
            var rawOpts = [];
            var parts = question.split('|');
            if (parts.length >= 4) {
              question = parts[0].trim();
              rawOpts  = [parts[1].trim(), parts[2].trim(), parts[3].trim()];
            } else {
              var m = question.match(/^([\s\S]*?)\s*([A-C][.．、].+)$/);
              if (m) {
                question = m[1].trim();
                rawOpts  = m[2].split(/(?=[A-C][.．、])/)
                               .map(function(s){ return s.trim(); })
                               .filter(Boolean);
              }
            }
            options = rawOpts.map(function(o) {
              return o.replace(/^[A-C][.．、]\s*/, '').trim();
            });
            var ansIdx2 = answer.toUpperCase().charCodeAt(0) - 65;
            if (/^[A-C]$/i.test(answer) && ansIdx2 >= 0 && ansIdx2 < options.length) {
              answer = options[ansIdx2];
            }
            if (options.length === 0) {
              errors.push('第 ' + (i + 2) + ' 列：選擇題需填入「選項一」～「選項三」欄位');
              return;
            }
          }
        }

        qbParsedData.push({
          grade: grade, lesson: lesson, lessonName: lessonName,
          type: type, question: question, answer: answer, options: options,
          teacherUid: 'shared',
          createdAt: new Date().toISOString()
        });
      });

      if (errors.length > 0) _showQbErrors(errors);

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

  var headers = ['課次', '課名', '題型', '題幹', '答案'];
  var html = '<tr>' + headers.map(function(h) {
    return '<th style="text-align:left;padding:6px 10px;border-bottom:2px solid var(--border);font-weight:800;font-size:.78rem;color:var(--muted)">' + h + '</th>';
  }).join('') + '</tr>';

  qbParsedData.slice(0, 10).forEach(function(row, i) {
    var bg = i % 2 === 0 ? 'var(--gray-lt)' : '#fff';
    html += '<tr style="background:' + bg + '">';
    html += '<td style="padding:6px 10px;border-bottom:1px solid var(--border)">' + _qbEsc(row.lesson) + '</td>';
    html += '<td style="padding:6px 10px;border-bottom:1px solid var(--border)">' + _qbEsc(row.lessonName) + '</td>';
    html += '<td style="padding:6px 10px;border-bottom:1px solid var(--border)">' + _qbEsc(row.type) + '</td>';
    html += '<td style="padding:6px 10px;border-bottom:1px solid var(--border);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _qbEsc(row.question) + '</td>';
    html += '<td style="padding:6px 10px;border-bottom:1px solid var(--border)">' + _qbEsc(row.answer) + '</td>';
    html += '</tr>';
  });

  document.getElementById('qb-preview-table').innerHTML = html;
  document.getElementById('qb-preview-wrap').style.display = '';
}

function clearQuizBankPreview() {
  qbParsedData = null;
  document.getElementById('qb-file').value = '';
  document.getElementById('qb-preview-wrap').style.display = 'none';
  document.getElementById('qb-preview-table').innerHTML = '';
  _clearQbErrors();
}

/* ════════════════════════════════════════
   上傳至 Firestore（批次寫入，max 499/batch）
   ════════════════════════════════════════ */
function uploadQuizBank() {
  if (!qbParsedData || qbParsedData.length === 0) return;
  if (!db) { showToast('Firebase 未就緒'); return; }

  var btn = document.querySelector('#qb-preview-wrap .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '上傳中…'; }

  var batches = [], batch = db.batch(), count = 0;
  qbParsedData.forEach(function(item) {
    batch.set(db.collection('questions').doc(), item);
    if (++count % 499 === 0) { batches.push(batch); batch = db.batch(); }
  });
  batches.push(batch);

  Promise.all(batches.map(function(b) { return b.commit(); }))
    .then(function() {
      showToast('✅ 成功上傳 ' + qbParsedData.length + ' 筆題目！');
      clearQuizBankPreview();
      loadQuizBankStats();
    })
    .catch(function(e) {
      showToast('❌ 上傳失敗：' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = '⬆️ 上傳至 Firebase'; }
    });
}

/* ════════════════════════════════════════
   題庫統計（年級 → 課次明細 + 刪除按鈕）
   ════════════════════════════════════════ */
function loadQuizBankStats() {
  var wrap = document.getElementById('qb-stats-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  _qbDelKeys  = {};
  _qbDelCount = 0;

  if (!db) { setTimeout(loadQuizBankStats, 300); return; }

  db.collection('questions').get().then(function(snap) {
    if (snap.size === 0) {
      wrap.innerHTML = '<p style="color:var(--muted);font-size:.88rem;padding:16px 0">尚未上傳任何題目。</p>';
      return;
    }

    /* Build: sourceMap[source][grade][lesson] = { lessonName, types:{}, total }
       source = 'shared' or teacherUid */
    var sourceMap = {};
    snap.forEach(function(doc) {
      var d   = doc.data();
      var src = d.teacherUid || 'shared';
      var g   = d.grade  || '（未知年級）';
      var l   = d.lesson || '—';
      if (!sourceMap[src])       sourceMap[src]       = {};
      if (!sourceMap[src][g])    sourceMap[src][g]    = {};
      if (!sourceMap[src][g][l]) sourceMap[src][g][l] = { lessonName: d.lessonName || '', types: {}, total: 0 };
      sourceMap[src][g][l].types[d.type] = (sourceMap[src][g][l].types[d.type] || 0) + 1;
      sourceMap[src][g][l].total++;
    });

    /* Flatten to gradeMap (all sources merged) for legacy rendering */
    var gradeMap = {};
    Object.keys(sourceMap).forEach(function(src) {
      Object.keys(sourceMap[src]).forEach(function(g) {
        if (!gradeMap[g]) gradeMap[g] = {};
        Object.keys(sourceMap[src][g]).forEach(function(l) {
          if (!gradeMap[g][l]) gradeMap[g][l] = { lessonName: sourceMap[src][g][l].lessonName, types: {}, total: 0, sources: [] };
          var ld = sourceMap[src][g][l];
          Object.keys(ld.types).forEach(function(t) {
            gradeMap[g][l].types[t] = (gradeMap[g][l].types[t] || 0) + ld.types[t];
          });
          gradeMap[g][l].total += ld.total;
          gradeMap[g][l].sources.push(src === 'shared' ? '共用' : '教師');
        });
      });
    });

    var gradeTotal = Object.keys(gradeMap).reduce(function(sum, g) {
      return sum + Object.keys(gradeMap[g]).reduce(function(s, l) { return s + gradeMap[g][l].total; }, 0);
    }, 0);

    /* Count shared vs teacher-owned */
    var sharedCount = 0, teacherCount = 0;
    snap.forEach(function(doc) {
      var uid = doc.data().teacherUid;
      if (uid === 'shared') sharedCount++;
      else teacherCount++;
    });

    var html = '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">' +
      '<div class="stat-card stat-blue"  style="flex:1;min-width:120px"><div class="stat-num">' + gradeTotal    + '</div><div class="stat-lbl">總題數</div></div>' +
      '<div class="stat-card stat-green" style="flex:1;min-width:120px"><div class="stat-num">' + sharedCount  + '</div><div class="stat-lbl">共用題庫</div></div>' +
      '<div class="stat-card stat-yellow"style="flex:1;min-width:120px"><div class="stat-num">' + teacherCount + '</div><div class="stat-lbl">教師題庫</div></div>' +
      '</div>';

    Object.keys(gradeMap).sort().forEach(function(grade) {
      var lessonMap = gradeMap[grade];

      /* Sort lessons by Chinese numeral / integer */
      var lessons = Object.keys(lessonMap).sort(function(a, b) {
        var na = _cnNumToInt(a), nb = _cnNumToInt(b);
        if (na !== null && nb !== null) return na - nb;
        return a.localeCompare(b, 'zh-TW');
      });

      var gradeLessonCount = lessons.length;
      var gradeQCount = lessons.reduce(function(s, l) { return s + lessonMap[l].total; }, 0);

      /* Grade header */
      html += '<div style="margin-bottom:20px">';
      html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;' +
              'background:var(--gray-lt);border-radius:8px;border:1px solid var(--border);margin-bottom:8px">';
      html += '<span style="font-weight:900;font-size:.95rem">' + _qbEsc(grade) + '</span>';
      html += '<span style="font-size:.78rem;color:var(--muted);font-weight:700">共 ' + gradeLessonCount + ' 課・' + gradeQCount + ' 題</span>';
      html += '</div>';

      /* Per-lesson table */
      html += '<table style="width:100%;border-collapse:collapse;font-size:.82rem">';
      html += '<tr>' +
        '<th style="text-align:left;padding:6px 10px;border-bottom:2px solid var(--border);font-size:.75rem;font-weight:800;color:var(--muted)">課次</th>' +
        '<th style="text-align:left;padding:6px 10px;border-bottom:2px solid var(--border);font-size:.75rem;font-weight:800;color:var(--muted)">課名</th>' +
        '<th style="text-align:right;padding:6px 10px;border-bottom:2px solid var(--border);font-size:.75rem;font-weight:800;color:var(--muted)">填空</th>' +
        '<th style="text-align:right;padding:6px 10px;border-bottom:2px solid var(--border);font-size:.75rem;font-weight:800;color:var(--muted)">解釋</th>' +
        '<th style="text-align:right;padding:6px 10px;border-bottom:2px solid var(--border);font-size:.75rem;font-weight:800;color:var(--muted)">選擇</th>' +
        '<th style="text-align:right;padding:6px 10px;border-bottom:2px solid var(--border);font-size:.75rem;font-weight:800;color:var(--muted)">小計</th>' +
        '<th style="padding:6px 10px;border-bottom:2px solid var(--border)"></th>' +
        '</tr>';

      lessons.forEach(function(lesson, i) {
        var ld  = lessonMap[lesson];
        var bg  = i % 2 === 0 ? 'var(--gray-lt)' : '#fff';
        var key = ++_qbDelCount;
        _qbDelKeys[key] = { grade: grade, lesson: lesson, lessonName: ld.lessonName };

        html += '<tr style="background:' + bg + '">';
        var srcBadge = (ld.sources || []).map(function(s) {
          var col = s === '共用' ? 'var(--blue)' : 'var(--green)';
          return '<span style="font-size:.68rem;font-weight:800;color:white;background:' + col + ';border-radius:4px;padding:1px 5px;margin-right:3px">' + s + '</span>';
        }).join('');
        html += '<td style="padding:6px 10px;border-bottom:1px solid var(--border);font-weight:700">第 ' + _qbEsc(lesson) + ' 課 ' + srcBadge + '</td>';
        html += '<td style="padding:6px 10px;border-bottom:1px solid var(--border);color:var(--muted)">' + _qbEsc(ld.lessonName) + '</td>';
        html += '<td style="text-align:right;padding:6px 10px;border-bottom:1px solid var(--border)">' + (ld.types['詞語填空'] || 0) + '</td>';
        html += '<td style="text-align:right;padding:6px 10px;border-bottom:1px solid var(--border)">' + (ld.types['詞語解釋'] || 0) + '</td>';
        html += '<td style="text-align:right;padding:6px 10px;border-bottom:1px solid var(--border)">' + (ld.types['選擇題']   || 0) + '</td>';
        html += '<td style="text-align:right;padding:6px 10px;border-bottom:1px solid var(--border);font-weight:800">' + ld.total + '</td>';
        html += '<td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:right">' +
          '<button onclick="deleteLessonQuestions(' + key + ')" ' +
          'style="padding:3px 10px;border:1.5px solid var(--red);border-radius:6px;background:white;' +
          'color:var(--red);font-size:.72rem;font-weight:800;cursor:pointer;font-family:inherit;' +
          'transition:background .15s" ' +
          'onmouseover="this.style.background=\'var(--red-lt)\'" ' +
          'onmouseout="this.style.background=\'white\'">刪除</button></td>';
        html += '</tr>';
      });

      html += '</table></div>';
    });

    wrap.innerHTML = html;
  }).catch(function(e) {
    wrap.innerHTML = '<p style="color:var(--red);font-size:.88rem">讀取失敗：' + e.message + '</p>';
  });
}

/* ════════════════════════════════════════
   刪除單一課次的所有題目
   Query by grade (single-field index) → filter lesson client-side → batch delete
   ════════════════════════════════════════ */
function deleteLessonQuestions(key) {
  var info = _qbDelKeys[key];
  if (!info) return;

  var label = info.grade + '　第 ' + info.lesson + ' 課' +
              (info.lessonName ? '　' + info.lessonName : '');

  if (!confirm('確定要刪除「' + label + '」的所有題目嗎？\n\n此操作無法復原。')) return;
  if (!db) { showToast('Firebase 未就緒'); return; }

  db.collection('questions').where('grade', '==', info.grade).get()
    .then(function(snap) {
      var toDelete = snap.docs.filter(function(doc) {
        return doc.data().lesson === info.lesson;
      });

      if (!toDelete.length) { showToast('找不到題目'); return Promise.resolve(); }

      var batches = [], batch = db.batch(), count = 0;
      toDelete.forEach(function(doc) {
        batch.delete(doc.ref);
        if (++count % 499 === 0) { batches.push(batch); batch = db.batch(); }
      });
      batches.push(batch);

      return Promise.all(batches.map(function(b) { return b.commit(); }))
        .then(function() {
          showToast('✅ 已刪除「' + label + '」共 ' + toDelete.length + ' 題');
          loadQuizBankStats();
        });
    })
    .catch(function(e) {
      showToast('❌ 刪除失敗：' + e.message);
    });
}
