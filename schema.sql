create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists email text;

create unique index if not exists profiles_email_unique_idx
on public.profiles (lower(email))
where email is not null;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Mushavo user'
    ),
    lower(new.email)
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(nullif(btrim(public.profiles.full_name), ''), excluded.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

insert into public.profiles (id, full_name, email)
select
  auth_users.id,
  coalesce(
    nullif(btrim(auth_users.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(auth_users.email, '@', 1), ''),
    'Mushavo user'
  ),
  lower(auth_users.email)
from auth.users as auth_users
where auth_users.email is not null
on conflict (id) do update
set email = excluded.email;

create table if not exists public.app_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.family_heads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.family_heads
  add column if not exists status text not null default 'active',
  add column if not exists billing_status text not null default 'unpaid',
  add column if not exists monthly_fee numeric(12, 2) not null default 0,
  add column if not exists fee_currency text not null default 'USD',
  add column if not exists can_add_members boolean not null default false,
  add column if not exists family_limit integer not null default 1,
  add column if not exists paid_until date,
  add column if not exists last_payment_at timestamptz;

alter table public.family_heads
  drop constraint if exists family_heads_status_check,
  add constraint family_heads_status_check check (status in ('active', 'suspended'));

alter table public.family_heads
  drop constraint if exists family_heads_billing_status_check,
  add constraint family_heads_billing_status_check check (billing_status in ('paid', 'unpaid', 'overdue'));

alter table public.family_heads
  drop constraint if exists family_heads_monthly_fee_check,
  add constraint family_heads_monthly_fee_check check (monthly_fee >= 0);

alter table public.family_heads
  drop constraint if exists family_heads_family_limit_check,
  add constraint family_heads_family_limit_check check (family_limit between 0 and 100);

alter table public.family_heads
  drop constraint if exists family_heads_fee_currency_check,
  add constraint family_heads_fee_currency_check check (fee_currency in ('USD', 'ZAR', 'EUR', 'GBP', 'CAD', 'AUD'));

create unique index if not exists app_admins_email_unique_idx
on public.app_admins (lower(email));

create unique index if not exists family_heads_email_unique_idx
on public.family_heads (lower(email));

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_email text,
  name text not null,
  monthly_budget numeric(12, 2) not null default 0 check (monthly_budget >= 0),
  currency text not null default 'USD' check (currency in ('USD', 'ZAR', 'EUR', 'GBP', 'CAD', 'AUD')),
  created_at timestamptz not null default now()
);

alter table public.families
  add column if not exists owner_email text;

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'Adult' check (role in ('Owner', 'Adult', 'Child', 'Teen', 'Other')),
  monthly_allowance numeric(12, 2) not null default 0 check (monthly_allowance >= 0),
  spending_limit numeric(12, 2) not null default 0 check (spending_limit >= 0),
  avatar_color text not null default '#167D77',
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

alter table public.family_members
  add column if not exists spending_limit numeric(12, 2) not null default 0,
  add column if not exists avatar_color text not null default '#167D77',
  add column if not exists status text not null default 'active',
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists reminder_preference text not null default 'in_app';

alter table public.family_members
  drop constraint if exists family_members_spending_limit_check,
  add constraint family_members_spending_limit_check check (spending_limit >= 0);

alter table public.family_members
  drop constraint if exists family_members_status_check,
  add constraint family_members_status_check check (status in ('active', 'inactive'));

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid references public.family_members(id) on delete set null,
  paid_by_member_id uuid references public.family_members(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  category text not null,
  note text,
  payment_method text,
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.expenses
  add column if not exists paid_by_member_id uuid references public.family_members(id) on delete set null;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  family_head_id uuid not null references public.family_heads(id) on delete cascade,
  family_id uuid references public.families(id) on delete set null,
  recorded_by uuid not null references auth.users(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'USD' check (currency in ('USD', 'ZAR', 'EUR', 'GBP', 'CAD', 'AUD')),
  payment_method text not null default 'Cash' check (payment_method in ('Cash', 'EFT', 'Card', 'Bank deposit', 'Other')),
  payment_date date not null default current_date,
  billing_period_start date,
  billing_period_end date,
  reference_number text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.category_budgets (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  category text not null,
  monthly_limit numeric(12, 2) not null default 0 check (monthly_limit >= 0),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists category_budgets_family_category_unique_idx
on public.category_budgets (family_id, category);

create table if not exists public.payment_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,
  visibility text not null default 'family',
  responsible_member_id uuid references public.family_members(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null default 'Other',
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'USD' check (currency in ('USD', 'ZAR', 'EUR', 'GBP', 'CAD', 'AUD')),
  recurrence_type text not null default 'monthly' check (recurrence_type in ('once', 'monthly', 'quarterly', 'yearly', 'custom')),
  recurrence_interval integer not null default 1 check (recurrence_interval between 1 and 24),
  due_day integer not null default 1 check (due_day between 1 and 31),
  start_date date not null default current_date,
  end_date date,
  reminder_days_before integer not null default 3 check (reminder_days_before between 0 and 30),
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_items
  alter column family_id drop not null,
  add column if not exists owner_id uuid references auth.users(id) on delete cascade,
  add column if not exists visibility text not null default 'family';

update public.payment_items
set owner_id = coalesce(owner_id, created_by),
    visibility = coalesce(visibility, case when family_id is null then 'personal' else 'family' end)
where owner_id is null or visibility is null;

alter table public.payment_items
  alter column owner_id set not null,
  drop constraint if exists payment_items_visibility_check,
  add constraint payment_items_visibility_check check (visibility in ('personal', 'family')),
  drop constraint if exists payment_items_scope_check,
  add constraint payment_items_scope_check check (
    (visibility = 'personal' and family_id is null and responsible_member_id is null)
    or
    (visibility = 'family' and family_id is not null)
  );

create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,
  visibility text not null default 'family',
  payment_item_id uuid not null references public.payment_items(id) on delete cascade,
  period_start date not null,
  due_date date not null,
  paid_by_member_id uuid references public.family_members(id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_method text not null default 'EFT' check (payment_method in ('Cash', 'EFT', 'Card', 'Bank deposit', 'Other')),
  reference_number text,
  notes text,
  recorded_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.payment_records
  alter column family_id drop not null,
  add column if not exists owner_id uuid references auth.users(id) on delete cascade,
  add column if not exists visibility text not null default 'family',
  add column if not exists proof_path text,
  add column if not exists proof_name text,
  add column if not exists proof_mime_type text,
  add column if not exists proof_size_bytes bigint;

update public.payment_records
set owner_id = coalesce(owner_id, recorded_by),
    visibility = coalesce(visibility, case when family_id is null then 'personal' else 'family' end)
where owner_id is null or visibility is null;

alter table public.payment_records
  alter column owner_id set not null,
  drop constraint if exists payment_records_visibility_check,
  add constraint payment_records_visibility_check check (visibility in ('personal', 'family')),
  drop constraint if exists payment_records_scope_check,
  add constraint payment_records_scope_check check (
    (visibility = 'personal' and family_id is null and paid_by_member_id is null)
    or
    (visibility = 'family' and family_id is not null)
  ),
  drop constraint if exists payment_records_proof_size_check,
  add constraint payment_records_proof_size_check check (
    proof_size_bytes is null or (proof_size_bytes > 0 and proof_size_bytes <= 10485760)
  ),
  drop constraint if exists payment_records_proof_type_check,
  add constraint payment_records_proof_type_check check (
    proof_mime_type is null or proof_mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
  );

create table if not exists public.family_invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  invitee_email text not null,
  invitee_name text,
  role text not null default 'Adult' check (role in ('Adult', 'Child', 'Teen', 'Other')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists family_invitations_pending_unique_idx
on public.family_invitations (family_id, lower(invitee_email))
where status = 'pending';

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text,
  created_by uuid references auth.users(id) on delete set null,
  family_id uuid references public.families(id) on delete cascade,
  invitation_id uuid references public.family_invitations(id) on delete cascade,
  type text not null default 'info',
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create table if not exists public.admin_support_notes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  note text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete set null,
  actor_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists app_admins_user_id_idx on public.app_admins(user_id);
create index if not exists family_heads_email_idx on public.family_heads(lower(email));
create index if not exists family_heads_status_idx on public.family_heads(status, billing_status);
create index if not exists families_owner_id_idx on public.families(owner_id);
create index if not exists families_owner_email_idx on public.families(lower(owner_email));
create index if not exists family_members_family_id_idx on public.family_members(family_id);
create index if not exists expenses_family_date_idx on public.expenses(family_id, expense_date desc);
create index if not exists expenses_member_id_idx on public.expenses(member_id);
create index if not exists expenses_paid_by_member_id_idx on public.expenses(paid_by_member_id);
create index if not exists payments_family_head_date_idx on public.payments(family_head_id, payment_date desc);
create index if not exists payments_recorded_by_idx on public.payments(recorded_by);
create index if not exists category_budgets_family_id_idx on public.category_budgets(family_id);
create index if not exists family_members_email_idx on public.family_members(lower(email));
create index if not exists payment_items_family_id_idx on public.payment_items(family_id);
create index if not exists payment_items_owner_id_idx on public.payment_items(owner_id);
create index if not exists payment_items_visibility_idx on public.payment_items(visibility);
create index if not exists payment_items_responsible_member_idx on public.payment_items(responsible_member_id);
create index if not exists payment_items_status_idx on public.payment_items(status, recurrence_type);
create index if not exists payment_records_family_period_idx on public.payment_records(family_id, period_start desc);
create index if not exists payment_records_owner_period_idx on public.payment_records(owner_id, period_start desc);
create index if not exists payment_records_visibility_idx on public.payment_records(visibility);
create index if not exists payment_records_item_period_idx on public.payment_records(payment_item_id, period_start);
create index if not exists payment_records_paid_by_idx on public.payment_records(paid_by_member_id);
create unique index if not exists payment_records_proof_path_unique_idx
on public.payment_records(proof_path)
where proof_path is not null;
create index if not exists family_invitations_invitee_email_idx on public.family_invitations(lower(invitee_email), status);
create index if not exists family_invitations_family_idx on public.family_invitations(family_id, created_at desc);
create index if not exists notifications_user_idx on public.notifications(user_id, read_at, created_at desc);
create index if not exists notifications_email_idx on public.notifications(lower(email), read_at, created_at desc);
create index if not exists admin_support_notes_family_idx on public.admin_support_notes(family_id, created_at desc);
create index if not exists admin_audit_logs_family_idx on public.admin_audit_logs(family_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.app_admins enable row level security;
alter table public.family_heads enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.expenses enable row level security;
alter table public.payments enable row level security;
alter table public.category_budgets enable row level security;
alter table public.payment_items enable row level security;
alter table public.payment_records enable row level security;
alter table public.family_invitations enable row level security;
alter table public.notifications enable row level security;
alter table public.admin_support_notes enable row level security;
alter table public.admin_audit_logs enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.app_admins to authenticated;
grant select, insert, update, delete on public.family_heads to authenticated;
grant select, insert, update, delete on public.families to authenticated;
grant select, insert, update, delete on public.family_members to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, update, delete on public.payments to authenticated;
grant select, insert, update, delete on public.category_budgets to authenticated;
grant select, insert, update, delete on public.payment_items to authenticated;
grant select, insert, update, delete on public.payment_records to authenticated;
grant select, insert, update, delete on public.family_invitations to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;
grant select, insert, update, delete on public.admin_support_notes to authenticated;
grant select, insert, update, delete on public.admin_audit_logs to authenticated;

revoke all on function public.handle_new_user_profile() from public;

create or replace function public.has_active_family_plan()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.family_heads
      where lower(family_heads.email) = lower(auth.jwt() ->> 'email')
        and family_heads.status = 'active'
    );
$$;

create or replace function public.can_manage_family_members(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.families
      where families.id = p_family_id
        and families.owner_id = auth.uid()
    )
    and exists (
      select 1
      from public.family_heads
      where lower(family_heads.email) = lower(auth.jwt() ->> 'email')
        and family_heads.status = 'active'
        and family_heads.can_add_members = true
    );
$$;

create or replace function public.is_active_family_participant(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.uid() is not null
    and (
      exists (
        select 1
        from public.app_admins
        where app_admins.user_id = auth.uid()
      )
      or exists (
        select 1
        from public.families
        where families.id = p_family_id
          and families.owner_id = auth.uid()
      )
      or exists (
        select 1
        from public.family_members
        where family_members.family_id = p_family_id
          and family_members.status = 'active'
          and (
            family_members.user_id = auth.uid()
            or lower(family_members.email) = lower(auth.jwt() ->> 'email')
          )
      )
    );
$$;

create or replace function public.create_family_workspace(
  p_name text,
  p_monthly_budget numeric default 0,
  p_currency text default 'USD'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_family_id uuid;
  v_email text := lower(auth.jwt() ->> 'email');
  v_name text;
  v_family_limit integer;
  v_owned_count integer;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  select family_heads.family_limit
  into v_family_limit
  from public.family_heads
  where lower(family_heads.email) = v_email
    and family_heads.status = 'active'
  for update;

  if not found then
    raise exception 'ACTIVE_FAMILY_MEMBERSHIP_REQUIRED';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'FAMILY_NAME_REQUIRED';
  end if;
  if coalesce(p_monthly_budget, 0) < 0 then
    raise exception 'INVALID_MONTHLY_BUDGET';
  end if;
  if upper(coalesce(p_currency, '')) not in ('USD', 'ZAR', 'EUR', 'GBP', 'CAD', 'AUD') then
    raise exception 'INVALID_CURRENCY';
  end if;
  select count(*)::integer
  into v_owned_count
  from public.families
  where owner_id = auth.uid();

  if v_owned_count >= v_family_limit then
    raise exception 'FAMILY_LIMIT_REACHED';
  end if;

  select nullif(btrim(profiles.full_name), '')
  into v_name
  from public.profiles
  where profiles.id = auth.uid();

  insert into public.families (owner_id, owner_email, name, monthly_budget, currency)
  values (auth.uid(), v_email, btrim(p_name), coalesce(p_monthly_budget, 0), upper(p_currency))
  returning id into v_family_id;

  insert into public.family_members (
    family_id, user_id, created_by, name, role, email, avatar_color, status
  )
  values (
    v_family_id,
    auth.uid(),
    auth.uid(),
    coalesce(v_name, v_email, 'Family owner'),
    'Owner',
    v_email,
    '#2563EB',
    'active'
  );

  return v_family_id;
end;
$$;

create or replace function public.invite_family_member(
  p_family_id uuid,
  p_email text,
  p_role text default 'Adult'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(p_email));
  v_profile_id uuid;
  v_profile_name text;
  v_inviter_name text;
  v_family_name text;
  v_invitation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.can_manage_family_members(p_family_id) then
    raise exception 'MEMBER_MANAGEMENT_ACCESS_REQUIRED';
  end if;
  if nullif(v_email, '') is null then
    raise exception 'INVITEE_EMAIL_REQUIRED';
  end if;
  if p_role not in ('Adult', 'Child', 'Teen', 'Other') then
    raise exception 'INVALID_FAMILY_ROLE';
  end if;

  select families.name
  into v_family_name
  from public.families
  where families.id = p_family_id
    and families.owner_id = auth.uid();

  if v_family_name is null then
    raise exception 'FAMILY_OWNER_REQUIRED';
  end if;

  select profiles.id, profiles.full_name
  into v_profile_id, v_profile_name
  from public.profiles
  where lower(profiles.email) = v_email;

  if v_profile_id is null then
    raise exception 'USER_NOT_REGISTERED';
  end if;
  if v_profile_id = auth.uid() then
    raise exception 'CANNOT_INVITE_YOURSELF';
  end if;
  if exists (
    select 1
    from public.family_members
    where family_members.family_id = p_family_id
      and family_members.status = 'active'
      and (
        family_members.user_id = v_profile_id
        or lower(family_members.email) = v_email
      )
  ) then
    raise exception 'ALREADY_FAMILY_MEMBER';
  end if;
  if exists (
    select 1
    from public.family_invitations
    where family_invitations.family_id = p_family_id
      and lower(family_invitations.invitee_email) = v_email
      and family_invitations.status = 'pending'
  ) then
    raise exception 'INVITATION_ALREADY_PENDING';
  end if;

  insert into public.family_invitations (
    family_id, invited_by, invitee_email, invitee_name, role, status
  )
  values (
    p_family_id, auth.uid(), v_email, v_profile_name, p_role, 'pending'
  )
  returning id into v_invitation_id;

  select nullif(btrim(profiles.full_name), '')
  into v_inviter_name
  from public.profiles
  where profiles.id = auth.uid();

  insert into public.notifications (
    user_id, email, created_by, family_id, invitation_id, type, title, body
  )
  values (
    v_profile_id,
    v_email,
    auth.uid(),
    p_family_id,
    v_invitation_id,
    'family_invite',
    'Family invitation',
    coalesce(v_inviter_name, auth.jwt() ->> 'email', 'A family owner')
      || ' invited you to join ' || v_family_name || '.'
  );

  return v_invitation_id;
end;
$$;

create or replace function public.respond_to_family_invitation(
  p_invitation_id uuid,
  p_accept boolean
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation public.family_invitations%rowtype;
  v_member_id uuid;
  v_profile_name text;
  v_email text := lower(auth.jwt() ->> 'email');
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select *
  into v_invitation
  from public.family_invitations
  where family_invitations.id = p_invitation_id
    and lower(family_invitations.invitee_email) = v_email
    and family_invitations.status = 'pending'
  for update;

  if v_invitation.id is null then
    raise exception 'INVITATION_NOT_AVAILABLE';
  end if;

  if not coalesce(p_accept, false) then
    update public.family_invitations
    set status = 'rejected', responded_at = now()
    where id = v_invitation.id;
    return 'rejected';
  end if;

  select nullif(btrim(profiles.full_name), '')
  into v_profile_name
  from public.profiles
  where profiles.id = auth.uid();

  select family_members.id
  into v_member_id
  from public.family_members
  where family_members.family_id = v_invitation.family_id
    and (
      family_members.user_id = auth.uid()
      or lower(family_members.email) = v_email
    )
  limit 1
  for update;

  if v_member_id is null then
    insert into public.family_members (
      family_id, user_id, created_by, name, role, email, avatar_color, status
    )
    values (
      v_invitation.family_id,
      auth.uid(),
      v_invitation.invited_by,
      coalesce(v_invitation.invitee_name, v_profile_name, v_email, 'Family member'),
      v_invitation.role,
      v_email,
      '#10B981',
      'active'
    );
  else
    update public.family_members
    set user_id = auth.uid(),
        email = v_email,
        name = coalesce(v_invitation.invitee_name, v_profile_name, name),
        role = v_invitation.role,
        status = 'active'
    where id = v_member_id;
  end if;

  update public.family_invitations
  set status = 'accepted', responded_at = now()
  where id = v_invitation.id;

  return 'accepted';
end;
$$;

create or replace function public.remove_family_member(
  p_family_id uuid,
  p_member_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.family_members%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.can_manage_family_members(p_family_id) then
    raise exception 'MEMBER_MANAGEMENT_ACCESS_REQUIRED';
  end if;

  select *
  into v_member
  from public.family_members
  where family_members.id = p_member_id
    and family_members.family_id = p_family_id
  for update;

  if v_member.id is null then
    raise exception 'MEMBER_NOT_FOUND';
  end if;
  if v_member.role = 'Owner' or v_member.user_id = auth.uid() then
    raise exception 'CANNOT_REMOVE_FAMILY_OWNER';
  end if;

  update public.family_members
  set status = 'inactive'
  where id = v_member.id;

  return 'removed';
end;
$$;

create or replace function public.delete_family_workspace(p_family_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  delete from public.families
  where families.id = p_family_id
    and families.owner_id = auth.uid();

  if not found then
    raise exception 'FAMILY_NOT_FOUND';
  end if;

  return 'deleted';
end;
$$;

revoke all on function public.has_active_family_plan() from public;
revoke all on function public.can_manage_family_members(uuid) from public;
revoke all on function public.is_active_family_participant(uuid) from public;
revoke all on function public.create_family_workspace(text, numeric, text) from public;
revoke all on function public.invite_family_member(uuid, text, text) from public;
revoke all on function public.respond_to_family_invitation(uuid, boolean) from public;
revoke all on function public.remove_family_member(uuid, uuid) from public;
revoke all on function public.delete_family_workspace(uuid) from public;
grant execute on function public.has_active_family_plan() to authenticated;
grant execute on function public.is_active_family_participant(uuid) to authenticated;
grant execute on function public.create_family_workspace(text, numeric, text) to authenticated;
grant execute on function public.invite_family_member(uuid, text, text) to authenticated;
grant execute on function public.respond_to_family_invitation(uuid, boolean) to authenticated;
grant execute on function public.remove_family_member(uuid, uuid) to authenticated;
grant execute on function public.delete_family_workspace(uuid) to authenticated;

do $$
declare
  realtime_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
      and puballtables = true
  ) then
    return;
  end if;

  foreach realtime_table in array array[
    'profiles',
    'family_heads',
    'families',
    'family_members',
    'payment_items',
    'payment_records',
    'family_invitations',
    'notifications',
    'payments',
    'admin_support_notes'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = realtime_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', realtime_table);
    end if;
  end loop;
end $$;

drop policy if exists "Owners can read their families" on public.families;
drop policy if exists "Owners can create families" on public.families;
drop policy if exists "Owners can update their families" on public.families;
drop policy if exists "Owners can delete their families" on public.families;
drop policy if exists "Owners can read family members" on public.family_members;
drop policy if exists "Owners can create family members" on public.family_members;
drop policy if exists "Owners can update family members" on public.family_members;
drop policy if exists "Owners can delete family members" on public.family_members;
drop policy if exists "Owners can read expenses" on public.expenses;
drop policy if exists "Owners can create expenses" on public.expenses;
drop policy if exists "Owners can update expenses" on public.expenses;
drop policy if exists "Owners can delete expenses" on public.expenses;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
to authenticated
using (
  (select auth.uid()) = id
);

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

drop policy if exists "Admins can read own admin row" on public.app_admins;
create policy "Admins can read own admin row"
on public.app_admins for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Admins and matching heads can read head approvals" on public.family_heads;
drop policy if exists "Admins can read head approvals" on public.family_heads;
create policy "Admins and matching heads can read head approvals"
on public.family_heads for select
to authenticated
using (
  lower(email) = lower((select auth.jwt() ->> 'email'))
  or exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

drop policy if exists "Admins can create head approvals" on public.family_heads;
create policy "Admins can create head approvals"
on public.family_heads for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

drop policy if exists "Admins can update head approvals" on public.family_heads;
create policy "Admins can update head approvals"
on public.family_heads for update
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

drop policy if exists "Admins can delete head approvals" on public.family_heads;
create policy "Admins can delete head approvals"
on public.family_heads for delete
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

drop policy if exists "Approved heads and admins can read families" on public.families;
create policy "Approved heads and admins can read families"
on public.families for select
to authenticated
using (
  public.is_active_family_participant(families.id)
  or exists (
    select 1
    from public.family_invitations
    where family_invitations.family_id = families.id
      and lower(family_invitations.invitee_email) = lower((select auth.jwt() ->> 'email'))
      and family_invitations.status = 'pending'
  )
);

drop policy if exists "Approved heads can create families" on public.families;

drop policy if exists "Approved heads and admins can update families" on public.families;
create policy "Approved heads and admins can update families"
on public.families for update
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
  or owner_id = (select auth.uid())
)
with check (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
  or owner_id = (select auth.uid())
);

drop policy if exists "Approved heads and admins can delete families" on public.families;
create policy "Approved heads and admins can delete families"
on public.families for delete
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

drop policy if exists "Approved heads and admins can read family members" on public.family_members;
create policy "Approved heads and admins can read family members"
on public.family_members for select
to authenticated
using (
  public.is_active_family_participant(family_members.family_id)
);

drop policy if exists "Approved heads and admins can create family members" on public.family_members;
drop policy if exists "Owners and invitees can create family members" on public.family_members;

drop policy if exists "Approved heads and admins can update family members" on public.family_members;
create policy "Approved heads and admins can update family members"
on public.family_members for update
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

drop policy if exists "Approved heads and admins can delete family members" on public.family_members;
create policy "Approved heads and admins can delete family members"
on public.family_members for delete
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

drop policy if exists "Approved heads and admins can read expenses" on public.expenses;
create policy "Approved heads and admins can read expenses"
on public.expenses for select
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.families
    where families.id = expenses.family_id
      and families.owner_id = (select auth.uid())
  )
);

drop policy if exists "Approved heads and admins can create expenses" on public.expenses;
create policy "Approved heads and admins can create expenses"
on public.expenses for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (
    exists (
      select 1
      from public.app_admins
      where app_admins.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.families
      where families.id = expenses.family_id
        and families.owner_id = (select auth.uid())
    )
  )
  and (
    member_id is null
    or exists (
      select 1
      from public.family_members
      where family_members.id = expenses.member_id
        and family_members.family_id = expenses.family_id
    )
  )
  and (
    paid_by_member_id is null
    or exists (
      select 1
      from public.family_members
      where family_members.id = expenses.paid_by_member_id
        and family_members.family_id = expenses.family_id
    )
  )
);

drop policy if exists "Approved heads and admins can update expenses" on public.expenses;
create policy "Approved heads and admins can update expenses"
on public.expenses for update
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.families
    where families.id = expenses.family_id
      and families.owner_id = (select auth.uid())
  )
)
with check (
  user_id = (select auth.uid())
  and (
    exists (
      select 1
      from public.app_admins
      where app_admins.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.families
      where families.id = expenses.family_id
        and families.owner_id = (select auth.uid())
    )
  )
  and (
    member_id is null
    or exists (
      select 1
      from public.family_members
      where family_members.id = expenses.member_id
        and family_members.family_id = expenses.family_id
    )
  )
  and (
    paid_by_member_id is null
    or exists (
      select 1
      from public.family_members
      where family_members.id = expenses.paid_by_member_id
        and family_members.family_id = expenses.family_id
    )
  )
);

drop policy if exists "Approved heads and admins can delete expenses" on public.expenses;
create policy "Approved heads and admins can delete expenses"
on public.expenses for delete
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.families
    where families.id = expenses.family_id
      and families.owner_id = (select auth.uid())
  )
);

drop policy if exists "Owners and admins can read category budgets" on public.category_budgets;
create policy "Owners and admins can read category budgets"
on public.category_budgets for select
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.families
    where families.id = category_budgets.family_id
      and families.owner_id = (select auth.uid())
  )
);

drop policy if exists "Owners and admins can create category budgets" on public.category_budgets;
create policy "Owners and admins can create category budgets"
on public.category_budgets for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (
    exists (
      select 1
      from public.app_admins
      where app_admins.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.families
      where families.id = category_budgets.family_id
        and families.owner_id = (select auth.uid())
    )
  )
);

drop policy if exists "Owners and admins can update category budgets" on public.category_budgets;
create policy "Owners and admins can update category budgets"
on public.category_budgets for update
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.families
    where families.id = category_budgets.family_id
      and families.owner_id = (select auth.uid())
  )
)
with check (
  created_by = (select auth.uid())
  and (
    exists (
      select 1
      from public.app_admins
      where app_admins.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.families
      where families.id = category_budgets.family_id
        and families.owner_id = (select auth.uid())
    )
  )
);

