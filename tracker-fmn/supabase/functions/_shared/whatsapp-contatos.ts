// Compartilhado entre whatsapp-webhook, whatsapp-enviar, hotmart-webhook e
// quiz-lead-intake: mantém a tabela whatsapp_contatos (visão Kanban) em dia
// sem sobrescrever uma etapa que o time já ajustou manualmente.

export async function upsertContato(
  supabase: any,
  telefone: string,
  nome: string | null,
  etapaSeNovo: "lead_novo" | "em_conversa" | "aluno" | "perdido",
  opts: { forcarEtapa?: boolean; promoverParaEmConversa?: boolean; tornouAlunoEm?: string } = {},
) {
  const { data: existente } = await supabase
    .from("whatsapp_contatos")
    .select("etapa")
    .eq("telefone", telefone)
    .single();

  if (!existente) {
    const insert: Record<string, unknown> = { telefone, nome, etapa: etapaSeNovo };
    if (etapaSeNovo === "aluno" && opts.tornouAlunoEm) insert.tornou_aluno_em = opts.tornouAlunoEm;
    await supabase.from("whatsapp_contatos").insert(insert);
    return;
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (nome) patch.nome = nome;
  if (opts.forcarEtapa) patch.etapa = etapaSeNovo;
  // "perdido" é só quem a janela de 24h fechou sem retorno (arquivamento automático).
  // Se o lead voltar a responder depois disso, sai de "perdido" e reentra no fluxo
  // normal de "em_conversa", igual quando promove "lead_novo".
  else if (opts.promoverParaEmConversa && (existente.etapa === "lead_novo" || existente.etapa === "perdido")) patch.etapa = "em_conversa";
  if (opts.forcarEtapa && etapaSeNovo === "aluno" && opts.tornouAlunoEm) patch.tornou_aluno_em = opts.tornouAlunoEm;

  await supabase.from("whatsapp_contatos").update(patch).eq("telefone", telefone);
}
