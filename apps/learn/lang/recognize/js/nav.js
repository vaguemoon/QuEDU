/**
 * nav.js — 畫面切換與導覽堆疊
 */
'use strict';

var PAGE_STACK = [];
var PAGE_CONFIG = {
  'curriculum':        { title: '🔊 <span>認字趣</span>',    back: false },
  'menu':              { title: '📋 <span>字詞列表</span>',   back: true  },
  'practice':          { title: '🎯 <span>練習模式</span>',   back: false },
  'practice-result':   { title: '✅ <span>練習完成</span>',   back: true  },
  'exam':              { title: '📝 <span>測驗模式</span>',   back: false },
  'exam-round-result': { title: '📊 <span>本輪結算</span>',   back: false },
  'exam-result':       { title: '🏆 <span>測驗結果</span>',   back: true  },
  'settings':          { title: '⚙️ <span>設定</span>',       back: true  }
};
var currentPage = 'curriculum';

function showPage(name, pushHistory) {
  if (pushHistory === undefined) pushHistory = true;
  document.querySelectorAll('.page').forEach(function(el){ el.classList.remove('active'); });
  var el = document.getElementById('page-' + name);
  if (el) el.classList.add('active');
  var cfg = PAGE_CONFIG[name] || { title: '', back: true };
  if (pushHistory) PAGE_STACK.push(name);
  currentPage = name;

  var titleEl = document.getElementById('topbar-title');
  var backBtn = document.getElementById('topbar-back');
  var bcEl    = document.getElementById('topbar-breadcrumb');

  if (name === 'curriculum') {
    var cStep = (typeof currSelectedBook !== 'undefined' && currSelectedBook) ? 3
              : (typeof currSelectedVer  !== 'undefined' && currSelectedVer)  ? 2 : 1;
    if (typeof updateTopbarBreadcrumb === 'function') updateTopbarBreadcrumb(cStep);
  } else {
    if (bcEl) bcEl.classList.add('hidden');
    if (titleEl) { titleEl.innerHTML = cfg.title; titleEl.classList.remove('hidden'); }
  }

  if (backBtn) backBtn.classList.toggle('hidden', !cfg.back);

  if (name === 'menu' && typeof renderMenu === 'function') renderMenu();
}

function goBack() {
  if (currentPage === 'curriculum' && typeof currStep !== 'undefined' && currStep > 1) {
    goToCurrStep(currStep - 1);
    return;
  }
  if (PAGE_STACK.length > 1) {
    PAGE_STACK.pop();
    showPage(PAGE_STACK[PAGE_STACK.length - 1], false);
  }
}

function backToHub() {
  try { window.parent.postMessage({ type: 'recognize-back-to-hub' }, '*'); } catch(e) {}
}
