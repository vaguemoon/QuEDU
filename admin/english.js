/**
 * admin/english.js — 英文圖庫管理
 * 流程：年級 → Section → Unit（含發音組合管理）→ 圖片上傳
 * 依賴：shared.js（db、showToast）、init.js（currentTeacher）
 */
'use strict';

/* ── 狀態 ── */
var _enGrade     = '';
var _enSection   = '';  // 'phonics' | 'expressions' | 'words'
var _enUnit      = '';
var _enUnitName  = '';
var _enItems     = [];   // [{docId, word, phoneticGroup, imageUrl}]
var _enGroups    = [];   // phonics groups（來自 englishUnits）

var _enUploadIdx   = -1;    // >=0 = 更換現有；-1 = 新增
var _enIsNewImage  = true;
var _enUploadGroup = '';    // 上傳時選定的 phonics group
var _enPendingBlob = null;

var _EN_GRADES   = ['3年級','4年級','5年級','6年級'];
var _EN_SECTIONS = [
  { key: 'phonics',     label: '🔊 發音',  hasGroup: true  },
  { key: 'expressions', label: '💬 常用語', hasGroup: false },
  { key: 'words',       label: '📖 生字',  hasGroup: false }
];

/* ════════════════════════════
   進入點
   ════════════════════════════ */
function loadEnglishTab() {
  if (!db || !currentTeacher) { setTimeout(loadEnglishTab, 300); return; }
  _enGrade = ''; _enSection = ''; _enUnit = '';
  _enRenderGrade();
}

/* ════════════════════════════
   Step 1：年級選擇
   ════════════════════════════ */
function _enRenderGrade() {
  var wrap = document.getElementById('en-main');
  if (!wrap) return;
  var html = '<div class="card-title" style="margin-bottom:14px">選擇年級</div><div class="wi-btn-grid">';
  _EN_GRADES.forEach(function(g) {
    html += '<button class="wi-grade-btn" onclick="_enSelectGrade(\'' + _enEsc(g) + '\')">' + _enEsc(g) + '</button>';
  });
  html += '</div>';
  wrap.innerHTML = html;
}

function _enSelectGrade(grade) { _enGrade = grade; _enRenderSection(); }

/* ════════════════════════════
   Step 2：Section 選擇
   ════════════════════════════ */
function _enRenderSection() {
  var wrap = document.getElementById('en-main');
  if (!wrap) return;
  var html = '<button class="wi-back-btn" onclick="_enRenderGrade()">← 返回年級</button>' +
    '<div class="card-title" style="margin:12px 0 14px">' + _enEsc(_enGrade) + '　選擇項目</div>' +
    '<div class="wi-btn-grid">';
  _EN_SECTIONS.forEach(function(s) {
    html += '<button class="wi-grade-btn" onclick="_enSelectSection(\'' + s.key + '\')">' + s.label + '</button>';
  });
  html += '</div>';
  wrap.innerHTML = html;
}

function _enSelectSection(section) { _enSection = section; _enRenderUnitList(); }

/* ════════════════════════════
   Step 3：Unit 列表
   ════════════════════════════ */
