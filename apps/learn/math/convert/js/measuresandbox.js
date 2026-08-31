/**
 * measuresandbox.js — 度量衡沙盒（長度/重量/容量）
 * 共用 split/merge 底層邏輯，三種視覺渲染器（長條/砝碼/量杯）
 */
'use strict';

// ════════════════════════════════════════
//  配對設定
// ════════════════════════════════════════

var _MS_CFG = {
  'mm-cm': {
    domain:'length', factor:10,
    largeLabel:'公分', smallLabel:'公釐', largeSym:'cm', smallSym:'mm',
    splitText:'切出1公分',
    largeColors:['#4a90d9','#2d6fa8','#1a5090','#0d3570','#04204a'],
    smallColor:'#e67e22'
  },
  'cm-m': {
    domain:'length', factor:100,
    largeLabel:'公尺', smallLabel:'公分', largeSym:'m', smallSym:'cm',
    splitText:'切出1公尺',
    largeColors:['#27ae60','#1e8449','#176a3a','#0f5229','#084020'],
    smallColor:'#8e44ad'
  },
  'm-km': {
    domain:'length', factor:1000,
    largeLabel:'公里', smallLabel:'公尺', largeSym:'km', smallSym:'m',
    splitText:'切出1公里',
    largeColors:['#8e44ad','#6c3483','#5a2075','#4a1065','#3a0055'],
    smallColor:'#16a085'
  },
  'g-kg': {
    domain:'weight', factor:1000,
    largeLabel:'公斤', smallLabel:'公克', largeSym:'kg', smallSym:'g',
    splitText:'切出1公斤',
    largeColors:['#e67e22','#ca6f1e','#b35a10','#9a4600','#803a00'],
    smallColor:'#4a90d9'
  },
  'kg-t': {
    domain:'weight', factor:1000,
    largeLabel:'公噸', smallLabel:'公斤', largeSym:'t', smallSym:'kg',
    splitText:'切出1公噸',
    largeColors:['#d63384','#a0255e','#7b1045','#5e0030','#400020'],
    smallColor:'#27ae60'
  },
  'ml-l': {
    domain:'volume', factor:1000,
    largeLabel:'公升', smallLabel:'毫升', largeSym:'L', smallSym:'ml',
    splitText:'切出1公升',
    largeColors:['#16a085','#0e6655','#0a4a40','#063530','#022520'],
    smallColor:'#e67e22'
  }
};

// ════════════════════════════════════════
//  狀態
// ════════════════════════════════════════

var msBlocks      = [];
var msSeq         = 0;
var msInitV       = null;
var msCurrentPair = 'cm-m';

function _msNextId() { return ++msSeq; }

function msFindBlock(id) {
  for (var i = 0; i < msBlocks.length; i++) {
    if (msBlocks[i].id === id) return msBlocks[i];
  }
  return null;
}

function _msBlockWeight(block) {
  var cfg = _MS_CFG[msCurrentPair];
  if (!cfg) return block.amount;
  return block.isLarge ? block.amount * cfg.factor : block.amount;
}

function msGetTotal() {
  return msBlocks.reduce(function(s, b) { return s + _msBlockWeight(b); }, 0);
}

// ════════════════════════════════════════
//  初始化
// ════════════════════════════════════════

function msInitForQuestion(q) {
  sbClosePopup();
  var stage = document.getElementById('ms-stage');
  if (stage) stage.innerHTML = '';
  msBlocks = [];
  msInitV  = null;
  if (!q || !q.msVisual) { msUpdateStats(); return; }
  msInitV = q.msVisual;
  _msLoadVisual(q.msVisual);
}

