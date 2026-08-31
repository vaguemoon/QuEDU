/**
 * timesandbox.js — 時間沙盒（支援 日↔時、時↔分、分↔秒 三對）
 */
'use strict';

// ════════════════════════════════════════
//  配對設定
// ════════════════════════════════════════

var _TS_CFG = {
  'day-hour': {
    largeType: 'day',    smallType: 'hour',   factor: 24,
    largeLabel: '日',    smallLabel: '時',
    largeLabelFull: '1日', smallUnitFull: '時',
    splitText: '切出1日',
    largeColors: ['#7b5ea7','#6c47a0','#5a3a8a','#4a2d7a','#3a2070'],
    smallColor:  '#4a90d9'
  },
  'hour-min': {
    largeType: 'hour',   smallType: 'minute', factor: 60,
    largeLabel: '小時',  smallLabel: '分',
    largeLabelFull: '1小時', smallUnitFull: '分',
    splitText: '切出1小時',
    largeColors: ['#4a90d9','#2d6fa8','#1a5090','#0d3570','#04204a'],
    smallColor:  '#e67e22'
  },
  'min-sec': {
    largeType: 'minute', smallType: 'second', factor: 60,
    largeLabel: '分',    smallLabel: '秒',
    largeLabelFull: '1分', smallUnitFull: '秒',
    splitText: '切出1分',
    largeColors: ['#e67e22','#ca6f1e','#b35a10','#9a4600','#803a00'],
    smallColor:  '#27ae60'
  }
};

// ════════════════════════════════════════
//  狀態
// ════════════════════════════════════════

var tsBlocks      = [];   // { id, amount, type ('day'|'hour'|'minute'|'second'), el }
var tsSeq         = 0;
var tsInitV       = null;
var tsCurrentPair = 'hour-min';

function _tsNextId() { return ++tsSeq; }

function tsFindBlock(id) {
  for (var i = 0; i < tsBlocks.length; i++) {
    if (tsBlocks[i].id === id) return tsBlocks[i];
  }
  return null;
}

// 換算成「小單位」總量（用於比例渲染）
function _tsBlockWeight(block) {
  var cfg = _TS_CFG[tsCurrentPair];
  if (!cfg) return block.amount;
  return block.type === cfg.largeType ? block.amount * cfg.factor : block.amount;
}

function tsGetTotal() {
  return tsBlocks.reduce(function(s, b) { return s + _tsBlockWeight(b); }, 0);
}

// ════════════════════════════════════════
//  初始化
// ════════════════════════════════════════

function tsInitForQuestion(q) {
  sbClosePopup();
  var track = document.getElementById('ts-track');
  if (track) track.innerHTML = '';
  tsBlocks  = [];
  tsInitV   = null;
  if (!q || !q.tsVisual) { tsUpdateStats(); return; }
  tsInitV = q.tsVisual;
  _tsLoadVisual(q.tsVisual);
}

function _tsLoadVisual(v) {
  tsCurrentPair = v.pair || 'hour-min';
  var cfg = _TS_CFG[tsCurrentPair];
  tsBlocks = [];

  if (v.mode === 'split') {
    // 小到大題：一塊大量小單位磚，讓學生切出大單位
    tsBlocks.push({ id: _tsNextId(), amount: v.totalSmall, type: cfg.smallType, el: null });
  } else {
    // 大到小題：N 塊大單位磚 + 可選餘量小單位磚
    for (var i = 0; i < v.largeCount; i++) {
      tsBlocks.push({ id: _tsNextId(), amount: 1, type: cfg.largeType, el: null });
    }
    if (v.remainSmall > 0) {
      tsBlocks.push({ id: _tsNextId(), amount: v.remainSmall, type: cfg.smallType, el: null });
    }
  }

  var hintEl = document.getElementById('ts-hint');
  if (hintEl) {
    hintEl.textContent = v.mode === 'split'
      ? '點擊長條，選擇「' + cfg.splitText + '」'
      : '點擊任一長條，選擇「合併」';
  }

  _tsUpdateLegend();
  tsRenderTrack();
  tsUpdateStats();
}

function _tsUpdateLegend() {
  var cfg = _TS_CFG[tsCurrentPair];
  var legEl = document.getElementById('ts-legend');
  if (!legEl || !cfg) return;
  legEl.innerHTML =
    '<span class="ts-leg ts-leg-large" style="color:' + cfg.largeColors[0] + '">■ ' + cfg.largeLabel + '</span>' +
    '<span class="ts-leg ts-leg-small" style="color:' + cfg.smallColor + '">■ ' + cfg.smallLabel + '</span>';
}

function tsResetScene() {
  if (typeof sfxTap === 'function') sfxTap();
  sbClosePopup();
  var track = document.getElementById('ts-track');
  if (track) track.innerHTML = '';
  tsBlocks = [];
  if (tsInitV) _tsLoadVisual(tsInitV);
  else tsUpdateStats();
}

// ════════════════════════════════════════
//  比例磚條渲染
// ════════════════════════════════════════

