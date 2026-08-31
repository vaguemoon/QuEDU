/**
 * voice.js — TTS 語音朗讀
 */
'use strict';

var synth   = window.speechSynthesis;
var zhVoice = null;

function loadVoices() {
  var voices = synth.getVoices();
  zhVoice = voices.find(function(v) {
    return v.lang === 'zh-TW' || v.lang === 'zh-HK' || v.lang.startsWith('zh');
  }) || null;
}

if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = loadVoices;
loadVoices();

function speakText(text) {
  if (!soundEnabled) return;
  try {
    synth.cancel();
    if (text && text.length === 1) {
      var _ov = typeof getCurriculumCharOverride === 'function' ? getCurriculumCharOverride(text) : null;
      if (_ov) text = _ov;
    }
    var u = new SpeechSynthesisUtterance(text);
    u.lang  = 'zh-TW';
    u.rate  = 0.85;
    u.pitch = 1.1;
    if (zhVoice) u.voice = zhVoice;
    synth.speak(u);
  } catch(e) {}
}
