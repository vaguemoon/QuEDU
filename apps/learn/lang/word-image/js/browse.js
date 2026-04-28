'use strict';

var browseIdx     = 0;
var browseFlipped = false;

function startBrowse() {
  if (!wordImages.length) { showToast('此課次尚無圖片詞語'); return; }
  currentMode   = 'browse';
  browseIdx     = 0;
  browseFlipped = false;
  _renderBrowse();
  showPage('browse');
}

function _renderBrowse() {
  var inner = document.querySelector('#page-browse .wi-page-inner');
  if (!inner) return;

  var item = wordImages[browseIdx];
  var n    = wordImages.length;
  var hasQuiz  = n >= 2;

  inner.innerHTML =
    '<div class="wi-browse-wrap">' +
      '<div class="wi-browse-counter">' + (browseIdx + 1) + ' / ' + n + '</div>' +

      '<div class="wi-flip-card' + (browseFlipped ? ' flipped' : '') + '" id="browse-card" onclick="browseFlip()">' +
        '<div class="wi-flip-inner">' +
          '<div class="wi-flip-front">' +
            '<img src="' + _escAttr(item.imageUrl) + '" alt="">' +
          '</div>' +
          '<div class="wi-flip-back">' +
            '<div class="wi-flip-back-word" data-speak="' + _escAttr(item.word) + '" onclick="wiSpeak(event,this)">' + _escHtml(item.word) + '</div>' +
            '<div class="wi-flip-back-def" data-speak="' + _escAttr(item.definition) + '" onclick="wiSpeak(event,this)">' + _escHtml(item.definition) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="wi-browse-nav">' +
        '<button class="wi-nav-btn" onclick="browsePrev()" ' + (browseIdx === 0 ? 'disabled' : '') + '>◀</button>' +
        '<div class="wi-prog-dots">' + _buildDots() + '</div>' +
        '<button class="wi-nav-btn" onclick="browseNext()" ' + (browseIdx === n - 1 ? 'disabled' : '') + '>▶</button>' +
      '</div>' +

      '<div class="wi-browse-actions">' +
        (hasQuiz  ? '<button class="wi-btn-primary"    onclick="startQuiz()">🎯 看圖猜詞</button>'  : '') +
      '</div>' +
    '</div>';
}

function _buildDots() {
  return wordImages.map(function(item, i) {
    var cls = getProgressClass(item.word);
    if (i === browseIdx) cls += ' current';
    return '<span class="wi-prog-dot ' + cls + '" onclick="browseGoTo(' + i + ')" title="' +
      _escAttr(item.word) + '"></span>';
  }).join('');
}

function browseFlip() {
  browseFlipped = !browseFlipped;
  var card = document.getElementById('browse-card');
  if (card) card.classList.toggle('flipped', browseFlipped);
}

function browsePrev() {
  if (browseIdx > 0) { browseIdx--; browseFlipped = false; _renderBrowse(); }
}

function browseNext() {
  if (browseIdx < wordImages.length - 1) { browseIdx++; browseFlipped = false; _renderBrowse(); }
}

function browseGoTo(i) {
  browseIdx = i; browseFlipped = false; _renderBrowse();
}

function wiSpeak(evt, el) {
  evt.stopPropagation();
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  var utt = new SpeechSynthesisUtterance(el.dataset.speak);
  utt.lang = 'zh-TW';
  window.speechSynthesis.speak(utt);
}
