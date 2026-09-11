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
  window.speechSynthesis.cancel();
  var utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'zh-TW';
  if (zyZhVoice) utt.voice = zyZhVoice;
  window.speechSynthesis.speak(utt);
}

/* 點符號本身：只唸符號 */
function zySpeakSymbol(symbol) {
  sfxTap();
  zySpeak(symbol);
}

/* 點圖片：唸完整口訣，還沒建立口訣的符號就退回唸符號本身 */
function zySpeakPhrase(symbol) {
  sfxTap();
  var d = zhuyinData[symbol];
  zySpeak((d && d.phrase) ? d.phrase : symbol);
}
