/**
 * super-admin/invites.js — 全校邀請碼總覽：檢視、啟用/停用
 * 依賴：shared.js（db、showToast）
 */
'use strict';

function loadInvites() {
  if (!db) { setTimeout(loadInvites, 400); return; }

  var wrap = document.getElementById('invites-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  // 同時撈 teachers（建立 uid→email 對照）和 classes
  Promise.all([
    db.collection('teachers').get(),
    db.collection('classes').orderBy('createdAt', 'desc').get()
  ])
    .then(function(results) {
      var teacherSnap = results[0];
      var classesSnap = results[1];

      if (classesSnap.empty) {
        wrap.innerHTML =
          '<div style="text-align:center;padding:32px;color:var(--muted);font-weight:600">目前沒有任何班級</div>';
        return;
      }

      var teacherMap = {};
      teacherSnap.forEach(function(doc) {
        teacherMap[doc.id] = doc.data().email || doc.id;
      });

      var rows = [];
      classesSnap.forEach(function(doc) {
        var d = doc.data();
        var classId  = doc.id;
        var teacher  = teacherMap[d.teacherUid] || d.teacherEmail || '—';
        var active   = d.active !== false;
        var badge    = active
          ? '<span class="badge badge-green">啟用中</span>'
          : '<span class="badge badge-gray">已停用</span>';
        var btn      = active
          ? '<button class="btn-sm-red"   onclick="setInviteActive(\'' + classId + '\',false)">停用</button>'
          : '<button class="btn-sm-green" onclick="setInviteActive(\'' + classId + '\',true)">啟用</button>';
        var copyBtn =
          '<button class="btn-sm" onclick="copyInviteCode(\'' + escHtml(d.inviteCode) + '\')">複製</button>';

        rows.push(
          '<tr>'
          + '<td><strong>' + escHtml(d.name) + '</strong></td>'
          + '<td style="color:var(--muted)">' + escHtml(teacher) + '</td>'
          + '<td><span class="mono">' + escHtml(d.inviteCode || '—') + '</span> ' + copyBtn + '</td>'
          + '<td>' + badge + '</td>'
          + '<td>' + btn + '</td>'
          + '</tr>'
        );
      });

      wrap.innerHTML =
        '<table class="sa-table">'
        + '<thead><tr><th>班級名稱</th><th>負責教師</th><th>邀請碼</th><th>狀態</th><th>操作</th></tr></thead>'
        + '<tbody>' + rows.join('') + '</tbody>'
        + '</table>';
    })
    .catch(function(e) {
      wrap.innerHTML =
        '<div style="color:var(--red);padding:20px;font-weight:700">載入失敗：' + e.message + '</div>';
    });
}

function setInviteActive(classId, active) {
  if (!db) return;
  db.collection('classes').doc(classId).update({ active: active })
    .then(function() {
      showToast(active ? '✅ 邀請碼已啟用' : '邀請碼已停用');
      loadInvites();
    })
    .catch(function(e) { showToast('操作失敗：' + e.message); });
}

function copyInviteCode(code) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code)
      .then(function() { showToast('✅ 邀請碼已複製：' + code); })
      .catch(function() { _fallbackCopy(code); });
  } else {
    _fallbackCopy(code);
  }
}

function _fallbackCopy(code) {
  var ta = document.createElement('textarea');
  ta.value = code; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); showToast('✅ 邀請碼已複製：' + code); }
  catch(e) { showToast('請手動複製邀請碼'); }
  document.body.removeChild(ta);
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
