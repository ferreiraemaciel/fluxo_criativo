# Identidade Visual dos Carrosséis — Felipe Ferreira Fotógrafo

> Referência fixa pra gerar prompts de imagem de carrossel do Instagram (@felipeferreirafotografo).
> Consultar este arquivo antes de montar qualquer prompt de carrossel novo.
> Regras vivas: o Felipe pode pedir ajuste ou inclusão a qualquer momento ("inclua essa regra", "vamos reavaliar").

---

## Filosofia de produção (prioridade sobre tudo)

- **Não criar carrossel que dificulte o trabalho, dê retrabalho ou seja complexo demais de produzir.**
- Objetivo: produzir muito, com o menor esforço possível, no menor tempo possível, com a maior qualidade possível.
- **Pensar muito mais no conteúdo do que na estética.** Feito é melhor que perfeito.
- Bonito e legível é suficiente. Não precisa ser o carrossel mais bonito do mundo.
- **Não pode parecer feito por IA. Precisa ter cara humanizada.**

---

## Estrutura geral

- **Sem número fixo de slides.** O carrossel tem quantos slides o conteúdo pedir.
- **Todo slide, sem exceção, é gerado no tamanho 1080x1350px** (largura x altura, vertical, proporção 4:5).
- Cada slide pode ter fundo diferente entre si: cor sólida, textura leve, ou foto ocupando o espaço todo.
- **Capa (slide 1) e último slide (CTA)** usam foto real do Felipe, ou uma ilustração de personagem muito parecido com ele (existe gabarito próprio pra gerar essa ilustração via ChatGPT).
- No canto direito de cada slide (exceto o último), um pedacinho do próximo slide "vaza" visualmente na borda, dando a sensação de que existe mais conteúdo pra arrastar. **Essa barra é aplicada depois no Canva pelo Felipe, manualmente, no momento de montar o carrossel. NUNCA incluir essa instrução no prompt de imagem do ChatGPT — o ChatGPT não sabe qual é o próximo slide e o resultado fica ruim.**
  - **Atenção:** só omitir a instrução não é suficiente. O ChatGPT tende a inserir essa barra colorida na borda direita sozinho (por inferência do estilo). É obrigatório incluir uma instrução negativa explícita em todo prompt de slide, tipo: "IMPORTANT: do not include any vertical color bar, stripe, edge accent, or preview of another slide on the right edge of the image — the background must extend uniformly edge to edge, full bleed, no side border of any kind."
- Ícone de "arraste para o lado" com setinha em todos os slides, exceto o último.
- **Slide 1 (capa):**
  - Headline fixa: "Fotógrafo e videomaker" (tag/eyebrow, sempre presente)
  - Título do tema do carrossel
  - A imagem/foto da capa precisa ser a mais bonita e chamativa de todas — é o gancho visual principal do post
- **Arroba `@felipeferreirafotografo`** aparece no primeiro e no último slide.

---

## Padronização tipográfica

- Todos os títulos do carrossel: mesma fonte, mesmo tamanho, em todos os slides.
- Todos os subtítulos: mesma fonte, mesmo tamanho, em todos os slides.
- O carrossel inteiro precisa ser visualmente coeso — nenhum slide pode destoar muito dos outros.

---

## Sistema de cor e identidade semântica

- Se um slide estabelece uma identidade de cor pra responder algo (ex: verde = sim/pode, vermelho = não/não pode, laranja = depende), **essa mesma identidade se repete em todos os slides que usam esse padrão dentro do carrossel.**
- O último slide (CTA) sempre **quebra o padrão de cor de propósito**, pra chamar atenção e sinalizar "isso aqui é diferente, é a hora de agir" (geralmente CTA de seguir o perfil).
- Fundos sem foto geralmente são cor sólida ou textura leve — nunca algo que atrapalhe a leitura do texto.

---

## Liberdade permitida

- Pode usar ícone, ilustração simples, figura de linguagem visual pra facilitar entendimento.
- Pode variar o layout de slide pra slide, desde que a base tipográfica e a paleta geral do carrossel se mantenham reconhecíveis como uma peça única.

---

## Histórico de ajustes

- 2026-07-03: Primeira versão. Consolidado a partir da análise de 4 carrosséis de referência publicados no perfil + explicação direta do Felipe.
- 2026-07-03: Adicionada regra de tamanho fixo (1080x1350px em todo slide) e número de slides livre, sem quantidade fixa.
- 2026-07-03: Esclarecido que a "barra de vazamento do próximo slide" é aplicada no Canva pelo Felipe, não deve entrar no prompt do ChatGPT.
- 2026-07-03: Slide de capa/CTA com o personagem precisa usar o gabarito de referência do Felipe de fato (enviar a imagem de referência junto do prompt no ChatGPT), com cenário/props que conectem com fotografia e com o tema do carrossel. Proibido retrato genérico "careca, óculos, braço cruzado" sem nenhuma identificação visual com o assunto ou com o universo da fotografia — isso é clichê e não tem identidade.
