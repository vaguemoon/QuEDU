/**
 * stroke-data.js — HanziWriter 改用教育部標準筆順
 *
 * HanziWriter 預設的筆順資料（hanzi-writer-data / Make Me A Hanzi）是大陸寫法，
 * 有些字的筆順、畫數、字形跟課本不同（例：華 課本 12 畫，預設資料 11 畫、右上「十」先豎後橫）。
 * 這裡改成先讀 assets/data/strokes-tw/（教育部「國字標準字體筆順學習網」資料，
 * 經 g0v/zh-stroke-data 整理，常用字 4809 字，已轉成 HanziWriter 格式），
 * 沒收錄的字（罕用字、偏旁如「氵」）才退回原本的 CDN 資料。
 *
 * 用法：在 hanzi-writer.min.js 後面載入即可。所有 HanziWriter.create 沒自己指定
 * charDataLoader 的，都會自動套用（注音趣自帶 charDataLoader，不受影響）。
 */
'use strict';

var QU_STROKE_TW_BASE = (function() {
  var s = document.currentScript;
  return s ? new URL('../assets/data/strokes-tw/', s.src).href : '/assets/data/strokes-tw/';
})();
var QU_STROKE_CDN_BASE = 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/';

var _quStrokeCache = {};   // { 字: Promise<data> }，同一頁多個格子寫同一個字只抓一次

function _quFetchJson(url) {
  return fetch(url).then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  });
}

function quStrokeData(char) {
  if (!_quStrokeCache[char]) {
    var hex = char.codePointAt(0).toString(16);
    _quStrokeCache[char] = _quFetchJson(QU_STROKE_TW_BASE + hex + '.json')
      .catch(function() { return _quFetchJson(QU_STROKE_CDN_BASE + encodeURIComponent(char) + '.json'); })
      .catch(function(e) { delete _quStrokeCache[char]; throw e; });   // 斷線失敗的下次再試
  }
  return _quStrokeCache[char];
}

function quStrokeLoader(char, onLoad, onError) {
  quStrokeData(char).then(onLoad, onError);
}

if (window.HanziWriter) {
  var _quHwCreate = HanziWriter.create;
  HanziWriter.create = function(el, char, opts) {
    if (!opts || !opts.charDataLoader) opts = Object.assign({}, opts, { charDataLoader: quStrokeLoader });
    return _quHwCreate.call(HanziWriter, el, char, opts);
  };
}
