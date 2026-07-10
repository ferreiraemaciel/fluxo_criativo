/* ================================================================
   Tracker FMN — Sistema Screen
   Saúde das conexões · última sincronização · contadores · agendamento
   ================================================================ */
const { useState: useStateSys, useEffect: useEffectSys } = React;

// Automações que já rodam sozinhas na nuvem (Supabase Edge Functions + pg_cron),
// não dependem do Mac estar ligado. Ver supabase/functions/ + migrações 044/045/051/060.
const AUTOMACOES_NUVEM = [
  { nome: 'meta-sync',        frequencia: 'A cada 6h (+ 1x/dia varredura completa)', descricao: 'Métricas do Meta Ads (gasto, vendas, CPA)' },
  { nome: 'kanban-sync',      frequencia: 'A cada 15 min (+ 1x/dia reclassificação)', descricao: 'Status real do Meta, avanço Fazer/Fazendo → Ativos, agregados' },
  { nome: 'processar-pausas', frequencia: 'A cada 5 min',                            descricao: 'Executa pausas automáticas pendentes (alertas)' },
  { nome: 'drive-manutencao', frequencia: 'A cada 30 min',                           descricao: 'Cria pasta no Drive por anúncio, organiza arquivo solto' },
];

function SystemScreen() {
  const { CardKPI, SectionCard, TopBar, LucideIcon, Badge, Btn } = window;
  const [counts, setCounts]     = useStateSys(null);
  const [loading, setLoading]   = useStateSys(true);

  async function load() {
    if (!window.db) return;
    setLoading(true);

    async function count(table, filter) {
      let q = window.db.from(table).select('*', { count: 'exact', head: true });
      if (filter) q = filter(q);
      const { count } = await q;
      return count || 0;
    }

    const [
      adsTotal, adsAtivos, vendas, insights, despesas,
      adsComMidia, adsVinculados
    ] = await Promise.all([
      count('ads'),
      count('ads', q => q.eq('status', 'ativo')),
      count('vendas'),
      count('insights_cache'),
      count('despesas'),
      count('ads', q => q.not('media_files', 'eq', '[]')),
      count('ads', q => q.not('meta_ad_id', 'is', null)),
    ]);

    // última venda (proxy de saúde da fonte Hotmart)
    const { data: ultimaVenda } = await window.db.from('vendas')
      .select('created_at').order('created_at', { ascending: false }).limit(1);

    setCounts({
      adsTotal, adsAtivos, vendas, insights, despesas, adsComMidia, adsVinculados,
      ultimaVenda: ultimaVenda?.[0]?.created_at || null,
    });
    setLoading(false);
  }
  useEffectSys(() => { load(); }, []);

  function tempoRelativo(iso) {
    if (!iso) return 'nunca';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60)    return 'agora há pouco';
    if (diff < 3600)  return `há ${Math.floor(diff/60)} min`;
    if (diff < 86400) return `há ${Math.floor(diff/3600)} h`;
    return `há ${Math.floor(diff/86400)} dias`;
  }

  // Saúde das conexões (derivada dos dados)
  const conexoes = counts ? [
    { nome: 'Supabase',     ok: true,                          detalhe: 'Banco conectado' },
    { nome: 'Google Drive', ok: counts.adsComMidia > 0,        detalhe: `${counts.adsComMidia} ADs com mídia sincronizada` },
    { nome: 'Meta Ads',     ok: counts.insights > 0,           detalhe: `${counts.insights} registros de insights` },
    { nome: 'Hotmart',      ok: !!counts.ultimaVenda,          detalhe: counts.ultimaVenda ? `última venda ${tempoRelativo(counts.ultimaVenda)}` : 'sem vendas registradas' },
  ] : [];

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', width:'100%', overflow:'hidden' }}>
      <div style={{ height:'var(--topbar-h)', background:'var(--app-bg)',
        borderBottom:'1px solid var(--app-border)', padding:'0 24px',
        display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <span style={{ fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:14.5, color:'var(--text-1)' }}>Sistema</span>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Btn variant="ghost" size="sm" icon="database" onClick={load}>Recarregar dados</Btn>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'18px 24px', display:'flex',
        flexDirection:'column', gap:16, width:'100%', minWidth:0, boxSizing:'border-box' }}>

        {loading ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--text-3)', fontFamily:'Roboto,sans-serif' }}>Carregando...</div>
        ) : (
          <>
            {/* Conexões */}
            <SectionCard title="Conexões">
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                {conexoes.map(c => (
                  <div key={c.nome} style={{ padding:'14px 16px', borderRadius:10,
                    background:'var(--app-surface-2)', border:'1px solid var(--app-border)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                      <span style={{ width:9, height:9, borderRadius:'50%', flexShrink:0,
                        background: c.ok ? '#4ade80' : '#f87171',
                        boxShadow: c.ok ? '0 0 6px #4ade80' : '0 0 6px #f87171' }}/>
                      <span style={{ fontSize:13.5, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-1)' }}>{c.nome}</span>
                    </div>
                    <div style={{ fontSize:11.5, fontFamily:'Roboto,sans-serif', color:'var(--text-3)' }}>{c.detalhe}</div>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Contadores */}
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              <CardKPI label="ADs Total"        value={counts.adsTotal}       icon="layout-grid" accent/>
              <CardKPI label="ADs Ativos"        value={counts.adsAtivos}      icon="zap"/>
              <CardKPI label="ADs Vinculados"    value={counts.adsVinculados}  icon="link"/>
              <CardKPI label="Vendas"            value={counts.vendas}         icon="shopping-cart"/>
              <CardKPI label="Insights (cache)"  value={counts.insights}       icon="bar-chart-2"/>
              <CardKPI label="Despesas"          value={counts.despesas}       icon="receipt"/>
            </div>

            {/* Automações na nuvem */}
            <SectionCard title="Automações na Nuvem"
              headerRight={<span style={{ fontSize:11, color:'var(--text-3)', fontFamily:'Roboto,sans-serif' }}>
                Rodam sozinhas, não depende do Mac estar ligado
              </span>} noPad>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid var(--app-border)' }}>
                    {['Automação','Frequência','O que faz'].map((h,i)=>(
                      <th key={i} style={{ padding:'10px 16px', textAlign:'left',
                        fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
                        letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {AUTOMACOES_NUVEM.map((a,i) => (
                    <tr key={a.nome} style={{ borderBottom:i<AUTOMACOES_NUVEM.length-1?'1px solid var(--app-border)':'none' }}>
                      <td style={{ padding:'12px 16px', fontSize:13, fontFamily:'Roboto,sans-serif',
                        fontWeight:700, color:'var(--text-1)' }}>{a.nome}</td>
                      <td style={{ padding:'12px 16px', fontSize:12.5, color:'var(--text-2)', fontFamily:'Roboto,sans-serif' }}>
                        {a.frequencia}
                      </td>
                      <td style={{ padding:'12px 16px', fontSize:12, color:'var(--text-3)', fontFamily:'Roboto,sans-serif' }}>
                        {a.descricao}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>
          </>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { SystemScreen });
