---
name: reuniao
description: Busca no Gmail (ferreiraemacielfoto@gmail.com) as anotações automáticas de uma reunião do Google Meet, lê o documento completo no Drive, estuda e devolve um resumo curto. Em seguida pergunta o que o Felipe quer fazer com aquilo: (1) gerar conteúdo, virando ideias no Tracker FMN, (2) gerar um PDF confidencial de resumo, pauta e detalhes com a marca da FMN para quem participou, e enviar pelo Khronus quando ele pedir, (3) registrar aprendizados para a inteligência dele (profissional, pessoal e família). Use quando o pedido for "/reuniao", "anotações da reunião", "ata da reunião", "resume a reunião", "a reunião de ontem", "a reunião com o fulano", "notas do Gemini", ou "o que ficou combinado na reunião".
---

# Reunião

Transforma as anotações que o Gemini gera depois de cada reunião no Google Meet em uma de três entregas: conteúdo, PDF para o participante ou anotação de inteligência. A leitura e o estudo são sempre os mesmos. O que muda é o destino.

**Voz e formato:** tudo que sai daqui segue as regras globais do `CLAUDE.md`: pt-BR com acentuação, sem travessão, sem ponto de exclamação, tom do Felipe nos textos assinados por ele (`.claude/rules/tom-de-voz-felipe.md`).

## Passo 0. Anúncio

Nível 1 (skill chamada direto pelo Felipe):

`🔍 Próximo passo: localizar e estudar as anotações da reunião (4 passos). Tempo estimado: cerca de 60 segundos.`

Ao terminar o estudo, confirme em uma linha: `✅ Concluído: reunião estudada.` e siga para o Passo 3.

## Passo 1. Localizar a reunião

O pedido do Felipe pode vir de quatro jeitos: "a última", uma data ("a de ontem", "dia 18"), uma pessoa ou tema ("a do Lucas"), ou nada específico. Sem indicação, use a mais recente.

**1a. Gmail.** As anotações chegam de `gemini-notes@google.com`, no `ferreiraemacielfoto@gmail.com`. Busque com `search_threads`:

- Última: `from:gemini-notes@google.com`, `pageSize` 5
- Por data: acrescente `after:AAAA/MM/DD before:AAAA/MM/DD`
- Por tema: acrescente as palavras. O assunto traz só a data e o horário quando a reunião não tem título, então o tema quase nunca está no assunto. Nesse caso busque o texto também com `has:drive` ou pelo nome da pessoa no corpo.

O assunto tem este formato: `Anotações: reunião do dia 18 de set. de 2026 às 1:23 PM GMT-03:00`. Reunião com título traz `Anotações: "Nome" em 21 de ago. de 2026`.

**Se houver mais de uma candidata, liste (data, horário, trecho do resumo) e pergunte qual, numerando as opções. Nunca escolha por conta própria entre duas reuniões do mesmo dia.**

Leia o e-mail com `get_thread` e `messageFormat: PLAIN_TEXT`. Ele traz Resumo e Próximas etapas por responsável.

**1b. Drive, o documento completo.** O e-mail é só o resumo. O documento tem também Decisões e Detalhes com marcação de tempo, e a transcrição inteira. Busque com `search_files`:

`title contains 'Anotações do Gemini' and title contains 'AAAA/MM/DD HH:MM'`

O título do documento usa o mesmo horário de início do assunto do e-mail: `Reunião iniciada às 2026/09/18 13:23 GMT-03:00 - Anotações do Gemini`. Para reunião com título, procure por `fullText` ou por `modifiedTime` próximo do e-mail.

**A busca do Drive é aproximada.** Testada em 19/09/2026: pedir o horário 13:23 devolveu também a reunião das 15:48 do mesmo dia. Sempre confira o horário no **título de cada resultado** e abra só o que bate com o do e-mail. Nunca pegue o primeiro da lista.

Leia com `read_file_content`. O documento passa de 80 mil caracteres, então a ferramenta salva o resultado num arquivo e devolve o caminho. **Não leia a transcrição inteira na conversa.** Use o script:

```bash
python3 scripts/reuniao-extrair-notas.py CAMINHO_DO_ARQUIVO
```

