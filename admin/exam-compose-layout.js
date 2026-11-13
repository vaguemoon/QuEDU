/**
 * admin/exam-compose-layout.js — 試卷編製精靈 Step 3：大題分組與排版（拖曳排序、配分、分頁點）
 * 原本是 exam-compose.js 的一部分，照章節拆成獨立檔案，內容沒有改。
 * 共用的狀態變數（_ec*、_qe*、_dct*）宣告在 exam-compose.js；各檔的函式都是全域的，可以互相呼叫。
 * 依賴：shared.js（db、showToast）、init.js（currentTeacher）、exam-compose.js
 */
'use strict';

/* ════════════════════════════════
   大題分組邏輯
   ════════════════════════════════ */
/* 新試卷預設沿用這位老師上一次發布的大題順序（存在這台電腦的 localStorage，依科目分開），
   老師習慣固定把某個題型放第一大題，不用每份都重拖 */
function _ecPrefOrderKey() {
  return 'ec_section_order_' + ((currentTeacher && currentTeacher.uid) || '') + '_' + _ecSubject;
}

function _ecBuildSections() {
  if (!_ecSecKeyOrder.length && !_ecSessionId) {
    try { _ecSecKeyOrder = JSON.parse(localStorage.getItem(_ecPrefOrderKey()) || '[]') || []; } catch (e) {}
  }
  _ecBuildSectionsRaw();
  /* 回 Step 2 把某個題型全部取消勾選、再勾回來，那個大題會先被拿掉再當成新大題接到最後面，
     Step 3 拖好的順序就跑掉了（2-3複習 的默寫生字就是這樣掉到最後）。所以老師排過的順序
     另外記在 _ecSecKeyOrder，每次重建完都照它排回去，沒記到的題型接在後面 */
  if (_ecSecKeyOrder.length) _ecApplySectionOrder(_ecSecKeyOrder);
  /* 暫時不在的題型保留在原位置（不能挪到最後，不然勾回來還是會掉到最後），新出現的題型接在後面 */
  _ecSections.forEach(function(sec) {
    if (_ecSecKeyOrder.indexOf(sec.key) < 0) _ecSecKeyOrder.push(sec.key);
  });
}

function _ecBuildSectionsRaw() {
  var groupKey = _ecSubject === 'math' ? 'category' : 'type';

  /* 建立 id → 題目 lookup */
  var qLookup = {};
  _ecAllQ.forEach(function(q) { qLookup[q.id] = q; });

  if (_ecSections.length) {
    /* 增量更新：保留現有排序，移除取消勾選的題目，加入新選的 */
    /* 已在大題裡的題目也要用 _ecAllQ 的最新內容覆蓋一次——Step 2 用 ✎ 改過題目（例如默寫生字
       換了語詞）後，_ecAllQ 是新的，但大題裡留的是當初建立時複製的舊物件，不刷新的話試卷/列印
       會印出改之前的內容。只覆蓋題目內容欄位，breakBefore 等排版設定保留 */
    _ecSections.forEach(function(sec) {
      sec.questions = sec.questions.filter(function(q) { return !!_ecSelected[q.id]; });
      sec.questions.forEach(function(qobj) {
        var q = qLookup[qobj.id];
        if (!q) return;
        qobj.label    = q.question || q.word || '';
        qobj.answer   = q.answer || q.word || '';
        qobj.options  = q.options || null;
        qobj.zhuyin   = q.zhuyin || '';
        qobj.hintWord = q.hintWord || '';
      });
    });
    _ecSections = _ecSections.filter(function(sec) { return sec.questions.length > 0; });

    var placed = {};
    _ecSections.forEach(function(sec) {
      sec.questions.forEach(function(q) { placed[q.id] = true; });
    });

    _ecAllQ.forEach(function(q) {
      if (!_ecSelected[q.id] || placed[q.id]) return;
      var key   = q[groupKey] || '其他';
      var label = q.question || q.word || '';
      var qobj  = { id: q.id, label: label, type: q.type || key,
                    answer: q.answer || q.word || '', options: q.options || null,
                    zhuyin: q.zhuyin || '', hintWord: q.hintWord || '' };
      var sec   = null;
      for (var i = 0; i < _ecSections.length; i++) {
        if (_ecSections[i].key === key) { sec = _ecSections[i]; break; }
      }
      if (sec) {
        sec.questions.push(qobj);
      } else {
        _ecSections.push({ title: key, key: key, collapsed: false, questions: [qobj] });
      }
    });

    _ecRenumberSections();
    return;
  }

  /* 全新建立 */
  var groups = {}, order = [];
  _ecAllQ.forEach(function(q) {
    if (!_ecSelected[q.id]) return;
    var key = q[groupKey] || '其他';
    if (!groups[key]) { groups[key] = []; order.push(key); }
    groups[key].push({ id: q.id, label: q.question || q.word || '',
                       type: q.type || key, answer: q.answer || q.word || '',
                       options: q.options || null, zhuyin: q.zhuyin || '', hintWord: q.hintWord || '' });
  });

  /* 排序大題 */
  if (_ecSubject === 'chinese') {
    order.sort(function(a, b) {
      var ia = _EC_TYPE_ORDER.indexOf(a); if (ia < 0) ia = 999;
      var ib = _EC_TYPE_ORDER.indexOf(b); if (ib < 0) ib = 999;
      return ia - ib;
    });
  } else {
    order.sort();
  }

  _ecSections = order.map(function(key, i) {
    return {
      title:     (_EC_CN[i] || String(i + 1)) + '、' + key,
      key:       key,
      collapsed: false,
      questions: groups[key]
    };
  });
}

