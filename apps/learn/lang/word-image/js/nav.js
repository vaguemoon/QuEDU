'use strict';

var PAGE_STACK = [];

var _PAGE_TITLES = {
  grade:  '🖼️ 詞語趣',
  lesson: '🖼️ 詞語趣',
  mode:   '',          // set dynamically
  browse: '圖卡瀏覽',
  quiz:   '看圖猜詞',
  result: '成績'
};

function showPage(id, push) {
  if (push !== false) PAGE_STACK.push(id);

  document.querySelectorAll('.wi-page').forEach(function(p) {
    p.classList.toggle('active', p.id === 'page-' + id);
  });

  var backBtn = document.getElementById('topbar-back');
  var hubBtn  = document.getElementById('btn-back-hub');
  var titleEl = document.getElementById('topbar-title');
  var isRoot  = (id === 'grade');

  if (backBtn) backBtn.classList.toggle('hidden', isRoot);
  if (hubBtn)  hubBtn.classList.toggle('hidden', !isRoot);

  if (titleEl) {
    if (id === 'mode') {
      titleEl.textContent = currentLessonName
        ? (currentGrade + '　' + currentLessonName)
        : (currentGrade + '　第' + currentLesson + '課');
    } else {
      titleEl.textContent = _PAGE_TITLES[id] || '🖼️ 詞語趣';
    }
  }
}

function goBack() {
  if (PAGE_STACK.length <= 1) { backToHub(); return; }
  PAGE_STACK.pop();
  showPage(PAGE_STACK[PAGE_STACK.length - 1], false);
}

function backToHub() {
  try { window.parent.postMessage({ type: 'word-image-back' }, '*'); } catch(e) {}
}

/* ── Result page ── */
function renderResultPage(score, total, rounds) {
  var pct       = total ? Math.round(score / total * 100) : 0;
  var scoreText = score + ' / ' + total + ' 首輪答對';
  var emoji = pct >= 90 ? '🎉' : pct >= 70 ? '👍' : '💪';
  var msg   = pct >= 90 ? '太厲害了！' : pct >= 70 ? '繼續加油！' : '加油！';
  var roundNote = (rounds && rounds > 1)
    ? '<div class="wi-result-rounds">複習了 ' + (rounds - 1) + ' 輪，全部完成！</div>'
    : '';

  var inner = document.querySelector('#page-result .wi-page-inner');
  if (!inner) return;
  inner.innerHTML =
    '<div class="wi-result-wrap">' +
      '<div class="wi-result-emoji">' + emoji + '</div>' +
      '<div class="wi-result-score">' + _escHtml(scoreText) + '</div>' +
      '<div class="wi-result-pct">' + pct + '%　' + msg + '</div>' +
      roundNote +
      '<div class="wi-result-btns">' +
        '<button class="wi-btn-primary" onclick="startQuiz()">再玩一次</button>' +
        '<button class="wi-btn-secondary" onclick="startBrowse()">🃏 圖卡瀏覽</button>' +
        '<button class="wi-btn-secondary" onclick="showPage(\'mode\', false)">← 回選單</button>' +
      '</div>' +
    '</div>';
}