function _enRenderUnitList() {
  var wrap = document.getElementById('en-main');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  var secLabel = (_EN_SECTIONS.find(function(s){ return s.key === _enSection; }) || {}).label || _enSection;

  /* 同時查 englishImages（計數）和 englishUnits（可能有 0 張但已建的單元）*/
  Promise.all([
    db.collection('englishImages')
      .where('grade',   '==', _enGrade)
      .where('section', '==', _enSection)
      .get(),
    db.collection('englishUnits')
      .where('grade',   '==', _enGrade)
      .where('section', '==', _enSection)
      .get()
  ]).then(function(results) {
    var unitMap = {};

    results[0].forEach(function(doc) {
      var d = doc.data();
      if (d.unit) {
        if (!unitMap[d.unit]) unitMap[d.unit] = { unitName: d.unitName || d.unit, count: 0 };
        unitMap[d.unit].count++;
      }
    });
    results[1].forEach(function(doc) {
      var d = doc.data();
      if (d.unit && !unitMap[d.unit]) {
        unitMap[d.unit] = { unitName: d.unitName || d.unit, count: 0 };
      }
    });

    var units = Object.keys(unitMap).sort(function(a, b) {
      var na = parseInt(a.replace(/\D+/g,''), 10), nb = parseInt(b.replace(/\D+/g,''), 10);
      return (isNaN(na) || isNaN(nb)) ? a.localeCompare(b) : na - nb;
    });

    var html = '<button class="wi-back-btn" onclick="_enRenderSection()">← 返回項目</button>' +
      '<div style="display:flex;align-items:center;gap:12px;margin:12px 0 16px;flex-wrap:wrap">' +
        '<div class="card-title" style="margin:0">' + _enEsc(_enGrade) + '　' + _enEsc(secLabel) + '</div>' +
      '</div>';

    if (units.length) {
      html += '<div class="wi-btn-grid" style="margin-bottom:20px">';
      units.forEach(function(u) {
        var info = unitMap[u];
        html += '<button class="wi-grade-btn" onclick="_enSelectUnit(\'' + _enEsc(u) + '\',\'' + _enEsc(info.unitName) + '\')">' +
          _enEsc(u) + '<br><span style="font-size:.72rem;font-weight:700;color:var(--muted)">' +
          _enEsc(info.unitName) + '・' + info.count + ' 張</span></button>';
      });
      html += '</div>';
    }

    html += _enNewUnitForm();
    wrap.innerHTML = html;
  }).catch(function(e) {
    wrap.innerHTML = '<p style="color:var(--red)">載入失敗：' + e.message + '</p>';
  });
}

function _enNewUnitForm() {
  return '<div style="border:2px dashed var(--border);border-radius:14px;padding:18px;margin-top:8px">' +
    '<div style="font-size:.9rem;font-weight:800;margin-bottom:12px;color:var(--blue-dk)">＋ 新增 / 進入單元</div>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">' +
      '<div>' +
        '<label style="font-size:.75rem;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">單元編號（如 Unit 1）</label>' +
        '<input id="en-new-unit" type="text" placeholder="Unit 1" style="' + _enInputStyle() + '">' +
      '</div>' +
      '<div>' +
        '<label style="font-size:.75rem;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">單元名稱（如 sh, ch）</label>' +
        '<input id="en-new-unit-name" type="text" placeholder="sh, ch" style="' + _enInputStyle() + '">' +
      '</div>' +
      '<button onclick="_enGoUnit()" style="' + _enBtnStyle('var(--blue)') + '">進入 →</button>' +
    '</div>' +
  '</div>';
}

function _enGoUnit() {
  var u    = ((document.getElementById('en-new-unit')      || {}).value || '').trim();
  var name = ((document.getElementById('en-new-unit-name') || {}).value || '').trim();
  if (!u) { showToast('請輸入單元編號'); return; }
  _enSelectUnit(u, name || u);
}

/* ════════════════════════════
   Step 4：Unit 詳細（圖庫＋組合管理）
   ════════════════════════════ */
function _enSelectUnit(unit, unitName) {
  _enUnit     = unit;
  _enUnitName = unitName;
  _enLoadUnitData();
}

function _enLoadUnitData() {
  var wrap = document.getElementById('en-main');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  var unitDocId = _enGrade + '_' + _enSection + '_' + _enUnit;

  Promise.all([
    db.collection('englishUnits').doc(unitDocId).get(),
    db.collection('englishImages')
      .where('grade',   '==', _enGrade)
      .where('section', '==', _enSection)
      .where('unit',    '==', _enUnit)
      .get()
  ]).then(function(results) {
    var unitDoc = results[0];
    _enGroups = (unitDoc.exists && Array.isArray(unitDoc.data().phoneticGroups))
      ? unitDoc.data().phoneticGroups.slice()
      : [];

    _enItems = [];
    results[1].forEach(function(doc) {
      var d = doc.data();
      _enItems.push({ docId: doc.id, word: d.word || '', phoneticGroup: d.phoneticGroup || '', imageUrl: d.imageUrl || '' });
    });
    _enItems.sort(function(a,b){ return a.word.localeCompare(b.word); });

    _enRenderUnitGrid();
  }).catch(function(e) {
    wrap.innerHTML = '<p style="color:var(--red)">載入失敗：' + e.message + '</p>';
  });
}

