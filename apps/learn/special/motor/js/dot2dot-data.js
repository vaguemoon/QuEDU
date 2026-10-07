'use strict';

/* 連連看關卡資料 — viewBox 0 0 200 200
 * points: 依序 0..N-1，連線時把 progress（已完成邊數）對應到 points[progress]→points[progress+1]
 * labelMode：'random' 每次開關卡隨機決定這一輪用注音還是數字出題（各半機率），見 dot2dot.js
 *            的 _d2dPickMode()；同一個圖形不分注音版/數字版，不用為了換出題方式重複建關卡。
 * 同一個圖形每次玩到的題目（數字範圍／注音段落）都不一樣，不能靠背位置矇過去，要真的看清楚
 * 當下標的是什麼。
 * 以下用類別分段，方便之後繼續擴充；id 不要改到已經存在的（學生的星星紀錄是用 id 存的）。
 */
var DOT2DOT_LEVELS = [
  /* ── 交通工具 ── */
  {
    id: 'car', title: '🚗 小汽車', icon: '🚗', labelMode: 'random',
    points: [
      { x: 15,  y: 150 }, { x: 15,  y: 120 }, { x: 55,  y: 120 }, { x: 75,  y: 90 },
      { x: 125, y: 90 },  { x: 145, y: 120 }, { x: 185, y: 120 }, { x: 185, y: 150 }
    ]
  },
  {
    id: 'rocket', title: '🚀 火箭', icon: '🚀', labelMode: 'random',
    points: [
      { x: 100, y: 10 }, { x: 125, y: 70 }, { x: 125, y: 150 }, { x: 150, y: 180 },
      { x: 100, y: 160 }, { x: 50,  y: 180 }, { x: 75,  y: 150 }, { x: 75,  y: 70 }
    ]
  },
  {
    id: 'train', title: '🚆 火車', icon: '🚆', labelMode: 'random',
    points: [
      { x: 15,  y: 155 }, { x: 15,  y: 60 },  { x: 70,  y: 60 },
      { x: 70,  y: 100 }, { x: 185, y: 100 }, { x: 185, y: 155 }
    ]
  },
  {
    id: 'boat', title: '⛵ 帆船', icon: '⛵', labelMode: 'random',
    points: [
      { x: 100, y: 30 }, { x: 140, y: 65 },  { x: 100, y: 100 }, { x: 100, y: 140 },
      { x: 150, y: 160 }, { x: 70,  y: 160 }, { x: 55,  y: 130 }
    ]
  },

  /* ── 動物 ── */
  {
    id: 'dino', title: '🦕 恐龍', icon: '🦕', labelMode: 'random',
    points: [
      { x: 20,  y: 170 }, { x: 20,  y: 120 }, { x: 40,  y: 100 }, { x: 55,  y: 75 },
      { x: 70,  y: 95 },  { x: 85,  y: 65 },  { x: 100, y: 95 },  { x: 115, y: 70 },
      { x: 140, y: 55 },  { x: 150, y: 100 }, { x: 130, y: 130 }, { x: 130, y: 170 }
    ]
  },
  {
    id: 'fish', title: '🐟 大魚', icon: '🐟', labelMode: 'random',
    points: [
      { x: 30,  y: 100 }, { x: 40,  y: 75 },  { x: 60,  y: 60 },  { x: 90,  y: 55 },
      { x: 120, y: 60 },  { x: 140, y: 75 },  { x: 165, y: 60 },  { x: 150, y: 100 },
      { x: 165, y: 140 }, { x: 140, y: 125 }, { x: 120, y: 140 }, { x: 90,  y: 145 },
      { x: 60,  y: 140 }, { x: 40,  y: 125 }
    ]
  },
  {
    id: 'cat', title: '🐱 貓咪', icon: '🐱', labelMode: 'random',
    points: [
      { x: 50,  y: 95 },  { x: 50,  y: 50 },  { x: 75,  y: 85 },  { x: 60,  y: 130 },
      { x: 100, y: 155 }, { x: 140, y: 130 }, { x: 125, y: 85 },  { x: 150, y: 50 },
      { x: 150, y: 95 }
    ]
  },
  {
    id: 'butterfly', title: '🦋 蝴蝶', icon: '🦋', labelMode: 'random',
    points: [
      { x: 50,  y: 40 },  { x: 20,  y: 75 },  { x: 45,  y: 100 }, { x: 25,  y: 140 },
      { x: 65,  y: 160 }, { x: 100, y: 130 }, { x: 135, y: 160 }, { x: 175, y: 140 },
      { x: 155, y: 100 }, { x: 180, y: 75 },  { x: 150, y: 40 },  { x: 100, y: 55 }
    ]
  },

  /* ── 植物 ── */
  {
    id: 'tree', title: '🌳 大樹', icon: '🌳', labelMode: 'random',
    points: [
      { x: 100, y: 25 },  { x: 145, y: 45 },  { x: 170, y: 85 },  { x: 150, y: 120 },
      { x: 115, y: 130 }, { x: 115, y: 175 }, { x: 85,  y: 175 }, { x: 85,  y: 130 },
      { x: 50,  y: 120 }, { x: 30,  y: 85 },  { x: 55,  y: 45 }
    ]
  },
  {
    id: 'mushroom', title: '🍄 蘑菇', icon: '🍄', labelMode: 'random',
    points: [
      { x: 100, y: 30 }, { x: 160, y: 55 },  { x: 185, y: 90 },  { x: 165, y: 100 },
      { x: 120, y: 95 }, { x: 120, y: 170 }, { x: 80,  y: 170 }, { x: 80,  y: 95 },
      { x: 35,  y: 100 }, { x: 15,  y: 90 },  { x: 40,  y: 55 }
    ]
  },
  {
    id: 'balloon', title: '🎈 氣球', icon: '🎈', labelMode: 'random',
    points: [
      { x: 100, y: 35 }, { x: 132, y: 46 }, { x: 152, y: 73 }, { x: 152, y: 107 },
      { x: 132, y: 135 }, { x: 100, y: 145 }, { x: 68,  y: 135 }, { x: 48,  y: 107 },
      { x: 48,  y: 73 },  { x: 68,  y: 46 }
    ]
  },

  /* ── 文具 ── */
  {
    id: 'pencil', title: '✏️ 鉛筆', icon: '✏️', labelMode: 'random',
    points: [
      { x: 20,  y: 115 }, { x: 150, y: 115 }, { x: 185, y: 100 }, { x: 150, y: 85 },
      { x: 20,  y: 85 }
    ]
  },
  {
    id: 'ruler', title: '📏 尺', icon: '📏', labelMode: 'random',
    points: [
      { x: 20,  y: 120 }, { x: 180, y: 120 }, { x: 180, y: 90 },  { x: 130, y: 90 },
      { x: 128, y: 98 },  { x: 126, y: 90 },  { x: 80,  y: 90 },  { x: 78,  y: 98 },
      { x: 76,  y: 90 },  { x: 20,  y: 90 }
    ]
  },

  /* ── 其他 ── */
  {
    id: 'house', title: '🏠 小房子', icon: '🏠', labelMode: 'random',
    points: [
      { x: 40,  y: 170 }, { x: 40,  y: 90 }, { x: 100, y: 30 },
      { x: 160, y: 90 },  { x: 160, y: 170 }
    ]
  },
  {
    id: 'star-zhuyin', title: '🌟 星星', icon: '🌟', labelMode: 'random',
    points: [
      { x: 100, y: 20 }, { x: 119, y: 74 },  { x: 176, y: 75 },  { x: 130, y: 110 },
      { x: 147, y: 165 }, { x: 100, y: 132 }, { x: 53,  y: 165 }, { x: 70,  y: 110 },
      { x: 24,  y: 75 },  { x: 81,  y: 74 }
    ]
  },
  {
    id: 'zhuyin3', title: '🌸 花朵', icon: '🌸', labelMode: 'random',
    points: [
      { x: 100, y: 25 },   { x: 128.2, y: 61.2 }, { x: 171.3, y: 76.8 }, { x: 145.7, y: 114.8 },
      { x: 144.1, y: 160.7 }, { x: 100, y: 148 },  { x: 55.9, y: 160.7 }, { x: 54.3, y: 114.8 },
      { x: 28.7, y: 76.8 }, { x: 71.8, y: 61.2 }
    ]
  },
  {
    id: 'zhuyin4', title: '☀️ 太陽', icon: '☀️', labelMode: 'random',
    points: [
      { x: 100, y: 15 },   { x: 122.3, y: 69.3 }, { x: 180.8, y: 73.7 }, { x: 136.1, y: 111.7 },
      { x: 150, y: 168.8 }, { x: 100, y: 138 },    { x: 50, y: 168.8 },   { x: 63.9, y: 111.7 },
      { x: 19.2, y: 73.7 }, { x: 77.7, y: 69.3 }
    ]
  },
  {
    id: 'zhuyin5', title: '☁️ 雲朵', icon: '☁️', labelMode: 'random',
    points: [
      { x: 100, y: 28 },   { x: 132.9, y: 54.7 }, { x: 168.5, y: 77.8 }, { x: 153.3, y: 117.3 },
      { x: 142.3, y: 158.2 }, { x: 100, y: 156 },  { x: 57.7, y: 158.2 }, { x: 46.7, y: 117.3 },
      { x: 31.5, y: 77.8 }, { x: 67.1, y: 54.7 }
    ]
  }
];

