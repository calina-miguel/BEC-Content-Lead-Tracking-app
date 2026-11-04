create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  customer_email text not null default coalesce(auth.jwt() ->> 'email', ''),
  name text not null check (char_length(name) between 1 and 120),
  organization text not null check (char_length(organization) between 1 and 160),
  email text not null default '' check (char_length(email) <= 254),
  phone text not null default '' check (char_length(phone) <= 40),
  product_id text not null,
  notes text not null default '' check (char_length(notes) <= 600),
  status text not null default 'New' check (status in ('New', 'Contacted', 'Qualified', 'Closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email <> '' or phone <> '')
);

alter table public.leads
  add column if not exists customer_email text;

update public.leads as lead
set customer_email = coalesce(customer.email, '')
from auth.users as customer
where lead.owner_id = customer.id
  and lead.customer_email is null;

update public.leads
set customer_email = ''
where customer_email is null;

alter table public.leads
  alter column customer_email set default coalesce(auth.jwt() ->> 'email', ''),
  alter column customer_email set not null;

create index if not exists leads_owner_created_at_idx
  on public.leads (owner_id, created_at desc);

create table if not exists public.lead_activity (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  lead_id uuid,
  customer_email text not null,
  subject text not null,
  action text not null check (action in ('created', 'updated', 'deleted', 'signed_in', 'sign_out_requested', 'exported', 'campaign_submitted')),
  previous_status text,
  new_status text,
  created_at timestamptz not null default now()
);

alter table public.lead_activity
  add column if not exists customer_email text;

alter table public.lead_activity
  alter column lead_id drop not null,
  drop constraint if exists lead_activity_action_check;

alter table public.lead_activity
  add constraint lead_activity_action_check
  check (action in ('created', 'updated', 'deleted', 'signed_in', 'sign_out_requested', 'exported', 'campaign_submitted'));

update public.lead_activity as activity
set customer_email = coalesce(customer.email, '')
from auth.users as customer
where activity.owner_id = customer.id
  and activity.customer_email is null;

update public.lead_activity
set customer_email = ''
where customer_email is null;

alter table public.lead_activity
  alter column customer_email set not null;

create index if not exists lead_activity_owner_created_at_idx
  on public.lead_activity (owner_id, created_at desc);

alter table public.leads enable row level security;
alter table public.lead_activity enable row level security;

create or replace function public.is_bec_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'bec_staff', false);
$$;

revoke all on function public.is_bec_staff() from public, anon;
grant execute on function public.is_bec_staff() to authenticated;

drop policy if exists "Owners can read their leads" on public.leads;
create policy "Owners can read their leads"
  on public.leads for select to authenticated
  using ((select auth.uid()) = owner_id or (select public.is_bec_staff()));

drop policy if exists "Owners can add their leads" on public.leads;
create policy "Owners can add their leads"
  on public.leads for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and lower(customer_email) = lower((select auth.jwt() ->> 'email'))
    and status = 'New'
  );

drop policy if exists "Owners can update their leads" on public.leads;
drop policy if exists "BEC staff can update customer leads" on public.leads;
create policy "BEC staff can update customer leads"
  on public.leads for update to authenticated
  using ((select public.is_bec_staff()))
  with check ((select public.is_bec_staff()));

drop policy if exists "Owners can delete their leads" on public.leads;
drop policy if exists "BEC staff can delete customer leads" on public.leads;
create policy "BEC staff can delete customer leads"
  on public.leads for delete to authenticated
  using ((select public.is_bec_staff()));

drop policy if exists "Owners can read their activity" on public.lead_activity;
create policy "Owners can read their activity"
  on public.lead_activity for select to authenticated
  using ((select auth.uid()) = owner_id or (select public.is_bec_staff()));

grant select, delete on public.leads to authenticated;
revoke insert, update on public.leads from authenticated;
grant insert (name, organization, email, phone, product_id, notes)
  on public.leads to authenticated;
grant update (status) on public.leads to authenticated;
grant select on public.lead_activity to authenticated;
revoke all on public.leads, public.lead_activity from anon;
revoke insert, update, delete on public.lead_activity from authenticated;

