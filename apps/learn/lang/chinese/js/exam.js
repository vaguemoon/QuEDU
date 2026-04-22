/**
 * exam.js — 今日測驗（多輪制）
 * 負責：startFullExam()、showExamQuestion()、playExamVoice()、skipExamChar()、
 *        recordAndNext()、showRoundSummary()、doStartNextRound()、showExamFinalResult()
 * 依賴：state.js、nav.js、voice.js（speakChar）、shared.js（sfx 系列、flashBox）
 */
'use strict';

// ── 結算卡片樣式（動態注入，避免修改 HTML/CSS 檔）──
injectStyle('exam-grid-style', [
  '.exam-compact-grid{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;}',
  '.exam-compact-card{display:flex;flex-direction:column;align-items:center;justify-content:center;',
    'width:72px;height:82px;border-radius:12px;border:1px solid #ddd;background:#fff;gap:3px;flex-shrink:0;}',
  '.exam-compact-card.pass{border-color:#3B6D11;background:#EAF3DE;}',
  '.exam-compact-card.ok  {border-color:#185FA5;background:#E6F1FB;}',
  '.exam-compact-card.fail{border-color:#A32D2D;background:#FCEBEB;}',
  '.exam-compact-card.skip{border-color:#888780;background:#F1EFE8;}',
  '.exam-compact-glyph{font-size:30px;line-height:1;}',
  '.exam-compact-card.pass .exam-compact-glyph{color:#27500A;}',
  '.exam-compact-card.ok   .exam-compact-glyph{color:#0C447C;}',
  '.exam-compact-card.fail .exam-compact-glyph{color:#791F1F;}',
  '.exam-compact-card.skip .exam-compact-glyph{color:#444441;}',
  '.exam-compact-icon{font-size:13px;line-height:1;}',
  '.exam-compact-label{font-size:11px;font-weight:500;}',
  '.exam-compact-card.pass .exam-compact-label{color:#3B6D11;}',
  '.exam-compact-card.ok   .exam-compact-label{color:#185FA5;}',
  '.exam-compact-card.fail .exam-compact-label{color:#A32D2D;}',
  '.exam-compact-card.skip .exam-compact-label{color:#5F5E5A;}'
]);

var EXAM_FAIL_MISTAKES = 99;  // 超過通過門檻，確保結果為不通過（用於跳過或強制失敗）

// ── 測驗狀態 ──
var examQueue         = [];   // 本輪待測字陣列
var examQIdx          = 0;    // 目前題目索引
var examResults       = {};   // { '字': { round, mistakes, passed, skipped } }
var examRound         = 1;    // 目前輪次
var examMaxRounds     = Infinity; // 不限輪數，考到全部通過為止
var examQWriter       = null; // HanziWriter 實例
var examQMistakes     = 0;    // 本題累計錯誤筆畫
var examQStrokes      = 0;    // 本題累計正確筆畫
var examQSz           = 340;  // 格子像素尺寸
var examFailed        = [];   // 本輪答錯的字
var examQStrokeMistakes = 0;  // 連續錯誤筆畫計數（用於觸發提示輪廓）
var examQHintMode     = false; // 是否已顯示提示輪廓
var examQCharMode = false; // 是否已顯示完整字形（答錯過多次後）

/**
 * 切換考試頁的三個子面板（question / round / result），另外兩個隱藏
 * @param {string} active  'question' | 'round' | 'result'
 */
function switchExamPanel(active) {
  var qp  = document.getElementById('exam-question-panel');
  var rp  = document.getElementById('exam-result-panel');
  var rop = document.getElementById('exam-round-panel');
  if (qp)  qp.style.display  = active === 'question' ? '' : 'none';
  if (rop) rop.style.display = active === 'round'    ? '' : 'none';
  if (rp)  rp.style.display  = active === 'result'   ? '' : 'none';
}

/**
 * 開始今日測驗：打亂字序、進入 exam 頁、顯示第一題
 */
function startFullExam(customChars) {
  sfxSwipe();
  var src = (customChars && customChars.length) ? customChars : chars;
  if (!src.length) return;
  examQueue   = shuffle(src);
  examQIdx    = 0; examResults = {}; examRound = 1; examFailed = [];
  showPage('exam');
  setTimeout(function() {
    switchExamPanel('question');
    updateExamHeader();
    showExamQuestion();
  }, 80);
}

function updateExamHeader() {
  var el = document.getElementById('exam-q-num');
  if (!el) return;
  el.textContent = examRound > 1
    ? '第 ' + examRound + ' 輪 | 第 ' + (examQIdx + 1) + ' 題 ／ 共 ' + examQueue.length + ' 題'
    : '第 ' + (examQIdx + 1) + ' 題 ／ 共 ' + examQueue.length + ' 題';
}

/**
 * 顯示目前題目：重置計數、建立 HanziWriter、延遲播放語音
 */
