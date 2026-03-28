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

var db = null;

function initFirebase() {
  if (typeof firebase === 'undefined' || typeof firebase.firestore === 'undefined') {
    setTimeout(initFirebase, 150);
    return;
  }
  try {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
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

var _topbarTimer = null;

/**
 * 產生時間問候字串（HTML）
 * 需要 window.__topbarStudent 已被設定
 */
function getTopbarGreetingHTML() {
  if (!window.__topbarStudent) return '';
  var now  = new Date();
  var h    = now.getHours();
  var hStr = String(h).padStart(2,'0');
  var mStr = String(now.getMinutes()).padStart(2,'0');
  var greet = h < 6  ? '深夜了'
            : h < 12 ? '早上好'
            : h < 14 ? '中午好'
            : h < 18 ? '下午好'
            : h < 21 ? '傍晚好'
            :           '晚上好';
  var name   = window.__topbarStudent.nickname || window.__topbarStudent.name || '';
  var avatar = window.__topbarStudent.avatar || '🐣';
  return hStr + ':' + mStr + '\u3000' + greet + '！<em>' + name + '</em>\u3000' + avatar;
}

/** 更新所有頁面上已渲染的問候欄 */
function refreshTopbarGreeting() {
  document.querySelectorAll('.topbar-center[data-greeting]').forEach(function(el) {
    el.innerHTML = getTopbarGreetingHTML();
  });
}

/**
 * 渲染 topbar 到指定容器
 * @param {string|Element} target  容器 id 字串 或 DOM 元素
 * @param {object}         opts    設定選項
 *   opts.back    {label, onclick}  左側返回按鈕（必填）
 *   opts.title   {string}          頁面標題 HTML（必填）
 *   opts.titleId {string}          如需動態更新標題，傳入 id
 *   opts.greeting {boolean}        顯示中間問候欄（預設 true）
 *   opts.extra   {string}          設定按鈕左側插入的額外 HTML
 *   opts.settingsOnclick {string}  設定按鈕的 onclick（預設 'goToProfile()'）
 */
function renderTopbar(target, opts) {
  var el = typeof target === 'string' ? document.getElementById(target) : target;
  if (!el) return;
  opts = opts || {};
  var showGreeting = opts.greeting !== false;
  var settingsOnclick = opts.settingsOnclick || 'goToProfile()';
  var titleId = opts.titleId ? ' id="' + opts.titleId + '"' : '';

  el.className = 'topbar';
  el.innerHTML =
    '<div class="topbar-left">' +
      '<button class="btn-back" onclick="' + opts.back.onclick + '">' + opts.back.label + '</button>' +
      '<div class="topbar-title"' + titleId + '>' + opts.title + '</div>' +
    '</div>' +
    '<div class="topbar-center"' + (showGreeting ? ' data-greeting="1"' : '') + '>' +
      (showGreeting ? getTopbarGreetingHTML() : '') +
    '</div>' +
    (opts.extra ? opts.extra : '') +
    '<button class="btn-settings" onclick="' + settingsOnclick + '">⚙️ 設定</button>';

  // 啟動每分鐘自動更新（只啟動一次）
  if (showGreeting && !_topbarTimer) {
    _topbarTimer = setInterval(refreshTopbarGreeting, 60000);
  }
}

/**
 * 設定問候語所需的學生資料（登入後呼叫一次）
 * @param {object} student  { name, nickname, avatar }
 */
function setTopbarStudent(student) {
  window.__topbarStudent = student;
  refreshTopbarGreeting();
}

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
