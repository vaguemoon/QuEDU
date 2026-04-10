/**
 * admin/curriculum.js — 課程版本管理、CSV 匯入、手動新增課程
 * 依賴：shared.js（db、showToast）
 */
'use strict';

var currentVersionId   = null;
var currentVersionName = '';
var allVersions        = [];
var csvParsedData      = null;

// ── 載入所有版本 ──
function loadVersions() {
  if (!db) { setTimeout(loadVersions, 500); return; }
  var wrap = document.getElementById('version-list-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  db.collection('curriculum').get().then(function(snap) {
    allVersions = [];
    snap.forEach(function(doc) {
      allVersions.push({ id: doc.id, name: doc.data().name, lessonCount: doc.data().lessonCount || 0 });
    });

    var dl = document.getElementById('version-datalist');
    if (dl) {
      dl.innerHTML = allVersions.map(function(v){ return '<option value="'+v.name+'">'; }).join('');
    }

    var manualCard = document.getElementById('manual-add-card');
    if (manualCard) manualCard.style.display = '';

    if (!allVersions.length) {
      wrap.innerHTML = '<div style="color:var(--muted);font-size:.88rem;font-weight:600;padding:8px 0">還沒有課程版本，請先建立。</div>';
      return;
    }

    wrap.innerHTML = '';
    allVersions.forEach(function(v) {
      var div = document.createElement('div');
      div.className = 'version-item';
      div.id = 'vi-' + v.id;
      div.innerHTML = '<div class="version-name">📚 '+v.name+'</div>'
        +'<div class="version-meta">'+v.lessonCount+' 課</div>'
        +'<div style="font-size:.8rem;color:var(--blue);font-weight:700">查看 →</div>';
      div.addEventListener('click', (function(id, name){
        return function(){ browseVersion(id, name); };
      })(v.id, v.name));
      wrap.appendChild(div);
    });
  }).catch(function(e) {
    var w = document.getElementById('version-list-wrap');
    if (w) w.innerHTML = '<div style="color:var(--red);font-size:.88rem;font-weight:700">載入失敗：'+e.message+'</div>';
  });
}

// ── 新增版本 ──
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
    name: name, lessonCount: 0, createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function() {
    showToast('✅ 版本「'+name+'」已建立！');
    hideAddVersion();
    loadVersions();
  }).catch(function(e){ showToast('❌ 建立失敗：'+e.message); });
}

// ── 折疊版本面板 ──
function toggleVersionsPanel() {
  var body = document.getElementById('versions-panel-body');
  var icon = document.getElementById('versions-toggle-icon');
  if (!body) return;
  var collapsed = body.style.display === 'none';
  body.style.display = collapsed ? '' : 'none';
  if (icon) icon.textContent = collapsed ? '▲' : '▼';
}

// ── 刪除版本 ──
function deleteVersion() {
  if (!currentVersionId) return;
  if (!confirm('確定要刪除「'+currentVersionName+'」的所有課程資料嗎？\n\n此操作無法復原！')) return;
  db.collection('curriculum').doc(currentVersionId).delete().then(function() {
    showToast('🗑 已刪除「'+currentVersionName+'」。');
    currentVersionId = null;
    var browseSection = document.getElementById('curriculum-browse-section');
    if (browseSection) browseSection.style.display = 'none';
    loadVersions();
  }).catch(function(e){ showToast('❌ 刪除失敗：'+e.message); });
}

