/**
 * admin/word-image.js — 詞語圖庫管理
 * 分為「選擇課程」（部定版本）與「自訂類別」（教師自建）兩個模式
 * 依賴：shared.js（db、showToast）、init.js（currentTeacher）
 */
'use strict';

/* ══ 共用上傳狀態 ══ */
var _wiUploadIdx   = -1;
var _wiPendingBlob = null;

/* ══ 課程模式狀態 ══ */
var _wiGrade      = '';
var _wiLesson     = '';
var _wiLessonName = '';
var _wiGradeList   = [];
var _wiLessonList  = [];
var _wiLessonNames = {};
var _wiWordList  = [];
var _wiImageMap  = {};  // { word: {docId, imageUrl} }

/* ══ 模式切換 ══ */
var _wiMode      = 'curriculum'; // 'curriculum' | 'custom'
var _wiUploadCtx = 'curriculum'; // 'curriculum' | 'custom'

/* ══ 自訂類別狀態 ══ */
var _wiCatPath    = []; // [{id, name}]
var _wiCatId      = '';
var _wiCatWords   = [];
var _wiCatWordMap = {}; // { word: {docId, imageUrl} }
var _wiCatUploadIdx = -1;

/* ══ 指派 modal 狀態 ══ */
var _wiAssignCatId   = '';
var _wiAssignClasses = [];
var _wiAssignChecked = {}; // { classId: assignmentDocId | true }

/* ══ 批次匯入狀態 ══ */
var _wiBatchParsed = []; // [{word, definition}]

/* ════════════════════════════
   進入點（由 switchTab 呼叫）
   ════════════════════════════ */
function loadWordImageTab() {
  if (!db || !currentTeacher) { setTimeout(loadWordImageTab, 300); return; }
  _wiGrade = ''; _wiLesson = '';
  _wiCatPath = []; _wiCatId = '';
  _wiRenderModeBar();
}

/* ════════════════════════════
   模式列
   ════════════════════════════ */
function _wiRenderModeBar() {
  var wrap = document.getElementById('wi-main');
  if (!wrap) return;
  wrap.innerHTML =
    '<div class="wi-mode-bar">' +
      '<button class="wi-mode-tab' + (_wiMode === 'curriculum' ? ' active' : '') +
        '" onclick="_wiSetMode(\'curriculum\')">📚 選擇課程</button>' +
      '<button class="wi-mode-tab' + (_wiMode === 'custom' ? ' active' : '') +
        '" onclick="_wiSetMode(\'custom\')">🗂 自訂類別</button>' +
    '</div>' +
    '<div id="wi-mode-body"></div>';
  if (_wiMode === 'curriculum') _wiRenderGradeSelector();
  else _wiCatRenderRoot();
}

function _wiSetMode(mode) {
  _wiMode = mode;
  if (mode === 'curriculum') { _wiGrade = ''; _wiLesson = ''; }
  else { _wiCatPath = []; _wiCatId = ''; }
  _wiRenderModeBar();
}

/* ════════════════════════════
   課程模式 Step 1：年級選擇
   ════════════════════════════ */
function _wiRenderGradeSelector() {
  var wrap = document.getElementById('wi-mode-body');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  var uid = currentTeacher.uid;
  Promise.all([
    db.collection('questions').where('teacherUid', '==', uid).get(),
    db.collection('questions').where('teacherUid', '==', 'shared').get()
  ]).then(function(results) {
    var gradeSet = {};
    results.forEach(function(snap) {
      snap.forEach(function(d) {
        var data = d.data();
        if (data.type === '詞語解釋' && data.grade) gradeSet[data.grade] = true;
      });
    });
    _wiGradeList = Object.keys(gradeSet).sort();
    if (!_wiGradeList.length) {
      wrap.innerHTML = '<p style="color:var(--muted);padding:20px 0;font-size:.9rem">' +
        '題庫中尚無「詞語解釋」題型，請先上傳題庫。</p>';
      return;
    }
    var html = '<div class="card-title" style="margin-bottom:14px">選擇年級</div>' +
      '<div class="wi-btn-grid">';
    _wiGradeList.forEach(function(g, i) {
      html += '<button class="wi-grade-btn" onclick="_wiSelectGrade(' + i + ')">' +
        _wiEsc(g) + '</button>';
    });
    html += '</div>';
    wrap.innerHTML = html;
  }).catch(function(e) {
    wrap.innerHTML = '<p style="color:var(--red)">載入失敗：' + e.message + '</p>';
  });
}

/* ════════════════════════════
   課程模式 Step 2：課次選擇
   ════════════════════════════ */
function _wiSelectGrade(idx) {
  _wiGrade = _wiGradeList[idx] || _wiGrade;
  if (!_wiGrade) return;

  var wrap = document.getElementById('wi-mode-body');
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  var uid = currentTeacher.uid;
  Promise.all([
    db.collection('questions').where('teacherUid', '==', uid).get(),
    db.collection('questions').where('teacherUid', '==', 'shared').get()
  ]).then(function(results) {
    var lessonMap = {};
    results.forEach(function(snap) {
      snap.forEach(function(d) {
        var data = d.data();
        if (data.grade === _wiGrade && data.type === '詞語解釋' && data.lesson) {
          if (!lessonMap[data.lesson]) lessonMap[data.lesson] = data.lessonName || '';
        }
      });
    });

    _wiLessonList = Object.keys(lessonMap).sort(function(a, b) {
      var na = _wiCnNum(a), nb = _wiCnNum(b);
      if (na !== null && nb !== null) return na - nb;
      return a.localeCompare(b, 'zh-TW');
    });
    _wiLessonNames = lessonMap;

    if (!_wiLessonList.length) {
      wrap.innerHTML =
        '<button class="wi-back-btn" onclick="_wiRenderGradeSelector()">← 返回年級</button>' +
        '<p style="color:var(--muted);padding:16px 0;font-size:.88rem">此年級尚無詞語解釋題目</p>';
      return;
    }
    _wiRenderLessonPage();
  }).catch(function(e) {
    wrap.innerHTML = '<p style="color:var(--red)">載入失敗：' + e.message + '</p>';
  });
}

