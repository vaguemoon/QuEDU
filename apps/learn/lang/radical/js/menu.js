/**
 * menu.js — 練習集清單 + 模式選擇頁
 */
'use strict';

function renderEntryPage() {
  var wrap = document.getElementById('entry-list');
  if (!wrap) return;

  if (!radicalGroupList.length) {
    wrap.innerHTML =
      '<div class="rk-empty">🧩 老師還沒有建立任何部件<br>請等老師建立後再回來看看</div>';
    return;
  }

  wrap.innerHTML = '<div class="rk-set-list">' +
    radicalGroupList.map(function(g) {
      var icon = g.imageUrl
        ? '<img class="rk-set-icon-img" src="' + g.imageUrl + '" alt="">'
        : '<div class="rk-set-icon">🧩</div>';
      var sub = g.chars.length ? g.chars.length + ' 個字' : '點擊開始練習';
      return '<button class="rk-set-card" onclick="selectRadicalGroup(\'' + _rkQEscAttr(g.radical) + '\')">' +
        icon +
        '<div><div class="rk-set-name">' + escHtml(g.title) + '</div>' +
        '<div class="rk-set-sub">' + escHtml(sub) + '</div></div>' +
      '</button>';
    }).join('') +
  '</div>';
}

/* curriculum.js 選好課次後統一呼叫的渲染入口（沿用練習集的模式選擇頁） */
function renderMenu() {
  var titleEl = document.getElementById('menu-set-title');
  if (titleEl) titleEl.textContent = currentSetName;
  renderModeMenu();
}

function renderModeMenu() {
  var wrap = document.getElementById('menu-radical-progress');
  if (wrap) {
    var radicals = getDistinctRadicals();
    if (!radicals.length) {
      wrap.innerHTML = '<div class="rk-empty" style="padding:16px 0">這個練習集還沒有內容</div>';
    } else {
      wrap.innerHTML = '<div class="rk-progress-list">' +
        radicals.map(function(r) {
          var status = radicalStatus[r] || 'new';
          var label  = status === 'mastered' ? '已熟練' : (status === 'practiced' ? '練習中' : '尚未練習');
          return '<span class="rk-progress-chip ' + status + '">' + escHtml(r) + '　' + label + '</span>';
        }).join('') +
      '</div>';
    }
  }

  if (typeof _rkRefreshDecompCard === 'function') _rkRefreshDecompCard();
}

/* ── 拼貼進度（部件拼貼遊戲，依 currentDecompItems 顯示） ── */
function renderDecompProgress() {
  var titleEl = document.getElementById('decomp-progress-title');
  var wrap    = document.getElementById('menu-decomp-progress');
  if (!wrap || !titleEl) return;

  if (!currentDecompItems.length) {
    titleEl.style.display = 'none';
    wrap.innerHTML = '';
    return;
  }

  titleEl.style.display = '';
  wrap.innerHTML = '<div class="rk-progress-list">' +
    currentDecompItems.map(function(item) {
      var done = decompStatus[item.char] === 'done';
      return '<span class="rk-progress-chip ' + (done ? 'mastered' : 'new') + '">' + escHtml(item.char) + '　' + (done ? '已完成' : '尚未拼過') + '</span>';
    }).join('') +
  '</div>';
}

function _rkQEscAttr(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
