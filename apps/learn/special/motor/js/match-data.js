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
  /* 原本這裡是「同心圓」家族，換成交通工具／生活用品，比較貼近小二生活經驗，
   * 也順便避開同心圓那種「奇偶圈數決定填色深淺」造成某些組合看起來特別小/淡的問題——
   * 這裡每個參數都是「整塊實色形狀」等級的差異，不會有畫出來幾乎看不見的情況。 */
  car: {
    paramSpecs: {
      bodyStyle: ['sedan', 'van'],
      colorIdx: [0, 1, 2, 3, 4],
      wheelStyle: ['plain', 'spoked']
    },
    render: function(svg, p) {
      var color = MATCH_PALETTE[p.colorIdx];
      var body = document.createElementNS(SVGNS, 'path');
      body.setAttribute('d', p.bodyStyle === 'van'
        ? 'M 8,68 L 8,38 Q 8,32 16,32 L 84,32 Q 92,32 92,38 L 92,68 Z'
        : 'M 8,68 L 8,56 L 24,44 L 40,38 L 66,38 L 80,50 L 92,56 L 92,68 Z');
      body.setAttribute('fill', color);
      svg.appendChild(body);

      var win = document.createElementNS(SVGNS, 'rect');
      win.setAttribute('x', 34); win.setAttribute('y', p.bodyStyle === 'van' ? 38 : 44);
      win.setAttribute('width', 32); win.setAttribute('height', 14); win.setAttribute('rx', 2);
      win.setAttribute('fill', 'white');
      svg.appendChild(win);

      [28, 72].forEach(function(wx) {
        var wheel = document.createElementNS(SVGNS, 'circle');
        wheel.setAttribute('cx', wx); wheel.setAttribute('cy', 68); wheel.setAttribute('r', 11);
        wheel.setAttribute('fill', '#1e2d3d');
        svg.appendChild(wheel);
        if (p.wheelStyle === 'spoked') {
          for (var a = 0; a < 3; a++) {
            var rad = (a * 60) * Math.PI / 180;
            var line = document.createElementNS(SVGNS, 'line');
            line.setAttribute('x1', wx); line.setAttribute('y1', 68);
            line.setAttribute('x2', wx + 8 * Math.cos(rad)); line.setAttribute('y2', 68 + 8 * Math.sin(rad));
            line.setAttribute('stroke', 'white'); line.setAttribute('stroke-width', 2);
            svg.appendChild(line);
          }
        } else {
          var hub = document.createElementNS(SVGNS, 'circle');
          hub.setAttribute('cx', wx); hub.setAttribute('cy', 68); hub.setAttribute('r', 4);
          hub.setAttribute('fill', 'white');
          svg.appendChild(hub);
        }
      });
    }
  },
  cup: {
    paramSpecs: {
      handleSide: ['left', 'right'],
      colorIdx: [0, 1, 2, 3, 4],
      pattern: ['plain', 'striped']
    },
    render: function(svg, p) {
      var color = MATCH_PALETTE[p.colorIdx];
      var body = document.createElementNS(SVGNS, 'rect');
      body.setAttribute('x', 28); body.setAttribute('y', 28);
      body.setAttribute('width', 44); body.setAttribute('height', 48); body.setAttribute('rx', 6);
      body.setAttribute('fill', color);
      svg.appendChild(body);

      var hx = p.handleSide === 'left' ? 28 : 72;
      var sign = p.handleSide === 'left' ? -1 : 1;
      var handle = document.createElementNS(SVGNS, 'path');
      handle.setAttribute('d', 'M ' + hx + ',40 Q ' + (hx + sign * 20) + ',52 ' + hx + ',64');
      handle.setAttribute('fill', 'none'); handle.setAttribute('stroke', color); handle.setAttribute('stroke-width', 7);
      handle.setAttribute('stroke-linecap', 'round');
      svg.appendChild(handle);

      if (p.pattern === 'striped') {
        [36, 46, 56, 66].forEach(function(y) {
          var stripe = document.createElementNS(SVGNS, 'rect');
          stripe.setAttribute('x', 28); stripe.setAttribute('y', y);
          stripe.setAttribute('width', 44); stripe.setAttribute('height', 4);
          stripe.setAttribute('fill', 'white');
          svg.appendChild(stripe);
        });
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
  if (family === 'car') {
    return ['car', p.bodyStyle, p.colorIdx, p.wheelStyle].join('|');
  }
  if (family === 'cup') {
    return ['cup', p.handleSide, p.colorIdx, p.pattern].join('|');
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

  var paramCount = Object.keys(MATCH_ICON_FAMILIES[family].paramSpecs).length;
  var correctIdx = Math.floor(Math.random() * 4);
  var options = [];
  var signatures = [_matchSignature(family, base)];
  for (var i = 0; i < 4; i++) {
    if (i === correctIdx) { options.push(base); continue; }
    // car/cup 這種參數值域很小的家族，在 hard 難度（只換1個參數）有時候 30 次都剛好
    // 撞到已經用過的組合——與其無限加大重試次數賭運氣，找不到就多換一個參數再試，
    // 保證一定找得到（car/cup 全部參數隨機組合有 20 種，4 個選項絕對夠用）。
    var variant, sig, found = false;
    for (var cc = Math.min(changeCount, paramCount); cc <= paramCount && !found; cc++) {
      for (var attempts = 0; attempts < 30 && !found; attempts++) {
        variant = _matchDistractorParams(base, family, cc);
        sig = _matchSignature(family, variant);
        if (signatures.indexOf(sig) === -1) found = true;
      }
    }
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
