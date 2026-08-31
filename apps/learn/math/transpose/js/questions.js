'use strict';

// ════════════════════════════════════════
//  加減移項：a = □ ± b  或  □ ± b = a
//  answer ∈ [1,15], termValue ∈ [1,10], lhs ∈ [1,20]
// ════════════════════════════════════════
function generateAddSubQ() {
  var unknown, termValue, termSign, lhs;
  var tries = 0;
  do {
    unknown   = randInt(1, 15);
    termValue = randInt(1, 10);
    termSign  = Math.random() < 0.5 ? '+' : '-';
    lhs       = termSign === '+' ? unknown + termValue : unknown - termValue;
    tries++;
  } while ((lhs < 1 || lhs > 20) && tries < 50);
  var layout = Math.random() < 0.5 ? 'rhs' : 'lhs';
  return { type: 'addSub', lhs: lhs, unknown: unknown, termSign: termSign, termValue: termValue, layout: layout };
}

// ════════════════════════════════════════
//  乘除移項：lhs = □ × b  或  lhs = □ ÷ b
//  answer ∈ [1,10], product ≤ 20
// ════════════════════════════════════════
function generateMulDivQ() {
  var termOp = Math.random() < 0.5 ? '×' : '÷';
  var unknown, termValue, lhs;
  var tries = 0;
  if (termOp === '×') {
    do {
      unknown   = randInt(1, 10);
      termValue = randInt(2, 9);
      lhs       = unknown * termValue;
      tries++;
    } while (lhs > 20 && tries < 50);
  } else {
    // ÷: 方程式形式 lhs = □ ÷ b
    // 移項後得 lhs × b = □，所以 unknown = lhs × b
    // 確保 unknown ≤ 20：列舉所有合法組合
    var pairs = [];
    for (var lhsV = 1; lhsV <= 10; lhsV++) {
      for (var bV = 2; bV <= 9; bV++) {
        var u = lhsV * bV;
        if (u >= 1 && u <= 20) pairs.push({ lhs: lhsV, termValue: bV, unknown: u });
      }
    }
    var pick = pairs[randInt(0, pairs.length - 1)];
    lhs = pick.lhs; termValue = pick.termValue; unknown = pick.unknown;
  }
  var layout = Math.random() < 0.5 ? 'rhs' : 'lhs';
  return { type: 'mulDiv', lhs: lhs, unknown: unknown, termOp: termOp, termValue: termValue, layout: layout };
}

// ════════════════════════════════════════
//  兩步驟：lhs = □ × m ± c
//  先拖加減項，再拖乘除項
//  answer ∈ [1,9], step2Value ∈ [2,5]
// ════════════════════════════════════════
function generateTwoStepQ() {
  var unknown, step2Value, step1Value, step1Sign, lhs, intermediate;
  var tries = 0;
  do {
    unknown    = randInt(1, 9);
    step2Value = randInt(2, 5);
    intermediate = unknown * step2Value;
    step1Value = randInt(1, 8);
    step1Sign  = Math.random() < 0.7 ? '+' : '-';
    lhs        = step1Sign === '+' ? intermediate + step1Value : intermediate - step1Value;
    tries++;
  } while ((intermediate > 20 || lhs < 1 || lhs > 20) && tries < 100);
  return {
    type: 'twoStep',
    lhs: lhs,
    unknown: unknown,
    step1Sign: step1Sign,
    step1Value: step1Value,
    step2Op: '×',
    step2Value: step2Value,
    dragStep: 0
  };
}

// ════════════════════════════════════════
//  含未知數 x：同加減移項但顯示 x 而非 □
// ════════════════════════════════════════
function generateWithXQ() {
  var q = generateAddSubQ();
  q.type = 'withX';
  return q;
}

// ════════════════════════════════════════
//  建題目池
// ════════════════════════════════════════
function buildPool(topic, count) {
  var generators = {
    addSub:  generateAddSubQ,
    mulDiv:  generateMulDivQ,
    twoStep: generateTwoStepQ,
    withX:   generateWithXQ
  };
  var gen = generators[topic];
  if (!gen) return [];
  var pool = [];
  for (var i = 0; i < count; i++) pool.push(gen());
  return shuffle(pool);
}
