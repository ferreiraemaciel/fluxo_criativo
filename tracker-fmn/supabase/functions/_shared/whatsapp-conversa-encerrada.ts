// Detecta conversa já encerrada com despedida, pra ninguém (resposta ao vivo,
// retomada de 24h, cutucada de reação) reabrir um papo que os dois lados já
// fecharam. Achado real em 2026-10-07 com a Danielle Oliveira e o Gee: o
// Claudinho respondeu cada "Obrigada", 👍 e ❤️ com outro "Por nada", "Fica
// bem", "Tmj", e a retomada de 24h ainda cutucou a Danielle no dia seguinte
// à despedida, o que recomeçou o laço.

// Inclui adiamento ("à tarde finalizo", "vou pensar", "depois vejo"): isso é
// lead quente pedindo tempo, não despedida. Achado em 14/10/2026 com o Raphael,
// que escreveu "A tarde finalizo o processo" e ficou sem o link.
const PALAVRAS_DE_ASSUNTO = /link|compr|pre[cç]|valor|quanto|pag|pix|cart|parcel|boleto|quero|acesso|entrar|senha|problema|erro|ajuda|d[uú]vida|como|onde|quando|qual|modelo|contrato|blindagem|plano|finaliz|fech|assin|vou ver|analis|revis|decid/i;

const ORIGENS_NOSSAS = ["ia", "ia_retomada", "ia_retomada_reacao", "manual"];

const TEM_PRECO = /R\$\s?\d/;

// Adiamento de quem já está decidindo: "à tarde finalizo", "vou pensar",
// "depois eu fecho". Mais estreito que PALAVRAS_DE_ASSUNTO de propósito,
// porque "boa tarde" ou "depois te conto" não são adiamento de compra.
const ADIAMENTO = /vou pensar|pensar (melhor|direitinho|com calma)|deixa eu (ver|pensar)|vou (ver|analisar|revisar) (com calma|melhor|direitinho|e te)|finalizo|(à|a) tarde (eu )?(finaliz|fech|compr|vej)|(mais tarde|depois|amanh[ãa]) (eu )?(finaliz|fech|compr|assin|vej)/i;

function terminaEmPergunta(texto: string): boolean {
  // Tira emoji e espaço do fim antes de olhar se terminou em pergunta.
  return String(texto || "").replace(/[\s\p{Extended_Pictographic}️‍]+$/u, "").endsWith("?");
}

// Texto do lead que é só agradecimento, emoji ou "vc tbm": sem pergunta, curto
// e sem nenhum assunto que peça resposta.
function soAgradecimento(msgs: any[]): boolean {
  if (!msgs.length) return false;
  if (msgs.some((m) => m.tipo && m.tipo !== "texto")) return false;
  const texto = msgs.map((m) => String(m.corpo || "")).join(" ");
  if (texto.includes("?")) return false;
  if (texto.trim().split(/\s+/).filter(Boolean).length > 15) return false;
  return !PALAVRAS_DE_ASSUNTO.test(texto);
}

// linhas: histórico em ordem cronológica (mais antiga primeiro), com
// direcao, tipo, origem e corpo.
export function conversaEncerrada(linhas: any[]): boolean {
  if (!linhas.length) return false;
  let idx = -1;
  for (let i = linhas.length - 1; i >= 0; i--) {
    if (linhas[i].direcao === "saida") { idx = i; break; }
  }
  if (idx < 0) return false;
  const nossa = linhas[idx];
  if (!ORIGENS_NOSSAS.includes(nossa.origem)) return false;
  if (terminaEmPergunta(nossa.corpo)) return false;
  // Nossa última fala trouxe o preço: o "obrigado" que vem depois é hesitação,
  // não despedida (regra "Hesitação não é recusa", 14/10/2026).
  if (TEM_PRECO.test(String(nossa.corpo || ""))) return false;

  const depois = linhas.slice(idx + 1).filter((m) => m.direcao === "entrada");
  // Caso 1: nossa despedida foi a última fala, e o lead só agradeceu depois.
  if (depois.length) return !ADIAMENTO.test(depois.map((m) => String(m.corpo || "")).join(" ")) && soAgradecimento(depois);

  // Caso 2: a última fala é nossa, e ela já era a resposta a um agradecimento
  // ("Obrigada" → "Por nada, abraço"). Não tem o que retomar.
  const antes: any[] = [];
  for (let i = idx - 1; i >= 0 && linhas[i].direcao === "entrada"; i--) antes.unshift(linhas[i]);
  return soAgradecimento(antes);
}

// Hesitação que o Claudinho tende a ler como despedida. Devolve "agradeceu"
// quando a nossa última fala trouxe o preço e o lead só agradeceu, "adiou"
// quando o lead disse que vai decidir ou finalizar depois. O aviso entra no
// fim do prompt daquela resposta, porque a regra solta no meio do prompt não
// segurou na bateria de testes: 3 de 3 respostas foram "De nada, fica à
// vontade" (caso real do Renato Bispo, 14/10/2026).
export function hesitacao(linhas: any[]): "agradeceu" | "adiou" | null {
  let idx = -1;
  for (let i = linhas.length - 1; i >= 0; i--) {
    if (linhas[i].direcao === "saida") { idx = i; break; }
  }
  if (idx < 0) return null;
  const nossa = linhas[idx];
  if (!ORIGENS_NOSSAS.includes(nossa.origem)) return null;
  const doLead = linhas.slice(idx + 1).filter((m) => m.direcao === "entrada");
  if (!doLead.length || doLead.some((m) => m.tipo && m.tipo !== "texto")) return null;
  const texto = doLead.map((m) => String(m.corpo || "")).join(" ");
  if (texto.includes("?")) return null;
  if (texto.trim().split(/\s+/).filter(Boolean).length > 25) return null;
  if (ADIAMENTO.test(texto)) return "adiou";
  if (TEM_PRECO.test(String(nossa.corpo || "")) && soAgradecimento(doLead)) return "agradeceu";
  return null;
}
