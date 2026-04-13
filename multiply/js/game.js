/**
 * game.js — 遊戲邏輯（練習模式 + 測驗模式）
 * 負責：題目生成、選項渲染、答案判斷、計時器、多輪流程
 * 依賴：state.js（所有全域變數）、shared.js（sfxCorrect、sfxWrong、sfxTap、showToast）
 */
'use strict';

// ════════════════════════════════════════
//  選項生成
// ════════════════════════════════════════

function generateChoiceOptions(a, b) {
  var correct = a * b;
  var candidates = [];
  for (var da = -2; da <= 2; da++) {
    for (var db = -2; db <= 2; db++) {
      if (da === 0 && db === 0) continue;
      var na = a + da, nb = b + db;
      if (na >= 0 && na <= 10 && nb >= 0 && nb <= 10) {
        var v = na * nb;
        if (v !== correct && candidates.indexOf(v) === -1) candidates.push(v);
      }
    }
  }
  candidates = shuffle(candidates);
  var distractors = candidates.slice(0, 3);
  var extra = 0;
  while (distractors.length < 3 && extra <= 100) {
    if (extra !== correct && distractors.indexOf(extra) === -1) distractors.push(extra);
    extra++;
  }
  return shuffle([correct].concat(distractors.slice(0, 3)));
}

function generateReverseOptions(a, b) {
  var product = a * b;
  var candidates = [];
  for (var x = 0; x <= 10; x++) {
    for (var y = 0; y <= 10; y++) {
      if (x * y !== product) {
        candidates.push({ a: x, b: y, diff: Math.abs(x * y - product) });
      }
    }
  }
  candidates.sort(function(p, q) { return p.diff - q.diff; });
  var distractors = [];
  var usedProducts = [product];
  for (var i = 0; i < candidates.length && distractors.length < 3; i++) {
    var p = candidates[i].a * candidates[i].b;
    if (usedProducts.indexOf(p) === -1) { distractors.push(candidates[i]); usedProducts.push(p); }
  }
  for (var i = 0; i < candidates.length && distractors.length < 3; i++) {
    if (distractors.indexOf(candidates[i]) === -1) distractors.push(candidates[i]);
  }
  return shuffle([{ a: a, b: b }].concat(distractors.slice(0, 3)));
}

// ════════════════════════════════════════
//  選項渲染
// ════════════════════════════════════════

function renderChoiceOptions(containerId, q, isExam) {
  var opts    = generateChoiceOptions(q.a, q.b);
  var correct = q.a * q.b;
  var el      = document.getElementById(containerId);
  if (!el) return;
  var fn = isExam ? 'onExamChoiceAnswer' : 'onPracticeChoiceAnswer';
  el.innerHTML = opts.map(function(v) {
    return '<button class="option-btn" data-val="' + v + '" onclick="sfxTap();' + fn + '(' + v + ',' + correct + ',this)">' + v + '</button>';
  }).join('');
}

function renderReverseOptions(containerId, q, isExam) {
  var opts = generateReverseOptions(q.a, q.b);
  var el   = document.getElementById(containerId);
  if (!el) return;
  var fn = isExam ? 'onExamReverseAnswer' : 'onPracticeReverseAnswer';
  el.innerHTML = opts.map(function(opt) {
    return '<button class="option-btn option-pair-btn" data-a="' + opt.a + '" data-b="' + opt.b +
      '" onclick="sfxTap();' + fn + '(this)">' + opt.a + ' × ' + opt.b + '</button>';
  }).join('');
}

// ════════════════════════════════════════
//  填空輸入面板
// ════════════════════════════════════════

function fillAppend(d) {
  if (fillInputStr.length >= 3) return;
  sfxTap();
  fillInputStr += String(d);
  updateFillDisplay();
}

function fillBackspace() {
  sfxTap();
  fillInputStr = fillInputStr.slice(0, -1);
  updateFillDisplay();
}

function updateFillDisplay() {
  var el = document.getElementById('fill-display');
  if (el) el.textContent = fillInputStr || '＿';
}