function _ecRenumberSections() {
  _ecSections.forEach(function(sec, i) {
    /* 更新序號（保留「、」後面的自訂文字） */
    var idx  = sec.title.indexOf('、');
    var body = idx >= 0 ? sec.title.slice(idx + 1) : sec.key;
    sec.title = (_EC_CN[i] || String(i + 1)) + '、' + body;
  });
}

/* 大題順序：_ecBuildSections 全新建立時一律照 _EC_TYPE_ORDER 排，Step 3 拖曳調整過的順序
   要另外存成 sectionOrder（題型 key 陣列），載入已發布的測驗時在重建完之後照它重排。
   存檔裡沒列到的大題（舊測驗、或之後追加的新題型）維持原本相對順序接在後面 */
function _ecApplySectionOrder(order) {
  if (!order || !order.length) return;
  _ecSecKeyOrder = order.slice();
  _ecSections.sort(function(a, b) {
    var ia = order.indexOf(a.key); if (ia < 0) ia = 999;
    var ib = order.indexOf(b.key); if (ib < 0) ib = 999;
    return ia - ib;
  });
  _ecRenumberSections();
}

/* 配分：文字大題每次進入都是從題目清單現場重建（_ecBuildSections），不是從資料庫直接還原
   物件，所以配分存檔用「題型」當 key（{詞語填空:5, 選擇題:4, ...}），載入已發布的測驗時
   重建完大題結構後，這裡把存檔的配分一一套回對應題型的 sec.points 上。連連看大題不用這個
   函式——它本來整包物件就會存檔/還原，配分直接是物件上的一個欄位，跟著一起回來 */
function _ecApplySectionPoints(pointsMap) {
  if (!pointsMap) return;
  _ecSections.forEach(function(sec) {
    if (pointsMap[sec.key] !== undefined && pointsMap[sec.key] !== null) sec.points = pointsMap[sec.key];
  });
}

/* 把目前 _ecSections／_ecMatchSections 上的配分收集成存檔用的格式：
   文字大題收成 {題型: 分數} 的對照表；連連看大題配分本來就是物件自己的欄位，不用額外處理，
   呼叫端存 _ecMatchSections 的時候直接一起存進去就好 */
function _ecCollectSectionPoints() {
  var map = {};
  _ecSections.forEach(function(sec) {
    if (sec.points !== undefined && sec.points !== null && sec.points !== '') map[sec.key] = sec.points;
  });
  return map;
}

