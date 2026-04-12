/**
 * achievement.js — 成就系統
 * 負責：achStats 狀態、addStars()、checkAchievements()、
 *        handleDailyLogin()、loadAchStats()、renderAchievementPage()
 * 依賴：state.js（charStatus、currentStudent、db）、
 *        curriculum.js（currSelectedLesson、currSelectedVer、currSelectedBook、curriculumData）
 *        shared.js（showToast）
 */
'use strict';

// ── 成就統計（從 Firestore 載入） ──
var achStats = {
  stars:                0,
  title:                '練字LV1',
  masteredChars:        [],   // 去重精熟字庫（✏️ 成就用）
  totalLoginDays:       0,    // 累積登入天數（📅 成就用）
  lastLoginDate:        '',   // 上次登入日期 YYYY-MM-DD
  completedLessons:     [],   // 已完成課次 ID（📖 成就用）
  completedBooks:       [],   // 已完成整冊 ID 格式 "verId_grade"（📚 成就用）
  todayPracticedChars:  0,    // 今日測驗通過字數（⚡ 成就用，每日重置）
  todayDate:            '',   // 今日日期（用於重置判斷）
  unlockedAchievements: {}    // { "mastered_lv1": true, ... }
};

// ── 稱號門檻（每 200 星升一級） ──
var TITLE_THRESHOLDS = [0, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800];
var TITLE_NAMES = [
  '練字LV1','練字LV2','練字LV3','練字LV4','練字LV5',
  '練字LV6','練字LV7','練字LV8','練字LV9','練字LV10'
];

// ── 成就定義（5 類 × 10 等） ──
var ACH_DEFS = [
  {
    id: 'mastered', icon: '✏️', label: '精熟字數',
    thresholds: [10, 50, 100, 200, 300, 400, 500, 600, 800, 1000],
    stars:      [ 3,  6,   9,  12,  15,  18,  21,  24,  27,   30],
    getValue:   function() { return achStats.masteredChars.length; },
    unit: '字'
  },
  {
    id: 'lessons', icon: '📖', label: '完成課次',
    thresholds: [1, 5, 10, 20, 30, 40, 50, 60, 80, 100],
    stars:      [3, 6,  9, 12, 15, 18, 21, 24, 27,  30],
    getValue:   function() { return achStats.completedLessons.length; },
    unit: '課'
  },
  {
    id: 'books', icon: '📚', label: '完成整冊',
    thresholds: [1,  2,  3,  4,  5,  6,  7,  8,  9, 10],
    stars:      [15, 21, 27, 36, 45, 54, 63, 72, 81, 90],
    getValue:   function() { return achStats.completedBooks.length; },
    unit: '冊'
  },
  {
    id: 'loginDays', icon: '📅', label: '累積登入',
    thresholds: [1, 3, 5, 7, 10, 14, 17, 21, 25, 30],
    stars:      [3, 6, 9, 12, 15, 18, 21, 24, 27, 30],
    getValue:   function() { return achStats.totalLoginDays; },
    unit: '天'
  },
  {
    id: 'daily', icon: '⚡', label: '單日練習',
    thresholds: [1, 3, 5, 7, 9, 11, 13, 15, 18, 20],
    stars:      [3, 6, 9, 12, 15, 18, 21, 24, 27, 30],
    getValue:   function() { return achStats.todayPracticedChars; },
    unit: '字'
  }
];

// ── 等級顏色（index 0 = 未解鎖，1-10 = Lv1-10） ──
var ACH_LV_BG = [
  '#e8e8e8',  // 未解鎖
  '#f9f9f9',  // Lv1  白
  '#d4f5d4',  // Lv2  淺綠
  '#27ae60',  // Lv3  綠
  '#00BCD4',  // Lv4  青
  '#4a90d9',  // Lv5  藍
  '#8e44ad',  // Lv6  紫
  '#d63384',  // Lv7  桃紅
  '#e67e22',  // Lv8  橘
  '#e74c3c',  // Lv9  紅
  '#FFD700'   // Lv10 金
];
var ACH_LV_BORDER = [
  '#c0c0c0', '#ccc', '#27ae60', '#1e8449',
  '#0097A7', '#2d6fa8', '#6c3483', '#a0255e',
  '#ca6f1e', '#c0392b', '#DAA520'
];
// Lv1-2 用深色文字，Lv3+ 用白色文字（或Lv10用深色）
var ACH_LV_TEXT = [
  '#aaa','#555','#1e8449','#fff',
  '#fff','#fff','#fff','#fff',
  '#fff','#fff','#333'
];

// ═══════════════════════════════════════════
//  核心函式
// ═══════════════════════════════════════════

/** 計算目前星星對應的稱號等級 index */
function computeTitleIndex(stars) {
  for (var i = TITLE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (stars >= TITLE_THRESHOLDS[i]) return i;
  }
  return 0;
}

/** 計算目前星星對應的稱號 */
function computeTitle(stars) {
  return TITLE_NAMES[computeTitleIndex(stars)];
}

