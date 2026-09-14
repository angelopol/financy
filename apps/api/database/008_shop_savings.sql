CREATE TABLE IF NOT EXISTS financy_shop_savings (
 id bigserial PRIMARY KEY,
 shop_list_item_id bigint NOT NULL REFERENCES shop_list_items(id) ON DELETE CASCADE,
 user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 direction text NOT NULL CHECK(direction IN ('deposit','withdraw')),
 amount numeric(14,2) NOT NULL,
 reference_type text NOT NULL CHECK(reference_type IN ('earnings','expenses')),
 reference_id bigint NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS financy_shop_savings_item ON financy_shop_savings(shop_list_item_id);
CREATE INDEX IF NOT EXISTS financy_shop_savings_reference ON financy_shop_savings(reference_type,reference_id);
