/**
 * nav.js — 畫面切換與導覽堆疊
 */
'use strict';

var PAGE_STACK = [];
var PAGE_CONFIG = {
  'mode-select':  { title: '🧩 <span>部件趣</span>',   back: false },
  'curriculum':   { title: '📚 <span>課本生字</span>', back: true  },
  'teacher-sets': { title: '🧩 <span>老師自建</span>', back: true  },
  'menu':         { title: '選擇模式',                  back: true  },
  'quiz':         { title: '練習中',                    back: true  },
  'memory':       { title: '配對消除',                  back: true  },
  'write':        { title: '部件描寫',                  back: true  },
  'snap':         { title: '部件拼貼',                  back: true  },
  'settings':     { title: '⚙️ <span>設定</span>',     back: true  }
};
var currentPage = 'mode-select';

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
  var bcEl    = document.getElementById('topbar-breadcrumb');

  if (name === 'curriculum') {
    // 課本生字：依目前步驟渲染麵包屑，交給 curriculum.js 處理
    var cStep = (typeof currSelectedBook !== 'undefined' && currSelectedBook) ? 3
              : (typeof currSelectedVer  !== 'undefined' && currSelectedVer)  ? 2 : 1;
    if (typeof updateTopbarBreadcrumb === 'function') updateTopbarBreadcrumb(cStep);
  } else {
    if (bcEl) bcEl.classList.add('hidden');
    if (titleEl) { titleEl.innerHTML = cfg.title; titleEl.classList.remove('hidden'); }
  }

  if (backBtn) backBtn.classList.toggle('hidden', !cfg.back);
}

function goBack() {
  // 課本生字選擇頁：返回麵包屑上一層，而非跳出課程選擇
  if (currentPage === 'curriculum' && typeof currStep !== 'undefined' && currStep > 1) {
    goToCurrStep(currStep - 1);
    return;
  }
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