function _enRenderUnitGrid() {
  var wrap = document.getElementById('en-main');
  if (!wrap) return;
  var secMeta  = _EN_SECTIONS.find(function(s){ return s.key === _enSection; }) || {};
  var hasGroup = !!secMeta.hasGroup;
  var secLabel = secMeta.label || _enSection;
  var totalImgs = _enItems.filter(function(x){ return x.imageUrl; }).length;

  var html = '<button class="wi-back-btn" onclick="_enRenderUnitList()">← 返回單元列表</button>' +
    '<div style="display:flex;align-items:center;gap:12px;margin:12px 0 16px;flex-wrap:wrap">' +
      '<div class="card-title" style="margin:0">' + _enEsc(_enGrade) + '　' + _enEsc(secLabel) + '　' + _enEsc(_enUnit) +
        (_enUnitName && _enUnitName !== _enUnit ? '：' + _enEsc(_enUnitName) : '') + '</div>' +
      '<span style="font-size:.82rem;font-weight:700;color:var(--muted)">' + totalImgs + ' 張圖片</span>' +
    '</div>';

  if (hasGroup) {
    /* ── 發音組合管理列 ── */
    html += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:20px;' +
      'padding:12px 14px;background:var(--blue-lt);border-radius:12px">' +
      '<span style="font-size:.78rem;font-weight:800;color:var(--blue-dk);white-space:nowrap">發音組合：</span>';

    _enGroups.forEach(function(g) {
      html += '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px 4px 14px;' +
        'background:var(--blue);color:white;border-radius:20px;font-size:.88rem;font-weight:800;' +
        'font-family:\'Courier New\',monospace">' + _enEsc(g) +
        '<button onclick="_enDeleteGroup(\'' + _enEsc(g) + '\')" ' +
          'style="background:none;border:none;color:rgba(255,255,255,.75);cursor:pointer;' +
          'font-size:1rem;padding:0 0 0 4px;line-height:1;display:inline-flex;align-items:center">×</button>' +
        '</span>';
    });

    html += '<div style="display:flex;gap:6px;align-items:center">' +
      '<input id="en-new-group-input" type="text" placeholder="新增（如 th）" ' +
        'onkeydown="if(event.key===\'Enter\')_enAddGroup()" ' +
        'style="' + _enInputStyle('110px') + ';font-family:\'Courier New\',monospace">' +
      '<button onclick="_enAddGroup()" title="新增組合" ' +
        'style="' + _enBtnStyle('var(--blue-dk)') + ';padding:7px 13px;font-size:.9rem">＋</button>' +
    '</div></div>';

    /* ── 各 group 區塊 ── */
    if (_enGroups.length === 0) {
      html += '<div style="padding:20px 0;color:var(--muted);font-size:.88rem;font-weight:700">' +
        '尚未設定發音組合，請先新增組合後再上傳圖片。</div>';
    } else {
      _enGroups.forEach(function(group) {
        var groupItems = _enItems.filter(function(x){ return x.phoneticGroup === group; });
        html += _enRenderGroupSection(group, groupItems);
      });
      /* 未分類（group 不在 _enGroups 中的）*/
      var orphans = _enItems.filter(function(x){
        return !x.phoneticGroup || _enGroups.indexOf(x.phoneticGroup) === -1;
      });
      if (orphans.length) html += _enRenderGroupSection('（未分類）', orphans);
    }

  } else {
    /* ── 非 phonics：平鋪網格 ── */
    html += '<div class="wi-word-grid" style="margin-bottom:16px">';
    _enItems.forEach(function(item, i){ html += _enItemCardHtml(item, i); });
    html += '</div>' +
      '<button onclick="_enOpenUploadNew(\'\')" style="' + _enBtnStyle('var(--blue)') + '">＋ 新增圖片</button>';
  }

  wrap.innerHTML = html;
}

