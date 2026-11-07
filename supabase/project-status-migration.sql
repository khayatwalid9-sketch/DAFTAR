-- Project status for quotations: TENDER or JOB IN HAND (empty = not set)
alter table public.quotations add column if not exists project_status text;
alter table public.quotations drop constraint if exists quotations_project_status_check;
alter table public.quotations add constraint quotations_project_status_check
  check (project_status is null or project_status in ('', 'tender', 'jobInHand'));
