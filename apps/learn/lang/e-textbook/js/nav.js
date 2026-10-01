/**
 * nav.js — 畫面切換與導覽堆疊
 */
'use strict';

var PAGE_STACK = [];
var PAGE_CONFIG = {
  'list':     { title: '📖 <span>課文趣</span>', back: false },
  'reader':   { title: '',                        back: true  }, // 標題依課文動態設定
  'settings': { title: '⚙️ <span>設定</span>',    back: true  }
};
var currentPage = 'list';

function showPage(name, pushHistory) {
  if (pushHistory === undefined) pushHistory = true;
  document.querySelectorAll('.page').forEach(function(el) { el.classList.remove('active'); });
  var el = document.getElementById('page-' + name);
  if (el) el.classList.add('active');
  var cfg = PAGE_CONFIG[name] || { title: '', back: true };
  if (pushHistory) PAGE_STACK.push(name);
  currentPage = name;

  var titleEl = document.getElementById('topbar-title');
  var backBtn = document.getElementById('topbar-back');
  if (titleEl && cfg.title) titleEl.innerHTML = cfg.title;
  if (backBtn) backBtn.classList.toggle('hidden', !cfg.back);
}

function goBack() {
  if (PAGE_STACK.length > 1) {
    PAGE_STACK.pop();
    var prev = PAGE_STACK[PAGE_STACK.length - 1];
    showPage(prev, false);
    if (prev === 'list' && typeof etCancelSpeak === 'function') { etCancelSpeak(); if (typeof etClearReadingHighlight === 'function') etClearReadingHighlight(); }
  }
}

function backToHub() {
  if (typeof etCancelSpeak === 'function') etCancelSpeak();
  try { window.parent.postMessage({ type: 'e-textbook-back-to-hub' }, '*'); } catch (e) {}
}

/* ── 頂端列學生選單 ── */
function toggleLogoutMenu() {
  var menu = document.getElementById('topbar-logout-menu');
  if (menu) menu.classList.toggle('hidden');
}

function sendLogout(evt) {
  if (evt) evt.stopPropagation();
  try { window.parent.postMessage({ type: 'e-textbook-logout' }, '*'); } catch (e) {}
}

document.addEventListener('click', function(e) {
  var student = document.getElementById('topbar-student');
  var menu    = document.getElementById('topbar-logout-menu');
  if (menu && !menu.classList.contains('hidden') && student && !student.contains(e.target)) {
    menu.classList.add('hidden');
  }
});
