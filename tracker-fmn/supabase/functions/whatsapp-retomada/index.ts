// Tracker FMN — retomada de conversa antes da janela de 24h fechar.
// Roda a cada 10 minutos (migration 076). Mensagem de TEXTO LIVRE (não
// template), só funciona porque é mandada DENTRO da janela de serviço
// ainda aberta — por isso não tem custo nem precisa de aprovação do Meta.
// Se mandasse depois da janela fechar, seria business-initiated e exigiria
// template pago.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SYSTEM_PROMPT_MCV } from "../_shared/whatsapp-ia-prompt.ts";
import { custoAnthropicUsd } from "../_shared/whatsapp-custos.ts";
import { contatoSoRespondeAutomatico } from "../_shared/whatsapp-automatica.ts";
import { aplicarCorrecoesAutomaticas } from "../_shared/whatsapp-texto-fixes.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_MODEL   = Deno.env.get("ANTHROPIC_IA_MODEL") || "claude-haiku-4-5-20251001";
const WHATSAPP_TOKEN         = Deno.env.get("FB_ACCESS_TOKEN_PERMANENTE");
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

const JANELA_MS = 24 * 60 * 60 * 1000;
// Dispara quando falta entre 5 e 60 minutos pra janela fechar. A margem de
// 5 min de folga é pra nunca arriscar passar do prazo (cron roda de 10 em
// 10 min, então uma execução sempre cai dentro dessa faixa).
const FALTA_MAX_MS = 60 * 60 * 1000;
const FALTA_MIN_MS = 5 * 60 * 1000;

// Nudge rápido pra reação de emoji (combinado em 2026-07-30, treino do
// Leandro Borges): quando a conversa estava andando rápido no mesmo dia e a
// última coisa que o lead fez foi reagir com emoji em vez de responder, a
// retomada normal (perto de fechar a janela de 24h) demora demais e esfria
// o lead. Esse nudge dispara bem mais cedo, só pra esse padrão específico.
const REACAO_MIN_MS = 2 * 60 * 60 * 1000; // pelo menos 2h desde a reação
const REACAO_MAX_MS = 3 * 60 * 60 * 1000; // no máximo 3h, senão já virou caso da retomada normal
const REACAO_MIN_TROCAS = 2; // pelo menos 2 mensagens de texto reais do lead antes da reação, pra confirmar que é conversa quente, não reação a um template frio

const TOOL_RETOMADA = {
  name: "escrever_retomada",
  description: "Escreve uma mensagem curta de retomada, puxando o fio exato da conversa que ficou parada.",
  input_schema: {
    type: "object",
    properties: {
      mensagem: { type: "string", description: "1 a 2 frases, lembrando com calor humano do que foi falado, sem soar cobrança." },
    },
    required: ["mensagem"],
  },
};

