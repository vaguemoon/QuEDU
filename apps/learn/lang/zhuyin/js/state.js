/**
 * state.js — 全域狀態與 Firebase 存取
 */
'use strict';

var currentStudent = null;

var ZHUYIN_INITIALS = ['ㄅ','ㄆ','ㄇ','ㄈ','ㄉ','ㄊ','ㄋ','ㄌ','ㄍ','ㄎ','ㄏ','ㄐ','ㄑ','ㄒ','ㄓ','ㄔ','ㄕ','ㄖ','ㄗ','ㄘ','ㄙ'];
var ZHUYIN_FINALS   = ['ㄧ','ㄨ','ㄩ','ㄚ','ㄛ','ㄜ','ㄝ','ㄞ','ㄟ','ㄠ','ㄡ','ㄢ','ㄣ','ㄤ','ㄥ','ㄦ'];

/* 結合韻：教育部標準 22 個（介符 ㄧ／ㄨ／ㄩ 分別跟韻符拼出來的組合音），
   依介符分三組，跟單音的聲符／韻符分組並列同一套呈現方式 */
var ZY_COMBINED_YI = ['ㄧㄚ','ㄧㄛ','ㄧㄝ','ㄧㄞ','ㄧㄠ','ㄧㄡ','ㄧㄢ','ㄧㄣ','ㄧㄤ','ㄧㄥ'];
var ZY_COMBINED_WU = ['ㄨㄚ','ㄨㄛ','ㄨㄞ','ㄨㄟ','ㄨㄢ','ㄨㄣ','ㄨㄤ','ㄨㄥ'];
var ZY_COMBINED_YU = ['ㄩㄝ','ㄩㄢ','ㄩㄣ','ㄩㄥ'];
var ZY_COMBINED    = ZY_COMBINED_YI.concat(ZY_COMBINED_WU, ZY_COMBINED_YU);

/* ── 兩大區：單音（37 符號）／結合韻（22 個）—— App 啟動時兩份資料都會先載好，
   切換區域不用再重新打 Firestore，各自的符號清單／圖庫資料／精熟狀態完全獨立 */
var zySection = 'single'; // 'single' | 'combined'

var zhuyinData         = {}; // 單音資料 { 符號: {imageUrl, phrase, audioData} }
var zhuyinCombinedData = {}; // 結合韻資料，格式相同

var zyAllSymbolsSingle   = ZHUYIN_INITIALS.concat(ZHUYIN_FINALS); // 37 個，順序與網格顯示一致
var zyAllSymbolsCombined = ZY_COMBINED;                            // 22 個

function zyActiveSymbols() { return zySection === 'combined' ? zyAllSymbolsCombined : zyAllSymbolsSingle; }
function zyActiveData()    { return zySection === 'combined' ? zhuyinCombinedData   : zhuyinData; }

/* ── 注音符號圖庫：老師建立的圖片/口訣/錄音全校共用 ── */
function loadZhuyinData() {
  db.collection('zhuyinSounds').get().then(function(snap) {
    zhuyinData = {};
    snap.forEach(function(doc) {
      var d = doc.data();
      zhuyinData[doc.id] = { imageUrl: d.imageUrl || '', phrase: d.phrase || '', audioData: d.audioData || '' };
    });
  }).catch(function() { zhuyinData = {}; });
}

function loadZhuyinCombinedData() {
  db.collection('zhuyinCombinedSounds').get().then(function(snap) {
    zhuyinCombinedData = {};
    snap.forEach(function(doc) {
      var d = doc.data();
      zhuyinCombinedData[doc.id] = { imageUrl: d.imageUrl || '', phrase: d.phrase || '', audioData: d.audioData || '' };
    });
  }).catch(function() { zhuyinCombinedData = {}; });
}

/* ── 練習／測驗：方向與精熟狀態 ──
   聽音選字／看字選音、單音／結合韻，四個組合各自獨立累計精熟度，互不影響 */
var zyDirection = null; // 'listen' | 'read'
var zySymbolStatus = {
  single:   { listenStatus: {}, readStatus: {} },
  combined: { listenStatus: {}, readStatus: {} }
}; // { 符號: 'new'|'practiced'|'mastered' }

function zyActiveStatusMap(direction) {
  var sec = zySymbolStatus[zySection];
  return direction === 'listen' ? sec.listenStatus : sec.readStatus;
}

function saveZySymbolStatus() {
  if (!db || !currentStudent || currentStudent.isGuest || currentStudent.isPreview) return;
  db.collection('students').doc(currentStudent.id)
    .collection('progress').doc('zhuyin')
    .set({
      listenStatus:         zySymbolStatus.single.listenStatus,
      readStatus:           zySymbolStatus.single.readStatus,
      combinedListenStatus: zySymbolStatus.combined.listenStatus,
      combinedReadStatus:   zySymbolStatus.combined.readStatus,
      lastStudied:          new Date().toISOString()
    }, { merge: true })
    .catch(function(e) { console.warn('saveZySymbolStatus error:', e); });
}

/**
 * Fisher-Yates 隨機排列
 */
function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/**
 * 為一題產生 4 個選項（含正確答案）：優先從目前練習範圍抽干擾項，不夠再從其餘符號補齊
 * @param {string} answer 正確答案（符號）
 * @param {Array} activePool 目前練習/測驗範圍內的符號
 * @param {Array} fallbackPool 範圍不足 3 個干擾項時的備用符號池
 * @returns {Array} 已隨機排列的 4 個選項
 */
function buildZyOptions(answer, activePool, fallbackPool) {
  var others = activePool.filter(function(x) { return x !== answer; });
  others = shuffle(others);
  var distractors = others.slice(0, 3);
  if (distractors.length < 3 && fallbackPool && fallbackPool.length) {
    var extra = shuffle(fallbackPool.filter(function(x) {
      return x !== answer && distractors.indexOf(x) === -1;
    }));
    distractors = distractors.concat(extra).slice(0, 3);
  }
  return shuffle([answer].concat(distractors));
}
