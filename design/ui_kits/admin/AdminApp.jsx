/* global React */
const { useState: useS_Dash } = React;

const CLASSES = [
  { id:'3a', name:'三年一班', code:'AB12', students:28, assigned:14, theme:'#b3d7f5', progress:72 },
  { id:'3b', name:'三年二班', code:'CD34', students:26, assigned:12, theme:'#ffc9a0', progress:58 },
  { id:'4a', name:'四年一班', code:'EF56', students:30, assigned:20, theme:'#a8e6c0', progress:81 },
  { id:'4b', name:'四年二班', code:'GH78', students:27, assigned:18, theme:'#d4b8f0', progress:45 },
];
const STUDENTS = [
  { name:'王小明', nick:'小明',   av:'🐶', pin:'1234', mult:'乘法LV3', ch:'練字LV2', recent:'2 小時前' },
  { name:'陳美麗', nick:'美麗',   av:'🌟', pin:'5678', mult:'乘法LV2', ch:'練字LV3', recent:'今天上午' },
  { name:'李大華', nick:'大華',   av:'🦁', pin:'9012', mult:'乘法LV4', ch:'練字LV2', recent:'昨天' },
  { name:'張小雨', nick:'小雨',   av:'🐱', pin:'3456', mult:'乘法LV1', ch:'練字LV4', recent:'今天上午' },
  { name:'林阿得', nick:'阿得',   av:'🚀', pin:'7890', mult:'乘法LV3', ch:'練字LV1', recent:'3 天前' },
  { name:'吳佳佳', nick:'佳佳',   av:'🦊', pin:'2345', mult:'乘法LV2', ch:'練字LV2', recent:'今天上午' },
];

function AdminShell({ activeTab, setTab, onLogout, children }) {
  const tabs = [
    { id:'classes',   label:'班級管理', icon:'🏫' },
    { id:'assign',    label:'課程指派', icon:'📚' },
    { id:'quiz',      label:'語文練習', icon:'📝' },
    { id:'progress',  label:'學習進度', icon:'📊' },
    { id:'settings',  label:'設定',     icon:'⚙️' },
  ];
  return (
    <div style={{display:'flex',minHeight:'100%',background:'var(--bg)'}}>
      <aside style={{width:240,background:'#fff',borderRight:'1px solid var(--border)',display:'flex',flexDirection:'column',padding:'20px 14px'}}>
        <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:26,padding:'0 6px'}}>
          <img src="../../assets/login-icon.png" style={{height:36}}/>
          <div>
            <div style={{fontWeight:900,color:'var(--blue-dk)',fontSize:'1rem',lineHeight:1}}>上學趣</div>
            <div style={{fontSize:'.7rem',color:'var(--muted)',fontWeight:700,marginTop:2}}>教師後台</div>
          </div>
        </div>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',border:'none',borderRadius:12,background: activeTab===t.id?'var(--blue-lt)':'transparent',color: activeTab===t.id?'var(--blue-dk)':'var(--text)',fontFamily:'inherit',fontWeight:800,fontSize:'.92rem',cursor:'pointer',marginBottom:4,textAlign:'left',width:'100%'}}>
            <span style={{fontSize:'1.1rem'}}>{t.icon}</span>{t.label}
          </button>
        ))}
        <div style={{flex:1}}/>
        <div style={{background:'var(--bg)',borderRadius:12,padding:12,marginBottom:10}}>
          <div style={{fontSize:'.72rem',color:'var(--muted)',fontWeight:700}}>登入身份</div>
          <div style={{fontSize:'.9rem',fontWeight:900,color:'var(--blue-dk)'}}>林老師</div>
          <div style={{fontSize:'.7rem',color:'var(--muted)',fontWeight:700,marginTop:2}}>teacher@school.tw</div>
        </div>
        <button onClick={onLogout} style={{padding:'10px',border:'none',borderRadius:10,background:'#fff0f0',color:'var(--red)',fontFamily:'inherit',fontWeight:800,cursor:'pointer',fontSize:'.85rem'}}>🚪 登出</button>
      </aside>
      <main style={{flex:1,overflow:'auto'}}>{children}</main>
    </div>
  );
}

