/**
 * menu.js — 注音符號表渲染
 */
'use strict';

function renderZhuyinGrid() {
  var wrap = document.getElementById('zy-grid-wrap');
  if (!wrap) return;

  wrap.innerHTML =
    '<div class="zy-section-title">聲符</div>' +
    '<div class="zy-grid">' + ZHUYIN_INITIALS.map(_zySymbolCardHtml).join('') + '</div>' +
    '<div class="zy-section-title">韻符</div>' +
    '<div class="zy-grid">' + ZHUYIN_FINALS.map(_zySymbolCardHtml).join('') + '</div>';
}

function _zySymbolCardHtml(symbol) {
  var d = zhuyinData[symbol] || {};
  var imgInner = d.imageUrl
    ? '<img class="zy-image" src="' + d.imageUrl + '" alt="">'
    : '<div class="zy-image zy-image-empty">🖼️</div>';

  return '<div class="zy-card">' +
    '<button class="zy-symbol" onclick="zySpeakSymbol(\'' + symbol + '\')">' + symbol + '</button>' +
    '<button class="zy-image-btn" onclick="zySpeakPhrase(\'' + symbol + '\')">' + imgInner + '</button>' +
  '</div>';
}
