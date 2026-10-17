-- Black 2026 (17/10/2026): marca quando o inscrito clicou em "Entrar no grupo"
-- na página de obrigado. Quem não clicou recebe o modelo black_2026_entrar_grupo.
alter table quiz_leads add column if not exists grupo_clicou_em timestamptz;
