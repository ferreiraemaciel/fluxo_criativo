/* ================================================================
   Tracker FMN — Site Screen v4
   Páginas do site + Conteúdos (posts) separados, filtros de período
   ================================================================ */
const { useState: useS, useEffect: useE } = React;

const FMN_URL = 'https://hmiyfywzumpttwzqiccu.supabase.co';
const FMN_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtaXlmeXd6dW1wdHR3enFpY2N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5MTE5OTYsImV4cCI6MjA5NzQ4Nzk5Nn0.E0a-kyu66wa7sFDYvWwIgKrQ5KqBVOgAbqeEWTvC-54';

const PAGES_CFG = [
  { slug: '_pg_home',        label: 'Home',       icon: 'home'      },
  { slug: '_pg_blog',        label: 'Conteúdos',  icon: 'book-open' },
  { slug: '_pg_palestras',   label: 'Palestras',  icon: 'mic'       },
  { slug: '_pg_para-voce',   label: 'Para Você',  icon: 'user'      },
  { slug: '_pg_resultados',  label: 'Resultados', icon: 'award'     },
];
const PAGE_SLUGS = new Set(PAGES_CFG.map(p => p.slug));

const PERIODOS = [
  { id:'hoje',   label:'Hoje'          },
  { id:'7d',     label:'7 dias'        },
  { id:'30d',    label:'30 dias'       },
  { id:'maximo', label:'Máximo'        },
  { id:'custom', label:'Personalizado' },
];

function rangeFrom(pid) {
  const now = new Date();
  if (pid === 'hoje') return now.toISOString().slice(0,10) + 'T00:00:00';
  if (pid === '7d')  { const d = new Date(now); d.setDate(d.getDate()-7);  return d.toISOString(); }
  if (pid === '30d') { const d = new Date(now); d.setDate(d.getDate()-30); return d.toISOString(); }
  return null;
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
}
function fmtTime(s) {
  if (!s || s < 2) return null;
  return s < 60 ? s+'s' : `${Math.floor(s/60)}m${s%60?` ${s%60}s`:''}`;
}
function fmtRelative(iso) {
  if (!iso) return '';
  const d = (Date.now() - new Date(iso))/1000;
  if (d < 60)    return 'agora';
  if (d < 3600)  return `há ${Math.floor(d/60)}min`;
  if (d < 86400) return `há ${Math.floor(d/3600)}h`;
  return `há ${Math.floor(d/86400)}d`;
}
function fmtRef(ref) {
  if (!ref) return 'Direto';
  if (/google/i.test(ref))    return 'Google';
  if (/instagram/i.test(ref)) return 'Instagram';
  if (/facebook/i.test(ref))  return 'Facebook';
  if (/whatsapp/i.test(ref))  return 'WhatsApp';
  try { return new URL(ref).hostname.replace('www.',''); } catch { return ref.slice(0,28); }
}

/* ── Mini componentes ────────────────────────────────────────────── */
function BarraProgressoSite({ pct, color='var(--fmn-gold)', h=3 }) {
  return (
    <div style={{height:h,borderRadius:2,background:'rgba(255,255,255,.07)',overflow:'hidden'}}>
      <div style={{height:'100%',width:Math.min(pct,100)+'%',borderRadius:2,background:color,transition:'width 350ms'}}/>
    </div>
  );
}

function Thumb({ src, titulo }) {
  const [err, setErr] = useS(false);
  if (!src || err) return (
    <div style={{width:44,height:33,borderRadius:5,flexShrink:0,background:'rgba(234,170,65,.07)',
      border:'1px solid rgba(234,170,65,.14)',display:'flex',alignItems:'center',justifyContent:'center',
      fontSize:13,fontWeight:700,color:'rgba(234,170,65,.4)',fontFamily:'Roboto,sans-serif'}}>
      {(titulo||'?')[0].toUpperCase()}
    </div>
  );
  return <img src={src} alt="" onError={()=>setErr(true)}
    style={{width:44,height:33,borderRadius:5,objectFit:'cover',flexShrink:0,
      border:'1px solid rgba(255,255,255,.07)'}}/>;
}

