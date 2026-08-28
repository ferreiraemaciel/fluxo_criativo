/* ================================================================
   Tracker FMN — Funis v3
   Sala de controle do quiz Fotógrafo Protegido.
   Pizza padrão interativa, abandono e série refeitos, métricas e
   cruzamentos, comparação com período anterior e insight do dia.
   ================================================================ */
const { useState, useEffect } = React;
const { LucideIcon, CardKPI, SectionCard, TopBar } = window;

const nf = n => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));
const pc = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const PALETTE = ['#eaaa41', '#60a5fa', '#4ade80', '#f472b6', '#a78bfa', '#34d399', '#fbbf24', '#f87171'];
const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const PERIODOS = [
  { id: 'hoje',   label: 'Hoje',          dias: 1    },
  { id: '7d',     label: '7 dias',        dias: 7    },
  { id: '30d',    label: '30 dias',       dias: 30   },
  { id: 'maximo', label: 'Máximo',        dias: null },
  { id: 'custom', label: 'Personalizado', dias: -1   },
];
const today = () => new Date().toISOString().slice(0, 10);
function rangeFromPeriodo(id, customFrom, customTo) {
  if (id === 'custom') return { p_from: customFrom || null, p_to: customTo || null };
  if (id === 'hoje') { const t = today(); return { p_from: t, p_to: t }; }
  const dias = PERIODOS.find(p => p.id === id)?.dias;
  if (!dias) return { p_from: null, p_to: null };
  const to = new Date(); const from = new Date(); from.setDate(from.getDate() - dias);
  const iso = d => d.toISOString().slice(0, 10);
  return { p_from: iso(from), p_to: iso(to) };
}

/* ── Mapa de perguntas do quiz ───────────────────────────────────*/
const PERGUNTAS = [
  { field: 'area_atuacao',       label: 'Área de atuação',                  multi: false },
  { field: 'profissionalizacao',  label: 'É sua principal renda?',           multi: false },
  { field: 'tipo_negocio',        label: 'Tipo de negócio',                  multi: false },
  { field: 'confianca_clientes',  label: 'Confiança com clientes',           multi: false },
  { field: 'situacoes',           label: 'Situações já vividas',             multi: true  },
  { field: 'custo_processo',      label: 'Percepção do custo de um processo', multi: false },
  { field: 'usa_contrato',        label: 'Usa contrato?',                    multi: false },
  { field: 'tipo_contrato_atual', label: 'Tipo de contrato atual',           multi: false },
  { field: 'foco_artistico',      label: 'Foco no trabalho',                 multi: false },
  { field: 'sentimentos',         label: 'Sentimentos no dia a dia',         multi: true  },
  { field: 'protege_dinheiro',    label: 'Contrato te protege financeiramente?', multi: false },
  { field: 'temas_dominados',     label: 'Temas jurídicos dominados',        multi: true  },
  { field: 'entende_contrato',    label: 'Entende o contrato?',              multi: false },
  { field: 'quer_modelos',        label: 'Quer os modelos de contrato?',     multi: false },
  { field: 'nivel_risco',         label: 'Nível de risco',                   multi: false },
];

/* ── Passo de saída ──────────────────────────────────────────────*/
function passoSaida(l) {
  if (l.completou_quiz)            return 'Viu resultado';
  if (l.completou_lead)            return 'Lead completo';
  if (l.email)                     return 'Formulário (e-mail)';
  if (l.quer_modelos)              return 'P14 - quer modelos';
  if (l.entende_contrato)          return 'P13 - entende contrato';
  if (l.temas_dominados)           return 'P12 - temas dominados';
  if (l.protege_dinheiro)          return 'P11 - protege dinheiro';
  if (l.sentimentos)               return 'P10 - sentimentos';
  if (l.foco_artistico)            return 'P9 - foco artístico';
  if (l.tipo_contrato_atual)       return 'P8 - tipo contrato';
  if (l.usa_contrato)              return 'P7 - usa contrato';
  if (l.custo_processo)            return 'P6 - custo processo';
  if (l.situacoes)                 return 'P5 - situações';
  if (l.confianca_clientes)        return 'P4 - confiança';
  if (l.tipo_negocio)              return 'P3 - tipo negócio';
  if (l.profissionalizacao)        return 'P2 - profissionalização';
  if (l.area_atuacao)              return 'P1 - área';
  return 'Início';
}

/* ── Tabela de leads individuais ─────────────────────────────────*/
const WA_SVG = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="#25d366" style={{ flexShrink:0 }}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
);

const abrevArea = v => {
  if (!v) return null;
  const l = v.toLowerCase();
  if ((l.includes('foto') || l.includes('photo')) && (l.includes('film') || l.includes('video') || l.includes('vídeo'))) return 'Foto + Vídeo';
  if (l.includes('foto') || l.includes('photo')) return 'Fotógrafo';
  if (l.includes('film') || l.includes('video') || l.includes('vídeo')) return 'Videomaker';
  return v;
};

const abrevNegocio = (neg, prof) => {
  const src = neg || prof || '';
  const l = src.toLowerCase();
  if (l.includes('mei')) return 'MEI';
  if (l.includes('empresa')) return 'Empresário';
  if (l.includes('autônom') || l.includes('autonom')) return 'Autônomo';
  if (l.includes('amador') || l.includes('hobby')) return 'Amador';
  if (l.includes('principal')) return 'Profissional';
  return src ? src.split(/[,\s]/)[0] : null;
};

const abrevContrato = v => {
  if (!v) return '—';
  const l = v.toLowerCase();
  if (l.includes('whatsapp')) return 'WhatsApp';
  if (l.includes('word')) return 'Word';
  if (l.includes('pdf')) return 'PDF';
  if (l.includes('advogado')) return 'Advogado';
  if (l.includes('não') || l.includes('nao') || l.includes('sem') || l.includes('nem')) return 'Não usa';
  return v.split(/[,\s]/)[0];
};

