-- Brown Zone Row Level Security policies.
--
-- The app uses stable string IDs such as `student-1`, so policies read the
-- user id from the JWT `sub` claim instead of casting through `auth.uid()`.
-- Role and classroom claims are embedded by src/lib/auth.ts.
--
-- Performance: row-INDEPENDENT auth helpers (jwt_user_id/jwt_role/
-- jwt_classroom_id/is_admin/is_teacher_or_admin) are wrapped in `(select ...)`
-- so Postgres hoists them to an initPlan and evaluates them ONCE per query
-- instead of once per row (Supabase RLS best practice). Row-DEPENDENT helpers
-- that take a row column as an argument (is_classroom_member,
-- teacher_can_access_student, parent_bonded_to) are left unwrapped — a correlated
-- subquery there would not be hoisted, so wrapping buys nothing.

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
-- Financial Power leaderboard (V1).
grant select, insert on public.schools to authenticated;
grant select, insert, update on public.rank_profiles to authenticated;
grant select, insert, update on public.leaderboard_snapshots to authenticated;
grant select, insert, delete on public.learning_progress to authenticated;
grant select, insert, delete on public.family_members to authenticated;

alter table public.users enable row level security;
alter table public.scenario_runs enable row level security;
alter table public.ai_sessions enable row level security;
alter table public.growth_reports enable row level security;
alter table public.assignments enable row level security;
alter table public.invite_codes enable row level security;
alter table public.payment_orders enable row level security;
alter table public.subscription_grants enable row level security;
alter table public.schools enable row level security;
alter table public.rank_profiles enable row level security;
alter table public.leaderboard_snapshots enable row level security;
alter table public.learning_progress enable row level security;
alter table public.family_members enable row level security;

drop policy if exists users_select_own on public.users;
create policy users_select_own
on public.users
for select
to authenticated
using (
  id = (select app_private.jwt_user_id())
);

drop policy if exists scenario_runs_student_select_own on public.scenario_runs;
create policy scenario_runs_student_select_own
on public.scenario_runs
for select
to authenticated
using (
  (select app_private.jwt_role()) = 'student'
  and user_id = (select app_private.jwt_user_id())
);

drop policy if exists scenario_runs_teacher_select_classroom on public.scenario_runs;
create policy scenario_runs_teacher_select_classroom
on public.scenario_runs
for select
to authenticated
using (
  (select app_private.jwt_role()) = 'teacher'
  and app_private.teacher_can_access_student(user_id)
);

drop policy if exists scenario_runs_parent_select_bonded on public.scenario_runs;
create policy scenario_runs_parent_select_bonded
on public.scenario_runs
for select
to authenticated
using (
  (select app_private.jwt_role()) = 'parent'
  and app_private.parent_bonded_to(user_id)
);

drop policy if exists scenario_runs_admin_select_all on public.scenario_runs;
create policy scenario_runs_admin_select_all
on public.scenario_runs
for select
to authenticated
using (
  (select app_private.is_admin())
);

drop policy if exists ai_sessions_select_own on public.ai_sessions;
create policy ai_sessions_select_own
on public.ai_sessions
for select
to authenticated
using (
  user_id = (select app_private.jwt_user_id())
);

drop policy if exists ai_sessions_update_own on public.ai_sessions;
create policy ai_sessions_update_own
on public.ai_sessions
for update
to authenticated
using (
  user_id = (select app_private.jwt_user_id())
)
with check (
  user_id = (select app_private.jwt_user_id())
);

drop policy if exists growth_reports_student_select_own on public.growth_reports;
create policy growth_reports_student_select_own
on public.growth_reports
for select
to authenticated
using (
  student_user_id = (select app_private.jwt_user_id())
);

drop policy if exists growth_reports_parent_select_bonded on public.growth_reports;
create policy growth_reports_parent_select_bonded
on public.growth_reports
for select
to authenticated
using (
  (select app_private.jwt_role()) = 'parent'
  and app_private.parent_bonded_to(student_user_id)
);

drop policy if exists growth_reports_admin_select_all on public.growth_reports;
create policy growth_reports_admin_select_all
on public.growth_reports
for select
to authenticated
using (
  (select app_private.is_admin())
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
  (select app_private.is_teacher_or_admin())
)
with check (
  (select app_private.is_teacher_or_admin())
);

drop policy if exists invite_codes_teacher_admin_only on public.invite_codes;
create policy invite_codes_teacher_admin_only
on public.invite_codes
for all
to authenticated
using (
  (select app_private.is_teacher_or_admin())
)
with check (
  (select app_private.is_teacher_or_admin())
);

drop policy if exists payment_orders_select_related on public.payment_orders;
create policy payment_orders_select_related
on public.payment_orders
for select
to authenticated
using (
  user_id = (select app_private.jwt_user_id())
  or target_user_id = (select app_private.jwt_user_id())
  or (select app_private.is_admin())
);

