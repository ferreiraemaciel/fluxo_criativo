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
