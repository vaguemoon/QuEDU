/**
 * admin/curriculum.js — 課程版本管理、CSV 匯入、手動新增課程
 * 依賴：shared.js（db、showToast）
 *
 * 版本列表採手風琴設計：
 *   版本列 → 點擊展開 → 冊次列 → 點擊展開 → 課程列表
 */
'use strict';

var allVersions  = [];
var csvParsedData = null;

/* 跳脫 inline onclick 字串中的單引號與反斜線 */
function _escQ(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ════════════════════════════════════════
//  版本清單
// ════════════════════════════════════════

function loadVersions() {
  if (!db) { setTimeout(loadVersions, 500); return; }
  var wrap = document.getElementById('version-list-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  db.collection('curriculum').get().then(function(snap) {
    allVersions = [];
    snap.forEach(function(doc) {
      allVersions.push({
        id: doc.id,
        name: doc.data().name,
        lessonCount: doc.data().lessonCount || 0
      });
    });

    /* 更新手動新增的 datalist */
    var dl = document.getElementById('version-datalist');
    if (dl) {
      dl.innerHTML = allVersions.map(function(v) {
        return '<option value="' + v.name + '">';
      }).join('');
    }

    var manualCard = document.getElementById('manual-add-card');
    if (manualCard) manualCard.style.display = '';

    if (!allVersions.length) {
      wrap.innerHTML =
        '<div style="color:var(--muted);font-size:.88rem;font-weight:600;padding:8px 0">' +
        '還沒有課程版本，請先建立。</div>';
      return;
    }

    wrap.innerHTML = '';
    allVersions.forEach(function(v) {
      var item = document.createElement('div');
      item.className = 'version-accordion';
      item.id = 'vi-' + v.id;

      var header = document.createElement('div');
      header.className = 'version-accordion-header';
      header.innerHTML =
        '<div style="display:flex;align-items:center;gap:10px">' +
          '<div class="version-name">📚 ' + v.name + '</div>' +
          '<div class="version-meta">' + v.lessonCount + ' 課</div>' +
        '</div>' +
        '<div style="font-size:.8rem;color:var(--blue);font-weight:700;' +
              'display:flex;align-items:center;gap:5px">' +
          '查看 <span id="vi-ico-' + v.id + '" style="font-size:.7rem">▶</span>' +
        '</div>';
      header.addEventListener('click', (function(id, name) {
        return function() { toggleVersionContent(id, name); };
      })(v.id, v.name));

      /* 預設閉合 */
      var content = document.createElement('div');
      content.className = 'version-accordion-body';
      content.id = 'vc-' + v.id;
      content.style.display = 'none';

      item.appendChild(header);
      item.appendChild(content);
      wrap.appendChild(item);
    });
  }).catch(function(e) {
    var w = document.getElementById('version-list-wrap');
    if (w) {
      var div = document.createElement('div');
      div.style.cssText = 'color:var(--red);font-size:.88rem;font-weight:700';
      div.textContent = '載入失敗：' + e.message;
      w.innerHTML = '';
      w.appendChild(div);
    }
  });
}

// ════════════════════════════════════════
//  版本手風琴展開 / 收合
// ════════════════════════════════════════

function toggleVersionContent(vId, vName) {
  var item    = document.getElementById('vi-' + vId);
  var content = document.getElementById('vc-' + vId);
  var ico     = document.getElementById('vi-ico-' + vId);
  if (!content) return;

  if (content.style.display !== 'none') {
    content.style.display = 'none';
    if (ico)  ico.textContent = '▶';
    if (item) item.classList.remove('open');
  } else {
    content.style.display = '';
    if (ico)  ico.textContent = '▼';
    if (item) item.classList.add('open');
    if (!content.dataset.loaded) {
      loadVersionContent(vId, vName, content);
    }
  }
}

