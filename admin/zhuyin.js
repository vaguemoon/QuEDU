/**
 * admin/zhuyin.js — 注音趣：符號圖庫（單音 37 個＋結合韻 22 個，兩區固定符號，全校共用資料）
 * 依賴：shared.js（db、showToast、escHtml）、init.js（currentTeacher）、word-image.js（_wiCompressToDataUrl）
 * 符號發音錄音功能沿用 admin/audio-clips.js 的 MediaRecorder 錄音模式（WebM/Opus → base64）
 */
'use strict';

var ZY_INITIALS = ['ㄅ','ㄆ','ㄇ','ㄈ','ㄉ','ㄊ','ㄋ','ㄌ','ㄍ','ㄎ','ㄏ','ㄐ','ㄑ','ㄒ','ㄓ','ㄔ','ㄕ','ㄖ','ㄗ','ㄘ','ㄙ'];
var ZY_FINALS   = ['ㄧ','ㄨ','ㄩ','ㄚ','ㄛ','ㄜ','ㄝ','ㄞ','ㄟ','ㄠ','ㄡ','ㄢ','ㄣ','ㄤ','ㄥ','ㄦ'];

/* 結合韻：教育部標準 22 個，依介符分三組，跟學生端 apps/learn/lang/zhuyin/js/state.js 的清單一致 */
var ZY_COMBINED_YI = ['ㄧㄚ','ㄧㄛ','ㄧㄝ','ㄧㄞ','ㄧㄠ','ㄧㄡ','ㄧㄢ','ㄧㄣ','ㄧㄤ','ㄧㄥ'];
var ZY_COMBINED_WU = ['ㄨㄚ','ㄨㄛ','ㄨㄞ','ㄨㄟ','ㄨㄢ','ㄨㄣ','ㄨㄤ','ㄨㄥ'];
var ZY_COMBINED_YU = ['ㄩㄝ','ㄩㄢ','ㄩㄣ','ㄩㄥ'];

/* 單音／結合韻 兩區共用同一套編輯介面，用 _zyAdminSection 切換要操作哪個 Firestore
   collection、哪份資料快取——兩區資料互不相關，切換分頁不用重新整理頁面 */
var _zyAdminSection = 'single'; // 'single' | 'combined'
var _zyDataSingle    = {}; // { symbol: {imageUrl, phrase, audioData} }
var _zyDataCombined  = {}; // 結合韻，格式相同
var _zyData          = _zyDataSingle; // 指向目前分頁對應的那份（_zySwitchAdminSection 會重新指向）
var _zyEditingSymbol = '';
var _zyPendingBlob    = null; // 圖片
var _zyPendingAudio   = null; // 音檔（Blob）
var _zyAudioDuration  = 0;

/* 錄音狀態 */
var _zyRecorder      = null;
var _zyChunks        = [];
var _zyTimerInterval = null;
var _zyElapsed       = 0;
var ZY_MAX_SECONDS   = 8; // 單一符號發音，錄音時間不用長

/* ════════════════════════════════
   進入點（由 switchDbView 呼叫）
   ════════════════════════════════ */
function loadZhuyinTab() {
  if (!db || !currentTeacher) { setTimeout(loadZhuyinTab, 300); return; }
  _zyRenderRoot();
}

function _zyCollectionName() { return _zyAdminSection === 'combined' ? 'zhuyinCombinedSounds' : 'zhuyinSounds'; }
function _zyAllSymbolsForSection() {
  return _zyAdminSection === 'combined'
    ? ZY_COMBINED_YI.concat(ZY_COMBINED_WU, ZY_COMBINED_YU)
    : ZY_INITIALS.concat(ZY_FINALS);
}
function _zyGroupsForAdminSection() {
  return _zyAdminSection === 'combined'
    ? [ { title: 'ㄧ系', items: ZY_COMBINED_YI }, { title: 'ㄨ系', items: ZY_COMBINED_WU }, { title: 'ㄩ系', items: ZY_COMBINED_YU } ]
    : [ { title: '聲符', items: ZY_INITIALS }, { title: '韻符', items: ZY_FINALS } ];
}

