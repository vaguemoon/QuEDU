/**
 * write.js — 部件描寫練習（沿用 HanziWriter）
 * 部分變形偏旁（如「氵」「扌」）可能沒有筆順資料，找不到資料的部件會被跳過，
 * 全部都跳過時顯示提示，不會卡住畫面。
 */
'use strict';

var writeQueue  = []; // 尚可嘗試的部件，成功寫完會被移到隊尾循環
var writeWriter = null;

function startWrite() {
  var radicals = getDistinctRadicals();
  if (!radicals.length) { showToast('這個練習集還沒有部件'); return; }
  writeQueue = shuffle(radicals);
  showPage('write');
  _rkWriteLoadNext();
}

function writeNext() {
  if (writeQueue.length > 1) {
    var cur = writeQueue.shift();
    writeQueue.push(cur);
  }
  _rkWriteLoadNext();
}

function _rkWriteLoadNext() {
  if (!writeQueue.length) { _rkShowWriteEmpty(); return; }
  _rkTryLoadWriteChar(writeQueue[0]);
}

function _rkTryLoadWriteChar(radical) {
  var statusEl = document.getElementById('write-status');
  var progEl   = document.getElementById('write-progress');
  if (statusEl) statusEl.textContent = '跟著筆順描寫「' + radical + '」';
  if (progEl)   progEl.textContent   = '共 ' + writeQueue.length + ' 個部件可練習';

  var target = document.getElementById('write-target');
  if (!target || target.tagName !== 'DIV') return;
  var sz = target.getBoundingClientRect().width || 260;
  target.innerHTML = '';

  try {
    writeWriter = HanziWriter.create(target, radical, {
      width: sz, height: sz,
      padding: Math.round(sz * 0.08),
      showOutline: true,
      strokeColor: '#4a90d9',
      outlineColor: '#c8dff5',
      onLoadCharDataSuccess: function() {
        writeWriter.quiz({
          onComplete: function() {
            setTimeout(function() {
              updateRadicalMastery(radical, 1, 1);
              writeNext();
            }, 900);
          }
        });
      },
      onLoadCharDataError: function() {
        writeQueue.shift();
        _rkWriteLoadNext();
      }
    });
  } catch (e) {
    writeQueue.shift();
    _rkWriteLoadNext();
  }
}

function _rkShowWriteEmpty() {
  var statusEl = document.getElementById('write-status');
  var progEl   = document.getElementById('write-progress');
  if (statusEl) statusEl.textContent = '這個練習集找不到可描寫的部件';
  if (progEl)   progEl.textContent   = '';
  var target = document.getElementById('write-target');
  if (target) {
    target.outerHTML = '<div class="rk-write-empty" id="write-target">😕 這個練習集的部件都沒有筆順資料，換個模式練習吧</div>';
  }
}
