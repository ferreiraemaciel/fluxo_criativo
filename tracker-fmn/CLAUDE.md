# Tracker FMN — Regras do Projeto

> Instruções específicas do Tracker FMN. Complementa o CLAUDE.md da raiz do fluxo-criativo (regras gerais do workshop), mas essas aqui valem só dentro desta pasta.

## Telefone: nunca adivinhar o nono dígito (bug real, 2026-08-27)

**A regra "o Khronus guarda telefone sem o nono dígito" era falsa como generalização**, e virou bug. Ela saiu de um comentário do Blindagem que tinha observado contatos com 12 dígitos, mas "o 9 que sobra" e "o 9 que faz parte do número" são indistinguíveis olhando só os dígitos.

**Caso real:** Elisabete Petry é `51 92000-4406`. Removendo o 9 virou `51 2000-4406`, um número que não existe. A mensagem foi enfileirada, a Ponte perguntou ao WhatsApp e voltou corretamente `esse número não tem WhatsApp`. (Só ficou visível porque a Ponte tinha ganhado o `queryExists` no dia anterior; antes daria erro genérico.)

**Regra certa, aplicada nas Edge Functions e no frontend:**
- **Gravar** o número como ele é (55 + DDD + 9 dígitos quando é celular). Quem decide o identificador final é o WhatsApp, via `queryExists` na Ponte.
- **Procurar** contato existente testando as DUAS variantes (`variantesTelefoneKhronus` nas functions), porque contato antigo pode ter sido salvo no formato sem o 9.
- **Comparar** entre Tracker e Khronus por uma chave que ignora esse dígito: `55 + DDD + últimos 8` (`chaveTel` no `funis.jsx`).

Varredura feita depois da correção: a Elisabete foi o único contato afetado.

## Mensagem de recuperação abre negociação no funil (2026-08-27)

> Combinado com Felipe em 2026-08-27.

Mandar a mensagem de recuperação (aba Funis) **abre automaticamente uma negociação** no Khronus pro contato, com o produto da venda que ficou para trás, direto na coluna **Comercial** (`COLUNA_COMERCIAL` em `enviar-recuperacao-khronus/index.ts`). O produto vem do `produto_nome` da venda/abandono, que é texto livre da Hotmart, então o de-para é por palavra-chave (`PRODUTOS`), com o valor de cada um.

**Idempotente:** se já existe negociação em aberto (`status='pendente'`) do mesmo produto pra essa pessoa, não cria outra. Mandar uma segunda mensagem não é uma segunda negociação.

**Nunca derruba o envio:** falha ao criar negociação é engolida e logada. O que o Felipe pediu ao clicar no botão foi mandar a mensagem; a negociação é registro de apoio.

**Produto novo precisa entrar em `PRODUTOS`**, senão a mensagem sai normalmente mas sem abrir negociação.

## Atribuição herdada do quiz quando a Hotmart não repassa o rastreio (2026-08-27)

> Combinado com Felipe em 2026-08-27, janela de 7 dias definida por ele.

**A Hotmart nem sempre devolve o nosso `sck`.** Em alguns caminhos dela (Agente de Vendas, e-mail de recuperação dela, página de produto) o rastreio é sobrescrito pelo dela, e a venda entra sem anúncio nenhum, como se tivesse vindo do nada. **Caso real que motivou:** Drica Rocha passou pelo quiz pelo ADS 356 às 14:57 e comprou 1h37 depois; a venda chegou com `sck=HOTMART_SALES_AGENT`, sem `meta_ad_id`, e aparecia no Financeiro como "Tráfego" sem contexto.

**Como o `hotmart-webhook` resolve agora:** quando a compra chega sem `meta_ad_id`, ele procura o quiz mais recente do mesmo e-mail feito **até 7 dias antes** da venda e herda dali o anúncio e os UTMs que estiverem faltando. Nunca sobrescreve UTM que veio de verdade na compra (`coalesce`), e o campo `atribuicao_fonte` registra a diferença: `'direta'` (veio no sck da própria compra) x `'quiz'` (deduzido). Na tela, essa venda ganha a etiqueta roxa "via quiz", pra nunca se passar por rastreio direto.

**Agente de Vendas da Hotmart:** `vendas.hotmart_sales_agent` marca que ele entrou no caminho, mas **o caminho original é mantido** (o anúncio herdado do quiz continua sendo a origem). São duas informações diferentes e as duas importam: quem trouxe (o anúncio) e quem ajudou a fechar (o agente). Etiqueta amarela "agente Hotmart" na tela.

**Backfill rodado uma vez:** 307 vendas aprovadas ganharam anúncio pelo cruzamento com o quiz (79 delas casaram com um ADS ainda cadastrado na tabela `ads`; o resto tem `meta_ad_id` de anúncio já removido, o que é normal). 6 vendas marcadas como auxílio do agente.

**Auxílio do WhatsApp (2026-08-27, mesma sessão).** Mesma lógica do agente da Hotmart, agora pro nosso lado: `vendas.whatsapp_auxilio` registra **quem falou com a pessoa no WhatsApp até 7 dias antes da compra**, sem nunca substituir a origem do anúncio. Valores: `'ia'` (só o Claudinho, mensagens com `origem` em `ia`/`ia_retomada`), `'humano'` (só atendimento humano, `origem='manual'`), `'ambos'`, `'automatico'` (só disparo automático sem atendimento: resultado do quiz, follow-up de checkout) e `NULL` (não houve mensagem). Na tela, etiqueta verde "Claudinho", "atendimento humano" ou "Claudinho + humano"; `automatico` não vira etiqueta pra não inflar o crédito do time, mas fica no banco.

As três marcações convivem na mesma venda de propósito: **quem trouxe** (anúncio, direto ou via quiz), **quem ajudou a fechar** (Claudinho ou humano) e **quem entrou no meio** (agente da Hotmart). Backfill rodado uma vez: 32 vendas com auxílio identificado no histórico (5 com Claudinho e humano juntos, 3 só humano, 1 só Claudinho, 23 automático).

**Efeito colateral pra ter em mente:** recuperar essas vendas melhora o CPA dos anúncios afetados, e as regras G1/G5 pausam por CPA. Anúncio que parecia caro pode passar a parecer saudável. É a verdade aparecendo, mas muda o gatilho das pausas automáticas.

## O corte de 1.000 linhas do Supabase (armadilha que mordeu 3 vezes no mesmo dia)

**O Supabase corta toda consulta em 1.000 linhas por padrão.** O `.limit()` do client só REDUZ esse teto, nunca aumenta: pedir `.limit(5000)` devolve 1.000 e nada avisa que faltou. Não é erro, não é warning, a tela simplesmente mostra menos dado do que existe e parece correta.

**Três lugares onde isso mordeu em 2026-08-26**, todos em `funis.jsx`:
1. **Badge "Já contatado (API oficial)"** não aparecia mesmo com mensagem enviada de verdade, porque `whatsapp_mensagens` já passou de 2.100 linhas e a mensagem procurada ficava fora das 1.000 primeiras.
2. **Aba Leads** mostrava "1.000 leads" quando o real eram **1.574** nos últimos 30 dias. O número parecia um total redondo, mas era o teto.
3. **Aba Análise** calculava todos os percentuais (perfil, tipo de negócio, uso de contrato) em cima de 1.000 leads em vez do total, então os percentuais estavam errados sem nenhum sinal disso.

**A correção padrão** é a função `buscarTudo(montarQuery)` no topo do `funis.jsx`: pagina de 1.000 em 1.000 com `.range()` até a página vir incompleta. Ela recebe uma FUNÇÃO que monta a query (não a query pronta), porque uma query do supabase-js não pode ser reexecutada com `.range()` diferente.

**Regra pra qualquer consulta nova:** se a tabela pode passar de 1.000 linhas no período consultado, ou pagina, ou filtra por chave específica (`.in()`, `.eq()`). Nunca confie em `.limit()` alto, e desconfie sempre de um total que dá exatamente 1.000.

## "Tem mídia" é mídia entregue, nunca pasta cadastrada (bug real, 2026-08-26)

ADS 341, 342, 346 e 348 voltavam sozinhos pra "Feito" a cada 15 minutos, mesmo depois de Felipe arrastar de volta pra "Fazendo", e apareciam com a etiqueta "sem preview".

**Causa:** o `kanban-sync` (e o `aplicar_regras.py`) tratavam `media_drive_url` como prova de que o criativo estava pronto (`hasMedia = files.length > 0 || !!ad.media_drive_url`). Mas essa URL é a da **pasta** do Drive, preenchida quando o card nasce, muito antes de existir vídeo nenhum lá dentro. Esses 4 tinham pasta cadastrada e zero arquivo importado, então a regra "card em Fazendo com mídia avança pra Feito" disparava em todo ciclo. A etiqueta "sem preview" era o sintoma certo apontando pro problema real: não havia mídia.

**Correção:** `hasMedia` passou a exigir mídia de verdade, `media_files` preenchido ou `thumb_url`/`media_url`. O `sync_drive.py` já estava certo (ele só move depois de importar o arquivo), e a regra global do CLAUDE.md da raiz sempre disse "ao receber a mídia", não "ao cadastrar a pasta".

**Lembrete pra qualquer regra futura de avanço automático de card:** o gatilho é o arquivo gravado no card, nunca o endereço de onde ele deveria estar.

