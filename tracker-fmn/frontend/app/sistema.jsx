/* ================================================================
   Tracker FMN — Sistema Screen
   Saúde das conexões · última sincronização · contadores · agendamento
   ================================================================ */
const { useState: useStateSys, useEffect: useEffectSys } = React;

function SystemScreen() {
  const { CardKPI, SectionCard, TopBar, LucideIcon, Badge, Btn } = window;
  const [counts, setCounts]     = useStateSys(null);
  const [syncs, setSyncs]       = useStateSys([]);
  const [loading, setLoading]   = useStateSys(true);
  const [syncing, setSyncing]   = useStateSys(false);
  const [syncMsg, setSyncMsg]   = useStateSys(null);

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

    // última venda e último insight (proxy de saúde das fontes)
    const { data: ultimaVenda } = await window.db.from('vendas')
      .select('created_at').order('created_at', { ascending: false }).limit(1);
    const { data: syncStatus } = await window.db.from('sync_status')
      .select('script,last_run,status,message,duration_s').order('script');

    setCounts({
      adsTotal, adsAtivos, vendas, insights, despesas, adsComMidia, adsVinculados,
      ultimaVenda: ultimaVenda?.[0]?.created_at || null,
    });
    setSyncs(syncStatus || []);
    setLoading(false);
  }
  useEffectSys(() => { load(); }, []);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg('Sincronizando... pode levar até 3 minutos.');
    try {
      const res = await fetch('http://localhost:3030/api/sync', { method: 'POST' });
      if (res.status === 202) {
        setSyncMsg('Sincronização iniciada. Aguarde 2-3 minutos e clique em Atualizar.');
        // Recarrega os dados após 15s (picks up sync_status updates)
        setTimeout(() => { load(); setSyncMsg(null); }, 15000);
      } else {
        setSyncMsg('Erro ao acionar o servidor local. Certifique-se de que o serve.py está rodando.');
      }
    } catch(e) {
      setSyncMsg('Servidor local não acessível. Rode: python3 frontend/serve.py');
    } finally {
      setSyncing(false);
    }
  }

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

  const scriptLabels = {
    'drive_sync_pastas.py': 'Criar pastas no Drive',
    'drive_organizar.py':   'Organizar arquivos soltos',
    'sync_drive.py':        'Vincular mídia do Drive',
    'sync_hotmart.py':      'Sincronizar vendas Hotmart',
    'sync_insights.py':     'Puxar insights do Meta',
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', width:'100%', overflow:'hidden' }}>
      <div style={{ height:'var(--topbar-h)', background:'var(--app-bg)',
        borderBottom:'1px solid var(--app-border)', padding:'0 24px',
        display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <span style={{ fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:14.5, color:'var(--text-1)' }}>Sistema</span>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {syncMsg && (
            <span style={{ fontSize:11.5, fontFamily:'Roboto,sans-serif',
              color: syncMsg.startsWith('Erro') || syncMsg.startsWith('Servidor') ? '#f87171' : 'var(--fmn-gold)',
              maxWidth:340 }}>{syncMsg}</span>
          )}
          <Btn variant="primary" size="sm" icon="refresh-cw"
            onClick={handleSync} disabled={syncing}>
            {syncing ? 'Sincronizando...' : 'Atualizar'}
          </Btn>
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

            {/* Última sincronização */}
            <SectionCard title="Última Sincronização"
              headerRight={<span style={{ fontSize:11, color:'var(--text-3)', fontFamily:'Roboto,sans-serif' }}>
                Roda automaticamente a cada 5 minutos
              </span>} noPad>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid var(--app-border)' }}>
                    {['Tarefa','Status','Quando','Duração','Resultado'].map((h,i)=>(
                      <th key={i} style={{ padding:'10px 16px', textAlign:i>=3?'right':'left',
                        fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
                        letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {syncs.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding:'24px 16px', textAlign:'center',
                      fontSize:12.5, color:'var(--text-3)', fontFamily:'Roboto,sans-serif' }}>
                      Nenhuma sincronização registrada ainda. Aguarde o próximo ciclo (5 min) ou rode o runner manualmente.
                    </td></tr>
                  ) : syncs.map((s,i) => (
                    <tr key={s.script} style={{ borderBottom:i<syncs.length-1?'1px solid var(--app-border)':'none' }}>
                      <td style={{ padding:'12px 16px', fontSize:13, fontFamily:'Roboto,sans-serif',
                        fontWeight:700, color:'var(--text-1)' }}>{scriptLabels[s.script] || s.script}</td>
                      <td style={{ padding:'12px 16px' }}>
                        <Badge tone={s.status==='ok'?'success':'danger'} dot>{s.status==='ok'?'OK':'Erro'}</Badge>
                      </td>
                      <td style={{ padding:'12px 16px', fontSize:12.5, color:'var(--text-2)', fontFamily:'Roboto,sans-serif' }}>
                        {tempoRelativo(s.last_run)}
                      </td>
                      <td style={{ padding:'12px 16px', textAlign:'right', fontSize:12.5, color:'var(--text-3)', fontFamily:'Roboto,sans-serif' }}>
                        {s.duration_s != null ? `${s.duration_s}s` : '—'}
                      </td>
                      <td style={{ padding:'12px 16px', textAlign:'right', fontSize:11.5, color:'var(--text-3)',
                        fontFamily:'Roboto,sans-serif', maxWidth:280, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {s.message || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>

            {/* Agendamento / comandos manuais */}
            <SectionCard title="Agendamento e Comandos Manuais">
              <div style={{ fontSize:12.5, fontFamily:'Roboto,sans-serif', color:'var(--text-2)', lineHeight:1.7 }}>
                <p style={{ margin:'0 0 10px' }}>
                  O tracker se atualiza sozinho a cada 5 minutos (cron no Mac), rodando todos os syncs em sequência.
                  Para forçar uma atualização agora, rode no terminal:
                </p>
                <div style={{ background:'var(--app-surface-2)', border:'1px solid var(--app-border)',
                  borderRadius:8, padding:'12px 14px', fontFamily:'monospace', fontSize:12, color:'var(--text-1)' }}>
                  <div>cd tracker-fmn</div>
                  <div>python3 scripts/sync_runner.py</div>
                </div>
                <p style={{ margin:'12px 0 0', fontSize:11.5, color:'var(--text-3)' }}>
                  Insights do Meta no modo recorrente atualizam só os ADs ativos. Para recarregar o histórico
                  completo: <code style={{ fontFamily:'monospace' }}>python3 scripts/sync_insights.py --all</code>
                </p>
              </div>
            </SectionCard>
          </>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { SystemScreen });
