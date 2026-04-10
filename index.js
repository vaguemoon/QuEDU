/**
 * index.js — 學生登入 Hub 主邏輯
 * 依賴：shared.js（db、initFirebase、applyTheme、showToast、THEMES、soundEnabled）
 */
'use strict';

/* 科目清單：新增科目只改這裡 */
var SUBJECTS = [
  {
    id:'chinese', file:'chinese/index.html',
    icon:'國', name:'練字趣', desc:'國小國字筆順學習',
    theme:'theme-blue', badge:'可以練習', badgeClass:'green',
    activity:function(sid){
      return db.collection('students').doc(sid).collection('progress').doc('hanzi').get()
        .then(function(doc){
          if(!doc.exists) return null;
          var cs=doc.data().charStatus||{};
          var m=Object.values(cs).filter(function(v){return v==='mastered';}).length;
          return m?{sub:'通過測驗 '+m+' 字',score:m+' 字'}:null;
        });
    }
  }
];

/* 狀態 */
var currentStudent=null, loginPin='', regPin='', currentPanel='role', selectedAvatar='🐣';
var AVATARS=['🐣','🐱','🐶','🐻','🐼','🦊','🐸','🐧','🦁','🐯','🐨','🐮','🐷','🐙','🦋','🌟','🌈','🎈','🚀','🎯'];
var PANELS=['role','teacher-login','login','hub','subject','profile'];

/* 畫面切換 */
function showPanel(name){
  if(currentPanel===name) return;
  var fromEl=document.getElementById('panel-'+currentPanel);
  var toEl=document.getElementById('panel-'+name);
  if(!fromEl||!toEl) return;
  var fwd=PANELS.indexOf(name)>=PANELS.indexOf(currentPanel);
  toEl.style.transition='none';
  toEl.style.transform=fwd?'translateX(100%)':'translateX(-100%)';
  toEl.style.opacity='0';
  toEl.className='panel';
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      var t='.35s cubic-bezier(.77,0,.175,1)';
      fromEl.style.transition='transform '+t+',opacity '+t;
      fromEl.style.transform=fwd?'translateX(-100%)':'translateX(100%)';
      fromEl.style.opacity='0';
      fromEl.style.pointerEvents='none';
      toEl.style.transition='transform '+t+',opacity '+t;
      toEl.style.transform='translateX(0)';
      toEl.style.opacity='1';
      toEl.style.pointerEvents='all';
      currentPanel=name;
      setTimeout(function(){
        fromEl.style.cssText=''; toEl.style.cssText='';
        fromEl.className='panel left'; toEl.className='panel active';
      },370);
    });
  });
}


/* 登入 */
function updateLoginBtn(){
  document.getElementById('btn-login-ok').disabled=
    !(document.getElementById('login-name').value.trim()&&loginPin.length===4);
}
function pinInput(d){
  if(loginPin.length>=4) return;
  loginPin+=d; updatePinDisplay('pd',loginPin); updateLoginBtn();
}
function pinDelete(){
  loginPin=loginPin.slice(0,-1); updatePinDisplay('pd',loginPin); updateLoginBtn();
}
function updatePinDisplay(prefix,pin){
  for(var i=0;i<4;i++) document.getElementById(prefix+i).classList.toggle('filled',i<pin.length);
}
function doLogin(){
  var name=document.getElementById('login-name').value.trim();
  if(!name||loginPin.length!==4) return;
  document.getElementById('btn-login-ok').disabled=true;
  document.getElementById('login-error').classList.remove('show');
  if(!db){setTimeout(doLogin,300);return;}
  db.collection('students').doc(name+'_'+loginPin).get().then(function(doc){
    if(!doc.exists){
      document.getElementById('login-error').classList.add('show');
      document.getElementById('btn-login-ok').disabled=false;
      loginPin=''; updatePinDisplay('pd',''); return;
    }
    var d=doc.data();
    onLoginSuccess({id:name+'_'+loginPin,name:name,pin:loginPin,nickname:d.nickname||'',avatar:d.avatar||'🐣'});
  }).catch(function(){showToast('連線失敗，請重試');document.getElementById('btn-login-ok').disabled=false;});
}
function onLoginSuccess(student){
  currentStudent=student; selectedAvatar=student.avatar||'🐣';
  sessionStorage.setItem('hub_student',JSON.stringify(student));
  renderHub(); showPanel('hub'); loadActivity();
  showToast('👋 歡迎，'+(student.nickname||student.name)+'！');
}