function tsRenderTrack() {
  var track = document.getElementById('ts-track');
  if (!track) return;
  track.innerHTML = '';

  var total = tsGetTotal();
  if (total === 0) return;

  var cfg      = _TS_CFG[tsCurrentPair];
  var largeIdx = 0;

  tsBlocks.forEach(function(b) {
    var weight = _tsBlockWeight(b);
    var pct    = (weight / total) * 100;
    var el     = document.createElement('div');
    el.className = 'ts-brick';
    el.id        = 'tsb-' + b.id;
    el.style.width = pct.toFixed(2) + '%';

    if (cfg && b.type === cfg.largeType) {
      el.style.background = cfg.largeColors[Math.min(largeIdx, cfg.largeColors.length - 1)];
      largeIdx++;
      var subLabel = cfg.factor + cfg.smallLabel;
      if (pct >= 22) {
        el.innerHTML = '<span class="ts-brick-main">' + cfg.largeLabelFull + '</span>' +
                       '<span class="ts-brick-sub">' + subLabel + '</span>';
      } else if (pct >= 11) {
        el.innerHTML = '<span class="ts-brick-main">' + cfg.largeLabelFull + '</span>';
      } else {
        el.innerHTML = '<span class="ts-brick-main">' + b.amount + cfg.largeLabel[0] + '</span>';
      }
    } else {
      el.style.background = cfg ? cfg.smallColor : '#e67e22';
      var sLabel = cfg ? cfg.smallLabel : '分';
      el.innerHTML = '<span class="ts-brick-main">' + b.amount + sLabel + '</span>';
    }

    (function(bid) {
      el.addEventListener('click', function(e) { e.stopPropagation(); tsShowPopup(bid); });
      el.addEventListener('touchend', function(e) { e.preventDefault(); tsShowPopup(bid); }, { passive: false });
    })(b.id);

    track.appendChild(el);
    b.el = el;
  });
}

// ════════════════════════════════════════
//  彈窗
// ════════════════════════════════════════

function tsShowPopup(id) {
  sbClosePopup();
  var block = tsFindBlock(id);
  if (!block) return;
  var cfg = _TS_CFG[tsCurrentPair];
  if (!cfg) return;

  var canSplit = block.type === cfg.smallType && block.amount >= cfg.factor;
  var canMerge = tsBlocks.length > 1;
  if (!canSplit && !canMerge) return;

  var popup = document.getElementById('sb-popup');
  if (!popup) return;

  var total = tsGetTotal();
  var html  = '';
  if (canSplit) {
    html += '<button class="sb-popup-opt ts-popup-opt" onclick="tsDoSplit(' + id + ')">' +
            '<span class="ts-pop-icon">✂</span>' +
            '<span class="ts-pop-label">' + cfg.splitText + '</span>' +
            '</button>';
  }
  if (canMerge) {
    html += '<button class="sb-popup-opt ts-popup-opt" onclick="tsDoMerge()">' +
            '<span class="ts-pop-icon">⊞</span>' +
            '<span class="ts-pop-label">合併（共' + total + cfg.smallLabel + '）</span>' +
            '</button>';
  }
  popup.innerHTML = html;
  _sbPopupPosition(popup, block.el);
}

// ════════════════════════════════════════
//  操作
// ════════════════════════════════════════

function tsDoSplit(id) {
  var block = tsFindBlock(id);
  var cfg   = _TS_CFG[tsCurrentPair];
  if (!block || !cfg || block.type !== cfg.smallType || block.amount < cfg.factor) return;
  sbClosePopup();
  if (typeof sfxTap === 'function') sfxTap();

  var idx      = tsBlocks.indexOf(block);
  var newLarge = { id: _tsNextId(), amount: 1, type: cfg.largeType, el: null };
  block.amount -= cfg.factor;

  tsBlocks.splice(idx, 0, newLarge);
  if (block.amount === 0) {
    tsBlocks.splice(tsBlocks.indexOf(block), 1);
  }

  tsRenderTrack();
  tsUpdateStats();
}

function tsDoMerge() {
  sbClosePopup();
  if (typeof sfxTap === 'function') sfxTap();
  var cfg = _TS_CFG[tsCurrentPair];
  if (!cfg) return;

  var total = tsGetTotal();
  var track = document.getElementById('ts-track');
  if (track) track.innerHTML = '';
  tsBlocks = [{ id: _tsNextId(), amount: total, type: cfg.smallType, el: null }];
  tsRenderTrack();
  tsUpdateStats();
}

// ════════════════════════════════════════
//  統計列
// ════════════════════════════════════════

function tsUpdateStats() {
  var el = document.getElementById('ts-status');
  if (!el) return;
  var cfg = _TS_CFG[tsCurrentPair];
  if (!cfg) { el.textContent = '場景：0'; return; }

  var total      = tsGetTotal();
  var largeCount = tsBlocks.filter(function(b) { return b.type === cfg.largeType; }).length;
  var smallTotal = tsBlocks.filter(function(b) { return b.type === cfg.smallType; })
                           .reduce(function(s, b) { return s + b.amount; }, 0);

  if (tsBlocks.length <= 1) {
    el.textContent = '場景：' + total + ' ' + cfg.smallLabel;
  } else if (tsInitV && tsInitV.mode === 'merge') {
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
