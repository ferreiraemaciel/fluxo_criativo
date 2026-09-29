# Checklist de Conteúdo. Peça Jurídica Visual

> Aplicar a cada peça gerada, antes de mostrar ao usuário. Complementa (não substitui) as regras globais do projeto: acentuação pt_BR obrigatória, e a varredura de tom de voz em `.claude/rules/tom-de-voz-felipe.md` (nada de `, e` ligando orações, travessão, exclamação, vírgula entre sujeito e verbo).

## 1. Sem juridiquês, mas sem ambiguidade

O objetivo é traduzir cláusula em card legível, não simplificar a ponto de abrir margem para duas leituras. Regra prática:

- Pode simplificar a **linguagem** (trocar "outorgante" por explicação, "cláusula ad judicia" pode ficar no texto mas com o efeito prático explicado do lado).
- Não pode simplificar a **precisão**. Se o texto original distinguia dois conceitos (ex: "atividade de meio" ≠ "cobrar honorários só em caso de êxito"), o card final tem que manter essa distinção clara, mesmo que em duas frases separadas.
- Sempre que dois pontos do documento pudessem, lidos juntos, parecer contraditórios (ex: "não garantimos resultado" ao lado de "só cobramos se der certo"), adicione a frase de amarração explícita. Já aconteceu: o card "Sem garantia de resultado" precisou dizer explicitamente que o percentual de êxito é *forma de cobrar*, não *promessa de resultado*, senão os dois cards pareciam se contradizer.

## 2. Nunca inventar dado

CPF, RG, endereço completo, conta bancária, data de assinatura, percentual de honorários: se não foi informado, vira `<span class="pendente">[o que falta]</span>`. Nunca preencher com um exemplo, nunca assumir.

**Exceção.** Se o dado existir em um documento que o usuário já mandou (comprovante, contrato, nota fiscal, CNPJ, extrato bancário), é obrigação ler o documento e extrair o dado real, não perguntar de novo. Já aconteceu de achar a conta bancária de um cliente dentro do próprio comprovante de PIX que ele mandou como prova, sem precisar perguntar.

## 3. Números com fonte

Todo valor em R$ tem que ter origem rastreável: veio de um comprovante, de uma nota fiscal, de um e-mail do financeiro, de uma transcrição de reunião gravada, ou foi calculado por você (nesse caso, mostrar a fórmula, ver `.metodologia` no design system). Nunca um número solto sem dizer de onde veio.

Se o pedido do cliente for para mudar a base de cálculo (ex: "cobra o valor cheio, não só a metade que foi combinada informalmente"), **não sobrescreva** o número que já está documentado em prova (e-mail, extrato). Mostre a conta em duas linhas: valor documentado + diferença agora cobrada = novo total. Isso preserva a peça como prova (o valor "antigo" continua batendo com o anexo) e ainda assim atualiza o pedido.

## 4. Fatos em ordem cronológica real

Uma linha do tempo é uma peça de prova, não só design. Se um evento aconteceu depois de outro (ex: gasto não autorizado depois da reunião que deveria ter suspendido tudo), a ordem no documento é a ordem real, nunca reordenada por conveniência narrativa. Já corrigimos esse erro uma vez numa notificação e o cliente (advogado) percebeu na hora.

## 5. Qualificação completa das partes

Pessoa física: nome completo, nacionalidade, estado civil, profissão (quando relevante), RG, CPF, endereço.
Pessoa jurídica: razão social, CNPJ, endereço da sede, representada por [nome do sócio/administrador com qualificação completa dele também].

Nunca assinar um contrato ou procuração só com "Empresa X Ltda", sem a pessoa física que assina por ela qualificada.

## 6. Base legal, quando citar lei

Toda afirmação jurídica com peso ("isso vale mesmo sem assinatura", "cabe restituição em dobro", "o silêncio presume desinteresse") precisa de artigo de lei ou entendimento de tribunal citado ao lado, mesmo que resumido (`<span class="base-legal">(art. X, CC)</span>`). Nunca afirmar mais do que a fonte sustenta. Se não tiver certeza da citação exata (número do artigo, jurisprudência), **pesquisar antes de escrever**, não estimar de memória. Já aconteceu de verificar via busca a validade de procuração eletrônica sem ICP-Brasil antes de afirmar isso na peça (achamos precedente real do STJ, com data e relator, em vez de assumir).

## 7. Peça, procuração e contrato, o que cada uma cobre

Nem toda peça precisa dos três documentos. Perguntar (ou inferir do pedido) qual desses o caso precisa:

- **A peça principal**: pode ser uma notificação extrajudicial, pode ser ela mesma um contrato/distrato/acordo entre as partes do caso. É o documento que resolve (ou tenta resolver) o mérito.
- **Procuração**: só é necessária se o profissional vai representar o cliente perante terceiros (negociar, assinar, receber, entrar com ação). Documento unilateral, só o outorgante assina.
- **Contrato de honorários**: regula a relação entre o profissional e o cliente dele (quanto custa, como paga, o que está incluso). Documento bilateral, as duas partes assinam.

Se o caso for só uma consulta ou um documento avulso sem representação envolvida, procuração não se aplica. Não gerar documento que o caso não pede.

## 8. Antes de entregar

- [ ] Rodar a varredura mecânica do tom de voz (`, e` / travessão / `!` / vírgula sujeito-verbo) em todo texto novo, mesmo em trecho colado quase literal pelo usuário. Se o usuário colar um texto com o vício, corrigir mesmo sem ele apontar, é regra global do projeto.
- [ ] Conferir que todo valor pendente está marcado em vermelho, nenhum inventado.
- [ ] Conferir que todo valor em R$ soma certo (bater a calculadora, não só a vista grossa).
- [ ] Conferir a paginação do PDF (ver pipeline técnico), nenhum card cortado no meio.
- [ ] Perguntar onde salvar (ou usar o local já combinado com o cliente para aquele caso) e entregar o caminho absoluto no chat.
