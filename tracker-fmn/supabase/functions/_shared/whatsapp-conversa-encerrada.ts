// Detecta conversa já encerrada com despedida, pra ninguém (resposta ao vivo,
// retomada de 24h, cutucada de reação) reabrir um papo que os dois lados já
// fecharam. Achado real em 2026-10-07 com a Danielle Oliveira e o Gee: o
// Claudinho respondeu cada "Obrigada", 👍 e ❤️ com outro "Por nada", "Fica
// bem", "Tmj", e a retomada de 24h ainda cutucou a Danielle no dia seguinte
// à despedida, o que recomeçou o laço.

const PALAVRAS_DE_ASSUNTO = /link|compr|pre[cç]|valor|quanto|pag|pix|cart|parcel|boleto|quero|acesso|entrar|senha|problema|erro|ajuda|d[uú]vida|como|onde|quando|qual|modelo|contrato|blindagem|plano/i;

const ORIGENS_NOSSAS = ["ia", "ia_retomada", "ia_retomada_reacao", "manual"];

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

  const depois = linhas.slice(idx + 1).filter((m) => m.direcao === "entrada");
  // Caso 1: nossa despedida foi a última fala, e o lead só agradeceu depois.
  if (depois.length) return soAgradecimento(depois);

  // Caso 2: a última fala é nossa, e ela já era a resposta a um agradecimento
  // ("Obrigada" → "Por nada, abraço"). Não tem o que retomar.
  const antes: any[] = [];
  for (let i = idx - 1; i >= 0 && linhas[i].direcao === "entrada"; i--) antes.unshift(linhas[i]);
  return soAgradecimento(antes);
}