function LeadsTable({ leads, adsMap = {} }) {
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(0);
  const POR_PAG = 50;

  const filtrados = leads.filter(l => {
    if (!busca) return true;
    const q = busca.toLowerCase();
    return (l.nome||'').toLowerCase().includes(q)
      || (l.email||'').toLowerCase().includes(q)
      || (l.utm_campaign||'').toLowerCase().includes(q);
  });
  const total = filtrados.length;
  const paginas = Math.ceil(total / POR_PAG);
  const slice = filtrados.slice(pagina * POR_PAG, (pagina + 1) * POR_PAG);

  const fmtDate = iso => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  };

  const TH = ({ children, w }) => (
    <th style={{ padding:'8px 10px', textAlign:'left', fontSize:10, fontFamily:'Roboto,sans-serif',
      fontWeight:700, letterSpacing:'0.1em', color:'var(--text-3)', textTransform:'uppercase',
      whiteSpace:'nowrap', width:w, borderBottom:'1px solid var(--app-border)' }}>
      {children}
    </th>
  );
  const TD = ({ children, style }) => (
    <td style={{ padding:'9px 10px', fontSize:11.5, fontFamily:'Roboto,sans-serif',
      color:'var(--text-2)', borderBottom:'1px solid rgba(255,255,255,.04)', verticalAlign:'middle', ...style }}>
      {children}
    </td>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {/* Barra de busca + contador */}
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ position:'relative', flex:1, maxWidth:320 }}>
          <LucideIcon icon="search" size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)' }}/>
          <input value={busca} onChange={e => { setBusca(e.target.value); setPagina(0); }}
            placeholder="Buscar por nome, e-mail ou campanha..."
            style={{ width:'100%', boxSizing:'border-box', paddingLeft:30, paddingRight:10,
              paddingTop:8, paddingBottom:8, borderRadius:8,
              background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.1)',
              color:'#fff', fontFamily:'Roboto,sans-serif', fontSize:12, outline:'none' }}/>
        </div>
        <span style={{ fontSize:11, color:'var(--text-3)', fontFamily:'Roboto,sans-serif' }}>
          {nf(total)} leads
        </span>
      </div>

      {/* Tabela */}
      <div style={{ overflowX:'auto', borderRadius:10, border:'1px solid var(--app-border)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead style={{ background:'rgba(255,255,255,.03)' }}>
            <tr>
              <TH w={140}>Nome</TH>
              <TH w={105}>WhatsApp</TH>
              <TH w={180}>E-mail</TH>
              <TH w={120}>Perfil</TH>
              <TH w={60}>Lead?</TH>
              <TH w={150}>Passo de saída</TH>
              <TH w={100}>Usa contrato</TH>
              <TH w={100}>Tipo contrato</TH>
              <TH w={85}>Dispositivo</TH>
              <TH w={130}>Data</TH>
              <TH w={170}>Criativo</TH>
              <TH>Campanha</TH>
            </tr>
          </thead>
          <tbody>
            {slice.map((l, i) => {
              const passo = passoSaida(l);
              const waNum = l.whatsapp ? l.whatsapp.replace(/\D/g,'') : null;
              const waHref = waNum ? `https://wa.me/${waNum.startsWith('55') ? waNum : '55'+waNum}` : null;
              const area = abrevArea(l.area_atuacao);
              const neg  = abrevNegocio(l.tipo_negocio, l.profissionalizacao);
              return (
                <tr key={l.id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.015)' }}>
                  <TD><span style={{ fontWeight:700, color:'var(--text-1)' }}>{l.nome || '—'}</span></TD>
                  <TD style={{ fontSize:11 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:60 }}>{l.whatsapp || '—'}</span>
                      {waHref && (
                        <a href={waHref} target="_blank" rel="noreferrer"
                          style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
                            width:24, height:24, borderRadius:6, flexShrink:0,
                            background:'rgba(37,211,102,.1)', border:'1px solid rgba(37,211,102,.2)',
                            textDecoration:'none' }}>
                          {WA_SVG}
                        </a>
                      )}
                    </div>
                  </TD>
                  <TD style={{ fontSize:11 }}>{l.email || '—'}</TD>
                  <TD>
                    <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                      {area && <span style={{ fontSize:11, color:'var(--text-1)', fontWeight:600 }}>{area}</span>}
                      {neg  && <span style={{ fontSize:10, color:'var(--text-3)' }}>{neg}</span>}
                      {!area && !neg && <span style={{ color:'var(--text-3)' }}>—</span>}
                    </div>
                  </TD>
                  <TD>
                    <span style={{ color: l.completou_lead ? '#4ade80' : 'var(--text-3)', fontWeight:700 }}>
                      {l.completou_lead ? 'Sim' : 'Não'}
                    </span>
                  </TD>
                  <TD style={{ fontSize:10.5 }}>{passo}</TD>
                  <TD style={{ fontSize:10.5 }}>{l.usa_contrato || '—'}</TD>
                  <TD style={{ fontSize:10.5 }}>{abrevContrato(l.tipo_contrato_atual)}</TD>
                  <TD style={{ fontSize:10.5 }}>{l.device_platform || '—'}</TD>
                  <TD style={{ fontSize:10.5 }}>{fmtDate(l.created_at)}</TD>
                  <TD>
                    {(() => {
                      const rawContent = String(l.utm_content || '');
                      const adKey = rawContent.includes('|') ? rawContent.split('|').pop().trim() : rawContent;
                      const ad = adsMap[adKey];
                      if (!ad) return <span style={{ color:'var(--text-3)', fontSize:10.5 }}>—</span>;
                      const thumbUrl = window.melhorThumbAd(ad.thumb_url, ad.media_files, ad.media_drive_url);
                      return (
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:36, height:36, borderRadius:6, overflow:'hidden', background:'rgba(255,255,255,.06)', flexShrink:0 }}>
                            {thumbUrl
                              ? <img src={thumbUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
                                  onError={e => { e.target.style.display='none'; }}/>
                              : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, color:'var(--text-3)', fontWeight:700 }}>
                                  {String(ad.titulo||'').slice(0,3).toUpperCase()}
                                </div>
                            }
                          </div>
                          <span style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', color:'var(--text-2)', lineHeight:1.3,
                            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:116 }}
                            title={ad.titulo}>
                            {ad.titulo || `ADS ${ad.numero}`}
                          </span>
                        </div>
                      );
                    })()}
                  </TD>
                  <TD style={{ fontSize:10.5 }}>{l.utm_campaign || <span style={{ color:'var(--text-3)' }}>orgânico</span>}</TD>
                </tr>
              );
            })}
            {slice.length === 0 && (
              <tr><td colSpan={12} style={{ padding:'32px 0', textAlign:'center', color:'var(--text-3)', fontFamily:'Roboto,sans-serif', fontSize:12 }}>Nenhum lead encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {paginas > 1 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
          <button onClick={() => setPagina(p => Math.max(0, p-1))} disabled={pagina === 0}
            style={{ padding:'5px 12px', borderRadius:6, border:'1px solid var(--app-border)',
              background:'rgba(255,255,255,.04)', color:'var(--text-2)', cursor:'pointer',
              fontFamily:'Roboto,sans-serif', fontSize:11, fontWeight:700 }}>← Anterior</button>
          <span style={{ fontSize:11, color:'var(--text-3)', fontFamily:'Roboto,sans-serif' }}>
            Página {pagina+1} de {paginas}
          </span>
          <button onClick={() => setPagina(p => Math.min(paginas-1, p+1))} disabled={pagina >= paginas-1}
            style={{ padding:'5px 12px', borderRadius:6, border:'1px solid var(--app-border)',
              background:'rgba(255,255,255,.04)', color:'var(--text-2)', cursor:'pointer',
              fontFamily:'Roboto,sans-serif', fontSize:11, fontWeight:700 }}>Próxima →</button>
        </div>
      )}
    </div>
  );
}

