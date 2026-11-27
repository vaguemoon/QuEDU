/**
 * admin/exam-compose-match.js — 試卷編製精靈：共用小工具與「詞圖配對」選圖區（第二步）
 * 原本是 exam-compose.js 的一部分，照章節拆成獨立檔案，內容沒有改。
 * 共用的狀態變數（_ec*、_qe*、_dct*）宣告在 exam-compose.js；各檔的函式都是全域的，可以互相呼叫。
 * 依賴：shared.js（db、showToast）、init.js（currentTeacher）、exam-compose.js
 */
'use strict';

/* ════════════════════════════════
   工具
   ════════════════════════════════ */
function _ecEsc(s)  { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function _ecEscA(s) { return String(s).replace(/"/g,'&quot;'); }

/* 手動分頁點的小切換鈕——用在大題標題列跟單一題目列。瀏覽器的列印分頁是自動算的，
   `.q-item{break-inside:avoid}` 只能保證單一題目不被從中間切斷，沒辦法像 Word 一樣讓老師
   自己挑要在哪裡換頁；這顆按鈕讓老師照瀏覽器列印預覽實際看到的分頁位置，自己決定要不要
   在某一題/某個大題前面強制插入換頁，不用的話完全不影響原本「瀏覽器自動擠版面」的行為。
   開著的時候按鈕變實心藍色，關掉是空心灰色，點一下用 event.stopPropagation() 擋掉外層
   onclick（大題標題列本身有「點了展開/摺疊」的 onclick，按鈕點下去不該順便觸發那個）。 */
function _ecBreakToggleBtn(onclickCall, active, title) {
  return '<button type="button" onclick="event.stopPropagation();' + onclickCall + '" title="' + _ecEscA(title) + '" ' +
    'style="padding:3px 8px;border:1.5px solid ' + (active ? 'var(--blue)' : 'var(--border)') + ';border-radius:6px;' +
    'background:' + (active ? 'var(--blue)' : 'white') + ';color:' + (active ? 'white' : 'var(--muted)') + ';' +
    'cursor:pointer;font-size:.72rem;font-weight:800;font-family:inherit;flex-shrink:0;margin-right:4px">📄 分頁</button>';
}

/* 配分：大題標題後面的「（每題4分，共20分）」／「（每組2分，共20分）」這段字——沒填分數
   或這個大題剛好是空的（0 題/0 組）就不印，不要印出「（每題0分，共0分）」這種沒意義的字 */
function _ecPointsSuffix(points, count, unit) {
  var p = parseFloat(points);
  if (isNaN(p) || p <= 0 || !count) return '';
  var total = Math.round(p * count * 100) / 100;
  return '（每' + unit + p + '分，共' + total + '分）';
}

/* 句子重組列印版面用的圈圈數字（①②③...），超過 20 塊（實務上不會發生）就退回純數字加括號 */
var _EC_CIRCLED = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'];
function _ecCircledNum(n) { return _EC_CIRCLED[n - 1] || ('(' + n + ')'); }
function _ecEscJs(s) { return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

/* 將字串轉成帶 <ruby> 標記的 HTML（逐字查注音字典）*/
function _zhToRuby(s) {
  var dict = window._zhDict;
  return String(s).split('').map(function(ch) {
    var zy = dict && dict[ch];
    if (zy) return '<ruby>' + _ecEsc(ch) + '<rt>' + zy + '</rt></ruby>';
    return _ecEsc(ch);
  }).join('');
}
/* 產生 6 位隨機碼（不含易混淆字元） */
function _ecGenCode() {
  var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = '';
  for (var i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)];
  return r;
}

function _ecBtn(color) {
  return 'flex-shrink:0;padding:5px 12px;border-radius:8px;background:white;font-size:.78rem;font-weight:800;cursor:pointer;font-family:inherit;' +
    (color === 'red'  ? 'border:1.5px solid #fecaca;color:var(--red)'
    : color === 'blue' ? 'border:1.5px solid var(--blue);color:var(--blue)'
    :                    'border:1.5px solid var(--border);color:var(--text)');
}

/* ════════════════════════════════
   詞圖配對（連連看）
   原本是第三步「排版」另外按「＋新增詞圖配對大題」開視窗、重選一次版本年級冊次課次；
   現在跟句子重組／默寫生字一樣併進第二步：題型篩選選「詞圖配對」才出現選圖區，
   版本冊次用第一步選的、課次用上面的課次篩選，點圖片選進／取消。
   選的圖片不管來自哪一課或哪個自訂類別，全部放進同一個「連連看」大題（使用者 2026-11 決定）；
   改版前存的試卷可能有好幾個連連看大題，照原樣保留，取消勾選時從它所在的大題移除。
   存檔格式（matchSections）不變，學生端／列印只用 wordIds、words、title。
   ════════════════════════════════ */
var _EC_MATCH_TYPE = '詞圖配對';
var _ecMatchSrc = 'curriculum';   // 選圖區目前的來源：curriculum（課本圖庫）／custom（自訂類別）
var _ecMatchCatId = '';           // 自訂類別來源選的類別
var _ecMatchCustomCats = null;    // [{id, name}]，查一次就留著
var _ecMatchImgCache = {};        // 來源 key → [{id, word, imageUrl}]
var _ecMatchShown = [];           // 選圖區目前列出的圖片
var _ecMatchShownSrc = null;      // 目前列出的圖片的來源 {source, gradeLesson, categoryId}
var _ecMatchSeq = 0;              // 切換來源時丟掉晚到的舊查詢結果

/* 「已選 N 題」把連連看的組數也算進去 */
function _ecRefreshSelectedCount() {
  var pairs = 0;
  _ecMatchSections.forEach(function(m) { pairs += m.pairCount || 0; });
  var cntEl = document.getElementById('ec-selected-count');
  if (cntEl) cntEl.textContent = Object.keys(_ecSelected).length + pairs;
  var mEl = document.getElementById('ec-selected-match');
  if (mEl) mEl.textContent = pairs ? '（含連連看 ' + pairs + ' 組）' : '';
}

function _ecMatchRerender() {
  _ecRenderMatchCreateRow(_ecGrade || ((document.getElementById('ec-filter-grade') || {}).value || ''),
                         ((document.getElementById('ec-filter-cat') || {}).value || ''));
}

function _ecMatchSetSource(src) { _ecMatchSrc = src; _ecMatchRerender(); }
function _ecMatchSetCategory(id) { _ecMatchCatId = id; _ecMatchRerender(); }

function _ecRenderMatchCreateRow(grade, lesson) {
  var row = document.getElementById('ec-match-create-row');
  if (!row) return;
  var seq = ++_ecMatchSeq;
  _ecMatchShown = []; _ecMatchShownSrc = null;

  function tab(src, label) {
    var on = _ecMatchSrc === src;
    return '<button type="button" onclick="_ecMatchSetSource(\'' + src + '\')" style="padding:5px 14px;border:1.5px solid var(--blue);' +
      'border-radius:8px;background:' + (on ? 'var(--blue)' : 'white') + ';color:' + (on ? 'white' : 'var(--blue)') + ';' +
      'font-size:.85rem;font-weight:800;cursor:pointer;font-family:inherit">' + label + '</button>';
  }
  var head = '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">' +
    tab('curriculum', '課本圖庫') + tab('custom', '自訂類別') + '<span id="ec-match-src-extra"></span></div>';
  function body(html) {
    if (seq !== _ecMatchSeq) return;
    row.innerHTML = head + html;
    if (_ecMatchSrc === 'custom') _ecMatchRenderCatSelect();
  }
  function msg(t) { return '<div style="font-size:.85rem;color:var(--muted)">' + t + '</div>'; }

  var src, query, key;
  if (_ecMatchSrc === 'curriculum') {
    if (!grade || !lesson) { body(msg('請先在上方選擇特定課次（圖片跟著課次走）')); return; }
    var gl = grade + '_' + lesson;   // 詞語圖庫的 gradeLesson 是「版本冊次_課次」，例：康軒三上_9
    src = { source: 'curriculum', gradeLesson: gl, categoryId: '' };
    key = 'c|' + gl;
    query = function() { return db.collection('wordImages').where('gradeLesson', '==', gl).get(); };
  } else {
    if (!_ecMatchCustomCats) {
      body(msg('讀取自訂類別中…'));
      db.collection('customCategories').where('teacherUid', '==', currentTeacher.uid).get().then(function(snap) {
        _ecMatchCustomCats = snap.docs.map(function(d) { return { id: d.id, name: d.data().name || d.id }; });
      }).catch(function() { _ecMatchCustomCats = []; }).then(function() { if (seq === _ecMatchSeq) _ecMatchRerender(); });
      return;
    }
    if (!_ecMatchCustomCats.length) { body(msg('還沒有自訂類別，請先到「資料庫 › 詞語圖庫」建立')); return; }
    if (!_ecMatchCatId) { body(msg('請先選擇自訂類別')); return; }
    src = { source: 'custom', gradeLesson: '', categoryId: _ecMatchCatId };
    key = 'u|' + _ecMatchCatId;
    query = function() {
      return db.collection('wordImages').where('teacherUid', '==', currentTeacher.uid)
        .where('customCategoryId', '==', _ecMatchCatId).get();
    };
  }

  function show(list) {
    if (seq !== _ecMatchSeq) return;
    if (!list.length) {
      body(msg(src.source === 'curriculum'
        ? '詞語圖庫裡還沒有「' + _ecEsc(grade) + ' 第' + _ecEsc(lesson) + '課」的圖片，請先到「資料庫 › 詞語圖庫」上傳'
        : '這個類別還沒有圖片，請先到「資料庫 › 詞語圖庫」上傳'));
      return;
    }
    _ecMatchShown = list; _ecMatchShownSrc = src;
    body('<div style="font-size:.78rem;color:var(--muted);font-weight:700;margin-bottom:6px">點圖片選進連連看（右下角全選／全不選也會套用在這裡）：</div>' +
      '<div id="ec-match-chips" style="display:flex;flex-wrap:wrap;gap:8px"></div>');
    _ecRenderMatchChips();
  }

  if (_ecMatchImgCache[key]) { show(_ecMatchImgCache[key]); return; }
  body(msg('讀取圖片中…'));
  query().then(function(snap) {
    var list = [];
    snap.forEach(function(doc) { var d = doc.data(); list.push({ id: doc.id, word: d.word || '', imageUrl: d.imageUrl || '' }); });
    _ecMatchImgCache[key] = list;
    show(list);
  }).catch(function() { body(msg('圖片載入失敗，請稍後再試')); });
}

function _ecMatchRenderCatSelect() {
  var el = document.getElementById('ec-match-src-extra');
  if (!el || !_ecMatchCustomCats || !_ecMatchCustomCats.length) return;
  el.innerHTML = '<select onchange="_ecMatchSetCategory(this.value)" style="padding:5px 8px;border:1.5px solid var(--border);' +
    'border-radius:8px;font-size:.85rem;font-family:inherit;background:white">' +
    '<option value="">選擇類別…</option>' +
    _ecMatchCustomCats.map(function(c) {
      return '<option value="' + _ecEscA(c.id) + '"' + (c.id === _ecMatchCatId ? ' selected' : '') + '>' + _ecEsc(c.name) + '</option>';
    }).join('') + '</select>';
}

/* 已經選進任何一個連連看大題的圖片 id → {si, wi} */
function _ecMatchFind(wordId) {
  for (var si = 0; si < _ecMatchSections.length; si++) {
    var wi = (_ecMatchSections[si].wordIds || []).indexOf(wordId);
    if (wi >= 0) return { si: si, wi: wi };
  }
  return null;
}

function _ecRenderMatchChips() {
  var wrap = document.getElementById('ec-match-chips');
  if (!wrap) return;
  wrap.innerHTML = _ecMatchShown.map(function(w, i) {
    var on = !!_ecMatchFind(w.id);
    var color = on ? 'var(--green,#2e7d32)' : 'var(--border)';
    return '<button type="button" onclick="_ecToggleMatchWord(' + i + ')" title="' + (on ? '點一下取消' : '點一下選進連連看') + '" ' +
      'style="display:flex;align-items:center;gap:8px;padding:4px 12px 4px 4px;border:2px solid ' + color + ';border-radius:10px;' +
      'background:' + (on ? '#eaf6ec' : 'white') + ';cursor:pointer;font-family:inherit">' +
      '<img src="' + _ecEscA(w.imageUrl) + '" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:7px;flex-shrink:0">' +
      '<span style="font-size:.95rem;font-weight:800;color:' + (on ? 'var(--green,#2e7d32)' : 'var(--text)') + '">' +
        _ecEsc(w.word) + (on ? ' ✓' : '') + '</span>' +
    '</button>';
  }).join('');
}

function _ecMatchSet(w, on) {
  var at = _ecMatchFind(w.id);
  if (!on) {
    if (!at) return;
    var m = _ecMatchSections[at.si];
    m.wordIds.splice(at.wi, 1); (m.words || []).splice(at.wi, 1);
    m.pairCount = m.wordIds.length;
    if (!m.pairCount) _ecMatchSections.splice(at.si, 1);
    return;
  }
  if (at) return;
  var src = _ecMatchShownSrc;
  var sec = _ecMatchSections[0];
  if (!sec) {
    sec = { title: '連連看', source: src.source, gradeLesson: src.gradeLesson, categoryId: src.categoryId,
            pairCount: 0, wordIds: [], words: [] };
    _ecMatchSections.push(sec);
  } else if (sec.source !== src.source || sec.gradeLesson !== src.gradeLesson || sec.categoryId !== src.categoryId) {
    /* 跨課／跨類別混在同一個大題：來源欄位只是排版畫面顯示用，標成 mixed */
    sec.source = 'mixed'; sec.gradeLesson = ''; sec.categoryId = '';
  }
  sec.wordIds = sec.wordIds || []; sec.words = sec.words || [];
  sec.wordIds.push(w.id); sec.words.push(w.word);
  sec.pairCount = sec.wordIds.length;
}

function _ecToggleMatchWord(i) {
  var w = _ecMatchShown[i];
  if (!w) return;
  _ecMatchSet(w, !_ecMatchFind(w.id));
  _ecRenderMatchChips();
  _ecRefreshSelectedCount();
  var err = document.getElementById('ec-step2-err');
  if (err) err.textContent = '';   // 「至少要 2 組」的提示補完就收掉，下一步會再檢查一次
}

/* 全選／全不選篩到詞圖配對時：套用在選圖區目前列出的圖片 */
function _ecMatchSelectShown(on) {
  _ecMatchShown.forEach(function(w) { _ecMatchSet(w, on); });
  _ecRefreshSelectedCount();
}

/* 句子重組：開窗用 Step 1 已經選好的年級/課次預填，存檔完（_srOnSaved hook，定義在
   admin/quiz-bank.js 的 _srSaveQuestion 裡）直接把新題目塞進 _ecAllQ 並勾選起來，
   這份測驗馬上就帶著這一題，不用使用者自己再去選題清單裡找 */
/* lesson/lessonName 選填——從課文挑句子點進來時，帶的是「目前篩選中的那一課」，不一定跟
   Step 1 選的是同一課（老師可能在 Step 2 另外切了課次篩選瀏覽）；單純按「+新增」才退回用
   Step 1 的 _ecLesson/_ecLessonName */
function _ecOpenSrModal(prefillSentence, lesson, lessonName) {
  var modal = document.getElementById('sr-modal');
  if (!modal) return;
  _srEditDocId = null;
  document.getElementById('sr-modal-title').textContent = '🧩 新增句子重組題';
  document.getElementById('sr-delete-btn').style.display = 'none';
  document.getElementById('sr-save-btn').textContent = '加入這份測驗';
  document.getElementById('sr-grade').value = _ecGrade;
  document.getElementById('sr-grade-display').textContent = _ecGrade || '（請先回第一步選版本冊次）';
  document.getElementById('sr-lesson').value = lesson || _ecLesson || '';
  document.getElementById('sr-lesson-name').value = lessonName || _ecLessonName || '';
  document.getElementById('sr-sentence').value = prefillSentence || '';
  document.getElementById('sr-pieces-wrap').style.display = 'none';
  var statusEl = document.getElementById('sr-status');
  if (statusEl) { statusEl.style.color = 'var(--muted)'; statusEl.textContent = ''; }

  _srOnSaved   = _ecSrOnSavedHandler;
  _srOnDeleted = _ecSrOnDeletedHandler;
  modal.style.display = 'flex';
  if (prefillSentence) _srSegmentSentence(); /* 從課文點句子進來的，直接先拆好給老師看，不用再按一次 */
}

/* 點清單裡已經存在的句子重組題 → 用同一個 modal，但是編輯模式：直接用存檔時的片段
   （不重新跑斷詞，保留老師原本調整過的分界），存檔時更新同一份文件，並多顯示刪除按鈕 */
function _ecOpenSrModalForEdit(docId) {
  var q = null;
  for (var k = 0; k < _ecAllQ.length; k++) { if (_ecAllQ[k].id === docId) { q = _ecAllQ[k]; break; } }
  if (!q) return;
  var modal = document.getElementById('sr-modal');
  if (!modal) return;

  _srEditDocId = docId;
  document.getElementById('sr-modal-title').textContent = '🧩 編輯句子重組題';
  document.getElementById('sr-delete-btn').style.display = '';
  document.getElementById('sr-save-btn').textContent = '儲存變更';
  document.getElementById('sr-grade').value = q.grade || _ecGrade;
  document.getElementById('sr-grade-display').textContent = q.grade || _ecGrade || '';
  document.getElementById('sr-lesson').value = q.lesson || '';
  document.getElementById('sr-lesson-name').value = q.lessonName || '';
  document.getElementById('sr-sentence').value = (q.options || []).join('');
  var statusEl = document.getElementById('sr-status');
  if (statusEl) { statusEl.style.color = 'var(--muted)'; statusEl.textContent = ''; }

  /* 既有片段直接當 atom，邊界全部設成「分開」——保留老師原本存檔時的合併結果，
     不用重新跑一次斷詞；想整個重新拆解還是可以再按一次「拆解句子」 */
  _srAtoms = (q.options || []).slice();
  _srBoundaries = _srAtoms.map(function() { return true; }).slice(0, _srAtoms.length - 1);
  document.getElementById('sr-pieces-wrap').style.display = '';
  _srRenderPieces();

  _srOnSaved   = _ecSrOnSavedHandler;
  _srOnDeleted = _ecSrOnDeletedHandler;
  modal.style.display = 'flex';
}

function _ecSrOnSavedHandler(docId, data, isEdit) {
  var idx = -1;
  for (var k = 0; k < _ecAllQ.length; k++) { if (_ecAllQ[k].id === docId) { idx = k; break; } }
  if (idx !== -1) {
    _ecAllQ[idx] = Object.assign({ id: docId }, data);
  } else {
    _ecAllQ.push(Object.assign({ id: docId }, data));
    if (!isEdit) _ecSelected[docId] = true; /* 新增的題目自動勾選進這份測驗；編輯既有題目不動原本的勾選狀態 */
  }
  _ecBuildFilters();
  _ecFilterAndRender();
  _srCloseModal();
}

function _ecSrOnDeletedHandler(docId) { _ecRemoveQFromList(docId); }
