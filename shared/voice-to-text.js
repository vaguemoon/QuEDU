/* shared/voice-to-text.js — 語音轉文字 Widget
 * 使用方式：<link rel="stylesheet" href="shared/voice-to-text.css">
 *           <script src="shared/voice-to-text.js"></script>
 *           <script>initVoiceToTextWidget();</script>
 *
 * 用途：學生講不出來／不會寫時，用說的代替打字或寫字。純顯示＋可編輯修正辨識錯誤，
 * 不會保留內容——切換或關閉面板後文字不會留著（跟 shared/scratch.js 的暫存性質一致）。
 * 這個 Widget 取代了原本獨立的「即時語音轉文字」教學工具（apps/tools/voice-notes，
 * 已移除），語音辨識邏輯（麥克風權限錯誤處理、連續聆聽自動重啟、音量視覺化脈動）沿用自那裡。
 */
(function () {
  'use strict';

  var SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

  /* iPad/iPhone Safari 對 continuous:true 有已知的靜默卡住問題——權限拿到、
     顯示「正在聆聽」，但 onresult／onerror／onend 全部不會觸發，形同永久卡死。
     iPadOS 13+ 的 Safari 在 UA 上會偽裝成 Mac（navigator.platform === 'MacIntel'），
     要另外用「有觸控點」來判斷才分得出來。 */
  var isIOS = /iP(hone|ad|od)/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  var isOpen      = false;
  var listening   = false;
  var userStopped = true; // true = 使用者主動停止／尚未開始，不應自動重啟
  var recognition = null;
  var micStream   = null;
  var audioCtx    = null;
  var analyser    = null;
  var rafId       = null;
  var fontSize    = 16;
  var watchdogTimer = null; // 偵測「已開始聆聽但完全沒反應」的靜默卡死狀態

  var MIC_SVG =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"'
    + ' stroke="currentColor" stroke-width="2.2"'
    + ' stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z"/>'
    + '<path d="M19 11a7 7 0 0 1-14 0"/>'
    + '<path d="M12 18v4"/><path d="M9 22h6"/>'
    + '</svg>';

  /* ── 注入 DOM ── */
  function injectHTML() {
    var btn = document.createElement('button');
    btn.id        = 'vtt-widget-btn';
    btn.className = 'vtt-btn';
    btn.title     = '語音轉文字';
    btn.setAttribute('aria-label', '語音轉文字');
    btn.innerHTML = MIC_SVG;
    document.body.appendChild(btn);

    var panel = document.createElement('div');
    panel.id        = 'vtt-panel';
    panel.className = 'vtt-panel';
    panel.innerHTML =
      '<div class="vtt-header">'
        + '<span class="vtt-title">🎤 語音轉文字</span>'
        + '<button class="vtt-close" id="vtt-close" aria-label="關閉">✕</button>'
      + '</div>'
      + '<div class="vtt-body">'
        + '<div class="vtt-banner" id="vtt-banner-unsupported" style="display:none">'
          + '⚠️ 此功能目前僅支援 Chrome 或 Edge 瀏覽器的語音辨識功能，請更換瀏覽器後再試。'
        + '</div>'
        + '<div class="vtt-banner" id="vtt-banner-insecure" style="display:none">'
          + '⚠️ 使用麥克風需要安全連線（https），請透過正式網址開啟本頁面。'
        + '</div>'
        + '<div class="vtt-banner" id="vtt-banner-ios" style="display:none">'
          + '📱 這台裝置請直接點下方文字框，再點鍵盤上的 🎤 語音輸入鍵即可開始說話——'
          + 'iPad／iPhone 內建的語音輸入比較穩定，這裡就不用另外按「開始聽寫」了。'
        + '</div>'
        + '<div class="vtt-mic-row" id="vtt-mic-row">'
          + '<div class="vtt-pulse-wrap"><div class="vtt-pulse-dot" id="vtt-pulse-dot"></div></div>'
          + '<div class="vtt-mic-status-text" id="vtt-mic-status-text">尚未開始</div>'
        + '</div>'
        + '<div class="vtt-mic-error" id="vtt-mic-error"></div>'
        + '<button class="vtt-toggle-btn" id="vtt-toggle-btn">🎙️ 開始聽寫</button>'
        + '<div class="vtt-transcript-wrap">'
          + '<div class="vtt-field-label">'
            + '逐字稿'
            + '<div class="vtt-field-actions">'
              + '<div class="vtt-fs-ctrl">'
                + '<span class="vtt-fs-label">字體</span>'
                + '<button class="vtt-fs-btn" id="vtt-fs-minus" aria-label="縮小">−</button>'
                + '<span class="vtt-fs-val" id="vtt-fs-val">16</span>'
                + '<button class="vtt-fs-btn" id="vtt-fs-plus" aria-label="放大">＋</button>'
              + '</div>'
              + '<button class="vtt-clear-btn" id="vtt-clear-btn">🗑 清除文字</button>'
            + '</div>'
          + '</div>'
          + '<div class="vtt-interim-line" id="vtt-interim-line"></div>'
          + '<textarea class="vtt-transcript" id="vtt-transcript" placeholder="按「開始聽寫」後，說話內容會即時顯示在這裡，也可以直接點擊修改文字…"></textarea>'
        + '</div>'
      + '</div>';
    document.body.appendChild(panel);

    btn.addEventListener('click', togglePanel);
    document.getElementById('vtt-close').addEventListener('click', closePanel);
    document.getElementById('vtt-toggle-btn').addEventListener('click', toggleListening);
    document.getElementById('vtt-clear-btn').addEventListener('click', clearTranscript);
    document.getElementById('vtt-fs-minus').addEventListener('click', function () { adjustFontSize(-2); });
    document.getElementById('vtt-fs-plus').addEventListener('click', function () { adjustFontSize(2); });

    if (!window.isSecureContext) document.getElementById('vtt-banner-insecure').style.display = '';

    /* iOS 的 JS 語音辨識引擎經實測不可靠（常常整段卡死、完全沒有文字結果），
       但裝置本身內建的鍵盤語音輸入是可靠的——iOS 直接不走 JS 辨識這條路，
       改引導學生用鍵盤上的語音輸入鍵，把「開始聽寫」整組 UI 換成說明文字 */
    if (isIOS) {
      document.getElementById('vtt-banner-ios').style.display = '';
      document.getElementById('vtt-mic-row').style.display = 'none';
      document.getElementById('vtt-toggle-btn').style.display = 'none';
      var taIOS = document.getElementById('vtt-transcript');
      if (taIOS) taIOS.placeholder = '點這裡，再點鍵盤上的 🎤 語音輸入鍵開始說話…';
    } else if (!SpeechRecognitionCtor) {
      document.getElementById('vtt-banner-unsupported').style.display = '';
      document.getElementById('vtt-toggle-btn').disabled = true;
      setStatus('瀏覽器不支援語音辨識', 'error');
    }
  }

  /* ── 面板開關 ── */
  function togglePanel() { isOpen ? closePanel() : openPanel(); }

  function openPanel() {
    document.getElementById('vtt-panel').classList.add('open');
    document.getElementById('vtt-widget-btn').classList.add('v-active', 'v-hidden');
    isOpen = true;
    /* iOS：直接把鍵盤叫出來，學生不用自己再點一次文字框找麥克風鍵。
       focus() 必須跟按鈕點擊同一輪同步呼叫，iOS 才認得這是使用者手勢觸發的，
       前一版用 setTimeout 延遲呼叫，反而讓 iOS 判定不是使用者手勢而不彈鍵盤 */
    if (isIOS) {
      var ta = document.getElementById('vtt-transcript');
      if (ta) ta.focus();
    }
  }

  function closePanel() {
    document.getElementById('vtt-panel').classList.remove('open');
    document.getElementById('vtt-widget-btn').classList.remove('v-active', 'v-hidden');
    isOpen = false;
    // 離開面板務必停止聽寫、釋放麥克風——這是暫存工具，離開就不留痕跡
    userStopped = true;
    stopAll();
  }

  /* ── 狀態顯示 ── */
  function setStatus(text, state) {
    var el = document.getElementById('vtt-mic-status-text');
    var dot = document.getElementById('vtt-pulse-dot');
    if (el) el.textContent = text;
    if (dot) dot.className = 'vtt-pulse-dot' + (state ? ' ' + state : '');
  }
  function showError(msg) {
    var el = document.getElementById('vtt-mic-error');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
  }
  function clearError() {
    var el = document.getElementById('vtt-mic-error');
    if (!el) return;
    el.classList.remove('show');
    el.textContent = '';
  }

  /* ── 麥克風錯誤訊息對照 ── */
  function handleMicError(err) {
    var name = err && err.name;
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      showError('找不到麥克風裝置，請確認電腦／裝置已連接麥克風。');
    } else if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
      showError('麥克風權限被拒絕。請點瀏覽器網址列左側的鎖頭（或麥克風）圖示，允許麥克風權限後重新整理頁面再試一次。');
    } else if (name === 'NotReadableError' || name === 'TrackStartError') {
      showError('麥克風正被其他程式使用中，請先關閉其他正在使用麥克風的軟體（例如視訊會議）後再試。');
    } else {
      showError('無法啟用麥克風：' + (err && err.message ? err.message : '未知錯誤'));
    }
    setStatus('麥克風無法使用', 'error');
  }

  /* ── 開始／停止 ── */
  function toggleListening() {
    if (listening) {
      userStopped = true;
      stopAll();
    } else {
      userStopped = false;
      startAll();
    }
  }

  function startAll() {
    clearError();
    /* 頁面上其他功能（TTS 發音等）可能才剛用過 speechSynthesis，iOS 對音訊工作階段
       的銜接不穩定，開麥克風前先確保沒有殘留的語音播放 */
    if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) {} }
    var toggleBtn = document.getElementById('vtt-toggle-btn');
    toggleBtn.disabled = true;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      micStream = stream;
      setupVolumeMeter(stream);
      startRecognition();
      listening = true;
      toggleBtn.disabled = false;
      toggleBtn.textContent = '⏹ 停止聽寫';
      toggleBtn.classList.add('listening');
      setStatus('正在聆聽…', 'listening');
    }).catch(function (err) {
      toggleBtn.disabled = false;
      handleMicError(err);
    });
  }

  function stopAll() {
    listening = false;
    clearWatchdog();
    var toggleBtn = document.getElementById('vtt-toggle-btn');
    if (toggleBtn) {
      toggleBtn.textContent = '🎙️ 開始聽寫';
      toggleBtn.classList.remove('listening');
    }
    var errEl = document.getElementById('vtt-mic-error');
    if (errEl && !errEl.textContent) setStatus('已停止', '');
    var interimEl = document.getElementById('vtt-interim-line');
    if (interimEl) interimEl.textContent = '';
    var dot = document.getElementById('vtt-pulse-dot');
    if (dot) dot.style.transform = 'scale(1)';

    if (recognition) {
      try { recognition.stop(); } catch (e) {}
      recognition = null;
    }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (audioCtx) { try { audioCtx.close(); } catch (e) {} audioCtx = null; }
    if (micStream) {
      micStream.getTracks().forEach(function (t) { t.stop(); });
      micStream = null;
    }
  }

  /* ── 音量視覺化（獨立於語音辨識，直接讀取麥克風串流） ── */
  function setupVolumeMeter(stream) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    var data = new Uint8Array(analyser.frequencyBinCount);
    var dot = document.getElementById('vtt-pulse-dot');

    function tick() {
      analyser.getByteTimeDomainData(data);
      var sum = 0;
      for (var i = 0; i < data.length; i++) {
        var v = (data[i] - 128) / 128;
        sum += v * v;
      }
      var rms = Math.sqrt(sum / data.length);
      var scale = 1 + Math.min(rms * 4, 1.4);
      if (dot) dot.style.transform = 'scale(' + scale.toFixed(2) + ')';
      rafId = requestAnimationFrame(tick);
    }
    tick();
  }

  /* ── 語音辨識 ── */
  function startRecognition() {
    recognition = new SpeechRecognitionCtor();
    recognition.lang = 'zh-TW';
    /* iOS Safari 的 continuous:true 常常整段卡死（不觸發任何事件），改用
       「單句辨識 + onend 自動重啟下一句」串接出連續聽寫的效果，穩定得多 */
    recognition.continuous     = !isIOS;
    recognition.interimResults = true;

    armWatchdog();

    recognition.onresult = function (e) {
      clearWatchdog(); armWatchdog(); // 有收到結果代表活著，重新倒數
      var interim = '';
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          appendFinalText(transcript);
        } else {
          interim += transcript;
        }
      }
      var interimEl = document.getElementById('vtt-interim-line');
      if (interimEl) interimEl.textContent = interim;
    };

    recognition.onerror = function (e) {
      clearWatchdog();
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        userStopped = true;
        handleMicError({ name: 'NotAllowedError' });
      } else if (e.error === 'audio-capture') {
        userStopped = true;
        handleMicError({ name: 'NotFoundError' });
      } else if (e.error === 'network') {
        showError('語音辨識連線發生問題，請確認網路連線（此裝置的語音辨識可能需要連上雲端服務）。');
      }
      /* 'no-speech' 等暫時性錯誤交給 onend 自動重啟即可 */
    };

    recognition.onend = function () {
      clearWatchdog();
      if (!userStopped && listening) {
        /* iOS 緊接著重啟常常直接失敗，留一點間隔給系統回收音訊工作階段 */
        setTimeout(function () {
          if (!userStopped && listening) {
            try { startRecognition(); } catch (e) { /* 已在啟動中則忽略 */ }
          }
        }, isIOS ? 250 : 0);
      }
    };

    recognition.start();
  }

  /* iOS 已知會整段卡死：權限拿到、顯示「正在聆聽」，但 onresult／onerror／onend
     全部不觸發。用一個計時器偵測這種情況，逾時就強制中斷並提示使用者手動重試
     （iOS 上要重新取得使用者手勢才比較可能真的成功接上麥克風）。 */
  function armWatchdog() {
    clearWatchdog();
    watchdogTimer = setTimeout(function () {
      userStopped = true;
      if (recognition) { try { recognition.abort(); } catch (e) {} }
      stopAll();
      showError('沒有偵測到語音回應，這台裝置的語音辨識可能暫時無法使用，請再次點擊「開始聽寫」重試；若持續發生，可能是網路無法連上語音辨識服務。');
      setStatus('沒有回應，請重試', 'error');
    }, 8000);
  }
  function clearWatchdog() {
    if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null; }
  }

  function appendFinalText(text) {
    text = text.trim();
    if (!text) return;
    var el = document.getElementById('vtt-transcript');
    if (!el) return;
    var cur = el.value;
    el.value = cur ? (cur + '\n' + text) : text;
    el.scrollTop = el.scrollHeight;
  }

  function clearTranscript() {
    var el = document.getElementById('vtt-transcript');
    if (el) { el.value = ''; el.focus(); }
  }

  /* ── 字體大小調整（展示給老師／同學看時可放大） ── */
  function adjustFontSize(delta) {
    fontSize = Math.max(14, Math.min(60, fontSize + delta));
    var valEl = document.getElementById('vtt-fs-val');
    var transcriptEl = document.getElementById('vtt-transcript');
    if (valEl) valEl.textContent = fontSize;
    if (transcriptEl) transcriptEl.style.fontSize = fontSize + 'px';
  }

  /* ── 離開頁面時務必釋放麥克風 ── */
  window.addEventListener('beforeunload', function () { userStopped = true; stopAll(); });
  window.addEventListener('pagehide',     function () { userStopped = true; stopAll(); });

  /* ── 公開 API ── */
  window.initVoiceToTextWidget = function () {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectHTML);
    } else {
      injectHTML();
    }
  };
})();
