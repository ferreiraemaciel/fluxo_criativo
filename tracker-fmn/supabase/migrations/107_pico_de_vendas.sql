-- ============================================================================
-- 107_pico_de_vendas.sql
--
-- Módulo Picos de Venda: planejamento e execução de Black Friday, lançamento
-- e qualquer abertura de carrinho, com as tarefas do retiro Fluxo 2026.
--
-- Conceito central: TEMPLATE (o método, com prazos em D-X) x PROJETO (uma
-- execução, com D0 real). As datas nunca são digitadas, são derivadas do D0.
-- Mudou o D0, todas as tarefas se movem juntas, exceto as travadas.
--
-- Prefixo `pico_` porque `campanhas` já existe e é das campanhas do Meta.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TEMPLATES: os métodos disponíveis
-- ----------------------------------------------------------------------------
create table if not exists pico_templates (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  descricao    text,
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now()
);

comment on table pico_templates is
  'Modelos de pico de vendas. Black Friday, lançamento, pico simples. O método, não a execução.';

-- ----------------------------------------------------------------------------
-- 2. TAREFAS DO TEMPLATE: o conteúdo do método
-- ----------------------------------------------------------------------------
create table if not exists pico_template_tarefas (
  id              uuid primary key default gen_random_uuid(),
  template_id     uuid not null references pico_templates(id) on delete cascade,
  fase            text not null,
  trilha          text not null,
  titulo          text not null,
  criterio_pronto text,
  -- Offset em dias a partir do D0. Negativo é antes, positivo é depois.
  -- D-70 grava -70; D0 grava 0; D+7 grava 7.
  offset_dias     integer not null,
  -- 'e' essencial, 'c' crescimento, 'x' escala. Quem escolhe essencial só vê 'e'.
  nivel_minimo    text not null default 'e',
  -- Tarefa que se repete durante uma janela (ex: otimizar orçamento todo dia).
  recorrente      boolean not null default false,
  -- Só entra no projeto se a decisão-gate correspondente estiver marcada.
  -- Ex: 'mentoria' só aparece se o projeto incluir mentoria na oferta.
  condicional     text,
  fonte           text,
  ordem           integer not null default 0,
  criado_em       timestamptz not null default now(),
  constraint pico_template_tarefas_nivel_check
    check (nivel_minimo in ('e','c','x')),
  constraint pico_template_tarefas_fase_check
    check (fase in ('organizar','antecipacao','captacao','aquecimento',
                    'grande_dia','carrinho_aberto','encerramento','pos')),
  constraint pico_template_tarefas_trilha_check
    check (trilha in ('oferta','conteudo','trafego','comercial','paginas',
                      'debriefing','mentoria'))
);

create index if not exists idx_pico_tt_template on pico_template_tarefas(template_id, ordem);

comment on column pico_template_tarefas.offset_dias is
  'Dias relativos ao D0 (abertura do carrinho). Negativo antes, positivo depois.';
comment on column pico_template_tarefas.condicional is
  'Se preenchido, a tarefa só entra no projeto quando a decisão de mesmo nome estiver ativa.';

