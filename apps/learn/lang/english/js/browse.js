'use strict';

var browseIdx     = 0;
var browseFlipped = false;

function startBrowse() {
  if (!englishImages.length) { showToast('此單元尚無圖片，請等老師上傳'); return; }
  currentMode   = 'browse';
  browseIdx     = 0;
  browseFlipped = false;
  _renderBrowse();
  showPage('browse');
}

function _renderBrowse() {
  var inner = document.querySelector('#page-browse .en-page-inner');
  if (!inner) return;

  var item = englishImages[browseIdx];
  var n    = englishImages.length;

  inner.innerHTML =
    '<div class="en-browse-wrap">' +
      '<div class="en-browse-counter">' + (browseIdx + 1) + ' / ' + n + '</div>' +

      '<div class="en-flip-card' + (browseFlipped ? ' flipped' : '') + '" id="browse-card" onclick="browseFlip()">' +
        '<div class="en-flip-inner">' +
          '<div class="en-flip-front">' +
            '<img src="' + _escAttr(item.imageUrl) + '" alt="">' +
            '<div class="en-flip-hint">點擊翻轉</div>' +
          '</div>' +
          '<div class="en-flip-back">' +
            (item.phoneticGroup
              ? '<div class="en-phonics-badge">' + _escHtml(item.phoneticGroup) + '</div>'
              : '') +
            '<div class="en-flip-back-word">' +
              _highlightPhonics(item.word, item.phoneticGroup) +
            '</div>' +
            '<div class="en-flip-back-tap">🔊 點擊發音</div>' +
            '<button class="en-flip-back-return" onclick="event.stopPropagation();browseFlipReset()">↩ 翻回</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="en-browse-nav">' +
        '<button class="en-nav-btn" onclick="browsePrev()" ' + (browseIdx === 0 ? 'disabled' : '') + '>◀</button>' +
        '<div class="en-prog-dots">' + _buildDots() + '</div>' +
        '<button class="en-nav-btn" onclick="browseNext()" ' + (browseIdx === n - 1 ? 'disabled' : '') + '>▶</button>' +
      '</div>' +
    '</div>';
}

function _highlightPhonics(word, group) {
  if (!group) return _escHtml(word);
  var lw = word.toLowerCase();
  var lg = group.toLowerCase();
  var i  = lw.indexOf(lg);
  if (i === -1) return _escHtml(word);
  return _escHtml(word.slice(0, i)) +
    '<span class="en-phonics-hl">' + _escHtml(word.slice(i, i + group.length)) + '</span>' +
    _escHtml(word.slice(i + group.length));
}

function _buildDots() {
  return englishImages.map(function(item, i) {
    return '<span class="en-prog-dot ' + (i === browseIdx ? 'current' : 'gray') +
      '" onclick="browseGoTo(' + i + ')"></span>';
  }).join('');
}

/* 點擊卡片：正面 → 翻轉＋發音；背面 → 只發音 */
function browseFlip() {
  if (!browseFlipped) {
    browseFlipped = true;
    var card = document.getElementById('browse-card');
    if (card) card.classList.add('flipped');
    setTimeout(function() { enSpeak(null, englishImages[browseIdx].word); }, 380);
  } else {
    enSpeak(null, englishImages[browseIdx].word);
  }
}

/* ↩ 翻回按鈕專用（已由按鈕 stopPropagation 阻擋 browseFlip）*/
function browseFlipReset() {
  browseFlipped = false;
  var card = document.getElementById('browse-card');
  if (card) card.classList.remove('flipped');
}

function browsePrev() {
  if (browseIdx > 0) { browseIdx--; browseFlipped = false; _renderBrowse(); }
}

function browseNext() {
  if (browseIdx < englishImages.length - 1) { browseIdx++; browseFlipped = false; _renderBrowse(); }
}

function browseGoTo(i) {
  browseIdx = i; browseFlipped = false; _renderBrowse();
}

function enSpeak(evt, word) {
  if (evt) evt.stopPropagation();
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  var utt  = new SpeechSynthesisUtterance(word);
  utt.lang = 'en-US';
  window.speechSynthesis.speak(utt);
}
