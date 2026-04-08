/**
 * admin/overview.js — 班級學生名單
 * 依賴：shared.js（db、showToast）、admin/classes.js（currentRosterClassId）
 */
'use strict';

function loadClassRoster(classId) {
  var wrap = document.getElementById('class-roster-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  ['roster-stat-total','roster-stat-active','roster-stat-mastered'].forEach(function(id) {
    document.getElementById(id).textContent = '—';
  });

  if (!db) { setTimeout(function(){ loadClassRoster(classId); }, 400); return; }

  var today = new Date(); today.setHours(0,0,0,0);

  db.collection('students').where('classId', '==', classId).get()
    .then(function(snap) {
      var studentDocs = [];
      snap.forEach(function(doc) { studentDocs.push({ id: doc.id, data: doc.data() }); });

      document.getElementById('roster-stat-total').textContent = studentDocs.length;

      if (!studentDocs.length) {
        document.getElementById('roster-stat-active').textContent   = 0;
        document.getElementById('roster-stat-mastered').textContent = 0;
        wrap.innerHTML =
          '<div style="text-align:center;padding:32px 16px;color:var(--muted);font-weight:600;font-size:.88rem">' +
          '這個班級還沒有學生加入。<br>請將邀請碼告訴學生，讓他們在個人設定中輸入。</div>';
        return;
      }

      var students = [], done = 0;
      studentDocs.forEach(function(s) {
        db.collection('students').doc(s.id)
          .collection('progress').doc('hanzi').get()
          .then(function(pd) {
            students.push({
              id:         s.id,
              name:       s.data.name || s.id,
              lastSeen:   pd.exists && pd.data().lastSeen ? pd.data().lastSeen : null,
              charStatus: pd.exists ? (pd.data().charStatus || {}) : {}
            });
          })
          .catch(function() {
            students.push({ id: s.id, name: s.data.name || s.id, lastSeen: null, charStatus: {} });
          })
          .then(function() {
            done++;
            if (done === studentDocs.length) renderClassRoster(students, today, wrap);
          });
      });
    })
    .catch(function(e) {
      wrap.innerHTML =
        '<div style="color:var(--red);font-size:.88rem;padding:12px">載入失敗：' + e.message + '</div>';
    });
}

function renderClassRoster(students, today, wrap) {
  students.sort(function(a, b) {
    return (b.lastSeen ? b.lastSeen.seconds : 0) - (a.lastSeen ? a.lastSeen.seconds : 0);
  });

  var active = students.filter(function(s) {
    return s.lastSeen && s.lastSeen.seconds * 1000 > today.getTime();
  }).length;
  var totalMastered = students.reduce(function(acc, s) {
    return acc + Object.values(s.charStatus).filter(function(v) { return v === 'mastered'; }).length;
  }, 0);

  document.getElementById('roster-stat-active').textContent   = active;
  document.getElementById('roster-stat-mastered').textContent =
    students.length ? Math.round(totalMastered / students.length) : 0;

  var rows = students.map(function(s) {
    var cs      = s.charStatus;
    var keys    = Object.keys(cs);
    var mastered = keys.filter(function(k) { return cs[k] === 'mastered'; }).length;
    var pct     = Math.round(mastered / (keys.length || 1) * 100);
    var lastStr = s.lastSeen
      ? new Date(s.lastSeen.seconds * 1000).toLocaleString('zh-TW', {
          month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
        })
      : '—';
    var badge = (mastered === keys.length && keys.length > 0)
      ? '<span class="badge badge-green">全部掌握</span>'
      : mastered > 0
        ? '<span class="badge badge-yellow">學習中</span>'
        : '<span class="badge badge-gray">未開始</span>';

    return '<tr onclick="showStudentDetail(\'' + s.id + '\')">'
      + '<td><strong>' + s.name + '</strong></td>'
      + '<td>' + badge + '</td>'
      + '<td><div style="display:flex;align-items:center;gap:8px">'
      +   '<div class="progress-mini"><div class="progress-mini-fill" style="width:' + pct + '%"></div></div>'
      +   '<span style="font-size:.8rem;color:var(--muted)">' + mastered + '/' + keys.length + ' 字</span>'
      + '</div></td>'
      + '<td style="color:var(--muted);font-size:.82rem">' + lastStr + '</td>'
      + '<td style="color:var(--blue);font-size:.82rem;font-weight:700">查看詳細 →</td>'
      + '</tr>';
  }).join('');

  wrap.innerHTML =
    '<table class="student-table">'
    + '<thead><tr><th>姓名</th><th>狀態</th><th>掌握進度</th><th>最後登入</th><th></th></tr></thead>'
    + '<tbody>' + rows + '</tbody>'
    + '</table>';

  var lu = document.getElementById('last-update');
  if (lu) {
    var now = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    lu.textContent = '更新於 ' + now;
  }
}
