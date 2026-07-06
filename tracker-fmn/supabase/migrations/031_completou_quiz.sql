-- Adiciona flag de conclusão do quiz (chegou até a tela de resultado)
alter table quiz_leads
  add column if not exists completou_quiz boolean not null default false;

create index if not exists quiz_leads_completou_quiz_idx
  on quiz_leads (completou_quiz);

comment on column quiz_leads.completou_quiz is
  'true quando o lead visualizou o resultado do diagnóstico (pós-loading)';