## Comprador sai marcado com a tag do produto no Khronus (2026-08-26)

> Combinado com Felipe em 2026-08-26. Vale pra QUALQUER produto vendido, não só os que têm mensagem automática.

Toda venda aprovada que chega no `hotmart-webhook` marca o contato do Khronus com a tag do produto comprado (`marcarTagDoProduto`). **Quem compra mais de um produto acumula tags**, nunca troca uma pela outra: o recorde hoje é um contato com 5 tags. Idempotente, e uma tag que tenha sido removida à mão volta a valer se a pessoa comprar de novo (comprar outra vez é marcação nova de verdade).

**Tags** (estúdio "Fotografia é o Meu Negócio", `khronus.crm_whatsapp_tags`): Modelos de Contrato Visual, Blindagem e Mensagens que Vendem já existiam; Pack Pro Lightroom, Cenários Natalinos, Combo de Presets e Mentoria XP Sala Preta foram criadas nesse dia. O de-para vive em `TAG_POR_PRODUTO` no `hotmart-webhook/index.ts`, com o `produto_id` da Hotmart como chave. **Produto novo na Hotmart precisa entrar nesse mapa e ganhar tag**, senão a venda entra sem marcação nenhuma, silenciosamente. `7521047` (Mensagens que Vendem APP) aponta pra mesma tag de `5246538`: é o mesmo produto em outra oferta.

**Não cria contato só pra pendurar tag.** Se a pessoa ainda não existe no Khronus, a marcação simplesmente não acontece (quem cria contato é o fluxo de mensagem). A tag entra na venda seguinte, ou num backfill.

**Backfill rodado uma vez** (script em `scratchpad/backfill_tags.py`, não versionado por ser de uso único): cruzou 977 compradores com telefone utilizável contra os 457 contatos que existiam no Khronus e criou 208 marcações. Sobrou muita compra sem marcação porque a maioria dos compradores nunca chegou a virar contato no Khronus, o que é esperado.

**Venda manual (botão "Registrar Receita", aba Financeiro) marca tag também, mas com a escolha na mão.** Ela não passa pelo `hotmart-webhook` e nem tem `produto_id`, então não há como deduzir a tag: o modal ganhou dois campos opcionais, WhatsApp e um seletor de tag, e a marcação vai pela Edge Function `khronus-tags` (`acao: 'marcar'`; a mesma function lista as tags pro seletor com `acao: 'listar'`). O telefone informado também passou a ser gravado em `vendas.comprador_telefone`, que antes se perdia. Se o telefone ainda não for contato no Khronus, a receita é salva do mesmo jeito e aparece um aviso amarelo dizendo que só a tag não foi aplicada.

**Falhar em marcar tag nunca derruba o webhook.** A função engole o próprio erro de propósito: registrar a venda é o que importa ali, tag é enfeite útil.

## Cada ADS tem produto (MCV ou BLI), e as regras usam o ticket do produto certo (2026-08-26)

> Combinado com Felipe em 2026-08-26, quando os primeiros anúncios de Blindagem entraram na conta.

**Até aqui a conta só rodava MCV**, então ticket e CPA limite eram valores únicos em `regras_atp`, sem distinção de produto. Com Blindagem entrando, um anúncio dele seria julgado pelo ticket do MCV — pausaria cedo ou tarde demais, dependendo do caso.

**`ads.produto`** (migration `106_ads_produto.sql`): `'MCV'` ou `'BLI'`, `not null default 'MCV'`, com CHECK e índice. Os 351 ADS que já existiam foram todos marcados como MCV no próprio backfill da migration (eram o único produto da conta). ADS novo nasce MCV por padrão, e vira BLI trocando no seletor ao lado do "ADS N" dentro do card.

**Valores por produto**, em `regras_atp.parametros.por_produto` (editável direto na tabela, sem redeploy):

| Produto | Ticket (G1) | CPA limite (G5) |
|---|---|---|
| MCV | R$297 | R$207,90 |
| BLI | R$397 | R$277,90 |

O ticket do Blindagem é o plano anual/à vista (R$397), escolha do Felipe: as vendas dele variam de R$99,98 a R$397 por ser assinatura, então não dá pra deduzir do banco. CPA limite segue a mesma proporção do MCV (70% do ticket).

**Como o código resolve** (`verificarRegraG1` e `verificarRegraG5` em `meta-sync/index.ts`): a consulta ao `insights_cache` usa o **menor** limite entre os produtos (só pra não varrer a tabela inteira), e o limite exato é conferido depois, ad a ad, já sabendo o `ads.produto` daquele anúncio. Os valores soltos na raiz de `parametros` (`ticket`, `cpa_limite`) continuam existindo como fallback pra ADS sem produto reconhecido. A mensagem do alerta e o `dados_snapshot` agora carregam o produto, pra ficar claro qual limite foi aplicado.

**Na tela:** seletor MCV/BLI no cabeçalho do card (dourado pra MCV, azul pra BLI) e badge azul "BLI" no card da lista. Só o BLI ganha badge: a conta é quase toda MCV, destacar a exceção é o que ajuda a achar.


## Boas-vindas de aluno novo (MCV) — migrou da API oficial pro Khronus (2026-08-26)

> Combinado com Felipe em 2026-08-26, mesma linha da mudança na Recuperação de Venda (ver seção abaixo). `enviarBoasVindasMcv()`, em `hotmart-webhook/index.ts`, dispara sozinha em toda venda aprovada do MCV.

**Antes:** chamava a Graph API do Meta direto (`graph.facebook.com/.../messages`), com o template aprovado `boas_vindas_mcv`, sujeito a custo de template e à janela de 24h.

**Agora:** não fala mais com o Meta nem com `FB_ACCESS_TOKEN_PERMANENTE`/`WHATSAPP_PHONE_NUMBER_ID` (removidos do arquivo). Grava direto em `khronus.crm_whatsapp_contatos`/`crm_whatsapp_fila_envio` (schema do banco do Blindagem, estúdio "Ferreira & Maciel", `STUDIO_ID_KHRONUS` fixo no código, mesmo padrão de `enviar-recuperacao-khronus/index.ts`). Quem manda de verdade é a Ponte, WhatsApp Web no número de suporte — mesma dependência documentada abaixo pra Recuperação de Venda.

**O que continua igual:** o texto (mesmo `renderCorpoTemplate("boas_vindas_mcv", ...)`), a idempotência (`vendas.whatsapp_boas_vindas_enviado`, só vira `true` depois que o enfileiramento no Khronus funciona — se falhar, fica `false` e o endpoint de recuperação `/reenviar-boas-vindas` continua servindo pra reprocessar), e o registro do aluno em `whatsapp_contatos` local do Tracker (`upsertContato`, etapa forçada `aluno`).

**O que mudou de verdade:** não grava mais nada em `whatsapp_mensagens` (essa tabela é o histórico da API oficial — like a mensagem não sai mais por lá, registrar ali seria enganoso, ia parecer que saiu pelo número oficial). Não depende mais de janela de 24h nem gera custo de template Meta.

**Testado em produção no dia da mudança**, reenviando pra Adriana Tavares Ribeiro (`HP2884276891`) — venda que tinha ficado sem boas-vindas no incidente do `verify_jwt` de 24/08 (documentado abaixo) e continuava pendente. Confirmado na fila do Khronus (`status='pendente'`, corpo certo, telefone certo).


## Recuperação de Venda — telefone automático, badge de situação e envio pelo WhatsApp do suporte (2026-08-26)

> Combinado com Felipe em 2026-08-26, na sequência direta da ampliação documentada logo abaixo. Três pedidos: (1) telefone aparecendo de verdade na tela, (2) badge de situação sem quebrar linha, (3) clicar no ícone do WhatsApp manda mensagem específica pra cada situação, pelo número de suporte via Khronus.

**1. Telefone — o cruzamento com `quiz_leads` virou rotina automática, não precisa mais rodar SQL na mão.** A função `cruzarComQuiz()` dentro de `hotmart-backfill/index.ts` roda a cada ciclo do cron (15 em 15 minutos, 6h às 23h59 de Brasília) e faz duas coisas: preenche `abandono_carrinho.telefone` nulo cruzando por e-mail com `quiz_leads.whatsapp`, e promove `whatsapp_contatos.estagio_venda` pra `'fechamento'` quando o telefone bate (últimos 11 dígitos) com um lead que chegou no carrinho ou virou venda não aprovada. É o mesmo critério do backfill retroativo de 407 registros feito uma vez (ver seção abaixo), só que agora roda sozinho pra todo abandono novo, porque a causa raiz (Hotmart não manda telefone nenhum no payload de `PURCHASE_OUT_OF_SHOPPING_CART`, confirmado inspecionando a coluna `raw`) não é bug pra corrigir, é limitação permanente do payload.

**2. Badge de situação sem quebrar linha.** `funis.jsx`, coluna "Situação": `whiteSpace:'nowrap'` na `<td>` e no `<span>` do badge, `display:'inline-block'` no `<span>`, largura da coluna `140`→`170`.

