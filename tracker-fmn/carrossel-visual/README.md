# Carrossel visual, montagem a partir de peças

> Nasceu no ORG 342, em 22/10/2026, depois de quatro tentativas de montar "parecido com"
> a referência em vez de medir a referência.

O GPT desenha, este montador escreve. Nenhuma letra passa pela geração de imagem, e com
isso os três defeitos que o `IDENTIDADE-VISUAL-INDICE.md` lista como os mais repetidos
(acento sumindo em caixa alta, numeração de lista errada, ordem de leitura trocada)
deixam de existir: acento é fonte, numeração é contador, ordem é nome de arquivo.

## Como rodar

```bash
python3 montar.py  <pasta-do-carrossel>     # escreve 1.html, 2.html, ...
node     capturar.js <pasta-do-carrossel>   # fotografa cada uma em final/*.png
```

A pasta precisa ter um `carrossel.json` com `gabarito` e `slides`, mais as peças em PNG.
O `exemplo-org342.json` é o do ORG 342 inteiro, serve de modelo.

## O que se calcula sozinho (não mexer na mão)

| O que | Como |
|---|---|
| Corpo do título na placa | cada linha recebe o corpo que a faz encostar nas duas bordas da face, e o bloco todo encolhe junto se estourar a altura |
| Eyebrow e poste da capa | saem da altura real daquela placa, então placa de proporção diferente não desalinha |
| Posição da ilustração | desce até depois da última linha do texto e encolhe o quanto precisar pra parar antes do rodapé |
| Contador de bolinhas | sai do número de slides, e só aparece no miolo (nunca na capa nem no fecho) |

## Regras que vieram do 342

- **Aparar a transparência** de toda peça assim que ela chega. A sobra varia por arquivo,
  e é por isso que peças do mesmo lote aparecem em tamanhos diferentes.
- **A peça nunca vem cortada da geração.** O corte é feito aqui, posicionando a peça pra
  fora do quadro. Entre dois slides vale o eco (um objeto sai por uma borda, outro entra
  pela oposta), nunca o mesmo objeto fatiado, porque o Instagram tem respiro entre slides.
- **Medir a referência antes de montar.** Largura e topo da peça principal, respiro entre
  os blocos, corpo e entrelinha do texto, caixa da ilustração. Montar por impressão custou
  três rodadas.
- **A peça varia, a tipografia não.** É a variação da peça que deixa bonito e é a variação
  da tipografia que deixa sem padrão.
