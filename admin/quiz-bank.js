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
      return _qbSyncVocabFromImport(qbParsedData);
    })
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

/* Excel 匯入「詞語解釋／詞語填空」題時，答案欄的詞語同步補進對應課文的 lessonTexts/{docId}/vocab，
   課文編輯那邊才看得到（不用老師兩邊各自維護）。只補「這個字完全沒有記錄」的，不動已經存在的
   （不管是老師手動加的還是之前匯入過的），避免蓋掉老師自己的設定。docId 算法要跟
   admin/lesson-text.js 的 _ltDocId 完全一致：'t_' + encodeURIComponent(teacherUid + '|' + grade + '|' + lesson)。
   單一課次同步失敗不擋住整個上傳流程（已經上傳的題目不該因為這一步失敗而跳錯誤）。 */
function _qbSyncVocabFromImport(items) {
  if (!db || !currentTeacher) return Promise.resolve();
  var wordsByLesson = {};
  items.forEach(function(item) {
    if (item.type !== '詞語解釋' && item.type !== '詞語填空') return;
    var word = (item.answer || '').trim();
    if (!word) return;
    var docId = 't_' + encodeURIComponent(currentTeacher.uid + '|' + item.grade + '|' + item.lesson);
    if (!wordsByLesson[docId]) wordsByLesson[docId] = {};
    wordsByLesson[docId][word] = true;
  });
  var docIds = Object.keys(wordsByLesson);
  if (!docIds.length) return Promise.resolve();

  return Promise.all(docIds.map(function(docId) {
    return db.collection('lessonTexts').doc(docId).collection('vocab').get().then(function(snap) {
      var existing = {};
      snap.forEach(function(doc) { existing[doc.id] = true; });
      var batch = db.batch();
      var writes = 0;
      Object.keys(wordsByLesson[docId]).forEach(function(word) {
        if (existing[word]) return;
        batch.set(db.collection('lessonTexts').doc(docId).collection('vocab').doc(word), {
          word: word, addedAt: new Date().toISOString(), source: 'questions'
        });
        writes++;
      });
      return writes ? batch.commit() : Promise.resolve();
    }).catch(function() {});
  }));
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
        '<th style="text-align:right;padding:6px 10px;border-bottom:2px solid var(--border);font-size:.75rem;font-weight:800;color:var(--muted)">重組</th>' +
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
        html += '<td style="text-align:right;padding:6px 10px;border-bottom:1px solid var(--border)">' + (ld.types['句子重組'] || 0) + '</td>';
        html += '<td style="text-align:right;padding:6px 10px;border-bottom:1px solid var(--border);font-weight:800">' + ld.total + '</td>';
        html += '<td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:right;white-space:nowrap">' + delBtn + '</td>';
        html += '</tr>';

        /* Detail row（保留上次展開/收合狀態） */
        html += '<tr id="qb-detail-' + escHtml(dk) + '" style="display:' + (detailOpen ? '' : 'none') + '">';
        html += '<td colspan="8" style="padding:0 10px 12px 28px;border-bottom:1px solid var(--border);background:#fafcff">';
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
  _qbExpandedKeys[dk] = !open;
}

