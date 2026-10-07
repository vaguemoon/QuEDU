'use strict';

/* 著色小畫家關卡資料 — viewBox 0 0 200 200
 * regions：依畫面上下疊放順序排列（後面的畫在上面），每個區域指定要畫的 SVG 圖形
 *          （shape + attrs）跟它屬於哪個「角色」（role，角色才是跟顏色/注音綁在一起的，
 *          不是區域直接綁顏色）——這樣同一個角色可以同時對應好幾個區域（像聖誕樹三層
 *          樹葉都算同一個角色，裝飾球分兩色交錯），跟參考圖的設計一致。
 * roleCount：這張圖總共用到幾種顏色/注音。每次開關卡會重新隨機抽 roleCount 個注音
 *            符號、配對 roleCount 個顏色，圖案結構（哪塊區域屬於哪個角色）不會變，
 *            但「這個角色現在對應哪個注音、哪個顏色」每次都不一樣，不能靠背位置矇過去。
 */
var COLOR_PALETTE = [
  { key: 'red',    hex: '#e74c3c' },
  { key: 'orange', hex: '#e67e22' },
  { key: 'yellow', hex: '#f1c40f' },
  { key: 'green',  hex: '#27ae60' },
  { key: 'blue',   hex: '#3498db' },
  { key: 'purple', hex: '#8e44ad' },
  { key: 'brown',  hex: '#8d6e63' },
  { key: 'pink',   hex: '#e91e8c' }
];

var COLOR_LEVELS = [
  {
    id: 'tree', title: '🎄 聖誕樹', icon: '🎄', roleCount: 5,
    regions: [
      { shape: 'polygon', attrs: { points: '30,165 170,165 100,120' }, role: 0 }, // 下層樹葉
      { shape: 'polygon', attrs: { points: '45,130 155,130 100,85' },  role: 0 }, // 中層樹葉
      { shape: 'polygon', attrs: { points: '60,95 140,95 100,50' },    role: 0 }, // 上層樹葉
      { shape: 'rect',    attrs: { x: 85, y: 165, width: 30, height: 28 }, role: 1 }, // 樹幹
      { shape: 'polygon', attrs: { points: '100,12 104.7,25.5 119,25.8 107.6,34.5 111.8,48.2 100,40 88.2,48.2 92.4,34.5 81,25.8 95.3,25.5' }, role: 2 }, // 星星
      { shape: 'circle', attrs: { cx: 70,  cy: 145, r: 8 }, role: 3 },
      { shape: 'circle', attrs: { cx: 130, cy: 145, r: 8 }, role: 4 },
      { shape: 'circle', attrs: { cx: 100, cy: 108, r: 7 }, role: 3 },
      { shape: 'circle', attrs: { cx: 85,  cy: 70,  r: 6 }, role: 4 }
    ]
  }
];

/* 每次開關卡重新抽：從注音表隨機挑 roleCount 個不重複符號、從色票隨機挑 roleCount 個
   不重複顏色，一對一配對成這一輪的「角色對照表」 */
function generateColorRoles(level) {
  var n = level.roleCount;

  var zhuyinPool = ZHUYIN_SEQUENCE.slice();
  for (var i = zhuyinPool.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = zhuyinPool[i]; zhuyinPool[i] = zhuyinPool[j]; zhuyinPool[j] = t;
  }
  var symbols = zhuyinPool.slice(0, n);

  var colorPool = COLOR_PALETTE.slice();
  for (i = colorPool.length - 1; i > 0; i--) {
    j = Math.floor(Math.random() * (i + 1));
    t = colorPool[i]; colorPool[i] = colorPool[j]; colorPool[j] = t;
  }
  var colors = colorPool.slice(0, n);

  var roles = [];
  for (i = 0; i < n; i++) roles.push({ symbol: symbols[i], color: colors[i] });
  return roles;
}
