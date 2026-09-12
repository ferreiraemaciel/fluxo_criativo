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
  validar:  { label:'Validar Felipe', cor:'#fbbf24', bg:'rgba(251,191,36,.12)' },
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
    const { data: novo, error } = await window.db.from('ads').insert({
      numero: n,
      titulo: `ADS ${String(n).padStart(3,'0')} - ${tarefa.titulo}`,
      tipo: 'imagem',
      status: 'fazer',
      pico_projeto_id: projeto.id,
    }).select('id').single();
    if (error) throw new Error(error.message);
    return { tipo:'Anúncios', rotulo:`ADS ${String(n).padStart(3,'0')}`, hash:'#criativos',
             cardTipo:'ads', cardId:novo.id, alvo:n };
  }
  if (tarefa.trilha === 'conteudo') {
    const { data: novo, error } = await window.db.from('conteudo_organico').insert({
      tema: tarefa.titulo,
      plataforma: 'Reels',
      // O Organico nao tem coluna "Fazer": a primeira e "Fazendo".
      status: 'Fazendo',
      pico_projeto_id: projeto.id,
    }).select('id').single();
    if (error) throw new Error(error.message);
    return { tipo:'Orgânico', rotulo:tarefa.titulo, hash:'#organico',
             cardTipo:'organico', cardId:novo.id, alvo:novo.id };
  }
  throw new Error('Só tarefas de Tráfego e Conteúdo viram card.');
}


/* ── Campos de número com máscara ───────────────────────────────
   Moeda entra por centavos, da direita para a esquerda, como em
   qualquer caixa: digitar 1 0 0 0 0 vira R$ 100,00. E percentual
   é digitado como as pessoas falam, 7 em vez de 0.07, guardando
   a fração no banco.
──────────────────────────────────────────────────────────────────*/
const fmtMoeda = v => (Number(v) || 0).toLocaleString('pt-BR',
  { style:'currency', currency:'BRL' });

function CampoMoeda({ valor, onSalvar, largura = 120, alinhamento = 'right', estilo }) {
  const [txt, setTxt] = useState(valor == null ? '' : fmtMoeda(valor));
  const [focado, setFocado] = useState(false);

  /* Enquanto o campo não está em foco, ele reflete o que veio de fora.
     Sem isso, um valor puxado do banco não apareceria. */
  useEffect(() => {
    if (!focado) setTxt(valor == null ? '' : fmtMoeda(valor));
  }, [valor, focado]);

  const digitar = (e) => {
    const digitos = e.target.value.replace(/\D/g, '');
    if (!digitos) { setTxt(''); return; }
    setTxt(fmtMoeda(Number(digitos) / 100));
  };

  const sair = () => {
    setFocado(false);
    const digitos = txt.replace(/\D/g, '');
    const novo = digitos ? Number(digitos) / 100 : null;
    if (novo !== valor) onSalvar(novo);
  };

  return (
    <input type="text" inputMode="numeric" value={txt} placeholder="R$ 0,00"
      onChange={digitar} onFocus={()=>setFocado(true)} onBlur={sair}
      style={{ width:largura, textAlign:alinhamento, padding:'5px 7px', borderRadius:6,
        border:'1px solid var(--app-border)', background:'rgba(255,255,255,.03)',
        color:'var(--text-1)', fontSize:12, fontFamily:'Roboto,sans-serif',
        fontVariantNumeric:'tabular-nums', ...estilo }}/>
  );
}

function CampoPercent({ valor, onSalvar, largura = 92, casas = 2 }) {
  /* No banco fica a fração (0.07). Na tela aparece o que se fala (7). */
  const paraTela = v => v == null ? '' : String(Number((v * 100).toFixed(casas)));
  const [txt, setTxt] = useState(paraTela(valor));
  const [focado, setFocado] = useState(false);

  useEffect(() => { if (!focado) setTxt(paraTela(valor)); }, [valor, focado]);

  const sair = () => {
    setFocado(false);
    const limpo = txt.replace(',', '.').replace(/[^\d.]/g, '');
    const novo = limpo === '' ? null : Number(limpo) / 100;
    if (novo !== valor) onSalvar(novo);
  };

  return (
    <div style={{ display:'flex', alignItems:'center', gap:3 }}>
      <input type="text" inputMode="decimal" value={txt} placeholder="0"
        onChange={e=>setTxt(e.target.value)} onFocus={()=>setFocado(true)} onBlur={sair}
        style={{ width:largura, textAlign:'right', padding:'5px 7px', borderRadius:6,
          border:'1px solid var(--app-border)', background:'rgba(255,255,255,.03)',
          color:'var(--text-1)', fontSize:12, fontFamily:'Roboto,sans-serif',
          fontVariantNumeric:'tabular-nums' }}/>
      <span style={{ fontSize:11, color:'var(--text-3)',
        fontFamily:'Roboto,sans-serif' }}>%</span>
    </div>
  );
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
function LinhaTarefa({ t, onToggle, onAbrir, mostrarTrilha, onVirarCard, onDefinir, onAbrirCard }) {
  const [hov, setHov] = useState(false);
  const [criando, setCriando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const temCampos = Array.isArray(t.campos) && t.campos.length > 0;
  const refs = Array.isArray(t.referencias) ? t.referencias : [];
  const abre = temCampos || refs.length > 0;
  const preenchidos = temCampos
    ? t.campos.filter(c => {
        const v = (t.definicoes || {})[c.chave];
        return v != null && v !== '' && !(Array.isArray(v) && v.length === 0);
      }).length
    : 0;
  const podeVirarCard = onVirarCard && (t.trilha === 'trafego' || t.trilha === 'conteudo')
    && !t.entregavel_url;
  const feito   = t.status === 'feito';
  const pulada  = t.status === 'pulada';
  const trilha  = TRILHA_MAP[t.trilha] || {};
  const atrasada = !feito && !pulada && t.data_prevista && t.data_prevista < hojeISO();
  const fer = feriadoDe(t.data_prevista);

  return (
    <>
    <div
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'9px 11px',
        borderRadius:9, background: hov || aberto ? 'rgba(255,255,255,.035)' : 'transparent',
        border:'1px solid ' + (atrasada ? 'rgba(248,113,113,.28)' : 'transparent'),
        transition:'background 120ms', cursor: abre ? 'pointer' : 'default' }}
      onClick={()=>{ if (abre) setAberto(a => !a); else onAbrir(t); }}
    >
      <button
        onClick={(e)=>{ e.stopPropagation(); onToggle(t); }}
        title={feito ? 'Desmarcar' : t.status === 'validar' ? 'Validar: marcar como feito' : 'Marcar como feito'}
        style={{ width:19, height:19, borderRadius:6, flexShrink:0, marginTop:1,
          border:'1.5px solid ' + (feito ? '#4ade80' : t.status === 'validar' ? '#fbbf24' : 'var(--app-border)'),
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
          {t.status === 'validar' && (
            <span title="Lançado pelo Claude. Confira e marque o check para validar"
              style={{ fontSize:9.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
                padding:'1px 6px', borderRadius:4, background:'rgba(251,191,36,.12)',
                color:'#fbbf24', border:'1px solid rgba(251,191,36,.3)', letterSpacing:.3 }}>
              VALIDAR
            </span>
          )}
        </div>
        {t.criterio_pronto && (
          <div style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'var(--text-3)',
            marginTop:2, lineHeight:1.4 }}>
            {t.criterio_pronto}
          </div>
        )}
        {t.observacoes && (
          <div style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'var(--text-2)',
            marginTop:5, padding:'4px 8px', borderRadius:6, lineHeight:1.45,
            background: t.status === 'validar' ? 'rgba(251,191,36,.07)' : feito ? 'rgba(74,222,128,.06)' : 'rgba(255,255,255,.03)',
            border:'1px solid ' + (t.status === 'validar' ? 'rgba(251,191,36,.22)' : feito ? 'rgba(74,222,128,.18)' : 'var(--app-border)') }}>
            <b style={{ color: t.status === 'validar' ? '#fbbf24' : feito ? '#4ade80' : 'var(--text-3)' }}>
              {t.status === 'validar' ? 'Para validar: ' : feito ? 'Definido: ' : pulada ? 'Motivo: ' : 'Nota: '}
            </b>
            {t.observacoes.replace(/^(Validar|Sugestão para validar|Rascunho para validar):\s*/, '')}
          </div>
        )}
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
        {temCampos && (
          <span title={preenchidos ? `${preenchidos} de ${t.campos.length} definidos`
                                   : 'Registrar o que foi definido'}
            style={{ display:'flex', alignItems:'center', gap:3, fontSize:10,
              fontFamily:'Roboto,sans-serif', fontWeight:700,
              padding:'1px 6px', borderRadius:4,
              color: preenchidos ? '#4ade80' : 'var(--text-3)',
              background: preenchidos ? 'rgba(74,222,128,.1)' : 'rgba(255,255,255,.05)',
              border:'1px solid ' + (preenchidos ? 'rgba(74,222,128,.25)' : 'var(--app-border)') }}>
            <LucideIcon icon={aberto ? 'chevron-up' : 'sliders-horizontal'} size={9}/>
            {preenchidos ? `${preenchidos}/${t.campos.length}` : 'definir'}
          </span>
        )}
        {refs.length > 0 && (
          <span title={`${refs.length} referência${refs.length > 1 ? 's' : ''} do retiro para esta tarefa`}
            style={{ display:'flex', alignItems:'center', gap:3, fontSize:10,
              fontFamily:'Roboto,sans-serif', fontWeight:700, padding:'1px 6px', borderRadius:4,
              color:'#38bdf8', background:'rgba(56,189,248,.08)',
              border:'1px solid rgba(56,189,248,.22)' }}>
            <LucideIcon icon="book-open" size={9}/>{refs.length}
          </span>
        )}
        {t.entregavel_url && (
          onAbrirCard && t.card_id ? (
            <button
              onClick={e => { e.stopPropagation(); onAbrirCard(t); }}
              title={`Abrir o card: ${t.entregavel_url}`}
              style={{ display:'flex', alignItems:'center', gap:3, padding:'1px 6px', borderRadius:4,
                cursor:'pointer', fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
                color:'#4ade80', background:'rgba(74,222,128,.1)',
                border:'1px solid rgba(74,222,128,.3)' }}>
              <LucideIcon icon="external-link" size={9}/>
              {t.card_tipo === 'ads' ? 'ADS' : 'ORG'}
            </button>
          ) : (
            <span title={`Card criado: ${t.entregavel_url}`}
              style={{ color:'#4ade80', display:'flex' }}>
              <LucideIcon icon="link" size={12}/>
            </span>
          )
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
    {aberto && refs.length > 0 && <ListaReferencias refs={refs}/>}
    {aberto && temCampos && (
      <PainelDefinicao tarefa={t} onFechar={()=>setAberto(false)}
        onSalvar={vals => onDefinir(t, vals)}/>
    )}
    </>
  );
}


/* ── Referências da tarefa ─────────────────────────────────────
   Os exemplos do retiro que servem para esta tarefa, abertos em nova aba.
──────────────────────────────────────────────────────────────────*/
const ICONE_REF = { video:'play-circle', post:'image', imagem:'image', pagina:'globe',
  doc:'file-text', planilha:'table', skill:'sparkles', pasta:'folder', quadro:'layout',
  privado:'lock', aula:'graduation-cap' };

