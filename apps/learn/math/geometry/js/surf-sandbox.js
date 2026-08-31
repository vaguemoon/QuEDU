'use strict';

/* ════════════════════════════════════════
   表面積沙盒
   左半（x 0-148）：靜態 3D 等角投影圖
   右半（x 152-300）：展開圖逐面動畫
   ════════════════════════════════════════ */

var _SVG_NS_S = 'http://www.w3.org/2000/svg';

/* ── 基礎工具 ── */
function _sSvgEl(tag, attrs, styleStr) {
  var el = document.createElementNS(_SVG_NS_S, tag);
  Object.keys(attrs || {}).forEach(function(k) { el.setAttribute(k, attrs[k]); });
  if (styleStr) el.setAttribute('style', styleStr);
  return el;
}
function _sClearSvg() {
  var svg = document.getElementById('sandbox-svg');
  if (svg) svg.innerHTML = '';
  return svg;
}
function _sLabel(svg, x, y, text, color, size) {
  var t = _sSvgEl('text', { x: x, y: y, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
    'font-size': size || '10', 'font-family': 'Noto Sans TC, sans-serif', 'font-weight': '700' },
    'fill:' + (color || '#2d6fa8'));
  t.textContent = text;
  svg.appendChild(t);
  return t;
}

/* 左右分隔 + 標題 */
function _drawDivider(svg) {
  svg.appendChild(_sSvgEl('line', { x1: 150, y1: 18, x2: 150, y2: 215 },
    'stroke:#d0e4f4;stroke-width:1.5;stroke-dasharray:5,4'));
  _sLabel(svg, 75,  14, '立體圖', '#aab', '9');
  _sLabel(svg, 226, 14, '展開圖', '#aab', '9');
}

/* 右半提示文字（提示前） */
function _drawRightGuide(svg) {
  _sLabel(svg, 226, 100, '點「💡 看提示」', '#c5d8ee', '11');
  _sLabel(svg, 226, 116, '看展開動畫', '#c5d8ee', '11');
}

/* ── 動畫工具 ── */
function _ptsStr(pts) {
  return pts.map(function(p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
}
function _lerpPts(a, b, rawT) {
  var t = 1 - Math.pow(1 - rawT, 2);
  return a.map(function(p, i) { return [p[0] + (b[i][0] - p[0]) * t, p[1] + (b[i][1] - p[1]) * t]; });
}

/* animate polygon start→end (800 ms), then onDone */
function _animPoly(svg, startPts, endPts, fill, delay, onDone) {
  var tid = setTimeout(function() {
    if (_animStopped) return;
    var el = _sSvgEl('polygon', { points: _ptsStr(startPts) },
      'fill:' + fill + ';stroke:#4a90d9;stroke-width:1.5');
    svg.appendChild(el);
    var t0 = null;
    function step(ts) {
      if (_animStopped) return;
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / 800, 1);
      el.setAttribute('points', _ptsStr(_lerpPts(startPts, endPts, p)));
      if (p < 1) requestAnimationFrame(step);
      else if (onDone) onDone(el);
    }
    requestAnimationFrame(step);
  }, delay);
  _hintTimers.push(tid);
}

/* animate circle cx/cy (800 ms) */
function _animCircle(svg, x1, y1, x2, y2, r, fill, delay, onDone) {
  var tid = setTimeout(function() {
    if (_animStopped) return;
    var el = _sSvgEl('circle', { cx: x1, cy: y1, r: r },
      'fill:' + fill + ';stroke:#4a90d9;stroke-width:1.5');
    svg.appendChild(el);
    var t0 = null;
    function step(ts) {
      if (_animStopped) return;
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / 800, 1);
      var e = 1 - Math.pow(1 - p, 2);
      el.setAttribute('cx', (x1 + (x2 - x1) * e).toFixed(1));
      el.setAttribute('cy', (y1 + (y2 - y1) * e).toFixed(1));
      if (p < 1) requestAnimationFrame(step);
      else if (onDone) onDone(el);
    }
    requestAnimationFrame(step);
  }, delay);
  _hintTimers.push(tid);
}

/* add label 820 ms after face starts */
function _animLabel(svg, x, y, text, delay) {
  var tid = setTimeout(function() {
    if (_animStopped) return;
    _sLabel(svg, x, y, text, '#1a5d96', '9');
  }, delay + 820);
  _hintTimers.push(tid);
}

