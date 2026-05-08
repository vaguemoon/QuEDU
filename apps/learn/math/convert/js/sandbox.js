/**
 * sandbox.js — 換算沙盒
 * 單幣：點擊 → 拆分彈窗；拖動 → 自由移動
 * 群組：空白處圈選同面額 → 點擊群組 → 合併彈窗；拖動群組 → 整組移動
 */
'use strict';

// ════════════════════════════════════════
//  常數定義
// ════════════════════════════════════════

var SB_CHAIN = [1000, 500, 100, 50, 10, 5, 1];
var SB_BILLS = [100, 500, 1000];

var SB_SPLIT = {
  1000: [{ to: 500, n: 2  }, { to: 100, n: 10 }],
  500:  [{ to: 100, n: 5  }, { to: 50,  n: 10 }],
  100:  [{ to: 50,  n: 2  }, { to: 10,  n: 10 }],
  50:   [{ to: 10,  n: 5  }, { to: 5,   n: 10 }],
  10:   [{ to: 5,   n: 2  }, { to: 1,   n: 10 }],
  5:    [{ to: 1,   n: 5  }]
};

var DRAG_THRESHOLD = 6;

// ════════════════════════════════════════
//  狀態
// ════════════════════════════════════════

var sbCoins       = [];   // { id, denom, x, y, el }
var sbSeq         = 0;
var sbDrag        = null; // { id, startX, startY, offsetX, offsetY, moved }
var sbSelected    = [];   // 圈選中的 coin id 陣列
var sbLasso       = null; // { startX, startY, sceneX, sceneY, el }
var sbGroupDrag   = null; // { startX, startY, offsets:[{id,dx,dy}], moved }
var sbTouchLasso  = null; // 觸控框選暫存：{ startX, startY }（移動超過閾值才啟動）

// ════════════════════════════════════════
//  工具
// ════════════════════════════════════════

function sbId()      { return ++sbSeq; }
function sbIsBill(d) { return SB_BILLS.indexOf(d) >= 0; }

function sbFindCoin(id) {
  for (var i = 0; i < sbCoins.length; i++) {
    if (sbCoins[i].id === id) return sbCoins[i];
  }
  return null;
}

function sbRemoveCoin(id) {
  for (var i = 0; i < sbCoins.length; i++) {
    if (sbCoins[i].id === id) {
      var el = sbCoins[i].el;
      if (el && el.parentNode) el.parentNode.removeChild(el);
      sbCoins.splice(i, 1);
      return;
    }
  }
}

function sbIsOver(cx, cy, el) {
  var r = el.getBoundingClientRect();
  return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
}

function sbDenomSrc(d) { return 'assets/' + d + '.png'; }

function sbDenomHtml(d, size) {
  var mini = size === 'mini';
  return '<img src="' + sbDenomSrc(d) + '" class="sb-denom-img' + (mini ? ' sb-denom-mini' : '') + '" draggable="false">';
}

// ════════════════════════════════════════
//  圈選狀態管理
// ════════════════════════════════════════

function sbClearSelection() {
  sbSelected.forEach(function(sid) {
    var c = sbFindCoin(sid);
    if (c && c.el) c.el.classList.remove('sb-selected');
  });
  sbSelected = [];
}

// ════════════════════════════════════════
//  自動預置
// ════════════════════════════════════════

function sbInitForQuestion(q) {
  sbClearSelection();
  sbCoins.forEach(function(c) {
    if (c.el && c.el.parentNode) c.el.parentNode.removeChild(c.el);
  });
  sbCoins = [];
  sbUpdateStats();

  if (!q || !q.visual) return;
  var v = q.visual;
  var scene = document.getElementById('sb-scene');
  if (!scene) return;
  var sr = scene.getBoundingClientRect();
  var W = sr.width, H = sr.height;
  if (W < 10 || H < 10) return;

  if (v.mode === 'exchange') {
    var isBill = sbIsBill(v.fromDenom);
    var w = isBill ? 120 : 64, h = isBill ? 60 : 64;
    sbAddToScene(v.fromDenom, (W - w) / 2, (H - h) / 2, true);

  } else if (v.mode === 'coins-to-bill') {
    var cols = 5, gap = 8, coinW = 64;
    var totalW = cols * coinW + (cols - 1) * gap;
    var startX = Math.max(8, (W - totalW) / 2);
    var startY = 16;
    for (var i = 0; i < v.coinCount; i++) {
      var col = i % cols;
      var row = Math.floor(i / cols);
      sbAddToScene(v.coinDenom, startX + col * (coinW + gap), startY + row * (coinW + gap), true);
    }
  }
}

