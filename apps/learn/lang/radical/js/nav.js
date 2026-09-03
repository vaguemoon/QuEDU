/**
 * nav.js — 畫面切換與導覽堆疊
 */
'use strict';

var PAGE_STACK = [];
var PAGE_CONFIG = {
  'entry':    { title: '🧩 <span>部件趣</span>', back: false },
  'menu':     { title: '選擇模式',                back: true  },
  'quiz':     { title: '練習中',                  back: false },
  'memory':   { title: '翻牌配對',                back: false },
  'write':    { title: '部件描寫',                back: false },
  'settings': { title: '⚙️ <span>設定</span>',   back: true  }
};
var currentPage = 'entry';

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
  if (titleEl) titleEl.innerHTML = cfg.title;
  if (backBtn) backBtn.classList.toggle('hidden', !cfg.back);
}

function goBack() {
  if (PAGE_STACK.length > 1) {
    PAGE_STACK.pop();
    var prev = PAGE_STACK[PAGE_STACK.length - 1];
    showPage(prev, false);
  }
}

function backToHub() {
  try { window.parent.postMessage({ type: 'radical-back-to-hub' }, '*'); } catch (e) {}
}

/* ── 頂端列學生選單 ── */
function toggleLogoutMenu() {
  var menu = document.getElementById('topbar-logout-menu');
  if (menu) menu.classList.toggle('hidden');
}

function sendLogout(evt) {
  if (evt) evt.stopPropagation();
  try { window.parent.postMessage({ type: 'radical-logout' }, '*'); } catch (e) {}
}

document.addEventListener('click', function(e) {
  var student = document.getElementById('topbar-student');
  var menu    = document.getElementById('topbar-logout-menu');
  if (menu && !menu.classList.contains('hidden') && student && !student.contains(e.target)) {
    menu.classList.add('hidden');
  }
});
