/**
 * achievement.js — 成就系統
 * 負責：achStats、checkAchievements()、checkTableAchievements()、
 *        handleDailyLogin()、loadAchStats()、saveAchStats()、renderAchievementPage()
 * 依賴：state.js（masteredFill、masteredReverse、totalCorrect、currentStudent、db）
 *        shared.js（showToast）
 *
 * Firestore 路徑：students/{id}/stats/multiplyProfile（與練字趣隔離）
 */
'use strict';

// ── 成就統計 ──
var achStats = {
  stars:                0,
  title:                '乘法LV1',
  totalLoginDays:       0,
  lastLoginDate:        '',
  unlockedAchievements: {}
};

// ── 稱號門檻（每 100 星升一級） ──
var TITLE_THRESHOLDS = [0, 50, 100, 200, 350, 500, 700, 900, 1200, 1500];
var TITLE_NAMES = [
  '乘法LV1','乘法LV2','乘法LV3','乘法LV4','乘法LV5',
  '乘法LV6','乘法LV7','乘法LV8','乘法LV9','乘法LV10'
];

// ── 標準成就定義（10 等） ──
var ACH_DEFS = [
  {
    id: 'correct', icon: '✖️', label: '答對題數',
    thresholds: [10, 50, 121, 242, 400, 600, 800, 1000, 1500, 2000],
    stars:      [ 3,  5,   8,  12,  15,  18,  21,   24,   27,   30],
    getValue:   function() { return totalCorrect; },
    unit: '題'
  },
  {
    id: 'login', icon: '📅', label: '累積登入',
    thresholds: [1, 3, 5, 7, 10, 14, 17, 21, 25, 30],
    stars:      [3, 5, 8, 10, 13, 16, 19, 22, 25, 30],
    getValue:   function() { return achStats.totalLoginDays; },
    unit: '天'
  }
];

// ── 等級顏色（index 0 = 未解鎖，1–10 = Lv1–10） ──
var ACH_LV_BG = [
  '#e8e8e8','#f9f9f9','#d4f5d4','#27ae60','#00BCD4',
  '#4a90d9','#8e44ad','#d63384','#e67e22','#e74c3c','#FFD700'
];
var ACH_LV_BORDER = [
  '#c0c0c0','#ccc','#27ae60','#1e8449','#0097A7',
  '#2d6fa8','#6c3483','#a0255e','#ca6f1e','#c0392b','#DAA520'
];
var ACH_LV_TEXT = [
  '#aaa','#555','#1e8449','#fff','#fff',
  '#fff','#fff','#fff','#fff','#fff','#333'
];

// ════════════════════════════════════════
//  核心函式
// ════════════════════════════════════════

function computeTitleIndex(stars) {
  for (var i = TITLE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (stars >= TITLE_THRESHOLDS[i]) return i;
  }
  return 0;
}

function computeTitle(stars) { return TITLE_NAMES[computeTitleIndex(stars)]; }

function updateTopbarStars() {
  var el = document.getElementById('topbar-stars');
  if (el) el.textContent = '★ ' + achStats.stars;
}

/** 重新從已解鎖成就計算總星數 */
function recomputeStars() {
  var total = achStats.totalLoginDays; // 每日登入 +1★

  // 標準成就
  ACH_DEFS.forEach(function(def) {
    def.thresholds.forEach(function(_, idx) {
      var key = def.id + '_lv' + (idx + 1);
      if (achStats.unlockedAchievements[key]) total += def.stars[idx];
    });
  });

  // 乘法表成就星數（fill +5、reverse +5、both +10）
  for (var i = 0; i <= 10; i++) {
    if (achStats.unlockedAchievements['fill_table_'    + i]) total += 5;
    if (achStats.unlockedAchievements['rev_table_'     + i]) total += 5;
    if (achStats.unlockedAchievements['both_table_'    + i]) total += 10;
  }

  achStats.stars = total;
  achStats.title = computeTitle(total);
}

/** 將 achStats 寫入 Firestore */
function saveAchStats() {
  if (!db || !currentStudent) return;
  db.collection('students').doc(currentStudent.id)
    .collection('stats').doc('multiplyProfile')
    .set({
      stars:                achStats.stars,
      title:                achStats.title,
      totalLoginDays:       achStats.totalLoginDays,
      lastLoginDate:        achStats.lastLoginDate,
      unlockedAchievements: achStats.unlockedAchievements
    }, { merge: true })
    .catch(function(e) { console.warn('saveAchStats error:', e); });
}

