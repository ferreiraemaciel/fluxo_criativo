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

// Mesma lista usada no backend (whatsapp-ia.ts, PADROES_MSG_AUTOMATICA) pra
// detectar resposta automática de bot. Duplicada aqui só pra classificação
// visual (cor do badge), não decide se o Claudinho responde ou não.
const PADROES_MSG_AUTOMATICA_UI = [
  /no momento (estou|devo estar)/i, /mensagem automática/i, /resposta automática/i,
  /assim que (eu )?(possível|puder|conseguir)/i, /já (te )?respondo/i,
  /estou (ausente|fora|indispon[íi]vel)/i, /n[ãa]o est(ou|amos) dispon[íi]ve(l|is)/i,
  /hor[áa]rio de atendimento/i, /obrigad[oa] pelo contato,? em breve/i, /retorno em breve/i,
  /retornaremos assim que/i, /agradece(mos)? (o |seu )?contato/i, /me conta como (você|voce) se chama/i,
  /como posso (estar )?(lhe |te )?ajud/i, /deixe sua mensagem/i, /demanda de trabalho o tempo de resposta/i,
  /entre em contato (com|pelo|através)/i, /para (melhor )?atend[êe]-?l[oa]/i, /estamos ansiosos para/i,
  /fico muito feliz em ter (você|voce) (aqui|por aqui)/i, /capturar momentos especiais/i,
  /agradece(mos)? (a )?sua mensagem/i, /iremos te responder/i,
];
function ehMensagemAutomatica(texto) {
  return PADROES_MSG_AUTOMATICA_UI.some(re => re.test(texto || ''));
}

/* Classifica o status de resposta de um contato pra badge colorido e pra
   ordenação "Precisa responder primeiro":
   'precisa'    verde   — última msg é do lead, real (não bot), aguardando nós.
   'respondida' dourado — última msg é nossa, aguardando o lead.
   'automatica' cinza   — última msg do lead bateu com padrão de bot.
   'fechada'    vermelho — janela fechada. */
function statusResposta(contato) {
  if (!contato.janelaAberta) return 'fechada';
  if (contato.ultimaDirecao === 'entrada') {
    return ehMensagemAutomatica(contato.ultimoCorpo) ? 'automatica' : 'precisa';
  }
  return 'respondida';
}
const STATUS_RESPOSTA_COR = {
  precisa: '#4ade80', respondida: 'var(--fmn-gold)', automatica: 'var(--text-3)', fechada: '#f87171',
};
const STATUS_RESPOSTA_LABEL = {
  precisa: 'Precisa responder', respondida: 'Já respondida, aguardando lead',
  automatica: 'Última mensagem foi automática (bot)', fechada: 'Janela fechada',
};

/* Chave canônica de telefone pra casar whatsapp_contatos (formato 55+DDD+9+8díg)
   com vendas.comprador_telefone (formato inconsistente: às vezes sem 55, às
   vezes sem o 9). Sempre reduz pro miolo DDD+8dígitos, sem 55 nem 9 extra. */
function chaveTelefone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.length === 11) d = d.slice(0, 2) + d.slice(3);
  return d;
}

/* Semáforo de produto comprado: uma bolinha por produto principal, aparecem
   juntas quando a pessoa comprou mais de um. Só os 3 produtos principais,
   packs/presets/outros não geram bolinha. */
const PRODUTOS_BOLINHA = [
  { chave: 'modelos de contrato', label: 'MCV',       cor: '#a78bfa' },
  { chave: 'blindagem',           label: 'Blindagem', cor: '#fb923c' },
  { chave: 'mensagens que vendem', label: 'MQV',       cor: '#4ade80' },
];
function classificarProdutoBolinha(nomeProduto) {
  const n = (nomeProduto || '').toLowerCase();
  return PRODUTOS_BOLINHA.find(p => n.includes(p.chave)) || null;
}

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

