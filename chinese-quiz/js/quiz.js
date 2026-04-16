/**
 * quiz.js — 出題、渲染、拖曳、批改邏輯
 * 依賴：state.js（currentQuiz、currentStudent、saveRecord）、nav.js
 */
'use strict';

/* ══════════════════════════════════════════
   課次選單
   ══════════════════════════════════════════ */
var CN_ORDER = ['一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五'];

function cnSort(a, b) {
  return CN_ORDER.indexOf(a) - CN_ORDER.indexOf(b);
}

document.getElementById('sel-grade').addEventListener('change', function() {
  var grade = this.value;
  var sel = document.getElementById('sel-lesson');
  sel.innerHTML = '<option value="">── 全部課次 ──</option>';
  if (!grade) return;
  var waitAndFill = function() {
    if (!window._lessonMap) { setTimeout(waitAndFill, 200); return; }
    var lessons = (window._lessonMap[grade] || []).slice().sort(cnSort);
    lessons.forEach(function(l) {
      var o = document.createElement('option');
      o.value = l; o.textContent = '第' + l + '課';
      sel.appendChild(o);
    });
  };
  waitAndFill();
});

/* ══════════════════════════════════════════
   出題
   ══════════════════════════════════════════ */
function generateQuiz() {
  var grade   = document.getElementById('sel-grade').value;
  var lesson  = document.getElementById('sel-lesson').value;
  var qExplain = parseInt(document.getElementById('qty-explain').value) || 0;
  var qFill    = parseInt(document.getElementById('qty-fill').value)    || 0;
  var qMC      = parseInt(document.getElementById('qty-mc').value)      || 0;

  if (!grade) { alert('請選擇年級'); return; }
  if (qExplain + qFill + qMC === 0) { alert('請至少設定一種題型的題數'); return; }

  var pool = (window._questions || EMBEDDED_QUESTIONS).filter(function(q) {
    if (q.grade !== grade) return false;
    if (lesson && q.lesson !== lesson) return false;
    return true;
  });

  function pick(type, n) {
    var available = pool.filter(function(q) { return q.type === type; });
    var shuffled  = available.slice().sort(function() { return Math.random() - 0.5; });
    return shuffled.slice(0, Math.min(n, shuffled.length));
  }

  var explains = pick('詞語解釋', qExplain);
  var fills    = pick('詞語填空', qFill);
  var mcs      = pick('選擇題', qMC);

  currentQuiz = explains.concat(fills, mcs);
  if (currentQuiz.length === 0) {
    alert('此範圍內沒有足夠題目，請調整篩選條件');
    return;
  }

  renderQuiz(explains, fills, mcs, grade, lesson);
}

/* ══════════════════════════════════════════
   渲染試卷
   ══════════════════════════════════════════ */
function renderQuiz(explains, fills, mcs, grade, lesson) {
  var lessonText = lesson ? '第' + lesson + '課' : '全部課次';
  document.getElementById('quiz-title').textContent = grade + ' ' + lessonText;
  document.getElementById('quiz-meta').textContent =
    '共 ' + (explains.length + fills.length + mcs.length) + ' 題';

  var container = document.getElementById('quiz-content');
  container.innerHTML = '';
  var globalN = 1;

  if (explains.length > 0) {
    container.appendChild(makeSectionTitle('一、詞語解釋', '拖曳詞卡填入空格'));
    var bankWords1 = explains.map(function(q) { return q.answer; }).sort(function() { return Math.random()-0.5; });
    container.appendChild(makeWordBank(bankWords1, 'bank-explain'));
    explains.forEach(function(q) { container.appendChild(makeExplainCard(q, globalN++, 'bank-explain')); });
  }

  if (fills.length > 0) {
    container.appendChild(makeSectionTitle('二、詞語填空', '拖曳詞卡填入（　　）'));
    var bankWords2 = fills.map(function(q) { return q.answer; }).sort(function() { return Math.random()-0.5; });
    container.appendChild(makeWordBank(bankWords2, 'bank-fill'));
    fills.forEach(function(q) { container.appendChild(makeFillCard(q, globalN++, 'bank-fill')); });
  }

  if (mcs.length > 0) {
    container.appendChild(makeSectionTitle('三、選擇題', '點選正確答案'));
    mcs.forEach(function(q) { container.appendChild(makeMCCard(q, globalN++)); });
  }

  showQuiz();
  initDragDrop();
}

function makeSectionTitle(title, sub) {
  var div = document.createElement('div');
  div.className = 'section-title';
  div.innerHTML = '<h3>' + title + '</h3><span style="font-size:0.8rem;color:#999;margin-left:4px">（' + sub + '）</span><div class="section-divider"></div>';
  return div;
}

function makeWordBank(words, bankId) {
  var div = document.createElement('div');
  div.className = 'word-bank';
  div.id = bankId;
  div.innerHTML = '<div class="word-bank-label">詞 庫</div>';
  words.forEach(function(w, i) {
    var chip = document.createElement('div');
    chip.className = 'word-chip';
    chip.dataset.word = w;
    chip.dataset.bank = bankId;
    chip.dataset.chipId = bankId + '-' + i;
    chip.textContent = w;
    div.appendChild(chip);
  });
  return div;
}

