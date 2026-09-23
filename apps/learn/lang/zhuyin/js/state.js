/**
 * state.js — 全域狀態與 Firebase 存取
 */
'use strict';

var currentStudent = null;

var ZHUYIN_INITIALS = ['ㄅ','ㄆ','ㄇ','ㄈ','ㄉ','ㄊ','ㄋ','ㄌ','ㄍ','ㄎ','ㄏ','ㄐ','ㄑ','ㄒ','ㄓ','ㄔ','ㄕ','ㄖ','ㄗ','ㄘ','ㄙ'];
var ZHUYIN_FINALS   = ['ㄧ','ㄨ','ㄩ','ㄚ','ㄛ','ㄜ','ㄝ','ㄞ','ㄟ','ㄠ','ㄡ','ㄢ','ㄣ','ㄤ','ㄥ','ㄦ'];

var zhuyinData = {}; // { 符號: {imageUrl, phrase, audioData} }（全校共用，App 啟動時載入一次）
var zyAllSymbols = ZHUYIN_INITIALS.concat(ZHUYIN_FINALS); // 37 個符號，順序與網格顯示一致

/* ── 注音符號圖庫：老師建立的圖片/口訣/錄音全校共用 ── */
function loadZhuyinData() {
  db.collection('zhuyinSounds').get().then(function(snap) {
    zhuyinData = {};
    snap.forEach(function(doc) {
      var d = doc.data();
      zhuyinData[doc.id] = { imageUrl: d.imageUrl || '', phrase: d.phrase || '', audioData: d.audioData || '' };
    });
    renderZhuyinGrid();
  }).catch(function() { zhuyinData = {}; renderZhuyinGrid(); });
}

/* ── 練習／測驗：方向與精熟狀態 ──
   聽音選字／看字選音各自獨立累計精熟度，互不影響（同一符號可能一邊精熟、一邊還沒測過） */
var zyDirection = null; // 'listen' | 'read'
var zySymbolStatus = { listenStatus: {}, readStatus: {} }; // { 符號: 'new'|'practiced'|'mastered' }

function saveZySymbolStatus() {
  if (!db || !currentStudent || currentStudent.isGuest || currentStudent.isPreview) return;
  db.collection('students').doc(currentStudent.id)
    .collection('progress').doc('zhuyin')
    .set({
      listenStatus: zySymbolStatus.listenStatus,
      readStatus:   zySymbolStatus.readStatus,
      lastStudied:  new Date().toISOString()
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
