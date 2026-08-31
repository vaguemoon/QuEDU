'use strict';

var PAGE_STACK = [];
var PAGE_CONFIG = {
  'home':     { title: '↔ <span>移項趣</span>', back: false },
  'game':     { title: '✏️ <span>練習中</span>',  back: true  },
  'result':   { title: '📊 <span>練習結果</span>', back: false },
  'settings': { title: '⚙️ <span>設定</span>',     back: true  }
};
var currentPage = 'home';

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
    showPage(PAGE_STACK[PAGE_STACK.length - 1], false);
  }
}

function backToHub() {
  try { window.parent.postMessage({ type: 'transpose-back-to-hub' }, '*'); } catch(e) {}
}
