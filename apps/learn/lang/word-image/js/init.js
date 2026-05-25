'use strict';

/* 課程詞語：依 gradeLesson 分組 */
var _allByGL = {}; // { 'grade_lesson': [{word, definition, imageUrl}] }

window.addEventListener('load', function() {
  initFirebase();
  applyTheme(currentTheme);

  PAGE_STACK = ['entry'];
  showPage('entry', false);

  (function waitDb() {
    if (!db) { setTimeout(waitDb, 200); return; }
    _loadAllImages();
    _autoLogin();
  })();
});

/* ── 從 Firestore 載入所有課程 wordImages ── */
/* Firestore 的 where('field', '==', null) 只比對欄位存在且為 null 的文件，
   不會比對欄位不存在的文件，所以改為 client-side 過濾。 */
function _loadAllImages() {
  db.collection('wordImages').get()
    .then(function(snap) {
      _allByGL = {};
      snap.forEach(function(doc) {
        var d = doc.data();
        if (d.customCategoryId) return;
        var gl = d.gradeLesson || (d.grade + '_' + d.lesson);
        if (!gl || gl === '_') return;
        if (!_allByGL[gl]) _allByGL[gl] = [];
        _allByGL[gl].push({
          word:       d.word       || '',
          definition: d.definition || '',
          imageUrl:   d.imageUrl   || ''
        });
      });
      _renderEntryPage();
    })
    .catch(function() {
      _renderEntryPage();
    });
}

/* ── 自動登入（由 hub 寫入 sessionStorage） ── */
function _autoLogin() {
  try {
    var saved = sessionStorage.getItem('hub_student');
    if (!saved) { _customCatsLoaded = true; return; }
    var hub = JSON.parse(saved);
    var id  = hub.id;

    /* ── 教師預覽模式（班級管理→學生視角）── */
    /* 預覽帳號 ID 以 __preview__ 開頭，Firestore 無對應文件 */
    if (hub.isPreview) {
      var previewClassIds = hub.classIds || [];
      currentStudent = {
        name:     hub.name     || hub.nickname || '老師',
        pin:      '',
        id:       id,
        nickname: hub.nickname || hub.name || '老師',
        avatar:   hub.avatar   || '👨‍🏫',
        classId:  previewClassIds[0] || ''
      };
      window.__studentRawData = { classIds: previewClassIds };
      wordProgress = {};
      var avEl0 = document.getElementById('topbar-avatar');
      var nmEl0 = document.getElementById('topbar-name');
      if (avEl0) avEl0.textContent = currentStudent.avatar;
      if (nmEl0) nmEl0.textContent = '[預覽] ' + (currentStudent.nickname || currentStudent.name);
      _loadCustomCategories(currentStudent.classId);
      return;
    }

    Promise.all([
      db.collection('students').doc(id).get(),
      db.collection('students').doc(id).collection('progress').doc('wordImage').get()
    ]).then(function(res) {
      var sDoc = res[0], pDoc = res[1];
      if (!sDoc.exists) { _customCatsLoaded = true; return; }
      var sData = sDoc.data();
      window.__studentRawData = sData; // 供 _loadCustomCategories 讀 classIds 陣列
      var primaryClassId = sData.classId || (sData.classIds && sData.classIds[0]) || '';
      currentStudent = {
        name:     hub.name,
        pin:      hub.pin,
        id:       id,
        nickname: sData.nickname || '',
        avatar:   sData.avatar   || '🐣',
        classId:  primaryClassId
      };
      wordProgress = (pDoc.exists && pDoc.data().words) ? pDoc.data().words : {};

      var avEl = document.getElementById('topbar-avatar');
      var nmEl = document.getElementById('topbar-name');
      if (avEl) avEl.textContent = currentStudent.avatar;
      if (nmEl) nmEl.textContent = currentStudent.nickname || currentStudent.name;
      showToast('👋 歡迎 ' + (currentStudent.nickname || currentStudent.name));

      _loadCustomCategories(currentStudent.classId);
    }).catch(function(e) { console.warn('autoLogin error:', e); });
  } catch(e) {}
}

/* ── 載入班級的自訂類別指派 ── */
/* 支援 classId（字串）與 classIds（陣列）兩種學生格式 */
var _customCatsLoaded = false;

