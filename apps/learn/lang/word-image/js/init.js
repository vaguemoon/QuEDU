'use strict';

/* 所有 wordImages 依 gradeLesson 分組 */
var _allByGL = {}; // { 'grade_lesson': [{word, definition, imageUrl}] }

window.addEventListener('load', function() {
  initFirebase();
  applyTheme(currentTheme);

  PAGE_STACK = ['grade'];
  showPage('grade', false);

  (function waitDb() {
    if (!db) { setTimeout(waitDb, 200); return; }
    _loadAllImages();
    _autoLogin();
  })();
});

/* ── 從 Firestore 載入所有 wordImages ── */
function _loadAllImages() {
  db.collection('wordImages').get().then(function(snap) {
    _allByGL = {};
    snap.forEach(function(doc) {
      var d  = doc.data();
      var gl = d.gradeLesson || (d.grade + '_' + d.lesson);
      if (!_allByGL[gl]) _allByGL[gl] = [];
      _allByGL[gl].push({
        word:       d.word       || '',
        definition: d.definition || '',
        imageUrl:   d.imageUrl   || ''
      });
    });
    _renderGradePage();
  }).catch(function() {
    var inner = document.querySelector('#page-grade .wi-page-inner');
    if (inner) inner.innerHTML =
      '<div class="wi-empty"><div class="wi-empty-icon">⚠️</div>' +
      '<div class="wi-empty-text">載入失敗，請重新整理頁面</div></div>';
  });
}

/* ── 自動登入（由 hub 寫入 sessionStorage） ── */
function _autoLogin() {
  try {
    var saved = sessionStorage.getItem('hub_student');
    if (!saved) return;
    var hub = JSON.parse(saved);
    var id  = hub.id;

    Promise.all([
      db.collection('students').doc(id).get(),
      db.collection('students').doc(id).collection('progress').doc('wordImage').get()
    ]).then(function(res) {
      var sDoc = res[0], pDoc = res[1];
      if (!sDoc.exists) return;
      var sData = sDoc.data();
      currentStudent = {
        name:     hub.name,
        pin:      hub.pin,
        id:       id,
        nickname: sData.nickname || '',
        avatar:   sData.avatar   || '🐣'
      };
      wordProgress = (pDoc.exists && pDoc.data().words) ? pDoc.data().words : {};

      var avEl = document.getElementById('topbar-avatar');
      var nmEl = document.getElementById('topbar-name');
      if (avEl) avEl.textContent = currentStudent.avatar;
      if (nmEl) nmEl.textContent = currentStudent.nickname || currentStudent.name;
      showToast('👋 歡迎 ' + (currentStudent.nickname || currentStudent.name));
    }).catch(function(e) { console.warn('autoLogin error:', e); });
  } catch(e) {}
}

/* ── 年級選擇頁 ── */
function _renderGradePage() {
  var inner = document.querySelector('#page-grade .wi-page-inner');
  if (!inner) return;

  var gradeMap = {};
  Object.keys(_allByGL).forEach(function(gl) {
    var sep   = gl.indexOf('_');
    var grade = gl.substring(0, sep);
    if (!gradeMap[grade]) gradeMap[grade] = { lessonCount: 0, wordCount: 0 };
    gradeMap[grade].lessonCount++;
    gradeMap[grade].wordCount += _allByGL[gl].length;
  });

  var grades = Object.keys(gradeMap).sort();
  if (!grades.length) {
    inner.innerHTML =
      '<div class="wi-empty"><div class="wi-empty-icon">🖼️</div>' +
      '<div class="wi-empty-text">目前尚無詞語圖片<br>請等老師上傳</div></div>';
    return;
  }

  var html = '<div class="wi-page-title">選擇年級</div><div class="wi-btn-grid">';
  grades.forEach(function(g) {
    var info = gradeMap[g];
    html += '<button class="wi-select-btn" onclick="selectGrade(\'' + g + '\')">' +
      _escHtml(g) +
      '<span class="wi-btn-count">' + info.lessonCount + ' 課・' + info.wordCount + ' 詞</span>' +
      '</button>';
  });
  html += '</div>';
  inner.innerHTML = html;
}

/* ── 課次選擇頁 ── */
function selectGrade(grade) {
  currentGrade = grade;

  var lessonMap = {};
  Object.keys(_allByGL).forEach(function(gl) {
    var sep   = gl.indexOf('_');
    if (gl.substring(0, sep) !== grade) return;
    var lesson = gl.substring(sep + 1);
    lessonMap[lesson] = (_allByGL[gl] || []).length;
  });

  var lessons = Object.keys(lessonMap).sort(function(a, b) {
    var na = _cnNum(a), nb = _cnNum(b);
    if (na !== null && nb !== null) return na - nb;
    return a.localeCompare(b, 'zh-TW');
  });

  var inner = document.querySelector('#page-lesson .wi-page-inner');
  if (!inner) { showPage('lesson'); return; }

  var html = '<div class="wi-page-title">' + _escHtml(grade) + '　選擇課次</div><div class="wi-btn-grid">';
  lessons.forEach(function(l) {
    html += '<button class="wi-select-btn" onclick="selectLesson(\'' + l + '\')">' +
      '第' + _escHtml(l) + '課' +
      '<span class="wi-btn-count">' + lessonMap[l] + ' 個詞語</span>' +
      '</button>';
  });
  html += '</div>';
  inner.innerHTML = html;
  showPage('lesson');
}

/* ── 模式選擇頁 ── */
function selectLesson(lesson) {
  currentLesson = lesson;
  var gl = currentGrade + '_' + lesson;
  wordImages = (_allByGL[gl] || []).slice();

  var titleEl = document.getElementById('mode-lesson-label');
  if (titleEl) titleEl.textContent =
    currentGrade + '　第' + lesson + '課　共 ' + wordImages.length + ' 個詞語';

  var quizCard  = document.getElementById('mode-card-quiz');
  var matchCard = document.getElementById('mode-card-match');
  if (quizCard)  quizCard.classList.toggle('disabled', wordImages.length < 2);
  if (matchCard) matchCard.classList.toggle('disabled', wordImages.length < 4);

  showPage('mode');
}

/* ── Helper ── */
function _cnNum(s) {
  var map = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,
    '十':10,'十一':11,'十二':12,'十三':13,'十四':14,'十五':15,'十六':16,'十七':17,'十八':18 };
  if (map[s] !== undefined) return map[s];
  var n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}
