/**
 * char-info.js — 萌典 API 查詢、注音 / 部首 / 筆畫 / 造詞字義顯示
 * 負責：loadCharInfo()、applyCharInfo()、renderWordDef()、setDefText()、showCharInfoError()、stripHtml()
 * 依賴：state.js（charInfoCache）、voice.js（speakChar）
 */
'use strict';

function stripHtml(str) {
  if (!str) return '';
  return str.replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * 從萌典 API 查詢注音／部首／筆畫，填入 #char-info-bar
 * 結果快取於 charInfoCache，避免重複請求
 * @param {string} char 目標漢字
 */
function loadCharInfo(char) {
  var elR = document.getElementById('info-radical');
  var elS = document.getElementById('info-strokes');
  var elT = document.getElementById('info-zhuyin-tabs');
  var elW = document.getElementById('info-words');
  var elD = document.getElementById('info-def');
  if (!elT) return;

  if (elR) elR.textContent = '⋯';
  if (elS) elS.textContent = '⋯';
  elT.innerHTML = '<span style="color:var(--muted);font-size:.85rem">查詢中…</span>';
  if (elW) elW.innerHTML = '';
  if (elD) elD.textContent = '查詢中…';

  if (charInfoCache[char]) { applyCharInfo(charInfoCache[char]); return; }

  fetch('https://www.moedict.tw/' + char + '.json')
    .then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function(data) {
      var radical = stripHtml(data.radical) || '－';
      var strokes = data.stroke_count != null ? String(data.stroke_count) : '－';

      // 每個讀音（heteronym）建立一個物件，包含注音與其造詞字義對應
      // 以 bopomofo 去重，最多保留 4 個讀音
      var seenBopomofo = {};
      var heteronyms   = [];
      (data.heteronyms || []).forEach(function(h) {
        var bopomofo = h.bopomofo || '－';
        if (seenBopomofo[bopomofo] || heteronyms.length >= 4) return;
        seenBopomofo[bopomofo] = true;
        var wordDefPairs = [];
        (h.definitions || []).forEach(function(d) {
          if (!d.example) return;
          var defText = stripHtml(d.def) || '－';
          d.example.forEach(function(ex) {
            if (wordDefPairs.length >= 3) return;
            var cleaned = stripHtml(ex).replace(/～/g, char);
            var matches = cleaned.match(/「([^」]+)」/g) || [];
            matches.forEach(function(m) {
              if (wordDefPairs.length >= 3) return;
              var word    = m.replace(/「|」/g, '').trim();
              var already = wordDefPairs.some(function(p) { return p.word === word; });
              if (word.length >= 2 && word.length <= 4 && !already) {
                wordDefPairs.push({ word: word, def: defText });
              }
            });
          });
        });
        var fallbackDef = '－';
        if (h.definitions && h.definitions[0]) {
          fallbackDef = stripHtml(h.definitions[0].def) || '－';
        }
        heteronyms.push({ bopomofo: bopomofo, wordDefPairs: wordDefPairs, fallbackDef: fallbackDef });
      });

      var info = { radical: radical, strokes: strokes, heteronyms: heteronyms };
      charInfoCache[char] = info;
      applyCharInfo(info);
    })
    .catch(function(e) { console.warn('loadCharInfo:', e); showCharInfoError(); });
}

function applyCharInfo(info) {
  var elR = document.getElementById('info-radical');
  var elS = document.getElementById('info-strokes');
  var elT = document.getElementById('info-zhuyin-tabs');
  var elW = document.getElementById('info-words');
  var elD = document.getElementById('info-def');
  if (elR) elR.textContent = info.radical;
  if (elS) elS.textContent = info.strokes;
  if (!elT) return;

  elT.innerHTML = '';
  var heteronyms = info.heteronyms || [];
  if (!heteronyms.length) { elT.textContent = '－'; return; }

  var char = (typeof chars !== 'undefined' && typeof currentIdx !== 'undefined') ? chars[currentIdx] : null;

  // 初始語境詞：使用第一個讀音的第一個造詞，讓 speakChar 能正確發破音字
  if (char && heteronyms[0] && heteronyms[0].wordDefPairs && heteronyms[0].wordDefPairs.length > 0) {
    setCharSpeakContext(char, heteronyms[0].wordDefPairs[0].word);
  }

  heteronyms.forEach(function(h, idx) {
    var tab = document.createElement('button');
    tab.className = 'zhuyin-tab' + (idx === 0 ? ' active' : '');
    tab.textContent = h.bopomofo;
    tab.onclick = function() {
      elT.querySelectorAll('.zhuyin-tab').forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      // 切換讀音時更新語境詞，使後續 speakChar 使用正確讀音
      if (char && h.wordDefPairs && h.wordDefPairs.length > 0) {
        setCharSpeakContext(char, h.wordDefPairs[0].word);
      }
      renderWordDef(h, elW, elD);
    };
    elT.appendChild(tab);
  });

  renderWordDef(heteronyms[0], elW, elD);
}