drop policy if exists "Owners and admins can delete category budgets" on public.category_budgets;
create policy "Owners and admins can delete category budgets"
on public.category_budgets for delete
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.families
    where families.id = category_budgets.family_id
      and families.owner_id = (select auth.uid())
  )
);

drop policy if exists "Admins can read payments" on public.payments;
create policy "Admins can read payments"
on public.payments for select
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

drop policy if exists "Admins can create payments" on public.payments;
create policy "Admins can create payments"
on public.payments for insert
to authenticated
with check (
  recorded_by = (select auth.uid())
  and exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

drop policy if exists "Admins can update payments" on public.payments;
create policy "Admins can update payments"
on public.payments for update
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
)
with check (
  recorded_by = (select auth.uid())
  and exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

drop policy if exists "Admins can delete payments" on public.payments;
create policy "Admins can delete payments"
on public.payments for delete
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

drop policy if exists "Members can read their household" on public.families;

drop policy if exists "Matching members can read family members" on public.family_members;

drop policy if exists "Household participants can read payment items" on public.payment_items;
create policy "Household participants can read payment items"
on public.payment_items for select
to authenticated
using (
  (
    payment_items.visibility = 'personal'
    and payment_items.owner_id = (select auth.uid())
  )
  or (
    payment_items.visibility = 'family'
    and public.is_active_family_participant(payment_items.family_id)
  )
);

drop policy if exists "Household owners can create payment items" on public.payment_items;
create policy "Household owners can create payment items"
on public.payment_items for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and owner_id = (select auth.uid())
  and (
    (
      visibility = 'personal'
      and family_id is null
      and responsible_member_id is null
    )
    or (
      visibility = 'family'
      and public.is_active_family_participant(payment_items.family_id)
    )
  )
  and (
    responsible_member_id is null
    or exists (
      select 1
      from public.family_members
      where family_members.id = payment_items.responsible_member_id
        and family_members.family_id = payment_items.family_id
    )
  )
);

