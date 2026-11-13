/**
 * shared/apps.js — 子 App 註冊表（全站唯一的 App 清單）
 *
 * 學生 Hub（src/hub.js）與教師後台（admin/students.js）都讀這份清單。
 * 新增子 App 只要在 QU_APPS 加一筆：Hub 卡片、返回／登出訊息、近期記錄、後台學習總覽都會自動帶到。
 *
 * 這個檔案只放「資料」與「不碰 Firestore 連線的純函式」，所以學生端、後台都能直接載入。
 *
 * 欄位：
 *   id          App 代號，也是 Hub 卡片與 iframe 的識別
 *   file        入口頁（相對於網站根目錄）
 *   icon/name/desc/theme/badge/badgeClass   Hub 卡片外觀
 *   type        'learn'（學習區）| 'quiz'（測驗區）
 *   category    學習區的分組：'chinese' | 'english' | 'math' | 'special'
 *   studentMode true = 需要班級（網址帶 classIds）
 *   msg         postMessage 的前綴，預設等於 id（子 App 送 `{msg}-back-to-hub`、`{msg}-logout`）
 *   backMsg     返回訊息不是 `{msg}-back-to-hub` 時才填
 *   progress    students/{id}/progress/{這個值} 的文件名；沒有存進度填 null
 *   summarize   function(進度文件資料) → { sub, score } | null，把各 App 自己的格式摘要成一句話
 *   activityApp 沒有進度文件、改數 activities 筆數的 App（測驗類），值是 activities.app
 *   activityLabel  activities 筆數的說法，{n} 會換成次數
 */
'use strict';

function _quCountMastered(map) {
  return Object.keys(map || {}).filter(function(k) { return map[k] === 'mastered'; }).length;
}
function _quTotalCorrect(d) {
  var c = d.totalCorrect || 0;
  return c ? { sub: '累計答對 ' + c + ' 題', score: c + ' 題' } : null;
}