function handleFillKeydown(e) {
  if (currentPage !== 'practice' && currentPage !== 'exam') return;
  if (e.key >= '0' && e.key <= '9') { fillAppend(e.key); return; }
  if (e.key === 'Backspace') { fillBackspace(); return; }
  if (e.key === 'Enter') {
    if (currentPage === 'practice') onPracticeFillSubmit();
    else if (currentPage === 'exam') onExamFillSubmit();
  }
}

// ════════════════════════════════════════
//  練習設定頁
// ════════════════════════════════════════

function initPracticeSelect() {
  renderFactorChips('a-chips', practiceSelectedA_temp);
  renderFactorChips('b-chips', practiceSelectedB_temp);
  updateToggleAllBtn('a-chips');
  updateToggleAllBtn('b-chips');
  setPracticeType(practiceType);
  updatePracticePairCount();
}

function renderFactorChips(containerId, selectedArr) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var html = '';
  for (var i = 0; i <= 10; i++) {
    var active = selectedArr.indexOf(i) !== -1;
    html += '<button class="factor-chip' + (active ? ' active' : '') +
      '" onclick="toggleFactor(\'' + containerId + '\',' + i + ')">' + i + '</button>';
  }
  el.innerHTML = html;
}

function toggleFactor(containerId, val) {
  sfxTap();
  var arr = containerId === 'a-chips' ? practiceSelectedA_temp : practiceSelectedB_temp;
  var idx = arr.indexOf(val);
  if (idx === -1) arr.push(val); else arr.splice(idx, 1);
  renderFactorChips(containerId, arr);
  updateToggleAllBtn(containerId);
  updatePracticePairCount();
}

function selectAllFactors(containerId, selectAll) {
  var arr = containerId === 'a-chips' ? practiceSelectedA_temp : practiceSelectedB_temp;
  arr.length = 0;
  if (selectAll) { for (var i = 0; i <= 10; i++) arr.push(i); }
  renderFactorChips(containerId, arr);
  updatePracticePairCount();
}

/** 切換全選/全不選（單一按鈕） */
function toggleSelectAll(containerId) {
  sfxTap();
  var arr = containerId === 'a-chips' ? practiceSelectedA_temp : practiceSelectedB_temp;
  var shouldSelectAll = arr.length < 11;
  selectAllFactors(containerId, shouldSelectAll);
  updateToggleAllBtn(containerId);
}

function updateToggleAllBtn(containerId) {
  var arr = containerId === 'a-chips' ? practiceSelectedA_temp : practiceSelectedB_temp;
  var btn = document.getElementById('toggle-' + containerId);
  if (!btn) return;
  var allSelected = arr.length === 11;
  btn.textContent = allSelected ? '全不選' : '全選';
  btn.classList.toggle('toggle-all-on', allSelected);
}

function setPracticeType(type) {
  practiceType = type;
  ['choice', 'fill', 'reverse'].forEach(function(t) {
    var btn = document.getElementById('ptype-' + t);
    if (btn) btn.classList.toggle('active', t === type);
  });
}

function updatePracticePairCount() {
  var el = document.getElementById('practice-pair-count');
  if (el) {
    var n = practiceSelectedA_temp.length * practiceSelectedB_temp.length;
    el.textContent = '已選 ' + n + ' 組題目';
    el.style.color = n === 0 ? 'var(--red)' : 'var(--muted)';
  }
}

// ════════════════════════════════════════
//  練習模式
// ════════════════════════════════════════

function startPractice() {
  if (practiceSelectedA_temp.length === 0 || practiceSelectedB_temp.length === 0) {
    showToast('請至少各選一個被乘數和乘數！');
    return;
  }
  practicePool = [];
  practiceSelectedA_temp.forEach(function(a) {
    practiceSelectedB_temp.forEach(function(b) { practicePool.push({ a: a, b: b }); });
  });
  practicePool    = shuffle(practicePool);
  practiceStreak  = 0;
  practiceCorrect = 0;
  practiceTotal   = 0;
  fillInputStr    = '';
  showPage('practice');
  loadPracticeQuestion();
}