drop policy if exists "Household owners can update payment items" on public.payment_items;
create policy "Household owners can update payment items"
on public.payment_items for update
to authenticated
using (
  (
    payment_items.visibility = 'personal'
    and payment_items.owner_id = (select auth.uid())
  )
  or (
    payment_items.visibility = 'family'
    and payment_items.owner_id = (select auth.uid())
    and public.is_active_family_participant(payment_items.family_id)
  )
  or
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.families
    where families.id = payment_items.family_id
      and families.owner_id = (select auth.uid())
  )
)
with check (
  owner_id = (select auth.uid())
  and
  (
    (
      visibility = 'personal'
      and family_id is null
      and responsible_member_id is null
    )
    or (
      visibility = 'family'
      and public.is_active_family_participant(payment_items.family_id)
    )
  )
  and (
    responsible_member_id is null
    or exists (
      select 1
      from public.family_members
      where family_members.id = payment_items.responsible_member_id
        and family_members.family_id = payment_items.family_id
    )
  )
);

drop policy if exists "Household owners can delete payment items" on public.payment_items;
create policy "Household owners can delete payment items"
on public.payment_items for delete
to authenticated
using (
  (
    payment_items.visibility = 'personal'
    and payment_items.owner_id = (select auth.uid())
  )
  or
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.families
    where families.id = payment_items.family_id
      and families.owner_id = (select auth.uid())
  )
);

