# Tom de Voz do Felipe — Regra Obrigatória de Toda Geração de Conteúdo

> Vale para artigo, Reels, carrossel, imagem estática, legenda, e-mail, roteiro, card de ideia no
> Tracker e qualquer texto assinado por ele. Sem exceção.
> Fonte primária: dissertação de mestrado (PPGTIC/UFSC), artigos publicados no blog da FMN e edições
> reais feitas por ele no admin.

O objetivo desta regra é um só: **o texto não pode ter cara de IA.** Precisa soar como ele falando
ou escrevendo, com a precisão de quem é advogado e a leveza de quem é fotógrafo.

---

## 1. Varredura mecânica obrigatória antes de entregar

Rodar sempre, em qualquer texto, antes de mostrar ao usuário:

```bash
grep -n ", e \|—\|!" arquivo
```

| Padrão | Situação | Como corrigir |
|---|---|---|
| `, e ` ligando duas orações | **Proibido. É o "cara de IA" número um pra ele** | Cortar só a vírgula. Nunca virar ponto seguido de E |
| Travessão `—` | Proibido em todo o projeto | Vírgula, ponto, dois pontos ou parênteses |
| Ponto de exclamação | Proibido | Ponto final |
| Vírgula entre sujeito e verbo | Proibido, mesmo com sujeito longo | Remover |
| `. E ` cortando frase | **Uso raro, nunca como conector padrão** | Ver seção abaixo |

**Não existe exceção para enumeração de 3 ou mais itens.** Português não usa vírgula de Oxford.

### Ponto seguido de E, a regra da raridade

Correção dele em 2026-08-29, a partir do ORG 112: **ele não corta a frase com ponto e recomeça com
E.** Faz isso só quando é realmente necessário, e isso é muito raro.

O que ele rejeitou foi o E usado como conector automático, tapando buraco de ritmo:

> Configuração, luz, composição, edição, direção de pose. E nunca treinou um item da lista do técnico.

O que ele usa de verdade, como batida retórica deliberada, no começo de parágrafo e nunca em série:

> E olha, isso não é discurso de superação.
> E aí aparece o efeito colateral bom.

**Regra prática:** no máximo uma ocorrência por peça, sempre abrindo parágrafo, nunca colando duas
frases da mesma ideia. Se o E está ali só para emendar, apagar o E e deixar a frase começar direto,
ou juntar as duas com vírgula sem conjunção, que é o outro padrão dele.

**E cuidado ao corrigir `, e`:** a saída correta é tirar a vírgula, não virar ponto seguido de E.
Trocar um vício pelo outro foi o erro cometido nesse mesmo lote.

**O que é permitido e ele usa de propósito:**
- Vírgula antes de "mas" ligando duas frases
- Vírgula sozinha juntando duas frases curtas e paralelas, sem conjunção
  ("não foi o registro, foi a organização da prova")

---

## 2. Ritmo

A régua não é frase longa sempre nem frase curta sempre. É **alternância**.

Parágrafo narrativo longo, costurado por vírgula e oração subordinada, com ritmo de quem argumenta
em voz alta. E então, no ponto de virada, uma frase curta e seca que fecha o raciocínio.

Texto inteiro de frases curtas lê tão mecânico quanto texto inteiro de frases-rio.

---

## 3. Pessoa e presença

**Primeira pessoa pervasiva**, não só na abertura. Mesmo em peça factual sobre processo judicial,
a reação dele entra ao longo do texto inteiro.

Traz a pergunta real do interlocutor entre aspas e literal, e responde:
"Felipe, agora eu não posso mais fotografar criança?"

---

## 4. Repertório de voz confirmado em uso real

Idiomas e tiques que podem entrar em qualquer ponto, não são de tema específico:

`na boa` · `sacou?` / `sacou a diferença?` · `imagina só` · `imagina a minha cara quando escuto isso`
· `convenhamos` · `vem comigo...` · `vai nessa, confia na sorte` · `isso é um tapa na cara de quem
diz` · `um tempo danado` · `é triste, mas é a realidade`

Figuras que ele chama de temperos, a puxar quando couber, nunca como checklist:
antítese equilibrada, crescendo retórico, tríade, personificação jurídica, provérbio, aparte
conversacional, ironia sinalizada ("repare na ironia").

---

## 5. Analogia é a assinatura

A assinatura dele é **o uso de metáfora e analogia**, não um tema fixo. Preferência por **cultura pop
e cotidiano**: séries, filmes, jogos de tabuleiro, futebol, placar, prateleira de supermercado.

Não precisa ser uma só, nem precisa abrir o texto, nem precisa ser filada do início ao fim. Entra em
qualquer ponto onde couber, quantas vezes fizer sentido. O que se evita é abertura corporativa e seca
de produtividade.

---

## 6. Rigor de fonte, sem exceção

Toda afirmação jurídica precisa de lastro real: lei, artigo, decreto, súmula ou decisão. Menção de
raspão também. Em artigo, vira nota de rodapé numerada com link.

Separar sempre três registros: **fato da decisão**, **relato de imprensa** (que entra atribuído) e
**interpretação própria**. Nunca afirmar mais do que a fonte primária sustenta.

---

## 7. Arquitetura de artigo

