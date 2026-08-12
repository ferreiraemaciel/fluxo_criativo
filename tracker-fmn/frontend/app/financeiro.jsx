/* ================================================================
   Tracker FMN — Financeiro Screen v2
   Components: DateFilter · FinTableRow · ExpensesTab · TaxesTab · FinancialScreen
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
        .select('hotmart_transaction_id,produto_nome,valor_bruto,preco_oferta,valor_liquido,status,created_at,utm_source')
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
        .select('id,descricao,categoria,tipo,recorrencia,valor,data,data_fim,ativo,observacoes')
        .order('data', { ascending: false });
      setDespesas(data || []);
      setLoading(false);
    }
    load();
  }, [tick]);
  return { despesas, loading, reload: () => setTick(t => t + 1) };
}

/* ── Categorias de despesa ────────────────────────────────────────
   Fonte única: o cadastro, a etiqueta colorida e o texto exibido saem daqui.
   Antes eram três listas soltas que não conversavam: o formulário gravava
   "ferramenta", o banco tinha "ferramentas" e "producao", e a tabela de cores
   procurava por "Ferramenta" com maiúscula. Nenhuma casava, e por isso toda
   etiqueta ficava cinza.

   A chave é a forma achatada (minúscula, sem acento), então "Produção",
   "producao" e "PRODUÇÃO" caem todas no mesmo lugar.                      */
const CATEGORIAS_DESPESA = [
  { chave: 'trafego',     label: 'Tráfego',     tone: 'info'    },
  { chave: 'plataforma',  label: 'Plataforma',  tone: 'teal'    },
  { chave: 'ferramenta',  label: 'Ferramenta',  tone: 'gold'    },
  { chave: 'criativo',    label: 'Criativo',    tone: 'amber'   },
  { chave: 'producao',    label: 'Produção',    tone: 'amber'   },
  { chave: 'equipe',      label: 'Equipe',      tone: 'success' },
  { chave: 'consultoria', label: 'Consultoria', tone: 'warning' },
  { chave: 'outros',      label: 'Outros',      tone: 'default' },
];

// Achata pra comparar: minúscula, sem acento e sem plural bobo.
function chaveCategoria(valor) {
  const base = String(valor || 'outros').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  return base.replace(/s$/, '') === 'ferramenta' ? 'ferramenta' : base;
}

function categoriaInfo(valor) {
  const k = chaveCategoria(valor);
  return CATEGORIAS_DESPESA.find(c => c.chave === k)
      || { chave: k, label: String(valor || 'Outros'), tone: 'default' };
}

// Receita e reembolso não são categorias de despesa, mas aparecem na mesma
// tabela no modo Balanço, então precisam de cor própria.
const TONE_LINHA = { Venda: 'success', Reembolso: 'danger' };


const fmt    = window.fmtBRL;
const fmtDec = window.fmtBRL;

/* O rateio de despesa no período mora em financas.js, compartilhado com o
   Dashboard. Estava copiado inteiro nos dois arquivos, e bastava mudar num
   só pra as duas telas passarem a mostrar despesas diferentes pro mesmo mês,
   sem erro nenhum aparecer. */
const calcularValorNoPeriodo = (d, from, to) => window.FMNFinancas.rateioDespesa(d, from, to);

