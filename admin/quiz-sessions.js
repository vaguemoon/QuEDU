/**
 * admin/quiz-sessions.js — 教師測驗代碼管理（建立、列表、關閉）
 * 依賴：shared.js（db、showToast）、init.js（currentTeacher）
 */
'use strict';

/* ── 測驗列表快取 ── */
var _qsAllSessions = [];
var _qsAllScoreMap = {};

/* ── 資料夾狀態（null = 未分類）── */
var _qsCurrentFolder = null;

/* ── 批次選取狀態 ── */
var _qsSelectMode  = false;
var _qsSelectedIds = [];

/* ── 已建立但尚無試卷的空資料夾（記憶體暫存）── */
var _qsPendingFolders = [];

/* ── HTML5 拖曳狀態 ── */
var _qsDragSessionId = null;

/* ── 詳情 panel 狀態 ── */
var _qsDetailSessionId = null;

/* ── 6 碼代碼產生 ── */
function _genCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code  = '';
  for (var i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function _qsEsc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function _qsEscJs(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
function _qsCnToInt(s) {
  var map = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,
              '十':10,'十一':11,'十二':12,'十三':13,'十四':14,'十五':15,
              '十六':16,'十七':17,'十八':18 };
  if (map[s] !== undefined) return map[s];
  var n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

/* ════════════════════════════════════════
   載入測驗列表
   ════════════════════════════════════════ */
function loadQuizSessions() {
  var wrap = document.getElementById('qs-list-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  if (!db || !currentTeacher) { setTimeout(loadQuizSessions, 300); return; }

  var EMPTY_SNAP = { forEach: function(){} };
  Promise.all([
    db.collection('quizSessions').where('teacherUid', '==', currentTeacher.uid).get(),
    db.collection('quizResults').where('teacherUid',  '==', currentTeacher.uid).get()
      .catch(function() { return EMPTY_SNAP; })
  ]).then(function(results) {
    var snap       = results[0];
    var resultSnap = results[1];

    var scoreMap = {};
    resultSnap.forEach(function(doc) {
      var d   = doc.data();
      var sid = d.sessionId;
      if (!sid) return;
      if (!scoreMap[sid]) scoreMap[sid] = { max: 0, count: 0, students: {} };
      scoreMap[sid].count++;
      if (d.score > scoreMap[sid].max) scoreMap[sid].max = d.score;
      var stId   = d.studentId || ('_' + scoreMap[sid].count);
      var stName = d.studentName || d.studentNickname || '匿名';
      if (!scoreMap[sid].students[stId] || d.score > scoreMap[sid].students[stId].max) {
        scoreMap[sid].students[stId] = { name: stName, max: d.score };
      }
    });

    if (snap.size === 0) {
      _qsAllSessions = [];
      _qsAllScoreMap = {};
      _qsShowSidebar(false);
      wrap.innerHTML = '<p style="color:var(--muted);font-size:.88rem;padding:16px 0">尚未建立任何測驗。點擊「＋ 新增測驗」開始出題。</p>';
      return;
    }

    var sessions = [];
    snap.forEach(function(doc) { sessions.push({ id: doc.id, data: doc.data() }); });
    sessions.sort(function(a, b) {
      if (a.data.active !== b.data.active) return a.data.active ? -1 : 1;
      return (b.data.createdAt || '').localeCompare(a.data.createdAt || '');
    });

    _qsAllSessions = sessions;
    _qsAllScoreMap = scoreMap;

    /* 清掉已有試卷的 pending 資料夾 */
    var existFolders = {};
    sessions.forEach(function(s) { if (s.data.folder) existFolders[s.data.folder] = true; });
    _qsPendingFolders = _qsPendingFolders.filter(function(p) { return !existFolders[p]; });

    _qsShowSidebar(true);
    _qsRenderSidebar();
    _qsRenderList();
  }).catch(function(e) {
    wrap.innerHTML = '<p style="color:var(--red);font-size:.88rem">讀取失敗：' + _qsEsc(e.message) + '</p>';
  });
}

function _qsShowSidebar(show) {
  var sb = document.getElementById('qs-sidebar');
  if (sb) sb.style.display = show ? 'block' : 'none';
}

/* ════════════════════════════════════════
   資料夾工具
   ════════════════════════════════════════ */

function _qsBuildFolderTree() {
  var tree = {};
  _qsAllSessions.forEach(function(s) {
    var f = s.data.folder;
    if (!f) return;
    var parts = f.split('/');
    var node  = tree;
    parts.forEach(function(p) {
      if (!node[p]) node[p] = { children: {} };
      node = node[p].children;
    });
  });
  return tree;
}

function _qsFolderCount(path) {
  var target = (path === '__uncat__') ? null : path;
  return _qsAllSessions.filter(function(s) {
    return (s.data.folder || null) === target;
  }).length;
}

function _qsRenderSidebar() {
  var el = document.getElementById('qs-sidebar');
  if (!el) return;
  var tree      = _qsBuildFolderTree();

  /* 把尚無試卷的暫存資料夾也合入樹中 */
  _qsPendingFolders.forEach(function(path) {
    var parts = path.split('/');
    var node  = tree;
    parts.forEach(function(p) {
      if (!node[p]) node[p] = { children: {} };
      node = node[p].children;
    });
  });
  var uncatCnt  = _qsFolderCount('__uncat__');
  var isUncat   = (_qsCurrentFolder === null);

  var html = '';

  /* 未分類（固定項目） */
  html += '<div class="qs-fi' + (isUncat ? ' qs-fi-active' : '') + '" ' +
    'onclick="qsSelectFolder(null)" data-path="__uncat__" ' +
    'ondragover="event.preventDefault();this.classList.add(\'qs-fi-drag\')" ' +
    'ondragleave="this.classList.remove(\'qs-fi-drag\')" ' +
    'ondrop="_qsDropOnFolder(event,null)">' +
    '<span>📂</span>' +
    '<span class="qs-fi-name">未分類</span>' +
    '<span class="qs-fi-cnt">' + uncatCnt + '</span>' +
    '</div>';

  /* 資料夾樹 */
  function renderNode(node, parentPath, depth) {
    Object.keys(node).sort().forEach(function(name) {
      var path      = parentPath ? parentPath + '/' + name : name;
      var isActive  = (_qsCurrentFolder === path);
      var cnt       = _qsFolderCount(path);
      var hasChild  = Object.keys(node[name].children).length > 0;
      var indent    = 8 + depth * 14;

      html += '<div class="qs-fi' + (isActive ? ' qs-fi-active' : '') + '" ' +
        'style="padding-left:' + indent + 'px" ' +
        'onclick="qsSelectFolder(\'' + _qsEscJs(path) + '\')" data-path="' + _qsEsc(path) + '" ' +
        'ondragover="event.preventDefault();this.classList.add(\'qs-fi-drag\')" ' +
        'ondragleave="this.classList.remove(\'qs-fi-drag\')" ' +
        'ondrop="_qsDropOnFolder(event,\'' + _qsEscJs(path) + '\')">' +
        '<span>' + (hasChild ? '📁' : '📄') + '</span>' +
        '<span class="qs-fi-name">' + _qsEsc(name) + '</span>' +
        '<span class="qs-fi-cnt">' + cnt + '</span>' +
        '<button class="qs-fi-menu" onclick="event.stopPropagation();_qsFolderMenu(\'' + _qsEscJs(path) + '\',this)">⋯</button>' +
        '</div>';

      if (depth < 1) renderNode(node[name].children, path, depth + 1);
    });
  }
  renderNode(tree, '', 0);

  html += '<button class="qs-fi-add" onclick="_qsCreateFolder(\'\')">＋ 新增資料夾</button>';
  el.innerHTML = html;
}

function qsSelectFolder(path) {
  _qsCurrentFolder = (path === '__uncat__' || path === null) ? null : path;
  _qsSelectedIds   = [];
  _qsUpdateSelectCount();
  _qsRenderSidebar();
  _qsRenderList();
}

/* ─ 資料夾選單（⋯）─ */
function _qsFolderMenu(path, btn) {
  var old = document.getElementById('qs-folder-dropdown');
  if (old) { old.remove(); return; }

  var depth = path.split('/').length;
  var d     = document.createElement('div');
  d.id = 'qs-folder-dropdown';
  d.style.cssText = 'position:fixed;z-index:600;background:white;border:1.5px solid var(--border);' +
    'border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.18);padding:5px 0;min-width:148px;font-family:inherit';

  var items = [];
  if (depth < 2) {
    items.push({ label: '📁 新增子資料夾', fn: '_qsCreateFolder(\'' + _qsEscJs(path) + '\')' });
  }
  items.push({ label: '✏️ 重新命名', fn: '_qsRenameFolder(\'' + _qsEscJs(path) + '\')' });
  items.push({ label: '🗑 刪除資料夾', fn: '_qsDeleteFolder(\'' + _qsEscJs(path) + '\')', red: true });

  d.innerHTML = items.map(function(item) {
    return '<button onclick="' + item.fn + ';var _d=document.getElementById(\'qs-folder-dropdown\');if(_d)_d.remove()" ' +
      'style="display:block;width:100%;padding:8px 14px;border:none;background:none;text-align:left;' +
      'font-size:.82rem;font-weight:700;cursor:pointer;font-family:inherit;' +
      (item.red ? 'color:var(--red)' : 'color:var(--text)') + '">' + item.label + '</button>';
  }).join('');

  document.body.appendChild(d);
  var rect = btn.getBoundingClientRect();
  var top  = rect.bottom + 4;
  var left = rect.left;
  if (left + 160 > window.innerWidth) left = window.innerWidth - 164;
  d.style.top  = top  + 'px';
  d.style.left = left + 'px';

  setTimeout(function() {
    document.addEventListener('click', function _close() {
      var el = document.getElementById('qs-folder-dropdown');
      if (el) el.remove();
      document.removeEventListener('click', _close);
    });
  }, 10);
}

/* ─ 新增資料夾 ─ */
function _qsCreateFolder(parentPath) {
  var label = parentPath ? '在「' + parentPath + '」中新增子資料夾名稱：' : '新增資料夾名稱：';
  var name  = prompt(label, '');
  if (!name || !name.trim()) return;
  name = name.trim();
  if (name.indexOf('/') !== -1) { showToast('名稱不可包含 /'); return; }
  var newPath = parentPath ? parentPath + '/' + name : name;
  if (_qsPendingFolders.indexOf(newPath) === -1) _qsPendingFolders.push(newPath);
  _qsCurrentFolder = newPath;
  _qsRenderSidebar();
  _qsRenderList();
}

/* ─ 重新命名資料夾 ─ */
async function _qsRenameFolder(oldPath) {
  var parts   = oldPath.split('/');
  var oldName = parts[parts.length - 1];
  var newName = prompt('重新命名資料夾：', oldName);
  if (!newName || !newName.trim() || newName.trim() === oldName) return;
  newName = newName.trim();
  if (newName.indexOf('/') !== -1) { showToast('名稱不可包含 /'); return; }

  var parentPath = parts.slice(0, -1).join('/');
  var newPath    = parentPath ? parentPath + '/' + newName : newName;

  var toUpdate = _qsAllSessions.filter(function(s) {
    return (s.data.folder || '').startsWith(oldPath);
  });

  try {
    var BATCH_SIZE = 400;
    for (var i = 0; i < toUpdate.length; i += BATCH_SIZE) {
      var batch = db.batch();
      toUpdate.slice(i, i + BATCH_SIZE).forEach(function(s) {
        var nf = s.data.folder.replace(oldPath, newPath);
        batch.update(db.collection('quizSessions').doc(s.id), { folder: nf });
        s.data.folder = nf;
      });
      await batch.commit();
    }
    if (_qsCurrentFolder && _qsCurrentFolder.startsWith(oldPath)) {
      _qsCurrentFolder = _qsCurrentFolder.replace(oldPath, newPath);
    }
    showToast('已重新命名');
    _qsRenderSidebar();
    _qsRenderList();
  } catch(e) {
    showToast('❌ ' + e.message);
  }
}

/* ─ 刪除資料夾（含試卷）─ */
async function _qsDeleteFolder(path) {
  var toDelete = _qsAllSessions.filter(function(s) {
    return (s.data.folder || '').startsWith(path);
  });
  var folderName = path.split('/').pop();
  var msg = toDelete.length
    ? '確定刪除「' + folderName + '」及其中 ' + toDelete.length + ' 張試卷？此操作無法復原。'
    : '確定刪除空資料夾「' + folderName + '」？';
  if (!confirm(msg)) return;

  try {
    for (var i = 0; i < toDelete.length; i++) {
      await _qsDeleteSessionFull(toDelete[i].id);
    }
    if (_qsCurrentFolder && _qsCurrentFolder.startsWith(path)) _qsCurrentFolder = null;
    showToast('已刪除');
    _qsRenderSidebar();
    _qsRenderList();
  } catch(e) {
    showToast('❌ ' + e.message);
  }
}

/* ─ 移至資料夾（卡片按鈕 → 選擇器）─ */
function _qsShowMovePicker(sessionId) {
  var old = document.getElementById('qs-move-modal');
  if (old) old.remove();

  var tree  = _qsBuildFolderTree();
  var paths = [''];

  function collectPaths(node, prefix) {
    Object.keys(node).sort().forEach(function(name) {
      var p = prefix ? prefix + '/' + name : name;
      paths.push(p);
      collectPaths(node[name].children, p);
    });
  }
  collectPaths(tree, '');

  var modal = document.createElement('div');
  modal.id = 'qs-move-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.45);' +
    'display:flex;align-items:center;justify-content:center;padding:20px';

  var inner = '<div style="background:white;border-radius:16px;padding:24px 20px;max-width:320px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.2)">';
  inner += '<div style="font-size:1rem;font-weight:900;margin-bottom:14px">移至資料夾</div>';
  inner += '<div style="max-height:260px;overflow-y:auto;border:1.5px solid var(--border);border-radius:10px">';

  paths.forEach(function(p, idx) {
    var depth   = p ? p.split('/').length - 1 : 0;
    var label   = p || '未分類';
    var icon    = p ? '📁 ' : '📂 ';
    var borderB = idx < paths.length - 1 ? 'border-bottom:1px solid var(--border);' : '';
    inner += '<div onclick="_qsMoveSessionToFolder(\'' + _qsEscJs(sessionId) + '\',\'' + _qsEscJs(p) + '\');document.getElementById(\'qs-move-modal\').remove()" ' +
      'style="padding:9px 12px 9px ' + (12 + depth * 16) + 'px;cursor:pointer;font-size:.86rem;font-weight:700;' + borderB + '" ' +
      'onmouseover="this.style.background=\'var(--gray-lt)\'" onmouseout="this.style.background=\'\'">' +
      icon + _qsEsc(label) + '</div>';
  });

  inner += '<div onclick="_qsPickerNewFolder(\'' + _qsEscJs(sessionId) + '\')" ' +
    'style="padding:9px 12px;cursor:pointer;font-size:.86rem;font-weight:700;color:var(--blue)" ' +
    'onmouseover="this.style.background=\'var(--gray-lt)\'" onmouseout="this.style.background=\'\'">' +
    '＋ 新建資料夾</div>';

  inner += '</div>';
  inner += '<div style="display:flex;justify-content:flex-end;margin-top:14px">';
  inner += '<button onclick="document.getElementById(\'qs-move-modal\').remove()" ' +
    'style="padding:7px 18px;border:1.5px solid var(--border);border-radius:8px;background:white;' +
    'font-size:.82rem;font-weight:800;cursor:pointer;font-family:inherit">取消</button>';
  inner += '</div></div>';

  modal.innerHTML = inner;
  document.body.appendChild(modal);

  modal.addEventListener('pointerdown', function(e) {
    if (e.target === modal) modal.remove();
  });
}

function _qsPickerNewFolder(sessionId) {
  document.getElementById('qs-move-modal').remove();
  var name = prompt('新資料夾名稱：', '');
  if (!name || !name.trim()) return;
  name = name.trim();
  if (name.indexOf('/') !== -1) { showToast('名稱不可包含 /'); return; }
  _qsMoveSessionToFolder(sessionId, name);
}

async function _qsMoveSessionToFolder(sessionId, folderPath) {
  var folder = folderPath || null;
  try {
    var update = folder
      ? { folder: folder }
      : { folder: firebase.firestore.FieldValue.delete() };
    await db.collection('quizSessions').doc(sessionId).update(update);
    var s = _qsAllSessions.find(function(x) { return x.id === sessionId; });
    if (s) s.data.folder = folder;
    /* 有試卷移入後，不再需要 pending 標記 */
    if (folder) _qsPendingFolders = _qsPendingFolders.filter(function(p) { return p !== folder; });
    showToast('已移至「' + (folder || '未分類') + '」');
    _qsRenderSidebar();
    _qsRenderList();
  } catch(e) {
    showToast('❌ ' + e.message);
  }
}

/* ─ 拖曳：卡片 → sidebar ─ */
function _qsOnDragStart(e, id) {
  _qsDragSessionId = id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', id);
  e.currentTarget.style.opacity = '0.45';
}

function _qsOnDragEnd(e) {
  e.currentTarget.style.opacity = '';
  document.querySelectorAll('.qs-fi-drag').forEach(function(el) {
    el.classList.remove('qs-fi-drag');
  });
  _qsDragSessionId = null;
}

function _qsDropOnFolder(e, folderPath) {
  e.preventDefault();
  e.currentTarget.classList.remove('qs-fi-drag');
  var id = _qsDragSessionId || e.dataTransfer.getData('text/plain');
  if (!id) return;
  _qsMoveSessionToFolder(id, folderPath);
}

/* ════════════════════════════════════════
   批次選取模式
   ════════════════════════════════════════ */
function qsToggleSelectMode() {
  _qsSelectMode  = !_qsSelectMode;
  _qsSelectedIds = [];
  if (_qsSelectMode && _qsDetailSessionId) {
    /* 進入選取模式時關閉詳情 panel */
    var panel = document.getElementById('qs-detail-panel');
    var card  = document.querySelector('#qz-sessions-quiz .card');
    if (panel) { panel.style.display = 'none'; panel.innerHTML = ''; }
    if (card)  card.classList.remove('qs-panel-open');
    _qsDetailSessionId = null;
  }
  var toolbar = document.getElementById('qs-batch-toolbar');
  var btn     = document.getElementById('qs-select-mode-btn');
  if (toolbar) toolbar.style.display = _qsSelectMode ? 'flex' : 'none';
  if (btn)     btn.style.background  = _qsSelectMode ? 'var(--blue-lt)' : '';
  _qsUpdateSelectCount();
  _qsRenderList();
}

function qsSelectAll() {
  var filtered    = _qsGetFilteredSessions();
  var allSelected = filtered.every(function(s) { return _qsSelectedIds.indexOf(s.id) !== -1; });
  _qsSelectedIds  = allSelected ? [] : filtered.map(function(s) { return s.id; });
  _qsUpdateSelectCount();
  _qsRenderList();
}

function qsToggleCard(id) {
  var idx = _qsSelectedIds.indexOf(id);
  if (idx === -1) _qsSelectedIds.push(id);
  else            _qsSelectedIds.splice(idx, 1);
  _qsUpdateSelectCount();
  _qsRenderList();
}

function _qsUpdateSelectCount() {
  var el = document.getElementById('qs-select-count');
  if (el) el.textContent = '已選 ' + _qsSelectedIds.length + ' 張';

  var btn = document.getElementById('qs-select-all-btn');
  if (btn) {
    var filtered   = _qsGetFilteredSessions();
    var allChosen  = filtered.length > 0 &&
                     filtered.every(function(s) { return _qsSelectedIds.indexOf(s.id) !== -1; });
    btn.textContent = allChosen ? '取消全選' : '全選';
  }
}

function qsBatchMove() {
  if (!_qsSelectedIds.length) { showToast('尚未選取任何試卷'); return; }

  var old = document.getElementById('qs-move-modal');
  if (old) old.remove();

  var tree  = _qsBuildFolderTree();
  _qsPendingFolders.forEach(function(path) {
    var parts = path.split('/');
    var node  = tree;
    parts.forEach(function(p) {
      if (!node[p]) node[p] = { children: {} };
      node = node[p].children;
    });
  });

  var paths = [''];
  function collectPaths(node, prefix) {
    Object.keys(node).sort().forEach(function(name) {
      var p = prefix ? prefix + '/' + name : name;
      paths.push(p);
      collectPaths(node[name].children, p);
    });
  }
  collectPaths(tree, '');

  var modal = document.createElement('div');
  modal.id = 'qs-move-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.45);' +
    'display:flex;align-items:center;justify-content:center;padding:20px';

  var inner = '<div style="background:white;border-radius:16px;padding:24px 20px;max-width:320px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.2)">';
  inner += '<div style="font-size:1rem;font-weight:900;margin-bottom:4px">移至資料夾</div>';
  inner += '<div style="font-size:.78rem;color:var(--muted);font-weight:700;margin-bottom:14px">已選 ' + _qsSelectedIds.length + ' 張試卷</div>';
  inner += '<div style="max-height:260px;overflow-y:auto;border:1.5px solid var(--border);border-radius:10px">';

  paths.forEach(function(p, idx) {
    var depth   = p ? p.split('/').length - 1 : 0;
    var icon    = p ? '📁 ' : '📂 ';
    var borderB = idx < paths.length - 1 ? 'border-bottom:1px solid var(--border);' : '';
    inner += '<div onclick="_qsBatchMoveExecute(\'' + _qsEscJs(p) + '\');document.getElementById(\'qs-move-modal\').remove()" ' +
      'style="padding:9px 12px 9px ' + (12 + depth * 16) + 'px;cursor:pointer;font-size:.86rem;font-weight:700;' + borderB + '" ' +
      'onmouseover="this.style.background=\'var(--gray-lt)\'" onmouseout="this.style.background=\'\'">' +
      icon + _qsEsc(p || '未分類') + '</div>';
  });

  inner += '<div onclick="_qsBatchMovePickerNewFolder()" ' +
    'style="padding:9px 12px;cursor:pointer;font-size:.86rem;font-weight:700;color:var(--blue)" ' +
    'onmouseover="this.style.background=\'var(--gray-lt)\'" onmouseout="this.style.background=\'\'">' +
    '＋ 新建資料夾</div>';

  inner += '</div>';
  inner += '<div style="display:flex;justify-content:flex-end;margin-top:14px">';
  inner += '<button onclick="document.getElementById(\'qs-move-modal\').remove()" ' +
    'style="padding:7px 18px;border:1.5px solid var(--border);border-radius:8px;background:white;font-size:.82rem;font-weight:800;cursor:pointer;font-family:inherit">取消</button>';
  inner += '</div></div>';

  modal.innerHTML = inner;
  document.body.appendChild(modal);
  modal.addEventListener('pointerdown', function(e) { if (e.target === modal) modal.remove(); });
}

function _qsBatchMovePickerNewFolder() {
  document.getElementById('qs-move-modal').remove();
  var name = prompt('新資料夾名稱：', '');
  if (!name || !name.trim()) return;
  name = name.trim();
  if (name.indexOf('/') !== -1) { showToast('名稱不可包含 /'); return; }
  if (_qsPendingFolders.indexOf(name) === -1) _qsPendingFolders.push(name);
  _qsBatchMoveExecute(name);
}

async function _qsBatchMoveExecute(folderPath) {
  var folder = folderPath || null;
  var ids    = _qsSelectedIds.slice();
  try {
    var BATCH_SIZE = 400;
    for (var i = 0; i < ids.length; i += BATCH_SIZE) {
      var batch = db.batch();
      ids.slice(i, i + BATCH_SIZE).forEach(function(id) {
        var update = folder
          ? { folder: folder }
          : { folder: firebase.firestore.FieldValue.delete() };
        batch.update(db.collection('quizSessions').doc(id), update);
        var s = _qsAllSessions.find(function(x) { return x.id === id; });
        if (s) s.data.folder = folder;
      });
      await batch.commit();
    }
    if (folder) _qsPendingFolders = _qsPendingFolders.filter(function(p) { return p !== folder; });
    showToast('已將 ' + ids.length + ' 張試卷移至「' + (folder || '未分類') + '」');
    _qsSelectMode  = false;
    _qsSelectedIds = [];
    var toolbar = document.getElementById('qs-batch-toolbar');
    var btn     = document.getElementById('qs-select-mode-btn');
    if (toolbar) toolbar.style.display = 'none';
    if (btn)     btn.style.background  = '';
    _qsRenderSidebar();
    _qsRenderList();
  } catch(e) {
    showToast('❌ ' + e.message);
  }
}

async function qsBatchDelete() {
  if (!_qsSelectedIds.length) { showToast('尚未選取任何試卷'); return; }
  if (!confirm('確定刪除已選 ' + _qsSelectedIds.length + ' 張試卷？此操作無法復原。')) return;

  var ids = _qsSelectedIds.slice();
  try {
    for (var i = 0; i < ids.length; i++) {
      await _qsDeleteSessionFull(ids[i]);
    }
    showToast('已刪除 ' + ids.length + ' 張試卷');
    _qsSelectMode  = false;
    _qsSelectedIds = [];
    var toolbar = document.getElementById('qs-batch-toolbar');
    var btn     = document.getElementById('qs-select-mode-btn');
    if (toolbar) toolbar.style.display = 'none';
    if (btn)     btn.style.background  = '';
    _qsRenderSidebar();
    _qsRenderList();
  } catch(e) {
    showToast('❌ ' + e.message);
  }
}

/* ─ 完整刪除一個 session（class copies + quizResults）─ */
async function _qsDeleteSessionFull(id) {
  var sharedClassIds = await _getSessionSharedClasses(id);

  var resultsSnap = await db.collection('quizResults')
    .where('sessionId', '==', id).get()
    .catch(function() { return { docs: [] }; });

  /* 先刪 quizResults（允許失敗，不阻斷主流程）*/
  if (resultsSnap.docs.length) {
    try {
      var BATCH_SIZE = 400;
      for (var ri = 0; ri < resultsSnap.docs.length; ri += BATCH_SIZE) {
        var rb = db.batch();
        resultsSnap.docs.slice(ri, ri + BATCH_SIZE).forEach(function(doc) { rb.delete(doc.ref); });
        await rb.commit();
      }
    } catch(e) {
      console.warn('_qsDeleteSessionFull: quizResults 刪除失敗（忽略）', e);
    }
  }

  /* 刪 sharedQuizSessions subcollection + 主 session 文件 */
  var refs = [];
  sharedClassIds.forEach(function(classId) {
    refs.push(db.collection('classes').doc(classId).collection('sharedQuizSessions').doc(id));
  });
  refs.push(db.collection('quizSessions').doc(id));

  var BATCH_SIZE = 400;
  for (var i = 0; i < refs.length; i += BATCH_SIZE) {
    var batch = db.batch();
    refs.slice(i, i + BATCH_SIZE).forEach(function(ref) { batch.delete(ref); });
    await batch.commit();
  }

  _qsAllSessions = _qsAllSessions.filter(function(s) { return s.id !== id; });
  delete _qsAllScoreMap[id];
}

/* ════════════════════════════════════════
   渲染列表
   ════════════════════════════════════════ */
function _qsGetFilteredSessions() {
  return _qsAllSessions.filter(function(s) {
    return (s.data.folder || null) === _qsCurrentFolder;
  });
}

function _qsRenderList() {
  var wrap = document.getElementById('qs-list-wrap');
  if (!wrap) return;

  var filtered = _qsGetFilteredSessions();

  if (!filtered.length) {
    var label = _qsCurrentFolder ? '「' + _qsCurrentFolder.split('/').pop() + '」' : '未分類';
    wrap.innerHTML = '<p style="color:var(--muted);font-size:.88rem;padding:16px 0">' + label + ' 尚無試卷。</p>';
    return;
  }

  var html = '<div style="display:flex;flex-direction:column;gap:5px">';
  filtered.forEach(function(s) {
    var d          = s.data;
    var isSelected = _qsSelectedIds.indexOf(s.id) !== -1;
    var isActive   = !_qsSelectMode && (_qsDetailSessionId === s.id);

    var typeBadge = d.type === 'custom'
      ? '<span style="font-size:.6rem;font-weight:800;background:#dbeafe;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:3px;padding:1px 5px;margin-left:5px;vertical-align:middle">自選</span>'
      : d.type === 'exam'
      ? '<span style="font-size:.6rem;font-weight:800;background:#fef3c7;color:#92400e;border:1px solid #fde68a;border-radius:3px;padding:1px 5px;margin-left:5px;vertical-align:middle">試卷</span>'
      : '<span style="font-size:.6rem;font-weight:800;background:var(--gray-lt);color:var(--muted);border:1px solid var(--border);border-radius:3px;padding:1px 5px;margin-left:5px;vertical-align:middle">隨機</span>';

    html += '<div class="qs-row' + (isActive ? ' qs-row-active' : '') + '" ';
    if (_qsSelectMode) {
      html += 'onclick="qsToggleCard(\'' + _qsEscJs(s.id) + '\')"';
    } else {
      html += 'onclick="_qsOpenDetail(\'' + _qsEscJs(s.id) + '\')" draggable="true" ' +
        'ondragstart="_qsOnDragStart(event,\'' + _qsEscJs(s.id) + '\')" ondragend="_qsOnDragEnd(event)"';
    }
    html += '>';

    /* 選取模式：checkbox */
    if (_qsSelectMode) {
      html += '<div style="width:18px;height:18px;border-radius:4px;flex-shrink:0;' +
        'border:2px solid ' + (isSelected ? 'var(--blue)' : 'var(--border)') + ';' +
        'background:' + (isSelected ? 'var(--blue)' : 'white') + ';' +
        'display:flex;align-items:center;justify-content:center">' +
        (isSelected ? '<span style="color:white;font-size:.68rem;font-weight:900">✓</span>' : '') +
        '</div>';
    }

    /* 名稱 */
    html += '<div class="qs-row-name">' + _qsEsc(d.name || '未命名') + typeBadge + '</div>';

    /* 年級/課次 */
    var meta = [];
    if (d.grade)  meta.push(d.grade);
    if (d.lesson) meta.push('第' + d.lesson + '課' + (d.lessonName ? '　' + d.lessonName : ''));
    if (meta.length) html += '<div class="qs-row-meta">' + _qsEsc(meta.join('　')) + '</div>';

    /* ⋯ 選單按鈕 */
    if (!_qsSelectMode) {
      html += '<button class="qs-row-menu" onclick="event.stopPropagation();_qsCardMenu(\'' + _qsEscJs(s.id) + '\',this)" title="更多操作">⋯</button>';
    }

    html += '</div>';
  });
  html += '</div>';
  wrap.innerHTML = html;
}

/* ── 卡片 ⋯ 選單 ── */
function _qsCardMenu(id, btn) {
  var old = document.getElementById('qs-card-dropdown');
  if (old) { old.remove(); return; }

  var s = _qsAllSessions.find(function(x) { return x.id === id; });
  if (!s) return;
  var d      = s.data;
  var active = d.active !== false;

  var items = [];
  if (d.type === 'exam') {
    items.push({ label: '✏️ 編輯',   fn: '_ecEditSession(\'' + _qsEscJs(id) + '\')' });
    items.push({ label: '🖨 列印',   fn: '_ecPrintSession(\'' + _qsEscJs(id) + '\')' });
  }
  if (active) {
    items.push({ label: '📤 分享給班級', fn: 'showQuizShareModal(\'' + _qsEscJs(id) + '\',\'' + _qsEscJs(d.name || '') + '\')' });
    items.push({ label: '關閉測驗',      fn: 'closeQuizSession(\'' + _qsEscJs(id) + '\')' });
  }
  items.push({ label: '📁 移至資料夾', fn: '_qsShowMovePicker(\'' + _qsEscJs(id) + '\')' });
  items.push({ label: '🗑 刪除', fn: 'deleteQuizSession(\'' + _qsEscJs(id) + '\')', red: true });

  var dd = document.createElement('div');
  dd.id = 'qs-card-dropdown';
  dd.style.cssText = 'position:fixed;z-index:600;background:white;border:1.5px solid var(--border);' +
    'border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.18);padding:5px 0;min-width:158px;font-family:inherit';
  dd.innerHTML = items.map(function(item) {
    return '<button onclick="' + item.fn + ';var _d=document.getElementById(\'qs-card-dropdown\');if(_d)_d.remove()" ' +
      'style="display:block;width:100%;padding:8px 14px;border:none;background:none;text-align:left;' +
      'font-size:.82rem;font-weight:700;cursor:pointer;font-family:inherit;' +
      (item.red ? 'color:var(--red)' : 'color:var(--text)') + '">' + item.label + '</button>';
  }).join('');
  document.body.appendChild(dd);

  var rect = btn.getBoundingClientRect();
  var left = rect.right - 162;
  if (left < 4) left = 4;
  dd.style.top  = (rect.bottom + 4) + 'px';
  dd.style.left = left + 'px';

  setTimeout(function() {
    document.addEventListener('click', function _close() {
      var el = document.getElementById('qs-card-dropdown');
      if (el) el.remove();
      document.removeEventListener('click', _close);
    });
  }, 10);
}

/* ── 詳情 panel ── */
function _qsOpenDetail(id) {
  _qsDetailSessionId = id;
  var panel = document.getElementById('qs-detail-panel');
  var card  = document.querySelector('#qz-sessions-quiz .card');
  if (panel) panel.style.display = 'block';
  if (card)  card.classList.add('qs-panel-open');
  _qsRenderDetail();
  _qsRenderList();
}

function _qsCloseDetail() {
  _qsDetailSessionId = null;
  var panel = document.getElementById('qs-detail-panel');
  var card  = document.querySelector('#qz-sessions-quiz .card');
  if (panel) { panel.style.display = 'none'; panel.innerHTML = ''; }
  if (card)  card.classList.remove('qs-panel-open');
  _qsRenderList();
}

function _qsRenderDetail() {
  var panel = document.getElementById('qs-detail-panel');
  if (!panel || !_qsDetailSessionId) return;

  var s = _qsAllSessions.find(function(x) { return x.id === _qsDetailSessionId; });
  if (!s) { _qsCloseDetail(); return; }

  var d     = s.data;
  var stats = _qsAllScoreMap[_qsDetailSessionId];

  var html = '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;gap:8px">';
  html += '<div style="font-size:.88rem;font-weight:900;color:var(--blue-dk);min-width:0">' + _qsEsc(d.name || '未命名') + '</div>';
  html += '<button onclick="_qsCloseDetail()" style="border:none;background:none;cursor:pointer;' +
    'font-size:1rem;color:var(--muted);padding:2px 6px;border-radius:4px;flex-shrink:0;line-height:1" title="關閉">✕</button>';
  html += '</div>';

  if (stats && stats.count > 0) {
    var stuList = Object.keys(stats.students).map(function(uid) {
      return stats.students[uid];
    }).sort(function(a, b) { return b.max - a.max; });

    html += '<div style="font-size:.74rem;font-weight:700;color:var(--muted);margin-bottom:8px">' +
      stuList.length + ' 人作答 · 最高 ' + stats.max + ' 分</div>';
    html += '<div style="border:1.5px solid var(--border);border-radius:10px;overflow:hidden">';
    stuList.forEach(function(st, i) {
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 12px;' +
        'background:' + (i % 2 === 0 ? 'white' : 'var(--gray-lt)') + '">' +
        '<span style="font-weight:700;font-size:.84rem">' + _qsEsc(st.name) + '</span>' +
        '<span style="font-weight:900;color:var(--green);font-size:.84rem">' + st.max + ' 分</span>' +
        '</div>';
    });
    html += '</div>';
  } else {
    html += '<div style="color:var(--muted);font-size:.84rem;font-weight:600;padding:24px 0;text-align:center">尚無作答紀錄</div>';
  }

  panel.innerHTML = html;
}


/* ════════════════════════════════════════
   關閉 / 刪除測驗（單張）
   ════════════════════════════════════════ */
function closeQuizSession(id) {
  if (!confirm('關閉後學生將無法再使用此代碼入場，確定？')) return;
  db.collection('quizSessions').doc(id).update({ active: false })
    .then(function() { showToast('測驗已關閉'); loadQuizSessions(); })
    .catch(function(e) { showToast('❌ ' + e.message); });
}

async function deleteQuizSession(id) {
  if (!confirm('確定刪除此測驗記錄？此操作無法復原。')) return;
  try {
    await _qsDeleteSessionFull(id);
    showToast('已刪除');
    _qsRenderSidebar();
    _qsRenderList();
  } catch(e) {
    showToast('❌ ' + e.message);
  }
}


/* ════════════════════════════════════════
   試卷分享給班級
   ════════════════════════════════════════ */
var _qsShareSessionId = null;

/* 每次都直接查 Firestore，不快取——班級的負責教師（teacherUid）如果被改派，
   快取住的舊清單不會反映異動，分享名單就會跟實際權限脫節 */
async function _loadClassesForShare() {
  if (!db || !currentTeacher) return [];
  var snap = await db.collection('classes')
    .where('teacherUid', '==', currentTeacher.uid).get();
  return snap.docs.map(function(d) {
    return { id: d.id, name: d.data().name };
  });
}

async function _getSessionSharedClasses(sessionId) {
  var classes = await _loadClassesForShare();
  if (!classes.length) return [];
  var sharedIds = [];
  await Promise.all(classes.map(async function(cls) {
    var doc = await db.collection('classes').doc(cls.id)
      .collection('sharedQuizSessions').doc(sessionId).get();
    if (doc.exists) sharedIds.push(cls.id);
  }));
  return sharedIds;
}

async function _refreshAllShareStatus() {
  var els = document.querySelectorAll('.qs-share-status[data-session-id]');
  if (!els.length) return;
  var classes = await _loadClassesForShare().catch(function() { return []; });
  if (!classes.length) return;
  els.forEach(function(el) {
    var sessionId = el.dataset.sessionId;
    _getSessionSharedClasses(sessionId).then(function(sharedIds) {
      el.innerHTML = sharedIds.map(function(cid) {
        var cls = classes.find(function(c) { return c.id === cid; });
        if (!cls) return '';
        return '<span style="font-size:.68rem;font-weight:700;padding:2px 7px;border-radius:20px;background:#e0f2fe;color:#0369a1;white-space:nowrap">' + _qsEsc(cls.name) + '</span>';
      }).join(' ');
    }).catch(function() {});
  });
}

async function showQuizShareModal(sessionId, sessionName) {
  if (!db || !currentTeacher) { showToast('Firebase 未就緒'); return; }
  _qsShareSessionId = sessionId;

  var modal      = document.getElementById('qs-share-modal');
  var nameEl     = document.getElementById('qs-share-doc-name');
  var listEl     = document.getElementById('qs-share-class-list');
  var loadEl     = document.getElementById('qs-share-loading');
  var confirmBtn = document.getElementById('qs-share-confirm-btn');
  if (!modal) return;

  nameEl.textContent   = '《' + sessionName + '》';
  listEl.innerHTML     = '';
  loadEl.style.display = 'block';
  confirmBtn.disabled  = true;
  confirmBtn.onclick   = saveQuizShareSettings;
  modal.style.display  = 'flex';

  try {
    var classes   = await _loadClassesForShare();
    var sharedIds = await _getSessionSharedClasses(sessionId);
    loadEl.style.display = 'none';
    confirmBtn.disabled  = false;

    if (!classes.length) {
      listEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--muted);font-size:.85rem;font-weight:600">尚未建立任何班級</div>';
      return;
    }
    listEl.innerHTML = classes.map(function(cls) {
      var checked = sharedIds.indexOf(cls.id) !== -1 ? 'checked' : '';
      return '<label style="display:flex;align-items:center;gap:10px;padding:10px 6px;border-bottom:1px solid var(--border);cursor:pointer;font-weight:700;font-size:.9rem">' +
        '<input type="checkbox" value="' + cls.id + '" ' + checked + ' style="width:18px;height:18px;cursor:pointer">' +
        _qsEsc(cls.name) + '</label>';
    }).join('');
  } catch(e) {
    loadEl.style.display = 'none';
    confirmBtn.disabled  = false;
    listEl.innerHTML = '<div style="color:var(--red);font-size:.85rem;padding:8px">載入失敗：' + _qsEsc(e.message) + '</div>';
  }
}

function closeQuizShareModal() {
  var modal = document.getElementById('qs-share-modal');
  if (modal) modal.style.display = 'none';
  _qsShareSessionId = null;
}

async function saveQuizShareSettings() {
  if (!_qsShareSessionId || !db || !currentTeacher) return;
  var confirmBtn = document.getElementById('qs-share-confirm-btn');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '儲存中…'; }

  var checks = document.querySelectorAll('#qs-share-class-list input[type=checkbox]');
  try {
    var sessionDoc = await db.collection('quizSessions').doc(_qsShareSessionId).get();
    var sd = sessionDoc.exists ? sessionDoc.data() : {};

    var batch = db.batch();
    checks.forEach(function(cb) {
      var ref = db.collection('classes').doc(cb.value)
        .collection('sharedQuizSessions').doc(_qsShareSessionId);
      if (cb.checked) {
        batch.set(ref, {
          name:       sd.name       || '',
          grade:      sd.grade      || '',
          lesson:     sd.lesson     || '',
          lessonName: sd.lessonName || '',
          sharedAt:   firebase.firestore.FieldValue.serverTimestamp()
        });
      } else {
        batch.delete(ref);
      }
    });
    await batch.commit();
    showToast('✅ 分享設定已儲存');
    closeQuizShareModal();
    _refreshAllShareStatus();
  } catch(e) {
    showToast('❌ 儲存失敗：' + e.message);
  } finally {
    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = '✅ 確認分享'; }
  }
}
