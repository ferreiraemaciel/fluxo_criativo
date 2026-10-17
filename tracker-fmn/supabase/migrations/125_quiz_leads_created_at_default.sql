-- Lead sem data some de todo filtro de período (17/10/2026). A página da Black
-- (fmn-site/black-2026.html) não manda created_at, ao contrário dos quizzes,
-- e a coluna não tinha valor padrão: os 6 primeiros inscritos ficaram invisíveis.
alter table quiz_leads alter column created_at set default now();
update quiz_leads set created_at = now() where created_at is null;
