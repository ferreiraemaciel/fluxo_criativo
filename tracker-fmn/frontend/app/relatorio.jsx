/* ================================================================
   Tracker FMN — Relatório em PDF

   COMO FUNCIONA
   ─────────────
   Sem servidor, sem biblioteca de PDF: window.print() do próprio navegador.
   Ao exportar, um overlay cobre a tela inteira só com o conteúdo do
   relatório; o resto do app fica escondido via CSS de impressão
   (visibility:hidden em tudo, visibility:visible só dentro do overlay).
   "Salvar como PDF" no diálogo de impressão do Chrome gera o arquivo.

   POR QUE REUSA COMPONENTES DO DASHBOARD
   ───────────────────────────────────────
   BreakdownTable, FlowFunnel, WeeklySalesChart, SalesByPeriod, SalesList e
   SalesMapWidget são os MESMOS componentes que a tela usa, exportados via
   window em dashboard.jsx. O relatório não recalcula nada: recebe os dados
   já prontos dos hooks do Dashboard (useDashboardData etc) e só desenha.
   Isso garante que o número no PDF é sempre idêntico ao da tela — é
   literalmente o mesmo código, não uma segunda implementação que poderia
   divergir (a lição repetida à exaustão nesta sessão de auditoria).

   QUEBRA DE PÁGINA
   ────────────────
   Cada cartão leva `pageBreakInside:'avoid'` — o navegador nunca corta um
   card no meio, prefere levar ele inteiro pra próxima folha. As duas seções
   mais altas (Funil, grade final) começam sempre no topo de uma folha nova
   (`pageBreakBefore:'always'`), pra não ficar com uma sobra de 2cm no fim de
   uma página e o resto na seguinte.

   IMPORTANTE PRA QUEM FOR SALVAR O PDF: no diálogo de impressão do Chrome
   (Cmd+P), abrir "Mais configurações" e marcar "Gráficos de segundo plano".
   Sem isso o Chrome imprime fundo branco por padrão e ignora as cores do
   relatório, mesmo com o CSS forçando print-color-adjust — essa opção é do
   navegador, não dá pra automatizar por código.
   ================================================================ */

const { useState, useRef, useEffect } = React;
const { createPortal } = ReactDOM;

const DESTINATARIOS = {
  felipe: {
    nome: 'Felipe Ferreira',
    foto: 'assets/avatar-felipe.png',
    subtitulo: null,
  },
  samuel: {
    nome: 'Samuel Rezende',
    foto: 'assets/avatar-samuel.png',
    subtitulo: 'Relatório preparado para Samuel Rezende — mentor do Fluxo (Leandro Ladeira)',
  },
};

function fmtDataBR(iso) {
  if (!iso) return '';
  return iso.split('-').reverse().join('/');
}

/* ── Cartão do relatório: mesmo visual dos SectionCard da tela, com a
   trava de não cortar no meio da impressão. ─────────────────────────── */
function CardRelatorio({ title, children, style = {} }) {
  return (
    <div style={{
      background: 'var(--app-surface)', border: '1px solid var(--app-border)',
      borderRadius: 14, padding: 18, breakInside: 'avoid', pageBreakInside: 'avoid',
      marginBottom: 14, ...style,
    }}>
      {title && (
        <div style={{ fontSize: 13, fontFamily: 'Roboto,sans-serif', fontWeight: 700,
          color: 'var(--text-1)', marginBottom: 14 }}>{title}</div>
      )}
      {children}
    </div>
  );
}