function loadPracticeQuestion() {
  // 隱藏「下一題」按鈕
  var nextBtn = document.getElementById('practice-next-btn');
  if (nextBtn) nextBtn.classList.add('hidden');

  var idx = Math.floor(Math.random() * practicePool.length);
  practiceQ = practicePool[idx];
  renderPracticeQuestion();
}

function renderPracticeQuestion() {
  var q = practiceQ;
  updatePracticeStats();

  var qEl    = document.getElementById('practice-question');
  var optsEl = document.getElementById('practice-options');
  var fillPad = document.getElementById('practice-fill-pad');

  if (optsEl)  { optsEl.innerHTML = ''; optsEl.style.display = 'none'; }
  if (fillPad) fillPad.style.display = 'none';

  if (practiceType === 'reverse') {
    if (qEl) qEl.innerHTML =
      '<span class="q-blank">?</span> × <span class="q-blank">?</span> = <span class="q-product">' + (q.a * q.b) + '</span>';
    if (optsEl) { optsEl.style.display = ''; renderReverseOptions('practice-options', q, false); }
  } else if (practiceType === 'fill') {
    if (qEl) qEl.innerHTML =
      '<span class="q-num">' + q.a + '</span> × <span class="q-num">' + q.b + '</span> = <span class="q-blank" id="fill-display">＿</span>';
    fillInputStr = '';
    if (fillPad) fillPad.style.display = '';
  } else {
    if (qEl) qEl.innerHTML =
      '<span class="q-num">' + q.a + '</span> × <span class="q-num">' + q.b + '</span> = <span class="q-blank">?</span>';
    if (optsEl) { optsEl.style.display = ''; renderChoiceOptions('practice-options', q, false); }
  }
}

function updatePracticeStats() {
  var s = document.getElementById('practice-streak');
  var c = document.getElementById('practice-correct');
  var t = document.getElementById('practice-total');
  if (s) s.textContent = practiceStreak;
  if (c) c.textContent = practiceCorrect;
  if (t) t.textContent = practiceTotal;
}

/**
 * 答題結果處理
 * 答對 → 自動跳下一題（400ms）
 * 答錯 → 顯示正確答案，等待學生點「下一題」
 */
function onPracticeResult(correct) {
  practiceTotal++;
  totalAttempts++;
  var nextBtn = document.getElementById('practice-next-btn');

  if (correct) {
    practiceStreak++;
    practiceCorrect++;
    totalCorrect++;
    sfxCorrect();
    if (typeof checkAchievements === 'function') checkAchievements();
    saveProgress();
    updatePracticeStats();
    if (nextBtn) nextBtn.classList.add('hidden');
    setTimeout(loadPracticeQuestion, 400);
  } else {
    practiceStreak = 0;
    sfxWrong();
    updatePracticeStats();
    showPracticeAnswer();
    if (nextBtn) nextBtn.classList.remove('hidden');
  }
}

function showPracticeAnswer() {
  var q = practiceQ;
  var qEl = document.getElementById('practice-question');
  if (!qEl) return;
  if (practiceType === 'reverse') {
    qEl.innerHTML = '<span class="q-correct-pair">' + q.a + ' × ' + q.b + '</span>' +
      ' = <span class="q-product">' + (q.a * q.b) + '</span>';
  } else {
    qEl.innerHTML = '<span class="q-num">' + q.a + '</span> × <span class="q-num">' + q.b +
      '</span> = <span class="q-correct">' + (q.a * q.b) + '</span>';
  }
  document.querySelectorAll('#practice-options .option-btn, #practice-fill-pad button')
    .forEach(function(btn) { btn.disabled = true; });
}

function doNextPracticeQuestion() {
  sfxTap();
  loadPracticeQuestion();
}

