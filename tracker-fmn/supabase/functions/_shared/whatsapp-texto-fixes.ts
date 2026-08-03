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

// 4) Vírgula artificial entre interjeição curta e "então" no início da
// mensagem: "Bora, então, Carlos." tem pausa que ninguém fala assim. Remove
// só a vírgula entre a interjeição e "então" (mantém a vírgula antes do
// nome, se houver, que aí sim pode ser uma pausa real).
function removerVirgulaVocativoCurto(texto: string): string {
  return texto.replace(/^(\p{L}+),\s*então,/iu, "$1 então,");
}

// 5) Palavra de reunião/apresentação ao retomar assunto já falado
// ("recapitulando", "resumindo", "voltando ao que discutimos") soa
// apresentação formal, não continuação de papo de WhatsApp.
function removerTransicaoDeReuniao(texto: string): string {
  return texto.replace(/\b(recapitulando|resumindo|voltando ao que discutimos)\b[,:]?\s*/gi, "").trim();
}

// 6) "Faz sentido"/"Faz todo sentido" como abertura de mensagem é proibido
// (vira muleta repetida). Remove só quando está no INÍCIO da mensagem, e
// recapitaliza a primeira letra do que sobrar.
function removerFazSentidoAbertura(texto: string): string {
  const semAbertura = texto.replace(/^faz (todo )?sentido[,.]?\s*/i, "");
  if (semAbertura === texto || !semAbertura) return texto;
  return semAbertura.charAt(0).toUpperCase() + semAbertura.slice(1);
}

export function aplicarCorrecoesAutomaticas(texto: string): string {
  let t = texto;
  t = removerSaudacaoPeriodo(t);
  t = removerVirgulaAntesDeEOu(t);
  t = completarAcessoVitalicio(t);
  t = removerVirgulaVocativoCurto(t);
  t = removerTransicaoDeReuniao(t);
  t = removerFazSentidoAbertura(t);
  return t;
}
