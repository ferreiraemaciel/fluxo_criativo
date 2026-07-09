/* ================================================================
   Tracker FMN — Kanban / Criativos Screen v3
   Modal de detalhe · UTM global · Filtros · Sem # nos nomes

   CONTRATO DE DADOS — Supabase (tabela insights_cache)
   ─────────────────────────────────────────────────────
   Campos consumidos pelo frontend:
     meta_ad_id    string   — ID do anúncio no Meta (matching key)
     gasto         number   — Valor investido no período (R$)
     cpa           number   — Custo por aquisição (R$)
     roas          number   — Return on Ad Spend
     ctr_unico     number   — CTR único (%)
     connect_rate  number   — Connect Rate (%)
     frequencia    number   — Frequência média
     periodo       string   — Período de referência ('hist'|'d5'|'d3')

   Para vincular: CARDS[n].meta_ad_id === insights_cache.meta_ad_id
   Quando conectado ao Supabase, os campos cpa/vendas/roas substituem
   os valores mock abaixo. Campos null = ainda não vinculado.
   ================================================================ */
const { useState, useRef, useEffect } = React;
const { LucideIcon, Btn, Badge, TopBar } = window;

const PRODUCT_TICKET = 297;
const UTM_GLOBAL = window.UTM_GLOBAL; // fonte única em shared.jsx

const ADS_COLUMNS = [
  { id:'fazer',           label:'Fazer',            colorDot:'#3b82f6', colorBg:'rgba(59,130,246,.08)',  colorBorder:'rgba(59,130,246,.25)' },
  { id:'fazendo',         label:'Fazendo',          colorDot:'#fbbf24', colorBg:'rgba(251,191,36,.08)',  colorBorder:'rgba(251,191,36,.25)' },
  { id:'ativo',           label:'Ativos',           colorDot:'#f97316', colorBg:'rgba(249,115,22,.08)',  colorBorder:'rgba(249,115,22,.3)'  },
  { id:'campeoes',        label:'Campeões',         colorDot:'#4ade80', colorBg:'rgba(74,222,128,.08)',  colorBorder:'rgba(74,222,128,.25)' },
  { id:'testar-novamente',label:'Testar novamente', colorDot:'#a78bfa', colorBg:'rgba(167,139,250,.08)', colorBorder:'rgba(167,139,250,.25)' },
  { id:'arquivado',       label:'Arquivados',       colorDot:'#94a3b8', colorBg:'rgba(148,163,184,.05)', colorBorder:'rgba(148,163,184,.2)' },
];

// Regras de classificação
// Regras aprovadas em 2026-06-20 — ver tracker-fmn/REGRAS-KANBAN.md
// Ótimo:           >= 5 vendas E CPA < R$297
// Mediano:         1 a 4 vendas — OU — >= 5 vendas com CPA >= R$297
// Ruim:            0 vendas E gasto < R$145,53
// Testar novamente: 0 vendas E gasto >= R$145,53

const CPA_LIMITE    = 207.90;
const TICKET_VAL    = 297;
const GASTO_MIN_TEST = 145.53; // 70% do CPA limite

function classifyAd(vendas, cpa, gasto) {
  const v = vendas || 0;
  const g = gasto  || 0;
  const c = cpa != null ? cpa : (v > 0 && g > 0 ? g / v : null);
  if (v === 0) return g >= GASTO_MIN_TEST ? 'Testar novamente' : 'Ruim';
  if (v >= 5 && (c == null || c < TICKET_VAL)) return 'Ótimo';
  return 'Mediano';
}

// Resolve a tag correta ao mudar de coluna.
// Retorna null quando não deve alterar a tag (ex: Fazer, Fazendo).
function resolveTag(novoStatus, statusAnterior, vendas, cpa, gasto) {
  if (novoStatus === 'ativo') return statusAnterior === 'campeoes' ? 'Recorrência' : 'Teste';
  if (novoStatus === 'campeoes') return 'Ótimo';
  if (novoStatus === 'testar-novamente') return 'Testar novamente';
  if (novoStatus === 'arquivado') return classifyAd(vendas, cpa, gasto);
  return null; // fazer, fazendo: sem tag automática
}

const TAG_TONE = { 'Teste':'info', 'Recorrência':'teal', 'Ótimo':'success', 'Testar novamente':'info', 'Mediano':'warning', 'Ruim':'danger' };

/* ── Hook: ADS reais do Supabase ─────────────────────────────────*/
function useAdsCards() {
  const [cards, setCards]     = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!window.db) return;
    setLoading(true);
    const { data: adsList } = await window.db
      .from('ads')
      .select('numero,titulo,status,tag,tipo,headline,hook_copy,hook_visual,desenvolvimento_cta,roteiro,estetica_visual,texto_principal,titulo_ad,descricao_ad,posicionamento,media_drive_url,media_tipo,media_files,meta_ad_id,meta_ad_url,vendas_total,cpa_historico,gasto_total,isento_regra,observacoes,thumb_url,media_url,meta_image_hash,meta_video_id,meta_campaign_id,meta_adset_id,meta_publish_status')
      .order('numero', { ascending: false });

    const { data: insights } = await window.db
      .from('insights_cache')
      .select('meta_ad_id,cpa,roas,gasto,compras,periodo')
      .eq('periodo', 'maximum');

    const insightMap = Object.fromEntries((insights || []).map(i => [i.meta_ad_id, i]));

    const mapped = (adsList || []).map(a => {
      const ins = a.meta_ad_id ? insightMap[a.meta_ad_id] : null;
      const tipoFormatted = a.tipo === 'reels' ? 'Reels' : a.tipo === 'imagem' ? 'Imagem' : 'Carrossel';
      return {
        id:       `ads-${a.numero}`,
        num:      String(a.numero).padStart(3,'0'),
        meta_ad_id: a.meta_ad_id,
        col:      a.status,
        progress: a.status === 'fazendo' ? 50 : 0,
        hook:     a.titulo,
        formats:  [tipoFormatted],
        // totais agregados (soma de todas as instâncias do criativo) têm prioridade
        vendas:   a.vendas_total ?? ins?.compras ?? null,
        cpa:      a.cpa_historico ?? ins?.cpa ?? null,
        gasto:    a.gasto_total ?? ins?.gasto ?? null,
        tag:      a.status === 'ativo'
                    ? (a.tag || 'Teste')
                : (a.status === 'arquivado' || a.status === 'campeoes' || a.status === 'testar-novamente')
                    ? (a.tag || classifyAd(ins?.compras ?? a.vendas_total, ins?.cpa ?? a.cpa_historico, ins?.gasto ?? a.gasto_total))
                : null,
        raw: a,
      };
    });

    setCards(mapped);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  return { cards, loading, reload: load };
}

function getCpaColor(cpa) {
  if (!cpa) return 'var(--text-3)';
  const r = cpa / PRODUCT_TICKET;
  if (r >= 1)   return 'var(--clr-neg)';
  if (r >= 0.7) return 'var(--clr-warn)';
  return 'var(--clr-pos)';
}

function computeChampions(cards) {
  return Object.fromEntries(
    cards.filter(c => c.vendas > 0 && c.cpa > 0)
      .map(c => ({ id: c.id, score: (c.vendas / c.cpa) * 10000 }))
      .sort((a,b) => b.score - a.score)
      .slice(0, 20)
      .map((c,i) => [c.id, i+1])
  );
}

const FORMAT_GRADIENTS = {
  Reels:    'linear-gradient(135deg,#1e2d5f,#2563eb)',
  Imagem:   'linear-gradient(135deg,#1a2e1e,#16a34a)',
  Carrossel:'linear-gradient(135deg,#2d1a40,#7c3aed)',
  Copy:     'linear-gradient(135deg,#3a1a1a,#dc2626)',
};
const FORMAT_ICONS = { Reels:'play', Imagem:'image', Carrossel:'layout-grid', Copy:'type' };
const FORMAT_TONE  = { Reels:'reels', Imagem:'image', Carrossel:'carousel', Copy:'gold' };

/* ── MedalBadge ──────────────────────────────────────────────────*/
function MedalBadge({ rank }) {
  const s = rank===1 ? {bg:'#ffd700',color:'#000'} : rank===2 ? {bg:'#c0c0c0',color:'#000'}
           : rank===3 ? {bg:'#cd7f32',color:'#fff'} : {bg:'rgba(234,170,65,.25)',color:'#eaaa41'};
  return (
    <div style={{ display:'flex', alignItems:'center', gap:3, padding:'2px 6px', borderRadius:999, background:s.bg, flexShrink:0 }}>
      <LucideIcon icon="award" size={9} color={s.color}/>
      <span style={{ fontSize:9, fontFamily:'Roboto,sans-serif', fontWeight:900, color:s.color }}>#{rank}</span>
    </div>
  );
}