// ════════════════════════════════════════
//  錢庫
// ════════════════════════════════════════

function sbRenderBank() {
  var el = document.getElementById('sb-bank-items');
  if (!el) return;
  el.innerHTML = SB_CHAIN.map(function(d) {
    return '<button class="sb-bank-btn" onclick="sbAddToScene(' + d + ')" title="' + d + ' 元">' +
           '<img src="' + sbDenomSrc(d) + '" class="sb-bank-img' + (sbIsBill(d) ? ' sb-bank-bill' : ' sb-bank-coin') + '" draggable="false">' +
           '<span class="sb-bank-label">' + d + ' 元</span>' +
           '</button>';
  }).join('');

  // 初始化場景圈選監聽（僅一次）
  var scene = document.getElementById('sb-scene');
  if (scene && !scene._sbLassoInit) {
    scene._sbLassoInit = true;
    scene.addEventListener('mousedown', function(e) {
      var t = e.target;
      while (t && t !== scene) {
        if (t.classList && t.classList.contains('sb-item')) return;
        t = t.parentElement;
      }
      e.preventDefault();
      sbStartLasso(e.clientX, e.clientY);
    });
    scene.addEventListener('touchstart', function(e) {
      var t = e.target;
      while (t && t !== scene) {
        if (t.classList && t.classList.contains('sb-item')) return;
        t = t.parentElement;
      }
      e.preventDefault();
      var touch = e.touches[0];
      sbTouchLasso = { startX: touch.clientX, startY: touch.clientY };
    }, { passive: false });
  }
}

// ════════════════════════════════════════
//  場景幣/鈔管理
// ════════════════════════════════════════

function sbAddToScene(denom, x, y, silent) {
  if (!silent && typeof sfxTap === 'function') sfxTap();
  var scene = document.getElementById('sb-scene');
  if (!scene) return;

  var rect   = scene.getBoundingClientRect();
  var isBill = sbIsBill(denom);
  var w = isBill ? 120 : 64;
  var h = isBill ? 60  : 64;

  if (x === undefined) x = 60 + Math.random() * Math.max(0, rect.width  - w - 80);
  if (y === undefined) y = 40 + Math.random() * Math.max(0, rect.height - h - 60);

  var id = sbId();
  var el = document.createElement('div');
  el.className = 'sb-item ' + (isBill ? 'sb-item-bill' : 'sb-item-coin');
  el.id = 'sbi-' + id;
  el.innerHTML = '<img src="' + sbDenomSrc(denom) + '" class="sb-scene-img" draggable="false">';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';

  el.addEventListener('mousedown', function(e) {
    e.preventDefault();
    if (sbSelected.indexOf(id) >= 0) {
      sbStartGroupDrag(e.clientX, e.clientY);
    } else {
      sbClearSelection();
      sbStartDrag(id, e.clientX, e.clientY);
    }
  });
  el.addEventListener('touchstart', function(e) {
    e.preventDefault();
    var t = e.touches[0];
    if (sbSelected.indexOf(id) >= 0) {
      sbStartGroupDrag(t.clientX, t.clientY);
    } else {
      sbClearSelection();
      sbStartDrag(id, t.clientX, t.clientY);
    }
  }, { passive: false });

  scene.appendChild(el);
  sbCoins.push({ id: id, denom: denom, x: x, y: y, el: el });

  var hint = document.getElementById('sb-scene-hint');
  if (hint) hint.style.display = 'none';

  sbUpdateStats();
}

