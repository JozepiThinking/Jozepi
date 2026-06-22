-- ============================================================
-- Políticas RLS para agenda (service_orders + service_order_items)
-- ============================================================

ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_order_items ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name TEXT;
  policy_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['service_orders', 'service_order_items']
  LOOP
    FOREACH policy_name IN ARRAY ARRAY[
      table_name || '_select_own_workshop',
      table_name || '_insert_own_workshop',
      table_name || '_update_own_workshop',
      table_name || '_delete_own_workshop'
    ]
    LOOP
      IF EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = table_name
          AND policyname = policy_name
      ) THEN
        EXECUTE format('DROP POLICY %I ON %I', policy_name, table_name);
      END IF;
    END LOOP;
  END LOOP;
END $$;

CREATE POLICY service_orders_select_own_workshop
  ON service_orders
  FOR SELECT
  TO authenticated
  USING (
    workshop_id IN (
      SELECT profiles.workshop_id
      FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

CREATE POLICY service_orders_insert_own_workshop
  ON service_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    workshop_id IN (
      SELECT profiles.workshop_id
      FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

CREATE POLICY service_orders_update_own_workshop
  ON service_orders
  FOR UPDATE
  TO authenticated
  USING (
    workshop_id IN (
      SELECT profiles.workshop_id
      FROM profiles
      WHERE profiles.id = auth.uid()
    )
  )
  WITH CHECK (
    workshop_id IN (
      SELECT profiles.workshop_id
      FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

CREATE POLICY service_orders_delete_own_workshop
  ON service_orders
  FOR DELETE
  TO authenticated
  USING (
    workshop_id IN (
      SELECT profiles.workshop_id
      FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

CREATE POLICY service_order_items_select_own_workshop
  ON service_order_items
  FOR SELECT
  TO authenticated
  USING (
    service_order_id IN (
      SELECT service_orders.id
      FROM service_orders
      WHERE service_orders.workshop_id IN (
        SELECT profiles.workshop_id
        FROM profiles
        WHERE profiles.id = auth.uid()
      )
    )
  );

CREATE POLICY service_order_items_insert_own_workshop
  ON service_order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    service_order_id IN (
      SELECT service_orders.id
      FROM service_orders
      WHERE service_orders.workshop_id IN (
        SELECT profiles.workshop_id
        FROM profiles
        WHERE profiles.id = auth.uid()
      )
    )
  );

CREATE POLICY service_order_items_update_own_workshop
  ON service_order_items
  FOR UPDATE
  TO authenticated
  USING (
    service_order_id IN (
      SELECT service_orders.id
      FROM service_orders
      WHERE service_orders.workshop_id IN (
        SELECT profiles.workshop_id
        FROM profiles
        WHERE profiles.id = auth.uid()
      )
    )
  )
  WITH CHECK (
    service_order_id IN (
      SELECT service_orders.id
      FROM service_orders
      WHERE service_orders.workshop_id IN (
        SELECT profiles.workshop_id
        FROM profiles
        WHERE profiles.id = auth.uid()
      )
    )
  );

CREATE POLICY service_order_items_delete_own_workshop
  ON service_order_items
  FOR DELETE
  TO authenticated
  USING (
    service_order_id IN (
      SELECT service_orders.id
      FROM service_orders
      WHERE service_orders.workshop_id IN (
        SELECT profiles.workshop_id
        FROM profiles
        WHERE profiles.id = auth.uid()
      )
    )
  );