function _wiRenderLessonPage() {
  var wrap = document.getElementById('wi-mode-body');
  var html = '<button class="wi-back-btn" onclick="_wiRenderGradeSelector()">← 返回年級</button>' +
    '<div class="card-title" style="margin:12px 0 14px">' + _wiEsc(_wiGrade) + '　選擇課次</div>' +
    '<div class="wi-btn-grid">';
  _wiLessonList.forEach(function(l, i) {
    var name = _wiLessonNames[l] ? '　' + _wiLessonNames[l] : '';
    html += '<button class="wi-grade-btn" onclick="_wiSelectLesson(' + i + ')">' +
      '第' + _wiEsc(l) + '課' + _wiEsc(name) + '</button>';
  });
  html += '</div>';
  wrap.innerHTML = html;
}

/* ════════════════════════════
   課程模式 Step 3：詞語圖片管理
   ════════════════════════════ */
function _wiSelectLesson(idx) {
  _wiLesson     = _wiLessonList[idx] || _wiLesson;
  _wiLessonName = _wiLessonNames[_wiLesson] || '';
  if (!_wiLesson) return;

  var wrap        = document.getElementById('wi-mode-body');
  var gradeLesson = _wiGrade + '_' + _wiLesson;
  wrap.innerHTML  = '<div class="loading-wrap"><div class="spinner"></div></div>';

  var uid = currentTeacher.uid;
  Promise.all([
    db.collection('questions').where('teacherUid', '==', uid).get(),
    db.collection('questions').where('teacherUid', '==', 'shared').get(),
    db.collection('wordImages').where('gradeLesson', '==', gradeLesson).get()
  ]).then(function(results) {
    var wordMap = {};
    [results[0], results[1]].forEach(function(snap) {
      snap.forEach(function(d) {
        var data = d.data();
        if (data.grade === _wiGrade && data.lesson === _wiLesson && data.type === '詞語解釋') {
          if (!wordMap[data.answer]) wordMap[data.answer] = data.question || '';
        }
      });
    });
    _wiWordList = Object.keys(wordMap).map(function(w) {
      return { word: w, definition: wordMap[w] };
    });

    _wiImageMap = {};
    results[2].forEach(function(doc) {
      var d = doc.data();
      _wiImageMap[d.word] = { docId: doc.id, imageUrl: d.imageUrl || '' };
    });

    _wiRenderWordGrid();
  }).catch(function(e) {
    wrap.innerHTML = '<p style="color:var(--red)">載入失敗：' + e.message + '</p>';
  });
}

function _wiRenderWordGrid() {
  var wrap  = document.getElementById('wi-mode-body');
  var title = _wiGrade + '　第' + _wiLesson + '課' +
    (_wiLessonName ? '　' + _wiLessonName : '');
  var hasImg = Object.keys(_wiImageMap).length;
  var total  = _wiWordList.length;

  var html =
    '<button class="wi-back-btn" onclick="_wiRenderLessonPage()">← 返回課次</button>' +
    '<div style="display:flex;align-items:center;gap:12px;margin:12px 0 16px;flex-wrap:wrap">' +
      '<div class="card-title" style="margin:0">' + _wiEsc(title) + '</div>' +
      '<span style="font-size:.82rem;font-weight:700;color:var(--muted)">' +
        hasImg + ' / ' + total + ' 已上傳圖片</span>' +
    '</div>' +
    '<div class="wi-word-grid">';

  _wiWordList.forEach(function(item, i) {
    var img      = _wiImageMap[item.word];
    var hasImage = !!(img && img.imageUrl);

    html += '<div class="wi-word-card">';
    if (hasImage) {
      html += '<div class="wi-img-wrap" onclick="_wiOpenUpload(' + i + ')">' +
        '<img src="' + _wiEscAttr(img.imageUrl) + '" alt="">' +
        '<div class="wi-img-overlay"><span>更換圖片</span></div>' +
        '</div>';
    } else {
      html += '<div class="wi-img-empty" onclick="_wiOpenUpload(' + i + ')">' +
        '<div class="wi-img-empty-icon">📷</div>' +
        '<div style="font-size:.72rem;color:var(--muted);font-weight:700">點此上傳</div>' +
        '</div>';
    }
    html +=
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px 4px">' +
        '<span style="font-size:.95rem;font-weight:900;color:var(--text)">' + _wiEsc(item.word) + '</span>' +
        '<button class="wi-search-btn" onclick="event.stopPropagation();_wiOpenGoogleSearch(' + i + ')">搜圖</button>' +
      '</div>' +
      '<div class="wi-def-label">' + _wiEsc(item.definition) + '</div>';
    if (hasImage) {
      html += '<button class="wi-del-btn" onclick="event.stopPropagation();_wiDeleteImage(' + i + ')">' +
        '刪除圖片</button>';
    }
    html += '</div>';
  });
  html += '</div>';
  wrap.innerHTML = html;
}

