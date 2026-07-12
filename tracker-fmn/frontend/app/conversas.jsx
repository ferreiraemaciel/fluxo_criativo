/* ================================================================
   Tracker FMN — Conversas (caixa de entrada do WhatsApp) v1
   Lista de contatos + thread + resposta manual, dentro da janela de
   serviço de 24h aberta pelo lead. Sem custo por mensagem aqui.

   A aba Métricas reaproveita VizCard/Donut/Bar/PALETTE/nf/SectionCard
   declarados em funis.jsx (scripts clássicos, mesmo escopo global). Por
   isso o index.html carrega funis.jsx ANTES de conversas.jsx. Não
   redeclare esses nomes aqui, senão quebra o Funis.
   ================================================================ */
const { useState, useEffect, useRef, useMemo } = React;
const { LucideIcon, Btn, TopBar, CardKPI } = window;

function normalizarTelefoneExibicao(tel) {
  const d = String(tel || '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) {
    const ddd = d.slice(2, 4), resto = d.slice(4);
    return `+55 (${ddd}) ${resto.length > 8 ? resto.slice(0,5)+'-'+resto.slice(5) : resto.slice(0,4)+'-'+resto.slice(4)}`;
  }
  return tel;
}

function horaCurta(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function dataCurta(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

const JANELA_MS = 24 * 60 * 60 * 1000;

/* Janela de 24h: true se a última mensagem de ENTRADA foi há menos de 24h. */
function janelaAberta(ultimaEntrada) {
  if (!ultimaEntrada) return false;
  return (Date.now() - new Date(ultimaEntrada).getTime()) < JANELA_MS;
}

/* Formata custo em USD junto com a conversão em BRL pela cotação oficial (PTAX/BCB). */
function fmtUsdBrl(usd, cambio, casas = 2) {
  const emUsd = 'US$ ' + Number(usd || 0).toFixed(casas);
  if (!cambio?.usdBrl) return emUsd;
  const brl = Number(usd || 0) * cambio.usdBrl;
  return `${emUsd} (R$ ${brl.toFixed(casas)})`;
}

/* Quanto falta da janela, em texto curto. null se fechada/sem entrada. */
function tempoRestanteJanela(ultimaEntrada) {
  if (!ultimaEntrada) return null;
  const restanteMs = JANELA_MS - (Date.now() - new Date(ultimaEntrada).getTime());
  if (restanteMs <= 0) return null;
  const h = Math.floor(restanteMs / 3600000);
  const m = Math.floor((restanteMs % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}min restantes` : `${m}min restantes`;
}

/* Quanto falta pra rotina de arquivamento automático marcar como "Perdido"
   (mesma janela de 24h, mesma referência que o whatsapp-arquivar-perdidos usa
   no backend). null se já passou (arquivamento é só questão de minutos até o
   próximo ciclo do cron) ou se não há referência nenhuma. */
function tempoAteArquivar(referencia) {
  if (!referencia) return null;
  const restanteMs = JANELA_MS - (Date.now() - new Date(referencia).getTime());
  if (restanteMs <= 0) return null;
  const h = Math.floor(restanteMs / 3600000);
  const m = Math.floor((restanteMs % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function ContatoItem({ contato, ativo, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer',
      background: ativo ? 'rgba(234,170,65,.10)' : 'transparent',
      borderLeft: ativo ? '3px solid var(--fmn-gold)' : '3px solid transparent',
      borderBottom: '1px solid var(--app-border)',
    }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%',
          background: 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: 'var(--text-2)', fontFamily: 'Roboto,sans-serif',
        }}>
          {(contato.nome || '?').slice(0, 1).toUpperCase()}
        </div>
        <div title={contato.janelaAberta ? 'Janela de 24h aberta' : 'Janela fechada'} style={{
          position: 'absolute', bottom: -1, right: -1, width: 11, height: 11, borderRadius: '50%',
          background: contato.janelaAberta ? '#4ade80' : 'var(--text-3)',
          border: '2px solid var(--app-surface, #0f1013)',
        }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
            {contato.precisaHumano && (
              <span title="Precisa de humano" style={{ flexShrink: 0, fontSize: 9, fontWeight: 800, color: '#f87171',
                background: 'rgba(248,113,113,.14)', border: '1px solid rgba(248,113,113,.3)', borderRadius: 4, padding: '1px 4px' }}>!</span>
            )}
            <div style={{ fontSize: 13, fontWeight: contato.naoLidas > 0 ? 800 : 600, color: 'var(--text-1)',
              fontFamily: 'Roboto,sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {contato.nome || normalizarTelefoneExibicao(contato.telefone)}
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0 }}>{horaCurta(contato.ultimaData)}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <div style={{ fontSize: 11.5, color: contato.naoLidas > 0 ? 'var(--text-1)' : 'var(--text-3)',
            fontFamily: 'Roboto,sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {contato.ultimaDirecao === 'saida' ? 'Você: ' : ''}{contato.ultimoCorpo}
          </div>
          {contato.naoLidas > 0 && (
            <div style={{ minWidth: 18, height: 18, borderRadius: 9, background: 'var(--fmn-gold)', color: '#1a1a1a',
              fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
              {contato.naoLidas}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Bolha({ msg }) {
  const isSaida = msg.direcao === 'saida';
  return (
    <div style={{ display: 'flex', justifyContent: isSaida ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
      <div style={{
        maxWidth: '72%', padding: '8px 12px', borderRadius: 12,
        borderBottomRightRadius: isSaida ? 3 : 12, borderBottomLeftRadius: isSaida ? 12 : 3,
        background: isSaida ? 'rgba(234,170,65,.16)' : 'rgba(255,255,255,.05)',
        border: '1px solid ' + (isSaida ? 'rgba(234,170,65,.25)' : 'var(--app-border)'),
      }}>
        {msg.tipo === 'template' && (
          <div style={{ fontSize: 9.5, color: 'var(--text-3)', marginBottom: 3, fontFamily: 'Roboto,sans-serif', textTransform: 'uppercase', letterSpacing: .4 }}>
            modelo: {msg.template_nome}
          </div>
        )}
        {msg.origem === 'ia' && (
          <div style={{ fontSize: 9.5, color: 'var(--fmn-gold)', marginBottom: 3, fontFamily: 'Roboto,sans-serif', textTransform: 'uppercase', letterSpacing: .4 }}>
            Claudinho
          </div>
        )}
        <div style={{ fontSize: 13, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
          {msg.corpo}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 3 }}>
          <span style={{ fontSize: 9.5, color: 'var(--text-3)' }}>{horaCurta(msg.created_at)}</span>
          {isSaida && (
            <LucideIcon
              icon={msg.status === 'falhou' ? 'x' : (msg.status === 'entregue' || msg.status === 'lido') ? 'check-check' : 'check'}
              size={11}
              style={{ color: msg.status === 'falhou' ? 'var(--clr-neg)' : msg.status === 'lido' ? 'var(--fmn-gold)' : 'var(--text-3)' }} />
          )}
        </div>
      </div>
    </div>
  );
}

/* Templates aprovados disponíveis pra iniciar contato do zero (fora da janela). */
const TEMPLATES_DISPONIVEIS = [
  { nome: 'boas_vindas_mcv', label: 'Boas-vindas MCV', campos: ['Nome do contato', 'Link do grupo'] },
  { nome: 'resultado_quiz_mcv', label: 'Resultado do quiz', campos: ['Nome do contato', 'Nível de risco', 'Dor prioritária'] },
];

function PromptClaudinhoModal({ onClose, SUPA_URL, SUPA_KEY }) {
  const [prompt, setPrompt] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    fetch(`${SUPA_URL}/functions/v1/whatsapp-prompt-atual`, { headers: { Authorization: `Bearer ${SUPA_KEY}` } })
      .then(r => r.json())
      .then(d => { if (d.error) setErro(d.error); else setPrompt(d.prompt); })
      .catch(e => setErro(String(e)));
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 720, maxWidth: '92vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        background: 'var(--app-surface)', border: '1px solid var(--app-border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--app-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif' }}>Prompt atual do Claudinho</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'Roboto,sans-serif' }}>Só leitura. Pra mudar, é preciso alterar o código e fazer novo deploy.</div>
          </div>
          <Btn variant="ghost" onClick={onClose}><LucideIcon icon="x" size={16} /></Btn>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {erro && <div style={{ color: 'var(--clr-neg)', fontSize: 13, fontFamily: 'Roboto,sans-serif' }}>Erro ao carregar: {erro}</div>}
          {!erro && !prompt && <div style={{ color: 'var(--text-3)', fontSize: 13, fontFamily: 'Roboto,sans-serif' }}>Carregando...</div>}
          {prompt && (
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12.5, lineHeight: 1.6,
              color: 'var(--text-2)', fontFamily: 'monospace' }}>{prompt}</pre>
          )}
        </div>
      </div>
    </div>
  );
}

function NovoContatoModal({ onClose, onEnviado, SUPA_URL, SUPA_KEY }) {
  const [telefone, setTelefone]   = useState('');
  const [nome, setNome]           = useState('');
  const [templateNome, setTemplateNome] = useState(TEMPLATES_DISPONIVEIS[0].nome);
  const [valores, setValores]     = useState(['', '']);
  const [enviando, setEnviando]   = useState(false);
  const template = TEMPLATES_DISPONIVEIS.find(t => t.nome === templateNome);

  function trocarTemplate(nomeNovo) {
    setTemplateNome(nomeNovo);
    const t = TEMPLATES_DISPONIVEIS.find(x => x.nome === nomeNovo);
    setValores(new Array(t.campos.length).fill(''));
  }

  async function confirmarEnvio() {
    if (!telefone.trim()) { alert('Telefone é obrigatório.'); return; }
    if (!window.confirm(`Isso vai custar aproximadamente R$ 0,03 (mensagem de Utilidade), porque é a empresa iniciando contato. Confirma o envio?`)) return;
    setEnviando(true);
    try {
      const r = await fetch(`${SUPA_URL}/functions/v1/whatsapp-enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPA_KEY}` },
        body: JSON.stringify({ action: 'template', to: telefone, nome: nome || null, template_nome: templateNome, idioma: 'pt_BR', parametros: valores, origem: 'manual' }),
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || 'falha no envio');
      onEnviado(telefone);
    } catch (e) {
      alert('Erro ao enviar: ' + e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 380, background: 'var(--app-surface)', border: '1px solid var(--app-border)', borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif', marginBottom: 4 }}>Novo contato</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontFamily: 'Roboto,sans-serif', marginBottom: 14 }}>
          Primeiro contato precisa ser um template aprovado. Tem custo por mensagem.
        </div>

        <label style={{ fontSize: 11, color: 'var(--text-2)', fontFamily: 'Roboto,sans-serif', display: 'block', marginBottom: 4 }}>Telefone (com DDD)</label>
        <input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="48996450791"
          style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,.04)', border: '1px solid var(--app-border)',
            borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif', outline: 'none', marginBottom: 10 }} />

        <label style={{ fontSize: 11, color: 'var(--text-2)', fontFamily: 'Roboto,sans-serif', display: 'block', marginBottom: 4 }}>Nome do contato</label>
        <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Camila"
          style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,.04)', border: '1px solid var(--app-border)',
            borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif', outline: 'none', marginBottom: 10 }} />

        <label style={{ fontSize: 11, color: 'var(--text-2)', fontFamily: 'Roboto,sans-serif', display: 'block', marginBottom: 4 }}>Template</label>
        <select value={templateNome} onChange={e => trocarTemplate(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,.04)', border: '1px solid var(--app-border)',
            borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif', outline: 'none', marginBottom: 10 }}>
          {TEMPLATES_DISPONIVEIS.map(t => <option key={t.nome} value={t.nome}>{t.label}</option>)}
        </select>

        {template.campos.map((campo, i) => (
          <div key={i}>
            <label style={{ fontSize: 11, color: 'var(--text-2)', fontFamily: 'Roboto,sans-serif', display: 'block', marginBottom: 4 }}>{campo}</label>
            <input value={valores[i] || ''} onChange={e => setValores(v => { const n = [...v]; n[i] = e.target.value; return n; })}
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,.04)', border: '1px solid var(--app-border)',
                borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif', outline: 'none', marginBottom: 10 }} />
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancelar</Btn>
          <Btn onClick={confirmarEnvio} disabled={enviando} style={{ flex: 1 }}>{enviando ? 'Enviando...' : 'Enviar template'}</Btn>
        </div>
      </div>
    </div>
  );
}

/* Mesma paleta e mesmo desenho do Kanban de Anúncios (kanban.jsx). */
const ETAPAS = [
  { id: 'lead_novo',   label: 'Lead novo',   colorDot: '#60a5fa', colorBg: 'rgba(96,165,250,.08)',  colorBorder: 'rgba(96,165,250,.25)' },
  { id: 'em_conversa', label: 'Em conversa', colorDot: '#fbbf24', colorBg: 'rgba(251,191,36,.08)',  colorBorder: 'rgba(251,191,36,.25)' },
  { id: 'aluno',       label: 'Aluno',       colorDot: '#4ade80', colorBg: 'rgba(74,222,128,.08)',  colorBorder: 'rgba(74,222,128,.25)' },
  { id: 'perdido',     label: 'Perdido',     colorDot: '#f87171', colorBg: 'rgba(248,113,113,.06)', colorBorder: 'rgba(248,113,113,.2)' },
];

function ConvKanbanCard({ contato, col, onAbrir, onDragStart, onDropAntes }) {
  const [hov, setHov] = useState(false);
  const [dragOverTopo, setDragOverTopo] = useState(false);
  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData('telefone', contato.telefone); e.dataTransfer.setData('fromEtapa', contato.etapa); onDragStart && onDragStart(); }}
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOverTopo(true); }}
      onDragLeave={() => setDragOverTopo(false)}
      onDrop={e => {
        e.preventDefault(); e.stopPropagation(); setDragOverTopo(false);
        const tel = e.dataTransfer.getData('telefone');
        if (tel && tel !== contato.telefone) onDropAntes && onDropAntes(tel);
      }}
      onClick={onAbrir}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov ? 'var(--app-surface-3)' : 'var(--app-surface-2)',
        border: `1px solid ${dragOverTopo ? col.colorDot : hov ? col.colorBorder : 'var(--app-border)'}`,
        borderTop: dragOverTopo ? `2px solid ${col.colorDot}` : undefined,
        borderRadius: 10, padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 6,
        cursor: 'grab', transition: 'all 160ms var(--ease-out)', transform: hov ? 'translateY(-1px)' : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <div title={contato.janelaAberta ? 'Janela de 24h aberta' : 'Janela fechada'} style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: contato.janelaAberta ? '#4ade80' : 'var(--text-3)' }} />
        {contato.precisaHumano && (
          <span title="Precisa de humano" style={{ flexShrink: 0, fontSize: 9, fontWeight: 800, color: '#f87171',
            background: 'rgba(248,113,113,.14)', border: '1px solid rgba(248,113,113,.3)', borderRadius: 4, padding: '1px 4px' }}>!</span>
        )}
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {contato.nome || normalizarTelefoneExibicao(contato.telefone)}
        </div>
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontFamily: 'Roboto,sans-serif' }}>
        {normalizarTelefoneExibicao(contato.telefone)}
      </div>
      <p style={{ fontSize: 11.5, fontFamily: 'Roboto,sans-serif', lineHeight: 1.4, color: 'var(--text-2)', margin: 0,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {contato.ultimaDirecao === 'saida' ? 'Você: ' : ''}{contato.ultimoCorpo}
      </p>
    </div>
  );
}

function ConvKanbanColumn({ col, contatos, onAbrir, onDropCard }) {
  const [dragOver, setDragOver] = useState(false);
  const cards = contatos.filter(c => (c.etapa || 'lead_novo') === col.id);
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault(); setDragOver(false);
        const tel = e.dataTransfer.getData('telefone');
        const from = e.dataTransfer.getData('fromEtapa');
        if (tel && from !== col.id) onDropCard(tel, col.id);
      }}
      style={{ width: 250, minWidth: 250, display: 'flex', flexDirection: 'column',
        background: dragOver ? col.colorBg.replace('.08', '.18').replace('.06', '.16') : col.colorBg,
        border: `1px solid ${dragOver ? col.colorDot : col.colorBorder}`,
        borderRadius: 12, overflow: 'hidden', height: '100%', transition: 'border-color 120ms, background 120ms' }}>
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${col.colorBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: col.colorDot, display: 'block' }} />
          <span style={{ fontSize: 12, fontFamily: 'Roboto,sans-serif', fontWeight: 700, color: 'var(--text-1)' }}>{col.label}</span>
        </div>
        <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5,
          fontFamily: 'Roboto,sans-serif', fontWeight: 900, color: 'var(--text-2)' }}>
          {cards.length}
        </span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {cards.map(c => (
          <ConvKanbanCard key={c.telefone} contato={c} col={col} onAbrir={() => onAbrir(c.telefone)}
            onDropAntes={() => onDropCard(c.telefone, col.id)} />
        ))}
        {!cards.length && <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'Roboto,sans-serif', padding: '8px 2px' }}>Vazio.</div>}
      </div>
    </div>
  );
}

function KanbanView({ contatos, onAbrir, onMover, etapas }) {
  return (
    <div style={{ flex: 1, display: 'flex', gap: 12, padding: 14, overflowX: 'auto' }}>
      {(etapas || ETAPAS).map(col => (
        <ConvKanbanColumn key={col.id} col={col} contatos={contatos} onAbrir={onAbrir}
          onDropCard={(telefone, etapa) => onMover(telefone, etapa)} />
      ))}
    </div>
  );
}

/* ── Métricas ────────────────────────────────────────────────────*/
function periodoRapido(dias) {
  const to = new Date();
  const from = new Date();
  if (dias != null) from.setDate(from.getDate() - dias);
  const fmt = d => d.toISOString().slice(0, 10);
  return { from: dias == null ? '2020-01-01' : fmt(from), to: fmt(to) };
}

function MetricasView({ contatosDb, msgs }) {
  const [from, setFrom] = useState(periodoRapido(30).from);
  const [to, setTo]     = useState(periodoRapido(30).to);
  const [quizLeads, setQuizLeads] = useState([]);
  const [custoRealMeta, setCustoRealMeta] = useState(null);
  const [cambio, setCambio] = useState(null);

  // Cotação oficial (PTAX/BCB) pro fim do período selecionado, pra converter
  // os custos em dólar pra reais.
  useEffect(() => {
    const SUPA_URL = window.db?.supabaseUrl || '';
    const SUPA_KEY = window.db?.supabaseKey  || '';
    if (!SUPA_URL) return;
    fetch(`${SUPA_URL}/functions/v1/cambio-usd-brl?ate=${to}`, { headers: { Authorization: `Bearer ${SUPA_KEY}` } })
      .then(r => r.json())
      .then(d => { if (!d.error) setCambio(d); })
      .catch(() => {});
  }, [to]);

  useEffect(() => {
    if (!window.db) return;
    window.db.from('quiz_leads').select('whatsapp, situacoes').not('whatsapp', 'is', null)
      .then(({ data, error }) => { if (!error) setQuizLeads(data || []); });
  }, []);

  // Custo REAL cobrado pela Meta (não estimativa), direto da API de preços.
  useEffect(() => {
    const SUPA_URL = window.db?.supabaseUrl || '';
    const SUPA_KEY = window.db?.supabaseKey  || '';
    if (!SUPA_URL) return;
    setCustoRealMeta(null);
    fetch(`${SUPA_URL}/functions/v1/whatsapp-custo-meta?from=${from}&to=${to}`, { headers: { Authorization: `Bearer ${SUPA_KEY}` } })
      .then(r => r.json())
      .then(d => { if (!d.error) setCustoRealMeta(d); })
      .catch(() => {});
  }, [from, to]);

  function aplicarRapido(dias) {
    const p = periodoRapido(dias);
    setFrom(p.from); setTo(p.to);
  }

  const stats = useMemo(() => {
    const fromMs = new Date(from + 'T00:00:00').getTime();
    const toMs   = new Date(to + 'T23:59:59').getTime();
    const dentro = iso => { const t = new Date(iso).getTime(); return t >= fromMs && t <= toMs; };

    const msgsPorTelefone = {};
    for (const m of msgs) (msgsPorTelefone[m.telefone] ||= []).push(m);

    // Atendimentos: contatos com pelo menos 1 mensagem dentro do período.
    const atendidos = contatosDb.filter(c => (msgsPorTelefone[c.telefone] || []).some(m => dentro(m.created_at)));

    const emAndamento = contatosDb.filter(c => ['lead_novo', 'em_conversa'].includes(c.etapa)).length;
    const intervencaoHumana = contatosDb.filter(c => c.precisa_humano).length;

    // Fechados no período: virou "aluno" com updated_at dentro do intervalo (aproximação).
    const fechados = contatosDb.filter(c => c.etapa === 'aluno' && dentro(c.updated_at));

    // Quem mandou o link de checkout por último pra cada fechado, pra atribuir a venda.
    let fechadosIa = 0, fechadosHumano = 0;
    for (const c of fechados) {
      const doContato = (msgsPorTelefone[c.telefone] || []).filter(m => m.corpo && m.corpo.includes('pay.hotmart.com'));
      const ultimoLink = doContato.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      if (!ultimoLink) continue;
      if (ultimoLink.origem === 'ia') fechadosIa++;
      else fechadosHumano++;
    }

    // Distribuição por etapa (entre os atendidos no período).
    const porEtapa = ETAPAS.map(e => ({ val: e.label, n: atendidos.filter(c => (c.etapa || 'lead_novo') === e.id).length }))
      .filter(x => x.n > 0);

    // Taxa de resposta: dos atendidos, quantos têm pelo menos 1 mensagem de entrada (responderam de volta).
    const responderam = atendidos.filter(c => (msgsPorTelefone[c.telefone] || []).some(m => m.direcao === 'entrada')).length;
    const naoResponderam = atendidos.length - responderam;

    // Handoff: entre quem a IA atendeu (tem ao menos 1 mensagem origem=ia), quantos precisaram de humano.
    const atendidosPelaIa = atendidos.filter(c => (msgsPorTelefone[c.telefone] || []).some(m => m.origem === 'ia'));
    const comHandoff = atendidosPelaIa.filter(c => c.precisa_humano).length;
    const semHandoff = atendidosPelaIa.length - comHandoff;

    const conversao = atendidos.length > 0 ? Math.round((fechados.length / atendidos.length) * 100) : 0;

    // Custos: soma direto de custo_usd gravado em cada mensagem (calculado no
    // envio, com base nos tokens reais da Anthropic e no preço do template).
    const msgsNoPeriodo = msgs.filter(m => dentro(m.created_at) && m.custo_usd);
    const custoMetaUsd      = msgsNoPeriodo.filter(m => m.tipo === 'template').reduce((s, m) => s + Number(m.custo_usd), 0);
    const custoAnthropicUsd = msgsNoPeriodo.filter(m => m.origem === 'ia' || m.origem === 'ia_retomada').reduce((s, m) => s + Number(m.custo_usd), 0);
    const custoTotalUsd     = custoMetaUsd + custoAnthropicUsd;
    const custoPorLead      = atendidos.length > 0 ? custoTotalUsd / atendidos.length : 0;
    const custoPorVenda     = fechados.length > 0 ? custoTotalUsd / fechados.length : 0;

    // Perdidos no período (mesma lógica de "virou etapa X dentro do intervalo" usada em fechados).
    const perdidos = contatosDb.filter(c => c.etapa === 'perdido' && dentro(c.updated_at));
    const perdidosPct = atendidos.length > 0 ? Math.round((perdidos.length / atendidos.length) * 100) : 0;

    // Tempo médio até fechar: da primeira mensagem trocada até a etapa virar Aluno (updated_at).
    let somaHoras = 0, comTempo = 0;
    for (const c of fechados) {
      const doContato = msgsPorTelefone[c.telefone] || [];
      if (!doContato.length) continue;
      const primeira = doContato.reduce((min, m) => new Date(m.created_at) < new Date(min.created_at) ? m : min, doContato[0]);
      const horas = (new Date(c.updated_at) - new Date(primeira.created_at)) / 3600000;
      if (horas >= 0) { somaHoras += horas; comTempo++; }
    }
    const tempoMedioHoras = comTempo > 0 ? somaHoras / comTempo : null;
    const tempoMedioLabel = tempoMedioHoras == null ? '—'
      : tempoMedioHoras < 24 ? `${Math.round(tempoMedioHoras)}h`
      : `${Math.round(tempoMedioHoras / 24 * 10) / 10}d`;

    // Dor do quiz que mais aparece entre quem fechou (cruza telefone com quiz_leads.situacoes).
    const digits = s => String(s || '').replace(/\D/g, '').slice(-8);
    const situacoesPorTelefoneQuiz = {};
    for (const l of quizLeads) {
      const key = digits(l.whatsapp);
      if (key) situacoesPorTelefoneQuiz[key] = l.situacoes || [];
    }
    const dorContagem = {};
    for (const c of fechados) {
      const situacoes = situacoesPorTelefoneQuiz[digits(c.telefone)] || [];
      for (const s of situacoes) dorContagem[s] = (dorContagem[s] || 0) + 1;
    }
    const dorConversaoItems = Object.entries(dorContagem)
      .map(([val, n]) => ({ val, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 8);

    return {
      atendimentos: atendidos.length,
      emAndamento,
      fechados: fechados.length,
      intervencaoHumana,
      fechadosIa,
      fechadosHumano,
      conversao,
      porEtapa,
      respostaItems: [{ val: 'Respondeu', n: responderam }, { val: 'Não respondeu', n: naoResponderam }].filter(x => x.n > 0),
      handoffItems: [{ val: 'IA resolveu sozinha', n: semHandoff }, { val: 'Precisou de humano', n: comHandoff }].filter(x => x.n > 0),
      fechadosPorQuemItems: [{ val: 'Claudinho', n: fechadosIa }, { val: 'Humano', n: fechadosHumano }].filter(x => x.n > 0),
      atendidosPelaIaTotal: atendidosPelaIa.length,
      perdidos: perdidos.length,
      perdidosPct,
      tempoMedioLabel,
      dorConversaoItems,
      custoMetaUsd, custoAnthropicUsd, custoTotalUsd, custoPorLead, custoPorVenda,
    };
  }, [contatosDb, msgs, from, to, quizLeads]);

  const btnRapido = (label, dias) => (
    <button onClick={() => aplicarRapido(dias)} style={{
      border: '1px solid var(--app-border)', background: 'rgba(255,255,255,.04)', color: 'var(--text-2)',
      borderRadius: 7, padding: '6px 12px', fontSize: 12, fontFamily: 'Roboto,sans-serif', fontWeight: 700, cursor: 'pointer' }}>
      {label}
    </button>
  );

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {btnRapido('7 dias', 7)}
        {btnRapido('30 dias', 30)}
        {btnRapido('90 dias', 90)}
        {btnRapido('Tudo', null)}
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--app-border)', borderRadius: 7,
            padding: '6px 10px', fontSize: 12, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif' }} />
        <span style={{ color: 'var(--text-3)', fontSize: 12 }}>até</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--app-border)', borderRadius: 7,
            padding: '6px 10px', fontSize: 12, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
        <CardKPI label="Atendimentos" value={stats.atendimentos} icon="message-circle" />
        <CardKPI label="Em andamento" value={stats.emAndamento} icon="clock" />
        <CardKPI label="Fechados (viraram aluno)" value={stats.fechados} icon="check-circle" accent />
        <CardKPI label="Taxa de conversão" value={stats.conversao + '%'} icon="target" accent />
        <CardKPI label="Tempo médio até fechar" value={stats.tempoMedioLabel} icon="hourglass" />
        <CardKPI label="Perdidos" value={`${stats.perdidos} (${stats.perdidosPct}%)`} icon="x-circle" />
        <CardKPI label="Precisando de humano" value={stats.intervencaoHumana} icon="alert-triangle" />
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', margin: '18px 0 2px', fontFamily: 'Roboto,sans-serif', textTransform: 'uppercase', letterSpacing: .4 }}>
        Custos (estimados, ver/ajustar em custo_precos)
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontFamily: 'Roboto,sans-serif', marginBottom: 8 }}>
        {cambio ? `Dólar convertido pelo PTAX oficial (Banco Central): R$ ${cambio.usdBrl.toFixed(4)} em ${cambio.dataCotacao.slice(0, 10).split('-').reverse().join('/')}` : 'Buscando cotação oficial...'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
        <CardKPI label="Gasto Meta (templates)" value={fmtUsdBrl(stats.custoMetaUsd, cambio)} icon="message-square" />
        <CardKPI label="Gasto Anthropic (Claudinho)" value={fmtUsdBrl(stats.custoAnthropicUsd, cambio)} icon="cpu" />
        <CardKPI label="Custo total" value={fmtUsdBrl(stats.custoTotalUsd, cambio)} icon="dollar-sign" accent />
        <CardKPI label="Custo por lead" value={fmtUsdBrl(stats.custoPorLead, cambio, 4)} icon="user" />
        <CardKPI label="Custo por venda" value={stats.custoPorVenda > 0 ? fmtUsdBrl(stats.custoPorVenda, cambio) : '—'} icon="shopping-cart" accent />
        <CardKPI label="Gasto Meta (real, cobrado)" value={custoRealMeta ? fmtUsdBrl(custoRealMeta.custoTotalUsd, cambio) : '...'} icon="check-check" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 12 }}>
        <VizCard title="Distribuição por etapa" hint="dos atendidos no período" items={stats.porEtapa} total={stats.atendimentos} />
        <VizCard title="Taxa de resposta ao 1º contato" hint="quem respondeu a mensagem inicial" items={stats.respostaItems} total={stats.atendimentos} />
        <VizCard title="Fechados por quem" hint="Claudinho x humano, pelo link de checkout" items={stats.fechadosPorQuemItems} total={stats.fechados} />
        <VizCard title="Taxa de handoff da IA" hint={`de ${nf(stats.atendidosPelaIaTotal)} atendidos pelo Claudinho`} items={stats.handoffItems} total={stats.atendidosPelaIaTotal} />
        <VizCard title="Dor do quiz que mais converteu" hint="situações marcadas por quem virou aluno" items={stats.dorConversaoItems} total={stats.fechados} />
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'Roboto,sans-serif', marginTop: 14 }}>
        "Fechados" considera quem virou etapa Aluno dentro do período (pela data da última mudança). A atribuição Claudinho x humano é baseada em quem mandou o link de checkout por último pra esse contato, é uma aproximação, não é rastreamento direto da venda. "Dor do quiz que mais converteu" cruza o telefone do fechado com as respostas dele no quiz (quando encontrado).
      </div>
    </div>
  );
}

/* Mensagens prontas pro vendedor humano mandar em 1 clique, dentro da janela aberta. */
const LINK_CHECKOUT_MCV = 'https://pay.hotmart.com/W87258826R?checkoutMode=10&utm_source=whatsapp&utm_medium=manual&utm_campaign=atendimento';
const MENSAGENS_PRONTAS = [
  { id: 'checkout', label: 'Link de checkout (MCV)', icone: 'link',
    texto: `Segue o link pra garantir o seu: ${LINK_CHECKOUT_MCV}` },
];

function ConversasScreen() {
  const [msgs, setMsgs]           = useState([]);
  const [contatosDb, setContatosDb] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selecionado, setSelecionado] = useState(null);
  const [texto, setTexto]         = useState('');
  const [enviando, setEnviando]   = useState(false);
  const [busca, setBusca]         = useState('');
  const [modo, setModo]           = useState('lista'); // lista | kanban
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const [janelaAbertaPrimeiro, setJanelaAbertaPrimeiro] = useState(false);
  const [modalNovoContato, setModalNovoContato] = useState(false);
  const [modalPrompt, setModalPrompt] = useState(false);
  const [prontasAberto, setProntasAberto] = useState(false);
  const [enviandoPronta, setEnviandoPronta] = useState(null);
  const [tick, setTick]           = useState(0); // força re-render pro contador de tempo
  const [iaAtivaGlobal, setIaAtivaGlobal] = useState(false);
  const scrollRef = useRef(null);
  const SUPA_URL = window.db?.supabaseUrl || '';
  const SUPA_KEY = window.db?.supabaseKey  || '';

  function carregar() {
    if (!window.db) return;
    // Contatos marcados como spam nunca aparecem na Lista, Kanban ou Métricas.
    // Precisa filtrar também as mensagens desses telefones, senão a conversa
    // reaparece de volta pela lista de mensagens mesmo com o contato oculto.
    window.db.from('whatsapp_contatos').select('*').order('updated_at', { ascending: false }).limit(5000)
      .then(({ data, error }) => {
        if (error) return;
        const todos = data || [];
        const spamSet = new Set(todos.filter(c => c.is_spam).map(c => c.telefone));
        setContatosDb(todos.filter(c => !c.is_spam));
        window.db.from('whatsapp_mensagens').select('*').order('created_at', { ascending: false }).limit(5000)
          .then(({ data: msgsData, error: msgsError }) => {
            if (!msgsError) setMsgs((msgsData || []).filter(m => !spamSet.has(m.telefone)));
            setLoading(false);
          });
      });
    window.db.from('app_config').select('valor').eq('chave', 'whatsapp_ia_ativa').single()
      .then(({ data }) => { if (data) setIaAtivaGlobal(data.valor === true); });
  }

  function marcarSpam(telefone) {
    if (!window.confirm('Marcar esse contato como spam? Ele some da Lista, Kanban e Métricas.')) return;
    setContatosDb(prev => prev.filter(c => c.telefone !== telefone));
    setMsgs(prev => prev.filter(m => m.telefone !== telefone));
    if (selecionado === telefone) setSelecionado(null);
    if (window.db) window.db.from('whatsapp_contatos').upsert({ telefone, is_spam: true }, { onConflict: 'telefone' }).then(() => carregar());
  }

  useEffect(() => { carregar(); const t = setInterval(carregar, 15000); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 30000); return () => clearInterval(t); }, []);

  function moverEtapa(telefone, etapa) {
    setContatosDb(prev => prev.map(c => c.telefone === telefone ? { ...c, etapa } : c));
    if (window.db) window.db.from('whatsapp_contatos').update({ etapa }).eq('telefone', telefone).then(() => carregar());
  }

  function alternarIaGlobal() {
    const novoValor = !iaAtivaGlobal;
    if (novoValor && !window.confirm('Isso liga a IA vendedora pra TODOS os contatos que não estiverem pausados individualmente. Ela vai responder sozinha no WhatsApp, gastando tokens da API da Anthropic a cada mensagem. Confirma?')) return;
    setIaAtivaGlobal(novoValor);
    if (window.db) window.db.from('app_config').update({ valor: novoValor }).eq('chave', 'whatsapp_ia_ativa').then(() => carregar());
  }

  // Reativar o Claudinho numa conversa sempre limpa os dois sinais de "parado"
  // ao mesmo tempo (pausa manual e pedido de humano da IA). O ponto de atenção
  // só some quando o usuário reativa por aqui, nunca só por mandar uma
  // resposta manual com o Claudinho ainda pausado.
  function alternarIaContato(telefone, pausar) {
    const patch = pausar ? { ia_pausada: true } : { ia_pausada: false, precisa_humano: false };
    setContatosDb(prev => prev.map(c => c.telefone === telefone ? { ...c, ...patch } : c));
    if (window.db) window.db.from('whatsapp_contatos').upsert({ telefone, ...patch }, { onConflict: 'telefone' }).then(() => carregar());
  }

  const contatos = useMemo(() => {
    const porTelefone = {};
    for (const m of msgs) {
      if (!porTelefone[m.telefone]) porTelefone[m.telefone] = [];
      porTelefone[m.telefone].push(m);
    }
    const contatosPorTelefone = Object.fromEntries(contatosDb.map(c => [c.telefone, c]));
    // Todo telefone com mensagem OU registrado em whatsapp_contatos aparece.
    const todosTelefones = new Set([...Object.keys(porTelefone), ...contatosDb.map(c => c.telefone)]);
    return [...todosTelefones].map(telefone => {
      const lista = porTelefone[telefone] || [];
      const ultima = lista[0] || null;
      const ultimaEntrada = lista.find(m => m.direcao === 'entrada');
      const ultimaSaidaOk = lista.find(m => m.direcao === 'saida' && m.status !== 'falhou');
      const nomeMsg = lista.find(m => m.nome)?.nome || null;
      const dbRow   = contatosPorTelefone[telefone];
      return {
        telefone, nome: dbRow?.nome || nomeMsg,
        ultimoCorpo: ultima?.corpo || '(sem mensagens ainda)',
        ultimaData: ultima?.created_at || dbRow?.updated_at,
        ultimaDirecao: ultima?.direcao || null,
        naoLidas: lista.filter(m => m.direcao === 'entrada' && !m.lida_pelo_time).length,
        ultimaEntradaData: ultimaEntrada?.created_at || null,
        janelaAberta: janelaAberta(ultimaEntrada?.created_at),
        // Mesma referência usada pela rotina de arquivamento automático (whatsapp-arquivar-perdidos):
        // se já respondeu alguma vez, conta da última resposta dele; senão, da última mensagem
        // nossa que realmente foi entregue (nunca uma que falhou).
        referenciaArquivamento: ultimaEntrada?.created_at || ultimaSaidaOk?.created_at || null,
        etapa: dbRow?.etapa || 'lead_novo',
        iaPausada: dbRow?.ia_pausada || false,
        precisaHumano: dbRow?.precisa_humano || false,
      };
    }).sort((a, b) => new Date(b.ultimaData) - new Date(a.ultimaData))
      .filter(c => !busca || (c.nome || c.telefone).toLowerCase().includes(busca.toLowerCase()));
  }, [msgs, contatosDb, busca, tick]);

  // Por padrão só mostra quem está em atendimento (Lead novo / Em conversa).
  // "Perdido" (janela fechada, nunca respondeu) fica arquivado, some da
  // visualização até o usuário pedir pra ver.
  const contatosVisiveis = useMemo(() => {
    const base = mostrarArquivados ? contatos : contatos.filter(c => c.etapa !== 'perdido');
    if (!janelaAbertaPrimeiro) return base;
    // Mantém a ordenação por data mais recente dentro de cada grupo (aberta / fechada).
    return [...base].sort((a, b) => (b.janelaAberta ? 1 : 0) - (a.janelaAberta ? 1 : 0));
  }, [contatos, mostrarArquivados, janelaAbertaPrimeiro]);
  const etapasVisiveis = mostrarArquivados ? ETAPAS : ETAPAS.filter(e => e.id !== 'perdido');

  const thread = useMemo(() => {
    if (!selecionado) return [];
    return msgs.filter(m => m.telefone === selecionado).slice().reverse();
  }, [msgs, selecionado]);

  const contatoAtivo = contatos.find(c => c.telefone === selecionado);
  const custoConversaAtiva = thread.reduce((s, m) => s + (Number(m.custo_usd) || 0), 0);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread.length, selecionado]);

  useEffect(() => {
    if (!selecionado || !window.db) return;
    const idsNaoLidas = msgs.filter(m => m.telefone === selecionado && m.direcao === 'entrada' && !m.lida_pelo_time).map(m => m.id);
    if (!idsNaoLidas.length) return;
    window.db.from('whatsapp_mensagens').update({ lida_pelo_time: true }).in('id', idsNaoLidas).then(() => carregar());
  }, [selecionado, msgs]);

  async function enviar() {
    if (!texto.trim() || !selecionado || enviando) return;
    setEnviando(true);
    try {
      const r = await fetch(`${SUPA_URL}/functions/v1/whatsapp-enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPA_KEY}` },
        body: JSON.stringify({ action: 'texto', to: selecionado, nome: contatoAtivo?.nome, texto, origem: 'manual' }),
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || 'falha no envio');
      setTexto('');
      carregar();
    } catch (e) {
      alert('Erro ao enviar: ' + e.message + (contatoAtivo && !contatoAtivo.janelaAberta ? '\n\nA janela de 24h desse contato está fechada, precisa de um template aprovado pra reabrir.' : ''));
    } finally {
      setEnviando(false);
    }
  }

  async function enviarPronta(item) {
    if (!selecionado || enviandoPronta) return;
    setEnviandoPronta(item.id);
    try {
      const r = await fetch(`${SUPA_URL}/functions/v1/whatsapp-enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPA_KEY}` },
        body: JSON.stringify({ action: 'texto', to: selecionado, nome: contatoAtivo?.nome, texto: item.texto, origem: 'manual' }),
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || 'falha no envio');
      carregar();
    } catch (e) {
      alert('Erro ao enviar: ' + e.message + (contatoAtivo && !contatoAtivo.janelaAberta ? '\n\nA janela de 24h desse contato está fechada, precisa de um template aprovado pra reabrir.' : ''));
    } finally {
      setEnviandoPronta(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar title="Conversas" actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,.04)', border: '1px solid var(--app-border)', borderRadius: 8, padding: 3 }}>
            <button onClick={() => setModo('lista')} style={{
              border: 'none', cursor: 'pointer', padding: '5px 12px', borderRadius: 6, fontSize: 12, fontFamily: 'Roboto,sans-serif', fontWeight: 700,
              background: modo === 'lista' ? 'var(--fmn-gold)' : 'transparent', color: modo === 'lista' ? '#1a1a1a' : 'var(--text-2)' }}>Chat</button>
            <button onClick={() => setModo('kanban')} style={{
              border: 'none', cursor: 'pointer', padding: '5px 12px', borderRadius: 6, fontSize: 12, fontFamily: 'Roboto,sans-serif', fontWeight: 700,
              background: modo === 'kanban' ? 'var(--fmn-gold)' : 'transparent', color: modo === 'kanban' ? '#1a1a1a' : 'var(--text-2)' }}>Kanban</button>
            <button onClick={() => setModo('metricas')} style={{
              border: 'none', cursor: 'pointer', padding: '5px 12px', borderRadius: 6, fontSize: 12, fontFamily: 'Roboto,sans-serif', fontWeight: 700,
              background: modo === 'metricas' ? 'var(--fmn-gold)' : 'transparent', color: modo === 'metricas' ? '#1a1a1a' : 'var(--text-2)' }}>Métricas</button>
          </div>
          <Btn onClick={() => setModalNovoContato(true)}>+ Novo Contato</Btn>
          <Btn variant="ghost" onClick={() => setModalPrompt(true)} title="Ver o prompt atual do Claudinho">
            <LucideIcon icon="file-text" size={14} />
          </Btn>
          <Btn variant={iaAtivaGlobal ? 'primary' : 'ghost'} onClick={alternarIaGlobal}>
            {iaAtivaGlobal ? 'Claudinho: Ativo' : 'Claudinho: Pausado'}
          </Btn>
        </div>
      } />
      {modalPrompt && <PromptClaudinhoModal SUPA_URL={SUPA_URL} SUPA_KEY={SUPA_KEY} onClose={() => setModalPrompt(false)} />}
      {modalNovoContato && (
        <NovoContatoModal SUPA_URL={SUPA_URL} SUPA_KEY={SUPA_KEY}
          onClose={() => setModalNovoContato(false)}
          onEnviado={(telefone) => { setModalNovoContato(false); carregar(); setSelecionado(telefone.replace(/\D/g, '').startsWith('55') ? telefone.replace(/\D/g, '') : '55' + telefone.replace(/\D/g, '')); }} />
      )}
      {modo === 'kanban' && (
        <KanbanView contatos={contatosVisiveis} etapas={etapasVisiveis} onMover={moverEtapa}
          onAbrir={(telefone) => { setSelecionado(telefone); setModo('lista'); }} />
      )}
      {modo === 'metricas' && (
        <MetricasView contatosDb={contatosDb} msgs={msgs} />
      )}
      {modo === 'lista' && (
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ width: 300, flexShrink: 0, borderRight: '1px solid var(--app-border)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: 10, borderBottom: '1px solid var(--app-border)', flexShrink: 0, display: 'flex', gap: 6 }}>
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar contato..."
              style={{ flex: 1, boxSizing: 'border-box', background: 'rgba(255,255,255,.04)', border: '1px solid var(--app-border)',
                borderRadius: 8, padding: '7px 10px', fontSize: 12.5, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif', outline: 'none' }} />
            <Btn size="sm" variant={janelaAbertaPrimeiro ? 'secondary' : 'ghost'} title="Mostrar janela aberta primeiro"
              onClick={() => setJanelaAbertaPrimeiro(v => !v)}>
              <LucideIcon icon="clock" size={13} />
            </Btn>
            <Btn size="sm" variant={mostrarArquivados ? 'secondary' : 'ghost'} title="Contatos perdidos (janela fechada, nunca respondeu)"
              onClick={() => setMostrarArquivados(v => !v)}>
              <LucideIcon icon="archive" size={13} />
            </Btn>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {loading && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>Carregando...</div>}
            {!loading && !contatosVisiveis.length && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>Nenhuma conversa ainda.</div>}
            {contatosVisiveis.map(c => (
              <ContatoItem key={c.telefone} contato={c} ativo={c.telefone === selecionado} onClick={() => setSelecionado(c.telefone)} />
            ))}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {!selecionado && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 13, fontFamily: 'Roboto,sans-serif' }}>
              Selecione uma conversa
            </div>
          )}
          {selecionado && (
            <>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--app-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif' }}>
                    {contatoAtivo?.nome || normalizarTelefoneExibicao(selecionado)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'Roboto,sans-serif' }}>
                    {normalizarTelefoneExibicao(selecionado)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {custoConversaAtiva > 0 && (
                    <span title="Custo estimado dessa conversa (WhatsApp + Anthropic)" style={{ fontSize: 10.5, fontFamily: 'Roboto,sans-serif',
                      fontWeight: 800, color: 'var(--text-2)', background: 'rgba(255,255,255,.05)', border: '1px solid var(--app-border)',
                      borderRadius: 999, padding: '3px 9px' }}>US$ {custoConversaAtiva.toFixed(4)}</span>
                  )}
                  <Btn size="sm" variant="ghost" title="Marcar como spam (some da Lista, Kanban e Métricas)"
                    onClick={() => marcarSpam(selecionado)}>
                    <LucideIcon icon="shield-off" size={13} />
                  </Btn>
                  {contatoAtivo?.precisaHumano && (
                    <span title="A IA pediu ajuda de um humano nessa conversa" style={{ fontSize: 10.5, fontFamily: 'Roboto,sans-serif',
                      fontWeight: 800, color: '#f87171', background: 'rgba(248,113,113,.14)', border: '1px solid rgba(248,113,113,.3)',
                      borderRadius: 999, padding: '3px 9px' }}>● precisa de humano</span>
                  )}
                  {iaAtivaGlobal && (
                    <Btn size="sm" variant={(contatoAtivo?.iaPausada || contatoAtivo?.precisaHumano) ? 'ghost' : 'secondary'}
                      onClick={() => alternarIaContato(selecionado, !(contatoAtivo?.iaPausada || contatoAtivo?.precisaHumano))}>
                      {(contatoAtivo?.iaPausada || contatoAtivo?.precisaHumano) ? 'Claudinho pausado aqui' : 'Claudinho ativo aqui'}
                    </Btn>
                  )}
                  <div style={{
                    fontSize: 10.5, fontFamily: 'Roboto,sans-serif', padding: '3px 9px', borderRadius: 999,
                    color: contatoAtivo?.janelaAberta ? '#4ade80' : 'var(--text-3)',
                    background: contatoAtivo?.janelaAberta ? 'rgba(74,222,128,.12)' : 'rgba(255,255,255,.05)',
                    border: '1px solid ' + (contatoAtivo?.janelaAberta ? 'rgba(74,222,128,.3)' : 'var(--app-border)'),
                  }}>
                    {contatoAtivo?.janelaAberta
                      ? `Grátis · ${tempoRestanteJanela(contatoAtivo.ultimaEntradaData)}`
                      : (tempoAteArquivar(contatoAtivo?.referenciaArquivamento)
                          ? `Será arquivado em ${tempoAteArquivar(contatoAtivo.referenciaArquivamento)}`
                          : 'Janela fechada · precisa de template')}
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
                <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
                  {thread.map(m => <Bolha key={m.id} msg={m} />)}
                </div>

                {prontasAberto && (
                  <div style={{ width: 260, flexShrink: 0, borderLeft: '1px solid var(--app-border)',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--app-border)', flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif' }}>Mensagens prontas</div>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'Roboto,sans-serif', marginTop: 2 }}>1 clique pra mandar</div>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {MENSAGENS_PRONTAS.map(item => (
                        <button key={item.id} onClick={() => enviarPronta(item)}
                          disabled={!contatoAtivo?.janelaAberta || enviandoPronta === item.id}
                          style={{ textAlign: 'left', cursor: contatoAtivo?.janelaAberta ? 'pointer' : 'not-allowed',
                            background: 'rgba(255,255,255,.04)', border: '1px solid var(--app-border)', borderRadius: 9,
                            padding: '9px 10px', display: 'flex', flexDirection: 'column', gap: 4,
                            opacity: contatoAtivo?.janelaAberta ? 1 : .5 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <LucideIcon icon={item.icone} size={12} style={{ color: 'var(--fmn-gold)' }} />
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif' }}>
                              {enviandoPronta === item.id ? 'Enviando...' : item.label}
                            </span>
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'Roboto,sans-serif', lineHeight: 1.3,
                            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {item.texto}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ padding: 12, borderTop: '1px solid var(--app-border)', display: 'flex', gap: 8 }}>
                <textarea value={texto} onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                  placeholder={contatoAtivo?.janelaAberta ? 'Digite sua mensagem... (Shift+Enter pra quebrar linha)' : 'Janela fechada, precisa de template pra reabrir'}
                  disabled={!contatoAtivo?.janelaAberta}
                  rows={1}
                  style={{ flex: 1, boxSizing: 'border-box', background: 'rgba(255,255,255,.04)', border: '1px solid var(--app-border)',
                    borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif', outline: 'none',
                    resize: 'none', maxHeight: 120, lineHeight: 1.4 }}
                  onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }} />
                <Btn variant={prontasAberto ? 'secondary' : 'ghost'} title="Mensagens prontas"
                  onClick={() => setProntasAberto(p => !p)}>
                  <LucideIcon icon="zap" size={14} />
                </Btn>
                <Btn onClick={enviar} disabled={!contatoAtivo?.janelaAberta || enviando || !texto.trim()}>
                  {enviando ? 'Enviando...' : 'Enviar'}
                </Btn>
              </div>
            </>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

window.ConversasScreen = ConversasScreen;
