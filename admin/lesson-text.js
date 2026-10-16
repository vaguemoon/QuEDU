/**
 * admin/lesson-text.js — 課文編輯（獨立頁面，原本掛在題庫底下的「📖 課文」已搬到這裡）
 * 身分＝currentTeacher.uid + grade + lesson，跟題庫的課次概念共用同一個 docId 規則，
 * 但這裡不需要題庫已經有題目才能寫課文——老師可以先寫課文，之後再回題庫補題目。
 * 配套生字詞不用另外輸入，課文趣會自動抓這一課「詞語解釋／詞語填空」題型的答案欄當生字詞。
 * 依賴：shared.js（db、showToast、pickBestZhVoice）、classes.js（escHtml）、init.js（currentTeacher）、
 *       lesson-fulltext.js（_lftExt、_lftExtractText、LFT_SUPPORTED_EXTS）、
 *       assets/data/heteronym-readings.js（HETERONYM_READINGS）、
 *       word-image.js（_wiCompressToDataUrl，插入圖片功能的「上傳新圖片」用；載入順序晚於
 *       這支檔案沒關係，只在使用者真的點上傳時才會呼叫到）
 */
'use strict';

/* ════════════════════════════════════════
   狀態
   ════════════════════════════════════════ */
var _ltList          = [];   // 這位老師全部課文 [{docId, grade, lesson, lessonName, fullText, pronFixes, sharedClassIds, updatedAt}]
var _ltCurrent        = null; // 目前正在編輯的那一篇（跟 _ltList 裡同一個物件參照）
var _ltIsNew          = false;
var _ltPendingPronFixes = {}; // "行:字元序" -> {ch, readingIndex, homophone}，只有一篇在編輯，不用再分 dk
var _ltHetPos         = null; // 破音字選單目前指到的位置 {line, ci, ch}
var _ltClassesCache   = null;
var _ltGlobalHints    = null; // 跨課讀音建議：{ch: {readingIndex: 出現次數}}，整個分頁載入一次
var _ltVocab           = {};  // 這一課配套生字詞聯集（題庫衍生＋本課語詞），用來在預覽裡標記
var _ltVocabFromQuestions = {}; // 詞語題庫衍生（詞語解釋/詞語填空答案），唯讀
var _ltVocabManual     = {};  // 本課語詞子集合（lessonTexts/{docId}/vocab）裡「存在」的字，聯集用
var _ltVocabSource     = {};  // word -> 'manual'|'questions'，上面那份子集合每個字實際的來源，面板標籤/能不能移除看這個
var _ltDragging        = false; // 拖曳選字狀態（設定本課語詞用）
var _ltDragLineIdx     = null;
var _ltDragStartCi     = null;
var _ltDragEndCi       = null;
var _ltPendingVocabWord = null; // 目前彈窗指到、待確認加入/移除的詞
var _ltImagePickerMode = 'insert'; // 圖片彈窗目前的用途：'insert'=插入課文內文｜'word'=設定某個語詞的圖片
var _ltImagePickerWord  = null;    // mode='word' 時，目前指到哪個語詞
var _ltPendingImageBlob = null;    // 上傳區目前選取／貼上／拖放到的圖片（按下「上傳」前的暫存）
var _ltQuestionDocs    = {};       // word -> {'詞語解釋':{docId,question}, '詞語填空':{docId,question}}，題庫衍生題目快取
var _ltWordEditTarget  = null;     // 語詞解釋/填空題編輯視窗目前指到哪個字
var _ltFontReady      = false;
var _ltWysiwyg        = false;
var _ltVersions       = [];
var _ltWordImages     = null; // 詞語圖庫快取 [{docId, word, imageUrl}]
var LT_MAX_VERSIONS   = 10;

/* ════════════════════════════════════════
   進入點（由 admin/init.js 的 switchDbView('lesson-text', ...) 呼叫）
   ════════════════════════════════════════ */
function loadLessonTextTab() {
  if (!db || !currentTeacher) { setTimeout(loadLessonTextTab, 300); return; }
  var main = document.getElementById('lt-main');
  if (!main) return;
  main.innerHTML = '<div class="loading-wrap" style="padding:20px 0"><div class="spinner"></div></div>';

  db.collection('lessonTexts').where('teacherUid', '==', currentTeacher.uid).get().then(function(snap) {
    _ltList = [];
    snap.forEach(function(doc) {
      var d = doc.data();
      _ltList.push({
        docId: doc.id, grade: d.grade, lesson: d.lesson, lessonName: d.lessonName || '',
        fullText: d.fullText || '', pronFixes: d.pronFixes || {},
        sharedClassIds: d.sharedClassIds || [], updatedAt: d.updatedAt || ''
      });
    });
    _ltBuildGlobalHints();
    _ltRenderListView();
  }).catch(function(e) {
    main.innerHTML = '<p style="color:var(--red);font-size:.98rem">載入失敗：' + e.message + '</p>';
  });
}