/* ════════════════════════════
   上傳 Modal（課程 / 自訂共用）
   ════════════════════════════ */
function _wiOpenUpload(wordIdx) {
  _wiUploadCtx   = 'curriculum';
  _wiUploadIdx   = wordIdx;
  _wiPendingBlob = null;

  var item = _wiWordList[wordIdx];
  if (!item) return;

  document.getElementById('wi-modal-title').textContent = '上傳圖片：' + item.word;
  _wiResetModal();
  document.getElementById('wi-upload-modal').style.display = 'flex';
  setTimeout(function() {
    var area = document.getElementById('wi-paste-area');
    if (area) area.focus();
  }, 80);
}

function _wiCloseUpload() {
  var modal = document.getElementById('wi-upload-modal');
  if (modal) modal.style.display = 'none';
  _wiPendingBlob = null;
}

function _wiResetModal() {
  var previewImg = document.getElementById('wi-preview-img');
  var pasteHint  = document.getElementById('wi-paste-hint');
  var confirmBtn = document.getElementById('wi-confirm-btn');
  var sizeWarn   = document.getElementById('wi-size-warn');
  if (previewImg) { previewImg.style.display = 'none'; previewImg.src = ''; }
  if (pasteHint)  pasteHint.style.display = '';
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '確認上傳'; }
  if (sizeWarn)   sizeWarn.style.display = 'none';
}

/* ── 貼上（document 層級監聽） ── */
document.addEventListener('paste', function(e) {
  var modal = document.getElementById('wi-upload-modal');
  if (!modal || modal.style.display !== 'flex') return;
  var items = (e.clipboardData || {}).items || [];
  for (var i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      e.preventDefault();
      var blob = items[i].getAsFile();
      if (blob) _wiShowPreview(blob);
      return;
    }
  }
});

/* ── 拖放 ── */
function _wiHandleDrop(e) {
  e.preventDefault();
  e.currentTarget.style.borderColor = '';
  var files = e.dataTransfer && e.dataTransfer.files;
  if (files && files[0] && files[0].type.indexOf('image') !== -1) {
    _wiShowPreview(files[0]);
  }
}

/* ── 選擇檔案 ── */
function _wiFileSelected(input) {
  if (input.files[0]) _wiShowPreview(input.files[0]);
}

function _wiShowPreview(blob) {
  _wiPendingBlob = blob;
  var url = URL.createObjectURL(blob);
  var previewImg = document.getElementById('wi-preview-img');
  var pasteHint  = document.getElementById('wi-paste-hint');
  var confirmBtn = document.getElementById('wi-confirm-btn');
  var sizeWarn   = document.getElementById('wi-size-warn');
  if (previewImg) {
    previewImg.onload = function() { URL.revokeObjectURL(url); };
    previewImg.src = url;
    previewImg.style.display = 'block';
  }
  if (pasteHint)  pasteHint.style.display  = 'none';
  if (confirmBtn) confirmBtn.disabled = false;
  if (sizeWarn)   sizeWarn.style.display   = 'none';
}

/* ════════════════════════════
   壓縮 → base64 → Firestore（分課程 / 自訂兩路）
   ════════════════════════════ */
function _wiConfirmUpload() {
  if (_wiUploadCtx === 'custom') { _wiCatConfirmUpload(); return; }
  if (!_wiPendingBlob || _wiUploadIdx < 0) return;

  var confirmBtn = document.getElementById('wi-confirm-btn');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '處理中…'; }

  var item = _wiWordList[_wiUploadIdx];
  if (!item) return;

  _wiCompressToDataUrl(_wiPendingBlob, 800, 0.82, function(dataUrl) {
    var sizeKB = Math.round(dataUrl.length / 1024);
    if (sizeKB > 900) {
      var sizeWarn = document.getElementById('wi-size-warn');
      if (sizeWarn) {
        sizeWarn.textContent = '⚠️ 圖片壓縮後約 ' + sizeKB + ' KB，可能超出 Firestore 限制，建議使用較小的圖片。';
        sizeWarn.style.display = '';
      }
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = '確認上傳'; }
      return;
    }

    var docData = {
      word:        item.word,
      definition:  item.definition,
      imageUrl:    dataUrl,
      grade:       _wiGrade,
      lesson:      _wiLesson,
      lessonName:  _wiLessonName,
      gradeLesson: _wiGrade + '_' + _wiLesson,
      teacherUid:  currentTeacher.uid,
      uploadedAt:  new Date().toISOString()
    };

    var existing = _wiImageMap[item.word];
    var promise  = existing && existing.docId
      ? db.collection('wordImages').doc(existing.docId).set(docData)
      : db.collection('wordImages').add(docData);

    promise.then(function() {
      showToast('✅ 圖片已儲存：' + item.word);
      _wiCloseUpload();
      var idx = _wiLessonList.indexOf(_wiLesson);
      _wiSelectLesson(idx >= 0 ? idx : 0);
    }).catch(function(e) {
      showToast('❌ 儲存失敗：' + e.message);
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = '確認上傳'; }
    });
  });
}

/* ════════════════════════════
   課程：刪除圖片
   ════════════════════════════ */
