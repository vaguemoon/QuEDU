/**
 * menu.js — 生字選單與學習進度條
 * 負責：renderMenu()、updateProgressBar()、onCardClick()
 * 依賴：state.js、nav.js、voice.js、practice.js（switchToPractice）
 */
'use strict';

// ── 自選測驗卡片樣式（動態注入）──
injectStyle('exam-select-style', [
  '.exam-select-active{border:2px solid #185FA5 !important;background:#E6F1FB !important;position:relative;}',
  '.char-card-select-check{position:absolute;top:4px;right:6px;font-size:13px;font-weight:700;color:#185FA5;line-height:1;}'
]);

// ── 自選測驗狀態 ──
var examSelectMode = false;   // 是否處於勾選模式
var examSelected   = {};      // { index: true/false }

/**
 * 更新頂部進度條（已通過 / 練習中 / 未學習 三段比例）
 * 同時控制「開始今日測驗」按鈕的呼吸動畫
 */
function updateProgressBar() {
  if (!chars.length) return;
  var total = chars.length;
  var nM = chars.filter(function(c){ return charStatus[c] === 'mastered'; }).length;
  var nN = total - nM;
  var pM = Math.round(nM / total * 100);
  var pN = 100 - pM;

  var em = document.getElementById('prog-mastered');
  var en = document.getElementById('prog-new');
  if (em) em.style.width = pM + '%';
  if (en) en.style.width = pN + '%';

  var counts = document.getElementById('prog-counts');
  if (counts) counts.innerHTML =
    '<div class="progress-count-item"><div class="progress-count-dot" style="background:var(--green)"></div><span style="color:var(--green-dk)">通過測驗 ' + nM + ' 字</span></div>' +
    '<div class="progress-count-item"><div class="progress-count-dot" style="background:#d0e4f5"></div><span style="color:var(--muted)">未練習 ' + nN + ' 字</span></div>';

  var btn = document.getElementById('btn-start-exam');
  if (btn) {
    btn.classList.remove('btn-exam-pulse', 'btn-exam-breathe');
    if (nM === total) {
      void btn.offsetWidth;
      btn.classList.add('btn-exam-pulse');
      setTimeout(function(){ btn.classList.add('btn-exam-breathe'); }, 2100);
    }
  }
}

/**
 * 重新渲染生字卡片格子
 * 每次 charStatus 改變後呼叫，同時儲存進度並更新進度條
 */
function renderMenu() {
  var body = document.getElementById('menu-body');
  if (!body) return;
  saveProgress();
  updateProgressBar();

  var statusLabel = { new:'尚未學習', dictated:'通過默寫', mastered:'通過測驗' };
  var statusClass = { new:'status-new', dictated:'status-new', mastered:'status-mastered' };

  body.innerHTML = chars.map(function(c, i) {
    var raw  = charStatus[c] || 'new';
    var st   = (raw === 'mastered' || raw === 'dictated') ? raw : 'new';
    var base = st === 'mastered' ? 'char-card mastered' : st === 'dictated' ? 'char-card dictated' : 'char-card';
    var sel  = examSelectMode && examSelected[i];
    var card = base + (sel ? ' exam-select-active' : '');
    var onclick = examSelectMode
      ? 'onCardSelectToggle(' + i + ')'
      : 'onCardClick(event,' + i + ')';
    return '<div class="' + card + '" id="card-' + i + '" onclick="' + onclick + '">'
      + (sel ? '<div class="char-card-select-check">✓</div>' : '<div class="char-card-check">✓</div>')
      + '<div class="char-card-glyph">' + c + '</div>'
      + '<div class="char-card-status ' + statusClass[st] + '">' + statusLabel[st] + '</div>'
      + '</div>';
  }).join('');

  _renderExamButtons();
}

/**
 * 渲染底部測驗按鈕區（推薦模式 / 調整模式）
 */