function _loadCustomCategories(classId) {
  /* 收集學生所有班級 ID */
  var ids = [];
  if (classId) ids.push(classId);
  var sData = currentStudent && window.__studentRawData;
  if (sData && Array.isArray(sData.classIds)) {
    sData.classIds.forEach(function(cid) {
      if (cid && ids.indexOf(cid) === -1) ids.push(cid);
    });
  }
  if (!ids.length) { _customCatsLoaded = true; return; }

  /* 對每個班級分別查詢，合併結果 */
  var promises = ids.map(function(cid) {
    return db.collection('customCategoryAssignments').where('classId', '==', cid).get();
  });

  Promise.all(promises).then(function(snaps) {
    var catIds = [], seen = {};
    snaps.forEach(function(snap) {
      snap.forEach(function(doc) {
        var cid = doc.data().categoryId;
        if (cid && !seen[cid]) { seen[cid] = true; catIds.push(cid); }
      });
    });
    _rootCatIds = catIds;
    _customCatsLoaded = true;
    _renderEntryPage();
    /* 若學生已在自訂類別頁（根層），立即重繪 */
    if (PAGE_STACK[PAGE_STACK.length - 1] === 'custom-cat' && !currentCatId) {
      _renderCustomCatRoot();
    }
  }).catch(function(e) {
    _customCatsLoaded = true;
    console.warn('loadCustomCategories error:', e);
  });
}

/* ════════════════════════════
   頂層入口頁
   ════════════════════════════ */
function _renderEntryPage() {
  var inner = document.querySelector('#page-entry .wi-page-inner');
  if (!inner) return;

  inner.innerHTML =
    '<div class="wi-page-title" style="text-align:center;font-size:1.15rem;margin-bottom:24px">🖼️ 詞語趣</div>' +
    '<div class="wi-entry-cards">' +
      '<button class="wi-entry-card" onclick="enterCurriculum()">' +
        '<div class="wi-entry-icon">📚</div>' +
        '<div class="wi-entry-name">選擇課程</div>' +
        '<div class="wi-entry-desc">依年級和課次練習詞語</div>' +
      '</button>' +
      '<button class="wi-entry-card" onclick="enterCustom()">' +
        '<div class="wi-entry-icon">🗂</div>' +
        '<div class="wi-entry-name">自訂類別</div>' +
        '<div class="wi-entry-desc">老師自訂的詞語類別</div>' +
      '</button>' +
    '</div>';
}

/* ════════════════════════════
   課程入口
   ════════════════════════════ */
function enterCurriculum() {
  currentCatId   = '';
  currentCatPath = [];
  _renderGradePage();
  showPage('grade');
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
  currentLesson  = lesson;
  currentCatId   = '';  // 課程模式，清除自訂類別狀態
  currentCatPath = [];
  var gl = currentGrade + '_' + lesson;
  wordImages = (_allByGL[gl] || []).filter(function(w) { return w.imageUrl; });

  var titleEl = document.getElementById('mode-lesson-label');
  if (titleEl) titleEl.textContent =
    currentGrade + '　第' + lesson + '課　共 ' + wordImages.length + ' 個詞語';

  var quizCard  = document.getElementById('mode-card-quiz');
  var matchCard = document.getElementById('mode-card-match');
  if (quizCard)  quizCard.classList.toggle('disabled', wordImages.length < 2);
  if (matchCard) matchCard.classList.toggle('disabled', wordImages.length < 4);

  showPage('mode');
}

/* ════════════════════════════
   自訂類別入口
   ════════════════════════════ */
function enterCustom() {
  currentCatId   = '';
  currentCatPath = [];
  _renderCustomCatRoot();
  showPage('custom-cat');
}

/* ── 頂層類別列表 ── */
function _renderCustomCatRoot() {
  var inner = document.querySelector('#page-custom-cat .wi-page-inner');
  if (!inner) return;

  /* 查詢尚未完成：顯示 loading */
  if (!_customCatsLoaded) {
    inner.innerHTML =
      '<div class="wi-page-title">自訂類別</div>' +
      '<div class="loading-wrap"><div class="spinner"></div></div>';
    return;
  }

  if (!_rootCatIds.length) {
    inner.innerHTML =
      '<div class="wi-page-title">自訂類別</div>' +
      '<div class="wi-empty"><div class="wi-empty-icon">🗂</div>' +
      '<div class="wi-empty-text">老師尚未指派任何類別</div></div>';
    return;
  }

  inner.innerHTML =
    '<div class="wi-page-title">自訂類別</div>' +
    '<div class="loading-wrap"><div class="spinner"></div></div>';

  var promises = _rootCatIds.map(function(catId) {
    return db.collection('customCategories').doc(catId).get();
  });

  Promise.all(promises).then(function(docs) {
    var cats = [];
    docs.forEach(function(doc) {
      if (doc.exists) {
        cats.push({ id: doc.id, name: doc.data().name || '' });
      }
    });
    cats.sort(function(a, b) { return a.name.localeCompare(b.name, 'zh-TW'); });

    var html = '<div class="wi-page-title">自訂類別</div><div class="wi-btn-grid">';
    cats.forEach(function(cat) {
      html += '<button class="wi-select-btn" onclick="enterCatNode(\'' +
        _escAttr(cat.id) + '\',\'' + _escAttr(cat.name) + '\')">' +
        _escHtml(cat.name) + '</button>';
    });
    html += '</div>';
    inner.innerHTML = html;
  }).catch(function() {
    inner.innerHTML =
      '<div class="wi-page-title">自訂類別</div>' +
      '<div class="wi-empty"><div class="wi-empty-text">載入失敗，請重新整理</div></div>';
  });
}

