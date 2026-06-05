'use strict';

/* ════════════════════════════════════════
   體積沙盒 — SVG 圖形繪製 + 提示動畫
   等角投影風格的 3D 示意圖
   ════════════════════════════════════════ */

function _vSvgEl(tag, attrs, styleStr) {
  var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.keys(attrs || {}).forEach(function(k) { el.setAttribute(k, attrs[k]); });
  if (styleStr) el.setAttribute('style', styleStr);
  return el;
}

function _vClearSvg() {
  var svg = document.getElementById('sandbox-svg');
  if (svg) svg.innerHTML = '';
  return svg;
}

function _vLabel(svg, x, y, text, color) {
  var t = _vSvgEl('text', { x:x, y:y, 'text-anchor':'middle', 'dominant-baseline':'middle',
    'font-size':'11', 'font-family':'Noto Sans TC, sans-serif', 'font-weight':'700' },
    'fill:' + (color || 'var(--blue-dk)'));
  t.textContent = text;
  svg.appendChild(t);
}

/* 3D box helper: draws front / top / right faces
   ox,oy = bottom-left of front face; fw,fh = front face W,H; sk = skew depth */
function _drawBox(svg, ox, oy, fw, fh, sk, fillF, fillT, fillR) {
  /* front face */
  svg.appendChild(_vSvgEl('rect', { x:ox, y:oy-fh, width:fw, height:fh },
    'fill:'+(fillF||'var(--blue-lt)')+';stroke:var(--blue);stroke-width:2'));
  /* top face */
  var topPts = ox+','+(oy-fh)+' '+(ox+sk)+','+(oy-fh-sk)+' '+(ox+fw+sk)+','+(oy-fh-sk)+' '+(ox+fw)+','+(oy-fh);
  svg.appendChild(_vSvgEl('polygon', { points:topPts },
    'fill:'+(fillT||'#d8ecfa')+';stroke:var(--blue);stroke-width:2'));
  /* right face */
  var rightPts = (ox+fw)+','+(oy-fh)+' '+(ox+fw+sk)+','+(oy-fh-sk)+' '+(ox+fw+sk)+','+(oy-sk)+' '+(ox+fw)+','+oy;
  svg.appendChild(_vSvgEl('polygon', { points:rightPts },
    'fill:'+(fillR||'#c0dff5')+';stroke:var(--blue);stroke-width:2'));
}

/* ── 正方體（scale=15px/unit，s=2→30px，s=8→120px） ── */
function _drawCube(q) {
  var svg = _vClearSvg();
  var s = q.params.s;
  var sz = s*15, sk = Math.round(s*4.8);
  var ox = Math.max(18, Math.round((278-sz-sk)/2));
  var oy = Math.min(193, Math.max(sz+sk+26, Math.round((210+sz+sk)/2)));
  _drawBox(svg, ox, oy, sz, sz, sk);
  _vLabel(svg, ox+sz/2, oy-sz-sk-14, '邊長 '+s+' 公分');
  _vLabel(svg, ox+sz+sk+22, oy-sz/2-sk/2, s+' 公分');
  _vLabel(svg, ox-18, oy-sz/2, s+' 公分');
}

/* ── 長方體（動態比例，精確 l:w:h） ── */
function _drawRectPrism(q) {
  var svg = _vClearSvg();
  var p = q.params, l = p.l, w = p.w, h = p.h;
  var SKF = 0.38;
  var sc = Math.min(13, Math.floor(228/(l+w*SKF)), Math.floor(182/(h+w*SKF)));
  sc = Math.max(sc, 5);
  var fw = Math.round(l*sc), fh = Math.round(h*sc), sk = Math.round(w*sc*SKF);
  var ox = Math.max(18, Math.round((278-fw-sk)/2));
  var oy = Math.min(193, Math.max(fh+sk+26, Math.round((210+fh+sk)/2)));
  _drawBox(svg, ox, oy, fw, fh, sk);
  _vLabel(svg, ox+fw/2, oy-fh-sk-14, '長 '+l+' 公分');
  _vLabel(svg, ox+fw+sk+24, oy-fh/2-sk/2+4, '高 '+h+' 公分');
  _vLabel(svg, ox-20, oy-fh/2, '寬 '+w+' 公分');
}

/* ── 圓柱（單一比例，精確 r:h） ── */
function _drawCylinder(q) {
  var svg = _vClearSvg();
  var p = q.params, r = p.r, h = p.h;
  var sc = Math.min(14, Math.floor(122/r), Math.floor(158/h));
  sc = Math.max(sc, 8);
  var cx = 150, cw = r*sc, ry = Math.max(4, Math.round(cw*0.22));
  var bodyH = h*sc;
  var topY = Math.max(22, Math.round((212-bodyH-2*ry)/2));
  var botY = topY+bodyH;
  svg.appendChild(_vSvgEl('rect',{x:cx-cw,y:topY,width:cw*2,height:bodyH},'fill:var(--blue-lt);stroke:none'));
  svg.appendChild(_vSvgEl('line',{x1:cx-cw,y1:topY,x2:cx-cw,y2:botY},'stroke:var(--blue);stroke-width:2'));
  svg.appendChild(_vSvgEl('line',{x1:cx+cw,y1:topY,x2:cx+cw,y2:botY},'stroke:var(--blue);stroke-width:2'));
  svg.appendChild(_vSvgEl('ellipse',{cx:cx,cy:botY,rx:cw,ry:ry},'fill:#c0dff5;stroke:var(--blue);stroke-width:2'));
  svg.appendChild(_vSvgEl('ellipse',{cx:cx,cy:topY,rx:cw,ry:ry},'fill:var(--blue-lt);stroke:var(--blue);stroke-width:2'));
  svg.appendChild(_vSvgEl('line',{x1:cx,y1:topY,x2:cx+cw,y2:topY},'stroke:var(--blue-dk);stroke-width:1.5'));
  svg.appendChild(_vSvgEl('circle',{cx:cx,cy:topY,r:3},'fill:var(--blue-dk)'));
  _vLabel(svg, cx+cw/2, topY-14, '半徑 '+r+' 公分');
  _vLabel(svg, cx+cw+24, topY+bodyH/2, '高 '+h+' 公分');
}