function _msLoadVisual(v) {
  msCurrentPair = v.pair;
  var cfg = _MS_CFG[msCurrentPair];
  msBlocks = [];

  if (v.mode === 'split') {
    msBlocks.push({ id: _msNextId(), amount: v.totalSmall, isLarge: false });
  } else {
    for (var i = 0; i < v.largeCount; i++) {
      msBlocks.push({ id: _msNextId(), amount: 1, isLarge: true });
    }
    if (v.remainSmall > 0) {
      msBlocks.push({ id: _msNextId(), amount: v.remainSmall, isLarge: false });
    }
  }

  var hintEl = document.getElementById('ms-hint');
  if (hintEl) {
    hintEl.textContent = v.mode === 'split'
      ? '點擊，選擇「' + cfg.splitText + '」'
      : '點擊大單位，選擇「展開」';
  }

  _msUpdateLegend();
  msRenderSandbox();
  msUpdateStats();
}

function _msUpdateLegend() {
  var cfg = _MS_CFG[msCurrentPair];
  var el  = document.getElementById('ms-legend');
  if (!el || !cfg) return;
  el.innerHTML =
    '<span class="ms-leg" style="color:' + cfg.largeColors[0] + '">■ ' + cfg.largeLabel + '</span>' +
    '<span class="ms-leg" style="color:' + cfg.smallColor    + '">■ ' + cfg.smallLabel  + '</span>';
}

function msResetScene() {
  if (typeof sfxTap === 'function') sfxTap();
  sbClosePopup();
  var stage = document.getElementById('ms-stage');
  if (stage) stage.innerHTML = '';
  msBlocks = [];
  if (msInitV) _msLoadVisual(msInitV);
  else msUpdateStats();
}

// ════════════════════════════════════════
//  渲染 — 路由器
// ════════════════════════════════════════

function msRenderSandbox() {
  var cfg = _MS_CFG[msCurrentPair];
  if (!cfg) return;
  if      (cfg.domain === 'length') _msRenderLength();
  else if (cfg.domain === 'weight') _msRenderWeight();
  else if (cfg.domain === 'volume') _msRenderVolume();
}

// ════════════════════════════════════════
//  長度渲染（水平比例長條）
// ════════════════════════════════════════

function _msRenderLength() {
  var stage = document.getElementById('ms-stage');
  if (!stage) return;
  stage.innerHTML = '';
  stage.className = 'ms-stage ms-stage-length';

  var total = msGetTotal();
  if (total === 0) return;

  var cfg      = _MS_CFG[msCurrentPair];
  var trackWrap = document.createElement('div');
  trackWrap.className = 'ms-track-wrap';
  var track = document.createElement('div');
  track.className = 'ms-track';
  trackWrap.appendChild(track);

  var largeIdx = 0;
  msBlocks.forEach(function(b) {
    var weight = _msBlockWeight(b);
    var pct    = (weight / total) * 100;
    var el     = document.createElement('div');
    el.className = 'ms-brick';
    el.id        = 'msb-' + b.id;
    el.style.width = pct.toFixed(2) + '%';

    if (b.isLarge) {
      el.style.background = cfg.largeColors[Math.min(largeIdx, cfg.largeColors.length - 1)];
      largeIdx++;
      var subLabel = cfg.factor + cfg.smallSym;  // e.g., "100cm"
      if (pct >= 9) {
        el.innerHTML = '<span class="ms-brick-main">1' + cfg.largeLabel + '/' + cfg.largeSym + '</span>' +
                       '<span class="ms-brick-sub">' + subLabel + '</span>';
      } else if (pct >= 5) {
        el.innerHTML = '<span class="ms-brick-main">1' + cfg.largeSym + '</span>' +
                       '<span class="ms-brick-sub">' + subLabel + '</span>';
      } else {
        el.innerHTML = '<span class="ms-brick-main">' + cfg.largeSym + '</span>';
      }
    } else {
      el.style.background = cfg.smallColor;
      var smallMainLabel = b.amount + cfg.smallSym;
      var smallSubLabel  = b.amount + cfg.smallLabel;
      if (pct >= 9) {
        el.innerHTML = '<span class="ms-brick-main">' + smallMainLabel + '</span>' +
                       '<span class="ms-brick-sub">' + smallSubLabel + '</span>';
      } else {
        el.innerHTML = '<span class="ms-brick-main">' + smallMainLabel + '</span>';
      }
    }

    (function(bid) {
      el.addEventListener('click',    function(e) { e.stopPropagation(); msShowPopup(bid); });
      el.addEventListener('touchend', function(e) { e.preventDefault();  msShowPopup(bid); }, { passive: false });
    })(b.id);

    track.appendChild(el);
  });

  stage.appendChild(trackWrap);
}

