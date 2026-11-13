/**
 * admin/exam-compose-dictation.js — 試卷編製精靈：「默寫生字」題目的新增／編輯／批次建立
 * 原本是 exam-compose.js 的一部分，照章節拆成獨立檔案，內容沒有改。
 * 共用的狀態變數（_ec*、_qe*、_dct*）宣告在 exam-compose.js；各檔的函式都是全域的，可以互相呼叫。
 * 依賴：shared.js（db、showToast）、init.js（currentTeacher）、exam-compose.js
 */
'use strict';

/* ════════════════════════════════
   默寫生字
   生字清單直接取自「練字趣」（apps/learn/lang/chinese）在用的 curriculum collection，
   不是另外開一套輸入工具手動打字——老師在練字趣後台維護好一次「這一課有哪些生字」，
   這裡跟詞語填空/句子重組一樣選到「默寫生字」篩選值才出現「選字」入口（不要做獨立區塊）。
   字義刻意跟「詞語解釋」共用同一筆資料（_ecAllQ 裡找同一個字的詞語解釋答案），
   同一個字不用老師分兩個地方各打一次意思。注音是唯一沒有既有資料可以借的欄位，
   開 modal 時即時查萌典（跟練字趣 char-info.js 同一個公開 API），抓不到或是多音字
   自己選都可以，最後存檔的是老師確認過的文字，不是每次都重新查。 */

/* 查某一課在 curriculum 裡的生字陣列；查過的課快取住，避免篩選/搜尋時重複打 Firestore。
   curriculum 文件結構跟教師帳號無關（全校共用的課程資料），docId 是 grade+'_l'+lessonNum
   這個慣例（admin/curriculum-data.js 建立時就是這樣命名），用數字課次直接查 doc 比 where 查詢快。 */
function _ecFetchCurriculumChars(version, volume, lesson, cb) {
  var key = version + '|' + volume + '|' + lesson;
  if (_dctCurrCache.hasOwnProperty(key)) { cb(_dctCurrCache[key]); return; }
  var lessonNum = _CN_MAP[lesson];
  if (!db || !version || !volume || lessonNum === undefined) { cb(null); return; }

  db.collection('curriculum').where('name', '==', version).limit(1).get()
    .then(function(verSnap) {
      if (verSnap.empty) { _dctCurrCache[key] = null; cb(null); return; }
      var verId = verSnap.docs[0].id;
      return db.collection('curriculum').doc(verId).collection('lessons')
        .doc(volume + '_l' + lessonNum).get();
    })
    .then(function(lDoc) {
      if (!lDoc) return; // 上一步已經 cb 過了（找不到版本）
      var chars = (lDoc.exists && lDoc.data().chars) ? lDoc.data().chars : null;
      _dctCurrCache[key] = chars;
      cb(chars);
    })
    .catch(function() { _dctCurrCache[key] = null; cb(null); });
}

/* Step 2 選題面板裡「默寫生字」篩選值專屬的選字入口——列出這一課的生字，已經出過題的
   字顯示「✓ 已出題」可以點去編輯，還沒出的字顯示「＋」可以點去新增 */
