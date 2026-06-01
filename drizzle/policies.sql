-- Brown Zone Row Level Security policies.
--
-- The app uses stable string IDs such as `student-1`, so policies read the
-- user id from the JWT `sub` claim instead of casting through `auth.uid()`.
-- Role and classroom claims are embedded by src/lib/auth.ts.

create schema if not exists app_private;

create or replace function app_private.jwt_user_id()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(auth.jwt() ->> 'sub', ''),
    nullif(current_setting('request.jwt.claim.sub', true), '')
  );
$$;

create or replace function app_private.jwt_role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(auth.jwt() ->> 'role', ''),
    nullif(auth.jwt() ->> 'appRole', ''),
    nullif(current_setting('request.jwt.claim.role', true), '')
  );
$$;

create or replace function app_private.jwt_classroom_id()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(auth.jwt() ->> 'classroomId', ''),
    nullif(current_setting('request.jwt.claim.classroomId', true), '')
  );
$$;

create or replace function app_private.is_admin()
returns boolean
language sql
stable
as $$
  select app_private.jwt_role() = 'admin';
$$;

create or replace function app_private.is_teacher_or_admin()
returns boolean
language sql
stable
as $$
  select app_private.jwt_role() in ('teacher', 'admin');
$$;

create or replace function app_private.is_classroom_member(target_classroom_id text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1
    from public.users u
    where u.id = app_private.jwt_user_id()
      and u.classroom_id = target_classroom_id
  )
  or app_private.is_admin();
$$;

create or replace function app_private.teacher_can_access_student(target_user_id text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1
    from public.users u
    where u.id = target_user_id
      and u.classroom_id = app_private.jwt_classroom_id()
  );
$$;

create or replace function app_private.parent_bonded_to(target_student_user_id text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1
    from public.student_parent_links link
    where link.parent_user_id = app_private.jwt_user_id()
      and link.student_user_id = target_student_user_id
  );
$$;

grant usage on schema app_private to authenticated;
grant execute on all functions in schema app_private to authenticated;

grant select on public.users to authenticated;
grant select on public.scenario_runs to authenticated;
grant select, update on public.ai_sessions to authenticated;
grant select on public.growth_reports to authenticated;
grant select, insert, update, delete on public.assignments to authenticated;
grant select, insert, update, delete on public.invite_codes to authenticated;
grant select, insert, update on public.payment_orders to authenticated;
grant select on public.subscription_grants to authenticated;

alter table public.users enable row level security;
alter table public.scenario_runs enable row level security;
alter table public.ai_sessions enable row level security;
alter table public.growth_reports enable row level security;
alter table public.assignments enable row level security;
alter table public.invite_codes enable row level security;
alter table public.payment_orders enable row level security;
alter table public.subscription_grants enable row level security;

drop policy if exists users_select_own on public.users;
create policy users_select_own
on public.users
for select
to authenticated
using (
  id = app_private.jwt_user_id()
);

drop policy if exists scenario_runs_student_select_own on public.scenario_runs;
create policy scenario_runs_student_select_own
on public.scenario_runs
for select
to authenticated
using (
  app_private.jwt_role() = 'student'
  and user_id = app_private.jwt_user_id()
);

drop policy if exists scenario_runs_teacher_select_classroom on public.scenario_runs;
create policy scenario_runs_teacher_select_classroom
on public.scenario_runs
for select
to authenticated
using (
  app_private.jwt_role() = 'teacher'
  and app_private.teacher_can_access_student(user_id)
);

drop policy if exists scenario_runs_parent_select_bonded on public.scenario_runs;
create policy scenario_runs_parent_select_bonded
on public.scenario_runs
for select
to authenticated
using (
  app_private.jwt_role() = 'parent'
  and app_private.parent_bonded_to(user_id)
);

drop policy if exists scenario_runs_admin_select_all on public.scenario_runs;
create policy scenario_runs_admin_select_all
on public.scenario_runs
for select
to authenticated
using (
  app_private.is_admin()
);

drop policy if exists ai_sessions_select_own on public.ai_sessions;
create policy ai_sessions_select_own
on public.ai_sessions
for select
to authenticated
using (
  user_id = app_private.jwt_user_id()
);

drop policy if exists ai_sessions_update_own on public.ai_sessions;
create policy ai_sessions_update_own
on public.ai_sessions
for update
to authenticated
using (
  user_id = app_private.jwt_user_id()
)
with check (
  user_id = app_private.jwt_user_id()
);

drop policy if exists growth_reports_student_select_own on public.growth_reports;
create policy growth_reports_student_select_own
on public.growth_reports
for select
to authenticated
using (
  student_user_id = app_private.jwt_user_id()
);

drop policy if exists growth_reports_parent_select_bonded on public.growth_reports;
create policy growth_reports_parent_select_bonded
on public.growth_reports
for select
to authenticated
using (
  app_private.jwt_role() = 'parent'
  and app_private.parent_bonded_to(student_user_id)
);

drop policy if exists growth_reports_admin_select_all on public.growth_reports;
create policy growth_reports_admin_select_all
on public.growth_reports
for select
to authenticated
using (
  app_private.is_admin()
);

drop policy if exists assignments_select_classroom_members on public.assignments;
create policy assignments_select_classroom_members
on public.assignments
for select
to authenticated
using (
  app_private.is_classroom_member(classroom_id)
);

drop policy if exists assignments_write_teacher_admin on public.assignments;
create policy assignments_write_teacher_admin
on public.assignments
for all
to authenticated
using (
  app_private.is_teacher_or_admin()
)
with check (
  app_private.is_teacher_or_admin()
);

drop policy if exists invite_codes_teacher_admin_only on public.invite_codes;
create policy invite_codes_teacher_admin_only
on public.invite_codes
for all
to authenticated
using (
  app_private.is_teacher_or_admin()
)
with check (
  app_private.is_teacher_or_admin()
);

drop policy if exists payment_orders_select_related on public.payment_orders;
create policy payment_orders_select_related
on public.payment_orders
for select
to authenticated
using (
  user_id = app_private.jwt_user_id()
  or target_user_id = app_private.jwt_user_id()
  or app_private.is_admin()
);

drop policy if exists payment_orders_insert_payer on public.payment_orders;
create policy payment_orders_insert_payer
on public.payment_orders
for insert
to authenticated
with check (
  user_id = app_private.jwt_user_id()
  or app_private.is_teacher_or_admin()
);

drop policy if exists payment_orders_update_admin on public.payment_orders;
create policy payment_orders_update_admin
on public.payment_orders
for update
to authenticated
using (
  app_private.is_admin()
)
with check (
  app_private.is_admin()
);

drop policy if exists subscription_grants_select_related on public.subscription_grants;
create policy subscription_grants_select_related
on public.subscription_grants
for select
to authenticated
using (
  user_id = app_private.jwt_user_id()
  or app_private.is_admin()
);
