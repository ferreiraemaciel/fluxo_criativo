-- 116: pendência não mora dentro de tarefa que já vai receber check.
-- Os dois públicos que dependiam de outra coisa acontecer primeiro (trailer
-- publicado e página no ar) viraram tarefa própria, com data no calendário.
insert into pico_template_tarefas (template_id, fase, trilha, titulo, criterio_pronto, offset_dias,
                                   nivel_minimo, recorrente, condicional, fonte, ordem, campos, referencias)
select b.template_id, 'antecipacao', 'trafego', v.titulo, v.criterio, v.offset_dias,
       'e', b.recorrente, b.condicional, 'Felipe', v.ordem, v.campos, '[]'::jsonb
  from (select * from pico_template_tarefas where titulo = 'Subir campanha de antecipação' limit 1) b,
       (values
         ('Criar o público do trailer, 95% assistido',
          'Público de quem assistiu 95% do trailer, apontando o ID do vídeo. Público de vídeo guarda lista fixa de IDs, então vídeo novo não entra sozinho nos que já existem',
          -24, 55,
          '[{"chave":"video_id","label":"ID do vídeo do trailer","tipo":"texto","dica":"Sai do Gerenciador ou da API depois que o vídeo é publicado"},
            {"chave":"publico","label":"Nome do público criado","tipo":"texto"}]'::jsonb),
         ('Criar os públicos de visitantes da página de inscrição',
          'Visitantes de 30 e 90 dias, com o Page View já instalado e disparando',
          -41, 43,
          '[{"chave":"publico_30","label":"Público de 30 dias","tipo":"texto"},
            {"chave":"publico_90","label":"Público de 90 dias","tipo":"texto"},
            {"chave":"pixel_ok","label":"Page View disparando","tipo":"opcao","opcoes":["Sim","Ainda não"]}]'::jsonb)
       ) v(titulo, criterio, offset_dias, ordem, campos)
 where not exists (select 1 from pico_template_tarefas x where x.titulo = v.titulo);