// ════════════════════════════════════════
//  單幣拖拉
// ════════════════════════════════════════

function sbStartDrag(id, cx, cy) {
  sbClosePopup();
  var coin = sbFindCoin(id);
  if (!coin) return;
  var rect = coin.el.getBoundingClientRect();
  sbDrag = { id: id, startX: cx, startY: cy,
             offsetX: cx - rect.left, offsetY: cy - rect.top, moved: false };
}

document.addEventListener('mousemove', function(e) { sbMoveDrag(e.clientX, e.clientY); });
document.addEventListener('mouseup',   function(e) { sbEndDrag(e.clientX, e.clientY); });
document.addEventListener('touchmove', function(e) {
  var tx = e.touches[0].clientX, ty = e.touches[0].clientY;
  if (sbDrag || sbGroupDrag || sbLasso || sbTouchLasso) { e.preventDefault(); }
  if (sbGroupDrag)   { sbMoveGroupDrag(tx, ty); return; }
  if (sbDrag)        { sbMoveDrag(tx, ty); return; }
  if (sbLasso)       { sbUpdateLasso(tx, ty); return; }
  if (sbTouchLasso)  {
    var dx = tx - sbTouchLasso.startX, dy = ty - sbTouchLasso.startY;
    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      sbStartLasso(sbTouchLasso.startX, sbTouchLasso.startY);
      sbTouchLasso = null;
    }
  }
}, { passive: false });
document.addEventListener('touchend', function(e) {
  var cx = e.changedTouches[0].clientX, cy = e.changedTouches[0].clientY;
  sbTouchLasso = null;
  if (sbLasso)      { sbEndLasso(cx, cy); return; }
  if (sbGroupDrag)  { sbEndGroupDrag(cx, cy); return; }
  if (sbDrag)       { sbEndDrag(cx, cy); }
});

function sbMoveDrag(cx, cy) {
  if (sbGroupDrag) { sbMoveGroupDrag(cx, cy); return; }
  if (sbLasso)     { sbUpdateLasso(cx, cy);   return; }
  if (!sbDrag) return;

  var dx = cx - sbDrag.startX, dy = cy - sbDrag.startY;
  if (!sbDrag.moved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
    sbDrag.moved = true;
    var coin = sbFindCoin(sbDrag.id);
    if (coin) coin.el.classList.add('sb-dragging');
  }
  if (!sbDrag.moved) return;

  var scene = document.getElementById('sb-scene');
  if (!scene) return;
  var sr  = scene.getBoundingClientRect();
  var coin = sbFindCoin(sbDrag.id);
  if (!coin) return;
  coin.x = cx - sr.left - sbDrag.offsetX;
  coin.y = cy - sr.top  - sbDrag.offsetY;
  coin.el.style.left = coin.x + 'px';
  coin.el.style.top  = coin.y + 'px';
}

function sbEndDrag(cx, cy) {
  if (sbGroupDrag) { sbEndGroupDrag(cx, cy); return; }
  if (sbLasso)     { sbEndLasso(cx, cy);     return; }
  if (!sbDrag) return;

  var id    = sbDrag.id;
  var moved = sbDrag.moved;
  sbDrag    = null;

  var coin = sbFindCoin(id);
  if (coin) coin.el.classList.remove('sb-dragging');

  if (!moved) {
    sbShowSplitPopup(id);
    return;
  }

  // 落在錢庫 → 刪除
  var bank = document.getElementById('sb-bank');
  if (bank && sbIsOver(cx, cy, bank)) {
    sbRemoveCoin(id);
    sbUpdateStats();
  } else {
    sbUpdateStats();
  }
}

// ════════════════════════════════════════
//  圈選（Lasso）
// ════════════════════════════════════════

function sbStartLasso(cx, cy) {
  sbClearSelection();
  sbClosePopup();
  var scene = document.getElementById('sb-scene');
  if (!scene) return;
  var sr = scene.getBoundingClientRect();

  var lassoEl = document.createElement('div');
  lassoEl.className = 'sb-lasso';
  scene.appendChild(lassoEl);

  sbLasso = {
    startX: cx, startY: cy,
    sceneX: cx - sr.left, sceneY: cy - sr.top,
    el: lassoEl
  };
  sbUpdateLasso(cx, cy);
}

