/**
 * admin/exam-compose-output.js — 試卷編製精靈 Step 4：輸出（發布線上測驗、列印試卷與學生作答卷）
 * 原本是 exam-compose.js 的一部分，照章節拆成獨立檔案，內容沒有改。
 * 共用的狀態變數（_ec*、_qe*、_dct*）宣告在 exam-compose.js；各檔的函式都是全域的，可以互相呼叫。
 * 依賴：shared.js（db、showToast）、init.js（currentTeacher）、exam-compose.js
 */
'use strict';

/* ════════════════════════════════
   Step 4：輸出
   ════════════════════════════════ */
function _ecRenderPreview() {
  var totalQ = 0;
  _ecSections.forEach(function(sec) { totalQ += (sec.questions || []).length; });
  var matchTotal = 0;
  _ecMatchSections.forEach(function(msec) { matchTotal += msec.pairCount || 0; });
  var el = document.getElementById('ec-preview-summary');
  if (!el) return;
  var metaStr = _ecSubject === 'math' ? '數學' : '語文';
  if (_ecGrade)     metaStr += ' · ' + _ecEsc(_ecGrade);
  if (_ecLesson)    metaStr += ' · 第 ' + _ecEsc(_ecLesson) + ' 課' + (_ecLessonName ? '　' + _ecEsc(_ecLessonName) : '');
  else if (_ecGrade) metaStr += ' · 全冊／跨課次';
  var totalSec = _ecSections.length + _ecMatchSections.length;
  metaStr += ' · 共 ' + totalSec + ' 大題，' + (totalQ + matchTotal) + ' 題';

  var textSecHtml = _ecSections.map(function(sec) {
    var p  = parseFloat(sec.points);
    var uc = _ecSectionUnitCount(sec);
    return '<span style="display:inline-block;margin-right:12px">▪ ' + _ecEsc(sec.title) +
           '（' + (sec.questions || []).length + ' 題' + (!isNaN(p) && p > 0 ? '・每' + uc.unit + p + '分' : '') + '）</span>';
  }).join('');
  var matchSecHtml = _ecMatchSections.map(function(msec, i) {
    var secNum = _EC_CN[_ecSections.length + i] || String(_ecSections.length + i + 1);
    var mp = parseFloat(msec.points);
    return '<span style="display:inline-block;margin-right:12px">🖼 ' + secNum + '、' +
           _ecEsc(msec.title) + '（' + msec.pairCount + ' 組' + (!isNaN(mp) && mp > 0 ? '・每組' + mp + '分' : '') + '）</span>';
  }).join('');

  el.innerHTML =
    '<div style="font-size:1.08rem;font-weight:900;color:var(--text)">' + _ecEsc(_ecName) + '</div>' +
    '<div style="font-size:.82rem;color:var(--muted);margin-top:4px">' + metaStr + '</div>' +
    (totalSec ? '<div style="margin-top:8px;font-size:.8rem;color:var(--muted);line-height:1.8">' +
      textSecHtml + matchSecHtml + '</div>' : '');
  _ecRenderPointsSummary('ec-preview-points-summary');
}

