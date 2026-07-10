/* ================================================================
   Tracker FMN — Conversas (caixa de entrada do WhatsApp) v1
   Lista de contatos + thread + resposta manual, dentro da janela de
   serviço de 24h aberta pelo lead. Sem custo por mensagem aqui.
   ================================================================ */
const { useState, useEffect, useRef, useMemo } = React;
const { LucideIcon, Btn, TopBar } = window;

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

/* Quanto falta da janela, em texto curto. null se fechada/sem entrada. */
function tempoRestanteJanela(ultimaEntrada) {
  if (!ultimaEntrada) return null;
  const restanteMs = JANELA_MS - (Date.now() - new Date(ultimaEntrada).getTime());
  if (restanteMs <= 0) return null;
  const h = Math.floor(restanteMs / 3600000);
  const m = Math.floor((restanteMs % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}min restantes` : `${m}min restantes`;
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
          <div style={{ fontSize: 13, fontWeight: contato.naoLidas > 0 ? 800 : 600, color: 'var(--text-1)',
            fontFamily: 'Roboto,sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {contato.nome || normalizarTelefoneExibicao(contato.telefone)}
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
        <div style={{ fontSize: 13, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
          {msg.corpo}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 3 }}>
          <span style={{ fontSize: 9.5, color: 'var(--text-3)' }}>{horaCurta(msg.created_at)}</span>
          {isSaida && (
            <LucideIcon icon={msg.status === 'lido' ? 'check-check' : msg.status === 'falhou' ? 'x' : 'check'}
              size={11} style={{ color: msg.status === 'lido' ? 'var(--clr-info)' : msg.status === 'falhou' ? 'var(--clr-neg)' : 'var(--text-3)' }} />
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

const ETAPAS = [
  { id: 'lead_novo',   label: 'Lead novo',    cor: '#60a5fa' },
  { id: 'em_conversa', label: 'Em conversa',  cor: '#eaaa41' },
  { id: 'aluno',       label: 'Aluno',        cor: '#4ade80' },
  { id: 'perdido',     label: 'Perdido',      cor: '#f87171' },
];

function KanbanCard({ contato, onAbrir, onMover }) {
  return (
    <div style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', borderRadius: 10, padding: 10, marginBottom: 8 }}>
      <div onClick={onAbrir} style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div title={contato.janelaAberta ? 'Janela de 24h aberta' : 'Janela fechada'} style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: contato.janelaAberta ? '#4ade80' : 'var(--text-3)',
          }} />
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {contato.nome || normalizarTelefoneExibicao(contato.telefone)}
          </div>
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontFamily: 'Roboto,sans-serif', marginTop: 2 }}>
          {normalizarTelefoneExibicao(contato.telefone)}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'Roboto,sans-serif', marginTop: 5,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {contato.ultimaDirecao === 'saida' ? 'Você: ' : ''}{contato.ultimoCorpo}
        </div>
      </div>
      <select value={contato.etapa} onChange={e => onMover(contato.telefone, e.target.value)}
        onClick={e => e.stopPropagation()}
        style={{ marginTop: 8, width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,.04)',
          border: '1px solid var(--app-border)', borderRadius: 6, padding: '4px 6px', fontSize: 10.5,
          color: 'var(--text-2)', fontFamily: 'Roboto,sans-serif', outline: 'none' }}>
        {ETAPAS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
      </select>
    </div>
  );
}

function KanbanView({ contatos, onAbrir, onMover }) {
  return (
    <div style={{ flex: 1, display: 'flex', gap: 12, padding: 14, overflowX: 'auto' }}>
      {ETAPAS.map(etapa => {
        const cards = contatos.filter(c => (c.etapa || 'lead_novo') === etapa.id);
        return (
          <div key={etapa.id} style={{ width: 250, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '0 2px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: etapa.cor }} />
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif' }}>{etapa.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'Roboto,sans-serif' }}>({cards.length})</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {cards.map(c => <KanbanCard key={c.telefone} contato={c} onAbrir={() => onAbrir(c.telefone)} onMover={onMover} />)}
              {!cards.length && <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'Roboto,sans-serif', padding: '8px 2px' }}>Vazio.</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ConversasScreen() {
  const [msgs, setMsgs]           = useState([]);
  const [contatosDb, setContatosDb] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selecionado, setSelecionado] = useState(null);
  const [texto, setTexto]         = useState('');
  const [enviando, setEnviando]   = useState(false);
  const [busca, setBusca]         = useState('');
  const [modo, setModo]           = useState('lista'); // lista | kanban
  const [modalNovoContato, setModalNovoContato] = useState(false);
  const [tick, setTick]           = useState(0); // força re-render pro contador de tempo
  const scrollRef = useRef(null);
  const SUPA_URL = window.db?.supabaseUrl || '';
  const SUPA_KEY = window.db?.supabaseKey  || '';

  function carregar() {
    if (!window.db) return;
    window.db.from('whatsapp_mensagens').select('*').order('created_at', { ascending: false }).limit(1000)
      .then(({ data, error }) => { if (!error) setMsgs(data || []); setLoading(false); });
    window.db.from('whatsapp_contatos').select('*')
      .then(({ data, error }) => { if (!error) setContatosDb(data || []); });
  }

  useEffect(() => { carregar(); const t = setInterval(carregar, 15000); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 30000); return () => clearInterval(t); }, []);

  function moverEtapa(telefone, etapa) {
    setContatosDb(prev => prev.map(c => c.telefone === telefone ? { ...c, etapa } : c));
    if (window.db) window.db.from('whatsapp_contatos').update({ etapa }).eq('telefone', telefone).then(() => carregar());
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
        etapa: dbRow?.etapa || 'lead_novo',
      };
    }).sort((a, b) => new Date(b.ultimaData) - new Date(a.ultimaData))
      .filter(c => !busca || (c.nome || c.telefone).toLowerCase().includes(busca.toLowerCase()));
  }, [msgs, contatosDb, busca, tick]);

  const thread = useMemo(() => {
    if (!selecionado) return [];
    return msgs.filter(m => m.telefone === selecionado).slice().reverse();
  }, [msgs, selecionado]);

  const contatoAtivo = contatos.find(c => c.telefone === selecionado);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar title="Conversas" actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,.04)', border: '1px solid var(--app-border)', borderRadius: 8, padding: 3 }}>
            <button onClick={() => setModo('lista')} style={{
              border: 'none', cursor: 'pointer', padding: '5px 12px', borderRadius: 6, fontSize: 12, fontFamily: 'Roboto,sans-serif', fontWeight: 700,
              background: modo === 'lista' ? 'var(--fmn-gold)' : 'transparent', color: modo === 'lista' ? '#1a1a1a' : 'var(--text-2)' }}>Lista</button>
            <button onClick={() => setModo('kanban')} style={{
              border: 'none', cursor: 'pointer', padding: '5px 12px', borderRadius: 6, fontSize: 12, fontFamily: 'Roboto,sans-serif', fontWeight: 700,
              background: modo === 'kanban' ? 'var(--fmn-gold)' : 'transparent', color: modo === 'kanban' ? '#1a1a1a' : 'var(--text-2)' }}>Kanban</button>
          </div>
          <Btn onClick={() => setModalNovoContato(true)}>+ Novo Contato</Btn>
        </div>
      } />
      {modalNovoContato && (
        <NovoContatoModal SUPA_URL={SUPA_URL} SUPA_KEY={SUPA_KEY}
          onClose={() => setModalNovoContato(false)}
          onEnviado={(telefone) => { setModalNovoContato(false); carregar(); setSelecionado(telefone.replace(/\D/g, '').startsWith('55') ? telefone.replace(/\D/g, '') : '55' + telefone.replace(/\D/g, '')); }} />
      )}
      {modo === 'kanban' && (
        <KanbanView contatos={contatos} onMover={moverEtapa}
          onAbrir={(telefone) => { setSelecionado(telefone); setModo('lista'); }} />
      )}
      {modo === 'lista' && (
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: 300, flexShrink: 0, borderRight: '1px solid var(--app-border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 10, borderBottom: '1px solid var(--app-border)' }}>
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar contato..."
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,.04)', border: '1px solid var(--app-border)',
                borderRadius: 8, padding: '7px 10px', fontSize: 12.5, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif', outline: 'none' }} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>Carregando...</div>}
            {!loading && !contatos.length && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>Nenhuma conversa ainda.</div>}
            {contatos.map(c => (
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
                <div style={{
                  fontSize: 10.5, fontFamily: 'Roboto,sans-serif', padding: '3px 9px', borderRadius: 999,
                  color: contatoAtivo?.janelaAberta ? '#4ade80' : 'var(--text-3)',
                  background: contatoAtivo?.janelaAberta ? 'rgba(74,222,128,.12)' : 'rgba(255,255,255,.05)',
                  border: '1px solid ' + (contatoAtivo?.janelaAberta ? 'rgba(74,222,128,.3)' : 'var(--app-border)'),
                }}>
                  {contatoAtivo?.janelaAberta
                    ? `Grátis · ${tempoRestanteJanela(contatoAtivo.ultimaEntradaData)}`
                    : 'Janela fechada · precisa de template'}
                </div>
              </div>

              <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
                {thread.map(m => <Bolha key={m.id} msg={m} />)}
              </div>

              <div style={{ padding: 12, borderTop: '1px solid var(--app-border)', display: 'flex', gap: 8 }}>
                <input value={texto} onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                  placeholder={contatoAtivo?.janelaAberta ? 'Digite sua mensagem...' : 'Janela fechada, precisa de template pra reabrir'}
                  disabled={!contatoAtivo?.janelaAberta}
                  style={{ flex: 1, boxSizing: 'border-box', background: 'rgba(255,255,255,.04)', border: '1px solid var(--app-border)',
                    borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif', outline: 'none' }} />
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
