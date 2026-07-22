// Tracker FMN — correções automáticas de texto aplicadas em toda mensagem
// que o Claudinho gera (ao vivo e retomada), DEPOIS do modelo escrever, ANTES
// de mandar pro WhatsApp. Isso é trava em código, não em prompt: não depende
// do modelo lembrar a regra, corrige sozinho toda vez. Ver claudinho_erros no
// Supabase pro histórico de onde cada uma dessas regras veio.

// 1) Saudação de período do dia: o modelo não sabe com certeza o horário real
// de quem está lendo, já saiu "bom dia" às 18h. Remove a saudação inteira.
function removerSaudacaoPeriodo(texto: string): string {
  return texto.replace(/\b(bom\s*dia|boa\s*tarde|boa\s*noite)\b[,!.]?\s*/gi, "").trim();
}

// 2) Vírgula antes de "e"/"ou" em frase corrida: escrita de WhatsApp de
// verdade não para pra respirar nisso. Heurística simples (não é 100%
// perfeita gramaticalmente, mas cobre o padrão real que já vazou).
function removerVirgulaAntesDeEOu(texto: string): string {
  return texto.replace(/,\s+(e|ou)\s+/gi, " $1 ");
}

// 3) "acesso vitalício" sozinho é uma promessa que a gente não garante pra
// sempre. Sempre completa com "enquanto o produto existir" se não estiver lá.
function completarAcessoVitalicio(texto: string): string {
  return texto.replace(
    /acesso\s+vital[íi]cio(?!\s+enquanto\s+o\s+produto\s+existir)/gi,
    "acesso vitalício enquanto o produto existir",
  );
}

export function aplicarCorrecoesAutomaticas(texto: string): string {
  let t = texto;
  t = removerSaudacaoPeriodo(t);
  t = removerVirgulaAntesDeEOu(t);
  t = completarAcessoVitalicio(t);
  return t;
}
