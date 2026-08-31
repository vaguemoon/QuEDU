'use strict';

/* ────────────────────────────────────────
   題目物件格式：
   {
     module:     'area' | 'volume' | 'surface',
     shape:      'rectangle' | 'triangle' | ...
     params:     { ... }   ← 生成的數值
     prompt:     string    ← 題目文字（以「？」標示答案位置）
     answer:     number    ← 正確答案
     isCircular: bool      ← true 時顯示小數點按鍵
   }
   ──────────────────────────────────────── */

/* ════════════════════════════════════════
   面積題目
   ════════════════════════════════════════ */

var AREA_SHAPES = {

  rectangle: {
    label: '長方形', icon: '▭',
    gen: function() {
      var l = _ri(3, 12), w;
      do { w = _ri(3, 12); } while (w === l);
      return {
        params: { l: l, w: w }, answer: l * w, isCircular: false,
        prompt: '長方形，長 ' + l + ' 公分，寬 ' + w + ' 公分，面積 = ？ 平方公分'
      };
    }
  },

  square: {
    label: '正方形', icon: '■',
    gen: function() {
      var s = _ri(3, 12);
      return {
        params: { s: s }, answer: s * s, isCircular: false,
        prompt: '正方形，邊長 ' + s + ' 公分，面積 = ？ 平方公分'
      };
    }
  },

  triangle: {
    label: '三角形', icon: '△',
    gen: function() {
      var b = _ri(2, 14), h = _riEven(2, 14);
      return {
        params: { b: b, h: h }, answer: b * h / 2, isCircular: false,
        prompt: '三角形，底 ' + b + ' 公分，高 ' + h + ' 公分，面積 = ？ 平方公分'
      };
    }
  },

  parallelogram: {
    label: '平行四邊形', icon: '▱',
    gen: function() {
      var b = _ri(3, 14), h = _ri(2, 10);
      return {
        params: { b: b, h: h }, answer: b * h, isCircular: false,
        prompt: '平行四邊形，底 ' + b + ' 公分，高 ' + h + ' 公分，面積 = ？ 平方公分'
      };
    }
  },

  trapezoid: {
    label: '梯形', icon: '⏢',
    gen: function() {
      var a = _ri(2, 6), b = _ri(a + 2, 12), h = _riEven(2, 10);
      return {
        params: { a: a, b: b, h: h }, answer: (a + b) * h / 2, isCircular: false,
        prompt: '梯形，上底 ' + a + ' 公分，下底 ' + b + ' 公分，高 ' + h + ' 公分，面積 = ？ 平方公分'
      };
    }
  },

  rhombus: {
    label: '菱形', icon: '◆',
    gen: function() {
      var d1 = _riEven(2, 14), d2 = _ri(2, 12);
      return {
        params: { d1: d1, d2: d2 }, answer: d1 * d2 / 2, isCircular: false,
        prompt: '菱形，對角線甲 ' + d1 + ' 公分，對角線乙 ' + d2 + ' 公分，面積 = ？ 平方公分'
      };
    }
  },

  circle: {
    label: '圓形', icon: '○',
    gen: function() {
      var r = _ri(1, 8);
      var ans = Math.round(r * r * 3.14 * 100) / 100;
      return {
        params: { r: r }, answer: ans, isCircular: true,
        prompt: '圓形，半徑 ' + r + ' 公分，面積 = ？ 平方公分（π取3.14）'
      };
    }
  }
};

/* ════════════════════════════════════════
   體積題目
   ════════════════════════════════════════ */

