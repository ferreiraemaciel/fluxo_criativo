---
name: corte-premiere
description: Monta um corte de vídeo já pronto para importar no Adobe Premiere a partir da sequência bruta transcrita. O aluno exporta a sequência como Final Cut Pro XML e a transcrição; a skill lê a transcrição, faz a decupagem (seleção e ordem dos trechos, respeitando o objetivo do vídeo), conforma no frame certo e devolve um XML novo que relinka sozinho, com marcadores de b-roll, mais um mapa de conferência. Serve para qualquer entrevista, documentário ou depoimento, não é preso a nenhum cliente. Use quando o aluno pedir "monta o corte", "gera o XML cortado", "decupa essa entrevista", "corta pra mim no Premiere" ou equivalente.
---

# Corte Premiere — da sequência bruta ao corte pronto pra importar

## O que esta skill faz

O aluno editor monta a sequência bruta no Premiere e transcreve. A skill lê a
transcrição, **faz a decupagem** (escolhe os trechos que ficam, a ordem e o que
vira Reel, respeitando o objetivo do vídeo), e devolve um **XML novo** que o
Premiere importa e relinka sozinho, com o A-roll já cortado no frame certo, os
dois (ou N) canais de áudio linkados ao vídeo, e **marcadores de b-roll** na
régua da timeline. Entrega também um **mapa de montagem** em markdown pra o
aluno conferir as decisões sem abrir o Premiere.

A decupagem (o julgamento editorial) é feita pelo modelo. A conformação (virar
frame exato) é feita pelos scripts determinísticos desta pasta. O aluno não faz
decupagem: recebe o corte e revisa o mapa, ajustando por número de trecho.

## PASSO 0 OBRIGATÓRIO — ao ser chamada, sempre repasse os 4 passos fixos

Toda vez que o comando `/corte-premiere` for acionado, a PRIMEIRA coisa a fazer,
antes de qualquer outra ação, é exibir ao usuário o bloco abaixo, sem alterar.
Serve para o Felipe e a Amanda seguirem com facilidade, sem depender de decorar.
Só depois de mostrar o bloco é que se pede/verifica o material e segue o fluxo.

```
📋 Os 4 passos fixos (você faz no Premiere):

1. Montar a sequência bruta da entrevista.
2. Transcrever a SEQUÊNCIA montada, não os clipes soltos. Regra de ouro: é isso que faz o corte bater no frame certo.
3. Exportar a sequência: Arquivo > Exportar > Final Cut Pro XML.
4. Me mandar o XML + a transcrição + o objetivo do vídeo em uma frase, e dizer "monta o corte".

A partir daí é comigo: eu faço a decupagem, corto no frame certo e devolvo o XML pronto pra importar + o mapa de conferência.
```

## Regra de ouro (o aluno precisa seguir)

**A transcrição tem que ser da SEQUÊNCIA MONTADA, não dos clipes crus.** Só
assim o tempo da transcrição é igual ao tempo da timeline, e o corte bate no
frame certo. Se o aluno transcreveu os arquivos soltos, o corte desalinha.

## O que o aluno entrega (contrato de entrada)

1. A sequência bruta exportada como **Final Cut Pro XML**
   (`Arquivo` > `Exportar` > `Final Cut Pro XML`).
2. A **transcrição da sequência**, com timecode: JSON word-level ou `.srt`
   (o painel de Texto do Premiere exporta legenda; serve).
3. O **objetivo do vídeo** em uma frase (o que precisa ficar claro, o que evitar).

## Fluxo de execução

Passo 0. Ler `meus-produtos/.ativo` não se aplica aqui (skill de edição, não de
produto). Pedir ao aluno os 3 itens do contrato de entrada se não vierem.

Passo 1. **Radiografar o XML fonte** para entender fps, trilhas e tiling:
```
python3 .Codex/skills/corte-premiere/scripts/inspecionar.py "CAMINHO/Sequencia.xml"
```

Passo 2. **Ler a transcrição** com timecode (e, se o objetivo pedir, varrer
menções sensíveis, por exemplo marcas concorrentes):
```
python3 .Codex/skills/corte-premiere/scripts/transcricao.py --json "CAMINHO/transcricao.json" --scan "volvo,mercedes,man,iveco,daf"
```
(use `--srt` no lugar de `--json` se a transcrição for legenda.)

Passo 3. **Fazer a decupagem** (julgamento do modelo): ler o texto trecho a
trecho e decidir o que mantém, a ordem narrativa (blocos), o que sai do filme
principal e vira Reel, e a nota de b-roll de cada trecho. Aplicar sempre o
objetivo do vídeo e o Checklist Light Copy quando houver copy/narração.
Materializar isso num arquivo **EDL em JSON** (ver formato no cabeçalho de
`conformar.py`). Guardar a EDL junto do projeto (`Objetos/edl_*.json`), porque
ela vira a fonte editável do corte: ajuste pedido pelo aluno = editar a EDL e
rodar de novo.

Passo 4. **Conformar** (gera o XML + o mapa):
```
python3 .Codex/skills/corte-premiere/scripts/conformar.py --edl "CAMINHO/Objetos/edl_projeto.json"
```

Passo 5. **Validar** antes de entregar:
```
python3 .Codex/skills/corte-premiere/scripts/validar.py --xml "CAMINHO/CORTE.xml" --source "CAMINHO/Sequencia.xml"
```
Só entregar se a validação disser "SEM PROBLEMAS".

Passo 6. **Entregar**: informar o caminho do XML e do mapa, e orientar o teste
no Premiere (`Arquivo` > `Importar` o XML; conferir relink, áudio nos canais e
marcadores). Lembrar que o XML é arquivo novo, não sobrescreve o original.

## B-roll em duas camadas (padrão)

Entrega 1: A-roll cortado + marcadores de onde entra cada b-roll (a partir das
notas da decupagem) + Reels marcados. Entrega 2 (depois do aluno validar o
import): catalogar os clipes de b-roll (ffmpeg extrai quadros), achar aberturas
e posicionar o b-roll de verdade na V2. As trilhas V2/V3 já saem vazias no XML.

## Notas técnicas (para quem for mexer no motor)

- `conformar.py` detecta sozinho fps/timebase/ntsc, ticks por quadro
  (254016000000 por segundo), número de arquivos e número de trilhas de áudio.
  Assume que o áudio espelha o vídeo (padrão de clipe A/V de entrevista) e usa a
  primeira trilha de vídeo não vazia como referência do tiling.
- Reconstrói pedaço por pedaço caminhando o tiling da sequência, o que preserva
  os cortes internos de tempo morto que o editor já tinha feito.
- Copia as definições de `<file>` verbatim do XML fonte, então o relink é exato.
- As notas de b-roll viram marcadores de range (trecho), no espírito do sistema
  de aprovação por marcador que será construído no Khronus.
