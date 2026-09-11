/**
 * admin/zhuyin.js — 注音趣：注音符號圖庫（37 個固定符號，全校共用資料）
 * 依賴：shared.js（db、showToast、escHtml）、init.js（currentTeacher）、word-image.js（_wiCompressToDataUrl）
 */
'use strict';

var ZY_INITIALS = ['ㄅ','ㄆ','ㄇ','ㄈ','ㄉ','ㄊ','ㄋ','ㄌ','ㄍ','ㄎ','ㄏ','ㄐ','ㄑ','ㄒ','ㄓ','ㄔ','ㄕ','ㄖ','ㄗ','ㄘ','ㄙ'];
var ZY_FINALS   = ['ㄧ','ㄨ','ㄩ','ㄚ','ㄛ','ㄜ','ㄝ','ㄞ','ㄟ','ㄠ','ㄡ','ㄢ','ㄣ','ㄤ','ㄥ','ㄦ'];

var _zyData          = {}; // { symbol: {imageUrl, phrase} }
var _zyEditingSymbol = '';
var _zyPendingBlob   = null;

/* ════════════════════════════════
   進入點（由 switchDbView 呼叫）
   ════════════════════════════════ */
function loadZhuyinTab() {
  if (!db || !currentTeacher) { setTimeout(loadZhuyinTab, 300); return; }
  _zyRenderRoot();
}

/* ════════════════════════════════
   37 個符號列表
   ════════════════════════════════ */
function _zyRenderRoot() {
  var wrap = document.getElementById('zy-main');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  db.collection('zhuyinSounds').get().then(function(snap) {
    _zyData = {};
    snap.forEach(function(doc) {
      _zyData[doc.id] = { imageUrl: doc.data().imageUrl || '', phrase: doc.data().phrase || '' };
    });

    var doneCount = ZY_INITIALS.concat(ZY_FINALS).filter(function(s) {
      return _zyData[s] && _zyData[s].imageUrl;
    }).length;

    wrap.innerHTML =
      '<div class="card-title" style="margin-bottom:6px">🔤 注音符號圖庫' +
        '<span style="font-size:.72rem;font-weight:700;color:var(--muted);margin-left:8px">全校共用・已建立 ' + doneCount + ' / 37 個</span>' +
      '</div>' +
      '<p style="font-size:.78rem;color:var(--muted);margin-bottom:16px;line-height:1.6">' +
        '每個注音符號搭配一張圖片，和一句配對成功時會唸出來的口訣（例如「ㄅㄅㄅ，寶貝的ㄅ」）。' +
        '學生端點符號本身只會唸出符號；點圖片才會唸出完整口訣。還沒建立圖片的符號，學生端仍會顯示符號，只是沒有圖片可點。' +
      '</p>' +
      '<div class="card-title" style="font-size:.92rem;margin:16px 0 10px">聲符</div>' +
      _zyBuildGridHtml(ZY_INITIALS) +
      '<div class="card-title" style="font-size:.92rem;margin:20px 0 10px">韻符</div>' +
      _zyBuildGridHtml(ZY_FINALS);
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
      return '<div style="border:1.5px solid var(--border);border-radius:10px;padding:10px;text-align:center;background:var(--white)">' +
        imgHtml +
        '<div style="font-weight:900;font-size:1.3rem;margin-bottom:4px;font-family:\'Noto Serif TC\',serif">' + escHtml(s) + '</div>' +
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
  _zyPendingBlob    = null;
  var d = _zyData[symbol] || {};

  document.getElementById('zy-modal-title').textContent = '編輯「' + symbol + '」';
  document.getElementById('zy-modal-phrase').value = d.phrase || '';
  document.getElementById('zy-file').value = '';
  var previewWrap = document.getElementById('zy-modal-preview');
  previewWrap.innerHTML = d.imageUrl
    ? '<img src="' + d.imageUrl + '" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:1.5px solid var(--border)">'
    : '';
  document.getElementById('zy-modal').style.display = 'flex';
}

function _zyCloseEdit() {
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

function _zySaveEdit() {
  var phraseEl = document.getElementById('zy-modal-phrase');
  var phrase   = (phraseEl.value || '').trim();
  var symbol   = _zyEditingSymbol;
  if (!symbol) return;

  function doSave(imageUrl) {
    var existing = _zyData[symbol] || {};
    var data = { phrase: phrase, imageUrl: imageUrl || existing.imageUrl || '' };
    db.collection('zhuyinSounds').doc(symbol).set(data).then(function() {
      showToast('✅ 已儲存「' + symbol + '」');
      _zyCloseEdit();
      _zyRenderRoot();
    }).catch(function(e) { showToast('❌ 儲存失敗：' + e.message); });
  }

  if (_zyPendingBlob) {
    _wiCompressToDataUrl(_zyPendingBlob, 400, 0.82, function(dataUrl) { doSave(dataUrl); });
  } else {
    doSave(null);
  }
}
