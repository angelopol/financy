CREATE TABLE IF NOT EXISTS financy_ai_threads (
 user_id bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 summary text NOT NULL DEFAULT '', summarized_through bigint NOT NULL DEFAULT 0,
 pending_id uuid, lease_until timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS financy_ai_messages (
 id bigserial PRIMARY KEY, user_id bigint NOT NULL REFERENCES financy_ai_threads(user_id) ON DELETE CASCADE,
 request_id uuid NOT NULL, role text NOT NULL CHECK(role IN ('user','model')),
 content text NOT NULL, context_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,request_id,role)
);
CREATE INDEX IF NOT EXISTS financy_ai_messages_user_id ON financy_ai_messages(user_id,id);
