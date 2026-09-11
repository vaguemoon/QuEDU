/**
 * admin/char-decomp.js — 部件趣：拆字資料庫（部件拼貼遊戲用，全校共用資料）
 * 依賴：shared.js（db、showToast、escHtml）
 * 渲染進 radical-groups.js 的 #rk-decomp-section 容器
 */
'use strict';

var _cdItems = []; // [{char, type:'lr'|'tb', first, second}]

var CD_IDS_URL = 'https://cdn.jsdelivr.net/gh/cjkvi/cjkvi-ids@master/ids.txt';

/* ════════════════════════════════
   清單渲染
   ════════════════════════════════ */
function _cdRenderSection() {
  var host = document.getElementById('rk-decomp-section');
  if (!host) return;
  host.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  db.collection('charDecompositions').get().then(function(snap) {
    _cdItems = [];
    snap.forEach(function(doc) {
      var d = doc.data();
      var first  = d.type === 'tb' ? (d.top    || '') : (d.left  || '');
      var second = d.type === 'tb' ? (d.bottom || '') : (d.right || '');
      _cdItems.push({ char: doc.id, type: d.type === 'tb' ? 'tb' : 'lr', first: first, second: second });
    });
    _cdItems.sort(function(a, b) { return a.char.localeCompare(b.char, 'zh-TW'); });
    _cdRenderSectionHtml();
  }).catch(function(e) {
    host.innerHTML = '<p style="color:var(--red)">載入失敗：' + e.message + '</p>';
  });
}

function _cdRenderSectionHtml() {
  var host = document.getElementById('rk-decomp-section');
  if (!host) return;

  host.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">' +
      '<div class="card-title" style="margin:0">🔤 拆字資料庫' +
        '<span style="font-size:.72rem;font-weight:700;color:var(--muted);margin-left:8px">部件拼貼遊戲用，全校共用・目前 ' + _cdItems.length + ' 字</span>' +
      '</div>' +
      '<button class="wi-cat-add-btn" id="cd-scan-btn" onclick="_cdScanAndGenerate()">🔄 掃描並自動產生拆字資料</button>' +
    '</div>' +
    '<p style="font-size:.78rem;color:var(--muted);margin-bottom:10px;line-height:1.6">' +
      '掃描所有課本課次的生字與老師自建部件的字，比對開放的漢字拆解資料庫，自動產生「左右」或「上下」乾淨兩塊的拆法。' +
      '獨體字、三個部件以上、包圍結構等查不到乾淨拆法的字會略過，不會出現在部件拼貼遊戲裡；可以在下方手動新增或修正。' +
    '</p>' +
    '<div id="cd-scan-status" style="font-size:.78rem;color:var(--muted);font-weight:700;margin-bottom:10px"></div>' +
    '<div style="margin-bottom:14px;display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">' +
      '<div><label style="display:block;font-size:.72rem;font-weight:800;color:var(--muted);margin-bottom:4px">字</label>' +
        '<input id="cd-add-char" maxlength="2" style="width:52px;padding:7px;text-align:center;border:1.5px solid var(--border);border-radius:6px;font-family:inherit;font-size:1rem"></div>' +
      '<div><label style="display:block;font-size:.72rem;font-weight:800;color:var(--muted);margin-bottom:4px">結構</label>' +
        '<select id="cd-add-type" onchange="_cdUpdateAddLabels()" style="padding:7px;border:1.5px solid var(--border);border-radius:6px;font-family:inherit">' +
          '<option value="lr">左右</option><option value="tb">上下</option>' +
        '</select></div>' +
      '<div><label style="display:block;font-size:.72rem;font-weight:800;color:var(--muted);margin-bottom:4px" id="cd-add-first-label">左半部</label>' +
        '<input id="cd-add-first" maxlength="2" style="width:52px;padding:7px;text-align:center;border:1.5px solid var(--border);border-radius:6px;font-family:inherit;font-size:1rem"></div>' +
      '<div><label style="display:block;font-size:.72rem;font-weight:800;color:var(--muted);margin-bottom:4px" id="cd-add-second-label">右半部</label>' +
        '<input id="cd-add-second" maxlength="2" style="width:52px;padding:7px;text-align:center;border:1.5px solid var(--border);border-radius:6px;font-family:inherit;font-size:1rem"></div>' +
      '<button class="btn btn-secondary" onclick="_cdSaveManual()">＋ 新增／覆寫</button>' +
    '</div>' +
    '<div id="cd-list-wrap">' + _cdBuildListHtml() + '</div>';
}

