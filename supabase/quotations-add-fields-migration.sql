-- Run this once if your public.quotations table was created before the
-- Quotation No. / Invoice No. / Project No. fields were added.
-- Safe to run multiple times (IF NOT EXISTS guards).

alter table public.quotations add column if not exists quotation_no text;
alter table public.quotations add column if not exists invoice_no text;
alter table public.quotations add column if not exists project_no text;
