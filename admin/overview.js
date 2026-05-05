/**
 * admin/overview.js — 班級學生名單
 * 依賴：shared.js（db、showToast）、admin/classes.js（currentRosterClassId）
 */
'use strict';

/* ── 名單狀態 ── */
var currentRosterStudents = [];
var currentRosterToday    = null;
var currentRosterApp      = 'chinese'; // 目前選中的 APP 頁籤

function loadClassRoster(classId) {
  var wrap = document.getElementById('class-roster-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  ['roster-stat-total','roster-stat-active','roster-stat-mastered'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.textContent = '—';
  });

  if (!db) { setTimeout(function(){ loadClassRoster(classId); }, 400); return; }

  var today = new Date(); today.setHours(0,0,0,0);
  currentRosterApp = 'chinese'; // 切換班級時重置頁籤

  /* 重置頁籤按鈕視覺 */
  var tabsEl = document.getElementById('roster-app-tabs');
  if (tabsEl) {
    tabsEl.querySelectorAll('.app-tab-mini').forEach(function(b, i) {
      b.classList.toggle('active', i === 0);
    });
  }

  db.collection('students').where('classIds', 'array-contains', classId).get()
    .then(function(snap) {
      var studentDocs = [];
      snap.forEach(function(doc) { studentDocs.push({ id: doc.id, data: doc.data() }); });

      var totalEl = document.getElementById('roster-stat-total');
      if (totalEl) totalEl.textContent = studentDocs.length;

      if (!studentDocs.length) {
        ['roster-stat-active','roster-stat-mastered'].forEach(function(id) {
          var el = document.getElementById(id);
          if (el) el.textContent = 0;
        });
        wrap.innerHTML =
          '<div style="text-align:center;padding:32px 16px;color:var(--muted);font-weight:600;font-size:.88rem">' +
          '這個班級還沒有學生加入。<br>請將邀請碼告訴學生，讓他們在個人設定中輸入。</div>';
        return;
      }

      var students = [], done = 0;
      studentDocs.forEach(function(s) {
        /* 同時讀取識字趣與乘法趣進度 */
        Promise.all([
          db.collection('students').doc(s.id).collection('progress').doc('hanzi').get(),
          db.collection('students').doc(s.id).collection('progress').doc('multiply').get()
        ]).then(function(pDocs) {
          var displayName = s.data.name || (s.data.seatNumber ? s.data.seatNumber + '號' : s.id);
          students.push({
            id:         s.id,
            name:       displayName,
            seatNumber: s.data.seatNumber || 0,
            lastSeen:   s.data.lastSeen || null,
            charStatus: pDocs[0].exists ? (pDocs[0].data().charStatus || {}) : {},
            multiply:   pDocs[1].exists ? pDocs[1].data() : null
          });
        }).catch(function() {
          var displayName = s.data.name || (s.data.seatNumber ? s.data.seatNumber + '號' : s.id);
          students.push({ id: s.id, name: displayName, seatNumber: s.data.seatNumber || 0, lastSeen: null, charStatus: {}, multiply: null });
        }).then(function() {
          done++;
          if (done === studentDocs.length) {
            currentRosterStudents = students;
            currentRosterToday    = today;
            renderClassRoster(wrap);
          }
        });
      });
    })
    .catch(function(e) {
      wrap.innerHTML =
        '<div style="color:var(--red);font-size:.88rem;padding:12px">載入失敗：' + e.message + '</div>';
    });
}