function _ltEscJs(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
function _ltEscAttr(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function _ltEscTA(s) {
  return String(s || '').replace(/<\/textarea/gi, '&lt;/textarea');
}
function _ltDocId(grade, lesson) {
  return 't_' + encodeURIComponent(currentTeacher.uid + '|' + grade + '|' + lesson);
}

/* ════════════════════════════════════════
   列表頁：既有課文清單 ＋ 新增課文
   ════════════════════════════════════════ */
function _ltRenderListView() {
  var main = document.getElementById('lt-main');
  if (!main) return;

  var grades = Array.from(new Set(_ltList.map(function(l) { return l.grade; }))).sort(function(a, b) {
    var na = cnNumToInt(a), nb = cnNumToInt(b);
    if (na !== null && nb !== null) return na - nb;
    return a.localeCompare(b, 'zh-TW');
  });

  var html =
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">' +
      '<div style="font-size:.98rem;color:var(--muted);font-weight:600">共 ' + _ltList.length + ' 篇課文</div>' +
      '<button onclick="_ltShowNewForm()" style="padding:7px 16px;border:none;border-radius:8px;background:var(--blue);' +
        'color:white;font-size:.98rem;font-weight:800;cursor:pointer;font-family:inherit">➕ 新增課文</button>' +
    '</div>' +
    '<div id="lt-new-form" class="hidden" style="background:var(--blue-lt);border:1.5px solid var(--blue);border-radius:10px;' +
      'padding:14px;margin-bottom:16px;display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end">' +
      '<div><label style="display:block;font-size:.85rem;font-weight:700;color:var(--muted);margin-bottom:3px">年級</label>' +
        '<input id="lt-new-grade" list="lt-grade-options" placeholder="如：三上" style="width:90px;padding:6px 8px;' +
          'border:1.5px solid var(--border);border-radius:6px;font-family:inherit;font-size:.98rem"></div>' +
      '<datalist id="lt-grade-options">' + grades.map(function(g) { return '<option value="' + _ltEscAttr(g) + '">'; }).join('') + '</datalist>' +
      '<div><label style="display:block;font-size:.85rem;font-weight:700;color:var(--muted);margin-bottom:3px">課次</label>' +
        '<input id="lt-new-lesson" placeholder="如：五" style="width:70px;padding:6px 8px;border:1.5px solid var(--border);' +
          'border-radius:6px;font-family:inherit;font-size:.98rem"></div>' +
      '<div><label style="display:block;font-size:.85rem;font-weight:700;color:var(--muted);margin-bottom:3px">課名（選填）</label>' +
        '<input id="lt-new-name" placeholder="如：攀登生命的高峰" style="width:200px;padding:6px 8px;border:1.5px solid var(--border);' +
          'border-radius:6px;font-family:inherit;font-size:.98rem"></div>' +
      '<button onclick="_ltCreateNew()" style="padding:7px 16px;border:none;border-radius:8px;background:var(--green);' +
        'color:white;font-size:.98rem;font-weight:800;cursor:pointer;font-family:inherit">建立</button>' +
      '<button onclick="_ltHideNewForm()" style="padding:7px 16px;border:1.5px solid var(--border);border-radius:8px;' +
        'background:white;font-size:.98rem;font-weight:700;cursor:pointer;font-family:inherit">取消</button>' +
      '<span id="lt-new-err" style="font-size:.91rem;color:var(--red);font-weight:700;width:100%"></span>' +
    '</div>';

  if (!_ltList.length) {
    html += '<div style="color:var(--muted);font-size:1.01rem;padding:20px 0;text-align:center">還沒有任何課文，按上面「➕ 新增課文」開始寫第一篇。</div>';
  } else {
    grades.forEach(function(grade) {
      var lessons = _ltList.filter(function(l) { return l.grade === grade; }).sort(function(a, b) {
        var na = cnNumToInt(a.lesson), nb = cnNumToInt(b.lesson);
        if (na !== null && nb !== null) return na - nb;
        return a.lesson.localeCompare(b.lesson, 'zh-TW');
      });
      html += '<div style="font-weight:900;font-size:1.08rem;margin:14px 0 8px">' + escHtml(grade) + '</div>';
      html += '<div style="display:flex;flex-direction:column;gap:6px">';
      lessons.forEach(function(l) {
        var wc = Array.from(String(l.fullText || '')).filter(function(c) { return /[一-鿿㐀-䶿]/.test(c); }).length;
        var shared = l.sharedClassIds.length ? ('📤 已分享 ' + l.sharedClassIds.length + ' 班') : '未分享';
        html += '<button onclick="_ltOpenLesson(\'' + _ltEscJs(l.docId) + '\')" style="display:flex;align-items:center;gap:12px;' +
          'padding:10px 14px;border:1.5px solid var(--border);border-radius:8px;background:white;cursor:pointer;' +
          'text-align:left;font-family:inherit;transition:border-color .15s" ' +
          'onmouseover="this.style.borderColor=\'var(--blue)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
          '<span style="font-weight:800;min-width:70px">第 ' + escHtml(l.lesson) + ' 課</span>' +
          '<span style="color:var(--muted);flex:1">' + escHtml(l.lessonName || '（未命名）') + '</span>' +
          '<span style="font-size:.89rem;color:var(--muted)">' + wc + ' 字</span>' +
          '<span style="font-size:.89rem;color:' + (l.sharedClassIds.length ? 'var(--green-dk)' : 'var(--muted)') + '">' + shared + '</span>' +
          '</button>';
      });
      html += '</div>';
    });
  }

  main.innerHTML = html;
}

function _ltShowNewForm() {
  var f = document.getElementById('lt-new-form');
  if (f) f.classList.remove('hidden');
}
function _ltHideNewForm() {
  var f = document.getElementById('lt-new-form');
  if (f) f.classList.add('hidden');
  ['lt-new-grade', 'lt-new-lesson', 'lt-new-name'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  var err = document.getElementById('lt-new-err'); if (err) err.textContent = '';
}

function _ltCreateNew() {
  var grade  = (document.getElementById('lt-new-grade').value || '').trim();
  var lesson = (document.getElementById('lt-new-lesson').value || '').trim();
  var name   = (document.getElementById('lt-new-name').value || '').trim();
  var err = document.getElementById('lt-new-err');
  if (!grade || !lesson) {
    if (err) err.textContent = '年級跟課次都要填';
    return;
  }
  var docId = _ltDocId(grade, lesson);
  if (_ltList.some(function(l) { return l.docId === docId; })) {
    if (err) err.textContent = '這個年級＋課次已經有課文了，請直接從下面清單點進去編輯';
    return;
  }
  var info = { docId: docId, grade: grade, lesson: lesson, lessonName: name, fullText: '', pronFixes: {}, sharedClassIds: [], updatedAt: '' };
  _ltIsNew = true;
  _ltOpenEditor(info);
}

function _ltOpenLesson(docId) {
  var info = _ltList.filter(function(l) { return l.docId === docId; })[0];
  if (!info) return;
  _ltIsNew = false;
  _ltOpenEditor(info);
}

function _ltBackToList() {
  _ltCurrent = null;
  document.getElementById('lt-editor-view').classList.add('hidden');
  document.getElementById('lt-list-view').classList.remove('hidden');
  _ltRenderListView();
}

/* ════════════════════════════════════════
   編輯器
   ════════════════════════════════════════ */
function _ltOpenEditor(info) {
  _ltCurrent = info;
  _ltPendingPronFixes = JSON.parse(JSON.stringify(info.pronFixes || {}));
  _ltWysiwyg = false;
  _ltVersions = [];
  _ltVocabSyncFailed = false;

  document.getElementById('lt-list-view').classList.add('hidden');
  var ev = document.getElementById('lt-editor-view');
  ev.classList.remove('hidden');
  ev.innerHTML = '<div class="loading-wrap" style="padding:20px 0"><div class="spinner"></div></div>';

  var loadClasses = _ltClassesCache
    ? Promise.resolve(_ltClassesCache)
    : db.collection('classes').where('teacherUid', '==', currentTeacher.uid).get().then(function(snap) {
        var list = [];
        snap.forEach(function(doc) {
          var d = doc.data();
          list.push({ id: doc.id, name: d.name || d.className || doc.id });
        });
        _ltClassesCache = list;
        return list;
      });

  Promise.all([loadClasses, _ltFetchVocab(info.grade, info.lesson, info.docId)]).then(function(results) {
    _ltRenderEditor(results[0]);
  });
}

/* 雙欄版面（左：課文編輯／右：本課語詞）只需要注入一次 */
function _ltEnsureEditorStyle() {
  if (document.getElementById('lt-editor-style')) return;
  var style = document.createElement('style');
  style.id = 'lt-editor-style';
  style.textContent =
    '.lt-editor-grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:20px;align-items:start;margin-bottom:16px}' +
    '.lt-vocab-col{position:sticky;top:12px;border-left:1.5px solid var(--border);padding-left:20px}' +
    '@media (max-width:1000px){.lt-editor-grid{grid-template-columns:1fr}' +
      '.lt-vocab-col{position:static;border-left:none;padding-left:0;border-top:1.5px solid var(--border);padding-top:16px}}';
  document.head.appendChild(style);
}

function _ltRenderEditor(classes) {
  var info = _ltCurrent;
  var ev = document.getElementById('lt-editor-view');
  _ltEnsureEditorStyle();

  var html =
    '<button onclick="_ltBackToList()" style="margin-bottom:12px;padding:5px 12px;border:1.5px solid var(--border);' +
      'border-radius:8px;background:white;font-size:.93rem;font-weight:700;cursor:pointer;font-family:inherit">← 返回課文清單</button>' +
    '<div style="font-size:1.18rem;font-weight:900;margin-bottom:4px">' + escHtml(info.grade) + '　第 ' + escHtml(info.lesson) + ' 課' +
      (info.lessonName ? '　' + escHtml(info.lessonName) : '') + '</div>' +
    '<div style="font-size:.88rem;color:var(--muted);font-weight:600;margin-bottom:10px;line-height:1.6">' +
      '給「課文趣」App 上課時逐字朗讀＋圈詞用。本課語詞會自動抓這一課「詞語解釋」「詞語填空」題目的答案，' +
      '也可以直接在下面的分段預覽裡拖曳選字，加入或移除本課語詞——右邊的語詞清單會即時跟著變。' +
    '</div>' +
    '<div class="lt-editor-grid">' +
    '<div class="lt-editor-main">' +
    '<div style="font-size:.88rem;color:var(--muted);font-weight:600;margin-bottom:6px">' +
      '可上傳 .docx / .txt / .odt / .pdf 自動轉成文字（舊版 .doc 請先另存新檔為 .docx），也能直接手打或貼上。' +
    '</div>' +
    '<input type="file" accept=".docx,.doc,.txt,.odt,.pdf" onchange="_ltFullTextFileSelected(this)" style="margin-bottom:8px">' +
    '<textarea id="lt-ta" placeholder="課文全文…（段落之間空一行就會分段）" oninput="_ltOnTextInput()" ' +
      'style="width:100%;min-height:160px;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;' +
      'font-family:\'Noto Sans TC\',sans-serif;font-size:1.01rem;line-height:1.8;resize:vertical;box-sizing:border-box">' +
      _ltEscTA(info.fullText) + '</textarea>' +
    '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:8px 0 6px">' +
      '<button type="button" onclick="_ltInsertParaBreak()" style="padding:5px 14px;border:1.5px solid var(--blue);' +
        'border-radius:8px;background:var(--blue-lt);color:var(--blue-dk);font-size:.93rem;font-weight:800;cursor:pointer;' +
        'font-family:inherit">⏎ 插入分段</button>' +
      '<button type="button" onclick="_ltOpenImagePicker()" style="padding:5px 14px;border:1.5px solid var(--border);' +
        'border-radius:8px;background:white;color:inherit;font-size:.93rem;font-weight:800;cursor:pointer;' +
        'font-family:inherit">🖼️ 插入圖片</button>' +
      '<label style="display:flex;align-items:center;gap:5px;font-size:.91rem;font-weight:700;color:var(--muted);cursor:pointer">' +
        '<input type="checkbox" id="lt-wysiwyg-cb" onchange="_ltToggleWysiwyg(this.checked)"> 用課文趣實際字型預覽</label>' +
      '<span style="font-size:.87rem;color:var(--muted)">把游標放在要分段的地方再按「插入分段」</span>' +
    '</div>' +
    '<div id="lt-stats" style="font-size:.89rem;color:var(--muted);font-weight:700;margin-bottom:10px"></div>' +
    '<div style="border-top:1.5px solid var(--border);margin:14px 0"></div>' +
    '<div style="font-size:.93rem;font-weight:800;margin-bottom:4px">📄 分段預覽（學生在課文趣實際看到的樣子）</div>' +
    '<div style="font-size:.88rem;color:var(--muted);font-weight:600;margin-bottom:8px;line-height:1.6">' +
      '文字下面有虛線的字是多音字，點一下可以選這個字在這裡要唸的讀音（只影響這一次出現）；' +
      (Object.keys(_ltVocab).length ? '黃色網底是這一課配套生字詞；' : '') +
      '畫面上的注音會直接換成選的讀音。拖曳選取文字可以加入或移除本課語詞。' +
    '</div>' +
    '<div id="lt-preview" style="margin-bottom:16px"></div>' +
    '<div style="border-top:1.5px solid var(--border);margin:14px 0"></div>' +
    '<div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;margin:8px 0 10px">' +
      '<button onclick="_ltToggleVersions()" style="padding:6px 14px;border:1.5px solid var(--border);border-radius:8px;' +
        'background:white;font-size:.93rem;font-weight:700;cursor:pointer;font-family:inherit">🕐 版本歷史</button>' +
      '<button onclick="_ltPrintLesson()" style="padding:6px 14px;border:1.5px solid var(--border);border-radius:8px;' +
        'background:white;font-size:.93rem;font-weight:700;cursor:pointer;font-family:inherit">🖨️ 列印</button>' +
      '<span id="lt-status" style="font-size:.91rem;font-weight:700;color:var(--muted)"></span>' +
      '<button onclick="_ltSaveLessonText()" style="padding:6px 18px;border:none;border-radius:8px;background:var(--blue);' +
        'color:white;font-size:.95rem;font-weight:800;cursor:pointer;font-family:inherit">儲存課文全文</button>' +
    '</div>' +
    '<div id="lt-versions-panel" class="hidden" style="background:var(--gray-lt);border:1.5px solid var(--border);' +
      'border-radius:8px;padding:10px;margin-bottom:16px;font-size:.93rem"></div>' +
    '</div>' +
    '<div class="lt-vocab-col">' +
      '<div style="font-size:.93rem;font-weight:800;margin-bottom:4px">🏷️ 本課語詞</div>' +
      '<div style="font-size:.85rem;color:var(--muted);font-weight:600;margin-bottom:8px;line-height:1.5">' +
        '點圖示可以搜圖／上傳；點字可以編輯詞語解釋／填空題；手動加入的語詞才能用 ✕ 移除，來自題庫的要到題庫改。' +
      '</div>' +
      '<div id="lt-vocab-sync-status"></div>' +
      '<div id="lt-vocab-panel"></div>' +
    '</div>' +
    '</div>' +
    '<div style="border-top:1.5px solid var(--border);margin:20px 0 16px"></div>' +
    '<div style="font-size:.93rem;font-weight:800;margin-bottom:4px">📤 分享給班級（課文趣的學生才看得到）</div>' +
    '<div style="font-size:.88rem;color:var(--muted);font-weight:600;margin-bottom:8px">' +
      '已經分享過的班級，之後按「儲存課文全文」內容就會自動同步給他們；這裡只有在要改變「分享給哪些班級」時才需要用。' +
    '</div>';

  if (!classes.length) {
    html += '<div style="color:var(--muted);font-size:.95rem">尚未建立班級。</div>';
  } else {
    html += '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:10px">';
    classes.forEach(function(cls) {
      var checked = info.sharedClassIds.indexOf(cls.id) !== -1;
      html += '<label style="display:flex;align-items:center;gap:5px;font-size:.98rem;font-weight:700;cursor:pointer">' +
        '<input type="checkbox" class="lt-class-cb" value="' + _ltEscAttr(cls.id) + '"' + (checked ? ' checked' : '') + '>' +
        escHtml(cls.name) + '</label>';
    });
    html += '</div>';
    html += '<div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-bottom:16px">' +
      '<span id="lt-share-status" style="font-size:.91rem;font-weight:700;color:var(--muted)"></span>' +
      '<button onclick="_ltSaveLessonShare()" style="padding:6px 18px;border:none;border-radius:8px;background:var(--green);' +
        'color:white;font-size:.95rem;font-weight:800;cursor:pointer;font-family:inherit">更新分享班級</button>' +
      '</div>';
  }

  ev.innerHTML = html;
  _ltRenderTextPreview();
  _ltRenderVocabPanel();
  _ltUpdateStats();
}

function _ltOnTextInput() {
  _ltRenderTextPreview();
  _ltUpdateStats();
}

/* ════════════════════════════════════════
   分段拆行（跟課文趣 _etSplitLines 同一套邏輯，位置編號才會對得上）
   ════════════════════════════════════════ */
function _ltSplitLines(text) {
  var rawLines = String(text || '').split(/\r?\n/);
  var lines = [];
  rawLines.forEach(function(line) {
    var trimmed = line.trim();
    if (!trimmed) {
      if (lines.length && !lines[lines.length - 1].blank) lines.push({ text: '', chars: [], blank: true });
      return;
    }
    var imgMatch = trimmed.match(/^［圖:([^］]+)］$/);
    if (imgMatch) {
      lines.push({ text: trimmed, chars: [], blank: false, image: imgMatch[1] });
      return;
    }
    var chars = Array.from(trimmed).map(function(ch) {
      return { ch: ch, interactive: /[一-鿿㐀-䶿]/.test(ch) };
    });
    lines.push({ text: trimmed, chars: chars, blank: false });
  });
  while (lines.length && lines[lines.length - 1].blank) lines.pop();
  return lines;
}

function _ltCollectPronFixes() {
  var ta = document.getElementById('lt-ta');
  if (!ta) return _ltPendingPronFixes;
  var lines = _ltSplitLines(ta.value);
  var out = {};
  Object.keys(_ltPendingPronFixes).forEach(function(key) {
    var fix = _ltPendingPronFixes[key];
    var parts = key.split(':');
    var charObj = lines[parts[0]] && lines[parts[0]].chars[parts[1]];
    if (charObj && charObj.ch === fix.ch) out[key] = fix;
  });
  return out;
}

/* ════════════════════════════════════════
   分段預覽（含多音字選單、生字詞標記、WYSIWYG 字型）
   ════════════════════════════════════════ */
function _ltRenderTextPreview() {
  var ta = document.getElementById('lt-ta');
  var el = document.getElementById('lt-preview');
  if (!ta || !el) return;
  _ltAttachVocabPointerHandlers(el);
  var lines = _ltSplitLines(ta.value);
  if (!lines.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:.91rem;padding:4px 0">尚未輸入內容，預覽會顯示在這裡</div>';
    return;
  }
  var fixes = _ltPendingPronFixes || {};
  var paragraphs = [];
  var current = [];
  lines.forEach(function(line, li) {
    if (line.blank) { if (current.length) { paragraphs.push(current); current = []; } }
    else current.push(li);
  });
  if (current.length) paragraphs.push(current);

  var fontStyle = _ltWysiwyg ? 'font-family:\'BpmfZihiKai\';font-weight:700;' : '';

  el.innerHTML = paragraphs.map(function(lineIdxs, pi) {
    var body = lineIdxs.map(function(li, k) {
      var line = lines[li];
      if (line.image) {
        var imgInfo = (_ltWordImages || []).filter(function(w) { return w.docId === line.image; })[0];
        return imgInfo
          ? '<div style="margin:6px 0"><img src="' + imgInfo.imageUrl + '" style="max-width:120px;max-height:120px;' +
            'border-radius:8px;border:1.5px solid var(--border)" alt="' + _ltEscAttr(imgInfo.word) + '"></div>'
          : '<div style="color:var(--red);font-size:.91rem">（圖片遺失）</div>';
      }
      var vocabSets = _ltVocabCharSet(lines, li);
      var charsHtml = line.chars.map(function(c, ci) {
        if (!c.interactive) return escHtml(c.ch);
        var readings = HETERONYM_READINGS[c.ch];
        var vs = '';
        var fix = fixes[li + ':' + ci];
        var hasFix = fix && fix.ch === c.ch;
        if (_ltWysiwyg && hasFix && fix.readingIndex) vs = String.fromCodePoint(0xE01E0 + fix.readingIndex);
        var hasImg  = vocabSets.withImage[ci];
        var inVocab = hasImg || vocabSets.plain[ci];
        var bg = hasImg ? 'background:var(--green-lt);' : (inVocab ? 'background:#fff6d6;' : (hasFix ? 'background:var(--blue-lt);' : ''));
        if (!readings) {
          return '<span class="lt-char" data-line="' + li + '" data-ci="' + ci + '" style="' + bg +
            (inVocab ? 'border-radius:3px' : '') + ';' + fontStyle + '">' + escHtml(c.ch) + vs + '</span>';
        }
        var title = hasFix ? ('目前讀音：' + (readings[fix.readingIndex] || '')) : '多音字，點選可調整這一個字的讀音';
        return '<span class="lt-char lt-het-char" data-line="' + li + '" data-ci="' + ci + '" title="' + _ltEscAttr(title) + '" ' +
          'onclick="_ltCharClick(' + li + ',' + ci + ',\'' + c.ch + '\',this)" ' +
          'style="cursor:pointer;border-bottom:2px dashed ' + (hasFix ? 'var(--blue)' : 'var(--muted)') + ';' +
          bg + 'border-radius:3px;' + fontStyle + '">' + escHtml(c.ch) + vs + '</span>';
      }).join('');
      return charsHtml + (k < lineIdxs.length - 1 ? '\n' : '');
    }).join('');
    return '<div style="position:relative;background:white;border:1.5px solid var(--border);border-radius:8px;' +
      'padding:18px 44px 12px 16px;margin:18px 0 10px;font-size:' + (_ltWysiwyg ? '1.43rem' : '.98rem') + ';line-height:1.9;white-space:pre-wrap">' +
      '<span style="position:absolute;left:12px;top:-12px;font-size:.81rem;font-weight:800;color:var(--blue-dk);' +
      'background:var(--blue-lt);border:1.5px solid var(--border);padding:2px 7px;border-radius:6px;white-space:nowrap">第' + (pi + 1) + '段</span>' +
      '<button type="button" onclick="_ltSpeakParagraph([' + lineIdxs.join(',') + '])" title="試聽這一段" ' +
      'style="position:absolute;right:8px;top:9px;width:28px;height:28px;border:none;border-radius:50%;' +
      'background:var(--blue-lt);color:var(--blue-dk);cursor:pointer;font-size:.98rem;line-height:1">🔊</button>' +
      body +
    '</div>';
  }).join('');
}

/* 算某一行裡，哪些字元序（ci）落在配套生字詞範圍內，回傳 {ci: true} 方便查表標色 */
function _ltVocabCharSet(lines, li) {
  var plain = {}, withImage = {};
  var words = Object.keys(_ltVocab);
  if (!words.length) return { plain: plain, withImage: withImage };
  var text = lines[li] ? lines[li].text : '';
  var gradeLesson = _ltCurrent ? (_ltCurrent.grade + '_' + _ltCurrent.lesson) : '';
  words.forEach(function(w) {
    if (!w) return;
    var hasImg = (_ltWordImages || []).some(function(x) { return x.word === w && x.gradeLesson === gradeLesson; });
    var set = hasImg ? withImage : plain;
    var idx = text.indexOf(w);
    while (idx !== -1) {
      for (var k = 0; k < w.length; k++) set[idx + k] = true;
      idx = text.indexOf(w, idx + 1);
    }
  });
  return { plain: plain, withImage: withImage };
}

/* ════════════════════════════════════════
   配套生字詞（給預覽標記用）：
   聯集兩個來源——詞語題庫衍生（唯讀，邏輯跟課文趣 _etLoadVocab 一致）＋
   本課語詞子集合 lessonTexts/{docId}/vocab（可在預覽裡拖曳增刪）
   ════════════════════════════════════════ */
function _ltRecomputeVocabUnion() {
  _ltVocab = {};
  Object.keys(_ltVocabFromQuestions).forEach(function(w) { _ltVocab[w] = true; });
  Object.keys(_ltVocabManual).forEach(function(w) { _ltVocab[w] = true; });
}

function _ltFetchVocab(grade, lesson, docId) {
  var qQuestions = db.collection('questions').where('teacherUid', '==', currentTeacher.uid).where('grade', '==', grade).get();
  var qManual = docId
    ? db.collection('lessonTexts').doc(docId).collection('vocab').get()
    : Promise.resolve({ forEach: function() {} });
  return Promise.all([qQuestions, qManual]).then(function(results) {
    var defs = {}, fills = {};
    _ltQuestionDocs = {};
    results[0].forEach(function(doc) {
      var d = doc.data();
      if (d.lesson !== lesson) return;
      var word = (d.answer || '').trim();
      if (!word) return;
      if (d.type === '詞語解釋' && !defs[word]) { defs[word] = true; _ltCacheQuestionDoc(word, '詞語解釋', doc.id, d.question); }
      else if (d.type === '詞語填空' && !fills[word]) { fills[word] = true; _ltCacheQuestionDoc(word, '詞語填空', doc.id, d.question); }
    });
    _ltVocabFromQuestions = {};
    Object.keys(fills).forEach(function(w) { _ltVocabFromQuestions[w] = true; });
    Object.keys(defs).forEach(function(w) { _ltVocabFromQuestions[w] = true; });

    _ltVocabManual = {};
    _ltVocabSource = {};
    results[1].forEach(function(doc) {
      var d = doc.data();
      var w = (d.word || '').trim();
      if (!w) return;
      _ltVocabManual[w] = true;
      _ltVocabSource[w] = d.source === 'questions' ? 'questions' : 'manual'; // 舊資料沒有 source 欄位，當手動（向下相容）
    });

    _ltRecomputeVocabUnion();
  }).catch(function() { _ltVocabFromQuestions = {}; _ltVocabManual = {}; _ltVocabSource = {}; _ltVocab = {}; _ltQuestionDocs = {}; });
}
function _ltCacheQuestionDoc(word, type, docId, question) {
  if (!_ltQuestionDocs[word]) _ltQuestionDocs[word] = {};
  _ltQuestionDocs[word][type] = { docId: docId, question: question };
}

/* ════════════════════════════════════════
   拖曳選字＋設定本課語詞（Pointer Events，滑鼠／觸控通用；限定同一行內）
   ════════════════════════════════════════ */
var LT_VOCAB_MAX_LEN = 6; // 選取範圍超過這個字數就視為選錯，不當成語詞候選

function _ltAttachVocabPointerHandlers(el) {
  if (!el || el.dataset.ptrBound) return;
  el.dataset.ptrBound = '1';
  el.addEventListener('pointerdown',   _ltOnVocabPointerDown);
  el.addEventListener('pointermove',   _ltOnVocabPointerMove);
  el.addEventListener('pointerup',     _ltOnVocabPointerUp);
  el.addEventListener('pointercancel', function() { _ltDragging = false; });
}

function _ltCharSpanAt(x, y) {
  var el = document.elementFromPoint(x, y);
  return (el && el.classList && el.classList.contains('lt-char')) ? el : null;
}

function _ltOnVocabPointerDown(e) {
  var span = _ltCharSpanAt(e.clientX, e.clientY);
  if (!span) return;
  _ltDragging    = true;
  _ltDragLineIdx = parseInt(span.dataset.line, 10);
  _ltDragStartCi = _ltDragEndCi = parseInt(span.dataset.ci, 10);
}

function _ltOnVocabPointerMove(e) {
  if (!_ltDragging) return;
  var span = _ltCharSpanAt(e.clientX, e.clientY);
  if (span && parseInt(span.dataset.line, 10) === _ltDragLineIdx) {
    _ltDragEndCi = parseInt(span.dataset.ci, 10);
    _ltUpdateVocabDragHighlight();
  }
  if (_ltDragStartCi !== _ltDragEndCi) e.preventDefault(); // 真的拖曳了才蓋掉瀏覽器原生選字，單純點擊不受影響
}

function _ltOnVocabPointerUp(e) {
  if (!_ltDragging) return;
  _ltDragging = false;
  document.querySelectorAll('.lt-char').forEach(function(s) { s.style.outline = ''; });
  if (_ltDragStartCi === _ltDragEndCi) return; // 單純點擊，交給原本的多音字 onclick 處理
  _ltFinalizeVocabSelection(e.clientX, e.clientY);
}

function _ltUpdateVocabDragHighlight() {
  var lo = Math.min(_ltDragStartCi, _ltDragEndCi);
  var hi = Math.max(_ltDragStartCi, _ltDragEndCi);
  document.querySelectorAll('.lt-char').forEach(function(s) {
    var sameLine = parseInt(s.dataset.line, 10) === _ltDragLineIdx;
    var ci = parseInt(s.dataset.ci, 10);
    s.style.outline = (sameLine && ci >= lo && ci <= hi) ? '2px solid var(--blue)' : '';
  });
}

function _ltFinalizeVocabSelection(x, y) {
  var lo = Math.min(_ltDragStartCi, _ltDragEndCi);
  var hi = Math.max(_ltDragStartCi, _ltDragEndCi);
  var ta = document.getElementById('lt-ta');
  if (!ta) return;
  var lines = _ltSplitLines(ta.value);
  var line = lines[_ltDragLineIdx];
  if (!line || !line.chars.length) return;
  var text = line.chars.slice(lo, hi + 1).map(function(c) { return c.ch; }).join('');
  if (!text) return;
  if (text.length > LT_VOCAB_MAX_LEN) { showToast('選取範圍太長，語詞建議 2～' + LT_VOCAB_MAX_LEN + ' 字'); return; }
  _ltShowVocabPopover(text, x, y);
}

function _ltEnsureVocabPopover() {
  var pop = document.getElementById('lt-vocab-popover');
  if (pop) return pop;
  pop = document.createElement('div');
  pop.id = 'lt-vocab-popover';
  pop.style.cssText = 'position:fixed;z-index:9999;display:none;background:white;border:1.5px solid var(--border);' +
    'border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:12px;min-width:160px;' +
    'font-family:"Noto Sans TC",sans-serif';
  document.body.appendChild(pop);
  document.addEventListener('pointerdown', function(e) {
    if (pop.style.display === 'none') return;
    if (pop.contains(e.target)) return;
    _ltCloseVocabPopover();
  });
  return pop;
}

function _ltCloseVocabPopover() {
  var pop = document.getElementById('lt-vocab-popover');
  if (pop) pop.style.display = 'none';
  _ltPendingVocabWord = null;
}

function _ltShowVocabPopover(word, x, y) {
  var pop = _ltEnsureVocabPopover();
  _ltPendingVocabWord = word;
  var isManual = _ltVocabSource[word] === 'manual';
  var isFromQuestions = !isManual && (_ltVocabSource[word] === 'questions' || !!_ltVocabFromQuestions[word]);
  pop.innerHTML =
    '<div style="font-size:1.03rem;font-weight:800;margin-bottom:10px;text-align:center">「' + escHtml(word) + '」</div>' +
    (isManual
      ? '<button type="button" onclick="_ltConfirmRemoveVocab()" style="padding:6px 14px;border:none;border-radius:8px;' +
        'width:100%;background:var(--red-lt);color:var(--red);font-weight:800;cursor:pointer;font-family:inherit;font-size:.93rem">' +
        '－ 從本課語詞移除</button>'
      : isFromQuestions
      ? '<div style="font-size:.84rem;color:var(--muted);text-align:center;line-height:1.5">已經是本課語詞（來自題庫），<br>要移除請到題庫處理</div>'
      : '<button type="button" onclick="_ltConfirmAddVocab()" style="padding:6px 14px;border:none;border-radius:8px;' +
        'width:100%;background:var(--blue);color:white;font-weight:800;cursor:pointer;font-family:inherit;font-size:.93rem">' +
        '＋ 加入本課語詞</button>');
  pop.style.display = '';
  pop.style.top  = (y + 12) + 'px';
  pop.style.left = Math.max(10, Math.min(x, window.innerWidth - 180)) + 'px';
}

function _ltConfirmAddVocab() {
  var word = _ltPendingVocabWord;
  _ltCloseVocabPopover();
  _ltAddVocabWord(word);
}

function _ltConfirmRemoveVocab() {
  var word = _ltPendingVocabWord;
  _ltCloseVocabPopover();
  _ltRemoveVocabWord(word);
}

function _ltAddVocabWord(word) {
  if (!word || !_ltCurrent || !db) return;
  db.collection('lessonTexts').doc(_ltCurrent.docId).collection('vocab').doc(word).set({
    word: word, addedAt: new Date().toISOString(), source: 'manual'
  }).then(function() {
    _ltVocabManual[word] = true;
    _ltVocabSource[word] = 'manual';
    _ltRecomputeVocabUnion();
    _ltRenderTextPreview();
    _ltRenderVocabPanel();
    _ltResyncSharedVocabIfNeeded();
    showToast('✅ 已加入本課語詞：' + word);
  }).catch(function(e) { showToast('❌ 加入失敗：' + e.message); });
}

function _ltRemoveVocabWord(word) {
  if (!word || !_ltCurrent || !db) return;
  if (_ltVocabSource[word] === 'questions') {
    showToast('這個字是題庫「詞語解釋／填空」帶出來的，要移除請改到題庫刪除對應題目，或點 ✏️ 清空內容');
    return;
  }
  db.collection('lessonTexts').doc(_ltCurrent.docId).collection('vocab').doc(word).delete().then(function() {
    delete _ltVocabManual[word];
    delete _ltVocabSource[word];
    _ltRecomputeVocabUnion();
    _ltRenderTextPreview();
    _ltRenderVocabPanel();
    _ltResyncSharedVocabIfNeeded();
    showToast('已從本課語詞移除：' + word);
  }).catch(function(e) { showToast('❌ 移除失敗：' + e.message); });
}

/* ════════════════════════════════════════
   右側「本課語詞」面板——跟左邊預覽共用同一份 _ltVocab／_ltVocabManual 狀態，
   新增/移除語詞時兩邊一起重畫，天生同步，不需要額外的監聽機制
   ════════════════════════════════════════ */
function _ltLoadWordImages() {
  if (_ltWordImages) return Promise.resolve(_ltWordImages);
  return db.collection('wordImages').where('teacherUid', '==', currentTeacher.uid).get().then(function(snap) {
    var list = [];
    snap.forEach(function(doc) {
      var d = doc.data();
      if (d.imageUrl) list.push({ docId: doc.id, word: d.word || '', imageUrl: d.imageUrl, gradeLesson: d.gradeLesson || '' });
    });
    _ltWordImages = list;
    return list;
  }).catch(function() { return _ltWordImages || []; });
}

function _ltRenderVocabPanel() {
  var panel = document.getElementById('lt-vocab-panel');
  if (!panel || !_ltCurrent) return;
  if (!_ltWordImages) { _ltLoadWordImages().then(function() { _ltRenderVocabPanel(); _ltRenderTextPreview(); }); }

  var words = Object.keys(_ltVocab).sort();
  if (!words.length) {
    panel.innerHTML = '<div style="color:var(--muted);font-size:.91rem;line-height:1.6">' +
      '還沒有語詞。可以在左邊的分段預覽拖曳選字加入，或是到題庫出「詞語解釋／詞語填空」題，答案會自動變成語詞。</div>';
    return;
  }
  var gradeLesson = _ltCurrent.grade + '_' + _ltCurrent.lesson;
  panel.innerHTML = words.map(function(w) {
    var img = (_ltWordImages || []).filter(function(x) { return x.word === w && x.gradeLesson === gradeLesson; })[0];
    var manual = _ltVocabSource[w] === 'manual';
    var qd = _ltQuestionDocs[w];
    var hasQuestion = !!(qd && (qd['詞語解釋'] || qd['詞語填空']));
    return '<div style="background:white;border:1.5px solid var(--border);border-radius:10px;padding:8px;margin-bottom:8px;' +
      'display:flex;align-items:center;gap:8px">' +
      (img
        ? '<img src="' + img.imageUrl + '" onclick="_ltOpenWordImagePicker(\'' + _ltEscJs(w) + '\')" title="點圖片可以換一張" ' +
          'style="width:44px;height:44px;object-fit:contain;border-radius:6px;border:1px solid var(--border);' +
          'flex-shrink:0;cursor:pointer">'
        : '<button type="button" onclick="_ltOpenWordImagePicker(\'' + _ltEscJs(w) + '\')" title="搜圖／上傳" ' +
          'style="width:44px;height:44px;flex-shrink:0;border:1.5px dashed var(--border);border-radius:6px;' +
          'background:var(--gray-lt);cursor:pointer;font-size:1.13rem;color:var(--muted)">🔍</button>') +
      '<div style="flex:1;min-width:0;cursor:pointer" onclick="_ltOpenWordEditModal(\'' + _ltEscJs(w) + '\')" ' +
        'title="編輯詞語解釋／填空題（跟題庫共用）">' +
        '<div style="font-weight:800;font-size:1.03rem">' + escHtml(w) + ' <span style="font-size:.81rem">✏️</span></div>' +
        '<div style="font-size:.81rem;color:var(--muted);font-weight:700">' + (manual ? '手動加入' : '來自題庫') + '</div>' +
        (hasQuestion ? '' : '<div style="font-size:.76rem;color:var(--red);font-weight:700;margin-top:2px">' +
          '⚠️ 題庫還沒有這題，點字補上</div>') +
      '</div>' +
      (manual
        ? '<button type="button" onclick="_ltRemoveVocabWord(\'' + _ltEscJs(w) + '\')" title="移除" ' +
          'style="border:none;background:none;color:var(--red);cursor:pointer;font-size:1.13rem;flex-shrink:0;' +
          'font-family:inherit">✕</button>'
        : '') +
    '</div>';
  }).join('');
}

/* ════════════════════════════════════════
   語詞解釋／填空題編輯視窗——跟題庫（questions collection）共用同一份資料，
   這裡存的東西題庫那邊看得到、能出題；題庫出的題也會在這裡顯示（_ltQuestionDocs 快取）
   ════════════════════════════════════════ */
function _ltEnsureWordEditModal() {
  var modal = document.getElementById('lt-wordedit-modal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'lt-wordedit-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:none;background:rgba(0,0,0,.4);' +
    'align-items:center;justify-content:center';
  modal.innerHTML = '<div style="background:white;border-radius:12px;padding:18px;max-width:440px;width:90%;' +
    'max-height:80vh;overflow:auto">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
      '<div id="lt-wordedit-title" style="font-weight:900">語詞題庫內容</div>' +
      '<button onclick="_ltCloseWordEditModal()" style="border:none;background:none;font-size:1.33rem;cursor:pointer">✕</button>' +
    '</div>' +
    '<div style="font-size:.85rem;color:var(--muted);font-weight:600;margin-bottom:12px;line-height:1.6">' +
      '這裡編輯的內容跟「題庫」共用同一份資料，存檔後題庫那邊也會看到、能直接拿來出題；留空並存檔會刪掉對應的題目。' +
    '</div>' +
    '<label style="display:block;font-size:.89rem;font-weight:800;margin-bottom:4px">詞語解釋（題幹填解釋，答案就是這個詞）</label>' +
    '<textarea id="lt-wordedit-def" rows="2" placeholder="例：形容表現非常出色，超越其他人" ' +
      'style="width:100%;padding:7px 9px;border:1.5px solid var(--border);border-radius:7px;font-family:inherit;' +
      'font-size:.98rem;margin-bottom:12px;box-sizing:border-box;resize:vertical"></textarea>' +
    '<label style="display:block;font-size:.89rem;font-weight:800;margin-bottom:4px">詞語填空（用「（　）」標示空格）</label>' +
    '<textarea id="lt-wordedit-fill" rows="2" placeholder="例：她（　）地完成了這項艱難的任務。" ' +
      'style="width:100%;padding:7px 9px;border:1.5px solid var(--border);border-radius:7px;font-family:inherit;' +
      'font-size:.98rem;margin-bottom:12px;box-sizing:border-box;resize:vertical"></textarea>' +
    '<div style="display:flex;align-items:center;justify-content:flex-end;gap:10px">' +
      '<span id="lt-wordedit-status" style="font-size:.89rem;font-weight:700;color:var(--muted)"></span>' +
      '<button type="button" onclick="_ltSaveWordEdit()" style="padding:6px 16px;border:none;border-radius:8px;' +
        'background:var(--blue);color:white;font-size:.95rem;font-weight:800;cursor:pointer;font-family:inherit">儲存</button>' +
    '</div>' +
  '</div>';
  modal.addEventListener('click', function(e) { if (e.target === modal) _ltCloseWordEditModal(); });
  document.body.appendChild(modal);
  return modal;
}
function _ltCloseWordEditModal() {
  var modal = document.getElementById('lt-wordedit-modal');
  if (modal) modal.style.display = 'none';
  _ltWordEditTarget = null;
}
function _ltOpenWordEditModal(word) {
  _ltWordEditTarget = word;
  var modal = _ltEnsureWordEditModal();
  document.getElementById('lt-wordedit-title').textContent = '「' + word + '」的題庫內容';
  var qd = _ltQuestionDocs[word] || {};
  document.getElementById('lt-wordedit-def').value  = (qd['詞語解釋'] && qd['詞語解釋'].question) || '';
  document.getElementById('lt-wordedit-fill').value = (qd['詞語填空'] && qd['詞語填空'].question) || '';
  var statusEl = document.getElementById('lt-wordedit-status');
  if (statusEl) statusEl.textContent = '';
  modal.style.display = 'flex';
}
function _ltSaveWordEdit() {
  var word = _ltWordEditTarget;
  var info = _ltCurrent;
  if (!word || !info || !db) return;
  var defVal   = document.getElementById('lt-wordedit-def').value.trim();
  var fillVal  = document.getElementById('lt-wordedit-fill').value.trim();
  var statusEl = document.getElementById('lt-wordedit-status');
  if (statusEl) { statusEl.style.color = 'var(--muted)'; statusEl.textContent = '儲存中…'; }

  Promise.all([
    _ltUpsertQuestion(word, '詞語解釋', defVal),
    _ltUpsertQuestion(word, '詞語填空', fillVal)
  ]).then(function() {
    return _ltFetchVocab(info.grade, info.lesson, info.docId); // 兩個 upsert 的最終狀態都反映出來之後，才判斷要不要同步本課語詞
  }).then(function() {
    return _ltSyncVocabWithQuestions(word);
  }).then(function() {
    _ltRenderTextPreview();
    _ltRenderVocabPanel();
    _ltResyncSharedVocabIfNeeded();
    _ltCloseWordEditModal();
    showToast('✅ 已儲存「' + word + '」的題庫內容');
  }).catch(function(e) {
    if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = '❌ ' + e.message; }
  });
}
/* 題庫內容存檔後，反向確保「本課語詞」清單跟著對：
   有題目但還不是語詞 → 補上（source:'questions'）；題目都清光了、而且這個字當初只是因為
   題庫才變語詞（source:'questions'，不是老師手動加的）→ 清掉，避免沒有題目又沒人手動加的字
   卡在語詞清單裡。手動加的字（source:'manual'）不管題目有沒有，都不會被這裡自動清掉。 */
function _ltSyncVocabWithQuestions(word) {
  var info = _ltCurrent;
  var qd = _ltQuestionDocs[word];
  var hasQuestion = !!(qd && (qd['詞語解釋'] || qd['詞語填空']));
  var hasVocabDoc = !!_ltVocabSource[word];

  if (hasQuestion && !hasVocabDoc) {
    return db.collection('lessonTexts').doc(info.docId).collection('vocab').doc(word).set({
      word: word, addedAt: new Date().toISOString(), source: 'questions'
    }).then(function() {
      _ltVocabManual[word] = true;
      _ltVocabSource[word] = 'questions';
      _ltRecomputeVocabUnion();
    });
  }
  if (!hasQuestion && _ltVocabSource[word] === 'questions') {
    return db.collection('lessonTexts').doc(info.docId).collection('vocab').doc(word).delete().then(function() {
      delete _ltVocabManual[word];
      delete _ltVocabSource[word];
      _ltRecomputeVocabUnion();
    });
  }
  return Promise.resolve();
}
/* 留空就刪掉對應的題目（如果原本有的話），有內容就 upsert——跟 _ltAssignWordImage 同樣的
   「先查有沒有既有文件，有就更新同一份、沒有才新增」邏輯，用 word+type+grade+lesson 當身分 */
function _ltUpsertQuestion(word, type, text) {
  var info = _ltCurrent;
  var existing = _ltQuestionDocs[word] && _ltQuestionDocs[word][type];
  if (!text) {
    if (existing) return db.collection('questions').doc(existing.docId).delete();
    return Promise.resolve();
  }
  var docData = {
    grade: info.grade, lesson: info.lesson, lessonName: info.lessonName || '',
    type: type, question: text, answer: word, options: [],
    teacherUid: currentTeacher.uid, createdAt: new Date().toISOString()
  };
  if (existing) return db.collection('questions').doc(existing.docId).set(docData);
  return db.collection('questions').add(docData);
}

/* ════════════════════════════════════════
   字數／朗讀時間統計
   ════════════════════════════════════════ */
function _ltUpdateStats() {
  var ta = document.getElementById('lt-ta');
  var el = document.getElementById('lt-stats');
  if (!ta || !el) return;
  var chars = Array.from(ta.value).filter(function(c) { return /[一-鿿㐀-䶿]/.test(c); });
  var n = chars.length;
  var secs = Math.round(n / 3); // 粗估：中低年級慢速朗讀約每秒3字
  var mm = Math.floor(secs / 60), ss = secs % 60;
  el.textContent = n + ' 個中文字・預估朗讀時間約 ' + mm + ':' + (ss < 10 ? '0' : '') + ss;
}

/* ════════════════════════════════════════
   跨課讀音建議：掃一次全部課文的 pronFixes，統計每個字最常用哪個讀音，
   點多音字選單時優先提示這個建議，不用每課重新判斷一次同一個字該選哪個讀音
   ════════════════════════════════════════ */
function _ltBuildGlobalHints() {
  var hints = {};
  _ltList.forEach(function(l) {
    Object.keys(l.pronFixes || {}).forEach(function(key) {
      var fix = l.pronFixes[key];
      if (!fix || !fix.ch) return;
      if (!hints[fix.ch]) hints[fix.ch] = {};
      hints[fix.ch][fix.readingIndex] = (hints[fix.ch][fix.readingIndex] || 0) + 1;
    });
  });
  _ltGlobalHints = hints;
}

function _ltHintForChar(ch) {
  var counts = _ltGlobalHints && _ltGlobalHints[ch];
  if (!counts) return null;
  var bestIdx = null, bestCount = 0;
  Object.keys(counts).forEach(function(idx) {
    if (counts[idx] > bestCount) { bestCount = counts[idx]; bestIdx = +idx; }
  });
  return bestIdx === null ? null : { readingIndex: bestIdx, count: bestCount };
}

/* ════════════════════════════════════════
   破音字讀音選單
   ════════════════════════════════════════ */
function _ltEnsureHetPopover() {
  var pop = document.getElementById('lt-het-popover');
  if (pop) return pop;
  pop = document.createElement('div');
  pop.id = 'lt-het-popover';
  pop.style.cssText = 'position:fixed;z-index:9999;display:none;background:white;border:1.5px solid var(--border);' +
    'border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:12px;min-width:220px;max-width:280px;' +
    'font-family:"Noto Sans TC",sans-serif';
  document.body.appendChild(pop);
  document.addEventListener('pointerdown', function(e) {
    if (pop.style.display === 'none') return;
    if (pop.contains(e.target) || (e.target.classList && e.target.classList.contains('lt-het-char'))) return;
    _ltCloseHetPopover();
  });
  return pop;
}
function _ltCloseHetPopover() {
  var pop = document.getElementById('lt-het-popover');
  if (pop) pop.style.display = 'none';
  _ltHetPos = null;
}
function _ltCharClick(line, ci, ch, el) {
  if (!HETERONYM_READINGS[ch]) return;
  var pop = _ltEnsureHetPopover();
  _ltHetPos = { line: line, ci: ci, ch: ch };
  _ltRenderHetPopoverContent();
  pop.style.display = '';
  var rect = el.getBoundingClientRect();
  pop.style.top  = (rect.bottom + 6) + 'px';
  pop.style.left = rect.left + 'px';
  requestAnimationFrame(function() {
    var pw = pop.offsetWidth;
    if (rect.left + pw > window.innerWidth - 10) pop.style.left = Math.max(10, window.innerWidth - pw - 10) + 'px';
  });
}
function _ltRenderHetPopoverContent() {
  var pop = document.getElementById('lt-het-popover');
  var pos = _ltHetPos;
  if (!pop || !pos) return;
  var readings = HETERONYM_READINGS[pos.ch] || [];
  var existing = _ltPendingPronFixes[pos.line + ':' + pos.ci];
  var curIndex = (existing && existing.ch === pos.ch) ? existing.readingIndex : 0;
  var curHomophone = (existing && existing.ch === pos.ch) ? (existing.homophone || '') : '';
  var hint = (!existing) ? _ltHintForChar(pos.ch) : null;

  pop.innerHTML =
    '<div style="font-size:.91rem;font-weight:800;margin-bottom:8px">「' + escHtml(pos.ch) + '」選正確讀音</div>' +
    (hint ? '<div style="font-size:.85rem;color:var(--blue-dk);background:var(--blue-lt);border-radius:6px;' +
      'padding:5px 8px;margin-bottom:8px">💡 你在其他課文最常把這個字設成「' + escHtml(readings[hint.readingIndex] || '') +
      '」（' + hint.count + ' 次），<span style="text-decoration:underline;cursor:pointer" ' +
      'onclick="_ltPickHeteronymReading(' + hint.readingIndex + ')">套用同樣的讀音</span></div>' : '') +
    '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">' +
    readings.map(function(r, idx) {
      var active = idx === curIndex;
      return '<button type="button" onclick="_ltPickHeteronymReading(' + idx + ')" ' +
        'style="padding:6px 10px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:1.08rem;font-weight:700;' +
        (active ? 'border:2px solid var(--blue);background:var(--blue-lt);color:var(--blue-dk)'
                : 'border:1.5px solid var(--border);background:white;color:inherit') +
        '">' + escHtml(r) + '</button>';
    }).join('') +
    '</div>' +
    '<label style="display:block;font-size:.87rem;color:var(--muted);font-weight:700;margin-bottom:4px">' +
      '朗讀同音字（選填，只影響朗讀發音，不影響畫面注音）</label>' +
    '<input type="text" id="lt-het-homophone" maxlength="4" value="' + _ltEscAttr(curHomophone) + '" placeholder="例：住" ' +
      'oninput="_ltSetHeteronymHomophone(this.value)" style="width:70px;padding:5px 6px;border:1.5px solid var(--border);' +
      'border-radius:6px;font-family:inherit;font-size:1.03rem;text-align:center;margin-bottom:10px;display:block">' +
    '<div style="display:flex;justify-content:space-between;gap:8px">' +
      '<button type="button" onclick="_ltClearHeteronymFix()" style="padding:5px 12px;border:none;border-radius:8px;' +
        'background:var(--red-lt);color:var(--red);font-weight:800;cursor:pointer;font-family:inherit;font-size:.93rem">清除設定</button>' +
      '<button type="button" onclick="_ltCloseHetPopover()" style="padding:5px 12px;border:1.5px solid var(--border);' +
        'border-radius:8px;background:white;font-weight:700;cursor:pointer;font-family:inherit;font-size:.93rem">關閉</button>' +
    '</div>';
}
function _ltPickHeteronymReading(idx) {
  var pos = _ltHetPos;
  if (!pos) return;
  var homophoneInput = document.getElementById('lt-het-homophone');
  var homophone = homophoneInput ? homophoneInput.value.trim() : '';
  var key = pos.line + ':' + pos.ci;
  if (idx === 0 && !homophone) delete _ltPendingPronFixes[key];
  else _ltPendingPronFixes[key] = { ch: pos.ch, readingIndex: idx, homophone: homophone };
  _ltRenderTextPreview();
  _ltRenderHetPopoverContent();
}
function _ltSetHeteronymHomophone(val) {
  var pos = _ltHetPos;
  if (!pos) return;
  val = val.trim();
  var key = pos.line + ':' + pos.ci;
  var existing = _ltPendingPronFixes[key];
  var curIndex = (existing && existing.ch === pos.ch) ? existing.readingIndex : 0;
  if (curIndex === 0 && !val) delete _ltPendingPronFixes[key];
  else _ltPendingPronFixes[key] = { ch: pos.ch, readingIndex: curIndex, homophone: val };
  _ltRenderTextPreview();
}
function _ltClearHeteronymFix() {
  var pos = _ltHetPos;
  if (!pos) return;
  delete _ltPendingPronFixes[pos.line + ':' + pos.ci];
  _ltRenderTextPreview();
  _ltRenderHetPopoverContent();
}

/* ════════════════════════════════════════
   試聽（套用目前破音字朗讀同音字設定）
   ════════════════════════════════════════ */
var _ltZhVoice = null;
function _ltLoadVoices() {
  if (!window.speechSynthesis) return;
  var voices = window.speechSynthesis.getVoices();
  if (voices && voices.length) _ltZhVoice = pickBestZhVoice(voices);
}
if (window.speechSynthesis) {
  _ltLoadVoices();
  window.speechSynthesis.onvoiceschanged = _ltLoadVoices;
}
function _ltSpeakParagraph(lineIdxs) {
  var ta = document.getElementById('lt-ta');
  if (!ta || !window.speechSynthesis) return;
  var lines = _ltSplitLines(ta.value);
  var fixes = _ltPendingPronFixes || {};
  var text = lineIdxs.map(function(li) {
    var line = lines[li];
    if (!line || line.image) return '';
    return line.chars.map(function(c, ci) {
      var fix = fixes[li + ':' + ci];
      return (fix && fix.ch === c.ch && fix.homophone) ? fix.homophone : c.ch;
    }).join('');
  }).join('，');
  if (!text) return;
  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) window.speechSynthesis.cancel();
  var u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-TW';
  u.rate = 0.9;
  if (_ltZhVoice) u.voice = _ltZhVoice;
  window.speechSynthesis.speak(u);
}

/* ════════════════════════════════════════
   插入分段
   ════════════════════════════════════════ */
function _ltInsertParaBreak() {
  var ta = document.getElementById('lt-ta');
  if (!ta) return;
  var start = ta.selectionStart, end = ta.selectionEnd;
  var before = ta.value.slice(0, start);
  var after  = ta.value.slice(end);
  ta.value = before + '\n\n' + after;
  var newPos = before.length + 2;
  ta.focus();
  ta.setSelectionRange(newPos, newPos);
  _ltOnTextInput();
}

/* ════════════════════════════════════════
   檔案上傳轉文字
   ════════════════════════════════════════ */
function _ltFullTextFileSelected(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  var ext = _lftExt(file.name);
  var statusEl = document.getElementById('lt-status');
  if (ext === 'doc') {
    if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = '⚠️ 偵測到舊版 .doc 格式，請用 Word/WPS/Google 文件另存新檔為 .docx 後再上傳'; }
    input.value = '';
    return;
  }
  if (LFT_SUPPORTED_EXTS.indexOf(ext) === -1) {
    if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = '⚠️ 不支援的檔案格式：.' + ext; }
    input.value = '';
    return;
  }
  if (statusEl) { statusEl.style.color = 'var(--muted)'; statusEl.textContent = '轉換中…'; }
  var fr = new FileReader();
  fr.onload = function(e) {
    _lftExtractText(ext, e.target.result).then(function(text) {
      var ta = document.getElementById('lt-ta');
      if (ta) ta.value = text;
      _ltOnTextInput();
      if (statusEl) { statusEl.style.color = 'var(--blue-dk)'; statusEl.textContent = '✅ 已轉換，請檢查內容後按「儲存課文全文」'; }
      input.value = '';
    }).catch(function(err) {
      if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = '⚠️ 轉換失敗：' + err.message; }
      input.value = '';
    });
  };
  if (ext === 'txt') fr.readAsText(file);
  else fr.readAsArrayBuffer(file);
}

