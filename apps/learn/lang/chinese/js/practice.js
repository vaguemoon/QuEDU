/**
 * practice.js — 筆順練習模式
 * 負責：switchToPractice()、switchPracticeTab()、initQuiz()、
 *        startQuiz()、restartQuiz()、playRef()、
 *        以及單字測驗（switchToSingleExam、initExam、startExamQuiz、showSingleExamResult）
 * 依賴：state.js（makeWriterOpts）、nav.js、menu.js（updateProgressBar）、
 *        shared.js（sfx 系列）、char-info.js（loadCharInfo）
 */
'use strict';

// ── 單字測驗計數器 ──
var examMistakes = 0;
var examStrokes  = 0;

var quizCompleted = false;

/**
 * 取得九宮格的實際像素尺寸
 */
function getGridPx() {
  var el = document.querySelector('.nine-grid')
        || document.querySelector('.quiz-box')
        || document.querySelector('.dict-canvas-wrap');
  if (el) return el.getBoundingClientRect().width || 340;
  return 340;
}

/**
 * 建立範例筆順 HanziWriter（ref-target），載入後自動播放動畫
 * @param {string} char  目標漢字
 * @param {number} sz    畫布像素尺寸
 */
function createRefWriter(char, sz) {
  var rt = document.getElementById('ref-target');
  if (!rt) return;
  refWriter = HanziWriter.create('ref-target', char, {
    width: sz, height: sz, padding: Math.round(sz * 0.07),
    strokeColor: '#ff8c42', strokeAnimationSpeed: .7, delayBetweenStrokes: 500,
    showCharacter: false, showOutline: true, outlineColor: '#c8dff5',
    onLoadCharDataSuccess: function() { setTimeout(function() { refWriter && refWriter.animateCharacter(); }, 400); },
    onLoadCharDataError:   function() {
      if (rt) rt.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#aaa;font-size:.9rem">找不到筆順資料</div>';
    }
  });
}

// ── Tab 切換（範例筆順 / 練習格） ──

function switchPracticeTab(tab) {
  var rt = document.getElementById('ref-target');
  var qt = document.getElementById('quiz-target');
  var rc = document.getElementById('ref-controls');
  var qc = document.getElementById('quiz-controls');
  var tr = document.getElementById('tab-ref');
  var tq = document.getElementById('tab-quiz');
  if (!rt) return;

  if (tab === 'ref') {
    rt.classList.remove('hidden-panel'); qt.classList.add('hidden-panel');
    if (rc) rc.style.display = '';      if (qc) qc.style.display = 'none';
    if (tr) tr.classList.add('active'); if (tq) tq.classList.remove('active');
  } else {
    rt.classList.add('hidden-panel'); qt.classList.remove('hidden-panel');
    if (rc) rc.style.display = 'none'; if (qc) qc.style.display = 'flex';
    if (tr) tr.classList.remove('active'); if (tq) tq.classList.add('active');

    // quiz-target 完全可見後才建立 quizWriter
    if (!quizWriter && currentMode === 'practice' && !quizCompleted) {
      requestAnimationFrame(function() {
        var char = chars[currentIdx];
        if (!char || !qt) return;
        qt.innerHTML = ''; qt.classList.remove('flash-green', 'flash-red');
        var sz = qt.getBoundingClientRect().width || currentPracticeSz || getGridPx();
        quizWriter = HanziWriter.create('quiz-target', char,
          makeWriterOpts(sz, { onLoadCharDataSuccess: function() { startQuiz(); } })
        );
      });
    }
  }
}

// ── 筆順練習主流程 ──

/**
 * 進入練習模式：顯示 panel-practice，建立範例筆順動畫
 */
function switchToPractice() {
  currentMode = 'practice';
  quizCompleted = false;
  var pp = document.getElementById('panel-practice');
  var pd = document.getElementById('panel-dict');
  if (pp) pp.style.display = ''; if (pd) pd.style.display = 'none';

  var inlineBtn = document.getElementById('btn-inline-dict');
  if (inlineBtn) inlineBtn.remove();

  document.getElementById('mode-icon').textContent  = '✏️';
  document.getElementById('mode-title').textContent = '筆順練習';
  document.getElementById('mode-sub').textContent   = '看左邊筆順，在右邊格子照著寫';

  var fbar = document.getElementById('dict-float-bar');
  if (fbar) fbar.remove();

  var bb = document.getElementById('bottom-bar');
  if (bb) bb.style.display = 'none';

  switchPracticeTab('ref');

  var char = chars[currentIdx];
  loadCharInfo(char);
  var rt = document.getElementById('ref-target');
  if (rt) {
    rt.innerHTML = '';
    requestAnimationFrame(function() {
      var sz = rt.getBoundingClientRect().width || getGridPx();
      currentPracticeSz = sz;
      createRefWriter(char, sz);
    });
  }
  quizWriter = null;
}

function initQuiz(char) {
  var qt = document.getElementById('quiz-target');
  if (!qt) return;
  qt.innerHTML = ''; qt.classList.remove('flash-green', 'flash-red');
  var sz = getGridPx();
  quizWriter = HanziWriter.create('quiz-target', char,
    makeWriterOpts(sz, { onLoadCharDataSuccess: function() { startQuiz(); } })
  );
}

