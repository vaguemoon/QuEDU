/**
 * admin/students.js — 學生詳細頁：課程完成狀況 + 最近測驗紀錄
 * 依賴：shared.js（db、showToast）
 */
'use strict';

var currentDetailId = null;

function showStudentDetail(studentId) {
  if (!db) return;
  currentDetailId = studentId;
  document.getElementById('panel-classes').style.display = 'none';
  document.getElementById('panel-student').style.display  = '';
  document.getElementById('detail-course-progress').innerHTML =
    '<div class="loading-wrap"><div class="spinner"></div></div>';
  document.getElementById('detail-activities').innerHTML =
    '<div class="loading-wrap"><div class="spinner"></div></div>';

  // ── 學生基本資料 + 課程完成狀況（同一組查詢）──
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
    var cs = pDoc.exists ? (pDoc.data().charStatus || {}) : {};
    var masteredCount = Object.values(cs).filter(function(v){ return v === 'mastered'; }).length;
    document.getElementById('detail-sub').textContent =
      '已通過測驗 ' + masteredCount + ' / ' + Object.keys(cs).length + ' 個字';
    renderCourseProgress(currSnap, cs);
  }).catch(function(e){
    document.getElementById('detail-course-progress').innerHTML =
      '<div style="color:var(--red);font-size:.85rem;padding:8px">載入失敗：' + e.message + '</div>';
    console.warn('course progress error:', e);
  });

  // ── 最近測驗紀錄（獨立查詢，避免 orderBy 索引問題影響上方區塊）──
  db.collection('students').doc(studentId).collection('activities').get()
    .then(function(snap) {
      var acts = [];
      snap.forEach(function(doc){ acts.push(doc.data()); });
      // 用 time 字串排序後取最近 3 筆
      acts.sort(function(a, b){ return (b.time || '').localeCompare(a.time || ''); });
      renderActivities(acts.slice(0, 3));
    }).catch(function(e){
      console.warn('activities error:', e);
      document.getElementById('detail-activities').innerHTML =
        '<div style="color:var(--red);font-size:.82rem;font-weight:700;padding:8px;background:#fff5f5;border-radius:8px">'
        + '⚠️ 讀取失敗：' + (e.message || e.code || String(e)) + '</div>';
    });
}

