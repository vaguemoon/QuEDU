/* ── 共用後台暗色模式設定 ── */
(function() {
  if (localStorage.getItem('admin-dark') === '1') document.body.classList.add('dark');
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'admin-dark') {
      document.body.classList.toggle('dark', e.data.dark);
    }
  });
})();

(function () {
'use strict';

/* ══ DOM ════════════════════════════════════════════════════ */
var fileInput       = document.getElementById('file-input');
var dropZone        = document.getElementById('drop-zone');
var convertBtn      = document.getElementById('convert-btn');
var manualBtn       = document.getElementById('manual-btn');
var procOverlay     = document.getElementById('proc-overlay');
var procMsg         = document.getElementById('proc-msg');
var readerContent   = document.getElementById('reader-content');
var docTitle        = document.getElementById('doc-title');
var statusBar       = document.getElementById('status-bar');
var voiceSelect     = document.getElementById('voice-select');
var rateVal         = document.getElementById('rate-val');
var fontVal         = document.getElementById('font-val');
var editDragHandle  = document.getElementById('edit-drag-handle');
var editPanel       = document.getElementById('edit-panel');
var editTextarea    = document.getElementById('edit-textarea');
var editToggleBtn   = document.getElementById('edit-toggle-btn');
var applyEditBtn    = document.getElementById('apply-edit-btn');
var cancelEditBtn   = document.getElementById('cancel-edit-btn');
var saveLibBtn      = document.getElementById('save-lib-btn');
var libraryContent  = document.getElementById('library-content');
var btnImportFiles  = document.getElementById('import-files-input');
var modalSave       = document.getElementById('modal-save');
var saveFilename    = document.getElementById('save-filename');
var saveGroup       = document.getElementById('save-group');
var groupDatalist   = document.getElementById('group-datalist');
var btnCancelSave   = document.getElementById('btn-cancel-save');
var btnConfirmSave  = document.getElementById('btn-confirm-save');
var modalEditItem   = document.getElementById('modal-edit-item');
var editItemTitle   = document.getElementById('edit-item-title');
var editItemGroup   = document.getElementById('edit-item-group');
var editItemGroups  = document.getElementById('edit-item-groups');
var btnCancelEditItem  = document.getElementById('btn-cancel-edit-item');
var btnConfirmEditItem = document.getElementById('btn-confirm-edit-item');
var loginBtn           = document.getElementById('login-btn');
var topbarBack      = document.getElementById('topbar-back');
var toast           = document.getElementById('toast');
var modalShare      = document.getElementById('modal-share');
var shareClassList  = document.getElementById('share-class-list');
var shareLoading    = document.getElementById('share-loading');
var btnCancelShare  = document.getElementById('btn-cancel-share');
var btnConfirmShare = document.getElementById('btn-confirm-share');
var studentDocList  = document.getElementById('student-doc-list');
var studentEmpty    = document.getElementById('student-empty');
var studentLoading  = document.getElementById('student-loading');

/* ══ Utils ══════════════════════════════════════════════════ */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ══ Student Mode URL Params ════════════════════════════════ */
var _urlParams      = new URLSearchParams(window.location.search);
var studentMode     = _urlParams.get('mode') === 'student';
var studentClassIds = (_urlParams.get('classIds') || _urlParams.get('classId') || '').split(',').filter(Boolean);

/* ══ State ══════════════════════════════════════════════════ */
var selectedFile    = null;
var voices          = [];
var isPlayingAll    = false;
var playAllIndex    = 0;
var currentDocName  = '有聲教材';
var currentPage     = 'upload';
var synth           = window.speechSynthesis;
var _editingFile           = null;  /* { name, title, group } */
var _editingLibraryEntry   = null;  /* entry being re-edited from library */
var rateValue       = 0.9;   /* 語速 */
var fontValue       = 17;    /* 字體 px */
var editIsFloat     = false; /* 編輯面板是否浮動 */
var _dragState      = null;  /* 浮動面板拖曳狀態 */

/* ══ Firebase ═══════════════════════════════════════════════ */
var fbApp  = null;
var fbAuth = null;
var fbDb   = null;
var currentUser = null;

var FB_CONFIG = {
  apiKey:            'AIzaSyBLhonzZkR1ORDPKgxmaVLFUwvPiEMpdj0',
  authDomain:        'tainping-hanzi-app.firebaseapp.com',
  projectId:         'tainping-hanzi-app',
  messagingSenderId: '158917910126',
  appId:             '1:158917910126:web:e52a1d0456d1fd4fe6907f'
};

(function initFB() {
  if (typeof firebase === 'undefined') { setTimeout(initFB, 150); return; }
  try {
    fbApp  = firebase.apps.length ? firebase.app() : firebase.initializeApp(FB_CONFIG);
    fbAuth = firebase.auth();
    fbDb   = firebase.firestore();
    fbAuth.onAuthStateChanged(async function(user) {
      var justLoggedIn = !currentUser && user;
      currentUser = user;
      updateLoginUI(user);
      if (user && justLoggedIn) {
        procMsg.textContent = '正在同步雲端報讀庫…';
        procOverlay.classList.add('show');
        try {
          await cloudSyncDown(user.uid);
        } catch(e) { /* silent */ }
        procOverlay.classList.remove('show');
      }
      if (user && currentPage === 'library') loadLibrary();
    });
  } catch(e) { console.error('Firebase init:', e); }
})();

function updateLoginUI(user) {
  if (user) {
    if (user.photoURL) {
      loginBtn.innerHTML = '<img src="' + user.photoURL + '"/> ' + (user.displayName || '老師').split(' ')[0];
    } else {
      loginBtn.textContent = '👤 ' + (user.displayName || '老師').split(' ')[0];
    }
    loginBtn.title = user.email + '\n點擊登出';
  } else {
    loginBtn.textContent = '☁️ 登入';
    loginBtn.title = '以 Google 帳號登入，啟用雲端報讀庫';
  }
}

loginBtn.addEventListener('click', function() {
  if (!fbAuth) { showToast('⚠️ Firebase 尚未初始化'); return; }
  if (currentUser) {
    if (confirm('確定要登出？\n' + currentUser.email)) fbAuth.signOut();
  } else {
    fbAuth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(function(e) {
      showToast('⚠️ 登入失敗：' + e.message);
    });
  }
});

/* ── Cloud helpers（純 Firestore，不需要 Storage）── */
function cloudRef(uid, filename) {
  return fbDb.collection('teachers').doc(uid)
    .collection('reader-library').doc(filename);
}

function cloudSave(uid, entry) {
  return cloudRef(uid, entry.name).set({
    name:  entry.name,
    title: entry.title,
    group: entry.group,
    date:  entry.date,
    html:  entry.html
  });
}

function cloudDelete(uid, filename) {
  return cloudRef(uid, filename).delete().catch(function() {});
}

async function cloudSyncDown(uid) {
  var snap = await fbDb.collection('teachers').doc(uid)
    .collection('reader-library').get();
  var ok = 0, fail = 0;
  var docs = snap.docs;
  for (var i = 0; i < docs.length; i++) {
    procMsg.textContent = '雲端同步中 (' + (i + 1) + '/' + docs.length + ')…';
    try {
      var d = docs[i].data();
      await idbPut({ name: d.name, title: d.title, group: d.group, date: d.date, html: d.html });
      ok++;
    } catch(e) { fail++; }
  }
  return { ok: ok, fail: fail };
}


/* ══ Share Functions ════════════════════════════════════════ */

var _shareCurrentDoc = null; /* { name, title, html } */
var _teacherClasses  = null; /* cached class list */

async function loadTeacherClasses() {
  if (!fbDb || !currentUser) return [];
  if (_teacherClasses) return _teacherClasses;
  var snap = await fbDb.collection('classes')
    .where('teacherUid', '==', currentUser.uid).get();
  _teacherClasses = snap.docs.map(function(d) {
    return { id: d.id, name: d.data().name };
  });
  return _teacherClasses;
}

async function getDocSharedClasses(docName) {
  var classes = await loadTeacherClasses();
  if (!classes.length) return [];
  var sharedIds = [];
  await Promise.all(classes.map(async function(cls) {
    var ref = fbDb.collection('classes').doc(cls.id)
      .collection('sharedReaderDocs').doc(docName);
    var doc = await ref.get();
    if (doc.exists) sharedIds.push(cls.id);
  }));
  return sharedIds;
}

async function refreshCardShareStatus(docName, statusEl) {
  if (!currentUser || !fbDb) return;
  var classes = await loadTeacherClasses();
  var sharedIds = await getDocSharedClasses(docName);
  statusEl.innerHTML = '';
  sharedIds.forEach(function(cid) {
    var cls = classes.find(function(c) { return c.id === cid; });
    if (!cls) return;
    var badge = document.createElement('span');
    badge.className   = 'share-badge';
    badge.textContent = cls.name;
    statusEl.appendChild(badge);
  });
}

async function showShareModal(docName, title, html) {
  if (!currentUser) { showToast('請先登入才能使用分享功能'); return; }
  _shareCurrentDoc = { name: docName, title: title, html: html };
  document.getElementById('share-doc-name').textContent = '《' + title + '》';
  shareClassList.innerHTML = '';
  shareLoading.style.display = 'block';
  btnConfirmShare.disabled = true;
  modalShare.classList.add('show');

  try {
    var classes = await loadTeacherClasses();
    var sharedIds = await getDocSharedClasses(docName);
    shareLoading.style.display = 'none';
    btnConfirmShare.disabled = false;

    if (classes.length === 0) {
      shareClassList.innerHTML = '<div style="text-align:center;padding:16px;color:#999;font-size:.85rem;font-weight:600">尚未建立任何班級</div>';
      return;
    }

    classes.forEach(function(cls) {
      var row = document.createElement('div');
      row.className = 'share-class-row';
      var cb = document.createElement('input');
      cb.type    = 'checkbox';
      cb.id      = 'share-cls-' + cls.id;
      cb.value   = cls.id;
      cb.checked = sharedIds.indexOf(cls.id) !== -1;
      var lbl = document.createElement('label');
      lbl.htmlFor     = cb.id;
      lbl.textContent = cls.name;
      row.appendChild(cb);
      row.appendChild(lbl);
      shareClassList.appendChild(row);
    });
  } catch(e) {
    shareLoading.style.display = 'none';
    shareClassList.innerHTML = '<div style="color:red;font-size:.85rem;padding:8px">載入失敗：' + escapeHtml(e.message) + '</div>';
  }
}

function closeShareModal() {
  modalShare.classList.remove('show');
  _shareCurrentDoc = null;
}

btnCancelShare.addEventListener('click', closeShareModal);
modalShare.addEventListener('click', function(e) {
  if (e.target === modalShare) closeShareModal();
});

btnConfirmShare.addEventListener('click', async function() {
  if (!_shareCurrentDoc || !fbDb || !currentUser) return;
  btnConfirmShare.disabled = true;
  btnConfirmShare.textContent = '儲存中…';

  var doc     = _shareCurrentDoc;
  var checks  = shareClassList.querySelectorAll('input[type=checkbox]');
  var classes = await loadTeacherClasses();

  try {
    var batch = fbDb.batch();
    checks.forEach(function(cb) {
      var classId = cb.value;
      var ref = fbDb.collection('classes').doc(classId)
        .collection('sharedReaderDocs').doc(doc.name);
      if (cb.checked) {
        batch.set(ref, {
          title:      doc.title,
          html:       doc.html,
          teacherUid: currentUser.uid,
          sharedAt:   firebase.firestore.FieldValue.serverTimestamp()
        });
      } else {
        batch.delete(ref);
      }
    });
    await batch.commit();

    /* 更新卡片上的分享徽章 */
    var statusEl = document.querySelector('.lib-card-share-status[data-doc="' + doc.name + '"]');
    if (statusEl) refreshCardShareStatus(doc.name, statusEl);

    showToast('✅ 分享設定已儲存');
    closeShareModal();
  } catch(e) {
    showToast('⚠️ 儲存失敗：' + e.message);
  } finally {
    btnConfirmShare.disabled = false;
    btnConfirmShare.textContent = '✅ 確認';
  }
});

/* ══ Student Mode Functions ═════════════════════════════════ */

async function initStudentMode() {
  /* 隱藏教師功能 */
  document.getElementById('tab-convert').style.display = 'none';
  document.getElementById('tab-library').style.display = 'none';
  document.getElementById('login-btn').style.display   = 'none';
  showPage('student');

  if (!studentClassIds.length) {
    studentLoading.style.display = 'none';
    studentEmpty.style.display   = 'block';
    return;
  }

  try {
    var allDocs = [];
    var seen = {};
    await Promise.all(studentClassIds.map(async function(cid) {
      var snap = await fbDb.collection('classes').doc(cid).collection('sharedReaderDocs').get();
      snap.docs.forEach(function(d) {
        if (!seen[d.id]) { seen[d.id] = true; allDocs.push(d.data()); }
      });
    }));
    studentLoading.style.display = 'none';
    renderStudentDocList(allDocs);
  } catch(e) {
    studentLoading.style.display = 'none';
    studentDocList.innerHTML = '<div style="text-align:center;padding:32px;color:#e00;font-size:.85rem">載入失敗，請重新整理</div>';
  }
}

function renderStudentDocList(docs) {
  if (!docs || docs.length === 0) {
    studentEmpty.style.display = 'block';
    return;
  }
  studentEmpty.style.display = 'none';
  studentDocList.innerHTML = '';
  docs.forEach(function(doc) {
    var card = document.createElement('div');
    card.className = 'student-doc-card';
    card.innerHTML =
      '<div class="student-doc-icon">📄</div>' +
      '<div><div class="student-doc-title">' + escapeHtml(doc.title) + '</div></div>' +
      '<div class="student-doc-arrow">›</div>';
    card.addEventListener('click', function() {
      openSharedDoc(doc.html, doc.title);
    });
    studentDocList.appendChild(card);
  });
}

function openSharedDoc(html, title) {
  try {
    var blob  = new Blob([html], { type: 'text/html; charset=utf-8' });
    var url   = URL.createObjectURL(blob);
    var frame = document.getElementById('viewer-frame');
    frame.src = url;
    showPage('viewer');
    document.getElementById('topbar-title').textContent = '🎧 ' + title;
    topbarBack.classList.add('visible');
    setTimeout(function() { URL.revokeObjectURL(url); }, 60000);
  } catch(e) {
    showToast('⚠️ 無法開啟：' + e.message);
  }
}

/* ══ Navigation ═════════════════════════════════════════════ */
var inIframe = window !== window.parent;

function showPage(name) {
  document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
  document.getElementById('page-' + name).classList.add('active');
  currentPage = name;
  topbarBack.classList.toggle('visible', name !== 'upload' || inIframe);
  if (!studentMode) {
    document.getElementById('tab-convert').classList.toggle('active', name === 'upload' || name === 'reader');
    document.getElementById('tab-library').classList.toggle('active', name === 'library');
  }
}

function switchTab(tab) {
  if (tab === 'library') {
    showPage('library');
    loadLibrary();
  } else {
    showPage(readerContent.children.length > 0 ? 'reader' : 'upload');
  }
}
document.getElementById('tab-convert').addEventListener('click', function () { switchTab('convert'); });
document.getElementById('tab-library').addEventListener('click', function () { switchTab('library'); });

/* ── 從報讀庫載入並重新編輯內容 ─────────────────────────────── */
function extractLinesFromHtml(html) {
  var parser = new DOMParser();
  var doc    = parser.parseFromString(html, 'text/html');
  return Array.from(doc.querySelectorAll('.line')).map(function (el) {
    var text = (el.querySelector('.lineText') || el).textContent.trim();
    if (el.classList.contains('title-main')) return '## ' + text;
    if (el.classList.contains('title-sub'))  return '# '  + text;
    return text;
  }).filter(function (l) { return l.length > 0; });
}

function openLibraryItemForEdit(entry) {
  _editingLibraryEntry = entry;
  var lines = extractLinesFromHtml(entry.html);
  currentDocName = entry.title;
  docTitle.textContent = entry.title;
  stopSpeak();
  renderLines(lines);
  readerContent.style.fontSize = fontValue + 'px';
  statusBar.textContent = '💡 點擊任意行朗讀，或按「連播」';
  editTextarea.value = lines.join('\n');
  editPanel.style.display = 'block';
  editToggleBtn.textContent = '✖ 關閉編輯';
  showPage('reader');
  editTextarea.focus();
}

topbarBack.addEventListener('click', function () {
  if (currentPage === 'viewer') {
    document.getElementById('viewer-frame').src = '';
    document.getElementById('topbar-title').textContent = '🎧 有聲教材';
    if (studentMode) {
      showPage('student');
    } else {
      showPage('library');
      loadLibrary();
    }
  } else if (studentMode && currentPage === 'student') {
    window.parent.postMessage({ type: 'exam-reader-back-to-hub' }, '*');
  } else if (currentPage === 'reader')  { stopSpeak(); _editingLibraryEntry = null; showPage('upload'); }
  else if (currentPage === 'library') {
    showPage(readerContent.children.length > 0 ? 'reader' : 'upload');
  } else if (currentPage === 'upload' && inIframe) {
    window.parent.postMessage('close-tool', '*');
  }
});

/* ══ Toast ══════════════════════════════════════════════════ */
var toastTimer = null;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2800);
}

