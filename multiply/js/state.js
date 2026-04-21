/**
 * state.js — 全域狀態與 Firebase 存取
 * 負責：所有共用變數、saveProgress()、shuffle()、pairKey()
 */
'use strict';

// ── 學生資訊 ──
var currentStudent = null;

// ── 練習模式狀態 ──
var practiceType    = 'fill';    // 'fill' | 'reverse'
var practicePool    = [];        // [{a,b}] 本次題目池
var practiceQ       = null;      // 當前題目 {a, b}
var practiceStreak  = 0;
var practiceCorrect = 0;
var practiceTotal   = 0;

// 練習設定頁暫存（避免離開設定頁後狀態遺失）
var practiceSelectedA_temp = [];  // 被乘數選擇 [0..10 子集]
var practiceSelectedB_temp = [];  // 乘數選擇

// ── 測驗模式狀態 ──
var examTimerSec        = 8;      // 每題秒數：5 / 8 / 10
var examRound           = 1;
var examPool            = [];     // 本輪待答題目 [{a,b}]
var examAllPairs        = [];     // 本次所有選定題目 [{a,b}]
var examMastered        = [];     // 本次已答對 pairKey 字串陣列
var examPendingWrong    = [];     // 本輪答錯，下輪繼續 [{a,b}]
var examQ               = null;   // 當前題目
var examCountdownId     = null;
var examTimeLeft        = 0;
var examSelectedTables  = [];     // 選定的乘法表 [0..10 子集]
var examSelectedTables_temp = []; // 設定頁暫存

// ── 填空輸入 ──
var fillInputStr = '';

// ── Firestore 進度（從 progress/multiply 載入） ──
var masteredFill    = [];  // 已完成填空測驗的乘數（保留供舊資料相容）
var masteredReverse = [];  // 已完成拆解測驗的乘數（保留供舊資料相容）
var masteredMixed   = [];  // 已完成混合測驗的乘數 ['0','3','5'...]
var totalCorrect    = 0;
var totalAttempts   = 0;
var maxStreak       = 0;   // 練習模式歷史最高連勝
var examCompletedCount = 0; // 累計完成測驗次數

// ════════════════════════════════════════
//  Firestore 寫入
// ════════════════════════════════════════

function saveProgress() {
  if (!db || !currentStudent) return;
  db.collection('students').doc(currentStudent.id)
    .collection('progress').doc('multiply')
    .set({
      masteredFill:        masteredFill,
      masteredReverse:     masteredReverse,
      masteredMixed:       masteredMixed,
      totalCorrect:        totalCorrect,
      totalAttempts:       totalAttempts,
      maxStreak:           maxStreak,
      examCompletedCount:  examCompletedCount,
      lastStudied:         new Date().toISOString()
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

/** 將 (a, b) 轉成字串 key，用於 examMastered 比對 */
function pairKey(a, b) { return a + '_' + b; }
