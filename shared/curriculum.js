/**
 * curriculum.js — 語文學習 App 課程選擇範本（版本→冊次→課次）
 *
 * 使用方式：
 *   各 app 在 state.js（或 init.js）中定義兩個可選 Hook：
 *
 *   function onCurriculumLessonSelected(lesson, verName, bookId, gradeData) { ... }
 *     — 在選好課次後呼叫，用來初始化 app 自身的學習狀態
 *
 *   function getLessonMasteredState(lesson) { return true/false; }
 *     — 決定課次卡片是否顯示「✓ 全過」標記，未定義則不顯示
 *
 * 依賴：shared.js（db）、nav.js（showPage）、各 app 的 renderMenu()
 */
'use strict';

var curriculumData     = {}; // { verId: { name, books: { grade: [lesson...] } } }
var currSelectedVer    = null;
var currSelectedBook   = null;
var currSelectedLesson = null;
var currStep           = 1;

var CURR_COLORS = [
  { bg: '#e8f4fd', border: '#4a90d9', text: '#2d6fa8', icon: '📗' },
  { bg: '#edfbf4', border: '#27ae60', text: '#1e8449', icon: '📘' },
  { bg: '#fff8f0', border: '#e67e22', text: '#ca6f1e', icon: '📙' },
  { bg: '#f3f0fc', border: '#8e44ad', text: '#6c3483', icon: '📓' }
];

// ── 載入課程資料 ──

function loadCurriculumVersions() {
  if (!db) { setTimeout(loadCurriculumVersions, 300); return; }
  var container = document.getElementById('version-cards');
  if (!container) { setTimeout(loadCurriculumVersions, 300); return; }

  db.collection('curriculum').get().then(function(snap) {
    container.innerHTML = '';
    var idx = 0;
    snap.forEach(function(doc) {
      var verId   = doc.id;
      var verName = doc.data().name || doc.id;
      var color   = CURR_COLORS[idx % CURR_COLORS.length];
      idx++;

      var card = document.createElement('button');
      card.className = 'curr-ver-card';
      card.style.background  = color.bg;
      card.style.borderColor = color.border;
      card.innerHTML =
        '<span class="curr-ver-icon">' + color.icon + '</span>' +
        '<span class="curr-ver-name" style="color:' + color.text + '">' + verName + '</span>';
      card.onclick = function() {
        if (!curriculumData[verId] || !curriculumData[verId].books) {
          card.innerHTML += '<span class="curr-loading-inline"> 載入中…</span>';
          card.disabled = true;
          setTimeout(function() { selectVersion(verId, verName, card, color); }, 600);
        } else {
          selectVersion(verId, verName, card, color);
        }
      };
      container.appendChild(card);

      // 非同步載入課次（含 chars 與 words 欄位）
      db.collection('curriculum').doc(verId).collection('lessons').get().then(function(lSnap) {
        var books = {};
        lSnap.forEach(function(lDoc) {
          var d     = lDoc.data();
          var grade = d.grade || '未分冊';
          if (!books[grade]) books[grade] = [];
          books[grade].push({
            lessonId:  lDoc.id,
            lessonNum: d.lessonNum,
            name:      d.name,
            chars:     d.chars  || [],
            words:     d.words  || []
          });
        });
        Object.keys(books).forEach(function(g) {
          books[g].sort(function(a, b) { return (a.lessonNum || 0) - (b.lessonNum || 0); });
        });
        curriculumData[verId] = { name: verName, books: books };
      });
    });

    if (!snap.size) {
      container.innerHTML = '<div class="curr-loading">目前沒有課程資料</div>';
    }
  }).catch(function() {
    container.innerHTML =
      '<div class="curr-loading">載入失敗</div>' +
      '<button class="btn-retry-curr" onclick="loadCurriculumVersions()">🔄 重試</button>';
  });
}

// ── 步驟切換 ──

function goToCurrStep(step) {
  [1, 2, 3].forEach(function(n) {
    var el = document.getElementById('curr-step-' + n);
    if (el) el.style.display = n === step ? '' : 'none';
  });
  if (step < 3) currSelectedLesson = null;
  if (step < 2) currSelectedBook   = null;
  currStep = step;
  updateTopbarBreadcrumb(step);
}

function updateTopbarBreadcrumb(step) {
  var titleEl = document.getElementById('topbar-title');
  var bcEl    = document.getElementById('topbar-breadcrumb');
  if (!bcEl) return;
  if (titleEl) titleEl.classList.add('hidden');
  bcEl.classList.remove('hidden');

  var c1 = document.getElementById('tb-crumb-1');
  var c2 = document.getElementById('tb-crumb-2');
  var c3 = document.getElementById('tb-crumb-3');
  if (!c1 || !c2 || !c3) return;

  c1.textContent = currSelectedVer ? currSelectedVer.name : '出版社';
  c1.className   = 'tb-crumb' + (step > 1 ? ' tb-link' : ' tb-active');
  c1.onclick     = step > 1 ? function() { goToCurrStep(1); } : null;

  c2.textContent = currSelectedBook || '冊次';
  c2.className   = 'tb-crumb' + (step > 2 ? ' tb-link' : step === 2 ? ' tb-active' : '');
  c2.onclick     = step > 2 ? function() { goToCurrStep(2); } : null;

  var lessonLabel = currSelectedLesson ? '第 ' + (currSelectedLesson.lessonNum || '') + ' 課' : '課次';
  c3.textContent = lessonLabel;
  c3.className   = 'tb-crumb' + (step >= 4 ? ' tb-link' : step === 3 ? ' tb-active' : '');
  c3.onclick     = step >= 4 ? function() { goToCurrStep(3); } : null;
}