/* ── Breakdown por pergunta ──────────────────────────────────────*/
function LeadsByQuestion({ leads }) {
  const [pergAtiva, setPergAtiva] = useState(PERGUNTAS[0].field);
  const perg = PERGUNTAS.find(p => p.field === pergAtiva);

  // Contar respostas
  const contagem = {};
  leads.forEach(l => {
    const val = l[perg.field];
    if (!val) return;
    if (perg.multi && Array.isArray(val)) {
      val.forEach(v => { contagem[v] = (contagem[v] || 0) + 1; });
    } else if (typeof val === 'string') {
      contagem[val] = (contagem[val] || 0) + 1;
    }
  });
  const sorted = Object.entries(contagem).sort((a,b) => b[1]-a[1]);
  const maxN = sorted[0]?.[1] || 1;
  const totalResp = perg.multi
    ? sorted.reduce((s,[,n]) => s+n, 0)
    : leads.filter(l => l[perg.field]).length;

  return (
    <div style={{ display:'flex', gap:16, minHeight:0 }}>
      {/* Lista de perguntas (sidebar) */}
      <div style={{ width:220, flexShrink:0, display:'flex', flexDirection:'column', gap:3 }}>
        {PERGUNTAS.map(p => (
          <button key={p.field} onClick={() => setPergAtiva(p.field)}
            style={{ textAlign:'left', padding:'8px 10px', borderRadius:8, cursor:'pointer',
              background: pergAtiva === p.field ? 'rgba(234,170,65,.12)' : 'rgba(255,255,255,.03)',
              border: `1px solid ${pergAtiva === p.field ? 'rgba(234,170,65,.3)' : 'transparent'}`,
              color: pergAtiva === p.field ? 'var(--fmn-gold)' : 'var(--text-2)',
              fontFamily:'Roboto,sans-serif', fontSize:11.5, fontWeight: pergAtiva === p.field ? 700 : 400,
              transition:'all 120ms' }}>
            {p.label}
            {p.multi && <span style={{ marginLeft:5, fontSize:9, color:'var(--text-3)', fontWeight:400 }}>múltipla</span>}
          </button>
        ))}
      </div>

      {/* Respostas da pergunta selecionada */}
      <div style={{ flex:1, background:'var(--app-surface)', borderRadius:14, padding:'16px 18px', overflowY:'auto' }}>
        <div style={{ fontSize:13, fontWeight:700, fontFamily:'Roboto,sans-serif', color:'var(--text-1)', marginBottom:4 }}>
          {perg.label}
        </div>
        <div style={{ fontSize:10.5, color:'var(--text-3)', fontFamily:'Roboto,sans-serif', marginBottom:14 }}>
          {nf(totalResp)} menções · {nf(leads.length)} leads no período
          {perg.multi && ' · pergunta de múltipla escolha'}
        </div>
        {sorted.length === 0
          ? <div style={{ textAlign:'center', padding:'32px 0', color:'var(--text-3)', fontSize:12 }}>Sem dados para o período.</div>
          : sorted.map(([val, n], i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'5px 0' }}>
              <div style={{ width:20, height:20, borderRadius:5, background:PALETTE[i % PALETTE.length] + '22',
                border:`1px solid ${PALETTE[i % PALETTE.length]}44`, display:'flex', alignItems:'center',
                justifyContent:'center', fontSize:9, fontWeight:900, color:PALETTE[i % PALETTE.length], flexShrink:0 }}>
                {i+1}
              </div>
              <div style={{ flex:1, fontSize:12, fontFamily:'Roboto,sans-serif', color:'var(--text-2)', lineHeight:1.4 }}>
                {val}
              </div>
              <div style={{ width:140, height:16, background:'rgba(255,255,255,.04)', borderRadius:5, overflow:'hidden', flexShrink:0 }}>
                <div style={{ width:(n/maxN*100)+'%', height:'100%', background:PALETTE[i%PALETTE.length], borderRadius:5 }}/>
              </div>
              <div style={{ width:70, textAlign:'right', flexShrink:0 }}>
                <span style={{ fontSize:13, fontWeight:900, fontFamily:'Roboto,sans-serif', color:'var(--text-1)' }}>
                  {Math.round(n/totalResp*100)}%
                </span>
                <span style={{ fontSize:9.5, color:'var(--text-3)', marginLeft:4 }}>{nf(n)}</span>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

/* ── arco de rosca ── */
function arcPath(cx, cy, R, r, a0, a1) {
  const p = (a, rad) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
  const large = (a1 - a0) > Math.PI ? 1 : 0;
  const [x0, y0] = p(a0, R), [x1, y1] = p(a1, R), [x2, y2] = p(a1, r), [x3, y3] = p(a0, r);
  return `M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 ${large} 0 ${x3},${y3} Z`;
}

function Donut({ items, hov, setHov, respondentes }) {
  const data = (items || []).slice(0, 8);
  const sum = data.reduce((a, b) => a + b.n, 0) || 1;
  const R = 92, r = 52, cx = 100, cy = 100;
  let ang = -Math.PI / 2;
  const slices = data.map((it, i) => {
    const frac = it.n / sum, a0 = ang, a1 = ang + frac * 2 * Math.PI; ang = a1;
    const mid = (a0 + a1) / 2, lr = (R + r) / 2;
    return { ...it, i, a0, a1, frac, lx: cx + lr * Math.cos(mid), ly: cy + lr * Math.sin(mid) };
  });
  return (
    <svg viewBox="0 0 200 200" style={{ width: 200, height: 200, flexShrink: 0 }}>
      {slices.map(s => {
        const dim = hov != null && hov !== s.i;
        return (
          <path key={s.i} d={arcPath(cx, cy, R, r, s.a0, s.a1)}
            fill={PALETTE[s.i % PALETTE.length]} opacity={dim ? 0.28 : 1}
            stroke="var(--app-surface)" strokeWidth="2" style={{ transition: 'opacity .15s', cursor: 'default' }}
            onMouseEnter={() => setHov(s.i)} onMouseLeave={() => setHov(null)} />
        );
      })}
      {slices.filter(s => s.frac >= 0.07).map(s => (
        <text key={'t' + s.i} x={s.lx} y={s.ly} textAnchor="middle" dominantBaseline="central"
          style={{ fontSize: 13, fontWeight: 800, fontFamily: 'Roboto,sans-serif', fill: '#1a1a1a', pointerEvents: 'none' }}>
          {Math.round(s.frac * 100)}%
        </text>
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" style={{ fontSize: 17, fontWeight: 900, fontFamily: 'Roboto,sans-serif', fill: 'var(--text-1)' }}>{nf(respondentes || sum)}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" style={{ fontSize: 9, fontFamily: 'Roboto,sans-serif', fill: 'var(--text-3)' }}>respondentes</text>
    </svg>
  );
}

/* ── card com troca pizza/barras (tamanho fixo, cores sincronizadas) ── */
function VizCard({ title, hint, items, total }) {
  const [view, setView] = useState('pizza');
  const [hov, setHov] = useState(null);
  const data = (items || []).slice(0, 8);
  const sum = data.reduce((a, b) => a + b.n, 0) || 1;
  // O centro do gráfico deve mostrar quantos responderam ESSA pergunta
  // específica, não o total geral do quiz (que é igual pra todo card).
  // sum já é a soma real das respostas dessa pergunta.
  const base = sum || total;
  const max = Math.max(1, ...data.map(i => i.n));
  const Toggle = ({ id, icon }) => (
    <button onClick={() => setView(id)} title={id === 'pizza' ? 'Pizza' : 'Barras'}
      style={{ width: 27, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        background: view === id ? 'rgba(234,170,65,.15)' : 'transparent',
        border: `1px solid ${view === id ? 'rgba(234,170,65,.3)' : 'var(--app-border)'}`,
        color: view === id ? 'var(--fmn-gold)' : 'var(--text-3)' }}>
      <LucideIcon icon={icon} size={13} /></button>
  );
  return (
    <SectionCard title={title}
      headerRight={<div style={{ display: 'flex', gap: 4 }}><Toggle id="pizza" icon="pie-chart" /><Toggle id="bar" icon="bar-chart-3" /></div>}>
      {hint && <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontFamily: 'Roboto,sans-serif', marginTop: -4, marginBottom: 6 }}>{hint}</div>}
      <div style={{ minHeight: 212 }}>
        {!data.length ? <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 11.5 }}>Sem dados no período.</div>
          : view === 'pizza' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Donut items={data} hov={hov} setHov={setHov} respondentes={base} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                {data.map((it, i) => (
                  <div key={i} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, opacity: hov != null && hov !== i ? 0.4 : 1, transition: 'opacity .15s' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
                    <span title={it.val} style={{ flex: 1, color: 'var(--text-2)', fontFamily: 'Roboto,sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.val}</span>
                    <span style={{ fontWeight: 900, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif' }}>{Math.round(it.n / sum * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
              {data.map((it, i) => (
                <div key={i} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', opacity: hov != null && hov !== i ? 0.4 : 1, transition: 'opacity .15s' }}>
                  <div style={{ width: 150, flexShrink: 0, fontSize: 11, color: 'var(--text-2)', fontFamily: 'Roboto,sans-serif', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }} title={it.val}>{it.val}</div>
                  <div style={{ flex: 1, height: 16, background: 'rgba(255,255,255,.04)', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ width: Math.max(3, it.n / max * 100) + '%', height: '100%', background: PALETTE[i % PALETTE.length], borderRadius: 5 }} /></div>
                  <div style={{ width: 78, textAlign: 'right' }}>
                    <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif' }}>{Math.round(it.n / base * 100)}%</span>
                    <span style={{ fontSize: 9.5, color: 'var(--text-3)', marginLeft: 4 }}>{nf(it.n)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </SectionCard>
  );
}

/* ── barra simples com cor ── */
function Bar({ label, n, max, pctVal, color, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
      <div style={{ width: 160, flexShrink: 0, fontSize: 11.5, color: 'var(--text-2)', fontFamily: 'Roboto,sans-serif', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{label}</div>
      <div style={{ flex: 1, height: 16, background: 'rgba(255,255,255,.04)', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ width: Math.max(3, (n / max) * 100) + '%', height: '100%', background: color || 'var(--fmn-gold)', borderRadius: 5 }} /></div>
      <div style={{ width: 84, textAlign: 'right', fontFamily: 'Roboto,sans-serif' }}>
        <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--text-1)' }}>{pctVal != null ? pctVal + '%' : nf(n)}</span>
        {sub && <span style={{ fontSize: 9.5, color: 'var(--text-3)', marginLeft: 4 }}>{sub}</span>}
      </div>
    </div>
  );
}

/* ── Recuperação de Venda ──────────────────────────────────────
   Ampliado em 2026-08-26: antes só existia carrinho abandonado (quem chegou
   no checkout da Hotmart e não concluiu, via PURCHASE_OUT_OF_SHOPPING_CART).
   Agora também entra quem virou transação de verdade mas não fechou —
   pendente, recusada, expirada, cancelada, atrasada, bloqueada, pre_aprovada.
   É mais quente que carrinho abandonado (chegou mais longe), então
   fica destacado com a situação real, não só um "abandonou" genérico.
   "Recuperado" = essa mesma pessoa aparece depois em vendas aprovada,
   casando por e-mail.                                                     */
// Busca TODAS as linhas, não só as 1000 primeiras.
//
// O Supabase corta o resultado em 1000 linhas por padrão (limite do
// servidor); o .limit() do client só reduz esse teto, nunca aumenta. Pedir
// .limit(5000) engana: volta 1000 e nada avisa que faltou. Foi o que
// escondia 574 dos 1.574 leads dos últimos 30 dias na aba Leads, e o que
// fazia o badge de contato sumir na Recuperação de Venda.
async function buscarTudo(montarQuery, passo = 1000) {
  const linhas = [];
  for (let pagina = 0; ; pagina++) {
    const { data, error } = await montarQuery().range(pagina * passo, pagina * passo + passo - 1);
    if (error) break;
    linhas.push(...(data || []));
    if (!data || data.length < passo) break;
  }
  return linhas;
}

// Últimos 11 dígitos (DDD+número), ignora diferença de DDI — mesmo critério
// usado no cruzamento server-side (cruzarComQuiz, hotmart-backfill).
const tel11 = s => String(s || '').replace(/\D/g, '').slice(-11);

// Formato de telefone do Khronus (mesma lógica de contratovisual/src/lib/
// khronus-whatsapp.ts e das Edge Functions enviar-recuperacao-khronus /
// khronus-fila-status): 55 + DDD + 8 dígitos, SEM o 9º dígito do celular.
// Descoberto em 2026-08-26: a Ponte só reconhece contato nesse formato,
// diferente de tel11 (usado pra whatsapp_mensagens/API oficial, que mantém
// o 9). Retorna null se não der pra normalizar (telefone incompleto).
// Chave estável pra COMPARAR telefone entre Tracker e Khronus: 55 + DDD +
// últimos 8 dígitos. Não dá pra saber se o número canônico do WhatsApp tem ou
// não o nono dígito (bug real de 2026-08-27: Elisabete Petry é 51 92000-4406,
// e remover o 9 gerava 51 2000-4406, número que não existe), então a
// comparação ignora esse dígito em vez de tentar adivinhar.
const chaveTel = raw => {
  let d = String(raw || '').replace(/\D/g, '');
  d = d.startsWith('55') && d.length > 11 ? d.slice(2) : d;
  if (d.length < 10) return null;
  return '55' + d.slice(0, 2) + d.slice(-8);
};

// As duas formas possíveis, pra CONSULTAR: contato pode estar salvo com ou
// sem o 9. Quem decide qual é a real é o WhatsApp, na Ponte.
const variantesTel = raw => {
  let d = String(raw || '').replace(/\D/g, '');
  d = d.startsWith('55') && d.length > 11 ? d.slice(2) : d;
  if (d.length < 10) return [];
  const ddd = d.slice(0, 2), fim = d.slice(-8);
  return [`55${ddd}9${fim}`, `55${ddd}${fim}`];
};

const SITUACAO_INFO = {
  abandonou:    { label: 'Abandonou o carrinho', cor: '#94a3b8' },
  pendente:     { label: 'Pagamento pendente',   cor: '#fbbf24' },
  recusada:     { label: 'Cartão recusado',      cor: '#f87171' },
  expirada:     { label: 'Boleto vencido',       cor: '#f87171' },
  cancelada:    { label: 'Cancelada',            cor: '#f87171' },
  atrasada:     { label: 'Pagamento atrasado',   cor: '#fbbf24' },
  bloqueada:    { label: 'Bloqueada',            cor: '#f87171' },
  pre_aprovada: { label: 'Pré-aprovada',         cor: '#60a5fa' },
  recuperacao:  { label: 'Em recuperação',       cor: '#fbbf24' },
};

// Uma mensagem por situação, cada uma argumentando o motivo específico —
// combinado com Felipe em 2026-08-26: tom solto, de conversa mesmo, não é
// copy de venda. Envia pelo número de suporte, via fila do Khronus (Ponte,
// WhatsApp Web automatizado — não é a API oficial, essa é a linha do
// Claudinho). Ver enviar-recuperacao-khronus/index.ts.
// Nome do produto pra usar dentro da mensagem, nas duas formas que o texto
// precisa: com artigo ("o Blindagem") e com a preposição ("do Blindagem").
// Vem do `produto_nome` da venda/abandono, que é texto livre da Hotmart.
// Corrigido em 2026-08-28: antes as mensagens diziam "Modelos de Contrato
// Visual" fixo, então quem abandonou o Blindagem recebia mensagem falando do
// produto errado.
const produtoNaFrase = bruto => {
  const t = String(bruto || '');
  if (/blindagem/i.test(t))                return { o: 'o Blindagem',                do: 'do Blindagem' };
  if (/mensagens\s*que\s*vendem/i.test(t)) return { o: 'o Mensagens que Vendem',    do: 'do Mensagens que Vendem' };
  if (/lightroom/i.test(t))                return { o: 'o Pack Pro Lightroom',       do: 'do Pack Pro Lightroom' };
  if (/natalin/i.test(t))                  return { o: 'os Cenários Natalinos',      do: 'dos Cenários Natalinos' };
  if (/presets/i.test(t))                  return { o: 'o Combo de Presets',         do: 'do Combo de Presets' };
  return { o: 'os Modelos de Contrato Visual', do: 'dos Modelos de Contrato Visual' };
};

const MSG_SITUACAO = {
  abandonou:    (n, p) => `Oi, ${n}. Vi aqui que você chegou a abrir o checkout ${p.do} e não finalizou. Ficou alguma dúvida no meio do caminho ou foi só falta de tempo mesmo?`,
  pendente:     (n, p) => `Oi, ${n}. Seu pagamento ${p.do} ainda está pendente aqui do nosso lado. Se foi Pix ou boleto, às vezes a confirmação demora um pouco. Já conseguiu finalizar ou posso te ajudar com alguma coisa?`,
  recusada:     (n, p) => `Oi, ${n}. Algum imprevisto aconteceu com seu cartão na hora de fechar ${p.o}. Geralmente é algo simples de resolver, limite, dado digitado errado ou o banco barrando por segurança mesmo. Quer que eu gere um link novo pra tentar de novo ou prefere outra forma de pagamento?`,
  expirada:     (n, p) => `Oi, ${n}. O boleto ${p.do} venceu sem pagamento. Vamos dar andamento na evolução do seu negócio, posso emitir um novo link para você?`,
  cancelada:    (n, p) => `Oi, ${n}. Vi que a sua compra ${p.do} acabou sendo cancelada. Rolou algum problema no meio do caminho ou foi decisão sua mesmo? Abre teu coração e me conta, quero te ajudar nisso, ok?`,
  atrasada:     (n, p) => `Oi, ${n}. Seu pagamento ${p.do} está com algum contratempo. Ainda dá tempo de regularizar, quer que eu te mande o link de novo?`,
  bloqueada:    (n, p) => `Oi, ${n}. Sua compra ${p.do} ficou bloqueada por segurança do meio de pagamento. Normalmente é rápido de resolver. Posso te ajudar a tentar de novo?`,
  pre_aprovada: (n, p) => `Oi, ${n}. Sua compra ${p.do} está quase lá, só falta a confirmação final. O que eu posso fazer para te ajudar nisso?`,
  recuperacao:  (n, p) => `Oi, ${n}. Ainda dá tempo de fechar ${p.o}, faltou tão pouco para você ter tanta melhoria aí pro seu lado, então bora finalizarmos essa etapa?`,
};

/* ── Modal de envio (Recuperação de Venda → número de suporte via Khronus) */
function EnviarRecuperacaoModal({ item, onClose }) {
  const primeiroNome = (item.nome || '').trim().split(/\s+/)[0] || 'tudo bem';
  const [corpo, setCorpo] = useState((MSG_SITUACAO[item.situacao] || MSG_SITUACAO.abandonou)(primeiroNome, produtoNaFrase(item.produto_nome)));
  const [status, setStatus] = useState('idle'); // idle | enviando | ok | erro
  const [erro, setErro] = useState('');

  const enviar = async () => {
    setStatus('enviando'); setErro('');
    try {
      const SUPA_URL = window.db?.supabaseUrl || '';
      const SUPA_KEY = window.db?.supabaseKey || '';
      const r = await fetch(`${SUPA_URL}/functions/v1/enviar-recuperacao-khronus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPA_KEY}` },
        body: JSON.stringify({ telefone: item.telefone, nome: item.nome, corpo, produto: item.produto_nome }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.erro) throw new Error(d.erro || `Erro HTTP ${r.status}`);
      setStatus('ok');
    } catch (e) {
      setStatus('erro'); setErro(e.message || 'Não consegui enviar.');
    }
  };

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:900,
      display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:440, background:'var(--app-surface)',
        border:'1px solid var(--app-border)', borderRadius:14, padding:22, display:'flex', flexDirection:'column', gap:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:14, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-1)' }}>
              Mandar mensagem de recuperação
            </div>
            <div style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'var(--text-3)' }}>
              Número de suporte (Khronus) · {item.nome || item.telefone}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-3)' }}>
            <LucideIcon icon="x" size={16}/>
          </button>
        </div>

        {status === 'ok' ? (
          <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, fontFamily:'Roboto,sans-serif',
            fontWeight:700, color:'var(--clr-pos)' }}>
            <LucideIcon icon="check" size={15}/>
            Colocado na fila do número de suporte.
          </div>
        ) : (<>
          <textarea value={corpo} onChange={e => setCorpo(e.target.value)} rows={6}
            style={{ width:'100%', boxSizing:'border-box', padding:'10px 12px', borderRadius:9,
              background:'var(--app-surface-2)', border:'1px solid var(--app-border)', color:'var(--text-1)',
              fontFamily:'Roboto,sans-serif', fontSize:12.5, lineHeight:1.5, resize:'vertical', outline:'none' }}/>
          <div style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', color:'var(--text-3)', lineHeight:1.5 }}>
            Edite à vontade antes de mandar. Vai pra fila do número de suporte, via Khronus — precisa da
            extensão Ponte conectada nesse número pra sair de verdade.
          </div>
          {erro && (
            <div style={{ padding:'9px 11px', borderRadius:9, background:'rgba(248,113,113,.08)',
              border:'1px solid rgba(248,113,113,.3)', fontSize:11.5, color:'#f87171' }}>{erro}</div>
          )}
          <button onClick={enviar} disabled={status==='enviando' || !item.telefone}
            style={{ padding:'10px', borderRadius:9, border:'none', cursor: item.telefone ? 'pointer':'not-allowed',
              background:'var(--fmn-gold)', color:'var(--fmn-black)', fontFamily:'Roboto,sans-serif',
              fontWeight:700, fontSize:12.5, opacity: status==='enviando' ? .6 : 1,
              display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            <LucideIcon icon={status==='enviando' ? 'loader' : 'send'} size={13}/>
            {!item.telefone ? 'Sem telefone cadastrado' : status==='enviando' ? 'Enviando...' : 'Mandar mensagem'}
          </button>
        </>)}
      </div>
    </div>
  );
}

function CarrinhoTable({ itens, recuperados, contatadosOficial, contatadosSuporte }) {
  const [enviarPara, setEnviarPara] = useState(null); // item | null
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos'); // todos | pendente | recuperado
  const [situacaoFiltro, setSituacaoFiltro] = useState('todas'); // todas | abandonou | pendente | ...

  const fmtData = d => d ? new Date(d).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit' }) : '—';
  const diasAtras = d => {
    if (!d) return null;
    return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  };

  const lista = itens.filter(it => {
    const rec = recuperados.has((it.email || '').trim().toLowerCase());
    if (filtro === 'pendente'   && rec) return false;
    if (filtro === 'recuperado' && !rec) return false;
    if (situacaoFiltro !== 'todas' && it.situacao !== situacaoFiltro) return false;
    if (!busca.trim()) return true;
    const t = busca.trim().toLowerCase();
    return (it.nome || '').toLowerCase().includes(t) || (it.email || '').toLowerCase().includes(t);
  });

  // Contagem por situação, sobre a lista já filtrada por busca/recuperado —
  // pra saber quantos tem em cada opção do dropdown antes de escolher.
  const contagemSituacao = {};
  itens.forEach(it => { contagemSituacao[it.situacao] = (contagemSituacao[it.situacao] || 0) + 1; });

  const th = { padding:'8px 10px', textAlign:'left', fontSize:9.5, fontFamily:'Roboto,sans-serif',
    fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--text-3)', whiteSpace:'nowrap' };
  const td = { padding:'9px 10px', fontSize:12.5, fontFamily:'Roboto,sans-serif', color:'var(--text-2)' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou e-mail..."
          style={{ flex:1, minWidth:200, padding:'8px 12px', borderRadius:8, background:'var(--app-surface-2)',
            border:'1px solid var(--app-border)', color:'var(--text-1)', fontFamily:'Roboto,sans-serif',
            fontSize:12.5, outline:'none' }}/>
        {[['todos','Todos'],['pendente','Não recuperados'],['recuperado','Recuperados']].map(([id,label]) => (
          <button key={id} onClick={() => setFiltro(id)}
            style={{ padding:'7px 14px', borderRadius:999, cursor:'pointer', fontSize:11.5,
              fontFamily:'Roboto,sans-serif', fontWeight:700,
              border: filtro===id ? '1px solid rgba(234,170,65,.5)' : '1px solid var(--app-border)',
              background: filtro===id ? 'rgba(234,170,65,.12)' : 'rgba(255,255,255,.04)',
              color: filtro===id ? 'var(--fmn-gold)' : 'var(--text-2)' }}>
            {label}
          </button>
        ))}
        <select value={situacaoFiltro} onChange={e => setSituacaoFiltro(e.target.value)}
          style={{ padding:'7px 12px', borderRadius:999, cursor:'pointer', fontSize:11.5,
            fontFamily:'Roboto,sans-serif', fontWeight:700, border:'1px solid var(--app-border)',
            background:'rgba(255,255,255,.04)', color:'var(--text-2)', outline:'none' }}>
          <option value="todas">Toda situação ({itens.length})</option>
          {Object.keys(SITUACAO_INFO).filter(s => contagemSituacao[s]).map(s => (
            <option key={s} value={s}>{SITUACAO_INFO[s].label} ({contagemSituacao[s]})</option>
          ))}
        </select>
      </div>

      <div style={{ background:'var(--app-surface)', border:'1px solid var(--app-border)', borderRadius:14, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ borderBottom:'1px solid var(--app-border)' }}>
              <th style={th}>Pessoa</th>
              <th style={th}>Contato</th>
              <th style={{ ...th, width:170 }}>Situação</th>
              <th style={{ ...th, width:110 }}>Ocorreu em</th>
              <th style={{ ...th, width:90 }}>Há</th>
              <th style={{ ...th, width:120 }}>Resultado</th>
              <th style={{ ...th, width:50 }}></th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 && (
              <tr><td colSpan={7} style={{ ...td, textAlign:'center', padding:'40px 0', color:'var(--text-3)' }}>
                Nenhum lead nesse filtro.
              </td></tr>
            )}
            {lista.map(it => {
              const rec  = recuperados.has((it.email || '').trim().toLowerCase());
              const dias = diasAtras(it.created_at);
              // Abandono/pendência esfria rápido: até 7 dias ainda é quente pra recuperar.
              const quente = dias != null && dias <= 7;
              const sit = SITUACAO_INFO[it.situacao] || { label: it.situacao || '—', cor: '#94a3b8' };
              const jaContatado   = it.telefone && contatadosOficial.has(tel11(it.telefone));
              const telK          = chaveTel(it.telefone);
              const statusSuporte = telK ? contatadosSuporte.get(telK) : null;
              const jaSuporte     = !!statusSuporte;
              const falhouSuporte = statusSuporte === 'falhou';
              return (
                <tr key={it.id} style={{ borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                  <td style={{ ...td, color:'var(--text-1)', fontWeight:600 }}>{it.nome || '—'}</td>
                  <td style={td}>
                    <div style={{ fontSize:12 }}>{it.email || '—'}</div>
                    {it.telefone && <div style={{ fontSize:11, color:'var(--text-3)' }}>{it.telefone}</div>}
                    <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop: (jaContatado || jaSuporte) ? 3 : 0 }}>
                      {jaContatado && (
                        <div style={{ display:'inline-block', padding:'1px 7px', borderRadius:999,
                          fontSize:9.5, fontWeight:700, fontFamily:'Roboto,sans-serif', whiteSpace:'nowrap',
                          background:'rgba(96,165,250,.12)', border:'1px solid rgba(96,165,250,.35)', color:'#60a5fa' }}>
                          Já contatado (API oficial)
                        </div>
                      )}
                      {jaSuporte && falhouSuporte && (
                        <div style={{ display:'inline-block', padding:'1px 7px', borderRadius:999,
                          fontSize:9.5, fontWeight:700, fontFamily:'Roboto,sans-serif', whiteSpace:'nowrap',
                          background:'rgba(248,113,113,.12)', border:'1px solid rgba(248,113,113,.35)', color:'#f87171' }}>
                          Falhou ao enviar (suporte)
                        </div>
                      )}
                      {jaSuporte && !falhouSuporte && (
                        <div style={{ display:'inline-block', padding:'1px 7px', borderRadius:999,
                          fontSize:9.5, fontWeight:700, fontFamily:'Roboto,sans-serif', whiteSpace:'nowrap',
                          background:'rgba(234,170,65,.12)', border:'1px solid rgba(234,170,65,.35)', color:'var(--fmn-gold)' }}>
                          Já contatado pelo suporte
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ ...td, whiteSpace:'nowrap' }}>
                    <span style={{ display:'inline-block', padding:'2px 9px', borderRadius:999, fontSize:10.5, fontWeight:700,
                      fontFamily:'Roboto,sans-serif', background: `${sit.cor}1a`, whiteSpace:'nowrap',
                      border: `1px solid ${sit.cor}55`, color: sit.cor }}>
                      {sit.label}
                    </span>
                  </td>
                  <td style={td}>{fmtData(it.created_at)}</td>
                  <td style={{ ...td, color: quente ? 'var(--fmn-gold)' : 'var(--text-3)', fontWeight: quente ? 700 : 400 }}>
                    {dias != null ? `${dias}d` : '—'}
                  </td>
                  <td style={td}>
                    <span style={{ padding:'2px 9px', borderRadius:999, fontSize:10.5, fontWeight:700,
                      fontFamily:'Roboto,sans-serif',
                      background: rec ? 'rgba(74,222,128,.12)' : 'rgba(255,255,255,.04)',
                      border: `1px solid ${rec ? 'rgba(74,222,128,.35)' : 'var(--app-border)'}`,
                      color: rec ? '#4ade80' : 'var(--text-3)' }}>
                      {rec ? 'Comprou depois' : 'Não recuperado'}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign:'center' }}>
                    <button onClick={() => setEnviarPara(it)}
                      title={falhouSuporte
                        ? 'A última tentativa pelo suporte falhou (confira o motivo) — pode tentar de novo'
                        : jaSuporte
                        ? 'Já tem mensagem na fila do suporte — confira antes de mandar de novo'
                        : jaContatado
                        ? 'Já recebeu mensagem pela API oficial — confira antes de mandar pelo suporte'
                        : 'Mandar mensagem de recuperação (número de suporte)'}
                      style={{ width:28, height:28, borderRadius:8,
                        border: falhouSuporte ? '1px solid rgba(248,113,113,.35)' : jaSuporte ? '1px solid rgba(234,170,65,.35)' : jaContatado ? '1px solid rgba(96,165,250,.35)' : '1px solid rgba(74,222,128,.3)',
                        background: falhouSuporte ? 'rgba(248,113,113,.1)' : jaSuporte ? 'rgba(234,170,65,.1)' : jaContatado ? 'rgba(96,165,250,.1)' : 'rgba(74,222,128,.1)',
                        color: falhouSuporte ? '#f87171' : jaSuporte ? 'var(--fmn-gold)' : jaContatado ? '#60a5fa' : '#4ade80', cursor:'pointer',
                        display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
                      <LucideIcon icon="message-circle" size={14}/>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {enviarPara && (
        <EnviarRecuperacaoModal item={enviarPara} onClose={() => setEnviarPara(null)}/>
      )}
    </div>
  );
}

/* ── abandono refeito ── */
function FunnelRow({ it, prev, max, biggest }) {
  const [hov, setHov] = useState(false);
  const retain = pc(it.n, max);
  const drop = prev ? prev.n - it.n : 0;
  const dropPct = prev ? pc(drop, prev.n) : 0;
  const isCap = it.etapa === 'Captura de e-mail';
  const isBig = biggest && it.etapa === biggest;
  return (
    <div style={{ position: 'relative' }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      {hov && (
        <div style={{ position: 'absolute', bottom: '100%', left: 0, zIndex: 50, marginBottom: 6, width: 340, background: '#0c0d11', border: '1px solid var(--app-border-2)', borderRadius: 10, padding: '11px 13px', boxShadow: '0 12px 40px rgba(0,0,0,.55)' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif', lineHeight: 1.4, marginBottom: 5 }}>{it.pergunta}</div>
          <div style={{ fontSize: 11, color: 'var(--text-2)', fontFamily: 'Roboto,sans-serif', lineHeight: 1.5 }}>
            {nf(it.n)} chegaram aqui · {retain}% do início{prev && drop > 0 && <span style={{ color: 'var(--clr-neg)' }}> · caíram {nf(drop)} ({dropPct}%) vindo de “{prev.etapa}”</span>}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
        <div style={{ width: 150, flexShrink: 0, fontSize: 12, fontFamily: 'Roboto,sans-serif', color: hov ? 'var(--fmn-gold)' : 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'help' }}>{it.etapa}</div>
        <div style={{ flex: 1, height: 20, background: 'rgba(255,255,255,.04)', borderRadius: 5, overflow: 'hidden', position: 'relative' }}>
          <div style={{ width: retain + '%', height: '100%', background: isCap ? 'var(--clr-teal)' : 'var(--fmn-gold)', borderRadius: 5, transition: 'width .4s' }} />
        </div>
        <div style={{ width: 42, textAlign: 'right', fontSize: 13, fontWeight: 900, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif' }}>{retain}%</div>
        <div style={{ width: 96, textAlign: 'right', fontSize: 10.5, fontFamily: 'Roboto,sans-serif', color: isBig ? 'var(--clr-neg)' : 'var(--text-3)', fontWeight: isBig ? 700 : 400 }}>
          {prev ? (drop > 0 ? `↓ ${dropPct}%${isBig ? ' ◀ maior' : ''}` : '—') : 'início'}
        </div>
      </div>
    </div>
  );
}
function FunnelChart({ items }) {
  if (!items || !items.length) return null;
  const max = items[0].n;
  let biggest = null, bd = -1;
  items.forEach((it, i) => { if (i > 0) { const d = items[i - 1].n - it.n; if (d > bd) { bd = d; biggest = it.etapa; } } });
  const lead = items[items.length - 1].n;
  return (
    <div style={{ background: 'var(--app-surface)', borderRadius: 14, padding: '12px 18px 16px', overflow: 'visible' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
        <span style={{ fontSize: 12.5, fontFamily: 'Roboto,sans-serif', fontWeight: 700, color: 'var(--text-1)' }}>Abandono por etapa</span>
        <span style={{ fontSize: 11, color: 'var(--text-2)', fontFamily: 'Roboto,sans-serif' }}>do início até virar lead você retém <b style={{ color: 'var(--clr-teal)' }}>{pc(lead, max)}%</b></span>
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontFamily: 'Roboto,sans-serif', marginBottom: 8 }}>passe o mouse na etapa para ver a pergunta completa</div>
      {items.map((it, i) => <FunnelRow key={i} it={it} prev={items[i - 1]} max={max} biggest={biggest} />)}
    </div>
  );
}

/* ── série temporal em colunas ── */
function SeriesChart({ serie }) {
  const data = serie || [];
  const max = Math.max(1, ...data.map(d => d.leads));
  return (
    <SectionCard title="Leads ao longo do tempo">
      <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontFamily: 'Roboto,sans-serif', marginTop: -4, marginBottom: 10 }}>barra cheia = respostas · parte dourada = viraram e-mail</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: data.length > 16 ? 2 : 6, height: 150, paddingTop: 8 }}>
        {data.map((d, i) => (
          <div key={i} title={`${d.rotulo}: ${nf(d.leads)} respostas, ${nf(d.com_email)} e-mails`}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
            <div style={{ width: '100%', maxWidth: 26, height: 120, display: 'flex', alignItems: 'flex-end', position: 'relative' }}>
              <div style={{ width: '100%', height: (d.leads / max * 100) + '%', background: 'rgba(96,165,250,.35)', borderRadius: '4px 4px 0 0', position: 'relative' }}>
                <div style={{ position: 'absolute', bottom: 0, width: '100%', height: pc(d.com_email, d.leads) + '%', background: 'var(--fmn-gold)', borderRadius: d.com_email === d.leads ? '4px 4px 0 0' : 0 }} />
              </div>
            </div>
            <span style={{ fontSize: 8.5, color: 'var(--text-3)', fontFamily: 'Roboto,sans-serif', whiteSpace: 'nowrap', transform: data.length > 12 ? 'rotate(-45deg)' : 'none', transformOrigin: 'center' }}>{d.rotulo}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

/* ── insight do dia ── */
function InsightOne({ ins, kind, onNavigate }) {
  const [busy, setBusy] = useState(false);
  const cfg = kind === 'claude'
    ? { label: 'Insight do Claudinho', icon: 'sparkles', accent: '#a78bfa', bg: 'linear-gradient(100deg, rgba(167,139,250,.16), rgba(167,139,250,.04))', border: 'rgba(167,139,250,.32)' }
    : { label: 'Insight do dia · dos dados', icon: 'lightbulb', accent: 'var(--fmn-gold)', bg: 'linear-gradient(100deg, rgba(234,170,65,.14), rgba(234,170,65,.04))', border: 'rgba(234,170,65,.3)' };
  if (!ins) return (
    <div style={{ background: cfg.bg, border: `1px dashed ${cfg.border}`, borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, opacity: .75 }}>
      <LucideIcon icon={cfg.icon} size={18} color={cfg.accent} />
      <div><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: cfg.accent, fontFamily: 'Roboto,sans-serif' }}>{cfg.label}</div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'Roboto,sans-serif', marginTop: 2 }}>{kind === 'claude' ? 'O Claudinho gera o insight de hoje às 9h.' : 'Ainda não gerado hoje.'}</div></div>
    </div>
  );
  const usar = async () => {
    setBusy(true);
    try {
      await window.db.from('ideias').insert({ title: ins.titulo, description: (ins.gancho || '') + (ins.detalhe ? '\n\n' + ins.detalhe : ''), status: 'Ideia', formats: ins.formato ? [ins.formato] : [] });
      await window.db.from('quiz_insights').update({ usado: true }).eq('id', ins.id);
    } catch (e) { console.warn(e); }
    setBusy(false);
    if (onNavigate) onNavigate('ideias');
  };
  return (
    <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <LucideIcon icon={cfg.icon} size={16} color={cfg.accent} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: cfg.accent, fontFamily: 'Roboto,sans-serif' }}>{cfg.label}</span>
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-1)', fontFamily: 'Roboto,sans-serif', lineHeight: 1.3 }}>{ins.titulo}</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-2)', fontFamily: 'Roboto,sans-serif', lineHeight: 1.45, flex: 1 }}>{ins.gancho}</div>
      <button onClick={usar} disabled={busy}
        style={{ alignSelf: 'flex-start', marginTop: 2, background: cfg.accent, color: '#1a1a1a', border: 'none', borderRadius: 9, padding: '9px 14px', fontFamily: 'Roboto,sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
        <LucideIcon icon="arrow-right" size={14} />{ins.usado ? 'Enviar de novo' : 'Usar essa ideia'}
      </button>
    </div>
  );
}

function InsightCard({ onNavigate }) {
  const [list, setList] = useState(null);
  useEffect(() => {
    if (!window.db) return;
    window.db.from('quiz_insights').select('*').order('dia', { ascending: false }).limit(12)
      .then(({ data }) => setList(data || []));
  }, []);
  if (list === null) return null;
  const pick = f => list.find(x => x.fonte === f) || null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'stretch' }}>
      <InsightOne ins={pick('regra')} kind="regra" onNavigate={onNavigate} />
      <InsightOne ins={pick('claude')} kind="claude" onNavigate={onNavigate} />
    </div>
  );
}

/* ── tabela cruzada compacta ── */
function CrossList({ title, hint, rows, render, color }) {
  return (
    <SectionCard title={title}>
      {hint && <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontFamily: 'Roboto,sans-serif', marginTop: -4, marginBottom: 6 }}>{hint}</div>}
      {(!rows || !rows.length) ? <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 11.5 }}>Sem dados.</div> : rows.map(render)}
    </SectionCard>
  );
}

function FunisScreen({ onNavigate }) {
  const [periodo, setPeriodo]       = useState('30d');
  const [customFrom, setCustomFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate()-30); return d.toISOString().slice(0,10); });
  const [customTo, setCustomTo]     = useState(today);
  const [aba, setAba]               = useState('analise');
  const [data, setData]             = useState(null);
  const [leads, setLeads]           = useState([]);
  const [carrinho, setCarrinho]           = useState([]);
  const [recuperados, setRecuperados]     = useState(new Set());
  const [contatadosOficial, setContatadosOficial] = useState(new Set());
  const [contatadosSuporte, setContatadosSuporte] = useState(new Map()); // chaveTel -> status
  const [loadingCarrinho, setLoadingCarrinho] = useState(false);
  const [extraAgg, setExtraAgg]     = useState({});
  const [funnel, setFunnel]         = useState('all');
  const [loadingAnalise, setLoadingAnalise] = useState(true);
  const [loadingLeads, setLoadingLeads]     = useState(false);
  const [adsMap, setAdsMap]                 = useState({});

  const range = rangeFromPeriodo(periodo, customFrom, customTo);

  useEffect(() => {
    if (!window.db) return;
    window.db.from('ads').select('numero,titulo,meta_ad_id,media_drive_url,thumb_url,media_files')
      .then(({ data }) => {
        if (!data) return;
        const m = {};
        data.forEach(a => { if (a.meta_ad_id) m[String(a.meta_ad_id)] = a; });
        setAdsMap(m);
      });
  }, []);

  useEffect(() => {
    if (!window.db || aba !== 'analise') return;
    setLoadingAnalise(true);
    window.db.rpc('quiz_funis_dashboard', { ...range, p_funnel: funnel === 'all' ? null : funnel })
      .then(({ data: d, error }) => { if (!error) setData(d); setLoadingAnalise(false); });
  }, [periodo, customFrom, customTo, aba, funnel]);

  useEffect(() => {
    if (!window.db || aba !== 'leads') return;
    setLoadingLeads(true);
    const montar = () => {
      let q = window.db.from('quiz_leads').select(
        'id,nome,email,whatsapp,area_atuacao,profissionalizacao,tipo_negocio,confianca_clientes,situacoes,custo_processo,usa_contrato,tipo_contrato_atual,foco_artistico,sentimentos,protege_dinheiro,temas_dominados,entende_contrato,quer_modelos,nivel_risco,completou_lead,completou_quiz,utm_source,utm_medium,utm_campaign,utm_content,created_at,perfil,device_platform'
      ).order('created_at', { ascending: false });
      if (range.p_from) q = q.gte('created_at', range.p_from);
      if (range.p_to)   q = q.lte('created_at', range.p_to + 'T23:59:59Z');
      if (funnel !== 'all') q = q.eq('funnel_slug', funnel);
      return q;
    };
    buscarTudo(montar).then(rows => { setLeads(rows); setLoadingLeads(false); });
  }, [periodo, customFrom, customTo, aba, funnel]);

  // Recuperação de Venda: carrinho abandonado (nunca chegou a virar transação
  // na Hotmart) + venda que virou transação mas não fechou de primeira
  // (pendente, recusada, expirada, cancelada, atrasada, bloqueada,
  // pre_aprovada). Ampliado em 2026-08-26 — antes só existia o carrinho
  // abandonado, e uma venda com boleto vencido ou cartão recusado não
  // aparecia em lugar nenhum como oportunidade de recuperação.
  // Não inclui reembolsada/chargeback: isso já foi venda fechada, é
  // problema pós-venda, categoria diferente de "ainda não converteu".
  // "protesto" também não entra: Felipe nunca habilitou esse status na conta.
  const STATUS_RECUPERAVEL = ['pendente','cancelada','recusada','expirada','atrasada','bloqueada','pre_aprovada','recuperacao'];
  useEffect(() => {
    if (!window.db || aba !== 'carrinho') return;
    setLoadingCarrinho(true);
    const montarAband = () => {
      let q = window.db.from('abandono_carrinho')
        .select('id,nome,email,telefone,produto_nome,created_at,utm_source,meta_ad_id')
        .order('created_at', { ascending: false });
      if (range.p_from) q = q.gte('created_at', range.p_from);
      if (range.p_to)   q = q.lte('created_at', range.p_to + 'T23:59:59Z');
      return q;
    };
    const montarVendas = () => {
      let q = window.db.from('vendas')
        .select('hotmart_transaction_id,comprador_nome,comprador_email,comprador_telefone,produto_nome,created_at,utm_source,meta_ad_id,status')
        .in('status', STATUS_RECUPERAVEL)
        .order('created_at', { ascending: false });
      if (range.p_from) q = q.gte('created_at', range.p_from);
      if (range.p_to)   q = q.lte('created_at', range.p_to + 'T23:59:59Z');
      return q;
    };

    Promise.all([buscarTudo(montarAband), buscarTudo(montarVendas)]).then(async ([aband, vend]) => {
      const itensAband = (aband || []).map(i => ({
        id: 'ab_' + i.id, nome: i.nome, email: i.email, telefone: i.telefone,
        produto_nome: i.produto_nome, created_at: i.created_at,
        utm_source: i.utm_source, meta_ad_id: i.meta_ad_id, situacao: 'abandonou',
      }));
      const itensVenda = (vend || []).map(v => ({
        id: 'vd_' + v.hotmart_transaction_id, nome: v.comprador_nome, email: v.comprador_email,
        telefone: v.comprador_telefone, produto_nome: v.produto_nome, created_at: v.created_at,
        utm_source: v.utm_source, meta_ad_id: v.meta_ad_id, situacao: v.status,
      }));
      // O seletor de funil do topo (Todos / Fotógrafo Protegido / Blindagem)
      // também vale aqui: cada funil vende um produto, e olhar recuperação de
      // um sem o outro é o uso normal quando as duas campanhas rodam juntas.
      // Combinado com Felipe em 2026-08-28, quando o Blindagem entrou no ar.
      const doFunil = it => {
        if (funnel === 'all') return true;
        const ehBli = /blindagem/i.test(it.produto_nome || '');
        return funnel === 'blindagem' ? ehBli : !ehBli;
      };
      const itens = [...itensAband, ...itensVenda]
        .filter(doFunil)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setCarrinho(itens);

      // Marca como recuperado quem aparece de novo em vendas com status aprovada.
      // Bug corrigido em 2026-08-26: filtrava por `email`, coluna que não existe
      // em `vendas` (o campo certo é `comprador_email`) — a checagem nunca achava
      // ninguém, "Comprou depois" nunca aparecia mesmo quando era verdade.
      const emails = [...new Set(itens.map(i => (i.email || '').trim().toLowerCase()).filter(Boolean))];
      const rec = new Set();
      if (emails.length) {
        // Em lotes: lista muito grande estoura o tamanho da URL do filtro `in`.
        for (let i = 0; i < emails.length; i += 200) {
          const { data: v } = await window.db.from('vendas')
            .select('comprador_email').eq('status', 'aprovada').in('comprador_email', emails.slice(i, i + 200));
          (v || []).forEach(r => r.comprador_email && rec.add(r.comprador_email.trim().toLowerCase()));
        }
      }
      setRecuperados(rec);
      setLoadingCarrinho(false);

      // Marca quem já recebeu mensagem pela API oficial (número comercial,
      // Claudinho ou humano via Conversas) — combinado com Felipe em
      // 2026-08-26, pra não mandar a mensagem de recuperação duplicada por
      // dois canais diferentes (oficial + Khronus/número de suporte).
      // Bug corrigido em 2026-08-26: o PostgREST corta em 1000 linhas por
      // padrão mesmo pedindo .limit(20000) maior — puxar a tabela inteira de
      // whatsapp_mensagens (2146+ linhas e crescendo) sempre perdia mensagem
      // recente por trás desse corte silencioso. Corrigido buscando só os
      // telefones (formato 55+DDD+número, igual salvo na tabela) que
      // interessam pra essa lista, em lotes de 200 — mesmo padrão já usado
      // acima pra achar quem "Comprou depois".
      const telefones = [...new Set(itens.map(i => tel11(i.telefone)).filter(t => t.length >= 10))];
      const enviados = new Set();
      if (telefones.length) {
        const candidatos = telefones.map(t => '55' + t);
        for (let i = 0; i < candidatos.length; i += 200) {
          const { data: msgs } = await window.db.from('whatsapp_mensagens')
            .select('telefone').eq('direcao', 'saida').in('telefone', candidatos.slice(i, i + 200));
          (msgs || []).forEach(m => enviados.add(tel11(m.telefone)));
        }
        setContatadosOficial(new Set(telefones.filter(t => enviados.has(t))));
      } else {
        setContatadosOficial(new Set());
      }

      // Marca quem já tem mensagem na fila do Khronus (número de suporte,
      // via Ponte) — cobre tanto o envio manual daqui da tela quanto a
      // boas-vindas automática de aluno novo (as duas gravam na mesma fila).
      // Combinado com Felipe em 2026-08-26. Guarda o status (não só se
      // existe), pra sinalizar "falhou" (ex: número sem WhatsApp) separado
      // de "pendente"/"enviado" — pedido do Felipe no mesmo dia, depois de
      // um caso real de erro "contato sem identificador de chat".
      const telefonesKhronus = [...new Set(itens.flatMap(i => variantesTel(i.telefone)))];
      if (telefonesKhronus.length) {
        try {
          const r = await fetch(`${window.db.supabaseUrl}/functions/v1/khronus-fila-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${window.db.supabaseKey}` },
            body: JSON.stringify({ telefones: telefonesKhronus }),
          });
          const d = await r.json().catch(() => ({}));
          const porTel = new Map();
          (d.telefones || []).forEach(({ telefone, status }) => porTel.set(chaveTel(telefone), status));
          setContatadosSuporte(porTel);
        } catch {
          setContatadosSuporte(new Map());
        }
      } else {
        setContatadosSuporte(new Map());
      }
    });
  }, [periodo, customFrom, customTo, aba, funnel]);

  useEffect(() => {
    if (!window.db || aba !== 'analise') return;
    const EXTRA_FIELDS = ['profissionalizacao','tipo_negocio','confianca_clientes','tipo_contrato_atual','foco_artistico','protege_dinheiro','entende_contrato'];
    const montarExtra = () => {
      let q = window.db.from('quiz_leads').select(EXTRA_FIELDS.join(','));
      if (range.p_from) q = q.gte('created_at', range.p_from);
      if (range.p_to)   q = q.lte('created_at', range.p_to + 'T23:59:59Z');
      if (funnel !== 'all') q = q.eq('funnel_slug', funnel);
      return q;
    };
    buscarTudo(montarExtra).then(rows => {
      if (!rows) return;
      const agg = {};
      EXTRA_FIELDS.forEach(f => {
        const cnt = {};
        rows.forEach(r => { if (r[f]) cnt[r[f]] = (cnt[r[f]] || 0) + 1; });
        agg[f] = Object.entries(cnt).map(([val, n]) => ({ val, n })).sort((a,b) => b.n - a.n);
      });
      setExtraAgg(agg);
    });
  }, [periodo, customFrom, customTo, aba, funnel]);

  const k = data?.kpis || {};
  const total = k.total || 0;
  const taxa = pc(k.com_email, total);
  const periodoTxt = k.periodo_min ? `${k.periodo_min.slice(0, 10).split('-').reverse().join('/')} a ${k.periodo_max.slice(0, 10).split('-').reverse().join('/')}` : '—';
  const dTotal = k.prev_total ? total - k.prev_total : undefined;
  const dLeads = k.prev_com_email ? (k.com_email || 0) - k.prev_com_email : undefined;
  const secTitle = t => <div style={{ fontSize: 12.5, fontFamily: 'Roboto,sans-serif', fontWeight: 700, color: 'var(--text-1)', marginTop: 6 }}>{t}</div>;

  const FUNIS = [
    { id: 'all',                  label: 'Todos' },
    { id: 'fotografo-protegido',  label: 'Fotógrafo Protegido' },
    { id: 'blindagem',            label: 'Blindagem' },
  ];

  const FunnelBar = () => (
    <div style={{ display:'flex', gap:4, padding:3, borderRadius:8, background:'rgba(255,255,255,.04)', border:'1px solid var(--app-border)' }}>
      {FUNIS.map(f => (
        <button key={f.id} onClick={() => setFunnel(f.id)}
          style={{ padding:'5px 11px', borderRadius:6, cursor:'pointer',
            background: funnel===f.id ? 'rgba(234,170,65,.15)' : 'transparent',
            border: `1px solid ${funnel===f.id ? 'rgba(234,170,65,.2)' : 'transparent'}`,
            color: funnel===f.id ? 'var(--fmn-gold)' : 'rgba(255,255,255,.42)',
            fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:11 }}>
          {f.label}
        </button>
      ))}
    </div>
  );

  const PeriodBar = () => (
    <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
      <div style={{ display:'flex', gap:4, padding:3, borderRadius:8, background:'rgba(255,255,255,.04)', border:'1px solid var(--app-border)' }}>
        {PERIODOS.map(p => (
          <button key={p.id} onClick={() => setPeriodo(p.id)}
            style={{ padding:'5px 11px', borderRadius:6, cursor:'pointer',
              background: periodo===p.id ? 'rgba(234,170,65,.15)' : 'transparent',
              border: `1px solid ${periodo===p.id ? 'rgba(234,170,65,.2)' : 'transparent'}`,
              color: periodo===p.id ? 'var(--fmn-gold)' : 'rgba(255,255,255,.42)',
              fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:11 }}>
            {p.label}
          </button>
        ))}
      </div>
      {periodo === 'custom' && (
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            style={{ padding:'5px 8px', borderRadius:6, background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.15)', color:'#fff', fontFamily:'Roboto,sans-serif', fontSize:11, outline:'none' }}/>
          <span style={{ color:'var(--text-3)', fontSize:11 }}>até</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            style={{ padding:'5px 8px', borderRadius:6, background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.15)', color:'#fff', fontFamily:'Roboto,sans-serif', fontSize:11, outline:'none' }}/>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <TopBar title="Funis" actions={<div style={{ display:'flex', gap:10, alignItems:'center' }}><FunnelBar/><PeriodBar/></div>}/>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 0, minHeight: 0 }}>

        {/* Tabs */}
        <div style={{ display:'flex', gap:2, borderBottom:'1px solid var(--app-border)', marginBottom:18 }}>
          {[['analise','bar-chart-2','Análise'],['leads','users','Leads'],['carrinho','shopping-cart','Recuperação de Venda']].map(([id,icon,label]) => (
            <button key={id} onClick={() => setAba(id)}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 18px', cursor:'pointer',
                background:'transparent', border:'none', borderBottom:`2px solid ${aba===id?'var(--fmn-gold)':'transparent'}`,
                color: aba===id ? 'var(--fmn-gold)' : 'var(--text-3)',
                fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:12, transition:'all 120ms', marginBottom:-1 }}>
              <LucideIcon icon={icon} size={13}/>{label}
            </button>
          ))}
        </div>

        {/* ABA LEADS */}
        {aba === 'leads' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {loadingLeads
              ? <div style={{ padding:'60px 0', textAlign:'center', color:'var(--text-3)', fontSize:13 }}>
                  <LucideIcon icon="loader" size={22}/><div style={{ marginTop:8 }}>Carregando leads...</div>
                </div>
              : <LeadsTable leads={leads} adsMap={adsMap}/>}
          </div>
        )}

        {/* ABA RECUPERAÇÃO DE VENDA (antes só "Carrinho abandonado") */}
        {aba === 'carrinho' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {loadingCarrinho
              ? <div style={{ padding:'60px 0', textAlign:'center', color:'var(--text-3)', fontSize:13 }}>
                  <LucideIcon icon="loader" size={22}/><div style={{ marginTop:8 }}>Carregando...</div>
                </div>
              : (() => {
                  const total = carrinho.length;
                  const rec   = carrinho.filter(i => recuperados.has((i.email || '').trim().toLowerCase())).length;
                  const quentes = carrinho.filter(i => i.created_at && (Date.now() - new Date(i.created_at)) / 86400000 <= 7).length;
                  const taxa = total ? Math.round(rec / total * 100) : 0;
                  return (<>
                    <div style={{ display:'flex', gap:12 }}>
                      <CardKPI label="Leads pra recuperar"  value={nf(total)} icon="shopping-cart" accent/>
                      <CardKPI label="Compraram depois"     value={nf(rec)}   icon="check-circle"/>
                      <CardKPI label="Taxa de recuperação"  value={taxa + '%'} icon="trending-up"/>
                      <CardKPI label="Quentes (até 7 dias)" value={nf(quentes)} icon="flame"/>
                    </div>
                    <CarrinhoTable itens={carrinho} recuperados={recuperados} contatadosOficial={contatadosOficial} contatadosSuporte={contatadosSuporte}/>
                  </>);
                })()}
          </div>
        )}

        {/* ABA ANÁLISE */}
        {aba === 'analise' && (<div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        {loadingAnalise && <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}><LucideIcon icon="loader" size={22} /><div style={{ marginTop: 8 }}>Carregando dados...</div></div>}
        {!loadingAnalise && data && (<>
          <InsightCard onNavigate={onNavigate} />

          <div style={{ display: 'flex', gap: 12 }}>
            <CardKPI label="Total de respostas" value={nf(total)} icon="users" accent delta={dTotal} deltaLabel="vs período anterior" />
            <CardKPI label="Leads com e-mail" value={nf(k.com_email)} icon="mail" delta={dLeads} deltaLabel="vs período anterior" />
            <CardKPI label="Taxa de captura" value={taxa + '%'} icon="target" />
            <CardKPI label="Período" value={periodoTxt} icon="calendar" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
            <FunnelChart items={data.abandono || []} />
            <SeriesChart serie={data.serie} />
          </div>

          {secTitle('Pesquisa de público (voz do cliente, troque entre pizza e barras no canto)')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <VizCard title="Dores mais vividas" hint="situações que já passaram" items={data.dores} total={total} />
            <VizCard title="Sentimentos" hint="o que sentem no dia a dia" items={data.sentimentos} total={total} />
            <VizCard title="Lacunas de conhecimento" hint="temas jurídicos que marcaram" items={data.temas} total={total} />
            <VizCard title="Percepção de custo de um processo" items={data.custo} total={total} />
            <VizCard title="Área de atuação" items={data.area} total={total} />
            <VizCard title="Usa contrato?" items={data.usa_contrato} total={total} />
            <VizCard title="É a principal renda?" hint="nível de profissionalização" items={extraAgg.profissionalizacao} total={total} />
            <VizCard title="Tipo de negócio" hint="como estruturam a carreira" items={extraAgg.tipo_negocio} total={total} />
            <VizCard title="Confiança com clientes" hint="como se sentem na relação comercial" items={extraAgg.confianca_clientes} total={total} />
            <VizCard title="Tipo de contrato atual" hint="o que usam hoje para se proteger" items={extraAgg.tipo_contrato_atual} total={total} />
            <VizCard title="Foco artístico" hint="onde investem a maior parte do tempo" items={extraAgg.foco_artistico} total={total} />
            <VizCard title="Contrato protege financeiramente?" hint="percepção de proteção atual" items={extraAgg.protege_dinheiro} total={total} />
            <VizCard title="Entende o próprio contrato?" hint="nível de compreensão jurídica" items={extraAgg.entende_contrato} total={total} />
          </div>

          {secTitle('Ângulos de copy (insights de venda)')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <CrossList title="Lacuna jurídica × profissionalização" hint="% que não domina nenhum tema, por grupo"
              rows={(data.lacuna_prof || [])}
              render={(r, i) => <Bar key={i} label={r.grupo} n={pc(r.nenhum, r.total)} max={100} pctVal={pc(r.nenhum, r.total)} sub={`${nf(r.nenhum)}/${nf(r.total)}`} color="var(--clr-warn)" />} />
            <CrossList title="Dor × sentimento mais comuns" hint="combinações que mais se repetem"
              rows={(data.cross_dor_sentimento || [])}
              render={(r, i) => <Bar key={i} label={`${r.dor} + ${r.sent}`} n={r.n} max={Math.max(1, ...(data.cross_dor_sentimento || []).map(x => x.n))} pctVal={null} sub={nf(r.n)} color="#a78bfa" />} />
            <CrossList title="Top dores por área" hint="o que mais dói em cada perfil"
              rows={(data.dores_por_area || [])}
              render={(r, i) => <Bar key={i} label={`[${r.area.split(' ')[0]}] ${r.dor}`} n={r.n} max={Math.max(1, ...(data.dores_por_area || []).map(x => x.n))} pctVal={null} sub={nf(r.n)} color="var(--clr-neg)" />} />
          </div>

          {secTitle('Aquisição e timing')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <VizCard title="Dispositivo" hint="de onde respondem" items={data.dispositivo} total={total} />
            <CrossList title="Quando os leads chegam (dia)" hint="respostas por dia da semana"
              rows={(data.chegada_dia || [])}
              render={(r, i) => <Bar key={i} label={DOW[r.dow]} n={r.n} max={Math.max(1, ...(data.chegada_dia || []).map(x => x.n))} pctVal={null} sub={nf(r.n)} color="var(--clr-info)" />} />
            <CrossList title="Horário de pico" hint="respostas por hora do dia"
              rows={(data.chegada_hora || []).slice().sort((a, b) => b.n - a.n).slice(0, 8)}
              render={(r, i) => <Bar key={i} label={`${String(r.hora).padStart(2, '0')}h`} n={r.n} max={Math.max(1, ...(data.chegada_hora || []).map(x => x.n))} pctVal={null} sub={nf(r.n)} color="var(--clr-info)" />} />
          </div>
        </>)}
        </div>)}
      </div>
    </div>
  );
}

window.FunisScreen = FunisScreen;
