// Fonte única da regra de classificação de performance do Kanban (Tracker FMN).
// Ver REGRAS-KANBAN.md. Importada por kanban-sync e processar-pausas — nunca
// duplicar esta função de novo num Edge Function novo, importar daqui.
//
// Existe uma 3ª cópia em tracker-fmn/frontend/app/kanban.jsx (browser, runtime
// diferente — não dá pra importar deste arquivo Deno). Se mudar a regra aqui,
// mudar lá também.
//
// Regra revista em 2026-07-10 (removida a coluna "Testar novamente" do
// Kanban — a etiqueta continua existindo, só que vive dentro de Arquivados):
//   Ótimo:            ≥5 vendas E CPA < ticket
//   Testar novamente: (0 vendas E gasto < ticket) OU (vendeu, gasto < ticket
//                      E CPA < ticket — na prática esse CPA já vem garantido
//                      pelo gasto baixo, mas deixamos explícito pra bater
//                      com a regra como foi definida)
//   Ruim:             0 vendas E gasto ≥ ticket (gastou o valor de um
//                      cliente inteiro e não vendeu nada)
//   Mediano:          tudo o mais (vendeu pouco e já gastou o ticket, ou
//                      5+ vendas com CPA ruim)

export const TICKET_VAL = 297.0;

export function classificarAd(
  vendas: number | null,
  cpa: number | null,
  gasto: number | null
): string {
  const v = vendas || 0;
  const g = gasto || 0;
  const c = cpa != null ? cpa : (v > 0 && g > 0 ? g / v : null);

  if (v >= 5 && (c === null || c < TICKET_VAL)) return "Ótimo";

  const semVendaAindaBarato = v === 0 && g < TICKET_VAL;
  const vendeuMasNaoBateuTicket = v > 0 && g < TICKET_VAL && (c === null || c < TICKET_VAL);
  if (semVendaAindaBarato || vendeuMasNaoBateuTicket) return "Testar novamente";

  if (v === 0) return "Ruim";
  return "Mediano";
}
