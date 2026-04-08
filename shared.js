/**
 * shared.js — 太平國小資源班學習系統
 * 所有頁面共用：Firebase 初始化、主題切換、音效、Toast
 *
 * 使用方式：在每個 HTML 的 </body> 前加入
 *   <script src="shared.js"></script>
 *   然後在頁面自己的 <script> 裡直接呼叫 initFirebase()、applyTheme() 等。
 *
 * 這個檔案不能依賴任何頁面特定的 DOM 元素。
 */

/* ════════════════════════════════════════
   Firebase 共用設定
   ════════════════════════════════════════ */
var firebaseConfig = {
  apiKey:            "AIzaSyBLhonzZkR1ORDPKgxmaVLFUwvPiEMpdj0",
  authDomain:        "tainping-hanzi-app.firebaseapp.com",
  projectId:         "tainping-hanzi-app",
  storageBucket:     "tainping-hanzi-app.firebasestorage.app",
  messagingSenderId: "158917910126",
  appId:             "1:158917910126:web:e52a1d0456d1fd4fe6907f"
};

var db   = null;
var auth = null;

function initFirebase() {
  if (typeof firebase === 'undefined' || typeof firebase.firestore === 'undefined') {
    setTimeout(initFirebase, 150);
    return;
  }
  try {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    // Firebase Auth（若頁面有載入 Auth SDK 才初始化）
    if (typeof firebase.auth !== 'undefined') {
      auth = firebase.auth();
      // 使用 SESSION 持久化：關閉分頁即登出，適合學校共用裝置
      auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(function(){});
    }
  } catch (e) {
    db = null;
    setTimeout(initFirebase, 300);
  }
}

/* ════════════════════════════════════════
   主題切換
   ════════════════════════════════════════ */
var THEMES = [
  { id:'blue',   name:'藍天',   bg:'#eef5fc', blue:'#4a90d9', blueDk:'#2d6fa8', blueLt:'#e8f4fd' },
  { id:'green',  name:'森林',   bg:'#edfbf4', blue:'#27ae60', blueDk:'#1e8449', blueLt:'#d5f5e3' },
  { id:'purple', name:'薰衣草', bg:'#f3f0fc', blue:'#8e44ad', blueDk:'#6c3483', blueLt:'#e8daef' },
  { id:'orange', name:'夕陽',   bg:'#fff8f0', blue:'#e67e22', blueDk:'#ca6f1e', blueLt:'#fdebd0' },
  { id:'teal',   name:'青空',   bg:'#f0fafa', blue:'#16a085', blueDk:'#0e6655', blueLt:'#d1f2eb' },
  { id:'pink',   name:'粉紅',   bg:'#fff0f8', blue:'#d63384', blueDk:'#a0255e', blueLt:'#fce4ec' },
];

/**
 * 同步套用主題 CSS 變數（需在 <head> 最早執行，防止主題閃爍）
 * 新頁面在 <head> 最後一行加入：
 *   <script>if(window.__applyThemeSync)window.__applyThemeSync();</script>
 * 但因為 shared.js 是在 </body> 前載入，這裡改用內聯方式暴露給 head 用。
 * 實際防閃爍邏輯維護在各頁面 head 的 inline script，
 * 主題資料以 THEMES 陣列為唯一來源，inline script 只引用鍵值。
 *
 * ─── 新增頁面時，head 的同步主題 script 只需複製下面這 5 行 ───
 * (function(){var M={blue:'#eef5fc,#4a90d9,#2d6fa8,#e8f4fd',green:'#edfbf4,#27ae60,#1e8449,#d5f5e3',
 *   purple:'#f3f0fc,#8e44ad,#6c3483,#e8daef',orange:'#fff8f0,#e67e22,#ca6f1e,#fdebd0',
 *   teal:'#f0fafa,#16a085,#0e6655,#d1f2eb',pink:'#fff0f8,#d63384,#a0255e,#fce4ec'};
 *   try{var v=(M[localStorage.getItem('theme')]||M.blue).split(','),r=document.documentElement.style;
 *   ['--bg','--blue','--blue-dk','--blue-lt'].forEach(function(k,i){r.setProperty(k,v[i]);});}catch(e){}})();
 */

var currentTheme = localStorage.getItem('theme') || 'blue';

/**
 * 套用主題：更新 CSS 變數，存入 localStorage（所有頁面共用）
 * @param {string} themeId - THEMES 中的 id 值
 */
function applyTheme(themeId) {
  var t = THEMES.find(function(th) { return th.id === themeId; }) || THEMES[0];
  var r = document.documentElement.style;
  r.setProperty('--bg',      t.bg);
  r.setProperty('--blue',    t.blue);
  r.setProperty('--blue-dk', t.blueDk);
  r.setProperty('--blue-lt', t.blueLt);
  currentTheme = themeId;
  localStorage.setItem('theme', themeId);
  // 若頁面上有主題格子，重新渲染
  if (typeof renderThemeGrid === 'function') renderThemeGrid();
}

/**
 * 渲染主題選擇格子（index.html 的個人設定頁用）
 * 子頁面沒有 #theme-grid 就不執行
 */