**3. Enviar mensagem de recuperação pelo WhatsApp do suporte, via Khronus (não é a API oficial do Meta).** Ícone de mensagem novo em cada linha da tabela `CarrinhoTable` abre o modal `EnviarRecuperacaoModal`, com um texto pré-preenchido específico pra cada situação (dicionário `MSG_SITUACAO` em `funis.jsx`, um gerador por situação: abandonou, pendente, recusada, expirada, cancelada, atrasada, bloqueada, pre_aprovada, protesto, recuperacao — todos em Light Copy, sem travessão, sem exclamação, tom solto e desenrolado, terminando em pergunta). Editável antes de mandar.

**Como o envio funciona por baixo — importante entender que não é a API oficial:** o clique não fala com o Meta Cloud API (essa é a linha do Claudinho, número oficial). Ele chama a Edge Function `enviar-recuperacao-khronus` (Tracker FMN), que só grava na fila de envio do **Khronus** (`khronus.crm_whatsapp_fila_envio`, schema do banco do Blindagem/Contrato Visual, que hospeda os dois produtos), pro estúdio "Ferreira & Maciel" (`STUDIO_ID` fixo no código). Quem manda a mensagem de verdade é a extensão **Ponte** do Khronus (WhatsApp Web automatizado via wa-js, não API oficial), instalada no Chrome com o WhatsApp Web do número de suporte logado, puxando essa fila.

**Dependência pendente do lado do Felipe:** enquanto a Ponte não estiver conectada e logada no número de suporte, a mensagem fica represada em `status='pendente'` na fila do Khronus — não dá erro nenhum, só fica esperando a Ponte processar. Felipe estava nesse exato momento (26/08) migrando Khronus e Blindagem pra se falarem, com o plano de rodar o número de suporte pelo Khronus.

**Segredos novos no Tracker FMN pra falar com o banco do Khronus (cross-project):** `KHRONUS_SUPABASE_URL` e `KHRONUS_SERVICE_ROLE_KEY`, mesmos valores do `.env` do `contratovisual` (é o mesmo projeto físico Supabase, só schema diferente).

**4. Marcação de quem já foi contatado pela API oficial (evita mensagem duplicada por dois canais).** Combinado com Felipe logo depois: a mesma pessoa pode estar na fila de Recuperação de Venda e já ter recebido mensagem do comercial pela API oficial do Meta (Claudinho, ou humano via aba Conversas). Pra não mandar a mesma recuperação duas vezes por canais diferentes, `funis.jsx` cruza o telefone de cada lead com `whatsapp_mensagens` (`direcao='saida'`, últimos 11 dígitos, mesmo critério de `tel11` usado em `cruzarComQuiz()`). Quem já foi contatado ganha badge azul "Já contatado (API oficial)" ao lado do telefone, e o ícone de enviar muda de verde pra azul (aviso, não bloqueio — o botão continua funcionando, é só sinal visual pra eu decidir com calma antes de mandar de novo).

**Atualização no mesmo dia: a Ponte passou a saber começar conversa nova, então o Tracker voltou a enfileirar direto.** A trava de "só enfileira pra quem já tem `wa_chat_id`" existia porque a Ponte não sabia falar com número sem conversa anterior. Depois que ela ganhou a ação `resolver-numero` (pergunta o identificador ao WhatsApp via `WPP.contact.queryExists`, commit `a4ac9b9` do repositório `khronus`), isso deixou de ser impedimento: `enviar-recuperacao-khronus` e `enviarBoasVindasMcv` criam o contato com o telefone (sem `wa_chat_id`, de propósito) e enfileiram, e a Ponte resolve o identificador sozinha na primeira tentativa. O fallback de link `wa.me` manual e o badge "Sem conversa no suporte" foram removidos por terem virado ruído. Número que não tem WhatsApp agora falha na hora, com o motivo escrito na fila (`esse número não tem WhatsApp`), em vez de erro genérico.

**Bug real corrigido no mesmo dia: o badge não aparecia mesmo quando a mensagem tinha sido enviada de verdade.** Causa raiz: **o PostgREST corta o resultado em 1000 linhas por padrão**, mesmo pedindo `.limit(20000)` maior no client — é um limite do lado do servidor (`db-max-rows`), o `.limit()` do client só reduz, nunca aumenta esse teto. `whatsapp_mensagens` já tem 2146+ linhas, então buscar a tabela inteira (`select('telefone').eq('direcao','saida').limit(20000)`) sempre devolvia só as primeiras 1000, cortando mensagens recentes fora do recorte — foi exatamente o caso do Renato da Silva Avelino (mensagem `resultado_quiz_mcv` enviada e lida, mas fora das 1000 primeiras linhas). Confirmado o diagnóstico usando uma sessão autenticada real (magic link gerado via Admin API, só pra teste, sem mandar e-mail de verdade) pra reproduzir a consulta exatamente como o Tracker faz. **Corrigido buscando só os telefones que interessam pra aquela lista** (formato `55`+DDD+número, igual salvo na tabela), em lotes de 200 via `.in('telefone', [...])` — mesmo padrão já usado ali do lado pra achar quem "Comprou depois". Regra geral pra lembrar: qualquer `.limit()` acima de 1000 no Supabase é enganoso, sempre filtrar por chave específica (`.in()`, `.eq()`) em vez de puxar tabela inteira e comparar no client.

**Definição de "Abandonou o carrinho" (esclarecido com Felipe em 2026-08-26): só entra quem realmente chegou no checkout da Hotmart.** A situação `abandonou` vem exclusivamente da tabela `abandono_carrinho`, populada só pelo evento real `PURCHASE_OUT_OF_SHOPPING_CART` do `hotmart-webhook` — nunca por quem só preencheu o quiz (`quiz_leads`) e não avançou até o checkout. Isso já era assim antes dessa dúvida: o telefone preenchido via `cruzarComQuiz()` é só **enriquecimento** de uma linha que já existe de verdade em `abandono_carrinho` (a pessoa buscando o telefone que ela mesma digitou no quiz antes, pra completar o dado que a Hotmart não manda), nunca cria uma linha nova nem promove um lead de quiz pra "abandonou o carrinho". Quem só passou pelo quiz sem chegar no checkout fica na aba **Leads** (`quiz_leads`), separada, e não aparece em Recuperação de Venda.

**5. Filtro por situação.** Dropdown novo ao lado do filtro Todos/Não recuperados/Recuperados, com a contagem de cada situação entre parênteses (ex: "Cartão recusado (12)"), pra ver só uma situação por vez sem precisar rolar a lista inteira.

**6. CORS no envio manual — bug real, corrigido no mesmo dia.** O clique em "Mandar mensagem" no modal dava só "Failed to fetch", sem detalhe nenhum. Causa: `enviar-recuperacao-khronus` não respondia ao preflight `OPTIONS` nem mandava `Access-Control-Allow-Origin`, então o navegador bloqueava a chamada antes dela sair de verdade (nunca chegava a rodar o código da function). Corrigido com o mesmo bloco de CORS já usado em `whatsapp-enviar`. **Regra geral pra lembrar:** toda Edge Function chamada direto do navegador (não de outro backend/webhook) precisa desse bloco de CORS — só quem é chamado por outro serviço (Hotmart, Meta) dispensa.

**7. Badge "Já contatado pelo suporte" — cobre envio manual E boas-vindas automática.** Nova function `khronus-fila-status` recebe uma lista de telefones e devolve quais já têm alguma linha em `khronus.crm_whatsapp_fila_envio` (studio Ferreira & Maciel), não importa o status (`pendente`, `enviado` ou `falhou` — o critério é "já tentamos mandar", não "já chegou"). Como tanto o envio manual (`enviar-recuperacao-khronus`) quanto a boas-vindas de aluno novo (`enviarBoasVindasMcv`, ver seção acima) gravam na mesma fila, essa checagem cobre os dois de uma vez, sem precisar saber a origem. `funis.jsx` cruza isso com a lista de Recuperação de Venda e mostra badge dourado "Já contatado pelo suporte" (e muda a cor do ícone de envio), do lado do badge azul "Já contatado (API oficial)" que já existia.

**8. Diagnosticado em produção: erro real da Ponte, não do Tracker.** Testando o envio de verdade pra um lead, a mensagem foi enfileirada certinha mas voltou com `status='falhou'`, `erro='contato sem identificador de chat'`, depois de 3 tentativas — consultável direto em `khronus.crm_whatsapp_fila_envio` (`erro`, `tentativas`, `status`). Isso confirma que a Ponte **já está conectada e processando a fila de verdade** (não é mais "represado esperando conexão"), mas ela não conseguiu resolver um chat do WhatsApp Web pra aquele número especificamente — provável causa: número que nunca teve conversa iniciada, ou que não tem WhatsApp. Esse erro é do lado da extensão Ponte (`~/Documents/khronus/extensao-ponte`), fora do escopo do Tracker — investigar lá se voltar a acontecer.

## Recuperação de Venda (antes "Carrinho abandonado") — ampliado em 2026-08-26

> Combinado com Felipe em 2026-08-26. Três partes: (1) ampliar o escopo, (2) puxar dado retroativo real, (3) achar lead mais quente do que o rótulo dizia.

**A tela (aba Funis → "Recuperação de Venda", `funis.jsx`) deixou de mostrar só carrinho abandonado.** Agora junta duas fontes: `abandono_carrinho` (nunca virou transação na Hotmart) e `vendas` com status não-aprovado que também não é pós-venda (`pendente`, `cancelada`, `recusada`, `expirada`, `atrasada`, `bloqueada`, `pre_aprovada`, `protesto`, `recuperacao` — **excluindo** `reembolsada`/`chargeback`, que já foi venda fechada, é problema diferente). Cada linha mostra a situação real (badge colorido), não um "abandonou" genérico.

