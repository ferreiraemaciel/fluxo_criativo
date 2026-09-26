# Opção 2. PDF de resumo e pauta para quem participou

O PDF é o documento que o participante recebe depois da reunião. Ele não é a nota interna do Felipe. Tem a marca da FMN, abre com um aviso de confidencialidade e só traz o que quem estava lá precisa reler.

O layout é fixo e vive em `scripts/reuniao-pdf.py` (cores, Montserrat e logo da FMN vindos de `fmn-site/public/colors_and_type.css`). Não reescreva o HTML na mão. Você preenche um JSON e o script gera o PDF.

**O que o PDF sempre tem, nesta ordem:**

1. **Aviso de confidencialidade**, na faixa preta do topo da primeira página, e "Documento confidencial" no rodapé de todas as páginas
2. Capa com título, data, destinatário e participantes
3. **Resumo**, 2 a 3 parágrafos curtos
4. **Pauta**, lista compacta e numerada dos assuntos
5. **Detalhes da reunião**, o principal de cada assunto da pauta, com a mesma numeração
6. **O que ficou decidido**
7. **Próximos passos**, por responsável
8. Observações (opcional)

## 1. O aviso de confidencialidade

É automático, vem da constante `AVISO` do script e não depende do JSON. Texto vigente:

> Este documento é sigiloso e foi elaborado exclusivamente para o destinatário nele indicado. Fica proibida a reprodução, total ou parcial, o encaminhamento, a publicação e qualquer forma de divulgação a terceiros sem autorização prévia e expressa do autor. A quebra da confidencialidade sujeita o responsável às sanções civis e penais cabíveis, além da reparação por perdas e danos, nos termos, entre outros, da Lei nº 9.610/1998 (art. 29, I; art. 102), do Código Penal (art. 153), da Lei nº 9.279/1996 (art. 195, XI) e do Código Civil (art. 186; art. 927).

**Lastro dos artigos.** Conferidos em 19/09/2026 no texto consolidado da Câmara dos Deputados (`www2.camara.leg.br/legin`):

| Norma | Artigo | O que diz |
|---|---|---|
| Lei 9.610/1998 | art. 29, I | Depende de autorização prévia e expressa do autor a reprodução parcial ou integral da obra |
| Lei 9.610/1998 | art. 102 | O titular cuja obra seja fraudulentamente reproduzida ou divulgada pode requerer a apreensão dos exemplares ou a suspensão da divulgação, sem prejuízo da indenização |
| Código Penal | art. 153 | Divulgar, sem justa causa, conteúdo de documento particular ou correspondência confidencial, de que é destinatário ou detentor, e cuja divulgação possa produzir dano a outrem. Detenção de um a seis meses, ou multa. Somente se procede mediante representação (§ 1º) |
| Lei 9.279/1996 | art. 195, XI | Divulgar, explorar ou utilizar-se, sem autorização, de informações confidenciais a que teve acesso mediante relação contratual ou empregatícia. Detenção de 3 meses a 1 ano, ou multa |
| Código Civil | art. 186 e art. 927 | Ato ilícito e dever de reparar o dano |

**Cuidado de redação, que o Felipe deve saber.** O aviso diz "sujeita às sanções cabíveis", e não que cada artigo se aplica sempre. O art. 195, XI da Lei 9.279 pede acesso por relação contratual ou empregatícia, e o art. 153 do Código Penal pede ausência de justa causa e possibilidade de dano, com ação condicionada à representação. Por isso a lista vem com "entre outros" e a frase de abertura é "sanções cabíveis". Não reescreva o aviso para afirmar mais que isso. Para trocar o texto de uma reunião específica, use o campo `aviso` do JSON, e nesse caso mostre o novo texto ao Felipe antes de gerar.

O PDF **não cria** dever de sigilo contratual. Ele registra o caráter confidencial do documento e cita a base legal geral. Se a reunião exigir um dever de sigilo próprio, isso é um contrato, e não um PDF.

## 2. Descobrir quem é o destinatário

