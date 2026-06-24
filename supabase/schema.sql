-- ============================================================
-- Street Doctor SG — Supabase schema (Phase 1)
-- Model: everyone registers. Read = public, write = logged in,
--        moderate (status / remove / delete / resolve flags) = moderator.
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> paste all -> Run.
-- ============================================================

-- ---------- profiles: one row per auth user ----------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  role text not null default 'user' check (role in ('user','moderator')),
  created_at timestamptz not null default now()
);

-- auto-create a profile row whenever someone signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- helper: is the current user a moderator? (security definer avoids RLS recursion)
create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'moderator');
$$;

-- ---------- issues ----------
create table public.issues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,   -- null = seed/system row
  category text not null,
  title text not null,
  description text not null,
  affected_users text[] not null default '{}',
  lng double precision not null,
  lat double precision not null,
  address_text text,
  asset_type text not null default 'street',
  transit_ref text,
  geometry jsonb,                          -- MultiLineString coords, or null
  photos jsonb not null default '[]',      -- data URLs (move to Storage later)
  status text not null default 'published',
  support_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- status history ----------
create table public.status_history (
  id bigint generated always as identity primary key,
  issue_id uuid not null references public.issues on delete cascade,
  old_status text,
  new_status text not null,
  note text,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- comments ----------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues on delete cascade,
  user_id uuid references auth.users on delete set null,
  author_name text,                        -- display name captured at post time
  body text not null,
  created_at timestamptz not null default now()
);

-- ---------- votes (one per user per issue, enforced by the primary key) ----------
create table public.votes (
  issue_id uuid not null references public.issues on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (issue_id, user_id)
);

-- keep issues.support_count in sync with the votes table
-- (security definer so it can update issues despite the moderator-only RLS)
create or replace function public.sync_support_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    update public.issues set support_count = support_count + 1 where id = new.issue_id;
  elsif (tg_op = 'DELETE') then
    update public.issues set support_count = greatest(support_count - 1, 0) where id = old.issue_id;
  end if;
  return null;
end; $$;

create trigger votes_sync_count
  after insert or delete on public.votes
  for each row execute function public.sync_support_count();

-- record the initial "published" history row when an issue is created
-- (security definer so the reporting user doesn't need history-insert rights)
create or replace function public.issue_initial_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.status_history (issue_id, new_status, note, is_public)
  values (new.id, new.status, 'Auto-published on submission.', true);
  return new;
end; $$;

create trigger issues_initial_history
  after insert on public.issues
  for each row execute function public.issue_initial_history();

-- ---------- flags (community moderation) ----------
create table public.flags (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues on delete cascade,
  user_id uuid references auth.users on delete set null,
  reason text not null,
  detail text,
  status text not null default 'open' check (status in ('open','dismissed','upheld')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles       enable row level security;
alter table public.issues         enable row level security;
alter table public.status_history enable row level security;
alter table public.comments       enable row level security;
alter table public.votes          enable row level security;
alter table public.flags          enable row level security;

-- profiles: names are public; you edit only your own row
create policy "profiles readable"   on public.profiles for select using (true);
create policy "insert own profile"  on public.profiles for insert with check (id = auth.uid());
create policy "update own profile"  on public.profiles for update using (id = auth.uid());

-- issues: public statuses visible to all; authors see their own; moderators see all
create policy "issues read" on public.issues for select using (
  status <> 'removed' and status <> 'pending_moderation'
  or user_id = auth.uid()
  or public.is_moderator()
);
create policy "issues insert (logged in)" on public.issues for insert with check (user_id = auth.uid());
create policy "issues moderate"           on public.issues for update using (public.is_moderator());

-- status history: public entries readable by all; only moderators add
create policy "history read"               on public.status_history for select using (is_public or public.is_moderator());
create policy "history insert (moderator)" on public.status_history for insert with check (public.is_moderator());

-- comments: everyone reads; logged-in users post; author or moderator deletes
create policy "comments read"               on public.comments for select using (true);
create policy "comments insert (logged in)" on public.comments for insert with check (user_id = auth.uid());
create policy "comments delete (author/mod)" on public.comments for delete using (user_id = auth.uid() or public.is_moderator());

-- votes: counts are public (support_count); a user manages only their own vote
create policy "votes read"        on public.votes for select using (true);
create policy "votes insert own"  on public.votes for insert with check (user_id = auth.uid());
create policy "votes delete own"  on public.votes for delete using (user_id = auth.uid());

-- flags: logged-in users file them; only moderators read/resolve
create policy "flags insert (logged in)" on public.flags for insert with check (user_id = auth.uid());
create policy "flags read (moderator)"   on public.flags for select using (public.is_moderator());
create policy "flags update (moderator)" on public.flags for update using (public.is_moderator());

-- ============================================================
-- Optional seed so the map isn't empty (system rows, user_id = null).
-- Safe to delete this block if you'd rather start clean.
-- ============================================================
insert into public.issues (category, title, description, affected_users, lng, lat, address_text, status) values
  ('missing-sidewalk',      'No footpath along Jalan Kayu before MRT',        'A 200m stretch has no continuous footpath, forcing pedestrians onto the road shoulder at peak hours.', '{pedestrians,elderly,prams}', 103.8721, 1.3935, 'Jalan Kayu, near Fernvale', 'published'),
  ('unsafe-crossing',       'Long wait, no refuge island at Serangoon junction', 'Only 12 seconds of green for a 4-lane road and no central refuge; elderly residents get stranded.', '{pedestrians,elderly,wheelchair_users}', 103.8736, 1.3496, 'Serangoon Central', 'published'),
  ('accessibility-barrier', 'Kerb ramp missing at Tiong Bahru market',        'The north entrance has a 12cm kerb with no ramp — impossible for wheelchair users.', '{wheelchair_users,elderly,prams}', 103.8316, 1.2853, 'Tiong Bahru Market', 'published');
