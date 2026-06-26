/* ================================================================
   Tracker FMN — Financeiro Screen v2
   Components: DateFilter · FinTableRow · ExpensesTab · TaxesTab · ProductCostsTab · FinancialScreen
   ================================================================ */
const { useState, useEffect } = React;
const { CardKPI, SectionCard, TopBar, LucideIcon, Btn, Badge } = window;

/* ── DateFilter ──────────────────────────────────────────────────*/
function DateFilter({ from, to, onChange }) {
  const inputStyle = {
    padding:'6px 10px', borderRadius:7, fontSize:12, fontFamily:'Roboto,sans-serif',
    background:'var(--app-surface-2)', border:'1px solid var(--app-border)',
    color:'var(--text-1)', colorScheme:'dark', cursor:'pointer',
  };
  const iso = d => d.toISOString().slice(0,10);
  function aplicarPreset(p) {
    const hoje = new Date();
    let f;
    if (p === 'Hoje')      f = new Date(hoje);
    else if (p === '7d')   { f = new Date(hoje); f.setDate(f.getDate() - 6); }
    else if (p === '30d')  { f = new Date(hoje); f.setDate(f.getDate() - 29); }
    else if (p === 'Mês')  f = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    else if (p === 'Máximo') f = new Date('2023-01-01');
    onChange({ from: iso(f), to: iso(hoje) });
  }
  // detecta qual preset bate com o range atual para destacar
  const hoje = new Date();
  const presets = ['Hoje','7d','30d','Mês','Máximo'];
  function presetAtivo(p) {
    const r = { Hoje:0, '7d':6, '30d':29 };
    if (to !== iso(hoje)) return false;
    if (p === 'Mês')    return from === iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
    if (p === 'Máximo') return from === '2023-01-01';
    const f = new Date(hoje); f.setDate(f.getDate() - r[p]);
    return from === iso(f);
  }
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 24px',
      borderBottom:'1px solid var(--app-border)', background:'var(--app-bg)', flexShrink:0, flexWrap:'wrap' }}>
      <LucideIcon icon="calendar" size={14} color="var(--text-3)"/>
      {/* Presets rápidos */}
      <div style={{ display:'flex', background:'rgba(255,255,255,.04)',
        border:'1px solid var(--app-border)', borderRadius:8, padding:3, gap:1 }}>
        {presets.map(p => (
          <button key={p} onClick={() => aplicarPreset(p)}
            style={{ padding:'5px 12px', borderRadius:6, cursor:'pointer', transition:'all 130ms',
              background: presetAtivo(p) ? 'rgba(234,170,65,.15)' : 'transparent',
              border: `1px solid ${presetAtivo(p) ? 'rgba(234,170,65,.2)' : 'transparent'}`,
              color: presetAtivo(p) ? 'var(--fmn-gold)' : 'rgba(255,255,255,.42)',
              fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:11.5 }}>
            {p}
          </button>
        ))}
      </div>
      <span style={{ fontSize:11, color:'var(--text-3)', marginLeft:4 }}>ou</span>
      <input type="date" value={from} onChange={e => onChange({ from:e.target.value, to })} style={inputStyle}/>
      <span style={{ fontSize:11, color:'var(--text-3)' }}>até</span>
      <input type="date" value={to} onChange={e => onChange({ from, to:e.target.value })} style={inputStyle}/>
      <div style={{ flex:1 }}/>
      <span style={{ fontSize:11, color:'var(--text-3)', fontFamily:'Roboto,sans-serif' }}>
        {from} a {to}
      </span>
    </div>
  );
}

/* ── Hooks de dados reais ────────────────────────────────────────*/
function useVendasData(from, to) {
  const [vendas, setVendas] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!window.db) return;
    async function load() {
      setLoading(true);
      const { data } = await window.db
        .from('vendas')
        .select('hotmart_transaction_id,produto_nome,valor_bruto,valor_liquido,status,created_at,utm_source')
        .gte('created_at', from + 'T00:00:00')
        .lte('created_at', to + 'T23:59:59')
        .order('created_at', { ascending: false });
      setVendas(data || []);
      setLoading(false);
    }
    load();
  }, [from, to]);
  return { vendas, loading };
}

function useDespesasData() {
  const [despesas, setDespesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!window.db) return;
    async function load() {
      setLoading(true);
      const { data } = await window.db
        .from('despesas')
        .select('id,descricao,categoria,tipo,recorrencia,valor,data,ativo,observacoes')
        .order('data', { ascending: false });
      setDespesas(data || []);
      setLoading(false);
    }
    load();
  }, [tick]);
  return { despesas, loading, reload: () => setTick(t => t + 1) };
}

/* Configuração dos produtos (custo fixo estimado por produto) */
const productsData = [
  { id: 1, product: 'Modelos de Contrato Visual', ticket: 297, cost: 30, margin: 89.9 },
];

const CATEGORY_TONE = {
  'Tráfego': 'info', 'Plataforma': 'teal', 'Ferramenta': 'gold',
  'Criativo': 'amber', 'Equipe': 'success', 'Consultoria': 'warning',
  'Venda': 'success', 'Reembolso': 'danger', 'Outros': 'default',
};


const fmt    = window.fmtBRL;
const fmtDec = window.fmtBRL;