/* 手動分頁點（Step3「📄 分頁」切換鈕）的存檔/還原，跟配分同樣的理由、同樣的做法：
   大題本身用題型當 key 存一張 {題型:true} 的表；單一題目用題目自己的 Firestore docId
   存一個陣列——不能用「第幾個大題的第幾題」這種位置當 key，因為題目在大題裡的順序本來就
   沒有被持久化（_ecMoveQ 調整過的順序同樣不會存檔，是既有的限制，不是這次新增的），
   只有 docId 是不管重建幾次都不會變的穩定識別。連連看大題一樣不用這兩個函式，
   pageBreakBefore 直接是它自己物件上的欄位，整包存檔/還原。 */
function _ecCollectBreakData() {
  var sectionPageBreaks = {};
  _ecSections.forEach(function(sec) { if (sec.pageBreakBefore) sectionPageBreaks[sec.key] = true; });
  var breakBeforeQuestionIds = [];
  _ecSections.forEach(function(sec) {
    (sec.questions || []).forEach(function(q) { if (q.breakBefore) breakBeforeQuestionIds.push(q.id); });
  });
  return { sectionPageBreaks: sectionPageBreaks, breakBeforeQuestionIds: breakBeforeQuestionIds };
}

function _ecApplyBreakData(sectionPageBreaks, breakBeforeQuestionIds) {
  var idSet = {};
  (breakBeforeQuestionIds || []).forEach(function(id) { idSet[id] = true; });
  _ecSections.forEach(function(sec) {
    if (sectionPageBreaks && sectionPageBreaks[sec.key]) sec.pageBreakBefore = true;
    (sec.questions || []).forEach(function(q) { if (idSet[q.id]) q.breakBefore = true; });
  });
}

/* Step 3/4 admin 畫面自己看的總分提示（不印到考卷上）——純粹讓老師核對各大題配分加起來
   跟題數乘出來的分數是不是符合預期，不是100也不會擋，只是變色提醒 */
/* 句子重組一「題」底下其實是好幾塊打散的片段，線上作答本來就是每個片段位置各自計分
   （不是整句對錯二選一，見 submitQuiz 的 srTotal/srCorrect），紙本配分改成比照同一個邏輯用
   「格」（片段/空格）當單位，不是用「題」——不然一句切4塊跟切2塊的題目配分權重會不合理地
   一樣。其他題型維持原本「每題」的算法，這裡回傳 {unit, count} 讓配分相關的地方（Step3
   輸入框文字、admin 總分加總、列印的「（每X分，共Y分）」）都讀同一個來源，不要各自重算 */
function _ecSectionUnitCount(sec) {
  if (sec.key === '句子重組') {
    var total = 0;
    (sec.questions || []).forEach(function(q) { total += (q.options || []).length; });
    return { unit: '格', count: total };
  }
  return { unit: '題', count: (sec.questions || []).length };
}

function _ecComputeTotalPoints() {
  var total = 0; var hasAny = false;
  _ecSections.forEach(function(sec) {
    var p = parseFloat(sec.points);
    var uc = _ecSectionUnitCount(sec);
    if (!isNaN(p) && p > 0) { total += p * uc.count; hasAny = true; }
  });
  _ecMatchSections.forEach(function(msec) {
    var p = parseFloat(msec.points);
    if (!isNaN(p) && p > 0) { total += p * (msec.pairCount || 0); hasAny = true; }
  });
  return { total: total, hasAny: hasAny };
}

function _ecRenderPointsSummary(elId) {
  var el = document.getElementById(elId);
  if (!el) return;
  var r = _ecComputeTotalPoints();
  if (!r.hasAny) { el.textContent = ''; el.style.display = 'none'; return; }
  el.style.display = '';
  el.style.color = r.total === 100 ? 'var(--green,#2e7d32)' : '#c9780c';
  el.textContent = '目前各大題加總：' + r.total + ' 分' + (r.total === 100 ? '' : '（建議湊整到 100）');
}