function onPracticeChoiceAnswer(val, correct, btn) {
  document.querySelectorAll('#practice-options .option-btn').forEach(function(b) {
    b.disabled = true;
    if (parseInt(b.getAttribute('data-val')) === correct) b.classList.add('btn-correct');
  });
  if (btn) btn.classList.add(val === correct ? 'btn-correct' : 'btn-wrong');
  onPracticeResult(val === correct);
}

function onPracticeReverseAnswer(btn) {
  var a = parseInt(btn.getAttribute('data-a'));
  var b = parseInt(btn.getAttribute('data-b'));
  var isCorrect = (a * b === practiceQ.a * practiceQ.b);
  document.querySelectorAll('#practice-options .option-btn').forEach(function(b2) {
    b2.disabled = true;
    var ba = parseInt(b2.getAttribute('data-a')), bb = parseInt(b2.getAttribute('data-b'));
    if (ba * bb === practiceQ.a * practiceQ.b) b2.classList.add('btn-correct');
  });
  if (!isCorrect) btn.classList.add('btn-wrong');
  onPracticeResult(isCorrect);
}

function onPracticeFillSubmit() {
  if (!fillInputStr) return;
  var val    = parseInt(fillInputStr);
  var correct = practiceQ.a * practiceQ.b;
  var isCorrect = (val === correct);
  fillInputStr = '';
  updateFillDisplay();
  if (!isCorrect) {
    showPracticeAnswer();
    onPracticeResult(false);
  } else {
    onPracticeResult(true);
  }
}

// ════════════════════════════════════════
//  測驗設定頁
// ════════════════════════════════════════

function initExamSelect() {
  renderExamTableChips();
  updateToggleExamBtn();
  setExamType(examType);
  setExamTimer(examTimerSec);
}

function renderExamTableChips() {
  var el = document.getElementById('exam-table-chips');
  if (!el) return;
  var html = '';
  for (var i = 0; i <= 10; i++) {
    var active = examSelectedTables_temp.indexOf(i) !== -1;
    html += '<button class="factor-chip' + (active ? ' active' : '') +
      '" onclick="toggleExamTable(' + i + ')">' + i + '</button>';
  }
  el.innerHTML = html;
  updateExamQuestionCount();
}

function toggleExamTable(val) {
  sfxTap();
  var idx = examSelectedTables_temp.indexOf(val);
  if (idx === -1) examSelectedTables_temp.push(val);
  else examSelectedTables_temp.splice(idx, 1);
  renderExamTableChips();
  updateToggleExamBtn();
}

function selectAllExamTables(selectAll) {
  examSelectedTables_temp.length = 0;
  if (selectAll) { for (var i = 0; i <= 10; i++) examSelectedTables_temp.push(i); }
  renderExamTableChips();
}

function toggleSelectAllExamTables() {
  sfxTap();
  var shouldSelectAll = examSelectedTables_temp.length < 11;
  selectAllExamTables(shouldSelectAll);
  updateToggleExamBtn();
}

function updateToggleExamBtn() {
  var btn = document.getElementById('toggle-exam-tables');
  if (!btn) return;
  var allSelected = examSelectedTables_temp.length === 11;
  btn.textContent = allSelected ? '全不選' : '全選';
  btn.classList.toggle('toggle-all-on', allSelected);
}

function setExamType(type) {
  examType = type;
  ['fill', 'reverse'].forEach(function(t) {
    var btn = document.getElementById('etype-' + t);
    if (btn) btn.classList.toggle('active', t === type);
  });
}

function setExamTimer(sec) {
  examTimerSec = sec;
  [5, 8, 10].forEach(function(s) {
    var btn = document.getElementById('etimer-' + s);
    if (btn) btn.classList.toggle('active', s === sec);
  });
}

function updateExamQuestionCount() {
  var el = document.getElementById('exam-q-preview');
  if (el) {
    var n = examSelectedTables_temp.length * 11;
    el.textContent = '共 ' + n + ' 題';
    el.style.color = n === 0 ? 'var(--red)' : 'var(--muted)';
  }
}

// ════════════════════════════════════════
//  測驗模式
// ════════════════════════════════════════

