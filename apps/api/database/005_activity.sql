CREATE TABLE IF NOT EXISTS financy_activity (
 id bigserial PRIMARY KEY, user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 source text NOT NULL CHECK(source IN ('user','ai')), kind text NOT NULL, target_id bigint,
 summary text NOT NULL, undo_payload text NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), undone_at timestamptz
);
CREATE INDEX IF NOT EXISTS financy_activity_user ON financy_activity(user_id, id DESC);