/* ── 發布／更新線上測驗 ── */
function _ecPublishOnline() {
  var totalQ      = 0;
  var questionIds = [];
  /* 默寫生字以前因為 chinese-quiz 沒有寫字作答介面而被排除在線上測驗之外；現在 quiz.html
     已經用 HanziWriter 做了逐字判斷，不用再特別排除，照一般題型處理就好。 */
  _ecSections.forEach(function(sec) {
    (sec.questions || []).forEach(function(q) {
      questionIds.push(q.id); totalQ++;
    });
  });
  var matchTotal = 0;
  _ecMatchSections.forEach(function(msec) { matchTotal += msec.pairCount || 0; });
  if (!totalQ && !matchTotal) { showToast('試卷中尚無題目'); return; }

  var matchSectionsData = _ecMatchSections.map(function(msec) {
    return {
      title: msec.title, source: msec.source,
      gradeLesson: msec.gradeLesson || '', categoryId: msec.categoryId || '',
      pairCount: msec.pairCount, wordIds: msec.wordIds || [], words: msec.words || [],
      points: msec.points || '', pageBreakBefore: !!msec.pageBreakBefore
    };
  });
  var sectionPoints = _ecCollectSectionPoints();
  var breakData = _ecCollectBreakData();
  var sectionOrder = _ecSections.map(function(sec) { return sec.key; });
  try { localStorage.setItem(_ecPrefOrderKey(), JSON.stringify(_ecSecKeyOrder.length ? _ecSecKeyOrder : sectionOrder)); } catch (e) {}

  var isUpdate = !!_ecSessionId;
  var confirmMsg = isUpdate
    ? '確定要儲存對「' + _ecName + '」的修改？'
    : '確定要將「' + _ecName + '」發布為線上測驗？';
  if (!confirm(confirmMsg)) return;

  var btn = document.getElementById('ec-btn-publish');
  if (btn) { btn.disabled = true; btn.textContent = isUpdate ? '儲存中…' : '建立中…'; }

  var coll = _ecSubject === 'math' ? 'mathQuizSessions' : 'quizSessions';

  var p;
  var lessonFields = { version: _ecVersion, volume: _ecVolume, lesson: _ecLesson, lessonName: _ecLessonName };

  if (isUpdate) {
    /* 更新既有測驗，保留 code / active / createdAt */
    var updateData = Object.assign(
      { name: _ecName, grade: _ecGrade, questionIds: questionIds,
        matchSections: matchSectionsData, updatedAt: new Date().toISOString() },
      lessonFields
    );
    updateData.sectionOrder = sectionOrder;
    updateData.sectionPageBreaks = breakData.sectionPageBreaks;
    updateData.breakBeforeQuestionIds = breakData.breakBeforeQuestionIds;
    if (_ecSubject === 'math') { updateData.totalQuestions = totalQ; }
    else { updateData.counts = { total: totalQ, match: matchTotal }; updateData.sectionPoints = sectionPoints; }
    p = db.collection(coll).doc(_ecSessionId).update(updateData)
          .then(function() { return { id: _ecSessionId, isUpdate: true }; });
  } else {
    var code    = _ecGenCode();
    var newData = _ecSubject === 'math'
      ? Object.assign({ teacherUid: currentTeacher.uid, quizType: 'exam', name: _ecName, code: code,
          grade: _ecGrade, questionIds: questionIds, totalQuestions: totalQ, sectionOrder: sectionOrder,
          sectionPageBreaks: breakData.sectionPageBreaks, breakBeforeQuestionIds: breakData.breakBeforeQuestionIds,
          active: true, createdAt: new Date().toISOString() }, lessonFields)
      : Object.assign({ type: 'exam', name: _ecName, code: code, teacherUid: currentTeacher.uid,
          grade: _ecGrade, questionIds: questionIds, matchSections: matchSectionsData,
          counts: { total: totalQ, match: matchTotal }, sectionPoints: sectionPoints, sectionOrder: sectionOrder,
          sectionPageBreaks: breakData.sectionPageBreaks, breakBeforeQuestionIds: breakData.breakBeforeQuestionIds,
          active: true, createdAt: new Date().toISOString() }, lessonFields);
    p = db.collection(coll).add(newData)
          .then(function(ref) { return { id: ref.id, code: code, isUpdate: false }; });
  }

  p.then(function(result) {
    if (btn) { btn.disabled = false; btn.textContent = '📤 發布為線上測驗'; }
    _ecSessionId = null;
    if (result.isUpdate) {
      showToast('✅ 測驗已更新');
      _ecShowList();
    } else {
      showToast('✅ 線上測驗已建立！代碼：' + result.code);
      _ecShowList();
      if (typeof showQuizShareModal === 'function' && _ecSubject !== 'math') {
        setTimeout(function() { showQuizShareModal(result.id, _ecName); }, 400);
      }
    }
  }).catch(function(e) {
    showToast('失敗：' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = '📤 發布為線上測驗'; }
  });
}

/* ── 列印（從精靈 Step 4，先預覽再列印）── */
function _ecPrint() {
  if (!_ecSections.length && !_ecMatchSections.length) { showToast('試卷內容為空'); return; }
  _ecDoPrint(_ecName, _ecSections, _ecSubject, _ecMatchSections);
}

/* 列印入口：若有配對大題則先非同步抓圖片 URL，再開印刷視窗 */
function _ecDoPrint(name, sections, subject, matchSections) {
  matchSections = matchSections || [];
  var allWordIds = [];
  matchSections.forEach(function(ms) {
    (ms.wordIds || []).forEach(function(id) { allWordIds.push(id); });
  });

  if (allWordIds.length && db) {
    Promise.all(allWordIds.map(function(wid) {
      return db.collection('wordImages').doc(wid).get();
    })).then(function(wdocs) {
      var imgMap = {};
      wdocs.forEach(function(wd) { if (wd.exists) imgMap[wd.id] = wd.data().imageUrl || ''; });
      _ecOpenPrintWindow(name, sections, subject, matchSections, imgMap);
    }).catch(function() {
      _ecOpenPrintWindow(name, sections, subject, matchSections, {});
    });
  } else {
    _ecOpenPrintWindow(name, sections, subject, matchSections, {});
  }
}

function _ecOpenPrintWindow(name, sections, subject, matchSections, imgMap, graded) {
  var win = window.open('', '_blank');
  if (!win) { showToast('請允許瀏覽器彈出視窗後再試'); return; }
  win.document.write(_ecBuildPrintHtml(name, sections, subject, matchSections, imgMap, graded));
  win.document.close();
}