function sbUpdateLasso(cx, cy) {
  if (!sbLasso) return;
  var scene = document.getElementById('sb-scene');
  if (!scene) return;
  var sr = scene.getBoundingClientRect();
  var x  = cx - sr.left;
  var y  = cy - sr.top;
  sbLasso.el.style.left   = Math.min(sbLasso.sceneX, x) + 'px';
  sbLasso.el.style.top    = Math.min(sbLasso.sceneY, y) + 'px';
  sbLasso.el.style.width  = Math.abs(x - sbLasso.sceneX) + 'px';
  sbLasso.el.style.height = Math.abs(y - sbLasso.sceneY) + 'px';
}

function sbEndLasso(cx, cy) {
  if (!sbLasso) return;
  var scene = document.getElementById('sb-scene');
  var sr    = scene ? scene.getBoundingClientRect() : { left: 0, top: 0 };
  var x  = cx - sr.left;
  var y  = cy - sr.top;
  var lx1 = Math.min(sbLasso.sceneX, x), lx2 = Math.max(sbLasso.sceneX, x);
  var ly1 = Math.min(sbLasso.sceneY, y), ly2 = Math.max(sbLasso.sceneY, y);

  if (sbLasso.el && sbLasso.el.parentNode) sbLasso.el.parentNode.removeChild(sbLasso.el);
  sbLasso = null;

  if (lx2 - lx1 < 4 && ly2 - ly1 < 4) { sbClearSelection(); return; }

  var inRect = sbCoins.filter(function(c) {
    var bill = sbIsBill(c.denom);
    var cxC  = c.x + (bill ? 60 : 32);
    var cyC  = c.y + (bill ? 30 : 32);
    return cxC >= lx1 && cxC <= lx2 && cyC >= ly1 && cyC <= ly2;
  });

  if (inRect.length === 0) { sbClearSelection(); return; }

  var denom   = inRect[0].denom;
  var allSame = inRect.every(function(c) { return c.denom === denom; });
  if (!allSame) {
    if (typeof showToast === 'function') showToast('只能圈選相同面額的錢幣');
    return;
  }

  sbSelected = inRect.map(function(c) { return c.id; });
  sbSelected.forEach(function(sid) {
    var c = sbFindCoin(sid);
    if (c && c.el) c.el.classList.add('sb-selected');
  });
}

// ════════════════════════════════════════
//  整組拖動
// ════════════════════════════════════════

function sbStartGroupDrag(cx, cy) {
  sbClosePopup();
  var scene = document.getElementById('sb-scene');
  var sr    = scene ? scene.getBoundingClientRect() : { left: 0, top: 0 };
  var sx    = cx - sr.left, sy = cy - sr.top;

  sbGroupDrag = {
    startX: cx, startY: cy, moved: false,
    offsets: sbSelected.map(function(sid) {
      var c = sbFindCoin(sid);
      return c ? { id: sid, dx: c.x - sx, dy: c.y - sy } : null;
    }).filter(Boolean)
  };

  sbSelected.forEach(function(sid) {
    var c = sbFindCoin(sid);
    if (c && c.el) c.el.style.zIndex = '50';
  });
}

function sbMoveGroupDrag(cx, cy) {
  if (!sbGroupDrag) return;
  var dx = cx - sbGroupDrag.startX, dy = cy - sbGroupDrag.startY;

  if (!sbGroupDrag.moved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
    sbGroupDrag.moved = true;
    sbSelected.forEach(function(sid) {
      var c = sbFindCoin(sid);
      if (c && c.el) c.el.classList.add('sb-dragging');
    });
  }
  if (!sbGroupDrag.moved) return;

  var scene = document.getElementById('sb-scene');
  if (!scene) return;
  var sr = scene.getBoundingClientRect();
  var sx = cx - sr.left, sy = cy - sr.top;

  sbGroupDrag.offsets.forEach(function(off) {
    var c = sbFindCoin(off.id);
    if (!c) return;
    c.x = sx + off.dx; c.y = sy + off.dy;
    c.el.style.left = c.x + 'px';
    c.el.style.top  = c.y + 'px';
  });
}