// ════════════════════════════════════════
//  重量渲染（砝碼圖示，SVG）
// ════════════════════════════════════════

function _msWeightSvg(size, color, topLabel, botLabel) {
  var w    = size;
  var h    = Math.round(size * 1.15);
  var ringR  = Math.round(size * 0.11);
  var ringCx = Math.round(w / 2);
  var ringCy = ringR + 3;
  var bodyTop = ringCy * 2 + 4;
  var bodyH   = h - bodyTop;
  var tl = Math.round(w * 0.22), tr = Math.round(w * 0.78);
  var pts = tl + ',' + bodyTop + ' ' + tr + ',' + bodyTop + ' ' + w + ',' + h + ' 0,' + h;

  var fs1 = Math.max(9,  Math.round(size * 0.23));
  var fs2 = Math.max(7,  Math.round(size * 0.17));

  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="' + ringCx + '" cy="' + ringCy + '" r="' + ringR + '" fill="none" stroke="' + color + '" stroke-width="2.5"/>' +
    '<polygon points="' + pts + '" fill="' + color + '"/>' +
    '<text x="' + Math.round(w/2) + '" y="' + Math.round(bodyTop + bodyH * 0.38) + '"' +
      ' text-anchor="middle" dominant-baseline="middle" fill="white"' +
      ' font-size="' + fs1 + '" font-weight="900" font-family="\'Noto Sans TC\',sans-serif">' + topLabel + '</text>' +
    '<text x="' + Math.round(w/2) + '" y="' + Math.round(bodyTop + bodyH * 0.70) + '"' +
      ' text-anchor="middle" dominant-baseline="middle" fill="rgba(255,255,255,0.85)"' +
      ' font-size="' + fs2 + '" font-weight="700" font-family="\'Noto Sans TC\',sans-serif">' + botLabel + '</text>' +
    '</svg>';
}

function _msRenderWeight() {
  var stage = document.getElementById('ms-stage');
  if (!stage) return;
  stage.innerHTML = '';
  stage.className = 'ms-stage ms-stage-weight';

  var cfg       = _MS_CFG[msCurrentPair];
  var total     = msGetTotal();
  if (total === 0) return;

  var largeSize = 135;
  var smallSize = 78;
  var largeIdx  = 0;

  msBlocks.forEach(function(b) {
    var size  = b.isLarge ? largeSize : smallSize;
    var color = b.isLarge
      ? cfg.largeColors[Math.min(largeIdx, cfg.largeColors.length - 1)]
      : cfg.smallColor;
    if (b.isLarge) largeIdx++;

    var topLabel = b.isLarge ? '1'           : String(b.amount);
    var botLabel = b.isLarge ? cfg.largeSym  : cfg.smallSym;

    var wrap = document.createElement('div');
    wrap.className = 'ms-weight-wrap';
    wrap.id        = 'msb-' + b.id;
    wrap.innerHTML = _msWeightSvg(size, color, topLabel, botLabel);

    (function(bid) {
      wrap.addEventListener('click',    function(e) { e.stopPropagation(); msShowPopup(bid); });
      wrap.addEventListener('touchend', function(e) { e.preventDefault();  msShowPopup(bid); }, { passive: false });
    })(b.id);

    stage.appendChild(wrap);
  });
}

// ════════════════════════════════════════
//  容量渲染（量杯，SVG）
// ════════════════════════════════════════