/** 從 Firestore 載入 achStats，完成後呼叫 callback */
function loadAchStats(callback) {
  if (!db || !currentStudent) { if (callback) callback(); return; }
  db.collection('students').doc(currentStudent.id)
    .collection('stats').doc('multiplyProfile')
    .get().then(function(doc) {
      if (doc.exists) {
        var d = doc.data();
        achStats.stars                = d.stars                || 0;
        achStats.title                = d.title                || '乘法LV1';
        achStats.totalLoginDays       = d.totalLoginDays       || 0;
        achStats.lastLoginDate        = d.lastLoginDate        || '';
        achStats.unlockedAchievements = d.unlockedAchievements || {};
      }
      recomputeStars();
      updateTopbarStars();
      if (callback) callback();
    }).catch(function(e) {
      console.warn('loadAchStats error:', e);
      if (callback) callback();
    });
}

// ════════════════════════════════════════
//  登入事件
// ════════════════════════════════════════

function handleDailyLogin() {
  var today = new Date().toISOString().slice(0, 10);
  if (achStats.lastLoginDate !== today) {
    achStats.lastLoginDate = today;
    achStats.totalLoginDays += 1;
    checkAchievements();
  }
}

// ════════════════════════════════════════
//  成就檢查
// ════════════════════════════════════════

/** 檢查並解鎖乘法表相關成就（fill / reverse / both） */
function checkTableAchievements() {
  for (var i = 0; i <= 10; i++) {
    var fillKey = 'fill_table_' + i;
    var revKey  = 'rev_table_'  + i;
    var bothKey = 'both_table_' + i;

    var fillDone = masteredFill    && masteredFill.indexOf(String(i))    !== -1;
    var revDone  = masteredReverse && masteredReverse.indexOf(String(i)) !== -1;

    if (fillDone && !achStats.unlockedAchievements[fillKey]) {
      achStats.unlockedAchievements[fillKey] = true;
      showToast('✏️ ' + i + ' 的乘法填空精熟！  +5 ★');
    }
    if (revDone && !achStats.unlockedAchievements[revKey]) {
      achStats.unlockedAchievements[revKey] = true;
      showToast('🔍 ' + i + ' 的積拆解精熟！  +5 ★');
    }
    if (fillDone && revDone && !achStats.unlockedAchievements[bothKey]) {
      achStats.unlockedAchievements[bothKey] = true;
      showToast('🏅 ' + i + ' 的乘法完全精熟！  +10 ★');
    }
  }
}

/** 主成就檢查：標準成就 + 乘法表成就 */
function checkAchievements() {
  // 標準成就
  ACH_DEFS.forEach(function(def) {
    var val = def.getValue();
    def.thresholds.forEach(function(threshold, idx) {
      var key = def.id + '_lv' + (idx + 1);
      if (!achStats.unlockedAchievements[key] && val >= threshold) {
        achStats.unlockedAchievements[key] = true;
        showToast('🏆 ' + def.label + ' Lv' + (idx + 1) + ' 達成！  +' + def.stars[idx] + ' ★');
      }
    });
  });

  // 乘法表成就
  checkTableAchievements();

  recomputeStars();
  updateTopbarStars();
  saveAchStats();
}

// ════════════════════════════════════════
//  成就頁面渲染
// ════════════════════════════════════════

