# Tracker FMN — Regras do Projeto

> Instruções específicas do Tracker FMN. Complementa o CLAUDE.md da raiz do fluxo-criativo (regras gerais do workshop), mas essas aqui valem só dentro desta pasta.

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
1. `meta-sync` (scope `curtas`, roda a cada 15min via pg_cron) calcula CPA 3d/5d de cada ADS e, se os dois estourarem o limite, grava um `alertas` com `acao_pendente='pausar'` (função `verificarRegraG5` em `supabase/functions/meta-sync/index.ts`).
2. `processar-pausas` (roda a cada 5min via pg_cron, migração `051_kanban_sync_nuvem.sql`) lê esses alertas pendentes, chama `POST /{ad_id}` na Graph API com `status=PAUSED`, classifica o criativo (`Ótimo`/`Mediano`/`Ruim`/`Testar novamente`) e move o ADS pra coluna certa do Kanban de Tráfego, com uma nota `[Pausado automaticamente — G5 em {data}]` nas observações.
3. Ciclo completo, do estouro do CPA até o ADS pausado de verdade na Meta: até ~20 minutos.

**Antes dessa mudança**, o G5 só criava o alerta (`acao_tomada: 'alertado'`), nunca marcava `acao_pendente`, então nada era pausado sozinho — o aluno via o alerta na aba Tráfego mas precisava pausar manualmente. Isso fechou essa lacuna.

**Se um dia o limite ou a regra de "precisa bater nas duas janelas" mudar**, é só editar `regras_atp.parametros.cpa_limite` (não precisa redeploy) ou a lógica em `verificarRegraG5()` (aí sim precisa redeploy do `meta-sync`).

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

Se o lead pedir pra parcelar no boleto, parcelar no Pix, ou disser que não quer usar o limite do cartão, isso é **handoff automático** — o Claudinho não afirma nem nega se isso é possível (não tem essa informação confirmada), só responde algo como "vou confirmar essa informação com o time e te retorno em breve" e sinaliza `handoff=true`. Regra completa em `whatsapp-ia-prompt.ts`, seção "Quando você passa a conversa pra um humano de verdade".

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
