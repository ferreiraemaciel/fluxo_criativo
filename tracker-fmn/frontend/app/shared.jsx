/* ================================================================
   Tracker FMN — Shared UI Components v4
   Fix: header 60px alinhado · colapso no header · ordem de abas
   ================================================================ */
const { useState, useEffect, useRef } = React;

/* ── Formatador de moeda global ────────────────────────────────── */
const _brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function fmtBRL(n) {
  if (n == null || n === '' || isNaN(Number(n))) return '—';
  return _brl.format(Number(n));
}

/* ── Icon ──────────────────────────────────────────────────────── */
function LucideIcon({ icon, size = 18, color, style = {} }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.lucide) return;
    el.innerHTML = '';
    const i = document.createElement('i');
    i.setAttribute('data-lucide', icon);
    i.style.width = size + 'px';
    i.style.height = size + 'px';
    i.style.strokeWidth = '1.75';
    el.appendChild(i);
    window.lucide.createIcons({ nodes: [i] });
  }, [icon, size]);
  return (
    <span ref={ref} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, flexShrink: 0, color: color || 'currentColor', ...style
    }} />
  );
}

/* ── Button ──────────────────────────────────────────────────────*/
function Btn({ variant = 'primary', size = 'md', children, onClick, style = {}, icon, disabled }) {
  const [pressed, setPressed] = useState(false);
  const sizes = {
    sm: { p: '7px 13px', fs: 11, gap: 5, is: 13 },
    md: { p: '9px 16px', fs: 12.5, gap: 6, is: 15 },
    lg: { p: '12px 22px', fs: 13.5, gap: 7, is: 17 },
  };
  const variants = {
    primary:   { background: 'var(--fmn-gold)',              color: 'var(--fmn-black)',  border: '1.5px solid var(--fmn-gold)' },
    secondary: { background: 'transparent',                  color: 'var(--fmn-gold)',   border: '1.5px solid rgba(234,170,65,.45)' },
    ghost:     { background: 'rgba(255,255,255,.06)',         color: 'var(--text-1)',     border: '1.5px solid var(--app-border)' },
    danger:    { background: 'rgba(248,113,113,.1)',          color: 'var(--clr-neg)',    border: '1.5px solid rgba(248,113,113,.25)' },
    meta:      { background: '#1877f2',                       color: '#fff',              border: '1.5px solid #1877f2' },
  };
  const s = sizes[size] || sizes.md;
  const v = variants[variant] || variants.ghost;
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: s.gap, padding: s.p,
        fontSize: s.fs, fontFamily: 'Roboto, sans-serif', fontWeight: 700,
        letterSpacing: '0.04em', textTransform: 'uppercase',
        borderRadius: 8, cursor: disabled ? 'default' : 'pointer',
        transition: 'all 150ms var(--ease-out)',
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        opacity: disabled ? 0.45 : 1, whiteSpace: 'nowrap',
        ...v, ...style
      }}>
      {icon && <LucideIcon icon={icon} size={s.is} />}
      {children}
    </button>
  );
}

/* ── Badge ───────────────────────────────────────────────────────*/
function Badge({ children, tone = 'default', dot = false, style = {} }) {
  const tones = {
    default:  { background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.62)' },
    gold:     { background: 'rgba(234,170,65,.15)',  color: 'var(--fmn-gold)' },
    success:  { background: 'rgba(74,222,128,.12)',  color: 'var(--clr-pos)' },
    danger:   { background: 'rgba(248,113,113,.12)', color: 'var(--clr-neg)' },
    warning:  { background: 'rgba(251,191,36,.12)',  color: 'var(--clr-warn)' },
    info:     { background: 'rgba(96,165,250,.12)',  color: 'var(--clr-info)' },
    teal:     { background: 'rgba(52,211,153,.12)',  color: 'var(--clr-teal)' },
    amber:    { background: 'rgba(245,158,11,.12)',  color: '#f59e0b' },
    reels:    { background: 'rgba(234,170,65,.12)',  color: 'var(--fmn-gold)' },
    image:    { background: 'rgba(96,165,250,.12)',  color: 'var(--clr-info)' },
    carousel: { background: 'rgba(52,211,153,.12)',  color: 'var(--clr-teal)' },
  };
  const t = tones[tone] || tones.default;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 999,
      fontSize: 10, fontFamily: 'Roboto, sans-serif', fontWeight: 700,
      letterSpacing: '0.1em', textTransform: 'uppercase',
      flexShrink: 0, ...t, ...style
    }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />}
      {children}
    </span>
  );
}