create or replace function public.update_lead_timestamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.log_lead_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.lead_activity (owner_id, lead_id, customer_email, subject, action, previous_status)
    values (old.owner_id, old.id, old.customer_email, old.name, 'deleted', old.status);
    return old;
  end if;

  if tg_op = 'INSERT' then
    insert into public.lead_activity (owner_id, lead_id, customer_email, subject, action, new_status)
    values (new.owner_id, new.id, new.customer_email, new.name, 'created', new.status);
    return new;
  end if;

  insert into public.lead_activity (owner_id, lead_id, customer_email, subject, action, previous_status, new_status)
  values (new.owner_id, new.id, new.customer_email, new.name, 'updated', old.status, new.status);
  return new;
end;
$$;

create or replace function public.log_account_activity(p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_email text;
  account_type text;
begin
  if auth.uid() is null then
    raise exception 'Sign in is required to record account activity.';
  end if;
  if p_action not in ('signed_in', 'sign_out_requested', 'exported') then
    raise exception 'Unsupported account activity.';
  end if;

  account_email := auth.jwt() ->> 'email';
  account_type := case
    when auth.jwt() -> 'app_metadata' ->> 'role' = 'bec_staff' then 'BEC staff account'
    else 'Customer account'
  end;
  if account_email is null or account_email = '' then
    raise exception 'An account email is required to record activity.';
  end if;

  insert into public.lead_activity (owner_id, customer_email, subject, action)
  values (auth.uid(), account_email, account_type, p_action);
end;
$$;

drop trigger if exists leads_update_timestamp on public.leads;
create trigger leads_update_timestamp
  before update on public.leads
  for each row execute function public.update_lead_timestamp();

drop trigger if exists leads_record_activity on public.leads;
create trigger leads_record_activity
  after insert or update or delete on public.leads
  for each row execute function public.log_lead_activity();

revoke all on function public.update_lead_timestamp() from public, anon, authenticated;
revoke all on function public.log_lead_activity() from public, anon, authenticated;
revoke all on function public.log_account_activity(text) from public, anon;
grant execute on function public.log_account_activity(text) to authenticated;

create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('Facebook', 'Instagram', 'LinkedIn', 'X', 'YouTube')),
  account_name text not null check (char_length(btrim(account_name)) between 1 and 80),
  account_handle text not null check (char_length(btrim(account_handle)) between 1 and 200),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists social_accounts_platform_handle_idx
  on public.social_accounts (platform, lower(account_handle));

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete cascade,
  product_id text not null check (char_length(btrim(product_id)) between 1 and 100),
  objective text not null check (objective in ('awareness', 'education', 'consultation', 'launch')),
  audience text not null default '' check (char_length(audience) <= 120),
  key_message text not null default '' check (char_length(key_message) <= 500),
  call_to_action text not null default '' check (char_length(call_to_action) <= 100),
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_submissions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  social_account_id uuid references public.social_accounts (id) on delete set null,
  platform text not null check (platform in ('Facebook', 'Instagram', 'LinkedIn', 'X', 'YouTube')),
  account_name text not null check (char_length(account_name) between 1 and 80),
  account_handle text not null check (char_length(account_handle) between 1 and 200),
  content text not null check (char_length(content) between 1 and 3000),
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'rejected', 'published')),
  created_at timestamptz not null default now(),
  unique (campaign_id, social_account_id)
);

create index if not exists campaigns_created_at_idx
  on public.campaigns (created_at desc);
create index if not exists campaign_submissions_campaign_idx
  on public.campaign_submissions (campaign_id, created_at);

alter table public.social_accounts enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_submissions enable row level security;

drop policy if exists "BEC staff can read social accounts" on public.social_accounts;
create policy "BEC staff can read social accounts"
  on public.social_accounts for select to authenticated
  using ((select public.is_bec_staff()));

drop policy if exists "BEC staff can add social accounts" on public.social_accounts;
create policy "BEC staff can add social accounts"
  on public.social_accounts for insert to authenticated
  with check ((select public.is_bec_staff()) and (select auth.uid()) = created_by);

