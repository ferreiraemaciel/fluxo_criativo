# Regras do Kanban do Orgânico

> Combinado com Felipe em 2026-08-06. Mesma lógica já aplicada no Kanban de Anúncios:
> "Copy" e "Produção" deixaram de ser colunas e viraram uma sub-etapa (tag) dentro
> da coluna de trabalho. Menos colunas, e o estágio da peça fica visível no card.

## As 4 colunas

| Coluna | O que significa | Como o card ENTRA | Como o card SAI |
|---|---|---|---|
| **Fazendo** | Em construção. É onde a peça nasce e onde vive enquanto está sendo escrita ou produzida. | Card criado (padrão). | Automático pra **Feito**, assim que recebe qualquer mídia (importação do Drive ou upload). |
| **Feito** | A arte está pronta e a peça espera data. É a fila de postagem. | Recebeu mídia estando em Fazendo. | Manual: ao agendar (vai pra Agendado) ou publicar na hora (vai direto pra Arquivado). |
| **Agendado** | Tem data e hora marcadas. O robô publica sozinho no horário. | Ao confirmar o agendamento (pelo card ou clicando numa data do calendário). | Automático pra **Arquivado** quando o robô publica. Se o agendamento for cancelado, volta pra Feito. |
| **Arquivado** | Já foi publicado. Fica como histórico e pra medir desempenho. | Publicação concluída (imediata ou agendada). | Não sai sozinho. Só manualmente, se for reaproveitar a peça. |

## A sub-etapa dentro de "Fazendo": Copy e Produção

Dentro de **Fazendo**, o card mostra um ícone pequeno no canto superior direito que
indica em que pé está a peça. Clicar nele alterna, em ciclo:

**sem etapa → Copy (lápis, roxo) → Produção (claquete, verde) → sem etapa**

- **Copy**: ainda escrevendo (headline, roteiro, legenda).
- **Produção**: texto pronto, agora é gravar/desenhar a peça.
- **Sem etapa**: card recém-criado, ainda não classificado.

**A etapa só existe em Fazendo.** Ao sair dessa coluna (arrastando ou por avanço
automático), ela é limpa sozinha — senão o card carregaria pra sempre a marca de um
estágio que já passou. Isso é garantido em dois lugares: no arrastar-e-soltar e no
salvamento do card.

## O que acontece sozinho (sem você mexer)

1. **Fazendo → Feito**: assim que qualquer mídia é gravada no card. Vale pra
   qualquer forma de anexar (Importar direto, Importar com link, upload manual),
   porque a regra está no ponto por onde todas passam. **É o único avanço
   automático do fluxo** — de Feito em diante, quem decide é você.
2. **Agendado → Arquivado**: quando o robô publica no horário marcado.
3. **Agendado → Feito**: se a publicação agendada falhar ou for cancelada.
4. **Criação da pasta no Drive**: ao criar o card, a pasta `ORG NNN Nome` é criada
   na raiz do Orgânico. Também é garantida ao abrir qualquer card que ainda não
   tenha pasta (rede de segurança pra aba desatualizada e cards antigos).

## O número do card (ORG NNN) — regras duras

O número é a chave que liga o card à pasta dele no Drive. A importação encontra
a pasta **pelo número**, então qualquer instabilidade nele vira mídia errada no
card. Por isso o banco garante três coisas (migrações 103 e 104):

1. **Todo card nasce com número**, não importa por onde entre: tela, script,
   importação em lote, outra sessão. A regra vive num gatilho do banco, não no
   frontend — assim não existe caminho que escape dela.
2. **O número nunca muda depois de criado.** Tentar alterar dá erro no banco.
   O nome da pasta no Drive é congelado quando ela é criada; mudar o número
   depois quebraria o par card↔pasta na hora.
3. **Número liberado nunca é reaproveitado.** Apagar um card NÃO apaga a pasta
   dele no Drive. Se o número voltasse a circular, o próximo card herdaria a
   pasta (e a arte) do card apagado, e a importação traria conteúdo errado sem
   avisar. Buraco na numeração é só estética; adotar pasta alheia é erro de
   conteúdo. Um índice único no banco impede dois cards com o mesmo número.

