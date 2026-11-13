/* shared/zhuyin-keyboard.js — 畫面上的注音鍵盤（按鍵式，含選字）
 * 使用方式：<link rel="stylesheet" href="shared/zhuyin-keyboard.css">
 *           <script src="assets/data/zhuyin-chars.js"></script>
 *           <script src="shared/zhuyin-keyboard.js"></script>
 *           <script>initZhuyinKeyboard();</script>
 *           然後在要用這個鍵盤的 <input> / <textarea> 加上 data-zhuyin-kb 屬性。
 *
 * 用途：平板把網站「加入主畫面」當 App 開的時候，系統鍵盤常常叫不出來，輸入框完全不能打字。
 * 這個鍵盤整個畫在網頁裡，不依賴系統鍵盤：按注音 → 選聲調 → 點候選字，字就會寫進輸入框。
 * 鍵位照大千式（一般實體鍵盤上印的注音位置），學生不用重新找。
 *
 * 行為：
 *   - 觸控裝置點到有 data-zhuyin-kb 的輸入框就自動打開，並把輸入框設成 inputmode="none"，
 *     讓系統鍵盤不要同時跳出來擋畫面。沒有觸控的電腦不會自動打開（有實體鍵盤）。
 *   - 寫入時會觸發輸入框的 input 事件，頁面原本的 oninput 邏輯照常運作；也會遵守 maxlength。
 *   - 「系統鍵盤」鍵：收起這個鍵盤、改回系統鍵盤（系統鍵盤能用的裝置才有效），離開輸入框後恢復。
 */