/* ══ File Upload ════════════════════════════════════════════ */
fileInput.addEventListener('change', function () {
  selectedFile = fileInput.files[0] || null;
  convertBtn.disabled = !selectedFile;
  convertBtn.textContent = selectedFile
    ? '▶ 開始轉換「' + selectedFile.name + '」'
    : '請先選擇檔案';
});
dropZone.addEventListener('dragover',  function (e) { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', function ()  { dropZone.classList.remove('drag-over'); });
dropZone.addEventListener('drop', function (e) {
  e.preventDefault(); dropZone.classList.remove('drag-over');
  var f = e.dataTransfer.files[0];
  if (f && /\.(docx?|doc)$/i.test(f.name)) {
    selectedFile = f;
    convertBtn.disabled = false;
    convertBtn.textContent = '▶ 開始轉換「' + f.name + '」';
  }
});

convertBtn.addEventListener('click', function () {
  if (!selectedFile) return;
  procMsg.textContent = '正在解析 Word 檔案…';
  procOverlay.classList.add('show');
  var fr = new FileReader();
  fr.onload = function (e) {
    mammoth.extractRawText({ arrayBuffer: e.target.result })
      .then(function (result) {
        var name = selectedFile.name.replace(/\.(docx?|doc)$/i, '');
        buildReader(result.value, name);
        procOverlay.classList.remove('show');
        showPage('reader');
      })
      .catch(function (err) {
        procOverlay.classList.remove('show');
        showToast('⚠️ 解析失敗：' + err.message);
      });
  };
  fr.readAsArrayBuffer(selectedFile);
});

manualBtn.addEventListener('click', function () {
  buildReader('', '未命名文件');
  editPanel.style.display = 'block';
  editToggleBtn.textContent = '✖ 關閉編輯';
  showPage('reader');
  editTextarea.focus();
});

/* ══ Build Reader ═══════════════════════════════════════════ */
function buildReader(rawText, name) {
  currentDocName = name;
  docTitle.textContent = name;
  stopSpeak();
  var lines = rawText.split('\n')
    .map(function (l) { return l.trim(); })
    .filter(function (l) { return l.length > 0; });
  renderLines(lines);
  readerContent.style.fontSize = fontValue + 'px';
  statusBar.textContent = '💡 點擊任意行朗讀，或按「連播」';
}

function renderLines(lines) {
  readerContent.innerHTML = '';
  var even = 0;
  lines.forEach(function (line) {
    var div  = document.createElement('div');
    var span = document.createElement('span');
    span.className = 'lineText';
    div.dataset.raw = line; /* 保留原始行（含前綴），供 openEdit 還原 */

    /* 手動前綴優先判斷 */
    if (/^## /.test(line)) {
      span.textContent = line.slice(3);
      div.className = 'line title-main';
    } else if (/^# /.test(line)) {
      span.textContent = line.slice(2);
      div.className = 'line title-sub';
    /* 自動偵測 */
    } else if (/^[一二三四五六七八九十百千]+[、.．：:]/.test(line)) {
      span.textContent = line;
      div.className = 'line title-main';
    } else if (/^[（(]?[\d]+[）)、.．]\s/.test(line) && line.length < 60) {
      span.textContent = line;
      div.className = 'line title-sub';
    } else {
      span.textContent = line;
      div.className = 'line' + (even % 2 === 1 ? ' even' : '');
      even++;
    }
    div.appendChild(span);
    readerContent.appendChild(div);
  });
}

/* ══ Voice / TTS ════════════════════════════════════════════ */
function loadVoices() {
  voices = synth.getVoices();
  voiceSelect.innerHTML = '';
  voices.forEach(function (v, i) {
    var opt = document.createElement('option');
    opt.value = i;
    opt.textContent = v.name + ' (' + v.lang + ')';
    voiceSelect.appendChild(opt);
  });
  var zh = voices.findIndex(function (v) { return /zh/i.test(v.lang); });
  if (zh >= 0) voiceSelect.value = zh;
}
loadVoices();
if (speechSynthesis.onvoiceschanged !== undefined) speechSynthesis.onvoiceschanged = loadVoices;

function stopSpeak() {
  if (synth.speaking || synth.pending) synth.cancel();
  document.querySelectorAll('.line.reading').forEach(function (el) { el.classList.remove('reading'); });
  isPlayingAll = false; playAllIndex = 0;
  statusBar.textContent = '💡 點擊任意行朗讀，或按「連播」';
}

function speak(text, node, onend) {
  if (synth.speaking || synth.pending) synth.cancel();
  document.querySelectorAll('.line.reading').forEach(function (el) { el.classList.remove('reading'); });
  if (!text) return;
  var u = new SpeechSynthesisUtterance(text);
  var idx = Number(voiceSelect.value);
  if (voices[idx]) u.voice = voices[idx];
  u.rate = rateValue;
  u.onstart = function () {
    if (node) { node.classList.add('reading'); node.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    statusBar.textContent = '🔊 ' + text.slice(0, 36) + (text.length > 36 ? '…' : '');
  };
  u.onend  = function () { if (node) node.classList.remove('reading'); if (onend) onend(); };
  u.onerror= function () { if (node) node.classList.remove('reading'); if (onend) onend(); };
  synth.speak(u);
}

function playAll() {
  var lines = Array.from(readerContent.querySelectorAll('.line')).filter(function (el) {
    return !el.classList.contains('title-main') && !el.classList.contains('title-sub');
  });
  if (!lines.length) return;
  isPlayingAll = true; playAllIndex = 0;
  function step() {
    if (!isPlayingAll || playAllIndex >= lines.length) {
      isPlayingAll = false; statusBar.textContent = '✅ 播放完畢'; return;
    }
    var el = lines[playAllIndex++];
    var t  = el.querySelector('.lineText');
    var tx = (t ? t.textContent : el.textContent).trim();
    if (!tx) { step(); return; }
    speak(tx, el, step);
  }
  step();
}

readerContent.addEventListener('click', function (e) {
  var sel = window.getSelection();
  if (sel && sel.toString().trim()) return; // 有選取文字時交給 mouseup 處理
  var node = e.target.closest('.line');
  if (!node) return;
  if (node.classList.contains('title-main') || node.classList.contains('title-sub')) return;
  isPlayingAll = false;
  var t = node.querySelector('.lineText');
  speak((t ? t.textContent : node.textContent).trim(), node);
});
readerContent.addEventListener('mouseup', function () {
  var sel  = window.getSelection();
  var text = sel ? sel.toString().trim() : '';
  if (text) speak(text);
});

document.getElementById('play-all-btn').addEventListener('click', function () { stopSpeak(); setTimeout(playAll, 100); });
document.getElementById('pause-btn').addEventListener('click',  function () { if (synth.speaking && !synth.paused) synth.pause(); });
document.getElementById('resume-btn').addEventListener('click', function () { if (synth.paused) synth.resume(); });
document.getElementById('stop-btn').addEventListener('click',   stopSpeak);

/* ══ Rate / Font +/- ════════════════════════════════════════ */
document.getElementById('rate-minus').addEventListener('click', function () {
  rateValue = Math.max(0.3, Math.round((rateValue - 0.1) * 10) / 10);
  rateVal.textContent = rateValue;
});
document.getElementById('rate-plus').addEventListener('click', function () {
  rateValue = Math.min(1.5, Math.round((rateValue + 0.1) * 10) / 10);
  rateVal.textContent = rateValue;
});
document.getElementById('font-minus').addEventListener('click', function () {
  fontValue = Math.max(13, fontValue - 1);
  fontVal.textContent = fontValue + 'px';
  readerContent.style.fontSize = fontValue + 'px';
});
document.getElementById('font-plus').addEventListener('click', function () {
  fontValue = Math.min(36, fontValue + 1);
  fontVal.textContent = fontValue + 'px';
  readerContent.style.fontSize = fontValue + 'px';
});

/* ══ Edit Panel ═════════════════════════════════════════════ */
function openEdit() {
  /* 優先讀 data-raw（保留 ## / # 前綴），fallback 讀顯示文字 */
  editTextarea.value = Array.from(readerContent.querySelectorAll('.line'))
    .map(function (el) {
      return el.dataset.raw !== undefined
        ? el.dataset.raw
        : (el.querySelector('.lineText') || el).textContent;
    }).join('\n');
  editPanel.style.display = 'block';
  editToggleBtn.textContent = '✖ 關閉編輯';
}
function closeEdit() {
  editPanel.style.display = 'none';
  editToggleBtn.textContent = '✏️ 編輯';
}
editToggleBtn.addEventListener('click', function () {
  editPanel.style.display === 'none' ? openEdit() : closeEdit();
});
applyEditBtn.addEventListener('click', function () {
  var lines = editTextarea.value.split('\n')
    .map(function (l) { return l.trim(); })
    .filter(function (l) { return l.length > 0; });
  renderLines(lines);
  readerContent.style.fontSize = fontValue + 'px';
  closeEdit();
  showToast('✅ 已套用編輯內容');
});
cancelEditBtn.addEventListener('click', closeEdit);

/* ══ Edit Panel — Float / Drag ══════════════════════════════ */
function setEditFloat(isFloat) {
  editIsFloat = isFloat;
  var panel = editPanel;
  if (isFloat) {
    panel.classList.add('floating');
    /* 初始位置：畫面中央偏上 */
    if (!panel.style.left) {
      panel.style.left = Math.max(0, (window.innerWidth  - panel.offsetWidth)  / 2) + 'px';
      panel.style.top  = Math.max(52, (window.innerHeight - panel.offsetHeight) / 3) + 'px';
    }
  } else {
    panel.classList.remove('floating');
    panel.style.left = '';
    panel.style.top  = '';
  }
}
document.getElementById('edit-float-btn').addEventListener('click', function () { setEditFloat(true);  });
document.getElementById('edit-pin-btn').addEventListener('click',   function () { setEditFloat(false); });

/* 拖曳 — mouse */
editDragHandle.addEventListener('mousedown', function (e) {
  if (!editIsFloat) return;
  var r = editPanel.getBoundingClientRect();
  _dragState = { ox: e.clientX - r.left, oy: e.clientY - r.top };
  e.preventDefault();
});
document.addEventListener('mousemove', function (e) {
  if (!_dragState) return;
  var x = Math.max(0, Math.min(window.innerWidth  - editPanel.offsetWidth,  e.clientX - _dragState.ox));
  var y = Math.max(0, Math.min(window.innerHeight - editPanel.offsetHeight, e.clientY - _dragState.oy));
  editPanel.style.left = x + 'px';
  editPanel.style.top  = y + 'px';
});
document.addEventListener('mouseup', function () { _dragState = null; });

/* 拖曳 — touch */
editDragHandle.addEventListener('touchstart', function (e) {
  if (!editIsFloat) return;
  var r = editPanel.getBoundingClientRect();
  var t = e.touches[0];
  _dragState = { ox: t.clientX - r.left, oy: t.clientY - r.top };
  e.preventDefault();
}, { passive: false });
editDragHandle.addEventListener('touchmove', function (e) {
  if (!_dragState) return;
  var t = e.touches[0];
  var x = Math.max(0, Math.min(window.innerWidth  - editPanel.offsetWidth,  t.clientX - _dragState.ox));
  var y = Math.max(0, Math.min(window.innerHeight - editPanel.offsetHeight, t.clientY - _dragState.oy));
  editPanel.style.left = x + 'px';
  editPanel.style.top  = y + 'px';
  e.preventDefault();
}, { passive: false });
editDragHandle.addEventListener('touchend', function () { _dragState = null; });

/* ══ Edit Panel — Format Toolbar ════════════════════════════ */
function getEditCursorLine() {
  var ta    = editTextarea;
  var start = ta.selectionStart;
  var text  = ta.value;
  var ls    = text.lastIndexOf('\n', start - 1) + 1;
  var le    = text.indexOf('\n', start);
  if (le === -1) le = text.length;
  return { ls: ls, le: le, line: text.slice(ls, le) };
}
function applyLinePrefix(prefix) {
  var ta   = editTextarea;
  var info = getEditCursorLine();
  /* 移除已有前綴 */
  var bare = info.line.replace(/^(## |# )/, '');
  var newLine = prefix + bare;
  var before  = ta.value.slice(0, info.ls);
  var after   = ta.value.slice(info.le);
  var cur     = info.ls + newLine.length;
  ta.value    = before + newLine + after;
  ta.setSelectionRange(cur, cur);
  ta.focus();
}
document.getElementById('fmt-t1').addEventListener('click',    function () { applyLinePrefix('## '); });
document.getElementById('fmt-t2').addEventListener('click',    function () { applyLinePrefix('# '); });
document.getElementById('fmt-clear').addEventListener('click', function () { applyLinePrefix(''); });

/* ══ Edit Panel — Merge Short Lines ════════════════════════ */
document.getElementById('fmt-merge').addEventListener('click', function () {
  var lines  = editTextarea.value.split('\n');
  var merged = [];
  lines.forEach(function (line) {
    var trimmed = line.trim();
    /* 短行（< 5 字且非空行）附加到上一行 */
    if (trimmed.length > 0 && trimmed.length < 5 && merged.length > 0 && merged[merged.length - 1].trim().length > 0) {
      merged[merged.length - 1] += trimmed;
    } else {
      merged.push(line);
    }
  });
  editTextarea.value = merged.join('\n');
  showToast('✅ 已合併短行');
});

/* ══ Edit Panel — Search / Replace ═════════════════════════ */
document.getElementById('fmt-search-toggle').addEventListener('click', function () {
  var bar = document.getElementById('edit-search-bar');
  var isShow = bar.classList.toggle('show');
  document.getElementById('fmt-search-toggle').classList.toggle('active', isShow);
  if (isShow) document.getElementById('search-input').focus();
});
document.getElementById('btn-replace').addEventListener('click', function () {
  var needle  = document.getElementById('search-input').value;
  var replace = document.getElementById('replace-input').value;
  if (!needle) return;
  var idx = editTextarea.value.indexOf(needle);
  if (idx === -1) { showToast('⚠️ 找不到「' + needle + '」'); return; }
  editTextarea.value =
    editTextarea.value.slice(0, idx) + replace + editTextarea.value.slice(idx + needle.length);
  var pos = idx + replace.length;
  editTextarea.setSelectionRange(pos, pos);
  editTextarea.focus();
});
document.getElementById('btn-replace-all').addEventListener('click', function () {
  var needle  = document.getElementById('search-input').value;
  var replace = document.getElementById('replace-input').value;
  if (!needle) return;
  var count = editTextarea.value.split(needle).length - 1;
  if (count === 0) { showToast('⚠️ 找不到「' + needle + '」'); return; }
  editTextarea.value = editTextarea.value.split(needle).join(replace);
  showToast('✅ 已取代 ' + count + ' 處');
  editTextarea.focus();
});

/* ══ IndexedDB — library store ══════════════════════════════ */
var _idb = null;
function openIDB() {
  return new Promise(function (resolve, reject) {
    if (_idb) { resolve(_idb); return; }
    var req = indexedDB.open('reader-tool-v2', 1);
    req.onupgradeneeded = function (e) {
      e.target.result.createObjectStore('library', { keyPath: 'name' });
    };
    req.onsuccess = function (e) { _idb = e.target.result; resolve(_idb); };
    req.onerror   = reject;
  });
}
function idbPut(entry) {
  return openIDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction('library', 'readwrite');
      tx.objectStore('library').put(entry);
      tx.oncomplete = resolve; tx.onerror = reject;
    });
  });
}
function idbGetAll() {
  return openIDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx  = db.transaction('library', 'readonly');
      var req = tx.objectStore('library').getAll();
      req.onsuccess = function () { resolve(req.result || []); };
      req.onerror   = reject;
    });
  });
}
function idbGet(name) {
  return openIDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx  = db.transaction('library', 'readonly');
      var req = tx.objectStore('library').get(name);
      req.onsuccess = function () { resolve(req.result || null); };
      req.onerror   = reject;
    });
  });
}
function idbDelete(name) {
  return openIDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction('library', 'readwrite');
      tx.objectStore('library').delete(name);
      tx.oncomplete = resolve; tx.onerror = reject;
    });
  });
}

