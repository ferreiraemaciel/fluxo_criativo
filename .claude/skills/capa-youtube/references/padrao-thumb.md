# Padrão de capa que funciona no nicho

Levantado em 29/09/2026 a partir do canal Método VTSD (Leandro Ladeira), que é a
referência de capa adotada no projeto. Serve de régua para qualquer capa gerada pela
skill `capa-youtube`.

---

## A anatomia que se repete

Praticamente toda capa do canal tem a mesma estrutura, e é ela que deve ser copiada.

**Metade e metade.** Pessoa recortada ocupando um lado, texto ocupando o outro. Nunca
texto por cima do rosto, nunca pessoa no centro com texto em volta.

**A pessoa olha para a câmera e faz alguma coisa.** Aponta, mostra a palma da mão,
segura um objeto. Rosto parado e braços caídos não segura clique.

**O texto é bloco, não linha.** Três a quatro linhas empilhadas, caixa alta, fonte
condensada pesada, alinhadas à esquerda. Entrelinha apertada, quase colada.

**Uma palavra em destaque.** Sempre uma, nunca duas. Cor viva sobre fundo sólido,
normalmente amarelo ou a cor da marca. É a palavra que carrega a promessa.

**Fundo escuro e único.** Sem textura, sem padrão, sem colagem de fundos diferentes.
Quando a foto tem fundo de estúdio, ou recorta a pessoa, ou usa o fundo dela na capa
inteira. Os dois ao mesmo tempo é o erro mais visível.

**Prova visual quando o assunto é ferramenta.** Print de tela real, dashboard com
número legível, logo da plataforma. Nunca interface inventada.

---

## Exemplos observados

| Capa | O que ela faz |
|---|---|
| "CLAUDE CODE PARA INICIANTES" | Texto à esquerda, pessoa à direita apontando, laptop com terminal real no meio |
| "ATRIBUIÇÃO INCREMENTAL MUDOU O JOGO DELE" | Print de dashboard com número, etiqueta amarela "VENDAS R$ 56.112", logo da Meta |
| "AUTOMATIZE SUAS VENDAS" | Logo do Manychat, prints de conversa, pessoa à esquerda |
| "ELE FATURA R$ 2 BILHÕES POR ANO" | Número grande no texto, tag com o nome do convidado embaixo |
| "A IA ESTÁ CADA VEZ MAIS PERFEITA" | Contraste alto na pessoa, texto em bloco ocupando metade |

---

## O que nunca aparece nas capas boas

Foto genérica de banco de imagem. Pessoa sorrindo com laptop. Gradiente roxo com azul.
Interface inventada por IA. Texto em caixa baixa. Mais de uma palavra destacada.
Emoji. Rosto retocado ao ponto de não parecer a pessoa. Fundo com duas origens
diferentes, que é o que acontece quando se cola uma foto de estúdio sobre um fundo novo
sem recortar.

---

## Erros cometidos e corrigidos neste projeto

Ficam registrados para não se repetirem.

**Capa entregue em 1280x720.** Virou regra do projeto: toda capa sai em 1920x1080.
Ver a memória `feedback_thumb-youtube-1920x1080`.

**Dois fundos ao mesmo tempo.** A primeira versão colou a foto de estúdio, com o fundo
original dela, por cima de um degradê novo. Ficava visível a emenda. A correção é
recortar a pessoa com GrabCut antes de compor.

**Elemento cobrindo texto.** O celular foi posicionado em cima do fim de duas palavras
do título. Sempre conferir a capa em miniatura, no tamanho em que ela aparece no
celular, antes de considerar pronta.

**Primeira palavra sem assunto.** "Modelos de Contrato Visual Automáticos" começa com
"Modelos", que não diz nada em 24 pixels. "Contratos Visuais Automáticos" resolve com
a mesma ideia.

**Texto e tags quebrando em duas linhas.** Etiqueta que não cabe numa linha precisa ser
encurtada, não quebrada. "MAIS DE 12 MIL COMBINAÇÕES" virou "12 MIL COMBINAÇÕES".