// ── Step 1 → 選版本 ──

function selectVersion(verId, verName, cardEl, color) {
  if (cardEl) {
    cardEl.disabled = false;
    cardEl.innerHTML =
      '<span class="curr-ver-icon">' + color.icon + '</span>' +
      '<span class="curr-ver-name" style="color:' + color.text + '">' + verName + '</span>';
  }
  currSelectedVer    = { verId: verId, name: verName };
  currSelectedBook   = null;
  currSelectedLesson = null;

  var bookCards = document.getElementById('book-cards');
  bookCards.innerHTML = '';
  document.getElementById('step2-title').textContent = verName + '　選擇冊次';

  var data  = curriculumData[verId] || {};
  var GRADE_NUM = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10 };
  var books = Object.keys(data.books || {}).sort(function(a, b) {
    var ga = GRADE_NUM[a[0]] || 99, gb = GRADE_NUM[b[0]] || 99;
    if (ga !== gb) return ga - gb;
    return (a[1] === '上' ? 0 : 1) - (b[1] === '上' ? 0 : 1);
  });

  if (!books.length) {
    bookCards.innerHTML = '<div class="curr-loading">此版本暫無資料</div>';
  } else {
    books.forEach(function(b) {
      var lessonCount = ((data.books || {})[b] || []).length;
      var card = document.createElement('button');
      card.className = 'curr-book-card';
      card.innerHTML =
        '<span class="curr-book-icon">📖</span>' +
        '<span class="curr-book-label">' + b + '</span>' +
        '<span class="curr-book-meta">' + lessonCount + ' 課</span>';
      card.onclick = function() { selectBook(b); };
      bookCards.appendChild(card);
    });
  }
  goToCurrStep(2);
}

// ── Step 2 → 選冊次 ──

function selectBook(bookId) {
  currSelectedBook   = bookId;
  currSelectedLesson = null;

  var verId   = currSelectedVer.verId;
  var lessons = ((curriculumData[verId] || {}).books || {})[bookId] || [];

  var lessonCards = document.getElementById('lesson-cards');
  lessonCards.innerHTML = '';
  document.getElementById('step3-title').textContent = currSelectedVer.name + '　' + bookId;

  var half = Math.ceil(lessons.length / 2);
  var col1 = document.createElement('div');
  var col2 = document.createElement('div');
  col1.className = 'curr-lesson-col';
  col2.className = 'curr-lesson-col';

  lessons.forEach(function(lesson, i) {
    var card = document.createElement('button');

    // 可選 Hook：判斷整課是否全部通過
    var allPassed = typeof getLessonMasteredState === 'function'
      ? getLessonMasteredState(lesson) : false;
    card.className = 'curr-lesson-card' + (allPassed ? ' lesson-all-mastered' : '');

    var charPreview = (lesson.chars || []).slice(0, 8).join(' ');
    var wordCount   = (lesson.words || []).length;
    var meta = wordCount ? '<span class="lesson-word-badge">' + wordCount + '詞</span>' : '';
    var badge = allPassed ? '<span class="lesson-mastered-badge">✓ 全過</span>' : '';
    card.innerHTML =
      '<div class="curr-lesson-num">第 ' + (lesson.lessonNum || '') + ' 課 ' + badge + '</div>' +
      '<div class="curr-lesson-name">' + (lesson.name || '') + '</div>' +
      '<div class="curr-lesson-chars">' + charPreview + meta + '</div>';
    card.onclick = function() { selectLesson(lesson, card); };
    (i < half ? col1 : col2).appendChild(card);
  });

  lessonCards.appendChild(col1);
  lessonCards.appendChild(col2);
  goToCurrStep(3);
}

// ── Step 3 → 選課次 ──

function selectLesson(lesson, cardEl) {
  currSelectedLesson = lesson;
  document.querySelectorAll('.curr-lesson-card').forEach(function(c) { c.classList.remove('active'); });
  cardEl.classList.add('active');
  if (typeof sfxTap === 'function') sfxTap();
  startCurriculumLesson();
}

function startCurriculumLesson() {
  if (!currSelectedVer || !currSelectedBook || !currSelectedLesson) return;
  var lesson    = currSelectedLesson;
  var verName   = currSelectedVer.name;
  var verId     = currSelectedVer.verId;
  var gradeData = ((curriculumData[verId] || {}).books || {})[currSelectedBook] || [];

  currentLessonLabel = verName + '　' + currSelectedBook + '・第 ' + (lesson.lessonNum || '') + ' 課　' + (lesson.name || '');

  // App 自訂 Hook：初始化各 app 的學習狀態
  if (typeof onCurriculumLessonSelected === 'function') {
    onCurriculumLessonSelected(lesson, verName, currSelectedBook, gradeData);
  }

  renderMenu();
  showPage('menu');
  updateTopbarBreadcrumb(4);
}
