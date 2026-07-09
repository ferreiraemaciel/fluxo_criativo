/* ================================================================
   Tracker FMN — Dashboard Screen v3 (dados reais Supabase)
   ================================================================ */
const { useState, useRef, useEffect } = React;
const { CardKPI, SectionCard, TopBar, LucideIcon, Badge } = window;
// FotoMap captured at render time to avoid race with map.jsx loading

/* ── Helpers ─────────────────────────────────────────────────────*/
// Normaliza utm_source (que às vezes vem com a string UTM inteira concatenada)
// para um rótulo legível.
function normalizeSource(raw) {
  if (!raw || !String(raw).trim()) return 'Orgânico';
  const s = String(raw).toLowerCase();
  if (s.includes('fb') || s.includes('facebook') || s.includes('meta')) return 'Facebook Ads';
  if (s.includes('ig') || s.includes('instagram'))                       return 'Instagram';
  if (s.includes('google') || s.includes('gads') || s.includes('adwords')) return 'Google Ads';
  if (s.includes('youtube') || s.includes('yt'))                          return 'YouTube';
  if (s.includes('tiktok') || s.includes('tt'))                           return 'TikTok';
  if (s.includes('whatsapp') || s.includes('wpp') || s.includes('zap'))   return 'WhatsApp';
  if (s.includes('email') || s.includes('mail'))                          return 'E-mail';
  if (s.includes('organic') || s.includes('orgânico'))                    return 'Orgânico';
  // valor curto e limpo: usa como veio (capitalizado); senão, marca como Outros
  const clean = String(raw).trim();
  if (clean.length <= 20 && /^[\w\s\-.]+$/.test(clean)) {
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }
  return 'Outros';
}

const fmtCur = window.fmtBRL;
const fmt = n => window.fmtBRL(n);

function periodToDates(period, dateRange) {
  const today = new Date();
  const pad = d => String(d).padStart(2,'0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  if (period === 'Custom') return { from: dateRange.from, to: dateRange.to };
  if (period === 'Hoje')   return { from: iso(today), to: iso(today) };
  if (period === 'Máximo') return { from: '2020-01-01', to: iso(today) };
  const days = parseInt(period) || 7;
  const from = new Date(today); from.setDate(today.getDate() - days + 1);
  return { from: iso(from), to: iso(today) };
}

/* ── Hook: dados reais do Supabase ───────────────────────────────*/
function useDashboardData(period, dateRange) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!window.db) return;
    const { from, to } = periodToDates(period, dateRange);
    // BRT = UTC-3. Converte intervalo de datas BRT para UTC para queries corretas.
    const brtRangeUtc = (f, t) => {
      const nextDay = new Date(t + 'T00:00:00'); nextDay.setDate(nextDay.getDate() + 1);
      const pad = n => String(n).padStart(2,'0');
      const nd = `${nextDay.getFullYear()}-${pad(nextDay.getMonth()+1)}-${pad(nextDay.getDate())}`;
      return { gte: f + 'T03:00:00Z', lte: nd + 'T02:59:59Z' };
    };
    const brt = brtRangeUtc(from, to);

    async function load() {
      setLoading(true);
      try {
        /* alíquotas configuráveis (tabela config) */
        const { data: cfg } = await window.db.from('config').select('chave,valor');
        const cfgMap = Object.fromEntries((cfg || []).map(c => [c.chave, Number(c.valor)]));
        const notaPct = cfgMap.imposto_nota_pct ?? 6;
        const metaPct = cfgMap.imposto_meta_pct ?? 12.15;

        /* vendas aprovadas no período */
        const { data: vendas } = await window.db
          .from('vendas')
          .select('valor_bruto, valor_liquido, preco_oferta, produto_nome, utm_source, status, created_at, comprador_email')
          .eq('status', 'aprovada')
          .gte('created_at', brt.gte)
          .lte('created_at', brt.lte);

        /* reembolsos no período */
        const { data: reembolsos } = await window.db
          .from('vendas')
          .select('valor_bruto')
          .eq('status', 'reembolsada')
          .gte('created_at', brt.gte)
          .lte('created_at', brt.lte);

        /* insights agregados (para o funil); mapeados ao período */
        const insightsPeriodo = period === 'Máximo' || period === 'Hoje' || period === 'Custom'
          ? 'maximum' : period;
        const { data: insights } = await window.db
          .from('insights_cache')
          .select('gasto, link_clicks, landing_page_views, compras, initiate_checkout')
          .eq('periodo', insightsPeriodo);

        /* gasto Meta + funil do PERÍODO: soma o diário no range. Em Máximo usa o total de vida */
        let gasto, totCliques, totLP, totIC, totComp;
        if (period === 'Máximo') {
          gasto      = (insights || []).reduce((s, i) => s + Number(i.gasto), 0);
          totCliques = (insights || []).reduce((s,i)=>s+Number(i.link_clicks||0),0);
          totLP      = (insights || []).reduce((s,i)=>s+Number(i.landing_page_views||0),0);
          totIC      = (insights || []).reduce((s,i)=>s+Number(i.initiate_checkout||0),0);
          totComp    = (insights || []).reduce((s,i)=>s+Number(i.compras||0),0);
        } else {
          const { data: gd } = await window.db
            .from('gasto_diario').select('gasto,cliques,lp_views,initiate_checkout,compras')
            .gte('data', from).lte('data', to);
          gasto      = (gd || []).reduce((s, r) => s + Number(r.gasto), 0);
          totCliques = (gd || []).reduce((s, r) => s + Number(r.cliques||0), 0);
          totLP      = (gd || []).reduce((s, r) => s + Number(r.lp_views||0), 0);
          totIC      = (gd || []).reduce((s, r) => s + Number(r.initiate_checkout||0), 0);
          totComp    = (gd || []).reduce((s, r) => s + Number(r.compras||0), 0);
        }

        /* despesas recorrentes do mês */
        const { data: despesas } = await window.db
          .from('despesas')
          .select('valor, tipo, recorrencia, data')
          .eq('ativo', true);

        /* calcula KPIs — usa preco_oferta (preço do produto s/ juros do parcelamento = base de NF) */
        const fat    = (vendas || []).reduce((s, v) => s + Number(v.preco_oferta || v.valor_bruto), 0);
        const reimb  = (reembolsos || []).reduce((s, v) => s + Number(v.valor_bruto), 0);

        // rateio fiel: mensal ÷ dias do mês, anual ÷ dias do ano, único só no dia exato
        function calcDespPeriodo(lista, fromStr, toStr) {
          const dIni = new Date(fromStr + 'T00:00:00');
          const dFim = new Date(toStr   + 'T00:00:00');
          let total = 0;
          for (const d of (lista || [])) {
            const rec = d.recorrencia || 'mensal';
            const val = Number(d.valor);
            if (d.tipo === 'unico') {
              const dEntry = new Date((d.data || fromStr) + 'T00:00:00');
              if (dEntry >= dIni && dEntry <= dFim) total += val;
            } else if (rec === 'mensal') {
              let cur = new Date(dIni.getFullYear(), dIni.getMonth(), 1);
              while (cur <= dFim) {
                const mIni = new Date(cur.getFullYear(), cur.getMonth(), 1);
                const mFim = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
                const sIni = dIni > mIni ? dIni : mIni;
                const sFim = dFim < mFim ? dFim : mFim;
                const dias = Math.max(0, Math.round((sFim - sIni) / 86400000) + 1);
                total += (val / mFim.getDate()) * dias;
                cur.setMonth(cur.getMonth() + 1);
              }
            } else if (rec === 'anual') {
              for (let y = dIni.getFullYear(); y <= dFim.getFullYear(); y++) {
                const aIni = new Date(y, 0, 1);
                const aFim = new Date(y, 11, 31);
                const sIni = dIni > aIni ? dIni : aIni;
                const sFim = dFim < aFim ? dFim : aFim;
                const dias = Math.max(0, Math.round((sFim - sIni) / 86400000) + 1);
                const diasAno = (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 366 : 365;
                total += (val / diasAno) * dias;
              }
            }
          }
          return total;
        }

        const periodoFrom = period === 'Máximo' ? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10) : from;
        const periodoTo   = period === 'Máximo' ? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0,10) : to;
        const desp = calcDespPeriodo(despesas, periodoFrom, periodoTo);

        const impostoMeta    = fat > 0 ? gasto * (metaPct / 100) : 0;
        const impostoNota    = fat * (notaPct / 100);
        // Hotmart já descontou sua taxa em valor_liquido — não deduzir de novo
        const lucro          = fat - impostoMeta - impostoNota - desp - reimb;
        const margem         = fat > 0 ? (lucro / fat) * 100 : 0;

        const totalVendasBruto = (vendas || []).length;
        const roas        = gasto > 0 ? fat / gasto : null;
        const roi          = (gasto + desp) > 0 ? lucro / (gasto + desp) : null;
        const ticketMedio  = totalVendasBruto > 0 ? fat / totalVendasBruto : null;

        // CAC (só cliente novo, ache pela 1ª compra em toda a história) e LTV
        // (histórico COMPLETO de quem comprou no período, não só o período).
        const emailsPeriodo = [...new Set((vendas || []).map(v => v.comprador_email).filter(Boolean))];
        let cac = null, ltv = null;
        if (emailsPeriodo.length) {
          const { data: historico } = await window.db
            .from('vendas')
            .select('comprador_email, valor_bruto, preco_oferta, created_at')
            .eq('status', 'aprovada')
            .in('comprador_email', emailsPeriodo);

          const porEmail = {};
          (historico || []).forEach(v => {
            (porEmail[v.comprador_email] ||= []).push(v);
          });

          let clientesNovos = 0;
          let somaLtv = 0;
          for (const email of emailsPeriodo) {
            const compras = porEmail[email] || [];
            if (!compras.length) continue;
            const primeiraCompra = compras.reduce((min, v) => v.created_at < min ? v.created_at : min, compras[0].created_at);
            if (primeiraCompra >= brt.gte && primeiraCompra <= brt.lte) clientesNovos++;
            somaLtv += compras.reduce((s, v) => s + Number(v.preco_oferta || v.valor_bruto || 0), 0);
          }
          cac = clientesNovos > 0 ? gasto / clientesNovos : null;
          ltv = emailsPeriodo.length > 0 ? somaLtv / emailsPeriodo.length : null;
        }

        /* vendas por produto */
        const prodMap = {};
        (vendas || []).forEach(v => {
          const k = v.produto_nome || 'Outros';
          if (!prodMap[k]) prodMap[k] = 0;
          prodMap[k]++;
        });
        const totalVendas = (vendas || []).length;
        const salesByProduct = Object.entries(prodMap)
          .sort((a,b) => b[1]-a[1])
          .slice(0,5)
          .map(([name, sales]) => ({ name, sales, pct: totalVendas > 0 ? (sales/totalVendas)*100 : 0 }));

        /* vendas por fonte */
        const srcMap = {};
        (vendas || []).forEach(v => {
          const k = normalizeSource(v.utm_source);
          if (!srcMap[k]) srcMap[k] = 0;
          srcMap[k]++;
        });
        const salesBySource = Object.entries(srcMap)
          .sort((a,b) => b[1]-a[1])
          .map(([name, sales]) => ({ name, sales, pct: totalVendas > 0 ? (sales/totalVendas)*100 : 0 }));

        /* breakdown — fat já é o líquido Hotmart (sem taxa e sem juros parcelamento) */
        const breakdownRows = [
          { label: 'Faturamento bruto (preço produto)',  value: fat,  color: 'var(--text-1)', bold: true },
          { label: `Imposto Meta (${metaPct.toString().replace('.',',')}%)`, value: -impostoMeta, color: 'var(--clr-neg)' },
          { label: `Imposto sobre Nota (${notaPct.toString().replace('.',',')}%)`, value: -impostoNota, color: 'var(--clr-neg)' },
          { label: 'Despesas recorrentes',       value: -desp,         color: 'var(--clr-neg)' },
          { label: 'Reembolsos',                 value: -reimb,        color: 'var(--clr-warn)' },
          { label: 'Lucro real',                 value: lucro,         color: 'var(--clr-pos)', bold: true, separator: true },
        ];

        /* upsell Blindagem — cross-reference emails (acumulado total, independente do período).
           Bug corrigido 2026-07-09: a query pedia a coluna "email", que não
           existe em vendas (é comprador_email) — vinha sempre vazio, então o
           card do funil sempre mostrava 0, mesmo com upsells reais fechados. */
        const [{ data: mcvEmailsRaw }, { data: blindEmailsRaw }] = await Promise.all([
          window.db.from('vendas').select('comprador_email').eq('status','aprovada').ilike('produto_nome','%contrato visual%'),
          window.db.from('vendas').select('comprador_email').eq('status','aprovada').ilike('produto_nome','%blindagem%'),
        ]);
        const mcvSet      = new Set((mcvEmailsRaw   || []).map(r => r.comprador_email).filter(Boolean));
        const blindSet    = new Set((blindEmailsRaw || []).map(r => r.comprador_email).filter(Boolean));
        const upsellConv  = [...blindSet].filter(e => mcvSet.has(e)).length;

        // Conversão real da página de upsell (quantos viram vs quantos compraram).
        // upsell_pageviews é alimentado por um beacon na própria página
        // (blindagem-upsell/index.html), em paralelo ao Meta Pixel.
        const { count: upsellViews } = await window.db
          .from('upsell_pageviews').select('id', { count: 'exact', head: true });
        const upsellPct = upsellViews > 0 ? +((upsellConv / upsellViews) * 100).toFixed(1) : null;

        /* funil steps */
        const funnelSteps = totCliques > 0 ? [
          { label: 'Cliques',                value: totCliques, pct: 100 },
          { label: 'Visualizações de Página', value: totLP,      pct: +((totLP/totCliques)*100).toFixed(1) },
          { label: 'Início de Compra',        value: totIC,      pct: +((totIC/totCliques)*100).toFixed(1) },
          { label: 'Vendas Aprovadas',        value: totComp,    pct: +((totComp/totCliques)*100).toFixed(1) },
          {
            label: 'Upsell Blindagem', value: upsellConv,
            pct: +((upsellConv/totCliques)*100).toFixed(1),
            sub: upsellViews > 0 ? `${upsellPct}% de ${upsellViews} que viram a página de upsell` : 'sem pageview registrado ainda',
          },
        ] : null;

        /* CPA médio consolidado (blended): investimento total ÷ compras totais do período.
           Usa gasto e totComp já calculados acima (gasto_diario para 7/14/30d — fresco e
           batido contra o Meta; insights_cache maximum para a visão de vida inteira).
           Antes era média das médias sobre o insights_cache (cada anúncio pesava igual,
           tendo 1 ou 100 vendas, e incluía linhas congeladas de anúncios já pausados). */
        const cpaMedio = totComp > 0 ? gasto / totComp : null;

        /* ranking de ADs — apenas campeões */
        const { data: adsRaw } = await window.db
          .from('ads')
          .select('numero, titulo, tipo, status, gasto_total, cpa_historico, vendas_total, meta_ad_id, media_drive_url, media_tipo')
          .in('status', ['campeoes', 'ativo'])
          .limit(500);

        /* mapear período do dashboard → periodo do insights_cache */
        const icPeriodo = period === 'Máximo' || period === 'Custom' ? 'maximum'
          : period === 'Hoje' ? 'hoje'
          : period; // '7d', '14d', '30d'

        /* métricas do período via insights_cache (compras, gasto, cpa por meta_ad_id) */
        const { data: icData } = await window.db
          .from('insights_cache')
          .select('meta_ad_id, compras, gasto, cpa')
          .eq('periodo', icPeriodo);
        const icMap = Object.fromEntries((icData || []).map(r => [r.meta_ad_id, r]));

        const adsMapped = (adsRaw || []).map(a => {
          const ic       = a.meta_ad_id ? icMap[a.meta_ad_id] : null;
          const vendas   = ic ? Number(ic.compras || 0) : 0;
          const gasto    = ic ? Number(ic.gasto   || 0) : Number(a.gasto_total || 0);
          const cpa      = ic && ic.cpa ? Number(ic.cpa) : (vendas > 0 ? gasto / vendas : null);
          return {
            numero:   a.numero,
            titulo:   a.titulo || `ADS ${a.numero}`,
            tipo:     a.tipo,
            status:   a.status,
            gasto,
            vendas,
            cpa,
            thumbUrl: a.media_drive_url ? `thumbnails/${a.numero}.jpg` : null,
          };
        });

        // Critério: ADs com compras no período ordenados por CPA asc
        // ADs sem compra no período ficam no final por gasto desc
        const comVenda = adsMapped.filter(a => a.vendas > 0).sort((a,b) => (a.cpa||0) - (b.cpa||0));
        const semVenda = adsMapped.filter(a => a.vendas === 0).sort((a,b) => b.gasto - a.gasto);
        const adsRanking = [...comVenda, ...semVenda].slice(0, 10);

        setData({ fat, lucro, gasto, margem, reimb, totalVendas, cpaMedio,
          roas, roi, ticketMedio, cac, ltv,
          breakdownRows, salesByProduct, salesBySource, funnelSteps,
          impostoMeta, impostoNota, desp, adsRanking });
      } catch(e) {
        console.error('Dashboard fetch error:', e);
      }
      setLoading(false);
    }
    load();

    // Realtime: recarrega automaticamente quando chega nova venda
    const channel = window.db
      .channel('vendas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendas' }, () => {
        load();
      })
      .subscribe();

    return () => { window.db.removeChannel(channel); };
  }, [period, dateRange]);

  return { data, loading };
}

