'use strict';

var currentStudent  = null;
var currentModule   = '';   // 'dot2dot' | 'tracing'
var currentLevelIdx = 0;

var STAR_KEY = {
  dot2dot: 'motor_dot2dot_stars',
  tracing: 'motor_tracing_stars'
};

function getStars(module) {
  try {
    var raw = localStorage.getItem(STAR_KEY[module]);
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}

function addStar(module, levelId) {
  var stars = getStars(module);
  if (stars.indexOf(levelId) === -1) {
    stars.push(levelId);
    try { localStorage.setItem(STAR_KEY[module], JSON.stringify(stars)); } catch(e) {}
  }
}

function totalStars() {
  return getStars('dot2dot').length + getStars('tracing').length;
}

/* 將 pointer event 轉成 SVG 內部座標（viewBox 0 0 200 200）。
 * svg 元素實際顯示框不一定是正方形（比如視窗較寬或較窄時），
 * 而 preserveAspectRatio="xMidYMid meet" 會把內容等比縮放並置中，
 * 兩側留白（letterbox）。如果只用 rect.width/height 各自除出縮放比例，
 * 在留白的情況下換算出來的座標會整個偏掉——必須先算出「實際繪製內容」
 * 的縮放比例與置中位移，再反推回去。 */
function svgPointFromEvent(svg, evt) {
  var rect = svg.getBoundingClientRect();
  var vb = svg.viewBox.baseVal;
  var scale = Math.min(rect.width / vb.width, rect.height / vb.height);
  var renderedW = vb.width  * scale;
  var renderedH = vb.height * scale;
  var offsetX = (rect.width  - renderedW) / 2;
  var offsetY = (rect.height - renderedH) / 2;
  return {
    x: vb.x + (evt.clientX - rect.left - offsetX) / scale,
    y: vb.y + (evt.clientY - rect.top  - offsetY) / scale
  };
}

function dist(a, b) {
  var dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