function _cdUpdateAddLabels() {
  var typeSel = document.getElementById('cd-add-type');
  var l1 = document.getElementById('cd-add-first-label');
  var l2 = document.getElementById('cd-add-second-label');
  var tb = typeSel && typeSel.value === 'tb';
  if (l1) l1.textContent = tb ? '上半部' : '左半部';
  if (l2) l2.textContent = tb ? '下半部' : '右半部';
}

function _cdBuildListHtml() {
  if (!_cdItems.length) {
    return '<div class="wi-cat-empty">尚未有任何拆字資料，點上方按鈕自動產生，或手動新增。</div>';
  }
  return '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">' +
    '<tr>' +
      '<th style="text-align:left;padding:6px 10px;border-bottom:2px solid var(--border);font-size:.72rem;font-weight:800;color:var(--muted)">字</th>' +
      '<th style="text-align:left;padding:6px 10px;border-bottom:2px solid var(--border);font-size:.72rem;font-weight:800;color:var(--muted)">結構</th>' +
      '<th style="text-align:left;padding:6px 10px;border-bottom:2px solid var(--border);font-size:.72rem;font-weight:800;color:var(--muted)">拆法</th>' +
      '<th style="border-bottom:2px solid var(--border)"></th>' +
    '</tr>' +
    _cdItems.map(function(item, i) {
      return '<tr style="background:' + (i % 2 === 0 ? 'var(--gray-lt)' : '#fff') + '">' +
        '<td style="padding:6px 10px;border-bottom:1px solid var(--border);font-weight:900;font-size:1.05rem">' + escHtml(item.char) + '</td>' +
        '<td style="padding:6px 10px;border-bottom:1px solid var(--border)">' + (item.type === 'tb' ? '上下' : '左右') + '</td>' +
        '<td style="padding:6px 10px;border-bottom:1px solid var(--border)">' + escHtml(item.first) + '　+　' + escHtml(item.second) + '</td>' +
        '<td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:right">' +
          '<button onclick="_cdDeleteChar(\'' + _cdEscAttr(item.char) + '\')" style="padding:2px 8px;border:1.5px solid var(--red,#e53e3e);border-radius:6px;background:white;color:var(--red,#e53e3e);font-size:.72rem;font-weight:700;cursor:pointer;font-family:inherit">刪除</button>' +
        '</td>' +
      '</tr>';
    }).join('') +
  '</table></div>';
}

/* ════════════════════════════════
   手動新增／覆寫
   ════════════════════════════════ */
function _cdSaveManual() {
  var charEl   = document.getElementById('cd-add-char');
  var typeEl   = document.getElementById('cd-add-type');
  var firstEl  = document.getElementById('cd-add-first');
  var secondEl = document.getElementById('cd-add-second');
  var char   = (charEl.value   || '').trim();
  var type   = typeEl.value === 'tb' ? 'tb' : 'lr';
  var first  = (firstEl.value  || '').trim();
  var second = (secondEl.value || '').trim();

  if (!char || !first || !second) { showToast('請填寫字與兩個部件'); return; }
  if (Array.from(char).length !== 1 || Array.from(first).length !== 1 || Array.from(second).length !== 1) {
    showToast('字與部件都只能填一個字元'); return;
  }

  var data = type === 'tb' ? { type: 'tb', top: first, bottom: second } : { type: 'lr', left: first, right: second };
  db.collection('charDecompositions').doc(char).set(data).then(function() {
    showToast('✅ 已儲存「' + char + '」的拆法');
    charEl.value = ''; firstEl.value = ''; secondEl.value = '';
    _cdRenderSection();
  }).catch(function(e) { showToast('❌ 儲存失敗：' + e.message); });
}

function _cdDeleteChar(char) {
  if (!confirm('確定要刪除「' + char + '」的拆字資料嗎？')) return;
  db.collection('charDecompositions').doc(char).delete().then(function() {
    showToast('✅ 已刪除');
    _cdRenderSection();
  }).catch(function(e) { showToast('❌ 刪除失敗：' + e.message); });
}

/* ════════════════════════════════
   一鍵掃描 + 自動產生
   ════════════════════════════════ */
