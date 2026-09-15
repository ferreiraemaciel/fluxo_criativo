-- 118 · Só tarefa de postagem vira card
--
-- Combinado com Felipe em 15/09/2026. Card no Orgânico é publicação: carrossel,
-- Reels, imagem, artigo, YouTube. Arte em si (marca, selo, capa, modelo, foto de
-- produto) é tarefa com check dentro do pico e nunca ganha card. Antes, toda
-- tarefa da trilha de conteúdo mostrava o botão de criar card, e onze tarefas de
-- arte da Black 2026 viraram card por engano (ORG 180 a 191).
--
-- Tráfego continua virando card de Anúncios sempre, porque anúncio é publicação.

alter table pico_template_tarefas add column if not exists gera_card boolean not null default false;
alter table pico_tarefas          add column if not exists gera_card boolean not null default false;

-- Marca como postagem o que já é publicação pelo próprio título.
update pico_template_tarefas set gera_card = true
 where trilha = 'conteudo' and titulo ~* '^(carrossel|reels|post |publicar|conteúdo)';
update pico_tarefas set gera_card = true
 where trilha = 'conteudo' and titulo ~* '^(carrossel|reels|post |publicar|conteúdo)';

-- Tarefa nova de projeto novo herda a marcação do template, sem reescrever
-- a função pico_criar_projeto.
create or replace function pico_tarefa_herda_gera_card()
returns trigger language plpgsql as $$
begin
  if new.template_tarefa_id is not null then
    select t.gera_card into new.gera_card
      from pico_template_tarefas t where t.id = new.template_tarefa_id;
    new.gera_card := coalesce(new.gera_card, false);
  end if;
  return new;
end $$;

drop trigger if exists trg_pico_tarefa_herda_gera_card on pico_tarefas;
create trigger trg_pico_tarefa_herda_gera_card
  before insert on pico_tarefas
  for each row execute function pico_tarefa_herda_gera_card();
