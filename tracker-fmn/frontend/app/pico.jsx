/* ================================================================
   Tracker FMN — Picos de Venda v1
   Planejamento e execução de Black Friday, lançamento e qualquer
   abertura de carrinho, com o método do retiro Fluxo 2026.

   Conceito: as datas nunca são digitadas. Cada tarefa tem um prazo
   em D-X, e a data real vem do D0 do projeto. Mudou o D0, tudo se
   move junto, exceto o que estiver travado.
   ================================================================ */
const { useState, useEffect, useMemo } = React;
const { LucideIcon, Btn, Badge, TopBar, SectionCard, CardKPI, fmtBRL } = window;

/* ── Vocabulário ────────────────────────────────────────────────*/
const FASES = [
  { id:'organizar',       label:'Organizar',       cor:'#94a3b8' },
  { id:'antecipacao',     label:'Antecipação',     cor:'#38bdf8' },
  { id:'captacao',        label:'Captação',        cor:'#a78bfa' },
  { id:'aquecimento',     label:'Aquecimento',     cor:'#fbbf24' },
  { id:'grande_dia',      label:'Grande Dia',      cor:'#f87171' },
  { id:'carrinho_aberto', label:'Carrinho aberto', cor:'#4ade80' },
  { id:'encerramento',    label:'Encerramento',    cor:'#fb923c' },
  { id:'pos',             label:'Pós',             cor:'#64748b' },
];
const FASE_MAP = Object.fromEntries(FASES.map(f => [f.id, f]));

const TRILHAS = [
  { id:'oferta',     label:'Oferta e Narrativa', icon:'gift',           cor:'#fbbf24' },
  { id:'conteudo',   label:'Conteúdo',           icon:'megaphone',      cor:'#a78bfa' },
  { id:'trafego',    label:'Tráfego',            icon:'trending-up',    cor:'#38bdf8' },
  { id:'comercial',  label:'Comercial',          icon:'message-circle', cor:'#4ade80' },
  { id:'paginas',    label:'Páginas',            icon:'layout',         cor:'#f472b6' },
  { id:'mentoria',   label:'Mentoria',           icon:'users',          cor:'#fb923c' },
  { id:'debriefing', label:'Debriefing',         icon:'clipboard-list', cor:'#94a3b8' },
];
const TRILHA_MAP = Object.fromEntries(TRILHAS.map(t => [t.id, t]));

const NIVEIS = [
  { id:'e', label:'Essencial',   desc:'Oferta, um grupo, conteúdo diário e uma live. Já é um pico inteiro.' },
  { id:'c', label:'Crescimento', desc:'Mais API de WhatsApp, e-mail e aulas de aquecimento.' },
  { id:'x', label:'Escala',      desc:'Mais URA, várias lives e cadência de 3 disparos por dia.' },
];

const STATUS_CFG = {
  pendente: { label:'Pendente', cor:'#94a3b8', bg:'rgba(148,163,184,.12)' },
  fazendo:  { label:'Fazendo',  cor:'#38bdf8', bg:'rgba(56,189,248,.12)'  },
  feito:    { label:'Feito',    cor:'#4ade80', bg:'rgba(74,222,128,.12)'  },
  pulada:   { label:'Pulada',   cor:'#64748b', bg:'rgba(100,116,139,.12)' },
};

/* ── Datas ──────────────────────────────────────────────────────*/
const hojeISO = () => new Date().toISOString().slice(0, 10);

