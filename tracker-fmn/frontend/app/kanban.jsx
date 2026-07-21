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
const ADS_MEDIA_WORKER = 'https://ads-media.blindagem-fmn.workers.dev';

const ADS_COLUMNS = [
  { id:'fazer',           label:'Fazer',            colorDot:'#3b82f6', colorBg:'rgba(59,130,246,.08)',  colorBorder:'rgba(59,130,246,.25)' },
  { id:'fazendo',         label:'Fazendo',          colorDot:'#fbbf24', colorBg:'rgba(251,191,36,.08)',  colorBorder:'rgba(251,191,36,.25)' },
  { id:'ativo',           label:'Ativos',           colorDot:'#f97316', colorBg:'rgba(249,115,22,.08)',  colorBorder:'rgba(249,115,22,.3)'  },
  { id:'campeoes',        label:'Campeões',         colorDot:'#4ade80', colorBg:'rgba(74,222,128,.08)',  colorBorder:'rgba(74,222,128,.25)' },
  { id:'arquivado',       label:'Arquivados',       colorDot:'#94a3b8', colorBg:'rgba(148,163,184,.05)', colorBorder:'rgba(148,163,184,.2)' },
];

// Regras de classificação — ver tracker-fmn/REGRAS-KANBAN.md
// Revisadas em 2026-07-10: "Testar novamente" deixou de ser coluna própria
// (virou etiqueta dentro de Arquivados).
// Ótimo:            >= 5 vendas E CPA < R$297
// Testar novamente: (0 vendas E gasto < R$297) OU (vendeu, gasto < R$297 E CPA < R$297)
// Ruim:             0 vendas E gasto >= R$297
// Mediano:          tudo o mais

const TICKET_VAL = 297;

// Fonte canônica: supabase/functions/_shared/classificar.ts (usada por
// kanban-sync e processar-pausas). Este arquivo roda no browser (Babel),
// runtime diferente do Deno — não dá pra importar de lá. Mudou a regra
// aqui, muda lá também (e vice-versa).
function classifyAd(vendas, cpa, gasto) {
  const v = vendas || 0;
  const g = gasto  || 0;
  const c = cpa != null ? cpa : (v > 0 && g > 0 ? g / v : null);

  if (v >= 5 && (c == null || c < TICKET_VAL)) return 'Ótimo';

  const semVendaAindaBarato = v === 0 && g < TICKET_VAL;
  const vendeuMasNaoBateuTicket = v > 0 && g < TICKET_VAL && (c == null || c < TICKET_VAL);
  if (semVendaAindaBarato || vendeuMasNaoBateuTicket) return 'Testar novamente';

  if (v === 0) return 'Ruim';
  return 'Mediano';
}

// Resolve a tag correta ao mudar de coluna.
// Retorna null quando não deve alterar a tag (ex: Fazer, Fazendo, Ativos).
function resolveTag(novoStatus, statusAnterior, vendas, cpa, gasto) {
  if (novoStatus === 'campeoes') return 'Ótimo';
  if (novoStatus === 'arquivado') return classifyAd(vendas, cpa, gasto);
  return null; // fazer, fazendo, ativo: sem tag automática
}

const TAG_TONE = { 'Ótimo':'success', 'Testar novamente':'info', 'Mediano':'warning', 'Ruim':'danger' };

/* ── Ordenação dos cards dentro de cada coluna ────────────────────
   'manual' é o padrão: usa ordem_manual quando existe; card nunca
   arrastado usa -numero como valor implícito, o que preserva o
   comportamento antigo (número mais recente primeiro) sem precisar
   de nenhuma migração de dado. Isso também dá "espaço numérico" pra
   arrastar um card pra o meio de cards nunca reordenados.          */
function valorOrdem(card) {
  if (!card) return null;
  return card.ordemManual != null ? card.ordemManual : -card.numero;
}
function calcularOrdemEntre(anterior, seguinte) {
  const a = valorOrdem(anterior), b = valorOrdem(seguinte);
  if (a == null && b == null) return 0;
  if (a == null) return b - 1;
  if (b == null) return a + 1;
  return (a + b) / 2;
}
function ordenarCards(lista, sortBy) {
  const arr = [...lista];
  if (sortBy === 'nome') {
    arr.sort((a, b) => (a.hook || '').localeCompare(b.hook || '', 'pt-BR'));
  } else if (sortBy === 'vendas') {
    arr.sort((a, b) => (b.vendas ?? -Infinity) - (a.vendas ?? -Infinity)); // mais vendas primeiro
  } else if (sortBy === 'cpa') {
    arr.sort((a, b) => (a.cpa ?? Infinity) - (b.cpa ?? Infinity)); // menor CPA primeiro (melhor)
  } else {
    arr.sort((a, b) => valorOrdem(a) - valorOrdem(b));
  }
  return arr;
}