/* 標準注音表順序（聲母→介音→韻母），共 37 個，隨機挑起點時從這裡連續取一段 */
var ZHUYIN_SEQUENCE = [
  'ㄅ', 'ㄆ', 'ㄇ', 'ㄈ', 'ㄉ', 'ㄊ', 'ㄋ', 'ㄌ', 'ㄍ', 'ㄎ', 'ㄏ',
  'ㄐ', 'ㄑ', 'ㄒ', 'ㄓ', 'ㄔ', 'ㄕ', 'ㄖ', 'ㄗ', 'ㄘ', 'ㄙ',
  'ㄧ', 'ㄨ', 'ㄩ',
  'ㄚ', 'ㄛ', 'ㄜ', 'ㄝ', 'ㄞ', 'ㄟ', 'ㄠ', 'ㄡ', 'ㄢ', 'ㄣ', 'ㄤ', 'ㄥ', 'ㄦ'
];

function _randomZhuyinLabels(n) {
  var maxStart = ZHUYIN_SEQUENCE.length - n;
  var start = Math.floor(Math.random() * (maxStart + 1));
  return ZHUYIN_SEQUENCE.slice(start, start + n);
}

/* 數字關卡每次隨機挑起點，把最大值壓在 99 以內 */
function _randomNumberLabels(n) {
  var maxFinal = 99;
  var maxStart = Math.max(1, maxFinal - n + 1);
  var start = Math.floor(Math.random() * maxStart) + 1;
  var labels = [];
  for (var i = 0; i < n; i++) labels.push(start + i);
  return labels;
}

/* 決定這一輪實際要用的出題方式：'random' 的關卡每次開關卡各半機率決定注音或數字；
   其他固定值（目前沒有關卡用，保留給未來若真的需要固定某一種）就直接照該值 */
function _d2dPickMode(level) {
  if (level.labelMode === 'random') return Math.random() < 0.5 ? 'zhuyin' : 'number';
  return level.labelMode;
}

/* 依指定的出題方式（由 _d2dPickMode 決定，這一輪開始時算一次、全程不變）產生標籤
   （每次呼叫結果都不同） */
function generateDot2DotLabels(level, mode) {
  var n = level.points.length;
  if (mode === 'zhuyin') return _randomZhuyinLabels(n);
  if (mode === 'number') return _randomNumberLabels(n);
  var fallback = [];
  for (var i = 0; i < n; i++) fallback.push(i + 1);
  return fallback;
}
