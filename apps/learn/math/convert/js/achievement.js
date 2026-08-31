/**
 * achievement.js — 成就系統
 * 負責：achStats、checkAchievements()、handleDailyLogin()、
 *        loadAchStats()、saveAchStats()、renderAchievementPage()
 * 依賴：state.js（totalCorrect、totalRounds、bestStreak、categoryStats、currentStudent、db）
 *        shared.js（showToast）
 *
 * Firestore 路徑：students/{id}/stats/convertProfile
 */
'use strict';

var achStats = {
  stars:                0,
  title:                '換算LV1',
  totalLoginDays:       0,
  lastLoginDate:        '',
  unlockedAchievements: {}
};

var TITLE_THRESHOLDS = [0, 10, 30, 60, 100, 150, 200, 300, 400, 500];
var TITLE_NAMES = [
  '換算LV1','換算LV2','換算LV3','換算LV4','換算LV5',
  '換算LV6','換算LV7','換算LV8','換算LV9','換算LV10'
];

var ACH_DEFS = [
  {
    id: 'correct', icon: '✅', label: '累計答對',
    thresholds: [10, 30, 60, 100, 150, 200, 300, 500, 750, 1000],
    stars:      [ 3,  5,  8,  10,  12,  15,  18,  22,  26,   30],
    getValue: function() { return totalCorrect; },
    unit: '題'
  },
  {
    id: 'rounds', icon: '🎯', label: '完成輪數',
    thresholds: [1, 3, 5, 10, 15, 20, 30, 50, 75, 100],
    stars:      [3, 5, 8, 10, 13, 16, 19, 22, 25,  30],
    getValue: function() { return totalRounds; },
    unit: '輪'
  },
  {
    id: 'streak', icon: '🔥', label: '最高連擊',
    thresholds: [3, 5, 7, 10, 15, 20, 30, 50, 75, 100],
    stars:      [3, 5, 7,  9, 12, 15, 18, 21, 25,  30],
    getValue: function() { return bestStreak; },
    unit: '連擊'
  },
  {
    id: 'login', icon: '📅', label: '累積登入',
    thresholds: [1, 3, 5, 7, 10, 14, 17, 21, 25, 30],
    stars:      [3, 5, 8, 10, 13, 16, 19, 22, 25, 30],
    getValue: function() { return achStats.totalLoginDays; },
    unit: '天'
  }
];

// 各題域精熟徽章（累計星星 ≥ 10）
var CAT_BADGES = [
  { id: 'length-master', cat: 'length', icon: '📏', label: '長度達人', starsNeeded: 10 },
  { id: 'time-master',   cat: 'time',   icon: '⏰', label: '時間高手', starsNeeded: 10 },
  { id: 'money-master',  cat: 'money',  icon: '💰', label: '換錢達人', starsNeeded: 10 }
];

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

function recomputeStars() {
  var total = achStats.totalLoginDays;

  ACH_DEFS.forEach(function(def) {
    def.thresholds.forEach(function(_, idx) {
      var key = def.id + '_lv' + (idx + 1);
      if (achStats.unlockedAchievements[key]) total += def.stars[idx];
    });
  });

  CAT_BADGES.forEach(function(b) {
    if (achStats.unlockedAchievements[b.id]) total += 10;
  });

  achStats.stars = total;
  achStats.title = computeTitle(total);
}

function saveAchStats() {
  if (!db || !currentStudent) return;
  db.collection('students').doc(currentStudent.id)
    .collection('stats').doc('convertProfile')
    .set({
      stars:                achStats.stars,
      title:                achStats.title,
      totalLoginDays:       achStats.totalLoginDays,
      lastLoginDate:        achStats.lastLoginDate,
      unlockedAchievements: achStats.unlockedAchievements
    }, { merge: true })
    .catch(function(e) { console.warn('saveAchStats error:', e); });
}

function loadAchStats(callback) {
  if (!db || !currentStudent) { if (callback) callback(); return; }
  db.collection('students').doc(currentStudent.id)
    .collection('stats').doc('convertProfile')
    .get().then(function(doc) {
      if (doc.exists) {
        var d = doc.data();
        achStats.stars                = d.stars                || 0;
        achStats.title                = d.title                || '換算LV1';
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
    achStats.lastLoginDate  = today;
    achStats.totalLoginDays += 1;
    checkAchievements();
  }
}

// ════════════════════════════════════════
//  成就檢查
// ════════════════════════════════════════

function checkAchievements() {
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

  CAT_BADGES.forEach(function(b) {
    if (!achStats.unlockedAchievements[b.id]) {
      var cs = categoryStats[b.cat] || {};
      if ((cs.stars || 0) >= b.starsNeeded) {
        achStats.unlockedAchievements[b.id] = true;
        showToast('🏅 ' + b.label + ' 徽章解鎖！  +10 ★');
      }
    }
  });

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

  // ── 題域徽章 ──
  html += '<div class="ach-cards-wrap">';
  html += '<div class="ach-card">';
  html += '<div class="ach-card-header">';
  html += '<span class="ach-card-icon">🏅</span>';
  html += '<span class="ach-card-label">題域精熟徽章</span>';
  html += '<span class="ach-card-cur">各題域累積 10 星解鎖</span>';
  html += '</div>';
  html += '<div class="cat-badges-row">';
  CAT_BADGES.forEach(function(b) {
    var unlocked = !!achStats.unlockedAchievements[b.id];
    var catS     = categoryStats[b.cat] || {};
    var progress = Math.min(catS.stars || 0, b.starsNeeded);
    html += '<div class="cat-badge-item' + (unlocked ? ' cat-badge-unlocked' : '') + '">';
    html += '<div class="cat-badge-icon">' + b.icon + '</div>';
    html += '<div class="cat-badge-label">' + b.label + '</div>';
    if (unlocked) {
      html += '<div class="cat-badge-status">✓ 已解鎖 +10★</div>';
    } else {
      html += '<div class="cat-badge-status">' + progress + ' / ' + b.starsNeeded + ' ★</div>';
    }
    html += '</div>';
  });
  html += '</div></div></div>';

  page.innerHTML = html;
}
