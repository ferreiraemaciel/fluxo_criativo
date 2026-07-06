/* ================================================================
   Tracker FMN — App Entry Point v4
   AdsDetail agora é modal interno do KanbanScreen
   ================================================================ */
(function tryMount() {
  const DEPS = [
    'LucideIcon','Btn','Badge','CardKPI','SectionCard','Sidebar','TopBar',
    'DashboardScreen','KanbanScreen','FinancialScreen',
    'IdeiaScreen','OrganicoScreen','TrafficScreen','FunisScreen','SystemScreen','SiteScreen'
  ];
  if (DEPS.some(d => !window[d])) { setTimeout(tryMount, 80); return; }

  const { useState } = React;
  const {
    Sidebar, TopBar, LucideIcon,
    DashboardScreen, KanbanScreen,
    FinancialScreen, IdeiaScreen, OrganicoScreen, TrafficScreen, FunisScreen, AutomacaoScreen, SystemScreen, SiteScreen
  } = window;

  function PlaceholderScreen({ title, icon }) {
    return (
      <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
        <TopBar title={title}/>
        <div style={{ flex:1, display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center', gap:16, color:'var(--text-3)' }}>
          <div style={{ width:64, height:64, borderRadius:16, background:'rgba(255,255,255,.04)',
            border:'1px solid var(--app-border)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <LucideIcon icon={icon||'construction'} size={28}/>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:15, fontFamily:'Roboto,sans-serif', fontWeight:700,
              color:'var(--text-2)', marginBottom:6 }}>{title}</div>
            <div style={{ fontSize:12.5, fontFamily:'Roboto,sans-serif', color:'var(--text-3)' }}>
              Em desenvolvimento
            </div>
          </div>
        </div>
      </div>
    );
  }

  function App() {
    const [screen, setScreen]               = useState('dashboard');
    const [period, setPeriod]               = useState('7d');
    const [dateRange, setDateRange]         = useState({ from:'2026-06-03', to:'2026-06-10' });
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [targetAd, setTargetAd]           = useState(null);

    const navigate = (pg, ad = null) => { setScreen(pg); if (ad != null) setTargetAd(ad); };

    const currentScreen = (() => {
      switch (screen) {
        case 'dashboard':  return <DashboardScreen period={period} onPeriodChange={setPeriod} dateRange={dateRange} onDateRangeChange={setDateRange} onNavigate={navigate}/>;
        case 'ideias':     return <IdeiaScreen/>;
        case 'organico':   return <OrganicoScreen/>;
        case 'criativos':  return <KanbanScreen targetAd={targetAd} onConsumeTarget={() => setTargetAd(null)}/>;
        case 'trafego':    return <TrafficScreen/>;
        case 'funis':      return <FunisScreen onNavigate={navigate}/>;
        case 'financeiro': return <FinancialScreen/>;
        case 'site':       return <SiteScreen/>;
        case 'sistema':    return <SystemScreen/>;
        default:           return <DashboardScreen period={period} onPeriodChange={setPeriod} dateRange={dateRange} onDateRangeChange={setDateRange}/>;
      }
    })();

    return (
      <div style={{ display:'flex', width:'100%', height:'100vh', overflow:'hidden', background:'var(--app-bg)' }}>
        <Sidebar activePage={screen} onNavigate={navigate}
          collapsed={sidebarCollapsed} onToggle={()=>setSidebarCollapsed(p=>!p)}/>
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
          {currentScreen}
        </div>
      </div>
    );
  }

  /* Só monta a aplicação depois que a autenticação confirmar (auth.js chama). */
  window.__renderTracker = () => ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
  if (window.__trackerAuthed) window.__renderTracker();
})();
