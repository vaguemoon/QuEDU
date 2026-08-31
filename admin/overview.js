/**
 * admin/overview.js — 班級學生名單（學生狀態 tab）
 * 依賴：shared.js（db、showToast）、admin/classes.js（currentRosterClassId）
 */
'use strict';

var currentRosterStudents = [];

function loadClassRoster(classId) {
  var wrap = document.getElementById('class-roster-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  if (!db) { setTimeout(function(){ loadClassRoster(classId); }, 400); return; }

  db.collection('students').where('classIds', 'array-contains', classId).get()
    .then(function(snap) {
      var students = [];
      snap.forEach(function(doc) {
        if (doc.id.startsWith('__preview__')) return;
        var d = doc.data();
        students.push({
          id:         doc.id,
          name:       d.name || (d.seatNumber ? d.seatNumber + '號' : doc.id),
          seatNumber: d.seatNumber || 0,
          type:       d.type || '',
          lastSeen:   d.lastSeen || null
        });
      });
      currentRosterStudents = students;
      renderClassRoster(wrap);
    })
    .catch(function(e) {
      wrap.innerHTML =
        '<div style="color:var(--red);font-size:.88rem;padding:12px">載入失敗：' + e.message + '</div>';
    });
}

/* ── 切換頁籤 ── */
function switchRosterTab(appId, btn) {
  var tabsEl = document.getElementById('roster-app-tabs');
  if (tabsEl) {
    tabsEl.querySelectorAll('.app-tab-mini').forEach(function(b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
  }
  var isTasks      = appId === 'tasks';
  var progressView = document.getElementById('roster-progress-view');
  var tasksView    = document.getElementById('roster-tasks-view');
  if (progressView) progressView.style.display = isTasks ? 'none' : '';
  if (tasksView)    tasksView.style.display    = isTasks ? '' : 'none';

  if (isTasks) {
    loadClassTasks();
  } else {
    var wrap = document.getElementById('class-roster-wrap');
    if (wrap) renderClassRoster(wrap);
  }
}

/* ── 渲染名單：姓名 + 最後登入 ── */
function renderClassRoster(wrap) {
  var students = currentRosterStudents.slice();

  var regularStudents = students.filter(function(s) { return s.type !== 'trial'; });
  var trialStudents   = students.filter(function(s) { return s.type === 'trial'; });

  function _sort(arr) {
    arr.sort(function(a, b) {
      if (a.seatNumber && b.seatNumber) return a.seatNumber - b.seatNumber;
      if (a.seatNumber) return -1;
      if (b.seatNumber) return 1;
      return (b.lastSeen ? b.lastSeen.seconds : 0) - (a.lastSeen ? a.lastSeen.seconds : 0);
    });
  }
  _sort(regularStudents);
  trialStudents.sort(function(a, b) { return a.name.localeCompare(b.name, 'zh-TW'); });

  if (!students.length) {
    wrap.innerHTML =
      '<div style="text-align:center;padding:32px 16px;color:var(--muted);font-weight:600;font-size:.88rem">' +
      '這個班級還沒有學生加入。<br>請將邀請碼告訴學生，讓他們在個人設定中輸入。</div>';
    return;
  }

  var TRIAL_SEP =
    '<tr><td colspan="3" style="padding:8px 10px 4px;font-size:.75rem;font-weight:900;' +
    'color:var(--muted);background:#f7f7f7;border-top:2px solid var(--border);letter-spacing:.04em">' +
    '試用學生</td></tr>';

  function _row(s) {
    var lastStr  = _rosterLastStr(s.lastSeen);
    var trialTag = s.type === 'trial' ? '<span class="trial-badge">(試用)</span>' : '';
    return '<tr onclick="showStudentDetail(\'' + s.id + '\')">'
      + '<td><strong>' + s.name + '</strong>' + trialTag + '</td>'
      + '<td style="color:var(--muted);font-size:.82rem">' + lastStr + '</td>'
      + '<td style="color:var(--blue);font-size:.82rem;font-weight:700">查看詳細 →</td>'
      + '</tr>';
  }

  var regularRows = regularStudents.map(_row).join('');
  var trialRows   = trialStudents.length ? TRIAL_SEP + trialStudents.map(_row).join('') : '';

  wrap.innerHTML =
    '<table class="student-table">'
    + '<thead><tr><th>姓名</th><th>最後登入</th><th></th></tr></thead>'
    + '<tbody>' + regularRows + trialRows + '</tbody>'
    + '</table>';

  var lu = document.getElementById('last-update');
  if (lu) {
    var now = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    lu.textContent = '更新於 ' + now;
  }
}

function _rosterLastStr(lastSeen) {
  return lastSeen
    ? new Date(lastSeen.seconds * 1000).toLocaleString('zh-TW', {
        month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
      })
    : '—';
}