function ListaReferencias({ refs }) {
  return (
    <div onClick={e => e.stopPropagation()}
      style={{ marginTop:2, marginBottom:6, marginLeft:29, padding:'10px 12px',
        borderRadius:9, background:'rgba(56,189,248,.04)',
        border:'1px solid rgba(56,189,248,.16)' }}>
      <div style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
        color:'var(--text-3)', letterSpacing:.4, textTransform:'uppercase', marginBottom:7 }}>
        Referências do retiro
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
        {refs.map((r, i) => (
          <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
            style={{ display:'flex', alignItems:'flex-start', gap:7, textDecoration:'none',
              fontSize:12, fontFamily:'Roboto,sans-serif', color:'var(--text-1)', lineHeight:1.4 }}>
            <LucideIcon icon={ICONE_REF[r.tipo] || 'link'} size={13}
              style={{ color:'#38bdf8', flexShrink:0, marginTop:2 }}/>
            <span>
              {r.titulo}
              {r.nota && <span style={{ color:'var(--text-3)', fontSize:11 }}> · {r.nota}</span>}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

/* ── Caderno da Black ───────────────────────────────────────────
   O caderno inteiro dentro do Tracker: índice de um lado, texto do
   outro, busca no topo. Vem da tabela pico_caderno, gerada pelo
   scripts/sync-caderno.py a partir do BLACK-FRIDAY-2026.md.
──────────────────────────────────────────────────────────────────*/
function BlocoCaderno({ partes }) {
  const [sel, setSel] = useState(null);
  const [busca, setBusca] = useState('');
  const b = busca.trim().toLowerCase();
  const semTags = h => String(h || '').replace(/<[^>]+>/g, ' ');
  const lista = b ? partes.filter(p => (p.titulo + ' ' + semTags(p.html)).toLowerCase().includes(b)) : partes;
  const atual = lista.find(p => p.id === sel) || lista[0] || null;

  return (
    <SectionCard recolhivel idRecolher="pico:caderno" title="Caderno da Black"
      headerRight={<span style={{ fontSize:11, color:'var(--text-3)',
        fontFamily:'Roboto,sans-serif' }}>{partes.length} partes</span>}>
      <input value={busca} onChange={e => setBusca(e.target.value)}
        placeholder="Buscar no caderno inteiro"
        style={{ width:'100%', padding:'6px 9px', borderRadius:7, marginBottom:10,
          border:'1px solid var(--app-border)', background:'rgba(255,255,255,.03)',
          color:'var(--text-1)', fontSize:12, fontFamily:'Roboto,sans-serif' }}/>
      {!lista.length ? (
        <div style={{ fontSize:12, fontFamily:'Roboto,sans-serif', color:'var(--text-3)' }}>
          Nenhuma parte do caderno fala disso.
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'minmax(160px,240px) 1fr', gap:12,
          alignItems:'start' }}>
          <div style={{ maxHeight:520, overflowY:'auto', display:'flex', flexDirection:'column', gap:3 }}>
            {lista.map(p => {
              const ativa = atual && atual.id === p.id;
              return (
                <button key={p.id} onClick={() => setSel(p.id)}
                  style={{ textAlign:'left', padding:'6px 9px', borderRadius:7, cursor:'pointer',
                    fontSize:11.5, fontFamily:'Roboto,sans-serif', lineHeight:1.35,
                    border:'1px solid ' + (ativa ? 'rgba(234,170,65,.4)' : 'transparent'),
                    background: ativa ? 'rgba(234,170,65,.1)' : 'transparent',
                    color: ativa ? '#eaaa41' : 'var(--text-2)' }}>
                  {p.numero ? <b style={{ marginRight:5 }}>{p.numero}.</b> : null}{p.titulo}
                </button>
              );
            })}
          </div>
          <div className="caderno-corpo" style={{ maxHeight:520, overflowY:'auto', paddingRight:6 }}
            dangerouslySetInnerHTML={{ __html: atual.html }}/>
        </div>
      )}
      <div style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', color:'var(--text-3)',
        marginTop:9, lineHeight:1.45 }}>
        É o caderno que vem sendo escrito desde o retiro: as aulas, os playbooks estudados, os nossos
        números e os rascunhos. A tarefa fica curta, o porquê mora aqui.
      </div>
    </SectionCard>
  );
}

/* ── Biblioteca de exemplos ─────────────────────────────────────
   Um exemplo real de cada peça, por tipo: criativo, página, live, disparo.
   Global, serve a todos os picos, e dá para acrescentar os seus.
──────────────────────────────────────────────────────────────────*/
const CATEGORIAS_BIB = ["Oferta e combo", "Narrativa, trailer e manifesto", "Páginas de captura", "Páginas de vendas", "Criativos de captação", "Criativos de aquecimento e contagem", "Criativos de venda", "Posts orgânicos por fase", "Stories", "Lives e aulas", "Disparos e e-mails", "Encerramento", "Playbooks e casos", "Skills e ferramentas", "Aulas do Academy"];

function ItemBib({ i, onRemover }) {
  const [hov, setHov] = useState(false);
  const estilo = { display:'flex', alignItems:'flex-start', gap:7, padding:'7px 9px', borderRadius:8,
    textDecoration:'none', fontSize:12, fontFamily:'Roboto,sans-serif', lineHeight:1.4,
    background: hov ? 'rgba(255,255,255,.045)' : 'rgba(255,255,255,.02)',
    border:'1px solid var(--app-border)' };
  const conteudo = (
    <>
      <LucideIcon icon={ICONE_REF[i.tipo] || 'link'} size={13}
        style={{ color: i.url ? '#38bdf8' : 'var(--text-3)', flexShrink:0, marginTop:2 }}/>
      <span style={{ flex:1, minWidth:0, paddingRight:14 }}>
        <span style={{ color:'var(--text-1)' }}>{i.titulo}</span>
        {i.nota && <span style={{ display:'block', fontSize:10.5, color:'var(--text-3)', marginTop:1 }}>{i.nota}</span>}
      </span>
    </>
  );
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{ position:'relative' }}>
      {i.url
        ? <a href={i.url} target="_blank" rel="noopener noreferrer" style={estilo}>{conteudo}</a>
        : <div style={estilo}>{conteudo}</div>}
      {hov && (
        <button onClick={() => { if (window.confirm('Tirar este exemplo da biblioteca?')) onRemover(i.id); }}
          title="Tirar da biblioteca"
          style={{ position:'absolute', top:5, right:5, padding:2, border:'none', borderRadius:4,
            background:'var(--app-surface)', color:'var(--text-3)', cursor:'pointer', display:'flex' }}>
          <LucideIcon icon="x" size={11}/>
        </button>
      )}
    </div>
  );
}

function BlocoBiblioteca({ itens, onAdicionar, onRemover }) {
  const [cat, setCat] = useState('todas');
  const [busca, setBusca] = useState('');
  const [novo, setNovo] = useState(null);
  const b = busca.trim().toLowerCase();
  const visiveis = itens.filter(i => (cat === 'todas' || i.categoria === cat)
    && (!b || `${i.titulo} ${i.nota || ''} ${i.categoria}`.toLowerCase().includes(b)));
  const cats = CATEGORIAS_BIB.filter(c => visiveis.some(i => i.categoria === c))
    .concat([...new Set(visiveis.map(i => i.categoria))].filter(c => !CATEGORIAS_BIB.includes(c)));
  const campo = { padding:'6px 9px', borderRadius:7, border:'1px solid var(--app-border)',
    background:'rgba(255,255,255,.03)', color:'var(--text-1)', fontSize:12, fontFamily:'Roboto,sans-serif' };
  const chip = (id, rotulo, n) => (
    <button key={id} onClick={() => setCat(id)}
      style={{ padding:'4px 10px', borderRadius:99, cursor:'pointer', fontSize:11,
        fontFamily:'Roboto,sans-serif', fontWeight:700,
        border:'1px solid ' + (cat === id ? '#38bdf8' : 'var(--app-border)'),
        background: cat === id ? 'rgba(56,189,248,.12)' : 'transparent',
        color: cat === id ? '#38bdf8' : 'var(--text-3)' }}>
      {rotulo} <span style={{ opacity:.7 }}>{n}</span>
    </button>
  );
  const salvar = async () => {
    if (!novo || !novo.titulo.trim()) return;
    await onAdicionar({ categoria: novo.categoria, titulo: novo.titulo.trim(),
      url: novo.url.trim() || null, nota: novo.nota.trim() || null, tipo: 'link', fonte: 'Felipe',
      ordem: Math.max(0, CATEGORIAS_BIB.indexOf(novo.categoria)) * 100 + 99 });
    setNovo(null);
  };

  return (
    <SectionCard recolhivel idRecolher="pico:biblioteca" title="Biblioteca de exemplos"
      headerRight={<span style={{ fontSize:11, color:'var(--text-3)',
        fontFamily:'Roboto,sans-serif' }}>{itens.length} exemplos</span>}>
      <div style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'var(--text-3)',
        marginBottom:10, lineHeight:1.45 }}>
        Um exemplo real de cada peça, separado por tipo. Os mesmos links aparecem dentro das tarefas
        em que servem. O cadeado marca arquivo privado do retiro: é só pedir que eu busco.
      </div>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
        {chip('todas', 'Todas', itens.length)}
        {CATEGORIAS_BIB.map(c => {
          const n = itens.filter(i => i.categoria === c).length;
          return n ? chip(c, c, n) : null;
        })}
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar exemplo"
          style={{ ...campo, flex:1 }}/>
        <button onClick={() => setNovo(novo ? null
            : { categoria: cat === 'todas' ? CATEGORIAS_BIB[0] : cat, titulo:'', url:'', nota:'' })}
          style={{ padding:'6px 11px', borderRadius:7, cursor:'pointer', border:'1px solid var(--app-border)',
            background:'transparent', color:'var(--text-2)', fontSize:11.5, fontFamily:'Roboto,sans-serif',
            fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
          <LucideIcon icon={novo ? 'x' : 'plus'} size={12}/>{novo ? 'cancelar' : 'exemplo'}
        </button>
      </div>
      {novo && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:8,
          marginBottom:14, padding:'10px 12px', borderRadius:9, background:'rgba(56,189,248,.04)',
          border:'1px solid rgba(56,189,248,.16)' }}>
          <select value={novo.categoria} onChange={e => setNovo({ ...novo, categoria:e.target.value })} style={campo}>
            {CATEGORIAS_BIB.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={novo.titulo} placeholder="O que é (ex: anúncio de captação do fulano)"
            onChange={e => setNovo({ ...novo, titulo:e.target.value })} style={campo}/>
          <input value={novo.url} placeholder="https://"
            onChange={e => setNovo({ ...novo, url:e.target.value })} style={campo}/>
          <input value={novo.nota} placeholder="O que observar nele (opcional)"
            onChange={e => setNovo({ ...novo, nota:e.target.value })} style={campo}/>
          <button onClick={salvar}
            style={{ padding:'6px 11px', borderRadius:7, cursor:'pointer', border:'none',
              background:'#38bdf8', color:'#0b0b0d', fontSize:12, fontFamily:'Roboto,sans-serif', fontWeight:700 }}>
            Guardar exemplo
          </button>
        </div>
      )}
      {cats.map(c => {
        const lista = visiveis.filter(i => i.categoria === c);
        return (
          <div key={c} style={{ marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7, paddingBottom:5,
              borderBottom:'1px solid var(--app-border)' }}>
              <span style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
                color:'var(--text-2)', letterSpacing:.4, textTransform:'uppercase' }}>{c}</span>
              <span style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', color:'var(--text-3)' }}>{lista.length}</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))', gap:6 }}>
              {lista.map(i => <ItemBib key={i.id} i={i} onRemover={onRemover}/>)}
            </div>
          </div>
        );
      })}
      {!visiveis.length && (
        <div style={{ fontSize:12, fontFamily:'Roboto,sans-serif', color:'var(--text-3)' }}>
          Nenhum exemplo encontrado.
        </div>
      )}
    </SectionCard>
  );
}

/* ── Painel de definição da tarefa ──────────────────────────────
   Onde a decisão fica registrada, junto da tarefa que a gerou.
   Campo com "alimenta" no schema copia o valor para o plano do
   projeto, então o número nunca é digitado duas vezes.
──────────────────────────────────────────────────────────────────*/
function calcularCampo(campo, vals) {
  const n = k => Number(vals[k]) || 0;
  if (campo.tipo === 'soma_lista') {
    const l = vals[campo.origem];
    return Array.isArray(l) ? l.reduce((a, i) => a + (Number(i.valor) || 0), 0) : 0;
  }
  if (campo.tipo !== 'calculado') return null;
  const f = campo.formula || '';
  if (f === '1 - preco_pico/preco_normal')
    return n('preco_normal') > 0 ? (1 - n('preco_pico') / n('preco_normal')) * 100 : null;
  if (f === 'vendas_meta/taxa')
    return n('taxa') > 0 ? Math.ceil(n('vendas_meta') / n('taxa')) : null;
  if (f === 'custo_item+custo_sorteio') return n('custo_item') + n('custo_sorteio');
  return null;
}

/* Preço e desconto são espelho: mexer em um recalcula o outro, usando
   o preço de base. Assim dá para pensar por onde for mais natural. */
function espelharPreco(campo, valor, vals) {
  const base = Number(vals[campo.base_de]) || 0;
  if (!base) return {};
  if (campo.par_percent && valor != null)
    return { [campo.par_percent]: Math.max(0, 1 - Number(valor) / base) };
  if (campo.par_valor && valor != null)
    return { [campo.par_valor]: Number((base * (1 - Number(valor))).toFixed(2)) };
  return {};
}

