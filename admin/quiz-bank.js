/**
 * admin/quiz-bank.js — 教師語文題庫管理（上傳 xlsx、顯示統計、刪除課次）
 * 依賴：shared.js（db、showToast）、SheetJS（XLSX）、init.js（currentTeacher）
 */
'use strict';

var qbParsedData = null;

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

function loadQuizBankStats() {
  var wrap = document.getElementById('qb-stats-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  _qbDelKeys       = {};
  _qbDelCount      = 0;
  _qbDetailMap     = {};
  _qbExpandedKeys  = {};
  _qbGradeExpanded = {};

  if (!db || !currentTeacher) { setTimeout(loadQuizBankStats, 300); return; }

  var uid = currentTeacher.uid;

  Promise.all([
    db.collection('questions').where('teacherUid', '==', uid).get(),
    db.collection('questions').where('teacherUid', '==', 'shared').get()
  ]).then(function(results) {
    var docs = [];
    results.forEach(function(snap) { snap.forEach(function(d) { docs.push(d); }); });

    if (docs.length === 0) {
      wrap.innerHTML = '<p style="color:var(--muted);font-size:.88rem;padding:16px 0">尚未有可用題目。請上傳題庫，或聯絡管理者新增共用題庫。</p>';
      return;
    }

    var gradeMap = {};

    docs.forEach(function(doc) {
      var d   = doc.data();
      var g   = d.grade  || '（未知年級）';
      var l   = d.lesson || '—';
      var src = d.teacherUid === 'shared' ? 'shared' : 'own';

      if (!gradeMap[g])    gradeMap[g]    = {};
      if (!gradeMap[g][l]) gradeMap[g][l] = { lessonName: d.lessonName || '', types: {}, total: 0, hasOwn: false, hasShared: false };
      gradeMap[g][l].types[d.type] = (gradeMap[g][l].types[d.type] || 0) + 1;
      gradeMap[g][l].total++;
      if (src === 'own') gradeMap[g][l].hasOwn = true;
      else               gradeMap[g][l].hasShared = true;

      /* Store for detail view */
      var dk = _qbDetailKey(g, l);
      if (!_qbDetailMap[dk]) _qbDetailMap[dk] = [];
      _qbDetailMap[dk].push({ type: d.type, question: d.question, answer: d.answer, src: src });
    });

    var html = '';

    Object.keys(gradeMap).sort().forEach(function(grade) {
      var lessonMap = gradeMap[grade];
      var lessons = Object.keys(lessonMap).sort(function(a, b) {
        var na = _cnNumToInt(a), nb = _cnNumToInt(b);
        if (na !== null && nb !== null) return na - nb;
        return a.localeCompare(b, 'zh-TW');
      });
      var gradeQCount = lessons.reduce(function(s, l) { return s + lessonMap[l].total; }, 0);
      var gk = _qbGradeKey(grade);

      html += '<div style="margin-bottom:12px">';
      /* Collapsible grade header */
      html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--gray-lt);border-radius:8px;border:1px solid var(--border);cursor:pointer" ' +
        'onclick="_qbToggleGrade(\'' + _qbEsc(gk) + '\',this)">';
      html += '<span id="qb-grade-arrow-' + _qbEsc(gk) + '" style="font-size:.78rem;color:var(--muted);transition:transform .15s;display:inline-block">▶</span>';
      html += '<span style="font-weight:900;font-size:.95rem">' + _qbEsc(grade) + '</span>';
      html += '<span style="font-size:.78rem;color:var(--muted);font-weight:700">共 ' + lessons.length + ' 課・' + gradeQCount + ' 題</span>';
      html += '</div>';
      /* Grade content (collapsed by default) */
      html += '<div id="qb-grade-body-' + _qbEsc(gk) + '" style="display:none">';

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

        var delBtn = '';
        if (ld.hasOwn) {
          var key = ++_qbDelCount;
          _qbDelKeys[key] = { grade: grade, lesson: lesson, lessonName: ld.lessonName };
          delBtn = '<button onclick="deleteLessonQuestions(' + key + ')" ' +
            'style="padding:3px 10px;border:1.5px solid var(--red);border-radius:6px;background:white;' +
            'color:var(--red);font-size:.72rem;font-weight:800;cursor:pointer;font-family:inherit;transition:background .15s" ' +
            'onmouseover="this.style.background=\'var(--red-lt)\'" onmouseout="this.style.background=\'white\'">刪除</button>';
        }

        var srcBadges = '';
        if (ld.hasOwn)    srcBadges += '<span style="font-size:.68rem;font-weight:800;color:white;background:var(--green);border-radius:4px;padding:1px 5px;margin-right:3px">我的</span>';
        if (ld.hasShared) srcBadges += '<span style="font-size:.68rem;font-weight:800;color:white;background:var(--blue);border-radius:4px;padding:1px 5px;margin-right:3px">共用</span>';

        /* Summary row */
        html += '<tr style="background:' + bg + '">';
        html += '<td style="padding:6px 10px;border-bottom:1px solid var(--border);font-weight:700">' +
          '<button onclick="_qbToggleDetail(\'' + _qbEsc(dk) + '\',this)" ' +
          'style="background:none;border:none;cursor:pointer;font-size:.75rem;margin-right:4px;color:var(--muted);font-family:inherit;padding:0" ' +
          'title="查看題目">▶</button>' +
          '第 ' + _qbEsc(lesson) + ' 課 ' + srcBadges + '</td>';
        html += '<td style="padding:6px 10px;border-bottom:1px solid var(--border);color:var(--muted)">' + _qbEsc(ld.lessonName) + '</td>';
        html += '<td style="text-align:right;padding:6px 10px;border-bottom:1px solid var(--border)">' + (ld.types['詞語填空'] || 0) + '</td>';
        html += '<td style="text-align:right;padding:6px 10px;border-bottom:1px solid var(--border)">' + (ld.types['詞語解釋'] || 0) + '</td>';
        html += '<td style="text-align:right;padding:6px 10px;border-bottom:1px solid var(--border)">' + (ld.types['選擇題']   || 0) + '</td>';
        html += '<td style="text-align:right;padding:6px 10px;border-bottom:1px solid var(--border);font-weight:800">' + ld.total + '</td>';
        html += '<td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:right">' + delBtn + '</td>';
        html += '</tr>';

        /* Detail row (collapsed by default) */
        html += '<tr id="qb-detail-' + _qbEsc(dk) + '" style="display:none">';
        html += '<td colspan="7" style="padding:0 10px 12px 28px;border-bottom:1px solid var(--border);background:#fafcff">';
        html += _qbRenderDetailTable(_qbDetailMap[dk] || []);
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
    var srcDot = q.src === 'own'
      ? '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--green);margin-right:4px;vertical-align:middle"></span>'
      : '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--blue);margin-right:4px;vertical-align:middle"></span>';
    html += '<tr style="background:' + (i % 2 === 0 ? '#fff' : '#f8faff') + '">';
    html += '<td style="padding:4px 8px;color:var(--muted);white-space:nowrap">' + (i + 1) + '</td>';
    html += '<td style="padding:4px 8px;white-space:nowrap">' + srcDot + _qbEsc(q.type) + '</td>';
    html += '<td style="padding:4px 8px;line-height:1.5;max-width:280px">' + _qbEsc(q.question) + '</td>';
    html += '<td style="padding:4px 8px;font-weight:700;color:var(--blue);white-space:nowrap">' + _qbEsc(q.answer) + '</td>';
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
