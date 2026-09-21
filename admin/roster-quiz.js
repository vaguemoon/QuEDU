/**
 * admin/roster-quiz.js — 班級管理／文件管理 tab
 * 列出目前實際分享給這個班級的內容（不論哪位老師分享的），可移除分享：
 *   - 語文測驗：classes/{classId}/sharedQuizSessions
 *   - 報讀文件：classes/{classId}/sharedReaderDocs
 * 這裡跟「語文測驗列表」的資料夾（quizSessions.folder）是兩回事——
 * 資料夾只是老師自己整理用的標籤，分享狀態存在 sharedQuizSessions，
 * 兩者沒有關聯，這就是舊老師留下的分享不會出現在新老師資料夾裡、但學生還是看得到的原因。
 * 依賴：shared.js（db、showToast、escHtml）、admin/classes.js（currentRosterClassId、currentClasses）
 */
'use strict';

var _rqItems = []; // [{type:'quiz'|'reader', id, name, meta, teacherName, sharedAt, exists, active}]

function loadRosterQuizManagement() {
  var classId = currentRosterClassId;
  var wrap = document.getElementById('roster-quiz-wrap');
  if (!wrap || !classId) return;

  var nameEl = document.getElementById('roster-quiz-class-name');
  if (nameEl) {
    var cls = currentClasses.find(function(c) { return c.id === classId; });
    if (cls) nameEl.textContent = cls.name;
  }

  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  Promise.all([_rqLoadQuizItems(classId), _rqLoadReaderItems(classId)])
    .then(function(results) {
      _rqItems = results[0].concat(results[1]);
      _rqRenderList(wrap);
    })
    .catch(function(e) {
      wrap.innerHTML = '<div style="color:var(--red);font-size:.88rem;padding:12px">載入失敗：' + e.message + '</div>';
    });
}

/* ══ 測驗分享 ══ */
function _rqLoadQuizItems(classId) {
  return db.collection('classes').doc(classId).collection('sharedQuizSessions').get()
    .then(function(snap) {
      var shares = [];
      snap.forEach(function(doc) { shares.push({ sessionId: doc.id, share: doc.data() }); });
      if (!shares.length) return [];

      return Promise.all(shares.map(function(s) {
        return db.collection('quizSessions').doc(s.sessionId).get().then(function(qsDoc) {
          return { sessionId: s.sessionId, share: s.share, qs: qsDoc.exists ? qsDoc.data() : null, exists: qsDoc.exists };
        });
      })).then(function(results) {
        var teacherUids = [];
        results.forEach(function(r) {
          if (r.qs && r.qs.teacherUid && teacherUids.indexOf(r.qs.teacherUid) === -1) teacherUids.push(r.qs.teacherUid);
        });
        return _rqLoadTeacherNames(teacherUids).then(function(teacherNameMap) {
          return results.map(function(r) {
            var qs = r.qs || {};
            return {
              type:        'quiz',
              id:          r.sessionId,
              name:        qs.name || r.share.name || '（未命名）',
              meta:        [qs.grade || r.share.grade || '', qs.lessonName || r.share.lessonName || ''].filter(Boolean).join(' '),
              teacherName: qs.teacherUid ? (teacherNameMap[qs.teacherUid] || '未知老師') : '未知老師',
              sharedAt:    r.share.sharedAt || null,
              exists:      r.exists,
              active:      r.exists ? qs.active !== false : false
            };
          });
        });
      });
    });
}

/* ══ 報讀文件分享 ══ */
function _rqLoadReaderItems(classId) {
  return db.collection('classes').doc(classId).collection('sharedReaderDocs').get()
    .then(function(snap) {
      var docs = [];
      snap.forEach(function(doc) { docs.push({ name: doc.id, data: doc.data() }); });
      if (!docs.length) return [];

      var teacherUids = [];
      docs.forEach(function(d) {
        if (d.data.teacherUid && teacherUids.indexOf(d.data.teacherUid) === -1) teacherUids.push(d.data.teacherUid);
      });
      return _rqLoadTeacherNames(teacherUids).then(function(teacherNameMap) {
        return docs.map(function(d) {
          return {
            type:        'reader',
            id:          d.name,
            name:        d.data.title || d.name || '（未命名）',
            meta:        '報讀文件',
            teacherName: d.data.teacherUid ? (teacherNameMap[d.data.teacherUid] || '未知老師') : '未知老師',
            sharedAt:    d.data.sharedAt || null,
            exists:      true,
            active:      true
          };
        });
      });
    });
}

