'use strict';

/* 找一樣的圖案——關卡資料＋圖示產生器
 * 每一關不是寫死的題目，而是即時用 SVG 參數隨機產生（跟連連看的隨機起點同一個精神），
 * 玩不膩、也不能靠背圖案位置矇過去，要真的比對細節。
 *
 * 做法：每個「圖案家族」定義一組可調參數（paramSpecs），隨機抽一組當範本，
 * 干擾項則是從範本複製一份、挑幾個參數換成不同的值——換幾個參數就是難度：
 * 全部換掉 → 一眼看出不一樣；只換一個 → 要很仔細比對。
 */

var MATCH_PALETTE = ['#4a90d9', '#52c97a', '#ff8c42', '#d63384', '#8e44ad'];

var MATCH_ICON_FAMILIES = {
  star: {
    paramSpecs: {
      points: [5, 6, 7, 8],
      rotation: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
      colorIdx: [0, 1, 2, 3, 4],
      depth: ['sharp', 'soft'] // sharp=尖角星星，soft=花朵狀
    },
    render: function(svg, p) {
      var outerR = 38, innerR = p.depth === 'sharp' ? 15 : 26;
      var pts = [];
      for (var i = 0; i < p.points * 2; i++) {
        var r = (i % 2 === 0) ? outerR : innerR;
        var deg = p.rotation - 90 + i * (360 / (p.points * 2));
        var rad = deg * Math.PI / 180;
        pts.push((50 + r * Math.cos(rad)).toFixed(1) + ',' + (50 + r * Math.sin(rad)).toFixed(1));
      }
      var path = document.createElementNS(SVGNS, 'polygon');
      path.setAttribute('points', pts.join(' '));
      path.setAttribute('fill', MATCH_PALETTE[p.colorIdx]);
      svg.appendChild(path);
    }
  },
  face: {
    paramSpecs: {
      eyeStyle: ['round', 'oval', 'happy'],
      mouthStyle: ['smile', 'open', 'flat', 'surprised'],
      colorIdx: [0, 1, 2, 3, 4]
    },
    render: function(svg, p) {
      var head = document.createElementNS(SVGNS, 'circle');
      head.setAttribute('cx', 50); head.setAttribute('cy', 50); head.setAttribute('r', 38);
      head.setAttribute('fill', 'white');
      head.setAttribute('stroke', MATCH_PALETTE[p.colorIdx]);
      head.setAttribute('stroke-width', 6);
      svg.appendChild(head);

      [36, 64].forEach(function(ex) {
        if (p.eyeStyle === 'happy') {
          var arc = document.createElementNS(SVGNS, 'path');
          arc.setAttribute('d', 'M ' + (ex - 6) + ',38 Q ' + ex + ',28 ' + (ex + 6) + ',38');
          arc.setAttribute('fill', 'none');
          arc.setAttribute('stroke', MATCH_PALETTE[p.colorIdx]);
          arc.setAttribute('stroke-width', 4);
          arc.setAttribute('stroke-linecap', 'round');
          svg.appendChild(arc);
        } else {
          var eye = document.createElementNS(SVGNS, p.eyeStyle === 'oval' ? 'ellipse' : 'circle');
          eye.setAttribute('cx', ex); eye.setAttribute('cy', 38);
          if (p.eyeStyle === 'oval') { eye.setAttribute('rx', 3.5); eye.setAttribute('ry', 6); }
          else { eye.setAttribute('r', 4.5); }
          eye.setAttribute('fill', MATCH_PALETTE[p.colorIdx]);
          svg.appendChild(eye);
        }
      });

      var mouth = document.createElementNS(SVGNS, 'path');
      var d;
      if (p.mouthStyle === 'smile') d = 'M 34,60 Q 50,76 66,60';
      else if (p.mouthStyle === 'flat') d = 'M 36,64 L 64,64';
      else if (p.mouthStyle === 'surprised') d = 'M 50,56 A 8,8 0 1 0 50.01,56';
      else d = 'M 38,58 Q 50,74 62,58 Q 50,68 38,58'; // open
      mouth.setAttribute('d', d);
      mouth.setAttribute('fill', p.mouthStyle === 'open' || p.mouthStyle === 'surprised' ? MATCH_PALETTE[p.colorIdx] : 'none');
      mouth.setAttribute('stroke', MATCH_PALETTE[p.colorIdx]);
      mouth.setAttribute('stroke-width', 4);
      mouth.setAttribute('stroke-linecap', 'round');
      svg.appendChild(mouth);
    }
  },
  target: {
    /* 同心圓本身是完全旋轉對稱的圖形，之前這裡還有一個 rotation 參數，
     * 但旋轉同心圓畫出來的結果完全一樣——等於有時候干擾項「唯一換掉的參數」
     * 根本沒有視覺效果，變成兩個看起來一模一樣的選項。已拿掉這個參數，
     * 改用 gap 的粗細對比拉大（1 → 5），讓這個參數本身就是明確可辨的差異。 */
    paramSpecs: {
      rings: [2, 3, 4],
      colorIdx: [0, 1, 2, 3, 4],
      gap: ['thin', 'thick']
    },
    render: function(svg, p) {
      var maxR = 38, step = maxR / p.rings;
      var gapW = p.gap === 'thick' ? 5 : 1;
      for (var i = p.rings; i >= 1; i--) {
        var c = document.createElementNS(SVGNS, 'circle');
        c.setAttribute('cx', 50); c.setAttribute('cy', 50);
        c.setAttribute('r', step * i - gapW);
        c.setAttribute('fill', i % 2 === 1 ? MATCH_PALETTE[p.colorIdx] : 'white');
        c.setAttribute('stroke', MATCH_PALETTE[p.colorIdx]);
        c.setAttribute('stroke-width', 1.5);
        svg.appendChild(c);
      }
    }
  }
};

