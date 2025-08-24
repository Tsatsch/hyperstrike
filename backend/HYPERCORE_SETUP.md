# Hypercore Database Setup Guide

This guide will help you set up the hypercore database system for your trading application.

## Prerequisites

- PostgreSQL database (Supabase in this case)
- Python 3.8+ with Poetry
- Backend application running

## Database Setup

### 1. Run the SQL Scripts

Execute the following SQL commands in your Supabase SQL editor or PostgreSQL client:

```sql
-- Hypercore Database Tables
-- User Subaccounts
CREATE TABLE IF NOT EXISTS public.user_subaccounts (
  id bigserial primary key,
  user_id bigint not null references public.users(user_id) on delete cascade,
  user_wallet text not null,
  sub_account_pubkey text not null,
  sub_account_privkey text not null,
  timestamp_creation timestamptz not null default now(),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_subaccounts_user_id ON public.user_subaccounts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subaccounts_user_wallet ON public.user_subaccounts(user_wallet);
CREATE INDEX IF NOT EXISTS idx_user_subaccounts_active ON public.user_subaccounts(is_active);

-- Pre-trigger Orders
CREATE TABLE IF NOT EXISTS public.pre_trigger_orders (
  id bigserial primary key,
  user_id bigint not null references public.users(user_id) on delete cascade,
  user_wallet text not null,
  trigger_data jsonb not null,
  position_data jsonb not null,
  created_at timestamptz not null default now()
);

-- Create indexes for pre-trigger orders
CREATE INDEX IF NOT EXISTS idx_pre_trigger_orders_user_id ON public.pre_trigger_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_pre_trigger_orders_user_wallet ON public.pre_trigger_orders(user_wallet);

-- Post-trigger Positions
CREATE TABLE IF NOT EXISTS public.post_trigger_positions (
  id bigserial primary key,
  user_id bigint not null references public.users(user_id) on delete cascade,
  user_wallet text not null,
  cloid text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Create indexes for post-trigger positions
CREATE INDEX IF NOT EXISTS idx_post_trigger_positions_user_id ON public.post_trigger_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_post_trigger_positions_user_wallet ON public.post_trigger_positions(user_wallet);
CREATE INDEX IF NOT EXISTS idx_post_trigger_positions_cloid ON public.post_trigger_positions(cloid);
CREATE INDEX IF NOT EXISTS idx_post_trigger_positions_active ON public.post_trigger_positions(is_active);
```

### 2. Verify Table Creation

Check that the tables were created successfully:

```sql
-- List all tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%hypercore%' OR table_name LIKE '%subaccount%' OR table_name LIKE '%trigger%' OR table_name LIKE '%position%';

-- Check table structure
\d user_subaccounts
\d pre_trigger_orders
\d post_trigger_positions
```

## Application Setup

### 1. Verify Dependencies

Make sure all required Python packages are installed:

```bash
cd backend
poetry install
```

### 2. Environment Variables

Ensure your `.env` file contains the necessary Supabase credentials:

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_key
```

### 3. Test the Setup

Run the test script to verify everything is working:

```bash
cd backend
poetry run python test_hypercore_db.py
```

Expected output:
```
Testing Hypercore Database Operations...
==================================================

1. Testing User Subaccount Creation...
✅ User subaccount created successfully: ID 1

2. Testing User Subaccount Retrieval...
✅ Retrieved 1 subaccounts for user 1
   - ID: 1, Wallet: 0x1234567890abcdef1234567890abcdef12345678, Active: True

3. Testing User Credentials Retrieval...
✅ Retrieved user credentials: ID 1, Active: True

4. Testing Pre-trigger Order Creation...
✅ Pre-trigger order created successfully: ID 1

5. Testing Pre-trigger Order Retrieval...
✅ Retrieved 1 pre-trigger orders for user 1
   - ID: 1, Trigger: {'condition': 'price_above', 'value': 50000}

6. Testing Post-trigger Position Creation...
✅ Post-trigger position created successfully: ID 1

7. Testing Post-trigger Position Retrieval...
✅ Retrieved 1 post-trigger positions for user 1
   - ID: 1, CLOID: cloid123, Active: True

==================================================
✅ All tests completed!
```

## API Endpoints

Once setup is complete, the following endpoints will be available:

### User Subaccounts
- `POST /api/hypercore/subaccounts` - Create user subaccount
- `GET /api/hypercore/subaccounts/{user_id}` - Get user subaccounts
- `GET /api/hypercore/subaccounts/wallet/{user_wallet}` - Get subaccount by wallet
- `PUT /api/hypercore/subaccounts/{subaccount_id}` - Update subaccount
- `GET /api/hypercore/credentials/{user_id}` - Get user credentials (smart filtering)

### Pre-trigger Orders
- `POST /api/hypercore/pre-trigger-orders` - Create pre-trigger order
- `GET /api/hypercore/pre-trigger-orders/{user_id}` - Get user's pre-trigger orders
- `DELETE /api/hypercore/pre-trigger-orders/{order_id}` - Delete pre-trigger order

### Post-trigger Positions
- `POST /api/hypercore/post-trigger-positions` - Create post-trigger position
- `GET /api/hypercore/post-trigger-positions/{user_id}` - Get user's post-trigger positions
- `PUT /api/hypercore/post-trigger-positions/{position_id}` - Update post-trigger position

## Key Features

### Smart Credential Filtering
The system automatically handles multiple subaccount entries:
- If only one entry exists, it's returned regardless of active status
- If multiple entries exist, only active ones (`is_active=true`) are considered
- This prevents credential conflicts and ensures clean data

### JSON Data Storage
- `trigger_data`: Flexible JSON storage for trigger conditions
- `position_data`: JSON storage for futures position information
- Both fields support complex nested structures

### Cascade Deletion
All hypercore tables reference the main `users` table with cascade deletion, ensuring data consistency.

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Verify Supabase credentials in `.env`
   - Check network connectivity
   - Ensure Supabase service is running

2. **Table Not Found**
   - Run the SQL creation scripts again
   - Check table names and schema

3. **Permission Denied**
   - Verify Supabase service key has proper permissions
   - Check RLS (Row Level Security) policies if enabled

4. **Import Errors**
   - Ensure all Python dependencies are installed
   - Check Python path and module imports

### Debug Mode

Enable debug logging by setting the log level:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Security Considerations

### Production Deployment

1. **Encrypt Private Keys**: In production, encrypt `sub_account_privkey` before storing
2. **RLS Policies**: Implement Row Level Security for multi-tenant isolation
3. **API Rate Limiting**: Add rate limiting to prevent abuse
4. **Audit Logging**: Log all database operations for compliance

### Example RLS Policy

```sql
-- Enable RLS
ALTER TABLE user_subaccounts ENABLE ROW LEVEL SECURITY;

-- Create policy for user isolation
CREATE POLICY "Users can only access their own subaccounts" ON user_subaccounts
    FOR ALL USING (auth.uid() = user_id);
```

## Next Steps

1. **Integration**: Connect the hypercore system to your trading logic
2. **Monitoring**: Set up alerts for database performance and errors
3. **Backup**: Implement regular database backups
4. **Scaling**: Consider database connection pooling for high traffic

## Support

If you encounter issues:
1. Check the logs for error messages
2. Verify database connectivity
3. Test with the provided test script
4. Review the API documentation in the main README
