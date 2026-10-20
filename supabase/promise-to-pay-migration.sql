-- وعود الدفع: شغّل هذا الملف في SQL Editor *قبل* نشر النسخة v3.2. آمن لإعادة التشغيل.
-- Promise-to-pay: run in the SQL Editor BEFORE deploying v3.2. Safe to re-run.
alter table public.debtors add column if not exists promise_date   date;
alter table public.debtors add column if not exists promise_amount numeric(14,2);
