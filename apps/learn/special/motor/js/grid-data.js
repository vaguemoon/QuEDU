'use strict';

/* 方格抄寫——球類圖示＋關卡資料
 * 每次開關卡都重新隨機：哪幾種球當圖例、每種球配哪個數字、棋盤哪些格子有球、放哪一種——
 * 跟連連看的隨機起點、找一樣的隨機題目同一個精神，不能靠背位置矇過去。
 */

var GRID_BALL_TYPES = {
  baseball: {
    render: function(svg) {
      var c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('cx', 20); c.setAttribute('cy', 20); c.setAttribute('r', 17);
      c.setAttribute('fill', 'white'); c.setAttribute('stroke', '#ccc'); c.setAttribute('stroke-width', 1);
      svg.appendChild(c);
      ['M 6,12 Q 20,20 6,28', 'M 34,12 Q 20,20 34,28'].forEach(function(d) {
        var p = document.createElementNS(SVGNS, 'path');
        p.setAttribute('d', d); p.setAttribute('fill', 'none');
        p.setAttribute('stroke', '#e84444'); p.setAttribute('stroke-width', 1.5);
        svg.appendChild(p);
      });
    }
  },
  football: {
    render: function(svg) {
      var e = document.createElementNS(SVGNS, 'ellipse');
      e.setAttribute('cx', 20); e.setAttribute('cy', 20); e.setAttribute('rx', 18); e.setAttribute('ry', 12);
      e.setAttribute('fill', '#a0652f');
      svg.appendChild(e);
      var seam = document.createElementNS(SVGNS, 'line');
      seam.setAttribute('x1', 6); seam.setAttribute('y1', 20); seam.setAttribute('x2', 34); seam.setAttribute('y2', 20);
      seam.setAttribute('stroke', 'white'); seam.setAttribute('stroke-width', 1.5);
      svg.appendChild(seam);
      [14, 20, 26].forEach(function(x) {
        var lace = document.createElementNS(SVGNS, 'line');
        lace.setAttribute('x1', x); lace.setAttribute('y1', 17); lace.setAttribute('x2', x); lace.setAttribute('y2', 23);
        lace.setAttribute('stroke', 'white'); lace.setAttribute('stroke-width', 1.3);
        svg.appendChild(lace);
      });
    }
  },
  basketball: {
    render: function(svg) {
      var c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('cx', 20); c.setAttribute('cy', 20); c.setAttribute('r', 17);
      c.setAttribute('fill', '#ff8c42');
      svg.appendChild(c);
      var h = document.createElementNS(SVGNS, 'line');
      h.setAttribute('x1', 3); h.setAttribute('y1', 20); h.setAttribute('x2', 37); h.setAttribute('y2', 20);
      h.setAttribute('stroke', '#1e2d3d'); h.setAttribute('stroke-width', 1.3);
      svg.appendChild(h);
      var v = document.createElementNS(SVGNS, 'line');
      v.setAttribute('x1', 20); v.setAttribute('y1', 3); v.setAttribute('x2', 20); v.setAttribute('y2', 37);
      v.setAttribute('stroke', '#1e2d3d'); v.setAttribute('stroke-width', 1.3);
      svg.appendChild(v);
      ['M 20,3 Q 32,20 20,37', 'M 20,3 Q 8,20 20,37'].forEach(function(d) {
        var p = document.createElementNS(SVGNS, 'path');
        p.setAttribute('d', d); p.setAttribute('fill', 'none');
        p.setAttribute('stroke', '#1e2d3d'); p.setAttribute('stroke-width', 1.3);
        svg.appendChild(p);
      });
    }
  },
  soccer: {
    render: function(svg) {
      var c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('cx', 20); c.setAttribute('cy', 20); c.setAttribute('r', 17);
      c.setAttribute('fill', 'white'); c.setAttribute('stroke', '#1e2d3d'); c.setAttribute('stroke-width', 1);
      svg.appendChild(c);
      var pts = [];
      for (var i = 0; i < 5; i++) {
        var a = (-90 + i * 72) * Math.PI / 180;
        pts.push((20 + 7 * Math.cos(a)).toFixed(1) + ',' + (20 + 7 * Math.sin(a)).toFixed(1));
      }
      var pent = document.createElementNS(SVGNS, 'polygon');
      pent.setAttribute('points', pts.join(' '));
      pent.setAttribute('fill', '#1e2d3d');
      svg.appendChild(pent);
    }
  }
};
var GRID_BALL_KEYS = Object.keys(GRID_BALL_TYPES);

/* labelMode：'number' 圖例配 1~9 隨機數字；'zhuyin' 圖例配注音表隨機抽的符號（不用連續，
 *   這裡只是查表對應，不像連連看要連成一條線，所以直接從 37 個裡隨機挑不重複的幾個就好）
 * endless：這一關不會在答完一輪後結束，而是馬上接下一輪新題目，讓學生可以一直玩下去，
 *   不用每做完一輪就被打斷去選關卡——想停下來自己按「結束練習」就好 */
var GRID_LEVELS = [
  { id: 'grid-3x3',      title: '🔢 方格抄寫（小試身手）', icon: '🔢', rows: 3, cols: 3, legendCount: 3, filledCount: 3, labelMode: 'number' },
  { id: 'grid-4x4',      title: '🔢 方格抄寫（基本）',     icon: '🔢', rows: 4, cols: 4, legendCount: 4, filledCount: 5, labelMode: 'number' },
  { id: 'grid-4x4-hard', title: '🏆 方格抄寫挑戰',         icon: '🏆', rows: 4, cols: 4, legendCount: 4, filledCount: 7, labelMode: 'number' },
  { id: 'grid-endless-number', title: '♾️ 數字無限挑戰', icon: '♾️', rows: 4, cols: 4, legendCount: 4, filledCount: 6, labelMode: 'number', endless: true },
  { id: 'grid-endless-zhuyin', title: '🔤 注音無限挑戰', icon: '🔤', rows: 4, cols: 4, legendCount: 4, filledCount: 6, labelMode: 'zhuyin', endless: true }
];

function _gridRandomValues(level) {
  if (level.labelMode === 'zhuyin') {
    return ZHUYIN_SEQUENCE.slice()
      .sort(function() { return Math.random() - 0.5; })
      .slice(0, level.legendCount);
  }
  var numbers = [];
  while (numbers.length < level.legendCount) {
    var n = Math.floor(Math.random() * 9) + 1;
    if (numbers.indexOf(n) === -1) numbers.push(n);
  }
  return numbers;
}

function generateGridRound(level) {
  var chosenBalls = GRID_BALL_KEYS.slice()
    .sort(function() { return Math.random() - 0.5; })
    .slice(0, level.legendCount);

  var values = _gridRandomValues(level);
  var legend = chosenBalls.map(function(ball, i) { return { ball: ball, value: values[i] }; });

  var totalCells = level.rows * level.cols;
  var order = [];
  for (var i = 0; i < totalCells; i++) order.push(i);
  order.sort(function() { return Math.random() - 0.5; });
  var filledSet = {};
  order.slice(0, level.filledCount).forEach(function(idx) { filledSet[idx] = true; });

  var cells = [];
  for (i = 0; i < totalCells; i++) {
    if (filledSet[i]) {
      var pick = legend[Math.floor(Math.random() * legend.length)];
      cells.push({ filled: true, ball: pick.ball, value: pick.value });
    } else {
      cells.push({ filled: false });
    }
  }
  return { legend: legend, cells: cells, rows: level.rows, cols: level.cols };
}
