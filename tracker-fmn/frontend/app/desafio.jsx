/* ================================================================
   Tracker FMN — Desafio MMM (Mandala Mão na Massa)
   30 conteúdos em 30 dias, 21/10 a 21/11/2026.
   Regras e registro em tracker-fmn/DESAFIO-MANDALA-MAO-NA-MASSA.md

   O vínculo é na mão, de propósito (combinado com Felipe em 20/10/2026):
   o Orgânico tem muito card publicado que não entra no desafio, então só
   vale o que for escolhido aqui, um por dia. A lista mora em
   app_config.chave='desafio_mmm' (jsonb), mesmo padrão já usado pelo
   alarme da Visão Geral, então não precisou de coluna nem migration.

   O visual das peças é o mesmo da aba Picos de Venda (MiniPeca grande):
   capa 4:5, rótulo, situação e data.

   Nomes com prefixo DMMM_ / dmmm de propósito: tudo aqui vira global depois
   do Babel, e nome genérico atropela o de outra tela em silêncio.
   ================================================================ */
const { useState: useDS, useEffect: useDE, useMemo: useDM } = React;

const DMMM_INICIO = '2026-10-21';
const DMMM_FIM    = '2026-11-21';
const DMMM_META   = 30;
const DMMM_PONTOS_POR_CONTEUDO = 10;
const DMMM_CHAVE  = 'desafio_mmm';

/* As quatro semanas e a janela de 48 horas de cada formulário. */
const DMMM_SEMANAS = [
  { n: 1, de: '2026-10-21', ate: '2026-10-28', abre: '2026-10-29', fecha: '2026-10-30' },
  { n: 2, de: '2026-10-29', ate: '2026-11-05', abre: '2026-11-06', fecha: '2026-11-07' },
  { n: 3, de: '2026-11-06', ate: '2026-11-13', abre: '2026-11-14', fecha: '2026-11-15' },
  { n: 4, de: '2026-11-14', ate: '2026-11-21', abre: '2026-11-22', fecha: '2026-11-23' },
];

const DMMM_LINK_DESAFIO = 'https://mandala-mao-na-massa.vercel.app/';

/* Os 21 tipos da Mandala, pra marcar qual foi usado em cada peça. */
const DMMM_TIPOS = ['Comparação', 'Apelo Emocional', 'Certo vs Errado', 'Curiosidade', 'Demonstração',
  'Oportunidade', 'Visual', 'Dilema', 'Clickbait', 'Prova', 'Contraste', 'História', 'Ultra Segmentado',
  'Reflexão', 'Explicação', 'Problema-Solução', 'Sensação', 'Mito', 'Pesquisa Científica',
  'Atualidades', 'Atualidades Trend'];

const DMMM_STATUS = {
  Fazendo: 'Em produção', Feito: 'Pronto', Agendado: 'Agendado', Publicado: 'Publicado', Arquivado: 'Publicado',
  fazer: 'Para fazer', fazendo: 'Em produção', ativo: 'Rodando', campeoes: 'Campeão', arquivado: 'Pausado',
};

/* Data de Brasília, nunca a de Londres (ver frontend/ARQUITETURA.md). */
function dmmmDia(iso) {
  if (!iso) return null;
  try { return window.FMNFinancas.dataBRT(new Date(iso)); }
  catch { return String(iso).slice(0, 10); }
}
function dmmmHoje() {
  try { return window.FMNFinancas.dataBRT(); }
  catch { return new Date().toISOString().slice(0, 10); }
}
/* Dia que o campo de data sugere: hoje, preso dentro da janela do desafio. */
function dmmmDiaSugerido() {
  const h = dmmmHoje();
  return h < DMMM_INICIO ? DMMM_INICIO : h > DMMM_FIM ? DMMM_FIM : h;
}
function dmmmFmt(dia) {
  if (!dia) return '—';
  const [a, m, d] = String(dia).slice(0, 10).split('-');
  return `${d}/${m}`;
}
function dmmmDiasEntre(de, ate) {
  return Math.round((new Date(ate + 'T12:00:00') - new Date(de + 'T12:00:00')) / 86400000);
}
function dmmmNum(v) {
  return (v == null ? 0 : Number(v)).toLocaleString('pt-BR');
}
function dmmmChave(v) {
  return `${v.tipo}:${v.numero}`;
}