/* 產生完整列印 HTML
   graded（選填）：印「學生作答卷」——教師端測驗列表用 quizResultDetails 組出來的
   { studentName, scoreText, dateText }；這時每個題目物件上會多帶作答結果欄位
   （ua 學生答案、ok 對錯，句子重組另有 placed/right），連連看大題帶 pairs。版面跟空白
   試卷同一套，只是空格裡填上學生的答案、加紅筆 ○／✕ 跟訂正 */
function _ecBuildPrintHtml(name, sections, subject, matchSections, imgMap, graded) {
  var CN = ['一','二','三','四','五','六','七','八','九','十'];
  var DRAG_TYPES = ['詞語填空', '詞語解釋'];

  /* ─── 大題 HTML ─── */
  var body = '';
  var sn   = 0;

  sections.forEach(function(sec) {
    var key    = sec.key || '';
    var isDrag = DRAG_TYPES.indexOf(key) >= 0;
    var isMC   = key === '選擇題';
    var qs     = sec.questions || [];

    /* 手動分頁點：老師在 Step3 排版自己標過「這個大題從新的一頁開始」才會加，sn===0（這是
       印出來的第一個大題）的話不管有沒有標都不加——強制在最前面分頁只會白白空出一張全白的
       第一頁，沒有意義，索性忽略那個情境而不是依賴 UI 擋住（防呆兩邊都做，UI 那邊也同樣不
       給第一個大題顯示這個切換鈕） */
    body += '<div class="sec-block"' + (sec.pageBreakBefore && sn > 0 ? ' style="break-before:page"' : '') + '>';
    var _ecUC = _ecSectionUnitCount(sec);
    var secGot = '';
    if (graded) {
      var gotUnits = 0;
      qs.forEach(function(q) { gotUnits += key === '句子重組' ? (q.right || 0) : (q.ok ? 1 : 0); });
      secGot = _ecGSecGot(sec.points, gotUnits, _ecUC.count);
    }
    body += '<div class="sec-header">' + _ecEsc(sec.title || '') + _ecPointsSuffix(sec.points, _ecUC.count, _ecUC.unit) + secGot + '</div>';

    /* 默寫生字：不是逐題一行的 q-list，是看注音+語詞、在田字格裡寫字的方格排版，
       跟其他題型的版面完全不同，整段獨立處理、不走下面共用的 <ol class="q-list">。
       主要提示是「語詞挖空」（山谷→山（　）），不是字義——老師實際用過覺得看字義反而會
       混淆學生，詞語才是最直接的提示，字義只留在 admin 編輯畫面給老師自己參考，不印出來。
       舊資料（這次改版之前建立的）可能沒有 hintWord，印的時候退回顯示字義，不要讓舊題目
       印出一張除了注音什麼提示都沒有的空白卡片 */
    if (key === '默寫生字') {
      if (!graded) body += '<p class="dict-hint">看注音和語詞，在格子裡寫出正確的國字。</p>';
      body += '<div class="dict-grid">';
      qs.forEach(function(q) {
        var prompt = q.hintWord ? q.hintWord.split(q.label).join('（　）') : (q.answer || '');
        /* 作答卷：線上默寫不保留學生的筆跡，格子裡印正確的字、語詞前面標 ○／✕ */
        body += '<div class="dict-card">' +
          '<div class="dict-word">' + (graded ? _ecGMark(q.ok) : '') +
            _ecEsc(prompt).split('（　）').join('<span class="dict-blank">（　）</span>') + '</div>' +
          '<div class="dict-box-row"><div class="grid-box">' +
            (graded ? '<span class="g-dict-char">' + _ecEsc(q.label) + '</span>' : '') + '</div>' +
            '<span class="dict-zhuyin-v">' + _ecEsc(q.zhuyin || '') + '</span>' +
          '</div>' +
          '</div>';
      });
      body += '</div></div>';
      sn++;
      return; // forEach callback，等同 continue 到下一個 section
    }

    /* 答案池（拖曳型大題） */
    if (isDrag && qs.length) {
      var poolWords = qs.map(function(q) {
        return q.answer || _ecExtractFillAnswer(q.label);
      }).filter(Boolean);
      /* Fisher-Yates shuffle */
      for (var pi = poolWords.length - 1; pi > 0; pi--) {
        var pj = Math.floor(Math.random() * (pi + 1));
        var pt = poolWords[pi]; poolWords[pi] = poolWords[pj]; poolWords[pj] = pt;
      }
      body += '<div class="pool-box">';
      body += '<span class="pool-label">答案池</span>';
      poolWords.forEach(function(w) {
        body += '<span class="pool-chip">' + _ecEsc(w) + '</span>';
      });
      body += '</div>';
    }

    /* 句子重組的列印說明——跟答案池同一個位置（大題標題下面），只在這個題型出現一次，
       不是每題重複講一樣的話 */
    if (key === '句子重組' && !graded) {
      body += '<p class="dict-hint">下面每句的詞語已經打散、重新排列過了，請依照正確的句子順序，把代表的數字依序寫在空格裡。</p>';
    }

    /* 題目列表 */
    body += '<ol class="q-list">';
    qs.forEach(function(q, j) {
      var qBreak = q.breakBefore && !(sn === 0 && j === 0); /* 同樣的道理，印出來的第一題不加 */
      body += '<li class="q-item"' + (qBreak ? ' style="break-before:page"' : '') + '><span class="q-num">' + (j + 1) + '.</span>' +
        (graded ? _ecGMark(q.ok) : '') + '<span class="q-body">';

      if (graded) {
        body += _ecGradedQBody(key, q);

      } else if (key === '詞語解釋') {
        var ans    = q.answer || '';
        var blankW = Math.max(ans.length * 1.6, 3).toFixed(1) + 'em';
        body += _ecEsc(q.label) +
                '<span class="q-uline" style="width:' + blankW + '"></span>';

      } else if (key === '詞語填空') {
        body += _ecRenderFillBlank(q.label);

      } else if (isMC) {
        body += '<span class="q-text">' + _ecEsc(q.label) + '</span>';
        body += '<div class="mc-opts">';
        (q.options || []).forEach(function(opt) {
          body += '<div class="mc-opt">○ ' + _ecEsc(opt) + '</div>';
        });
        body += '</div>';

      } else if (subject === 'math') {
        body += _ecEsc(q.label) + '<span class="q-uline" style="width:5em"></span>＝<span class="q-uline" style="width:5em"></span>';

      } else if (key === '句子重組') {
        /* 原本這裡直接印 q.label（還原後的完整正確句子）——印出來等於直接把答案寫在考卷上，
           學生完全不用排、沒有題目可做。改成跟學生平板上作答一樣的精神：把片段打散、重新
           排列過再印出來（不是原本儲存的正確順序），每塊標一個圈圈數字，底下留幾個空格讓
           學生依照正確句子順序把數字填進去——紙本沒有拖曳，用「寫數字」模擬同樣的排序動作 */
        var pieces = (q.options || []).slice();
        var shuffled = pieces.map(function(p, oi) { return { text: p, orig: oi }; });
        for (var si = shuffled.length - 1; si > 0; si--) {
          var sj = Math.floor(Math.random() * (si + 1));
          var st = shuffled[si]; shuffled[si] = shuffled[sj]; shuffled[sj] = st;
        }
        body += '<div class="sr-print-pieces">';
        shuffled.forEach(function(p, idx) {
          body += '<span class="sr-piece-chip"><span class="sr-piece-num">' + _ecCircledNum(idx + 1) + '</span>' + _ecEsc(p.text) + '</span>';
        });
        body += '</div><div class="sr-print-answer">正確順序：';
        pieces.forEach(function() { body += '<span class="sr-answer-blank"></span>'; });
        body += '</div>';

      } else {
        body += _ecEsc(q.label);
      }

      body += '</span></li>';
    });
    body += '</ol></div>';
    sn++;
  });

  /* ─── 配對大題 ─── */
  matchSections.forEach(function(ms) {
    var secTitle = (CN[sn] || String(sn + 1)) + '、' + (ms.title || '連連看');

    /* 作答卷：紙上畫不出學生當時連的線，改成一組一列「圖片 → 學生連的詞語」逐組批改 */
    if (graded) {
      var pairs = ms.pairs || [];
      var got = pairs.filter(function(pr) { return pr.ok; }).length;
      body += '<div class="sec-block"><div class="sec-header">' + _ecEsc(secTitle) +
        _ecPointsSuffix(ms.points, pairs.length, '組') + _ecGSecGot(ms.points, got, pairs.length) + '</div>';
      body += '<div class="g-match-grid">';
      pairs.forEach(function(pr) {
        body += '<div class="g-match-row">' + _ecGMark(pr.ok) +
          (pr.imageUrl ? '<img class="g-match-img" src="' + _ecEscA(pr.imageUrl) + '" alt="">'
                       : '<span class="g-match-img">' + _ecEsc(pr.word) + '</span>') +
          '<span class="g-match-arrow">→</span>' +
          '<span class="g-match-word">' + (pr.connected ? _ecEsc(pr.connected) : '<span class="g-blank-ua">未作答</span>') + '</span>' +
          (pr.ok ? '' : '<span class="g-fix">' + _ecEsc(pr.word) + '</span>') +
          '</div>';
      });
      body += '</div></div>';
      sn++;
      return;
    }
    var wids   = ms.wordIds || [];
    var wwords = ms.words   || [];

    /* 左欄（圖片，保持原序）；右欄（詞語，隨機排列） */
    var rightWords = wwords.slice();
    for (var ri = rightWords.length - 1; ri > 0; ri--) {
      var rj = Math.floor(Math.random() * (ri + 1));
      var rt = rightWords[ri]; rightWords[ri] = rightWords[rj]; rightWords[rj] = rt;
    }

    body += '<div class="sec-block"' + (ms.pageBreakBefore && sn > 0 ? ' style="break-before:page"' : '') + '>';
    body += '<div class="sec-header">' + _ecEsc(secTitle) + _ecPointsSuffix(ms.points, ms.pairCount, '組') + '</div>';
    body += '<p class="match-hint">請以直線連接左方圖片與右方對應詞語</p>';
    body += '<div class="match-wrap">';

    /* 左欄 */
    body += '<div class="match-col match-col-l">';
    wids.forEach(function(wid, i) {
      var imgSrc = imgMap[wid] || '';
      body += '<div class="match-item">';
      if (imgSrc) body += '<img class="match-img" src="' + _ecEscA(imgSrc) + '" alt="">';
      else        body += '<div class="match-img match-img-empty">' + _ecEsc(wwords[i] || '') + '</div>';
      body += '<span class="match-ep match-ep-r">●</span>';
      body += '</div>';
    });
    body += '</div>';

    /* 中間空白連線區 */
    body += '<div class="match-col match-col-mid"></div>';

    /* 右欄 */
    body += '<div class="match-col match-col-r">';
    rightWords.forEach(function(w) {
      body += '<div class="match-item">';
      body += '<span class="match-ep match-ep-l">●</span>';
      body += '<span class="match-word">' + _ecEsc(w) + '</span>';
      body += '</div>';
    });
    body += '</div>';

    body += '</div></div>';
    sn++;
  });

  /* ─── CSS ───
     注意：字型路徑用 new URL(相對路徑, 目前頁面網址) 算出絕對網址，不能用
     window.location.origin + 絕對路徑——這個網站是部署在子路徑下（如 GitHub Pages 的
     /QuEDU/），origin 不含子路徑，會漏掉前綴導致字型 404，學生端完全看不到注音字型 */
  var _fontUrl2 = new URL('../assets/font/BPMFZIHIKAISTD-REGULAR.woff2', window.location.href).href;
  var _fontUrl  = new URL('../assets/font/BPMFZIHIKAISTD-REGULAR.TTF', window.location.href).href;
  var css = [
    '@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&display=swap");',
    '@font-face{font-family:"BpmfZihiKai";src:url("' + _fontUrl2 + '") format("woff2"),url("' + _fontUrl + '") format("truetype");font-display:swap}',
    '*{box-sizing:border-box}',
    'body{font-family:"BpmfZihiKai",serif;color:#1a1a2e;background:#fff;',
         'margin:0;padding:18mm 20mm;font-size:12pt;line-height:2.8}',
    'html.hide-ruby body{font-family:"Noto Sans TC",sans-serif;line-height:1.9}',
    '.sheet-title{font-size:17pt;font-weight:900;text-align:center;letter-spacing:.3em;margin-bottom:4px}',
    '.sheet-lesson{font-size:11pt;text-align:center;color:#3d3d5c;margin-bottom:14px}',
    '.sheet-meta{display:flex;gap:2.5em;font-size:11pt;padding-bottom:10px;',
                'border-bottom:2px solid #1a1a2e;margin-bottom:22px;flex-wrap:wrap}',
    '.sheet-meta-item{display:inline-flex;gap:.4em;align-items:baseline}',
    '.sheet-meta-line{display:inline-block;border-bottom:1.5px solid #1a1a2e;min-width:7em}',
    '.sec-block{margin-bottom:18px}',
    '.sec-header{border-left:4px solid #1a1a2e;padding:2px 0 2px 10px;',
                'font-size:13pt;font-weight:900;margin-bottom:10px}',
    /* 答案池 */
    '.pool-box{border:1.5px dashed #d4cfc0;border-radius:8px;',
              'padding:8px 12px;margin-bottom:12px;',
              'display:flex;flex-wrap:wrap;gap:6px;align-items:center;background:#ede8e0}',
    '.pool-label{font-size:9pt;font-weight:700;color:#3d3d5c;margin-right:4px;flex-shrink:0}',
    '.pool-chip{font-size:11pt;font-weight:700;border:1.5px solid #d4cfc0;',
               'border-radius:6px;padding:2px 10px;background:#fff}',
    /* 題目列表 */
    '.q-list{list-style:none;padding:0;margin:0}',
    '.q-item{display:flex;gap:6px;align-items:baseline;padding:6px 0;',
             'border-bottom:1px solid #ede8e0;flex-wrap:wrap}',
    '.q-num{font-weight:700;flex-shrink:0;min-width:1.8em}',
    '.q-body{flex:1;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px;line-height:2}',
    '.q-text{width:100%}',
    /* 底線空格 */
    '.q-uline{display:inline-block;border-bottom:1.5px solid #1a1a2e;',
              'min-width:3em;height:1.3em;vertical-align:baseline;margin:0 2px}',
    /* 選擇題 */
    '.mc-opts{width:100%;padding-left:.5em;margin-top:2px}',
    '.mc-opt{line-height:1.9}',
    /* 配對題 */
    '.match-hint{font-size:10pt;color:#3d3d5c;margin:0 0 12px}',
    '.match-wrap{display:flex;align-items:flex-start;gap:0}',
    '.match-col{display:flex;flex-direction:column}',
    '.match-col-l{gap:8px;align-items:flex-end}',
    '.match-col-mid{flex:1;min-width:40px}',
    '.match-col-r{gap:8px;align-items:flex-start}',
    '.match-item{display:flex;align-items:center;gap:6px;height:104px}',
    '.match-img{width:93px;height:93px;object-fit:cover;border-radius:6px;border:1px solid #d4cfc0}',
    '.match-img-empty{width:93px;height:93px;display:flex;align-items:center;justify-content:center;',
                      'font-size:11pt;font-weight:700;border:1px solid #d4cfc0;border-radius:6px}',
    '.match-ep{font-size:8pt;color:#aaa;line-height:1}',
    '.match-ep-r{margin-left:4px}',
    '.match-ep-l{margin-right:4px}',
    '.match-word{font-size:12pt;font-weight:700}',
    /* 默寫生字
       版面改過一次：原本注音是格子上方一個藍底藥丸、格子用 max-width+aspect-ratio 撐大小、
       十字線是偽元素的漸層背景畫出來的。這三個都在使用者實際用瀏覽器列印（不是預覽）時
       出了狀況：aspect-ratio 在印表機轉換時沒有確實撐出格子高度、漸層背景色在「背景圖形」
       沒勾選時整個被拿掉、注音藥丸的底色也一樣被拿掉。改成：格子用明確的 width+height（不依賴
       aspect-ratio）、十字線改用 border 畫（border 不受背景列印設定影響，永遠印得出來）、
       注音拿掉底色、改成直書（書寫模式 vertical-rl）放在格子右邊——這也是教育現場常見的
       注音標示方式。另外格子縮小、整組 card 間距收緊，讓一頁放得下更多字。之後老師反映影印時左右間隔太大，改成一排 5 題；語詞較長時會
       折成兩行，card 靠下對齊，同一排的格子才不會高低不齊。 */
    '.dict-hint{font-size:9.5pt;color:#3d3d5c;margin:0 0 10px}',
    '.dict-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px 6px}',
    '.dict-card{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px}',
    /* 語詞挖空是主要提示，字體要夠大夠粗——跟原本字義那行（小小一行灰字）地位完全不同 */
    '.dict-word{font-size:13pt;font-weight:800;color:#1a1a2e;line-height:1.3;padding:0 4px;text-align:center;min-height:1.4em;letter-spacing:.03em}',
    /* 全形括號＋全形空格佔 3 個字寬，一排 5 題時很容易折行，只把括號收窄、字體大小不動 */
    '.dict-blank{letter-spacing:-.28em;margin-right:.28em;white-space:nowrap}',
    '.dict-box-row{display:flex;align-items:stretch;gap:5px}',
    '.grid-box{position:relative;width:92px;height:92px;flex-shrink:0;',
              'border:1.5px solid #d4cfc0;border-radius:4px;background:#fff}',
    '.grid-box::before{content:"";position:absolute;left:0;right:0;top:50%;border-top:1px dashed #d4cfc0}',
    '.grid-box::after{content:"";position:absolute;top:0;bottom:0;left:50%;border-left:1px dashed #d4cfc0}',
    '.dict-zhuyin-v{writing-mode:vertical-rl;text-orientation:upright;font-size:10.5pt;line-height:1.2;',
                   'font-weight:800;color:#2563eb;letter-spacing:1px;display:flex;align-items:center}',
    /* 句子重組（列印版） */
    '.sr-print-pieces{width:100%;display:flex;flex-wrap:wrap;gap:6px;margin:4px 0}',
    '.sr-piece-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;',
                   'border:1.5px solid #d4cfc0;border-radius:14px;background:#f7f5ef;font-size:11pt}',
    '.sr-piece-num{font-weight:900;color:#2563eb}',
    '.sr-print-answer{width:100%;margin-top:6px;font-size:11pt;font-weight:700;',
                     'display:flex;align-items:center;gap:5px;flex-wrap:wrap}',
    '.sr-answer-blank{display:inline-block;width:1.7em;height:1.3em;border:1.5px solid #1a1a2e;',
                     'border-radius:4px;flex-shrink:0}',
    /* 學生作答卷（graded）：批改記號、訂正一律用紅色文字——文字顏色不受「背景圖形」列印設定影響 */
    '.g-mark{color:#dc2626;font-weight:900;font-size:14pt;flex-shrink:0;min-width:1.3em;font-family:"Noto Sans TC",sans-serif}',
    '.g-ua{display:inline-block;border-bottom:1.5px solid #1a1a2e;min-width:3em;padding:0 .3em;',
          'font-weight:700;color:#1d4ed8;text-align:center;margin:0 2px}',
    '.g-blank-ua{color:#9ca3af;font-weight:400}',
    '.g-fix{color:#dc2626;font-weight:800;margin-left:.6em}',
    '.g-fix::before{content:"訂正：";font-size:.85em}',
    '.g-sec-got{float:right;color:#dc2626;font-weight:900}',
    '.mc-opt.g-chosen{font-weight:800;color:#1d4ed8}',
    '.mc-opt.g-correct{color:#dc2626;font-weight:800}',
    '.sr-piece-chip.g-wrong{border-color:#dc2626;color:#dc2626}',
    '.g-dict-char{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;',
                 'font-size:44pt;line-height:1;color:#1a1a2e;font-family:"Noto Sans TC",sans-serif;z-index:1}',
    '.g-match-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 24px}',
    '.g-match-row{display:flex;align-items:center;gap:8px;break-inside:avoid;line-height:1.6}',
    '.g-match-img{width:70px;height:70px;object-fit:cover;border-radius:6px;border:1px solid #d4cfc0;',
                 'display:flex;align-items:center;justify-content:center;font-size:10pt;flex-shrink:0}',
    '.g-match-arrow{color:#9ca3af}',
    '.g-match-word{font-weight:700;color:#1d4ed8}',
    /* 列印按鈕列 */
    '.print-bar{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:28px}',
    '.print-btn{padding:9px 24px;font-size:11pt;cursor:pointer;font-weight:700;',
                'font-family:inherit;border:1.5px solid #1a1a2e;border-radius:8px;background:#fff}',
    '.print-sz-label{font-size:11pt;display:flex;align-items:center;gap:4px;font-family:inherit}',
    '.print-sz-input{width:3.8em;font-size:11pt;text-align:center;font-family:inherit;',
                    'border:1.5px solid #1a1a2e;border-radius:6px;padding:6px 4px}',
    '@media print{',
      '@page{size:A4 portrait;margin:15mm}',
      'body{padding:0}',
      '.print-bar{display:none}',
      /* Chrome 的「背景圖形」預設是關的，有背景色/背景圖樣式的元素（配對題的圖片格、答案池）
         沒開這個設定會被整個拿掉；強制打開不依賴使用者自己去列印對話框裡勾選 */
      '*{print-color-adjust:exact;-webkit-print-color-adjust:exact}',
      /* 大題本身可能比一頁還高，不能整塊 break-inside:avoid——否則瀏覽器只能把整塊往下一頁推，
         導致上一頁被擠成空白。改成只保護「單一題目」跟「大題標題」不被從中間切斷，
         大題允許正常跨頁，跨到下一頁自然接著排。 */
      '.sec-header{break-after:avoid}',
      '.q-item{break-inside:avoid}',
      '.match-item{break-inside:avoid}',
      '.pool-box{break-inside:avoid}',
      '.dict-card{break-inside:avoid}',
    '}'
  ].join('');

  /* ─── 頁首 ─── */
  var header = graded
    ? '<div class="sheet-title">' + _ecEsc(name) + '</div>' +
      '<div class="sheet-meta">' +
        '<span class="sheet-meta-item">姓名：<b>' + _ecEsc(graded.studentName || '') + '</b></span>' +
        '<span class="sheet-meta-item">作答時間：' + _ecEsc(graded.dateText || '') + '</span>' +
        '<span class="sheet-meta-item">得分：<b style="color:#dc2626;font-size:15pt">' + _ecEsc(graded.scoreText || '') + '</b></span>' +
      '</div>'
    : '<div class="sheet-title">' + _ecEsc(name) + '</div>' +
    '<div class="sheet-meta">' +
      '<span class="sheet-meta-item">班級：<span class="sheet-meta-line"></span></span>' +
      '<span class="sheet-meta-item">姓名：<span class="sheet-meta-line"></span></span>' +
      '<span class="sheet-meta-item">得分：<span class="sheet-meta-line" style="min-width:4em"></span></span>' +
    '</div>';

  var toggleJs = [
    '<script>',
    'function _toggleRuby(btn){',
    '  var on=document.documentElement.classList.toggle("hide-ruby");',
    '  btn.textContent=on?"📖 顯示注音":"📖 隱藏注音";',
    '}',
    'function _setFontSize(v){',
    '  var pt=Math.min(Math.max(parseInt(v)||12,8),36);',
    '  document.body.style.fontSize=pt+"pt";',
    '}',
    '<\/script>'
  ].join('');

  return '<!doctype html><html lang="zh-TW"><head>' +
    '<meta charset="utf-8">' +
    '<title>' + _ecEsc(name) + '</title>' +
    '<style>' + css + '</style>' +
    '</head><body>' +
    header + body +
    '<div class="print-bar">' +
      '<label class="print-sz-label">字體大小' +
        '<input id="sz-input" class="print-sz-input" type="number" value="12" min="8" max="36"' +
               ' oninput="_setFontSize(this.value)">pt' +
      '</label>' +
      '<button class="print-btn" onclick="_toggleRuby(this)">📖 隱藏注音</button>' +
      '<button class="print-btn" onclick="window.print()">🖨 列印</button>' +
    '</div>' +
    toggleJs +
    '</body></html>';
}