/* ── Screen ──────────────────────────────────────────────────────── */
function SiteScreen() {
  const { TopBar, LucideIcon, CardKPI, SectionCard } = window;

  const [periodo, setPeriodo] = useS('7d');
  const [cFrom,   setCFrom]   = useS('');
  const [cTo,     setCTo]     = useS('');
  const [sortBy,  setSortBy]  = useS('views');
  const [loading, setLoading] = useS(true);

  /* dados separados */
  const [pageRows, setPageRows] = useS([]);   /* site pages */
  const [postRows, setPostRows] = useS([]);   /* blog posts */
  const [events,   setEvents]   = useS([]);   /* individual events (para filtros de período) */
  const [fmnMeta,  setFmnMeta]  = useS({});   /* slug→{capa_url,titulo} do FMN */

  /* ── Carga ─────────────────────────────────────────────────────── */
  async function load(pid, cf, ct) {
    if (!window.db) return;
    setLoading(true);

    let allAgg = [], evData = [];

    if (pid === 'maximo') {
      const { data } = await window.db
        .from('site_post_views')
        .select('slug,titulo,views,last_view_at,capa_url')
        .order('views', { ascending: false });
      allAgg = data || [];
    } else {
      let q = window.db
        .from('site_post_view_events')
        .select('slug,titulo,viewed_at,referrer,device,session_id,read_time_s')
        .order('viewed_at', { ascending: false })
        .limit(10000);
      if (pid === 'custom') {
        if (cf) q = q.gte('viewed_at', cf+'T00:00:00');
        if (ct) q = q.lte('viewed_at', ct+'T23:59:59');
      } else {
        const from = rangeFrom(pid);
        if (from) q = q.gte('viewed_at', from);
      }
      const { data } = await q;
      evData = data || [];
      /* agrega eventos */
      const map = {};
      evData.forEach(e => {
        if (!map[e.slug]) map[e.slug] = { slug:e.slug, titulo:e.titulo, views:0, last_view_at:e.viewed_at, capa_url:null, _times:[] };
        map[e.slug].views++;
        if (e.viewed_at > map[e.slug].last_view_at) map[e.slug].last_view_at = e.viewed_at;
        if (e.titulo && !map[e.slug].titulo) map[e.slug].titulo = e.titulo;
        if (e.read_time_s > 1) map[e.slug]._times.push(e.read_time_s);
      });
      allAgg = Object.values(map);
    }

    /* separa páginas × posts */
    const pg = PAGES_CFG.map(cfg => {
      const found = allAgg.find(r => r.slug === cfg.slug);
      return { ...cfg, views: found?.views || 0, last_view_at: found?.last_view_at || null };
    });
    const po = allAgg
      .filter(r => !PAGE_SLUGS.has(r.slug))
      .sort((a, b) => (b.views||0) - (a.views||0));

    setPageRows(pg);
    setPostRows(po);
    setEvents(evData);
    setLoading(false);

    /* thumbnails dos posts via FMN Supabase */
    const slugs = po.map(p => p.slug).filter(Boolean);
    if (slugs.length) {
      try {
        const r = await fetch(
          `${FMN_URL}/rest/v1/posts?slug=in.(${slugs.join(',')})&site=eq.fmn&select=slug,titulo,capa_url&limit=200`,
          { headers: { apikey: FMN_KEY, Authorization: `Bearer ${FMN_KEY}` } }
        );
        const meta = await r.json();
        const m = {};
        (Array.isArray(meta)?meta:[]).forEach(p => { m[p.slug] = p; });
        setFmnMeta(m);
      } catch(_) {}
    }
  }

  useE(() => { load(periodo, cFrom, cTo); }, [periodo]);

  /* ── Derivados ─────────────────────────────────────────────────── */
  const totalPageViews = pageRows.reduce((s,p) => s+(p.views||0), 0);
  const totalPostViews = postRows.reduce((s,p) => s+(p.views||0), 0);
  const totalViews     = totalPageViews + totalPostViews;

  const mobile    = events.filter(e => e.device==='mobile').length;
  const totalDev  = events.filter(e => e.device).length || 1;
  const mobilePct = Math.round(mobile/totalDev*100);

  const allTimes  = events.filter(e => e.read_time_s>1 && !PAGE_SLUGS.has(e.slug)).map(e => e.read_time_s);
  const avgTime   = allTimes.length ? Math.round(allTimes.reduce((a,b)=>a+b,0)/allTimes.length) : null;

  const refMap = {};
  events.forEach(e => { const l=fmtRef(e.referrer); refMap[l]=(refMap[l]||0)+1; });
  const topRefs  = Object.entries(refMap).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const maxRef   = topRefs[0]?.[1]||1;

  /* sessões — caminho do leitor */
  const sessMap = {};
  events.forEach(e => {
    if (!e.session_id) return;
    if (!sessMap[e.session_id]) sessMap[e.session_id] = [];
    sessMap[e.session_id].push(e);
  });
  const sessions = Object.values(sessMap)
    .map(evts => evts.sort((a,b)=>new Date(a.viewed_at)-new Date(b.viewed_at)))
    .sort((a,b)=>new Date(b[0].viewed_at)-new Date(a[0].viewed_at))
    .slice(0,10);

  const maxPageViews = Math.max(...pageRows.map(p=>p.views||0), 1);
  const maxPostViews = postRows.length ? Math.max(...postRows.map(p=>p.views||0)) : 1;

  const sortedPosts = [...postRows].sort((a,b) => {
    if (sortBy==='views')   return (b.views||0)-(a.views||0);
    if (sortBy==='recente') return new Date(b.last_view_at)-new Date(a.last_view_at);
    return (a.titulo||a.slug).localeCompare(b.titulo||b.slug,'pt-BR');
  });

  /* ── Barra de período ──────────────────────────────────────────── */
  const PeriodBar = (
    <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
      {PERIODOS.map(p=>(
        <button key={p.id} onClick={()=>setPeriodo(p.id)}
          style={{padding:'5px 12px',borderRadius:6,cursor:'pointer',fontSize:11.5,
            fontFamily:'Roboto,sans-serif',fontWeight:600,border:'1px solid',transition:'all 130ms',
            background:periodo===p.id?'rgba(234,170,65,.12)':'transparent',
            borderColor:periodo===p.id?'rgba(234,170,65,.35)':'rgba(255,255,255,.1)',
            color:periodo===p.id?'var(--fmn-gold)':'rgba(255,255,255,.4)'}}>
          {p.label}
        </button>
      ))}
      {periodo==='custom'&&(
        <div style={{display:'flex',gap:5,alignItems:'center'}}>
          <input type="date" value={cFrom} onChange={e=>setCFrom(e.target.value)}
            style={{background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.12)',
              borderRadius:5,color:'rgba(255,255,255,.8)',fontSize:11.5,padding:'4px 7px',
              fontFamily:'Roboto,sans-serif'}}/>
          <span style={{color:'rgba(255,255,255,.3)',fontSize:11}}>até</span>
          <input type="date" value={cTo} onChange={e=>setCTo(e.target.value)}
            style={{background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.12)',
              borderRadius:5,color:'rgba(255,255,255,.8)',fontSize:11.5,padding:'4px 7px',
              fontFamily:'Roboto,sans-serif'}}/>
          <button onClick={()=>load('custom',cFrom,cTo)}
            style={{padding:'4px 10px',borderRadius:5,cursor:'pointer',fontSize:11,
              fontFamily:'Roboto,sans-serif',fontWeight:700,border:'1px solid rgba(234,170,65,.35)',
              background:'rgba(234,170,65,.1)',color:'var(--fmn-gold)'}}>Buscar</button>
        </div>
      )}
      <button onClick={()=>load(periodo,cFrom,cTo)}
        style={{padding:'5px 9px',borderRadius:6,cursor:'pointer',fontSize:11,
          fontFamily:'Roboto,sans-serif',border:'1px solid rgba(255,255,255,.1)',
          background:'transparent',color:'rgba(255,255,255,.32)',
          display:'flex',alignItems:'center',gap:4}}>
        <LucideIcon icon="refresh-cw" size={10}/>Atualizar
      </button>
    </div>
  );

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflowY:'auto'}}>
      <TopBar title="Site" actions={PeriodBar}/>

      <div style={{flex:1,padding:'20px 28px',display:'flex',flexDirection:'column',gap:16}}>

        {/* KPIs */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
          <CardKPI label="Total de views"       value={loading?'…':totalViews.toLocaleString('pt-BR')}      icon="eye"/>
          <CardKPI label="Views nas páginas"    value={loading?'…':totalPageViews.toLocaleString('pt-BR')} icon="layout"/>
          <CardKPI label="Views nos conteúdos"  value={loading?'…':totalPostViews.toLocaleString('pt-BR')} icon="file-text"/>
          <CardKPI label="Celular vs Desktop"   value={loading||!events.length?'—':`${mobilePct}% / ${100-mobilePct}%`} icon="smartphone"/>
        </div>

        {/* Grade principal */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 296px',gap:16,alignItems:'start'}}>

          {/* Coluna central: Páginas + Conteúdos */}
          <div style={{display:'flex',flexDirection:'column',gap:16}}>

            {/* ── PÁGINAS ──────────────────────────────────────────── */}
            <SectionCard title="Páginas do site">
              {loading ? (
                <div style={{textAlign:'center',padding:'20px 0',color:'rgba(255,255,255,.28)',
                  fontSize:12.5,fontFamily:'Roboto,sans-serif'}}>Carregando...</div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:0}}>
                  {/* Header */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 70px 120px',
                    gap:12,padding:'5px 8px',marginBottom:4,fontSize:9.5,
                    fontFamily:'Roboto,sans-serif',fontWeight:700,letterSpacing:'.07em',
                    textTransform:'uppercase',color:'rgba(255,255,255,.24)',
                    borderBottom:'1px solid rgba(255,255,255,.05)'}}>
                    <span>Página</span>
                    <span style={{textAlign:'right'}}>Views</span>
                    <span style={{textAlign:'right'}}>Última visita</span>
                  </div>
                  {pageRows.map((pg, i) => (
                    <div key={pg.slug}
                      style={{display:'grid',gridTemplateColumns:'1fr 70px 120px',
                        gap:12,padding:'9px 8px',borderRadius:7,alignItems:'center',
                        background:i%2===0?'rgba(255,255,255,.02)':'transparent',transition:'background 100ms'}}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(234,170,65,.05)'}
                      onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'rgba(255,255,255,.02)':'transparent'}>
                      <div style={{minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:5}}>
                          <LucideIcon icon={pg.icon} size={13} color={pg.views>0?'var(--fmn-gold)':'rgba(255,255,255,.25)'}/>
                          <span style={{fontSize:13,fontFamily:'Roboto,sans-serif',fontWeight:500,
                            color:pg.views>0?'rgba(255,255,255,.85)':'rgba(255,255,255,.3)'}}>{pg.label}</span>
                        </div>
                        <BarraProgressoSite pct={Math.round((pg.views||0)/maxPageViews*100)}/>
                      </div>
                      <div style={{fontSize:14,fontFamily:'Roboto,sans-serif',fontWeight:700,
                        color:pg.views>0?'var(--fmn-gold)':'rgba(255,255,255,.2)',textAlign:'right'}}>
                        {(pg.views||0).toLocaleString('pt-BR')}
                      </div>
                      <div style={{fontSize:11,fontFamily:'Roboto,sans-serif',
                        color:'rgba(255,255,255,.35)',textAlign:'right'}}>
                        {pg.last_view_at ? fmtDate(pg.last_view_at) : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* ── CONTEÚDOS ────────────────────────────────────────── */}
            <SectionCard title={`Artigos (${postRows.length})`}
              headerRight={
                <div style={{display:'flex',gap:5}}>
                  {[['views','Mais visto'],['recente','Recente'],['alfa','A–Z']].map(([id,lbl])=>(
                    <button key={id} onClick={()=>setSortBy(id)}
                      style={{padding:'4px 9px',borderRadius:5,cursor:'pointer',fontSize:10.5,
                        fontFamily:'Roboto,sans-serif',fontWeight:600,letterSpacing:'.03em',border:'1px solid',
                        background:sortBy===id?'rgba(234,170,65,.1)':'transparent',
                        borderColor:sortBy===id?'rgba(234,170,65,.28)':'rgba(255,255,255,.08)',
                        color:sortBy===id?'var(--fmn-gold)':'rgba(255,255,255,.32)',transition:'all 130ms'}}>
                      {lbl}
                    </button>
                  ))}
                </div>
              }>
              {loading ? (
                <div style={{textAlign:'center',padding:'28px 0',color:'rgba(255,255,255,.28)',
                  fontSize:12.5,fontFamily:'Roboto,sans-serif'}}>Carregando...</div>
              ) : postRows.length===0 ? (
                <div style={{textAlign:'center',padding:'28px 0',color:'rgba(255,255,255,.28)',
                  fontSize:12.5,fontFamily:'Roboto,sans-serif',lineHeight:1.7}}>
                  Nenhum post visitado neste período.<br/>
                  <span style={{fontSize:11.5}}>Tente "Máximo" para o histórico completo.</span>
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:0}}>
                  {/* Header */}
                  <div style={{display:'grid',gridTemplateColumns:'44px 1fr 64px 70px 110px 28px',
                    gap:10,padding:'5px 8px',marginBottom:4,fontSize:9.5,
                    fontFamily:'Roboto,sans-serif',fontWeight:700,letterSpacing:'.07em',
                    textTransform:'uppercase',color:'rgba(255,255,255,.24)',
                    borderBottom:'1px solid rgba(255,255,255,.05)'}}>
                    <span/>
                    <span>Post</span>
                    <span style={{textAlign:'right'}}>Views</span>
                    <span style={{textAlign:'right'}}>Tempo</span>
                    <span style={{textAlign:'right'}}>Última visita</span>
                    <span/>
                  </div>
                  {sortedPosts.map((post, i) => {
                    const meta   = fmnMeta[post.slug]||{};
                    const thumb  = meta.capa_url||post.capa_url||null;
                    const titulo = meta.titulo||post.titulo||post.slug;
                    const pct    = Math.round((post.views||0)/maxPostViews*100);
                    const avgT   = post._times?.length
                      ? Math.round(post._times.reduce((a,b)=>a+b,0)/post._times.length) : null;
                    const url    = `https://www.fotografiaeomeunegocio.com.br/post.html?slug=${encodeURIComponent(post.slug)}`;
                    return (
                      <div key={post.slug}
                        style={{display:'grid',gridTemplateColumns:'44px 1fr 64px 70px 110px 28px',
                          gap:10,padding:'8px 8px',borderRadius:7,alignItems:'center',
                          background:i%2===0?'rgba(255,255,255,.018)':'transparent',transition:'background 100ms'}}
                        onMouseEnter={e=>e.currentTarget.style.background='rgba(234,170,65,.05)'}
                        onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'rgba(255,255,255,.018)':'transparent'}>
                        <Thumb src={thumb} titulo={titulo}/>
                        <div style={{minWidth:0}}>
                          <div style={{fontSize:12.5,fontFamily:'Roboto,sans-serif',fontWeight:500,
                            color:'rgba(255,255,255,.82)',whiteSpace:'nowrap',overflow:'hidden',
                            textOverflow:'ellipsis',marginBottom:4}}>{titulo}</div>
                          <BarraProgressoSite pct={pct}/>
                        </div>
                        <div style={{fontSize:14,fontFamily:'Roboto,sans-serif',fontWeight:700,
                          color:'var(--fmn-gold)',textAlign:'right'}}>
                          {(post.views||0).toLocaleString('pt-BR')}
                        </div>
                        <div style={{fontSize:11.5,fontFamily:'Roboto,sans-serif',
                          color:avgT?'rgba(255,255,255,.5)':'rgba(255,255,255,.2)',textAlign:'right'}}>
                          {avgT?fmtTime(avgT):'—'}
                        </div>
                        <div style={{fontSize:11,fontFamily:'Roboto,sans-serif',
                          color:'rgba(255,255,255,.35)',textAlign:'right'}}>
                          {fmtDate(post.last_view_at)}
                        </div>
                        <a href={url} target="_blank" rel="noopener"
                          style={{display:'flex',alignItems:'center',justifyContent:'center',
                            width:24,height:24,borderRadius:5,background:'rgba(255,255,255,.04)',
                            border:'1px solid rgba(255,255,255,.08)',color:'rgba(255,255,255,.3)',
                            textDecoration:'none',transition:'all 130ms'}}
                          onMouseEnter={e=>{e.currentTarget.style.background='rgba(234,170,65,.12)';e.currentTarget.style.color='var(--fmn-gold)';}}
                          onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,.04)';e.currentTarget.style.color='rgba(255,255,255,.3)';}}>
                          <LucideIcon icon="external-link" size={11}/>
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>

          {/* ── Coluna lateral ─────────────────────────────────────── */}
          <div style={{display:'flex',flexDirection:'column',gap:14}}>

            {/* Dispositivo */}
            <SectionCard title="Dispositivo">
              {!events.length ? (
                <div style={{fontSize:11.5,color:'rgba(255,255,255,.28)',fontFamily:'Roboto,sans-serif',
                  textAlign:'center',padding:'14px 0'}}>
                  {periodo==='maximo'?'Filtre por período':'Sem dados'}
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {[['Celular',mobilePct,'#60a5fa'],['Desktop',100-mobilePct,'#a78bfa']].map(([l,pct,c])=>(
                    <div key={l}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                        <span style={{fontSize:12,fontFamily:'Roboto,sans-serif',color:'rgba(255,255,255,.58)'}}>{l}</span>
                        <span style={{fontSize:12,fontFamily:'Roboto,sans-serif',fontWeight:700,color:c}}>{pct}%</span>
                      </div>
                      <BarraProgressoSite pct={pct} color={c}/>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Origens */}
            <SectionCard title="De onde vieram">
              {!topRefs.length ? (
                <div style={{fontSize:11.5,color:'rgba(255,255,255,.28)',fontFamily:'Roboto,sans-serif',
                  textAlign:'center',padding:'14px 0'}}>
                  {periodo==='maximo'?'Filtre por período':'Sem dados'}
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {topRefs.map(([label,count])=>(
                    <div key={label}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                        <span style={{fontSize:11.5,fontFamily:'Roboto,sans-serif',color:'rgba(255,255,255,.6)',
                          overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'68%'}}>{label}</span>
                        <span style={{fontSize:11.5,fontFamily:'Roboto,sans-serif',fontWeight:700,
                          color:'rgba(255,255,255,.45)',flexShrink:0}}>
                          {count} <span style={{color:'rgba(255,255,255,.22)',fontWeight:400}}>
                            ({Math.round(count/events.length*100)}%)
                          </span>
                        </span>
                      </div>
                      <BarraProgressoSite pct={Math.round(count/maxRef*100)} color="rgba(234,170,65,.5)"/>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Caminho dos leitores */}
            <SectionCard title="Caminho dos leitores">
              {!sessions.length ? (
                <div style={{fontSize:11.5,color:'rgba(255,255,255,.28)',fontFamily:'Roboto,sans-serif',
                  textAlign:'center',padding:'14px 0',lineHeight:1.6}}>
                  {periodo==='maximo'?'Filtre por período':'Dados nas próximas visitas'}
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {sessions.map((evts,i)=>{
                    const first = evts[0];
                    return (
                      <div key={i} style={{borderLeft:'2px solid rgba(234,170,65,.18)',paddingLeft:10}}>
                        <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:5}}>
                          <LucideIcon icon={first.device==='desktop'?'monitor':'smartphone'} size={11} color="rgba(255,255,255,.28)"/>
                          <span style={{fontSize:10.5,fontFamily:'Roboto,sans-serif',color:'rgba(255,255,255,.28)'}}>
                            {fmtRelative(first.viewed_at)}
                          </span>
                          {evts.length>1&&(
                            <span style={{fontSize:10,fontFamily:'Roboto,sans-serif',color:'rgba(234,170,65,.5)',
                              background:'rgba(234,170,65,.08)',borderRadius:4,padding:'1px 5px'}}>
                              {evts.length} páginas
                            </span>
                          )}
                        </div>
                        {evts.map((e,j)=>{
                          const isPage = PAGE_SLUGS.has(e.slug);
                          const pageCfg = PAGES_CFG.find(p=>p.slug===e.slug);
                          const meta  = fmnMeta[e.slug]||{};
                          const thumb = isPage ? null : (meta.capa_url||null);
                          const label = isPage
                            ? (pageCfg?.label||e.slug)
                            : (meta.titulo||e.titulo||e.slug);
                          return (
                            <div key={j} style={{display:'flex',alignItems:'center',gap:6,
                              marginBottom:j<evts.length-1?5:0}}>
                              {j>0&&<div style={{width:8,height:1,background:'rgba(255,255,255,.1)',flexShrink:0}}/>}
                              {isPage
                                ? <LucideIcon icon={pageCfg?.icon||'globe'} size={12} color="rgba(234,170,65,.4)"/>
                                : thumb
                                  ? <img src={thumb} alt="" style={{width:20,height:15,objectFit:'cover',borderRadius:3,flexShrink:0}}/>
                                  : <LucideIcon icon="file-text" size={12} color="rgba(255,255,255,.2)"/>
                              }
                              <span style={{fontSize:11,fontFamily:'Roboto,sans-serif',color:'rgba(255,255,255,.6)',
                                overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{label}</span>
                              {e.read_time_s>1&&(
                                <span style={{fontSize:10,fontFamily:'Roboto,sans-serif',color:'rgba(255,255,255,.26)',flexShrink:0}}>
                                  {fmtTime(e.read_time_s)}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SiteScreen });