/* ════════════════════════════════
   Step 3：排版（大題 + 摺疊）
   ════════════════════════════════ */
function _ecRenderLayout() {
  var wrap = document.getElementById('ec-layout-list');
  if (!wrap) return;

  var totalQ = 0;
  _ecSections.forEach(function(sec) { totalQ += (sec.questions || []).length; });
  _ecMatchSections.forEach(function(msec) { totalQ += msec.pairCount || 0; });
  var cntEl = document.getElementById('ec-layout-count');
  if (cntEl) cntEl.textContent = totalQ;

  if (!_ecSections.length && !_ecMatchSections.length) {
    wrap.innerHTML = '<p style="color:var(--muted);font-size:.85rem;padding:12px">尚未選擇任何題目</p>';
    return;
  }

  var bs = 'padding:3px 8px;border:1px solid var(--border);border-radius:6px;background:white;' +
           'cursor:pointer;font-size:.75rem;font-family:inherit';

  var textHtml = _ecSections.map(function(sec, si) {
    var qCount      = (sec.questions || []).length;
    var _ecUnitCount = _ecSectionUnitCount(sec);
    var collapsed = !!sec.collapsed;
    var arrow     = collapsed ? '▶' : '▼';
    var radius    = collapsed ? '10px' : '10px 10px 0 0';

    var header =
      '<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;' +
      'background:var(--blue-lt,#eff6ff);border-radius:' + radius + ';' +
      'border:1.5px solid var(--blue);cursor:pointer;user-select:none" ' +
      'onclick="_ecToggleSection(' + si + ')">' +
        '<span class="ec-drag-handle" title="拖曳調整大題順序" ' +
          'onpointerdown="_ecSectionDragStart(event,\'text\',' + si + ')" ' +
          'style="touch-action:none;cursor:grab;font-size:1rem;color:var(--muted);padding:0 2px;flex-shrink:0">⠿</span>' +
        '<span style="font-size:.8rem;color:var(--blue);font-weight:900;min-width:14px">' + arrow + '</span>' +
        '<span style="font-size:.92rem;font-weight:900;color:var(--blue-dk,#1d4ed8);flex:1">' + _ecEsc(sec.title) + '</span>' +
        '<span style="font-size:.75rem;color:var(--muted);font-weight:700;margin-right:4px">' + qCount + ' 題' +
          (sec.key === '句子重組' ? '（共' + _ecUnitCount.count + ' 格）' : '') + '</span>' +
        '<span onclick="event.stopPropagation()" style="display:flex;align-items:center;gap:3px;font-size:.75rem;color:var(--blue-dk,#1d4ed8);font-weight:700;margin-right:4px">' +
          '每' + _ecUnitCount.unit + '<input type="number" min="0" step="0.5" value="' + (sec.points != null ? _ecEscA(sec.points) : '') + '" ' +
            'placeholder="—" oninput="_ecSetSectionPoints(' + si + ',this.value)" ' +
            'style="width:44px;padding:2px 4px;border:1.5px solid var(--border);border-radius:5px;font-size:.78rem;font-family:inherit;text-align:center">分' +
        '</span>' +
        (si === 0 ? '' : _ecBreakToggleBtn('_ecToggleSectionBreak(' + si + ')', !!sec.pageBreakBefore, '此大題從新的一頁開始列印')) +
        '<button onclick="event.stopPropagation();_ecEditSectionTitle(' + si + ')" style="' + bs + ';color:var(--blue)">改標題</button>' +
      '</div>';

    var body = '';
    if (!collapsed) {
      var rows = (sec.questions || []).map(function(q, qi) {
        var isVeryFirst = si === 0 && qi === 0;
        return '<div style="display:flex;align-items:center;gap:8px;padding:7px 6px;' +
               (qi < qCount - 1 ? 'border-bottom:1px solid var(--border)' : '') +
               (q.breakBefore && !isVeryFirst ? ';border-top:2px dashed var(--blue)' : '') + '">' +
          '<span style="color:var(--muted);font-size:.8rem;font-weight:700;min-width:24px">' + (qi + 1) + '</span>' +
          '<span style="font-size:.85rem;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
            _ecEsc(q.label || q.id) + '</span>' +
          (isVeryFirst ? '' : _ecBreakToggleBtn('_ecToggleQBreak(' + si + ',' + qi + ')', !!q.breakBefore, '從這一題開始換到新的一頁')) +
          '<button onclick="_ecMoveQ(' + si + ',' + qi + ',-1)" style="' + bs + ';color:var(--muted)">▲</button>' +
          '<button onclick="_ecMoveQ(' + si + ',' + qi + ',1)"  style="' + bs + ';color:var(--muted)">▼</button>' +
          '<button onclick="_ecRemoveQ(' + si + ',' + qi + ')"  style="' + bs + ';color:var(--red);border-color:#fecaca">✕</button>' +
        '</div>';
      }).join('');
      body = '<div style="border:1.5px solid var(--blue);border-top:none;border-radius:0 0 10px 10px;padding:4px 10px">' + rows + '</div>';
    }

    return '<div id="text-sec-card-' + si + '" data-sec-kind="text" data-sec-idx="' + si + '" style="margin-bottom:10px">' + header + body + '</div>';
  }).join('');

  var matchHtml = _ecMatchSections.map(function(msec, i) {
    var secNum    = _EC_CN[_ecSections.length + i] || String(_ecSections.length + i + 1);
    var fullTitle = secNum + '、' + _ecEsc(msec.title);
    var srcDesc   = msec.source === 'curriculum'
      ? _ecEsc(msec.gradeLesson.replace('_', ' 第') + ' 課')
      : '自訂類別';
    return '<div id="match-sec-card-' + i + '" data-sec-kind="match" data-sec-idx="' + i + '" style="margin-bottom:10px">' +
      '<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;' +
      'background:var(--orange-lt,#fff7ed);border-radius:10px;border:1.5px solid var(--orange,#f97316)">' +
        '<span class="ec-drag-handle" title="拖曳調整大題順序" ' +
          'onpointerdown="_ecSectionDragStart(event,\'match\',' + i + ')" ' +
          'style="touch-action:none;cursor:grab;font-size:1rem;color:var(--muted);padding:0 2px;flex-shrink:0">⠿</span>' +
        '<span style="font-size:.92rem;font-weight:900;color:var(--orange-dk,#c2410c);flex:1">🖼 ' + fullTitle + '</span>' +
        '<span style="font-size:.75rem;color:var(--muted);margin-right:4px">' +
          msec.pairCount + ' 組 · ' + srcDesc + '</span>' +
        '<span style="display:flex;align-items:center;gap:3px;font-size:.75rem;color:var(--orange-dk,#c2410c);font-weight:700;margin-right:4px">' +
          '每組<input type="number" min="0" step="0.5" value="' + (msec.points != null ? _ecEscA(msec.points) : '') + '" ' +
            'placeholder="—" oninput="_ecSetMatchPoints(' + i + ',this.value)" ' +
            'style="width:44px;padding:2px 4px;border:1.5px solid var(--border);border-radius:5px;font-size:.78rem;font-family:inherit;text-align:center">分' +
        '</span>' +
        (_ecSections.length === 0 && i === 0 ? '' : _ecBreakToggleBtn('_ecToggleMatchBreak(' + i + ')', !!msec.pageBreakBefore, '此大題從新的一頁開始列印')) +
        '<button onclick="_ecEditMatchSectionTitle(' + i + ')" style="' + bs + ';color:var(--orange,#f97316)">改標題</button>' +
        '<button onclick="_ecRemoveMatchSection(' + i + ')" style="' + bs + ';color:var(--red);border-color:#fecaca">✕</button>' +
      '</div>' +
    '</div>';
  }).join('');

  wrap.innerHTML = textHtml + matchHtml;
  _ecRenderPointsSummary('ec-layout-points-summary');
}

