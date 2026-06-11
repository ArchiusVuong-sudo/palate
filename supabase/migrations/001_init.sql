-- Palate — AI Marketing Studio for restaurants
-- Core schema: brand, social listening, insights, briefs, creative assets,
-- brand review, posts/approvals, knowledge filesystem, agent runs/events.

create extension if not exists pgcrypto;

-- ============================== Brand =====================================

create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tagline text,
  cuisine text,
  country text not null default 'AU',
  instagram_handle text,
  facebook_page text,
  website text,
  brand_colors jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  suburb text,
  city text,
  state text,
  google_place_id text,
  created_at timestamptz not null default now()
);

create table if not exists connections (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  provider text not null check (provider in ('google_reviews','facebook','instagram','gmail')),
  status text not null default 'demo' check (status in ('demo','connected','error','disconnected')),
  config jsonb not null default '{}',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (brand_id, provider)
);

-- ====================== Workflow 1: Social listening ======================

create table if not exists social_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  source text not null check (source in ('google_reviews','facebook','instagram')),
  kind text not null check (kind in ('review','comment','mention','dm')),
  external_id text,
  author_name text,
  author_handle text,
  rating int check (rating between 1 and 5),
  text text,
  url text,
  media_url text,
  posted_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  sentiment text check (sentiment in ('positive','neutral','negative')),
  sentiment_score numeric,
  topics text[] not null default '{}',
  dish_mentions text[] not null default '{}',
  is_flagged boolean not null default false,
  analyzed_at timestamptz
);

create unique index if not exists social_items_source_ext on social_items (source, external_id) where external_id is not null;
create index if not exists social_items_brand_posted on social_items (brand_id, posted_at desc);
create index if not exists social_items_brand_sentiment on social_items (brand_id, sentiment);

create table if not exists insights (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  for_date date not null,
  kind text not null check (kind in ('highlight','risk','trend','opportunity','summary')),
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  title text not null,
  summary text not null,
  evidence jsonb not null default '[]',
  metrics jsonb not null default '{}',
  status text not null default 'new' check (status in ('new','acknowledged','actioned')),
  run_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists insights_brand_date on insights (brand_id, for_date desc);

create table if not exists proposed_actions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  insight_id uuid references insights(id) on delete set null,
  kind text not null,
  title text not null,
  rationale text,
  payload jsonb not null default '{}',
  status text not null default 'proposed' check (status in ('proposed','approved','dismissed','done')),
  run_id uuid,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists proposed_actions_brand_status on proposed_actions (brand_id, status);

-- ====================== Workflow 2: Content briefs ========================

create table if not exists briefs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  for_date date not null,
  title text not null,
  status text not null default 'draft' check (status in ('draft','in_review','approved','archived')),
  objective text,
  audience text,
  key_message text,
  tone text,
  angle text,
  channels text[] not null default '{instagram_feed}',
  cta text,
  visual_direction text,
  copy_notes text,
  schedule_hint text,
  source_insight_ids uuid[] not null default '{}',
  content jsonb not null default '{}',
  feedback text,
  version int not null default 1,
  run_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists briefs_brand_date on briefs (brand_id, for_date desc);

-- ====================== Workflow 3: Creative assets =======================

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  brief_id uuid references briefs(id) on delete set null,
  kind text not null check (kind in ('image','video','caption')),
  format text,
  variant_label text,
  prompt text,
  model text,
  storage_path text,
  public_url text,
  width int,
  height int,
  duration_seconds numeric,
  caption_text text,
  status text not null default 'candidate' check (status in ('candidate','selected','rejected','published')),
  generation_ms int,
  cost_usd numeric,
  metadata jsonb not null default '{}',
  run_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists assets_brand_brief on assets (brand_id, brief_id, created_at desc);

-- ====================== Workflow 4: Brand review ==========================

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  post_id uuid,
  asset_id uuid references assets(id) on delete cascade,
  verdict text not null check (verdict in ('pass','flag','reject')),
  overall_score numeric,
  scores jsonb not null default '{}',
  feedback text,
  annotated_image_path text,
  annotated_image_url text,
  run_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists reviews_brand_created on reviews (brand_id, created_at desc);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  brief_id uuid references briefs(id) on delete set null,
  channel text not null check (channel in ('instagram_story','instagram_feed','facebook')),
  caption text,
  hashtags text[] not null default '{}',
  asset_ids uuid[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','in_review','changes_requested','approved','scheduled','published')),
  scheduled_at timestamptz,
  published_at timestamptz,
  review_id uuid references reviews(id) on delete set null,
  run_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists posts_brand_status on posts (brand_id, status, created_at desc);

-- ====================== Human-in-the-loop approvals =======================

create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  run_id uuid,
  subject_type text not null,
  subject_id text,
  tool_name text,
  question text not null,
  context jsonb not null default '{}',
  options jsonb not null default '["approve","reject"]',
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  decision text,
  decided_by text,
  note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists approvals_brand_status on approvals (brand_id, status, created_at desc);

-- ====================== Knowledge filesystem (agent memory) ===============

create table if not exists knowledge_files (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  path text not null,
  title text,
  content text not null default '',
  format text not null default 'markdown',
  version int not null default 1,
  updated_by text not null default 'human' check (updated_by in ('human','agent','system')),
  change_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, path)
);

create table if not exists knowledge_revisions (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references knowledge_files(id) on delete cascade,
  version int not null,
  content text not null,
  updated_by text,
  change_note text,
  created_at timestamptz not null default now()
);
create index if not exists knowledge_revisions_file on knowledge_revisions (file_id, version desc);

-- ====================== Agent runtime =====================================

create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  workflow text not null check (workflow in ('listening','briefing','creative','review','copilot','pipeline')),
  trigger text not null default 'manual' check (trigger in ('manual','chat','cron','pipeline')),
  status text not null default 'running' check (status in ('running','awaiting_approval','completed','failed','cancelled')),
  prompt text,
  session_id text,
  model text,
  turns int not null default 0,
  cost_usd numeric not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  summary text,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists agent_runs_brand_started on agent_runs (brand_id, started_at desc);

create table if not exists agent_events (
  id bigint generated always as identity primary key,
  run_id uuid not null references agent_runs(id) on delete cascade,
  seq int not null,
  type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists agent_events_run_seq on agent_events (run_id, seq);

create table if not exists canvas_blocks (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  run_id uuid references agent_runs(id) on delete set null,
  scope text not null default 'dashboard',
  kind text not null check (kind in ('metric','chart','table','markdown','list')),
  title text,
  payload jsonb not null default '{}',
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists canvas_blocks_brand_scope on canvas_blocks (brand_id, scope, created_at desc);

-- ====================== Email outbox ======================================

create table if not exists outbox_emails (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  to_emails text[] not null,
  subject text not null,
  html text not null,
  text_body text,
  status text not null default 'queued' check (status in ('queued','sent','failed')),
  provider text not null default 'outbox',
  error text,
  run_id uuid,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

-- ====================== Copilot chat persistence ==========================

create table if not exists chat_threads (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  title text,
  workflow text not null default 'copilot',
  session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references chat_threads(id) on delete cascade,
  run_id uuid,
  role text not null check (role in ('user','assistant')),
  content text,
  blocks jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_thread on chat_messages (thread_id, created_at);

create table if not exists app_settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- ====================== RLS: lock anon out; service role bypasses =========

do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
