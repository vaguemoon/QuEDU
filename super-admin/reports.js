/**
 * super-admin/reports.js — 用戶回報管理
 * 依賴：shared.js（db、showToast）、init.js（TABS、switchTab）
 */
'use strict';

var reportsList        = [];
var reportsFilterStatus = 'all';
var reportsFilterType   = 'all';
var unreadListener      = null;

/* ── 初始化面板（第一次切換到此頁籤時呼叫） ── */
function loadReports() {
  if (!db) { setTimeout(loadReports, 150); return; }

  var panel = document.getElementById('panel-reports');
  if (!panel) return;

  if (!panel._rInit) {
    panel._rInit = true;
    panel.innerHTML = _buildPanelHTML();
    document.getElementById('reports-filter-status')
      .addEventListener('change', _onFilterChange);
    document.getElementById('reports-filter-type')
      .addEventListener('change', _onFilterChange);
  }

  _fetchReports();
}

/* ── 未讀徽章（onAdminReady 時啟動） ── */
function startUnreadBadge() {
  if (!db) { setTimeout(startUnreadBadge, 150); return; }
  if (unreadListener) unreadListener();

  unreadListener = db.collection('reports')
    .where('status', '==', 'unread')
    .onSnapshot(function (snap) {
      var badge = document.getElementById('reports-badge');
      if (!badge) return;
      var n = snap.size;
      if (n > 0) {
        badge.textContent = n > 99 ? '99+' : n;
        badge.style.display = '';
      } else {
        badge.style.display = 'none';
      }
    }, function () {});
}

/* ── 篩選變更 ── */
function _onFilterChange() {
  reportsFilterStatus = document.getElementById('reports-filter-status').value;
  reportsFilterType   = document.getElementById('reports-filter-type').value;
  _renderReports();
}

/* ── 從 Firestore 取得回報 ── */
function _fetchReports() {
  if (!db) return;
  var wrap = document.getElementById('reports-list-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  db.collection('reports')
    .orderBy('createdAt', 'desc')
    .limit(300)
    .get()
    .then(function (snap) {
      reportsList = [];
      snap.forEach(function (doc) {
        reportsList.push(Object.assign({ _id: doc.id }, doc.data()));
      });
      _renderReports();
    })
    .catch(function () {
      var w = document.getElementById('reports-list-wrap');
      if (w) w.innerHTML = '<div style="padding:20px;color:var(--red);font-weight:700;font-size:.88rem">載入失敗，請重試</div>';
    });
}

/* ── 渲染回報列表 ── */
function _renderReports() {
  var wrap = document.getElementById('reports-list-wrap');
  if (!wrap) return;

  var filtered = reportsList.filter(function (r) {
    if (reportsFilterStatus !== 'all' && r.status !== reportsFilterStatus) return false;
    if (reportsFilterType   !== 'all' && r.type   !== reportsFilterType)   return false;
    return true;
  });

  if (!filtered.length) {
    wrap.innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted);font-weight:700;font-size:.9rem">沒有符合條件的回報</div>';
    return;
  }

  var html = filtered.map(function (r) {
    var statusMap = { unread: '未讀', read: '已讀', resolved: '已解決' };
    var statusColor = { unread: '#ef4444', read: '#64748b', resolved: '#27ae60' };
    var statusBg    = { unread: '#fef2f2', read: '#f1f5f9', resolved: '#d5f5e3' };
    var typeLabel   = r.type === 'suggestion' ? '💡 建議' : '🐛 問題';
    var reporterType = { teacher: '👩‍🏫 教師', student: '🧒 學生', guest: '👤 訪客' }[r.reporterType] || r.reporterType;
    var reporter    = _esc(r.reporterName || r.reporterEmail || '匿名');
    var date        = r.createdAt ? _fmtDate(r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt)) : '—';
    var rowBg       = r.status === 'unread' ? '#fffbeb' : 'white';
    var sLabel      = statusMap[r.status] || r.status;
    var sColor      = statusColor[r.status] || '#64748b';
    var sBg         = statusBg[r.status]    || '#f1f5f9';

    var actionBtns = '';
    if (r.status === 'unread') {
      actionBtns += '<button class="btn-sm" onclick="markReportRead(\'' + r._id + '\')">✓ 已讀</button>';
    }
    if (r.status !== 'resolved') {
      actionBtns += '<button class="btn-sm-green" onclick="markReportResolved(\'' + r._id + '\')">✅ 已解決</button>';
    }
    actionBtns += '<button class="btn-sm-red" onclick="deleteReportConfirm(\'' + r._id + '\', this)">🗑 刪除</button>';

    return '<div data-rid="' + r._id + '" style="border:1.5px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:10px;background:' + rowBg + '">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">'
        + '<span style="padding:2px 9px;border-radius:999px;font-size:.7rem;font-weight:800;background:' + sBg + ';color:' + sColor + '">' + sLabel + '</span>'
        + '<span style="padding:2px 9px;border-radius:999px;font-size:.7rem;font-weight:800;background:#eef2ff;color:#4338ca">' + typeLabel + '</span>'
        + '<span style="margin-left:auto;font-size:.75rem;font-weight:600;color:var(--muted)">' + date + '</span>'
      + '</div>'
      + '<div style="font-size:.95rem;font-weight:900;color:var(--text);margin-bottom:5px">' + _esc(r.title || '（無標題）') + '</div>'
      + '<div style="font-size:.83rem;font-weight:600;color:var(--muted);margin-bottom:10px;white-space:pre-wrap;word-break:break-word;line-height:1.6">' + _esc(r.description || '') + '</div>'
      + '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">'
        + '<span style="font-size:.75rem;font-weight:700;color:var(--muted)">' + reporterType + ' · ' + reporter + '</span>'
        + (r.reporterClass ? '<span style="font-size:.75rem;font-weight:700;color:var(--muted)">班級 ' + _esc(r.reporterClass) + '</span>' : '')
        + '<span style="font-size:.75rem;font-weight:700;color:var(--muted)">📍 ' + _esc(r.page || '—') + '</span>'
        + '<div style="margin-left:auto;display:flex;gap:6px">' + actionBtns + '</div>'
      + '</div>'
      + '</div>';
  }).join('');

  wrap.innerHTML = html;
}