var QU_APPS = [
  {
    id: 'chinese', file: 'apps/learn/lang/chinese/index.html',
    icon: '國', name: '練字趣', desc: '國小國字筆順學習',
    type: 'learn', category: 'chinese',
    theme: 'theme-blue', badge: '練字LV1', badgeClass: 'green',
    msg: 'hanzi', progress: 'hanzi',
    summarize: function(d) {
      var m = _quCountMastered(d.charStatus);
      return m ? { sub: '通過測驗 ' + m + ' 字', score: m + ' 字' } : null;
    }
  },
  {
    id: 'numsense', file: 'apps/learn/math/numsense/index.html',
    icon: '🔢', name: '基礎數感', desc: '數字寫法・位值・數的順序',
    type: 'learn', category: 'math',
    theme: 'theme-teal', badge: '基礎數感', badgeClass: 'green',
    progress: 'numsense', summarize: _quTotalCorrect
  },
  {
    id: 'convert', file: 'apps/learn/math/convert/index.html',
    icon: '↔', name: '換算趣', desc: '各種單位換算',
    type: 'learn', category: 'math',
    theme: 'theme-green', badge: '換算LV1', badgeClass: 'green',
    progress: 'convert', summarize: _quTotalCorrect
  },
  {
    id: 'transpose', file: 'apps/learn/math/transpose/index.html',
    icon: '↔', name: '移項趣', desc: '方程式移項練習',
    type: 'learn', category: 'math',
    theme: 'theme-green', badge: '移項趣', badgeClass: 'green',
    progress: null
  },
  {
    id: 'fractions', file: 'apps/learn/math/Fractions/index.html',
    icon: '➗', name: '分數趣', desc: '擴分、約分、通分與加減乘',
    type: 'learn', category: 'math',
    theme: 'theme-orange', badge: '分數趣', badgeClass: 'orange',
    progress: null
  },
  {
    id: 'geometry', file: 'apps/learn/math/geometry/index.html',
    icon: '📐', name: '幾何趣', desc: '面積・體積・表面積計算',
    type: 'learn', category: 'math',
    theme: 'theme-teal', badge: '幾何趣', badgeClass: 'green',
    progress: null
  },
  {
    id: 'multiply', file: 'apps/learn/math/multiply/index.html',
    icon: '✖️', name: '乘法趣', desc: '0 到 10 的乘法練習',
    type: 'learn', category: 'math',
    theme: 'theme-orange', badge: '乘法LV1', badgeClass: 'green',
    progress: 'multiply', summarize: _quTotalCorrect
  },
  {
    id: 'addsub', file: 'apps/learn/math/addsub/index.html',
    icon: '➕', name: '加減趣', desc: '加法、減法計算練習',
    type: 'learn', category: 'math',
    theme: 'theme-orange', badge: '加減趣', badgeClass: 'green',
    progress: 'addsub', summarize: _quTotalCorrect
  },
  {
    id: 'compare', file: 'apps/learn/math/compare/index.html',
    icon: '⚖️', name: '比較趣', desc: '不用計算比大小・估一估',
    type: 'learn', category: 'math',
    theme: 'theme-blue', badge: '比較趣', badgeClass: 'green',
    progress: 'compare', summarize: _quTotalCorrect
  },
  {
    id: 'exam-reader', file: 'apps/quiz/word-to-reader/index.html',
    icon: '🎧', name: '考卷報讀', desc: '老師分享的有聲考卷',
    type: 'quiz', studentMode: true,
    theme: 'theme-teal', badge: '考卷報讀', badgeClass: 'green',
    progress: null, activityApp: 'exam-reader', activityLabel: '已使用 {n} 次'
  },
  {
    id: 'word-image', file: 'apps/learn/lang/word-image/index.html',
    icon: '🖼️', name: '詞語趣', desc: '圖像化學習詞語',
    type: 'learn', category: 'chinese',
    theme: 'theme-purple', badge: '詞語趣', badgeClass: 'blue',
    backMsg: 'word-image-back', progress: 'wordImage',
    summarize: function(d) {
      var words = d.words || {};
      var total = Object.keys(words).filter(function(k) {
        return (words[k].correct || 0) + (words[k].wrong || 0) > 0;
      }).length;
      return total ? { sub: '已練習 ' + total + ' 個詞語', score: total + ' 詞' } : null;
    }
  },
  {
    id: 'recognize', file: 'apps/learn/lang/recognize/index.html',
    icon: '🔊', name: '認字趣', desc: '聽音辨字・選字選詞',
    type: 'learn', category: 'chinese',
    theme: 'theme-teal', badge: '認字LV1', badgeClass: 'green',
    progress: 'recognize',
    summarize: function(d) {
      var m = _quCountMastered(d.charStatus) + _quCountMastered(d.wordStatus);
      return m ? { sub: '精熟 ' + m + ' 字詞', score: m + ' 字詞' } : null;
    }
  },
  {
    id: 'e-textbook', file: 'apps/learn/lang/e-textbook/index.html',
    icon: '📖', name: '課文趣', desc: '電子課本・圈詞・朗讀跟讀',
    type: 'learn', category: 'chinese', studentMode: true, // 需要 classIds 才能查班級分享的課文，比照考卷報讀
    theme: 'theme-blue', badge: '課文趣', badgeClass: 'blue',
    progress: 'eTextbook',
    summarize: function(d) {
      var lessons = d.lessons || {};
      var totalFound = Object.keys(lessons).reduce(function(sum, k) {
        return sum + Object.keys((lessons[k] || {}).foundWords || {}).length;
      }, 0);
      return totalFound ? { sub: '累計圈到 ' + totalFound + ' 個生字詞', score: totalFound + ' 個' } : null;
    }
  },
  {
    id: 'radical', file: 'apps/learn/lang/radical/index.html',
    icon: '🧩', name: '部件趣', desc: '部件・部首拆字練習',
    type: 'learn', category: 'chinese',
    theme: 'theme-orange', badge: '部件LV1', badgeClass: 'green',
    progress: 'radical',
    summarize: function(d) {
      var m = _quCountMastered(d.radicalStatus);
      return m ? { sub: '精熟 ' + m + ' 個部件', score: m + ' 部件' } : null;
    }
  },
  {
    id: 'zhuyin', file: 'apps/learn/lang/zhuyin/index.html',
    icon: 'ㄅ', name: '注音趣', desc: '注音符號點選學習',
    type: 'learn', category: 'chinese',
    theme: 'theme-pink', badge: '注音趣', badgeClass: 'green',
    progress: 'zhuyin'
  },
  {
    id: 'english', file: 'apps/learn/lang/english/index.html',
    icon: '🌐', name: '英文趣', desc: '英文發音・常用語・生字',
    type: 'learn', category: 'english',
    theme: 'theme-teal', badge: '英文趣', badgeClass: 'green',
    backMsg: 'english-back', progress: 'english',
    summarize: function(d) {
      var total = 0;
      Object.keys(d).forEach(function(k) {
        var v = d[k];
        if (v && typeof v.correct === 'number') total += v.correct;
      });
      return total ? { sub: '累計答對 ' + total + ' 題', score: total + ' 題' } : null;
    }
  },
  {
    id: 'math-quiz', file: 'apps/quiz/math-quiz/index.html',
    icon: '🔢', name: '數學測驗', desc: '四則運算練習測驗',
    type: 'quiz', studentMode: true,
    theme: 'theme-green', badge: '數學測驗', badgeClass: 'green',
    progress: null, activityApp: 'math-quiz', activityLabel: '已完成 {n} 次練習'
  },
  {
    id: 'chinese-quiz', file: 'apps/quiz/chinese-quiz/index.html',
    icon: '📝', name: '語文測驗', desc: '詞語填空與選擇題練習',
    type: 'quiz', studentMode: true,
    theme: 'theme-purple', badge: '語文測驗', badgeClass: 'blue',
    progress: null, activityApp: 'chinese-quiz', activityLabel: '已完成 {n} 次練習'
  },
  {
    id: 'english-quiz', file: 'apps/quiz/english-quiz/index.html',
    icon: '🔤', name: '英文測驗', desc: '看圖選字・聽音選字',
    type: 'quiz', studentMode: true,
    theme: 'theme-blue', badge: '英文測驗', badgeClass: 'blue',
    progress: null, activityApp: 'english-quiz', activityLabel: '已完成 {n} 次測驗'
  },
  {
    id: 'motor', file: 'apps/learn/special/motor/index.html',
    icon: '🧩', name: '知動趣', desc: '連連看・線條練習',
    type: 'learn', category: 'special',
    theme: 'theme-orange', badge: '知動趣', badgeClass: 'orange',
    // 進度存在裝置 localStorage，不讀 Firestore
    progress: null
  }
];