/* ── Hook: ADS reais do Supabase ─────────────────────────────────*/
function useAdsCards() {
  const [cards, setCards]     = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!window.db) return;
    setLoading(true);
    const { data: adsList } = await window.db
      .from('ads')
      .select('numero,titulo,status,tag,tipo,headline,hook_copy,hook_visual,desenvolvimento_cta,roteiro,estetica_visual,texto_principal,titulo_ad,descricao_ad,posicionamento,media_drive_url,media_tipo,media_files,meta_ad_id,meta_ad_url,vendas_total,cpa_historico,gasto_total,isento_regra,observacoes,thumb_url,media_url,meta_image_hash,meta_video_id,meta_campaign_id,meta_adset_id,meta_publish_status,ordem_manual')
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
        numero:   a.numero,
        meta_ad_id: a.meta_ad_id,
        col:      a.status,
        ordemManual: a.ordem_manual,
        progress: a.status === 'fazendo' ? 50 : 0,
        hook:     a.titulo,
        formats:  [tipoFormatted],
        // vendas_total/cpa_historico/gasto_total somam TODAS as vezes que o
        // anúncio rodou (todo relançamento vira um meta_ad_id novo, e o
        // kanban-sync já agrega todos eles por número de ADS). Isso é sempre
        // o dado mais completo, por isso é a fonte principal.
        // insights_cache (periodo='maximum') reflete só o meta_ad_id ATUAL
        // (o do relançamento mais recente) — usado só como fallback quando
        // ainda não existe total histórico calculado (anúncio muito novo).
        vendas:   a.vendas_total ?? ins?.compras ?? null,
        cpa:      a.cpa_historico ?? ins?.cpa     ?? null,
        gasto:    a.gasto_total   ?? ins?.gasto   ?? null,
        tag:      (a.status === 'arquivado' || a.status === 'campeoes')
                    ? (a.tag || classifyAd(a.vendas_total ?? ins?.compras, a.cpa_historico ?? ins?.cpa, a.gasto_total ?? ins?.gasto))
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

