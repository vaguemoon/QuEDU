/**
 * init.js — 語文練習子 App 啟動
 * 依賴：shared.js（initSubPage）、state.js（currentStudent、loadQuestions）
 */
'use strict';

window.addEventListener('load', function() {
  initSubPage(function(student) {
    currentStudent = student;

    // 更新 topbar 學生資訊
    var avatarEl = document.getElementById('topbar-avatar');
    var nameEl   = document.getElementById('topbar-name');
    if (avatarEl) avatarEl.textContent = student.avatar || '🐣';
    if (nameEl)   nameEl.textContent   = student.nickname || student.name;

    // 載入題庫（Firebase 優先，失敗降級至內嵌）
    loadQuestions();
  });
});
