/* ================================================================
   Tracker FMN — Tráfego v3
   Tabela sempre visível · Ações nos alertas · Regras Gerais/
   Específicas nos botões do topbar · RE como badge nas linhas
   ================================================================ */
const { useState, useEffect } = React;
const { LucideIcon, Btn, Badge, TopBar } = window;

const TICKET = 297;
const CPA_LIMITE = +(TICKET * 0.7).toFixed(2); // 207,90

/* ── Helpers de métricas ────────────────────────────────────────*/
function mkMetrics(row) {
  if (!row) return null;
  const gasto      = row.gasto       != null ? +Number(row.gasto).toFixed(2)  : null;
  const linkClicks = row.link_clicks != null ? Number(row.link_clicks)        : null;
  return {
    gasto,
    vendas:      row.compras            != null ? Number(row.compras)                  : null,
    cpa:         row.cpa                != null ? +Number(row.cpa).toFixed(2)          : null,
    roas:        row.roas               != null ? +Number(row.roas).toFixed(2)         : null,
    cpm:         row.cpm                != null ? +Number(row.cpm).toFixed(2)          : null,
    ctr:         row.ctr_unico          != null ? +Number(row.ctr_unico).toFixed(4)    : null,
    freq:        row.frequencia         != null ? +Number(row.frequencia).toFixed(2)   : null,
    connect:     row.connect_rate       != null ? +Number(row.connect_rate).toFixed(4) : null,
    cpc:         (gasto != null && linkClicks && linkClicks > 0)
                   ? +(gasto / linkClicks).toFixed(2) : null,
    link_clicks: linkClicks,
    lp_views:    row.landing_page_views != null ? Number(row.landing_page_views)       : null,
    init_check:  row.initiate_checkout  != null ? Number(row.initiate_checkout)        : null,
    hook_rate:   row.hook_rate          != null ? +Number(row.hook_rate).toFixed(4)    : null,
  };
}

function aggregateMetrics(arr) {
  const valid = arr.filter(m => m && m.gasto > 0);
  if (!valid.length) return null;
  const totalGasto       = valid.reduce((s,m) => s + m.gasto, 0);
  const totalVendas      = valid.reduce((s,m) => s + (m.vendas||0), 0);
  const totalRev         = valid.reduce((s,m) => s + (m.roas    != null ? m.roas    * m.gasto : 0), 0);
  const totalCpmW        = valid.reduce((s,m) => s + (m.cpm     != null ? m.cpm     * m.gasto : 0), 0);
  const totalCtrW        = valid.reduce((s,m) => s + (m.ctr     != null ? m.ctr     * m.gasto : 0), 0);
  const totalFreqW       = valid.reduce((s,m) => s + (m.freq    != null ? m.freq    * m.gasto : 0), 0);
  const totalConnectW    = valid.reduce((s,m) => s + (m.connect != null ? m.connect * m.gasto : 0), 0);
  const totalLinkClicks  = valid.reduce((s,m) => s + (m.link_clicks||0), 0);
  const totalLpViews     = valid.reduce((s,m) => s + (m.lp_views   ||0), 0);
  const totalInitCheck   = valid.reduce((s,m) => s + (m.init_check ||0), 0);
  const totalHookW       = valid.reduce((s,m) => s + (m.hook_rate  != null ? m.hook_rate * m.gasto : 0), 0);
  return {
    gasto:      +totalGasto.toFixed(2),
    vendas:     totalVendas,
    cpa:        totalVendas > 0      ? +(totalGasto / totalVendas).toFixed(2)      : null,
    roas:       totalGasto  > 0      ? +(totalRev   / totalGasto).toFixed(2)       : null,
    cpm:        totalGasto  > 0      ? +(totalCpmW  / totalGasto).toFixed(2)       : null,
    ctr:        totalGasto  > 0      ? +(totalCtrW  / totalGasto).toFixed(4)       : null,
    freq:       totalGasto  > 0      ? +(totalFreqW / totalGasto).toFixed(2)       : null,
    connect:    totalGasto  > 0      ? +(totalConnectW / totalGasto).toFixed(4)    : null,
    cpc:        totalLinkClicks > 0  ? +(totalGasto / totalLinkClicks).toFixed(2)  : null,
    hook_rate:  totalGasto  > 0      ? +(totalHookW / totalGasto).toFixed(4)       : null,
    link_clicks: totalLinkClicks,
    lp_views:    totalLpViews,
    init_check:  totalInitCheck,
  };
}

/* ── Hook: dados reais do Supabase ──────────────────────────────*/
function useTrafficData() {
  const [trafficData, setTrafficData] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [tick, setTick]               = useState(0);

  useEffect(() => {
    async function load() {
      if (!window.db) return;
      try {

      const ADS_NUM_RE = /ADS\s*0*(\d+)/i;

      const [{ data: insights, error: e1 }, { data: adsList, error: e2 }] = await Promise.all([
        window.db.from('insights_cache')
          .select('meta_ad_id,meta_ad_name,meta_campaign_id,meta_campaign_name,meta_adset_id,meta_adset_name,periodo,gasto,cpa,compras,roas,cpm,ctr_unico,frequencia,connect_rate,link_clicks,landing_page_views,initiate_checkout,hook_rate')
          .in('periodo', ['maximum','7d','5d','3d','hoje']),
        window.db.from('ads')
          .select('numero,titulo,status,meta_ad_id,media_drive_url,media_files,meta_ad_url,media_tipo')
          .eq('status', 'ativo')
          .not('meta_ad_id', 'is', null),
      ]);

      if (e1) console.error('[Tráfego] insights_cache:', e1);
      if (e2) console.error('[Tráfego] ads:', e2);

      // adsMap por meta_ad_id + numMap por numero — ambos apenas com status='ativo'
      const adsMap  = Object.fromEntries((adsList||[]).map(a => [a.meta_ad_id, a]));
      const numMap  = Object.fromEntries((adsList||[]).map(a => [a.numero, a]));
      const activoNums = new Set((adsList||[]).map(a => a.numero));

      // Agrupa rows por meta_ad_id → periodo, para saber quais tiveram gasto recente
      const rowsByAid = {};
      for (const row of insights||[]) {
        const aid = row.meta_ad_id;
        if (!rowsByAid[aid]) rowsByAid[aid] = {};
        rowsByAid[aid][row.periodo] = row;
      }

      // Filtra: somente meta_ad_ids que são o ID atual de um ADS ATIVO (status='ativo').
      // Aparece porque está ativo — NÃO depende de ter gasto no período. O filtro de
      // período muda só as métricas exibidas, não quais anúncios aparecem.
      // O fallback por nome só aceita se o aid for exatamente o meta_ad_id atual do ADS ativo —
      // isso impede que IDs antigos do mesmo anúncio (rodando em campanhas encerradas) apareçam.
      const activeAids = new Set(
        Object.entries(rowsByAid)
          .filter(([aid, periods]) => {
            // Caso 1: aid está diretamente mapeado para um ad ativo
            const isDirectMatch = !!adsMap[aid];
            if (!isDirectMatch) {
              // Caso 2: fallback por número no nome — mas só se este aid for o atual do ADS ativo
              const nome = (periods['3d'] || periods['5d'] || periods['maximum'] || Object.values(periods)[0])?.meta_ad_name || '';
              const m = ADS_NUM_RE.exec(nome);
              const num = m ? parseInt(m[1]) : null;
              const ativoAd = num ? numMap[num] : null;
              if (!ativoAd || ativoAd.meta_ad_id !== aid) return false;
            }
            return true;
          })
          .map(([aid]) => aid)
      );

      // Agrupa por campanha → conjunto → anúncio (somente ads ativos com gasto recente)
      const camps = {};
      for (const row of insights||[]) {
        const aid  = row.meta_ad_id;
        if (!activeAids.has(aid)) continue;
        const nome = row.meta_ad_name || '';
        let info = adsMap[aid];
        if (!info) {
          const m = ADS_NUM_RE.exec(nome);
          if (m) info = numMap[parseInt(m[1])];
        }
        if (!info) continue;
        const cid  = row.meta_campaign_id || 'sem-campanha';
        const asid = row.meta_adset_id    || 'sem-conjunto';
        if (!camps[cid]) camps[cid] = {
          id:cid, name:row.meta_campaign_name||`Campanha ${cid.slice(-6)}`,
          status:'active', adsets:{},
        };
        if (!camps[cid].adsets[asid]) {
          camps[cid].adsets[asid] = {
            id:asid, name: row.meta_adset_name || `Conjunto ${asid.slice(-6)}`, status:'active', ads:{},
          };
        } else if (row.meta_adset_name && camps[cid].adsets[asid].name.startsWith('Conjunto ')) {
          camps[cid].adsets[asid].name = row.meta_adset_name;
        }
        if (!camps[cid].adsets[asid].ads[aid]) camps[cid].adsets[asid].ads[aid] = {};
        camps[cid].adsets[asid].ads[aid][row.periodo] = row;
      }

      const result = Object.values(camps).map(c => {
        const adsets = Object.values(c.adsets).map(as => {
          const ads = Object.entries(as.ads).map(([aid, periods]) => {
            const nome = (periods['maximum'] || Object.values(periods)[0])?.meta_ad_name || '';
            let info = adsMap[aid];
            if (!info) { const m = ADS_NUM_RE.exec(nome); if (m) info = numMap[parseInt(m[1])]; }
            const files = (() => { try { return Array.isArray(info?.media_files) ? info.media_files : (info?.media_files ? JSON.parse(info.media_files) : []); } catch { return []; } })();
            return {
              id:      `ads-${info?.numero||aid.slice(-6)}`,
              num:     info?.numero ? String(info.numero).padStart(3,'0') : '???',
              numero:  info?.numero || null,
              metaAdId: aid,
              campId:  c.id,
              adsetId: as.id,
              adsetName: as.name,
              name:    info?.titulo || `Ad ${aid.slice(-6)}`,
              status:  info?.status || 'active',
              thumb:   bestThumb(files, info?.media_drive_url),
              files,
              mediaTipo: info?.media_tipo || null,
              metaAdUrl: aid ? `https://adsmanager.facebook.com/adsmanager/manage/ads?selected_ad_ids=${aid}` : null,
              hist:    mkMetrics(periods['maximum']),
              d7:      mkMetrics(periods['7d']),
              d5:      mkMetrics(periods['5d']),
              d3:      mkMetrics(periods['3d']),
              hoje:    mkMetrics(periods['hoje']),
            };
          });
          // Ordenar ads por CPA 3d crescente dentro do conjunto
          ads.sort((a, b) => (a.d3 && a.d3.cpa != null ? a.d3.cpa : Infinity) - (b.d3 && b.d3.cpa != null ? b.d3.cpa : Infinity));
          return { ...as, ads,
            hist: aggregateMetrics(ads.map(a => a.hist)),
            d7:   aggregateMetrics(ads.map(a => a.d7)),
            d5:   aggregateMetrics(ads.map(a => a.d5)),
            d3:   aggregateMetrics(ads.map(a => a.d3)),
            hoje: aggregateMetrics(ads.map(a => a.hoje)),
          };
        });
        return { ...c, adsets,
          hist: aggregateMetrics(adsets.map(a => a.hist)),
          d7:   aggregateMetrics(adsets.map(a => a.d7)),
          d5:   aggregateMetrics(adsets.map(a => a.d5)),
          d3:   aggregateMetrics(adsets.map(a => a.d3)),
          hoje: aggregateMetrics(adsets.map(a => a.hoje)),
        };
      });

      setTrafficData(result);
      setLoading(false);
      } catch (err) {
        console.error('[Tráfego] Erro ao carregar dados:', err);
        setLoading(false);
      }
    }
    load();
  }, [tick]);

  return { trafficData, loading, reload: () => setTick(t => t + 1) };
}

/* ── Alert actions ──────────────────────────────────────────────*/
const ACTIONS = [
  { id:'pause',    label:'Pausar',         icon:'pause-circle', color:'#f87171' },
  { id:'watch',    label:'Ficar de olho',  icon:'eye',          color:'#fbbf24' },
  { id:'bad',      label:'Perf. ruim',     icon:'thumbs-down',  color:'#f87171' },
  { id:'good',     label:'Perf. boa',      icon:'thumbs-up',    color:'#4ade80' },
  { id:'scale',    label:'Escalar budget', icon:'trending-up',  color:'#34d399' },
  { id:'creative', label:'Novo criativo',  icon:'clapperboard', color:'#60a5fa' },
];

/* ── Global rules ───────────────────────────────────────────────*/
const INIT_GLOBAL_RULES = [
  { code:'G1', name:'Trava universal (CPA ≥ ticket)',      sev:'danger',  active:true },
  { code:'G2', name:'Zero vendas com gasto ≥ 70%',         sev:'danger',  active:true },
  { code:'G3', name:'1 venda com gasto ≥ ticket',          sev:'danger',  active:true },
  { code:'G4', name:'2 vendas com CPA ≥ 70%',              sev:'warning', active:true },
  { code:'G5', name:'3+ vendas: hist + período ruins',     sev:'warning', active:true },
  { code:'G6', name:'Esfriamento (era bom, parou vender)', sev:'warning', active:true },
];

const RULE_SV = { G1:'danger', G2:'danger', G3:'danger', G4:'warning', G5:'warning', G6:'warning' };
const ruleLabel = code => 'RG ' + code.replace('G','');
const reLabel   = code => 'RE ' + code.replace('G','');
const SV = {
  danger:  { color:'#f87171', bg:'rgba(248,113,113,.1)',  bd:'rgba(248,113,113,.25)' },
  warning: { color:'#fbbf24', bg:'rgba(251,191,36,.1)',   bd:'rgba(251,191,36,.25)'  },
  info:    { color:'#60a5fa', bg:'rgba(96,165,250,.1)',   bd:'rgba(96,165,250,.25)'  },
  gold:    { color:'#eaaa41', bg:'rgba(234,170,65,.1)',   bd:'rgba(234,170,65,.3)'   },
};

