/**
 * practice.js — 筆順練習模式
 * 負責：switchToPractice()、switchPracticeTab()、initQuiz()、
 *        startQuiz()、restartQuiz()、playRef()、loadCharInfo()
 *        以及單字測驗（switchToSingleExam、initExam、startExamQuiz、showSingleExamResult）
 * 依賴：state.js、nav.js、menu.js（updateProgressBar）、shared.js（sfx 系列）
 */
'use strict';

// ── 單字測驗計數器 ──
var examMistakes = 0;
var examStrokes  = 0;

// ── 工具 ──

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

// ── 工具函式 ──

/**
 * 從萌典 API 查詢注音／部首／筆畫，填入 #char-info-bar
 * 結果快取於 charInfoCache，避免重複請求
 * @param {string} char 目標漢字
 */
function loadCharInfo(char) {
  var elZ = document.getElementById('info-zhuyin');
  var elR = document.getElementById('info-radical');
  var elS = document.getElementById('info-strokes');
  var elW = document.getElementById('info-words');
  var elD = document.getElementById('info-def');
  if (!elZ) return;

  elZ.textContent = '⋯'; elR.textContent = '⋯'; elS.textContent = '⋯';
  if (elW) elW.innerHTML = '<span style="color:var(--muted);font-size:.85rem">查詢中…</span>';
  if (elD) elD.textContent = '查詢中…';

  if (charInfoCache[char]) { applyCharInfo(charInfoCache[char]); return; }

  // 不使用 encodeURIComponent，直接傳漢字，萌典 API 相容性較佳
  fetch('https://www.moedict.tw/a/' + char + '.json')
    .then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function(data) {
      var zhuyin  = (data.heteronyms && data.heteronyms[0] && data.heteronyms[0].bopomofo) || '－';
      var radical = data.radical || '－';
      var strokes = data.stroke_count != null ? String(data.stroke_count) : '－';

      // 收集造詞：從各定義的 example 欄位，將 ～ 替換為字本身，最多 3 個
      var words = [];
      if (data.heteronyms) {
        data.heteronyms.forEach(function(h) {
          if (!h.definitions) return;
          h.definitions.forEach(function(d) {
            if (!d.example) return;
            d.example.forEach(function(ex) {
              if (words.length >= 3) return;
              var w = ex.replace(/～/g, char).trim();
              if (w.length >= 2 && words.indexOf(w) === -1) words.push(w);
            });
          });
        });
      }

      // 字義：取第一個定義，移除括號內的補充說明，保持簡短
      var def = '－';
      if (data.heteronyms && data.heteronyms[0] &&
          data.heteronyms[0].definitions && data.heteronyms[0].definitions[0]) {
        def = data.heteronyms[0].definitions[0].def || '－';
        def = def.replace(/\{.*?\}/g, '').replace(/\[.*?\]/g, '').trim();
      }

      var info = { zhuyin: zhuyin, radical: radical, strokes: strokes, words: words, def: def };
      charInfoCache[char] = info;
      applyCharInfo(info);
    })
    .catch(function(e) { console.warn('loadCharInfo:', e); showCharInfoError(); });
}

function applyCharInfo(info) {
  var elZ = document.getElementById('info-zhuyin');
  var elR = document.getElementById('info-radical');
  var elS = document.getElementById('info-strokes');
  var elW = document.getElementById('info-words');
  var elD = document.getElementById('info-def');
  if (elZ) elZ.textContent = info.zhuyin;
  if (elR) elR.textContent = info.radical;
  if (elS) elS.textContent = info.strokes;
  if (elW) {
    elW.innerHTML = '';
    var list = info.words || [];
    if (list.length === 0) {
      elW.textContent = '－';
    } else {
      list.forEach(function(w) {
        var chip = document.createElement('span');
        chip.className = 'char-word-chip';
        chip.textContent = w;
        chip.onclick = function() { speakChar(w); };
        elW.appendChild(chip);
      });
    }
  }
  if (elD) elD.textContent = info.def || '－';
}

