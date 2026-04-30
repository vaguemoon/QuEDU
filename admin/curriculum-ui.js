/**
 * admin/curriculum-ui.js — 課程版本 UI 渲染（手風琴列表、摺疊面板）
 * 依賴：shared.js（db、showToast）、curriculum-data.js（deleteVersionById、deleteLesson）
 */
'use strict';

var allVersions = [];
var _loData    = {}; // 課次覆寫快取 { key: { vId, lessonId, chars, charOverrides } }
var _loCounter = 0;

/* 跳脫 inline onclick 字串中的單引號與反斜線 */
function _escQ(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/* 刪除版本按鈕 HTML */
function _deleteVersionBtn(vId, vName) {
  return '<div style="padding-top:12px;margin-top:10px;border-top:1px solid var(--border);text-align:right">' +
    '<button class="btn-danger" style="font-size:.78rem;padding:5px 12px" ' +
      'onclick="deleteVersionById(\'' + _escQ(vId) + '\',\'' + _escQ(vName) + '\')">🗑 刪除此版本</button>' +
    '</div>';
}

// ════════════════════════════════════════
//  版本清單
// ════════════════════════════════════════

function loadVersions() {
  if (!db) { setTimeout(loadVersions, 500); return; }
  var wrap = document.getElementById('version-list-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  db.collection('curriculum').get().then(function(snap) {
    allVersions = [];
    snap.forEach(function(doc) {
      allVersions.push({
        id: doc.id,
        name: doc.data().name,
        lessonCount: doc.data().lessonCount || 0
      });
    });

    /* 更新手動新增的 datalist */
    var dl = document.getElementById('version-datalist');
    if (dl) {
      dl.innerHTML = allVersions.map(function(v) {
        return '<option value="' + v.name + '">';
      }).join('');
    }

    var manualCard = document.getElementById('manual-add-card');
    if (manualCard) manualCard.style.display = '';

    if (!allVersions.length) {
      wrap.innerHTML =
        '<div style="color:var(--muted);font-size:.88rem;font-weight:600;padding:8px 0">' +
        '還沒有課程版本，請先建立。</div>';
      return;
    }

    wrap.innerHTML = '';
    allVersions.forEach(function(v) {
      var item = document.createElement('div');
      item.className = 'version-accordion';
      item.id = 'vi-' + v.id;

      var header = document.createElement('div');
      header.className = 'version-accordion-header';
      header.innerHTML =
        '<div style="display:flex;align-items:center;gap:10px">' +
          '<div class="version-name">📚 ' + v.name + '</div>' +
          '<div class="version-meta">' + v.lessonCount + ' 課</div>' +
        '</div>' +
        '<div style="font-size:.8rem;color:var(--blue);font-weight:700;' +
              'display:flex;align-items:center;gap:5px">' +
          '查看 <span id="vi-ico-' + v.id + '" style="font-size:.7rem">▶</span>' +
        '</div>';
      header.addEventListener('click', (function(id, name) {
        return function() { toggleVersionContent(id, name); };
      })(v.id, v.name));

      /* 預設閉合 */
      var content = document.createElement('div');
      content.className = 'version-accordion-body';
      content.id = 'vc-' + v.id;
      content.style.display = 'none';

      item.appendChild(header);
      item.appendChild(content);
      wrap.appendChild(item);
    });
  }).catch(function(e) {
    var w = document.getElementById('version-list-wrap');
    if (w) {
      var div = document.createElement('div');
      div.style.cssText = 'color:var(--red);font-size:.88rem;font-weight:700';
      div.textContent = '載入失敗：' + e.message;
      w.innerHTML = '';
      w.appendChild(div);
    }
  });
}

// ════════════════════════════════════════
//  版本手風琴展開 / 收合
// ════════════════════════════════════════

function toggleVersionContent(vId, vName) {
  var item    = document.getElementById('vi-' + vId);
  var content = document.getElementById('vc-' + vId);
  var ico     = document.getElementById('vi-ico-' + vId);
  if (!content) return;

  if (content.style.display !== 'none') {
    content.style.display = 'none';
    if (ico)  ico.textContent = '▶';
    if (item) item.classList.remove('open');
  } else {
    content.style.display = '';
    if (ico)  ico.textContent = '▼';
    if (item) item.classList.add('open');
    if (!content.dataset.loaded) {
      loadVersionContent(vId, vName, content);
    }
  }
}

