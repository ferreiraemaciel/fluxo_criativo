/* ================================================================
   Tracker FMN — Ideias v4 · Kanban Board
   CSS grid layout (sempre tela toda) · Referência volta (link/upload)
   ================================================================ */
const { useState, useRef, useEffect } = React;
const { LucideIcon, Btn, Badge, TopBar } = window;

const FMT_TONE = { Reels:'reels', Imagem:'image', Carrossel:'carousel' };
const ALL_FMTS = window.PLATAFORMAS; // fonte única em shared.jsx (Reels, Carrossel, Imagem, Stories, Artigo, Youtube)
const STATUS_COLS = ['Ideia', 'Convertido'];
const COL_CFG = {
  'Ideia':      { dot:'#3b82f6', bg:'rgba(59,130,246,.05)',  border:'rgba(59,130,246,.2)' },
  'Convertido': { dot:'#4ade80', bg:'rgba(74,222,128,.05)', border:'rgba(74,222,128,.2)' },
};
const DESTINOS = ['Anúncio', 'Orgânico'];
const DESTINO_CFG = {
  'Anúncio': { color:'#f87171', bg:'rgba(248,113,113,.1)', border:'rgba(248,113,113,.25)', icon:'megaphone' },
  'Orgânico':{ color:'#a78bfa', bg:'rgba(167,139,250,.1)', border:'rgba(167,139,250,.25)', icon:'leaf' },
};

const INIT_IDEAS = [];