function renderWordDef(h, elW, elD) {
  var pairs = h.wordDefPairs || [];
  if (elW) {
    elW.innerHTML = '';
    if (pairs.length === 0) {
      elW.textContent = '－';
    } else {
      pairs.forEach(function(pair, idx) {
        var chip = document.createElement('span');
        chip.className = 'char-word-chip' + (idx === 0 ? ' active' : '');
        chip.textContent = pair.word;
        chip.onclick = function() {
          elW.querySelectorAll('.char-word-chip').forEach(function(c) { c.classList.remove('active'); });
          chip.classList.add('active');
          setDefText(elD, pair.def);
          speakChar(pair.word);
        };
        elW.appendChild(chip);
      });
    }
  }
  setDefText(elD, pairs.length > 0 ? pairs[0].def : h.fallbackDef);
}

function setDefText(elD, text) {
  if (!elD) return;
  elD.textContent = text || '－';
  elD.onclick = function() { speakChar(elD.textContent); };
}

function showCharInfoError() {
  var elR = document.getElementById('info-radical');
  var elS = document.getElementById('info-strokes');
  var elT = document.getElementById('info-zhuyin-tabs');
  var elW = document.getElementById('info-words');
  var elD = document.getElementById('info-def');
  if (elR) elR.textContent = '－';
  if (elS) elS.textContent = '－';
  if (elT) elT.textContent = '－';
  if (elW) elW.textContent = '－';
  if (elD) elD.textContent = '無法取得資料';
}

/**
 * 背景預載所有生字的萌典資料，填充 charInfoCache 與 _charContextWord
 * 使 speakChar 在使用者點擊生字卡或進行測驗時即可使用正確讀音語境
 * 請求間隔 200ms，避免 API 限流
 * @param {Array} charArray 生字陣列
 */
function preloadCharInfoAll(charArray) {
  var queue = charArray.filter(function(c) { return !charInfoCache[c]; });
  var idx = 0;
  function next() {
    if (idx >= queue.length) return;
    var c = queue[idx++];
    fetch('https://www.moedict.tw/' + c + '.json')
      .then(function(res) { return res.ok ? res.json() : null; })
      .then(function(data) {
        if (!data) return;
        var seenBopomofo = {};
        var heteronyms   = [];
        (data.heteronyms || []).forEach(function(h) {
          var bopomofo = h.bopomofo || '－';
          if (seenBopomofo[bopomofo] || heteronyms.length >= 4) return;
          seenBopomofo[bopomofo] = true;
          var wordDefPairs = [];
          (h.definitions || []).forEach(function(d) {
            if (!d.example) return;
            var defText = stripHtml(d.def) || '－';
            d.example.forEach(function(ex) {
              if (wordDefPairs.length >= 3) return;
              var cleaned = stripHtml(ex).replace(/～/g, c);
              var matches = cleaned.match(/「([^」]+)」/g) || [];
              matches.forEach(function(m) {
                if (wordDefPairs.length >= 3) return;
                var word    = m.replace(/「|」/g, '').trim();
                var already = wordDefPairs.some(function(p) { return p.word === word; });
                if (word.length >= 2 && word.length <= 4 && !already) {
                  wordDefPairs.push({ word: word, def: defText });
                }
              });
            });
          });
          var fallbackDef = h.definitions && h.definitions[0] ? stripHtml(h.definitions[0].def) || '－' : '－';
          heteronyms.push({ bopomofo: bopomofo, wordDefPairs: wordDefPairs, fallbackDef: fallbackDef });
        });
        charInfoCache[c] = {
          radical:    stripHtml(data.radical) || '－',
          strokes:    data.stroke_count != null ? String(data.stroke_count) : '－',
          heteronyms: heteronyms
        };
        // 以第一個讀音的第一個造詞初始化語境詞
        if (heteronyms[0] && heteronyms[0].wordDefPairs && heteronyms[0].wordDefPairs.length > 0) {
          setCharSpeakContext(c, heteronyms[0].wordDefPairs[0].word);
        }
      })
      .catch(function() {})
      .then(function() { setTimeout(next, 200); });
  }
  next();
}
