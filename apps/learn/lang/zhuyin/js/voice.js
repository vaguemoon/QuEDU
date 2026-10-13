/**
 * voice.js — 中文語音朗讀（一律使用 pickBestZhVoice，見子 App 設計準則七-5）
 */
'use strict';

var zyZhVoice = null;

function zyLoadVoices() {
  if (!window.speechSynthesis) return;
  var voices = window.speechSynthesis.getVoices();
  if (voices && voices.length) zyZhVoice = pickBestZhVoice(voices);
}
if (window.speechSynthesis) {
  zyLoadVoices();
  window.speechSynthesis.onvoiceschanged = zyLoadVoices;
}

function zySpeak(text) {
  if (!window.speechSynthesis || !text) return;
  // 只有真的還有話在排隊/播放時才 cancel()，避免每次點擊都對引擎做一次不必要的
  // cancel→speak 來回，減少啟動延遲
  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
    window.speechSynthesis.cancel();
  }
  var utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'zh-TW';
  utt.rate = 0.85; // 給低年級學生聽，語速放慢一些（沿用練字趣/認字趣的速度）
  if (zyZhVoice) utt.voice = zyZhVoice;
  window.speechSynthesis.speak(utt);
}

/* 播放錄音用的共用 Audio 元素——重複使用、播放前先 pause 一次，不要每次都 new 一個全新物件
 * （平板上連點連得快時，一堆物件搶著播容易被瀏覽器擋掉） */
var _zyAudioEl = null;
function _zyPlayClip(audioData) {
  if (!_zyAudioEl) _zyAudioEl = new Audio();
  try { _zyAudioEl.pause(); } catch (e) {}
  _zyAudioEl.src = audioData;
  return _zyAudioEl.play();
}

/* 點符號本身：有老師錄音就播錄音（比自動朗讀穩定），沒有就退回 TTS 唸符號
   單音／結合韻各自查自己的資料庫（zyActiveData() 依目前 zySection 回傳對應的那份）
   audio.play() 回傳的 Promise 在平板上常因自動播放限制或連點太快而非同步被 reject，
   同步 try/catch 接不到，一定要另外接 .catch()，不然播放失敗會整個沒聲音、也不會
   退回 TTS（這就是平板上「自己錄的音檔不會播」的主因，TTS 走另一條路線所以不受影響） */
function zySpeakSymbol(symbol) {
  sfxTap();
  var d = zyActiveData()[symbol];
  if (d && d.audioData) {
    var started = false;
    try {
      var playPromise = _zyPlayClip(d.audioData);
      started = true;
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function() { zySpeak(symbol); });
      }
    } catch (e) { started = false; }
    if (started) return;
  }
  zySpeak(symbol);
}

/* 點圖片：唸完整口訣，還沒建立口訣的符號就退回唸符號本身 */
function zySpeakPhrase(symbol) {
  sfxTap();
  var d = zyActiveData()[symbol];
  zySpeak((d && d.phrase) ? d.phrase : symbol);
}