function _zySwitchAdminSection(section) {
  _zyAdminSection = section;
  _zyData = section === 'combined' ? _zyDataCombined : _zyDataSingle;
  _zyRenderRoot();
}

/* ════════════════════════════════
   單音（37）／結合韻（22）符號列表
   ════════════════════════════════ */
function _zyRenderRoot() {
  var wrap = document.getElementById('zy-main');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  db.collection(_zyCollectionName()).get().then(function(snap) {
    var freshData = {};
    snap.forEach(function(doc) {
      var d = doc.data();
      freshData[doc.id] = { imageUrl: d.imageUrl || '', phrase: d.phrase || '', audioData: d.audioData || '' };
    });
    if (_zyAdminSection === 'combined') { _zyDataCombined = freshData; } else { _zyDataSingle = freshData; }
    _zyData = freshData;

    var allSymbols = _zyAllSymbolsForSection();
    var total      = allSymbols.length;
    var imgCount   = allSymbols.filter(function(s) { return _zyData[s] && _zyData[s].imageUrl; }).length;
    var audioCount = allSymbols.filter(function(s) { return _zyData[s] && _zyData[s].audioData; }).length;
    var tabHtml =
      '<div class="app-tabs-mini" style="margin-bottom:14px">' +
        '<button class="app-tab-mini' + (_zyAdminSection === 'single'   ? ' active' : '') + '" onclick="_zySwitchAdminSection(\'single\')">🔡 單音</button>' +
        '<button class="app-tab-mini' + (_zyAdminSection === 'combined' ? ' active' : '') + '" onclick="_zySwitchAdminSection(\'combined\')">🔗 結合韻</button>' +
      '</div>';
    var groupsHtml = _zyGroupsForAdminSection().map(function(g) {
      return '<div class="card-title" style="font-size:.92rem;margin:16px 0 10px">' + g.title + '</div>' + _zyBuildGridHtml(g.items);
    }).join('');

    wrap.innerHTML =
      tabHtml +
      '<div class="card-title" style="margin-bottom:6px">🔤 ' + (_zyAdminSection === 'combined' ? '結合韻圖庫' : '注音符號圖庫') +
        '<span style="font-size:.72rem;font-weight:700;color:var(--muted);margin-left:8px">' +
          '全校共用・圖片 ' + imgCount + ' / ' + total + '・發音錄音 ' + audioCount + ' / ' + total + '</span>' +
      '</div>' +
      '<p style="font-size:.78rem;color:var(--muted);margin-bottom:16px;line-height:1.6">' +
        '每個' + (_zyAdminSection === 'combined' ? '結合韻' : '注音符號') + '可以錄一段發音（取代不穩定的自動朗讀）、搭配一張圖片，和一句配對成功時會唸出來的口訣。' +
        '學生端點符號本身：有錄音就播錄音，沒有就退回自動朗讀；點圖片：唸完整口訣。' +
      '</p>' +
      groupsHtml;
  }).catch(function(e) {
    wrap.innerHTML = '<p style="color:var(--red)">載入失敗：' + e.message + '</p>';
  });
}

function _zyBuildGridHtml(symbols) {
  return '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px">' +
    symbols.map(function(s) {
      var d = _zyData[s] || {};
      var imgHtml = d.imageUrl
        ? '<img src="' + d.imageUrl + '" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;margin-bottom:6px">'
        : '<div style="width:100%;aspect-ratio:1;background:var(--gray-lt,#f5f5f5);border-radius:8px;margin-bottom:6px;' +
            'display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:1.6rem;font-family:\'Noto Serif TC\',serif">' +
            escHtml(s) + '</div>';
      var audioBadge = d.audioData
        ? '<span style="display:inline-block;font-size:.68rem;font-weight:800;color:#166534;background:#dcfce7;padding:1px 7px;border-radius:999px;margin-bottom:4px">🎙 已錄音</span>'
        : '<span style="display:inline-block;font-size:.68rem;font-weight:800;color:var(--muted);background:var(--gray-lt,#f5f5f5);padding:1px 7px;border-radius:999px;margin-bottom:4px">尚未錄音</span>';
      return '<div style="border:1.5px solid var(--border);border-radius:10px;padding:10px;text-align:center;background:var(--white)">' +
        imgHtml +
        '<div style="font-weight:900;font-size:1.3rem;margin-bottom:2px;font-family:\'Noto Serif TC\',serif">' + escHtml(s) + '</div>' +
        audioBadge +
        '<div style="font-size:.7rem;color:var(--muted);margin-bottom:8px;line-height:1.4;min-height:2.4em">' +
          escHtml(d.phrase || '（尚未填寫口訣）') +
        '</div>' +
        '<button class="wi-cat-enter-btn" style="width:100%" onclick="_zyOpenEdit(\'' + s + '\')">編輯 →</button>' +
      '</div>';
    }).join('') +
  '</div>';
}

