-- Eigen budgetposten per project (schilder, bezorging, verf ...): [{id, name, amount, paid}]
alter table public.projects add column if not exists budget_items jsonb not null default '[]'::jsonb;
