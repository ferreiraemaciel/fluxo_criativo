-- Migração 104: o número do card do Orgânico nunca muda e nunca se repete
-- (2026-08-08). Fecha de vez a classe de problema que causou a importação de
-- mídia do card errado.
--
-- Sobravam dois riscos depois da 103:
--
-- 1) REAPROVEITAMENTO DE NÚMERO. A regra anterior preenchia buraco: apagou o
--    card 12, o próximo card criado virava 12 de novo. Só que apagar o card
--    NÃO apaga a pasta no Drive — então o card novo herdaria a pasta do card
--    antigo, com a arte antiga dentro, e a importação traria conteúdo errado
--    sem avisar. Agora o número é sempre max+1: buraco fica buraco pra sempre.
--    Numeração com furo é só estética; adotar pasta alheia é erro de conteúdo.
--
-- 2) NÚMERO EDITÁVEL. Nada no código muda o número hoje, mas nada impedia.
--    Como o nome da pasta no Drive é congelado no momento da criação, alterar
--    o número depois quebraria o par card↔pasta na hora. Agora o banco recusa.
--
-- Reversão:
--   drop trigger if exists trg_organico_numero_imutavel on conteudo_organico;
--   drop function if exists organico_numero_imutavel();
--   (e restaurar organico_atribui_numero da migração 103 para preencher buraco)

-- 1) Atribuição: sempre o próximo, nunca reaproveita número liberado.
create or replace function organico_atribui_numero()
returns trigger language plpgsql as $$
begin
  if new.numero is null then
    select coalesce(max(numero), 0) + 1 into new.numero from conteudo_organico;
  end if;
  return new;
end;
$$;

-- 2) Imutabilidade: depois de criado, o número é o que é.
create or replace function organico_numero_imutavel()
returns trigger language plpgsql as $$
begin
  if new.numero is distinct from old.numero then
    raise exception
      'O número do card do Orgânico não pode ser alterado (ORG % para ORG %). A pasta no Drive é encontrada por ele.',
      old.numero, new.numero;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_organico_numero_imutavel on conteudo_organico;
create trigger trg_organico_numero_imutavel
  before update on conteudo_organico
  for each row execute function organico_numero_imutavel();