function _wiDeleteImage(wordIdx) {
  var item = _wiWordList[wordIdx];
  if (!item) return;
  var img = _wiImageMap[item.word];
  if (!img || !img.docId) return;
  if (!confirm('確定要刪除「' + item.word + '」的圖片嗎？')) return;

  db.collection('wordImages').doc(img.docId).delete()
    .then(function() {
      showToast('已刪除「' + item.word + '」的圖片');
      var idx = _wiLessonList.indexOf(_wiLesson);
      _wiSelectLesson(idx >= 0 ? idx : 0);
    })
    .catch(function(e) { showToast('❌ 刪除失敗：' + e.message); });
}

/* ════════════════════════════
   搜圖（課程）
   ════════════════════════════ */
function _wiOpenGoogleSearch(wordIdx) {
  var item = _wiWordList[wordIdx];
  if (!item) return;
  window.open('https://www.google.com/search?q=' + encodeURIComponent(item.word) + '&tbm=isch', '_blank');
}

/* ════════════════════════════
   Canvas 壓縮
   ════════════════════════════ */
function _wiCompressToDataUrl(blob, maxPx, quality, callback) {
  var img = new Image();
  var url = URL.createObjectURL(blob);
  img.onload = function() {
    URL.revokeObjectURL(url);
    var w = img.naturalWidth, h = img.naturalHeight;
    if (w > maxPx || h > maxPx) {
      var scale = maxPx / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    callback(canvas.toDataURL('image/jpeg', quality));
  };
  img.onerror = function() {
    var reader = new FileReader();
    reader.onload = function(e) { callback(e.target.result); };
    reader.readAsDataURL(blob);
  };
  img.src = url;
}

/* ════════════════════════════════════════════
   自訂類別模式
   ════════════════════════════════════════════ */

/* ── 根節點列表 ── */
function _wiCatRenderRoot() {
  var body = document.getElementById('wi-mode-body');
  if (!body) return;
  body.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  db.collection('customCategories')
    .where('teacherUid', '==', currentTeacher.uid)
    .where('parentId', '==', null)
    .get()
    .then(function(snap) {
      var cats = [];
      snap.forEach(function(doc) {
        var d = doc.data();
        cats.push({ id: doc.id, name: d.name, createdAt: d.createdAt || '' });
      });
      cats.sort(function(a, b) { return a.createdAt.localeCompare(b.createdAt); });

      var html =
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
          '<div class="card-title" style="margin:0">🗂 自訂類別</div>' +
          '<button class="wi-cat-add-btn" onclick="_wiCatAddRoot()">＋ 新增類別</button>' +
        '</div>';

      if (!cats.length) {
        html += '<div class="wi-cat-empty">尚未建立任何類別。點擊「＋ 新增類別」開始建立。</div>';
      } else {
        html += '<div class="wi-cat-list">';
        cats.forEach(function(cat) {
          html += '<div class="wi-cat-item">' +
            '<span class="wi-cat-item-name">' + _wiEsc(cat.name) + '</span>' +
            '<div class="wi-cat-item-btns">' +
              '<button class="wi-cat-assign-btn" ' +
                'onclick="_wiCatOpenAssign(\'' + cat.id + '\',\'' + _wiEscAttr(cat.name) + '\')">' +
                '📋 指派班級</button>' +
              '<button class="wi-cat-enter-btn" ' +
                'onclick="_wiCatEnter(\'' + cat.id + '\',\'' + _wiEscAttr(cat.name) + '\')">' +
                '進入 →</button>' +
              '<button class="wi-cat-del-icon" title="刪除類別" ' +
                'onclick="_wiCatDeleteRoot(\'' + cat.id + '\',\'' + _wiEscAttr(cat.name) + '\')">🗑</button>' +
            '</div>' +
          '</div>';
        });
        html += '</div>';
      }

      body.innerHTML = html;
    })
    .catch(function(e) {
      body.innerHTML = '<p style="color:var(--red)">載入失敗：' + e.message + '</p>';
    });
}

/* ── 進入節點 ── */
function _wiCatEnter(catId, catName) {
  _wiCatPath.push({ id: catId, name: catName });
  _wiCatId = catId;
  _wiCatRenderNode();
}

function _wiCatRenderNode() {
  var body = document.getElementById('wi-mode-body');
  if (!body) return;
  body.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  var catId = _wiCatId;
  Promise.all([
    db.collection('customCategories')
      .where('teacherUid', '==', currentTeacher.uid)
      .where('parentId', '==', catId)
      .get(),
    db.collection('wordImages')
      .where('customCategoryId', '==', catId)
      .get()
  ]).then(function(results) {
    var children = [];
    results[0].forEach(function(doc) {
      var d = doc.data();
      children.push({ id: doc.id, name: d.name, createdAt: d.createdAt || '' });
    });
    children.sort(function(a, b) { return a.createdAt.localeCompare(b.createdAt); });

    _wiCatWords = [];
    _wiCatWordMap = {};
    results[1].forEach(function(doc) {
      var d = doc.data();
      if (d.word) {
        _wiCatWords.push({ word: d.word, definition: d.definition || '' });
        _wiCatWordMap[d.word] = { docId: doc.id, imageUrl: d.imageUrl || '' };
      }
    });

    /* 麵包屑 */
    var bcHtml = _wiCatPath.map(function(p, i) {
      if (i < _wiCatPath.length - 1) {
        return '<button class="wi-cat-bc-btn" onclick="_wiCatJumpTo(' + i + ')">' +
          _wiEsc(p.name) + '</button>';
      }
      return '<span class="wi-cat-bc-curr">' + _wiEsc(p.name) + '</span>';
    }).join('<span class="wi-cat-bc-sep">›</span>');

    var isRoot = (_wiCatPath.length === 1);

    var html = '<button class="wi-back-btn" onclick="_wiCatGoBack()">← 返回</button>' +
      '<div class="wi-cat-breadcrumb">' + bcHtml + '</div>';

    if (isRoot) {
      html += '<button class="wi-cat-assign-btn" style="margin-bottom:14px" ' +
        'onclick="_wiCatOpenAssign(\'' + catId + '\',\'' + _wiEscAttr(_wiCatPath[0].name) + '\')">' +
        '📋 指派給班級</button>';
    }

    /* 子類別區 */
    html += '<div class="wi-cat-section">' +
      '<div class="wi-cat-section-hd">' +
        '<span class="wi-cat-section-title">子類別</span>' +
        '<button class="wi-cat-add-btn" onclick="_wiCatAddChild(\'' + catId + '\')">＋ 新增子類別</button>' +
      '</div>';

    if (!children.length) {
      html += '<div class="wi-cat-empty" style="font-size:.82rem">尚無子類別</div>';
    } else {
      html += '<div class="wi-cat-list">';
      children.forEach(function(c) {
        html += '<div class="wi-cat-item">' +
          '<span class="wi-cat-item-name">' + _wiEsc(c.name) + '</span>' +
          '<div class="wi-cat-item-btns">' +
            '<button class="wi-cat-enter-btn" ' +
              'onclick="_wiCatEnter(\'' + c.id + '\',\'' + _wiEscAttr(c.name) + '\')">' +
              '進入 →</button>' +
            '<button class="wi-cat-del-icon" title="刪除" ' +
              'onclick="_wiCatDeleteNode(\'' + c.id + '\',\'' + _wiEscAttr(c.name) + '\')">🗑</button>' +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    }
    html += '</div>';

    /* 詞語區 */
    html += '<div class="wi-cat-section">' +
      '<div class="wi-cat-section-hd">' +
        '<span class="wi-cat-section-title">詞語（' + _wiCatWords.length + '）</span>' +
        '<div style="display:flex;gap:6px">' +
          '<button class="wi-cat-add-btn" onclick="_wiCatOpenAddWord()">＋ 新增</button>' +
          '<button class="wi-cat-add-btn" onclick="_wiCatOpenBatchWord()">📋 批次匯入</button>' +
        '</div>' +
      '</div>';

    if (!_wiCatWords.length) {
      html += '<div class="wi-cat-empty" style="font-size:.82rem">此層尚無詞語</div>';
    } else {
      html += '<div class="wi-word-grid">';
      _wiCatWords.forEach(function(item, i) {
        var img = _wiCatWordMap[item.word];
        var hasImage = !!(img && img.imageUrl);
        html += '<div class="wi-word-card">';
        if (hasImage) {
          html += '<div class="wi-img-wrap" onclick="_wiCatOpenUpload(' + i + ')">' +
            '<img src="' + _wiEscAttr(img.imageUrl) + '" alt="">' +
            '<div class="wi-img-overlay"><span>更換圖片</span></div>' +
            '</div>';
        } else {
          html += '<div class="wi-img-empty" onclick="_wiCatOpenUpload(' + i + ')">' +
            '<div class="wi-img-empty-icon">📷</div>' +
            '<div style="font-size:.72rem;color:var(--muted);font-weight:700">點此上傳</div>' +
            '</div>';
        }
        html +=
          '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px 4px">' +
            '<span style="font-size:.95rem;font-weight:900;color:var(--text)">' + _wiEsc(item.word) + '</span>' +
            '<button class="wi-search-btn" onclick="event.stopPropagation();_wiCatGoogleSearch(' + i + ')">搜圖</button>' +
          '</div>' +
          '<div class="wi-def-label">' + _wiEsc(item.definition) + '</div>';
        if (hasImage) {
          html += '<button class="wi-del-btn" onclick="event.stopPropagation();_wiCatDeleteImg(' + i + ')">刪除圖片</button>';
        }
        html += '<button class="wi-cat-del-word-btn" onclick="event.stopPropagation();_wiCatDeleteWord(' + i + ')">刪除詞語</button>';
        html += '</div>';
      });
      html += '</div>';
    }
    html += '</div>';

    body.innerHTML = html;
  }).catch(function(e) {
    body.innerHTML = '<p style="color:var(--red)">載入失敗：' + e.message + '</p>';
  });
}

/* ── 麵包屑跳轉 ── */
function _wiCatJumpTo(idx) {
  _wiCatPath = _wiCatPath.slice(0, idx + 1);
  _wiCatId   = _wiCatPath[_wiCatPath.length - 1].id;
  _wiCatRenderNode();
}

function _wiCatGoBack() {
  _wiCatPath.pop();
  if (!_wiCatPath.length) {
    _wiCatId = '';
    _wiCatRenderRoot();
  } else {
    _wiCatId = _wiCatPath[_wiCatPath.length - 1].id;
    _wiCatRenderNode();
  }
}

/* ── 新增根類別 ── */
function _wiCatAddRoot() {
  var name = prompt('新類別名稱：');
  if (!name || !name.trim()) return;
  db.collection('customCategories').add({
    teacherUid: currentTeacher.uid,
    name:       name.trim(),
    parentId:   null,
    createdAt:  new Date().toISOString()
  }).then(function() {
    showToast('✅ 已新增類別：' + name.trim());
    _wiCatRenderRoot();
  }).catch(function(e) { showToast('❌ 新增失敗：' + e.message); });
}

/* ── 新增子類別 ── */
function _wiCatAddChild(parentId) {
  var name = prompt('新子類別名稱：');
  if (!name || !name.trim()) return;
  db.collection('customCategories').add({
    teacherUid: currentTeacher.uid,
    name:       name.trim(),
    parentId:   parentId,
    createdAt:  new Date().toISOString()
  }).then(function() {
    showToast('✅ 已新增子類別：' + name.trim());
    _wiCatRenderNode();
  }).catch(function(e) { showToast('❌ 新增失敗：' + e.message); });
}

/* ── 刪除根類別（含所有子孫）── */
function _wiCatDeleteRoot(catId, catName) {
  if (!confirm('確定要刪除類別「' + catName + '」及其所有子類別和詞語嗎？')) return;
  _wiCatCascadeDelete(catId)
    .then(function() {
      showToast('✅ 已刪除類別：' + catName);
      _wiCatRenderRoot();
    })
    .catch(function(e) { showToast('❌ 刪除失敗：' + e.message); });
}

/* ── 刪除節點（含所有子孫）── */
function _wiCatDeleteNode(catId, catName) {
  if (!confirm('確定要刪除「' + catName + '」及其所有子類別和詞語嗎？')) return;
  _wiCatCascadeDelete(catId)
    .then(function() {
      showToast('✅ 已刪除：' + catName);
      _wiCatRenderNode();
    })
    .catch(function(e) { showToast('❌ 刪除失敗：' + e.message); });
}

function _wiCatCascadeDelete(catId) {
  return Promise.all([
    db.collection('customCategories').where('parentId', '==', catId).get(),
    db.collection('wordImages').where('customCategoryId', '==', catId).get()
  ]).then(function(results) {
    var batch = db.batch();
    results[1].forEach(function(doc) { batch.delete(doc.ref); });
    batch.delete(db.collection('customCategories').doc(catId));
    var childPromises = [];
    results[0].forEach(function(doc) {
      childPromises.push(_wiCatCascadeDelete(doc.id));
    });
    return batch.commit().then(function() { return Promise.all(childPromises); });
  });
}

/* ── 新增詞語 modal ── */
function _wiCatOpenAddWord() {
  document.getElementById('wi-cat-word-input').value = '';
  document.getElementById('wi-cat-def-input').value  = '';
  document.getElementById('wi-cat-word-modal').style.display = 'flex';
  setTimeout(function() { document.getElementById('wi-cat-word-input').focus(); }, 80);
}

function _wiCatCloseWordModal() {
  document.getElementById('wi-cat-word-modal').style.display = 'none';
}

function _wiCatConfirmAddWord() {
  var word = (document.getElementById('wi-cat-word-input').value || '').trim();
  var def  = (document.getElementById('wi-cat-def-input').value  || '').trim();
  if (!word) { showToast('請輸入詞語'); return; }

  db.collection('wordImages').add({
    word:             word,
    definition:       def,
    imageUrl:         '',
    customCategoryId: _wiCatId,
    teacherUid:       currentTeacher.uid,
    uploadedAt:       new Date().toISOString()
  }).then(function() {
    showToast('✅ 已新增詞語：' + word);
    _wiCatCloseWordModal();
    _wiCatRenderNode();
  }).catch(function(e) { showToast('❌ 新增失敗：' + e.message); });
}

/* ── 自訂詞語：上傳圖片 ── */
function _wiCatOpenUpload(wordIdx) {
  _wiUploadCtx    = 'custom';
  _wiCatUploadIdx = wordIdx;
  _wiPendingBlob  = null;

  var item = _wiCatWords[wordIdx];
  if (!item) return;

  document.getElementById('wi-modal-title').textContent = '上傳圖片：' + item.word;
  _wiResetModal();
  document.getElementById('wi-upload-modal').style.display = 'flex';
  setTimeout(function() {
    var area = document.getElementById('wi-paste-area');
    if (area) area.focus();
  }, 80);
}

function _wiCatConfirmUpload() {
  if (!_wiPendingBlob) return;
  var confirmBtn = document.getElementById('wi-confirm-btn');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '處理中…'; }

  var item = _wiCatWords[_wiCatUploadIdx];
  if (!item) return;

  _wiCompressToDataUrl(_wiPendingBlob, 800, 0.82, function(dataUrl) {
    var sizeKB = Math.round(dataUrl.length / 1024);
    if (sizeKB > 900) {
      var sizeWarn = document.getElementById('wi-size-warn');
      if (sizeWarn) {
        sizeWarn.textContent = '⚠️ 圖片壓縮後約 ' + sizeKB + ' KB，可能超出 Firestore 限制。';
        sizeWarn.style.display = '';
      }
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = '確認上傳'; }
      return;
    }

    var existing = _wiCatWordMap[item.word];
    var docData  = {
      word:             item.word,
      definition:       item.definition,
      imageUrl:         dataUrl,
      customCategoryId: _wiCatId,
      teacherUid:       currentTeacher.uid,
      uploadedAt:       new Date().toISOString()
    };

    var promise = (existing && existing.docId)
      ? db.collection('wordImages').doc(existing.docId).set(docData)
      : db.collection('wordImages').add(docData);

    promise.then(function() {
      showToast('✅ 圖片已儲存：' + item.word);
      _wiCloseUpload();
      _wiCatRenderNode();
    }).catch(function(e) {
      showToast('❌ 儲存失敗：' + e.message);
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = '確認上傳'; }
    });
  });
}

