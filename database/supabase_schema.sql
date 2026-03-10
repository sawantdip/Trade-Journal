-- Supabase schema for TradeJournal

create table if not exists public.accounts (
  email text primary key,
  password text not null,
  name text not null default 'Trader',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  email text primary key references public.accounts(email) on delete cascade,
  display_name text not null default 'Trader',
  initial_capital numeric not null default 0,
  daily_max_loss numeric not null default 5000,
  max_trades_per_day integer not null default 5,
  monthly_target numeric not null default 10000,
  withdrawals jsonb not null default '[]'::jsonb,
  lot_sizes jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists withdrawals jsonb not null default '[]'::jsonb;

create table if not exists public.trades (
  id text primary key,
  email text not null references public.accounts(email) on delete cascade,
  date date not null,
  symbol text not null,
  strike numeric not null default 0,
  option_type text not null default 'CE',
  side text not null default 'Long',
  quantity numeric not null default 1,
  entry numeric not null default 0,
  exit numeric not null default 0,
  stop_loss numeric not null default 0,
  fees numeric not null default 0,
  notes text not null default '',
  created_at bigint not null
);

create index if not exists trades_email_date_idx on public.trades(email, date desc);