-- ----------------------------------------------------------------------------
-- 3. PROJETOS: as execuções reais
-- ----------------------------------------------------------------------------
create table if not exists pico_projetos (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null,
  template_id       uuid references pico_templates(id) on delete set null,
  -- D0: o dia em que o carrinho abre. É a âncora de todas as datas.
  data_abertura     date,
  data_encerramento date,
  status            text not null default 'planejamento',
  -- Nível de operação escolhido: filtra quais tarefas aparecem.
  nivel_operacao    text not null default 'e',
  -- Ticket do pico. Usado para o CPA aceitável dos anúncios deste projeto,
  -- em vez do ticket do produto. Sem isso a regra G5 pausa anúncio saudável.
  ticket            numeric,
  cpa_limite        numeric,
  -- Plano de midia: os parametros da planilha de planejamento do retiro.
  -- Fica em jsonb porque sao muitos campos de calculo e eles evoluem.
  -- Chaves: ticket_liquido, taxa_conversao, cpl_meta, dias_captacao,
  -- dias_remarketing, imposto_meta, e o rateio por etapa em pct_*.
  plano_midia       jsonb not null default '{
    "ticket_liquido": null,
    "vendas_meta": null,
    "taxa_conversao": 0.07,
    "cpl_meta": null,
    "dias_teaser": 8,
    "dias_captacao": 14,
    "dias_aquecimento": 14,
    "dias_remarketing": 14,
    "imposto_meta": 0.1215,
    "pct_teaser": 0.04,
    "pct_aquecimento": 0.05,
    "qtd_anuncios": 20
  }'::jsonb,
  observacoes       text,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  constraint pico_projetos_status_check
    check (status in ('planejamento','em_andamento','carrinho_aberto','encerrado','arquivado')),
  constraint pico_projetos_nivel_check
    check (nivel_operacao in ('e','c','x'))
);

comment on column pico_projetos.data_abertura is
  'D0. Âncora de todas as datas do projeto. Mudar aqui recalcula as tarefas não travadas.';
comment on column pico_projetos.cpa_limite is
  'CPA aceitável dos anúncios deste pico. Sobrepõe o limite por produto das regras G1/G5.';
comment on column pico_projetos.plano_midia is
  'Parametros do plano de midia, com os valores da planilha oficial do retiro. Teaser e aquecimento tem percentual fixo; remarketing e interpolado pelos dias; captacao e o que sobra.';

-- ----------------------------------------------------------------------------
-- 4. TAREFAS DO PROJETO: cópia editável do template
-- ----------------------------------------------------------------------------
create table if not exists pico_tarefas (
  id                uuid primary key default gen_random_uuid(),
  projeto_id        uuid not null references pico_projetos(id) on delete cascade,
  -- De onde veio. Null quando a tarefa foi criada à mão no projeto.
  template_tarefa_id uuid references pico_template_tarefas(id) on delete set null,
  fase              text not null,
  trilha            text not null,
  titulo            text not null,
  criterio_pronto   text,
  offset_dias       integer not null,
  -- Calculada como data_abertura + offset_dias, exceto quando travada.
  data_prevista     date,
  -- Tarefa com data fixa (live já marcada, feriado a evitar) não se move
  -- quando o D0 muda.
  data_travada      boolean not null default false,
  data_conclusao    date,
  status            text not null default 'pendente',
  nivel_minimo      text not null default 'e',
  responsavel       text,
  entregavel_url    text,
  observacoes       text,
  ordem             integer not null default 0,
  criado_em         timestamptz not null default now(),
  constraint pico_tarefas_status_check
    check (status in ('pendente','fazendo','feito','pulada')),
  constraint pico_tarefas_nivel_check
    check (nivel_minimo in ('e','c','x'))
);

create index if not exists idx_pico_tarefas_projeto on pico_tarefas(projeto_id, data_prevista);
create index if not exists idx_pico_tarefas_status  on pico_tarefas(projeto_id, status);

-- ----------------------------------------------------------------------------
-- 5. DECISÕES-GATE: as escolhas que travam o resto
-- ----------------------------------------------------------------------------
create table if not exists pico_decisoes (
  id            uuid primary key default gen_random_uuid(),
  projeto_id    uuid not null references pico_projetos(id) on delete cascade,
  chave         text not null,
  pergunta      text not null,
  opcoes        jsonb not null default '[]'::jsonb,
  escolha       text,
  regra         text,
  justificativa text,
  fonte         text,
  ordem         integer not null default 0,
  decidido_em   timestamptz,
  constraint pico_decisoes_unicas unique (projeto_id, chave)
);

comment on column pico_decisoes.regra is
  'A regra de decisão ensinada no retiro. Ex: produto de assinatura nunca vira vitalicio.';