/* ── CardKPI ─────────────────────────────────────────────────────*/
function CardKPI({ label, value, delta, deltaLabel, icon, accent = false }) {
  const isStr = typeof delta === 'string';
  const deltaPos = isStr ? delta.startsWith('+') : (typeof delta === 'number' ? delta >= 0 : true);
  const dc = deltaPos ? 'var(--clr-pos)' : 'var(--clr-neg)';
  const db = deltaPos ? 'var(--clr-pos-bg)' : 'var(--clr-neg-bg)';
  const dv = typeof delta === 'number' ? `${delta >= 0 ? '+' : ''}${delta}%` : delta;
  return (
    <div style={{
      flex: 1, minWidth: 0, background: 'var(--app-surface)',
      border: `1px solid ${accent ? 'rgba(234,170,65,.2)' : 'var(--app-border)'}`,
      borderRadius: 14, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10.5, fontFamily: 'Roboto, sans-serif', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-2)' }}>
          {label}
        </span>
        {icon && (
          <div style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0,
            background: accent ? 'rgba(234,170,65,.1)' : 'rgba(255,255,255,.05)',
            color: accent ? 'var(--fmn-gold)' : 'var(--text-3)' }}>
            <LucideIcon icon={icon} size={14} />
          </div>
        )}
      </div>
      <div style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 900, fontSize: 24,
        letterSpacing: '-0.02em', lineHeight: 1.1,
        color: accent ? 'var(--fmn-gold)' : 'var(--text-1)' }}>
        {value}
      </div>
      {delta !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '2px 7px', borderRadius: 6, fontSize: 10.5,
            fontFamily: 'Roboto, sans-serif', fontWeight: 700, background: db, color: dc }}>
            <LucideIcon icon={deltaPos ? 'trending-up' : 'trending-down'} size={10} />
            {dv}
          </span>
          {deltaLabel && <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{deltaLabel}</span>}
        </div>
      )}
    </div>
  );
}

/* ── SectionCard ─────────────────────────────────────────────────*/
function SectionCard({ title, children, style = {}, headerRight, noPad = false }) {
  return (
    <div style={{
      background: 'var(--app-surface)',
      borderRadius: 14, overflow: 'hidden', ...style
    }}>
      {title && (
        <div style={{ padding: '12px 18px 8px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12.5, fontFamily: 'Roboto, sans-serif', fontWeight: 700,
            letterSpacing: '0.02em', color: 'var(--text-1)' }}>{title}</span>
          {headerRight}
        </div>
      )}
      <div style={noPad ? {} : { padding: '10px 18px 18px' }}>{children}</div>
    </div>
  );
}

/* ── Divider ─────────────────────────────────────────────────────*/
function Divider({ style = {} }) {
  return <div style={{ height: 1, background: 'var(--app-border)', ...style }} />;
}

