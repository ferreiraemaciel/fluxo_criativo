# Design System. Peça Jurídica Visual

> Fonte de verdade do visual. Validado em produção na notificação Unity Digital, na procuração e no contrato de honorários do caso Robison Kunz (setembro de 2026). Não inventar cor, fonte, raio ou espaçamento fora daqui. Para evoluir o visual, mude este arquivo, não o HTML já gerado de um cliente.

## Tipografia

Google Fonts, importadas no `<style>`:

```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap');
```

- **Playfair Display** (500/600/700): títulos, nomes de partes, valores em destaque, monograma.
- **EB Garamond** (400/500, itálico 400): corpo de texto, legendas, subtítulos.

## Paleta (CSS variables, sempre no `:root`)

```css
:root{
  --accent:#b07a3c;
  --accent-dark:#8a5f2c;
  --ink:#4a4540;
  --title:#3a342e;
  --light:#9a9189;
  --paper:#fdfcf9;
  --paper-2:#f7f2ea;
  --red:#c0392b;
  --green:#3d7a5c;
  --line:#e6ddd0;
}
```

Dourado amadeirado como cor de destaque (`--accent`), nunca azul, nunca cor corporativa fria. Vermelho só para alerta/pendência/prazo/não-cumprimento. Verde só para confirmação/valor positivo/caminho favorável.

## Casca do documento

```css
body{ margin:0; padding:32px 0 64px; background:#efe9df; font-family:'EB Garamond', Georgia, serif; color:var(--ink); }
.doc{ max-width:794px; margin:0 auto; background:var(--paper); box-shadow:0 12px 40px rgba(58,52,46,0.14); border-radius:4px; overflow:hidden; }
```

`794px` é largura útil de A4 a 96dpi. O fundo da página (`#efe9df`) é mais escuro que o papel (`--paper`), para o card do documento se destacar. **`padding` do `body` é só vertical (32px/64px), nunca lateral.** Combinado com o Felipe em 2026-09-29: um `padding` lateral no `body` cria uma borda visível dos dois lados do `.doc` (o fundo mais escuro aparecendo nas laterais), e ele não quer isso em nenhum documento — o `.doc` deve encostar nas extremidades quando a tela/PDF é mais estreita que 794px, sem gutter mínimo forçado.

### Aviso de rascunho (enquanto houver campo pendente)

```html
<div class="aviso-edicao">
  <strong>Rascunho para conferência.</strong> Os trechos em vermelho ainda precisam ser confirmados ou preenchidos antes do envio para assinatura.
</div>
```
```css
.aviso-edicao{ max-width:794px; margin:0 auto 18px; background:#fff5f2; border:1px solid #f1c6bb; color:var(--red); font-size:15px; padding:12px 18px; border-radius:4px; text-align:center; }
```

Remover esse banner só quando não sobrar nenhum `.pendente` no documento.

## Cabeçalho (hero)

Foto real (nunca ilustração, nunca stock genérico) com overlay escuro e tipografia branca. Ver seção "Capa fotográfica" abaixo para como gerar a imagem.

```css
header.hero{
  position:relative;
  background:
    linear-gradient(180deg, rgba(18,14,10,0.58) 0%, rgba(18,14,10,0.72) 55%, rgba(18,14,10,0.88) 100%),
    url('CAPA_IMG_SRC') center 38%/cover no-repeat;
  color:#ffffff; padding:46px 56px 44px; text-align:center; min-height:280px;
}
.kicker{ font-family:'EB Garamond', Georgia, serif; letter-spacing:3px; text-transform:uppercase; font-size:13px; opacity:0.92; margin:0 0 10px; text-shadow:0 2px 10px rgba(0,0,0,0.35); }
h1.titulo{ font-family:'Playfair Display', Georgia, serif; font-weight:700; font-size:32px; margin:0 0 12px; line-height:1.2; color:#fff; text-shadow:0 2px 14px rgba(0,0,0,0.4); }
.subtitulo{ font-size:17px; font-style:italic; opacity:0.96; margin:0; max-width:560px; margin-left:auto; margin-right:auto; color:#f6f1e6; text-shadow:0 2px 10px rgba(0,0,0,0.35); }
```

```html
<header class="hero">
  <p class="kicker">{TIPO DA PEÇA EM CAIXA ALTA, EX: PROCURAÇÃO}</p>
  <h1 class="titulo">{título humano, curto, que resume o objetivo da peça}</h1>
  <p class="subtitulo">{1 frase de contexto, cita o caso}</p>
</header>
```