/* ── AddExpenseModal ─────────────────────────────────────────────*/
function AddExpenseModal({ onClose, onSaved }) {
  const [erro, setErro] = useState('');
  const [form, setForm] = useState({ descricao:'', categoria:'ferramenta', tipo:'recorrente', recorrencia:'mensal', valor:'', data: new Date().toISOString().slice(0,10), observacoes:'' });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(p => ({...p,[k]:v}));
  const categorias = CATEGORIAS_DESPESA;
  const handleSave = async () => {
    if (!form.descricao || !form.valor) return;
    setSaving(true);
    const { error } = await window.db.from('despesas').insert({
      descricao: form.descricao, categoria: form.categoria, tipo: form.tipo,
      recorrencia: form.tipo === 'recorrente' ? form.recorrencia : 'mensal',
      valor: Number(form.valor), data: form.data, ativo: true, observacoes: form.observacoes || null,
    });
    setSaving(false);
    if (error) { setErro(error.message || 'Não consegui salvar. Confira os campos.'); return; }
    onSaved(); onClose();
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
            {categorias.map(c=><option key={c.chave} value={c.chave}>{c.label}</option>)}
          </select>
        </div>
        {erro && (
          <div style={{ padding:'9px 11px',borderRadius:8,background:'rgba(248,113,113,.08)',
            border:'1px solid rgba(248,113,113,.3)',fontSize:11.5,color:'#f87171',
            fontFamily:'Roboto,sans-serif',lineHeight:1.5 }}>{erro}</div>
        )}
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

  // Tráfego e alíquotas: o maior custo do negócio não era digitado por
  // ninguém, então não aparecia aqui. O "Saldo Líquido" ignorava R$ 29 mil
  // de anúncios contra R$ 5 mil de despesas cadastradas.
  const [gasto, setGasto]     = useState(0);
  const [notaPct, setNotaPct] = useState(6);
  const [metaPct, setMetaPct] = useState(12.15);
  useEffect(() => {
    if (!window.db) return;
    window.db.from('config').select('chave,valor').then(({ data }) => {
      const m = Object.fromEntries((data||[]).map(c => [c.chave, Number(c.valor)]));
      if (m.imposto_nota_pct != null) setNotaPct(m.imposto_nota_pct);
      if (m.imposto_meta_pct != null) setMetaPct(m.imposto_meta_pct);
    });
  }, []);
  useEffect(() => {
    if (!window.db) return;
    let vivo = true;
    window.db.from('gasto_diario').select('gasto')
      .gte('data', dateRange.from).lte('data', dateRange.to)
      .then(({ data }) => { if (vivo) setGasto((data||[]).reduce((s,r)=>s+Number(r.gasto),0)); });
    return () => { vivo = false; };
  }, [dateRange.from, dateRange.to]);

  const resultado = window.FMNFinancas.calcularResultado({
    vendas, despesas: rawDespesas, gasto, notaPct, metaPct,
    from: dateRange.from, to: dateRange.to,
  });

  let expenses = rawDespesas.map(d => {
    const valorPeriodo = calcularValorNoPeriodo(d, dateRange.from, dateRange.to);
    const recorrencia = d.recorrencia || 'mensal';
    const labelRef = d.tipo === 'unico' ? 'único'
      : recorrencia === 'anual' ? `/ano: ${fmtDec(Number(d.valor))}`
      : `/mês: ${fmtDec(Number(d.valor))}`;
    const br = iso => iso ? iso.split('-').reverse().join('/') : null;
    return {
      id: d.id, date: d.data, dataFim: d.data_fim,
      type: d.tipo === 'recorrente' ? (recorrencia === 'anual' ? 'Anual' : 'Mensal') : 'Único',
      category: d.categoria,
      desc: d.descricao + (d.data_fim ? ` · encerrada em ${br(d.data_fim)}` : ''),
      value: valorPeriodo, valorRef: labelRef,
      isRecorrente: d.tipo === 'recorrente',
      encerravel: d.tipo === 'recorrente' && !d.data_fim,
    };
  });

  const revenues = vendas.filter(v => v.status === 'aprovada').map(v => ({
    id: v.hotmart_transaction_id, date: v.created_at?.slice(0,10),
    type: 'Receita', category: 'Venda', desc: v.produto_nome, value: Number(v.preco_oferta ?? v.valor_bruto),
  })).concat(vendas.filter(v => v.status === 'reembolsada').map(v => ({
    id: v.hotmart_transaction_id + '_r', date: v.created_at?.slice(0,10),
    type: 'Receita', category: 'Reembolso', desc: v.produto_nome, value: -Number(v.preco_oferta ?? v.valor_bruto),
  })));

  // Linha automática: vem da Meta, não é digitada e não é editável. Editar
  // aqui não mudaria o gasto real, só criaria uma segunda verdade.
  const linhaTrafego = gasto > 0 ? [{
    id: '__trafego__', date: dateRange.to, type: 'Automático', category: 'trafego',
    desc: 'Anúncios no Meta (importado da conta, não editável)',
    value: gasto, valorRef: 'gasto do período', automatica: true,
  }] : [];
  const linhaImpostoMeta = gasto > 0 ? [{
    id: '__imposto_meta__', date: dateRange.to, type: 'Automático', category: 'trafego',
    desc: `Imposto sobre anúncios (${metaPct}% do gasto no Meta)`,
    value: resultado.impostoMeta, valorRef: 'calculado', automatica: true,
  }] : [];
  expenses = [...linhaTrafego, ...linhaImpostoMeta, ...expenses];

  const totalExp = expenses.reduce((a,r)=>a+r.value,0);
  const totalRev = revenues.filter(r=>r.value>0).reduce((a,r)=>a+r.value,0);
  const totalRef = Math.abs(revenues.filter(r=>r.value<0).reduce((a,r)=>a+r.value,0));

  const displayRows = view==='despesas' ? expenses
    : view==='receitas' ? revenues
    : [...revenues,...expenses.map(e=>({...e,value:-e.value}))]
        .sort((a,b)=>new Date(b.date||'') - new Date(a.date||''));

  // O saldo agora é o LUCRO da fonte única: líquido menos impostos, tráfego
  // e despesas. Antes era receita bruta menos despesas cadastradas, que não
  // descontava imposto nem anúncio e por isso nunca batia com o Dashboard.
  const netBalance = resultado.lucro;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* KPI Row */}
      <div style={{ display:'flex', gap:12 }}>
        <CardKPI label="Faturamento" value={fmt(resultado.bruto)} icon="trending-up" accent/>
        <CardKPI label="Custo Total" value={fmt(resultado.custoTotal)} icon="trending-down"/>
        <CardKPI label="Lucro" value={fmt(resultado.lucro)} icon="wallet"/>
        <CardKPI label="Margem" value={`${resultado.margem.toFixed(1)}%`} icon="percent"/>
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
          Adicionar Gasto
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
                  }}
                  onEncerrar={async ()=>{
                    // Encerrar é diferente de apagar. Apagar some com a despesa
                    // do passado inteiro e distorce todos os meses em que ela
                    // realmente existiu; encerrar só diz até quando ela valeu.
                    const hoje = new Date().toISOString().slice(0,10);
                    const q = window.prompt(
                      `Até que dia "${row.desc}" foi cobrada?\n\nData no formato AAAA-MM-DD. ` +
                      `Depois dessa data ela para de descontar do lucro, e os meses anteriores ficam como estavam.`,
                      hoje);
                    if (!q || !/^\d{4}-\d{2}-\d{2}$/.test(q.trim())) return;
                    await window.db.from('despesas').update({ data_fim: q.trim() }).eq('id', row.id);
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
function FinTableRow({ row, isLast, onDelete, onEncerrar }) {
  const [hov, setHov] = useState(false);
  return (
    <tr onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov ? 'rgba(255,255,255,.02)' : 'transparent',
        borderBottom: isLast ? 'none' : '1px solid var(--app-border)', transition: 'background 120ms' }}>
      <td style={{ padding: '11px 16px', fontSize: 12.5, fontFamily: 'var(--font-body)',
        color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{row.date}</td>
      <td style={{ padding: '11px 16px' }}>
        <Badge tone={row.automatica ? 'gold' : row.type === 'Mensal' ? 'info' : row.type === 'Anual' ? 'teal' : 'warning'}>{row.type}</Badge>
      </td>
      <td style={{ padding: '11px 16px' }}>
        <Badge tone={TONE_LINHA[row.category] || categoriaInfo(row.category).tone}>{TONE_LINHA[row.category] ? row.category : categoriaInfo(row.category).label}</Badge>
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
        {hov && !row.automatica && row.encerravel && (
          <button onClick={onEncerrar} title="Encerrar: para de cobrar daqui pra frente, sem mexer no passado"
            style={{
              height: 26, padding: '0 9px', borderRadius: 6, display: 'inline-flex', alignItems: 'center',
              gap: 5, cursor: 'pointer', background: 'rgba(251,191,36,.1)', marginRight: 6,
              border: '1px solid rgba(251,191,36,.25)', color: 'var(--clr-warn)',
              fontFamily: 'Roboto,sans-serif', fontSize: 11, fontWeight: 700,
            }}>
            <LucideIcon icon="calendar-x" size={12} />Encerrar
          </button>
        )}
        {hov && !row.automatica && (
          <button onClick={onDelete} style={{
            width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', background: 'rgba(248,113,113,.1)',
            border: '1px solid rgba(248,113,113,.2)', color: 'var(--clr-neg)',
            display: 'inline-flex',
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

  const [inicioGastoDiario, setInicioGastoDiario] = useState(null);

  useEffect(() => {
    if (!window.db) return;
    window.db.from('config').select('chave,valor').then(({ data }) => {
      const m = Object.fromEntries((data||[]).map(c => [c.chave, Number(c.valor)]));
      if (m.imposto_nota_pct != null) setNotaPct(m.imposto_nota_pct);
      if (m.imposto_meta_pct != null) setMetaPct(m.imposto_meta_pct);
    });
    // Onde começa o histórico diário de gasto. Antes dessa data só existe o
    // total de vida, sem quebra por dia, e o card avisa em vez de fingir.
    window.db.from('gasto_diario').select('data').order('data').limit(1)
      .then(({ data }) => setInicioGastoDiario(data?.[0]?.data || null));
  }, []);

  // O gasto com anúncios vem do histórico DIÁRIO, recortado pelo período
  // escolhido. Antes lia o total de vida inteira (`periodo='maximum'`), então
  // o imposto era o mesmo número escolhendo "Hoje" ou "Mês": 12,15% sobre
  // R$ 155 mil, em vez de sobre o gasto do período.
  useEffect(() => {
    if (!window.db) return;
    let vivo = true;
    window.db.from('gasto_diario').select('gasto')
      .gte('data', dateRange.from).lte('data', dateRange.to)
      .then(({ data }) => { if (vivo) setGastoMeta((data||[]).reduce((s,r)=>s+Number(r.gasto),0)); });
    return () => { vivo = false; };
  }, [dateRange.from, dateRange.to]);

  const periodoAnteriorAoHistorico = inicioGastoDiario && dateRange.from < inicioGastoDiario;

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
        {periodoAnteriorAoHistorico && (
          <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8,
            background:'rgba(251,191,36,.07)', border:'1px solid rgba(251,191,36,.18)',
            fontSize:11, fontFamily:'var(--font-body)', color:'var(--clr-warn)', lineHeight:1.5 }}>
            O gasto dia a dia só existe a partir de {inicioGastoDiario.split('-').reverse().join('/')}.
            O que veio antes disso não entra nesta conta.
          </div>
        )}
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

/* ── Custo de Produtos: fora do frontend por enquanto ────────────
   A aba foi removida da tela em 2026-08-12. Motivo: infoproduto não tem
   custo por unidade vendida, então todos os custos eram R$ 0 e a margem
   dava 100% em tudo. Número que nunca muda não é informação, é ruído.

   A tabela `produtos` continua no Supabase, com a estrutura inteira. No dia
   em que existir produto com custo de verdade (impresso, coprodução,
   comissão de afiliado), a aba volta a partir dela.                       */

/* ── HotmartTab ──────────────────────────────────────────────────*/
const STATUS_TONE  = { aprovada:'success', reembolsada:'danger', cancelada:'warning', pendente:'default' };
const STATUS_LABEL = { aprovada:'Aprovado', reembolsada:'Reembolso', cancelada:'Cancelado', pendente:'Pendente' };

/* ── SinalHotmart ────────────────────────────────────────────────
   Mostra quando entrou a última venda no banco, que é o jeito honesto de
   dizer se a integração está viva. Verde quando chegou algo nas últimas
   48h, amarelo depois disso. Nunca inventa "conectado".                 */
function SinalHotmart({ faixa, registros }) {
  const [ultima, setUltima] = useState(undefined);
  useEffect(() => {
    if (!window.db) return;
    window.db.from('vendas').select('created_at').order('created_at', { ascending:false }).limit(1)
      .then(({ data }) => setUltima(data?.[0]?.created_at || null));
  }, []);

  const horas = ultima ? (Date.now() - new Date(ultima)) / 3600000 : null;
  const ok    = horas != null && horas < 48;
  const cor   = ultima === undefined ? '#8a8a8a' : ok ? '#4ade80' : '#fbbf24';
  const texto = ultima === undefined ? 'Conferindo a integração...'
    : ultima === null ? 'Nenhuma venda registrada ainda'
    : horas < 1  ? 'Última venda há menos de 1 hora'
    : horas < 48 ? `Última venda há ${Math.floor(horas)}h`
    : `Última venda há ${Math.floor(horas / 24)} dias`;

  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:10,
      background:`${cor}11`, border:`1px solid ${cor}33` }}>
      <div style={{ width:8, height:8, borderRadius:'50%', background:cor, flexShrink:0,
        boxShadow:`0 0 6px ${cor}` }}/>
      <span style={{ fontSize:12.5, fontFamily:'Roboto,sans-serif', fontWeight:700, color:cor }}>
        Hotmart · {texto}
      </span>
      <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text-3)', fontFamily:'Roboto,sans-serif' }}>
        {faixa.from.split('-').reverse().join('/')} a {faixa.to.split('-').reverse().join('/')} · {registros} registros
      </span>
    </div>
  );
}

function HotmartTab({ dateRange }) {
  const [activeFilter, setActiveFilter] = useState('Todos');
  const { vendas, loading } = useVendasData(dateRange.from, dateRange.to);
  const filters = ['Todos','Aprovados','Reembolsos','Cancelados','Problemas'];

  const productMap = {};
  vendas.forEach(v => {
    const k = v.produto_nome || 'Outros';
    if (!productMap[k]) productMap[k] = { id:k, nome:k, vendas:0, aprovacoes:0, reembolsos:0, receita:0 };
    productMap[k].vendas++;
    // `preco_oferta` é o preço do produto sem os juros do parcelamento, que é
    // a base da nota. É o mesmo número que o Dashboard e a aba Despesas usam;
    // aqui era `valor_bruto`, e por isso a receita aparecia maior que no resto
    // do sistema (R$ 1.397 de diferença no histórico).
    if (v.status==='aprovada')   { productMap[k].aprovacoes++; productMap[k].receita += Number(v.preco_oferta ?? v.valor_bruto); }
    if (v.status==='reembolsada') productMap[k].reembolsos++;
  });
  const hotmartProducts = Object.values(productMap).sort((a,b) => b.receita - a.receita);

  const totalReceita = hotmartProducts.reduce((a,p) => a + p.receita, 0);
  const totalAprov   = hotmartProducts.reduce((a,p) => a + p.aprovacoes, 0);
  const totalReemb   = hotmartProducts.reduce((a,p) => a + p.reembolsos, 0);
  const ticketMedio  = Math.round(totalReceita / (totalAprov || 1));

  // Reembolso importa como TAXA, não como número solto: 5 reembolsos em 30
  // vendas é problema, em 300 é rotina.
  const taxaReembolso = (totalAprov + totalReemb) > 0
    ? (totalReemb / (totalAprov + totalReemb)) * 100 : 0;

  // Chargeback e protesto não apareciam em lugar nenhum da tela, embora
  // existam no banco e sejam dinheiro levado de volta à força. Ficavam
  // escondidos dentro de "Todos", sem filtro e sem contagem.
  const outrosProblemas = vendas.filter(v => v.status === 'chargeback' || v.status === 'protesto');

  const LIMITE_LISTA = 100;
  const vendasFiltradas = vendas.filter(v => {
    if (activeFilter === 'Aprovados')   return v.status === 'aprovada';
    if (activeFilter === 'Reembolsos')  return v.status === 'reembolsada';
    if (activeFilter === 'Cancelados')  return v.status === 'cancelada';
    if (activeFilter === 'Problemas')   return v.status === 'chargeback' || v.status === 'protesto';
    return true;
  });
  // A lista era cortada em 100 sem avisar: no período "Máximo" você via 100 de
  // 1.476 achando que era tudo.
  const filteredVendas = vendasFiltradas.slice(0, LIMITE_LISTA);
  const cortouLista = vendasFiltradas.length > LIMITE_LISTA;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Sinal de vida da integração.

          O banner antigo dizia "Backend conectado" em verde, sempre, mesmo
          que nada estivesse chegando. Um indicador que nunca muda não avisa
          nada: em agosto de 2026 o webhook do WhatsApp ficou 4 dias fora do
          ar e o painel continuou parecendo saudável. Agora ele mostra quando
          entrou a última venda, e fica amarelo se faz mais de 48h. */}
      <SinalHotmart faixa={dateRange} registros={vendas.length}/>

      {/* KPIs */}
      <div style={{ display:'flex', gap:12 }}>
        <CardKPI label="Faturamento" value={fmt(totalReceita)} icon="trending-up" accent/>
        <CardKPI label="Aprovações" value={String(totalAprov)} icon="check-circle"/>
        <CardKPI label="Reembolsos" value={`${totalReemb} · ${taxaReembolso.toFixed(1)}%`} icon="rotate-ccw"/>
        <CardKPI label="Ticket Médio" value={fmt(ticketMedio)} icon="tag"/>
      </div>

      {cortouLista && (
        <div style={{ padding:'8px 12px', borderRadius:9, background:'rgba(251,191,36,.07)',
          border:'1px solid rgba(251,191,36,.18)', fontSize:11.5, fontFamily:'Roboto,sans-serif',
          color:'var(--clr-warn)', lineHeight:1.5 }}>
          A lista abaixo mostra as {LIMITE_LISTA} vendas mais recentes de {vendasFiltradas.length} no período.
          Os totais e os cartões acima consideram todas.
        </div>
      )}

      {outrosProblemas.length > 0 && (
        <div style={{ padding:'8px 12px', borderRadius:9, background:'rgba(248,113,113,.07)',
          border:'1px solid rgba(248,113,113,.2)', fontSize:11.5, fontFamily:'Roboto,sans-serif',
          color:'var(--clr-neg)', lineHeight:1.5 }}>
          {outrosProblemas.length === 1 ? 'Há 1 venda' : `Há ${outrosProblemas.length} vendas`} com
          chargeback ou protesto no período. Veja no filtro "Problemas".
        </div>
      )}

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
      </div>
    </div>
  );
}

Object.assign(window, { FinancialScreen, FinTableRow });
