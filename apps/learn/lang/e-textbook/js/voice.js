/**
 * voice.js — TTS 朗讀（一律使用 pickBestZhVoice）
 */
'use strict';

var etZhVoice = null;

function etLoadVoices() {
  if (!window.speechSynthesis) return;
  var voices = window.speechSynthesis.getVoices();
  if (voices && voices.length) etZhVoice = pickBestZhVoice(voices);
}
if (window.speechSynthesis) {
  etLoadVoices();
  window.speechSynthesis.onvoiceschanged = etLoadVoices;
}

/* 一般朗讀（單字/圈詞查詢用），不帶結束回呼 */
function etSpeak(text) {
  if (!window.speechSynthesis || !text) return;
  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) window.speechSynthesis.cancel();
  var utt = new SpeechSynthesisUtterance(etApplyPronFixes(text));
  utt.lang  = 'zh-TW';
  utt.rate  = etRate;
  if (etZhVoice) utt.voice = etZhVoice;
  window.speechSynthesis.speak(utt);
}

/* 朗讀模式專用：需要知道「唸完了」才能自動接下一句，所以帶 onend 回呼 */
function etSpeakWithCallback(text, onEnd) {
  if (!window.speechSynthesis || !text) { if (onEnd) onEnd(); return; }
  window.speechSynthesis.cancel();
  var utt = new SpeechSynthesisUtterance(etApplyPronFixes(text));
  utt.lang  = 'zh-TW';
  utt.rate  = etRate;
  if (etZhVoice) utt.voice = etZhVoice;
  var done = false;
  function finish() { if (done) return; done = true; if (onEnd) onEnd(); }
  utt.onend   = finish;
  utt.onerror = finish;
  window.speechSynthesis.speak(utt);
}

function etCancelSpeak() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}