/* ── 自訂詞語：刪除圖片（保留詞語文件）── */
function _wiCatDeleteImg(wordIdx) {
  var item = _wiCatWords[wordIdx];
  if (!item) return;
  var img = _wiCatWordMap[item.word];
  if (!img || !img.docId) return;
  if (!confirm('確定要刪除「' + item.word + '」的圖片嗎？')) return;
  db.collection('wordImages').doc(img.docId).update({ imageUrl: '' })
    .then(function() { showToast('已刪除圖片'); _wiCatRenderNode(); })
    .catch(function(e) { showToast('❌ 失敗：' + e.message); });
}

/* ── 自訂詞語：完整刪除詞語 ── */
function _wiCatDeleteWord(wordIdx) {
  var item = _wiCatWords[wordIdx];
  if (!item) return;
  if (!confirm('確定要完全刪除詞語「' + item.word + '」嗎？')) return;
  var img = _wiCatWordMap[item.word];
  var promise = (img && img.docId)
    ? db.collection('wordImages').doc(img.docId).delete()
    : Promise.resolve();
  promise.then(function() {
    showToast('已刪除詞語：' + item.word);
    _wiCatRenderNode();
  }).catch(function(e) { showToast('❌ 失敗：' + e.message); });
}

/* ════════════════════════════════════════════
   批次匯入詞語
   ════════════════════════════════════════════ */
