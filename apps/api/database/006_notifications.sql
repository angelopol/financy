ALTER TABLE expenses ADD COLUMN IF NOT EXISTS last_notified_claim_at timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS limit_notified_month text;
CREATE TABLE IF NOT EXISTS financy_push_subscriptions (
 id bigserial PRIMARY KEY, user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 endpoint text NOT NULL UNIQUE, p256dh text NOT NULL, auth text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS financy_push_subscriptions_user ON financy_push_subscriptions(user_id);