Isso imprime só as notas (Resumo, Decisões, Próximas etapas, Detalhes), cerca de 19 mil caracteres. Quando precisar conferir um trecho, busque na transcrição sem carregá-la:

```bash
python3 scripts/reuniao-extrair-notas.py CAMINHO_DO_ARQUIVO --buscar "termo" --contexto 4
```

Só use `--transcricao` (a íntegra) se o Felipe pedir explicitamente.

Se o documento não for encontrado ou não abrir, siga só com o e-mail e diga isso ao Felipe em uma linha.

**1c. Agenda.** Reunião marcada tem título e participantes na Agenda, e reunião improvisada não tem. Se houver evento no mesmo horário (`list_events` com janela de 1 hora), aproveite o título e os convidados. Se não houver, siga sem ele. Não insista.

## Passo 2. Estudar

Leia tudo antes de resumir. Depois:

**Corrija o que o Gemini erra.** A transcrição automática troca nomes próprios e chama o Felipe pelo nome da conta ("Ferreira e Maciel Fotografia e Filme"). Corrija pelo contexto do projeto e liste as correções ao final, para o Felipe conferir:

- Nome da conta do Felipe vira **Felipe**
- Nome de produto ou ferramenta escrito diferente do que existe (ex: "Cronos" onde o produto é o **Khronus**; "AS" onde o contexto é o **Asaas**)
- Em dúvida, deixe como está e marque com `(?)`. Nunca troque no chute.

**Separe o que foi dito do que o Gemini concluiu.** O Resumo do Gemini é interpretação. Quando o Resumo disser algo que os Detalhes não sustentam, ou o contrário, aponte a divergência.

**Devolva um estudo curto**, em no máximo 15 linhas:

1. Tema e objetivo da reunião
2. Quem participou e qual o papel de cada um
3. O que foi decidido (só o que foi de fato acordado)
4. Próximos passos, por responsável
5. Três a cinco pontos que merecem atenção, cada um com o horário no documento
6. O que ficou em aberto ou pouco claro
7. Correções de nome que você fez

## Passo 3. Perguntar o que fazer

Depois do estudo, pergunte em uma única mensagem, opções numeradas (padrão do projeto):

```
O que você quer fazer com essa reunião?

1. Gerar conteúdo (ideias no Tracker)
2. PDF confidencial de resumo, pauta e detalhes (envio pelo Khronus se você pedir)
3. Registrar anotações de inteligência
4. Mais de uma (diga quais, ex: 2 e 3)

Digite o número:
```

Cada opção tem um módulo. **Carregue só o módulo escolhido**, na hora:

| Opção | Módulo |
|---|---|
| 1 | `references/conteudo.md` |
| 2 | `references/pdf.md` |
| 3 | `references/inteligencia.md` |

Se o Felipe escolher mais de uma, faça na ordem 3, 2, 1. A anotação de inteligência primeiro garante que o aprendizado fica guardado mesmo que o resto não avance.

## Regras que valem para as três opções

- **Terceiros.** Reunião tem gente de fora. Nome, telefone, e-mail, valor combinado com terceiro e opinião sobre pessoa não saem da conversa nem entram em conteúdo público. Cada módulo diz o que fazer com isso.
- **Nada sai sozinho.** Esta skill não envia e-mail. Só manda mensagem pelo Khronus quando o Felipe pede o envio, depois de ver a simulação e confirmar. Nunca publica e nunca lança card sem o Felipe aprovar o conteúdo na conversa. Aprovação segue o padrão do projeto: mostrar, perguntar `1. Aprovar e salvar` ou `2. Quero ajustar algo`.
- **Concorrentes.** Nunca nomear concorrente em nada que sai daqui, mesmo que tenha sido citado na reunião.
- **PDF vai sempre para o Drive.** Toda cópia de PDF de reunião é salva na pasta "Reuniões" do Drive, com o título `AAAA-MM-DD Reunião Nome - Assunto`. O passo a passo está em `references/pdf.md`, seção 7.
- **Caminho no chat.** Todo arquivo salvo tem o caminho absoluto exibido em texto no chat.
- **Segredos.** Nunca escrever token ou chave em arquivo. Os scripts leem o `.env` sozinhos.