/* 「視覺特徵碼」——用來保證範本＋3個干擾項彼此看起來都不一樣（不只是跟範本比，
 * 干擾項互相之間也不能撞），避免像星星在某些 points 下旋轉剛好對稱、看起來跟沒換一樣
 * 這種「參數不同但畫出來一樣」的情況漏網。星星有 N 個尖角時，每 360/N 度會重複一次，
 * 所以 rotation 要先對這個週期取餘數再比較，不然同一個外觀會被誤判成不同的兩個選項。 */
function _matchSignature(family, p) {
  if (family === 'star') {
    var period = 360 / p.points;
    var normRot = Math.round(((p.rotation % period) + period) % period);
    return ['star', p.points, normRot, p.colorIdx, p.depth].join('|');
  }
  if (family === 'target') {
    return ['target', p.rings, p.colorIdx, p.gap].join('|');
  }
  return ['face', p.eyeStyle, p.mouthStyle, p.colorIdx].join('|');
}

var MATCH_FAMILY_NAMES = Object.keys(MATCH_ICON_FAMILIES);

function _matchRandomParams(family) {
  var spec = MATCH_ICON_FAMILIES[family].paramSpecs;
  var params = {};
  Object.keys(spec).forEach(function(k) {
    var opts = spec[k];
    params[k] = opts[Math.floor(Math.random() * opts.length)];
  });
  return params;
}

/* 從 base 複製一份，挑 changeCount 個參數換成「確定不一樣」的值 */
function _matchDistractorParams(base, family, changeCount) {
  var spec = MATCH_ICON_FAMILIES[family].paramSpecs;
  var keys = Object.keys(spec);
  var shuffled = keys.slice().sort(function() { return Math.random() - 0.5; });
  var chosen = shuffled.slice(0, Math.min(changeCount, keys.length));
  var variant = {};
  keys.forEach(function(k) { variant[k] = base[k]; });
  chosen.forEach(function(k) {
    var others = spec[k].filter(function(v) { return v !== base[k]; });
    variant[k] = others[Math.floor(Math.random() * others.length)];
  });
  return variant;
}

/* 產生一題：{ family, reference, options:[{params,correct}], correctIdx }
 * 每個干擾項都要跟範本、也跟其他已經生成的干擾項「視覺特徵碼」不同，
 * 不然會出現兩個選項看起來一模一樣、根本分不出哪個才是對的（辨別度等於零）。
 * changeCount 只決定差異有多細微，不決定「有沒有差異」——這裡強制保證一定要有差異。 */
function generateMatchRound(difficulty) {
  var family = MATCH_FAMILY_NAMES[Math.floor(Math.random() * MATCH_FAMILY_NAMES.length)];
  var base = _matchRandomParams(family);
  var changeCount = difficulty === 'hard' ? 1 : (difficulty === 'medium' ? 2 : 4);

  var correctIdx = Math.floor(Math.random() * 4);
  var options = [];
  var signatures = [_matchSignature(family, base)];
  for (var i = 0; i < 4; i++) {
    if (i === correctIdx) { options.push(base); continue; }
    var variant, sig, attempts = 0;
    do {
      variant = _matchDistractorParams(base, family, changeCount);
      sig = _matchSignature(family, variant);
      attempts++;
    } while (signatures.indexOf(sig) !== -1 && attempts < 25);
    signatures.push(sig);
    options.push(variant);
  }
  return { family: family, reference: base, options: options, correctIdx: correctIdx };
}

var MATCH_LEVELS = [
  { id: 'match-easy',   title: '🔍 明顯不同',   icon: '🔍', difficulty: 'easy',   rounds: 6 },
  { id: 'match-medium', title: '🧐 仔細看',     icon: '🧐', difficulty: 'medium', rounds: 6 },
  { id: 'match-hard',   title: '👀 眼力大挑戰', icon: '👀', difficulty: 'hard',   rounds: 6 }
];
