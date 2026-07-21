/* ================================================================
   Tracker FMN — Conteúdo Orgânico v6
   Publicação no Meta + drag-and-drop entre colunas
   ================================================================ */
const { useState, useEffect, useRef } = React;
const { LucideIcon, Btn, Badge, TopBar } = window;

const WORKER_URL   = 'https://organico-media.blindagem-fmn.workers.dev';
const PLATAFORMAS  = window.PLATAFORMAS; // fonte única em shared.jsx (inclui Artigo, Youtube)
const RESPONSAVEIS = ['Felipe', 'Amanda'];
const RESPONSAVEL_CONFIG = {
  'Felipe': { initials:'FF', color:'#eaaa41', bg:'rgba(234,170,65,.18)', photo:null },
  'Amanda': { initials:'AM', color:'#60a5fa', bg:'rgba(96,165,250,.18)', photo:null },
};

const COLUMNS = [
  { id:'Fazer',     label:'Fazer',     colorDot:'#94a3b8', colorBg:'rgba(148,163,184,.06)', colorBorder:'rgba(148,163,184,.22)' },
  { id:'Produção',  label:'Produção',  colorDot:'#38bdf8', colorBg:'rgba(56,189,248,.06)',  colorBorder:'rgba(56,189,248,.22)'  },
  { id:'Postagem',  label:'Postagem',  colorDot:'#fb923c', colorBg:'rgba(251,146,60,.06)',  colorBorder:'rgba(251,146,60,.22)'  },
  { id:'Agendado',  label:'Agendado',  colorDot:'#a78bfa', colorBg:'rgba(167,139,250,.06)', colorBorder:'rgba(167,139,250,.22)' },
  { id:'Feito',     label:'Feito',     colorDot:'#4ade80', colorBg:'rgba(74,222,128,.06)',  colorBorder:'rgba(74,222,128,.22)'  },
];

const PLAT_COLOR = window.PLAT_COLOR; // fonte única em shared.jsx
const PLAT_ICON  = window.PLAT_ICON;  // fonte única em shared.jsx

const FIELD_STYLE = {
  width:'100%', boxSizing:'border-box',
  background:'var(--app-surface-2)', border:'1px solid var(--app-border)',
  color:'#fff', padding:'10px 12px', borderRadius:8,
  fontFamily:'Roboto,sans-serif', fontSize:13, outline:'none', resize:'vertical',
};
const LABEL_STYLE = {
  display:'block', fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
  letterSpacing:'1.2px', color:'rgba(255,255,255,.4)', textTransform:'uppercase', marginBottom:6,
};

/* ── Compressão WebP no browser ──────────────────────────────────*/
// Regra de otimização: converte para WebP 82%.
// Redimensiona SOMENTE se a aresta maior exceder maxPx (padrão 1920).
// Imagens menores que 1920px são preservadas no tamanho original — nunca aumentar.
async function compressToWebP(file, maxPx = 1920, quality = 0.82) {
  return new Promise(resolve => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const ow = img.naturalWidth;
      const oh = img.naturalHeight;
      const largerEdge = Math.max(ow, oh);
      let w = ow, h = oh;
      if (largerEdge > maxPx) {
        // Reduz proporcionalmente até a aresta maior caber em maxPx
        const r = maxPx / largerEdge;
        w = Math.round(ow * r);
        h = Math.round(oh * r);
      }
      // w e h nunca excedem as dimensões originais
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => resolve(blob), 'image/webp', quality);
    };
    img.src = objectUrl;
  });
}

// CarouselLightbox agora vive em shared.jsx (window.CarouselLightbox) — reusado
// no Tráfego também. Não duplicar aqui.
const { CarouselLightbox } = window;

/* ── SlideCarousel — viewer inline no card ───────────────────────*/
function SlideCarousel({ urls, onExpand }) {
  const [idx, setIdx] = useState(0);
  if (!urls || !urls.length) return null;
  const prev = e => { e.stopPropagation(); setIdx(i => (i - 1 + urls.length) % urls.length); };
  const next = e => { e.stopPropagation(); setIdx(i => (i + 1) % urls.length); };
  return (
    <div style={{ position:'relative', width:'100%', borderRadius:7, overflow:'hidden',
      background:'rgba(0,0,0,.5)', marginBottom:2 }}>
      <img src={urls[idx]} alt={`Slide ${idx+1}`}
        style={{ width:'100%', display:'block', aspectRatio:'4/5', objectFit:'cover' }}
        loading="lazy"/>

      {/* Botão expandir */}
      <button onClick={e => { e.stopPropagation(); onExpand(idx); }}
        title="Ver em tamanho maior"
        style={{ position:'absolute', top:6, right:6, background:'rgba(0,0,0,.6)',
          border:'1px solid rgba(255,255,255,.2)', borderRadius:6,
          width:26, height:26, cursor:'pointer', color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center' }}>
        <LucideIcon icon="maximize-2" size={12}/>
      </button>

      {urls.length > 1 && (<>
        <button onClick={prev} style={{ position:'absolute', left:4, top:'50%',
          transform:'translateY(-50%)', background:'rgba(0,0,0,.6)', border:'none',
          borderRadius:'50%', width:26, height:26, cursor:'pointer', color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          <LucideIcon icon="chevron-left" size={13}/>
        </button>
        <button onClick={next} style={{ position:'absolute', right:4, top:'50%',
          transform:'translateY(-50%)', background:'rgba(0,0,0,.6)', border:'none',
          borderRadius:'50%', width:26, height:26, cursor:'pointer', color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          <LucideIcon icon="chevron-right" size={13}/>
        </button>
        <div style={{ position:'absolute', bottom:6, left:'50%', transform:'translateX(-50%)',
          background:'rgba(0,0,0,.65)', borderRadius:999, padding:'2px 8px',
          fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
          color:'rgba(255,255,255,.85)', letterSpacing:'0.04em' }}>
          {idx + 1} / {urls.length}
        </div>
      </>)}
    </div>
  );
}

/* ── ContentCard ─────────────────────────────────────────────────*/
function ContentCard({ item, col, onOpen, onDragStart }) {
  const [hov, setHov]       = useState(false);
  const [dragging, setDrag] = useState(false);
  const color    = PLAT_COLOR[item.plataforma] || '#94a3b8';
  const platIcon = PLAT_ICON[item.plataforma] || 'file';
  const num      = String(item.numero || 0).padStart(3, '0');

  // Vídeo (Reels): usa a thumb JPG gerada junto (media_files), nunca o .mp4
  // direto num <img> — <img> não sabe renderizar vídeo. Isolado em try/catch
  // próprio porque em posts antigos media_files é uma URL crua (não JSON) —
  // se isso desse throw, travava o fallback de slides pra todo mundo.
  let videoThumb = null;
  try {
    let mf = item.media_files;
    if (typeof mf === 'string') mf = JSON.parse(mf);
    videoThumb = Array.isArray(mf) ? (mf.find(m => m && m.tipo === 'video')?.thumb_url || null) : null;
  } catch {}

  let thumbUrl = videoThumb;
  if (!thumbUrl) {
    try {
      const slidesArr = JSON.parse(item.slides || '[]');
      thumbUrl = slidesArr.map(s => s.image_url).filter(Boolean)[0] || null;
      if (/\.(mp4|webm|mov|m4v)$/i.test(thumbUrl || '')) thumbUrl = null;
    } catch {}
  }

  return (
    <div
      draggable
      onDragStart={e => { setDrag(true); onDragStart(e, item.id); }}
      onDragEnd={() => setDrag(false)}
      onClick={() => onOpen(item)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov && !dragging ? 'var(--app-surface-3)' : 'var(--app-surface-2)',
        border: `1px solid ${hov && !dragging ? col.colorBorder : 'var(--app-border)'}`,
        borderRadius:10, padding:'12px',
        display:'flex', flexDirection:'column', gap:8,
        cursor:'grab', transition:'all 160ms var(--ease-out)',
        transform: hov && !dragging ? 'translateY(-1px)' : 'none',
        opacity: dragging ? 0.4 : 1,
      }}>

      <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
        <div style={{ width:32, height:32, borderRadius:5, flexShrink:0, overflow:'hidden',
          border:'1px solid rgba(255,255,255,.1)', background:`${color}15`,
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          {thumbUrl
            ? <img src={thumbUrl} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
            : <LucideIcon icon={platIcon} size={14} style={{ color }}/>}
        </div>
        <span style={{ fontSize:13, fontFamily:'Roboto,sans-serif', fontWeight:900,
          letterSpacing:'0.06em', color:col.colorDot, textTransform:'uppercase', flexShrink:0 }}>
          ORG {num}
        </span>
        <div style={{ marginLeft:'auto', flexShrink:0 }}>
          {item.responsavel && (
            <ResponsavelAvatar nome={item.responsavel} size={22}/>
          )}
        </div>
      </div>

      <p style={{ fontSize:12.5, fontFamily:'Roboto,sans-serif', lineHeight:1.45,
        color:'var(--text-1)', margin:0, display:'-webkit-box',
        WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
        {item.tema || <span style={{ color:'var(--text-3)', fontStyle:'italic' }}>Sem título</span>}
      </p>

      <div style={{ display:'flex', gap:4, flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px',
          borderRadius:999, fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
          background:`${color}18`, color, border:`1px solid ${color}33` }}>
          <LucideIcon icon={platIcon} size={9}/>{item.plataforma}
        </span>
        {item.data_prevista && (
          <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', color:'var(--text-3)', marginLeft:'auto' }}>
            {item.data_prevista.split('-').reverse().join('/')}
          </span>
        )}
      </div>

      {item.gancho && (
        <p style={{ margin:0, fontSize:11, fontFamily:'Roboto,sans-serif', color:'var(--text-3)',
          lineHeight:1.4, overflow:'hidden', display:'-webkit-box',
          WebkitLineClamp:1, WebkitBoxOrient:'vertical',
          borderTop:'1px solid var(--app-border)', paddingTop:6 }}>
          {item.gancho}
        </p>
      )}
    </div>
  );
}

/* ── OrgColumn ───────────────────────────────────────────────────*/
function OrgColumn({ col, items, onOpen, onAddNew, onDragStart, onDrop, isDragOver }) {
  const [over, setOver] = useState(false);

  const handleDragOver = e => { e.preventDefault(); setOver(true); };
  const handleDragLeave = () => setOver(false);
  const handleDrop = e => { e.preventDefault(); setOver(false); onDrop(col.id); };

  const highlight = over || isDragOver;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ width:238, minWidth:238, display:'flex', flexDirection:'column',
        background: highlight ? `${col.colorBg.replace('.06','0.14')}` : col.colorBg,
        border:`1px solid ${highlight ? col.colorDot : col.colorBorder}`,
        borderRadius:12, overflow:'hidden', height:'100%',
        transition:'border-color 120ms, background 120ms',
        boxShadow: highlight ? `0 0 0 2px ${col.colorDot}44` : 'none' }}>
      <div style={{ padding:'10px 12px', borderBottom:`1px solid ${col.colorBorder}`,
        display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:col.colorDot, display:'block' }}/>
          <span style={{ fontSize:12, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-1)' }}>
            {col.label}
          </span>
        </div>
        <span style={{ width:20, height:20, borderRadius:'50%', background:'rgba(255,255,255,.07)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:10.5,
          fontFamily:'Roboto,sans-serif', fontWeight:900, color:'var(--text-2)' }}>
          {items.length}
        </span>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'10px 8px', display:'flex', flexDirection:'column', gap:8 }}>
        {items.map(item => (
          <ContentCard key={item.id} item={item} col={col} onOpen={onOpen} onDragStart={onDragStart}/>
        ))}
        {highlight && items.length === 0 && (
          <div style={{ flex:1, border:`2px dashed ${col.colorDot}55`, borderRadius:8,
            display:'flex', alignItems:'center', justifyContent:'center', minHeight:60,
            fontSize:11, fontFamily:'Roboto,sans-serif', color:col.colorDot, opacity:.7 }}>
            Soltar aqui
          </div>
        )}
      </div>
      <div style={{ padding:'6px 8px 10px', borderTop:`1px solid ${col.colorBorder}`, flexShrink:0 }}>
        <button onClick={() => onAddNew(col.id)}
          style={{ width:'100%', padding:'7px', borderRadius:7, cursor:'pointer',
            background:'transparent', border:`1px dashed ${col.colorBorder}`,
            color:'var(--text-3)', fontSize:11.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
            display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}
          onMouseEnter={e=>{ e.currentTarget.style.color=col.colorDot; e.currentTarget.style.borderColor=col.colorDot; }}
          onMouseLeave={e=>{ e.currentTarget.style.color='var(--text-3)'; e.currentTarget.style.borderColor=col.colorBorder; }}>
          <LucideIcon icon="plus" size={13}/>Adicionar
        </button>
      </div>
    </div>
  );
}

/* ── CopyBtn ─────────────────────────────────────────────────────*/
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(()=>setCopied(false),1800); });
  };
  return (
    <button onClick={copy} title="Copiar prompt"
      style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:6,
        border: copied?'1px solid rgba(74,222,128,.4)':'1px solid rgba(255,255,255,.12)',
        background: copied?'rgba(74,222,128,.1)':'rgba(255,255,255,.04)',
        color: copied?'#4ade80':'var(--text-3)',
        fontSize:10.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
        cursor: text?'pointer':'default', transition:'all 150ms', flexShrink:0 }}>
      <LucideIcon icon={copied?'check':'copy'} size={11}/>{copied?'Copiado':'Copiar'}
    </button>
  );
}

