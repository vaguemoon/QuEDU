/* shared/report.js — 用戶回報 Widget
 * 使用方式：<script src="report.js"></script>
 *           <script>initReportWidget({ role: 'teacher' | 'student' | 'guest' });</script>
 */
(function () {
  'use strict';

  var FB_CONFIG = {
    apiKey: 'AIzaSyBLhonzZkR1ORDPKgxmaVLFUwvPiEMpdj0',
    authDomain: 'tainping-hanzi-app.firebaseapp.com',
    projectId: 'tainping-hanzi-app',
    storageBucket: 'tainping-hanzi-app.firebasestorage.app',
    messagingSenderId: '158917910126',
    appId: '1:158917910126:web:e52a1d0456d1fd4fe6907f'
  };

  var rConfig = null;
  var rDb = null;

  /* ── Firebase 初始化（相容已初始化的頁面） ── */
  function getDb(cb) {
    if (rDb) { cb(rDb); return; }
    if (typeof firebase === 'undefined') {
      setTimeout(function () { getDb(cb); }, 150);
      return;
    }
    try {
      if (!firebase.apps.length) firebase.initializeApp(FB_CONFIG);
      rDb = firebase.firestore();
      cb(rDb);
    } catch (e) {
      setTimeout(function () { getDb(cb); }, 300);
    }
  }

  /* ── 取得回報者資訊 ── */
  function getReporterInfo() {
    var info = {
      reporterType: rConfig.role,
      reporterEmail: null,
      reporterName: null,
      reporterSchool: null,
      reporterClass: null
    };
    if (rConfig.role === 'teacher') {
      try {
        if (typeof firebase !== 'undefined' && firebase.apps.length
            && typeof firebase.auth !== 'undefined') {
          var u = firebase.auth().currentUser;
          if (u) {
            info.reporterEmail = u.email || null;
            info.reporterName  = u.displayName || null;
          }
        }
      } catch (e) {}
    } else if (rConfig.role === 'student') {
      try {
        var raw = sessionStorage.getItem('hub_student');
        if (raw) {
          var s = JSON.parse(raw);
          info.reporterName  = s.nickname || s.name || null;
          info.reporterClass = (s.classIds && s.classIds.length) ? s.classIds[0] : null;
        }
      } catch (e) {}
    }
    return info;
  }

  /* ── 注入 DOM ── */
  function injectHTML() {
    var btnTitle = rConfig.role === 'guest' ? '聯絡管理員' : '回報問題或建議';
    var modalTitle = rConfig.role === 'guest' ? '📬 聯絡管理員' : '📬 回報問題或建議';

    /* 浮動按鈕 */
    var btn = document.createElement('button');
    btn.id = 'report-widget-btn';
    btn.className = 'report-btn';
    btn.title = btnTitle;
    btn.setAttribute('aria-label', btnTitle);
    btn.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"'
      + ' stroke="currentColor" stroke-width="2.2"'
      + ' stroke-linecap="round" stroke-linejoin="round">'
      + '<rect x="2" y="4" width="20" height="16" rx="2"/>'
      + '<path d="m2 7 10 7 10-7"/>'
      + '</svg>';
    document.body.appendChild(btn);
    makeDraggable(btn, openModal);

    /* Modal */
    var overlay = document.createElement('div');
    overlay.id = 'report-modal-overlay';
    overlay.className = 'report-modal-overlay';
    overlay.style.display = 'none';
    overlay.innerHTML =
      '<div class="report-modal-box">'
      + '<div class="report-modal-header">'
        + '<span>' + modalTitle + '</span>'
        + '<button class="report-modal-close" id="r-close" aria-label="關閉">✕</button>'
      + '</div>'
      + '<div class="report-modal-body">'
        + '<div class="report-field">'
          + '<label class="report-label">類型</label>'
          + '<div class="report-type-group">'
            + '<label class="report-type-option selected" id="rtype-problem">'
              + '<input type="radio" name="r-type" value="problem" checked> 🐛 問題回報'
            + '</label>'
            + '<label class="report-type-option" id="rtype-suggestion">'
              + '<input type="radio" name="r-type" value="suggestion"> 💡 功能建議'
            + '</label>'
          + '</div>'
        + '</div>'
        + '<div class="report-field">'
          + '<label class="report-label" for="r-title">標題 <span class="report-required">*</span></label>'
          + '<input class="report-input" id="r-title" type="text"'
          + ' placeholder="簡短描述問題或建議" maxlength="60">'
        + '</div>'
        + '<div class="report-field">'
          + '<label class="report-label" for="r-desc">詳細說明 <span class="report-required">*</span></label>'
          + '<textarea class="report-textarea" id="r-desc"'
          + ' placeholder="請詳細描述你遇到的狀況或想法" rows="4"></textarea>'
        + '</div>'
        + '<div class="report-field">'
          + '<label class="report-label">頁面位置</label>'
          + '<div class="report-page-val" id="r-page"></div>'
        + '</div>'
        + '<div id="r-error" class="report-error" style="display:none"></div>'
        + '<div class="report-actions">'
          + '<button class="report-btn-cancel" id="r-cancel">取消</button>'
          + '<button class="report-btn-submit" id="r-submit">送出回報</button>'
        + '</div>'
      + '</div>'
      + '</div>';
    document.body.appendChild(overlay);

    /* 事件 */
    document.getElementById('r-close').addEventListener('click', closeModal);
    document.getElementById('r-cancel').addEventListener('click', closeModal);
    document.getElementById('r-submit').addEventListener('click', submitReport);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });

    /* 類型選項視覺切換 */
    document.querySelectorAll('input[name="r-type"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        document.querySelectorAll('.report-type-option').forEach(function (lbl) {
          lbl.classList.remove('selected');
        });
        if (radio.checked) radio.parentElement.classList.add('selected');
      });
    });
  }

  /* ── 可拖曳懸浮按鈕（Draggable FAB） ── */
  function makeDraggable(btn, onTap) {
    var dragging = false;
    var hasDragged = false;
    var startPX, startPY, startBX, startBY;

    /* 讀取上次位置，預設在右側 72% 高度 */
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem('report-btn-pos')); } catch (e) {}

    function clampX(v) { return Math.max(6, Math.min(v, window.innerWidth  - btn.offsetWidth  - 6)); }
    function clampY(v) { return Math.max(6, Math.min(v, window.innerHeight - btn.offsetHeight - 6)); }

    function setPos(left, top, animate) {
      if (animate) {
        btn.style.transition = 'left .22s cubic-bezier(.25,.46,.45,.94), top .22s cubic-bezier(.25,.46,.45,.94), box-shadow .15s';
      } else {
        btn.style.transition = 'box-shadow .15s';
      }
      btn.style.left = left + 'px';
      btn.style.top  = top  + 'px';
    }

    /* 初始位置（等 DOM 渲染後取 offsetWidth 才準） */
    setTimeout(function () {
      var bw = btn.offsetWidth  || 44;
      var bh = btn.offsetHeight || 44;
      var initLeft = saved ? saved.left : window.innerWidth  - bw - 12;
      var initTop  = saved ? saved.top  : Math.round(window.innerHeight * 0.72 - bh / 2);
      btn.style.left = clampX(initLeft) + 'px';
      btn.style.top  = clampY(initTop)  + 'px';
    }, 0);

    /* Pointer Events：統一處理滑鼠與觸控 */
    btn.addEventListener('pointerdown', function (e) {
      dragging   = true;
      hasDragged = false;
      startPX = e.clientX;
      startPY = e.clientY;
      startBX = parseInt(btn.style.left) || 0;
      startBY = parseInt(btn.style.top)  || 0;
      btn.setPointerCapture(e.pointerId);
      btn.classList.add('r-dragging');
      btn.style.transition = 'box-shadow .15s';
      e.preventDefault();
    });

    btn.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startPX;
      var dy = e.clientY - startPY;
      if (!hasDragged && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) hasDragged = true;
      if (hasDragged) {
        btn.style.left = clampX(startBX + dx) + 'px';
        btn.style.top  = clampY(startBY + dy) + 'px';
      }
      e.preventDefault();
    });

    btn.addEventListener('pointerup', function (e) {
      if (!dragging) return;
      dragging = false;
      btn.classList.remove('r-dragging');

      if (hasDragged) {
        /* 吸附至最近的左右邊緣 */
        var cx = parseInt(btn.style.left) + btn.offsetWidth / 2;
        var snapLeft = cx < window.innerWidth / 2
          ? 10
          : window.innerWidth - btn.offsetWidth - 10;
        setPos(snapLeft, parseInt(btn.style.top), true);
        try {
          localStorage.setItem('report-btn-pos', JSON.stringify({
            left: snapLeft,
            top:  parseInt(btn.style.top)
          }));
        } catch (ex) {}
      } else {
        onTap();
      }
      e.preventDefault();
    });

    /* 視窗縮放時確保按鈕不跑出邊界 */
    window.addEventListener('resize', function () {
      var l = parseInt(btn.style.left) || 0;
      var t = parseInt(btn.style.top)  || 0;
      setPos(clampX(l), clampY(t), false);
    });
  }

  /* ── 開啟 / 關閉 ── */
  function openModal() {
    var overlay = document.getElementById('report-modal-overlay');
    overlay.style.display = 'flex';
    document.getElementById('r-title').value = '';
    document.getElementById('r-desc').value  = '';
    document.getElementById('r-error').style.display = 'none';
    document.getElementById('r-page').textContent = document.title;
    var first = document.querySelector('input[name="r-type"]');
    if (first) {
      first.checked = true;
      document.querySelectorAll('.report-type-option').forEach(function (lbl) {
        lbl.classList.remove('selected');
      });
      first.parentElement.classList.add('selected');
    }
    setTimeout(function () {
      var t = document.getElementById('r-title');
      if (t) t.focus();
    }, 60);
  }

  function closeModal() {
    var o = document.getElementById('report-modal-overlay');
    if (o) o.style.display = 'none';
  }

  /* ── 送出 ── */
  function submitReport() {
    var title   = document.getElementById('r-title').value.trim();
    var desc    = document.getElementById('r-desc').value.trim();
    var errEl   = document.getElementById('r-error');
    var submitBtn = document.getElementById('r-submit');

    if (!title) {
      errEl.textContent = '請填寫標題';
      errEl.style.display = 'block';
      document.getElementById('r-title').focus();
      return;
    }
    if (!desc) {
      errEl.textContent = '請填寫詳細說明';
      errEl.style.display = 'block';
      document.getElementById('r-desc').focus();
      return;
    }
    errEl.style.display = 'none';

    var typeEl = document.querySelector('input[name="r-type"]:checked');
    var type   = typeEl ? typeEl.value : 'problem';
    var info   = getReporterInfo();

    submitBtn.disabled = true;
    submitBtn.textContent = '送出中…';

    var data = Object.assign({
      type:           type,
      title:          title,
      description:    desc,
      page:           document.title,
      status:         'unread'
    }, info);

    getDb(function (fdb) {
      fdb.collection('reports').add(
        Object.assign(data, { createdAt: firebase.firestore.FieldValue.serverTimestamp() })
      ).then(function () {
        closeModal();
        submitBtn.disabled = false;
        submitBtn.textContent = '送出回報';
        rToast('✅ 回報已送出，感謝您的意見！');
      }).catch(function () {
        errEl.textContent = '送出失敗，請確認網路後再試';
        errEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = '送出回報';
      });
    });
  }

  /* ── Toast（優先重用頁面現有的 showToast） ── */
  function rToast(msg) {
    if (typeof showToast === 'function') { showToast(msg); return; }
    var t = document.createElement('div');
    t.style.cssText = [
      'position:fixed;bottom:24px;left:50%;transform:translateX(-50%)',
      'background:rgba(30,30,30,.92);color:white',
      'padding:10px 20px;border-radius:10px',
      'font-size:.88rem;font-weight:700',
      'z-index:99999;pointer-events:none',
      'font-family:"Noto Sans TC","Nunito",sans-serif'
    ].join(';');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3000);
  }

  /* ── 公開 API ── */
  window.initReportWidget = function (config) {
    rConfig = config || { role: 'guest' };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectHTML);
    } else {
      injectHTML();
    }
  };
})();