function renderThemeGrid() {
  var grid = document.getElementById('theme-grid');
  if (!grid) return;
  grid.innerHTML = '';
  THEMES.forEach(function(t) {
    var btn = document.createElement('button');
    btn.style.cssText =
      'display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 4px;border-radius:12px;border:2.5px solid ' +
      (t.id === currentTheme ? 'var(--blue)' : 'var(--border)') +
      ';background:' + (t.id === currentTheme ? 'var(--blue-lt)' : 'white') +
      ';cursor:pointer;font-family:inherit;transition:all .15s;';
    btn.innerHTML =
      '<span style="font-size:1.4rem;display:inline-block;width:28px;height:28px;border-radius:50%;background:' + t.blue + '"></span>' +
      '<span style="font-size:.7rem;font-weight:800;color:var(--text)">' + t.name + '</span>';
    btn.addEventListener('click', function() { applyTheme(t.id); });
    grid.appendChild(btn);
  });
}

/* ════════════════════════════════════════
   音效開關
   ════════════════════════════════════════ */
var soundEnabled = localStorage.getItem('soundEnabled') !== 'false';

/**
 * 根據 soundEnabled 狀態更新音效切換按鈕 UI
 * 若頁面上沒有 #sound-toggle-btn 就靜默跳過
 */
function applySound() {
  var btn  = document.getElementById('sound-toggle-btn');
  var knob = document.getElementById('sound-toggle-knob');
  if (!btn || !knob) return;
  btn.style.background = soundEnabled ? 'var(--green)' : '#cbd5e1';
  knob.style.left      = soundEnabled ? '29px' : '3px';
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem('soundEnabled', soundEnabled);
  applySound();
}

/* ════════════════════════════════════════
   Toast 通知
   ════════════════════════════════════════
   頁面 HTML 需要有：
     <div id="toast" class="toast"></div>
   ════════════════════════════════════════ */
function showToast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.innerHTML = msg;
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, 2800);
}

/* ════════════════════════════════════════
   Topbar 統一渲染
   ════════════════════════════════════════
   用法（在頁面 JS 裡呼叫）：

   renderTopbar('topbar-home', {
     back:     { label: '← 回首頁', onclick: 'goBackToHub()' },
     title:    '✏️ <span>國字練習</span>',
     greeting: true,   // 顯示時間問候 + 學生暱稱頭像（預設 true）
     extra:    '<div class="star-count">⭐ <span id="nav-star-num">0</span></div>'
               // 設定按鈕左側可插入額外元素（選填）
   });

   HTML 裡只需要放空的容器：
   <div id="topbar-home"></div>
   ════════════════════════════════════════ */


/**
 * 渲染 topbar 到指定容器
 * @param {string|Element} target  容器 id 字串 或 DOM 元素
 * @param {object}         opts    設定選項
 *   opts.back    {label, onclick}  左側返回按鈕（必填）
 *   opts.title   {string}          頁面標題 HTML（必填）
 *   opts.titleId {string}          如需動態更新標題，傳入 id
 *   opts.extra   {string}          設定按鈕左側插入的額外 HTML
 *   opts.settingsOnclick {string}  設定按鈕的 onclick（預設 'goToProfile()'）
 */
function renderTopbar(target, opts) {
  var el = typeof target === 'string' ? document.getElementById(target) : target;
  if (!el) return;
  opts = opts || {};
  var settingsOnclick = opts.settingsOnclick || 'goToProfile()';
  var titleId = opts.titleId ? ' id="' + opts.titleId + '"' : '';

  el.className = 'topbar';
  el.innerHTML =
    '<div class="topbar-left">' +
      '<button class="btn-back" onclick="' + opts.back.onclick + '">' + opts.back.label + '</button>' +
      '<div class="topbar-title"' + titleId + '>' + opts.title + '</div>' +
    '</div>' +
    (opts.extra ? opts.extra : '') +
    '<button class="btn-settings" onclick="' + settingsOnclick + '">⚙️ 設定</button>';
}


/* ════════════════════════════════════════
   個人設定跳轉（所有子頁面統一用這個）
   用法：goToProfile()
   設定完後會自動返回原頁面
   ════════════════════════════════════════ */
function goToProfile() {
  sessionStorage.setItem('return_to', window.location.pathname.split('/').pop());
  window.location.href = 'index.html?screen=profile';
}

/* ════════════════════════════════════════
   子頁面標準啟動流程
   ════════════════════════════════════════
   每個子頁面在 INIT 呼叫一次，自動處理：
   1. Firebase 初始化 + 主題套用
   2. 驗證 sessionStorage 登入狀態
   3. 等 db 就緒後執行 callback

   用法：
   initSubPage(function(student) {
     // student: { id, name, nickname, avatar, pin }
     playerName = student.nickname || student.name;
     renderTopbar('topbar-main', { ... });
     renderStages();
   });
   ════════════════════════════════════════ */
