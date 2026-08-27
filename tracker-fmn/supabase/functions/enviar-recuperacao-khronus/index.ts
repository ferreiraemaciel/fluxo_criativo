// Tracker FMN — Enviar mensagem de Recuperação de Venda pelo número de
// suporte, via Khronus.
//
// Combinado com Felipe em 2026-08-26: o clique no ícone de WhatsApp da aba
// Funis > Recuperação de Venda não manda pela API oficial do Meta (essa é a
// linha do Claudinho) — manda pelo número de suporte do FMN, que roda pela
// Ponte do Khronus (WhatsApp Web automatizado, fora da API oficial).
//
// O Tracker não fala WhatsApp diretamente aqui: ele só grava na fila de
// envio do Khronus (schema `khronus`, banco do projeto "Blindagem", que
// hospeda os dois produtos). Quem realmente manda a mensagem é a extensão
// Ponte, instalada no perfil de Chrome com o WhatsApp Web do número de
// suporte logado, puxando essa fila e enviando pelo wa-js.
//
// Histórico que explica o formato do telefone aqui: até 2026-08-26 a Ponte
// só conseguia mandar pra quem ela já tinha visto conversando (contato com
// `wa_chat_id` preenchido), e sem isso o envio morria em "contato sem
// identificador de chat". Nesse mesmo dia a Ponte ganhou o passo de
// perguntar ao WhatsApp qual é o identificador de um número (queryExists),
// então iniciar conversa nova voltou a ser possível: basta o contato existir
// com o telefone certo, que a Ponte resolve o identificador sozinha na
// primeira tentativa de envio.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const khronus = createClient(
  Deno.env.get("KHRONUS_SUPABASE_URL")!,
  Deno.env.get("KHRONUS_SERVICE_ROLE_KEY")!,
  { db: { schema: "khronus" } },
);

// Estúdio "Fotografia é o Meu Negócio" no Khronus: é a Ponte dele que roda
// no número de SUPORTE do FMN. Corrigido em 2026-08-26 depois de uma
// mensagem sair pelo WhatsApp errado — estava apontando pro estúdio
// "Ferreira & Maciel" (o único que existia quando isso foi escrito), cuja
// Ponte roda no WhatsApp pessoal do Felipe. Ao mexer aqui, confira antes em
// khronus.crm_whatsapp_ponte_status qual número está pareado em cada
// estúdio: é ele que decide de qual WhatsApp a mensagem sai.
const STUDIO_ID = "d00109c7-84ec-4905-b39d-cbe0da66af75";

// Telefone no Khronus: NÃO dá pra adivinhar se o número canônico do WhatsApp
// tem ou não o nono dígito.
//
// Bug real de 2026-08-27: a primeira versão disso sempre removia o 9 (regra
// tirada de um comentário do Blindagem, que tinha observado contatos com 12
// dígitos). Só que "o 9 que sobra" e "o 9 que faz parte do número" são
// indistinguíveis olhando só os dígitos: Elisabete Petry é 51 92000-4406, e
// remover o 9 gerou 51 2000-4406, um número que não existe. A Ponte foi
// perguntar ao WhatsApp e voltou "esse número não tem WhatsApp", corretamente.
//
// Regra certa: guardar o número COMO ELE É (55 + DDD + 9 dígitos, quando for
// celular) e deixar o WhatsApp dizer qual é o identificador de verdade, via
// queryExists na Ponte. Na hora de PROCURAR um contato que já existe, tentar
// as duas variantes, porque contato antigo pode ter sido salvo sem o 9.
function variantesTelefoneKhronus(bruto: string): string[] {
  const digitos = String(bruto || "").replace(/\D/g, "");
  if (!digitos) return [];
  const local = digitos.startsWith("55") && digitos.length > 11 ? digitos.slice(2) : digitos;

  const variantes: string[] = [];
  if (local.length === 11 && local[2] === "9") {
    variantes.push(`55${local}`);                                  // com o 9 (o número de verdade)
    variantes.push(`55${local.slice(0, 2)}${local.slice(3)}`);      // sem o 9 (formato antigo)
  } else if (local.length === 10) {
    variantes.push(`55${local}`);                                  // já veio sem o 9
    variantes.push(`55${local.slice(0, 2)}9${local.slice(2)}`);     // com o 9 acrescentado
  } else if (local.length >= 10) {
    variantes.push(`55${local}`);
  }
  return variantes;
}

// Chamado direto pelo navegador (frontend Tracker), precisa de CORS — sem
// isso o preflight OPTIONS falha antes da requisição sair e o front só vê
// "Failed to fetch", sem detalhe nenhum do erro real.
// Coluna "Comercial" do funil de negociações do Khronus (estúdio FMN).
// Combinado com Felipe em 2026-08-27: mandar mensagem de recuperação já abre
// uma negociação do produto certo, direto nessa etapa.
const COLUNA_COMERCIAL = "8e8d5531-9092-4439-b9a7-bf18310d2b75";

