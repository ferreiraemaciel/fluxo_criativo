---
name: peca-juridica
description: Gera peças jurídicas em formato visual (não texto corrido), com o mesmo design system de fotografia+advocacia validado no caso Unity Digital/Robison Kunz. Cobre três tipos de documento, a peça principal (notificação extrajudicial, contrato, distrato, acordo, o que o caso pedir), procuração e contrato de honorários, podendo gerar um, dois ou os três juntos para o mesmo caso. Produz HTML e PDF prontos para revisão e, depois, assinatura.
allowed-tools: Read, Write, Edit, Bash, Agent
---

# Peça Jurídica Visual

Monta documentos jurídicos (notificação, contrato, distrato, acordo, procuração, contrato de honorários) no formato visual que o Felipe usa: cards com ícone em vez de parágrafo corrido, cabeçalho com foto real, caixas de destaque para valor e prazo, tudo pronto pra exportar em PDF limpo. **Não é o modelo tradicional em Word/ABNT**, é a peça pensada pra ser lida rápido, sem perder rigor jurídico.

## Referências obrigatórias

Antes de escrever qualquer HTML, carregar:
- `.Codex/skills/peca-juridica/references/design-system.md`. CSS completo, componentes, prompt de capa, regras de layout.
- `.Codex/skills/peca-juridica/references/checklist-juridico.md`. O que validar em todo texto antes de entregar.

Sem ler os dois primeiro, não escrever a peça. O design system existe justamente para não reinventar CSS a cada caso.

## Quando usar

Peça, contrato, procuração, distrato, acordo, notificação extrajudicial, ou qualquer instrumento jurídico que o Felipe peça em formato visual. Se o pedido for por um modelo tradicional (Word, ABNT, texto corrido para juntar em processo físico), essa não é a skill certa, ver nota no fim.

## Passo 0. Qual peça, ou quais peças

Se o pedido já deixar claro (ex: "monta uma procuração pra esse caso"), pule a pergunta e vá direto ao Passo 1 daquele tipo.

Se não estiver claro, perguntar, uma vez, com opções numeradas:

```
Qual peça vamos montar?

1. A peça principal do caso (notificação, contrato, distrato, acordo, o que o caso pedir)
2. Procuração
3. Contrato de honorários
4. As três, para o mesmo caso

Digite o número:
```

**Regra prática de quando cada uma se aplica** (ver checklist, item 7): procuração só entra se o profissional vai representar o cliente perante terceiros. Contrato de honorários só entra se é a primeira vez regulando essa relação (não repetir se já existe um contrato de honorários ativo pro mesmo caso). A peça principal quase sempre entra.

## Passo 1. Coletar o caso

Perguntas mínimas (adaptar conforme o que já veio na mensagem do usuário, não repetir o que já foi dito):

1. Quem são as partes (nome/razão social, CNPJ ou CPF, endereço). Se o usuário já mandou contratos, comprovantes, notas fiscais, CNPJ do outro lado, **ler os documentos primeiro**, a qualificação completa geralmente já está neles.
2. Qual é o objeto (o que aconteceu, resumido em 2-3 frases).
3. Se há valor envolvido: qual, com que lastro (comprovante, nota fiscal, e-mail, cálculo próprio).
4. Se há uma linha do tempo relevante (fatos em ordem, com data).
5. Se o profissional vai receber valores em nome do cliente (isso muda a procuração e o "dados para pagamento" da peça principal).

Se o usuário já mandou tudo isso numa mensagem anterior da mesma conversa (caso em andamento), não perguntar de novo, seguir com o que já está no contexto.

## Passo 2. Montar a estrutura de cada tipo

Usar sempre o CSS e os componentes de `design-system.md`. A estrutura HTML varia por tipo:

### A. Peça principal