function makeExplainCard(q, n, bankId) {
  var card = document.createElement('div');
  card.className = 'q-card';
  card.dataset.qid    = q.id;
  card.dataset.answer = q.answer;
  card.dataset.type   = 'explain';
  var slot = '<span class="drop-slot" data-qid="' + q.id + '" data-bank="' + bankId + '" onclick="slotClick(this)"></span>';
  card.innerHTML =
    '<div class="q-num">' + n + '</div>' +
    '<div class="q-body">' +
      '<div class="def-row">' +
        '<div class="def-text">' + q.question + '</div>' +
        '<div class="def-arrow">→</div>' +
        slot +
      '</div>' +
      '<div class="q-result"></div>' +
    '</div>';
  return card;
}

function makeFillCard(q, n, bankId) {
  var card = document.createElement('div');
  card.className = 'q-card';
  card.dataset.qid    = q.id;
  card.dataset.answer = q.answer;
  card.dataset.type   = 'fill';
  var stem = q.question.replace(
    /（\s*）|（　+）|\(\s*\)|\(　+\)/g,
    '<span class="drop-slot" data-qid="' + q.id + '" data-bank="' + bankId + '" onclick="slotClick(this)"></span>'
  );
  card.innerHTML =
    '<div class="q-num">' + n + '</div>' +
    '<div class="q-body">' +
      '<div class="q-stem">' + stem + '</div>' +
      '<div class="q-result"></div>' +
    '</div>';
  return card;
}

function makeMCCard(q, n) {
  var card = document.createElement('div');
  card.className = 'q-card';
  card.dataset.qid    = q.id;
  card.dataset.answer = q.answer;
  card.dataset.type   = 'mc';
  var opts = (q.options && q.options.length >= 3) ? q.options : ['A. 選項A', 'B. 選項B', 'C. 選項C'];
  var optHtml = '';
  opts.forEach(function(opt, i) {
    var letter = String.fromCharCode(65 + i);
    var text   = opt.replace(/^[A-C][.．、\s]+/, '');
    optHtml += '<div class="mc-option" data-letter="' + letter + '" onclick="selectMC(this,\'' + q.id + '\')">' +
      '<div class="mc-letter">' + letter + '</div>' +
      '<div>' + text + '</div>' +
    '</div>';
  });
  card.innerHTML =
    '<div class="q-num">' + n + '</div>' +
    '<div class="q-body">' +
      '<div class="q-stem" style="margin-bottom:12px">' + q.question + '</div>' +
      '<div class="mc-options">' + optHtml + '</div>' +
      '<div class="q-result"></div>' +
    '</div>';
  return card;
}

/* ══════════════════════════════════════════
   選擇題互動
   ══════════════════════════════════════════ */
function selectMC(el, qid) {
  var card = el.closest('.q-card');
  card.querySelectorAll('.mc-option').forEach(function(o) { o.classList.remove('selected'); });
  el.classList.add('selected');
}

/* ══════════════════════════════════════════
   拖曳邏輯
   ══════════════════════════════════════════ */
var draggingChip = null;
var draggingWord = null;
var ghostEl      = null;

function initDragDrop() {
  ghostEl = document.getElementById('drag-ghost');
  document.querySelectorAll('.word-chip').forEach(function(chip) {
    chip.addEventListener('mousedown', startDragMouse);
    chip.addEventListener('touchstart', startDragTouch, { passive: false });
  });
}

function startDragMouse(e) {
  if (e.target.classList.contains('slot-clear')) return;
  var chip = e.currentTarget;
  if (chip.classList.contains('used')) return;
  draggingChip = chip;
  draggingWord = chip.dataset.word;
  chip.classList.add('dragging');
  ghostEl.textContent = draggingWord;
  ghostEl.style.display = 'block';
  moveGhost(e.clientX, e.clientY);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup',   onMouseUp);
  e.preventDefault();
}

function onMouseMove(e) { moveGhost(e.clientX, e.clientY); highlightSlotUnder(e.clientX, e.clientY); }

function onMouseUp(e) {
  ghostEl.style.display = 'none';
  if (draggingChip) draggingChip.classList.remove('dragging');
  var slot = getSlotAt(e.clientX, e.clientY);
  if (slot) dropOnSlot(slot);
  document.querySelectorAll('.drop-slot').forEach(function(s) { s.classList.remove('drag-over'); });
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup',   onMouseUp);
  draggingChip = null; draggingWord = null;
}

function startDragTouch(e) {
  var chip = e.currentTarget;
  if (chip.classList.contains('used')) return;
  draggingChip = chip;
  draggingWord = chip.dataset.word;
  chip.classList.add('dragging');
  ghostEl.textContent = draggingWord;
  ghostEl.style.display = 'block';
  var t = e.touches[0];
  moveGhost(t.clientX, t.clientY);
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend',  onTouchEnd);
  e.preventDefault();
}

function onTouchMove(e) {
  var t = e.touches[0];
  moveGhost(t.clientX, t.clientY);
  highlightSlotUnder(t.clientX, t.clientY);
  e.preventDefault();
}