// ── 瀏覽版本課程內容 ──
function browseVersion(versionId, versionName) {
  if (!db) return;
  currentVersionId   = versionId;
  currentVersionName = versionName;

  document.querySelectorAll('.version-item').forEach(function(el){ el.classList.remove('active'); });
  var vi = document.getElementById('vi-'+versionId);
  if (vi) vi.classList.add('active');

  document.getElementById('browse-version-name').textContent = '📚 ' + versionName;
  var card = document.getElementById('curriculum-browse-section');
  if (card) card.style.display = '';
  document.getElementById('curriculum-content').innerHTML =
    '<div class="loading-wrap"><div class="spinner"></div></div>';

  db.collection('curriculum').doc(versionId)
    .collection('lessons').get().then(function(snap) {
      db.collection('curriculum').doc(versionId).update({ lessonCount: snap.size }).catch(function(){});

      if (snap.empty) {
        document.getElementById('curriculum-content').innerHTML =
          '<div style="color:var(--muted);font-size:.88rem;font-weight:600;padding:8px 0">這個版本還沒有課程，可以用上方表單手動新增。</div>';
        return;
      }

      var grades = {}, gradeOrder = [];
      snap.forEach(function(doc) {
        var d = doc.data();
        var g = d.grade || d.bookNum || '未知';
        if (!grades[g]) { grades[g] = []; gradeOrder.push(g); }
        grades[g].push(Object.assign({ id: doc.id }, d));
      });
      gradeOrder = gradeOrder.filter(function(v,i,a){ return a.indexOf(v)===i; });
      gradeOrder.forEach(function(g){ grades[g].sort(function(a,b){ return (a.lessonNum||0)-(b.lessonNum||0); }); });

      var container = document.getElementById('curriculum-content');
      container.innerHTML = '';
      gradeOrder.forEach(function(bk) {
        var bookDiv = document.createElement('div');
        bookDiv.className = 'book-section';
        bookDiv.innerHTML = '<div class="book-title">'+bk+'</div>';
        grades[bk].forEach(function(lesson) {
          var row = document.createElement('div');
          row.className = 'lesson-item';
          row.innerHTML = '<div class="lesson-num">第 '+lesson.lessonNum+' 課</div>'
            +'<div class="lesson-name">'+lesson.name+'</div>'
            +'<div class="lesson-chars">'+lesson.chars.join('')+'</div>'
            +'<div class="lesson-actions"></div>';
          var delBtn = document.createElement('button');
          delBtn.className = 'btn-tiny';
          delBtn.textContent = '🗑';
          delBtn.addEventListener('click', (function(vid, lid){
            return function(){ deleteLesson(vid, lid); };
          })(versionId, lesson.id));
          row.querySelector('.lesson-actions').appendChild(delBtn);
          bookDiv.appendChild(row);
        });
        container.appendChild(bookDiv);
      });
    });
}

// ── 刪除單一課 ──
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
      loadVersions();
      browseVersion(versionId, currentVersionName);
    })
    .catch(function(e){ showToast('❌ 刪除失敗：' + e.message); });
}

// ── CSV 選擇與解析 ──
function onCSVSelected() {
  var file = document.getElementById('csv-file').files[0];
  if (!file) return;
  document.getElementById('csv-filename').textContent = file.name;
  var reader = new FileReader();
  reader.onload = function(e) { parseCSV(e.target.result); };
  reader.readAsText(file, 'UTF-8');
}

function parseCSV(text) {
  var lines = text.split('\n').filter(function(l){ return l.trim(); });
  if (!lines.length) { showToast('CSV 檔案是空的！'); return; }

  var start = 0;
  if (lines[0].includes('版本') || lines[0].includes('冊') || lines[0].includes('課')) start = 1;

  var parsed = [], errors = [], versionNames = {};
  lines.slice(start).forEach(function(line, idx) {
    var cols = line.split(',');
    var lineNum = idx + start + 1;
    if (cols.length < 5) { errors.push('第 '+lineNum+' 行需要 5 欄（版本,年級,課,課名,生字）'); return; }

    var versionName = cols[0].trim();
    var grade       = cols[1].trim();
    var lessonNum   = parseInt(cols[2].trim());
    var name        = cols[3].trim();
    var chars       = Array.from(new Set(cols[4].trim().replace(/ /g,'').split('').filter(Boolean)));

    if (!versionName)     { errors.push('第 '+lineNum+' 行版本名稱不能是空的'); return; }
    if (!grade)           { errors.push('第 '+lineNum+' 行年級不能是空的'); return; }
    if (isNaN(lessonNum)) { errors.push('第 '+lineNum+' 行課次必須是數字'); return; }
    if (!chars.length)    { errors.push('第 '+lineNum+' 行生字不能是空的'); return; }

    versionNames[versionName] = true;
    parsed.push({ versionName:versionName, grade:grade, lessonNum:lessonNum, name:name, chars:chars });
  });

  csvParsedData = parsed;
  var preview = document.getElementById('csv-preview');
  var btn     = document.getElementById('btn-import-csv');

  if (errors.length) {
    preview.innerHTML = '<div style="color:var(--red);font-size:.82rem;font-weight:700;background:#fff5f5;border-radius:8px;padding:10px 12px">'
      +'⚠️ 發現以下問題：<br>'+errors.join('<br>')+'</div>';
    btn.disabled = true; btn.style.opacity = '.5'; btn.style.cursor = 'not-allowed';
    return;
  }

  var vList = Object.keys(versionNames);
  preview.innerHTML = '<div style="color:var(--green);font-size:.82rem;font-weight:700;background:var(--green-lt);border-radius:8px;padding:10px 12px">'
    +'✅ 解析成功！版本：'+vList.join('、')+'<br>'
    +'共 '+parsed.length+' 課，'+parsed.reduce(function(a,b){ return a+b.chars.length; },0)+' 個生字。<br>'
    +'<span style="color:var(--muted)">按「匯入」後將自動建立版本並上傳資料。</span></div>';
  btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer';
}

