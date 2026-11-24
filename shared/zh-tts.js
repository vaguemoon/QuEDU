/**
 * zh-tts.js — 單獨唸一個國字時，讓語音引擎唸出指定的讀音
 *
 * 只唸一個字時語音引擎沒有上下文，常唸錯（例：划 → ㄏㄨㄚˋ、行 → ㄏㄤˊ）。
 * 做法：找一個跟要唸的讀音同音、本身只有這一種讀音的常用字來唸（行ㄒㄧㄥˊ → 形），聽起來完全一樣。
 * 依賴：assets/data/zhuyin-chars.js（ZHUYIN_CHARS）、assets/data/heteronym-readings.js（HETERONYM_READINGS），
 *       沒載入時 zhSameSoundChar 回傳 null，呼叫端照原本方式唸。
 * 使用：電子課本（破音字）、shared/curriculum.js（練字趣、認字趣的課程生字）
 */
'use strict';

/* 語音引擎單唸會唸錯、但在台灣只有一種讀音的字（不在破音字表裡，資料上看不出來）→ 改唸的同音字。
   老師回報一個加一個；這些字也不會被拿來當別人的同音字。
   划：台灣只唸 ㄏㄨㄚˊ（計畫的 ㄏㄨㄚˋ 寫「劃」），引擎照大陸用法唸成 ㄏㄨㄚˋ（2026-11 回報） */
var ZH_TTS_MISREAD = { '划': '滑' };

var _zhCharSyllables = null;   // { 字: [這個字出現的音節…] }

function _zhSyllableMap() {
  if (!_zhCharSyllables) {
    _zhCharSyllables = {};
    Object.keys(ZHUYIN_CHARS).forEach(function(k) {
      Array.from(ZHUYIN_CHARS[k]).forEach(function(c) { (_zhCharSyllables[c] = _zhCharSyllables[c] || []).push(k); });
    });
  }
  return _zhCharSyllables;
}

/* 注音 → 一個同音、而且只有這一種讀音的常用字（ZHUYIN_CHARS 依常用程度排序）。
   輕聲單獨唸本來就不自然，不換 */
function zhSameSoundChar(reading) {
  if (!reading || reading.indexOf('˙') >= 0 || !window.ZHUYIN_CHARS) return null;
  var map = _zhSyllableMap();
  var hr = window.HETERONYM_READINGS || {};
  var chars = Array.from(ZHUYIN_CHARS[reading] || '');
  for (var i = 0; i < chars.length; i++) {
    var r = hr[chars[i]];
    if (map[chars[i]].length === 1 && (!r || r.length < 2) && !ZH_TTS_MISREAD[chars[i]]) return chars[i];
  }
  return null;
}