/* ── Cálculo proporcional de despesa no período selecionado ──────
   - unico    → aparece apenas se a data cai dentro do range
   - mensal   → valor ÷ dias_do_mês × dias_sobrepostos (mês a mês)
   - anual    → valor ÷ dias_do_ano × dias_sobrepostos (ano a ano)
*/
function calcularValorNoPeriodo(despesa, from, to) {
  const dIni = new Date(from + 'T00:00:00');
  const dFim = new Date(to   + 'T00:00:00');

  if (despesa.tipo === 'unico') {
    const dEntry = new Date(despesa.data + 'T00:00:00');
    return (dEntry >= dIni && dEntry <= dFim) ? Number(despesa.valor) : 0;
  }

  const recorrencia = despesa.recorrencia || 'mensal';

  if (recorrencia === 'mensal') {
    let total = 0;
    let cur = new Date(dIni.getFullYear(), dIni.getMonth(), 1);
    while (cur <= dFim) {
      const mesIni = new Date(cur.getFullYear(), cur.getMonth(), 1);
      const mesFim = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
      const sobIni = dIni > mesIni ? dIni : mesIni;
      const sobFim = dFim < mesFim ? dFim : mesFim;
      const dias = Math.max(0, Math.round((sobFim - sobIni) / 86400000) + 1);
      const diasMes = mesFim.getDate();
      total += (Number(despesa.valor) / diasMes) * dias;
      cur.setMonth(cur.getMonth() + 1);
    }
    return total;
  }

  if (recorrencia === 'anual') {
    let total = 0;
    for (let y = dIni.getFullYear(); y <= dFim.getFullYear(); y++) {
      const anoIni = new Date(y, 0, 1);
      const anoFim = new Date(y, 11, 31);
      const sobIni = dIni > anoIni ? dIni : anoIni;
      const sobFim = dFim < anoFim ? dFim : anoFim;
      const dias = Math.max(0, Math.round((sobFim - sobIni) / 86400000) + 1);
      const diasAno = (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 366 : 365;
      total += (Number(despesa.valor) / diasAno) * dias;
    }
    return total;
  }

  return Number(despesa.valor);
}

/* ── AddExpenseModal ─────────────────────────────────────────────*/
function AddExpenseModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ descricao:'', categoria:'ferramenta', tipo:'recorrente', recorrencia:'mensal', valor:'', data: new Date().toISOString().slice(0,10), observacoes:'' });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(p => ({...p,[k]:v}));
  const categorias = ['tráfego','plataforma','ferramenta','criativo','equipe','consultoria','outros'];
  const handleSave = async () => {
    if (!form.descricao || !form.valor) return;
    setSaving(true);
    const { error } = await window.db.from('despesas').insert({
      descricao: form.descricao, categoria: form.categoria, tipo: form.tipo,
      recorrencia: form.tipo === 'recorrente' ? form.recorrencia : 'mensal',
      valor: Number(form.valor), data: form.data, ativo: true, observacoes: form.observacoes || null,
    });
    setSaving(false);
    if (!error) { onSaved(); onClose(); }
  };
  const inp = { padding:'7px 10px', borderRadius:7, fontSize:12.5, fontFamily:'Roboto,sans-serif',
    background:'var(--app-surface-2)', border:'1px solid var(--app-border)', color:'var(--text-1)',
    colorScheme:'dark', width:'100%', boxSizing:'border-box' };
  return (
    <div onClick={onClose} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:500,
      display:'flex',alignItems:'center',justifyContent:'center' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'var(--app-surface)',
        border:'1px solid var(--app-border-2)',borderRadius:16,padding:24,width:400,
        display:'flex',flexDirection:'column',gap:14,boxShadow:'0 20px 60px rgba(0,0,0,.5)' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
          <span style={{ fontSize:15,fontFamily:'Roboto,sans-serif',fontWeight:700,color:'var(--text-1)' }}>Adicionar Gasto</span>
          <button onClick={onClose} style={{ width:28,height:28,borderRadius:'50%',background:'rgba(255,255,255,.07)',
            color:'var(--text-2)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:16 }}>×</button>
        </div>
        <div style={{ display:'flex',flexDirection:'column',gap:5 }}>
          <span style={{ fontSize:11,fontFamily:'Roboto,sans-serif',fontWeight:700,color:'var(--text-3)',
            letterSpacing:'0.06em',textTransform:'uppercase' }}>Descrição</span>
          <input type="text" value={form.descricao} placeholder="Ex: UTMify, Hotmart Pages..."
            onChange={e=>set('descricao',e.target.value)} style={inp}/>
        </div>
        <div style={{ display:'flex',gap:10 }}>
          <div style={{ flex:1,display:'flex',flexDirection:'column',gap:5 }}>
            <span style={{ fontSize:11,fontFamily:'Roboto,sans-serif',fontWeight:700,color:'var(--text-3)',
              letterSpacing:'0.06em',textTransform:'uppercase' }}>Tipo</span>
            <select value={form.tipo} onChange={e=>set('tipo',e.target.value)} style={{...inp,cursor:'pointer'}}>
              <option value="recorrente">Recorrente</option>
              <option value="unico">Único</option>
            </select>
          </div>
          {form.tipo === 'recorrente' && (
            <div style={{ flex:1,display:'flex',flexDirection:'column',gap:5 }}>
              <span style={{ fontSize:11,fontFamily:'Roboto,sans-serif',fontWeight:700,color:'var(--text-3)',
                letterSpacing:'0.06em',textTransform:'uppercase' }}>Recorrência</span>
              <select value={form.recorrencia} onChange={e=>set('recorrencia',e.target.value)} style={{...inp,cursor:'pointer'}}>
                <option value="mensal">Mensal</option>
                <option value="anual">Anual</option>
              </select>
            </div>
          )}
        </div>
        <div style={{ display:'flex',gap:10 }}>
          <div style={{ flex:1,display:'flex',flexDirection:'column',gap:5 }}>
            <span style={{ fontSize:11,fontFamily:'Roboto,sans-serif',fontWeight:700,color:'var(--text-3)',
              letterSpacing:'0.06em',textTransform:'uppercase' }}>
              {form.tipo==='unico' ? 'Valor (R$)' : form.recorrencia==='anual' ? 'Valor anual (R$)' : 'Valor mensal (R$)'}
            </span>
            <input type="number" value={form.valor} placeholder="0.00"
              onChange={e=>set('valor',e.target.value)} style={inp}/>
          </div>
          <div style={{ flex:1,display:'flex',flexDirection:'column',gap:5 }}>
            <span style={{ fontSize:11,fontFamily:'Roboto,sans-serif',fontWeight:700,color:'var(--text-3)',
              letterSpacing:'0.06em',textTransform:'uppercase' }}>
              {form.tipo==='unico' ? 'Data' : 'Início'}
            </span>
            <input type="date" value={form.data}
              onChange={e=>set('data',e.target.value)} style={inp}/>
          </div>
        </div>
        <div style={{ display:'flex',flexDirection:'column',gap:5 }}>
          <span style={{ fontSize:11,fontFamily:'Roboto,sans-serif',fontWeight:700,color:'var(--text-3)',
            letterSpacing:'0.06em',textTransform:'uppercase' }}>Categoria</span>
          <select value={form.categoria} onChange={e=>set('categoria',e.target.value)} style={{...inp,cursor:'pointer'}}>
            {categorias.map(c=><option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
          </select>
        </div>
        <div style={{ display:'flex',gap:8,marginTop:4 }}>
          <button onClick={onClose} style={{ flex:1,padding:'10px',borderRadius:8,
            background:'rgba(255,255,255,.06)',border:'1px solid var(--app-border)',
            color:'var(--text-1)',fontFamily:'Roboto,sans-serif',fontWeight:700,fontSize:12,cursor:'pointer' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} style={{ flex:1,padding:'10px',borderRadius:8,
            background:'var(--fmn-gold)',color:'var(--fmn-black)',fontFamily:'Roboto,sans-serif',
            fontWeight:700,fontSize:12,cursor:'pointer',opacity:saving?0.6:1 }}>
            {saving?'Salvando...':'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── ExpensesTab ─────────────────────────────────────────────────*/
function ExpensesTab({ dateRange }) {
  const [view, setView] = useState('despesas');
  const [showAddModal, setShowAddModal] = useState(false);
  const { despesas: rawDespesas, loading: loadingDesp, reload: reloadDesp } = useDespesasData();
  const { vendas, loading: loadingVen } = useVendasData(dateRange.from, dateRange.to);

  const expenses = rawDespesas.map(d => {
    const valorPeriodo = calcularValorNoPeriodo(d, dateRange.from, dateRange.to);
    const recorrencia = d.recorrencia || 'mensal';
    const labelRef = d.tipo === 'unico' ? 'único'
      : recorrencia === 'anual' ? `/ano: ${fmtDec(Number(d.valor))}`
      : `/mês: ${fmtDec(Number(d.valor))}`;
    return {
      id: d.id, date: d.data,
      type: d.tipo === 'recorrente' ? (recorrencia === 'anual' ? 'Anual' : 'Mensal') : 'Único',
      category: d.categoria.charAt(0).toUpperCase() + d.categoria.slice(1),
      desc: d.descricao, value: valorPeriodo, valorRef: labelRef,
      isRecorrente: d.tipo === 'recorrente',
    };
  });

  const revenues = vendas.filter(v => v.status === 'aprovada').map(v => ({
    id: v.hotmart_transaction_id, date: v.created_at?.slice(0,10),
    type: 'Receita', category: 'Venda', desc: v.produto_nome, value: Number(v.valor_bruto),
  })).concat(vendas.filter(v => v.status === 'reembolsada').map(v => ({
    id: v.hotmart_transaction_id + '_r', date: v.created_at?.slice(0,10),
    type: 'Receita', category: 'Reembolso', desc: v.produto_nome, value: -Number(v.valor_bruto),
  })));

  const totalExp = expenses.reduce((a,r)=>a+r.value,0);
  const totalRev = revenues.filter(r=>r.value>0).reduce((a,r)=>a+r.value,0);
  const totalRef = Math.abs(revenues.filter(r=>r.value<0).reduce((a,r)=>a+r.value,0));

  const displayRows = view==='despesas' ? expenses
    : view==='receitas' ? revenues
    : [...revenues,...expenses.map(e=>({...e,value:-e.value}))]
        .sort((a,b)=>new Date(b.date||'') - new Date(a.date||''));

  const netBalance = totalRev - totalRef - totalExp;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* KPI Row */}
      <div style={{ display:'flex', gap:12 }}>
        <CardKPI label="Receita Bruta" value={fmt(totalRev)} icon="trending-up" accent/>
        <CardKPI label="Total Despesas" value={fmt(totalExp)} icon="trending-down"/>
        <CardKPI label="Reembolsos" value={fmt(totalRef)} icon="rotate-ccw"/>
        <CardKPI label="Saldo Líquido" value={fmt(netBalance)} icon="wallet"/>
      </div>

      {/* View toggle + Add button */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', background:'rgba(255,255,255,.04)',
          border:'1px solid var(--app-border)', borderRadius:8, padding:3, gap:1 }}>
          {[['despesas','Despesas'],['receitas','Receitas'],['balanco','Balanço']].map(([id,l])=>(
            <button key={id} onClick={()=>setView(id)}
              style={{ padding:'6px 14px', borderRadius:6, cursor:'pointer', transition:'all 130ms',
                background:view===id?'rgba(234,170,65,.15)':'transparent',
                border:`1px solid ${view===id?'rgba(234,170,65,.2)':'transparent'}`,
                color:view===id?'var(--fmn-gold)':'rgba(255,255,255,.42)',
                fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:11.5 }}>
              {l}
            </button>
          ))}
        </div>
        <Btn variant="primary" size="sm" icon="plus"
          onClick={()=>setShowAddModal(true)}>
          {view==='receitas'?'Adicionar Receita':'Adicionar Gasto'}
        </Btn>
      </div>

      {/* Table */}
      <SectionCard
        title={view==='despesas'?'Despesas':view==='receitas'?'Receitas':'Balanço Completo'}
        noPad>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--app-border)' }}>
                {['Data','Tipo','Categoria','Descrição','Valor',''].map((h,i)=>(
                  <th key={i} style={{ padding:'10px 16px', textAlign:i>=4?'right':'left',
                    fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
                    letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)',
                    whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row,i)=>(
                <FinTableRow key={row.id} row={row} isLast={i===displayRows.length-1}
                  onDelete={async ()=>{
                    if(row.type==='Receita') return; // vendas não deletam daqui
                    await window.db.from('despesas').delete().eq('id', row.id);
                    reloadDesp();
                  }}/>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop:'1px solid var(--app-border-2)' }}>
                <td colSpan={4} style={{ padding:'12px 16px', fontSize:12,
                  fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-2)' }}>
                  {view==='balanco'?'Saldo do Período':'Total'}
                </td>
                <td style={{ padding:'12px 16px', textAlign:'right', fontSize:14,
                  fontFamily:'Roboto,sans-serif', fontWeight:900,
                  color:view==='receitas'?'var(--clr-pos)':view==='balanco'?netBalance>=0?'var(--clr-pos)':'var(--clr-neg)':'var(--clr-neg)' }}>
                  {view==='despesas'?fmt(totalExp):view==='receitas'?fmt(totalRev):fmt(netBalance)}
                </td>
                <td style={{ padding:'12px 16px' }}/>
              </tr>
            </tfoot>
          </table>
        </div>
      </SectionCard>
      {showAddModal && (
        <AddExpenseModal onClose={() => setShowAddModal(false)} onSaved={reloadDesp}/>
      )}
    </div>
  );
}

/* ── FinTableRow ─────────────────────────────────────────────────*/
function FinTableRow({ row, isLast, onDelete }) {
  const [hov, setHov] = useState(false);
  return (
    <tr onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov ? 'rgba(255,255,255,.02)' : 'transparent',
        borderBottom: isLast ? 'none' : '1px solid var(--app-border)', transition: 'background 120ms' }}>
      <td style={{ padding: '11px 16px', fontSize: 12.5, fontFamily: 'var(--font-body)',
        color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{row.date}</td>
      <td style={{ padding: '11px 16px' }}>
        <Badge tone={row.type === 'Mensal' ? 'info' : row.type === 'Anual' ? 'teal' : 'warning'}>{row.type}</Badge>
      </td>
      <td style={{ padding: '11px 16px' }}>
        <Badge tone={CATEGORY_TONE[row.category] || 'default'}>{row.category}</Badge>
      </td>
      <td style={{ padding: '11px 16px', fontSize: 13, fontFamily: 'var(--font-body)',
        color: 'var(--text-1)', maxWidth: 280 }}>{row.desc}</td>
      <td style={{ padding: '11px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
        <div style={{ fontSize: 13.5, fontFamily: 'Roboto, sans-serif', fontWeight: 700,
          color: row.type==='Receita' ? (row.value<0?'var(--clr-warn)':'var(--clr-pos)') : 'var(--clr-neg)' }}>
          {row.type==='Receita' ? (row.value<0?`–${fmtDec(Math.abs(row.value))}`:fmtDec(row.value)) : `–${fmtDec(row.value)}`}
        </div>
        {row.valorRef && row.type !== 'Receita' && (
          <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'Roboto,sans-serif', marginTop: 2 }}>
            {row.valorRef}
          </div>
        )}
      </td>
      <td style={{ padding: '11px 16px', textAlign: 'right' }}>
        {hov && (
          <button onClick={onDelete} style={{
            width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', background: 'rgba(248,113,113,.1)',
            border: '1px solid rgba(248,113,113,.2)', color: 'var(--clr-neg)', marginLeft: 'auto',
          }}>
            <LucideIcon icon="trash-2" size={13} />
          </button>
        )}
      </td>
    </tr>
  );
}

/* ── TaxesTab ────────────────────────────────────────────────────*/
function TaxCard({ title, subtitle, children }) {
  return (
    <div style={{ flex: 1, background: 'var(--app-surface)', border: '1px solid var(--app-border)',
      borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--app-border)',
        display: 'flex', alignItems: 'center', gap: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700,
            color: 'var(--text-1)' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, fontFamily: 'var(--font-body)',
            color: 'var(--text-3)', marginTop: 1 }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  );
}

function TaxRow({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '9px 0', borderBottom: '1px solid var(--app-border)' }}>
      <span style={{ fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--text-2)' }}>{label}</span>
      <span style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 900,
        color: accent ? 'var(--clr-neg)' : 'var(--text-1)' }}>{value}</span>
    </div>
  );
}

/* Alíquota editável (clica no valor e digita) */
function AliquotaEditavel({ chave, valor, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(String(valor));
  async function salvar() {
    const novo = Number(String(val).replace(',', '.')) || 0;
    await window.db.from('config').update({ valor: novo }).eq('chave', chave);
    setEditing(false);
    onSaved(novo);
  }
  if (editing) {
    return (
      <input autoFocus type="number" step="0.01" value={val}
        onChange={e => setVal(e.target.value)} onBlur={salvar}
        onKeyDown={e => { if (e.key==='Enter') salvar(); if (e.key==='Escape') setEditing(false); }}
        style={{ width:70, padding:'3px 6px', borderRadius:6, textAlign:'right',
          background:'var(--app-surface-2)', border:'1px solid var(--fmn-gold)',
          color:'var(--text-1)', fontFamily:'Roboto,sans-serif', fontSize:13, colorScheme:'dark' }}/>
    );
  }
  return (
    <span onClick={() => { setVal(String(valor)); setEditing(true); }}
      style={{ cursor:'pointer', padding:'2px 8px', borderRadius:6, fontWeight:900,
        fontSize:14, fontFamily:'var(--font-display)', color:'var(--text-1)',
        border:'1px dashed rgba(255,255,255,.2)' }}>
      {String(valor).replace('.', ',')}%
    </span>
  );
}

function TaxesTab({ dateRange }) {
  const { vendas, loading } = useVendasData(dateRange.from, dateRange.to);
  const [gastoMeta, setGastoMeta] = useState(0);
  const [notaPct, setNotaPct]     = useState(6);
  const [metaPct, setMetaPct]     = useState(12.15);

  useEffect(() => {
    if (!window.db) return;
    window.db.from('insights_cache').select('gasto').eq('periodo','maximum')
      .then(({ data }) => setGastoMeta((data||[]).reduce((s,r)=>s+Number(r.gasto),0)));
    window.db.from('config').select('chave,valor').then(({ data }) => {
      const m = Object.fromEntries((data||[]).map(c => [c.chave, Number(c.valor)]));
      if (m.imposto_nota_pct != null) setNotaPct(m.imposto_nota_pct);
      if (m.imposto_meta_pct != null) setMetaPct(m.imposto_meta_pct);
    });
  }, []);

  const aprovadas = vendas.filter(v => v.status === 'aprovada');
  const fat       = aprovadas.reduce((s,v) => s + Number(v.valor_bruto), 0);
  const liquido   = aprovadas.reduce((s,v) => s + Number(v.valor_liquido), 0);
  const hotmartTax = fat - liquido;
  const hotmartPct = fat > 0 ? ((hotmartTax / fat) * 100).toFixed(2) : '0.00';
  const vendasCount = aprovadas.length;
  const metaTax   = gastoMeta * (metaPct / 100);
  const notaTax   = fat * (notaPct / 100);

  if (loading) return <div style={{padding:40,textAlign:'center',color:'var(--text-3)',fontFamily:'Roboto,sans-serif'}}>Carregando...</div>;
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap:'wrap' }}>
      <TaxCard title="Imposto sobre Nota" subtitle="Simples Nacional · incide sobre o faturamento bruto das vendas">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 0', borderBottom:'1px solid var(--app-border)' }}>
          <span style={{ fontSize:13, fontFamily:'var(--font-body)', color:'var(--text-2)' }}>Alíquota (clique para editar)</span>
          <AliquotaEditavel chave="imposto_nota_pct" valor={notaPct} onSaved={setNotaPct}/>
        </div>
        <TaxRow label="Base de cálculo" value={fmt(Math.round(fat))} />
        <TaxRow label="Imposto calculado" value={fmt(Math.round(notaTax))} accent />
        <TaxRow label="Imposto por venda (média)" value={fmt(vendasCount ? notaTax / vendasCount : 0)} />
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8,
          background: 'rgba(248,113,113,.07)', border: '1px solid rgba(248,113,113,.15)' }}>
          <p style={{ fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--clr-neg)',
            lineHeight: 1.55, margin: 0 }}>
            Imposto sobre a nota fiscal emitida nas vendas. Ajuste a alíquota conforme a faixa do seu Simples Nacional muda ao longo do ano.
          </p>
        </div>
      </TaxCard>

      <TaxCard title="Imposto Meta" subtitle="Incide sobre o gasto em anúncios · todas as contas BRL">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 0', borderBottom:'1px solid var(--app-border)' }}>
          <span style={{ fontSize:13, fontFamily:'var(--font-body)', color:'var(--text-2)' }}>Alíquota (clique para editar)</span>
          <AliquotaEditavel chave="imposto_meta_pct" valor={metaPct} onSaved={setMetaPct}/>
        </div>
        <TaxRow label="Base (gasto Meta)" value={fmt(Math.round(gastoMeta))} />
        <TaxRow label="Imposto calculado" value={fmt(Math.round(metaTax))} accent />
        <TaxRow label="Imposto por venda (média)" value={fmt(vendasCount ? metaTax / vendasCount : 0)} />
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8,
          background: 'rgba(248,113,113,.07)', border: '1px solid rgba(248,113,113,.15)' }}>
          <p style={{ fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--clr-neg)',
            lineHeight: 1.55, margin: 0 }}>
            Cobrado pela Meta sobre pagamentos feitos a contas de anúncio em BRL, conforme regulamentação tributária brasileira.
          </p>
        </div>
      </TaxCard>

      <TaxCard title="Taxa Hotmart" subtitle="Diferença entre valor bruto e valor líquido recebido">
        <TaxRow label="Faturamento bruto" value={fmt(Math.round(fat))} />
        <TaxRow label="Valor líquido recebido" value={fmt(Math.round(liquido))} />
        <TaxRow label="Taxa efetiva média" value={`${hotmartPct}%`} />
        <TaxRow label="Vendas no período" value={`${vendasCount} vendas`} />
        <TaxRow label="Total retido Hotmart" value={fmt(Math.round(hotmartTax))} accent />
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8,
          background: 'rgba(251,191,36,.07)', border: '1px solid rgba(251,191,36,.15)' }}>
          <p style={{ fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--clr-warn)',
            lineHeight: 1.55, margin: 0 }}>
            Taxa cobrada pela Hotmart sobre cada transação aprovada. Valores retidos na liquidação do período.
          </p>
        </div>
      </TaxCard>
    </div>
  );
}