**Achado real que motivou tudo isso: `vendas.status` só aceitava 7 valores**, e qualquer venda que a Hotmart reportasse com outro status (recusada, expirada, atrasada, bloqueada, pre_aprovada) violava a constraint. Pior: o `hotmart-backfill` mandava o lote inteiro numa única instrução de upsert — uma linha com status inválido derrubava o lote inteiro, descartando também as vendas boas que vieram junto, silenciosamente. Migration `vendas_status_ampliar_recuperacao` ampliou a constraint; `hotmart-backfill` agora insere linha por linha (uma falha não arrasta as outras); `sync_hotmart.py` ganhou `--status` (sem isso a Hotmart só devolve `APPROVED` — confirmado testando 561 dias sem filtro).

**Backfill retroativo rodado uma vez** (`python3 scripts/sync_hotmart.py --days 561 --status CANCELLED` e `--status EXPIRED`, cobrindo 11/02/2025 até hoje): 168 canceladas + 62 expiradas recuperadas do histórico. Os únicos `transaction_status` da Hotmart que retornaram dado real pra essa conta foram `CANCELLED` e `EXPIRED` — `REFUSED`/`UNDER_ANALYSIS`/`DISPUTE` dão 400 (nome errado ou não aplicável), `WAITING_PAYMENT`/`PRINTED_BILLET`/`OVERDUE`/`BLOCKED`/`PRE_ORDER`/`NO_FUNDS`/`STARTED`/`PROCESSING_TRANSACTION`/`PARTIALLY_REFUNDED` deram zero resultado nesta conta. Se quiser rodar de novo no futuro (novo período, ou se algum desses outros status passar a ter dado), o comando é `python3 scripts/sync_hotmart.py --days N --status NOME_DO_STATUS`.

**Telefone faltando no carrinho abandonado — causa raiz e correção.** ~96% dos registros desde a semana de 27/07/2026 chegavam sem telefone (antes disso era raro faltar) — coincide com a correção do reconhecimento do evento `PURCHASE_OUT_OF_SHOPPING_CART`, que fez o volume real de abandono passar a entrar sem que a extração de telefone tivesse sido validada contra o payload real. `abandono_carrinho` ganhou a coluna `raw` (payload bruto), pra corrigir a extração assim que um evento novo chegar (não dá pra saber o campo certo sem ver um payload de verdade, e não dá pra backfillar retroativo — abandono não vira transação na Hotmart, não existe API de histórico pra isso). **Mas 407 dos 414 registros sem telefone foram preenchidos retroativamente por outro caminho**: cruzando por e-mail com `quiz_leads.whatsapp` (mesma pessoa, mesmo e-mail, telefone que ela já tinha deixado no quiz antes de abandonar o carrinho). Sem telefone caiu de 414 pra 47.

**Lead mais quente que o rótulo dizia (pedido do Felipe: "não faz sentido chamar de lead do quiz quem já foi até o carrinho").** Cruzamento por e-mail entre `quiz_leads` e `abandono_carrinho`/`vendas` (status não-aprovado) achou 753 e-mails batendo — dessas, 382 já tinham um contato correspondente em `whatsapp_contatos` (o telefone do quiz batendo com o telefone do contato, comparando os últimos 11 dígitos pra ignorar diferença de DDI). **367 contatos foram promovidos de `estagio_venda='descoberta'` pra `'fechamento'`** (a etapa DEF de fechamento, não a etapa do Kanban `etapa`) — rodado uma vez via SQL direto, não é rotina agendada. Se quiser rodar de novo no futuro (novo lote de leads), o critério é: `quiz_leads.email` bate com `abandono_carrinho.email` OU `vendas.comprador_email` (status ≠ aprovada), e o telefone (últimos 11 dígitos) bate entre `quiz_leads.whatsapp` e `whatsapp_contatos.telefone`.

**Bug real corrigido no caminho:** a checagem de "comprou depois" (badge "Comprou depois" vs "Não recuperado") filtrava `vendas` pela coluna `email`, que não existe nessa tabela (o campo certo é `comprador_email`) — a checagem nunca achava ninguém, o badge nunca mostrava "Comprou depois" mesmo quando era verdade. Corrigido junto.

## hotmart-webhook — NUNCA deployar sem `--no-verify-jwt` (incidente real, 2026-08-24 a 2026-08-25)

> Mesma classe de incidente já documentada abaixo pro `whatsapp-webhook`, agora confirmada pela segunda vez, com uma function diferente.

**Regra dura, sem exceção**: todo deploy do `hotmart-webhook` (sozinho ou junto com outras functions) tem que incluir a flag `--no-verify-jwt`, sempre:

```bash
supabase functions deploy hotmart-webhook --project-ref wntzzzuqoqmfcjebmzul --no-verify-jwt
```

**Por quê.** Igual ao `whatsapp-webhook`, o `hotmart-webhook` é chamado direto pela Hotmart, que não manda token do Supabase, só o token próprio dela (`HOTMART_WEBHOOK_TOKEN`). Se o deploy for feito sem `--no-verify-jwt`, o Supabase volta a exigir JWT válido, a Hotmart não tem esse token, e toda venda em tempo real passa a devolver 401 antes de chegar no nosso código. **Não trava o Tracker nem aparece como erro em lugar nenhum** — o painel continua funcionando normal.

**O que aconteceu de verdade.** Um deploy em 24/08/2026 às 20:44 UTC (dentro do commit `6927232`, da auditoria do Financeiro) derrubou essa flag sem querer. Passou despercebido porque **a Hotmart tem um plano B que mascarou o sintoma mais óbvio**: a function `hotmart-backfill` (`sales/history`, roda a cada 15min das 6h às 23h59 de Brasília) encontra a venda de qualquer forma e insere na tabela, então nenhuma venda foi perdida de verdade. O sinal de que algo estava errado só apareceu na tela "Últimas Vendas" do Financeiro, com a etiqueta amarela "Sem rastreio (webhook falhou)" — Felipe reparou e perguntou.

**O que o backfill NÃO cobre, e por isso fica perdido pra sempre nessas vendas:**
1. **`utm_source`/rastreio (`sck`) fica sempre null.** O endpoint `sales/history` da Hotmart não devolve esse dado, só o payload do webhook em tempo real tem. Não tem como recuperar depois — a origem dessas vendas (Meta Ads, WhatsApp, orgânico) fica desconhecida pra sempre.
2. **Mensagem de boas-vindas no WhatsApp não é enviada.** `whatsapp_boas_vindas_enviado` fica `false` — só o `hotmart-webhook` dispara isso, o backfill só grava a venda e enriquece endereço/telefone.
3. **Evento de Purchase não é mandado pra API de Conversões do Meta (CAPI).** Só o `hotmart-webhook` faz isso. Uma venda que veio de anúncio e caiu nessa falha nunca vira sinal de otimização pro algoritmo do Meta.

**Antes de declarar qualquer deploy do `hotmart-webhook` como concluído**, confirmar `verify_jwt: false` (mesma checagem do `whatsapp-webhook`: `mcp__supabase__list_edge_functions` ou `get_edge_function`, procurar o campo). Se não tiver certeza, rodar o deploy de novo explicitamente com `--no-verify-jwt`.

**Sinal de alerta pra ficar de olho:** a etiqueta amarela "Sem rastreio (webhook falhou)" na tela "Últimas Vendas" do Financeiro (`dashboard.jsx`, `classifyOrigin()`) é o primeiro lugar onde esse tipo de falha aparece. Se aparecer, é sempre motivo pra checar o `verify_jwt` do `hotmart-webhook` na hora.

**Escopo real do incidente (conferido em 2026-08-25).** Só 2 vendas afetadas, as duas do produto MCV, as duas dentro da janela exata da falha (24/08 20:44 UTC até o conserto): Milene Back Juwer (`HP0358000289`) e Adriana Tavares Ribeiro (`HP2884276891`). Nenhuma outra venda de nenhum produto nos últimos ~14 dias caiu nisso. Existe um agrupamento parecido de eventos `SYNC_*` em junho/2026 (10 a 29/06), mas é de um período bem anterior à fase estável do projeto — não é o mesmo incidente, não indica recorrência.

**Endpoint de recuperação: reenviar boas-vindas pra venda que ficou sem.** Se uma venda do MCV passar por essa falha (ou qualquer outra que deixe `whatsapp_boas_vindas_enviado=false` numa venda aprovada), tem um jeito de mandar a mensagem depois, manual, sem tocar em segredo nenhum na mão:

```bash
curl -X POST "https://wntzzzuqoqmfcjebmzul.supabase.co/functions/v1/hotmart-webhook/reenviar-boas-vindas" \
  -H "X-Hotmart-Webhook-Token: <valor de HOTMART_WEBHOOK_TOKEN no .env>" \
  -H "Content-Type: application/json" \
  -d '{"transactionId":"<hotmart_transaction_id da venda>"}'
```

Reaproveita a mesma função `enviarBoasVindasMcv()` e os mesmos segredos que o fluxo normal usa (template aprovado, link do grupo), então o resultado é idêntico ao que teria acontecido na hora certa. Já checa sozinho se a venda existe, se já foi enviada antes (idempotente, não manda duas vezes) e se tem telefone cadastrado. Foi usado pra recuperar a venda da Milene em 2026-08-25, ~8h depois da compra.

