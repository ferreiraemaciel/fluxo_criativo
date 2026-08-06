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

---

## Template de prompt (copiar e substituir os campos entre colchetes)

```
Create a simple, raw, native-looking Instagram quote graphic. CANVAS SIZE IS MANDATORY AND EXACT: 1080px wide by 1350px tall, vertical portrait orientation, 4:5 ratio, standard Instagram feed post size. Do not crop, do not output square, do not output landscape. This should look like something a real person made in 2 minutes using Instagram's own text tool, not a designed graphic.

BACKGROUND: Plain solid warm off-white/cream color (like #F2EDE4), completely flat, no gradient, no texture, no photo. Slightly imperfect paper tone, very subtle grain, nothing polished.

MAIN TEXT (the whole visual focus): centered, big bold rounded sans-serif capital letters, black, in the exact visual style of Instagram's native "Strong" text sticker (thick, chunky, slightly playful rounded font, tight line spacing), reading across multiple centered lines:

"[FRASE PRINCIPAL EM CAIXA ALTA, COM A PALAVRA FOTOGRAFIA OU FOTÓGRAFO DENTRO DELA]"

Break the line naturally so it reads well, filling most of the vertical center of the frame.

SMALL HANDWRITTEN NOTE below the main text, casual handwritten marker font (like annotated by hand with Instagram's doodle pen, slightly tilted, imperfect, small), in a bold vibrant neon color (choose one: neon green, vibrant orange, bubblegum pink, strong yellow, electric blue), not muted or pastel: "[anotação curta, reforço ou virada da frase]"

BOTTOM: small, plain, gray handle text, horizontally centered at the bottom of the frame (not in a corner), no bold: "@felipeferreirafotografo"

STYLE: Deliberately imperfect and handmade-looking, zero corporate polish, no icons, no cards, no borders, no drop shadows, no gradients, looks exactly like a screenshot exported straight from the Instagram app's own text-post creator. All text correctly spelled Portuguese, crisp and legible despite the raw style.

Output as PNG, exactly 1080x1350px, vertical portrait, 4:5 ratio.
```

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
