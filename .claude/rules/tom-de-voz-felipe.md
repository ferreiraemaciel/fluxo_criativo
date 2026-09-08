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
| `, e ` ligando duas orações | **Proibido. É o "cara de IA" número um pra ele** | Cortar a vírgula, ou quebrar em duas frases com ponto |
| Travessão `—` | Proibido em todo o projeto | Vírgula, ponto, dois pontos ou parênteses |
| Ponto de exclamação | Proibido | Ponto final |
| Vírgula entre sujeito e verbo | Proibido, mesmo com sujeito longo | Remover |

**Não existe exceção para enumeração de 3 ou mais itens.** Português não usa vírgula de Oxford.

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

## 8. Reels

Roteiro em pegada natural de fala, nunca de texto lido em voz alta. Frases curtas, contrações
("tava", "tá"), pausas reais, jeito de contar caso. Depois de escrever, reler em voz alta
mentalmente: se soar institucional, soltar mais.

---

## 9. Rotina obrigatória antes de escrever artigo

Ler o texto real do último artigo publicado, puxando direto do Supabase, e não apenas confiar em
resumo ou memória. A memória é resumo, o texto publicado é a cadência real dele.

---

## 10. Onde mais isso vive

Esta regra é a versão operacional. O histórico completo de correções feitas por ele, artigo a artigo,
está na memória do projeto em `user_tom-de-voz-artigos.md`. Quando surgir correção nova, atualizar
os dois.
