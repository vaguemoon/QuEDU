/**
 * admin/math-quiz.js — 四則運算測驗管理
 * 依賴：shared.js（db、showToast）、init.js（currentTeacher）
 */
'use strict';

/* ── 快取 ── */
var _mqSessions = [];

/* ── 6 碼代碼（沿用既有邏輯）── */
function _mqGenCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code  = '';
  for (var i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function _mqEsc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ════════════════════════════════════════
   載入數學測驗列表
   ════════════════════════════════════════ */
function loadMathQuizSessions() {
  var wrap = document.getElementById('mq-list-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  if (!db || !currentTeacher) { setTimeout(loadMathQuizSessions, 300); return; }

  db.collection('mathQuizSessions')
    .where('teacherUid', '==', currentTeacher.uid)
    .get()
    .then(function(snap) {
      _mqSessions = [];
      snap.forEach(function(doc) {
        _mqSessions.push(Object.assign({ id: doc.id }, doc.data()));
      });
      _mqSessions.sort(function(a, b) { return (b.createdAt || '') > (a.createdAt || '') ? 1 : -1; });
      renderMathQuizList(wrap);
    })
    .catch(function(e) {
      wrap.innerHTML = '<div style="color:var(--red);padding:12px;font-size:.85rem">載入失敗：' + _mqEsc(e.message) + '</div>';
    });
}

function renderMathQuizList(wrap) {
  if (!_mqSessions.length) {
    wrap.innerHTML = '<div style="color:var(--muted);padding:16px;text-align:center;font-size:.85rem">尚未建立任何測驗</div>';
    return;
  }

  var rows = _mqSessions.map(function(s) {
    var ops = _mqOpsLabel(s.operations);
    var status = s.active !== false
      ? '<span style="color:var(--green);font-weight:800;font-size:.78rem">● 進行中</span>'
      : '<span style="color:var(--muted);font-size:.78rem">已關閉</span>';

    return '<tr id="mq-row-' + _mqEsc(s.id) + '">' +
      '<td style="font-weight:800;padding:10px 8px">' + _mqEsc(s.name || '未命名') + '</td>' +
      '<td style="padding:10px 8px">' + (s.totalQuestions || 10) + ' 題</td>' +
      '<td style="padding:10px 8px">' + _mqEsc(ops) + '</td>' +
      '<td style="padding:10px 8px">' + status + '</td>' +
      '<td style="padding:10px 8px;white-space:nowrap">' +
        '<button class="btn btn-secondary" style="padding:4px 10px;font-size:.75rem;margin-right:4px" ' +
          'onclick="showMqShareModal(\'' + _mqEsc(s.id) + '\')">📤 派發</button>' +
        '<button class="btn btn-secondary" style="padding:4px 10px;font-size:.75rem;margin-right:4px" ' +
          'onclick="showMqResults(\'' + _mqEsc(s.id) + '\')">📊 結果</button>' +
        '<button class="btn btn-secondary" style="padding:4px 10px;font-size:.75rem;margin-right:4px" ' +
          'onclick="toggleMqActive(\'' + _mqEsc(s.id) + '\',' + (s.active !== false ? 'false' : 'true') + ')">' +
          (s.active !== false ? '停用' : '啟用') + '</button>' +
        '<button class="btn btn-secondary" style="padding:4px 10px;font-size:.75rem;margin-right:4px" ' +
          'onclick="toggleMqDetail(\'' + _mqEsc(s.id) + '\')">▼ 內容</button>' +
        '<button class="btn" style="padding:4px 10px;font-size:.75rem;color:var(--red);border-color:var(--red);background:transparent" ' +
          'onclick="deleteMqSession(\'' + _mqEsc(s.id) + '\',\'' + _mqEsc(s.name || '未命名') + '\')">🗑 刪除</button>' +
      '</td>' +
    '</tr>' +
    '<tr id="mq-detail-' + _mqEsc(s.id) + '" style="display:none">' +
      '<td colspan="5" style="padding:10px 20px 14px;background:#fafafa;border-top:1px solid var(--border);font-size:.82rem;line-height:1.8">' +
        _mqDetailHtml(s) +
      '</td>' +
    '</tr>';
  }).join('');

  wrap.innerHTML =
    '<div style="overflow-x:auto">' +
    '<table style="width:100%;border-collapse:collapse;font-size:.85rem">' +
      '<thead><tr style="border-bottom:2px solid var(--border)">' +
        '<th style="text-align:left;padding:8px;font-weight:800;color:var(--muted);font-size:.75rem">名稱</th>' +
        '<th style="text-align:left;padding:8px;font-weight:800;color:var(--muted);font-size:.75rem">題數</th>' +
        '<th style="text-align:left;padding:8px;font-weight:800;color:var(--muted);font-size:.75rem">題型</th>' +
        '<th style="text-align:left;padding:8px;font-weight:800;color:var(--muted);font-size:.75rem">狀態</th>' +
        '<th style="text-align:left;padding:8px;font-weight:800;color:var(--muted);font-size:.75rem">操作</th>' +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
    '</table></div>';
}

function _mqOpsLabel(ops) {
  if (!ops) return '—';
  var labels = [];
  if (ops.addition      && ops.addition.enabled)        labels.push('加法');
  if (ops.subtraction   && ops.subtraction.enabled)     labels.push('減法');
  if (ops.multiplication && ops.multiplication.enabled)  labels.push('乘法');
  if (ops.division      && ops.division.enabled)        labels.push('除法');
  return labels.join('・') || '—';
}

function _mqCarryLabel(t) {
  return t === 'consecutive' ? '連續進位' : t === 'carry' ? '需進位' : '不進位';
}
function _mqBorrowLabel(t) {
  return t === 'consecutive' ? '連續退位' : t === 'carry' ? '需退位' : '不退位';
}

function _mqDetailHtml(s) {
  var ops = s.operations || {};
  var lines = [];
  if (ops.addition && ops.addition.enabled) {
    var a = ops.addition;
    lines.push('<b>加法 ' + (a.count||'?') + ' 題</b>：' + (a.digitsA||2) + ' 位 ＋ ' + (a.digitsB||2) + ' 位，' + _mqCarryLabel(a.carryType));
  }
  if (ops.subtraction && ops.subtraction.enabled) {
    var b = ops.subtraction;
    lines.push('<b>減法 ' + (b.count||'?') + ' 題</b>：' + (b.digitsA||2) + ' 位 − ' + (b.digitsB||2) + ' 位，' + _mqBorrowLabel(b.borrowType));
  }
  if (ops.multiplication && ops.multiplication.enabled) {
    var m = ops.multiplication;
    var mExtra = [];
    if (m.trailingZero) mExtra.push('尾數有 0');
    if (m.middleZero)   mExtra.push('積中間有 0');
    lines.push('<b>乘法 ' + (m.count||'?') + ' 題</b>：' + (m.digitsA||2) + ' 位 × ' + (m.digitsB||1) + ' 位' + (mExtra.length ? '，' + mExtra.join('・') : ''));
  }
  if (ops.division && ops.division.enabled) {
    var d = ops.division;
    var dExtra = [];
    if (d.trailingZero) dExtra.push('商尾數有 0');
    if (d.middleZero)   dExtra.push('商中間有 0');
    var dType = d.resultType === 'remainder' ? '有餘數' : '整除';
    lines.push('<b>除法 ' + (d.count||'?') + ' 題</b>：除數 ' + (d.divisorDigits||1) + ' 位，商 ' + (d.quotientDigits||1) + ' 位，' + dType + (dExtra.length ? '，' + dExtra.join('・') : ''));
  }
  var codeHtml = s.code
    ? '<div style="margin-bottom:8px">測驗代碼：<span style="font-family:\'Courier New\',monospace;font-weight:900;font-size:1.05rem;letter-spacing:.12em;color:var(--blue)">' + _mqEsc(s.code) + '</span></div>'
    : '';
  return codeHtml + (lines.join('<br>') || '<span style="color:var(--muted)">無設定</span>');
}

function toggleMqDetail(id) {
  var row = document.getElementById('mq-detail-' + id);
  if (!row) return;
  var isHidden = row.style.display === 'none';
  row.style.display = isHidden ? '' : 'none';
  /* flip the arrow on the button */
  var btn = document.querySelector('#mq-row-' + id + ' button[onclick*="toggleMqDetail"]');
  if (btn) btn.textContent = isHidden ? '▲ 內容' : '▼ 內容';
}

async function deleteMqSession(sessionId, sessionName) {
  if (!confirm('確定要刪除「' + sessionName + '」？此操作無法復原，已提交的學生結果不受影響。')) return;
  try {
    await db.collection('mathQuizSessions').doc(sessionId).delete();
    showToast('已刪除「' + sessionName + '」');
    loadMathQuizSessions();
  } catch(e) {
    showToast('刪除失敗：' + e.message);
  }
}

/* ════════════════════════════════════════
   建立測驗 Modal
   ════════════════════════════════════════ */
function showMqCreateModal() {
  var modal = document.getElementById('mq-create-modal');
  if (!modal) return;
  document.getElementById('mq-create-error').textContent = '';
  document.getElementById('mq-name').value = '';
  /* Reset all op checkboxes and count inputs */
  ['addition','subtraction','multiplication','division'].forEach(function(k) {
    var cb = document.getElementById('mq-op-' + k);
    if (cb) { cb.checked = false; toggleMqOpPanel(k); }
    var countEl = document.getElementById(MQ_COUNT_ID[k]);
    if (countEl) countEl.value = '5';
  });
  updateMqTotal();
  modal.style.display = 'flex';
}

function hideMqCreateModal() {
  var modal = document.getElementById('mq-create-modal');
  if (modal) modal.style.display = 'none';
}

var MQ_COUNT_ID = { addition: 'mq-add-count', subtraction: 'mq-sub-count', multiplication: 'mq-mul-count', division: 'mq-div-count' };

function toggleMqOpPanel(key) {
  var cb    = document.getElementById('mq-op-' + key);
  var panel = document.getElementById('mq-panel-' + key);
  if (panel) panel.style.display = (cb && cb.checked) ? '' : 'none';
  updateMqTotal();
}

function updateMqTotal() {
  var total = 0;
  ['addition','subtraction','multiplication','division'].forEach(function(k) {
    var cb = document.getElementById('mq-op-' + k);
    if (cb && cb.checked) {
      var el = document.getElementById(MQ_COUNT_ID[k]);
      total += el ? (parseInt(el.value) || 0) : 0;
    }
  });
  var el = document.getElementById('mq-total-display');
  if (el) el.textContent = total;
}

async function createMathQuizSession() {
  var nameEl = document.getElementById('mq-name');
  var errEl  = document.getElementById('mq-create-error');
  var name   = nameEl ? nameEl.value.trim() : '';

  if (!name) { errEl.textContent = '請輸入測驗名稱'; return; }

  /* Collect operations config (includes per-op count) */
  var ops = {};
  var total = 0;
  ['addition','subtraction','multiplication','division'].forEach(function(k) {
    var cb = document.getElementById('mq-op-' + k);
    ops[k] = { enabled: !!(cb && cb.checked) };
    if (ops[k].enabled) {
      Object.assign(ops[k], _mqReadOpConfig(k));
      total += ops[k].count || 0;
    }
  });

  var anyEnabled = Object.values(ops).some(function(o) { return o.enabled; });
  if (!anyEnabled) { errEl.textContent = '請至少啟用一種運算'; return; }
  if (total < 1)   { errEl.textContent = '每種運算至少設定 1 題'; return; }

  var btn = document.getElementById('btn-create-mq');
  if (btn) btn.disabled = true;

  try {
    var docData = {
      teacherUid:     currentTeacher.uid,
      quizType:       'math',
      name:           name,
      code:           _mqGenCode(),
      totalQuestions: total,
      operations:     ops,
      active:         true,
      createdAt:      new Date().toISOString()
    };
    await db.collection('mathQuizSessions').add(docData);
    showToast('✅ 測驗建立成功！');
    hideMqCreateModal();
    loadMathQuizSessions();
  } catch(e) {
    errEl.textContent = '建立失敗：' + e.message;
  } finally {
    if (btn) btn.disabled = false;
  }
}

function _mqReadOpConfig(key) {
  function val(id) {
    var el = document.getElementById(id);
    return el ? (el.type === 'checkbox' ? el.checked : (parseInt(el.value) || el.value)) : null;
  }
  if (key === 'addition') return {
    count:     val('mq-add-count') || 5,
    digitsA:   val('mq-add-dA') || 2,
    digitsB:   val('mq-add-dB') || 2,
    carryType: (document.querySelector('input[name="mq-add-carry"]:checked') || {}).value || 'none'
  };
  if (key === 'subtraction') return {
    count:      val('mq-sub-count') || 5,
    digitsA:    val('mq-sub-dA') || 2,
    digitsB:    val('mq-sub-dB') || 2,
    borrowType: (document.querySelector('input[name="mq-sub-borrow"]:checked') || {}).value || 'none'
  };
  if (key === 'multiplication') return {
    count:        val('mq-mul-count') || 5,
    digitsA:      val('mq-mul-dA') || 2,
    digitsB:      val('mq-mul-dB') || 1,
    trailingZero: val('mq-mul-trailing'),
    middleZero:   val('mq-mul-middle')
  };
  if (key === 'division') return {
    count:          val('mq-div-count') || 5,
    dividendDigits: val('mq-div-dd')  || 2,
    divisorDigits:  val('mq-div-dv')  || 1,
    quotientDigits: val('mq-div-q')   || 1,
    resultType:     (document.querySelector('input[name="mq-div-result"]:checked') || {}).value || 'exact',
    trailingZero:   val('mq-div-trailing'),
    middleZero:     val('mq-div-middle')
  };
  return {};
}

/* ════════════════════════════════════════
   派發 Modal（沿用語文測驗的 qs-share-modal）
   ════════════════════════════════════════ */
var _mqShareSessionId = null;

async function showMqShareModal(sessionId) {
  _mqShareSessionId = sessionId;
  var s = _mqSessions.find(function(x) { return x.id === sessionId; });
  var modal     = document.getElementById('qs-share-modal');
  var nameEl    = document.getElementById('qs-share-doc-name');
  var listEl    = document.getElementById('qs-share-class-list');
  var loadingEl = document.getElementById('qs-share-loading');
  var confirmEl = document.getElementById('qs-share-confirm-btn');

  if (!modal) return;
  if (nameEl) nameEl.textContent = (s && s.name) || '數學測驗';
  if (listEl)    listEl.innerHTML  = '';
  if (loadingEl) loadingEl.style.display = 'block';
  if (confirmEl) confirmEl.onclick = saveMqShareSettings;

  modal.style.display = 'flex';

  try {
    /* Load teacher's classes */
    var classSnap = await db.collection('classes')
      .where('teacherUid', '==', currentTeacher.uid)
      .where('active', '==', true)
      .get();

    /* Find which classes already have this session shared */
    var sharedIn = {};
    await Promise.all(classSnap.docs.map(async function(cdoc) {
      var ref = db.collection('classes').doc(cdoc.id).collection('sharedQuizSessions').doc(sessionId);
      var d   = await ref.get();
      if (d.exists) sharedIn[cdoc.id] = true;
    }));

    if (loadingEl) loadingEl.style.display = 'none';
    if (listEl) {
      if (!classSnap.docs.length) {
        listEl.innerHTML = '<div style="padding:12px;color:var(--muted);font-size:.85rem">尚未建立班級</div>';
        return;
      }
      listEl.innerHTML = classSnap.docs.map(function(cdoc) {
        var cls = cdoc.data();
        return '<label style="display:flex;align-items:center;gap:10px;padding:10px 8px;cursor:pointer;border-bottom:1px solid var(--border)">' +
          '<input type="checkbox" data-cid="' + _mqEsc(cdoc.id) + '" ' + (sharedIn[cdoc.id] ? 'checked' : '') + '>' +
          '<span style="font-size:.88rem;font-weight:700">' + _mqEsc(cls.name || cdoc.id) + '</span>' +
        '</label>';
      }).join('');
    }
  } catch(e) {
    if (loadingEl) loadingEl.style.display = 'none';
    if (listEl)    listEl.innerHTML = '<div style="color:var(--red);padding:12px">載入班級失敗</div>';
  }
}

async function saveMqShareSettings() {
  if (!_mqShareSessionId) return;
  var checkboxes = document.querySelectorAll('#qs-share-class-list input[type="checkbox"]');
  var confirmBtn = document.getElementById('qs-share-confirm-btn');
  if (confirmBtn) confirmBtn.disabled = true;

  try {
    var writes = [];
    checkboxes.forEach(function(cb) {
      var cid = cb.getAttribute('data-cid');
      var ref = db.collection('classes').doc(cid).collection('sharedQuizSessions').doc(_mqShareSessionId);
      if (cb.checked) {
        writes.push(ref.set({ sessionId: _mqShareSessionId, type: 'math-quiz', sharedAt: new Date().toISOString() }));
      } else {
        writes.push(ref.delete().catch(function() {}));
      }
    });
    await Promise.all(writes);
    showToast('✅ 派發設定已儲存！');
    closeQuizShareModal();
  } catch(e) {
    showToast('儲存失敗：' + e.message);
  } finally {
    if (confirmBtn) confirmBtn.disabled = false;
  }
}

/* ════════════════════════════════════════
   查閱結果 Modal
   ════════════════════════════════════════ */
async function showMqResults(sessionId) {
  var modal = document.getElementById('mq-results-modal');
  var s     = _mqSessions.find(function(x) { return x.id === sessionId; });
  if (!modal) return;

  document.getElementById('mq-results-title').textContent = (s && s.name) || '測驗結果';
  document.getElementById('mq-results-body').innerHTML    = '<div class="loading-wrap"><div class="spinner"></div></div>';
  modal.style.display = 'flex';

  try {
    var snap = await db.collection('mathQuizResults')
      .where('sessionId', '==', sessionId)
      .get();

    if (snap.empty) {
      document.getElementById('mq-results-body').innerHTML =
        '<div style="padding:20px;text-align:center;color:var(--muted);font-size:.85rem">尚無學生作答紀錄</div>';
      return;
    }

    /* Group by student, keep best score */
    var byStudent = {};
    snap.forEach(function(doc) {
      var d = doc.data();
      var sid = d.studentId || 'unknown';
      if (!byStudent[sid] || d.score > byStudent[sid].score) {
        byStudent[sid] = d;
      }
    });

    /* Error type frequency */
    var errorFreq = {};
    Object.values(byStudent).forEach(function(d) {
      (d.questions || []).forEach(function(q) {
        if (q.errorType) errorFreq[q.errorType] = (errorFreq[q.errorType] || 0) + 1;
      });
    });

    /* Student table */
    var rows = Object.values(byStudent).sort(function(a,b) { return b.score - a.score; }).map(function(d, idx) {
      var detailId = 'mq-sd-' + idx;
      var errTags = (d.questions || [])
        .filter(function(q) { return q.errorType; })
        .map(function(q) {
          return '<span style="font-size:.68rem;background:var(--wrong-lt,#ffebee);color:var(--red);border:1px solid var(--red);border-radius:20px;padding:1px 7px;margin-right:3px">' + _mqEsc(q.errorType) + '</span>';
        }).join('');
      var mainRow = '<tr style="border-bottom:1px solid var(--border);cursor:pointer" onclick="var r=document.getElementById(\'' + detailId + '\');r.style.display=r.style.display===\'none\'?\'table-row\':\'none\'">' +
        '<td style="padding:8px 10px;font-weight:800">' + _mqEsc(d.studentName || '—') + '</td>' +
        '<td style="padding:8px 10px;text-align:center;font-weight:900;font-size:1.1rem;color:' + (d.score >= 60 ? 'var(--green)' : 'var(--red)') + '">' + d.score + '</td>' +
        '<td style="padding:8px 10px">' + (errTags || '<span style="color:var(--muted);font-size:.78rem">—</span>') + '</td>' +
      '</tr>';
      var detailRow = '<tr id="' + detailId + '" style="display:none;background:#fafafa">' +
        '<td colspan="3" style="padding:10px 16px 14px">' + _mqBuildStudentDetail(d) + '</td>' +
      '</tr>';
      return mainRow + detailRow;
    }).join('');

    /* Error summary */
    var errSummaryHtml = '';
    var sortedErrors = Object.entries(errorFreq).sort(function(a,b) { return b[1]-a[1]; });
    if (sortedErrors.length) {
      errSummaryHtml = '<div style="margin-bottom:16px;padding:12px;background:var(--wrong-lt,#ffebee);border-radius:10px;border:1px solid var(--red)">' +
        '<div style="font-size:.78rem;font-weight:900;color:var(--red);margin-bottom:8px">📊 全班常見錯誤</div>' +
        sortedErrors.map(function(e) {
          return '<span style="font-size:.82rem;font-weight:700;margin-right:12px">【' + _mqEsc(e[0]) + '】' + e[1] + ' 人次</span>';
        }).join('') +
      '</div>';
    }

    document.getElementById('mq-results-body').innerHTML =
      errSummaryHtml +
      '<div style="overflow-x:auto">' +
      '<table style="width:100%;border-collapse:collapse;font-size:.85rem">' +
        '<thead><tr style="border-bottom:2px solid var(--border)">' +
          '<th style="text-align:left;padding:8px 10px;font-weight:800;color:var(--muted);font-size:.75rem">學生</th>' +
          '<th style="text-align:center;padding:8px 10px;font-weight:800;color:var(--muted);font-size:.75rem">得分</th>' +
          '<th style="text-align:left;padding:8px 10px;font-weight:800;color:var(--muted);font-size:.75rem">錯誤標籤</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table></div>';
  } catch(e) {
    document.getElementById('mq-results-body').innerHTML =
      '<div style="color:var(--red);padding:12px">載入失敗：' + _mqEsc(e.message) + '</div>';
  }
}

function hideMqResultsModal() {
  var modal = document.getElementById('mq-results-modal');
  if (modal) modal.style.display = 'none';
}

function _mqBuildStudentDetail(d) {
  var qs = d.questions || [];
  if (!qs.length) return '<span style="color:var(--muted);font-size:.82rem">無詳細資料</span>';
  var totalTime = d.durationSeconds ? '總時長：' + d.durationSeconds + ' 秒　' : '';
  return '<div style="font-size:.75rem;color:var(--muted);margin-bottom:8px">' + totalTime + '點擊列可收合</div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:.8rem">' +
    qs.map(function(q, i) {
      var expr = q.a + ' ' + q.op + ' ' + q.b + ' = ' + q.answer;
      if (q.op === '÷' && q.remainder !== null) expr += ' … ' + q.remainder;
      var stuMain = q.studentAnswer !== null && q.studentAnswer !== undefined ? q.studentAnswer : '—';
      var stuStr  = String(stuMain);
      if (q.op === '÷' && q.remainder !== null) {
        stuStr += ' … ' + (q.studentRemainder !== null && q.studentRemainder !== undefined ? q.studentRemainder : '—');
      }
      var timeStr  = q.timeSeconds ? q.timeSeconds + 's' : '';
      var errTag   = q.errorType ? '<span style="font-size:.65rem;background:var(--wrong-lt,#ffebee);color:var(--red,#c62828);border:1px solid var(--red,#c62828);border-radius:20px;padding:1px 6px;margin-left:4px">' + _mqEsc(q.errorType) + '</span>' : '';
      return '<tr style="border-bottom:1px solid var(--rule-lt,#ede8e0)">' +
        '<td style="padding:4px 6px;color:var(--muted);font-weight:700;width:22px">' + (i + 1) + '.</td>' +
        '<td style="padding:4px 6px;font-family:\'Courier New\',monospace;font-weight:700">' + _mqEsc(expr) + '</td>' +
        '<td style="padding:4px 6px;font-weight:900;color:' + (q.correct ? 'var(--green)' : 'var(--red)') + '">' + (q.correct ? '✓' : '✗') + '</td>' +
        '<td style="padding:4px 6px;color:var(--red);font-size:.75rem">' + (!q.correct ? _mqEsc('答：' + stuStr) : '') + errTag + '</td>' +
        '<td style="padding:4px 6px;color:var(--muted);font-size:.72rem;text-align:right">' + timeStr + '</td>' +
      '</tr>';
    }).join('') +
    '</table>';
}

/* ════════════════════════════════════════
   啟用 / 停用
   ════════════════════════════════════════ */
async function toggleMqActive(sessionId, newActive) {
  try {
    await db.collection('mathQuizSessions').doc(sessionId).update({ active: newActive });
    showToast(newActive ? '✅ 已啟用測驗' : '已停用測驗');
    loadMathQuizSessions();
  } catch(e) {
    showToast('操作失敗：' + e.message);
  }
}
