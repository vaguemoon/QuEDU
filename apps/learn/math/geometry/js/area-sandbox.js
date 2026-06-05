'use strict';

/* ════════════════════════════════════════
   面積沙盒 — SVG 圖形繪製 + 提示動畫
   ════════════════════════════════════════ */

var _SVG_NS = 'http://www.w3.org/2000/svg';

function _svgEl(tag, attrs, styleStr) {
  var el = document.createElementNS(_SVG_NS, tag);
  Object.keys(attrs || {}).forEach(function(k) { el.setAttribute(k, attrs[k]); });
  if (styleStr) el.setAttribute('style', styleStr);
  return el;
}

function _clearSvg() {
  var svg = document.getElementById('sandbox-svg');
  if (svg) svg.innerHTML = '';
  return svg;
}

/* dim label: text tag with centred alignment */
function _label(svg, x, y, text, cls) {
  var t = _svgEl('text', { x: x, y: y, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
    'font-size': '12', 'font-family': 'Noto Sans TC, sans-serif', 'font-weight': '700' },
    'fill:' + (cls === 'hi' ? '#e67e22' : 'var(--blue-dk)'));
  t.textContent = text;
  svg.appendChild(t);
}

/* dashed helper line */
function _dash(svg, x1, y1, x2, y2) {
  svg.appendChild(_svgEl('line', { x1:x1,y1:y1,x2:x2,y2:y2 },
    'stroke:#aaa;stroke-width:1;stroke-dasharray:4,3'));
}

/* right-angle mark */
function _rightAngle(svg, cx, cy, size, dir) {
  /* dir: 'tr'=top-right, 'tl', 'br', 'bl' */
  size = size || 8;
  var dx = (dir && dir[1] === 'r') ? size : -size;
  var dy = (dir && dir[0] === 'b') ? size : -size;
  var pts = (cx+dx)+','+(cy) + ' ' + (cx+dx)+','+(cy+dy) + ' ' + cx+','+(cy+dy);
  svg.appendChild(_svgEl('polyline', { points: pts },
    'stroke:#aaa;stroke-width:1.2;fill:none'));
}

/* ── 長方形（10px/unit，精確比例） ── */
function _drawRectangle(q) {
  var svg = _clearSvg();
  var l = q.params.l, w = q.params.w;
  var W = l*10, H = w*10;
  var x = (300-W)/2, y = Math.max(28, Math.round((205-H)/2));
  svg.appendChild(_svgEl('rect',{x:x,y:y,width:W,height:H,rx:3},
    'fill:var(--blue-lt);stroke:var(--blue);stroke-width:2.5'));
  _label(svg, x+W/2, y-14, '長 '+l+' 公分');
  _label(svg, x-28, y+H/2, '寬 '+w+' 公分');
}

/* ── 正方形 ── */
function _drawSquare(q) {
  var svg = _clearSvg();
  var s = q.params.s, sz = s*10;
  var x = (300-sz)/2, y = Math.max(28, Math.round((205-sz)/2));
  svg.appendChild(_svgEl('rect',{x:x,y:y,width:sz,height:sz,rx:3},
    'fill:var(--blue-lt);stroke:var(--blue);stroke-width:2.5'));
  _label(svg, x+sz/2, y-14, '邊長 '+s+' 公分');
  _rightAngle(svg, x+sz, y+sz, 8, 'tl');
  _rightAngle(svg, x, y, 8, 'br');
}

/* ── 三角形 ── */
function _drawTriangle(q) {
  var svg = _clearSvg();
  var b = q.params.b, h = q.params.h;
  var W = b*10, H = h*10;
  var yBase = Math.min(183, Math.round((205+H)/2));
  var xL = (300-W)/2, xR = xL+W;
  svg.appendChild(_svgEl('polygon',{points:xL+','+yBase+' '+xR+','+yBase+' '+150+','+(yBase-H)},
    'fill:var(--blue-lt);stroke:var(--blue);stroke-width:2.5'));
  _dash(svg, 150, yBase-H, 150, yBase);
  _rightAngle(svg, 150, yBase, 7, 'tl');
  _label(svg, 150, yBase+14, '底 '+b+' 公分');
  _label(svg, 176, yBase-H/2, '高 '+h+' 公分');
}