function _enRenderGroupSection(group, items) {
  var isOrphan = group === '（未分類）';
  var html = '<div style="margin-bottom:24px">' +
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">' +
      '<span style="font-size:1rem;font-weight:900;color:var(--blue-dk);font-family:\'Courier New\',monospace;' +
        'background:var(--blue-lt);padding:4px 16px;border-radius:20px">' + _enEsc(group) + '</span>' +
      '<span style="font-size:.78rem;font-weight:700;color:var(--muted)">' + items.length + ' 張</span>';
  if (!isOrphan) {
    html += '<button onclick="_enOpenUploadNew(\'' + _enEsc(group) + '\')" ' +
      'style="margin-left:auto;' + _enBtnStyle('var(--blue)') + ';padding:6px 16px;font-size:.8rem">＋ 新增</button>';
  }
  html += '</div><div class="wi-word-grid">';
  items.forEach(function(item) { html += _enItemCardHtml(item, _enItems.indexOf(item)); });
  html += '</div></div>';
  return html;
}

function _enItemCardHtml(item, i) {
  var html = '<div class="wi-word-card">';
  if (item.imageUrl) {
    html += '<div class="wi-img-wrap" onclick="_enOpenUploadReplace(' + i + ')">' +
      '<img src="' + _enEscAttr(item.imageUrl) + '" alt="">' +
      '<div class="wi-img-overlay"><span>更換圖片</span></div></div>';
  } else {
    html += '<div class="wi-img-empty" onclick="_enOpenUploadReplace(' + i + ')">' +
      '<div class="wi-img-empty-icon">📷</div>' +
      '<div style="font-size:.72rem;color:var(--muted);font-weight:700">點此上傳</div></div>';
  }
  html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px 4px">' +
    '<span style="font-size:.95rem;font-weight:900;color:var(--text);font-family:\'Courier New\',monospace">' +
    _enEsc(item.word) + '</span></div>';
  html += '<div style="display:flex;gap:6px;padding:0 8px 8px">' +
    '<button class="wi-search-btn" onclick="event.stopPropagation();_enSearchItem(' + i + ')">搜圖</button>' +
    '<button class="wi-del-btn" style="margin-left:auto" onclick="event.stopPropagation();_enDeleteItem(' + i + ')">刪除</button>' +
    '</div></div>';
  return html;
}

/* ════════════════════════════
   發音組合管理
   ════════════════════════════ */
function _enSaveGroups() {
  var unitDocId = _enGrade + '_' + _enSection + '_' + _enUnit;
  db.collection('englishUnits').doc(unitDocId).set({
    grade: _enGrade, section: _enSection,
    unit: _enUnit, unitName: _enUnitName,
    phoneticGroups: _enGroups
  }).catch(function(e){ console.warn('saveGroups error:', e); });
}

function _enAddGroup() {
  var input = document.getElementById('en-new-group-input');
  var val   = (input ? input.value.trim().toLowerCase() : '');
  if (!val) return;
  if (_enGroups.indexOf(val) !== -1) { showToast('此組合已存在'); return; }
  _enGroups.push(val);
  _enSaveGroups();
  _enRenderUnitGrid();
}

function _enDeleteGroup(group) {
  var idx = _enGroups.indexOf(group);
  if (idx === -1) return;
  if (!confirm('移除「' + group + '」組合？（已上傳的圖片不會刪除）')) return;
  _enGroups.splice(idx, 1);
  _enSaveGroups();
  _enRenderUnitGrid();
}

/* ════════════════════════════
   Modal：開啟 / 關閉 / 重設
   ════════════════════════════ */
function _enOpenUploadNew(group) {
  _enUploadIdx   = -1;
  _enIsNewImage  = true;
  _enUploadGroup = group;
  _enPendingBlob = null;

  document.getElementById('en-modal-title').textContent = '新增圖片';

  var wordWrap  = document.getElementById('en-modal-word-wrap');
  var wordInput = document.getElementById('en-modal-word');
  if (wordWrap)  wordWrap.style.display  = '';
  if (wordInput) { wordInput.value = ''; wordInput.readOnly = false; }

  _enUpdateModalGroups();
  _enResetModal();
  document.getElementById('en-upload-modal').style.display = 'flex';
  if (wordInput) wordInput.focus();
}

