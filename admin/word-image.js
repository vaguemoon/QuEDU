/**
 * admin/word-image.js — 詞語圖庫管理
 * 教師可為題庫中「詞語解釋」題型的詞語上傳對應圖片
 * 圖片壓縮為 base64 後直接存入 Firestore（無需 Firebase Storage）
 * 依賴：shared.js（db、showToast）、init.js（currentTeacher）
 */
'use strict';

/* ── 模組狀態 ── */
var _wiGrade      = '';
var _wiLesson     = '';
var _wiLessonName = '';

var _wiGradeList   = [];
var _wiLessonList  = [];
var _wiLessonNames = {};

var _wiWordList  = [];
var _wiImageMap  = {};  // { word: {docId, imageUrl} }

var _wiUploadIdx   = -1;
var _wiPendingBlob = null;

/* ════════════════════════════
   進入點（由 switchTab 呼叫）
   ════════════════════════════ */
function loadWordImageTab() {
  if (!db || !currentTeacher) { setTimeout(loadWordImageTab, 300); return; }
  _wiGrade = '';
  _wiLesson = '';
  _wiRenderGradeSelector();
}

/* ════════════════════════════
   Step 1：年級選擇
   ════════════════════════════ */
function _wiRenderGradeSelector() {
  var wrap = document.getElementById('wi-main');
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
    var html = '<div class="card-title" style="margin-bottom:14px">🖼️ 詞語圖庫　選擇年級</div>' +
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
   Step 2：課次選擇
   ════════════════════════════ */
function _wiSelectGrade(idx) {
  _wiGrade = _wiGradeList[idx] || _wiGrade;
  if (!_wiGrade) return;

  var wrap = document.getElementById('wi-main');
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
  var wrap = document.getElementById('wi-main');
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
   Step 3：詞語圖片管理
   ════════════════════════════ */
function _wiSelectLesson(idx) {
  _wiLesson     = _wiLessonList[idx] || _wiLesson;
  _wiLessonName = _wiLessonNames[_wiLesson] || '';
  if (!_wiLesson) return;

  var wrap        = document.getElementById('wi-main');
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
  var wrap  = document.getElementById('wi-main');
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
   上傳 Modal
   ════════════════════════════ */
function _wiOpenUpload(wordIdx) {
  _wiUploadIdx   = wordIdx;
  _wiPendingBlob = null;

  var item = _wiWordList[wordIdx];
  if (!item) return;

  document.getElementById('wi-modal-title').textContent = '上傳圖片：' + item.word;

  var previewImg = document.getElementById('wi-preview-img');
  var pasteHint  = document.getElementById('wi-paste-hint');
  var confirmBtn = document.getElementById('wi-confirm-btn');
  var sizeWarn   = document.getElementById('wi-size-warn');
  if (previewImg) { previewImg.style.display = 'none'; previewImg.src = ''; }
  if (pasteHint)  pasteHint.style.display = '';
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '確認上傳'; }
  if (sizeWarn)   sizeWarn.style.display = 'none';

  var modal = document.getElementById('wi-upload-modal');
  if (modal) modal.style.display = 'flex';

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

/* ── 貼上（document 層級監聽，僅 modal 開啟時生效）── */
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
  /* 先用原始 blob 產生預覽，確認畫面 */
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
   壓縮 → base64 → Firestore
   ════════════════════════════ */
function _wiConfirmUpload() {
  if (!_wiPendingBlob || _wiUploadIdx < 0) return;

  var confirmBtn = document.getElementById('wi-confirm-btn');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '處理中…'; }

  var item = _wiWordList[_wiUploadIdx];
  if (!item) return;

  _wiCompressToDataUrl(_wiPendingBlob, 800, 0.82, function(dataUrl) {
    /* 粗估 base64 大小（字元數 ≈ 位元組） */
    var sizeKB = Math.round(dataUrl.length / 1024);
    if (sizeKB > 900) {
      /* 超過 900 KB 警告（Firestore 文件上限 1 MB） */
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
   刪除圖片（只需刪 Firestore doc）
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
   Canvas 壓縮 → base64 data URL
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
    /* canvas 轉換失敗時退回直接讀取原始資料 */
    var reader = new FileReader();
    reader.onload = function(e) { callback(e.target.result); };
    reader.readAsDataURL(blob);
  };
  img.src = url;
}

/* ════════════════════════════
   搜圖功能
   ════════════════════════════ */
function _wiOpenGoogleSearch(wordIdx) {
  var item = _wiWordList[wordIdx];
  if (!item) return;
  window.open('https://www.google.com/search?q=' + encodeURIComponent(item.word) + '&tbm=isch', '_blank');
}


/* ── 工具函式 ── */
function _wiEsc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function _wiEscAttr(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/"/g,'&quot;')
    .replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function _wiCnNum(s) {
  var map = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,
    '十':10,'十一':11,'十二':12,'十三':13,'十四':14,'十五':15,'十六':16,'十七':17,'十八':18 };
  if (map[s] !== undefined) return map[s];
  var n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}
