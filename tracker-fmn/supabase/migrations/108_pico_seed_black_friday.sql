-- ============================================================================
-- 108_pico_seed_black_friday.sql
--
-- Conteudo do template "Black Friday", com as tarefas do retiro Fluxo 2026.
-- Fontes: playbook oficial, Gabriel Vilas Boas, Samuel (trafego),
-- Raphael (comercial), Leandro Ladeira (debriefing), casos Nobre e Priscila.
--
-- Idempotente: se o template ja existe, apaga as tarefas e regrava.
-- ============================================================================

do $$
declare
  v_tpl uuid;
begin
  select id into v_tpl from pico_templates where nome = 'Black Friday';

  if v_tpl is null then
    insert into pico_templates (nome, descricao)
    values ('Black Friday',
            'Metodo completo do retiro Fluxo 2026. Tres meses, oito fases, seis trilhas.')
    returning id into v_tpl;
  else
    delete from pico_template_tarefas where template_id = v_tpl;
  end if;

  insert into pico_template_tarefas
    (template_id, fase, trilha, titulo, criterio_pronto, offset_dias,
     nivel_minimo, fonte, condicional, recorrente, ordem)
  values
  (v_tpl, 'organizar', 'oferta', 'Definir produto principal, preço fora do pico e preço do pico', 'Os três números escritos', -70, 'e', 'playbook', null, false, 0),
  (v_tpl, 'organizar', 'oferta', 'Rodar a imaginação primária em 3 cenários', 'Conservador, alvo e otimista com vendas, ticket, investimento e faturamento', -70, 'e', 'Ladeira', null, false, 1),
  (v_tpl, 'organizar', 'oferta', 'Diagnosticar se o público é sensível a preço', 'Decidido por percentual de pagamento à vista e resposta a desconto, não por perfil', -68, 'e', 'Ladeira', null, false, 2),
  (v_tpl, 'organizar', 'oferta', 'Calcular quantos leads a meta exige', 'Vendas dividido pela taxa de conversão, entre 5% e 10%', -66, 'e', 'Samuel', null, false, 3),
  (v_tpl, 'organizar', 'oferta', 'Montar o combo item por item', 'Cada item com valor percebido declarado', -63, 'e', 'playbook', null, false, 4),
  (v_tpl, 'organizar', 'oferta', 'Responder as 7 perguntas da economia da oferta', 'Margem, custo de bônus, suporte, vagas, reembolso, ponto de equilíbrio, ancoragem', -63, 'e', 'playbook', null, false, 5),
  (v_tpl, 'organizar', 'oferta', 'Definir os bônus por velocidade', 'Cada um mirando uma janela de tempo diferente', -60, 'c', 'playbook', null, false, 6),
  (v_tpl, 'organizar', 'oferta', 'Escolher item físico e sorteio', 'Reservar cerca de 20% da verba de mídia para prêmio', -58, 'c', 'Gabriel', null, false, 7),
  (v_tpl, 'organizar', 'oferta', 'Escrever a narrativa e o manifesto', 'Os 11 movimentos, com o cenário como inimigo, nunca uma pessoa', -56, 'e', 'playbook', null, false, 8),
  (v_tpl, 'organizar', 'oferta', 'Escrever o roteiro do trailer', 'Os 6 blocos, sem falar preço, desconto nem mostrar o produto', -56, 'e', 'playbook', null, false, 9),
  (v_tpl, 'organizar', 'oferta', 'Definir o mote da campanha', 'Uma frase que se repete em toda peça e não revela a oferta', -54, 'c', 'Priscila', null, false, 10),
  (v_tpl, 'organizar', 'oferta', 'Montar a ancoragem em 6 camadas', 'Valor justo, valor do site, valor do pico, comparação banal, ROI, os 2 lugares em um ano', -52, 'e', 'playbook', null, false, 11),
  (v_tpl, 'organizar', 'oferta', 'Definir a regra de crédito para quem já comprou', 'Quanto cada comprador antigo abate', -50, 'e', 'Ladeira', null, false, 12),
  (v_tpl, 'organizar', 'conteudo', 'Ler caixinhas e comentários do perfil', 'Dores, desejos e crenças agrupados, que viram o conteúdo', -70, 'e', 'playbook', null, false, 13),
  (v_tpl, 'organizar', 'conteudo', 'Ligar o ritmo diário de publicação', 'Piso de 1 post por dia, alvo de 2', -49, 'e', 'Ladeira', null, false, 14),
  (v_tpl, 'organizar', 'conteudo', 'Preparar o objeto físico de antecipação', 'A caixa comprada, com a oferta impressa dentro', -49, 'c', 'Gabriel', null, false, 15),
  (v_tpl, 'organizar', 'trafego', 'Criar os públicos personalizados', 'Envolvimento 30/180/365, 75% de vídeo, direct, visitantes, checkout, compradores', -70, 'e', 'Samuel', null, false, 16),
  (v_tpl, 'organizar', 'trafego', 'Definir meta de CPL e tempo de captação', 'CPL do pico é de 2 a 3 vezes o normal. Captação com piso de 14 dias', -65, 'e', 'Samuel', null, false, 17),
  (v_tpl, 'organizar', 'trafego', 'Preencher a planilha de metas e orçamento', 'Verba por fase e por dia calculadas', -60, 'e', 'Samuel', null, false, 18),
  (v_tpl, 'organizar', 'comercial', 'Auditar templates aprovados hoje', 'Lista com quantos são e em qual categoria', -70, 'c', 'Raphael', null, false, 19),
  (v_tpl, 'organizar', 'comercial', 'Submeter os templates que faltam', 'A grade de 12, com a abertura escrita como utility pura e dois botões', -65, 'c', 'Raphael', null, false, 20),
  (v_tpl, 'organizar', 'comercial', 'Definir a cadência de follow', '2h, 4h, 8h a 12h com sessão aberta. Na hora, 12h, 24h, 48h com sessão fechada', -60, 'c', 'Raphael', null, false, 21),
  (v_tpl, 'organizar', 'comercial', 'Treinar a IA de atendimento para o pico', 'Oferta, preço, bônus, crédito de comprador antigo e data de encerramento', -55, 'c', 'Raphael', null, false, 22),
  (v_tpl, 'organizar', 'paginas', 'Preparar a página de inscrição', 'Nome, e-mail e WhatsApp. Sem revelar preço nem tamanho do desconto', -49, 'e', 'playbook', null, false, 23),
  (v_tpl, 'organizar', 'paginas', 'Criar o primeiro grupo de WhatsApp', 'Mínimo 5 admins com chips diferentes, aviso antifraude fixado', -49, 'e', 'playbook', null, false, 24),
  (v_tpl, 'antecipacao', 'paginas', 'Página de inscrição no ar com Page View instalado', 'Evento disparando', -42, 'e', 'Samuel', null, false, 25),
  (v_tpl, 'antecipacao', 'paginas', 'Página de obrigado com Page View e Lead', 'Os dois eventos disparando', -42, 'e', 'Samuel', null, false, 26),
  (v_tpl, 'antecipacao', 'paginas', 'Grupo vinculado na página de obrigado', 'Lead entra sem ajuda', -42, 'e', 'Samuel', null, false, 27),
  (v_tpl, 'antecipacao', 'conteudo', 'Começar a mostrar a preparação', 'Bastidor no ar, sem falar de venda', -42, 'e', 'Gabriel', null, false, 28),
  (v_tpl, 'antecipacao', 'conteudo', 'O objeto físico começa a aparecer', 'Presente nos stories, sem explicação', -42, 'c', 'Gabriel', null, false, 29),
  (v_tpl, 'antecipacao', 'conteudo', 'Aula ou live para os alunos, avisando do pico', 'Feita, com o aviso dentro', -40, 'c', 'Gabriel', null, false, 30),
  (v_tpl, 'antecipacao', 'comercial', 'Disparo para alunos e base antiga', 'Mais barato que captação nova', -35, 'c', 'Gabriel', null, false, 31),
  (v_tpl, 'antecipacao', 'comercial', 'Banner fixado nas comunidades e área de membros', 'No ar', -35, 'c', 'playbook', null, false, 32),
  (v_tpl, 'antecipacao', 'conteudo', 'Enquete de dor no stories', 'Respostas viram o conteúdo do dia seguinte', -35, 'e', 'playbook', null, false, 33),
  (v_tpl, 'antecipacao', 'oferta', 'Gravar os dois trailers', 'Um racional e um emocional', -30, 'e', 'Gabriel', null, false, 34),
  (v_tpl, 'antecipacao', 'conteudo', 'Começa a antecipação diária', 'Todo dia tem peça', -28, 'e', 'playbook', null, false, 35),
  (v_tpl, 'antecipacao', 'conteudo', 'A frase "não compre nada ainda" entra no ar', 'Publicada', -28, 'c', 'Gabriel', null, false, 36),
  (v_tpl, 'antecipacao', 'trafego', 'Subir campanha de antecipação', 'Engajamento, estrutura 1-3-3, ABO, Advantage desligado', -28, 'c', 'Samuel', null, false, 37),
  (v_tpl, 'antecipacao', 'oferta', 'Soltar o trailer', 'Distribuído na base inteira, no feed e no YouTube', -25, 'e', 'Gabriel', null, false, 38),
  (v_tpl, 'captacao', 'trafego', 'Ter os 15 criativos de captação prontos', '15 peças, entre estático e vídeo', -21, 'e', 'Samuel', null, false, 39),
  (v_tpl, 'captacao', 'trafego', 'Subir a campanha de captação', 'Leads, CBO, 4 conjuntos, mesmos anúncios em todos', -21, 'e', 'Samuel', null, false, 40),
  (v_tpl, 'captacao', 'conteudo', 'Ligar a série "comente a palavra"', 'Automação entregando o link do grupo', -21, 'e', 'playbook', null, false, 41),
  (v_tpl, 'captacao', 'comercial', 'Abrir os grupos, 200 por grupo', 'Numerados, com admins e regras publicadas', -21, 'e', 'playbook', null, false, 42),
  (v_tpl, 'captacao', 'conteudo', 'Publicar conteúdo de comparação', 'O seu produto contra as alternativas, item a item', -20, 'c', 'Gabriel', null, false, 43),
  (v_tpl, 'captacao', 'conteudo', 'Publicar conteúdo de evolução do aluno', 'A escada do básico ao avançado, e onde o produto entra', -18, 'c', 'Gabriel', null, false, 44),
  (v_tpl, 'captacao', 'trafego', 'Otimizar orçamento, todo dia', 'CPL dentro da meta, sobe 20%', -21, 'e', 'Samuel', null, true, 45),
  (v_tpl, 'captacao', 'trafego', 'Otimizar público, a cada 3 a 4 dias', 'Conjunto muito acima da meta, pausa', -21, 'c', 'Samuel', null, true, 46),
  (v_tpl, 'captacao', 'trafego', 'Otimizar criativo, a cada 2 a 3 dias', 'Sobe um novo sempre que pausar. Nunca pausar o que traz volume por estar R$ 1 a R$ 3 acima', -21, 'c', 'Samuel', null, true, 47),
  (v_tpl, 'captacao', 'conteudo', 'Uma chamada por dia, sem exceção', 'Publicada', -21, 'e', 'Gabriel', null, true, 48),
  (v_tpl, 'captacao', 'comercial', 'Vídeo de boas-vindas em cada grupo cheio', 'Gravado e enviado. Aquece e protege de golpe', -14, 'e', 'playbook', null, false, 49),
  (v_tpl, 'captacao', 'trafego', 'Conferir métricas secundárias', 'CTR acima de 2%, connect rate 70%, conversão da captura 40%, entrada no grupo 70%, abertura do e-mail 15%', -14, 'c', 'Samuel', null, false, 50),
  (v_tpl, 'aquecimento', 'trafego', 'Subir campanhas de relacionamento', 'Aquecimento e lembrete, orçamento 50/50', -16, 'c', 'Samuel', null, false, 51),
  (v_tpl, 'aquecimento', 'trafego', 'Produzir 3 a 6 vídeos de aquecimento', 'Até 5 minutos, quebra de objeção e depoimento', -16, 'c', 'Samuel', null, false, 52),
  (v_tpl, 'aquecimento', 'conteudo', 'Começar a revelar os bônus, um por vez', 'Um por dia', -16, 'e', 'Gabriel', null, false, 53),
  (v_tpl, 'aquecimento', 'conteudo', 'Ligar a contagem regressiva', '15, 10, 7, 5, 3 dias e "é amanhã"', -15, 'e', 'playbook', null, false, 54),
  (v_tpl, 'aquecimento', 'trafego', 'Programar as 6 campanhas de lembrete', 'Uma por dia, orçamento total, 00:00 às 23:59. Programar antes, nunca no dia', -15, 'c', 'Samuel', null, false, 55),
  (v_tpl, 'aquecimento', 'conteudo', 'Metralhadora de depoimentos', 'Provas novas, organizadas por objeção', -10, 'e', 'playbook', null, false, 56),
  (v_tpl, 'aquecimento', 'comercial', 'Disparo convidando para a aula 1', 'Grupos, API e e-mail', -7, 'c', 'playbook', null, false, 57),
  (v_tpl, 'aquecimento', 'oferta', 'Aula de aquecimento 1', 'Tema que chama atenção, não sobre o produto', -6, 'c', 'Gabriel', null, false, 58),
  (v_tpl, 'aquecimento', 'oferta', 'Aula de aquecimento 2', 'Feita', -5, 'c', 'Gabriel', null, false, 59),
  (v_tpl, 'aquecimento', 'paginas', 'Página de oferta especial publicada e testada', 'No ar antes do dia, com a comparação de preço', -5, 'e', 'Samuel', null, false, 60),
  (v_tpl, 'aquecimento', 'paginas', 'Checkout testado ponta a ponta', 'Compra de teste aprovada', -5, 'e', 'Samuel', null, false, 61),
  (v_tpl, 'aquecimento', 'oferta', 'Aula de aquecimento 3', 'Feita', -4, 'c', 'Gabriel', null, false, 62),
  (v_tpl, 'aquecimento', 'oferta', 'Revelar presentes e vantagens', 'Antes do preço', -3, 'e', 'Nobre', null, false, 63),
  (v_tpl, 'aquecimento', 'conteudo', 'Post de véspera, "é amanhã"', 'Publicado', -1, 'e', 'playbook', null, false, 64),
  (v_tpl, 'aquecimento', 'comercial', 'Disparo "amanhã é o grande dia"', 'Enviado', -1, 'c', 'playbook', null, false, 65),
  (v_tpl, 'grande_dia', 'oferta', 'Countdown pronto e agendado', 'Tela de 10 minutos antes da hora', 0, 'e', 'playbook', null, false, 66),
  (v_tpl, 'grande_dia', 'oferta', 'Trailer renderizado para abrir a live', 'Arquivo pronto', 0, 'e', 'playbook', null, false, 67),
  (v_tpl, 'grande_dia', 'oferta', 'Depoimentos separados por objeção', 'Não aleatórios, agrupados', 0, 'e', 'playbook', null, false, 68),
  (v_tpl, 'grande_dia', 'oferta', 'Doc de dúvidas e objeções pronto', 'Escrito antes, para responder durante', 0, 'e', 'playbook', null, false, 69),
  (v_tpl, 'grande_dia', 'oferta', 'Prêmio da primeira compra definido', 'Anunciável na abertura', 0, 'c', 'playbook', null, false, 70),
  (v_tpl, 'grande_dia', 'paginas', 'Link testado no chat, nos grupos e no envio individual', 'Os três testados', 0, 'e', 'playbook', null, false, 71),
  (v_tpl, 'grande_dia', 'oferta', 'Live de abertura', 'Roteiro de 14 blocos executado', 0, 'e', 'playbook', null, false, 72),
  (v_tpl, 'grande_dia', 'conteudo', 'Reels do grande dia', 'Vende o sonho, não o detalhe', 0, 'e', 'playbook', null, false, 73),
  (v_tpl, 'grande_dia', 'trafego', 'Subir campanha de remarketing', 'Vendas, evento Compra, CBO, mínimo 6 criativos', 0, 'e', 'Samuel', null, false, 74),
  (v_tpl, 'grande_dia', 'comercial', 'Disparos do dia da abertura', '4 a 5 na primeira edição, escalonando a temperatura', 0, 'c', 'Raphael', null, false, 75),
  (v_tpl, 'grande_dia', 'comercial', 'Atender por prioridade, não por ordem de chegada', 'Problema de pagamento, dúvida de pagamento, dúvida pontual, perdido', 0, 'e', 'Raphael', null, false, 76),
  (v_tpl, 'carrinho_aberto', 'conteudo', 'Conteúdo explicando o produto', 'Publicado. Pode ser dia de Instagram chato', 1, 'e', 'Gabriel', null, true, 77),
  (v_tpl, 'carrinho_aberto', 'conteudo', 'Provas novas todo dia', 'Publicadas', 1, 'e', 'playbook', null, true, 78),
  (v_tpl, 'carrinho_aberto', 'comercial', '1 a 2 disparos por dia', 'Enviados', 1, 'c', 'Raphael', null, true, 79),
  (v_tpl, 'carrinho_aberto', 'trafego', 'Otimizar remarketing a cada 72h', 'CPA até 50% do ticket sobe 20%. Acima disso, reduz 20%', 3, 'e', 'Samuel', null, true, 80),
  (v_tpl, 'carrinho_aberto', 'oferta', 'Primeira live de vendas', 'Conteúdo mais pitch', 3, 'c', 'Nobre', null, false, 81),
  (v_tpl, 'carrinho_aberto', 'oferta', 'Bônus relâmpago', 'Anunciado e com prazo', 5, 'c', 'playbook', null, false, 82),
  (v_tpl, 'carrinho_aberto', 'oferta', 'Segunda live de vendas', 'Novo ângulo, mesmo pitch', 7, 'c', 'Nobre', null, false, 83),
  (v_tpl, 'carrinho_aberto', 'oferta', 'Reaquecer se a venda cair', 'Live nova em vez de deixar morrer', 10, 'c', 'Gabriel', null, false, 84),
  (v_tpl, 'encerramento', 'oferta', 'Live de replay e pitch de último dia', 'Feita', 17, 'c', 'Nobre', null, false, 85),
  (v_tpl, 'encerramento', 'conteudo', 'Conteúdo avisando o último dia', 'Publicado', 18, 'e', 'Gabriel', null, false, 86),
  (v_tpl, 'encerramento', 'oferta', 'Revelar o bônus guardado para o fim', 'Anunciado só agora', 19, 'c', 'Gabriel', null, false, 87),
  (v_tpl, 'encerramento', 'oferta', 'Sorteio para quem deixou para a última hora', 'Anunciado', 19, 'c', 'Gabriel', null, false, 88),
  (v_tpl, 'encerramento', 'oferta', 'Live de encerramento', 'Com tema próprio, não só um aviso', 19, 'e', 'Gabriel', null, false, 89),
  (v_tpl, 'encerramento', 'comercial', 'Rajada final de disparos', 'Últimas horas, e carrinho abandonado', 19, 'c', 'Raphael', null, false, 90),
  (v_tpl, 'encerramento', 'oferta', 'Fechar sem prorrogar', 'Fechado no horário anunciado', 19, 'e', 'playbook', null, false, 91),
  (v_tpl, 'pos', 'debriefing', 'Preencher os 9 indicadores', 'Faturamento, vendas, ticket, leads no grupo, verba, CPL, CAC, ROAS, conversão de grupo em venda', 20, 'e', 'playbook', null, false, 92),
  (v_tpl, 'pos', 'debriefing', 'Responder as 9 perguntas', 'O que funcionou, o que não repetir, o que repetir', 20, 'e', 'playbook', null, false, 93),
  (v_tpl, 'pos', 'oferta', 'Oferta barata para quem não comprou', 'No ar', 26, 'c', 'Gabriel', null, false, 94),
  (v_tpl, 'pos', 'oferta', 'Oferta cara para quem comprou', 'Imersão, mentoria ou implementação', 26, 'c', 'Gabriel', null, false, 95),
  (v_tpl, 'pos', 'oferta', 'Evento de implementação', 'Realizado', 34, 'x', 'Gabriel', null, false, 96),
  (v_tpl, 'organizar', 'mentoria', 'Definir o formato: degustação ou produto completo', 'Escrito, com número de encontros e duração', -70, 'e', 'Ladeira', 'mentoria', false, 97),
  (v_tpl, 'organizar', 'mentoria', 'Definir o preço cheio da mentoria', 'O valor que vai ser declarado na oferta, com a justificativa', -68, 'e', 'Gabriel', 'mentoria', false, 98),
  (v_tpl, 'organizar', 'mentoria', 'Desenhar o plano de ação do mentorado', 'O que a pessoa entrega em cada etapa, não o que ela assiste', -65, 'e', 'Ladeira', 'mentoria', false, 99),
  (v_tpl, 'organizar', 'mentoria', 'Definir o calendário de encontros', 'Datas marcadas, com nome próprio, antes de vender', -63, 'e', 'Ladeira', 'mentoria', false, 100),
  (v_tpl, 'organizar', 'mentoria', 'Definir o teto de vagas', 'Quantas pessoas cabem sem quebrar a entrega', -60, 'e', 'playbook', 'mentoria', false, 101),
  (v_tpl, 'organizar', 'mentoria', 'Definir onde os encontros acontecem', 'Plataforma, gravação, e o que fica disponível depois', -58, 'c', 'Ladeira', 'mentoria', false, 102),
  (v_tpl, 'organizar', 'mentoria', 'Escrever como a mentoria aparece na oferta', 'Com valor declarado e o motivo do valor, nunca como bônus solto', -56, 'e', 'Gabriel', 'mentoria', false, 103),
  (v_tpl, 'antecipacao', 'mentoria', 'Preparar o material de apoio do primeiro encontro', 'Pronto antes de vender, não depois', -30, 'c', 'Ladeira', 'mentoria', false, 104),
  (v_tpl, 'pos', 'mentoria', 'Primeiro encontro com quem comprou', 'Realizado dentro do prazo prometido', 7, 'e', 'Ladeira', 'mentoria', false, 105);

  raise notice 'Template Black Friday: % tarefas gravadas',
    (select count(*) from pico_template_tarefas where template_id = v_tpl);
end $$;