/* ══ Generate Output HTML ═══════════════════════════════════ */
function buildOutputHtml(docName, group) {
  var linesHtml = Array.from(readerContent.querySelectorAll('.line')).map(function (el) {
    var t   = (el.querySelector('.lineText') || el).textContent;
    var cls = el.className.replace(/\breading\b/g, '').trim();
    return '<div class="' + cls + '"><span class="lineText">'
         + t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
         + '</span></div>';
  }).join('\n');

  return '<!DOCTYPE html>\n<html lang="zh-Hant">\n<head>\n'
    + '<meta charset="utf-8"/>\n'
    + '<meta name="viewport" content="width=device-width,initial-scale=1"/>\n'
    + '<meta name="reader-group" content="' + escapeHtml(group) + '"/>\n'
    + '<meta name="reader-date"  content="' + new Date().toISOString().slice(0,10) + '"/>\n'
    + '<title>' + escapeHtml(docName) + '</title>\n'
    + '<style>\n'
    + ':root{--blue:#4a90d9;--blue-dk:#2d6fa8;--blue-lt:#e8f4fd;--fg1:#1e2d3d;--fg2:#7a99b5;--bg:#eef5fc;--white:#ffffff;--border:#d4e8f8;--grad-btn:linear-gradient(135deg,#4a90d9,#2d6fa8);--reading-bg:#fff9e6;--reading-border:#ffc107;--line-even:#f4f9ff;--line-hover:#dbeeff}\n'
    + 'body.dark{--blue:#58a6ff;--blue-dk:#79c0ff;--blue-lt:#1c2d3f;--fg1:#e6edf3;--fg2:#7d8590;--bg:#0d1117;--white:#161b22;--border:#30363d;--grad-btn:linear-gradient(135deg,#3a7fd4,#2d6fa8);--reading-bg:#2a2010;--reading-border:#d29922;--line-even:#161b22;--line-hover:#1c2d3f}\n'
    + '*{box-sizing:border-box;margin:0;padding:0}\n'
    + 'body{font-family:"Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif;background:var(--bg);color:var(--fg1);min-height:100vh;transition:background .3s,color .3s}\n'
    + '.controls-bar{background:var(--white);border-bottom:1px solid var(--border);padding:8px 14px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;position:sticky;top:0;z-index:40;box-shadow:0 2px 8px rgba(0,0,0,.04);transition:background .3s,border-color .3s}\n'
    + '.ctrl-group{display:flex;align-items:center;gap:6px}\n'
    + '.ctrl-label{font-size:.76rem;font-weight:800;color:var(--fg2);white-space:nowrap}\n'
    + '.ctrl-select{font-size:.8rem;font-weight:700;background:var(--blue-lt);color:var(--blue-dk);border:2px solid var(--border);border-radius:10px;padding:5px 8px;max-width:145px;outline:none;cursor:pointer}\n'
    + '.ctrl-range{width:78px;accent-color:var(--blue)}\n'
    + '.ctrl-val{font-size:.76rem;font-weight:800;color:var(--blue-dk);min-width:24px;text-align:center}\n'
    + '.spacer{flex:1}\n'
    + '.btn-ctrl{height:36px;padding:0 13px;border:2px solid var(--border);border-radius:11px;background:var(--white);color:var(--fg1);font-size:.85rem;font-weight:800;cursor:pointer;transition:all .15s;white-space:nowrap;min-height:36px}\n'
    + '.btn-ctrl:hover{background:var(--blue-lt);border-color:var(--blue);color:var(--blue-dk)}\n'
    + '.btn-ctrl:active{transform:scale(.95)}\n'
    + '.btn-ctrl.primary{background:var(--grad-btn);color:#fff;border-color:transparent;box-shadow:0 4px 12px rgba(45,111,168,.28)}\n'
    + '.btn-ctrl.primary:hover{opacity:.88}\n'
    + '.status-tip{padding:8px 18px 4px;font-size:.76rem;font-weight:700;color:var(--fg2)}\n'
    + '.doc-heading{padding:14px 18px 4px;font-size:1.1rem;font-weight:900;color:var(--blue-dk)}\n'
    + '#content{padding:4px 14px 72px}\n'
    + '.line{display:flex;gap:8px;align-items:flex-start;padding:9px 12px;border-radius:13px;margin:2px 0;cursor:pointer;transition:background .12s}\n'
    + '.line:hover{background:var(--line-hover)}\n'
    + '.line.even{background:var(--line-even)}\n'
    + '.line.even:hover{background:var(--line-hover)}\n'
    + '.line.reading{background:var(--reading-bg)!important;outline:2.5px solid var(--reading-border)}\n'
    + '.lineText{flex:1;line-height:1.85}\n'
    + '.title-main{font-size:1.05rem;font-weight:900;color:var(--blue-dk);padding:10px 12px 6px;margin-top:8px;cursor:default}\n'
    + '.title-main:hover{background:transparent}\n'
    + '.title-sub{font-size:.94rem;font-weight:800;color:var(--fg2);cursor:default}\n'
    + '.title-sub:hover{background:transparent}\n'
    + '</style>\n</head>\n<body>\n'
    + '<script>(function(){if(localStorage.getItem("admin-dark")==="1")document.body.classList.add("dark");})()</s' + 'cript>\n'
    + '<div class="controls-bar">\n'
    + '  <div class="ctrl-group"><span class="ctrl-label">聲音</span><select id="vs" class="ctrl-select"></select></div>\n'
    + '  <div class="ctrl-group"><span class="ctrl-label">語速</span><input id="rs" class="ctrl-range" type="range" min="0.3" max="1.5" step="0.05" value="0.9"/><span class="ctrl-val" id="rv">0.9</span></div>\n'
    + '  <div class="ctrl-group"><span class="ctrl-label">字體</span><input id="fs" class="ctrl-range" type="range" min="13" max="36" step="1" value="17"/><span class="ctrl-val" id="fv">17</span></div>\n'
    + '  <div class="spacer"></div>\n'
    + '  <button class="btn-ctrl primary" id="pa">▶ 連播</button>\n'
    + '  <button class="btn-ctrl" id="pu">⏸</button>\n'
    + '  <button class="btn-ctrl" id="re">⏯</button>\n'
    + '  <button class="btn-ctrl" id="st">⏹</button>\n'
    + '</div>\n'
    + '<div class="status-tip" id="sb">💡 點擊任意行朗讀，或按「連播」</div>\n'
    + '<div class="doc-heading">' + escapeHtml(docName) + '</div>\n'
    + '<div id="content">\n' + linesHtml + '\n</div>\n'
    + '<script>\n(function(){\n'
    + 'var sy=window.speechSynthesis,vc=[],ipa=false,pai=0;\n'
    + 'var vs=document.getElementById("vs"),rs=document.getElementById("rs"),rv=document.getElementById("rv"),fs=document.getElementById("fs"),fv=document.getElementById("fv"),sb=document.getElementById("sb"),ct=document.getElementById("content");\n'
    + 'function lv(){vc=sy.getVoices();vs.innerHTML="";vc.forEach(function(v,i){var o=document.createElement("option");o.value=i;o.textContent=v.name+" ("+v.lang+")";vs.appendChild(o);});var z=vc.findIndex(function(v){return /zh/i.test(v.lang);});if(z>=0)vs.value=z;}\n'
    + 'lv();if(speechSynthesis.onvoiceschanged!==undefined)speechSynthesis.onvoiceschanged=lv;\n'
    + 'function ss(){if(sy.speaking||sy.pending)sy.cancel();document.querySelectorAll(".line.reading").forEach(function(el){el.classList.remove("reading");});ipa=false;pai=0;sb.textContent="💡 點擊任意行朗讀，或按「連播」";}\n'
    + 'function sp(tx,nd,cb){if(sy.speaking||sy.pending)sy.cancel();document.querySelectorAll(".line.reading").forEach(function(el){el.classList.remove("reading");});if(!tx)return;var u=new SpeechSynthesisUtterance(tx);var i=Number(vs.value);if(vc[i])u.voice=vc[i];u.rate=parseFloat(rs.value)||0.9;u.onstart=function(){if(nd){nd.classList.add("reading");nd.scrollIntoView({behavior:"smooth",block:"nearest"});}sb.textContent="🔊 "+tx.slice(0,36)+(tx.length>36?"…":"");};u.onend=function(){if(nd)nd.classList.remove("reading");if(cb)cb();};u.onerror=function(){if(nd)nd.classList.remove("reading");if(cb)cb();};sy.speak(u);}\n'
    + 'function pa(){var ls=Array.from(ct.querySelectorAll(".line")).filter(function(el){return!el.classList.contains("title-main")&&!el.classList.contains("title-sub");});if(!ls.length)return;ipa=true;pai=0;function step(){if(!ipa||pai>=ls.length){ipa=false;sb.textContent="✅ 播放完畢";return;}var el=ls[pai++];var t=el.querySelector(".lineText");var tx=(t?t.textContent:el.textContent).trim();if(!tx){step();return;}sp(tx,el,step);}step();}\n'
    + 'ct.addEventListener("click",function(e){var nd=e.target.closest(".line");if(!nd)return;if(nd.classList.contains("title-main")||nd.classList.contains("title-sub"))return;ipa=false;var t=nd.querySelector(".lineText");sp((t?t.textContent:nd.textContent).trim(),nd);});\n'
    + 'ct.addEventListener("mouseup",function(){var sel=window.getSelection();var tx=sel?sel.toString().trim():"";if(tx)sp(tx);});\n'
    + 'document.getElementById("pa").addEventListener("click",function(){ss();setTimeout(pa,100);});\n'
    + 'document.getElementById("pu").addEventListener("click",function(){if(sy.speaking&&!sy.paused)sy.pause();});\n'
    + 'document.getElementById("re").addEventListener("click",function(){if(sy.paused)sy.resume();});\n'
    + 'document.getElementById("st").addEventListener("click",ss);\n'
    + 'rs.addEventListener("input",function(){rv.textContent=rs.value;});\n'
    + 'fs.addEventListener("input",function(){fv.textContent=fs.value;ct.style.fontSize=fs.value+"px";});\n'
    + '})();\n<\/script>\n<\/body>\n<\/html>';
}