/* 載入並渲染某版本的課程內容（手風琴 inline） */
function loadVersionContent(vId, vName, container) {
  container.innerHTML =
    '<div class="loading-wrap" style="padding:20px 0"><div class="spinner"></div></div>';
  container.dataset.vname = vName;

  db.collection('curriculum').doc(vId).collection('lessons').get()
    .then(function(snap) {
      db.collection('curriculum').doc(vId)
        .update({ lessonCount: snap.size }).catch(function() {});

      if (snap.empty) {
        container.innerHTML =
          '<div style="color:var(--muted);font-size:.88rem;font-weight:600;padding:12px 0">' +
          '這個版本還沒有課程，可以用上方表單手動新增。</div>' +
          _deleteVersionBtn(vId, vName);
        container.dataset.loaded = '1';
        return;
      }

      /* 依冊次分組 */
      var grades = {}, gradeOrder = [];
      snap.forEach(function(doc) {
        var d = doc.data();
        var g = d.grade || d.bookNum || '未知';
        if (!grades[g]) { grades[g] = []; gradeOrder.push(g); }
        grades[g].push(Object.assign({ id: doc.id }, d));
      });
      gradeOrder = gradeOrder.filter(function(v, i, a) { return a.indexOf(v) === i; });
      gradeOrder.forEach(function(g) {
        grades[g].sort(function(a, b) { return (a.lessonNum || 0) - (b.lessonNum || 0); });
      });

      /* 渲染冊次折疊區塊 */
      var html = '';
      gradeOrder.forEach(function(grade) {
        var gId = 'vg-' + vId + '-' + grade.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_');
        html +=
          '<div class="book-section">' +
          '<div class="book-title" onclick="toggleGradeSection(\'' + _escQ(gId) + '\')">' +
            '<span>' + grade + '</span>' +
            '<span id="' + gId + '-ico" style="font-size:.72rem">▼</span>' +
          '</div>' +
          '<div class="book-grade-body" id="' + gId + '" style="display:none">';

        grades[grade].forEach(function(lesson) {
          var wordsHtml = (lesson.words && lesson.words.length)
            ? '<div class="lesson-words" style="font-size:.78rem;color:var(--muted);margin-top:3px">詞：' + lesson.words.join('・') + '</div>'
            : '';
          var loKey = 'lo' + (_loCounter++);
          _loData[loKey] = {
            vId: vId, lessonId: lesson.id,
            chars: lesson.chars || [], charOverrides: lesson.charOverrides || {}
          };
          html +=
            '<div class="lesson-accordion">' +
              '<div class="lesson-item lesson-item-toggle" onclick="toggleLessonOverride(\'' + loKey + '\')">' +
                '<div class="lesson-num">第 ' + lesson.lessonNum + ' 課</div>' +
                '<div class="lesson-name">' + lesson.name + '</div>' +
                '<div class="lesson-chars">' + lesson.chars.join('') + wordsHtml + '</div>' +
                '<div class="lesson-actions">' +
                  '<span id="lo-ico-' + loKey + '" style="font-size:.65rem;color:var(--blue);width:10px;flex-shrink:0">▶</span>' +
                  '<button class="btn-tiny" onclick="event.stopPropagation();deleteLesson(\'' + _escQ(vId) + '\',\'' + _escQ(lesson.id) + '\')">🗑</button>' +
                '</div>' +
              '</div>' +
              '<div id="lo-body-' + loKey + '" class="lesson-override-body" style="display:none"></div>' +
            '</div>';
        });

        html += '</div></div>';
      });
      html += _deleteVersionBtn(vId, vName);

      container.innerHTML = html;
      container.dataset.loaded = '1';
    })
    .catch(function(e) {
      var div = document.createElement('div');
      div.style.cssText = 'color:var(--red);font-size:.88rem;padding:12px 0';
      div.textContent = '載入失敗：' + e.message;
      container.innerHTML = '';
      container.appendChild(div);
    });
}

// ════════════════════════════════════════
//  冊次折疊
// ════════════════════════════════════════

function toggleGradeSection(gId) {
  var el  = document.getElementById(gId);
  var ico = document.getElementById(gId + '-ico');
  if (!el) return;
  var hidden = el.style.display === 'none';
  el.style.display = hidden ? '' : 'none';
  if (ico) ico.textContent = hidden ? '▲' : '▼';
}

// ════════════════════════════════════════
//  整體版本面板折疊（卡片右上角 ▲▼）
// ════════════════════════════════════════

function toggleVersionsPanel() {
  var body = document.getElementById('versions-panel-body');
  var icon = document.getElementById('versions-toggle-icon');
  if (!body) return;
  var collapsed = body.style.display === 'none';
  body.style.display = collapsed ? '' : 'none';
  if (icon) icon.textContent = collapsed ? '▲' : '▼';
}