/* ── 操作：標為已讀 ── */
function markReportRead(id) {
  if (!db) return;
  db.collection('reports').doc(id).update({ status: 'read' }).then(function () {
    var r = _findById(id);
    if (r) { r.status = 'read'; _renderReports(); }
  }).catch(function () { showToast('操作失敗，請重試'); });
}

/* ── 操作：標為已解決 ── */
function markReportResolved(id) {
  if (!db) return;
  db.collection('reports').doc(id).update({ status: 'resolved' }).then(function () {
    var r = _findById(id);
    if (r) { r.status = 'resolved'; _renderReports(); }
  }).catch(function () { showToast('操作失敗，請重試'); });
}

/* ── 操作：刪除（二次確認） ── */
function deleteReportConfirm(id, btn) {
  if (btn._confirming) {
    if (!db) return;
    db.collection('reports').doc(id).delete().then(function () {
      reportsList = reportsList.filter(function (x) { return x._id !== id; });
      _renderReports();
    }).catch(function () { showToast('刪除失敗，請重試'); });
    return;
  }
  btn._confirming = true;
  var orig = btn.textContent;
  btn.textContent = '確認刪除？';
  btn.style.background = '#fee2e2';
  setTimeout(function () {
    if (btn._confirming) {
      btn._confirming = false;
      btn.textContent = orig;
      btn.style.background = '';
    }
  }, 2500);
}

/* ── 輔助 ── */
function _findById(id) {
  for (var i = 0; i < reportsList.length; i++) {
    if (reportsList[i]._id === id) return reportsList[i];
  }
  return null;
}

function _fmtDate(d) {
  if (!d) return '—';
  var M = d.getMonth() + 1, D = d.getDate();
  var H = d.getHours(),    Min = d.getMinutes();
  return d.getFullYear() + '/'
    + (M   < 10 ? '0' + M   : M)   + '/'
    + (D   < 10 ? '0' + D   : D)   + ' '
    + (H   < 10 ? '0' + H   : H)   + ':'
    + (Min < 10 ? '0' + Min : Min);
}

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── 面板 HTML 骨架 ── */
function _buildPanelHTML() {
  return '<div class="card">'
    + '<div class="card-title">📬 用戶回報'
      + '<button onclick="_fetchReports()" style="margin-left:auto;padding:5px 12px;border:1.5px solid var(--border);border-radius:7px;background:white;font-size:.8rem;font-weight:700;cursor:pointer;font-family:inherit">🔄 重新整理</button>'
    + '</div>'
    + '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:16px">'
      + '<div style="display:flex;gap:6px;align-items:center">'
        + '<span style="font-size:.72rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.3px">狀態</span>'
        + '<select id="reports-filter-status" style="border:1.5px solid var(--border);border-radius:8px;padding:6px 10px;font-size:.82rem;font-weight:700;font-family:inherit;outline:none;cursor:pointer">'
          + '<option value="all">全部</option>'
          + '<option value="unread">未讀</option>'
          + '<option value="read">已讀</option>'
          + '<option value="resolved">已解決</option>'
        + '</select>'
      + '</div>'
      + '<div style="display:flex;gap:6px;align-items:center">'
        + '<span style="font-size:.72rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.3px">類型</span>'
        + '<select id="reports-filter-type" style="border:1.5px solid var(--border);border-radius:8px;padding:6px 10px;font-size:.82rem;font-weight:700;font-family:inherit;outline:none;cursor:pointer">'
          + '<option value="all">全部</option>'
          + '<option value="problem">🐛 問題回報</option>'
          + '<option value="suggestion">💡 功能建議</option>'
        + '</select>'
      + '</div>'
    + '</div>'
    + '<div id="reports-list-wrap">'
      + '<div class="loading-wrap"><div class="spinner"></div></div>'
    + '</div>'
    + '</div>';
}