/* ── 學生作答卷用的小工具 ── */
function _ecGMark(ok) { return '<span class="g-mark">' + (ok ? '○' : '✕') + '</span>'; }

/* 大題標題右邊的得分：有配分印「得 X 分」，沒配分印「對 X／Y」 */
function _ecGSecGot(points, got, count) {
  var p = parseFloat(points);
  return '<span class="g-sec-got">' + (!isNaN(p) && p > 0
    ? '得 ' + (Math.round(p * got * 100) / 100) + ' 分'
    : '對 ' + got + '／' + count) + '</span>';
}

/* 單題內容：空格裡填學生的答案，答錯的後面寫訂正 */
function _ecGradedQBody(key, q) {
  var ua  = q.ua;
  var uaH = '<span class="g-ua">' + (ua ? _ecEsc(ua) : '<span class="g-blank-ua">未作答</span>') + '</span>';
  var fix = q.ok ? '' : '<span class="g-fix">' + _ecEsc(q.answer || '') + '</span>';

  if (key === '詞語填空') {
    return (q.label || '').split(/[（(][^）)]*[）)]/).map(function(p) { return _ecEsc(p); }).join(uaH) + fix;
  }
  if (key === '選擇題') {
    var h = '<span class="q-text">' + _ecEsc(q.label) + (ua ? '' : '　<span class="g-blank-ua">（未作答）</span>') + '</span><div class="mc-opts">';
    (q.options || []).forEach(function(opt) {
      var chosen = ua === opt, correct = opt === q.answer;
      h += '<div class="mc-opt' + (chosen ? ' g-chosen' : '') + (!q.ok && correct ? ' g-correct' : '') + '">' +
        (chosen ? '●' : '○') + ' ' + _ecEsc(opt) + (!q.ok && correct ? '　← 正確答案' : '') + '</div>';
    });
    return h + '</div>';
  }
  if (key === '句子重組') {
    /* 照學生排出來的順序印，放錯位置的片段標紅；部分計分，後面寫對了幾格 */
    var opts = q.options || [], placed = q.placed || [];
    var any = placed.some(function(oi) { return oi !== null && oi !== undefined; });
    var s = '<div class="sr-print-pieces">';
    if (!any) s += '<span class="g-blank-ua">未作答</span>';
    else opts.forEach(function(_, pos) {
      var oi = placed[pos];
      var txt = (oi !== null && oi !== undefined) ? opts[oi] : '＿';
      s += '<span class="sr-piece-chip' + (oi === pos ? '' : ' g-wrong') + '">' + _ecEsc(txt) + '</span>';
    });
    return s + '</div><div class="sr-print-answer">對 ' + (q.right || 0) + '／' + opts.length + ' 格' +
      (q.ok ? '' : '<span class="g-fix">' + _ecEsc(opts.join('')) + '</span>') + '</div>';
  }
  /* 詞語解釋及其他：題幹後面接學生答案 */
  return _ecEsc(q.label) + uaH + fix;
}