## Anúncio criado direto no Gerenciador do Meta — como fazer o Tracker adotar

> Combinado com Felipe em 2026-08-25. Via de volta (Meta → Tracker), simétrica à publicação normal (Tracker → Meta).

Por padrão, um anúncio criado direto no Gerenciador de Anúncios do Meta (fora do botão "Publicar" do Tracker) **não aparece sozinho** em nenhuma tela — nem no Kanban de Anúncios, nem em Tráfego. Dois motivos: (1) o nome precisa seguir o padrão `ADS N - título` pra ser reconhecido, e (2) o Tracker nunca cria card novo sozinho a partir do Meta — só reconcilia card que já existe.

**Passo a passo pra criar um anúncio pelo Gerenciador e o Tracker adotar sozinho:**
1. Criar o card no Tracker primeiro, pra reservar o número (botão "Novo AD" no Kanban de Anúncios, ou pedir pra mim). O card nasce em `status: 'fazer'`, sem `meta_ad_id`.
2. No Gerenciador do Meta, nomear o anúncio exatamente `ADS <número> - <título>` (mesmo padrão que o Tracker usa sozinho ao publicar, regex `ADS_PATTERN = /ADS\s*0*(\d+)/i` em `kanban-sync/index.ts`).
3. Ativar o anúncio no Meta. No próximo ciclo do `kanban-sync` (scope `curtas`, a cada 15 minutos), o Tracker encontra o nome, casa com o card local pelo número, e **adota**: grava `meta_ad_id`, `meta_campaign_id`, `meta_adset_id` e o permalink, move o card pra "Ativos". No ciclo seguinte do `meta-sync` (até 6h depois, mesmo prazo do G1/G5), as métricas (`insights_cache`) começam a sincronizar, e ele passa a aparecer na aba Tráfego com dado real.

**Por que precisa reservar o número antes, e o Tracker nunca cria o card sozinho.** `numero` é a chave que amarra o anúncio a `vendas`, `alertas` e todo o resto do banco — deixar o Meta "inventar" um número livre seria abrir mão dessa amarração, e criar linha nova sem controle já causou card incompleto no passado (por isso foi desligado, ver comentário em `kanban-sync/index.ts`). A única fonte de verdade pra número novo é o Tracker.

**O que muda no código:** `syncMetaAdStatus()` em `supabase/functions/kanban-sync/index.ts` passou a buscar `adset_id`/`campaign_id` de todo anúncio da conta (antes só `id,name,effective_status`), e a reconciliação deixou de exigir `meta_ad_id` já preenchido pra considerar um card — antes (`.not("meta_ad_id","is",null)`) só atualizava quem já tinha sido publicado pelo próprio app.

### Relançar o mesmo número (card que JÁ tinha `meta_ad_id` de antes)

Isso é diferente de "adotar" (acima, pra card sem vínculo nenhum). Se o ADS N já rodou antes pelo Tracker, foi pausado/arquivado, e agora você cria um anúncio NOVO no Meta reaproveitando o mesmo número, isso é resolvido automaticamente:

- `kanban-sync` (`curtas` e `maximo`) agrupa o gasto/venda de TODA a conta **pelo número extraído do nome**, não pelo `meta_ad_id` — então `gasto_total`/`vendas_total`/`cpa_historico` (o CPA global do card) já somam automaticamente TODO ad_id que algum dia usou aquele "ADS N", antigo e novo juntos. Relançar não zera nem perde histórico.
- `meta_ad_id`/`meta_campaign_id`/`meta_adset_id` do card trocam pro anúncio **que a Meta reporta como `ACTIVE` agora** (`adPorNumero`, calculado dentro de `syncMetaAdStatus()` — mesma fonte usada pra "adotar" um anúncio novo, ver seção acima). Em até 15 minutos (ciclo do `curtas`) ou, se ainda não teve gasto recente, até a próxima varredura `maximo` (diária), o vínculo já reflete o anúncio certo.

**Bug real corrigido em 2026-08-26: o critério anterior (`bestAdId`, "quem gastou mais") elegia às vezes um anúncio ANTIGO e morto.** Pra um número reutilizado várias vezes ao longo da vida da conta (comum em ADS reaproveitado), o ad_id de MAIOR gasto **acumulado na vida inteira** quase sempre é uma campanha de meses atrás, não o relançamento de agora — mesmo o antigo estando pausado e sem gastar nada há tempos. Achado real: ADS 195, 275, 344 e 356 (relançados dentro das campanhas MCV 216 e MCV 217) ficaram presos em ad_id, campanha e conjunto de um período bem anterior, mesmo com o anúncio novo já ativo e rodando de verdade — a aba Tráfego mostrava campanha errada pra esses 4. Corrigido trocando o critério: `meta_ad_id`/campanha/conjunto agora vêm sempre de `adPorNumero` (o que a Meta diz que está `ACTIVE` agora), nunca de "maior gasto". `gasto_total`/`vendas_total`/`cpa_historico` continuam somando por nome (isso sempre esteve certo, é o CPA global) — só o vínculo "qual é o atual" que parou de usar gasto como critério.

## Receita manual (venda fora da Hotmart) — aba Financeiro

> Adicionado em 2026-08-21, primeira venda: Mentoria XP Sala Preta.

Venda fechada por fora do checkout automático (ex: mentoria negociada 1:1, fechada por WhatsApp) não vem de webhook nenhum, então tem que ser lançada à mão. O botão **"Registrar Receita"** na aba Financeiro (`AddRevenueModal` em `frontend/app/financeiro.jsx`) grava direto na tabela `vendas`, a mesma que a Hotmart usa — por isso conta pra faturamento, lucro, funil de vendas e CPA médio igual a qualquer outra venda, sem precisar de tela nem cálculo separado.

**Como funciona por baixo:**
- `hotmart_transaction_id` recebe um id sintético com prefixo `MANUAL-` (não existe transação real da Hotmart pra essa venda). Isso também serve pra identificar a origem depois — nenhum script de sync (`sync_hotmart.py`, `corrigir_valor_liquido.py`) mexe em transação que não reconhece, então essas linhas nunca são sobrescritas por engano.
- `valor_liquido = valor_bruto = preco_oferta`, sem desconto de taxa nem juros: o valor entra por inteiro, e se algum dia a venda manual tiver taxa de gateway ou juros embutido, isso precisa ser descontado à mão no valor lançado.
- `utm_source: 'manual'` cai numa categoria própria ("Manual") em Vendas por Fonte no Dashboard, pra não se misturar com "Tráfego" e distorcer o ROAS calculado sobre anúncio de verdade.
- `status: 'aprovada'` direto — venda manual só é lançada quando o dinheiro já está confirmado, não existe estado "pendente" nesse fluxo.

**Não editável nem deletável pela tela.** Igual a uma venda da Hotmart, uma vez lançada só corrige via SQL (pedir pra mim). Isso evita apagar/alterar histórico financeiro sem querer.

## Aviso de ADS/mídia repetida na mesma campanha (aba Anúncios, modal Publicar)

> Combinado com Felipe em 2026-08-17. É só aviso, nunca bloqueia a publicação.

Ao escolher a campanha no modal "Publicar" (`MetaAdModal` em `frontend/app/kanban.jsx`, função `checarDuplicidadeNaCampanha`), o Tracker consulta a tabela `ads` filtrando por `meta_campaign_id` e mostra um aviso amarelo (não bloqueante) em dois casos:

1. **O mesmo card (mesmo `numero`) já foi publicado nessa campanha antes** — evita criar um segundo anúncio duplicado do mesmo ADS por engano.
2. **Outro card usa a mesma mídia** (`meta_image_hash` ou `meta_video_id` batendo) **dentro da mesma campanha** — é um sinal de que a mesma imagem/vídeo já rodou ali, útil pra não repetir criativo sem perceber.

Escopo é a **campanha inteira**, não só o conjunto de anúncios (um mesmo criativo pode se repetir em conjuntos diferentes da mesma campanha e o aviso ainda dispara). A checagem é best-effort: se a consulta falhar, não trava o fluxo de publicação, só não mostra aviso nenhum.

## Regra G5 — CPA acima do limite pausa o ADS sozinho, sem confirmação no chat

> Combinado com Felipe em 2026-08-17. É uma exceção explícita ao "GATE EM CAMADA DE CHAT ANTES DE OPERAÇÕES DE ESCRITA NA META GRAPH API" da raiz do fluxo-criativo: essa ação específica (pausar por estouro de CPA) está pré-aprovada permanentemente, não passa mais pelo gate.

Qualquer ADS ativo, de qualquer produto ou conta, que tenha **CPA acima de R$207,90 nas janelas de 3 dias E de 5 dias ao mesmo tempo** é pausado automaticamente no Meta, sem eu perguntar antes. O valor vive em `regras_atp` (`codigo='G5'`, campo `parametros.cpa_limite`) e pode ser mudado direto na tabela sem precisar mexer em código.

