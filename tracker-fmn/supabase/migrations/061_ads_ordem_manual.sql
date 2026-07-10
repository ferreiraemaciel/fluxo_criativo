-- Migração 061: ordem manual dos cards dentro de cada coluna do Kanban (2026-07-10).
-- double precision pra permitir "indexação fracionária": ao arrastar um card pra
-- entre dois outros, o novo valor é a média dos dois vizinhos, sem precisar
-- renumerar o resto da coluna. Null = nunca foi reordenado manualmente (cai no
-- fim da lista, ordenado por numero desc como já era antes desta mudança).
alter table ads add column if not exists ordem_manual double precision;
