/* ================================================================
   Tracker FMN — Desafio MMM (Mandala Mão na Massa)
   30 conteúdos em 30 dias, 21/10 a 21/11/2026.
   Regras e registro em tracker-fmn/DESAFIO-MANDALA-MAO-NA-MASSA.md

   O que conta para o desafio é derivado, não marcado à mão: todo card do
   Orgânico publicado dentro da janela entra, e todo anúncio criado dentro
   dela também. Assim nenhum conteúdo publicado fica de fora por esquecimento
   de marcar uma caixinha, e não foi preciso coluna nova no banco.

   Nomes com prefixo DMMM_ de propósito: tudo aqui vira global depois do
   Babel, e nome genérico atropela o de outra tela em silêncio.
   ================================================================ */
const { useState: useDS, useEffect: useDE, useMemo: useDM } = React;

const DMMM_INICIO = '2026-10-21';
const DMMM_FIM    = '2026-11-21';
const DMMM_META   = 30;
const DMMM_PONTOS_POR_CONTEUDO = 10;

/* As quatro semanas e a janela de 48 horas de cada formulário. */
const DMMM_SEMANAS = [
  { n: 1, de: '2026-10-21', ate: '2026-10-28', abre: '2026-10-29', fecha: '2026-10-30' },
  { n: 2, de: '2026-10-29', ate: '2026-11-05', abre: '2026-11-06', fecha: '2026-11-07' },
  { n: 3, de: '2026-11-06', ate: '2026-11-13', abre: '2026-11-14', fecha: '2026-11-15' },
  { n: 4, de: '2026-11-14', ate: '2026-11-21', abre: '2026-11-22', fecha: '2026-11-23' },
];

const DMMM_LINK_DESAFIO = 'https://mandala-mao-na-massa.vercel.app/';

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
function dmmmFmt(dia) {
  if (!dia) return '—';
  const [a, m, d] = dia.split('-');
  return `${d}/${m}`;
}
function dmmmDiasEntre(de, ate) {
  return Math.round((new Date(ate + 'T12:00:00') - new Date(de + 'T12:00:00')) / 86400000);
}
function dmmmNum(v) {
  return (v == null ? 0 : Number(v)).toLocaleString('pt-BR');
}

/* Situação do formulário de cada semana, pela data de hoje. */
function dmmmSituacaoSemana(sem, hoje) {
  if (hoje < sem.abre)  return { texto: `Formulário abre ${dmmmFmt(sem.abre)}`, tom: 'default' };
  if (hoje <= sem.fecha) return { texto: `Formulário aberto até ${dmmmFmt(sem.fecha)}`, tom: 'warning' };
  return { texto: `Formulário fechou ${dmmmFmt(sem.fecha)}`, tom: 'default' };
}

