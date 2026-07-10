// Compartilhado entre whatsapp-webhook, whatsapp-enviar, hotmart-webhook e
// quiz-lead-intake: mantém a tabela whatsapp_contatos (visão Kanban) em dia
// sem sobrescrever uma etapa que o time já ajustou manualmente.

export async function upsertContato(
  supabase: any,
  telefone: string,
  nome: string | null,
  etapaSeNovo: "lead_novo" | "em_conversa" | "aluno" | "perdido",
  opts: { forcarEtapa?: boolean; promoverParaEmConversa?: boolean } = {},
) {
  const { data: existente } = await supabase
    .from("whatsapp_contatos")
    .select("etapa")
    .eq("telefone", telefone)
    .single();

  if (!existente) {
    await supabase.from("whatsapp_contatos").insert({ telefone, nome, etapa: etapaSeNovo });
    return;
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (nome) patch.nome = nome;
  if (opts.forcarEtapa) patch.etapa = etapaSeNovo;
  else if (opts.promoverParaEmConversa && existente.etapa === "lead_novo") patch.etapa = "em_conversa";

  await supabase.from("whatsapp_contatos").update(patch).eq("telefone", telefone);
}