**Nunca** adicionar marca, logo ou nome do escritório sobreposto na foto. Já testamos e o cliente pediu para tirar (ficava com "cara de anos 2000"). O cabeçalho é só a foto, o kicker, o título e o subtítulo. Nunca incluir a barra tracejada decorativa no rodapé do hero, também já foi pedido para tirar.

## Capa fotográfica

Gerar via skill `gerar-imagem` (ChatGPT/Chrome), formato paisagem, para caber no `header.hero`.

**Prompt validado** (flat lay realista, mesa de trabalho, câmera + notebook, sem parecer IA):

```
A realistic overhead flat-lay photograph, shot from directly above (bird's-eye view) on a rustic dark walnut wood desk. Arranged neatly: an open MacBook laptop with a blank dark screen, a professional mirrorless camera with a lens, a leather-bound legal notebook, a fountain pen resting on top of printed documents, a pair of reading glasses, a small stack of papers, and a cup of coffee. Warm natural window light from one side, soft realistic shadows, shot on a DSLR camera with a 35mm lens, candid editorial workspace photography, photojournalistic and unretouched look, muted warm color grading in gold, walnut brown and cream tones, no text, no human hands or faces, no logos, no CGI or illustrated look, genuinely photographic texture and film grain, not glossy, not AI-looking. WIDE HORIZONTAL LANDSCAPE ORIENTATION, ultra-wide banner composition suited for a website header background (16:9 or wider), with open negative space in the upper third of the frame.
```

**Por que esse prompt e não outro.** A primeira tentativa (still-life dramático, câmera + balança da justiça + pasta de couro, luz lateral encenada) foi rejeitada: "parece IA e o documento ficou com cara de anos 2000". O flat lay top-down com objetos de trabalho reais (câmera, laptop, caderno) resolveu porque é um enquadramento que existe de verdade em fotografia de still editorial, não um cenário montado. Prefira sempre esse padrão (flat lay, ângulo 90°, luz de janela) a still life dramático de estúdio.

**A mesma imagem serve para todas as peças do mesmo caso.** Gere uma vez, reaproveite na peça principal, na procuração e no contrato de honorários. Consistência visual entre os três documentos de um mesmo caso é parte do padrão, não precisa gerar capa nova para cada peça a menos que o cliente peça.

Depois de gerado, comprima antes de embutir (ver "Pipeline técnico").

## Cards de partes (quem é quem)

Duas colunas lado a lado. Serve para Outorgante/Outorgado, Contratante/Contratado, Notificante/Notificados.

```css
.partes{ display:flex; gap:20px; margin:0 0 36px; }
.parte-card{ flex:1; background:var(--paper-2); border:1px solid var(--line); border-radius:6px; padding:20px 22px; }
.parte-card .rotulo{ font-size:12px; letter-spacing:1.5px; text-transform:uppercase; color:var(--accent-dark); font-weight:600; margin:0 0 8px; }
.parte-card .nome{ font-family:'Playfair Display', Georgia, serif; font-size:18px; color:var(--title); margin:0 0 6px; font-weight:600; }
.parte-card .detalhe{ font-size:14.5px; color:var(--light); line-height:1.5; }
.parte-card .logo-parte{ height:34px; max-width:150px; object-fit:contain; object-position:left center; margin:0 0 10px; display:block; }
```

Se a parte tiver um logo real com fundo transparente disponível (não escaneado, não de baixa resolução), incluir com `.logo-parte` acima do rótulo. Se só existir uma versão escaneada de baixa qualidade, **recriar em CSS/tipografia** em vez de embutir a imagem ruim (ver seção "Quando não usar uma marca existente").

@media (max-width:640px): `.partes{ flex-direction:column; }`

## Títulos de seção

```css
h2.secao{ font-family:'Playfair Display', Georgia, serif; font-size:22px; color:var(--title); font-weight:600; margin:44px 0 8px; padding-bottom:10px; border-bottom:2px solid var(--line); }
p.lead-secao{ font-size:15.5px; color:var(--light); font-style:italic; margin:0 0 22px; }
```

## Linha do tempo (só quando há fatos a narrar em ordem cronológica)

