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
  // Convite da comunidade para quem compra o Blindagem, 3 minutos depois da chave
  // (aprovado pelo Felipe em 14/10/2026). Mesmo grupo do MCV. Sai pela ponte do Khronus.
  comunidade_blindagem:
    "{{1}}, agora a segunda parte do seu acesso.\n" +
    "Quem compra o Blindagem entra também na nossa comunidade, onde saem primeiro as novidades do app, as atualizações dos modelos de contrato e os conteúdos que não vão para o Instagram nem para o YouTube.\n" +
    "Para entrar, é só tocar no link do grupo: {{2}}",
  resultado_quiz_mcv:
    "Oi, {{1}}. Aqui é do time do Fotografia é o Meu Negócio.\n" +
    "Seu resultado do quiz saiu: {{2}}.\n" +
    "Isso significa que você está exposto a {{3}}.\n" +
    "Responda essa mensagem e te mostro o passo certo pro seu caso.",
  // Pré-checkout da página de vendas do Blindagem (aprovados em 09/10/2026).
  blindagem_contato_solicitado:
    "Oi, {{1}}, aqui é do time da Fotografia é o Meu Negócio. Recebemos seu cadastro na página do Blindagem pedindo pra falar com a gente por aqui. Conta pra gente o que você quer saber sobre o app que a gente te responde por aqui mesmo.",
  // Black 2026: lembrete para quem entrou na lista e não clicou em "Entrar no
  // grupo" na página de obrigado. O botão do modelo leva à página de obrigado.
  black_2026_entrar_grupo:
    "Oi, {{1}}. Sua inscrição na lista da Black dos Fotógrafos Protegidos está confirmada.\n" +
    "Falta um passo para concluir: entrar no grupo do WhatsApp, que é por onde chegam os avisos da abertura em 10/11.\n" +
    "É só tocar no botão abaixo.\n" +
    // O link deste modelo vive no botão, não no corpo. Sem esta linha, quem
    // lê a conversa no Tracker vê um texto que manda tocar num botão que não
    // aparece em lugar nenhum, e não tem como conferir para onde ele leva.
    "[botão] Entrar no grupo → https://www.fotografiaeomeunegocio.com.br/black-2026-obrigado",
  black_2026_entrar_grupo_v2:
    "Oi, {{1}}. Sua inscrição na lista da Black dos Fotógrafos Protegidos está confirmada.\n" +
    "Falta um passo para concluir: entrar no grupo do WhatsApp, que é por onde chegam os avisos da abertura em 10/11.\n" +
    "É só tocar no botão abaixo.\n" +
    "[botão] Entrar no grupo → link de passagem que grava o clique e abre o grupo",
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
