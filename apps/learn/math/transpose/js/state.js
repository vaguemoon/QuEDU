'use strict';

// ── 學生資訊 ──
var currentStudent = null;

// ── 遊戲狀態 ──
var currentTopic  = '';     // 'addSub' | 'mulDiv' | 'twoStep' | 'withX'
var gameQ         = null;   // 當前題目物件
var gamePool      = [];     // 本次題目池
var gamePoolIdx   = 0;
var hearts        = 3;      // 剩餘愛心（0 = 遊戲結束）
var streak        = 0;      // 當前連勝
var maxStreak     = 0;      // 本場最高連勝
var totalCorrect  = 0;      // 本場答對數
var dragPhase     = 'dragging'; // 'dragging' | 'filling'
var fillInputStr  = '';

// ════════════════════════════════════════
//  工具函式
// ════════════════════════════════════════

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function flipOp(op) {
  return { '+': '-', '-': '+', '×': '÷', '÷': '×' }[op];
}