-- ----------------------------------------------------------------------------
-- 6. MÉTRICAS: imaginação primária e debriefing na mesma tabela
-- ----------------------------------------------------------------------------
create table if not exists pico_metricas (
  id          uuid primary key default gen_random_uuid(),
  projeto_id  uuid not null references pico_projetos(id) on delete cascade,
  -- 'imaginacao' (o plano, antes), 'meta_debrief' (a meta declarada)
  -- ou 'debriefing' (o realizado, depois).
  momento     text not null default 'imaginacao',
  -- 'conservador', 'alvo', 'otimista', ou null no debriefing.
  cenario     text,
  indicador   text not null,
  valor       numeric,
  unidade     text,
  ordem       integer not null default 0,
  constraint pico_metricas_momento_check
    check (momento in ('imaginacao','meta_debrief','debriefing'))
);

create index if not exists idx_pico_metricas_projeto on pico_metricas(projeto_id, momento, cenario);

-- ----------------------------------------------------------------------------
-- 7. AMARRAÇÃO COM O QUE JÁ EXISTE
--    Anúncio e conteúdo passam a saber a qual pico pertencem.
--    Nulo = perpétuo, e tudo segue como sempre foi.
-- ----------------------------------------------------------------------------
alter table ads
  add column if not exists pico_projeto_id uuid references pico_projetos(id) on delete set null;

alter table conteudo_organico
  add column if not exists pico_projeto_id uuid references pico_projetos(id) on delete set null;

create index if not exists idx_ads_pico       on ads(pico_projeto_id) where pico_projeto_id is not null;
create index if not exists idx_organico_pico  on conteudo_organico(pico_projeto_id) where pico_projeto_id is not null;

comment on column ads.pico_projeto_id is
  'Pico de vendas a que este anuncio pertence. Nulo = perpetuo. Quando preenchido, o CPA limite vem do projeto, nao do produto.';

-- ----------------------------------------------------------------------------
-- 8. RECALCULAR AS DATAS QUANDO O D0 MUDA
--    Tarefa travada não se move. É o que permite fixar uma live já marcada.
-- ----------------------------------------------------------------------------
create or replace function pico_recalcular_datas()
returns trigger
language plpgsql
as $$
begin
  if new.data_abertura is distinct from old.data_abertura and new.data_abertura is not null then
    update pico_tarefas
       set data_prevista = new.data_abertura + offset_dias
     where projeto_id = new.id
       and data_travada = false;
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists trg_pico_recalcular_datas on pico_projetos;
create trigger trg_pico_recalcular_datas
  before update on pico_projetos
  for each row
  execute function pico_recalcular_datas();

-- ----------------------------------------------------------------------------
-- 9. CRIAR PROJETO A PARTIR DE UM TEMPLATE
--    Copia as tarefas respeitando o nível de operação escolhido e já calcula
--    as datas. Tarefa condicional só entra se a condição estiver na lista.
-- ----------------------------------------------------------------------------
create or replace function pico_criar_projeto(
  p_nome        text,
  p_template_id uuid,
  p_abertura    date,
  p_nivel       text default 'e',
  p_condicoes   text[] default '{}'::text[]
)
returns uuid
language plpgsql
as $$
declare
  v_projeto_id uuid;
  v_niveis     text[];