function KpiRelatorio({ label, value, accent }) {
  return (
    <div style={{ flex: 1, background: 'var(--app-surface)', border: '1px solid var(--app-border)',
      borderRadius: 12, padding: '14px 16px', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
      <div style={{ fontSize: 9.5, fontFamily: 'Roboto,sans-serif', fontWeight: 700,
        letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 19, fontFamily: 'Roboto,sans-serif', fontWeight: 700,
        color: accent ? 'var(--fmn-gold)' : 'var(--text-1)', whiteSpace: 'nowrap' }}>
        {value}
      </div>
    </div>
  );
}

/* Gráfico Gasto × Faturamento simplificado pra impressão: sem hover, sem
   tooltip (não existem no papel). Mesma leitura visual da tela, sem o
   estado interativo que só faz sentido com mouse. */
function GraficoAreaEstatico({ data }) {
  if (!data || !data.length) return <div style={{ height: 160 }} />;
  const W = 640, H = 160, padL = 34, padB = 20, padT = 10;
  const maxV = Math.max(...data.map(d => Math.max(d.fat || 0, d.gasto || 0)), 1);
  const stepX = (W - padL) / Math.max(data.length - 1, 1);
  const y = v => H - padB - (v / maxV) * (H - padB - padT);
  const x = i => padL + i * stepX;
  const linha = campo => data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d[campo] || 0)}`).join(' ');
  const area = campo => `${linha(campo)} L ${x(data.length - 1)} ${H - padB} L ${x(0)} ${H - padB} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <linearGradient id="rpFat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ade80" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="#4ade80" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area('fat')} fill="url(#rpFat)"/>
      <path d={linha('fat')} fill="none" stroke="#4ade80" strokeWidth="2"/>
      <path d={linha('gasto')} fill="none" stroke="#eaaa41" strokeWidth="2"/>
      {[0, 0.5, 1].map(f => (
        <text key={f} x={4} y={y(maxV * f) + 3} fontSize="8.5" fill="rgba(255,255,255,.35)" fontFamily="Roboto,sans-serif">
          {Math.round(maxV * f)}
        </text>
      ))}
      {data.map((d, i) => (
        <text key={i} x={x(i)} y={H - 5} fontSize="8.5" fill="rgba(255,255,255,.4)"
          textAnchor="middle" fontFamily="Roboto,sans-serif">{d.label}</text>
      ))}
      <g transform={`translate(${W - 130}, 6)`}>
        <circle cx={0} cy={0} r={3} fill="#4ade80"/>
        <text x={8} y={3} fontSize="9" fill="rgba(255,255,255,.6)" fontFamily="Roboto,sans-serif">Faturamento</text>
        <circle cx={80} cy={0} r={3} fill="#eaaa41"/>
        <text x={88} y={3} fontSize="9" fill="rgba(255,255,255,.6)" fontFamily="Roboto,sans-serif">Gasto</text>
      </g>
    </svg>
  );
}