function _ecRenderDictCreateRow(grade, lesson) {
  var row = document.getElementById('ec-dict-create-row');
  if (!row) return;
  if (!_ecVersion || !_ecVolume || !lesson) {
    row.innerHTML = '<div style="font-size:.82rem;color:var(--muted)">請先在上方選擇特定課次（默寫生字的生字清單跟著課次走）</div>';
    return;
  }
  row.innerHTML = '<div style="font-size:.82rem;color:var(--muted)">讀取生字清單中…</div>';
  var lessonName = ((_ecAllLessonTexts || []).filter(function(x) { return x.grade === grade && x.lesson === lesson; })[0] || {}).lessonName || _ecLessonName || '';

  _ecFetchCurriculumChars(_ecVersion, _ecVolume, lesson, function(chars) {
    if (!chars || !chars.length) {
      row.innerHTML = '<div style="font-size:.82rem;color:var(--muted)">練字趣裡還沒有「' + _ecEsc(_ecVersion + _ecVolume) +
        ' 第' + _ecEsc(lesson) + '課」的生字資料，請先到練字趣後台的「課程版本」維護這一課的生字。</div>';
      return;
    }
    /* 存檔現在改用固定 docId，新建立的不會再重複；但這個 lesson 底下可能還留著改版之前
       用亂數 id 重複建出來的舊題目，掃一次順便抓出來，有的話在選字區上面放一個清掉的入口——
       只有真的有重複才出現，不是永久固定的區塊 */
    var byChar = {}; // char -> [題目...]
    _ecAllQ.forEach(function(q) {
      if (q.type === '默寫生字' && q.grade === grade && q.lesson === lesson) {
        (byChar[q.question] = byChar[q.question] || []).push(q);
      }
    });
    var dupeChars = Object.keys(byChar).filter(function(c) { return byChar[c].length > 1; });
    var dupeBanner = dupeChars.length
      ? '<div style="margin-bottom:10px;padding:8px 12px;border:1.5px solid #c9780c;border-radius:8px;background:#fdf3e3;' +
          'display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
          '<span style="font-size:.82rem;color:#8a5a0a">⚠️ 這一課有 ' + dupeChars.length + ' 個字重複出題（' + dupeChars.join('、') + '）</span>' +
          '<button type="button" onclick="_ecDedupeDictChars(\'' + _ecEscJs(grade) + '\',\'' + _ecEscJs(lesson) + '\')" ' +
            'style="padding:5px 12px;border:1.5px solid #c9780c;border-radius:7px;background:white;color:#8a5a0a;' +
            'font-weight:800;font-size:.8rem;cursor:pointer;font-family:inherit">清除重複，各留一題</button>' +
        '</div>'
      : '';

    var existing = {}; // char -> 完整題目物件（重複的話留下面 _ecDedupeExistingPick 選出的那一個代表）
    Object.keys(byChar).forEach(function(c) { existing[c] = _ecDedupeExistingPick(byChar[c], grade, lesson, c); });
    row.innerHTML = dupeBanner +
      '<div style="font-size:.78rem;color:var(--muted);font-weight:700;margin-bottom:6px">選這一課的生字來出題（右下角全選／全不選也會套用在這裡）：</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px">' +
      chars.map(function(c) {
        var q = existing[c];
        var selected = q && _ecSelected[q.id];
        /* 批次全選建的題目如果查不到注音或語詞，欄位會留空，用 ⚠️ 標記提醒老師自己點進去補，
           不要跟真的填完整的 ✓ 混在一起分不出來——語詞是現在列印版面的主要內容，缺了印出來
           會變成只有注音、沒有題目可寫，比缺字義嚴重得多，所以用語詞（不是字義）判斷完整度 */
        var incomplete = q && (!q.zhuyin || !q.hintWord);
        var color, bg, mark, action;
        if (!q) {
          color = 'var(--border)'; bg = 'white'; mark = '';
          action = '_ecOpenDictModal(\'' + _ecEscJs(c) + '\',\'' + _ecEscJs(lesson) + '\',\'' + _ecEscJs(lessonName) + '\')';
        } else if (!selected) {
          /* 已經出過題、但目前沒選進這份測驗（使用者在下面清單取消勾選過）——灰階顯示，
             點一下直接選回來，不用重新開 modal、不會弄丟已經查好的注音/字義 */
          color = 'var(--muted)'; bg = 'var(--gray-lt,#f5f5f5)'; mark = '';
          action = '_ecToggleDictCharSelect(\'' + _ecEscJs(q.id) + '\')';
        } else {
          color = incomplete ? '#c9780c' : 'var(--green,#2e7d32)';
          bg    = incomplete ? '#fdf3e3' : '#eaf6ec';
          mark  = incomplete ? ' ⚠️' : ' ✓';
          action = '_ecOpenDictModalForEdit(\'' + _ecEscJs(q.id) + '\')';
        }
        return '<button type="button" onclick="' + action + '" ' +
          'style="padding:6px 14px;border:1.5px solid ' + color + ';border-radius:8px;' +
          'background:' + bg + ';font-size:1rem;font-weight:800;cursor:pointer;font-family:inherit;color:' + color + '">' +
          _ecEsc(c) + mark + '</button>';
      }).join('') +
      '</div>';
  });
}

/* 同一個字有好幾筆重複題目時，選字區的 chip 要代表哪一筆——優先選 id 已經符合新版固定
   id 規則的那筆（代表改版後留下來的那份），沒有的話退而求其次選最新建立的那筆，單純是給
   畫面一個穩定的代表，實際清除重複由 _ecDedupeDictChars 處理，這裡不動資料 */
