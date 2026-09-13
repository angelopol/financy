-- Compatible with the final Laravel PostgreSQL schema. Existing tables are preserved.
CREATE TABLE IF NOT EXISTS users (
 id bigserial PRIMARY KEY, name varchar(255) NOT NULL, email varchar(255) UNIQUE NOT NULL,
 email_verified_at timestamp, password varchar(255) NOT NULL, remember_token varchar(100),
 monthly_expense_limit numeric(14,2), created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
);
CREATE TABLE IF NOT EXISTS shop_list_items (
 id bigserial PRIMARY KEY, "user" bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 description varchar(500) NOT NULL, amount numeric(14,2) NOT NULL, provider varchar(20),
 status varchar(20) NOT NULL DEFAULT 'pending', not_discount boolean NOT NULL DEFAULT false,
 created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
);
CREATE TABLE IF NOT EXISTS boxes (id bigserial PRIMARY KEY, "user" bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE, amount numeric(14,2) NOT NULL DEFAULT 0, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
CREATE TABLE IF NOT EXISTS savings (id bigserial PRIMARY KEY, "user" bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE, amount numeric(14,2) NOT NULL DEFAULT 0, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
CREATE TABLE IF NOT EXISTS earnings (
 id bigserial PRIMARY KEY, "user" bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 project_id bigint, description varchar(500) NOT NULL, amount numeric(14,2) NOT NULL,
 provider varchar(20) NOT NULL, term integer, "NextClaim" integer, "UpdatedTerm" timestamp,
 recurring_id bigint REFERENCES earnings(id) ON DELETE SET NULL, slug text,
 recurrence_type varchar(20) NOT NULL DEFAULT 'days', claim_day smallint, auto_claim boolean NOT NULL DEFAULT true,
 currency varchar(20) NOT NULL DEFAULT '$', "OneTimeTase" numeric(14,2), last_notified_claim_at timestamp,
 created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
);
CREATE TABLE IF NOT EXISTS expenses (
 id bigserial PRIMARY KEY, "user" bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 project_id bigint, description varchar(500) NOT NULL, amount numeric(14,2) NOT NULL,
 provider varchar(20) NOT NULL, term integer, "NextClaim" integer, "UpdatedTerm" timestamp,
 recurring_id bigint REFERENCES expenses(id) ON DELETE SET NULL, slug text,
 recurrence_type varchar(20) NOT NULL DEFAULT 'days', claim_day smallint, auto_claim boolean NOT NULL DEFAULT true,
 shop_list_item_id bigint REFERENCES shop_list_items(id) ON DELETE SET NULL,
 created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
);
CREATE TABLE IF NOT EXISTS movements (
 id bigserial PRIMARY KEY, "user" bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 project_id bigint, type varchar(20) NOT NULL, reference_id bigint NOT NULL, description varchar(500) NOT NULL,
 amount numeric(14,2) NOT NULL, provider varchar(20) NOT NULL,
 created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
);
CREATE TABLE IF NOT EXISTS monthly_budgets (
 id bigserial PRIMARY KEY, user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE, month date NOT NULL,
 created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(), UNIQUE(user_id,month)
);
CREATE TABLE IF NOT EXISTS budget_categories (
 id bigserial PRIMARY KEY, monthly_budget_id bigint NOT NULL REFERENCES monthly_budgets(id) ON DELETE CASCADE,
 name varchar(120) NOT NULL, amount numeric(14,2) NOT NULL, slug text NOT NULL,
 created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
);
CREATE TABLE IF NOT EXISTS expense_splits (
 id bigserial PRIMARY KEY, expense_id bigint NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
 user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE, amount numeric(12,2) NOT NULL,
 paid_amount numeric(12,2) NOT NULL DEFAULT 0, status varchar(255) NOT NULL DEFAULT 'pending',
 created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(), UNIQUE(expense_id,user_id)
);
-- All additions are namespaced, leaving Laravel session/reset tables untouched.
CREATE TABLE IF NOT EXISTS financy_sessions (
 token_hash text PRIMARY KEY, user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, confirmed_at timestamptz
);
CREATE TABLE IF NOT EXISTS financy_tokens (
 token_hash text PRIMARY KEY, user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 purpose text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS financy_rate_limits (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS financy_allocations (
 kind text NOT NULL, reference_id bigint NOT NULL, box numeric(14,2) NOT NULL DEFAULT 0,
 savings numeric(14,2) NOT NULL DEFAULT 0, PRIMARY KEY(kind,reference_id)
);
CREATE TABLE IF NOT EXISTS financy_claims (
 kind text NOT NULL, reference_id bigint NOT NULL, due_at text NOT NULL,
 PRIMARY KEY(kind,reference_id,due_at)
);
CREATE TABLE IF NOT EXISTS financy_mail (
 id bigserial PRIMARY KEY, user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 recipient text NOT NULL, subject text NOT NULL, body text NOT NULL, dedupe text UNIQUE NOT NULL,
 sent_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS financy_earnings_user_date ON earnings("user",created_at);
CREATE INDEX IF NOT EXISTS financy_expenses_user_date ON expenses("user",created_at);
CREATE INDEX IF NOT EXISTS financy_sessions_expiry ON financy_sessions(expires_at);