/* ══ Save to Library ════════════════════════════════════════ */
saveLibBtn.addEventListener('click', async function () {
  saveFilename.value = currentDocName;
  saveGroup.value    = _editingLibraryEntry
    ? (_editingLibraryEntry.group === '未分類' ? '' : _editingLibraryEntry.group)
    : '';
  groupDatalist.innerHTML = '';
  try {
    var entries = await idbGetAll();
    var gs = new Set(entries.map(function (e) { return e.group; }).filter(Boolean));
    gs.forEach(function (g) {
      var opt = document.createElement('option');
      opt.value = g;
      groupDatalist.appendChild(opt);
    });
  } catch (e) { /* ignore */ }
  modalSave.classList.add('show');
  setTimeout(function () { saveFilename.select(); }, 50);
});

btnCancelSave.addEventListener('click', function () { modalSave.classList.remove('show'); });
modalSave.addEventListener('click', function (e) {
  if (e.target === modalSave) modalSave.classList.remove('show');
});

btnConfirmSave.addEventListener('click', async function () {
  var fname = saveFilename.value.trim();
  var group = saveGroup.value.trim() || '未分類';
  if (!fname) { saveFilename.focus(); return; }

  var filename    = _editingLibraryEntry
    ? _editingLibraryEntry.name
    : (fname.endsWith('.html') ? fname : fname + '.html');
  var htmlContent = buildOutputHtml(fname, group);

  modalSave.classList.remove('show');
  procMsg.textContent = '正在儲存到報讀庫…';
  procOverlay.classList.add('show');

  var entry = {
    name:  filename,
    title: fname,
    group: group,
    date:  new Date().toISOString().slice(0, 10),
    html:  htmlContent
  };
  try {
    await idbPut(entry);
    if (currentUser && fbDb) {
      procMsg.textContent = '正在備份到雲端…';
      await cloudSave(currentUser.uid, entry).catch(function(e) {
        showToast('⚠️ 本機已儲存，雲端備份失敗：' + e.message);
      });
    }
    procOverlay.classList.remove('show');
    _editingLibraryEntry = null;
    showToast('✅ 已儲存「' + fname + '」' + (currentUser ? '（含雲端備份）' : ''));
    setTimeout(function () { showPage('library'); loadLibrary(); }, 1000);
  } catch (e) {
    procOverlay.classList.remove('show');
    showToast('⚠️ 儲存失敗：' + e.message);
  }
});