function _wiCatOpenBatchWord() {
  _wiBatchParsed = [];
  var input   = document.getElementById('wi-cat-batch-input');
  var preview = document.getElementById('wi-cat-batch-preview');
  var btn     = document.getElementById('wi-cat-batch-confirm-btn');
  if (input)   input.value = '';
  if (preview) preview.innerHTML = '';
  if (btn)     { btn.disabled = true; btn.textContent = '確認匯入'; }
  document.getElementById('wi-cat-batch-modal').style.display = 'flex';
  setTimeout(function() { if (input) input.focus(); }, 80);
}

function _wiCatCloseBatchWord() {
  document.getElementById('wi-cat-batch-modal').style.display = 'none';
}

function _wiCatParseBatchInput() {
  var raw     = (document.getElementById('wi-cat-batch-input').value || '').trim();
  var preview = document.getElementById('wi-cat-batch-preview');
  var btn     = document.getElementById('wi-cat-batch-confirm-btn');

  if (!raw) {
    if (preview) preview.innerHTML = '';
    if (btn)     { btn.disabled = true; btn.textContent = '確認匯入'; }
    _wiBatchParsed = [];
    return;
  }

  var seen   = {};
  var parsed = [];
  raw.split('\n').forEach(function(line) {
    line = line.trim();
    if (!line) return;
    var word, def = '';
    var tabIdx = line.indexOf('\t');
    if (tabIdx !== -1) {
      word = line.substring(0, tabIdx).trim();
      def  = line.substring(tabIdx + 1).trim();
    } else {
      /* 支援半形逗號與全形逗號 */
      var ci = line.indexOf(',');
      var fi = line.indexOf('，');
      var sep = (ci !== -1 && fi !== -1) ? Math.min(ci, fi) : (ci !== -1 ? ci : fi);
      if (sep !== -1) {
        word = line.substring(0, sep).trim();
        def  = line.substring(sep + 1).trim();
      } else {
        word = line.trim();
      }
    }
    if (!word || seen[word]) return;
    seen[word] = true;
    parsed.push({ word: word, definition: def });
  });

  _wiBatchParsed = parsed;

  if (!parsed.length) {
    if (preview) preview.innerHTML =
      '<div style="color:var(--muted);font-size:.82rem;padding:8px 0">未能解析任何詞語</div>';
    if (btn) { btn.disabled = true; btn.textContent = '確認匯入'; }
    return;
  }

  var existing = _wiCatWordMap;
  var newCount = 0;
  parsed.forEach(function(p) { if (!existing[p.word]) newCount++; });

  if (btn) {
    btn.disabled  = (newCount === 0);
    btn.textContent = newCount > 0 ? '確認匯入 ' + newCount + ' 個' : '無新詞語可匯入';
  }

  var dupCount = parsed.length - newCount;
  var note = dupCount ? '，' + dupCount + ' 個已存在將跳過' : '';
  var html =
    '<div style="font-size:.78rem;font-weight:800;color:var(--muted);margin:10px 0 6px">' +
      '預覽（共 ' + parsed.length + ' 行' + note + '）' +
    '</div>' +
    '<div class="wi-batch-list">';
  parsed.forEach(function(item) {
    var isDup = !!existing[item.word];
    html += '<div class="wi-batch-row' + (isDup ? ' wi-batch-dup' : '') + '">' +
      '<span class="wi-batch-word">' + _wiEsc(item.word) + '</span>' +
      '<span class="wi-batch-def">' + (item.definition ? _wiEsc(item.definition) : '<em>（無解釋）</em>') + '</span>' +
      (isDup ? '<span class="wi-batch-tag">已存在</span>' : '') +
    '</div>';
  });
  html += '</div>';
  if (preview) preview.innerHTML = html;
}

