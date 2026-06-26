/* ================================================================
   Tracker FMN — Automação Screen v2
   Alertas e Regras movidos para Tráfego.
   Esta tela mantém: Exceções por ADS (overrides por criativo)
   ================================================================ */
const { useState } = React;
const { LucideIcon, Btn, Badge, TopBar } = window;

const SEV_CFG = {
  danger:  { color:'var(--clr-neg)',  bg:'rgba(248,113,113,.12)', border:'rgba(248,113,113,.25)' },
  warning: { color:'var(--clr-warn)', bg:'rgba(251,191,36,.12)',  border:'rgba(251,191,36,.25)' },
  info:    { color:'var(--clr-info)', bg:'rgba(96,165,250,.12)',  border:'rgba(96,165,250,.25)' },
  default: { color:'var(--text-2)',   bg:'rgba(255,255,255,.07)', border:'rgba(255,255,255,.15)' },
};
const RULE_SEV = { G1:'danger',G2:'danger',G3:'info',G4:'warning',G5:'danger',G6:'warning',G7:'info',E1:'default' };

const initExceptions = [
  { id:1, adsNum:'014', rule:'G6', type:'Isenção',              value:null,   active:true,  obs:'RMKT — audiência pequena, CR naturalmente menor' },
  { id:2, adsNum:'016', rule:'G1', type:'Parâmetro customizado', value:'1.1',  active:true,  obs:'Em fase de teste — limite estendido por 7 dias' },
  { id:3, adsNum:'009', rule:'G4', type:'Parâmetro customizado', value:'5.5',  active:false, obs:'Criativo evergreen — tolerância maior de frequência' },
];