/* ── 平行四邊形 ── */
function _drawParallelogram(q) {
  var svg = _clearSvg();
  var b = q.params.b, h = q.params.h;
  var W = b*10, H = h*10, sk = Math.round(H*0.5);
  var y0 = Math.min(183, Math.round((205+H)/2));
  var x0 = (300-W-sk)/2;
  var pts = (x0+sk)+','+(y0-H)+' '+(x0+sk+W)+','+(y0-H)+' '+(x0+W)+','+y0+' '+x0+','+y0;
  svg.appendChild(_svgEl('polygon',{points:pts},
    'fill:var(--blue-lt);stroke:var(--blue);stroke-width:2.5'));
  _dash(svg, x0+sk, y0-H, x0+sk, y0);
  _rightAngle(svg, x0+sk, y0, 7, 'tl');
  _label(svg, x0+sk+W/2, y0+14, '底 '+b+' 公分');
  _label(svg, x0+sk-22, y0-H/2, '高 '+h+' 公分');
}

/* ── 梯形 ── */
function _drawTrapezoid(q) {
  var svg = _clearSvg();
  var p = q.params, a = p.a, b = p.b, h = p.h;
  var Wb = b*10, Wa = a*10, H = h*10;
  var y0 = Math.min(183, Math.round((205+H)/2));
  var x0 = (300-Wb)/2, off = (Wb-Wa)/2;
  var pts = (x0+off)+','+(y0-H)+' '+(x0+off+Wa)+','+(y0-H)+' '+(x0+Wb)+','+y0+' '+x0+','+y0;
  svg.appendChild(_svgEl('polygon',{points:pts},
    'fill:var(--blue-lt);stroke:var(--blue);stroke-width:2.5'));
  _dash(svg, x0+off, y0-H, x0+off, y0);
  _rightAngle(svg, x0+off, y0, 7, 'tl');
  _label(svg, x0+off+Wa/2, y0-H-13, '上底 '+a+' 公分');
  _label(svg, x0+Wb/2, y0+14, '下底 '+b+' 公分');
  _label(svg, x0+off-26, y0-H/2, '高 '+h+' 公分');
}

/* ── 菱形 ── */
function _drawRhombus(q) {
  var svg = _clearSvg();
  var d1 = q.params.d1, d2 = q.params.d2;
  var hw = d1*5, hh = d2*5, cx = 150, cy = 105;
  var pts = cx+','+(cy-hh)+' '+(cx+hw)+','+cy+' '+cx+','+(cy+hh)+' '+(cx-hw)+','+cy;
  svg.appendChild(_svgEl('polygon',{points:pts},
    'fill:var(--blue-lt);stroke:var(--blue);stroke-width:2.5'));
  _dash(svg, cx-hw, cy, cx+hw, cy);
  _dash(svg, cx, cy-hh, cx, cy+hh);
  _label(svg, cx, cy-hh-13, '對角線乙 '+d2+' 公分');
  _label(svg, cx+hw+36, cy, '對角線甲 '+d1+' 公分');
}

/* ── 圓形 ── */
function _drawCircle(q) {
  var svg = _clearSvg();
  var r = q.params.r, rad = r*10, cx = 150, cy = 105;
  svg.appendChild(_svgEl('circle',{cx:cx,cy:cy,r:rad},
    'fill:var(--blue-lt);stroke:var(--blue);stroke-width:2.5'));
  svg.appendChild(_svgEl('circle',{cx:cx,cy:cy,r:3},'fill:var(--blue-dk)'));
  svg.appendChild(_svgEl('line',{x1:cx,y1:cy,x2:cx+rad,y2:cy},
    'stroke:var(--blue-dk);stroke-width:1.8'));
  svg.appendChild(_svgEl('circle',{cx:cx+rad,cy:cy,r:3},'fill:var(--blue-dk)'));
  _label(svg, cx+rad/2+8, cy-13, '半徑 '+r+' 公分');
}

