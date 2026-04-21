/**
 * super-admin/overview.js — 全校總覽：統計數字 + 所有班級列表
 * 依賴：shared.js（db、showToast）
 */
'use strict';

function loadOverview() {
  if (!db) { setTimeout(loadOverview, 400); return; }

  // 重置統計
  ['stat-teachers','stat-classes','stat-students','stat-active'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.textContent = '—';
  });

  var wrap = document.getElementById('overview-classes-wrap');
  if (wrap) wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  var today = new Date(); today.setHours(0,0,0,0);
  var p_teachers = db.collection('teachers').get();
  var p_classes  = db.collection('classes').get();
  var p_students = db.collection('students').get();

  Promise.all([p_teachers, p_classes, p_students])
    .then(function(results) {
      var teacherSnap  = results[0];
      var classesSnap  = results[1];
      var studentsSnap = results[2];

      // 統計數字
      var el;
      el = document.getElementById('stat-teachers');
      if (el) el.textContent = teacherSnap.size;

      el = document.getElementById('stat-classes');
      if (el) el.textContent = classesSnap.size;

      el = document.getElementById('stat-students');
      if (el) el.textContent = studentsSnap.size;

      // 今日活躍（需再查 progress）— 顯示先設為載入中
      el = document.getElementById('stat-active');
      if (el) el.textContent = '…';
      countTodayActive(studentsSnap, today);

      // 渲染班級列表
      if (!wrap) return;
      if (classesSnap.empty) {
        wrap.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-weight:600">目前沒有任何班級</div>';
        return;
      }

      // 建立 teacherUid → email 對照表
      var teacherMap = {};
      teacherSnap.forEach(function(doc) {
        teacherMap[doc.id] = doc.data().email || doc.id;
      });

      // 班級按建立時間排序
      var classes = [];
      classesSnap.forEach(function(doc) {
        var d = doc.data(); d.id = doc.id;
        classes.push(d);
      });
      classes.sort(function(a, b) {
        return (a.createdAt || '') < (b.createdAt || '') ? 1 : -1;
      });

      var rows = classes.map(function(cls) {
        var teacherEmail = teacherMap[cls.teacherUid] || cls.teacherEmail || '—';
        var statusBadge = cls.active
          ? '<span class="badge badge-green">邀請中</span>'
          : '<span class="badge badge-gray">已停用</span>';
        return '<tr>'
          + '<td><strong>' + escHtml(cls.name) + '</strong></td>'
          + '<td>' + escHtml(teacherEmail) + '</td>'
          + '<td><span class="mono">' + escHtml(cls.inviteCode || '—') + '</span></td>'
          + '<td>' + statusBadge + '</td>'
          + '<td id="oc-' + cls.id + '" style="color:var(--muted);font-size:.82rem">載入中…</td>'
          + '</tr>';
      }).join('');

      wrap.innerHTML =
        '<table class="sa-table">'
        + '<thead><tr><th>班級名稱</th><th>負責教師</th><th>邀請碼</th><th>狀態</th><th>學生數</th></tr></thead>'
        + '<tbody>' + rows + '</tbody>'
        + '</table>';

      // 非同步載入各班學生數
      classes.forEach(function(cls) {
        db.collection('students').where('classIds','array-contains',cls.id).get()
          .then(function(snap) {
            var el = document.getElementById('oc-' + cls.id);
            if (el) el.textContent = snap.size + ' 位';
          }).catch(function() {});
      });
    })
    .catch(function(e) {
      if (wrap) wrap.innerHTML =
        '<div style="color:var(--red);padding:20px;font-weight:700">載入失敗：' + e.message + '</div>';
    });
}

function countTodayActive(studentsSnap, today) {
  var total = studentsSnap.size;
  if (!total) {
    var el = document.getElementById('stat-active');
    if (el) el.textContent = 0;
    return;
  }

  var activeCount = 0;
  var done = 0;

  studentsSnap.forEach(function(doc) {
    var ls = doc.data().lastSeen;
    if (ls && ls.seconds * 1000 > today.getTime()) {
      activeCount++;
    }
    done++;
    if (done === total) {
      var el = document.getElementById('stat-active');
      if (el) el.textContent = activeCount;
    }
  });
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
