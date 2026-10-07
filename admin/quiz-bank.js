/**
 * admin/quiz-bank.js — 教師語文題庫管理（上傳 xlsx、顯示統計、刪除課次）
 * 依賴：shared.js（db、showToast）、SheetJS（XLSX）、init.js（currentTeacher）
 */
'use strict';

var qbParsedData = null;
var qbDupCount   = 0;   // 上傳前偵測到、已略過的重複題目數
var qbDupSamples = [];  // 略過的重複題目摘要（供教師檢視）

var _qbDelKeys  = {};
var _qbDelCount = 0;

/* ════════════════════════════════════════
   下載 Excel 範例檔（由 SheetJS 前端生成，免靜態托管）
   ════════════════════════════════════════ */
function downloadQbTemplate() {
  if (typeof XLSX === 'undefined') { showToast('SheetJS 尚未載入，請稍後再試'); return; }

  var headers = ['課次','課名','題型','題幹','選項一','選項二','選項三','選項四','答案'];
  var data = [
    headers,
    /* ── 詞語解釋：題幹填釋義，答案填詞語，選項欄留空 ── */
    ['一','你會怎麼回答','詞語解釋','把東西交給他人或送上去','','','','','遞上'],
    ['一','你會怎麼回答','詞語解釋','形容表現非常出色，超越其他人','','','','','出類拔萃'],
    /* ── 詞語填空：題幹含（　）空格，答案填填入詞語，選項欄留空 ── */
    ['一','你會怎麼回答','詞語填空','演講前，他複習準備好的（　）。','','','','','講稿'],
    ['一','你會怎麼回答','詞語填空','她（　）地完成了這項艱難的任務。','','','','','順利'],
    /* ── 選擇題：題幹填問題，選項一二三填選項文字，答案填數字 1／2／3 ── */
    ['一','你會怎麼回答','選擇題','邱吉爾如何回應寫著「傻瓜」的紙條？','生氣反駁','幽默化解','當場離開','','2'],
    ['一','你會怎麼回答','選擇題','「美不勝收」的意思是？','東西太多拿不完','景色優美令人目不暇給','心情非常快樂','','2']
  ];

  var ws = XLSX.utils.aoa_to_sheet(data);

  /* 欄寬設定 */
  ws['!cols'] = [
    { wch: 6  },   /* 課次 */
    { wch: 14 },   /* 課名 */
    { wch: 10 },   /* 題型 */
    { wch: 34 },   /* 題幹 */
    { wch: 14 },   /* 選項一 */
    { wch: 14 },   /* 選項二 */
    { wch: 14 },   /* 選項三 */
    { wch: 14 },   /* 選項四 */
    { wch: 12 }    /* 答案 */
  ];

  /* 標題列加底色（淺藍）*/
  var headerRange = XLSX.utils.decode_range('A1:I1');
  for (var C = headerRange.s.c; C <= headerRange.e.c; C++) {
    var cell = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[cell]) continue;
    ws[cell].s = { fill: { fgColor: { rgb: 'DBEEFF' } },
                   font: { bold: true } };
  }

  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '題庫範例');
  XLSX.writeFile(wb, '題庫上傳範例.xlsx');
}

/* ════════════════════════════════════════
   xlsx 解析 & 預覽
   支援新格式（選項一～四欄位 + 數字答案）
   及舊格式（題幹內 | 分隔 + 字母答案）向下相容
   ════════════════════════════════════════ */
