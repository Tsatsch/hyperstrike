## Development

### Run dev server

Run the development server using Poetry:

```bash
poetry run uvicorn app.main:app --reload
```

### Dependency management
use poetry, see https://python-poetry.org/

config file pyproject.toml is in root of backend

```bash
poetry add <dependency>
```
```bash
poetry install
```

```bash
poetry run python ...
```

### Env
create a local .env (dont push!)

Add the following files:

- Backend (`backend/.env`):

```
SUPABASE_URL=
SUPABASE_KEY=
PRIVY_APP_ID=
PRIVY_JWKS_URL=
```

### Database setup

Run the following SQL to create the required tables and indexes:

```sql
-- Users
create table if not exists public.users (
  user_id bigserial primary key,
  wallet_address text unique not null
);

-- Orders
create table if not exists public.orders (
  id bigserial primary key,
  user_id bigint not null references public.users(user_id) on delete cascade,
  wallet text not null,
  platform text not null check (platform in ('hyperevm','hypercore','notifications')),
  "swapData" jsonb not null,
  "orderData" jsonb not null,
  signature text,
  time bigint not null,
  state text not null default 'open' check (state in ('open','closed','deleted')),
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_user_id on public.orders(user_id);
create index if not exists idx_orders_state on public.orders(state);

alter table users add column if not exists xp int not null default 0;
alter table users add column if not exists referral_code text unique;
alter table users add column if not exists referred_by_user_id int references users(user_id);

-- add column xp to user
alter table users add column if not exists xp int not null default 0;
update users set xp = 0 where xp is null;

-- backfill any missing referral codes
update users
set referral_code = concat('U', lpad(user_id::text, 6, '0'))
where referral_code is null;

--daily xp timestamptz
alter table users add column if not exists last_daily_xp_at timestamptz;
```