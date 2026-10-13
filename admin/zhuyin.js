/**
 * admin/zhuyin.js — 注音趣：符號圖庫（單音 37 個＋結合韻 22 個，兩區固定符號，全校共用資料）
 * 依賴：shared.js（db、showToast、escHtml）、init.js（currentTeacher）、word-image.js（_wiCompressToDataUrl）
 * 符號發音錄音：MediaRecorder 錄完不管是什麼格式，一律用 Web Audio API 解碼再轉成 WAV 存檔
 * （iPad 上 WebM 完全無法播放，WAV 是純 PCM 沒有這個問題，見 _zyTranscodeToWav）
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

    /* 優先選 AAC/MP4：iPad 上所有瀏覽器都被迫用 Safari 的 WebKit 引擎，WebM 容器完全無法
       播放（不管哪個 codec 都一樣）——這是平板上「TTS 正常、但自己錄的音檔放不出來」的
       真正原因，不是自動播放限制或時機問題。MP4/AAC 桌機瀏覽器錄、iPad 播放都支援；
       只有在錄音瀏覽器真的不支援 MP4 錄製時才退回 WebM（退回後那筆錄音在 iPad 上一樣會
       播不出來，但至少不會讓完全不支援 MediaRecorder mimeType 限制的舊瀏覽器直接整個失敗）。*/
    var mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].filter(function(m) {
      return MediaRecorder.isTypeSupported(m);
    })[0] || '';
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

/* 選 MP4 優先錄（上面的 mimeType 清單）結果還是在 iPad 上放不出來——跨瀏覽器猜
   MediaRecorder 到底支援錄哪個格式太不可靠，改成不管瀏覽器錄成什麼格式，錄完都用
   Web Audio API 解碼、再手動編碼成 WAV（純 PCM，沒有容器/編碼支援的問題，所有瀏覽器
   包含 iPad Safari 都原生看得懂）。符號發音最長只錄 8 秒（ZY_MAX_SECONDS），轉成 WAV
   即使不壓縮檔案也頂多幾百 KB，在 Firestore 900KB 上限內綽綽有餘。*/
function _zyEncodeWav(audioBuffer) {
  var sampleRate = audioBuffer.sampleRate;
  var samples = audioBuffer.getChannelData(0); // 只取第一聲道，人聲錄音不需要立體聲
  var buffer = new ArrayBuffer(44 + samples.length * 2);
  var view = new DataView(buffer);

  function writeStr(offset, str) {
    for (var i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);          // PCM
  view.setUint16(22, 1, true);          // 單聲道
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);         // 16-bit
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  var offset = 44;
  for (var i = 0; i < samples.length; i++, offset += 2) {
    var s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

function _zyTranscodeToWav(blob, callback) {
  var AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) { callback(blob); return; } // 太舊的瀏覽器沒有 Web Audio API，退回原始錄音格式
  var reader = new FileReader();
  reader.onload = function(e) {
    var ctx = new AudioCtx();
    ctx.decodeAudioData(e.target.result, function(audioBuffer) {
      var wavBlob = _zyEncodeWav(audioBuffer);
      ctx.close();
      callback(wavBlob);
    }, function(err) {
      console.error('轉成 WAV 失敗，改存原始錄音格式', err);
      ctx.close();
      callback(blob); // 轉檔失敗就退回原始格式，不要卡住整個存檔流程
    });
  };
  reader.readAsArrayBuffer(blob);
}

function _zyOnAudioStopped() {
  if (!_zyChunks.length) return;
  var blob = new Blob(_zyChunks, { type: _zyChunks[0].type || 'audio/webm' });
  _zyAudioDuration = _zyElapsed;
  _zyAudioError('轉檔中…');
  _zyTranscodeToWav(blob, function(finalBlob) {
    _zySetAudioBlob(finalBlob);
  });
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
