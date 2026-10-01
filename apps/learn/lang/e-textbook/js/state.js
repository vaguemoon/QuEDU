/**
 * state.js — 全域狀態與 Firebase 存取
 * 課文身分＝teacherUid + grade + lesson，跟教師題庫（questions collection）的課次概念共用，
 * 不走共用課程（curriculum），因為特教老師的課文是自己改寫過的簡化版，沒有對應的官方課次。
 * 配套生字詞不用老師另外輸入：直接抓該課「詞語解釋」「詞語填空」題型的答案欄當生字詞。
 */
'use strict';

var currentStudent = null;

var etLessonList = [];        // 學生班級可讀的課文清單 [{docId, teacherUid, grade, lesson, lessonName, fullText, sharedAt}]
var etCurrentLesson = null;   // 目前正在讀的那一篇
var etLines = [];             // 目前課文，依行(句)拆好的陣列 [{ text, chars: [...] }]
var etVocab = {};             // { word: teacherDef }，本課配套生字詞（從題庫抓）
var etFoundWords = {};        // { word: true }，本課已找到的生字詞（持久保存）
var etWordImageMap = {};      // { word: imageUrl }，全校詞語圖庫，供圈詞查詢時顯示圖片
var etLookupCache = {};       // 萌典查詢快取 { text: { bopomofo, def } }（沒對到題庫生字詞時的備援）
var etPronFixes = {};         // { 原字: 替代同音字 }，破音字讀音調整（老師設定），整課同一字元都套用

/* 朗讀語速：可調 0.5～1.2，這個 App 服務對象需要比一般更慢的預設語速；
   用 localStorage 記住這台裝置上次設定的語速／字體大小 */
var ET_RATE_MIN     = 0.5;
var ET_RATE_MAX      = 1.2;
var ET_RATE_STEP     = 0.1;
var ET_RATE_DEFAULT  = 0.75;
var etRate = _etLoadNum('et-rate', ET_RATE_DEFAULT, ET_RATE_MIN, ET_RATE_MAX);

var ET_FONT_MIN     = 1.2;
var ET_FONT_MAX      = 2.6;
var ET_FONT_STEP     = 0.2;
var ET_FONT_DEFAULT  = 1.7;
var etFontSize = _etLoadNum('et-font-size', ET_FONT_DEFAULT, ET_FONT_MIN, ET_FONT_MAX);

function _etLoadNum(key, def, min, max) {
  var v = parseFloat(localStorage.getItem(key));
  if (isNaN(v)) return def;
  return Math.min(max, Math.max(min, v));
}
function _etSaveNum(key, v) {
  try { localStorage.setItem(key, v); } catch (e) {}
}