async function gerarRetomada(historico: { role: string; content: string }[], ultimaFoiDoLead: boolean): Promise<{ mensagem: string; tokensEntrada: number; tokensSaida: number } | null> {
  if (!ANTHROPIC_API_KEY) return null;

  // Quem ficou esperando quem é o que decide se "fiquei no vácuo" faz
  // sentido. A frase é dita da NOSSA perspectiva: só cabe quando NÓS mandamos
  // a última mensagem e o lead sumiu depois dela. Se a última mensagem foi
  // DO LEAD e ninguém da nossa parte respondeu ainda, é ELE que ficou
  // esperando a gente — dizer "fiquei no vácuo" nesse caso inverte a culpa e
  // soa estranho. Essa checagem é feita em código (não confia só no modelo
  // interpretar certo, já teve caso de usar errado).
  const instrucaoVacuo = ultimaFoiDoLead
    ? `**NÃO use "fiquei no vácuo" dessa vez.** A última mensagem dessa conversa foi do PRÓPRIO LEAD, e ainda não respondemos ela — quem está esperando resposta é ele, não nós. Escreva uma retomada normal: uma resposta de verdade pro que ele disse por último, dando continuidade à conversa (pode reconhecer que demorou a responder, sem exagerar no pedido de desculpas).`
    : `**Caso especial "fiquei no vácuo": pode usar aqui, porque a última mensagem da conversa foi NOSSA e o lead não respondeu desde então.** Nesse caso a melhor retomada não é puxar de novo o assunto comercial, é só notar o silêncio, sem pedir nada: "Fiquei no vácuo 😢" (ou variação bem curta equivalente). Só funciona se antes disso o lead já tinha respondido de verdade pelo menos uma vez (não é a primeira mensagem que mandamos pra ele). Use isso NO MÁXIMO uma vez por lead (nunca repita esse mesmo recurso de novo com quem já recebeu, senão vira manipulação óbvia e queima a mão). Se o lead já tinha dado uma objeção clara antes de sumir (preço, "vou pensar", "não quero"), não use esse caminho, aí a retomada deve ser a puxada normal do assunto.`;

  const systemPrompt = `${SYSTEM_PROMPT_MCV}

## Tarefa específica agora
Essa conversa está prestes a fechar a janela de atendimento. Escreva UMA mensagem curta de retomada, puxando especificamente o assunto que vocês estavam conversando (use o histórico abaixo), no tom certo pro perfil desse lead (objetivo ou que gosta de conversar, veja como ele respondia antes). Nunca genérica tipo "tudo bem?", sempre amarrada ao que já foi dito. Sem cobrança, sem pressão, só reabrindo a porta.

**NUNCA invente uma pendência que não existe no histórico.** Proibido dizer coisas como "tinha um detalhe que você queria saber mais sobre", "sobre aquela dúvida que você mencionou", "você tinha ficado de me falar" quando o lead nunca disse nada disso — o lead percebe na hora ("qual detalhe?") e a conversa quebra em vez de reaquecer. A retomada se ancora SEMPRE em algo que aconteceu de verdade: se a última mensagem foi uma pergunta NOSSA sem resposta, retome ELA (reformulada mais leve, nunca copiada igual); se foi o lead que falou por último, responda o que ele disse. Nada de assunto fabricado.

**A retomada segue as MESMAS regras de fechamento do resto da conversa: termina sempre em pergunta (a única exceção de verdade é handoff) e nunca promete mostrar/explicar algo sem entregar o conteúdo na mesma mensagem.** Erro real que já aconteceu: a retomada escreveu "Deixa eu te mostrar qual é a blindagem certa pra isso" e parou por aí, sem nenhuma pergunta e sem entregar a blindagem de verdade — isso não dá ao lead nada concreto pra reagir, ele fica sem saber o que responder. Se for reconectar prometendo mostrar algo, já mostre/afirme o conteúdo ali mesmo (nome do produto, o que resolve, atributo concreto) e só depois feche com a pergunta que mantém a conversa aberta.

${instrucaoVacuo}`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 300,
        system: systemPrompt,
        messages: historico.length ? historico : [{ role: "user", content: "(sem histórico anterior)" }],
        tools: [TOOL_RETOMADA],
        tool_choice: { type: "tool", name: "escrever_retomada" },
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || `anthropic ${r.status}`);
    const toolUse = (d.content || []).find((c: any) => c.type === "tool_use");
    if (!toolUse?.input?.mensagem) return null;
    // Trava contra travessão vazando pro lead: mesmo proibido no prompt, já
    // aconteceu do modelo usar "—" numa retomada (grave, entrega "resposta de
    // IA" na cara). Não confia só na instrução, garante removendo aqui.
    const mensagem = aplicarCorrecoesAutomaticas(
      String(toolUse.input.mensagem).replace(/\s*[—–]\s*/g, ", ").trim(),
    );
    return { mensagem, tokensEntrada: d.usage?.input_tokens || 0, tokensSaida: d.usage?.output_tokens || 0 };
  } catch (err) {
    console.error("[whatsapp-retomada] erro Anthropic:", err);
    return null;
  }
}

const TOOL_NUDGE_REACAO = {
  name: "escrever_nudge_reacao",
  description: "Escreve uma mensagem curta de reengajamento pra um lead que reagiu com emoji em vez de responder de verdade, numa conversa que estava andando rápido.",
  input_schema: {
    type: "object",
    properties: {
      mensagem: { type: "string", description: "1 a 3 frases, reconhecendo o clima positivo da reação sem se ater a ela, e avançando a conversa pro próximo passo real." },
    },
    required: ["mensagem"],
  },
};