/* ════════════════════════════════════════
   儲存／分享同步
   ════════════════════════════════════════ */
function _ltSyncSharedSnapshots(info, fullText, pronFixes, classIds, prevIds, vocabWords) {
  var batch = db.batch();
  (prevIds || []).forEach(function(cid) {
    if (classIds.indexOf(cid) === -1) {
      batch.delete(db.collection('classes').doc(cid).collection('sharedLessonTexts').doc(info.docId));
    }
  });
  classIds.forEach(function(cid) {
    batch.set(db.collection('classes').doc(cid).collection('sharedLessonTexts').doc(info.docId), {
      teacherUid: currentTeacher.uid, grade: info.grade, lesson: info.lesson, lessonName: info.lessonName,
      fullText: fullText, pronFixes: pronFixes, vocabWords: vocabWords || [], sharedAt: new Date().toISOString()
    });
  });
  return batch.commit();
}

/* 本課語詞（手動加入那份）有變動時，如果這課已經分享給班級了，立刻重新同步，
   不用等老師按「儲存課文全文」——跟拖曳選字當下就會生效的體驗一致。
   fullText/pronFixes 用 info 上次儲存的版本（不是 textarea 目前還沒存檔的內容），
   只是把 vocabWords 覆寫上去，不會動到其他欄位。
   失敗時不能只跳一個會消失的 toast——網路不穩或多分頁同時編輯，老師不會注意到，畫面上會
   一直顯示「已經加入」但學生端其實沒更新；改成在語詞面板留一個持續可見的重試提示。 */
