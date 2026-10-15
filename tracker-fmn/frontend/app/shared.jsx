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

/* ── Thumb de anúncio (ÚNICA fonte da verdade) ────────────────────
   Usada por Kanban, Tráfego e Dashboard. Antes cada tela tinha sua própria
   lógica pra achar a thumb, e cada uma quebrava de um jeito diferente
   (Kanban e Tráfego ignoravam ads.thumb_url, Dashboard usava um caminho
   local antigo "thumbnails/{numero}.jpg" que não existia mais).
   Bug corrigido 2026-07-22: unificado numa função só, sempre priorizando
   ads.thumb_url (R2, confiável), com fallback pro Drive só se não tiver. */
function melhorThumbAd(adThumbUrl, mediaFiles, driveUrl) {
  if (adThumbUrl) return adThumbUrl;
  const files = (() => {
    try { return Array.isArray(mediaFiles) ? mediaFiles : JSON.parse(mediaFiles || '[]'); }
    catch { return []; }
  })();
  if (files.length > 0) {
    const img = files.find(f => f.tipo === 'imagem');
    if (img) return img.thumb_url || (img.file_id ? `https://drive.google.com/thumbnail?id=${img.file_id}&sz=w120` : null);
    const vid = files.find(f => f.tipo === 'video' || f.tipo === 'reels');
    if (vid) return vid.thumb_url || (vid.file_id ? `https://drive.google.com/thumbnail?id=${vid.file_id}&sz=w120` : null);
  }
  if (!driveUrl) return null;
  if (!driveUrl.includes('drive.google.com')) return driveUrl;
  const m = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || driveUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w120` : driveUrl;
}

/* ── Icon ──────────────────────────────────────────────────────── */
function LucideIcon({ icon, size = 18, color, style = {}, className }) {
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
    <span ref={ref} className={className} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, flexShrink: 0, color: color || 'currentColor', ...style
    }} />
  );
}

/* ── Button ──────────────────────────────────────────────────────*/
function Btn({ variant = 'primary', size = 'md', children, onClick, style = {}, icon, disabled }) {
  const [pressed, setPressed] = useState(false);
  // Padrão Blindagem / FMN Pro (15/10/2026): altura fixa, 14px peso 500, sem maiúsculas, raio 10.
  const sizes = {
    sm: { h: 32, px: 12, fs: 12, gap: 6, is: 14 },
    md: { h: 36, px: 16, fs: 14, gap: 8, is: 16 },
    lg: { h: 40, px: 22, fs: 14, gap: 8, is: 16 },
  };
  const variants = {
    primary:   { background: 'var(--app-primary)',  color: 'var(--app-primary-fg)', border: '1px solid var(--app-primary)', boxShadow: '0 1px 2px rgba(0,0,0,.25)' },
    secondary: { background: 'var(--app-bg)',       color: 'var(--text-1)',         border: '1px solid var(--app-surface-2)' },
    ghost:     { background: 'transparent',         color: 'var(--text-1)',         border: '1px solid transparent' },
    danger:    { background: 'var(--clr-neg)',      color: '#fff',                  border: '1px solid var(--clr-neg)' },
    meta:      { background: '#1877f2',             color: '#fff',                  border: '1px solid #1877f2' },
  };
  const [hover, setHover] = useState(false);
  const hoverStyle = !hover || disabled ? {} :
    variant === 'primary' || variant === 'danger' || variant === 'meta' ? { opacity: 0.9 } :
    { background: 'var(--app-surface-2)' };
  const s = sizes[size] || sizes.md;
  const v = variants[variant] || variants.ghost;
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setPressed(false); setHover(false); }}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: s.gap,
        height: s.h, padding: `0 ${s.px}px`,
        fontSize: s.fs, fontFamily: 'Roboto, sans-serif', fontWeight: 500,
        borderRadius: 'var(--app-radius-md)', cursor: disabled ? 'default' : 'pointer',
        transition: 'all 150ms var(--ease-out)',
        transform: pressed ? 'scale(0.98)' : 'scale(1)',
        opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap',
        ...v, ...hoverStyle, ...style
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
    gold:     { background: 'rgba(249,182,79,.15)',  color: 'var(--app-primary)' },
    success:  { background: 'rgba(121,224,111,.12)',  color: 'var(--clr-pos)' },
    danger:   { background: 'rgba(254,98,108,.12)', color: 'var(--clr-neg)' },
    warning:  { background: 'rgba(255,152,69,.12)',  color: 'var(--clr-warn)' },
    info:     { background: 'rgba(96,165,250,.12)',  color: 'var(--clr-info)' },
    teal:     { background: 'rgba(52,211,153,.12)',  color: 'var(--clr-teal)' },
    amber:    { background: 'rgba(245,158,11,.12)',  color: '#f59e0b' },
    reels:    { background: 'rgba(249,182,79,.12)',  color: 'var(--fmn-gold)' },
    image:    { background: 'rgba(96,165,250,.12)',  color: 'var(--clr-info)' },
    carousel: { background: 'rgba(52,211,153,.12)',  color: 'var(--clr-teal)' },
  };
  const t = tones[tone] || tones.default;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 10px', borderRadius: 'var(--app-radius-md)',
      fontSize: 12, fontFamily: 'Roboto, sans-serif', fontWeight: 600,
      flexShrink: 0, ...t, ...style
    }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />}
      {children}
    </span>
  );
}

/* ── CardKPI ─────────────────────────────────────────────────────
   Igual ao CardKPI do FMN Pro (15/10/2026): ícone à esquerda num quadrado
   âmbar de 40 px, rótulo pequeno, número grande e a comparação embaixo.
   `alerta` pinta de vermelho quando o número em si é má notícia. */
function CardKPI({ label, value, delta, deltaLabel, icon, accent = false, title, alerta = false, onClick }) {
  const isStr = typeof delta === 'string';
  const deltaPos = isStr ? delta.startsWith('+') : (typeof delta === 'number' ? delta >= 0 : true);
  const dv = typeof delta === 'number' ? `${delta >= 0 ? '+' : ''}${delta}%` : delta;
  const [hov, setHov] = useState(false);
  const cor = alerta ? 'var(--clr-neg)' : 'var(--app-primary)';
  const fundo = alerta ? 'rgba(254,98,108,.15)' : 'rgba(249,182,79,.15)';
  const borda = alerta ? 'rgba(254,98,108,.3)' : 'rgba(249,182,79,.3)';
  return (
    <div title={title} onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        flex: 1, minWidth: 0, background: 'var(--app-surface)',
        border: `1px solid ${onClick && hov ? 'rgba(249,182,79,.5)' : 'var(--app-border)'}`,
        borderRadius: 'var(--app-radius-xl)', padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.1)',
        display: 'flex', alignItems: 'center', gap: 12, cursor: onClick ? 'pointer' : (title ? 'help' : 'default'),
        transition: 'border-color 150ms',
      }}>
      {icon && (
        <div style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center', background: fundo, border: `1px solid ${borda}`, color: cor }}>
          <LucideIcon icon={icon} size={20} />
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontFamily: 'Roboto, sans-serif', color: 'var(--text-2)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
        <div style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 600, fontSize: 24, lineHeight: 1.25,
          color: alerta ? 'var(--clr-neg)' : 'var(--text-1)', fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
        {(delta !== undefined && delta !== null) && (
          <div style={{ fontSize: 11, fontFamily: 'Roboto, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            color: deltaPos ? 'var(--clr-pos)' : 'var(--clr-neg)' }}>
            {dv}{deltaLabel ? <span style={{ color: 'var(--text-2)' }}> {deltaLabel}</span> : null}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Atalho ("O que espera por você", padrão FMN Pro) ─────────────
   Só a contagem e o botão que leva para resolver, na tela certa. */
function Atalho({ icon, numero, rotulo, acao, onClick, carregando, alerta = false }) {
  const tem = numero > 0;
  const [hov, setHov] = useState(false);
  const corNum = tem ? (alerta ? 'var(--clr-neg)' : 'var(--text-1)') : 'var(--text-2)';
  return (
    <button onClick={tem ? onClick : undefined}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ textAlign: 'left', borderRadius: 'var(--app-radius)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
        border: `1px solid ${hov && tem ? 'rgba(249,182,79,.5)' : 'var(--app-border)'}`,
        background: tem ? 'var(--app-surface)' : 'rgba(20,22,27,.2)', cursor: tem ? 'pointer' : 'default',
        transition: 'border-color 150ms', fontFamily: 'Roboto, sans-serif' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <LucideIcon icon={icon} size={16} style={{ color: tem ? (alerta ? 'var(--clr-neg)' : 'var(--app-primary)') : 'var(--text-2)' }}/>
        <span style={{ fontSize: 24, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: corNum }}>{carregando ? '…' : numero}</span>
      </span>
      <span style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.3, minHeight: 32 }}>{rotulo}</span>
      <span style={{ fontSize: 12, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4,
        color: tem ? 'var(--app-primary)' : 'var(--text-2)' }}>
        {tem ? acao : 'Nada agora'}
        {tem && <LucideIcon icon="arrow-right" size={12} style={{ transform: hov ? 'translateX(2px)' : 'none', transition: 'transform 150ms' }}/>}
      </span>
    </button>
  );
}

/* ── Pílulas de filtro (FiltroPills do FMN Pro) ──────────────────*/
function Pilulas({ opcoes, valor, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      {opcoes.map(o => {
        const id = typeof o === 'string' ? o : o.id;
        const label = typeof o === 'string' ? o : o.label;
        const ativo = valor === id;
        return (
          <button key={id} onClick={() => onChange(id)}
            style={{ fontSize: 12, padding: '6px 12px', borderRadius: 999, fontFamily: 'Roboto, sans-serif',
              cursor: 'pointer', transition: 'all 150ms',
              background: ativo ? 'var(--app-primary)' : 'var(--app-bg)',
              color: ativo ? 'var(--app-primary-fg)' : 'var(--text-2)',
              border: `1px solid ${ativo ? 'var(--app-primary)' : 'var(--app-border)'}` }}
            onMouseEnter={e => { if (!ativo) e.currentTarget.style.borderColor = 'rgba(249,182,79,.4)'; }}
            onMouseLeave={e => { if (!ativo) e.currentTarget.style.borderColor = 'var(--app-border)'; }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* ── SectionCard ─────────────────────────────────────────────────
   Com "recolhivel", o título abre e fecha o card e a escolha fica
   guardada por idRecolher. O evento "secoes:recolher" abre ou fecha
   todos de uma vez. */
function SectionCard({ title, children, style = {}, headerRight, noPad = false,
                       recolhivel = false, idRecolher, icon }) {
  const chave = idRecolher ? 'secao:recolhida:' + idRecolher : null;
  const [fechado, setFechado] = useState(() => {
    if (!recolhivel || !chave) return false;
    try { return localStorage.getItem(chave) === '1'; } catch { return false; }
  });
  const guardar = f => { try { chave && localStorage.setItem(chave, f ? '1' : '0'); } catch {} };

  useEffect(() => {
    if (!recolhivel) return;
    const ouvir = e => { const f = e.detail === 'fechar'; setFechado(f); guardar(f); };
    window.addEventListener('secoes:recolher', ouvir);
    return () => window.removeEventListener('secoes:recolher', ouvir);
  }, [recolhivel, chave]);

  const alternar = () => setFechado(f => { guardar(!f); return !f; });

  return (
    <div style={{
      background: 'var(--app-surface)', border: '1px solid var(--app-border)',
      borderRadius: 'var(--app-radius-xl)', overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,.1)', ...style
    }}>
      {title && (
        <div onClick={recolhivel ? alternar : undefined}
          style={{ padding: recolhivel && fechado ? '16px 20px' : '20px 20px 0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            cursor: recolhivel ? 'pointer' : 'default', userSelect: recolhivel ? 'none' : 'auto' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {recolhivel && (
              <LucideIcon icon={fechado ? 'chevron-right' : 'chevron-down'} size={14}
                style={{ color: 'var(--text-3)' }}/>
            )}
            {icon && <LucideIcon icon={icon} size={16} style={{ color: 'var(--app-primary)' }}/>}
            <span style={{ fontSize: 16, fontFamily: 'Roboto, sans-serif', fontWeight: 600,
              color: 'var(--text-1)' }}>{title}</span>
          </span>
          {headerRight && (
            <span onClick={e => recolhivel && e.stopPropagation()}>{headerRight}</span>
          )}
        </div>
      )}
      {!(recolhivel && fechado) && (
        <div style={noPad ? { paddingTop: title ? 16 : 0 } : { padding: title ? '16px 20px 20px' : 20 }}>{children}</div>
      )}
    </div>
  );
}

/* ── Moldura de página (padrão FMN Pro, 15/10/2026) ──────────────
   PageBody: rola, centraliza o conteúdo em até 1152 px, 32 px de respiro
   e 24 px entre os blocos. PageHeader: título de 30 px, descrição em
   cinza logo abaixo e ações à direita, alinhadas pela base. */
function PageBody({ children, maxWidth = 1152, style = {} }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', width: '100%', minWidth: 0 }}>
      <div style={{ maxWidth, margin: '0 auto', padding: 32, boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: 24, ...style }}>
        {children}
      </div>
    </div>
  );
}

function PageHeader({ title, description, actions, extra }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      gap: 12, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ fontFamily: 'Roboto, sans-serif', fontSize: 30, fontWeight: 600,
            letterSpacing: '-0.025em', lineHeight: 1.2, color: 'var(--text-1)', margin: 0 }}>{title}</h1>
          {extra}
        </div>
        {description && (
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: 14, color: 'var(--text-2)',
            marginTop: 4 }}>{description}</p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{actions}</div>}
    </div>
  );
}

/* ── Divider ─────────────────────────────────────────────────────*/
function Divider({ style = {} }) {
  return <div style={{ height: 1, background: 'var(--app-border)', ...style }} />;
}

/* ── Sidebar ─────────────────────────────────────────────────────*/
function Sidebar({ activePage, onNavigate, collapsed = false, onToggle }) {
  // Alguma conversa precisando de humano? Mostra um alerta na aba Conversas
  // mesmo quando o usuário está em outra tela, pra nunca passar batido.
  const [precisaHumano, setPrecisaHumano] = useState(false);
  useEffect(() => {
    if (!window.db) return;
    function checar() {
      window.db.from('whatsapp_contatos').select('telefone', { count: 'exact', head: true })
        .eq('precisa_humano', true).eq('is_spam', false)
        .then(({ count }) => setPrecisaHumano((count || 0) > 0));
    }
    checar();
    const t = setInterval(checar, 20000);
    return () => clearInterval(t);
  }, []);

  const [usuario, setUsuario] = useState(null);
  useEffect(() => {
    window.db?.auth.getUser().then(({ data }) => {
      const u = data?.user; if (!u) return;
      setUsuario({ email: u.email, nome: u.user_metadata?.nome || u.user_metadata?.full_name || 'Ferreira e Maciel' });
    });
  }, []);

  /* Menu em grupos, como no FMN Pro (15/10/2026). */
  const navGrupos = [
    { titulo: null, itens: [
      { id: 'dashboard',  icon: 'layout-dashboard', label: 'Visão Geral' },
    ]},
    { titulo: 'Hoje', itens: [
      { id: 'conversas',  icon: 'message-circle',   label: 'Conversas' },
      { id: 'funis',      icon: 'filter',           label: 'Funis' },
    ]},
    { titulo: 'Conteúdo', itens: [
      { id: 'ideias',     icon: 'lightbulb',        label: 'Ideias' },
      { id: 'organico',   icon: 'leaf',             label: 'Orgânico' },
      { id: 'criativos',  icon: 'clapperboard',     label: 'Anúncios' },
    ]},
    { titulo: 'Vendas', itens: [
      { id: 'trafego',    icon: 'trending-up',      label: 'Tráfego' },
      { id: 'pico',       icon: 'calendar-clock',   label: 'Picos de Venda' },
      { id: 'financeiro', icon: 'wallet',           label: 'Financeiro' },
    ]},
    { titulo: 'Presença', itens: [
      { id: 'site',       icon: 'globe',            label: 'Site' },
    ]},
  ];

  function NavItem({ item }) {
    const active = activePage === item.id;
    const [hov, setHov] = useState(false);
    const alerta = item.id === 'conversas' && precisaHumano;
    return (
      <button onClick={() => onNavigate(item.id)}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        title={collapsed ? (alerta ? `${item.label} · precisa de humano` : item.label) : undefined}
        style={{
          position: 'relative',
          display: 'flex', alignItems: 'center',
          gap: collapsed ? 0 : 8,
          justifyContent: collapsed ? 'center' : 'flex-start',
          height: 32, padding: collapsed ? 0 : '0 8px',
          borderRadius: 'var(--app-radius-md)', width: '100%', textAlign: 'left',
          // Padrão Blindagem / FMN Pro: ativo com fundo âmbar a 6% e borda a 28%.
          background: active ? 'rgba(251,191,36,.06)' : hov ? 'rgba(255,255,255,.05)' : 'transparent',
          border: `1px solid ${active ? 'rgba(251,191,36,.28)' : 'transparent'}`,
          // Abas do menu: #fbbf24. Dentro das telas: #f9b64f (--app-primary). Igual ao FMN Pro.
          color: active ? '#fbbf24' : hov ? '#fbbf24' : 'var(--text-1)',
          fontFamily: 'Roboto, sans-serif', fontWeight: 500,
          fontSize: 14, cursor: 'pointer', transition: 'all 150ms',
        }}>
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <LucideIcon icon={item.icon} size={16} />
          {alerta && (
            <span title="Precisa de humano" style={{
              position: 'absolute', top: -3, right: -3, width: 8, height: 8, borderRadius: '50%',
              background: '#fe626c', border: '1.5px solid var(--app-bg, #080a0e)' }} />
          )}
        </span>
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
      width: collapsed ? 48 : 'var(--sidebar-w)',
      minWidth: collapsed ? 48 : 'var(--sidebar-w)',
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
                style={{ height: 28, width: 28, objectFit: 'contain', flexShrink: 0 }} />
              <span style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 600, fontSize: 15,
                color: 'var(--text-1)', whiteSpace: 'nowrap' }}>
                Tracker <span style={{ color: 'var(--app-primary)' }}>FMN</span>
              </span>
            </div>
            <CollapseBtn />
          </>
        ) : (
          <CollapseBtn />
        )}
      </div>

      {/* Nav principal */}
      <nav style={{ flex: 1, padding: collapsed ? '8px 4px' : '8px',
        display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
        {navGrupos.map((g, gi) => (
          <div key={gi} style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: gi === 0 ? 0 : 12 }}>
            {g.titulo && !collapsed && (
              <div style={{ height: 32, display: 'flex', alignItems: 'center', padding: '0 8px',
                fontSize: 12, fontWeight: 500, fontFamily: 'Roboto, sans-serif', color: 'rgba(240,242,245,.7)' }}>{g.titulo}</div>
            )}
            {g.itens.map(item => <NavItem key={item.id} item={item} />)}
          </div>
        ))}
      </nav>

      {/* Sistema e, embaixo, quem está logado e o sair (como no FMN Pro) */}
      <div style={{ padding: collapsed ? '8px 4px' : '8px 8px',
        borderTop: '1px solid var(--app-border)', flexShrink: 0 }}>
        <NavItem item={{ id: 'sistema', icon: 'settings', label: 'Sistema' }} />
        {!collapsed && usuario && (
          <div style={{ padding: '12px 8px 4px', fontFamily: 'Roboto, sans-serif' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{usuario.nome}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{usuario.email}</div>
            <button onClick={async () => { await window.db.auth.signOut(); location.reload(); }}
              style={{ marginTop: 10, fontSize: 12, fontWeight: 500, color: 'var(--text-1)', cursor: 'pointer' }}>Sair da conta</button>
          </div>
        )}
      </div>
    </aside>
  );
}

/* ── TopBar ──────────────────────────────────────────────────────*/
function TopBar({ title, period, onPeriodChange, actions, backButton }) {
  const periods = ['Hoje', '7d', '14d', '30d'];
  return (
    <header style={{
      // Cabeçalho de página do FMN Pro (15/10/2026): título grande, ações à direita.
      padding: '28px 32px 16px', display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap',
      justifyContent: 'space-between', flexShrink: 0, background: 'var(--app-bg)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {backButton}
        <h1 style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 600, fontSize: 30, lineHeight: '36px',
          letterSpacing: '-0.75px', color: 'var(--text-1)', margin: 0 }}>
          {title}
        </h1>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {period !== undefined && (
          <div style={{ display: 'flex', background: 'var(--app-surface-2)',
            borderRadius: 'var(--app-radius)', padding: 4, gap: 2 }}>
            {periods.map(p => (
              <button key={p} onClick={() => onPeriodChange && onPeriodChange(p)}
                style={{
                  padding: '4px 12px', borderRadius: 'var(--app-radius-md)', cursor: 'pointer',
                  background: period === p ? 'var(--app-bg)' : 'transparent',
                  boxShadow: period === p ? '0 1px 2px rgba(0,0,0,.3)' : 'none',
                  color: period === p ? 'var(--text-1)' : 'var(--text-2)',
                  fontFamily: 'Roboto, sans-serif', fontWeight: 500, fontSize: 13,
                  transition: 'all 130ms',
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
  const [fullscreen, setFullscreen] = useState(false);

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
        <span style={{ fontSize:12, fontFamily:'Roboto,sans-serif', fontWeight:500, color:'var(--text-2)' }}>Referência</span>
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
          <div onClick={() => setFullscreen(true)}
            style={{ borderRadius:8, overflow:'hidden', border:'1px solid var(--app-border)',
              background:'rgba(0,0,0,.25)', display:'flex', justifyContent:'center', cursor:'zoom-in' }}>
            <img src={parsed.value} alt="ref"
              style={{ maxWidth:'100%', maxHeight:220, objectFit:'contain', display:'block' }}/>
          </div>
        </div>
      )}
      {fullscreen && parsed?.type === 'image' && (
        <CarouselLightbox urls={[parsed.value]} initialIdx={0} onClose={() => setFullscreen(false)}/>
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
            onFocus={e => e.target.style.borderColor='rgba(249,182,79,.4)'}
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
                borderRadius:6, border:'1px solid rgba(249,182,79,.3)',
                background:'rgba(249,182,79,.1)', color:'var(--fmn-gold)', cursor:'pointer', fontWeight:700 }}>
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
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:900,
        display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)' }}>

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
// utm_content PRECISA vir como "nome|id" (não só o id sozinho): é o formato
// que o hotmart-webhook, o sync_hotmart.py e o backfill_utms.py esperam pra
// extrair o meta_ad_id do sck que a Hotmart repassa (ver utm-template.md).
// Sem o pipe, a venda ainda é rastreada, mas perde a atribuição ao anúncio.
const UTM_GLOBAL = 'utm_source=FB&utm_campaign={{campaign.name}}&utm_content={{ad.name}}|{{ad.id}}&utm_medium={{adset.name}}|{{adset.id}}&utm_term={{placement}}';

// Plataformas do conteúdo orgânico (fonte única). Ideias reusa esta lista.
const PLATAFORMAS = ['Reels', 'Carrossel', 'Imagem', 'Stories', 'Artigo', 'Youtube'];
const PLAT_COLOR  = { Reels:'#f472b6', Carrossel:'#60a5fa', Imagem:'#a78bfa', Stories:'#fb923c', Artigo:'#34d399', Youtube:'#ef4444' };
const PLAT_ICON   = { Reels:'clapperboard', Carrossel:'layout-grid', Imagem:'image', Stories:'circle-dot', Artigo:'newspaper', Youtube:'play' };

/* ── Importação do Drive: id do trabalho + barra de progresso real ──────────
   A cozinha na nuvem reporta a etapa e a porcentagem de cada trabalho.       */
function novoJobId() {
  try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function BarraProgresso({ pct = 0, etapa = '' }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));

  // Cronômetro próprio, independente das leituras de progresso: em vídeo muito
  // grande a cozinha pode ficar momentaneamente sem responder (CPU no limite),
  // e sem isso a tela parece travada nesses instantes. Conta sozinho desde que
  // este componente aparece na tela, nunca para mesmo se a leitura falhar.
  const [segundos, setSegundos] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSegundos(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const tempo = segundos < 60 ? `${segundos}s` : `${Math.floor(segundos / 60)}m${String(segundos % 60).padStart(2, '0')}s`;

  return (
    <div style={{ padding:'9px 11px', borderRadius:8, background:'rgba(56,189,248,.08)',
      border:'1px solid rgba(56,189,248,.28)', display:'flex', flexDirection:'column', gap:7 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
        <span style={{ display:'flex', alignItems:'center', gap:6, color:'#38bdf8',
          fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:11, lineHeight:1.3 }}>
          <LucideIcon className="carregando-girando" icon="loader" size={12} style={{ animation:'spin 1s linear infinite', flexShrink:0 }}/>
          {etapa || 'Otimizando'} · {tempo}
        </span>
        <span style={{ color:'#38bdf8', fontFamily:'Roboto,sans-serif', fontWeight:700,
          fontSize:11, fontVariantNumeric:'tabular-nums', flexShrink:0 }}>{p}%</span>
      </div>
      <div style={{ height:5, borderRadius:99, background:'rgba(255,255,255,.08)', overflow:'hidden' }}>
        <div style={{ width:`${p}%`, height:'100%', borderRadius:99, background:'#38bdf8',
          transition:'width 350ms cubic-bezier(.2,.7,.2,1)' }}/>
      </div>
    </div>
  );
}


/* ── buscarTudo ──────────────────────────────────────────────────────────
   Busca TODAS as linhas, não só as mil primeiras.

   O Supabase corta o resultado em 1000 linhas por padrão, e o .limit() do
   client só reduz esse teto, nunca aumenta: pedir .limit(5000) engana, volta
   1000 e nada avisa que faltou. Nasceu na tela de Funis (escondia 574 de
   1.574 leads) e virou fonte única na auditoria de 12/09/2026, quando o
   mesmo corte apareceu no Dashboard e no Financeiro, com 1.549 vendas na
   base: faturamento, lucro e ROAS do período Máximo saíam errados para
   baixo, sem aviso nenhum na tela.                                      */
async function buscarTudo(montarQuery, passo = 1000) {
  const linhas = [];
  for (let pagina = 0; ; pagina++) {
    const { data, error } = await montarQuery().range(pagina * passo, pagina * passo + passo - 1);
    if (error) break;
    linhas.push(...(data || []));
    if (!data || data.length < passo) break;
  }
  return linhas;
}


/* Ticket de referência do MCV, usado na classificação de anúncio.
   Estava declarado em kanban.jsx e em sistema.jsx ao mesmo tempo: como todo
   arquivo do painel compartilha o mesmo escopo, mudar num deles não mudava
   nada, porque o outro carregava depois e vencia (auditoria 12/09/2026).
   A régua canônica do servidor é supabase/functions/_shared/classificar.ts. */
const TICKET_PADRAO = 297;

// Fechar janela clicando no fundo escuro: só vale quando o clique COMEÇOU no
// fundo. Arrastar o cantinho de um campo de texto pra aumentar e soltar o
// mouse fora da janela gera um "click" no fundo, e o card fechava sozinho.
let alvoDoMouseDown = null;
document.addEventListener('mousedown', e => { alvoDoMouseDown = e.target; }, true);
const cliqueFoiNoFundo = e => e.target === e.currentTarget && alvoDoMouseDown === e.currentTarget;

Object.assign(window, { TICKET_PADRAO, cliqueFoiNoFundo, buscarTudo, LucideIcon, Btn, Badge, CardKPI, Atalho, Pilulas, SectionCard, PageBody, PageHeader, Divider, Sidebar, TopBar, fmtBRL, RefBlock, UTM_GLOBAL, PLATAFORMAS, PLAT_COLOR, PLAT_ICON, CarouselLightbox, novoJobId, BarraProgresso, melhorThumbAd });