// Valor da negociação por produto. O nome vem do `produto_nome` da venda ou
// do abandono de carrinho, que é texto livre da Hotmart, por isso o de-para é
// por palavra-chave e não por igualdade exata.
const PRODUTOS: { chave: RegExp; titulo: string; valor: number }[] = [
  { chave: /contrato\s*visual|\bmcv\b/i, titulo: "Modelos de Contrato Visual", valor: 297 },
  { chave: /blindagem/i,                   titulo: "Blindagem",                  valor: 397 },
  { chave: /mensagens\s*que\s*vendem/i,   titulo: "Mensagens que Vendem",       valor: 147 },
  { chave: /lightroom/i,                   titulo: "Pack Pro Lightroom",         valor: 19.9 },
  { chave: /natalin/i,                     titulo: "Cenários Natalinos",         valor: 29.9 },
  { chave: /presets/i,                     titulo: "Combo de Presets",           valor: 59.9 },
];

function produtoDaVenda(nome: string | null) {
  if (!nome) return null;
  return PRODUTOS.find((p) => p.chave.test(nome)) || null;
}

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  if (req.method !== "POST") {
    return new Response("Método não permitido", { status: 405, headers: CORS });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ erro: "Payload inválido" }), {
      status: 400, headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const telefoneRaw = body?.telefone;
  const corpo = (body?.corpo || "").trim();
  const nome = body?.nome || null;
  const produtoNome = body?.produto || null;

  if (!telefoneRaw) {
    return new Response(JSON.stringify({ erro: "telefone é obrigatório" }), {
      status: 400, headers: { "Content-Type": "application/json", ...CORS },
    });
  }
  if (!corpo) {
    return new Response(JSON.stringify({ erro: "corpo é obrigatório" }), {
      status: 400, headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const variantes = variantesTelefoneKhronus(telefoneRaw);
  if (!variantes.length) {
    return new Response(JSON.stringify({ erro: "Telefone inválido" }), {
      status: 400, headers: { "Content-Type": "application/json", ...CORS },
    });
  }
  // A primeira variante é o número como ele é de verdade. É ela que vai pra
  // fila; as outras servem só pra reconhecer contato salvo em formato antigo.
  const telefone = variantes[0];

  try {
    const { data: achados, error: erroContato } = await khronus
      .from("crm_whatsapp_contatos")
      .select("id, telefone")
      .eq("studio_id", STUDIO_ID)
      .in("telefone", variantes);
    if (erroContato) throw new Error(`Buscar contato: ${erroContato.message}`);
    const existente = (achados || [])[0];

    // Contato novo entra sem wa_chat_id de propósito: é a Ponte que descobre
    // o identificador com o WhatsApp e preenche na primeira tentativa de
    // envio. Nome de contato que já existe nunca é sobrescrito (pode já ter
    // conversa e nome próprio lá).
    let contatoId = existente?.id;
    if (!contatoId) {
      const { data: novo, error: errNovo } = await khronus
        .from("crm_whatsapp_contatos")
        .insert({ studio_id: STUDIO_ID, telefone, nome, etapa: "em_conversa" })
        .select("id")
        .single();
      if (errNovo) throw new Error(`Criar contato: ${errNovo.message}`);
      contatoId = novo.id;
    }

    const { error: errFila } = await khronus.from("crm_whatsapp_fila_envio").insert({
      studio_id: STUDIO_ID,
      contato_id: contatoId,
      telefone,
      tipo: "texto",
      corpo,
      status: "pendente",
    });
    if (errFila) throw new Error(`Enfileirar: ${errFila.message}`);

    // Negociação: a mensagem de recuperação é o começo de uma tentativa de
    // venda, então ela já nasce registrada no funil. Idempotente: se já existe
    // negociação em aberto desse produto pra essa pessoa, não cria outra
    // (mandar segunda mensagem não é segunda negociação).
    let negociacaoId: string | null = null;
    const produto = produtoDaVenda(produtoNome);
    if (produto) {
      try {
        const { data: aberta } = await khronus
          .from("crm_whatsapp_negociacoes")
          .select("id")
          .eq("studio_id", STUDIO_ID)
          .eq("contato_id", contatoId)
          .eq("titulo", produto.titulo)
          .eq("status", "pendente")
          .maybeSingle();

        if (aberta?.id) {
          negociacaoId = aberta.id;
        } else {
          const { data: nova, error: errNeg } = await khronus
            .from("crm_whatsapp_negociacoes")
            .insert({
              studio_id: STUDIO_ID,
              contato_id: contatoId,
              titulo: produto.titulo,
              valor: produto.valor,
              status: "pendente",
              coluna_id: COLUNA_COMERCIAL,
              observacoes: "Aberta automaticamente pela mensagem de recuperação de venda (Tracker FMN).",
            })
            .select("id")
            .single();
          if (errNeg) throw new Error(errNeg.message);
          negociacaoId = nova.id;
        }
      } catch (e) {
        // Negociação é registro de apoio: nunca pode derrubar o envio, que é
        // o que o Felipe realmente pediu ao clicar no botão.
        console.error("[enviar-recuperacao-khronus] negociação:", e.message);
      }
    }

    return new Response(JSON.stringify({ ok: true, contatoId, negociacaoId }), {
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (e) {
    console.error("[enviar-recuperacao-khronus] erro:", e.message);
    return new Response(JSON.stringify({ ok: false, erro: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