/* ── Sidebar ─────────────────────────────────────────────────────*/
function Sidebar({ activePage, onNavigate, collapsed = false, onToggle }) {
  /* Ordem: Visão Geral · Ideias · Orgânico · Anúncios · Tráfego · Financeiro */
  const navMain = [
    { id: 'dashboard',  icon: 'layout-dashboard', label: 'Visão Geral' },
    { id: 'ideias',     icon: 'lightbulb',         label: 'Ideias' },
    { id: 'organico',   icon: 'leaf',              label: 'Orgânico' },
    { id: 'criativos',  icon: 'clapperboard',      label: 'Anúncios' },
    { id: 'trafego',    icon: 'trending-up',        label: 'Tráfego' },
    { id: 'funis',      icon: 'filter',             label: 'Funis' },
    { id: 'financeiro', icon: 'wallet',             label: 'Financeiro' },
    { id: 'site',       icon: 'globe',              label: 'Site'       },
  ];

  function NavItem({ item }) {
    const active = activePage === item.id;
    const [hov, setHov] = useState(false);
    return (
      <button onClick={() => onNavigate(item.id)}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        title={collapsed ? item.label : undefined}
        style={{
          display: 'flex', alignItems: 'center',
          gap: collapsed ? 0 : 10,
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '9px 0' : '9px 12px',
          borderRadius: 8, width: '100%', textAlign: 'left',
          background: active ? 'rgba(234,170,65,.1)' : hov ? 'rgba(255,255,255,.04)' : 'transparent',
          border: `1px solid ${active ? 'rgba(234,170,65,.15)' : 'transparent'}`,
          color: active ? 'var(--fmn-gold)' : hov ? 'rgba(255,255,255,.72)' : 'rgba(255,255,255,.44)',
          fontFamily: 'Roboto, sans-serif', fontWeight: active ? 700 : 500,
          fontSize: 13, letterSpacing: '0.01em', cursor: 'pointer', transition: 'all 150ms',
        }}>
        <LucideIcon icon={item.icon} size={16} />
        {!collapsed && item.label}
      </button>
    );
  }

  /* Botão de colapso — sutil, apenas ícone */
  function CollapseBtn() {
    const [hov, setHov] = useState(false);
    return (
      <button onClick={onToggle}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        style={{
          width: 28, height: 28, borderRadius: 6, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: hov ? 'rgba(255,255,255,.07)' : 'transparent',
          border: `1px solid ${hov ? 'rgba(255,255,255,.1)' : 'transparent'}`,
          color: hov ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.2)',
          cursor: 'pointer', transition: 'all 150ms',
        }}>
        <LucideIcon icon={collapsed ? 'panel-left-open' : 'panel-left-close'} size={14} />
      </button>
    );
  }

  return (
    <aside style={{
      width: collapsed ? 52 : 'var(--sidebar-w)',
      minWidth: collapsed ? 52 : 'var(--sidebar-w)',
      height: '100vh', background: 'var(--app-sidebar)',
      borderRight: '1px solid var(--app-border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      transition: 'width 220ms var(--ease-out), min-width 220ms var(--ease-out)',
      overflow: 'hidden',
    }}>
      {/* Cabeçalho — altura exata do TopBar para alinhar títulos */}
      <div style={{
        height: 'var(--topbar-h)',
        padding: collapsed ? '0 8px' : '0 10px 0 16px',
        borderBottom: '1px solid var(--app-border)',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        gap: 8, flexShrink: 0, overflow: 'hidden',
      }}>
        {!collapsed ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <img src="assets/icon-yellow.png" alt="FMN"
                style={{ height: 26, width: 26, objectFit: 'contain', flexShrink: 0 }} />
              <span style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 900, fontSize: 15,
                letterSpacing: '-0.01em', color: 'var(--text-1)', whiteSpace: 'nowrap' }}>
                Tracker <span style={{ color: 'var(--fmn-gold)' }}>FMN</span>
              </span>
            </div>
            <CollapseBtn />
          </>
        ) : (
          <CollapseBtn />
        )}
      </div>

      {/* Nav principal */}
      <nav style={{ flex: 1, padding: collapsed ? '10px 4px' : '10px 8px',
        display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto' }}>
        {navMain.map(item => <NavItem key={item.id} item={item} />)}
      </nav>

      {/* Sistema (sem botão de colapso aqui) */}
      <div style={{ padding: collapsed ? '8px 4px' : '8px 8px',
        borderTop: '1px solid var(--app-border)', flexShrink: 0 }}>
        <NavItem item={{ id: 'sistema', icon: 'settings', label: 'Sistema' }} />
      </div>
    </aside>
  );
}

