'use strict';

var _chainMode  = false;
var _chainTimer = null;

function openModule(module) {
  currentModule = module;
  renderLevelSelect();
  showPage('select');
}

function renderLevelSelect() {
  var levels = currentModule === 'dot2dot' ? DOT2DOT_LEVELS : TRACING_LEVELS;
  var stars  = getStars(currentModule);
  var title  = currentModule === 'dot2dot' ? '🔢 連連看' : '✏️ 線條練習';
  document.getElementById('select-title').textContent = title;
  var grid = document.getElementById('level-grid');
  grid.innerHTML = levels.map(function(lv, idx) {
    var got = stars.indexOf(lv.id) !== -1;
    return '<button class="level-btn' + (got ? ' completed' : '') + '" onclick="openLevel(' + idx + ')">' +
      '<div class="level-btn-icon">' + lv.icon + '</div>' +
      '<div class="level-btn-label">' + lv.title + '</div>' +
      (got ? '<div class="level-btn-star">⭐</div>' : '') +
      '</button>';
  }).join('');
}

function openLevel(idx) {
  var badge = document.getElementById('chain-badge');
  if (badge) badge.classList.toggle('hidden', !_chainMode);
  if (currentModule === 'dot2dot') openDot2Dot(idx);
  else openTracing(idx);
}

/* 連續闖關：從第一個還沒拿星星的關卡開始，一路玩到底都不用回選關卡頁 */
function startChain() {
  _chainMode = true;
  var levels = currentModule === 'dot2dot' ? DOT2DOT_LEVELS : TRACING_LEVELS;
  var stars  = getStars(currentModule);
  var startIdx = levels.findIndex(function(lv) { return stars.indexOf(lv.id) === -1; });
  if (startIdx === -1) startIdx = 0; // 全部過關了 → 從頭再玩一輪
  openLevel(startIdx);
}

function advanceChain() {
  if (_chainTimer) { clearTimeout(_chainTimer); _chainTimer = null; }
  openLevel(currentLevelIdx + 1);
}

function exitChain() {
  if (_chainTimer) { clearTimeout(_chainTimer); _chainTimer = null; }
  _chainMode = false;
  var badge = document.getElementById('chain-badge');
  if (badge) badge.classList.add('hidden');
}

function endPractice() {
  exitChain();
  goBack();
}

function showResult(success, title, module) {
  if (_chainTimer) { clearTimeout(_chainTimer); _chainTimer = null; }
  var levels = module === 'dot2dot' ? DOT2DOT_LEVELS : TRACING_LEVELS;
  var isLast = currentLevelIdx >= levels.length - 1;
  var icon  = document.getElementById('result-icon');
  var ttl   = document.getElementById('result-title');
  var sub   = document.getElementById('result-sub');
  var btns  = document.getElementById('result-btns');

  if (_chainMode && success && isLast) {
    icon.textContent = '🏆';
    ttl.textContent  = '全部過關了！';
    sub.textContent  = '「' + (module === 'dot2dot' ? '連連看' : '線條練習') + '」整組都完成了，你好棒！';
    btns.innerHTML =
      '<button class="btn-result" onclick="startChain()">🔁 再闖一次</button>' +
      '<button class="btn-result btn-result-home" onclick="exitChain();backToHome();">回首頁</button>';
  } else if (_chainMode && success) {
    icon.textContent = '🎉';
    ttl.textContent  = '太棒了！';
    sub.textContent  = '完成了「' + title + '」，準備進入下一關⋯';
    btns.innerHTML =
      '<button class="btn-result btn-result-home" onclick="advanceChain()">➡️ 下一關</button>' +
      '<button class="btn-result" onclick="exitChain();backToLevelSelect();">結束連續闖關</button>';
    _chainTimer = setTimeout(advanceChain, 1400);
  } else if (_chainMode && !success) {
    icon.textContent = '💪';
    ttl.textContent  = '再試一次看看！';
    sub.textContent  = '「' + title + '」還差一點，要不要再試一次？';
    btns.innerHTML =
      '<button class="btn-result btn-result-home" onclick="replayLevel()">再試一次</button>' +
      '<button class="btn-result" onclick="exitChain();backToLevelSelect();">結束連續闖關</button>';
  } else {
    icon.textContent = success ? '🎉' : '💪';
    ttl.textContent  = success ? '太棒了！' : '再試一次看看！';
    sub.textContent  = success ? '完成了「' + title + '」' : '「' + title + '」還差一點，要不要再試一次？';
    btns.innerHTML =
      '<button class="btn-result" onclick="replayLevel()">再玩一次</button>' +
      '<button class="btn-result" onclick="backToLevelSelect()">換關卡</button>' +
      '<button class="btn-result btn-result-home" onclick="backToHome()">回首頁</button>';
  }
  showPage('result');
}

function replayLevel() {
  openLevel(currentLevelIdx);
}

function backToLevelSelect() {
  renderLevelSelect();
  showPage('select', false);
  PAGE_STACK = ['home', 'select'];
}

function backToHome() {
  exitChain();
  showPage('home', false);
  PAGE_STACK = ['home'];
}
