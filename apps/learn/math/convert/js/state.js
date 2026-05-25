/**
 * state.js — 全域狀態與 Firebase 存取
 * 負責：所有共用變數、saveProgress()、shuffle()
 */
'use strict';

// ── 學生資訊 ──
var currentStudent = null;

// ── 遊戲設定 ──
var currentCategory   = '';      // 'length' | 'time' | 'money'
var currentSubtype    = '';      // 'mm-cm' | 'cm-m' | ... | 'large-to-small' | 'small-to-large'
var currentDifficulty = 'easy';  // 'easy' | 'hard'
var ROUND_SIZE = 10;             // 每輪題目數

// ── 時間換算項目（選擇頁用） ──
var selectTimeItems  = { 'day-hour': false, 'hour-min': false, 'min-sec': false };
// ── 時間換算項目（遊戲中用） ──
var currentTimeItems = { 'day-hour': false, 'hour-min': false, 'min-sec': false };

// ── 一輪遊戲狀態 ──
var gamePool    = [];   // 本輪題目陣列（已洗牌）
var gamePoolIdx = 0;    // 目前題目索引
var gameQ       = null; // 當前題目物件
var gameCorrect = 0;
var gameTotal   = 0;
var gameStreak  = 0;

// ── 填空輸入 ──
var fillInputStr = '';        // 單答輸入值
var fillInputArr = ['', ''];  // 雙答輸入值（時間 hm 類型）
var activeFillIdx = 0;        // 雙答時目前作答欄（0 或 1）
var answerCount = 1;          // 本題答案欄數（1 或 2）

// ── 歷史統計（Firestore 載入）──
var totalCorrect   = 0;
var totalRounds    = 0;
var bestStreak     = 0;
var categoryStats  = {
  length:  { rounds: 0, stars: 0 },
  weight:  { rounds: 0, stars: 0 },
  volume:  { rounds: 0, stars: 0 },
  time:    { rounds: 0, stars: 0 },
  money:   { rounds: 0, stars: 0 },
  percent: { rounds: 0, stars: 0 }
};

// ════════════════════════════════════════
//  Firestore 寫入
// ════════════════════════════════════════

function saveProgress() {
  if (!db || !currentStudent) return;
  db.collection('students').doc(currentStudent.id)
    .collection('progress').doc('convert')
    .set({
      totalCorrect:  totalCorrect,
      totalRounds:   totalRounds,
      bestStreak:    bestStreak,
      categoryStats: categoryStats,
      lastStudied:   new Date().toISOString()
    }, { merge: true })
    .catch(function(e) { console.warn('saveProgress error:', e); });
}

// ════════════════════════════════════════
//  工具函式
// ════════════════════════════════════════

/** Fisher-Yates 隨機排列（不修改原陣列） */
function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