function previewQuizBank() {
  var gradeEl = document.getElementById('qb-grade');
  var fileEl  = document.getElementById('qb-file');
  var grade   = gradeEl.value;

  if (!grade) { showToast('請先選擇版本與冊次！'); fileEl.value = ''; return; }

  var file = fileEl.files[0];
  if (!file) return;
  clearQbErrors();

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
              ansIdx = ansNum - 1;                         /* 數字 1/2/3/4 */
            } else if (/^[A-D]$/i.test(answer)) {
              ansIdx = answer.toUpperCase().charCodeAt(0) - 65; /* 字母 A/B/C/D */
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
          grade:      grade,
          lesson:     lesson,
          lessonName: lessonName,
          type:       type,
          question:   question,
          answer:     answer,
          options:    options,
          teacherUid: currentTeacher ? currentTeacher.uid : '',
          createdAt:  new Date().toISOString()
        });
      });

      if (errors.length > 0) showQbErrors(errors);

      if (qbParsedData.length === 0) {
        showToast('❌ 無法解析任何有效題目，請確認格式。');
        return;
      }

      _qbFilterDuplicates(grade);
    } catch(err) {
      showToast('❌ 解析失敗：' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

/* ── 判斷重複的標準：同年級＋同課次＋同題型＋同題幹＋同答案，全部相同才算重複 ── */
function _qbDupKey(item) {
  return item.grade + '||' + item.lesson + '||' + item.type + '||' + item.question + '||' + item.answer;
}

/* ── 比對「自己」已上傳過的題目，略過完全重複的列（不影響單純修改過的題目） ── */
function _qbFilterDuplicates(grade) {
  if (!db || !currentTeacher) { renderQuizBankPreview(); return; }

  db.collection('questions')
    .where('teacherUid', '==', currentTeacher.uid)
    .where('grade', '==', grade)
    .get()
    .then(function(snap) {
      var existingKeys = {};
      snap.forEach(function(doc) {
        existingKeys[_qbDupKey(doc.data())] = true;
      });

      var seenInFile = {};
      var kept = [];
      var dupSamples = [];
      qbParsedData.forEach(function(item) {
        var key = _qbDupKey(item);
        var isDup = existingKeys[key] || seenInFile[key];
        seenInFile[key] = true;
        if (isDup) {
          dupSamples.push('第' + item.lesson + '課．' + item.type + '．' + item.question + '　→　' + item.answer);
        } else {
          kept.push(item);
        }
      });

      qbDupCount  = dupSamples.length;
      qbDupSamples = dupSamples;
      qbParsedData = kept;

      if (qbParsedData.length === 0) {
        showToast('這批題目全部與你之前上傳過的重複，沒有新題目可上傳。');
        qbDupCount = 0; qbDupSamples = [];
        return;
      }

      renderQuizBankPreview();
    })
    .catch(function(e) {
      showToast('⚠️ 重複比對失敗（' + e.message + '），將略過比對直接預覽');
      renderQuizBankPreview();
    });
}

function renderQuizBankPreview() {
  document.getElementById('qb-total-count').textContent = qbParsedData.length;
  _qbRenderDupNotice();

  var headers = ['課次', '課名', '題型', '題幹', '答案'];
  var html = '<tr>' + headers.map(function(h) {
    return '<th style="text-align:left;padding:6px 10px;border-bottom:2px solid var(--border);font-weight:800;font-size:.78rem;color:var(--muted)">' + h + '</th>';
  }).join('') + '</tr>';

  qbParsedData.slice(0, 10).forEach(function(row, i) {
    var bg = i % 2 === 0 ? 'var(--gray-lt)' : '#fff';
    html += '<tr style="background:' + bg + '">';
    html += '<td style="padding:6px 10px;border-bottom:1px solid var(--border)">' + escHtml(row.lesson) + '</td>';
    html += '<td style="padding:6px 10px;border-bottom:1px solid var(--border)">' + escHtml(row.lessonName) + '</td>';
    html += '<td style="padding:6px 10px;border-bottom:1px solid var(--border)">' + escHtml(row.type) + '</td>';
    html += '<td style="padding:6px 10px;border-bottom:1px solid var(--border);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(row.question) + '</td>';
    html += '<td style="padding:6px 10px;border-bottom:1px solid var(--border)">' + escHtml(row.answer) + '</td>';
    html += '</tr>';
  });

  document.getElementById('qb-preview-table').innerHTML = html;
  document.getElementById('qb-preview-wrap').style.display = '';
}

/* ── 顯示已略過的重複題目提示（與自己之前上傳過的題目完全相同才會列在這裡） ── */
function _qbRenderDupNotice() {
  var el = document.getElementById('qb-dup-notice');
  if (!el) return;
  if (!qbDupCount) { el.innerHTML = ''; el.style.display = 'none'; return; }

  var visible = qbDupSamples.slice(0, 5);
  var html = '<div style="background:var(--orange-lt,#fdf1e6);border:1.5px solid var(--orange,#e67e22);border-radius:8px;padding:10px 14px">' +
    '<div style="font-size:.78rem;font-weight:800;color:#8a4a12;margin-bottom:6px">↩️ 已自動略過 ' + qbDupCount + ' 筆重複題目（課次／題型／題幹／答案皆與你之前上傳過的完全相同）：</div>' +
    '<ul style="padding-left:16px;font-size:.78rem;color:#8a4a12;line-height:1.7">';
  visible.forEach(function(s) { html += '<li>' + escHtml(s) + '</li>'; });
  if (qbDupSamples.length > 5) html += '<li style="color:var(--muted)">…還有 ' + (qbDupSamples.length - 5) + ' 筆</li>';
  html += '</ul></div>';
  el.innerHTML = html;
  el.style.display = '';
}

function clearQuizBankPreview() {
  qbParsedData = null;
  qbDupCount   = 0;
  qbDupSamples = [];
  document.getElementById('qb-file').value = '';
  document.getElementById('qb-preview-wrap').style.display = 'none';
  document.getElementById('qb-preview-table').innerHTML = '';
  clearQbErrors();
  var dupEl = document.getElementById('qb-dup-notice');
  if (dupEl) { dupEl.innerHTML = ''; dupEl.style.display = 'none'; }
  /* Reset button so teacher can upload a second file without refreshing */
  var btn = document.querySelector('#qb-preview-wrap .btn-primary');
  if (btn) { btn.disabled = false; btn.textContent = '⬆️ 上傳至 Firebase'; }
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
   題庫統計（本教師上傳 + shared 共用）
   ════════════════════════════════════════ */
var _qbDetailMap = {};   /* grade+lesson key → [question objects] for detail rows */
var _qbExpandedKeys = {}; /* detail keys currently expanded */
var _qbGradeExpanded = {}; /* grade keys currently expanded (collapsed by default) */

/* 課文全文（供課文趣 App 使用）：grade+lesson key → { grade, lesson, lessonName, docId, fullText, sharedClassIds } */
var _qbTextInfo     = {};
var _qbTextExpanded = {};
var _qbTextClassesCache = null; /* 教師自己的班級清單，載入一次快取 */

function loadQuizBankStats() {
  var wrap = document.getElementById('qb-stats-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  _qbDelKeys       = {};
  _qbDelCount      = 0;
  _qbDetailMap     = {};
  /* 保留 _qbExpandedKeys／_qbGradeExpanded，讓刪除單題後重新整理不會把展開的課次收合回去 */

  if (!db || !currentTeacher) { setTimeout(loadQuizBankStats, 300); return; }

  var uid = currentTeacher.uid;

  db.collection('questions').where('teacherUid', '==', uid).get()
    .then(function(snap) {
    var docs = [];
    snap.forEach(function(d) { docs.push(d); });

    if (docs.length === 0) {
      wrap.innerHTML = '<p style="color:var(--muted);font-size:.88rem;padding:16px 0">尚未有可用題目，請上傳題庫。</p>';
      return;
    }

    var gradeMap = {};

    docs.forEach(function(doc) {
      var d   = doc.data();
      var g   = d.grade  || '（未知年級）';
      var l   = d.lesson || '—';

      if (!gradeMap[g])    gradeMap[g]    = {};
      if (!gradeMap[g][l]) gradeMap[g][l] = { lessonName: d.lessonName || '', types: {}, total: 0 };
      gradeMap[g][l].types[d.type] = (gradeMap[g][l].types[d.type] || 0) + 1;
      gradeMap[g][l].total++;

      /* Store for detail view */
      var dk = _qbDetailKey(g, l);
      if (!_qbDetailMap[dk]) _qbDetailMap[dk] = [];
      _qbDetailMap[dk].push({ id: doc.id, type: d.type, question: d.question, answer: d.answer });
    });

    var html = '';

    Object.keys(gradeMap).sort().forEach(function(grade) {
      var lessonMap = gradeMap[grade];
      var lessons = Object.keys(lessonMap).sort(function(a, b) {
        var na = cnNumToInt(a), nb = cnNumToInt(b);
        if (na !== null && nb !== null) return na - nb;
        return a.localeCompare(b, 'zh-TW');
      });
      var gradeQCount = lessons.reduce(function(s, l) { return s + lessonMap[l].total; }, 0);
      var gk = _qbGradeKey(grade);

      var gradeOpen = !!_qbGradeExpanded[gk];

      html += '<div style="margin-bottom:12px">';
      /* Collapsible grade header */
      html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--gray-lt);border-radius:8px;border:1px solid var(--border);cursor:pointer" ' +
        'onclick="_qbToggleGrade(\'' + escHtml(gk) + '\',this)">';
      html += '<span id="qb-grade-arrow-' + escHtml(gk) + '" style="font-size:.78rem;color:var(--muted);transition:transform .15s;display:inline-block' +
        (gradeOpen ? ';transform:rotate(90deg)' : '') + '">▶</span>';
      html += '<span style="font-weight:900;font-size:.95rem">' + escHtml(grade) + '</span>';
      html += '<span style="font-size:.78rem;color:var(--muted);font-weight:700">共 ' + lessons.length + ' 課・' + gradeQCount + ' 題</span>';
      html += '</div>';
      /* Grade content（保留上次展開/收合狀態） */
      html += '<div id="qb-grade-body-' + escHtml(gk) + '" style="display:' + (gradeOpen ? '' : 'none') + '">';

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
        var dk  = _qbDetailKey(grade, lesson);

        var key = ++_qbDelCount;
        _qbDelKeys[key] = { grade: grade, lesson: lesson, lessonName: ld.lessonName };
        var delBtn = '<button onclick="deleteLessonQuestions(' + key + ')" ' +
          'style="padding:3px 10px;border:1.5px solid var(--red);border-radius:6px;background:white;' +
          'color:var(--red);font-size:.72rem;font-weight:800;cursor:pointer;font-family:inherit;transition:background .15s" ' +
          'onmouseover="this.style.background=\'var(--red-lt)\'" onmouseout="this.style.background=\'white\'">刪除</button>';

        var detailOpen = !!_qbExpandedKeys[dk];
        var textOpen   = !!_qbTextExpanded[dk];
        var textBtn = '<button onclick="_qbToggleText(\'' + escHtml(dk) + '\',\'' + _qbEscJs(grade) + '\',\'' + _qbEscJs(lesson) + '\',\'' + _qbEscJs(ld.lessonName) + '\')" ' +
          'style="padding:3px 10px;border:1.5px solid var(--blue);border-radius:6px;background:white;' +
          'color:var(--blue-dk);font-size:.72rem;font-weight:800;cursor:pointer;font-family:inherit;margin-right:6px">📖 課文</button>';

        /* Summary row */
        html += '<tr style="background:' + bg + '">';
        html += '<td style="padding:6px 10px;border-bottom:1px solid var(--border);font-weight:700">' +
          '<button onclick="_qbToggleDetail(\'' + escHtml(dk) + '\',this)" ' +
          'style="background:none;border:none;cursor:pointer;font-size:.75rem;margin-right:4px;color:var(--muted);font-family:inherit;padding:0" ' +
          'title="查看題目">' + (detailOpen ? '▼' : '▶') + '</button>' +
          '第 ' + escHtml(lesson) + ' 課</td>';
        html += '<td style="padding:6px 10px;border-bottom:1px solid var(--border);color:var(--muted)">' + escHtml(ld.lessonName) + '</td>';
        html += '<td style="text-align:right;padding:6px 10px;border-bottom:1px solid var(--border)">' + (ld.types['詞語填空'] || 0) + '</td>';
        html += '<td style="text-align:right;padding:6px 10px;border-bottom:1px solid var(--border)">' + (ld.types['詞語解釋'] || 0) + '</td>';
        html += '<td style="text-align:right;padding:6px 10px;border-bottom:1px solid var(--border)">' + (ld.types['選擇題']   || 0) + '</td>';
        html += '<td style="text-align:right;padding:6px 10px;border-bottom:1px solid var(--border);font-weight:800">' + ld.total + '</td>';
        html += '<td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:right;white-space:nowrap">' + textBtn + delBtn + '</td>';
        html += '</tr>';

        /* Detail row（保留上次展開/收合狀態） */
        html += '<tr id="qb-detail-' + escHtml(dk) + '" style="display:' + (detailOpen ? '' : 'none') + '">';
        html += '<td colspan="7" style="padding:0 10px 12px 28px;border-bottom:1px solid var(--border);background:#fafcff">';
        html += _qbRenderDetailTable(_qbDetailMap[dk] || []);
        html += '</td></tr>';

        /* 課文全文編輯列（保留上次展開/收合狀態，內容用 _qbLoadTextRow 非同步載入） */
        html += '<tr id="qb-text-' + escHtml(dk) + '" style="display:' + (textOpen ? '' : 'none') + '">';
        html += '<td colspan="7" id="qb-text-body-' + escHtml(dk) + '" style="padding:12px 10px 16px 28px;border-bottom:1px solid var(--border);background:#f5f9ff">';
        html += '<div class="loading-wrap" style="padding:8px 0"><div class="spinner"></div></div>';
        html += '</td></tr>';
      });

      html += '</table></div></div>';  /* close grade-body + grade wrapper */
    });

    wrap.innerHTML = html;
  }).catch(function(e) {
    wrap.innerHTML = '<p style="color:var(--red);font-size:.88rem">讀取失敗：' + e.message + '</p>';
  });
}

function _qbDetailKey(grade, lesson) {
  return (grade + '__' + lesson).replace(/[^a-zA-Z0-9_\u4e00-\u9fff]/g, '_');
}

function _qbGradeKey(grade) {
  return grade.replace(/[^a-zA-Z0-9_\u4e00-\u9fff]/g, '_');
}

function _qbToggleGrade(gk, headerEl) {
  var body  = document.getElementById('qb-grade-body-' + gk);
  var arrow = document.getElementById('qb-grade-arrow-' + gk);
  if (!body) return;
  var open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  if (arrow) arrow.style.transform = open ? '' : 'rotate(90deg)';
  _qbGradeExpanded[gk] = !open;
}

function _qbToggleDetail(dk, btn) {
  var row = document.getElementById('qb-detail-' + dk);
  if (!row) return;
  var open = row.style.display !== 'none';
  row.style.display = open ? 'none' : '';
  btn.textContent = open ? '▶' : '▼';
  _qbExpandedKeys[dk] = !open;
}

function _qbRenderDetailTable(questions) {
  if (!questions.length) return '<p style="color:var(--muted);font-size:.78rem;padding:8px 0">（無題目）</p>';

  var typeOrder = ['詞語填空', '詞語解釋', '選擇題'];
  var sorted = questions.slice().sort(function(a, b) {
    return typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
  });

  var html = '<table style="width:100%;border-collapse:collapse;font-size:.78rem;margin-top:8px">';
  html += '<tr>' +
    '<th style="text-align:left;padding:4px 8px;font-weight:800;color:var(--muted);border-bottom:1px solid var(--border)">#</th>' +
    '<th style="text-align:left;padding:4px 8px;font-weight:800;color:var(--muted);border-bottom:1px solid var(--border)">題型</th>' +
    '<th style="text-align:left;padding:4px 8px;font-weight:800;color:var(--muted);border-bottom:1px solid var(--border)">題幹</th>' +
    '<th style="text-align:left;padding:4px 8px;font-weight:800;color:var(--muted);border-bottom:1px solid var(--border)">答案</th>' +
    '<th style="padding:4px 8px;border-bottom:1px solid var(--border)"></th>' +
    '</tr>';

  sorted.forEach(function(q, i) {
    var rowDelBtn = q.id
      ? '<button onclick="deleteSingleQuestion(\'' + _qbEscJs(q.id) + '\',\'' + _qbEscJs(q.question) + '\')" ' +
        'style="padding:2px 8px;border:1.5px solid var(--red);border-radius:6px;background:white;' +
        'color:var(--red);font-size:.7rem;font-weight:800;cursor:pointer;font-family:inherit">刪除</button>'
      : '';
    html += '<tr style="background:' + (i % 2 === 0 ? '#fff' : '#f8faff') + '">';
    html += '<td style="padding:4px 8px;color:var(--muted);white-space:nowrap">' + (i + 1) + '</td>';
    html += '<td style="padding:4px 8px;white-space:nowrap">' + escHtml(q.type) + '</td>';
    html += '<td style="padding:4px 8px;line-height:1.5;max-width:280px">' + escHtml(q.question) + '</td>';
    html += '<td style="padding:4px 8px;font-weight:700;color:var(--blue);white-space:nowrap">' + escHtml(q.answer) + '</td>';
    html += '<td style="padding:4px 8px;text-align:right;white-space:nowrap">' + rowDelBtn + '</td>';
    html += '</tr>';
  });
  html += '</table>';
  return html;
}

/* ════════════════════════════════════════
   刪除教師自己上傳的單一課次題目
   ════════════════════════════════════════ */
function deleteLessonQuestions(key) {
  var info = _qbDelKeys[key];
  if (!info || !currentTeacher) return;

  var label = info.grade + '　第 ' + info.lesson + ' 課' +
              (info.lessonName ? '　' + info.lessonName : '');

  if (!confirm('確定要刪除「' + label + '」的所有題目嗎？\n\n使用這些題目建立的測驗場次也會同步關閉，學生將看不到這份試卷。\n\n此操作無法復原。')) return;
  if (!db) { showToast('Firebase 未就緒'); return; }

  db.collection('questions')
    .where('teacherUid', '==', currentTeacher.uid)
    .where('grade', '==', info.grade)
    .get()
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
          // 同步關閉所有使用這課次的測驗場次，確保學生看不到題目已刪除的試卷
          return _deactivateSessionsForLesson(info.grade, info.lesson);
        })
        .then(function() {
          loadQuizBankStats();
        });
    })
    .catch(function(e) { showToast('❌ 刪除失敗：' + e.message); });
}