function sbEndGroupDrag(cx, cy) {
  if (!sbGroupDrag) return;
  var moved = sbGroupDrag.moved;
  sbGroupDrag = null;

  sbSelected.forEach(function(sid) {
    var c = sbFindCoin(sid);
    if (c && c.el) { c.el.classList.remove('sb-dragging'); c.el.style.zIndex = ''; }
  });

  if (!moved) {
    // 點擊群組 → 合併彈窗
    sbShowMergePopup(cx, cy);
    return;
  }

  // 拖到錢庫 → 整組刪除
  var bank = document.getElementById('sb-bank');
  if (bank && sbIsOver(cx, cy, bank)) {
    var toRemove = sbSelected.slice();
    sbClearSelection();
    toRemove.forEach(function(sid) { sbRemoveCoin(sid); });
  }
  sbUpdateStats();
}

// ════════════════════════════════════════
//  彈窗共用定位
// ════════════════════════════════════════

function _sbPopupPosition(popup, coinEl) {
  var pageEl = document.getElementById('game-right');
  if (!pageEl) return;
  popup.classList.remove('hidden');
  var popupH     = popup.offsetHeight || 120;
  var pr         = pageEl.getBoundingClientRect();
  var cr         = coinEl.getBoundingClientRect();
  var left       = cr.left - pr.left + cr.width / 2;
  var spaceAbove = cr.top - pr.top;
  popup.style.left = left + 'px';
  if (spaceAbove < popupH + 16) {
    popup.style.top       = (cr.bottom - pr.top + 10) + 'px';
    popup.style.transform = 'translateX(-50%)';
  } else {
    popup.style.top       = (cr.top - pr.top) + 'px';
    popup.style.transform = 'translateX(-50%) translateY(-100%) translateY(-10px)';
  }
}

// ════════════════════════════════════════
//  單幣拆分彈窗
// ════════════════════════════════════════

/* ── 視覺化 popup 輔助函式 ── */
function _sbCoinsHtml(denom, count) {
  var show = Math.min(count, 10);
  var img  = sbDenomHtml(denom, 'mini');
  if (show <= 5) {
    return '<div class="sb-coins-row">' + Array(show + 1).join(img) + '</div>';
  }
  return '<div class="sb-coins-grid">' +
         '<div class="sb-coins-row">' + Array(6).join(img) + '</div>' +
         '<div class="sb-coins-row">' + Array(show - 4).join(img) + '</div>' +
         '</div>';
}

function _sbVisualRow(fromHtml, toHtml, onclick) {
  return '<button class="sb-popup-opt sb-popup-row" onclick="' + onclick + '">' +
         fromHtml +
         '<span class="sb-arrow">➡</span>' +
         toHtml +
         '</button>';
}

function sbShowSplitPopup(id) {
  var coin = sbFindCoin(id);
  if (!coin) return;
  var opts = SB_SPLIT[coin.denom];
  if (!opts || opts.length === 0) return;

  var popup = document.getElementById('sb-popup');
  if (!popup) return;

  var fromHtml = sbDenomHtml(coin.denom, 'mini');
  popup.innerHTML =
    '<div class="sb-popup-opts sb-popup-visual">' +
    opts.map(function(opt) {
      return _sbVisualRow(
        fromHtml,
        _sbCoinsHtml(opt.to, opt.n),
        'sbDoSplit(' + id + ',' + opt.to + ',' + opt.n + ')'
      );
    }).join('') +
    '</div>';

  _sbPopupPosition(popup, coin.el);
}

// ════════════════════════════════════════
//  群組合併彈窗
// ════════════════════════════════════════

