'use strict';

/* 線條練習關卡資料 — viewBox 0 0 200 200
 * type: 'line' | 'curve' | 'circle' | 'spiral' | 'multi'
 *   multi.parts：依序串接多段 line/curve，組成鋸齒/階梯/多邊形/波浪等複雜路徑
 */
var TRACING_LEVELS = [
  { id: 'h-line',    title: '➖ 橫線', icon: '➖', type: 'line',
    p0: { x: 25,  y: 100 }, p1: { x: 175, y: 100 } },
  { id: 'v-line',     title: '🟰 直線', icon: '｜', type: 'line',
    p0: { x: 100, y: 25 },  p1: { x: 100, y: 175 } },
  { id: 'diag-line',  title: '↗️ 斜線', icon: '↗️', type: 'line',
    p0: { x: 30,  y: 170 }, p1: { x: 170, y: 30 } },
  { id: 'curve',      title: '〜 曲線', icon: '〜', type: 'curve',
    p0: { x: 25, y: 140 }, c: { x: 100, y: 15 }, p1: { x: 175, y: 140 } },
  { id: 'circle',     title: '⭕ 圓圈', icon: '⭕', type: 'circle',
    cx: 100, cy: 100, r: 65, startDeg: -90, sweepDeg: 360 },

  /* ── 進階：多段轉折 / 更複雜的曲線 ── */
  { id: 'zigzag', title: '⚡ 鋸齒線', icon: '⚡', type: 'multi', samples: 96,
    parts: [
      { type: 'line', p0: { x: 20,  y: 150 }, p1: { x: 60,  y: 50 } },
      { type: 'line', p0: { x: 60,  y: 50 },  p1: { x: 100, y: 150 } },
      { type: 'line', p0: { x: 100, y: 150 }, p1: { x: 140, y: 50 } },
      { type: 'line', p0: { x: 140, y: 50 },  p1: { x: 180, y: 150 } }
    ] },
  { id: 'stairs', title: '🪜 階梯線', icon: '🪜', type: 'multi', samples: 96,
    parts: [
      { type: 'line', p0: { x: 25,  y: 175 }, p1: { x: 25,  y: 135 } },
      { type: 'line', p0: { x: 25,  y: 135 }, p1: { x: 75,  y: 135 } },
      { type: 'line', p0: { x: 75,  y: 135 }, p1: { x: 75,  y: 95 } },
      { type: 'line', p0: { x: 75,  y: 95 },  p1: { x: 125, y: 95 } },
      { type: 'line', p0: { x: 125, y: 95 },  p1: { x: 125, y: 55 } },
      { type: 'line', p0: { x: 125, y: 55 },  p1: { x: 175, y: 55 } }
    ] },
  { id: 'triangle', title: '🔺 三角形', icon: '🔺', type: 'multi', samples: 96,
    parts: [
      { type: 'line', p0: { x: 100, y: 25 },  p1: { x: 175, y: 165 } },
      { type: 'line', p0: { x: 175, y: 165 }, p1: { x: 25,  y: 165 } },
      { type: 'line', p0: { x: 25,  y: 165 }, p1: { x: 100, y: 25 } }
    ] },
  { id: 'square', title: '🟦 正方形', icon: '🟦', type: 'multi', samples: 96,
    parts: [
      { type: 'line', p0: { x: 40,  y: 40 },  p1: { x: 160, y: 40 } },
      { type: 'line', p0: { x: 160, y: 40 },  p1: { x: 160, y: 160 } },
      { type: 'line', p0: { x: 160, y: 160 }, p1: { x: 40,  y: 160 } },
      { type: 'line', p0: { x: 40,  y: 160 }, p1: { x: 40,  y: 40 } }
    ] },
  { id: 's-curve', title: '🐍 S形曲線', icon: '〰️', type: 'multi', samples: 96,
    parts: [
      { type: 'curve', p0: { x: 130, y: 30 },  c: { x: 40,  y: 30 },  p1: { x: 100, y: 100 } },
      { type: 'curve', p0: { x: 100, y: 100 }, c: { x: 160, y: 100 }, p1: { x: 70,  y: 170 } }
    ] },
  { id: 'wave', title: '🌊 波浪線', icon: '🌊', type: 'multi', samples: 108,
    parts: [
      { type: 'curve', p0: { x: 20,  y: 100 }, c: { x: 45,  y: 50 },  p1: { x: 70,  y: 100 } },
      { type: 'curve', p0: { x: 70,  y: 100 }, c: { x: 95,  y: 150 }, p1: { x: 120, y: 100 } },
      { type: 'curve', p0: { x: 120, y: 100 }, c: { x: 145, y: 50 },  p1: { x: 170, y: 100 } }
    ] },
  { id: 'spiral', title: '🌀 螺旋', icon: '🌀', type: 'spiral', samples: 120,
    cx: 100, cy: 100, r0: 8, r1: 85, startDeg: -90, sweepDeg: 720 },
  { id: 'heart', title: '💗 愛心', icon: '💗', type: 'multi', samples: 108,
    parts: [
      { type: 'curve', p0: { x: 100, y: 60 }, c: { x: 60,  y: 0 },   p1: { x: 30,  y: 80 } },
      { type: 'curve', p0: { x: 30,  y: 80 }, c: { x: 30,  y: 140 }, p1: { x: 100, y: 180 } },
      { type: 'curve', p0: { x: 100, y: 180 }, c: { x: 170, y: 140 }, p1: { x: 170, y: 80 } },
      { type: 'curve', p0: { x: 170, y: 80 }, c: { x: 140, y: 0 },   p1: { x: 100, y: 60 } }
    ] },
  { id: 'star-outline', title: '⭐ 星星外框', icon: '⭐', type: 'multi', samples: 120,
    parts: [
      { type: 'line', p0: { x: 100, y: 20 }, p1: { x: 119, y: 74 } },
      { type: 'line', p0: { x: 119, y: 74 }, p1: { x: 176, y: 75 } },
      { type: 'line', p0: { x: 176, y: 75 }, p1: { x: 130, y: 110 } },
      { type: 'line', p0: { x: 130, y: 110 }, p1: { x: 147, y: 165 } },
      { type: 'line', p0: { x: 147, y: 165 }, p1: { x: 100, y: 132 } },
      { type: 'line', p0: { x: 100, y: 132 }, p1: { x: 53,  y: 165 } },
      { type: 'line', p0: { x: 53,  y: 165 }, p1: { x: 70,  y: 110 } },
      { type: 'line', p0: { x: 70,  y: 110 }, p1: { x: 24,  y: 75 } },
      { type: 'line', p0: { x: 24,  y: 75 },  p1: { x: 81,  y: 74 } },
      { type: 'line', p0: { x: 81,  y: 74 },  p1: { x: 100, y: 20 } }
    ] }
];