var _ltVocabSyncFailed = false;
function _ltResyncSharedVocabIfNeeded() {
  var info = _ltCurrent;
  if (!info || !db) return Promise.resolve();
  var sharedIds = info.sharedClassIds || [];
  if (!sharedIds.length) { _ltVocabSyncFailed = false; _ltRenderVocabSyncStatus(); return Promise.resolve(); }
  return _ltSyncSharedSnapshots(info, info.fullText, info.pronFixes, sharedIds, sharedIds, Object.keys(_ltVocabManual))
    .then(function() { _ltVocabSyncFailed = false; _ltRenderVocabSyncStatus(); })
    .catch(function() { _ltVocabSyncFailed = true; _ltRenderVocabSyncStatus(); });
}
function _ltRenderVocabSyncStatus() {
  var el = document.getElementById('lt-vocab-sync-status');
  if (!el) return;
  el.innerHTML = _ltVocabSyncFailed
    ? '<div style="background:var(--red-lt);color:var(--red);border-radius:7px;padding:7px 10px;font-size:.82rem;' +
      'font-weight:700;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:8px">' +
      '<span>⚠️ 語詞還沒同步給學生</span>' +
      '<button type="button" onclick="_ltResyncSharedVocabIfNeeded()" style="border:none;background:var(--red);' +
      'color:white;padding:3px 10px;border-radius:6px;cursor:pointer;font-family:inherit;font-size:.78rem;' +
      'font-weight:800">重試</button></div>'
    : '';
}

