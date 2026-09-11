/**
 * state.js — 全域狀態與 Firebase 存取
 */
'use strict';

var currentStudent = null;

var ZHUYIN_INITIALS = ['ㄅ','ㄆ','ㄇ','ㄈ','ㄉ','ㄊ','ㄋ','ㄌ','ㄍ','ㄎ','ㄏ','ㄐ','ㄑ','ㄒ','ㄓ','ㄔ','ㄕ','ㄖ','ㄗ','ㄘ','ㄙ'];
var ZHUYIN_FINALS   = ['ㄧ','ㄨ','ㄩ','ㄚ','ㄛ','ㄜ','ㄝ','ㄞ','ㄟ','ㄠ','ㄡ','ㄢ','ㄣ','ㄤ','ㄥ','ㄦ'];

var zhuyinData = {}; // { 符號: {imageUrl, phrase} }（全校共用，App 啟動時載入一次）

/* ── 注音符號圖庫：老師建立的圖片/口訣全校共用 ── */
function loadZhuyinData() {
  db.collection('zhuyinSounds').get().then(function(snap) {
    zhuyinData = {};
    snap.forEach(function(doc) {
      zhuyinData[doc.id] = { imageUrl: doc.data().imageUrl || '', phrase: doc.data().phrase || '' };
    });
    renderZhuyinGrid();
  }).catch(function() { zhuyinData = {}; renderZhuyinGrid(); });
}