/* schedule formula steps after animation ends */
function _scheduleFormula(q, delay) {
  var tid = setTimeout(function() {
    if (_animStopped) return;
    _surfFormula(q);
  }, delay);
  _hintTimers.push(tid);
}

/* rect → 4-point array [tl, tr, br, bl] */
function _r4(x, y, w, h) { return [[x,y],[x+w,y],[x+w,y+h],[x,y+h]]; }

/* ════════════════════════════════════════
   CUBE — 正方體
   Left 3D: ox=22, oy=158, sz=54, sk=16
   Right net: ns=22, cx=216, sy=46
   ════════════════════════════════════════ */

/* ── helper：計算左半 3D 座標（供 draw 與 anim 共用） ── */

function _cubeProps3D(s) {
  var sc = Math.max(4, Math.min(9, Math.floor(90/s)));
  var sz = s*sc, sk = Math.round(sz*0.3);
  var ox = Math.max(8, Math.round((138-sz-sk)/2));
  var oy = Math.min(183, Math.max(sz+sk+22, Math.round((208+sz+sk)/2)));
  return { sz:sz, sk:sk, ox:ox, oy:oy };
}

function _rpProps3D(l, w, h) {
  var SKF = 0.38;
  var sc = Math.max(3, Math.min(9, Math.floor(126/(l+w*SKF)), Math.floor(174/(h+w*SKF))));
  var fw = Math.round(l*sc), fh = Math.round(h*sc), sk = Math.round(w*sc*SKF);
  var ox = Math.max(8, Math.round((138-fw-sk)/2));
  var oy = Math.min(183, Math.max(fh+sk+22, Math.round((208+fh+sk)/2)));
  return { fw:fw, fh:fh, sk:sk, ox:ox, oy:oy };
}

function _cylProps3D(r, h) {
  var sc = Math.max(5, Math.min(10, Math.floor(60/r), Math.floor(98/h)));
  var cx=72, rx=r*sc, ry=Math.max(4, Math.round(rx*0.28)), bodyH=h*sc;
  var topY = Math.max(28, Math.round((208-bodyH-2*ry)/2));
  return { cx:cx, rx:rx, ry:ry, bodyH:bodyH, topY:topY, botY:topY+bodyH };
}

function _triProps3D(a, b, hp) {
  var SKF = 0.44;
  var sc = Math.max(3, Math.min(5, Math.floor(122/(a+hp*SKF)), Math.floor(170/(b+hp*SKF))));
  var bw=Math.round(a*sc), bh=Math.round(b*sc), sk=Math.round(hp*sc*SKF);
  var x0 = Math.max(8, Math.round((138-bw-sk)/2));
  var y0 = Math.min(183, Math.max(bh+sk+22, Math.round((208+bh+sk)/2)));
  return { bw:bw, bh:bh, sk:sk, x0:x0, y0:y0 };
}

function _drawCube3D(svg, q) {
  var s = q.params.s, o = _cubeProps3D(s);
  var fy = o.oy - o.sz;
  svg.appendChild(_sSvgEl('rect',{x:o.ox,y:fy,width:o.sz,height:o.sz},
    'fill:rgba(238,245,252,.95);stroke:#4a90d9;stroke-width:2'));
  var T=[[o.ox,fy],[o.ox+o.sk,fy-o.sk],[o.ox+o.sz+o.sk,fy-o.sk],[o.ox+o.sz,fy]];
  svg.appendChild(_sSvgEl('polygon',{points:_ptsStr(T)},
    'fill:rgba(210,230,248,.95);stroke:#4a90d9;stroke-width:2'));
  var R=[[o.ox+o.sz,fy],[o.ox+o.sz+o.sk,fy-o.sk],[o.ox+o.sz+o.sk,o.oy-o.sk],[o.ox+o.sz,o.oy]];
  svg.appendChild(_sSvgEl('polygon',{points:_ptsStr(R)},
    'fill:rgba(185,215,240,.95);stroke:#4a90d9;stroke-width:2'));
  _sLabel(svg, o.ox+o.sz/2, o.oy-o.sz/2, s+' 公分', '#555', '10');
  _sLabel(svg, o.ox+o.sz/2, o.oy-o.sz-10, s+' 公分', '#555', '10');
  _sLabel(svg, o.ox+o.sz+o.sk+14, o.oy-o.sz/2-o.sk/2, s+' 公分', '#555', '10');
}