function showExamQuestion() {
  updateExamHeader();
  var pct = (examQIdx / examQueue.length) * 100;
  var pf  = document.getElementById('exam-progress-fill');
  if (pf) pf.style.width = pct + '%';

  examQMistakes = 0; examQStrokes = 0; examQStrokeMistakes = 0; examQHintMode = false; examQCharMode = false;

  var char = examQueue[examQIdx];
  var qt   = document.getElementById('exam-quiz-target');
  if (!qt) return;
  qt.innerHTML = ''; qt.classList.remove('flash-green', 'flash-red');

  requestAnimationFrame(function() {
    var sz = qt.getBoundingClientRect().width;
    if (!sz || sz < 10) {
      var cssGrid = getComputedStyle(document.documentElement).getPropertyValue('--grid');
      sz = parseFloat(cssGrid) || 300;
    }
    examQSz     = sz;
    examQWriter = HanziWriter.create('exam-quiz-target', char,
      makeWriterOpts(examQSz, {
        outlineColor: 'rgba(0,0,0,0)', highlightColor: 'rgba(255,213,79,1)', showOutline: false,
        onLoadCharDataSuccess: function(){ startExamQQuiz(char); }
      })
    );
    setTimeout(function(){ playExamVoice(); }, 600);
  });
}

/**
 * 播放題目語音，並讓按鈕短暫顯示「播放中」狀態
 */
function playExamVoice() {
  var char = examQueue[examQIdx];
  if (!char) return;
  sfxTap();
  var btn = document.getElementById('btn-exam-voice');
  if (btn) btn.classList.add('playing');
  speakChar(char);
  setTimeout(function() {
    var b = document.getElementById('btn-exam-voice');
    if (b) b.classList.remove('playing');
  }, 1500);
}

function startExamQQuiz(char) {
  if (!examQWriter) return;
  examQWriter.quiz({
    onMistake: function() {
      examQMistakes++; examQStrokeMistakes++;
      flashBox('exam-quiz-target', 'red'); sfxWrong();
      // 連錯 3 筆自動顯示輪廓提示
      if (examQStrokeMistakes >= 3 && !examQHintMode) {
        examQHintMode = true;
        if (examQWriter) examQWriter.showOutline();
      }
      // 總錯誤達 6 筆，重啟 quiz 並顯示輪廓讓學生描寫
      if (examQMistakes >= 6 && !examQCharMode) {
        examQCharMode = true;
        showToast('💡 看著輪廓把字描完吧！');
        try { examQWriter.cancelQuiz(); } catch(e) {}

        var target = document.getElementById('exam-quiz-target');
        if (target) {
          while (target.firstChild) target.removeChild(target.firstChild);
        }

        examQWriter = HanziWriter.create('exam-quiz-target', char,
          makeWriterOpts(examQSz, {
            padding: Math.round(examQSz * 0.08),
            showCharacter: true, leniency: 1.5,
            onLoadCharDataSuccess: function() {
              examQWriter.quiz({
                showHintAfterMisses: 1,
                markStrokeCorrectAfterMisses: 3,
                leniency: 1.5,
                onMistake: function() { sfxWrong(); },
                onCorrectStroke: function() {
                  sfxCorrect();
                  flashBox('exam-quiz-target', 'green');
                },
                onComplete: function() {
                  recordAndNext(char, EXAM_FAIL_MISTAKES, false);
                }
              });
            }
          })
        );
      }
    },
    onCorrectStroke: function() {
      examQStrokeMistakes = 0;
      flashBox('exam-quiz-target', 'green'); sfxCorrect();
    },
    onComplete: function(){ recordAndNext(char, examQMistakes, false); }
  });
}

/**
 * 跳過目前題目（視為答錯，mistakes 設為 99）
 */
function skipExamChar() {
  sfxTap();
  var char = examQueue[examQIdx];
  if (examQWriter) { try { examQWriter.cancelQuiz(); } catch(e){} examQWriter = null; }
  recordAndNext(char, EXAM_FAIL_MISTAKES, true);
}

/**
 * 記錄本題結果，決定下一步（下一題 / 輪次結算 / 最終結果）
 * @param {string}  char     目標字
 * @param {number}  mistakes 錯誤次數
 * @param {boolean} skipped  是否跳過
 */
function recordAndNext(char, mistakes, skipped) {
  examResults[char] = {
    round: examRound, mistakes: mistakes,
    passed: !skipped && mistakes <= 3, skipped: skipped
  };

  if (skipped || mistakes > 3) {
    examFailed.push(char);
  } else {
    upgradeCharStatus(char, mistakes);
    sfxCelebrate();
    if (typeof onExamCharPassed === 'function') onExamCharPassed(char);
  }

  saveProgress();
  examQIdx++;

  if (examQIdx >= examQueue.length) {
    if (examFailed.length > 0 && examRound < examMaxRounds) showRoundSummary();
    else showExamFinalResult();
  } else {
    setTimeout(showExamQuestion, 400);
  }
}

/**
 * 顯示輪次結算頁（列出答對 / 答錯的字）
 */