function _ecDedupeExistingPick(docs, grade, lesson, char) {
  if (docs.length === 1) return docs[0];
  var canonicalId = _dctMakeDocId(grade, lesson, char);
  var canonical = docs.filter(function(d) { return d.id === canonicalId; })[0];
  if (canonical) return canonical;
  return docs.slice().sort(function(a, b) {
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  })[0];
}

/* 「清除重複，各留一題」——每個字留 _ecDedupeExistingPick 選出的那一筆，其餘從 Firestore
   刪掉，同步清掉 _ecAllQ／_ecSelected。這是舊版用 Firestore 亂數 id 建檔時期留下的歷史包袱，
   改成固定 id 之後不會再有新的重複，但已經建出來的舊重複不會自動消失，所以才需要這個手動
   清理入口——只在真的偵測到重複時才出現，不是永久固定的按鈕 */
function _ecDedupeDictChars(grade, lesson) {
  if (!db) return;
  var byChar = {};
  _ecAllQ.forEach(function(q) {
    if (q.type === '默寫生字' && q.grade === grade && q.lesson === lesson) {
      (byChar[q.question] = byChar[q.question] || []).push(q);
    }
  });
  var toDelete = [];
  Object.keys(byChar).forEach(function(c) {
    var docs = byChar[c];
    if (docs.length <= 1) return;
    var keep = _ecDedupeExistingPick(docs, grade, lesson, c);
    docs.forEach(function(d) { if (d.id !== keep.id) toDelete.push(d.id); });
  });
  if (!toDelete.length) { showToast('沒有偵測到重複的題目'); return; }
  if (!confirm('確定要清除 ' + toDelete.length + ' 筆重複的默寫生字嗎？每個字會保留一題，其餘刪除，此操作無法復原。')) return;

  Promise.all(toDelete.map(function(id) { return db.collection('questions').doc(id).delete().catch(function() {}); }))
    .then(function() {
      var deletedSet = {};
      toDelete.forEach(function(id) { deletedSet[id] = true; });
      _ecAllQ = _ecAllQ.filter(function(q) { return !deletedSet[q.id]; });
      toDelete.forEach(function(id) { delete _ecSelected[id]; });
      showToast('✅ 已清除 ' + toDelete.length + ' 筆重複題目');
      _ecBuildFilters();
      _ecFilterAndRender();
    });
}

/* 默寫生字新增（不管是單字一個一個點，還是「全選」批次建立）一律用這個算出來的固定 id 當
   docId，不要用 Firestore 的 `.add()` 自動產生亂數 id。這是「同一個字＋同一課＋同一個老師」
   建兩次會發生什麼事」的問題的根本解——之前抓重複建檔一路抓（連點兩次「全選」、個別字的
   modal 搞不好也能雙擊兩次存兩次、甚至同一個老師開兩個分頁同時操作），每種情境都要各自補
   一個時機判斷式的鎖，補不完，而且分頁之間完全沒辦法用同一支 js 檔案裡的變數互相擋。
   改成固定 id 之後，不管從哪裡、按幾次、幾個分頁同時按，寫入的都是同一份文件，
   第二次之後的寫入只是覆蓋同一筆、不會再多出一筆，從資料層徹底排除重複，不用再逐一堵邏輯漏洞。 */
function _dctMakeDocId(grade, lesson, char) {
  var uid = currentTeacher ? currentTeacher.uid : '';
  return 'dict_' + encodeURIComponent(uid + '|' + grade + '|' + lesson + '|' + char);
}