/* 大題拖曳排序（Pointer Events，滑鼠／觸控通用，照 CLAUDE.md 規定不能只認滑鼠事件）。
   文字大題跟配對大題分開各自群組內拖曳，兩群組之間不能互拖——配對大題本來就固定排在所有
   文字大題後面（版面編號是這樣算的：_EC_CN[_ecSections.length+i]），要讓兩種大題能夠完全
   自由混排會牽動大題編號/預覽/發布/列印好幾處邏輯，是更大的改動，先不做。

   做法：按住拖曳把手時把那張卡片整個拉出文件流（position:fixed 跟著指標移動），原本的位置
   留一個等高的虛線佔位格；拖曳過程只搬動「佔位格」在 DOM 裡的位置（純視覺、不動資料），
   放開時才依照佔位格最終落在哪裡算出新索引、一次把 _ecSections／_ecMatchSections 陣列
   重新排序＋整個重畫。中途不去動資料陣列或整個重畫，是因為重畫會把正在拖曳中的卡片本身
   也一起重建掉，手指/滑鼠就會跟丟。 */
var _ecDrag = null;

function _ecSectionDragStart(e, kind, idx) {
  if (e.button !== undefined && e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  var card = document.getElementById((kind === 'text' ? 'text' : 'match') + '-sec-card-' + idx);
  if (!card) return;
  var rect = card.getBoundingClientRect();

  var placeholder = document.createElement('div');
  placeholder.setAttribute('data-sec-kind', kind);
  placeholder.setAttribute('data-sec-placeholder', '1');
  placeholder.style.cssText = 'height:' + rect.height + 'px;margin-bottom:10px;border:2px dashed var(--blue);' +
    'border-radius:10px;background:var(--blue-lt,#eff6ff);opacity:.6;box-sizing:border-box';
  card.parentNode.insertBefore(placeholder, card);

  card.style.position = 'fixed';
  card.style.left     = rect.left + 'px';
  card.style.top      = rect.top + 'px';
  card.style.width    = rect.width + 'px';
  card.style.zIndex   = '999';
  card.style.boxShadow = '0 10px 28px rgba(0,0,0,.28)';
  card.style.pointerEvents = 'none';

  _ecDrag = {
    kind: kind, fromIndex: idx, card: card, placeholder: placeholder,
    offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top
  };
  document.addEventListener('pointermove', _ecSectionDragMove);
  document.addEventListener('pointerup', _ecSectionDragEnd);
}

function _ecSectionDragMove(e) {
  if (!_ecDrag) return;
  var d = _ecDrag;
  d.card.style.left = (e.clientX - d.offsetX) + 'px';
  d.card.style.top  = (e.clientY - d.offsetY) + 'px';

  /* 只比較同一群組（文字或配對）、還留在正常文件流裡的卡片（排除被拉出來的 card 本身，
     它已經是 position:fixed；佔位格自己當然也不比較自己） */
  var siblings = Array.prototype.slice.call(
    document.querySelectorAll('#ec-layout-list > [data-sec-kind="' + d.kind + '"]:not([data-sec-placeholder])')
  );
  var pointerY = e.clientY;
  var before = null;
  for (var i = 0; i < siblings.length; i++) {
    var r = siblings[i].getBoundingClientRect();
    if (pointerY < r.top + r.height / 2) { before = siblings[i]; break; }
  }
  if (before) {
    if (d.placeholder.nextSibling !== before) before.parentNode.insertBefore(d.placeholder, before);
  } else {
    var list = d.placeholder.parentNode;
    if (list.lastElementChild !== d.placeholder) list.appendChild(d.placeholder);
  }
}

function _ecSectionDragEnd() {
  if (!_ecDrag) return;
  var d = _ecDrag;
  document.removeEventListener('pointermove', _ecSectionDragMove);
  document.removeEventListener('pointerup', _ecSectionDragEnd);

  /* 佔位格目前在 DOM 裡的位置，就是這張卡片最終要落在的位置——數一下同群組裡佔位格前面
     還有幾張「原本陣列裡的」卡片（要扣掉被拖曳的卡片本身，它雖然還在 DOM 裡但已經是
     position:fixed，不算在「正常排列的卡片」裡，用 :not([data-sec-placeholder]) 加上
     排除拖曳中卡片的 id 來算） */
  var siblings = Array.prototype.slice.call(
    document.querySelectorAll('#ec-layout-list > [data-sec-kind="' + d.kind + '"]')
  );
  var toIndex = 0;
  for (var i = 0; i < siblings.length; i++) {
    if (siblings[i] === d.placeholder) break;
    if (siblings[i] !== d.card) toIndex++;
  }

  var list = d.kind === 'text' ? _ecSections : _ecMatchSections;
  if (toIndex !== d.fromIndex && d.fromIndex < list.length) {
    var moved = list.splice(d.fromIndex, 1)[0];
    toIndex = Math.max(0, Math.min(list.length, toIndex));
    list.splice(toIndex, 0, moved);
    if (d.kind === 'text') {
      _ecRenumberSections();
      _ecSecKeyOrder = _ecSections.map(function(sec) { return sec.key; });
    }
  }

  _ecDrag = null;
  _ecRenderLayout(); // 收尾：重畫會自然清掉 fixed 定位的卡片跟佔位格，換成正常排列的新順序
}

/* 配分輸入框改值：只更新資料＋重畫總分提示，不整個重畫 _ecRenderLayout()——不然每打一個字
   整張清單（含輸入框本身）都會重建，輸入框會失焦、每個字都要重新點一次才能繼續打 */
function _ecSetSectionPoints(si, val) {
  if (_ecSections[si]) _ecSections[si].points = val === '' ? '' : val;
  _ecRenderPointsSummary('ec-layout-points-summary');
}

function _ecSetMatchPoints(i, val) {
  if (_ecMatchSections[i]) _ecMatchSections[i].points = val === '' ? '' : val;
  _ecRenderPointsSummary('ec-layout-points-summary');
}

/* 手動分頁點的切換——都是整個重畫（不像配分輸入框打字那樣要顧慮失焦，這裡本來就是單純
   點一下按鈕的開關，重畫沒有副作用） */
function _ecToggleSectionBreak(si) {
  if (_ecSections[si]) { _ecSections[si].pageBreakBefore = !_ecSections[si].pageBreakBefore; _ecRenderLayout(); }
}
function _ecToggleMatchBreak(i) {
  if (_ecMatchSections[i]) { _ecMatchSections[i].pageBreakBefore = !_ecMatchSections[i].pageBreakBefore; _ecRenderLayout(); }
}
function _ecToggleQBreak(si, qi) {
  var q = _ecSections[si] && _ecSections[si].questions[qi];
  if (q) { q.breakBefore = !q.breakBefore; _ecRenderLayout(); }
}

function _ecToggleSection(si) {
  if (_ecSections[si]) {
    _ecSections[si].collapsed = !_ecSections[si].collapsed;
    _ecRenderLayout();
  }
}

function _ecEditSectionTitle(si) {
  var sec = _ecSections[si];
  if (!sec) return;
  var text = prompt('請輸入大題標題', sec.title || '');
  if (text === null || !text.trim()) return;
  sec.title = text.trim();
  _ecRenderLayout();
}

function _ecMoveQ(si, qi, dir) {
  var sec = _ecSections[si];
  if (!sec) return;
  var j = qi + dir;
  if (j < 0 || j >= sec.questions.length) return;
  var tmp = sec.questions[qi]; sec.questions[qi] = sec.questions[j]; sec.questions[j] = tmp;
  _ecRenderLayout();
}

function _ecRemoveQ(si, qi) {
  var sec = _ecSections[si];
  if (!sec) return;
  var q = sec.questions[qi];
  if (q) delete _ecSelected[q.id];
  sec.questions.splice(qi, 1);
  if (!sec.questions.length) {
    _ecSections.splice(si, 1);
    _ecRenumberSections();
  }
  _ecRenderLayout();
}