/* ════════════════════════════════════════
   刪除單一題目（例如重複題，只想刪其中一題）
   ════════════════════════════════════════ */
function deleteSingleQuestion(docId, questionText) {
  if (!docId || !currentTeacher) return;
  if (!confirm('確定要刪除這一題嗎？\n\n「' + questionText + '」\n\n此操作無法復原。')) return;
  if (!db) { showToast('Firebase 未就緒'); return; }

  db.collection('questions').doc(docId).delete()
    .then(function() {
      showToast('✅ 已刪除這一題');
      loadQuizBankStats();
    })
    .catch(function(e) { showToast('❌ 刪除失敗：' + e.message); });
}

function _qbEscJs(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/* ════════════════════════════════════════
   課文全文（供課文趣 App 使用）
   身分＝currentTeacher.uid + grade + lesson，跟題庫的課次概念完全共用；
   配套生字詞不用另外輸入——課文趣自己會去題庫抓「詞語解釋／詞語填空」題型的答案欄當生字詞
   ════════════════════════════════════════ */

function _qbTextDocId(grade, lesson) {
  return 't_' + encodeURIComponent(currentTeacher.uid + '|' + grade + '|' + lesson);
}

function _qbToggleText(dk, grade, lesson, lessonName) {
  var row = document.getElementById('qb-text-' + dk);
  if (!row) return;
  var open = row.style.display !== 'none';
  row.style.display = open ? 'none' : '';
  _qbTextExpanded[dk] = !open;
  if (!open) _qbLoadTextRow(dk, grade, lesson, lessonName);
}

function _qbLoadTextRow(dk, grade, lesson, lessonName) {
  var body = document.getElementById('qb-text-body-' + dk);
  if (!body || !db || !currentTeacher) return;
  body.innerHTML = '<div class="loading-wrap" style="padding:8px 0"><div class="spinner"></div></div>';

  var docId = _qbTextDocId(grade, lesson);
  var loadClasses = _qbTextClassesCache
    ? Promise.resolve(_qbTextClassesCache)
    : db.collection('classes').where('teacherUid', '==', currentTeacher.uid).get().then(function(snap) {
        var list = [];
        snap.forEach(function(doc) {
          var d = doc.data();
          list.push({ id: doc.id, name: d.name || d.className || doc.id });
        });
        _qbTextClassesCache = list;
        return list;
      });

  Promise.all([
    db.collection('lessonTexts').doc(docId).get(),
    loadClasses
  ]).then(function(results) {
    var textDoc = results[0];
    var classes = results[1];
    var fullText = textDoc.exists ? (textDoc.data().fullText || '') : '';
    var sharedClassIds = textDoc.exists ? (textDoc.data().sharedClassIds || []) : [];
    var pronFixes = textDoc.exists ? (textDoc.data().pronFixes || {}) : {};

    _qbTextInfo[dk] = { grade: grade, lesson: lesson, lessonName: lessonName, docId: docId, sharedClassIds: sharedClassIds, pronFixes: pronFixes };
    _qbPendingPronFixes[dk] = pronFixes;

    var html =
      '<div style="font-size:.78rem;color:var(--muted);font-weight:600;margin-bottom:8px;line-height:1.6">' +
        '這一課的課文全文，給「課文趣」App 上課時逐字朗讀＋圈詞用。配套生字詞不用另外輸入，' +
        '課文趣會自動抓這一課「詞語解釋」「詞語填空」題目的答案當生字詞。' +
      '</div>' +
      '<div style="font-size:.75rem;color:var(--muted);font-weight:600;margin-bottom:6px">' +
        '可上傳 .docx / .txt / .odt / .pdf 自動轉成文字（舊版 .doc 請先另存新檔為 .docx），也能直接手打或貼上。' +
      '</div>' +
      '<input type="file" accept=".docx,.doc,.txt,.odt,.pdf" onchange="_qbFullTextFileSelected(\'' + dk + '\', this)" style="margin-bottom:8px">' +
      '<textarea id="qb-text-ta-' + dk + '" placeholder="課文全文…（段落之間空一行就會分段）" ' +
        'oninput="_qbRenderTextPreview(\'' + dk + '\')" style="width:100%;min-height:140px;padding:10px 12px;' +
        'border:1.5px solid var(--border);border-radius:8px;font-family:\'Noto Sans TC\',sans-serif;font-size:.88rem;' +
        'line-height:1.8;resize:vertical;box-sizing:border-box">' + _qbEscTA(fullText) + '</textarea>' +
      '<div style="display:flex;align-items:center;gap:10px;margin:8px 0 14px">' +
        '<button type="button" onclick="_qbInsertParaBreak(\'' + dk + '\')" ' +
          'style="padding:5px 14px;border:1.5px solid var(--blue);border-radius:8px;background:var(--blue-lt);' +
          'color:var(--blue-dk);font-size:.8rem;font-weight:800;cursor:pointer;font-family:inherit">⏎ 插入分段</button>' +
        '<span style="font-size:.74rem;color:var(--muted);font-weight:600">把游標放在要分段的地方再按這個按鈕</span>' +
      '</div>' +
      '<div style="font-size:.8rem;font-weight:800;margin-bottom:4px">📄 分段預覽（學生在課文趣實際看到的樣子）</div>' +
      '<div style="font-size:.75rem;color:var(--muted);font-weight:600;margin-bottom:8px;line-height:1.6">' +
        '文字下面有虛線的字是多音字，點一下可以選這個字在這裡要唸的讀音（只影響這一次出現，' +
        '課文裡其他地方的同一個字不受影響）；畫面上的注音會直接換成選的讀音。' +
      '</div>' +
      '<div id="qb-text-preview-' + dk + '" style="margin-bottom:16px"></div>' +
      '<div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;margin:8px 0 16px">' +
        '<span id="qb-text-status-' + dk + '" style="font-size:.78rem;font-weight:700;color:var(--muted)"></span>' +
        '<button onclick="_qbSaveLessonText(\'' + dk + '\')" ' +
          'style="padding:6px 18px;border:none;border-radius:8px;background:var(--blue);color:white;' +
          'font-size:.82rem;font-weight:800;cursor:pointer;font-family:inherit">儲存課文全文</button>' +
      '</div>' +
      '<div style="font-size:.8rem;font-weight:800;margin-bottom:4px">📤 分享給班級（課文趣的學生才看得到）</div>' +
      '<div style="font-size:.75rem;color:var(--muted);font-weight:600;margin-bottom:8px">' +
        '已經分享過的班級，之後按「儲存課文全文」內容就會自動同步給他們；這裡只有在要改變「分享給哪些班級」時才需要用。' +
      '</div>';

    if (!classes.length) {
      html += '<div style="color:var(--muted);font-size:.82rem">尚未建立班級。</div>';
    } else {
      html += '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:10px">';
      classes.forEach(function(cls) {
        var checked = sharedClassIds.indexOf(cls.id) !== -1;
        html += '<label style="display:flex;align-items:center;gap:5px;font-size:.85rem;font-weight:700;cursor:pointer">' +
          '<input type="checkbox" class="qb-text-class-cb" value="' + _qbEscAttr(cls.id) + '"' + (checked ? ' checked' : '') + '>' +
          escHtml(cls.name) +
          '</label>';
      });
      html += '</div>';
      html += '<div style="display:flex;align-items:center;justify-content:flex-end;gap:10px">' +
        '<span id="qb-share-status-' + dk + '" style="font-size:.78rem;font-weight:700;color:var(--muted)"></span>' +
        '<button onclick="_qbSaveLessonShare(\'' + dk + '\')" ' +
          'style="padding:6px 18px;border:none;border-radius:8px;background:var(--green);color:white;' +
          'font-size:.82rem;font-weight:800;cursor:pointer;font-family:inherit">更新分享班級</button>' +
        '</div>';
    }

    body.innerHTML = html;
    _qbRenderTextPreview(dk);
  }).catch(function(e) {
    body.innerHTML = '<p style="color:var(--red);font-size:.85rem">載入失敗：' + e.message + '</p>';
  });
}

/* dk -> { "行:字元序": {ch, readingIndex, homophone} }，老師正在編輯中、尚未按下「儲存課文全文」
   的破音字調整（開啟這一列時先用 Firestore 存的值初始化，_qbCollectPronFixes() 存檔時讀這份） */
var _qbPendingPronFixes = {};
var _qbHeteronymPopoverDk  = null;
var _qbHeteronymPopoverPos = null; // {line, ci, ch}

function _qbEscTA(s) {
  return String(s || '').replace(/<\/textarea/gi, '&lt;/textarea');
}
function _qbEscAttr(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* 把課文全文拆成「行」，每行再拆成一個個 Unicode 字元——跟課文趣
   apps/learn/lang/e-textbook/js/state.js 的 _etSplitLines() 用同一套邏輯（含中文字元判斷），
   確保這裡算出來的「行:字元序」位置，跟學生端 etLines 的位置編號完全一致，老師點的那個字
   才會精準對應到學生畫面上的同一個字。 */
function _qbSplitLines(text) {
  var rawLines = String(text || '').split(/\r?\n/);
  var lines = [];
  rawLines.forEach(function(line) {
    var trimmed = line.trim();
    if (!trimmed) {
      if (lines.length && !lines[lines.length - 1].blank) lines.push({ text: '', chars: [], blank: true });
      return;
    }
    var chars = Array.from(trimmed).map(function(ch) {
      return { ch: ch, interactive: /[一-鿿㐀-䶿]/.test(ch) };
    });
    lines.push({ text: trimmed, chars: chars, blank: false });
  });
  while (lines.length && lines[lines.length - 1].blank) lines.pop();
  return lines;
}

/* 存檔用：只收集「現在文字框內容」位置還真的對得上那個字的設定——老師編輯課文全文時
   增刪字可能讓位置跑掉，跑掉的設定就當作失效、不存檔，不會悄悄套到編輯後跑位的其他字上 */
function _qbCollectPronFixes(dk) {
  var ta = document.getElementById('qb-text-ta-' + dk);
  var pending = _qbPendingPronFixes[dk] || {};
  if (!ta) return pending;
  var lines = _qbSplitLines(ta.value);
  var out = {};
  Object.keys(pending).forEach(function(key) {
    var fix = pending[key];
    var parts = key.split(':');
    var charObj = lines[parts[0]] && lines[parts[0]].chars[parts[1]];
    if (charObj && charObj.ch === fix.ch) out[key] = fix;
  });
  return out;
}

/* 分段預覽——每一段各自用一個有邊框、有編號標籤的卡片呈現（跟學生端 _etSplitLines() 同一套
   分段判斷：一行以上空行＝一個分段）。多音字（HETERONYM_READINGS 裡有收錄的字）加上虛線底線、
   可以點擊；點了開 _qbCharClick() 的讀音選單，已經設定過的字額外標色，滑鼠移上去用 title
   顯示目前選的讀音。 */
function _qbRenderTextPreview(dk) {
  var ta = document.getElementById('qb-text-ta-' + dk);
  var el = document.getElementById('qb-text-preview-' + dk);
  if (!ta || !el) return;
  var lines = _qbSplitLines(ta.value);
  if (!lines.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:.78rem;padding:4px 0">尚未輸入內容，預覽會顯示在這裡</div>';
    return;
  }
  var fixes = _qbPendingPronFixes[dk] || {};
  var paragraphs = [];
  var current = [];
  lines.forEach(function(line, li) {
    if (line.blank) { if (current.length) { paragraphs.push(current); current = []; } }
    else current.push(li);
  });
  if (current.length) paragraphs.push(current);

  el.innerHTML = paragraphs.map(function(lineIdxs, pi) {
    var body = lineIdxs.map(function(li, k) {
      var line = lines[li];
      var charsHtml = line.chars.map(function(c, ci) {
        if (!c.interactive) return escHtml(c.ch);
        var readings = HETERONYM_READINGS[c.ch];
        if (!readings) return '<span>' + escHtml(c.ch) + '</span>';
        var fix = fixes[li + ':' + ci];
        var hasFix = fix && fix.ch === c.ch;
        var title = hasFix ? ('目前讀音：' + (readings[fix.readingIndex] || '')) : '多音字，點選可調整這一個字的讀音';
        return '<span class="qb-het-char" data-line="' + li + '" data-ci="' + ci + '" title="' + _qbEscAttr(title) + '" ' +
          'onclick="_qbCharClick(\'' + dk + '\',' + li + ',' + ci + ',\'' + c.ch + '\',this)" ' +
          'style="cursor:pointer;border-bottom:2px dashed ' + (hasFix ? 'var(--blue)' : 'var(--muted)') + ';' +
          (hasFix ? 'background:var(--blue-lt);border-radius:3px' : '') + '">' + escHtml(c.ch) + '</span>';
      }).join('');
      return charsHtml + (k < lineIdxs.length - 1 ? '\n' : '');
    }).join('');
    return '<div style="position:relative;background:white;border:1.5px solid var(--border);border-radius:8px;' +
      'padding:10px 12px 10px 44px;margin-bottom:10px;font-size:.88rem;line-height:1.8;white-space:pre-wrap">' +
      '<span style="position:absolute;left:8px;top:9px;font-size:.68rem;font-weight:800;color:var(--blue-dk);' +
      'background:var(--blue-lt);padding:2px 6px;border-radius:6px;white-space:nowrap">第' + (pi + 1) + '段</span>' +
      body +
    '</div>';
  }).join('');
}

/* ── 破音字讀音選單：點預覽裡的多音字彈出來，選讀音＋選填朗讀同音字，即點即生效 ── */
function _qbEnsureHeteronymPopover() {
  var pop = document.getElementById('qb-heteronym-popover');
  if (pop) return pop;
  pop = document.createElement('div');
  pop.id = 'qb-heteronym-popover';
  pop.style.cssText = 'position:fixed;z-index:9999;display:none;background:white;border:1.5px solid var(--border);' +
    'border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:12px;min-width:220px;max-width:280px;' +
    'font-family:"Noto Sans TC",sans-serif';
  document.body.appendChild(pop);
  document.addEventListener('pointerdown', function(e) {
    if (pop.style.display === 'none') return;
    if (pop.contains(e.target) || (e.target.classList && e.target.classList.contains('qb-het-char'))) return;
    _qbCloseHeteronymPopover();
  });
  return pop;
}

function _qbCloseHeteronymPopover() {
  var pop = document.getElementById('qb-heteronym-popover');
  if (pop) pop.style.display = 'none';
  _qbHeteronymPopoverDk  = null;
  _qbHeteronymPopoverPos = null;
}

function _qbCharClick(dk, line, ci, ch, el) {
  if (!HETERONYM_READINGS[ch]) return;
  var pop = _qbEnsureHeteronymPopover();
  _qbHeteronymPopoverDk  = dk;
  _qbHeteronymPopoverPos = { line: line, ci: ci, ch: ch };
  _qbRenderHeteronymPopoverContent();
  pop.style.display = '';
  var rect = el.getBoundingClientRect();
  pop.style.top  = (rect.bottom + 6) + 'px';
  pop.style.left = rect.left + 'px';
  requestAnimationFrame(function() {
    var pw = pop.offsetWidth;
    if (rect.left + pw > window.innerWidth - 10) pop.style.left = Math.max(10, window.innerWidth - pw - 10) + 'px';
  });
}

function _qbRenderHeteronymPopoverContent() {
  var pop = document.getElementById('qb-heteronym-popover');
  var dk = _qbHeteronymPopoverDk, pos = _qbHeteronymPopoverPos;
  if (!pop || !dk || !pos) return;
  var readings = HETERONYM_READINGS[pos.ch] || [];
  var existing = (_qbPendingPronFixes[dk] || {})[pos.line + ':' + pos.ci];
  var curIndex = (existing && existing.ch === pos.ch) ? existing.readingIndex : 0;
  var curHomophone = (existing && existing.ch === pos.ch) ? (existing.homophone || '') : '';

  pop.innerHTML =
    '<div style="font-size:.78rem;font-weight:800;margin-bottom:8px">「' + escHtml(pos.ch) + '」選正確讀音</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">' +
    readings.map(function(r, idx) {
      var active = idx === curIndex;
      return '<button type="button" onclick="_qbPickHeteronymReading(' + idx + ')" ' +
        'style="padding:6px 10px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.95rem;font-weight:700;' +
        (active
          ? 'border:2px solid var(--blue);background:var(--blue-lt);color:var(--blue-dk)'
          : 'border:1.5px solid var(--border);background:white;color:inherit') +
        '">' + escHtml(r) + '</button>';
    }).join('') +
    '</div>' +
    '<label style="display:block;font-size:.74rem;color:var(--muted);font-weight:700;margin-bottom:4px">' +
      '朗讀同音字（選填，只影響朗讀發音，不影響畫面注音）</label>' +
    '<input type="text" id="qb-het-homophone" maxlength="4" value="' + _qbEscAttr(curHomophone) + '" placeholder="例：住" ' +
      'oninput="_qbSetHeteronymHomophone(this.value)" ' +
      'style="width:70px;padding:5px 6px;border:1.5px solid var(--border);border-radius:6px;font-family:inherit;' +
      'font-size:.9rem;text-align:center;margin-bottom:10px;display:block">' +
    '<div style="display:flex;justify-content:space-between;gap:8px">' +
      '<button type="button" onclick="_qbClearHeteronymFix()" style="padding:5px 12px;border:none;border-radius:8px;' +
        'background:var(--red-lt);color:var(--red);font-weight:800;cursor:pointer;font-family:inherit;font-size:.8rem">清除設定</button>' +
      '<button type="button" onclick="_qbCloseHeteronymPopover()" style="padding:5px 12px;border:1.5px solid var(--border);' +
        'border-radius:8px;background:white;font-weight:700;cursor:pointer;font-family:inherit;font-size:.8rem">關閉</button>' +
    '</div>';
}

function _qbPickHeteronymReading(idx) {
  var dk = _qbHeteronymPopoverDk, pos = _qbHeteronymPopoverPos;
  if (!dk || !pos) return;
  var homophoneInput = document.getElementById('qb-het-homophone');
  var homophone = homophoneInput ? homophoneInput.value.trim() : '';
  if (!_qbPendingPronFixes[dk]) _qbPendingPronFixes[dk] = {};
  var key = pos.line + ':' + pos.ci;
  if (idx === 0 && !homophone) delete _qbPendingPronFixes[dk][key];
  else _qbPendingPronFixes[dk][key] = { ch: pos.ch, readingIndex: idx, homophone: homophone };
  _qbRenderTextPreview(dk);
  _qbRenderHeteronymPopoverContent();
}

function _qbSetHeteronymHomophone(val) {
  var dk = _qbHeteronymPopoverDk, pos = _qbHeteronymPopoverPos;
  if (!dk || !pos) return;
  val = val.trim();
  if (!_qbPendingPronFixes[dk]) _qbPendingPronFixes[dk] = {};
  var key = pos.line + ':' + pos.ci;
  var existing = _qbPendingPronFixes[dk][key];
  var curIndex = (existing && existing.ch === pos.ch) ? existing.readingIndex : 0;
  if (curIndex === 0 && !val) delete _qbPendingPronFixes[dk][key];
  else _qbPendingPronFixes[dk][key] = { ch: pos.ch, readingIndex: curIndex, homophone: val };
  /* 只重畫底下的預覽標記，popover 裡的輸入框保持原樣、不重畫，不然打字打到一半會失焦 */
  _qbRenderTextPreview(dk);
}

function _qbClearHeteronymFix() {
  var dk = _qbHeteronymPopoverDk, pos = _qbHeteronymPopoverPos;
  if (!dk || !pos) return;
  if (_qbPendingPronFixes[dk]) delete _qbPendingPronFixes[dk][pos.line + ':' + pos.ci];
  _qbRenderTextPreview(dk);
  _qbRenderHeteronymPopoverContent();
}

/* 在游標位置插入一個明確的分段（一個空行），不用自己手動按空白鍵去空一行、
   也不會因為不小心只空半行而沒生效——前後都會自動補上乾淨的換行。 */
function _qbInsertParaBreak(dk) {
  var ta = document.getElementById('qb-text-ta-' + dk);
  if (!ta) return;
  var start = ta.selectionStart, end = ta.selectionEnd;
  var before = ta.value.slice(0, start);
  var after  = ta.value.slice(end);
  var insertion = '\n\n';
  ta.value = before + insertion + after;
  var newPos = before.length + insertion.length;
  ta.focus();
  ta.setSelectionRange(newPos, newPos);
  _qbRenderTextPreview(dk);
}

function _qbFullTextFileSelected(dk, input) {
  var file = input.files && input.files[0];
  if (!file) return;
  var ext = _lftExt(file.name);
  var statusEl = document.getElementById('qb-text-status-' + dk);

  if (ext === 'doc') {
    if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = '⚠️ 偵測到舊版 .doc 格式，請用 Word/WPS/Google 文件另存新檔為 .docx 後再上傳'; }
    input.value = '';
    return;
  }
  if (LFT_SUPPORTED_EXTS.indexOf(ext) === -1) {
    if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = '⚠️ 不支援的檔案格式：.' + ext; }
    input.value = '';
    return;
  }

  if (statusEl) { statusEl.style.color = 'var(--muted)'; statusEl.textContent = '轉換中…'; }
  var fr = new FileReader();
  fr.onload = function(e) {
    _lftExtractText(ext, e.target.result).then(function(text) {
      var ta = document.getElementById('qb-text-ta-' + dk);
      if (ta) ta.value = text;
      _qbRenderTextPreview(dk);
      if (statusEl) { statusEl.style.color = 'var(--blue-dk)'; statusEl.textContent = '✅ 已轉換，請檢查內容後按「儲存課文全文」'; }
      input.value = '';
    }).catch(function(err) {
      if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = '⚠️ 轉換失敗：' + err.message; }
      input.value = '';
    });
  };
  if (ext === 'txt') fr.readAsText(file);
  else fr.readAsArrayBuffer(file);
}