Pergunte, uma pergunta só: para quem vai o PDF. O nome entra no campo `destinatario` da capa e define o tom e o recorte. **Não precisa de e-mail.** O Felipe envia pelo WhatsApp, ou pede para você enviar pelo Khronus (seção 8).

## 3. Escolher o que entra

O leitor é uma pessoa de fora. Do estudo da reunião, entra:

| Seção | O que vai | O que fica de fora |
|---|---|---|
| **Resumo** | 2 a 3 parágrafos curtos: o que a reunião foi e onde chegou | Impressão do Felipe sobre a pessoa |
| **Pauta** | Os assuntos, na ordem em que apareceram, só o título | Conversa lateral, piada, assunto pessoal |
| **Detalhes** | De 2 a 4 pontos por assunto, uma ou duas linhas cada. O principal, e não a ata | Diálogo, hesitação, repetição, trecho de tela |
| **O que ficou decidido** | Só o que foi de fato acordado, com o número quando houver | O que foi apenas cogitado |
| **Próximos passos** | Por responsável, com prazo se existir | Tarefa interna do Felipe que o participante não precisa ver |
| **Observações** | Opcional. Um ponto de atenção | Aconselhamento jurídico, opinião sobre terceiros |

**Régua dos detalhes.** O e-mail do Gemini tem 19 mil caracteres. O PDF tem por volta de um terço disso. Cada ponto responde "o que o leitor precisa saber ou fazer", e não "o que foi dito".

**Tire de fora, sempre:** comentário sobre pessoas ou empresas que não estavam na reunião, menção a concorrente, referência a mentoria ou a terceiros do mercado, estratégia interna de preço e margem, oferta de suporte particular (como canal de telefone para dúvida jurídica) e qualquer coisa dita em confiança. Na dúvida, deixe fora e avise o Felipe do que foi cortado, em uma linha por corte.

**Aprendido na reunião de 25/09/2026 (onboarding de aluna nova):**

- **Familiar ou criança que apareceu na chamada** (a filha da aluna ajudando com o computador, por exemplo) não entra no PDF, nem como participante nem como responsável. O Gemini pode listá-la como responsável de tarefa junto com a aluna. Nesse caso o PDF fica só com a aluna, e o corte é avisado ao Felipe.
- **Promessa comercial dita de improviso** (prazo de reembolso, desconto, condição de preço) não vai para o PDF sem o Felipe decidir. Um documento por escrito vira compromisso.
- **Preço de módulo que ainda não existe** fica de fora. Se a reunião mostrou recursos em beta, o PDF os apresenta como prévia, avisa que ainda não estão disponíveis para uso geral e não promete data nem valor.
- **Nome do participante vem do Gemini com falhas** (nome duplicado, só o nome da conta). Use a forma mais completa e limpa que apareceu na transcrição e avise o Felipe para conferir.

**Números conferem com a transcrição.** O resumo do Gemini mistura valores. Antes de pôr preço, percentual ou prazo no PDF, confirme na transcrição com `scripts/reuniao-extrair-notas.py ARQUIVO --buscar "397"` e, se houver divergência entre o Resumo e os Detalhes do Gemini, diga ao Felipe qual número você usou e por quê.

**Correções de nome** do Passo 2 da skill já entram aplicadas. O PDF do participante não pode ter "Cronos" onde o produto é Khronus, nem o nome da conta do Gemini no lugar de Felipe.

Título do PDF: uma frase curta sobre o assunto, sem data. Responsável nos próximos passos: primeiro nome.

## 4. Escrever no tom certo

O texto é assinado pelo Felipe, mas é um documento, não uma legenda. Registro claro e cordial, frases inteiras, sem gíria pesada. Aplique `.claude/rules/tom-de-voz-felipe.md`:

- Sem travessão, sem ponto de exclamação, sem vírgula entre sujeito e verbo
- **Nada de `, e ` ligando duas orações.** Corte a vírgula ou quebre em duas frases
- Números concretos no lugar de adjetivo

