# Formato "Citação Crua" — Felipe Ferreira Fotógrafo

> Referência fixa pra gerar prompts de imagem única no estilo "citação crua" (@felipeferreirafotografo).
> Consultar este arquivo antes de montar qualquer prompt novo desse formato.
> Regras vivas: o Felipe pode pedir ajuste a qualquer momento ("inclua essa regra", "vamos reavaliar").
> Criado em 2026-08-05, a partir da peça "Copiar o preço do concorrente" (aula de precificação).

---

## O que é

Imagem única, 1080x1350px, que imita um post nativo feito na hora com a ferramenta de texto do
próprio Instagram. Não é carrossel, não é peça de agência. É uma frase de impacto isolada, com cara
de anotação pessoal, não de material publicitário.

Serve pra teses fortes, argumentativas, que cabem numa frase só. Quando o conteúdo precisa de lista,
comparação em colunas ou sequência de passos, não é esse formato. Nesse caso, vai de carrossel
(ver `IDENTIDADE-VISUAL-CARROSSEL.md`).

---

## Filosofia (mesma prioridade do carrossel)

- Não pode parecer feito por IA. Cara humanizada, imperfeita, de "print de story".
- Feito é melhor que perfeito. Zero polimento de agência.
- Rápido de gerar, rápido de reconhecer.

---

## Estrutura obrigatória

1. **Tamanho exato: 1080x1350px, vertical, 4:5.** Reforçar no prompt em pelo menos 2 pontos
   (abertura e fechamento), porque geradores de imagem tendem a arredondar ou cortar quadrado.
2. **Fundo liso cor creme** (`#F2EDE4` ou tom bem próximo), sem gradiente, sem textura chamativa,
   grão bem sutil.
3. **Frase principal** em caixa alta, fonte bold arredondada, preta, estilo do sticker nativo
   "Strong" do Instagram. É o elemento central, ocupa o meio vertical do quadro.
4. **A frase principal precisa identificar o nicho dentro do próprio texto** (a palavra
   "fotografia" ou "fotógrafo" tem que estar na frase, não como selo separado). Errado: selo
   "PREÇO NA FOTOGRAFIA" acima da frase genérica. Certo: "Fotógrafo que copia o preço do
   concorrente está copiando o prejuízo dele."
5. **Anotação manuscrita pequena**, abaixo da frase principal, fonte de caneta casual, levemente
   torta, como se alguém tivesse rabiscado com a caneta do Instagram depois. É o reforço ou a virada
   da frase principal, não uma repetição dela.
   **Cor: sempre um tom forte e vibrante, tipo caneta neon do Instagram** (verde neon, laranja
   vibrante, rosa chiclete, amarelo forte), nunca uma cor apagada ou pastel. Varia peça a peça,
   escolher uma cor diferente da usada na peça anterior, pra elas não ficarem repetitivas na
   sequência do feed.
6. **`@felipeferreirafotografo` sempre centralizado horizontalmente na base da arte**, nunca em
   canto, cor cinza discreta, sem negrito.
7. Sem ícone, sem card, sem borda, sem sombra, sem gradiente. Só tipografia sobre fundo liso.
8. **A legenda nunca repete a frase principal que já está escrita na arte.** Quem vê o post já leu
   a citação na própria imagem. Repetir a mesma frase como abertura da legenda é redundante e
   cansativo de ler duas vezes. A legenda começa contextualizando, contando a história por trás da
   frase, ou aprofundando o argumento, nunca reescrevendo a frase principal.

---

## Variante com atribuição (frase de terceiro)

> Regra fixa, 2026-08-07, a partir do ORG 061 ("A frase da juíza").

Quando a frase principal **não é do Felipe** (citação de decisão judicial, de lei, de estudo, de
livro), a peça muda em quatro pontos:

1. **A citação é literal.** Nunca parafrasear e apresentar como se fosse a fala da pessoa. Se
   precisar encurtar pra caber, usar `[...]` pra marcar a supressão, que é a marca editorial padrão.
