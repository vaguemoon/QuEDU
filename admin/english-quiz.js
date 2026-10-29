/**
 * admin/english-quiz.js — 英文測驗管理（測驗區「🌐 英文」分頁）
 * 依賴：shared.js（db、showToast）、init.js（currentTeacher）、english.js（_EN_GRADES）、
 *       quiz-sessions.js（qs-share-modal / closeQuizShareModal）、math-quiz.js（mq-results-modal / hideMqResultsModal）
 *
 * 題庫是英文圖庫（englishImages）的「生字」「常用語」，兩種大題：
 *   pic    看圖選字：看圖片選英文
 *   listen 聽音選字：聽發音選英文
 * 測驗文件（englishQuizSessions）只存選了哪些字（id + word + kind），不存圖片——圖片是
 * base64 很大，學生端作答時才照 id 讀。另存 pool：該年級同 kind 的全部字，給學生端抽干擾選項。
 */
'use strict';

var _eqSessions = [];

var _EQ_SEC_TYPES  = [
  { type: 'pic',    label: '🖼️ 看圖選字', desc: '看圖片，選出正確的英文' },
  { type: 'listen', label: '🔊 聽音選字', desc: '聽發音，選出正確的英文' }
];
var _EQ_KINDS = [
  { key: 'words',       label: '📖 生字' },
  { key: 'expressions', label: '💬 常用語' }
];