Rode a varredura sobre o JSON antes de mostrar:

```bash
grep -n ", e \|—\|!" conteudo.json
```

Corrija tudo que aparecer e rode de novo até vir vazio.

## 5. Aprovar antes de gerar

Mostre o conteúdo em texto, seção por seção, e pergunte:

```
1. Aprovar e gerar o PDF
2. Quero ajustar algo
```

Liste também o que você deixou de fora e por quê, e qualquer número que precise de conferência dele.

## 6. Gerar

Salve o JSON e o PDF fora do repositório, numa pasta por reunião:

`~/Documents/reunioes/AAAA-MM-DD-tema-curto/` (slug em ASCII, sem acento)

```bash
python3 scripts/reuniao-pdf.py ~/Documents/reunioes/AAAA-MM-DD-tema/conteudo.json ~/Documents/reunioes/AAAA-MM-DD-tema/resumo-pauta.pdf
```

Formato do JSON (campos opcionais podem faltar):

```json
{
  "titulo": "Apresentação do Khronus e parceria de afiliados",
  "data": "18 de setembro de 2026",
  "horario": "13h23",
  "destinatario": "Lucas Lermen",
  "participantes": ["Lucas Lermen", "Felipe Ferreira"],
  "resumo": ["parágrafo 1", "parágrafo 2"],
  "pauta": [
    {"titulo": "Instalação e licença", "pontos": ["ponto 1", "ponto 2"]}
  ],
  "decisoes": [{"titulo": "Comissão de 20%", "descricao": "..."}],
  "proximos_passos": [{"responsavel": "Lucas", "tarefa": "Instalar o app", "prazo": "opcional"}],
  "observacoes": "texto opcional"
}
```

Cada item da `pauta` aparece duas vezes: só o título na lista da Pauta e, com a mesma numeração, os `pontos` (ou uma `descricao` curta) em Detalhes da reunião.

Depois de gerar, **olhe o PDF inteiro** (Read com `pages`, de 2 em 2). Confira o aviso no topo da página 1, a capa, a quebra de página e se algum texto foi cortado. Se algo estiver errado, ajuste o JSON e gere de novo. Não entregue sem ter visto.

Mostre ao Felipe o caminho absoluto do PDF, em texto.

## 7. Salvar no Drive, sempre

**Todo PDF de reunião gera uma cópia na pasta "Reuniões" do Drive do Felipe. Sem perguntar.** Decisão dele em 19/09/2026.

- **Pasta:** `Meu Drive/Fotografia é o Meu Negócio/Administrativo/Reuniões` (ID `1Y-YqsdTejpiHM5DgK2zKVyr13G1Wl8I7`, link `https://drive.google.com/drive/folders/1Y-YqsdTejpiHM5DgK2zKVyr13G1Wl8I7`)
- **Título do arquivo**, fácil de ler e de ordenar: `AAAA-MM-DD Reunião {Nome da pessoa} - {Assunto em até 6 palavras}.pdf`
  - Exemplos: `2026-09-18 Reunião Lucas Lermen - Khronus e parceria de afiliados.pdf` e `2026-09-18 Reunião Ana Âmago Fotografia - Apresentação do Khronus.pdf`
  - A data é a da reunião, e não a de hoje. Sem travessão, só hífen com espaços.
  - Reunião com mais de uma pessoa: o nome de quem recebe o PDF, ou o nome do grupo.
- **Como copiar:** o Drive está sincronizado no Mac, então é uma cópia de arquivo. O envio pela ferramenta do Drive exigiria embutir o PDF no comando, grande demais.

```bash
cp ~/Documents/reunioes/AAAA-MM-DD-tema/resumo-pauta.pdf \
  "$HOME/Library/CloudStorage/GoogleDrive-ferreiraemacielfoto@gmail.com/Meu Drive/Fotografia é o Meu Negócio/Administrativo/Reuniões/AAAA-MM-DD Reunião Nome - Assunto.pdf"
```