/* ── Conteúdo do relatório ──────────────────────────────────────────── */
function RelatorioConteudo({ destinatario, rangeFrom, rangeTo, dados }) {
  const dest = DESTINATARIOS[destinatario];
  const fmt = window.fmtBRL;
  const {
    data, chartDays, weeklySales, periodHeatmap, salesByProduct, salesBySource,
  } = dados;

  const fat = data?.fat || 0, lucro = data?.lucro || 0, gasto = data?.gasto || 0;
  const margem = data?.margem || 0, totalVendas = data?.totalVendas || 0;
  const cpaMedio = data?.cpaMedio ?? null, roas = data?.roas ?? null, roi = data?.roi ?? null;
  const cac = data?.cac ?? null, ticketMedio = data?.ticketMedio ?? null, ltv = data?.ltv ?? null;
  const bkRows = data?.breakdownRows || [];
  const funnelSteps = data?.funnelSteps || null;

  const FotoMap = window.SalesMapWidget || null;
  const BreakdownTable = window.BreakdownTable, FlowFunnel = window.FlowFunnel;
  const WeeklySalesChart = window.WeeklySalesChart, SalesByPeriod = window.SalesByPeriod;
  const SalesList = window.SalesList, CircularProgress = window.CircularProgress;
  const totalOrigem = (salesBySource || []).reduce((s, o) => s + o.sales, 0) || 1;

  return (
    <div className="relatorio-print" style={{
      background: 'var(--app-bg)', color: 'var(--text-1)', width: 1000, margin: '0 auto',
      padding: '28px 24px 60px', fontFamily: 'Roboto,sans-serif',
    }}>
      {/* ── Cabeçalho: marca, período, destinatário ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingBottom: 16, borderBottom: '1px solid var(--app-border)', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--fmn-gold)' }}>Tracker FMN</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--text-1)', marginTop: 3 }}>
            Relatório Financeiro
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 4 }}>
            Período: <strong style={{ color: 'var(--text-1)' }}>{fmtDataBR(rangeFrom)} a {fmtDataBR(rangeTo)}</strong>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={dest.foto} alt={dest.nome} style={{
            width: 48, height: 48, borderRadius: '50%', objectFit: 'cover',
            border: '2px solid var(--fmn-gold)',
          }}/>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--text-3)' }}>Preparado para</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-1)' }}>{dest.nome}</div>
          </div>
        </div>
      </div>

      {dest.subtitulo && (
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 16, fontStyle: 'italic' }}>
          {dest.subtitulo}
        </div>
      )}

      {/* ── KPIs ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <KpiRelatorio label="Faturamento" value={fmt(fat)} accent/>
        <KpiRelatorio label="Lucro Real"  value={fmt(lucro)}/>
        <KpiRelatorio label="Gasto Meta"  value={fmt(gasto)}/>
        <KpiRelatorio label="Vendas"      value={String(totalVendas)}/>
        <KpiRelatorio label="CPA Médio"   value={cpaMedio != null ? fmt(cpaMedio) : '—'}/>
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <KpiRelatorio label="ROAS"         value={roas != null ? `${roas.toFixed(2)}x` : '—'}/>
        <KpiRelatorio label="ROI"          value={roi != null ? `${(roi * 100).toFixed(1)}%` : '—'}/>
        <KpiRelatorio label="CAC"          value={cac != null ? fmt(cac) : '—'}/>
        <KpiRelatorio label="Ticket Médio" value={ticketMedio != null ? fmt(ticketMedio) : '—'}/>
        <KpiRelatorio label="LTV"          value={ltv != null ? fmt(ltv) : '—'}/>
      </div>

      {/* ── Gasto x Faturamento + Detalhamento ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
        <CardRelatorio title="Gasto × Faturamento" style={{ flex: 1.3 }}>
          <GraficoAreaEstatico data={chartDays || []}/>
        </CardRelatorio>
        <CardRelatorio title="Detalhamento Financeiro" style={{ flex: 1 }}>
          {BreakdownTable ? <BreakdownTable rows={bkRows} margem={margem}/> : null}
        </CardRelatorio>
      </div>

      {/* ── Funil: sempre no topo de uma folha nova ── */}
      {funnelSteps && (
        <CardRelatorio title="Funil de Conversão (Meta Ads)"
          style={{ pageBreakBefore: 'always', breakBefore: 'page' }}>
          {FlowFunnel ? <FlowFunnel steps={funnelSteps}/> : null}
        </CardRelatorio>
      )}

      {/* ── Grade final: dia da semana / período / mapa, fonte / produto —
          também começa em folha nova, é o bloco mais alto do relatório. ── */}
      <div style={{ display: 'flex', gap: 12, pageBreakBefore: 'always', breakBefore: 'page' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <CardRelatorio title="Vendas por Dia da Semana">
            {WeeklySalesChart && weeklySales ? <WeeklySalesChart data={weeklySales}/> : null}
          </CardRelatorio>
          <CardRelatorio title="Vendas por Período">
            {SalesByPeriod && periodHeatmap ? <SalesByPeriod data={periodHeatmap}/> : null}
          </CardRelatorio>
        </div>
        <CardRelatorio title="Alunos" style={{ flex: 1.1 }}>
          {FotoMap ? <FotoMap from={rangeFrom} to={rangeTo}/> : null}
        </CardRelatorio>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <CardRelatorio title="Vendas por Fonte" style={{ flex: 1 }}>
          {SalesList && CircularProgress && salesBySource?.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {salesBySource.map((o, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CircularProgress pct={(o.sales / totalOrigem) * 100} size={30} sw={3}
                    color={i === 0 ? '#a78bfa' : '#3b82f6'}/>
                  <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-2)' }}>{o.name}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{o.sales}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', width: 42, textAlign: 'right' }}>
                    {o.pct.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          ) : <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Sem dados no período.</div>}
        </CardRelatorio>
        <CardRelatorio title="Vendas por Produto" style={{ flex: 1 }}>
          {SalesList && salesByProduct?.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {salesByProduct.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.35 }}>{p.name}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{p.sales}</span>
                  <span style={{ fontSize: 11, color: '#3b82f6', width: 42, textAlign: 'right' }}>
                    {p.pct.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          ) : <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Sem dados no período.</div>}
        </CardRelatorio>
      </div>

      <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--app-border)',
        fontSize: 10, color: 'var(--text-3)', textAlign: 'center' }}>
        Gerado pelo Tracker FMN em {new Date().toLocaleDateString('pt-BR')}
      </div>
    </div>
  );
}