/* 註冊 */
function showRegister(){document.getElementById('login-form').style.display='none';document.getElementById('register-form').style.display='';}
function showLogin(){document.getElementById('register-form').style.display='none';document.getElementById('login-form').style.display='';}
function updateRegBtn(){
  document.getElementById('btn-reg-ok').disabled=
    !(document.getElementById('reg-name').value.trim()&&regPin.length===4);
}
function regPinInput(d){if(regPin.length>=4)return;regPin+=d;updatePinDisplay('rpd',regPin);updateRegBtn();}
function regPinDelete(){regPin=regPin.slice(0,-1);updatePinDisplay('rpd',regPin);updateRegBtn();}
function doRegister(){
  var name=document.getElementById('reg-name').value.trim();
  if(!name||regPin.length!==4) return;
  document.getElementById('btn-reg-ok').disabled=true;
  var id=name+'_'+regPin;
  db.collection('students').doc(id).get().then(function(doc){
    if(doc.exists){
      var err=document.getElementById('reg-error');
      err.textContent='這個名字和 PIN 已被使用';err.classList.add('show');
      document.getElementById('btn-reg-ok').disabled=false;return;
    }
    return db.collection('students').doc(id).set({name:name,pin:regPin,nickname:'',avatar:'🐣',createdAt:new Date()})
      .then(function(){onLoginSuccess({id:id,name:name,pin:regPin,nickname:'',avatar:'🐣'});showToast('🎉 帳號建立成功！');});
  }).catch(function(){showToast('建立失敗，請重試');document.getElementById('btn-reg-ok').disabled=false;});
}

/* 教師 */
function showTeacherRegister() {
  document.getElementById('teacher-login-form').style.display = 'none';
  document.getElementById('teacher-register-form').style.display = '';
  document.getElementById('teacher-login-error').classList.remove('show');
}
function showTeacherLogin() {
  document.getElementById('teacher-register-form').style.display = 'none';
  document.getElementById('teacher-login-form').style.display = '';
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
  btnEl.disabled = true;
  btnEl.textContent = '登入中…';
  auth.signInWithEmailAndPassword(email, password)
    .then(function() { window.location.href = 'admin.html'; })
    .catch(function() {
      errEl.textContent = '帳號或密碼不正確';
      errEl.classList.add('show');
      btnEl.disabled = false;
      btnEl.textContent = '登入後台';
    });
}
function doTeacherRegister() {
  var email    = (document.getElementById('teacher-reg-email').value || '').trim();
  var password = document.getElementById('teacher-reg-password').value || '';
  var confirm  = document.getElementById('teacher-reg-confirm').value || '';
  var errEl    = document.getElementById('teacher-reg-error');
  var btnEl    = document.getElementById('btn-teacher-reg');
  errEl.classList.remove('show');
  if (!email || !password) { errEl.textContent = '請填寫 Email 和密碼'; errEl.classList.add('show'); return; }
  if (password.length < 6)  { errEl.textContent = '密碼至少需要 6 個字元'; errEl.classList.add('show'); return; }
  if (password !== confirm)  { errEl.textContent = '兩次密碼不一致'; errEl.classList.add('show'); return; }
  if (!auth) { showToast('系統初始化中，請稍後再試'); return; }
  btnEl.disabled = true; btnEl.textContent = '建立中…';
  auth.createUserWithEmailAndPassword(email, password)
    .then(function(cred) {
      // 在 Firestore 建立教師記錄
      if (db) {
        return db.collection('teachers').doc(cred.user.uid).set({
          email: email, createdAt: new Date().toISOString()
        });
      }
    })
    .then(function() { window.location.href = 'admin.html'; })
    .catch(function(e) {
      var msg = {
        'auth/email-already-in-use': '此 Email 已被註冊，請直接登入',
        'auth/invalid-email':        'Email 格式不正確',
        'auth/weak-password':        '密碼強度不足'
      }[e.code] || ('註冊失敗：' + e.code);
      errEl.textContent = msg;
      errEl.classList.add('show');
      btnEl.disabled = false; btnEl.textContent = '建立帳號';
    });
}
function doGoogleLogin() {
  if (!auth) { showToast('系統初始化中，請稍後再試'); return; }
  var provider = new firebase.auth.GoogleAuthProvider();
  var errEl = document.getElementById('teacher-login-error');
  errEl.classList.remove('show');
  auth.signInWithPopup(provider)
    .then(function() { window.location.href = 'admin.html'; })
    .catch(function(e) {
      var msg = {
        'auth/popup-closed-by-user':  '視窗已關閉，請再試一次',
        'auth/popup-blocked':         '彈出視窗被封鎖，請允許彈出視窗後再試',
        'auth/unauthorized-domain':   '此網域未授權，請至 Firebase Console → Authentication → Settings → 授權網域 加入目前網址',
        'auth/operation-not-allowed': 'Google 登入尚未在 Firebase Console 啟用'
      }[e.code] || ('登入失敗：' + e.code);
      errEl.textContent = msg;
      errEl.classList.add('show');
    });
}