function _enOpenUploadReplace(idx) {
  _enUploadIdx   = idx;
  _enIsNewImage  = false;
  _enPendingBlob = null;
  var item = _enItems[idx] || {};
  _enUploadGroup = item.phoneticGroup || (_enGroups[0] || '');

  document.getElementById('en-modal-title').textContent = '更換圖片：' + (item.word || '');

  var wordWrap  = document.getElementById('en-modal-word-wrap');
  var wordInput = document.getElementById('en-modal-word');
  if (wordWrap)  wordWrap.style.display = 'none';
  if (wordInput) wordInput.value = item.word || '';

  _enUpdateModalGroups();
  _enResetModal();
  document.getElementById('en-upload-modal').style.display = 'flex';
}

function _enUpdateModalGroups() {
  var groupsWrap = document.getElementById('en-modal-groups');
  var chipsEl    = document.getElementById('en-modal-group-chips');
  if (!groupsWrap || !chipsEl) return;

  var secMeta  = _EN_SECTIONS.find(function(s){ return s.key === _enSection; }) || {};
  var hasGroup = !!secMeta.hasGroup;
  groupsWrap.style.display = (hasGroup && _enGroups.length) ? '' : 'none';

  chipsEl.innerHTML = _enGroups.map(function(g) {
    var active = g === _enUploadGroup;
    return '<button onclick="_enSelectModalGroup(\'' + _enEsc(g) + '\')" ' +
      'style="padding:5px 16px;border-radius:20px;cursor:pointer;font-family:\'Courier New\',monospace;' +
      'font-size:.9rem;font-weight:900;transition:all .15s;' +
      (active
        ? 'border:2px solid var(--blue);background:var(--blue);color:white'
        : 'border:2px solid var(--border);background:white;color:var(--text)') +
      '">' + _enEsc(g) + '</button>';
  }).join('');
}

function _enSelectModalGroup(group) {
  _enUploadGroup = group;
  _enUpdateModalGroups();
}

function _enCloseUpload() {
  var modal = document.getElementById('en-upload-modal');
  if (modal) modal.style.display = 'none';
  _enPendingBlob = null;
}

function _enResetModal() {
  var previewImg = document.getElementById('en-preview-img');
  var pasteHint  = document.getElementById('en-paste-hint');
  var confirmBtn = document.getElementById('en-confirm-btn');
  var sizeWarn   = document.getElementById('en-size-warn');
  if (previewImg) { previewImg.style.display = 'none'; previewImg.src = ''; }
  if (pasteHint)  pasteHint.style.display = '';
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '確認上傳'; }
  if (sizeWarn)   sizeWarn.style.display = 'none';
}

/* ════════════════════════════
   貼上 / 拖放 / 選檔
   ════════════════════════════ */
document.addEventListener('paste', function(e) {
  var modal = document.getElementById('en-upload-modal');
  if (!modal || modal.style.display !== 'flex') return;
  var items = (e.clipboardData || {}).items || [];
  for (var i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      e.preventDefault();
      var blob = items[i].getAsFile();
      if (blob) _enShowPreview(blob);
      return;
    }
  }
});

function _enHandleDrop(e) {
  e.preventDefault();
  e.currentTarget.style.borderColor = '';
  var files = e.dataTransfer && e.dataTransfer.files;
  if (files && files[0] && files[0].type.indexOf('image') !== -1) _enShowPreview(files[0]);
}

function _enFileSelected(input) {
  if (input.files[0]) _enShowPreview(input.files[0]);
}

function _enShowPreview(blob) {
  _enPendingBlob = blob;
  var url        = URL.createObjectURL(blob);
  var previewImg = document.getElementById('en-preview-img');
  var pasteHint  = document.getElementById('en-paste-hint');
  var confirmBtn = document.getElementById('en-confirm-btn');
  if (previewImg) {
    previewImg.onload = function(){ URL.revokeObjectURL(url); };
    previewImg.src    = url;
    previewImg.style.display = 'block';
  }
  if (pasteHint)  pasteHint.style.display  = 'none';
  if (confirmBtn) confirmBtn.disabled = false;
}