var VOLUME_SHAPES = {

  cube: {
    label: '正方體', icon: '⬛',
    gen: function() {
      var s = _ri(2, 8);
      return {
        params: { s: s }, answer: s * s * s, isCircular: false,
        prompt: '正方體，邊長 ' + s + ' 公分，體積 = ？ 立方公分'
      };
    }
  },

  rectangular_prism: {
    label: '長方體', icon: '🧱',
    gen: function() {
      var l = _ri(3, 10), w = _ri(2, 8), h = _ri(2, 8);
      return {
        params: { l: l, w: w, h: h }, answer: l * w * h, isCircular: false,
        prompt: '長方體，長 ' + l + ' 公分，寬 ' + w + ' 公分，高 ' + h + ' 公分，體積 = ？ 立方公分'
      };
    }
  },

  cylinder: {
    label: '圓柱', icon: '🥫',
    gen: function() {
      var r = _ri(1, 6), h = _ri(2, 10);
      var ans = Math.round(r * r * 3.14 * h * 100) / 100;
      return {
        params: { r: r, h: h }, answer: ans, isCircular: true,
        prompt: '圓柱，底面半徑 ' + r + ' 公分，高 ' + h + ' 公分，體積 = ？ 立方公分（π取3.14）'
      };
    }
  },

  triangular_prism: {
    label: '三角柱', icon: '🔷',
    gen: function() {
      var b = _ri(2, 10), ht = _riEven(2, 10), hp = _ri(2, 10);
      var baseArea = b * ht / 2;
      return {
        params: { b: b, ht: ht, hp: hp, baseArea: baseArea },
        answer: baseArea * hp, isCircular: false,
        prompt: '三角柱，底面三角形底 ' + b + ' 公分、高 ' + ht + ' 公分，柱高 ' + hp + ' 公分，體積 = ？ 立方公分'
      };
    }
  }
};

/* ════════════════════════════════════════
   表面積題目
   ════════════════════════════════════════ */

var _PYTH = [[3,4,5],[5,12,13],[6,8,10],[8,15,17],[9,12,15]];

var SURFACE_SHAPES = {

  cube: {
    label: '正方體', icon: '⬛',
    gen: function() {
      var s = _ri(2, 8);
      return {
        params: { s: s }, answer: 6 * s * s, isCircular: false,
        prompt: '正方體，邊長 ' + s + ' 公分，表面積 = ？ 平方公分'
      };
    }
  },

  rectangular_prism: {
    label: '長方體', icon: '🧱',
    gen: function() {
      var l = _ri(3, 10), w = _ri(2, 8), h = _ri(2, 8);
      return {
        params: { l: l, w: w, h: h }, answer: 2 * (l*w + l*h + w*h), isCircular: false,
        prompt: '長方體，長 ' + l + ' 公分，寬 ' + w + ' 公分，高 ' + h + ' 公分，表面積 = ？ 平方公分'
      };
    }
  },

  cylinder: {
    label: '圓柱', icon: '🥫',
    gen: function() {
      var r = _ri(1, 5), h = _ri(2, 8);
      var ans = Math.round(2 * 3.14 * r * (r + h) * 100) / 100;
      return {
        params: { r: r, h: h }, answer: ans, isCircular: true,
        prompt: '圓柱，底面半徑 ' + r + ' 公分，高 ' + h + ' 公分，表面積 = ？ 平方公分（π取3.14）'
      };
    }
  },

  triangular_prism: {
    label: '直角三角柱', icon: '🔷',
    gen: function() {
      var t = _PYTH[_ri(0, _PYTH.length - 1)];
      var sc = _ri(1, 2);
      var a = t[0]*sc, b = t[1]*sc, c = t[2]*sc, hp = _ri(2, 10);
      var baseArea = a * b / 2;
      var ans = 2 * baseArea + (a + b + c) * hp;
      return {
        params: { a: a, b: b, c: c, hp: hp, baseArea: baseArea }, answer: ans, isCircular: false,
        prompt: '直角三角柱，直角邊 ' + a + '、' + b + ' 公分，斜邊 ' + c + ' 公分，柱高 ' + hp + ' 公分，表面積 = ？ 平方公分'
      };
    }
  }
};

/* ════════════════════════════════════════
   題目池產生
   ════════════════════════════════════════ */

function getShapeMap(module) {
  if (module === 'area')    return AREA_SHAPES;
  if (module === 'volume')  return VOLUME_SHAPES;
  if (module === 'surface') return SURFACE_SHAPES;
  return {};
}

function generateQuestionPool(module, shape) {
  var shapeMap = getShapeMap(module);
  var def = shapeMap[shape];
  if (!def) return [];
  var pool = [];
  for (var i = 0; i < ROUND_SIZE; i++) {
    var q = def.gen();
    q.module = module;
    q.shape  = shape;
    pool.push(q);
  }
  return pool;
}
