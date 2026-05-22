/**
 * admin/tasks.js — 班級公告（老師任務）管理
 * 依賴：shared.js（db、showToast、escHtml）、admin/classes.js（currentRosterClassId、currentClasses）
 *
 * Firestore：classes/{classId}.tasks = [{id, text, createdAt}, ...]
 */
'use strict';

function loadClassTasks() {
  var classId = currentRosterClassId;
  var wrap = document.getElementById('tasks-list-wrap');
  if (!wrap || !classId) return;

  var nameEl = document.getElementById('roster-tasks-class-name');
  if (nameEl) {
    var cls = currentClasses.find(function(c) { return c.id === classId; });
    if (cls) nameEl.textContent = cls.name;
  }

  var errEl = document.getElementById('task-add-error');
  if (errEl) errEl.textContent = '';

  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  db.collection('classes').doc(classId).get()
    .then(function(doc) {
      var tasks = (doc.exists ? doc.data().tasks : null) || [];
      _renderTaskList(wrap, tasks);
    })
    .catch(function(e) {
      wrap.innerHTML = '<div style="color:var(--red);padding:12px;font-size:.85rem">載入失敗：' + e.message + '</div>';
    });
}

function _renderTaskList(wrap, tasks) {
  if (!tasks.length) {
    wrap.innerHTML =
      '<div style="color:var(--muted);font-size:.85rem;font-weight:600;padding:12px 0">' +
      '還沒有公告。在下方輸入任務或提醒，按「＋ 新增」後學生即可在 Hub 看到。</div>';
    return;
  }

  wrap.innerHTML = tasks.slice().reverse().map(function(t) {
    var eid = escHtml(t.id);
    return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;' +
      'background:#f8fafc;border-radius:8px;margin-bottom:8px;border:1.5px solid var(--border)">' +
      '<div style="flex:1;font-size:.9rem;font-weight:700;color:var(--text)">' + escHtml(t.text) + '</div>' +
      '<div style="font-size:.72rem;color:var(--muted);font-weight:600;white-space:nowrap">' +
        _formatTaskDate(t.createdAt) +
      '</div>' +
      '<button onclick="deleteClassTask(\'' + eid + '\')" ' +
        'style="padding:4px 10px;border:1.5px solid #fca5a5;border-radius:6px;background:#fff5f5;' +
        'color:#dc2626;font-size:.75rem;font-weight:800;cursor:pointer;font-family:inherit;white-space:nowrap">' +
        '✕ 刪除' +
      '</button>' +
    '</div>';
  }).join('');
}

function _formatTaskDate(createdAt) {
  if (!createdAt) return '';
  var d = new Date(createdAt);
  return (d.getMonth() + 1) + '/' + d.getDate();
}

function addClassTask() {
  var input = document.getElementById('new-task-input');
  var errEl = document.getElementById('task-add-error');
  var text  = input ? input.value.trim() : '';

  if (!text) { if (errEl) errEl.textContent = '請輸入任務內容'; return; }
  if (errEl) errEl.textContent = '';

  var classId = currentRosterClassId;
  if (!classId || !db) return;

  var task = {
    id:        Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    text:      text,
    createdAt: new Date().toISOString()
  };

  db.collection('classes').doc(classId).update({
    tasks: firebase.firestore.FieldValue.arrayUnion(task)
  }).then(function() {
    if (input) input.value = '';
    showToast('✅ 已新增公告');
    loadClassTasks();
  }).catch(function(e) {
    if (errEl) errEl.textContent = '新增失敗：' + e.message;
  });
}

function deleteClassTask(taskId) {
  if (!confirm('確定要刪除這則公告嗎？')) return;
  var classId = currentRosterClassId;
  if (!classId || !db) return;

  db.collection('classes').doc(classId).get()
    .then(function(doc) {
      if (!doc.exists) return;
      var tasks = (doc.data().tasks || []).filter(function(t) { return t.id !== taskId; });
      return db.collection('classes').doc(classId).update({ tasks: tasks });
    })
    .then(function() {
      showToast('已刪除公告');
      loadClassTasks();
    })
    .catch(function(e) { showToast('刪除失敗：' + e.message); });
}