**Como funciona, ponta a ponta:**
1. `meta-sync` (scope `curtas`, cron `sync-meta-ads`, roda 4x/dia às 3h/9h/15h/21h UTC = 0h/6h/12h/18h de Brasília — **não é de 15 em 15 minutos**, correção de uma nota anterior errada aqui) calcula CPA 3d/5d de cada ADS e, se os dois estourarem o limite, grava um `alertas` com `acao_pendente='pausar'` (função `verificarRegraG5` em `supabase/functions/meta-sync/index.ts`).
2. `processar-pausas` (roda a cada 5min via pg_cron, migração `051_kanban_sync_nuvem.sql`) lê esses alertas pendentes, chama `POST /{ad_id}` na Graph API com `status=PAUSED`, classifica o criativo (`Ótimo`/`Mediano`/`Ruim`/`Testar novamente`) e move o ADS pra coluna certa do Kanban de Tráfego, com uma nota `[Pausado automaticamente — G5 em {data}]` nas observações.
3. Ciclo completo, do estouro do CPA até o ADS pausado de verdade na Meta: até ~6 horas (o intervalo real do `meta-sync`), não os ~20 minutos que uma nota anterior aqui dizia.

**Antes dessa mudança**, o G5 só criava o alerta (`acao_tomada: 'alertado'`), nunca marcava `acao_pendente`, então nada era pausado sozinho — o aluno via o alerta na aba Tráfego mas precisava pausar manualmente. Isso fechou essa lacuna.

**Bug real corrigido em 2026-08-25: G5 re-alertava um ADS já pausado, pra sempre.** ADS 022 e ADS 233 estouraram o limite em 17/08, foram pausados corretamente na Meta, e ficaram pausados o tempo todo — mas o `insights_cache` de um ADS sem veiculação nova mantém o CPA 3d/5d **congelado** no último valor real antes da pausa (nunca zera sozinho, porque não há dado novo pra recalcular). Sem checar o status do ADS na nossa tabela, o G5 achava que o ADS continuava "acima do limite" pra sempre e criava um alerta novo a cada ciclo do `meta-sync` (4x/dia), e o `processar-pausas` reprocessava a "pausa" de novo a cada vez — sem quebrar nada (o ADS já estava pausado), mas empilhando uma nota `[Pausado automaticamente — G5 em {data}]` idêntica nas observações a cada ciclo. Em uma semana, os dois ADs acumularam 28 notas duplicadas cada. Corrigido: `verificarRegraG5()` agora pula o ADS se `ads.status` não for `'ativo'` (ou seja, se ele já foi processado antes e virou `arquivado`/`campeoes`). Observações dos dois ADs afetados foram limpas manualmente.

**Se um dia o limite ou a regra de "precisa bater nas duas janelas" mudar**, é só editar `regras_atp.parametros.cpa_limite` (não precisa redeploy) ou a lógica em `verificarRegraG5()` (aí sim precisa redeploy do `meta-sync`).

## Regra G1 — gasto real sem NENHUMA venda em 5 dias também pausa sozinho

> Combinado com Felipe em 2026-08-25. Mesma exceção ao gate de escrita do G5 acima, mesmo mecanismo (`alertas.acao_pendente='pausar'` → `processar-pausas` executa).

**Por que essa regra precisou existir separada do G5.** ADS 029 e ADS 193 gastaram R$373,76 e R$448,99 em 5 dias sem NENHUMA venda, e nunca foram nem avaliados pelo G5 — porque a query dele filtra fora (`.not("cpa","is",null)`) qualquer `insights_cache` com `cpa=null`, e `cpa` vira `null` quando `compras=0` (divisão por zero). Gasto real sem venda nenhuma é pior que CPA alto (é CPA "infinito"), mas justamente esse pior caso passava batido pro G5.

**A regra:** ADS com `compras=0` E `gasto ≥ multiplicador_ticket × ticket` na janela de 5 dias é pausado automaticamente, mesma lógica de execução do G5 (`verificarRegraG1()` em `supabase/functions/meta-sync/index.ts`, chamada logo antes do G5 dentro do scope `curtas`). Os dois parâmetros vivem em `regras_atp` (`codigo='G1'`, `parametros.multiplicador_ticket` e `parametros.ticket`, hoje `1` e `297` — o ticket do MCV, único produto na conta), editáveis sem redeploy.

**G1 já existia como linha cadastrada em `regras_atp`** ("Gasto sem conversão"), mas nunca tinha sido implementada em código nenhum — só o nome e os parâmetros existiam, sem função nenhuma lendo isso. Essa foi a primeira vez que essa regra rodou de verdade.

**Mesma proteção do G5 contra re-alerta infinito** já nasceu junto: só avalia ADS com `ads.status='ativo'`, não fica re-processando o que já foi pausado e classificado.

## whatsapp-webhook — NUNCA deployar sem `--no-verify-jwt` (incidente real, 2026-08-07 a 2026-08-11)

> Combinado com Felipe em 2026-08-11, depois de um incidente real de 4 dias sem receber nenhuma mensagem de lead.

**Regra dura, sem exceção**: todo deploy do `whatsapp-webhook` (sozinho ou junto com outras functions) tem que incluir a flag `--no-verify-jwt`, sempre:

```bash
supabase functions deploy whatsapp-webhook --project-ref wntzzzuqoqmfcjebmzul --no-verify-jwt
```

**Por quê.** O `whatsapp-webhook` é o único endpoint deste projeto chamado diretamente pela Meta (WhatsApp Cloud API), que não manda token nenhum do Supabase, só a assinatura própria dela. Se o deploy for feito sem `--no-verify-jwt` (ex: `supabase functions deploy whatsapp-webhook` batendo várias functions juntas num só comando, ou pelo MCP `deploy_edge_function`), o Supabase volta a exigir JWT válido em toda chamada, a Meta não tem esse token, e toda entrega de webhook passa a devolver 401 imediatamente. A mensagem nunca chega a ser gravada. **Não é um erro visível no painel: o Tracker continua funcionando normalmente, só que ninguém nunca mais aparece como "precisa responder", porque nenhuma mensagem nova chega.**

**O que aconteceu de verdade**: um redeploy de rotina (corrigindo um bug de prompt do Claudinho) às 22:45 de 7/8/2026 derrubou essa flag sem querer. O problema só foi percebido 4 dias depois, quando o Felipe estranhou o silêncio total. Nesse intervalo, toda resposta que qualquer lead mandou foi perdida de verdade (a Meta tenta reentregar algumas vezes e desiste, sem fila permanente do lado dela) — não tem como recuperar essas mensagens depois.

**Antes de declarar qualquer deploy do `whatsapp-webhook` como concluído**, confirmar que `verify_jwt: false` está ativo. Forma rápida de checar: `mcp__supabase__get_edge_function` (ou a API equivalente) e procurar o campo `verify_jwt` no JSON retornado — tem que estar `false`. Se não tiver certeza se a flag foi aplicada, rodar o deploy de novo explicitamente com `--no-verify-jwt` antes de seguir em frente.

**As outras functions do Claudinho (`whatsapp-retomada`, `whatsapp-prompt-atual`) não têm esse risco**: são chamadas com token válido do Supabase (`whatsapp-retomada` via pg_cron com service role key; `whatsapp-prompt-atual` via `frontend/app/conversas.jsx` com a chave anon), então `verify_jwt: true` (o padrão) não quebra nada nelas. A regra acima vale só pro `whatsapp-webhook`, mas ao criar qualquer function nova que receba chamada de fora do Supabase (outro provedor de webhook, por exemplo), aplicar o mesmo cuidado.

## Chamar worker da Cloudflare: usar `curl`, nunca `urllib` do Python

> Registrado em 2026-08-12, depois de tropeçar nisso duas vezes na mesma sessão.

A Cloudflare bloqueia o user-agent padrão do `urllib` do Python (`Python-urllib/3.x`)
e devolve **403 antes de a requisição chegar no worker**. O worker nunca é
executado, então não aparece nada no `wrangler tail` e o erro parece ser do
código que acabou de subir.

**Foi exatamente isso que atrasou o teste do `/deletar-pasta`:** o endpoint estava
certo desde o primeiro deploy, mas o script de teste em Python voltava erro, o que
apontou o dedo pro lugar errado. Repetido com `curl`, funcionou de primeira.

Para bater em qualquer `*.workers.dev` ou domínio atrás da Cloudflare:

```bash
curl -s -X POST https://organico-media.blindagem-fmn.workers.dev/deletar-pasta \
  -H 'Content-Type: application/json' -d '{"numero":999}'
```

Isso vale só para **chamar o worker**. Falar com o Supabase (PostgREST) e com a
Google Drive API em Python continua normal, esses não passam pela Cloudflare.

Se precisar mesmo de Python na chamada ao worker, mandar um `User-Agent` de
navegador no cabeçalho resolve. Mas o caminho curto é `curl`.

## Orgânico — pasta padrão do Drive (fonte oficial de mídia)

**A mídia de qualquer card do Orgânico (imagem, carrossel ou vídeo) SEMPRE vem da pasta do Google Drive, nunca de arquivo solto no Downloads, Desktop ou qualquer outro lugar do Mac.** Pasta raiz: `https://drive.google.com/open?id=1h3cPqEoOnXld-6Sqh3IjsYcsb2bh_PLp` (ID `1h3cPqEoOnXld-6Sqh3IjsYcsb2bh_PLp`, já cadastrado como `ORGANICO_FOLDER_ID` em `scripts/adicionar-criativo-organico.py`). Dentro dela, cada card tem sua própria subpasta `ORG <numero>` (ex: `ORG 019`), e o número segue o mesmo índice por `created_at` mostrado na UI do Kanban.