function sbGetGroupSplitOpts(denom, count) {
  var allOpts = SB_SPLIT[denom];
  if (!allOpts || allOpts.length === 0) return [];
  var chainIdx = SB_CHAIN.indexOf(denom);
  if (chainIdx < 0 || chainIdx >= SB_CHAIN.length - 1) return [];
  var nextDenom = SB_CHAIN[chainIdx + 1];
  for (var i = 0; i < allOpts.length; i++) {
    if (allOpts[i].to === nextDenom) {
      return [{ to: nextDenom, n: allOpts[i].n * count }];
    }
  }
  return [];
}

function sbShowMergePopup(cx, cy) {
  if (sbSelected.length < 2) {
    if (sbSelected.length === 1) sbShowSplitPopup(sbSelected[0]);
    return;
  }

  var firstCoin = sbFindCoin(sbSelected[0]);
  if (!firstCoin) return;
  var denom = firstCoin.denom;
  var total = sbSelected.length * denom;

  var mergeDenom = -1;
  SB_CHAIN.forEach(function(d) {
    if (d === total && d > denom) mergeDenom = d;
  });

  var popup = document.getElementById('sb-popup');
  if (!popup) return;

  var sourceHtml = _sbCoinsHtml(denom, sbSelected.length);
  var html = '<div class="sb-popup-opts sb-popup-visual">';
  if (mergeDenom > 0) {
    html += _sbVisualRow(sourceHtml, sbDenomHtml(mergeDenom, 'mini'), 'sbDoGroupMerge(' + mergeDenom + ')');
  }

  var splitOpts = sbGetGroupSplitOpts(denom, sbSelected.length);
  if (splitOpts.length > 0) {
    if (mergeDenom > 0) html += '<div class="sb-popup-divider"></div>';
    splitOpts.forEach(function(opt) {
      html += _sbVisualRow(sourceHtml, _sbCoinsHtml(opt.to, opt.n), 'sbDoGroupSplit(' + opt.to + ',' + opt.n + ')');
    });
  }
  html += '</div>';

  popup.innerHTML = html;

  var scene = document.getElementById('sb-scene');
  var sr    = scene ? scene.getBoundingClientRect() : { left: 0, top: 0 };
  var sx = cx - sr.left, sy = cy - sr.top;
  var nearest = firstCoin;
  sbSelected.forEach(function(sid) {
    var c = sbFindCoin(sid);
    if (!c) return;
    var bill  = sbIsBill(c.denom);
    var bill2 = sbIsBill(nearest.denom);
    var d1 = Math.abs(c.x + (bill ? 60 : 32) - sx) + Math.abs(c.y + (bill ? 30 : 32) - sy);
    var d2 = Math.abs(nearest.x + (bill2 ? 60 : 32) - sx) + Math.abs(nearest.y + (bill2 ? 30 : 32) - sy);
    if (d1 < d2) nearest = c;
  });
  _sbPopupPosition(popup, nearest.el);
}

// ════════════════════════════════════════
//  拆分 / 合併 執行
// ════════════════════════════════════════

function sbDoSplit(id, toDenom, count) {
  var coin = sbFindCoin(id);
  if (!coin) return;
  var ox = coin.x + (sbIsBill(coin.denom) ? 60 : 32);
  var oy = coin.y + (sbIsBill(coin.denom) ? 30 : 32);
  sbRemoveCoin(id);
  sbClosePopup();
  if (typeof sfxTap === 'function') sfxTap();
  _sbPlaceGrid(toDenom, count, ox, oy);
}

function sbDoGroupSplit(toDenom, totalCount) {
  sbClosePopup();
  if (typeof sfxTap === 'function') sfxTap();

  var sumX = 0, sumY = 0, n = 0;
  sbSelected.forEach(function(sid) {
    var c = sbFindCoin(sid);
    if (!c) return;
    var bill = sbIsBill(c.denom);
    sumX += c.x + (bill ? 60 : 32);
    sumY += c.y + (bill ? 30 : 32);
    n++;
  });
  var cx = n > 0 ? sumX / n : 200;
  var cy = n > 0 ? sumY / n : 150;

  var toRemove = sbSelected.slice();
  sbClearSelection();
  toRemove.forEach(function(sid) { sbRemoveCoin(sid); });
  _sbPlaceGrid(toDenom, totalCount, cx, cy);
}