function fmtData(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}`;
}
function diaSemana(iso) {
  if (!iso) return '';
  const dt = new Date(iso + 'T12:00:00');
  return ['dom','seg','ter','qua','qui','sex','sáb'][dt.getDay()];
}
function diasEntre(a, b) {
  if (!a || !b) return null;
  const ms = new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00');
  return Math.round(ms / 86400000);
}
function rotuloD(offset) {
  if (offset === 0) return 'D0';
  return offset < 0 ? `D${offset}` : `D+${offset}`;
}

/* Feriados nacionais fixos e o que mais atrapalha um pico.
   Serve para avisar antes de marcar abertura ou encerramento em cima. */
const FERIADOS = {
  '01-01':'Confraternização', '04-21':'Tiradentes', '05-01':'Trabalho',
  '09-07':'Independência', '10-12':'Padroeira', '11-02':'Finados',
  '11-15':'Proclamação', '11-20':'Consciência Negra', '12-25':'Natal',
};
const feriadoDe = iso => iso ? FERIADOS[iso.slice(5)] : null;

/* Datas que atrapalham um pico sem serem feriado. Eleição rouba a atenção
   do país inteiro e encarece o CPM, então vale ver antes de marcar. */
const DATAS_ATENCAO = {
  '2026-10-04': 'Eleição, 1º turno',
  '2026-10-25': 'Eleição, 2º turno',
  '2026-11-27': 'Black Friday',
  '2026-11-30': 'Cyber Monday',
};
const atencaoDe = iso => DATAS_ATENCAO[iso] || null;


/* ── Virar card no kanban ───────────────────────────────────────
   Tarefa de tráfego vira ADS, tarefa de conteúdo vira card de
   Orgânico. O card já nasce marcado com o projeto, e é isso que
   separa o pico do perpétuo depois, nas métricas e nas regras.
──────────────────────────────────────────────────────────────────*/
async function criarCardDaTarefa(tarefa, projeto) {
  if (tarefa.trilha === 'trafego') {
    const { data } = await window.db.from('ads').select('numero');
    const usados = new Set((data || []).map(r => r.numero));
    let n = 1; while (usados.has(n)) n++;
    const { error } = await window.db.from('ads').insert({
      numero: n,
      titulo: `ADS ${String(n).padStart(3,'0')} - ${tarefa.titulo}`,
      tipo: 'imagem',
      status: 'fazer',
      pico_projeto_id: projeto.id,
    });
    if (error) throw new Error(error.message);
    return { tipo:'Anúncios', rotulo:`ADS ${String(n).padStart(3,'0')}`, hash:'#criativos' };
  }
  if (tarefa.trilha === 'conteudo') {
    const { error } = await window.db.from('conteudo_organico').insert({
      tema: tarefa.titulo,
      plataforma: 'Reels',
      // O Organico nao tem coluna "Fazer": a primeira e "Fazendo".
      status: 'Fazendo',
      pico_projeto_id: projeto.id,
    });
    if (error) throw new Error(error.message);
    return { tipo:'Orgânico', rotulo:tarefa.titulo, hash:'#organico' };
  }
  throw new Error('Só tarefas de Tráfego e Conteúdo viram card.');
}

/* ── Barra de progresso ─────────────────────────────────────────*/
function Progresso({ feitas, total, cor = '#4ade80', altura = 6 }) {
  const p = total > 0 ? Math.round((feitas / total) * 100) : 0;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
      <div style={{ flex:1, height:altura, borderRadius:99,
        background:'rgba(255,255,255,.07)', overflow:'hidden', minWidth:40 }}>
        <div style={{ width:`${p}%`, height:'100%', borderRadius:99, background:cor,
          transition:'width 350ms cubic-bezier(.2,.7,.2,1)' }}/>
      </div>
      <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', fontWeight:700,
        color:'var(--text-3)', fontVariantNumeric:'tabular-nums', flexShrink:0 }}>
        {feitas}/{total}
      </span>
    </div>
  );
}

/* ── Linha de tarefa ────────────────────────────────────────────*/
function LinhaTarefa({ t, onToggle, onAbrir, mostrarTrilha, onVirarCard }) {
  const [hov, setHov] = useState(false);
  const [criando, setCriando] = useState(false);
  const podeVirarCard = onVirarCard && (t.trilha === 'trafego' || t.trilha === 'conteudo')
    && !t.entregavel_url;
  const feito   = t.status === 'feito';
  const pulada  = t.status === 'pulada';
  const trilha  = TRILHA_MAP[t.trilha] || {};
  const atrasada = !feito && !pulada && t.data_prevista && t.data_prevista < hojeISO();
  const fer = feriadoDe(t.data_prevista);

  return (
    <div
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'9px 11px',
        borderRadius:9, background: hov ? 'rgba(255,255,255,.035)' : 'transparent',
        border:'1px solid ' + (atrasada ? 'rgba(248,113,113,.28)' : 'transparent'),
        transition:'background 120ms', cursor:'pointer' }}
      onClick={()=>onAbrir(t)}
    >
      <button
        onClick={(e)=>{ e.stopPropagation(); onToggle(t); }}
        title={feito ? 'Desmarcar' : 'Marcar como feito'}
        style={{ width:19, height:19, borderRadius:6, flexShrink:0, marginTop:1,
          border:'1.5px solid ' + (feito ? '#4ade80' : 'var(--app-border)'),
          background: feito ? '#4ade80' : 'transparent', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>
        {feito && <LucideIcon icon="check" size={12} style={{ color:'#0b0b0d' }}/>}
      </button>

      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
          <span style={{ fontSize:12.5, fontFamily:'Roboto,sans-serif', fontWeight:600,
            color: feito || pulada ? 'var(--text-3)' : 'var(--text-1)',
            textDecoration: feito || pulada ? 'line-through' : 'none' }}>
            {t.titulo}
          </span>
          {t.nivel_minimo !== 'e' && (
            <span style={{ fontSize:9.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
              padding:'1px 5px', borderRadius:4, background:'rgba(255,255,255,.06)',
              color:'var(--text-3)', letterSpacing:.3 }}>
              {t.nivel_minimo === 'c' ? 'CRESC' : 'ESCALA'}
            </span>
          )}
        </div>
        {t.criterio_pronto && (
          <div style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'var(--text-3)',
            marginTop:2, lineHeight:1.4 }}>
            {t.criterio_pronto}
          </div>
        )}
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
        {t.entregavel_url && (
          <span title={`Card criado: ${t.entregavel_url}`}
            style={{ color:'#4ade80', display:'flex' }}>
            <LucideIcon icon="link" size={12}/>
          </span>
        )}
        {podeVirarCard && (hov || criando) && (
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (criando) return;
              setCriando(true);
              try { await onVirarCard(t); } finally { setCriando(false); }
            }}
            title={t.trilha === 'trafego' ? 'Criar card em Anúncios' : 'Criar card em Orgânico'}
            style={{ padding:'2px 7px', borderRadius:5, cursor:'pointer',
              border:'1px solid var(--app-border)', background:'rgba(255,255,255,.05)',
              color:'var(--text-2)', fontSize:10, fontFamily:'Roboto,sans-serif',
              fontWeight:700, display:'flex', alignItems:'center', gap:3 }}>
            <LucideIcon icon={criando ? 'loader' : 'plus'} size={10}
              style={criando ? { animation:'spin 1s linear infinite' } : undefined}/>
            {criando ? 'criando' : 'card'}
          </button>
        )}
        {mostrarTrilha && trilha.label && (
          <span title={trilha.label} style={{ display:'flex', alignItems:'center',
            color:trilha.cor, opacity:.75 }}>
            <LucideIcon icon={trilha.icon} size={13}/>
          </span>
        )}
        {fer && (
          <span title={`Feriado: ${fer}`} style={{ color:'#fb923c', display:'flex' }}>
            <LucideIcon icon="alert-triangle" size={12}/>
          </span>
        )}
        <span style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
          color:'var(--text-3)', fontVariantNumeric:'tabular-nums', minWidth:34,
          textAlign:'right' }}>
          {rotuloD(t.offset_dias)}
        </span>
        <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif',
          color: atrasada ? '#f87171' : 'var(--text-3)',
          fontVariantNumeric:'tabular-nums', minWidth:52, textAlign:'right' }}>
          {t.data_prevista ? `${fmtData(t.data_prevista)} ${diaSemana(t.data_prevista)}` : ''}
        </span>
      </div>
    </div>
  );
}

/* ── Bloco de decisões-gate ─────────────────────────────────────*/
function BlocoDecisoes({ decisoes, onEscolher }) {
  const pendentes = decisoes.filter(d => !d.escolha).length;
  return (
    <SectionCard
      title="Decisões que travam o resto"
      right={pendentes > 0
        ? <Badge tone="warn">{pendentes} pendente{pendentes > 1 ? 's' : ''}</Badge>
        : <Badge tone="ok">Todas decididas</Badge>}
    >
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {decisoes.map(d => {
          const opcoes = Array.isArray(d.opcoes) ? d.opcoes : [];
          return (
            <div key={d.id} style={{ padding:'10px 12px', borderRadius:9,
              background: d.escolha ? 'rgba(74,222,128,.05)' : 'rgba(251,191,36,.05)',
              border:'1px solid ' + (d.escolha ? 'rgba(74,222,128,.18)' : 'rgba(251,191,36,.2)') }}>
              <div style={{ fontSize:12.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
                color:'var(--text-1)', marginBottom: d.regra ? 3 : 7 }}>
                {d.pergunta}
              </div>
              {d.regra && (
                <div style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'var(--text-3)',
                  marginBottom:7, lineHeight:1.4, fontStyle:'italic' }}>
                  {d.regra}
                </div>
              )}
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {opcoes.map(op => {
                  const ativa = d.escolha === op;
                  return (
                    <button key={op} onClick={()=>onEscolher(d, ativa ? null : op)}
                      style={{ padding:'5px 11px', borderRadius:7, cursor:'pointer',
                        fontSize:11.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
                        border:'1px solid ' + (ativa ? '#4ade80' : 'var(--app-border)'),
                        background: ativa ? 'rgba(74,222,128,.14)' : 'transparent',
                        color: ativa ? '#4ade80' : 'var(--text-2)' }}>
                      {ativa && '✓ '}{op}
                    </button>
                  );
                })}
              </div>
              {d.fonte && (
                <div style={{ fontSize:10, fontFamily:'Roboto,sans-serif',
                  color:'var(--text-3)', marginTop:6, opacity:.7 }}>
                  {d.fonte}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

/* ── Imaginação primária ────────────────────────────────────────*/
const INDICADORES_IMAGINACAO = [
  { chave:'vendas',       label:'Quantidade de vendas', unidade:'un'  },
  { chave:'ticket',       label:'Ticket médio',         unidade:'R$'  },
  { chave:'investimento', label:'Investimento',         unidade:'R$'  },
];
const CENARIOS = ['conservador','alvo','otimista'];

function BlocoImaginacao({ metricas, onSalvar }) {
  const valor = (cen, ch) => {
    const m = metricas.find(x => x.cenario === cen && x.indicador === ch);
    return m ? m.valor : '';
  };
  const faturamento = cen => {
    const v = Number(valor(cen,'vendas')) || 0;
    const t = Number(valor(cen,'ticket')) || 0;
    return v * t;
  };
  const roas = cen => {
    const i = Number(valor(cen,'investimento')) || 0;
    return i > 0 ? (faturamento(cen) / i) : 0;
  };
  // Leads necessários pela taxa do Samuel: piso de 5%, alvo de 8%.
  const leads = (cen, taxa) => {
    const v = Number(valor(cen,'vendas')) || 0;
    return taxa > 0 ? Math.round(v / taxa) : 0;
  };

  return (
    <SectionCard title="Imaginação primária"
      right={<span style={{ fontSize:11, color:'var(--text-3)',
        fontFamily:'Roboto,sans-serif' }}>preencha antes de qualquer tarefa</span>}>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:520 }}>
          <thead>
            <tr>
              <th style={{ textAlign:'left', padding:'6px 8px', fontSize:11,
                fontFamily:'Roboto,sans-serif', color:'var(--text-3)', fontWeight:700 }}></th>
              {CENARIOS.map(c => (
                <th key={c} style={{ textAlign:'right', padding:'6px 8px', fontSize:11,
                  fontFamily:'Roboto,sans-serif', color:'var(--text-2)', fontWeight:700,
                  textTransform:'capitalize' }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {INDICADORES_IMAGINACAO.map(ind => (
              <tr key={ind.chave}>
                <td style={{ padding:'5px 8px', fontSize:12, fontFamily:'Roboto,sans-serif',
                  color:'var(--text-2)', whiteSpace:'nowrap' }}>{ind.label}</td>
                {CENARIOS.map(c => (
                  <td key={c} style={{ padding:'3px 8px', textAlign:'right' }}>
                    <input
                      type="number" defaultValue={valor(c, ind.chave)}
                      onBlur={e => onSalvar(c, ind.chave, e.target.value, ind.unidade)}
                      style={{ width:'100%', maxWidth:120, textAlign:'right', padding:'5px 7px',
                        borderRadius:6, border:'1px solid var(--app-border)',
                        background:'rgba(255,255,255,.03)', color:'var(--text-1)',
                        fontSize:12, fontFamily:'Roboto,sans-serif',
                        fontVariantNumeric:'tabular-nums' }}/>
                  </td>
                ))}
              </tr>
            ))}
            <tr style={{ borderTop:'1px solid var(--app-border)' }}>
              <td style={{ padding:'7px 8px', fontSize:12, fontFamily:'Roboto,sans-serif',
                color:'var(--text-1)', fontWeight:700 }}>Faturamento</td>
              {CENARIOS.map(c => (
                <td key={c} style={{ padding:'7px 8px', textAlign:'right', fontSize:12.5,
                  fontFamily:'Roboto,sans-serif', fontWeight:700, color:'#4ade80',
                  fontVariantNumeric:'tabular-nums' }}>
                  {fmtBRL ? fmtBRL(faturamento(c)) : faturamento(c)}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ padding:'5px 8px', fontSize:12, fontFamily:'Roboto,sans-serif',
                color:'var(--text-2)' }}>ROAS</td>
              {CENARIOS.map(c => (
                <td key={c} style={{ padding:'5px 8px', textAlign:'right', fontSize:12,
                  fontFamily:'Roboto,sans-serif', color:'var(--text-2)',
                  fontVariantNumeric:'tabular-nums' }}>
                  {roas(c) ? roas(c).toFixed(2) : '—'}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ padding:'5px 8px', fontSize:12, fontFamily:'Roboto,sans-serif',
                color:'var(--text-2)' }} title="Conversão de lead em venda: piso de 5% na Black">
                Leads a 5%
              </td>
              {CENARIOS.map(c => (
                <td key={c} style={{ padding:'5px 8px', textAlign:'right', fontSize:12,
                  fontFamily:'Roboto,sans-serif', color:'var(--text-2)',
                  fontVariantNumeric:'tabular-nums' }}>
                  {leads(c, .05) || '—'}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ padding:'5px 8px', fontSize:12, fontFamily:'Roboto,sans-serif',
                color:'var(--text-2)' }}>Leads a 8%</td>
              {CENARIOS.map(c => (
                <td key={c} style={{ padding:'5px 8px', textAlign:'right', fontSize:12,
                  fontFamily:'Roboto,sans-serif', color:'var(--text-2)',
                  fontVariantNumeric:'tabular-nums' }}>
                  {leads(c, .08) || '—'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', color:'var(--text-3)',
        marginTop:9, lineHeight:1.45 }}>
        Faturamento, ROAS e leads se calculam sozinhos. A conversão de lead em venda no pico
        fica entre 5% e 10%, com 5% como piso.
      </div>
    </SectionCard>
  );
}


/* ── Plano de mídia ─────────────────────────────────────────────
   Reconstrução da planilha de planejamento do retiro, a partir dos
   campos do slide 8 e da lógica narrada na aula. Os percentuais por
   etapa são estimativa nossa e ficam editáveis.

   A escada de cálculo:
     faturamento / ticket líquido  → vendas
     vendas / taxa de conversão    → leads
     leads × CPL                   → verba de captação
     verba de captação / percentual da captação → verba total
     verba total × percentual da etapa → verba da etapa
     verba da etapa / dias da etapa    → verba por dia
──────────────────────────────────────────────────────────────────*/
const ETAPAS_MIDIA = [
  { chave:'teaser',      label:'Teaser',      cor:'#38bdf8', objetivo:'Engajamento, 1-3-3, ABO',        dias:'dias_teaser',      fixa:'pct_teaser' },
  { chave:'captacao',    label:'Captura de Leads', cor:'#a78bfa', objetivo:'Leads, CBO, 4 conjuntos',   dias:'dias_captacao',    fixa:null },
  { chave:'aquecimento', label:'Aquecimento', cor:'#fbbf24', objetivo:'Relacionamento e lembrete, 50/50', dias:'dias_aquecimento', fixa:'pct_aquecimento' },
  { chave:'remarketing', label:'Remarketing', cor:'#4ade80', objetivo:'Vendas, evento Compra, CBO',     dias:'dias_remarketing', fixa:null },
];

/* Rateio das 6 campanhas de lembrete, direto do slide do retiro. */
const RATEIO_LEMBRETE = [
  ['Faltam 7 dias', .07], ['Faltam 5 dias', .10], ['Faltam 3 dias', .15],
  ['É amanhã', .15],      ['É hoje', .25],        ['Estamos ao vivo', .28],
];

/* Fórmula da planilha oficial: o remarketing sobe conforme os dias,
   de 27,5% em 7 dias até 41% em 20 dias, interpolado. */
function pctRemarketing(dias) {
  const d = Number(dias) || 7;
  return Math.min(0.41, Math.max(0.275, 0.275 + ((d - 7) / 13) * (0.41 - 0.275)));
}

function CampoNum({ label, valor, onSalvar, sufixo, dica, passo }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
      <span title={dica} style={{ flex:1, fontSize:12, fontFamily:'Roboto,sans-serif',
        color:'var(--text-2)', minWidth:0, cursor: dica ? 'help' : 'default',
        borderBottom: dica ? '1px dotted var(--app-border)' : 'none' }}>{label}</span>
      <input type="number" step={passo || 'any'} defaultValue={valor ?? ''}
        onBlur={e => onSalvar(e.target.value === '' ? null : Number(e.target.value))}
        style={{ width:92, textAlign:'right', padding:'5px 7px', borderRadius:6,
          border:'1px solid var(--app-border)', background:'rgba(255,255,255,.03)',
          color:'var(--text-1)', fontSize:12, fontFamily:'Roboto,sans-serif',
          fontVariantNumeric:'tabular-nums' }}/>
      {sufixo && <span style={{ fontSize:11, color:'var(--text-3)', width:22,
        fontFamily:'Roboto,sans-serif' }}>{sufixo}</span>}
    </div>
  );
}

function LinhaCalc({ label, valor, destaque, alerta, dica }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
      gap:8, padding:'4px 0' }}>
      <span title={dica} style={{ fontSize:12, fontFamily:'Roboto,sans-serif',
        color: destaque ? 'var(--text-1)' : 'var(--text-2)',
        fontWeight: destaque ? 700 : 400, cursor: dica ? 'help' : 'default' }}>{label}</span>
      <span style={{ fontSize: destaque ? 13 : 12, fontFamily:'Roboto,sans-serif',
        fontWeight:700, fontVariantNumeric:'tabular-nums',
        color: alerta ? '#fb923c' : destaque ? '#4ade80' : 'var(--text-1)' }}>{valor}</span>
    </div>
  );
}

function BlocoPlanoMidia({ plano, onSalvar }) {
  const p = plano || {};
  const set = (k) => (v) => onSalvar({ ...p, [k]: v });
  const brl = v => window.fmtBRL ? window.fmtBRL(v) : ('R$ ' + (v||0).toFixed(2));

  const ticket  = Number(p.ticket_liquido) || 0;
  const vendas  = Number(p.vendas_meta) || 0;
  const taxa    = Number(p.taxa_conversao) || 0;
  const cpl     = Number(p.cpl_meta) || 0;
  const imposto = Number(p.imposto_meta) || 0;

  /* A escada da planilha oficial:
       leads = vendas / conversão
       verba de captação = leads × CPL
       investimento em mídia = verba de captação / % da captação
     A captação é o que sobra depois de teaser, aquecimento e remarketing. */
  const pctTeaser = Number(p.pct_teaser) ?? 0.04;
  const pctAquec  = Number(p.pct_aquecimento) ?? 0.05;
  const pctRmk    = pctRemarketing(p.dias_remarketing);
  const pctCapt   = 1 - pctTeaser - pctAquec - pctRmk;

  const leads       = taxa > 0 ? Math.ceil(vendas / taxa) : 0;
  const faturamento = vendas * ticket;
  const verbaCapt   = leads * cpl;
  const midia       = pctCapt > 0 ? verbaCapt / pctCapt : 0;
  const impostoRS   = midia * imposto;
  const totalComImp = midia + impostoRS;
  const roas        = midia > 0 ? faturamento / midia : 0;   // sobre mídia, sem imposto
  const cac         = vendas > 0 ? totalComImp / vendas : 0;

  const pctDaEtapa = { teaser:pctTeaser, captacao:pctCapt, aquecimento:pctAquec, remarketing:pctRmk };
  const verbaLembrete = midia * pctAquec * 0.5;
  const dRmk = Number(p.dias_remarketing) || 0;

  return (
    <SectionCard title="Plano de mídia"
      right={<span style={{ fontSize:11, color:'var(--text-3)',
        fontFamily:'Roboto,sans-serif' }}>a meta vira verba por dia</span>}>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))', gap:16 }}>

        <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
          <div style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
            color:'var(--text-3)', letterSpacing:.4, textTransform:'uppercase' }}>Você define</div>
          <CampoNum label="Vendas esperadas" valor={p.vendas_meta} onSalvar={set('vendas_meta')} sufixo="un"/>
          <CampoNum label="Ticket do produto" valor={p.ticket_liquido} onSalvar={set('ticket_liquido')}
            sufixo="R$" dica="Já descontada a taxa da plataforma. É o que entra de verdade."/>
          <CampoNum label="Conversão de leads" valor={p.taxa_conversao} onSalvar={set('taxa_conversao')}
            sufixo="%" passo="0.01" dica="No pico fica entre 5% e 10%. O piso é 5%, a planilha usa 7%. Digite 0.07 para 7%."/>
          <CampoNum label="Custo por lead" valor={p.cpl_meta} onSalvar={set('cpl_meta')}
            sufixo="R$" dica="No pico o lead custa de 2 a 3 vezes o normal."/>
          <CampoNum label="Imposto do Meta" valor={p.imposto_meta} onSalvar={set('imposto_meta')}
            sufixo="%" passo="0.0001" dica="A planilha usa 0.1215, ou seja 12,15%."/>
          <CampoNum label="Dias de remarketing" valor={p.dias_remarketing} onSalvar={set('dias_remarketing')}
            sufixo="d" dica="Entre 7 e 20. O percentual da fase se ajusta sozinho, de 27,5% a 41%."/>
          <CampoNum label="Quantidade de anúncios" valor={p.qtd_anuncios} onSalvar={set('qtd_anuncios')}
            sufixo="un" dica="A referência do retiro é 20 anúncios."/>
          {dRmk > 0 && (dRmk < 7 || dRmk > 20) && (
            <div style={{ fontSize:10.5, color:'#fb923c', fontFamily:'Roboto,sans-serif',
              lineHeight:1.4 }}>
              A planilha trabalha entre 7 e 20 dias de remarketing.
            </div>
          )}
        </div>

        <div style={{ display:'flex', flexDirection:'column' }}>
          <div style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
            color:'var(--text-3)', letterSpacing:.4, textTransform:'uppercase',
            marginBottom:4 }}>A conta devolve</div>
          <LinhaCalc label="Leads necessários" valor={leads ? leads.toLocaleString('pt-BR') : '—'}
            dica="Vendas divididas pela taxa de conversão."/>
          <LinhaCalc label="Faturamento líquido" valor={brl(faturamento)} destaque/>
          <LinhaCalc label="Investimento em mídia" valor={brl(midia)} destaque
            dica="Verba de captação dividida pelo percentual da captação."/>
          <LinhaCalc label="Imposto do Meta" valor={brl(impostoRS)}/>
          <LinhaCalc label="Investimento total" valor={brl(totalComImp)} destaque/>
          <LinhaCalc label="ROAS sobre mídia" valor={roas ? roas.toFixed(2) : '—'}
            alerta={roas > 0 && roas < 2} dica="Faturamento dividido pela mídia, sem o imposto."/>
          <LinhaCalc label="CAC" valor={cac ? brl(cac) : '—'}
            dica="Investimento total dividido pelas vendas."/>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <div style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
            color:'var(--text-3)', letterSpacing:.4, textTransform:'uppercase' }}>
            Verba por fase
          </div>
          {ETAPAS_MIDIA.map(e => {
            const pct = pctDaEtapa[e.chave] || 0;
            const verba = midia * pct;
            const dias = Number(p[e.dias]) || 0;
            return (
              <div key={e.chave} style={{ padding:'6px 8px', borderRadius:7,
                background:'rgba(255,255,255,.025)', border:'1px solid var(--app-border)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                  <span style={{ width:6, height:6, borderRadius:99, background:e.cor }}/>
                  <span style={{ flex:1, fontSize:11.5, fontFamily:'Roboto,sans-serif',
                    fontWeight:700, color:'var(--text-1)' }}>{e.label}</span>
                  {e.fixa ? (
                    <input type="number" step="0.01" defaultValue={pct}
                      onBlur={ev => set(e.fixa)(Number(ev.target.value))}
                      style={{ width:50, textAlign:'right', padding:'2px 5px', borderRadius:5,
                        border:'1px solid var(--app-border)', background:'transparent',
                        color:'var(--text-2)', fontSize:11, fontFamily:'Roboto,sans-serif' }}/>
                  ) : (
                    <span title={e.chave === 'captacao'
                        ? 'Calculada: o que sobra das outras tres'
                        : 'Calculada pelos dias de remarketing'}
                      style={{ width:50, textAlign:'right', fontSize:11, fontWeight:700,
                        fontFamily:'Roboto,sans-serif', color:'var(--text-3)',
                        fontVariantNumeric:'tabular-nums' }}>
                      {(pct*100).toFixed(1)}%
                    </span>
                  )}
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', gap:6,
                  fontSize:11, fontFamily:'Roboto,sans-serif', color:'var(--text-3)',
                  fontVariantNumeric:'tabular-nums' }}>
                  <span>{brl(verba)}</span>
                  <span>{dias > 0 ? `${brl(verba / dias)} por dia` : ''}</span>
                </div>
                <div style={{ fontSize:10, fontFamily:'Roboto,sans-serif',
                  color:'var(--text-3)', opacity:.7, marginTop:2 }}>{e.objetivo}</div>
              </div>
            );
          })}
          {pctCapt <= 0 && (
            <div style={{ fontSize:10.5, color:'#f87171', fontFamily:'Roboto,sans-serif' }}>
              As outras fases consumiram tudo. Não sobra verba para a captação.
            </div>
          )}
        </div>
      </div>

      {verbaLembrete > 0 && (
        <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid var(--app-border)' }}>
          <div style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
            color:'var(--text-3)', letterSpacing:.4, textTransform:'uppercase',
            marginBottom:7 }}>
            As 6 campanhas de lembrete, com orçamento total
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(118px,1fr))',
            gap:7 }}>
            {RATEIO_LEMBRETE.map(([nome, pct]) => (
              <div key={nome} style={{ padding:'6px 8px', borderRadius:7,
                background:'rgba(255,255,255,.025)', border:'1px solid var(--app-border)' }}>
                <div style={{ fontSize:11, fontFamily:'Roboto,sans-serif', fontWeight:700,
                  color:'var(--text-2)' }}>{nome}</div>
                <div style={{ fontSize:12, fontFamily:'Roboto,sans-serif', fontWeight:700,
                  color:'var(--text-1)', fontVariantNumeric:'tabular-nums' }}>
                  {brl(verbaLembrete * pct)}
                </div>
                <div style={{ fontSize:10, color:'var(--text-3)',
                  fontFamily:'Roboto,sans-serif' }}>{(pct*100).toFixed(0)}%</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', color:'var(--text-3)',
            marginTop:7, lineHeight:1.45 }}>
            Uma campanha por dia, orçamento total, programada para rodar das 00:00 às 23:59.
            Programe antes, nunca no próprio dia.
          </div>
        </div>
      )}

      <div style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', color:'var(--text-3)',
        marginTop:11, lineHeight:1.45 }}>
        Percentuais e fórmulas da planilha oficial do retiro. Teaser e aquecimento são fixos,
        o remarketing sobe conforme os dias, e a captação é o que sobra.
      </div>
    </SectionCard>
  );
}


/* ── Calendário ─────────────────────────────────────────────────
   Mês a mês, com as tarefas nos dias. Marca feriado, datas de
   atenção e o D0, para a decisão de data acontecer olhando o mapa.
──────────────────────────────────────────────────────────────────*/
const MESES = ['janeiro','fevereiro','março','abril','maio','junho',
  'julho','agosto','setembro','outubro','novembro','dezembro'];

function Calendario({ tarefas, d0, onAbrir }) {
  const inicial = d0 ? d0.slice(0, 7) : hojeISO().slice(0, 7);
  const [mes, setMes] = useState(inicial);
  const [diaAberto, setDiaAberto] = useState(null);

  const [ano, m] = mes.split('-').map(Number);
  const primeiro = new Date(ano, m - 1, 1);
  const totalDias = new Date(ano, m, 0).getDate();
  const vazios = primeiro.getDay();

  const porDia = useMemo(() => {
    const g = {};
    tarefas.forEach(t => { if (t.data_prevista) (g[t.data_prevista] ||= []).push(t); });
    return g;
  }, [tarefas]);

  /* Só navega entre meses que têm tarefa, mais o mês do D0. */
  const mesesComTarefa = useMemo(() => {
    const set = new Set(tarefas.filter(t=>t.data_prevista).map(t => t.data_prevista.slice(0,7)));
    if (d0) set.add(d0.slice(0,7));
    return [...set].sort();
  }, [tarefas, d0]);

  const idx = mesesComTarefa.indexOf(mes);
  const irPara = (delta) => {
    const novo = mesesComTarefa[idx + delta];
    if (novo) { setMes(novo); setDiaAberto(null); }
  };

  const hoje = hojeISO();
  const celulas = [];
  for (let i = 0; i < vazios; i++) celulas.push(null);
  for (let d = 1; d <= totalDias; d++) {
    celulas.push(`${ano}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
  }

  const tarefasDoDia = diaAberto ? (porDia[diaAberto] || []) : [];

  return (
    <SectionCard
      title={
        <span style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={()=>irPara(-1)} disabled={idx <= 0}
            style={{ background:'none', border:'none', cursor: idx>0?'pointer':'default',
              color: idx>0?'var(--text-2)':'var(--text-3)', opacity: idx>0?1:.35,
              padding:2, display:'flex' }}>
            <LucideIcon icon="chevron-left" size={16}/>
          </button>
          <span style={{ textTransform:'capitalize', minWidth:130 }}>
            {MESES[m-1]} de {ano}
          </span>
          <button onClick={()=>irPara(1)} disabled={idx >= mesesComTarefa.length-1}
            style={{ background:'none', border:'none',
              cursor: idx<mesesComTarefa.length-1?'pointer':'default',
              color: idx<mesesComTarefa.length-1?'var(--text-2)':'var(--text-3)',
              opacity: idx<mesesComTarefa.length-1?1:.35, padding:2, display:'flex' }}>
            <LucideIcon icon="chevron-right" size={16}/>
          </button>
        </span>
      }
      right={
        <div style={{ display:'flex', gap:9, flexWrap:'wrap', alignItems:'center' }}>
          {FASES.filter(f => tarefas.some(t => t.fase===f.id &&
              t.data_prevista && t.data_prevista.slice(0,7)===mes)).map(f => (
            <span key={f.id} style={{ display:'flex', alignItems:'center', gap:4,
              fontSize:10, fontFamily:'Roboto,sans-serif', color:'var(--text-3)' }}>
              <span style={{ width:6, height:6, borderRadius:99, background:f.cor }}/>
              {f.label}
            </span>
          ))}
        </div>
      }
    >
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
        {['dom','seg','ter','qua','qui','sex','sáb'].map(d => (
          <div key={d} style={{ textAlign:'center', fontSize:10, fontWeight:700,
            fontFamily:'Roboto,sans-serif', color:'var(--text-3)', padding:'2px 0',
            textTransform:'uppercase', letterSpacing:.3 }}>{d}</div>
        ))}

        {celulas.map((iso, i) => {
          if (!iso) return <div key={'v'+i}/>;
          const lista = porDia[iso] || [];
          const fer = feriadoDe(iso);
          const ate = atencaoDe(iso);
          const ehD0 = iso === d0;
          const ehHoje = iso === hoje;
          const feitas = lista.filter(t => t.status === 'feito').length;
          const todasFeitas = lista.length > 0 && feitas === lista.length;

          return (
            <div key={iso}
              onClick={()=>lista.length && setDiaAberto(diaAberto === iso ? null : iso)}
              style={{ minHeight:74, padding:'5px 6px', borderRadius:8,
                cursor: lista.length ? 'pointer' : 'default',
                background: ehD0 ? 'rgba(248,113,113,.12)'
                          : diaAberto === iso ? 'rgba(255,255,255,.07)'
                          : lista.length ? 'rgba(255,255,255,.025)' : 'transparent',
                border:'1px solid ' + (ehD0 ? 'rgba(248,113,113,.45)'
                          : ehHoje ? 'rgba(56,189,248,.45)'
                          : fer || ate ? 'rgba(251,146,60,.3)'
                          : 'var(--app-border)'),
                display:'flex', flexDirection:'column', gap:3, overflow:'hidden' }}>

              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                gap:3 }}>
                <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif',
                  fontWeight: ehD0 || ehHoje ? 700 : 400,
                  color: ehD0 ? '#f87171' : ehHoje ? '#38bdf8' : 'var(--text-2)',
                  fontVariantNumeric:'tabular-nums' }}>
                  {Number(iso.slice(8))}
                </span>
                {ehD0 && <span style={{ fontSize:8.5, fontWeight:700, color:'#f87171',
                  fontFamily:'Roboto,sans-serif', letterSpacing:.3 }}>D0</span>}
                {!ehD0 && (fer || ate) && (
                  <span title={fer || ate} style={{ color:'#fb923c', display:'flex' }}>
                    <LucideIcon icon="alert-triangle" size={9}/>
                  </span>
                )}
                {todasFeitas && <LucideIcon icon="check" size={10} style={{ color:'#4ade80' }}/>}
              </div>

              {lista.slice(0, 3).map(t => {
                const f = FASE_MAP[t.fase] || {};
                return (
                  <div key={t.id} title={t.titulo}
                    style={{ fontSize:9, fontFamily:'Roboto,sans-serif', lineHeight:1.25,
                      padding:'1px 3px', borderRadius:3, background: (f.cor||'#666') + '22',
                      color: t.status === 'feito' ? 'var(--text-3)' : 'var(--text-2)',
                      textDecoration: t.status === 'feito' ? 'line-through' : 'none',
                      borderLeft:'2px solid ' + (f.cor || '#666'),
                      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {t.titulo}
                  </div>
                );
              })}
              {lista.length > 3 && (
                <div style={{ fontSize:8.5, fontFamily:'Roboto,sans-serif',
                  color:'var(--text-3)', paddingLeft:3 }}>
                  mais {lista.length - 3}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Detalhe do dia clicado */}
      {diaAberto && tarefasDoDia.length > 0 && (
        <div style={{ marginTop:12, paddingTop:11, borderTop:'1px solid var(--app-border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
            <span style={{ fontSize:12, fontFamily:'Roboto,sans-serif', fontWeight:700,
              color:'var(--text-1)' }}>
              {fmtData(diaAberto)}, {diaSemana(diaAberto)}
            </span>
            {feriadoDe(diaAberto) && <Badge tone="warn">{feriadoDe(diaAberto)}</Badge>}
            {atencaoDe(diaAberto) && <Badge tone="warn">{atencaoDe(diaAberto)}</Badge>}
            <span style={{ fontSize:11, color:'var(--text-3)',
              fontFamily:'Roboto,sans-serif' }}>
              {tarefasDoDia.length} tarefa{tarefasDoDia.length>1?'s':''}
            </span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
            {tarefasDoDia.map(t => (
              <LinhaTarefa key={t.id} t={t} onToggle={onAbrir.toggle}
                onAbrir={()=>{}} mostrarTrilha onVirarCard={onAbrir.virarCard}/>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

/* ── Tela principal ─────────────────────────────────────────────*/
function PicoScreen() {
  const [projetos, setProjetos]   = useState([]);
  const [projetoId, setProjetoId] = useState(null);
  const [tarefas, setTarefas]     = useState([]);
  const [decisoes, setDecisoes]   = useState([]);
  const [metricas, setMetricas]   = useState([]);
  const [visao, setVisao]         = useState('fase');   // fase | trilha | calendario
  const [filtroTrilha, setFiltroTrilha] = useState('todas');
  const [ocultarFeitas, setOcultarFeitas] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const projeto = projetos.find(p => p.id === projetoId) || null;

  /* Carregar projetos */
  useEffect(() => {
    (async () => {
      const { data } = await window.db.from('pico_projetos')
        .select('*').order('criado_em', { ascending:false });
      setProjetos(data || []);
      if (data && data.length && !projetoId) setProjetoId(data[0].id);
      setCarregando(false);
    })();
  }, []);

  /* Carregar o conteúdo do projeto escolhido */
  useEffect(() => {
    if (!projetoId) { setTarefas([]); setDecisoes([]); setMetricas([]); return; }
    (async () => {
      const [t, d, m] = await Promise.all([
        window.db.from('pico_tarefas').select('*')
          .eq('projeto_id', projetoId).order('offset_dias').order('ordem'),
        window.db.from('pico_decisoes').select('*')
          .eq('projeto_id', projetoId).order('ordem'),
        window.db.from('pico_metricas').select('*')
          .eq('projeto_id', projetoId),
      ]);
      setTarefas(t.data || []);
      setDecisoes(d.data || []);
      setMetricas(m.data || []);
    })();
  }, [projetoId]);

  /* Marcar tarefa */
  const alternarTarefa = async (t) => {
    const novo = t.status === 'feito' ? 'pendente' : 'feito';
    setTarefas(ts => ts.map(x => x.id === t.id
      ? { ...x, status:novo, data_conclusao: novo === 'feito' ? hojeISO() : null } : x));
    await window.db.from('pico_tarefas')
      .update({ status:novo, data_conclusao: novo === 'feito' ? hojeISO() : null })
      .eq('id', t.id);
  };

  /* Escolher decisão */
  const escolherDecisao = async (d, escolha) => {
    setDecisoes(ds => ds.map(x => x.id === d.id
      ? { ...x, escolha, decidido_em: escolha ? new Date().toISOString() : null } : x));
    await window.db.from('pico_decisoes')
      .update({ escolha, decidido_em: escolha ? new Date().toISOString() : null })
      .eq('id', d.id);
  };

  /* Salvar métrica da imaginação primária */
  const salvarMetrica = async (cenario, indicador, valor, unidade) => {
    const v = valor === '' ? null : Number(valor);
    const existente = metricas.find(m =>
      m.cenario === cenario && m.indicador === indicador && m.momento === 'imaginacao');
    if (existente) {
      setMetricas(ms => ms.map(m => m.id === existente.id ? { ...m, valor:v } : m));
      await window.db.from('pico_metricas').update({ valor:v }).eq('id', existente.id);
    } else {
      const { data } = await window.db.from('pico_metricas').insert({
        projeto_id: projetoId, momento:'imaginacao', cenario, indicador, valor:v, unidade,
      }).select().single();
      if (data) setMetricas(ms => [...ms, data]);
    }
  };

  /* Tarefa vira card no kanban, já marcada com o projeto */
  const [aviso, setAviso] = useState(null);
  const virarCard = async (t) => {
    try {
      const r = await criarCardDaTarefa(t, projeto);
      const marca = `${r.tipo}: ${r.rotulo}`;
      await window.db.from('pico_tarefas')
        .update({ entregavel_url: marca, status: t.status === 'pendente' ? 'fazendo' : t.status })
        .eq('id', t.id);
      setTarefas(ts => ts.map(x => x.id === t.id
        ? { ...x, entregavel_url: marca, status: x.status === 'pendente' ? 'fazendo' : x.status }
        : x));
      setAviso({ tipo:'ok', texto:`Card criado em ${r.tipo}: ${r.rotulo}`, hash:r.hash });
    } catch (e) {
      setAviso({ tipo:'erro', texto: e.message });
    }
    setTimeout(() => setAviso(null), 6000);
  };

  /* Salvar o plano de mídia */
  const salvarPlano = async (novo) => {
    setProjetos(ps => ps.map(p => p.id === projetoId ? { ...p, plano_midia:novo } : p));
    await window.db.from('pico_projetos').update({ plano_midia: novo }).eq('id', projetoId);
  };

  /* Trocar o D0: o banco recalcula as datas não travadas sozinho */
  const mudarAbertura = async (novaData) => {
    if (!projeto) return;
    setProjetos(ps => ps.map(p => p.id === projetoId ? { ...p, data_abertura:novaData } : p));
    await window.db.from('pico_projetos')
      .update({ data_abertura: novaData }).eq('id', projetoId);
    const { data } = await window.db.from('pico_tarefas').select('*')
      .eq('projeto_id', projetoId).order('offset_dias').order('ordem');
    setTarefas(data || []);
  };

  /* Recortes */
  const visiveis = useMemo(() => tarefas.filter(t =>
    (filtroTrilha === 'todas' || t.trilha === filtroTrilha) &&
    (!ocultarFeitas || t.status !== 'feito')
  ), [tarefas, filtroTrilha, ocultarFeitas]);

  const feitas = tarefas.filter(t => t.status === 'feito').length;
  const atrasadas = tarefas.filter(t =>
    t.status !== 'feito' && t.status !== 'pulada' &&
    t.data_prevista && t.data_prevista < hojeISO()).length;
  const diasParaD0 = projeto?.data_abertura ? diasEntre(hojeISO(), projeto.data_abertura) : null;

  const porGrupo = useMemo(() => {
    if (visao === 'calendario') return {};
    const chave = visao === 'trilha' ? 'trilha' : 'fase';
    const g = {};
    visiveis.forEach(t => { (g[t[chave]] ||= []).push(t); });
    return g;
  }, [visiveis, visao]);

  const ordemGrupos = visao === 'trilha'
    ? TRILHAS.map(t => t.id)
    : FASES.map(f => f.id);

  if (carregando) {
    return (
      <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
        <TopBar title="Picos de Venda"/>
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
          color:'var(--text-3)', fontFamily:'Roboto,sans-serif', fontSize:13 }}>
          Carregando
        </div>
      </div>
    );
  }

  if (!projetos.length) {
    return (
      <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
        <TopBar title="Picos de Venda"/>
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
          justifyContent:'center', gap:14, color:'var(--text-3)' }}>
          <LucideIcon icon="calendar-clock" size={30}/>
          <div style={{ textAlign:'center', maxWidth:380 }}>
            <div style={{ fontSize:14, fontFamily:'Roboto,sans-serif', fontWeight:700,
              color:'var(--text-2)', marginBottom:6 }}>Nenhum pico criado ainda</div>
            <div style={{ fontSize:12, fontFamily:'Roboto,sans-serif', lineHeight:1.5 }}>
              Um pico de vendas nasce de um template, com uma data de abertura.
              Todas as tarefas se posicionam sozinhas a partir dela.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <TopBar title="Picos de Venda"/>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 18px 30px' }}>

        {aviso && (
          <div style={{ marginBottom:11, padding:'8px 12px', borderRadius:8,
            display:'flex', alignItems:'center', gap:9,
            background: aviso.tipo === 'ok' ? 'rgba(74,222,128,.1)' : 'rgba(248,113,113,.1)',
            border:'1px solid ' + (aviso.tipo === 'ok' ? 'rgba(74,222,128,.3)' : 'rgba(248,113,113,.3)') }}>
            <LucideIcon icon={aviso.tipo === 'ok' ? 'check-circle' : 'alert-circle'} size={14}
              style={{ color: aviso.tipo === 'ok' ? '#4ade80' : '#f87171' }}/>
            <span style={{ flex:1, fontSize:12, fontFamily:'Roboto,sans-serif',
              color:'var(--text-1)' }}>{aviso.texto}</span>
            {aviso.hash && (
              <a href={aviso.hash} style={{ fontSize:11.5, fontFamily:'Roboto,sans-serif',
                fontWeight:700, color:'#4ade80', textDecoration:'none' }}>abrir</a>
            )}
          </div>
        )}

        {/* Cabeçalho: projeto, D0 e progresso */}
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap',
          marginBottom:14 }}>
          <select value={projetoId || ''} onChange={e=>setProjetoId(e.target.value)}
            style={{ padding:'7px 11px', borderRadius:8, border:'1px solid var(--app-border)',
              background:'rgba(255,255,255,.04)', color:'var(--text-1)', fontSize:13,
              fontFamily:'Roboto,sans-serif', fontWeight:700, cursor:'pointer' }}>
            {projetos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>

          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <span style={{ fontSize:11.5, fontFamily:'Roboto,sans-serif',
              color:'var(--text-3)' }}>Abre em</span>
            <input type="date" value={projeto?.data_abertura || ''}
              onChange={e=>mudarAbertura(e.target.value)}
              style={{ padding:'6px 9px', borderRadius:7, border:'1px solid var(--app-border)',
                background:'rgba(255,255,255,.04)', color:'var(--text-1)', fontSize:12,
                fontFamily:'Roboto,sans-serif' }}/>
            {projeto?.data_abertura && feriadoDe(projeto.data_abertura) && (
              <Badge tone="warn">feriado: {feriadoDe(projeto.data_abertura)}</Badge>
            )}
          </div>

          {diasParaD0 !== null && (
            <Badge tone={diasParaD0 < 0 ? 'ok' : diasParaD0 < 15 ? 'warn' : 'neutral'}>
              {diasParaD0 > 0 ? `faltam ${diasParaD0} dias`
                : diasParaD0 === 0 ? 'é hoje'
                : `carrinho aberto há ${Math.abs(diasParaD0)} dias`}
            </Badge>
          )}
          {atrasadas > 0 && <Badge tone="danger">{atrasadas} atrasada{atrasadas>1?'s':''}</Badge>}

          <div style={{ flex:1, minWidth:120, maxWidth:260 }}>
            <Progresso feitas={feitas} total={tarefas.length}/>
          </div>
        </div>

        {/* Imaginação primária e decisões */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(340px,1fr))',
          gap:14, marginBottom:14 }}>
          <BlocoImaginacao metricas={metricas.filter(m=>m.momento==='imaginacao')}
            onSalvar={salvarMetrica}/>
          <BlocoDecisoes decisoes={decisoes} onEscolher={escolherDecisao}/>
        </div>

        <div style={{ marginBottom:14 }}>
          <BlocoPlanoMidia plano={projeto?.plano_midia} onSalvar={salvarPlano}/>
        </div>

        {/* Controles da execução */}
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap',
          marginBottom:11 }}>
          <div style={{ display:'flex', gap:4, padding:3, borderRadius:8,
            background:'rgba(255,255,255,.04)' }}>
            {[['fase','Por fase'],['trilha','Por trilha'],['calendario','Calendário']].map(([id,lb]) => (
              <button key={id} onClick={()=>setVisao(id)}
                style={{ padding:'5px 11px', borderRadius:6, cursor:'pointer', border:'none',
                  fontSize:11.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
                  background: visao===id ? 'rgba(255,255,255,.08)' : 'transparent',
                  color: visao===id ? 'var(--text-1)' : 'var(--text-3)' }}>{lb}</button>
            ))}
          </div>

          <select value={filtroTrilha} onChange={e=>setFiltroTrilha(e.target.value)}
            style={{ padding:'6px 10px', borderRadius:7, border:'1px solid var(--app-border)',
              background:'rgba(255,255,255,.04)', color:'var(--text-2)', fontSize:11.5,
              fontFamily:'Roboto,sans-serif', cursor:'pointer' }}>
            <option value="todas">Todas as trilhas</option>
            {TRILHAS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>

          <button onClick={()=>setOcultarFeitas(v=>!v)}
            style={{ padding:'6px 11px', borderRadius:7, cursor:'pointer',
              border:'1px solid var(--app-border)', fontSize:11.5,
              fontFamily:'Roboto,sans-serif', fontWeight:700,
              background: ocultarFeitas ? 'rgba(74,222,128,.12)' : 'transparent',
              color: ocultarFeitas ? '#4ade80' : 'var(--text-3)' }}>
            {ocultarFeitas ? 'Mostrando pendentes' : 'Ocultar feitas'}
          </button>
        </div>

        {/* Execução */}
        {visao === 'calendario' ? (
          <Calendario tarefas={visiveis} d0={projeto?.data_abertura}
            onAbrir={{ toggle: alternarTarefa, virarCard }}/>
        ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {ordemGrupos.map(gid => {
            const lista = porGrupo[gid];
            if (!lista || !lista.length) return null;
            const cfg = visao === 'trilha' ? TRILHA_MAP[gid] : FASE_MAP[gid];
            const gf = lista.filter(t => t.status === 'feito').length;
            return (
              <SectionCard key={gid}
                title={
                  <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ width:8, height:8, borderRadius:99,
                      background: cfg?.cor || 'var(--text-3)' }}/>
                    {cfg?.label || gid}
                  </span>
                }
                right={<div style={{ width:120 }}>
                  <Progresso feitas={gf} total={lista.length} cor={cfg?.cor} altura={5}/>
                </div>}
              >
                <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                  {lista.map(t => (
                    <LinhaTarefa key={t.id} t={t} onToggle={alternarTarefa}
                      onAbrir={()=>{}} mostrarTrilha={visao === 'fase'}
                      onVirarCard={virarCard}/>
                  ))}
                </div>
              </SectionCard>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
}

window.PicoScreen = PicoScreen;
