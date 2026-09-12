// Tracker FMN — vigia dos sinais de vida.
//
// Auditoria de 12/09/2026: nenhuma das 35 funções avisava nada para fora. Os
// dois apagões reais do projeto (WhatsApp de 07 a 11/08, Hotmart de 24 a
// 25/08) só foram descobertos porque alguém estranhou a tela dias depois.
// Cinco dias sem mensagem de lead entrando é lead perdido que não volta.
//
// Este vigia roda de meia em meia hora e confere quatro relógios:
//   1. última mensagem recebida no WhatsApp
//   2. última venda gravada pelo webhook da Hotmart (não pelo backfill)
//   3. última atualização do sincronismo do Meta
//   4. último lead do quiz
//
// O que ele faz quando algo passa do limite:
//   • grava o estado em app_config (chave `vigia_sinais`), que vira faixa
//     vermelha no topo do painel
//   • manda mensagem no WhatsApp, se houver número configurado em
//     app_config (chave `vigia_whatsapp`), pela fila do Khronus
//
// Os limites são generosos de propósito: madrugada sem lead é normal, cinco
// horas sem nenhuma mensagem em dia útil não é.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { portao } from "../_shared/portao.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const khronus = createClient(
  Deno.env.get("KHRONUS_SUPABASE_URL")!,
  Deno.env.get("KHRONUS_SERVICE_ROLE_KEY")!,
  { db: { schema: "khronus" } },
);

const STUDIO_FMN = "d00109c7-84ec-4905-b39d-cbe0da66af75";

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

type Relogio = {
  chave: string;
  titulo: string;
  limiteHoras: number;
  ultima: string | null;
};

async function ultimaData(tabela: string, coluna: string, filtro?: (q: any) => any) {
  let q = supabase.from(tabela).select(coluna).order(coluna, { ascending: false }).limit(1);
  if (filtro) q = filtro(q);
  const { data, error } = await q;
  if (error || !data || !data.length) return null;
  return (data[0] as Record<string, string>)[coluna] || null;
}

function horasDesde(iso: string | null): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

function comoTexto(horas: number | null): string {
  if (horas == null) return "nunca";
  if (horas < 1) return `${Math.round(horas * 60)} min`;
  if (horas < 48) return `${horas.toFixed(1)} h`;
  return `${Math.floor(horas / 24)} dias`;
}

Deno.serve(async (req) => {
  const recusa = await portao(req, { usuario: true });
  if (recusa) return recusa;

  const relogios: Relogio[] = [
    {
      chave: "whatsapp",
      titulo: "mensagem recebida no WhatsApp",
      limiteHoras: 5,
      ultima: await ultimaData("whatsapp_mensagens", "created_at", (q) => q.eq("direcao", "entrada")),
    },
    {
      chave: "hotmart",
      titulo: "venda pelo webhook da Hotmart",
      limiteHoras: 48,
      ultima: await ultimaData("vendas", "created_at"),
    },
    {
      chave: "meta",
      titulo: "sincronismo do Meta Ads",
      limiteHoras: 12,
      ultima: await ultimaData("insights_cache", "atualizado_em"),
    },
    {
      chave: "quiz",
      titulo: "lead do quiz",
      limiteHoras: 36,
      ultima: await ultimaData("quiz_leads", "created_at"),
    },
  ];

  const parados = relogios
    .map((r) => ({ ...r, horas: horasDesde(r.ultima) }))
    .filter((r) => r.horas == null || r.horas > r.limiteHoras);

  const estado = {
    conferido_em: new Date().toISOString(),
    relogios: relogios.map((r) => ({
      chave: r.chave,
      titulo: r.titulo,
      ultima: r.ultima,
      ha: comoTexto(horasDesde(r.ultima)),
      limite_horas: r.limiteHoras,
      parado: parados.some((p) => p.chave === r.chave),
    })),
    parados: parados.map((p) => p.chave),
    mensagem: parados.length
      ? parados.map((p) => `${p.titulo}: nada há ${comoTexto(p.horas)}`).join(" · ")
      : null,
  };

  await supabase.from("app_config").upsert(
    { chave: "vigia_sinais", valor: estado },
    { onConflict: "chave" },
  );

  // Aviso no WhatsApp, quando houver número configurado. Só avisa de novo
  // depois de seis horas, para não virar alarme repetido a cada meia hora.
  let avisou = false;
  if (parados.length) {
    const { data: cfg } = await supabase
      .from("app_config")
      .select("valor")
      .eq("chave", "vigia_whatsapp")
      .maybeSingle();
    const numero = String((cfg?.valor as any)?.telefone || "").replace(/\D/g, "");
    const avisadoEm = (cfg?.valor as any)?.avisado_em as string | undefined;
    const passouSeisHoras = !avisadoEm || (Date.now() - new Date(avisadoEm).getTime()) > 6 * 3_600_000;

    if (numero && passouSeisHoras) {
      try {
        const { data: contato } = await khronus
          .from("crm_whatsapp_contatos")
          .select("id")
          .eq("studio_id", STUDIO_FMN)
          .eq("telefone", numero)
          .maybeSingle();
        let contatoId = contato?.id;
        if (!contatoId) {
          const { data: novo } = await khronus
            .from("crm_whatsapp_contatos")
            .insert({ studio_id: STUDIO_FMN, telefone: numero, nome: "Vigia do Tracker", etapa: "em_conversa" })
            .select("id")
            .single();
          contatoId = novo?.id;
        }
        if (contatoId) {
          const corpo = `Aviso do Tracker: ${estado.mensagem}. Confira o painel.`;
          await khronus.from("crm_whatsapp_fila_envio").insert({
            studio_id: STUDIO_FMN,
            contato_id: contatoId,
            telefone: numero,
            tipo: "texto",
            corpo,
            status: "pendente",
          });
          avisou = true;
          await supabase.from("app_config").upsert(
            { chave: "vigia_whatsapp", valor: { telefone: numero, avisado_em: new Date().toISOString() } },
            { onConflict: "chave" },
          );
        }
      } catch (e) {
        console.error("[vigia] falha ao avisar no WhatsApp:", (e as Error).message);
      }
    }
  }

  return json({ ok: true, parados: estado.parados, avisou, estado });
});
