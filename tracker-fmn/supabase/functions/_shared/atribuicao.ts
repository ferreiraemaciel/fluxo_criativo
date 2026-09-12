// Tracker FMN — como uma venda vira origem.
//
// A mesma regra estava escrita em três lugares: no hotmart-webhook, no
// scripts/sync_hotmart.py e no scripts/backfill_utms.py. O mesmo pedido podia
// terminar com anúncio diferente conforme o caminho por onde entrou, que é a
// raiz do tipo de divergência que já obrigou correção manual de 57 vendas.
// Auditoria de 12/09/2026: aqui é a fonte única do lado da nuvem.
//
// A Hotmart só guarda o `sck` (máximo 30 caracteres). O separador real dos
// campos dentro dele é `hQwK21wXxR`, nunca `|`.

export const SCK_SEP = "hQwK21wXxR";
const CLICK_ID_RE = /jLj6[a-zA-Z0-9]+/i;

export function parseSck(sck: string) {
  if (!sck) return {};
  const parts = sck.split(SCK_SEP);
  const dec = (s: string) => s ? decodeURIComponent(s.replace(/\+/g, " ")).trim() : null;

  const rawSource = parts[0] || "";
  const m = CLICK_ID_RE.exec(rawSource);
  const utmSource   = m ? rawSource.slice(0, m.index).toLowerCase().trim() : rawSource.toLowerCase().trim();
  const utmMedium   = parts.length > 1 && parts[1] ? dec(parts[1]) : null;
  const utmCampaign = parts.length > 2 && parts[2] ? dec(parts[2]) : null;
  let   utmContent  = parts.length > 3 && parts[3] ? dec(parts[3]) : null;
  const utmTerm     = parts.length > 4 && parts[4] ? dec(parts[4]) : null;

  // Meta Ads: "ad_name|ad_id" em utm_content
  let metaAdId: string | null = null;
  if (utmContent && utmContent.includes("|")) {
    const idx = utmContent.lastIndexOf("|");
    const adId = utmContent.slice(idx + 1).trim();
    if (/^\d{10,}$/.test(adId)) {
      metaAdId  = adId;
      utmContent = utmContent.slice(0, idx).trim();
    }
  }
  // sck só com o ID do anúncio, sem separador nenhum (formato compacto usado
  // pelo quiz-fotografo-protegido quando o destino é página própria: o
  // separador real do sck tem 10 caracteres, nunca cabe nos 30 do campo da
  // Hotmart pra alcançar a posição de content, então o quiz manda só o ID
  // puro). Se o sck inteiro (sem split nenhum, rawSource) for só dígitos,
  // 10+, é o ID do anúncio direto, não uma fonte de verdade.
  const soDigitos = parts.length === 1 && /^\d{10,}$/.test(rawSource);
  if (!metaAdId && soDigitos) {
    metaAdId = rawSource;
  }
  // Limpar sufixo "|id" de medium e campaign também
  const cleanPipe = (s: string | null) => s && s.includes("|") ? s.split("|")[0].trim() : s;

  return {
    // Quando o sck é só o ID do anúncio (sem separador), a "fonte" não é o
    // ID em si -- é Meta Ads por construção (só o quiz-fotografo-protegido
    // manda sck nesse formato, e só pra tráfego pago do Meta).
    utm_source:   soDigitos ? "fb" : (utmSource || null),
    utm_medium:   cleanPipe(utmMedium),
    utm_campaign: cleanPipe(utmCampaign),
    utm_content:  utmContent,
    utm_term:     utmTerm,
    meta_ad_id:   metaAdId,
  };
}
