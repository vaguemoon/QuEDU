/**
 * admin/audio-clips.js — 音檔管理
 * 支援麥克風錄音（max 10s）或上傳音檔（max 500KB）
 * 儲存：WebM/Opus base64 → Firestore audioClips
 * 依賴：shared.js（db、showToast）、init.js（currentTeacher）
 */
'use strict';

var _acSubject        = 'chinese';
var _acRecorder       = null;
var _acChunks         = [];
var _acTimerInterval  = null;
var _acElapsed        = 0;
var _acMaxSeconds     = 60;
var _acPendingBlob    = null;
var _acPendingDur     = 0;

/* ════════════════════════════
   進入點
   ════════════════════════════ */
function loadAudioClipsTab(subject) {
  _acSubject = subject || 'chinese';
  if (!db || !currentTeacher) { setTimeout(function() { loadAudioClipsTab(subject); }, 300); return; }
  _acRenderList();
}

/* ════════════════════════════
   列表
   ════════════════════════════ */
function _acRenderList() {
  var wrap = document.getElementById('ac-list-wrap-' + _acSubject);
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  db.collection('audioClips')
    .where('teacherUid', '==', currentTeacher.uid)
    .get()
    .then(function(snap) {
      var clips = [];
      snap.forEach(function(doc) {
        var d = doc.data();
        if (d.subject === _acSubject) clips.push({ id: doc.id, data: d });
      });
      clips.sort(function(a, b) { return (b.data.createdAt || '') > (a.data.createdAt || '') ? 1 : -1; });

      if (!clips.length) {
        wrap.innerHTML = '<p style="color:var(--muted);font-size:.88rem;padding:8px 0">尚未新增任何音檔</p>';
        return;
      }

      var html = '<div style="display:flex;flex-direction:column;gap:10px">';
      clips.forEach(function(c) {
        var d   = c.data;
        var dur = d.duration ? d.duration.toFixed(1) + 's' : '—';
        var dt  = d.createdAt ? d.createdAt.slice(0, 10) : '';
        html +=
          '<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;' +
          'border:1.5px solid var(--border);border-radius:12px;background:white">' +
            '<button onclick="_acPlay(\'' + c.id + '\')" title="播放" ' +
              'style="flex-shrink:0;width:38px;height:38px;border-radius:50%;border:none;' +
              'background:var(--blue);color:white;font-size:1.05rem;cursor:pointer;' +
              'display:flex;align-items:center;justify-content:center">▶</button>' +
            '<div style="flex:1;min-width:0">' +
              '<div style="font-size:.92rem;font-weight:800;color:var(--text);' +
              'white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + _acEsc(d.name || '未命名') + '</div>' +
              '<div style="font-size:.72rem;color:var(--muted);margin-top:2px">' +
              dur + (dt ? ' · ' + dt : '') + '</div>' +
            '</div>' +
            '<button onclick="_acDelete(\'' + c.id + '\')" ' +
              'style="flex-shrink:0;padding:5px 12px;border:1.5px solid #fecaca;border-radius:8px;' +
              'background:white;color:var(--red);font-size:.78rem;font-weight:800;cursor:pointer;font-family:inherit">' +
              '刪除</button>' +
          '</div>';
      });
      html += '</div>';
      wrap.innerHTML = html;
    })
    .catch(function(e) {
      wrap.innerHTML = '<p style="color:var(--red);font-size:.88rem">載入失敗：' + e.message + '</p>';
    });
}

/* ── 播放（從 base64 重建） ── */
function _acPlay(docId) {
  db.collection('audioClips').doc(docId).get().then(function(doc) {
    if (!doc.exists || !doc.data().audioData) return;
    var audio = new Audio(doc.data().audioData);
    audio.play();
  }).catch(function(e) { showToast('播放失敗：' + e.message); });
}

/* ── 刪除 ── */
function _acDelete(docId) {
  if (!confirm('確定要刪除這個音檔嗎？')) return;
  db.collection('audioClips').doc(docId).delete()
    .then(function() { showToast('已刪除音檔'); _acRenderList(); })
    .catch(function(e) { showToast('❌ 刪除失敗：' + e.message); });
}

/* ════════════════════════════
   Modal
   ════════════════════════════ */
function openAcModal(subject) {
  _acSubject = subject;
  _acResetModal();
  var modal = document.getElementById('ac-modal');
  if (modal) modal.style.display = 'flex';
}

function closeAcModal() {
  _acStopRecording();
  _acResetModal();
  var modal = document.getElementById('ac-modal');
  if (modal) modal.style.display = 'none';
}

function _acResetModal() {
  _acChunks        = [];
  _acPendingBlob   = null;
  _acPendingDur    = 0;
  _acElapsed       = 0;
  clearInterval(_acTimerInterval);
  _acTimerInterval = null;

  var els = {
    name:     document.getElementById('ac-name'),
    timer:    document.getElementById('ac-timer'),
    recBtn:   document.getElementById('ac-rec-btn'),
    preview:  document.getElementById('ac-preview'),
    error:    document.getElementById('ac-error'),
    sizeWarn: document.getElementById('ac-size-warn'),
    file:     document.getElementById('ac-file')
  };
  if (els.name)     els.name.value = '';
  if (els.timer)    els.timer.textContent = '0.0s';
  if (els.recBtn)   { els.recBtn.textContent = '🎙 開始錄音'; els.recBtn.className = 'ac-rec-btn'; }
  if (els.preview)  { els.preview.src = ''; els.preview.style.display = 'none'; }
  if (els.error)    els.error.textContent = '';
  if (els.sizeWarn) els.sizeWarn.style.display = 'none';
  if (els.file)     els.file.value = '';
  _acSetConfirm(false);
}

