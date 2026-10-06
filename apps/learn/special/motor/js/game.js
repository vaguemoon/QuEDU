'use strict';

var _chainMode  = false;
var _chainTimer = null;

/* 模組登記表——加新遊戲只要在這裡加一筆，其餘選關卡/連續闖關/結算頁邏輯都不用動。
 * openFn 用字串存，呼叫時才用 window[...] 查，這樣不管 script 載入順序是誰先誰後都沒關係。 */
var MODULE_REGISTRY = {
  dot2dot: { levelsVar: 'DOT2DOT_LEVELS', title: '🔢 連連看',   name: '連連看',   openFn: 'openDot2Dot' },
  tracing: { levelsVar: 'TRACING_LEVELS', title: '✏️ 線條練習', name: '線條練習', openFn: 'openTracing' },
  match:   { levelsVar: 'MATCH_LEVELS',   title: '🔍 找一樣',   name: '找一樣',   openFn: 'openMatch' },
  grid:    { levelsVar: 'GRID_LEVELS',    title: '🔢 方格抄寫', name: '方格抄寫', openFn: 'openGrid' }
};
function _moduleLevels(m) { return window[MODULE_REGISTRY[m].levelsVar]; }

function openModule(module) {
  currentModule = module;
  renderLevelSelect();
  showPage('select');
}

function renderLevelSelect() {
  var levels = _moduleLevels(currentModule);
  var stars  = getStars(currentModule);
  document.getElementById('select-title').textContent = MODULE_REGISTRY[currentModule].title;
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
  window[MODULE_REGISTRY[currentModule].openFn](idx);
}

/* 連續闖關：從第一個還沒拿星星的關卡開始，一路玩到底都不用回選關卡頁 */
function startChain() {
  _chainMode = true;
  var levels = _moduleLevels(currentModule);
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

/* 無限挑戰關卡（endless:true）永遠不會呼叫 showResult——答完一輪就馬上接下一輪，
 * 不會跳頁。所以連續闖關「是不是最後一關」要看「後面還有沒有不是無限挑戰的關卡」，
 * 不然連續闖關會在前一關答完後自動想跳進無限關卡，但無限關卡永遠不會喊「過關」，
 * 連續闖關就會卡死在那裡，再也不會往下走。 */
function _isLastChainLevel(levels, idx) {
  for (var i = idx + 1; i < levels.length; i++) {
    if (!levels[i].endless) return false;
  }
  return true;
}

/* 沒過關已經不會走到這裡了——連連看/找一樣本來就沒有「沒過」這回事，
 * 線條練習/方格抄寫沒做對會直接發錯誤音效、原地重來，不會跳頁。
 * 所以這裡永遠是慶祝畫面，不用再分 success/fail。 */
function showResult(title, module) {
  if (_chainTimer) { clearTimeout(_chainTimer); _chainTimer = null; }
  var levels = _moduleLevels(module);
  var isLast = _isLastChainLevel(levels, currentLevelIdx);
  var icon  = document.getElementById('result-icon');
  var ttl   = document.getElementById('result-title');
  var sub   = document.getElementById('result-sub');
  var btns  = document.getElementById('result-btns');

  if (_chainMode && isLast) {
    sfxGrandCelebrate();
    icon.textContent = '🏆';
    ttl.textContent  = '全部過關了！';
    sub.textContent  = '「' + MODULE_REGISTRY[module].name + '」整組都完成了，你好棒！';
    btns.innerHTML =
      '<button class="btn-result" onclick="startChain()">🔁 再闖一次</button>' +
      '<button class="btn-result btn-result-home" onclick="exitChain();backToHome();">回首頁</button>';
  } else if (_chainMode) {
    sfxCelebrate();
    icon.textContent = '🎉';
    ttl.textContent  = '太棒了！';
    sub.textContent  = '完成了「' + title + '」，準備進入下一關⋯';
    btns.innerHTML =
      '<button class="btn-result btn-result-home" onclick="advanceChain()">➡️ 下一關</button>' +
      '<button class="btn-result" onclick="exitChain();backToLevelSelect();">結束連續闖關</button>';
    _chainTimer = setTimeout(advanceChain, 1400);
  } else {
    sfxCelebrate();
    icon.textContent = '🎉';
    ttl.textContent  = '太棒了！';
    sub.textContent  = '完成了「' + title + '」';
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
