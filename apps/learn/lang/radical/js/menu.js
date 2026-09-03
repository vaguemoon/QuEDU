/**
 * menu.js — 練習集清單 + 模式選擇頁
 */
'use strict';

function renderEntryPage() {
  var wrap = document.getElementById('entry-list');
  if (!wrap) return;

  if (!assignedSets.length) {
    wrap.innerHTML =
      '<div class="rk-empty">🧩 老師還沒有指派練習集給你的班級<br>請等老師建立後再回來看看</div>';
    return;
  }

  wrap.innerHTML = '<div class="rk-set-list">' +
    assignedSets.map(function(s) {
      return '<button class="rk-set-card" onclick="selectSet(\'' + s.id + '\',\'' + _rkQEscAttr(s.name) + '\')">' +
        '<div class="rk-set-icon">🧩</div>' +
        '<div><div class="rk-set-name">' + escHtml(s.name) + '</div>' +
        '<div class="rk-set-sub">點擊開始練習</div></div>' +
      '</button>';
    }).join('') +
  '</div>';
}

function renderModeMenu() {
  var wrap = document.getElementById('menu-radical-progress');
  if (!wrap) return;

  var radicals = getDistinctRadicals();
  if (!radicals.length) {
    wrap.innerHTML = '<div class="rk-empty" style="padding:16px 0">這個練習集還沒有內容</div>';
    return;
  }

  wrap.innerHTML = '<div class="rk-progress-list">' +
    radicals.map(function(r) {
      var status = radicalStatus[r] || 'new';
      var label  = status === 'mastered' ? '已熟練' : (status === 'practiced' ? '練習中' : '尚未練習');
      return '<span class="rk-progress-chip ' + status + '">' + escHtml(r) + '　' + label + '</span>';
    }).join('') +
  '</div>';
}

function _rkQEscAttr(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