/* 新增：點生字清單裡還沒出題的字 */
function _ecOpenDictModal(char, lesson, lessonName) {
  var modal = document.getElementById('dict-modal');
  if (!modal) return;
  _dctDocId = null; _dctChar = char; _dctLesson = lesson; _dctLessonName = lessonName;

  document.getElementById('dict-modal-title').textContent = '✍️ 新增默寫生字';
  document.getElementById('dict-char-display').textContent = char;
  document.getElementById('dict-lesson-display').textContent = (_ecVersion + _ecVolume) + ' 第' + lesson + '課' + (lessonName ? '　' + lessonName : '');
  document.getElementById('dict-zhuyin').value = '';
  document.getElementById('dict-zhuyin-opts').innerHTML = '';
  document.getElementById('dict-hint').value = '';
  document.getElementById('dict-hint-opts').innerHTML = '';
  document.getElementById('dict-delete-btn').style.display = 'none';
  document.getElementById('dict-save-btn').textContent = '加入這份測驗';

  /* 字義：優先借同一個字在這一課的「詞語解釋」答案；借不到的話等等 _dctFetchZhuyin 查完萌典，
     用萌典本身的解釋頂上去（練字趣的字義欄位就是同一個 API 來的），兩邊都沒有才讓老師自己打 */
  var sharedDef = _ecAllQ.filter(function(q) {
    return q.type === '詞語解釋' && q.grade === _ecGrade && q.lesson === lesson && q.question === char;
  })[0];
  _dctHasSharedDef = !!sharedDef;
  document.getElementById('dict-meaning').value = sharedDef ? sharedDef.answer : '';

  var statusEl = document.getElementById('dict-status');
  if (statusEl) { statusEl.style.color = 'var(--muted)'; statusEl.textContent = sharedDef ? '字義已帶入「詞語解釋」裡的答案，可以直接改' : '查詢萌典字典中…'; }

  modal.style.display = 'flex';
  _dctFetchZhuyin(char);
}

/* 編輯：點生字清單裡已經出過題的字（顯示 ✓），或是 Step2 清單裡點這一題 */
function _ecOpenDictModalForEdit(docId) {
  var q = null;
  for (var k = 0; k < _ecAllQ.length; k++) { if (_ecAllQ[k].id === docId) { q = _ecAllQ[k]; break; } }
  if (!q) return;
  var modal = document.getElementById('dict-modal');
  if (!modal) return;
  _dctDocId = docId; _dctChar = q.question; _dctLesson = q.lesson; _dctLessonName = q.lessonName;

  document.getElementById('dict-modal-title').textContent = '✍️ 編輯默寫生字';
  document.getElementById('dict-char-display').textContent = q.question;
  document.getElementById('dict-lesson-display').textContent = (q.grade || _ecGrade) + ' 第' + q.lesson + '課' + (q.lessonName ? '　' + q.lessonName : '');
  document.getElementById('dict-zhuyin').value = q.zhuyin || '';
  document.getElementById('dict-zhuyin-opts').innerHTML = '';
  document.getElementById('dict-meaning').value = q.answer || '';
  document.getElementById('dict-hint').value = q.hintWord || '';
  document.getElementById('dict-hint-opts').innerHTML = '';
  document.getElementById('dict-delete-btn').style.display = '';
  document.getElementById('dict-save-btn').textContent = '儲存變更';

  var statusEl = document.getElementById('dict-status');
  if (statusEl) { statusEl.style.color = 'var(--muted)'; statusEl.textContent = ''; }

  modal.style.display = 'flex';
}

/* 選字區裡「已出題但目前沒選進這份測驗」的灰色 chip 點一下直接選回來——題目資料已經存在
   （注音/字義都還在），不需要重新開 modal，純粹是把它加回 _ecSelected 再重畫 */
function _ecToggleDictCharSelect(docId) {
  _ecSelected[docId] = true;
  var el = document.getElementById('ec-selected-count');
  if (el) el.textContent = Object.keys(_ecSelected).length;
  _ecFilterAndRender();
}