begin
  -- Quem escolhe escala vê tudo; crescimento vê e+c; essencial vê só e.
  v_niveis := case p_nivel
                when 'x' then array['e','c','x']
                when 'c' then array['e','c']
                else          array['e']
              end;

  insert into pico_projetos (nome, template_id, data_abertura, nivel_operacao)
  values (p_nome, p_template_id, p_abertura, p_nivel)
  returning id into v_projeto_id;

  insert into pico_tarefas (
    projeto_id, template_tarefa_id, fase, trilha, titulo, criterio_pronto,
    offset_dias, data_prevista, nivel_minimo, ordem
  )
  select
    v_projeto_id, t.id, t.fase, t.trilha, t.titulo, t.criterio_pronto,
    t.offset_dias,
    case when p_abertura is not null then p_abertura + t.offset_dias end,
    t.nivel_minimo, t.ordem
  from pico_template_tarefas t
  where t.template_id = p_template_id
    and t.nivel_minimo = any(v_niveis)
    and (t.condicional is null or t.condicional = any(p_condicoes));

  -- As decisoes-gate do metodo. Vem sempre, independente do nivel,
  -- porque sao elas que travam todo o resto.
  insert into pico_decisoes (projeto_id, chave, pergunta, opcoes, regra, fonte, ordem)
  values
    (v_projeto_id, 'estrategia_preco',
     'Vamos dar desconto ou ancorar com mais valor?',
     '["Desconto de 30% a 50%","Ancoragem com aumento de valor"]'::jsonb,
     'Decidir pelo dado de pagamento da base: se a maioria paga a vista e quem parcela compra ticket maior, o publico nao e sensivel a preco.',
     'Ladeira', 1),
    (v_projeto_id, 'nivel_operacao',
     'Qual nivel de operacao nesta edicao?',
     '["Essencial","Crescimento","Escala"]'::jsonb,
     'Fazer o nivel de baixo bem feito antes de subir.',
     'playbook', 2),
    (v_projeto_id, 'vitalicio',
     'Vamos usar a estrategia de vitalicio?',
     '["Usar","Nao usar"]'::jsonb,
     'Produto de assinatura nunca vira vitalicio. Vender acesso para sempre de algo que e recorrencia mata a receita que sustenta o produto.',
     'Felipe', 3),
    (v_projeto_id, 'mentoria',
     'Mentoria entra na oferta?',
     '["Nao incluir","Poucos encontros como degustacao","Mentoria completa como produto"]'::jsonb,
     'Mentoria exige plano de acao e encontros marcados. Sem os dois, e curso gravado com outro nome.',
     'Ladeira', 4),
    (v_projeto_id, 'parceiros',
     'Vamos usar parceiros nesta edicao?',
     '["Sim","Nao"]'::jsonb,
     'Depender de terceiro e o item mais lento do cronograma e o unico que nao esta sob nosso controle.',
     'Felipe', 5),
    (v_projeto_id, 'duracao_carrinho',
     'Quantos dias o carrinho fica aberto?',
     '["10 dias","15 dias","20 dias","O mes inteiro"]'::jsonb,
     'Nao encerrar enquanto ainda vende. O arrependimento mais citado no retiro foi fechar cedo demais.',
     'Gabriel', 6);

  return v_projeto_id;
end;
$$;

comment on function pico_criar_projeto is
  'Cria um projeto a partir de um template, copiando as tarefas do nivel escolhido e calculando as datas a partir do D0.';

-- ----------------------------------------------------------------------------
-- 10. RLS: mesmo padrão das outras tabelas do Tracker
-- ----------------------------------------------------------------------------
alter table pico_templates        enable row level security;
alter table pico_template_tarefas enable row level security;
alter table pico_projetos         enable row level security;
alter table pico_tarefas          enable row level security;
alter table pico_decisoes         enable row level security;
alter table pico_metricas         enable row level security;

do $$
declare t text;
begin
  foreach t in array array['pico_templates','pico_template_tarefas','pico_projetos',
                           'pico_tarefas','pico_decisoes','pico_metricas']
  loop
    execute format(
      'drop policy if exists %I on %I', 'acesso_autenticado_' || t, t);
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true)',
      'acesso_autenticado_' || t, t);
  end loop;
end $$;

-- ============================================================================
-- COMO CRIAR O PRIMEIRO PROJETO (rodar depois da 108, que popula o template)
--
--   select pico_criar_projeto(
--     'Black Friday 2026',
--     (select id from pico_templates where nome = 'Black Friday'),
--     '2026-11-11'::date,   -- D0, a data em que o carrinho abre
--     'c',                  -- nivel: e essencial, c crescimento, x escala
--     array['mentoria']     -- condicionais a incluir; use '{}' para nenhuma
--   );
-- ============================================================================
