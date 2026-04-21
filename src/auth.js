/**
 * auth.js — 學生 / 教師認證流程
 * 負責：登入、註冊、教師登入 / 註冊、Google 登入、登出
 * 依賴：shared.js（db、auth、initFirebase、applyTheme、showToast）
 *        hub.js（renderHub、showPanel、loadActivity、PANELS）
 */
'use strict';

var currentStudent = null;
var loginPin = '';
var regPin   = '';

// ── 畫面切換 ──

var PANELS = ['role','teacher-login','login','hub','subject','profile'];
var currentPanel = 'role';

function showPanel(name) {
  if (currentPanel === name) return;
  var fromEl = document.getElementById('panel-' + currentPanel);
  var toEl   = document.getElementById('panel-' + name);
  if (!fromEl || !toEl) return;
  var fwd = PANELS.indexOf(name) >= PANELS.indexOf(currentPanel);
  toEl.style.transition = 'none';
  toEl.style.transform  = fwd ? 'translateX(100%)' : 'translateX(-100%)';
  toEl.style.opacity    = '0';
  toEl.className = 'panel';
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      var t = '.35s cubic-bezier(.77,0,.175,1)';
      fromEl.style.transition = 'transform ' + t + ',opacity ' + t;
      fromEl.style.transform  = fwd ? 'translateX(-100%)' : 'translateX(100%)';
      fromEl.style.opacity    = '0';
      fromEl.style.pointerEvents = 'none';
      toEl.style.transition   = 'transform ' + t + ',opacity ' + t;
      toEl.style.transform    = 'translateX(0)';
      toEl.style.opacity      = '1';
      toEl.style.pointerEvents = 'all';
      currentPanel = name;
      setTimeout(function() {
        fromEl.style.cssText = ''; toEl.style.cssText = '';
        fromEl.className = 'panel left'; toEl.className = 'panel active';
      }, 370);
    });
  });
}

// ── PIN 共用工具 ──

function updatePinDisplay(prefix, pin) {
  for (var i = 0; i < 4; i++)
    document.getElementById(prefix + i).classList.toggle('filled', i < pin.length);
}

// ── 學生登入 ──

function updateLoginBtn() {
  document.getElementById('btn-login-ok').disabled =
    !(document.getElementById('login-name').value.trim() && loginPin.length === 4);
}
function pinInput(d) {
  if (loginPin.length >= 4) return;
  loginPin += d; updatePinDisplay('pd', loginPin); updateLoginBtn();
}
function pinDelete() {
  loginPin = loginPin.slice(0, -1); updatePinDisplay('pd', loginPin); updateLoginBtn();
}
function doLogin() {
  var name = document.getElementById('login-name').value.trim();
  if (!name || loginPin.length !== 4) return;
  document.getElementById('btn-login-ok').disabled = true;
  document.getElementById('login-error').classList.remove('show');
  if (!db) { setTimeout(doLogin, 300); return; }
  db.collection('students').doc(name + '_' + loginPin).get().then(function(doc) {
    if (!doc.exists) {
      document.getElementById('login-error').classList.add('show');
      document.getElementById('btn-login-ok').disabled = false;
      loginPin = ''; updatePinDisplay('pd', ''); return;
    }
    var d = doc.data();
    // 舊資料只有 classId 字串，自動遷移為 classIds 陣列寫回 Firestore
    if (d.classId && !d.classIds) {
      db.collection('students').doc(name + '_' + loginPin)
        .update({ classIds: [d.classId] })
        .catch(function() {});
    }
    onLoginSuccess({ id: name + '_' + loginPin, name: name, pin: loginPin,
                     nickname: d.nickname || '', avatar: d.avatar || '🐣',
                     classIds: d.classIds || (d.classId ? [d.classId] : []) });
  }).catch(function() {
    showToast('連線失敗，請重試');
    document.getElementById('btn-login-ok').disabled = false;
  });
}
function onLoginSuccess(student) {
  currentStudent = student;
  sessionStorage.setItem('hub_student', JSON.stringify(student));
  db.collection('students').doc(student.id)
    .update({ lastSeen: firebase.firestore.FieldValue.serverTimestamp() })
    .catch(function() {});
  renderHub(); showPanel('hub'); loadActivity();
  showToast('👋 歡迎，' + (student.nickname || student.name) + '！');
}

// ── 學生註冊 ──

function showRegister() {
  document.getElementById('login-form').style.display    = 'none';
  document.getElementById('register-form').style.display = '';
}
function showLogin() {
  document.getElementById('register-form').style.display = 'none';
  document.getElementById('login-form').style.display    = '';
}
function updateRegBtn() {
  document.getElementById('btn-reg-ok').disabled =
    !(document.getElementById('reg-name').value.trim() && regPin.length === 4);
}
function regPinInput(d) { if (regPin.length >= 4) return; regPin += d; updatePinDisplay('rpd', regPin); updateRegBtn(); }
function regPinDelete()  { regPin = regPin.slice(0, -1); updatePinDisplay('rpd', regPin); updateRegBtn(); }
function doRegister() {
  var name = document.getElementById('reg-name').value.trim();
  if (!name || regPin.length !== 4) return;
  document.getElementById('btn-reg-ok').disabled = true;
  var id = name + '_' + regPin;
  db.collection('students').doc(id).get().then(function(doc) {
    if (doc.exists) {
      var err = document.getElementById('reg-error');
      err.textContent = '這個名字和 PIN 已被使用'; err.classList.add('show');
      document.getElementById('btn-reg-ok').disabled = false; return;
    }
    return db.collection('students').doc(id)
      .set({ name: name, pin: regPin, nickname: '', avatar: '🐣', createdAt: new Date() })
      .then(function() {
        onLoginSuccess({ id: id, name: name, pin: regPin, nickname: '', avatar: '🐣' });
        showToast('🎉 帳號建立成功！');
      });
  }).catch(function() {
    showToast('建立失敗，請重試');
    document.getElementById('btn-reg-ok').disabled = false;
  });
}