function DesafioScreen({ onNavigate }) {
  const [organico, setOrganico] = useDS([]);
  const [anuncios, setAnuncios] = useDS([]);
  const [metricas, setMetricas] = useDS({});   // meta_media_id → snapshot mais recente
  const [carregando, setCarregando] = useDS(true);
  const [copiado, setCopiado] = useDS(null);

  const hoje = dmmmHoje();

  useDE(() => {
    if (!window.db) return;
    let vivo = true;
    (async () => {
      const [org, ads, mets] = await Promise.all([
        window.buscarTudo(() => window.db.from('conteudo_organico')
          .select('numero,tema,plataforma,status,published_at,scheduled_at,data_prevista,meta_media_id,referencia,youtube_video_id')),
        window.buscarTudo(() => window.db.from('ads')
          .select('numero,titulo,tipo,status,created_at,produto,gasto_total,vendas_total,cpa_historico,meta_ad_url')),
        window.buscarTudo(() => window.db.from('organico_metricas')
          .select('meta_media_id,permalink,reach,likes,comments,saved,shares,total_interactions,follows,video_views,data')
          .order('data', { ascending: false })),
      ]);
      if (!vivo) return;
      const porMedia = {};
      for (const m of (mets || [])) if (!porMedia[m.meta_media_id]) porMedia[m.meta_media_id] = m;
      setOrganico(org || []);
      setAnuncios(ads || []);
      setMetricas(porMedia);
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, []);

  /* Publicados dentro da janela do desafio, mais novo primeiro. */
  const publicados = useDM(() => (organico || [])
    .map(c => ({ ...c, dia: dmmmDia(c.published_at) }))
    .filter(c => c.dia && c.dia >= DMMM_INICIO && c.dia <= DMMM_FIM)
    .sort((a, b) => b.dia.localeCompare(a.dia) || (b.numero - a.numero)),
  [organico]);

  /* Anúncios criados dentro da janela: também valem pontos no desafio. */
  const adsDoDesafio = useDM(() => (anuncios || [])
    .map(a => ({ ...a, dia: dmmmDia(a.created_at) }))
    .filter(a => a.dia && a.dia >= DMMM_INICIO && a.dia <= DMMM_FIM)
    .sort((a, b) => b.dia.localeCompare(a.dia) || (b.numero - a.numero)),
  [anuncios]);

  /* Fila: card montado que ainda não foi ao ar. É o que falta gravar. */
  const fila = useDM(() => (organico || [])
    .filter(c => !c.published_at && c.status !== 'Arquivado')
    .sort((a, b) => (b.numero || 0) - (a.numero || 0)),
  [organico]);

  const totalFeitos = publicados.length + adsDoDesafio.length;
  const pontos = totalFeitos * DMMM_PONTOS_POR_CONTEUDO;
  const faltam = Math.max(0, DMMM_META - totalFeitos);
  const diasRestantes = Math.max(0, dmmmDiasEntre(hoje, DMMM_FIM));
  const ritmo = diasRestantes > 0 ? (faltam / diasRestantes) : 0;

  /* Soma das métricas de quem já tem número coletado. */
  const soma = useDM(() => {
    const s = { reach: 0, interacoes: 0, saved: 0, shares: 0, follows: 0, comMetrica: 0 };
    for (const c of publicados) {
      const m = metricas[c.meta_media_id];
      if (!m) continue;
      s.comMetrica++;
      s.reach      += Number(m.reach || 0);
      s.interacoes += Number(m.total_interactions || 0);
      s.saved      += Number(m.saved || 0);
      s.shares     += Number(m.shares || 0);
      s.follows    += Number(m.follows || 0);
    }
    return s;
  }, [publicados, metricas]);

  function linkDoCard(c) {
    const m = metricas[c.meta_media_id];
    if (m?.permalink) return m.permalink;
    if (c.youtube_video_id) return `https://www.youtube.com/watch?v=${c.youtube_video_id}`;
    return null;
  }

  /* Copia os links da semana no formato que o formulário pede. */
  function copiarSemana(sem) {
    const linhas = publicados
      .filter(c => c.dia >= sem.de && c.dia <= sem.ate)
      .map(c => {
        const l = linkDoCard(c);
        return `ORG ${c.numero} · ${c.tema || 'sem tema'} · ${dmmmFmt(c.dia)}${l ? ` · ${l}` : ' · (link pendente)'}`;
      });
    const dosAds = adsDoDesafio
      .filter(a => a.dia >= sem.de && a.dia <= sem.ate)
      .map(a => `ADS ${a.numero} · ${a.titulo || 'sem título'} · ${dmmmFmt(a.dia)}${a.meta_ad_url ? ` · ${a.meta_ad_url}` : ''}`);
    const texto = [...linhas, ...dosAds].join('\n') || 'Nenhum conteúdo nesta semana ainda.';
    navigator.clipboard?.writeText(texto);
    setCopiado(sem.n);
    setTimeout(() => setCopiado(null), 2500);
  }

  const th = { textAlign: 'left', padding: '8px 10px', fontSize: 12, fontWeight: 600,
    color: 'var(--text-3)', fontFamily: 'Roboto, sans-serif', whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--app-border)' };
  const td = { padding: '10px', fontSize: 13, color: 'var(--text-1)',
    fontFamily: 'Roboto, sans-serif', borderBottom: '1px solid var(--app-border)',
    verticalAlign: 'middle' };
  const tdNum = { ...td, textAlign: 'right', whiteSpace: 'nowrap' };

  return (
    <window.PageBody maxWidth={1280}>
      <window.PageHeader
        title="Desafio MMM"
        description={`Mandala Mão na Massa. ${DMMM_META} conteúdos entre ${dmmmFmt(DMMM_INICIO)} e ${dmmmFmt(DMMM_FIM)}, ${DMMM_PONTOS_POR_CONTEUDO} pontos cada.`}
        actions={
          <window.Btn variant="ghost" icon="external-link"
            onClick={() => window.open(DMMM_LINK_DESAFIO, '_blank')}>
            Página do desafio
          </window.Btn>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <window.CardKPI label="Publicados" value={`${totalFeitos}/${DMMM_META}`} icon="check-circle" accent
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

      {/* Barra de progresso do desafio */}
      <div style={{ height: 8, borderRadius: 999, background: 'var(--app-surface-2)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, (totalFeitos / DMMM_META) * 100)}%`,
          background: 'var(--app-primary)', transition: 'width 300ms' }}/>
      </div>

      <window.SectionCard title="As quatro semanas" icon="calendar-days">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
          {DMMM_SEMANAS.map(sem => {
            const naSemana = publicados.filter(c => c.dia >= sem.de && c.dia <= sem.ate).length
                           + adsDoDesafio.filter(a => a.dia >= sem.de && a.dia <= sem.ate).length;
            const sit = dmmmSituacaoSemana(sem, hoje);
            const corrente = hoje >= sem.de && hoje <= sem.ate;
            return (
              <div key={sem.n} style={{
                background: 'var(--app-surface-2)', borderRadius: 'var(--app-radius-lg)',
                border: `1px solid ${corrente ? 'rgba(249,182,79,.45)' : 'var(--app-border)'}`,
                padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)',
                    fontFamily: 'Roboto, sans-serif' }}>
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

      <window.SectionCard title={`Publicados no desafio (${publicados.length})`} icon="leaf" noPad>
        {carregando ? (
          <div style={{ padding: 20, color: 'var(--text-3)', fontSize: 13 }}>Carregando.</div>
        ) : publicados.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--text-3)', fontSize: 13 }}>
            Nada publicado na janela ainda. O primeiro card que for ao ar a partir de {dmmmFmt(DMMM_INICIO)} aparece aqui sozinho.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Dia</th>
                  <th style={th}>Card</th>
                  <th style={th}>Formato</th>
                  <th style={th}>Tema</th>
                  <th style={{ ...th, textAlign: 'right' }}>Alcance</th>
                  <th style={{ ...th, textAlign: 'right' }}>Interações</th>
                  <th style={{ ...th, textAlign: 'right' }}>Salvos</th>
                  <th style={{ ...th, textAlign: 'right' }}>Compart.</th>
                  <th style={{ ...th, textAlign: 'right' }}>Seguidores</th>
                  <th style={th}>Post</th>
                </tr>
              </thead>
              <tbody>
                {publicados.map(c => {
                  const m = metricas[c.meta_media_id];
                  const link = linkDoCard(c);
                  return (
                    <tr key={c.numero}>
                      <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--text-2)' }}>{dmmmFmt(c.dia)}</td>
                      <td style={td}>
                        <button onClick={() => onNavigate && onNavigate('organico', c.numero)}
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                            color: 'var(--app-primary)', fontFamily: 'Roboto, sans-serif',
                            fontSize: 13, fontWeight: 600 }}>
                          ORG {c.numero}
                        </button>
                      </td>
                      <td style={td}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                          color: window.PLAT_COLOR?.[c.plataforma] || 'var(--text-2)' }}>
                          <window.LucideIcon icon={window.PLAT_ICON?.[c.plataforma] || 'file'} size={13}/>
                          {c.plataforma || '—'}
                        </span>
                      </td>
                      <td style={{ ...td, maxWidth: 280 }}>{c.tema || '—'}</td>
                      <td style={tdNum}>{m ? dmmmNum(m.reach) : '—'}</td>
                      <td style={tdNum}>{m ? dmmmNum(m.total_interactions) : '—'}</td>
                      <td style={tdNum}>{m ? dmmmNum(m.saved) : '—'}</td>
                      <td style={tdNum}>{m ? dmmmNum(m.shares) : '—'}</td>
                      <td style={tdNum}>{m ? dmmmNum(m.follows) : '—'}</td>
                      <td style={td}>
                        {link
                          ? <a href={link} target="_blank" rel="noreferrer"
                              style={{ color: 'var(--app-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <window.LucideIcon icon="external-link" size={13}/>abrir
                            </a>
                          : <span style={{ color: 'var(--text-3)' }}>sem link</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </window.SectionCard>

      {adsDoDesafio.length > 0 && (
        <window.SectionCard title={`Anúncios criados na janela (${adsDoDesafio.length})`} icon="clapperboard" noPad>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Dia</th>
                  <th style={th}>Card</th>
                  <th style={th}>Produto</th>
                  <th style={th}>Título</th>
                  <th style={{ ...th, textAlign: 'right' }}>Gasto</th>
                  <th style={{ ...th, textAlign: 'right' }}>Vendas</th>
                  <th style={{ ...th, textAlign: 'right' }}>Custo por venda</th>
                  <th style={th}>Anúncio</th>
                </tr>
              </thead>
              <tbody>
                {adsDoDesafio.map(a => (
                  <tr key={a.numero}>
                    <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--text-2)' }}>{dmmmFmt(a.dia)}</td>
                    <td style={td}>
                      <button onClick={() => onNavigate && onNavigate('criativos', a.numero)}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                          color: 'var(--app-primary)', fontFamily: 'Roboto, sans-serif',
                          fontSize: 13, fontWeight: 600 }}>
                        ADS {a.numero}
                      </button>
                    </td>
                    <td style={td}>{a.produto || 'MCV'}</td>
                    <td style={{ ...td, maxWidth: 280 }}>{a.titulo || '—'}</td>
                    <td style={tdNum}>{a.gasto_total ? window.fmtBRL(a.gasto_total) : '—'}</td>
                    <td style={tdNum}>{dmmmNum(a.vendas_total)}</td>
                    <td style={tdNum}>{a.cpa_historico ? window.fmtBRL(a.cpa_historico) : '—'}</td>
                    <td style={td}>
                      {a.meta_ad_url
                        ? <a href={a.meta_ad_url} target="_blank" rel="noreferrer"
                            style={{ color: 'var(--app-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <window.LucideIcon icon="external-link" size={13}/>abrir
                          </a>
                        : <span style={{ color: 'var(--text-3)' }}>sem link</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </window.SectionCard>
      )}

      <window.SectionCard title={`Na fila, montados e ainda sem publicar (${fila.length})`}
        icon="list-todo" recolhivel idRecolher="desafio-fila" noPad>
        {fila.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--text-3)', fontSize: 13 }}>A fila está vazia.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Card</th>
                  <th style={th}>Formato</th>
                  <th style={th}>Tema</th>
                  <th style={th}>Coluna</th>
                  <th style={th}>Previsto</th>
                </tr>
              </thead>
              <tbody>
                {fila.map(c => (
                  <tr key={c.numero}>
                    <td style={td}>
                      <button onClick={() => onNavigate && onNavigate('organico', c.numero)}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                          color: 'var(--app-primary)', fontFamily: 'Roboto, sans-serif',
                          fontSize: 13, fontWeight: 600 }}>
                        ORG {c.numero}
                      </button>
                    </td>
                    <td style={td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                        color: window.PLAT_COLOR?.[c.plataforma] || 'var(--text-2)' }}>
                        <window.LucideIcon icon={window.PLAT_ICON?.[c.plataforma] || 'file'} size={13}/>
                        {c.plataforma || '—'}
                      </span>
                    </td>
                    <td style={{ ...td, maxWidth: 320 }}>{c.tema || '—'}</td>
                    <td style={td}><window.Badge>{c.status || '—'}</window.Badge></td>
                    <td style={{ ...td, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                      {c.scheduled_at ? dmmmFmt(dmmmDia(c.scheduled_at))
                        : c.data_prevista ? dmmmFmt(String(c.data_prevista).slice(0, 10))
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </window.SectionCard>

      <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'Roboto, sans-serif' }}>
        Entra aqui sozinho todo card do Orgânico publicado entre {dmmmFmt(DMMM_INICIO)} e {dmmmFmt(DMMM_FIM)},
        mais todo anúncio criado na mesma janela. Alcance e interações vêm da coleta diária de métricas do
        Instagram, então um post de hoje pode aparecer sem número até a próxima coleta.
      </div>
    </window.PageBody>
  );
}

Object.assign(window, { DesafioScreen });