```css
.linha-tempo{ margin:0 0 8px; position:relative; padding-left:4px; }
.evento{ display:flex; gap:18px; padding-bottom:26px; position:relative; }
.evento:last-child{ padding-bottom:6px; }
.evento::before{ content:""; position:absolute; left:9px; top:22px; bottom:0; width:2px; background:var(--line); }
.evento:last-child::before{ display:none; }
.ponto{ flex:0 0 20px; height:20px; border-radius:50%; background:var(--accent); margin-top:2px; box-shadow:0 0 0 4px var(--paper-2); z-index:1; }
.ponto.alerta{ background:var(--red); }
.evento .quando{ font-size:13px; letter-spacing:0.5px; text-transform:uppercase; color:var(--accent-dark); font-weight:600; margin:0 0 4px; }
.evento .fato{ font-size:16.5px; line-height:1.6; margin:0; }
.evento .fato strong{ color:var(--title); }
```

`.ponto` dourado para fatos neutros, `.ponto.alerta` vermelho para descumprimento ou inércia da outra parte. Cada evento é uma data (ou período) + um parágrafo, nunca uma lista de bullets. Datas em ordem cronológica real, nunca reordenadas para efeito dramático, se algo aconteceu depois de outra coisa, a ordem no documento reflete isso (já corrigimos esse erro uma vez: tráfego não autorizado tinha ficado antes da reunião que na real o causou).

## Caixa de destaque única (`.caixa`)

Para um único bloco de texto que precisa se destacar, cláusula de devolução, poderes específicos, objeto do contrato, validade jurídica.

```css
.caixa{ background:var(--paper-2); border-left:4px solid var(--accent); border-radius:0 6px 6px 0; padding:20px 24px; margin:0 0 32px; font-size:16.5px; line-height:1.7; }
.caixa .titulo-caixa{ font-family:'Playfair Display', Georgia, serif; font-weight:600; font-size:16px; color:var(--title); margin:0 0 8px; display:flex; align-items:center; gap:8px; }
```

Título sempre com 1 emoji + texto curto (ex: "📋 O objeto deste contrato", "📋 O que está autorizado").

## Grid de mini-cards com ícone (o workhorse)

Este é o componente que substitui parágrafo de cláusula por cartão escaneável. Toda vez que o conteúdo original é "textão jurídico", quebre em mini-cards, um conceito por card, ícone + título curto + 1 a 3 frases.

```css
.grid-2{ display:grid; grid-template-columns:1fr 1fr; gap:16px; margin:0 0 32px; }
.grid-3{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; margin:0 0 32px; }
.mini-card{ background:var(--paper-2); border:1px solid var(--line); border-top:3px solid var(--accent); border-radius:6px; padding:18px 20px; }
.mini-card .mini-titulo{ font-family:'Playfair Display', Georgia, serif; font-weight:600; font-size:15.5px; color:var(--title); margin:0 0 8px; display:flex; align-items:center; gap:8px; }
.mini-card .mini-texto{ font-size:14.5px; line-height:1.6; color:var(--ink); margin:0 0 8px; }
.mini-card .mini-texto:last-child{ margin-bottom:0; }
.mini-card .mini-texto .base-legal{ color:var(--accent-dark); font-weight:600; }
```

`grid-3` usa `.poder-card` (variante centralizada, ícone grande) quando o conteúdo é uma lista curta de poderes/permissões, ver procuração.

```css
.poder-card{ background:var(--paper-2); border:1px solid var(--line); border-top:3px solid var(--accent); border-radius:6px; padding:16px 16px; text-align:center; }
.poder-card .icone{ font-size:26px; display:block; margin:0 0 8px; }
.poder-card .texto{ font-size:14px; line-height:1.5; color:var(--ink); margin:0; }
```

**Número de cards par.** Sempre feche a grade com número par de cards (2, 4, 6...) para não sobrar buraco visual numa grid de 2 colunas. Se o conteúdo natural der ímpar, ou junte dois pontos pequenos num card só, ou adicione um card de fechamento relevante (ex: Foro), nunca force `grid-column:1/-1` num card do meio da grade (quebra a ordem visual dos pares seguintes).

**Exceção.** Um card que precisa de mais espaço (várias sub-informações, como "Prazo de repasse" com duas contas bancárias dentro) pode usar `style="grid-column:1 / -1;"` para ocupar a linha inteira. Coloque esse card em posição que não deixe buraco feio (idealmente não seja o único ímpar da sequência, ou aceite o buraco ao lado do primeiro card se for só 1 exceção em toda a grade).

