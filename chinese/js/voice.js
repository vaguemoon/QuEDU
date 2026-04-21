/**
 * voice.js — 語音朗讀
 * 負責：載入中文語音、speakChar()、setCharSpeakContext()
 * 依賴：shared.js 的 soundEnabled 變數、state.js 的 charInfoCache
 */
'use strict';

var synth   = window.speechSynthesis;
var zhVoice = null;

// 破音字語境詞表：記錄各字目前應使用的詞語，供 speakChar 取得發音語境
// 由 char-info.js 的 applyCharInfo / 注音切換 tab 更新
var _charContextWord = {};

function loadVoices() {
  var voices = synth.getVoices();
  zhVoice = voices.find(function(v) {
    return v.lang === 'zh-TW' || v.lang === 'zh-HK' || v.lang.startsWith('zh');
  }) || null;
}

if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = loadVoices;
loadVoices();

/**
 * 設定指定漢字的發音語境詞（解決破音字問題）
 * 由 char-info.js 在顯示或切換注音 tab 時呼叫
 * @param {string} char 漢字
 * @param {string} word 包含該字且讀音明確的詞語
 */
function setCharSpeakContext(char, word) {
  if (char && word) _charContextWord[char] = word;
}

/**
 * 朗讀漢字或詞語（使用 Web Speech API）
 * 若傳入單字且未指定 bare，依優先順序選擇發音語境：
 *   1. setCharSpeakContext 設定的語境詞（使用者切換注音 tab 時）
 *   2. charInfoCache 快取中第一個讀音的第一個造詞（背景預載後）
 *   3. 裸字（無快取時的回退，TTS 自行判斷）
 * @param {string} char 要朗讀的字或詞
 * @param {boolean} [bare] 傳入 true 時強制唸裸字，不套用語境詞
 */
function speakChar(char, bare) {
  if (!soundEnabled) return;
  try {
    synth.cancel();
    var text = char;
    if (!bare && char && char.length === 1) {
      if (_charContextWord[char]) {
        // 優先使用使用者切換注音 tab 時設定的語境詞
        text = _charContextWord[char];
      } else if (typeof charInfoCache !== 'undefined' && charInfoCache[char]) {
        // 其次從萌典快取取第一個讀音的第一個造詞
        var h0 = charInfoCache[char].heteronyms && charInfoCache[char].heteronyms[0];
        if (h0 && h0.wordDefPairs && h0.wordDefPairs.length > 0) {
          text = h0.wordDefPairs[0].word;
        }
      }
    }
    var u = new SpeechSynthesisUtterance(text);
    u.lang  = 'zh-TW';
    u.rate  = 0.85;
    u.pitch = 1.1;
    if (zhVoice) u.voice = zhVoice;
    synth.speak(u);
  } catch(e) {}
}
