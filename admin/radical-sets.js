/**
 * admin/radical-sets.js — 部件趣：練習集管理（教師建置字／部件練習內容）
 * 依賴：shared.js（db、showToast、escHtml）、init.js（currentTeacher）
 */
'use strict';

var _rkSets         = []; // [{id, name, count}]
var _rkEditingId     = ''; // '' = 新增
var _rkWorkingItems  = []; // [{id?, char, radical, pending}]
var _rkAssignSetId   = '';
var _rkAssignClasses = [];
var _rkAssignChecked = {}; // classId → assignmentDocId

var RK_MIN_PER_RADICAL = 4;
var RK_MAX_SET_CHARS   = 120;

/* ════════════════════════════════
   進入點（由 switchDbView 呼叫）
   ════════════════════════════════ */
function loadRadicalTab() {
  if (!db || !currentTeacher) { setTimeout(loadRadicalTab, 300); return; }
  _rkRenderRoot();
}

/* ════════════════════════════════
   練習集列表
   ════════════════════════════════ */
function _rkRenderRoot() {
  var wrap = document.getElementById('rk-main');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  Promise.all([
    db.collection('radicalSets').where('teacherUid', '==', currentTeacher.uid).get(),
    db.collection('radicalItems').where('teacherUid', '==', currentTeacher.uid).get()
  ]).then(function(results) {
    var countMap = {};
    results[1].forEach(function(doc) {
      var sid = doc.data().setId;
      if (sid) countMap[sid] = (countMap[sid] || 0) + 1;
    });

    _rkSets = [];
    results[0].forEach(function(doc) {
      var d = doc.data();
      _rkSets.push({ id: doc.id, name: d.name || '（未命名）', count: countMap[doc.id] || 0 });
    });
    _rkSets.sort(function(a, b) { return a.name.localeCompare(b.name, 'zh-TW'); });

    var html =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
        '<div class="card-title" style="margin:0">🧩 部件練習集</div>' +
        '<button class="wi-cat-add-btn" onclick="_rkOpenBuilder()">＋ 新增練習集</button>' +
      '</div>';

    if (!_rkSets.length) {
      html += '<div class="wi-cat-empty">尚未建立任何練習集。點擊「＋ 新增練習集」開始建立。</div>';
    } else {
      html += '<div class="wi-cat-list">';
      _rkSets.forEach(function(s) {
        html += '<div class="wi-cat-item">' +
          '<span class="wi-cat-item-name">' + escHtml(s.name) +
            '<span style="font-size:.72rem;font-weight:700;color:var(--muted);margin-left:8px">（' + s.count + ' 字）</span>' +
          '</span>' +
          '<div class="wi-cat-item-btns">' +
            '<button class="wi-cat-assign-btn" onclick="_rkOpenAssign(\'' + s.id + '\',\'' + _rkEscAttr(s.name) + '\')">📋 指派班級</button>' +
            '<button class="wi-cat-enter-btn" onclick="_rkOpenBuilder(\'' + s.id + '\')">編輯 →</button>' +
            '<button class="wi-cat-del-icon" title="刪除練習集" onclick="_rkDeleteSet(\'' + s.id + '\',\'' + _rkEscAttr(s.name) + '\')">🗑</button>' +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    }

    wrap.innerHTML = html;
  }).catch(function(e) {
    wrap.innerHTML = '<p style="color:var(--red)">載入失敗：' + e.message + '</p>';
  });
}

/* ════════════════════════════════
   建置練習集（新增／編輯共用）
   ════════════════════════════════ */
function _rkOpenBuilder(setId) {
  _rkEditingId    = setId || '';
  _rkWorkingItems = [];
  var wrap = document.getElementById('rk-main');
  if (!wrap) return;

  if (!setId) { _rkRenderBuilder(''); return; }

  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  Promise.all([
    db.collection('radicalSets').doc(setId).get(),
    db.collection('radicalItems').where('setId', '==', setId).get()
  ]).then(function(results) {
    var setDoc = results[0];
    var name = setDoc.exists ? (setDoc.data().name || '') : '';
    results[1].forEach(function(doc) {
      var d = doc.data();
      _rkWorkingItems.push({ char: d.char || '', radical: d.radical || '', pending: false });
    });
    _rkWorkingItems.sort(function(a, b) { return (a.radical || '').localeCompare(b.radical || '', 'zh-TW'); });
    _rkRenderBuilder(name);
  }).catch(function(e) {
    showToast('載入失敗：' + e.message);
    _rkRenderRoot();
  });
}

function _rkRenderBuilder(name) {
  var wrap = document.getElementById('rk-main');
  if (!wrap) return;

  var html =
    '<button class="wi-back-btn" onclick="_rkRenderRoot()">← 返回列表</button>' +
    '<div class="card-title" style="margin:12px 0 14px">' + (_rkEditingId ? '編輯練習集' : '新增練習集') + '</div>' +
    '<div style="margin-bottom:14px">' +
      '<label style="display:block;font-size:.78rem;font-weight:800;color:var(--muted);margin-bottom:6px">練習集名稱</label>' +
      '<input id="rk-set-name" type="text" value="' + _rkEscAttr(name || '') + '" placeholder="例如：一年級常見部件"' +
        ' style="width:100%;max-width:360px;padding:9px 12px;border:2px solid var(--border);border-radius:8px;font-size:.95rem;font-family:inherit">' +
    '</div>' +
    '<div style="margin-bottom:14px">' +
      '<label style="display:block;font-size:.78rem;font-weight:800;color:var(--muted);margin-bottom:6px">' +
        '加入國字（可一次貼上多字，系統自動去除重複與非國字，並查詢部首）' +
      '</label>' +
      '<div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap">' +
        '<textarea id="rk-char-input" rows="2" placeholder="例如：河湖沙波打拉扣抓"' +
          ' style="flex:1;min-width:220px;padding:9px 12px;border:2px solid var(--border);border-radius:8px;font-size:.95rem;font-family:inherit;resize:vertical"></textarea>' +
        '<button class="btn btn-secondary" onclick="_rkAddCharsBatch()">＋ 加入清單</button>' +
      '</div>' +
    '</div>' +
    '<div id="rk-validate-summary" style="margin-bottom:12px"></div>' +
    '<div id="rk-item-table"></div>' +
    '<div style="margin-top:16px;display:flex;gap:10px">' +
      '<button class="btn btn-primary" id="rk-save-btn" onclick="_rkSaveSet()">💾 儲存練習集</button>' +
      '<button class="btn btn-secondary" onclick="_rkRenderRoot()">取消</button>' +
    '</div>';

  wrap.innerHTML = html;
  _rkRenderItemTable();
}

/* ── 批次加入國字 ── */
function _rkAddCharsBatch() {
  var ta = document.getElementById('rk-char-input');
  if (!ta) return;
  var raw = ta.value || '';
  var existing = {};
  _rkWorkingItems.forEach(function(it) { existing[it.char] = true; });

  var added = [];
  for (var i = 0; i < raw.length; i++) {
    var c = raw[i];
    if (/[一-鿿㐀-䶿]/.test(c) && !existing[c]) {
      existing[c] = true;
      added.push(c);
      if (_rkWorkingItems.length + added.length >= RK_MAX_SET_CHARS) break;
    }
  }
  if (!added.length) {
    showToast('沒有可加入的新字（可能都已在清單中，或超過上限 ' + RK_MAX_SET_CHARS + ' 字）');
    return;
  }

  added.forEach(function(c) {
    var item = { char: c, radical: '', pending: true };
    _rkWorkingItems.push(item);
    _rkFetchRadicalFor(item);
  });

  ta.value = '';
  _rkRenderItemTable();
}

/* ── 查詢萌典部首（沿用練字趣/列印工具已在用的機制） ── */
function _rkFetchRadicalFor(item) {
  fetch('https://www.moedict.tw/' + encodeURIComponent(item.char) + '.json')
    .then(function(res) { return res.ok ? res.json() : null; })
    .then(function(data) {
      var radical = data ? (data.radical || '').replace(/<[^>]+>/g, '').trim() : '';
      item.radical = radical || '';
      item.pending = false;
      _rkRenderItemTable();
    })
    .catch(function() {
      item.pending = false;
      _rkRenderItemTable();
    });
}

function _rkUpdateRadical(i, value) {
  if (!_rkWorkingItems[i]) return;
  _rkWorkingItems[i].radical = value.trim();
  var sumEl = document.getElementById('rk-validate-summary');
  if (sumEl) sumEl.innerHTML = _rkBuildValidationHtml();
}

function _rkRemoveItem(i) {
  _rkWorkingItems.splice(i, 1);
  _rkRenderItemTable();
}

function _rkRenderItemTable() {
  var tableEl = document.getElementById('rk-item-table');
  if (!tableEl) return;

  if (!_rkWorkingItems.length) {
    tableEl.innerHTML = '<div class="wi-cat-empty" style="font-size:.82rem">尚未加入任何字</div>';
  } else {
    tableEl.innerHTML = '<table style="width:100%;border-collapse:collapse">' +
      '<tr>' +
        '<th style="text-align:left;padding:6px 10px;border-bottom:2px solid var(--border);font-size:.72rem;font-weight:800;color:var(--muted)">字</th>' +
        '<th style="text-align:left;padding:6px 10px;border-bottom:2px solid var(--border);font-size:.72rem;font-weight:800;color:var(--muted)">部件／部首（可修改）</th>' +
        '<th style="border-bottom:2px solid var(--border)"></th>' +
      '</tr>' +
      _rkWorkingItems.map(function(item, i) {
        var radicalCell = item.pending
          ? '<span style="color:var(--muted);font-size:.82rem">查詢中…</span>'
          : '<input type="text" value="' + _rkEscAttr(item.radical) + '" maxlength="4"' +
            ' oninput="_rkUpdateRadical(' + i + ',this.value)"' +
            ' style="width:70px;padding:5px 8px;border:1.5px solid var(--border);border-radius:6px;font-size:.9rem;font-family:inherit;text-align:center">';
        return '<tr style="background:' + (i % 2 === 0 ? 'var(--gray-lt)' : '#fff') + '">' +
          '<td style="padding:6px 10px;border-bottom:1px solid var(--border);font-weight:900;font-size:1.05rem">' + escHtml(item.char) + '</td>' +
          '<td style="padding:6px 10px;border-bottom:1px solid var(--border)">' + radicalCell + '</td>' +
          '<td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:right">' +
            '<button onclick="_rkRemoveItem(' + i + ')" style="padding:2px 8px;border:1.5px solid var(--red,#e53e3e);border-radius:6px;background:white;color:var(--red,#e53e3e);font-size:.72rem;font-weight:700;cursor:pointer;font-family:inherit">移除</button>' +
          '</td>' +
        '</tr>';
      }).join('') +
    '</table>';
  }

  var sumEl = document.getElementById('rk-validate-summary');
  if (sumEl) sumEl.innerHTML = _rkBuildValidationHtml();
}

/* ── 驗證：每個部件至少要湊到 RK_MIN_PER_RADICAL 個字才能存 ── */
function _rkValidate() {
  var groups = {};
  var pendingCount = 0;
  var emptyCount   = 0;
  _rkWorkingItems.forEach(function(item) {
    if (item.pending) { pendingCount++; return; }
    var r = (item.radical || '').trim();
    if (!r) { emptyCount++; return; }
    if (!groups[r]) groups[r] = [];
    groups[r].push(item.char);
  });
  var shortRadicals = Object.keys(groups).filter(function(r) { return groups[r].length < RK_MIN_PER_RADICAL; });
  var tooFewRadicals = Object.keys(groups).length < 2;
  var valid = _rkWorkingItems.length > 0 && pendingCount === 0 && emptyCount === 0
    && shortRadicals.length === 0 && !tooFewRadicals;
  return {
    groups: groups, shortRadicals: shortRadicals, tooFewRadicals: tooFewRadicals,
    pendingCount: pendingCount, emptyCount: emptyCount, valid: valid
  };
}

function _rkBuildValidationHtml() {
  var btn = document.getElementById('rk-save-btn');
  if (!_rkWorkingItems.length) {
    if (btn) btn.disabled = true;
    return '';
  }

  var v = _rkValidate();
  if (btn) btn.disabled = !v.valid;

  var radicalKeys = Object.keys(v.groups).sort(function(a, b) { return v.groups[b].length - v.groups[a].length; });
  var chips = radicalKeys.map(function(r) {
    var ok    = v.groups[r].length >= RK_MIN_PER_RADICAL;
    var color = ok ? '#166534' : '#b45309';
    var bg    = ok ? '#dcfce7' : '#fef3c7';
    return '<span style="display:inline-block;margin:3px 6px 3px 0;padding:3px 9px;border-radius:999px;background:' + bg + ';color:' + color + ';font-size:.76rem;font-weight:800">' +
      escHtml(r) + '：' + v.groups[r].length + ' 字' + (ok ? '' : '（還差 ' + (RK_MIN_PER_RADICAL - v.groups[r].length) + '）') +
      '</span>';
  }).join('');

  var msgs = [];
  if (v.pendingCount) msgs.push(v.pendingCount + ' 個字查詢中，請稍候');
  if (v.emptyCount)   msgs.push(v.emptyCount + ' 個字沒有部件資料，請手動填寫');
  if (v.tooFewRadicals) msgs.push('練習集至少要有 2 種不同部件，學生練習時才能出四選一的題目');
  else if (v.shortRadicals.length) msgs.push('每個部件至少要 ' + RK_MIN_PER_RADICAL + ' 個字才能儲存，還有 ' + v.shortRadicals.length + ' 個部件不足');

  return '<div style="margin-bottom:8px">' + chips + '</div>' +
    (msgs.length
      ? '<div style="font-size:.78rem;font-weight:700;color:#b45309">⚠️ ' + msgs.join('；') + '</div>'
      : '<div style="font-size:.78rem;font-weight:700;color:#166534">✅ 可以儲存</div>');
}

/* ── 儲存練習集（新增或覆寫既有字/部件清單） ── */
function _rkSaveSet() {
  var nameEl = document.getElementById('rk-set-name');
  var name = nameEl ? nameEl.value.trim() : '';
  if (!name) { showToast('請輸入練習集名稱'); return; }

  var v = _rkValidate();
  if (!v.valid) { showToast('請先修正上方的驗證提示才能儲存'); return; }

  var btn = document.getElementById('rk-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = '儲存中…'; }

  var setId = _rkEditingId;
  var setPromise = setId
    ? db.collection('radicalSets').doc(setId).update({ name: name, updatedAt: new Date().toISOString() })
        .then(function() { return setId; })
    : db.collection('radicalSets').add({ teacherUid: currentTeacher.uid, name: name, createdAt: new Date().toISOString() })
        .then(function(ref) { return ref.id; });

  setPromise.then(function(finalSetId) {
    var deletePromise = setId
      ? db.collection('radicalItems').where('setId', '==', setId).get().then(function(snap) {
          if (snap.empty) return Promise.resolve();
          var batch = db.batch();
          snap.forEach(function(doc) { batch.delete(doc.ref); });
          return batch.commit();
        })
      : Promise.resolve();

    return deletePromise.then(function() {
      var items = _rkWorkingItems.filter(function(it) { return !it.pending && it.radical; });
      var batches = [], batch = db.batch(), count = 0;
      items.forEach(function(it) {
        batch.set(db.collection('radicalItems').doc(), {
          setId:      finalSetId,
          char:       it.char,
          radical:    it.radical,
          teacherUid: currentTeacher.uid
        });
        if (++count % 499 === 0) { batches.push(batch); batch = db.batch(); }
      });
      batches.push(batch);
      return Promise.all(batches.map(function(b) { return b.commit(); }));
    });
  }).then(function() {
    showToast('✅ 練習集已儲存');
    _rkRenderRoot();
  }).catch(function(e) {
    showToast('❌ 儲存失敗：' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = '💾 儲存練習集'; }
  });
}

/* ── 刪除練習集（含字/部件清單與班級指派） ── */
function _rkDeleteSet(id, name) {
  if (!confirm('確定要刪除練習集「' + name + '」嗎？裡面的字／部件資料與班級指派都會一併刪除，此操作無法復原。')) return;

  Promise.all([
    db.collection('radicalItems').where('setId', '==', id).get(),
    db.collection('radicalSetAssignments').where('setId', '==', id).get()
  ]).then(function(results) {
    var batch = db.batch();
    results[0].forEach(function(doc) { batch.delete(doc.ref); });
    results[1].forEach(function(doc) { batch.delete(doc.ref); });
    batch.delete(db.collection('radicalSets').doc(id));
    return batch.commit();
  }).then(function() {
    showToast('✅ 已刪除練習集「' + name + '」');
    _rkRenderRoot();
  }).catch(function(e) { showToast('❌ 刪除失敗：' + e.message); });
}

/* ════════════════════════════════
   指派給班級 Modal
   ════════════════════════════════ */
function _rkOpenAssign(setId, setName) {
  _rkAssignSetId = setId;
  document.getElementById('rk-assign-title').textContent = '指派「' + setName + '」給班級';
  document.getElementById('rk-assign-list').innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  document.getElementById('rk-assign-modal').style.display = 'flex';

  Promise.all([
    db.collection('classes').where('teacherUid', '==', currentTeacher.uid).get(),
    db.collection('radicalSetAssignments').where('setId', '==', setId).get()
  ]).then(function(results) {
    _rkAssignClasses = [];
    results[0].forEach(function(doc) {
      var d = doc.data();
      _rkAssignClasses.push({ id: doc.id, name: d.name || d.className || doc.id });
    });
    _rkAssignChecked = {};
    results[1].forEach(function(doc) {
      _rkAssignChecked[doc.data().classId] = doc.id;
    });

    var html = _rkAssignClasses.length
      ? _rkAssignClasses.map(function(cls) {
          var checked = !!_rkAssignChecked[cls.id];
          return '<label class="wi-assign-row">' +
            '<input type="checkbox" value="' + _rkEscAttr(cls.id) + '"' + (checked ? ' checked' : '') + '>' +
            '<span>' + escHtml(cls.name) + '</span>' +
            '</label>';
        }).join('')
      : '<div style="color:var(--muted);font-size:.88rem;padding:12px 0">尚未建立班級</div>';

    document.getElementById('rk-assign-list').innerHTML = html;
  }).catch(function(e) {
    document.getElementById('rk-assign-list').innerHTML = '<p style="color:var(--red)">載入失敗：' + e.message + '</p>';
  });
}

function _rkCloseAssign() {
  document.getElementById('rk-assign-modal').style.display = 'none';
}

function _rkSaveAssign() {
  var setId      = _rkAssignSetId;
  var checkboxes = document.querySelectorAll('#rk-assign-list input[type="checkbox"]');
  var toAdd = [], toRemove = [];

  checkboxes.forEach(function(cb) {
    var classId     = cb.value;
    var wasAssigned = !!_rkAssignChecked[classId];
    if (cb.checked && !wasAssigned) toAdd.push(classId);
    if (!cb.checked && wasAssigned) toRemove.push(classId);
  });

  var promises = [];
  toAdd.forEach(function(classId) {
    promises.push(db.collection('radicalSetAssignments').add({
      classId:    classId,
      setId:      setId,
      teacherUid: currentTeacher.uid,
      assignedAt: new Date().toISOString()
    }));
  });
  toRemove.forEach(function(classId) {
    var docId = _rkAssignChecked[classId];
    if (typeof docId === 'string') {
      promises.push(db.collection('radicalSetAssignments').doc(docId).delete());
    }
  });

  Promise.all(promises)
    .then(function() { showToast('✅ 班級指派已更新'); _rkCloseAssign(); })
    .catch(function(e) { showToast('❌ 儲存失敗：' + e.message); });
}

/* ── 工具函式 ── */
function _rkEscAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
}
