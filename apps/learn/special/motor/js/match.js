'use strict';

var _matchLevel        = null;
var _matchRound        = null;
var _matchRoundIdx     = 0;
var _matchCorrectCount = 0;

function openMatch(levelIdx) {
  currentModule   = 'match';
  currentLevelIdx = levelIdx;
  _matchLevel = MATCH_LEVELS[levelIdx];
  _matchRoundIdx = 0;
  _matchCorrectCount = 0;
  document.getElementById('game-title').textContent = _matchLevel.title;
  document.getElementById('game-hint').textContent = '找出跟範本一模一樣的圖案！';
  showSandbox('match-sandbox');
  _nextMatchRound();
  showPage('game');
}

function _matchUpdateStats() {
  var el = document.getElementById('game-progress');
  if (el) el.textContent = _matchCorrectCount + ' / ' + _matchLevel.rounds;
}

function _nextMatchRound() {
  _matchRound = generateMatchRound(_matchLevel.difficulty);
  _matchUpdateStats();
  _renderMatchRound();
}

function _renderMatchRound() {
  var family = MATCH_ICON_FAMILIES[_matchRound.family];

  var refSvg = document.getElementById('match-ref-svg');
  refSvg.innerHTML = '';
  family.render(refSvg, _matchRound.reference);

  var optsEl = document.getElementById('match-options');
  optsEl.innerHTML = '';
  _matchRound.options.forEach(function(params, idx) {
    var btn = document.createElement('button');
    btn.className = 'match-option-btn';
    btn.addEventListener('click', function() { _onMatchOptionClick(idx, btn); });
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    family.render(svg, params);
    btn.appendChild(svg);
    optsEl.appendChild(btn);
  });
}

function _onMatchOptionClick(idx, btnEl) {
  if (idx === _matchRound.correctIdx) {
    sfxCorrect();
    flashBox('match-sandbox', 'green');
    btnEl.classList.add('match-correct');
    _matchCorrectCount++;
    _matchRoundIdx++;
    _matchUpdateStats();
    if (_matchRoundIdx >= _matchLevel.rounds) {
      setTimeout(function() {
        addStar('match', _matchLevel.id);
        showResult(_matchLevel.title, 'match');
      }, 700);
    } else {
      showToast('✨ 答對了！');
      setTimeout(_nextMatchRound, 700);
    }
  } else {
    sfxWrong();
    flashBox('match-sandbox', 'red');
    if (navigator.vibrate) { try { navigator.vibrate(80); } catch (e) {} }
    btnEl.classList.add('match-wrong');
    setTimeout(function() { btnEl.classList.remove('match-wrong'); }, 400);
  }
}
