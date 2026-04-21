/* global React */
const { useState: useS_Ad } = React;

function AdminLogin({ onLogin }) {
  const [email, setEmail] = useS_Ad('teacher@school.tw');
  const [pw, setPw] = useS_Ad('••••••••');
  return (
    <div style={{minHeight:'100%',background:'var(--grad-login)',display:'flex',alignItems:'center',justifyContent:'center',padding:40}}>
      <div style={{background:'#fff',borderRadius:24,padding:'36px 32px',width:'100%',maxWidth:400,boxShadow:'var(--shadow-lg)',textAlign:'center'}}>
        <img src="../../assets/login-icon.png" style={{height:70,marginBottom:10}}/>
        <div className="qd-display" style={{marginBottom:4,fontSize:'1.6rem'}}>教師後台</div>
        <div className="qd-caption" style={{marginBottom:24}}>上學趣 · QUEDU admin</div>
        <div style={{textAlign:'left',marginBottom:14}}>
          <div style={{fontSize:'.8rem',fontWeight:800,color:'var(--muted)',marginBottom:6}}>Email</div>
          <input value={email} onChange={e=>setEmail(e.target.value)} style={fld}/>
        </div>
        <div style={{textAlign:'left',marginBottom:18}}>
          <div style={{fontSize:'.8rem',fontWeight:800,color:'var(--muted)',marginBottom:6}}>密碼</div>
          <input type="password" value={pw} onChange={e=>setPw(e.target.value)} style={{...fld,borderColor:'var(--blue)'}}/>
        </div>
        <button onClick={onLogin} style={{width:'100%',padding:14,border:'none',borderRadius:13,background:'var(--grad-btn)',color:'#fff',fontFamily:'inherit',fontWeight:900,fontSize:'1rem',boxShadow:'var(--shadow-btn)',cursor:'pointer'}}>登入後台</button>
      </div>
    </div>
  );
}
const fld = {width:'100%',border:'2.5px solid #d4e8f8',borderRadius:12,padding:'12px 16px',fontSize:'1rem',fontFamily:'inherit',outline:'none',color:'var(--text)'};
window.AdminLogin = AdminLogin;