/* ── 三角柱（動態比例，精確 b:ht:hp） ── */
function _drawTriPrism(q) {
  var svg = _vClearSvg();
  var p = q.params, b = p.b, ht = p.ht, hp = p.hp;
  var SKF = 0.45;
  var sc = Math.min(7, Math.floor(143/ht), Math.floor(193/b), Math.floor(138/(b+hp*SKF)));
  sc = Math.max(sc, 4);
  var bw = Math.round(b*sc), bh = Math.round(ht*sc), sk = Math.round(hp*sc*SKF);
  var x0 = Math.max(18, Math.round((278-bw-sk)/2));
  var y0 = Math.min(193, Math.max(bh+sk+26, Math.round((210+bh+sk)/2)));
  var ax = x0+bw/2, ay = y0-bh;
  svg.appendChild(_vSvgEl('polygon',{points:x0+','+y0+' '+(x0+bw)+','+y0+' '+ax+','+ay},
    'fill:var(--blue-lt);stroke:var(--blue);stroke-width:2'));
  var bxb=x0+sk, byb=y0-sk;
  svg.appendChild(_vSvgEl('polygon',{points:bxb+','+byb+' '+(bxb+bw)+','+byb+' '+(ax+sk)+','+(ay-sk)},
    'fill:#d8ecfa;stroke:var(--blue);stroke-width:1.5;stroke-dasharray:4,3'));
  [[x0,y0,bxb,byb],[x0+bw,y0,bxb+bw,byb],[ax,ay,ax+sk,ay-sk]].forEach(function(e){
    svg.appendChild(_vSvgEl('line',{x1:e[0],y1:e[1],x2:e[2],y2:e[3]},'stroke:var(--blue);stroke-width:1.8'));
  });
  _vLabel(svg, x0+bw/2, y0+14, '底 '+b+' 公分');
  _vLabel(svg, x0-14, y0-bh/2, '高 '+ht+' 公分');
  _vLabel(svg, ax+sk/2+28, ay-sk/2+8, '柱高 '+hp+' 公分');
}

/* ════════════════════════════════════════
   公開 API
   ════════════════════════════════════════ */

function volDrawShape(q) {
  switch (q.shape) {
    case 'cube':              _drawCube(q);      break;
    case 'rectangular_prism': _drawRectPrism(q); break;
    case 'cylinder':          _drawCylinder(q);  break;
    case 'triangular_prism':  _drawTriPrism(q);  break;
  }
}

function volPlayHint(q) {
  var p = q.params;
  var steps = [];
  switch (q.shape) {
    case 'cube':
      steps = [
        { cls:'step-formula', text:'體積公式：邊長 × 邊長 × 邊長' },
        { cls:'step-sub',     text:'= ' + p.s + ' × ' + p.s + ' × ' + p.s },
        { cls:'step-sub',     text:'= ' + (p.s*p.s) + ' × ' + p.s },
        { cls:'step-answer',  text:'= ' + q.answer + ' 立方公分 ✓' }
      ];
      break;
    case 'rectangular_prism':
      steps = [
        { cls:'step-formula', text:'體積公式：長 × 寬 × 高' },
        { cls:'step-sub',     text:'= ' + p.l + ' × ' + p.w + ' × ' + p.h },
        { cls:'step-sub',     text:'= ' + (p.l*p.w) + ' × ' + p.h },
        { cls:'step-answer',  text:'= ' + q.answer + ' 立方公分 ✓' }
      ];
      break;
    case 'cylinder':
      steps = [
        { cls:'step-formula', text:'體積公式：半徑 × 半徑 × 3.14 × 高' },
        { cls:'step-sub',     text:'= ' + p.r + ' × ' + p.r + ' × 3.14 × ' + p.h },
        { cls:'step-sub',     text:'= ' + (p.r*p.r) + ' × 3.14 × ' + p.h },
        { cls:'step-sub',     text:'底面積 = ' + Math.round(p.r*p.r*3.14*100)/100 + ' 平方公分' },
        { cls:'step-answer',  text:'= ' + q.answer + ' 立方公分 ✓' }
      ];
      break;
    case 'triangular_prism':
      steps = [
        { cls:'step-formula', text:'體積公式：底面積 × 柱高' },
        { cls:'step-sub',     text:'底面積 = 底 × 高 ÷ 2 = ' + p.b + ' × ' + p.ht + ' ÷ 2 = ' + p.baseArea },
        { cls:'step-sub',     text:'= ' + p.baseArea + ' × ' + p.hp },
        { cls:'step-answer',  text:'= ' + q.answer + ' 立方公分 ✓' }
      ];
      break;
  }
  showFormulaSteps(steps);
}