// ════════════════════════════════════════
//  新增版本（表單顯示 / 隱藏）
// ════════════════════════════════════════

function showAddVersion() {
  document.getElementById('add-version-form').style.display = '';
  document.getElementById('new-version-name').focus();
}
function hideAddVersion() {
  document.getElementById('add-version-form').style.display = 'none';
  document.getElementById('new-version-name').value = '';
}

// ════════════════════════════════════════
//  手動新增：預覽生字
// ════════════════════════════════════════

function updateManualPreview() {
  var chars = Array.from(new Set(
    document.getElementById('manual-chars').value.replace(/ /g, '').split('').filter(Boolean)
  ));
  var prev = document.getElementById('manual-chars-preview');
  if (!prev) return;
  prev.innerHTML = chars.length
    ? '<div class="lesson-chars-chip" style="font-size:1.2rem;letter-spacing:4px">' + chars.join('') + '</div>'
    : '';
}

// ════════════════════════════════════════
//  課次 TTS 覆寫
// ════════════════════════════════════════

function toggleLessonOverride(key) {
  var body = document.getElementById('lo-body-' + key);
  var ico  = document.getElementById('lo-ico-' + key);
  var acc  = body && body.parentElement;
  if (!body) return;
  var opening = body.style.display === 'none';
  body.style.display = opening ? '' : 'none';
  if (ico) ico.textContent = opening ? '▼' : '▶';
  if (acc) acc.classList.toggle('open', opening);
  if (opening && !body.dataset.rendered) {
    _renderLessonOverrideBody(key, body);
    body.dataset.rendered = '1';
  }
}

function _renderLessonOverrideBody(key, body) {
  var data = _loData[key];
  if (!data || !data.chars.length) {
    body.innerHTML = '<div style="color:var(--muted);font-size:.82rem">此課無生字。</div>';
    return;
  }
  var html =
    '<div style="font-size:.75rem;color:var(--muted);font-weight:600;margin-bottom:10px;line-height:1.6">' +
      '輸入包含該字的<strong>詞語</strong>（國字），TTS 會讀出整個詞來引導正確讀音。' +
      '例如：噸 → <code>公噸</code>、垃 → <code>垃圾桶</code>。留空則使用萌典預設。' +
    '</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">';
  data.chars.forEach(function(char) {
    var ov = (data.charOverrides[char] && data.charOverrides[char].ttsText) || '';
    var hi = ov ? 'border-color:var(--blue)' : '';
    html +=
      '<div style="display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 6px;' +
        'border:1.5px solid var(--border);' + hi + ';border-radius:10px;background:white;min-width:60px">' +
        '<div style="font-size:1.4rem;font-family:\'Noto Sans TC\',sans-serif;font-weight:900;line-height:1">' + char + '</div>' +
        '<input type="text" data-char="' + char + '" value="' + _escQ(ov) + '" placeholder="詞語"' +
          ' style="width:56px;border:1.5px solid var(--border);border-radius:6px;padding:3px 5px;' +
          'font-size:.75rem;font-family:\'Noto Sans TC\',sans-serif;text-align:center;outline:none">' +
      '</div>';
  });
  html += '</div>';
  html +=
    '<div style="display:flex;align-items:center;justify-content:flex-end;gap:10px">' +
      '<span id="lo-status-' + key + '" style="font-size:.78rem;font-weight:700;color:var(--muted)"></span>' +
      '<button onclick="saveLessonOverride(\'' + key + '\')" ' +
        'style="padding:6px 18px;border:none;border-radius:8px;background:var(--blue);color:white;' +
        'font-size:.82rem;font-weight:800;cursor:pointer;font-family:inherit">儲存</button>' +
    '</div>';
  body.innerHTML = html;
}

function saveLessonOverride(key) {
  var data     = _loData[key];
  var body     = document.getElementById('lo-body-' + key);
  var statusEl = document.getElementById('lo-status-' + key);
  if (!data || !body) return;
  if (statusEl) { statusEl.style.color = 'var(--muted)'; statusEl.textContent = '儲存中…'; }

  var overrides = {};
  body.querySelectorAll('input[data-char]').forEach(function(input) {
    var val = input.value.trim();
    if (val) overrides[input.dataset.char] = { ttsText: val };
  });
  data.charOverrides = overrides;
  saveCharOverrides(data.vId, data.lessonId, overrides, statusEl);
}
