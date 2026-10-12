'use strict';

/* 辨認左右關卡資料——純聽覺指令（不給視覺提示，避免用猜的），
 * 聽到「左邊」拍左箭頭、「右邊」拍右箭頭。固定節奏出題，不計時、不加速，
 * 跟線條練習／找一樣一樣，答錯只是溫和提示＋原地重試，不會直接判失敗。 */
var LEFTRIGHT_LEVELS = [
  { id: 'basic', title: '👂 聽方向拍一拍', icon: '👂', rounds: 10 }
];

/* 每次開關卡重新隨機出一輪左右順序，不是固定內容 */
function generateLeftRightRounds(level) {
  var seq = [];
  for (var i = 0; i < level.rounds; i++) {
    seq.push(Math.random() < 0.5 ? 'left' : 'right');
  }
  return seq;
}