function showCharInfoError() {
  var elZ = document.getElementById('info-zhuyin');
  var elR = document.getElementById('info-radical');
  var elS = document.getElementById('info-strokes');
  var elW = document.getElementById('info-words');
  var elD = document.getElementById('info-def');
  if (elZ) elZ.textContent = '－';
  if (elR) elR.textContent = '－';
  if (elS) elS.textContent = '－';
  if (elW) elW.textContent = '－';
  if (elD) elD.textContent = '無法取得資料';
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
    onLoadCharDataSuccess: function(){ setTimeout(function(){ refWriter && refWriter.animateCharacter(); }, 400); },
    onLoadCharDataError:   function(){ if (rt) rt.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#aaa;font-size:.9rem">找不到筆順資料</div>'; }
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
    if (rc) rc.style.display = '';    if (qc) qc.style.display = 'none';
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
        quizWriter = HanziWriter.create('quiz-target', char, {
          width: sz, height: sz, padding: Math.round(sz * 0.07),
          strokeColor: '#2d6fa8', outlineColor: '#c8dff5',
          drawingColor: '#2d6fa8', drawingWidth: Math.max(4, Math.round(sz * 0.013)),
          highlightColor: '#ffd54f', showCharacter: false, showOutline: true, leniency: 1.2,
          onLoadCharDataSuccess: function(){ startQuiz(); }
        });
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
  if (bb) {
    bb.style.display = '';
    bb.innerHTML = '<button class="btn-big" id="btn-mode-switch" style="background:#c8d8e8;color:#8da4b8;cursor:not-allowed" disabled>'
      + '<span class="btn-big-icon">📝</span><span>完成練習後開始默寫</span></button>';
  }

  switchPracticeTab('ref');

  var char = chars[currentIdx];
  loadCharInfo(char);
  var rt   = document.getElementById('ref-target');
  if (rt) {
    rt.innerHTML = '';
    requestAnimationFrame(function() {
      var sz = rt.getBoundingClientRect().width || getGridPx();
      currentPracticeSz = sz;
      createRefWriter(char, sz);
    });
  }
  quizWriter = null; // 等切到 quiz tab 時再建立
}


function initQuiz(char) {
  var qt = document.getElementById('quiz-target');
  if (!qt) return;
  qt.innerHTML = ''; qt.classList.remove('flash-green', 'flash-red');
  var sz = getGridPx();
  quizWriter = HanziWriter.create('quiz-target', char, {
    width: sz, height: sz, padding: Math.round(sz * 0.07),
    strokeColor: '#2d6fa8', outlineColor: '#c8dff5',
    drawingColor: '#2d6fa8', drawingWidth: Math.max(4, Math.round(sz * 0.013)),
    highlightColor: '#ffd54f', showCharacter: false, showOutline: true, leniency: 1.2,
    onLoadCharDataSuccess: function(){ startQuiz(); }
  });
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

      // 在 sidebar 插入「開始默寫測驗」按鈕（避免重複插入）
      if (!document.getElementById('btn-inline-dict')) {
        var sidebar = document.getElementById('practice-sidebar');
        if (sidebar) {
          var dictBtn = document.createElement('button');
          dictBtn.id        = 'btn-inline-dict';
          dictBtn.className = 'btn-big btn-big-danger';
          dictBtn.innerHTML = '<span class="btn-big-icon">📝</span><span>開始默寫測驗</span>';
          dictBtn.onclick   = function(){ switchToDict(); };
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
  examWriter = HanziWriter.create('quiz-target', char, {
    width: sz, height: sz, padding: Math.round(sz * 0.07),
    strokeColor: '#2d6fa8', outlineColor: 'rgba(0,0,0,0)',
    drawingColor: '#2d6fa8', drawingWidth: Math.max(4, Math.round(sz * 0.013)),
    highlightColor: 'rgba(0,0,0,0)', showCharacter: false, showOutline: false, leniency: 1.2,
    onLoadCharDataSuccess: function(){ startExamQuiz(char); }
  });
}

function startExamQuiz(char) {
  if (!examWriter) return;
  switchPracticeTab('quiz');
  examWriter.quiz({
    onMistake:       function(){ examMistakes++; flashBox('quiz-target', 'red');   sfxWrong();   },
    onCorrectStroke: function(){ examStrokes++;  flashBox('quiz-target', 'green'); sfxCorrect(); },
    onComplete:      function(){ showSingleExamResult(char, examMistakes); }
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