Referência de emoji por tema (usar como ponto de partida, adaptar ao conteúdo real):
🎯 sem garantia de resultado · 🗣️ informação/declaração · 🤝 boa-fé · ✅ ciência/concordância · 🔓 independência profissional · 🚫 rescisão por má-fé · 📍 foro · 🕐 atendimento fora do horário · 🚗 despesas · ⚖️ custas/processo · 🕊️ morte ou incapacidade · 🚪 encerramento do contrato · 🏆 sucumbência · ⏱️ prazo · 💰 dinheiro/pagamento · 🏛️ representação institucional · ✍️ assinar/transigir · 📄 documentos · 🔁 substabelecer · 🎙️ gravação/prova · 💸 dinheiro sem autorização · 🧾 nota fiscal/comprovante · 🎥 vídeo/gravação · 💬 conversas/mensagens · 📱 contato/whatsapp.

## Caixa de honorários com dois caminhos (contrato de risco / êxito)

Use sempre que o modelo de cobrança for êxito (contingência), nunca para valor fixo simples (nesse caso, uma `.caixa` comum basta).

```css
.honorarios{ background:linear-gradient(135deg, #fff 0%, var(--paper-2) 100%); border:2px solid var(--accent); border-radius:8px; padding:28px 30px; margin:0 0 20px; }
.honorarios .titulo-caixa{ font-family:'Playfair Display', Georgia, serif; font-weight:700; font-size:20px; color:var(--title); margin:0 0 6px; text-align:center; }
.honorarios .percentual-grande{ text-align:center; margin:6px 0 22px; }
.honorarios .percentual-grande b{ font-family:'Playfair Display', Georgia, serif; font-size:52px; color:var(--green); line-height:1; }
.honorarios .percentual-grande span{ display:block; font-size:14px; color:var(--light); margin-top:4px; }
.dois-caminhos{ display:flex; gap:16px; margin:0 0 6px; }
.caminho{ flex:1; border-radius:6px; padding:16px 18px; font-size:14.5px; line-height:1.6; }
.caminho.sim{ background:#eef6f0; border:1px solid #bcdcc4; }
.caminho.nao{ background:#fdf1ee; border:1px solid #f1c6bb; }
.caminho .rotulo-caminho{ font-weight:700; font-size:14px; margin:0 0 6px; display:flex; align-items:center; gap:6px; }
.caminho.sim .rotulo-caminho{ color:var(--green); }
.caminho.nao .rotulo-caminho{ color:var(--red); }
.caminho p{ margin:0; color:var(--ink); }
```

```html
<div class="honorarios">
  <p class="titulo-caixa">Honorários de êxito</p>
  <div class="percentual-grande"><b>{N}%</b><span>sobre o valor efetivamente recuperado</span></div>
  <div class="dois-caminhos">
    <div class="caminho sim"><p class="rotulo-caminho">✅ Se houver recuperação</p><p>{N}% do valor recebido...</p></div>
    <div class="caminho nao"><p class="rotulo-caminho">❌ Se não houver recuperação</p><p>Nenhum valor é devido ao advogado.</p></div>
  </div>
</div>
```

@media (max-width:640px): `.dois-caminhos{ flex-direction:column; }`

## Grade de contas bancárias

Para quando o documento precisa registrar para onde o dinheiro vai (prazo de repasse, dados para pagamento).

```css
.contas-grid{ display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:14px 0 0; }
.conta-chip{ background:var(--paper); border:1px solid var(--line); border-radius:6px; padding:12px 14px; }
.conta-chip .conta-label{ font-size:11px; letter-spacing:1px; text-transform:uppercase; color:var(--accent-dark); font-weight:600; margin:0 0 4px; }
.conta-chip .conta-nome{ font-weight:600; color:var(--title); font-size:14px; margin:0 0 3px; }
.conta-chip .conta-dados{ font-size:13px; color:var(--light); margin:0; }
```

@media (max-width:640px): `.contas-grid{ grid-template-columns:1fr; }`

## Bloco de cláusula avulsa

Para uma regra isolada que não cabe em mini-card nem merece `.caixa` com destaque de cor (ex: "sobre o prazo e o silêncio", "canal exclusivo de comunicação").