/* ── KanbanCard ──────────────────────────────────────────────────*/
function cardThumb(raw) {
  // R2 thumb tem prioridade
  if (raw?.thumb_url) return raw.thumb_url;
  // Legado: Drive
  try {
    const files = Array.isArray(raw?.media_files) ? raw.media_files : JSON.parse(raw?.media_files || '[]');
    const img = files.find(f => f.tipo === 'imagem');
    if (img?.file_id) return `https://drive.google.com/thumbnail?id=${img.file_id}&sz=w120`;
    const vid = files.find(f => f.tipo === 'video' || f.tipo === 'reels');
    if (vid?.file_id) return `https://drive.google.com/thumbnail?id=${vid.file_id}&sz=w120`;
  } catch {}
  const m = (raw?.media_drive_url || '').match(/\/d\/([^/]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w120`;
  const m2 = (raw?.media_drive_url || '').match(/id=([^&]+)/);
  if (m2) return `https://drive.google.com/thumbnail?id=${m2[1]}&sz=w120`;
  return null;
}

function KanbanCard({ card, col, onOpen, onDragStart }) {
  const [hov, setHov] = useState(false);
  const cpaColor = getCpaColor(card.cpa);
  const thumb = cardThumb(card.raw);
  const isVideo = ['reels','video'].includes(card.raw?.tipo) || card.raw?.media_tipo === 'video';
  const hasMedia = (() => {
    try {
      const fs = Array.isArray(card.raw?.media_files) ? card.raw.media_files : JSON.parse(card.raw?.media_files || '[]');
      return fs.length > 0 || !!card.raw?.media_drive_url;
    } catch { return !!card.raw?.media_drive_url; }
  })();
  // Pendente migração Drive→R2
  const needsMigration = !card.raw?.thumb_url && hasMedia;
  // Ícone por tipo (mesmo padrão do orgânico)
  const tipoIcon = card.raw?.tipo === 'carrossel' ? 'layout-grid'
                 : card.raw?.tipo === 'imagem'    ? 'image' : 'clapperboard';
  // Sem preview no R2. Aceitável em Fazer/Fazendo; nas outras colunas, sinaliza.
  const semPreview = !card.raw?.thumb_url && !['fazer','fazendo'].includes(card.col);
  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData('cardId', card.id); e.dataTransfer.setData('fromCol', card.col); onDragStart && onDragStart(); }}
      onClick={() => onOpen(card)}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov?'var(--app-surface-3)':'var(--app-surface-2)',
        border:`1px solid ${hov?col.colorBorder:'var(--app-border)'}`,
        borderRadius:10, padding:'12px 12px', display:'flex', flexDirection:'column', gap:8,
        cursor:'grab', transition:'all 160ms var(--ease-out)',
        transform: hov?'translateY(-1px)':'none' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
        {/* Miniatura */}
        <div style={{ width:32, height:32, borderRadius:5, flexShrink:0, overflow:'hidden',
          border:'1px solid rgba(255,255,255,.1)', background:'rgba(255,255,255,.04)',
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          {thumb
            ? <img src={thumb} alt="" onError={e => { e.currentTarget.style.display='none'; }}
                style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
            : <LucideIcon icon={tipoIcon} size={15}
                style={{ color: semPreview ? 'var(--clr-warn,#fbbf24)' : 'rgba(255,255,255,.25)' }}/>
          }
        </div>
        <span style={{ fontSize:13, fontFamily:'Roboto,sans-serif', fontWeight:900,
          letterSpacing:'0.06em', color:col.colorDot, textTransform:'uppercase', flexShrink:0 }}>
          ADS {card.num}
        </span>
        <div style={{ marginLeft:'auto', display:'flex', gap:4, alignItems:'center', flexShrink:0 }}>
          {card.raw?.meta_video_id && (
            <div title="Criativo de vídeo já preparado na biblioteca do Meta"
              style={{ display:'flex', alignItems:'center', gap:2, padding:'1px 5px', borderRadius:999,
                background:'rgba(56,189,248,.14)', border:'1px solid rgba(56,189,248,.3)', fontSize:9,
                fontFamily:'Roboto,sans-serif', fontWeight:700, color:'#38bdf8', whiteSpace:'nowrap' }}>
              Meta ✓
            </div>
          )}
          {semPreview && (
            <div title="Sem preview — o criativo ainda não foi otimizado para o R2"
              style={{ display:'flex', alignItems:'center', gap:3, padding:'1px 5px', borderRadius:999,
                background:'rgba(251,191,36,.15)', border:'1px solid rgba(251,191,36,.3)', fontSize:9,
                fontFamily:'Roboto,sans-serif', fontWeight:700, color:'#fbbf24', whiteSpace:'nowrap' }}>
              <LucideIcon icon="image-off" size={9}/>sem preview
            </div>
          )}
          {card.tag && (
            <Badge tone={TAG_TONE[card.tag]||'default'} style={{ fontSize:9, padding:'1px 5px', whiteSpace:'nowrap' }}>
              {card.tag === 'Testar novamente' ? 'Testar nov.' : card.tag}
            </Badge>
          )}
        </div>
      </div>

      {/* Hook */}
      <p style={{ fontSize:12.5, fontFamily:'Roboto,sans-serif', lineHeight:1.45,
        color:'var(--text-1)', margin:0, display:'-webkit-box',
        WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
        {card.hook}
      </p>

      {/* Formats */}
      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
        {hasMedia
          ? card.formats.map(f => <Badge key={f} tone={FORMAT_TONE[f]||'default'}>{f}</Badge>)
          : <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:500,
              color:'rgba(255,255,255,.3)', border:'1px dashed rgba(255,255,255,.15)',
              borderRadius:5, padding:'2px 7px', letterSpacing:'0.04em' }}>
              Aguardando criativo
            </span>
        }
      </div>

      {/* Metrics */}
      {(card.vendas !== null || card.cpa !== null) && (
        <div style={{ display:'flex', gap:12, paddingTop:6, borderTop:'1px solid var(--app-border)' }}>
          {card.vendas !== null && (
            <div>
              <div style={{ fontSize:9, fontFamily:'Roboto,sans-serif', fontWeight:700,
                letterSpacing:'0.1em', color:'var(--text-3)', textTransform:'uppercase' }}>Vendas</div>
              <div style={{ fontSize:15, fontFamily:'Roboto,sans-serif', fontWeight:900, color:'var(--text-1)' }}>{card.vendas}</div>
            </div>
          )}
          {card.cpa !== null && (
            <div>
              <div style={{ fontSize:9, fontFamily:'Roboto,sans-serif', fontWeight:700,
                letterSpacing:'0.1em', color:'var(--text-3)', textTransform:'uppercase' }}>CPA</div>
              <div style={{ fontSize:15, fontFamily:'Roboto,sans-serif', fontWeight:900, color:cpaColor }}>
                R${card.cpa}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── KanbanColumn ────────────────────────────────────────────────*/
function KanbanColumn({ col, cards, onOpen, onAddNew, onDropCard }) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); const id=e.dataTransfer.getData('cardId'); const from=e.dataTransfer.getData('fromCol'); if(id && from !== col.id) onDropCard(id, col.id); }}
      style={{ width:238, minWidth:238, display:'flex', flexDirection:'column',
        background: dragOver ? `${col.colorBg.replace('.08','0.18')}` : col.colorBg,
        border:`1px solid ${dragOver ? col.colorDot : col.colorBorder}`,
        borderRadius:12, overflow:'hidden', height:'100%', transition:'border-color 120ms, background 120ms' }}>
      <div style={{ padding:'10px 12px', borderBottom:`1px solid ${col.colorBorder}`,
        display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:col.colorDot, display:'block' }}/>
          <span style={{ fontSize:12, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-1)' }}>
            {col.label}
          </span>
        </div>
        <span style={{ width:20, height:20, borderRadius:'50%', background:'rgba(255,255,255,.07)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:10.5,
          fontFamily:'Roboto,sans-serif', fontWeight:900, color:'var(--text-2)' }}>
          {cards.length}
        </span>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'10px 8px', display:'flex', flexDirection:'column', gap:8 }}>
        {cards.map(c => (
          <KanbanCard key={c.id} card={c} col={col} onOpen={onOpen}/>
        ))}
      </div>
      <div style={{ padding:'6px 8px 10px', borderTop:`1px solid ${col.colorBorder}`, flexShrink:0 }}>
        <button onClick={onAddNew} style={{ width:'100%', padding:'7px', borderRadius:7, cursor:'pointer',
          background:'transparent', border:`1px dashed ${col.colorBorder}`,
          color:'var(--text-3)', fontSize:11.5, fontFamily:'Roboto,sans-serif',
          fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:5,
          transition:'all 150ms' }}
          onMouseEnter={e=>{ e.currentTarget.style.color=col.colorDot; e.currentTarget.style.borderColor=col.colorDot; }}
          onMouseLeave={e=>{ e.currentTarget.style.color='var(--text-3)'; e.currentTarget.style.borderColor=col.colorBorder; }}>
          <LucideIcon icon="plus" size={13}/>
          Adicionar
        </button>
      </div>
    </div>
  );
}

/* ── UtmCopyBtn ──────────────────────────────────────────────────*/
function UtmCopyBtn() {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(UTM_GLOBAL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button onClick={copy}
      title={UTM_GLOBAL}
      style={{ display:'flex', alignItems:'center', gap:6,
        padding:'7px 12px', borderRadius:8,
        background: copied ? 'rgba(74,222,128,.1)' : 'rgba(255,255,255,.04)',
        border: `1px solid ${copied ? 'rgba(74,222,128,.3)' : 'rgba(255,255,255,.1)'}`,
        color: copied ? 'var(--clr-pos)' : 'var(--text-3)',
        fontSize:11, fontFamily:'Roboto,sans-serif', fontWeight:700,
        cursor:'pointer', transition:'all 150ms', whiteSpace:'nowrap' }}>
      <LucideIcon icon={copied ? 'check' : 'link'} size={12}/>
      {copied ? 'UTM copiada!' : 'Copiar UTM'}
    </button>
  );
}

/* ── MetaAdModal ─────────────────────────────────────────────────*/
// Objetivos oferecidos pelo Tracker → chave usada pelo worker ads-media.
const META_OBJETIVOS = [
  { key: 'vendas',    label: 'Vendas'    },
  { key: 'cadastros', label: 'Cadastros' },
  { key: 'trafego',   label: 'Tráfego'   },
];
// Mapeia o objetivo ODAX do Meta de volta para a chave do worker.
function metaObjToKey(obj) {
  if (obj === 'OUTCOME_LEADS')   return 'cadastros';
  if (obj === 'OUTCOME_TRAFFIC') return 'trafego';
  return 'vendas';
}
// "1.234,56" (R$) → 123456 centavos. Aceita vírgula ou ponto decimal.
function brlToCents(s) {
  if (!s) return 0;
  const n = parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function MetaAdModal({ card, onClose }) {
  // Link de destino limpo. O rastreamento (UTM) vai no campo "Parâmetros de URL".
  const LINK_DEFAULT = `https://www.fotografoprotegido.fotografiaeomeunegocio.com.br`;

  // listas e seleção
  const [campaigns, setCampaigns]       = useState([]);
  const [adsets, setAdsets]             = useState([]);
  const [campaignId, setCampaignId]     = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [campaignObj, setCampaignObj]   = useState('vendas'); // chave do worker
  const [adsetId, setAdsetId]           = useState('');
  const [adsetName, setAdsetName]       = useState('');
  const [loadingCamp, setLoadingCamp]   = useState(true);
  const [loadingAdset, setLoadingAdset] = useState(false);

  // criar nova campanha
  const [newCamp, setNewCamp]           = useState(false);
  const [newCampName, setNewCampName]   = useState('');
  const [newCampObj, setNewCampObj]     = useState('vendas');
  const [budgetLevel, setBudgetLevel]   = useState('conjunto'); // 'conjunto' (ABO) | 'campanha' (CBO)
  const [newCampBudget, setNewCampBudget] = useState('');       // R$ formato 00,00
  const [creatingCamp, setCreatingCamp] = useState(false);

  // a campanha selecionada usa orçamento na campanha (CBO)?
  const [campaignIsCbo, setCampaignIsCbo] = useState(false);

  // criar novo conjunto
  const [newAdset, setNewAdset]         = useState(false);
  const [newAdsetName, setNewAdsetName] = useState('');
  const [newAdsetBudget, setNewAdsetBudget] = useState('');    // R$ formato 00,00
  const [creatingAdset, setCreatingAdset]   = useState(false);

  // copy do anúncio (pré-preenchida do card, editável)
  const [msgText, setMsgText]     = useState((card.raw||{}).texto_principal || '');
  const [titleText, setTitleText] = useState((card.raw||{}).titulo_ad || '');
  const [descText, setDescText]   = useState((card.raw||{}).descricao_ad || '');
  const [urlTags, setUrlTags]     = useState(UTM_GLOBAL);

  // destino + fluxo final
  const [linkDestino, setLinkDestino] = useState(LINK_DEFAULT);
  const [confirm, setConfirm]   = useState(false);
  const [status, setStatus]     = useState('idle');
  const [loadingMsg, setLoadingMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [resultUrl, setResultUrl] = useState('');

  // ESC fecha
  React.useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const raw = card.raw || {};
  const adNum   = parseInt(card.num, 10);
  const isVideo = /reels|video/i.test(raw.tipo || '') || raw.media_tipo === 'video';

  // Mídia no R2 (primeiro item se for JSON array)
  const r2Url = (() => {
    try {
      const v = raw.media_url;
      if (!v) return '';
      const p = JSON.parse(v);
      return Array.isArray(p) ? (p[0] || '') : p;
    } catch { return raw.media_url || ''; }
  })();
  const hasMedia = !!(raw.meta_image_hash || raw.meta_video_id || r2Url);

  // ── chamadas ao worker ads-media ──
  async function workerGet(path) {
    const r = await fetch(`${ADS_MEDIA_WORKER}${path}`);
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || `Erro HTTP ${r.status}`);
    return d;
  }
  async function workerPost(path, body) {
    const r = await fetch(`${ADS_MEDIA_WORKER}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || `Erro HTTP ${r.status}`);
    return d;
  }

  useEffect(() => {
    workerGet('/campaigns')
      .then(d => { setCampaigns(d.campaigns || []); setLoadingCamp(false); })
      .catch(e => { setErrorMsg(e.message); setLoadingCamp(false); });
  }, []);

  async function handleCampaignChange(id, name, objKey) {
    setCampaignId(id); setCampaignName(name);
    if (objKey) setCampaignObj(objKey);
    setAdsetId(''); setAdsetName(''); setAdsets([]);
    setNewAdset(false);
    // Detecta se a campanha existente é CBO (tem orçamento na campanha)
    const c = campaigns.find(x => x.id === id);
    setCampaignIsCbo(!!(c && (Number(c.daily_budget) > 0 || Number(c.lifetime_budget) > 0)));
    if (!id) return;
    setLoadingAdset(true);
    try {
      const d = await workerGet(`/adsets?campaign=${id}`);
      setAdsets(d.adsets || []);
    } catch (e) {
      setErrorMsg(e.message || 'Erro ao carregar conjuntos');
    } finally {
      setLoadingAdset(false);
    }
  }

  async function handleCreateCampaign() {
    if (!newCampName.trim()) return;
    const isCbo = budgetLevel === 'campanha';
    const cents = brlToCents(newCampBudget);
    if (isCbo && cents <= 0) { setErrorMsg('Informe o orçamento diário da campanha (ex: 50,00).'); return; }
    setCreatingCamp(true); setErrorMsg('');
    try {
      const d = await workerPost('/create-campaign', {
        nome: newCampName.trim(), objetivo: newCampObj,
        ...(isCbo ? { dailyBudget: cents } : {}),
      });
      const nova = { id: d.campaignId, name: newCampName.trim(), objective: null,
        effective_status: 'PAUSED', daily_budget: isCbo ? cents : 0 };
      setCampaigns(prev => [nova, ...prev]);
      setCampaignIsCbo(isCbo);
      await handleCampaignChange(d.campaignId, nova.name, newCampObj);
      setCampaignIsCbo(isCbo); // handleCampaignChange recalcula; garante o valor certo
      setNewCamp(false); setNewCampName(''); setNewCampBudget('');
    } catch (e) {
      setErrorMsg(e.message || 'Erro ao criar campanha');
    } finally {
      setCreatingCamp(false);
    }
  }

  async function handleCreateAdset() {
    if (!newAdsetName.trim()) return;
    const cents = brlToCents(newAdsetBudget);
    if (!campaignIsCbo && cents <= 0) { setErrorMsg('Informe o orçamento diário do conjunto (ex: 50,00).'); return; }
    setCreatingAdset(true); setErrorMsg('');
    try {
      const d = await workerPost('/create-adset', {
        nome: newAdsetName.trim(), campaignId,
        cbo: campaignIsCbo,
        ...(campaignIsCbo ? {} : { dailyBudget: cents }),
        objetivo: campaignObj,
      });
      const novo = { id: d.adsetId, name: newAdsetName.trim() };
      setAdsets(prev => [novo, ...prev]);
      setAdsetId(d.adsetId); setAdsetName(novo.name);
      setNewAdset(false); setNewAdsetName(''); setNewAdsetBudget('');
    } catch (e) {
      setErrorMsg(e.message || 'Erro ao criar conjunto');
    } finally {
      setCreatingAdset(false);
    }
  }

  // Resolve a mídia para o criativo.
  // Imagem: usa a URL pública do R2 (preview otimizado) direto no criativo.
  // Vídeo: usa o video_id se já existe; senão prepara o criativo (Fluxo B, só no Mac).
  async function ensureMetaMedia() {
    if (!isVideo) {
      if (r2Url) return { imageUrl: r2Url };
      if (raw.meta_image_hash) return { imageHash: raw.meta_image_hash };
      throw new Error('Sem mídia no R2 para o anúncio.');
    }
    if (raw.meta_video_id) return { videoId: raw.meta_video_id };
    // Vídeo ainda sem criativo no Meta → Fluxo B, que precisa do Mac (ffmpeg + Drive).
    const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
    if (!isLocal) {
      throw new Error('Este vídeo ainda não tem criativo no Meta. Prepare no Mac "Fotografia é o Meu Negócio" antes de publicar (é a 1ª vez deste vídeo).');
    }
    const videoId = await prepararCriativoMeta(adNum);
    return { videoId };
  }

  // Fluxo B via servidor local: pega o original no Drive, otimiza em alta,
  // sobe pro Meta, salva o video_id e apaga o temporário. Leva ~1-2 min.
  async function prepararCriativoMeta(numero) {
    setLoadingMsg('Preparando o criativo no Meta (1ª vez, ~1-2 min)…');
    await fetch(`/api/preparar-criativo-meta?numero=${numero}`, { method: 'POST' });
    for (let i = 0; i < 120; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const s = await (await fetch(`/api/preparar-criativo-meta?numero=${numero}`)).json();
      if (s.msg) setLoadingMsg(s.msg);
      if (s.video_id) return s.video_id;
      if (!s.running && s.error) throw new Error(s.error);
      if (!s.running && !s.video_id) throw new Error('Falha ao preparar o criativo.');
    }
    throw new Error('Tempo esgotado preparando o criativo.');
  }

  async function handleCreate() {
    setStatus('loading'); setErrorMsg('');
    setLoadingMsg(isVideo && !raw.meta_video_id ? 'Enviando vídeo ao Meta (pode levar 1 min)…' : 'Publicando…');
    try {
      const media = await ensureMetaMedia();
      setLoadingMsg('Montando o anúncio…');
      const d = await workerPost('/create-ad', {
        nome:      `ADS ${card.num} - ${raw.titulo || ''}`.trim().slice(0, 200),
        adsetId,
        imageUrl:  media.imageUrl,
        imageHash: media.imageHash,
        videoId:   media.videoId,
        thumbUrl:  raw.thumb_url || '',
        mensagem:  msgText,
        titulo:    titleText,
        descricao: descText,
        link:      linkDestino.trim() || LINK_DEFAULT,
        urlTags:   urlTags.trim(),
        cta:       'LEARN_MORE',
      });
      // Persiste os IDs no card + status de publicação (rascunho = pausado)
      await window.db.from('ads').update({
        meta_campaign_id:    campaignId,
        meta_adset_id:       adsetId,
        meta_ad_id:          d.adId,
        meta_ad_url:         d.adUrl,
        meta_publish_status: 'rascunho',
      }).eq('numero', adNum);
      setResultUrl(d.adUrl || '');
      setStatus('success');
    } catch (e) {
      setStatus('error'); setErrorMsg(e.message || 'Erro inesperado');
    }
  }

  // estilos alinhados com o resto do kanban
  const field = { width:'100%', padding:'9px 12px', borderRadius:8,
    background:'var(--app-surface-2)', border:'1px solid var(--app-border)',
    color:'var(--text-1)', fontFamily:'Roboto,sans-serif', fontSize:13, colorScheme:'dark' };
  const S = {
    select:  { ...field, cursor:'pointer', appearance:'none', WebkitAppearance:'none' },
    input:   { ...field, outline:'none', boxSizing:'border-box' },
    label:   { fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
               letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-3)',
               marginBottom:4, display:'block' },
    linkBtn: { background:'none', border:'none', color:'var(--fmn-gold)', fontSize:11,
               fontFamily:'Roboto,sans-serif', cursor:'pointer', padding:0 },
    row:     { display:'flex', gap:8, marginTop:6 },
    miniBtn: (active) => ({ flex:1, padding:'8px 10px', borderRadius:7, border:'none', fontSize:12,
               fontFamily:'Roboto,sans-serif', fontWeight:700, cursor: active ? 'pointer' : 'default',
               background: active ? 'var(--fmn-gold)' : 'rgba(255,255,255,.06)',
               color: active ? '#000' : 'var(--text-3)' }),
    subBox:  { padding:'12px', borderRadius:10, background:'var(--app-surface-2)',
               border:'1px solid var(--app-border-2)', display:'flex', flexDirection:'column', gap:8 },
  };

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:700,
      display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e=>e.stopPropagation()}
        style={{ background:'var(--app-surface)', border:'1px solid var(--app-border-2)',
          borderRadius:16, padding:'24px', width:480, maxHeight:'90vh', overflowY:'auto',
          display:'flex', flexDirection:'column', gap:16, boxShadow:'0 20px 60px rgba(0,0,0,.6)' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:15, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-1)' }}>Criar Anúncio no Meta</div>
            <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>ADS {card.num} — {raw.titulo || raw.hook_copy || ''}</div>
          </div>
          <button onClick={onClose} style={{ width:28, height:28, borderRadius:'50%',
            background:'rgba(255,255,255,.07)', color:'var(--text-2)', border:'none',
            display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:16 }}>×</button>
        </div>

        {/* Sucesso */}
        {status === 'success' && (
          <div style={{ textAlign:'center', padding:'20px 0', display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
            <div style={{ width:52, height:52, borderRadius:'50%', background:'rgba(74,222,128,.15)',
              border:'2px solid var(--clr-pos)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <LucideIcon icon="check" size={24} color="var(--clr-pos)"/>
            </div>
            <div style={{ fontSize:15, fontWeight:700, color:'var(--clr-pos)' }}>Anúncio criado (pausado)</div>
            <div style={{ fontSize:12, color:'var(--text-3)' }}>{campaignName} › {adsetName}</div>
            <div style={{ fontSize:11.5, color:'var(--text-3)', maxWidth:300, lineHeight:1.5 }}>
              Subiu pausado. Use "Ativar tudo no Meta" no topo do quadro para ligar em massa.
            </div>
            {resultUrl && (
              <a href={resultUrl} target="_blank" rel="noopener noreferrer"
                style={{ fontSize:12, color:'var(--fmn-gold)', textDecoration:'none' }}>
                Ver no Gerenciador →
              </a>
            )}
          </div>
        )}

        {/* Erro inline */}
        {errorMsg && status !== 'success' && (
          <div style={{ padding:'9px 12px', borderRadius:8, background:'rgba(248,113,113,.08)',
            border:'1px solid rgba(248,113,113,.3)', fontSize:12, color:'#f87171', lineHeight:1.5 }}>
            {errorMsg}
          </div>
        )}

        {/* Formulário principal */}
        {status !== 'success' && !confirm && (
          <>
            {/* ── Campanha ── */}
            <div>
              <label style={S.label}>Campanha</label>
              {loadingCamp
                ? <div style={{ fontSize:12, color:'var(--text-3)' }}>Carregando...</div>
                : !newCamp
                  ? <>
                      <select value={campaignId} onChange={e => {
                        const opt = e.target.options[e.target.selectedIndex];
                        const c = campaigns.find(x => x.id === e.target.value);
                        handleCampaignChange(e.target.value, opt.text, c ? metaObjToKey(c.objective) : 'vendas');
                      }} style={S.select}>
                        <option value="">Selecionar campanha...</option>
                        {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <div style={{ marginTop:5 }}>
                        <button style={S.linkBtn} onClick={() => setNewCamp(true)}>+ Nova campanha</button>
                      </div>
                    </>
                  : <div style={S.subBox}>
                      <input style={S.input} placeholder="Nome da campanha" value={newCampName}
                        onChange={e => setNewCampName(e.target.value)}/>
                      <select value={newCampObj} onChange={e => setNewCampObj(e.target.value)} style={S.select}>
                        {META_OBJETIVOS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                      </select>
                      {/* Nível do orçamento: CBO (campanha) x ABO (conjunto) */}
                      <div>
                        <span style={{ ...S.label, marginBottom:6 }}>Orçamento</span>
                        <div style={{ display:'flex', gap:8 }}>
                          <button onClick={() => setBudgetLevel('conjunto')}
                            style={S.miniBtn(budgetLevel === 'conjunto')}>No conjunto (ABO)</button>
                          <button onClick={() => setBudgetLevel('campanha')}
                            style={S.miniBtn(budgetLevel === 'campanha')}>Na campanha (CBO)</button>
                        </div>
                        {budgetLevel === 'campanha' && (
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
                            <span style={{ fontSize:13, color:'var(--text-2)' }}>R$</span>
                            <input style={S.input} placeholder="00,00" inputMode="decimal"
                              value={newCampBudget} onChange={e => setNewCampBudget(e.target.value)}/>
                            <span style={{ fontSize:11, color:'var(--text-3)', whiteSpace:'nowrap' }}>/ dia</span>
                          </div>
                        )}
                      </div>
                      <div style={S.row}>
                        <button style={S.miniBtn(false)} onClick={() => { setNewCamp(false); setNewCampName(''); setNewCampBudget(''); }}>Cancelar</button>
                        <button style={S.miniBtn(!!newCampName.trim())} onClick={handleCreateCampaign}
                          disabled={!newCampName.trim() || creatingCamp}>
                          {creatingCamp ? 'Criando...' : 'Criar campanha'}
                        </button>
                      </div>
                    </div>
              }
            </div>

            {/* ── Conjunto ── */}
            <div>
              <label style={S.label}>Conjunto de Anúncios</label>
              {!campaignId
                ? <div style={{ fontSize:12, color:'var(--text-3)' }}>Selecione uma campanha primeiro</div>
                : loadingAdset
                  ? <div style={{ fontSize:12, color:'var(--text-3)' }}>Carregando...</div>
                  : !newAdset
                    ? <>
                        <select value={adsetId} onChange={e => {
                          const opt = e.target.options[e.target.selectedIndex];
                          setAdsetId(e.target.value); setAdsetName(opt.text);
                        }} style={S.select}>
                          <option value="">Selecionar conjunto...</option>
                          {adsets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                        <div style={{ marginTop:5 }}>
                          <button style={S.linkBtn} onClick={() => setNewAdset(true)}>+ Novo conjunto</button>
                        </div>
                      </>
                    : <div style={S.subBox}>
                        <input style={S.input} placeholder="Nome do conjunto" value={newAdsetName}
                          onChange={e => setNewAdsetName(e.target.value)}/>
                        {campaignIsCbo
                          ? <div style={{ fontSize:11.5, color:'var(--fmn-gold)', padding:'8px 10px',
                              borderRadius:8, background:'rgba(234,170,65,.06)', border:'1px solid rgba(234,170,65,.2)' }}>
                              Orçamento fica na campanha (CBO). O conjunto não define valor.
                            </div>
                          : <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <span style={{ fontSize:13, color:'var(--text-2)' }}>R$</span>
                              <input style={S.input} placeholder="00,00" inputMode="decimal"
                                value={newAdsetBudget} onChange={e => setNewAdsetBudget(e.target.value)}/>
                              <span style={{ fontSize:11, color:'var(--text-3)', whiteSpace:'nowrap' }}>/ dia</span>
                            </div>
                        }
                        <div style={{ fontSize:11, color:'var(--text-3)' }}>Segmentação padrão: Brasil, 18–65 anos, Advantage+. Ajuste depois no Gerenciador.</div>
                        <div style={S.row}>
                          <button style={S.miniBtn(false)} onClick={() => { setNewAdset(false); setNewAdsetName(''); setNewAdsetBudget(''); }}>Cancelar</button>
                          <button style={S.miniBtn(!!newAdsetName.trim())}
                            onClick={handleCreateAdset}
                            disabled={!newAdsetName.trim() || creatingAdset}>
                            {creatingAdset ? 'Criando...' : 'Criar conjunto'}
                          </button>
                        </div>
                      </div>
              }
            </div>

            {/* Copy do anúncio (pré-preenchida do card) */}
            <div>
              <label style={S.label}>Texto principal</label>
              <textarea style={{ ...S.input, minHeight:76, resize:'vertical', fontFamily:'Roboto,sans-serif' }}
                value={msgText} onChange={e => setMsgText(e.target.value)} placeholder="Texto principal do anúncio"/>
            </div>
            <div>
              <label style={S.label}>Título</label>
              <input style={S.input} value={titleText} onChange={e => setTitleText(e.target.value)}
                placeholder="Título do anúncio"/>
            </div>
            <div>
              <label style={S.label}>Descrição</label>
              <input style={S.input} value={descText} onChange={e => setDescText(e.target.value)}
                placeholder="Descrição do link"/>
            </div>

            {/* Link de destino */}
            <div>
              <label style={S.label}>Link de destino</label>
              <input style={S.input} value={linkDestino} onChange={e => setLinkDestino(e.target.value)}
                placeholder="https://..."/>
            </div>

            {/* Parâmetros de URL (rastreamento) */}
            <div>
              <label style={S.label}>Parâmetros de URL (rastreamento)</label>
              <input style={S.input} value={urlTags} onChange={e => setUrlTags(e.target.value)}
                placeholder="utm_source=FB&utm_campaign=..."/>
              <div style={{ marginTop:4, fontSize:10.5, color:'var(--text-3)', lineHeight:1.5 }}>
                Vai no campo "Parâmetros de URL" do anúncio. Os tokens {'{{campaign.name}}'} e {'{{ad.id}}'} são preenchidos pelo Meta.
              </div>
            </div>

            {!hasMedia && (
              <div style={{ padding:'8px 12px', borderRadius:8, background:'rgba(234,170,65,.06)',
                border:'1px solid rgba(234,170,65,.2)', fontSize:11, color:'var(--fmn-gold)' }}>
                Sem mídia no R2. Faça o upload do criativo no card antes de publicar no Meta.
              </div>
            )}

            <button onClick={() => setConfirm(true)} disabled={!campaignId || !adsetId || !hasMedia}
              style={{ padding:'12px', borderRadius:8, border:'none',
                background: campaignId && adsetId && hasMedia ? 'var(--fmn-gold)' : 'rgba(255,255,255,.08)',
                color: campaignId && adsetId && hasMedia ? 'var(--fmn-black)' : 'var(--text-3)',
                fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:13,
                cursor: campaignId && adsetId && hasMedia ? 'pointer' : 'not-allowed',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              <LucideIcon icon="rocket" size={16}/>Publicar no Meta
            </button>
          </>
        )}

        {/* Gate de confirmação */}
        {confirm && status !== 'success' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ padding:'14px', borderRadius:10, background:'rgba(234,170,65,.06)',
              border:'1px solid rgba(234,170,65,.2)', lineHeight:1.8 }}>
              <div style={{ fontWeight:700, fontSize:13, color:'var(--text-1)', marginBottom:6 }}>Confirmar publicação</div>
              <div style={{ fontSize:12, color:'var(--text-2)' }}>
                <b>Campanha:</b> {campaignName}<br/>
                <b>Conjunto:</b> {adsetName}<br/>
                <b>Mídia:</b> {isVideo ? 'vídeo' : 'imagem'} ({(raw.meta_image_hash || raw.meta_video_id) ? 'já na biblioteca do Meta' : 'sobe do R2 agora'})<br/>
                <b>Status inicial:</b> PAUSADO
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setConfirm(false)}
                style={{ flex:1, padding:'10px', borderRadius:8, border:'1px solid var(--app-border)',
                  background:'transparent', color:'var(--text-2)', fontFamily:'Roboto,sans-serif', fontSize:13, cursor:'pointer' }}>
                Voltar
              </button>
              <button onClick={handleCreate} disabled={status==='loading'}
                style={{ flex:2, padding:'10px', borderRadius:8, border:'none',
                  background:'var(--fmn-gold)', color:'var(--fmn-black)',
                  fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:13,
                  cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                {status==='loading'
                  ? <><LucideIcon icon="loader" size={16}/>{loadingMsg || 'Criando…'}</>
                  : <><LucideIcon icon="check" size={16}/>Confirmar e criar</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── MetaIdField — campo editável com auto-busca ─────────────────*/
function MetaIdField({ card, onSaved }) {
  const [val, setVal]         = useState(card.meta_ad_id || '');
  const [status, setStatus]   = useState('idle'); // idle | searching | found | notfound | saving | saved | error
  const [candidates, setCandidates] = useState([]);
  const SUPABASE_URL = window.db?.supabaseUrl || '';
  const SUPABASE_KEY = window.db?.supabaseKey  || '';

  // Auto-busca ao abrir quando não há meta_ad_id
  useEffect(() => {
    if (!card.meta_ad_id) autoSearch();
  }, []);

  async function autoSearch() {
    setStatus('searching');
    setCandidates([]);
    try {
      // Busca por número primeiro
      const num   = card.num ? parseInt(card.num, 10) : null;
      const query = num ? String(num) : card.hook;
      const res   = await fetch(
        `${SUPABASE_URL}/functions/v1/meta-search?q=${encodeURIComponent(query)}&limit=10`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      const json = await res.json();
      const ads  = json.ads || [];
      if (ads.length === 1) {
        // Match único — auto-preenche e salva
        setVal(ads[0].id);
        setStatus('found');
        await saveId(ads[0].id);
      } else if (ads.length > 1) {
        setCandidates(ads);
        setStatus('found');
      } else {
        // Tenta pelo título
        const res2 = await fetch(
          `${SUPABASE_URL}/functions/v1/meta-search?q=${encodeURIComponent(card.hook || '')}&limit=10`,
          { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
        );
        const json2 = await res2.json();
        const ads2  = json2.ads || [];
        if (ads2.length === 1) {
          setVal(ads2[0].id);
          setStatus('found');
          await saveId(ads2[0].id);
        } else if (ads2.length > 1) {
          setCandidates(ads2);
          setStatus('found');
        } else {
          setStatus('notfound');
        }
      }
    } catch {
      setStatus('error');
    }
  }

  async function saveId(id) {
    if (!id) return;
    setStatus('saving');
    try {
      await window.db.from('ads').update({ meta_ad_id: id }).eq('numero', parseInt(card.num, 10));
      setStatus('saved');
      if (onSaved) onSaved(id);
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
    }
  }

  const inputStyle = {
    flex: 1, padding: '8px 12px', borderRadius: 8,
    background: 'var(--app-surface-2)', border: '1px solid var(--app-border)',
    color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif', fontSize: 12,
    fontVariantNumeric: 'tabular-nums',
  };

  const statusColor = status === 'saved' ? 'var(--clr-pos)'
    : status === 'error' ? 'var(--clr-neg)'
    : status === 'notfound' ? 'var(--clr-warn)'
    : 'var(--text-3)';

  const statusText = status === 'searching' ? 'Buscando...'
    : status === 'saving' ? 'Salvando...'
    : status === 'saved' ? 'Salvo!'
    : status === 'error' ? 'Erro ao salvar'
    : status === 'notfound' ? 'Não encontrado automaticamente'
    : status === 'found' && candidates.length > 1 ? `${candidates.length} candidatos encontrados`
    : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontFamily: 'Roboto,sans-serif', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
          Meta Ad ID
        </span>
        {statusText && (
          <span style={{ fontSize: 10, fontFamily: 'Roboto,sans-serif', color: statusColor }}>{statusText}</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={val}
          onChange={e => setVal(e.target.value)}
          placeholder="Ex: 120244206034940167"
          style={inputStyle}
          onFocus={e => e.target.style.borderColor = 'rgba(234,170,65,.4)'}
          onBlur={e => e.target.style.borderColor = 'var(--app-border)'}
        />
        <button onClick={() => saveId(val)} disabled={!val || status === 'saving'}
          style={{ padding: '8px 12px', borderRadius: 8, cursor: val ? 'pointer' : 'not-allowed',
            background: val ? 'rgba(234,170,65,.15)' : 'rgba(255,255,255,.05)',
            border: `1px solid ${val ? 'rgba(234,170,65,.3)' : 'var(--app-border)'}`,
            color: val ? 'var(--fmn-gold)' : 'var(--text-3)',
            fontFamily: 'Roboto,sans-serif', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>
          Salvar
        </button>
        <button onClick={autoSearch} title="Buscar automaticamente"
          style={{ width: 34, height: 34, borderRadius: 8, cursor: 'pointer',
            background: 'rgba(255,255,255,.05)', border: '1px solid var(--app-border)',
            color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LucideIcon icon={status === 'searching' ? 'loader' : 'search'} size={13}/>
        </button>
      </div>

      {/* Lista de candidatos quando há mais de 1 match */}
      {candidates.length > 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto',
          background: 'var(--app-surface-2)', border: '1px solid var(--app-border)', borderRadius: 8, padding: 8 }}>
          {candidates.map(ad => (
            <button key={ad.id} onClick={() => { setVal(ad.id); setCandidates([]); saveId(ad.id); }}
              style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer', textAlign: 'left',
                background: 'transparent', border: '1px solid transparent',
                color: 'var(--text-2)', fontFamily: 'Roboto,sans-serif', fontSize: 11, lineHeight: 1.4,
                transition: 'all 120ms' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(234,170,65,.08)'; e.currentTarget.style.borderColor = 'rgba(234,170,65,.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}>
              <span style={{ color: 'var(--fmn-gold)', fontWeight: 700 }}>{ad.id}</span>
              {' — '}{ad.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


/* ── AdicionarCriativoBtn ────────────────────────────────────────
   Fluxo A (preview). Roda o ffmpeg/otimização no Mac via serve.py.
   Auto: acha a pasta ADS no Drive. Manual: usuário cola a pasta.
─────────────────────────────────────────────────────────────────*/
function AdicionarCriativoBtn({ card, onDone }) {
  const [step, setStep] = useState('idle'); // idle | running | warn
  const [msg, setMsg]   = useState('');
  const adNum = parseInt(card.num, 10);

  async function run(pasta) {
    const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
    if (!isLocal) {
      setStep('warn'); setMsg('Precisa estar no Mac "Fotografia é o Meu Negócio"');
      setTimeout(() => { setStep('idle'); setMsg(''); }, 5000); return;
    }
    setStep('running'); setMsg('Buscando no Drive…');
    const qs = `numero=${adNum}` + (pasta ? `&pasta=${encodeURIComponent(pasta)}` : '');
    try { await fetch(`/api/adicionar-criativo?${qs}`, { method: 'POST' }); }
    catch { setStep('warn'); setMsg('Servidor local não respondeu'); setTimeout(() => { setStep('idle'); setMsg(''); }, 5000); return; }
    const poll = setInterval(async () => {
      try {
        const s = await (await fetch('/api/adicionar-criativo')).json();
        if (s.msg) setMsg(s.msg);
        if (!s.running) {
          clearInterval(poll);
          if (s.error) { setStep('warn'); setMsg(s.error); setTimeout(() => { setStep('idle'); setMsg(''); }, 6000); }
          else { setStep('idle'); setMsg(''); onDone && onDone(); }
        }
      } catch { clearInterval(poll); setStep('idle'); setMsg(''); }
    }, 2000);
  }

  function manual() {
    const p = window.prompt('Cole o link ou ID da pasta do criativo no Drive:');
    if (p && p.trim()) run(p.trim());
  }

  if (step === 'running') {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px',
        borderRadius:8, background:'rgba(56,189,248,.1)', border:'1px solid rgba(56,189,248,.3)',
        color:'#38bdf8', fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:11.5 }}>
        <LucideIcon icon="loader" size={13} style={{ animation:'spin 1s linear infinite' }}/>{msg || 'Otimizando…'}
      </div>
    );
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {step === 'warn' && (
        <div style={{ padding:'6px 10px', borderRadius:8, background:'rgba(248,113,113,.08)',
          border:'1px solid rgba(248,113,113,.3)', fontSize:11, color:'#f87171', lineHeight:1.4 }}>{msg}</div>
      )}
      <div style={{ display:'flex', gap:8 }}>
        <Btn variant="secondary" size="sm" icon="image-plus" style={{ flex:1, justifyContent:'center' }}
          onClick={() => run(null)}>Adicionar criativo</Btn>
        <Btn variant="ghost" size="sm" icon="folder" style={{ justifyContent:'center' }}
          onClick={manual} title="Escolher a pasta do Drive manualmente">Pasta</Btn>
      </div>
    </div>
  );
}

/* ── R2UploadSection ─────────────────────────────────────────────*/
const ADS_MEDIA_WORKER = 'https://ads-media.blindagem-fmn.workers.dev';

function R2UploadSection({ card, onUploadComplete }) {
  const [step, setStep]         = useState('idle'); // idle|files-ready|compressing|uploading-thumb|uploading-original|uploading-meta|done|error
  const [progress, setProgress] = useState('');
  const [errMsg, setErrMsg]     = useState('');
  const [carouselFiles, setCarouselFiles]     = useState([]); // File[] para carrossel
  const [carouselPreviews, setCarouselPreviews] = useState([]); // object URLs
  const fileRef                 = useRef(null);

  const adNum        = parseInt(card.num, 10);
  const isMigration  = !!card.raw?.media_drive_url && !card.raw?.thumb_url;
  const isCarrossel  = card.raw?.tipo === 'carrossel';

  async function compressImage(file) {
    return new Promise((resolve, reject) => {
      const isPng = file.type === 'image/png';
      const img   = new Image();
      const url   = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.width, h = img.height;
        if (Math.max(w, h) > 1920) {
          const r = 1920 / Math.max(w, h);
          w = Math.round(w * r); h = Math.round(h * r);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        // PNG com transparência → mantém PNG; PNG opaco → converte para JPEG 80%
        let outMime = 'image/jpeg';
        if (isPng) {
          const pixels = ctx.getImageData(0, 0, w, h).data;
          let hasAlpha = false;
          for (let i = 3; i < pixels.length; i += 4) {
            if (pixels[i] < 255) { hasAlpha = true; break; }
          }
          if (hasAlpha) outMime = 'image/png';
        }

        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Falha na compressão')),
          outMime, 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Falha ao ler imagem')); };
      img.src = url;
    });
  }

  // Comprime vídeo via Canvas + MediaRecorder (sem SharedArrayBuffer, sem FFmpeg.wasm)
  // Target: 3 Mbps, máx 1080p. Processa em tempo real (60s de vídeo = 60s de compressão).
  async function compressVideo(file, onProgress) {
    return new Promise((resolve, reject) => {
      const video  = document.createElement('video');
      const objUrl = URL.createObjectURL(file);
      video.src = objUrl; video.muted = true; video.playsInline = true;

      video.onloadedmetadata = async () => {
        const duration = video.duration;
        let w = video.videoWidth, h = video.videoHeight;
        if (Math.max(w, h) > 1080) {
          const r = 1080 / Math.max(w, h);
          w = Math.round(w * r); h = Math.round(h * r);
        }
        w = w % 2 === 0 ? w : w - 1;
        h = h % 2 === 0 ? h : h - 1;

        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');

        // Combina vídeo do canvas com áudio do elemento original
        const canvasStream = canvas.captureStream(30);
        const combined = new MediaStream();
        canvasStream.getVideoTracks().forEach(t => combined.addTrack(t));
        const srcStream = video.captureStream ? video.captureStream() : null;
        if (srcStream) srcStream.getAudioTracks().forEach(t => combined.addTrack(t));

        const mimeType = [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8',
          'video/webm',
        ].find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm';

        const recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 3_000_000 });
        const chunks   = [];

        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
          URL.revokeObjectURL(objUrl);
          resolve(new Blob(chunks, { type: 'video/webm' }));
        };
        recorder.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error('Erro ao gravar vídeo')); };

        video.onended = () => {
          cancelAnimationFrame(video._rafId);
          setTimeout(() => recorder.stop(), 300);
        };
        video.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error('Falha ao ler vídeo')); };

        function drawLoop() {
          if (!video.ended && !video.paused) {
            ctx.drawImage(video, 0, 0, w, h);
            if (onProgress && duration > 0) onProgress(Math.min(video.currentTime / duration, 1));
          }
          if (!video.ended) video._rafId = requestAnimationFrame(drawLoop);
        }

        recorder.start(200);
        try { await video.play(); } catch(e) { URL.revokeObjectURL(objUrl); reject(e); return; }
        drawLoop();
      };
      video.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error('Falha ao ler vídeo')); };
    });
  }

  async function captureFrame(videoBlob) {
    return new Promise(resolve => {
      const video = document.createElement('video');
      const url   = URL.createObjectURL(videoBlob);
      video.src = url; video.muted = true;
      video.onloadeddata = () => { video.currentTime = 1; };
      video.onseeked = () => {
        const c = document.createElement('canvas');
        c.width = video.videoWidth; c.height = video.videoHeight;
        c.getContext('2d').drawImage(video, 0, 0);
        URL.revokeObjectURL(url);
        c.toBlob(b => resolve(b), 'image/webp', 0.82);
      };
      video.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    });
  }

  function fmtBytes(b) {
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  }

  function handleCarouselFilesSelected(files) {
    const arr = Array.from(files);
    if (!arr.length) return;
    // Revoga previews anteriores
    carouselPreviews.forEach(u => URL.revokeObjectURL(u));
    const previews = arr.map(f => f.type.startsWith('video/') ? null : URL.createObjectURL(f));
    setCarouselFiles(arr);
    setCarouselPreviews(previews);
    setStep('files-ready');
    setErrMsg('');
  }

  async function handleCarouselUpload() {
    const files = carouselFiles;
    if (!files.length) return;
    setErrMsg('');
    const results = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file  = files[i];
        const isVid = file.type.startsWith('video/');
        const origExt = file.name.split('.').pop().toLowerCase() || (isVid ? 'mp4' : 'jpg');

        setStep('compressing');
        let lastPct = -1;
        let optimized, thumbBlob = null;
        if (isVid) {
          optimized = await compressVideo(file, pct => {
            const p = Math.round(pct * 100);
            if (p - lastPct >= 5) { lastPct = p; setProgress(`${i+1}/${files.length} · ${p}%`); }
          });
          thumbBlob = await captureFrame(optimized);
        } else {
          optimized = await compressImage(file);
        }

        setStep('uploading-thumb');
        setProgress(`${i+1}/${files.length}`);
        const imgExt = isVid ? 'webm' : (optimized.type === 'image/png' ? 'png' : 'jpg');
        const tForm = new FormData();
        tForm.append('file', new File([optimized], `ad${adNum}_s${i+1}.${imgExt}`, { type: isVid?'video/webm':(optimized.type||'image/jpeg') }));
        tForm.append('ad_num', String(adNum));
        if (thumbBlob) tForm.append('thumb_frame', new File([thumbBlob], 'thumb.webp', { type:'image/webp' }));

        const tRes = await fetch(`${ADS_MEDIA_WORKER}/upload-thumb`, { method:'POST', body:tForm });
        if (!tRes.ok) throw new Error(`Arquivo ${i+1}: erro R2 (${tRes.status})`);
        const { thumbUrl, mediaUrl } = await tRes.json();
        results.push({ thumbUrl, mediaUrl });
      }

      carouselPreviews.forEach(u => u && URL.revokeObjectURL(u));
      const thumbUrl = results[0].thumbUrl;
      const mediaUrl = JSON.stringify(results.map(r => r.mediaUrl));
      await window.db.from('ads').update({ thumb_url: thumbUrl, media_url: mediaUrl }).eq('numero', adNum);
      setProgress('');
      setStep('done');
      if (onUploadComplete) onUploadComplete({ thumbUrl, mediaUrl, metaImageHash:null, metaVideoId:null });
    } catch(err) {
      setStep('error');
      setErrMsg(err.message || 'Erro desconhecido');
    }
  }

  async function handleFile(file) {
    setErrMsg('');
    const isVid  = file.type.startsWith('video/');
    const fileMB = file.size / (1024 * 1024);

    try {
      let optimized, thumbBlob = null;
      const origExt = file.name.split('.').pop().toLowerCase() || (isVid ? 'mp4' : 'jpg');

      setStep('compressing');
      if (isVid) {
        setProgress(`0% · ${fmtBytes(file.size)} original`);
        let lastPct = -1;
        optimized = await compressVideo(file, pct => {
          const p = Math.round(pct * 100);
          if (p - lastPct >= 5) { lastPct = p; setProgress(`${p}%`); }
        });
        thumbBlob = await captureFrame(optimized);
        setProgress('');
      } else {
        optimized = await compressImage(file);
      }

      setStep('uploading-thumb');
      if (isVid) setProgress(fmtBytes(optimized.size));
      const tForm = new FormData();
      const imgExt2 = isVid ? 'webm' : (optimized.type === 'image/png' ? 'png' : 'jpg');
      const tName = `ad${adNum}.${imgExt2}`;
      const tType = isVid ? 'video/webm' : (optimized.type || 'image/jpeg');
      tForm.append('file', new File([optimized], tName, { type: tType }));
      tForm.append('ad_num', String(adNum));
      if (thumbBlob) tForm.append('thumb_frame', new File([thumbBlob], 'thumb.webp', { type: 'image/webp' }));

      const tRes  = await fetch(`${ADS_MEDIA_WORKER}/upload-thumb`, { method:'POST', body:tForm });
      if (!tRes.ok) throw new Error(`Erro ao subir no R2 (${tRes.status})`);
      setProgress('');
      const { thumbUrl, mediaUrl } = await tRes.json();

      // R2 upload é apenas para visualização no Tracker.
      // O envio ao Meta acontece via botão "Publicar", não aqui.
      await window.db.from('ads').update({ thumb_url: thumbUrl, media_url: mediaUrl }).eq('numero', adNum);

      setStep('done');
      if (onUploadComplete) onUploadComplete({ thumbUrl, mediaUrl, metaImageHash: null, metaVideoId: null });
    } catch(err) {
      setStep('error');
      setErrMsg(err.message || 'Erro desconhecido');
    }
  }

  const STEP_ORDER   = ['compressing','uploading-thumb','done'];
  const STEP_LABELS  = { compressing:'Comprimindo', 'uploading-thumb':'Subindo no R2', done:'Concluído' };
  const visibleSteps = ['compressing','uploading-thumb','done'];

  if (step === 'idle' || step === 'files-ready') {
    if (isCarrossel) {
      return (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display:'none' }}
            onChange={e => e.target.files?.length && handleCarouselFilesSelected(e.target.files)}/>
          <button onClick={() => fileRef.current?.click()}
            style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              padding:'7px 12px', borderRadius:8, cursor:'pointer',
              background:'rgba(234,170,65,.1)', border:'1px solid rgba(234,170,65,.3)',
              color:'var(--fmn-gold)', fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:11.5,
              transition:'all 150ms' }}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(234,170,65,.18)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(234,170,65,.1)'}>
            <LucideIcon icon="images" size={13}/>
            {step === 'files-ready' ? `Trocar arquivos (${carouselFiles.length})` : (isMigration ? 'Migrar slides p/ R2' : 'Selecionar slides')}
          </button>
          {step === 'files-ready' && carouselFiles.length > 0 && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:4 }}>
                {carouselFiles.map((f, i) => (
                  <div key={i} style={{ borderRadius:5, overflow:'hidden', background:'rgba(255,255,255,.06)',
                    border:'1px solid rgba(255,255,255,.1)', aspectRatio:'1', display:'flex',
                    alignItems:'center', justifyContent:'center' }}>
                    {carouselPreviews[i]
                      ? <img src={carouselPreviews[i]} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                      : <LucideIcon icon="film" size={16} style={{ color:'var(--text-3)' }}/>
                    }
                  </div>
                ))}
              </div>
              <button onClick={handleCarouselUpload}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                  padding:'8px 12px', borderRadius:8, cursor:'pointer',
                  background:'rgba(74,222,128,.12)', border:'1px solid rgba(74,222,128,.3)',
                  color:'#4ade80', fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:11.5 }}>
                <LucideIcon icon="upload-cloud" size={13}/>
                Subir {carouselFiles.length} arquivo{carouselFiles.length > 1 ? 's' : ''} no R2
              </button>
            </>
          )}
        </div>
      );
    }
    return (
      <>
        <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display:'none' }}
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}/>
        <button onClick={() => fileRef.current?.click()}
          style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6,
            padding:'7px 12px', borderRadius:8, cursor:'pointer',
            background:'rgba(234,170,65,.1)', border:'1px solid rgba(234,170,65,.3)',
            color:'var(--fmn-gold)', fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:11.5,
            transition:'all 150ms' }}
          onMouseEnter={e=>e.currentTarget.style.background='rgba(234,170,65,.18)'}
          onMouseLeave={e=>e.currentTarget.style.background='rgba(234,170,65,.1)'}>
          <LucideIcon icon="upload" size={13}/>
          {isMigration ? 'Migrar para R2' : 'Upload R2'}
        </button>
      </>
    );
  }

  if (step === 'error') {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <div style={{ padding:'8px 12px', borderRadius:8, background:'rgba(248,113,113,.1)',
          border:'1px solid rgba(248,113,113,.3)', fontSize:11, color:'#f87171', fontFamily:'Roboto,sans-serif' }}>
          {errMsg}
        </div>
        <button onClick={() => { setStep('idle'); setErrMsg(''); }}
          style={{ padding:'6px 12px', borderRadius:7, background:'rgba(255,255,255,.06)',
            border:'1px solid var(--app-border)', color:'var(--text-3)',
            fontFamily:'Roboto,sans-serif', fontSize:11, cursor:'pointer' }}>
          Tentar novamente
        </button>
      </div>
    );
  }

  const curIdx = STEP_ORDER.indexOf(step);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6, padding:'8px 12px', borderRadius:8,
      background:'rgba(234,170,65,.04)', border:'1px solid rgba(234,170,65,.15)' }}>
      {visibleSteps.map(s => {
        const sIdx = STEP_ORDER.indexOf(s);
        const done   = step === 'done' || curIdx > sIdx;
        const active = step === s;
        return (
          <div key={s} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:16, height:16, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
              border:`2px solid ${done ? 'var(--clr-pos)' : active ? 'var(--fmn-gold)' : 'rgba(255,255,255,.15)'}`,
              background: done ? 'var(--clr-pos)' : 'transparent' }}>
              {done && <LucideIcon icon="check" size={9} style={{ color:'#000' }}/>}
              {active && !done && <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--fmn-gold)' }}/>}
            </div>
            <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif',
              color: done ? 'var(--clr-pos)' : active ? 'var(--fmn-gold)' : 'rgba(255,255,255,.2)' }}>
              {STEP_LABELS[s]}{active && progress ? ` ${progress}` : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── AdsDetailModal ──────────────────────────────────────────────*/
function AdsDetailModal({ card, onClose, onUpdate, siblings=[], onNavigate }) {
  const raw = card.raw || {};
  const col = ADS_COLUMNS.find(cl => cl.id === card.col) || ADS_COLUMNS[0];
  const cpaColor = getCpaColor(card.cpa);
  const [showMeta, setShowMeta]     = useState(false);
  const [noMediaAlert, setNoMediaAlert] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | error
  const [copiedField, setCopiedField] = useState(null);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);

  // ESC fecha o modal
  React.useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Estado de todos os campos editáveis
  const [fields, setFields] = useState({
    titulo:           raw.titulo          || '',
    status:           raw.status          || card.col,
    tipo:             raw.tipo            || 'reels',
    headline:         raw.headline        || '',
    roteiro:          raw.roteiro         || '',
    estetica_visual:  raw.estetica_visual || '',
    hook_visual:      raw.hook_visual     || '',
    hook_copy:        raw.hook_copy       || '',
    desenvolvimento_cta: raw.desenvolvimento_cta || '',
    texto_principal:  raw.texto_principal || '',
    titulo_ad:        raw.titulo_ad       || '',
    descricao_ad:     raw.descricao_ad    || '',
    observacoes:      raw.observacoes     || '',
    referencia:       raw.referencia      || '',
    meta_ad_url:      raw.meta_ad_url     || '',
    media_drive_url:  raw.media_drive_url || '',
    media_tipo:       raw.media_tipo      || '',
  });

  const [showDriveInput, setShowDriveInput] = useState(false);
  const [driveInputVal, setDriveInputVal]   = useState(raw.media_drive_url || '');
  const [driveInputTipo, setDriveInputTipo] = useState(raw.tipo || 'reels');
  const [carouselIdx, setCarouselIdx]       = useState(0);

  const sibIdx  = siblings.findIndex(s => s.id === card.id);
  const hasPrev = sibIdx > 0;
  const hasNext = sibIdx >= 0 && sibIdx < siblings.length - 1;
  const goPrev  = () => { if (hasPrev) onNavigate?.(siblings[sibIdx - 1]); };
  const goNext  = () => { if (hasNext) onNavigate?.(siblings[sibIdx + 1]); };

  // Arquivos sincronizados do Drive (array JSONB)
  const mediaFiles = (() => { try { return Array.isArray(raw.media_files) ? raw.media_files : JSON.parse(raw.media_files || '[]'); } catch { return []; } })();
  const isCarousel = /carrossel/i.test(fields.tipo) && mediaFiles.length > 1;
  const currentFile = isCarousel ? mediaFiles[carouselIdx] : mediaFiles[0];

  function parseDriveUrl(url) {
    if (!url) return null;
    const fileMatch = url.match(/\/file\/d\/([^/]+)/);
    const idMatch   = url.match(/[?&]id=([^&]+)/);
    const id = fileMatch?.[1] || idMatch?.[1];
    if (!id) return null;
    return id;
  }
  function drivePreviewUrl(fileId, tipo) {
    if (!fileId) return null;
    if (tipo === 'video' || tipo === 'reels') return `https://drive.google.com/file/d/${fileId}/preview`;
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
  }

  // URLs R2 do ad (JSON array ou string simples)
  const r2Urls = (() => {
    try {
      const v = raw.media_url;
      if (!v) return [];
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch { return raw.media_url ? [raw.media_url] : []; }
  })();
  const r2CurrentUrl = r2Urls[isCarousel ? carouselIdx : 0] || null;

  const cardIsVideo = /reels/i.test(raw.tipo) || raw.tipo === 'video';

  // Preview: R2 tem prioridade sobre Drive (após migração/upload R2, não puxar mais do Drive)
  let previewEmbed = null;
  let previewIsVideo = false;
  let previewViewUrl = null;
  let isR2Embed = false;

  if (r2CurrentUrl) {
    previewEmbed   = r2CurrentUrl;
    previewIsVideo = cardIsVideo || /\.(webm|mp4|mov)$/i.test(r2CurrentUrl);
    previewViewUrl = r2CurrentUrl;
    isR2Embed      = true;
  } else if (isCarousel && currentFile) {
    previewEmbed    = drivePreviewUrl(currentFile.file_id, currentFile.tipo);
    previewIsVideo  = /^(video|reels)$/i.test(currentFile.tipo) || cardIsVideo;
    previewViewUrl  = currentFile.url_view;
  } else if (currentFile) {
    previewEmbed    = drivePreviewUrl(currentFile.file_id, currentFile.tipo);
    previewIsVideo  = /^(video|reels)$/i.test(currentFile.tipo) || cardIsVideo;
    previewViewUrl  = currentFile.url_view;
  } else {
    // fallback legado: media_drive_url
    const driveId = parseDriveUrl(fields.media_drive_url);
    if (driveId) {
      previewIsVideo = /^reels$/i.test(fields.tipo) || fields.media_tipo === 'video';
      previewEmbed   = previewIsVideo
        ? `https://drive.google.com/file/d/${driveId}/preview`
        : `https://drive.google.com/thumbnail?id=${driveId}&sz=w800`;
      previewViewUrl = `https://drive.google.com/file/d/${driveId}/view`;
    }
  }

  const driveId = parseDriveUrl(fields.media_drive_url);
  const isVideo = previewIsVideo;

  function vincularDrive() {
    const url = driveInputVal.trim();
    if (!url) return;
    const id = parseDriveUrl(url);
    if (!id) { alert('URL inválida. Cole o link de compartilhamento do Google Drive.'); return; }
    const midiaTipo = driveInputTipo === 'imagem' ? 'imagem' : 'video';
    set('media_drive_url', url);
    set('media_tipo', midiaTipo);
    set('tipo', driveInputTipo);
    setShowDriveInput(false);
  }

  const set = (key, val) => setFields(f => ({ ...f, [key]: val }));

  async function salvar() {
    setSaveStatus('saving');
    const { error } = await window.db.from('ads').update(fields).eq('numero', parseInt(card.num, 10));
    if (error) { setSaveStatus('error'); return; }
    setSaveStatus('saved');
    if (onUpdate) onUpdate({ ...card, col: fields.status, hook: fields.titulo, raw: { ...raw, ...fields } });
    setTimeout(() => setSaveStatus('idle'), 2000);
  }

  async function mudarStatus(novoStatus) {
    const patch = { status: novoStatus };
    const novaTag = resolveTag(novoStatus, fields.status, card.vendas, card.cpa, card.gasto);
    if (novaTag !== null) { patch.tag = novaTag; set('tag', novaTag); }
    set('status', novoStatus);
    await window.db.from('ads').update(patch).eq('numero', parseInt(card.num, 10));
    if (onUpdate) onUpdate({ ...card, col: novoStatus, raw: { ...raw, status: novoStatus, tag: patch.tag ?? raw.tag } });
  }

  async function retirarDoTeste() {
    const novaTag = classifyAd(card.vendas, card.cpa, card.gasto);
    const patch = { status: 'arquivado', tag: novaTag };
    set('status', 'arquivado'); set('tag', novaTag);
    await window.db.from('ads').update(patch).eq('numero', parseInt(card.num, 10));
    if (onUpdate) onUpdate({ ...card, col: 'arquivado', raw: { ...raw, status: 'arquivado', tag: novaTag } });
  }

  async function deletarAd() {
    setDeleting(true);
    await window.db.from('ads').delete().eq('numero', parseInt(card.num, 10));
    if (onUpdate) onUpdate({ ...card, deleted: true });
    onClose();
  }

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    });
  };

  function CopyField({ id, label, fieldKey, rows = 3, hint }) {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
            letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)' }}>{label}</span>
          <button onClick={() => copyToClipboard(fields[fieldKey], id)}
            style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:5,
              background: copiedField===id ? 'rgba(74,222,128,.15)' : 'rgba(255,255,255,.06)',
              border:'1px solid var(--app-border)', color: copiedField===id ? 'var(--clr-pos)' : 'var(--text-3)',
              fontSize:10, fontFamily:'Roboto,sans-serif', cursor:'pointer', transition:'all 150ms' }}>
            <LucideIcon icon={copiedField===id?'check':'copy'} size={11}/>
            {copiedField===id?'Copiado!':'Copiar'}
          </button>
        </div>
        {hint && (
          <div style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'var(--text-3)',
            lineHeight:1.5, fontStyle:'italic' }}>{hint}</div>
        )}
        <textarea value={fields[fieldKey]} onChange={e => set(fieldKey, e.target.value)} rows={rows}
          style={{ width:'100%', padding:'9px 12px', borderRadius:8, resize:'vertical',
            background:'var(--app-surface-2)', border:'1px solid var(--app-border)',
            color:'var(--text-1)', fontFamily:'Roboto,sans-serif', fontSize:13, lineHeight:1.55,
            transition:'border-color 150ms' }}
          onFocus={e=>e.target.style.borderColor='rgba(234,170,65,.4)'}
          onBlur={e=>e.target.style.borderColor='var(--app-border)'}/>
      </div>
    );
  }

  function PropRow({ label, children }) {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
          letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)' }}>{label}</span>
        <div style={{ fontSize:13, fontFamily:'Roboto,sans-serif', fontWeight:500, color:'var(--text-1)', lineHeight:1.4 }}>
          {children}
        </div>
      </div>
    );
  }

  const currentCol = ADS_COLUMNS.find(c => c.id === fields.status) || col;

  return (
    <>
      <div onClick={onClose} style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:500,
        display:'flex', alignItems:'stretch', justifyContent:'stretch',
        padding:'20px',
      }}>
        <div onClick={e=>e.stopPropagation()}
          style={{ flex:1, background:'var(--app-surface)',
            border:'1px solid var(--app-border-2)', borderRadius:16, overflow:'hidden',
            boxShadow:'0 32px 80px rgba(0,0,0,.65)', display:'flex', flexDirection:'column' }}>

          {/* Header */}
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--app-border)',
            display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
              <button onClick={onClose}
                style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0,
                  color:'var(--text-2)', cursor:'pointer', fontFamily:'Roboto,sans-serif',
                  fontSize:11, fontWeight:700, letterSpacing:'0.04em', textTransform:'uppercase',
                  padding:'5px 10px', borderRadius:6, background:'rgba(255,255,255,.05)',
                  border:'1px solid var(--app-border)', transition:'color 150ms' }}
                onMouseEnter={e=>e.currentTarget.style.color='var(--fmn-gold)'}
                onMouseLeave={e=>e.currentTarget.style.color='var(--text-2)'}>
                <LucideIcon icon="chevron-left" size={14}/>Criativos
              </button>
              {siblings.length > 1 && (
                <div style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
                  <button onClick={goPrev} disabled={!hasPrev} title="Card anterior na coluna"
                    style={{ width:26, height:26, borderRadius:7, cursor: hasPrev ? 'pointer' : 'default',
                      background:'rgba(255,255,255,.06)', border:'1px solid var(--app-border)',
                      color: hasPrev ? 'var(--text-2)' : 'rgba(255,255,255,.15)',
                      display:'flex', alignItems:'center', justifyContent:'center', transition:'all 150ms' }}
                    onMouseEnter={e => hasPrev && (e.currentTarget.style.color='var(--fmn-gold)')}
                    onMouseLeave={e => e.currentTarget.style.color = hasPrev ? 'var(--text-2)' : 'rgba(255,255,255,.15)'}>
                    <LucideIcon icon="chevron-up" size={13}/>
                  </button>
                  <button onClick={goNext} disabled={!hasNext} title="Próximo card na coluna"
                    style={{ width:26, height:26, borderRadius:7, cursor: hasNext ? 'pointer' : 'default',
                      background:'rgba(255,255,255,.06)', border:'1px solid var(--app-border)',
                      color: hasNext ? 'var(--text-2)' : 'rgba(255,255,255,.15)',
                      display:'flex', alignItems:'center', justifyContent:'center', transition:'all 150ms' }}
                    onMouseEnter={e => hasNext && (e.currentTarget.style.color='var(--fmn-gold)')}
                    onMouseLeave={e => e.currentTarget.style.color = hasNext ? 'var(--text-2)' : 'rgba(255,255,255,.15)'}>
                    <LucideIcon icon="chevron-down" size={13}/>
                  </button>
                  <span style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', color:'var(--text-3)', minWidth:28 }}>
                    {sibIdx + 1}/{siblings.length}
                  </span>
                </div>
              )}
              <span style={{ fontSize:12, fontFamily:'Roboto,sans-serif', fontWeight:900,
                letterSpacing:'0.08em', textTransform:'uppercase', color:currentCol.colorDot,
                background:`${currentCol.colorDot}20`, border:`1px solid ${currentCol.colorDot}40`,
                borderRadius:6, padding:'3px 9px', flexShrink:0 }}>
                ADS {card.num}
              </span>
              <input value={fields.titulo} onChange={e => set('titulo', e.target.value)}
                placeholder="Título do criativo"
                style={{ fontSize:14.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
                  color:'var(--text-1)', lineHeight:1.4, background:'transparent',
                  border:'1px solid transparent', borderRadius:6, padding:'2px 6px',
                  outline:'none', flex:1, minWidth:120, transition:'border-color 150ms' }}
                onFocus={e => e.target.style.borderColor='rgba(234,170,65,.4)'}
                onBlur={e => e.target.style.borderColor='transparent'}/>
            </div>
            <div style={{ display:'flex', gap:8, flexShrink:0, alignItems:'center' }}>
              {saveStatus === 'saved' && (
                <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'var(--clr-pos)' }}>Salvo!</span>
              )}
              {saveStatus === 'error' && (
                <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'var(--clr-neg)' }}>Erro ao salvar</span>
              )}
              {/* Delete com confirmação */}
              {deleteConfirm ? (
                <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 10px',
                  borderRadius:8, background:'rgba(248,113,113,.1)', border:'1px solid rgba(248,113,113,.3)' }}>
                  <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'#f87171' }}>Confirmar?</span>
                  <button onClick={deletarAd} disabled={deleting}
                    style={{ padding:'4px 10px', borderRadius:6, background:'#f87171', color:'#fff',
                      fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:11, cursor:'pointer' }}>
                    {deleting ? '...' : 'Apagar'}
                  </button>
                  <button onClick={() => setDeleteConfirm(false)}
                    style={{ padding:'4px 8px', borderRadius:6, background:'rgba(255,255,255,.07)',
                      border:'1px solid var(--app-border)', color:'var(--text-3)',
                      fontFamily:'Roboto,sans-serif', fontSize:11, cursor:'pointer' }}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <button onClick={() => setDeleteConfirm(true)}
                  title="Apagar AD"
                  style={{ padding:'7px 12px', borderRadius:8, background:'rgba(248,113,113,.08)',
                    border:'1px solid rgba(248,113,113,.2)', color:'#f87171', cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:12 }}>
                  <LucideIcon icon="trash-2" size={13}/>
                </button>
              )}
              {fields.status === 'testar-novamente' && (
                <button onClick={retirarDoTeste}
                  title="Arquivar este AD com tag de performance calculada"
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px',
                    background:'rgba(167,139,250,.12)', color:'#a78bfa', borderRadius:8,
                    border:'1px solid rgba(167,139,250,.3)', fontFamily:'Roboto,sans-serif',
                    fontWeight:700, fontSize:11.5, cursor:'pointer' }}>
                  <LucideIcon icon="archive" size={14}/>Retirar do teste
                </button>
              )}
              <div style={{ position:'relative' }}>
                <button onClick={() => { const temMidia = r2Urls.length || raw.meta_image_hash || raw.meta_video_id || mediaFiles.length; if (!temMidia) { setNoMediaAlert(true); setTimeout(() => setNoMediaAlert(false), 3500); } else setShowMeta(true); }}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px',
                    background:'rgba(234,170,65,.12)', color:'var(--fmn-gold)', borderRadius:8,
                    border:'1px solid rgba(234,170,65,.35)', fontFamily:'Roboto,sans-serif',
                    fontWeight:700, fontSize:11.5, cursor:'pointer' }}>
                  <LucideIcon icon="send" size={14}/>Publicar
                </button>
                {noMediaAlert && (
                  <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, zIndex:10,
                    background:'var(--app-surface)', border:'1px solid rgba(248,113,113,.35)',
                    borderRadius:10, padding:'10px 14px', width:220, boxShadow:'0 8px 24px rgba(0,0,0,.5)',
                    display:'flex', alignItems:'flex-start', gap:8 }}>
                    <LucideIcon icon="link-2-off" size={14} style={{ color:'#f87171', flexShrink:0, marginTop:1 }}/>
                    <span style={{ fontSize:12, fontFamily:'Roboto,sans-serif', color:'var(--text-2)', lineHeight:1.5 }}>
                      Criativo sem mídia. Faça o upload do arquivo no card antes de subir no Meta.
                    </span>
                  </div>
                )}
              </div>
              <Btn variant="ghost" size="sm" onClick={onClose}>Cancelar</Btn>
              <Btn variant="primary" size="sm" icon={saveStatus==='saving'?'loader':'save'}
                onClick={salvar} disabled={saveStatus==='saving'}>
                {saveStatus==='saving'?'Salvando...':'Salvar'}
              </Btn>
            </div>
          </div>

          {/* Body: 2 painéis */}
          <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
            {/* Painel esquerdo — mídia */}
            <div style={{ width:340, flexShrink:0, borderRight:'1px solid var(--app-border)',
              background:'rgba(0,0,0,.25)', display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center', padding:24, gap:16, overflowY:'auto' }}>
                <div style={{ borderRadius:12, overflow:'hidden', position:'relative',
                  width:'100%', height:380,
                  background: previewIsVideo ? '#000' : 'var(--app-surface-2)',
                  border: previewIsVideo ? 'none' : '1px solid var(--app-border)' }}>
                  {previewEmbed ? (
                    <>
                      {previewIsVideo
                        ? videoPlaying
                          ? isR2Embed
                            ? <video src={previewEmbed} autoPlay controls
                                style={{ width:'100%', height:'100%', display:'block', objectFit:'contain' }}/>
                            : <iframe src={`${previewEmbed}?rm=minimal&autoplay=1`} style={{ width:'100%', height:'100%', border:'none', display:'block' }}
                                allow="autoplay" title="Prévia do vídeo"/>
                          : <div onClick={() => setVideoPlaying(true)}
                              style={{ width:'100%', height:'100%', position:'relative', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                              <img
                                src={`/thumbnails/${raw.numero}.jpg`}
                                alt="thumb"
                                onError={e => { e.currentTarget.style.display='none'; }}
                                style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'contain' }}/>
                              <div style={{ position:'relative', zIndex:1, width:52, height:52, borderRadius:'50%',
                                background:'rgba(0,0,0,.65)', display:'flex', alignItems:'center', justifyContent:'center',
                                backdropFilter:'blur(4px)', border:'2px solid rgba(255,255,255,.3)' }}>
                                <LucideIcon icon="play" size={22} style={{ color:'#fff', marginLeft:3 }}/>
                              </div>
                            </div>
                        : <img src={previewEmbed} alt="Prévia"
                            style={{ width:'100%', height:'100%', display:'block', objectFit:'contain' }}/>
                      }
                      {/* Navegação carrossel */}
                      {isCarousel && (
                        <>
                          {carouselIdx > 0 && (
                            <button onClick={() => setCarouselIdx(i => i - 1)}
                              style={{ position:'absolute', left:6, top:'50%', transform:'translateY(-50%)',
                                width:28, height:28, borderRadius:'50%', border:'none',
                                background:'rgba(0,0,0,.55)', color:'#fff', cursor:'pointer',
                                display:'flex', alignItems:'center', justifyContent:'center', zIndex:2 }}>
                              <LucideIcon icon="chevron-left" size={16}/>
                            </button>
                          )}
                          {carouselIdx < mediaFiles.length - 1 && (
                            <button onClick={() => setCarouselIdx(i => i + 1)}
                              style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)',
                                width:28, height:28, borderRadius:'50%', border:'none',
                                background:'rgba(0,0,0,.55)', color:'#fff', cursor:'pointer',
                                display:'flex', alignItems:'center', justifyContent:'center', zIndex:2 }}>
                              <LucideIcon icon="chevron-right" size={16}/>
                            </button>
                          )}
                          {/* Dots */}
                          <div style={{ position:'absolute', bottom:8, left:0, right:0,
                            display:'flex', justifyContent:'center', gap:5, zIndex:2 }}>
                            {mediaFiles.map((_, i) => (
                              <div key={i} onClick={() => setCarouselIdx(i)}
                                style={{ width: i===carouselIdx ? 16 : 6, height:6, borderRadius:3,
                                  background: i===carouselIdx ? 'var(--fmn-gold)' : 'rgba(255,255,255,.4)',
                                  cursor:'pointer', transition:'all 200ms' }}/>
                            ))}
                          </div>
                          {/* Contador */}
                          <div style={{ position:'absolute', top:8, right:8,
                            background:'rgba(0,0,0,.55)', borderRadius:6, padding:'2px 7px',
                            fontSize:10, fontFamily:'Roboto,sans-serif', color:'#fff', zIndex:2 }}>
                            {carouselIdx + 1}/{mediaFiles.length}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
                      justifyContent:'center', gap:10, height:'100%' }}>
                      <div style={{ width:52, height:52, borderRadius:12, background:'rgba(255,255,255,.05)',
                        display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <LucideIcon icon="play-circle" size={28} color="rgba(255,255,255,.22)"/>
                      </div>
                      <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', fontWeight:700,
                        letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--text-3)' }}>Prévia da Mídia</span>
                      <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'var(--text-3)',
                        textAlign:'center', maxWidth:160, lineHeight:1.5 }}>Sincronize a pasta no Drive</span>
                    </div>
                  )}
                </div>
                {showDriveInput ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {/* Seletor de tipo */}
                    <div style={{ display:'flex', gap:6 }}>
                      {[['reels','Reels'],['imagem','Imagem'],['carrossel','Carrossel']].map(([val, label]) => (
                        <button key={val} onClick={() => setDriveInputTipo(val)}
                          style={{ flex:1, padding:'6px 0', borderRadius:7, fontSize:11,
                            fontFamily:'Roboto,sans-serif', fontWeight:700, cursor:'pointer',
                            border: driveInputTipo === val ? '1.5px solid var(--fmn-gold)' : '1px solid var(--app-border)',
                            background: driveInputTipo === val ? 'rgba(234,170,65,.15)' : 'rgba(255,255,255,.04)',
                            color: driveInputTipo === val ? 'var(--fmn-gold)' : 'var(--text-3)',
                            transition:'all 120ms' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {/* URL + confirmar */}
                    <div style={{ display:'flex', gap:6 }}>
                      <input value={driveInputVal} onChange={e => setDriveInputVal(e.target.value)}
                        placeholder="Cole o link do Google Drive..."
                        style={{ flex:1, padding:'7px 10px', borderRadius:8, fontSize:11.5,
                          fontFamily:'Roboto,sans-serif', background:'var(--app-surface-2)',
                          border:'1px solid var(--app-border)', color:'var(--text-1)', colorScheme:'dark' }}/>
                      <button onClick={vincularDrive}
                        style={{ padding:'7px 12px', borderRadius:8, background:'var(--fmn-gold)',
                          color:'var(--fmn-black)', fontFamily:'Roboto,sans-serif', fontWeight:700,
                          fontSize:11.5, cursor:'pointer' }}>OK</button>
                      <button onClick={() => setShowDriveInput(false)}
                        style={{ padding:'7px 10px', borderRadius:8, background:'rgba(255,255,255,.06)',
                          border:'1px solid var(--app-border)', color:'var(--text-3)',
                          fontFamily:'Roboto,sans-serif', fontSize:11.5, cursor:'pointer' }}>×</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {/* Novo fluxo: puxa do Drive e gera o preview (Fluxo A) */}
                    <AdicionarCriativoBtn card={card} onDone={async () => {
                      const { data } = await window.db.from('ads')
                        .select('media_url,thumb_url,tipo,media_tipo').eq('numero', parseInt(card.num,10)).single();
                      if (data && onUpdate) onUpdate({ ...card, raw: { ...raw, ...data } });
                    }}/>
                    <div style={{ display:'flex', gap:8 }}>
                      {previewViewUrl && (
                        <Btn variant="ghost" size="sm" icon="external-link" style={{ flex:1, justifyContent:'center' }}
                          onClick={() => window.open(previewViewUrl, '_blank')}>
                          Drive
                        </Btn>
                      )}
                      <R2UploadSection card={card} onUploadComplete={({ thumbUrl, mediaUrl, metaImageHash, metaVideoId }) => {
                        if (onUpdate) onUpdate({ ...card, raw: { ...raw, thumb_url: thumbUrl, media_url: mediaUrl, meta_image_hash: metaImageHash, meta_video_id: metaVideoId } });
                      }}/>
                    </div>
                  </div>
                )}
            </div>
            {/* Painel direito — scrollável */}
            <div style={{ flex:1, minHeight:0, overflowY:'auto', padding:'20px 24px',
              display:'flex', flexDirection:'column', gap:16 }}>
              {/* Propriedades */}
              <div style={{ background:'var(--app-surface)', border:'1px solid var(--app-border)',
                borderRadius:14 }}>
                <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--app-border)',
                  display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:12.5, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-1)' }}>
                    Propriedades
                  </span>
                </div>
                <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:14 }}>
                  {/* Status — chips */}
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
                      letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)' }}>Status</span>
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                      {ADS_COLUMNS.map(c => {
                        const active = fields.status === c.id;
                        return (
                          <button key={c.id} onClick={() => mudarStatus(c.id)}
                            style={{ padding:'4px 10px', borderRadius:999, fontSize:11, cursor:'pointer',
                              fontFamily:'Roboto,sans-serif', fontWeight:700, transition:'all 120ms',
                              background: active ? `${c.colorDot}22` : 'rgba(255,255,255,.04)',
                              border: active ? `1px solid ${c.colorDot}66` : '1px solid var(--app-border)',
                              color: active ? c.colorDot : 'var(--text-3)' }}>
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tipo — chips com ícone */}
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
                      letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)' }}>
                      Tipo
                    </span>
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                      {[{v:'reels',l:'Reels',i:'play-circle',c:'#f87171'},{v:'imagem',l:'Imagem',i:'image',c:'#a78bfa'},{v:'carrossel',l:'Carrossel',i:'layout-grid',c:'#60a5fa'}].map(t => {
                        const active = fields.tipo === t.v;
                        return (
                          <button key={t.v} onClick={() => set('tipo', t.v)}
                            style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px',
                              borderRadius:999, fontSize:11, cursor:'pointer',
                              fontFamily:'Roboto,sans-serif', fontWeight:700, transition:'all 120ms',
                              background: active ? `${t.c}22` : 'rgba(255,255,255,.04)',
                              border: active ? `1px solid ${t.c}66` : '1px solid var(--app-border)',
                              color: active ? t.c : 'var(--text-3)' }}>
                            <LucideIcon icon={t.i} size={11}/>{t.l}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Métricas */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                    <PropRow label="Vendas">
                      <span style={{ color:card.vendas?'var(--clr-pos)':'var(--text-3)' }}>
                        {card.vendas ?? '—'}
                      </span>
                    </PropRow>
                    <PropRow label="CPA">
                      <span style={{ color:cpaColor }}>
                        {card.cpa ? window.fmtBRL(card.cpa) : '—'}
                      </span>
                    </PropRow>
                    <PropRow label="Gasto total">
                      <span style={{ color:'var(--text-1)' }}>
                        {card.gasto ? window.fmtBRL(card.gasto) : '—'}
                      </span>
                    </PropRow>
                  </div>

                  {/* URL do anúncio */}
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
                      letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)' }}>URL do Anúncio</span>
                    <input value={fields.meta_ad_url} onChange={e => set('meta_ad_url', e.target.value)}
                      placeholder="https://www.facebook.com/ads/manager/..."
                      style={{ width:'100%', padding:'8px 12px', borderRadius:8,
                        background:'var(--app-surface-2)', border:'1px solid var(--app-border)',
                        color:'var(--text-1)', fontFamily:'Roboto,sans-serif', fontSize:12 }}
                      onFocus={e=>e.target.style.borderColor='rgba(234,170,65,.4)'}
                      onBlur={e=>e.target.style.borderColor='var(--app-border)'}/>
                  </div>

                  <MetaIdField card={card} onSaved={(id) => { card.meta_ad_id = id; }}/>
                </div>
              </div>

            {/* Copy */}
            <div style={{ background:'var(--app-surface)', border:'1px solid var(--app-border)', borderRadius:14 }}>
              <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--app-border)' }}>
                <span style={{ fontSize:12.5, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-1)' }}>Copy</span>
              </div>
              <div style={{ padding:16, display:'flex', flexDirection:'column', gap:14 }}>
                {fields.tipo === 'reels' ? (<>
                  <CopyField id="headline"   label="Headline"               fieldKey="headline"          rows={2}
                    hint="Sempre 2 frases nos primeiros segundos: uma de segmentação (ex: 'Fotógrafo e Videomaker') e outra curta que chame muito a atenção."/>
                  <CopyField id="roteiro"    label="Roteiro"                fieldKey="roteiro"           rows={6}
                    hint="Descreva as três partes juntas: Hook, Desenvolvimento e CTA."/>
                  <CopyField id="estetica"   label="Estética Visual"        fieldKey="estetica_visual"   rows={4}
                    hint="Cenas, ângulo, cor, som: tudo que for da parte estética da gravação e edição do vídeo inteiro."/>
                  <CopyField id="texto-p"    label="Texto Principal"        fieldKey="texto_principal"   rows={3}/>
                  <CopyField id="titulo-ad"  label="Título"                 fieldKey="titulo_ad"         rows={2}/>
                  <CopyField id="descricao"  label="Descrição"              fieldKey="descricao_ad"      rows={2}/>
                  <CopyField id="obs"        label="Informações Adicionais" fieldKey="observacoes"       rows={4}/>
                  <RefBlock value={fields.referencia} onChange={v => set('referencia', v)}/>
                </>) : fields.tipo === 'imagem' ? (<>
                  <CopyField id="headline"   label="Headline"               fieldKey="headline"          rows={2}
                    hint="A frase principal/big idea que aparece escrita na imagem: o título, o hook que chama atenção (diferente do Reels, aqui não é falado, é escrito)."/>
                  <CopyField id="roteiro"    label="Roteiro"                fieldKey="roteiro"           rows={6}
                    hint="Descreva a imagem: quantos elementos/fotos, quais frases aparecem escritas. Sempre com a ideia do Hook (= Headline), o desenvolvimento (o que mais aparece escrito/visualmente) e um CTA."/>
                  <CopyField id="estetica"   label="Prompt para Gerar Imagem" fieldKey="estetica_visual"  rows={6}
                    hint="Cole o prompt de geração da imagem. Se ele já tem escrita embutida, cole a escrita aqui também. Se deixa espaço de respiro pra escrita entrar na edição, só mencione o espaço: o texto que vai lá mora no Roteiro."/>
                  <CopyField id="texto-p"    label="Texto Principal"        fieldKey="texto_principal"   rows={3}/>
                  <CopyField id="titulo-ad"  label="Título"                 fieldKey="titulo_ad"         rows={2}/>
                  <CopyField id="descricao"  label="Descrição"              fieldKey="descricao_ad"      rows={2}/>
                  <CopyField id="obs"        label="Informações Adicionais" fieldKey="observacoes"       rows={4}/>
                  <RefBlock value={fields.referencia} onChange={v => set('referencia', v)}/>
                </>) : (<>
                  <CopyField id="headline"     label="Headline"               fieldKey="headline"           rows={2}/>
                  <CopyField id="hook-visual"  label="Hook Visual"            fieldKey="hook_visual"        rows={2}/>
                  <CopyField id="hook-copy"    label="Hook Copy"              fieldKey="hook_copy"          rows={2}/>
                  <CopyField id="texto-p"      label="Texto Principal"        fieldKey="texto_principal"    rows={3}/>
                  <CopyField id="dev-cta"      label="Desenvolvimento + CTA"  fieldKey="desenvolvimento_cta" rows={3}/>
                  <CopyField id="titulo-ad"    label="Título (feed)"          fieldKey="titulo_ad"          rows={2}/>
                  <CopyField id="descricao"    label="Descrição"              fieldKey="descricao_ad"       rows={2}/>
                  <CopyField id="obs"          label="Informações Adicionais" fieldKey="observacoes"        rows={4}/>
                  <RefBlock value={fields.referencia} onChange={v => set('referencia', v)}/>
                </>)}
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>

      {showMeta && <MetaAdModal card={card} onClose={() => setShowMeta(false)}/>}
    </>
  );
}

/* ── NovoAdsModal ────────────────────────────────────────────────*/
function NovoAdsModal({ onClose, onCreated }) {
  const [titulo, setTitulo]   = useState('');
  const [tipo, setTipo]       = useState('reels');
  const [status, setStatus]   = useState('fazer');
  const [saving, setSaving]   = useState(false);
  const [erro, setErro]       = useState('');
  const [nextNum, setNextNum] = useState(null);

  useEffect(() => {
    async function fetchNext() {
      const { data } = await window.db.from('ads').select('numero').order('numero', { ascending: false }).limit(1);
      const n = ((data?.[0]?.numero) || 0) + 1;
      setNextNum(n);
      setTitulo(`ADS ${String(n).padStart(3,'0')} - `);
    }
    fetchNext();
  }, []);

  async function criar() {
    if (!titulo.trim()) { setErro('Informe o título do AD.'); return; }
    setSaving(true);
    const novoNumero = nextNum;
    const { error } = await window.db.from('ads').insert({
      numero: novoNumero,
      titulo: titulo.trim(),
      tipo,
      status,
    });
    if (error) { setErro(error.message); setSaving(false); return; }
    onCreated();
    onClose();
  }

  const inputStyle = { width:'100%', padding:'9px 12px', borderRadius:8,
    background:'var(--app-surface-2)', border:'1px solid var(--app-border)',
    color:'var(--text-1)', fontFamily:'Roboto,sans-serif', fontSize:13,
    colorScheme:'dark' };

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:600,
      display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e=>e.stopPropagation()}
        style={{ width:420, background:'var(--app-surface)', border:'1px solid var(--app-border-2)',
          borderRadius:16, padding:24, display:'flex', flexDirection:'column', gap:16,
          boxShadow:'0 20px 60px rgba(0,0,0,.6)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:15, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-1)' }}>Novo ADS</span>
          <button onClick={onClose} style={{ width:28, height:28, borderRadius:'50%', background:'rgba(255,255,255,.07)',
            color:'var(--text-2)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:16 }}>×</button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <div style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
              letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:5 }}>Título</div>
            <input value={titulo} onChange={e=>setTitulo(e.target.value)} placeholder="Ex: Contrato em latim"
              style={inputStyle}
              onFocus={e=>e.target.style.borderColor='rgba(234,170,65,.4)'}
              onBlur={e=>e.target.style.borderColor='var(--app-border)'}
              onKeyDown={e=>e.key==='Enter'&&criar()}/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <div style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
                letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:5 }}>Tipo</div>
              <select value={tipo} onChange={e=>setTipo(e.target.value)} style={{ ...inputStyle, appearance:'none' }}>
                <option value="reels">Reels</option>
                <option value="imagem">Imagem</option>
                <option value="carrossel">Carrossel</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
                letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)', marginBottom:5 }}>Coluna</div>
              <select value={status} onChange={e=>setStatus(e.target.value)} style={{ ...inputStyle, appearance:'none' }}>
                {ADS_COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {erro && <span style={{ fontSize:11, color:'var(--clr-neg)', fontFamily:'Roboto,sans-serif' }}>{erro}</span>}

        <button onClick={criar} disabled={saving}
          style={{ padding:'12px', borderRadius:8, background:'var(--fmn-gold)', color:'var(--fmn-black)',
            fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:13, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'opacity 150ms' }}>
          <LucideIcon icon={saving?'loader':'plus'} size={16}/>
          {saving ? 'Criando...' : 'Criar ADS'}
        </button>
      </div>
    </div>
  );
}