function _wiCatConfirmBatch() {
  var toAdd = _wiBatchParsed.filter(function(item) { return !_wiCatWordMap[item.word]; });
  if (!toAdd.length) {
    showToast('所有詞語均已存在，無新詞語可匯入');
    _wiCatCloseBatchWord();
    return;
  }

  var btn = document.getElementById('wi-cat-batch-confirm-btn');
  if (btn) { btn.disabled = true; btn.textContent = '匯入中…'; }

  var catId    = _wiCatId;
  var promises = toAdd.map(function(item) {
    return db.collection('wordImages').add({
      word:             item.word,
      definition:       item.definition,
      imageUrl:         '',
      customCategoryId: catId,
      teacherUid:       currentTeacher.uid,
      uploadedAt:       new Date().toISOString()
    });
  });

  Promise.all(promises)
    .then(function() {
      var skipped = _wiBatchParsed.length - toAdd.length;
      var msg = '✅ 已匯入 ' + toAdd.length + ' 個詞語';
      if (skipped) msg += '（跳過 ' + skipped + ' 個重複）';
      showToast(msg);
      _wiCatCloseBatchWord();
      _wiCatRenderNode();
    })
    .catch(function(e) {
      showToast('❌ 匯入失敗：' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = '確認匯入'; }
    });
}