/* Hub */
function renderHub(){
  if(!currentStudent) return;
  document.getElementById('hub-avatar').textContent=currentStudent.avatar||'🐣';
  document.getElementById('hub-name').textContent=currentStudent.nickname||currentStudent.name;
  var grid=document.getElementById('subjects-grid');
  grid.style.gridTemplateColumns=SUBJECTS.length===1?'1fr':'1fr 1fr';
  grid.innerHTML=SUBJECTS.map(function(s){
    return '<div class="subject-card '+s.theme+'" onclick="openSubject(\''+s.id+'\')">'+
      '<span class="subject-icon">'+s.icon+'</span>'+
      '<div class="subject-name">'+s.name+'</div>'+
      '<div class="subject-desc">'+s.desc+'</div>'+
      '<div class="subject-badge '+s.badgeClass+'">'+s.badge+'</div></div>';
  }).join('');
}

/* 子項目 iframe */
function openSubject(id){
  var s=SUBJECTS.find(function(x){return x.id===id;});
  if(!s||!currentStudent) return;
  sessionStorage.setItem('hub_student',JSON.stringify(currentStudent));
  document.getElementById('subject-frame').src=s.file;
  showPanel('subject');
}
function returnToHub(){
  var frame=document.getElementById('subject-frame');
  if(frame) frame.src='about:blank';
  showPanel('hub'); loadActivity();
}

/* 近期記錄 */
function loadActivity(){
  if(!db||!currentStudent) return;
  var list=document.getElementById('activity-list');
  list.innerHTML='<div class="activity-empty">載入中…</div>';
  Promise.all(SUBJECTS.map(function(s){
    return s.activity(currentStudent.id)
      .then(function(r){return r?{icon:s.icon,name:s.name,sub:r.sub,score:r.score}:null;})
      .catch(function(){return null;});
  })).then(function(results){
    var valid=results.filter(Boolean);
    list.innerHTML=valid.length
      ?valid.map(function(a){return '<div class="activity-row"><div class="activity-icon">'+a.icon+'</div>'+
          '<div class="activity-info"><div class="activity-title">'+a.name+'</div>'+
          '<div class="activity-sub">'+a.sub+'</div></div>'+
          '<div class="activity-score">'+a.score+'</div></div>';}).join('')
      :'<div class="activity-empty">還沒有學習記錄，快去練習吧！🚀</div>';
  });
}

/* 個人設定 */
function showProfile(){
  if(!currentStudent) return;
  document.getElementById('profile-nickname').value=currentStudent.nickname||'';
  document.getElementById('profile-avatar-big').textContent=currentStudent.avatar||'🐣';
  document.getElementById('profile-header-name').textContent=currentStudent.nickname||currentStudent.name;
  selectedAvatar=currentStudent.avatar||'🐣';
  renderAvatarGrid(); renderThemeGrid(); applySoundUI();
  loadStudentClass();
  showPanel('profile');
}