function _rqLoadTeacherNames(teacherUids) {
  if (!teacherUids.length) return Promise.resolve({});
  return Promise.all(teacherUids.map(function(uid) { return db.collection('teachers').doc(uid).get(); }))
    .then(function(teacherDocs) {
      var map = {};
      teacherDocs.forEach(function(doc) {
        if (doc.exists) map[doc.id] = doc.data().name || doc.data().email || doc.id;
      });
      return map;
    });
}

function _rqRenderList(wrap) {
  if (!_rqItems.length) {
    wrap.innerHTML =
      '<div style="text-align:center;padding:32px 16px;color:var(--muted);font-weight:600;font-size:.88rem">' +
      '目前沒有測驗或報讀文件分享給這個班級。</div>';
    return;
  }

  var sorted = _rqItems.slice().sort(function(a, b) {
    var ta = a.sharedAt ? a.sharedAt.seconds : 0, tb = b.sharedAt ? b.sharedAt.seconds : 0;
    return tb - ta;
  });

  var rows = sorted.map(function(s) {
    var tags = '';
    if (s.type === 'quiz') {
      if (!s.exists) tags += '<span style="color:var(--red);font-size:.72rem;font-weight:800;margin-left:6px">（原試卷已刪除）</span>';
      else if (!s.active) tags += '<span style="color:var(--muted);font-size:.72rem;font-weight:800;margin-left:6px">（已停用）</span>';
    }
    var typeLabel = s.type === 'quiz'
      ? '📝 測驗' + (s.meta ? '　' + escHtml(s.meta) : '')
      : '🎧 ' + escHtml(s.meta);
    var sharedAtStr = s.sharedAt ? new Date(s.sharedAt.seconds * 1000).toLocaleDateString('zh-TW') : '—';

    return '<tr>' +
      '<td><strong>' + escHtml(s.name) + '</strong>' + tags + '</td>' +
      '<td style="color:var(--muted);font-size:.82rem">' + typeLabel + '</td>' +
      '<td style="color:var(--muted);font-size:.82rem">' + escHtml(s.teacherName) + '</td>' +
      '<td style="color:var(--muted);font-size:.82rem">' + sharedAtStr + '</td>' +
      '<td style="text-align:right">' +
        '<button onclick="_rqUnshare(\'' + s.type + '\',\'' + _rqEscAttr(s.id) + '\',\'' + _rqEscAttr(s.name) + '\')" ' +
          'style="padding:4px 10px;border:1.5px solid var(--red,#e53e3e);border-radius:6px;background:white;color:var(--red,#e53e3e);font-size:.76rem;font-weight:700;cursor:pointer;font-family:inherit">' +
          '🗑 移除分享</button>' +
      '</td>' +
    '</tr>';
  }).join('');

  wrap.innerHTML =
    '<table class="student-table">' +
      '<thead><tr><th>名稱</th><th>類型</th><th>建立老師</th><th>分享時間</th><th></th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
    '</table>';
}

function _rqUnshare(type, id, name) {
  var classId = currentRosterClassId;
  if (!classId) return;
  var kindLabel = type === 'quiz' ? '測驗' : '報讀文件';
  if (!confirm('確定要移除「' + name + '」這份' + kindLabel + '對這個班級的分享嗎？學生將不會再看到它。')) return;

  var coll = type === 'quiz' ? 'sharedQuizSessions' : 'sharedReaderDocs';
  db.collection('classes').doc(classId).collection(coll).doc(id).delete()
    .then(function() {
      showToast('✅ 已移除分享');
      loadRosterQuizManagement();
    })
    .catch(function(e) { showToast('❌ 移除失敗：' + e.message); });
}

function _rqEscAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
}