```css
.bloco-clausula{ background:var(--paper); border:1px solid var(--line); border-radius:6px; padding:18px 20px; margin:20px 0 28px; font-size:15px; line-height:1.7; }
.bloco-clausula .titulo-clausula{ font-family:'Playfair Display', Georgia, serif; font-weight:600; font-size:15.5px; color:var(--title); margin:0 0 8px; }
```

## Pedido (breakdown financeiro)

Só para peças que cobram um valor (não usar em procuração; contrato de honorários usa a versão simplificada dentro de `.honorarios`).

```css
.pedido{ background:linear-gradient(135deg, #fff 0%, var(--paper-2) 100%); border:2px solid var(--accent); border-radius:8px; padding:30px 32px; margin:20px 0 28px; }
.pedido .titulo-caixa{ font-family:'Playfair Display', Georgia, serif; font-weight:700; font-size:20px; color:var(--title); margin:0 0 16px; }
.linha-pedido{ display:flex; justify-content:space-between; align-items:baseline; padding:11px 0; border-bottom:1px dashed var(--line); font-size:16px; gap:16px; }
.linha-pedido:last-child{ border-bottom:none; }
.linha-pedido .rotulo-p{ color:var(--light); flex:0 0 auto; }
.linha-pedido .valor-p{ text-align:right; font-weight:600; color:var(--title); }
.linha-pedido.total{ border-top:2px solid var(--accent); border-bottom:none; padding-top:16px; margin-top:4px; }
.linha-pedido.total .valor-p{ color:var(--green); font-size:20px; }
.consequencia{ font-size:15px; color:var(--light); line-height:1.7; font-style:italic; margin:14px 0 0; }
.metodologia{ font-size:13px; color:var(--light); line-height:1.6; margin:10px 0 0; padding-top:10px; border-top:1px dashed var(--line); }
.metodologia b{ color:var(--ink); }
```

**Regra de ouro do pedido.** Se o valor final é uma estimativa (juros + correção calculados por você, não um número documentado), **sempre** mostre o `.metodologia` explicando a conta (taxa usada, período, base legal do juro e da correção). Nunca entregue só o número final sem a fórmula, o cliente advogado precisa conseguir auditar e defender esse número. Se o caso muda um dado-base depois (ex: "cobra o valor cheio, não só a metade"), **não** reescreva silenciosamente um valor já documentado por terceiro (extrato, nota fiscal, e-mail do financeiro). Mostre a peça em duas linhas: o valor documentado como estava, `+` a diferença agora cobrada, `=` o novo principal. Transparência de cálculo é parte do produto, não only nice-to-have.

## Proposta de acordo

```css
.proposta{ background:var(--paper-2); border:2px solid var(--accent-dark); border-radius:8px; padding:24px 28px; margin:0 0 28px; }
.proposta .titulo-caixa{ font-family:'Playfair Display', Georgia, serif; font-weight:700; font-size:19px; color:var(--title); margin:0 0 16px; }
.opcao{ background:var(--paper); border:1px solid var(--line); border-radius:6px; padding:16px 18px; margin:0 0 14px; }
.opcao:last-of-type{ margin-bottom:0; }
.opcao .opcao-titulo{ font-weight:600; color:var(--accent-dark); font-size:14px; letter-spacing:0.5px; text-transform:uppercase; margin:0 0 6px; }
.opcao .opcao-texto{ font-size:15px; line-height:1.6; margin:0; color:var(--ink); }
.proposta .prazo-resposta{ font-size:15px; color:var(--title); line-height:1.65; margin:18px 0 0; font-weight:600; background:#fff; border:1px solid var(--accent); border-radius:6px; padding:14px 16px; }
```

O prazo de resposta (contraproposta) sempre em destaque visual próprio (fundo branco, borda dourada, negrito), não como legenda pequena. Já foi pedido explicitamente para dar peso a essa frase.

**Sempre em valores absolutos, nunca só percentual**, quando a proposta parcelar um total. "30% do valor" sozinho obriga o leitor a fazer conta, escreva o R$ do lado.

## Assinatura (rodapé)