/* ── 切換 APP 頁籤 ── */
function switchRosterTab(appId, btn) {
  currentRosterApp = appId;
  var tabsEl = document.getElementById('roster-app-tabs');
  if (tabsEl) {
    tabsEl.querySelectorAll('.app-tab-mini').forEach(function(b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
  }
  var isNames = appId === 'names';
  var progressView = document.getElementById('roster-progress-view');
  var namesView    = document.getElementById('roster-names-view');
  if (progressView) progressView.style.display = isNames ? 'none' : '';
  if (namesView)    namesView.style.display    = isNames ? '' : 'none';

  if (isNames) {
    loadNameManager();
  } else {
    var wrap = document.getElementById('class-roster-wrap');
    if (wrap) renderClassRoster(wrap);
  }
}

/* ── 渲染名單（讀取 currentRosterApp 決定顯示哪個 APP）── */
function renderClassRoster(wrap) {
  var students = currentRosterStudents;
  var today    = currentRosterToday;
  var appId    = currentRosterApp;

  students.sort(function(a, b) {
    if (a.seatNumber && b.seatNumber) return a.seatNumber - b.seatNumber;
    if (a.seatNumber) return -1;
    if (b.seatNumber) return 1;
    return (b.lastSeen ? b.lastSeen.seconds : 0) - (a.lastSeen ? a.lastSeen.seconds : 0);
  });

  var active = students.filter(function(s) {
    return s.lastSeen && s.lastSeen.seconds * 1000 > today.getTime();
  }).length;

  /* ── 統計數字（依 APP 決定第三格含義）── */
  var activeEl   = document.getElementById('roster-stat-active');
  var masteredEl = document.getElementById('roster-stat-mastered');
  var masteredLblEl = document.getElementById('roster-stat-mastered-lbl');
  if (activeEl) activeEl.textContent = active;

  if (appId === 'chinese') {
    var totalMastered = students.reduce(function(acc, s) {
      return acc + Object.values(s.charStatus).filter(function(v) { return v === 'mastered'; }).length;
    }, 0);
    if (masteredEl)    masteredEl.textContent = students.length ? Math.round(totalMastered / students.length) : 0;
    if (masteredLblEl) masteredLblEl.textContent = '平均通過字數';
  } else {
    /* 乘法趣：平均通關乘法表格數（fill + reverse 各算半格，共 11 格） */
    var totalTables = students.reduce(function(acc, s) {
      if (!s.multiply) return acc;
      var fill = (s.multiply.masteredFill    || []).length;
      var rev  = (s.multiply.masteredReverse || []).length;
      return acc + Math.round((fill + rev) / 2);
    }, 0);
    if (masteredEl)    masteredEl.textContent = students.length ? Math.round(totalTables / students.length) : 0;
    if (masteredLblEl) masteredLblEl.textContent = '平均通關表格';
  }

  /* ── 表格列 ── */
  var rows;
  if (appId === 'chinese') {
    rows = students.map(function(s) {
      var cs      = s.charStatus;
      var keys    = Object.keys(cs);
      var mastered = keys.filter(function(k) { return cs[k] === 'mastered'; }).length;
      var pct     = Math.round(mastered / (keys.length || 1) * 100);
      var lastStr = _rosterLastStr(s.lastSeen);
      var badge   = _chineseBadge(mastered, keys.length);
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
  } else {
    /* 乘法趣 */
    rows = students.map(function(s) {
      var m    = s.multiply;
      var fill = m ? (m.masteredFill    || []).length : 0;
      var rev  = m ? (m.masteredReverse || []).length : 0;
      var pct  = Math.round((fill + rev) / 22 * 100); // 11 填空 + 11 拆解
      var lastStr = _rosterLastStr(s.lastSeen);
      var badge = !m
        ? '<span class="badge badge-gray">未使用</span>'
        : (fill + rev === 22
          ? '<span class="badge badge-green">全部精熟</span>'
          : (fill + rev > 0
            ? '<span class="badge badge-yellow">練習中</span>'
            : '<span class="badge badge-gray">未開始</span>'));
      return '<tr onclick="showStudentDetail(\'' + s.id + '\')">'
        + '<td><strong>' + s.name + '</strong></td>'
        + '<td>' + badge + '</td>'
        + '<td><div style="display:flex;align-items:center;gap:8px">'
        +   '<div class="progress-mini"><div class="progress-mini-fill" style="width:' + pct + '%;background:var(--green)"></div></div>'
        +   '<span style="font-size:.8rem;color:var(--muted)">填 ' + fill + '/11・拆 ' + rev + '/11</span>'
        + '</div></td>'
        + '<td style="color:var(--muted);font-size:.82rem">' + lastStr + '</td>'
        + '<td style="color:var(--blue);font-size:.82rem;font-weight:700">查看詳細 →</td>'
        + '</tr>';
    }).join('');
    wrap.innerHTML =
      '<table class="student-table">'
      + '<thead><tr><th>姓名</th><th>狀態</th><th>乘法精熟</th><th>最後登入</th><th></th></tr></thead>'
      + '<tbody>' + rows + '</tbody>'
      + '</table>';
  }

  var lu = document.getElementById('last-update');
  if (lu) {
    var now = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    lu.textContent = '更新於 ' + now;
  }
}

/* ── 工具函式 ── */
function _rosterLastStr(lastSeen) {
  return lastSeen
    ? new Date(lastSeen.seconds * 1000).toLocaleString('zh-TW', {
        month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
      })
    : '—';
}

function _chineseBadge(mastered, total) {
  if (mastered === total && total > 0) return '<span class="badge badge-green">全部掌握</span>';
  if (mastered > 0)                    return '<span class="badge badge-yellow">學習中</span>';
  return '<span class="badge badge-gray">未開始</span>';
}