/* ── CopyAllPromptsBtn ───────────────────────────────────────────*/
function CopyAllPromptsBtn({ slidesArr }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const prompts = slidesArr.filter(s=>s.prompt)
      .map((s,i)=>`=== SLIDE ${i+1}${s.tipo?' — '+s.tipo:''}${s.titulo?': '+s.titulo:''} ===\n${s.prompt}`)
      .join('\n\n');
    if (!prompts) return;
    const txt = `Vou te passar ${slidesArr.filter(s=>s.prompt).length} prompts para gerar imagens de um carrossel de Instagram. Gere um por vez, começando pelo SLIDE 1. Após gerar, aguarde eu pedir o próximo.\n\n${prompts}`;
    navigator.clipboard.writeText(txt).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2500); });
  };
  const has = slidesArr.some(s=>s.prompt);
  return (
    <button onClick={copy} disabled={!has}
      style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:6,
        border: copied?'1px solid rgba(74,222,128,.4)':'1px solid rgba(96,165,250,.3)',
        background: copied?'rgba(74,222,128,.1)':'rgba(96,165,250,.1)',
        color: copied?'#4ade80':'#60a5fa',
        fontSize:11, fontFamily:'Roboto,sans-serif', fontWeight:700,
        cursor:has?'pointer':'default', transition:'all 150ms', flexShrink:0 }}>
      <LucideIcon icon={copied?'check':'sparkles'} size={12}/>{copied?'Copiado!':'Copiar prompts p/ ChatGPT'}
    </button>
  );
}