/* 每個已分享的班級各自存一份「分享快照」，供課文趣的學生端查詢班級可讀的課文——
   學生讀的是這份快照，不是 lessonTexts 本身，所以內容異動都要同步到這裡才會反映到學生畫面。
   prevIds（上一次分享的班級，若有變動要把不在新名單裡的刪掉）可省略，省略時只新增/覆蓋不刪除，
   適合「內容變了但分享班級沒變」這種情境（_qbSaveLessonText 存檔時自動同步用）。 */
function _qbSyncSharedSnapshots(info, fullText, pronFixes, classIds, prevIds) {
  var batch = db.batch();
  (prevIds || []).forEach(function(cid) {
    if (classIds.indexOf(cid) === -1) {
      batch.delete(db.collection('classes').doc(cid).collection('sharedLessonTexts').doc(info.docId));
    }
  });
  classIds.forEach(function(cid) {
    batch.set(db.collection('classes').doc(cid).collection('sharedLessonTexts').doc(info.docId), {
      teacherUid: currentTeacher.uid,
      grade:      info.grade,
      lesson:     info.lesson,
      lessonName: info.lessonName,
      fullText:   fullText,
      pronFixes:  pronFixes,
      sharedAt:   new Date().toISOString()
    });
  });
  return batch.commit();
}