drop policy if exists payment_orders_insert_payer on public.payment_orders;
create policy payment_orders_insert_payer
on public.payment_orders
for insert
to authenticated
with check (
  user_id = (select app_private.jwt_user_id())
  or (select app_private.is_teacher_or_admin())
);

drop policy if exists payment_orders_update_admin on public.payment_orders;
create policy payment_orders_update_admin
on public.payment_orders
for update
to authenticated
using (
  (select app_private.is_admin())
)
with check (
  (select app_private.is_admin())
);

drop policy if exists subscription_grants_select_related on public.subscription_grants;
create policy subscription_grants_select_related
on public.subscription_grants
for select
to authenticated
using (
  user_id = (select app_private.jwt_user_id())
  or (select app_private.is_admin())
);

-- ── Financial Power leaderboard (V1) ────────────────────────────────────────
-- The leaderboard is a PUBLIC, cross-user competitive feature: a board shows
-- other students' alias / school / power. Visibility (public / school_only /
-- hidden) and guardian consent are enforced in the pure app layer
-- (src/lib/leaderboard/ranking.ts) over EXACTLY the displayed set, so RLS here
-- intentionally allows cross-user SELECT on the read-path tables (schools,
-- rank_profiles, leaderboard_snapshots) — restricting them would empty the
-- board and could skew the private viewer-rank — while keeping WRITES
-- owner-scoped. The daily recompute cron runs as the owner role and bypasses
-- RLS, so the owner-scoped write policies never block it. learning_progress and
-- family_members carry no cross-user read need and stay strictly scoped.

-- schools: a shared, self-input directory (no classroom binding). Anyone signed
-- in reads it (the picker + board school names) and may add a school
-- (findOrCreateSchool); rows are never edited or deleted from the app.
drop policy if exists schools_select_all on public.schools;
create policy schools_select_all
on public.schools
for select
to authenticated
using (true);

drop policy if exists schools_insert_authenticated on public.schools;
create policy schools_insert_authenticated
on public.schools
for insert
to authenticated
with check (
  created_by is null
  or created_by = (select app_private.jwt_user_id())
  or (select app_private.is_teacher_or_admin())
);

-- rank_profiles: readable cross-user for the board join (ranking.ts owns display
-- privacy); a player writes only their own identity/visibility/consent.
drop policy if exists rank_profiles_select_board on public.rank_profiles;
create policy rank_profiles_select_board
on public.rank_profiles
for select
to authenticated
using (true);

drop policy if exists rank_profiles_insert_own on public.rank_profiles;
create policy rank_profiles_insert_own
on public.rank_profiles
for insert
to authenticated
with check (
  user_id = (select app_private.jwt_user_id())
);

drop policy if exists rank_profiles_update_own on public.rank_profiles;
create policy rank_profiles_update_own
on public.rank_profiles
for update
to authenticated
using (
  user_id = (select app_private.jwt_user_id())
)
with check (
  user_id = (select app_private.jwt_user_id())
);

-- leaderboard_snapshots: readable cross-user (the board ranks over all of them);
-- a student may only write their OWN snapshot. (Recompute runs as owner.)
drop policy if exists leaderboard_snapshots_select_board on public.leaderboard_snapshots;
create policy leaderboard_snapshots_select_board
on public.leaderboard_snapshots
for select
to authenticated
using (true);

drop policy if exists leaderboard_snapshots_insert_own on public.leaderboard_snapshots;
create policy leaderboard_snapshots_insert_own
on public.leaderboard_snapshots
for insert
to authenticated
with check (
  user_id = (select app_private.jwt_user_id())
);

drop policy if exists leaderboard_snapshots_update_own on public.leaderboard_snapshots;
create policy leaderboard_snapshots_update_own
on public.leaderboard_snapshots
for update
to authenticated
using (
  user_id = (select app_private.jwt_user_id())
)
with check (
  user_id = (select app_private.jwt_user_id())
);

-- learning_progress: strictly private to the student (feeds only their own power
-- score). Admin may read for support.
drop policy if exists learning_progress_select_own on public.learning_progress;
create policy learning_progress_select_own
on public.learning_progress
for select
to authenticated
using (
  user_id = (select app_private.jwt_user_id())
  or (select app_private.is_admin())
);

drop policy if exists learning_progress_insert_own on public.learning_progress;
create policy learning_progress_insert_own
on public.learning_progress
for insert
to authenticated
with check (
  user_id = (select app_private.jwt_user_id())
);

drop policy if exists learning_progress_delete_own on public.learning_progress;
create policy learning_progress_delete_own
on public.learning_progress
for delete
to authenticated
using (
  user_id = (select app_private.jwt_user_id())
);

-- family_members: a Premium "family" link. Visible to the owning parent, the
-- linked student, and admins; the owner (parent) creates and removes links.
drop policy if exists family_members_select_related on public.family_members;
create policy family_members_select_related
on public.family_members
for select
to authenticated
using (
  owner_user_id = (select app_private.jwt_user_id())
  or student_user_id = (select app_private.jwt_user_id())
  or (select app_private.is_admin())
);

