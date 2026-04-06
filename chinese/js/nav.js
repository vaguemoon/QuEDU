/**
 * nav.js — 畫面切換與導覽堆疊
 * 負責：showPage()、goBack()、PAGE_STACK、PAGE_CONFIG
 */
'use strict';

var PAGE_STACK = [];
var PAGE_CONFIG = {
  'mode-select': { title:'✏️ <span>國字學習系統</span>', back:false },
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
  try { window.parent.postMessage({ type: 'hanzi-back-to-hub' }, '*'); } catch(e) {}
}
