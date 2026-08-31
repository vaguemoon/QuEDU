/**
 * nav.js — 畫面切換與導覽堆疊
 * 負責：showPage()、goBack()、PAGE_STACK、PAGE_CONFIG、backToHub()
 */
'use strict';

var PAGE_STACK = [];
var PAGE_CONFIG = {
  'home':        { title: '↔ <span>換算趣</span>',    back: false },
  'select':      { title: '📋 <span>選擇題型</span>',  back: true  },
  'game':        { title: '✏️ <span>練習中</span>',    back: true  },
  'result':      { title: '📊 <span>本輪結果</span>',  back: false },
  'settings':    { title: '⚙️ <span>設定</span>',      back: true  },
  'achievement': { title: '🏆 <span>我的成就</span>',  back: true  },
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

  if (name === 'achievement' && typeof renderAchievementPage === 'function') {
    renderAchievementPage();
  }
}

function goBack() {
  if (PAGE_STACK.length > 1) {
    PAGE_STACK.pop();
    showPage(PAGE_STACK[PAGE_STACK.length - 1], false);
  }
}

function backToHub() {
  try { window.parent.postMessage({ type: 'convert-back-to-hub' }, '*'); } catch(e) {}
}
