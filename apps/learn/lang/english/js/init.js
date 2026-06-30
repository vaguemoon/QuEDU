'use strict';

window.addEventListener('load', function() {
  initFirebase();
  applyTheme(currentTheme);
  PAGE_STACK = ['entry'];
  showPage('entry', false);

  (function waitDb() {
    if (!db) { setTimeout(waitDb, 200); return; }
    _loadAllImages();
    _autoLogin();
  })();
});

function _loadAllImages() {
  Promise.all([
    db.collection('englishImages').get(),
    db.collection('englishUnits').get()
  ]).then(function(results) {
    _allData   = {};
    _allGroups = {};

    /* englishImages → _allData 和圖片來源的 _allGroups */
    results[0].forEach(function(doc) {
      var d = doc.data();
      if (!d.grade || !d.section || !d.unit || !d.imageUrl) return;
      if (!_allData[d.grade]) _allData[d.grade] = {};
      if (!_allData[d.grade][d.section]) _allData[d.grade][d.section] = {};
      if (!_allData[d.grade][d.section][d.unit]) _allData[d.grade][d.section][d.unit] = [];
      _allData[d.grade][d.section][d.unit].push({
        word:          d.word          || '',
        phoneticGroup: d.phoneticGroup || '',
        imageUrl:      d.imageUrl,
        unitName:      d.unitName      || d.unit
      });
      if (d.phoneticGroup) {
        if (!_allGroups[d.grade]) _allGroups[d.grade] = {};
        if (!_allGroups[d.grade][d.section]) _allGroups[d.grade][d.section] = [];
        var arr = _allGroups[d.grade][d.section];
        if (arr.indexOf(d.phoneticGroup) === -1) arr.push(d.phoneticGroup);
      }
    });

    /* englishUnits → 補入課程定義的發音組合（含尚未上傳圖片的單元）*/
    results[1].forEach(function(doc) {
      var d = doc.data();
      if (!d.grade || !d.section || !Array.isArray(d.phoneticGroups)) return;
      if (!_allGroups[d.grade]) _allGroups[d.grade] = {};
      if (!_allGroups[d.grade][d.section]) _allGroups[d.grade][d.section] = [];
      var arr = _allGroups[d.grade][d.section];
      d.phoneticGroups.forEach(function(g) {
        if (g && arr.indexOf(g) === -1) arr.push(g);
      });
    });

    _renderGradePage();
  }).catch(function() { _renderGradePage(); });
}

function _autoLogin() {
  try {
    var saved = sessionStorage.getItem('hub_student');
    if (!saved) return;
    var hub = JSON.parse(saved);
    var id  = hub.id;

    if (hub.isPreview) {
      currentStudent = {
        name: hub.name || '老師', pin: '', id: id,
        nickname: hub.nickname || hub.name || '老師',
        avatar: hub.avatar || '👨‍🏫', classId: (hub.classIds || [])[0] || ''
      };
      _updateTopbar();
      return;
    }

    Promise.all([
      db.collection('students').doc(id).get(),
      db.collection('students').doc(id).collection('progress').doc('english').get()
    ]).then(function(res) {
      var sDoc = res[0], pDoc = res[1];
      if (!sDoc.exists) return;
      var sData = sDoc.data();
      currentStudent = {
        name:     hub.name,
        pin:      hub.pin,
        id:       id,
        nickname: sData.nickname || '',
        avatar:   sData.avatar   || '🐣',
        classId:  sData.classId  || (sData.classIds && sData.classIds[0]) || ''
      };
      engProgress = pDoc.exists ? (pDoc.data() || {}) : {};
      _updateTopbar();
      showToast('👋 歡迎 ' + (currentStudent.nickname || currentStudent.name));
    }).catch(function() {});
  } catch(e) {}
}

function _updateTopbar() {
  var avEl = document.getElementById('topbar-avatar');
  var nmEl = document.getElementById('topbar-name');
  if (avEl) avEl.textContent = currentStudent.avatar;
  if (nmEl) nmEl.textContent = currentStudent.nickname || currentStudent.name;
}

/* ════════════════════════════
   年級選擇
   ════════════════════════════ */
function _renderGradePage() {
  var inner = document.querySelector('#page-grade .en-page-inner');
  if (!inner) return;

  var grades = Object.keys(_allData).sort();
  if (!grades.length) {
    inner.innerHTML =
      '<div class="en-empty"><div class="en-empty-icon">🌐</div>' +
      '<div class="en-empty-text">目前尚無內容<br>請等老師上傳</div></div>';
    showPage('grade');
    return;
  }

  var html = '<div class="en-page-title">選擇年級</div><div class="en-btn-grid">';
  grades.forEach(function(g) {
    var sections  = _allData[g] || {};
    var secCount  = Object.keys(sections).length;
    var imgCount  = 0;
    Object.values(sections).forEach(function(units) {
      Object.values(units).forEach(function(items) { imgCount += items.length; });
    });
    html += '<button class="en-select-btn" onclick="selectGrade(\'' + _escAttr(g) + '\')">' +
      _escHtml(g) +
      '<span class="en-btn-count">' + secCount + ' 項目・' + imgCount + ' 張圖</span>' +
      '</button>';
  });
  html += '</div>';
  inner.innerHTML = html;
  showPage('grade');
}

function selectGrade(grade) {
  currentGrade = grade;
  _renderSectionPage();
  showPage('section');
}

/* ════════════════════════════
   Section 選擇
   ════════════════════════════ */
var _SECTION_META = {
  phonics:     { label: '發音',  icon: '🔊', desc: 'Phonics 音節學習' },
  expressions: { label: '常用語', icon: '💬', desc: '日常英語會話' },
  words:       { label: '生字',  icon: '📖', desc: '單字與句型' }
};
var _SECTION_ORDER = ['phonics', 'expressions', 'words'];

