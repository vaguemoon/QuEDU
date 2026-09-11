/**
 * admin/overview.js — 班級學生名單（學生狀態 tab）
 * 依賴：shared.js（db、showToast）、admin/classes.js（currentRosterClassId）
 */
'use strict';

var currentRosterStudents = [];

/* 座號直接在班級名單內編輯（與全校學生名單共用同一個 students.seatNumber 欄位） */
function saveRosterSeatNumber(input) {
  var id  = input.getAttribute('data-id');
  var val = parseInt(input.value) || 0;
  input.disabled = true;
  db.collection('students').doc(id).update({ seatNumber: val })
    .then(function() {
      var s = currentRosterStudents.find(function(x) { return x.id === id; });
      if (s) s.seatNumber = val;
      input.disabled = false;
      input.style.borderColor = 'var(--green)';
      setTimeout(function() { input.style.borderColor = ''; }, 1200);
    })
    .catch(function(e) {
      input.disabled = false;
      showToast('座號更新失敗：' + e.message);
    });
}

function loadClassRoster(classId, classType) {
  var wrap = document.getElementById('class-roster-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  if (!db) { setTimeout(function(){ loadClassRoster(classId, classType); }, 400); return; }

  /* 行政班（homeroom）以學生的 classId 單一欄位為準（跟全校學生名單同一套），
     不再用 classIds 陣列的 array-contains——那個欄位是「曾經加入過的所有班級」，
     學生升級搬班後舊班級的 ID 不一定會被清乾淨，用它來判斷「現在」的行政班會抓到已經不在班的舊生。
     科任班（subject）維持用 classIds 陣列，因為學生本來就可能同時在多個科任班 */
  var query = classType === 'homeroom'
    ? db.collection('students').where('classId', '==', classId)
    : db.collection('students').where('classIds', 'array-contains', classId);

  query.get()
    .then(function(snap) {
      var students = [];
      snap.forEach(function(doc) {
        if (doc.id.startsWith('__preview__')) return;
        var d = doc.data();
        if (classType === 'homeroom' && d.status === 'archived') return;
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
  var progressView = document.getElementById('roster-progress-view');
  var tasksView    = document.getElementById('roster-tasks-view');
  var quizView     = document.getElementById('roster-quiz-view');
  if (progressView) progressView.style.display = appId === 'students' ? '' : 'none';
  if (tasksView)    tasksView.style.display    = appId === 'tasks'    ? '' : 'none';
  if (quizView)     quizView.style.display     = appId === 'quiz'     ? '' : 'none';

  if (appId === 'tasks') {
    loadClassTasks();
  } else if (appId === 'quiz') {
    if (typeof loadRosterQuizManagement === 'function') loadRosterQuizManagement();
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
    '<tr><td colspan="4" style="padding:8px 10px 4px;font-size:.75rem;font-weight:900;' +
    'color:var(--muted);background:#f7f7f7;border-top:2px solid var(--border);letter-spacing:.04em">' +
    '試用學生</td></tr>';

  function _row(s) {
    var lastStr  = _rosterLastStr(s.lastSeen);
    var trialTag = s.type === 'trial' ? '<span class="trial-badge">(試用)</span>' : '';
    return '<tr onclick="showStudentDetail(\'' + s.id + '\')">'
      + '<td onclick="event.stopPropagation()" style="width:56px">'
        + '<input type="number" min="1" max="60" value="' + (s.seatNumber || '') + '" placeholder="—" data-id="' + s.id + '"'
        + ' style="width:48px;border:1.5px solid var(--border);border-radius:6px;padding:4px 6px;font-size:.8rem;font-family:\'Courier New\',monospace;text-align:center;outline:none"'
        + ' onchange="saveRosterSeatNumber(this)">'
      + '</td>'
      + '<td><strong>' + s.name + '</strong>' + trialTag + '</td>'
      + '<td style="color:var(--muted);font-size:.82rem">' + lastStr + '</td>'
      + '<td style="color:var(--blue);font-size:.82rem;font-weight:700">查看詳細 →</td>'
      + '</tr>';
  }

  var regularRows = regularStudents.map(_row).join('');
  var trialRows   = trialStudents.length ? TRIAL_SEP + trialStudents.map(_row).join('') : '';

  wrap.innerHTML =
    '<table class="student-table">'
    + '<thead><tr><th>座號</th><th>姓名</th><th>最後登入</th><th></th></tr></thead>'
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