/* 載入並渲染某版本的課程內容（手風琴 inline） */
function loadVersionContent(vId, vName, container) {
  container.innerHTML =
    '<div class="loading-wrap" style="padding:20px 0"><div class="spinner"></div></div>';
  container.dataset.vname = vName;

  db.collection('curriculum').doc(vId).collection('lessons').get()
    .then(function(snap) {
      db.collection('curriculum').doc(vId)
        .update({ lessonCount: snap.size }).catch(function() {});

      if (snap.empty) {
        container.innerHTML =
          '<div style="color:var(--muted);font-size:.88rem;font-weight:600;padding:12px 0">' +
          '這個版本還沒有課程，可以用上方表單手動新增。</div>' +
          _deleteVersionBtn(vId, vName);
        container.dataset.loaded = '1';
        return;
      }

      /* 依冊次分組 */
      var grades = {}, gradeOrder = [];
      snap.forEach(function(doc) {
        var d = doc.data();
        var g = d.grade || d.bookNum || '未知';
        if (!grades[g]) { grades[g] = []; gradeOrder.push(g); }
        grades[g].push(Object.assign({ id: doc.id }, d));
      });
      gradeOrder = gradeOrder.filter(function(v, i, a) { return a.indexOf(v) === i; });
      gradeOrder.forEach(function(g) {
        grades[g].sort(function(a, b) { return (a.lessonNum || 0) - (b.lessonNum || 0); });
      });

      /* 渲染冊次折疊區塊 */
      var html = '';
      gradeOrder.forEach(function(grade) {
        var gId = 'vg-' + vId + '-' + grade.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_');
        /* 冊次預設閉合（display:none，圖示 ▼） */
        html +=
          '<div class="book-section">' +
          '<div class="book-title" onclick="toggleGradeSection(\'' + _escQ(gId) + '\')">' +
            '<span>' + grade + '</span>' +
            '<span id="' + gId + '-ico" style="font-size:.72rem">▼</span>' +
          '</div>' +
          '<div class="book-grade-body" id="' + gId + '" style="display:none">';

        grades[grade].forEach(function(lesson) {
          html +=
            '<div class="lesson-item">' +
              '<div class="lesson-num">第 ' + lesson.lessonNum + ' 課</div>' +
              '<div class="lesson-name">' + lesson.name + '</div>' +
              '<div class="lesson-chars">' + lesson.chars.join('') + '</div>' +
              '<div class="lesson-actions">' +
                '<button class="btn-tiny" ' +
                  'onclick="deleteLesson(\'' + _escQ(vId) + '\',\'' + _escQ(lesson.id) + '\')">🗑</button>' +
              '</div>' +
            '</div>';
        });

        html += '</div></div>'; /* 關閉 book-grade-body 與 book-section */
      });
      html += _deleteVersionBtn(vId, vName);

      container.innerHTML = html;
      container.dataset.loaded = '1';
    })
    .catch(function(e) {
      var div = document.createElement('div');
      div.style.cssText = 'color:var(--red);font-size:.88rem;padding:12px 0';
      div.textContent = '載入失敗：' + e.message;
      container.innerHTML = '';
      container.appendChild(div);
    });
}

/* 刪除版本按鈕 HTML */
function _deleteVersionBtn(vId, vName) {
  return '<div style="padding-top:12px;margin-top:10px;border-top:1px solid var(--border);text-align:right">' +
    '<button class="btn-danger" style="font-size:.78rem;padding:5px 12px" ' +
      'onclick="deleteVersionById(\'' + _escQ(vId) + '\',\'' + _escQ(vName) + '\')">🗑 刪除此版本</button>' +
    '</div>';
}

// ════════════════════════════════════════
//  冊次折疊
// ════════════════════════════════════════

function toggleGradeSection(gId) {
  var el  = document.getElementById(gId);
  var ico = document.getElementById(gId + '-ico');
  if (!el) return;
  var hidden = el.style.display === 'none';
  el.style.display = hidden ? '' : 'none';
  /* ▼ = 閉合中（可展開）  ▲ = 展開中（可收合） */
  if (ico) ico.textContent = hidden ? '▲' : '▼';
}

// ════════════════════════════════════════
//  整體版本面板折疊（卡片右上角 ▲▼）
// ════════════════════════════════════════

function toggleVersionsPanel() {
  var body = document.getElementById('versions-panel-body');
  var icon = document.getElementById('versions-toggle-icon');
  if (!body) return;
  var collapsed = body.style.display === 'none';
  body.style.display = collapsed ? '' : 'none';
  if (icon) icon.textContent = collapsed ? '▲' : '▼';
}

// ════════════════════════════════════════
//  新增版本
// ════════════════════════════════════════

