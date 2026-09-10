-- 113: tarefa da campanha para alunos (público quente), fora da meta.
-- Aplicada direto no banco em 10/09/2026; este arquivo registra o modelo para picos futuros.
insert into pico_template_tarefas (template_id, fase, trilha, titulo, criterio_pronto, offset_dias,
                                   nivel_minimo, recorrente, condicional, fonte, ordem, campos, referencias)
select template_id, fase, trilha, 'Subir campanha para alunos, público quente',
       'Público de compradores do MCV, sem quem já assina o Blindagem, vendendo a oferta de aluno. Verba separada da meta: o que vender aqui é bônus',
       offset_dias, nivel_minimo, recorrente, condicional, 'Felipe', ordem + 1,
       '[{"chave":"nome_meta","label":"Nome da campanha no Meta","tipo":"texto"},
         {"chave":"orcamento","label":"Orçamento diário","tipo":"moeda","alimenta":"plano.verba_alunos_dia"},
         {"chave":"publico","label":"Público usado","tipo":"texto","dica":"Compradores do MCV, excluindo quem já assina o Blindagem"}]'::jsonb,
       '[]'::jsonb
  from pico_template_tarefas
 where titulo = 'Subir campanha de remarketing'
   and not exists (select 1 from pico_template_tarefas where titulo = 'Subir campanha para alunos, público quente');
