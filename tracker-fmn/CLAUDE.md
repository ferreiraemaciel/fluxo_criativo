# Tracker FMN — Regras do Projeto

> Instruções específicas do Tracker FMN. Complementa o CLAUDE.md da raiz do fluxo-criativo (regras gerais do workshop), mas essas aqui valem só dentro desta pasta.

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