function _renderSectionPage() {
  var inner = document.querySelector('#page-section .en-page-inner');
  if (!inner) return;

  var available = (_allData[currentGrade]) || {};
  var html = '<div class="en-page-title">' + _escHtml(currentGrade) + '　選擇項目</div>' +
    '<div class="en-section-cards">';

  _SECTION_ORDER.forEach(function(sec) {
    var meta    = _SECTION_META[sec];
    var hasData = !!available[sec];
    var unitCnt = hasData ? Object.keys(available[sec]).length : 0;
    html += '<button class="en-section-card' + (hasData ? '' : ' disabled') + '"' +
      (hasData ? ' onclick="selectSection(\'' + sec + '\')"' : '') + '>' +
      '<div class="en-section-icon">' + meta.icon + '</div>' +
      '<div class="en-section-name">' + meta.label + '</div>' +
      '<div class="en-section-desc">' + meta.desc + '</div>' +
      (hasData
        ? '<div class="en-section-count">' + unitCnt + ' 個單元</div>'
        : '<div class="en-section-count en-soon">即將推出</div>') +
      '</button>';
  });
  html += '</div>';
  inner.innerHTML = html;
}

function selectSection(section) {
  currentSection = section;
  _renderUnitPage();
  showPage('unit');
}

/* ════════════════════════════
   Unit 選擇
   ════════════════════════════ */
function _renderUnitPage() {
  var inner = document.querySelector('#page-unit .en-page-inner');
  if (!inner) return;

  var meta   = _SECTION_META[currentSection] || { label: currentSection };
  var units  = (_allData[currentGrade] && _allData[currentGrade][currentSection]) || {};
  var keys   = Object.keys(units).sort(function(a, b) {
    var na = parseInt(a.replace(/\D+/g,''), 10);
    var nb = parseInt(b.replace(/\D+/g,''), 10);
    return (isNaN(na) || isNaN(nb)) ? a.localeCompare(b) : na - nb;
  });

  var html = '<div class="en-page-title">' + _escHtml(currentGrade) + '　' + meta.label + '</div>' +
    '<div class="en-btn-grid">';
  keys.forEach(function(u) {
    var items    = units[u] || [];
    var unitName = (items[0] && items[0].unitName) || u;
    html += '<button class="en-select-btn" onclick="selectUnit(\'' + _escAttr(u) + '\',\'' + _escAttr(unitName) + '\')">' +
      _escHtml(u) +
      '<span class="en-btn-sub">' + _escHtml(unitName) + '</span>' +
      '<span class="en-btn-count">' + items.length + ' 張圖</span>' +
      '</button>';
  });
  html += '</div>';
  inner.innerHTML = html;
}

function selectUnit(unit, unitName) {
  currentUnit     = unit;
  currentUnitName = unitName;

  var items = (
    _allData[currentGrade] &&
    _allData[currentGrade][currentSection] &&
    _allData[currentGrade][currentSection][unit]
  ) || [];
  englishImages = items.slice();

  var labelEl = document.getElementById('mode-unit-label');
  if (labelEl) {
    var meta = _SECTION_META[currentSection] || { label: currentSection };
    labelEl.textContent = currentGrade + '　' + meta.label + '　' +
      unit + '：' + unitName + '　共 ' + englishImages.length + ' 張';
  }

  _renderModeCards();
  showPage('mode');
}

function _renderModeCards() {
  var cards = document.querySelector('.en-mode-cards');
  if (!cards) return;

  var enough = englishImages.length >= 2;
  var dis    = enough ? '' : ' disabled';

  var browse =
    '<button class="en-mode-card" onclick="startBrowse()">' +
      '<div class="en-mode-icon">🃏</div>' +
      '<div class="en-mode-name">圖卡瀏覽</div>' +
      '<div class="en-mode-desc">逐張翻閱圖片與發音</div>' +
    '</button>';

  var html = browse;

  if (currentSection === 'phonics') {
    html +=
      '<button class="en-mode-card"' + dis + ' onclick="startQuiz(\'phonics\')">' +
        '<div class="en-mode-icon">🎯</div>' +
        '<div class="en-mode-name">看圖猜音</div>' +
        '<div class="en-mode-desc">看圖片選出正確的開頭音</div>' +
      '</button>';

  } else if (currentSection === 'words') {
    html +=
      '<button class="en-mode-card"' + dis + ' onclick="startQuiz(\'words\')">' +
        '<div class="en-mode-icon">🔤</div>' +
        '<div class="en-mode-name">看圖選字</div>' +
        '<div class="en-mode-desc">看圖片選出正確的英文單字</div>' +
      '</button>';

  } else if (currentSection === 'expressions') {
    /* 聽音選圖：只要有 1 張就能搭配跨 unit 干擾項 */
    var dis1 = englishImages.length >= 1 ? '' : ' disabled';
    html +=
      '<button class="en-mode-card"' + dis1 + ' onclick="startQuiz(\'expr-listen\')">' +
        '<div class="en-mode-icon">👂</div>' +
        '<div class="en-mode-name">聽音選圖</div>' +
        '<div class="en-mode-desc">聽英語句子，選出對應的圖片</div>' +
      '</button>' +
      '<button class="en-mode-card"' + dis + ' onclick="startQuiz(\'expr-read\')">' +
        '<div class="en-mode-icon">📋</div>' +
        '<div class="en-mode-name">看圖選句</div>' +
        '<div class="en-mode-desc">看圖片選出正確的英語句子</div>' +
      '</button>';
  }

  cards.innerHTML = html;
}
