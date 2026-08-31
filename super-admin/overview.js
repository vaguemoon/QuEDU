/**
 * super-admin/overview.js — 全站統計數字（教師、班級、學生、今日活躍）
 * 依賴：shared.js（db）
 */
'use strict';

function loadSchoolStats() {
  if (!db) { setTimeout(loadSchoolStats, 400); return; }

  ['stat-teachers','stat-classes','stat-students','stat-active'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.textContent = '—';
  });

  var today = new Date(); today.setHours(0,0,0,0);

  Promise.all([
    db.collection('teachers').get(),
    db.collection('classes').get(),
    db.collection('students').get()
  ]).then(function(results) {
    var el;
    el = document.getElementById('stat-teachers');
    if (el) el.textContent = results[0].size;

    el = document.getElementById('stat-classes');
    if (el) el.textContent = results[1].size;

    el = document.getElementById('stat-students');
    if (el) el.textContent = results[2].size;

    el = document.getElementById('stat-active');
    if (el) el.textContent = '…';
    _countTodayActive(results[2], today);
  }).catch(function() {});
}

function _countTodayActive(studentsSnap, today) {
  var activeCount = 0;
  studentsSnap.forEach(function(doc) {
    var ls = doc.data().lastSeen;
    if (ls && ls.seconds * 1000 > today.getTime()) activeCount++;
  });
  var el = document.getElementById('stat-active');
  if (el) el.textContent = activeCount;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
