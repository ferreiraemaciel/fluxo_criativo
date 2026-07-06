-- Migration 022: calcula nivel_risco e perfil para os leads históricos (mesma régua da vitrine)
with sc as (
  select id,
    ( case when usa_contrato='Nunca, acho que não preciso.' then 3
           when usa_contrato='Às vezes, quando o cliente pede…' then 1 else 0 end
    + case when protege_dinheiro='Não ajuda, já perdi dinheiro por não estar protegido.' then 3
           when protege_dinheiro='Às vezes protege, mas já tive problemas…' then 1 else 0 end
    + case when entende_contrato in ('Ainda não uso contrato.','Não sou capaz de entender sozinho.') then 2 else 0 end
    + case when 'Nenhum deles' = any(temas_dominados) then 2 else 0 end
    + case when tipo_contrato_atual='Na verdade, eu nem uso contrato…' then 2
           when tipo_contrato_atual is not null then 1 else 0 end ) s
  from quiz_leads where nivel_risco is null
)
update quiz_leads q set nivel_risco =
  case when s>=8 then 'Altíssimo' when s>=6 then 'Alto' when s>=4 then 'Médio'
       when s>=2 then 'Baixo' else 'Baixíssimo' end
from sc where q.id=sc.id;

update quiz_leads set perfil = trim(
    coalesce(case area_atuacao when 'Fotógrafo(a)' then 'fotógrafo'
        when 'Videomaker' then 'videomaker' when 'Faço os dois (híbrido)' then 'fotógrafo e videomaker'
        else 'profissional' end,'')
 || coalesce(case tipo_negocio when 'Empresário/MEI' then ' empreendedor/MEI'
        when 'Autônomo' then ' autônomo' when 'Ainda sou amador' then ' em começo de jornada' else '' end,''))
where perfil is null and area_atuacao is not null;
