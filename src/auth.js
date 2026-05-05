/**
 * auth.js — 學生 / 教師認證流程
 * 負責：登入、註冊、教師登入 / 註冊、Google 登入、登出、系統設定檢查
 * 依賴：shared.js（db、auth、initFirebase、applyTheme、showToast）
 */
'use strict';

var currentStudent = null;
var loginPin = '';
var regPin   = '';

// ── 學校制登入狀態 ──
var _selectedSchoolId   = '';
var _selectedSchoolName = '';
var _selectedClassId    = '';
var _selectedClassName  = '';
var _selectedSeatNumber = 0;
var _schoolPin = '';

function _esc(s) {
  return String(s).replace(/'/g, "\\'").replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── 登入步驟導航 ──
function _showStep(id) {
  document.querySelectorAll('.login-step').forEach(function(el) {
    el.classList.remove('active');
  });
  var el = document.getElementById(id);
  if (el) el.classList.add('active');
}
function goBack(stepId) { _showStep(stepId); }

// ── 學校制：Step 0 → 1a ──
function goSchoolLogin() {
  _showStep('step-school');
  _loadSchools();
}
function goRegularLogin() {
  _showStep('step-regular');
  loginPin = ''; updatePinDisplay('pd', loginPin);
  var nameEl = document.getElementById('login-name');
  if (nameEl) { nameEl.value = ''; updateLoginBtn(); }
}
function goGuest() {
  sessionStorage.setItem('hub_student', JSON.stringify({
    id: 'guest', name: '訪客', nickname: '訪客', avatar: '👤',
    isGuest: true, classIds: []
  }));
  sessionStorage.setItem('hub_welcome', '👋 訪客模式：學習進度不會保存。');
  window.location.href = 'hub.html';
}

// ── Step 1a：載入學校列表 ──
function _loadSchools() {
  var box = document.getElementById('school-list-box');
  if (!box) return;
  if (!db) { setTimeout(_loadSchools, 300); return; }
  box.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  db.collection('schools').where('active', '==', true).get()
    .then(function(snap) {
      if (snap.empty) {
        box.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-weight:700">目前尚無學校。<br><small>請聯繫老師或管理員設定。</small></div>';
        return;
      }
      var schools = [];
      snap.forEach(function(doc) { schools.push({ id: doc.id, name: doc.data().name || '' }); });
      schools.sort(function(a, b) { return a.name.localeCompare(b.name, 'zh-TW'); });
      var html = '';
      schools.forEach(function(s) {
        html += '<button class="login-list-item" onclick="_selectSchool(\'' +
          _esc(s.id) + '\',\'' + _esc(s.name) + '\')">' + _esc(s.name) + '</button>';
      });
      box.innerHTML = html;
    })
    .catch(function() {
      box.innerHTML = '<div style="padding:16px;color:var(--red);font-weight:700">載入失敗，請重試。</div>';
    });
}

// ── Step 1b：選擇學校 → 載入班級 ──
function _selectSchool(schoolId, schoolName) {
  _selectedSchoolId   = schoolId;
  _selectedSchoolName = schoolName;
  document.getElementById('step-class-school').textContent = schoolName;
  _showStep('step-class');
  _loadClasses(schoolId);
}
function _loadClasses(schoolId) {
  var box = document.getElementById('class-list-box');
  if (!box) return;
  box.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  db.collection('classes')
    .where('schoolId', '==', schoolId)
    .where('active', '==', true)
    .get()
    .then(function(snap) {
      if (snap.empty) {
        box.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-weight:700">此學校尚無班級。<br><small>請聯繫老師建立班級。</small></div>';
        return;
      }
      var classes = [];
      snap.forEach(function(doc) {
        var d = doc.data();
        d._id = doc.id;
        classes.push(d);
      });
      classes.sort(function(a, b) {
        if (a.grade !== b.grade) return (a.grade || 0) - (b.grade || 0);
        return (a.classNumber || 0) - (b.classNumber || 0);
      });
      var html = '';
      classes.forEach(function(cls) {
        html += '<button class="login-list-item" onclick="_selectClass(\'' +
          _esc(cls._id) + '\',\'' + _esc(cls.name) + '\')">' +
          _esc(cls.name) + '</button>';
      });
      box.innerHTML = html;
    })
    .catch(function() {
      box.innerHTML = '<div style="padding:16px;color:var(--red);font-weight:700">載入失敗，請重試。</div>';
    });
}

// ── Step 1c：選擇班級 → 載入座號 ──
function _selectClass(classId, className) {
  _selectedClassId   = classId;
  _selectedClassName = className;
  document.getElementById('step-seat-class').textContent = _selectedSchoolName + ' ' + className;
  _showStep('step-seat');
  _loadSeats(classId);
}
function _loadSeats(classId) {
  var wrap = document.getElementById('seat-grid-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

  db.collection('students').where('classId', '==', classId).get()
    .then(function(snap) {
      var seats = [];
      snap.forEach(function(doc) {
        var n = doc.data().seatNumber;
        if (n) seats.push(n);
      });
      seats.sort(function(a, b) { return a - b; });
      if (!seats.length) {
        wrap.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-weight:700">此班級尚無座號帳號。<br><small>請聯繫老師設定帳號。</small></div>';
        return;
      }
      wrap.innerHTML = seats.map(function(n) {
        return '<button class="seat-btn" onclick="_selectSeat(' + n + ')">' + n + '</button>';
      }).join('');
    })
    .catch(function() {
      wrap.innerHTML = '<div style="padding:16px;color:var(--red);font-weight:700">載入失敗，請重試。</div>';
    });
}

// ── Step 1d：選擇座號 → PIN 輸入 ──
function _selectSeat(seatNumber) {
  _selectedSeatNumber = seatNumber;
  _schoolPin = '';
  updatePinDisplay('spd', _schoolPin);
  document.getElementById('btn-school-login-ok').disabled = true;
  document.getElementById('school-login-error').classList.remove('show');
  document.getElementById('step-pin-seat').textContent = seatNumber + ' 號';
  document.getElementById('step-pin-class').textContent = _selectedSchoolName + ' ' + _selectedClassName;
  _showStep('step-pin');
}
function schoolPinInput(d) {
  if (_schoolPin.length >= 4) return;
  _schoolPin += d; updatePinDisplay('spd', _schoolPin);
  document.getElementById('btn-school-login-ok').disabled = _schoolPin.length < 4;
}
function schoolPinDelete() {
  _schoolPin = _schoolPin.slice(0, -1); updatePinDisplay('spd', _schoolPin);
  document.getElementById('btn-school-login-ok').disabled = true;
}

// ── Step 1d：學校制登入驗證 ──
function doSchoolLogin() {
  if (_schoolPin.length !== 4 || !_selectedClassId || !_selectedSeatNumber) return;
  var btn = document.getElementById('btn-school-login-ok');
  btn.disabled = true;
  document.getElementById('school-login-error').classList.remove('show');
  if (!db) { setTimeout(doSchoolLogin, 300); return; }

  db.collection('students')
    .where('classId', '==', _selectedClassId)
    .where('seatNumber', '==', _selectedSeatNumber)
    .limit(1)
    .get()
    .then(function(snap) {
      if (snap.empty) {
        document.getElementById('school-login-error').classList.add('show');
        btn.disabled = false;
        _schoolPin = ''; updatePinDisplay('spd', _schoolPin);
        return;
      }
      var doc = snap.docs[0];
      var d   = doc.data();
      if (d.pin !== _schoolPin) {
        document.getElementById('school-login-error').classList.add('show');
        btn.disabled = false;
        _schoolPin = ''; updatePinDisplay('spd', _schoolPin);
        return;
      }
      onLoginSuccess({
        id:       doc.id,
        name:     d.name || (_selectedSeatNumber + '號'),
        nickname: d.nickname || '',
        avatar:   d.avatar   || '🐣',
        pin:      _schoolPin,
        seatNumber:  d.seatNumber,
        classId:     _selectedClassId,
        classIds:    d.classIds || [_selectedClassId]
      });
    })
    .catch(function() {
      showToast('連線失敗，請重試');
      btn.disabled = false;
    });
}

// ── 畫面切換（index.html: role↔teacher-login；hub.html: hub↔subject） ──

var PANELS = ['role', 'teacher-login', 'hub', 'subject'];
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
function onLoginSuccess(student, isNew) {
  currentStudent = student;
  sessionStorage.setItem('hub_student', JSON.stringify(student));
  sessionStorage.setItem('hub_welcome',
    (isNew ? '🎉 帳號建立成功！歡迎，' : '👋 歡迎，') +
    (student.nickname || student.name) + '！');
  db.collection('students').doc(student.id)
    .update({ lastSeen: firebase.firestore.FieldValue.serverTimestamp() })
    .catch(function() {});
  window.location.href = 'hub.html';
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
        onLoginSuccess({ id: id, name: name, pin: regPin, nickname: '', avatar: '🐣' }, true);
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
  sessionStorage.removeItem('hub_welcome');
  var frame = document.getElementById('subject-frame');
  if (frame) frame.src = 'about:blank';
  hideLogoutConfirm();
  showToast('已登出，掰掰！👋');
  setTimeout(function() { window.location.href = 'login.html'; }, 500);
}

// ── 系統設定（維護模式 / 公告） ──

function checkSiteSettings() {
  if (!db) { setTimeout(checkSiteSettings, 400); return; }
  db.collection('siteSettings').doc('main').get()
    .then(function(doc) {
      if (!doc.exists) return;
      var data = doc.data();
      if (data.maintenanceMode) {
        var overlay = document.getElementById('maintenance-overlay');
        if (overlay) overlay.style.display = 'flex';
      }
      if (data.announcement && data.announcement.trim()) {
        var banner = document.getElementById('announcement-banner');
        var text   = document.getElementById('announcement-text');
        if (banner && text) {
          text.textContent = data.announcement.trim();
          banner.style.display = 'flex';
        }
      }
    })
    .catch(function() {});
}

// ── 啟動 ──

window.addEventListener('load', function() {
  initFirebase();
  applyTheme(currentTheme);
  checkSiteSettings();
});