1. `header.hero` com kicker (tipo da peça em caixa alta), título, subtítulo.
2. `.partes` (quem está de um lado, quem está do outro).
3. `h2.secao` "Como chegamos até aqui" + `.linha-tempo`, se houver fatos cronológicos a narrar. Pular se a peça não depende de uma sequência de eventos (ex: um contrato novo, sem histórico de conflito).
4. Uma `.caixa` explicando por que o instrumento vale juridicamente (ex: "vale mesmo sem assinatura formal", "confirmado pela gravação"), se for relevante ao caso.
5. `h2.secao` "O que sustenta esse pedido" + `.grid-2` de mini-cards com base legal, se a peça for uma cobrança/notificação. Toda citação de lei checada antes de escrever (ver checklist item 6).
6. `h2.secao` "As provas reunidas" + `.grid-2` de mini-cards + nota de quais documentos vão anexos e quais ficam reservados (ver critério abaixo).
7. `h2.secao` "O pedido" + `.pedido`, se houver cobrança de valor. Sempre com `.metodologia` explicando a conta.
8. `.bloco-clausula` para prazo/silêncio e para canal exclusivo de comunicação, se houver procurador envolvido.
9. `h2.secao` "Proposta de acordo" + `.proposta`, se fizer sentido oferecer composição antes de virar processo.
10. `footer.assinatura` com quem assina (normalmente só o profissional, em nome do cliente, ou ninguém, se for só uma notificação enviada sem assinatura física).

**Critério do que anexar como prova x o que reservar.** Documento que expõe uma fragilidade da própria posição (ex: contrato sem assinatura, gravação inteira que pode ser usada contra o timing da narrativa) fica reservado, citado como existente mas não anexado, guardado pra fase judicial. Comprovante, nota fiscal, print de conversa, o que só reforça sem expor fraqueza, anexa. Perguntar ao Felipe quando não for óbvio, mas ter uma recomendação pronta (ver `checklist-juridico.md`).

### B. Procuração

1. `header.hero`.
2. `.partes`: Outorgante / Outorgado.
3. `h2.secao` "O que o advogado pode fazer" + `.grid-3` de `.poder-card` com os poderes gerais (representar, assinar/transigir, receber valores se aplicável, entrar com ação, retirar documentos, substabelecer). Ver texto padrão da cláusula ad judicia em `design-system.md`.
4. `h2.secao` "Para este caso, especificamente" + `.caixa` com os poderes específicos, descrevendo o caso real.
5. `footer.assinatura` com **um** `.assinatura-linha` (só o outorgante assina).

### C. Contrato de honorários

1. `header.hero`.
2. `.partes`: Contratante / Contratado.
3. `h2.secao` "O que está incluído" + `.caixa` com o objeto.
4. `h2.secao` "Quanto custa": `.honorarios` com dois caminhos se for contrato de risco (êxito), ou `.pedido`/`.caixa` simples se for valor fixo. Se houver fluxo de repasse (o dinheiro cai na conta de um e precisa repassar pro outro), incluir `.contas-grid` com as duas contas.
5. `h2.secao` "Como funciona na prática" + `.grid-2`: sem garantia de resultado, atendimento fora do expediente, despesas, custas se virar processo, sucessão (morte/incapacidade), encerramento do contrato.
6. `h2.secao` "Regras de conduta" + `.grid-2`: informação verdadeira, boa-fé, ciência sobre o caso, atuação independente, rescisão por má-fé, foro.
7. `footer.assinatura` com **dois** `.assinatura-linha` dentro de `.assinaturas` (Contratante e Contratado).

## Passo 3. Capa fotográfica

Se for a primeira peça do caso, gerar a capa (ver prompt validado em `design-system.md`) via skill `gerar-imagem`. Se já existe uma capa gerada para esse mesmo caso (peça anterior do mesmo cliente), **reaproveitar o arquivo**, não gerar de novo, ver o arquivo salvo no scratchpad ou pasta de entrega do caso.

Depois de gerado o PNG, comprimir para JPEG antes de embutir:

```bash
sips -Z 1400 -s format jpeg -s formatOptions 78 capa.png --out capa.jpg
```

Injetar no HTML com o script (nunca colar base64 manualmente no Edit/Write):

```bash
python3 .Codex/skills/peca-juridica/scripts/injetar-imagem.py --html documento.html --placeholder CAPA_IMG_SRC --imagem capa.jpg
```

## Passo 4. Conferir visualmente

Antes de exportar PDF:

1. Copiar o HTML para dentro do diretório do projeto (fora dele o preview só renderiza estático).
2. Abrir no Browser pane, `resize_window` para **largura ≥1000px** (os grids colapsam para 1 coluna abaixo de 640px, isso é o esperado no mobile, mas para conferir o layout de verdade precisa de largura desktop).
3. Rolar a peça inteira, checando cada seção. Se um card parecer cortado ou aparecer um vão em branco, role de novo devagar antes de tratar como bug, screenshot durante rolagem rápida às vezes captura um frame intermediário.
4. Rodar o checklist de `checklist-juridico.md` item 8.

## Passo 5. Exportar PDF

```bash
scripts/exportar-pdf.sh caminho/documento.html caminho/documento.pdf
```

(ou o caminho completo `.Codex/skills/peca-juridica/scripts/exportar-pdf.sh`, dependendo de onde a sessão está rodando)

Depois de gerar, **sempre conferir a paginação**: converter para imagem e olhar página a página antes de entregar.

```bash
pdftoppm -jpeg -r 90 documento.pdf pagina
```

Ler as imagens geradas (`pagina-1.jpg`, `pagina-2.jpg`, ...) e confirmar que nenhum card corta no meio de uma página. Se cortar, o CSS de impressão (seção "Página impressa" do design system) provavelmente não foi incluído ou algum componente novo não tem `page-break-inside:avoid`.

Apagar as imagens temporárias depois de conferir (`rm pagina-*.jpg`).

## Passo 6. Entregar

Perguntar onde salvar (ou usar o caminho já combinado para aquele caso, ex: uma pasta no Google Drive do cliente). Salvar HTML e PDF, sempre **substituindo o arquivo antigo** quando for uma atualização (mesmo nome), nunca criando v2/v3, a menos que o Felipe peça explicitamente uma versão nova separada.

Entregar via `SendUserFile`, com o caminho absoluto no chat.

## Sobre atualizações pontuais

Depois da primeira geração, é normal vir uma sequência de pedidos pequenos (mudar um valor, tirar uma frase, trocar um percentual, incluir um dado). Para cada um:

1. Editar só o trecho pedido (edição cirúrgica, não redesenhar a peça inteira).
2. Se o pedido mexe em valor financeiro, verificar se esse valor aparece em mais de um lugar do documento (breakdown, proposta de acordo, linha do tempo) e atualizar todas as ocorrências, mantendo a consistência interna.
3. Reconferir visualmente e reexportar o PDF, substituindo o antigo.

## O que NÃO fazer

- Não usar `Read` no HTML final depois que ele já tem imagem em base64 embutida, o arquivo fica grande demais para o contexto. Use `grep -n` / `awk` via Bash para localizar trechos antes de editar (ver exemplos de uso no histórico do caso Unity Digital, sempre `awk 'NR>=X && NR<=Y {print}'` para espiar sem carregar o arquivo inteiro).
- Não colar código HTML no chat para o usuário ler, entregar sempre como arquivo.
- Não inventar dado, valor, citação de lei ou data (ver checklist item 2, 3 e 6).
- Não usar o modelo Word/ABNT tradicional aqui, essa skill é só para o formato visual. Se o Felipe quiser o modelo tradicional (texto corrido, Times New Roman, para juntar num processo em PJe), isso é outro fluxo, perguntar antes de presumir.

## Próximo passo (ainda não implementado por esta skill)

Depois da peça pronta e validada, o Felipe assina digitalmente reaproveitando o motor de assinatura+auditoria do Contrato Visual/Blindagem (hash SHA-256 do JSON canônico dos dados + IP + user agent capturados no servidor, nunca no client, tabela `contract_audit` append-only). Isso ainda **não está construído** para este caso de uso, hoje o motor assume sempre "cliente 1/cliente 2" do mesmo lado (cliente do fotógrafo), e o dono da conta nunca assina. Adaptar isso pra dois signatários nomeados (advogado + cliente dele), restrito à conta `contato@ferreiraemaciel.com.br`, é tarefa de desenvolvimento separada, a ser tratada só quando o Felipe pedir explicitamente para avançar nessa parte (não iniciar sozinho, é mudança em código de produto em produção).