/* Hub 要認得的「返回主頁」訊息 */
function quAppBackTypes() {
  return QU_APPS.map(function(a) { return a.backMsg || ((a.msg || a.id) + '-back-to-hub'); });
}

/* Hub 要認得的「登出」訊息 */
function quAppLogoutTypes() {
  return QU_APPS.map(function(a) { return (a.msg || a.id) + '-logout'; });
}

/**
 * 讀某位學生在某個 App 的學習摘要。
 * @param {object} app  QU_APPS 的一筆
 * @param {string} sid  學生文件 ID
 * @param {object} fdb  Firestore 實例
 * @returns {Promise<{sub:string, score:string, lastStudied:string}|null>} 沒有任何紀錄回傳 null；
 *          有進度文件但 App 沒有定義摘要算法時，sub/score 為空字串（只知道「有用過」）
 */
function quAppSummary(app, sid, fdb) {
  var sRef = fdb.collection('students').doc(sid);
  if (app.progress) {
    return sRef.collection('progress').doc(app.progress).get().then(function(doc) {
      if (!doc.exists) return null;
      var d = doc.data() || {};
      var r = typeof app.summarize === 'function' ? app.summarize(d) : null;
      if (!r && typeof app.summarize === 'function') return null;
      return { sub: r ? r.sub : '', score: r ? r.score : '', lastStudied: d.lastStudied || '' };
    });
  }
  if (app.activityApp) {
    return sRef.collection('activities').where('app', '==', app.activityApp).get().then(function(snap) {
      if (snap.empty) return null;
      var last = '';
      snap.forEach(function(doc) {
        var t = doc.data().timestamp || '';
        if (t > last) last = t;
      });
      return {
        sub: (app.activityLabel || '已完成 {n} 次').replace('{n}', snap.size),
        score: snap.size + ' 次',
        lastStudied: last
      };
    });
  }
  return Promise.resolve(null);
}
