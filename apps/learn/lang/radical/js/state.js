/**
 * state.js — 全域狀態與 Firebase 存取
 */
'use strict';

var currentStudent = null;
var radicalStatus  = {}; // { '部件': 'new'|'practiced'|'mastered' }

var assignedSets = []; // [{id, name}]
var currentSetId    = '';
var currentSetName  = '';
var currentSetItems = []; // [{char, radical}]

/* ── 依學生所屬班級載入被指派的練習集 ── */
function loadAssignedSets(classIds) {
  var ids = (classIds || []).filter(Boolean);
  if (!ids.length) { assignedSets = []; renderEntryPage(); return; }

  var promises = ids.map(function(cid) {
    return db.collection('radicalSetAssignments').where('classId', '==', cid).get();
  });

  Promise.all(promises).then(function(snaps) {
    var setIds = [], seen = {};
    snaps.forEach(function(snap) {
      snap.forEach(function(doc) {
        var sid = doc.data().setId;
        if (sid && !seen[sid]) { seen[sid] = true; setIds.push(sid); }
      });
    });
    if (!setIds.length) { assignedSets = []; renderEntryPage(); return; }

    Promise.all(setIds.map(function(sid) { return db.collection('radicalSets').doc(sid).get(); }))
      .then(function(docs) {
        assignedSets = [];
        docs.forEach(function(doc) {
          if (doc.exists) assignedSets.push({ id: doc.id, name: doc.data().name || '（未命名）' });
        });
        assignedSets.sort(function(a, b) { return a.name.localeCompare(b.name, 'zh-TW'); });
        renderEntryPage();
      })
      .catch(function() { assignedSets = []; renderEntryPage(); });
  }).catch(function() { assignedSets = []; renderEntryPage(); });
}

/* ── 選定練習集後載入字/部件清單 ── */
function selectSet(setId, setName) {
  currentSetId   = setId;
  currentSetName = setName;
  var titleEl = document.getElementById('menu-set-title');
  if (titleEl) titleEl.textContent = setName;

  db.collection('radicalItems').where('setId', '==', setId).get().then(function(snap) {
    currentSetItems = [];
    snap.forEach(function(doc) {
      var d = doc.data();
      if (d.char && d.radical) currentSetItems.push({ char: d.char, radical: d.radical });
    });
    currentSetItems.forEach(function(it) {
      if (!radicalStatus[it.radical]) radicalStatus[it.radical] = 'new';
    });
    renderModeMenu();
    showPage('menu');
  }).catch(function() {
    showToast('載入練習集失敗，請重新整理');
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
    .set({ radicalStatus: radicalStatus, lastStudied: new Date().toISOString() }, { merge: true })
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