function _animCube(svg, q) {
  var s = q.params.s, o = _cubeProps3D(s);
  var fy = o.oy - o.sz;
  /* 3D face coords */
  var F3 = _r4(o.ox, fy, o.sz, o.sz);
  var T3 = [[o.ox,fy],[o.ox+o.sk,fy-o.sk],[o.ox+o.sz+o.sk,fy-o.sk],[o.ox+o.sz,fy]];
  var R3 = [[o.ox+o.sz,fy],[o.ox+o.sz+o.sk,fy-o.sk],[o.ox+o.sz+o.sk,o.oy-o.sk],[o.ox+o.sz,o.oy]];
  /* net coords: ns=30, cx=213, sy=52 */
  var ns=30, cx=213, sy=52;
  var TN  = _r4(cx-ns/2, sy,      ns, ns);
  var LN  = _r4(cx-3*ns/2, sy+ns, ns, ns);
  var FN  = _r4(cx-ns/2,   sy+ns, ns, ns);
  var RN  = _r4(cx+ns/2,   sy+ns, ns, ns);
  var BKN = _r4(cx+3*ns/2, sy+ns, ns, ns);
  var BTN = _r4(cx-ns/2,   sy+2*ns, ns, ns);
  var fc = s + '×' + s;
  var WAIT = 800;
  var faces = [
    { s3:F3,  en:FN,  lx:cx,        ly:sy+ns*1.5,  label:fc, fill:'rgba(238,245,252,.95)' },
    { s3:T3,  en:TN,  lx:cx,        ly:sy+ns*.5,   label:fc, fill:'rgba(210,230,248,.95)' },
    { s3:R3,  en:RN,  lx:cx+ns,     ly:sy+ns*1.5,  label:fc, fill:'rgba(185,215,240,.95)' },
    { s3:F3,  en:LN,  lx:cx-ns,     ly:sy+ns*1.5,  label:fc, fill:'rgba(210,230,248,.95)' },
    { s3:R3,  en:BKN, lx:cx+2*ns,   ly:sy+ns*1.5,  label:fc, fill:'rgba(238,245,252,.95)' },
    { s3:F3,  en:BTN, lx:cx,        ly:sy+ns*2.5,  label:fc, fill:'rgba(185,215,240,.95)' }
  ];
  faces.forEach(function(f, i) {
    var d = WAIT + i * 800;
    _animPoly(svg, f.s3, f.en, f.fill, d, null);
    _animLabel(svg, f.lx, f.ly, f.label, d);
  });
  _scheduleFormula(q, WAIT + faces.length * 800 + 200);
}

/* ════════════════════════════════════════
   RECTANGULAR PRISM — 長方體
   Left 3D: ox=14, oy=160, fw=80, fh=55, sk=20
   Right net: dynamic scale, x0=155
   ════════════════════════════════════════ */

function _drawRectPrism3D(svg, q) {
  var p = q.params, o = _rpProps3D(p.l, p.w, p.h);
  var fy = o.oy - o.fh;
  svg.appendChild(_sSvgEl('rect',{x:o.ox,y:fy,width:o.fw,height:o.fh},
    'fill:rgba(238,245,252,.95);stroke:#4a90d9;stroke-width:2'));
  var T=[[o.ox,fy],[o.ox+o.sk,fy-o.sk],[o.ox+o.fw+o.sk,fy-o.sk],[o.ox+o.fw,fy]];
  svg.appendChild(_sSvgEl('polygon',{points:_ptsStr(T)},
    'fill:rgba(210,230,248,.95);stroke:#4a90d9;stroke-width:2'));
  var R=[[o.ox+o.fw,fy],[o.ox+o.fw+o.sk,fy-o.sk],[o.ox+o.fw+o.sk,o.oy-o.sk],[o.ox+o.fw,o.oy]];
  svg.appendChild(_sSvgEl('polygon',{points:_ptsStr(R)},
    'fill:rgba(185,215,240,.95);stroke:#4a90d9;stroke-width:2'));
  _sLabel(svg, o.ox+o.fw/2, o.oy+12, '長 '+p.l+' 公分', '#555', '10');
  _sLabel(svg, o.ox-14, o.oy-o.fh/2, '高 '+p.h+' 公分', '#555', '10');
  _sLabel(svg, o.ox+o.fw+o.sk+14, o.oy-o.fh/2-o.sk/2, '寬 '+p.w+' 公分', '#555', '10');
}

