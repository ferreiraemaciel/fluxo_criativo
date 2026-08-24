// Compartilhado entre whatsapp-webhook, whatsapp-enviar, hotmart-webhook e
// quiz-lead-intake: mantém a tabela whatsapp_contatos (visão Kanban) em dia
// sem sobrescrever uma etapa que o time já ajustou manualmente.

export async function upsertContato(
  supabase: any,
  telefone: string,
  nome: string | null,
  etapaSeNovo: "lead_novo" | "em_conversa" | "aluno" | "perdido",
  opts: { forcarEtapa?: boolean; promoverParaEmConversa?: boolean; tornouAlunoEm?: string; iaElegivel?: boolean } = {},
) {
  const { data: existente } = await supabase
    .from("whatsapp_contatos")
    .select("etapa")
    .eq("telefone", telefone)
    .single();

  if (!existente) {
    const insert: Record<string, unknown> = { telefone, nome, etapa: etapaSeNovo };
    if (etapaSeNovo === "aluno" && opts.tornouAlunoEm) insert.tornou_aluno_em = opts.tornouAlunoEm;
    // ia_elegivel vem `false` por padrão na tabela (trava proposital contra
    // "ligar pra todo mundo sem querer"). Só quem cria o contato explicitando
    // iaElegivel:true nasce já elegível pra resposta ao vivo do Claudinho.
    if (opts.iaElegivel) insert.ia_elegivel = true;
    await supabase.from("whatsapp_contatos").insert(insert);
    return;
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (nome) patch.nome = nome;
  if (opts.forcarEtapa) patch.etapa = etapaSeNovo;
  // "perdido" é só quem a janela de 24h fechou sem retorno (arquivamento automático).
  // Se o lead voltar a responder depois disso, sai de "perdido" e reentra no fluxo
  // normal de "em_conversa", igual quando promove "lead_novo".
  else if (opts.promoverParaEmConversa && (existente.etapa === "lead_novo" || existente.etapa === "perdido")) {
    patch.etapa = "em_conversa";
    // Contato que existia de antes de virar elegível por padrão (ou que foi
    // arquivado como "perdido" antes do backfill de elegibilidade) nunca
    // ganhava ia_elegivel por esse caminho — o UPDATE nunca tocava esse
    // campo, só o INSERT de contato novo. Isso deixava o Claudinho mudo pra
    // quem "ressuscitava" respondendo depois de arquivado, sem erro nenhum
    // aparecendo. Achado real com o Marcelo Veiga e o Luiz Chisini em
    // 2026-08-24: mensagem de quiz de dias atrás, arquivado como perdido,
    // voltou a responder, promoveu pra em_conversa mas ficou sem resposta.
    patch.ia_elegivel = true;
  }
  if (opts.forcarEtapa && etapaSeNovo === "aluno" && opts.tornouAlunoEm) patch.tornou_aluno_em = opts.tornouAlunoEm;

  await supabase.from("whatsapp_contatos").update(patch).eq("telefone", telefone);
}
