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
# Mark dev mode to use slower defaults
DEV_MODE=true
# Override cleanup interval in seconds (default 180s in dev, 30s in prod)
CLEANUP_INTERVAL_SEC=180
# CORS origins (comma-separated). Make sure your frontend origin is listed exactly.
ALLOWED_ORIGINS=http://localhost:3000
```

### Database setup

Run the following SQL to create the required tables and indexes:

```sql
-- Users
create table if not exists public.users (
  user_id bigserial primary key,
  wallet_address text unique not null,
  xp int not null default 0,
  referral_code text unique,
  referred_by_user_id int references users(user_id),
  last_daily_xp_at timestamptz
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
  state text not null default 'open' check (state in ('open','done_successful','done_failed','successful','failed','deleted')),
  termination_message text,
  created_at timestamptz not null default now()
);

ALTER TABLE public.orders
ADD COLUMN lifetime text
GENERATED ALWAYS AS (("orderData"->'ohlcvTrigger'->>'lifetime')) STORED;

-- Execution details
ALTER TABLE public.orders
ADD COLUMN triggered_price numeric;

ALTER TABLE public.orders
ADD COLUMN actual_outputs jsonb;

ALTER TABLE public.orders
ADD CONSTRAINT orders_actual_outputs_len
CHECK (
  actual_outputs IS NULL OR (
    jsonb_typeof(actual_outputs) = 'array' AND
    jsonb_array_length(actual_outputs) <= 4
  )
);
```

#### orders.swapData JSON structure

The `swapData` column stores the swap request in JSON. It supports both a legacy single-output format and the new multi-output percentage-based format.

- Legacy (single output):
  - `inputToken: string`
  - `inputAmount: number`
  - `outputToken: string`
  - `outputAmount: number`

- New (multi-output percentage-based):
  - `inputToken: string`
  - `inputAmount: number`
  - `outputs: Array<{ token: string; percentage: number }>` with a maximum of 4 items total
  - Optional legacy fields `outputToken` and `outputAmount` may be omitted or kept for compatibility; when present, `outputToken` mirrors the first split token.

Notes:
- Backend validation enforces at most 4 items in `outputs`.
- When `outputs` is provided, percentages represent the split of `inputAmount` per output token.

#### orders.actual_outputs JSON structure

Stores the realized swap results per token after execution (accounts for slippage and fees).

- `actual_outputs: Array<{ token: string; amount: number }>` with a maximum of 4 items total
  - For legacy single-output orders, store a single item reflecting the realized amount
  - `token` should mirror the token identifiers used in `swapData`
  - `amount` is the actual on-chain amount received for that token

#### orders.triggered_price

- `triggered_price: numeric` — price at the moment the order was triggered/evaluated
- Use this to audit execution conditions and for UX display
