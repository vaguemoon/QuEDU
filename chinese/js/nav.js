/**
 * nav.js — 畫面切換與導覽堆疊
 * 負責：showPage()、goBack()、PAGE_STACK、PAGE_CONFIG
 */
'use strict';

var PAGE_STACK = [];
var PAGE_CONFIG = {
  'mode-select': { title:'✏️ <span>練字趣</span>', back:false },
  'curriculum':  { title:'📚 <span>選擇課程</span>',    back:true  },
  'free':        { title:'✏️ <span>自由練習</span>',    back:true  },
  'menu':        { title:'📋 <span>今天的生字</span>',  back:true  },
  'mode':        { title:'選擇模式',                     back:true  },
  'learn':       { title:'學習中',                       back:false },
  'exam':        { title:'今日測驗',                     back:false }
};
var currentPage = 'mode-select';

function showPage(name, pushHistory) {
  if (pushHistory === undefined) pushHistory = true;
  document.querySelectorAll('.page').forEach(function(el){ el.classList.remove('active'); });
  var el = document.getElementById('page-' + name);
  if (el) el.classList.add('active');
  var cfg = PAGE_CONFIG[name] || { title:'', back:true };
  if (pushHistory) PAGE_STACK.push(name);
  currentPage = name;

  // 更新頂端列
  var titleEl = document.getElementById('topbar-title');
  var backBtn = document.getElementById('topbar-back');
  var bcEl    = document.getElementById('topbar-breadcrumb');

  if (name === 'mode-select' || name === 'free') {
    // 這兩個頁面強制顯示標題、隱藏麵包屑
    if (titleEl) { titleEl.innerHTML = cfg.title; titleEl.classList.remove('hidden'); }
    if (bcEl) bcEl.classList.add('hidden');
  } else if (name === 'curriculum') {
    // 課程選擇：判斷目前步驟，讓 curriculum.js 渲染麵包屑
    var cStep = (typeof currSelectedBook !== 'undefined' && currSelectedBook) ? 3
              : (typeof currSelectedVer  !== 'undefined' && currSelectedVer)  ? 2 : 1;
    if (typeof updateTopbarBreadcrumb === 'function') updateTopbarBreadcrumb(cStep);
  } else {
    // menu / learn / exam / mode：若麵包屑已在顯示就不動；否則顯示標題
    var bcVisible = bcEl && !bcEl.classList.contains('hidden');
    if (!bcVisible && titleEl) { titleEl.innerHTML = cfg.title; }
  }

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
  try { window.parent.postMessage({ type: 'hanzi-back-to-hub' }, '*'); } catch(e) {}
}