drop policy if exists "Household participants can read payment records" on public.payment_records;
create policy "Household participants can read payment records"
on public.payment_records for select
to authenticated
using (
  (
    payment_records.visibility = 'personal'
    and payment_records.owner_id = (select auth.uid())
  )
  or (
    payment_records.visibility = 'family'
    and public.is_active_family_participant(payment_records.family_id)
  )
);

drop policy if exists "Household participants can create payment records" on public.payment_records;
create policy "Household participants can create payment records"
on public.payment_records for insert
to authenticated
with check (
  recorded_by = (select auth.uid())
  and owner_id = (select auth.uid())
  and exists (
    select 1
    from public.payment_items
    where payment_items.id = payment_records.payment_item_id
      and coalesce(payment_items.family_id::text, '') = coalesce(payment_records.family_id::text, '')
      and payment_items.visibility = payment_records.visibility
  )
  and (
    (
      visibility = 'personal'
      and family_id is null
    )
    or (
      visibility = 'family'
      and public.is_active_family_participant(payment_records.family_id)
    )
  )
);

drop policy if exists "Household owners can update payment records" on public.payment_records;
create policy "Household owners can update payment records"
on public.payment_records for update
to authenticated
using (
  (
    payment_records.visibility = 'personal'
    and payment_records.owner_id = (select auth.uid())
  )
  or (
    payment_records.visibility = 'family'
    and payment_records.owner_id = (select auth.uid())
    and public.is_active_family_participant(payment_records.family_id)
  )
  or
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.families
    where families.id = payment_records.family_id
      and families.owner_id = (select auth.uid())
  )
)
with check (
  owner_id = (select auth.uid())
  and (
    (
      visibility = 'personal'
      and family_id is null
    )
    or (
      visibility = 'family'
      and public.is_active_family_participant(payment_records.family_id)
    )
  )
);

