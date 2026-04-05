/**
 * curriculum.js — 課程選擇（步驟式卡片）與自由練習輸入
 * 負責：從 Firestore 讀取課程資料、三步卡片選擇、startCurriculumLesson()、startLesson()
 * 依賴：state.js（chars, charStatus）、nav.js（showPage）、menu.js（renderMenu）
 */
'use strict';

var curriculumData = {}; // { verId: { name, books: { grade: [lesson...] } } }

// ── 步驟狀態 ──
var currSelectedVer    = null; // { verId, name }
var currSelectedBook   = null; // grade string
var currSelectedLesson = null; // lesson object

// 版本卡片色彩（依序套用）
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
  if (!container) return;

  db.collection('curriculum').get().then(function(snap) {
    container.innerHTML = '';
    var idx = 0;
    snap.forEach(function(doc) {
      var verId   = doc.id;
      var verName = doc.data().name || doc.id;
      var color   = CURR_COLORS[idx % CURR_COLORS.length];
      idx++;

      // 版本卡片
      var card = document.createElement('button');
      card.className = 'curr-ver-card';
      card.style.background   = color.bg;
      card.style.borderColor  = color.border;
      card.innerHTML =
        '<span class="curr-ver-icon">' + color.icon + '</span>' +
        '<span class="curr-ver-name" style="color:' + color.text + '">' + verName + '</span>';
      card.onclick = function() {
        if (!curriculumData[verId] || !curriculumData[verId].books) {
          card.innerHTML += '<span class="curr-loading-inline"> 載入中…</span>';
          card.disabled = true;
          // 稍待後重試
          setTimeout(function() { selectVersion(verId, verName, card, color); }, 600);
        } else {
          selectVersion(verId, verName, card, color);
        }
      };
      container.appendChild(card);

      // 非同步載入課次資料
      db.collection('curriculum').doc(verId).collection('lessons').get().then(function(lSnap) {
        var books = {};
        lSnap.forEach(function(lDoc) {
          var d     = lDoc.data();
          var grade = d.grade || '未分冊';
          if (!books[grade]) books[grade] = [];
          books[grade].push({ lessonId: lDoc.id, lessonNum: d.lessonNum, name: d.name, chars: d.chars || [] });
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
  }).catch(function(e) {
    console.warn('loadCurriculumVersions error:', e);
    var container = document.getElementById('version-cards');
    if (container) container.innerHTML = '<div class="curr-loading">載入失敗，請重新整理</div>';
  });
}

// ── 步驟切換 ──

function goToCurrStep(step) {
  [1, 2, 3].forEach(function(n) {
    var el = document.getElementById('curr-step-' + n);
    if (el) el.style.display = n === step ? '' : 'none';
    var crumb = document.getElementById('crumb-' + n);
    if (crumb) crumb.classList.toggle('active', n <= step);
  });
  if (step < 3) {
    var bar = document.getElementById('curr-start-bar');
    if (bar) bar.style.display = 'none';
    if (step < 3) currSelectedLesson = null;
    if (step < 2) currSelectedBook = null;
  }
}

// ── Step 1 → 選版本 ──

function selectVersion(verId, verName, cardEl, color) {
  // 還原可能被禁用的卡片
  if (cardEl) {
    cardEl.disabled = false;
    cardEl.innerHTML =
      '<span class="curr-ver-icon">' + color.icon + '</span>' +
      '<span class="curr-ver-name" style="color:' + color.text + '">' + verName + '</span>';
  }

  currSelectedVer  = { verId: verId, name: verName };
  currSelectedBook = null;
  currSelectedLesson = null;

  var bookCards = document.getElementById('book-cards');
  bookCards.innerHTML = '';
  document.getElementById('step2-title').textContent = verName + '　選擇冊次';

  var data  = curriculumData[verId] || {};
  var books = Object.keys(data.books || {}).sort();

  if (!books.length) {
    bookCards.innerHTML = '<div class="curr-loading">此版本暫無資料</div>';
  } else {
    books.forEach(function(b) {
      var card = document.createElement('button');
      card.className = 'curr-book-card';
      card.textContent = b;
      card.onclick = function() { selectBook(b); };
      bookCards.appendChild(card);
    });
  }

  goToCurrStep(2);
  // 更新麵包屑顯示版本名
  var c1 = document.getElementById('crumb-1');
  if (c1) c1.textContent = verName;
}

// ── Step 2 → 選冊次 ──

function selectBook(bookId) {
  currSelectedBook   = bookId;
  currSelectedLesson = null;

  var verId   = currSelectedVer.verId;
  var lessons = ((curriculumData[verId] || {}).books || {})[bookId] || [];

  var lessonCards = document.getElementById('lesson-cards');
  lessonCards.innerHTML = '';
  document.getElementById('step3-title').textContent =
    currSelectedVer.name + '　' + bookId;
  var bar = document.getElementById('curr-start-bar');
  if (bar) bar.style.display = 'none';

  lessons.forEach(function(lesson) {
    var card = document.createElement('button');
    card.className = 'curr-lesson-card';
    var preview = (lesson.chars || []).slice(0, 8).join(' ');
    card.innerHTML =
      '<div class="curr-lesson-num">第 ' + (lesson.lessonNum || '') + ' 課</div>' +
      '<div class="curr-lesson-name">' + (lesson.name || '') + '</div>' +
      '<div class="curr-lesson-chars">' + preview + '</div>';
    card.onclick = function() { selectLesson(lesson, card); };
    lessonCards.appendChild(card);
  });

  goToCurrStep(3);
  // 更新麵包屑
  var c2 = document.getElementById('crumb-2');
  if (c2) c2.textContent = bookId;
}

// ── Step 3 → 選課次（直接進入） ──

function selectLesson(lesson, cardEl) {
  currSelectedLesson = lesson;
  document.querySelectorAll('.curr-lesson-card').forEach(function(c) { c.classList.remove('active'); });
  cardEl.classList.add('active');
  sfxTap();
  startCurriculumLesson();
}

// ── 開始課程 ──

function startCurriculumLesson() {
  if (!currSelectedVer || !currSelectedBook || !currSelectedLesson) return;
  var lesson  = currSelectedLesson;
  var verName = currSelectedVer.name;
  currentLessonLabel = verName + '　' + currSelectedBook +
    '・第 ' + (lesson.lessonNum || '') + ' 課　' + (lesson.name || '');
  chars = lesson.chars.slice();
  chars.forEach(function(c) { if (!charStatus[c]) charStatus[c] = 'new'; });
  renderMenu();
  showPage('menu');
}

// ── 自由練習輸入 ──

function onCharInput() {
  var val = document.getElementById('char-input').value.trim();
  document.getElementById('btn-start-free').disabled = !val.length;
}

function startLesson() {
  var raw  = document.getElementById('char-input').value.trim();
  var list = Array.from(new Set(
    raw.replace(/\s/g, '').split('').filter(function(c) { return c; })
  ));
  if (!list.length) return;
  sfxTap();
  currentLessonLabel = '自由練習';
  chars = list;
  chars.forEach(function(c) { if (!charStatus[c]) charStatus[c] = 'new'; });
  renderMenu();
  showPage('menu');
}
