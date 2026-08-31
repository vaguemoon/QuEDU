'use strict';

// ════════════════════════════════════════
//  方程式渲染
//  renderEquation(q) → 寫入 #eq-row 的 innerHTML，並初始化拖曳
// ════════════════════════════════════════

function renderEquation(q) {
  var row = document.getElementById('eq-row');
  if (!row) return;

  row.className = 'eq-row';
  row.innerHTML = buildEquationHTML(q);

  if (dragPhase === 'filling') {
    updateFillDisplay();
  } else {
    initDragChips();
  }
}

function buildEquationHTML(q) {
  if (q.type === 'addSub') return buildAddSubHTML(q);
  if (q.type === 'mulDiv') return buildMulDivHTML(q);
  if (q.type === 'twoStep') return buildTwoStepHTML(q);
  if (q.type === 'withX') return buildWithXHTML(q);
  return '';
}

// ── 加減移項 ──────────────────────────────
// layout='rhs': lhs = □ ± b   chip 在右，往左拖
// layout='lhs': □ ± b = lhs  chip 在左，往右拖
// 填空（兩種 layout 相同）: lhs flipOp(b) = □

function buildAddSubHTML(q) {
  if (dragPhase === 'dragging') {
    if (q.layout === 'lhs') {
      return (
        unknownBlank('□') +
        chipHTML(q.termSign, q.termValue, 'additive') +
        eqSign() +
        termPart(q.lhs)
      );
    }
    return (
      termPart(q.lhs) +
      eqSign() +
      unknownBlank('□') +
      chipHTML(q.termSign, q.termValue, 'additive')
    );
  } else {
    return (
      fillBlank() +
      eqSign() +
      termPart(q.lhs) +
      termOp(flipOp(q.termSign)) +
      termPart(q.termValue)
    );
  }
}

// ── 乘除移項 ──────────────────────────────
// layout='rhs': lhs = □ ×b / □ ÷b
// layout='lhs': □ ×b = lhs / □ ÷b = lhs

function buildMulDivHTML(q) {
  if (dragPhase === 'dragging') {
    if (q.layout === 'lhs') {
      return (
        unknownBlank('□') +
        chipHTML(q.termOp, q.termValue, 'multiplicative') +
        eqSign() +
        termPart(q.lhs)
      );
    }
    return (
      termPart(q.lhs) +
      eqSign() +
      unknownBlank('□') +
      chipHTML(q.termOp, q.termValue, 'multiplicative')
    );
  } else {
    return (
      fillBlank() +
      eqSign() +
      termPart(q.lhs) +
      termOp(flipOp(q.termOp)) +
      termPart(q.termValue)
    );
  }
}

// ── 兩步驟 ───────────────────────────────
// dragStep=0: lhs = □ ×m +c  (+c 可拖，×m 鎖定)
// dragStep=1: lhs flipSign(step1) step1Val = □ ×m  (保留原始運算式，不自動計算)
// filling:    (lhs flipSign(step1) step1Val) flipOp(step2) step2Val = □

function buildTwoStepHTML(q) {
  if (dragPhase === 'dragging') {
    if (q.dragStep === 0) {
      return (
        termPart(q.lhs) +
        eqSign() +
        unknownBlank('□') +
        chipHTML(q.step2Op, q.step2Value, 'multiplicative locked') +
        chipHTML(q.step1Sign, q.step1Value, 'additive')
      );
    } else {
      // 保留運算式：10 - 4 = □ ×2（不計算中間值）
      return (
        termPart(q.lhs) +
        termOp(flipOp(q.step1Sign)) +
        termPart(q.step1Value) +
        eqSign() +
        unknownBlank('□') +
        chipHTML(q.step2Op, q.step2Value, 'multiplicative')
      );
    }
  } else {
    // 填空：□ = (10 - 4) ÷ 2
    return (
      fillBlank() +
      eqSign() +
      '<span class="eq-paren">(</span>' +
      termPart(q.lhs) +
      termOp(flipOp(q.step1Sign)) +
      termPart(q.step1Value) +
      '<span class="eq-paren">)</span>' +
      termOp(flipOp(q.step2Op)) +
      termPart(q.step2Value)
    );
  }
}

// ── 含未知數 x ────────────────────────────
// 格式：x + b = lhs（x 在左，+b 可拖到右邊）
function buildWithXHTML(q) {
  if (dragPhase === 'dragging') {
    return (
      unknownBlank('x') +
      chipHTML(q.termSign, q.termValue, 'additive') +
      eqSign() +
      termPart(q.lhs)
    );
  } else {
    return (
      fillBlank() +
      eqSign() +
      termPart(q.lhs) +
      termOp(flipOp(q.termSign)) +
      termPart(q.termValue)
    );
  }
}

// ════════════════════════════════════════
//  HTML 片段建構函式
// ════════════════════════════════════════

function termPart(val) {
  return '<span class="eq-part">' + val + '</span>';
}

function termOp(op) {
  return '<span class="eq-op">' + op + '</span>';
}

function eqSign(extraClass) {
  return '<span class="eq-sign' + (extraClass ? ' ' + extraClass : '') + '">=</span>';
}

function unknownBlank(sym) {
  return '<span class="eq-unknown">' + sym + '</span>';
}

function fillBlank() {
  return '<span class="eq-blank fill-active" id="fill-display">＿</span>';
}

function chipHTML(op, val, classes) {
  return '<span class="term-chip draggable term-chip--' + classes + '">' + op + val + '</span>';
}

// ── 更新填空顯示 ──
function updateFillDisplay() {
  var el = document.getElementById('fill-display');
  if (el) el.textContent = fillInputStr || '＿';
}
