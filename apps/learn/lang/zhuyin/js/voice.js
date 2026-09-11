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

/* 點符號本身：有老師錄音就播錄音（比自動朗讀穩定），沒有就退回 TTS 唸符號 */
function zySpeakSymbol(symbol) {
  sfxTap();
  var d = zhuyinData[symbol];
  if (d && d.audioData) {
    try {
      new Audio(d.audioData).play();
      return;
    } catch (e) {}
  }
  zySpeak(symbol);
}

/* 點圖片：唸完整口訣，還沒建立口訣的符號就退回唸符號本身 */
function zySpeakPhrase(symbol) {
  sfxTap();
  var d = zhuyinData[symbol];
  zySpeak((d && d.phrase) ? d.phrase : symbol);
}
