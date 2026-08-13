# Formato "Caso Real" (foto + manchete) — Felipe Ferreira Fotógrafo

> Referência fixa pra gerar prompts de imagem única no estilo "caso real com foto" (@felipeferreirafotografo).
> Consultar este arquivo antes de montar qualquer prompt novo desse formato.
> Regras vivas: o Felipe pode pedir ajuste a qualquer momento ("inclua essa regra", "vamos reavaliar").
> Criado em 2026-08-06, a partir do ORG 018 (caso da Primeira Comunhão).

---

## O que é

Imagem única, 1080x1350px, fotografia realista (não ilustração, não Citação Crua) com uma manchete
em caixa preta e texto branco na parte inferior. Serve pra casos reais, histórias, matérias com uma
cena concreta pra ilustrar, diferente da Citação Crua (que é só texto, sem foto, pra teses soltas).

Quando o conteúdo é narrativo, tem personagem, cena, contexto físico, vai de Caso Real. Quando é
uma frase isolada, sem cena, vai de Citação Crua (ver `IDENTIDADE-VISUAL-CITACAO-CRUA.md`).

---

## Estrutura obrigatória

1. **Tamanho exato: 1080x1350px, vertical, 4:5.**
2. **Fotografia real**, estilo fotojornalístico, nunca 3D render, nunca "brilho de IA". Pessoas
   mostradas de costas ou com o rosto fora de foco/fora de quadro sempre que possível, tanto por
   privacidade quanto porque a cena não depende de rosto pra funcionar.
3. **Crianças, quando aparecem no fundo, sempre desfocadas e não identificáveis.** Nunca rosto de
   menor nítido ou reconhecível, mesmo em cena fictícia genérica.
4. **Manchete em caixa preta arredondada com texto branco em negrito**, posicionada na parte
   inferior da foto, resumindo o caso em 1 a 3 frases curtas. **A partir de 2026-08-10, o texto NÃO
   vai embutido na geração da imagem, é adicionado depois no Canva** (ver seção "Texto entra no
   Canva" abaixo).
5. **`@felipeferreirafotografo` sempre no canto inferior da arte**, cor branca ou clara, discreto,
   sem negrito. Nunca esquecer, é regra obrigatória, não opcional. Também adicionado no Canva, junto
   com a manchete.
6. Luz quente, tom editorial, nada estéril nem publicitário.
7. **A legenda nunca repete a manchete que já está escrita na arte.** Quem vê o post já leu a
   manchete na própria imagem antes de abrir a legenda. Repetir a mesma frase como abertura da
   legenda é redundante e cansativo de ler duas vezes. A legenda começa contextualizando, contando
   mais do caso, ou aprofundando um ponto que a manchete não cobre, nunca reescrevendo a manchete.

---

## Template de prompt (copiar e substituir os campos entre colchetes)

**Desde 2026-08-10, o texto (manchete + @) NÃO vai no prompt.** O Felipe prefere montar isso no
Canva depois, fica com resultado melhor do que o texto renderizado pela IA. O prompt gera só a foto,
limpa, sem nenhum texto ou elemento gráfico.

```
Create a photorealistic editorial photograph, 1080x1350px (vertical, 4:5 ratio), no text or graphic overlays.

SCENE: [descrever a cena real do caso, pessoas de costas ou fora de foco quando possível, contexto físico que ilustra a história]

LIGHTING: Warm, natural light, editorial and documentary feel, not sterile, not corporate.

STYLE: Real photojournalistic photograph, natural skin and fabric texture, no 3D render, no illustration, no AI-art shine, documentary feel.

Output: PNG, 1080x1350px exactly, full bleed, no borders, no text.
```

## Texto entra no Canva

Como o prompt não gera mais o texto, cada card desse formato precisa deixar documentado, em algum
campo visível (`estetica_visual` funciona bem), exatamente o que escrever depois no Canva:

- **Manchete**: o texto exato, entre aspas, pra colar sem reescrever.
- **Posição**: caixa preta arredondada, texto branco negrito, parte inferior da foto.
- **@felipeferreirafotografo**: texto branco simples, sem caixa, sem negrito, canto inferior, logo
  abaixo da manchete.

Isso substitui o bloco "TEXT TO RENDER ON THE IMAGE" que existia no prompt antes de 2026-08-10.

---

## Peças já feitas nesse formato

- ORG 018 — caso da Primeira Comunhão (fotógrafa vista de costas, sentença numa mão e câmera na
  outra, igreja desfocada ao fundo). **Saiu sem o `@felipeferreirafotografo`, corrigir se for
  reeditar ou reusar a arte.**
- ORG 035 — caso do fotógrafo com 22 anos de experiência (artigo 1, "A juíza disse qual papel
  faltava"). Prompt corrigido em 2026-08-06 pra pedir manchete e @ direto na geração.

---

## Histórico de ajustes

- 2026-08-06: Primeira versão, documentando o padrão já usado no ORG 018 e corrigindo a lacuna do
  `@felipeferreirafotografo` ausente naquela peça.
- 2026-08-06 (mesmo dia): Corrigido o ORG 035, que tinha ido pro Tracker sem a instrução de
  renderizar manchete e @ dentro do prompt. Template atualizado pra sempre pedir o texto já
  embutido na geração, replicando o que funcionou de verdade no ORG 018.
- 2026-08-10: Decisão revertida. O Felipe prefere montar manchete e @ no Canva depois de gerar a
  foto, o resultado fica melhor do que texto renderizado pela IA. Template do prompt voltou a gerar
  só a foto, sem texto, e ganhou a seção "Texto entra no Canva" pra documentar o que escrever em
  cada peça.