drop policy if exists family_members_insert_owner on public.family_members;
create policy family_members_insert_owner
on public.family_members
for insert
to authenticated
with check (
  owner_user_id = (select app_private.jwt_user_id())
  or (select app_private.is_admin())
);

drop policy if exists family_members_delete_owner on public.family_members;
create policy family_members_delete_owner
on public.family_members
for delete
to authenticated
using (
  owner_user_id = (select app_private.jwt_user_id())
  or (select app_private.is_admin())
);

-- ── Close the RLS coverage gap ───────────────────────────────────────────────
-- These four tables had RLS ENABLED (out of band, e.g. the Supabase dashboard's
-- "enable RLS" prompt) but NO policy — i.e. deny-all under the authenticated
-- role. Scope them to match repo.ts access so nothing is unintentionally locked
-- out when DATABASE_ROLE=authenticated. (Inert today: the owner role bypasses.)

-- profiles: the user's own dashboard profile (name/title/bio). repo only ever
-- reads it by its own user_id, so own + admin is sufficient.
grant select, insert, update on public.profiles to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (
  user_id = (select app_private.jwt_user_id())
  or (select app_private.is_admin())
);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (
  user_id = (select app_private.jwt_user_id())
  or (select app_private.is_admin())
);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using (
  user_id = (select app_private.jwt_user_id())
  or (select app_private.is_admin())
)
with check (
  user_id = (select app_private.jwt_user_id())
  or (select app_private.is_admin())
);

-- classrooms: visible to its members (via the classroomId claim), its owning
-- teacher, and admins; teacher/admin may write their own classroom.
grant select, insert, update on public.classrooms to authenticated;

drop policy if exists classrooms_select_related on public.classrooms;
create policy classrooms_select_related
on public.classrooms
for select
to authenticated
using (
  id = (select app_private.jwt_classroom_id())
  or teacher_id = (select app_private.jwt_user_id())
  or (select app_private.is_admin())
);

drop policy if exists classrooms_write_teacher_admin on public.classrooms;
create policy classrooms_write_teacher_admin
on public.classrooms
for all
to authenticated
using (
  teacher_id = (select app_private.jwt_user_id())
  or (select app_private.is_admin())
)
with check (
  teacher_id = (select app_private.jwt_user_id())
  or (select app_private.is_admin())
);

-- student_parent_links: visible to either party in the bond + admin; either
-- party may create/remove it. parent_bonded_to() is security definer, so RLS
-- here does not break the parent policies on scenario_runs/growth_reports.
grant select, insert, delete on public.student_parent_links to authenticated;

drop policy if exists student_parent_links_select_related on public.student_parent_links;
create policy student_parent_links_select_related
on public.student_parent_links
for select
to authenticated
using (
  student_user_id = (select app_private.jwt_user_id())
  or parent_user_id = (select app_private.jwt_user_id())
  or (select app_private.is_admin())
);

drop policy if exists student_parent_links_insert_party on public.student_parent_links;
create policy student_parent_links_insert_party
on public.student_parent_links
for insert
to authenticated
with check (
  student_user_id = (select app_private.jwt_user_id())
  or parent_user_id = (select app_private.jwt_user_id())
  or (select app_private.is_admin())
);

drop policy if exists student_parent_links_delete_party on public.student_parent_links;
create policy student_parent_links_delete_party
on public.student_parent_links
for delete
to authenticated
using (
  student_user_id = (select app_private.jwt_user_id())
  or parent_user_id = (select app_private.jwt_user_id())
  or (select app_private.is_admin())
);

-- ai_messages: child of ai_sessions (one session owns many messages). A message
-- is visible/writable when the parent session belongs to the caller — mirrors
-- ai_sessions_select_own — or to an admin. The EXISTS reads ai_sessions under
-- its own RLS, which already lets the caller see their own session.
grant select, insert, delete on public.ai_messages to authenticated;

drop policy if exists ai_messages_select_own_session on public.ai_messages;
create policy ai_messages_select_own_session
on public.ai_messages
for select
to authenticated
using (
  (select app_private.is_admin())
  or exists (
    select 1
    from public.ai_sessions s
    where s.id = ai_messages.session_id
      and s.user_id = (select app_private.jwt_user_id())
  )
);

drop policy if exists ai_messages_insert_own_session on public.ai_messages;
create policy ai_messages_insert_own_session
on public.ai_messages
for insert
to authenticated
with check (
  (select app_private.is_admin())
  or exists (
    select 1
    from public.ai_sessions s
    where s.id = ai_messages.session_id
      and s.user_id = (select app_private.jwt_user_id())
  )
);

drop policy if exists ai_messages_delete_own_session on public.ai_messages;
create policy ai_messages_delete_own_session
on public.ai_messages
for delete
to authenticated
using (
  (select app_private.is_admin())
  or exists (
    select 1
    from public.ai_sessions s
    where s.id = ai_messages.session_id
      and s.user_id = (select app_private.jwt_user_id())
  )
);
