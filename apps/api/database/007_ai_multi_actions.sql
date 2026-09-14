ALTER TABLE financy_ai_actions ADD COLUMN IF NOT EXISTS message_id bigint REFERENCES financy_ai_messages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS financy_ai_actions_message ON financy_ai_actions(message_id);