function CampoLista({ itens, onSalvar }) {
  const lista = Array.isArray(itens) ? itens : [];
  const mudar = (i, chave, v) => {
    const novo = lista.map((x, j) => j === i ? { ...x, [chave]: v } : x);
    onSalvar(novo);
  };
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      {lista.map((it, i) => (
        <div key={i} style={{ display:'flex', gap:6, alignItems:'center' }}>
          <input value={it.nome || ''} placeholder="item"
            onChange={e => mudar(i, 'nome', e.target.value)}
            style={{ flex:1, padding:'5px 8px', borderRadius:6,
              border:'1px solid var(--app-border)', background:'rgba(255,255,255,.03)',
              color:'var(--text-1)', fontSize:12, fontFamily:'Roboto,sans-serif' }}/>
          <CampoMoeda valor={it.valor ?? null} largura={112}
            onSalvar={v => mudar(i, 'valor', v)}/>
          <button onClick={() => onSalvar(lista.filter((_, j) => j !== i))}
            title="Remover" style={{ padding:3, display:'flex', color:'var(--text-3)',
              background:'none', border:'none', cursor:'pointer' }}>
            <LucideIcon icon="x" size={13}/>
          </button>
        </div>
      ))}
      <button onClick={() => onSalvar([...lista, { nome:'', valor:null }])}
        style={{ alignSelf:'flex-start', padding:'4px 9px', borderRadius:6,
          border:'1px dashed var(--app-border)', background:'transparent',
          color:'var(--text-3)', fontSize:11, fontFamily:'Roboto,sans-serif',
          fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
        <LucideIcon icon="plus" size={11}/> item
      </button>
    </div>
  );
}

function PainelDefinicao({ tarefa, onSalvar, onFechar }) {
  const campos = Array.isArray(tarefa.campos) ? tarefa.campos : [];
  const [vals, setVals] = useState(tarefa.definicoes || {});
  const brl = v => window.fmtBRL ? window.fmtBRL(v) : fmtMoeda(v);

  const set = (chave, v) => {
    const campo = campos.find(c => c.chave === chave) || {};
    const novo = { ...vals, [chave]: v, ...espelharPreco(campo, v, { ...vals, [chave]: v }) };
    setVals(novo);
    onSalvar(novo);
  };

  const base = { width:'100%', padding:'6px 9px', borderRadius:7,
    border:'1px solid var(--app-border)', background:'rgba(255,255,255,.03)',
    color:'var(--text-1)', fontSize:12, fontFamily:'Roboto,sans-serif' };

  return (
    <div onClick={e => e.stopPropagation()}
      style={{ marginTop:2, marginBottom:6, marginLeft:29, padding:'12px 14px',
        borderRadius:9, background:'rgba(255,255,255,.03)',
        border:'1px solid var(--app-border)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom:10 }}>
        <span style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
          color:'var(--text-3)', letterSpacing:.4, textTransform:'uppercase' }}>
          O que foi definido
        </span>
        <button onClick={onFechar} style={{ background:'none', border:'none',
          cursor:'pointer', color:'var(--text-3)', display:'flex', padding:2 }}>
          <LucideIcon icon="chevron-up" size={14}/>
        </button>
      </div>

      <div style={{ display:'grid',
        gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))', gap:10 }}>
        {campos.filter(c => {
          if (!c.so_quando) return true;
          return Object.entries(c.so_quando).every(([k, v]) => vals[k] === v);
        }).map(c => {
          const largo = c.tipo === 'texto_longo' || c.tipo === 'lista'
            || c.tipo === 'resumo_preco';
          const derivado = c.tipo === 'calculado' || c.tipo === 'soma_lista';
          const dv = derivado ? calcularCampo(c, vals) : null;
          return (
            <div key={c.chave} style={{ gridColumn: largo ? '1 / -1' : 'auto' }}>
              <label title={c.dica} style={{ display:'block', fontSize:11,
                fontFamily:'Roboto,sans-serif', color:'var(--text-3)', marginBottom:3,
                cursor: c.dica ? 'help' : 'default',
                borderBottom: c.dica ? '1px dotted transparent' : 'none' }}>
                {c.label}
                {c.vinculo && (
                  <span title="Mesmo campo da ficha da campanha. Mudou aqui, muda lá e nas outras tarefas"
                    style={{ marginLeft:5, fontSize:9, color:'#38bdf8', fontWeight:700 }}>
                    na ficha
                  </span>
                )}
                {c.alimenta && (
                  <span title={`Alimenta ${c.alimenta} automaticamente`}
                    style={{ marginLeft:5, fontSize:9, color:'#4ade80', fontWeight:700 }}>
                    entra no plano
                  </span>
                )}
              </label>

              {c.tipo === 'resumo_preco' ? (() => {
                const pn = Number(vals.preco_normal) || 0;
                const pp = Number(vals.preco_pico) || 0;
                const dc = Number(vals.desconto_pct) || 0;
                if (!pn || !pp) return (
                  <div style={{ fontSize:11.5, fontFamily:'Roboto,sans-serif',
                    color:'var(--text-3)' }}>
                    Preencha o preço normal e o do pico.
                  </div>
                );
                return (
                  <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap',
                    padding:'9px 11px', borderRadius:8, background:'rgba(74,222,128,.07)',
                    border:'1px solid rgba(74,222,128,.2)' }}>
                    <span style={{ fontSize:12.5, fontFamily:'Roboto,sans-serif',
                      color:'var(--text-3)', textDecoration:'line-through' }}>{brl(pn)}</span>
                    <LucideIcon icon="arrow-right" size={13} style={{ color:'var(--text-3)' }}/>
                    <span style={{ fontSize:16, fontFamily:'Roboto,sans-serif', fontWeight:700,
                      color:'#4ade80', fontVariantNumeric:'tabular-nums' }}>{brl(pp)}</span>
                    <span style={{ fontSize:11.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
                      padding:'2px 8px', borderRadius:5, color:'#4ade80',
                      background:'rgba(74,222,128,.15)' }}>
                      {(dc * 100).toFixed(0)}% off
                    </span>
                    <span style={{ fontSize:11.5, fontFamily:'Roboto,sans-serif',
                      color:'var(--text-3)' }}>
                      economia de {brl(pn - pp)}
                    </span>
                    {dc > 0 && dc < 0.3 && (
                      <span title="O retiro fala em 30% a 50% quando o publico e sensivel a preco"
                        style={{ fontSize:10.5, color:'#fb923c',
                          fontFamily:'Roboto,sans-serif' }}>
                        abaixo dos 30% que o retiro sugere para desconto
                      </span>
                    )}
                  </div>
                );
              })() : derivado ? (
                <div style={{ padding:'6px 9px', borderRadius:7,
                  background:'rgba(74,222,128,.07)', border:'1px solid rgba(74,222,128,.2)',
                  fontSize:12.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
                  color:'#4ade80', fontVariantNumeric:'tabular-nums' }}>
                  {dv == null ? '—'
                    : c.unidade === '%' ? dv.toFixed(1) + '%'
                    : c.unidade === 'un' ? Math.round(dv).toLocaleString('pt-BR')
                    : brl(dv)}
                </div>
              ) : c.tipo === 'moeda' ? (
                <CampoMoeda valor={vals[c.chave] ?? null} largura="100%"
                  onSalvar={v => set(c.chave, v)}/>
              ) : c.tipo === 'percent' ? (
                <CampoPercent valor={vals[c.chave] ?? null} largura="100%"
                  onSalvar={v => set(c.chave, v)}/>
              ) : c.tipo === 'lista' ? (
                <CampoLista itens={vals[c.chave]} onSalvar={v => set(c.chave, v)}/>
              ) : c.tipo === 'opcao' ? (
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                  {(c.opcoes || []).map(op => {
                    const ativa = vals[c.chave] === op;
                    return (
                      <button key={op} onClick={() => set(c.chave, ativa ? null : op)}
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
              ) : c.tipo === 'texto_longo' ? (
                <textarea defaultValue={vals[c.chave] || ''} rows={2}
                  onBlur={e => set(c.chave, e.target.value)}
                  style={{ ...base, resize:'vertical', lineHeight:1.45 }}/>
              ) : (
                <input type={c.tipo === 'data' ? 'date' : c.tipo === 'numero' ? 'number' : 'text'}
                  defaultValue={vals[c.chave] ?? ''}
                  placeholder={c.tipo === 'link' ? 'https://' : ''}
                  onBlur={e => set(c.chave,
                    c.tipo === 'numero'
                      ? (e.target.value === '' ? null : Number(e.target.value))
                      : e.target.value)}
                  style={base}/>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Bloco de decisões-gate ─────────────────────────────────────*/
function BlocoDecisoes({ decisoes, onEscolher }) {
  const pendentes = decisoes.filter(d => !d.escolha).length;
  /* Guarda qual explicação está aberta, no formato "idDaDecisao|opcao".
     Uma por vez, para o bloco não virar um paredão de texto. */
  const [aberta, setAberta] = useState(null);

  return (
    <SectionCard recolhivel idRecolher="pico:decisoes"
      title="Decisões que travam o resto"
      right={pendentes > 0
        ? <Badge tone="warn">{pendentes} pendente{pendentes > 1 ? 's' : ''}</Badge>
        : <Badge tone="ok">Todas decididas</Badge>}
    >
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {decisoes.map(d => {
          const opcoes = Array.isArray(d.opcoes) ? d.opcoes : [];
          const expl = d.explicacoes || {};
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
                  const chaveExp = d.id + '|' + op;
                  const temExp = !!expl[op];
                  const mostrando = aberta === chaveExp;
                  return (
                    <div key={op} style={{ display:'flex', alignItems:'stretch',
                      borderRadius:7, overflow:'hidden',
                      border:'1px solid ' + (ativa ? '#4ade80' : 'var(--app-border)'),
                      background: ativa ? 'rgba(74,222,128,.14)' : 'transparent' }}>
                      <button onClick={()=>onEscolher(d, ativa ? null : op)}
                        style={{ padding:'5px 10px', cursor:'pointer', border:'none',
                          background:'transparent', fontSize:11.5,
                          fontFamily:'Roboto,sans-serif', fontWeight:700,
                          color: ativa ? '#4ade80' : 'var(--text-2)' }}>
                        {ativa && '✓ '}{op}
                      </button>
                      {temExp && (
                        <button
                          onClick={()=>setAberta(mostrando ? null : chaveExp)}
                          title="O que isso quer dizer"
                          style={{ padding:'0 7px', cursor:'pointer', border:'none',
                            borderLeft:'1px solid ' + (ativa ? 'rgba(74,222,128,.4)' : 'var(--app-border)'),
                            background: mostrando ? 'rgba(56,189,248,.18)' : 'transparent',
                            color: mostrando ? '#38bdf8' : 'var(--text-3)',
                            display:'flex', alignItems:'center' }}>
                          <LucideIcon icon="info" size={12}/>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Explicação da opção que teve o "i" clicado */}
              {opcoes.map(op => {
                if (aberta !== d.id + '|' + op) return null;
                return (
                  <div key={'e'+op} style={{ marginTop:8, padding:'9px 11px', borderRadius:8,
                    background:'rgba(56,189,248,.07)', border:'1px solid rgba(56,189,248,.22)',
                    display:'flex', gap:8, alignItems:'flex-start' }}>
                    <LucideIcon icon="info" size={13}
                      style={{ color:'#38bdf8', flexShrink:0, marginTop:1 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:11.5, fontFamily:'Roboto,sans-serif',
                        fontWeight:700, color:'#38bdf8', marginBottom:3 }}>{op}</div>
                      <div style={{ fontSize:12, fontFamily:'Roboto,sans-serif',
                        color:'var(--text-2)', lineHeight:1.5 }}>{expl[op]}</div>
                    </div>
                    <button onClick={()=>setAberta(null)}
                      style={{ background:'none', border:'none', cursor:'pointer',
                        color:'var(--text-3)', display:'flex', padding:2, flexShrink:0 }}>
                      <LucideIcon icon="x" size={12}/>
                    </button>
                  </div>
                );
              })}

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

/* ── Declarações vinculadas ────────────────────────────────────
   Tudo que se declara uma vez vive em projeto.declaracoes. Campo de
   tarefa com "vinculo" lê e grava ali, então o mesmo valor aparece em
   toda tarefa que usa e na ficha da campanha, sem redigitar.
   A página do Samuel (pico.html) repete este registro para montar a ficha.
──────────────────────────────────────────────────────────────────*/
const VINCULOS = {
  nome_campanha:        { grupo:'Campanha', label:'Nome da campanha', tipo:'texto' },
  mote:                 { grupo:'Campanha', label:'Mote', tipo:'texto' },
  mote_onde:            { grupo:'Campanha', label:'Onde o mote aparece', tipo:'texto_longo' },
  promessa:             { grupo:'Campanha', label:'Promessa da condição', tipo:'texto_longo' },
  inimigo:              { grupo:'Campanha', label:'Inimigo (o cenário)', tipo:'texto' },
  palavra_chave:        { grupo:'Campanha', label:'Palavra do "comente a palavra"', tipo:'texto' },
  objeto_antecipacao:   { grupo:'Campanha', label:'Objeto físico de antecipação', tipo:'texto' },
  produto:              { grupo:'Oferta para não alunos', label:'Produto', tipo:'texto' },
  preco_normal:         { grupo:'Oferta para não alunos', label:'Preço fora do pico', tipo:'moeda' },
  preco_pico:           { grupo:'Oferta para não alunos', label:'Preço no pico', tipo:'moeda', alimenta:'projeto.ticket' },
  desconto_pct:         { grupo:'Oferta para não alunos', label:'Desconto', tipo:'percent' },
  combo_itens:          { grupo:'Oferta para não alunos', label:'O que entra na oferta', tipo:'lista' },
  publico_sensivel:     { grupo:'Oferta para não alunos', label:'Público sensível a preço', tipo:'opcao', opcoes:['Sim','Não'] },
  bonus_velocidade:     { grupo:'Prêmios e bônus', label:'Bônus por velocidade', tipo:'lista' },
  produto_aluno:        { grupo:'Oferta para alunos', label:'Produto', tipo:'texto' },
  preco_normal_aluno:   { grupo:'Oferta para alunos', label:'Preço fora do pico', tipo:'moeda' },
  preco_aluno:          { grupo:'Oferta para alunos', label:'Preço no pico', tipo:'moeda' },
  desconto_aluno_pct:   { grupo:'Oferta para alunos', label:'Desconto', tipo:'percent' },
  regra_credito:        { grupo:'Oferta para alunos', label:'Quem conta como aluno e como a oferta chega', tipo:'texto_longo' },
  item_fisico:          { grupo:'Prêmios e bônus', label:'Item físico', tipo:'texto' },
  sorteio:              { grupo:'Prêmios e bônus', label:'Sorteio', tipo:'texto' },
  premio_primeira_compra:{ grupo:'Prêmios e bônus', label:'Prêmio da primeira compra', tipo:'texto' },
  bonus_relampago:      { grupo:'Prêmios e bônus', label:'Bônus relâmpago', tipo:'texto' },
  bonus_final:          { grupo:'Prêmios e bônus', label:'Bônus guardado para o fim', tipo:'texto' },
  sorteio_final:        { grupo:'Prêmios e bônus', label:'Sorteio da última hora', tipo:'texto' },
  mentoria_formato:     { grupo:'Mentoria', label:'Formato', tipo:'opcao', opcoes:['Degustação','Produto completo'] },
  mentoria_encontros:   { grupo:'Mentoria', label:'Quantos encontros', tipo:'numero' },
  mentoria_duracao:     { grupo:'Mentoria', label:'Duração de cada um', tipo:'texto' },
  mentoria_preco:       { grupo:'Mentoria', label:'Preço cheio', tipo:'moeda' },
  mentoria_vagas:       { grupo:'Mentoria', label:'Teto de vagas', tipo:'numero' },
  mentoria_local:       { grupo:'Mentoria', label:'Onde acontece', tipo:'opcao', opcoes:['Zoom','Google Meet','Presencial','Área de membros'] },
  mentoria_calendario:  { grupo:'Mentoria', label:'Datas dos encontros', tipo:'texto_longo' },
  mentoria_plano:       { grupo:'Mentoria', label:'Plano de ação do mentorado', tipo:'texto_longo' },
  mentoria_na_oferta:   { grupo:'Mentoria', label:'Como aparece na oferta', tipo:'texto_longo' },
  aula1_tema:           { grupo:'Aulas de aquecimento', label:'Tema da aula 1', tipo:'texto' },
  aula2_tema:           { grupo:'Aulas de aquecimento', label:'Tema da aula 2', tipo:'texto' },
  aula3_tema:           { grupo:'Aulas de aquecimento', label:'Tema da aula 3', tipo:'texto' },
  data_anuncios:        { grupo:'Operação', label:'Entrega dos anúncios', tipo:'data' },
  data_paginas:         { grupo:'Operação', label:'Entrega das páginas', tipo:'data' },
  responsavel_producao: { grupo:'Operação', label:'Quem produz', tipo:'texto' },
  cadencia_follow:      { grupo:'Operação', label:'Cadência de follow', tipo:'texto_longo' },
  templates_aprovados:  { grupo:'Operação', label:'Templates aprovados', tipo:'texto_longo' },
  pagina_captura:       { grupo:'Links', label:'Página de captura', tipo:'link' },
  pagina_obrigado:      { grupo:'Links', label:'Página de obrigado', tipo:'link' },
  pagina_venda:         { grupo:'Links', label:'Página de venda', tipo:'link' },
  checkout:             { grupo:'Links', label:'Checkout', tipo:'link' },
  grupo_whatsapp:       { grupo:'Links', label:'Grupo de WhatsApp', tipo:'link' },
  link_encontros:       { grupo:'Links', label:'Sala dos encontros', tipo:'link' },
  manifesto_link:       { grupo:'Links', label:'Roteiro da narrativa', tipo:'link' },
  trailer_link_1:       { grupo:'Links', label:'Trailer 1', tipo:'link' },
  trailer_link_2:       { grupo:'Links', label:'Trailer 2', tipo:'link' },
  pasta_depoimentos:    { grupo:'Links', label:'Depoimentos por objeção', tipo:'link' },
  doc_objecoes:         { grupo:'Links', label:'Doc de dúvidas e objeções', tipo:'link' },
};
const GRUPOS_FICHA = ['Campanha','Oferta para não alunos','Oferta para alunos','Prêmios e bônus','Mentoria',
  'Aulas de aquecimento','Operação','Links'];

const vazio = v => v == null || v === '' || (Array.isArray(v) && v.length === 0);

/* O que a tarefa mostra: o que foi gravado nela, por cima o que está
   declarado no projeto (ficha) ou no plano de mídia, que é a fonte. */
function defsEfetivas(t, projeto) {
  const campos = Array.isArray(t.campos) ? t.campos : [];
  if (!campos.length || !projeto) return t.definicoes || {};
  const dec = projeto.declaracoes || {}, pm = projeto.plano_midia || {};
  const out = { ...(t.definicoes || {}) };
  campos.forEach(c => {
    if (c.vinculo && !vazio(dec[c.vinculo])) { out[c.chave] = dec[c.vinculo]; return; }
    if (c.alimenta) {
      const [onde, k] = c.alimenta.split('.');
      const v = onde === 'plano' ? pm[k] : onde === 'projeto' ? projeto[k] : undefined;
      if (!vazio(v)) out[c.chave] = v;
    }
  });
  return out;
}

/* Preço e desconto na ficha seguem a mesma regra da tarefa, nas duas ofertas. */
const PARES_PRECO = [
  { normal:'preco_normal',       pico:'preco_pico',  pct:'desconto_pct' },
  { normal:'preco_normal_aluno', pico:'preco_aluno', pct:'desconto_aluno_pct' },
];
function espelharFicha(k, v, dec) {
  const par = PARES_PRECO.find(p => k === p.normal || k === p.pico || k === p.pct);
  if (!par || v == null) return {};
  const pn = Number(k === par.normal ? v : dec[par.normal]) || 0;
  if (!pn) return {};
  if (k === par.pico) return { [par.pct]: Math.max(0, 1 - Number(v) / pn) };
  if (k === par.pct)  return { [par.pico]: Number((pn * (1 - Number(v))).toFixed(2)) };
  if (dec[par.pico])  return { [par.pct]: Math.max(0, 1 - Number(dec[par.pico]) / pn) };
  return {};
}

/* Um campo de declaração, do tipo que for. Texto grava ao sair do campo. */
function CampoDeclarado({ campo, valor, onSalvar }) {
  const base = { width:'100%', padding:'6px 9px', borderRadius:7,
    border:'1px solid var(--app-border)', background:'rgba(255,255,255,.03)',
    color:'var(--text-1)', fontSize:12, fontFamily:'Roboto,sans-serif' };
  const t = campo.tipo;
  if (t === 'moeda')   return <CampoMoeda valor={valor ?? null} largura="100%" onSalvar={onSalvar}/>;
  if (t === 'percent') return <CampoPercent valor={valor ?? null} largura="100%" onSalvar={onSalvar}/>;
  if (t === 'lista')   return <CampoLista itens={valor} onSalvar={onSalvar}/>;
  if (t === 'opcao') return (
    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
      {(campo.opcoes || []).map(op => {
        const ativa = valor === op;
        return (
          <button key={op} onClick={() => onSalvar(ativa ? null : op)}
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
  );
  if (t === 'texto_longo') return (
    <textarea key={String(valor ?? '')} defaultValue={valor || ''} rows={2}
      onBlur={e => { if (e.target.value !== (valor || '')) onSalvar(e.target.value); }}
      style={{ ...base, resize:'vertical', lineHeight:1.45 }}/>
  );
  return (
    <input key={String(valor ?? '')}
      type={t === 'data' ? 'date' : t === 'numero' ? 'number' : 'text'}
      defaultValue={valor ?? ''} placeholder={t === 'link' ? 'https://' : ''}
      onBlur={e => {
        const v = t === 'numero' ? (e.target.value === '' ? null : Number(e.target.value))
                                 : e.target.value;
        if (String(v ?? '') !== String(valor ?? '')) onSalvar(v);
      }}
      style={base}/>
  );
}

/* ── Ficha da campanha ─────────────────────────────────────────
   Tudo que se declara, num lugar só. Mexer aqui muda nas tarefas,
   mexer nas tarefas muda aqui.
──────────────────────────────────────────────────────────────────*/
function BlocoFicha({ declaracoes, onSalvar, semMentoria }) {
  const dec = declaracoes || {};
  const chaves = Object.keys(VINCULOS).filter(k => !(semMentoria && VINCULOS[k].grupo === 'Mentoria'));
  const cheios = chaves.filter(k => !vazio(dec[k])).length;
  return (
    <SectionCard recolhivel idRecolher="pico:ficha" title="Ficha da campanha"
      headerRight={<span style={{ fontSize:11, color:'var(--text-3)',
        fontFamily:'Roboto,sans-serif', fontVariantNumeric:'tabular-nums' }}>
        {cheios} de {chaves.length} declarados</span>}>
      <div style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'var(--text-3)',
        marginBottom:12, lineHeight:1.45 }}>
        Preencha aqui ou dentro da tarefa, tanto faz: é o mesmo campo. O que estiver aqui
        aparece em toda tarefa que usa e na página do Samuel.
      </div>
      {GRUPOS_FICHA.map(g => {
        const ks = chaves.filter(k => VINCULOS[k].grupo === g);
        if (!ks.length) return null;
        const gc = ks.filter(k => !vazio(dec[k])).length;
        return (
          <div key={g} style={{ marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8,
              paddingBottom:5, borderBottom:'1px solid var(--app-border)' }}>
              <span style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
                color:'var(--text-2)', letterSpacing:.4, textTransform:'uppercase' }}>{g}</span>
              <span style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif',
                color: gc === ks.length ? '#4ade80' : 'var(--text-3)' }}>{gc}/{ks.length}</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',
              gap:10 }}>
              {ks.map(k => {
                const c = VINCULOS[k];
                const largo = c.tipo === 'texto_longo' || c.tipo === 'lista';
                return (
                  <div key={k} style={{ gridColumn: largo ? '1 / -1' : 'auto' }}>
                    <label style={{ display:'block', fontSize:11, fontFamily:'Roboto,sans-serif',
                      color:'var(--text-3)', marginBottom:3 }}>{c.label}</label>
                    <CampoDeclarado campo={c} valor={dec[k]} onSalvar={v => onSalvar(k, v)}/>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </SectionCard>
  );
}

/* ── Imaginação primária ────────────────────────────────────────*/
const INDICADORES_IMAGINACAO = {
  vendas:        { chave:'vendas',        label:'Vendas para não alunos', unidade:'un' },
  investimento:  { chave:'investimento',  label:'Investimento',           unidade:'R$' },
  vendas_alunos: { chave:'vendas_alunos', label:'Vendas para alunos',     unidade:'un' },
};
const CENARIOS = ['conservador','alvo','otimista'];

/* A meta conta só quem não é aluno. Aluno é bônus: fica fora da meta, do
   investimento e dos leads. Os preços vêm da ficha, e a venda do cenário
   alvo é a mesma do plano de mídia. */
function BlocoImaginacao({ metricas, onSalvar, precos = {}, metaPlano, plano = {} }) {
  const valor = (cen, ch) => {
    if (cen === 'alvo' && ch === 'vendas' && metaPlano != null && metaPlano !== '') return metaPlano;
    const m = metricas.find(x => x.cenario === cen && x.indicador === ch);
    return m ? m.valor : '';
  };
  const pn = Number(precos.nao) || 0, pa = Number(precos.aluno) || 0;
  const vn = c => Number(valor(c, 'vendas')) || 0;
  const va = c => Number(valor(c, 'vendas_alunos')) || 0;
  const fatMeta  = c => vn(c) * pn;
  const fatBonus = c => va(c) * pa;
  /* O investimento sai do plano de mídia, na mesma escada, para o volume de
     cada cenário: leads = vendas ÷ conversão, mídia = leads × CPL ÷ % da
     captação, mais o imposto do Meta. Mudou o CPL lá, muda aqui. */
  const imp   = Number(plano.imposto_meta) || 0;
  const pCapt = 1 - (Number(plano.pct_teaser) || 0) - (Number(plano.pct_aquecimento) || 0)
              - pctRemarketing(plano.dias_remarketing);
  const invest = c => {
    const tx = Number(plano.taxa_conversao) || 0;
    if (!tx || pCapt <= 0) return 0;
    return (Math.ceil(vn(c) / tx) * (Number(plano.cpl_meta) || 0)) / pCapt * (1 + imp);
  };
  const quente = (Number(plano.verba_alunos_dia) || 0) * (Number(plano.dias_alunos) || 0) * (1 + imp);
  const roas = c => invest(c) > 0 ? fatMeta(c) / invest(c) : 0;
  const res = v => <span style={{ color: v < 0 ? '#f87171' : undefined }}>{fmtMoeda(v)}</span>;
  const leads = (c, taxa) => taxa > 0 ? Math.round(vn(c) / taxa) : 0;

  const tdBase = { padding:'5px 8px', textAlign:'right', fontSize:12, fontFamily:'Roboto,sans-serif',
    color:'var(--text-2)', fontVariantNumeric:'tabular-nums' };
  const linhaCalc = (rotulo, fn, destaque, dica) => (
    <tr style={destaque ? { borderTop:'1px solid var(--app-border)' } : undefined}>
      <td title={dica} style={{ ...tdBase, textAlign:'left', cursor: dica ? 'help' : 'default',
        color: destaque ? 'var(--text-1)' : 'var(--text-2)', fontWeight: destaque ? 700 : 400 }}>{rotulo}</td>
      {CENARIOS.map(c => (
        <td key={c} style={{ ...tdBase, fontWeight: destaque ? 700 : 400,
          fontSize: destaque ? 12.5 : 12, color: destaque ? '#4ade80' : 'var(--text-2)' }}>{fn(c)}</td>
      ))}
    </tr>
  );
  const linhaInput = ind => (
    <tr>
      <td style={{ padding:'5px 8px', fontSize:12, fontFamily:'Roboto,sans-serif',
        color:'var(--text-2)', whiteSpace:'nowrap' }}>{ind.label}</td>
      {CENARIOS.map(c => (
        <td key={c} style={{ padding:'3px 8px', textAlign:'right' }}>
          {ind.unidade === 'R$' ? (
            <CampoMoeda valor={valor(c, ind.chave) === '' ? null : Number(valor(c, ind.chave))}
              onSalvar={v => onSalvar(c, ind.chave, v == null ? '' : v, ind.unidade)}
              largura="100%" estilo={{ maxWidth:120 }}/>
          ) : (
            <input type="number" key={String(valor(c, ind.chave))} defaultValue={valor(c, ind.chave)}
              onBlur={e => onSalvar(c, ind.chave, e.target.value, ind.unidade)}
              style={{ width:'100%', maxWidth:120, textAlign:'right', padding:'5px 7px',
                borderRadius:6, border:'1px solid var(--app-border)',
                background:'rgba(255,255,255,.03)', color:'var(--text-1)',
                fontSize:12, fontFamily:'Roboto,sans-serif', fontVariantNumeric:'tabular-nums' }}/>
          )}
        </td>
      ))}
    </tr>
  );
  const subtitulo = texto => (
    <tr><td colSpan={4} style={{ padding:'14px 8px 4px', fontSize:10.5, fontFamily:'Roboto,sans-serif',
      fontWeight:700, color:'var(--text-3)', letterSpacing:.4, textTransform:'uppercase' }}>{texto}</td></tr>
  );

  return (
    <SectionCard recolhivel idRecolher="pico:imaginacao" title="Imaginação primária"
      headerRight={<span style={{ fontSize:11, color:'var(--text-3)',
        fontFamily:'Roboto,sans-serif' }}>preencha antes de qualquer tarefa</span>}>
      <div style={{ fontSize:11.5, fontFamily:'Roboto,sans-serif', color:'var(--text-3)',
        marginBottom:4, lineHeight:1.5 }}>
        Meta: <b style={{ color:'var(--text-2)' }}>{precos.prodNao || 'oferta principal'}</b> a {pn ? fmtMoeda(pn) : 'preço a definir'}
        {'  ·  '}
        Bônus: <b style={{ color:'var(--text-2)' }}>{precos.prodAluno || 'oferta de aluno'}</b> a {pa ? fmtMoeda(pa) : 'preço a definir'}
      </div>
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
            {subtitulo('Meta: não alunos')}
            {linhaInput(INDICADORES_IMAGINACAO.vendas)}
            {linhaCalc('Investimento (mídia + imposto)', c => fmtMoeda(invest(c)), false,
              'Sai do plano de mídia: conversão, CPL, percentuais das fases e imposto do Meta')}
            {linhaCalc('Ticket', () => pn ? fmtMoeda(pn) : '—', false, 'Preço da oferta para não alunos, vem da ficha')}
            {linhaCalc('Faturamento da meta', c => fmtMoeda(fatMeta(c)), true)}
            {linhaCalc('ROAS da meta', c => roas(c) ? roas(c).toFixed(2) : '—')}
            {linhaCalc('Custo por venda', c => vn(c) ? fmtMoeda(invest(c) / vn(c)) : '—', false,
              'Investimento dividido pelas vendas da meta. Acima do ticket, cada venda dá prejuízo')}
            {linhaCalc('Resultado da meta', c => res(fatMeta(c) - invest(c)), true,
              'Faturamento menos investimento, antes da taxa da Hotmart')}
            {linhaCalc('Leads a 5%', c => leads(c, .05) || '—')}
            {linhaCalc('Leads a 8%', c => leads(c, .08) || '—')}
            {subtitulo('Bônus: alunos, fora da meta')}
            {linhaInput(INDICADORES_IMAGINACAO.vendas_alunos)}
            {linhaCalc('Faturamento do bônus', c => fmtMoeda(fatBonus(c)))}
            {linhaCalc('Faturamento com o bônus', c => fmtMoeda(fatMeta(c) + fatBonus(c)), true)}
            {linhaCalc('Resultado com o bônus', c => res(fatMeta(c) + fatBonus(c) - invest(c) - quente), true,
              'Inclui a verba do público quente, com imposto. Antes da taxa da Hotmart')}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', color:'var(--text-3)',
        marginTop:9, lineHeight:1.45 }}>
        A meta, o investimento e os leads contam só quem não é aluno. O investimento sai do
        plano de mídia para o volume de cada cenário. A venda do cenário alvo é
        a mesma do plano de mídia: mudou aqui, muda lá. Vendas para alunos são bônus.
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

function CampoNum({ label, valor, onSalvar, sufixo, dica, passo, tipo }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
      <span title={dica} style={{ flex:1, fontSize:12, fontFamily:'Roboto,sans-serif',
        color:'var(--text-2)', minWidth:0, cursor: dica ? 'help' : 'default',
        borderBottom: dica ? '1px dotted var(--app-border)' : 'none' }}>{label}</span>
      {tipo === 'moeda' ? (
        <CampoMoeda valor={valor} onSalvar={onSalvar} largura={114}/>
      ) : tipo === 'percent' ? (
        <CampoPercent valor={valor} onSalvar={onSalvar}/>
      ) : (
        <>
          <input type="number" step={passo || 'any'} defaultValue={valor ?? ''}
            onBlur={e => onSalvar(e.target.value === '' ? null : Number(e.target.value))}
            style={{ width:92, textAlign:'right', padding:'5px 7px', borderRadius:6,
              border:'1px solid var(--app-border)', background:'rgba(255,255,255,.03)',
              color:'var(--text-1)', fontSize:12, fontFamily:'Roboto,sans-serif',
              fontVariantNumeric:'tabular-nums' }}/>
          {sufixo && <span style={{ fontSize:11, color:'var(--text-3)', width:22,
            fontFamily:'Roboto,sans-serif' }}>{sufixo}</span>}
        </>
      )}
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

function BlocoPlanoMidia({ plano, onSalvar, precoFicha }) {
  const p = plano || {};
  const set = (k) => (v) => onSalvar({ ...p, [k]: v });
  const brl = v => window.fmtBRL ? window.fmtBRL(v) : fmtMoeda(v);

  const ticket  = Number(precoFicha) || Number(p.ticket_liquido) || 0;   // a ficha manda
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
  const verbaQuente = (Number(p.verba_alunos_dia) || 0) * (Number(p.dias_alunos) || 0);

  return (
    <SectionCard recolhivel idRecolher="pico:plano" title="Plano de mídia"
      right={<span style={{ fontSize:11, color:'var(--text-3)',
        fontFamily:'Roboto,sans-serif' }}>a meta vira verba por dia</span>}>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))', gap:16 }}>

        <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
          <div style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
            color:'var(--text-3)', letterSpacing:.4, textTransform:'uppercase' }}>Você define</div>
          <CampoNum label="Vendas esperadas" valor={p.vendas_meta} onSalvar={set('vendas_meta')} sufixo="un"/>
          {precoFicha ? (
            <LinhaCalc label="Ticket da oferta principal" valor={brl(ticket)}
              dica="Vem da ficha da campanha, oferta para não alunos. Mudou lá, muda aqui."/>
          ) : (
            <CampoNum label="Ticket do produto" valor={p.ticket_liquido} onSalvar={set('ticket_liquido')}
              tipo="moeda" dica="Já descontada a taxa da plataforma. É o que entra de verdade."/>
          )}
          <CampoNum label="Conversão de leads" valor={p.taxa_conversao} onSalvar={set('taxa_conversao')}
            tipo="percent" dica="No pico fica entre 5% e 10%, e o piso é 5%. A planilha usa 7%."/>
          <CampoNum label="Custo por lead" valor={p.cpl_meta} onSalvar={set('cpl_meta')}
            tipo="moeda" dica="No pico o lead custa de 2 a 3 vezes o normal."/>
          <CampoNum label="Imposto do Meta" valor={p.imposto_meta} onSalvar={set('imposto_meta')}
            tipo="percent" dica="A planilha do retiro usa 12,15%."/>
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
                    <CampoPercent valor={pct} onSalvar={v => set(e.fixa)(v)} largura={44} casas={1}/>
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

      {/* Público quente: só alunos, verba própria, fora da meta */}
      <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid var(--app-border)' }}>
        <div style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
          color:'var(--text-3)', letterSpacing:.4, textTransform:'uppercase', marginBottom:8 }}>
          Público quente: alunos, fora da meta
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:8 }}>
          <CampoNum label="Verba por dia" valor={p.verba_alunos_dia} onSalvar={set('verba_alunos_dia')}
            tipo="moeda" dica="Público pequeno satura rápido: comece baixo e suba só se a frequência aguentar."/>
          <CampoNum label="Dias rodando" valor={p.dias_alunos} onSalvar={set('dias_alunos')}
            sufixo="d" dica="Normalmente os dias de carrinho aberto."/>
          <LinhaCalc label="Verba total" valor={brl(verbaQuente)}/>
          <LinhaCalc label="Com imposto" valor={brl(verbaQuente * (1 + imposto))}/>
        </div>
        <div style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', color:'var(--text-3)',
          marginTop:7, lineHeight:1.45 }}>
          Anúncio só para compradores do MCV, sem quem já assina o Blindagem, vendendo a oferta
          de aluno. Não entra na meta nem no investimento acima: o que vender aqui é bônus.
        </div>
      </div>

      <div style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', color:'var(--text-3)',
        marginTop:11, lineHeight:1.45 }}>
        Percentuais e fórmulas da planilha oficial do retiro. Teaser e aquecimento são fixos,
        o remarketing sobe conforme os dias, e a captação é o que sobra.
      </div>
    </SectionCard>
  );
}



/* ── Grupo recolhível ───────────────────────────────────────────
   Cada fase ou trilha vira uma seção que fecha, com percentual e
   contagem no cabeçalho. O que está recolhido fica guardado no
   navegador, então uma fase concluída não volta aberta amanhã.
──────────────────────────────────────────────────────────────────*/
function GrupoRecolhivel({ id, titulo, cor, feitas, total, comando, children }) {
  const chave = 'pico:recolhido:' + id;
  const [fechado, setFechado] = useState(() => {
    try { return localStorage.getItem(chave) === '1'; } catch { return false; }
  });

  /* comando vem do botão de abrir ou fechar tudo, e traz um contador
     junto para o mesmo comando poder ser dado duas vezes seguidas. */
  useEffect(() => {
    if (!comando || !comando.acao) return;
    const novo = comando.acao === 'fechar';
    setFechado(novo);
    try { localStorage.setItem(chave, novo ? '1' : '0'); } catch {}
  }, [comando]);

  const alternar = () => {
    setFechado(f => {
      const novo = !f;
      try { localStorage.setItem(chave, novo ? '1' : '0'); } catch {}
      return novo;
    });
  };

  const pct = total > 0 ? Math.round((feitas / total) * 100) : 0;
  const completo = total > 0 && feitas === total;

  return (
    <div style={{ borderRadius:12, background:'var(--app-surface)',
      border:'1px solid var(--app-border)', overflow:'hidden' }}>
      <div onClick={alternar}
        style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px',
          cursor:'pointer', userSelect:'none' }}>
        <LucideIcon icon={fechado ? 'chevron-right' : 'chevron-down'} size={14}
          style={{ color:'var(--text-3)', flexShrink:0 }}/>
        <span style={{ width:8, height:8, borderRadius:99, background:cor || 'var(--text-3)',
          flexShrink:0 }}/>
        <span style={{ fontSize:13, fontFamily:'Roboto,sans-serif', fontWeight:700,
          color:'var(--text-1)', flexShrink:0 }}>{titulo}</span>

        {completo && (
          <LucideIcon icon="check-circle" size={14} style={{ color:'#4ade80', flexShrink:0 }}/>
        )}

        <div style={{ flex:1 }}/>

        <span style={{ fontSize:12, fontFamily:'Roboto,sans-serif', fontWeight:700,
          color: completo ? '#4ade80' : 'var(--text-2)',
          fontVariantNumeric:'tabular-nums', flexShrink:0, minWidth:38,
          textAlign:'right' }}>
          {pct}%
        </span>
        <span style={{ fontSize:11.5, fontFamily:'Roboto,sans-serif',
          color:'var(--text-3)', fontVariantNumeric:'tabular-nums', flexShrink:0,
          minWidth:44, textAlign:'right' }}>
          {feitas}/{total}
        </span>
        <div style={{ width:90, flexShrink:0 }}>
          <div style={{ height:5, borderRadius:99, background:'rgba(255,255,255,.07)',
            overflow:'hidden' }}>
            <div style={{ width:`${pct}%`, height:'100%', borderRadius:99,
              background: cor || '#4ade80',
              transition:'width 350ms cubic-bezier(.2,.7,.2,1)' }}/>
          </div>
        </div>
      </div>

      {!fechado && (
        <div style={{ padding:'0 12px 11px' }}>
          {children}
        </div>
      )}
    </div>
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
    <SectionCard recolhivel idRecolher="pico:calendario"
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
                onAbrir={()=>{}} mostrarTrilha onVirarCard={onAbrir.virarCard}
                onDefinir={onAbrir.definirTarefa} onAbrirCard={onAbrir.abrirCard}/>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}



/* ── Auditoria: o plano contra o real ───────────────────────────
   Pega o que foi planejado no plano de mídia e confronta com o que
   o Meta gastou de verdade nos anúncios marcados com este pico.
   O gasto vem de `insights_cache`, que o meta-sync atualiza sozinho
   quatro vezes por dia, então isso acompanha a campanha rodando.
──────────────────────────────────────────────────────────────────*/
function BlocoAuditoria({ projeto, tarefas }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const brl = v => window.fmtBRL ? window.fmtBRL(v) : fmtMoeda(v);

  const auditar = async () => {
    setCarregando(true);
    try {
      const { data: ads } = await window.db.from('ads')
        .select('numero,titulo,meta_ad_id,status')
        .eq('pico_projeto_id', projeto.id);
      const comId = (ads || []).filter(a => a.meta_ad_id);

      let gasto = 0, compras = 0, porAd = [];
      if (comId.length) {
        const { data: ins } = await window.db.from('insights_cache')
          .select('meta_ad_id,gasto,compras')
          .eq('periodo', 'maximum')
          .in('meta_ad_id', comId.map(a => a.meta_ad_id));
        const mapa = Object.fromEntries((ins || []).map(i => [i.meta_ad_id, i]));
        porAd = comId.map(a => ({
          numero: a.numero, titulo: a.titulo, status: a.status,
          gasto: Number(mapa[a.meta_ad_id]?.gasto) || 0,
          compras: Number(mapa[a.meta_ad_id]?.compras) || 0,
        })).sort((x, y) => y.gasto - x.gasto);
        gasto   = porAd.reduce((a, x) => a + x.gasto, 0);
        compras = porAd.reduce((a, x) => a + x.compras, 0);
      }
      setDados({ total: (ads || []).length, comId: comId.length, gasto, compras, porAd });
    } catch (e) {
      setDados({ erro: e.message });
    }
    setCarregando(false);
  };

  useEffect(() => { if (projeto?.id) auditar(); }, [projeto?.id]);

  /* O planejado vem da mesma escada do plano de mídia. */
  const p = projeto?.plano_midia || {};
  const pctRmk  = pctRemarketing(p.dias_remarketing);
  const pctCapt = 1 - (Number(p.pct_teaser)||0) - (Number(p.pct_aquecimento)||0) - pctRmk;
  const leads   = Number(p.taxa_conversao) > 0
    ? Math.ceil((Number(p.vendas_meta)||0) / Number(p.taxa_conversao)) : 0;
  const planejado = (pctCapt > 0 ? (leads * (Number(p.cpl_meta)||0)) / pctCapt : 0)
    + (Number(p.verba_alunos_dia)||0) * (Number(p.dias_alunos)||0);   // meta + público quente

  const gasto = dados?.gasto || 0;
  const consumo = planejado > 0 ? (gasto / planejado) * 100 : null;
  const cpaReal = dados?.compras > 0 ? gasto / dados.compras : null;

  return (
    <SectionCard recolhivel idRecolher="pico:auditoria" title="Plano contra o real"
      right={
        <button onClick={auditar} disabled={carregando}
          style={{ padding:'5px 11px', borderRadius:7, cursor: carregando?'default':'pointer',
            border:'1px solid var(--app-border)', background:'rgba(255,255,255,.05)',
            color:'var(--text-2)', fontSize:11.5, fontFamily:'Roboto,sans-serif',
            fontWeight:700, display:'flex', alignItems:'center', gap:5 }}>
          <LucideIcon icon={carregando ? 'loader' : 'refresh-cw'} size={12}
            style={carregando ? { animation:'spin 1s linear infinite' } : undefined}/>
          {carregando ? 'lendo' : 'atualizar'}
        </button>
      }>

      {dados?.erro && (
        <div style={{ fontSize:12, color:'#f87171', fontFamily:'Roboto,sans-serif' }}>
          {dados.erro}
        </div>
      )}

      {dados && !dados.erro && dados.total === 0 && (
        <div style={{ fontSize:12, fontFamily:'Roboto,sans-serif', color:'var(--text-3)',
          lineHeight:1.5 }}>
          Nenhum anúncio marcado com este pico ainda. Use o botão "card" numa tarefa de
          Tráfego, ou marque um anúncio existente, e o gasto real aparece aqui.
        </div>
      )}

      {dados && !dados.erro && dados.total > 0 && (
        <>
          <div style={{ display:'grid',
            gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:10, marginBottom:12 }}>
            {[
              ['Verba planejada', brl(planejado), 'var(--text-1)'],
              ['Gasto real', brl(gasto), '#38bdf8'],
              ['Consumo', consumo == null ? '—' : consumo.toFixed(0) + '%',
                consumo > 100 ? '#f87171' : '#4ade80'],
              ['Vendas no Meta', String(dados.compras), 'var(--text-1)'],
              ['CPA real', cpaReal ? brl(cpaReal) : '—', 'var(--text-1)'],
            ].map(([lb, v, cor]) => (
              <div key={lb} style={{ padding:'8px 10px', borderRadius:8,
                background:'rgba(255,255,255,.025)', border:'1px solid var(--app-border)' }}>
                <div style={{ fontSize:10, fontFamily:'Roboto,sans-serif',
                  color:'var(--text-3)', marginBottom:2 }}>{lb}</div>
                <div style={{ fontSize:14, fontFamily:'Roboto,sans-serif', fontWeight:700,
                  color:cor, fontVariantNumeric:'tabular-nums' }}>{v}</div>
              </div>
            ))}
          </div>

          {consumo != null && (
            <div style={{ marginBottom:12 }}>
              <div style={{ height:7, borderRadius:99, background:'rgba(255,255,255,.07)',
                overflow:'hidden' }}>
                <div style={{ width: Math.min(100, consumo) + '%', height:'100%',
                  borderRadius:99, background: consumo > 100 ? '#f87171' : '#38bdf8',
                  transition:'width 350ms' }}/>
              </div>
              {consumo > 100 && (
                <div style={{ fontSize:11, color:'#f87171', fontFamily:'Roboto,sans-serif',
                  marginTop:4 }}>
                  O gasto passou do planejado em {brl(gasto - planejado)}.
                </div>
              )}
            </div>
          )}

          <div style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
            color:'var(--text-3)', letterSpacing:.4, textTransform:'uppercase',
            marginBottom:6 }}>
            Anúncios deste pico ({dados.total}
            {dados.comId < dados.total ? `, ${dados.total - dados.comId} ainda sem publicar` : ''})
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
            {dados.porAd.map(a => (
              <div key={a.numero} style={{ display:'flex', alignItems:'center', gap:8,
                padding:'5px 8px', borderRadius:6, fontSize:11.5,
                fontFamily:'Roboto,sans-serif' }}>
                <span style={{ color:'var(--text-3)', fontWeight:700, minWidth:52,
                  fontVariantNumeric:'tabular-nums' }}>
                  ADS {String(a.numero).padStart(3,'0')}
                </span>
                <span style={{ flex:1, color:'var(--text-2)', overflow:'hidden',
                  textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.titulo}</span>
                <span style={{ color:'var(--text-3)', minWidth:38, textAlign:'right' }}>
                  {a.compras} {a.compras === 1 ? 'venda' : 'vendas'}
                </span>
                <span style={{ color:'var(--text-1)', fontWeight:700, minWidth:86,
                  textAlign:'right', fontVariantNumeric:'tabular-nums' }}>
                  {brl(a.gasto)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', color:'var(--text-3)',
        marginTop:11, lineHeight:1.45 }}>
        O gasto vem do Meta pelos anúncios marcados com este pico, e o Tracker
        sincroniza sozinho quatro vezes por dia. O perpétuo não entra na conta.
      </div>
    </SectionCard>
  );
}

/* ── Debriefing ─────────────────────────────────────────────────
   Os 9 indicadores e as 9 perguntas do playbook. O que dá para
   puxar do banco vem sozinho; o resto é preenchido à mão.

   De onde vem cada número automático:
     faturamento e vendas → tabela `vendas`, na janela do projeto
     verba e compras      → `insights_cache` periodo=maximum dos
                            anúncios marcados com este projeto
   Anúncio de pico só existe durante o pico, então o gasto de vida
   inteira dele é o gasto do pico. É mais preciso que `gasto_diario`,
   que soma a conta toda e misturaria o perpétuo.
──────────────────────────────────────────────────────────────────*/
const INDICADORES_DEBRIEF = [
  { chave:'faturamento',  label:'Faturamento',        unidade:'R$', auto:true,  calc:false },
  { chave:'vendas',       label:'Vendas',             unidade:'un', auto:true,  calc:false },
  { chave:'ticket_medio', label:'Ticket médio',       unidade:'R$', auto:false, calc:true,
    formula:'faturamento / vendas' },
  { chave:'leads_grupo',  label:'Leads no grupo',     unidade:'un', auto:false, calc:false,
    dica:'Total de pessoas nos grupos no dia da abertura. Não tem como puxar sozinho.' },
  { chave:'verba',        label:'Verba investida',    unidade:'R$', auto:true,  calc:false },
  { chave:'cpl',          label:'CPL',                unidade:'R$', auto:false, calc:true,
    formula:'verba / leads no grupo' },
  { chave:'cac',          label:'CAC',                unidade:'R$', auto:false, calc:true,
    formula:'verba / vendas' },
  { chave:'roas',         label:'ROAS',               unidade:'x',  auto:false, calc:true,
    formula:'faturamento / verba' },
  { chave:'conv_grupo',   label:'Conversão do grupo', unidade:'%',  auto:false, calc:true,
    formula:'vendas / leads no grupo' },
];

const PERGUNTAS_DEBRIEF = [
  'O que funcionou melhor na captação?',
  'Qual conteúdo vendeu mais?',
  'A narrativa gerou mesmo a sensação de melhor da história?',
  'O combo tinha bônus que o público queria?',
  'A ancoragem de preço foi bem feita?',
  'O que os disparos trouxeram?',
  'Quais coisas novas foram aplicadas e qual foi o resultado?',
  'O que não repetir na próxima?',
  'O que repetir com certeza?',
];

function BlocoDebriefing({ projeto, metricas, tarefas, onSalvar, onSalvarResposta, respostas }) {
  const [puxando, setPuxando] = useState(false);
  const [msg, setMsg] = useState(null);
  const brl = v => window.fmtBRL ? window.fmtBRL(v) : fmtMoeda(v);

  const val = (momento, chave) => {
    const m = metricas.find(x => x.momento === momento && x.indicador === chave && !x.cenario);
    return m && m.valor != null ? Number(m.valor) : null;
  };
  const meta = c => val('meta_debrief', c);
  const real = c => val('debriefing', c);

  /* Os derivados nunca são digitados, saem dos outros quatro. */
  const derivar = (chave, fonte) => {
    const f = fonte('faturamento'), v = fonte('vendas'),
          vb = fonte('verba'), lg = fonte('leads_grupo');
    switch (chave) {
      case 'ticket_medio': return v > 0 ? f / v : null;
      case 'cpl':          return lg > 0 ? vb / lg : null;
      case 'cac':          return v > 0 ? vb / v : null;
      case 'roas':         return vb > 0 ? f / vb : null;
      case 'conv_grupo':   return lg > 0 ? (v / lg) * 100 : null;
      default:             return null;
    }
  };

  const mostrar = (chave, momento) => {
    const ind = INDICADORES_DEBRIEF.find(i => i.chave === chave);
    const fonte = momento === 'debriefing' ? real : meta;
    const v = ind.calc ? derivar(chave, c => fonte(c) || 0) : fonte(chave);
    if (v == null || !isFinite(v)) return '—';
    if (ind.unidade === 'R$') return brl(v);
    if (ind.unidade === '%')  return v.toFixed(1) + '%';
    if (ind.unidade === 'x')  return v.toFixed(2);
    return Math.round(v).toLocaleString('pt-BR');
  };

  /* Puxa do banco o que dá: faturamento, vendas e verba do pico. */
  const puxarRealizado = async () => {
    if (!projeto?.data_abertura) { setMsg({ t:'erro', x:'Defina a data de abertura antes.' }); return; }
    setPuxando(true);
    try {
      const inicio = projeto.data_abertura;
      const fim = projeto.data_encerramento
        || tarefas.filter(t => t.fase === 'encerramento' && t.data_prevista)
             .map(t => t.data_prevista).sort().pop()
        || projeto.data_abertura;

      const { data: vendas } = await window.db.from('vendas')
        .select('valor_bruto')
        .eq('status', 'aprovada')
        .gte('hotmart_order_date', inicio)
        .lte('hotmart_order_date', fim + 'T23:59:59');

      const fat = (vendas || []).reduce((a, v) => a + (Number(v.valor_bruto) || 0), 0);
      const qtd = (vendas || []).length;

      const { data: ads } = await window.db.from('ads')
        .select('meta_ad_id').eq('pico_projeto_id', projeto.id).not('meta_ad_id','is',null);
      const ids = (ads || []).map(a => a.meta_ad_id);

      let verba = 0;
      if (ids.length) {
        const { data: ins } = await window.db.from('insights_cache')
          .select('gasto').eq('periodo','maximum').in('meta_ad_id', ids);
        verba = (ins || []).reduce((a, i) => a + (Number(i.gasto) || 0), 0);
      }

      await Promise.all([
        onSalvar('faturamento', fat),
        onSalvar('vendas', qtd),
        onSalvar('verba', verba),
      ]);
      setMsg({ t:'ok', x: ids.length
        ? `Puxado de ${inicio} a ${fim}. ${qtd} vendas e ${ids.length} anúncios do pico.`
        : `Puxado de ${inicio} a ${fim}. ${qtd} vendas. Nenhum anúncio marcado com este pico ainda, então a verba veio zerada.` });
    } catch (e) {
      setMsg({ t:'erro', x:e.message });
    }
    setPuxando(false);
    setTimeout(()=>setMsg(null), 8000);
  };

  return (
    <SectionCard recolhivel idRecolher="pico:debriefing" title="Debriefing"
      right={
        <button onClick={puxarRealizado} disabled={puxando}
          style={{ padding:'5px 11px', borderRadius:7, cursor: puxando?'default':'pointer',
            border:'1px solid var(--app-border)', background:'rgba(255,255,255,.05)',
            color:'var(--text-2)', fontSize:11.5, fontFamily:'Roboto,sans-serif',
            fontWeight:700, display:'flex', alignItems:'center', gap:5 }}>
          <LucideIcon icon={puxando ? 'loader' : 'download'} size={12}
            style={puxando ? { animation:'spin 1s linear infinite' } : undefined}/>
          {puxando ? 'puxando' : 'puxar o realizado'}
        </button>
      }>

      {msg && (
        <div style={{ marginBottom:10, padding:'7px 10px', borderRadius:7, fontSize:11.5,
          fontFamily:'Roboto,sans-serif', color:'var(--text-1)',
          background: msg.t==='ok' ? 'rgba(74,222,128,.1)' : 'rgba(248,113,113,.1)',
          border:'1px solid ' + (msg.t==='ok' ? 'rgba(74,222,128,.3)' : 'rgba(248,113,113,.3)') }}>
          {msg.x}
        </div>
      )}

      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:460 }}>
          <thead>
            <tr>
              <th style={{ textAlign:'left', padding:'5px 8px', fontSize:10.5,
                fontFamily:'Roboto,sans-serif', color:'var(--text-3)', fontWeight:700,
                textTransform:'uppercase', letterSpacing:.3 }}>Indicador</th>
              <th style={{ textAlign:'right', padding:'5px 8px', fontSize:10.5,
                fontFamily:'Roboto,sans-serif', color:'var(--text-3)', fontWeight:700,
                textTransform:'uppercase', letterSpacing:.3 }}>Meta</th>
              <th style={{ textAlign:'right', padding:'5px 8px', fontSize:10.5,
                fontFamily:'Roboto,sans-serif', color:'var(--text-3)', fontWeight:700,
                textTransform:'uppercase', letterSpacing:.3 }}>Realizado</th>
              <th style={{ textAlign:'right', padding:'5px 8px', fontSize:10.5,
                fontFamily:'Roboto,sans-serif', color:'var(--text-3)', fontWeight:700,
                textTransform:'uppercase', letterSpacing:.3 }}>Variação</th>
            </tr>
          </thead>
          <tbody>
            {INDICADORES_DEBRIEF.map(ind => {
              const m = ind.calc ? derivar(ind.chave, c => meta(c) || 0) : meta(ind.chave);
              const r = ind.calc ? derivar(ind.chave, c => real(c) || 0) : real(ind.chave);
              const varia = (m && r && isFinite(m) && isFinite(r) && m !== 0)
                ? ((r - m) / m) * 100 : null;
              return (
                <tr key={ind.chave} style={{ borderTop:'1px solid var(--app-border)' }}>
                  <td style={{ padding:'5px 8px', fontSize:12, fontFamily:'Roboto,sans-serif',
                    color:'var(--text-2)', whiteSpace:'nowrap' }}>
                    <span title={ind.formula ? 'Calculado: ' + ind.formula : ind.dica}
                      style={{ cursor: (ind.formula || ind.dica) ? 'help' : 'default',
                        borderBottom: (ind.formula || ind.dica) ? '1px dotted var(--app-border)' : 'none' }}>
                      {ind.label}
                    </span>
                    {ind.auto && (
                      <span title="Vem do banco" style={{ marginLeft:5, fontSize:9,
                        color:'#4ade80', fontFamily:'Roboto,sans-serif', fontWeight:700 }}>auto</span>
                    )}
                  </td>
                  <td style={{ padding:'3px 8px', textAlign:'right' }}>
                    {ind.calc ? (
                      <span style={{ fontSize:12, fontFamily:'Roboto,sans-serif',
                        color:'var(--text-3)', fontVariantNumeric:'tabular-nums' }}>
                        {mostrar(ind.chave, 'meta_debrief')}
                      </span>
                    ) : (
                      ind.unidade === 'R$' ? (
                        <CampoMoeda valor={meta(ind.chave)} largura={112}
                          onSalvar={v => onSalvar(ind.chave, v, 'meta_debrief')}/>
                      ) : (
                      <input type="number" defaultValue={meta(ind.chave) ?? ''}
                        onBlur={e => onSalvar(ind.chave, e.target.value === '' ? null : Number(e.target.value), 'meta_debrief')}
                        style={{ width:92, textAlign:'right', padding:'4px 6px', borderRadius:6,
                          border:'1px solid var(--app-border)', background:'rgba(255,255,255,.03)',
                          color:'var(--text-2)', fontSize:12, fontFamily:'Roboto,sans-serif',
                          fontVariantNumeric:'tabular-nums' }}/>
                      )
                    )}
                  </td>
                  <td style={{ padding:'3px 8px', textAlign:'right' }}>
                    {ind.calc ? (
                      <span style={{ fontSize:12.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
                        color:'var(--text-1)', fontVariantNumeric:'tabular-nums' }}>
                        {mostrar(ind.chave, 'debriefing')}
                      </span>
                    ) : (
                      ind.unidade === 'R$' ? (
                        <CampoMoeda valor={real(ind.chave)} largura={112}
                          onSalvar={v => onSalvar(ind.chave, v)}
                          estilo={{ fontWeight:700, background:'rgba(255,255,255,.05)' }}/>
                      ) : (
                      <input type="number" defaultValue={real(ind.chave) ?? ''}
                        onBlur={e => onSalvar(ind.chave, e.target.value === '' ? null : Number(e.target.value))}
                        style={{ width:92, textAlign:'right', padding:'4px 6px', borderRadius:6,
                          border:'1px solid var(--app-border)', background:'rgba(255,255,255,.05)',
                          color:'var(--text-1)', fontSize:12, fontFamily:'Roboto,sans-serif',
                          fontWeight:700, fontVariantNumeric:'tabular-nums' }}/>
                      )
                    )}
                  </td>
                  <td style={{ padding:'5px 8px', textAlign:'right', fontSize:11.5,
                    fontFamily:'Roboto,sans-serif', fontWeight:700,
                    fontVariantNumeric:'tabular-nums',
                    color: varia == null ? 'var(--text-3)' : varia >= 0 ? '#4ade80' : '#f87171' }}>
                    {varia == null ? '—' : (varia >= 0 ? '+' : '') + varia.toFixed(0) + '%'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop:15, paddingTop:12, borderTop:'1px solid var(--app-border)' }}>
        <div style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
          color:'var(--text-3)', letterSpacing:.4, textTransform:'uppercase',
          marginBottom:9 }}>As 9 perguntas</div>
        <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
          {PERGUNTAS_DEBRIEF.map((q, i) => (
            <div key={i}>
              <div style={{ fontSize:12, fontFamily:'Roboto,sans-serif', fontWeight:600,
                color:'var(--text-2)', marginBottom:3 }}>{i+1}. {q}</div>
              <textarea defaultValue={respostas[i] || ''}
                onBlur={e => onSalvarResposta(i, e.target.value)}
                placeholder="responda com a memória fresca"
                rows={2}
                style={{ width:'100%', padding:'7px 9px', borderRadius:7, resize:'vertical',
                  border:'1px solid var(--app-border)', background:'rgba(255,255,255,.03)',
                  color:'var(--text-1)', fontSize:12, fontFamily:'Roboto,sans-serif',
                  lineHeight:1.45 }}/>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', color:'var(--text-3)',
        marginTop:11, lineHeight:1.45 }}>
        Faturamento, vendas e verba vêm do banco. A verba soma só os anúncios marcados com
        este pico, então o perpétuo não entra na conta. Leads no grupo é o único que precisa
        ser contado à mão.
      </div>
    </SectionCard>
  );
}

/* ── Tela principal ─────────────────────────────────────────────*/
function PicoScreen({ onNavigate }) {
  const [projetos, setProjetos]   = useState([]);
  const [projetoId, setProjetoId] = useState(null);
  const [tarefas, setTarefas]     = useState([]);
  const [decisoes, setDecisoes]   = useState([]);
  const [metricas, setMetricas]   = useState([]);
  const [visao, setVisao]         = useState('fase');   // fase | trilha | calendario
  const [filtroTrilha, setFiltroTrilha] = useState('todas');
  const [ocultarFeitas, setOcultarFeitas] = useState(false);
  const [comandoGrupos, setComandoGrupos] = useState({ acao:null, n:0 });
  const [carregando, setCarregando] = useState(true);

  const projeto = projetos.find(p => p.id === projetoId) || null;

  /* Biblioteca de exemplos: global, carrega uma vez */
  const [biblioteca, setBiblioteca] = useState([]);
  useEffect(() => {
    window.db.from('pico_biblioteca').select('*').order('ordem')
      .then(({ data }) => setBiblioteca(data || []));
  }, []);
  /* Caderno da Black, também global */
  const [caderno, setCaderno] = useState([]);
  useEffect(() => {
    window.db.from('pico_caderno').select('id,numero,titulo,html,ordem').order('ordem')
      .then(({ data }) => setCaderno(data || []));
  }, []);

  const addExemplo = async (item) => {
    const { data } = await window.db.from('pico_biblioteca').insert(item).select().single();
    if (data) setBiblioteca(b => [...b, data].sort((x, y) => x.ordem - y.ordem));
  };
  const delExemplo = async (id) => {
    setBiblioteca(b => b.filter(x => x.id !== id));
    await window.db.from('pico_biblioteca').delete().eq('id', id);
  };

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

  /* Salvar indicador do debriefing (realizado ou meta) */
  const salvarDebrief = async (indicador, valor, momento = 'debriefing') => {
    const existente = metricas.find(m =>
      m.momento === momento && m.indicador === indicador && !m.cenario);
    if (existente) {
      setMetricas(ms => ms.map(m => m.id === existente.id ? { ...m, valor } : m));
      await window.db.from('pico_metricas').update({ valor }).eq('id', existente.id);
    } else {
      const { data } = await window.db.from('pico_metricas').insert({
        projeto_id: projetoId, momento, cenario: null, indicador, valor,
      }).select().single();
      if (data) setMetricas(ms => [...ms, data]);
    }
  };

  /* As 9 respostas ficam no proprio projeto, em observacoes */
  const respostas = (() => {
    try { return JSON.parse(projeto?.observacoes || '{}').debrief || []; }
    catch { return []; }
  })();
  const salvarResposta = async (i, texto) => {
    let obj = {};
    try { obj = JSON.parse(projeto?.observacoes || '{}'); } catch { obj = {}; }
    const arr = obj.debrief || [];
    arr[i] = texto;
    obj.debrief = arr;
    const novo = JSON.stringify(obj);
    setProjetos(ps => ps.map(p => p.id === projetoId ? { ...p, observacoes: novo } : p));
    await window.db.from('pico_projetos').update({ observacoes: novo }).eq('id', projetoId);
  };

  /* Salvar métrica da imaginação primária */
  const salvarMetrica = async (cenario, indicador, valor, unidade) => {
    const v = valor === '' ? null : Number(valor);

    /* Ticket e investimento são os mesmos nos três cenários: o que muda de um
       para o outro é o volume de vendas. Preencheu um, os que estão vazios
       recebem o mesmo valor, sem precisar digitar três vezes. */
    const acha = (lista, cen) => lista.find(m =>
      m.momento === 'imaginacao' && m.cenario === cen && m.indicador === indicador);
    const espelha = v != null && (indicador === 'ticket' || indicador === 'investimento');
    const alvos = espelha
      ? CENARIOS.filter(c => { const m = acha(metricas, c); return c === cenario || !m || m.valor == null; })
      : [cenario];

    let lista = metricas;
    for (const cen of alvos) {
      const ex = acha(lista, cen);
      if (ex) {
        lista = lista.map(m => m.id === ex.id ? { ...m, valor:v } : m);
        await window.db.from('pico_metricas').update({ valor:v }).eq('id', ex.id);
      } else {
        const { data } = await window.db.from('pico_metricas').insert({
          projeto_id: projetoId, momento:'imaginacao', cenario:cen, indicador, valor:v, unidade,
        }).select().single();
        if (data) lista = [...lista, data];
      }
    }
    setMetricas(lista);
    /* A venda do cenário alvo é a meta do plano de mídia */
    if (cenario === 'alvo' && indicador === 'vendas' && v != null && projeto)
      await salvarPlano({ ...(projeto.plano_midia || {}), vendas_meta: v });
  };

  /* Gravar na ficha da campanha. Preço do pico também vira o ticket do projeto. */
  const salvarDeclaracoes = async (patch) => {
    const atual = projeto?.declaracoes || {};
    const novo = { ...atual, ...patch };
    const extra = {};
    if ('preco_pico' in patch) extra.ticket = patch.preco_pico ?? null;
    setProjetos(ps => ps.map(p => p.id === projetoId ? { ...p, declaracoes: novo, ...extra } : p));
    await window.db.from('pico_projetos').update({ declaracoes: novo, ...extra }).eq('id', projetoId);
  };
  const salvarDeclaracao = (k, v) =>
    salvarDeclaracoes({ [k]: v, ...espelharFicha(k, v, projeto?.declaracoes || {}) });

  /* Registrar o que foi definido numa tarefa.
     Campo marcado com "alimenta" copia o valor para o plano do projeto,
     para o número não precisar ser digitado de novo lá em cima. */
  const definirTarefa = async (t, vals) => {
    setTarefas(ts => ts.map(x => x.id === t.id ? { ...x, definicoes: vals } : x));
    await window.db.from('pico_tarefas').update({ definicoes: vals }).eq('id', t.id);

    const campos = Array.isArray(t.campos) ? t.campos : [];
    /* Campo vinculado que mudou sobe para a ficha, e dela para as outras tarefas */
    const antes = t.definicoes || {};
    const dec = {};
    campos.forEach(c => {
      if (c.vinculo && JSON.stringify(vals[c.chave] ?? null) !== JSON.stringify(antes[c.chave] ?? null))
        dec[c.vinculo] = vals[c.chave] ?? null;
    });
    if (Object.keys(dec).length) await salvarDeclaracoes(dec);

    let plano = null, proj = null;
    campos.forEach(c => {
      if (!c.alimenta) return;
      const v = vals[c.chave];
      if (v == null || v === '') return;
      const [onde, chave] = c.alimenta.split('.');
      if (onde === 'plano')   plano = { ...(plano || projeto.plano_midia || {}), [chave]: v };
      if (onde === 'projeto') proj  = { ...(proj || {}), [chave]: v };
    });
    if (plano || proj) {
      const patch = { ...(proj || {}), ...(plano ? { plano_midia: plano } : {}) };
      setProjetos(ps => ps.map(p => p.id === projetoId ? { ...p, ...patch } : p));
      await window.db.from('pico_projetos').update(patch).eq('id', projetoId);
    }
  };

  /* Clique na tarefa leva até o card que ela virou, no Orgânico ou nos Anúncios.
     Sem isso o vínculo existia só como texto e obrigava a procurar o card na mão. */
  const abrirCard = (t) => {
    if (!onNavigate || !t.card_id) return;
    onNavigate(t.card_tipo === 'ads' ? 'criativos' : 'organico', t.card_id);
  };

  /* Tarefa vira card no kanban, já marcada com o projeto */
  const [aviso, setAviso] = useState(null);
  const virarCard = async (t) => {
    try {
      const r = await criarCardDaTarefa(t, projeto);
      const marca = `${r.tipo}: ${r.rotulo}`;
      const patch = { entregavel_url: marca, card_tipo: r.cardTipo, card_id: r.cardId,
                      status: t.status === 'pendente' ? 'fazendo' : t.status };
      await window.db.from('pico_tarefas').update(patch).eq('id', t.id);
      setTarefas(ts => ts.map(x => x.id === t.id ? { ...x, ...patch } : x));
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

  /* Recortes. Cada tarefa já chega com o que está declarado na ficha. */
  const efetivas = useMemo(() => tarefas.map(t =>
    Array.isArray(t.campos) && t.campos.length
      ? { ...t, definicoes: defsEfetivas(t, projeto) } : t
  ), [tarefas, projeto]);

  const visiveis = useMemo(() => efetivas.filter(t =>
    (filtroTrilha === 'todas' || t.trilha === filtroTrilha) &&
    (!ocultarFeitas || t.status !== 'feito')
  ), [efetivas, filtroTrilha, ocultarFeitas]);

  const feitas = tarefas.filter(t => t.status === 'feito').length;
  const atrasadas = tarefas.filter(t =>
    t.status !== 'feito' && t.status !== 'pulada' &&
    t.data_prevista && t.data_prevista < hojeISO()).length;
  const paraValidar = tarefas.filter(t => t.status === 'validar').length;
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
          {paraValidar > 0 && <Badge tone="warn">{paraValidar} para validar</Badge>}

          <div style={{ flex:1, minWidth:120, maxWidth:260 }}>
            <Progresso feitas={feitas} total={tarefas.length}/>
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <BlocoFicha declaracoes={projeto?.declaracoes} onSalvar={salvarDeclaracao}
            semMentoria={(decisoes.find(d => d.chave === 'mentoria')?.escolha || '')
              .toLowerCase().startsWith('nao')}/>
        </div>

        {/* Imaginação primária e decisões */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(340px,1fr))',
          gap:14, marginBottom:14 }}>
          <BlocoImaginacao metricas={metricas.filter(m=>m.momento==='imaginacao')}
            onSalvar={salvarMetrica} metaPlano={projeto?.plano_midia?.vendas_meta}
            plano={projeto?.plano_midia || {}}
            precos={{ nao: projeto?.declaracoes?.preco_pico, aluno: projeto?.declaracoes?.preco_aluno,
                      prodNao: projeto?.declaracoes?.produto, prodAluno: projeto?.declaracoes?.produto_aluno }}/>
          <BlocoDecisoes decisoes={decisoes} onEscolher={escolherDecisao}/>
        </div>

        <div style={{ marginBottom:14 }}>
          <BlocoPlanoMidia plano={projeto?.plano_midia} onSalvar={salvarPlano}
            precoFicha={projeto?.declaracoes?.preco_pico}/>
        </div>

        <div style={{ marginBottom:14 }}>
          <BlocoAuditoria projeto={projeto} tarefas={tarefas}/>
        </div>

        <div style={{ marginBottom:14 }}>
          <BlocoBiblioteca itens={biblioteca} onAdicionar={addExemplo} onRemover={delExemplo}/>
        </div>

        {caderno.length > 0 && (
          <div style={{ marginBottom:14 }}>
            <BlocoCaderno partes={caderno}/>
          </div>
        )}

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

          <button onClick={()=>setComandoGrupos(c => {
              const acao = c.acao === 'fechar' ? 'abrir' : 'fechar';
              window.dispatchEvent(new CustomEvent('secoes:recolher', { detail: acao }));
              return { acao, n: (c.n || 0) + 1 };
            })}
            title="Abrir ou fechar todas as seções"
            style={{ padding:'6px 9px', borderRadius:7, cursor:'pointer',
              border:'1px solid var(--app-border)', background:'transparent',
              color:'var(--text-3)', display:'flex', alignItems:'center' }}>
            <LucideIcon icon={comandoGrupos.acao === 'fechar' ? 'chevrons-up-down' : 'chevrons-down-up'} size={13}/>
          </button>

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
            onAbrir={{ toggle: alternarTarefa, virarCard, definirTarefa, abrirCard }}/>
        ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {ordemGrupos.map(gid => {
            const lista = porGrupo[gid];
            if (!lista || !lista.length) return null;
            const cfg = visao === 'trilha' ? TRILHA_MAP[gid] : FASE_MAP[gid];
            const gf = lista.filter(t => t.status === 'feito').length;
            return (
              <GrupoRecolhivel key={gid} id={`${visao}:${gid}`}
                titulo={cfg?.label || gid} cor={cfg?.cor}
                feitas={gf} total={lista.length} comando={comandoGrupos}>
                <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                  {lista.map(t => (
                    <LinhaTarefa key={t.id} t={t} onToggle={alternarTarefa}
                      onAbrir={()=>{}} mostrarTrilha={visao === 'fase'}
                      onVirarCard={virarCard} onDefinir={definirTarefa} onAbrirCard={abrirCard}/>
                  ))}
                </div>
              </GrupoRecolhivel>
            );
          })}
        </div>
        )}

        {/* Debriefing por último, é a última coisa que acontece */}
        <div style={{ marginTop:14 }}>
          <BlocoDebriefing projeto={projeto} metricas={metricas} tarefas={tarefas}
            onSalvar={salvarDebrief} onSalvarResposta={salvarResposta}
            respostas={respostas}/>
        </div>
      </div>
    </div>
  );
}

window.PicoScreen = PicoScreen;
