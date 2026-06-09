'use strict';

var _dcQ     = null;
var _dcCount = 0;   // 0–denom, filled count

// ────────────────────────────────────────
//  Public API
// ────────────────────────────────────────

function dcInitForQuestion(q) {
  _dcQ = q;
  var container = document.getElementById('dc-container');
  if (!container) return;
  if (!q || !q.decVisual) { container.innerHTML = ''; return; }
  var v = q.decVisual;
  _dcCount = (v.preset != null) ? v.preset : 0;
  _dcRender(v.large, v.small, v.denominator);
}

// Clicking position n: if already = n → decrement (toggle last off), else set to n.
function dcSetCount(n) {
  if (!_dcQ || !_dcQ.decVisual) return;
  var denom = _dcQ.decVisual.denominator;
  _dcCount = (_dcCount === n) ? n - 1 : n;
  _dcCount = Math.max(0, Math.min(denom, _dcCount));
  _dcUpdate();
}

function dcClear() {
  _dcCount = 0;
  _dcUpdate();
}

// ────────────────────────────────────────
//  Render (full rebuild on question init)
// ────────────────────────────────────────

var _DC_COLS = { 1:1, 2:2, 3:3, 4:4, 5:5, 6:6, 7:7, 8:4, 9:3, 10:5, 11:6, 12:6 };

function _dcRender(large, small, denom) {
  var container = document.getElementById('dc-container');
  if (!container) return;
  var cols = _DC_COLS[denom] || Math.ceil(Math.sqrt(denom));

  var html = '<div class="dc-scene">';
  html += '<div class="dc-hint">1 ' + large + ' = ' + denom + ' ' + small + '</div>';
  html += '<div class="dc-whole" id="dc-whole">' + _dcWholeSVG(large, denom, _dcCount) + '</div>';
  html += '<div class="dc-grid" id="dc-grid" style="grid-template-columns:repeat(' + cols + ',1fr)">';
  for (var i = 1; i <= denom; i++) {
    html += '<div class="dc-cell' + (i <= _dcCount ? ' dc-cell-on' : '') + '" onclick="dcSetCount(' + i + ')">' + small + '</div>';
  }
  html += '</div>';
  html += '</div>';
  html += '<div class="dc-statusbar">';
  html += '<span class="dc-status" id="dc-status">已選：' + _dcCount + ' / ' + denom + '</span>';
  html += '<button class="sb-clear-btn" onclick="dcClear()">↺ 清空</button>';
  html += '</div>';

  container.innerHTML = html;
}

function _dcUpdate() {
  if (!_dcQ || !_dcQ.decVisual) return;
  var v = _dcQ.decVisual;

  var wholeEl = document.getElementById('dc-whole');
  if (wholeEl) wholeEl.innerHTML = _dcWholeSVG(v.large, v.denominator, _dcCount);

  document.querySelectorAll('#dc-grid .dc-cell').forEach(function(cell, idx) {
    cell.classList.toggle('dc-cell-on', idx + 1 <= _dcCount);
  });

  var statusEl = document.getElementById('dc-status');
  if (statusEl) statusEl.textContent = '已選：' + _dcCount + ' / ' + v.denominator;
}

// ────────────────────────────────────────
//  SVG dispatcher
// ────────────────────────────────────────

function _dcWholeSVG(large, denom, count) {
  if (large === '瓶') return _dcBottleSVG(denom, count);
  if (large === '條') return _dcBarSVG(denom, count);
  return _dcCircleSVG(denom, count);
}

function _f(n) { return parseFloat(n.toFixed(2)); }

// ────────────────────────────────────────
//  水瓶 SVG — portrait, fills from bottom
// ────────────────────────────────────────

function _dcBottleSVG(denom, n) {
  var W = 120, H = 260;
  var bodyTop = 68, bodyBottom = 242, bodyH = bodyBottom - bodyTop;
  var bandH   = bodyH / denom;
  var FILL    = '#4a90d9';
  var LINE    = '#2d6fa8';
  var BG      = '#ddeef8';
  var SEP     = 'rgba(255,255,255,0.5)';
  var P = 'M44,5 L44,50 L18,68 L18,228 Q18,242 30,242 L90,242 Q102,242 102,228 L102,68 L76,50 L76,5 Z';

  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H
        + '" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%">';
  s += '<defs><clipPath id="dcbc"><path d="' + P + '"/></clipPath></defs>';

  s += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + BG + '" clip-path="url(#dcbc)"/>';

  if (n > 0) {
    var fh = _f(n * bandH);
    var fy = _f(bodyBottom - fh);
    s += '<rect x="0" y="' + fy + '" width="' + W + '" height="' + _f(fh + 18)
       + '" fill="' + FILL + '" opacity="0.78" clip-path="url(#dcbc)"/>';
  }

  for (var i = 1; i < denom; i++) {
    var dy = _f(bodyBottom - i * bandH);
    s += '<line x1="18" y1="' + dy + '" x2="102" y2="' + dy + '" stroke="' + SEP
       + '" stroke-width="1.5" clip-path="url(#dcbc)"/>';
  }

  // Clickable zones: band i from top → fromBottom = denom - i
  for (var i = 0; i < denom; i++) {
    var fb = denom - i;
    var zy = _f(bodyTop + i * bandH);
    s += '<rect x="18" y="' + zy + '" width="84" height="' + _f(bandH)
       + '" fill="transparent" style="cursor:pointer" onclick="dcSetCount(' + fb + ')"/>';
  }

  s += '<path d="' + P + '" fill="none" stroke="' + LINE + '" stroke-width="3"/>';
  s += '<rect x="42" y="0" width="36" height="9" rx="4.5" fill="' + LINE + '"/>';
  s += '<line x1="52" y1="11" x2="52" y2="46" stroke="rgba(255,255,255,0.4)"'
     + ' stroke-width="4" stroke-linecap="round" clip-path="url(#dcbc)"/>';
  s += '</svg>';
  return s;
}