/* ── Hook: gráfico de linha Gasto×Faturamento (period-aware) ────*/
function useLineChartData(period, dateRange) {
  const [chartDays, setChartDays] = useState([]);

  useEffect(() => {
    if (!window.db) return;
    const { from, to } = periodToDates(period, dateRange);
    const pad = n => String(n).padStart(2,'0');
    const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

    async function load() {
      const startDate = new Date(from + 'T00:00:00');
      const endDate   = new Date(to   + 'T00:00:00');
      const totalDays = Math.round((endDate - startDate) / 86400000) + 1;

      // Agrupa por stride se período muito longo (máx 45 pontos no gráfico)
      const stride = totalDays > 45 ? Math.ceil(totalDays / 45) : 1;
      const days = [];
      for (let i = 0; i < totalDays; i += stride) {
        const d = new Date(startDate); d.setDate(startDate.getDate() + i);
        days.push(d);
      }
      if (!days.length) return;

      // BRT = UTC-3. Ajuste das bordas da query para cobrir o dia completo em BRT:
      // início BRT (00:00) = UTC 03:00 do mesmo dia
      // fim BRT (23:59) = UTC 02:59 do dia seguinte
      const toNextDay = new Date(to + 'T00:00:00');
      toNextDay.setDate(toNextDay.getDate() + 1);
      const toNextIso = isoDate(toNextDay);
      const toBrtUtc = toNextIso + 'T02:59:59Z';

      const [{ data: vendas }, { data: gastoDiario }] = await Promise.all([
        window.db.from('vendas').select('preco_oferta,valor_bruto,created_at').eq('status','aprovada')
          .gte('created_at', from+'T03:00:00Z').lte('created_at', toBrtUtc),
        window.db.from('gasto_diario').select('data,gasto').gte('data', from).lte('data', to),
      ]);

      const gastoByDate = {};
      (gastoDiario||[]).forEach(r => { gastoByDate[r.data] = (gastoByDate[r.data]||0) + Number(r.gasto); });

      // Converte UTC → BRT para agrupar pela data correta
      const toBrtDate = iso => new Date(new Date(iso).getTime() - 3*60*60*1000).toISOString().slice(0,10);

      const fatByDate = {};
      (vendas||[]).forEach(r => {
        const d = toBrtDate(r.created_at);
        fatByDate[d] = (fatByDate[d]||0) + Number(r.preco_oferta||r.valor_bruto);
      });

      const DAYS_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];
      const results = days.map(d => {
        const iso = isoDate(d);
        const label = totalDays <= 8
          ? DAYS_PT[d.getDay()]
          : `${pad(d.getDate())}/${pad(d.getMonth()+1)}`;
        // Se stride > 1, soma o bloco de dias
        let fat = 0, gasto = 0;
        for (let s = 0; s < stride; s++) {
          const sd = new Date(d); sd.setDate(d.getDate() + s);
          const si = isoDate(sd);
          fat   += fatByDate[si]   || 0;
          gasto += gastoByDate[si] || 0;
        }
        return { label, fat, gasto };
      });
      setChartDays(results);
    }
    load();
  }, [period, dateRange]);

  return chartDays;
}

/* ── Hook: vendas por dia da semana (period-aware) ──────────────*/
function useWeeklyBarData(period, dateRange) {
  const [weeklySales, setWeeklySales] = useState([]);
  const DAY_LABELS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];

  useEffect(() => {
    if (!window.db) return;
    // BRT = UTC-3
    const BRT = 3 * 60 * 60 * 1000;
    const toBrtDate = iso => new Date(new Date(iso).getTime() - BRT).toISOString().slice(0,10);
    const toBrtDay  = iso => new Date(new Date(iso).getTime() - BRT).getDay();
    const brtRangeUtc = (f, t) => {
      const nd = new Date(t + 'T00:00:00'); nd.setDate(nd.getDate() + 1);
      const p = n => String(n).padStart(2,'0');
      return { gte: f+'T03:00:00Z', lte: `${nd.getFullYear()}-${p(nd.getMonth()+1)}-${p(nd.getDate())}T02:59:59Z` };
    };
    // Hoje em BRT
    const todayBrt = new Date(Date.now() - BRT);
    const todayIso = todayBrt.toISOString().slice(0,10);

    async function load() {
      if (period === 'Hoje') {
        const weekStart = new Date(todayBrt); weekStart.setDate(todayBrt.getDate() - 6);
        const weekStartIso = weekStart.toISOString().slice(0,10);
        const brt = brtRangeUtc(weekStartIso, todayIso);
        const { data: v } = await window.db.from('vendas').select('created_at').eq('status','aprovada')
          .gte('created_at', brt.gte).lte('created_at', brt.lte);
        const counts = Array(7).fill(0);
        (v||[]).forEach(venda => { counts[toBrtDay(venda.created_at)]++; });
        const todayIdx = todayBrt.getDay();
        setWeeklySales(DAY_LABELS.map((l, i) => ({ day: l, sales: counts[i], dimmed: i !== todayIdx })));
        return;
      }

      const { from, to } = periodToDates(period, dateRange);
      const brt = brtRangeUtc(from, to);
      const { data: v } = await window.db.from('vendas').select('created_at').eq('status','aprovada')
        .gte('created_at', brt.gte).lte('created_at', brt.lte);
      const counts = Array(7).fill(0);
      (v||[]).forEach(venda => { counts[toBrtDay(venda.created_at)]++; });
      setWeeklySales(DAY_LABELS.map((l, i) => ({ day: l, sales: counts[i] })));
    }
    load();
  }, [period, dateRange]);

  return weeklySales;
}

function useWeeklySalesHeatmap(from, to) {
  const [heatmap, setHeatmap] = useState(null);
  useEffect(() => {
    if (!window.db) return;
    const BRT = 3 * 60 * 60 * 1000;
    const nd = new Date(to + 'T00:00:00'); nd.setDate(nd.getDate() + 1);
    const p = n => String(n).padStart(2,'0');
    const toLte = `${nd.getFullYear()}-${p(nd.getMonth()+1)}-${p(nd.getDate())}T02:59:59Z`;
    window.db.from('vendas').select('created_at,status')
      .eq('status','aprovada')
      .gte('created_at', from + 'T03:00:00Z')
      .lte('created_at', toLte)
      .then(({ data }) => {
        const DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];
        const ROWS = ['Madrugada','Manhã','Tarde','Noite'];
        const SUBS = ['00-06h','06-12h','12-18h','18-24h'];
        const vals = Array.from({length:4},()=>Array(7).fill(0));
        (data||[]).forEach(v => {
          const brtDate = new Date(new Date(v.created_at).getTime() - BRT);
          const dow = brtDate.getDay();
          const h = brtDate.getHours();
          const row = h < 6 ? 0 : h < 12 ? 1 : h < 18 ? 2 : 3;
          vals[row][dow]++;
        });
        setHeatmap({ rows:ROWS, subs:SUBS, cols:DAYS, values:vals });
      });
  }, [from, to]);
  return heatmap;
}

/* ── Recuperação de Vendas ──────────────────────────────────────*/
function useRecuperacao(from, to) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!window.db) return;
    const _nd = new Date(to + 'T00:00:00'); _nd.setDate(_nd.getDate() + 1);
    const _p = n => String(n).padStart(2,'0');
    const _lte = `${_nd.getFullYear()}-${_p(_nd.getMonth()+1)}-${_p(_nd.getDate())}T02:59:59Z`;
    window.db.from('recuperacao_vendas')
      .select('id,nome,produto_nome,valor,status,telefone,email,cidade,estado,motivo_recusa,categoria_recusa,created_at,recuperado_at')
      .gte('created_at', from + 'T03:00:00Z')
      .lte('created_at', _lte)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setItems(data || []));
  }, [from, to]);
  return items;
}