// ── 教師登入 ──

function showTeacherRegister() {
  document.getElementById('teacher-login-form').style.display    = 'none';
  document.getElementById('teacher-register-form').style.display = '';
  document.getElementById('teacher-login-error').classList.remove('show');
}
function showTeacherLogin() {
  document.getElementById('teacher-register-form').style.display = 'none';
  document.getElementById('teacher-login-form').style.display    = '';
  document.getElementById('teacher-reg-error').classList.remove('show');
}
function doTeacherLogin() {
  var email    = (document.getElementById('teacher-email-input').value || '').trim();
  var password = document.getElementById('teacher-password-input').value || '';
  var errEl    = document.getElementById('teacher-login-error');
  var btnEl    = document.getElementById('btn-teacher-go');
  errEl.classList.remove('show');
  if (!email || !password) return;
  if (!auth) { showToast('系統初始化中，請稍後再試'); return; }
  btnEl.disabled = true; btnEl.textContent = '登入中…';
  auth.signInWithEmailAndPassword(email, password)
    .then(function() { window.location.href = 'admin/'; })
    .catch(function() {
      errEl.textContent = '帳號或密碼不正確'; errEl.classList.add('show');
      btnEl.disabled = false; btnEl.textContent = '登入後台';
    });
}
function doTeacherRegister() {
  var email    = (document.getElementById('teacher-reg-email').value || '').trim();
  var password = document.getElementById('teacher-reg-password').value || '';
  var confirm  = document.getElementById('teacher-reg-confirm').value || '';
  var errEl    = document.getElementById('teacher-reg-error');
  var btnEl    = document.getElementById('btn-teacher-reg');
  errEl.classList.remove('show');
  if (!email || !password)  { errEl.textContent = '請填寫 Email 和密碼'; errEl.classList.add('show'); return; }
  if (password.length < 6)  { errEl.textContent = '密碼至少需要 6 個字元'; errEl.classList.add('show'); return; }
  if (password !== confirm)  { errEl.textContent = '兩次密碼不一致'; errEl.classList.add('show'); return; }
  if (!auth) { showToast('系統初始化中，請稍後再試'); return; }
  btnEl.disabled = true; btnEl.textContent = '建立中…';
  auth.createUserWithEmailAndPassword(email, password)
    .then(function(cred) {
      if (db) {
        return db.collection('teachers').doc(cred.user.uid).set({
          email: email, createdAt: new Date().toISOString()
        });
      }
    })
    .then(function() { window.location.href = 'admin/'; })
    .catch(function(e) {
      var msg = {
        'auth/email-already-in-use': '此 Email 已被註冊，請直接登入',
        'auth/invalid-email':        'Email 格式不正確',
        'auth/weak-password':        '密碼強度不足'
      }[e.code] || ('註冊失敗：' + e.code);
      errEl.textContent = msg; errEl.classList.add('show');
      btnEl.disabled = false; btnEl.textContent = '建立帳號';
    });
}
function doGoogleLogin() {
  if (!auth) { showToast('系統初始化中，請稍後再試'); return; }
  var provider = new firebase.auth.GoogleAuthProvider();
  var errEl    = document.getElementById('teacher-login-error');
  errEl.classList.remove('show');
  auth.signInWithPopup(provider)
    .then(function() { window.location.href = 'admin/'; })
    .catch(function(e) {
      var msg = {
        'auth/popup-closed-by-user':  '視窗已關閉，請再試一次',
        'auth/popup-blocked':         '彈出視窗被封鎖，請允許彈出視窗後再試',
        'auth/unauthorized-domain':   '此網域未授權，請至 Firebase Console → Authentication → Settings → 授權網域 加入目前網址',
        'auth/operation-not-allowed': 'Google 登入尚未在 Firebase Console 啟用'
      }[e.code] || ('登入失敗：' + e.code);
      errEl.textContent = msg; errEl.classList.add('show');
    });
}

// ── 登出 ──

function showLogoutConfirm() { document.getElementById('logout-overlay').classList.add('show'); }
function hideLogoutConfirm() { document.getElementById('logout-overlay').classList.remove('show'); }
function doLogout() {
  currentStudent = null; loginPin = ''; regPin = '';
  sessionStorage.removeItem('hub_student');
  updatePinDisplay('pd', ''); updatePinDisplay('rpd', '');
  document.getElementById('login-name').value = '';
  document.getElementById('btn-login-ok').disabled = true;
  document.getElementById('subject-frame').src = 'about:blank';
  hideLogoutConfirm(); showPanel('login');
  showToast('已登出，掰掰！👋');
}