/* ════════════════════════════════════════
   公開 API
   ════════════════════════════════════════ */

function areaDrawShape(q) {
  switch (q.shape) {
    case 'rectangle':     _drawRectangle(q);     break;
    case 'square':        _drawSquare(q);         break;
    case 'triangle':      _drawTriangle(q);       break;
    case 'parallelogram': _drawParallelogram(q);  break;
    case 'trapezoid':     _drawTrapezoid(q);      break;
    case 'rhombus':       _drawRhombus(q);        break;
    case 'circle':        _drawCircle(q);         break;
  }
}

function areaPlayHint(q) {
  var p = q.params;
  var steps = [];
  switch (q.shape) {
    case 'rectangle':
      steps = [
        { cls: 'step-formula', text: '面積公式：長 × 寬' },
        { cls: 'step-sub',     text: '= ' + p.l + ' × ' + p.w },
        { cls: 'step-answer',  text: '= ' + q.answer + ' 平方公分 ✓' }
      ];
      break;
    case 'square':
      steps = [
        { cls: 'step-formula', text: '面積公式：邊長 × 邊長' },
        { cls: 'step-sub',     text: '= ' + p.s + ' × ' + p.s },
        { cls: 'step-answer',  text: '= ' + q.answer + ' 平方公分 ✓' }
      ];
      break;
    case 'triangle':
      steps = [
        { cls: 'step-formula', text: '面積公式：底 × 高 ÷ 2' },
        { cls: 'step-sub',     text: '= ' + p.b + ' × ' + p.h + ' ÷ 2' },
        { cls: 'step-sub',     text: '= ' + (p.b * p.h) + ' ÷ 2' },
        { cls: 'step-answer',  text: '= ' + q.answer + ' 平方公分 ✓' }
      ];
      break;
    case 'parallelogram':
      steps = [
        { cls: 'step-formula', text: '面積公式：底 × 高' },
        { cls: 'step-sub',     text: '= ' + p.b + ' × ' + p.h },
        { cls: 'step-answer',  text: '= ' + q.answer + ' 平方公分 ✓' }
      ];
      break;
    case 'trapezoid':
      steps = [
        { cls: 'step-formula', text: '面積公式：(上底＋下底) × 高 ÷ 2' },
        { cls: 'step-sub',     text: '= (' + p.a + ' ＋ ' + p.b + ') × ' + p.h + ' ÷ 2' },
        { cls: 'step-sub',     text: '= ' + (p.a+p.b) + ' × ' + p.h + ' ÷ 2' },
        { cls: 'step-sub',     text: '= ' + ((p.a+p.b)*p.h) + ' ÷ 2' },
        { cls: 'step-answer',  text: '= ' + q.answer + ' 平方公分 ✓' }
      ];
      break;
    case 'rhombus':
      steps = [
        { cls: 'step-formula', text: '面積公式：對角線甲 × 對角線乙 ÷ 2' },
        { cls: 'step-sub',     text: '= ' + p.d1 + ' × ' + p.d2 + ' ÷ 2' },
        { cls: 'step-sub',     text: '= ' + (p.d1*p.d2) + ' ÷ 2' },
        { cls: 'step-answer',  text: '= ' + q.answer + ' 平方公分 ✓' }
      ];
      break;
    case 'circle':
      steps = [
        { cls: 'step-formula', text: '面積公式：半徑 × 半徑 × 3.14' },
        { cls: 'step-sub',     text: '= ' + p.r + ' × ' + p.r + ' × 3.14' },
        { cls: 'step-sub',     text: '= ' + (p.r*p.r) + ' × 3.14' },
        { cls: 'step-answer',  text: '= ' + q.answer + ' 平方公分 ✓' }
      ];
      break;
  }
  showFormulaSteps(steps);
}