Quando o usuário disser "subi o vídeo/imagem do ORG N, suba pro Tracker" ou equivalente: rodar `python3 scripts/adicionar-criativo-organico.py --numero N --auto` (não pegar arquivo manual do Mac). O script já busca a pasta certa, otimiza (Story → 1920px, resto → 1350px JPEG 82%; vídeo gera preview leve 540p + alta ≤78MB) e atualiza `conteudo_organico` sozinho.

## Claudinho — treino sem precisar de print (Felipe/Amanda pede "treinar Claudinho" sem anexar nada)

> Combinado em 2026-07-30.

Quando for pedido pra treinar o Claudinho sem vir print nenhum (ex: "treina o Claudinho", "vê se tem gente esperando resposta"), não travar esperando imagem. Em vez disso: consultar direto `whatsapp_mensagens` no Supabase pra achar conversas com mensagem do lead sem resposta nossa depois dela (`ia_pausada=false` ou conforme o campo de handoff/pausa vigente), montar a resposta seguindo a mesma rotina de sempre (contexto em `quiz_leads`, regras do `whatsapp-ia-prompt.ts`), mostrar a sugestão pro usuário aprovar, e seguir. Print continua servindo quando o usuário preferir colar um (não é obrigatório, é só mais uma forma de trazer o caso).

## Claudinho — carimbo de última atualização do prompt (obrigatório em toda edição)

> Combinado em 2026-07-30.

Toda vez que `supabase/functions/_shared/whatsapp-ia-prompt.ts` for editado (regra nova, correção, qualquer mudança no `SYSTEM_PROMPT_MCV`), atualizar também a constante `PROMPT_ATUALIZADO_EM` no topo do mesmo arquivo, com a data/hora atual de Brasília em ISO com offset (ex: `2026-07-30T13:17:12-03:00`). Essa constante alimenta o carimbo "Última atualização" mostrado no modal Prompt do Claudinho (botão na tela Conversas), que renderiza a data formatada antes do botão de fechar (X). Sem atualizar essa constante, o carimbo mostrado fica desatualizado mesmo que o prompt tenha mudado de verdade — nunca esquecer esse passo, ele faz parte do mesmo commit/deploy da alteração de regra.

## Claudinho — aprender com toda conversa (não só a etapa formal de treino), sempre com aprovação antes

> Combinado em 2026-07-30. Reforça e generaliza a seção "log automático de erros" abaixo: vale pra QUALQUER coisa que o Felipe/Amanda ensinar sobre como o Claudinho deve se comportar, não só quando o pedido é explicitamente "treinar Claudinho". **Correção de 2026-07-30 no mesmo dia:** nunca aplicar direto sem avisar — risco real de eu interpretar errado o que foi dito e gravar uma regra que não era bem aquilo.

Sempre que, em qualquer conversa (não só na etapa formal de treino), o Felipe ou a Amanda corrigir, orientar ou ensinar algo sobre como o Claudinho deve responder, se comportar ou o que deve/não deve dizer, isso deve virar regra permanente no `whatsapp-ia-prompt.ts` — nunca fica só como instrução pontual daquela conversa. **Mas antes de mexer no arquivo**, mostrar num resumo curto a regra que pretendo escrever (a frase ou o trecho que vai entrar no prompt) e esperar um "ok"/"pode" explícito. Só depois disso: aplicar a regra no prompt (com exemplo real quando fizer sentido), atualizar `PROMPT_ATUALIZADO_EM`, redeployar `whatsapp-webhook` e `whatsapp-retomada`, e logar em `claudinho_erros` quando for correção de um erro real cometido numa resposta. Isso já era o padrão praticado nas rodadas de treino formais (mostrar a regra, gravar só depois de combinado); a diferença agora é que vale pra qualquer conversa, não só quando o pedido é "treinar Claudinho".

## Claudinho — log automático de erros (etapa de treinamento)

> Combinado com Amanda em 2026-07-21. Vale enquanto o modo treinamento do Claudinho estiver ativo (`whatsapp_modo_treinamento` em `app_config`). Pode ser removido/arquivado quando ele rodar 100% sozinho.

Toda vez que a sessão de "treinar o Claudinho" (simular resposta, revisar, corrigir) encontrar um erro real — seja de escrita (vírgula, saudação errada), de lógica (sinal de compra errado, direção do "fiquei no vácuo") ou de conteúdo (afirmação não confirmada no perfil.md) — **registrar automaticamente na tabela `claudinho_erros`** do Supabase, sem esperar o usuário pedir. Campos: `situacao` (contexto curto, ex: "Resposta pra Carolina, objeção de preço"), `erro` (o que saiu errado), `correcao` (o que foi feito: regra de prompt nova, trava em código, ou nenhuma ainda), `status` (`corrigido`/`pendente`/`reincidencia`), `telefone` (opcional).

Isso é diferente de melhorar o prompt: melhorar o prompt corrige o erro agora, o log mede se a correção funciona de verdade ao longo do tempo (erro novo = sinal bom, erro repetido = sinal de regressão). Ver botão "Log de erros" no Conversas, ao lado da barra amarela de treinamento.

Sempre que uma regra nova entrar em `whatsapp-ia-prompt.ts`, avaliar também se ela deveria ser trava em código em vez de (ou além de) trava em prompt — ver `_shared/whatsapp-texto-fixes.ts` pros exemplos já existentes (saudação de período do dia, vírgula antes de "e"/"ou", "acesso vitalício" sem qualificação). Trava em código não depende do modelo lembrar a regra, é mais confiável.

## Claudinho — bateria de testes automática

Script em `scripts/claudinho_stress_test.py`. Lê o prompt de verdade direto de `whatsapp-ia-prompt.ts` (nunca uma cópia colada), roda uma lista de cenários reais contra a API Anthropic e confere regras conhecidas (saudação, vírgula, preço com "apenas", "vitalício" qualificado, não pular pra preço sem sinal, terminar com pergunta). Rodar com `python3 scripts/claudinho_stress_test.py` toda vez que o prompt mudar, antes do deploy, pra pegar regressão. Custo pequeno de API por rodada (modelo haiku, poucos tokens). Adicionar cenário novo sempre que um erro novo virar regra no prompt — é assim que a bateria cresce junto com o aprendizado.

## Claudinho — leitura de imagem e PDF (visão nativa)

Desde 2026-07-21, imagem e figurinha recebidas do lead são baixadas e guardadas (igual já acontecia com áudio), e a IA "vê" de verdade a última imagem/PDF da conversa via visão nativa da Anthropic (sem precisar de outra API/serviço). Implementado em `whatsapp-webhook/index.ts` (download) e `_shared/whatsapp-ia.ts` (`baixarImagemBase64` + bloco de visão/documento na chamada). Só a mídia mais recente vira bloco de visão, mais antigas no histórico ficam só como texto placeholder, pra não inflar custo/tamanho de cada chamada.

**Cobertura de tipo de mensagem do WhatsApp (2026-07-21):**
- Texto, áudio (transcrito), imagem, figurinha, PDF: IA processa normalmente.
- Vídeo, localização, documento não-PDF (docx etc): handoff imediato (`precisa_humano = true`), a IA não tenta responder — ela não processa esses formatos.
- Reação de emoji: só registra o emoji, não aciona a IA (não é pergunta nem afirmação).

## Claudinho — transcrição de áudio (Groq/Whisper)

Implementado em 2026-07-21. `GROQ_API_KEY` salva no `.env` e como secret do Supabase (`supabase secrets set`). `_shared/whatsapp-transcricao.ts` baixa o áudio já salvo no storage e manda pro endpoint `https://api.groq.com/openai/v1/audio/transcriptions` (modelo `whisper-large-v3-turbo`, compatível com a API da OpenAI). O texto transcrito fica na coluna `whatsapp_mensagens.transcricao`, aparece embaixo do player de áudio no Conversas, e substitui o placeholder "🎤 Áudio" no histórico que a IA lê (`whatsapp-ia.ts`). Corrida rara: se a IA processar antes da transcrição terminar (ambos rodam em paralelo em background), ela usa o placeholder mesmo — não trava a resposta esperando.

## Claudinho — padrões aprendidos no treino de 2026-07-22

> Síntese de uma sessão de treino intensa. Todo detalhe individual já virou regra no prompt (`whatsapp-ia-prompt.ts`) e registro em `claudinho_erros`; isso aqui é o padrão de fundo pra não esquecer o "porquê".

- **Calibrar tom pelo RITMO da conversa, não só pelo conteúdo.** Lead respondendo rápido e solto em tempo real precisa de resposta igualmente solta, mesmo em Fechamento (onde é fácil ficar sério/formal por engano só porque o assunto é preço/decisão).
- **Resposta ambígua (sim/não seco pra pergunta de 2 opções) nunca trava a conversa pedindo esclarecimento** — isso irrita o lead. Responder de um jeito que sirva pras duas leituras e seguir em frente.
- **Ordem do SPIN é sequencial de verdade**: Descoberta confirmada → Implicação (afirmar consequência, pergunta final concreta e quantificável, tipo "quanto você gastaria") → só depois Necessidade de solução (benefício/ação pro lead, nunca "quer ver a ferramenta").
- **Autoridade de verdade cita a lei específica** (CDC, Código Civil sobre clareza contratual) em vez de afirmação genérica de risco.
- **Nunca repetir a mesma pergunta de fechamento disfarçada duas vezes na mesma conversa** — fácil de cair nisso achando que são perguntas diferentes.
- **Recusa explícita do lead (principalmente na 2ª vez) se respeita com elegância**, sem re-pitch imediato, mas reforçando valor de forma leve antes de fechar a porta.

