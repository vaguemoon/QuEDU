/**
 * scroll-top.js — 換頁／顯示成績時把畫面捲回最上面
 *
 * 平板上交卷後常停在中間、要往回拖才看得到分數，原因有三：
 *  1. 作答畫面很長，交卷時捲在最下面；藏掉作答畫面後捲動位置沒歸零，就停在成績頁的下半段。
 *  2. 平滑捲動（behavior: 'smooth'）在 iPad 上手指一碰到畫面就會被打斷。
 *  3. app 是放在主頁（hub.html）的 iframe 裡，iPad Safari 有時會把 iframe 撐成內容高度，
 *     這時真正在捲的是主頁外層的面板，只捲 iframe 裡的 window 沒有用。
 * 另外輸入框還在 focus 時，鍵盤收起來會讓畫面位移，先 blur。
 *
 * 不依賴其他檔案，測驗頁（沒有載入 shared.js）也能用。
 */
'use strict';

function _quScrollTopNow() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  if (document.body) document.body.scrollTop = 0;
  try {
    var fr = window.frameElement;   // 跨網域讀不到會丟錯，就只捲自己
    while (fr) {
      for (var el = fr.parentElement; el; el = el.parentElement) {
        if (el.scrollTop) el.scrollTop = 0;
      }
      var w = fr.ownerDocument.defaultView;
      w.scrollTo(0, 0);
      fr = w.frameElement;
    }
  } catch (e) {}
}

function quScrollTop() {
  var a = document.activeElement;
  if (a && a !== document.body && a.blur) a.blur();
  _quScrollTopNow();
  /* 新畫面排版完、iPad 鍵盤收起動畫結束後再補一次 */
  requestAnimationFrame(_quScrollTopNow);
  setTimeout(_quScrollTopNow, 350);
}