function showRoundSummary() {
  switchExamPanel('round');

  var passCount  = examQueue.length - examFailed.length;
  var passChars  = examQueue.filter(function(c){ return !examFailed.includes(c); });

  var ri = document.getElementById('round-icon');
  var rt = document.getElementById('round-title');
  var rs = document.getElementById('round-sub');
  if (ri) ri.textContent = (passCount === examQueue.length) ? '🎉' : '📊';
  if (rt) rt.textContent = '第 ' + examRound + ' 輪結算';
  if (rs) rs.textContent = '答對 ' + passCount + ' 字，還有 ' + examFailed.length + ' 字需要再練';

  var pg = document.getElementById('round-pass-grid');
  var fg = document.getElementById('round-fail-grid');
  var ps = document.getElementById('round-pass-section');
  var fs = document.getElementById('round-fail-section');

  if (pg) pg.innerHTML = passChars.map(function(c) {
    return '<div class="exam-compact-card pass">'
      + '<div class="exam-compact-glyph">' + c + '</div>'
      + '<div class="exam-compact-icon">⭕</div>'
      + '<div class="exam-compact-label">通過</div>'
      + '</div>';
  }).join('');
  if (pg) pg.className = 'exam-compact-grid';

  if (fg) fg.innerHTML = examFailed.map(function(c) {
    var r = examResults[c];
    var lbl = r && r.skipped ? '跳過' : '不通過';
    return '<div class="exam-compact-card fail">'
      + '<div class="exam-compact-glyph">' + c + '</div>'
      + '<div class="exam-compact-icon">✖</div>'
      + '<div class="exam-compact-label">' + lbl + '</div>'
      + '</div>';
  }).join('');
  if (fg) fg.className = 'exam-compact-grid';

  if (ps) ps.style.display = passChars.length  ? '' : 'none';
  if (fs) fs.style.display = examFailed.length ? '' : 'none';

  var bl = document.getElementById('btn-ctrl-next-round-label');
  if (bl) bl.textContent = '開始第 ' + (examRound + 1) + ' 輪';
}

/**
 * 開始下一輪（只考上輪答錯的字）
 */
function doStartNextRound() {
  sfxTap();
  examRound++;
  examQueue  = shuffle(examFailed);
  examQIdx   = 0; examFailed = [];
  switchExamPanel('question');
  updateExamHeader();
  showExamQuestion();
}

/**
 * 顯示最終測驗結果（所有輪次彙總）
 */
function showExamFinalResult() {
  sfxGrandCelebrate();
  switchExamPanel('result');

  var allChars    = Object.keys(examResults);
  var totalPassed = allChars.filter(function(c){ return examResults[c].passed; }).length;
  var pct         = Math.round(totalPassed / allChars.length * 100);

  var ei = document.getElementById('exam-score-icon');
  var et = document.getElementById('exam-score-title');
  var es = document.getElementById('exam-score-sub');
  if (ei) ei.textContent = pct === 100 ? '🏆' : pct >= 80 ? '🌟' : pct >= 60 ? '😊' : '💪';
  if (et) et.textContent = pct === 100 ? '全對！太厲害了！' : pct >= 80 ? '答得很好！' : '繼續加油！';
  if (es) es.textContent = '共 ' + allChars.length + ' 字，通過 ' + totalPassed + ' 字（' + pct + '%）';

  var grid = document.getElementById('exam-score-grid');
  if (grid) {
    grid.className = 'exam-compact-grid';
    grid.innerHTML = allChars.map(function(c) {
      var r      = examResults[c];
      var cls    = r.skipped ? 'skip' : r.passed ? 'pass' : 'fail';
      var icon   = r.skipped ? '—'    : r.passed ? '⭕'   : '✖';
      var lblTxt = r.skipped ? '跳過' : r.passed ? '通過' : '不通過';
      return '<div class="exam-compact-card ' + cls + '">'
        + '<div class="exam-compact-glyph">' + c + '</div>'
        + '<div class="exam-compact-icon">' + icon + '</div>'
        + '<div class="exam-compact-label">' + lblTxt + '</div>'
        + '</div>';
    }).join('');
  }

  var pf = document.getElementById('exam-progress-fill');
  if (pf) pf.style.width = '100%';
  updateProgressBar();
  saveActivity();
}

/**
 * 離開測驗並返回生字列表（中途離開時仍儲存已答題目的記錄）
 */
function exitExam() {
  if (Object.keys(examResults).length > 0) saveActivity();
  showPage('menu');
}

/**
 * 將本次測驗結果寫入 Firestore activities 子集合
 */
function saveActivity() {
  if (!db || !currentStudent) return;
  var allChars = Object.keys(examResults);
  var passed   = allChars.filter(function(c){ return examResults[c].passed; });
  var failed   = allChars.filter(function(c){ return !examResults[c].passed && !examResults[c].skipped; });
  var skipped  = allChars.filter(function(c){ return examResults[c].skipped; });
  db.collection('students').doc(currentStudent.id)
    .collection('activities').add({
      time:    new Date().toISOString(),
      lesson:  currentLessonLabel || '自由練習',
      passed:  passed,
      failed:  failed,
      skipped: skipped
    }).catch(function(e){ console.warn('saveActivity error:', e); });
}