/* 依關卡類型取樣出路徑上的點（同時用來畫虛線引導路徑與判斷描繪準確度）
 * multi 類型會對每一段遞迴取樣再串接起來（去掉重複的交界點） */
function buildTraceSamples(level, n) {
  n = n || 72;

  if (level.type === 'multi') {
    var perPart = Math.max(6, Math.round(n / level.parts.length));
    var all = [];
    level.parts.forEach(function(part, i) {
      var sub = buildTraceSamples(part, perPart);
      if (i > 0) sub = sub.slice(1);
      all = all.concat(sub);
    });
    return all;
  }

  var pts = [];
  var i, t;
  if (level.type === 'line') {
    for (i = 0; i <= n; i++) {
      t = i / n;
      pts.push({
        x: level.p0.x + (level.p1.x - level.p0.x) * t,
        y: level.p0.y + (level.p1.y - level.p0.y) * t
      });
    }
  } else if (level.type === 'curve') {
    for (i = 0; i <= n; i++) {
      t = i / n;
      var mt = 1 - t;
      pts.push({
        x: mt * mt * level.p0.x + 2 * mt * t * level.c.x + t * t * level.p1.x,
        y: mt * mt * level.p0.y + 2 * mt * t * level.c.y + t * t * level.p1.y
      });
    }
  } else if (level.type === 'circle') {
    for (i = 0; i <= n; i++) {
      t = i / n;
      var deg = level.startDeg + level.sweepDeg * t;
      var rad = deg * Math.PI / 180;
      pts.push({
        x: level.cx + level.r * Math.cos(rad),
        y: level.cy + level.r * Math.sin(rad)
      });
    }
  } else if (level.type === 'spiral') {
    for (i = 0; i <= n; i++) {
      t = i / n;
      var r2  = level.r0 + (level.r1 - level.r0) * t;
      var deg2 = level.startDeg + level.sweepDeg * t;
      var rad2 = deg2 * Math.PI / 180;
      pts.push({
        x: level.cx + r2 * Math.cos(rad2),
        y: level.cy + r2 * Math.sin(rad2)
      });
    }
  }
  return pts;
}