/** 加星（不觸發 Firestore 寫入，由 checkAchievements 統一存檔） */
function addStars(n) {
  achStats.stars += n;
  achStats.title = computeTitle(achStats.stars);
  updateTopbarStars();
}

/** 更新頂端列星星顯示（若元素存在） */
function updateTopbarStars() {
  var el = document.getElementById('topbar-stars');
  if (el) el.textContent = '★ ' + achStats.stars;
}

/** 將 achStats 寫入 Firestore */
function saveAchStats() {
  if (!db || !currentStudent) return;
  db.collection('students').doc(currentStudent.id)
    .collection('stats').doc('profile')
    .set({
      stars:                achStats.stars,
      title:                achStats.title,
      masteredChars:        achStats.masteredChars,
      totalLoginDays:       achStats.totalLoginDays,
      lastLoginDate:        achStats.lastLoginDate,
      completedLessons:     achStats.completedLessons,
      completedBooks:       achStats.completedBooks,
      todayPracticedChars:  achStats.todayPracticedChars,
      todayDate:            achStats.todayDate,
      unlockedAchievements: achStats.unlockedAchievements
    }, { merge: true })
    .catch(function(e){ console.warn('saveAchStats error:', e); });
}

/** 從 Firestore 載入 achStats，完成後呼叫 callback */
function loadAchStats(callback) {
  if (!db || !currentStudent) { if (callback) callback(); return; }
  db.collection('students').doc(currentStudent.id)
    .collection('stats').doc('profile')
    .get().then(function(doc) {
      if (doc.exists) {
        var d = doc.data();
        achStats.stars                = d.stars                || 0;
        achStats.title                = d.title                || '練字LV1';
        achStats.masteredChars        = d.masteredChars        || [];
        achStats.totalLoginDays       = d.totalLoginDays       || 0;
        achStats.lastLoginDate        = d.lastLoginDate        || '';
        achStats.completedLessons     = d.completedLessons     || [];
        achStats.completedBooks       = d.completedBooks       || [];
        achStats.todayPracticedChars  = d.todayPracticedChars  || 0;
        achStats.todayDate            = d.todayDate            || '';
        achStats.unlockedAchievements = d.unlockedAchievements || {};
      }
      resetDailyIfNeeded();
      updateTopbarStars();
      if (callback) callback();
    }).catch(function(e) {
      console.warn('loadAchStats error:', e);
      if (callback) callback();
    });
}

/** 若跨日則重置今日練習字數 */
function resetDailyIfNeeded() {
  var today = new Date().toISOString().slice(0, 10);
  if (achStats.todayDate !== today) {
    achStats.todayPracticedChars = 0;
    achStats.todayDate = today;
  }
}

// ═══════════════════════════════════════════
//  登入 / 測驗事件
// ═══════════════════════════════════════════

/**
 * 每日登入：若今日尚未登入 → +1★，累積登入天數 +1
 * 應在 loadAchStats() 的 callback 中呼叫
 */
function handleDailyLogin() {
  var today = new Date().toISOString().slice(0, 10);
  if (achStats.lastLoginDate !== today) {
    achStats.lastLoginDate = today;
    achStats.totalLoginDays += 1;
    addStars(1);
    checkAchievements(); // 含 saveAchStats
  }
}

/**
 * 測驗答對一個字時呼叫
 * @param {string} char 通過的字
 */
function onExamCharPassed(char) {
  addStars(1);
  // 精熟字庫去重
  if (!achStats.masteredChars.includes(char)) {
    achStats.masteredChars.push(char);
  }
  // 今日練習字數
  achStats.todayPracticedChars += 1;
  checkAchievements(); // 含 saveAchStats
}

// ═══════════════════════════════════════════
//  成就檢查
// ═══════════════════════════════════════════

/** 檢查目前課次是否全部精熟 → 加入 completedLessons */
function checkLessonCompletion() {
  if (typeof currSelectedLesson === 'undefined' || !currSelectedLesson) return;
  if (!currSelectedLesson.chars || !currSelectedLesson.lessonId) return;
  var lid = currSelectedLesson.lessonId;
  if (achStats.completedLessons.indexOf(lid) !== -1) return;
  var allDone = currSelectedLesson.chars.every(function(c) {
    return charStatus[c] === 'mastered';
  });
  if (allDone) {
    achStats.completedLessons.push(lid);
    checkBookCompletion();
  }
}

/** 檢查目前冊次是否全課完成 → 加入 completedBooks */
function checkBookCompletion() {
  if (typeof currSelectedVer === 'undefined' || !currSelectedVer) return;
  if (typeof currSelectedBook === 'undefined' || !currSelectedBook) return;
  var bookId = currSelectedVer.verId + '_' + currSelectedBook;
  if (achStats.completedBooks.indexOf(bookId) !== -1) return;
  if (typeof curriculumData === 'undefined') return;
  var verData = curriculumData[currSelectedVer.verId];
  if (!verData || !verData.books || !verData.books[currSelectedBook]) return;
  var allLessons = verData.books[currSelectedBook];
  var allDone = allLessons.every(function(lesson) {
    return achStats.completedLessons.indexOf(lesson.lessonId) !== -1;
  });
  if (allDone) {
    achStats.completedBooks.push(bookId);
  }
}