function ContatoItem({ contato, ativo, onClick, onDispensarAtencao }) {
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
        <div title={STATUS_RESPOSTA_LABEL[contato.statusResposta]} style={{
          position: 'absolute', bottom: -1, right: -1, width: 11, height: 11, borderRadius: '50%',
          background: STATUS_RESPOSTA_COR[contato.statusResposta],
          border: '2px solid var(--app-surface, #0f1013)',
        }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
            {contato.precisaHumano && (
              <span onClick={e => { e.stopPropagation(); onDispensarAtencao && onDispensarAtencao(contato.telefone); }}
                title="Precisa de humano. Clique pra marcar como já atendido." style={{ flexShrink: 0, fontSize: 9, fontWeight: 800, color: '#f87171',
                background: 'rgba(248,113,113,.14)', border: '1px solid rgba(248,113,113,.3)', borderRadius: 4, padding: '1px 4px', cursor: 'pointer' }}>!</span>
            )}
            <div style={{ fontSize: 13, fontWeight: contato.naoLidas > 0 ? 800 : 600, color: 'var(--text-1)',
              fontFamily: 'Roboto,sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {contato.nome || normalizarTelefoneExibicao(contato.telefone)}
            </div>
            {contato.produtosComprados.length > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                {contato.produtosComprados.map(p => (
                  <span key={p.label} title={`Comprou ${p.label}`}
                    style={{ width: 8, height: 8, borderRadius: '50%', background: p.cor }} />
                ))}
              </span>
            )}
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
        {msg.tipo === 'audio' && msg.midia_url ? (
          <audio controls src={msg.midia_url} style={{ maxWidth: 220, height: 32 }} />
        ) : msg.tipo === 'audio' ? (
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'Roboto,sans-serif', fontStyle: 'italic' }}>
            🎤 Áudio (carregando...)
          </div>
        ) : msg.tipo === 'imagem' && msg.midia_url ? (
          <a href={msg.midia_url} target="_blank" rel="noreferrer">
            <img src={msg.midia_url} style={{ maxWidth: 220, maxHeight: 260, borderRadius: 8, display: 'block' }} />
          </a>
        ) : msg.tipo === 'video' && msg.midia_url ? (
          <video controls src={msg.midia_url} style={{ maxWidth: 240, maxHeight: 260, borderRadius: 8, display: 'block' }} />
        ) : msg.tipo === 'documento' && msg.midia_url ? (
          <a href={msg.midia_url} target="_blank" rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--fmn-gold)', fontFamily: 'Roboto,sans-serif' }}>
            <LucideIcon icon="file-text" size={14} /> Ver arquivo
          </a>
        ) : (msg.tipo === 'imagem' || msg.tipo === 'video' || msg.tipo === 'documento') ? (
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'Roboto,sans-serif', fontStyle: 'italic' }}>
            {msg.tipo === 'imagem' ? '📷' : msg.tipo === 'video' ? '🎬' : '📎'} Mídia (carregando...)
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
            {msg.corpo}
          </div>
        )}
        {msg.corpo && (msg.tipo === 'imagem' || msg.tipo === 'video' || msg.tipo === 'documento') && (
          <div style={{ fontSize: 12.5, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif', lineHeight: 1.4, whiteSpace: 'pre-wrap', marginTop: 5 }}>
            {msg.corpo}
          </div>
        )}
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
// Data mínima pro período das Métricas: início da operação do Claudinho.
// Vendas anteriores a essa data (ex: Marco Tulio, 05/07/2026) não entram em
// "Fechados" pra não contaminar a métrica de conversão pós-IA.
const METRICAS_DATA_MINIMA = '2026-07-10';

function periodoRapido(dias) {
  const to = new Date();
  const from = new Date();
  if (dias != null) from.setDate(from.getDate() - dias);
  const fmt = d => d.toISOString().slice(0, 10);
  const fromStr = dias == null ? METRICAS_DATA_MINIMA : fmt(from);
  return { from: fromStr < METRICAS_DATA_MINIMA ? METRICAS_DATA_MINIMA : fromStr, to: fmt(to) };
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

    // Fechados no período: virou "aluno" com tornou_aluno_em (data real da venda no
    // Hotmart) dentro do intervalo. Fallback pra updated_at só em contatos antigos sem
    // backfill, pra não sumir com histórico. Exige também pelo menos 1 mensagem de
    // entrada ANTES da venda: prova de que passou pelo nosso funil (quiz/conversa)
    // antes de comprar, não só comprou fora e recebeu o boas-vindas depois.
    const fechados = contatosDb.filter(c => {
      if (c.etapa !== 'aluno') return false;
      const dataVenda = c.tornou_aluno_em || c.updated_at;
      if (!dentro(dataVenda)) return false;
      const vendaMs = new Date(dataVenda).getTime();
      return (msgsPorTelefone[c.telefone] || []).some(m => m.direcao === 'entrada' && new Date(m.created_at).getTime() < vendaMs);
    });

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

    // Tempo médio até fechar: da primeira mensagem trocada até a etapa virar Aluno (tornou_aluno_em).
    let somaHoras = 0, comTempo = 0;
    for (const c of fechados) {
      const doContato = msgsPorTelefone[c.telefone] || [];
      if (!doContato.length) continue;
      const primeira = doContato.reduce((min, m) => new Date(m.created_at) < new Date(min.created_at) ? m : min, doContato[0]);
      const horas = (new Date(c.tornou_aluno_em || c.updated_at) - new Date(primeira.created_at)) / 3600000;
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
        <input type="date" value={from} min={METRICAS_DATA_MINIMA}
          onChange={e => setFrom(e.target.value < METRICAS_DATA_MINIMA ? METRICAS_DATA_MINIMA : e.target.value)}
          style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--app-border)', borderRadius: 7,
            padding: '6px 10px', fontSize: 12, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif' }} />
        <span style={{ color: 'var(--text-3)', fontSize: 12 }}>até</span>
        <input type="date" value={to} min={METRICAS_DATA_MINIMA} onChange={e => setTo(e.target.value)}
          style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--app-border)', borderRadius: 7,
            padding: '6px 10px', fontSize: 12, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif' }} />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <CardKPI label="Atendimentos" value={stats.atendimentos} icon="message-circle" />
        <CardKPI label="Em andamento" value={stats.emAndamento} icon="clock" />
        <CardKPI label="Fechados (viraram aluno)" value={stats.fechados} icon="check-circle" accent />
        <CardKPI label="Taxa de conversão" value={stats.conversao + '%'} icon="target" accent />
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
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
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <CardKPI label="Gasto Meta (templates)" value={fmtUsdBrl(stats.custoMetaUsd, cambio)} icon="message-square" />
        <CardKPI label="Gasto Anthropic (Claudinho)" value={fmtUsdBrl(stats.custoAnthropicUsd, cambio)} icon="cpu" />
        <CardKPI label="Custo total" value={fmtUsdBrl(stats.custoTotalUsd, cambio)} icon="dollar-sign" accent />
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <CardKPI label="Custo por lead" value={fmtUsdBrl(stats.custoPorLead, cambio, 4)} icon="user" />
        <CardKPI label="Custo por venda" value={stats.custoPorVenda > 0 ? fmtUsdBrl(stats.custoPorVenda, cambio) : '—'} icon="shopping-cart" accent />
        <CardKPI label="Gasto Meta (real, cobrado)" value={custoRealMeta ? fmtUsdBrl(custoRealMeta.custoTotalUsd, cambio) : '...'} icon="check-check" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
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
// sck (não utm_source genérico) é o único parâmetro que a Hotmart de fato lê
// e devolve no webhook (parseSck em hotmart-webhook), por isso o link usa sck.
const LINK_CHECKOUT_MCV = 'https://pay.hotmart.com/W87258826R?checkoutMode=10&sck=whatsapp-manual';
const MENSAGENS_PRONTAS = [
  { id: 'checkout', label: 'Link de checkout (MCV)', icone: 'link',
    texto: `Segue o link pra garantir o seu: ${LINK_CHECKOUT_MCV}` },
  { id: 'explicacao', label: 'O que é o MCV', icone: 'info',
    texto: 'É um arsenal com +200 modelos de contrato editáveis no Canva, pra fotógrafo e videomaker autônomo ou MEI. Contratos em formato visual, não Word genérico, feitos por um advogado especializado em fotografia que também é fotógrafo há 15 anos. 12x de R$ 30,72 (ou R$ 297,00 à vista), acesso vitalício com atualização e suporte.' },
  { id: 'eca_digital', label: 'ECA Digital / Lei Felca', icone: 'shield-check',
    texto: 'Sim, pode ficar tranquilo. Os modelos já estão atualizados com o ECA Digital (a lei também conhecida como "Lei Felca"), cobrindo exatamente o que a lei e os decretos atuais exigem sobre proteção de imagem.' },
  { id: 'objecao_preco', label: 'Objeção de preço', icone: 'scale',
    texto: 'Um processo simples no Juizado Especial leva em média 14 meses pra resolver. Os 12x de R$ 30,72 cobrem a vida profissional inteira, não é o preço de "um contrato só". Um trabalho perdido por falta de contrato já vale bem mais que isso.' },
  { id: 'retomar', label: 'Retomar contato', icone: 'message-circle',
    texto: 'Oi! Passando aqui só pra saber se ficou alguma dúvida ou se posso te ajudar com mais alguma coisa.' },
  { id: 'mais_tempo', label: 'Pediu mais tempo', icone: 'clock',
    texto: 'Sem problema, fica à vontade. Só um detalhe: o quanto antes você se proteger, menos chance de passar por algum perrengue sem contrato. Qualquer dúvida, é só chamar.' },
  { id: 'pos_compra', label: 'Agradecimento pós-compra', icone: 'heart',
    texto: 'Que alegria te ter com a gente! Agora é só acessar os modelos e começar a proteger cada trabalho novo. Qualquer dúvida no acesso ou nos contratos, é só chamar por aqui.' },
];

function ConversasScreen() {
  const [msgs, setMsgs]           = useState([]);
  const [contatosDb, setContatosDb] = useState([]);
  const [produtosPorTelefone, setProdutosPorTelefone] = useState({}); // chaveTelefone -> [{label,cor}]
  const [loading, setLoading]     = useState(true);
  const [selecionado, setSelecionadoRaw] = useState(null);
  const [texto, setTexto]         = useState('');
  const rascunhosRef = useRef({}); // telefone -> texto ainda não enviado, um rascunho por conversa (igual WhatsApp)

  // Troca de contato sempre passa por aqui: guarda o que estava sendo
  // digitado na conversa anterior e recupera o rascunho da nova, em vez de
  // levar o texto de uma conversa pra outra.
  function setSelecionado(telefone) {
    setTexto(prevTexto => {
      if (selecionado) rascunhosRef.current[selecionado] = prevTexto;
      return telefone ? (rascunhosRef.current[telefone] || '') : '';
    });
    setSelecionadoRaw(telefone);
  }
  const [enviando, setEnviando]   = useState(false);
  const [busca, setBusca]         = useState('');
  const [modo, setModo]           = useState('lista'); // lista | kanban
  // 'precisa' (padrão, quem precisa de resposta primeiro) | 'janela' | 'recentes'
  const [ordemLista, setOrdemLista] = useState('precisa');
  const [modalNovoContato, setModalNovoContato] = useState(false);
  const [modalPrompt, setModalPrompt] = useState(false);
  const [prontasAberto, setProntasAberto] = useState(false);
  const [enviandoPronta, setEnviandoPronta] = useState(null);
  const [tick, setTick]           = useState(0); // força re-render pro contador de tempo
  const [iaAtivaGlobal, setIaAtivaGlobal] = useState(false);
  const [modoTreinamento, setModoTreinamento] = useState(false);
  const [enviandoMidia, setEnviandoMidia] = useState(false);
  const [dragOverThread, setDragOverThread] = useState(false);
  const [menuAnexoAberto, setMenuAnexoAberto] = useState(false);
  // Mídia escolhida (arquivo ou link) que ainda não foi enviada: fica em
  // espera até o clique em Enviar, pra dar chance de ver antes e cancelar.
  const [pendente, setPendente] = useState(null); // { tipo: 'arquivo'|'link', file?, url?, preview, nome }
  const fileInputRef = useRef(null);
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
    window.db.from('app_config').select('valor').eq('chave', 'whatsapp_modo_treinamento').single()
      .then(({ data }) => setModoTreinamento(data?.valor === true));
    // Semáforo de produto comprado (só vendas aprovadas): uma bolinha por
    // produto principal, pra diferenciar de quem só está em contato/suporte.
    // O Supabase corta em 1000 linhas por página mesmo pedindo limit maior,
    // então pagina de verdade com .range() até esgotar (hoje são 1130+ vendas
    // aprovadas, sem paginação metade delas nunca chegava aqui).
    (async () => {
      const todasVendas = [];
      let pagina = 0;
      while (true) {
        const de = pagina * 1000, ate = de + 999;
        const { data, error } = await window.db.from('vendas').select('comprador_telefone, comprador_email, produto_nome')
          .eq('status', 'aprovada').range(de, ate);
        if (error || !data) break;
        todasVendas.push(...data);
        if (data.length < 1000) break;
        pagina++;
      }

      // Nem toda venda vem com telefone da Hotmart (alguns checkouts não
      // pedem o campo, ex: Blindagem). Quando falta, tenta recuperar pelo
      // e-mail: se o mesmo comprador tem OUTRA compra com telefone, usa esse.
      const telefonePorEmail = {};
      for (const v of todasVendas) {
        if (v.comprador_telefone && v.comprador_email) {
          const chave = chaveTelefone(v.comprador_telefone);
          if (chave) telefonePorEmail[v.comprador_email.toLowerCase()] = chave;
        }
      }

      const mapa = {};
      for (const v of todasVendas) {
        const prod = classificarProdutoBolinha(v.produto_nome);
        if (!prod) continue;
        const chave = v.comprador_telefone
          ? chaveTelefone(v.comprador_telefone)
          : (v.comprador_email ? telefonePorEmail[v.comprador_email.toLowerCase()] : null);
        if (!chave) continue;
        if (!mapa[chave]) mapa[chave] = [];
        if (!mapa[chave].some(p => p.label === prod.label)) mapa[chave].push(prod);
      }
      setProdutosPorTelefone(mapa);
    })();
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

  // Marca "já atendi" sem mexer no estado do Claudinho (pausado ou ativo
  // continua do jeito que estava). Só limpa o aviso de atenção; se o
  // Claudinho pedir ajuda de novo depois, o aviso volta a aparecer sozinho.
  function dispensarAtencaoHumana(telefone) {
    setContatosDb(prev => prev.map(c => c.telefone === telefone ? { ...c, precisa_humano: false } : c));
    if (window.db) window.db.from('whatsapp_contatos').upsert({ telefone, precisa_humano: false }, { onConflict: 'telefone' }).then(() => carregar());
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
      const contato = {
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
      contato.statusResposta = statusResposta(contato);
      contato.produtosComprados = produtosPorTelefone[chaveTelefone(telefone)] || [];
      return contato;
    }).sort((a, b) => new Date(b.ultimaData) - new Date(a.ultimaData))
      .filter(c => !busca || (c.nome || c.telefone).toLowerCase().includes(busca.toLowerCase()));
  }, [msgs, contatosDb, busca, tick, produtosPorTelefone]);

  // Por padrão só mostra quem está em atendimento (Lead novo / Em conversa).
  // "Perdido" (janela fechada, nunca respondeu) fica arquivado, some da
  // visualização. O Chat nunca mostra Perdido (só quem está em atendimento);
  // o Kanban sempre mostra a coluna Perdido, pra ter visão completa do funil.
  // Ordem "precisa responder primeiro": 3 blocos, cada um mantém a ordenação
  // por data mais recente por dentro (contatos já vem ordenado assim).
  // Bloco 1: lead respondeu de verdade, aguardando nós (statusResposta='precisa').
  // Bloco 2: já respondemos, aguardando o lead ('respondida') ou mensagem
  // automática de bot ('automatica', não conta como pendência real).
  // Bloco 3: janela fechada.
  const PESO_ORDEM_PRECISA = { precisa: 0, respondida: 1, automatica: 1, fechada: 2 };
  const contatosVisiveis = useMemo(() => {
    const base = contatos.filter(c => c.etapa !== 'perdido');
    if (ordemLista === 'janela') {
      return [...base].sort((a, b) => (b.janelaAberta ? 1 : 0) - (a.janelaAberta ? 1 : 0));
    }
    if (ordemLista === 'precisa') {
      return [...base].sort((a, b) => PESO_ORDEM_PRECISA[a.statusResposta] - PESO_ORDEM_PRECISA[b.statusResposta]);
    }
    return base; // 'recentes', já vem ordenado por data
  }, [contatos, ordemLista]);
  const etapasVisiveis = ETAPAS;

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

  // Esc: fecha o que estiver mais "em cima" primeiro (modal, anexo pendente,
  // menu de anexo, painel de mensagens prontas) e só por último sai da
  // conversa selecionada e volta pra lista.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== 'Escape') return;
      if (modalNovoContato) { setModalNovoContato(false); return; }
      if (modalPrompt) { setModalPrompt(false); return; }
      if (menuAnexoAberto) { setMenuAnexoAberto(false); return; }
      if (pendente) { cancelarPendente(); return; }
      if (prontasAberto) { setProntasAberto(false); return; }
      if (selecionado) { setSelecionado(null); return; }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalNovoContato, modalPrompt, menuAnexoAberto, pendente, prontasAberto, selecionado]);

  async function enviar() {
    if (pendente) return enviarPendente();
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
      if (selecionado) delete rascunhosRef.current[selecionado];
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

  // Só GUARDA o arquivo escolhido/arrastado pra mostrar a prévia. Não manda
  // nada ainda, quem manda de verdade é enviarPendente() no clique de Enviar.
  function selecionarArquivo(file) {
    if (!file || !selecionado) return;
    const preview = file.type.startsWith('image/') || file.type.startsWith('video/')
      ? URL.createObjectURL(file) : null;
    setPendente({ tipo: 'arquivo', file, preview, nome: file.name, mime: file.type });
  }

  function colarLinkMidia() {
    if (!selecionado) return;
    const url = window.prompt('Cole o link direto do arquivo (imagem, vídeo ou áudio já hospedado):');
    if (!url || !url.trim()) return;
    setPendente({ tipo: 'link', url: url.trim(), preview: url.trim(), nome: url.trim() });
  }

  function cancelarPendente() {
    if (pendente?.preview && pendente.tipo === 'arquivo') URL.revokeObjectURL(pendente.preview);
    setPendente(null);
  }

  async function enviarPendente() {
    if (!pendente || !selecionado || enviandoMidia) return;
    setEnviandoMidia(true);
    try {
      let r;
      if (pendente.tipo === 'arquivo') {
        const form = new FormData();
        form.append('to', selecionado);
        if (contatoAtivo?.nome) form.append('nome', contatoAtivo.nome);
        if (texto.trim()) form.append('legenda', texto.trim());
        form.append('arquivo', pendente.file);
        r = await fetch(`${SUPA_URL}/functions/v1/whatsapp-enviar`, {
          method: 'POST', headers: { 'Authorization': `Bearer ${SUPA_KEY}` }, body: form,
        });
      } else {
        r = await fetch(`${SUPA_URL}/functions/v1/whatsapp-enviar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPA_KEY}` },
          body: JSON.stringify({ action: 'midia_link', to: selecionado, nome: contatoAtivo?.nome, url: pendente.url, legenda: texto.trim(), origem: 'manual' }),
        });
      }
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || 'falha no envio');
      if (pendente.preview && pendente.tipo === 'arquivo') URL.revokeObjectURL(pendente.preview);
      setPendente(null);
      setTexto('');
      if (selecionado) delete rascunhosRef.current[selecionado];
      carregar();
    } catch (e) {
      alert('Erro ao enviar mídia: ' + e.message + (contatoAtivo && !contatoAtivo.janelaAberta ? '\n\nA janela de 24h desse contato está fechada, precisa de um template aprovado pra reabrir.' : ''));
    } finally {
      setEnviandoMidia(false);
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
      {modoTreinamento && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
          background: 'rgba(251,191,36,.1)', borderBottom: '1px solid rgba(251,191,36,.3)',
          fontSize: 12, fontFamily: 'Roboto,sans-serif', color: '#fbbf24', fontWeight: 700 }}>
          <LucideIcon icon="graduation-cap" size={14} />
          Etapa de treinamento do Claudinho: sem resposta automática ao vivo (exceto número de teste do Felipe), só retomada de janela nos últimos minutos antes de fechar.
        </div>
      )}
      {modalPrompt && <PromptClaudinhoModal SUPA_URL={SUPA_URL} SUPA_KEY={SUPA_KEY} onClose={() => setModalPrompt(false)} />}
      {modalNovoContato && (
        <NovoContatoModal SUPA_URL={SUPA_URL} SUPA_KEY={SUPA_KEY}
          onClose={() => setModalNovoContato(false)}
          onEnviado={(telefone) => { setModalNovoContato(false); carregar(); setSelecionado(telefone.replace(/\D/g, '').startsWith('55') ? telefone.replace(/\D/g, '') : '55' + telefone.replace(/\D/g, '')); }} />
      )}
      {modo === 'kanban' && (
        <KanbanView contatos={contatos} etapas={etapasVisiveis} onMover={moverEtapa}
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
            <select value={ordemLista} onChange={e => setOrdemLista(e.target.value)}
              title="Ordem da lista de contatos"
              style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--app-border)', borderRadius: 8,
                padding: '0 8px', fontSize: 11.5, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif', outline: 'none', cursor: 'pointer' }}>
              <option value="precisa">Precisa responder</option>
              <option value="janela">Janela aberta</option>
              <option value="recentes">Recentes</option>
            </select>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {loading && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>Carregando...</div>}
            {!loading && !contatosVisiveis.length && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>Nenhuma conversa ainda.</div>}
            {contatosVisiveis.map(c => (
              <ContatoItem key={c.telefone} contato={c} ativo={c.telefone === selecionado} onClick={() => setSelecionado(c.telefone)} onDispensarAtencao={dispensarAtencaoHumana} />
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
                    <span onClick={() => dispensarAtencaoHumana(selecionado)}
                      title="A IA pediu ajuda de um humano nessa conversa. Clique pra marcar como já atendido."
                      style={{ fontSize: 10.5, fontFamily: 'Roboto,sans-serif', cursor: 'pointer',
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
                      : (contatoAtivo?.etapa !== 'aluno' && contatoAtivo?.etapa !== 'perdido' && tempoAteArquivar(contatoAtivo?.referenciaArquivamento)
                          ? `Será arquivado em ${tempoAteArquivar(contatoAtivo.referenciaArquivamento)}`
                          : 'Janela fechada · precisa de template')}
                  </div>
                  {/* Marcação manual de desfecho: some com a retomada automática pra
                      sempre nesse contato (o whatsapp-retomada já ignora etapa=perdido
                      e etapa=aluno), evita mandar retomada pra quem já disse não ou já comprou. */}
                  {contatoAtivo?.etapa !== 'aluno' && (
                    <Btn size="sm" variant="ghost" title="Marcar como venda fechada (para a retomada automática)"
                      onClick={() => { if (window.confirm('Marcar essa conversa como venda fechada? Ela sai do fluxo de retomada automática.')) moverEtapa(selecionado, 'aluno'); }}>
                      <span style={{ color: '#4ade80' }}>✓ Fechada</span>
                    </Btn>
                  )}
                  {contatoAtivo?.etapa !== 'perdido' && (
                    <Btn size="sm" variant="ghost" title="Marcar como venda perdida (para a retomada automática)"
                      onClick={() => { if (window.confirm('Marcar essa conversa como venda perdida? Ela sai do fluxo de retomada automática e some do Chat.')) moverEtapa(selecionado, 'perdido'); }}>
                      <span style={{ color: '#f87171' }}>✕ Perdida</span>
                    </Btn>
                  )}
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
                <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', position: 'relative' }}
                  onDragOver={e => { if (contatoAtivo?.janelaAberta) { e.preventDefault(); setDragOverThread(true); } }}
                  onDragLeave={() => setDragOverThread(false)}
                  onDrop={e => {
                    e.preventDefault(); setDragOverThread(false);
                    if (!contatoAtivo?.janelaAberta) return;
                    const file = e.dataTransfer.files?.[0];
                    if (file) selecionarArquivo(file);
                  }}>
                  {thread.map(m => <Bolha key={m.id} msg={m} />)}
                  {dragOverThread && (
                    <div style={{ position: 'absolute', inset: 8, borderRadius: 10, border: '2px dashed var(--fmn-gold)',
                      background: 'rgba(234,170,65,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color: 'var(--fmn-gold)', fontFamily: 'Roboto,sans-serif', pointerEvents: 'none' }}>
                      Solte o arquivo pra enviar
                    </div>
                  )}
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

              {pendente && (
                <div style={{ padding: '10px 12px', borderTop: '1px solid var(--app-border)', display: 'flex', alignItems: 'center', gap: 10,
                  background: 'rgba(234,170,65,.06)' }}>
                  {pendente.preview && (pendente.mime?.startsWith('image/') || (!pendente.mime && pendente.tipo === 'link')) ? (
                    <img src={pendente.preview} style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--app-border)' }}
                      onError={e => { e.target.style.display = 'none'; }} />
                  ) : pendente.mime?.startsWith('video/') ? (
                    <video src={pendente.preview} style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--app-border)' }} />
                  ) : (
                    <div style={{ width: 52, height: 52, borderRadius: 8, border: '1px solid var(--app-border)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <LucideIcon icon={pendente.tipo === 'link' ? 'link' : 'file'} size={18} style={{ color: 'var(--fmn-gold)' }} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif' }}>
                      Pronto pra enviar
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontFamily: 'Roboto,sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pendente.nome}
                    </div>
                  </div>
                  <Btn size="sm" variant="ghost" title="Cancelar" onClick={cancelarPendente} disabled={enviandoMidia}>
                    <LucideIcon icon="x" size={13} />
                  </Btn>
                </div>
              )}
              <div style={{ padding: 12, borderTop: pendente ? 'none' : '1px solid var(--app-border)', display: 'flex', gap: 8 }}>
                <textarea value={texto} onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                  placeholder={pendente ? 'Legenda (opcional)...' : contatoAtivo?.janelaAberta ? 'Digite sua mensagem... (Shift+Enter pra quebrar linha)' : 'Janela fechada, precisa de template pra reabrir'}
                  disabled={!contatoAtivo?.janelaAberta}
                  rows={1}
                  style={{ flex: 1, boxSizing: 'border-box', background: 'rgba(255,255,255,.04)', border: '1px solid var(--app-border)',
                    borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif', outline: 'none',
                    resize: 'none', maxHeight: 120, lineHeight: 1.4 }}
                  onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }} />
                <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) selecionarArquivo(f); }} />
                <div style={{ position: 'relative' }}>
                  <Btn variant="ghost" title="Anexar foto, vídeo ou áudio"
                    disabled={!contatoAtivo?.janelaAberta || enviandoMidia}
                    onClick={() => setMenuAnexoAberto(a => !a)}>
                    <LucideIcon icon="paperclip" size={14} />
                  </Btn>
                  {menuAnexoAberto && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setMenuAnexoAberto(false)} />
                      <div style={{ position: 'absolute', bottom: '110%', left: 0, zIndex: 10, minWidth: 190,
                        background: '#18191c', border: '1px solid var(--app-border)', borderRadius: 9,
                        boxShadow: '0 8px 24px rgba(0,0,0,.4)', overflow: 'hidden' }}>
                        <button onClick={() => { setMenuAnexoAberto(false); fileInputRef.current?.click(); }}
                          style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left', padding: '9px 12px', display: 'flex',
                            alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer',
                            fontSize: 12.5, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif' }}>
                          <LucideIcon icon="upload" size={13} style={{ color: 'var(--fmn-gold)' }} /> Enviar arquivo
                        </button>
                        <button onClick={() => { setMenuAnexoAberto(false); colarLinkMidia(); }}
                          style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left', padding: '9px 12px', display: 'flex',
                            alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer',
                            fontSize: 12.5, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif', borderTop: '1px solid var(--app-border)' }}>
                          <LucideIcon icon="link" size={13} style={{ color: 'var(--fmn-gold)' }} /> Colar link
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <Btn variant={prontasAberto ? 'secondary' : 'ghost'} title="Mensagens prontas"
                  onClick={() => setProntasAberto(p => !p)}>
                  <LucideIcon icon="zap" size={14} />
                </Btn>
                <Btn onClick={enviar} disabled={!contatoAtivo?.janelaAberta || enviando || enviandoMidia || (!pendente && !texto.trim())}>
                  {enviandoMidia ? 'Enviando mídia...' : enviando ? 'Enviando...' : 'Enviar'}
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
