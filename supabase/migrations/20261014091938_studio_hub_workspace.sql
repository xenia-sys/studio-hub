-- Single-studio pilot store. End users never read the unfiltered financial snapshot.
-- Next.js authenticates each request, checks membership, and returns role-filtered data.
create table public.studio_hub_workspaces (
  id text primary key check (id = 'main'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint studio_payload_limit check (octet_length(payload::text) <= 20000000)
);

alter table public.studio_hub_workspaces enable row level security;
alter table public.studio_hub_workspaces force row level security;

-- No anon/authenticated policies: direct REST access is deliberately denied.
revoke all on public.studio_hub_workspaces from public, anon, authenticated;
grant select, insert, update on public.studio_hub_workspaces to service_role;

comment on table public.studio_hub_workspaces is
  'Studio Hub pilot: server-only snapshot, optimistic revision, deny-all user RLS. Not procurement data.';