/* ════════════════════════════════
   編輯 Modal
   ════════════════════════════════ */
function _zyOpenEdit(symbol) {
  _zyEditingSymbol = symbol;
  _zyPendingBlob   = null;
  _zyPendingAudio  = null;
  _zyAudioDuration = 0;
  _zyStopRecording();
  var d = _zyData[symbol] || {};

  document.getElementById('zy-modal-title').textContent = '編輯「' + symbol + '」';
  document.getElementById('zy-modal-phrase').value = d.phrase || '';
  document.getElementById('zy-file').value = '';
  var previewWrap = document.getElementById('zy-modal-preview');
  previewWrap.innerHTML = d.imageUrl
    ? '<img src="' + d.imageUrl + '" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:1.5px solid var(--border)">'
    : '';

  document.getElementById('zy-audio-file').value = '';
  document.getElementById('zy-audio-error').textContent = '';
  document.getElementById('zy-rec-timer').textContent = '0.0s';
  var recBtn = document.getElementById('zy-rec-btn');
  if (recBtn) { recBtn.textContent = '🎙 開始錄音'; recBtn.className = 'ac-rec-btn'; }
  var audioPreview = document.getElementById('zy-audio-preview');
  if (audioPreview) {
    if (d.audioData) { audioPreview.src = d.audioData; audioPreview.style.display = ''; }
    else { audioPreview.src = ''; audioPreview.style.display = 'none'; }
  }

  document.getElementById('zy-modal').style.display = 'flex';
}

function _zyCloseEdit() {
  _zyStopRecording();
  document.getElementById('zy-modal').style.display = 'none';
}

function _zyOpenGoogleSearch() {
  if (!_zyEditingSymbol) return;
  window.open('https://www.google.com/search?q=' + encodeURIComponent(_zyEditingSymbol + ' 注音') + '&tbm=isch', '_blank');
}

function _zySetPreviewFromBlob(blob) {
  _zyPendingBlob = blob;
  var url  = URL.createObjectURL(blob);
  var wrap = document.getElementById('zy-modal-preview');
  if (wrap) wrap.innerHTML = '<img src="' + url + '" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:1.5px solid var(--border)">';
}

function _zyFileSelected(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  _zySetPreviewFromBlob(file);
}

/* ── 貼上圖片（Ctrl+V）：只在編輯 Modal 開著的時候處理 ── */
document.addEventListener('paste', function(e) {
  var modal = document.getElementById('zy-modal');
  if (!modal || modal.style.display !== 'flex') return;
  var items = (e.clipboardData || {}).items || [];
  for (var i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      e.preventDefault();
      var blob = items[i].getAsFile();
      if (blob) _zySetPreviewFromBlob(blob);
      return;
    }
  }
});

/* ════════════════════════════════
   符號發音錄音（MediaRecorder，沿用 audio-clips.js 的模式）
   ════════════════════════════════ */
function _zyToggleRecord() {
  if (_zyRecorder && _zyRecorder.state === 'recording') {
    _zyStopRecording();
  } else {
    _zyStartRecording();
  }
}