/* 存課文全文（含破音字設定）。如果這一課已經分享給班級，存檔後會順便自動把分享快照也同步更新，
   不用每次改完內容都要記得再手動按一次「更新分享班級」——那個按鈕只在「要改分享的班級名單」
   時才需要用到。 */
function _qbSaveLessonText(dk) {
  var info = _qbTextInfo[dk];
  var ta   = document.getElementById('qb-text-ta-' + dk);
  var statusEl = document.getElementById('qb-text-status-' + dk);
  if (!info || !ta || !db || !currentTeacher) return;
  var text = ta.value;
  var pronFixes = _qbCollectPronFixes(dk);
  if (statusEl) { statusEl.style.color = 'var(--muted)'; statusEl.textContent = '儲存中…'; }

  db.collection('lessonTexts').doc(info.docId).set({
    teacherUid: currentTeacher.uid,
    grade:      info.grade,
    lesson:     info.lesson,
    lessonName: info.lessonName,
    fullText:   text,
    pronFixes:  pronFixes,
    updatedAt:  new Date().toISOString()
  }, { merge: true }).then(function() {
    var sharedIds = info.sharedClassIds || [];
    if (!sharedIds.length) return null;
    return _qbSyncSharedSnapshots(info, text, pronFixes, sharedIds);
  }).then(function(synced) {
    info.pronFixes = pronFixes;
    if (statusEl) {
      statusEl.style.color = 'var(--green)';
      statusEl.textContent = synced !== null ? '✅ 已儲存（已同步更新到已分享的班級）' : '✅ 已儲存';
    }
    showToast('✅ 課文全文已儲存');
  }).catch(function(e) {
    if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = '❌ ' + e.message; }
    showToast('❌ 儲存失敗：' + e.message);
  });
}

