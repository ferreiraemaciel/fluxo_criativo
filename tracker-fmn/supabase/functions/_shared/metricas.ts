// Fonte única de como contar "venda" a partir de actions/action_values do
// Graph API Insights (Tracker FMN). Importada por meta-sync e kanban-sync —
// nunca duplicar esta extração de novo, importar daqui.
//
// "purchase" é o sinal limpo, direto do pixel. "offsite_conversion.fb_pixel_purchase"
// é o sinal reserva que o Meta também usa pra registrar a mesma compra quando
// o sinal limpo não chegou (navegador bloqueou cookie, atraso de rede, etc.).
// Sem o fallback, subconta vendas reais que aconteceram de verdade.

export function extrairCompras(raw: any): number {
  const actions = raw?.actions || [];
  const limpo = Number(actions.find((a: any) => a.action_type === "purchase")?.value || 0);
  if (limpo > 0) return limpo;
  return Number(
    actions.find((a: any) => a.action_type === "offsite_conversion.fb_pixel_purchase")?.value || 0
  );
}

export function extrairValorCompras(raw: any): number {
  const actionValues = raw?.action_values || [];
  const limpo = Number(actionValues.find((a: any) => a.action_type === "purchase")?.value || 0);
  if (limpo > 0) return limpo;
  return Number(
    actionValues.find((a: any) => a.action_type === "offsite_conversion.fb_pixel_purchase")?.value || 0
  );
}
