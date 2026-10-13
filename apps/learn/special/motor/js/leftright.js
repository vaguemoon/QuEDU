'use strict';

var _lrLevel     = null;
var _lrSeq       = null;  // 這一輪的左右順序（見 leftright-data.js）
var _lrIndex     = 0;
var _lrAccepting = false; // 語音播完、可以接受拍按鈕之前都先擋住，逼學生真的要聽完指令

function openLeftRight(levelIdx) {
  currentModule   = 'leftright';
  currentLevelIdx = levelIdx;
  _lrLevel = LEFTRIGHT_LEVELS[levelIdx];
  _lrSeq   = generateLeftRightRounds(_lrLevel);
  _lrIndex = 0;

  document.getElementById('game-title').textContent = _lrLevel.title;
  document.getElementById('game-hint').textContent = '仔細聽！聽到「左」拍左箭頭，聽到「右」拍右箭頭';
  showSandbox('leftright-sandbox');
  showPage('game');
  _lrUpdateStats();
  setTimeout(_lrPlayRound, 400); // 等畫面切換動畫跑完再出題
}

function _lrUpdateStats() {
  var el = document.getElementById('game-progress');
  if (el) el.textContent = _lrIndex + ' / ' + _lrLevel.rounds;
}

function _lrPlayRound() {
  _lrAccepting = false;
  var leftBtn  = document.getElementById('lr-btn-left');
  var rightBtn = document.getElementById('lr-btn-right');
  leftBtn.classList.remove('lr-correct', 'lr-wrong');
  rightBtn.classList.remove('lr-correct', 'lr-wrong');
  leftBtn.disabled = true;
  rightBtn.disabled = true;

  var ear = document.getElementById('lr-ear-icon');
  if (ear) ear.classList.add('lr-ear-pulse');

  var target = _lrSeq[_lrIndex];
  _motorSpeak(target === 'left' ? '左' : '右');

  /* 固定節奏，不計時：給一段緩衝時間讓語音講完才開放拍按鈕，不是講話同時就能亂拍矇答案 */
  setTimeout(function() {
    if (ear) ear.classList.remove('lr-ear-pulse');
    _lrAccepting = true;
    leftBtn.disabled = false;
    rightBtn.disabled = false;
  }, 700);
}

/* 喇叭圖示可以重複點，再聽一次這一題的指令——不管當下是「還沒開放拍」還是「已經可以拍」
   都能點，讓學生沒聽清楚時隨時可以再聽，不用等下一輪 */
function lrReplay() {
  if (!_lrSeq || _lrIndex >= _lrLevel.rounds) return;
  var target = _lrSeq[_lrIndex];
  _motorSpeak(target === 'left' ? '左' : '右');
  var ear = document.getElementById('lr-ear-icon');
  if (ear) {
    ear.classList.add('lr-ear-pulse');
    setTimeout(function() { ear.classList.remove('lr-ear-pulse'); }, 700);
  }
}

function lrTap(side) {
  if (!_lrAccepting) return;
  var target = _lrSeq[_lrIndex];
  var btn = document.getElementById('lr-btn-' + side);

  if (side === target) {
    _lrAccepting = false;
    btn.classList.add('lr-correct');
    sfxCorrect();
    flashBox('leftright-sandbox', 'green');
    _lrIndex++;
    _lrUpdateStats();
    if (_lrIndex >= _lrLevel.rounds) {
      setTimeout(function() {
        addStar('leftright', _lrLevel.id);
        showResult(_lrLevel.title, 'leftright');
      }, 600);
    } else {
      setTimeout(_lrPlayRound, 900);
    }
  } else {
    sfxWrong();
    flashBox('leftright-sandbox', 'red');
    if (navigator.vibrate) { try { navigator.vibrate(80); } catch (e) {} }
    btn.classList.add('lr-wrong');
    setTimeout(function() { btn.classList.remove('lr-wrong'); }, 400);
    /* _lrAccepting 保持 true，讓學生可以直接再試一次，不會因為拍錯一次就卡住或判失敗 */
  }
}
