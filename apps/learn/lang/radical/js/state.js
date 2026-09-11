/**
 * state.js — 全域狀態與 Firebase 存取
 */
'use strict';

var currentStudent = null;
var radicalStatus  = {}; // { '部件': 'new'|'practiced'|'mastered' }
var decompStatus   = {}; // { '字': 'done' }（部件拼貼遊戲進度）

var radicalGroupList = []; // [{radical, title, variant, imageUrl, phrase, chars}]（部件資料庫，全校共用，App 啟動時載入一次）
var currentSetId    = ''; // 目前選定的部件本身（沿用舊變數名稱，維持 quiz.js／write.js／memory.js 既有介面）
var currentSetName  = '';
var currentSetItems = []; // [{char, radical}]，radical 固定等於 currentSetId
var currentChars    = []; // 目前部件/課次涵蓋的字（不論來源），供拼貼遊戲比對拆字資料
var currentLessonLabel = ''; // curriculum.js 選定課次後寫入，部件趣目前沒有用到這個標籤，但 curriculum.js 是共用模組，一定會寫入這個變數
var currentDecompItems = []; // [{char, type:'lr'|'tb', first, second}]（有拆字資料的字）
var radicalMeaningPool = {}; // { 部件: {imageUrl, phrase} }（從 radicalGroupList 篩出有意象圖的部件，配對消除遊戲用）

/* ── 部件資料庫：老師建立的部件全校共用，沒有班級限制，App 啟動時載入一次 ── */
function loadRadicalGroups() {
  db.collection('radicalGroups').get().then(function(snap) {
    radicalGroupList = [];
    radicalMeaningPool = {};
    snap.forEach(function(doc) {
      var d = doc.data();
      var g = {
        radical: doc.id, title: d.title || (doc.id + '部'), variant: d.variant || '',
        imageUrl: d.imageUrl || '', phrase: d.phrase || '', chars: d.chars || []
      };
      radicalGroupList.push(g);
      if (g.imageUrl) radicalMeaningPool[g.radical] = { imageUrl: g.imageUrl, phrase: g.phrase };
    });
    radicalGroupList.sort(function(a, b) { return a.title.localeCompare(b.title, 'zh-TW'); });
    renderEntryPage();
  }).catch(function() { radicalGroupList = []; radicalMeaningPool = {}; renderEntryPage(); });
}

/* ── 查詢某個部件的偏旁（變體寫法），查不到就回傳空字串 ── */
function getRadicalVariant(radical) {
  var g = radicalGroupList.filter(function(x) { return x.radical === radical; })[0];
  return g ? g.variant : '';
}

/* 部件顯示用文字：有偏旁就附註在後面，如「人(亻)」；沒有就只顯示部件本身 */
function formatRadicalLabel(radical) {
  var v = getRadicalVariant(radical);
  return v ? radical + '(' + v + ')' : radical;
}

/* ── 選定部件後載入字清單 ── */
function selectRadicalGroup(radical) {
  var g = radicalGroupList.filter(function(x) { return x.radical === radical; })[0];
  if (!g) return;

  currentSetId   = g.radical;
  currentSetName = g.title;
  var titleEl = document.getElementById('menu-set-title');
  if (titleEl) titleEl.textContent = g.title;

  currentSetItems = g.chars.map(function(c) { return { char: c, radical: g.radical }; });
  currentSetItems.forEach(function(it) {
    if (!radicalStatus[it.radical]) radicalStatus[it.radical] = 'new';
  });
  currentChars = _rkDedupeChars(g.chars);
  renderModeMenu();
  showPage('menu');
}

/* ── 課本生字模式：選定課次後的銜接（curriculum.js Hook）──
   部件對應內容（quiz/memory/write 用的 {char,radical} 標記）待後續討論後再串接，
   目前先帶入課次標題、部件清單留空，quiz.js／memory.js／write.js 遇到空清單時
   已有安全提示，不會壞畫面。課次的字本身會拿去比對拆字資料，供部件拼貼遊戲使用。 */
function onCurriculumLessonSelected(lesson, verName, bookId, gradeData) {
  currentSetId    = '';
  currentSetName  = verName + '　' + bookId + '・第 ' + (lesson.lessonNum || '') + ' 課';
  currentSetItems = [];
  currentChars    = _rkDedupeChars(lesson.chars || []);
}

function _rkDedupeChars(chars) {
  var seen = {}, list = [];
  chars.forEach(function(c) { if (c && !seen[c]) { seen[c] = true; list.push(c); } });
  return list;
}

/* ── 部件拼貼遊戲：依 currentChars 比對拆字資料庫 ── */
function _rkRefreshDecompCard() {
  if (!currentChars.length) {
    currentDecompItems = [];
    if (typeof _rkRenderDecompCard === 'function') _rkRenderDecompCard();
    if (typeof renderDecompProgress === 'function') renderDecompProgress();
    return;
  }
  Promise.all(currentChars.map(function(c) {
    return db.collection('charDecompositions').doc(c).get();
  })).then(function(docs) {
    currentDecompItems = [];
    docs.forEach(function(doc) {
      if (!doc.exists) return;
      var d = doc.data();
      var type   = d.type === 'tb' ? 'tb' : 'lr';
      var first  = type === 'tb' ? (d.top    || '') : (d.left  || '');
      var second = type === 'tb' ? (d.bottom || '') : (d.right || '');
      if (first && second) currentDecompItems.push({ char: doc.id, type: type, first: first, second: second });
    });
    if (typeof _rkRenderDecompCard === 'function') _rkRenderDecompCard();
    if (typeof renderDecompProgress === 'function') renderDecompProgress();
  }).catch(function() {
    currentDecompItems = [];
    if (typeof _rkRenderDecompCard === 'function') _rkRenderDecompCard();
    if (typeof renderDecompProgress === 'function') renderDecompProgress();
  });
}

/* ── 目前練習集有哪些不同的部件 ── */
function getDistinctRadicals() {
  var seen = {}, list = [];
  currentSetItems.forEach(function(it) {
    if (!seen[it.radical]) { seen[it.radical] = true; list.push(it.radical); }
  });
  return list;
}

function getCharsForRadical(radical) {
  return currentSetItems.filter(function(it) { return it.radical === radical; }).map(function(it) { return it.char; });
}

/* ── 進度存取 ── */
function saveProgress() {
  if (!db || !currentStudent || currentStudent.isGuest || currentStudent.isPreview) return;
  db.collection('students').doc(currentStudent.id)
    .collection('progress').doc('radical')
    .set({ radicalStatus: radicalStatus, decompStatus: decompStatus, lastStudied: new Date().toISOString() }, { merge: true })
    .catch(function(e) { console.warn('saveProgress error:', e); });
}

/**
 * 依「首次答對率」更新某個部件的熟練度
 * @param {string} radical
 * @param {number} correctCount 首次答對次數
 * @param {number} totalCount   總作答次數
 */
function updateRadicalMastery(radical, correctCount, totalCount) {
  if (!totalCount) return;
  var rate = correctCount / totalCount;
  var status = rate >= 0.8 ? 'mastered' : (rate >= 0.5 ? 'practiced' : 'new');
  // 不要把已精熟的部件因為單次表現不佳而降級太多：只在明顯退步時才降回 practiced
  if (radicalStatus[radical] === 'mastered' && status === 'new') status = 'practiced';
  radicalStatus[radical] = status;
  saveProgress();
}

/* ── Fisher-Yates 隨機排列 ── */
function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
