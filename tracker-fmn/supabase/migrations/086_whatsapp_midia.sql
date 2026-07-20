-- Migration 086: coluna pra guardar a URL pública do áudio (ou outra mídia)
-- que o lead manda no WhatsApp. Sem isso o Tracker só mostrava "[audio]"
-- como texto, sem tocar nada.
alter table whatsapp_mensagens add column if not exists midia_url text;

-- Bucket público no Supabase Storage pra guardar os arquivos baixados da
-- Cloud API do WhatsApp (ela expira a URL original em minutos, por isso
-- baixamos e guardamos nosso próprio storage).
insert into storage.buckets (id, name, public)
values ('whatsapp-media', 'whatsapp-media', true)
on conflict (id) do nothing;
