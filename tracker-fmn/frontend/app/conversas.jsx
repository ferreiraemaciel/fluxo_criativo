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

/* Janela de 24h: true se a última mensagem de ENTRADA foi há menos de 24h. */
function janelaAberta(ultimaEntrada) {
  if (!ultimaEntrada) return false;
  return (Date.now() - new Date(ultimaEntrada).getTime()) < 24 * 60 * 60 * 1000;
}

function ContatoItem({ contato, ativo, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer',
      background: ativo ? 'rgba(234,170,65,.10)' : 'transparent',
      borderLeft: ativo ? '3px solid var(--fmn-gold)' : '3px solid transparent',
      borderBottom: '1px solid var(--app-border)',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
        background: 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color: 'var(--text-2)', fontFamily: 'Roboto,sans-serif',
      }}>
        {(contato.nome || '?').slice(0, 1).toUpperCase()}
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

function ConversasScreen() {
  const [msgs, setMsgs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selecionado, setSelecionado] = useState(null);
  const [texto, setTexto]         = useState('');
  const [enviando, setEnviando]   = useState(false);
  const [busca, setBusca]         = useState('');
  const scrollRef = useRef(null);
  const SUPA_URL = window.db?.supabaseUrl || '';
  const SUPA_KEY = window.db?.supabaseKey  || '';

  function carregar() {
    if (!window.db) return;
    window.db.from('whatsapp_mensagens').select('*').order('created_at', { ascending: false }).limit(1000)
      .then(({ data, error }) => { if (!error) setMsgs(data || []); setLoading(false); });
  }

  useEffect(() => { carregar(); const t = setInterval(carregar, 15000); return () => clearInterval(t); }, []);

  const contatos = useMemo(() => {
    const porTelefone = {};
    for (const m of msgs) {
      if (!porTelefone[m.telefone]) porTelefone[m.telefone] = [];
      porTelefone[m.telefone].push(m);
    }
    return Object.entries(porTelefone).map(([telefone, lista]) => {
      const ultima = lista[0]; // já vem desc
      const ultimaEntrada = lista.find(m => m.direcao === 'entrada');
      const nome = lista.find(m => m.nome)?.nome || null;
      return {
        telefone, nome,
        ultimoCorpo: ultima.corpo, ultimaData: ultima.created_at, ultimaDirecao: ultima.direcao,
        naoLidas: lista.filter(m => m.direcao === 'entrada' && !m.lida_pelo_time).length,
        janelaAberta: janelaAberta(ultimaEntrada?.created_at),
      };
    }).sort((a, b) => new Date(b.ultimaData) - new Date(a.ultimaData))
      .filter(c => !busca || (c.nome || c.telefone).toLowerCase().includes(busca.toLowerCase()));
  }, [msgs, busca]);

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
      <TopBar title="Conversas" />
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
                  {contatoAtivo?.janelaAberta ? 'Janela de 24h aberta · grátis' : 'Janela fechada · precisa de template'}
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
    </div>
  );
}

window.ConversasScreen = ConversasScreen;