function _cdScanAndGenerate() {
  var btn = document.getElementById('cd-scan-btn');
  var statusEl = document.getElementById('cd-scan-status');
  if (btn) { btn.disabled = true; btn.textContent = '掃描中…'; }
  if (statusEl) statusEl.textContent = '正在收集課本生字與老師自建部件的字…';

  Promise.all([
    _cdCollectCurriculumChars(),
    _cdCollectRadicalItemChars(),
    db.collection('charDecompositions').get()
  ]).then(function(results) {
    var chars = {};
    results[0].forEach(function(c) { chars[c] = true; });
    results[1].forEach(function(c) { chars[c] = true; });
    var existing = {};
    results[2].forEach(function(doc) { existing[doc.id] = true; });

    var needed = Object.keys(chars).filter(function(c) { return !existing[c]; });
    if (!needed.length) {
      if (statusEl) statusEl.textContent = '沒有新的字需要產生（都已經有拆字資料，或目前沒有生字資料）';
      _cdResetScanBtn(btn);
      return;
    }

    if (statusEl) statusEl.textContent = '需要查詢 ' + needed.length + ' 個新字，正在下載拆字資料庫…';

    fetch(CD_IDS_URL).then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    }).then(function(text) {
      var map = {};
      var lines = text.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var parsed = _cdParseIdsLine(lines[i].replace(/\r$/, ''));
        if (parsed && !map[parsed.char]) map[parsed.char] = parsed;
      }

      var resolved = [], skipped = [];
      needed.forEach(function(c) {
        if (map[c]) resolved.push(map[c]); else skipped.push(c);
      });

      if (!resolved.length) {
        if (statusEl) statusEl.textContent = '查詢完成，但這 ' + needed.length + ' 個字都沒有乾淨的拆法資料（可能是獨體字或結構太複雜），可以在下方手動新增。';
        _cdResetScanBtn(btn);
        return;
      }

      var batches = [], batch = db.batch(), count = 0;
      resolved.forEach(function(item) {
        var data = item.type === 'tb'
          ? { type: 'tb', top: item.a, bottom: item.b }
          : { type: 'lr', left: item.a, right: item.b };
        batch.set(db.collection('charDecompositions').doc(item.char), data);
        if (++count % 499 === 0) { batches.push(batch); batch = db.batch(); }
      });
      batches.push(batch);

      return Promise.all(batches.map(function(b) { return b.commit(); })).then(function() {
        showToast('✅ 已產生 ' + resolved.length + ' 個字的拆字資料（略過 ' + skipped.length + ' 個查無乾淨拆法的字）');
        _cdRenderSection();
      });
    }).catch(function(e) {
      showToast('❌ 下載拆字資料庫失敗：' + e.message);
      _cdResetScanBtn(btn);
    });
  }).catch(function(e) {
    showToast('❌ 掃描失敗：' + e.message);
    _cdResetScanBtn(btn);
  });
}

function _cdResetScanBtn(btn) {
  if (btn) { btn.disabled = false; btn.textContent = '🔄 掃描並自動產生拆字資料'; }
}

function _cdCollectCurriculumChars() {
  return db.collection('curriculum').get().then(function(verSnap) {
    var verIds = [];
    verSnap.forEach(function(doc) { verIds.push(doc.id); });
    return Promise.all(verIds.map(function(vId) {
      return db.collection('curriculum').doc(vId).collection('lessons').get();
    }));
  }).then(function(lessonSnaps) {
    var chars = {};
    lessonSnaps.forEach(function(snap) {
      snap.forEach(function(doc) {
        (doc.data().chars || []).forEach(function(c) { if (c) chars[c] = true; });
      });
    });
    return Object.keys(chars);
  });
}

function _cdCollectRadicalItemChars() {
  return db.collection('radicalGroups').get().then(function(snap) {
    var chars = {};
    snap.forEach(function(doc) {
      (doc.data().chars || []).forEach(function(c) { if (c) chars[c] = true; });
    });
    return Object.keys(chars);
  });
}

/* ── IDS 資料解析：只接受乾淨的左右／上下兩塊結構 ── */
function _cdParseIdsLine(line) {
  if (!line || line.charAt(0) === '#') return null;
  var cols = line.split('\t');
  if (cols.length < 3) return null;
  var char = cols[1];
  if (!char) return null;

  var candidates = cols.slice(2).join('\t').split(/\s+/).filter(Boolean);
  if (!candidates.length) return null;

  var raw = candidates[0].replace(/\[[^\]]*\]/g, '');
  var cps = Array.from(raw);
  if (cps.length !== 3) return null;

  var op = cps[0];
  var type = op === '⿰' ? 'lr' : (op === '⿱' ? 'tb' : null); // ⿰ 左右／⿱ 上下
  if (!type) return null;

  var a = cps[1], b = cps[2];
  if (_cdIsPUA(a) || _cdIsPUA(b)) return null;
  if (a === char || b === char) return null;

  return { char: char, type: type, a: a, b: b };
}

function _cdIsPUA(ch) {
  var cp = ch.codePointAt(0);
  return (cp >= 0xE000 && cp <= 0xF8FF) || (cp >= 0xF0000 && cp <= 0xFFFFD) || (cp >= 0x100000 && cp <= 0x10FFFD);
}

/* ── 工具函式 ── */
function _cdEscAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
}
