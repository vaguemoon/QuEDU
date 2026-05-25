/**
 * questions.js — 題目生成器
 * 負責：各題域（長度、時間、貨幣）的題目生成，輸出標準 question 物件
 * 依賴：state.js（shuffle、ROUND_SIZE）
 *
 * question 物件格式：
 *   { prompt: string, answerCount: 1|2, answer: [number,...], correctText: string }
 */
'use strict';

// ════════════════════════════════════════
//  度量衡換算（長度/重量/容量）
//  共用 msVisual 沙盒視覺資料
// ════════════════════════════════════════

// merge 題組：{ l: 大單位數, r: 餘量小單位 }
// split 題組：小單位總量（整數）
var _MS_VALS = {
  'mm-cm': {
    merge: [
      {l:1,r:0},{l:2,r:0},{l:3,r:0},{l:4,r:0},{l:5,r:0},
      {l:6,r:0},{l:7,r:0},{l:8,r:0},{l:9,r:0},
      {l:1,r:5},{l:2,r:3},{l:3,r:7},{l:4,r:5},{l:5,r:5}
    ],
    split: [10,15,20,25,30,35,40,45,50,60,70,80,90]
  },
  'cm-m': {
    merge: [
      {l:1,r:0},{l:2,r:0},{l:3,r:0},{l:4,r:0},{l:5,r:0},
      {l:6,r:0},{l:7,r:0},{l:8,r:0},{l:9,r:0},
      {l:1,r:50},{l:2,r:30},{l:3,r:75},{l:4,r:25},{l:6,r:50}
    ],
    split: [100,150,200,250,300,350,400,450,500,600,700,800,900]
  },
  'm-km': {
    merge: [
      {l:1,r:0},{l:2,r:0},{l:3,r:0},{l:4,r:0},{l:5,r:0},
      {l:6,r:0},{l:7,r:0},{l:8,r:0},{l:9,r:0},
      {l:1,r:500},{l:2,r:200},{l:3,r:750},{l:4,r:500},{l:6,r:300}
    ],
    split: [1000,1500,2000,2500,3000,3500,4000,4500,5000,6000,7000,8000,9000]
  },
  'g-kg': {
    merge: [
      {l:1,r:0},{l:2,r:0},{l:3,r:0},{l:4,r:0},{l:5,r:0},
      {l:6,r:0},{l:7,r:0},{l:8,r:0},{l:9,r:0},
      {l:1,r:500},{l:2,r:300},{l:3,r:750},{l:4,r:500},{l:5,r:200}
    ],
    split: [1000,1500,2000,2500,3000,3500,4000,4500,5000,5500,6000,7000,8000,9000]
  },
  'kg-t': {
    merge: [
      {l:1,r:0},{l:2,r:0},{l:3,r:0},{l:4,r:0},{l:5,r:0},
      {l:6,r:0},{l:7,r:0},{l:8,r:0},{l:9,r:0},
      {l:1,r:500},{l:2,r:200},{l:3,r:500},{l:4,r:750},{l:2,r:750}
    ],
    split: [1000,1500,2000,2500,3000,3500,4000,4500,5000,6000,7000,8000,9000]
  },
  'ml-l': {
    merge: [
      {l:1,r:0},{l:2,r:0},{l:3,r:0},{l:4,r:0},{l:5,r:0},
      {l:6,r:0},{l:7,r:0},{l:8,r:0},{l:9,r:0},
      {l:1,r:500},{l:2,r:250},{l:3,r:750},{l:2,r:500},{l:4,r:500}
    ],
    split: [1000,1500,2000,2500,3000,3500,4000,4500,5000,6000,7000,8000,9000]
  }
};

