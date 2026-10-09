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
  // Pré-checkout da página de vendas do Blindagem (aprovados em 09/10/2026).
  blindagem_contato_solicitado:
    "Oi, {{1}}, aqui é do time da Fotografia é o Meu Negócio. Recebemos seu cadastro na página do Blindagem pedindo pra falar com a gente por aqui. Conta pra gente o que você quer saber sobre o app que a gente te responde por aqui mesmo.",
  blindagem_checkout_pendente:
    "Oi, {{1}}, aqui é do time da Fotografia é o Meu Negócio. Vimos que você começou a compra do Blindagem e não chegou a finalizar. Se travou em alguma coisa no pagamento ou ficou alguma dúvida sobre o app, responde aqui que a gente te ajuda.",
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
