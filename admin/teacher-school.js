/**
 * admin/teacher-school.js — 教師加入學校、顯示所屬學校
 * Firestore 結構：
 *   teachers/{uid}       → { schoolId, schoolName, ... }
 *   schools/{schoolId}   → { name, active, createdAt }
 */
'use strict';

var currentSchoolId   = null;
var currentSchoolName = null;

/* ── 頁面就緒後載入教師學校資訊 ── */
function loadTeacherSchool() {
  if (!db || !currentTeacher) { setTimeout(loadTeacherSchool, 300); return; }

  db.collection('teachers').doc(currentTeacher.uid).get()
    .then(function(doc) {
      if (doc.exists && doc.data().schoolId) {
        currentSchoolId   = doc.data().schoolId;
        currentSchoolName = doc.data().schoolName || '（未知學校）';
        _updateSchoolDisplay();
      }
    });
}

function _updateSchoolDisplay() {
  var el = document.getElementById('teacher-school-name');
  if (el) el.textContent = currentSchoolName || '未設定';
}

/* ── 顯示學校選擇 Modal ── */
function showSchoolSelectModal() {
  document.getElementById('school-select-modal').style.display = 'flex';
  _renderSchoolList();
}

function hideSchoolSelectModal() {
  document.getElementById('school-select-modal').style.display = 'none';
}

function _renderSchoolList() {
  var list = document.getElementById('school-select-list');
  list.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  db.collection('schools').where('active', '==', true).get()
    .then(function(snap) {
      if (snap.empty) {
        list.innerHTML =
          '<div style="padding:20px;text-align:center;color:var(--muted);font-size:.85rem;font-weight:600">' +
          '目前尚無可選學校。<br>請聯繫系統管理者新增學校。</div>';
        return;
      }

      var schools = [];
      snap.forEach(function(doc) { schools.push({ id: doc.id, name: doc.data().name || '（未命名）' }); });
      schools.sort(function(a, b) { return a.name.localeCompare(b.name, 'zh-TW'); });

      var html = '';
      schools.forEach(function(s) {
        var selected = s.id === currentSchoolId;
        html +=
          '<button onclick="selectSchool(\'' + escHtml(s.id) + '\',\'' + escHtml(s.name) + '\')"'
          + ' style="display:block;width:100%;padding:13px 16px;border:none;border-bottom:1px solid var(--border);'
          + 'background:' + (selected ? 'var(--blue-lt)' : 'white') + ';'
          + 'color:' + (selected ? 'var(--blue-dk)' : 'var(--text)') + ';'
          + 'font-size:.92rem;font-weight:' + (selected ? '900' : '700') + ';'
          + 'cursor:pointer;font-family:inherit;text-align:left">'
          + escHtml(s.name) + (selected ? ' ✓' : '')
          + '</button>';
      });
      list.innerHTML = html;
    })
    .catch(function(e) {
      list.innerHTML =
        '<div style="padding:16px;color:var(--red);font-size:.85rem;font-weight:700">載入失敗：' + e.message + '</div>';
    });
}

function selectSchool(schoolId, schoolName) {
  if (!db || !currentTeacher) return;

  db.collection('teachers').doc(currentTeacher.uid).set(
    { schoolId: schoolId, schoolName: schoolName },
    { merge: true }
  )
  .then(function() {
    currentSchoolId   = schoolId;
    currentSchoolName = schoolName;
    _updateSchoolDisplay();
    hideSchoolSelectModal();
    showToast('✅ 已加入學校：' + schoolName);
  })
  .catch(function(e) { showToast('設定失敗：' + e.message); });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