/* ── ProductCostsTab (editável, lê tabela produtos) ──────────────*/
function ProductCostsTab() {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [editId, setEditId]     = useState(null);
  const [editVal, setEditVal]   = useState('');

  async function load() {
    if (!window.db) return;
    setLoading(true);
    const { data } = await window.db.from('produtos')
      .select('nome,ticket,custo,ativo').order('ticket', { ascending: false });
    setProdutos(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function salvarCusto(nome) {
    const novoCusto = Number(String(editVal).replace(',', '.')) || 0;
    await window.db.from('produtos').update({ custo: novoCusto, updated_at: new Date().toISOString() }).eq('nome', nome);
    setEditId(null); setEditVal('');
    load();
  }

  if (loading) return <div style={{padding:40,textAlign:'center',color:'var(--text-3)',fontFamily:'Roboto,sans-serif'}}>Carregando...</div>;

  return (
    <SectionCard title="Custo de Produtos"
      headerRight={<span style={{ fontSize:11, color:'var(--text-3)', fontFamily:'Roboto,sans-serif' }}>
        Clique no custo para editar. Infoproduto começa em R$ 0.
      </span>}
      noPad>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--app-border)' }}>
              {['Produto', 'Ticket Médio', 'Custo', 'Margem Bruta', 'Status'].map((h, i) => (
                <th key={i} style={{
                  padding: '10px 16px', textAlign: i >= 1 ? 'right' : 'left',
                  fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 700,
                  letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {produtos.map((row, i) => {
              const isLast = i === produtos.length - 1;
              const ticket = Number(row.ticket) || 0;
              const custo  = Number(row.custo) || 0;
              const margin = ticket > 0 ? ((ticket - custo) / ticket) * 100 : 0;
              const editing = editId === row.nome;
              return (
                <tr key={row.nome}
                  style={{ borderBottom: isLast ? 'none' : '1px solid var(--app-border)' }}>
                  <td style={{ padding: '13px 16px', fontSize: 13.5, fontFamily: 'var(--font-body)',
                    color: 'var(--text-1)', fontWeight: 700 }}>
                    {row.nome}
                  </td>
                  <td style={{ padding: '13px 16px', textAlign: 'right', fontSize: 13.5,
                    fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--fmn-gold)' }}>
                    {fmt(Math.round(ticket))}
                  </td>
                  <td style={{ padding: '13px 16px', textAlign: 'right', fontSize: 13,
                    fontFamily: 'var(--font-display)', fontWeight: 500, color: 'var(--clr-neg)' }}>
                    {editing ? (
                      <input autoFocus type="number" value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        onBlur={() => salvarCusto(row.nome)}
                        onKeyDown={e => { if (e.key === 'Enter') salvarCusto(row.nome); if (e.key === 'Escape') { setEditId(null); setEditVal(''); } }}
                        style={{ width:90, padding:'5px 8px', borderRadius:6, textAlign:'right',
                          background:'var(--app-surface-2)', border:'1px solid var(--fmn-gold)',
                          color:'var(--text-1)', fontFamily:'Roboto,sans-serif', fontSize:13, colorScheme:'dark' }}/>
                    ) : (
                      <span onClick={() => { setEditId(row.nome); setEditVal(String(custo)); }}
                        style={{ cursor:'pointer', padding:'4px 8px', borderRadius:6,
                          border:'1px dashed rgba(255,255,255,.15)', transition:'all 130ms' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor='var(--fmn-gold)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor='rgba(255,255,255,.15)'}>
                        {fmt(custo)}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                      <span style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 900,
                        color: margin >= 70 ? 'var(--clr-pos)' : margin >= 40 ? 'var(--clr-warn)' : 'var(--clr-neg)' }}>
                        {margin.toFixed(1)}%
                      </span>
                      <div style={{ width: 72, height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 99 }}>
                        <div style={{ width: `${Math.max(0, Math.min(100, margin))}%`, height: '100%',
                          background: margin >= 70 ? 'var(--clr-pos)' : margin >= 40 ? 'var(--clr-warn)' : 'var(--clr-neg)', borderRadius: 99 }} />
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                    <Badge tone={row.ativo ? 'success' : 'default'} dot>{row.ativo ? 'Ativo' : 'Inativo'}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

/* ── HotmartTab ──────────────────────────────────────────────────*/
const STATUS_TONE  = { aprovada:'success', reembolsada:'danger', cancelada:'warning', pendente:'default' };
const STATUS_LABEL = { aprovada:'Aprovado', reembolsada:'Reembolso', cancelada:'Cancelado', pendente:'Pendente' };

function HotmartTab({ dateRange }) {
  const [activeFilter, setActiveFilter] = useState('Todos');
  const { vendas, loading } = useVendasData(dateRange.from, dateRange.to);
  const filters = ['Todos','Aprovados','Reembolsos'];

  const productMap = {};
  vendas.forEach(v => {
    const k = v.produto_nome || 'Outros';
    if (!productMap[k]) productMap[k] = { id:k, nome:k, vendas:0, aprovacoes:0, reembolsos:0, receita:0 };
    productMap[k].vendas++;
    if (v.status==='aprovada')   { productMap[k].aprovacoes++; productMap[k].receita += Number(v.valor_bruto); }
    if (v.status==='reembolsada') productMap[k].reembolsos++;
  });
  const hotmartProducts = Object.values(productMap).sort((a,b) => b.receita - a.receita);

  const totalReceita = hotmartProducts.reduce((a,p) => a + p.receita, 0);
  const totalAprov   = hotmartProducts.reduce((a,p) => a + p.aprovacoes, 0);
  const totalReemb   = hotmartProducts.reduce((a,p) => a + p.reembolsos, 0);
  const ticketMedio  = Math.round(totalReceita / (totalAprov || 1));

  const filteredVendas = vendas.filter(v => {
    if (activeFilter === 'Aprovados') return v.status === 'aprovada';
    if (activeFilter === 'Reembolsos') return v.status === 'reembolsada';
    return true;
  }).slice(0, 100);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Banner de conexão */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
        borderRadius:10, background:'rgba(74,222,128,.06)', border:'1px solid rgba(74,222,128,.2)' }}>
        <div style={{ width:8, height:8, borderRadius:'50%', background:'#4ade80', flexShrink:0,
          boxShadow:'0 0 6px #4ade80' }}/>
        <span style={{ fontSize:12.5, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'#4ade80' }}>
          Hotmart — Backend conectado
        </span>
        <span style={{ fontSize:12, color:'var(--text-3)', fontFamily:'Roboto,sans-serif' }}>
          · Dados via tabela <code style={{ fontFamily:'monospace', background:'rgba(255,255,255,.06)',
            padding:'1px 5px', borderRadius:4, fontSize:11 }}>vendas</code> no Supabase
        </span>
        <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text-3)', fontFamily:'Roboto,sans-serif' }}>
          {dateRange.from} a {dateRange.to} · {vendas.length} registros
        </span>
      </div>

      {/* KPIs */}
      <div style={{ display:'flex', gap:12 }}>
        <CardKPI label="Receita Hotmart" value={fmt(totalReceita)} icon="trending-up" accent/>
        <CardKPI label="Aprovações" value={String(totalAprov)} icon="check-circle"/>
        <CardKPI label="Reembolsos" value={String(totalReemb)} icon="rotate-ccw"/>
        <CardKPI label="Ticket Médio" value={fmt(ticketMedio)} icon="tag"/>
      </div>

      {/* Tabela de produtos */}
      <SectionCard title="Produtos" noPad>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ borderBottom:'1px solid var(--app-border)' }}>
              {['Produto','Preço','Vendas','Aprovações','Reembolsos','Receita'].map((h,i) => (
                <th key={i} style={{ padding:'10px 16px', textAlign:i===0?'left':'right',
                  fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
                  letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hotmartProducts.map((p, i) => {
              const txReemb = p.reembolsos / (p.vendas || 1) * 100;
              return (
                <tr key={p.id}
                  style={{ borderBottom:i<hotmartProducts.length-1?'1px solid var(--app-border)':'none' }}>
                  <td style={{ padding:'12px 16px', fontSize:13, fontFamily:'Roboto,sans-serif',
                    fontWeight:700, color:'var(--text-1)' }}>{p.nome}</td>
                  <td style={{ padding:'12px 16px', textAlign:'right', fontSize:13.5,
                    fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--fmn-gold)' }}>
                    {fmt(p.aprovacoes ? Math.round(p.receita / p.aprovacoes) : 0)}
                  </td>
                  <td style={{ padding:'12px 16px', textAlign:'right', fontSize:13,
                    fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-1)' }}>
                    {p.vendas}
                  </td>
                  <td style={{ padding:'12px 16px', textAlign:'right', fontSize:13,
                    fontFamily:'Roboto,sans-serif', fontWeight:700, color:'#4ade80' }}>
                    {p.aprovacoes}
                  </td>
                  <td style={{ padding:'12px 16px', textAlign:'right' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:6 }}>
                      <span style={{ fontSize:13, fontFamily:'Roboto,sans-serif', fontWeight:700,
                        color:p.reembolsos>0?'#f87171':'var(--text-3)' }}>{p.reembolsos}</span>
                      {p.reembolsos > 0 && (
                        <span style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif',
                          color:'rgba(248,113,113,.6)' }}>({txReemb.toFixed(1)}%)</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding:'12px 16px', textAlign:'right', fontSize:14,
                    fontFamily:'Roboto,sans-serif', fontWeight:900, color:'#4ade80' }}>
                    {fmt(p.receita)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop:'1px solid var(--app-border-2)' }}>
              <td colSpan={5} style={{ padding:'12px 16px', fontSize:12,
                fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-2)' }}>Total</td>
              <td style={{ padding:'12px 16px', textAlign:'right', fontSize:15,
                fontFamily:'Roboto,sans-serif', fontWeight:900, color:'#4ade80' }}>
                {fmt(totalReceita)}
              </td>
            </tr>
          </tfoot>
        </table>
      </SectionCard>

      {/* Histórico de vendas */}
      <SectionCard
        title="Histórico de Vendas"
        noPad
        headerRight={
          <div style={{ display:'flex', background:'rgba(255,255,255,.04)',
            border:'1px solid var(--app-border)', borderRadius:7, padding:2, gap:1 }}>
            {filters.map(f => (
              <button key={f} onClick={() => setActiveFilter(f)}
                style={{ padding:'4px 10px', borderRadius:5, cursor:'pointer', transition:'all 130ms',
                  background:activeFilter===f?'rgba(234,170,65,.15)':'transparent',
                  border:`1px solid ${activeFilter===f?'rgba(234,170,65,.2)':'transparent'}`,
                  color:activeFilter===f?'var(--fmn-gold)':'rgba(255,255,255,.42)',
                  fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:11 }}>
                {f}
              </button>
            ))}
          </div>
        }>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ borderBottom:'1px solid var(--app-border)' }}>
              {['Data','Produto','Valor','Status'].map((h,i) => (
                <th key={i} style={{ padding:'10px 16px', textAlign:i>=2?'right':'left',
                  fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
                  letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredVendas.map((v, i) => (
              <tr key={v.id}
                style={{ borderBottom:i<filteredVendas.length-1?'1px solid var(--app-border)':'none',
                  background:'transparent', transition:'background 120ms' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.02)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <td style={{ padding:'11px 16px', fontSize:12, color:'var(--text-3)',
                  fontFamily:'Roboto,sans-serif', whiteSpace:'nowrap' }}>{v.created_at?.slice(0,10)}</td>
                <td style={{ padding:'11px 16px', fontSize:13, color:'var(--text-1)',
                  fontFamily:'Roboto,sans-serif', maxWidth:260 }}>{v.produto_nome}</td>
                <td style={{ padding:'11px 16px', textAlign:'right', fontSize:13.5,
                  fontFamily:'Roboto,sans-serif', fontWeight:700,
                  color:v.status==='reembolsada'?'#f87171':'#4ade80' }}>
                  {v.status==='reembolsada'?`–${fmt(Math.round(Number(v.valor_bruto)))}`:fmt(Math.round(Number(v.valor_bruto)))}
                </td>
                <td style={{ padding:'11px 16px', textAlign:'right' }}>
                  <Badge tone={STATUS_TONE[v.status]||'default'}>{STATUS_LABEL[v.status]||v.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}

/* ── FinancialScreen ─────────────────────────────────────────────*/
function FinancialScreen() {
  const [tab, setTab] = useState('hotmart');
  // padrão: primeiro dia do mês atual até hoje (inclui vendas novas)
  const _hoje = new Date();
  const _primeiroDiaMes = new Date(_hoje.getFullYear(), _hoje.getMonth(), 1);
  const _iso = d => d.toISOString().slice(0,10);
  const [dateRange, setDateRange] = useState({ from: _iso(_primeiroDiaMes), to: _iso(_hoje) });
  const tabs = [
    { id: 'hotmart',  label: 'Hotmart',          icon: 'shopping-cart' },
    { id: 'despesas', label: 'Despesas',          icon: 'receipt' },
    { id: 'impostos', label: 'Impostos',          icon: 'landmark' },
    { id: 'produtos', label: 'Custo de Produtos', icon: 'package' },
  ];
  return (
    <div style={{ flex:1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight:0 }}>
      <TopBar title="Financeiro" />
      {/* Date filter */}
      <DateFilter from={dateRange.from} to={dateRange.to} onChange={setDateRange} />
      {/* Tab bar */}
      <div style={{ padding: '0 24px', borderBottom: '1px solid var(--app-border)',
        display: 'flex', gap: 0, flexShrink: 0, background: 'var(--app-bg)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '13px 18px',
              borderBottom: `2px solid ${tab === t.id ? 'var(--fmn-gold)' : 'transparent'}`,
              color: tab === t.id ? 'var(--fmn-gold)' : 'var(--text-2)',
              fontFamily: 'Roboto, sans-serif', fontWeight: 700, fontSize: 12.5,
              letterSpacing: '0.02em', cursor: 'pointer', transition: 'all 150ms',
              background: 'transparent',
            }}>
            <LucideIcon icon={t.icon} size={15} />
            {t.label}
          </button>
        ))}
      </div>
      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {tab === 'hotmart'  && <HotmartTab dateRange={dateRange}/>}
        {tab === 'despesas' && <ExpensesTab dateRange={dateRange}/>}
        {tab === 'impostos' && <TaxesTab dateRange={dateRange}/>}
        {tab === 'produtos'  && <ProductCostsTab />}
      </div>
    </div>
  );
}

Object.assign(window, { FinancialScreen, FinTableRow });