function _ltSaveLessonText() {
  var info = _ltCurrent;
  var ta = document.getElementById('lt-ta');
  var statusEl = document.getElementById('lt-status');
  if (!info || !ta || !db || !currentTeacher) return;
  var text = ta.value;
  var pronFixes = _ltCollectPronFixes();
  if (statusEl) { statusEl.style.color = 'var(--muted)'; statusEl.textContent = '儲存中…'; }

  _ltPushVersionSnapshot(info).then(function() {
    return db.collection('lessonTexts').doc(info.docId).set({
      teacherUid: currentTeacher.uid, grade: info.grade, lesson: info.lesson, lessonName: info.lessonName,
      fullText: text, pronFixes: pronFixes, updatedAt: new Date().toISOString()
    }, { merge: true });
  }).then(function() {
    var sharedIds = info.sharedClassIds || [];
    if (!sharedIds.length) return null;
    return _ltSyncSharedSnapshots(info, text, pronFixes, sharedIds, sharedIds, Object.keys(_ltVocabManual));
  }).then(function(synced) {
    info.fullText = text;
    info.pronFixes = pronFixes;
    if (_ltIsNew) { _ltList.push(info); _ltIsNew = false; }
    if (statusEl) {
      statusEl.style.color = 'var(--green)';
      statusEl.textContent = synced !== null ? '✅ 已儲存（已同步更新到已分享的班級）' : '✅ 已儲存';
    }
    showToast('✅ 課文全文已儲存');
  }).catch(function(e) {
    if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = '❌ ' + e.message; }
    showToast('❌ 儲存失敗：' + e.message);
  });
}