function _qbRenderDetailTable(questions) {
  if (!questions.length) return '<p style="color:var(--muted);font-size:.78rem;padding:8px 0">（無題目）</p>';

  var typeOrder = ['詞語填空', '詞語解釋', '選擇題', '句子重組'];
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

/* ════════════════════════════════════════
   句子重組題——給特教學生練習的題型：把一句課文打散成片段，學生要排回正確順序。
   詞語不能被拆開這個要求，靠「這一課已經設定好的本課語詞」當斷詞依據（最長匹配優先），
   不在語詞庫裡的字各自獨立成一塊（寧可切太細，不會切錯詞）；老師可以手動調整分界再存檔。
   資料跟其他題型共用同一個 questions collection，type:'句子重組'，
   options 陣列存最終片段（陣列順序＝正確順序），question/answer 都存還原後的完整句子
   （方便既有的題庫列表/exam-compose.js 等畫面直接顯示，不用額外改那些地方）。
   ════════════════════════════════════════ */
var _srAtoms      = [];    // 目前這句話拆出來的最小單位（詞語庫比對出的詞或單字）
var _srBoundaries = [];    // 長度 = atoms.length-1，true=這裡是分界（兩塊分開）、false=合併成同一塊

/* 抓這一課「本課語詞」的聯集（題庫衍生 + 課文編輯手動加的），邏輯跟 admin/lesson-text.js
   的 _ltFetchVocab 一致，但這裡只要字的清單，不需要完整的 UI 狀態 */
function _srLoadVocabWords(grade, lesson) {
  var qQuestions = db.collection('questions').where('teacherUid', '==', currentTeacher.uid).where('grade', '==', grade).get();
  var docId = 't_' + encodeURIComponent(currentTeacher.uid + '|' + grade + '|' + lesson);
  var qManual = db.collection('lessonTexts').doc(docId).collection('vocab').get();
  return Promise.all([qQuestions, qManual]).then(function(results) {
    var words = {};
    results[0].forEach(function(doc) {
      var d = doc.data();
      if (d.lesson !== lesson) return;
      if (d.type !== '詞語解釋' && d.type !== '詞語填空') return;
      var w = (d.answer || '').trim();
      if (w) words[w] = true;
    });
    results[1].forEach(function(doc) {
      var w = (doc.data().word || '').trim();
      if (w) words[w] = true;
    });
    return Object.keys(words);
  }).catch(function() { return []; });
}

/* 最長匹配優先的貪婪斷詞：從左到右掃，每個位置優先比對最長的語詞；沒匹配到的字單獨一塊 */
function _srSegmentIntoAtoms(sentence, vocabWords) {
  var sorted = vocabWords.filter(function(w) { return w.length >= 2; })
    .sort(function(a, b) { return b.length - a.length; });
  var atoms = [];
  var i = 0;
  while (i < sentence.length) {
    var matched = null;
    for (var j = 0; j < sorted.length; j++) {
      var w = sorted[j];
      if (sentence.slice(i, i + w.length) === w) { matched = w; break; }
    }
    if (matched) { atoms.push(matched); i += matched.length; }
    else { atoms.push(sentence[i]); i += 1; }
  }
  return atoms;
}

function _srSegmentSentence() {
  var grade    = (document.getElementById('sr-grade').value || '').trim();
  var lesson   = (document.getElementById('sr-lesson').value || '').trim();
  var sentence = (document.getElementById('sr-sentence').value || '').trim();
  var statusEl = document.getElementById('sr-status');
  if (!grade) { if (statusEl) statusEl.textContent = '請先在上方選版本與冊次'; return; }
  if (!lesson) { if (statusEl) statusEl.textContent = '請先填課次'; return; }
  if (!sentence) { if (statusEl) statusEl.textContent = '請先輸入句子'; return; }

  if (statusEl) { statusEl.style.color = 'var(--muted)'; statusEl.textContent = '拆解中…'; }
  _srLoadVocabWords(grade, lesson).then(function(vocabWords) {
    _srAtoms = _srSegmentIntoAtoms(sentence, vocabWords);
    _srBoundaries = _srAtoms.map(function() { return true; }).slice(0, _srAtoms.length - 1);
    document.getElementById('sr-pieces-wrap').style.display = '';
    if (statusEl) {
      statusEl.style.color = 'var(--muted)';
      statusEl.textContent = vocabWords.length ? '' : '⚠️ 這一課還沒有設定本課語詞，所有字先各自獨立，記得手動合併該保留整塊的詞';
    }
    _srRenderPieces();
  });
}

/* 把目前的 atoms/boundaries 整理成一組組「塊」，每塊紀錄涵蓋哪個範圍的 atom index，
   畫面渲染跟「拆開」都要知道一塊裡面實際有哪些 atom，用這個共用算出來，不要各自重算一次 */
function _srComputeGroups() {
  var groups = [];
  var start = 0;
  for (var i = 1; i <= _srAtoms.length; i++) {
    if (i === _srAtoms.length || _srBoundaries[i - 1]) {
      groups.push({ atomStart: start, atomEnd: i - 1 });
      start = i;
    }
  }
  return groups;
}

/* 畫面上直接把「同一塊」的字框在一起變成一個藥丸形狀（視覺上真的像一個詞），
   塊跟塊之間放一個明顯的「+ 合併」按鈕；如果一塊裡面不小心合了好幾個字、想拆開，
   塊內字跟字中間有不顯眼的細直線可以點（比較少用到，不用太搶眼） */
function _srRenderPieces() {
  var el = document.getElementById('sr-pieces');
  if (!el) return;
  var groups = _srComputeGroups();
  el.innerHTML = groups.map(function(g, gi) {
    var inner = '';
    for (var a = g.atomStart; a <= g.atomEnd; a++) {
      inner += escHtml(_srAtoms[a]);
      if (a < g.atomEnd) {
        inner += '<span onclick="event.stopPropagation();_srToggleBoundary(' + a + ')" title="點一下把這裡拆開" ' +
          'style="display:inline-block;width:10px;text-align:center;cursor:pointer;color:var(--blue-dk);' +
          'opacity:.3;font-weight:900">｜</span>';
      }
    }
    var piece = '<span style="display:inline-flex;align-items:center;padding:7px 12px;background:var(--blue-lt);' +
      'color:var(--blue-dk);border-radius:20px;font-weight:800;font-size:.98rem;font-family:inherit">' + inner + '</span>';
    if (gi === groups.length - 1) return piece;
    var mergeBtn = '<button type="button" onclick="_srToggleBoundary(' + g.atomEnd + ')" title="把這兩個詞合併成一塊" ' +
      'style="margin:0 4px;width:26px;height:26px;border:1.5px dashed var(--border);border-radius:50%;background:white;' +
      'color:var(--blue-dk);cursor:pointer;font-size:1rem;font-weight:800;font-family:inherit;line-height:1;' +
      'display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">' +
      '＋</button>';
    return piece + mergeBtn;
  }).join('');
}

function _srToggleBoundary(i) {
  _srBoundaries[i] = !_srBoundaries[i];
  _srRenderPieces();
}

function _srComputePieces() {
  if (!_srAtoms.length) return [];
  var pieces = [];
  var current = _srAtoms[0];
  for (var i = 1; i < _srAtoms.length; i++) {
    if (_srBoundaries[i - 1]) { pieces.push(current); current = _srAtoms[i]; }
    else { current += _srAtoms[i]; }
  }
  pieces.push(current);
  return pieces;
}

function _srCloseModal() {
  var modal = document.getElementById('sr-modal');
  if (modal) modal.style.display = 'none';
  _srEditDocId = null;
}

/* 存完之後要做什麼由呼叫端決定（_ecOpenSrModal 開窗時會設定這個 hook，把新題目直接
   加進目前這份測驗並勾選），這裡存完一律也刷新「我的題庫」的快取，兩邊都不用互相知道細節 */
var _srOnSaved   = null;
var _srOnDeleted = null;
var _srEditDocId = null; /* null=新增一題；有值=正在編輯這一題，存檔時用 .set() 更新同一份文件而不是新增 */

function _srSaveQuestion() {
  var grade      = (document.getElementById('sr-grade').value || '').trim();
  var lesson     = (document.getElementById('sr-lesson').value || '').trim();
  var lessonName = (document.getElementById('sr-lesson-name').value || '').trim();
  var statusEl   = document.getElementById('sr-status');
  var pieces = _srComputePieces();
  if (!grade) { if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = '請先在第一步選版本與冊次'; } return; }
  if (!lesson) { if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = '請填課次'; } return; }
  if (pieces.length < 2) {
    if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = '至少要有兩個片段才能出題，請先拆解句子、調整分界'; }
    return;
  }
  if (!db || !currentTeacher) return;
  var sentence = pieces.join('');
  if (statusEl) { statusEl.style.color = 'var(--muted)'; statusEl.textContent = '儲存中…'; }

  var docData = {
    grade: grade, lesson: lesson, lessonName: lessonName, type: '句子重組',
    question: sentence, answer: sentence, options: pieces,
    teacherUid: currentTeacher.uid, createdAt: new Date().toISOString()
  };
  var isEdit = !!_srEditDocId;
  var save = isEdit
    ? db.collection('questions').doc(_srEditDocId).set(docData)
    : db.collection('questions').add(docData);
  Promise.resolve(save).then(function(ref) {
    var docId = isEdit ? _srEditDocId : ref.id;
    showToast(isEdit ? ('✅ 已更新句子重組題：' + sentence) : ('✅ 已新增句子重組題：' + sentence));
    document.getElementById('sr-sentence').value = '';
    document.getElementById('sr-pieces-wrap').style.display = 'none';
    _srAtoms = []; _srBoundaries = []; _srEditDocId = null;
    if (statusEl) { statusEl.style.color = 'var(--green)'; statusEl.textContent = ''; }
    loadQuizBankStats();
    if (typeof _srOnSaved === 'function') _srOnSaved(docId, docData, isEdit);
  }).catch(function(e) {
    if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = '❌ ' + e.message; }
  });
}

/* 只有在編輯既有題目（_srEditDocId 有值）時才會顯示刪除按鈕，新增模式沒有東西可刪 */
function _srDeleteQuestion() {
  if (!_srEditDocId || !db) return;
  if (!confirm('確定要刪除這一題句子重組題嗎？\n\n此操作無法復原。')) return;
  var docId = _srEditDocId;
  db.collection('questions').doc(docId).delete().then(function() {
    showToast('✅ 已刪除這一題');
    _srCloseModal();
    loadQuizBankStats();
    if (typeof _srOnDeleted === 'function') _srOnDeleted(docId);
  }).catch(function(e) {
    var statusEl = document.getElementById('sr-status');
    if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = '❌ 刪除失敗：' + e.message; }
  });
}
