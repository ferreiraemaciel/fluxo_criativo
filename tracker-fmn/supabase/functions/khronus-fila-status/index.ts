// Tracker FMN — Consulta se um telefone já tem mensagem na fila do Khronus
// (número de suporte, via Ponte), pra marcar "Já contatado pelo suporte" na
// aba Funis > Recuperação de Venda — cobre tanto o envio manual de
// recuperação (enviar-recuperacao-khronus) quanto a boas-vindas automática
// de aluno novo (hotmart-webhook), porque as duas gravam na mesma fila
// khronus.crm_whatsapp_fila_envio. Combinado com Felipe em 2026-08-26.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const khronus = createClient(
  Deno.env.get("KHRONUS_SUPABASE_URL")!,
  Deno.env.get("KHRONUS_SERVICE_ROLE_KEY")!,
  { db: { schema: "khronus" } },
);

const STUDIO_ID = "d00109c7-84ec-4905-b39d-cbe0da66af75"; // "Fotografia é o Meu Negócio" (número de suporte do FMN)

// Telefone no Khronus: NÃO dá pra adivinhar se o número canônico do WhatsApp
// tem ou não o nono dígito.
//
// Bug real de 2026-08-27: a primeira versão disso sempre removia o 9 (regra
// tirada de um comentário do Blindagem, que tinha observado contatos com 12
// dígitos). Só que "o 9 que sobra" e "o 9 que faz parte do número" são
// indistinguíveis olhando só os dígitos: Elisabete Petry é 51 92000-4406, e
// remover o 9 gerou 51 2000-4406, um número que não existe. A Ponte foi
// perguntar ao WhatsApp e voltou "esse número não tem WhatsApp", corretamente.
//
// Regra certa: guardar o número COMO ELE É (55 + DDD + 9 dígitos, quando for
// celular) e deixar o WhatsApp dizer qual é o identificador de verdade, via
// queryExists na Ponte. Na hora de PROCURAR um contato que já existe, tentar
// as duas variantes, porque contato antigo pode ter sido salvo sem o 9.
function variantesTelefoneKhronus(bruto: string): string[] {
  const digitos = String(bruto || "").replace(/\D/g, "");
  if (!digitos) return [];
  const local = digitos.startsWith("55") && digitos.length > 11 ? digitos.slice(2) : digitos;

  const variantes: string[] = [];
  if (local.length === 11 && local[2] === "9") {
    variantes.push(`55${local}`);                                  // com o 9 (o número de verdade)
    variantes.push(`55${local.slice(0, 2)}${local.slice(3)}`);      // sem o 9 (formato antigo)
  } else if (local.length === 10) {
    variantes.push(`55${local}`);                                  // já veio sem o 9
    variantes.push(`55${local.slice(0, 2)}9${local.slice(2)}`);     // com o 9 acrescentado
  } else if (local.length >= 10) {
    variantes.push(`55${local}`);
  }
  return variantes;
}

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") {
    return new Response("Método não permitido", { status: 405, headers: CORS });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ erro: "Payload inválido" }), {
      status: 400, headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const telefones: string[] = Array.isArray(body?.telefones) ? body.telefones : [];
  if (!telefones.length) {
    return new Response(JSON.stringify({ telefones: [] }), {
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  // Todas as variantes de cada telefone: contato/fila podem estar salvos com
  // ou sem o nono dígito, e não dá pra saber qual sem perguntar ao WhatsApp.
  const candidatos = [...new Set(telefones.flatMap(variantesTelefoneKhronus))];

  try {
    // Um telefone por status mais recente: se a última tentativa falhou, o
    // Tracker precisa saber disso pra sinalizar "falhou" mesmo que uma
    // tentativa anterior tenha dado certo (situação nova, mensagem nova).
    const porTelefone: Record<string, { status: string; criado_em: string }> = {};
    for (let i = 0; i < candidatos.length; i += 200) {
      const { data, error } = await khronus
        .from("crm_whatsapp_fila_envio")
        .select("telefone,status,criado_em")
        .eq("studio_id", STUDIO_ID)
        .in("telefone", candidatos.slice(i, i + 200));
      if (error) throw new Error(error.message);
      (data || []).forEach((r) => {
        const atual = porTelefone[r.telefone];
        if (!atual || r.criado_em > atual.criado_em) {
          porTelefone[r.telefone] = { status: r.status, criado_em: r.criado_em };
        }
      });
    }
    const resultado = Object.entries(porTelefone).map(([telefone, v]) => ({ telefone, status: v.status }));

    return new Response(JSON.stringify({ telefones: resultado }), {
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (e) {
    console.error("[khronus-fila-status] erro:", e.message);
    return new Response(JSON.stringify({ erro: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