function showAddVersion() {
  document.getElementById('add-version-form').style.display = '';
  document.getElementById('new-version-name').focus();
}
function hideAddVersion() {
  document.getElementById('add-version-form').style.display = 'none';
  document.getElementById('new-version-name').value = '';
}
function addVersion() {
  var name = document.getElementById('new-version-name').value.trim();
  if (!name) { showToast('請輸入版本名稱！'); return; }
  if (!db) return;
  var id = 'v_' + Date.now();
  db.collection('curriculum').doc(id).set({
    name: name,
    lessonCount: 0,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function() {
    showToast('✅ 版本「' + name + '」已建立！');
    hideAddVersion();
    loadVersions();
  }).catch(function(e) { showToast('❌ 建立失敗：' + e.message); });
}

// ════════════════════════════════════════
//  刪除版本
// ════════════════════════════════════════

function deleteVersionById(vId, vName) {
  if (!confirm('確定要刪除「' + vName + '」的所有課程資料嗎？\n\n此操作無法復原！')) return;
  db.collection('curriculum').doc(vId).delete()
    .then(function() {
      showToast('🗑 已刪除「' + vName + '」。');
      loadVersions();
    })
    .catch(function(e) { showToast('❌ 刪除失敗：' + e.message); });
}

// ════════════════════════════════════════
//  刪除單一課
// ════════════════════════════════════════

function deleteLesson(versionId, lessonId) {
  if (!confirm('確定要刪除這一課嗎？')) return;
  var colRef = db.collection('curriculum').doc(versionId).collection('lessons');
  colRef.doc(lessonId).delete()
    .then(function() {
      return colRef.get().then(function(snap) {
        return db.collection('curriculum').doc(versionId).update({ lessonCount: snap.size });
      });
    })
    .then(function() {
      showToast('🗑 已刪除。');
      /* 重新載入已展開的 inline 內容 */
      var content = document.getElementById('vc-' + versionId);
      if (content && content.style.display !== 'none') {
        delete content.dataset.loaded;
        loadVersionContent(versionId, content.dataset.vname || '', content);
      }
      loadVersions();
    })
    .catch(function(e) { showToast('❌ 刪除失敗：' + e.message); });
}

// ════════════════════════════════════════
//  CSV 選擇與解析
// ════════════════════════════════════════

function onCSVSelected() {
  var file = document.getElementById('csv-file').files[0];
  if (!file) return;
  document.getElementById('csv-filename').textContent = file.name;
  var reader = new FileReader();
  reader.onload = function(e) { parseCSV(e.target.result); };
  reader.readAsText(file, 'UTF-8');
}

function parseCSV(text) {
  var lines = text.split('\n').filter(function(l) { return l.trim(); });
  if (!lines.length) { showToast('CSV 檔案是空的！'); return; }

  var start = 0;
  if (lines[0].includes('版本') || lines[0].includes('冊') || lines[0].includes('課')) start = 1;

  var parsed = [], errors = [], versionNames = {};
  lines.slice(start).forEach(function(line, idx) {
    var cols    = line.split(',');
    var lineNum = idx + start + 1;
    if (cols.length < 5) {
      errors.push('第 ' + lineNum + ' 行需要 5 欄（版本,年級,課,課名,生字）'); return;
    }
    var versionName = cols[0].trim();
    var grade       = cols[1].trim();
    var lessonNum   = parseInt(cols[2].trim());
    var name        = cols[3].trim();
    var chars       = Array.from(new Set(
      cols[4].trim().replace(/ /g, '').split('').filter(Boolean)
    ));
    if (!versionName)     { errors.push('第 ' + lineNum + ' 行版本名稱不能是空的'); return; }
    if (!grade)           { errors.push('第 ' + lineNum + ' 行年級不能是空的'); return; }
    if (isNaN(lessonNum)) { errors.push('第 ' + lineNum + ' 行課次必須是數字'); return; }
    if (!chars.length)    { errors.push('第' + lineNum + ' 行生字不能是空的'); return; }
    versionNames[versionName] = true;
    parsed.push({ versionName: versionName, grade: grade, lessonNum: lessonNum, name: name, chars: chars });
  });

  csvParsedData = parsed;
  var preview = document.getElementById('csv-preview');
  var btn     = document.getElementById('btn-import-csv');

  if (errors.length) {
    preview.innerHTML =
      '<div style="color:var(--red);font-size:.82rem;font-weight:700;background:#fff5f5;border-radius:8px;padding:10px 12px">' +
      '⚠️ 發現以下問題：<br>' + errors.join('<br>') + '</div>';
    btn.disabled = true; btn.style.opacity = '.5'; btn.style.cursor = 'not-allowed';
    return;
  }

  var vList = Object.keys(versionNames);
  preview.innerHTML =
    '<div style="color:var(--green);font-size:.82rem;font-weight:700;background:var(--green-lt);border-radius:8px;padding:10px 12px">' +
    '✅ 解析成功！版本：' + vList.join('、') + '<br>' +
    '共 ' + parsed.length + ' 課，' +
    parsed.reduce(function(a, b) { return a + b.chars.length; }, 0) + ' 個生字。<br>' +
    '<span style="color:var(--muted)">按「匯入」後將自動建立版本並上傳資料。</span></div>';
  btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer';
}

// ════════════════════════════════════════
//  CSV 匯入到 Firebase
// ════════════════════════════════════════

function importCSV() {
  if (!csvParsedData || !csvParsedData.length) { showToast('請先選擇 CSV 檔案！'); return; }
  if (!db) return;

  var btn = document.getElementById('btn-import-csv');
  btn.innerHTML = '<span>⏳</span><span>匯入中…</span>';
  btn.disabled = true;

  var versionMap = {};
  csvParsedData.forEach(function(lesson) {
    if (!versionMap[lesson.versionName]) versionMap[lesson.versionName] = [];
    versionMap[lesson.versionName].push(lesson);
  });

  var versionNames = Object.keys(versionMap), totalDone = 0;
  versionNames.forEach(function(vName) {
    var lessons   = versionMap[vName];
    var versionId = 'v_' + vName.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_');

    db.collection('curriculum').doc(versionId).set({
      name: vName, lessonCount: lessons.length,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function() {
      var batch  = db.batch();
      var colRef = db.collection('curriculum').doc(versionId).collection('lessons');
      lessons.forEach(function(lesson) {
        batch.set(colRef.doc(lesson.grade + '_l' + lesson.lessonNum), {
          grade: lesson.grade, lessonNum: lesson.lessonNum,
          name:  lesson.name,  chars:     lesson.chars
        });
      });
      return batch.commit();
    }).then(function() {
      totalDone++;
      if (totalDone === versionNames.length) {
        showToast('✅ 匯入完成！共 ' + versionNames.length + ' 個版本，' + csvParsedData.length + ' 課。');
        btn.innerHTML = '<span>📥</span><span>匯入</span>';
        csvParsedData = null;
        document.getElementById('csv-file').value = '';
        document.getElementById('csv-filename').textContent = '選擇 CSV 檔案';
        document.getElementById('csv-preview').innerHTML = '';
        loadVersions();
      }
    }).catch(function(e) {
      showToast('❌ 版本「' + vName + '」匯入失敗：' + e.message);
      btn.innerHTML = '<span>📥</span><span>匯入</span>';
      btn.disabled = false;
    });
  });
}

// ════════════════════════════════════════
//  手動新增課程
// ════════════════════════════════════════

function updateManualPreview() {
  var chars = Array.from(new Set(
    document.getElementById('manual-chars').value.replace(/ /g, '').split('').filter(Boolean)
  ));
  var prev = document.getElementById('manual-chars-preview');
  if (!prev) return;
  prev.innerHTML = chars.length
    ? '<div class="lesson-chars-chip" style="font-size:1.2rem;letter-spacing:4px">' + chars.join('') + '</div>'
    : '';
}

function saveManualLesson() {
  var versionName = document.getElementById('manual-version-input').value.trim();
  var grade       = document.getElementById('manual-grade').value.trim();
  var lessonNum   = parseInt(document.getElementById('manual-lesson-num').value);
  var name        = document.getElementById('manual-lesson-name').value.trim();
  var chars       = Array.from(new Set(
    document.getElementById('manual-chars').value.replace(/ /g, '').split('').filter(Boolean)
  ));
  var status = document.getElementById('manual-status');

  if (!versionName)     { status.style.color = 'var(--red)'; status.textContent = '請輸入版本名稱！'; return; }
  if (!grade)           { status.style.color = 'var(--red)'; status.textContent = '請輸入年級！'; return; }
  if (isNaN(lessonNum)) { status.style.color = 'var(--red)'; status.textContent = '課次必須是數字！'; return; }
  if (!name)            { status.style.color = 'var(--red)'; status.textContent = '請輸入課名！'; return; }
  if (!chars.length)    { status.style.color = 'var(--red)'; status.textContent = '請輸入生字！'; return; }
  if (!db) return;

  status.style.color = 'var(--muted)';
  status.textContent = '儲存中…';

  var versionId = 'v_' + versionName.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_');
  db.collection('curriculum').doc(versionId)
    .set({ name: versionName }, { merge: true })
    .then(function() {
      var docId  = grade + '_l' + lessonNum;
      var colRef = db.collection('curriculum').doc(versionId).collection('lessons');
      return colRef.doc(docId).set({ grade: grade, lessonNum: lessonNum, name: name, chars: chars })
        .then(function() {
          return colRef.get().then(function(snap) {
            return db.collection('curriculum').doc(versionId).update({ lessonCount: snap.size });
          });
        });
    })
    .then(function() {
      status.style.color = 'var(--green)';
      status.textContent = '✅ 新增成功！';
      document.getElementById('manual-grade').value       = '';
      document.getElementById('manual-lesson-num').value  = '';
      document.getElementById('manual-lesson-name').value = '';
      document.getElementById('manual-chars').value       = '';
      document.getElementById('manual-chars-preview').innerHTML = '';
      /* 若該版本已展開，刷新 inline 內容 */
      var content = document.getElementById('vc-' + versionId);
      if (content && content.style.display !== 'none') {
        delete content.dataset.loaded;
        loadVersionContent(versionId, versionName, content);
      }
      loadVersions();
      setTimeout(function() { status.textContent = ''; }, 3000);
    })
    .catch(function(e) {
      status.style.color = 'var(--red)';
      status.textContent = '❌ 失敗：' + e.message;
    });
}
