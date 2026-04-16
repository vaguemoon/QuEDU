/**
 * nav.js — 語文練習子 App 頁面導覽
 * 依賴：shared.js（postMessage 規格）
 */
'use strict';

/* 返回 Hub */
function backToHub() {
  try { window.parent.postMessage({ type: 'chinese-quiz-back-to-hub' }, '*'); } catch(e) {}
  // 若非 iframe 模式（直接開啟）則導回 index.html
  if (window.self === window.top) {
    window.location.href = '../index.html';
  }
}

/* 顯示出題設定畫面 */
function showSetup() {
  document.getElementById('setup-panel').style.display = '';
  document.getElementById('quiz-panel').style.display  = 'none';
  document.getElementById('score-panel').style.display = 'none';
  document.getElementById('quiz-footer').style.display = 'none';
  window.scrollTo(0, 0);
}

/* 顯示作答畫面 */
function showQuiz() {
  document.getElementById('setup-panel').style.display = 'none';
  document.getElementById('quiz-panel').style.display  = '';
  document.getElementById('score-panel').style.display = 'none';
  document.getElementById('quiz-footer').style.display = 'flex';
  window.scrollTo(0, 0);
}

/* 顯示成績畫面 */
function showScore() {
  document.getElementById('setup-panel').style.display = 'none';
  document.getElementById('quiz-panel').style.display  = 'none';
  document.getElementById('score-panel').style.display = '';
  document.getElementById('quiz-footer').style.display = 'none';
  window.scrollTo(0, 0);
}

/* 再來一次（回到設定頁）*/
function backToSetup() {
  showSetup();
}