function _ltSaveLessonShare() {
  var info = _ltCurrent;
  var statusEl = document.getElementById('lt-share-status');
  if (!info || !db || !currentTeacher) return;
  var checkboxes = document.querySelectorAll('.lt-class-cb');
  var classIds = [];
  checkboxes.forEach(function(cb) { if (cb.checked) classIds.push(cb.value); });
  var ta = document.getElementById('lt-ta');
  var fullText = ta ? ta.value : '';
  var pronFixes = _ltCollectPronFixes();
  if (statusEl) { statusEl.style.color = 'var(--muted)'; statusEl.textContent = '更新中…'; }

  db.collection('lessonTexts').doc(info.docId).set({
    teacherUid: currentTeacher.uid, grade: info.grade, lesson: info.lesson, lessonName: info.lessonName,
    fullText: fullText, pronFixes: pronFixes, sharedClassIds: classIds, updatedAt: new Date().toISOString()
  }, { merge: true }).then(function() {
    return _ltSyncSharedSnapshots(info, fullText, pronFixes, classIds, info.sharedClassIds || [], Object.keys(_ltVocabManual));
  }).then(function() {
    info.sharedClassIds = classIds;
    info.pronFixes = pronFixes;
    if (_ltIsNew) { _ltList.push(info); _ltIsNew = false; }
    if (statusEl) { statusEl.style.color = 'var(--green)'; statusEl.textContent = '✅ 已更新'; }
    showToast('✅ 分享班級已更新');
  }).catch(function(e) {
    if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = '❌ ' + e.message; }
    showToast('❌ 更新失敗：' + e.message);
  });
}