function _animRectPrism(svg, q) {
  var p = q.params, o = _rpProps3D(p.l, p.w, p.h);
  var fy = o.oy - o.fh;
  /* scale net to fit right half (max width 136) */
  var sc  = Math.min(9, Math.floor(132 / (2 * (p.l + p.w))));
  sc = Math.max(sc, 3);
  var dl  = Math.max(Math.round(p.l * sc), 30);
  var dw  = Math.max(Math.round(p.w * sc), 22);
  var dh  = Math.max(Math.round(p.h * sc), 22);
  var x0  = Math.max(154, Math.round((300 - 2*dl - 2*dw) / 2));
  var y0  = Math.max(12, Math.round((205 - 2*dw - dh) / 2));
  /* net faces */
  var TN  = _r4(x0+dw,    y0,       dl, dw);
  var LN  = _r4(x0,       y0+dw,    dw, dh);
  var FN  = _r4(x0+dw,    y0+dw,    dl, dh);
  var RN  = _r4(x0+dw+dl, y0+dw,    dw, dh);
  var BKN = _r4(x0+2*dw+dl,y0+dw,   dl, dh);
  var BTN = _r4(x0+dw,    y0+dw+dh, dl, dw);
  /* 3D start faces */
  var F3  = _r4(o.ox, fy, o.fw, o.fh);
  var T3  = [[o.ox,fy],[o.ox+o.sk,fy-o.sk],[o.ox+o.fw+o.sk,fy-o.sk],[o.ox+o.fw,fy]];
  var R3  = [[o.ox+o.fw,fy],[o.ox+o.fw+o.sk,fy-o.sk],[o.ox+o.fw+o.sk,o.oy-o.sk],[o.ox+o.fw,o.oy]];
  var WAIT = 800;
  var faces = [
    {s3:F3,  en:FN,  lx:x0+dw+dl/2,       ly:y0+dw+dh/2,     label:p.l+'×'+p.h, fill:'rgba(238,245,252,.95)'},
    {s3:T3,  en:TN,  lx:x0+dw+dl/2,       ly:y0+dw/2,        label:p.l+'×'+p.w, fill:'rgba(210,230,248,.95)'},
    {s3:R3,  en:RN,  lx:x0+dw+dl+dw/2,    ly:y0+dw+dh/2,     label:p.w+'×'+p.h, fill:'rgba(185,215,240,.95)'},
    {s3:F3,  en:LN,  lx:x0+dw/2,          ly:y0+dw+dh/2,     label:p.w+'×'+p.h, fill:'rgba(210,230,248,.95)'},
    {s3:R3,  en:BKN, lx:x0+2*dw+dl+dl/2,  ly:y0+dw+dh/2,     label:p.l+'×'+p.h, fill:'rgba(238,245,252,.95)'},
    {s3:F3,  en:BTN, lx:x0+dw+dl/2,       ly:y0+dw+dh+dw/2,  label:p.l+'×'+p.w, fill:'rgba(185,215,240,.95)'}
  ];
  faces.forEach(function(f, i) {
    var d = WAIT + i * 800;
    _animPoly(svg, f.s3, f.en, f.fill, d, null);
    _animLabel(svg, f.lx, f.ly, f.label, d);
  });
  _scheduleFormula(q, WAIT + faces.length * 800 + 200);
}

/* ════════════════════════════════════════
   CYLINDER — 圓柱
   Left 3D: cx=75, rx=58, ry=14
   Right net: vertical layout, cx=226
   ════════════════════════════════════════ */

