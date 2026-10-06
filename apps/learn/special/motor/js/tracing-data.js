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
    ] },

  /* ── 練習簿模式：一關有好幾行同款式的線，像紙本練字簿一樣一行一行描 ── */
  { id: 'ws-stairs', title: '🪜 階梯練習（4行）', icon: '📋', type: 'worksheet',
    rows: _makeWorksheetRows(_makeSquareWaveParts,
      ['#e84444', '#4a90d9', '#ff8c42', '#52c97a']) },
  { id: 'ws-zigzag', title: '⚡ 鋸齒練習（4行）', icon: '📋', type: 'worksheet',
    rows: _makeWorksheetRows(_makeZigzagParts,
      ['#4a90d9', '#d63384', '#1e2d3d', '#52c97a']) }
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

/* ════════════════════════════════════════
   練習簿模式用的圖案產生器
   ════════════════════════════════════════
   每一行用連續的直線段拼出重複的方波（階梯）或鋸齒圖案，
   回傳 parts 陣列可以直接塞進 { type:'multi', parts:[...] } 用。 */
function _lineChain(points) {
  var parts = [];
  for (var k = 0; k < points.length - 1; k++) {
    parts.push({ type: 'line', p0: points[k], p1: points[k + 1] });
  }
  return parts;
}

function _makeSquareWaveParts(x0, x1, yTop, yBottom, repeats) {
  var unit = (x1 - x0) / repeats;
  var pts = [{ x: x0, y: yBottom }];
  for (var i = 0; i < repeats; i++) {
    var xa = x0 + i * unit;
    var xRise = xa + unit * 0.22;
    var xFall = xa + unit * 0.78;
    var xEnd  = xa + unit;
    pts.push({ x: xRise, y: yBottom });
    pts.push({ x: xRise, y: yTop });
    pts.push({ x: xFall, y: yTop });
    pts.push({ x: xFall, y: yBottom });
    pts.push({ x: xEnd,  y: yBottom });
  }
  return _lineChain(pts);
}

function _makeZigzagParts(x0, x1, yTop, yBottom, repeats) {
  var unit = (x1 - x0) / repeats;
  var pts = [{ x: x0, y: yBottom }];
  for (var i = 0; i < repeats; i++) {
    var xMid = x0 + i * unit + unit / 2;
    var xEnd = x0 + (i + 1) * unit;
    pts.push({ x: xMid, y: yTop });
    pts.push({ x: xEnd, y: yBottom });
  }
  return _lineChain(pts);
}

/* 把同一種圖案依 colors.length 切成好幾個水平帶（行），
 * 每行指派一個顏色（墨水線顏色，呼應紙本練字簿每行換色的設計）。 */
function _makeWorksheetRows(patternFn, colors) {
  var n = colors.length;
  var marginTop = 20, marginBottom = 15;
  var band = (200 - marginTop - marginBottom) / n;
  var amp = Math.min(30, band * 0.62);
  var rows = [];
  for (var i = 0; i < n; i++) {
    var bandTop = marginTop + i * band;
    var yTop = bandTop + (band - amp) / 2;
    var yBottom = yTop + amp;
    rows.push({
      parts: patternFn(20, 180, yTop, yBottom, 3),
      color: colors[i],
      samples: 56
    });
  }
  return rows;
}
