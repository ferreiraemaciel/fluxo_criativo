// Tracker FMN — Webhook Hotmart v4
// Cobre todos os 16 eventos configurados: compras, assinaturas, clube, logística, outros

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { upsertContato } from "../_shared/whatsapp-contatos.ts";
import { renderCorpoTemplate } from "../_shared/whatsapp-templates.ts";
import { custoTemplateUsd } from "../_shared/whatsapp-custos.ts";
import { janelaAbertaPara } from "../_shared/whatsapp-janela.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const HOTMART_TOKEN = Deno.env.get("HOTMART_WEBHOOK_TOKEN");

// WhatsApp Cloud API — boas-vindas automáticas pra quem compra o MCV.
const WHATSAPP_TOKEN          = Deno.env.get("FB_ACCESS_TOKEN_PERMANENTE");
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
const WHATSAPP_GRUPO_LINK_MCV  = Deno.env.get("WHATSAPP_GRUPO_LINK_MCV");
const PRODUTO_ID_MCV            = "3400278";

// Mapeamento de evento → status na tabela vendas
const STATUS_MAP: Record<string, string> = {
  // Compras
  PURCHASE_APPROVED:             "aprovada",
  PURCHASE_COMPLETE:             "aprovada",
  PURCHASE_REFUNDED:             "reembolsada",
  PURCHASE_CANCELED:             "cancelada",
  PURCHASE_EXPIRED:              "cancelada",
  PURCHASE_CHARGEBACK:           "chargeback",
  PURCHASE_PROTEST:              "protesto",
  PURCHASE_DELAYED:              "pendente",
  PURCHASE_ABANDONED:            "recuperacao",
  PURCHASE_OUT_OF_SHOPPING_CART: "recuperacao",
  // Assinaturas
  SUBSCRIPTION_CANCELLATION:     "cancelada",
  SUBSCRIPTION_REACTIVATED:      "aprovada",
  SUBSCRIPTION_ACTIVE:           "aprovada",
  // Clube
  CLUB_FIRST_ACCESS:             "aprovada",
  // Logística
  SHIPPING_COMPLETE:             "aprovada",
};

// Eventos que geram ou atualizam um registro em vendas
const EVENTOS_RELEVANTES = new Set(Object.keys(STATUS_MAP));

// Parser do source_sck da Hotmart (mesmo formato que sync_hotmart.py usa)
const SCK_SEP = "hQwK21wXxR";
const CLICK_ID_RE = /jLj6[a-zA-Z0-9]+/i;