/* Capa do card do Orgânico, mesma regra da aba Picos de Venda. */
function dmmmCapaOrganico(c) {
  let mf = c.media_files;
  if (typeof mf === 'string') { try { mf = JSON.parse(mf); } catch { mf = null; } }
  const v = Array.isArray(mf) ? mf.find(m => m && m.tipo === 'video') : null;
  if (v) return v.capa_url || v.thumb_url || null;
  let sl = c.slides;
  if (typeof sl === 'string') { try { sl = JSON.parse(sl); } catch { sl = null; } }
  const img = Array.isArray(sl) ? sl.map(x => x && x.image_url).find(u => u && !/\.(mp4|mov|webm|m4v)$/i.test(u)) : null;
  return img || null;
}

/* Situação do formulário de cada semana, pela data de hoje. */
function dmmmSituacaoSemana(sem, hoje) {
  if (hoje < sem.abre)   return { texto: `Formulário abre ${dmmmFmt(sem.abre)}`, tom: 'default' };
  if (hoje <= sem.fecha) return { texto: `Formulário aberto até ${dmmmFmt(sem.fecha)}`, tom: 'warning' };
  return { texto: `Formulário fechou ${dmmmFmt(sem.fecha)}`, tom: 'default' };
}

/* ── Peça do desafio, no mesmo visual da aba Picos de Venda ──────── */
function DmmmPeca({ p, onAbrir, onEditar, onSoltar }) {
  const [hov, setHov] = useDS(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative', fontFamily: 'Roboto,sans-serif' }}>
      <button onClick={() => onAbrir(p)} title={`${p.rotulo} · ${p.titulo}`}
        style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
        <div style={{ width: '100%', aspectRatio: '4 / 5', borderRadius: 12, overflow: 'hidden',
          background: 'var(--app-surface-2)', border: `1px solid ${hov ? 'var(--app-primary)' : 'var(--app-border)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 150ms' }}>
          {p.img
            ? <img src={p.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            : <window.LucideIcon icon={p.tipo === 'ADS' ? 'clapperboard' : 'leaf'} size={28} style={{ color: 'var(--text-2)' }}/>}
        </div>
      </button>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: 'var(--app-primary)' }}>{p.rotulo}</span>
          <span style={{ color: 'var(--text-2)' }}>
            {DMMM_STATUS[p.status] || p.status || '—'}{p.diaDesafio ? ` · ${dmmmFmt(p.diaDesafio)}` : ''}
          </span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.35, marginTop: 2,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {p.titulo || 'sem título'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
          {p.mandala && (
            <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 999,
              border: '1px solid rgba(249,182,79,.35)', color: 'var(--app-primary)' }}>{p.mandala}</span>
          )}
          {p.link && (
            <a href={p.link} target="_blank" rel="noreferrer" title="Abrir o post publicado"
              style={{ fontSize: 11, color: 'var(--text-2)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <window.LucideIcon icon="external-link" size={11}/>post
            </a>
          )}
        </div>
        {p.metrica && (
          <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>
            {dmmmNum(p.metrica.reach)} de alcance · {dmmmNum(p.metrica.total_interactions)} interações
          </div>
        )}
      </div>

      {hov && (
        <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4 }}>
          <button onClick={() => onEditar(p)} title="Editar o vínculo"
            style={{ width: 26, height: 26, borderRadius: 8, cursor: 'pointer',
              background: 'rgba(8,10,14,.82)', border: '1px solid var(--app-border)',
              color: 'var(--text-1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <window.LucideIcon icon="pencil" size={12}/>
          </button>
          <button onClick={() => onSoltar(p)} title="Tirar do desafio"
            style={{ width: 26, height: 26, borderRadius: 8, cursor: 'pointer',
              background: 'rgba(8,10,14,.82)', border: '1px solid var(--app-border)',
              color: 'var(--clr-neg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <window.LucideIcon icon="x" size={12}/>
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Modal de vincular / editar ──────────────────────────────────── */
function DmmmModal({ aberto, inicial, organico, anuncios, jaVinculados, onFechar, onSalvar }) {
  const editando = !!(inicial && inicial.numero);
  const [tipo, setTipo]     = useDS(inicial?.tipo || 'ORG');
  const [numero, setNumero] = useDS(inicial?.numero ? String(inicial.numero) : '');
  const [dia, setDia]       = useDS(inicial?.dia || dmmmDiaSugerido());
  const [mandala, setMandala] = useDS(inicial?.mandala || '');
  const [busca, setBusca]   = useDS('');

  useDE(() => {
    if (!aberto) return;
    setTipo(inicial?.tipo || 'ORG');
    setNumero(inicial?.numero ? String(inicial.numero) : '');
    setDia(inicial?.dia || dmmmDiaSugerido());
    setMandala(inicial?.mandala || '');
    setBusca('');
  }, [aberto, inicial]);

  if (!aberto) return null;

  const fonte = tipo === 'ORG' ? organico : anuncios;
  const lista = (fonte || [])
    .filter(c => {
      if (editando) return true;
      if (jaVinculados.has(`${tipo}:${c.numero}`)) return false;
      if (!busca.trim()) return true;
      const alvo = `${c.numero} ${(c.tema || c.titulo || '')}`.toLowerCase();
      return alvo.includes(busca.trim().toLowerCase());
    })
    .slice(0, 40);

  const campo = { height: 36, padding: '0 10px', borderRadius: 'var(--app-radius-md)',
    border: '1px solid var(--app-border)', background: 'var(--app-bg)', color: 'var(--text-1)',
    fontSize: 13, fontFamily: 'Roboto,sans-serif', width: '100%', boxSizing: 'border-box' };
  const rotulo = { fontSize: 12, color: 'var(--text-2)', fontFamily: 'Roboto,sans-serif', marginBottom: 4, display: 'block' };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onFechar(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)',
        borderRadius: 'var(--app-radius-xl)', width: 480, maxWidth: '100%', maxHeight: '86vh',
        overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif' }}>
            {editando ? `Editar ${inicial.tipo} ${inicial.numero}` : 'Vincular criativo ao desafio'}
          </span>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)' }}>
            <window.LucideIcon icon="x" size={18}/>
          </button>
        </div>

        {!editando && (
          <>
            <div style={{ display: 'flex', gap: 6 }}>
              {['ORG', 'ADS'].map(t => (
                <button key={t} onClick={() => { setTipo(t); setNumero(''); }}
                  style={{ flex: 1, height: 34, borderRadius: 'var(--app-radius-md)', cursor: 'pointer',
                    border: `1px solid ${tipo === t ? 'rgba(249,182,79,.45)' : 'var(--app-border)'}`,
                    background: tipo === t ? 'rgba(249,182,79,.08)' : 'transparent',
                    color: tipo === t ? 'var(--app-primary)' : 'var(--text-2)',
                    fontSize: 13, fontFamily: 'Roboto,sans-serif', fontWeight: 500 }}>
                  {t === 'ORG' ? 'Orgânico' : 'Anúncio'}
                </button>
              ))}
            </div>

            <div>
              <label style={rotulo}>Procurar pelo número ou pelo tema</label>
              <input value={busca} onChange={e => setBusca(e.target.value)} style={campo}
                placeholder={tipo === 'ORG' ? 'ex: 344, ou contrato' : 'ex: 371, ou conversa vazada'}/>
            </div>

            <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--app-border)',
              borderRadius: 'var(--app-radius-md)' }}>
              {lista.length === 0 ? (
                <div style={{ padding: 14, fontSize: 13, color: 'var(--text-3)' }}>Nada encontrado.</div>
              ) : lista.map(c => {
                const sel = String(c.numero) === String(numero);
                return (
                  <button key={c.numero} onClick={() => setNumero(String(c.numero))}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                      padding: '8px 10px', cursor: 'pointer', border: 'none',
                      borderBottom: '1px solid var(--app-border)',
                      background: sel ? 'rgba(249,182,79,.1)' : 'transparent' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-primary)', minWidth: 62,
                      fontFamily: 'Roboto,sans-serif' }}>
                      {tipo} {c.numero}
                    </span>
                    <span style={{ fontSize: 12.5, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.tema || c.titulo || 'sem título'}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={rotulo}>Dia do desafio</label>
            <input type="date" value={dia} min={DMMM_INICIO} max={DMMM_FIM}
              onChange={e => setDia(e.target.value)} style={campo}/>
          </div>
          <div style={{ flex: 1 }}>
            <label style={rotulo}>Tipo da Mandala</label>
            <select value={mandala} onChange={e => setMandala(e.target.value)} style={campo}>
              <option value="">a definir</option>
              {DMMM_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <window.Btn variant="ghost" onClick={onFechar}>Cancelar</window.Btn>
          <window.Btn disabled={!numero}
            onClick={() => onSalvar({ tipo, numero: Number(numero), dia, mandala })}>
            {editando ? 'Salvar' : 'Vincular'}
          </window.Btn>
        </div>
      </div>
    </div>
  );
}

/* ── Tela ────────────────────────────────────────────────────────── */
function DesafioScreen({ onNavigate }) {
  const [vinculos, setVinculos] = useDS([]);   // [{tipo,numero,dia,mandala}]
  const [organico, setOrganico] = useDS([]);
  const [anuncios, setAnuncios] = useDS([]);
  const [metricas, setMetricas] = useDS({});   // meta_media_id → snapshot mais recente
  const [carregando, setCarregando] = useDS(true);
  const [copiado, setCopiado] = useDS(null);
  const [modal, setModal] = useDS(null);       // null | {} | {tipo,numero,...}
  const [salvando, setSalvando] = useDS(false);

  const hoje = dmmmHoje();

  useDE(() => {
    if (!window.db) return;
    let vivo = true;
    (async () => {
      const [cfg, org, ads, mets] = await Promise.all([
        window.db.from('app_config').select('valor').eq('chave', DMMM_CHAVE).maybeSingle(),
        window.buscarTudo(() => window.db.from('conteudo_organico')
          .select('numero,tema,headline,plataforma,status,published_at,scheduled_at,data_prevista,meta_media_id,slides,media_files,youtube_video_id')),
        window.buscarTudo(() => window.db.from('ads')
          .select('numero,titulo,tipo,status,created_at,produto,thumb_url,media_preview_url,gasto_total,vendas_total,cpa_historico,meta_ad_url')),
        window.buscarTudo(() => window.db.from('organico_metricas')
          .select('meta_media_id,permalink,reach,saved,shares,total_interactions,follows,data')
          .order('data', { ascending: false })),
      ]);
      if (!vivo) return;
      const porMedia = {};
      for (const m of (mets || [])) if (!porMedia[m.meta_media_id]) porMedia[m.meta_media_id] = m;
      const lista = Array.isArray(cfg?.data?.valor?.itens) ? cfg.data.valor.itens : [];
      setVinculos(lista);
      setOrganico((org || []).sort((a, b) => (b.numero || 0) - (a.numero || 0)));
      setAnuncios((ads || []).sort((a, b) => (b.numero || 0) - (a.numero || 0)));
      setMetricas(porMedia);
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, []);

  async function gravar(novaLista) {
    setVinculos(novaLista);
    setSalvando(true);
    try {
      const { error } = await window.db.from('app_config')
        .upsert({ chave: DMMM_CHAVE, valor: { itens: novaLista }, updated_at: new Date().toISOString() },
          { onConflict: 'chave' });
      if (error) console.error('[desafio] não salvou o vínculo:', error.message);
    } catch (e) { console.error('[desafio] não salvou o vínculo:', e); }
    setSalvando(false);
  }

  const porNumeroOrg = useDM(() => Object.fromEntries((organico || []).map(c => [c.numero, c])), [organico]);
  const porNumeroAds = useDM(() => Object.fromEntries((anuncios || []).map(c => [c.numero, c])), [anuncios]);

  /* Cada vínculo vira uma peça pronta pra desenhar. */
  const pecas = useDM(() => (vinculos || []).map(v => {
    if (v.tipo === 'ADS') {
      const c = porNumeroAds[v.numero] || {};
      return { ...v, rotulo: `ADS ${v.numero}`, status: c.status,
        titulo: (c.titulo || '').replace(/^ADS\s*\d+\s*-\s*/i, '') || `ADS ${v.numero}`,
        img: c.thumb_url || c.media_preview_url || null, diaDesafio: v.dia,
        link: c.meta_ad_url || null, metrica: null,
        gasto: c.gasto_total, vendas: c.vendas_total, cpa: c.cpa_historico };
    }
    const c = porNumeroOrg[v.numero] || {};
    const m = c.meta_media_id ? metricas[c.meta_media_id] : null;
    return { ...v, rotulo: `ORG ${v.numero}`, status: c.status,
      titulo: c.headline || c.tema || `ORG ${v.numero}`,
      formato: c.plataforma, img: dmmmCapaOrganico(c), diaDesafio: v.dia,
      link: m?.permalink || (c.youtube_video_id ? `https://www.youtube.com/watch?v=${c.youtube_video_id}` : null),
      metrica: m || null };
  }).sort((a, b) => String(b.dia).localeCompare(String(a.dia)) || (b.numero - a.numero)),
  [vinculos, porNumeroOrg, porNumeroAds, metricas]);

  const jaVinculados = useDM(() => new Set((vinculos || []).map(dmmmChave)), [vinculos]);

  /* Publicado na janela e ainda fora do desafio: atalho pra vincular. */
  const candidatos = useDM(() => (organico || [])
    .map(c => ({ ...c, dia: dmmmDia(c.published_at) }))
    .filter(c => c.dia && c.dia >= DMMM_INICIO && c.dia <= DMMM_FIM && !jaVinculados.has(`ORG:${c.numero}`))
    .sort((a, b) => b.dia.localeCompare(a.dia)),
  [organico, jaVinculados]);

  const total = pecas.length;
  const pontos = total * DMMM_PONTOS_POR_CONTEUDO;
  const faltam = Math.max(0, DMMM_META - total);
  const diasRestantes = Math.max(0, dmmmDiasEntre(hoje, DMMM_FIM));
  const ritmo = diasRestantes > 0 ? (faltam / diasRestantes) : 0;

  const soma = useDM(() => {
    const s = { reach: 0, interacoes: 0, saved: 0, shares: 0, follows: 0, comMetrica: 0 };
    for (const p of pecas) {
      if (!p.metrica) continue;
      s.comMetrica++;
      s.reach      += Number(p.metrica.reach || 0);
      s.interacoes += Number(p.metrica.total_interactions || 0);
      s.saved      += Number(p.metrica.saved || 0);
      s.shares     += Number(p.metrica.shares || 0);
      s.follows    += Number(p.metrica.follows || 0);
    }
    return s;
  }, [pecas]);

  function salvarVinculo(v) {
    const sem = (vinculos || []).filter(x => dmmmChave(x) !== dmmmChave(v));
    gravar([...sem, v]);
    setModal(null);
  }
  function soltar(p) {
    if (!confirm(`Tirar ${p.rotulo} do desafio?`)) return;
    gravar((vinculos || []).filter(x => dmmmChave(x) !== `${p.tipo}:${p.numero}`));
  }
  function abrirCard(p) {
    if (!onNavigate) return;
    onNavigate(p.tipo === 'ADS' ? 'criativos' : 'organico', p.numero);
  }

  function copiarSemana(sem) {
    const linhas = pecas
      .filter(p => p.dia >= sem.de && p.dia <= sem.ate)
      .sort((a, b) => String(a.dia).localeCompare(String(b.dia)))
      .map(p => `${p.rotulo} · ${dmmmFmt(p.dia)} · ${p.titulo}${p.mandala ? ` · ${p.mandala}` : ''}${p.link ? ` · ${p.link}` : ' · (link pendente)'}`);
    const texto = linhas.join('\n') || 'Nenhum conteúdo nesta semana ainda.';
    navigator.clipboard?.writeText(texto);
    setCopiado(sem.n);
    setTimeout(() => setCopiado(null), 2500);
  }

  return (
    <window.PageBody maxWidth={1280}>
      <window.PageHeader
        title="Desafio MMM"
        description={`Mandala Mão na Massa. ${DMMM_META} conteúdos entre ${dmmmFmt(DMMM_INICIO)} e ${dmmmFmt(DMMM_FIM)}, ${DMMM_PONTOS_POR_CONTEUDO} pontos cada.`}
        actions={
          <>
            <window.Btn variant="ghost" icon="external-link"
              onClick={() => window.open(DMMM_LINK_DESAFIO, '_blank')}>
              Página do desafio
            </window.Btn>
            <window.Btn icon="plus" onClick={() => setModal({})}>Vincular criativo</window.Btn>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <window.CardKPI label="Vinculados" value={`${total}/${DMMM_META}`} icon="check-circle" accent
          delta={faltam ? `faltam ${faltam}` : 'desafio completo'}/>
        <window.CardKPI label="Pontos de volume" value={dmmmNum(pontos)} icon="trophy"/>
        <window.CardKPI label="Dias restantes" value={diasRestantes} icon="calendar-clock"
          delta={diasRestantes && faltam ? `${ritmo.toFixed(1)} por dia pra fechar` : null}/>
        <window.CardKPI label="Alcance somado" value={dmmmNum(soma.reach)} icon="eye"
          delta={`${soma.comMetrica} com número coletado`}/>
        <window.CardKPI label="Interações" value={dmmmNum(soma.interacoes)} icon="heart"
          delta={`${dmmmNum(soma.saved)} salvos · ${dmmmNum(soma.shares)} compart.`}/>
        <window.CardKPI label="Seguidores ganhos" value={dmmmNum(soma.follows)} icon="user-plus"/>
      </div>

      <div style={{ height: 8, borderRadius: 999, background: 'var(--app-surface-2)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, (total / DMMM_META) * 100)}%`,
          background: 'var(--app-primary)', transition: 'width 300ms' }}/>
      </div>

      <window.SectionCard title="As quatro semanas" icon="calendar-days">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
          {DMMM_SEMANAS.map(sem => {
            const naSemana = pecas.filter(p => p.dia >= sem.de && p.dia <= sem.ate).length;
            const sit = dmmmSituacaoSemana(sem, hoje);
            const corrente = hoje >= sem.de && hoje <= sem.ate;
            return (
              <div key={sem.n} style={{
                background: 'var(--app-surface-2)', borderRadius: 'var(--app-radius-lg)',
                border: `1px solid ${corrente ? 'rgba(249,182,79,.45)' : 'var(--app-border)'}`,
                padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', fontFamily: 'Roboto, sans-serif' }}>
                    Semana {sem.n}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'Roboto, sans-serif' }}>
                    {dmmmFmt(sem.de)} a {dmmmFmt(sem.ate)}
                  </span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 600, color: naSemana ? 'var(--app-primary)' : 'var(--text-3)',
                  fontFamily: 'Roboto, sans-serif', lineHeight: 1 }}>
                  {naSemana}
                  <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 400 }}> conteúdos</span>
                </div>
                <window.Badge tone={sit.tom}>{sit.texto}</window.Badge>
                <window.Btn variant="ghost" size="sm" icon={copiado === sem.n ? 'check' : 'copy'}
                  onClick={() => copiarSemana(sem)}>
                  {copiado === sem.n ? 'Copiado' : 'Copiar links'}
                </window.Btn>
              </div>
            );
          })}
        </div>
      </window.SectionCard>

      <window.SectionCard title={`Criativos do desafio (${total})`} icon="trophy"
        headerRight={salvando ? <span style={{ fontSize: 12, color: 'var(--text-3)' }}>salvando</span> : null}>
        {carregando ? (
          <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Carregando.</div>
        ) : pecas.length === 0 ? (
          <div style={{ color: 'var(--text-3)', fontSize: 13 }}>
            Nenhum criativo vinculado ainda. Use o botão Vincular criativo e escolha o card e o dia.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 16 }}>
            {pecas.map(p => (
              <DmmmPeca key={`${p.tipo}:${p.numero}`} p={p}
                onAbrir={abrirCard} onEditar={setModal} onSoltar={soltar}/>
            ))}
          </div>
        )}
      </window.SectionCard>

      {candidatos.length > 0 && (
        <window.SectionCard title={`Publicados na janela e fora do desafio (${candidatos.length})`}
          icon="leaf" recolhivel idRecolher="desafio-candidatos">
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 12, fontFamily: 'Roboto,sans-serif' }}>
            Saiu no ar entre {dmmmFmt(DMMM_INICIO)} e {dmmmFmt(DMMM_FIM)} e não está no desafio. Clique pra vincular.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {candidatos.map(c => (
              <button key={c.numero}
                onClick={() => setModal({ tipo: 'ORG', numero: c.numero, dia: c.dia, mandala: '' })}
                title={c.tema || ''}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 10px',
                  borderRadius: 999, border: '1px solid var(--app-border)', background: 'var(--app-bg)',
                  color: 'var(--text-2)', fontSize: 12, fontFamily: 'Roboto,sans-serif', cursor: 'pointer' }}>
                <window.LucideIcon icon="plus" size={12}/>
                ORG {c.numero} · {dmmmFmt(c.dia)}
              </button>
            ))}
          </div>
        </window.SectionCard>
      )}

      <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'Roboto, sans-serif' }}>
        Entra no desafio só o que for vinculado aqui, um por dia. Alcance e interações vêm da coleta
        diária de métricas do Instagram, então peça publicada hoje pode aparecer sem número até a
        próxima varredura.
      </div>

      <DmmmModal aberto={!!modal} inicial={modal} organico={organico} anuncios={anuncios}
        jaVinculados={jaVinculados} onFechar={() => setModal(null)} onSalvar={salvarVinculo}/>
    </window.PageBody>
  );
}

Object.assign(window, { DesafioScreen });
