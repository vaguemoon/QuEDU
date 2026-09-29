/**
 * nav.js — 畫面切換與導覽堆疊
 */
'use strict';

var PAGE_STACK = [];
var PAGE_CONFIG = {
  'zy-section-select':    { title: '🔤 <span>注音趣</span>',   back: false }, // 最頂層：單音／結合韻
  'mode-select':          { title: '',                         back: true  }, // 標題依區域動態設定，見 enterZySection()
  'grid':                 { title: '',                         back: true  }, // 標題依區域動態設定，見 enterZyGrid()
  'zy-menu':              { title: '',                         back: true  }, // 標題依區域＋方向動態設定，見 _zySetDirectionTitle()
  'zy-practice':          { title: '',                         back: true  },
  'zy-exam':              { title: '',                         back: true  },
  'zy-exam-round-result': { title: '',                         back: true  },
  'zy-exam-result':       { title: '',                         back: true  },
  'settings':             { title: '⚙️ <span>設定</span>',     back: true  }
};
var currentPage = 'zy-section-select';

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

  /* 幾個頁面的標題依目前區域／方向動態決定，PAGE_CONFIG 裡只能留空字串。
     用明確的 enterXxx() 進入時會自己補設標題，但走「← 返回」這種通用路徑
     （goBack 直接呼叫 showPage）不會經過那些函式，這裡統一補回正確標題，
     避免返回時 Topbar 顯示空白 */
  if (typeof _zyRefreshTitleFor === 'function') _zyRefreshTitleFor(name);
}

function goBack() {
  if (PAGE_STACK.length > 1) {
    PAGE_STACK.pop();
    var prev = PAGE_STACK[PAGE_STACK.length - 1];
    showPage(prev, false);
  }
}

function backToHub() {
  try { window.parent.postMessage({ type: 'zhuyin-back-to-hub' }, '*'); } catch (e) {}
}

/* ── 頂端列學生選單 ── */
function toggleLogoutMenu() {
  var menu = document.getElementById('topbar-logout-menu');
  if (menu) menu.classList.toggle('hidden');
}

function sendLogout(evt) {
  if (evt) evt.stopPropagation();
  try { window.parent.postMessage({ type: 'zhuyin-logout' }, '*'); } catch (e) {}
}

document.addEventListener('click', function(e) {
  var student = document.getElementById('topbar-student');
  var menu    = document.getElementById('topbar-logout-menu');
  if (menu && !menu.classList.contains('hidden') && student && !student.contains(e.target)) {
    menu.classList.add('hidden');
  }
});