/* ── Mapear regra → ação sugerida ───────────────────────────────*/
const RULE_SUGG = { G1:'watch',G2:'pause',G3:'watch',G4:'creative',G5:'watch',G6:'watch',G7:'watch' };

/* ── Descrição de cada regra geral para exibição no modal ───────*/
const RULE_DESC = {
  G1: 'Trava universal: se o anúncio tem menos de 5 vendas no histórico e o CPA de 3d OU 5d atingiu o valor do produto (R$297), pausa. Se tem 5+ vendas, exige CPA ruim nos dois períodos ao mesmo tempo.',
  G2: 'Zero vendas no período com gasto ≥ R$207,90 (70% do ticket). Sinal de que o dinheiro está indo sem retorno.',
  G3: 'Apenas 1 venda no período e o gasto total já superou o valor do produto (R$297). CPA inviável.',
  G4: 'Apenas 2 vendas no período e o CPA já está acima de R$207,90. Tendência de custo alto antes de estabilizar.',
  G5: 'CPA histórico ≥ R$207,90 e CPA do período (3d ou 5d) também ruim. Exceção: se um dos períodos está recuperando (CPA < R$207,90 com ao menos 1 venda), a regra é suprimida.',
  G6: 'Esfriamento: anúncio que já teve 3+ vendas e CPA histórico saudável, mas zerou vendas no período com gasto ≥ R$207,90. Sinal de que o criativo saturou.',
};

function fmtAlertDt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

/* ── Hook: alertas reais do Supabase ────────────────────────────*/
function useAlertas() {
  const [alerts, setAlerts] = useState([]);
  const [alertTick, setAlertTick] = useState(0);

  useEffect(() => {
    if (!window.db) return;
    (async () => {
      const { data } = await window.db.from('alertas')
        .select('id,ads_numero,meta_ad_id,meta_campaign_id,regra_codigo,mensagem,created_at,resolvido')
        .eq('resolvido', false)
        .order('created_at', { ascending: false })
        .limit(50);

      const nums = [...new Set((data || []).map(r => r.ads_numero).filter(Boolean))];
      let adsInfo = {};
      if (nums.length) {
        const { data: adsData } = await window.db.from('ads')
          .select('numero,titulo,media_drive_url')
          .in('numero', nums);
        adsInfo = Object.fromEntries((adsData || []).map(a => [a.numero, a]));
      }

      setAlerts((data || []).map(r => ({
        id: r.id,
        rule: r.regra_codigo,
        adsNum: String(r.ads_numero).padStart(3,'0'),
        adsId: `ads-${r.ads_numero}`,
        campaignId: r.meta_campaign_id || 'unknown',
        msg: r.mensagem,
        dt: fmtAlertDt(r.created_at),
        suggestedAction: RULE_SUGG[r.regra_codigo] || 'watch',
        titulo: adsInfo[r.ads_numero]?.titulo || null,
        thumb:  driveThumb(adsInfo[r.ads_numero]?.media_drive_url),
      })));
    })();
  }, [alertTick]);

  return { alerts, setAlerts, reloadAlerts: () => setAlertTick(t => t + 1) };
}

const INIT_SPECIFIC_RULES = [];

/* ── Helpers ────────────────────────────────────────────────────*/
const fR = n => n==null?'—':window.fmtBRL(n);

function driveThumb(url) {
  if (!url) return null;
  if (!url.includes('drive.google.com')) return url;
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w120`;
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return `https://drive.google.com/thumbnail?id=${m2[1]}&sz=w120`;
  return url;
}

/* Thumb preferindo imagem do media_files; fallback para driveThumb.
   media_files tem dois formatos possíveis: R2 novo (thumb_url pronto) e
   Drive antigo (file_id, monta a URL de thumbnail). Checa R2 primeiro. */
function bestThumb(mediaFiles, driveUrl) {
  if (mediaFiles && mediaFiles.length > 0) {
    const img = mediaFiles.find(f => f.tipo === 'imagem');
    if (img) return img.thumb_url || (img.file_id ? `https://drive.google.com/thumbnail?id=${img.file_id}&sz=w120` : null);
    const vid = mediaFiles.find(f => f.tipo === 'video' || f.tipo === 'reels');
    if (vid) return vid.thumb_url || (vid.file_id ? `https://drive.google.com/thumbnail?id=${vid.file_id}&sz=w120` : null);
  }
  return driveThumb(driveUrl);
}
const cpaCol    = c  => c==null?'var(--text-3)':c/TICKET>=1?'#f87171':c/TICKET>=.7?'#fbbf24':'#4ade80';
const roasCol   = v  => v==null?'var(--text-3)':v>=3?'#4ade80':v>=2?'#eaaa41':'#f87171';
const cpmCol    = v  => v==null?'var(--text-3)':v<20?'#4ade80':v<40?'#fbbf24':'#f87171';
const ctrCol    = v  => v==null?'var(--text-3)':v>=0.02?'#4ade80':v>=0.01?'#eaaa41':'#f87171';
const freqCol   = v  => v==null?'var(--text-3)':v<2?'#4ade80':v<3?'#eaaa41':'#f87171';
const connectCol= v  => v==null?'var(--text-3)':v>=0.6?'#4ade80':v>=0.4?'#eaaa41':'#f87171';
const hookCol   = v  => v==null?'var(--text-3)':v>=0.25?'#4ade80':v>=0.15?'#eaaa41':'#f87171';
const pct       = v  => v==null?'—':`${(v*100).toFixed(1)}%`;
const num       = v  => v==null||v===0?'—':v.toLocaleString('pt-BR');

/* Todas as colunas da aba selecionada */
const COLS = [
  { k:'gasto',      head:'Gasto',      fmt: v => fR(v),                        color: () => 'var(--text-1)',  w: 78  },
  { k:'vendas',     head:'Vendas',     fmt: v => v??'—',                        color: () => 'var(--text-1)',  w: 56  },
  { k:'cpa',        head:'CPA',        fmt: v => fR(v),                        color: cpaCol,                  w: 78  },
  { k:'cpc',        head:'CPC',        fmt: v => fR(v),                        color: () => 'var(--text-1)',   w: 66  },
  { k:'cpm',        head:'CPM',        fmt: v => fR(v),                        color: cpmCol,                  w: 68  },
  { k:'ctr',        head:'CTR',        fmt: v => pct(v),                       color: ctrCol,                  w: 58  },
  { k:'hook_rate',  head:'Hook%',      fmt: v => pct(v),                       color: hookCol,                 w: 58  },
  { k:'lp_views',   head:'LP Views',   fmt: v => num(v),                       color: () => 'var(--text-2)',   w: 64  },
  { k:'init_check', head:'Init.',      fmt: v => num(v),                       color: () => 'var(--text-2)',   w: 52  },
  { k:'connect',    head:'Connect',    fmt: v => pct(v),                       color: connectCol,              w: 68  },
  { k:'freq',       head:'Freq.',      fmt: v => v!=null?v.toFixed(1):'—',     color: freqCol,                 w: 52  },
  { k:'roas',       head:'ROAS',       fmt: v => v!=null?`${v}x`:'—',          color: roasCol,                 w: 60  },
];

/* Períodos (modo "Por métrica"): chave no row × rótulo da coluna */
const PERIOD_COLS = [
  { pk:'hoje', head:'Hoje'   },
  { pk:'d3',   head:'3D'     },
  { pk:'d5',   head:'5D'     },
  { pk:'d7',   head:'7D'     },
  { pk:'hist', head:'Máximo' },
];

function getAllElements(trafficData) {
  const campaigns = trafficData.map(c => ({ id:c.id, label:c.name, scope:'campaign', status:c.status }));
  const adsets = trafficData.flatMap(c => (c.adsets||[]).map(a => ({ id:a.id, label:`${c.name} › ${a.name}`, scope:'adset', status:a.status })));
  const ads = trafficData.flatMap(c => (c.adsets||[]).flatMap(a => (a.ads||[]).map(ad => ({ id:ad.id, label:`ADS ${ad.num} — ${ad.name.slice(0,40)}`, scope:'ad', status:'active' }))));
  return { campaigns, adsets, ads };
}

/* ── MetricCell ─────────────────────────────────────────────────*/
function MCell({ m, col, row, onHover }) {
  const v = m?.[col.k];
  const hoverable = !!(row && onHover);
  const [hv, setHv] = useState(false);
  const handlers = hoverable ? {
    onMouseEnter: e => { setHv(true); onHover({ row, col, rect: e.currentTarget.getBoundingClientRect() }); },
    onMouseLeave: () => { setHv(false); onHover(null); },
  } : {};
  return (
    <td {...handlers} style={{ padding:'0 10px', textAlign:'right', fontSize:12.5, width: col.w,
      fontFamily:'Roboto,sans-serif', fontWeight:700, color:col.color(v), whiteSpace:'nowrap',
      boxShadow: hv ? 'inset 0 0 0 1px rgba(234,170,65,.45), inset 0 0 0 60px rgba(234,170,65,.12)' : 'none',
      transition:'box-shadow 120ms' }}>
      {col.fmt(v)}
    </td>
  );
}

/* ── Popover de hover: a métrica nas 4 janelas ──────────────────*/
function MetricHoverPopover({ hover }) {
  if (!hover) return null;
  const { row, col, rect } = hover;
  const WIDTH = 152, ALTURA_EST = 150, MARGEM = 8;
  const left = Math.min(Math.max(rect.left - 40, MARGEM), window.innerWidth - WIDTH - MARGEM);
  const cabeAbaixo = rect.bottom + 6 + ALTURA_EST <= window.innerHeight - MARGEM;
  const top = cabeAbaixo ? rect.bottom + 6 : Math.max(MARGEM, rect.top - 6 - ALTURA_EST);
  return (
    <div style={{ position:'fixed', left, top, zIndex:850, width:152, pointerEvents:'none',
      background:'var(--app-surface)', border:'1px solid var(--app-border-2)', borderRadius:10,
      boxShadow:'0 12px 32px rgba(0,0,0,.5)', padding:'10px 12px',
      display:'flex', flexDirection:'column', gap:6 }}>
      <div style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:900, letterSpacing:'0.08em',
        textTransform:'uppercase', color:'var(--fmn-gold)', marginBottom:2 }}>{col.head}</div>
      {PERIOD_COLS.map(p => {
        const v = row[p.pk]?.[col.k];
        return (
          <div key={p.pk} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'var(--text-3)' }}>{p.head}</span>
            <span style={{ fontSize:12.5, fontFamily:'Roboto,sans-serif', fontWeight:700, color:col.color(v) }}>{col.fmt(v)}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── MediaModal ─────────────────────────────────────────────────*/
function MediaModal({ ad, onClose }) {
  if (!ad) return null;
  const files = ad.files || [];
  const images = files.filter(f => f.tipo === 'imagem');
  const video = files.find(f => f.tipo === 'video');

  // Imagem/carrossel: visualização ampliada (mesmo componente do Orgânico).
  // Vídeo do Drive não dá pra embutir direto (sem stream público), então
  // esse caso continua abrindo no Drive pelo box abaixo.
  if (images.length > 0) {
    const urls = images.map(f => f.url_embed || `https://drive.google.com/thumbnail?id=${f.file_id}&sz=w1080`);
    return <CarouselLightbox urls={urls} initialIdx={0} onClose={onClose}/>;
  }

  const overlay = {
    position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:9000,
    display:'flex', alignItems:'center', justifyContent:'center',
  };
  const box = {
    position:'relative', background:'#18191c', borderRadius:16,
    maxWidth:'90vw', maxHeight:'90vh', overflow:'hidden',
    display:'flex', flexDirection:'column', alignItems:'center',
  };

  const videoThumb = video ? `https://drive.google.com/thumbnail?id=${video.file_id}&sz=w640` : null;

  let content;
  if (video) {
    const viewUrl = video.url_view || `https://drive.google.com/file/d/${video.file_id}/view`;
    content = (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
        <div style={{ position:'relative', width:'min(560px,80vw)', borderRadius:10, overflow:'hidden',
          background:'#111', border:'1px solid rgba(255,255,255,.1)' }}>
          {videoThumb && (
            <img src={videoThumb} alt="thumb do vídeo"
              style={{ width:'100%', display:'block', objectFit:'cover', opacity:0.7 }}
              onError={e => e.currentTarget.style.display='none'}/>
          )}
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <a href={viewUrl} target="_blank" rel="noopener noreferrer"
              style={{ display:'flex', alignItems:'center', justifyContent:'center',
                width:64, height:64, borderRadius:'50%', background:'rgba(0,0,0,.7)',
                border:'2px solid rgba(255,255,255,.5)', textDecoration:'none', color:'#fff' }}>
              <LucideIcon icon="play" size={28}/>
            </a>
          </div>
        </div>
        <a href={viewUrl} target="_blank" rel="noopener noreferrer"
          style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 18px', borderRadius:8,
            background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.15)',
            color:'rgba(255,255,255,.8)', fontSize:13, fontFamily:'Roboto,sans-serif',
            textDecoration:'none', fontWeight:500 }}>
          <LucideIcon icon="external-link" size={14}/>
          Abrir vídeo no Drive
        </a>
      </div>
    );
  } else {
    content = <div style={{ color:'rgba(255,255,255,.4)', padding:40, fontFamily:'Roboto,sans-serif' }}>Sem mídia disponível</div>;
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={box} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%',
          padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,.08)' }}>
          <span style={{ fontFamily:'Roboto,sans-serif', fontSize:13, fontWeight:700, color:'#fff' }}>
            ADS {ad.num} — {ad.name}
          </span>
          <button onClick={onClose}
            style={{ background:'transparent', border:'none', cursor:'pointer', color:'rgba(255,255,255,.5)', padding:4 }}>
            <LucideIcon icon="x" size={18}/>
          </button>
        </div>
        <div style={{ padding:20 }}>{content}</div>
      </div>
    </div>
  );
}

