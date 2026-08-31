/**
 * admin/students.js — 學生詳細頁：基本資料 + 動態 app 成果頁籤
 * 依賴：shared.js（db、showToast）
 */
'use strict';

var currentDetailId = null;

/* ── 已知 App 定義（新增 app 只要加這裡）── */
var _STUDENT_APPS = [
  { id: 'chinese',  label: '📖 識字趣', panelId: 'student-panel-chinese' },
  { id: 'multiply', label: '✖️ 乘法趣', panelId: 'student-panel-multiply' }
];

/* ── 切換頁籤 ── */
function switchStudentTab(appId, btn) {
  _STUDENT_APPS.forEach(function(a) {
    var panel = document.getElementById(a.panelId);
    if (panel) panel.style.display = a.id === appId ? '' : 'none';
  });
  var tabsEl = document.getElementById('student-app-tabs');
  if (tabsEl) {
    tabsEl.querySelectorAll('.app-tab-mini').forEach(function(b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
  }
}

/* ── 根據資料決定顯示哪些頁籤 ── */
function _buildStudentTabs(appData) {
  var visibleApps = _STUDENT_APPS.filter(function(a) {
    return appData[a.id] && appData[a.id].hasData;
  });
  if (!visibleApps.length) visibleApps = _STUDENT_APPS; // 都沒資料則全部顯示

  var tabsEl = document.getElementById('student-app-tabs');
  if (tabsEl) {
    tabsEl.innerHTML = visibleApps.map(function(a, i) {
      return '<button class="app-tab-mini' + (i === 0 ? ' active' : '') + '"' +
        ' onclick="switchStudentTab(\'' + a.id + '\', this)">' + a.label + '</button>';
    }).join('');
  }
  _STUDENT_APPS.forEach(function(a) {
    var panel = document.getElementById(a.panelId);
    if (panel) panel.style.display = 'none';
  });
  if (visibleApps.length) {
    var first = document.getElementById(visibleApps[0].panelId);
    if (first) first.style.display = '';
  }
}

/* ── 開啟學生詳細頁 ── */
function showStudentDetail(studentId) {
  if (!db) return;
  currentDetailId = studentId;
  document.getElementById('panel-classes').style.display = 'none';
  document.getElementById('panel-student').style.display  = '';

  /* 重置姓名編輯 UI */
  cancelEditStudentName();

  /* 清空頁籤列（顯示等待狀態） */
  var tabsEl = document.getElementById('student-app-tabs');
  if (tabsEl) tabsEl.innerHTML = '';

  /* 隱藏所有 app 面板，清空為 loading */
  _STUDENT_APPS.forEach(function(a) {
    var panel = document.getElementById(a.panelId);
    if (panel) { panel.style.display = 'none'; panel.innerHTML = ''; }
  });
  ['detail-course-progress', 'detail-activities', 'detail-multiply-progress'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  });

  /* 刪除 / 移出按鈕 */
  var currentClass = (currentClasses || []).find(function(c) { return c.id === currentRosterClassId; });
  var isSubject    = currentClass && currentClass.classType === 'subject';
  var deleteBtn    = document.getElementById('btn-student-delete');
  if (deleteBtn) {
    deleteBtn.textContent = isSubject ? '移出班級' : '🗑 刪除學生';
    deleteBtn.onclick     = isSubject ? removeStudentFromClass : deleteStudent;
  }

  var appData = {};
  var pending = 2; // 漢字批次 + 乘法趣
  function tryBuildTabs() {
    pending--;
    if (pending === 0) _buildStudentTabs(appData);
  }

  /* ── 批次 1：學生基本 + 漢字進度 + 課程結構 ── */
  Promise.all([
    db.collection('students').doc(studentId).get(),
    db.collection('students').doc(studentId).collection('progress').doc('hanzi').get(),
    db.collection('curriculum').get()
  ]).then(function(results) {
    var sDoc = results[0], pDoc = results[1], currSnap = results[2];
    var data = sDoc.exists ? sDoc.data() : {};
    var name = data.name || studentId;
    document.getElementById('detail-avatar').textContent = name.charAt(0);
    document.getElementById('detail-name').textContent   = name;
    document.getElementById('detail-pin').textContent    = data.pin || '—';
    var lastSeen = data.lastSeen;
    document.getElementById('detail-sub').textContent = lastSeen
      ? '最後登入：' + new Date(lastSeen.seconds * 1000).toLocaleString('zh-TW', {
          month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
        })
      : '尚未登入';
    var cs = pDoc.exists ? (pDoc.data().charStatus || {}) : {};
    appData.chinese = { hasData: Object.keys(cs).length > 0 };
    renderCourseProgress(currSnap, cs);
    tryBuildTabs();
  }).catch(function(e) {
    appData.chinese = { hasData: false };
    var el = document.getElementById('detail-course-progress');
    if (el) el.innerHTML = '<div style="color:var(--red);font-size:.85rem;padding:8px">載入失敗：' + e.message + '</div>';
    tryBuildTabs();
  });

  /* ── 識字趣測驗紀錄（獨立，不影響 tab 建置）── */
  db.collection('students').doc(studentId).collection('activities').get()
    .then(function(snap) {
      var acts = [];
      snap.forEach(function(doc) { acts.push(doc.data()); });
      acts.sort(function(a, b) { return (b.time || '').localeCompare(a.time || ''); });
      renderActivities(acts.slice(0, 3));
    }).catch(function(e) {
      var el = document.getElementById('detail-activities');
      if (el) el.innerHTML =
        '<div style="color:var(--red);font-size:.82rem;font-weight:700;padding:8px;background:#fff5f5;border-radius:8px">' +
        '⚠️ 讀取失敗：' + (e.message || e.code || String(e)) + '</div>';
    });

  /* ── 批次 2：乘法趣進度 ── */
  db.collection('students').doc(studentId).collection('progress').doc('multiply').get()
    .then(function(doc) {
      var mData = doc.exists ? doc.data() : null;
      appData.multiply = { hasData: !!mData };
      renderMultiplyProgress(mData);
      tryBuildTabs();
    }).catch(function(e) {
      appData.multiply = { hasData: false };
      renderMultiplyProgress(null);
      tryBuildTabs();
    });
}

/* ── 姓名編輯 ── */
function startEditStudentName() {
  var nameEl  = document.getElementById('detail-name');
  var editEl  = document.getElementById('detail-name-edit');
  var input   = document.getElementById('detail-name-input');
  var editBtn = document.getElementById('btn-edit-name');
  if (!nameEl || !editEl || !input) return;
  input.value = nameEl.textContent;
  if (editBtn) editBtn.style.display = 'none';
  editEl.style.display = 'flex';
  input.focus(); input.select();
}

function cancelEditStudentName() {
  var editEl  = document.getElementById('detail-name-edit');
  var editBtn = document.getElementById('btn-edit-name');
  if (editEl)  editEl.style.display  = 'none';
  if (editBtn) editBtn.style.display = '';
}

function saveStudentName() {
  var input = document.getElementById('detail-name-input');
  var name  = input ? input.value.trim() : '';
  if (!name || !currentDetailId || !db) return;
  db.collection('students').doc(currentDetailId).update({ name: name })
    .then(function() {
      document.getElementById('detail-name').textContent = name;
      document.getElementById('detail-avatar').textContent = name.charAt(0);
      cancelEditStudentName();
      /* 更新本地名單快取，讓返回後不需重新整理 */
      var s = currentRosterStudents.find(function(x) { return x.id === currentDetailId; });
      if (s) s.name = name;
      showToast('✅ 姓名已更新');
    })
    .catch(function(e) { showToast('更新失敗：' + e.message); });
}

/* ────────────────────────────────────────
   以下為各 App 進度渲染（內容不變）
   ──────────────────────────────────────── */

function renderCourseProgress(currSnap, cs) {
  var wrap = document.getElementById('detail-course-progress');
  if (!wrap) return;

  var versions  = [];
  var fetchJobs = [];
  currSnap.forEach(function(vDoc) {
    var verId   = vDoc.id;
    var verName = vDoc.data().name || verId;
    fetchJobs.push(
      db.collection('curriculum').doc(verId).collection('lessons').get()
        .then(function(lSnap) {
          var lessons = [];
          lSnap.forEach(function(lDoc) {
            var d = lDoc.data();
            lessons.push({ grade: d.grade || '', lessonNum: d.lessonNum || 0, name: d.name || '', chars: d.chars || [] });
          });
          lessons.sort(function(a, b) { return a.lessonNum - b.lessonNum; });
          var activeLessons = lessons.filter(function(l) {
            return l.chars.some(function(c) { return cs[c] !== undefined; });
          });
          if (activeLessons.length) versions.push({ name: verName, lessons: activeLessons });
        })
    );
  });

  Promise.all(fetchJobs).then(function() {
    if (!versions.length) {
      wrap.innerHTML = '<div style="color:var(--muted);font-size:.88rem;font-weight:600;padding:8px 0">學生尚未開始任何課程。</div>';
      return;
    }
    wrap.innerHTML = versions.map(function(v, vi) {
      var gradeOrder = [], gradeMap = {};
      v.lessons.forEach(function(l) {
        var g = l.grade || '未分冊';
        if (!gradeMap[g]) { gradeMap[g] = []; gradeOrder.push(g); }
        gradeMap[g].push(l);
      });
      var verTotal = 0, verMastered = 0;
      v.lessons.forEach(function(l) {
        l.chars.forEach(function(c) { verTotal++; if (cs[c] === 'mastered') verMastered++; });
      });
      var verPct    = verTotal ? Math.round(verMastered / verTotal * 100) : 0;
      var verBodyId = 'cp-v-' + vi;
      var gradesHtml = gradeOrder.map(function(grade, gi) {
        var grTotal = 0, grMastered = 0;
        gradeMap[grade].forEach(function(l) {
          l.chars.forEach(function(c) { grTotal++; if (cs[c] === 'mastered') grMastered++; });
        });
        var grPct   = grTotal ? Math.round(grMastered / grTotal * 100) : 0;
        var grBodyId = 'cp-v-' + vi + '-g-' + gi;
        var lessonsHtml = gradeMap[grade].map(function(l) {
          var total = l.chars.length;
          if (!total) return '';
          var mastered  = l.chars.filter(function(c) { return cs[c] === 'mastered'; }).length;
          var pct       = Math.round(mastered / total * 100);
          var allDone   = mastered === total;
          var barColor  = allDone ? 'var(--green)' : 'var(--blue)';
          var textColor = allDone ? 'var(--green-dk)' : 'var(--blue-dk)';
          return '<div style="margin-bottom:10px">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'
            +   '<span style="font-size:.85rem;font-weight:800;color:var(--text)">第 ' + l.lessonNum + ' 課　' + l.name + '</span>'
            +   '<span style="font-size:.8rem;font-weight:700;color:' + textColor + '">' + mastered + ' / ' + total + ' 字' + (allDone ? '　✅' : '') + '</span>'
            + '</div>'
            + '<div style="height:8px;border-radius:6px;background:#e8f0f8;overflow:hidden">'
            +   '<div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:6px;transition:width .4s"></div>'
            + '</div></div>';
        }).join('');
        return '<div style="margin-bottom:8px">'
          + '<div onclick="(function(btn,body){var open=body.style.display!==\'none\';body.style.display=open?\'none\':\'block\';btn.querySelector(\'.cp-arrow\').style.transform=open?\'rotate(0deg)\':\'rotate(90deg)\';})(this,document.getElementById(\'' + grBodyId + '\'))"'
          +   ' style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:5px 8px;border-radius:6px;background:#f4f6f9;user-select:none"'
          +   ' onmouseover="this.style.background=\'#e8edf5\'" onmouseout="this.style.background=\'#f4f6f9\'">'
          +   '<span style="font-size:.78rem;font-weight:900;color:var(--muted);letter-spacing:.5px">📖 ' + grade + '</span>'
          +   '<span style="display:flex;align-items:center;gap:8px">'
          +     '<span style="font-size:.75rem;font-weight:700;color:var(--muted)">' + grPct + '%</span>'
          +     '<span class="cp-arrow" style="font-size:.7rem;color:var(--muted);transition:transform .2s;display:inline-block;transform:rotate(0deg)">▶</span>'
          +   '</span></div>'
          + '<div id="' + grBodyId + '" style="display:none;padding:10px 4px 4px 4px">' + lessonsHtml + '</div>'
          + '</div>';
      }).join('');
      return '<div style="margin-bottom:10px;border:1px solid #dde6f0;border-radius:10px;overflow:hidden">'
        + '<div onclick="(function(btn,body){var open=body.style.display!==\'none\';body.style.display=open?\'none\':\'block\';btn.querySelector(\'.cp-arrow\').style.transform=open?\'rotate(0deg)\':\'rotate(90deg)\';})(this,document.getElementById(\'' + verBodyId + '\'))"'
        +   ' style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:8px 12px;background:var(--blue-lt);user-select:none"'
        +   ' onmouseover="this.style.background=\'#d6e8f7\'" onmouseout="this.style.background=\'var(--blue-lt)\'">'
        +   '<span style="font-size:.82rem;font-weight:900;color:var(--blue-dk)">📚 ' + v.name + '</span>'
        +   '<span style="display:flex;align-items:center;gap:10px">'
        +     '<span style="font-size:.75rem;font-weight:700;color:var(--blue-dk)">' + verMastered + ' / ' + verTotal + ' 字・' + verPct + '%</span>'
        +     '<span class="cp-arrow" style="font-size:.7rem;color:var(--blue-dk);transition:transform .2s;display:inline-block;transform:rotate(0deg)">▶</span>'
        +   '</span></div>'
        + '<div id="' + verBodyId + '" style="display:none;padding:10px 12px 6px 12px">' + gradesHtml + '</div>'
        + '</div>';
    }).join('');
  });
}

function renderActivities(acts) {
  var wrap = document.getElementById('detail-activities');
  if (!wrap) return;
  if (!acts.length) {
    wrap.innerHTML = '<div style="color:var(--muted);font-size:.88rem;font-weight:600;padding:8px 0">尚無測驗紀錄。完成測驗後會自動記錄於此。</div>';
    return;
  }
  wrap.innerHTML = acts.map(function(a) {
    var dt      = a.time ? new Date(a.time) : null;
    var timeStr = dt
      ? (dt.getFullYear() + '/' + pad2(dt.getMonth() + 1) + '/' + pad2(dt.getDate()) + '　' + pad2(dt.getHours()) + ':' + pad2(dt.getMinutes()))
      : '—';
    var passedHtml  = (a.passed  && a.passed.length)
      ? '<span style="color:var(--green-dk);font-weight:800">✅ 通過：</span>'
        + a.passed.map(function(c) {
            return '<span style="display:inline-block;background:#e8f8ee;border:1px solid #97C459;border-radius:6px;padding:2px 7px;font-size:1rem;font-weight:900;margin:2px">' + c + '</span>';
          }).join('')
      : '';
    var failedHtml  = (a.failed  && a.failed.length)
      ? '<span style="color:#a32d2d;font-weight:800">❌ 未通過：</span>'
        + a.failed.map(function(c) {
            return '<span style="display:inline-block;background:#fcebeb;border:1px solid #F09595;border-radius:6px;padding:2px 7px;font-size:1rem;font-weight:900;margin:2px">' + c + '</span>';
          }).join('')
      : '';
    var skippedHtml = (a.skipped && a.skipped.length)
      ? '<span style="color:var(--muted);font-weight:800">⏭ 跳過：</span>'
        + a.skipped.map(function(c) {
            return '<span style="display:inline-block;background:#f1efe8;border:1px solid #ccc;border-radius:6px;padding:2px 7px;font-size:1rem;font-weight:900;margin:2px">' + c + '</span>';
          }).join('')
      : '';
    return '<div style="border:1.5px solid var(--border);border-radius:12px;padding:12px 14px;margin-bottom:10px">'
      + '<div style="font-size:.75rem;font-weight:700;color:var(--muted);margin-bottom:4px">🕐 ' + timeStr + '</div>'
      + '<div style="font-size:.88rem;font-weight:900;color:var(--blue-dk);margin-bottom:8px">📖 ' + (a.lesson || '—') + '</div>'
      + '<div style="line-height:2">'
      + (passedHtml  ? '<div>' + passedHtml  + '</div>' : '')
      + (failedHtml  ? '<div>' + failedHtml  + '</div>' : '')
      + (skippedHtml ? '<div>' + skippedHtml + '</div>' : '')
      + '</div></div>';
  }).join('');
}

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

/* ── 乘法趣進度 ── */
function renderMultiplyProgress(data) {
  var wrap = document.getElementById('detail-multiply-progress');
  if (!wrap) return;
  if (!data) {
    wrap.innerHTML = '<div style="color:var(--muted);font-size:.88rem;font-weight:600;padding:8px 0">學生尚未使用乘法趣。</div>';
    return;
  }
  var fill     = data.masteredFill    || [];
  var rev      = data.masteredReverse || [];
  var correct  = data.totalCorrect    || 0;
  var attempts = data.totalAttempts   || 0;
  var acc      = attempts ? Math.round(correct / attempts * 100) : 0;
  var lastStr  = data.lastStudied
    ? new Date(data.lastStudied).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';
  var html =
    '<div class="multiply-stat-row">' +
      _mcChip(correct, '答對題數') +
      _mcChip(acc + '%', '答題正確率') +
      '<div class="multiply-stat-chip"><div class="mc-num" style="font-size:.95rem;padding-top:2px">' + lastStr + '</div><div class="mc-lbl">最後練習</div></div>' +
    '</div>';
  html += '<div style="font-size:.82rem;font-weight:800;color:var(--muted);margin-bottom:6px;letter-spacing:.04em">✏️ 填空測驗精熟（' + fill.length + ' / 11）</div>';
  html += '<div class="multiply-table-grid" style="margin-bottom:14px">';
  for (var i = 0; i <= 10; i++) {
    var done = fill.indexOf(String(i)) !== -1;
    html += '<div class="multiply-table-cell' + (done ? ' done' : '') + '">' + (done ? '✓' : i) + '</div>';
  }
  html += '</div>';
  html += '<div style="font-size:.82rem;font-weight:800;color:var(--muted);margin-bottom:6px;letter-spacing:.04em">🔍 積的拆解精熟（' + rev.length + ' / 11）</div>';
  html += '<div class="multiply-table-grid">';
  for (var j = 0; j <= 10; j++) {
    var revDone = rev.indexOf(String(j)) !== -1;
    html += '<div class="multiply-table-cell' + (revDone ? ' done' : '') + '">' + (revDone ? '✓' : j) + '</div>';
  }
  html += '</div>';
  wrap.innerHTML = html;
}

function _mcChip(val, lbl) {
  return '<div class="multiply-stat-chip">' +
    '<div class="mc-num">' + val + '</div>' +
    '<div class="mc-lbl">' + lbl + '</div>' +
    '</div>';
}

/* ── 刪除 / 移出 ── */
function deleteStudent() {
  if (!currentDetailId) return;
  var name = document.getElementById('detail-name').textContent;
  if (!confirm('確定要刪除「' + name + '」的所有資料嗎？\n\n此操作無法復原！')) return;
  db.collection('students').doc(currentDetailId)
    .collection('progress').doc('hanzi').delete()
    .then(function() {
      return db.collection('students').doc(currentDetailId).delete();
    }).then(function() {
      showToast('🗑 已刪除「' + name + '」的資料。');
      backToOverview();
      if (currentRosterClassId) loadClassRoster(currentRosterClassId);
    }).catch(function(e) { showToast('❌ 刪除失敗：' + e.message); });
}

function removeStudentFromClass() {
  if (!currentDetailId || !currentRosterClassId) return;
  var name = document.getElementById('detail-name').textContent;
  if (!confirm('確定要將「' + name + '」從此班級移出？\n（學生的原班帳號與學習資料不受影響）')) return;
  db.collection('students').doc(currentDetailId).update({
    classIds: firebase.firestore.FieldValue.arrayRemove(currentRosterClassId)
  }).then(function() {
    showToast('已將「' + name + '」移出此班級');
    backToOverview();
    loadClassRoster(currentRosterClassId);
  }).catch(function(e) { showToast('操作失敗：' + e.message); });
}

function backToOverview() {
  document.getElementById('panel-student').style.display = 'none';
  document.getElementById('panel-classes').style.display = '';
}