/* 將 詞語填空 題目的（答案）替換成底線空格 */
function _ecRenderFillBlank(label) {
  var m      = label.match(/[（(]([^）)]+)[）)]/);
  var ans    = m ? m[1].trim() : '';
  var blankW = ans ? Math.max(ans.length * 1.6, 3).toFixed(1) + 'em' : '4em';
  var blank  = '<span class="q-uline" style="width:' + blankW + '"></span>';
  var parts  = label.split(/[（(][^）)]*[）)]/);
  return parts.map(function(p) { return _ecEsc(p); }).join(blank);
}

/* 同上，但各段文字用 _zhToRuby 標注音 */
function _ecRenderFillBlankRuby(label) {
  var m      = label.match(/[（(]([^）)]+)[）)]/);
  var ans    = m ? m[1].trim() : '';
  var blankW = ans ? Math.max(ans.length * 1.6, 3).toFixed(1) + 'em' : '4em';
  var blank  = '<span class="q-uline" style="width:' + blankW + '"></span>';
  var parts  = label.split(/[（(][^）)]*[）)]/);
  return parts.map(function(p) { return _zhToRuby(p); }).join(blank);
}

/* 從 詞語填空 題目文字中提取括號內的答案 */
function _ecExtractFillAnswer(label) {
  var m = (label || '').match(/[（(]([^）)]+)[）)]/);
  return m ? m[1].trim() : '';
}