function _msCupSvg(w, h, color, topLabel, botLabel) {
  var bm  = Math.round(w * 0.08);   // bottom margin (sides)
  var topW = w - bm * 2;
  var fillH = Math.round(h * 0.78);
  var fillY = h - fillH;

  // 裝飾刻度線（純視覺）
  var lines = '';
  var numLines = 3;
  for (var i = 1; i <= numLines; i++) {
    var ly  = fillY + Math.round(fillH * i / (numLines + 1));
    var lw  = Math.round(topW * 0.28);
    var lx1 = bm + topW - lw;
    lines += '<line x1="' + lx1 + '" y1="' + ly + '" x2="' + (bm + topW) + '" y2="' + ly +
             '" stroke="rgba(255,255,255,0.55)" stroke-width="1.5"/>';
  }

  var fs1 = Math.max(9,  Math.round(w * 0.28));
  var fs2 = Math.max(7,  Math.round(w * 0.20));
  var cy1 = Math.round(fillY + fillH * 0.35);
  var cy2 = Math.round(fillY + fillH * 0.65);

  return '<svg width="' + w + '" height="' + (h + 6) + '" viewBox="0 0 ' + w + ' ' + (h + 6) + '" xmlns="http://www.w3.org/2000/svg">' +
    // 把手/壺嘴
    '<rect x="' + bm + '" y="0" width="' + topW + '" height="5" rx="2.5" fill="' + color + '" opacity="0.7"/>' +
    // 液體填充
    '<rect x="' + bm + '" y="' + (fillY + 5) + '" width="' + topW + '" height="' + fillH + '" fill="' + color + '" opacity="0.82"/>' +
    // 刻度線
    lines +
    // 杯體外框
    '<rect x="' + bm + '" y="5" width="' + topW + '" height="' + h + '" rx="4" fill="none" stroke="' + color + '" stroke-width="2.5" opacity="0.75"/>' +
    // 標籤
    '<text x="' + Math.round(w / 2) + '" y="' + cy1 + '"' +
      ' text-anchor="middle" dominant-baseline="middle" fill="white"' +
      ' font-size="' + fs1 + '" font-weight="900" font-family="\'Noto Sans TC\',sans-serif">' + topLabel + '</text>' +
    '<text x="' + Math.round(w / 2) + '" y="' + cy2 + '"' +
      ' text-anchor="middle" dominant-baseline="middle" fill="rgba(255,255,255,0.85)"' +
      ' font-size="' + fs2 + '" font-weight="700" font-family="\'Noto Sans TC\',sans-serif">' + botLabel + '</text>' +
    '</svg>';
}

function _msRenderVolume() {
  var stage = document.getElementById('ms-stage');
  if (!stage) return;
  stage.innerHTML = '';
  stage.className = 'ms-stage ms-stage-volume';

  var cfg      = _MS_CFG[msCurrentPair];
  var total    = msGetTotal();
  if (total === 0) return;

  var largeCupW = 108, largeCupH = 180;
  var smallCupW =  69, smallCupH = 117;
  var largeIdx  = 0;

  msBlocks.forEach(function(b) {
    var color = b.isLarge
      ? cfg.largeColors[Math.min(largeIdx, cfg.largeColors.length - 1)]
      : cfg.smallColor;
    if (b.isLarge) largeIdx++;

    var cw = b.isLarge ? largeCupW : smallCupW;
    var ch = b.isLarge ? largeCupH : smallCupH;

    var topLabel = b.isLarge ? '1'          : String(b.amount);
    var botLabel = b.isLarge ? cfg.largeSym : cfg.smallSym;

    var wrap = document.createElement('div');
    wrap.className = 'ms-cup-wrap';
    wrap.id        = 'msb-' + b.id;
    wrap.innerHTML = _msCupSvg(cw, ch, color, topLabel, botLabel);

    (function(bid) {
      wrap.addEventListener('click',    function(e) { e.stopPropagation(); msShowPopup(bid); });
      wrap.addEventListener('touchend', function(e) { e.preventDefault();  msShowPopup(bid); }, { passive: false });
    })(b.id);

    stage.appendChild(wrap);
  });
}

