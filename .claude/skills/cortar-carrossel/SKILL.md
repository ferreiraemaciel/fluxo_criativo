---
name: cortar-carrossel
description: Corta a tira larga exportada do Canva (o carrossel inteiro numa imagem só, lado a lado) em slides soltos de 1080x1350 em JPG de alta qualidade, descarta as fatias em branco, numera em sequência, copia para a pasta do card no Google Drive e importa no Tracker FMN. Use quando o Felipe disser "corta esse carrossel", "fatia essa imagem", "separa em cards", "corta em sete cards", ou mandar um PNG largo de carrossel do Canva.
---

# Cortar carrossel

O Canva exporta o carrossel inteiro numa imagem só, com os slides lado a lado.
Esta skill corta essa tira em slides soltos no tamanho oficial do Meta, sem
perder qualidade, e entrega no card do Tracker.

O corte é matemática pura e fica com o script. O julgamento é meu: conferir a
divisão, olhar os slides gerados e decidir o que é fatia em branco.

---

## Passo 1. Ver o material antes de cortar

Ler as dimensões de cada arquivo:

```bash
sips -g pixelWidth -g pixelHeight "ARQUIVO.png"
```

A conta precisa fechar: **largura da tira dividida pela largura de um slide tem
que dar um número inteiro**. Slide padrão do projeto é 1080x1350 (4:5, regra
global de formato), então uma tira de 7 slides tem 7560 de largura.

Se não fechar, **parar e avisar o Felipe**, nunca cortar por aproximação. Corte
fora da divisa corta o texto no meio, e aí a peça inteira se perde.

## Passo 2. Perguntar o número do card

Antes de cortar, perguntar em uma linha:

```
Qual o número do card? (ex: ORG 081 ou ADS 362)
```

O número define o nome dos arquivos, a pasta do Drive e o card que vai receber
a mídia. Se o Felipe já tiver dito o número na mensagem, não perguntar de novo.

## Passo 3. Cortar

```bash
python3 .claude/skills/cortar-carrossel/scripts/fatiar.py \
  --entrada "/caminho/do/arquivo-ou-pasta" \
  --saida "/caminho/do/arquivo-ou-pasta/cards" \
  --prefixo "ORG 081 slide"
```

O script corta sem reamostrar, salva em JPG qualidade 100 sem subamostragem de
cor (o que preserva a nitidez do tipo pesado), descarta as fatias em branco e
numera em sequência contínua, mesmo quando o carrossel veio em vários PNGs.

Opções úteis: `--largura` quando o slide não for 4:5, `--manter-vazios` quando
uma fatia clara for conteúdo de verdade.

## Passo 4. Conferir com os olhos

Abrir pelo menos o primeiro, um do meio e o último com a ferramenta de leitura
de imagem. Conferir se nenhum slide ficou com pedaço do vizinho na borda, se o
texto está inteiro e se a contagem bate com o que o Felipe espera.

Contar também quantos slides sobraram depois do descarte, e dizer isso a ele.
Tira de 14 fatias que vira carrossel de 10 é normal, o Canva deixa o resto da
última prancheta em branco.

## Passo 5. Drive e Tracker

Copiar os slides para a pasta sincronizada do card no Mac. A conta de serviço
não consegue subir arquivo (sem cota), então é `cp` na pasta local mesmo:

```bash
BASE=~/Library/CloudStorage/GoogleDrive-ferreiraemacielfoto@gmail.com/"Meu Drive"/"Fotografia é o Meu Negócio"/Tracker
# Orgânico
cp cards/*.jpg "$BASE/Orgânico/ORG 081 "*/
# Anúncios
cp cards/*.jpg "$BASE/Criativos/ADS 362 "*/
```

Esperar o Drive sincronizar e importar no card:

```bash
cd tracker-fmn
python3 scripts/adicionar-criativo-organico.py --numero 81 --auto   # ORG
python3 scripts/adicionar-criativo.py --numero 362 --auto           # ADS
```

Se a pasta do card ainda não existir, criar antes:

```bash
curl -s -X POST https://organico-media.blindagem-fmn.workers.dev/criar-pasta \
  -H "Content-Type: application/json" -d '{"card_id":"<uuid do card>"}'
```

(Anúncio não tem worker de criar pasta: criar com `mkdir` dentro de `Criativos`.)

## Passo 6. Entregar

Mandar os slides no chat e dizer, em poucas linhas: quantos saíram, o tamanho
final, quantas fatias em branco foram descartadas e que o card já recebeu a
mídia.

---

## Regras que não mudam

- **Nunca reamostrar.** O corte é recorte puro, sem redimensionar, senão o
  contraste do tipo pesado se perde.
- **Nunca cortar com divisão quebrada.** Avisar e parar.
- **JPG qualidade máxima, sem subamostragem de cor.**
- **Nunca alterar a proporção da arte** (regra global do projeto).
- O card não vira "feito" por causa disso, a mídia importada só avança a coluna
  conforme a regra do kanban.