function _makeMeasureQuestions(pair) {
  var cfg  = _MS_CFG[pair];
  if (!cfg) return [];
  var vals = _MS_VALS[pair];
  var questions = [];

  // 大到小（merge）
  vals.merge.forEach(function(v) {
    var total = v.l * cfg.factor + v.r;
    var promptLarge = v.l + cfg.largeLabel + (v.r > 0 ? v.r + cfg.smallLabel : '');
    questions.push({
      prompt:      promptLarge + ' = ？' + cfg.smallLabel,
      answerCount: 1,
      answer:      [total],
      correctText: total + cfg.smallLabel,
      msVisual:    { domain: cfg.domain, pair: pair, mode: 'merge', largeCount: v.l, remainSmall: v.r }
    });
  });

  // 小到大（split）
  vals.split.forEach(function(total) {
    var lv = Math.floor(total / cfg.factor);
    var rv = total % cfg.factor;
    if (rv === 0) {
      questions.push({
        prompt:      total + cfg.smallLabel + ' = ？' + cfg.largeLabel,
        answerCount: 1,
        answer:      [lv],
        correctText: lv + cfg.largeLabel,
        msVisual:    { domain: cfg.domain, pair: pair, mode: 'split', totalSmall: total }
      });
    } else {
      questions.push({
        prompt:      total + cfg.smallLabel + ' = ？' + cfg.largeLabel + '？' + cfg.smallLabel,
        answerCount: 2,
        answer:      [lv, rv],
        correctText: lv + cfg.largeLabel + rv + cfg.smallLabel,
        msVisual:    { domain: cfg.domain, pair: pair, mode: 'split', totalSmall: total }
      });
    }
  });

  return questions;
}

function _makeLengthQuestions(subtype) {
  var pairs = subtype === 'mixed' ? ['mm-cm', 'cm-m', 'm-km'] : [subtype];
  var questions = [];
  pairs.forEach(function(p) {
    questions = questions.concat(_makeMeasureQuestions(p));
  });
  return questions;
}

function _makeWeightQuestions(subtype) {
  var pairs = subtype === 'mixed' ? ['g-kg', 'kg-t'] : [subtype];
  var questions = [];
  pairs.forEach(function(p) {
    questions = questions.concat(_makeMeasureQuestions(p));
  });
  return questions;
}

function _makeVolumeQuestions(subtype) {
  return _makeMeasureQuestions('ml-l');
}

// ════════════════════════════════════════
//  時間換算
// ════════════════════════════════════════

var _TS_UNIT_ORDER   = ['day', 'hour', 'minute', 'second'];
var _TS_UNIT_LABEL   = { day: '日', hour: '時', minute: '分', second: '秒' };
var _TS_UNIT_FACTOR  = { day: 24, hour: 60, minute: 60, second: 1 }; // factor to next smaller unit
var _TS_PAIR_LARGE   = { 'day-hour': 'day',    'hour-min': 'hour',   'min-sec': 'minute' };
var _TS_PAIR_SMALL   = { 'day-hour': 'hour',   'hour-min': 'minute', 'min-sec': 'second' };
var _TS_PAIR_FACTOR  = { 'day-hour': 24,       'hour-min': 60,       'min-sec': 60       };

// ── 易模式：各配對的固定值 ──
var _TIME_EASY = {
  'day-hour': {
    lts: [ // 大到小：{d, h} → 答 d*24+h
      {d:1,h:0},{d:1,h:6},{d:1,h:12},{d:2,h:0},
      {d:2,h:6},{d:3,h:0},{d:1,h:3},{d:2,h:3}
    ],
    stl: [25, 26, 30, 36, 48, 50, 27, 33] // 小到大：總時數 → 答 [d, h]
  },
  'hour-min': {
    lts: [75, 90, 105, 120, 135, 150, 180, 240], // 分鐘數，顯示為 X時Y分 → 答總分
    stl: [75, 90, 105, 120, 135, 150, 180, 240]  // 總分 → 答 [h, min]
  },
  'min-sec': {
    lts: [ // 大到小：{m, s} → 答 m*60+s
      {m:1,s:0},{m:1,s:30},{m:2,s:0},{m:2,s:15},
      {m:3,s:0},{m:1,s:15},{m:1,s:45},{m:2,s:30}
    ],
    stl: [75, 90, 100, 105, 120, 130, 150, 180] // 總秒 → 答 [m, s]
  }
};

// ── 難模式：跨配對，依鏈長度設計值（最小單位總量） ──
var _TIME_HARD_VALS = {
  'day-hour-minute':        [1530, 1650, 2000, 2400, 2880, 1445, 1500, 2160, 3000, 4320],
  'hour-minute-second':     [3700, 3661, 4200, 5400, 7200, 3750, 5000, 3601, 7320, 4500],
  'day-hour-minute-second': [86500, 90000, 100000, 90061, 172861, 100260, 95400, 88261]
};

function _getChainFactors(chainUnits) {
  var factors = [];
  for (var i = 0; i < chainUnits.length; i++) {
    var f = 1;
    for (var j = i; j < chainUnits.length - 1; j++) {
      f *= _TS_UNIT_FACTOR[chainUnits[j]];
    }
    factors.push(f);
  }
  return factors; // factors[i] = num of chainUnits[last] per chainUnits[i]
}

