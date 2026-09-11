/**
 * admin/radical-groups.js — 部件趣：部件資料庫（每個部件一筆全校共用資料）
 * 取代舊的 radicalSets/radicalItems（練習集）與 radicalMeanings（意象圖庫），
 * 統一成 radicalGroups：{ title, variant, imageUrl, phrase, chars[] }，文件 ID = 部件本身。
 * 依賴：shared.js（db、showToast、escHtml）、init.js（currentTeacher）、word-image.js（_wiCompressToDataUrl）
 */
'use strict';

var _rgGroups        = []; // [{radical, title, variant, imageUrl, phrase, chars}]
var _rgEditingRadical = ''; // '' = 新增
var _rgWorkingChars   = []; // 編輯中的字清單
var _rgPendingBlob    = null;

var RG_MAX_CHARS = 120;

/* ════════════════════════════════
   進入點（由 switchDbView 呼叫）
   ════════════════════════════════ */
function loadRadicalTab() {
  if (!db || !currentTeacher) { setTimeout(loadRadicalTab, 300); return; }
  _rgRenderRoot();
}

/* ════════════════════════════════
   部件列表
   ════════════════════════════════ */
function _rgRenderRoot() {
  var wrap = document.getElementById('rk-main');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  db.collection('radicalGroups').get().then(function(snap) {
    _rgGroups = [];
    snap.forEach(function(doc) {
      var d = doc.data();
      _rgGroups.push({
        radical: doc.id, title: d.title || (doc.id + '部'), variant: d.variant || '',
        imageUrl: d.imageUrl || '', phrase: d.phrase || '', chars: d.chars || []
      });
    });
    _rgGroups.sort(function(a, b) { return a.radical.localeCompare(b.radical, 'zh-TW'); });

    var html =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;flex-wrap:wrap;gap:8px">' +
        '<div class="card-title" style="margin:0">🧩 部件資料庫' +
          '<span style="font-size:.72rem;font-weight:700;color:var(--muted);margin-left:8px">全校共用・目前 ' + _rgGroups.length + ' 個部件</span>' +
        '</div>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-secondary" style="padding:7px 14px;font-size:.8rem" onclick="_rgMigrateOldData()">🔄 匯入舊資料</button>' +
          '<button class="wi-cat-add-btn" onclick="_rgOpenBuilder()">＋ 新增部件</button>' +
        '</div>' +
      '</div>' +
      '<p style="font-size:.78rem;color:var(--muted);margin-bottom:16px;line-height:1.6">' +
        '每個部件一筆資料，全校老師共用、可以共同編輯；包含這個部件的字、意象圖片、口訣。' +
        '「匯入舊資料」會把之前用練習集／意象圖庫建立的內容自動合併進來（可重複點擊，已匯入的不會重複）。' +
      '</p>' +
      '<div id="rg-migrate-status" style="font-size:.78rem;color:var(--muted);font-weight:700;margin-bottom:10px"></div>';

    if (!_rgGroups.length) {
      html += '<div class="wi-cat-empty">尚未建立任何部件。點擊「＋ 新增部件」開始建立，或「🔄 匯入舊資料」自動帶入之前建立的內容。</div>';
    } else {
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px">' +
        _rgGroups.map(function(g) {
          var imgHtml = g.imageUrl
            ? '<img src="' + g.imageUrl + '" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;margin-bottom:8px">'
            : '<div style="width:100%;aspect-ratio:1;background:var(--gray-lt,#f5f5f5);border-radius:8px;margin-bottom:8px;' +
                'display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:.72rem">尚無意象圖</div>';
          return '<div style="border:1.5px solid var(--border);border-radius:12px;padding:12px;background:var(--white)">' +
            imgHtml +
            '<div style="display:flex;align-items:baseline;gap:6px;margin-bottom:2px">' +
              '<span style="font-weight:900;font-size:1.1rem">' + escHtml(g.title) + '</span>' +
              (g.variant ? '<span style="font-size:.78rem;color:var(--muted)">（' + escHtml(g.variant) + '）</span>' : '') +
            '</div>' +
            '<div style="font-size:.72rem;color:var(--muted);margin-bottom:10px">' + g.chars.length + ' 字' + (g.phrase ? '・有口訣' : '') + '</div>' +
            '<div style="display:flex;gap:6px">' +
              '<button class="wi-cat-enter-btn" style="flex:1" onclick="_rgOpenBuilder(\'' + _rgEscAttr(g.radical) + '\')">編輯 →</button>' +
              '<button class="wi-cat-del-icon" title="刪除" onclick="_rgDelete(\'' + _rgEscAttr(g.radical) + '\')">🗑</button>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>';
    }

    html += '<div id="rk-decomp-section" style="margin-top:28px;padding-top:20px;border-top:2px solid var(--border)"></div>';

    wrap.innerHTML = html;
    if (typeof _cdRenderSection === 'function') _cdRenderSection();
  }).catch(function(e) {
    wrap.innerHTML = '<p style="color:var(--red)">載入失敗：' + e.message + '</p>';
  });
}

/* ════════════════════════════════
   新增／編輯部件
   ════════════════════════════════ */
function _rgOpenBuilder(radical) {
  _rgEditingRadical = radical || '';
  _rgWorkingChars    = [];
  _rgPendingBlob     = null;
  var wrap = document.getElementById('rk-main');
  if (!wrap) return;

  if (!radical) { _rgRenderBuilder({ radical: '', title: '', variant: '', imageUrl: '', phrase: '' }); return; }

  var existing = _rgGroups.filter(function(g) { return g.radical === radical; })[0];
  if (!existing) { _rgRenderRoot(); return; }
  _rgWorkingChars = existing.chars.slice();
  _rgRenderBuilder(existing);
}

function _rgRenderBuilder(g) {
  var wrap = document.getElementById('rk-main');
  if (!wrap) return;
  var isNew = !_rgEditingRadical;

  var html =
    '<button class="wi-back-btn" onclick="_rgRenderRoot()">← 返回列表</button>' +
    '<div class="card-title" style="margin:12px 0 14px">' + (isNew ? '新增部件' : '編輯部件「' + escHtml(g.radical) + '」') + '</div>' +
    '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:16px">' +
      '<div>' +
        '<label style="display:block;font-size:.78rem;font-weight:800;color:var(--muted);margin-bottom:6px">部件（存檔後不能改）</label>' +
        '<input id="rg-radical" type="text" maxlength="2" value="' + _rgEscAttr(g.radical) + '" ' + (isNew ? '' : 'disabled') +
          ' oninput="_rgSyncTitleSuggestion()"' +
          ' style="width:70px;padding:9px;text-align:center;border:2px solid var(--border);border-radius:8px;font-size:1.2rem;font-family:inherit' +
          (isNew ? '' : ';background:var(--gray-lt,#f5f5f5)') + '">' +
      '</div>' +
      '<div>' +
        '<label style="display:block;font-size:.78rem;font-weight:800;color:var(--muted);margin-bottom:6px">標題</label>' +
        '<input id="rg-title" type="text" value="' + _rgEscAttr(g.title) + '" placeholder="例如：人部"' +
          ' style="width:140px;padding:9px 12px;border:2px solid var(--border);border-radius:8px;font-size:.95rem;font-family:inherit">' +
      '</div>' +
      '<div>' +
        '<label style="display:block;font-size:.78rem;font-weight:800;color:var(--muted);margin-bottom:6px">偏旁（變體寫法，選填）</label>' +
        '<input id="rg-variant" type="text" maxlength="2" value="' + _rgEscAttr(g.variant) + '" placeholder="例如：亻"' +
          ' style="width:70px;padding:9px;text-align:center;border:2px solid var(--border);border-radius:8px;font-size:1.1rem;font-family:inherit">' +
      '</div>' +
    '</div>' +
    '<div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap;margin-bottom:18px;padding:14px;border:2px dashed var(--border);border-radius:12px">' +
      '<div>' +
        '<label style="display:block;font-size:.72rem;font-weight:800;color:var(--muted);margin-bottom:4px">意象圖片</label>' +
        '<div style="display:flex;gap:6px;align-items:center">' +
          '<input id="rg-file" type="file" accept="image/*" onchange="_rgFileSelected(this)" style="font-size:.8rem;max-width:150px">' +
          '<button class="wi-search-btn" type="button" onclick="_rgOpenGoogleSearch()">搜圖</button>' +
        '</div>' +
        '<div style="font-size:.68rem;color:var(--muted);margin-top:3px">可直接貼上圖片（Ctrl+V）</div>' +
        '<div id="rg-preview-wrap" style="margin-top:6px">' +
          (g.imageUrl ? '<img src="' + g.imageUrl + '" style="width:60px;height:60px;object-fit:cover;border-radius:8px;border:1.5px solid var(--border)">' : '') +
        '</div>' +
      '</div>' +
      '<div style="flex:1;min-width:220px">' +
        '<label style="display:block;font-size:.72rem;font-weight:800;color:var(--muted);margin-bottom:4px">口訣（配對成功時會唸出來）</label>' +
        '<input id="rg-phrase" type="text" value="' + _rgEscAttr(g.phrase) + '" placeholder="例如：扌部，拍拍手，拍手的拍！"' +
          ' style="width:100%;padding:7px 10px;border:1.5px solid var(--border);border-radius:6px;font-family:inherit;font-size:.9rem">' +
      '</div>' +
    '</div>' +
    '<div style="margin-bottom:14px">' +
      '<label style="display:block;font-size:.78rem;font-weight:800;color:var(--muted);margin-bottom:6px">' +
        '加入國字（可一次貼上多字，系統自動去除重複與非國字）' +
      '</label>' +
      '<div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap">' +
        '<textarea id="rg-char-input" rows="2" placeholder="例如：他你們休作住位化"' +
          ' style="flex:1;min-width:220px;padding:9px 12px;border:2px solid var(--border);border-radius:8px;font-size:.95rem;font-family:inherit;resize:vertical"></textarea>' +
        '<button class="btn btn-secondary" onclick="_rgAddCharsBatch()">＋ 加入清單</button>' +
      '</div>' +
    '</div>' +
    '<div id="rg-char-list"></div>' +
    '<div style="margin-top:16px;display:flex;gap:10px">' +
      '<button class="btn btn-primary" onclick="_rgSave()">💾 儲存部件</button>' +
      '<button class="btn btn-secondary" onclick="_rgRenderRoot()">取消</button>' +
    '</div>';

  wrap.innerHTML = html;
  _rgRenderCharList();
}

function _rgSyncTitleSuggestion() {
  var radicalEl = document.getElementById('rg-radical');
  var titleEl   = document.getElementById('rg-title');
  if (!radicalEl || !titleEl || titleEl.value.trim()) return;
  var r = (radicalEl.value || '').trim();
  if (r) titleEl.value = r + '部';
}

function _rgOpenGoogleSearch() {
  var titleEl = document.getElementById('rg-title');
  var radicalEl = document.getElementById('rg-radical');
  var q = (titleEl && titleEl.value.trim()) || (radicalEl && radicalEl.value.trim()) || '';
  if (!q) { showToast('請先填寫部件或標題，才能搜圖'); return; }
  window.open('https://www.google.com/search?q=' + encodeURIComponent(q + ' 意思') + '&tbm=isch', '_blank');
}

function _rgFileSelected(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  _rgSetPreviewFromBlob(file);
}

function _rgSetPreviewFromBlob(blob) {
  _rgPendingBlob = blob;
  var url  = URL.createObjectURL(blob);
  var wrap = document.getElementById('rg-preview-wrap');
  if (wrap) {
    wrap.innerHTML = '<img src="' + url + '" style="width:60px;height:60px;object-fit:cover;border-radius:8px;border:1.5px solid var(--border)">';
  }
}

/* ── 貼上圖片（Ctrl+V）：只在部件編輯表單開著的時候處理，跟詞語圖庫一致 ── */
document.addEventListener('paste', function(e) {
  var fileEl = document.getElementById('rg-file');
  if (!fileEl) return;
  var items = (e.clipboardData || {}).items || [];
  for (var i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      e.preventDefault();
      var blob = items[i].getAsFile();
      if (blob) _rgSetPreviewFromBlob(blob);
      return;
    }
  }
});

/* ── 批次加入國字 ── */
function _rgAddCharsBatch() {
  var ta = document.getElementById('rg-char-input');
  if (!ta) return;
  var raw = ta.value || '';
  var existing = {};
  _rgWorkingChars.forEach(function(c) { existing[c] = true; });

  var added = [];
  for (var i = 0; i < raw.length; i++) {
    var c = raw[i];
    if (/[一-鿿㐀-䶿]/.test(c) && !existing[c]) {
      existing[c] = true;
      added.push(c);
      if (_rgWorkingChars.length + added.length >= RG_MAX_CHARS) break;
    }
  }
  if (!added.length) {
    showToast('沒有可加入的新字（可能都已在清單中，或超過上限 ' + RG_MAX_CHARS + ' 字）');
    return;
  }
  _rgWorkingChars = _rgWorkingChars.concat(added);
  ta.value = '';
  _rgRenderCharList();
}

function _rgRemoveChar(i) {
  _rgWorkingChars.splice(i, 1);
  _rgRenderCharList();
}

function _rgRenderCharList() {
  var el = document.getElementById('rg-char-list');
  if (!el) return;
  if (!_rgWorkingChars.length) {
    el.innerHTML = '<div class="wi-cat-empty" style="font-size:.82rem">尚未加入任何字</div>';
    return;
  }
  el.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:6px">' +
    _rgWorkingChars.map(function(c, i) {
      return '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 6px 4px 10px;border:1.5px solid var(--border);border-radius:20px;font-size:.95rem;font-weight:800">' +
        escHtml(c) +
        '<button onclick="_rgRemoveChar(' + i + ')" style="border:none;background:none;color:var(--red,#e53e3e);cursor:pointer;font-size:.85rem;padding:2px 4px">✕</button>' +
      '</span>';
    }).join('') +
  '</div>';
}

/* ── 儲存部件 ── */
function _rgSave() {
  var radicalEl = document.getElementById('rg-radical');
  var titleEl   = document.getElementById('rg-title');
  var variantEl = document.getElementById('rg-variant');
  var phraseEl  = document.getElementById('rg-phrase');

  var radical = _rgEditingRadical || (radicalEl.value || '').trim();
  var title   = (titleEl.value   || '').trim() || (radical + '部');
  var variant = (variantEl.value || '').trim();
  var phrase  = (phraseEl.value  || '').trim();

  if (!radical) { showToast('請填寫部件'); return; }
  if (Array.from(radical).length !== 1) { showToast('部件只能填一個字元'); return; }
  if (!_rgEditingRadical && _rgGroups.some(function(g) { return g.radical === radical; })) {
    showToast('這個部件已經存在，請直接編輯它'); return;
  }

  function doSave(imageUrl) {
    var existing = _rgGroups.filter(function(g) { return g.radical === radical; })[0];
    var data = {
      title: title, variant: variant, phrase: phrase,
      imageUrl: imageUrl || (existing ? existing.imageUrl : ''),
      chars: _rgWorkingChars
    };
    db.collection('radicalGroups').doc(radical).set(data).then(function() {
      showToast('✅ 已儲存「' + title + '」');
      _rgRenderRoot();
    }).catch(function(e) { showToast('❌ 儲存失敗：' + e.message); });
  }

  if (_rgPendingBlob) {
    _wiCompressToDataUrl(_rgPendingBlob, 500, 0.82, function(dataUrl) { doSave(dataUrl); });
  } else {
    doSave(null);
  }
}

function _rgDelete(radical) {
  var g = _rgGroups.filter(function(x) { return x.radical === radical; })[0];
  var title = g ? g.title : radical;
  if (!confirm('確定要刪除「' + title + '」嗎？裡面的字、圖片、口訣都會一併刪除，此操作無法復原。')) return;

  db.collection('radicalGroups').doc(radical).delete().then(function() {
    showToast('✅ 已刪除「' + title + '」');
    _rgRenderRoot();
  }).catch(function(e) { showToast('❌ 刪除失敗：' + e.message); });
}

/* ════════════════════════════════
   匯入舊資料（練習集 + 意象圖庫 → 部件資料庫）
   ════════════════════════════════ */
function _rgMigrateOldData() {
  var statusEl = document.getElementById('rg-migrate-status');
  if (statusEl) statusEl.textContent = '匯入中…';

  Promise.all([
    db.collection('radicalItems').get(),
    db.collection('radicalMeanings').get(),
    db.collection('radicalGroups').get()
  ]).then(function(results) {
    var charMap = {}; // radical -> Set of chars（用物件模擬）
    results[0].forEach(function(doc) {
      var d = doc.data();
      if (!d.radical || !d.char) return;
      if (!charMap[d.radical]) charMap[d.radical] = {};
      charMap[d.radical][d.char] = true;
    });

    var meaningMap = {}; // radical -> {imageUrl, phrase}
    results[1].forEach(function(doc) {
      meaningMap[doc.id] = doc.data();
    });

    var existingMap = {}; // radical -> 現有 radicalGroups 資料
    results[2].forEach(function(doc) {
      existingMap[doc.id] = doc.data();
    });

    var allRadicals = {};
    Object.keys(charMap).forEach(function(r) { allRadicals[r] = true; });
    Object.keys(meaningMap).forEach(function(r) { allRadicals[r] = true; });

    var radicals = Object.keys(allRadicals);
    if (!radicals.length) {
      if (statusEl) statusEl.textContent = '沒有舊資料可以匯入。';
      return;
    }

    var batch = db.batch(), count = 0, batches = [];
    var mergedCount = 0;
    radicals.forEach(function(r) {
      var existing   = existingMap[r] || {};
      var oldChars   = charMap[r] ? Object.keys(charMap[r]) : [];
      var mergedChars = existing.chars || [];
      var seen = {}; mergedChars.forEach(function(c) { seen[c] = true; });
      oldChars.forEach(function(c) { if (!seen[c]) { seen[c] = true; mergedChars.push(c); } });

      var meaning = meaningMap[r] || {};
      var data = {
        title:    existing.title    || (r + '部'),
        variant:  existing.variant  || '',
        imageUrl: existing.imageUrl || meaning.imageUrl || '',
        phrase:   existing.phrase   || meaning.phrase   || '',
        chars:    mergedChars
      };
      batch.set(db.collection('radicalGroups').doc(r), data);
      mergedCount++;
      if (++count % 499 === 0) { batches.push(batch); batch = db.batch(); }
    });
    batches.push(batch);

    return Promise.all(batches.map(function(b) { return b.commit(); })).then(function() {
      if (statusEl) statusEl.textContent = '';
      showToast('✅ 已匯入／合併 ' + mergedCount + ' 個部件');
      _rgRenderRoot();
    });
  }).catch(function(e) {
    if (statusEl) statusEl.textContent = '';
    showToast('❌ 匯入失敗：' + e.message);
  });
}

/* ── 工具函式 ── */
function _rgEscAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
}