function startExam() {
  if (examSelectedTables_temp.length === 0) { showToast('請至少選一個乘法表！'); return; }
  examSelectedTables = examSelectedTables_temp.slice();
  examAllPairs = [];
  examSelectedTables.forEach(function(t) {
    for (var b = 0; b <= 10; b++) examAllPairs.push({ a: t, b: b });
  });
  examRound        = 1;
  examMastered     = [];
  examPendingWrong = [];
  examPool         = shuffle(examAllPairs.slice());
  fillInputStr     = '';

  var gamePanel    = document.getElementById('exam-game-panel');
  var summaryPanel = document.getElementById('exam-summary-panel');
  if (gamePanel)    gamePanel.style.display    = '';
  if (summaryPanel) summaryPanel.style.display = 'none';

  showPage('exam');
  loadExamQuestion();
}

function loadExamQuestion() {
  var nextBtn = document.getElementById('exam-next-btn');
  if (nextBtn) nextBtn.classList.add('hidden');
  if (examPool.length === 0) { showRoundSummary(); return; }
  examQ = examPool[0];
  enableExamInput();
  renderExamQuestion();
  startExamCountdown();
}

function renderExamQuestion() {
  var q    = examQ;
  var done  = examMastered.length;
  var total = examAllPairs.length;
  var pct   = total > 0 ? Math.round(done / total * 100) : 0;

  var progFill = document.getElementById('exam-overall-fill');
  var progText = document.getElementById('exam-progress-text');
  var roundLbl = document.getElementById('exam-round-label');
  var qCount   = document.getElementById('exam-q-count');
  if (progFill) progFill.style.width = pct + '%';
  if (progText) progText.textContent = done + ' / ' + total;
  if (roundLbl) roundLbl.textContent = '第 ' + examRound + ' 輪';
  if (qCount)   qCount.textContent   = '本輪剩 ' + examPool.length + ' 題';

  var qEl     = document.getElementById('exam-question');
  var optsEl  = document.getElementById('exam-options');
  var fillPad = document.getElementById('exam-fill-pad');

  if (optsEl)  { optsEl.innerHTML = ''; optsEl.style.display = 'none'; }
  if (fillPad) fillPad.style.display = 'none';

  if (examType === 'reverse') {
    if (qEl) qEl.innerHTML =
      '<span class="q-blank">?</span> × <span class="q-blank">?</span> = <span class="q-product">' + (q.a * q.b) + '</span>';
    if (optsEl) { optsEl.style.display = ''; renderReverseOptions('exam-options', q, true); }
  } else {
    if (qEl) qEl.innerHTML =
      '<span class="q-num">' + q.a + '</span> × <span class="q-num">' + q.b + '</span> = <span class="q-blank" id="fill-display">＿</span>';
    fillInputStr = '';
    if (fillPad) fillPad.style.display = '';
  }
}

// ── 計時器 ──

function startExamCountdown() {
  clearExamCountdown();
  examTimeLeft = examTimerSec;
  renderTimerDisplay();
  examCountdownId = setInterval(function() {
    examTimeLeft--;
    renderTimerDisplay();
    if (examTimeLeft <= 0) { clearExamCountdown(); onExamTimeout(); }
  }, 1000);
}

function clearExamCountdown() {
  if (examCountdownId) { clearInterval(examCountdownId); examCountdownId = null; }
}

function renderTimerDisplay() {
  var numEl = document.getElementById('exam-timer-num');
  var barEl = document.getElementById('exam-timer-bar');
  if (numEl) numEl.textContent = Math.max(0, examTimeLeft);
  if (barEl) {
    var pct = Math.max(0, examTimeLeft / examTimerSec * 100);
    barEl.style.width = pct + '%';
    barEl.style.background = pct > 50 ? 'var(--blue)' : pct > 25 ? 'var(--orange)' : 'var(--red)';
  }
}

// ── 答題結果 ──