/* ── TopBar ──────────────────────────────────────────────────────*/
function TopBar({ title, period, onPeriodChange, actions, backButton }) {
  const periods = ['Hoje', '7d', '14d', '30d'];
  return (
    <header style={{
      height: 'var(--topbar-h)', background: 'var(--app-bg)',
      borderBottom: '1px solid var(--app-border)',
      padding: '0 24px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {backButton}
        <span style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 700, fontSize: 14.5,
          color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
          {title}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {period !== undefined && (
          <div style={{ display: 'flex', background: 'rgba(255,255,255,.04)',
            border: '1px solid var(--app-border)', borderRadius: 8, padding: 3, gap: 1 }}>
            {periods.map(p => (
              <button key={p} onClick={() => onPeriodChange && onPeriodChange(p)}
                style={{
                  padding: '5px 11px', borderRadius: 6, cursor: 'pointer',
                  background: period === p ? 'rgba(234,170,65,.15)' : 'transparent',
                  border: `1px solid ${period === p ? 'rgba(234,170,65,.2)' : 'transparent'}`,
                  color: period === p ? 'var(--fmn-gold)' : 'rgba(255,255,255,.42)',
                  fontFamily: 'Roboto, sans-serif', fontWeight: 700, fontSize: 11,
                  letterSpacing: '0.04em', transition: 'all 130ms',
                }}>
                {p}
              </button>
            ))}
          </div>
        )}
        {actions}
      </div>
    </header>
  );
}

/* ── RefBlock ────────────────────────────────────────────────────
   Campo de referência reutilizável nos modais de ADS e Orgânico.
   Detecta automaticamente o tipo de valor e renderiza:
     - URL (http...)      → link clicável com ícone
     - JSON com imagem    → preview inline + link
     - texto simples      → textarea editável
   ─────────────────────────────────────────────────────────────── */
function RefBlock({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value || '');

  // Tenta detectar o tipo do valor armazenado
  const parsed = (() => {
    if (!value) return null;
    if (value.startsWith('{')) {
      try { return JSON.parse(value); } catch { return null; }
    }
    if (value.startsWith('http')) return { type:'url', value };
    return { type:'text', value };
  })();

  const fieldStyle = {
    width:'100%', boxSizing:'border-box', padding:'9px 12px', borderRadius:8, resize:'vertical',
    background:'var(--app-surface-2)', border:'1px solid var(--app-border)',
    color:'var(--text-1)', fontFamily:'Roboto,sans-serif', fontSize:13, outline:'none', lineHeight:1.55,
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
          letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)' }}>Referência</span>
        {value && !editing && (
          <button onClick={() => { setDraft(value); setEditing(true); }}
            style={{ fontSize:10, fontFamily:'Roboto,sans-serif', color:'var(--text-3)',
              background:'none', border:'none', cursor:'pointer', padding:0 }}>editar</button>
        )}
      </div>

      {/* Preview quando tem valor e não está editando */}
      {!editing && parsed?.type === 'url' && (
        <a href={parsed.value} target="_blank" rel="noreferrer"
          style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 12px', borderRadius:8,
            background:'var(--app-surface-2)', border:'1px solid var(--app-border)',
            textDecoration:'none', color:'var(--fmn-gold)', fontSize:12, fontFamily:'Roboto,sans-serif',
            wordBreak:'break-all', lineHeight:1.4 }}>
          <LucideIcon icon="link" size={13} style={{ flexShrink:0 }}/>
          {parsed.value}
        </a>
      )}
      {!editing && parsed?.type === 'image' && (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <div style={{ borderRadius:8, overflow:'hidden', border:'1px solid var(--app-border)',
            background:'rgba(0,0,0,.25)', display:'flex', justifyContent:'center' }}>
            <img src={parsed.value} alt="ref"
              style={{ maxWidth:'100%', maxHeight:220, objectFit:'contain', display:'block' }}/>
          </div>
        </div>
      )}
      {!editing && parsed?.type === 'text' && (
        <div style={{ padding:'9px 12px', borderRadius:8, background:'var(--app-surface-2)',
          border:'1px solid var(--app-border)', fontSize:12, fontFamily:'Roboto,sans-serif',
          color:'var(--text-2)', lineHeight:1.5, whiteSpace:'pre-wrap' }}>{parsed.value}</div>
      )}

      {/* Campo vazio ou em edição */}
      {(!value || editing) && (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <textarea value={draft} onChange={e => setDraft(e.target.value)}
            rows={2} placeholder="Cole um link ou descreva a referência..."
            style={fieldStyle}
            onFocus={e => e.target.style.borderColor='rgba(234,170,65,.4)'}
            onBlur={e => e.target.style.borderColor='var(--app-border)'}/>
          <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
            {editing && (
              <button onClick={() => { setEditing(false); setDraft(value||''); }}
                style={{ fontSize:11, fontFamily:'Roboto,sans-serif', padding:'5px 12px',
                  borderRadius:6, border:'1px solid var(--app-border)', background:'transparent',
                  color:'var(--text-3)', cursor:'pointer' }}>Cancelar</button>
            )}
            <button onClick={() => { onChange(draft.trim()); setEditing(false); }}
              style={{ fontSize:11, fontFamily:'Roboto,sans-serif', padding:'5px 12px',
                borderRadius:6, border:'1px solid rgba(234,170,65,.3)',
                background:'rgba(234,170,65,.1)', color:'var(--fmn-gold)', cursor:'pointer', fontWeight:700 }}>
              Salvar referência
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── CarouselLightbox — visualização ampliada (Orgânico + Tráfego) ─
   Escurece o resto da tela, mostra imagem/vídeo em tamanho maior sem
   distorcer (contain), com setas/dots quando há mais de um item.
─────────────────────────────────────────────────────────────────*/
function CarouselLightbox({ urls, initialIdx, onClose }) {
  const [idx, setIdx] = useState(initialIdx || 0);
  const prev = () => setIdx(i => (i - 1 + urls.length) % urls.length);
  const next = () => setIdx(i => (i + 1) % urls.length);

  // Fechar com ESC ou seta no teclado
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape')      onClose();
      if (e.key === 'ArrowLeft')   prev();
      if (e.key === 'ArrowRight')  next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div onClick={onClose}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.88)', zIndex:900,
        display:'flex', alignItems:'center', justifyContent:'center' }}>

      {/* Imagem/vídeo central */}
      <div onClick={e => e.stopPropagation()}
        style={{ position:'relative', maxHeight:'88vh', display:'flex',
          flexDirection:'column', alignItems:'center', gap:12 }}>

        {/\.(mp4|webm|mov|m4v)$/i.test(urls[idx] || '')
          ? <video src={urls[idx]} controls autoPlay loop playsInline
              style={{ maxHeight:'80vh', maxWidth:'min(480px, 90vw)',
                borderRadius:10, display:'block', objectFit:'contain',
                boxShadow:'0 24px 80px rgba(0,0,0,.7)' }}/>
          : <img src={urls[idx]} alt={`Item ${idx+1}`}
              style={{ maxHeight:'80vh', maxWidth:'min(480px, 90vw)',
                borderRadius:10, display:'block', objectFit:'contain',
                boxShadow:'0 24px 80px rgba(0,0,0,.7)' }}/>}

        {urls.length > 1 && (
          <>
            {/* Contador */}
            <div style={{ fontSize:12, fontFamily:'Roboto,sans-serif', fontWeight:700,
              color:'rgba(255,255,255,.6)', letterSpacing:'0.08em' }}>
              {idx + 1} / {urls.length}
            </div>

            {/* Dots */}
            <div style={{ display:'flex', gap:5 }}>
              {urls.map((_, i) => (
                <button key={i} onClick={() => setIdx(i)}
                  style={{ width: i === idx ? 18 : 6, height:6, borderRadius:999,
                    border:'none', cursor:'pointer', transition:'all 200ms',
                    background: i === idx ? '#fff' : 'rgba(255,255,255,.3)' }}/>
              ))}
            </div>
          </>
        )}
      </div>

      {urls.length > 1 && (<>
        {/* Seta esquerda */}
        <button onClick={e => { e.stopPropagation(); prev(); }}
          style={{ position:'fixed', left:20, top:'50%', transform:'translateY(-50%)',
            background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.15)',
            borderRadius:'50%', width:44, height:44, cursor:'pointer', color:'#fff',
            display:'flex', alignItems:'center', justifyContent:'center',
            transition:'background 150ms' }}
          onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.2)'}
          onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,.1)'}>
          <LucideIcon icon="chevron-left" size={20}/>
        </button>

        {/* Seta direita */}
        <button onClick={e => { e.stopPropagation(); next(); }}
          style={{ position:'fixed', right:20, top:'50%', transform:'translateY(-50%)',
            background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.15)',
            borderRadius:'50%', width:44, height:44, cursor:'pointer', color:'#fff',
            display:'flex', alignItems:'center', justifyContent:'center',
            transition:'background 150ms' }}
          onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.2)'}
          onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,.1)'}>
          <LucideIcon icon="chevron-right" size={20}/>
        </button>
      </>)}

      {/* Fechar */}
      <button onClick={onClose}
        style={{ position:'fixed', top:16, right:16,
          background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.15)',
          borderRadius:'50%', width:36, height:36, cursor:'pointer', color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center' }}>
        <LucideIcon icon="x" size={16}/>
      </button>
    </div>
  );
}

// UTM padrão do projeto (fonte única). Usada no Meta e no Tracker:
// modal de publicar, botão copiar UTM, cards e aba Tráfego. Não duplicar.
const UTM_GLOBAL = 'utm_source=FB&utm_campaign={{campaign.name}}&utm_content={{ad.id}}&utm_medium=paid';

// Plataformas do conteúdo orgânico (fonte única). Ideias reusa esta lista.
const PLATAFORMAS = ['Reels', 'Carrossel', 'Imagem', 'Stories', 'Artigo', 'Youtube'];
const PLAT_COLOR  = { Reels:'#f472b6', Carrossel:'#60a5fa', Imagem:'#a78bfa', Stories:'#fb923c', Artigo:'#34d399', Youtube:'#ef4444' };
const PLAT_ICON   = { Reels:'clapperboard', Carrossel:'layout-grid', Imagem:'image', Stories:'circle-dot', Artigo:'newspaper', Youtube:'play' };

Object.assign(window, { LucideIcon, Btn, Badge, CardKPI, SectionCard, Divider, Sidebar, TopBar, fmtBRL, RefBlock, UTM_GLOBAL, PLATAFORMAS, PLAT_COLOR, PLAT_ICON, CarouselLightbox });