function _drawCylinder3D(svg, q) {
  var p = q.params, c = _cylProps3D(p.r, p.h);
  svg.appendChild(_sSvgEl('rect',{x:c.cx-c.rx,y:c.topY,width:c.rx*2,height:c.bodyH},'fill:rgba(238,245,252,.95);stroke:none'));
  svg.appendChild(_sSvgEl('line',{x1:c.cx-c.rx,y1:c.topY,x2:c.cx-c.rx,y2:c.botY},'stroke:#4a90d9;stroke-width:2'));
  svg.appendChild(_sSvgEl('line',{x1:c.cx+c.rx,y1:c.topY,x2:c.cx+c.rx,y2:c.botY},'stroke:#4a90d9;stroke-width:2'));
  svg.appendChild(_sSvgEl('ellipse',{cx:c.cx,cy:c.botY,rx:c.rx,ry:c.ry},'fill:rgba(185,215,240,.95);stroke:#4a90d9;stroke-width:2'));
  svg.appendChild(_sSvgEl('ellipse',{cx:c.cx,cy:c.topY,rx:c.rx,ry:c.ry},'fill:rgba(238,245,252,.95);stroke:#4a90d9;stroke-width:2'));
  svg.appendChild(_sSvgEl('line',{x1:c.cx,y1:c.topY,x2:c.cx+c.rx,y2:c.topY},'stroke:#2d6fa8;stroke-width:1.5'));
  svg.appendChild(_sSvgEl('circle',{cx:c.cx,cy:c.topY,r:3},'fill:#2d6fa8'));
  svg.appendChild(_sSvgEl('line',{x1:c.cx+c.rx+7,y1:c.topY,x2:c.cx+c.rx+7,y2:c.botY},'stroke:#999;stroke-width:1;stroke-dasharray:3,2'));
  svg.appendChild(_sSvgEl('line',{x1:c.cx+c.rx+3,y1:c.topY,x2:c.cx+c.rx+11,y2:c.topY},'stroke:#999;stroke-width:1'));
  svg.appendChild(_sSvgEl('line',{x1:c.cx+c.rx+3,y1:c.botY,x2:c.cx+c.rx+11,y2:c.botY},'stroke:#999;stroke-width:1'));
  _sLabel(svg, c.cx+c.rx/2, c.topY-16, '半徑 '+p.r+' 公分', '#555', '10');
  _sLabel(svg, c.cx, c.botY+16, '高 '+p.h+' 公分', '#555', '10');
}

function _animCylinder(svg, q) {
  var p = q.params, c = _cylProps3D(p.r, p.h);
  var cx=c.cx, rx=c.rx, ry=c.ry, bodyH=c.bodyH, topY=c.topY, botY=c.botY;
  /* net: vertical, right half, cx=226 */
  var ncx=226, cr=24, gap=12;
  var rectH=Math.min(Math.max(p.h*10, 30), 70);
  var rectW=90, rectX=ncx-rectW/2;
  var topCY=40, rectY=topCY+cr+gap, botCY=rectY+rectH+gap+cr;
  var bodyPts = _r4(cx-rx, topY, rx*2, bodyH);
  var rectPts  = _r4(rectX, rectY, rectW, rectH);
  var WAIT = 800;
  /* 1. top oval → top circle */
  _animCircle(svg, cx, topY, ncx, topCY, cr, 'rgba(238,245,252,.95)', WAIT, null);
  _animLabel(svg, ncx, topCY, 'πr²', WAIT);
  /* 2. body → lateral rect */
  _animPoly(svg, bodyPts, rectPts, 'rgba(210,230,248,.95)', WAIT+800, null);
  _animLabel(svg, ncx, rectY+rectH/2, '2πr×h', WAIT+800);
  /* 3. bottom oval → bottom circle */
  _animCircle(svg, cx, botY, ncx, botCY, cr, 'rgba(238,245,252,.95)', WAIT+1600, null);
  _animLabel(svg, ncx, botCY, 'πr²', WAIT+1600);
  _scheduleFormula(q, WAIT + 3*800 + 200);
}

/* ════════════════════════════════════════
   TRIANGULAR PRISM — 直角三角柱
   Left 3D: x0=10, y0=165, bw=88, bh=65, sk=36
   Right net: dynamic, top=2 triangles, bottom=3 rects
   ════════════════════════════════════════ */

function _drawTriPrism3D(svg, q) {
  var p = q.params, t = _triProps3D(p.a, p.b, p.hp);
  var ay = t.y0 - t.bh;
  svg.appendChild(_sSvgEl('polygon',{points:_ptsStr([[t.x0,t.y0],[t.x0+t.bw,t.y0],[t.x0,ay]])},
    'fill:rgba(238,245,252,.95);stroke:#4a90d9;stroke-width:2'));
  svg.appendChild(_sSvgEl('polygon',{points:_ptsStr([[t.x0+t.sk,t.y0-t.sk],[t.x0+t.bw+t.sk,t.y0-t.sk],[t.x0+t.sk,ay-t.sk]])},
    'fill:rgba(210,230,248,.80);stroke:#4a90d9;stroke-width:1.5;stroke-dasharray:4,3'));
  [[t.x0,t.y0,t.x0+t.sk,t.y0-t.sk],[t.x0+t.bw,t.y0,t.x0+t.bw+t.sk,t.y0-t.sk],[t.x0,ay,t.x0+t.sk,ay-t.sk]].forEach(function(e){
    svg.appendChild(_sSvgEl('line',{x1:e[0],y1:e[1],x2:e[2],y2:e[3]},'stroke:#4a90d9;stroke-width:1.8'));
  });
  _sLabel(svg, t.x0+t.bw/2, t.y0+12, p.a+' 公分', '#555', '10');
  _sLabel(svg, t.x0-13, t.y0-t.bh/2, p.b+' 公分', '#555', '10');
  _sLabel(svg, t.x0+t.bw/2+t.sk/2+16, ay-t.sk/2, '柱高 '+p.hp+' 公分', '#555', '9');
}