/* ════════════════════════════════════════
   版本歷史：存檔前先把「存檔前」的內容推進 versions 子集合，最多留 LT_MAX_VERSIONS 筆
   （新文件第一次存檔沒有「之前的內容」可存，直接略過）
   ════════════════════════════════════════ */
function _ltPushVersionSnapshot(info) {
  if (_ltIsNew || !info.fullText) return Promise.resolve();
  var versionsRef = db.collection('lessonTexts').doc(info.docId).collection('versions');
  return versionsRef.add({
    fullText: info.fullText, pronFixes: info.pronFixes || {}, savedAt: new Date().toISOString()
  }).then(function() {
    return versionsRef.orderBy('savedAt', 'desc').get();
  }).then(function(snap) {
    if (snap.size <= LT_MAX_VERSIONS) return;
    var toDelete = snap.docs.slice(LT_MAX_VERSIONS);
    var batch = db.batch();
    toDelete.forEach(function(d) { batch.delete(d.ref); });
    return batch.commit();
  }).catch(function(e) { console.warn('版本快照存檔失敗（不影響主要存檔）：', e); });
}

function _ltToggleVersions() {
  var panel = document.getElementById('lt-versions-panel');
  if (!panel) return;
  var opening = panel.classList.contains('hidden');
  panel.classList.toggle('hidden', !opening);
  if (opening) _ltLoadVersions();
}

function _ltLoadVersions() {
  var panel = document.getElementById('lt-versions-panel');
  var info = _ltCurrent;
  if (!panel || !info || _ltIsNew) { if (panel) panel.innerHTML = '<div style="color:var(--muted)">這篇課文還沒存檔過，沒有版本歷史。</div>'; return; }
  panel.innerHTML = '<div class="loading-wrap" style="padding:8px 0"><div class="spinner"></div></div>';
  db.collection('lessonTexts').doc(info.docId).collection('versions').orderBy('savedAt', 'desc').get()
    .then(function(snap) {
      _ltVersions = [];
      snap.forEach(function(doc) { _ltVersions.push({ id: doc.id, data: doc.data() }); });
      if (!_ltVersions.length) {
        panel.innerHTML = '<div style="color:var(--muted)">還沒有歷史版本（存檔時會自動留存前一版）。</div>';
        return;
      }
      panel.innerHTML = _ltVersions.map(function(v, i) {
        var t = new Date(v.data.savedAt);
        var label = t.toLocaleString('zh-TW');
        var wc = Array.from(v.data.fullText || '').filter(function(c) { return /[一-鿿㐀-䶿]/.test(c); }).length;
        return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;' +
          (i < _ltVersions.length - 1 ? 'border-bottom:1px solid var(--border)' : '') + '">' +
          '<span style="flex:1">' + escHtml(label) + '（' + wc + ' 字）</span>' +
          '<button onclick="_ltRestoreVersion(\'' + v.id + '\')" style="padding:3px 10px;border:1.5px solid var(--blue);' +
            'border-radius:6px;background:white;color:var(--blue-dk);font-weight:700;cursor:pointer;font-family:inherit;' +
            'font-size:.89rem">還原這個版本</button>' +
          '</div>';
      }).join('');
    }).catch(function(e) { panel.innerHTML = '<div style="color:var(--red)">載入失敗：' + e.message + '</div>'; });
}

function _ltRestoreVersion(versionId) {
  var v = _ltVersions.filter(function(x) { return x.id === versionId; })[0];
  if (!v) return;
  if (!window.confirm('還原到這個版本？目前文字框裡還沒存檔的內容會被取代（但不會立刻存檔，你可以確認後再按「儲存課文全文」）。')) return;
  var ta = document.getElementById('lt-ta');
  if (ta) ta.value = v.data.fullText || '';
  _ltPendingPronFixes = JSON.parse(JSON.stringify(v.data.pronFixes || {}));
  _ltOnTextInput();
  showToast('✅ 已還原，記得確認內容後按「儲存課文全文」');
}

/* ════════════════════════════════════════
   真·所見即所得預覽：載入課文趣同一顆注音字型（BpmfZihiKai），切換後預覽直接顯示
   實際字形＋選好的破音字讀音，不用再靠底線標記去想像畫面長怎樣
   ════════════════════════════════════════ */
var _ltFontCssInjected = false;
function _ltEnsureFontLoaded() {
  if (_ltFontReady) return Promise.resolve();
  if (!_ltFontCssInjected) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '../apps/learn/lang/e-textbook/et-font.css';
    document.head.appendChild(link);
    _ltFontCssInjected = true;
  }
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  return document.fonts.load('700 1em BpmfZihiKai').then(function() { _ltFontReady = true; }).catch(function() {});
}
function _ltToggleWysiwyg(checked) {
  if (checked) {
    _ltEnsureFontLoaded().then(function() {
      _ltWysiwyg = true;
      _ltRenderTextPreview();
    });
  } else {
    _ltWysiwyg = false;
    _ltRenderTextPreview();
  }
}

/* ════════════════════════════════════════
   圖片彈窗——身兼兩種用途（用 _ltImagePickerMode 區分）：
   'insert'＝插進課文內文當一行圖片（原本的功能）
   'word'  ＝指定「本課語詞」某個字的圖卡（_ltOpenWordImagePicker 開的）
   ════════════════════════════════════════ */