function _decomposeTotal(total, chainUnits) {
  var factors = _getChainFactors(chainUnits);
  var amounts = [];
  var remaining = total;
  for (var i = 0; i < chainUnits.length; i++) {
    var a = Math.floor(remaining / factors[i]);
    amounts.push(a);
    remaining -= a * factors[i];
  }
  return amounts;
}

function _makeEasyTimePair(pair, subtype) {
  var questions = [];
  var factor = _TS_PAIR_FACTOR[pair];
  var largeType = _TS_PAIR_LARGE[pair];
  var smallType = _TS_PAIR_SMALL[pair];
  var lLabel = _TS_UNIT_LABEL[largeType];
  var sLabel = _TS_UNIT_LABEL[smallType];

  if (subtype === 'large-to-small') {
    var vals = _TIME_EASY[pair].lts;
    vals.forEach(function(v) {
      var total, promptLarge;
      if (pair === 'hour-min') {
        total = v;
        var h = Math.floor(v / 60), m = v % 60;
        promptLarge = h + lLabel + (m > 0 ? m + sLabel : '');
        questions.push({
          prompt: promptLarge + ' = ？' + sLabel,
          answerCount: 1, answer: [total], correctText: total + sLabel,
          tsVisual: { pair: pair, mode: 'merge', largeCount: h, remainSmall: m }
        });
      } else {
        var lv = v.d !== undefined ? v.d : v.m;
        var sv = v.d !== undefined ? v.h : v.s;
        total = lv * factor + sv;
        promptLarge = lv + lLabel + (sv > 0 ? sv + sLabel : '');
        questions.push({
          prompt: promptLarge + ' = ？' + sLabel,
          answerCount: 1, answer: [total], correctText: total + sLabel,
          tsVisual: { pair: pair, mode: 'merge', largeCount: lv, remainSmall: sv }
        });
      }
    });
  } else {
    var vals = _TIME_EASY[pair].stl;
    vals.forEach(function(total) {
      var lv = Math.floor(total / factor), sv = total % factor;
      questions.push({
        prompt: total + sLabel + ' = ？' + lLabel + '？' + sLabel,
        answerCount: 2, answer: [lv, sv], correctText: lv + lLabel + sv + sLabel,
        tsVisual: { pair: pair, mode: 'split', totalSmall: total }
      });
    });
  }
  return questions;
}

function _makeHardTimeQuestions(selectedPairs, subtype) {
  var pairOrder = ['day-hour', 'hour-min', 'min-sec'];
  var active = pairOrder.filter(function(p) { return selectedPairs.indexOf(p) >= 0; });
  if (active.length === 0) return [];

  var largestUnit  = _TS_PAIR_LARGE[active[0]];
  var smallestUnit = _TS_PAIR_SMALL[active[active.length - 1]];
  var li = _TS_UNIT_ORDER.indexOf(largestUnit);
  var si = _TS_UNIT_ORDER.indexOf(smallestUnit);
  var chainUnits = _TS_UNIT_ORDER.slice(li, si + 1);

  var chainKey = chainUnits.join('-');
  var rawVals  = _TIME_HARD_VALS[chainKey];
  if (!rawVals || rawVals.length === 0) return [];

  var questions = [];
  rawVals.forEach(function(total) {
    var amounts = _decomposeTotal(total, chainUnits);
    var labels  = chainUnits.map(function(u) { return _TS_UNIT_LABEL[u]; });
    var sLabel  = labels[labels.length - 1];

    if (subtype === 'large-to-small') {
      var promptLarge = '';
      for (var i = 0; i < chainUnits.length - 1; i++) {
        promptLarge += amounts[i] + labels[i];
      }
      questions.push({
        prompt: promptLarge + ' = ？' + sLabel,
        answerCount: 1, answer: [total], correctText: total + sLabel
      });
    } else {
      var promptQ = total + sLabel + ' = ';
      for (var i = 0; i < chainUnits.length; i++) {
        promptQ += '？' + labels[i];
      }
      questions.push({
        prompt: promptQ,
        answerCount: chainUnits.length,
        answer: amounts,
        correctText: amounts.map(function(a, i) { return a + labels[i]; }).join('')
      });
    }
  });
  return questions;
}

function _makeTimeQuestions(subtype, difficulty) {
  var selected = ['day-hour', 'hour-min', 'min-sec'].filter(function(p) {
    return currentTimeItems[p];
  });
  if (selected.length === 0) return [];

  if (difficulty === 'easy') {
    return _makeEasyTimePair(selected[0], subtype);
  } else {
    return _makeHardTimeQuestions(selected, subtype);
  }
}