function _animTriPrism(svg, q) {
  var p = q.params, t3 = _triProps3D(p.a, p.b, p.hp);
  var x0=t3.x0, y0=t3.y0, bw=t3.bw, bh=t3.bh, sk=t3.sk, ay=y0-bh;

  /* 三角形用獨立比例尺（受高度限制）；矩形用另一比例尺（受寬度限制） */
  var sc_t = Math.max(Math.min(8, Math.floor(58 / Math.max(p.a, p.b))), 3);
  var da_t = Math.max(Math.round(p.a * sc_t), 22);
  var db_t = Math.max(Math.round(p.b * sc_t), 22);

  var sc_r = Math.max(Math.min(8, Math.floor(128 / (p.a + p.b + p.c))), 2);
  var da_r = Math.max(Math.round(p.a * sc_r), 20);
  var db_r = Math.max(Math.round(p.b * sc_r), 20);
  var dc_r = Math.max(Math.round(p.c * sc_r), 26);
  var dh   = Math.max(Math.round(p.hp * sc_r), 22);

  /* 上排：2個三角形，置中，標籤放三角形下方空白 */
  var triSep = 20;
  var triTotalW = da_t * 2 + triSep;
  var triX0 = Math.max(155, Math.round((152 + 300 - triTotalW) / 2));
  var triTopY = 14;
  var tri1 = [[triX0,        triTopY+db_t], [triX0+da_t,          triTopY+db_t], [triX0,              triTopY]];
  var tri2 = [[triX0+da_t+triSep, triTopY+db_t], [triX0+da_t*2+triSep, triTopY+db_t], [triX0+da_t+triSep, triTopY]];
  var triLabelY = triTopY + db_t + 13; /* 標籤放在三角形下方 */

  /* 下排：3個矩形，置中，標籤放矩形中央 */
  var rowGap = 26; /* 三角形底到矩形頂 */
  var rectTotalW = da_r + db_r + dc_r;
  var rectX0 = Math.max(155, Math.round((152 + 300 - rectTotalW) / 2));
  var rectTopY = triTopY + db_t + rowGap;
  var rectA = _r4(rectX0,            rectTopY, da_r, dh);
  var rectB = _r4(rectX0 + da_r,     rectTopY, db_r, dh);
  var rectC = _r4(rectX0+da_r+db_r,  rectTopY, dc_r, dh);

  /* 3D 起始位置 */
  var front3d = [[x0,y0],[x0+bw,y0],[x0,ay]];
  var faceBot  = [[x0,y0],[x0+bw,y0],[x0+bw+sk,y0-sk],[x0+sk,y0-sk]];
  var faceLeft = [[x0,y0],[x0,ay],[x0+sk,ay-sk],[x0+sk,y0-sk]];
  var faceHyp  = [[x0+bw,y0],[x0,ay],[x0+sk,ay-sk],[x0+bw+sk,y0-sk]];

  var WAIT = 800;
  /* 1. 前三角形 */
  _animPoly(svg, front3d, tri1, 'rgba(238,245,252,.95)', WAIT, null);
  _animLabel(svg, triX0 + da_t/2, triLabelY, p.a+'×'+p.b+'÷2', WAIT);
  /* 2. 後三角形 */
  _animPoly(svg, front3d, tri2, 'rgba(210,230,248,.95)', WAIT+800, null);
  _animLabel(svg, triX0+da_t+triSep+da_t/2, triLabelY, p.a+'×'+p.b+'÷2', WAIT+800);
  /* 3. 矩形 a×hp */
  _animPoly(svg, faceBot,  rectA, 'rgba(185,215,240,.95)', WAIT+1600, null);
  _animLabel(svg, rectX0+da_r/2,          rectTopY+dh/2, p.a+'×'+p.hp, WAIT+1600);
  /* 4. 矩形 b×hp */
  _animPoly(svg, faceLeft, rectB, 'rgba(210,230,248,.95)', WAIT+2400, null);
  _animLabel(svg, rectX0+da_r+db_r/2,     rectTopY+dh/2, p.b+'×'+p.hp, WAIT+2400);
  /* 5. 矩形 c×hp */
  _animPoly(svg, faceHyp,  rectC, 'rgba(238,245,252,.95)', WAIT+3200, null);
  _animLabel(svg, rectX0+da_r+db_r+dc_r/2, rectTopY+dh/2, p.c+'×'+p.hp, WAIT+3200);
  _scheduleFormula(q, WAIT + 5*800 + 200);
}