function _ltOpenImagePicker() {
  _ltImagePickerMode = 'insert';
  _ltImagePickerWord = null;
  _ltShowImageModal('');
}
function _ltOpenWordImagePicker(word) {
  _ltImagePickerMode = 'word';
  _ltImagePickerWord = word;
  _ltShowImageModal(word);
}
function _ltShowImageModal(prefillQuery) {
  var modal = _ltEnsureImageModal();
  modal.style.display = '';
  var titleEl = document.getElementById('lt-image-modal-title');
  if (titleEl) titleEl.textContent = _ltImagePickerMode === 'word' ? ('設定「' + prefillQuery + '」的圖片') : '選一張圖片插入課文';
  var searchInput = document.getElementById('lt-image-search');
  if (searchInput) searchInput.value = prefillQuery || '';
  var wordInput = document.getElementById('lt-image-upload-word');
  if (wordInput) wordInput.value = prefillQuery || '';
  var uploadBtn = document.getElementById('lt-image-upload-btn');
  if (uploadBtn) uploadBtn.textContent = _ltImagePickerMode === 'word' ? '上傳並設定' : '上傳並插入';
  _ltResetImageUploadArea();
  var statusEl = document.getElementById('lt-image-upload-status');
  if (statusEl) { statusEl.style.color = 'var(--muted)'; statusEl.textContent = ''; }
  _ltLoadWordImages().then(function() { _ltFilterImageModal(prefillQuery || ''); });
}
function _ltCloseImageModal() {
  var modal = document.getElementById('lt-image-modal');
  if (modal) modal.style.display = 'none';
}
function _ltEnsureImageModal() {
  var modal = document.getElementById('lt-image-modal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'lt-image-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:none;background:rgba(0,0,0,.4);' +
    'align-items:center;justify-content:center';
  modal.innerHTML = '<div style="background:white;border-radius:12px;padding:18px;max-width:520px;max-height:70vh;' +
    'overflow:auto;width:90%"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
    '<div id="lt-image-modal-title" style="font-weight:900">選一張圖片插入課文</div>' +
    '<button onclick="_ltCloseImageModal()" ' +
    'style="border:none;background:none;font-size:1.33rem;cursor:pointer">✕</button></div>' +
    '<input id="lt-image-search" placeholder="搜尋詞語…" oninput="_ltFilterImageModal(this.value)" ' +
    'style="width:100%;padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;' +
    'margin-bottom:10px;box-sizing:border-box">' +
    '<div id="lt-image-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:8px"></div>' +
    '<div style="border-top:1.5px solid var(--border);margin-top:12px;padding-top:12px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
        '<div style="font-size:.93rem;font-weight:800">或從電腦上傳新圖片</div>' +
        '<button type="button" onclick="_ltOpenGoogleSearch()" style="padding:4px 10px;border:1.5px solid var(--border);' +
          'border-radius:7px;background:white;font-size:.87rem;font-weight:800;cursor:pointer;font-family:inherit">' +
          '🔍 用 Google 搜圖</button>' +
      '</div>' +
      '<div id="lt-image-upload-area" tabindex="0" ' +
        'style="border:2px dashed var(--border);border-radius:10px;min-height:120px;display:flex;flex-direction:column;' +
        'align-items:center;justify-content:center;gap:4px;cursor:pointer;outline:none;margin-bottom:8px;overflow:hidden;' +
        'position:relative" ' +
        'ondragover="event.preventDefault();this.style.borderColor=\'var(--blue)\'" ' +
        'ondragleave="this.style.borderColor=\'\'" ' +
        'ondrop="_ltHandleImageDrop(event)" ' +
        'onclick="document.getElementById(\'lt-image-upload-file\').click()">' +
        '<img id="lt-image-upload-preview" src="" alt="" style="display:none;max-width:100%;max-height:150px;' +
          'border-radius:6px;object-fit:contain;pointer-events:none">' +
        '<div id="lt-image-upload-hint" style="text-align:center;padding:10px;pointer-events:none">' +
          '<div style="font-size:1.75rem">📋</div>' +
          '<div style="font-size:.89rem;font-weight:800;color:var(--muted)">Ctrl+V 貼上，或拖放／點擊選擇圖片</div>' +
        '</div>' +
      '</div>' +
      '<input type="file" id="lt-image-upload-file" accept="image/*" style="display:none" onchange="_ltImageFileSelected(this)">' +
      '<input type="text" id="lt-image-upload-word" placeholder="圖片說明（選填，之後也會出現在詞語圖庫）" ' +
        'style="width:100%;padding:6px 8px;border:1.5px solid var(--border);border-radius:6px;font-family:inherit;' +
        'font-size:.98rem;margin-bottom:8px;box-sizing:border-box">' +
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<button type="button" id="lt-image-upload-btn" onclick="_ltUploadNewImage()" disabled style="padding:6px 16px;' +
          'border:none;border-radius:8px;background:var(--blue);color:white;font-size:.95rem;font-weight:800;cursor:pointer;' +
          'font-family:inherit;opacity:.5">上傳並插入</button>' +
        '<span id="lt-image-upload-status" style="font-size:.89rem;font-weight:700;color:var(--muted)"></span>' +
      '</div>' +
    '</div></div>';
  modal.addEventListener('click', function(e) { if (e.target === modal) _ltCloseImageModal(); });
  document.body.appendChild(modal);
  return modal;
}

/* 開一個新分頁用 Google 圖片搜尋目前的詞語——使用者可以在那邊複製圖片，回來貼上（Ctrl+V）到下面的上傳區。
   跟詞語圖庫 word-image.js 的「搜圖」按鈕同一個做法（直接開 tbm=isch 搜尋頁，不接任何圖片 API）。 */
function _ltOpenGoogleSearch() {
  var q = ((document.getElementById('lt-image-search') || {}).value || _ltImagePickerWord || '').trim();
  if (!q) { showToast('請先輸入要搜尋的詞語'); return; }
  window.open('https://www.google.com/search?q=' + encodeURIComponent(q) + '&tbm=isch', '_blank');
}

function _ltResetImageUploadArea() {
  _ltPendingImageBlob = null;
  var preview = document.getElementById('lt-image-upload-preview');
  var hint    = document.getElementById('lt-image-upload-hint');
  var btn     = document.getElementById('lt-image-upload-btn');
  if (preview) { preview.style.display = 'none'; preview.src = ''; }
  if (hint)    hint.style.display = '';
  if (btn)     { btn.disabled = true; btn.style.opacity = '.5'; }
}

function _ltShowImageUploadPreview(blob) {
  _ltPendingImageBlob = blob;
  var url = URL.createObjectURL(blob);
  var preview = document.getElementById('lt-image-upload-preview');
  var hint    = document.getElementById('lt-image-upload-hint');
  var btn     = document.getElementById('lt-image-upload-btn');
  if (preview) {
    preview.onload = function() { URL.revokeObjectURL(url); };
    preview.src = url;
    preview.style.display = 'block';
  }
  if (hint) hint.style.display = 'none';
  if (btn)  { btn.disabled = false; btn.style.opacity = '1'; }
}

function _ltImageFileSelected(input) {
  if (input.files && input.files[0]) _ltShowImageUploadPreview(input.files[0]);
}

function _ltHandleImageDrop(e) {
  e.preventDefault();
  e.currentTarget.style.borderColor = '';
  var files = e.dataTransfer && e.dataTransfer.files;
  if (files && files[0] && files[0].type.indexOf('image') !== -1) _ltShowImageUploadPreview(files[0]);
}

/* document 層級監聽貼上——跟 word-image.js 同一套做法，只在圖片彈窗開著的時候才處理 */
document.addEventListener('paste', function(e) {
  var modal = document.getElementById('lt-image-modal');
  if (!modal || modal.style.display === 'none') return;
  var items = (e.clipboardData || {}).items || [];
  for (var i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      e.preventDefault();
      var blob = items[i].getAsFile();
      if (blob) _ltShowImageUploadPreview(blob);
      return;
    }
  }
});
function _ltRenderImageModal(list) {
  var grid = document.getElementById('lt-image-grid');
  if (!grid) return;
  if (!list.length) {
    grid.innerHTML = '<div style="color:var(--muted);font-size:.95rem;grid-column:1/-1">還沒有符合的圖片，可以用下面「上傳新圖片」新增。</div>';
    return;
  }
  grid.innerHTML = list.map(function(w) {
    return '<button onclick="_ltImageModalPick(\'' + _ltEscJs(w.docId) + '\')" style="border:1.5px solid var(--border);' +
      'border-radius:8px;padding:4px;background:white;cursor:pointer;display:flex;flex-direction:column;' +
      'align-items:center;gap:3px;font-family:inherit">' +
      '<img src="' + w.imageUrl + '" style="width:60px;height:60px;object-fit:contain">' +
      '<span style="font-size:.83rem">' + escHtml(w.word) + '</span></button>';
  }).join('');
}
function _ltFilterImageModal(q) {
  q = q.trim();
  var list = (_ltWordImages || []).filter(function(w) { return !q || w.word.indexOf(q) !== -1; });
  _ltRenderImageModal(list);
}
function _ltImageModalPick(docId) {
  if (_ltImagePickerMode === 'word') _ltAssignWordImage(docId);
  else _ltInsertImage(docId);
}
function _ltInsertImage(docId) {
  var ta = document.getElementById('lt-ta');
  if (!ta) return;
  var start = ta.selectionStart, end = ta.selectionEnd;
  var before = ta.value.slice(0, start);
  var after  = ta.value.slice(end);
  var needsLeadNL = before.length > 0 && !/\n$/.test(before);
  var marker = (needsLeadNL ? '\n\n' : '') + '［圖:' + docId + '］\n\n';
  ta.value = before + marker + after;
  _ltCloseImageModal();
  _ltOnTextInput();
}

/* 把一張既有的詞語圖庫圖片指定成「這一課、這個語詞」的圖卡。
   跟 word-image.js 同一套慣例，用 word+gradeLesson 當這張圖卡的身分——
   如果這一課這個字已經有圖了就直接更新那一份（同一個 docId），不是這個字第一次設定才新增。 */
function _ltAssignWordImage(docId) {
  var word = _ltImagePickerWord;
  var info = _ltCurrent;
  if (!word || !info || !db) return;
  var img = (_ltWordImages || []).filter(function(x) { return x.docId === docId; })[0];
  if (!img) return;
  var gradeLesson = info.grade + '_' + info.lesson;
  var existing = (_ltWordImages || []).filter(function(x) { return x.word === word && x.gradeLesson === gradeLesson; })[0];
  var docData = { teacherUid: currentTeacher.uid, word: word, gradeLesson: gradeLesson, imageUrl: img.imageUrl, createdAt: new Date().toISOString() };
  var save = existing
    ? db.collection('wordImages').doc(existing.docId).set(docData)
    : db.collection('wordImages').add(docData);
  Promise.resolve(save).then(function(ref) {
    if (existing) {
      existing.imageUrl = img.imageUrl;
    } else {
      _ltWordImages.unshift({ docId: ref.id, word: word, imageUrl: img.imageUrl, gradeLesson: gradeLesson });
    }
    _ltCloseImageModal();
    _ltRenderVocabPanel();
    showToast('✅ 已設定「' + word + '」的圖片');
  }).catch(function(e) { showToast('❌ 設定失敗：' + e.message); });
}

/* 從電腦上傳新圖片——不是只能從已經上傳過的詞語圖庫裡選。重用 word-image.js 的
   _wiCompressToDataUrl()（跟詞語圖庫上傳同一套壓縮設定），存進同一個 wordImages collection。
   mode='insert' 時維持原行為（上傳完直接插入課文）；mode='word' 時存成這個字這一課的圖卡
   （用 word+gradeLesson 跟 _ltAssignWordImage 同一套 upsert 邏輯，不會重複建立）。 */
function _ltUploadNewImage() {
  var wordInput  = document.getElementById('lt-image-upload-word');
  var statusEl   = document.getElementById('lt-image-upload-status');
  var blob = _ltPendingImageBlob;
  if (!blob) {
    if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = '請先選擇／貼上／拖放圖片'; }
    return;
  }
  if (statusEl) { statusEl.style.color = 'var(--muted)'; statusEl.textContent = '上傳中…'; }
  _wiCompressToDataUrl(blob, 800, 0.82, function(dataUrl) {
    if (_ltImagePickerMode === 'word') {
      var word = _ltImagePickerWord;
      var info = _ltCurrent;
      var gradeLesson = info.grade + '_' + info.lesson;
      var existing = (_ltWordImages || []).filter(function(x) { return x.word === word && x.gradeLesson === gradeLesson; })[0];
      var docData = { teacherUid: currentTeacher.uid, word: word, gradeLesson: gradeLesson, imageUrl: dataUrl, createdAt: new Date().toISOString() };
      var save = existing
        ? db.collection('wordImages').doc(existing.docId).set(docData)
        : db.collection('wordImages').add(docData);
      Promise.resolve(save).then(function(ref) {
        if (!_ltWordImages) _ltWordImages = [];
        if (existing) existing.imageUrl = dataUrl;
        else _ltWordImages.unshift({ docId: ref.id, word: word, imageUrl: dataUrl, gradeLesson: gradeLesson });
        _ltCloseImageModal();
        _ltRenderVocabPanel();
        showToast('✅ 已設定「' + word + '」的圖片');
      }).catch(function(e) {
        if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = '上傳失敗：' + e.message; }
      });
      return;
    }
    var w = (wordInput && wordInput.value.trim()) || ('課文插圖 ' + new Date().toLocaleDateString('zh-TW'));
    db.collection('wordImages').add({
      teacherUid: currentTeacher.uid, word: w, imageUrl: dataUrl, createdAt: new Date().toISOString()
    }).then(function(ref) {
      if (!_ltWordImages) _ltWordImages = [];
      _ltWordImages.unshift({ docId: ref.id, word: w, imageUrl: dataUrl, gradeLesson: '' });
      _ltInsertImage(ref.id); // 這裡面會關閉 modal、重畫預覽
      showToast('✅ 圖片已上傳並插入');
    }).catch(function(e) {
      if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = '上傳失敗：' + e.message; }
    });
  });
}

/* ════════════════════════════════════════
   列印／匯出
   ════════════════════════════════════════ */
function _ltPrintLesson() {
  var ta = document.getElementById('lt-ta');
  var info = _ltCurrent;
  if (!ta || !info) return;
  var lines = _ltSplitLines(ta.value);
  var bodyHtml = lines.map(function(line) {
    if (line.blank) return '<div style="height:1em"></div>';
    if (line.image) {
      var img = (_ltWordImages || []).filter(function(w) { return w.docId === line.image; })[0];
      return img ? '<div style="margin:8px 0"><img src="' + img.imageUrl + '" style="max-width:150px"></div>' : '';
    }
    return '<div>' + escHtml(line.text) + '</div>';
  }).join('');
  var win = window.open('', '_blank');
  if (!win) { showToast('瀏覽器擋住了列印視窗，請允許彈出視窗後再試一次'); return; }
  win.document.write(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + escHtml(info.lessonName || ('第' + info.lesson + '課')) + '</title>' +
    '<style>body{font-family:"Noto Sans TC",sans-serif;font-size:20px;line-height:2.2;padding:40px;max-width:700px;margin:0 auto}' +
    'h1{font-size:1.3em}</style></head><body>' +
    '<h1>' + escHtml(info.grade) + '　第' + escHtml(info.lesson) + '課　' + escHtml(info.lessonName || '') + '</h1>' +
    bodyHtml + '</body></html>'
  );
  win.document.close();
  win.focus();
  setTimeout(function() { win.print(); }, 300);
}