// ════════════════════════════════════════
//  貨幣換算
// ════════════════════════════════════════

var _EXCHANGE_EASY = [
  { from: 100,  to: 10,  answer: 10 },
  { from: 50,   to: 10,  answer: 5  },
  { from: 100,  to: 50,  answer: 2  },
  { from: 500,  to: 50,  answer: 10 },
  { from: 100,  to: 5,   answer: 20 },
  { from: 50,   to: 5,   answer: 10 },
  { from: 10,   to: 5,   answer: 2  },
  { from: 10,   to: 1,   answer: 10 },
  { from: 5,    to: 1,   answer: 5  },
  { from: 50,   to: 1,   answer: 50 }
];

var _EXCHANGE_HARD = [
  { from: 1000, to: 100, answer: 10  },
  { from: 500,  to: 10,  answer: 50  },
  { from: 1000, to: 50,  answer: 20  },
  { from: 200,  to: 10,  answer: 20  },
  { from: 500,  to: 100, answer: 5   },
  { from: 1000, to: 10,  answer: 100 }
];

// 零錢換鈔：N 個 X 元硬幣，可以換幾張 Y 元鈔票？（整除，無餘額）
var _CHANGE_TO_BILL_EASY = [
  { count: 10, coin: 10,  bill: 100  },
  { count: 20, coin: 10,  bill: 100  },
  { count: 30, coin: 10,  bill: 100  },
  { count:  5, coin: 10,  bill:  50  },
  { count: 10, coin: 10,  bill:  50  },
  { count:  2, coin: 50,  bill: 100  },
  { count:  4, coin: 50,  bill: 100  },
  { count:  6, coin: 50,  bill: 100  },
  { count: 10, coin: 50,  bill: 500  },
  { count:  5, coin: 100, bill: 500  },
  { count: 10, coin: 100, bill: 1000 }
];

var _CHANGE_TO_BILL_HARD = [
  { count: 40, coin:  10, bill: 100  },
  { count: 25, coin:  10, bill:  50  },
  { count: 50, coin:  10, bill: 100  },
  { count: 20, coin:  50, bill: 1000 },
  { count: 15, coin: 100, bill: 500  },
  { count: 25, coin: 100, bill: 500  },
  { count: 50, coin: 100, bill: 1000 }
];

function _makeMoneyQuestions(subtype, difficulty) {
  var doExchange     = subtype === 'exchange'       || subtype === 'mixed';
  var doChangeToBill = subtype === 'change-to-bill' || subtype === 'mixed';

  var questions = [];

  if (doExchange) {
    var pairs = difficulty === 'easy'
      ? _EXCHANGE_EASY
      : _EXCHANGE_HARD.concat(_EXCHANGE_EASY);
    pairs.forEach(function(p) {
      questions.push({
        prompt:      p.from + ' 元 = ？ 個 ' + p.to + ' 元',
        answerCount: 1,
        answer:      [p.answer],
        correctText: p.answer + ' 個',
        visual:      { mode: 'exchange', fromDenom: p.from, toDenom: p.to }
      });
    });
  }

  if (doChangeToBill) {
    var items = difficulty === 'easy' ? _CHANGE_TO_BILL_EASY : _CHANGE_TO_BILL_HARD;
    items.forEach(function(item) {
      var ans = (item.count * item.coin) / item.bill;
      questions.push({
        prompt:      item.count + ' 個 ' + item.coin + ' 元，可以換？張 ' + item.bill + ' 元',
        answerCount: 1,
        answer:      [ans],
        correctText: ans + ' 張',
        visual:      { mode: 'coins-to-bill', coinDenom: item.coin, coinCount: item.count, billDenom: item.bill }
      });
    });
  }

  return questions;
}

// ════════════════════════════════════════
//  百分率換算
// ════════════════════════════════════════

var _PERCENT_DEC_VALS = [
  { pct: 10, dec: 0.1  }, { pct: 20, dec: 0.2  }, { pct: 30, dec: 0.3  },
  { pct: 40, dec: 0.4  }, { pct: 50, dec: 0.5  }, { pct: 60, dec: 0.6  },
  { pct: 70, dec: 0.7  }, { pct: 80, dec: 0.8  }, { pct: 90, dec: 0.9  },
  { pct: 5,  dec: 0.05 }, { pct: 15, dec: 0.15 }, { pct: 25, dec: 0.25 },
  { pct: 35, dec: 0.35 }, { pct: 45, dec: 0.45 }, { pct: 55, dec: 0.55 },
  { pct: 65, dec: 0.65 }, { pct: 75, dec: 0.75 }, { pct: 85, dec: 0.85 },
  { pct: 95, dec: 0.95 }
];

