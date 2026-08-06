# Regras do Kanban do Orgânico

> Combinado com Felipe em 2026-08-06. Mesma lógica já aplicada no Kanban de Anúncios:
> "Copy" e "Produção" deixaram de ser colunas e viraram uma sub-etapa (tag) dentro
> da coluna de trabalho. Menos colunas, e o estágio da peça fica visível no card.

## As 5 colunas

| Coluna | O que significa | Como o card ENTRA | Como o card SAI |
|---|---|---|---|
| **Fazendo** | Em construção. É onde a peça nasce e onde vive enquanto está sendo escrita ou produzida. | Card criado (padrão). | Automático pra **Feito**, assim que recebe qualquer mídia (importação do Drive ou upload). |
| **Feito** | A arte/peça está finalizada. Existe arquivo pronto. | Recebeu mídia estando em Fazendo. | Automático pra **Postagem** quando TODOS os slides estão preenchidos. Ou manual, arrastando. |
| **Postagem** | Na fila pra postar: arte pronta e legenda escrita. Só falta escolher quando. | Todos os slides preenchidos estando em Feito. Ou manual. | Manual, ao agendar (vai pra Agendado) ou ao publicar na hora (vai direto pra Arquivado). |
| **Agendado** | Tem data e hora marcadas. O robô publica sozinho no horário. | Ao confirmar o agendamento (pelo card ou clicando numa data do calendário). | Automático pra **Arquivado** quando o robô publica. Se o agendamento for cancelado, volta pra Postagem. |
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
   porque a regra está no ponto por onde todas passam.
2. **Feito → Postagem**: quando todos os slides têm mídia.
3. **Agendado → Arquivado**: quando o robô publica no horário marcado.
4. **Agendado → Postagem**: se a publicação agendada falhar ou for cancelada.
5. **Criação da pasta no Drive**: ao criar o card, a pasta `ORG NNN Nome` é criada
   na raiz do Orgânico. Também é garantida ao abrir qualquer card que ainda não
   tenha pasta (rede de segurança pra aba desatualizada e cards antigos).

## Histórico da mudança

**Antes:** Fazer → Produção → Postagem → Agendado → Feito (Feito = publicado).

**Depois:** Fazendo → Feito → Postagem → Agendado → Arquivado.

Na migração (`100_organico_colunas_e_etapa.sql`), os cards que estavam em "Feito"
(publicados) foram para **Arquivado**, e os de "Fazer" e "Produção" foram para
**Fazendo**, sem tag — a marcação de Copy/Produção passa a ser feita à mão, card a card.

A ordem das duas atualizações importa: "Feito → Arquivado" roda ANTES de qualquer
outra, senão os já publicados se misturariam com o novo sentido de "Feito"
(peça pronta, ainda não publicada).
