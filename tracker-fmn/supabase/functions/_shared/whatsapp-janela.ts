// Tracker FMN — checa se a janela de serviço de 24h já está aberta pra um
// telefone (última mensagem de ENTRADA há menos de 24h). Se estiver, dá pra
// mandar texto livre em vez de template pago pro mesmo conteúdo.
const JANELA_MS = 24 * 60 * 60 * 1000;

export async function janelaAbertaPara(supabase: any, telefone: string): Promise<boolean> {
  const { data } = await supabase
    .from("whatsapp_mensagens")
    .select("created_at")
    .eq("telefone", telefone)
    .eq("direcao", "entrada")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return false;
  return (Date.now() - new Date(data.created_at).getTime()) < JANELA_MS;
}