function _eqEsc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function _eqEscJs(s) { return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
function _eqSecLabel(type) {
  var t = _EQ_SEC_TYPES.find(function(x) { return x.type === type; });
  return t ? t.label : type;
}

/* ════════════════════════════════════════
   列表
   ════════════════════════════════════════ */
function loadEnglishQuizSessions() {
  var wrap = document.getElementById('eq-list-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  if (!db || !currentTeacher) { setTimeout(loadEnglishQuizSessions, 300); return; }

  db.collection('englishQuizSessions')
    .where('teacherUid', '==', currentTeacher.uid)
    .get()
    .then(function(snap) {
      _eqSessions = [];
      snap.forEach(function(doc) { _eqSessions.push(Object.assign({ id: doc.id }, doc.data())); });
      _eqSessions.sort(function(a, b) { return (b.createdAt || '') > (a.createdAt || '') ? 1 : -1; });
      _eqRenderList(wrap);
    })
    .catch(function(e) {
      wrap.innerHTML = '<div style="color:var(--red);padding:12px;font-size:.9rem">載入失敗：' + _eqEsc(e.message) + '</div>';
    });
}

function _eqRenderList(wrap) {
  if (!_eqSessions.length) {
    wrap.innerHTML = '<div style="color:var(--muted);padding:16px;text-align:center;font-size:.9rem">尚未建立任何英文測驗。點擊「＋ 新增測驗」開始出題。</div>';
    return;
  }
  var btnCss = 'padding:5px 12px;font-size:.8rem;margin-right:4px';
  var rows = _eqSessions.map(function(s) {
    var secs = (s.sections || []).map(function(sec) {
      return _eqSecLabel(sec.type) + ' ' + (sec.items || []).length + ' 題';
    }).join('、');
    var status = s.active !== false
      ? '<span style="color:var(--green);font-weight:800;font-size:.82rem">● 進行中</span>'
      : '<span style="color:var(--muted);font-size:.82rem">已關閉</span>';
    var id = _eqEscJs(s.id);
    return '<tr id="eq-row-' + _eqEsc(s.id) + '" style="border-bottom:1px solid var(--border)">' +
      '<td style="font-weight:800;padding:10px 8px">' + _eqEsc(s.name || '未命名') + '</td>' +
      '<td style="padding:10px 8px">' + _eqEsc(s.grade || '') + '</td>' +
      '<td style="padding:10px 8px">' + _eqEsc(secs) + '</td>' +
      '<td style="padding:10px 8px">' + status + '</td>' +
      '<td style="padding:10px 8px;white-space:nowrap">' +
        '<button class="btn btn-secondary" style="' + btnCss + '" onclick="showEqShareModal(\'' + id + '\')">📤 派發</button>' +
        '<button class="btn btn-secondary" style="' + btnCss + '" onclick="showEqResults(\'' + id + '\')">📊 結果</button>' +
        '<button class="btn btn-secondary" style="' + btnCss + '" onclick="toggleEqActive(\'' + id + '\',' + (s.active !== false ? 'false' : 'true') + ')">' +
          (s.active !== false ? '停用' : '啟用') + '</button>' +
        '<button class="btn btn-secondary" style="' + btnCss + '" onclick="toggleEqDetail(\'' + id + '\',this)">▼ 內容</button>' +
        '<button class="btn" style="' + btnCss + ';color:var(--red);border-color:var(--red);background:transparent" ' +
          'onclick="deleteEqSession(\'' + id + '\')">🗑 刪除</button>' +
      '</td>' +
    '</tr>' +
    '<tr id="eq-detail-' + _eqEsc(s.id) + '" style="display:none">' +
      '<td colspan="5" style="padding:10px 20px 14px;background:var(--gray-lt);font-size:.88rem;line-height:1.9">' +
        _eqDetailHtml(s) +
      '</td>' +
    '</tr>';
  }).join('');

  var th = 'text-align:left;padding:8px;font-weight:800;color:var(--muted);font-size:.8rem';
  wrap.innerHTML =
    '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.9rem">' +
      '<thead><tr style="border-bottom:2px solid var(--border)">' +
        '<th style="' + th + '">名稱</th><th style="' + th + '">年級</th><th style="' + th + '">大題</th>' +
        '<th style="' + th + '">狀態</th><th style="' + th + '">操作</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function _eqDetailHtml(s) {
  return (s.sections || []).map(function(sec, i) {
    var words = (sec.items || []).map(function(it) { return _eqEsc(it.word); }).join('、');
    return '<div><b>' + ['一','二','三'][i] + '、' + _eqSecLabel(sec.type) + '（' + (sec.items || []).length + ' 題）</b>：' +
      (words || '—') + '</div>';
  }).join('') || '<span style="color:var(--muted)">無題目</span>';
}

function toggleEqDetail(id, btn) {
  var row = document.getElementById('eq-detail-' + id);
  if (!row) return;
  var open = row.style.display === 'none';
  row.style.display = open ? '' : 'none';
  if (btn) btn.textContent = open ? '▲ 內容' : '▼ 內容';
}

async function toggleEqActive(id, newActive) {
  try {
    await db.collection('englishQuizSessions').doc(id).update({ active: newActive });
    showToast(newActive ? '✅ 已啟用測驗' : '已停用測驗');
    loadEnglishQuizSessions();
  } catch(e) { showToast('操作失敗：' + e.message); }
}

/* 刪除：連同派發到各班的 sharedQuizSessions 一起刪，學生清單才不會留下點不開的卡片；
   已交卷的成績（englishQuizResults）保留，跟數學測驗同樣做法 */
async function deleteEqSession(id) {
  var s = _eqSessions.find(function(x) { return x.id === id; });
  var name = (s && s.name) || '未命名';
  if (!confirm('確定要刪除「' + name + '」？此操作無法復原。')) return;
  try {
    var classSnap = await db.collection('classes').where('teacherUid', '==', currentTeacher.uid).get();
    await Promise.all(classSnap.docs.map(function(c) {
      return db.collection('classes').doc(c.id).collection('sharedQuizSessions').doc(id).delete().catch(function() {});
    }));
    await db.collection('englishQuizSessions').doc(id).delete();
    showToast('已刪除「' + name + '」');
    loadEnglishQuizSessions();
  } catch(e) { showToast('刪除失敗：' + e.message); }
}

/* ════════════════════════════════════════
   新增測驗 Modal
   流程：名稱 → 年級 → 勾單元（生字、常用語各自列出）→ 兩個大題各自勾要考的字（預設全勾）
   ════════════════════════════════════════ */
var _eqItems = [];     // 該年級全部生字＋常用語 [{id, word, kind, unit, unitName, imageUrl}]
var _eqUnitOn = {};    // 'kind|unit' → true
var _eqPick = { pic: {}, listen: {} };  // 大題 → { itemId: true }
var _eqLoadSeq = 0;

function showEqCreateModal() {
  var modal = document.getElementById('eq-create-modal');
  if (!modal) return;
  document.getElementById('eq-name').value = '';
  document.getElementById('eq-create-error').textContent = '';
  var sel = document.getElementById('eq-grade');
  sel.innerHTML = '<option value="">請選擇年級</option>' +
    _EN_GRADES.map(function(g) { return '<option value="' + _eqEsc(g) + '">' + _eqEsc(g) + '</option>'; }).join('');
  _eqItems = []; _eqUnitOn = {}; _eqPick = { pic: {}, listen: {} };
  document.getElementById('eq-units').innerHTML = '';
  _eqRenderPick();
  modal.style.display = 'flex';
}

function hideEqCreateModal() {
  var modal = document.getElementById('eq-create-modal');
  if (modal) modal.style.display = 'none';
}

function _eqLoadGrade() {
  var grade = document.getElementById('eq-grade').value;
  var unitsEl = document.getElementById('eq-units');
  _eqItems = []; _eqUnitOn = {}; _eqPick = { pic: {}, listen: {} };
  _eqRenderPick();
  if (!grade) { unitsEl.innerHTML = ''; return; }
  unitsEl.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  var seq = ++_eqLoadSeq; /* 連續切換年級時，只採用最後一次的結果 */

  Promise.all(_EQ_KINDS.map(function(k) {
    return db.collection('englishImages').where('grade', '==', grade).where('section', '==', k.key).get();
  })).then(function(snaps) {
    if (seq !== _eqLoadSeq) return;
    snaps.forEach(function(snap, ki) {
      snap.forEach(function(doc) {
        var d = doc.data();
        if (!d.word || !d.unit || !d.imageUrl) return;
        _eqItems.push({ id: doc.id, word: d.word, kind: _EQ_KINDS[ki].key, unit: d.unit,
                        unitName: d.unitName || '', imageUrl: d.imageUrl });
      });
    });
    _eqRenderUnits();
  }).catch(function(e) {
    if (seq !== _eqLoadSeq) return;
    unitsEl.innerHTML = '<div style="color:var(--red);font-size:.9rem">載入失敗：' + _eqEsc(e.message) + '</div>';
  });
}

function _eqUnitSort(a, b) {
  var na = parseInt(String(a).replace(/\D+/g, ''), 10), nb = parseInt(String(b).replace(/\D+/g, ''), 10);
  return (isNaN(na) || isNaN(nb)) ? String(a).localeCompare(String(b)) : na - nb;
}

function _eqRenderUnits() {
  var el = document.getElementById('eq-units');
  if (!_eqItems.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:.9rem;padding:8px 0">這個年級的英文圖庫還沒有生字或常用語，請先到「資料庫 → 🇺🇸 英文圖庫」上傳。</div>';
    return;
  }
  el.innerHTML = _EQ_KINDS.map(function(k) {
    var units = {};
    _eqItems.forEach(function(it) {
      if (it.kind !== k.key) return;
      if (!units[it.unit]) units[it.unit] = { name: it.unitName, count: 0 };
      units[it.unit].count++;
    });
    var keys = Object.keys(units).sort(_eqUnitSort);
    if (!keys.length) return '';
    return '<div style="margin-bottom:10px"><div style="font-weight:900;font-size:.92rem;margin-bottom:6px">' + k.label + '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
      keys.map(function(u) {
        var key = k.key + '|' + u;
        return '<label style="display:flex;align-items:center;gap:6px;padding:7px 12px;border:1.5px solid var(--border);border-radius:10px;cursor:pointer;font-size:.9rem;font-weight:700">' +
          '<input type="checkbox" ' + (_eqUnitOn[key] ? 'checked ' : '') + 'onchange="_eqToggleUnit(\'' + _eqEscJs(key) + '\',this.checked)">' +
          _eqEsc(u) + (units[u].name ? '：' + _eqEsc(units[u].name) : '') +
          '<span style="color:var(--muted);font-weight:600">（' + units[u].count + '）</span></label>';
      }).join('') + '</div></div>';
  }).join('');
}

/* 勾單元＝該單元所有字在兩個大題都預設勾上；取消單元＝兩個大題都移除 */
function _eqToggleUnit(key, on) {
  var parts = key.split('|');
  if (on) _eqUnitOn[key] = true; else delete _eqUnitOn[key];
  _eqItems.forEach(function(it) {
    if (it.kind !== parts[0] || it.unit !== parts[1]) return;
    _EQ_SEC_TYPES.forEach(function(t) {
      if (on) _eqPick[t.type][it.id] = true; else delete _eqPick[t.type][it.id];
    });
  });
  _eqRenderPick();
}

function _eqItemsInUnits() {
  return _eqItems.filter(function(it) { return _eqUnitOn[it.kind + '|' + it.unit]; })
    .sort(function(a, b) {
      if (a.kind !== b.kind) return a.kind === 'words' ? -1 : 1;
      return _eqUnitSort(a.unit, b.unit);
    });
}

function _eqRenderPick() {
  var el = document.getElementById('eq-sections');
  if (!el) return;
  var items = _eqItemsInUnits();
  if (!items.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:.9rem;padding:8px 0">勾選單元後，這裡會列出單字讓你挑選要考哪些。</div>';
    _eqUpdateTotal();
    return;
  }
  el.innerHTML = _EQ_SEC_TYPES.map(function(t) {
    var n = items.filter(function(it) { return _eqPick[t.type][it.id]; }).length;
    return '<div style="border:1.5px solid var(--border);border-radius:12px;margin-bottom:12px;overflow:hidden">' +
      '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--gray-lt);flex-wrap:wrap">' +
        '<span style="font-weight:900;font-size:.98rem">' + t.label + '</span>' +
        '<span style="color:var(--muted);font-size:.85rem;font-weight:600">' + t.desc + '</span>' +
        '<span id="eq-count-' + t.type + '" style="margin-left:auto;font-weight:900;color:var(--blue-dk)">' + n + ' 題</span>' +
        '<button type="button" class="btn btn-secondary" style="padding:4px 12px;font-size:.8rem" onclick="_eqPickAll(\'' + t.type + '\',true)">全選</button>' +
        '<button type="button" class="btn btn-secondary" style="padding:4px 12px;font-size:.8rem" onclick="_eqPickAll(\'' + t.type + '\',false)">全不選</button>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;padding:12px">' +
        items.map(function(it) {
          var on = !!_eqPick[t.type][it.id];
          return '<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1.5px solid ' + (on ? 'var(--blue)' : 'var(--border)') +
              ';border-radius:10px;cursor:pointer;background:' + (on ? 'var(--blue-lt)' : 'white') + '">' +
            '<input type="checkbox" ' + (on ? 'checked ' : '') + 'onchange="_eqTogglePick(\'' + t.type + '\',\'' + _eqEscJs(it.id) + '\',this)">' +
            '<img src="' + _eqEsc(it.imageUrl) + '" alt="" style="width:40px;height:40px;object-fit:contain;border-radius:6px;flex-shrink:0">' +
            '<span style="font-weight:800;font-size:.9rem;word-break:break-word">' + _eqEsc(it.word) + '</span>' +
          '</label>';
        }).join('') +
      '</div></div>';
  }).join('');
  _eqUpdateTotal();
}

function _eqTogglePick(type, id, cb) {
  if (cb.checked) _eqPick[type][id] = true; else delete _eqPick[type][id];
  var lab = cb.parentNode;
  lab.style.borderColor = cb.checked ? 'var(--blue)' : 'var(--border)';
  lab.style.background  = cb.checked ? 'var(--blue-lt)' : 'white';
  var n = _eqItemsInUnits().filter(function(it) { return _eqPick[type][it.id]; }).length;
  var c = document.getElementById('eq-count-' + type);
  if (c) c.textContent = n + ' 題';
  _eqUpdateTotal();
}

function _eqPickAll(type, on) {
  _eqItemsInUnits().forEach(function(it) {
    if (on) _eqPick[type][it.id] = true; else delete _eqPick[type][it.id];
  });
  _eqRenderPick();
}

function _eqUpdateTotal() {
  var items = _eqItemsInUnits();
  var total = 0;
  _EQ_SEC_TYPES.forEach(function(t) {
    total += items.filter(function(it) { return _eqPick[t.type][it.id]; }).length;
  });
  var el = document.getElementById('eq-total-display');
  if (el) el.textContent = total;
}

async function createEnglishQuizSession() {
  var errEl = document.getElementById('eq-create-error');
  var name  = document.getElementById('eq-name').value.trim();
  var grade = document.getElementById('eq-grade').value;
  if (!name)  { errEl.textContent = '請輸入測驗名稱'; return; }
  if (!grade) { errEl.textContent = '請選擇年級'; return; }

  var items = _eqItemsInUnits();
  var sections = _EQ_SEC_TYPES.map(function(t) {
    return {
      type: t.type,
      items: items.filter(function(it) { return _eqPick[t.type][it.id]; })
                  .map(function(it) { return { id: it.id, word: it.word, kind: it.kind }; })
    };
  }).filter(function(sec) { return sec.items.length; });
  var total = sections.reduce(function(n, sec) { return n + sec.items.length; }, 0);
  if (!total) { errEl.textContent = '請至少勾選一個單字'; return; }

  /* 干擾選項字庫：整個年級同 kind 的字（不只勾選的單元），選項才夠多樣 */
  var pool = {};
  _EQ_KINDS.forEach(function(k) {
    var seen = {};
    pool[k.key] = _eqItems.filter(function(it) {
      if (it.kind !== k.key || seen[it.word]) return false;
      seen[it.word] = true; return true;
    }).map(function(it) { return it.word; });
  });

  var btn = document.getElementById('btn-create-eq');
  if (btn) btn.disabled = true;
  try {
    await db.collection('englishQuizSessions').add({
      teacherUid:     currentTeacher.uid,
      quizType:       'english',
      name:           name,
      grade:          grade,
      sections:       sections,
      pool:           pool,
      totalQuestions: total,
      active:         true,
      createdAt:      new Date().toISOString()
    });
    showToast('✅ 測驗建立成功！記得按「📤 派發」分享給班級');
    hideEqCreateModal();
    loadEnglishQuizSessions();
  } catch(e) {
    errEl.textContent = '建立失敗：' + e.message;
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ════════════════════════════════════════
   派發（沿用語文/數學共用的 qs-share-modal）
   ════════════════════════════════════════ */
var _eqShareSessionId = null;

async function showEqShareModal(sessionId) {
  _eqShareSessionId = sessionId;
  var s = _eqSessions.find(function(x) { return x.id === sessionId; });
  var modal     = document.getElementById('qs-share-modal');
  var nameEl    = document.getElementById('qs-share-doc-name');
  var listEl    = document.getElementById('qs-share-class-list');
  var loadingEl = document.getElementById('qs-share-loading');
  var confirmEl = document.getElementById('qs-share-confirm-btn');
  if (!modal) return;
  if (nameEl) nameEl.textContent = (s && s.name) || '英文測驗';
  if (listEl) listEl.innerHTML = '';
  if (loadingEl) loadingEl.style.display = 'block';
  if (confirmEl) confirmEl.onclick = saveEqShareSettings;
  modal.style.display = 'flex';

  try {
    var classSnap = await db.collection('classes')
      .where('teacherUid', '==', currentTeacher.uid)
      .where('active', '==', true)
      .get();
    var sharedIn = {};
    await Promise.all(classSnap.docs.map(async function(cdoc) {
      var d = await db.collection('classes').doc(cdoc.id).collection('sharedQuizSessions').doc(sessionId).get();
      if (d.exists) sharedIn[cdoc.id] = true;
    }));
    if (loadingEl) loadingEl.style.display = 'none';
    if (!listEl) return;
    if (!classSnap.docs.length) {
      listEl.innerHTML = '<div style="padding:12px;color:var(--muted);font-size:.9rem">尚未建立班級</div>';
      return;
    }
    listEl.innerHTML = classSnap.docs.map(function(cdoc) {
      var cls = cdoc.data();
      return '<label style="display:flex;align-items:center;gap:10px;padding:10px 8px;cursor:pointer;border-bottom:1px solid var(--border)">' +
        '<input type="checkbox" data-cid="' + _eqEsc(cdoc.id) + '" ' + (sharedIn[cdoc.id] ? 'checked' : '') + '>' +
        '<span style="font-size:.92rem;font-weight:700">' + _eqEsc(cls.name || cdoc.id) + '</span></label>';
    }).join('');
  } catch(e) {
    if (loadingEl) loadingEl.style.display = 'none';
    if (listEl) listEl.innerHTML = '<div style="color:var(--red);padding:12px">載入班級失敗</div>';
  }
}

async function saveEqShareSettings() {
  if (!_eqShareSessionId) return;
  var checkboxes = document.querySelectorAll('#qs-share-class-list input[type="checkbox"]');
  var confirmBtn = document.getElementById('qs-share-confirm-btn');
  if (confirmBtn) confirmBtn.disabled = true;
  try {
    var writes = [];
    checkboxes.forEach(function(cb) {
      var ref = db.collection('classes').doc(cb.getAttribute('data-cid')).collection('sharedQuizSessions').doc(_eqShareSessionId);
      writes.push(cb.checked
        ? ref.set({ sessionId: _eqShareSessionId, type: 'english-quiz', sharedAt: new Date().toISOString() })
        : ref.delete().catch(function() {}));
    });
    await Promise.all(writes);
    showToast('✅ 派發設定已儲存！');
    closeQuizShareModal();
  } catch(e) {
    showToast('儲存失敗：' + e.message);
  } finally {
    if (confirmBtn) confirmBtn.disabled = false;
  }
}

/* ════════════════════════════════════════
   結果（沿用數學測驗的 mq-results-modal 外框）：每位學生取最高分，點一下展開錯題
   ════════════════════════════════════════ */
async function showEqResults(sessionId) {
  var modal = document.getElementById('mq-results-modal');
  var body  = document.getElementById('mq-results-body');
  var s     = _eqSessions.find(function(x) { return x.id === sessionId; });
  if (!modal) return;
  document.getElementById('mq-results-title').textContent = ((s && s.name) || '英文測驗') + '　成績';
  body.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  modal.style.display = 'flex';

  try {
    var snap = await db.collection('englishQuizResults').where('sessionId', '==', sessionId).get();
    if (snap.empty) {
      body.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:.9rem">尚無學生作答紀錄</div>';
      return;
    }
    var byStudent = {};
    snap.forEach(function(doc) {
      var d = doc.data();
      var sid = d.studentId || 'unknown';
      if (!byStudent[sid]) byStudent[sid] = { best: d, count: 0 };
      byStudent[sid].count++;
      if (d.score > byStudent[sid].best.score) byStudent[sid].best = d;
    });

    var list = Object.keys(byStudent).map(function(k) { return byStudent[k]; })
      .sort(function(a, b) { return b.best.score - a.best.score; });
    var avg = Math.round(list.reduce(function(n, r) { return n + r.best.score; }, 0) / list.length);

    var rows = list.map(function(r, idx) {
      var d = r.best;
      var detailId = 'eq-sd-' + idx;
      var wrong = (d.questions || []).filter(function(q) { return !q.correct; });
      var mainRow = '<tr style="border-bottom:1px solid var(--border);cursor:pointer" ' +
        'onclick="var e=document.getElementById(\'' + detailId + '\');e.style.display=e.style.display===\'none\'?\'table-row\':\'none\'">' +
        '<td style="padding:9px 10px;font-weight:800">' + _eqEsc(d.studentName || '—') + '</td>' +
        '<td style="padding:9px 10px;text-align:center;font-weight:900;font-size:1.1rem;color:' + (d.score >= 60 ? 'var(--green)' : 'var(--red)') + '">' + d.score + '</td>' +
        '<td style="padding:9px 10px;text-align:center">' + (d.correct || 0) + ' / ' + (d.total || 0) + '</td>' +
        '<td style="padding:9px 10px;text-align:center;color:var(--muted)">' + r.count + ' 次</td>' +
      '</tr>';
      var detail = wrong.length
        ? wrong.map(function(q) {
            return '<div style="padding:2px 0">' + _eqEsc(_eqSecLabel(q.sec)) + '　<b>' + _eqEsc(q.word) + '</b>　' +
              '<span style="color:var(--red)">選了：' + _eqEsc(q.answer === null || q.answer === undefined ? '未作答' : q.answer) + '</span></div>';
          }).join('')
        : '<span style="color:var(--green);font-weight:800">全部答對 🎉</span>';
      return mainRow + '<tr id="' + detailId + '" style="display:none;background:var(--gray-lt)">' +
        '<td colspan="4" style="padding:10px 16px 14px;font-size:.88rem">' +
          '<div style="font-size:.8rem;color:var(--muted);margin-bottom:6px">最高分那次的錯題</div>' + detail +
        '</td></tr>';
    }).join('');

    var th = 'padding:8px 10px;font-weight:800;color:var(--muted);font-size:.8rem';
    body.innerHTML =
      '<div style="font-size:.88rem;font-weight:700;color:var(--muted);margin-bottom:10px">' + list.length + ' 人作答 · 平均 ' + avg + ' 分 · 點學生可看錯題</div>' +
      '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.9rem">' +
        '<thead><tr style="border-bottom:2px solid var(--border)">' +
          '<th style="text-align:left;' + th + '">學生</th><th style="text-align:center;' + th + '">最高分</th>' +
          '<th style="text-align:center;' + th + '">答對</th><th style="text-align:center;' + th + '">作答</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  } catch(e) {
    body.innerHTML = '<div style="color:var(--red);padding:12px">載入失敗：' + _eqEsc(e.message) + '</div>';
  }
}