function KanbanCard({ card, col, onOpen, onDragStart, podeArrastar, onDropAntes }) {
  const [hov, setHov] = useState(false);
  const [dragOverTopo, setDragOverTopo] = useState(false);
  const cpaColor = getCpaColor(card.cpa);
  const thumb = cardThumb(card.raw);
  const isVideo = ['reels','video'].includes(card.raw?.tipo) || card.raw?.media_tipo === 'video';
  const hasMedia = (() => {
    if (card.raw?.media_url || card.raw?.thumb_url) return true;
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
      draggable={podeArrastar}
      onDragStart={e => { e.dataTransfer.setData('cardId', card.id); e.dataTransfer.setData('fromCol', card.col); onDragStart && onDragStart(); }}
      onDragOver={e => { if (!podeArrastar) return; e.preventDefault(); e.stopPropagation(); setDragOverTopo(true); }}
      onDragLeave={() => setDragOverTopo(false)}
      onDrop={e => {
        if (!podeArrastar) return;
        e.preventDefault(); e.stopPropagation(); setDragOverTopo(false);
        const id = e.dataTransfer.getData('cardId');
        const from = e.dataTransfer.getData('fromCol');
        if (id && id !== card.id) onDropAntes && onDropAntes(id, from);
      }}
      onClick={() => onOpen(card)}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov?'var(--app-surface-3)':'var(--app-surface-2)',
        border:`1px solid ${dragOverTopo ? col.colorDot : hov?col.colorBorder:'var(--app-border)'}`,
        borderTop: dragOverTopo ? `2px solid ${col.colorDot}` : undefined,
        borderRadius:10, padding:'12px 12px', display:'flex', flexDirection:'column', gap:8,
        cursor: podeArrastar ? 'grab' : 'pointer', transition:'all 160ms var(--ease-out)',
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
function KanbanColumn({ col, cards, onOpen, onAddNew, onDropCard, sortBy, onReorder }) {
  const [dragOver, setDragOver] = useState(false);
  const podeArrastar = sortBy === 'manual';
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault(); setDragOver(false);
        const id = e.dataTransfer.getData('cardId');
        const from = e.dataTransfer.getData('fromCol');
        if (!id) return;
        if (from !== col.id) { onDropCard(id, col.id); return; }
        if (podeArrastar) onReorder(id, null, col.id); // soltou no fundo/vazio da própria coluna
      }}
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
          <KanbanCard key={c.id} card={c} col={col} onOpen={onOpen}
            podeArrastar={podeArrastar}
            onDropAntes={(draggedId) => onReorder(draggedId, c.id, col.id)}/>
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
  // Vídeo: usa o video_id se já existe; senão sobe a versão em alta do R2 pro Meta agora.
  async function ensureMetaMedia() {
    if (!isVideo) {
      if (r2Url) return { imageUrl: r2Url };
      if (raw.meta_image_hash) return { imageHash: raw.meta_image_hash };
      throw new Error('Sem mídia no R2 para o anúncio.');
    }
    if (raw.meta_video_id) return { videoId: raw.meta_video_id };
    if (!r2Url) throw new Error('Este anúncio ainda não tem vídeo importado. Use "Importar direto" ou "Importar com link" antes de publicar.');
    const videoId = await prepararCriativoMeta(r2Url);
    return { videoId };
  }

  // Sobe a versão em alta (já pronta no R2 pela cozinha) direto pro Meta e
  // guarda o video_id no card, pra próximas publicações reaproveitarem.
  async function prepararCriativoMeta(origUrl) {
    setLoadingMsg('Enviando vídeo ao Meta (pode levar 1 min)…');
    const d = await workerPost('/upload-meta', { tipo: 'video', origUrl });
    await window.db.from('ads').update({ meta_video_id: d.videoId }).eq('numero', adNum);
    return d.videoId;
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
   Importa da pasta do Drive pela cozinha na nuvem (ffmpeg/otimização
   fora do Mac). "Importar direto" acha a pasta ADS pelo número;
   "Importar com link" o usuário cola o link da pasta.
─────────────────────────────────────────────────────────────────*/
function AdicionarCriativoBtn({ card, onDone }) {
  const [step, setStep] = useState('idle'); // idle | running | warn
  const [msg, setMsg]   = useState('');
  const [pct, setPct]   = useState(0);
  const numero = card.raw?.numero ?? parseInt(card.num, 10);

  async function run(driveUrl) {
    const jobId = novoJobId();
    setStep('running'); setPct(0); setMsg('Preparando');
    const rota = driveUrl ? '/import-link' : '/import-direto';
    const payload = driveUrl ? { numero, drive_url: driveUrl, job_id: jobId } : { numero, job_id: jobId };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const falhar = m => { setStep('warn'); setMsg(m); setPct(0); setTimeout(() => { setStep('idle'); setMsg(''); }, 6000); };
    const concluir = async () => {
      setPct(100);
      let data = null;
      try {
        const res = await window.db.from('ads')
          .select('thumb_url,media_url,media_tipo,tipo').eq('numero', numero).single();
        data = res.data;
      } catch {}
      setStep('idle'); setMsg(''); setPct(0);
      onDone && onDone(data);
    };

    // Miniatura atual: a importação terminou quando ela mudar (rede de segurança).
    const thumbAntes = card.raw?.thumb_url || null;

    // Dispara a importação, mas NÃO dependemos da resposta: vídeo grande pode
    // estourar a conexão do navegador enquanto a cozinha segue trabalhando.
    let erroRapido = null;
    fetch(`${ADS_MEDIA_WORKER}${rota}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok || d.error) erroRapido = d.error || `Erro ${r.status}`; })
      .catch(() => {});

    for (let i = 0; i < 300; i++) {            // 300 x 2s = 10 min
      await sleep(2000);
      if (erroRapido) return falhar(erroRapido);

      // Progresso real reportado pela cozinha
      try {
        const pr = await fetch(`${ADS_MEDIA_WORKER}/progresso?job=${jobId}`);
        const p  = await pr.json();
        if (p.erro) return falhar(p.erro);
        if (typeof p.pct === 'number') setPct(p.pct);
        if (p.etapa) setMsg(p.etapa);
        if (p.done) return await concluir();
      } catch {}

      // Rede de segurança: se o progresso se perder, o card é a fonte da verdade
      if (i % 3 === 0) {
        try {
          const res = await window.db.from('ads').select('thumb_url').eq('numero', numero).single();
          if (res.data?.thumb_url && res.data.thumb_url !== thumbAntes) return await concluir();
        } catch {}
      }
    }
    falhar('Demorou demais. Recarregue a página em instantes.');
  }

  function manual() {
    const p = window.prompt('Cole o link da pasta do criativo no Drive:');
    if (p && p.trim()) run(p.trim());
  }

  if (step === 'running') {
    return <BarraProgresso pct={pct} etapa={msg}/>;
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {step === 'warn' && (
        <div style={{ padding:'6px 10px', borderRadius:8, background:'rgba(248,113,113,.08)',
          border:'1px solid rgba(248,113,113,.3)', fontSize:11, color:'#f87171', lineHeight:1.4 }}>{msg}</div>
      )}
      <div style={{ display:'flex', gap:8 }}>
        <Btn variant="secondary" size="sm" icon="image-plus" style={{ flex:1, justifyContent:'center' }}
          onClick={() => run(null)}>Importar direto</Btn>
        <Btn variant="ghost" size="sm" icon="link" style={{ justifyContent:'center' }}
          onClick={manual} title="Colar o link da pasta do Drive">Importar com link</Btn>
      </div>
    </div>
  );
}

/* ── CopyField — componente independente (fora do modal) ──────────
   Precisa ficar fora do AdsDetailModal: um componente definido dentro de
   outro é recriado a cada render do pai, o que faz o React desmontar e
   remontar o <textarea> a cada tecla digitada (perde o foco a cada letra). */
function CopyField({ id, label, fieldKey, rows = 3, hint, fields, set, copiedField, copyToClipboard }) {
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
    media_tipo:       raw.media_tipo      || null,
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

  // Arquivos sincronizados do Drive (array JSONB) — legado, tipicamente vídeo
  const mediaFiles = (() => { try { return Array.isArray(raw.media_files) ? raw.media_files : JSON.parse(raw.media_files || '[]'); } catch { return []; } })();

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

  // URLs R2 do ad (JSON array ou string simples) — imagem/carrossel importado usa isto
  const r2Urls = (() => {
    try {
      const v = raw.media_url;
      if (!v) return [];
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch { return raw.media_url ? [raw.media_url] : []; }
  })();

  // Carrossel pode vir por dois caminhos: imagens no media_url (import na nuvem)
  // ou arquivos legado no media_files (Drive). Usa o que tiver mais de 1 item.
  const carouselCount = Math.max(r2Urls.length, mediaFiles.length);
  const isCarousel = /carrossel/i.test(fields.tipo) && carouselCount > 1;
  const currentFile = isCarousel ? mediaFiles[carouselIdx] : mediaFiles[0];
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
            <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0, flex:1 }}>
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
                  outline:'none', flex:'1 1 auto', minWidth:0, width:'100%', transition:'border-color 150ms' }}
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
                                src={raw.thumb_url || `/thumbnails/${raw.numero}.jpg`}
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
                          {carouselIdx < carouselCount - 1 && (
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
                            {Array.from({ length: carouselCount }).map((_, i) => (
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
                            {carouselIdx + 1}/{carouselCount}
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
                    {/* Importar do Drive (cozinha na nuvem) */}
                    <AdicionarCriativoBtn card={card} onDone={async () => {
                      const { data } = await window.db.from('ads')
                        .select('media_url,thumb_url,tipo,media_tipo,media_files,media_drive_url,status').eq('numero', parseInt(card.num,10)).single();
                      if (!data) return;
                      // Sincroniza a memória do modal, senão o botão Salvar regrava
                      // os valores antigos por cima do que a importação acabou de gravar.
                      setFields(f => ({ ...f, tipo: data.tipo, media_tipo: data.media_tipo,
                        media_drive_url: data.media_drive_url ?? f.media_drive_url, status: data.status }));
                      if (onUpdate) onUpdate({ ...card, col: data.status, raw: { ...raw, ...data } });
                    }}/>
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
                  <CopyField fields={fields} set={set} copiedField={copiedField} copyToClipboard={copyToClipboard} id="headline"   label="Headline"               fieldKey="headline"          rows={2}
                    hint="Sempre 2 frases nos primeiros segundos: uma de segmentação (ex: 'Fotógrafo e Videomaker') e outra curta que chame muito a atenção."/>
                  <CopyField fields={fields} set={set} copiedField={copiedField} copyToClipboard={copyToClipboard} id="roteiro"    label="Roteiro"                fieldKey="roteiro"           rows={6}
                    hint="Descreva as três partes juntas: Hook, Desenvolvimento e CTA."/>
                  <CopyField fields={fields} set={set} copiedField={copiedField} copyToClipboard={copyToClipboard} id="estetica"   label="Estética Visual"        fieldKey="estetica_visual"   rows={4}
                    hint="Cenas, ângulo, cor, som: tudo que for da parte estética da gravação e edição do vídeo inteiro."/>
                  <CopyField fields={fields} set={set} copiedField={copiedField} copyToClipboard={copyToClipboard} id="texto-p"    label="Texto Principal"        fieldKey="texto_principal"   rows={3}/>
                  <CopyField fields={fields} set={set} copiedField={copiedField} copyToClipboard={copyToClipboard} id="titulo-ad"  label="Título"                 fieldKey="titulo_ad"         rows={2}/>
                  <CopyField fields={fields} set={set} copiedField={copiedField} copyToClipboard={copyToClipboard} id="descricao"  label="Descrição"              fieldKey="descricao_ad"      rows={2}/>
                  <CopyField fields={fields} set={set} copiedField={copiedField} copyToClipboard={copyToClipboard} id="obs"        label="Informações Adicionais" fieldKey="observacoes"       rows={4}/>
                  <RefBlock value={fields.referencia} onChange={v => set('referencia', v)}/>
                </>) : fields.tipo === 'imagem' ? (<>
                  <CopyField fields={fields} set={set} copiedField={copiedField} copyToClipboard={copyToClipboard} id="headline"   label="Headline"               fieldKey="headline"          rows={2}
                    hint="A frase principal/big idea que aparece escrita na imagem: o título, o hook que chama atenção (diferente do Reels, aqui não é falado, é escrito)."/>
                  <CopyField fields={fields} set={set} copiedField={copiedField} copyToClipboard={copyToClipboard} id="roteiro"    label="Roteiro"                fieldKey="roteiro"           rows={6}
                    hint="Descreva a imagem: quantos elementos/fotos, quais frases aparecem escritas. Sempre com a ideia do Hook (= Headline), o desenvolvimento (o que mais aparece escrito/visualmente) e um CTA."/>
                  <CopyField fields={fields} set={set} copiedField={copiedField} copyToClipboard={copyToClipboard} id="estetica"   label="Prompt para Gerar Imagem" fieldKey="estetica_visual"  rows={6}
                    hint="Cole o prompt de geração da imagem. Se ele já tem escrita embutida, cole a escrita aqui também. Se deixa espaço de respiro pra escrita entrar na edição, só mencione o espaço: o texto que vai lá mora no Roteiro."/>
                  <CopyField fields={fields} set={set} copiedField={copiedField} copyToClipboard={copyToClipboard} id="texto-p"    label="Texto Principal"        fieldKey="texto_principal"   rows={3}/>
                  <CopyField fields={fields} set={set} copiedField={copiedField} copyToClipboard={copyToClipboard} id="titulo-ad"  label="Título"                 fieldKey="titulo_ad"         rows={2}/>
                  <CopyField fields={fields} set={set} copiedField={copiedField} copyToClipboard={copyToClipboard} id="descricao"  label="Descrição"              fieldKey="descricao_ad"      rows={2}/>
                  <CopyField fields={fields} set={set} copiedField={copiedField} copyToClipboard={copyToClipboard} id="obs"        label="Informações Adicionais" fieldKey="observacoes"       rows={4}/>
                  <RefBlock value={fields.referencia} onChange={v => set('referencia', v)}/>
                </>) : (<>
                  <CopyField fields={fields} set={set} copiedField={copiedField} copyToClipboard={copyToClipboard} id="headline"     label="Headline"               fieldKey="headline"           rows={2}/>
                  <CopyField fields={fields} set={set} copiedField={copiedField} copyToClipboard={copyToClipboard} id="hook-visual"  label="Hook Visual"            fieldKey="hook_visual"        rows={2}/>
                  <CopyField fields={fields} set={set} copiedField={copiedField} copyToClipboard={copyToClipboard} id="hook-copy"    label="Hook Copy"              fieldKey="hook_copy"          rows={2}/>
                  <CopyField fields={fields} set={set} copiedField={copiedField} copyToClipboard={copyToClipboard} id="texto-p"      label="Texto Principal"        fieldKey="texto_principal"    rows={3}/>
                  <CopyField fields={fields} set={set} copiedField={copiedField} copyToClipboard={copyToClipboard} id="dev-cta"      label="Desenvolvimento + CTA"  fieldKey="desenvolvimento_cta" rows={3}/>
                  <CopyField fields={fields} set={set} copiedField={copiedField} copyToClipboard={copyToClipboard} id="titulo-ad"    label="Título (feed)"          fieldKey="titulo_ad"          rows={2}/>
                  <CopyField fields={fields} set={set} copiedField={copiedField} copyToClipboard={copyToClipboard} id="descricao"    label="Descrição"              fieldKey="descricao_ad"       rows={2}/>
                  <CopyField fields={fields} set={set} copiedField={copiedField} copyToClipboard={copyToClipboard} id="obs"          label="Informações Adicionais" fieldKey="observacoes"        rows={4}/>
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

/* ── AtivarMetaModal ───────────────────────────────────────────────
   Checklist dos rascunhos já confirmados como existentes no Meta (o
   chamador já filtrou os que sumiram). O usuário escolhe quais ativar.
─────────────────────────────────────────────────────────────────*/
function AtivarMetaModal({ itens, onClose, onDone }) {
  const [selecionados, setSelecionados] = useState(() => new Set(itens.map(i => i.num)));
  const [ativando, setAtivando] = useState(false);
  const [resultado, setResultado] = useState(null); // { okCount, errCount, erros }

  function toggle(num) {
    setSelecionados(prev => {
      const next = new Set(prev);
      next.has(num) ? next.delete(num) : next.add(num);
      return next;
    });
  }

  async function ativarSelecionados() {
    const alvo = itens.filter(i => selecionados.has(i.num));
    if (!alvo.length || ativando) return;
    setAtivando(true);
    try {
      const payload = alvo.map(i => ({ campaignId: i.campaignId, adsetId: i.adsetId, adId: i.adId }));
      const r = await fetch(`${ADS_MEDIA_WORKER}/activate-ads`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens: payload }),
      });
      const d = await r.json();
      const resultados = d.resultados || [];
      const erros = [];
      for (const res of resultados) {
        const item = alvo.find(i => i.adId === res.adId);
        if (res.ok) {
          // Ativação real no Meta também avança o card pra coluna "Ativos",
          // com a mesma tag que o app já aplicaria num drag-and-drop manual.
          const novaTag = resolveTag('ativo', item?.statusAnterior);
          const patch = { meta_publish_status: 'ativo', status: 'ativo' };
          if (novaTag !== null) patch.tag = novaTag;
          await window.db.from('ads').update(patch).eq('numero', parseInt(item.num, 10));
        } else {
          erros.push({ num: item?.num, titulo: item?.titulo, erro: res.error });
        }
      }
      setResultado({ okCount: resultados.filter(x => x.ok).length, errCount: erros.length, erros });
    } catch (e) {
      setResultado({ okCount: 0, errCount: alvo.length, erros: [{ num: '-', titulo: '-', erro: e.message }] });
    } finally {
      setAtivando(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:700,
      display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ width:480, maxHeight:'80vh', display:'flex', flexDirection:'column',
        background:'var(--app-surface)', border:'1px solid var(--app-border-2)', borderRadius:16,
        boxShadow:'0 20px 60px rgba(0,0,0,.6)' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--app-border)',
          display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:15, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-1)' }}>
            Ativar no Meta
          </span>
          <button onClick={onClose} style={{ width:28, height:28, borderRadius:'50%', background:'rgba(255,255,255,.07)',
            color:'var(--text-2)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:16 }}>×</button>
        </div>

        {resultado ? (
          <div style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ fontSize:13, fontFamily:'Roboto,sans-serif', color:'var(--text-1)' }}>
              Ativados: <b style={{ color:'#4ade80' }}>{resultado.okCount}</b>
              {resultado.errCount > 0 && <> · Falharam: <b style={{ color:'#f87171' }}>{resultado.errCount}</b></>}
            </div>
            {resultado.erros.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:220, overflowY:'auto' }}>
                {resultado.erros.map((e, i) => (
                  <div key={i} style={{ padding:'8px 10px', borderRadius:8, background:'rgba(248,113,113,.08)',
                    border:'1px solid rgba(248,113,113,.25)', fontSize:11.5, color:'#f87171', lineHeight:1.4 }}>
                    <b>AD {e.num}</b> — {e.titulo}<br/>{e.erro}
                  </div>
                ))}
              </div>
            )}
            <Btn variant="secondary" size="sm" onClick={onDone} style={{ justifyContent:'center' }}>Fechar</Btn>
          </div>
        ) : (
          <>
            <div style={{ padding:'10px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'var(--text-3)' }}>
                {selecionados.size} de {itens.length} selecionado(s)
              </span>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setSelecionados(new Set(itens.map(i => i.num)))}
                  style={{ fontSize:11, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--fmn-gold)', cursor:'pointer' }}>
                  Todos
                </button>
                <button onClick={() => setSelecionados(new Set())}
                  style={{ fontSize:11, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-3)', cursor:'pointer' }}>
                  Nenhum
                </button>
              </div>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'0 20px 12px', display:'flex', flexDirection:'column', gap:6 }}>
              {itens.map(item => (
                <label key={item.num} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px',
                  borderRadius:8, background:'rgba(255,255,255,.03)', border:'1px solid var(--app-border)', cursor:'pointer' }}>
                  <input type="checkbox" checked={selecionados.has(item.num)} onChange={() => toggle(item.num)}
                    style={{ width:15, height:15, cursor:'pointer', flexShrink:0 }}/>
                  <span style={{ fontSize:12.5, fontFamily:'Roboto,sans-serif', color:'var(--text-1)' }}>
                    <b>AD {item.num}</b> — {item.titulo}
                  </span>
                </label>
              ))}
            </div>
            <div style={{ padding:'14px 20px', borderTop:'1px solid var(--app-border)', display:'flex', gap:10 }}>
              <Btn variant="ghost" size="sm" onClick={onClose} style={{ flex:1, justifyContent:'center' }}>Cancelar</Btn>
              <Btn variant="primary" size="sm" onClick={ativarSelecionados} disabled={!selecionados.size || ativando}
                style={{ flex:1, justifyContent:'center' }}>
                {ativando ? 'Ativando…' : `Ativar selecionados (${selecionados.size})`}
              </Btn>
            </div>
          </>
        )}
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
  const [sortBy, setSortBy]             = useState('manual'); // manual | nome | vendas | cpa

  const { cards: CARDS, loading, reload } = useAdsCards();
  const [importando, setImportando] = useState(false);
  const [importMsg, setImportMsg]   = useState('');
  const [importPct, setImportPct]   = useState(0);

  // Importa os criativos de todos os cards que têm pasta ADS no Drive (nuvem)
  async function importarArquivos() {
    if (importando) return;
    const jobId = novoJobId();
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    setImportando(true); setImportMsg('Preparando'); setImportPct(0);

    let terminou = false, resposta = null, cortou = false;
    fetch(`${ADS_MEDIA_WORKER}/import-geral`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId }),
    })
      .then(async r => { resposta = await r.json().catch(() => ({})); terminou = true; })
      .catch(() => { cortou = true; terminou = true; });

    while (!terminou) {
      await sleep(2000);
      try {
        const p = await (await fetch(`${ADS_MEDIA_WORKER}/progresso?job=${jobId}`)).json();
        if (typeof p.pct === 'number') setImportPct(p.pct);
        if (p.etapa) setImportMsg(p.etapa);
      } catch {}
    }

    if (cortou) setImportMsg('Seguindo em segundo plano. Recarregue em instantes.');
    else if (!resposta || resposta.error) setImportMsg(resposta?.error || 'Falhou');
    else { setImportMsg(`${resposta.importados} importado(s)${resposta.falhas ? ` · ${resposta.falhas} falha(s)` : ''}`); reload(); }
    setImportPct(0);
    setTimeout(() => { setImportando(false); setImportMsg(''); }, 6000);
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

  // Arrastar pra reordenar dentro da coluna (ou pra uma posição específica ao
  // trocar de coluna). targetCardId null = soltou no fim/vazio da coluna.
  async function handleReorder(draggedId, targetCardId, toColId) {
    if (!window.db || draggedId === targetCardId) return;
    const draggedCard = CARDS.find(c => c.id === draggedId);
    if (!draggedCard) return;

    const colunaCards = ordenarCards(CARDS.filter(c => c.col === toColId && c.id !== draggedId), 'manual');
    let anterior = null, seguinte = null;
    if (targetCardId) {
      const idx = colunaCards.findIndex(c => c.id === targetCardId);
      if (idx < 0) return;
      anterior = idx > 0 ? colunaCards[idx - 1] : null;
      seguinte = colunaCards[idx];
    } else {
      anterior = colunaCards[colunaCards.length - 1] || null;
    }

    const patch = { ordem_manual: calcularOrdemEntre(anterior, seguinte) };
    if (draggedCard.col !== toColId) {
      patch.status = toColId;
      const novaTag = resolveTag(toColId, draggedCard.col, draggedCard.vendas, draggedCard.cpa, draggedCard.gasto);
      if (novaTag !== null) patch.tag = novaTag;
    }
    await window.db.from('ads').update(patch).eq('numero', draggedCard.numero);
    reload();
  }

  // ── Ativar no Meta (com checagem de status real + escolha item a item) ──
  const [checandoMeta, setCheckandoMeta] = useState(false);
  const [ativarModalItens, setAtivarModalItens] = useState(null); // null = modal fechado
  const pendentesMeta = CARDS.filter(c => c.raw?.meta_publish_status === 'rascunho' && c.raw?.meta_ad_id);

  // Antes de listar, confere no Meta se cada anúncio ainda existe. O que já foi
  // deletado/arquivado manualmente no Gerenciador é limpo daqui (não fica reaparecendo).
  async function abrirAtivarMeta() {
    if (!pendentesMeta.length || checandoMeta) return;
    setCheckandoMeta(true);
    try {
      const ids = pendentesMeta.map(c => c.raw.meta_ad_id).join(',');
      const r = await fetch(`${ADS_MEDIA_WORKER}/ads-status?ids=${ids}`);
      const d = await r.json();
      const status = d.status || {};

      const validos = [], sumidos = [];
      for (const c of pendentesMeta) {
        const s = status[c.raw.meta_ad_id];
        (s && s.existe === false ? sumidos : validos).push(c);
      }

      // Reconcilia os que já não existem mais no Meta: limpa os IDs locais pra
      // não continuarem aparecendo como pendentes em toda abertura da tela.
      for (const c of sumidos) {
        await window.db.from('ads').update({
          meta_ad_id: null, meta_campaign_id: null, meta_adset_id: null,
          meta_publish_status: null, meta_ad_url: null,
        }).eq('numero', parseInt(c.num, 10));
      }
      if (sumidos.length) reload();

      if (!validos.length) {
        alert(sumidos.length
          ? `Nenhum anúncio pendente de verdade. ${sumidos.length} card(s) estavam desatualizados (já removidos no Meta) e foram limpos.`
          : 'Nenhum anúncio pendente.');
        return;
      }
      setAtivarModalItens(validos.map(c => ({
        num: c.num, titulo: c.raw?.titulo || '(sem título)', statusAnterior: c.raw?.status,
        campaignId: c.raw.meta_campaign_id, adsetId: c.raw.meta_adset_id, adId: c.raw.meta_ad_id,
      })));
    } catch (e) {
      alert(`Erro ao verificar status no Meta: ${e.message}`);
    } finally {
      setCheckandoMeta(false);
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
            <button onClick={importarArquivos} disabled={importando}
              title="Importa os criativos de todos os cards que têm pasta ADS no Drive"
              style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 13px',
                borderRadius:7, cursor: importando ? 'default' : 'pointer',
                background: importando ? 'rgba(56,189,248,.08)' : 'rgba(255,255,255,.06)',
                border: `1px solid ${importando ? 'rgba(56,189,248,.25)' : 'var(--app-border)'}`,
                color: importando ? '#38bdf8' : 'var(--text-2)',
                fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:11,
                letterSpacing:'0.03em', transition:'all 150ms' }}>
              <LucideIcon icon={importando ? 'loader' : 'folder-down'} size={12}
                style={importando ? { animation:'spin 1s linear infinite' } : {}}/>
              {importando
                ? `${importMsg || 'Importando'}${importPct ? ` · ${Math.round(importPct)}%` : ''}`
                : 'Importar arquivos'}
            </button>
            {pendentesMeta.length > 0 && (
              <button onClick={abrirAtivarMeta} disabled={checandoMeta}
                title="Confere no Meta quais desses rascunhos ainda existem e deixa você escolher quais ativar"
                style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px',
                  background: checandoMeta ? 'rgba(74,222,128,.1)' : 'rgba(74,222,128,.14)',
                  color:'#4ade80', borderRadius:8, border:'1px solid rgba(74,222,128,.35)',
                  fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:12,
                  cursor: checandoMeta ? 'default' : 'pointer' }}>
                <LucideIcon icon={checandoMeta ? 'loader' : 'circle-play'} size={14}
                  style={checandoMeta ? { animation:'spin 1s linear infinite' } : {}}/>
                {checandoMeta ? 'Verificando…' : `Ativar no Meta (${pendentesMeta.length})`}
              </button>
            )}
            {ativarModalItens && (
              <AtivarMetaModal itens={ativarModalItens}
                onClose={() => setAtivarModalItens(null)}
                onDone={() => { setAtivarModalItens(null); reload(); }}/>
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
            {['Todas','Ótimo','Testar novamente','Mediano','Ruim'].map(t => (
              <FilterPill key={t} label={t} active={tagFilter===t} onClick={()=>setTagFilter(t)}/>
            ))}
          </div>
        </div>
        <div style={{ width:1, height:16, background:'var(--app-border)' }}/>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}
          title={sortBy !== 'manual' ? 'Volte pra "Manual" pra poder arrastar os cards' : 'Arraste os cards pra reordenar'}>
          <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
            letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)', whiteSpace:'nowrap' }}>Ordenar</span>
          <div style={{ display:'flex', gap:4 }}>
            {[['manual','Manual'],['nome','Nome'],['vendas','Vendas'],['cpa','CPA']].map(([val, label]) => (
              <FilterPill key={val} label={label} active={sortBy===val} onClick={()=>setSortBy(val)}/>
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
          const cards = ordenarCards(filteredCards.filter(c => c.col === col.id), sortBy);
          return <KanbanColumn key={col.id} col={col} cards={cards}
            onOpen={setSelectedCard} onAddNew={() => setShowNovoAds(true)}
            onDropCard={handleDropCard} sortBy={sortBy} onReorder={handleReorder}/>;
        })}
      </div>

      {selectedCard && (
        <AdsDetailModal
          key={selectedCard.id}
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