/* ══ Library — import ═══════════════════════════════════════ */
btnImportFiles.addEventListener('change', async function () {
  var files = Array.from(btnImportFiles.files);
  if (!files.length) return;
  procMsg.textContent = '正在匯入 ' + files.length + ' 個檔案…';
  procOverlay.classList.add('show');
  var ok = 0, fail = 0;
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    try {
      var html  = await f.text();
      var title = f.name.replace(/\.html?$/i, '');
      await idbPut({
        name:  f.name,
        title: title,
        group: '未分類',
        date:  new Date().toISOString().slice(0, 10),
        html:  html
      });
      ok++;
    } catch (e) { fail++; }
  }
  btnImportFiles.value = '';
  procOverlay.classList.remove('show');
  showToast('✅ 已匯入 ' + ok + ' 個' + (fail ? '，' + fail + ' 個失敗' : ''));
  loadLibrary();
});


/* ══ Edit Item Modal ════════════════════════════════════════ */
async function openEditItemModal(filename, title, group) {
  _editingFile = { name: filename, title: title, group: group };
  editItemTitle.value = title;
  editItemGroup.value = group === '未分類' ? '' : group;
  editItemGroups.innerHTML = '';
  try {
    var entries = await idbGetAll();
    var gs = new Set(entries.map(function (e) { return e.group; }).filter(Boolean));
    gs.forEach(function (g) {
      var opt = document.createElement('option');
      opt.value = g;
      editItemGroups.appendChild(opt);
    });
  } catch (e) { /* ignore */ }
  modalEditItem.classList.add('show');
  setTimeout(function () { editItemTitle.select(); }, 50);
}

