'use strict';

var _colorLevel     = null;
var _colorRoles      = null;  // 這一輪的角色對照表（見 color-data.js 的 generateColorRoles）
var _colorFilled     = null;  // 每個區域是否已經上色對 [bool, ...]，索引對應 level.regions
var _colorSelected   = -1;    // 目前選取的角色索引（對應 _colorRoles），-1 代表還沒選顏色
var _colorDoneCount  = 0;

function openColor(levelIdx) {
  currentModule   = 'color';
  currentLevelIdx = levelIdx;
  _colorLevel    = COLOR_LEVELS[levelIdx];
  _colorRoles    = generateColorRoles(_colorLevel);
  _colorFilled   = _colorLevel.regions.map(function() { return false; });
  _colorSelected = -1;
  _colorDoneCount = 0;

  document.getElementById('game-title').textContent = _colorLevel.title;
  document.getElementById('game-hint').textContent = '先點下面的顏色，再點畫面上標著同一個注音的地方！';
  showSandbox('color-sandbox');
  _renderColorPalette();
  _renderColorPicture();
  _colorUpdateStats();
  showPage('game');
}

function _colorUpdateStats() {
  var el = document.getElementById('game-progress');
  if (el) el.textContent = _colorDoneCount + ' / ' + _colorLevel.regions.length;
}

function _renderColorPalette() {
  var wrap = document.getElementById('color-palette');
  wrap.innerHTML = '';
  _colorRoles.forEach(function(role, idx) {
    var btn = document.createElement('button');
    btn.className = 'color-swatch-btn';
    btn.style.background = role.color.hex;
    btn.setAttribute('data-idx', idx);
    btn.innerHTML = '<span class="color-swatch-label">' + role.symbol + '</span>';
    btn.addEventListener('click', function() { _onColorSwatchPick(idx, btn); });
    wrap.appendChild(btn);
  });
}

function _onColorSwatchPick(idx, btnEl) {
  _colorSelected = idx;
  document.querySelectorAll('.color-swatch-btn').forEach(function(el) { el.classList.remove('selected'); });
  btnEl.classList.add('selected');
  speakDotLabel(_colorRoles[idx].symbol, true);
}

function _renderColorPicture() {
  var svg = document.getElementById('color-svg');
  svg.innerHTML = '';
  svg.setAttribute('viewBox', '0 0 200 200');

  _colorLevel.regions.forEach(function(region, idx) {
    var el = document.createElementNS(SVGNS, region.shape);
    Object.keys(region.attrs).forEach(function(k) { el.setAttribute(k, region.attrs[k]); });
    el.setAttribute('class', 'color-region' + (_colorFilled[idx] ? ' color-region-done' : ''));
    el.setAttribute('data-idx', idx);
    el.style.fill = _colorFilled[idx] ? _colorRoles[region.role].color.hex : '#ffffff';
    el.addEventListener('click', function() { _onColorRegionTap(idx, el); });
    svg.appendChild(el);

    if (!_colorFilled[idx]) {
      var bbox = _colorRegionCenter(region);
      var t = document.createElementNS(SVGNS, 'text');
      t.setAttribute('x', bbox.x); t.setAttribute('y', bbox.y);
      t.setAttribute('class', 'color-region-label');
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('dominant-baseline', 'central');
      t.textContent = _colorRoles[region.role].symbol;
      t.style.pointerEvents = 'none';
      svg.appendChild(t);
    }
  });
}

/* 算每種圖形的中心點，放文字標籤用——不用真的算幾何中心，簡化圖形取近似值就夠清楚了 */
function _colorRegionCenter(region) {
  if (region.shape === 'circle') return { x: +region.attrs.cx, y: +region.attrs.cy };
  if (region.shape === 'rect') {
    return { x: +region.attrs.x + region.attrs.width / 2, y: +region.attrs.y + region.attrs.height / 2 };
  }
  // polygon：取所有頂點座標平均值（形狀越規則，這個近似值越準）
  var pts = region.attrs.points.trim().split(/\s+/).map(function(p) {
    var xy = p.split(',');
    return { x: +xy[0], y: +xy[1] };
  });
  var sx = 0, sy = 0;
  pts.forEach(function(p) { sx += p.x; sy += p.y; });
  return { x: sx / pts.length, y: sy / pts.length };
}

function _onColorRegionTap(idx, el) {
  if (_colorFilled[idx]) return;
  if (_colorSelected === -1) {
    showToast('先點一個顏色喔！');
    return;
  }
  var region = _colorLevel.regions[idx];
  if (region.role === _colorSelected) {
    _colorFilled[idx] = true;
    _colorDoneCount++;
    el.style.fill = _colorRoles[region.role].color.hex;
    el.classList.add('color-region-done');
    sfxCorrect();
    flashBox('color-sandbox', 'green');
    _colorUpdateStats();
    _renderColorPicture();
    if (_colorDoneCount >= _colorLevel.regions.length) {
      setTimeout(function() {
        addStar('color', _colorLevel.id);
        showResult(_colorLevel.title, 'color');
      }, 500);
    }
  } else {
    sfxWrong();
    flashBox('color-sandbox', 'red');
    if (navigator.vibrate) { try { navigator.vibrate(80); } catch (e) {} }
    el.classList.add('color-region-wrong');
    setTimeout(function() { el.classList.remove('color-region-wrong'); }, 400);
  }
}
