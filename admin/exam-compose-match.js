/**
 * admin/exam-compose-match.js — 試卷編製精靈：共用小工具與「詞圖配對」modal
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
   詞圖配對 modal
   ════════════════════════════════ */
function _ecOpenMatchModal() {
  var modal  = document.getElementById('ec-match-modal');
  if (!modal) return;
  var listEl = document.getElementById('ec-match-word-list');
  if (listEl) listEl.innerHTML = '<span style="color:var(--muted)">請先選擇來源</span>';
  var pubSel    = document.getElementById('ec-match-publisher');
  var lessonSel = document.getElementById('ec-match-lesson');
  if (pubSel)    pubSel.value    = '';
  if (lessonSel) lessonSel.innerHTML = '<option value="">課次</option>';
  var radCurr = document.querySelector('input[name="ec-match-source"][value="curriculum"]');
  if (radCurr) { radCurr.checked = true; _ecMatchSourceChange('curriculum'); }
  _ecMatchLoadCustomCategories();
  modal.style.display = 'flex';
}

function _ecCloseMatchModal() {
  var modal = document.getElementById('ec-match-modal');
  if (modal) modal.style.display = 'none';
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