// ────────────────────────────────────────
//  巧克力條 SVG — landscape, fills left→right
// ────────────────────────────────────────

function _dcBarSVG(denom, n) {
  var W = 320, H = 100;
  var bx = 8, by = 14, bw = 304, bh = 72;
  var bandW = bw / denom;
  var FILL  = '#7B3F00';
  var BG    = '#f9d9a8';
  var LINE  = '#5C3317';
  var SEP   = 'rgba(255,255,255,0.6)';

  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H
        + '" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%">';

  s += '<rect x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh + '" rx="8" fill="' + BG + '"/>';

  for (var i = 0; i < n; i++) {
    var cx = _f(bx + i * bandW);
    var cw = _f(bandW);
    s += '<rect x="' + cx + '" y="' + by + '" width="' + cw + '" height="' + bh
       + '" rx="' + (i === 0 ? 8 : 0) + '" fill="' + FILL + '" opacity="0.85"/>';
  }

  for (var i = 1; i < denom; i++) {
    var dx = _f(bx + i * bandW);
    s += '<line x1="' + dx + '" y1="' + by + '" x2="' + dx + '" y2="' + (by + bh)
       + '" stroke="' + SEP + '" stroke-width="1.5"/>';
  }

  s += '<line x1="' + bx + '" y1="' + (by + bh / 2) + '" x2="' + (bx + bw) + '" y2="' + (by + bh / 2)
     + '" stroke="rgba(0,0,0,0.07)" stroke-width="2"/>';

  for (var i = 0; i < denom; i++) {
    var cx = _f(bx + i * bandW);
    s += '<rect x="' + cx + '" y="' + by + '" width="' + _f(bandW) + '" height="' + bh
       + '" fill="transparent" style="cursor:pointer" onclick="dcSetCount(' + (i + 1) + ')"/>';
  }

  s += '<rect x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh
     + '" rx="8" fill="none" stroke="' + LINE + '" stroke-width="3"/>';
  s += '</svg>';
  return s;
}

// ────────────────────────────────────────
//  圓形 SVG — pie, fills clockwise from top
// ────────────────────────────────────────

function _dcCircleSVG(denom, n) {
  var W = 220, H = 220;
  var cx = 110, cy = 110, r = 98;
  var FILL  = '#e67e22';
  var LINE  = '#ca6f1e';
  var BG    = '#fdebd0';
  var step  = (2 * Math.PI) / denom;
  var start = -Math.PI / 2;

  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H
        + '" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%">';

  s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + BG + '"/>';

  for (var i = 0; i < n; i++) {
    var a1 = start + i * step, a2 = start + (i + 1) * step;
    var x1 = _f(cx + r * Math.cos(a1)), y1 = _f(cy + r * Math.sin(a1));
    var x2 = _f(cx + r * Math.cos(a2)), y2 = _f(cy + r * Math.sin(a2));
    var lg = (a2 - a1 > Math.PI) ? 1 : 0;
    s += '<path d="M' + cx + ',' + cy + ' L' + x1 + ',' + y1
       + ' A' + r + ',' + r + ' 0 ' + lg + ',1 ' + x2 + ',' + y2 + ' Z"'
       + ' fill="' + FILL + '" opacity="0.85"/>';
  }

  for (var i = 0; i < denom; i++) {
    var a  = start + i * step;
    var lx = _f(cx + r * Math.cos(a)), ly = _f(cy + r * Math.sin(a));
    s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + lx + '" y2="' + ly
       + '" stroke="rgba(255,255,255,0.7)" stroke-width="2"/>';
  }

  for (var i = 0; i < denom; i++) {
    var a1 = start + i * step, a2 = start + (i + 1) * step;
    var x1 = _f(cx + r * Math.cos(a1)), y1 = _f(cy + r * Math.sin(a1));
    var x2 = _f(cx + r * Math.cos(a2)), y2 = _f(cy + r * Math.sin(a2));
    var lg = (a2 - a1 > Math.PI) ? 1 : 0;
    s += '<path d="M' + cx + ',' + cy + ' L' + x1 + ',' + y1
       + ' A' + r + ',' + r + ' 0 ' + lg + ',1 ' + x2 + ',' + y2 + ' Z"'
       + ' fill="transparent" style="cursor:pointer" onclick="dcSetCount(' + (i + 1) + ')"/>';
  }

  s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + LINE + '" stroke-width="3"/>';
  s += '</svg>';
  return s;
}
