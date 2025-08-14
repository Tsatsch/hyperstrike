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
create a local .env.local (dont push!) based on template .env

Add the following variables:

- Frontend (`frontend/.env.local`):

```
NEXT_PUBLIC_PRIVY_APP_ID=
```

- Backend (`backend/.env.local`):

```
SUPABASE_URL=
SUPABASE_KEY=
PRIVY_APP_ID=
PRIVY_JWKS_URL=
```

### Database setup

Run the following SQL to create the required tables and indexes:

```sql
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
```