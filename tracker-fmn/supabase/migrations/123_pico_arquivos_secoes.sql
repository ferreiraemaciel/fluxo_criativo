-- Acervo da campanha em seções (15/10/2026): capas de grupo, jogo de contagem e cards de bônus.
alter table pico_arquivos drop constraint if exists pico_arquivos_categoria_check;
alter table pico_arquivos add constraint pico_arquivos_categoria_check
  check (categoria in ('logo','grupo','contagem','bonus','arte','foto','video','documento'));