**Nunca calcular o número pela posição do card na lista.** Foi a origem do bug
de 2026-08-07: apagar qualquer card renumerava todos os seguintes enquanto os
nomes das pastas ficavam congelados, e o ORG 033 acabou importando a imagem da
pasta de outro card. A tela e o worker leem o número gravado, e ponto.

## A coluna "Agendado" só aceita card com horário marcado

Card em "Agendado" sem data e hora gravadas é invisível para o robô: ele fica
parado ali para sempre e o quadro mostra tudo em ordem. Foi assim que o ORG 039
passou do domingo (2026-08-09) sem publicar e sem ninguém perceber.

Por isso:

1. **A única porta para "Agendado" é Publicar > Agendar** dentro do card. É o
   único caminho que grava o horário e a cópia da mídia que o robô vai usar.
2. **Arrastar o card para a coluna não agenda nada.** A coluna recusa o card e
   explica o caminho certo, em vez de aceitar um estado que não funciona.
3. **Rede de segurança no robô:** a cada rodada (15 em 15 minutos), ele procura
   cards em "Agendado" sem horário ou sem mídia e marca erro no card. O aviso
   vermelho faz o problema aparecer no mesmo dia, em vez de na semana seguinte.

## Publicar espera a mídia ficar pronta

O Instagram não publica direto: primeiro ele baixa o arquivo e monta um
"container", depois publica. Publicar cedo demais devolve "A mídia não está
pronta" (código 9007) e a postagem falha. Era o caso de imagem e carrossel, que
publicavam na hora, sem esperar; foi o que derrubou o ORG 029 no agendamento das
18:00 de 2026-08-10.

Hoje todo tipo de peça passa pelo mesmo caminho: espera o container ficar pronto
e, se ainda assim vier esse erro passageiro, tenta de novo até 5 vezes. Erro de
verdade (legenda grande demais, imagem fora de proporção, conta sem permissão)
falha de primeira e avisa na hora, porque insistir não mudaria o resultado.

## Legenda: 2.200 caracteres é limite, não recomendação

O Instagram recusa a publicação com legenda acima de **2.200 caracteres**
(erro 36004). Não é aviso nem corte automático: a peça simplesmente não sai.
O ORG 036 falhou no agendamento de 11/08/2026 por 12 caracteres de excesso.

Três camadas de proteção, cada uma pegando o que a anterior deixou passar:

1. **Contador no campo da legenda**, dentro do card. Fica dourado nos últimos
   150 caracteres e vermelho quando passa, dizendo quantos sobraram.
2. **Trava ao publicar e ao agendar.** O agendamento também é recusado no
   servidor, não só na tela: sem isso, o card ficaria dias parecendo certo e
   falharia sozinho no horário marcado, quando ninguém está olhando.
3. **Varredura a cada 15 minutos** nos cards já agendados. Se algum tiver
   legenda longa demais, ele fica vermelho no quadro **dias antes** da data
   marcada, com tempo de encurtar o texto.

**A legenda nunca é cortada sozinha.** Decidir o que sai do texto é decisão de
copy, não de sistema. O que o sistema faz é avisar cedo e com o número exato.

## Padrão de nome no Drive

- Pasta: `ORG NNN Tema do card`
- Arquivo único: `ORG NNN Tema do card.ext`
- Carrossel: `ORG NNN Tema do card 01.ext`, `... 02.ext` — a ordem do nome é a
  ordem dos slides na publicação.

## Histórico da mudança

**Antes:** Fazer → Produção → Postagem → Agendado → Feito (Feito = publicado).

**Depois (2026-08-06):** Fazendo → Feito → Postagem → Agendado → Arquivado.

**Depois (2026-08-07):** Fazendo → Feito → Agendado → Arquivado. A coluna
"Postagem" saiu: na prática era indistinguível de "Feito" (peça pronta esperando
data), então virava uma parada a mais sem nenhuma decisão nova pelo caminho.
Quem está pronto fica em Feito até ser agendado ou publicado.

Na migração (`100_organico_colunas_e_etapa.sql`), os cards que estavam em "Feito"
(publicados) foram para **Arquivado**, e os de "Fazer" e "Produção" foram para
**Fazendo**, sem tag — a marcação de Copy/Produção passa a ser feita à mão, card a card.

A ordem das duas atualizações importa: "Feito → Arquivado" roda ANTES de qualquer
outra, senão os já publicados se misturariam com o novo sentido de "Feito"
(peça pronta, ainda não publicada).
