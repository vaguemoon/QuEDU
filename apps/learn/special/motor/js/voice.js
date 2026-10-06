/**
 * voice.js — 連連看點到點時唸出注音符號或數字
 * 注音符號：優先播全校共用的老師錄音（zhuyinSounds collection），沒錄音才退回 TTS 唸符號本身
 * 數字：轉成中文數字字串後用 TTS 唸出來
 * 做法跟注音趣（apps/learn/lang/zhuyin/js/voice.js）、認字趣一致，共用 shared.js 的 pickBestZhVoice()
 */
'use strict';

var _motorZhVoice = null;
function _motorLoadVoices() {
  if (!window.speechSynthesis) return;
  var voices = window.speechSynthesis.getVoices();
  if (voices && voices.length) _motorZhVoice = pickBestZhVoice(voices);
}
if (window.speechSynthesis) {
  _motorLoadVoices();
  window.speechSynthesis.onvoiceschanged = _motorLoadVoices;
}

function _motorSpeak(text) {
  if (!soundEnabled || !window.speechSynthesis || !text) return;
  try {
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
    }
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-TW';
    u.rate = 0.85;
    if (_motorZhVoice) u.voice = _motorZhVoice;
    window.speechSynthesis.speak(u);
  } catch (e) {}
}

/* 注音符號資料（全校共用圖庫，文件 ID = 符號本身），開啟 app 時先載一次快取起來，
 * 跟注音趣的 loadZhuyinData() 讀同一個 collection */
var _motorZhuyinAudio = {};
function _motorLoadZhuyinAudio() {
  if (!db) { setTimeout(_motorLoadZhuyinAudio, 300); return; }
  db.collection('zhuyinSounds').get().then(function(snap) {
    snap.forEach(function(doc) {
      var d = doc.data();
      if (d.audioData) _motorZhuyinAudio[doc.id] = d.audioData;
    });
  }).catch(function() {});
}
_motorLoadZhuyinAudio();

var CN_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
function numberToChinese(n) {
  if (!isFinite(n)) return String(n);
  if (n < 10) return CN_DIGITS[n];
  if (n === 10) return '十';
  if (n < 20) return '十' + CN_DIGITS[n - 10];
  var tens = Math.floor(n / 10), ones = n % 10;
  return CN_DIGITS[tens] + '十' + (ones ? CN_DIGITS[ones] : '');
}

/* 連到一個點時唸出那個點的標籤
 * label：注音符號字串，或數字（number 或 numeric string） */
function speakDotLabel(label, isZhuyin) {
  if (!soundEnabled) return;
  if (isZhuyin) {
    var audioData = _motorZhuyinAudio[label];
    if (audioData) {
      try { new Audio(audioData).play(); return; } catch (e) {}
    }
    _motorSpeak(label); // 這個符號還沒有老師錄音，退回 TTS 唸符號本身
  } else {
    _motorSpeak(numberToChinese(Number(label)));
  }
}
