'use strict';

// ════════════════════════════════════════
//  度量衡資料
// ════════════════════════════════════════

var _PM_MS_CFG = {
  'mm-cm': { factor: 10,   largeLabel: '公分', smallLabel: '公釐' },
  'cm-m':  { factor: 100,  largeLabel: '公尺', smallLabel: '公分' },
  'm-km':  { factor: 1000, largeLabel: '公里', smallLabel: '公尺' },
  'g-kg':  { factor: 1000, largeLabel: '公斤', smallLabel: '公克' },
  'kg-t':  { factor: 1000, largeLabel: '公噸', smallLabel: '公斤' },
  'ml-l':  { factor: 1000, largeLabel: '公升', smallLabel: '毫升' }
};

var _PM_MS_VALS = {
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

// ════════════════════════════════════════
//  時間資料
// ════════════════════════════════════════

var _PM_TIME_EASY = {
  'day-hour': {
    lts: [{d:1,h:0},{d:1,h:6},{d:1,h:12},{d:2,h:0},{d:2,h:6},{d:3,h:0},{d:1,h:3},{d:2,h:3}],
    stl: [25,26,30,36,48,50,27,33]
  },
  'hour-min': {
    lts: [75,90,105,120,135,150,180,240],
    stl: [75,90,105,120,135,150,180,240]
  },
  'min-sec': {
    lts: [{m:1,s:0},{m:1,s:30},{m:2,s:0},{m:2,s:15},{m:3,s:0},{m:1,s:15},{m:1,s:45},{m:2,s:30}],
    stl: [75,90,100,105,120,130,150,180]
  }
};

var _PM_TIME_HARD_VALS = {
  'day-hour-minute':        [1530,1650,2000,2400,2880,1445,1500,2160,3000,4320],
  'hour-minute-second':     [3700,3661,4200,5400,7200,3750,5000,3601,7320,4500],
  'day-hour-minute-second': [86500,90000,100000,90061,172861,100260,95400,88261]
};

var _PM_TS_UNIT_LABEL  = { day:'日', hour:'時', minute:'分', second:'秒' };
var _PM_TS_UNIT_FACTOR = { day:24,   hour:60,   minute:60,   second:1    };

// ════════════════════════════════════════
//  貨幣資料
// ════════════════════════════════════════

var _PM_EXCHANGE_EASY = [
  {from:100,to:10,ans:10},{from:50,to:10,ans:5},{from:100,to:50,ans:2},
  {from:500,to:50,ans:10},{from:100,to:5,ans:20},{from:50,to:5,ans:10},
  {from:10,to:5,ans:2},{from:10,to:1,ans:10},{from:5,to:1,ans:5},{from:50,to:1,ans:50}
];

var _PM_EXCHANGE_HARD = [
  {from:1000,to:100,ans:10},{from:500,to:10,ans:50},{from:1000,to:50,ans:20},
  {from:200,to:10,ans:20},{from:500,to:100,ans:5},{from:1000,to:10,ans:100}
];

var _PM_CHANGE_BILL_EASY = [
  {count:10,coin:10,bill:100},{count:20,coin:10,bill:100},{count:30,coin:10,bill:100},
  {count:5,coin:10,bill:50},{count:10,coin:10,bill:50},{count:2,coin:50,bill:100},
  {count:4,coin:50,bill:100},{count:6,coin:50,bill:100},{count:10,coin:50,bill:500},
  {count:5,coin:100,bill:500},{count:10,coin:100,bill:1000}
];

var _PM_CHANGE_BILL_HARD = [
  {count:40,coin:10,bill:100},{count:25,coin:10,bill:50},{count:50,coin:10,bill:100},
  {count:20,coin:50,bill:1000},{count:15,coin:100,bill:500},{count:25,coin:100,bill:500},
  {count:50,coin:100,bill:1000}
];

// ════════════════════════════════════════
//  百分率資料
// ════════════════════════════════════════

var _PM_PCT_DEC_VALS = [
  {pct:10,dec:0.1},{pct:20,dec:0.2},{pct:30,dec:0.3},{pct:40,dec:0.4},{pct:50,dec:0.5},
  {pct:60,dec:0.6},{pct:70,dec:0.7},{pct:80,dec:0.8},{pct:90,dec:0.9},{pct:5,dec:0.05},
  {pct:15,dec:0.15},{pct:25,dec:0.25},{pct:35,dec:0.35},{pct:45,dec:0.45},{pct:55,dec:0.55},
  {pct:65,dec:0.65},{pct:75,dec:0.75},{pct:85,dec:0.85},{pct:95,dec:0.95}
];

var _PM_PCT_FRAC_VALS = [
  {num:1,den:2,pct:50},{num:1,den:4,pct:25},{num:3,den:4,pct:75},
  {num:1,den:5,pct:20},{num:2,den:5,pct:40},{num:3,den:5,pct:60},{num:4,den:5,pct:80},
  {num:1,den:10,pct:10},{num:3,den:10,pct:30},{num:7,den:10,pct:70},{num:9,den:10,pct:90},
  {num:1,den:20,pct:5},{num:3,den:20,pct:15},{num:7,den:20,pct:35},{num:9,den:20,pct:45},
  {num:11,den:20,pct:55},{num:13,den:20,pct:65},{num:17,den:20,pct:85},{num:19,den:20,pct:95},
  {num:1,den:25,pct:4},{num:2,den:25,pct:8},{num:3,den:25,pct:12},{num:4,den:25,pct:16},
  {num:6,den:25,pct:24},{num:7,den:25,pct:28},{num:8,den:25,pct:32},{num:9,den:25,pct:36}
];

// ════════════════════════════════════════
//  Helpers
// ════════════════════════════════════════

function _pmRand(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }

function _pmShuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

function _pmSample(arr, n) {
  return _pmShuffle(arr.slice()).slice(0, Math.min(n, arr.length));
}

function _pmBlank() {
  return '(　　　)';
}

function _pmFrac(top, bot) {
  return '<span class="pm-frac"><span class="pm-frac-top">' + top +
         '</span><span class="pm-frac-bot">' + bot + '</span></span>';
}

function _pmFracBlank() {
  return '(　　　)';
}

// ════════════════════════════════════════
//  Pool generators
// ════════════════════════════════════════

function _pmMeasurePool(pair, mode) {
  var cfg  = _PM_MS_CFG[pair];
  var vals = _PM_MS_VALS[pair];
  var pool = [];
  if (mode === 'merge') {
    vals.merge.forEach(function(v) {
      var total = v.l * cfg.factor + v.r;
      var label = v.l + cfg.largeLabel + (v.r > 0 ? v.r + cfg.smallLabel : '');
      pool.push({
        promptHtml: label + ' = ' + _pmBlank() + ' ' + cfg.smallLabel,
        answerText: total + cfg.smallLabel
      });
    });
  } else {
    vals.split.forEach(function(total) {
      var lv = Math.floor(total / cfg.factor);
      var rv = total % cfg.factor;
      if (rv === 0) {
        pool.push({
          promptHtml: total + cfg.smallLabel + ' = ' + _pmBlank() + ' ' + cfg.largeLabel,
          answerText: lv + cfg.largeLabel
        });
      } else {
        pool.push({
          promptHtml: total + cfg.smallLabel + ' = ' + _pmBlank() + ' ' + cfg.largeLabel + ' ' + _pmBlank() + ' ' + cfg.smallLabel,
          answerText: lv + cfg.largeLabel + rv + cfg.smallLabel
        });
      }
    });
  }
  return pool;
}

function _pmTimeEasyPool(pair, direction) {
  var factor = { 'day-hour': 24, 'hour-min': 60, 'min-sec': 60 }[pair];
  var lLabel = { 'day-hour': '日', 'hour-min': '時', 'min-sec': '分' }[pair];
  var sLabel = { 'day-hour': '時', 'hour-min': '分', 'min-sec': '秒' }[pair];
  var pool = [];

  if (direction === 'lts') {
    _PM_TIME_EASY[pair].lts.forEach(function(v) {
      var lv, sv, total, lbl;
      if (pair === 'hour-min') {
        total = v; lv = Math.floor(v / 60); sv = v % 60;
      } else {
        lv = v.d !== undefined ? v.d : v.m;
        sv = v.d !== undefined ? v.h : v.s;
        total = lv * factor + sv;
      }
      lbl = lv + lLabel + (sv > 0 ? sv + sLabel : '');
      pool.push({
        promptHtml: lbl + ' = ' + _pmBlank() + ' ' + sLabel,
        answerText: total + sLabel
      });
    });
  } else {
    _PM_TIME_EASY[pair].stl.forEach(function(total) {
      var lv = Math.floor(total / factor), sv = total % factor;
      pool.push({
        promptHtml: total + sLabel + ' = ' + _pmBlank() + ' ' + lLabel + ' ' + _pmBlank() + ' ' + sLabel,
        answerText: lv + lLabel + sv + sLabel
      });
    });
  }
  return pool;
}

function _pmGetChainFactors(chainUnits) {
  var factors = [];
  for (var i = 0; i < chainUnits.length; i++) {
    var f = 1;
    for (var j = i; j < chainUnits.length - 1; j++) {
      f *= _PM_TS_UNIT_FACTOR[chainUnits[j]];
    }
    factors.push(f);
  }
  return factors;
}

function _pmDecompose(total, chainUnits) {
  var factors = _pmGetChainFactors(chainUnits);
  var amounts = [], rem = total;
  for (var i = 0; i < chainUnits.length; i++) {
    var a = Math.floor(rem / factors[i]);
    amounts.push(a);
    rem -= a * factors[i];
  }
  return amounts;
}

function _pmTimeHardPool(chainKey, direction) {
  var chainUnits = chainKey.split('-');
  var labels     = chainUnits.map(function(u) { return _PM_TS_UNIT_LABEL[u]; });
  var sLabel     = labels[labels.length - 1];
  var rawVals    = _PM_TIME_HARD_VALS[chainKey] || [];
  var pool = [];

  rawVals.forEach(function(total) {
    var amounts = _pmDecompose(total, chainUnits);
    if (direction === 'lts') {
      var lbl = '';
      for (var i = 0; i < chainUnits.length - 1; i++) lbl += amounts[i] + labels[i];
      pool.push({
        promptHtml: lbl + ' = ' + _pmBlank() + ' ' + sLabel,
        answerText: total + sLabel
      });
    } else {
      var q = total + sLabel + ' = ', ans = '';
      for (var i = 0; i < chainUnits.length; i++) {
        q   += _pmBlank() + ' ' + labels[i] + ' ';
        ans += amounts[i] + labels[i];
      }
      pool.push({ promptHtml: q.trim(), answerText: ans });
    }
  });
  return pool;
}

function _pmMoneyExchangePool(difficulty) {
  var items = difficulty === 'easy'
    ? _PM_EXCHANGE_EASY
    : _PM_EXCHANGE_HARD.concat(_PM_EXCHANGE_EASY);
  return items.map(function(p) {
    return {
      promptHtml: p.from + ' 元 = ' + _pmBlank() + ' 個 ' + p.to + ' 元',
      answerText: p.ans + ' 個'
    };
  });
}

function _pmMoneyChangeBillPool(difficulty) {
  var items = difficulty === 'easy' ? _PM_CHANGE_BILL_EASY : _PM_CHANGE_BILL_HARD;
  return items.map(function(item) {
    var ans = (item.count * item.coin) / item.bill;
    return {
      promptHtml: item.count + ' 個 ' + item.coin + ' 元，可以換 ' + _pmBlank() + ' 張 ' + item.bill + ' 元',
      answerText: ans + ' 張'
    };
  });
}

function _pmPctToDecPool() {
  return _PM_PCT_DEC_VALS.map(function(v) {
    return { promptHtml: v.pct + '% = ' + _pmBlank(), answerText: String(v.dec) };
  });
}

function _pmDecToPctPool() {
  return _PM_PCT_DEC_VALS.map(function(v) {
    return { promptHtml: v.dec + ' = ' + _pmBlank() + ' %', answerText: v.pct + '%' };
  });
}

function _pmPctToFracPool() {
  return _PM_PCT_FRAC_VALS.map(function(v) {
    return {
      promptHtml: v.pct + '% = ' + _pmFrac(_pmFracBlank(), _pmFracBlank()),
      answerText: v.num + '/' + v.den
    };
  });
}

function _pmFracToPctPool() {
  return _PM_PCT_FRAC_VALS.map(function(v) {
    return {
      promptHtml: _pmFrac(v.num, v.den) + ' = ' + _pmFrac(_pmFracBlank(), '100') + ' = ' + _pmBlank() + ' %',
      answerText: v.pct + '/100 = ' + v.pct + '%'
    };
  });
}

// ── 主分派 ──

function getPrintPool(subtypeId) {
  var msPairs = ['mm-cm','cm-m','m-km','g-kg','kg-t','ml-l'];
  for (var i = 0; i < msPairs.length; i++) {
    if (subtypeId === msPairs[i] + '-merge') return _pmMeasurePool(msPairs[i], 'merge');
    if (subtypeId === msPairs[i] + '-split') return _pmMeasurePool(msPairs[i], 'split');
  }
  var easyPairs = ['day-hour','hour-min','min-sec'];
  for (var j = 0; j < easyPairs.length; j++) {
    if (subtypeId === easyPairs[j] + '-easy-lts') return _pmTimeEasyPool(easyPairs[j], 'lts');
    if (subtypeId === easyPairs[j] + '-easy-stl') return _pmTimeEasyPool(easyPairs[j], 'stl');
  }
  var hardChains = ['day-hour-minute','hour-minute-second','day-hour-minute-second'];
  for (var k = 0; k < hardChains.length; k++) {
    if (subtypeId === hardChains[k] + '-hard-lts') return _pmTimeHardPool(hardChains[k], 'lts');
    if (subtypeId === hardChains[k] + '-hard-stl') return _pmTimeHardPool(hardChains[k], 'stl');
  }
  if (subtypeId === 'exchange-easy')    return _pmMoneyExchangePool('easy');
  if (subtypeId === 'exchange-hard')    return _pmMoneyExchangePool('hard');
  if (subtypeId === 'change-bill-easy') return _pmMoneyChangeBillPool('easy');
  if (subtypeId === 'change-bill-hard') return _pmMoneyChangeBillPool('hard');
  if (subtypeId === 'pct-to-dec')       return _pmPctToDecPool();
  if (subtypeId === 'dec-to-pct')       return _pmDecToPctPool();
  if (subtypeId === 'pct-to-frac')      return _pmPctToFracPool();
  if (subtypeId === 'frac-to-pct')      return _pmFracToPctPool();
  return [];
}

// ════════════════════════════════════════
//  Category 定義
// ════════════════════════════════════════

var PM_CATEGORIES = [
  {
    id: 'length', label: '📏 長度換算',
    subtypes: [
      { id: 'mm-cm-merge', label: '公釐 ↔ 公分　大→小', pool: 14 },
      { id: 'mm-cm-split', label: '公釐 ↔ 公分　小→大', pool: 13 },
      { id: 'cm-m-merge',  label: '公分 ↔ 公尺　大→小', pool: 14 },
      { id: 'cm-m-split',  label: '公分 ↔ 公尺　小→大', pool: 13 },
      { id: 'm-km-merge',  label: '公尺 ↔ 公里　大→小', pool: 14 },
      { id: 'm-km-split',  label: '公尺 ↔ 公里　小→大', pool: 13 }
    ]
  },
  {
    id: 'weight', label: '⚖️ 重量換算',
    subtypes: [
      { id: 'g-kg-merge',  label: '公克 ↔ 公斤　大→小', pool: 14 },
      { id: 'g-kg-split',  label: '公克 ↔ 公斤　小→大', pool: 14 },
      { id: 'kg-t-merge',  label: '公斤 ↔ 公噸　大→小', pool: 14 },
      { id: 'kg-t-split',  label: '公斤 ↔ 公噸　小→大', pool: 13 }
    ]
  },
  {
    id: 'volume', label: '🧪 容量換算',
    subtypes: [
      { id: 'ml-l-merge', label: '毫升 ↔ 公升　大→小', pool: 14 },
      { id: 'ml-l-split', label: '毫升 ↔ 公升　小→大', pool: 13 }
    ]
  },
  {
    id: 'time', label: '⏰ 時間換算',
    subtypes: [
      { id: 'day-hour-easy-lts',               label: '日 ↔ 時　易・大→小',   pool: 8  },
      { id: 'day-hour-easy-stl',               label: '日 ↔ 時　易・小→大',   pool: 8  },
      { id: 'hour-min-easy-lts',               label: '時 ↔ 分　易・大→小',   pool: 8  },
      { id: 'hour-min-easy-stl',               label: '時 ↔ 分　易・小→大',   pool: 8  },
      { id: 'min-sec-easy-lts',                label: '分 ↔ 秒　易・大→小',   pool: 8  },
      { id: 'min-sec-easy-stl',                label: '分 ↔ 秒　易・小→大',   pool: 8  },
      { id: 'day-hour-minute-hard-lts',        label: '日時分　難・大→小',     pool: 10 },
      { id: 'day-hour-minute-hard-stl',        label: '日時分　難・小→大',     pool: 10 },
      { id: 'hour-minute-second-hard-lts',     label: '時分秒　難・大→小',     pool: 10 },
      { id: 'hour-minute-second-hard-stl',     label: '時分秒　難・小→大',     pool: 10 },
      { id: 'day-hour-minute-second-hard-lts', label: '日時分秒　難・大→小',   pool: 8  },
      { id: 'day-hour-minute-second-hard-stl', label: '日時分秒　難・小→大',   pool: 8  }
    ]
  },
  {
    id: 'money', label: '💰 貨幣換算',
    subtypes: [
      { id: 'exchange-easy',    label: '面額換算　易', pool: 10 },
      { id: 'exchange-hard',    label: '面額換算　難', pool: 16 },
      { id: 'change-bill-easy', label: '零錢換鈔　易', pool: 11 },
      { id: 'change-bill-hard', label: '零錢換鈔　難', pool: 7  }
    ]
  },
  {
    id: 'percent', label: '📊 百分率換算',
    subtypes: [
      { id: 'pct-to-dec',  label: '百分率 → 小數', pool: 19 },
      { id: 'dec-to-pct',  label: '小數 → 百分率', pool: 19 },
      { id: 'pct-to-frac', label: '百分率 → 分數', pool: 27 },
      { id: 'frac-to-pct', label: '分數 → 百分率', pool: 27 }
    ]
  }
];

// ════════════════════════════════════════
//  UI 初始化
// ════════════════════════════════════════

function initPrintMathUI() {
  var container = document.getElementById('print-math-categories');
  if (!container) return;
  var html = '';
  PM_CATEGORIES.forEach(function(cat) {
    html += '<div style="padding:14px 16px;border-bottom:1px solid var(--border)">';
    html += '<div style="font-size:.8rem;font-weight:900;color:var(--blue);margin-bottom:10px">' + cat.label + '</div>';
    html += '<div style="display:grid;gap:7px">';
    cat.subtypes.forEach(function(st) {
      html += '<div style="display:flex;align-items:center;gap:10px">';
      html += '<span style="font-size:.79rem;font-weight:800;color:var(--muted);flex:1">' + st.label + '</span>';
      html += '<input class="pm-count-input" id="pm-count-' + st.id + '" type="number" min="0" value="0">';
      html += '<span style="font-size:.79rem;color:var(--muted);font-weight:700">題</span>';
      html += '</div>';
    });
    html += '</div></div>';
  });
  container.innerHTML = html;
}

// ════════════════════════════════════════
//  生成 & 列印
// ════════════════════════════════════════

var _pmQuestions      = null;
var _pmCurrentTitle   = '練習題';
var _pmCurrentCalcSpace = false;

function _pmFinishGenerate(questions, statusId, printBtnsId) {
  var statusEl  = document.getElementById(statusId);
  var printBtns = document.getElementById(printBtnsId);
  if (questions.length === 0) {
    if (statusEl)  statusEl.textContent = '⚠️ 請至少設定一個題型的題數';
    if (printBtns) printBtns.style.display = 'none';
    _pmQuestions = null;
    return;
  }
  _pmQuestions = questions;
  if (statusEl)  statusEl.textContent = '✅ 已生成 ' + questions.length + ' 題';
  if (printBtns) printBtns.style.display = 'flex';
}

function generatePrintQuestions() {
  var el = document.getElementById('pm-sheet-title');
  _pmCurrentTitle = (el && el.value.trim()) ? el.value.trim() : '換算趣練習題';
  var cb = document.getElementById('pm-math-calc-space');
  _pmCurrentCalcSpace = cb ? cb.checked : false;

  var questions = [];
  PM_CATEGORIES.forEach(function(cat) {
    cat.subtypes.forEach(function(st) {
      var count = _pmReadCount('pm-count-' + st.id);
      if (count <= 0) return;
      var sampled = _pmSample(getPrintPool(st.id), count);
      sampled.forEach(function(q) {
        questions.push({ num: questions.length + 1, promptHtml: q.promptHtml, answerText: q.answerText });
      });
    });
  });
  _pmFinishGenerate(questions, 'print-math-status', 'print-math-print-btns');
}

// ── 列印 CSS ──

var _PM_BASE_CSS = [
  '* { margin:0; padding:0; box-sizing:border-box; }',
  'body { font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif; padding:12mm 16mm; font-size:13pt; color:#111; }',
  '.pm-frac { display:inline-flex; flex-direction:column; align-items:center; vertical-align:middle; margin:0 2px; line-height:1.3; }',
  '.pm-frac-top { border-bottom:1.5px solid #111; padding:0 4px; min-width:3em; text-align:center; }',
  '.pm-frac-bot { padding:0 4px; min-width:3em; text-align:center; }',
  '.pm-blank, .pm-fblank { }'
].join('\n');

var _PM_Q_CSS_WITHSPACE = [
  '@page { size: A4; margin: 12mm 16mm; }',
  '* { margin:0; padding:0; box-sizing:border-box; }',
  'body { font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif; color:#111; }',
  '.pm-frac { display:inline-flex; flex-direction:column; align-items:center; vertical-align:middle; margin:0 2px; line-height:1.3; }',
  '.pm-frac-top { border-bottom:1.5px solid #111; padding:0 4px; min-width:2.5em; text-align:center; }',
  '.pm-frac-bot { padding:0 4px; min-width:2.5em; text-align:center; }',
  '.question-page { height:273mm; display:flex; flex-direction:column; page-break-after:always; }',
  '.question-page:last-child { page-break-after:auto; }',
  '.sheet-header { border-bottom:2px solid #111; padding-bottom:5px; margin-bottom:5mm; flex-shrink:0; }',
  '.sheet-title { font-size:15pt; font-weight:900; margin-bottom:6px; }',
  '.header-fields { display:flex; gap:56px; }',
  '.header-field { font-size:10pt; font-weight:700; display:flex; align-items:center; gap:5px; }',
  '.question-grid { flex:1; display:grid; grid-template-columns:1fr 1fr; grid-template-rows:repeat(4,1fr); gap:3mm 6mm; }',
  '.question-item { border:1.5px solid #bbb; border-radius:5px; padding:3mm; display:flex; flex-direction:column; overflow:hidden; }',
  '.q-prompt { display:flex; align-items:center; gap:6px; font-weight:600; font-size:12pt; flex-shrink:0; flex-wrap:wrap; }',
  '.q-num { font-family:"Courier New",monospace; font-weight:900; min-width:2em; color:#555; flex-shrink:0; }',
  '.q-calc-area { flex:1; margin-top:3mm; border:1px dashed #ccc; border-radius:3px; }'
].join('\n');

var _PM_Q_CSS_NOSPACE = [
  '@page { size: A4; margin: 12mm 16mm; }',
  '* { margin:0; padding:0; box-sizing:border-box; }',
  'body { font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif; padding:12mm 16mm; color:#111; }',
  '.pm-frac { display:inline-flex; flex-direction:column; align-items:center; vertical-align:middle; margin:0 2px; line-height:1.3; }',
  '.pm-frac-top { border-bottom:1.5px solid #111; padding:0 4px; min-width:2.5em; text-align:center; }',
  '.pm-frac-bot { padding:0 4px; min-width:2.5em; text-align:center; }',
  '.sheet-header { border-bottom:2px solid #111; padding-bottom:5px; margin-bottom:5mm; }',
  '.sheet-title { font-size:15pt; font-weight:900; margin-bottom:6px; }',
  '.header-fields { display:flex; gap:56px; }',
  '.header-field { font-size:10pt; font-weight:700; display:flex; align-items:center; gap:5px; }',
  '.question-grid { display:grid; grid-template-columns:1fr 1fr; gap:2mm 6mm; }',
  '.question-item { border:1.5px solid #bbb; border-radius:5px; padding:3mm 4mm; display:flex; align-items:center; gap:6px; min-height:10mm; }',
  '.q-prompt { display:flex; align-items:center; gap:6px; font-weight:600; font-size:12pt; flex-wrap:wrap; }',
  '.q-num { font-family:"Courier New",monospace; font-weight:900; min-width:2em; color:#555; flex-shrink:0; }'
].join('\n');

var _PM_A_CSS = _PM_BASE_CSS + '\n' + [
  '.sheet-title { font-size:15pt; font-weight:900; margin-bottom:14px; padding-bottom:8px; border-bottom:2px solid #111; }',
  '.answer-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:6px 16px; }',
  '.answer-item { display:flex; align-items:center; gap:6px; padding:5px 0; border-bottom:1px dashed #ddd; }',
  '.a-num { font-family:"Courier New",monospace; font-weight:900; color:#666; min-width:2em; font-size:9.5pt; flex-shrink:0; }',
  '.a-text { color:#1d4ed8; font-weight:900; font-size:10pt; }'
].join('\n');

var _PA_Q_CSS = [
  '@page { size: A4; margin: 12mm 16mm; }',
  '* { margin:0; padding:0; box-sizing:border-box; }',
  'body { font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif; color:#111; }',
  '.question-page { height:273mm; display:flex; flex-direction:column; page-break-after:always; }',
  '.question-page:last-child { page-break-after:auto; }',
  '.sheet-header { border-bottom:2px solid #111; padding-bottom:5px; margin-bottom:5mm; flex-shrink:0; }',
  '.sheet-title { font-size:15pt; font-weight:900; margin-bottom:6px; }',
  '.header-fields { display:flex; gap:56px; }',
  '.header-field { font-size:10pt; font-weight:700; display:flex; align-items:center; gap:5px; }',
  '.field-line { display:inline-block; border-bottom:1.5px solid #111; width:72px; }',
  '.question-grid { flex:1; display:grid; grid-template-columns:1fr 1fr; grid-template-rows:repeat(4,1fr); gap:3mm 6mm; }',
  '.question-item { border:1.5px solid #bbb; border-radius:5px; padding:3mm; display:flex; flex-direction:column; overflow:hidden; }',
  '.q-prompt { display:flex; align-items:center; gap:6px; font-weight:600; font-size:13pt; flex-shrink:0; }',
  '.q-num { font-family:"Courier New",monospace; font-weight:900; min-width:2em; color:#555; flex-shrink:0; }',
  '.q-calc-area { flex:1; margin-top:3mm; border:1px dashed #ccc; border-radius:3px; position:relative; }',
  '.q-calc-label { position:absolute; top:2px; right:5px; font-size:6pt; color:#ccc; font-weight:900; letter-spacing:1px; }'
].join('\n');

function printArithmeticSheet(type) {
  if (!_pmQuestions) return;
  var title = _pmCurrentTitle;
  var html;

  if (type === 'question') {
    html  = '<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8">';
    html += '<title>' + title + '</title><style>' + _PA_Q_CSS + '</style></head><body>';
    var PER_PAGE = 8;
    for (var start = 0; start < _pmQuestions.length; start += PER_PAGE) {
      var pageQs = _pmQuestions.slice(start, start + PER_PAGE);
      var isLast = start + PER_PAGE >= _pmQuestions.length;
      html += '<div class="question-page' + (isLast ? ' question-page-last' : '') + '">';
      html += '<div class="sheet-header"><div class="sheet-title">' + title + '</div>';
      html += '<div class="header-fields">';
      html += '<div class="header-field">班級：</div>';
      html += '<div class="header-field">姓名：</div>';
      html += '</div></div>';
      html += '<div class="question-grid">';
      pageQs.forEach(function(q) {
        html += '<div class="question-item">';
        html += '<div class="q-prompt"><span class="q-num">' + q.num + '.</span><span>' + q.promptHtml + '</span></div>';
        html += '<div class="q-calc-area"><span class="q-calc-label">直式</span></div>';
        html += '</div>';
      });
      html += '</div></div>';
    }
    html += '</body></html>';
  } else {
    html  = '<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8">';
    html += '<title>' + title + '【解答】</title><style>' + _PM_A_CSS + '</style></head><body>';
    html += '<div class="sheet-title">' + title + '【解答】</div>';
    html += '<div class="answer-grid">';
    _pmQuestions.forEach(function(q) {
      html += '<div class="answer-item"><span class="a-num">' + q.num + '.</span><span class="a-text">' + q.answerText + '</span></div>';
    });
    html += '</div></body></html>';
  }

  var win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(function() { win.print(); }, 400);
}

function printMathSheet(type) {
  if (!_pmQuestions) return;
  var title = _pmCurrentTitle;
  var html;

  if (type === 'question') {
    if (_pmCurrentCalcSpace) {
      html  = '<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8">';
      html += '<title>' + title + '</title><style>' + _PM_Q_CSS_WITHSPACE + '</style></head><body>';
      var PER_PAGE = 8;
      for (var start = 0; start < _pmQuestions.length; start += PER_PAGE) {
        var pageQs = _pmQuestions.slice(start, start + PER_PAGE);
        var isLast = start + PER_PAGE >= _pmQuestions.length;
        html += '<div class="question-page' + (isLast ? ' question-page-last' : '') + '">';
        html += '<div class="sheet-header"><div class="sheet-title">' + title + '</div>';
        html += '<div class="header-fields"><div class="header-field">班級：</div><div class="header-field">姓名：</div></div></div>';
        html += '<div class="question-grid">';
        pageQs.forEach(function(q) {
          html += '<div class="question-item">';
          html += '<div class="q-prompt"><span class="q-num">' + q.num + '.</span><span>' + q.promptHtml + '</span></div>';
          html += '<div class="q-calc-area"></div>';
          html += '</div>';
        });
        html += '</div></div>';
      }
      html += '</body></html>';
    } else {
      html  = '<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8">';
      html += '<title>' + title + '</title><style>' + _PM_Q_CSS_NOSPACE + '</style></head><body>';
      html += '<div class="sheet-header"><div class="sheet-title">' + title + '</div>';
      html += '<div class="header-fields"><div class="header-field">班級：</div><div class="header-field">姓名：</div></div></div>';
      html += '<div class="question-grid">';
      _pmQuestions.forEach(function(q) {
        html += '<div class="question-item">';
        html += '<div class="q-prompt"><span class="q-num">' + q.num + '.</span><span>' + q.promptHtml + '</span></div>';
        html += '</div>';
      });
      html += '</div></body></html>';
    }
  } else {
    html  = '<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8">';
    html += '<title>' + title + '【解答】</title><style>' + _PM_A_CSS + '</style></head><body>';
    html += '<div class="sheet-title">' + title + '【解答】</div>';
    html += '<div class="answer-grid">';
    _pmQuestions.forEach(function(q) {
      html += '<div class="answer-item"><span class="a-num">' + q.num + '.</span><span class="a-text">' + q.answerText + '</span></div>';
    });
    html += '</div></body></html>';
  }

  var win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(function() { win.print(); }, 400);
}

// ── View 切換（共用） ──

var _PM_SUB_VIEWS = ['math', 'fractions', 'transpose', 'arithmetic'];

function openPrintSubView(viewId) {
  document.getElementById('print-main-view').style.display = 'none';
  _PM_SUB_VIEWS.forEach(function(id) {
    var el = document.getElementById('print-' + id + '-view');
    if (el) el.style.display = id === viewId ? '' : 'none';
  });
}

function closePrintSubView() {
  _PM_SUB_VIEWS.forEach(function(id) {
    var el = document.getElementById('print-' + id + '-view');
    if (el) el.style.display = 'none';
  });
  document.getElementById('print-main-view').style.display = '';
}

function openPrintMathView() { openPrintSubView('math'); }
function closePrintMathView() { closePrintSubView(); }

// Auto-init
document.addEventListener('DOMContentLoaded', function() {
  initPrintMathUI();
  _pmBuildModuleRows('pm-fractions-rows', PM_FRACTIONS_MODULES, 'pmf');
  _pmBuildModuleRows('pm-transpose-rows', PM_TRANSPOSE_MODULES, 'pmt');
});

// ════════════════════════════════════════
//  分數趣
// ════════════════════════════════════════

function _pmGcd(a, b) { return b === 0 ? a : _pmGcd(b, a % b); }
function _pmSimplifyFrac(n, d) { var g = _pmGcd(Math.abs(n), Math.abs(d)); return { n: n / g, d: d / g }; }

function _pmExpandQ() {
  var b, a, att = 0;
  do { b = _pmRand(2, 10); a = _pmRand(1, b - 1); att++; }
  while (_pmGcd(a, b) > 1 && att < 30);
  var k = _pmRand(2, 9);
  if (Math.random() < 0.5) {
    return { promptHtml: _pmFrac(a, b) + ' = ' + _pmFrac(_pmFracBlank(), b * k), answerText: String(a * k) };
  } else {
    return { promptHtml: _pmFrac(a, b) + ' = ' + _pmFrac(a * k, _pmFracBlank()), answerText: String(b * k) };
  }
}

function _pmReduceQ() {
  var b, a, k, r, att = 0;
  do {
    b = _pmRand(2, 8); a = _pmRand(1, b - 1);
    while (_pmGcd(a, b) > 1) { var g = _pmGcd(a, b); a = a / g; b = b / g; }
    k = _pmRand(2, 9);
    r = _pmSimplifyFrac(a * k, b * k);
    att++;
  } while ((r.d === 1 || a * k > 80 || b * k > 80) && att < 60);
  return {
    promptHtml: _pmFrac(a * k, b * k) + ' = ' + _pmFrac(_pmFracBlank(), _pmFracBlank()),
    answerText: a + '/' + b
  };
}

function _pmImp2MixQ() {
  var d = _pmRand(2, 9), ip = _pmRand(1, 9), rem = _pmRand(1, d - 1);
  return {
    promptHtml: _pmFrac(ip * d + rem, d) + ' = ' + _pmBlank() + ' ' + _pmFrac(_pmFracBlank(), d),
    answerText: ip + ' ' + rem + '/' + d
  };
}

function _pmMix2ImpQ() {
  var d = _pmRand(2, 9), ip = _pmRand(1, 9), rem = _pmRand(1, d - 1);
  return {
    promptHtml: ip + ' ' + _pmFrac(rem, d) + ' = ' + _pmFrac(_pmFracBlank(), d),
    answerText: (ip * d + rem) + '/' + d
  };
}

var PM_FRACTIONS_MODULES = [
  { id: 'expand',  label: '🔼 擴分',           example: '3/5 = (　)/15' },
  { id: 'reduce',  label: '🔽 約分',           example: '12/20 = (　)/(　)' },
  { id: 'imp2mix', label: '假分數 → 帶分數',    example: '7/3 = (　) (　)/3' },
  { id: 'mix2imp', label: '帶分數 → 假分數',    example: '2 1/3 = (　)/3' }
];

function generateFractionsQuestions() {
  var el = document.getElementById('pm-fractions-title');
  _pmCurrentTitle = (el && el.value.trim()) ? el.value.trim() : '分數趣練習題';
  var cb = document.getElementById('pm-fractions-calc-space');
  _pmCurrentCalcSpace = cb ? cb.checked : false;
  var fns = { expand: _pmExpandQ, reduce: _pmReduceQ, imp2mix: _pmImp2MixQ, mix2imp: _pmMix2ImpQ };
  var questions = [];
  PM_FRACTIONS_MODULES.forEach(function(m) {
    var count = _pmReadCount('pmf-count-' + m.id);
    if (!count) return;
    for (var i = 0; i < count; i++) {
      var q = fns[m.id]();
      if (q) questions.push({ num: questions.length + 1, promptHtml: q.promptHtml, answerText: q.answerText });
    }
  });
  _pmFinishGenerate(questions, 'pm-fractions-status', 'pm-fractions-print-btns');
}

// ════════════════════════════════════════
//  移項趣
// ════════════════════════════════════════

function _pmTransposeAddSubQ() {
  var unknown, termValue, termSign, lhs, tries = 0;
  do {
    unknown   = _pmRand(1, 15);
    termValue = _pmRand(1, 10);
    termSign  = Math.random() < 0.5 ? '+' : '−';
    lhs       = termSign === '+' ? unknown + termValue : unknown - termValue;
    tries++;
  } while ((lhs < 1 || lhs > 20) && tries < 50);
  return {
    promptHtml: '□ ' + termSign + ' ' + termValue + ' = ' + lhs + '，□ = ' + _pmBlank(),
    answerText: String(unknown)
  };
}

function _pmTransposeMulDivQ() {
  if (Math.random() < 0.5) {
    var unknown, termValue, lhs, tries = 0;
    do { unknown = _pmRand(1, 10); termValue = _pmRand(2, 9); lhs = unknown * termValue; tries++; }
    while (lhs > 20 && tries < 50);
    return {
      promptHtml: '□ × ' + termValue + ' = ' + lhs + '，□ = ' + _pmBlank(),
      answerText: String(unknown)
    };
  } else {
    var pairs = [];
    for (var lv = 1; lv <= 10; lv++) {
      for (var bv = 2; bv <= 9; bv++) {
        var u = lv * bv;
        if (u <= 20) pairs.push({ lhs: lv, tv: bv, unknown: u });
      }
    }
    var p = pairs[_pmRand(0, pairs.length - 1)];
    return {
      promptHtml: '□ ÷ ' + p.tv + ' = ' + p.lhs + '，□ = ' + _pmBlank(),
      answerText: String(p.unknown)
    };
  }
}

var PM_TRANSPOSE_MODULES = [
  { id: 'addSub', label: '➕ 加減移項', example: '□ + 3 = 7，□ = (　)' },
  { id: 'mulDiv', label: '✖️ 乘除移項', example: '□ × 3 = 12，□ = (　)' }
];

function generateTransposeQuestions() {
  var el = document.getElementById('pm-transpose-title');
  _pmCurrentTitle = (el && el.value.trim()) ? el.value.trim() : '移項趣練習題';
  var cb = document.getElementById('pm-transpose-calc-space');
  _pmCurrentCalcSpace = cb ? cb.checked : false;
  var fns = { addSub: _pmTransposeAddSubQ, mulDiv: _pmTransposeMulDivQ };
  var questions = [];
  PM_TRANSPOSE_MODULES.forEach(function(m) {
    var count = _pmReadCount('pmt-count-' + m.id);
    if (!count) return;
    for (var i = 0; i < count; i++) {
      var q = fns[m.id]();
      if (q) questions.push({ num: questions.length + 1, promptHtml: q.promptHtml, answerText: q.answerText });
    }
  });
  _pmFinishGenerate(questions, 'pm-transpose-status', 'pm-transpose-print-btns');
}

// ════════════════════════════════════════
//  四則運算
// ════════════════════════════════════════

function _pmDigitRange(d) {
  if (d === 1) return { lo: 1, hi: 9 };
  if (d === 2) return { lo: 10, hi: 99 };
  return { lo: 100, hi: 999 };
}

function _pmAddHasCarry(a, b) {
  var aD = String(a).split('').map(Number).reverse();
  var bD = String(b).split('').map(Number).reverse();
  var carry = 0, len = Math.max(aD.length, bD.length);
  for (var i = 0; i < len; i++) {
    var s = (aD[i] || 0) + (bD[i] || 0) + carry;
    if (s >= 10) return true;
    carry = 0;
  }
  return false;
}

function _pmSubHasBorrow(a, b) {
  var aD = String(a).split('').map(Number).reverse();
  var bD = String(b).split('').map(Number).reverse();
  var borrow = 0;
  for (var i = 0; i < aD.length; i++) {
    var d = aD[i] - (bD[i] || 0) - borrow;
    if (d < 0) return true;
    borrow = 0;
  }
  return false;
}

function _pmMulHasCarry(a, b) {
  var aD = String(a).split('').map(Number).reverse();
  var bD = String(b).split('').map(Number).reverse();
  var cols = new Array(aD.length + bD.length).fill(0);
  for (var bi = 0; bi < bD.length; bi++)
    for (var ai = 0; ai < aD.length; ai++)
      cols[ai + bi] += aD[ai] * bD[bi];
  for (var ci = 0; ci < cols.length; ci++) if (cols[ci] >= 10) return true;
  return false;
}

function _pmArithAddPool(augendD, addendD, carry, count) {
  var ar = _pmDigitRange(augendD), br = _pmDigitRange(addendD);
  var bList = [], bv;
  for (bv = br.lo; bv <= br.hi; bv++) bList.push(bv);
  _pmShuffle(bList);
  var pool = [], MAX = 150;
  for (var i = 0; i < count; i++) {
    var b = bList[i % bList.length], a, ok, t = 0;
    do {
      a = _pmRand(ar.lo, ar.hi);
      var c = _pmAddHasCarry(a, b);
      ok = carry === 'mix' || (carry === 'yes' ? c : !c);
      t++;
    } while (!ok && t < MAX);
    pool.push({ promptHtml: a + ' + ' + b + ' = ' + _pmBlank(), answerText: String(a + b) });
  }
  return pool;
}

function _pmArithSubPool(minuendD, subtrahendD, borrow, count) {
  var ar = _pmDigitRange(minuendD), br = _pmDigitRange(subtrahendD);
  var bList = [], bv;
  for (bv = br.lo; bv <= br.hi; bv++) bList.push(bv);
  _pmShuffle(bList);
  var pool = [], MAX = 150;
  for (var i = 0; i < count; i++) {
    var b = bList[i % bList.length];
    var aLo = Math.min(Math.max(ar.lo, b), ar.hi);
    var a, ok, t = 0;
    do {
      a = _pmRand(aLo, ar.hi);
      var bw = _pmSubHasBorrow(a, b);
      ok = borrow === 'mix' || (borrow === 'yes' ? bw : !bw);
      t++;
    } while (!ok && t < MAX);
    if (a < b) a = b;
    pool.push({ promptHtml: a + ' − ' + b + ' = ' + _pmBlank(), answerText: String(a - b) });
  }
  return pool;
}

function _pmArithMulPool(multiplicandD, multiplierD, carry, count) {
  var ar = _pmDigitRange(multiplicandD), br = _pmDigitRange(multiplierD);
  var bList = [], bv;
  for (bv = br.lo; bv <= br.hi; bv++) bList.push(bv);
  _pmShuffle(bList);
  var pool = [], MAX = 150;
  for (var i = 0; i < count; i++) {
    var b = bList[i % bList.length], a, ok, t = 0;
    do {
      a = _pmRand(ar.lo, ar.hi);
      var c = _pmMulHasCarry(a, b);
      ok = carry === 'mix' || (carry === 'yes' ? c : !c);
      t++;
    } while (!ok && t < MAX);
    pool.push({ promptHtml: a + ' × ' + b + ' = ' + _pmBlank(), answerText: String(a * b) });
  }
  return pool;
}

function _pmArithDivPool(dividendD, divisorD, remainder, count) {
  var ar = _pmDigitRange(dividendD), br = _pmDigitRange(divisorD);
  var pool = [], MAX = 300;
  for (var i = 0; i < count; i++) {
    var wantRem = remainder === 'mix' ? Math.random() < 0.5 : remainder === 'yes';
    var a, b, ok, tries = 0;
    do {
      b = _pmRand(Math.max(br.lo, 2), br.hi);
      a = _pmRand(Math.max(ar.lo, b), ar.hi);
      ok = wantRem ? a % b !== 0 : a % b === 0;
      tries++;
    } while (!ok && tries < MAX);
    if (!ok) {
      b = Math.max(br.lo, 2);
      if (wantRem) {
        a = ar.lo; while (a <= ar.hi && a % b === 0) a++;
        if (a > ar.hi) a = ar.lo + 1;
      } else {
        a = b * Math.ceil(ar.lo / b);
        if (a > ar.hi) a = b;
      }
    }
    var qt = Math.floor(a / b), r = a % b;
    var prompt = r === 0
      ? a + ' ÷ ' + b + ' = ' + _pmBlank()
      : a + ' ÷ ' + b + ' = ' + _pmBlank() + ' … ' + _pmBlank();
    pool.push({ promptHtml: prompt, answerText: r === 0 ? String(qt) : qt + ' 餘 ' + r });
  }
  return pool;
}

function paToggleOp() {
  ['add', 'sub', 'mul', 'div'].forEach(function(op) {
    var on = document.getElementById('pa-op-' + op).checked;
    document.getElementById('pa-section-' + op).style.display = on ? '' : 'none';
  });
}

function generateArithmeticQuestions() {
  var el = document.getElementById('pa-title');
  _pmCurrentTitle = (el && el.value.trim()) ? el.value.trim() : '四則運算練習題';
  var questions = [];

  function push(pool) {
    pool.forEach(function(q) {
      questions.push({ num: questions.length + 1, promptHtml: q.promptHtml, answerText: q.answerText });
    });
  }
  function getR(name) { var n = document.querySelector('input[name="' + name + '"]:checked'); return n ? n.value : '1'; }
  function getN(id) { return parseInt(document.getElementById(id).value) || 0; }

  if (document.getElementById('pa-op-add').checked) {
    var cnt = getN('pa-add-count');
    if (cnt) push(_pmArithAddPool(+getR('pa-add-augend'), +getR('pa-add-addend'), getR('pa-add-carry'), cnt));
  }
  if (document.getElementById('pa-op-sub').checked) {
    var cnt = getN('pa-sub-count');
    if (cnt) push(_pmArithSubPool(+getR('pa-sub-minuend'), +getR('pa-sub-subtrahend'), getR('pa-sub-borrow'), cnt));
  }
  if (document.getElementById('pa-op-mul').checked) {
    var cnt = getN('pa-mul-count');
    if (cnt) push(_pmArithMulPool(+getR('pa-mul-multiplicand'), +getR('pa-mul-multiplier'), getR('pa-mul-carry'), cnt));
  }
  if (document.getElementById('pa-op-div').checked) {
    var cnt = getN('pa-div-count');
    if (cnt) push(_pmArithDivPool(+getR('pa-div-dividend'), +getR('pa-div-divisor'), getR('pa-div-remainder'), cnt));
  }

  if (!questions.length) {
    document.getElementById('pa-status').textContent = '⚠️ 請至少勾選一種運算並輸入題數';
    document.getElementById('pa-print-btns').style.display = 'none';
    _pmQuestions = null;
    return;
  }
  _pmFinishGenerate(questions, 'pa-status', 'pa-print-btns');
}

// ════════════════════════════════════════
//  共用 UI helpers
// ════════════════════════════════════════

function pmStepCount(btn, delta) {
  var stepper = btn.parentElement;
  var numEl   = stepper.querySelector('.pm-count-num');
  var max     = stepper.dataset.max ? parseInt(stepper.dataset.max) : 999;
  var val     = parseInt(numEl.textContent) || 0;
  val = Math.max(0, Math.min(max, val + delta));
  numEl.textContent = val;
  stepper.dataset.count = val;
}

function _pmStepper(id, maxVal) {
  var maxAttr = maxVal !== undefined ? ' data-max="' + maxVal + '"' : '';
  return '<div class="pm-count-stepper" id="' + id + '" data-count="0"' + maxAttr + '>' +
         '<button class="pm-step-btn" onclick="pmStepCount(this,1)">△</button>' +
         '<div class="pm-count-display">(<span class="pm-count-num">0</span>)</div>' +
         '<button class="pm-step-btn" onclick="pmStepCount(this,-1)">▽</button>' +
         '</div>';
}

function _pmReadCount(id) {
  var el = document.getElementById(id);
  if (!el) return 0;
  return Math.max(0, parseInt(el.value !== undefined ? el.value : el.dataset.count) || 0);
}

function _pmBuildModuleRows(containerId, modules, prefix) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var html = '';
  modules.forEach(function(m) {
    html += '<div style="padding:12px 16px;border-bottom:1px solid var(--border)">';
    html += '<div style="display:flex;align-items:center;gap:10px">';
    html += '<div style="flex:1">';
    html += '<div style="font-size:.8rem;font-weight:900;color:var(--blue)">' + m.label + '</div>';
    if (m.example) html += '<div style="font-size:.72rem;color:var(--muted);font-weight:600;margin-top:2px">範例：' + m.example + '</div>';
    html += '</div>';
    html += '<input class="pm-count-input" id="' + prefix + '-count-' + m.id + '" type="number" min="0" value="0">';
    html += '<span style="font-size:.79rem;color:var(--muted);font-weight:700">題</span>';
    html += '</div></div>';
  });
  el.innerHTML = html;
}
