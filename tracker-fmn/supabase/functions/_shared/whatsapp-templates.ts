// Corpo real dos templates aprovados no Meta, pra gravar a mensagem final
// (com as variáveis já substituídas) em whatsapp_mensagens.corpo, em vez de
// um resumo tipo "[template: nome] · valor1 · valor2". Se o texto aprovado
// no Meta mudar, atualize aqui também.

const CORPOS: Record<string, string> = {
  boas_vindas_mcv:
    "Oi, {{1}}. Aqui é do time do Fotografia é o Meu Negócio.\n" +
    "Você acabou de dar um passo que a maioria dos fotógrafos nunca dá: profissionalizar o próprio negócio com contrato de verdade.\n" +
    "A partir de agora você tem acesso aos Modelos de Contrato Visual, atualizações do método e conteúdos que não saem no Instagram, nem no YouTube.\n" +
    "Para ter acesso, entre no grupo da nossa comunidade: {{2}}",
  resultado_quiz_mcv:
    "Oi, {{1}}. Aqui é do time do Fotografia é o Meu Negócio.\n" +
    "Seu resultado do quiz saiu: {{2}}.\n" +
    "Isso significa que você está exposto a {{3}}.\n" +
    "Responda essa mensagem e te mostro o passo certo pro seu caso.",
};

export function renderCorpoTemplate(nome: string, parametros: string[]): string {
  const base = CORPOS[nome];
  if (!base) return `[template: ${nome}] ${parametros.join(" · ")}`;
  let texto = base;
  parametros.forEach((valor, i) => {
    texto = texto.split(`{{${i + 1}}}`).join(String(valor ?? ""));
  });
  return texto;
}