function _acSetConfirm(enabled) {
  var btn = document.getElementById('ac-confirm-btn');
  if (!btn) return;
  btn.disabled    = !enabled;
  btn.style.opacity = enabled ? '1' : '.5';
}

/* ════════════════════════════
   錄音
   ════════════════════════════ */
function _acToggleRecord() {
  if (_acRecorder && _acRecorder.state === 'recording') {
    _acStopRecording();
  } else {
    _acStartRecording();
  }
}

function _acStartRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    _acError('您的瀏覽器不支援錄音功能，請改用 Chrome 或 Edge');
    return;
  }
  navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
    _acChunks = []; _acElapsed = 0; _acPendingBlob = null;
    _acSetConfirm(false);

    var preview = document.getElementById('ac-preview');
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    _acError('');

    var mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : '';
    _acRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});

    _acRecorder.ondataavailable = function(e) { if (e.data.size > 0) _acChunks.push(e.data); };
    _acRecorder.onstop = function() {
      stream.getTracks().forEach(function(t) { t.stop(); });
      _acOnStopped();
    };
    _acRecorder.start(100);

    var recBtn = document.getElementById('ac-rec-btn');
    if (recBtn) { recBtn.textContent = '⏹ 停止'; recBtn.className = 'ac-rec-btn recording'; }

    var t0 = Date.now();
    _acTimerInterval = setInterval(function() {
      _acElapsed = (Date.now() - t0) / 1000;
      var el = document.getElementById('ac-timer');
      if (el) el.textContent = _acElapsed.toFixed(1) + 's';
      if (_acElapsed >= _acMaxSeconds) _acStopRecording();
    }, 100);
  }).catch(function(e) {
    _acError('無法存取麥克風：' + (e.message || e));
  });
}

function _acStopRecording() {
  if (_acRecorder && _acRecorder.state === 'recording') _acRecorder.stop();
  clearInterval(_acTimerInterval); _acTimerInterval = null;
  var recBtn = document.getElementById('ac-rec-btn');
  if (recBtn) { recBtn.textContent = '🎙 開始錄音'; recBtn.className = 'ac-rec-btn'; }
}

function _acOnStopped() {
  if (!_acChunks.length) return;
  var blob = new Blob(_acChunks, { type: _acChunks[0].type || 'audio/webm' });
  _acPendingDur = _acElapsed;
  _acSetBlob(blob);
}

/* ════════════════════════════
   檔案上傳
   ════════════════════════════ */
function _acFileSelected(input) {
  var file = input.files[0];
  if (!file) return;
  if (file.size > 500 * 1024) {
    _acError('檔案超過 500KB，請選擇較小的音檔');
    input.value = '';
    return;
  }
  _acPendingDur = 0;
  _acSetBlob(file);
}

function _acSetBlob(blob) {
  _acPendingBlob = blob;
  _acError('');

  var sizeKB   = Math.round(blob.size / 1024);
  var sizeWarn = document.getElementById('ac-size-warn');
  if (sizeWarn) {
    sizeWarn.style.display = sizeKB > 600 ? '' : 'none';
    if (sizeKB > 600) sizeWarn.textContent = '⚠️ 約 ' + sizeKB + 'KB，轉換後接近 Firestore 上限，建議縮短錄音或壓縮音檔';
  }

  var url     = URL.createObjectURL(blob);
  var preview = document.getElementById('ac-preview');
  if (preview) {
    preview.src = url;
    preview.style.display = '';
    preview.onloadedmetadata = function() {
      if (!_acPendingDur) _acPendingDur = preview.duration || 0;
      URL.revokeObjectURL(url);
    };
  }
  _acSetConfirm(true);
}

/* ════════════════════════════
   儲存至 Firestore
   ════════════════════════════ */
function _acConfirmSave() {
  if (!_acPendingBlob || !currentTeacher) return;
  var nameEl = document.getElementById('ac-name');
  var name   = (nameEl && nameEl.value.trim()) || '音檔 ' + new Date().toLocaleString('zh-TW');
  var btn    = document.getElementById('ac-confirm-btn');
  if (btn) { btn.disabled = true; btn.textContent = '儲存中…'; }

  var reader = new FileReader();
  reader.onload = function(e) {
    var dataUrl = e.target.result;
    if (dataUrl.length / 1024 > 900) {
      _acError('轉換後超過 Firestore 上限（900KB），請使用更短的錄音');
      if (btn) { btn.disabled = false; btn.textContent = '儲存'; }
      return;
    }
    db.collection('audioClips').add({
      teacherUid: currentTeacher.uid,
      subject:    _acSubject,
      name:       name,
      audioData:  dataUrl,
      duration:   Math.round(_acPendingDur * 10) / 10,
      createdAt:  new Date().toISOString()
    }).then(function() {
      showToast('✅ 音檔已儲存');
      closeAcModal();
      _acRenderList();
    }).catch(function(e) {
      _acError('儲存失敗：' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = '儲存'; }
    });
  };
  reader.readAsDataURL(_acPendingBlob);
}

/* ── 工具 ── */
function _acError(msg) {
  var el = document.getElementById('ac-error');
  if (el) el.textContent = msg;
}
function _acEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
