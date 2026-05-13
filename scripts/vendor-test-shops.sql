/*
  Vendor test-shop helper.

  This is intentionally database-only. It does not change storefront views.
  Run the SELECT first. Uncomment the DELETE only when you are ready to remove
  test vendors and their cascade-linked vendor data.
*/

IF COL_LENGTH('dbo.vendors', 'is_test') IS NULL
BEGIN
  ALTER TABLE dbo.vendors ADD is_test BIT NOT NULL CONSTRAINT df_vendors_is_test DEFAULT 0;
END;

-- Current convention: EL-DO and ADA BUTIQUE are real vendors; all other
-- current vendors are test.
UPDATE dbo.vendors
SET is_test = CASE
  WHEN LOWER(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(shop_name)), ' ', ''), '-', ''), '_', '')) = 'eldo' THEN 0
  WHEN LOWER(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(shop_name)), ' ', ''), '-', ''), '_', '')) = 'adabutique' THEN 0
  ELSE 1
END,
updated_at = SYSDATETIME();

SELECT
  id,
  shop_name,
  is_test,
  is_active,
  is_verified,
  admin_status,
  created_at
FROM dbo.vendors
ORDER BY is_test ASC, shop_name ASC;

-- Uncomment only when you are ready to delete test shops.
-- DELETE FROM dbo.vendors
-- WHERE is_test = 1;
