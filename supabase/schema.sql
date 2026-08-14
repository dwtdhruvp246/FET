create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  monthly_budget numeric(12, 2) not null default 0 check (monthly_budget >= 0),
  currency text not null default 'USD' check (currency in ('USD', 'ZAR', 'EUR', 'GBP', 'CAD', 'AUD')),
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'Adult' check (role in ('Owner', 'Adult', 'Child', 'Teen', 'Other')),
  monthly_allowance numeric(12, 2) not null default 0 check (monthly_allowance >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid references public.family_members(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  category text not null,
  note text,
  payment_method text,
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists families_owner_id_idx on public.families(owner_id);
create index if not exists family_members_family_id_idx on public.family_members(family_id);
create index if not exists expenses_family_date_idx on public.expenses(family_id, expense_date desc);
create index if not exists expenses_member_id_idx on public.expenses(member_id);

alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.expenses enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.families to authenticated;
grant select, insert, update, delete on public.family_members to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Owners can read their families" on public.families;
create policy "Owners can read their families"
on public.families for select
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "Owners can create families" on public.families;
create policy "Owners can create families"
on public.families for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "Owners can update their families" on public.families;
create policy "Owners can update their families"
on public.families for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "Owners can delete their families" on public.families;
create policy "Owners can delete their families"
on public.families for delete
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "Owners can read family members" on public.family_members;
create policy "Owners can read family members"
on public.family_members for select
to authenticated
using (
  exists (
    select 1
    from public.families
    where families.id = family_members.family_id
      and families.owner_id = (select auth.uid())
  )
);

drop policy if exists "Owners can create family members" on public.family_members;
create policy "Owners can create family members"
on public.family_members for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.families
    where families.id = family_members.family_id
      and families.owner_id = (select auth.uid())
  )
);

drop policy if exists "Owners can update family members" on public.family_members;
create policy "Owners can update family members"
on public.family_members for update
to authenticated
using (
  exists (
    select 1
    from public.families
    where families.id = family_members.family_id
      and families.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.families
    where families.id = family_members.family_id
      and families.owner_id = (select auth.uid())
  )
);

drop policy if exists "Owners can delete family members" on public.family_members;
create policy "Owners can delete family members"
on public.family_members for delete
to authenticated
using (
  exists (
    select 1
    from public.families
    where families.id = family_members.family_id
      and families.owner_id = (select auth.uid())
  )
);

drop policy if exists "Owners can read expenses" on public.expenses;
create policy "Owners can read expenses"
on public.expenses for select
to authenticated
using (
  exists (
    select 1
    from public.families
    where families.id = expenses.family_id
      and families.owner_id = (select auth.uid())
  )
);

drop policy if exists "Owners can create expenses" on public.expenses;
create policy "Owners can create expenses"
on public.expenses for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.families
    where families.id = expenses.family_id
      and families.owner_id = (select auth.uid())
  )
);

drop policy if exists "Owners can update expenses" on public.expenses;
create policy "Owners can update expenses"
on public.expenses for update
to authenticated
using (
  exists (
    select 1
    from public.families
    where families.id = expenses.family_id
      and families.owner_id = (select auth.uid())
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.families
    where families.id = expenses.family_id
      and families.owner_id = (select auth.uid())
  )
);

drop policy if exists "Owners can delete expenses" on public.expenses;
create policy "Owners can delete expenses"
on public.expenses for delete
to authenticated
using (
  exists (
    select 1
    from public.families
    where families.id = expenses.family_id
      and families.owner_id = (select auth.uid())
  )
);
