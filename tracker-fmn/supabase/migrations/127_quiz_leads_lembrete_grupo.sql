-- Black 2026 (20/10/2026): marca quando o inscrito recebeu o lembrete para
-- entrar no grupo (modelo black_2026_entrar_grupo, pelo número comercial).
-- Serve de trava: a rotina roda de minuto em minuto e o update condicional
-- garante que duas execuções nunca mandem a mesma mensagem duas vezes.
alter table quiz_leads add column if not exists grupo_lembrete_em timestamptz;

-- Chave que liga o disparo. Nasce desligada de propósito: a mensagem só passa
-- a sair quando o Felipe disser, nunca por ter sido publicada.
insert into app_config (chave, valor)
values ('black_lembrete_grupo_ativo', 'false')
on conflict (chave) do nothing;
