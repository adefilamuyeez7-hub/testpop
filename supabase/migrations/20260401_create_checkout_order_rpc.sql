-- Migration: Add atomic checkout order creation RPC
-- Description:
--   * Creates create_checkout_order(...) for transactional cart checkout
--   * Validates product availability and stock in SQL
--   * Writes one order plus order_items and decrements stock atomically

CREATE OR REPLACE FUNCTION create_checkout_order(
  p_buyer_wallet TEXT,
  p_items JSONB,
  p_shipping_address_jsonb JSONB DEFAULT NULL,
  p_shipping_eth NUMERIC DEFAULT 0,
  p_tax_eth NUMERIC DEFAULT 0,
  p_currency TEXT DEFAULT 'ETH',
  p_tracking_code TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_now TIMESTAMP WITH TIME ZONE := NOW();
  v_order_id UUID := gen_random_uuid();
  v_item_count INT := 0;
  v_locked_count INT := 0;
  v_total_quantity INT := 0;
  v_subtotal_eth NUMERIC := 0;
  v_shipping_eth NUMERIC := GREATEST(COALESCE(p_shipping_eth, 0), 0);
  v_tax_eth NUMERIC := GREATEST(COALESCE(p_tax_eth, 0), 0);
  v_total_price_eth NUMERIC := 0;
  v_currency TEXT := COALESCE(NULLIF(BTRIM(p_currency), ''), 'ETH');
  v_tracking_code TEXT := COALESCE(NULLIF(BTRIM(p_tracking_code), ''), 'TRK-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 12)));
  v_shipping_address_jsonb JSONB := COALESCE(p_shipping_address_jsonb, '{}'::jsonb);
  v_shipping_address TEXT := '';
  v_single_product_id UUID := NULL;
  v_invalid_product_name TEXT;
  v_invalid_stock_name TEXT;
  v_invalid_stock_left INT;
  v_normalized_items JSONB := '[]'::jsonb;
BEGIN
  IF NULLIF(BTRIM(p_buyer_wallet), '') IS NULL THEN
    RAISE EXCEPTION 'buyer_wallet is required';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'items must be a non-empty array';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'product_id', product_id,
        'quantity', quantity
      )
      ORDER BY product_id
    ),
    '[]'::jsonb
  )
  INTO v_normalized_items
  FROM (
    SELECT
      product_id,
      SUM(quantity)::INT AS quantity
    FROM (
      SELECT
        NULLIF(BTRIM(item->>'product_id'), '')::UUID AS product_id,
        GREATEST(
          CASE
            WHEN COALESCE(item->>'quantity', '') ~ '^\d+$' THEN (item->>'quantity')::INT
            ELSE 1
          END,
          1
        ) AS quantity
      FROM jsonb_array_elements(p_items) AS item
    ) parsed_items
    WHERE product_id IS NOT NULL
    GROUP BY product_id
  ) normalized_items;

  v_item_count := jsonb_array_length(v_normalized_items);

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'At least one order item is required';
  END IF;

  WITH requested_items AS (
    SELECT
      (item->>'product_id')::UUID AS product_id,
      ((item->>'quantity')::INT) AS quantity
    FROM jsonb_array_elements(v_normalized_items) AS item
  ),
  locked_products AS (
    SELECT
      p.id,
      p.name,
      COALESCE(p.price_eth, 0) AS price_eth,
      COALESCE(p.stock, 0) AS stock,
      p.status,
      COALESCE(p.product_type, 'physical') AS product_type,
      r.quantity
    FROM requested_items r
    JOIN products p
      ON p.id = r.product_id
    FOR UPDATE
  )
  SELECT COUNT(*)
  INTO v_locked_count
  FROM locked_products;

  IF v_locked_count <> v_item_count THEN
    RAISE EXCEPTION 'One or more products are no longer available';
  END IF;

  WITH requested_items AS (
    SELECT
      (item->>'product_id')::UUID AS product_id,
      ((item->>'quantity')::INT) AS quantity
    FROM jsonb_array_elements(v_normalized_items) AS item
  ),
  locked_products AS (
    SELECT
      p.id,
      p.name,
      COALESCE(p.stock, 0) AS stock,
      p.status,
      r.quantity
    FROM requested_items r
    JOIN products p
      ON p.id = r.product_id
    FOR UPDATE
  )
  SELECT name
  INTO v_invalid_product_name
  FROM locked_products
  WHERE status IS NOT NULL
    AND status NOT IN ('published', 'active')
  LIMIT 1;

  IF v_invalid_product_name IS NOT NULL THEN
    RAISE EXCEPTION '% is not available for checkout', v_invalid_product_name;
  END IF;

  WITH requested_items AS (
    SELECT
      (item->>'product_id')::UUID AS product_id,
      ((item->>'quantity')::INT) AS quantity
    FROM jsonb_array_elements(v_normalized_items) AS item
  ),
  locked_products AS (
    SELECT
      p.id,
      p.name,
      COALESCE(p.stock, 0) AS stock,
      r.quantity
    FROM requested_items r
    JOIN products p
      ON p.id = r.product_id
    FOR UPDATE
  )
  SELECT
    name,
    GREATEST(stock, 0)
  INTO
    v_invalid_stock_name,
    v_invalid_stock_left
  FROM locked_products
  WHERE stock <= 0
     OR quantity > stock
  LIMIT 1;

  IF v_invalid_stock_name IS NOT NULL THEN
    RAISE EXCEPTION '% only has % left in stock', v_invalid_stock_name, v_invalid_stock_left;
  END IF;

  WITH requested_items AS (
    SELECT
      (item->>'product_id')::UUID AS product_id,
      ((item->>'quantity')::INT) AS quantity
    FROM jsonb_array_elements(v_normalized_items) AS item
  ),
  locked_products AS (
    SELECT
      p.id,
      COALESCE(p.price_eth, 0) AS price_eth,
      r.quantity
    FROM requested_items r
    JOIN products p
      ON p.id = r.product_id
    FOR UPDATE
  )
  SELECT
    COALESCE(SUM(quantity), 0),
    COALESCE(SUM(ROUND(price_eth * quantity, 8)), 0)
  INTO
    v_total_quantity,
    v_subtotal_eth
  FROM locked_products;

  v_subtotal_eth := ROUND(v_subtotal_eth, 8);
  v_shipping_eth := ROUND(v_shipping_eth, 8);
  v_tax_eth := ROUND(v_tax_eth, 8);
  v_total_price_eth := ROUND(v_subtotal_eth + v_shipping_eth + v_tax_eth, 8);

  IF v_item_count = 1 THEN
    v_single_product_id := ((v_normalized_items->0)->>'product_id')::UUID;
  END IF;

  v_shipping_address := CONCAT_WS(
    ', ',
    NULLIF(BTRIM(v_shipping_address_jsonb->>'name'), ''),
    NULLIF(BTRIM(v_shipping_address_jsonb->>'email'), ''),
    NULLIF(BTRIM(v_shipping_address_jsonb->>'phone'), ''),
    NULLIF(BTRIM(v_shipping_address_jsonb->>'street'), ''),
    NULLIF(BTRIM(v_shipping_address_jsonb->>'city'), ''),
    NULLIF(BTRIM(v_shipping_address_jsonb->>'state'), ''),
    NULLIF(BTRIM(v_shipping_address_jsonb->>'postal_code'), ''),
    NULLIF(BTRIM(v_shipping_address_jsonb->>'country'), ''),
    NULLIF(BTRIM(v_shipping_address_jsonb->>'notes'), '')
  );

  v_shipping_address_jsonb := jsonb_strip_nulls(
    v_shipping_address_jsonb || jsonb_build_object('full_address', v_shipping_address)
  );

  INSERT INTO orders (
    id,
    buyer_wallet,
    product_id,
    quantity,
    currency,
    subtotal_eth,
    shipping_eth,
    tax_eth,
    total_price_eth,
    status,
    shipping_address,
    shipping_address_jsonb,
    tracking_code,
    created_at,
    updated_at
  )
  VALUES (
    v_order_id,
    LOWER(BTRIM(p_buyer_wallet)),
    v_single_product_id,
    v_total_quantity,
    v_currency,
    v_subtotal_eth,
    v_shipping_eth,
    v_tax_eth,
    v_total_price_eth,
    'pending',
    v_shipping_address,
    v_shipping_address_jsonb,
    v_tracking_code,
    v_now,
    v_now
  );

  WITH requested_items AS (
    SELECT
      (item->>'product_id')::UUID AS product_id,
      ((item->>'quantity')::INT) AS quantity
    FROM jsonb_array_elements(v_normalized_items) AS item
  ),
  locked_products AS (
    SELECT
      p.id,
      COALESCE(p.price_eth, 0) AS price_eth,
      COALESCE(p.product_type, 'physical') AS product_type,
      r.quantity
    FROM requested_items r
    JOIN products p
      ON p.id = r.product_id
    FOR UPDATE
  )
  INSERT INTO order_items (
    order_id,
    product_id,
    quantity,
    unit_price_eth,
    line_total_eth,
    fulfillment_type,
    delivery_status,
    created_at,
    updated_at
  )
  SELECT
    v_order_id,
    id,
    quantity,
    ROUND(price_eth, 8),
    ROUND(price_eth * quantity, 8),
    CASE
      WHEN product_type IN ('digital', 'hybrid') THEN 'digital'
      ELSE 'physical'
    END,
    'pending',
    v_now,
    v_now
  FROM locked_products;

  WITH requested_items AS (
    SELECT
      (item->>'product_id')::UUID AS product_id,
      ((item->>'quantity')::INT) AS quantity
    FROM jsonb_array_elements(v_normalized_items) AS item
  )
  UPDATE products p
  SET
    stock = GREATEST(COALESCE(p.stock, 0) - r.quantity, 0),
    status = CASE
      WHEN GREATEST(COALESCE(p.stock, 0) - r.quantity, 0) > 0 THEN 'published'
      ELSE 'out_of_stock'
    END,
    updated_at = v_now
  FROM requested_items r
  WHERE p.id = r.product_id;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql;
