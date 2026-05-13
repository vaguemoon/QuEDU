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

/* ── 煙花動畫 ── */
function _launchFireworks() {
  var container = document.createElement('div');
  container.className = 'wi-fireworks';
  document.body.appendChild(container);

  var colors = ['#e74c3c','#f39c12','#3498db','#27ae60','#9b59b6','#e67e22','#1abc9c','#f1c40f'];
  var bursts  = [[22,28],[72,22],[48,38],[18,52],[78,42],[55,18],[35,60],[65,55]];

  bursts.forEach(function(pos, b) {
    setTimeout(function() {
      for (var p = 0; p < 14; p++) {
        var dot   = document.createElement('div');
        dot.className = 'wi-fw-dot';
        var angle = (p / 14) * 360 + Math.random() * 12;
        var dist  = 55 + Math.random() * 75;
        dot.style.left       = pos[0] + '%';
        dot.style.top        = pos[1] + '%';
        dot.style.background = colors[Math.floor(Math.random() * colors.length)];
        dot.style.setProperty('--dx', (Math.cos(angle * Math.PI / 180) * dist) + 'px');
        dot.style.setProperty('--dy', (Math.sin(angle * Math.PI / 180) * dist) + 'px');
        dot.style.animationDelay = (Math.random() * 0.08) + 's';
        container.appendChild(dot);
      }
    }, b * 320);
  });

  setTimeout(function() {
    if (container.parentNode) container.parentNode.removeChild(container);
  }, 5000);
}

/* ── 最終慶祝畫面（全部輪次完成） ── */
function renderResultPage(score, total, rounds) {
  var pct   = total ? Math.round(score / total * 100) : 0;
  var emoji = pct >= 90 ? '🎉' : pct >= 70 ? '🏆' : '💪';
  var msg   = pct >= 90 ? '太厲害了！全部答對！' : pct >= 70 ? '做得很好！' : '加油，繼續練習！';
  var roundNote = rounds > 1
    ? '<div class="wi-celebrate-rounds">共練習了 ' + rounds + ' 輪完成！</div>'
    : '';

  var inner = document.querySelector('#page-result .wi-page-inner');
  if (!inner) return;

  sfxCelebrate();
  setTimeout(_launchFireworks, 100);

  inner.innerHTML =
    '<div class="wi-celebrate-wrap">' +
      '<div class="wi-celebrate-emoji">' + emoji + '</div>' +
      '<div class="wi-celebrate-msg">' + _escHtml(msg) + '</div>' +
      '<div class="wi-celebrate-score">' + score + ' / ' + total + ' 首輪答對</div>' +
      '<div class="wi-celebrate-pct">' + pct + '%</div>' +
      roundNote +
      '<div class="wi-result-btns">' +
        '<button class="wi-btn-primary" onclick="startQuiz()">再玩一次</button>' +
        '<button class="wi-btn-secondary" onclick="showPage(\'mode\', false)">← 回選單</button>' +
      '</div>' +
    '</div>';
}
