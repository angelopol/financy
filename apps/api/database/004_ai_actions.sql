CREATE TABLE IF NOT EXISTS financy_ai_actions (
 id bigserial PRIMARY KEY, user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 kind text NOT NULL, payload text NOT NULL, summary text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','executing','confirmed','cancelled')),
 result text, created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS financy_ai_actions_user ON financy_ai_actions(user_id);
ALTER TABLE financy_ai_messages ADD COLUMN IF NOT EXISTS action_id bigint REFERENCES financy_ai_actions(id) ON DELETE SET NULL;