function ClassesView({ onOpen }) {
  return (
    <div style={{padding:'28px 32px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22}}>
        <div>
          <div className="qd-h1">班級管理</div>
          <div className="qd-caption">管理你的 4 個班級與 111 位學生</div>
        </div>
        <button style={{padding:'11px 18px',border:'none',borderRadius:12,background:'var(--grad-btn)',color:'#fff',fontFamily:'inherit',fontWeight:900,boxShadow:'var(--shadow-btn)',cursor:'pointer'}}>＋ 建立新班級</button>
      </div>
      <div style={{background:'#fffbeb',border:'1.5px solid #fbbf24',borderRadius:12,padding:'10px 14px',fontSize:'.85rem',color:'#92400e',fontWeight:700,marginBottom:18,display:'flex',gap:8}}>📢 下週三校慶，記得調整當日指派</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:14}}>
        {CLASSES.map(c=>(
          <div key={c.id} onClick={()=>onOpen(c)} style={{background:'#fff',borderRadius:18,padding:18,boxShadow:'var(--shadow)',border:`2.5px solid ${c.theme}`,cursor:'pointer',transition:'transform .18s'}}
            onMouseEnter={e=>e.currentTarget.style.transform='translateY(-3px)'}
            onMouseLeave={e=>e.currentTarget.style.transform=''}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
              <div className="qd-h2" style={{fontSize:'1.15rem'}}>{c.name}</div>
              <div style={{fontFamily:'ui-monospace,monospace',fontWeight:900,fontSize:'.95rem',color:'var(--blue-dk)',background:'var(--blue-lt)',padding:'4px 10px',borderRadius:8}}>{c.code}</div>
            </div>
            <div style={{display:'flex',gap:18,marginBottom:12}}>
              <Stat label="學生" val={c.students}/>
              <Stat label="指派" val={c.assigned + ' 字/題'}/>
              <Stat label="平均通過" val={c.progress + '%'}/>
            </div>
            <div style={{height:8,background:'#f0f4f8',borderRadius:10,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${c.progress}%`,background:'var(--green)',borderRadius:10}}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
const Stat = ({label,val}) => (
  <div>
    <div style={{fontSize:'.7rem',color:'var(--muted)',fontWeight:700,marginBottom:2}}>{label}</div>
    <div style={{fontWeight:900,color:'var(--blue-dk)',fontSize:'1.05rem'}}>{val}</div>
  </div>
);

function ClassDetail({ cls, onBack }) {
  return (
    <div style={{padding:'28px 32px'}}>
      <button onClick={onBack} style={{background:'none',border:'none',color:'var(--muted)',fontWeight:800,cursor:'pointer',marginBottom:12,fontFamily:'inherit',fontSize:'.88rem'}}>← 返回班級列表</button>
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:18}}>
        <div>
          <div className="qd-h1">{cls.name}</div>
          <div className="qd-caption">班級代碼 <b style={{color:'var(--blue-dk)'}}>{cls.code}</b> · {cls.students} 位學生</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button style={ghostBtnAd}>📋 匯出名單</button>
          <button style={primBtnAd}>＋ 加入學生</button>
        </div>
      </div>
      <div style={{background:'#fff',borderRadius:16,boxShadow:'var(--shadow)',overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:'60px 1.3fr 100px 1fr 1fr 1fr',padding:'12px 18px',background:'var(--bg)',fontSize:'.78rem',fontWeight:900,color:'var(--muted)',letterSpacing:.5}}>
          <div>頭像</div><div>姓名 / 暱稱</div><div>PIN</div><div>乘法趣</div><div>練字趣</div><div>最近活動</div>
        </div>
        {STUDENTS.map((s,i)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:'60px 1.3fr 100px 1fr 1fr 1fr',padding:'12px 18px',alignItems:'center',borderTop:'1px solid #f0f4f8',fontSize:'.9rem'}}>
            <div style={{fontSize:'1.4rem'}}>{s.av}</div>
            <div><div style={{fontWeight:800,color:'var(--text)'}}>{s.name}</div><div style={{fontSize:'.75rem',color:'var(--muted)',fontWeight:600}}>{s.nick}</div></div>
            <div style={{fontFamily:'ui-monospace,monospace',fontWeight:700,color:'var(--muted)'}}>{s.pin}</div>
            <div><span style={{...pill, background:'#e8f8ee',color:'#389959'}}>{s.mult}</span></div>
            <div><span style={{...pill, background:'var(--blue-lt)',color:'var(--blue-dk)'}}>{s.ch}</span></div>
            <div style={{color:'var(--muted)',fontWeight:700,fontSize:'.82rem'}}>{s.recent}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
const pill = {fontSize:'.72rem',fontWeight:800,padding:'3px 10px',borderRadius:20};
const primBtnAd  = {padding:'10px 16px',border:'none',borderRadius:12,background:'var(--grad-btn)',color:'#fff',fontFamily:'inherit',fontWeight:900,boxShadow:'var(--shadow-btn)',cursor:'pointer',fontSize:'.88rem'};
const ghostBtnAd = {padding:'10px 16px',border:'2px solid var(--border)',borderRadius:12,background:'#fff',color:'var(--blue-dk)',fontFamily:'inherit',fontWeight:800,cursor:'pointer',fontSize:'.88rem'};

function AssignView() {
  const [values, setValues] = useS_Ad({
    '3a': '學習趣',
    '3b': '山水火土木',
    '4a': '',
    '4b': '書讀寫',
  });
  const [saved, setSaved] = useS_Ad('');

  const onSave = id => {
    setSaved(id);
    setTimeout(()=>setSaved(''), 1400);
  };

  return (
    <div style={{padding:'28px 32px'}}>
      <div className="qd-h1" style={{marginBottom:4}}>課程指派</div>
      <div className="qd-caption" style={{marginBottom:22}}>為每個班級輸入今日指派生字，學生在「練字趣」裡練習</div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        {CLASSES.map(c => {
          const v = values[c.id] || '';
          const chars = [...v].filter(x => x.trim());
          return (
            <div key={c.id} style={{background:'#fff',borderRadius:18,padding:18,boxShadow:'var(--shadow)',border:`2.5px solid ${c.theme}`}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                <div className="qd-h3">{c.name}</div>
                <div style={{fontFamily:'ui-monospace,monospace',fontWeight:800,fontSize:'.82rem',color:'var(--muted)',background:'var(--bg)',padding:'3px 10px',borderRadius:8}}>{c.code}</div>
              </div>

              <div style={{fontSize:'.78rem',fontWeight:900,color:'var(--muted)',letterSpacing:.5,marginBottom:6}}>📝 今日指派生字</div>
              <div style={{display:'flex',gap:8,marginBottom:10}}>
                <input
                  value={v}
                  onChange={e=>setValues({...values,[c.id]:e.target.value.slice(0,30)})}
                  placeholder="輸入今日指派生字，例如：山水火土木"
                  maxLength={30}
                  style={{flex:1,minWidth:0,border:'2px solid #d4e8f8',borderRadius:10,padding:'10px 12px',fontFamily:'var(--font-serif-tc)',fontWeight:700,fontSize:'1.05rem',outline:'none',color:'var(--text)'}}/>
                <button onClick={()=>onSave(c.id)} style={{padding:'10px 16px',border:'none',borderRadius:10,background:'var(--grad-btn)',color:'#fff',fontFamily:'inherit',fontWeight:900,fontSize:'.88rem',cursor:'pointer',whiteSpace:'nowrap',boxShadow:'var(--shadow-btn)'}}>儲存</button>
              </div>
              <div style={{fontSize:'.78rem',color: chars.length?'var(--blue-dk)':'var(--muted)',fontWeight:700,minHeight:18}}>
                {saved===c.id ? <span style={{color:'var(--green-dk)'}}>✅ 已儲存指派生字（{chars.length} 字）</span>
                  : chars.length ? <>目前指派 {chars.length} 字：<span style={{fontFamily:'var(--font-serif-tc)',fontWeight:900,fontSize:'.92rem',color:'var(--blue-dk)'}}>{chars.join(' ')}</span></>
                  : '尚未指派'}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{marginTop:22,background:'#fffbeb',border:'1.5px solid #fbbf24',borderRadius:12,padding:'10px 14px',fontSize:'.85rem',color:'#92400e',fontWeight:700,display:'flex',gap:8}}>✨ 乘法趣讓學生自由練習 0–10 所有乘法表，無需手動指派。</div>
    </div>
  );
}

function QuizView() {
  const [sub, setSub] = useS_Ad('bank');
  const BANKS = [
    { grade:'三上', lesson:'第 1 課', title:'九月烙餅', n:15 },
    { grade:'三上', lesson:'第 2 課', title:'林中漫步', n:18 },
    { grade:'三上', lesson:'第 3 課', title:'秋天的窖窟', n:20 },
    { grade:'三下', lesson:'第 1 課', title:'旅行', n:16 },
  ];
  const SESSIONS = [
    { code:'AB12', cls:'三年一班', lesson:'九月烙餅', done:22, total:28, active:true },
    { code:'CD34', cls:'三年二班', lesson:'林中漫步', done:18, total:26, active:true },
    { code:'EF56', cls:'四年一班', lesson:'旅行',      done:30, total:30, active:false },
  ];

  return (
    <div style={{padding:'28px 32px'}}>
      <div className="qd-h1" style={{marginBottom:4}}>語文練習</div>
      <div className="qd-caption" style={{marginBottom:18}}>上傳題庫、建立測驗代碼，學生輸入代碼即可練習</div>

      <div style={{display:'flex',gap:8,marginBottom:16,borderBottom:'1.5px solid var(--border)'}}>
        <TabMini active={sub==='bank'} onClick={()=>setSub('bank')}>📚 題庫管理</TabMini>
        <TabMini active={sub==='sessions'} onClick={()=>setSub('sessions')}>📋 測驗管理</TabMini>
      </div>

      {sub==='bank' ? (
        <>
          <div style={{background:'#fff',borderRadius:16,padding:18,boxShadow:'var(--shadow)',marginBottom:16}}>
            <div style={{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
              <div>
                <div style={{fontSize:'.78rem',fontWeight:900,color:'var(--muted)',letterSpacing:.5,marginBottom:6}}>上傳新題庫</div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <div style={{border:'2px dashed #d4e8f8',borderRadius:10,padding:'8px 14px',color:'var(--muted)',fontWeight:700,fontSize:'.85rem'}}>📄 選擇 .xlsx 檔案</div>
                  <button style={{padding:'10px 16px',border:'none',borderRadius:10,background:'var(--grad-btn)',color:'#fff',fontFamily:'inherit',fontWeight:900,fontSize:'.88rem',cursor:'pointer',boxShadow:'var(--shadow-btn)'}}>⬆️ 上傳至 Firebase</button>
                </div>
              </div>
              <div style={{flex:1}}/>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:'.72rem',color:'var(--muted)',fontWeight:800}}>已上傳</div>
                <div style={{fontSize:'1.6rem',fontWeight:900,color:'var(--blue-dk)',lineHeight:1}}>{BANKS.reduce((s,b)=>s+b.n,0)}</div>
                <div style={{fontSize:'.72rem',color:'var(--muted)',fontWeight:700}}>題目 · 共 {BANKS.length} 課</div>
              </div>
            </div>
          </div>

          <div style={{background:'#fff',borderRadius:16,boxShadow:'var(--shadow)',overflow:'hidden'}}>
            <div style={{display:'grid',gridTemplateColumns:'100px 120px 1fr 100px 110px',padding:'12px 18px',background:'var(--bg)',fontSize:'.78rem',fontWeight:900,color:'var(--muted)',letterSpacing:.5}}>
              <div>年級</div><div>課次</div><div>課名</div><div>題數</div><div></div>
            </div>
            {BANKS.map((b,i)=>(
              <div key={i} style={{display:'grid',gridTemplateColumns:'100px 120px 1fr 100px 110px',padding:'12px 18px',alignItems:'center',borderTop:'1px solid #f0f4f8',fontSize:'.9rem'}}>
                <div style={{fontWeight:800,color:'var(--blue-dk)'}}>{b.grade}</div>
                <div style={{color:'var(--muted)',fontWeight:700}}>{b.lesson}</div>
                <div style={{fontWeight:700}}>{b.title}</div>
                <div style={{fontWeight:900,color:'var(--blue-dk)'}}>{b.n} 題</div>
                <div><button style={smallGhost}>查看</button> <button style={{...smallGhost,color:'var(--red)',borderColor:'#ffb3b3'}}>刪除</button></div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}>
            <button style={{...primBtnAd}}>＋ 建立新測驗</button>
          </div>
          <div style={{background:'#fff',borderRadius:16,boxShadow:'var(--shadow)',overflow:'hidden'}}>
            <div style={{display:'grid',gridTemplateColumns:'120px 1fr 1.2fr 1.2fr 120px 140px',padding:'12px 18px',background:'var(--bg)',fontSize:'.78rem',fontWeight:900,color:'var(--muted)',letterSpacing:.5}}>
              <div>代碼</div><div>班級</div><div>題庫</div><div>完成狀況</div><div>狀態</div><div></div>
            </div>
            {SESSIONS.map((s,i)=>(
              <div key={i} style={{display:'grid',gridTemplateColumns:'120px 1fr 1.2fr 1.2fr 120px 140px',padding:'12px 18px',alignItems:'center',borderTop:'1px solid #f0f4f8',fontSize:'.9rem'}}>
                <div style={{fontFamily:'ui-monospace,monospace',fontWeight:900,fontSize:'1.05rem',color:'var(--blue-dk)',background:'var(--blue-lt)',padding:'4px 10px',borderRadius:8,display:'inline-block',justifySelf:'start'}}>{s.code}</div>
                <div style={{fontWeight:800}}>{s.cls}</div>
                <div style={{color:'var(--muted)',fontWeight:700}}>{s.lesson}</div>
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{flex:1,height:8,background:'#f0f4f8',borderRadius:10,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${Math.round(s.done/s.total*100)}%`,background:'var(--green)'}}/>
                    </div>
                    <div style={{fontWeight:800,fontSize:'.82rem',color:'var(--blue-dk)',minWidth:50,textAlign:'right'}}>{s.done}/{s.total}</div>
                  </div>
                </div>
                <div><span style={{...pill, background: s.active?'#e8f8ee':'#f1f5f9', color: s.active?'#389959':'#7a99b5'}}>{s.active?'進行中':'已關閉'}</span></div>
                <div><button style={smallGhost}>{s.active?'關閉':'查看結果'}</button></div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
const TabMini = ({active, onClick, children}) => (
  <button onClick={onClick} style={{padding:'10px 14px',border:'none',background:'none',color: active?'var(--blue-dk)':'var(--muted)',fontFamily:'inherit',fontWeight:900,fontSize:'.92rem',cursor:'pointer',borderBottom: active?'3px solid var(--blue)':'3px solid transparent',marginBottom:-1.5}}>{children}</button>
);
const smallGhost = {padding:'5px 10px',border:'1.5px solid var(--border)',borderRadius:8,background:'#fff',color:'var(--blue-dk)',fontFamily:'inherit',fontWeight:800,fontSize:'.78rem',cursor:'pointer',marginRight:4};

function ProgressView() {
  return (
    <div style={{padding:'28px 32px'}}>
      <div className="qd-h1" style={{marginBottom:22}}>學習進度 · 全校概覽</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:22}}>
        <KPI label="活躍學生" val="98" sub="本週"/>
        <KPI label="總練習次數" val="1,247" sub="本週 ↑ 12%" color="var(--green)"/>
        <KPI label="平均通過率" val="76%" sub="較上週 +4" color="var(--blue-dk)"/>
        <KPI label="需要關注" val="7" sub="連續 3 天未登入" color="var(--orange)"/>
      </div>
      <div style={{background:'#fff',borderRadius:18,padding:20,boxShadow:'var(--shadow)'}}>
        <div className="qd-h3" style={{marginBottom:14}}>各班本週進度</div>
        {CLASSES.map(c=>(
          <div key={c.id} style={{display:'flex',alignItems:'center',gap:14,padding:'10px 0',borderBottom:'1px solid #f0f4f8'}}>
            <div style={{width:120,fontWeight:800,color:'var(--blue-dk)'}}>{c.name}</div>
            <div style={{flex:1,height:10,background:'#f0f4f8',borderRadius:10,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${c.progress}%`,background: c.progress>70?'var(--green)':c.progress>50?'var(--yellow)':'var(--orange)',borderRadius:10}}/>
            </div>
            <div style={{width:60,textAlign:'right',fontWeight:900,color:'var(--blue-dk)'}}>{c.progress}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}
const KPI = ({label,val,sub,color}) => (
  <div style={{background:'#fff',borderRadius:16,padding:16,boxShadow:'var(--shadow)'}}>
    <div style={{fontSize:'.78rem',color:'var(--muted)',fontWeight:800,marginBottom:6}}>{label}</div>
    <div style={{fontSize:'1.9rem',fontWeight:900,color:color||'var(--blue-dk)',lineHeight:1,marginBottom:4}}>{val}</div>
    <div style={{fontSize:'.75rem',color:'var(--muted)',fontWeight:700}}>{sub}</div>
  </div>
);

function AdminApp() {
  const [logged, setLogged] = useS_Ad(true);
  const [tab, setTab] = useS_Ad('classes');
  const [openedClass, setOpenedClass] = useS_Ad(null);

  if (!logged) return <AdminLogin onLogin={()=>setLogged(true)}/>;

  let body;
  if (tab==='classes') body = openedClass ? <ClassDetail cls={openedClass} onBack={()=>setOpenedClass(null)}/> : <ClassesView onOpen={c=>setOpenedClass(c)}/>;
  else if (tab==='assign')   body = <AssignView/>;
  else if (tab==='quiz')     body = <QuizView/>;
  else if (tab==='progress') body = <ProgressView/>;
  else body = <div style={{padding:32}}><div className="qd-h1">設定</div><div className="qd-caption" style={{marginTop:6}}>（帳號、主題、通知 — 尚未建立）</div></div>;

  return <AdminShell activeTab={tab} setTab={t=>{setTab(t); setOpenedClass(null);}} onLogout={()=>setLogged(false)}>{body}</AdminShell>;
}

window.AdminApp = AdminApp;
