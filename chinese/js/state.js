/**
 * state.js — 全域狀態與 Firebase 存取
 * 負責：所有共用變數、saveProgress()、saveStroke()
 */
'use strict';

// ── 學生與學習狀態 ──
var currentStudent = null;
var chars      = [];      // 本次練習的生字陣列
var charStatus = {};      // { '字': 'new'|'dictated'|'mastered' }
var currentIdx = 0;       // 目前操作的字索引
var currentMode = 'practice'; // 目前練習模式
var currentLessonLabel = ''; // 目前課程標籤（用於活動紀錄）

// ── HanziWriter 實例 ──
var refWriter  = null;    // 範例筆順
var quizWriter = null;    // 筆順練習互動
var examWriter = null;    // 單字測驗互動

// ── 默寫 Canvas 狀態 ──
var dCanvas, dCtx;
var dDrawing       = false;
var dSize          = 340;
var dCurrentStroke = [];
var dAllStrokes    = [];
var charStrokes    = {};  // 已儲存的筆畫資料快取
var dictScore      = -1;
var currentPracticeSz = 300; // 記住練習格尺寸供切 tab 時使用
var charInfoCache  = {};      // 萌典 API 快取 { '字': { zhuyin, radical, strokes } }

// ── Firebase 存取 ──

/**
 * 將 charStatus 寫入 Firestore（students/{id}/progress/hanzi）
 */
function saveProgress() {
  if (!db || !currentStudent) return;
  db.collection('students').doc(currentStudent.id)
    .collection('progress').doc('hanzi')
    .set({ charStatus: charStatus, lastStudied: new Date().toISOString() }, { merge: true })
    .catch(function(e){ console.warn('saveProgress error:', e); });
}

/**
 * 將手寫筆畫座標寫入 Firestore（students/{id}/strokes/{char}）
 * @param {string} char    目標漢字
 * @param {Array}  strokes 正規化後的筆畫座標陣列
 */
function saveStroke(char, strokes) {
  if (!db || !currentStudent) return;
  charStrokes[char] = strokes;
  db.collection('students').doc(currentStudent.id)
    .collection('strokes').doc(char)
    .set({ strokes: strokes, updatedAt: new Date().toISOString() }, { merge: true })
    .catch(function(e){ console.warn('saveStroke error:', e); });
}

/**
 * 根據錯誤次數升級 charStatus（不降級），回傳新狀態
 * 0–3 錯 → 'mastered'；4+ 錯 → 維持現狀
 * @param {string} char
 * @param {number} mistakes
 * @returns {string} 套用後的狀態
 */
function upgradeCharStatus(char, mistakes) {
  if (mistakes <= 3) {
    charStatus[char] = 'mastered';
    return 'mastered';
  }
  return charStatus[char] || 'new';
}

/**
 * 默寫自評通過 → 升為 'dictated'（純視覺，不降級）
 * @param {string} char
 */
function markDictated(char) {
  if (charStatus[char] !== 'mastered') charStatus[char] = 'dictated';
}

/**
 * HanziWriter 選項工廠（避免重複配置）
 * 預設為「練習格」樣式；透過 overrides 覆蓋個別選項
 * @param {number} sz        格子像素尺寸
 * @param {object} overrides 覆蓋預設值的選項（含 onLoadCharDataSuccess 等回呼）
 */
function makeWriterOpts(sz, overrides) {
  return Object.assign({
    width: sz, height: sz, padding: Math.round(sz * 0.07),
    strokeColor: '#2d6fa8', outlineColor: '#c8dff5',
    drawingColor: '#2d6fa8', drawingWidth: Math.max(4, Math.round(sz * 0.013)),
    highlightColor: '#ffd54f', showCharacter: false, showOutline: true, leniency: 1.2
  }, overrides || {});
}

/**
 * Fisher-Yates 無偏隨機排列
 * @param {Array} arr 來源陣列（不修改原陣列）
 * @returns {Array} 新的隨機排列陣列
 */
function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
