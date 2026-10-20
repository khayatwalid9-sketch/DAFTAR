-- ============================================================================
--  دفتر — الترحيل الأمني الكامل: Supabase Auth + RLS حقيقي
--  Daftar — full security migration: Supabase Auth + real Row Level Security
--
--  شغّله أولًا على نسخة تجريبية (staging). آمن للتشغيل أكثر من مرة.
--  Run on a STAGING project first. Safe to re-run.
--
--  قبل التشغيل / before running:
--    1) Authentication > Providers > Email: عطّل "Confirm email" و"Allow new users to sign up".
--       (disable "Confirm email" and disable public sign-ups)
--    2) أنشئ أول مدير: Authentication > Users > Add user
--       email = admin@<AUTH_EMAIL_DOMAIN>  (الافتراضي daftar-auth.app) + كلمة مرور قوية + Auto-confirm
--    3) شغّل هذا الملف، ثم الأمر الأخير (تعيين المدير) في أسفله.
-- ============================================================================

-- ---------- 1) الملفات الشخصية (بدل جدول users ذي كلمات المرور) -------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique,
  role        text not null default 'viewer' check (role in ('admin','collector','viewer')),
  rep_id      bigint,
  permissions jsonb,
  prefs       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- ---------- 2) دوال مساعدة (security definer لتفادي التكرار اللانهائي في RLS) ----
create or replace function public.my_role() returns text
  language sql stable security definer set search_path = '' as
$$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.my_rep_id() returns bigint
  language sql stable security definer set search_path = '' as
$$ select rep_id from public.profiles where id = auth.uid() $$;

create or replace function public.my_username() returns text
  language sql stable security definer set search_path = '' as
$$ select username from public.profiles where id = auth.uid() $$;

create or replace function public.can_write() returns boolean
  language sql stable security definer set search_path = '' as
$$ select coalesce(
     (select coalesce((permissions->>'write')::boolean, role in ('admin','collector'))
        from public.profiles where id = auth.uid()), false) $$;

create or replace function public.can_delete() returns boolean
  language sql stable security definer set search_path = '' as
$$ select coalesce(
     (select coalesce((permissions->>'delete')::boolean, role = 'admin')
        from public.profiles where id = auth.uid()), false) $$;

-- تفضيلات المستخدم (اللغة/الوضع/الثيم) تُحفظ هنا بدل المتصفح
create or replace function public.set_my_prefs(p jsonb) returns void
  language sql security definer set search_path = '' as
$$ update public.profiles set prefs = coalesce(p, '{}'::jsonb) where id = auth.uid() $$;

revoke all on function public.my_role(), public.my_rep_id(), public.my_username(),
  public.can_write(), public.can_delete(), public.set_my_prefs(jsonb) from public, anon;
grant execute on function public.my_role(), public.my_rep_id(), public.my_username(),
  public.can_write(), public.can_delete(), public.set_my_prefs(jsonb) to authenticated;

-- ---------- 3) تنظيف كل السياسات القديمة المفتوحة (using true) -------------------
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
           where schemaname = 'public'
             and tablename in ('debtors','debtors_activity','reps','app_settings','users',
                               'audit_log','quotations','quotations_activity','quotation_files','profiles')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

alter table public.debtors             enable row level security;
alter table public.debtors_activity    enable row level security;
alter table public.reps                enable row level security;
alter table public.app_settings        enable row level security;
alter table public.audit_log           enable row level security;
alter table public.quotations          enable row level security;
alter table public.quotations_activity enable row level security;
alter table public.quotation_files     enable row level security;

-- المفتاح العام (anon) لا يرى شيئًا إطلاقًا
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ---------- 4) السياسات (كلها للمستخدم المسجّل فقط) -----------------------------
-- profiles: كل مستخدم يقرأ صفّه، والمدير يقرأ الجميع. الكتابة فقط عبر دالة admin-users.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.my_role() = 'admin');
revoke insert, update, delete on public.profiles from authenticated;

-- debtors: المدير والمشاهد يرون الكل، المندوب يرى حالاته فقط
create policy debtors_select on public.debtors for select to authenticated
  using (public.my_role() in ('admin','viewer') or rep_id = public.my_rep_id());
create policy debtors_insert on public.debtors for insert to authenticated
  with check (public.can_write() and (public.my_role() = 'admin' or rep_id = public.my_rep_id()));
create policy debtors_update on public.debtors for update to authenticated
  using      (public.can_write() and (public.my_role() = 'admin' or rep_id = public.my_rep_id()))
  with check (public.can_write() and (public.my_role() = 'admin' or rep_id = public.my_rep_id()));