/* ── 搜圖 ── */
function _wiCatGoogleSearch(wordIdx) {
  var item = _wiCatWords[wordIdx];
  if (!item) return;
  window.open('https://www.google.com/search?q=' + encodeURIComponent(item.word) + '&tbm=isch', '_blank');
}

/* ════════════════════════════════════════════
   指派給班級 Modal
   ════════════════════════════════════════════ */
function _wiCatOpenAssign(catId, catName) {
  _wiAssignCatId = catId;
  document.getElementById('wi-cat-assign-title').textContent = '指派「' + catName + '」給班級';
  document.getElementById('wi-cat-assign-list').innerHTML =
    '<div class="loading-wrap"><div class="spinner"></div></div>';
  document.getElementById('wi-cat-assign-modal').style.display = 'flex';

  Promise.all([
    db.collection('classes').where('teacherUid', '==', currentTeacher.uid).get(),
    db.collection('customCategoryAssignments').where('categoryId', '==', catId).get()
  ]).then(function(results) {
    _wiAssignClasses = [];
    results[0].forEach(function(doc) {
      var d = doc.data();
      _wiAssignClasses.push({ id: doc.id, name: d.name || d.className || doc.id });
    });
    _wiAssignChecked = {};
    results[1].forEach(function(doc) {
      _wiAssignChecked[doc.data().classId] = doc.id;
    });

    var html = _wiAssignClasses.length
      ? _wiAssignClasses.map(function(cls) {
          var checked = !!_wiAssignChecked[cls.id];
          return '<label class="wi-assign-row">' +
            '<input type="checkbox" value="' + _wiEscAttr(cls.id) + '"' + (checked ? ' checked' : '') + '>' +
            '<span>' + _wiEsc(cls.name) + '</span>' +
            '</label>';
        }).join('')
      : '<div style="color:var(--muted);font-size:.88rem;padding:12px 0">尚未建立班級</div>';

    document.getElementById('wi-cat-assign-list').innerHTML = html;
  }).catch(function(e) {
    document.getElementById('wi-cat-assign-list').innerHTML =
      '<p style="color:var(--red)">載入失敗：' + e.message + '</p>';
  });
}

function _wiCatCloseAssign() {
  document.getElementById('wi-cat-assign-modal').style.display = 'none';
}

function _wiCatSaveAssign() {
  var catId     = _wiAssignCatId;
  var checkboxes = document.querySelectorAll('#wi-cat-assign-list input[type="checkbox"]');
  var toAdd = [], toRemove = [];

  checkboxes.forEach(function(cb) {
    var classId    = cb.value;
    var wasAssigned = !!_wiAssignChecked[classId];
    if (cb.checked && !wasAssigned) toAdd.push(classId);
    if (!cb.checked && wasAssigned) toRemove.push(classId);
  });

  var promises = [];
  toAdd.forEach(function(classId) {
    promises.push(db.collection('customCategoryAssignments').add({
      classId:    classId,
      categoryId: catId,
      teacherUid: currentTeacher.uid,
      assignedAt: new Date().toISOString()
    }));
  });
  toRemove.forEach(function(classId) {
    var docId = _wiAssignChecked[classId];
    if (typeof docId === 'string') {
      promises.push(db.collection('customCategoryAssignments').doc(docId).delete());
    }
  });

  Promise.all(promises)
    .then(function() { showToast('✅ 班級指派已更新'); _wiCatCloseAssign(); })
    .catch(function(e) { showToast('❌ 儲存失敗：' + e.message); });
}

/* ── 工具函式 ── */
function _wiEsc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function _wiEscAttr(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/"/g,'&quot;')
    .replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;');
}
function _wiCnNum(s) {
  var map = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,
    '十':10,'十一':11,'十二':12,'十三':13,'十四':14,'十五':15,'十六':16,'十七':17,'十八':18 };
  if (map[s] !== undefined) return map[s];
  var n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}
