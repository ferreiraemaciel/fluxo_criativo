// Tracker FMN — transcrição de áudio recebido do lead via Groq (hospeda o
// Whisper, endpoint compatível com a API da OpenAI). Sem isso, o Claudinho só
// sabia que recebeu um áudio, não entendia o conteúdo.
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

export async function transcreverAudioGroq(midiaUrl: string): Promise<string | null> {
  if (!GROQ_API_KEY) return null;
  try {
    const audioResp = await fetch(midiaUrl);
    if (!audioResp.ok) return null;
    const bytes = await audioResp.arrayBuffer();

    const form = new FormData();
    form.append("file", new Blob([bytes], { type: "audio/ogg" }), "audio.ogg");
    form.append("model", "whisper-large-v3-turbo");
    form.append("language", "pt");
    form.append("response_format", "text");

    const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      body: form,
    });
    if (!r.ok) {
      console.error("[whatsapp-transcricao] Groq respondeu erro:", r.status, await r.text().catch(() => ""));
      return null;
    }
    const texto = (await r.text()).trim();
    return texto || null;
  } catch (err) {
    console.error("[whatsapp-transcricao] erro ao transcrever:", err);
    return null;
  }
}
