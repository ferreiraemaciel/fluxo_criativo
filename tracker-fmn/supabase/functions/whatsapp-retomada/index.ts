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

    return new Response(JSON.stringify({ ok: true, avaliados: contatos.length, enviados }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    console.error("[whatsapp-retomada] erro:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "content-type": "application/json" } });
  }
});