function RecuperacaoList({ items }) {
  const [selected, setSelected] = useState(null);
  const storageKey = 'fmn_contato_feito';
  const [contatados, setContatados] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; }
  });

  function toggleContato(id, e) {
    if (e && e.stopPropagation) e.stopPropagation();
    setContatados(prev => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  function waLink(telefone, nome) {
    if (!telefone) return null;
    const num = telefone.replace(/\D/g, '');
    const base = num.startsWith('55') ? num : '55' + num;
    const primeiroNome = nome ? nome.split(' ')[0] : '';
    const msg = encodeURIComponent(`Olá${primeiroNome ? ' ' + primeiroNome : ''}! Vimos que você demonstrou interesse. Posso te ajudar?`);
    return `https://wa.me/${base}?text=${msg}`;
  }

  const STATUS_LABEL = {
    cancelada:   { label: 'Cancelada',   color: 'var(--clr-neg)',  bg: 'rgba(239,68,68,.10)'   },
    recuperacao: { label: 'Recuperação', color: 'var(--clr-warn)', bg: 'rgba(245,158,11,.10)'  },
    pendente:    { label: 'Pendente',    color: 'var(--clr-warn)', bg: 'rgba(245,158,11,.08)'  },
    abandono:    { label: 'Abandono',    color: '#a78bfa',         bg: 'rgba(167,139,250,.10)' },
  };

  const fmtDt = dt => dt ? new Date(dt).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';

  // Agrupar por status para exibir contadores
  const counts = items.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});

  return (
    <>
      {/* Contadores de status */}
      {items.length > 0 && (
        <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
          {Object.entries(counts).map(([st, n]) => {
            const cfg = STATUS_LABEL[st] || { label: st, color:'var(--text-3)', bg:'rgba(255,255,255,.05)' };
            return (
              <span key={st} style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
                padding:'3px 9px', borderRadius:999, background:cfg.bg,
                border:`1px solid ${cfg.color}30`, color:cfg.color }}>
                {n} {cfg.label}
              </span>
            );
          })}
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:5, maxHeight:310, overflowY:'auto' }}>
        {items.map(r => {
          const feito = !!contatados[r.id];
          const scfg  = STATUS_LABEL[r.status] || { label: r.status, color:'var(--text-3)', bg:'rgba(255,255,255,.05)' };
          const wa    = waLink(r.telefone, r.nome);
          return (
            <div key={r.id} onClick={() => setSelected(r)}
              style={{ display:'flex', alignItems:'center', gap:8,
                padding:'8px 10px', borderRadius:8, cursor:'pointer',
                background: feito ? 'rgba(74,222,128,.04)' : 'var(--app-surface-2)',
                border:`1px solid ${feito ? 'rgba(74,222,128,.2)' : 'var(--app-border)'}`,
                transition:'all 130ms', opacity: feito ? 0.7 : 1 }}
              onMouseEnter={e => e.currentTarget.style.borderColor = feito ? 'rgba(74,222,128,.4)' : 'rgba(234,170,65,.3)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = feito ? 'rgba(74,222,128,.2)' : 'var(--app-border)'}>

              {/* badge status */}
              <span style={{ fontSize:9.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
                padding:'2px 6px', borderRadius:999, background:scfg.bg,
                border:`1px solid ${scfg.color}40`, color:scfg.color,
                whiteSpace:'nowrap', flexShrink:0 }}>
                {scfg.label}
              </span>

              {/* nome + produto */}
              <div style={{ minWidth:0, flex:1 }}>
                <div style={{ fontSize:12, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-1)',
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5 }}>
                  {r.nome || 'Cliente sem nome'}
                  {feito && <span style={{ fontSize:9.5, color:'var(--clr-pos)', fontWeight:700, flexShrink:0 }}>✓ Contatado</span>}
                </div>
                <div style={{ fontSize:10, fontFamily:'Roboto,sans-serif', color:'var(--text-3)',
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {r.produto_nome || ''}{r.produto_nome && r.created_at ? ' · ' : ''}{fmtDt(r.created_at)}
                </div>
              </div>

              {/* valor */}
              {r.valor ? (
                <span style={{ fontSize:12, fontFamily:'Roboto,sans-serif', fontWeight:700,
                  color:'var(--fmn-gold)', flexShrink:0 }}>
                  {fmtCur(r.valor)}
                </span>
              ) : null}

              {/* botão WA direto na linha */}
              {wa ? (
                <a href={wa} target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  title={`Enviar WhatsApp para ${r.nome || r.telefone}`}
                  style={{ width:28, height:28, borderRadius:7, flexShrink:0,
                    background:'rgba(37,211,102,.13)', border:'1px solid rgba(37,211,102,.3)',
                    display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none' }}>
                  <LucideIcon icon="message-circle" size={13} color="#25d366"/>
                </a>
              ) : (
                <div style={{ width:28, height:28, flexShrink:0, borderRadius:7,
                  background:'rgba(255,255,255,.04)', border:'1px solid var(--app-border)',
                  display:'flex', alignItems:'center', justifyContent:'center' }}
                  title="Sem telefone">
                  <LucideIcon icon="phone-off" size={12} color="var(--text-3)"/>
                </div>
              )}

              {/* marcar como contatado */}
              <button onClick={e => toggleContato(r.id, e)}
                title={feito ? 'Desmarcar contato' : 'Marcar como contatado'}
                style={{ width:28, height:28, borderRadius:7, flexShrink:0,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  background: feito ? 'rgba(74,222,128,.15)' : 'rgba(255,255,255,.06)',
                  border:`1px solid ${feito ? 'rgba(74,222,128,.3)' : 'var(--app-border)'}`,
                  color: feito ? 'var(--clr-pos)' : 'var(--text-3)', cursor:'pointer', transition:'all 130ms' }}>
                <LucideIcon icon={feito ? 'check' : 'check'} size={12}/>
              </button>
            </div>
          );
        })}
      </div>

      {/* Modal de detalhe */}
      {selected && (
        <div onClick={() => setSelected(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', zIndex:600,
            display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'var(--app-surface)', border:'1px solid var(--app-border-2)',
              borderRadius:16, padding:'24px', width:380, display:'flex', flexDirection:'column', gap:14,
              boxShadow:'0 20px 60px rgba(0,0,0,.6)' }}>

            {/* header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:15, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-1)' }}>
                  Contato com Lead
                </span>
                {(() => {
                  const scfg = STATUS_LABEL[selected.status] || { label: selected.status, color:'var(--text-3)', bg:'rgba(255,255,255,.05)' };
                  return (
                    <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
                      padding:'2px 8px', borderRadius:999, background:scfg.bg,
                      border:`1px solid ${scfg.color}40`, color:scfg.color }}>
                      {scfg.label}
                    </span>
                  );
                })()}
              </div>
              <button onClick={() => setSelected(null)}
                style={{ width:28, height:28, borderRadius:'50%', background:'rgba(255,255,255,.07)',
                  color:'var(--text-2)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:16 }}>×</button>
            </div>

            {/* dados do lead */}
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--text-1)', marginBottom:2 }}>{selected.nome || 'Cliente sem nome'}</div>
              <div style={{ fontSize:12, color:'var(--text-3)' }}>{selected.produto_nome}</div>
              {selected.valor ? <div style={{ fontSize:13, color:'var(--fmn-gold)', fontWeight:700, marginTop:4 }}>{fmtCur(selected.valor)}</div> : null}
              {(selected.cidade || selected.estado) && (
                <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>
                  {[selected.cidade, selected.estado].filter(Boolean).join(' / ')}
                </div>
              )}
              {selected.motivo_recusa && (
                <div style={{ fontSize:11, color:'var(--clr-neg)', marginTop:4, padding:'4px 8px',
                  borderRadius:6, background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.15)' }}>
                  Motivo: {selected.categoria_recusa ? `${selected.categoria_recusa} — ` : ''}{selected.motivo_recusa}
                </div>
              )}
            </div>

            {/* contatos */}
            <div style={{ display:'flex', flexDirection:'column', gap:8, padding:'12px', borderRadius:10,
              background:'var(--app-surface-2)', border:'1px solid var(--app-border)' }}>
              {selected.telefone ? (
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <LucideIcon icon="phone" size={14} color="var(--text-3)"/>
                  <span style={{ fontSize:12, color:'var(--text-2)', fontFamily:'Roboto,sans-serif', flex:1 }}>{selected.telefone}</span>
                  <button onClick={() => navigator.clipboard.writeText(selected.telefone)}
                    style={{ padding:'3px 8px', borderRadius:5, background:'rgba(255,255,255,.06)',
                      border:'1px solid var(--app-border)', color:'var(--text-3)', fontSize:10, cursor:'pointer' }}>Copiar</button>
                </div>
              ) : (
                <div style={{ display:'flex', alignItems:'center', gap:8, opacity:0.5 }}>
                  <LucideIcon icon="phone-off" size={14} color="var(--text-3)"/>
                  <span style={{ fontSize:12, color:'var(--text-3)', fontFamily:'Roboto,sans-serif' }}>Sem telefone cadastrado</span>
                </div>
              )}
              {selected.email && (
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <LucideIcon icon="mail" size={14} color="var(--text-3)"/>
                  <span style={{ fontSize:12, color:'var(--text-2)', fontFamily:'Roboto,sans-serif', flex:1 }}>{selected.email}</span>
                  <button onClick={() => navigator.clipboard.writeText(selected.email)}
                    style={{ padding:'3px 8px', borderRadius:5, background:'rgba(255,255,255,.06)',
                      border:'1px solid var(--app-border)', color:'var(--text-3)', fontSize:10, cursor:'pointer' }}>Copiar</button>
                </div>
              )}
            </div>

            {/* ações */}
            <div style={{ display:'flex', gap:8 }}>
              {waLink(selected.telefone, selected.nome) ? (
                <a href={waLink(selected.telefone, selected.nome)} target="_blank" rel="noopener noreferrer"
                  style={{ flex:1, padding:'10px', borderRadius:8, background:'#25d366',
                    color:'#fff', fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:12,
                    display:'flex', alignItems:'center', justifyContent:'center', gap:6, textDecoration:'none' }}>
                  <LucideIcon icon="message-circle" size={14}/>WhatsApp
                </a>
              ) : (
                <div style={{ flex:1, padding:'10px', borderRadius:8, background:'rgba(255,255,255,.04)',
                  border:'1px solid var(--app-border)', color:'var(--text-3)',
                  fontFamily:'Roboto,sans-serif', fontSize:12,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  <LucideIcon icon="message-circle" size={14}/>Sem telefone
                </div>
              )}
              <button onClick={() => { toggleContato(selected.id); setSelected(null); }}
                style={{ flex:1, padding:'10px', borderRadius:8,
                  background: contatados[selected.id] ? 'rgba(74,222,128,.1)' : 'rgba(255,255,255,.06)',
                  border:`1px solid ${contatados[selected.id] ? 'rgba(74,222,128,.3)' : 'var(--app-border)'}`,
                  color: contatados[selected.id] ? 'var(--clr-pos)' : 'var(--text-1)',
                  fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:12,
                  cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                <LucideIcon icon={contatados[selected.id] ? 'check' : 'phone-call'} size={14}/>
                {contatados[selected.id] ? 'Já entrei em contato' : 'Marcar como contatado'}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}

/* ── DateRangePicker ─────────────────────────────────────────────*/
function DateRangePicker({ period, onPeriodChange, dateRange, onDateRangeChange }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(dateRange.from);
  const [to, setTo]     = useState(dateRange.to);
  const presets = ['Hoje','7d','14d','30d','Máximo'];
  const ref = useRef(null);
  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);
  const inputStyle = {
    padding: '5px 10px', borderRadius: 6, fontSize: 12, fontFamily: 'Roboto, sans-serif',
    background: 'var(--app-surface-3)', border: '1px solid var(--app-border-2)',
    color: 'var(--text-1)', colorScheme: 'dark', cursor: 'pointer',
  };
  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ display: 'flex', background: 'rgba(255,255,255,.04)',
        border: '1px solid var(--app-border)', borderRadius: 8, padding: 3, gap: 1 }}>
        {presets.map(p => (
          <button key={p} onClick={() => { onPeriodChange(p); setOpen(false); }}
            style={{ padding: '5px 11px', borderRadius: 6, cursor: 'pointer', transition: 'all 130ms',
              background: period === p ? 'rgba(234,170,65,.15)' : 'transparent',
              border: `1px solid ${period === p ? 'rgba(234,170,65,.2)' : 'transparent'}`,
              color: period === p ? 'var(--fmn-gold)' : 'rgba(255,255,255,.42)',
              fontFamily: 'Roboto, sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: '0.03em' }}>
            {p}
          </button>
        ))}
        <button onClick={() => setOpen(!open)}
          style={{ padding: '5px 11px', borderRadius: 6, cursor: 'pointer', transition: 'all 130ms',
            background: period === 'Custom' ? 'rgba(234,170,65,.15)' : 'transparent',
            border: `1px solid ${period === 'Custom' ? 'rgba(234,170,65,.2)' : 'transparent'}`,
            color: period === 'Custom' ? 'var(--fmn-gold)' : 'rgba(255,255,255,.42)',
            fontFamily: 'Roboto, sans-serif', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
          <LucideIcon icon="calendar" size={11} />
          Personalizar
        </button>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 200,
          background: 'var(--app-surface)', border: '1px solid var(--app-border-2)',
          borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'center',
          boxShadow: '0 12px 32px rgba(0,0,0,.4)', whiteSpace: 'nowrap' }}>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inputStyle} />
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>até</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={inputStyle} />
          <button onClick={() => { onDateRangeChange({ from, to }); onPeriodChange('Custom'); setOpen(false); }}
            style={{ padding: '6px 14px', background: 'var(--fmn-gold)', color: 'var(--fmn-black)',
              borderRadius: 6, fontSize: 11, fontFamily: 'Roboto, sans-serif', fontWeight: 700,
              cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}

/* ── FlowFunnel ──────────────────────────────────────────────────*/
function FlowFunnel({ steps }) {
  // Layout: labels-row no topo (y 0-11), badges (y 14-40), conector, funil (y 50-H-20), volume (y H-4)
  const W = 880, H = 210, maxHalf = 72;
  const BADGE_TOP = 14, BADGE_H = 28, BADGE_FS = 14;
  const FUNNEL_TOP = 52; // onde o funil começa (abaixo dos badges)
  const cy = FUNNEL_TOP + maxHalf + (H - FUNNEL_TOP - maxHalf*2 - 18) / 2 + maxHalf;

  const stepW = W / steps.length;
  const bHalf = [...steps.map(s => Math.max((s.pct / 100) * maxHalf, 1.5)), 0];
  bHalf[bHalf.length - 1] = bHalf[bHalf.length - 2];
  const bX = Array.from({ length: steps.length + 1 }, (_, i) => i * stepW);

  // centro vertical real do funil
  const realCy = FUNNEL_TOP + maxHalf + 4;

  let path = `M ${bX[0]} ${realCy - bHalf[0]}`;
  for (let i = 0; i < bX.length - 1; i++) {
    const x1=bX[i], y1=realCy-bHalf[i], x2=bX[i+1], y2=realCy-bHalf[i+1];
    const mx=(x1+x2)/2;
    path += ` C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  }
  path += ` L ${bX[bX.length-1]} ${realCy+bHalf[bHalf.length-1]}`;
  for (let i = bX.length-1; i > 0; i--) {
    const x1=bX[i], y1=realCy+bHalf[i], x2=bX[i-1], y2=realCy+bHalf[i-1];
    const mx=(x1+x2)/2;
    path += ` C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  }
  path += ' Z';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto', display:'block' }}>
      <defs>
        <linearGradient id="fg1" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#eaaa41" stopOpacity="0.9"/>
          <stop offset="55%"  stopColor="#e8820a" stopOpacity="0.85"/>
          <stop offset="100%" stopColor="#c84a14" stopOpacity="0.8"/>
        </linearGradient>
      </defs>

      {/* Funil */}
      <path d={path} fill="url(#fg1)"/>

      {/* Divisórias verticais */}
      {steps.slice(1).map((_,i) => (
        <line key={i} x1={(i+1)*stepW} y1={BADGE_TOP + BADGE_H + 6} x2={(i+1)*stepW} y2={H-18}
          stroke="rgba(255,255,255,.15)" strokeWidth="1"/>
      ))}

      {/* Badges uniformes — todos idênticos */}
      {steps.map((s,i) => {
        const cx    = i * stepW + stepW / 2;
        const label = `${s.pct}%`;
        const txtW  = Math.max(label.length * BADGE_FS * 0.62 + 16, 50);
        const bx    = Math.max(4, Math.min(cx - txtW/2, W - txtW - 4));
        // conector: de base do badge até topo do funil nessa etapa
        const avgHalf = (bHalf[i] + bHalf[i+1]) / 2;
        const fTop  = realCy - avgHalf;
        const connTop = BADGE_TOP + BADGE_H + 1;

        return (
          <g key={i}>
            {/* label da etapa */}
            <text x={cx} y={BADGE_TOP - 3} fontSize="9.5"
              fill="rgba(255,255,255,.45)" textAnchor="middle"
              fontFamily="Roboto,sans-serif" fontWeight="500">
              {s.label}
            </text>
            {/* linha conectora do badge ao funil */}
            {fTop > connTop + 4 && (
              <line x1={cx} y1={connTop} x2={cx} y2={fTop}
                stroke="rgba(255,255,255,.18)" strokeWidth="1" strokeDasharray="2 2"/>
            )}
            {/* badge retangular uniforme */}
            <rect x={bx} y={BADGE_TOP} width={txtW} height={BADGE_H} rx="5"
              fill="rgba(15,16,19,.90)" stroke="rgba(234,170,65,.45)" strokeWidth="1"/>
            <text x={cx} y={BADGE_TOP + BADGE_H * 0.68} fontSize={BADGE_FS}
              fill="rgba(255,255,255,.95)" textAnchor="middle"
              fontFamily="Roboto,sans-serif" fontWeight="700">
              {label}
            </text>
          </g>
        );
      })}

      {/* Volume por etapa (base do SVG) */}
      {steps.map((s,i) => (
        <text key={i} x={i*stepW+stepW/2} y={H-4} fontSize="10"
          fill="rgba(255,255,255,.38)" textAnchor="middle" fontFamily="Roboto,sans-serif">
          {s.value.toLocaleString('pt-BR')}
        </text>
      ))}
    </svg>
  );
}

/* ── CircularProgress ────────────────────────────────────────────*/
function CircularProgress({ pct, size = 34, sw = 3, color = '#3b82f6' }) {
  const r = size/2 - sw;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform:'rotate(-90deg)', flexShrink:0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={sw}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeLinecap="round" strokeDasharray={`${(pct/100)*circ} ${circ}`}/>
    </svg>
  );
}

/* ── SalesList ───────────────────────────────────────────────────*/
function SalesList({ items, color='#3b82f6' }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {items.map((item,i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ flex:1, fontSize:12.5, fontFamily:'Roboto,sans-serif',
            color:'var(--text-2)', lineHeight:1.4 }}>{item.name}</span>
          <span style={{ fontSize:13, fontFamily:'Roboto,sans-serif', fontWeight:700,
            color:'var(--text-1)', minWidth:24, textAlign:'right' }}>{item.sales}</span>
          <CircularProgress pct={item.pct} color={color}/>
          <span style={{ fontSize:12, fontFamily:'Roboto,sans-serif', fontWeight:700,
            color, minWidth:46, textAlign:'right' }}>{item.pct.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

/* ── AbandonedCart ───────────────────────────────────────────────*/
function AbandonedCart({ carts }) {
  const [selected, setSelected] = useState(null);
  return (
    <div>
      <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
        {carts.map(c => (
          <div key={c.id} onClick={() => setSelected(c)}
            style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 11px',
              borderRadius:9, background:'var(--app-surface-2)', border:'1px solid var(--app-border)',
              cursor:'pointer', transition:'all 150ms' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = c.color+'55'; e.currentTarget.style.background = 'var(--app-surface-3)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--app-border)'; e.currentTarget.style.background = 'var(--app-surface-2)'; }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:c.color+'22',
              border:`1px solid ${c.color}44`, display:'flex', alignItems:'center',
              justifyContent:'center', flexShrink:0 }}>
              <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', fontWeight:700, color:c.color }}>
                {c.init}
              </span>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12.5, fontFamily:'Roboto,sans-serif', fontWeight:600,
                color:'var(--text-1)', marginBottom:1 }}>{c.name}</div>
              <div style={{ fontSize:11, color:'var(--text-3)', fontFamily:'Roboto,sans-serif',
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {c.product} · {c.time}
              </div>
            </div>
            <span style={{ fontSize:13, fontFamily:'Roboto,sans-serif', fontWeight:700,
              color:'var(--fmn-gold)', flexShrink:0 }}>{c.value}</span>
            <LucideIcon icon="chevron-right" size={14} color="var(--text-3)"/>
          </div>
        ))}
      </div>
      {selected && (
        <div onClick={() => setSelected(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:500,
            display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'var(--app-surface)', border:'1px solid var(--app-border-2)',
              borderRadius:16, padding:'24px', width:360, display:'flex', flexDirection:'column', gap:16,
              boxShadow:'0 20px 60px rgba(0,0,0,.5)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:15, fontFamily:'Roboto,sans-serif', fontWeight:700,
                color:'var(--text-1)' }}>Recuperar Carrinho</span>
              <button onClick={() => setSelected(null)}
                style={{ width:28, height:28, borderRadius:'50%', background:'rgba(255,255,255,.07)',
                  color:'var(--text-2)', display:'flex', alignItems:'center', justifyContent:'center',
                  cursor:'pointer', fontSize:16 }}>×</button>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:'50%', background:selected.color+'22',
                border:`2px solid ${selected.color}44`, display:'flex', alignItems:'center',
                justifyContent:'center', flexShrink:0 }}>
                <span style={{ fontSize:15, fontWeight:700, color:selected.color }}>{selected.init}</span>
              </div>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--text-1)', marginBottom:2 }}>{selected.name}</div>
                <div style={{ fontSize:12, color:'var(--text-3)' }}>{selected.product}</div>
              </div>
              <div style={{ marginLeft:'auto', fontSize:16, fontWeight:900, color:'var(--fmn-gold)' }}>
                {selected.value}
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, padding:'12px', borderRadius:10,
              background:'var(--app-surface-2)', border:'1px solid var(--app-border)' }}>
              {[['E-mail','mail',selected.email],['Telefone','phone',selected.phone]].map(([l,ic,v]) => (
                <div key={l} style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <LucideIcon icon={ic} size={14} color="var(--text-3)"/>
                  <span style={{ fontSize:12, color:'var(--text-2)', fontFamily:'Roboto,sans-serif', flex:1 }}>{v}</span>
                  <button onClick={() => navigator.clipboard.writeText(v)}
                    style={{ padding:'3px 8px', borderRadius:5, background:'rgba(255,255,255,.06)',
                      border:'1px solid var(--app-border)', color:'var(--text-3)', fontSize:10,
                      fontFamily:'Roboto,sans-serif', cursor:'pointer' }}>Copiar</button>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button style={{ flex:1, padding:'10px', borderRadius:8, background:selected.color,
                color:'#fff', fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:12,
                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                <LucideIcon icon="message-circle" size={14}/>WhatsApp
              </button>
              <button style={{ flex:1, padding:'10px', borderRadius:8, background:'rgba(255,255,255,.06)',
                border:'1px solid var(--app-border)', color:'var(--text-1)',
                fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:12,
                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                <LucideIcon icon="mail" size={14}/>E-mail
              </button>
            </div>
            <div style={{ fontSize:11, color:'var(--text-3)', textAlign:'center', fontFamily:'Roboto,sans-serif' }}>
              Dados via Webhook Hotmart · {selected.time}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── LineAreaChart ───────────────────────────────────────────────*/
function LineAreaChart({ data }) {
  const W=560, H=210, mt=12, mb=28, ml=50, mr=10;
  const cW=W-ml-mr, cH=H-mt-mb;
  const [tooltip, setTooltip] = useState(null);

  if (!data.length) return (
    <div style={{ height:H, display:'flex', alignItems:'center', justifyContent:'center',
      color:'var(--text-3)', fontSize:12, fontFamily:'Roboto,sans-serif' }}>
      Sem dados ainda
    </div>
  );

  const allVals = data.flatMap(d => [d.gasto||0, d.fat||0]);
  const rawMax  = Math.max(...allVals, 100);
  const maxV    = Math.ceil(rawMax / 500) * 500 || 1000;
  const fmtTick = v => v >= 1000 ? `${(v/1000).toFixed(v%1000===0?0:1)}k` : String(v);
  const nTicks  = 4;
  const yTicks  = Array.from({length:nTicks+1},(_,i)=>(i/nTicks)*maxV);

  const n = data.length;
  const xPos = i => ml + (n > 1 ? (i/(n-1)) * cW : cW/2);
  const yPos = v => H - mb - Math.max(0, Math.min(v/maxV, 1)) * cH;

  function buildCurve(key) {
    if (n === 1) {
      const px = xPos(0), py = yPos(data[0][key]||0);
      return `M ${px-1} ${py} L ${px+1} ${py}`;
    }
    let d = `M ${xPos(0)} ${yPos(data[0][key]||0)}`;
    for (let i=1; i<n; i++) {
      const x0=xPos(i-1), y0=yPos(data[i-1][key]||0);
      const x1=xPos(i),   y1=yPos(data[i][key]||0);
      const mx = (x0+x1)/2;
      d += ` C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}`;
    }
    return d;
  }

  function buildArea(key) {
    const line = buildCurve(key);
    const last = xPos(n-1);
    return `${line} L ${last} ${H-mb} L ${ml} ${H-mb} Z`;
  }

  // Subconjunto de labels para o eixo X (evita sobreposição)
  const showLabel = i => {
    if (n <= 10) return true;
    const step = Math.ceil(n / 7);
    return i === 0 || i === n-1 || i % step === 0;
  };

  function handleMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = W / rect.width;
    const svgX  = (e.clientX - rect.left) * ratio;
    if (svgX < ml || svgX > W - mr) { setTooltip(null); return; }
    // Encontra o ponto mais próximo no eixo X
    let closest = 0, minDist = Infinity;
    for (let i = 0; i < n; i++) {
      const dist = Math.abs(xPos(i) - svgX);
      if (dist < minDist) { minDist = dist; closest = i; }
    }
    setTooltip({ i: closest, svgX: xPos(closest) });
  }

  const tip = tooltip && data[tooltip.i];

  return (
    <div style={{ position:'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto', display:'block', overflow:'visible' }}
        onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)}>
        <defs>
          <linearGradient id="lcGasto" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="rgba(234,170,65,.28)"/>
            <stop offset="100%" stopColor="rgba(234,170,65,.00)"/>
          </linearGradient>
          <linearGradient id="lcFat" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="rgba(74,222,128,.20)"/>
            <stop offset="100%" stopColor="rgba(74,222,128,.00)"/>
          </linearGradient>
        </defs>

        {/* Grid Y */}
        {yTicks.map(t => {
          const py = yPos(t);
          return (
            <g key={t}>
              <line x1={ml} x2={W-mr} y1={py} y2={py}
                stroke="rgba(255,255,255,.06)" strokeWidth="1"/>
              <text x={ml-6} y={py+4} fontSize="9" fill="rgba(255,255,255,.28)"
                textAnchor="end" fontFamily="Roboto,sans-serif">{fmtTick(t)}</text>
            </g>
          );
        })}

        {/* Áreas */}
        <path d={buildArea('gasto')} fill="url(#lcGasto)"/>
        <path d={buildArea('fat')}   fill="url(#lcFat)"/>

        {/* Linhas */}
        <path d={buildCurve('gasto')} fill="none"
          stroke="rgba(234,170,65,.85)" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round"/>
        <path d={buildCurve('fat')} fill="none"
          stroke="rgba(74,222,128,.80)" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round"/>

        {/* Hairline de hover */}
        {tooltip && (
          <line x1={tooltip.svgX} x2={tooltip.svgX} y1={mt} y2={H-mb}
            stroke="rgba(255,255,255,.2)" strokeWidth="1" strokeDasharray="3 3"/>
        )}

        {/* Dots + labels X */}
        {data.map((d,i) => {
          const isHovered = tooltip && tooltip.i === i;
          return (
            <g key={i}>
              <circle cx={xPos(i)} cy={yPos(d.gasto)} r={isHovered ? 4.5 : (d.gasto > 0 ? 2.5 : 1.5)}
                fill={isHovered ? 'rgba(234,170,65,1)' : (d.gasto > 0 ? 'rgba(234,170,65,.95)' : 'rgba(234,170,65,.2)')}
                stroke="rgba(15,16,19,.9)" strokeWidth={isHovered ? 2 : 1.5}/>
              <circle cx={xPos(i)} cy={yPos(d.fat)} r={isHovered ? 4.5 : (d.fat > 0 ? 2.5 : 1.5)}
                fill={isHovered ? 'rgba(74,222,128,1)' : (d.fat > 0 ? 'rgba(74,222,128,.95)' : 'rgba(74,222,128,.2)')}
                stroke="rgba(15,16,19,.9)" strokeWidth={isHovered ? 2 : 1.5}/>
              {showLabel(i) && (
                <text x={xPos(i)} y={H-8} fontSize="9" fill="rgba(255,255,255,.35)"
                  textAnchor="middle" fontFamily="Roboto,sans-serif">{d.label}</text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip flutuante */}
      {tip && (() => {
        const rect_pct = (tooltip.svgX / W) * 100;
        const alignRight = rect_pct > 65;
        return (
          <div style={{ position:'absolute', top:mt, pointerEvents:'none', zIndex:20,
            left: alignRight ? undefined : `calc(${rect_pct}% + 12px)`,
            right: alignRight ? `calc(${100-rect_pct}% + 12px)` : undefined,
            background:'rgba(15,16,19,.95)', border:'1px solid rgba(255,255,255,.12)',
            borderRadius:8, padding:'8px 12px', whiteSpace:'nowrap',
            boxShadow:'0 4px 16px rgba(0,0,0,.5)' }}>
            <div style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
              color:'var(--text-3)', marginBottom:6, letterSpacing:'0.06em' }}>
              {tip.label}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ width:8, height:2, borderRadius:1, background:'rgba(234,170,65,.9)', display:'inline-block' }}/>
                <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'var(--text-2)' }}>Gasto</span>
                <span style={{ fontSize:13, fontFamily:'Roboto,sans-serif', fontWeight:700,
                  color:'rgba(234,170,65,.95)', marginLeft:'auto', paddingLeft:16 }}>
                  {fmtCur(tip.gasto)}
                </span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ width:8, height:2, borderRadius:1, background:'rgba(74,222,128,.9)', display:'inline-block' }}/>
                <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'var(--text-2)' }}>Faturamento</span>
                <span style={{ fontSize:13, fontFamily:'Roboto,sans-serif', fontWeight:700,
                  color:'rgba(74,222,128,.95)', marginLeft:'auto', paddingLeft:16 }}>
                  {fmtCur(tip.fat)}
                </span>
              </div>
              {tip.gasto > 0 && tip.fat > 0 && (
                <div style={{ borderTop:'1px solid rgba(255,255,255,.08)', marginTop:2, paddingTop:4,
                  display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', color:'var(--text-3)' }}>ROAS</span>
                  <span style={{ fontSize:12, fontFamily:'Roboto,sans-serif', fontWeight:700,
                    color: tip.fat/tip.gasto >= 2 ? 'var(--clr-pos)' : tip.fat/tip.gasto >= 1 ? 'var(--fmn-gold)' : 'var(--clr-neg)',
                    marginLeft:'auto' }}>
                    {(tip.fat/tip.gasto).toFixed(2)}x
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ── AdsRanking com drag-to-reorder ─────────────────────────────*/
const RANKING_ORDER_KEY = 'fmn-ranking-order';

function AdsRanking({ ads, onNavigate }) {
  const CPA_LIMIT = 207.90;
  const statusColor = {
    'fazendo-teste':       '#3b82f6',
    'fazendo-recorrencia': '#8b5cf6',
    'fazendo-producao':    '#22c55e',
    'feito-otimo':         '#f59e0b',
    'feito-mediano':       '#94a3b8',
    'feito-ruim':          '#ef4444',
    'fazer':               '#475569',
  };
  const cpaColor = cpa => !cpa ? 'var(--text-3)' : cpa <= CPA_LIMIT * 0.7 ? 'var(--clr-pos)' : cpa <= CPA_LIMIT ? 'var(--fmn-gold)' : 'var(--clr-neg)';

  // Carrega ordem salva no localStorage
  const [orderedAds, setOrderedAds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(RANKING_ORDER_KEY) || '[]');
      if (!saved.length) return ads;
      const indexed = Object.fromEntries(ads.map(a => [a.numero, a]));
      const sorted = saved.map(n => indexed[n]).filter(Boolean);
      const rest = ads.filter(a => !saved.includes(a.numero));
      return [...sorted, ...rest];
    } catch { return ads; }
  });

  // Sync quando ads mudar: respeita a ordem nova (sort do pai) se mudou por rankingSort
  useEffect(() => {
    setOrderedAds(ads);
  }, [ads]);

  const dragRef = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  function handleDragStart(e, numero) {
    dragRef.current = numero;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(numero));
  }
  function handleDragOver(e, numero) {
    e.preventDefault();
    if (dragRef.current !== numero) setDragOver(numero);
  }
  function handleDrop(e, targetNumero) {
    e.preventDefault();
    const from = dragRef.current;
    if (from === targetNumero) return;
    setOrderedAds(prev => {
      const next = [...prev];
      const fi = next.findIndex(a => a.numero === from);
      const ti = next.findIndex(a => a.numero === targetNumero);
      const [item] = next.splice(fi, 1);
      next.splice(ti, 0, item);
      localStorage.setItem(RANKING_ORDER_KEY, JSON.stringify(next.map(a => a.numero)));
      return next;
    });
    setDragOver(null);
    dragRef.current = null;
  }
  function handleDragEnd() {
    setDragOver(null);
    dragRef.current = null;
  }
  function resetOrder() {
    localStorage.removeItem(RANKING_ORDER_KEY);
    setOrderedAds(ads);
  }

  const hasCustomOrder = (() => {
    try { return (JSON.parse(localStorage.getItem(RANKING_ORDER_KEY) || '[]')).length > 0; } catch { return false; }
  })();

  if (!ads || ads.length === 0) return <EmptyState icon="bar-chart-2" label="Nenhum AD com gasto registrado"/>;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
      {/* header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
        padding:'0 8px 8px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'20px 36px 36px 1fr 70px 70px 72px 72px 90px',
          gap:8, alignItems:'center', flex:1 }}>
          <div/>
          {['#','','Criativo','Tipo','Status','Gasto','Vendas','CPA'].map((h,i) => (
            <span key={i} style={{ fontSize:9.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
              letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-3)',
              textAlign: i >= 5 ? 'right' : 'left' }}>{h}</span>
          ))}
        </div>
        {hasCustomOrder && (
          <button onClick={resetOrder}
            title="Restaurar ordem por gasto"
            style={{ fontSize:9.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
              color:'var(--text-3)', background:'none', border:'1px solid var(--app-border)',
              cursor:'pointer', padding:'3px 8px', borderRadius:4, marginLeft:8, flexShrink:0,
              letterSpacing:'0.04em', textTransform:'uppercase' }}>
            resetar ordem
          </button>
        )}
      </div>
      {orderedAds.map((ad, i) => (
        <div key={ad.numero}
          draggable="true"
          onDragStart={e => handleDragStart(e, ad.numero)}
          onDragOver={e => handleDragOver(e, ad.numero)}
          onDrop={e => handleDrop(e, ad.numero)}
          onDragEnd={handleDragEnd}
          onClick={() => onNavigate && onNavigate('criativos', ad.numero)}
          title={`Arraste para reordenar · Clique para abrir ADS ${ad.numero}`}
          style={{ display:'grid', gridTemplateColumns:'20px 36px 36px 1fr 70px 70px 72px 72px 90px',
            padding:'8px', gap:8, borderRadius:8, alignItems:'center', cursor:'grab',
            userSelect:'none', WebkitUserSelect:'none',
            background: dragOver === ad.numero
              ? 'rgba(234,170,65,.12)'
              : i % 2 === 0 ? 'rgba(255,255,255,.02)' : 'transparent',
            outline: dragOver === ad.numero ? '1px solid rgba(234,170,65,.4)' : 'none',
            transition:'background 100ms, outline 100ms' }}
          onMouseEnter={e => { if (dragOver !== ad.numero) e.currentTarget.style.background = 'rgba(255,255,255,.05)'; }}
          onMouseLeave={e => { if (dragOver !== ad.numero) e.currentTarget.style.background = i % 2 === 0 ? 'rgba(255,255,255,.02)' : 'transparent'; }}>
          {/* drag handle */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', opacity:.25, cursor:'grab' }}>
            <LucideIcon icon="grip-vertical" size={12}/>
          </div>
          {/* numero */}
          <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', fontWeight:700,
            color:'var(--text-3)' }}>{ad.numero}</span>
          {/* thumbnail */}
          <div style={{ width:32, height:32, borderRadius:6, overflow:'hidden',
            background:'var(--app-surface-2)', flexShrink:0, position:'relative',
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            {ad.thumbUrl
              ? <img src={ad.thumbUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
                  onError={e => {
                    e.target.style.display='none';
                    e.target.nextSibling && (e.target.nextSibling.style.display='flex');
                  }}/>
              : null}
            <div style={{ display: ad.thumbUrl ? 'none' : 'flex', width:'100%', height:'100%',
              alignItems:'center', justifyContent:'center', opacity:.3, position:'absolute', top:0, left:0 }}>
              <LucideIcon icon="image" size={14}/>
            </div>
          </div>
          {/* titulo */}
          <span style={{ fontSize:12, fontFamily:'Roboto,sans-serif', color:'var(--text-1)',
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}
            title={ad.titulo}>{ad.titulo}</span>
          {/* tipo */}
          <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
            color:'var(--text-3)', textTransform:'capitalize' }}>{ad.tipo || '—'}</span>
          {/* status */}
          <span style={{ fontSize:9.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
            color: statusColor[ad.status] || 'var(--text-3)',
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}
            title={ad.status}>{ad.status?.replace('fazendo-','').replace('feito-','') || '—'}</span>
          {/* gasto */}
          <span style={{ fontSize:12, fontFamily:'Roboto,sans-serif', fontWeight:700,
            color:'var(--fmn-gold)', textAlign:'right' }}>
            {fmtCur(ad.gasto)}
          </span>
          {/* vendas */}
          <span style={{ fontSize:13, fontFamily:'Roboto,sans-serif', fontWeight:700,
            color:'var(--text-1)', textAlign:'right' }}>{ad.vendas}</span>
          {/* cpa */}
          <span style={{ fontSize:12.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
            color: cpaColor(ad.cpa), textAlign:'right' }}>
            {ad.cpa ? fmtCur(ad.cpa) : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── BreakdownTable ──────────────────────────────────────────────*/
function BreakdownTable({ rows, margem }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
      {rows.map((row,i) => (
        <div key={i}>
          {row.separator && <div style={{ height:1, background:'var(--app-border)', margin:'6px 0' }}/>}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0' }}>
            <span style={{ fontSize:12.5, fontFamily:'Roboto,sans-serif',
              color:row.bold?'var(--text-1)':'var(--text-2)', fontWeight:row.bold?700:400 }}>{row.label}</span>
            <span style={{ fontSize:row.bold?14:12.5, fontFamily:'Roboto,sans-serif',
              fontWeight:row.bold?900:500, color:row.color||'var(--text-1)', letterSpacing:'-0.01em' }}>
              {fmt(row.value)}
            </span>
          </div>
        </div>
      ))}
      {margem !== undefined && (
        <div style={{ marginTop:8, padding:'7px 12px', borderRadius:8,
          background:'rgba(74,222,128,.08)', border:'1px solid rgba(74,222,128,.15)',
          display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', fontWeight:700,
            letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--clr-pos)' }}>Margem líquida</span>
          <span style={{ fontSize:14, fontFamily:'Roboto,sans-serif', fontWeight:900, color:'var(--clr-pos)' }}>{margem.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

/* ── WeeklySalesChart ────────────────────────────────────────────*/
function WeeklySalesChart({ data }) {
  const maxV = Math.max(...data.map(d => d.sales), 1);
  const W=300, H=100, mb=20, mt=18, cH=H-mb-mt, bW=24, grpW=W/data.length;
  const hasToday = data.some(d => d.dimmed === true);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto', display:'block', overflow:'visible' }}>
      {data.map((d,i) => {
        const cx = i*grpW+grpW/2;
        const bH = Math.max((d.sales/maxV)*cH, 2);
        const isBest = !hasToday && d.sales === maxV;
        const isToday = hasToday && !d.dimmed;
        const active = isBest || isToday;
        const opacity = d.dimmed ? 0.2 : 1;
        return (
          <g key={i} opacity={opacity}>
            <rect x={cx-bW/2} y={H-mb-bH} width={bW} height={bH}
              fill={active ? 'rgba(234,170,65,.8)' : 'rgba(234,170,65,.3)'} rx="3"/>
            <text x={cx} y={H-mb-bH-4} fontSize="8.5"
              fill={active ? 'rgba(234,170,65,.9)' : 'rgba(255,255,255,.4)'}
              textAnchor="middle" fontFamily="Roboto,sans-serif" fontWeight="700">{d.sales}</text>
            <text x={cx} y={H-6} fontSize="8.5" fill={isToday ? 'rgba(234,170,65,.8)' : 'rgba(255,255,255,.35)'}
              textAnchor="middle" fontFamily="Roboto,sans-serif" fontWeight={isToday ? '700' : '400'}>{d.day}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── SalesByPeriod ───────────────────────────────────────────────*/
function SalesByPeriod({ data }) {
  const maxV=Math.max(...data.values.flat());
  const heatColor=v=>`rgba(52,211,153,${(0.08+(v/maxV)*0.72).toFixed(2)})`;
  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'60px repeat(7,1fr)', gap:3, marginBottom:3 }}>
        <div/>
        {data.cols.map(c=>(
          <div key={c} style={{ textAlign:'center', fontSize:9.5, fontFamily:'Roboto,sans-serif',
            fontWeight:700, letterSpacing:'0.04em', color:'var(--text-3)', paddingBottom:2 }}>{c}</div>
        ))}
      </div>
      {data.rows.map((row,ri) => (
        <div key={ri} style={{ display:'grid', gridTemplateColumns:'60px repeat(7,1fr)', gap:3, marginBottom:3 }}>
          <div style={{ display:'flex', flexDirection:'column', justifyContent:'center' }}>
            <div style={{ fontSize:9.5, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-2)' }}>{row}</div>
            <div style={{ fontSize:8.5, fontFamily:'Roboto,sans-serif', color:'var(--text-3)' }}>{data.subs[ri]}</div>
          </div>
          {data.values[ri].map((v,ci) => (
            <div key={ci} style={{ height:26, borderRadius:5, background:heatColor(v),
              border:'1px solid rgba(52,211,153,.1)', display:'flex', alignItems:'center',
              justifyContent:'center', fontSize:9, fontFamily:'Roboto,sans-serif', fontWeight:700,
              color:v>50?'rgba(255,255,255,.8)':'rgba(255,255,255,.35)' }}>{v}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Hook: vendas recentes com atribuição ────────────────────────*/
function playBell() {
  try {
    const audio = new Audio('sounds/sino.m4a');
    audio.volume = 0.75;
    audio.play().catch(() => {});
  } catch(e) {}
}

function notifyNewSale(sale) {
  playBell();
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    const n = new Notification('Nova venda registrada', {
      body: '+' + fmtCur(sale.valor_bruto) + (sale.produto_nome ? ' · ' + sale.produto_nome : ''),
      silent: true,
    });
    setTimeout(() => n.close(), 6000);
  }
}

function useRecentSales(limit = 10) {
  const [sales, setSales] = useState([]);
  const prevIds = React.useRef(new Set());

  useEffect(() => {
    // Pedir permissão de notificação uma vez
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    if (!window.db) return;

    async function load(isUpdate) {
      const { data: rows } = await window.db
        .from('vendas')
        .select('id,hotmart_transaction_id,valor_bruto,status,created_at,utm_source,utm_medium,utm_campaign,utm_content,meta_ad_id,ads_numero,produto_nome,hotmart_event,comprador_nome,comprador_telefone,parcelas,metodo_pagamento')
        .in('status', ['aprovada','reembolsada','recuperacao'])
        .order('created_at', { ascending: false })
        .limit(limit);
      if (!rows) return;

      // Notificar vendas novas aprovadas
      if (isUpdate) {
        rows.filter(r => r.status === 'aprovada' && !prevIds.current.has(r.id))
          .forEach(r => notifyNewSale(r));
      }
      prevIds.current = new Set(rows.map(r => r.id));

      // Buscar títulos e thumbnails dos ADS vinculados. Venda sem ads_numero
      // mas com meta_ad_id (comum em vendas recuperadas via backfill, que não
      // tinham essa resolução) ainda dá pra achar o criativo pelo meta_ad_id —
      // sem isso o card mostra a campanha/conjunto em vez do anúncio certo.
      const nums = [...new Set(rows.filter(r => r.ads_numero).map(r => r.ads_numero))];
      const semNumero = rows.filter(r => !r.ads_numero && r.meta_ad_id);
      const metaIds = [...new Set(semNumero.map(r => r.meta_ad_id))];

      let adsMap = {};
      if (nums.length) {
        const { data: adsRows } = await window.db
          .from('ads').select('numero,titulo,media_drive_url').in('numero', nums);
        adsMap = Object.fromEntries((adsRows||[]).map(a => [a.numero, a]));
      }
      let metaIdMap = {};
      if (metaIds.length) {
        const { data: adsRows } = await window.db
          .from('ads').select('numero,titulo,media_drive_url,meta_ad_id').in('meta_ad_id', metaIds);
        metaIdMap = Object.fromEntries((adsRows||[]).map(a => [a.meta_ad_id, a]));
        // Corrige a venda de vez (evita recalcular isso toda hora e ajuda
        // qualquer outra tela que dependa de ads_numero).
        const patches = semNumero
          .map(r => ({ id: r.id, numero: metaIdMap[r.meta_ad_id]?.numero }))
          .filter(p => p.numero != null);
        for (const p of patches) {
          window.db.from('vendas').update({ ads_numero: p.numero }).eq('id', p.id).then(() => {});
        }
      }

      setSales(rows.map(r => {
        const resolved = r.ads_numero ? adsMap[r.ads_numero] : metaIdMap[r.meta_ad_id];
        const resolvedNum = r.ads_numero || metaIdMap[r.meta_ad_id]?.numero || null;
        return {
          ...r,
          ads_numero: resolvedNum,
          ads_titulo: resolved?.titulo || null,
          ads_thumb:  resolved?.media_drive_url ? `thumbnails/${resolvedNum}.jpg` : null,
        };
      }));
    }

    load(false);
    const ch = window.db.channel('recent-sales-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendas' }, () => load(true))
      .subscribe();
    return () => window.db.removeChannel(ch);
  }, [limit]);
  return sales;
}

/* ── Classificação de origem ─────────────────────────────────────*/
const ORIGEM_CONFIG = {
  'Meta Ads':   { color: '#0099ff', bg: 'rgba(0,153,255,.12)',   icon: 'zap' },
  'Instagram':  { color: '#e1306c', bg: 'rgba(225,48,108,.12)',  icon: 'instagram' },
  'WhatsApp':   { color: '#25d366', bg: 'rgba(37,211,102,.12)',  icon: 'message-circle' },
  'YouTube':    { color: '#ff4040', bg: 'rgba(255,64,64,.10)',   icon: 'youtube' },
  'E-mail':     { color: '#f59e0b', bg: 'rgba(245,158,11,.12)',  icon: 'mail' },
  'Google Ads': { color: '#34a853', bg: 'rgba(52,168,83,.12)',   icon: 'search' },
  'TikTok':     { color: '#69c9d0', bg: 'rgba(105,201,208,.12)', icon: 'music' },
  'Facebook':   { color: '#1877f2', bg: 'rgba(24,119,242,.12)',  icon: 'facebook' },
  'Site':       { color: '#8b5cf6', bg: 'rgba(139,92,246,.12)',  icon: 'globe' },
  'Direto':     { color: '#94a3b8', bg: 'rgba(148,163,184,.08)', icon: 'link' },
  'Sem rastreio (webhook falhou)': { color: '#f59e0b', bg: 'rgba(245,158,11,.10)', icon: 'alert-triangle' },
  'Outros':     { color: '#64748b', bg: 'rgba(100,116,139,.08)', icon: 'help-circle' },
};

function classifyOrigin(sale) {
  if (sale.meta_ad_id) return 'Meta Ads';
  const s = (sale.utm_source || '').toLowerCase();
  // hotmart-sync (backfill) só grava quando o webhook em tempo real perdeu a
  // venda — nesse caso a Hotmart não devolve o sck (tracking), então não dá
  // pra saber a origem real. Diferente de "Direto" (alguém digitou a URL).
  if (!s && (sale.hotmart_event || '').startsWith('SYNC_')) return 'Sem rastreio (webhook falhou)';
  if (!s) return 'Direto';
  if (s.includes('whatsapp') || s.includes('wpp') || s.includes('zap')) return 'WhatsApp';
  if (s.includes('instagram') || s === 'ig')                             return 'Instagram';
  if (s.includes('youtube') || s === 'yt')                               return 'YouTube';
  if (s.includes('tiktok') || s === 'tt')                                return 'TikTok';
  if (s.includes('facebook') || s === 'fb' || s.includes('meta'))        return 'Facebook';
  if (s.includes('google') || s.includes('gads'))                        return 'Google Ads';
  if (s.includes('email') || s.includes('mail'))                         return 'E-mail';
  if (s.includes('site') || s.includes('blog') || s.includes('organic')) return 'Site';
  return normalizeSource(sale.utm_source) || 'Outros';
}

/* ── Contexto via UTM ────────────────────────────────────────────*/
// Lê utm_medium (mais confiável) e depois utm_campaign/content como fallback.
// Retorna { label, icon } ou null.
const UTM_MEDIUM_MAP = [
  [/^stories$/i,                        { label: 'Stories',          icon: 'play-circle'    }],
  [/^(bio|linkinbio|link_bio)$/i,       { label: 'Link na Bio',      icon: 'link-2'         }],
  [/^(dm|direct_message|direct_msg)$/i, { label: 'Mensagem Direta',  icon: 'message-square' }],
  [/^(whatsapp|wpp|zap)$/i,             { label: 'WhatsApp',         icon: 'message-circle' }],
  [/^(email|newsletter|e-mail)$/i,      { label: 'Email',            icon: 'mail'           }],
  [/^(cpc|paid|paidsocial|paid_social)$/i, { label: 'Tráfego Pago', icon: 'zap'            }],
  [/^organic$/i,                        { label: 'Orgânico',         icon: 'search'         }],
  [/^referral$/i,                       { label: 'Indicação',        icon: 'share-2'        }],
  [/^(social|post)$/i,                  { label: 'Post Orgânico',    icon: 'hash'           }],
  [/^(reel|reels)$/i,                   { label: 'Reels',            icon: 'film'           }],
];

function isTextoLegivel(v) {
  if (!v || typeof v !== 'string') return false;
  const t = v.trim();
  if (t.length < 2 || t.length > 80) return false;
  if (/^\d+$/.test(t)) return false;
  if (/^[a-f0-9-]{16,}$/i.test(t)) return false;
  if (/^[A-Z0-9_]{12,}$/.test(t)) return false;
  if (/[A-Z]{4,}\d{6,}/.test(t)) return false;
  return true;
}

function buildContexto(sale) {
  if (sale.ads_numero) return null; // coluna ADS já cuida
  const medium   = (sale.utm_medium   || '').trim();
  const source   = (sale.utm_source   || '').trim().toLowerCase();
  const campaign = sale.utm_campaign;
  const content  = sale.utm_content;

  // 1. utm_medium → rótulo semântico
  for (const [re, ctx] of UTM_MEDIUM_MAP) {
    if (re.test(medium)) return ctx;
  }
  // utm_source pode conter "whatsapp" quando medium não está preenchido
  if (/whatsapp|wpp/.test(source)) return { label: 'WhatsApp', icon: 'message-circle' };

  // 2. utm_campaign ou utm_content legíveis como fallback
  const textoCamp = isTextoLegivel(campaign) ? campaign.trim().replace(/_/g,' ') : null;
  const textoCtnt = isTextoLegivel(content)  ? content.trim().replace(/_/g,' ')  : null;
  const texto = textoCamp || textoCtnt;
  if (texto) return { label: texto, icon: 'tag' };

  return null;
}

/* ── RecentSalesFeed ─────────────────────────────────────────────*/
function RecentSalesFeed({ sales }) {
  if (!sales.length) return <EmptyState icon="shopping-cart" label="Nenhuma venda registrada"/>;

  const fmtDt = iso => {
    if (!iso) return '—';
    const d = new Date(iso);
    const hoje = new Date();
    const isHoje = d.toDateString() === hoje.toDateString();
    if (isHoje) return `Hoje ${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
    return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})
      + ' ' + d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  };

  // Colunas: Data | Valor | Tipo | Origem | Contexto | Comprador | Produto | WA
  const COLS = '104px 110px 80px 110px 1.4fr 1.3fr 1.6fr 34px';

  const HEADERS = ['Data','Valor','Tipo','Origem','Contexto','Comprador','Produto',''];

  const fmtMetodo = (metodo, parcelas) => {
    if (!metodo) return null;
    const m = metodo.toLowerCase();
    if (m.includes('pix')) return 'Pix';
    if (m.includes('billet') || m.includes('boleto')) return 'Boleto';
    if (m.includes('credit') || m.includes('card') || m.includes('cart')) {
      return parcelas && parcelas > 1 ? `${parcelas}x cartão` : 'Cartão';
    }
    if (m.includes('paypal')) return 'PayPal';
    if (m.includes('apple')) return 'Apple Pay';
    return null;
  };

  return (
    <div style={{ width:'100%' }}>
      <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
        {/* cabeçalho */}
        <div style={{ display:'grid', gridTemplateColumns:COLS, gap:8, padding:'0 8px 8px' }}>
          {HEADERS.map((h,i) => (
            <span key={i} style={{ fontSize:9.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
              letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-3)' }}>{h}</span>
          ))}
        </div>

        {sales.map((sale, i) => {
          const origem    = classifyOrigin(sale);
          const cfg       = ORIGEM_CONFIG[origem] || ORIGEM_CONFIG['Outros'];
          const isReemb   = sale.status === 'reembolsada';
          const isRecup   = sale.status === 'recuperacao';
          const tipoLabel = isReemb ? 'Reembolso' : isRecup ? 'Recuperação' : 'Venda';
          const tipoColor = isReemb ? 'var(--clr-neg)' : isRecup ? 'var(--clr-warn)' : 'var(--clr-pos)';
          const tipoBg    = isReemb ? 'rgba(239,68,68,.10)' : isRecup ? 'rgba(245,158,11,.10)' : 'rgba(34,197,94,.10)';
          const ctx       = buildContexto(sale);
          const waPhone   = sale.comprador_telefone ? sale.comprador_telefone.replace(/\D/g,'') : null;
          const pagamento = fmtMetodo(sale.metodo_pagamento, sale.parcelas);
          const waName    = sale.comprador_nome || '';

          return (
            <div key={sale.id}
              style={{ display:'grid', gridTemplateColumns:COLS, gap:8,
                padding:'8px', borderRadius:8, alignItems:'center',
                background: i % 2 === 0 ? 'rgba(255,255,255,.02)' : 'transparent',
                opacity: isReemb ? 0.65 : 1 }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.05)'}
              onMouseLeave={e => e.currentTarget.style.background = i%2===0?'rgba(255,255,255,.02)':'transparent'}>

              {/* data */}
              <span style={{ fontSize:11.5, fontFamily:'Roboto,sans-serif', color:'var(--text-3)' }}>
                {fmtDt(sale.created_at)}
              </span>

              {/* valor + método */}
              <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                <span style={{ fontSize:13, fontFamily:'Roboto,sans-serif', fontWeight:700,
                  color: isReemb ? 'var(--clr-neg)' : isRecup ? 'var(--clr-warn)' : 'var(--clr-pos)' }}>
                  {isReemb ? '–' : '+'}{fmtCur(sale.valor_bruto)}
                </span>
                {pagamento && (
                  <span style={{ fontSize:9.5, fontFamily:'Roboto,sans-serif', color:'var(--text-3)' }}>
                    {pagamento}
                  </span>
                )}
              </div>

              {/* tipo — badge */}
              <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
                padding:'3px 8px', borderRadius:999, background:tipoBg,
                border:`1px solid ${tipoColor}30`, width:'fit-content' }}>
                <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
                  color:tipoColor, whiteSpace:'nowrap' }}>{tipoLabel}</span>
              </span>

              {/* origem com ícone */}
              <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 8px',
                borderRadius:999, background:cfg.bg, border:`1px solid ${cfg.color}30`, width:'fit-content' }}>
                <LucideIcon icon={cfg.icon} size={10} color={cfg.color}/>
                <span style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
                  color:cfg.color, whiteSpace:'nowrap' }}>{origem}</span>
              </span>

              {/* contexto: ADS (thumb+nome) ou UTM semântico */}
              <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
                {sale.ads_numero ? (
                  <>
                    <div style={{ width:30, height:30, borderRadius:6, overflow:'hidden', flexShrink:0,
                      background:'var(--app-surface-2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {sale.ads_thumb
                        ? <img src={sale.ads_thumb} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
                            onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}/>
                        : null}
                      <span style={{ display: sale.ads_thumb ? 'none' : 'flex', fontSize:9,
                        color:'var(--text-3)', fontFamily:'Roboto,sans-serif', fontWeight:700 }}>
                        #{sale.ads_numero}
                      </span>
                    </div>
                    <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'var(--text-2)',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
                      title={sale.ads_titulo || ('ADS ' + sale.ads_numero)}>
                      {sale.ads_titulo || `ADS ${sale.ads_numero}`}
                    </span>
                  </>
                ) : ctx ? (
                  <span style={{ display:'inline-flex', alignItems:'center', gap:5, minWidth:0 }}>
                    <LucideIcon icon={ctx.icon} size={11} color="var(--text-3)"/>
                    <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'var(--text-2)',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
                      title={ctx.label}>{ctx.label}</span>
                  </span>
                ) : (
                  <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'var(--text-3)' }}>—</span>
                )}
              </div>

              {/* comprador */}
              <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'var(--text-2)',
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
                title={waName || ''}>
                {waName ? waName.split(' ').slice(0,2).join(' ') : '—'}
              </span>

              {/* produto */}
              <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'var(--text-2)',
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
                title={sale.produto_nome}>{sale.produto_nome || '—'}</span>

              {/* botão WhatsApp */}
              {waPhone ? (
                <a href={`https://wa.me/55${waPhone}?text=${encodeURIComponent(`Olá${waName ? ' ' + waName.split(' ')[0] : ''}! Obrigado pela sua compra.`)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display:'flex', alignItems:'center', justifyContent:'center',
                    width:30, height:30, borderRadius:7, flexShrink:0,
                    background:'rgba(37,211,102,.12)', border:'1px solid rgba(37,211,102,.25)',
                    cursor:'pointer', textDecoration:'none' }}
                  title={`Enviar WhatsApp para ${waName || waPhone}`}>
                  <LucideIcon icon="message-circle" size={14} color="#25d366"/>
                </a>
              ) : (
                <div style={{ width:30, height:30 }}/>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Dicas ───────────────────────────────────────────────────────*/
function Dicas({ data }) {
  const CPA_LIMIT  = 207.90;
  const CPA_ESCALA = CPA_LIMIT * 0.7;   // R$145,53 — zona de escala
  const MARGEM_BOA = 40;
  const MARGEM_MIN = 20;
  const REIMB_WARN = 3;
  const REIMB_CRIT = 5;
  const ROAS_MIN   = 1.5;

  const fat        = data?.fat         || 0;
  const lucro      = data?.lucro       || 0;
  const gasto      = data?.gasto       || 0;
  const margem     = data?.margem      || 0;
  const reimb      = data?.reimb       || 0;
  const cpaMedio   = data?.cpaMedio    || null;
  const adsRanking = data?.adsRanking  || [];
  const funnel     = data?.funnelSteps || null;

  if (!data || fat === 0) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      padding:'24px 0', color:'var(--text-3)' }}>
      <span style={{ fontSize:12, fontFamily:'Roboto,sans-serif' }}>
        Sem dados no período selecionado.
      </span>
    </div>
  );

  // ── Montar lista de dicas com prioridade ────────────────────────
  const dicas = [];

  // 1. ROAS
  const roas = gasto > 0 ? fat / gasto : null;
  if (roas !== null) {
    if (roas >= 3) {
      dicas.push({ tipo:'pos', icon:'trending-up',
        texto: `ROAS de ${roas.toFixed(2)}x — cada R$1 investido está retornando R$${roas.toFixed(2)}. Considere aumentar o orçamento nos ADs com melhor CPA.` });
    } else if (roas >= ROAS_MIN) {
      dicas.push({ tipo:'warn', icon:'trending-up',
        texto: `ROAS de ${roas.toFixed(2)}x — sustentável, mas há espaço para melhorar. Revise criativos dos ADs com CPA acima de ${fmtCur(CPA_LIMIT * 0.8)}.` });
    } else {
      dicas.push({ tipo:'neg', icon:'trending-down',
        texto: `ROAS de ${roas.toFixed(2)}x — abaixo do mínimo saudável (1,5x). O gasto de ${fmtCur(gasto)} está consumindo mais do que gerando. Pause os ADs com CPA acima do limite imediatamente.` });
    }
  }

  // 2. CPA médio
  if (cpaMedio) {
    if (cpaMedio <= CPA_ESCALA) {
      dicas.push({ tipo:'pos', icon:'target',
        texto: `CPA médio de ${fmtCur(cpaMedio)} — bem abaixo do limite de ${fmtCur(CPA_LIMIT)}. Zona de escala: aumente o orçamento com segurança.` });
    } else if (cpaMedio <= CPA_LIMIT) {
      dicas.push({ tipo:'warn', icon:'target',
        texto: `CPA médio de ${fmtCur(cpaMedio)} — dentro do limite (${fmtCur(CPA_LIMIT)}), mas próximo do teto. Monitore diariamente para não ultrapassar.` });
    } else {
      dicas.push({ tipo:'neg', icon:'target',
        texto: `CPA médio de ${fmtCur(cpaMedio)} — acima do limite de ${fmtCur(CPA_LIMIT)}. Cada venda está custando mais do que deveria. Pause os ADs com CPA mais alto agora.` });
    }
  }

  // 3. Margem
  if (margem >= MARGEM_BOA) {
    dicas.push({ tipo:'pos', icon:'percent',
      texto: `Margem de ${margem.toFixed(1)}% — saudável. O negócio está gerando ${fmtCur(lucro)} de lucro real após impostos, gasto e despesas.` });
  } else if (margem >= MARGEM_MIN) {
    dicas.push({ tipo:'warn', icon:'percent',
      texto: `Margem de ${margem.toFixed(1)}% — aceitável, mas abaixo dos 40% ideais. Verifique se há despesas recorrentes que podem ser cortadas ou renegociadas.` });
  } else if (margem > 0) {
    dicas.push({ tipo:'neg', icon:'percent',
      texto: `Margem de ${margem.toFixed(1)}% — baixa. Abaixo de 20% o negócio fica vulnerável a qualquer oscilação. Reduza gasto ou aumente o ticket médio.` });
  } else {
    dicas.push({ tipo:'neg', icon:'percent',
      texto: `Margem negativa (${margem.toFixed(1)}%) — o negócio está no prejuízo neste período. Revise gasto em anúncios e despesas com urgência.` });
  }

  // 4. Reembolsos
  const reimbRate = fat > 0 ? (reimb / fat) * 100 : 0;
  if (reimb > 0) {
    if (reimbRate >= REIMB_CRIT) {
      dicas.push({ tipo:'neg', icon:'rotate-ccw',
        texto: `Taxa de reembolso em ${reimbRate.toFixed(1)}% — crítica (acima de 5%). Isso indica problema na entrega do produto ou expectativa não atendida. Investigue os motivos.` });
    } else if (reimbRate >= REIMB_WARN) {
      dicas.push({ tipo:'warn', icon:'rotate-ccw',
        texto: `Taxa de reembolso em ${reimbRate.toFixed(1)}% — atenção. Entre 3% e 5% é o limite. Monitore para não escalar.` });
    }
  }

  // 5. AD para escalar
  const adEscala = adsRanking.find(a => a.cpa && a.cpa <= CPA_ESCALA && a.vendas >= 3);
  if (adEscala) {
    dicas.push({ tipo:'pos', icon:'zap',
      texto: `AD #${adEscala.numero} com CPA de ${fmtCur(adEscala.cpa)} e ${adEscala.vendas} vendas — candidato ideal para escalar. Duplique o orçamento e observe por 3 dias.` });
  }

  // 6. ADs acima do limite para pausar
  const adsPausar = adsRanking.filter(a => a.cpa && a.cpa > CPA_LIMIT && a.gasto > 50);
  if (adsPausar.length > 0) {
    const lista = adsPausar.map(a => `#${a.numero} (${fmtCur(a.cpa)})`).join(', ');
    dicas.push({ tipo:'neg', icon:'pause-circle',
      texto: `${adsPausar.length > 1 ? `ADs ${lista} estão` : `AD ${lista} está`} com CPA acima do limite. Pause ou troque o criativo antes de continuar investindo.` });
  }

  // 7. Funil — gargalo
  if (funnel && funnel.length >= 3) {
    const lp   = funnel[1]; // Visualizações de Página
    const ic   = funnel[2]; // Início de Compra
    const comp = funnel[3]; // Vendas
    if (lp && lp.pct < 40) {
      dicas.push({ tipo:'warn', icon:'filter',
        texto: `Apenas ${lp.pct}% dos cliques chegam à página. A maioria está saindo antes mesmo de ver a oferta — revise velocidade de carregamento e coerência entre o anúncio e a página.` });
    } else if (ic && ic.pct < 5) {
      dicas.push({ tipo:'warn', icon:'filter',
        texto: `Só ${ic.pct}% dos visitantes iniciam a compra. A página está recebendo tráfego mas não convence — revise headline, preço e CTA.` });
    } else if (comp && comp.pct < 1) {
      dicas.push({ tipo:'warn', icon:'filter',
        texto: `Taxa de conversão final de ${comp.pct}% — muito abaixo do esperado (>1%). O maior gargalo está no checkout. Verifique se está funcionando e se o preço está alinhado.` });
    }
  }

  // 8. Sem ADs com venda
  const adsComVenda = adsRanking.filter(a => a.vendas > 0);
  if (adsRanking.length > 0 && adsComVenda.length === 0) {
    dicas.push({ tipo:'warn', icon:'bar-chart-2',
      texto: `Nenhum AD registrou venda no período selecionado. Verifique se o pixel está disparando corretamente ou mude o período de análise.` });
  }

  const COR = {
    pos:  { color:'var(--clr-pos)',  bg:'rgba(74,222,128,.08)',  border:'rgba(74,222,128,.2)'  },
    warn: { color:'var(--fmn-gold)', bg:'rgba(234,170,65,.08)',  border:'rgba(234,170,65,.2)'  },
    neg:  { color:'var(--clr-neg)',  bg:'rgba(239,68,68,.08)',   border:'rgba(239,68,68,.2)'   },
  };

  if (dicas.length === 0) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      padding:'24px 0', color:'var(--text-3)' }}>
      <span style={{ fontSize:12, fontFamily:'Roboto,sans-serif' }}>
        Tudo certo por aqui. Nenhuma ação necessária no momento.
      </span>
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {dicas.map((d, i) => {
        const c = COR[d.tipo];
        return (
          <div key={i} style={{ display:'flex', gap:10, padding:'9px 11px', borderRadius:8,
            background:c.bg, border:`1px solid ${c.border}`, alignItems:'flex-start' }}>
            <div style={{ flexShrink:0, marginTop:2 }}>
              <LucideIcon icon={d.icon} size={13} color={c.color}/>
            </div>
            <span style={{ fontSize:12, fontFamily:'Roboto,sans-serif', lineHeight:1.65,
              color:'var(--text-2)' }}>{d.texto}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Hook: Funil Upsell Blindagem ────────────────────────────────*/
function useUpsellData() {
  const [upsell, setUpsell] = useState(null);
  useEffect(() => {
    if (!window.db) return;
    async function load() {
      // Busca emails de quem comprou MCV e de quem comprou Blindagem separadamente
      const [{ data: mcvRows }, { data: blindRows }] = await Promise.all([
        window.db.from('vendas').select('id,email').eq('status','aprovada').ilike('produto_nome','%contrato visual%'),
        window.db.from('vendas').select('id,email').eq('status','aprovada').ilike('produto_nome','%blindagem%'),
      ]);
      const mcvEmails   = new Set((mcvRows   || []).map(r => r.email).filter(Boolean));
      const blindEmails = new Set((blindRows || []).map(r => r.email).filter(Boolean));
      // Upsell real = quem tem Blindagem E já tinha MCV
      const upsellCount = [...blindEmails].filter(e => mcvEmails.has(e)).length;
      const mcv = mcvEmails.size;
      setUpsell({
        vendasMcv:     mcv,
        upsells:       upsellCount,
        taxaConversao: mcv > 0 ? (upsellCount / mcv) * 100 : 0,
        receitaExtra:  upsellCount * 100,
      });
    }
    load();
    const ch = window.db.channel('upsell-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendas' }, load)
      .subscribe();
    return () => window.db.removeChannel(ch);
  }, []);
  return upsell;
}

/* ── UpsellFunnelCard ────────────────────────────────────────────*/
function UpsellFunnelCard({ data }) {
  const { vendasMcv, upsells, taxaConversao, receitaExtra } = data;
  const metrics = [
    { label: 'Vendas MCV (base)', value: vendasMcv, icon: 'shopping-cart', color: 'var(--text-1)' },
    { label: 'Upsells Blindagem', value: upsells,   icon: 'zap',           color: 'var(--fmn-gold)' },
    { label: 'Taxa de Upsell',    value: taxaConversao.toFixed(1) + '%', icon: 'percent', color: 'var(--clr-pos)' },
    { label: 'Receita Extra',     value: fmtCur(receitaExtra), icon: 'wallet', color: 'var(--clr-pos)' },
  ];
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
        {metrics.map(m => (
          <div key={m.label} style={{ display:'flex', flexDirection:'column', gap:4,
            padding:'12px 14px', borderRadius:10,
            background:'var(--app-surface-2)', border:'1px solid var(--app-border)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
              <LucideIcon icon={m.icon} size={13} color="var(--text-3)"/>
              <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
                color:'var(--text-3)', letterSpacing:'0.04em', textTransform:'uppercase' }}>
                {m.label}
              </span>
            </div>
            <span style={{ fontSize:22, fontFamily:'Roboto,sans-serif', fontWeight:700,
              color:m.color, lineHeight:1 }}>
              {m.value}
            </span>
          </div>
        ))}
      </div>

      {vendasMcv > 0 && (
        <div style={{ padding:'12px 14px', borderRadius:10,
          background:'var(--app-surface-2)', border:'1px solid var(--app-border)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
              color:'var(--text-2)' }}>MCV → Blindagem</span>
            <span style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
              color:'var(--fmn-gold)' }}>{vendasMcv} → {upsells}</span>
          </div>
          <div style={{ background:'rgba(255,255,255,.07)', borderRadius:999, height:8, overflow:'hidden' }}>
            <div style={{ height:'100%', borderRadius:999,
              background:'linear-gradient(90deg,rgba(234,170,65,.9),rgba(232,130,10,.8))',
              width:`${Math.min(taxaConversao,100)}%`, transition:'width .6s ease' }}/>
          </div>
          <div style={{ marginTop:6, fontSize:10, fontFamily:'Roboto,sans-serif',
            color:'var(--text-3)', textAlign:'right' }}>
            {taxaConversao.toFixed(1)}% de conversão de upsell · acumulado total
          </div>
        </div>
      )}
    </div>
  );
}

/* ── DashboardScreen ─────────────────────────────────────────────*/
function DashboardScreen({ period, onPeriodChange, dateRange, onDateRangeChange, onNavigate }) {
  // Captura o mapa com fallback: se ainda não estava no window no primeiro render,
  // um re-render por qualquer state update vai pegar o valor correto
  const FotoMap = window.SalesMapWidget || null;
  const { from: rangeFrom, to: rangeTo } = periodToDates(period, dateRange);
  const { data, loading }  = useDashboardData(period, dateRange);
  const chartDays          = useLineChartData(period, dateRange);
  const weeklySales        = useWeeklyBarData(period, dateRange);
  const periodHeatmap      = useWeeklySalesHeatmap(rangeFrom, rangeTo);
  const recuperacao             = useRecuperacao(rangeFrom, rangeTo);
  const recentSales             = useRecentSales(10);
  const upsellData              = useUpsellData();

  const fat         = data?.fat         || 0;
  const lucro       = data?.lucro       || 0;
  const gasto       = data?.gasto       || 0;
  const margem      = data?.margem      || 0;
  const totalVendas = data?.totalVendas || 0;
  const cpaMedio    = data?.cpaMedio    || null;
  const roas        = data?.roas        ?? null;
  const roi         = data?.roi         ?? null;
  const ticketMedio = data?.ticketMedio ?? null;
  const cac         = data?.cac         ?? null;
  const ltv         = data?.ltv         ?? null;
  const [rankingSort, setRankingSort] = useState('cpa'); // 'cpa' | 'vendas'
  const adsRankingRaw = data?.adsRanking || [];
  const adsRanking = [...adsRankingRaw].sort((a, b) => {
    if (rankingSort === 'vendas') return b.vendas - a.vendas;
    // cpa: com CPA primeiro asc, sem CPA depois por gasto desc
    const aCpa = a.cpa ?? Infinity;
    const bCpa = b.cpa ?? Infinity;
    if (aCpa === Infinity && bCpa === Infinity) return b.gasto - a.gasto;
    return aCpa - bCpa;
  });
  const bkRows = data?.breakdownRows || [
    { label: 'Faturamento bruto (preço produto)', value: 0, color: 'var(--text-1)', bold: true },
    { label: 'Imposto Meta (12,15%)',      value: 0, color: 'var(--clr-neg)' },
    { label: 'Imposto sobre Nota (6%)',    value: 0, color: 'var(--clr-neg)' },
    { label: 'Despesas recorrentes',       value: 0, color: 'var(--clr-neg)' },
    { label: 'Reembolsos',                 value: 0, color: 'var(--clr-warn)' },
    { label: 'Lucro real',                 value: 0, color: 'var(--clr-pos)', bold: true, separator: true },
  ];
  const prodItems = data?.salesByProduct || [];
  const srcItems  = data?.salesBySource  || [];
  const funnel    = data?.funnelSteps    || null;
  const cvrFinal  = funnel ? funnel[funnel.length-1].pct.toFixed(2)+'%' : '—';

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', width:'100%',
      flex:1, minWidth:0, overflow:'hidden' }}>
      <div style={{ height:'var(--topbar-h)', background:'var(--app-bg)',
        borderBottom:'1px solid var(--app-border)', padding:'0 24px',
        display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:14.5,
            color:'var(--text-1)', letterSpacing:'-0.01em' }}>Visão Geral</span>
          {loading && (
            <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', color:'var(--text-3)',
              background:'rgba(255,255,255,.05)', border:'1px solid var(--app-border)',
              padding:'2px 8px', borderRadius:99 }}>atualizando...</span>
          )}
        </div>
        <DateRangePicker period={period} onPeriodChange={onPeriodChange}
          dateRange={dateRange} onDateRangeChange={onDateRangeChange}/>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'18px 24px', display:'flex',
        flexDirection:'column', gap:12, width:'100%', minWidth:0, boxSizing:'border-box' }}>

        {/* KPIs reais — linha 1 */}
        <div style={{ display:'flex', gap:12 }}>
          <CardKPI label="Faturamento"  value={fmtCur(fat)}   icon="trending-up" accent/>
          <CardKPI label="Lucro Real"   value={fmtCur(lucro)} icon="wallet"/>
          <CardKPI label="Gasto Meta"   value={fmtCur(gasto)} icon="zap"/>
          <CardKPI label="Vendas"       value={totalVendas} icon="shopping-cart"/>
          <CardKPI label="CPA Médio"    value={cpaMedio ? fmtCur(cpaMedio) : '—'} icon="target"/>
        </div>

        {/* KPIs reais — linha 2 (retorno sobre investimento) */}
        <div style={{ display:'flex', gap:12 }}>
          <CardKPI label="ROAS"          value={roas != null ? `${roas.toFixed(2)}x` : '—'} icon="rotate-cw"
            title="Retorno sobre Gasto de Anúncio: faturamento ÷ gasto no Meta. Quanto cada real investido em anúncio virou de faturamento."/>
          <CardKPI label="ROI"           value={roi != null ? `${(roi*100).toFixed(1)}%` : '—'} icon="trending-up"
            title="Retorno sobre Investimento: lucro real ÷ (gasto Meta + despesas recorrentes do período)."/>
          <CardKPI label="CAC"           value={cac != null ? fmtCur(cac) : '—'} icon="user-plus"
            title="Custo de Aquisição de Cliente: gasto Meta ÷ clientes que compraram pela 1ª vez no período."/>
          <CardKPI label="Ticket Médio"  value={ticketMedio != null ? fmtCur(ticketMedio) : '—'} icon="receipt"
            title="Faturamento ÷ número de vendas do período."/>
          <CardKPI label="LTV"           value={ltv != null ? fmtCur(ltv) : '—'} icon="repeat"
            title="Valor médio por cliente: soma de TODO o histórico de compras (mesmo antes do período) de quem comprou no período, dividido pelo nº de clientes únicos."/>
        </div>

        {/* Chart + Breakdown */}
        <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:12 }}>
          <SectionCard title="Gasto × Faturamento"
            headerRight={
              <div style={{ display:'flex', gap:12 }}>
                {[['rgba(234,170,65,.8)','Gasto'],['rgba(74,222,128,.7)','Faturamento']].map(([c,l])=>(
                  <span key={l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:10.5,
                    fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-3)' }}>
                    <span style={{ width:16, height:2, borderRadius:1, background:c, display:'block' }}/>
                    {l}
                  </span>
                ))}
              </div>
            }>
            <LineAreaChart data={chartDays}/>
          </SectionCard>
          <SectionCard title="Detalhamento Financeiro"><BreakdownTable rows={bkRows} margem={margem}/></SectionCard>
        </div>

        {/* Últimas Vendas com atribuição — só renderiza se houver dados */}
        <SectionCard title="Últimas Vendas" style={{ flexShrink:0 }}
          headerRight={
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', color:'var(--text-3)',
                letterSpacing:'0.04em' }}>acumulado total · sem filtro de período</span>
              <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:10.5,
                fontFamily:'Roboto,sans-serif', fontWeight:700, color:'#22c55e' }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e',
                  boxShadow:'0 0 0 2px rgba(34,197,94,.25)', display:'inline-block',
                  animation:'pulse-dot 2s ease-in-out infinite' }}/>
                ao vivo
              </span>
            </div>
          }>
          {recentSales.length > 0
            ? <RecentSalesFeed sales={recentSales}/>
            : <EmptyState icon="shopping-cart" label="Nenhuma venda registrada"/>}
        </SectionCard>

        {/* Linha 3 — Ranking de ADS (linha completa) */}
        <SectionCard title="Ranking de ADS" style={{ flexShrink:0 }}
          headerRight={
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ display:'flex', borderRadius:6, overflow:'hidden',
                border:'1px solid var(--app-border)', flexShrink:0 }}>
                {[['cpa','CPA'],['vendas','Vendas']].map(([key,label]) => (
                  <button key={key} onClick={() => setRankingSort(key)}
                    style={{ padding:'3px 10px', fontSize:10, fontFamily:'Roboto,sans-serif',
                      fontWeight:700, cursor:'pointer', border:'none', letterSpacing:'0.04em',
                      background: rankingSort === key ? 'var(--fmn-gold)' : 'transparent',
                      color: rankingSort === key ? '#000' : 'var(--text-3)',
                      transition:'all .15s' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          }>
          <AdsRanking ads={adsRanking} onNavigate={onNavigate}/>
        </SectionCard>

        {/* Linha 4 — Funil de Conversão (linha completa, só aparece se tiver dados) */}
        {funnel && (
          <SectionCard title="Funil de Conversão (Meta Ads)" noPad style={{ flexShrink:0 }}
            headerRight={<span style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif',
              fontWeight:700, color:'var(--text-3)', letterSpacing:'0.06em' }}>CVR FINAL · {cvrFinal}</span>}>
            <div style={{ padding:'8px 18px 18px' }}>
              <FlowFunnel steps={funnel}/>
              {funnel[funnel.length-1]?.sub && (
                <div style={{ textAlign:'right', marginTop:-4, fontSize:10.5,
                  fontFamily:'Roboto,sans-serif', color:'var(--text-3)' }}>
                  Conversão do upsell: {funnel[funnel.length-1].sub}
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* Linhas finais — grid 3×3 com mapa ocupando coluna direita */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gridTemplateRows:'auto auto auto', gap:12, alignItems:'stretch' }}>

          {/* Linha 1, col 1 */}
          <SectionCard title="Vendas por Dia da Semana">
            {weeklySales.length > 0
              ? <WeeklySalesChart data={weeklySales}/>
              : <EmptyState icon="bar-chart-2" label="Sem dados de vendas"/>}
          </SectionCard>

          {/* Linha 1, col 2 */}
          <SectionCard title="Vendas por Período">
            {periodHeatmap
              ? <SalesByPeriod data={periodHeatmap}/>
              : <EmptyState icon="calendar" label="Sem dados de vendas"/>}
          </SectionCard>

          {/* Col 3, span 3 linhas — Mapa */}
          {FotoMap && (
            <SectionCard title="Alunos"
              style={{ gridRow:'span 3', display:'flex', flexDirection:'column' }}>
              <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
                <FotoMap from={rangeFrom} to={rangeTo} />
              </div>
            </SectionCard>
          )}

          {/* Linha 2, col 1 */}
          <SectionCard title="Vendas por Fonte">
            {srcItems.length > 0
              ? <SalesList items={srcItems} color="#8b5cf6"/>
              : <EmptyState icon="globe" label="Nenhuma venda no período"/>}
          </SectionCard>

          {/* Linha 2, col 2 */}
          <SectionCard title="Vendas por Produto">
            {prodItems.length > 0
              ? <SalesList items={prodItems} color="#3b82f6"/>
              : <EmptyState icon="package" label="Nenhuma venda no período"/>}
          </SectionCard>

          {/* Linha 3, col 1 */}
          <SectionCard title="Recuperação de Vendas">
            {recuperacao.length > 0
              ? <RecuperacaoList items={recuperacao}/>
              : <EmptyState icon="shopping-cart" label="Nenhum carrinho abandonado registrado"/>}
          </SectionCard>

          {/* Linha 3, col 2 */}
          <SectionCard title="Dicas"><Dicas data={data}/></SectionCard>

        </div>


      </div>
    </div>
  );
}

/* ── EmptyState ──────────────────────────────────────────────────*/
function EmptyState({ icon, label }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      gap:8, padding:'24px 0', color:'var(--text-3)' }}>
      <LucideIcon icon={icon} size={22}/>
      <span style={{ fontSize:12, fontFamily:'Roboto,sans-serif' }}>{label}</span>
    </div>
  );
}

window.DashboardScreen = DashboardScreen;