/* ── 進入類別節點 ── */
function enterCatNode(catId, catName) {
  currentCatPath.push({ id: catId, name: catName });
  currentCatId = catId;
  _renderCatNode();
  showPage('custom-cat', false); // 不推入堆疊，留在 custom-cat 頁
}

/* ── 渲染節點（子類別 + 詞語 + 模式按鈕）── */
function _renderCatNode() {
  var inner = document.querySelector('#page-custom-cat .wi-page-inner');
  if (!inner) return;
  inner.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  var catId = currentCatId;

  Promise.all([
    db.collection('customCategories').where('parentId', '==', catId).get(),
    db.collection('wordImages').where('customCategoryId', '==', catId).get()
  ]).then(function(results) {
    var children = [];
    results[0].forEach(function(doc) {
      children.push({ id: doc.id, name: doc.data().name || '' });
    });
    children.sort(function(a, b) { return a.name.localeCompare(b.name, 'zh-TW'); });

    var words = [];
    results[1].forEach(function(doc) {
      var d = doc.data();
      if (d.word && d.imageUrl) {
        words.push({ word: d.word, definition: d.definition || '', imageUrl: d.imageUrl });
      }
    });

    /* 麵包屑 */
    var bcHtml = currentCatPath.map(function(p, i) {
      if (i < currentCatPath.length - 1) {
        return '<button class="wi-cat-bc-btn" onclick="catJumpTo(' + i + ')">' +
          _escHtml(p.name) + '</button>';
      }
      return '<span class="wi-cat-bc-curr">' + _escHtml(p.name) + '</span>';
    }).join('<span class="wi-cat-bc-sep">›</span>');

    var html = '<div class="wi-cat-bc">' + bcHtml + '</div>';

    /* 子類別 */
    if (children.length) {
      html += '<div class="wi-page-title" style="font-size:.88rem;margin:14px 0 8px;color:var(--muted)">子類別</div>' +
        '<div class="wi-btn-grid" style="margin-bottom:20px">';
      children.forEach(function(c) {
        html += '<button class="wi-select-btn" onclick="enterCatNode(\'' +
          _escAttr(c.id) + '\',\'' + _escAttr(c.name) + '\')">' +
          _escHtml(c.name) + '</button>';
      });
      html += '</div>';
    }

    /* 詞語 + 模式按鈕 */
    if (words.length) {
      wordImages = words;
      currentCatId = catId; // 確保 progress key 正確

      html += '<div class="wi-page-title" style="font-size:.88rem;margin:0 0 12px;color:var(--muted)">' +
        '詞語（' + words.length + '）</div>';

      html += '<div class="wi-mode-cards">' +
        '<button class="wi-mode-card" onclick="startBrowse()">' +
          '<div class="wi-mode-icon">🃏</div>' +
          '<div class="wi-mode-name">圖卡瀏覽</div>' +
          '<div class="wi-mode-desc">逐張翻閱圖片與詞語</div>' +
        '</button>';
      if (words.length >= 2) {
        html += '<button class="wi-mode-card" onclick="startQuiz()">' +
          '<div class="wi-mode-icon">🎯</div>' +
          '<div class="wi-mode-name">看圖猜詞</div>' +
          '<div class="wi-mode-desc">看圖片選出正確詞語</div>' +
          '</button>';
      }
      html += '</div>';
    } else if (!children.length) {
      html += '<div class="wi-empty" style="padding:24px 0">' +
        '<div class="wi-empty-text">此類別尚無詞語（含圖片）</div></div>';
    }

    inner.innerHTML = html;

  }).catch(function() {
    inner.innerHTML =
      '<div class="wi-empty"><div class="wi-empty-text">載入失敗，請重新整理</div></div>';
  });
}

/* ── 麵包屑跳轉 ── */
function catJumpTo(idx) {
  currentCatPath = currentCatPath.slice(0, idx + 1);
  currentCatId   = currentCatPath[currentCatPath.length - 1].id;
  _renderCatNode();
  showPage('custom-cat', false);
}

/* ── Helper ── */
function _cnNum(s) {
  var map = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,
    '十':10,'十一':11,'十二':12,'十三':13,'十四':14,'十五':15,'十六':16,'十七':17,'十八':18 };
  if (map[s] !== undefined) return map[s];
  var n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}