function startQuiz() {
  quizCompleted = false;
  quizWriter.quiz({
    onMistake:       function() { flashBox('quiz-target', 'red');   sfxWrong();   },
    onCorrectStroke: function() { flashBox('quiz-target', 'green'); sfxCorrect(); },
    onComplete: function(data) {
      if (quizCompleted) return;
      quizCompleted = true;

      sfxCelebrate();

      if (!document.getElementById('btn-inline-dict')) {
        var sidebar = document.getElementById('practice-sidebar');
        if (sidebar) {
          var dictBtn = document.createElement('button');
          dictBtn.id        = 'btn-inline-dict';
          dictBtn.className = 'btn-big btn-big-danger';
          dictBtn.innerHTML = '<span class="btn-big-icon">📝</span><span>開始默寫測驗</span>';
          dictBtn.onclick   = function() { switchToDict(); };
          sidebar.appendChild(dictBtn);
        }
      }

      var bb = document.getElementById('bottom-bar');
      if (bb) bb.style.display = 'none';

      saveProgress(); updateProgressBar();
    }
  });
}

function restartQuiz() {
  sfxTap();
  quizCompleted = false;
  var qt = document.getElementById('quiz-target');
  if (qt) { qt.innerHTML = ''; qt.classList.remove('flash-green', 'flash-red'); }
  var inlineBtn = document.getElementById('btn-inline-dict');
  if (inlineBtn) inlineBtn.remove();
  quizWriter = null;
  switchPracticeTab('quiz');
}

function playRef() {
  sfxTap();
  var char = chars[currentIdx];
  var el   = document.getElementById('ref-target');
  if (!el) return;
  el.innerHTML = '';
  createRefWriter(char, getGridPx());
}

// ── 單字測驗（從生字選單卡直接進入） ──

function switchToSingleExam() {
  currentMode = 'single-exam';
  var pp = document.getElementById('panel-practice');
  var pd = document.getElementById('panel-dict');
  if (pp) pp.style.display = ''; if (pd) pd.style.display = 'none';

  document.getElementById('mode-icon').textContent  = '📝';
  document.getElementById('mode-title').textContent = '單字測驗';
  document.getElementById('mode-sub').textContent   = '靠記憶寫出這個字';

  var bb = document.getElementById('bottom-bar');
  if (bb) bb.style.display = 'none';
  initExam(chars[currentIdx]);
}

function initExam(char) {
  var qt = document.getElementById('quiz-target');
  if (!qt) return;
  qt.innerHTML = ''; qt.classList.remove('flash-green', 'flash-red');
  examMistakes = 0; examStrokes = 0;
  var sz = getGridPx();
  examWriter = HanziWriter.create('quiz-target', char,
    makeWriterOpts(sz, {
      outlineColor: 'rgba(0,0,0,0)', highlightColor: 'rgba(0,0,0,0)', showOutline: false,
      onLoadCharDataSuccess: function() { startExamQuiz(char); }
    })
  );
}

function startExamQuiz(char) {
  if (!examWriter) return;
  switchPracticeTab('quiz');
  examWriter.quiz({
    onMistake:       function() { examMistakes++; flashBox('quiz-target', 'red');   sfxWrong();   },
    onCorrectStroke: function() { examStrokes++;  flashBox('quiz-target', 'green'); sfxCorrect(); },
    onComplete:      function() { showSingleExamResult(char, examMistakes); }
  });
}

function showSingleExamResult(char, mistakes) {
  sfxCelebrate();
  if (upgradeCharStatus(char, mistakes) === 'mastered') sfxGrandCelebrate();
  saveProgress(); updateProgressBar();

  var bb = document.getElementById('bottom-bar');
  if (bb) {
    bb.style.display = '';
    bb.innerHTML =
      '<button class="btn-big btn-big-primary" onclick="retryExam()"><span class="btn-big-icon">🔄</span><span>再練一次</span></button>' +
      '<button class="btn-big" style="background:#e8f4fd;color:var(--blue-dk)" onclick="nextChar()"><span class="btn-big-icon">→</span><span>下一字</span></button>';
  }
}

function retryExam() {
  sfxTap();
  var bb = document.getElementById('bottom-bar');
  if (bb) bb.style.display = 'none';
  initExam(chars[currentIdx]);
}

// ── 視窗大小改變時重建 HanziWriter ──

var _resizeTimer = null;
var _lastGridPx  = 0;

window.addEventListener('resize', function() {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(function() {
    var newSz = getGridPxFromCSS();
    if (!newSz || Math.abs(newSz - _lastGridPx) < 4) return;
    _lastGridPx = newSz;
    rebuildWriters();
  }, 200);
});

/**
 * 從 CSS --grid 變數取得實際像素值
 */
function getGridPxFromCSS() {
  var dummy = document.querySelector('.practice-grid-wrap') ||
              document.querySelector('.quiz-box') ||
              document.querySelector('.dict-canvas-wrap');
  if (!dummy) return 0;
  return Math.round(dummy.getBoundingClientRect().width) || 0;
}

/**
 * 依目前模式重建 HanziWriter
 */
function rebuildWriters() {
  var char = chars[currentIdx];
  if (!char) return;

  if (currentMode === 'practice') {
    var rt = document.getElementById('ref-target');
    var qt = document.getElementById('quiz-target');
    var isRefVisible = rt && !rt.classList.contains('hidden-panel');

    if (isRefVisible && rt) {
      rt.innerHTML = '';
      refWriter = null;
      requestAnimationFrame(function() {
        var sz = rt.getBoundingClientRect().width || getGridPxFromCSS();
        currentPracticeSz = sz;
        createRefWriter(char, sz);
      });
    } else if (qt && !quizCompleted) {
      qt.innerHTML = '';
      quizWriter = null;
      requestAnimationFrame(function() {
        var sz = qt.getBoundingClientRect().width || getGridPxFromCSS();
        quizWriter = HanziWriter.create('quiz-target', char,
          makeWriterOpts(sz, { onLoadCharDataSuccess: function() { startQuiz(); } })
        );
      });
    }
  } else if (currentMode === 'single-exam') {
    initExam(char);
  }
}
