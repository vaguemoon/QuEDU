/**
 * state.js — 全域狀態與 Firebase 存取
 */
'use strict';

var currentStudent     = null;
var currentLessonLabel = '';
var currentLessonData  = null; // { chars, words, lessonNum, name, grade }
var charStatus = {};           // { '字': 'new'|'practiced'|'mastered' }
var wordStatus = {};           // { '詞語': 'new'|'practiced'|'mastered' }
var gradePool  = { chars: [], words: [] }; // 同冊備用誘答池
var zhuyinCache = {};          // 注音快取 { '字': 'ㄗˇ' }

// ── curriculum.js Hook：選課後初始化學習狀態 ──

function preloadZhuyin(chars) {
  var overrides = (currentLessonData && currentLessonData.charOverrides) || {};
  var queue = [];
  chars.forEach(function(c) {
    if (overrides[c] && overrides[c].zhuyin) {
      zhuyinCache[c] = overrides[c].zhuyin; // admin 覆寫，直接使用
    } else if (!zhuyinCache[c]) {
      queue.push(c);
    }
  });

  var i = 0;
  function next() {
    if (i >= queue.length) return;
    var c = queue[i++];
    fetch('https://www.moedict.tw/' + encodeURIComponent(c) + '.json')
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(d) {
        if (!d || !d.heteronyms || !d.heteronyms.length) return;
        var best = d.heteronyms.reduce(function(a, b) {
          return ((b.definitions || []).length > (a.definitions || []).length) ? b : a;
        });
        var bopo = best.bopomofo || d.heteronyms[0].bopomofo || '';
        if (bopo) {
          zhuyinCache[c] = bopo;
          if (typeof updateCardZhuyin === 'function') updateCardZhuyin(c);
        }
      })
      .catch(function() {})
      .then(function() { setTimeout(next, 200); });
  }
  next();
}

function onCurriculumLessonSelected(lesson, verName, bookId, gradeData) {
  currentLessonData = lesson;
  (lesson.chars || []).forEach(function(c) { if (!charStatus[c]) charStatus[c] = 'new'; });
  (lesson.words || []).forEach(function(w) { if (!wordStatus[w]) wordStatus[w] = 'new'; });
  preloadZhuyin(lesson.chars || []);
  gradePool.chars = gradeData.reduce(function(acc, l) {
    return acc.concat((l.chars || []).filter(function(c) { return (lesson.chars || []).indexOf(c) === -1; }));
  }, []);
  gradePool.words = gradeData.reduce(function(acc, l) {
    return acc.concat((l.words || []).filter(function(w) { return (lesson.words || []).indexOf(w) === -1; }));
  }, []);
}

function getLessonMasteredState(lesson) {
  var allChars = lesson.chars || [];
  var allWords = lesson.words || [];
  return allChars.length > 0
    && allChars.every(function(c) { return charStatus[c] === 'mastered'; })
    && (!allWords.length || allWords.every(function(w) { return wordStatus[w] === 'mastered'; }));
}

function saveProgress() {
  if (!db || !currentStudent || currentStudent.isGuest) return;
  db.collection('students').doc(currentStudent.id)
    .collection('progress').doc('recognize')
    .set({ charStatus: charStatus, wordStatus: wordStatus, lastStudied: new Date().toISOString() }, { merge: true })
    .catch(function(e){ console.warn('saveProgress error:', e); });
}

/**
 * Fisher-Yates 隨機排列
 */
function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/**
 * 為一道題目產生4個選項（含正確答案）
 * @param {string} answer 正確答案
 * @param {Array} samePool 同課同類型所有項目
 * @param {Array} fallbackPool 補充用（同冊其他課）
 * @returns {Array} 已隨機排列的4個選項
 */
function buildOptions(answer, samePool, fallbackPool) {
  var others = samePool.filter(function(x) { return x !== answer; });
  others = shuffle(others);
  var distractors = others.slice(0, 3);
  if (distractors.length < 3 && fallbackPool && fallbackPool.length) {
    var extra = shuffle(fallbackPool.filter(function(x) {
      return x !== answer && distractors.indexOf(x) === -1;
    }));
    distractors = distractors.concat(extra).slice(0, 3);
  }
  return shuffle([answer].concat(distractors));
}

/**
 * 依當前課程建立所有題目（單字 + 詞語交叉排列）
 * @returns {Array} 題目陣列 [{ type, answer, options }]
 */
function buildAllQuestions() {
  var lesson = currentLessonData;
  if (!lesson) return [];
  var chars = lesson.chars || [];
  var words = lesson.words || [];

  var charQs = shuffle(chars.map(function(c) {
    return { type: 'char', answer: c, options: buildOptions(c, chars, gradePool.chars) };
  }));
  var wordQs = shuffle(words.map(function(w) {
    return { type: 'word', answer: w, options: buildOptions(w, words, gradePool.words) };
  }));

  // 交叉排列：1字、1詞、1字、1詞…
  var questions = [];
  var ci = 0, wi = 0;
  while (ci < charQs.length || wi < wordQs.length) {
    if (ci < charQs.length) questions.push(charQs[ci++]);
    if (wi < wordQs.length) questions.push(wordQs[wi++]);
  }
  return questions;
}