var _PERCENT_FRAC_VALS = [
  { num: 1, den: 2,  pct: 50 },
  { num: 1, den: 4,  pct: 25 }, { num: 3, den: 4,  pct: 75 },
  { num: 1, den: 5,  pct: 20 }, { num: 2, den: 5,  pct: 40 },
  { num: 3, den: 5,  pct: 60 }, { num: 4, den: 5,  pct: 80 },
  { num: 1, den: 10, pct: 10 }, { num: 3, den: 10, pct: 30 },
  { num: 7, den: 10, pct: 70 }, { num: 9, den: 10, pct: 90 },
  { num: 1,  den: 20, pct: 5  }, { num: 3,  den: 20, pct: 15 },
  { num: 7,  den: 20, pct: 35 }, { num: 9,  den: 20, pct: 45 },
  { num: 11, den: 20, pct: 55 }, { num: 13, den: 20, pct: 65 },
  { num: 17, den: 20, pct: 85 }, { num: 19, den: 20, pct: 95 },
  { num: 1,  den: 25, pct: 4  }, { num: 2,  den: 25, pct: 8  },
  { num: 3,  den: 25, pct: 12 }, { num: 4,  den: 25, pct: 16 },
  { num: 6,  den: 25, pct: 24 }, { num: 7,  den: 25, pct: 28 },
  { num: 8,  den: 25, pct: 32 }, { num: 9,  den: 25, pct: 36 }
];

function _makePercentQuestions(subtype) {
  var questions = [];
  var doDec  = subtype === 'pct-to-dec'  || subtype === 'dec-to-pct'  || subtype === 'mixed';
  var doFrac = subtype === 'pct-to-frac' || subtype === 'frac-to-pct' || subtype === 'mixed';
  var doPctToDec  = subtype === 'pct-to-dec'  || subtype === 'mixed';
  var doDecToPct  = subtype === 'dec-to-pct'  || subtype === 'mixed';
  var doPctToFrac = subtype === 'pct-to-frac' || subtype === 'mixed';
  var doFracToPct = subtype === 'frac-to-pct' || subtype === 'mixed';

  if (doPctToDec) {
    _PERCENT_DEC_VALS.forEach(function(v) {
      questions.push({
        prompt:       v.pct + '% = ？',
        answerCount:  1,
        answerFormat: 'decimal',
        answer:       [v.dec],
        correctText:  String(v.dec)
      });
    });
  }

  if (doDecToPct) {
    _PERCENT_DEC_VALS.forEach(function(v) {
      questions.push({
        prompt:       v.dec + ' = ？%',
        answerCount:  1,
        answerFormat: 'integer',
        answer:       [v.pct],
        correctText:  v.pct + '%'
      });
    });
  }

  if (doPctToFrac) {
    _PERCENT_FRAC_VALS.forEach(function(v) {
      questions.push({
        prompt:       v.pct + '%',
        answerCount:  2,
        answerFormat: 'fraction',
        answer:       [v.num, v.den],
        pctValue:     v.pct,
        correctText:  v.num + '/' + v.den
      });
    });
  }

  if (doFracToPct) {
    _PERCENT_FRAC_VALS.forEach(function(v) {
      questions.push({
        prompt:      '？ /100 = ？%',
        answerCount: 2,
        fracDisplay: { num: v.num, den: v.den },
        answer:      [v.pct, v.pct],
        correctText: v.pct + '/100 = ' + v.pct + '%'
      });
    });
  }

  return questions;
}

// ════════════════════════════════════════
//  主入口
// ════════════════════════════════════════

function generateQuestionPool(category, subtype, difficulty) {
  var all = [];
  if      (category === 'length')  all = _makeLengthQuestions(subtype);
  else if (category === 'weight')  all = _makeWeightQuestions(subtype);
  else if (category === 'volume')  all = _makeVolumeQuestions(subtype);
  else if (category === 'time')    all = _makeTimeQuestions(subtype, difficulty);
  else if (category === 'money')   all = _makeMoneyQuestions(subtype, difficulty);
  else if (category === 'percent') all = _makePercentQuestions(subtype);
  return shuffle(all).slice(0, ROUND_SIZE);
}
