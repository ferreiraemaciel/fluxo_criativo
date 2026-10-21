# Efeitos sonoros do Epidemic, e o que dá para fazer pelo conector

> Levantado em 21/10/2026, testando o conector MCP do Epidemic de ponta a ponta.
> Os WAV ficam em `sfx/` e `trilhas/`, fora do git, igual às trilhas.

## O que funciona pelo conector

| Ferramenta | Situação | Para que serve aqui |
|---|---|---|
| `SearchRecordings` | funciona | catálogo por termo, BPM, tom, clima, gênero, instrumento, com ou sem voz |
| `DownloadRecording` | funciona | faixa em WAV, e também **só a bateria, só o baixo ou só os instrumentos** (`stemType`) |
| `SearchSoundEffects` | funciona | efeito por termo e por faixa de duração |
| `DownloadSoundEffect` | funciona | efeito em WAV ou MP3 |
| `SearchSimilarToRecording` | não testado | achar parecido com uma faixa do catálogo |
| `SearchExternalReferences` | não testado | entrar por uma faixa do Spotify e achar equivalente liberado |
| `EditRecording` | **roda, mas não entrega** | ver abaixo |

## O estúdio de edição existe e está quebrado nessa ponta

`EditRecording` aceita tudo o que o estúdio do site oferece: duração alvo até 5 minutos,
`loopable` (costura própria para repetir sem emenda), `forceDuration`, regiões a preferir ou
evitar, e `requiredRegionsAtOffsets`, que obriga um trecho da original a cair num instante
exato da versão nova. O trabalho completa (`status: COMPLETED`).

O problema é na volta: `PollEditRecordingJob` devolve só o campo `edit`, que a própria API
deles marca como obsoleto, e ele vem nulo. O campo novo (`edits`) não é consultado pela
ferramenta. Sem o id da versão, `DownloadRecordingEdit` responde "Edit not found". Testado
com três versões e com uma só, e tentando usar o id do trabalho como id da edição.

**Enquanto não corrigirem:** o laço sai do nosso `trilha.py`, que mistura o começo com o que
vinha depois do fim. Ou o Felipe gera no estúdio do site e põe o arquivo na pasta.

## Os efeitos já baixados, e onde entram

| Arquivo | Duração | Onde usar |
|---|---|---|
| `sfx/riser-whoosh-curto.wav` | 3,59 s | nos instantes antes da tarja entrar, puxa a tensão |
| `sfx/impact-percussivo.wav` | 2,15 s | no travamento do número, junto do tempo forte |
| `sfx/boom-cinematico.wav` | 2,80 s | na entrada do BLACK FRIDAY, no fecho |

Regra de mistura: efeito entra entre 6 e 9 dB abaixo da trilha, senão rouba o beat em vez de
marcar. Tudo cai no mesmo tempo forte que a imagem já usa, nunca num ponto solto.

## Identificadores que vale guardar

| O que | id |
|---|---|
| In It (Instrumental), Kadant, 98 BPM, 189,5 s | `96dfee2f-3e18-3722-b85a-24f2bc58c9f4` |
| Impact, Percussive, Simple Hit | `8810519e-df1c-4839-9869-772ec64cb766` |
| Riser, Transition, Whoosh, Fast, Short 02 | `fc7fc7a3-57a4-47fa-9172-028fd3ec73d9` |
| Boom, Cinematic, Deep | `2f0a40ab-f23a-4927-a911-1d70459d52e7` |

Licença segue a assinatura da conta. Conferir antes de publicar cada peça.
