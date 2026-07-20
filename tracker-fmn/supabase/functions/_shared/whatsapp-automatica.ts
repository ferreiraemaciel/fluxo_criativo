// Tracker FMN — detecção de mensagem automática do WhatsApp Business do
// próprio lead (saudação/ausência que dispara sozinha, não é a pessoa
// respondendo de verdade). Compartilhado entre a IA ao vivo (whatsapp-ia.ts)
// e a retomada de janela (whatsapp-retomada), pra não insistir em cima de um
// número que só devolve resposta automática.

export const PADROES_MSG_AUTOMATICA = [
  /no momento (estou|devo estar)/i,
  /mensagem automática/i,
  /resposta automática/i,
  /assim que (eu )?(possível|puder|conseguir)/i,
  /já (te )?respondo/i,
  /estou (ausente|fora|indispon[íi]vel)/i,
  /n[ãa]o est(ou|amos) dispon[íi]ve(l|is)/i,
  /hor[áa]rio de atendimento/i,
  /obrigad[oa] pelo contato,? em breve/i,
  /retorno em breve/i,
  /retornaremos assim que/i,
  /agradece(mos)? (o |seu )?contato/i,
  /me conta como (você|voce) se chama/i,
  /como posso (estar )?(lhe |te )?ajud/i,
  /deixe sua mensagem/i,
  /demanda de trabalho o tempo de resposta/i,
  /entre em contato (com|pelo|através)/i,
  /para (melhor )?atend[êe]-?l[oa]/i,
  /estamos ansiosos para/i,
  /fico muito feliz em ter (você|voce) (aqui|por aqui)/i,
  /capturar momentos especiais/i,
  /agradece(mos)? (a )?sua mensagem/i,
  /iremos te responder/i,
];

export function pareceMensagemAutomatica(texto: string): boolean {
  return PADROES_MSG_AUTOMATICA.some((re) => re.test(texto || ""));
}

// Olha as últimas mensagens recebidas desse contato (mais recente primeiro)
// e conta quantas automáticas seguidas vieram sem nenhuma mensagem real do
// lead no meio. A partir de 2 automáticas consecutivas sem interação real,
// entende que esse número só tem resposta automática ligada — trava novos
// envios (resposta ao vivo e retomada) até o lead mandar algo de verdade.
export async function contatoSoRespondeAutomatico(supabase: any, telefone: string): Promise<boolean> {
  const { data } = await supabase
    .from("whatsapp_mensagens")
    .select("corpo")
    .eq("telefone", telefone)
    .eq("direcao", "entrada")
    .order("created_at", { ascending: false })
    .limit(5);

  let consecutivas = 0;
  for (const m of data || []) {
    if (pareceMensagemAutomatica(m.corpo)) {
      consecutivas++;
      if (consecutivas >= 2) return true;
    } else {
      break; // achou uma mensagem real do lead, para de contar
    }
  }
  return false;
}