drop policy if exists "BEC staff can update social accounts" on public.social_accounts;
create policy "BEC staff can update social accounts"
  on public.social_accounts for update to authenticated
  using ((select public.is_bec_staff()))
  with check ((select public.is_bec_staff()));

drop policy if exists "BEC staff can remove social accounts" on public.social_accounts;
create policy "BEC staff can remove social accounts"
  on public.social_accounts for delete to authenticated
  using ((select public.is_bec_staff()));

drop policy if exists "BEC staff can read campaigns" on public.campaigns;
create policy "BEC staff can read campaigns"
  on public.campaigns for select to authenticated
  using ((select public.is_bec_staff()));

drop policy if exists "BEC staff can read campaign submissions" on public.campaign_submissions;
create policy "BEC staff can read campaign submissions"
  on public.campaign_submissions for select to authenticated
  using ((select public.is_bec_staff()));

grant select, insert, update, delete on public.social_accounts to authenticated;
grant select on public.campaigns, public.campaign_submissions to authenticated;
revoke all on public.social_accounts, public.campaigns, public.campaign_submissions from anon;
revoke insert, update, delete on public.campaigns, public.campaign_submissions from authenticated;

create or replace function public.submit_campaign(
  p_product_id text,
  p_objective text,
  p_audience text,
  p_key_message text,
  p_call_to_action text,
  p_targets jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  campaign_id uuid;
  target jsonb;
  account public.social_accounts%rowtype;
  staff_email text;
  target_count integer;
begin
  if auth.uid() is null or not public.is_bec_staff() then
    raise exception 'BEC staff access is required to submit campaigns.';
  end if;
  if p_product_id is null or char_length(btrim(p_product_id)) not between 1 and 100 then
    raise exception 'Select a valid product.';
  end if;
  if p_objective not in ('awareness', 'education', 'consultation', 'launch') then
    raise exception 'Select a valid campaign goal.';
  end if;
  if char_length(coalesce(p_audience, '')) > 120
    or char_length(coalesce(p_key_message, '')) > 500
    or char_length(coalesce(p_call_to_action, '')) > 100 then
    raise exception 'Campaign details exceed the allowed length.';
  end if;
  if p_targets is null or jsonb_typeof(p_targets) <> 'array' then
    raise exception 'Select at least one social destination.';
  end if;
  target_count := jsonb_array_length(p_targets);
  if target_count < 1 then
    raise exception 'Select at least one social destination.';
  end if;
  if (select count(distinct value ->> 'account_id') from jsonb_array_elements(p_targets)) <> target_count then
    raise exception 'A social destination may only be selected once.';
  end if;
  staff_email := auth.jwt() ->> 'email';
  if staff_email is null or staff_email = '' then
    raise exception 'A staff account email is required to record this campaign.';
  end if;

  insert into public.campaigns (
    created_by, product_id, objective, audience, key_message, call_to_action
  ) values (
    auth.uid(), btrim(p_product_id), p_objective, coalesce(p_audience, ''),
    coalesce(p_key_message, ''), coalesce(p_call_to_action, '')
  ) returning id into campaign_id;

  for target in select value from jsonb_array_elements(p_targets)
  loop
    if jsonb_typeof(target) <> 'object'
      or coalesce(target ->> 'account_id', '') = ''
      or char_length(coalesce(target ->> 'content', '')) not between 1 and 3000 then
      raise exception 'A campaign destination or its content is invalid.';
    end if;

    select * into account
    from public.social_accounts
    where id = (target ->> 'account_id')::uuid;
    if not found then
      raise exception 'A selected social destination no longer exists.';
    end if;

    insert into public.campaign_submissions (
      campaign_id, social_account_id, platform, account_name, account_handle, content
    ) values (
      campaign_id, account.id, account.platform, account.account_name, account.account_handle,
      target ->> 'content'
    );
  end loop;

  insert into public.lead_activity (owner_id, customer_email, subject, action)
  values (auth.uid(), staff_email, 'Campaign: ' || btrim(p_product_id), 'campaign_submitted');

  return campaign_id;
end;
$$;

revoke all on function public.submit_campaign(text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.submit_campaign(text, text, text, text, text, jsonb) to authenticated;