function sbDoGroupMerge(mergeDenom) {
  sbClosePopup();
  if (typeof sfxTap === 'function') sfxTap();

  // 計算所選群組的重心
  var sumX = 0, sumY = 0, n = 0;
  sbSelected.forEach(function(sid) {
    var c = sbFindCoin(sid);
    if (!c) return;
    var bill = sbIsBill(c.denom);
    sumX += c.x + (bill ? 60 : 32);
    sumY += c.y + (bill ? 30 : 32);
    n++;
  });
  var cx = n > 0 ? sumX / n : 200;
  var cy = n > 0 ? sumY / n : 150;

  var toRemove = sbSelected.slice();
  sbClearSelection();
  toRemove.forEach(function(sid) { sbRemoveCoin(sid); });

  // 合併結果幣放在群組重心
  var bill = sbIsBill(mergeDenom);
  var ox = cx - (bill ? 60 : 32);
  var oy = cy - (bill ? 30 : 32);
  sbAddToScene(mergeDenom, ox, oy);
}

// 格子排列（拆分用）
function _sbPlaceGrid(toDenom, count, ox, oy) {
  var scene = document.getElementById('sb-scene');
  var sr    = scene ? scene.getBoundingClientRect() : { width: 700, height: 450 };
  var bill  = sbIsBill(toDenom);
  var itemW = bill ? 120 : 64;
  var itemH = bill ? 60  : 64;
  var gap   = 8;
  var COLS  = Math.max(1, Math.min(5, Math.floor((sr.width - 16) / (itemW + gap))));
  var cols  = Math.min(count, COLS);
  var rows  = Math.ceil(count / COLS);
  var totalW = cols * itemW + (cols - 1) * gap;
  var totalH = rows * itemH + (rows - 1) * gap;
  var startX = Math.min(Math.max(8, ox - totalW / 2), Math.max(8, sr.width  - totalW - 8));
  var startY = Math.min(Math.max(8, oy - totalH / 2), Math.max(8, sr.height - totalH - 8));
  for (var i = 0; i < count; i++) {
    sbAddToScene(toDenom,
      startX + (i % COLS) * (itemW + gap),
      startY + Math.floor(i / COLS) * (itemH + gap));
  }
}

function sbClosePopup() {
  var popup = document.getElementById('sb-popup');
  if (popup) popup.classList.add('hidden');
}

function _sbClosePopupIfOutside(target) {
  var popup = document.getElementById('sb-popup');
  if (popup && !popup.classList.contains('hidden') && !popup.contains(target)) {
    sbClosePopup();
  }
}
document.addEventListener('mousedown', function(e) { _sbClosePopupIfOutside(e.target); });
document.addEventListener('touchstart', function(e) { _sbClosePopupIfOutside(e.target); }, { passive: true });

// ════════════════════════════════════════
//  場景清空
// ════════════════════════════════════════

function clearScene() {
  sbClearSelection();
  sbCoins.forEach(function(c) {
    if (c.el && c.el.parentNode) c.el.parentNode.removeChild(c.el);
  });
  sbCoins = [];
  sbUpdateStats();
  var hint = document.getElementById('sb-scene-hint');
  if (hint) hint.style.display = '';
}

// ════════════════════════════════════════
//  統計列
// ════════════════════════════════════════

function sbUpdateStats() {
  var total = sbCoins.reduce(function(s, c) { return s + c.denom; }, 0);
  var totalEl = document.getElementById('sb-scene-total');
  if (totalEl) totalEl.textContent = '場景：' + total + ' 元';

  var groups = {};
  sbCoins.forEach(function(c) { groups[c.denom] = (groups[c.denom] || 0) + 1; });
  var denoms = Object.keys(groups).map(Number).sort(function(a, b) { return b - a; });
  var bdEl = document.getElementById('sb-breakdown');
  if (bdEl) {
    bdEl.innerHTML = denoms.map(function(d) {
      return '<span class="sb-bd-chip">' + d + ' 元 ×' + groups[d] + '</span>';
    }).join('');
  }
}
