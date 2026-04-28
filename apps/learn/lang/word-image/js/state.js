'use strict';

var currentStudent    = null;
var currentGrade      = '';
var currentLesson     = '';
var currentLessonName = '';
var currentMode       = '';  // 'browse' | 'quiz'

var wordImages   = [];  // 本課次圖片詞語 [{word, definition, imageUrl}]
var wordProgress = {};  // { 'grade_lesson_word': { correct, wrong } }

/* ── Progress helpers ── */

function getProgressKey(word) {
  return currentGrade + '_' + currentLesson + '_' + word;
}

function getProgressClass(word) {
  var p = wordProgress[getProgressKey(word)];
  if (!p || (!p.correct && !p.wrong)) return 'gray';
  return (p.correct >= p.wrong) ? 'green' : 'red';
}

function recordResult(word, isCorrect) {
  var key = getProgressKey(word);
  if (!wordProgress[key]) wordProgress[key] = { correct: 0, wrong: 0 };
  if (isCorrect) wordProgress[key].correct++;
  else           wordProgress[key].wrong++;
  _saveWordProgress();
}

function _saveWordProgress() {
  if (!db || !currentStudent) return;
  db.collection('students').doc(currentStudent.id)
    .collection('progress').doc('wordImage')
    .set({ words: wordProgress, lastStudied: new Date().toISOString() }, { merge: true })
    .catch(function(e) { console.warn('saveWordProgress error:', e); });
}

/* ── Utilities ── */

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function _escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _escAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