/**
 * 答對 → 自動跳下一題（350ms）
 * 答錯/超時 → 顯示正確答案，等待點「下一題」
 */
function onExamTimeout() {
  totalAttempts++;
  sfxWrong();
  showExamAnswer();
  disableExamInput();
  var nextBtn = document.getElementById('exam-next-btn');
  if (nextBtn) nextBtn.classList.remove('hidden');
}

function onExamCorrect() {
  clearExamCountdown();
  totalCorrect++;
  totalAttempts++;
  examMastered.push(pairKey(examQ.a, examQ.b));
  sfxCorrect();
  if (typeof checkAchievements === 'function') checkAchievements();
  saveProgress();
  examPool.shift();
  fillInputStr = '';
  var nextBtn = document.getElementById('exam-next-btn');
  if (nextBtn) nextBtn.classList.add('hidden');
  setTimeout(loadExamQuestion, 350);
}

function onExamWrong() {
  clearExamCountdown();
  totalAttempts++;
  sfxWrong();
  showExamAnswer();
  disableExamInput();
  var nextBtn = document.getElementById('exam-next-btn');
  if (nextBtn) nextBtn.classList.remove('hidden');
}

function doNextExamQuestion() {
  sfxTap();
  advanceExamQuestion();
}

function advanceExamQuestion() {
  examPendingWrong.push(examQ);
  examPool.shift();
  fillInputStr = '';
  loadExamQuestion();
}

function showExamAnswer() {
  var q   = examQ;
  var qEl = document.getElementById('exam-question');
  if (!qEl) return;
  if (examType === 'reverse') {
    qEl.innerHTML = '<span class="q-correct-pair">' + q.a + ' × ' + q.b + '</span>' +
      ' = <span class="q-product">' + (q.a * q.b) + '</span>';
  } else {
    qEl.innerHTML = '<span class="q-num">' + q.a + '</span> × <span class="q-num">' + q.b +
      '</span> = <span class="q-correct">' + (q.a * q.b) + '</span>';
  }
  document.querySelectorAll('#exam-options .option-btn').forEach(function(btn) {
    var a = parseInt(btn.getAttribute('data-a')), b = parseInt(btn.getAttribute('data-b'));
    if (!isNaN(a) && a * b === q.a * q.b) btn.classList.add('btn-correct');
  });
}

function enableExamInput() {
  document.querySelectorAll('#exam-options .option-btn, #exam-fill-pad button')
    .forEach(function(btn) { btn.disabled = false; btn.classList.remove('btn-correct','btn-wrong'); });
}

function disableExamInput() {
  document.querySelectorAll('#exam-options .option-btn, #exam-fill-pad button')
    .forEach(function(btn) { btn.disabled = true; });
}

function onExamChoiceAnswer(val, correct, btn) {
  document.querySelectorAll('#exam-options .option-btn').forEach(function(b) {
    b.disabled = true;
    if (parseInt(b.getAttribute('data-val')) === correct) b.classList.add('btn-correct');
  });
  if (btn) btn.classList.add(val === correct ? 'btn-correct' : 'btn-wrong');
  if (val === correct) onExamCorrect(); else onExamWrong();
}

function onExamReverseAnswer(btn) {
  var a = parseInt(btn.getAttribute('data-a'));
  var b = parseInt(btn.getAttribute('data-b'));
  var isCorrect = (a * b === examQ.a * examQ.b);
  document.querySelectorAll('#exam-options .option-btn').forEach(function(b2) {
    b2.disabled = true;
    var ba = parseInt(b2.getAttribute('data-a')), bb = parseInt(b2.getAttribute('data-b'));
    if (ba * bb === examQ.a * examQ.b) b2.classList.add('btn-correct');
  });
  if (!isCorrect) btn.classList.add('btn-wrong');
  if (isCorrect) onExamCorrect(); else onExamWrong();
}

function onExamFillSubmit() {
  if (!fillInputStr) return;
  var val    = parseInt(fillInputStr);
  var correct = examQ.a * examQ.b;
  if (val === correct) { onExamCorrect(); }
  else {
    fillInputStr = '';
    updateFillDisplay();
    onExamWrong();
  }
}