function renderAchievementPage() {
  var page = document.getElementById('page-achievement');
  if (!page) return;

  // ── 稱號進度 ──
  var lvIdx    = computeTitleIndex(achStats.stars);
  var isMaxLv  = lvIdx === TITLE_THRESHOLDS.length - 1;
  var prevT    = TITLE_THRESHOLDS[lvIdx];
  var nextT    = isMaxLv ? prevT : TITLE_THRESHOLDS[lvIdx + 1];
  var pct      = isMaxLv ? 100 : Math.min(100, Math.round((achStats.stars - prevT) / (nextT - prevT) * 100));
  var starsLeft = isMaxLv ? 0 : nextT - achStats.stars;
  var nextTitle = isMaxLv ? '' : TITLE_NAMES[lvIdx + 1];

  var html = '';

  // ── Header ──
  html += '<div class="ach-header">';
  html += '<div class="ach-avatar-wrap">';
  html += '<div class="ach-avatar">' + (currentStudent ? currentStudent.avatar : '🐣') + '</div>';
  html += '<div class="ach-title-badge">' + achStats.title + '</div>';
  html += '</div>';
  html += '<div class="ach-header-info">';
  html += '<div class="ach-name">' + (currentStudent ? (currentStudent.nickname || currentStudent.name) : '—') + '</div>';
  html += '<div class="ach-stars-count">⭐ ' + achStats.stars + ' 顆星</div>';
  if (isMaxLv) {
    html += '<div class="ach-next-hint">已達最高等級！</div>';
  } else {
    html += '<div class="ach-next-hint">距 ' + nextTitle + ' 還差 ' + starsLeft + ' ★</div>';
  }
  html += '<div class="ach-prog-bar"><div class="ach-prog-fill" style="width:' + pct + '%"></div></div>';
  html += '</div></div>';

  // ── 標準成就軌道 ──
  html += '<div class="ach-cards-wrap">';
  ACH_DEFS.forEach(function(def) {
    var val = def.getValue();
    var lastUnlockedIdx = -1;
    def.thresholds.forEach(function(_, idx) {
      if (achStats.unlockedAchievements[def.id + '_lv' + (idx + 1)]) lastUnlockedIdx = idx;
    });
    var linePct = lastUnlockedIdx < 0 ? 0
      : Math.round((lastUnlockedIdx + 0.5) / def.thresholds.length * 100);

    html += '<div class="ach-card">';
    html += '<div class="ach-card-header">';
    html += '<span class="ach-card-icon">' + def.icon + '</span>';
    html += '<span class="ach-card-label">' + def.label + '</span>';
    html += '<span class="ach-card-cur">目前 ' + val + ' ' + def.unit + '</span>';
    html += '</div>';
    html += '<div class="ach-track-wrap">';
    html += '<div class="ach-track-line"><div class="ach-track-line-fg" style="width:' + linePct + '%"></div></div>';
    html += '<div class="ach-nodes">';
    def.thresholds.forEach(function(threshold, idx) {
      var key      = def.id + '_lv' + (idx + 1);
      var unlocked = !!achStats.unlockedAchievements[key];
      var lvIdx2   = idx + 1;
      var style    = unlocked
        ? 'background:' + ACH_LV_BG[lvIdx2] + ';border-color:' + ACH_LV_BORDER[lvIdx2] + ';color:' + ACH_LV_TEXT[lvIdx2]
        : '';
      html += '<div class="ach-node ' + (unlocked ? 'ach-node-unlocked' : 'ach-node-locked') + '">';
      html += '<div class="ach-node-circle" style="' + style + '">' + def.icon + '</div>';
      html += '<div class="ach-node-lv">Lv' + lvIdx2 + '</div>';
      html += '<div class="ach-node-val">' + threshold + def.unit + '</div>';
      html += '<div class="ach-node-star">+' + def.stars[idx] + '★</div>';
      html += '</div>';
    });
    html += '</div></div></div>';
  });
  html += '</div>';

  // ── 乘法表成就（線段軌道 × 3 類） ──
  var tableGroups = [
    {
      keyPrefix: 'fill_table_', icon: '✏️', label: '精熟乘法填空',
      starPer: 5,
      isDone: function(i) { return masteredFill    && masteredFill.indexOf(String(i))    !== -1; }
    },
    {
      keyPrefix: 'rev_table_',  icon: '🔍', label: '精熟積的拆解',
      starPer: 5,
      isDone: function(i) { return masteredReverse && masteredReverse.indexOf(String(i)) !== -1; }
    },
    {
      keyPrefix: 'both_table_', icon: '🏅', label: '完全精熟（填空＋拆解）',
      starPer: 10,
      isDone: function(i) {
        return masteredFill    && masteredFill.indexOf(String(i))    !== -1 &&
               masteredReverse && masteredReverse.indexOf(String(i)) !== -1;
      }
    }
  ];

  html += '<div class="ach-cards-wrap">';
  tableGroups.forEach(function(grp) {
    // 計算已精熟數量與進度線
    var count = 0;
    var lastIdx = -1;
    for (var i = 0; i <= 10; i++) {
      if (grp.isDone(i)) { count++; lastIdx = i; }
    }
    var linePct = lastIdx < 0 ? 0 : Math.round((lastIdx + 0.5) / 11 * 100);

    html += '<div class="ach-card">';
    html += '<div class="ach-card-header">';
    html += '<span class="ach-card-icon">' + grp.icon + '</span>';
    html += '<span class="ach-card-label">' + grp.label + '</span>';
    html += '<span class="ach-card-cur">目前 ' + count + ' / 11 張</span>';
    html += '</div>';

    html += '<div class="ach-track-wrap">';
    html += '<div class="ach-track-line"><div class="ach-track-line-fg" style="width:' + linePct + '%"></div></div>';
    html += '<div class="ach-nodes ach-nodes-11">';
    for (var i = 0; i <= 10; i++) {
      var done  = grp.isDone(i);
      var style = done ? 'background:var(--blue);border-color:var(--blue-dk);color:white' : '';
      html += '<div class="ach-node ' + (done ? 'ach-node-unlocked' : 'ach-node-locked') + '">';
      html += '<div class="ach-node-circle ach-node-circle-sm" style="' + style + '">' + i + '</div>';
      html += '<div class="ach-node-lv">' + (done ? '✓' : '—') + '</div>';
      html += '<div class="ach-node-star">' + (done ? '+' + grp.starPer + '★' : '') + '</div>';
      html += '</div>';
    }
    html += '</div></div></div>';
  });
  html += '</div>';

  page.innerHTML = html;
}