function _zyStartRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    _zyAudioError('您的瀏覽器不支援錄音功能，請改用 Chrome 或 Edge');
    return;
  }
  navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
    _zyChunks = []; _zyElapsed = 0; _zyPendingAudio = null;
    _zyAudioError('');

    var mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : '';
    _zyRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});

    _zyRecorder.ondataavailable = function(e) { if (e.data.size > 0) _zyChunks.push(e.data); };
    _zyRecorder.onstop = function() {
      stream.getTracks().forEach(function(t) { t.stop(); });
      _zyOnAudioStopped();
    };
    _zyRecorder.start(100);

    var recBtn = document.getElementById('zy-rec-btn');
    if (recBtn) { recBtn.textContent = '⏹ 停止'; recBtn.className = 'ac-rec-btn recording'; }

    var t0 = Date.now();
    _zyTimerInterval = setInterval(function() {
      _zyElapsed = (Date.now() - t0) / 1000;
      var el = document.getElementById('zy-rec-timer');
      if (el) el.textContent = _zyElapsed.toFixed(1) + 's';
      if (_zyElapsed >= ZY_MAX_SECONDS) _zyStopRecording();
    }, 100);
  }).catch(function(e) {
    _zyAudioError('無法存取麥克風：' + (e.message || e));
  });
}

function _zyStopRecording() {
  if (_zyRecorder && _zyRecorder.state === 'recording') _zyRecorder.stop();
  clearInterval(_zyTimerInterval); _zyTimerInterval = null;
  var recBtn = document.getElementById('zy-rec-btn');
  if (recBtn) { recBtn.textContent = '🎙 開始錄音'; recBtn.className = 'ac-rec-btn'; }
}

function _zyOnAudioStopped() {
  if (!_zyChunks.length) return;
  var blob = new Blob(_zyChunks, { type: _zyChunks[0].type || 'audio/webm' });
  _zyAudioDuration = _zyElapsed;
  _zySetAudioBlob(blob);
}

function _zyAudioFileSelected(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 500 * 1024) {
    _zyAudioError('檔案超過 500KB，請選擇較小的音檔');
    input.value = '';
    return;
  }
  _zyAudioDuration = 0;
  _zySetAudioBlob(file);
}

function _zySetAudioBlob(blob) {
  _zyPendingAudio = blob;
  _zyAudioError('');

  var url     = URL.createObjectURL(blob);
  var preview = document.getElementById('zy-audio-preview');
  if (preview) {
    preview.src = url;
    preview.style.display = '';
    preview.onloadedmetadata = function() {
      if (!_zyAudioDuration) _zyAudioDuration = preview.duration || 0;
      URL.revokeObjectURL(url);
    };
  }
}

function _zyAudioError(msg) {
  var el = document.getElementById('zy-audio-error');
  if (el) el.textContent = msg;
}

/* ════════════════════════════════
   儲存
   ════════════════════════════════ */
function _zySaveEdit() {
  var phraseEl = document.getElementById('zy-modal-phrase');
  var phrase   = (phraseEl.value || '').trim();
  var symbol   = _zyEditingSymbol;
  if (!symbol) return;
  _zyStopRecording();

  function doSave(imageUrl, audioData) {
    var existing = _zyData[symbol] || {};
    var data = {
      phrase:    phrase,
      imageUrl:  imageUrl  || existing.imageUrl  || '',
      audioData: audioData || existing.audioData || ''
    };
    db.collection(_zyCollectionName()).doc(symbol).set(data).then(function() {
      showToast('✅ 已儲存「' + symbol + '」');
      _zyCloseEdit();
      _zyRenderRoot();
    }).catch(function(e) { showToast('❌ 儲存失敗：' + e.message); });
  }

  function withImage(cb) {
    if (_zyPendingBlob) _wiCompressToDataUrl(_zyPendingBlob, 400, 0.82, cb);
    else cb(null);
  }

  function withAudio(cb) {
    if (!_zyPendingAudio) { cb(null); return; }
    var reader = new FileReader();
    reader.onload = function(e) {
      var dataUrl = e.target.result;
      if (dataUrl.length / 1024 > 900) {
        _zyAudioError('錄音轉換後超過 900KB，請錄短一點再試一次');
        return;
      }
      cb(dataUrl);
    };
    reader.readAsDataURL(_zyPendingAudio);
  }

  withImage(function(imageUrl) {
    withAudio(function(audioData) {
      doSave(imageUrl, audioData);
    });
  });
}