// ── CSV 匯入到 Firebase ──
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
    var versionId = 'v_' + vName.replace(/[^a-zA-Z0-9一-鿿]/g,'_');

    db.collection('curriculum').doc(versionId).set({
      name: vName, lessonCount: lessons.length,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function() {
      var batch  = db.batch();
      var colRef = db.collection('curriculum').doc(versionId).collection('lessons');
      lessons.forEach(function(lesson) {
        batch.set(colRef.doc(lesson.grade+'_l'+lesson.lessonNum), {
          grade: lesson.grade, lessonNum: lesson.lessonNum,
          name:  lesson.name,  chars:     lesson.chars
        });
      });
      return batch.commit();
    }).then(function() {
      totalDone++;
      if (totalDone === versionNames.length) {
        showToast('✅ 匯入完成！共 '+versionNames.length+' 個版本，'+csvParsedData.length+' 課。');
        btn.innerHTML = '<span>📥</span><span>匯入</span>';
        csvParsedData = null;
        document.getElementById('csv-file').value = '';
        document.getElementById('csv-filename').textContent = '選擇 CSV 檔案';
        document.getElementById('csv-preview').innerHTML = '';
        loadVersions();
      }
    });
  });
}

// ── 手動新增課程 ──
function updateManualPreview() {
  var chars = Array.from(new Set(document.getElementById('manual-chars').value.replace(/ /g,'').split('').filter(Boolean)));
  var prev  = document.getElementById('manual-chars-preview');
  if (!prev) return;
  prev.innerHTML = chars.length
    ? '<div class="lesson-chars-chip" style="font-size:1.2rem;letter-spacing:4px">'+chars.join('')+'</div>'
    : '';
}

function saveManualLesson() {
  var versionName = document.getElementById('manual-version-input').value.trim();
  var grade       = document.getElementById('manual-grade').value.trim();
  var lessonNum   = parseInt(document.getElementById('manual-lesson-num').value);
  var name        = document.getElementById('manual-lesson-name').value.trim();
  var chars       = Array.from(new Set(document.getElementById('manual-chars').value.replace(/ /g,'').split('').filter(Boolean)));
  var status      = document.getElementById('manual-status');

  if (!versionName)    { status.style.color='var(--red)'; status.textContent='請輸入版本名稱！'; return; }
  if (!grade)          { status.style.color='var(--red)'; status.textContent='請輸入年級！'; return; }
  if (isNaN(lessonNum)){ status.style.color='var(--red)'; status.textContent='課次必須是數字！'; return; }
  if (!name)           { status.style.color='var(--red)'; status.textContent='請輸入課名！'; return; }
  if (!chars.length)   { status.style.color='var(--red)'; status.textContent='請輸入生字！'; return; }
  if (!db) return;

  status.style.color = 'var(--muted)';
  status.textContent = '儲存中…';

  var versionId = 'v_' + versionName.replace(/[^a-zA-Z0-9一-鿿]/g, '_');
  db.collection('curriculum').doc(versionId).set({ name: versionName }, { merge: true }).then(function() {
    var docId  = grade + '_l' + lessonNum;
    var colRef = db.collection('curriculum').doc(versionId).collection('lessons');
    return colRef.doc(docId).set({ grade:grade, lessonNum:lessonNum, name:name, chars:chars })
      .then(function() {
        return colRef.get().then(function(snap) {
          return db.collection('curriculum').doc(versionId).update({ lessonCount: snap.size });
        });
      });
  }).then(function() {
    status.style.color = 'var(--green)';
    status.textContent = '✅ 新增成功！';
    document.getElementById('manual-grade').value       = '';
    document.getElementById('manual-lesson-num').value  = '';
    document.getElementById('manual-lesson-name').value = '';
    document.getElementById('manual-chars').value       = '';
    document.getElementById('manual-chars-preview').innerHTML = '';
    loadVersions();
    if (currentVersionId === versionId) browseVersion(versionId, versionName);
    setTimeout(function(){ status.textContent = ''; }, 3000);
  }).catch(function(e) {
    status.style.color = 'var(--red)';
    status.textContent = '❌ 失敗：' + e.message;
  });
}
