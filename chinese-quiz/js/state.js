/**
 * state.js — 語文練習子 App 全域狀態
 * 依賴：shared.js（db）、fallback-questions.js（EMBEDDED_QUESTIONS）
 */
'use strict';

var currentStudent = null;  // { id, name, nickname, avatar, pin, classId }
var currentQuiz    = [];    // 本次試卷題目陣列

/* ══════════════════════════════════════════
   題庫載入
   ══════════════════════════════════════════ */
function loadQuestions() {
  if (!db) { setTimeout(loadQuestions, 150); return; }
  db.collection('questions').get().then(function(snap) {
    var data = [];
    snap.forEach(function(doc) {
      data.push(Object.assign({ id: doc.id }, doc.data()));
    });
    if (data.length > 0) {
      window._questions = data;
    } else {
      window._questions = EMBEDDED_QUESTIONS;
    }
    buildLessonMap();
  }).catch(function() {
    window._questions = EMBEDDED_QUESTIONS;
    buildLessonMap();
  });
}

function buildLessonMap() {
  var map = {};
  (window._questions || []).forEach(function(q) {
    if (!map[q.grade]) map[q.grade] = {};
    map[q.grade][q.lesson] = true;
  });
  window._lessonMap = {};
  for (var g in map) {
    window._lessonMap[g] = Object.keys(map[g]);
  }
  window._lessonMapReady = true;
}

/* ══════════════════════════════════════════
   成績儲存
   ══════════════════════════════════════════ */
function saveRecord(score, correct, total, grade, lesson) {
  if (!db || !currentStudent) return;
  var record = {
    app:       'chinese-quiz',
    grade:     grade,
    lesson:    lesson || '全部',
    score:     score,
    correct:   correct,
    total:     total,
    timestamp: new Date().toISOString()
  };
  // 存到學生的 activities 子集合（與其他子 App 一致）
  db.collection('students').doc(currentStudent.id)
    .collection('activities').add(record)
    .catch(function(e) { console.error('saveRecord error:', e); });
}