/* ── Overlay de impressão ─────────────────────────────────────────────
   Cobre a tela inteira só quando exportando. O CSS de impressão injetado
   uma vez esconde TUDO fora de .relatorio-print (visibility:hidden em tudo,
   visibility:visible só dentro do relatório) e força as cores de fundo a
   aparecerem no PDF — sem isso o Chrome imprime fundo branco por padrão e
   o texto claro fica invisível em cima dele.                             */
function garantirCssImpressao() {
  if (document.getElementById('relatorio-print-css')) return;
  const style = document.createElement('style');
  style.id = 'relatorio-print-css';
  style.textContent = `
    @media print {
      html, body {
        background: #0f1013 !important;
        /* tokens.css trava overflow:hidden e height:100% no app inteiro (pra
           tela normal), o que soma no corte de página junto com o fixed
           abaixo. Vira documento normal só durante a impressão. */
        overflow: visible !important; height: auto !important;
      }
      /* #root não precisa mais de tratamento especial: o relatório agora é um
         portal direto pro <body> (ver RelatorioOverlay), então não vive mais
         dentro da árvore do #root em nenhum momento — inclusive na
         impressão. Esconder #root evita que o app inteiro (invisível, mas
         ainda ocupando espaço em overflow:visible) empurre o relatório pra
         baixo ou deixe folha em branco antes dele. */
      #root { display: none !important; }
      body * { visibility: hidden !important; }
      .relatorio-print, .relatorio-print * { visibility: visible !important; }

      /* A CAUSA REAL DO CORTE: .relatorio-overlay-print é position:fixed na
         tela (pra cobrir tudo com um fundo escuro). Motor de impressão do
         Chrome trata position:fixed como preso a UMA página só — reserva a
         altura da tela e descarta tudo que passa disso, nunca gera 2ª
         folha. Aqui ele volta a ser um bloco normal do documento, que é o
         que permite o conteúdo fluir e paginar de verdade. */
      .relatorio-overlay-print {
        position: static !important; inset: auto !important; overflow: visible !important;
        height: auto !important; padding: 0 !important; background: transparent !important;
      }
      .relatorio-print {
        position: static !important; width: 100% !important; margin: 0 !important;
        -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
      }
      .relatorio-print * {
        -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
      }
      .no-print { display: none !important; }
      @page { size: A4; margin: 10mm; }
    }
  `;
  document.head.appendChild(style);
}