- **Conferir na nuvem:** espere uns 20 segundos e confirme com `search_files` usando `parentId = '1Y-YqsdTejpiHM5DgK2zKVyr13G1Wl8I7'`, checando o título e o tamanho. Só diga que está salvo depois disso.
- **Se a pasta local não existir** (Drive fora do ar ou sem sincronizar), diga ao Felipe, deixe o PDF em `~/Documents/reunioes/` e não tente contornar.
- **Nunca sobrescreva** um arquivo de mesmo nome sem avisar. Se já existir, pergunte.

**Aviso de acesso.** Em 19/09/2026 a pasta estava com "qualquer pessoa com o link pode ver". Como o PDF é confidencial, confira uma vez por conversa com `get_file_permissions`. Se ainda estiver assim, avise o Felipe em uma frase e sugira restringir às pessoas que precisam. Não altere o compartilhamento por conta própria.

## 8. Envio

**A skill não envia e-mail.** O Felipe manda o PDF pelo WhatsApp, por conta própria, ou pede para você mandar pelo Khronus. Só faça o envio pelo Khronus **quando ele pedir**, na conversa, naquele momento. Ter gerado o PDF não é pedido de envio.

O envio usa `scripts/khronus-enviar-arquivo.py`. Ele sobe o arquivo para o armazenamento do Khronus e coloca na fila de envio, e a ponte do programa Khronus aberto no computador manda pelo WhatsApp do estúdio.

**Fluxo, sempre nesta ordem:**

1. **Simular primeiro.** Rode sem `--confirmar`. O script mostra contato, estúdio, arquivo, legenda e estado da ponte, e não grava nada.

```bash
python3 scripts/khronus-enviar-arquivo.py --telefone FINAL_DO_NUMERO --estudio fmn \
  --arquivo ~/Documents/reunioes/AAAA-MM-DD-tema/resumo-pauta.pdf \
  --nome "Resumo e pauta da reunião.pdf" \
  --legenda "texto curto"
```

2. **Estúdio ambíguo.** O mesmo contato costuma existir nos dois estúdios (Ferreira & Maciel e Fotografia é o Meu Negócio), cada um com o seu número de WhatsApp. O script para e lista as opções. **Pergunte ao Felipe por qual número sai.** Nunca escolha sozinho: a mensagem chega ao cliente vinda de um número ou de outro. Para achar o contato exato use `--telefone` com o final do número, ou `--contato-id` depois da listagem.

3. **Legenda.** Escreva 1 ou 2 frases no tom do Felipe, em primeira pessoa, humano, sem "equipe" e sem fórmula de empresa. Aplique a varredura de `, e `, travessão e exclamação. É mensagem de WhatsApp, então solta mas com maiúscula no começo de cada frase.

4. **Confirmação explícita.** Mostre ao Felipe a saída da simulação e a legenda, e pergunte:

```
1. Enviar agora
2. Ajustar algo
```

5. **Enviar.** Só com a resposta "1", "sim", "manda" ou equivalente, rode o mesmo comando com `--confirmar`. O script espera até 50 segundos a ponte confirmar e informa `enviado`, `falhou` ou `ainda na fila`.

**Freios que o script já tem:**

- Sem `--confirmar` ele só simula.
- Se a ponte do estúdio estiver fora do ar (sem sinal há mais de 90 segundos, ou WhatsApp desconectado), ele recusa. Assim a mensagem não fica parada na fila e sai horas depois, sem ninguém ver. Se recusar, avise o Felipe para abrir o programa Khronus e conferir a conexão.
- O telefone aparece só com os quatro últimos dígitos.
- Se gravar na fila falhar depois de subir o arquivo, ele apaga o arquivo do armazenamento.

**Limite:** o arquivo precisa ter até 50 MB. Um PDF de resumo tem menos de 1 MB.

Confirme ao final: `✅ Concluído: PDF gerado e enviado a {nome} pelo WhatsApp de {estúdio}. Caminho: ...`. Se a ponte não confirmou, diga exatamente isso, sem afirmar que foi entregue.