function renderCourseProgress(currSnap, cs) {
  var wrap = document.getElementById('detail-course-progress');
  if (!wrap) return;

  // 收集所有版本與課程
  var versions = [];
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
            lessons.push({ grade: d.grade||'', lessonNum: d.lessonNum||0, name: d.name||'', chars: d.chars||[] });
          });
          lessons.sort(function(a,b){ return a.lessonNum - b.lessonNum; });
          // 只保留這個版本中學生有練習過的課（至少有一字的 charStatus）
          var activeLessons = lessons.filter(function(l){
            return l.chars.some(function(c){ return cs[c] && cs[c] !== undefined; });
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
      // 按年級分組，保留出現順序
      var gradeOrder = [];
      var gradeMap   = {};
      v.lessons.forEach(function(l) {
        var g = l.grade || '未分冊';
        if (!gradeMap[g]) { gradeMap[g] = []; gradeOrder.push(g); }
        gradeMap[g].push(l);
      });

      // 計算版本整體進度摘要
      var verTotal = 0, verMastered = 0;
      v.lessons.forEach(function(l) {
        l.chars.forEach(function(c) {
          verTotal++;
          if (cs[c] === 'mastered') verMastered++;
        });
      });
      var verPct = verTotal ? Math.round(verMastered / verTotal * 100) : 0;
      var verBodyId = 'cp-v-' + vi;

      var gradesHtml = gradeOrder.map(function(grade, gi) {
        // 計算年級進度摘要
        var grTotal = 0, grMastered = 0;
        gradeMap[grade].forEach(function(l) {
          l.chars.forEach(function(c) {
            grTotal++;
            if (cs[c] === 'mastered') grMastered++;
          });
        });
        var grPct = grTotal ? Math.round(grMastered / grTotal * 100) : 0;
        var grBodyId = 'cp-v-' + vi + '-g-' + gi;

        var lessonsHtml = gradeMap[grade].map(function(l) {
          var total    = l.chars.length;
          if (!total) return '';
          var mastered = l.chars.filter(function(c){ return cs[c] === 'mastered'; }).length;
          var pct      = Math.round(mastered / total * 100);
          var allDone  = mastered === total;
          var barColor = allDone ? 'var(--green)' : 'var(--blue)';
          var textColor = allDone ? 'var(--green-dk)' : 'var(--blue-dk)';
          return '<div style="margin-bottom:10px">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'
            +   '<span style="font-size:.85rem;font-weight:800;color:var(--text)">第 ' + l.lessonNum + ' 課　' + l.name + '</span>'
            +   '<span style="font-size:.8rem;font-weight:700;color:' + textColor + '">'
            +     mastered + ' / ' + total + ' 字' + (allDone ? '　✅' : '')
            +   '</span>'
            + '</div>'
            + '<div style="height:8px;border-radius:6px;background:#e8f0f8;overflow:hidden">'
            +   '<div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:6px;transition:width .4s"></div>'
            + '</div>'
            + '</div>';
        }).join('');

        return '<div style="margin-bottom:8px">'
          + '<div onclick="(function(btn,body){var open=body.style.display!==\'none\';body.style.display=open?\'none\':\'block\';btn.querySelector(\'.cp-arrow\').style.transform=open?\'rotate(0deg)\':\'rotate(90deg)\';})(this,document.getElementById(\'' + grBodyId + '\'))"'
          +   ' style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:5px 8px;border-radius:6px;background:#f4f6f9;user-select:none"'
          +   ' onmouseover="this.style.background=\'#e8edf5\'" onmouseout="this.style.background=\'#f4f6f9\'">'
          +   '<span style="font-size:.78rem;font-weight:900;color:var(--muted);letter-spacing:.5px">📖 ' + grade + '</span>'
          +   '<span style="display:flex;align-items:center;gap:8px">'
          +     '<span style="font-size:.75rem;font-weight:700;color:var(--muted)">' + grPct + '%</span>'
          +     '<span class="cp-arrow" style="font-size:.7rem;color:var(--muted);transition:transform .2s;display:inline-block;transform:rotate(0deg)">▶</span>'
          +   '</span>'
          + '</div>'
          + '<div id="' + grBodyId + '" style="display:none;padding:10px 4px 4px 4px">'
          + lessonsHtml
          + '</div>'
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
        +   '</span>'
        + '</div>'
        + '<div id="' + verBodyId + '" style="display:none;padding:10px 12px 6px 12px">'
        + gradesHtml
        + '</div>'
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
    var dt    = a.time ? new Date(a.time) : null;
    var timeStr = dt
      ? (dt.getFullYear() + '/' + pad2(dt.getMonth()+1) + '/' + pad2(dt.getDate())
         + '　' + pad2(dt.getHours()) + ':' + pad2(dt.getMinutes()))
      : '—';

    var passedHtml  = (a.passed  && a.passed.length)
      ? '<span style="color:var(--green-dk);font-weight:800">✅ 通過：</span>'
        + a.passed.map(function(c){
            return '<span style="display:inline-block;background:#e8f8ee;border:1px solid #97C459;border-radius:6px;padding:2px 7px;font-size:1rem;font-weight:900;margin:2px">' + c + '</span>';
          }).join('')
      : '';
    var failedHtml  = (a.failed  && a.failed.length)
      ? '<span style="color:#a32d2d;font-weight:800">❌ 未通過：</span>'
        + a.failed.map(function(c){
            return '<span style="display:inline-block;background:#fcebeb;border:1px solid #F09595;border-radius:6px;padding:2px 7px;font-size:1rem;font-weight:900;margin:2px">' + c + '</span>';
          }).join('')
      : '';
    var skippedHtml = (a.skipped && a.skipped.length)
      ? '<span style="color:var(--muted);font-weight:800">⏭ 跳過：</span>'
        + a.skipped.map(function(c){
            return '<span style="display:inline-block;background:#f1efe8;border:1px solid #ccc;border-radius:6px;padding:2px 7px;font-size:1rem;font-weight:900;margin:2px">' + c + '</span>';
          }).join('')
      : '';

    return '<div style="border:1.5px solid var(--border);border-radius:12px;padding:12px 14px;margin-bottom:10px">'
      + '<div style="font-size:.75rem;font-weight:700;color:var(--muted);margin-bottom:4px">🕐 ' + timeStr + '</div>'
      + '<div style="font-size:.88rem;font-weight:900;color:var(--blue-dk);margin-bottom:8px">📖 ' + (a.lesson||'—') + '</div>'
      + '<div style="line-height:2">'
      + (passedHtml  ? '<div>' + passedHtml  + '</div>' : '')
      + (failedHtml  ? '<div>' + failedHtml  + '</div>' : '')
      + (skippedHtml ? '<div>' + skippedHtml + '</div>' : '')
      + '</div>'
      + '</div>';
  }).join('');
}

function pad2(n){ return n < 10 ? '0' + n : '' + n; }

function deleteStudent() {
  if (!currentDetailId) return;
  var name = document.getElementById('detail-name').textContent;
  if (!confirm('確定要刪除「'+name+'」的所有資料嗎？\n\n此操作無法復原！')) return;
  db.collection('students').doc(currentDetailId)
    .collection('progress').doc('hanzi').delete()
    .then(function(){
      return db.collection('students').doc(currentDetailId).delete();
    }).then(function(){
      showToast('🗑 已刪除「'+name+'」的資料。');
      backToOverview();
      if (currentRosterClassId) loadClassRoster(currentRosterClassId);
    }).catch(function(e){ showToast('❌ 刪除失敗：'+e.message); });
}

function backToOverview() {
  document.getElementById('panel-student').style.display = 'none';
  document.getElementById('panel-classes').style.display = '';
}