function _dctStripHtml(str) {
  if (!str) return '';
  return String(str).replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/* 從萌典一個讀音底下的所有 definitions.example 裡抓造詞——跟 char-info.js 的 wordDefPairs
   同一套邏輯（例句裡用「」框起來的就是詞例，2～4 字、含目標字、去重，最多抓 5 個），
   移過來是因為默寫生字跟練字趣要的格式不一樣（這裡只要詞本身拿去挖空用，不需要連著解釋） */
function _dctExtractWords(char, heteronym) {
  var words = []; var seen = {};
  (heteronym.definitions || []).forEach(function(d) {
    if (!d.example || words.length >= 5) return;
    d.example.forEach(function(ex) {
      if (words.length >= 5) return;
      var cleaned = _dctStripHtml(ex).replace(/～/g, char);
      var matches = cleaned.match(/「([^」]+)」/g) || [];
      matches.forEach(function(m) {
        if (words.length >= 5) return;
        var word = m.replace(/「|」/g, '').trim();
        if (word.length >= 2 && word.length <= 4 && word.indexOf(char) !== -1 && !seen[word]) {
          seen[word] = true;
          words.push(word);
        }
      });
    });
  });
  return words;
}

/* 查萌典抓一個字的所有讀音＋對應解釋＋造詞——跟練字趣 char-info.js 用同一個公開 API，解釋
   欄位就是練字趣「字義」卡片顯示的同一筆資料（截圖裡「表現、表演。為英語show的音譯。」那個），
   造詞欄位就是練字趣「造詞」卡片顯示的同一批詞（截圖裡「山谷／河谷」那個）。
   純查詢邏輯跟「查完要不要畫 UI」分開：單一新增 modal 用這個結果畫可點選的讀音按鈕
   （_dctFetchZhuyin），批次全選用這個結果直接挑第一個讀音自動建檔（_ecBulkCreateMissingDictChars）。
   查不到就回傳空陣列，由呼叫端決定怎麼辦，不是只有一種用法 */
function _dctLookupZhuyin(char, cb) {
  fetch('https://www.moedict.tw/' + encodeURIComponent(char) + '.json')
    .then(function(res) { if (!res.ok) throw new Error('not found'); return res.json(); })
    .then(function(data) {
      var seen = {}; var opts = [];
      (data.heteronyms || []).forEach(function(h) {
        var bp = h.bopomofo || '';
        if (!bp || seen[bp]) return;
        seen[bp] = true;
        var def = (h.definitions && h.definitions[0]) ? _dctStripHtml(h.definitions[0].def) : '';
        opts.push({ bopomofo: bp, def: def, words: _dctExtractWords(char, h) });
      });
      cb(opts);
    })
    .catch(function() { cb([]); });
}

/* 新增 modal 專用：查完畫成可點選的讀音按鈕，查不到或老師不滿意都可以直接改 #dict-zhuyin
   這個輸入框，不依賴這次查詢成功。字義如果沒有借到「詞語解釋」的答案，這裡用第一個讀音
   查到的萌典解釋頂上去（練字趣顯示的字義就是這筆資料），一樣只是預填，老師可以直接改。
   造詞提示（挖空放在寫字格下面那行）同一次查詢順便帶出來，換讀音時造詞選項會跟著換
   （不同讀音的造詞不一樣），但不會動已經填進 #dict-hint 的文字，避免蓋掉老師自己選/打的 */
function _dctFetchZhuyin(char) {
  var optsEl = document.getElementById('dict-zhuyin-opts');
  if (optsEl) optsEl.innerHTML = '<span style="font-size:.78rem;color:var(--muted)">查詢注音中…</span>';
  _dctLookupZhuyin(char, function(opts) {
    if (_dctChar !== char) return; // modal 已經切換到別的字，這次結果不要套用
    _dctZhuyinOpts = opts;
    var statusEl  = document.getElementById('dict-status');
    var meaningEl = document.getElementById('dict-meaning');

    if (!_dctHasSharedDef && meaningEl && !meaningEl.value.trim() && opts.length && opts[0].def) {
      meaningEl.value = opts[0].def;
      if (statusEl) { statusEl.style.color = 'var(--muted)'; statusEl.textContent = '注音和字義都已帶入萌典字典的解釋，可以直接改'; }
    } else if (!_dctHasSharedDef && statusEl && statusEl.textContent === '查詢萌典字典中…') {
      statusEl.textContent = '';
    }

    _dctRenderHintOpts(opts.length ? (opts[0].words || []) : []);
    var hintEl = document.getElementById('dict-hint');
    if (hintEl && !hintEl.value.trim() && opts.length && opts[0].words && opts[0].words.length) {
      hintEl.value = opts[0].words[0];
    }

    if (!optsEl) return;
    if (!opts.length) { optsEl.innerHTML = '<span style="font-size:.78rem;color:var(--muted)">查無資料，請自行輸入</span>'; return; }
    optsEl.innerHTML = opts.map(function(o, i) {
      return '<button type="button" onclick="_dctSelectZhuyinOpt(' + i + ')" ' +
        'style="padding:4px 12px;border:1.5px solid var(--blue);border-radius:7px;background:' + (i === 0 ? 'var(--blue)' : 'white') + ';' +
        'color:' + (i === 0 ? 'white' : 'var(--blue)') + ';font-weight:800;font-size:.85rem;cursor:pointer;font-family:inherit;margin-right:6px">' +
        _ecEsc(o.bopomofo) + '</button>';
    }).join('');
    if (!document.getElementById('dict-zhuyin').value) document.getElementById('dict-zhuyin').value = opts[0].bopomofo;
  });
}

/* 讀音按鈕點了之後：換注音＋把造詞選項換成這個讀音底下查到的那批（不同讀音的造詞不一樣） */
function _dctSelectZhuyinOpt(i) {
  var o = _dctZhuyinOpts[i];
  if (!o) return;
  document.getElementById('dict-zhuyin').value = o.bopomofo;
  _dctRenderHintOpts(o.words || []);
}

function _dctRenderHintOpts(words) {
  var el = document.getElementById('dict-hint-opts');
  if (!el) return;
  if (!words.length) { el.innerHTML = '<span style="font-size:.78rem;color:var(--muted)">查無造詞，可自行輸入</span>'; return; }
  el.innerHTML = words.map(function(w) {
    return '<button type="button" onclick="document.getElementById(\'dict-hint\').value=\'' + _ecEscJs(w) + '\'" ' +
      'style="padding:4px 12px;border:1.5px solid var(--blue);border-radius:7px;background:white;' +
      'color:var(--blue);font-weight:800;font-size:.85rem;cursor:pointer;font-family:inherit;margin-right:6px">' +
      _ecEsc(w) + '</button>';
  }).join('');
}

/* 「全選」套用到默寫生字：把這一課還沒出題的生字一次全部建好——逐字查萌典注音＋造詞（挑第一個
   讀音跟第一個候選語詞，多音字/多個候選詞老師事後可以點進去改），順便借同一個字的「詞語解釋」
   答案當字義備註，字跟字之間錯開 150ms 查詢避免一次塞爆萌典 API（跟練字趣 preloadCharInfoAll
   同樣的節流手法）。查不到注音或語詞不會整個跳過不建，還是會建檔，只是那個欄位留空，靠
   _ecRenderDictCreateRow 畫出來的「⚠️」標記提醒老師自己點進去補——語詞是列印版面的主要內容，
   缺語詞比缺字義嚴重（印出來會變成沒有題目內容，只剩注音），所以完整度是看語詞不是看字義，
   不會因為某個字查詢失敗就整批卡住。

   這個過程要跑好幾秒（逐字查詢+節流），使用者等不及重複按「全選」的話，第二次呼叫一開始算
   出來的 existing／queue 會是第一次呼叫還沒寫完時的舊快照，兩邊都會排進同一批字，造成
   同一個字被建立兩次（真的在正式環境發生過：連續按兩次，跑到一半的那幾個字重複建檔）。
   用一個簡單的執行中旗標擋掉重複呼叫，不是靠停用按鈕這種 UI 層的做法（UI 可能漏接事件），
   直接在函式本體擋，不管從哪裡呼叫都安全。

   踩過一次坑：旗標原本設在 _ecFetchCurriculumChars 的 callback 裡面才 `= true`，
   但那個查詢本身就是非同步的（即使有快取，也是透過 Promise resolve，不是真的同步）——
   兩次連續呼叫都會在旗標被設成 true 之前就先通過最上面那行的檢查，照樣各自排一批佇列，
   等於完全沒擋到。旗標一定要在函式最開頭、呼叫任何非同步操作之前就同步設成 true，
   中間完全不能有 await/then 的空隙，不然這個鎖形同虛設。 */
var _dctBulkRunning = false;

function _ecBulkCreateMissingDictChars(grade, lesson) {
  if (!db || !_ecVersion || !_ecVolume || !lesson) return;
  if (_dctBulkRunning) { showToast('批次建立還在進行中，請稍候…'); return; }
  _dctBulkRunning = true; // 同步設定，不能等任何非同步結果回來才設
  var btn = document.getElementById('ec-select-all-btn');
  if (btn) { btn.disabled = true; btn.textContent = '建立中…'; }

  function finishRun() {
    _dctBulkRunning = false;
    if (btn) { btn.disabled = false; btn.textContent = '全選'; }
  }

  _ecFetchCurriculumChars(_ecVersion, _ecVolume, lesson, function(chars) {
    if (!chars || !chars.length) { finishRun(); return; }
    var lessonName = ((_ecAllLessonTexts || []).filter(function(x) { return x.grade === grade && x.lesson === lesson; })[0] || {}).lessonName || _ecLessonName || '';
    var existing = {};
    _ecAllQ.forEach(function(q) { if (q.type === '默寫生字' && q.grade === grade && q.lesson === lesson) existing[q.question] = true; });
    var queue = chars.filter(function(c) { return !existing[c]; });
    if (!queue.length) { finishRun(); return; }

    var created = 0;
    showToast('批次建立默寫生字中…（共 ' + queue.length + ' 字）');

    function next(i) {
      if (i >= queue.length) {
        finishRun();
        showToast('✅ 已建立 ' + created + ' 題默寫生字（查不到注音/語詞的已用 ⚠️ 標記，可點進去補）');
        _ecBuildFilters();
        _ecFilterAndRender();
        return;
      }
      var c = queue[i];
      var sharedDef = _ecAllQ.filter(function(q) {
        return q.type === '詞語解釋' && q.grade === grade && q.lesson === lesson && q.question === c;
      })[0];
      _dctLookupZhuyin(c, function(opts) {
        var meaning  = sharedDef ? sharedDef.answer : ((opts[0] && opts[0].def) ? opts[0].def : '');
        var hintWord = (opts[0] && opts[0].words && opts[0].words.length) ? opts[0].words[0] : '';
        var data = {
          grade: grade, lesson: lesson, lessonName: lessonName,
          type: '默寫生字', question: c, answer: meaning, zhuyin: opts[0] ? opts[0].bopomofo : '', hintWord: hintWord,
          options: [], teacherUid: currentTeacher ? currentTeacher.uid : '', createdAt: new Date().toISOString()
        };
        var docId = _dctMakeDocId(grade, lesson, c);
        db.collection('questions').doc(docId).set(data).then(function() {
          var full = Object.assign({ id: docId }, data);
          _ecAllQ.push(full);
          _ecSelected[docId] = true;
          created++;
        }).catch(function() {}).then(function() {
          setTimeout(function() { next(i + 1); }, 150);
        });
      });
    }
    next(0);
  });
}

function _dctCloseModal() {
  var modal = document.getElementById('dict-modal');
  if (modal) modal.style.display = 'none';
  _dctDocId = null; _dctChar = ''; _dctZhuyinOpts = [];
}

function _dctSaveQuestion() {
  if (!db || !_dctChar) return;
  var statusEl = document.getElementById('dict-status');
  function fail(msg) { if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = msg; } }

  var zhuyin  = document.getElementById('dict-zhuyin').value.trim();
  var meaning = document.getElementById('dict-meaning').value.trim();
  var hintWord = document.getElementById('dict-hint').value.trim();
  if (!zhuyin)   { fail('注音不能空白'); return; }
  if (!hintWord) { fail('語詞不能空白（考卷上印的就是這個詞挖空，沒有詞就沒有題目內容）'); return; }
  if (hintWord.indexOf(_dctChar) === -1) { fail('語詞裡要包含「' + _dctChar + '」這個字才能挖空，請修改'); return; }

  var data = {
    grade: _ecGrade, lesson: _dctLesson, lessonName: _dctLessonName,
    type: '默寫生字', question: _dctChar, answer: meaning, zhuyin: zhuyin, hintWord: hintWord, options: [],
    teacherUid: currentTeacher ? currentTeacher.uid : ''
  };

  var isEdit = !!_dctDocId;
  var docId  = isEdit ? _dctDocId : _dctMakeDocId(_ecGrade, _dctLesson, _dctChar);
  var fullData = isEdit ? data : Object.assign({ createdAt: new Date().toISOString() }, data);
  var p = db.collection('questions').doc(docId).set(fullData);

  p.then(function() {
    var full = Object.assign({ id: docId }, fullData);
    var idx = -1;
    for (var k = 0; k < _ecAllQ.length; k++) { if (_ecAllQ[k].id === docId) { idx = k; break; } }
    if (idx !== -1) {
      _ecAllQ[idx] = full;
    } else {
      _ecAllQ.push(full);
      if (!isEdit) _ecSelected[docId] = true;
    }
    _ecBuildFilters();
    _ecFilterAndRender();
    showToast(isEdit ? '✅ 已儲存變更' : '✅ 已加入「' + _dctChar + '」');
    _dctCloseModal();
  }).catch(function(e) { fail('儲存失敗：' + e.message); });
}

function _dctDeleteQuestion() {
  if (!db || !_dctDocId) return;
  if (!confirm('「' + _dctChar + '」這一題默寫生字要刪除嗎？此操作無法復原。')) return;
  var docId = _dctDocId;
  db.collection('questions').doc(docId).delete().then(function() {
    showToast('✅ 已刪除');
    _ecRemoveQFromList(docId);
    _dctCloseModal();
  }).catch(function(e) { showToast('❌ 刪除失敗：' + e.message); });
}