function RelatorioOverlay({ destinatario, rangeFrom, rangeTo, dados, onClose }) {
  // Portal direto pro <body>, IRMÃO de #root, não filho dele.
  //
  // Por que isso é obrigatório e não só "mais limpo": o relatório nasce
  // dentro da árvore normal do React, lá no fundo de DashboardScreen. Na
  // TELA isso não incomoda, porque position:fixed escapa visualmente de
  // qualquer ancestral. Mas na IMPRESSÃO, quando ele precisa voltar a ser
  // position:static pra poder paginar, ele volta a ficar sujeito à altura e
  // ao overflow de TODOS os ancestrais reais — não só o #root (que corrigi
  // antes), mas qualquer wrapper de tela no meio do caminho também. Corrigir
  // ancestral por ancestral é jogo de gato e rato; o portal elimina o
  // problema inteiro, porque não existe mais ancestral nenhum entre o
  // relatório e o <body> pra travar altura.
  const [portalNode] = useState(() => {
    const el = document.createElement('div');
    el.id = 'relatorio-portal';
    return el;
  });

  useEffect(() => {
    document.body.appendChild(portalNode);
    garantirCssImpressao();
    // Pequeno atraso: garante que o mapa (SVG grande) e os gráficos já
    // pintaram antes de abrir o diálogo de impressão.
    const t = setTimeout(() => window.print(), 350);
    const aoTerminar = () => onClose();
    window.addEventListener('afterprint', aoTerminar);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', aoTerminar);
      document.body.removeChild(portalNode);
    };
  }, []);

  return createPortal((
    <div className="relatorio-overlay-print" style={{ position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,.75)', overflowY: 'auto', padding: '24px 0' }}>
      <div style={{ position: 'sticky', top: 12, display: 'flex', justifyContent: 'center',
        marginBottom: 12 }} className="no-print">
        <button onClick={onClose} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
          background: 'var(--app-surface)', border: '1px solid var(--app-border)',
          color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif', fontWeight: 700, fontSize: 12.5,
          cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,.4)',
        }}>
          <LucideIcon icon="x" size={13}/>Fechar prévia
        </button>
      </div>
      <RelatorioConteudo destinatario={destinatario} rangeFrom={rangeFrom} rangeTo={rangeTo} dados={dados}/>
    </div>
  ), portalNode);
}

/* ── Botão "Exportar Relatório" com o menu Felipe / Samuel ───────────── */
function RelatorioButton({ rangeFrom, rangeTo, dados }) {
  const [menuAberto, setMenuAberto] = useState(false);
  const [ativo, setAtivo] = useState(null); // 'felipe' | 'samuel' | null

  return (
    <>
      <div style={{ position: 'relative' }}>
        <button onClick={() => setMenuAberto(a => !a)} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8,
          background: 'rgba(234,170,65,.1)', border: '1px solid rgba(234,170,65,.3)',
          color: 'var(--fmn-gold)', fontFamily: 'Roboto,sans-serif', fontWeight: 700, fontSize: 12,
          cursor: 'pointer',
        }}>
          <LucideIcon icon="file-down" size={14}/>Exportar Relatório
        </button>
        {menuAberto && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 20 }} onClick={() => setMenuAberto(false)}/>
            <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 21, minWidth: 200,
              background: '#18191c', border: '1px solid var(--app-border)', borderRadius: 10,
              boxShadow: '0 12px 32px rgba(0,0,0,.5)', overflow: 'hidden' }}>
              {Object.entries(DESTINATARIOS).map(([key, d]) => (
                <button key={key} onClick={() => { setMenuAberto(false); setAtivo(key); }} style={{
                  width: '100%', boxSizing: 'border-box', textAlign: 'left', padding: '10px 12px',
                  display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none',
                  cursor: 'pointer', fontFamily: 'Roboto,sans-serif', fontSize: 12.5, color: 'var(--text-1)',
                  borderBottom: key === 'felipe' ? '1px solid var(--app-border)' : 'none',
                }}>
                  <img src={d.foto} alt={d.nome} style={{ width: 22, height: 22, borderRadius: '50%',
                    objectFit: 'cover' }}/>
                  Exportar para {d.nome.split(' ')[0]}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {ativo && (
        <RelatorioOverlay destinatario={ativo} rangeFrom={rangeFrom} rangeTo={rangeTo}
          dados={dados} onClose={() => setAtivo(null)}/>
      )}
    </>
  );
}

window.RelatorioButton = RelatorioButton;
