/* ================================================================
   Converte o áudio gravado pelo navegador para OGG/Opus.

   POR QUE ISSO EXISTE
   ───────────────────
   O WhatsApp recusou o áudio gravado no Chrome com esta mensagem:

     "Audio file uploaded with mimetype as audio/mp4, however on
      processing it is of type application/octet-stream."

   O Chrome grava MP4 fragmentado, e o processador do WhatsApp não
   reconhece esse arquivo. O formato que ele sempre aceita, e o único
   que vira a bolha nativa de áudio de voz (com a ondinha e o controle
   de velocidade), é OGG/Opus.

   O QUE ESTE ARQUIVO FAZ (e o que NÃO faz)
   ────────────────────────────────────────
   O Chrome já grava o som em Opus, só que embrulhado num WebM. Aqui o
   som é apenas DESEMBRULHADO do WebM e REEMBRULHADO num OGG. Não há
   recodificação: nenhum bit de áudio é recalculado, a qualidade é
   idêntica e a conversão é praticamente instantânea, mesmo em áudio
   longo. É trocar a caixa, não o conteúdo.

   Por isso não usamos biblioteca externa nem servidor de conversão:
   os dois resolveriam o mesmo problema com muito mais peça móvel.
   ================================================================ */

(function () {
  'use strict';

  /* ── Leitura de EBML (o formato de "caixinhas" do WebM) ─────────────
     Um arquivo WebM é uma árvore de elementos. Cada um começa com um ID
     e um tamanho, ambos escritos num esquema de comprimento variável:
     o primeiro bit 1 diz quantos bytes o número ocupa.                */

  function lerId(buf, pos) {
    const primeiro = buf[pos];
    if (primeiro === undefined) return null;
    let tam = 1;
    if      (primeiro & 0x80) tam = 1;
    else if (primeiro & 0x40) tam = 2;
    else if (primeiro & 0x20) tam = 3;
    else if (primeiro & 0x10) tam = 4;
    else return null;                       // fora do padrão: aborta
    let id = 0;
    for (let i = 0; i < tam; i++) id = (id * 256) + buf[pos + i];
    return { id, prox: pos + tam };
  }

  function lerTamanho(buf, pos) {
    const primeiro = buf[pos];
    if (primeiro === undefined) return null;
    let tam = 0;
    for (let i = 0; i < 8; i++) {
      if (primeiro & (0x80 >> i)) { tam = i + 1; break; }
    }
    if (!tam) return null;
    // Tira o bit marcador do primeiro byte.
    let valor = primeiro & (0xFF >> tam);
    let todosUns = valor === (0xFF >> tam);
    for (let i = 1; i < tam; i++) {
      const b = buf[pos + i];
      valor = (valor * 256) + b;
      if (b !== 0xFF) todosUns = false;
    }
    // Tamanho "todo 1" significa desconhecido. Acontece de verdade: o
    // navegador está gravando ao vivo e ainda não sabe onde termina.
    return { valor: todosUns ? null : valor, prox: pos + tam };
  }

  // IDs que interessam.
  const SEGMENT = 0x18538067, TRACKS = 0x1654AE6B, TRACK_ENTRY = 0xAE;
  const TRACK_NUMBER = 0xD7, CODEC_ID = 0x86, CODEC_PRIVATE = 0x63A2;
  const CLUSTER = 0x1F43B675, SIMPLE_BLOCK = 0xA3, BLOCK_GROUP = 0xA0, BLOCK = 0xA1;
  const MASTERS = new Set([SEGMENT, TRACKS, TRACK_ENTRY, CLUSTER, BLOCK_GROUP]);

  /* Percorre o WebM e devolve o cabeçalho do Opus e os pacotes de som. */
  function extrairOpus(buf) {
    let trilhaOpus = null;
    let cabecalho = null;           // OpusHead, guardado pelo navegador
    const pacotes = [];
    // Cada trilha tem um número; num arquivo só de áudio é sempre a mesma,
    // mas conferir evita misturar som com qualquer outra coisa.
    let trilhaAtual = null, codecAtual = null, privadoAtual = null;

    function percorrer(inicio, fim) {
      let pos = inicio;
      while (pos < fim) {
        const idInfo = lerId(buf, pos);
        if (!idInfo) return;
        const tamInfo = lerTamanho(buf, idInfo.prox);
        if (!tamInfo) return;
        const corpo = tamInfo.prox;
        const tamanho = tamInfo.valor === null ? (fim - corpo) : tamInfo.valor;
        const termino = Math.min(corpo + tamanho, fim);

        if (idInfo.id === TRACK_ENTRY) {
          trilhaAtual = codecAtual = privadoAtual = null;
          percorrer(corpo, termino);
          if (codecAtual === 'A_OPUS' && trilhaOpus === null) {
            trilhaOpus = trilhaAtual;
            cabecalho = privadoAtual;
          }
        } else if (MASTERS.has(idInfo.id)) {
          percorrer(corpo, termino);
        } else if (idInfo.id === TRACK_NUMBER) {
          let n = 0;
          for (let i = corpo; i < termino; i++) n = (n * 256) + buf[i];
          trilhaAtual = n;
        } else if (idInfo.id === CODEC_ID) {
          codecAtual = String.fromCharCode(...buf.subarray(corpo, termino)).replace(/\0+$/, '');
        } else if (idInfo.id === CODEC_PRIVATE) {
          privadoAtual = buf.subarray(corpo, termino);
        } else if (idInfo.id === SIMPLE_BLOCK || idInfo.id === BLOCK) {
          // Bloco = número da trilha (variável) + 2 bytes de tempo + 1 de
          // sinalizadores + o pacote Opus puro.
          const t = lerTamanho(buf, corpo);
          if (t && (trilhaOpus === null || t.valor === trilhaOpus)) {
            const dados = corpo + (t.prox - corpo) + 3;
            if (dados < termino) pacotes.push(buf.subarray(dados, termino));
          }
        }
        pos = termino;
        if (termino <= corpo) return;   // proteção contra laço infinito
      }
    }

    percorrer(0, buf.length);
    return { cabecalho, pacotes };
  }

  /* ── Duração de cada pacote ────────────────────────────────────────
     O OGG precisa saber quantas amostras já passaram em cada página,
     senão o player não consegue mostrar a duração nem arrastar a barra.
     O primeiro byte do pacote Opus (o "TOC") diz o tamanho do quadro e
     quantos quadros vêm dentro.                                       */
  function amostrasDoPacote(pacote) {
    if (!pacote.length) return 0;
    const toc = pacote[0];
    const config = toc >> 3;
    const ms = config < 12 ? [10, 20, 40, 60][config & 3]
             : config < 16 ? [10, 20][config & 1]
             :               [2.5, 5, 10, 20][config & 3];
    const c = toc & 3;
    const quadros = c === 0 ? 1 : c === 1 || c === 2 ? 2
                  : (pacote[1] !== undefined ? (pacote[1] & 0x3F) : 1);
    return Math.round(ms * quadros * 48);   // Opus sempre reporta em 48 kHz
  }

  /* ── Escrita do OGG ────────────────────────────────────────────────
     O OGG usa um CRC próprio (sem espelhamento de bits), calculado com
     o campo do próprio CRC zerado. Tabela montada uma vez só.         */
  const TABELA_CRC = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let r = i << 24;
      for (let j = 0; j < 8; j++) r = (r & 0x80000000) ? ((r << 1) ^ 0x04c11db7) : (r << 1);
      t[i] = r >>> 0;
    }
    return t;
  })();

  function crcOgg(bytes) {
    let r = 0;
    for (let i = 0; i < bytes.length; i++) {
      r = ((r << 8) ^ TABELA_CRC[((r >>> 24) & 0xFF) ^ bytes[i]]) >>> 0;
    }
    return r >>> 0;
  }

  /* A tabela de segmentos do OGG guarda cada tamanho em UM byte, então um
     pacote maior que 255 precisa ser fatiado: várias fatias de 255 e a
     última menor que isso, que é o que marca o fim do pacote. Quando o
     tamanho é múltiplo exato de 255, entra uma fatia de tamanho zero só
     para dizer "acabou".

     Isso não é detalhe teórico: os pacotes que o Chrome grava têm perto de
     mil bytes. Sem o fatiamento, o tamanho era truncado para o resto da
     divisão por 256 e o arquivo saía irrecuperável, com aparência de OGG
     válido (foi exatamente o que aconteceu na primeira versão).          */
  function tabelaDeSegmentos(pacote) {
    const tamanhos = [];
    let resto = pacote.length;
    while (resto >= 255) { tamanhos.push(255); resto -= 255; }
    tamanhos.push(resto);   // sempre entra, inclusive quando é zero
    return tamanhos;
  }

  function montarPagina(pacote, tipo, granulo, serial, sequencia) {
    const tamanhos = tabelaDeSegmentos(pacote);
    const pagina = new Uint8Array(27 + tamanhos.length + pacote.length);
    const dv = new DataView(pagina.buffer);
    pagina.set([0x4F, 0x67, 0x67, 0x53], 0);          // "OggS"
    pagina[4] = 0;                                     // versão
    pagina[5] = tipo;                                  // 2 = início, 4 = fim
    // Granulo em 64 bits, little endian, escrito em duas metades porque
    // o número de amostras passa de 2^32 em áudio longo.
    dv.setUint32(6,  granulo >>> 0, true);
    dv.setUint32(10, Math.floor(granulo / 4294967296), true);
    dv.setUint32(14, serial, true);
    dv.setUint32(18, sequencia, true);
    dv.setUint32(22, 0, true);                         // CRC entra depois
    pagina[26] = tamanhos.length;
    let p = 27;
    for (const t of tamanhos) pagina[p++] = t;
    pagina.set(pacote, p);
    dv.setUint32(22, crcOgg(pagina), true);
    return pagina;
  }

  function textoParaBytes(txt) {
    return new Uint8Array([...txt].map(c => c.charCodeAt(0)));
  }

  function montarOgg(cabecalho, pacotes) {
    // Serial identifica o fluxo dentro do arquivo. Um número qualquer serve,
    // desde que seja o mesmo em todas as páginas.
    const serial = (Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;
    const paginas = [];
    let seq = 0;

    paginas.push(montarPagina(cabecalho, 2, 0, serial, seq++));

    // OpusTags: obrigatório pelo formato, mesmo vazio.
    const fornecedor = textoParaBytes('Tracker FMN');
    const tags = new Uint8Array(8 + 4 + fornecedor.length + 4);
    tags.set(textoParaBytes('OpusTags'), 0);
    new DataView(tags.buffer).setUint32(8, fornecedor.length, true);
    tags.set(fornecedor, 12);
    new DataView(tags.buffer).setUint32(12 + fornecedor.length, 0, true); // 0 comentários
    paginas.push(montarPagina(tags, 0, 0, serial, seq++));

    // Um pacote por página mantém o código simples e é o que os players
    // esperam de áudio de voz. O ganho de juntar vários seria irrelevante
    // no tamanho de arquivo que a gente manda.
    let granulo = 0;
    for (let i = 0; i < pacotes.length; i++) {
      granulo += amostrasDoPacote(pacotes[i]);
      const ultimo = i === pacotes.length - 1;
      paginas.push(montarPagina(pacotes[i], ultimo ? 4 : 0, granulo, serial, seq++));
    }
    return new Blob(paginas, { type: 'audio/ogg' });
  }

  /* ── Porta de entrada ──────────────────────────────────────────────
     Recebe o Blob gravado em WebM/Opus e devolve um Blob OGG/Opus.
     Devolve null quando o arquivo não é o esperado, pra quem chamou
     decidir o que fazer em vez de mandar um arquivo quebrado.        */
  window.webmOpusParaOgg = async function (blob) {
    try {
      const buf = new Uint8Array(await blob.arrayBuffer());
      const { cabecalho, pacotes } = extrairOpus(buf);
      if (!cabecalho || cabecalho.length < 19 || !pacotes.length) return null;
      // Confere a assinatura do cabeçalho: se não for OpusHead, o áudio não
      // é Opus e reembrulhar geraria um arquivo inválido.
      if (String.fromCharCode(...cabecalho.subarray(0, 8)) !== 'OpusHead') return null;
      return montarOgg(cabecalho, pacotes);
    } catch (e) {
      console.warn('[audio-ogg] não consegui converter:', e);
      return null;
    }
  };
})();