/* ── Helpers de URL ─────────────────────────────────────────────*/
function getYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/* ── RefPreview (mini, no card) ─────────────────────────────────*/
function RefPreview({ r, embed }) {
  if (!r) return null;
  if (r.type === 'file' && r.mime?.startsWith('image')) {
    if (embed) {
      // ao abrir o card: imagem inteira, na proporção real, sem cortar
      return (
        <div style={{ borderRadius:9, overflow:'hidden', background:'rgba(0,0,0,.25)',
          border:'1px solid var(--app-border)', display:'flex', justifyContent:'center' }}>
          <img src={r.value} alt="ref" style={{ maxWidth:'100%', maxHeight:'70vh',
            width:'auto', height:'auto', objectFit:'contain', display:'block' }}/>
        </div>
      );
    }
    return (
      <div style={{ borderRadius:7, overflow:'hidden', height:64, flexShrink:0 }}>
        <img src={r.value} alt="ref" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
      </div>
    );
  }
  if (r.type === 'file' && r.mime?.startsWith('video')) {
    return (
      <div style={{ height:34, borderRadius:7, background:'rgba(255,255,255,.04)',
        border:'1px solid var(--app-border)', display:'flex', alignItems:'center',
        padding:'0 10px', gap:7 }}>
        <LucideIcon icon="play-circle" size={13} color="var(--text-3)"/>
        <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'var(--text-3)' }}>Vídeo de referência</span>
      </div>
    );
  }
  if (r.type === 'url') {
    const ytId = getYouTubeId(r.value);
    if (ytId && embed) {
      return (
        <div style={{ borderRadius:9, overflow:'hidden', aspectRatio:'16/9', flexShrink:0 }}>
          <iframe
            src={`https://www.youtube.com/embed/${ytId}`}
            style={{ width:'100%', height:'100%', border:'none' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen/>
        </div>
      );
    }
    if (ytId) {
      return (
        <div style={{ height:32, borderRadius:7, background:'rgba(248,113,113,.06)',
          border:'1px solid rgba(248,113,113,.15)', display:'flex', alignItems:'center',
          padding:'0 10px', gap:7, overflow:'hidden' }}>
          <LucideIcon icon="youtube" size={12} color="#f87171"/>
          <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'#f87171',
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            YouTube · {ytId}
          </span>
        </div>
      );
    }
    return (
      <a href={r.value} target="_blank" rel="noreferrer" style={{ textDecoration:'none' }}>
        <div style={{ height:32, borderRadius:7, background:'rgba(96,165,250,.06)',
          border:'1px solid rgba(96,165,250,.15)', display:'flex', alignItems:'center',
          padding:'0 10px', gap:7, overflow:'hidden', cursor:'pointer' }}>
          <LucideIcon icon="external-link" size={12} color="#60a5fa"/>
          <span style={{ fontSize:11, fontFamily:'Roboto,sans-serif', color:'#60a5fa',
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {r.value}
          </span>
        </div>
      </a>
    );
  }
  return null;
}

/* ── IdeaCard ───────────────────────────────────────────────────*/
function IdeaCard({ idea, colCfg, onEdit, onConvert, onDelete }) {
  const [hov, setHov] = useState(false);
  const converted = idea.status === 'Convertido';
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      onClick={() => onEdit(idea)}
      style={{ position:'relative', background:hov?'var(--app-surface-3)':'var(--app-surface-2)',
        border:`1px solid ${hov?colCfg.border:'var(--app-border)'}`,
        borderRadius:12, padding:'14px', display:'flex', flexDirection:'column', gap:9,
        transition:'all 160ms', cursor:'pointer' }}>

      {/* Botão excluir — canto superior direito, aparece no hover */}
      {hov && (
        <button onClick={e => { e.stopPropagation(); onDelete(idea.id); }}
          style={{ position:'absolute', top:10, right:10, width:24, height:24,
            borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center',
            background:'rgba(248,113,113,.12)', border:'1px solid rgba(248,113,113,.25)',
            color:'#f87171', cursor:'pointer', transition:'all 130ms', zIndex:1 }}>
          <LucideIcon icon="trash-2" size={11}/>
        </button>
      )}

      <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center', paddingRight: hov ? 28 : 0 }}>
        {idea.formats.map(f => <Badge key={f} tone={FMT_TONE[f]||'default'}>{f}</Badge>)}
        {idea.destino && (() => { const dc = DESTINO_CFG[idea.destino]; return (
          <span style={{ display:'flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:999,
            background: dc?.bg, border:`1px solid ${dc?.border}`,
            fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700, color: dc?.color }}>
            <LucideIcon icon={dc?.icon||'circle'} size={9}/>{idea.destino}
          </span>
        ); })()}
      </div>

      <div style={{ fontSize:13.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
        color:'var(--text-1)', lineHeight:1.4,
        display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
        {idea.title}
      </div>

      <div style={{ fontSize:12, fontFamily:'Roboto,sans-serif', lineHeight:1.55, color:'var(--text-3)',
        display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
        {idea.desc}
      </div>

      {/* indicador discreto de anexo, sem pré-visualizar a imagem no card */}
      {idea.ref && (
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11,
          fontFamily:'Roboto,sans-serif', color:'var(--text-3)' }}>
          <LucideIcon icon={idea.ref.type==='url' ? 'link' : (idea.ref.mime?.startsWith('video') ? 'play-circle' : 'image')} size={12}/>
          {idea.ref.type==='url' ? 'Link de referência' : (idea.ref.mime?.startsWith('video') ? 'Vídeo anexado' : 'Imagem anexada')}
        </div>
      )}

      <div style={{ display:'flex', gap:6, paddingTop:6, borderTop:'1px solid var(--app-border)' }}
        onClick={e => e.stopPropagation()}>
        <button onClick={() => onEdit(idea)}
          style={{ flex:1, padding:'6px', borderRadius:6, cursor:'pointer',
            background:'rgba(255,255,255,.04)', border:'1px solid var(--app-border)',
            color:'var(--text-2)', fontFamily:'Roboto,sans-serif', fontSize:11, fontWeight:700,
            display:'flex', alignItems:'center', justifyContent:'center', gap:5, transition:'all 130ms' }}>
          <LucideIcon icon="pencil" size={11}/>Editar
        </button>
        {!converted ? (
          <button onClick={() => onConvert(idea.id)}
            style={{ flex:1, padding:'6px', borderRadius:6, cursor:'pointer',
              background:'rgba(234,170,65,.08)', border:'1px solid rgba(234,170,65,.2)',
              color:'var(--fmn-gold)', fontFamily:'Roboto,sans-serif', fontSize:11, fontWeight:700,
              display:'flex', alignItems:'center', justifyContent:'center', gap:5, transition:'all 130ms' }}>
            <LucideIcon icon="send" size={11}/>{idea.destino === 'Orgânico' ? 'Produzir' : 'Gerar ADS'}
          </button>
        ) : (
          <button onClick={() => onConvert(idea.id)}
            style={{ flex:1, padding:'6px', borderRadius:6, cursor:'pointer',
              background:'rgba(255,255,255,.04)', border:'1px solid var(--app-border)',
              color:'var(--text-3)', fontFamily:'Roboto,sans-serif', fontSize:11, fontWeight:700,
              display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
            <LucideIcon icon="rotate-ccw" size={11}/>Reverter
          </button>
        )}
      </div>
    </div>
  );
}

/* ── IdeaModal ──────────────────────────────────────────────────*/
function IdeaModal({ idea, onClose, onSave }) {
  const [form, setForm] = useState(
    idea ? { ...idea } : { title:'', desc:'', formats:['Reels'], status:'Ideia', destino:'Orgânico', ref:null }
  );
  const [refMode, setRefMode] = useState('link');
  const [urlInput, setUrlInput]   = useState(idea?.ref?.type==='url' ? idea.ref.value : '');
  const fileRef = useRef(null);

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const toggleFmt = f => setForm(p => ({
    ...p, formats: p.formats.includes(f) ? p.formats.filter(x=>x!==f) : [...p.formats,f]
  }));

  const applyUrl = () => {
    if (urlInput.trim()) { setForm(p => ({ ...p, ref:{ type:'url', value:urlInput.trim() } })); setUrlInput(''); }
  };

  const handleFile = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(p => ({ ...p, ref:{ type:'file', mime:file.type, value:ev.target.result } }));
    reader.readAsDataURL(file);
  };

  const INP = { width:'100%', padding:'8px 12px', borderRadius:8,
    background:'var(--app-surface-2)', border:'1px solid var(--app-border)',
    color:'var(--text-1)', fontFamily:'Roboto,sans-serif', fontSize:13 };
  const LBL = { fontSize:10, fontFamily:'Roboto,sans-serif', fontWeight:700,
    letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-3)',
    marginBottom:5, display:'block' };

  return (
    <div onClick={onClose}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.72)', zIndex:400,
        display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e=>e.stopPropagation()}
        style={{ background:'var(--app-surface)', border:'1px solid var(--app-border-2)',
          borderRadius:16, padding:'24px', width:480, maxHeight:'90vh', overflowY:'auto',
          display:'flex', flexDirection:'column', gap:14,
          boxShadow:'0 24px 64px rgba(0,0,0,.6)' }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:15, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'var(--text-1)' }}>
            {idea ? 'Editar Ideia' : 'Nova Ideia'}
          </span>
          <button onClick={onClose}
            style={{ width:28,height:28,borderRadius:'50%',background:'rgba(255,255,255,.07)',
              color:'var(--text-2)',cursor:'pointer',fontSize:18,
              display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>
        </div>

        <div>
          <span style={LBL}>Título</span>
          <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}
            style={INP} placeholder="Ex: Depoimento real de resultado"/>
        </div>

        <div>
          <span style={LBL}>Descrição / Conceito</span>
          <textarea value={form.desc} onChange={e=>setForm(p=>({...p,desc:e.target.value}))}
            rows={3} style={{...INP, resize:'vertical'}}
            placeholder="Descreva o conceito do criativo..."/>
        </div>

        <div>
          <span style={LBL}>Destino</span>
          <div style={{ display:'flex', gap:6 }}>
            {DESTINOS.map(d => {
              const dc = DESTINO_CFG[d];
              const active = form.destino === d;
              return (
                <button key={d} onClick={() => setForm(p => ({ ...p, destino: d }))}
                  style={{ padding:'7px 18px', borderRadius:999, cursor:'pointer',
                    fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:12.5, transition:'all 150ms',
                    display:'flex', alignItems:'center', gap:6,
                    background: active ? dc.bg : 'rgba(255,255,255,.06)',
                    border: `1px solid ${active ? dc.border : 'var(--app-border)'}`,
                    color: active ? dc.color : 'var(--text-2)' }}>
                  <LucideIcon icon={dc.icon} size={12}/>{d}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span style={LBL}>Plataforma</span>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {ALL_FMTS.map(f => {
              const sel = form.formats[0] === f;
              return (
                <button key={f} onClick={()=>setForm(p=>({...p, formats:[f]}))}
                  style={{ padding:'7px 16px', borderRadius:999, cursor:'pointer',
                    fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:12.5, transition:'all 150ms',
                    display:'flex', alignItems:'center', gap:6,
                    background:sel?'rgba(234,170,65,.18)':'rgba(255,255,255,.06)',
                    border:`1px solid ${sel?'rgba(234,170,65,.4)':'var(--app-border)'}`,
                    color:sel?'var(--fmn-gold)':'var(--text-2)' }}>
                  <LucideIcon icon={(window.PLAT_ICON||{})[f]||'file'} size={13}/>{f}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span style={LBL}>Status</span>
          <div style={{ display:'flex', gap:6 }}>
            {STATUS_COLS.map(s => (
              <button key={s} onClick={()=>setForm(p=>({...p,status:s}))}
                style={{ padding:'7px 16px', borderRadius:999, cursor:'pointer',
                  fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:12, transition:'all 150ms',
                  background:form.status===s?'rgba(234,170,65,.18)':'rgba(255,255,255,.06)',
                  border:`1px solid ${form.status===s?'rgba(234,170,65,.4)':'var(--app-border)'}`,
                  color:form.status===s?'var(--fmn-gold)':'var(--text-2)' }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Referência */}
        <div>
          <span style={LBL}>Referência (opcional)</span>
          <div style={{ display:'flex', background:'rgba(255,255,255,.04)',
            border:'1px solid var(--app-border)', borderRadius:8, padding:3, gap:1, marginBottom:10 }}>
            {[['link','Link','link'],['upload','Upload','upload-cloud']].map(([id,l,ic])=>(
              <button key={id} onClick={()=>setRefMode(id)}
                style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                  padding:'6px', borderRadius:6, cursor:'pointer', transition:'all 130ms',
                  background:refMode===id?'rgba(234,170,65,.15)':'transparent',
                  border:`1px solid ${refMode===id?'rgba(234,170,65,.2)':'transparent'}`,
                  color:refMode===id?'var(--fmn-gold)':'rgba(255,255,255,.42)',
                  fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:11.5 }}>
                <LucideIcon icon={ic} size={13}/>{l}
              </button>
            ))}
          </div>

          {refMode === 'link' && !form.ref ? (
            <div style={{ display:'flex', gap:8 }}>
              <input value={urlInput} onChange={e=>setUrlInput(e.target.value)}
                placeholder="https://..." style={{...INP, flex:1}}
                onKeyDown={e=>{ if(e.key==='Enter') applyUrl(); }}/>
              <button onClick={applyUrl}
                style={{ padding:'8px 14px', borderRadius:8, background:'rgba(234,170,65,.15)',
                  border:'1px solid rgba(234,170,65,.25)', color:'var(--fmn-gold)',
                  fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:12, cursor:'pointer' }}>
                OK
              </button>
            </div>
          ) : refMode === 'link' && form.ref ? null : (
            <>
              <input type="file" accept="video/*,image/*" ref={fileRef}
                onChange={handleFile} style={{ display:'none' }}/>
              <button onClick={()=>fileRef.current?.click()}
                style={{ width:'100%', padding:'18px', borderRadius:8, cursor:'pointer',
                  background:'rgba(255,255,255,.03)', border:'2px dashed rgba(255,255,255,.12)',
                  color:'var(--text-3)', fontFamily:'Roboto,sans-serif', fontSize:12.5, fontWeight:700,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'all 150ms' }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(234,170,65,.3)';e.currentTarget.style.color='var(--fmn-gold)';}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,.12)';e.currentTarget.style.color='var(--text-3)';}}>
                <LucideIcon icon="upload-cloud" size={18}/>Clique para enviar vídeo ou imagem
              </button>
            </>
          )}

          {form.ref && (
            <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <RefPreview r={form.ref} embed={true}/>
              </div>
              <button onClick={()=>setForm(p=>({...p,ref:null}))}
                style={{ width:22,height:22,borderRadius:'50%',background:'rgba(248,113,113,.15)',
                  border:'none',color:'#f87171',display:'flex',alignItems:'center',
                  justifyContent:'center',cursor:'pointer',flexShrink:0 }}>
                <LucideIcon icon="x" size={11}/>
              </button>
            </div>
          )}
        </div>

        <div style={{ display:'flex', gap:8, paddingTop:4 }}>
          <Btn variant="ghost" size="md" style={{ flex:1, justifyContent:'center' }} onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" size="md" style={{ flex:1, justifyContent:'center' }}
            disabled={!form.title.trim() || form.formats.length===0}
            onClick={()=>onSave(form)}>
            Salvar
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ── IdeaColumn ─────────────────────────────────────────────────*/
function IdeaColumn({ colId, ideas, onEdit, onConvert, onDelete, onAddNew }) {
  const cfg = COL_CFG[colId];
  return (
    <div style={{ display:'flex', flexDirection:'column', background:cfg.bg,
      border:`1px solid ${cfg.border}`, borderRadius:14, overflow:'hidden', height:'100%' }}>

      <div style={{ padding:'13px 16px', borderBottom:`1px solid ${cfg.border}`,
        display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
        <span style={{ width:8,height:8,borderRadius:'50%',background:cfg.dot,flexShrink:0 }}/>
        <span style={{ fontSize:12.5,fontFamily:'Roboto,sans-serif',fontWeight:700,
          color:'var(--text-1)',flex:1 }}>{colId}</span>
        <span style={{ minWidth:22,height:22,borderRadius:'50%',background:'rgba(255,255,255,.08)',
          display:'flex',alignItems:'center',justifyContent:'center',
          fontSize:11,fontFamily:'Roboto,sans-serif',fontWeight:900,color:'var(--text-2)' }}>
          {ideas.length}
        </span>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'10px',
        display:'flex', flexDirection:'column', gap:8 }}>
        {ideas.map(idea => (
          <IdeaCard key={idea.id} idea={idea} colCfg={cfg} onEdit={onEdit} onConvert={onConvert} onDelete={onDelete}/>
        ))}
        {ideas.length === 0 && (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
            justifyContent:'center', gap:8, opacity:.3, minHeight:80 }}>
            <LucideIcon icon="inbox" size={22} color="var(--text-3)"/>
            <span style={{ fontSize:11.5,fontFamily:'Roboto,sans-serif',color:'var(--text-3)' }}>Sem ideias</span>
          </div>
        )}
      </div>

      {colId === 'Ideia' && (
        <div style={{ padding:'6px 10px 10px', borderTop:`1px solid ${cfg.border}`, flexShrink:0 }}>
          <button onClick={onAddNew}
            style={{ width:'100%', padding:'8px', borderRadius:7, cursor:'pointer',
              background:'transparent', border:`1px dashed ${cfg.border}`,
              color:'var(--text-3)', fontSize:11.5, fontFamily:'Roboto,sans-serif', fontWeight:700,
              display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all 150ms' }}
            onMouseEnter={e=>{e.currentTarget.style.color=cfg.dot;e.currentTarget.style.borderColor=cfg.dot;}}
            onMouseLeave={e=>{e.currentTarget.style.color='var(--text-3)';e.currentTarget.style.borderColor=cfg.border;}}>
            <LucideIcon icon="plus" size={13}/>Adicionar ideia
          </button>
        </div>
      )}
    </div>
  );
}

/* ── IdeiaScreen ────────────────────────────────────────────────*/
function IdeiaScreen() {
  const [ideas, setIdeas]         = useState(INIT_IDEAS);
  const [dbAvailable, setDbAvail] = useState(false);
  const [fmtFilter, setFmtFilter] = useState('Todos');
  const [modal, setModal]         = useState(null);
  const [convertedInfo, setConvertedInfo] = useState(null);

  useEffect(() => {
    if (!window.db) return;
    window.db.from('ideias')
      .select('id,title,status,formats,description,destino,ref_type,ref_value,ref_mime')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) return; // tabela não existe ainda
        setDbAvail(true);
        if (data && data.length > 0) {
          setIdeas(data.map(r => ({
            id: r.id, title: r.title, status: r.status,
            formats: r.formats || [],
            desc: r.description || '',
            destino: r.destino || 'Anúncio',
            ref: r.ref_type ? { type: r.ref_type, value: r.ref_value, mime: r.ref_mime } : null,
          })));
        }
      });
  }, []);

  const filtered = fmtFilter === 'Todos' ? ideas : ideas.filter(i => i.formats.includes(fmtFilter));

  const handleSave = async form => {
    const row = {
      title: form.title, status: form.status,
      formats: form.formats, description: form.desc || '',
      destino: form.destino || 'Anúncio',
      ref_type: form.ref?.type || null, ref_value: form.ref?.value || null, ref_mime: form.ref?.mime || null,
    };
    if (form.id && typeof form.id === 'string') {
      // UUID = Supabase record
      if (dbAvailable) await window.db.from('ideias').update(row).eq('id', form.id);
      setIdeas(prev => prev.map(i => i.id===form.id ? form : i));
    } else {
      if (dbAvailable) {
        const { data } = await window.db.from('ideias').insert(row).select().single();
        if (data) { setIdeas(prev => [{ ...form, id: data.id }, ...prev]); setModal(null); return; }
      }
      setIdeas(prev => [{ ...form, id: Date.now() }, ...prev]);
    }
    setModal(null);
  };

  const handleConvert = async id => {
    const idea = ideas.find(i => i.id === id);
    if (!idea) return;
    const goingToAds = idea.status === 'Ideia';
    const newStatus = goingToAds ? 'Convertido' : 'Ideia';

    // Ao converter: ADS → aba Criativos | Orgânico → aba Orgânico
    if (goingToAds && dbAvailable) {
      // Serializa a referência da ideia para preservar no novo card
      const refToStore = (() => {
        if (!idea.ref) return null;
        if (idea.ref.type === 'url') return idea.ref.value;
        if (idea.ref.type === 'file' && idea.ref.mime?.startsWith('image')) {
          return JSON.stringify({ type:'image', mime: idea.ref.mime, value: idea.ref.value });
        }
        if (idea.ref.type === 'file' && idea.ref.mime?.startsWith('video')) {
          return '[vídeo de referência — ver ideia original]';
        }
        return null;
      })();

      if (idea.destino === 'Orgânico') {
        // Orgânico suporta todas as plataformas (inclui Artigo, Youtube, Stories)
        const plataforma = (window.PLATAFORMAS || []).includes(idea.formats?.[0]) ? idea.formats[0] : 'Reels';
        const row = {
          tema: idea.title,
          plataforma,
          status: 'Fazer',
          responsavel: 'Felipe',
          gancho: idea.desc || '',
        };
        if (refToStore) row.referencia = refToStore;
        const { error } = await window.db.from('conteudo_organico').insert(row);
        if (error) { alert('Não consegui criar o orgânico: ' + error.message); return; }
        setConvertedInfo(`Card orgânico "${idea.title.slice(0,30)}..." criado na aba Orgânico.`);
      } else {
        const fmtMap = { Reels:'reels', Imagem:'imagem', Carrossel:'carrossel' };
        const tipo = fmtMap[idea.formats?.[0]] || 'reels';
        const { data: maxRows } = await window.db.from('ads')
          .select('numero').order('numero', { ascending:false }).limit(1);
        const novoNumero = ((maxRows?.[0]?.numero) || 0) + 1;
        const row = {
          numero: novoNumero,
          titulo: idea.title,
          tipo,
          status: 'fazer',
          observacoes: idea.desc ? `Origem: ideia convertida.\n\n${idea.desc}` : 'Origem: ideia convertida.',
        };
        if (refToStore) row.referencia = refToStore;
        const { error } = await window.db.from('ads').insert(row);
        if (error) { alert('Não consegui criar o ADS: ' + error.message); return; }
        setConvertedInfo(`Criativo ADS ${String(novoNumero).padStart(3,'0')} criado na aba Criativos, coluna Fazer.`);
      }
      setTimeout(() => setConvertedInfo(null), 4000);
    }

    if (dbAvailable && typeof id === 'string') await window.db.from('ideias').update({ status: newStatus }).eq('id', id);
    setIdeas(prev => prev.map(i => i.id!==id ? i : { ...i, status: newStatus }));
  };

  const handleDelete = async id => {
    if (!confirm('Excluir esta ideia?')) return;
    if (dbAvailable && typeof id === 'string') await window.db.from('ideias').delete().eq('id', id);
    setIdeas(prev => prev.filter(i => i.id !== id));
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {convertedInfo && (
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:800,
          display:'flex', alignItems:'center', gap:8, padding:'12px 18px', borderRadius:10,
          background:'rgba(74,222,128,.12)', border:'1px solid rgba(74,222,128,.3)',
          boxShadow:'0 12px 40px rgba(0,0,0,.5)' }}>
          <LucideIcon icon="check-circle" size={16} color="#4ade80"/>
          <span style={{ fontSize:13, fontFamily:'Roboto,sans-serif', fontWeight:700, color:'#4ade80' }}>
            {convertedInfo}
          </span>
        </div>
      )}
      <TopBar title="Ideias"
        actions={
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ display:'flex', background:'rgba(255,255,255,.04)',
              border:'1px solid var(--app-border)', borderRadius:8, padding:3, gap:1 }}>
              {['Todos', ...ALL_FMTS].map(f => (
                <button key={f} onClick={() => setFmtFilter(f)}
                  style={{ padding:'5px 11px', borderRadius:6, cursor:'pointer', transition:'all 130ms',
                    background:fmtFilter===f?'rgba(234,170,65,.15)':'transparent',
                    border:`1px solid ${fmtFilter===f?'rgba(234,170,65,.2)':'transparent'}`,
                    color:fmtFilter===f?'var(--fmn-gold)':'rgba(255,255,255,.42)',
                    fontFamily:'Roboto,sans-serif', fontWeight:700, fontSize:11 }}>
                  {f}
                </button>
              ))}
            </div>
            <Btn variant="primary" size="sm" icon="plus" onClick={() => setModal({ type:'new' })}>
              Nova Ideia
            </Btn>
          </div>
        }/>

      {/* Board — CSS grid garante 2 colunas sempre iguais e tela cheia */}
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 1fr', gridTemplateRows:'1fr',
        gap:16, padding:'16px 24px', overflow:'hidden', minHeight:0 }}>
        {STATUS_COLS.map(col => (
          <IdeaColumn
            key={col} colId={col}
            ideas={filtered.filter(i => i.status===col)}
            onEdit={idea => setModal({ type:'edit', idea })}
            onConvert={handleConvert}
            onDelete={handleDelete}
            onAddNew={() => setModal({ type:'new' })}
          />
        ))}
      </div>

      {modal && (
        <IdeaModal
          idea={modal.type==='edit' ? modal.idea : null}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

window.IdeiaScreen = IdeiaScreen;