(function () {
  'use strict';

  /* 大千式鍵位，由上到下四排 */
  var ROWS = [
    ['ㄅ', 'ㄉ', 'ˇ', 'ˋ', 'ㄓ', 'ˊ', '˙', 'ㄚ', 'ㄞ', 'ㄢ', 'ㄦ'],
    ['ㄆ', 'ㄊ', 'ㄍ', 'ㄐ', 'ㄔ', 'ㄗ', 'ㄧ', 'ㄛ', 'ㄟ', 'ㄣ'],
    ['ㄇ', 'ㄋ', 'ㄎ', 'ㄑ', 'ㄕ', 'ㄘ', 'ㄨ', 'ㄜ', 'ㄠ', 'ㄤ'],
    ['ㄈ', 'ㄌ', 'ㄏ', 'ㄒ', 'ㄖ', 'ㄙ', 'ㄩ', 'ㄝ', 'ㄡ', 'ㄥ']
  ];
  var INITIALS = 'ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙ';
  var MEDIALS  = 'ㄧㄨㄩ';
  var FINALS   = 'ㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦ';
  var TONES    = 'ˊˇˋ˙';
  var PAGE     = 10; // 每頁候選字數

  var panel   = null;
  var target  = null;   // 目前寫入的輸入框
  var useSystem = false; // 使用者這次選了系統鍵盤，離開輸入框前不要自動打開
  var comp    = { ini: '', med: '', fin: '', tone: null }; // tone: null=還沒選，''=一聲，其餘為聲調符號
  var cands   = [];
  var page    = 0;

  function isTouchDevice() { return (navigator.maxTouchPoints || 0) > 0; }
  function dict() { return (typeof ZHUYIN_CHARS !== 'undefined' && ZHUYIN_CHARS) || {}; }
  function body() { return comp.ini + comp.med + comp.fin; }

  /* ── 注音組字 ── */
  function pressSymbol(s) {
    if (INITIALS.indexOf(s) >= 0)      comp.ini = s;
    else if (MEDIALS.indexOf(s) >= 0)  comp.med = s;
    else if (FINALS.indexOf(s) >= 0)   comp.fin = s;
    else if (TONES.indexOf(s) >= 0)    { if (!body()) return; comp.tone = s; }
    else if (s === 'tone1')            { if (!body()) return; comp.tone = ''; }
    updateCandidates();
  }

  function updateCandidates() {
    var b = body(), d = dict();
    page = 0;
    if (!b) { cands = []; render(); return; }
    var str = '';
    if (comp.tone !== null) {
      str = d[b + comp.tone] || '';
    } else {
      /* 還沒選聲調：五個聲調的字都列出來，一聲排前面 */
      ['', 'ˊ', 'ˇ', 'ˋ', '˙'].forEach(function (t) { str += d[b + t] || ''; });
    }
    var seen = {};
    cands = Array.from(str).filter(function (c) { if (seen[c]) return false; seen[c] = true; return true; });
    render();
  }

  function clearComp() {
    comp = { ini: '', med: '', fin: '', tone: null };
    cands = []; page = 0;
  }

  function backspace() {
    if (comp.tone !== null)  { comp.tone = null; updateCandidates(); return; }
    if (comp.fin)            { comp.fin = '';    updateCandidates(); return; }
    if (comp.med)            { comp.med = '';    updateCandidates(); return; }
    if (comp.ini)            { comp.ini = '';    updateCandidates(); return; }
    /* 沒有在組字：刪掉輸入框游標前面的一個字 */
    if (!target) return;
    var s = target.selectionStart, e = target.selectionEnd;
    if (s === null || s === undefined) { s = e = target.value.length; }
    if (s === e) {
      if (s === 0) return;
      var before = Array.from(target.value.slice(0, s));
      var last = before.pop() || '';
      s = e - last.length;
    }
    target.setRangeText('', s, e, 'end');
    fireInput();
  }

  function commit(ch) {
    if (!target) return;
    var max = target.maxLength;
    var s = target.selectionStart, e = target.selectionEnd;
    if (s === null || s === undefined) { s = e = target.value.length; }
    if (max > 0 && target.value.length - (e - s) + ch.length > max) { clearComp(); render(); return; }
    target.setRangeText(ch, s, e, 'end');
    clearComp();
    render();
    fireInput();
  }

  function fireInput() {
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /* ── 畫面 ── */
  function build() {
    panel = document.createElement('div');
    panel.id = 'zk-panel';
    panel.className = 'zk-panel';
    panel.setAttribute('aria-label', '注音鍵盤');
    var rows = ROWS.map(function (row, i) {
      return '<div class="zk-row zk-row-' + i + '">' + row.map(function (s) {
        var tone = TONES.indexOf(s) >= 0;
        return '<button type="button" class="zk-key' + (tone ? ' zk-tone' : '') + '" data-k="' + s + '">' + s + '</button>';
      }).join('') + '</div>';
    }).join('');
    panel.innerHTML =
      '<div class="zk-inner">'
      + '<div class="zk-bar">'
        + '<div class="zk-comp" id="zk-comp"></div>'
        + '<button type="button" class="zk-nav" data-k="prev" aria-label="上一頁">‹</button>'
        + '<div class="zk-cands" id="zk-cands"></div>'
        + '<button type="button" class="zk-nav" data-k="next" aria-label="下一頁">›</button>'
      + '</div>'
      + rows
      + '<div class="zk-row zk-row-fn">'
        + '<button type="button" class="zk-key zk-fn" data-k="system">⌨ 系統鍵盤</button>'
        + '<button type="button" class="zk-key zk-fn zk-space" data-k="tone1">一聲</button>'
        + '<button type="button" class="zk-key zk-fn" data-k="del" aria-label="刪除">⌫ 刪除</button>'
        + '<button type="button" class="zk-key zk-fn" data-k="hide">▾ 收起</button>'
      + '</div>'
      + '</div>';
    document.body.appendChild(panel);

    /* 按鍵盤上的任何地方都不可以讓輸入框失去焦點（游標位置要留著）。
       觸控走 pointerdown、滑鼠走 mousedown，兩個都要擋 */
    panel.addEventListener('pointerdown', function (e) { e.preventDefault(); });
    panel.addEventListener('mousedown',   function (e) { e.preventDefault(); });
    panel.addEventListener('click', function (e) {
      var b = e.target.closest('[data-k], [data-c]');
      if (!b || b.disabled) return;
      if (b.hasAttribute('data-c')) { commit(b.getAttribute('data-c')); return; }
      var k = b.getAttribute('data-k');
      if (k === 'del')         backspace();
      else if (k === 'hide')   close();
      else if (k === 'system') switchToSystem();
      else if (k === 'prev')   { if (page > 0) { page--; render(); } }
      else if (k === 'next')   { if ((page + 1) * PAGE < cands.length) { page++; render(); } }
      else                     pressSymbol(k);
    });
  }

  function render() {
    if (!panel) return;
    var b = body();
    var compEl = document.getElementById('zk-comp');
    compEl.textContent = b ? (b + (comp.tone || '')) : '注音';
    compEl.classList.toggle('zk-comp-empty', !b);

    var el = document.getElementById('zk-cands');
    if (!b) {
      el.innerHTML = '<span class="zk-hint">按下面的注音，再點要的字</span>';
    } else if (!cands.length) {
      el.innerHTML = '<span class="zk-hint">找不到這個注音的字</span>';
    } else {
      el.innerHTML = cands.slice(page * PAGE, page * PAGE + PAGE).map(function (c) {
        return '<button type="button" class="zk-cand" data-c="' + c + '">' + c + '</button>';
      }).join('');
    }
    panel.querySelector('[data-k="prev"]').disabled = page === 0;
    panel.querySelector('[data-k="next"]').disabled = (page + 1) * PAGE >= cands.length;

    /* 已經按下的聲母／介音／韻母／聲調，在鍵上標出來 */
    Array.prototype.forEach.call(panel.querySelectorAll('.zk-key[data-k]'), function (key) {
      var k = key.getAttribute('data-k');
      var on = k === comp.ini || k === comp.med || k === comp.fin
        || (comp.tone !== null && (k === comp.tone || (k === 'tone1' && comp.tone === '')));
      key.classList.toggle('zk-on', !!(on && b));
    });
  }

  /* ── 開關 ── */
  function open(el) {
    if (!panel) build();
    if (target && target !== el) release(target);
    target = el;
    target.setAttribute('inputmode', 'none'); // 不要讓系統鍵盤同時跳出來
    clearComp();
    render();
    panel.classList.add('open');
    document.body.classList.add('zk-open');
    notifyParent(true);
    /* 鍵盤會蓋住畫面下半部，把輸入框捲到看得見的地方 */
    setTimeout(function () {
      if (target && target.scrollIntoView) { try { target.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
    }, 50);
  }

  /* 子 App 在 Hub 的 iframe 裡：Hub 那一層的懸浮按鈕也會壓到鍵盤，請 Hub 一起藏（見 src/hub.js） */
  function notifyParent(isOpen) {
    if (window.parent === window) return;
    try { window.parent.postMessage({ type: 'zk-keyboard', open: isOpen }, '*'); } catch (e) {}
  }

  function release(el) {
    if (el.getAttribute('inputmode') === 'none') el.removeAttribute('inputmode');
  }

  function close() {
    if (!panel) return;
    panel.classList.remove('open');
    document.body.classList.remove('zk-open');
    notifyParent(false);
    clearComp();
  }

  function switchToSystem() {
    var el = target;
    useSystem = true;
    close();
    if (!el) return;
    release(el);
    /* 要先 blur 再 focus，瀏覽器才會依新的 inputmode 重新決定要不要叫出系統鍵盤 */
    el.blur();
    setTimeout(function () { el.focus(); }, 0);
  }

  function isOurs(el) {
    return el && el.hasAttribute && el.hasAttribute('data-zhuyin-kb')
      && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT');
  }

  function onFocusIn(e) {
    if (!isOurs(e.target) || !isTouchDevice() || useSystem) return;
    open(e.target);
  }
  function onFocusOut(e) {
    if (!isOurs(e.target)) return;
    var el = e.target;
    /* 等一下再判斷：switchToSystem 會先 blur 再馬上 focus 回來 */
    setTimeout(function () {
      if (document.activeElement === el) return;
      useSystem = false;
      if (target === el) { close(); release(el); target = null; }
    }, 150);
  }
  /* 已經有焦點、鍵盤被收起來之後，再點一次輸入框要能重新打開 */
  function onPointerDown(e) {
    if (!isOurs(e.target) || !isTouchDevice() || useSystem) return;
    if (document.activeElement === e.target && (!panel || !panel.classList.contains('open'))) open(e.target);
  }

  /* ── 公開 API ── */
  window.initZhuyinKeyboard = function () {
    document.addEventListener('focusin',  onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('pointerdown', onPointerDown);
  };
})();
