---
name: workshop-marketing:copy-artigo-blog-fmn
description: Escrever um artigo completo para o blog da FMN (fotografiaeomeunegocio.com.br), na voz e na arquitetura já estabelecidas, com visuais gerados e já lançado como rascunho direto no Supabase (aparece no admin do FMN pronto para revisão e publicação).
---

# Artigo para o Blog FMN

Escreve um artigo do zero seguindo a metodologia consolidada nesta conversa (dissertação de mestrado + artigo do ECA Digital + livro científico), aplica o Manual da Copy, gera os visuais e lança tudo como rascunho direto no banco do blog FMN, sem precisar passar pelo admin manualmente.

## Passo 0 — Ler o contexto (sempre, antes de qualquer coisa)

Ler, nesta ordem:
1. Memória `user-tom-de-voz-artigos` (arquitetura do artigo, temperos, metáfora filada, estilo de frase). Se não conseguir acessar a memória diretamente, o conteúdo equivalente está descrito no Passo 2 abaixo.
2. `.claude/rules/copy/checklist-light-copy.md` (12 proibições).
3. `.claude/skills/revisora/references/manual-copy.md` (+ `phrases.md`, `structures.md` se precisar).
4. Memória `feedback-credito-imagens-reproducao` e `feedback-otimizacao-imagens-regra` (regras de crédito e de otimização de imagem).
5. Memória `feedback-design-thinking-visual` (quando vale a pena propor um visual).

## Passo 1 — Entrevista (uma pergunta por vez, curta)

1. "Qual o tema do artigo?" (aceitar resposta livre)
2. "Tem uma palavra-chave de SEO específica que você quer que o artigo dispute?" (se não souber, sugerir uma com base no tema)
3. "Já tem uma analogia ou metáfora em mente pra conduzir o artigo, ou decido eu?" (lembrar: escolher 1 analogia/metáfora, de cultura pop ou do cotidiano, e desenvolvê-la do início ao fim, nunca trocar de metáfora no meio)
4. "Quer que eu já pense num jabá de produto no meio do artigo (só Modelos de Contrato Visual, nunca Blindagem, que é upsell exclusivo pós-compra), ou decidimos isso depois de ler o rascunho?"

Confirmar um resumo curto antes de escrever.

## Passo 2 — Arquitetura obrigatória do artigo

- **Abertura sem número.** Analogia cultural, histórica ou do cotidiano (nunca corporativa/produtividade). Cria a imagem antes de nomear o tema.
- **Pergunta real entre aspas.** Em algum ponto da abertura ou do primeiro H2, trazer a pergunta que o aluno faria de verdade, com nome: *"Felipe, ..."*
- **H2 numerados, com título-frase**, não etiqueta seca (ex: "O acordo que já existe, mesmo quando ninguém assina", não "Introdução").
- **Bloco "X é (e o que não é)"** em algum H2, pra desfazer mal-entendido comum.
- **Quadro comparativo** (markdown table, formato "com a regra" x "sem a regra"), com pelo menos 6 a 8 linhas.
- **Seção de honestidade**, mostrando o outro lado, o que o produto/método NÃO resolve sozinho. Nunca vender como bala de prata.
- **3 histórias reais** (ou "casos"), nomes de fora, curtas e concretas, cada uma ligada a uma cláusula/ponto específico do artigo.
- **Fecho prático**, tipo "o que fazer na segunda-feira de manhã", em lista **com marcador `-` (nunca numerado "1. 2. 3.")**. O renderizador do blog (`post.html`, função `mdRender`) só reconhece linhas começando com `-` ou `*` como lista. Uma lista numerada vira parágrafo corrido, quebrando a leitura.
- **Aterrissagem humana no fechamento.** Sempre eleva pro humano/ético (dignidade, confiança, a pessoa por trás do serviço), nunca fecha só no prático.
- **Notas de rodapé com lei real.** Formato `[^n]` inline no corpo e `[^n]: texto com link` no final do documento, nessa ordem exata de leitura (1, 2, 3... sem pular nem repetir). Sempre linkar a lei real no Planalto (`planalto.gov.br`) ou fonte oficial. Se citar outro artigo do próprio blog, usar link interno (`https://www.fotografiaeomeunegocio.com.br/post.html?slug=...`).
- **Zero travessão (—). Zero ponto de exclamação** fora de imagem. Conferir com regex antes de salvar.

## Passo 3 — Escrever e revisar