async function gerarNudgeReacao(historico: { role: string; content: string }[]): Promise<{ mensagem: string; tokensEntrada: number; tokensSaida: number } | null> {
  if (!ANTHROPIC_API_KEY) return null;

  const systemPrompt = `${SYSTEM_PROMPT_MCV}

## Tarefa específica agora
Essa conversa estava andando rápido hoje, várias trocas de mensagem reais, e a última coisa que o lead fez foi reagir com um emoji (não escreveu nada) à sua última mensagem, que terminava com uma pergunta real. Reação de emoji sozinha não é uma resposta de verdade, então NÃO trate a reação como se fosse um texto respondido nem tente adivinhar o que ela quis dizer. Em vez disso, escreva uma mensagem curta que reconhece o clima positivo (sem over-analisar qual emoji foi) e avança a conversa pro próximo passo real, retomando exatamente a pergunta ou o ponto que sua última mensagem deixou em aberto (reformulada, nunca copiada igual). Tom leve, nunca cobrança, ele está numa boa, só não terminou de responder.

**NUNCA invente uma pendência que não existe no histórico.** A retomada se ancora SEMPRE em algo que já foi dito de verdade nessa conversa, nunca em assunto fabricado.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 300,
        system: systemPrompt,
        messages: historico.length ? historico : [{ role: "user", content: "(sem histórico anterior)" }],
        tools: [TOOL_NUDGE_REACAO],
        tool_choice: { type: "tool", name: "escrever_nudge_reacao" },
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || `anthropic ${r.status}`);
    const toolUse = (d.content || []).find((c: any) => c.type === "tool_use");
    if (!toolUse?.input?.mensagem) return null;
    const mensagem = aplicarCorrecoesAutomaticas(
      String(toolUse.input.mensagem).replace(/\\n/g, "\n").replace(/\s*[—–]\s*/g, ", ").trim(),
    );
    return { mensagem, tokensEntrada: d.usage?.input_tokens || 0, tokensSaida: d.usage?.output_tokens || 0 };
  } catch (err) {
    console.error("[whatsapp-retomada] erro Anthropic (nudge reação):", err);
    return null;
  }
}

Deno.serve(async (_req) => {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return new Response(JSON.stringify({ ok: true, processados: 0, motivo: "credenciais ausentes" }), { headers: { "content-type": "application/json" } });
  }

  try {
    // A retomada de última hora vale pra QUALQUER contato com janela aberta,
    // não só pra quem está marcado como ia_elegivel: é só uma mensagem única
    // de reabertura, não é conversa ao vivo, então é segura mesmo durante a
    // etapa de treinamento do Claudinho (onde a resposta ao vivo fica restrita
    // a um único número de teste, ver TELEFONE_TESTE_TREINAMENTO em whatsapp-ia.ts).
    const { data: contatos, error } = await supabase
      .from("whatsapp_contatos")
      .select("telefone, nome, retomada_enviada_para")
      .eq("ia_pausada", false)
      .eq("precisa_humano", false)
      .not("etapa", "in", "(aluno,perdido)");
    if (error) throw error;
    if (!contatos?.length) return new Response(JSON.stringify({ ok: true, processados: 0 }), { headers: { "content-type": "application/json" } });

    const agora = Date.now();
    let enviados = 0;

    for (const contato of contatos) {
      const { data: ultimaEntrada } = await supabase
        .from("whatsapp_mensagens")
        .select("created_at")
        .eq("telefone", contato.telefone)
        .eq("direcao", "entrada")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!ultimaEntrada) continue;

      const entradaMs = new Date(ultimaEntrada.created_at).getTime();
      const falta = JANELA_MS - (agora - entradaMs);
      if (falta > FALTA_MAX_MS || falta < FALTA_MIN_MS) continue;

      // Já mandou retomada pra essa mesma janela (mesmo timestamp de entrada)? Pula.
      if (contato.retomada_enviada_para && new Date(contato.retomada_enviada_para).getTime() === entradaMs) continue;

      // As últimas respostas desse número foram só resposta automática do
      // WhatsApp Business dele (sem nenhuma interação real no meio)? Então
      // não é a pessoa ali, é só um loop de "em breve iremos te responder" —
      // não insiste, não gasta retomada em cima disso.
      if (await contatoSoRespondeAutomatico(supabase, contato.telefone)) continue;

      const { data: historicoRaw } = await supabase
        .from("whatsapp_mensagens")
        .select("direcao, corpo, created_at")
        .eq("telefone", contato.telefone)
        .order("created_at", { ascending: false })
        .limit(20);
      const historico = (historicoRaw || []).slice().reverse().filter((m: any) => m.corpo)
        .map((m: any) => ({ role: m.direcao === "entrada" ? "user" : "assistant", content: m.corpo }));

      // historicoRaw vem mais recente primeiro: [0] é a última mensagem da conversa.
      const ultimaFoiDoLead = historicoRaw?.[0]?.direcao === "entrada";

      const gerado = await gerarRetomada(historico, ultimaFoiDoLead);
      if (!gerado) continue;

      try {
        const r = await fetch(`https://graph.facebook.com/v25.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", to: contato.telefone, type: "text", text: { body: gerado.mensagem } }),
        });
        const d = await r.json();
        if (!r.ok || d.error) throw new Error(d.error?.message || `whatsapp ${r.status}`);

        const custo = await custoAnthropicUsd(supabase, gerado.tokensEntrada, gerado.tokensSaida);
        await supabase.from("whatsapp_mensagens").insert({
          telefone: contato.telefone, nome: contato.nome, direcao: "saida", tipo: "texto", corpo: gerado.mensagem,
          wa_message_id: d?.messages?.[0]?.id || null, status: "enviado", origem: "ia_retomada",
          tokens_entrada: gerado.tokensEntrada, tokens_saida: gerado.tokensSaida, custo_usd: custo,
        });
        await supabase.from("whatsapp_contatos")
          .update({ retomada_enviada_para: ultimaEntrada.created_at })
          .eq("telefone", contato.telefone);
        enviados++;
      } catch (err) {
        console.error("[whatsapp-retomada] erro ao enviar:", contato.telefone, err);
      }
    }

    // Segunda passada: nudge rápido pra quem só reagiu com emoji numa conversa
    // quente (ver constantes REACAO_* acima). Roda separado do loop principal
    // porque a lógica de tempo é outra (desde a reação, não até a janela
    // fechar) e não pode interferir na retomada normal.
    let enviadosReacao = 0;
    for (const contato of contatos) {
      const { data: ultimasDuas } = await supabase
        .from("whatsapp_mensagens")
        .select("direcao, corpo, origem, raw, created_at")
        .eq("telefone", contato.telefone)
        .order("created_at", { ascending: false })
        .limit(2);
      if (!ultimasDuas || ultimasDuas.length < 2) continue;

      const [ultima, penultima] = ultimasDuas;
      // Só interessa quando a ÚLTIMA mensagem da conversa é uma reação do
      // lead, e a mensagem anterior foi NOSSA e não é o template frio do quiz
      // (reagir ao template sem nenhuma troca real não conta como "quente").
      if (ultima.direcao !== "entrada") continue;
      if ((ultima.raw as any)?.type !== "reaction") continue;
      if (penultima.direcao !== "saida" || penultima.origem === "quiz") continue;

      const reacaoMs = new Date(ultima.created_at).getTime();
      const desde = agora - reacaoMs;
      if (desde < REACAO_MIN_MS || desde > REACAO_MAX_MS) continue;

      // Já mandou esse nudge pra essa mesma reação? Confere se já existe uma
      // saída com essa origem depois do timestamp da reação (evita duplicar
      // a cada execução do cron dentro da janela de 1h).
      const { data: jaMandou } = await supabase
        .from("whatsapp_mensagens")
        .select("id")
        .eq("telefone", contato.telefone)
        .eq("origem", "ia_retomada_reacao")
        .gt("created_at", ultima.created_at)
        .limit(1)
        .maybeSingle();
      if (jaMandou) continue;

      // Conversa realmente andou antes da reação (não é só reação isolada a
      // um número que nunca respondeu de verdade)?
      const { count } = await supabase
        .from("whatsapp_mensagens")
        .select("id", { count: "exact", head: true })
        .eq("telefone", contato.telefone)
        .eq("direcao", "entrada")
        .eq("raw->>type", "text")
        .lt("created_at", ultima.created_at);
      if ((count || 0) < REACAO_MIN_TROCAS) continue;

      if (await contatoSoRespondeAutomatico(supabase, contato.telefone)) continue;

      const { data: historicoRaw } = await supabase
        .from("whatsapp_mensagens")
        .select("direcao, corpo, created_at")
        .eq("telefone", contato.telefone)
        .order("created_at", { ascending: false })
        .limit(20);
      const historico = (historicoRaw || []).slice().reverse().filter((m: any) => m.corpo)
        .map((m: any) => ({ role: m.direcao === "entrada" ? "user" : "assistant", content: m.corpo }));

      const gerado = await gerarNudgeReacao(historico);
      if (!gerado) continue;

      try {
        const r = await fetch(`https://graph.facebook.com/v25.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", to: contato.telefone, type: "text", text: { body: gerado.mensagem } }),
        });
        const d = await r.json();
        if (!r.ok || d.error) throw new Error(d.error?.message || `whatsapp ${r.status}`);

        const custo = await custoAnthropicUsd(supabase, gerado.tokensEntrada, gerado.tokensSaida);
        await supabase.from("whatsapp_mensagens").insert({
          telefone: contato.telefone, nome: contato.nome, direcao: "saida", tipo: "texto", corpo: gerado.mensagem,
          wa_message_id: d?.messages?.[0]?.id || null, status: "enviado", origem: "ia_retomada_reacao",
          tokens_entrada: gerado.tokensEntrada, tokens_saida: gerado.tokensSaida, custo_usd: custo,
        });
        enviadosReacao++;
      } catch (err) {
        console.error("[whatsapp-retomada] erro ao enviar nudge de reação:", contato.telefone, err);
      }
    }

    return new Response(JSON.stringify({ ok: true, avaliados: contatos.length, enviados, enviadosReacao }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    console.error("[whatsapp-retomada] erro:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "content-type": "application/json" } });
  }
});