/* ════════════════════════════
   確認上傳
   ════════════════════════════ */
function _enConfirmUpload() {
  if (!_enPendingBlob) return;

  var isNew  = _enIsNewImage;
  var word   = isNew
    ? ((document.getElementById('en-modal-word') || {}).value || '').trim()
    : (_enItems[_enUploadIdx] || {}).word || '';
  var group  = _enUploadGroup;

  if (isNew && !word) { showToast('請輸入英文單字'); return; }

  var secMeta  = _EN_SECTIONS.find(function(s){ return s.key === _enSection; }) || {};
  if (secMeta.hasGroup && _enGroups.length && !group) { showToast('請選擇發音組合'); return; }

  var confirmBtn = document.getElementById('en-confirm-btn');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '處理中…'; }

  _wiCompressToDataUrl(_enPendingBlob, 800, 0.82, function(dataUrl) {
    var sizeKB = Math.round(dataUrl.length / 1024);
    if (sizeKB > 900) {
      var sizeWarn = document.getElementById('en-size-warn');
      if (sizeWarn) { sizeWarn.textContent = '⚠️ 圖片壓縮後約 ' + sizeKB + ' KB，建議使用較小的圖片。'; sizeWarn.style.display = ''; }
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = '確認上傳'; }
      return;
    }

    var docData = {
      teacherUid:    currentTeacher.uid,
      grade:         _enGrade,
      section:       _enSection,
      unit:          _enUnit,
      unitName:      _enUnitName,
      word:          word,
      phoneticGroup: (secMeta.hasGroup ? group : ''),
      imageUrl:      dataUrl,
      uploadedAt:    new Date().toISOString()
    };

    var promise = (!isNew && _enItems[_enUploadIdx] && _enItems[_enUploadIdx].docId)
      ? db.collection('englishImages').doc(_enItems[_enUploadIdx].docId).set(docData)
      : db.collection('englishImages').add(docData);

    promise.then(function() {
      showToast('✅ 圖片已儲存：' + word);
      _enCloseUpload();
      _enLoadUnitData();
    }).catch(function(e) {
      showToast('❌ 儲存失敗：' + e.message);
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = '確認上傳'; }
    });
  });
}

/* ════════════════════════════
   刪除
   ════════════════════════════ */
function _enDeleteItem(idx) {
  var item = _enItems[idx];
  if (!item || !item.docId) return;
  if (!confirm('確定要刪除「' + item.word + '」嗎？')) return;
  db.collection('englishImages').doc(item.docId).delete()
    .then(function(){ showToast('已刪除「' + item.word + '」'); _enLoadUnitData(); })
    .catch(function(e){ showToast('❌ 刪除失敗：' + e.message); });
}

/* ════════════════════════════
   搜圖
   ════════════════════════════ */
function _enSearchItem(idx) {
  var item = _enItems[idx];
  if (!item) return;
  window.open('https://www.google.com/search?q=' + encodeURIComponent(item.word) + '&tbm=isch', '_blank');
}

function _enModalSearch() {
  var word = _enIsNewImage
    ? ((document.getElementById('en-modal-word') || {}).value || '').trim()
    : (_enItems[_enUploadIdx] || {}).word || '';
  if (!word) { showToast('請先輸入英文單字'); return; }
  window.open('https://www.google.com/search?q=' + encodeURIComponent(word) + '&tbm=isch', '_blank');
}

/* ════════════════════════════
   Helpers
   ════════════════════════════ */
function _enEsc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function _enEscAttr(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;')
    .replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;');
}

function _enInputStyle(w) {
  return 'padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;' +
    'font-size:.88rem;font-family:inherit;outline:none;width:' + (w || '160px') + ';box-sizing:border-box';
}

function _enBtnStyle(bg) {
  return 'padding:9px 18px;background:' + bg + ';color:white;border:none;border-radius:8px;' +
    'font-size:.85rem;font-weight:800;cursor:pointer;font-family:inherit;white-space:nowrap';
}