- Títulos de seção que são frase, não etiqueta ("A palavra que muda tudo")
- Estrutura "o que X é, e o que não é", para desfazer mal-entendido
- Um quadro pode x não pode, ou com x sem, no meio
- Facilitação visual de verdade, componente HTML on-brand, nunca lista de bullet disfarçada de
  linha do tempo
- Fecho prático com o cabeçalho recorrente **"O que fazer na segunda-feira de manhã"**, sem "nesta"
- Aterrissagem humana no fim: dignidade, a pessoa por trás do dado ou da foto

**A seção de honestidade não é automática.** Perto do fecho ela mata o embalo. Se a nuance importa,
tecer mais cedo no texto, ou cortar.

---

## 8. Legenda de rede social, orgânico e pago

> Combinado com Felipe em 09/09/2026, nos ORG 127 e 128, e CORRIGIDO por ele no mesmo dia depois
> da primeira tentativa. Vale para TODO conteúdo de rede social, orgânico ou pago: legenda de post,
> carrossel, Reels, imagem estática e copy de anúncio.

Artigo pede precisão de advogado. Legenda pede o Felipe conversando. As duas vozes são dele, e o
erro mais comum é escrever legenda com cadência de artigo.

### "Sem tanta pontuação" quer dizer MENOS PONTO FINAL, não frase curta

Este é o ponto que eu errei na primeira versão e que precisa ficar cravado: ele **emenda com
vírgula**, não corta com ponto. Excesso de ponto final é o que dá cara de IA, porque fragmenta a
fala em pedacinhos que ninguém fala assim.

| Errado, fragmentado | Certo, como ele escreve |
|---|---|
| A gente entra nessa pelo clique. Pela luz que aparece do nada. Pelo pai que chora. | A gente entra nessa pelo clique, pela luz que aparece do nada, pelo pai que chora |
| Você manda uma pergunta de uma linha. Ele responde com sete áudios. | Você manda uma pergunta de uma linha, ele responde com sete áudios |
| Ele não tá te enrolando. Tá dirigindo. Só que o seu orçamento fica pendurado nisso. | Ele não tá te enrolando, tá dirigindo, com o filho no banco de trás, resolvendo a vida dele, só que o seu orçamento fica pendurado nisso |

**Régua medida nos textos que ele mesmo reescreveu:**

- **11 a 14 palavras por frase**, em média. Abaixo de 10 está fragmentado demais.
- **4 a 7 vírgulas** num texto de legenda. Se tiver 1 ou 2, faltou emenda.
- Enumeração corre com vírgula até o fim, sem virar frases separadas.

Depois de escrever, contar: número de palavras dividido por número de frases. Se der menos que 10,
juntar frases com vírgula antes de entregar.

### O resto do registro

- **Informal de verdade.** Contração à vontade (tá, pra, tô), gíria natural, jeito de quem fala.
- **Risada escrita quando couber.** Ele usa "kkkkkk" no fim de tirada, principalmente no fecho.
- **Humor pelo detalhe específico, nunca piada pronta.** A pasta "final_final_2", o áudio com
  barulho de trânsito, a frase que importava sendo a mais banal de todas. Detalhe específico
  demais para ter sido inventado é o que faz o leitor rir e se ver ali.
- **Expressão de criança e de intimidade.** "promessa de dedinho: não vou julgar" no lugar de
  "prometo não julgar". O jeito torto é mais dele que o jeito correto.
- **Sacada que puxa leitura.** A primeira linha existe para o cara parar de rolar, e promete um
  reconhecimento, não uma tese.
- **Fecho que gera ação.** Pergunta, marcação, confissão coletiva. "Marca aqui o fotógrafo que tem
  um cliente assim, ou assume, se o cliente for você kkkkkk" funciona. "Comente o que achou" não.

**O que não muda:** todas as proibições da seção 1 continuam valendo. Nada de `, e` ligando
orações, travessão, exclamação, vírgula entre sujeito e verbo. Ponto seguido de E continua raro.
Repare que vírgula emendando orações SEM conjunção é o padrão dele, e sempre foi permitida na
seção 1. O proibido é a vírgula seguida de "e".

**O que não fazer:** encher de emoji, forçar gíria que ele não usa, virar coach, ou picar o texto
em frases de cinco palavras achando que isso é ser informal.

---

## 9. Reels

Roteiro em pegada natural de fala, nunca de texto lido em voz alta. Frases curtas, contrações
("tava", "tá"), pausas reais, jeito de contar caso. Depois de escrever, reler em voz alta
mentalmente: se soar institucional, soltar mais.

Gancho, estrutura do conteúdo e fechamento seguem `.claude/skills/conteudo/references/reels-ganchos-e-premissas.md`: o gancho sai de fala real
do público, o conteúdo é cadeia de premissas e o que é caso ou número do Felipe fica marcado para ele
preencher, nunca inventado.

---

## 10. Rotina obrigatória antes de escrever artigo

Ler o texto real do último artigo publicado, puxando direto do Supabase, e não apenas confiar em
resumo ou memória. A memória é resumo, o texto publicado é a cadência real dele.

---

## 11. Onde mais isso vive

Esta regra é a versão operacional. O histórico completo de correções feitas por ele, artigo a artigo,
está na memória do projeto em `user_tom-de-voz-artigos.md`. Quando surgir correção nova, atualizar
os dois.