function _renderExamButtons() {
  var bb = document.getElementById('menu-exam-bar');
  if (!bb) return;

  if (examSelectMode) {
    // ── 調整模式：點選卡片挑字 ──
    var n = Object.keys(examSelected).filter(function(k){ return examSelected[k]; }).length;
    bb.innerHTML =
      '<div class="exam-adjust-hint">點選要測驗的字（已選 <b>' + n + '</b> 字）</div>' +
      '<div style="display:flex;gap:10px;">' +
        '<button class="btn-big" style="background:#f0f4f8;color:#5a7080;flex:0 0 auto;padding:13px 20px;" onclick="cancelExamSelect()">' +
          '<span>取消</span></button>' +
        '<button class="btn-big btn-big-danger" style="flex:1;opacity:' + (n > 0 ? '1' : '.4') + ';" ' +
          (n > 0 ? 'onclick="startSelectedExam()"' : 'disabled') + '>' +
          '<span class="btn-big-icon">📝</span><span>開始測驗（' + n + ' 字）</span></button>' +
      '</div>';
  } else {
    // ── 推薦模式：自動抓 5 個未測的字 ──
    var notMastered = chars.filter(function(c){ return charStatus[c] !== 'mastered'; });
    var recommended = notMastered.slice(0, 5);
    var recLabel = recommended.join('　');
    var hasRec   = recommended.length > 0;

    bb.innerHTML =
      '<div class="exam-rec-bar">' +
        (hasRec
          ? '<div class="exam-rec-label">✨ 建議今天練習</div>' +
            '<div class="exam-rec-chars">' + recLabel + '</div>'
          : '<div class="exam-rec-label">🎉 所有字都通過了！</div>'
        ) +
      '</div>' +
      '<div style="display:flex;gap:10px;">' +
        '<button class="btn-big" style="background:#e6f1fb;color:#185FA5;border:1.5px solid #85B7EB;flex:0 0 auto;padding:13px 20px;" onclick="enterExamSelectMode()">' +
          '<span>自己調整</span></button>' +
        '<button class="btn-big btn-big-danger" id="btn-start-exam" style="flex:1;" ' +
          (hasRec ? 'onclick="startRecommendedExam()"' : 'disabled style="opacity:.4"') + '>' +
          '<span class="btn-big-icon">📝</span><span>直接開始（' + recommended.length + ' 字）</span></button>' +
      '</div>';
    updateProgressBar();
  }
}

/**
 * 以推薦的 5 個字開始測驗
 */
function startRecommendedExam() {
  var notMastered = chars.filter(function(c){ return charStatus[c] !== 'mastered'; });
  var recommended = notMastered.slice(0, 5);
  if (!recommended.length) return;
  startFullExam(recommended);
}

/**
 * 進入自選測驗勾選模式
 */
function enterExamSelectMode() {
  sfxTap();
  examSelectMode = true;
  examSelected   = {};
  renderMenu();
}

/**
 * 取消勾選模式，回到正常狀態
 */
function cancelExamSelect() {
  sfxTap();
  examSelectMode = false;
  examSelected   = {};
  renderMenu();
}

/**
 * 勾選模式下點擊卡片：切換勾選狀態
 */
function onCardSelectToggle(idx) {
  sfxTap();
  examSelected[idx] = !examSelected[idx];
  speakChar(chars[idx]);
  renderMenu();
}

/**
 * 以已勾選的字開始測驗
 */
function startSelectedExam() {
  var selected = chars.filter(function(c, i){ return examSelected[i]; });
  if (!selected.length) return;
  examSelectMode = false;
  examSelected   = {};
  startFullExam(selected);
}

/**
 * 點擊生字卡：播放語音 + 漣漪效果 + 進入練習頁
 */
function onCardClick(evt, idx) {
  sfxTap();
  var card = document.getElementById('card-' + idx);
  if (card) {
    var ripple = document.createElement('div');
    ripple.className = 'char-card-ripple';
    var r    = card.getBoundingClientRect();
    var size = Math.max(r.width, r.height);
    card.style.overflow = 'hidden';
ripple.style.cssText = 'position:absolute;width:' + size + 'px;height:' + size + 'px;left:' + (evt.clientX - r.left - size/2) + 'px;top:' + (evt.clientY - r.top - size/2) + 'px;border-radius:50%;background:rgba(74,144,217,.25);animation:ripple .5s ease-out forwards;pointer-events:none;';
    card.appendChild(ripple);
    setTimeout(function(){ ripple.remove(); }, 500);
  }
  speakChar(chars[idx]);
  setTimeout(function() {
    currentIdx = idx;
    showPage('learn');
    setTimeout(switchToPractice, 50);
  }, 200);
}

/**
 * 開啟單字模式選擇頁（練習 or 測驗）
 */
function openModeSelect(idx) {
  currentIdx = idx;
  var el = document.getElementById('mode-select-char');
  if (el) el.textContent = chars[idx];
  showPage('mode');
}

function enterPracticeMode() { sfxTap(); showPage('learn'); setTimeout(switchToPractice, 50); }
function enterExamMode()     { sfxTap(); showPage('learn'); setTimeout(switchToSingleExam, 50); }

/**
 * 重新開啟目前字（依 currentMode 選擇進入哪個模式）
 */
function openChar(idx) {
  currentIdx = idx;
  showPage('learn');
  if      (currentMode === 'practice')   setTimeout(switchToPractice, 50);
  else if (currentMode === 'dict')       setTimeout(switchToDict, 50);
  else                                   setTimeout(function(){ initExam(chars[idx]); }, 50);
}

/**
 * 前往下一個字（practice / dict 模式共用）
 */
function nextChar() {
  sfxSwipe();
  if (currentIdx < chars.length - 1) {
    currentIdx++;
    openChar(currentIdx);
  } else {
    sfxCelebrate();
    showToast('🎊 所有字都練完了！');
    showPage('menu');
    renderMenu();
  }
}
