-- كشف التعارض: شغّل هذا الملف *قبل* نشر v3.3. آمن لإعادة التشغيل.
-- Edit-conflict detection: run BEFORE deploying v3.3. Safe to re-run.
alter table public.debtors   add column if not exists updated_at timestamptz not null default now();
alter table public.quotations add column if not exists updated_at timestamptz not null default now();
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_touch_updated_at on public.debtors;
create trigger trg_touch_updated_at before update on public.debtors   for each row execute function public.touch_updated_at();
drop trigger if exists trg_touch_updated_at on public.quotations;
create trigger trg_touch_updated_at before update on public.quotations for each row execute function public.touch_updated_at();
