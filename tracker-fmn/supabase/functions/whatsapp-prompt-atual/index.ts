// Tracker FMN — expõe o prompt atual do Claudinho, só leitura, pra
// visualização no Tracker. Não aceita edição por aqui (o prompt só muda via
// deploy de código, isso é intencional).
import { SYSTEM_PROMPT_MCV } from "../_shared/whatsapp-ia-prompt.ts";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  return new Response(JSON.stringify({ prompt: SYSTEM_PROMPT_MCV }), { headers: { ...CORS, "content-type": "application/json" } });
});