/* ── AdicionarCriativoOrganicoBtn ──────────────────────────────────
   Mesmo fluxo do Tráfego (adicionar-criativo.py), aqui usando o script
   adicionar-criativo-organico.py: busca a pasta ORG N no Drive, otimiza
   as imagens (1350px / 1920px stories, JPEG 82%) e sobe pro R2.
   Roda no Mac via serve.py; fora do Mac mostra aviso.
─────────────────────────────────────────────────────────────────*/
function AdicionarCriativoOrganicoBtn({ numero, cardId, onDone }) {
  const [step, setStep] = useState('idle'); // idle | running | warn
  const [msg, setMsg]   = useState('');
  const [pct, setPct]   = useState(0);

  // Importa da nuvem (cozinha via worker) — funciona de qualquer lugar, sem Mac.
  // A cozinha reporta o progresso real; o card é a rede de segurança.
  async function run(pasta) {
    const jobId = novoJobId();
    setStep('running'); setPct(0); setMsg('Preparando');
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const falhar = m => { setStep('warn'); setMsg(m); setPct(0); setTimeout(() => { setStep('idle'); setMsg(''); }, 6000); };
    const concluir = () => { setStep('idle'); setMsg(''); setPct(0); onDone && onDone(); };

    const endpoint = pasta ? '/import-link' : '/import-direto';
    const bodyObj  = pasta ? { card_id: cardId, drive_url: pasta, job_id: jobId } : { card_id: cardId, job_id: jobId };

    let slidesAntes = null;
    try {
      const res = await window.db.from('conteudo_organico').select('slides').eq('id', cardId).single();
      slidesAntes = JSON.stringify(res.data?.slides ?? null);
    } catch {}

    let erroRapido = null;
    fetch(`${WORKER_URL}${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyObj) })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok || d.error) erroRapido = d.error || `Erro ${r.status}`; })
      .catch(() => {});

    for (let i = 0; i < 300; i++) {            // 300 x 2s = 10 min
      await sleep(2000);
      if (erroRapido) return falhar(erroRapido);
      try {
        const p = await (await fetch(`${WORKER_URL}/progresso?job=${jobId}`)).json();
        if (p.erro) return falhar(p.erro);
        if (typeof p.pct === 'number') setPct(p.pct);
        if (p.etapa) setMsg(p.etapa);
        if (p.done) return concluir();
      } catch {}
      if (i % 3 === 0) {
        try {
          const res = await window.db.from('conteudo_organico').select('slides').eq('id', cardId).single();
          if (res.data && JSON.stringify(res.data.slides ?? null) !== slidesAntes) return concluir();
        } catch {}
      }
    }
    falhar('Demorou demais. Recarregue a página em instantes.');
  }

  function manual() {
    const p = window.prompt('Cole o link ou ID da pasta do criativo no Drive:');
    if (p && p.trim()) run(p.trim());
  }

  if (step === 'running') {
    return <BarraProgresso pct={pct} etapa={msg}/>;
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {step === 'warn' && (
        <div style={{ padding:'6px 10px', borderRadius:8, background:'rgba(248,113,113,.08)',
          border:'1px solid rgba(248,113,113,.3)', fontSize:11, color:'#f87171', lineHeight:1.4 }}>{msg}</div>
      )}
      <div style={{ display:'flex', gap:8 }}>
        <Btn variant="secondary" size="sm" icon="folder-down" style={{ flex:1, justifyContent:'center' }}
          onClick={() => run(null)}>Importar direto</Btn>
        <Btn variant="ghost" size="sm" icon="link" style={{ justifyContent:'center' }}
          onClick={manual} title="Colar o link de uma pasta do Drive">Importar com link</Btn>
      </div>
    </div>
  );
}

/* ── SlideBlock ──────────────────────────────────────────────────*/
const SLIDE_NOMES = ['Capa','Contexto','Situação','Argumento','Solução','CTA','Encerramento'];

function SlideBlock({ slide, index, total, onChange, onRemove, file, onFileChange }) {
  const [open, setOpen] = useState(false);
  const fileRef = useRef();
  const set = (k, v) => onChange(index, { ...slide, [k]: v });

  const previewUrl = file
    ? URL.createObjectURL(file)
    : (slide.image_url || null);

  return (
    <div style={{ border:'1px solid rgba(255,255,255,.1)', borderRadius:10,
      background:'rgba(255,255,255,.03)', overflow:'hidden' }}>

      <div onClick={()=>setOpen(o=>!o)}
        style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'10px 14px', cursor:'pointer', userSelect:'none',
          borderBottom: open?'1px solid rgba(255,255,255,.08)':'none' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {previewUrl
            ? <img src={previewUrl} style={{ width:22, height:22, borderRadius:5, objectFit:'cover', border:'1px solid rgba(255,255,255,.15)' }}/>
            : <span style={{ width:22, height:22, borderRadius:6, background:'rgba(96,165,250,.15)',
                border:'1px solid rgba(96,165,250,.3)', display:'flex', alignItems:'center',
                justifyContent:'center', fontSize:10, fontWeight:900,
                fontFamily:'Roboto,sans-serif', color:'#60a5fa', flexShrink:0 }}>
                {index+1}
              </span>}
          <span style={{ fontSize:12.5, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-1)' }}>
            Slide {index+1}
            {slide.tipo && <span style={{ fontWeight:400, color:'var(--text-3)', marginLeft:6 }}>— {slide.tipo}</span>}
          </span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {total > 1 && (
            <button onClick={e=>{e.stopPropagation();onRemove(index);}}
              style={{ border:'none', background:'rgba(248,113,113,.12)', color:'#f87171',
                borderRadius:5, width:22, height:22, cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center' }}>
              <LucideIcon icon="trash-2" size={11}/>
            </button>
          )}
          <LucideIcon icon={open?'chevron-up':'chevron-down'} size={14} style={{ color:'var(--text-3)' }}/>
        </div>
      </div>

      {open && (
        <div style={{ padding:'14px', display:'flex', flexDirection:'column', gap:12 }}>

          {/* Upload de imagem */}
          <div>
            <label style={LABEL_STYLE}>Imagem do slide</label>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              {previewUrl && (
                <img src={previewUrl} style={{ width:56, height:56, borderRadius:8,
                  objectFit:'cover', border:'1px solid rgba(255,255,255,.15)', flexShrink:0 }}/>
              )}
              <button onClick={()=>fileRef.current.click()}
                style={{ flex:1, padding:'9px', borderRadius:8, cursor:'pointer',
                  background:'rgba(255,255,255,.03)', border:'1px dashed rgba(255,255,255,.2)',
                  color:'var(--text-3)', fontSize:11, fontFamily:'Roboto,sans-serif', fontWeight:700,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                <LucideIcon icon="upload" size={13}/>
                {previewUrl ? 'Trocar imagem' : 'Selecionar imagem'}
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }}
                onChange={e => e.target.files[0] && onFileChange(index, e.target.files[0])}/>
            </div>
          </div>

          {/* Tipo */}
          <div>
            <label style={LABEL_STYLE}>Tipo</label>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
              {SLIDE_NOMES.map(n => {
                const active = slide.tipo === n;
                return (
                  <button key={n} onClick={()=>set('tipo',n)}
                    style={{ padding:'4px 10px', borderRadius:999, fontSize:10.5, cursor:'pointer',
                      fontFamily:'Roboto,sans-serif', fontWeight:700, transition:'all 120ms',
                      background: active?'rgba(96,165,250,.2)':'rgba(255,255,255,.04)',
                      border: active?'1px solid rgba(96,165,250,.5)':'1px solid rgba(255,255,255,.1)',
                      color: active?'#60a5fa':'var(--text-3)' }}>
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={LABEL_STYLE}>Título</label>
            <input value={slide.titulo||''} onChange={e=>set('titulo',e.target.value)}
              placeholder="Título do slide" style={{ ...FIELD_STYLE, resize:'none' }}/>
          </div>

          <div>
            <label style={LABEL_STYLE}>Subtítulo</label>
            <input value={slide.subtitulo||''} onChange={e=>set('subtitulo',e.target.value)}
              placeholder="Subtítulo ou segunda linha" style={{ ...FIELD_STYLE, resize:'none' }}/>
          </div>

          <div>
            <label style={LABEL_STYLE}>Visual / Imagem</label>
            <textarea value={slide.visual||''} onChange={e=>set('visual',e.target.value)}
              rows={2} placeholder="Descrição da imagem, fundo, composição..." style={FIELD_STYLE}/>
          </div>

          <div>
            <label style={LABEL_STYLE}>Tag / Etiqueta</label>
            <input value={slide.tag||''} onChange={e=>set('tag',e.target.value)}
              placeholder="Ex: FOTÓGRAFO E VIDEOMAKER, ANTES DE CONTINUAR..."
              style={{ ...FIELD_STYLE, resize:'none' }}/>
          </div>

          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
              <label style={{ ...LABEL_STYLE, marginBottom:0 }}>Prompt de imagem</label>
              <CopyBtn text={slide.prompt||''}/>
            </div>
            <textarea value={slide.prompt||''} onChange={e=>set('prompt',e.target.value)}
              rows={3} placeholder="Prompt para gerar a imagem deste slide no ChatGPT / Midjourney..."
              style={FIELD_STYLE}/>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── PublishModal ────────────────────────────────────────────────*/
function PublishModal({ form, slidesArr, slideFiles, onClose, onSuccess }) {
  const [modo, setModo]           = useState('agora');
  const [schedDate, setDate]      = useState('');
  const [schedTime, setTime]      = useState('09:00');
  const [phase, setPhase]         = useState('idle');
  const [msg, setMsg]             = useState('');
  const [comFacebook, setFB]      = useState(false);

  const isReels = form.plataforma === 'Reels';
  const reelsVideo = (() => {
    if (!isReels) return null;
    let mf = form.media_files;
    if (typeof mf === 'string') { try { mf = JSON.parse(mf); } catch { mf = null; } }
    return Array.isArray(mf) ? mf.find(m => m.tipo === 'video') : null;
  })();

  const hasImages = isReels
    ? !!reelsVideo?.url_alta
    : form.plataforma === 'Carrossel'
      ? slidesArr.some((s, i) => slideFiles[i] || s.image_url)
      : (slideFiles[0] || slidesArr[0]?.image_url);

  const runReels = async () => {
    try {
      setPhase('publishing');
      const caption = (form.legenda || form.gancho || '').trim();
      const scheduleAt = modo === 'agendar' && schedDate
        ? new Date(`${schedDate}T${schedTime}:00-03:00`).toISOString()
        : null;

      let pubData;
      if (modo === 'agendar' && scheduleAt) {
        setMsg('Salvando agendamento...');
        const r = await fetch(`${WORKER_URL}/schedule`, {
          method: 'POST', headers: { 'Content-Type':'application/json' },
          body: JSON.stringify({ itemId: form.id, scheduleAt, videoUrl: reelsVideo.url_alta,
            thumbUrl: reelsVideo.thumb_url, caption, tipo: 'reels', comFacebook }),
        });
        pubData = await r.json();
        if (!pubData.ok) throw new Error(pubData.error || 'Falha ao agendar.');
      } else {
        setMsg('Publicando Reels no Instagram' + (comFacebook ? ' e Facebook' : '') + '... isso pode levar até 1 minuto (processamento do vídeo).');
        const r = await fetch(`${WORKER_URL}/publish`, {
          method: 'POST', headers: { 'Content-Type':'application/json' },
          body: JSON.stringify({ tipo: 'reels', videoUrl: reelsVideo.url_alta, thumbUrl: reelsVideo.thumb_url,
            caption, scheduleAt: null, comFacebook }),
        });
        pubData = await r.json();
        if (!pubData.ok) throw new Error(pubData.error || 'Falha na publicação.');
      }

      setPhase('done');
      setMsg(modo === 'agendar'
        ? `Agendado para ${schedDate.split('-').reverse().join('/')} às ${schedTime}.`
        : 'Reels publicado com sucesso!');
      setTimeout(() => onSuccess(slidesArr, pubData.postId, modo === 'agendar', schedDate, scheduleAt), 1400);
    } catch (e) {
      setPhase('error'); setMsg(e.message || 'Erro desconhecido.');
    }
  };

  const run = async () => {
    if (isReels) return runReels();
    try {
      setPhase('uploading'); setMsg('Subindo imagens para o R2...');

      const uploadForm = new FormData();
      let uploadCount  = 0;
      const slideIdxMap = [];  // mapeia uploadCount → slideIdx

      if (form.plataforma === 'Carrossel') {
        for (let i = 0; i < slidesArr.length; i++) {
          const f = slideFiles[i];
          if (!f) continue;
          const thumb = await compressToWebP(f);
          uploadForm.append(`file_${uploadCount}`,  f,     `slide_${i}_orig.${f.name.split('.').pop()}`);
          uploadForm.append(`thumb_${uploadCount}`, thumb, `slide_${i}_thumb.webp`);
          slideIdxMap.push(i);
          uploadCount++;
        }
      } else {
        const f = slideFiles[0];
        if (f) {
          const thumb = await compressToWebP(f);
          uploadForm.append('file_0',  f,     `imagem_orig.${f.name.split('.').pop()}`);
          uploadForm.append('thumb_0', thumb, 'imagem_thumb.webp');
          slideIdxMap.push(0);
          uploadCount = 1;
        }
      }

      let uploadedFiles = [];
      if (uploadCount > 0) {
        const upRes  = await fetch(`${WORKER_URL}/upload`, { method:'POST', body:uploadForm });
        const upData = await upRes.json();
        if (!upData.ok) throw new Error(upData.error || 'Falha no upload.');
        uploadedFiles = upData.files;
      }

      // Monta imageUrls: novos uploads têm prioridade; fallback = URL já salva no slide
      let imageUrls = [];
      const origKeys = [];

      if (form.plataforma === 'Carrossel') {
        let fi = 0;
        for (let i = 0; i < slidesArr.length; i++) {
          if (slideFiles[i] && uploadedFiles[fi]) {
            // Arquivo novo enviado agora → usa URL do upload recém-feito
            imageUrls.push(uploadedFiles[fi].origUrl);
            origKeys.push(uploadedFiles[fi].origKey);
            fi++;
          } else if (slidesArr[i]?.image_url) {
            // Imagem já existe no R2 → usa URL salva (não deletar após publicar)
            imageUrls.push(slidesArr[i].image_url);
          }
        }
      } else {
        if (uploadedFiles[0]) {
          imageUrls.push(uploadedFiles[0].origUrl);
          origKeys.push(uploadedFiles[0].origKey);
        } else if (slidesArr[0]?.image_url) {
          imageUrls.push(slidesArr[0].image_url);
        }
      }

      if (!imageUrls.length) throw new Error('Nenhuma imagem disponível para publicar. Adicione imagens ao carrossel primeiro.');

      setPhase('publishing');

      const caption    = (form.legenda || form.gancho || '').trim();
      const tipo       = form.plataforma === 'Carrossel' ? 'carrossel' : 'imagem';
      const scheduleAt = modo === 'agendar' && schedDate
        ? new Date(`${schedDate}T${schedTime}:00-03:00`).toISOString()
        : null;

      let pubData;

      if (modo === 'agendar' && scheduleAt) {
        // Agendamento próprio: salva no Supabase, cron do Worker publica na hora certa
        setMsg('Salvando agendamento...');
        const schedRes = await fetch(`${WORKER_URL}/schedule`, {
          method: 'POST',
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify({ itemId: form.id, scheduleAt, imageUrls, origKeys, caption, tipo, comFacebook }),
        });
        pubData = await schedRes.json();
        if (!pubData.ok) throw new Error(pubData.error || 'Falha ao agendar.');
      } else {
        // Publicação imediata
        setMsg('Publicando' + (comFacebook ? ' no Instagram e Facebook...' : ' no Instagram...'));
        const pubRes = await fetch(`${WORKER_URL}/publish`, {
          method: 'POST',
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify({ tipo, imageUrls, caption, scheduleAt: null, origKeys, comFacebook }),
        });
        pubData = await pubRes.json();
        if (!pubData.ok) throw new Error(pubData.error || 'Falha na publicação.');
      }

      // Atualiza slides com thumbUrls das novas imagens
      let fi = 0;
      const newSlides = slidesArr.map((s, i) => {
        if (slideFiles[i] && uploadedFiles[fi]) {
          const updated = { ...s, image_url: uploadedFiles[fi].thumbUrl };
          fi++;
          return updated;
        }
        return s;
      });

      setPhase('done');
      setMsg(modo === 'agendar'
        ? `Agendado para ${schedDate.split('-').reverse().join('/')} às ${schedTime}.`
        : 'Publicado no Instagram com sucesso.');

      onSuccess(newSlides, pubData.postId, modo === 'agendar', schedDate || null, scheduleAt);

    } catch (err) {
      setPhase('error');
      setMsg(err.message);
    }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:800,
      display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      onClick={e => e.target === e.currentTarget && phase !== 'uploading' && phase !== 'publishing' && onClose()}>

      <div style={{ background:'#1a1b1f', border:'1px solid rgba(255,255,255,.12)',
        borderRadius:16, width:'100%', maxWidth:400, padding:'24px',
        boxShadow:'0 32px 80px rgba(0,0,0,.6)' }}>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:10, background:'rgba(234,170,65,.15)',
              border:'1px solid rgba(234,170,65,.3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <LucideIcon icon="send" size={16} style={{ color:'#eaaa41' }}/>
            </div>
            <div>
              <div style={{ fontSize:14, fontFamily:'Roboto,sans-serif', fontWeight:900, color:'var(--text-1)' }}>
                Publicar no Meta
              </div>
              <div style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'var(--text-3)' }}>
                Instagram · {form.plataforma}
              </div>
            </div>
          </div>
          {phase !== 'uploading' && phase !== 'publishing' && (
            <button onClick={onClose} style={{ border:'none', background:'transparent',
              color:'var(--text-3)', cursor:'pointer', padding:4 }}>
              <LucideIcon icon="x" size={18}/>
            </button>
          )}
        </div>

        {(phase === 'idle' || phase === 'error') && (<>
          <div style={{ display:'flex', gap:4, padding:4, borderRadius:10, background:'rgba(255,255,255,.04)',
            border:'1px solid var(--app-border)', marginBottom:20 }}>
            {[['agora','Publicar agora','zap'],['agendar','Agendar','clock']].map(([id,label,icon]) => (
              <button key={id} onClick={()=>setModo(id)}
                style={{ flex:1, padding:'9px', borderRadius:7, cursor:'pointer',
                  background: modo===id ? 'rgba(234,170,65,.18)' : 'transparent',
                  border: modo===id ? '1px solid rgba(234,170,65,.35)' : '1px solid transparent',
                  color: modo===id ? '#eaaa41' : 'var(--text-3)',
                  fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:12, transition:'all 130ms',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                <LucideIcon icon={icon} size={13}/>{label}
              </button>
            ))}
          </div>

          {modo === 'agendar' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
              <div>
                <label style={LABEL_STYLE}>Data</label>
                <input type="date" value={schedDate} onChange={e=>setDate(e.target.value)}
                  min={new Date().toISOString().slice(0,10)}
                  style={{ ...FIELD_STYLE, resize:'none', colorScheme:'dark' }}/>
              </div>
              <div>
                <label style={LABEL_STYLE}>Horário (Brasília)</label>
                <input type="time" value={schedTime} onChange={e=>setTime(e.target.value)}
                  style={{ ...FIELD_STYLE, resize:'none', colorScheme:'dark' }}/>
              </div>
            </div>
          )}

          {!hasImages && (
            <div style={{ padding:'10px 12px', borderRadius:8, background:'rgba(251,191,36,.08)',
              border:'1px solid rgba(251,191,36,.2)', marginBottom:16,
              fontSize:11.5, fontFamily:'Roboto,sans-serif', color:'#fbbf24', lineHeight:1.5 }}>
              <LucideIcon icon="alert-triangle" size={13} style={{ marginRight:6 }}/>
              Selecione ao menos uma imagem nos slides antes de publicar.
            </div>
          )}

          {phase === 'error' && (
            <div style={{ padding:'10px 12px', borderRadius:8, background:'rgba(248,113,113,.08)',
              border:'1px solid rgba(248,113,113,.2)', marginBottom:16,
              fontSize:11.5, fontFamily:'Roboto,sans-serif', color:'#f87171', lineHeight:1.5 }}>
              {msg}
            </div>
          )}

          {/* Opção Facebook */}
          <label onClick={() => setFB(v => !v)}
            style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer',
              padding:'10px 12px', borderRadius:9, marginBottom:14,
              background: comFacebook ? 'rgba(24,119,242,.12)' : 'rgba(255,255,255,.04)',
              border: `1px solid ${comFacebook ? 'rgba(24,119,242,.35)' : 'var(--app-border)'}`,
              transition:'all 150ms' }}>
            <div style={{ width:18, height:18, borderRadius:4, flexShrink:0,
              background: comFacebook ? '#1877f2' : 'transparent',
              border: `2px solid ${comFacebook ? '#1877f2' : 'rgba(255,255,255,.25)'}`,
              display:'flex', alignItems:'center', justifyContent:'center', transition:'all 150ms' }}>
              {comFacebook && <LucideIcon icon="check" size={11} style={{ color:'#fff' }}/>}
            </div>
            <div>
              <div style={{ fontSize:12.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
                color: comFacebook ? '#60a5fa' : 'var(--text-2)' }}>
                Publicar também no Facebook
              </div>
              <div style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', color:'var(--text-3)', marginTop:1 }}>
                Página: Fotografia é o Meu Negócio
              </div>
            </div>
          </label>

          <button onClick={run}
            disabled={!hasImages || (modo==='agendar' && !schedDate)}
            style={{ width:'100%', padding:'13px', borderRadius:10, cursor:'pointer',
              background: (hasImages && (modo==='agora'||schedDate)) ? '#eaaa41' : 'rgba(255,255,255,.08)',
              color: (hasImages && (modo==='agora'||schedDate)) ? '#000' : 'var(--text-3)',
              border:'none', fontFamily:'Roboto,sans-serif', fontWeight:900, fontSize:13,
              transition:'all 150ms', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            <LucideIcon icon={modo==='agendar'?'clock':'send'} size={15}/>
            {modo === 'agendar' ? 'Agendar publicação' : 'Publicar agora'}
          </button>
        </>)}

        {(phase === 'uploading' || phase === 'publishing') && (
          <div style={{ textAlign:'center', padding:'12px 0 20px' }}>
            <style>{`
              @keyframes org-launch {
                0%   { transform: translateY(52px) rotate(-45deg); opacity:0; }
                14%  { transform: translateY(34px) rotate(-45deg); opacity:1; }
                62%  { transform: translateY(-14px) rotate(-45deg); opacity:1; }
                86%  { transform: translateY(-68px) rotate(-45deg); opacity:0; }
                100% { transform: translateY(-68px) rotate(-45deg); opacity:0; }
              }
              @keyframes org-particle {
                0%   { transform: translate(0,52px) scale(0); opacity:0; }
                14%  { transform: translate(0,34px) scale(1); opacity:1; }
                100% { transform: translate(var(--ptx),108px) scale(0); opacity:0; }
              }
              @keyframes org-twinkle {
                from { opacity:.1; transform:scale(1); }
                to   { opacity:.75; transform:scale(1.5); }
              }
              @keyframes org-dots {
                0%,80%,100% { transform:translateY(0); }
                40%         { transform:translateY(-4px); }
              }
            `}</style>

            {/* Palco do foguete */}
            <div style={{ position:'relative', height:140, display:'flex',
              alignItems:'center', justifyContent:'center', overflow:'hidden' }}>

              {/* Estrelinhas */}
              {[
                {s:3,t:10,l:30,d:.3},{s:2,t:25,l:210,d:.7},{s:3,t:48,l:250,d:.1},
                {s:2,t:68,l:14,d:.9},{s:2,t:18,l:145,d:.5},{s:3,t:88,l:265,d:.2},
              ].map((st,i) => (
                <div key={i} style={{
                  position:'absolute', width:st.s, height:st.s, borderRadius:'50%',
                  background:'#fff', top:st.t, left:st.l,
                  animation:`org-twinkle 1.6s ${st.d}s ease-in-out infinite alternate`,
                }}/>
              ))}

              {/* Foguete */}
              <div style={{
                position:'absolute', fontSize:46,
                animation:'org-launch 2.4s cubic-bezier(.4,0,.2,1) infinite',
                filter:'drop-shadow(0 0 10px rgba(234,170,65,.55))',
              }}>🚀</div>

              {/* Partículas */}
              {[
                {c:'#f59e0b',d:0,   tx:'-18px'},{c:'#ef4444',d:.08, tx:'14px'},
                {c:'#eaaa41',d:.16, tx:'-8px'}, {c:'#f97316',d:.06, tx:'20px'},
                {c:'#fbbf24',d:.22, tx:'-22px'},{c:'#ef4444',d:.12, tx:'6px'},
              ].map((p,i) => (
                <div key={i} style={{
                  position:'absolute', width:6, height:6, borderRadius:'50%',
                  background:p.c, '--ptx':p.tx,
                  animation:`org-particle 2.4s ${p.d}s ease-out infinite`,
                }}/>
              ))}
            </div>

            {/* Texto */}
            <div style={{ fontSize:14, fontFamily:'Roboto,sans-serif', fontWeight:700,
              color:'var(--text-1)', marginBottom:5, letterSpacing:'.01em' }}>
              {phase === 'uploading' ? 'Enviando imagens' : 'Publicando'}
              {[0,1,2].map(i => (
                <span key={i} style={{
                  display:'inline-block',
                  animation:`org-dots .9s ${i*.15}s ease-in-out infinite`,
                }}>.</span>
              ))}
            </div>
            <div style={{ fontSize:11.5, fontFamily:'Roboto,sans-serif', color:'var(--text-3)' }}>{msg}</div>
          </div>
        )}

        {phase === 'done' && (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ width:52, height:52, borderRadius:'50%', background:'rgba(74,222,128,.12)',
              border:'1px solid rgba(74,222,128,.3)', display:'flex', alignItems:'center',
              justifyContent:'center', margin:'0 auto 14px' }}>
              <LucideIcon icon="check" size={26} style={{ color:'#4ade80' }}/>
            </div>
            <div style={{ fontSize:14, fontFamily:'Roboto,sans-serif', fontWeight:900, color:'var(--text-1)', marginBottom:6 }}>
              {modo === 'agendar' ? 'Agendado!' : 'Publicado!'}
            </div>
            <div style={{ fontSize:12, fontFamily:'Roboto,sans-serif', color:'var(--text-3)', marginBottom:20 }}>{msg}</div>
            <button onClick={onClose}
              style={{ padding:'10px 28px', borderRadius:8, background:'rgba(74,222,128,.15)',
                border:'1px solid rgba(74,222,128,.3)', color:'#4ade80',
                fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:12, cursor:'pointer' }}>
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── ResponsavelAvatar ───────────────────────────────────────────*/
function ResponsavelAvatar({ nome, size=24, active=false }) {
  const cfg = RESPONSAVEL_CONFIG[nome] || { initials:(nome||'?')[0], color:'#94a3b8', bg:'rgba(148,163,184,.18)', photo:null };
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', flexShrink:0, overflow:'hidden',
      display:'flex', alignItems:'center', justifyContent:'center',
      background: active ? cfg.bg : 'rgba(255,255,255,.08)',
      border: `2px solid ${active ? cfg.color+'88' : 'rgba(255,255,255,.12)'}`,
      transition:'all 150ms' }}>
      {cfg.photo
        ? <img src={cfg.photo} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
        : <span style={{ fontSize:size*0.32, fontFamily:'Roboto,sans-serif', fontWeight:900,
            color: active ? cfg.color : 'rgba(255,255,255,.35)', lineHeight:1, userSelect:'none' }}>
            {cfg.initials}
          </span>
      }
    </div>
  );
}

/* ── ContentModal ────────────────────────────────────────────────*/
const EMPTY_SLIDE = () => ({ tipo:'', titulo:'', subtitulo:'', visual:'', tag:'', prompt:'', image_url:'' });

function parseSlides(raw) {
  if (!raw) return [EMPTY_SLIDE()];
  try { const a = JSON.parse(raw); return Array.isArray(a) && a.length ? a : [EMPTY_SLIDE()]; }
  catch { return [EMPTY_SLIDE()]; }
}

function ContentModal({ item, defaultStatus, prefillDate, siblings=[], onNavigate, onSave, onClose, onDelete, onImported }) {
  const isNew = !item?.id;
  const [form, setForm] = useState(item || {
    tema:'', plataforma:'Reels', responsavel:'Felipe',
    status: defaultStatus || 'Fazer',
    gancho:'', desenvolvimento:'', slides:'', legenda:'', cta:'',
    prompt_imagem:'', referencia:'',
    data_prevista: prefillDate || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const [slidesArr, setSlidesArr]     = useState(() => parseSlides(form.slides));
  const [slideFiles, setSlideFiles]   = useState({});
  const [showPublish, setShowPublish] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saveStatus, setSaveStatus]   = useState('idle');

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const currentCol = COLUMNS.find(c => c.id === form.status) || COLUMNS[0];
  const sibIdx  = siblings.findIndex(s => s.id === item?.id);
  const hasPrev = sibIdx > 0;
  const hasNext = sibIdx < siblings.length - 1;
  const goPrev  = () => onNavigate && hasPrev && onNavigate(siblings[sibIdx - 1]);
  const goNext  = () => onNavigate && hasNext && onNavigate(siblings[sibIdx + 1]);

  const updateSlide = (idx, updated) => setSlidesArr(prev => prev.map((s,i) => i===idx?updated:s));
  const addSlide    = () => setSlidesArr(prev => [...prev, EMPTY_SLIDE()]);
  const removeSlide = idx => {
    setSlidesArr(prev => prev.filter((_,i) => i!==idx));
    setSlideFiles(prev => {
      const next = {};
      Object.entries(prev).forEach(([k,v]) => {
        const ki = parseInt(k);
        if (ki !== idx) next[ki > idx ? ki - 1 : ki] = v;
      });
      return next;
    });
  };
  const handleFileChange = (idx, file) => setSlideFiles(prev => ({ ...prev, [idx]: file }));

  const handleSave = async () => {
    setSaveStatus('saving');
    const finalSlides = form.plataforma === 'Carrossel' ? JSON.stringify(slidesArr) : form.slides;
    await onSave({ ...form, slides: finalSlides });
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handlePublishSuccess = (newSlides, postId, scheduled, scheduledDate, scheduledAtISO) => {
    const updatedSlides = form.plataforma === 'Carrossel' ? JSON.stringify(newSlides) : form.slides;
    const newStatus     = scheduled ? 'Agendado' : 'Feito';
    const updated       = {
      ...form,
      slides: updatedSlides,
      status: newStatus,
      ...(scheduled && scheduledDate ? { data_prevista: scheduledDate } : {}),
      ...(scheduled && scheduledAtISO ? { scheduled_at: scheduledAtISO } : {}),
      // Publicação imediata: registra "agora" como o horário publicado, pro calendário mostrar.
      ...(!scheduled ? { published_at: new Date().toISOString() } : {}),
      // Guarda o id do post no Meta pra casar com as métricas orgânicas depois.
      ...(!scheduled && postId ? { meta_media_id: postId } : {}),
    };
    setForm(updated);
    setSlidesArr(newSlides);
    onSave(updated);
  };

  const canShowPublish = !isNew && (form.plataforma === 'Carrossel' || form.plataforma === 'Imagem' || form.plataforma === 'Reels');

  // Painel esquerdo — navegador de slides embarcado
  const [previewIdx, setPreviewIdx] = useState(0);
  const [lightbox, setLightbox]     = useState(null); // índice aberto na visualização ampliada
  const previewUrls = slidesArr.map(s => s.image_url).filter(Boolean);
  const hasPreview  = previewUrls.length > 0;

  return (
    <>
      {showPublish && (
        <PublishModal
          form={form}
          slidesArr={slidesArr}
          slideFiles={slideFiles}
          onClose={() => setShowPublish(false)}
          onSuccess={handlePublishSuccess}/>
      )}

      {/* overlay full-screen */}
      <div onClick={e => e.target === e.currentTarget && onClose()}
        style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:700,
          display:'flex', alignItems:'stretch', justifyContent:'stretch', padding:20 }}>

        {/* container principal */}
        <div onClick={e => e.stopPropagation()}
          style={{ flex:1, background:'var(--app-surface)', border:'1px solid var(--app-border-2)',
            borderRadius:16, overflow:'hidden', boxShadow:'0 32px 80px rgba(0,0,0,.65)',
            display:'flex', flexDirection:'column' }}>

          {/* ── Header ── */}
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--app-border)',
            display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0, flex:1 }}>
              <button onClick={onClose}
                style={{ display:'flex', alignItems:'center', gap:5, color:'var(--text-2)',
                  cursor:'pointer', fontFamily:'Roboto,sans-serif', fontSize:11, fontWeight:700,
                  letterSpacing:'0.04em', textTransform:'uppercase', padding:'5px 10px',
                  borderRadius:6, background:'rgba(255,255,255,.05)', border:'1px solid var(--app-border)',
                  transition:'color 150ms', flexShrink:0 }}
                onMouseEnter={e=>e.currentTarget.style.color='var(--fmn-gold)'}
                onMouseLeave={e=>e.currentTarget.style.color='var(--text-2)'}>
                <LucideIcon icon="chevron-left" size={14}/>Orgânico
              </button>
              {siblings.length > 1 && (
                <div style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
                  <button onClick={goPrev} disabled={!hasPrev} title="Card anterior na coluna"
                    style={{ width:26, height:26, borderRadius:7, cursor:hasPrev?'pointer':'default',
                      background:'rgba(255,255,255,.06)', border:'1px solid var(--app-border)',
                      color:hasPrev?'var(--text-2)':'rgba(255,255,255,.15)',
                      display:'flex', alignItems:'center', justifyContent:'center', transition:'all 150ms' }}
                    onMouseEnter={e=>hasPrev&&(e.currentTarget.style.color='var(--fmn-gold)')}
                    onMouseLeave={e=>e.currentTarget.style.color=hasPrev?'var(--text-2)':'rgba(255,255,255,.15)'}>
                    <LucideIcon icon="chevron-up" size={13}/>
                  </button>
                  <button onClick={goNext} disabled={!hasNext} title="Próximo card na coluna"
                    style={{ width:26, height:26, borderRadius:7, cursor:hasNext?'pointer':'default',
                      background:'rgba(255,255,255,.06)', border:'1px solid var(--app-border)',
                      color:hasNext?'var(--text-2)':'rgba(255,255,255,.15)',
                      display:'flex', alignItems:'center', justifyContent:'center', transition:'all 150ms' }}
                    onMouseEnter={e=>hasNext&&(e.currentTarget.style.color='var(--fmn-gold)')}
                    onMouseLeave={e=>e.currentTarget.style.color=hasNext?'var(--text-2)':'rgba(255,255,255,.15)'}>
                    <LucideIcon icon="chevron-down" size={13}/>
                  </button>
                  <span style={{ fontSize:10.5, fontFamily:'Roboto,sans-serif', color:'var(--text-3)', minWidth:28 }}>
                    {sibIdx + 1}/{siblings.length}
                  </span>
                </div>
              )}
              {!isNew && item?.numero && (
                <span style={{ fontSize:12, fontFamily:'Roboto,sans-serif', fontWeight:900,
                  letterSpacing:'0.08em', textTransform:'uppercase', color:currentCol.colorDot,
                  background:`${currentCol.colorDot}1a`, border:`1px solid ${currentCol.colorDot}40`,
                  borderRadius:6, padding:'3px 9px', flexShrink:0 }}>
                  ORG {String(item.numero).padStart(3,'0')}
                </span>
              )}
              {isNew ? (
                <span style={{ fontSize:14.5, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-1)' }}>
                  Novo conteúdo orgânico
                </span>
              ) : (
                <input value={form.tema} onChange={e=>set('tema',e.target.value)}
                  placeholder="Título do conteúdo"
                  style={{ fontSize:14.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
                    color:'var(--text-1)', lineHeight:1.4, background:'transparent',
                    border:'1px solid transparent', borderRadius:6, padding:'2px 6px',
                    outline:'none', flex:'1 1 auto', minWidth:0, width:'100%', transition:'border-color 150ms' }}
                  onFocus={e => e.target.style.borderColor='rgba(234,170,65,.4)'}
                  onBlur={e => e.target.style.borderColor='transparent'}/>
              )}
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
              {saveStatus === 'saved' && (
                <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'var(--clr-pos)' }}>Salvo!</span>
              )}
              {canShowPublish && (
                <button onClick={()=>setShowPublish(true)}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px',
                    borderRadius:8, cursor:'pointer', background:'rgba(234,170,65,.12)',
                    border:'1px solid rgba(234,170,65,.35)', color:'#eaaa41',
                    fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:12, transition:'all 140ms' }}>
                  <LucideIcon icon="send" size={13}/>Publicar
                </button>
              )}
              {!isNew && (
                deleteConfirm ? (
                  <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 10px',
                    borderRadius:8, background:'rgba(248,113,113,.1)', border:'1px solid rgba(248,113,113,.3)' }}>
                    <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'#f87171' }}>Confirmar?</span>
                    <button onClick={()=>onDelete(form.id)}
                      style={{ padding:'4px 10px', borderRadius:6, background:'#f87171', color:'#fff',
                        fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:11, cursor:'pointer' }}>
                      Apagar
                    </button>
                    <button onClick={()=>setDeleteConfirm(false)}
                      style={{ padding:'4px 8px', borderRadius:6, background:'rgba(255,255,255,.07)',
                        border:'1px solid var(--app-border)', color:'var(--text-3)',
                        fontFamily:'Roboto,sans-serif', fontSize:11, cursor:'pointer' }}>
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button onClick={()=>setDeleteConfirm(true)}
                    style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px',
                      borderRadius:8, cursor:'pointer', background:'rgba(248,113,113,.08)',
                      border:'1px solid rgba(248,113,113,.2)', color:'#f87171',
                      fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:12 }}>
                    <LucideIcon icon="trash-2" size={13}/>
                  </button>
                )
              )}
              <Btn variant="ghost" size="sm" onClick={onClose}>Cancelar</Btn>
              <Btn variant="primary" size="sm" icon={saveStatus==='saving'?'loader':'check'}
                onClick={handleSave} disabled={saveStatus==='saving'}>
                {saveStatus==='saving'?'Salvando...':isNew?'Criar':'Salvar'}
              </Btn>
            </div>
          </div>

          {/* ── Body: dois painéis ── */}
          <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

            {/* Painel esquerdo — preview de slides */}
            <div style={{ width:340, flexShrink:0, borderRight:'1px solid var(--app-border)',
              background:'rgba(0,0,0,.25)', display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center', padding:24, gap:16 }}>

              {hasPreview ? (<>
                {/* Imagem principal */}
                <div style={{ position:'relative', width:'100%', maxWidth:280, borderRadius:10,
                  overflow:'hidden', background:'rgba(255,255,255,.04)',
                  border:'1px solid rgba(255,255,255,.08)' }}>
                  {/\.(mp4|webm|mov|m4v)$/i.test(previewUrls[previewIdx] || '')
                    ? <video src={previewUrls[previewIdx]} muted loop playsInline
                        onClick={() => setLightbox(previewIdx)} title="Clique para ampliar"
                        onMouseEnter={e => e.currentTarget.play()} onMouseLeave={e => e.currentTarget.pause()}
                        style={{ width:'100%', display:'block', aspectRatio:'4/5', objectFit:'cover', cursor:'zoom-in' }}/>
                    : <img src={previewUrls[previewIdx]} alt={`Slide ${previewIdx+1}`}
                        onClick={() => setLightbox(previewIdx)} title="Clique para ampliar"
                        style={{ width:'100%', display:'block', aspectRatio:'4/5', objectFit:'cover', cursor:'zoom-in' }}/>}
                  {previewUrls.length > 1 && (<>
                    <button onClick={()=>setPreviewIdx(i=>(i-1+previewUrls.length)%previewUrls.length)}
                      style={{ position:'absolute', left:6, top:'50%', transform:'translateY(-50%)',
                        background:'rgba(0,0,0,.65)', border:'none', borderRadius:'50%',
                        width:28, height:28, cursor:'pointer', color:'#fff',
                        display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <LucideIcon icon="chevron-left" size={14}/>
                    </button>
                    <button onClick={()=>setPreviewIdx(i=>(i+1)%previewUrls.length)}
                      style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)',
                        background:'rgba(0,0,0,.65)', border:'none', borderRadius:'50%',
                        width:28, height:28, cursor:'pointer', color:'#fff',
                        display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <LucideIcon icon="chevron-right" size={14}/>
                    </button>
                  </>)}
                </div>

                {/* Contador + dots */}
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'var(--text-3)', fontWeight:700 }}>
                    {previewIdx+1} / {previewUrls.length}
                  </span>
                  {previewUrls.length > 1 && (
                    <div style={{ display:'flex', gap:5 }}>
                      {previewUrls.map((_,i) => (
                        <button key={i} onClick={()=>setPreviewIdx(i)}
                          style={{ width: i===previewIdx?18:6, height:6, borderRadius:999,
                            border:'none', cursor:'pointer', transition:'all 200ms',
                            background: i===previewIdx?'var(--fmn-gold)':'rgba(255,255,255,.2)' }}/>
                      ))}
                    </div>
                  )}
                </div>
              </>) : (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12,
                  color:'var(--text-3)', textAlign:'center' }}>
                  <LucideIcon icon={PLAT_ICON[form.plataforma]||'image'} size={40}
                    style={{ opacity:0.25 }}/>
                  <span style={{ fontSize:12, fontFamily:'Roboto,sans-serif', lineHeight:1.5 }}>
                    {form.plataforma === 'Carrossel'
                      ? 'Adicione imagens aos slides\npara visualizar aqui'
                      : 'Sem prévia disponível'}
                  </span>
                </div>
              )}
              {lightbox !== null && previewUrls.length > 0 && (
                <CarouselLightbox urls={previewUrls} initialIdx={lightbox} onClose={() => setLightbox(null)}/>
              )}
            </div>

            {/* Painel direito — propriedades + conteúdo */}
            <div style={{ flex:1, minHeight:0, overflowY:'auto', padding:'20px 24px',
              display:'flex', flexDirection:'column', gap:16 }}>

              {/* Card Propriedades */}
              <div style={{ background:'var(--app-surface)', border:'1px solid var(--app-border)', borderRadius:14 }}>
                <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--app-border)' }}>
                  <span style={{ fontSize:12.5, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-1)' }}>Propriedades</span>
                </div>
                <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:14 }}>

                  {/* Plataforma + Responsável */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                    <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                      <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)' }}>Plataforma</span>
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                        {PLATAFORMAS.map(p => {
                          const active = form.plataforma === p;
                          const c = PLAT_COLOR[p];
                          return (
                            <button key={p} onClick={()=>set('plataforma',p)}
                              style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 9px', borderRadius:999, fontSize:10.5, cursor:'pointer',
                                fontFamily:'Roboto,sans-serif', fontWeight:700, transition:'all 130ms',
                                background: active?`${c}22`:'rgba(255,255,255,.04)',
                                border: active?`1px solid ${c}66`:'1px solid rgba(255,255,255,.1)',
                                color: active?c:'var(--text-3)' }}>
                              <LucideIcon icon={PLAT_ICON[p]} size={9}/>{p}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                      <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)' }}>Responsável</span>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        {RESPONSAVEIS.map(r => {
                          const cfg = RESPONSAVEL_CONFIG[r] || { color:'#94a3b8', bg:'rgba(148,163,184,.18)' };
                          const active = form.responsavel === r;
                          return (
                            <div key={r} onClick={()=>set('responsavel',r)}
                              style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:999,
                                cursor:'pointer', transition:'all 130ms',
                                background: active ? cfg.bg : 'rgba(255,255,255,.04)',
                                border: active ? `1px solid ${cfg.color}55` : '1px solid rgba(255,255,255,.1)' }}>
                              <ResponsavelAvatar nome={r} size={20} active={active}/>
                              <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', fontWeight:700,
                                color: active ? cfg.color : 'var(--text-3)' }}>{r}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                    <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)' }}>Status</span>
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                      {COLUMNS.map(col => {
                        const active = form.status === col.id;
                        return (
                          <button key={col.id} onClick={()=>set('status',col.id)}
                            style={{ padding:'4px 11px', borderRadius:999, fontSize:10.5, cursor:'pointer',
                              fontFamily:'Roboto,sans-serif', fontWeight:700, transition:'all 130ms',
                              background: active?`${col.colorDot}22`:'rgba(255,255,255,.04)',
                              border: active?`1px solid ${col.colorDot}66`:'1px solid rgba(255,255,255,.1)',
                              color: active?col.colorDot:'var(--text-3)' }}>
                            {col.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Data prevista */}
                  <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                    <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)' }}>Data prevista</span>
                    <input type="date" value={form.data_prevista||''}
                      onChange={e=>set('data_prevista',e.target.value)}
                      style={{ padding:'8px 12px', borderRadius:8, width:'fit-content',
                        background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.1)',
                        color:'var(--text-1)', fontFamily:'Roboto,sans-serif', fontSize:12.5,
                        colorScheme:'dark', outline:'none' }}
                      onFocus={e=>e.target.style.borderColor='rgba(234,170,65,.4)'}
                      onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.1)'}/>
                  </div>
                </div>
              </div>

              {/* Card Conteúdo */}
              <div style={{ background:'var(--app-surface)', border:'1px solid var(--app-border)', borderRadius:14 }}>
                <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--app-border)' }}>
                  <span style={{ fontSize:12.5, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-1)' }}>Conteúdo</span>
                </div>
                <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:14 }}>

                  {/* Tema */}
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)' }}>Tema / Título</span>
                      <CopyBtn text={form.tema}/>
                    </div>
                    <input value={form.tema} onChange={e=>set('tema',e.target.value)}
                      placeholder="Ex: Cliente reclamou de poucas fotos na entrega"
                      style={{ width:'100%', boxSizing:'border-box', padding:'9px 12px', borderRadius:8,
                        background:'var(--app-surface-2)', border:'1px solid var(--app-border)',
                        color:'var(--text-1)', fontFamily:'Roboto,sans-serif', fontSize:13, outline:'none' }}
                      onFocus={e=>e.target.style.borderColor='rgba(234,170,65,.4)'}
                      onBlur={e=>e.target.style.borderColor='var(--app-border)'}/>
                  </div>

                  {/* Gancho */}
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)' }}>Gancho</span>
                      <CopyBtn text={form.gancho}/>
                    </div>
                    <textarea value={form.gancho} onChange={e=>set('gancho',e.target.value)}
                      rows={3} placeholder="A primeira frase que para o scroll..."
                      style={{ width:'100%', boxSizing:'border-box', padding:'9px 12px', borderRadius:8, resize:'vertical',
                        background:'var(--app-surface-2)', border:'1px solid var(--app-border)',
                        color:'var(--text-1)', fontFamily:'Roboto,sans-serif', fontSize:13, outline:'none', lineHeight:1.55 }}
                      onFocus={e=>e.target.style.borderColor='rgba(234,170,65,.4)'}
                      onBlur={e=>e.target.style.borderColor='var(--app-border)'}/>
                  </div>

                  {form.plataforma === 'Carrossel' ? (<>
                    <div>
                      {!isNew && item?.numero && (
                        <div style={{ marginBottom:12 }}>
                          <AdicionarCriativoOrganicoBtn numero={item.numero} cardId={item.id} onDone={async () => {
                            if (!window.db) return;
                            const { data } = await window.db.from('conteudo_organico').select('slides').eq('id', item.id).single();
                            if (data?.slides) {
                              const novo = parseSlides(data.slides);
                              setSlidesArr(novo);
                              set('slides', data.slides);
                            }
                            onImported && onImported();
                          }}/>
                        </div>
                      )}
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                        <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)' }}>Slides ({slidesArr.length})</span>
                        <div style={{ display:'flex', gap:6 }}>
                          <CopyAllPromptsBtn slidesArr={slidesArr}/>
                          <button onClick={addSlide}
                            style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px',
                              borderRadius:7, border:'1px solid rgba(96,165,250,.35)', background:'rgba(96,165,250,.1)',
                              color:'#60a5fa', fontSize:11, fontFamily:'Roboto,sans-serif', fontWeight:700, cursor:'pointer' }}>
                            <LucideIcon icon="plus" size={12}/>Novo slide
                          </button>
                        </div>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        {slidesArr.map((slide, idx) => (
                          <SlideBlock key={idx} slide={slide} index={idx} total={slidesArr.length}
                            onChange={(i,s) => { updateSlide(i,s); if (s.image_url) setPreviewIdx(i); }}
                            onRemove={removeSlide}
                            file={slideFiles[idx] || null}
                            onFileChange={handleFileChange}/>
                        ))}
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)' }}>Legenda da postagem</span>
                        <CopyBtn text={form.legenda||''}/>
                      </div>
                      <textarea value={form.legenda||''} onChange={e=>set('legenda',e.target.value)}
                        rows={3} placeholder="Texto da postagem no Instagram..."
                        style={{ width:'100%', boxSizing:'border-box', padding:'9px 12px', borderRadius:8, resize:'vertical',
                          background:'var(--app-surface-2)', border:'1px solid var(--app-border)',
                          color:'var(--text-1)', fontFamily:'Roboto,sans-serif', fontSize:13, outline:'none', lineHeight:1.55 }}
                        onFocus={e=>e.target.style.borderColor='rgba(234,170,65,.4)'}
                        onBlur={e=>e.target.style.borderColor='var(--app-border)'}/>
                    </div>
                  </>) : (<>
                    {!isNew && item?.numero && ['Imagem','Stories'].includes(form.plataforma) && (
                      <AdicionarCriativoOrganicoBtn numero={item.numero} cardId={item.id} onDone={async () => {
                        if (!window.db) return;
                        const { data } = await window.db.from('conteudo_organico').select('slides').eq('id', item.id).single();
                        if (data?.slides) {
                          const novo = parseSlides(data.slides);
                          setSlidesArr(novo);
                          set('slides', data.slides);
                        }
                        onImported && onImported();
                      }}/>
                    )}
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)' }}>Desenvolvimento</span>
                        <CopyBtn text={form.desenvolvimento}/>
                      </div>
                      <textarea value={form.desenvolvimento} onChange={e=>set('desenvolvimento',e.target.value)}
                        rows={5} placeholder="O conteúdo principal, argumentos, roteiro..."
                        style={{ width:'100%', boxSizing:'border-box', padding:'9px 12px', borderRadius:8, resize:'vertical',
                          background:'var(--app-surface-2)', border:'1px solid var(--app-border)',
                          color:'var(--text-1)', fontFamily:'Roboto,sans-serif', fontSize:13, outline:'none', lineHeight:1.55 }}
                        onFocus={e=>e.target.style.borderColor='rgba(234,170,65,.4)'}
                        onBlur={e=>e.target.style.borderColor='var(--app-border)'}/>
                    </div>

                    {/* Legenda da postagem — Imagem / Reels / Stories */}
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)' }}>Legenda da postagem</span>
                        <CopyBtn text={form.legenda||''}/>
                      </div>
                      <textarea value={form.legenda||''} onChange={e=>set('legenda',e.target.value)}
                        rows={5} placeholder="Texto da postagem no Instagram..."
                        style={{ width:'100%', boxSizing:'border-box', padding:'9px 12px', borderRadius:8, resize:'vertical',
                          background:'var(--app-surface-2)', border:'1px solid var(--app-border)',
                          color:'var(--text-1)', fontFamily:'Roboto,sans-serif', fontSize:13, outline:'none', lineHeight:1.55 }}
                        onFocus={e=>e.target.style.borderColor='rgba(234,170,65,.4)'}
                        onBlur={e=>e.target.style.borderColor='var(--app-border)'}/>
                    </div>

                    {/* Prompt de imagem */}
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)' }}>Prompt de imagem</span>
                        <CopyBtn text={form.prompt_imagem||''}/>
                      </div>
                      <textarea value={form.prompt_imagem||''} onChange={e=>set('prompt_imagem',e.target.value)}
                        rows={4} placeholder="Prompt para gerar a imagem no ChatGPT / Midjourney..."
                        style={{ width:'100%', boxSizing:'border-box', padding:'9px 12px', borderRadius:8, resize:'vertical',
                          background:'rgba(96,165,250,.04)', border:'1px solid rgba(96,165,250,.18)',
                          color:'var(--text-1)', fontFamily:'Roboto,sans-serif', fontSize:13, outline:'none', lineHeight:1.55 }}
                        onFocus={e=>e.target.style.borderColor='rgba(96,165,250,.5)'}
                        onBlur={e=>e.target.style.borderColor='rgba(96,165,250,.18)'}/>
                    </div>
                  </>)}

                  {/* CTA */}
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)' }}>CTA</span>
                      <CopyBtn text={form.cta}/>
                    </div>
                    <textarea value={form.cta} onChange={e=>set('cta',e.target.value)}
                      rows={2} placeholder="O que você quer que a pessoa faça depois..."
                      style={{ width:'100%', boxSizing:'border-box', padding:'9px 12px', borderRadius:8, resize:'vertical',
                        background:'var(--app-surface-2)', border:'1px solid var(--app-border)',
                        color:'var(--text-1)', fontFamily:'Roboto,sans-serif', fontSize:13, outline:'none', lineHeight:1.55 }}
                      onFocus={e=>e.target.style.borderColor='rgba(234,170,65,.4)'}
                      onBlur={e=>e.target.style.borderColor='var(--app-border)'}/>
                  </div>

                  {/* Referência */}
                  <RefBlock value={form.referencia} onChange={v=>set('referencia',v)}/>

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── FilterPill ──────────────────────────────────────────────────*/
function FilterPill({ label, active, color, onClick }) {
  return (
    <button onClick={onClick}
      style={{ padding:'5px 12px', borderRadius:999, cursor:'pointer', fontSize:11,
        fontFamily:'Roboto,sans-serif', fontWeight:700, transition:'all 130ms',
        background: active?(color?`${color}22`:'rgba(234,170,65,.15)'):'rgba(255,255,255,.04)',
        border: active?`1px solid ${color||'rgba(234,170,65,.4)'}66`:'1px solid rgba(255,255,255,.1)',
        color: active?(color||'var(--fmn-gold)'):'rgba(255,255,255,.42)' }}>
      {label}
    </button>
  );
}

/* ── ScheduleEditPopover — editor rápido de data/hora de um post agendado ──*/
function ScheduleEditPopover({ item, onSave, onClose }) {
  const initDate = item.data_prevista ? item.data_prevista.slice(0,10) : '';
  const initTime = item.scheduled_at
    ? new Date(item.scheduled_at).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', timeZone:'America/Sao_Paulo', hour12:false })
    : '09:00';
  const [date, setDate] = useState(initDate);
  const [time, setTime] = useState(initTime);

  return (
    <div onClick={e=>e.stopPropagation()}
      style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:50,
        background:'#1a1b1f', border:'1px solid rgba(255,255,255,.15)', borderRadius:10,
        padding:12, boxShadow:'0 12px 32px rgba(0,0,0,.5)', width:200,
        display:'flex', flexDirection:'column', gap:8 }}>
      <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
        letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-3)' }}>
        Editar agendamento
      </span>
      <input type="date" value={date} onChange={e=>setDate(e.target.value)}
        style={{ width:'100%', boxSizing:'border-box', padding:'6px 8px', borderRadius:6,
          background:'var(--app-surface-2)', border:'1px solid var(--app-border)',
          color:'var(--text-1)', fontFamily:'Roboto,sans-serif', fontSize:12, outline:'none' }}/>
      <input type="time" value={time} onChange={e=>setTime(e.target.value)}
        style={{ width:'100%', boxSizing:'border-box', padding:'6px 8px', borderRadius:6,
          background:'var(--app-surface-2)', border:'1px solid var(--app-border)',
          color:'var(--text-1)', fontFamily:'Roboto,sans-serif', fontSize:12, outline:'none' }}/>
      <div style={{ display:'flex', gap:6 }}>
        <button onClick={onClose}
          style={{ flex:1, padding:'6px 0', borderRadius:6, border:'1px solid var(--app-border)',
            background:'rgba(255,255,255,.04)', color:'var(--text-2)', fontSize:11,
            fontFamily:'Roboto,sans-serif', fontWeight:700, cursor:'pointer' }}>
          Cancelar
        </button>
        <button onClick={()=>date && time && onSave(date, time)}
          disabled={!date || !time}
          style={{ flex:1, padding:'6px 0', borderRadius:6, border:'none',
            background: (date && time) ? '#eaaa41' : 'rgba(255,255,255,.08)',
            color: (date && time) ? '#000' : 'var(--text-3)', fontSize:11,
            fontFamily:'Roboto,sans-serif', fontWeight:700,
            cursor: (date && time) ? 'pointer' : 'not-allowed' }}>
          Salvar
        </button>
      </div>
    </div>
  );
}

/* ── CalendarioView ──────────────────────────────────────────────*/
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const MESES_PT   = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function CalendarioView({ items, onOpen, onNewWithDate, onReschedule, onEditSchedule }) {
  const today = new Date();
  const [ano, setAno]   = useState(today.getFullYear());
  const [mes, setMes]   = useState(today.getMonth()); // 0-based
  const [dragId, setDragId]         = useState(null);
  const [dragOverDate, setDragOverDate] = useState(null);
  const [editingId, setEditingId]   = useState(null); // id do card com editor de horário aberto

  const primeiroDia = new Date(ano, mes, 1).getDay(); // 0=dom
  const diasNoMes   = new Date(ano, mes + 1, 0).getDate();
  const todayStr    = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  // Agrupa items por data_prevista (YYYY-MM-DD). Posts já publicados (Feito) continuam
  // aparecendo, só mudam de cor pra verde (ver render dos chips abaixo).
  const byDate = {};
  items.forEach(item => {
    if (!item.data_prevista) return;
    const d = item.data_prevista.slice(0,10);
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(item);
  });

  const prevMes = () => { if (mes === 0) { setMes(11); setAno(a=>a-1); } else setMes(m=>m-1); };
  const nextMes = () => { if (mes === 11) { setMes(0); setAno(a=>a+1); } else setMes(m=>m+1); };

  // Células: espaços vazios + dias do mês
  const cells = [];
  for (let i = 0; i < primeiroDia; i++) cells.push(null);
  for (let d = 1; d <= diasNoMes; d++) cells.push(d);
  // Preenche última linha até completar 7
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', padding:'0 20px 16px' }}>

      {/* Navegação mês */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:16, padding:'12px 0 16px' }}>
        <button onClick={prevMes}
          style={{ width:30, height:30, borderRadius:8, border:'1px solid var(--app-border)',
            background:'rgba(255,255,255,.04)', color:'var(--text-2)', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center' }}>
          <LucideIcon icon="chevron-left" size={16}/>
        </button>
        <span style={{ fontSize:16, fontFamily:'Roboto,sans-serif', fontWeight:900,
          color:'var(--text-1)', minWidth:180, textAlign:'center' }}>
          {MESES_PT[mes]} {ano}
        </span>
        <button onClick={nextMes}
          style={{ width:30, height:30, borderRadius:8, border:'1px solid var(--app-border)',
            background:'rgba(255,255,255,.04)', color:'var(--text-2)', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center' }}>
          <LucideIcon icon="chevron-right" size={16}/>
        </button>
      </div>

      {/* Grade — ocupa todo o espaço sem scroll */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
        {/* Cabeçalho dias da semana */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:4 }}>
          {DIAS_SEMANA.map((d, i) => {
            const isWeekend = i === 0 || i === 6;
            return (
              <div key={d} style={{ textAlign:'center', fontSize:10.5, fontFamily:'Roboto,sans-serif',
                fontWeight:900, letterSpacing:'0.06em',
                color: isWeekend ? 'rgba(148,163,184,.45)' : 'var(--text-3)',
                textTransform:'uppercase', padding:'4px 0' }}>
                {d}
              </div>
            );
          })}
        </div>

        {/* Células — gridAutoRows:'1fr' preenche toda a altura disponível */}
        <div style={{ flex:1, display:'grid', gridTemplateColumns:'repeat(7,1fr)',
          gridAutoRows:'1fr', gap:4 }}>
          {cells.map((dia, idx) => {
            const colIdx = idx % 7; // 0=dom, 6=sáb
            const isWeekend = colIdx === 0 || colIdx === 6;
            if (!dia) return (
              <div key={`e${idx}`} style={{
                background: isWeekend ? 'rgba(255,255,255,.01)' : 'transparent',
                borderRadius:8 }}/>
            );
            const dateStr = `${ano}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
            const dayItems = byDate[dateStr] || [];
            const isToday  = dateStr === todayStr;

            let bgColor = 'var(--app-surface-2)';
            if (isToday)    bgColor = 'rgba(234,170,65,.06)';
            else if (isWeekend) bgColor = 'rgba(255,255,255,.015)';

            let borderColor = 'var(--app-border)';
            if (isToday)        borderColor = 'rgba(234,170,65,.45)';
            else if (isWeekend) borderColor = 'rgba(255,255,255,.06)';

            const isDragOver = dragOverDate === dateStr;

            return (
              <div key={dateStr}
                onClick={() => onNewWithDate(dateStr)}
                onDragOver={e => { e.preventDefault(); if (dragOverDate !== dateStr) setDragOverDate(dateStr); }}
                onDragLeave={() => setDragOverDate(prev => prev === dateStr ? null : prev)}
                onDrop={e => {
                  e.preventDefault();
                  setDragOverDate(null);
                  if (dragId) onReschedule(dragId, dateStr);
                  setDragId(null);
                }}
                style={{ border: isDragOver ? '1px solid rgba(234,170,65,.7)' : `1px solid ${borderColor}`,
                  borderRadius:8, padding:'7px 8px',
                  background: isDragOver ? 'rgba(234,170,65,.1)' : bgColor,
                  cursor:'pointer', display:'flex', flexDirection:'column', gap:4,
                  overflow:'hidden', transition:'border-color 150ms, background 150ms',
                  opacity: isWeekend && !isToday ? 0.7 : 1 }}
                onMouseEnter={e => { if (!isToday && !isDragOver) e.currentTarget.style.borderColor='rgba(255,255,255,.18)'; }}
                onMouseLeave={e => { if (!isDragOver) e.currentTarget.style.borderColor = borderColor; }}>

                {/* Número do dia */}
                <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', fontWeight:900,
                  color: isToday ? 'var(--fmn-gold)' : isWeekend ? 'rgba(148,163,184,.5)' : 'var(--text-3)',
                  background: isToday ? 'rgba(234,170,65,.15)' : 'transparent',
                  borderRadius:5, padding: isToday ? '1px 5px' : '0',
                  alignSelf:'flex-start', lineHeight:1.6, flexShrink:0 }}>
                  {dia}
                </span>

                {/* Chips dos conteúdos */}
                {dayItems.slice(0,4).map(item => {
                  const isFeito = item.status === 'Feito';
                  const color = isFeito ? '#4ade80' : (PLAT_COLOR[item.plataforma] || '#94a3b8');
                  const num   = String(item.numero||0).padStart(3,'0');
                  let thumb = null;
                  try { const sa = JSON.parse(item.slides||'[]'); thumb = sa.map(s=>s.image_url).filter(Boolean)[0]||null; } catch {}
                  let horario = null;
                  const horarioSource = isFeito ? item.published_at : item.scheduled_at;
                  if (horarioSource) {
                    const d = new Date(horarioSource);
                    horario = d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', timeZone:'America/Sao_Paulo' });
                  }
                  const isEditing = editingId === item.id;
                  return (
                    <div key={item.id} style={{ position:'relative', flexShrink:0 }}>
                      <div
                        draggable
                        onDragStart={e=>{ e.stopPropagation(); setDragId(item.id); e.dataTransfer.effectAllowed='move'; }}
                        onDragEnd={()=>setDragId(null)}
                        onClick={e=>{e.stopPropagation();onOpen(item);}}
                        style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 7px',
                          borderRadius:6, background:`${color}18`, border:`1px solid ${color}33`,
                          cursor:'grab', overflow:'hidden',
                          transition:'background 120ms', opacity: dragId===item.id ? 0.4 : 1 }}
                        onMouseEnter={e=>e.currentTarget.style.background=`${color}32`}
                        onMouseLeave={e=>e.currentTarget.style.background=`${color}18`}>
                        {thumb
                          ? <img src={thumb} style={{ width:18,height:18,borderRadius:3,objectFit:'cover',flexShrink:0 }}/>
                          : <LucideIcon icon={isFeito ? 'check-circle' : (PLAT_ICON[item.plataforma]||'file')} size={11} style={{ color, flexShrink:0 }}/>}
                        <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:900,
                          color, letterSpacing:'0.04em', whiteSpace:'nowrap', overflow:'hidden',
                          textOverflow:'ellipsis' }}>
                          ORG {num}
                        </span>
                        {horario && (
                          <span onClick={e=>{ e.stopPropagation(); if (!isFeito) setEditingId(isEditing ? null : item.id); }}
                            style={{ display:'flex', alignItems:'center', gap:3,
                              marginLeft:'auto', paddingLeft:6, flexShrink:0, cursor: isFeito ? 'default' : 'pointer' }}>
                            <LucideIcon icon="clock" size={10} style={{ color, opacity:.85, flexShrink:0 }}/>
                            <span style={{ fontSize:9.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
                              color, opacity:.85, whiteSpace:'nowrap' }}>
                              {horario}
                            </span>
                          </span>
                        )}
                      </div>

                      {isEditing && (
                        <ScheduleEditPopover
                          item={item}
                          onSave={(newDate, newTime) => { onEditSchedule(item.id, newDate, newTime); setEditingId(null); }}
                          onClose={() => setEditingId(null)}/>
                      )}
                    </div>
                  );
                })}
                {dayItems.length > 4 && (
                  <span style={{ fontSize:9.5, fontFamily:'Roboto,sans-serif', color:'var(--text-3)',
                    paddingLeft:4 }}>+{dayItems.length-4} mais</span>
                )}
                {dayItems.length === 0 && (
                  <span style={{ fontSize:9, fontFamily:'Roboto,sans-serif',
                    color: isWeekend ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.1)',
                    marginTop:'auto', textAlign:'center' }}>+ novo</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── OrganicoScreen ──────────────────────────────────────────────*/
/* ── Desempenho: métricas reais dos posts orgânicos (tabela ordenável) ── */
function DesempenhoView({ metricas }) {
  const [sortKey, setSortKey] = useState('reach');
  const [sortDir, setSortDir] = useState('desc');

  const fmt = n => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));

  const toggleSort = k => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  };

  const rows = [...metricas].sort((a, b) => {
    if (sortKey === 'posted_at') {
      const av = String(a.posted_at || ''), bv = String(b.posted_at || '');
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    const av = a[sortKey] ?? -1, bv = b[sortKey] ?? -1;
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  const soma = k => metricas.reduce((s, m) => s + (m[k] || 0), 0);
  const alcanceTotal = soma('reach');
  const alcanceMedio = metricas.length ? Math.round(alcanceTotal / metricas.length) : 0;

  const COLS = [
    ['posted_at', 'Data', 'left'], ['media_product_type', 'Tipo', 'left'],
    ['reach', 'Alcance', 'right'], ['likes', 'Curtidas', 'right'],
    ['comments', 'Coment.', 'right'], ['saved', 'Salvos', 'right'],
    ['shares', 'Compart.', 'right'], ['follows', 'Seguidores', 'right'],
    ['total_interactions', 'Interações', 'right'],
  ];

  const tipoLabel = m => m.media_product_type === 'REELS' ? 'Reels'
    : m.media_type === 'CAROUSEL_ALBUM' ? 'Carrossel' : 'Imagem';

  const card = (label, value) => (
    <div style={{ flex:1, minWidth:130, padding:'12px 14px', borderRadius:10,
      background:'var(--app-surface)', border:'1px solid var(--app-border)' }}>
      <div style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
        letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-3)' }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:800, color:'var(--fmn-gold)', marginTop:4 }}>{value}</div>
    </div>
  );

  const td = (extra) => ({ padding:'8px 10px', borderBottom:'1px solid rgba(255,255,255,.05)', ...extra });

  return (
    <div style={{ flex:1, overflow:'auto', padding:'16px 24px', minHeight:0 }}>
      {metricas.length === 0 ? (
        <div style={{ color:'var(--text-3)', fontSize:13, padding:40, textAlign:'center' }}>
          Ainda não há métricas sincronizadas. O buscador roda uma vez por dia e traz o desempenho dos posts.
        </div>
      ) : (
        <>
          <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
            {card('Posts medidos', fmt(metricas.length))}
            {card('Alcance total', fmt(alcanceTotal))}
            {card('Alcance médio', fmt(alcanceMedio))}
            {card('Salvamentos', fmt(soma('saved')))}
            {card('Seguidores ganhos', fmt(soma('follows')))}
          </div>

          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, fontFamily:'Roboto,sans-serif' }}>
            <thead>
              <tr>
                <th style={{ textAlign:'left', padding:'8px 10px', borderBottom:'1px solid var(--app-border)',
                  color:'var(--text-3)', fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase' }}>Post</th>
                {COLS.map(([k, label, align]) => (
                  <th key={k} onClick={()=>toggleSort(k)}
                    style={{ textAlign:align, padding:'8px 10px', cursor:'pointer',
                      borderBottom:'1px solid var(--app-border)', userSelect:'none', whiteSpace:'nowrap',
                      color: sortKey===k ? 'var(--fmn-gold)' : 'var(--text-3)',
                      fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase' }}>
                    {label}{sortKey===k ? (sortDir==='asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(m => (
                <tr key={m.meta_media_id}
                  onClick={()=> m.permalink && window.open(m.permalink, '_blank')}
                  style={{ cursor: m.permalink ? 'pointer' : 'default' }}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--app-surface)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={td({ width:46 })}>
                    {(m.thumbnail_url || m.media_url)
                      ? <img src={m.thumbnail_url || m.media_url} alt="" loading="lazy"
                          style={{ width:38, height:38, objectFit:'cover', borderRadius:6, display:'block' }}
                          onError={e=>{ e.currentTarget.style.visibility='hidden'; }}/>
                      : <div style={{ width:38, height:38, borderRadius:6, background:'var(--app-surface)' }}/>}
                  </td>
                  <td style={td({ color:'var(--text-2)', whiteSpace:'nowrap' })}>
                    {m.posted_at ? m.posted_at.slice(0,10).split('-').reverse().join('/') : '—'}
                  </td>
                  <td style={td({ color:'var(--text-3)', fontSize:10, whiteSpace:'nowrap' })}>{tipoLabel(m)}</td>
                  <td style={td({ textAlign:'right', color:'var(--text-1)', fontWeight:700 })}>{fmt(m.reach)}</td>
                  <td style={td({ textAlign:'right', color:'var(--text-2)' })}>{fmt(m.likes)}</td>
                  <td style={td({ textAlign:'right', color:'var(--text-2)' })}>{fmt(m.comments)}</td>
                  <td style={td({ textAlign:'right', color:'var(--fmn-gold)', fontWeight:700 })}>{fmt(m.saved)}</td>
                  <td style={td({ textAlign:'right', color:'var(--text-2)' })}>{fmt(m.shares)}</td>
                  <td style={td({ textAlign:'right', color:'var(--text-2)' })}>{fmt(m.follows)}</td>
                  <td style={td({ textAlign:'right', color:'var(--text-2)' })}>{fmt(m.total_interactions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function OrganicoScreen() {
  const [items, setItems]           = useState([]);
  const [dbAvailable, setDbAvail]   = useState(false);
  const [modal, setModal]           = useState(null);
  const [platFilter, setPlatFilter] = useState('Todos');
  const [respFilter, setRespFilter] = useState('Todos');
  const [nextNum, setNextNum]       = useState(1);
  const [dragId, setDragId]         = useState(null);  // id do card sendo arrastado
  const [dropTarget, setDropTarget] = useState(null);  // colId sendo hovereado
  const [viewMode, setViewMode]     = useState('kanban'); // 'kanban' | 'calendario' | 'desempenho'
  const [metricas, setMetricas]     = useState([]);

  const handleDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async colId => {
    setDropTarget(null);
    if (!dragId || !colId) return;
    const item = items.find(i => i.id === dragId);
    if (!item || item.status === colId) { setDragId(null); return; }

    setItems(prev => prev.map(i => i.id === dragId ? { ...i, status: colId } : i));
    setDragId(null);

    if (dbAvailable) {
      await window.db.from('conteudo_organico').update({ status: colId }).eq('id', dragId);
    }
  };

  // Move card pra outro dia no calendário (drag-and-drop). Se já tiver horário
  // agendado, preserva a hora e só troca a data.
  const handleReschedule = async (itemId, newDateStr) => {
    const item = items.find(i => i.id === itemId);
    if (!item || item.data_prevista === newDateStr) return;

    let newScheduledAt = item.scheduled_at || null;
    if (newScheduledAt) {
      const old = new Date(newScheduledAt);
      const hh  = String(old.getUTCHours()).padStart(2,'0');
      const mm  = String(old.getUTCMinutes()).padStart(2,'0');
      newScheduledAt = `${newDateStr}T${hh}:${mm}:00.000Z`;
    }

    setItems(prev => prev.map(i => i.id === itemId
      ? { ...i, data_prevista: newDateStr, ...(newScheduledAt ? { scheduled_at: newScheduledAt } : {}) }
      : i));

    if (dbAvailable) {
      const patch = { data_prevista: newDateStr };
      if (newScheduledAt) patch.scheduled_at = newScheduledAt;
      await window.db.from('conteudo_organico').update(patch).eq('id', itemId);
    }
  };

  // Edita diretamente a data/hora de um post já agendado (sem reabrir o fluxo de publicação).
  const handleEditSchedule = async (itemId, newDateStr, newTimeStr) => {
    const newScheduledAt = new Date(`${newDateStr}T${newTimeStr}:00-03:00`).toISOString();

    setItems(prev => prev.map(i => i.id === itemId
      ? { ...i, data_prevista: newDateStr, scheduled_at: newScheduledAt }
      : i));

    if (dbAvailable) {
      await window.db.from('conteudo_organico')
        .update({ data_prevista: newDateStr, scheduled_at: newScheduledAt })
        .eq('id', itemId);
    }
  };

  const loadItems = React.useCallback(async () => {
    if (!window.db) return;
    setDbAvail(true);
    const { data } = await window.db.from('conteudo_organico')
      .select('*').order('created_at', { ascending:true });
    if (data) {
      const withNum = data.map((item,idx) => ({ ...item, numero: item.numero ?? (idx+1) }));
      setItems(withNum);
      setNextNum(withNum.length+1);
    }
  }, []);
  useEffect(() => { loadItems(); }, [loadItems]);

  // Importar arquivos (geral) — puxa o Drive de todos os cards (via cozinha/worker).
  const [importMsg, setImportMsg] = useState('');
  async function importarArquivos() {
    if (!confirm('Buscar imagens/vídeos do Drive para todos os cards do orgânico?')) return;
    const jobId = novoJobId();
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    setImportMsg('Preparando');
    let terminou = false;
    const pedido = fetch(`${WORKER_URL}/import-geral`, { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ job_id: jobId }) }).finally(() => { terminou = true; });
    (async () => {
      while (!terminou) {
        await sleep(2000);
        try {
          const p = await (await fetch(`${WORKER_URL}/progresso?job=${jobId}`)).json();
          if (p.etapa) setImportMsg(`${p.etapa}${p.pct ? ` · ${Math.round(p.pct)}%` : ''}`);
        } catch {}
      }
    })();
    try {
      const r = await pedido;
      const d = await r.json();
      setImportMsg(d.ok ? `Importados ${d.importados}/${d.total} (falhas: ${d.falhas})` : ('Erro: '+(d.error||'falha')));
      await loadItems();
    } catch(e){ setImportMsg('Erro: '+e.message); }
    setTimeout(()=>setImportMsg(''), 6000);
  }

  // Carrega as métricas orgânicas (desempenho dos posts). Mantém só o snapshot
  // mais recente de cada post, já que a tabela guarda um registro por dia.
  useEffect(() => {
    if (!window.db) return;
    window.db.from('organico_metricas')
      .select('*').order('data', { ascending:false })
      .then(({ data }) => {
        if (!data) return;
        const latest = {};
        for (const m of data) if (!latest[m.meta_media_id]) latest[m.meta_media_id] = m;
        setMetricas(Object.values(latest));
      });
  }, []);

  const handleSave = async form => {
    const row = {
      tema:form.tema, plataforma:form.plataforma, responsavel:form.responsavel,
      status:form.status, gancho:form.gancho, desenvolvimento:form.desenvolvimento,
      slides:form.slides, legenda:form.legenda,
      cta:form.cta, prompt_imagem:form.prompt_imagem||null,
      data_prevista:form.data_prevista||null,
      referencia:form.referencia||null,
      published_at:form.published_at||null,
    };
    if (form.id) {
      if (dbAvailable) await window.db.from('conteudo_organico').update(row).eq('id',form.id);
      // scheduled_at não faz parte do `row` (é gerido pelo endpoint /schedule), mas o
      // estado local precisa refletir o valor vindo do form pra o calendário mostrar o horário na hora.
      setItems(prev => prev.map(i => i.id===form.id ? { ...i, ...row, scheduled_at: form.scheduled_at ?? i.scheduled_at } : i));
      // Modal permanece aberto — ContentModal exibe "Salvo!" e fecha quando o usuário quiser
    } else {
      if (dbAvailable) {
        const { data } = await window.db.from('conteudo_organico').insert(row).select().single();
        if (data) { setItems(prev => [...prev, { ...data, numero:nextNum }]); setNextNum(n=>n+1); setModal(null); return; }
      }
      setItems(prev => [...prev, { ...row, id:String(Date.now()), numero:nextNum }]);
      setNextNum(n=>n+1);
      setModal(null);
    }
  };

  const handleDelete = async id => {
    if (dbAvailable) await window.db.from('conteudo_organico').delete().eq('id',id);
    setItems(prev => prev.filter(i => i.id!==id));
    setModal(null);
  };

  const filtered = items.filter(i => {
    if (platFilter !== 'Todos' && i.plataforma !== platFilter) return false;
    if (respFilter !== 'Todos' && i.responsavel !== respFilter) return false;
    return true;
  });

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {modal && (
        <ContentModal key={modal.item?.id || 'novo'} item={modal.item||null} defaultStatus={modal.defaultStatus}
          prefillDate={modal.prefillDate||null}
          siblings={modal.siblings||[]}
          onNavigate={newItem => setModal({ item:newItem, siblings: filtered.filter(i=>i.status===newItem.status) })}
          onSave={handleSave} onDelete={handleDelete} onClose={()=>setModal(null)}
          onImported={loadItems}/>
      )}
      <TopBar title="Orgânico"
        actions={
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {/* Toggle Kanban / Calendário */}
            <div style={{ display:'flex', gap:2, padding:3, borderRadius:8,
              background:'rgba(255,255,255,.04)', border:'1px solid var(--app-border)' }}>
              {[['kanban','layout-dashboard','Kanban'],['calendario','calendar','Calendário'],['desempenho','trending-up','Desempenho']].map(([id,icon,label]) => (
                <button key={id} onClick={()=>setViewMode(id)}
                  style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 11px',
                    borderRadius:6, cursor:'pointer', fontSize:11, fontFamily:'Roboto,sans-serif',
                    fontWeight:700, transition:'all 130ms', border:'none',
                    background: viewMode===id ? 'rgba(234,170,65,.18)' : 'transparent',
                    color: viewMode===id ? 'var(--fmn-gold)' : 'var(--text-3)' }}>
                  <LucideIcon icon={icon} size={12}/>{label}
                </button>
              ))}
            </div>
            <Btn variant="secondary" size="sm" icon="folder-down" onClick={importarArquivos}>
              Importar arquivos
            </Btn>
            <Btn variant="primary" size="sm" icon="plus"
              onClick={()=>setModal({ item:null, defaultStatus:'Fazer' })}>
              Novo
            </Btn>
          </div>
        }/>

      {importMsg && (
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:800,
          display:'flex', alignItems:'center', gap:8, padding:'12px 18px', borderRadius:10,
          background:'rgba(56,189,248,.12)', border:'1px solid rgba(56,189,248,.3)',
          boxShadow:'0 12px 40px rgba(0,0,0,.5)' }}>
          <LucideIcon icon="folder-down" size={16} color="#38bdf8"/>
          <span style={{ fontSize:13, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'#38bdf8' }}>
            {importMsg}
          </span>
        </div>
      )}

      {/* Barra de filtros */}
      <div style={{ padding:'8px 24px', borderBottom:'1px solid var(--app-border)',
        background:'var(--app-bg)', display:'flex', alignItems:'center', gap:16, flexShrink:0,
        flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
            letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-3)' }}>Plataforma</span>
          <div style={{ display:'flex', gap:4 }}>
            {['Todos',...PLATAFORMAS].map(p => (
              <FilterPill key={p} label={p} active={platFilter===p}
                color={PLAT_COLOR[p]} onClick={()=>setPlatFilter(p)}/>
            ))}
          </div>
        </div>
        <div style={{ width:1, height:20, background:'var(--app-border)', flexShrink:0 }}/>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
            letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-3)' }}>Responsável</span>
          <div style={{ display:'flex', gap:4 }}>
            {['Todos',...RESPONSAVEIS].map(r => (
              <FilterPill key={r} label={r} active={respFilter===r}
                color={r==='Felipe'?'#eaaa41':r==='Amanda'?'#60a5fa':null}
                onClick={()=>setRespFilter(r)}/>
            ))}
          </div>
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <div style={{ flex:1, display:'flex', gap:10, padding:'16px 20px',
          overflowX:'auto', overflowY:'hidden', minHeight:0 }}>
          {COLUMNS.map(col => (
            <OrgColumn key={col.id} col={col}
              items={filtered.filter(i=>i.status===col.id)}
              onOpen={item=>setModal({ item, siblings: filtered.filter(i=>i.status===item.status) })}
              onAddNew={status=>setModal({ item:null, defaultStatus:status })}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              isDragOver={dragId && dropTarget === col.id}/>
          ))}
        </div>
      ) : viewMode === 'calendario' ? (
        <CalendarioView
          items={filtered}
          onOpen={item=>setModal({ item, siblings: filtered.filter(i=>i.status===item.status) })}
          onNewWithDate={date=>setModal({ item:null, defaultStatus:'Fazer', prefillDate:date })}
          onReschedule={handleReschedule}
          onEditSchedule={handleEditSchedule}/>
      ) : (
        <DesempenhoView metricas={metricas}/>
      )}
    </div>
  );
}

window.OrganicoScreen = OrganicoScreen;