2. **Entra uma linha de atribuição** logo abaixo da citação, bem menor, em cinza, sem aspas.
   Ex: `Decisão da 9ª Vara Cível do Rio de Janeiro, julho de 2026`.
3. **A frase vai em caixa baixa**, não em caixa alta, porque é citação e caixa alta descaracteriza
   o texto de outra pessoa.
4. **A anotação manuscrita vira o comentário do Felipe sobre a frase**, em vez de reforço da frase
   dele. É ali que entra a tradução sem juridiquês, a piada, ou a aplicação prática.

**Por que isso importa mais do que parece.** Atribuir a um magistrado uma frase que ele não
escreveu é erro factual, e num perfil que se apoia em autoridade jurídica isso derruba a
credibilidade inteira. O ORG 061 quase saiu assim: o card trazia "Ser pessoa pública não abre a casa
de ninguém", que é a tradução do Felipe no artigo, não o que a juíza escreveu. A frase real da
decisão é outra, e o próprio artigo diz que o peso dela está na literalidade.

Cuidado extra em conteúdo jurídico: se a decisão for **liminar e não sentença**, a legenda precisa
registrar isso. Publicar como se já houvesse condenação antecipa resultado que a Justiça não deu.

---

## Produção: direto no Canva, sem prompt de IA pra texto (regra fixa, 2026-08-06)

**Esse formato não usa mais prompt de geração de imagem via IA.** Depois de testar em algumas
peças, o texto gerado por IA nunca sai com a tipografia, o espaçamento e a caixa exatos do
Instagram nativo (ver histórico de ajustes do ORG 035 em `IDENTIDADE-VISUAL-CASO-REAL.md`). Pra
Citação Crua, que é 100% tipografia, esse problema pesa ainda mais do que no Caso Real. Decisão:
produzir direto no Canva, do zero.

**Como montar no Canva:**
1. Canvas 1080x1350px.
2. Fundo cor sólida creme (`#F2EDE4` ou tom bem próximo), sem textura, sem gradiente.
3. Frase principal centralizada, caixa alta, fonte bold arredondada (ex: Poppins Bold, Montserrat
   Black, ou fonte nativa parecida com o sticker "Strong" do Instagram), preta, ocupando o meio
   vertical do quadro.
4. Anotação manuscrita pequena abaixo, fonte de caneta/handwriting do Canva, cor neon vibrante
   (variar a cada peça, nunca repetir a cor da peça anterior).
5. `@felipeferreirafotografo` centralizado horizontalmente na base, cinza discreto, sem negrito.

Os campos do card no Tracker (headline = frase principal, observações = anotação manuscrita e cor
escolhida) continuam sendo preenchidos normalmente, só o campo `prompt` fica vazio ou anotado como
"produção direto no Canva".

---

## Peças já feitas nesse formato

- "Fotógrafo que copia o preço do concorrente está copiando o prejuízo dele." (aula de precificação, peça 7)
- "Todo mês some R$ 944 do caixa de um fotógrafo e isso não aparece em nenhuma conta." (peça 1)
- "Preço de fotografia não é o que você acha. É uma faixa que já existe na cabeça de quem compra." (peça 4)
- "Trabalhar com fotografia em casa não elimina o custo do seu negócio. Só transfere ele para a conta da sua casa." (peça 9)
- "A ordem em que você mostra os pacotes de fotografia decide qual deles o cliente escolhe." (peça 5, ancoragem)

---

## Histórico de ajustes

- 2026-08-05: Primeira versão, criada a partir da peça 7 da aula de precificação. Corrigido nessa
  mesma sessão: identificação de nicho precisa estar embutida na frase (não em selo separado), @
  sempre centralizado na base, canvas reforçado em 2 pontos do prompt.
- 2026-08-06: Removido o prompt de geração via IA. Produção passa a ser 100% manual no Canva,
  decisão tomada depois de repetidos problemas de tipografia/espaçamento nas peças geradas por IA.