No fundo: a lógica de vendas (DEF/SPIN/objeções) já estava correta na maior parte das vezes — o gargalo real era soar mais "gente de verdade" e menos "roteiro".

## Claudinho — handoff obrigatório: boleto/pix parcelado ou recusa do cartão

> Combinado com Amanda em 2026-07-23. Resolve a pendência do Jean Matos (registrada em `claudinho_erros` como `status: pendente`) sobre parcelar no boleto.

Se o lead pedir pra parcelar no boleto ou no Pix (parcelamento fora do cartão), isso é **handoff automático** — o Claudinho não afirma nem nega se isso é possível (não tem essa informação confirmada), só responde algo como "vou confirmar essa informação com o time e te retorno em breve" e sinaliza `handoff=true`. **Atualizado em 2026-08-20: pagar à VISTA sem cartão não é mais handoff, dá pra pagar à vista via Pix e isso já está confirmado, o Claudinho afirma direto.** Handoff só entra pra parcelamento fora do cartão. Regra completa em `whatsapp-ia-prompt.ts`, seção "Quando você passa a conversa pra um humano de verdade".

**Link especial de parcelamento (uso exclusivo humano).** Existe um segundo link de checkout do MCV, com o parâmetro `off=2zbq8e15`, que libera a condição de parcelamento nativa da Hotmart (boleto/pix parcelado) — é a resposta pro handoff acima. Esse link **nunca** deve ser enviado pelo Claudinho, só por um humano depois do handoff. Vive em `frontend/app/conversas.jsx` como `LINK_CHECKOUT_MCV_PARCELADO`, com `sck=whatsapp-ah` (mesma tag de rastreio de atendimento humano do link padrão), disponível como mensagem pronta ("Link com parcelado Hotmart") no painel de Conversas. O Claudinho não tem acesso a esse arquivo, mas se um dia esse link precisar aparecer em qualquer lugar que o Claudinho lê (`whatsapp-ia-prompt.ts`, `whatsapp-ia.ts`), a restrição continua valendo.

## Claudinho — tag de rastreio do link de checkout ao rascunhar mensagem pra envio manual (treino)

> Combinado em 2026-07-31.

O link de checkout padrão do MCV que vive em `whatsapp-ia-prompt.ts` usa `sck=whatsapp-cl` (rastreio do Claudinho, IA ao vivo). Isso está correto pro prompt, porque ali é sempre a IA que manda. **Mas quando eu (Claude Code) rascunho uma mensagem com esse link durante uma sessão de `/tracker-treinar-claudinho` pra Felipe ou Amanda colarem e mandarem manualmente no WhatsApp**, isso não é a IA ao vivo mandando, é atendimento humano, então o rastreio certo é `sck=whatsapp-ah`, não `whatsapp-cl`. Trocar o final da URL antes de entregar o rascunho: `https://pay.hotmart.com/W87258826R?checkoutMode=10&sck=whatsapp-ah`. O `whatsapp-cl` continua reservado só pro link que a função `whatsapp-ia.ts` manda sozinha, sem intervenção humana.

## Link da página de vendas do MCV pra venda orgânica no WhatsApp (atendimento humano)

> Combinado em 2026-08-14. Alternativa ao link direto de checkout quando o lead se beneficia de ver a página de vendas completa antes de decidir (objeção não resolvida, quer entender melhor o produto, pediu prova social), sempre em envio manual, nunca pelo Claudinho ao vivo.

A página de vendas (`https://www.contratos.fotografiaeomeunegocio.com.br`) já tem um script embutido que repassa o `sck` recebido na URL da própria página direto pro botão de checkout, sem precisar de nada além disso. **O link certo pra colar numa mensagem manual carrega só o `sck`, sem `utm_*` junto** (os `utm_*` são redundantes aqui: só alimentam GA4/Pixel da própria página, o log de pageview do Tracker não lê `utm_*`, e o `sck` sozinho já é o que decide a atribuição na tabela `vendas`):

```
https://www.contratos.fotografiaeomeunegocio.com.br/?sck=whatsapp-ah-lp
```

**Gatilho obrigatório: lead pedindo pra ver/visualizar os modelos.** Sempre que o lead pedir pra ver os modelos, ver exemplo, ver como é visualmente, mandar exatamente esse link da página de vendas, nunca um print ou imagem solta dos Modelos de Contrato Visual. Mandar print/imagem do MCV é entregar o próprio produto de graça, o produto É o design visual dos contratos. A página de vendas mostra prévia, exemplos e prova social sem entregar o arquivo editável em si.

**Por que `whatsapp-ah-lp` e não `whatsapp-ah`:** usa um sufixo `-lp` diferente do link direto de checkout, pra separar nos relatórios quem recebeu a página de vendas completa de quem recebeu o link direto pro pagamento, é o dado que mostra qual dos dois converte melhor no orgânico. Testado ponta a ponta em 2026-08-14: o `sck` chega intacto na Hotmart (verificado no HTML de produção, dentro do limite de 30 caracteres) e o `hotmart-webhook` grava `sck` e `utm_source` iguais na tabela `vendas`, confirmado com venda real anterior usando o formato irmão `whatsapp-ah` (venda de 24/07, atribuída corretamente).

**Limitação de rastreio que existe e não tem como eliminar:** o repasse do `sck` depende do JavaScript da página rodar no clique do botão. Se o lead sair da página e voltar depois sem os parâmetros na URL (histórico, digitando o endereço de cabeça), a venda cai no `sck` padrão da própria página (`lp-contratos-fmn`) em vez do rastreio individual. Isso é aceitável, é a mesma limitação que qualquer LP com repasse de UTM tem.

## Áudio enviado pelo WhatsApp — sempre OGG/Opus e sempre mono

> Descoberto na implementação da gravação de áudio no Conversas, em 2026-08-11,
> com dois envios reais de teste que falharam antes de acertar.

Todo áudio que sai do Tracker para o WhatsApp precisa de **duas** coisas ao
mesmo tempo. Falhar em qualquer uma delas dá erro que só aparece depois:

1. **Formato OGG/Opus.** É o formato de áudio de voz do WhatsApp, o único que
   vira a bolha nativa (ondinha e controle de velocidade). O MP4 que o Chrome
   grava é fragmentado e o WhatsApp recusa na entrega, com o erro
   `"uploaded with mimetype as audio/mp4, however on processing it is of type
   application/octet-stream"`. A conversão vive em `frontend/app/audio-ogg.js`
   e só troca a embalagem WebM por OGG, sem recodificar o som.

2. **Mono.** Um OGG/Opus **estéreo** é aceito no envio (status "enviado") e
   chega no celular, mas ao dar play o WhatsApp mostra *"este áudio não está
   mais disponível, peça a Comercial FMN para reenviá-lo"*. O mesmo arquivo em
   mono chega e toca. O arquivo estéreo passava em tudo que dá para medir de
   fora (ffprobe valida, o navegador decodifica) — o único jeito de descobrir
   foi enviar de verdade e tentar ouvir. A gravação força `channelCount: 1`.

**Como diagnosticar quando um envio falhar.** O motivo vem no webhook e é
gravado em `whatsapp_mensagens.raw.status_errors` (`whatsapp-webhook`). Antes
disso ser guardado, a mensagem ficava marcada como "falhou" sem nenhuma pista,
e o diagnóstico dependia de adivinhação. **Status "entregue" no banco não é
prova de que o áudio toca**: no caso do estéreo, o status ficou correto e o
áudio estava quebrado. Áudio novo só é dado como funcionando depois de alguém
apertar o play no celular.

## Hora da mensagem recebida é a da Meta, nunca a nossa

> Descoberto em 2026-08-11, como consequência tardia do apagão do
> `whatsapp-webhook` documentado no topo deste arquivo.

Ao gravar mensagem recebida, `created_at` vem do campo `timestamp` que a Meta
manda no payload, não do relógio do servidor no momento da gravação. As duas
horas quase sempre coincidem — e divergem justamente quando mais importa.

**O que aconteceu.** Durante o apagão (7 a 11/08), a Meta reentregou mensagens
antigas assim que o webhook voltou. Elas foram gravadas com a hora da gravação,
então uma mensagem de 08/08 às 07:48 aparecia como recebida hoje às 15:23. Três
consequências, todas silenciosas:

1. O contador de janela de 24h no topo da conversa mostrou "22h 17min restantes"
   numa janela que estava fechada havia três dias. Quem confiou nele mandou
   mensagem livre e levou o erro 131047 da Meta ("more than 24 hours have
   passed"), sem entender o motivo.
2. O separador de data pôs a mensagem no dia errado do histórico.
3. O Claudinho leu o histórico fora de ordem, achando recente o que era antigo.

19 mensagens ficaram assim e foram corrigidas com a hora real do payload.

**Regra geral:** qualquer campo de tempo que descreva um fato do lado de fora
(quando o cliente falou, quando a venda ocorreu) vem do sistema de origem. O
relógio local só serve para registrar quando NÓS fizemos alguma coisa.
