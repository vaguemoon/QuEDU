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

/* 一般朗讀（單字/圈詞查詢用），不帶結束回呼。posCtx（{line, ci}）是 text 在課文裡的起始位置，
   用來精準套用該位置的破音字朗讀同音字調整；沒有 posCtx 就唸系統預設讀音 */
function etSpeak(text, posCtx) {
  if (!window.speechSynthesis || !text) return;
  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) window.speechSynthesis.cancel();
  var utt = new SpeechSynthesisUtterance(etTtsText(text, posCtx));
  utt.lang  = 'zh-TW';
  utt.rate  = etRate;
  if (etZhVoice) utt.voice = etZhVoice;
  window.speechSynthesis.speak(utt);
}

/* 朗讀模式專用：需要知道「唸完了」才能自動接下一句，所以帶 onend 回呼 */
function etSpeakWithCallback(text, onEnd, posCtx) {
  if (!window.speechSynthesis || !text) { if (onEnd) onEnd(); return; }
  window.speechSynthesis.cancel();
  var utt = new SpeechSynthesisUtterance(etApplyPronFixes(text, posCtx));
  utt.lang  = 'zh-TW';
  utt.rate  = etRate;
  if (etZhVoice) utt.voice = etZhVoice;
  var done = false;
  function finish() { if (done) return; done = true; if (onEnd) onEnd(); }
  utt.onend   = finish;
  utt.onerror = finish;
  window.speechSynthesis.speak(utt);
}

/* 只點一個破音字時，語音引擎沒有上下文可判斷，常唸成別的讀音（例：行 → ㄏㄤˊ）。
   老師沒填「朗讀同音字」的話，自動找一個跟畫面注音同音、本身不是破音字的字來唸
   （老師選的讀音，沒選就是預設讀音 readings[0]），唸出來就會跟畫面上的注音一致。
   詞語、整句有上下文，語音引擎自己會判斷，不換 */
function etTtsText(text, posCtx) {
  var out = etApplyPronFixes(text, posCtx);
  if (text.length !== 1 || out !== text) return out;
  if (ZH_TTS_MISREAD[text]) return ZH_TTS_MISREAD[text];   /* 引擎單唸會唸錯的字（zh-tts.js） */
  var readings = window.HETERONYM_READINGS && HETERONYM_READINGS[text];
  if (!readings || readings.length < 2) return out;
  var fix = posCtx ? _etReadingFixAt(posCtx.line, posCtx.ci) : null;
  return zhSameSoundChar(readings[(fix && fix.readingIndex) || 0]) || out;
}

function etCancelSpeak() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}