btnCancelEditItem.addEventListener('click', function () {
  modalEditItem.classList.remove('show');
});
modalEditItem.addEventListener('click', function (e) {
  if (e.target === modalEditItem) modalEditItem.classList.remove('show');
});
btnConfirmEditItem.addEventListener('click', async function () {
  if (!_editingFile) return;
  var newTitle = editItemTitle.value.trim();
  var newGroup = editItemGroup.value.trim() || '未分類';
  if (!newTitle) { editItemTitle.focus(); return; }
  try {
    var entry = await idbGet(_editingFile.name);
    if (entry) {
      entry.title = newTitle;
      entry.group = newGroup;
      await idbPut(entry);
    }
  } catch (e) {
    showToast('⚠️ 更新失敗：' + e.message);
    return;
  }
  modalEditItem.classList.remove('show');
  _editingFile = null;
  showToast('✅ 已更新項目');
  loadLibrary();
});


async function loadLibrary() {
  var entries;
  try {
    entries = await idbGetAll();
  } catch (e) {
    libraryContent.innerHTML =
      '<div class="library-empty"><p>⚠️ 無法讀取報讀庫</p><small>' + escapeHtml(e.message) + '</small></div>';
    return;
  }

  if (entries.length === 0) {
    libraryContent.innerHTML =
      '<div class="library-empty"><p>報讀庫還沒有內容</p>' +
      '<small>使用「轉換」功能後按「存到報讀庫」，或點「匯入 .html 檔」加入已有檔案</small></div>';
    return;
  }

  /* 分組 */
  var groups = {};
  entries.forEach(function (entry) {
    var g = entry.group || '未分類';
    if (!groups[g]) groups[g] = [];
    groups[g].push(entry);
  });

  var groupNames = Object.keys(groups).sort(function (a, b) {
    if (a === '未分類') return 1;
    if (b === '未分類') return -1;
    return a.localeCompare(b, 'zh');
  });

  libraryContent.innerHTML = '';
  groupNames.forEach(function (gname) {
    var section = document.createElement('div');
    section.className = 'group-section';

    var label = document.createElement('div');
    label.className   = 'group-label';
    label.textContent = gname;
    section.appendChild(label);

    var grid = document.createElement('div');
    grid.className = 'card-grid';
    section.appendChild(grid);

    groups[gname].forEach(function (entry) {
      var card = document.createElement('div');
      card.className = 'lib-card';

      var titleEl = document.createElement('div');
      titleEl.className   = 'lib-card-title';
      titleEl.textContent = entry.title;
      card.appendChild(titleEl);

      if (entry.date) {
        var dateMeta = document.createElement('div');
        dateMeta.className   = 'lib-card-meta';
        dateMeta.textContent = entry.date;
        card.appendChild(dateMeta);
      }

      var dlBtn = document.createElement('button');
      dlBtn.className   = 'lib-card-dl';
      dlBtn.title       = '下載 .html 檔案';
      dlBtn.textContent = '⬇️';
      card.appendChild(dlBtn);

      var editBtn = document.createElement('button');
      editBtn.className   = 'lib-card-edit';
      editBtn.title       = '重新命名 / 更改群組';
      editBtn.textContent = '✏️';
      card.appendChild(editBtn);

      var delBtn = document.createElement('button');
      delBtn.className   = 'lib-card-del';
      delBtn.title       = '從報讀庫刪除';
      delBtn.textContent = '🗑';
      card.appendChild(delBtn);

      var editContentBtn = document.createElement('button');
      editContentBtn.className   = 'lib-card-edit-content';
      editContentBtn.title       = '編輯內容';
      editContentBtn.textContent = '📝';
      card.appendChild(editContentBtn);

      var shareBtn = document.createElement('button');
      shareBtn.className   = 'lib-card-share';
      shareBtn.title       = '分享給班級';
      shareBtn.textContent = '📤';
      card.appendChild(shareBtn);

      var shareStatus = document.createElement('div');
      shareStatus.className      = 'lib-card-share-status';
      shareStatus.dataset.doc    = entry.name;
      card.appendChild(shareStatus);
      /* 非同步載入分享狀態徽章 */
      refreshCardShareStatus(entry.name, shareStatus);

      card.addEventListener('click', function (e) {
        if (e.target === delBtn || e.target === editBtn || e.target === dlBtn || e.target === editContentBtn || e.target === shareBtn) return;
        openLibraryItem(entry.html, entry.title);
      });
      editContentBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        openLibraryItemForEdit(entry);
      });
      dlBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        downloadLibraryItem(entry.name, entry.html);
      });
      editBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        openEditItemModal(entry.name, entry.title, entry.group || '未分類');
      });
      shareBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        showShareModal(entry.name, entry.title, entry.html);
      });
      delBtn.addEventListener('click', async function (e) {
        e.stopPropagation();
        if (!confirm('確定要刪除「' + entry.title + '」？\n（本機及雲端都會刪除）')) return;
        try {
          await idbDelete(entry.name);
          if (currentUser && fbDb) {
            await cloudDelete(currentUser.uid, entry.name).catch(function() {});
          }
          showToast('🗑 已刪除「' + entry.title + '」');
          loadLibrary();
        } catch (err) {
          showToast('⚠️ 刪除失敗：' + err.message);
        }
      });

      grid.appendChild(card);
    });

    libraryContent.appendChild(section);
  });
}

function openLibraryItem(html, title) {
  try {
    var blob  = new Blob([html], { type: 'text/html; charset=utf-8' });
    var url   = URL.createObjectURL(blob);
    var frame = document.getElementById('viewer-frame');
    frame.src = url;
    showPage('viewer');
    document.getElementById('topbar-title').textContent = '🎧 ' + title;
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  } catch (e) {
    showToast('⚠️ 無法開啟：' + e.message);
  }
}

function downloadLibraryItem(name, html) {
  var blob = new Blob([html], { type: 'text/html; charset=utf-8' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
}

/* ══ Init ═══════════════════════════════════════════════════ */
if (studentMode) {
  document.body.classList.add('student-mode');
  /* 學生模式：等 fbDb 初始化後載入分享文件 */
  (function waitFbDb() {
    if (!fbDb) { setTimeout(waitFbDb, 200); return; }
    initStudentMode();
  })();
} else if (window.location.hash === '#library') {
  showPage('library');
  loadLibrary();
}

})();