/* ── ExcecaoModal ────────────────────────────────────────────────*/
function ExcecaoModal({ onClose, onSave }) {
  const [form, setForm] = useState({ adsNum:'', rule:'G1', type:'Isenção', value:'', active:true, obs:'' });
  const inputStyle = { width:'100%', padding:'9px 12px', borderRadius:8,
    background:'var(--app-surface-2)', border:'1px solid var(--app-border)',
    color:'var(--text-1)', fontFamily:'Roboto,sans-serif', fontSize:13 };
  const labelStyle = { fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
    letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:5, display:'block' };
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)',
      zIndex:500, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e=>e.stopPropagation()}
        style={{ background:'var(--app-surface)', border:'1px solid var(--app-border-2)',
          borderRadius:16, padding:'24px', width:460,
          display:'flex', flexDirection:'column', gap:14, boxShadow:'0 20px 60px rgba(0,0,0,.5)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:15, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-1)' }}>
            Adicionar Exceção
          </span>
          <button onClick={onClose} style={{ width:28, height:28, borderRadius:'50%',
            background:'rgba(255,255,255,.07)', color:'var(--text-2)', cursor:'pointer', fontSize:16,
            display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
        </div>
        <div>
          <span style={labelStyle}>ADS (número)</span>
          <input value={form.adsNum} onChange={e=>setForm(p=>({...p,adsNum:e.target.value}))}
            placeholder="Ex: 246" style={inputStyle}/>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div>
            <span style={labelStyle}>Regra</span>
            <select value={form.rule} onChange={e=>setForm(p=>({...p,rule:e.target.value}))}
              style={{...inputStyle, appearance:'none', cursor:'pointer', colorScheme:'dark'}}>
              {['G1','G2','G3','G4','G5','G6','G7','E1'].map(r=><option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <span style={labelStyle}>Tipo</span>
            <select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}
              style={{...inputStyle, appearance:'none', cursor:'pointer', colorScheme:'dark'}}>
              {['Isenção','Parâmetro customizado'].map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        {form.type === 'Parâmetro customizado' && (
          <div>
            <span style={labelStyle}>Valor customizado</span>
            <input value={form.value} onChange={e=>setForm(p=>({...p,value:e.target.value}))}
              placeholder="Ex: 1.2 ou 50" style={inputStyle}/>
          </div>
        )}
        <div>
          <span style={labelStyle}>Observação</span>
          <input value={form.obs} onChange={e=>setForm(p=>({...p,obs:e.target.value}))}
            placeholder="Motivo da exceção..." style={inputStyle}/>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <Btn variant="ghost" size="md" style={{ flex:1, justifyContent:'center' }} onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" size="md" style={{ flex:1, justifyContent:'center' }}
            onClick={()=>onSave({...form, id:Date.now()})}>Salvar</Btn>
        </div>
      </div>
    </div>
  );
}

/* ── AutomacaoScreen ─────────────────────────────────────────────*/
function AutomacaoScreen() {
  const [exceptions, setExceptions] = useState(initExceptions);
  const [showModal, setShowModal]   = useState(false);

  const toggleActive = (id) => {
    setExceptions(prev => prev.map(e => e.id===id ? {...e, active:!e.active} : e));
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <TopBar title="Automação"
        actions={
          <Btn variant="primary" size="sm" icon="plus" onClick={()=>setShowModal(true)}>
            Adicionar Exceção
          </Btn>
        }/>

      <div style={{ flex:1, overflowY:'auto', padding:'24px' }}>
        {/* Info banner */}
        <div style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'14px 16px',
          borderRadius:12, background:'rgba(96,165,250,.07)', border:'1px solid rgba(96,165,250,.18)',
          marginBottom:20 }}>
          <LucideIcon icon="info" size={16} color="var(--clr-info)" style={{ marginTop:1, flexShrink:0 }}/>
          <div>
            <div style={{ fontSize:12.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
              color:'var(--text-1)', marginBottom:3 }}>Exceções por ADS</div>
            <div style={{ fontSize:12, fontFamily:'Roboto,sans-serif', lineHeight:1.6, color:'var(--text-2)' }}>
              Overrides que modificam ou isentam regras específicas para criativos individuais.
              Alertas e regras globais estão na aba <strong style={{ color:'var(--fmn-gold)' }}>Tráfego</strong>.
            </div>
          </div>
        </div>

        {/* Tabela de exceções */}
        <div style={{ background:'var(--app-surface)', border:'1px solid var(--app-border)',
          borderRadius:14, overflow:'hidden' }}>
          {exceptions.length === 0 ? (
            <div style={{ padding:'48px', display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center', gap:10 }}>
              <LucideIcon icon="shield-check" size={32} color="var(--text-3)"/>
              <span style={{ fontSize:13, fontFamily:'Roboto,sans-serif', color:'var(--text-3)' }}>
                Nenhuma exceção cadastrada
              </span>
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--app-border)' }}>
                  {['ADS','Regra','Tipo','Valor','Ativo','Observação',''].map((h,i)=>(
                    <th key={i} style={{ padding:'10px 16px', textAlign:'left', fontSize:10,
                      fontFamily:'Roboto,sans-serif', fontWeight:700,
                      letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {exceptions.map((exc, idx) => {
                  const sev = SEV_CFG[RULE_SEV[exc.rule]] || SEV_CFG.default;
                  const isLast = idx === exceptions.length - 1;
                  return (
                    <tr key={exc.id} style={{ borderBottom: isLast ? 'none' : '1px solid var(--app-border)',
                      opacity: exc.active ? 1 : 0.5, transition:'opacity 150ms' }}>
                      <td style={{ padding:'12px 16px', fontSize:13, fontFamily:'Roboto,sans-serif',
                        fontWeight:700, color:'var(--clr-teal)' }}>ADS {exc.adsNum}</td>
                      <td style={{ padding:'12px 16px' }}>
                        <span style={{ padding:'3px 9px', borderRadius:999, fontSize:10.5,
                          fontFamily:'Roboto,sans-serif', fontWeight:900,
                          background:sev.bg, color:sev.color, border:`1px solid ${sev.border}` }}>
                          {exc.rule}
                        </span>
                      </td>
                      <td style={{ padding:'12px 16px' }}>
                        <Badge tone={exc.type==='Isenção'?'info':'warning'}>{exc.type}</Badge>
                      </td>
                      <td style={{ padding:'12px 16px', fontSize:12.5, fontFamily:'Roboto,sans-serif',
                        color:'var(--text-2)' }}>{exc.value||'—'}</td>
                      <td style={{ padding:'12px 16px' }}>
                        <div onClick={()=>toggleActive(exc.id)}
                          style={{ width:38, height:21, borderRadius:999, cursor:'pointer', transition:'all 200ms',
                            background:exc.active?'var(--clr-pos)':'rgba(255,255,255,.15)', position:'relative', display:'inline-block' }}>
                          <div style={{ position:'absolute', top:2.5, left:exc.active?19:3, width:16, height:16,
                            borderRadius:'50%', background:'#fff', transition:'left 200ms' }}/>
                        </div>
                      </td>
                      <td style={{ padding:'12px 16px', fontSize:12, color:'var(--text-3)',
                        fontFamily:'Roboto,sans-serif', maxWidth:240 }}>{exc.obs||'—'}</td>
                      <td style={{ padding:'12px 16px', textAlign:'right' }}>
                        <button onClick={()=>setExceptions(prev=>prev.filter(e=>e.id!==exc.id))}
                          style={{ width:26, height:26, borderRadius:6, background:'rgba(248,113,113,.08)',
                            border:'1px solid rgba(248,113,113,.18)', color:'var(--clr-neg)',
                            display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', marginLeft:'auto' }}>
                          <LucideIcon icon="trash-2" size={12}/>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <ExcecaoModal
          onClose={()=>setShowModal(false)}
          onSave={form=>{ setExceptions(prev=>[...prev,form]); setShowModal(false); }}/>
      )}
    </div>
  );
}

window.AutomacaoScreen = AutomacaoScreen;