drop policy if exists "Household owners can delete payment records" on public.payment_records;
create policy "Household owners can delete payment records"
on public.payment_records for delete
to authenticated
using (
  (
    payment_records.visibility = 'personal'
    and payment_records.owner_id = (select auth.uid())
  )
  or
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.families
    where families.id = payment_records.family_id
      and families.owner_id = (select auth.uid())
  )
);

drop policy if exists "Family owners can create invitations" on public.family_invitations;

drop policy if exists "Invitation participants can read invitations" on public.family_invitations;
create policy "Invitation participants can read invitations"
on public.family_invitations for select
to authenticated
using (
  invited_by = (select auth.uid())
  or lower(invitee_email) = lower((select auth.jwt() ->> 'email'))
  or exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

drop policy if exists "Invitees can respond to invitations" on public.family_invitations;

drop policy if exists "Family owners can cancel invitations" on public.family_invitations;
create policy "Family owners can cancel invitations"
on public.family_invitations for delete
to authenticated
using (
  invited_by = (select auth.uid())
  or exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
on public.notifications for select
to authenticated
using (
  user_id = (select auth.uid())
  or lower(email) = lower((select auth.jwt() ->> 'email'))
  or created_by = (select auth.uid())
);

drop policy if exists "Users can create relevant notifications" on public.notifications;
create policy "Users can create relevant notifications"
on public.notifications for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (
    user_id = (select auth.uid())
    or email is not null
    or exists (
      select 1
      from public.app_admins
      where app_admins.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
on public.notifications for update
to authenticated
using (
  user_id = (select auth.uid())
  or lower(email) = lower((select auth.jwt() ->> 'email'))
)
with check (
  user_id = (select auth.uid())
  or lower(email) = lower((select auth.jwt() ->> 'email'))
);

drop policy if exists "Admins can manage support notes" on public.admin_support_notes;
create policy "Admins can manage support notes"
on public.admin_support_notes for all
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
)
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

drop policy if exists "Admins can manage audit logs" on public.admin_audit_logs;
create policy "Admins can manage audit logs"
on public.admin_audit_logs for all
to authenticated
using (
  exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
)
with check (
  actor_id = (select auth.uid())
  and exists (
    select 1
    from public.app_admins
    where app_admins.user_id = (select auth.uid())
  )
);

-- Private proof-of-payment files. Paths are structured as:
-- personal/{user_id}/{file}
-- families/{family_id}/{family_owner_id}/{uploader_id}/{file}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload permitted payment proofs" on storage.objects;
create policy "Users can upload permitted payment proofs"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'payment-proofs'
  and (
    (
      (storage.foldername(name))[1] = 'personal'
      and (storage.foldername(name))[2] = (select auth.uid())::text
    )
    or (
      (storage.foldername(name))[1] = 'families'
      and (storage.foldername(name))[4] = (select auth.uid())::text
      and exists (
        select 1
        from public.families
        where families.id = ((storage.foldername(name))[2])::uuid
          and families.owner_id::text = (storage.foldername(name))[3]
          and public.is_active_family_participant(families.id)
      )
    )
  )
);

drop policy if exists "Users can read permitted payment proofs" on storage.objects;
create policy "Users can read permitted payment proofs"
on storage.objects for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and (
    (
      (storage.foldername(name))[1] = 'personal'
      and (storage.foldername(name))[2] = (select auth.uid())::text
    )
    or (
      (storage.foldername(name))[1] = 'families'
      and public.is_active_family_participant(((storage.foldername(name))[2])::uuid)
    )
    or exists (
      select 1
      from public.app_admins
      where app_admins.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "Owners can delete payment proofs" on storage.objects;
create policy "Owners can delete payment proofs"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'payment-proofs'
  and (
    (
      (storage.foldername(name))[1] = 'personal'
      and (storage.foldername(name))[2] = (select auth.uid())::text
    )
    or (
      (storage.foldername(name))[1] = 'families'
      and (storage.foldername(name))[3] = (select auth.uid())::text
    )
    or exists (
      select 1
      from public.app_admins
      where app_admins.user_id = (select auth.uid())
    )
  )
);

-- After your admin account signs up, run this once in the Supabase SQL Editor:
-- insert into public.app_admins (user_id, email)
-- select id, lower(email)
-- from auth.users
-- where lower(email) = lower('YOUR_ADMIN_EMAIL@example.com')
-- on conflict (user_id) do nothing;
