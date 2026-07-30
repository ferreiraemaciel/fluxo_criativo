---
name: workshop-marketing:tracker-treinar-claudinho
description: Treinar o Claudinho, a IA vendedora do WhatsApp do Tracker FMN (produto MCV). Busca conversas com mensagem do lead sem resposta, redige a próxima fala seguindo DEF/SPIN/Light Copy, espera aprovação, e só depois de "ok" aplica correções como regra permanente no prompt (com aprovação prévia da regra em si, nunca automático), atualiza o carimbo de última atualização, redeploya e loga em claudinho_erros.
allowed-tools: Read, Edit, Bash, AskUserQuestion
model: sonnet
---

# Tracker — Treinar Claudinho

Comando dedicado a rodar numa conversa exclusiva de treino do Claudinho (a IA vendedora do WhatsApp do Tracker FMN, produto Modelos de Contrato Visual — MCV, R$297 via Hotmart). Consolida a rotina praticada ao longo de várias sessões de treino real.

## Passo 0 — Onde tudo vive

- Projeto: `~/Documents/fluxo-criativo/tracker-fmn`.
- Prompt do Claudinho: `supabase/functions/_shared/whatsapp-ia-prompt.ts` (exporta `SYSTEM_PROMPT_MCV` e `PROMPT_ATUALIZADO_EM`). Está no git, versionado normalmente.
- Deploy do prompt: `npx supabase functions deploy whatsapp-webhook --project-ref wntzzzuqoqmfcjebmzul --no-verify-jwt` **e** `npx supabase functions deploy whatsapp-retomada --project-ref wntzzzuqoqmfcjebmzul --no-verify-jwt` (os dois, sempre — o prompt é compartilhado pelos dois edge functions).
- Log de aprendizado: tabela `claudinho_erros` no Supabase (`situacao`, `erro`, `correcao`, `status`: `corrigido`/`reincidencia`/`pendente`, `telefone` opcional).
- Contexto de cada lead: tabela `quiz_leads` no Supabase, buscada pelo telefone (normalizar removendo espaços/traços/parênteses antes de comparar com `ilike`).
- Credenciais: ler `SUPABASE_SERVICE_KEY` do `.env` na raiz do `tracker-fmn` (nunca hardcode, nunca exibir o valor).

## Passo 1 — Achar conversas pendentes (sem precisar de print)

Se o usuário não colou nenhum print, não travar esperando imagem. Consultar direto `whatsapp_mensagens` no Supabase pra achar conversas com mensagem do lead (`direcao='recebida'` ou equivalente do schema atual) sem nenhuma resposta nossa depois dela, e que estejam com Claudinho ativo (não pausado). Ordenar pelas mais antigas primeiro (quem está esperando há mais tempo).

Se o usuário colar um print, usar o print como fonte (nome do contato, telefone, histórico visível) em vez de consultar sozinho.

## Passo 2 — Montar a resposta

1. Buscar o contexto do lead em `quiz_leads` pelo telefone: nível de risco, tipo de negócio, área de atuação, se usa contrato, tipo de contrato atual, situações marcadas, `quer_modelos`.
2. Ler o prompt atual (`whatsapp-ia-prompt.ts`) pra saber as regras vigentes — não confiar em memória de sessões anteriores, o arquivo é a fonte de verdade.
3. Redigir a próxima mensagem do Claudinho respeitando (lista não exaustiva, o prompt tem a versão completa e sempre priorizar o que estiver lá):
   - **Nunca afirmar que uma situação aconteceu com o lead como fato**, nem as que ele marcou no quiz — sempre dupla leitura ("isso é algo que você já viveu na pele ou é mais um receio?").
   - **Nunca convite passivo** tipo "quer que eu te mostre" — perguntas finais avançam a decisão de verdade.
   - **Preço sempre vem junto com o link de checkout**, na mesma mensagem, nunca separado. Toda mensagem de preço carrega uma pressão leve Light Copy (ligada ao risco de continuar exposto, nunca urgência falsa tipo "só hoje").
   - **Pergunta final da Implicação nunca pode virar trabalho de conta pro lead** — a conta quem faz é a IA na afirmação, a pergunta se responde de memória ou com sim/não.
   - **Variar a estrutura de abertura entre leads diferentes**, não usar sempre o mesmo molde de frase.
   - **Lead objetivo** (respostas curtas): comprimir etapas, não enrolar.
   - Nunca usar travessão, nunca ponto de exclamação, nunca pergunta como gancho de abertura (regras gerais de Light Copy do projeto).
4. Mostrar a mensagem redigida pro usuário e esperar aprovação ou correção. Nunca enviar de fato pelo WhatsApp — isso é decisão do usuário fora deste fluxo.

## Passo 3 — Se o usuário corrigir ou ensinar algo novo

**Regra de aprovação em duas camadas, sem exceção:**

1. Mostrar num resumo curto a regra que se pretende escrever no prompt (a frase ou o trecho que vai entrar), explicando o gatilho (o que aconteceu que motivou a regra).
2. Esperar um "ok"/"pode"/aprovação explícita do usuário sobre ESSA regra específica antes de tocar no arquivo. Nunca aplicar direto — risco real de interpretar errado o que foi dito.
3. Só depois do ok: editar `whatsapp-ia-prompt.ts` com a regra nova (incluir exemplo real da conversa quando fizer sentido, ajuda a fixar o padrão).
4. Atualizar a constante `PROMPT_ATUALIZADO_EM` no topo do mesmo arquivo, com data/hora atual de Brasília em ISO com offset (ex: `2026-07-30T13:17:12-03:00`). Isso alimenta o carimbo "Última atualização" no modal Prompt do Tracker (botão na tela Conversas) — nunca esquecer esse passo, ele é parte do mesmo commit/deploy da regra.
5. Redeployar `whatsapp-webhook` e `whatsapp-retomada` (os dois).
6. Logar em `claudinho_erros`: `situacao` (contexto curto), `erro` (o que saiu errado — vazio/N-A se for regra nova aprendida, não correção de erro), `correcao` (o que foi feito), `status` (`corrigido` se é regra nova, `reincidencia` se uma regra que já existia foi violada de novo, `pendente` se ainda não foi resolvido).

Essa regra de aprovação vale pra QUALQUER coisa que o usuário ensinar sobre como o Claudinho deve se comportar, em qualquer momento da conversa — não só quando ele está corrigindo uma resposta específica que acabou de ser mostrada.

## Passo 4 — Depois de cada rodada

Perguntar se tem mais alguma conversa pendente pra tratar, ou seguir buscando sozinho a próxima da fila (Passo 1) se o usuário preferir esse modo contínuo.

## Regras fixas do projeto (não específicas do Claudinho, mas sempre valem aqui)

- Token/segredo nunca em texto solto, sempre lido do `.env` no momento da execução.
- Nunca heredoc Python com token, nunca `curl | python3` — ver regras de execução técnica de Graph API no `CLAUDE.md` raiz (não se aplica direto ao Claudinho, mas ao restante do Tracker se a conversa também tocar tráfego pago).
- Commit e push só quando o usuário pedir explicitamente ("commit e github").
- Gate de staging/orquestração multi-agente: sugerir antes, nunca decidir sozinho usar (não deve ser necessário neste fluxo, que é sempre leve).
