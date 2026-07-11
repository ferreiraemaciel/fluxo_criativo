-- Migration 075: retomada de janela é texto livre (dentro das 24h), não
-- template. Guarda a que mensagem de entrada a retomada já respondeu, pra
-- não mandar duas vezes na mesma janela e pra permitir mandar de novo se
-- o lead abrir uma janela nova depois.
alter table whatsapp_contatos add column if not exists retomada_enviada_para timestamptz;