/* ── 班級加入 ── */
function escHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function loadStudentClass(){
  if(!db||!currentStudent) return;
  var wrap=document.getElementById('class-join-wrap');
  if(!wrap) return;
  db.collection('students').doc(currentStudent.id).get().then(function(doc){
    var classId=doc.exists?doc.data().classId:null;
    if(classId){
      db.collection('classes').doc(classId).get().then(function(cdoc){
        if(cdoc.exists){
          var cls=cdoc.data();
          wrap.innerHTML=
            '<div class="class-joined-row">'+
              '<div>'+
                '<div class="class-joined-name">🏫 '+escHtml(cls.name)+'</div>'+
                '<div class="class-joined-code">邀請碼：'+cls.inviteCode+'</div>'+
              '</div>'+
              '<button class="btn-leave-class" onclick="leaveClass()">離開班級</button>'+
            '</div>';
        } else { renderJoinForm(wrap); }
      }).catch(function(){ renderJoinForm(wrap); });
    } else { renderJoinForm(wrap); }
  }).catch(function(){ renderJoinForm(wrap); });
}
function renderJoinForm(wrap){
  wrap.innerHTML=
    '<div class="join-class-row">'+
      '<input id="join-code-input" type="text" placeholder="輸入 6 碼邀請碼" maxlength="6"'+
        ' class="join-code-input"'+
        ' oninput="this.value=this.value.toUpperCase()">'+
      '<button class="btn-join-class" onclick="joinClass()">加入</button>'+
    '</div>'+
    '<div id="join-class-error" class="join-class-error"></div>';
}
function joinClass(){
  var input=document.getElementById('join-code-input');
  var code=(input?input.value.trim().toUpperCase():'');
  var errEl=document.getElementById('join-class-error');
  if(errEl) errEl.textContent='';
  if(code.length!==6){showJoinError('請輸入 6 碼邀請碼');return;}
  if(!db||!currentStudent) return;
  db.collection('classes').where('inviteCode','==',code).where('active','==',true).get()
    .then(function(snap){
      if(snap.empty){showJoinError('找不到這個邀請碼，請確認是否正確或班級已停用');return;}
      var classId=snap.docs[0].id;
      return db.collection('students').doc(currentStudent.id).set({classId:classId},{merge:true})
        .then(function(){
          currentStudent.classId=classId;
          sessionStorage.setItem('hub_student',JSON.stringify(currentStudent));
          showToast('✅ 已加入班級！');
          loadStudentClass();
        });
    })
    .catch(function(e){showJoinError('加入失敗：'+e.message);});
}
function showJoinError(msg){
  var el=document.getElementById('join-class-error');
  if(el){el.textContent=msg;}
}
function leaveClass(){
  if(!confirm('確定要離開目前的班級嗎？')) return;
  if(!db||!currentStudent) return;
  db.collection('students').doc(currentStudent.id).update({classId:firebase.firestore.FieldValue.delete()})
    .then(function(){
      delete currentStudent.classId;
      sessionStorage.setItem('hub_student',JSON.stringify(currentStudent));
      showToast('已離開班級');
      loadStudentClass();
    })
    .catch(function(e){showToast('操作失敗：'+e.message);});
}
function renderAvatarGrid(){
  document.getElementById('avatar-grid').innerHTML=AVATARS.map(function(av){
    return '<button class="avatar-btn'+(av===selectedAvatar?' selected':'')+
      '" onclick="selectAvatar(\''+av+'\')">'+av+'</button>';
  }).join('');
}
function selectAvatar(av){selectedAvatar=av;document.getElementById('profile-avatar-big').textContent=av;renderAvatarGrid();}
function renderThemeGrid(){
  var cur=localStorage.getItem('theme')||'blue';
  document.getElementById('theme-grid').innerHTML=THEMES.map(function(t){
    return '<button class="theme-btn'+(t.id===cur?' selected':'')+
      '" style="background:'+t.bg+';color:'+t.blueDk+'" onclick="selectTheme(\''+t.id+'\')">'+t.name+'</button>';
  }).join('');
}
function selectTheme(id){applyTheme(id);renderThemeGrid();}
function applySoundUI(){
  var on=soundEnabled;
  var btn=document.getElementById('sound-toggle');
  var knob=document.getElementById('sound-knob');
  if(!btn) return;
  btn.style.background=on?'var(--blue)':'#ccc';
  knob.style.left=on?'27px':'3px';
}
function toggleSoundUI(){
  soundEnabled=!soundEnabled;
  localStorage.setItem('soundEnabled',soundEnabled);
  applySoundUI();
}
function saveProfile(){
  if(!currentStudent||!db) return;
  var nickname=document.getElementById('profile-nickname').value.trim();
  currentStudent.nickname=nickname;
  currentStudent.avatar=selectedAvatar;
  sessionStorage.setItem('hub_student',JSON.stringify(currentStudent));
  db.collection('students').doc(currentStudent.id)
    .set({nickname:nickname,avatar:selectedAvatar},{merge:true})
    .then(function(){showToast('✅ 已儲存！');renderHub();showPanel('hub');})
    .catch(function(){showToast('儲存失敗，請重試');});
}