Escrever o artigo completo internamente. Rodar a skill `revisora` (ou aplicar o Manual da Copy manualmente) antes de mostrar qualquer coisa. Corrigir tudo que a revisora apontar.

Mostrar o artigo completo pro usuário e perguntar:
```
1. Aprovar e seguir para os visuais
2. Quero ajustar algo no texto
```

## Passo 4 — Visuais

Segue a regra global do projeto: gerar imagem sempre via ChatGPT (skill `gerar-imagem`, usa Claude in Chrome), nunca gerar imagem por outro meio se o Chrome estiver disponível.

Propor, com base em design thinking (memória `feedback-design-thinking-visual`):
- Um mapa mental / "arquitetura" do assunto principal (nó central + ramos), se o artigo tiver uma lista de itens (cláusulas, etapas, passos).
- Uma imagem de abertura (frame de filme/série real via crédito "Reprodução/Detentor", ou foto gerada por IA se for cena original).
- Outros visuais que reforcem pontos específicos (quadro visual, régua de equilíbrio, checklist), só se fizer sentido, sem exagerar.

Para cada imagem:
1. Gerar o prompt em inglês.
2. Gerar via `gerar-imagem` (ChatGPT) ou buscar o frame real (Frinkiac para Simpsons, etc.).
3. Otimizar antes de subir: aresta maior no máximo 1920px sem upscale; **se o arquivo de origem é PNG, mantém PNG**; se não é PNG, vira JPG ~80%. (Ver memória `feedback-otimizacao-imagens-regra` para o porquê.)
4. Subir via `curl -F "file=@arquivo" -F "prefix=fmn" "https://fem-upload.blindagem-fmn.workers.dev"`, que devolve `{"url": "..."}`.
5. Se for frame de terceiro (filme/série), a legenda termina em `Foto: Reprodução/Nome do detentor.`

## Passo 5 — Lançar como rascunho no Supabase

Ler a anon key do Supabase dinamicamente (nunca hardcodar em script): extrair de `fmn-site/public/blog.html` a linha `const SB_KEY = '...'`. URL do projeto: `https://hmiyfywzumpttwzqiccu.supabase.co`.

Montar o registro:
```json
{
  "site": "fmn",
  "titulo": "...",
  "slug": "...",
  "resumo": "... (140 a 160 caracteres)",
  "conteudo": "... (markdown completo, com as imagens já embutidas como ![legenda](url))",
  "categoria": "Direito | Precificação | Contratos | Negócios | Marketing | Posicionamento | MFP",
  "capa_url": "... (imagem de capa, se já tiver)",
  "ativo": false,
  "imgs": ["url1", "url2", ...],
  "exibir_data": true,
  "youtube_id": ""
}
```

Inserir via `POST /rest/v1/posts` (headers `apikey`, `Authorization: Bearer {key}`, `Content-Type: application/json`, `Prefer: return=representation`).

**Sempre `ativo: false` neste passo.** Publicar é decisão do usuário, nunca automática.

## Passo 6 — Entregar

Devolver:
- O link de prévia: `https://www.fotografiaeomeunegocio.com.br/post.html?slug={slug}` (funciona mesmo com `ativo=false`, só não aparece na listagem do blog nem é indexado).
- Confirmação de que está salvo como rascunho no admin (`admin.fotografiaeomeunegocio.com.br`), pronto pra edição.
- Perguntar se quer publicar agora (`ativo: true`) ou deixar em revisão.

## Notas técnicas importantes

- Nunca usar Python heredoc nem pipe `curl | python3` para operações com o token do Supabase, mesmo sendo uma anon key pública. Preferir scripts `.py` escritos em arquivo e chamados via `python3 arquivo.py`, seguindo o padrão de execução técnica do projeto.
- Todo ajuste feito depois da primeira publicação do rascunho (novo parágrafo, nova imagem, troca de nota de rodapé) deve ser feito com o mesmo padrão: buscar o conteúdo atual, aplicar a mudança pontual, validar (zero travessão, zero exclamação, notas em sequência), gravar de volta.
- Se inserir uma nota de rodapé no meio do texto, lembrar de renumerar todas as notas seguintes (corpo E bloco de definições) para manter a ordem de leitura 1, 2, 3... sem furo.
- Publicar (deploy) o site NÃO é necessário para o artigo aparecer. O conteúdo vem direto do Supabase. Só é preciso rodar `wrangler pages deploy public --project-name fmn-site` se algo no HTML/CSS/JS do site (`fmn-site/public/`) tiver mudado.