/* ── KanbanScreen ────────────────────────────────────────────────*/
function KanbanScreen({ targetAd, onConsumeTarget }) {
  const [selectedCard, setSelectedCard] = useState(null);
  const [showNovoAds, setShowNovoAds]   = useState(false);
  const [fmtFilter, setFmtFilter]       = useState('Todos');
  const [tagFilter, setTagFilter]       = useState('Todas');
  const [searchQuery, setSearchQuery]   = useState('');

  const { cards: CARDS, loading, reload } = useAdsCards();
  const [syncing, setSyncing]   = useState(false);
  const [syncMsg, setSyncMsg]   = useState('');
  async function handleSync() {
    setSyncing(true);
    const startedAt = new Date().toISOString();
    const delay = ms => new Promise(r => setTimeout(r, ms));

    setSyncMsg('Iniciando…');
    try { await fetch('/api/sync', { method: 'POST' }); }
    catch { setSyncing(false); setSyncMsg('Erro ao iniciar sync'); return; }

    // Scripts em ordem — poll sync_status para mostrar progresso real
    const STEPS = [
      { script: 'drive_sync_pastas.py', label: 'Pastas Drive…' },
      { script: 'drive_organizar.py',   label: 'Organizando…' },
      { script: 'sync_drive.py',        label: 'Criativos…' },
      { script: 'sync_insights.py',     label: 'Métricas Meta…' },
      { script: 'aplicar_regras.py',    label: 'Regras de coluna…' },
    ];

    let stepIdx = 0;
    setSyncMsg(STEPS[0].label);

    // Max 10 min, poll a cada 4s
    for (let i = 0; i < 150; i++) {
      await delay(4000);
      try {
        const { data } = await window.db.from('sync_status')
          .select('script,last_run')
          .in('script', STEPS.map(s => s.script));

        if (data) {
          // Descobre qual é o próximo script que ainda não concluiu
          for (let s = stepIdx; s < STEPS.length; s++) {
            const row = data.find(r => r.script === STEPS[s].script);
            if (row?.last_run && row.last_run > startedAt) {
              stepIdx = s + 1;
            }
          }
          if (stepIdx >= STEPS.length) break; // todos concluídos
          setSyncMsg(STEPS[Math.min(stepIdx, STEPS.length - 1)].label);
        }
      } catch {}
    }

    setSyncMsg('Concluído!');
    reload();
    await delay(3000);
    setSyncing(false); setSyncMsg('');
  }

  // Abre automaticamente o card vindo de outra aba (ex: Ranking do Dashboard)
  useEffect(() => {
    if (targetAd == null || !CARDS.length) return;
    const alvo = CARDS.find(c => String(c.raw?.numero) === String(targetAd) || c.num === String(targetAd).padStart(3,'0'));
    if (alvo) { setSelectedCard(alvo); if (onConsumeTarget) onConsumeTarget(); }
  }, [targetAd, CARDS]);

  async function handleDropCard(cardId, newColId) {
    if (!window.db) return;
    const card = CARDS.find(c => c.id === cardId);
    if (!card) return;
    const patch = { status: newColId };
    const novaTag = resolveTag(newColId, card.col, card.vendas, card.cpa, card.gasto);
    if (novaTag !== null) patch.tag = novaTag;
    await window.db.from('ads').update(patch).eq('numero', parseInt(card.num, 10));
    reload();
  }

  // ── Ativar tudo no Meta (aprovação em massa dos rascunhos) ──
  const [activating, setActivating] = useState(false);
  const pendentesMeta = CARDS.filter(c => c.raw?.meta_publish_status === 'rascunho' && c.raw?.meta_ad_id);

  async function handleActivateAll() {
    if (!pendentesMeta.length || activating) return;
    const ok = window.confirm(
      `Ativar ${pendentesMeta.length} anúncio(s) no Meta?\n\n` +
      `Isso liga a campanha, o conjunto e o anúncio de cada um. Eles começam a gastar assim que o Meta aprovar.`
    );
    if (!ok) return;
    setActivating(true);
    try {
      const itens = pendentesMeta.map(c => ({
        campaignId: c.raw.meta_campaign_id,
        adsetId:    c.raw.meta_adset_id,
        adId:       c.raw.meta_ad_id,
      }));
      const r = await fetch(`${ADS_MEDIA_WORKER}/activate-ads`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens }),
      });
      const d = await r.json();
      const resultados = d.resultados || [];
      // Marca como 'ativo' os que ativaram com sucesso
      for (const res of resultados) {
        if (res.ok) {
          const card = pendentesMeta.find(c => c.raw.meta_ad_id === res.adId);
          if (card) await window.db.from('ads').update({ meta_publish_status: 'ativo' }).eq('numero', parseInt(card.num, 10));
        }
      }
      const okCount  = resultados.filter(x => x.ok).length;
      const errCount = resultados.length - okCount;
      alert(`Ativados: ${okCount}${errCount ? ` · Falharam: ${errCount}` : ''}`);
      reload();
    } catch (e) {
      alert(`Erro ao ativar: ${e.message}`);
    } finally {
      setActivating(false);
    }
  }

  const filteredCards = CARDS.filter(c => {
    if (fmtFilter !== 'Todos' && !c.formats.includes(fmtFilter)) return false;
    if (tagFilter !== 'Todas' && c.tag !== tagFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const haystack = [c.num, c.title, c.raw?.headline, c.raw?.roteiro, c.raw?.estetica_visual, c.raw?.hook_copy, c.raw?.hook_visual]
        .filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const hasActiveFilters = fmtFilter !== 'Todos' || tagFilter !== 'Todas' || searchQuery.trim() !== '';

  function handleUpdate(updatedCard) {
    if (updatedCard.deleted) { setSelectedCard(null); reload(); return; }
    setSelectedCard(prev => prev && prev.id === updatedCard.id ? updatedCard : prev);
    reload();
  }

  function FilterPill({ label, active, onClick }) {
    return (
      <button onClick={onClick}
        style={{ padding:'4px 10px', borderRadius:999, cursor:'pointer', transition:'all 130ms',
          background: active ? 'rgba(234,170,65,.15)' : 'transparent',
          border: `1px solid ${active ? 'rgba(234,170,65,.3)' : 'rgba(255,255,255,.08)'}`,
          color: active ? 'var(--fmn-gold)' : 'rgba(255,255,255,.42)',
          fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:10.5,
          letterSpacing:'0.04em', whiteSpace:'nowrap' }}>
        {label}
      </button>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <TopBar title="Criativos"
        actions={
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {loading && (
              <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', color:'var(--text-3)',
                background:'rgba(255,255,255,.05)', border:'1px solid var(--app-border)',
                padding:'2px 8px', borderRadius:99 }}>carregando...</span>
            )}
            <UtmCopyBtn/>
            <button onClick={reload} title="Recarregar ADS"
              style={{ width:30, height:30, borderRadius:7, display:'flex', alignItems:'center',
                justifyContent:'center', background:'rgba(255,255,255,.05)',
                border:'1px solid var(--app-border)', color:'var(--text-3)', cursor:'pointer' }}>
              <LucideIcon icon="refresh-cw" size={13}/>
            </button>
            {(() => {
              const isLocal = ['localhost','127.0.0.1'].includes(location.hostname);
              return isLocal ? (
            <button onClick={handleSync} disabled={syncing}
              title="Sincronizar Drive + Meta + Regras"
              style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 13px',
                borderRadius:7, cursor: syncing ? 'default' : 'pointer',
                background: syncing ? 'rgba(74,222,128,.08)' : 'rgba(255,255,255,.06)',
                border: `1px solid ${syncing ? 'rgba(74,222,128,.25)' : 'var(--app-border)'}`,
                color: syncing ? '#4ade80' : 'var(--text-2)',
                fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:11,
                letterSpacing:'0.03em', transition:'all 150ms' }}>
              <LucideIcon icon={syncing ? 'loader' : 'refresh-cw'} size={12}
                style={syncing ? { animation:'spin 1s linear infinite' } : {}}/>
              {syncing ? (syncMsg || 'Sincronizando…') : 'Sincronizar'}
            </button>
              ) : (
            <button disabled title="Sync disponível apenas localmente"
              style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 13px',
                borderRadius:7, cursor:'not-allowed', opacity:.35,
                background:'rgba(255,255,255,.04)', border:'1px solid var(--app-border)',
                color:'var(--text-3)', fontFamily:'Roboto,sans-serif', fontWeight:700,
                fontSize:11, letterSpacing:'0.03em' }}>
              <LucideIcon icon="refresh-cw" size={12}/>
              Sincronizar
            </button>
              );
            })()}
            {pendentesMeta.length > 0 && (
              <button onClick={handleActivateAll} disabled={activating}
                title="Liga campanha, conjunto e anúncio de tudo que o Tracker subiu pausado"
                style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px',
                  background: activating ? 'rgba(74,222,128,.1)' : 'rgba(74,222,128,.14)',
                  color:'#4ade80', borderRadius:8, border:'1px solid rgba(74,222,128,.35)',
                  fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:12,
                  cursor: activating ? 'default' : 'pointer' }}>
                <LucideIcon icon={activating ? 'loader' : 'circle-play'} size={14}
                  style={activating ? { animation:'spin 1s linear infinite' } : {}}/>
                {activating ? 'Ativando…' : `Ativar tudo no Meta (${pendentesMeta.length})`}
              </button>
            )}
            <button onClick={() => setShowNovoAds(true)}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px',
                background:'var(--fmn-gold)', color:'var(--fmn-black)', borderRadius:8, border:'none',
                fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:12, cursor:'pointer' }}>
              <LucideIcon icon="plus" size={14}/>Novo
            </button>
          </div>
        }/>

      {/* Barra de filtros */}
      <div style={{ padding:'8px 24px', borderBottom:'1px solid var(--app-border)',
        background:'var(--app-bg)', display:'flex', alignItems:'center', gap:16, flexShrink:0,
        flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
            letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)', whiteSpace:'nowrap' }}>Formato</span>
          <div style={{ display:'flex', gap:4 }}>
            {['Todos','Reels','Imagem','Carrossel'].map(f => (
              <FilterPill key={f} label={f} active={fmtFilter===f} onClick={()=>setFmtFilter(f)}/>
            ))}
          </div>
        </div>
        <div style={{ width:1, height:16, background:'var(--app-border)' }}/>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
            letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)', whiteSpace:'nowrap' }}>Tag</span>
          <div style={{ display:'flex', gap:4 }}>
            {['Todas','Teste','Recorrência','Ótimo','Testar novamente','Mediano','Ruim'].map(t => (
              <FilterPill key={t} label={t} active={tagFilter===t} onClick={()=>setTagFilter(t)}/>
            ))}
          </div>
        </div>
        <div style={{ width:1, height:16, background:'var(--app-border)' }}/>
        <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
          <span style={{ position:'absolute', left:8, pointerEvents:'none', color:'rgba(255,255,255,.3)', display:'flex' }}>
            <LucideIcon icon="search" size={12}/>
          </span>
          <input
            type="text"
            placeholder="Buscar ADS, headline, hook..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft:26, paddingRight:searchQuery ? 26 : 10, paddingTop:4, paddingBottom:4,
              borderRadius:8, border:'1px solid rgba(255,255,255,.1)',
              background:'rgba(255,255,255,.05)', color:'var(--text-1)',
              fontFamily:'Roboto,sans-serif', fontSize:11.5, outline:'none', width:200,
              transition:'border-color 130ms' }}
            onFocus={e => e.target.style.borderColor='rgba(234,170,65,.4)'}
            onBlur={e => e.target.style.borderColor='rgba(255,255,255,.1)'}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}
              style={{ position:'absolute', right:6, background:'none', border:'none',
                color:'rgba(255,255,255,.35)', cursor:'pointer', padding:0, display:'flex' }}>
              <LucideIcon icon="x" size={11}/>
            </button>
          )}
        </div>
        {hasActiveFilters && (
          <button onClick={()=>{ setFmtFilter('Todos'); setTagFilter('Todas'); setSearchQuery(''); }}
            style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 8px', borderRadius:6,
              background:'rgba(248,113,113,.08)', border:'1px solid rgba(248,113,113,.2)',
              color:'var(--clr-neg)', fontSize:10.5, fontFamily:'Roboto,sans-serif', fontWeight:700, cursor:'pointer' }}>
            <LucideIcon icon="x" size={11}/>Limpar
          </button>
        )}
      </div>

      {/* Colunas Kanban */}
      <div style={{ flex:1, overflowX:'auto', overflowY:'hidden',
        padding:'20px 24px', display:'flex', gap:12, alignItems:'stretch' }}>
        {ADS_COLUMNS.map(col => {
          const cards = filteredCards.filter(c => c.col === col.id);
          return <KanbanColumn key={col.id} col={col} cards={cards}
            onOpen={setSelectedCard} onAddNew={() => setShowNovoAds(true)}
            onDropCard={handleDropCard}/>;
        })}
      </div>

      {selectedCard && (
        <AdsDetailModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onUpdate={handleUpdate}
          siblings={filteredCards.filter(c => c.col === selectedCard.col)}
          onNavigate={setSelectedCard}
        />
      )}

      {showNovoAds && (
        <NovoAdsModal
          onClose={() => setShowNovoAds(false)}
          onCreated={() => { setShowNovoAds(false); reload(); }}
        />
      )}
    </div>
  );
}

Object.assign(window, { KanbanScreen });
