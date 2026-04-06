/**
 * index.js — 學生登入 Hub 主邏輯
 * 依賴：shared.js（db、initFirebase、applyTheme、showToast、THEMES、soundEnabled）
 */
'use strict';

/* 科目清單：新增科目只改這裡 */
var SUBJECTS = [
  {
    id:'chinese', file:'chinese/index.html',
    icon:'國', name:'國字練習', desc:'筆順練習・默寫測驗',
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
var currentStudent=null, loginPin='', regPin='', currentPanel='login', selectedAvatar='🐣';
var AVATARS=['🐣','🐱','🐶','🐻','🐼','🦊','🐸','🐧','🦁','🐯','🐨','🐮','🐷','🐙','🦋','🌟','🌈','🎈','🚀','🎯'];
var ADMIN_PASSWORD='381418';
var PANELS=['login','hub','subject','profile'];

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
function toggleTeacherEntry(){document.getElementById('teacher-pin-wrap').classList.toggle('hidden');}
function doTeacherLogin(){
  if(document.getElementById('teacher-pin-input').value===ADMIN_PASSWORD){
    sessionStorage.setItem('adminAuth',ADMIN_PASSWORD);window.location.href='admin.html';
  }else{showToast('密碼不正確');}
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
  showPanel('profile');
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
  updateBadge();
  db.collection('students').doc(currentStudent.id)
    .set({nickname:nickname,avatar:selectedAvatar},{merge:true})
    .then(function(){showToast('✅ 已儲存！');renderHub();showPanel('hub');setTopbarMode('hub');})
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

/* 啟動 */
window.addEventListener('load',function(){
  initFirebase(); applyTheme(currentTheme);
  try{
    var saved=sessionStorage.getItem('hub_student');
    if(saved){
      var student=JSON.parse(saved);
      currentStudent=student; selectedAvatar=student.avatar||'🐣';
      updateBadge(); renderHub(); showTopbar(); setTopbarMode('hub'); showPanel('hub');
      (function waitDb(){if(!db){setTimeout(waitDb,200);return;}loadActivity();})();
    }
  }catch(e){}
});
