'use strict';

var currentStudent  = null;
var currentGrade    = '';
var currentSection  = '';  // 'phonics' | 'expressions' | 'words'
var currentUnit     = '';
var currentUnitName = '';
var currentMode     = '';  // 'browse' | 'quiz'

var englishImages = [];  // [{word, phoneticGroup, imageUrl, unitName}]
var engProgress   = {};  // { 'grade_section_unit': {correct, wrong} }

/* All data loaded from Firestore */
var _allData   = {};  // [grade][section][unit] = [items]
var _allGroups = {};  // [grade][section] = ['sh','ch',...]

/* ── Progress helpers ── */
function getProgressKey() {
  return currentGrade + '_' + currentSection + '_' + currentUnit;
}

function recordResult(word, isCorrect) {
  var key = getProgressKey();
  if (!engProgress[key]) engProgress[key] = { correct: 0, wrong: 0 };
  if (isCorrect) engProgress[key].correct++;
  else           engProgress[key].wrong++;
  _saveProgress();
}

function _saveProgress() {
  if (!db || !currentStudent) return;
  db.collection('students').doc(currentStudent.id)
    .collection('progress').doc('english')
    .set(engProgress, { merge: true })
    .catch(function(e) { console.warn('saveProgress error:', e); });
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
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function _escAttr(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/"/g,'&quot;')
    .replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;');
}