function onTouchEnd(e) {
  ghostEl.style.display = 'none';
  if (draggingChip) draggingChip.classList.remove('dragging');
  var t = e.changedTouches[0];
  var slot = getSlotAt(t.clientX, t.clientY);
  if (slot) dropOnSlot(slot);
  document.querySelectorAll('.drop-slot').forEach(function(s) { s.classList.remove('drag-over'); });
  document.removeEventListener('touchmove', onTouchMove);
  document.removeEventListener('touchend',  onTouchEnd);
  draggingChip = null; draggingWord = null;
}

function moveGhost(x, y) { ghostEl.style.left = x + 'px'; ghostEl.style.top = y + 'px'; }

function getSlotAt(x, y) {
  var els = document.elementsFromPoint(x, y);
  return els.find(function(el) { return el.classList.contains('drop-slot'); }) || null;
}

function highlightSlotUnder(x, y) {
  document.querySelectorAll('.drop-slot').forEach(function(s) { s.classList.remove('drag-over'); });
  var slot = getSlotAt(x, y);
  if (slot) slot.classList.add('drag-over');
}

function dropOnSlot(slot) {
  if (!draggingWord) return;
  var prevWord = slot.dataset.filled;
  if (prevWord) returnWordToBank(prevWord, slot.dataset.bank);
  slot.dataset.filled = draggingWord;
  slot.textContent = draggingWord;
  slot.classList.add('filled');
  slot.classList.remove('drag-over', 'correct', 'wrong');
  var clr = document.createElement('span');
  clr.className = 'slot-clear';
  clr.textContent = '×';
  clr.onclick = function(e) { e.stopPropagation(); clearSlot(slot); };
  slot.appendChild(clr);
  if (draggingChip) draggingChip.classList.add('used');
}

function slotClick(slot) { /* 空格點擊預留 */ }

function clearSlot(slot) {
  var word = slot.dataset.filled;
  if (!word) return;
  returnWordToBank(word, slot.dataset.bank);
  slot.dataset.filled = '';
  slot.textContent = '';
  slot.classList.remove('filled', 'correct', 'wrong');
  var clr = slot.querySelector('.slot-clear');
  if (clr) clr.remove();
}

function returnWordToBank(word, bankId) {
  var bank = document.getElementById(bankId);
  if (!bank) return;
  bank.querySelectorAll('.word-chip').forEach(function(chip) {
    if (chip.dataset.word === word && chip.classList.contains('used')) {
      chip.classList.remove('used');
    }
  });
}

/* ══════════════════════════════════════════
   批改
   ══════════════════════════════════════════ */
function submitQuiz() {
  var correct = 0, total = 0;

  document.querySelectorAll('.q-card').forEach(function(card) {
    var type     = card.dataset.type;
    var answer   = card.dataset.answer;
    var resultEl = card.querySelector('.q-result');
    total++;

    if (type === 'mc') {
      var selected = card.querySelector('.mc-option.selected');
      var userAns  = selected ? selected.dataset.letter : null;
      var isCorrect = (userAns === answer);
      if (isCorrect) correct++;
      card.querySelectorAll('.mc-option').forEach(function(o) {
        o.onclick = null;
        if (o.dataset.letter === answer)              o.classList.add('reveal-correct');
        if (o.dataset.letter === userAns && !isCorrect) o.classList.add('wrong');
      });
      resultEl.style.display = 'block';
      resultEl.className = 'q-result ' + (isCorrect ? 'correct' : 'wrong');
      resultEl.textContent = isCorrect ? '✓ 正確！' : '✗ 正確答案：' + answer;
    } else {
      var slot      = card.querySelector('.drop-slot');
      var filled    = slot ? slot.dataset.filled : '';
      var isCorrect = (filled === answer);
      if (isCorrect) correct++;
      if (slot) {
        slot.classList.remove('filled', 'drag-over');
        slot.classList.add(isCorrect ? 'correct' : 'wrong');
        var clr = slot.querySelector('.slot-clear');
        if (clr) clr.remove();
      }
      resultEl.style.display = 'block';
      resultEl.className = 'q-result ' + (isCorrect ? 'correct' : 'wrong');
      resultEl.textContent = isCorrect ? '✓ 正確！' : '✗ 正確答案：' + answer;
    }
  });

  var score = Math.round((correct / total) * 100);
  var grade  = document.getElementById('sel-grade').value;
  var lesson = document.getElementById('sel-lesson').value;

  displayScore(score, correct, total);
  saveRecord(score, correct, total, grade, lesson);
}

function displayScore(score, correct, total) {
  var emoji = score >= 90 ? '🌟' : score >= 70 ? '😊' : score >= 50 ? '💪' : '📚';
  var playerName = currentStudent
    ? (currentStudent.nickname || currentStudent.name)
    : '同學';

  document.getElementById('score-emoji').textContent         = emoji;
  document.getElementById('score-name-display').textContent  = playerName + ' 同學';
  document.getElementById('score-display').textContent       = score;
  document.getElementById('score-detail').textContent        =
    '答對 ' + correct + ' 題，共 ' + total + ' 題';

  showScore();
}