function initSubPage(callback) {
  initFirebase();
  applyTheme(currentTheme);
  var saved;
  try { saved = sessionStorage.getItem('hub_student'); } catch(e) {}
  if (!saved) { window.location.href = 'index.html'; return; }
  var student;
  try { student = JSON.parse(saved); } catch(e) { window.location.href = 'index.html'; return; }
  (function waitDb() {
    if (!db) { setTimeout(waitDb, 150); return; }
    try { callback(student); } catch(e) { console.error('initSubPage error:', e); }
  })();
}

/* ════════════════════════════════════════
   頁面切換（單頁應用模式）
   ════════════════════════════════════════
   用於 index.html、chinese.html 等有多個 .screen 的頁面
   ════════════════════════════════════════ */
var currentScreen = '';

/**
 * 切換到指定的 screen
 * @param {string} toId - 目標 screen 的 id（例如 'screen-hub'）
 */
function goTo(toId) {
  var screens = document.querySelectorAll('.screen');
  screens.forEach(function(s) {
    if (s.id === toId) {
      s.classList.remove('left', 'right');
      s.classList.add('active');
    } else {
      s.classList.remove('active');
      // 用先前的 currentScreen 決定方向
      s.classList.add(currentScreen ? 'left' : 'right');
    }
  });
  currentScreen = toId;
}

/* ════════════════════════════════════════
   Web Audio 音效引擎
   所有子項目統一使用，不需要各自定義
   ════════════════════════════════════════ */
var _AC = null;
function _getAC() {
  if (!_AC) _AC = new (window.AudioContext || window.webkitAudioContext)();
  return _AC;
}

// iOS 需要在 touch / click 事件中解鎖 AudioContext
(function() {
  function unlock() { _getAC(); }
  document.addEventListener('touchstart', unlock, { once: true });
  document.addEventListener('click',      unlock, { once: true });
})();

/**
 * 播放單音
 * @param {number} freq     頻率 Hz
 * @param {string} type     波形 sine / triangle / square
 * @param {number} duration 持續秒數
 * @param {number} vol      音量 0~1
 * @param {number} delay    延遲秒數
 */
function playTone(freq, type, duration, vol, delay) {
  if (!soundEnabled) return;
  try {
    var ac   = _getAC();
    var osc  = ac.createOscillator();
    var gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ac.currentTime + (delay||0));
    gain.gain.setValueAtTime(vol||0.18, ac.currentTime + (delay||0));
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + (delay||0) + duration);
    osc.start(ac.currentTime + (delay||0));
    osc.stop(ac.currentTime  + (delay||0) + duration);
  } catch(e) {}
}

// ── 標準音效集 ──
function sfxTap()           { playTone(660, 'triangle', 0.08, 0.12); }
function sfxSwipe()         { playTone(220, 'sine',     0.12, 0.10); }
function sfxCorrect()       { playTone(523,'sine',0.12,0.14,0); playTone(659,'sine',0.12,0.14,0.12); }
function sfxWrong()         { playTone(180, 'square',   0.10, 0.10); }
function sfxPass()          { [523,659,784].forEach(function(f,i){ playTone(f,'sine',0.3,0.15,i*0.05); }); }
function sfxCelebrate()     { [523,659,784,880,1047].forEach(function(f,i){ playTone(f,'sine',0.18,0.18,i*0.1); }); }
function sfxGrandCelebrate() {
  [523,659,784,1047,1319].forEach(function(f,i){ playTone(f,'sine',0.2,0.22,i*0.07); });
  [523,659,784].forEach(function(f,i){ playTone(f,'triangle',0.3,0.25,0.5+i*0.02); });
  playTone(1047,'sine',0.4,0.28,0.9); playTone(1319,'sine',0.4,0.25,1.0); playTone(1568,'sine',0.5,0.22,1.1);
  [80,100,120].forEach(function(f,i){ playTone(f,'square',0.08,0.15,0.5+i*0.1); });
}

/**
 * 讓元素閃爍綠色（正確）或紅色（錯誤）
 * HTML 元素需要能套用 flash-green / flash-red（shared.css 已定義）
 * @param {string} id    目標元素的 DOM id
 * @param {string} color 'green' | 'red'
 */
function flashBox(id, color) {
  var el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('flash-green', 'flash-red');
  void el.offsetWidth; // 重新觸發動畫
  el.classList.add(color === 'red' ? 'flash-red' : 'flash-green');
}

/**
 * 初始化音效包裝（讓 soundEnabled 設定影響所有 sfx 函式）
 * 在 window.load 裡呼叫一次即可，不需要額外設定
 */
function initSoundWrapper() {
  // playTone 已內建 soundEnabled 判斷，這個函式保留作為初始化掛勾
  // 未來如需加入音量控制或其他初始化邏輯，在這裡加入
  applySound();
}

/**
 * 動態注入 <style> 到 <head>（避免重複注入）
 * @param {string}   id    style 標籤的 id（用來去重）
 * @param {string[]} rules CSS 規則陣列（join 成字串後注入）
 */
function injectStyle(id, rules) {
  if (document.getElementById(id)) return;
  var s = document.createElement('style');
  s.id = id;
  s.textContent = rules.join('');
  document.head.appendChild(s);
}
