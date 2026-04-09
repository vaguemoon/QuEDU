/**
 * super-admin/accounts.js — 教師帳號管理：查看、封鎖、解除封鎖
 * 依賴：shared.js（db、showToast）
 * Firestore 結構：teachers/{uid} → { uid, email, displayName, lastLoginAt, blocked }
 */
'use strict';

function loadAccounts() {
  if (!db) { setTimeout(loadAccounts, 400); return; }

  var wrap = document.getElementById('accounts-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  db.collection('teachers').orderBy('lastLoginAt', 'desc').get()
    .then(function(snap) {
      if (snap.empty) {
        wrap.innerHTML =
          '<div style="text-align:center;padding:32px;color:var(--muted);font-weight:600">' +
          '尚無教師登入紀錄。<br><span style="font-size:.82rem">教師首次登入後會自動出現在這裡。</span></div>';
        return;
      }

      var rows = [];
      snap.forEach(function(doc) {
        var d = doc.data();
        var uid      = doc.id;
        var email    = d.email    || '—';
        var name     = d.displayName || '—';
        var blocked  = !!d.blocked;
        var lastLogin = d.lastLoginAt
          ? new Date(d.lastLoginAt).toLocaleString('zh-TW', {
              year:'numeric', month:'numeric', day:'numeric',
              hour:'2-digit', minute:'2-digit'
            })
          : '—';

        var statusBadge = blocked
          ? '<span class="badge badge-red">已封鎖</span>'
          : '<span class="badge badge-green">正常</span>';

        var actionBtn = blocked
          ? '<button class="btn-sm-green" onclick="setTeacherBlocked(\'' + escHtml(uid) + '\',false)">解除封鎖</button>'
          : '<button class="btn-sm-red" onclick="setTeacherBlocked(\'' + escHtml(uid) + '\',true)">封鎖</button>';

        rows.push(
          '<tr>'
          + '<td><strong>' + escHtml(name) + '</strong></td>'
          + '<td style="color:var(--muted)">' + escHtml(email) + '</td>'
          + '<td style="font-size:.78rem;color:var(--muted)">' + lastLogin + '</td>'
          + '<td>' + statusBadge + '</td>'
          + '<td>' + actionBtn + '</td>'
          + '</tr>'
        );
      });

      wrap.innerHTML =
        '<table class="sa-table">'
        + '<thead><tr><th>姓名</th><th>Email</th><th>最後登入</th><th>狀態</th><th>操作</th></tr></thead>'
        + '<tbody>' + rows.join('') + '</tbody>'
        + '</table>';
    })
    .catch(function(e) {
      wrap.innerHTML =
        '<div style="color:var(--red);padding:20px;font-weight:700">載入失敗：' + e.message + '</div>';
    });
}

function setTeacherBlocked(uid, blocked) {
  if (!db) return;
  var action = blocked ? '封鎖' : '解除封鎖';
  if (!confirm('確定要' + action + '此教師帳號？')) return;

  db.collection('teachers').doc(uid).update({ blocked: blocked })
    .then(function() {
      showToast(blocked ? '已封鎖此教師帳號' : '✅ 已解除封鎖');
      loadAccounts();
    })
    .catch(function(e) { showToast('操作失敗：' + e.message); });
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