/* 登出 */
function showLogoutConfirm(){document.getElementById('logout-overlay').classList.add('show');}
function hideLogoutConfirm(){document.getElementById('logout-overlay').classList.remove('show');}
function doLogout(){
  currentStudent=null; loginPin=''; regPin='';
  sessionStorage.removeItem('hub_student');
  updatePinDisplay('pd',''); updatePinDisplay('rpd','');
  document.getElementById('login-name').value='';
  document.getElementById('btn-login-ok').disabled=true;
  document.getElementById('subject-frame').src='about:blank';
  document.getElementById('activity-list').innerHTML='<div class="activity-empty">登入後查看學習記錄</div>';
  hideLogoutConfirm(); showPanel('login');
  showToast('已登出，掰掰！👋');
}

/* 接收 iframe 內的訊息 */
window.addEventListener('message',function(e){
  if(!e.data) return;
  if(e.data.type==='hanzi-back-to-hub') returnToHub();
  else if(e.data.type==='hanzi-logout') doLogout();
});

/* 管理者隱藏入口：連點學校名稱 5 次跳轉 */
(function(){
  var taps=0, timer=null;
  document.addEventListener('click', function(e){
    if(!e.target || e.target.id !== 'school-name-tap') { taps=0; return; }
    taps++;
    clearTimeout(timer);
    if(taps>=5){ taps=0; window.location.href='super-admin-login.html'; return; }
    timer = setTimeout(function(){ taps=0; }, 1500);
  });
})();

/* 系統設定（維護模式 / 公告） */
function checkSiteSettings() {
  if (!db) { setTimeout(checkSiteSettings, 400); return; }
  db.collection('siteSettings').doc('main').get()
    .then(function(doc) {
      if (!doc.exists) return;
      var data = doc.data();
      // 維護模式
      if (data.maintenanceMode) {
        var overlay = document.getElementById('maintenance-overlay');
        if (overlay) overlay.style.display = 'flex';
      }
      // 公告橫幅
      if (data.announcement && data.announcement.trim()) {
        var banner = document.getElementById('announcement-banner');
        var text   = document.getElementById('announcement-text');
        if (banner && text) {
          text.textContent = data.announcement.trim();
          banner.style.display = 'flex';
        }
      }
    })
    .catch(function() {}); // 讀取失敗時靜默略過，不影響正常使用
}

/* 啟動 */
window.addEventListener('load',function(){
  initFirebase(); applyTheme(currentTheme);
  checkSiteSettings();
  try{
    var saved=sessionStorage.getItem('hub_student');
    if(saved){
      var student=JSON.parse(saved);
      currentStudent=student; selectedAvatar=student.avatar||'🐣';
      // 自動登入：直接跳到 hub，不經過角色選擇
      currentPanel='login'; // 讓 showPanel 的方向計算正確
      renderHub(); showPanel('hub');
      (function waitDb(){if(!db){setTimeout(waitDb,200);return;}loadActivity();})();
    }
  }catch(e){}
});