create policy debtors_delete on public.debtors for delete to authenticated
  using (public.can_delete() and (public.my_role() = 'admin' or rep_id = public.my_rep_id()));

-- debtors_activity: تتبع صلاحية المدين الأب
create policy activity_select on public.debtors_activity for select to authenticated
  using (exists (select 1 from public.debtors d where d.id = debtor_id));
create policy activity_write on public.debtors_activity for insert to authenticated
  with check (public.can_write() and exists (select 1 from public.debtors d where d.id = debtor_id
              and (public.my_role() = 'admin' or d.rep_id = public.my_rep_id())));
create policy activity_update on public.debtors_activity for update to authenticated
  using (public.can_write() and exists (select 1 from public.debtors d where d.id = debtor_id
              and (public.my_role() = 'admin' or d.rep_id = public.my_rep_id())))
  with check (public.can_write() and exists (select 1 from public.debtors d where d.id = debtor_id
              and (public.my_role() = 'admin' or d.rep_id = public.my_rep_id())));
create policy activity_delete on public.debtors_activity for delete to authenticated
  using (public.can_write() and exists (select 1 from public.debtors d where d.id = debtor_id
              and (public.my_role() = 'admin' or d.rep_id = public.my_rep_id())));

-- reps: قراءة للجميع، كتابة للمدير فقط
create policy reps_select on public.reps for select to authenticated using (true);
create policy reps_write  on public.reps for all    to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- app_settings: الصف 1 عام للمسجّلين، الصف 2 (مفاتيح API) للمدير فقط، والكتابة للمدير فقط
create policy settings_select on public.app_settings for select to authenticated
  using (id = 1 or public.my_role() = 'admin');
create policy settings_write  on public.app_settings for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- audit_log: إضافة فقط باسم المستخدم نفسه، قراءة للمدير، لا تعديل ولا حذف (immutable)
create policy audit_insert on public.audit_log for insert to authenticated
  with check ("user" = public.my_username() or ("user" = 'system' and public.my_username() is not null));
create policy audit_select on public.audit_log for select to authenticated
  using (public.my_role() = 'admin');
revoke update, delete on public.audit_log from authenticated;

-- عروض الأسعار والمرفقات
create policy quot_select on public.quotations for select to authenticated using (true);
create policy quot_insert on public.quotations for insert to authenticated with check (public.can_write());
create policy quot_update on public.quotations for update to authenticated
  using (public.can_write()) with check (public.can_write());
create policy quot_delete on public.quotations for delete to authenticated using (public.can_delete());

create policy qact_select on public.quotations_activity for select to authenticated using (true);
create policy qact_insert on public.quotations_activity for insert to authenticated with check (public.can_write());
create policy qact_update on public.quotations_activity for update to authenticated
  using (public.can_write()) with check (public.can_write());
create policy qact_delete on public.quotations_activity for delete to authenticated using (public.can_write());

create policy qfile_select on public.quotation_files for select to authenticated using (true);
create policy qfile_insert on public.quotation_files for insert to authenticated with check (public.can_write());
create policy qfile_update on public.quotation_files for update to authenticated
  using (public.can_write()) with check (public.can_write());
create policy qfile_delete on public.quotation_files for delete to authenticated using (public.can_write());

-- ---------- 5) مخزن الملفات: خاص (بدل العام) + روابط موقّعة مؤقتة ----------------
update storage.buckets set public = false where id = 'quotation-files';
drop policy if exists "quotation files public read"   on storage.objects;
drop policy if exists "quotation files public insert" on storage.objects;
drop policy if exists "quotation files public update" on storage.objects;
drop policy if exists "quotation files public delete" on storage.objects;
drop policy if exists qfiles_read   on storage.objects;
drop policy if exists qfiles_insert on storage.objects;
drop policy if exists qfiles_delete on storage.objects;
create policy qfiles_read on storage.objects for select to authenticated
  using (bucket_id = 'quotation-files');
create policy qfiles_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'quotation-files' and public.can_write());
create policy qfiles_delete on storage.objects for delete to authenticated
  using (bucket_id = 'quotation-files' and public.can_write());

-- ---------- 6) تعيين المدير الأول (عدّل البريد ليطابق ما أنشأته في الخطوة 2) ---------
--   insert into public.profiles (id, username, role, permissions)
--   select id, 'admin', 'admin', null from auth.users where email = 'admin@daftar-auth.app'
--   on conflict (id) do update set role = 'admin';

-- ---------- 7) بعد التأكد أن كل شيء يعمل: احذف الجدول القديم الذي يحوي كلمات المرور ----
--   drop table if exists public.users;