function _qbSaveLessonShare(dk) {
  var info = _qbTextInfo[dk];
  var statusEl = document.getElementById('qb-share-status-' + dk);
  if (!info || !db || !currentTeacher) return;

  var checkboxes = document.querySelectorAll('#qb-text-body-' + dk + ' .qb-text-class-cb');
  var classIds = [];
  checkboxes.forEach(function(cb) { if (cb.checked) classIds.push(cb.value); });

  var ta = document.getElementById('qb-text-ta-' + dk);
  var fullText = ta ? ta.value : '';
  var pronFixes = _qbCollectPronFixes(dk);

  if (statusEl) { statusEl.style.color = 'var(--muted)'; statusEl.textContent = '更新中…'; }

  /* 先確保 lessonTexts 本身（含目前文字框內容）是最新的，分享的班級清單也一併記在這份文件上 */
  db.collection('lessonTexts').doc(info.docId).set({
    teacherUid: currentTeacher.uid,
    grade:      info.grade,
    lesson:     info.lesson,
    lessonName: info.lessonName,
    fullText:   fullText,
    pronFixes:  pronFixes,
    sharedClassIds: classIds,
    updatedAt:  new Date().toISOString()
  }, { merge: true }).then(function() {
    return _qbSyncSharedSnapshots(info, fullText, pronFixes, classIds, info.sharedClassIds || []);
  }).then(function() {
    info.sharedClassIds = classIds;
    info.pronFixes = pronFixes;
    if (statusEl) { statusEl.style.color = 'var(--green)'; statusEl.textContent = '✅ 已更新'; }
    showToast('✅ 分享班級已更新');
  }).catch(function(e) {
    if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = '❌ ' + e.message; }
    showToast('❌ 更新失敗：' + e.message);
  });
}

/**
 * 刪除題庫課次後，同步將所有使用該課次的測驗場次標記為 active:false
 * 確保學生端看不到題目已刪除的試卷
 * @param {string} grade  年級（如「三上」）
 * @param {string} lesson 課次（如「五」）
 */
function _deactivateSessionsForLesson(grade, lesson) {
  if (!db || !currentTeacher) return Promise.resolve();
  return db.collection('quizSessions')
    .where('teacherUid', '==', currentTeacher.uid)
    .where('grade', '==', grade)
    .get()
    .then(function(snap) {
      var toClose = snap.docs.filter(function(doc) {
        var d = doc.data();
        return d.lesson === lesson && d.active !== false;
      });
      if (!toClose.length) return;
      var batch = db.batch();
      toClose.forEach(function(doc) {
        batch.update(doc.ref, { active: false });
      });
      return batch.commit().then(function() {
        if (toClose.length > 0) {
          showToast('📋 相關測驗場次（' + toClose.length + ' 個）已同步關閉');
        }
        // 若目前測驗列表已渲染，一併刷新
        if (typeof loadQuizSessions === 'function') loadQuizSessions();
      });
    })
    .catch(function(e) {
      console.warn('_deactivateSessionsForLesson error:', e);
    });
}