/**
 * 主成就檢查：比對所有條件，對新解鎖的等級加星並 Toast 通知
 * 最後統一寫入 Firestore
 */
function checkAchievements() {
  checkLessonCompletion();
  ACH_DEFS.forEach(function(def) {
    var val = def.getValue();
    def.thresholds.forEach(function(threshold, idx) {
      var key = def.id + '_lv' + (idx + 1);
      if (!achStats.unlockedAchievements[key] && val >= threshold) {
        achStats.unlockedAchievements[key] = true;
        addStars(def.stars[idx]);
        if (typeof showToast === 'function') {
          showToast('🏆 ' + def.label + ' Lv' + (idx + 1) + ' 達成！  +' + def.stars[idx] + ' ★');
        }
      }
    });
  });
  saveAchStats();
}

// ═══════════════════════════════════════════
//  成就頁面渲染
// ═══════════════════════════════════════════

/** 渲染成就頁面（呼叫 showPage('achievement') 前先呼叫此函式） */
function renderAchievementPage() {
  var page = document.getElementById('page-achievement');
  if (!page) return;

  // ── 稱號進度計算 ──
  var currentLvIdx = computeTitleIndex(achStats.stars);
  var isMaxLv    = (currentLvIdx === TITLE_THRESHOLDS.length - 1);
  var prevT      = TITLE_THRESHOLDS[currentLvIdx];
  var nextT      = isMaxLv ? prevT : TITLE_THRESHOLDS[currentLvIdx + 1];
  var pct        = isMaxLv ? 100 : Math.min(100, Math.round((achStats.stars - prevT) / (nextT - prevT) * 100));
  var starsLeft  = isMaxLv ? 0 : nextT - achStats.stars;
  var nextTitle  = isMaxLv ? '' : TITLE_NAMES[currentLvIdx + 1];

  // ── Header ──
  var html = '<div class="ach-header">';
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

  // ── 成就卡片 ──
  html += '<div class="ach-cards-wrap">';
  ACH_DEFS.forEach(function(def) {
    var val = def.getValue();

    // 找最後一個已解鎖的 index（用於進度線寬度）
    var lastUnlockedIdx = -1;
    def.thresholds.forEach(function(_, idx) {
      if (achStats.unlockedAchievements[def.id + '_lv' + (idx + 1)]) lastUnlockedIdx = idx;
    });
    // 進度線寬度：延伸到最後解鎖節點的中心
    var linePct = lastUnlockedIdx < 0 ? 0
      : Math.round((lastUnlockedIdx + 0.5) / def.thresholds.length * 100);

    html += '<div class="ach-card">';

    // 卡片標題
    html += '<div class="ach-card-header">';
    html += '<span class="ach-card-icon">' + def.icon + '</span>';
    html += '<span class="ach-card-label">' + def.label + '</span>';
    html += '<span class="ach-card-cur">目前 ' + val + ' ' + def.unit + '</span>';
    html += '</div>';

    // 節點軌道
    html += '<div class="ach-track-wrap">';
    html += '<div class="ach-track-line"><div class="ach-track-line-fg" style="width:' + linePct + '%"></div></div>';
    html += '<div class="ach-nodes">';

    def.thresholds.forEach(function(threshold, idx) {
      var key      = def.id + '_lv' + (idx + 1);
      var unlocked = !!achStats.unlockedAchievements[key];
      var lvIdx    = idx + 1;
      var circleStyle = unlocked
        ? 'background:' + ACH_LV_BG[lvIdx] + ';border-color:' + ACH_LV_BORDER[lvIdx] + ';color:' + ACH_LV_TEXT[lvIdx]
        : '';

      html += '<div class="ach-node ' + (unlocked ? 'ach-node-unlocked' : 'ach-node-locked') + '">';
      html += '<div class="ach-node-circle" style="' + circleStyle + '">' + def.icon + '</div>';
      html += '<div class="ach-node-lv">Lv' + lvIdx + '</div>';
      html += '<div class="ach-node-val">' + threshold + def.unit + '</div>';
      html += '<div class="ach-node-star">+' + def.stars[idx] + '★</div>';
      html += '</div>';
    });

    html += '</div></div></div>';
  });
  html += '</div>';

  // ── 今日進度小結 ──
  html += '<div class="ach-daily-summary">';
  html += '<div class="ach-daily-title">📊 今日進度</div>';
  html += '<div class="ach-daily-row"><span>測驗通過字數</span><span>' + achStats.todayPracticedChars + ' 字</span></div>';
  html += '<div class="ach-daily-row"><span>累積精熟字數</span><span>' + achStats.masteredChars.length + ' 字</span></div>';
  html += '<div class="ach-daily-row"><span>累積登入天數</span><span>' + achStats.totalLoginDays + ' 天</span></div>';
  html += '</div>';

  page.innerHTML = html;
}
