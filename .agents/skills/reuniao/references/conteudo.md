# Opção 1. Gerar conteúdo a partir da reunião

O objetivo é achar, dentro da reunião, o que rende conteúdo para o público do Felipe, e transformar em ideia no Tracker FMN. Não existe gerador novo aqui. Tudo passa pela mesma esteira que ele já usa: um card por formato no Tracker, e depois as skills de Reels, carrossel e artigo quando ele aprovar a ideia.

Antes de começar, carregue `.claude/rules/tom-de-voz-felipe.md`. Todo texto desta etapa é assinado por ele.

## 1. Filtrar o que pode virar conteúdo

Passe a reunião por quatro perguntas. O que não responder a nenhuma, descarte.

1. **O Felipe viveu, decidiu ou aprendeu algo que o público dele também enfrenta?** Um erro, uma decisão difícil, um número, um bastidor. É a matéria-prima mais forte, porque ninguém mais tem.
2. **Alguém fez uma pergunta que o público também faria?** Pergunta de aluno, cliente ou parceiro vira gancho.
3. **Houve uma explicação boa, uma analogia ou um passo a passo?** Explicação que funcionou ao vivo funciona em post.
4. **Houve uma discordância ou um mito derrubado?** Serve para Reels e carrossel.

**Teste de lastro.** Toda ideia precisa apontar o trecho da reunião que a sustenta (horário no documento). Se não houver trecho, é ideia genérica e não entra. Dado, caso ou número que o Felipe não disse na reunião fica marcado `[FELIPE PREENCHE]`, nunca inventado.

## 2. Proteger quem participou

Reunião com cliente, aluno ou parceiro vira conteúdo público, então:

- Tire nome, empresa, cidade e qualquer detalhe que identifique o participante, a não ser que o Felipe diga que pode usar.
- Fala de terceiro não entra como citação. Entra a **situação**, na voz do Felipe: "um fotógrafo me perguntou", e não o nome.
- Valor, comissão ou condição combinada com uma pessoa específica não vira dado de post.
- Nunca nomear concorrente, mesmo que tenha sido citado na reunião. Descreva o fenômeno, não a marca.

## 3. Regras de conteúdo do projeto que já valem

- **Orgânico é topo de funil.** Fala da situação real do público e não puxa para produto. Fecho sem CTA de venda.
- **Sem juridiquês.** Fonte jurídica é matéria-prima, nunca o produto. O entregável é prático.
- **Nunca ancorar em honorário de advogado.** Sem citar OAB ou tabela.
- **Uma ideia por plataforma.** Se o mesmo assunto rende artigo, carrossel e Reels, são três cards, cada um escrito para o seu formato.

## 4. Propor as ideias

Apresente de 3 a 6 ideias, numeradas, cada uma com:

- **Título do card**, já no tom dele
- **Formato sugerido** (Reels, Carrossel, Imagem, Stories, Artigo ou Youtube) e por que esse
- **Gancho**, em uma linha
- **Lastro**, o trecho da reunião que sustenta

Depois pergunte quais ele quer lançar, e se algum assunto rende mais de um formato.

## 5. Escrever e lançar

Para cada ideia aprovada, escreva a descrição **para o formato dela**, seguindo a tabela do `CLAUDE.md` (regra "Uma ideia por plataforma"):

| Formato | O que a descrição entrega |
|---|---|
| Artigo | Ângulo, abertura pronta, estrutura em seções, lastro com fonte |
| Imagem | O que a peça mostra, texto que entra na arte, direção visual |
| Carrossel | Quantidade de slides, o que vai em cada um, legenda |
| Reels | As 7 seções (Headline, Hook, Roteiro em 3 blocos, Legenda, Título, Descrição, Notas de Edição). Cabe ao Felipe preencher caso, número e bastidor |
| Stories | Sequência de telas, enquete ou caixinha, para onde manda |
| Youtube | Ângulo, estrutura do roteiro, título e descrição |

Card de ideia por padrão é só título e gancho. Descrição completa só quando o Felipe aprovar a ideia. Na dúvida, lance enxuto.

**Varredura obrigatória antes de mostrar qualquer texto:**

```bash
grep -n ", e \|—\|!" arquivo_ou_texto
```

`, e ` ligando orações, travessão, ponto de exclamação e vírgula entre sujeito e verbo são proibidos. Corrija e rode de novo. Se a peça for legenda de rede social, aplique também a seção 8 do `tom-de-voz-felipe.md` (11 a 14 palavras por frase, 4 a 7 vírgulas, maiúscula no começo de cada frase).

Mostre as descrições, peça aprovação (`1. Aprovar e salvar`, `2. Quero ajustar algo`) e só então lance, uma vez por formato:

```bash
python3 scripts/tracker-lancar-ideia.py \
  --titulo "..." \
  --formatos "Reels" \
  --destino Orgânico \
  --descricao "..." \
  --referencia "URL_DO_DOCUMENTO_NO_DRIVE"
```

O script recusa mais de um formato por card. O `--referencia` recebe o link do documento da reunião, para o card funcionar sozinho meses depois. Se a reunião tiver participante externo, avise que o link é privado (só quem tem acesso ao Drive do Felipe abre).

Confirme ao final: quantos cards foram lançados, o ID e o formato de cada um. Todos entram na coluna "Ideia".

## 6. Quando o Felipe quiser a peça completa

Só a ideia entra no Tracker. Se ele pedir o roteiro, o carrossel ou o artigo pronto, passe para a skill do formato:

- Reels: `roteiro-de-reels`
- Carrossel: `carrossel` ou `carrossel-visual`
- Artigo: `copy-artigo-blog-fmn`

Entregue a elas o resumo do estudo e os trechos de lastro, para não recomeçar do zero.