function parseSck(sck: string) {
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

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Método não permitido", { status: 405 });
  }

  // Validação de token (opcional — só ativa se HOTMART_WEBHOOK_TOKEN estiver configurado)
  const tokenRecebido = req.headers.get("X-Hotmart-Webhook-Token")
    || req.headers.get("x-hotmart-hottok");
  if (HOTMART_TOKEN && tokenRecebido !== HOTMART_TOKEN) {
    return new Response("Não autorizado", { status: 401 });
  }

  // Endpoint de recuperação: reenviar a boas-vindas do MCV pra uma venda que
  // já existe em `vendas` mas nunca recebeu (ex: veio pelo hotmart-backfill,
  // não pelo webhook em tempo real — o backfill não dispara boas-vindas,
  // sinal real do incidente de 2026-08-24/25 documentado no CLAUDE.md).
  // Reaproveita a MESMA função (enviarBoasVindasMcv) e os MESMOS segredos que
  // o fluxo normal usa — nunca lida com o token/link em texto puro fora daqui.
  // Protegido pelo mesmo HOTMART_WEBHOOK_TOKEN acima, não é endpoint público.
  const url = new URL(req.url);
  if (url.pathname.endsWith("/reenviar-boas-vindas")) {
    let body: any;
    try { body = await req.json(); } catch { return new Response("Payload inválido", { status: 400 }); }
    const transactionId = body?.transactionId;
    if (!transactionId) {
      return new Response(JSON.stringify({ erro: "transactionId é obrigatório" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }
    const { data: venda } = await supabase
      .from("vendas")
      .select("comprador_telefone, comprador_nome, whatsapp_boas_vindas_enviado")
      .eq("hotmart_transaction_id", transactionId)
      .single();
    if (!venda) {
      return new Response(JSON.stringify({ erro: "venda não encontrada" }), {
        status: 404, headers: { "Content-Type": "application/json" },
      });
    }
    if (venda.whatsapp_boas_vindas_enviado) {
      return new Response(JSON.stringify({ ok: true, ja_enviado: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!venda.comprador_telefone) {
      return new Response(JSON.stringify({ erro: "venda sem telefone cadastrado" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }
    await enviarBoasVindasMcv(transactionId, venda.comprador_telefone, venda.comprador_nome);
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("Payload inválido", { status: 400 });
  }

  // Normaliza payload: Hotmart pode enviar formato wrapped ({event, data:{...}})
  // ou formato flat (buyer/product/purchase direto na raiz, sem campo event).
  // No formato flat, derivamos o evento a partir de purchase.status.
  const isWrapped = !!payload?.data;
  const root = isWrapped ? payload.data : payload;

  const STATUS_TO_EVENT: Record<string, string> = {
    APPROVED:   "PURCHASE_APPROVED",
    COMPLETE:   "PURCHASE_COMPLETE",
    CANCELED:   "PURCHASE_CANCELED",
    EXPIRED:    "PURCHASE_EXPIRED",
    REFUNDED:   "PURCHASE_REFUNDED",
    CHARGEBACK: "PURCHASE_CHARGEBACK",
    PROTEST:    "PURCHASE_PROTEST",
    DELAYED:    "PURCHASE_DELAYED",
    ABANDONED:  "PURCHASE_ABANDONED",
  };

  const evento: string = payload?.event
    || STATUS_TO_EVENT[(root?.purchase?.status || "").toUpperCase()]
    || "";

  console.log("Evento recebido:", evento, isWrapped ? "(wrapped)" : "(flat)");

  // Abandono de carrinho — salva em tabela própria.
  // O nome oficial do evento no Webhook 2.0 da Hotmart é
  // PURCHASE_OUT_OF_SHOPPING_CART. O código antes checava só
  // "PURCHASE_CART_ABANDONMENT", que NÃO existe na Hotmart — por isso nenhum
  // abandono jamais caiu nesta tabela pelo webhook (os 189 registros que
  // existiam vieram de importação de CSV em 2026-06-17). Corrigido em
  // 2026-07-31 aceitando os três nomes possíveis.
  const EVENTOS_ABANDONO = new Set([
    "PURCHASE_OUT_OF_SHOPPING_CART", // oficial (Webhook 2.0)
    "PURCHASE_CART_ABANDONMENT",     // nome antigo checado aqui, mantido por segurança
    "PURCHASE_ABANDONED",            // derivado de purchase.status=ABANDONED (formato flat)
  ]);
  if (EVENTOS_ABANDONO.has(evento)) {
    const comprador = root?.buyer;
    const produto   = root?.product;
    const compra    = root?.purchase;
    // Telefone no abandono: a Hotmart não usa sempre o mesmo nome de campo, e
    // os 4 abandonos reais de 2026-07-31 chegaram sem telefone nos campos que
    // o código lia. Aqui tentamos os nomes conhecidos e, se nenhum bater,
    // varremos o payload atrás de qualquer chave com cara de telefone — assim
    // não perdemos o contato (sem telefone não existe recuperação por WhatsApp).
    const phoneCode = comprador?.checkout_phone_code || comprador?.phone_code
                   || comprador?.ddd || "";
    let   phone     = comprador?.checkout_phone || comprador?.phone
                   || comprador?.cellphone || comprador?.mobile || "";
    if (!phone) {
      const acharTelefone = (obj: unknown, prof = 0): string => {
        if (!obj || typeof obj !== "object" || prof > 4) return "";
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          if (typeof v === "string" || typeof v === "number") {
            const digitos = String(v).replace(/\D/g, "");
            if (/phone|fone|celular|cell|mobile|whats/i.test(k) && digitos.length >= 8) return String(v);
          } else if (typeof v === "object") {
            const achou = acharTelefone(v, prof + 1);
            if (achou) return achou;
          }
        }
        return "";
      };
      phone = acharTelefone(root);
    }
    // Normaliza: se já vier com DDI, respeita; senão monta com DDD e +55.
    let telefone: string | null = null;
    if (phone) {
      const so = String(phone).replace(/\D/g, "");
      telefone = so.startsWith("55") && so.length >= 12 ? `+${so}`
               : phoneCode ? `+55${String(phoneCode).replace(/\D/g, "")}${so}`
               : so.length >= 10 ? `+55${so}` : so;
    }
    // Log do formato real recebido, pra ajustar o mapeamento com precisão
    // quando aparecer um payload novo (não loga valores, só a estrutura).
    if (!telefone) {
      console.log("Abandono SEM telefone. Chaves do payload:",
        JSON.stringify({ raiz: Object.keys(root || {}), buyer: Object.keys(comprador || {}) }));
    }
    // No payload de abandono não existe o objeto `purchase`: oferta e origem
    // vêm na raiz. Lemos as duas formas pra funcionar nos dois formatos.
    const sckRaw    = compra?.origin?.sck || compra?.tracking?.source_sck
                   || root?.origin?.sck   || root?.tracking?.source_sck || "";
    const sckP      = parseSck(sckRaw);
    const email     = comprador?.email || null;

    // Hotmart reenvia webhook quando não recebe 200. Sem trava, o mesmo lead
    // entraria várias vezes e receberia a campanha de recuperação repetida.
    if (email) {
      const desde24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: jaExiste } = await supabase
        .from("abandono_carrinho")
        .select("id")
        .eq("email", email)
        .gte("created_at", desde24h)
        .limit(1);
      if (jaExiste && jaExiste.length) {
        console.log("Abandono duplicado ignorado:", email);
        return new Response(JSON.stringify({ ok: true, evento, duplicado: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    await supabase.from("abandono_carrinho").insert({
      produto_nome:  produto?.name || null,
      produto_id:    produto?.id   ? String(produto.id) : null,
      oferta_codigo: compra?.offer?.code || root?.offer?.code || null,
      nome:          comprador?.name  || null,
      email,
      telefone,
      documento:     comprador?.document || null,
      // No abandono o país vem em checkout_country (campo próprio do evento),
      // não em address como nas compras.
      pais:          comprador?.address?.country_iso
                  || root?.checkout_country?.iso || "BR",
      sck:           sckRaw || null,
      utm_source:    sckP.utm_source   || null,
      utm_campaign:  sckP.utm_campaign || null,
      meta_ad_id:    sckP.meta_ad_id   || null,
      created_at:    compra?.order_date ? new Date(compra.order_date).toISOString() : new Date().toISOString(),
      // Payload bruto pra diagnóstico. Achado em 2026-08-26: desde a semana de
      // 27/07 (quando o reconhecimento do evento PURCHASE_OUT_OF_SHOPPING_CART
      // foi corrigido e o volume real de abandono passou a entrar), ~96% dos
      // registros chegam sem telefone — e sem o payload bruto não dá pra saber
      // qual é o campo real que a Hotmart está mandando pra corrigir a extração.
      raw: payload,
    });

    // Cria o contato na aba Conversas marcado como recuperação de carrinho,
    // pra virar ação de WhatsApp com o Claudinho. A marca `origem` é o que
    // diferencia visualmente esse contato dos leads que vieram do quiz.
    // Só cria se ainda não existe: quem já conversa com a gente mantém o
    // histórico e a origem original (não vira "abandono" retroativamente).
    // Sem telefone não há como abrir conversa no WhatsApp, então o contato só
    // é criado quando ele existe. O abandono em si continua registrado e
    // aparece na aba Carrinho (dá pra recuperar por e-mail).
    if (telefone) {
      const fone = telefone.replace(/\D/g, "");
      const { data: jaTem } = await supabase
        .from("whatsapp_contatos")
        .select("telefone")
        .eq("telefone", fone)
        .limit(1);
      if (!jaTem || !jaTem.length) {
        const { error: errContato } = await supabase.from("whatsapp_contatos").insert({
          telefone:      fone,
          nome:          comprador?.name || null,
          origem:        "abandono_carrinho",
          // 'lead_novo' é o único valor aceito pra contato novo (há CHECK na
          // tabela: lead_novo | em_conversa | aluno | perdido).
          etapa:         "lead_novo",
          estagio_venda: "descoberta",
          // Não entra na fila da IA sozinho: o disparo depende de modelo
          // aprovado pela Meta e da decisão de quando acionar.
          ia_elegivel:   false,
        });
        // Falha aqui não pode passar silenciosa: o abandono já foi gravado, mas
        // sem o contato ele não vira ação de recuperação nenhuma.
        if (errContato) console.error("ERRO ao criar contato de abandono:", fone, errContato.message);
        else console.log("Contato de abandono criado:", fone);
      }
    }

    return new Response(JSON.stringify({ ok: true, evento }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Ignorar eventos que não impactam vendas (logar para debug)
  if (!evento || !EVENTOS_RELEVANTES.has(evento)) {
    console.log("Evento ignorado:", evento);
    return new Response(JSON.stringify({ ignorado: true, evento }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // CLUB_FIRST_ACCESS: sem transação, sem buyer — apenas acesso ao clube já pago.
  // Não gera registro em vendas (a compra já foi salva via PURCHASE_APPROVED).
  if (evento === "CLUB_FIRST_ACCESS") {
    const user = root?.user;
    console.log("CLUB_FIRST_ACCESS ignorado (sem transação):", user?.email);
    return new Response(JSON.stringify({ ignorado: true, evento, email: user?.email }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const compra     = root?.purchase;
  const produto    = root?.product;
  const comprador  = root?.buyer;
  const assinatura = root?.subscription;
  const comissoes: any[] = root?.commissions || [];
  const afiliados: any[] = root?.affiliates  || [];

  // Transaction ID: vem em purchase.transaction ou subscription.subscriber.code
  const transactionId = compra?.transaction
    || assinatura?.subscriber?.code
    || root?.transaction;

  if (!transactionId) {
    console.error("Transaction ID ausente no payload:", JSON.stringify(payload));
    return new Response("Transaction ID ausente", { status: 400 });
  }

  // UTMs — Hotmart v2 envia o SCK em purchase.origin.sck (não em purchase.tracking)
  const tracking  = compra?.tracking_parameters || {};
  const sck = compra?.origin?.sck || compra?.tracking?.source_sck || compra?.tracking?.src || "";
  const sckParsed = parseSck(sck);

  const utmSource   = sckParsed.utm_source   || tracking.utm_source   || compra?.src || null;
  const utmCampaign = sckParsed.utm_campaign  || tracking.utm_campaign  || null;
  const utmMedium   = sckParsed.utm_medium    || tracking.utm_medium    || null;
  const utmContent  = sckParsed.utm_content   || tracking.utm_content   || null;
  const utmTerm     = sckParsed.utm_term      || tracking.utm_term      || null;

  // Atribuição Meta: utm_content traz "nome_ad|ad_id" quando configurado com {{ad.id}}
  let metaAdId = sckParsed.meta_ad_id || null;
  if (!metaAdId && utmContent && utmContent.includes("|")) {
    const parts = utmContent.split("|");
    const adId = parts[parts.length - 1].trim();
    if (/^\d{10,}$/.test(adId)) metaAdId = adId;
  }

  // Resolver ADS interno a partir do meta_ad_id
  let adsNumero: number | null = null;
  if (metaAdId) {
    const { data: adsRow } = await supabase
      .from("ads")
      .select("numero")
      .eq("meta_ad_id", metaAdId)
      .single();
    if (adsRow) adsNumero = adsRow.numero;
  }

  const status = STATUS_MAP[evento] || "pendente";

  // Valor bruto: purchase.price ou subscription
  const valorBruto = Number(compra?.price?.value || assinatura?.plan?.recurrency_period?.amount || 0);

  // preco_oferta: original_offer_price (sem juros de parcelamento) ou valor_bruto
  const precoOferta = Number(compra?.original_offer_price?.value || compra?.hotmart_fee?.base || valorBruto);

  // Valor líquido: comissão do PRODUCER em data.commissions[], que é o repasse
  // real (já sem a taxa da Hotmart e sem a comissão de addon "Club").
  //
  // FALLBACK, só quando o payload não traz essa comissão (auditoria de
  // 2026-08-12 encontrou esse caminho, ainda que raro): antes caía no preço
  // CHEIO da compra, que em venda parcelada inclui juros do cartão — o mesmo
  // erro que fez 57 vendas do histórico precisarem de correção manual
  // (scripts/corrigir_valor_liquido.py). Agora a aproximação parte do preço
  // do PRODUTO (sem juros) menos a taxa da Hotmart, que fica muito mais perto
  // do repasse real. Continua sendo aproximação, não o valor exato: não
  // desconta a comissão do Club nem afiliado/coprodução. Se a divergência
  // aparecer de novo, rode o script de correção contra sales/commissions.
  const comissaoProdutor = comissoes.find((c: any) => c.source === "PRODUCER");
  const taxaHotmart = Number(compra?.hotmart_fee?.total || 0);
  const valorLiquido = Number(comissaoProdutor?.value ?? (precoOferta - taxaHotmart));

  // Valor do desconto de cupom: full_price (preço cheio antes do desconto) menos
  // price (o que foi de fato cobrado). 0 quando não houve desconto.
  const fullPriceVal = compra?.full_price?.value;
  const descontoCupom = (fullPriceVal != null && compra?.price?.value != null)
    ? Number(fullPriceVal) - Number(compra.price.value)
    : null;

  // Data real da compra (order_date em ms → ISO) para created_at correto
  const orderDateMs   = compra?.order_date    || compra?.approved_date;
  const approvedDateMs = compra?.approved_date || null;
  const hotmartOrderDate    = orderDateMs    ? new Date(Number(orderDateMs)).toISOString()    : null;
  const hotmartApprovedDate = approvedDateMs ? new Date(Number(approvedDateMs)).toISOString() : null;
  // created_at = data real da compra (não a data de chegada do webhook)
  const createdAt = hotmartOrderDate || new Date().toISOString();

  const { error } = await supabase.from("vendas").upsert(
    {
      hotmart_transaction_id: transactionId,
      hotmart_event:          evento,
      produto_id:             String(produto?.id || assinatura?.plan?.id || ""),
      produto_nome:           produto?.name || assinatura?.plan?.name || null,
      valor_bruto:            valorBruto,
      valor_liquido:          valorLiquido,
      status,
      metodo_pagamento:       compra?.payment?.type?.toLowerCase() || null,
      parcelas:               compra?.payment?.installments_number  || null,
      oferta_codigo:          compra?.offer?.code  || null,
      oferta_nome:            compra?.offer?.name  || null,
      is_order_bump:          compra?.order_bump?.is_order_bump ?? false,
      order_bump_parent_transaction: compra?.order_bump?.parent_purchase_transaction || null,
      desconto_cupom:         descontoCupom,
      utm_source:             utmSource,
      utm_campaign:           utmCampaign,
      utm_medium:             utmMedium,
      utm_content:            utmContent,
      utm_term:               utmTerm,
      meta_ad_id:             metaAdId,
      ads_numero:             adsNumero,
      comprador_pais:         comprador?.address?.country_iso || comprador?.locale?.country || "BR",
      comprador_estado:       comprador?.address?.state     || null,
      comprador_cidade:       comprador?.address?.city      || null,
      comprador_cep:          comprador?.address?.zipcode   || null,
      comprador_bairro:       comprador?.address?.neighborhood || null,
      comprador_end:          comprador?.address?.address   || null,
      comprador_numero:       comprador?.address?.number    || null,
      comprador_nome:         comprador?.name               || null,
      comprador_email:        comprador?.email              || null,
      comprador_telefone:     comprador?.checkout_phone || comprador?.phone || comprador?.mobile_phone || null,
      comprador_cpf:          comprador?.document || null,
      hotmart_fee:            compra?.hotmart_fee?.total ? Number(compra.hotmart_fee.total) : null,
      preco_oferta:           precoOferta,
      cupom_codigo:           compra?.coupon?.code || null,
      motivo_recusa:          compra?.card_decline_reason || compra?.payment?.card_decline_reason || null,
      produto_garantia:       produto?.warranty_date ? new Date(produto.warranty_date).toISOString() : null,
      afiliado_nome:          afiliados[0]?.name || null,
      afiliado_codigo:        afiliados[0]?.affiliate_code || null,
      is_assinatura:          !!assinatura,
      is_funil:               compra?.is_funnel ?? false,
      hotmart_order_date:     hotmartOrderDate,
      hotmart_approved_date:  hotmartApprovedDate,
      created_at:             createdAt,
      hotmart_raw:            payload,
    },
    { onConflict: "hotmart_transaction_id" }
  );

  if (error) {
    console.error("Erro ao salvar venda:", error.message, JSON.stringify(error));
    return new Response(JSON.stringify({ erro: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (adsNumero && status === "aprovada") {
    await verificarRegrasATP(adsNumero, metaAdId);
  }

  // Enriquecimento automático de telefone: Hotmart parou de mandar o telefone
  // no payload do webhook. Backup 1 = API de vendas da própria Hotmart (o dado
  // pode existir lá mesmo sem vir no webhook). Backup 2 = WhatsApp que o
  // comprador preencheu no quiz (quiz_leads, casando por email).
  const telefoneWebhook = comprador?.checkout_phone || comprador?.phone || comprador?.mobile_phone || null;
  let telefoneFinal = telefoneWebhook;
  if (!telefoneWebhook && status === "aprovada") {
    telefoneFinal = await enriquecerTelefone(transactionId, comprador?.email || null);
  }

  // Boas-vindas automática do MCV: só na aprovação de fato (não em reativação
  // de assinatura nem em atualização de logística), só produto MCV, só uma vez.
  const produtoIdStr = String(produto?.id || "");
  if (
    status === "aprovada" &&
    (evento === "PURCHASE_APPROVED" || evento === "PURCHASE_COMPLETE") &&
    produtoIdStr === PRODUTO_ID_MCV &&
    telefoneFinal
  ) {
    const { data: vendaAtual } = await supabase
      .from("vendas")
      .select("whatsapp_boas_vindas_enviado")
      .eq("hotmart_transaction_id", transactionId)
      .single();
    if (!vendaAtual?.whatsapp_boas_vindas_enviado) {
      await enviarBoasVindasMcv(transactionId, telefoneFinal, comprador?.name || null);
    }
  }

  console.log("Venda salva:", transactionId, status, "ADS:", adsNumero);
  return new Response(
    JSON.stringify({ ok: true, transaction: transactionId, status, adsNumero }),
    { headers: { "Content-Type": "application/json" } }
  );
});

const HOTMART_CLIENT_ID     = Deno.env.get("HOTMART_CLIENT_ID");
const HOTMART_CLIENT_SECRET = Deno.env.get("HOTMART_CLIENT_SECRET");

async function hotmartToken(): Promise<string | null> {
  if (!HOTMART_CLIENT_ID || !HOTMART_CLIENT_SECRET) return null;
  try {
    const creds = btoa(`${HOTMART_CLIENT_ID}:${HOTMART_CLIENT_SECRET}`);
    const r = await fetch("https://api-sec-vlc.hotmart.com/security/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type":  "application/x-www-form-urlencoded",
        "Authorization": `Basic ${creds}`,
      },
      body: "grant_type=client_credentials",
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j.access_token || null;
  } catch (e) {
    console.error("hotmartToken erro:", e);
    return null;
  }
}

async function buscarTelefoneHotmart(transactionId: string): Promise<string | null> {
  const token = await hotmartToken();
  if (!token) return null;
  try {
    const r = await fetch(
      `https://developers.hotmart.com/payments/api/v1/sales/users?transaction=${transactionId}`,
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
    );
    if (!r.ok) return null;
    const data = await r.json();
    const items = data?.items || [];
    for (const item of items) {
      const buyer = item?.buyer || {};
      const phone = buyer.checkout_phone || buyer.phone || buyer.mobile_phone;
      if (phone) return String(phone).trim();
    }
    return null;
  } catch (e) {
    console.error("buscarTelefoneHotmart erro:", e);
    return null;
  }
}

async function buscarWhatsappQuiz(email: string | null): Promise<string | null> {
  if (!email) return null;
  try {
    const { data } = await supabase
      .from("quiz_leads")
      .select("whatsapp")
      .ilike("email", email)
      .not("whatsapp", "is", null)
      .limit(1)
      .single();
    return data?.whatsapp ? String(data.whatsapp).trim() : null;
  } catch {
    return null;
  }
}

async function enriquecerTelefone(transactionId: string, email: string | null): Promise<string | null> {
  let telefone = await buscarTelefoneHotmart(transactionId);
  let fonte = "hotmart_api";
  if (!telefone) {
    telefone = await buscarWhatsappQuiz(email);
    fonte = "quiz";
  }
  if (!telefone) {
    console.log("Enriquecimento de telefone: nada encontrado (nem Hotmart nem quiz) para", transactionId);
    return null;
  }
  const { error } = await supabase
    .from("vendas")
    .update({ comprador_telefone: telefone })
    .eq("hotmart_transaction_id", transactionId);
  if (error) {
    console.error("Erro ao salvar telefone enriquecido:", error.message);
  } else {
    console.log(`Telefone enriquecido (${fonte}):`, transactionId, telefone);
  }
  return telefone;
}

function normalizarTelefoneWhatsapp(raw: string): string {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (!d.startsWith("55")) d = "55" + d;
  return d;
}

// Dispara o template boas_vindas_mcv (Utilidade, aprovado no Meta) via
// Cloud API e registra em whatsapp_mensagens. Idempotente: quem chama já
// checou vendas.whatsapp_boas_vindas_enviado antes.
async function enviarBoasVindasMcv(transactionId: string, telefoneRaw: string, nome: string | null) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_GRUPO_LINK_MCV) {
    console.log("WhatsApp boas-vindas: credenciais ausentes, pulando.");
    return;
  }
  const to = normalizarTelefoneWhatsapp(telefoneRaw);
  const primeiroNome = (nome || "").trim().split(/\s+/)[0] || "tudo bem";
  const corpo = renderCorpoTemplate("boas_vindas_mcv", [primeiroNome, WHATSAPP_GRUPO_LINK_MCV]);

  // Janela de 24h já aberta (o lead mandou mensagem recente)? Manda como
  // texto livre em vez de template: mesmo conteúdo, sem custo nenhum. Template
  // paga sempre, não importa se a janela já está aberta ou não.
  const janelaJaAberta = await janelaAbertaPara(supabase, to);

  try {
    const body = janelaJaAberta
      ? { messaging_product: "whatsapp", to, type: "text", text: { body: corpo } }
      : {
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: "boas_vindas_mcv",
            language: { code: "pt_BR" },
            components: [{
              type: "body",
              parameters: [
                { type: "text", text: primeiroNome },
                { type: "text", text: WHATSAPP_GRUPO_LINK_MCV },
              ],
            }],
          },
        };
    const r = await fetch(`https://graph.facebook.com/v25.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok || d.error) throw new Error(d.error?.message || `whatsapp ${r.status}`);

    const custo = janelaJaAberta ? 0 : await custoTemplateUsd(supabase, "utility");
    await supabase.from("whatsapp_mensagens").insert({
      telefone: to,
      nome,
      direcao: "saida",
      tipo: janelaJaAberta ? "texto" : "template",
      corpo,
      template_nome: janelaJaAberta ? null : "boas_vindas_mcv",
      wa_message_id: d?.messages?.[0]?.id || null,
      status: "enviado",
      origem: "venda_mcv",
      raw: d,
      custo_usd: custo,
    });
    await supabase.from("vendas").update({ whatsapp_boas_vindas_enviado: true }).eq("hotmart_transaction_id", transactionId);
    const { data: vendaData } = await supabase
      .from("vendas")
      .select("created_at")
      .eq("hotmart_transaction_id", transactionId)
      .single();
    await upsertContato(supabase, to, nome, "aluno", {
      forcarEtapa: true,
      tornouAlunoEm: vendaData?.created_at || new Date().toISOString(),
    });
    console.log("Boas-vindas MCV enviada:", transactionId, to);
  } catch (err) {
    console.error("Erro ao enviar boas-vindas MCV:", err);
    await supabase.from("whatsapp_mensagens").insert({
      telefone: to, nome, direcao: "saida", tipo: "template", corpo: "boas_vindas_mcv",
      template_nome: "boas_vindas_mcv", status: "falhou", origem: "venda_mcv", raw: { erro: String(err) },
    });
  }
}

async function verificarRegrasATP(adsNumero: number, metaAdId: string | null) {
  const { data: regra } = await supabase
    .from("regras_atp")
    .select("parametros")
    .eq("codigo", "G5")
    .eq("ativo", true)
    .single();

  if (!regra || !metaAdId) return;

  const cpaLimite = regra.parametros?.cpa_limite || 207.90;

  const [{ data: i3d }, { data: i5d }] = await Promise.all([
    supabase.from("insights_cache").select("cpa").eq("meta_ad_id", metaAdId).eq("periodo", "3d").single(),
    supabase.from("insights_cache").select("cpa").eq("meta_ad_id", metaAdId).eq("periodo", "5d").single(),
  ]);

  const cpa3d = i3d?.cpa || null;
  const cpa5d = i5d?.cpa || null;

  if (cpa3d && cpa5d && cpa3d >= cpaLimite && cpa5d >= cpaLimite) {
    await supabase.from("alertas").insert({
      ads_numero:     adsNumero,
      meta_ad_id:     metaAdId,
      regra_codigo:   "G5",
      mensagem:       `G5 disparado. CPA 3d R$${cpa3d.toFixed(2)} e CPA 5d R$${cpa5d.toFixed(2)} ambos acima do limite R$${cpaLimite.toFixed(2)}.`,
      acao_tomada:    "alertado",
      dados_snapshot: { cpa3d, cpa5d, cpa_limite: cpaLimite },
    });
  }
}