/* ── TrafficRow ─────────────────────────────────────────────────*/
function TrafficRow({ row, depth=0, period, viewMode='periodo', metricCol, onCellHover, specificRules, pausedIds, pausingIds, focusIds, setFocusIds, onThumbClick, onAddRule, adAlerts, onBellClick, onPauseDirect }) {
  const [open, setOpen]   = useState(depth <= 1);
  const indent  = depth * 20;
  const isAd    = depth === 2;
  const hasSub  = !isAd && (row.adsets||row.ads||[]).length > 0;
  const isPaused= pausedIds.includes(row.id) || row.status === 'paused';
  const myRules = specificRules.filter(re => re.targetId === row.id);
  const isFocused = focusIds.has(row.id);
  const faded     = focusIds.size > 0 && !isFocused;

  const PKEY = { hoje:'hoje', '3d':'d3', '5d':'d5', '7d':'d7', maximum:'hist' };
  const m = row[PKEY[period] || 'd3'] || null;

  const baseBg  = isPaused ? 'rgba(248,113,113,.03)' : 'transparent';
  const focusBg = isFocused ? 'rgba(234,170,65,.06)' : baseBg;
  const adCpaColor = isAd && m?.cpa != null
    ? cpaCol(m.cpa) : null;

  return (
    <>
      <tr style={{ borderBottom:'1px solid rgba(255,255,255,.04)',
        background: focusBg,
        opacity: isPaused ? 0.55 : faded ? 0.3 : 1,
        transition:'background 120ms, opacity 150ms',
        outline: isFocused ? '1px solid rgba(234,170,65,.3)' : 'none' }}
        onMouseEnter={e => { if (!isPaused && !faded) e.currentTarget.style.background=isFocused?'rgba(234,170,65,.09)':'rgba(255,255,255,.03)'; e.currentTarget.querySelectorAll('.pause-direct-btn').forEach(b => b.style.opacity='1'); }}
        onMouseLeave={e => { e.currentTarget.style.background=focusBg; e.currentTarget.querySelectorAll('.pause-direct-btn').forEach(b => b.style.opacity='0'); }}>

        {/* ── Nome ── */}
        <td style={{ padding:'9px 12px', paddingLeft: 14+indent,
          borderLeft: adCpaColor ? `3px solid ${adCpaColor}` : '3px solid transparent' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>

            {/* Foco */}
            <button onClick={e => { e.stopPropagation(); setFocusIds(prev => { const s = new Set(prev); isFocused ? s.delete(row.id) : s.add(row.id); return s; }); }}
              title={isFocused ? 'Remover foco' : 'Destacar linha'}
              style={{ width:18, height:18, borderRadius:4, flexShrink:0, cursor:'pointer', padding:0,
                display:'flex', alignItems:'center', justifyContent:'center',
                border:`1px solid ${isFocused?'rgba(234,170,65,.5)':'rgba(255,255,255,.1)'}`,
                background: isFocused?'rgba(234,170,65,.15)':'rgba(255,255,255,.04)',
                color: isFocused?'var(--fmn-gold)':'rgba(255,255,255,.3)', transition:'all 150ms' }}>
              <LucideIcon icon="eye" size={10}/>
            </button>

            {/* Expand */}
            {hasSub
              ? <button onClick={() => setOpen(!open)}
                  style={{ width:16,height:16,borderRadius:3,background:'rgba(255,255,255,.07)',
                    border:'none',color:'var(--text-3)',display:'flex',alignItems:'center',
                    justifyContent:'center',cursor:'pointer',flexShrink:0 }}>
                  <LucideIcon icon={open?'chevron-down':'chevron-right'} size={11}/>
                </button>
              : <div style={{ width:16, flexShrink:0 }}/>}

            {/* Thumb (ads apenas) */}
            {isAd && (row.thumb || row.files?.length > 0 || row.mediaTipo) && (() => {
              const hasImg  = row.files?.some(f => f.tipo === 'imagem');
              const hasVid  = row.files?.some(f => f.tipo === 'video')
                           || ['reels','video'].includes(row.mediaTipo);
              const showImg = !!row.thumb;
              return (
                <div onClick={() => onThumbClick?.(row)} title="Ver mídia"
                  style={{ position:'relative', width:30, height:30, borderRadius:4, flexShrink:0,
                    cursor:'pointer', border:'1px solid rgba(255,255,255,.1)', overflow:'hidden',
                    background:'rgba(255,255,255,.04)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {showImg
                    ? <img src={row.thumb} alt=""
                        onError={e => { e.currentTarget.style.display='none'; }}
                        style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
                    : hasVid
                      ? <LucideIcon icon="play-circle" size={16} style={{ color:'rgba(255,255,255,.4)' }}/>
                      : <LucideIcon icon="image" size={14} style={{ color:'rgba(255,255,255,.3)' }}/>
                  }
                </div>
              );
            })()}

            {/* Número do AD */}
            {isAd && (
              <span style={{ fontSize:9.5, fontFamily:'Roboto,sans-serif', fontWeight:900,
                color:'var(--clr-teal)', letterSpacing:'0.08em', flexShrink:0 }}>{row.num}</span>
            )}

            {/* Nome */}
            <span style={{ fontSize:isAd?12:12.5, fontFamily:'Roboto,sans-serif',
              fontWeight:depth===0?700:600, color:'var(--text-1)', lineHeight:1.3,
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0 }}>
              {row.name}
            </span>


            {/* + Regra (campanha, conjunto ou anúncio) */}
            {onAddRule && (
              <button onClick={e => { e.stopPropagation(); onAddRule({ id:row.id, scope: depth===0?'campaign':depth===1?'adset':'ad' }); }}
                title={depth===0?'Adicionar regra na campanha':depth===1?'Adicionar regra no conjunto':'Adicionar regra no anúncio'}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                  width:16, height:16, borderRadius:3, cursor:'pointer', padding:0,
                  background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)',
                  color:'rgba(255,255,255,.25)', transition:'all 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(234,170,65,.15)'; e.currentTarget.style.color='var(--fmn-gold)'; }}
                onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,.05)'; e.currentTarget.style.color='rgba(255,255,255,.25)'; }}>
                <LucideIcon icon="plus" size={9}/>
              </button>
            )}

            {/* Sino de alertas */}
            {isAd && (adAlerts?.[row.id]?.length > 0 || pausingIds?.has(row.id)) && (() => {
              const isPausing = pausingIds?.has(row.id);
              const ps = adAlerts?.[row.id] || [];
              const hasDanger = ps.some(p => RULE_SV[p.regra] === 'danger');
              const bsv = isPausing ? SV.gold : (hasDanger ? SV.danger : SV.warning);
              return (
                <button onClick={e => { e.stopPropagation(); if (!isPausing) onBellClick?.(row.id, ps, e); }}
                  title={isPausing ? 'Pausando no Meta...' : `${ps.length} alerta(s)`}
                  style={{ display:'flex', alignItems:'center', gap:3, flexShrink:0,
                    minWidth:18, height:18, borderRadius:3, cursor: isPausing ? 'default' : 'pointer',
                    padding: !isPausing && ps.length > 1 ? '0 4px' : 0,
                    background:bsv.bg, border:`1px solid ${bsv.bd}`, color:bsv.color,
                    boxShadow:`0 0 5px ${bsv.color}44` }}>
                  <LucideIcon icon={isPausing ? 'loader' : 'bell'} size={10}/>
                  {!isPausing && ps.length > 1 && <span style={{ fontSize:8.5, fontWeight:900, fontFamily:'Roboto,sans-serif' }}>{ps.length}</span>}
                </button>
              );
            })()}

            {/* Botão pausar direto — visível em qualquer linha ativa */}
            {!isPaused && onPauseDirect && (
              <button
                onClick={e => { e.stopPropagation(); onPauseDirect(row, depth); }}
                title="Pausar no Meta"
                style={{ display:'flex', alignItems:'center', gap:3, flexShrink:0,
                  height:18, padding:'0 6px', borderRadius:3, cursor:'pointer',
                  background:'rgba(248,113,113,.1)', border:'1px solid rgba(248,113,113,.25)',
                  color:'#f87171', fontSize:9.5, fontFamily:'Roboto,sans-serif',
                  fontWeight:700, letterSpacing:'0.05em', transition:'all 150ms', opacity:0 }}
                onMouseEnter={e => { e.currentTarget.style.opacity='1'; e.currentTarget.style.background='rgba(248,113,113,.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity='0'; }}
                className="pause-direct-btn">
                <LucideIcon icon="pause-circle" size={10}/>
                Pausar
              </button>
            )}

            {isPaused && <Badge tone="warning">Pausado</Badge>}
            {myRules.map(re => (
              <span key={re.id} style={{ padding:'1px 6px', borderRadius:999, fontSize:9, flexShrink:0,
                fontFamily:'Roboto,sans-serif', fontWeight:900, letterSpacing:'0.06em',
                background:'rgba(234,170,65,.12)', color:'var(--fmn-gold)', border:'1px solid rgba(234,170,65,.3)' }}>
                {reLabel(re.rule)}
              </span>
            ))}
          </div>
        </td>

        {/* ── Métricas ── */}
        {viewMode === 'metrica' && metricCol
          ? PERIOD_COLS.map(p => <MCell key={p.pk} m={row[p.pk]} col={metricCol}/>)
          : COLS.map(col => <MCell key={col.k} m={m} col={col} row={row} onHover={onCellHover}/>)}
      </tr>

      {open && (row.adsets||[]).map(a => (
        <TrafficRow key={a.id} row={a} depth={1} period={period} viewMode={viewMode} metricCol={metricCol} onCellHover={onCellHover}
          specificRules={specificRules} pausedIds={pausedIds} pausingIds={pausingIds} focusIds={focusIds} setFocusIds={setFocusIds}
          onThumbClick={onThumbClick} onAddRule={onAddRule} adAlerts={adAlerts} onBellClick={onBellClick} onPauseDirect={onPauseDirect}/>
      ))}
      {open && (row.ads||[]).map(a => (
        <TrafficRow key={a.id} row={a} depth={2} period={period} viewMode={viewMode} metricCol={metricCol} onCellHover={onCellHover}
          specificRules={specificRules} pausedIds={pausedIds} pausingIds={pausingIds} focusIds={focusIds} setFocusIds={setFocusIds}
          onThumbClick={onThumbClick} onAddRule={onAddRule} adAlerts={adAlerts} onBellClick={onBellClick} onPauseDirect={onPauseDirect}/>
      ))}
    </>
  );
}

/* ── AlertCard ──────────────────────────────────────────────────*/
function AlertCard({ alert, userAction, onAction }) {
  const sv = SV[RULE_SV[alert.rule]] || SV.info;
  const effectiveAction = userAction || alert.suggestedAction;
  return (
    <div style={{ background:'var(--app-surface-2)', border:`1px solid ${sv.bd}`,
      borderRadius:12, padding:'14px 16px', display:'flex', flexDirection:'column', gap:10 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
        {alert.thumb && (
          <img src={alert.thumb} alt="" style={{ width:52, height:52, borderRadius:7,
            objectFit:'cover', flexShrink:0, border:'1px solid var(--app-border)' }}/>
        )}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:4 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <span style={{ padding:'3px 8px', borderRadius:999, fontSize:10.5,
                fontFamily:'Roboto,sans-serif', fontWeight:900, letterSpacing:'0.06em',
                background:sv.bg, color:sv.color, border:`1px solid ${sv.bd}`, flexShrink:0 }}>
                {ruleLabel(alert.rule)}
              </span>
              <span style={{ fontSize:13, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-1)' }}>
                ADS {alert.adsNum}
              </span>
            </div>
            <span style={{ fontSize:11, color:'var(--text-3)', fontFamily:'Roboto,sans-serif', flexShrink:0 }}>
              {alert.dt}
            </span>
          </div>
          {alert.titulo && (
            <div style={{ fontSize:11.5, fontFamily:'Roboto,sans-serif', color:'var(--text-3)',
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {alert.titulo}
            </div>
          )}
        </div>
      </div>

      <p style={{ fontSize:12.5, fontFamily:'Roboto,sans-serif', lineHeight:1.6, color:'var(--text-2)', margin:0 }}>
        {alert.msg}
      </p>

      {/* Sugestão da análise + botão executar */}
      {alert.suggestedAction && (
        <div style={{ display:'flex', alignItems:'center', gap:8,
          padding:'8px 12px', borderRadius:8,
          background:'rgba(234,170,65,.06)', border:'1px solid rgba(234,170,65,.15)' }}>
          <LucideIcon icon="sparkles" size={12} color="var(--fmn-gold)"/>
          <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'var(--text-3)' }}>Sugerido:</span>
          <span style={{ fontSize:11.5, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--fmn-gold)', flex:1 }}>
            {ACTIONS.find(a => a.id === alert.suggestedAction)?.label}
          </span>
          {userAction && userAction !== alert.suggestedAction
            ? <span style={{ fontSize:10.5, color:'rgba(255,255,255,.28)', fontFamily:'Roboto,sans-serif' }}>override manual</span>
            : !userAction && (
              <button
                onClick={() => onAction(alert.id, alert.suggestedAction, alert.adsId, alert.campaignId)}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px',
                  borderRadius:7, cursor:'pointer', transition:'all 130ms',
                  background:'var(--fmn-gold)', border:'none', color:'var(--fmn-black)',
                  fontFamily:'Roboto,sans-serif', fontWeight:900, fontSize:10.5,
                  letterSpacing:'0.04em', textTransform:'uppercase', whiteSpace:'nowrap' }}>
                <LucideIcon icon="zap" size={11}/>
                Realizar ação
              </button>
            )
          }
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display:'flex', gap:5, flexWrap:'wrap', paddingTop:8, borderTop:'1px solid var(--app-border)' }}>
        {ACTIONS.map(a => {
          const isActive = effectiveAction === a.id;
          const isSugg   = alert.suggestedAction === a.id;
          return (
            <button key={a.id} onClick={() => onAction(alert.id, a.id, alert.adsId, alert.campaignId)}
              style={{ display:'flex', alignItems:'center', gap:4,
                padding:'4px 9px', borderRadius:999, cursor:'pointer', transition:'all 130ms',
                background: isActive ? `${a.color}22` : 'rgba(255,255,255,.05)',
                border: `1px solid ${isActive ? a.color+'66' : isSugg ? a.color+'40' : 'rgba(255,255,255,.08)'}`,
                color: isActive ? a.color : isSugg ? a.color+'bb' : 'rgba(255,255,255,.28)',
                fontSize:10.5, fontFamily:'Roboto,sans-serif', fontWeight:700 }}>
              <LucideIcon icon={a.icon} size={11}/>
              {a.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── RECard (specific rule card shown with alerts) ──────────────*/
function RECard({ re, onDelete }) {
  const sv = SV[RULE_SV[re.rule]] || SV.gold;
  return (
    <div style={{ background:'rgba(234,170,65,.04)', border:'1px solid rgba(234,170,65,.25)',
      borderRadius:12, padding:'12px 16px', display:'flex', alignItems:'flex-start', gap:12 }}>
      <div style={{ flexShrink:0, marginTop:1 }}>
        <span style={{ padding:'3px 8px', borderRadius:999, fontSize:10, fontFamily:'Roboto,sans-serif',
          fontWeight:900, letterSpacing:'0.08em', background:'rgba(234,170,65,.15)',
          color:'var(--fmn-gold)', border:'1px solid rgba(234,170,65,.3)' }}>
          {reLabel(re.rule)}
        </span>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
          color:'var(--text-1)', marginBottom:2 }}>
          {re.targetName}
        </div>
        {re.note && (
          <div style={{ fontSize:12, fontFamily:'Roboto,sans-serif', color:'var(--text-3)', lineHeight:1.5 }}>
            {re.note}
          </div>
        )}
      </div>
      <button onClick={() => onDelete(re.id)}
        style={{ width:24,height:24,borderRadius:6,background:'rgba(255,255,255,.05)',
          border:'1px solid var(--app-border)',color:'var(--text-3)',cursor:'pointer',
          display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 150ms' }}
        onMouseEnter={e => { e.currentTarget.style.color='#f87171'; e.currentTarget.style.borderColor='rgba(248,113,113,.3)'; }}
        onMouseLeave={e => { e.currentTarget.style.color='var(--text-3)'; e.currentTarget.style.borderColor='var(--app-border)'; }}>
        <LucideIcon icon="x" size={12}/>
      </button>
    </div>
  );
}

/* ── GlobalRulesModal ───────────────────────────────────────────*/
function GlobalRulesModal({ rules, onChange, onCreate, onClose }) {
  const [view, setView] = useState('list');
  const [form, setForm] = useState({ name:'', sev:'warning', paramLabel:'', paramVal:'' });
  const INP = { width:'100%', padding:'8px 11px', borderRadius:7, background:'var(--app-surface-2)',
    border:'1px solid var(--app-border)', color:'var(--text-1)', fontFamily:'Roboto,sans-serif', fontSize:13 };
  const LBL = { fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700, letterSpacing:'0.1em',
    textTransform:'uppercase', color:'var(--text-3)', marginBottom:5, display:'block' };
  const handleCreate = () => {
    if (!form.name.trim()) return;
    onCreate({ name:form.name, sev:form.sev,
      paramLabel:form.paramLabel||null, paramVal:form.paramVal||null, active:true });
    setForm({ name:'', sev:'warning', paramLabel:'', paramVal:'' });
    setView('list');
  };
  return (
    <div onClick={onClose}
      style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.68)',zIndex:500,
        display:'flex',alignItems:'center',justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:'var(--app-surface)',border:'1px solid var(--app-border-2)',
          borderRadius:16,width:520,maxHeight:'82vh',display:'flex',flexDirection:'column',
          boxShadow:'0 24px 64px rgba(0,0,0,.55)' }}>
        <div style={{ padding:'16px 20px',borderBottom:'1px solid var(--app-border)',
          display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0 }}>
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            {view==='new' && (
              <button onClick={()=>setView('list')}
                style={{ width:26,height:26,borderRadius:7,background:'rgba(255,255,255,.07)',
                  border:'1px solid var(--app-border)',color:'var(--text-2)',cursor:'pointer',
                  display:'flex',alignItems:'center',justifyContent:'center' }}>
                <LucideIcon icon="arrow-left" size={13}/>
              </button>
            )}
            <span style={{ fontSize:14,fontFamily:'Roboto,sans-serif',fontWeight:700,color:'var(--text-1)' }}>
              {view==='new' ? 'Nova Regra Geral' : 'Regras Gerais'}
            </span>
          </div>
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            {view==='list' && (
              <Btn variant="secondary" size="sm" icon="plus" onClick={()=>setView('new')}>Nova Regra</Btn>
            )}
            <button onClick={onClose}
              style={{ width:28,height:28,borderRadius:'50%',background:'rgba(255,255,255,.07)',
                color:'var(--text-2)',cursor:'pointer',fontSize:18,
                display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>
          </div>
        </div>

        {view === 'list' ? (
          <div style={{ flex:1,overflowY:'auto',padding:'12px 16px',display:'flex',flexDirection:'column',gap:8 }}>
            {rules.map(r => {
              const sv = SV[r.sev] || SV.info;
              return (
                <div key={r.code}
                  style={{ display:'flex',alignItems:'flex-start',gap:12,padding:'12px 14px',
                    borderRadius:10,background:'var(--app-surface-2)',
                    border:`1px solid ${r.active?sv.bd:'var(--app-border)'}`,
                    opacity:r.active?1:0.45,transition:'all 150ms' }}>
                  <span style={{ padding:'3px 8px',borderRadius:999,fontSize:10.5,
                    fontFamily:'Roboto,sans-serif',fontWeight:900,flexShrink:0,
                    background:sv.bg,color:sv.color,border:`1px solid ${sv.bd}` }}>
                    {ruleLabel(r.code)}
                  </span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13,fontFamily:'Roboto,sans-serif',fontWeight:700,
                      color:'var(--text-1)',marginBottom:4 }}>{r.name}</div>
                    {RULE_DESC[r.code] && (
                      <div style={{ fontSize:11.5,fontFamily:'Roboto,sans-serif',color:'var(--text-3)',
                        lineHeight:1.55,marginBottom: r.paramLabel ? 6 : 0 }}>
                        {RULE_DESC[r.code]}
                      </div>
                    )}
                    {r.paramLabel && r.paramVal!=null && (
                      <div style={{ display:'inline-flex',gap:5,padding:'2px 8px',borderRadius:5,
                        background:'rgba(255,255,255,.05)',border:'1px solid var(--app-border)',marginTop:4 }}>
                        <span style={{ fontSize:10.5,color:'var(--text-3)',fontFamily:'Roboto,sans-serif' }}>{r.paramLabel}:</span>
                        <span style={{ fontSize:11,fontFamily:'Roboto,sans-serif',fontWeight:700,color:'var(--fmn-gold)' }}>{r.paramVal}</span>
                      </div>
                    )}
                  </div>
                  <div onClick={() => onChange(r.code, !r.active)}
                    style={{ width:36,height:20,borderRadius:999,cursor:'pointer',transition:'all 200ms',
                      background:r.active?'#4ade80':'rgba(255,255,255,.15)',position:'relative',flexShrink:0 }}>
                    <div style={{ position:'absolute',top:2,left:r.active?17:2,width:16,height:16,
                      borderRadius:'50%',background:'#fff',transition:'left 200ms' }}/>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ flex:1,overflowY:'auto',padding:'16px',display:'flex',flexDirection:'column',gap:14 }}>
            <div><span style={LBL}>Nome da Regra</span>
              <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}
                style={INP} placeholder="Ex: ROAS mínimo de 2x"/>
            </div>
            <div><span style={LBL}>Severidade</span>
              <div style={{ display:'flex',gap:6 }}>
                {[['danger','Crítico'],['warning','Atenção'],['info','Info']].map(([s,l]) => (
                  <button key={s} onClick={()=>setForm(p=>({...p,sev:s}))}
                    style={{ flex:1,padding:'7px 0',borderRadius:7,cursor:'pointer',transition:'all 130ms',
                      fontFamily:'Roboto,sans-serif',fontWeight:700,fontSize:12,
                      background:form.sev===s?(s==='danger'?'rgba(248,113,113,.15)':s==='warning'?'rgba(251,191,36,.12)':'rgba(96,165,250,.12)'):'rgba(255,255,255,.05)',
                      border:`1px solid ${form.sev===s?(s==='danger'?'rgba(248,113,113,.35)':s==='warning'?'rgba(251,191,36,.35)':'rgba(96,165,250,.35)'):'var(--app-border)'}`,
                      color:form.sev===s?(s==='danger'?'#f87171':s==='warning'?'#fbbf24':'#60a5fa'):'var(--text-3)' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div><span style={LBL}>Parâmetro (opcional)</span>
              <input value={form.paramLabel} onChange={e=>setForm(p=>({...p,paramLabel:e.target.value}))}
                style={INP} placeholder="Nome do parâmetro (ex: cpa_limite)"/>
            </div>
            <div><span style={LBL}>Valor padrão</span>
              <input value={form.paramVal} onChange={e=>setForm(p=>({...p,paramVal:e.target.value}))}
                style={INP} placeholder="Ex: 1500"/>
            </div>
            <div style={{ display:'flex',gap:8,paddingTop:4 }}>
              <Btn variant="ghost" size="md" style={{ flex:1,justifyContent:'center' }} onClick={()=>setView('list')}>Cancelar</Btn>
              <Btn variant="primary" size="md" style={{ flex:1,justifyContent:'center' }}
                disabled={!form.name.trim()} onClick={handleCreate}>
                Criar Regra
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── SpecificRulesModal ─────────────────────────────────────────*/
function SpecificRulesModal({ rules, onAdd, onDelete, pausedIds, trafficData, initialAd, onClose }) {
  const [view, setView] = useState(initialAd ? 'add' : 'list');
  const [form, setForm] = useState(initialAd
    ? { scope: initialAd.scope || 'ad', targetId: initialAd.id, rule:'G1', paramVal:'', note:'' }
    : { scope:'ad', targetId:'', rule:'G1', paramVal:'', note:'' });
  const elems = getAllElements(trafficData);
  const targetOptions = { campaign: elems.campaigns, adset: elems.adsets, ad: elems.ads };

  const inputStyle = { width:'100%',padding:'8px 12px',borderRadius:8,
    background:'var(--app-surface-2)',border:'1px solid var(--app-border)',
    color:'var(--text-1)',fontFamily:'Roboto,sans-serif',fontSize:13,colorScheme:'dark' };
  const LBL = { fontSize:10,fontFamily:'Roboto,sans-serif',fontWeight:700,
    letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--text-3)',marginBottom:5,display:'block' };

  const handleAdd = () => {
    if (!form.targetId) return;
    const opt = (targetOptions[form.scope]||[]).find(x => x.id === form.targetId);
    onAdd({ ...form, id:Date.now(), targetName: opt?.label || form.targetId });
    setForm({ scope:'ad', targetId:'', rule:'G1', paramVal:'', note:'' });
    setView('list');
  };

  return (
    <div onClick={onClose}
      style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.68)',zIndex:500,
        display:'flex',alignItems:'center',justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:'var(--app-surface)',border:'1px solid var(--app-border-2)',
          borderRadius:16,width:520,maxHeight:'88vh',display:'flex',flexDirection:'column',
          boxShadow:'0 24px 64px rgba(0,0,0,.55)' }}>

        {/* Header */}
        <div style={{ padding:'16px 20px',borderBottom:'1px solid var(--app-border)',
          display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0 }}>
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            {view==='add' && (
              <button onClick={() => setView('list')}
                style={{ display:'flex',alignItems:'center',gap:4,color:'var(--text-3)',
                  fontFamily:'Roboto,sans-serif',fontSize:12,fontWeight:700,cursor:'pointer',
                  background:'none',border:'none',padding:0 }}>
                <LucideIcon icon="chevron-left" size={14}/>Voltar
              </button>
            )}
            <span style={{ fontSize:14,fontFamily:'Roboto,sans-serif',fontWeight:700,color:'var(--text-1)' }}>
              {view==='list' ? 'Regras Específicas' : 'Nova Regra Específica'}
            </span>
          </div>
          <div style={{ display:'flex',gap:8,alignItems:'center' }}>
            {view==='list' && (
              <Btn variant="secondary" size="sm" icon="plus" onClick={() => setView('add')}>Adicionar</Btn>
            )}
            <button onClick={onClose}
              style={{ width:28,height:28,borderRadius:'50%',background:'rgba(255,255,255,.07)',
                color:'var(--text-2)',cursor:'pointer',fontSize:18,
                display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>
          </div>
        </div>

        <div style={{ flex:1,overflowY:'auto',padding:'16px' }}>
          {view === 'list' ? (
            rules.length === 0 ? (
              <div style={{ padding:'40px 0',textAlign:'center',color:'var(--text-3)',
                fontFamily:'Roboto,sans-serif',fontSize:13 }}>
                Nenhuma regra específica cadastrada.
              </div>
            ) : (
              <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                {rules.map(re => {
                  const isTargetPaused = pausedIds.includes(re.targetId);
                  const sv = SV[RULE_SV[re.rule]] || SV.gold;
                  return (
                    <div key={re.id}
                      style={{ display:'flex',alignItems:'flex-start',gap:10,padding:'12px 14px',
                        borderRadius:10,background:isTargetPaused?'rgba(255,255,255,.02)':'var(--app-surface-2)',
                        border:`1px solid ${isTargetPaused?'var(--app-border)':'rgba(234,170,65,.2)'}`,
                        opacity:isTargetPaused?0.4:1,transition:'all 150ms' }}>
                      <span style={{ padding:'3px 7px',borderRadius:999,fontSize:10,
                        fontFamily:'Roboto,sans-serif',fontWeight:900,flexShrink:0,
                        background:sv.bg,color:sv.color,border:`1px solid ${sv.bd}` }}>
                        {ruleLabel(re.rule)}
                      </span>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ fontSize:12,fontFamily:'Roboto,sans-serif',fontWeight:700,
                          color:'var(--text-1)',marginBottom:1 }}>
                          {re.targetName}
                        </div>
                        <div style={{ display:'flex',gap:6,alignItems:'center',flexWrap:'wrap' }}>
                          <span style={{ fontSize:10.5,color:'var(--text-3)',fontFamily:'Roboto,sans-serif',
                            textTransform:'capitalize' }}>{re.scope}</span>
                          {re.paramVal && (
                            <span style={{ padding:'1px 6px',borderRadius:4,background:'rgba(234,170,65,.1)',
                              color:'var(--fmn-gold)',fontSize:10.5,fontFamily:'Roboto,sans-serif',fontWeight:700 }}>
                              ×{re.paramVal}
                            </span>
                          )}
                          {isTargetPaused && <span style={{ fontSize:10,color:'#f87171',fontFamily:'Roboto,sans-serif',fontWeight:700 }}>PAUSADO</span>}
                        </div>
                        {re.note && <div style={{ fontSize:11.5,color:'var(--text-3)',marginTop:2,lineHeight:1.4 }}>{re.note}</div>}
                      </div>
                      <button onClick={() => onDelete(re.id)}
                        style={{ width:24,height:24,borderRadius:6,background:'rgba(255,255,255,.05)',
                          border:'1px solid var(--app-border)',color:'var(--text-3)',cursor:'pointer',
                          display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}
                        onMouseEnter={e => { e.currentTarget.style.color='#f87171'; }}
                        onMouseLeave={e => { e.currentTarget.style.color='var(--text-3)'; }}>
                        <LucideIcon icon="trash-2" size={12}/>
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
              {/* Scope */}
              <div>
                <span style={LBL}>Escopo obrigatório</span>
                <div style={{ display:'flex',gap:6 }}>
                  {[['campaign','Campanha'],['adset','Conjunto'],['ad','Anúncio']].map(([id,l]) => (
                    <button key={id} onClick={() => setForm(p => ({ ...p, scope:id, targetId:'' }))}
                      style={{ flex:1,padding:'8px',borderRadius:8,cursor:'pointer',
                        fontFamily:'Roboto,sans-serif',fontWeight:700,fontSize:12.5,transition:'all 150ms',
                        background:form.scope===id?'rgba(234,170,65,.15)':'rgba(255,255,255,.05)',
                        border:`1px solid ${form.scope===id?'rgba(234,170,65,.35)':'var(--app-border)'}`,
                        color:form.scope===id?'var(--fmn-gold)':'var(--text-2)' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {/* Target */}
              <div>
                <span style={LBL}>{form.scope==='campaign'?'Campanha':form.scope==='adset'?'Conjunto':'Anúncio'}</span>
                <select value={form.targetId} onChange={e => setForm(p => ({ ...p, targetId:e.target.value }))}
                  style={{ ...inputStyle, appearance:'none', cursor:'pointer' }}>
                  <option value="">Selecionar...</option>
                  {(targetOptions[form.scope]||[]).map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>
              {/* Rule */}
              <div>
                <span style={LBL}>Regra</span>
                <select value={form.rule} onChange={e => setForm(p => ({ ...p, rule:e.target.value }))}
                  style={{ ...inputStyle, appearance:'none', cursor:'pointer' }}>
                  {INIT_GLOBAL_RULES.map(r => (
                    <option key={r.code} value={r.code}>{ruleLabel(r.code)} — {r.name}</option>
                  ))}
                </select>
              </div>
              {/* Param */}
              <div>
                <span style={LBL}>Parâmetro customizado (opcional)</span>
                <input value={form.paramVal} onChange={e => setForm(p => ({ ...p, paramVal:e.target.value }))}
                  placeholder="Ex: 1.2 ou 50" style={inputStyle}/>
              </div>
              {/* Note */}
              <div>
                <span style={LBL}>Observação</span>
                <input value={form.note} onChange={e => setForm(p => ({ ...p, note:e.target.value }))}
                  placeholder="Motivo desta exceção..." style={inputStyle}/>
              </div>
              <div style={{ display:'flex',gap:8 }}>
                <Btn variant="ghost" size="md" style={{ flex:1,justifyContent:'center' }} onClick={() => setView('list')}>Cancelar</Btn>
                <Btn variant="primary" size="md" style={{ flex:1,justifyContent:'center' }}
                  disabled={!form.targetId} onClick={handleAdd}>
                  Salvar Regra
                </Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Análise real: aplica as regras sobre os dados do Meta ──────*/
function analisarTrafego(trafficData) {
  const fmtR = window.fmtBRL;

  const ativos = [];
  for (const c of trafficData || [])
    for (const as of c.adsets || [])
      for (const ad of as.ads || [])
        if ((ad.d3 && ad.d3.gasto > 0) || (ad.d5 && ad.d5.gasto > 0)) ativos.push(ad);

  const problemas = [];
  let saudaveis = 0;

  for (const ad of ativos) {
    const hist  = ad.hist;
    const d3    = ad.d3;
    const d5    = ad.d5;
    const vHist = hist ? (hist.vendas || 0) : 0;
    const cHist = hist ? (hist.cpa    || null) : null;
    // S4: anúncio novo — sem dados de 5d (ignora regras de 5d)
    const isNovo = !d5 || (d5.gasto || 0) === 0;

    const push = (regra, msg, periodo) =>
      problemas.push({ numero: ad.numero, metaAdId: ad.metaAdId, campId: ad.campId, adsetId: ad.adsetId, adsetName: ad.adsetName, regra, mensagem: msg, periodo });

    let disparou = false;

    // ── TRAVA UNIVERSAL ──────────────────────────────────────────────────────
    if (vHist < 5) {
      if (d3 && d3.cpa != null && d3.cpa >= TICKET) {
        push('G1', `Trava: CPA 3d ${fmtR(d3.cpa)} atingiu o ticket (${vHist} venda${vHist !== 1 ? 's' : ''} no histórico).`, '3d');
        disparou = true;
      }
      if (!isNovo && d5 && d5.cpa != null && d5.cpa >= TICKET) {
        push('G1', `Trava: CPA 5d ${fmtR(d5.cpa)} atingiu o ticket (${vHist} venda${vHist !== 1 ? 's' : ''} no histórico).`, '5d');
        disparou = true;
      }
    } else {
      const trava3 = d3 && d3.cpa != null && d3.cpa >= TICKET;
      const trava5 = !isNovo && d5 && d5.cpa != null && d5.cpa >= TICKET;
      if (trava3 && trava5) {
        push('G1', `Trava: CPA 3d ${fmtR(d3.cpa)} e 5d ${fmtR(d5.cpa)} ambos ≥ ticket (${vHist} vendas no histórico, confirmação nos dois períodos).`, '3d+5d');
        disparou = true;
      }
    }

    // ── FAIXAS POR PERÍODO (3d e 5d) — avalia os dois independentemente ──────
    const periodos = [[d3, '3d'], ...(!isNovo ? [[d5, '5d']] : [])];
    for (const [d, per] of periodos) {
      if (!d || (d.gasto || 0) === 0) continue;
      const v = d.vendas || 0;
      const g = d.gasto  || 0;
      const c = d.cpa;

      if (v === 0 && g >= CPA_LIMITE) {
        push('G2', `Zero vendas em ${per}, gasto ${fmtR(g)} ≥ 70% do ticket.`, per);
        disparou = true;
      } else if (v === 1 && g >= TICKET) {
        push('G3', `1 venda em ${per} mas gasto ${fmtR(g)} ≥ ticket.`, per);
        disparou = true;
      } else if (v === 2 && c != null && c >= CPA_LIMITE) {
        push('G4', `2 vendas em ${per}, CPA ${fmtR(c)} ≥ 70% do ticket.`, per);
        disparou = true;
      } else if (v >= 3 && cHist != null && cHist >= CPA_LIMITE) {
        const outro = per === '3d' ? d5 : d3;
        const recuperando = outro && outro.cpa != null && outro.cpa < CPA_LIMITE && (outro.vendas || 0) >= 1;
        if (!recuperando && c != null && c >= CPA_LIMITE) {
          push('G5', `3+ vendas em ${per}: CPA histórico ${fmtR(cHist)} e CPA ${per} ${fmtR(c)}, ambos ≥ 70% do ticket.`, per);
          disparou = true;
        }
      }
    }

    // ── S1 ESFRIAMENTO ───────────────────────────────────────────────────────
    if (vHist >= 3 && (cHist == null || cHist < CPA_LIMITE)) {
      for (const [d, per] of periodos) {
        if (!d || (d.gasto || 0) === 0) continue;
        if ((d.vendas || 0) === 0 && (d.gasto || 0) >= CPA_LIMITE) {
          push('G6', `Esfriamento: ${vHist} vendas no histórico (CPA saudável), mas ${fmtR(d.gasto)} gastos em ${per} sem nenhuma venda.`, per);
          disparou = true;
        }
      }
    }

    if (!disparou) saudaveis++;
  }

  return { problemas, saudaveis, totalAtivos: ativos.length };
}

/* ── BellPopover ────────────────────────────────────────────────*/
function BellPopover({ problemas, testMode, onConfirmOne, onIgnore, onClose, posX, posY }) {
  const [saving, setSaving] = React.useState({});
  const [confirmed, setConfirmed] = React.useState({});
  const left = Math.max(8, Math.min(posX - 160, window.innerWidth - 360));
  // maxHeight precisa levar em conta o `top` de verdade, senão o popover
  // continua estourando pra baixo da tela quando abre numa linha mais baixa
  // (o cap antigo era um valor fixo, ignorava onde ele realmente abria).
  const MARGEM_INFERIOR = 20, ALTURA_MINIMA = 220;
  let top = posY + 14;
  if (window.innerHeight - top - MARGEM_INFERIOR < ALTURA_MINIMA) {
    top = Math.max(MARGEM_INFERIOR, window.innerHeight - ALTURA_MINIMA - MARGEM_INFERIOR);
  }
  const maxHeight = window.innerHeight - top - MARGEM_INFERIOR;
  const adsNum = problemas[0]?.numero;

  async function confirmOne(p, idx) {
    setSaving(s => ({ ...s, [idx]: true }));
    await onConfirmOne(p);
    setConfirmed(c => ({ ...c, [idx]: true }));
    setSaving(s => ({ ...s, [idx]: false }));
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:799 }}/>
      <div onClick={e => e.stopPropagation()}
        style={{ position:'fixed', left, top, zIndex:800, width:340,
          maxHeight, overflowY:'auto',
          background:'var(--app-surface)', border:'1px solid var(--app-border-2)',
          borderRadius:12, boxShadow:'0 16px 48px rgba(0,0,0,.65)', padding:16,
          display:'flex', flexDirection:'column', gap:12 }}>

        {/* Cabeçalho */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:12.5, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-1)' }}>
            ADS {String(adsNum).padStart(3,'0')} — {problemas.length} alerta{problemas.length > 1 ? 's' : ''}
          </span>
          <button onClick={onClose}
            style={{ background:'none', border:'none', cursor:'pointer',
              color:'var(--text-3)', padding:2, display:'flex', alignItems:'center' }}>
            <LucideIcon icon="x" size={14}/>
          </button>
        </div>

        {testMode && (
          <div style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', color:'#fbbf24',
            padding:'5px 8px', borderRadius:6,
            background:'rgba(251,191,36,.08)', border:'1px solid rgba(251,191,36,.2)',
            display:'flex', alignItems:'center', gap:6 }}>
            <LucideIcon icon="flask-conical" size={11} color="#fbbf24"/>
            Modo Teste — confirme para registrar o alerta.
          </div>
        )}

        {/* Lista de regras */}
        {problemas.map((p, idx) => {
          const sv = SV[RULE_SV[p.regra]] || SV.danger;
          const done = confirmed[idx];
          return (
            <div key={idx}
              style={{ padding:12, borderRadius:10, border:`1px solid ${done ? 'var(--app-border)' : sv.bd}`,
                background: done ? 'rgba(255,255,255,.02)' : sv.bg,
                opacity: done ? 0.5 : 1, transition:'all 200ms' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <span style={{ padding:'2px 8px', borderRadius:999, fontSize:10,
                  fontFamily:'Roboto,sans-serif', fontWeight:900,
                  background: done ? 'rgba(255,255,255,.08)' : sv.bg,
                  color: done ? 'var(--text-3)' : sv.color,
                  border:`1px solid ${done ? 'var(--app-border)' : sv.bd}` }}>
                  {p.regra}
                </span>
                {done && <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', color:'var(--clr-pos)' }}>✓ Confirmado</span>}
              </div>
              <p style={{ fontSize:11.5, fontFamily:'Roboto,sans-serif', color:'var(--text-2)',
                lineHeight:1.6, margin:'0 0 10px' }}>
                {p.mensagem}
              </p>
              {!done && (
                <button onClick={() => confirmOne(p, idx)}
                  disabled={saving[idx]}
                  style={{ width:'100%', padding:'7px', borderRadius:7, cursor: saving[idx] ? 'default' : 'pointer',
                    background:sv.bg, border:`1px solid ${sv.bd}`,
                    color:sv.color, fontFamily:'Roboto,sans-serif', fontSize:11.5, fontWeight:700,
                    opacity: saving[idx] ? 0.6 : 1 }}>
                  {saving[idx] ? 'Salvando...' : 'Confirmar — pausar no Meta'}
                </button>
              )}
            </div>
          );
        })}

        {/* Ignorar tudo */}
        <button onClick={onIgnore}
          style={{ padding:'8px', borderRadius:8, cursor:'pointer',
            background:'rgba(255,255,255,.05)', border:'1px solid var(--app-border)',
            color:'var(--text-3)', fontFamily:'Roboto,sans-serif', fontSize:12, fontWeight:700 }}
          onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.1)'}
          onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,.05)'}>
          Ignorar tudo
        </button>
      </div>
    </>
  );
}

/* ── SubstituirModal ────────────────────────────────────────────*/
function SubstituirModal({ adNum, defaultAdsetId, defaultAdsetName, defaultCampId, onClose }) {
  const SUPA_URL = window.db?.supabaseUrl || '';
  const SUPA_KEY = window.db?.supabaseKey  || '';
  const [step, setStep]               = useState('picker'); // picker | adset | confirm | success | error
  const [criativos, setCriativos]     = useState([]);
  const [loadingC, setLoadingC]       = useState(true);
  const [selected, setSelected]       = useState(null);
  const [campaigns, setCampaigns]     = useState([]);
  const [adsets, setAdsets]           = useState([]);
  const [campaignId, setCampaignId]   = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [adsetId, setAdsetId]         = useState(defaultAdsetId || '');
  const [adsetName, setAdsetName]     = useState(defaultAdsetName || '');
  const [loadingCamp, setLoadingCamp] = useState(false);
  const [loadingAdset, setLoadingAdset] = useState(false);
  const [newAdset, setNewAdset]       = useState(false);
  const [newAdsetName, setNewAdsetName] = useState('');
  const [newAdsetBudget, setNewAdsetBudget] = useState('');
  const [creatingAdset, setCreatingAdset]   = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [resultId, setResultId]       = useState('');
  const [errorMsg, setErrorMsg]       = useState('');

  const UTM_GLOBAL = window.UTM_GLOBAL; // fonte única em shared.jsx

  async function callFn(body) {
    const r = await fetch(`${SUPA_URL}/functions/v1/meta-criar-ad`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPA_KEY}` },
      body: JSON.stringify(body),
    });
    return r.json();
  }

  // Carregar criativos
  useEffect(() => {
    if (!window.db) return;
    (async () => {
      const { data } = await window.db.from('ads')
        .select('numero,titulo,status,meta_ad_id,media_drive_url,media_files,media_tipo')
        .eq('status', 'ativo')
        .order('numero', { ascending: false });
      setCriativos(data || []);
      setLoadingC(false);
    })();
  }, []);

  // Carregar campanhas ao entrar no step adset
  useEffect(() => {
    if (step !== 'adset') return;
    setLoadingCamp(true);
    callFn({ action: 'campaigns' }).then(d => {
      const camps = d.campaigns || [];
      setCampaigns(camps);
      setLoadingCamp(false);
      // Pre-selecionar campanha do ad pausado se soubermos
      if (defaultCampId) {
        const camp = camps.find(c => c.id === defaultCampId);
        if (camp) handleCampaignChange(camp.id, camp.name, true);
      }
    });
  }, [step]);

  async function handleCampaignChange(id, name, skipAdsets = false) {
    setCampaignId(id); setCampaignName(name);
    setAdsetId(''); setAdsetName(''); setAdsets([]);
    if (!id || skipAdsets) {
      // Se já temos o adsetId padrão, carregar os adsets da campanha
      if (skipAdsets && id) {
        setLoadingAdset(true);
        const d = await callFn({ action: 'adsets', campaign_id: id });
        const list = d.adsets || [];
        setAdsets(list);
        setLoadingAdset(false);
        const def = list.find(a => a.id === defaultAdsetId);
        if (def) { setAdsetId(def.id); setAdsetName(def.name); }
      }
      return;
    }
    setLoadingAdset(true);
    const d = await callFn({ action: 'adsets', campaign_id: id });
    setAdsets(d.adsets || []);
    setLoadingAdset(false);
  }

  async function handleCreateAdset() {
    if (!newAdsetName.trim() || !newAdsetBudget) return;
    setCreatingAdset(true);
    const d = await callFn({ action: 'create_adset', campaign_id: campaignId, name: newAdsetName.trim(), daily_budget: parseFloat(newAdsetBudget) });
    if (d.adset) {
      setAdsets(prev => [...prev, d.adset]);
      setAdsetId(d.adset.id); setAdsetName(d.adset.name);
      setNewAdset(false); setNewAdsetName(''); setNewAdsetBudget('');
    } else { setErrorMsg(d.error || 'Erro ao criar conjunto'); }
    setCreatingAdset(false);
  }

  async function handleUpload() {
    if (!selected || !adsetId) return;
    setUploading(true); setErrorMsg('');
    const files = (() => { try { return Array.isArray(selected.media_files) ? selected.media_files : JSON.parse(selected.media_files || '[]'); } catch { return []; } })();
    const firstFile = files[0] || null;
    const d = await callFn({
      action: 'create',
      adset_id: adsetId,
      card: {
        num: selected.numero,
        titulo: selected.titulo || '',
        hook: '',
        texto_principal: '',
        titulo_ad: selected.titulo || '',
        descricao_ad: '',
        media_tipo: selected.media_tipo || 'imagem',
        file_id: firstFile?.file_id || '',
      },
      utm: UTM_GLOBAL,
    });
    setUploading(false);
    if (d.error) { setErrorMsg(d.error); setStep('error'); }
    else { setResultId(d.ad_id || ''); setStep('success'); }
  }

  const overlay = { position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:1000,
    display:'flex', alignItems:'center', justifyContent:'center' };
  const box = { background:'var(--app-surface)', border:'1px solid var(--app-border-2)',
    borderRadius:16, width:480, maxHeight:'85vh', display:'flex', flexDirection:'column',
    boxShadow:'0 24px 64px rgba(0,0,0,.6)', overflow:'hidden' };
  const hdr = { padding:'14px 18px', borderBottom:'1px solid var(--app-border)',
    display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 };
  const S = {
    label: { fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700, letterSpacing:'0.08em',
      textTransform:'uppercase', color:'var(--text-3)', marginBottom:5, display:'block' },
    select: { width:'100%', padding:'9px 12px', borderRadius:8, background:'var(--app-surface-2)',
      border:'1px solid var(--app-border)', color:'var(--text-1)', fontFamily:'Roboto,sans-serif',
      fontSize:13, cursor:'pointer', colorScheme:'dark', appearance:'none', WebkitAppearance:'none' },
    input: { width:'100%', padding:'9px 12px', borderRadius:8, background:'var(--app-surface-2)',
      border:'1px solid var(--app-border)', color:'var(--text-1)', fontFamily:'Roboto,sans-serif',
      fontSize:13, outline:'none', boxSizing:'border-box' },
  };

  const headerTitle = step === 'picker' ? `ADS ${adNum} pausado — escolha o substituto`
    : step === 'adset' ? 'Onde subir o anúncio?'
    : step === 'confirm' ? 'Confirmar envio ao Meta'
    : step === 'success' ? 'Anúncio criado'
    : 'Erro no envio';

  return (
    <div style={overlay} onClick={onClose}>
      <div style={box} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={hdr}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {(step === 'adset' || step === 'confirm') && (
              <button onClick={() => setStep(step === 'confirm' ? 'adset' : 'picker')}
                style={{ width:26, height:26, borderRadius:7, background:'rgba(255,255,255,.07)',
                  border:'1px solid var(--app-border)', color:'var(--text-2)', cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center' }}>
                <LucideIcon icon="arrow-left" size={13}/>
              </button>
            )}
            <span style={{ fontSize:13.5, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-1)' }}>
              {headerTitle}
            </span>
          </div>
          <button onClick={onClose}
            style={{ width:28, height:28, borderRadius:'50%', background:'rgba(255,255,255,.07)',
              color:'var(--text-2)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
              border:'none', fontSize:18 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:16 }}>

          {/* STEP: picker */}
          {step === 'picker' && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <p style={{ fontSize:12, fontFamily:'Roboto,sans-serif', color:'var(--text-3)', margin:0 }}>
                Selecione o criativo que vai entrar no lugar do ADS {adNum}:
              </p>
              {loadingC
                ? <div style={{ textAlign:'center', padding:32, color:'var(--text-3)', fontSize:13, fontFamily:'Roboto,sans-serif' }}>Carregando criativos...</div>
                : (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                    {criativos.map(c => {
                      const files = (() => { try { return Array.isArray(c.media_files) ? c.media_files : JSON.parse(c.media_files||'[]'); } catch { return []; } })();
                      const thumb = bestThumb(files, c.media_drive_url);
                      const jaNoMeta = !!c.meta_ad_id;
                      const isSel = selected?.numero === c.numero;
                      return (
                        <div key={c.numero} onClick={() => setSelected(c)}
                          style={{ borderRadius:10, overflow:'hidden', cursor:'pointer', position:'relative',
                            border: isSel ? '2px solid var(--fmn-gold)' : '2px solid var(--app-border)',
                            background:'var(--app-surface-2)', transition:'border-color 120ms' }}>
                          <div style={{ width:'100%', aspectRatio:'1', background:'rgba(255,255,255,.04)',
                            display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                            {thumb
                              ? <img src={thumb} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}
                                  onError={e => e.currentTarget.style.display='none'}/>
                              : <LucideIcon icon="image" size={22} style={{ color:'rgba(255,255,255,.2)' }}/>
                            }
                          </div>
                          <div style={{ padding:'6px 8px' }}>
                            <div style={{ fontSize:9.5, fontFamily:'Roboto,sans-serif', fontWeight:900,
                              color:'var(--clr-teal)', letterSpacing:'0.06em' }}>ADS {String(c.numero).padStart(3,'0')}</div>
                            <div style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', color:'var(--text-2)',
                              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', lineHeight:1.3 }}>
                              {c.titulo || '—'}
                            </div>
                          </div>
                          {jaNoMeta && (
                            <div style={{ position:'absolute', top:5, right:5, padding:'2px 6px', borderRadius:999,
                              background:'rgba(96,165,250,.2)', border:'1px solid rgba(96,165,250,.4)',
                              fontSize:8.5, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'#60a5fa' }}>
                              no Meta
                            </div>
                          )}
                          {isSel && (
                            <div style={{ position:'absolute', top:5, left:5, width:18, height:18, borderRadius:'50%',
                              background:'var(--fmn-gold)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                              <LucideIcon icon="check" size={11} style={{ color:'#000' }}/>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              }
              <button onClick={() => selected && setStep('adset')}
                disabled={!selected}
                style={{ width:'100%', padding:'10px', borderRadius:9, cursor: selected ? 'pointer' : 'default',
                  background: selected ? 'var(--fmn-gold)' : 'rgba(255,255,255,.06)',
                  border:'none', color: selected ? 'var(--fmn-black)' : 'var(--text-3)',
                  fontFamily:'Roboto,sans-serif', fontWeight:900, fontSize:13,
                  transition:'all 150ms', marginTop:4 }}>
                {selected ? `Continuar com ADS ${String(selected.numero).padStart(3,'0')}` : 'Selecione um criativo'}
              </button>
            </div>
          )}

          {/* STEP: adset */}
          {step === 'adset' && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <label style={S.label}>Campanha</label>
              {loadingCamp
                ? <div style={{ fontSize:12, color:'var(--text-3)', fontFamily:'Roboto,sans-serif' }}>Carregando campanhas...</div>
                : (
                  <select value={campaignId} onChange={e => {
                    const c = campaigns.find(x => x.id === e.target.value);
                    if (c) handleCampaignChange(c.id, c.name);
                  }} style={S.select}>
                    <option value="">Selecionar campanha...</option>
                    {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )
              }

              {campaignId && (
                <>
                  <label style={S.label}>Conjunto de anúncios</label>
                  {loadingAdset
                    ? <div style={{ fontSize:12, color:'var(--text-3)', fontFamily:'Roboto,sans-serif' }}>Carregando conjuntos...</div>
                    : !newAdset ? (
                      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                        <select value={adsetId} onChange={e => {
                          const a = adsets.find(x => x.id === e.target.value);
                          if (a) { setAdsetId(a.id); setAdsetName(a.name); }
                        }} style={S.select}>
                          <option value="">Selecionar conjunto...</option>
                          {adsets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                        <button onClick={() => setNewAdset(true)}
                          style={{ background:'none', border:'none', color:'var(--fmn-gold)', fontSize:11,
                            fontFamily:'Roboto,sans-serif', cursor:'pointer', textAlign:'left', padding:'2px 0' }}>
                          + Criar novo conjunto
                        </button>
                      </div>
                    ) : (
                      <div style={{ display:'flex', flexDirection:'column', gap:8, padding:12, borderRadius:10,
                        background:'rgba(234,170,65,.06)', border:'1px solid rgba(234,170,65,.2)' }}>
                        <input placeholder="Nome do conjunto" value={newAdsetName}
                          onChange={e => setNewAdsetName(e.target.value)} style={S.input}/>
                        <input placeholder="Orçamento diário (R$)" value={newAdsetBudget} type="number"
                          onChange={e => setNewAdsetBudget(e.target.value)} style={S.input}/>
                        <div style={{ display:'flex', gap:8 }}>
                          <button onClick={handleCreateAdset} disabled={creatingAdset}
                            style={{ flex:1, padding:'8px', borderRadius:8, cursor:'pointer',
                              background:'var(--fmn-gold)', border:'none',
                              color:'var(--fmn-black)', fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:12 }}>
                            {creatingAdset ? 'Criando...' : 'Criar'}
                          </button>
                          <button onClick={() => setNewAdset(false)}
                            style={{ padding:'8px 14px', borderRadius:8, cursor:'pointer',
                              background:'rgba(255,255,255,.06)', border:'1px solid var(--app-border)',
                              color:'var(--text-3)', fontFamily:'Roboto,sans-serif', fontSize:12 }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )
                  }
                </>
              )}

              <button onClick={() => campaignId && adsetId && setStep('confirm')}
                disabled={!campaignId || !adsetId}
                style={{ width:'100%', padding:'10px', borderRadius:9,
                  cursor: campaignId && adsetId ? 'pointer' : 'default',
                  background: campaignId && adsetId ? 'var(--fmn-gold)' : 'rgba(255,255,255,.06)',
                  border:'none', color: campaignId && adsetId ? 'var(--fmn-black)' : 'var(--text-3)',
                  fontFamily:'Roboto,sans-serif', fontWeight:900, fontSize:13, transition:'all 150ms' }}>
                Revisar antes de enviar
              </button>
            </div>
          )}

          {/* STEP: confirm (gate) */}
          {step === 'confirm' && selected && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ padding:14, borderRadius:10, background:'rgba(234,170,65,.06)',
                border:'1px solid rgba(234,170,65,.2)', display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
                  letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--fmn-gold)' }}>
                  Resumo do que vai ser criado
                </div>
                {[
                  ['Criativo', `ADS ${String(selected.numero).padStart(3,'0')} — ${selected.titulo || '—'}`],
                  ['Conjunto', adsetName],
                  ['Status inicial', 'PAUSED (você ativa quando quiser)'],
                  ['UTM', UTM_GLOBAL],
                ].map(([k, v]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
                    <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'var(--text-3)' }}>{k}</span>
                    <span style={{ fontSize:11.5, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-1)', textAlign:'right' }}>{v}</span>
                  </div>
                ))}
              </div>
              {errorMsg && (
                <div style={{ fontSize:12, fontFamily:'Roboto,sans-serif', color:'#f87171',
                  padding:'8px 12px', borderRadius:8, background:'rgba(248,113,113,.08)',
                  border:'1px solid rgba(248,113,113,.25)' }}>{errorMsg}</div>
              )}
              <button onClick={handleUpload} disabled={uploading}
                style={{ width:'100%', padding:'11px', borderRadius:9, cursor: uploading ? 'default' : 'pointer',
                  background:'var(--fmn-gold)', border:'none', color:'var(--fmn-black)',
                  fontFamily:'Roboto,sans-serif', fontWeight:900, fontSize:13, opacity: uploading ? 0.7 : 1 }}>
                {uploading ? 'Enviando ao Meta...' : 'Confirmar — subir no Meta'}
              </button>
            </div>
          )}

          {/* STEP: success */}
          {step === 'success' && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, padding:'24px 0' }}>
              <div style={{ width:52, height:52, borderRadius:'50%', background:'rgba(74,222,128,.15)',
                border:'1px solid rgba(74,222,128,.35)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <LucideIcon icon="check" size={26} style={{ color:'#4ade80' }}/>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:15, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-1)', marginBottom:6 }}>
                  Anúncio criado com sucesso
                </div>
                <div style={{ fontSize:12, fontFamily:'Roboto,sans-serif', color:'var(--text-3)' }}>
                  Ele está PAUSED no Meta. Ative quando quiser.
                </div>
                {resultId && (
                  <a href={`https://adsmanager.facebook.com/adsmanager/manage/ads?selected_ad_ids=${resultId}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display:'inline-flex', alignItems:'center', gap:6, marginTop:12, fontSize:12,
                      fontFamily:'Roboto,sans-serif', color:'var(--fmn-gold)', textDecoration:'none' }}>
                    <LucideIcon icon="external-link" size={12}/>
                    Ver no Gerenciador
                  </a>
                )}
              </div>
              <button onClick={onClose}
                style={{ padding:'9px 28px', borderRadius:9, cursor:'pointer', background:'var(--fmn-gold)',
                  border:'none', color:'var(--fmn-black)', fontFamily:'Roboto,sans-serif', fontWeight:900, fontSize:13 }}>
                Fechar
              </button>
            </div>
          )}

          {/* STEP: error */}
          {step === 'error' && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, padding:'24px 0' }}>
              <div style={{ width:52, height:52, borderRadius:'50%', background:'rgba(248,113,113,.12)',
                border:'1px solid rgba(248,113,113,.3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <LucideIcon icon="x" size={26} style={{ color:'#f87171' }}/>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:14, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-1)', marginBottom:6 }}>
                  Erro ao subir no Meta
                </div>
                <div style={{ fontSize:12, fontFamily:'Roboto,sans-serif', color:'#f87171', wordBreak:'break-word' }}>
                  {errorMsg}
                </div>
              </div>
              <button onClick={() => setStep('confirm')}
                style={{ padding:'9px 28px', borderRadius:9, cursor:'pointer',
                  background:'rgba(255,255,255,.08)', border:'1px solid var(--app-border)',
                  color:'var(--text-2)', fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:13 }}>
                Tentar novamente
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

/* ── TrafficScreen ──────────────────────────────────────────────*/
function TrafficScreen() {
  const { trafficData, loading, reload }   = useTrafficData();
  const { alerts, setAlerts, reloadAlerts } = useAlertas();
  const [alertActions, setAlertActions]    = useState({});
  const [globalRules, setGlobalRules]      = useState(() => {
    try { const s = localStorage.getItem('fmn_global_rules'); return s ? JSON.parse(s) : INIT_GLOBAL_RULES; } catch { return INIT_GLOBAL_RULES; }
  });
  const [specificRules, setSpecificRules]  = useState(() => {
    try { const s = localStorage.getItem('fmn_specific_rules'); return s ? JSON.parse(s) : INIT_SPECIFIC_RULES; } catch { return INIT_SPECIFIC_RULES; }
  });
  const [pausedIds, setPausedIds]          = useState([]);
  const [pausingIds, setPausingIds]        = useState(new Set()); // adIds com pausa em andamento
  const [focusIds, setFocusIds]            = useState(new Set());
  const [modal, setModal]                  = useState(null);
  const [thumbModal, setThumbModal]        = useState(null);
  const [addRuleForAd, setAddRuleForAd]    = useState(null);
  const [syncing, setSyncing]              = useState(false);
  const [autoAnalyze, setAutoAnalyze]      = useState(false);
  const [adAlerts, setAdAlerts]            = useState(() => {
    try { const s = localStorage.getItem('fmn_ad_alerts'); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  const [ignoredAlerts, setIgnoredAlerts]  = useState(() => {
    try { const s = localStorage.getItem('fmn_ignored_alerts'); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  const [selectedPeriod, setSelectedPeriod] = useState('3d');
  const [viewMode, setViewMode]            = useState('periodo'); // 'periodo' | 'metrica'
  const [selectedMetric, setSelectedMetric] = useState('cpa');
  const [hoverCell, setHoverCell]          = useState(null); // { row, col, rect }
  const metricCol = COLS.find(c => c.k === selectedMetric) || COLS[2];
  const [openBell, setOpenBell]            = useState(null); // { adId, problema, posX, posY }
  const [substituirPrompt, setSubstituirPrompt] = useState(null); // { adNum, adsetId, adsetName, campId }
  const [lastSyncTs, setLastSyncTs]        = useState(() => {
    const s = localStorage.getItem('fmn_last_sync_ts');
    return s ? parseInt(s) : null;
  });
  const [countdown, setCountdown]          = useState(null);

  // Modo Teste: 15 dias a partir da primeira abertura
  const testMode = (() => {
    try {
      const key = 'fmn_test_mode_start';
      let start = localStorage.getItem(key);
      if (!start) { start = new Date().toISOString(); localStorage.setItem(key, start); }
      const dias = Math.floor((Date.now() - new Date(start).getTime()) / 86400000);
      return dias < 15 ? { ativo: true, diasRestantes: 15 - dias } : { ativo: false, diasRestantes: 0 };
    } catch { return { ativo: false, diasRestantes: 0 }; }
  })();

  // Persistir regras no localStorage
  useEffect(() => {
    try { localStorage.setItem('fmn_global_rules', JSON.stringify(globalRules)); } catch {}
  }, [globalRules]);
  useEffect(() => {
    try { localStorage.setItem('fmn_specific_rules', JSON.stringify(specificRules)); } catch {}
  }, [specificRules]);
  useEffect(() => {
    try { localStorage.setItem('fmn_ad_alerts', JSON.stringify(adAlerts)); } catch {}
  }, [adAlerts]);
  useEffect(() => {
    try { localStorage.setItem('fmn_ignored_alerts', JSON.stringify(ignoredAlerts)); } catch {}
  }, [ignoredAlerts]);

  // Após sync, roda análise e guarda alertas localmente por adId (sino na linha)
  useEffect(() => {
    if (!autoAnalyze || loading || !window.db) return;
    setAutoAnalyze(false);
    const { problemas } = analisarTrafego(trafficData);
    const alertMap = {};
    for (const p of problemas) {
      const adId = `ads-${p.numero}`;
      const key = `${p.regra}_${p.periodo||''}`;
      const adIgnored = ignoredAlerts[adId] || [];
      if (adIgnored.includes(key)) continue;
      if (!alertMap[adId]) alertMap[adId] = [];
      alertMap[adId].push(p);
    }
    setAdAlerts(alertMap);
    // Grava timestamp do sync para o contador
    const now = Date.now();
    setLastSyncTs(now);
    try { localStorage.setItem('fmn_last_sync_ts', String(now)); } catch {}
    setSyncing(false);
  }, [autoAnalyze, loading]);

  // Contador regressivo: 300s a partir do último sync
  useEffect(() => {
    const SYNC_INTERVAL = 300;
    const tick = () => {
      if (!lastSyncTs) { setCountdown(null); return; }
      const elapsed = Math.floor((Date.now() - lastSyncTs) / 1000);
      const rem = SYNC_INTERVAL - elapsed;
      setCountdown(rem > 0 ? rem : 0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastSyncTs]);

  const handleAtualizar = () => {
    if (syncing) return;
    setSyncing(true);
    setAutoAnalyze(true);
    reload();
  };

  const handleBellClick = (adId, problemas, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setOpenBell({ adId, problemas, posX: rect.left + rect.width / 2, posY: rect.bottom });
  };

  const handleBellConfirmOne = async (p) => {
    if (!openBell || !window.db) return;
    if (p.numero == null) { console.warn('[BellConfirm] numero null, abortando. p=', p); return; }
    if (!p.metaAdId) { alert('Sem meta_ad_id vinculado, não dá pra pausar no Meta.'); return; }

    // Sino fica amarelo enquanto pausa
    const adId = openBell.adId;
    setPausingIds(prev => new Set([...prev, adId]));

    // 1. Pausar de fato no Meta (Graph API via Edge Function)
    let pauseRes;
    try {
      const r = await fetch(`${window.db.supabaseUrl}/functions/v1/meta-criar-ad`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.db.supabaseKey}` },
        body: JSON.stringify({ action: 'pause_ad', ad_id: p.metaAdId }),
      });
      pauseRes = await r.json();
    } catch (e) {
      console.error('[BellConfirm] erro de rede:', e);
      setPausingIds(prev => { const n = new Set(prev); n.delete(adId); return n; });
      alert('Erro ao pausar no Meta: ' + (e?.message || e));
      return;
    }
    if (pauseRes?.error || pauseRes?.ok === false || pauseRes?.success === false) {
      console.error('[BellConfirm] Meta recusou:', pauseRes);
      setPausingIds(prev => { const n = new Set(prev); n.delete(adId); return n; });
      alert('Meta não pausou o anúncio: ' + (pauseRes?.error || 'resposta inesperada'));
      return;
    }

    // 2. Registrar no histórico já como resolvido (worker não reprocessa)
    const ins = await window.db.from('alertas').insert([{
      ads_numero: p.numero, meta_ad_id: p.metaAdId, meta_campaign_id: p.campId,
      regra_codigo: p.regra, mensagem: p.mensagem,
      acao_pendente: 'pausar', acao_tomada: 'pausado', resolvido: true,
    }]).select();
    if (ins.error) console.error('[BellConfirm] log error (pausa já feita no Meta):', ins.error);

    // 3. Atualizar UI: sino some, anúncio fica como pausado
    setPausingIds(prev => { const n = new Set(prev); n.delete(adId); return n; });
    setAdAlerts(prev => { const n = { ...prev }; delete n[adId]; return n; });
    setPausedIds(prev => [...new Set([...prev, adId])]);
    setOpenBell(null);
    reloadAlerts();

    // 4. Perguntar se quer subir substituto
    setSubstituirPrompt({
      adNum: String(p.numero).padStart(3, '0'),
      adsetId: p.adsetId || null,
      adsetName: p.adsetName || null,
      campId: p.campId || null,
    });
  };

  const handleBellClose = () => setOpenBell(null);

  const handlePauseDirect = async (row, depth) => {
    const scopeLabel = depth === 0 ? 'campanha' : depth === 1 ? 'conjunto' : 'anúncio';
    const metaId = depth === 2 ? row.metaAdId : row.id;
    if (!metaId) { alert(`Sem ID Meta vinculado para pausar este ${scopeLabel}.`); return; }
    const nome = depth === 2 ? `ADS ${row.num} — ${row.name}` : row.name;
    if (!window.confirm(`Pausar ${scopeLabel} no Meta?\n\n${nome}\n\nEsta ação é imediata.`)) return;

    setPausingIds(prev => new Set([...prev, row.id]));
    try {
      const r = await fetch(`${window.db.supabaseUrl}/functions/v1/meta-criar-ad`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.db.supabaseKey}` },
        body: JSON.stringify({ action: 'pause_ad', ad_id: metaId }),
      });
      const res = await r.json();
      if (res?.error || res?.ok === false || res?.success === false) {
        alert(`Meta não pausou: ${res?.error || 'resposta inesperada'}`);
        setPausingIds(prev => { const n = new Set(prev); n.delete(row.id); return n; });
        return;
      }
    } catch (e) {
      alert(`Erro de rede: ${e?.message || e}`);
      setPausingIds(prev => { const n = new Set(prev); n.delete(row.id); return n; });
      return;
    }
    setPausingIds(prev => { const n = new Set(prev); n.delete(row.id); return n; });
    setPausedIds(prev => [...new Set([...prev, row.id])]);
  };

  const handleBellIgnore = () => {
    if (!openBell) return;
    const adId = openBell.adId;
    const toIgnore = (openBell.problemas || []).map(p => `${p.regra}_${p.periodo||''}`);
    setIgnoredAlerts(prev => ({
      ...prev,
      [adId]: [...new Set([...(prev[adId] || []), ...toIgnore])],
    }));
    setAdAlerts(prev => { const n = {...prev}; delete n[adId]; return n; });
    setOpenBell(null);
  };

  const pauseIds = (ids) => {
    const toAdd = ids.filter(Boolean);
    setPausedIds(prev => [...new Set([...prev, ...toAdd])]);
    // Remove regras específicas vinculadas a esses ads (tornam-se ineficazes)
    setSpecificRules(prev => prev.filter(re => !toAdd.includes(re.targetId)));
  };

  const handleAlertAction = (alertId, actionId, adsId, campaignId) => {
    setAlertActions(prev => ({ ...prev, [alertId]: actionId }));
    if (actionId === 'pause') pauseIds([adsId, campaignId]);
  };

  const handleExecuteSuggested = () => {
    const newActions = {};
    alerts.forEach(a => {
      if (a.suggestedAction) {
        newActions[a.id] = a.suggestedAction;
        if (a.suggestedAction === 'pause') pauseIds([a.adsId, a.campaignId]);
      }
    });
    setAlertActions(prev => ({ ...prev, ...newActions }));
  };

  const handleCreateRule = (rule) => {
    const nextN = globalRules.length + 1;
    setGlobalRules(prev => [...prev, { ...rule, code:`G${nextN}` }]);
  };

  const activeREs = specificRules.filter(re => !pausedIds.includes(re.targetId));

  const PERIOD_TABS = [
    { id:'hoje',    label:'Hoje'   },
    { id:'3d',      label:'3D'     },
    { id:'5d',      label:'5D'     },
    { id:'7d',      label:'7D'     },
    { id:'maximum', label:'Máximo' },
  ];

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' }}>
      {thumbModal && <MediaModal ad={thumbModal} onClose={() => setThumbModal(null)}/>}
      {testMode.ativo && (
        <div style={{ background:'rgba(251,191,36,.08)', borderBottom:'1px solid rgba(251,191,36,.2)',
          padding:'7px 24px', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <LucideIcon icon="flask-conical" size={14} color="#fbbf24"/>
          <span style={{ fontSize:12, fontFamily:'Roboto,sans-serif', color:'#fbbf24', fontWeight:600 }}>
            Modo Teste ativo — {testMode.diasRestantes} dia{testMode.diasRestantes !== 1 ? 's' : ''} restante{testMode.diasRestantes !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'rgba(251,191,36,.6)' }}>
            Confirme cada alerta individualmente antes de aplicar. Após o período, você decide se as regras rodam de forma automática.
          </span>
        </div>
      )}
      <TopBar title="Tráfego"
        actions={
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            <Btn variant="ghost" size="sm" icon="sliders" onClick={() => setModal('global')}>Regras Gerais</Btn>
            <Btn variant="ghost" size="sm" icon="target" onClick={() => setModal('specific')}>
              Regras Específicas
              {specificRules.length > 0 && (
                <span style={{ marginLeft:4,padding:'1px 6px',borderRadius:999,background:'rgba(234,170,65,.2)',
                  color:'var(--fmn-gold)',fontSize:10,fontWeight:900 }}>{specificRules.length}</span>
              )}
            </Btn>
            {countdown !== null && !syncing && (
              <div style={{ display:'flex', alignItems:'center', gap:5,
                padding:'4px 10px', borderRadius:7,
                background: countdown === 0 ? 'rgba(74,222,128,.1)' : 'rgba(255,255,255,.04)',
                border: `1px solid ${countdown === 0 ? 'rgba(74,222,128,.3)' : 'rgba(255,255,255,.1)'}` }}>
                <LucideIcon icon={countdown === 0 ? 'check-circle' : 'timer'} size={12}
                  color={countdown === 0 ? '#4ade80' : 'var(--text-3)'}/>
                <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', fontWeight:700,
                  color: countdown === 0 ? '#4ade80' : 'var(--text-3)', fontVariantNumeric:'tabular-nums' }}>
                  {countdown === 0
                    ? 'Sync disponível'
                    : `${String(Math.floor(countdown/60)).padStart(2,'0')}:${String(countdown%60).padStart(2,'0')}`}
                </span>
              </div>
            )}
            <Btn variant="primary" size="sm" icon={syncing ? 'loader' : 'refresh-cw'} onClick={handleAtualizar} disabled={syncing}>
              {syncing ? 'Atualizando...' : 'Atualizar'}
            </Btn>
          </div>
        }/>

      <div style={{ flex:1,overflow:'auto',padding:'20px 24px',display:'flex',flexDirection:'column',gap:16 }}>

        {/* ── Modo de visualização + seletor ── */}
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>

          {/* Toggle de modo */}
          <div style={{ display:'inline-flex', padding:3, borderRadius:9,
            background:'rgba(255,255,255,.04)', border:'1px solid var(--app-border)' }}>
            {[['periodo','Por período'],['metrica','Por métrica']].map(([id,l]) => {
              const on = viewMode === id;
              return (
                <button key={id} onClick={() => setViewMode(id)}
                  style={{ padding:'5px 13px', borderRadius:6, cursor:'pointer', fontSize:12,
                    fontFamily:'Roboto,sans-serif', fontWeight:700, transition:'all 150ms', border:'none',
                    background: on ? 'rgba(234,170,65,.15)' : 'transparent',
                    color: on ? 'var(--fmn-gold)' : 'var(--text-3)' }}>
                  {l}
                </button>
              );
            })}
          </div>

          <div style={{ width:1, height:20, background:'var(--app-border)' }}/>

          {/* Modo período: abas de período */}
          {viewMode === 'periodo' && (
            <div style={{ display:'flex', gap:6 }}>
              {PERIOD_TABS.map(tab => {
                const active = selectedPeriod === tab.id;
                return (
                  <button key={tab.id} onClick={() => setSelectedPeriod(tab.id)}
                    style={{ padding:'6px 18px', borderRadius:8, cursor:'pointer', fontSize:12.5,
                      fontFamily:'Roboto,sans-serif', fontWeight:700, letterSpacing:'0.04em',
                      border: active ? '1px solid rgba(234,170,65,.5)' : '1px solid var(--app-border)',
                      background: active ? 'rgba(234,170,65,.12)' : 'rgba(255,255,255,.04)',
                      color: active ? 'var(--fmn-gold)' : 'var(--text-2)',
                      transition:'all 150ms' }}>
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Modo métrica: chips de métrica */}
          {viewMode === 'metrica' && (
            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
              {COLS.map(col => {
                const active = selectedMetric === col.k;
                return (
                  <button key={col.k} onClick={() => setSelectedMetric(col.k)}
                    style={{ padding:'5px 12px', borderRadius:999, cursor:'pointer', fontSize:12,
                      fontFamily:'Roboto,sans-serif', fontWeight:700, transition:'all 150ms',
                      border: active ? '1px solid rgba(234,170,65,.5)' : '1px solid var(--app-border)',
                      background: active ? 'rgba(234,170,65,.12)' : 'rgba(255,255,255,.04)',
                      color: active ? 'var(--fmn-gold)' : 'var(--text-2)' }}>
                    {col.head}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Tabela ── */}
        <div style={{ background:'var(--app-surface)',border:'1px solid var(--app-border)',borderRadius:14 }}>
          <table style={{ width:'100%',borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--app-border)' }}>
                <th style={{ padding:'8px 14px', textAlign:'left', fontSize:10, fontFamily:'Roboto,sans-serif',
                  fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)' }}>
                  Campanha / Conjunto / Anúncio
                  {viewMode === 'metrica' && (
                    <span style={{ marginLeft:8, color:'var(--fmn-gold)', letterSpacing:'0.08em' }}>· {metricCol.head}</span>
                  )}
                </th>
                {(viewMode === 'metrica' ? PERIOD_COLS : COLS).map(col => (
                  <th key={col.pk || col.k} style={{ width: viewMode==='metrica' ? 84 : col.w,
                    padding:'8px 10px', textAlign:'right', fontSize:9.5,
                    fontFamily:'Roboto,sans-serif', fontWeight:700, letterSpacing:'0.08em',
                    textTransform:'uppercase', color:'var(--text-3)', whiteSpace:'nowrap' }}>
                    {col.head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ padding:'32px', textAlign:'center',
                  color:'var(--text-3)', fontFamily:'Roboto,sans-serif', fontSize:13 }}>
                  Carregando dados do Meta Ads...
                </td></tr>
              ) : trafficData.length === 0 ? (
                <tr><td colSpan={10} style={{ padding:'32px', textAlign:'center',
                  color:'var(--text-3)', fontFamily:'Roboto,sans-serif', fontSize:13 }}>
                  Nenhum dado encontrado. Aguarde o próximo sync ou vincule meta_ad_id nos ADS.
                </td></tr>
              ) : trafficData.map(c => (
                <TrafficRow key={c.id} row={c} depth={0} period={selectedPeriod}
                  viewMode={viewMode} metricCol={metricCol}
                  onCellHover={viewMode === 'periodo' ? setHoverCell : undefined}
                  specificRules={specificRules} pausedIds={pausedIds} pausingIds={pausingIds}
                  focusIds={focusIds} setFocusIds={setFocusIds}
                  onThumbClick={setThumbModal}
                  onAddRule={setAddRuleForAd}
                  adAlerts={adAlerts}
                  onBellClick={handleBellClick}
                  onPauseDirect={handlePauseDirect}/>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legenda */}
        <div style={{ display:'flex',gap:14,padding:'8px 14px',background:'rgba(255,255,255,.02)',
          borderRadius:8,border:'1px solid var(--app-border)',flexWrap:'wrap' }}>
          <span style={{ fontSize:11,fontFamily:'Roboto,sans-serif',color:'var(--text-3)' }}>CPA:</span>
          {[['#4ade80','< 70% do ticket'],['#fbbf24','70–100%'],['#f87171','> ticket']].map(([c,l])=>(
            <span key={l} style={{ display:'flex',alignItems:'center',gap:5,fontSize:11,
              fontFamily:'Roboto,sans-serif',color:'var(--text-3)' }}>
              <span style={{ width:8,height:8,borderRadius:2,background:c }}/>
              {l}
            </span>
          ))}
          <span style={{ marginLeft:'auto',fontSize:11,color:'var(--text-3)',fontFamily:'Roboto,sans-serif' }}>
            Ticket ref. {window.fmtBRL(TICKET)} · limite CPA {window.fmtBRL(CPA_LIMITE)}
          </span>
        </div>

        <div style={{ height:16 }}/>
      </div>

      {/* Modais */}
      {modal === 'global' && (
        <GlobalRulesModal rules={globalRules}
          onChange={(code, val) => setGlobalRules(prev => prev.map(r => r.code === code ? { ...r, active: val } : r))}
          onCreate={handleCreateRule}
          onClose={() => setModal(null)}/>
      )}
      {(modal === 'specific' || addRuleForAd) && (
        <SpecificRulesModal
          rules={specificRules}
          pausedIds={pausedIds}
          trafficData={trafficData}
          initialAd={addRuleForAd}
          onAdd={re => setSpecificRules(prev => [...prev, re])}
          onDelete={id => setSpecificRules(prev => prev.filter(r => r.id !== id))}
          onClose={() => { setModal(null); setAddRuleForAd(null); }}/>
      )}
      {openBell && (
        <BellPopover
          problemas={openBell.problemas}
          testMode={testMode.ativo}
          posX={openBell.posX}
          posY={openBell.posY}
          onConfirmOne={handleBellConfirmOne}
          onClose={handleBellClose}
          onIgnore={handleBellIgnore}/>
      )}
      {substituirPrompt && (
        <SubstituirModal
          adNum={substituirPrompt.adNum}
          defaultAdsetId={substituirPrompt.adsetId}
          defaultAdsetName={substituirPrompt.adsetName}
          defaultCampId={substituirPrompt.campId}
          onClose={() => setSubstituirPrompt(null)}/>
      )}
      <MetricHoverPopover hover={hoverCell}/>
    </div>
  );
}

window.TrafficScreen = TrafficScreen;