```css
footer.assinatura{ padding:36px 56px 48px; text-align:center; border-top:1px solid var(--line); margin-top:12px; }
.local-data{ font-size:16px; margin:0 0 34px; }
.assinaturas{ display:flex; justify-content:center; gap:50px; flex-wrap:wrap; }
.assinatura-linha{ width:270px; border-top:1px solid var(--title); padding-top:10px; }
.assinatura-linha .nome-adv{ font-family:'Playfair Display', Georgia, serif; font-weight:600; font-size:16.5px; color:var(--title); margin:0 0 3px; }
.assinatura-linha .papel{ font-size:13px; color:var(--light); }
```

Um `.assinatura-linha` para peça de assinatura única (procuração, só o outorgante assina). Dois dentro de `.assinaturas` lado a lado para contrato bilateral. **Nunca** adicionar legendas tipo "assina primeiro" / "assina depois" no rodapé, mesmo que a ordem de assinatura importe no fluxo operacional, isso já foi pedido para tirar, é informação de bastidor, não do documento. Se a ordem de assinatura precisar ficar registrada em algum lugar, é conversa/nota interna, não texto do documento.

Nunca usar enfeite decorativo (asteriscos, estrelinhas "⁂") entre o fim do conteúdo e a assinatura. Já foi pedido para tirar.

## Campo pendente

```css
.pendente{ color:var(--red); font-weight:700; background:#fdf1ee; padding:2px 8px; border-radius:4px; }
```

Todo dado que não foi confirmado (CPF, RG, data de assinatura, percentual a validar, endereço) usa `<span class="pendente">[o que falta]</span>`, nunca um valor inventado. Assim que o dado chegar, troque o span por texto normal e, quando não sobrar nenhum `.pendente`, remova o `.aviso-edicao` do topo.

## Página impressa (obrigatório em toda peça)

Sem este bloco, o PDF quebra página no meio de um card. Incluir sempre, ajustando a lista de seletores conforme os componentes usados naquele documento:

```css
@media print{
  * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  body{ background:var(--paper); padding:0; }
  .aviso-edicao{ display:none; }
  .doc{ box-shadow:none; max-width:100%; }
  header.hero{ break-inside:avoid; page-break-inside:avoid; }
  .partes{ break-inside:avoid; page-break-inside:avoid; }
  .parte-card, .mini-card, .caixa, .bloco-clausula, .pedido, .proposta, .opcao, .honorarios{
    break-inside:avoid; page-break-inside:avoid;
  }
  h2.secao{ break-after:avoid; page-break-after:avoid; }
  .evento{ break-inside:avoid; page-break-inside:avoid; }
  footer.assinatura{ break-inside:avoid; page-break-inside:avoid; }
}
```

`-webkit-print-color-adjust:exact` é o que garante que a foto do cabeçalho e os fundos coloridos apareçam no PDF, sem essa linha o Chrome imprime tudo em branco.

## Responsivo (obrigatório, celular é uso real)

```css
@media (max-width:640px){
  header.hero{ padding:34px 24px 28px; }
  h1.titulo{ font-size:24px; }
  .conteudo{ padding:28px 22px 8px; }
  .partes{ flex-direction:column; }
  .grid-2, .grid-3{ grid-template-columns:1fr; }
  .dois-caminhos{ flex-direction:column; }
  .contas-grid{ grid-template-columns:1fr; }
  .assinaturas{ gap:24px; }
  footer.assinatura{ padding:28px 22px 36px; }
  .linha-pedido{ flex-direction:column; align-items:flex-start; }
  .linha-pedido .valor-p{ text-align:left; }
}
```

**Importante para verificação visual.** Sob 640px de largura os grids colapsam para 1 coluna, isso é o esperado, não um bug. Ao conferir o layout de 2 ou 3 colunas no navegador, use `resize_window` com largura ≥1000px antes de tirar o screenshot, senão a grade aparece empilhada e parece quebrada quando não está.

## Quando não usar uma marca/logo existente

Se o cliente tiver um logo próprio, mas o único arquivo disponível for uma versão escaneada, de baixo DPI, com ruído de compressão (aconteceu com o logo em PDF do escritório), **não** embuta essa imagem. Recrie a essência da marca em CSS/tipografia limpa (ex: monograma num quadrado rotacionado com as iniciais em itálico + nome do escritório em Playfair Display) só se o cliente pedir marca no documento. Por padrão, e a menos que peçam o contrário, **prefira não colocar marca nenhuma no cabeçalho**, o padrão validado é a foto sozinha, sem overlay de texto de marca (ver seção Cabeçalho acima, isso já foi pedido explicitamente numa rodada).