// ── 輪間結算 ──

function showRoundSummary() {
  clearExamCountdown();
  var retryCount    = examPendingWrong.length;

  // 全對 → 直接完成，不顯示結算畫面
  if (retryCount === 0) {
    onExamComplete();
    sfxGrandCelebrate();
    showExamFinalResult();
    return;
  }

  var gamePanel    = document.getElementById('exam-game-panel');
  var summaryPanel = document.getElementById('exam-summary-panel');
  if (gamePanel)    gamePanel.style.display    = 'none';
  if (summaryPanel) summaryPanel.style.display = '';

  var masteredCount = examMastered.length;

  var roundEl   = document.getElementById('exam-summary-round');
  var correctEl = document.getElementById('exam-summary-correct');
  var retryEl   = document.getElementById('exam-summary-retry');
  if (roundEl)   roundEl.textContent   = '第 ' + examRound + ' 輪結束';
  if (correctEl) correctEl.textContent = '✅ 累計答對 ' + masteredCount + ' 題';
  if (retryEl)   retryEl.textContent   = '💪 還需複習 ' + retryCount + ' 題';

  // 列出錯誤題目
  var wrongListEl = document.getElementById('exam-wrong-list');
  if (wrongListEl) {
    wrongListEl.innerHTML = examPendingWrong.map(function(q) {
      return '<div class="wrong-item">' + q.a + ' × ' + q.b + ' = ' + (q.a * q.b) + '</div>';
    }).join('');
  }

  var nextBtn = document.getElementById('exam-next-round-btn');
  var doneBtn = document.getElementById('exam-done-btn');
  if (nextBtn) { nextBtn.style.display = ''; nextBtn.textContent = '開始第 ' + (examRound + 1) + ' 輪 →'; }
  if (doneBtn) doneBtn.style.display = 'none';
}

function startNextRound() {
  examRound++;
  examPool         = shuffle(examPendingWrong.slice());
  examPendingWrong = [];
  var gamePanel    = document.getElementById('exam-game-panel');
  var summaryPanel = document.getElementById('exam-summary-panel');
  if (gamePanel)    gamePanel.style.display    = '';
  if (summaryPanel) summaryPanel.style.display = 'none';
  loadExamQuestion();
}

function onExamComplete() {
  examSelectedTables.forEach(function(t) {
    var allDone = true;
    for (var b2 = 0; b2 <= 10; b2++) {
      if (examMastered.indexOf(pairKey(t, b2)) === -1) { allDone = false; break; }
    }
    if (allDone) {
      var tStr = String(t);
      if (examType === 'fill'    && masteredFill.indexOf(tStr)    === -1) masteredFill.push(tStr);
      if (examType === 'reverse' && masteredReverse.indexOf(tStr) === -1) masteredReverse.push(tStr);
    }
  });
  saveProgress();
  if (typeof checkAchievements === 'function') checkAchievements();
}

function showExamFinalResult() {
  showPage('exam-result');
  var total   = examAllPairs.length;
  var titleEl = document.getElementById('exam-result-title');
  var subEl   = document.getElementById('exam-result-sub');
  var badgeEl = document.getElementById('exam-result-badges');
  if (titleEl) titleEl.textContent = '全部完成！🎉';
  if (subEl)   subEl.textContent   = '共 ' + total + ' 題，歷經 ' + examRound + ' 輪全數答對！';
  if (badgeEl) {
    var arr = examType === 'fill' ? masteredFill : masteredReverse;
    var newTables = examSelectedTables.filter(function(t) {
      return arr.indexOf(String(t)) !== -1;
    });
    badgeEl.innerHTML = newTables.length
      ? '<div class="result-badge">' + (examType === 'fill' ? '✏️ 填空精熟：' : '🔍 拆解精熟：') +
        newTables.map(function(t){ return t + ' 的乘法'; }).join('、') + '</div>'
      : '';
  }
}