// ════════════════════════════════════════
//  彈窗
// ════════════════════════════════════════

function msShowPopup(id) {
  sbClosePopup();
  var block = msFindBlock(id);
  if (!block) return;
  var cfg = _MS_CFG[msCurrentPair];
  if (!cfg) return;

  var canSplit  = !block.isLarge && block.amount >= cfg.factor;
  var canExpand = block.isLarge;
  if (!canSplit && !canExpand) return;

  var popup    = document.getElementById('sb-popup');
  var targetEl = document.getElementById('msb-' + id);
  if (!popup || !targetEl) return;

  var html = '';
  if (canExpand) {
    html += '<button class="sb-popup-opt ts-popup-opt" onclick="msDoExpand(' + id + ')">' +
            '<span class="ts-pop-icon">⊕</span>' +
            '<span class="ts-pop-label">展開（換成' + cfg.factor + cfg.smallLabel + '）</span>' +
            '</button>';
  }
  if (canSplit) {
    html += '<button class="sb-popup-opt ts-popup-opt" onclick="msDoSplit(' + id + ')">' +
            '<span class="ts-pop-icon">✂</span>' +
            '<span class="ts-pop-label">' + cfg.splitText + '</span>' +
            '</button>';
  }
  popup.innerHTML = html;
  _sbPopupPosition(popup, targetEl);
}

// ════════════════════════════════════════
//  操作
// ════════════════════════════════════════

function msDoSplit(id) {
  var block = msFindBlock(id);
  var cfg   = _MS_CFG[msCurrentPair];
  if (!block || !cfg || block.isLarge || block.amount < cfg.factor) return;
  sbClosePopup();
  if (typeof sfxTap === 'function') sfxTap();

  var idx      = msBlocks.indexOf(block);
  var newLarge = { id: _msNextId(), amount: 1, isLarge: true };
  block.amount -= cfg.factor;

  msBlocks.splice(idx, 0, newLarge);
  if (block.amount === 0) msBlocks.splice(msBlocks.indexOf(block), 1);

  msRenderSandbox();
  msUpdateStats();
}

function msDoExpand(id) {
  var block = msFindBlock(id);
  var cfg   = _MS_CFG[msCurrentPair];
  if (!block || !cfg || !block.isLarge) return;
  sbClosePopup();
  if (typeof sfxTap === 'function') sfxTap();

  var idx = msBlocks.indexOf(block);
  msBlocks.splice(idx, 1, { id: _msNextId(), amount: cfg.factor, isLarge: false });

  msRenderSandbox();
  msUpdateStats();
}

// ════════════════════════════════════════
//  統計列
// ════════════════════════════════════════

function msUpdateStats() {
  var el = document.getElementById('ms-status');
  if (!el) return;
  var cfg = _MS_CFG[msCurrentPair];
  if (!cfg) { el.textContent = '場景：0'; return; }

  var total      = msGetTotal();
  var largeCount = msBlocks.filter(function(b) { return  b.isLarge; }).length;
  var smallTotal = msBlocks.filter(function(b) { return !b.isLarge; })
                           .reduce(function(s, b) { return s + b.amount; }, 0);

  if (msBlocks.length <= 1) {
    el.textContent = '場景：' + total + ' ' + cfg.smallLabel;
  } else if (msInitV && msInitV.mode === 'merge') {
    var parts = [];
    if (largeCount > 0) parts.push(largeCount + ' ' + cfg.largeLabel);
    if (smallTotal > 0) parts.push(smallTotal + ' ' + cfg.smallLabel);
    el.textContent = parts.join(' + ');
  } else {
    var parts = [];
    if (largeCount > 0) parts.push(largeCount + ' ' + cfg.largeLabel);
    if (smallTotal > 0) parts.push(smallTotal + ' ' + cfg.smallLabel);
    el.textContent = total + ' ' + cfg.smallLabel + ' = ' + parts.join(' + ');
  }
}