/* ── 載入學生班級可讀的課文清單 ── */
function loadEtLessonList() {
  var wrap = document.getElementById('et-list-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  var classIds = (currentStudent && currentStudent.classIds) || [];
  if (!classIds.length) {
    wrap.innerHTML = '<div class="et-empty">目前沒有加入班級，請先在設定裡加入班級。</div>';
    return;
  }

  Promise.all(classIds.map(function(cid) {
    return db.collection('classes').doc(cid).collection('sharedLessonTexts').get()
      .then(function(snap) {
        var list = [];
        snap.forEach(function(doc) {
          var d = doc.data();
          list.push({
            docId: doc.id, teacherUid: d.teacherUid, grade: d.grade,
            lesson: d.lesson, lessonName: d.lessonName || '', fullText: d.fullText || '',
            pronFixes: d.pronFixes || {}, sharedAt: d.sharedAt || ''
          });
        });
        return list;
      }).catch(function() { return []; });
  })).then(function(lists) {
    var merged = {};
    lists.forEach(function(list) { list.forEach(function(item) { merged[item.docId] = item; }); });
    etLessonList = Object.keys(merged).map(function(k) { return merged[k]; });
    etLessonList.sort(function(a, b) { return (b.sharedAt || '').localeCompare(a.sharedAt || ''); });
    if (typeof renderEtLessonList === 'function') renderEtLessonList();
  });
}

/* ── 選定一篇課文：拆行、抓配套生字詞、載入已找到進度 ── */
function openEtLesson(docId) {
  var lesson = etLessonList.filter(function(l) { return l.docId === docId; })[0];
  if (!lesson) return;
  etCurrentLesson = lesson;
  etLines = _etSplitLines(lesson.fullText || '');
  etPronFixes = lesson.pronFixes || {};
  etFoundWords = {};
  etVocab = {};

  _etLoadVocab(lesson);
  _etLoadLessonProgress();
}

/* 把課文全文拆成「行」，每行再拆成一個個 Unicode 字元，
   中文字才標記為可互動，標點/空白/數字/英文字母只顯示不互動。
   連續空行合併成一個「段落分隔」標記（blank:true），保留老師排版用的段落留白 */
function _etSplitLines(fullText) {
  var rawLines = String(fullText || '').split(/\r?\n/);
  var lines = [];
  rawLines.forEach(function(line) {
    var trimmed = line.trim();
    if (!trimmed) {
      if (lines.length && !lines[lines.length - 1].blank) {
        lines.push({ text: '', chars: [], blank: true });
      }
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

/* ── 破音字讀音調整：把文字裡設定過的原字換成老師指定的同音字，供「發音」與「注音查詢」共用 ──
   只影響發出去聽／查的那一份字串，畫面顯示的原文完全不受影響 */
function etApplyPronFixes(text) {
  if (!text || !etPronFixes) return text;
  var out = '';
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    out += Object.prototype.hasOwnProperty.call(etPronFixes, ch) ? etPronFixes[ch] : ch;
  }
  return out;
}

/* ── 配套生字詞：抓該老師「詞語解釋」「詞語填空」題型、同 grade+lesson 的答案欄 ──
   用 2 欄位查詢（teacherUid + grade）避免需要額外的複合索引，lesson/type 用前端過濾 */
function _etLoadVocab(lesson) {
  if (!db) { if (typeof _etOnVocabLoaded === 'function') _etOnVocabLoaded(); return; }
  db.collection('questions').where('teacherUid', '==', lesson.teacherUid).where('grade', '==', lesson.grade).get()
  .then(function(snap) {
    /* 同一個生字詞可能同時有「詞語解釋」跟「詞語填空」兩種題型，填空題的題幹是帶空格的句子，
       不是解釋，一定要讓「詞語解釋」優先；Firestore 回傳順序不保證，不能用先到先贏 */
    var defs = {}, fills = {};
    snap.forEach(function(doc) {
      var d = doc.data();
      if (d.lesson !== lesson.lesson) return;
      var word = (d.answer || '').trim();
      if (!word) return;
      if (d.type === '詞語解釋' && !defs[word]) defs[word] = d.question || '';
      else if (d.type === '詞語填空' && !fills[word]) fills[word] = d.question || '';
    });
    etVocab = {};
    Object.keys(fills).forEach(function(w) { etVocab[w] = fills[w]; });
    Object.keys(defs).forEach(function(w) { etVocab[w] = defs[w]; });
    if (typeof _etOnVocabLoaded === 'function') _etOnVocabLoaded();
  }).catch(function() {
    etVocab = {};
    if (typeof _etOnVocabLoaded === 'function') _etOnVocabLoaded();
  });
}

/* ── 進度存取：students/{id}/progress/eTextbook ──
   { lessons: { "<lessonDocId>": { foundWords: {...}, completedReading, lastReadAt } } }
   lessonDocId 跟 lessonTexts／sharedLessonTexts 共用同一組 id，方便對應 */
function _etLoadLessonProgress() {
  etFoundWords = {};
  if (!db || !currentStudent || currentStudent.isGuest || currentStudent.isPreview || !etCurrentLesson) {
    if (typeof _etOnProgressLoaded === 'function') _etOnProgressLoaded();
    return;
  }
  db.collection('students').doc(currentStudent.id)
    .collection('progress').doc('eTextbook').get()
    .then(function(doc) {
      if (doc.exists) {
        var lessons = doc.data().lessons || {};
        var entry = lessons[etCurrentLesson.docId];
        if (entry && entry.foundWords) etFoundWords = entry.foundWords;
      }
      if (typeof _etOnProgressLoaded === 'function') _etOnProgressLoaded();
    })
    .catch(function() {
      if (typeof _etOnProgressLoaded === 'function') _etOnProgressLoaded();
    });
}

function saveEtProgress(markCompleted) {
  if (!db || !currentStudent || currentStudent.isGuest || currentStudent.isPreview || !etCurrentLesson) return;
  var key = etCurrentLesson.docId;
  var ref = db.collection('students').doc(currentStudent.id).collection('progress').doc('eTextbook');
  var update = {};
  update['lessons.' + key + '.foundWords'] = etFoundWords;
  update['lessons.' + key + '.lastReadAt'] = new Date().toISOString();
  if (markCompleted) update['lessons.' + key + '.completedReading'] = true;
  ref.set({}, { merge: true }).then(function() {
    return ref.update(update);
  }).catch(function(e) { console.warn('saveEtProgress error:', e); });
}

/* ── 詞語圖庫（wordImages）：圈到的詞若剛好有教學圖片就一起顯示 ── */
function loadEtWordImageMap() {
  if (!db) return;
  db.collection('wordImages').get().then(function(snap) {
    etWordImageMap = {};
    snap.forEach(function(doc) {
      var d = doc.data();
      if (d.word && d.imageUrl) etWordImageMap[d.word] = d.imageUrl;
    });
  }).catch(function() {});
}

/* ── 萌典查詢（沒對到題庫生字詞時的備援；單字或詞語皆可用同一支 API） ── */
function _etStripHtml(str) {
  if (!str) return '';
  return String(str).replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function _etFetchMoedict(q) {
  return fetch('https://www.moedict.tw/' + encodeURIComponent(q) + '.json')
    .then(function(res) { return res.ok ? res.json() : null; })
    .catch(function() { return null; });
}

function lookupWord(text) {
  /* 優先用老師自己在題庫寫的解釋，比萌典的通用解釋更貼近學生程度 */
  if (etVocab[text]) return Promise.resolve({ bopomofo: '', def: etVocab[text], fromTeacher: true });

  /* 破音字讀音調整：注音顯示改用老師設定的同音字查到的讀音，但解釋仍查原字，避免誤用替代字的字義 */
  var subText  = etApplyPronFixes(text);
  var hasFix   = subText !== text;
  var cacheKey = hasFix ? (text + '␟' + subText) : text;
  if (etLookupCache[cacheKey]) return Promise.resolve(etLookupCache[cacheKey]);

  var queries = hasFix ? [_etFetchMoedict(text), _etFetchMoedict(subText)] : [_etFetchMoedict(text)];
  return Promise.all(queries).then(function(results) {
    var data = results[0], subData = results[1];
    var result = { bopomofo: '', def: '', fromTeacher: false };
    if (data && data.heteronyms && data.heteronyms.length) {
      var h = data.heteronyms[0];
      result.bopomofo = h.bopomofo || '';
      if (h.definitions && h.definitions[0]) result.def = _etStripHtml(h.definitions[0].def);
    }
    if (subData && subData.heteronyms && subData.heteronyms.length) {
      result.bopomofo = subData.heteronyms[0].bopomofo || result.bopomofo;
    }
    etLookupCache[cacheKey] = result;
    return result;
  });
}

/* 判斷圈到的文字是否符合本課配套生字詞（來自題庫） */
function etMatchOfficial(text) {
  return Object.prototype.hasOwnProperty.call(etVocab, text);
}
