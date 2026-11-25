/**
 * build-strokes-tw.js — 產生 assets/data/strokes-tw/（教育部標準筆順，HanziWriter 格式）
 *
 * 來源：g0v/zh-stroke-data 的 json/（抓自教育部「國字標準字體筆順學習網」，2048 方格、y 向下）
 * 輸出：{ strokes: [SVG path…], medians: [[[x,y]…]…], radStrokes?: [筆畫序號…] }
 *       1024 方格、y 向上、上緣 900（跟 hanzi-writer-data 一樣）
 *
 * radStrokes（字卡列印把部首塗紅用）教育部資料沒有，從 hanzi-writer-data 對過來：
 *   畫數一樣、筆畫順序也大致一樣 → 直接用舊資料的序號；
 *   否則 → 教育部筆畫的中心線有一半以上落在舊資料部首範圍（外擴 40）內就算部首。
 *   少數字順序差很多，會有一兩畫塗錯色，只影響列印顏色。
 *
 * 用法（不是網站執行的程式，重新產生資料時才跑）：
 *   git clone --depth 1 --filter=blob:none --sparse https://github.com/g0v/zh-stroke-data.git zsd
 *   (cd zsd && git sparse-checkout set json)
 *   npm pack hanzi-writer-data@2.0.1 && tar xzf hanzi-writer-data-2.0.1.tgz
 *   npm i playwright-core   # 用本機 Chrome 判斷點是否在部首範圍內
 *   node build-strokes-tw.js zsd/json package <專案>/assets/data/strokes-tw
 */
'use strict';
const fs = require('fs'), path = require('path');
const [SRC, OLD, OUT] = process.argv.slice(2);

const P = (x, y) => [Math.round(x / 2), Math.round(900 - y / 2)];
const pts = o => o.type === 'M' || o.type === 'L' ? [o] : o.type === 'Q' ? [o.begin, o.end] : [o.begin, o.mid, o.end];
const feat = m => { const a = m[0], b = m[m.length - 1], c = m[Math.floor(m.length / 2)];
  return [a, b, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], c]; };
const dist = (f, g) => f.reduce((s, p, i) => s + Math.hypot(p[0] - g[i][0], p[1] - g[i][1]), 0);

function hungarian(c) {   // 方陣最小成本指派，回傳 row → col
  const n = c.length, INF = 1e18, u = Array(n + 1).fill(0), v = Array(n + 1).fill(0), p = Array(n + 1).fill(0), way = Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i; let j0 = 0; const minv = Array(n + 1).fill(INF), used = Array(n + 1).fill(false);
    do { used[j0] = true; const i0 = p[j0]; let d = INF, j1 = 0;
      for (let j = 1; j <= n; j++) if (!used[j]) { const cur = c[i0 - 1][j - 1] - u[i0] - v[j]; if (cur < minv[j]) { minv[j] = cur; way[j] = j0; } if (minv[j] < d) { d = minv[j]; j1 = j; } }
      for (let j = 0; j <= n; j++) if (used[j]) { u[p[j]] += d; v[j] -= d; } else minv[j] -= d;
      j0 = j1; } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const r = Array(n); for (let j = 1; j <= n; j++) r[p[j] - 1] = j - 1; return r;
}

/* 畫數一樣、整體順序也一樣（照序號對的距離不比最佳配對差太多）→ 回傳舊序號，否則 null */
function sameOrderRad(medians, old) {
  if (medians.length !== old.medians.length) return null;
  const nf = medians.map(feat), of = old.medians.map(feat);
  const cost = nf.map(a => of.map(o => dist(a, o)));
  const best = hungarian(cost).reduce((t, j, i) => t + cost[i][j], 0);
  const id = nf.reduce((t, _, i) => t + cost[i][i], 0);
  return id <= best * 1.3 ? old.radStrokes.slice() : null;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const byArea = [];   // 要用範圍判斷部首的字
  for (const f of fs.readdirSync(SRC)) {
    const cp = parseInt(f, 16);
    if (!(cp >= 0x3400 && cp < 0xF0000)) continue;   // 注音符號（注音趣自有資料）、私用區
    const g = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
    const out = {
      strokes: g.map(s => s.outline.map(o => o.type + ' ' + pts(o).map(p => P(p.x, p.y).join(' ')).join(' ')).join(' ') + ' Z'),
      medians: g.map(s => { const m = s.track.map(t => P(t.x, t.y)); if (m.length < 2) m.push(m[0].slice()); return m; })
    };
    const oldF = path.join(OLD, String.fromCodePoint(cp) + '.json');
    if (fs.existsSync(oldF)) {
      const old = JSON.parse(fs.readFileSync(oldF, 'utf8'));
      if (old.radStrokes && old.radStrokes.length < old.strokes.length) {
        const rad = sameOrderRad(out.medians, old);
        if (rad) out.radStrokes = rad;
        else byArea.push({ f, out, rad: old.radStrokes.map(i => old.strokes[i]) });
      }
    }
    fs.writeFileSync(path.join(OUT, f), JSON.stringify(out));
  }

  const { chromium } = require('playwright-core');
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const res = await (await b.newPage()).evaluate(items => {
    const ctx = document.createElement('canvas').getContext('2d'); ctx.lineWidth = 80;
    const samp = m => { const s = []; for (let i = 0; i < m.length - 1; i++) for (let t = 0; t < 1; t += 0.1) s.push([m[i][0] + (m[i+1][0]-m[i][0])*t, m[i][1] + (m[i+1][1]-m[i][1])*t]); s.push(m[m.length-1]); return s; };
    return items.map(({ out, rad }) => {
      const region = new Path2D(rad.join(' '));
      const r = out.medians.map((m, i) => { const s = samp(m);
        return s.filter(([x, y]) => ctx.isPointInPath(region, x, y) || ctx.isPointInStroke(region, x, y)).length / s.length >= 0.5 ? i : -1; }).filter(i => i >= 0);
      return r.length && r.length < out.medians.length ? r : null;
    });
  }, byArea);
  await b.close();
  byArea.forEach((it, k) => { if (res[k]) { it.out.radStrokes = res[k]; fs.writeFileSync(path.join(OUT, it.f), JSON.stringify(it.out)); } });
  console.log(fs.readdirSync(OUT).length + ' 字，' + byArea.length + ' 字用範圍判斷部首');
})();
