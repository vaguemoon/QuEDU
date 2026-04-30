/**
 * admin/curriculum-data.js — 課程版本 Firebase CRUD + CSV 匯入
 * 依賴：shared.js（db、showToast）、curriculum-ui.js（loadVersions、loadVersionContent）
 */
'use strict';

var csvParsedData = null;

// ════════════════════════════════════════
//  新增版本
// ════════════════════════════════════════

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
//  儲存課次生字 TTS 覆寫
// ════════════════════════════════════════

function saveCharOverrides(vId, lessonId, overrides, statusEl) {
  if (!db) return;
  db.collection('curriculum').doc(vId).collection('lessons').doc(lessonId)
    .update({ charOverrides: overrides })
    .then(function() {
      if (statusEl) { statusEl.style.color = 'var(--green)'; statusEl.textContent = '✅ 已儲存'; }
      showToast('✅ TTS 覆寫已儲存');
    })
    .catch(function(e) {
      if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = '❌ ' + e.message; }
      showToast('❌ 儲存失敗：' + e.message);
    });
}

// ════════════════════════════════════════
//  手動新增課程
// ════════════════════════════════════════

function saveManualLesson() {
  var versionName = document.getElementById('manual-version-input').value.trim();
  var grade       = document.getElementById('manual-grade').value.trim();
  var lessonNum   = parseInt(document.getElementById('manual-lesson-num').value);
  var name        = document.getElementById('manual-lesson-name').value.trim();
  var chars       = Array.from(new Set(
    document.getElementById('manual-chars').value.replace(/ /g, '').split('').filter(Boolean)
  ));
  var wordsRaw    = (document.getElementById('manual-words') ? document.getElementById('manual-words').value.trim() : '');
  var words       = wordsRaw ? wordsRaw.split(/[\s,，]+/).map(function(w){ return w.trim(); }).filter(Boolean) : [];
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
      var lessonDoc = { grade: grade, lessonNum: lessonNum, name: name, chars: chars };
      if (words.length) lessonDoc.words = words;
      return colRef.doc(docId).set(lessonDoc)
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
      var mw = document.getElementById('manual-words');
      if (mw) mw.value = '';
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