/* ════════════════════════════════════════
   公式步驟（SVG 底部提示區 y=222+）
   ════════════════════════════════════════ */

function _surfFormula(q) {
  var p = q.params, steps;
  switch (q.shape) {
    case 'cube':
      steps = [
        {cls:'step-formula', text:'表面積 = 6 × 邊長²'},
        {cls:'step-sub',     text:'= 6 × '+p.s+' × '+p.s+' = 6 × '+(p.s*p.s)},
        {cls:'step-answer',  text:'= '+q.answer+' 平方公分 ✓'}
      ];
      break;
    case 'rectangular_prism':
      steps = [
        {cls:'step-formula', text:'2(長×高) + 2(寬×高) + 2(長×寬)'},
        {cls:'step-sub',     text:'= 2×'+p.l*p.h+' + 2×'+p.w*p.h+' + 2×'+p.l*p.w},
        {cls:'step-sub',     text:'= '+(2*p.l*p.h)+' + '+(2*p.w*p.h)+' + '+(2*p.l*p.w)},
        {cls:'step-answer',  text:'= '+q.answer+' 平方公分 ✓'}
      ];
      break;
    case 'cylinder':
      steps = [
        {cls:'step-formula', text:'表面積 = 2 × π × r × (r + 高)'},
        {cls:'step-sub',     text:'= 2 × 3.14 × '+p.r+' × ('+p.r+' + '+p.h+') = 2 × 3.14 × '+p.r+' × '+(p.r+p.h)},
        {cls:'step-answer',  text:'= '+q.answer+' 平方公分 ✓'}
      ];
      break;
    case 'triangular_prism':
      steps = [
        {cls:'step-formula', text:'表面積 = 2個三角底面 + 3個矩形側面'},
        {cls:'step-sub',     text:'底面 '+p.a+'×'+p.b+'÷2='+p.baseArea+'  側面 '+(p.a+p.b+p.c)+'×'+p.hp+'='+((p.a+p.b+p.c)*p.hp)},
        {cls:'step-answer',  text:'= '+q.answer+' 平方公分 ✓'}
      ];
      break;
  }
  if (steps) showFormulaSteps(steps);
}

/* ════════════════════════════════════════
   公開 API
   ════════════════════════════════════════ */

function surfDrawShape(q) {
  var svg = _sClearSvg();
  if (!svg) return;
  switch (q.shape) {
    case 'cube':              _drawCube3D(svg, q);      break;
    case 'rectangular_prism': _drawRectPrism3D(svg, q); break;
    case 'cylinder':          _drawCylinder3D(svg, q);  break;
    case 'triangular_prism':  _drawTriPrism3D(svg, q);  break;
  }
  _drawDivider(svg);
  _drawRightGuide(svg);
}

function surfPlayHint(q) {
  var svg = _sClearSvg();
  if (!svg) return;
  /* redraw 3D on left (stays static during animation) */
  switch (q.shape) {
    case 'cube':              _drawCube3D(svg, q);      break;
    case 'rectangular_prism': _drawRectPrism3D(svg, q); break;
    case 'cylinder':          _drawCylinder3D(svg, q);  break;
    case 'triangular_prism':  _drawTriPrism3D(svg, q);  break;
  }
  _drawDivider(svg);
  /* start unfolding animation on right */
  switch (q.shape) {
    case 'cube':              _animCube(svg, q);      break;
    case 'rectangular_prism': _animRectPrism(svg, q); break;
    case 'cylinder':          _animCylinder(svg, q);  break;
    case 'triangular_prism':  _animTriPrism(svg, q);  break;
  }
}
