SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

DECLARE @vendorId UNIQUEIDENTIFIER;
DECLARE @categoryId UNIQUEIDENTIFIER;
DECLARE @subcategoryId UNIQUEIDENTIFIER;
DECLARE @brandId UNIQUEIDENTIFIER;
DECLARE @genderGroupId UNIQUEIDENTIFIER;
DECLARE @colorId UNIQUEIDENTIFIER;
DECLARE @sizeTypeId UNIQUEIDENTIFIER;
DECLARE @productId UNIQUEIDENTIFIER;
DECLARE @totalStock INT;
DECLARE @insertedIds TABLE (id UNIQUEIDENTIFIER NOT NULL);

SELECT TOP 1 @vendorId = v.id
FROM dbo.vendors v
INNER JOIN dbo.users u ON u.id = v.user_id
WHERE LOWER(u.email) = 'sandbox@vishu.shop';

IF @vendorId IS NULL
BEGIN
  RAISERROR('Sandbox vendor sandbox@vishu.shop was not found.', 16, 1);
END;

SELECT @categoryId = id
FROM dbo.categories
WHERE LOWER(LTRIM(RTRIM(name))) = 'test products';

IF @categoryId IS NULL
BEGIN
  DELETE FROM @insertedIds;
  INSERT INTO dbo.categories (name, is_active, sort_order)
  OUTPUT INSERTED.id INTO @insertedIds
  VALUES ('Test Products', 1, 990);
  SELECT TOP 1 @categoryId = id FROM @insertedIds;
END;

UPDATE dbo.categories
SET is_active = 1,
    sort_order = 990,
    updated_at = SYSDATETIME()
WHERE id = @categoryId;

SELECT @subcategoryId = id
FROM dbo.subcategories
WHERE category_id = @categoryId
  AND LOWER(LTRIM(RTRIM(name))) = 'sandbox';

IF @subcategoryId IS NULL
BEGIN
  DELETE FROM @insertedIds;
  INSERT INTO dbo.subcategories (category_id, name, is_active, sort_order)
  OUTPUT INSERTED.id INTO @insertedIds
  VALUES (@categoryId, 'Sandbox', 1, 0);
  SELECT TOP 1 @subcategoryId = id FROM @insertedIds;
END;

SELECT @sizeTypeId = id
FROM dbo.size_types
WHERE LOWER(LTRIM(RTRIM(name))) = 'clothing';

IF @sizeTypeId IS NULL
BEGIN
  DELETE FROM @insertedIds;
  INSERT INTO dbo.size_types (name, is_active, sort_order)
  OUTPUT INSERTED.id INTO @insertedIds
  VALUES ('Clothing', 1, 10);
  SELECT TOP 1 @sizeTypeId = id FROM @insertedIds;
END;

UPDATE dbo.size_types
SET is_active = 1,
    sort_order = 10,
    updated_at = SYSDATETIME()
WHERE id = @sizeTypeId;

DECLARE @sizeLabels TABLE (label NVARCHAR(20) NOT NULL, sort_order INT NOT NULL);
INSERT INTO @sizeLabels (label, sort_order)
VALUES ('XS', 10), ('S', 20), ('M', 30), ('L', 40), ('XL', 50);

INSERT INTO dbo.sizes (size_type_id, label, is_active, sort_order)
SELECT @sizeTypeId, sl.label, 1, sl.sort_order
FROM @sizeLabels sl
WHERE NOT EXISTS (
  SELECT 1
  FROM dbo.sizes existing
  WHERE existing.size_type_id = @sizeTypeId
    AND existing.label = sl.label
);

UPDATE s
SET is_active = 1,
    sort_order = sl.sort_order,
    updated_at = SYSDATETIME()
FROM dbo.sizes s
INNER JOIN @sizeLabels sl ON sl.label = s.label
WHERE s.size_type_id = @sizeTypeId;

CREATE TABLE #sandbox_products (
  seed_key NVARCHAR(80) NOT NULL PRIMARY KEY,
  title NVARCHAR(255) NOT NULL,
  description NVARCHAR(MAX) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  department NVARCHAR(40) NOT NULL,
  brand_name NVARCHAR(120) NOT NULL,
  gender_name NVARCHAR(80) NOT NULL,
  color NVARCHAR(80) NOT NULL,
  primary_size NVARCHAR(20) NOT NULL,
  image_url NVARCHAR(500) NOT NULL
);

INSERT INTO #sandbox_products (seed_key, title, description, price, department, brand_name, gender_name, color, primary_size, image_url)
VALUES
  ('sandbox-black-tee', 'Sandbox Black Tee', 'Test product for checkout, cart, and public shop display.', 14.90, 'men', 'Sandbox Basics', 'Men', 'black', 'M', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80'),
  ('sandbox-white-tee', 'Sandbox White Tee', 'Clean test tee with simple sizing and stock variants.', 13.90, 'women', 'Sandbox Basics', 'Women', 'white', 'S', 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80'),
  ('sandbox-green-hoodie', 'Sandbox Green Hoodie', 'Comfort hoodie seed item for vendor product testing.', 39.90, 'men', 'Sandbox Street', 'Men', 'green', 'L', 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=80'),
  ('sandbox-cream-sweater', 'Sandbox Cream Sweater', 'Soft sweater test listing for category and search checks.', 34.90, 'women', 'Sandbox Knit', 'Women', 'cream', 'M', 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=900&q=80'),
  ('sandbox-blue-jeans', 'Sandbox Blue Jeans', 'Denim test product with multiple sizes and visible stock.', 44.90, 'men', 'Sandbox Denim', 'Men', 'blue', 'M', 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=900&q=80'),
  ('sandbox-black-dress', 'Sandbox Black Dress', 'Simple dress listing for public product card validation.', 49.90, 'women', 'Sandbox Studio', 'Women', 'black', 'S', 'https://images.unsplash.com/photo-1539008835657-9e8e9680c956?auto=format&fit=crop&w=900&q=80'),
  ('sandbox-kids-jacket', 'Sandbox Kids Jacket', 'Kids jacket seed product for child category testing.', 29.90, 'kids', 'Sandbox Kids', 'Kids', 'yellow', 'M', 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&w=900&q=80'),
  ('sandbox-baby-romper', 'Sandbox Baby Romper', 'Baby romper seed product for baby catalog testing.', 19.90, 'babies', 'Sandbox Baby', 'Babies', 'beige', 'S', 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=900&q=80'),
  ('sandbox-red-sneakers', 'Sandbox Red Sneakers', 'Sneaker-style test product used for image and variant checks.', 59.90, 'men', 'Sandbox Shoes', 'Men', 'red', 'M', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80'),
  ('sandbox-white-sneakers', 'Sandbox White Sneakers', 'White sneaker test listing for product gallery checks.', 54.90, 'women', 'Sandbox Shoes', 'Women', 'white', 'S', 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=900&q=80'),
  ('sandbox-canvas-tote', 'Sandbox Canvas Tote', 'Accessory-style test product for cart and storefront checks.', 18.90, 'women', 'Sandbox Accessories', 'Women', 'beige', 'M', 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=80'),
  ('sandbox-black-cap', 'Sandbox Black Cap', 'Cap seed product for simple inventory testing.', 12.90, 'men', 'Sandbox Accessories', 'Men', 'black', 'M', 'https://images.unsplash.com/photo-1521369909029-2afed882baee?auto=format&fit=crop&w=900&q=80'),
  ('sandbox-pink-blouse', 'Sandbox Pink Blouse', 'Blouse test product for women department filters.', 27.90, 'women', 'Sandbox Studio', 'Women', 'pink', 'M', 'https://images.unsplash.com/photo-1564257631407-4deb1f99d992?auto=format&fit=crop&w=900&q=80'),
  ('sandbox-grey-joggers', 'Sandbox Grey Joggers', 'Joggers seed listing with stock variants for testing.', 31.90, 'men', 'Sandbox Street', 'Men', 'grey', 'L', 'https://images.unsplash.com/photo-1506629905607-d9e297d84520?auto=format&fit=crop&w=900&q=80'),
  ('sandbox-kids-trainers', 'Sandbox Kids Trainers', 'Kids trainer seed product for public shop display.', 24.90, 'kids', 'Sandbox Kids', 'Kids', 'blue', 'S', 'https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=900&q=80');

CREATE TABLE #sandbox_sizes (
  seed_key NVARCHAR(80) NOT NULL,
  size_label NVARCHAR(20) NOT NULL,
  stock INT NOT NULL
);

INSERT INTO #sandbox_sizes (seed_key, size_label, stock)
SELECT seed_key, 'S', 3 FROM #sandbox_products
UNION ALL
SELECT seed_key, 'M', 5 FROM #sandbox_products
UNION ALL
SELECT seed_key, 'L', 4 FROM #sandbox_products;

DECLARE product_cursor CURSOR LOCAL FAST_FORWARD FOR
SELECT seed_key, title, description, price, department, brand_name, gender_name, color, primary_size, image_url
FROM #sandbox_products;

DECLARE @seedKey NVARCHAR(80);
DECLARE @title NVARCHAR(255);
DECLARE @description NVARCHAR(MAX);
DECLARE @price DECIMAL(10, 2);
DECLARE @department NVARCHAR(40);
DECLARE @brandName NVARCHAR(120);
DECLARE @genderName NVARCHAR(80);
DECLARE @color NVARCHAR(80);
DECLARE @primarySize NVARCHAR(20);
DECLARE @imageUrl NVARCHAR(500);

OPEN product_cursor;
FETCH NEXT FROM product_cursor INTO @seedKey, @title, @description, @price, @department, @brandName, @genderName, @color, @primarySize, @imageUrl;

WHILE @@FETCH_STATUS = 0
BEGIN
  SELECT @brandId = id
  FROM dbo.brands
  WHERE LOWER(LTRIM(RTRIM(name))) = LOWER(LTRIM(RTRIM(@brandName)));

  IF @brandId IS NULL
  BEGIN
    DELETE FROM @insertedIds;
    INSERT INTO dbo.brands (name, is_active, sort_order)
    OUTPUT INSERTED.id INTO @insertedIds
    VALUES (@brandName, 1, 980);
    SELECT TOP 1 @brandId = id FROM @insertedIds;
  END
  ELSE
  BEGIN
    UPDATE dbo.brands SET is_active = 1, updated_at = SYSDATETIME() WHERE id = @brandId;
  END;

  SELECT @genderGroupId = id
  FROM dbo.gender_groups
  WHERE LOWER(LTRIM(RTRIM(name))) = LOWER(LTRIM(RTRIM(@genderName)));

  IF @genderGroupId IS NULL
  BEGIN
    DELETE FROM @insertedIds;
    INSERT INTO dbo.gender_groups (name, is_active, sort_order)
    OUTPUT INSERTED.id INTO @insertedIds
    VALUES (@genderName, 1, 980);
    SELECT TOP 1 @genderGroupId = id FROM @insertedIds;
  END
  ELSE
  BEGIN
    UPDATE dbo.gender_groups SET is_active = 1, updated_at = SYSDATETIME() WHERE id = @genderGroupId;
  END;

  SELECT @colorId = id
  FROM dbo.colors
  WHERE LOWER(LTRIM(RTRIM(name))) = LOWER(LTRIM(RTRIM(@color)));

  IF @colorId IS NULL
  BEGIN
    DELETE FROM @insertedIds;
    INSERT INTO dbo.colors (name, is_active, sort_order)
    OUTPUT INSERTED.id INTO @insertedIds
    VALUES (UPPER(LEFT(@color, 1)) + SUBSTRING(@color, 2, LEN(@color)), 1, 980);
    SELECT TOP 1 @colorId = id FROM @insertedIds;
  END
  ELSE
  BEGIN
    UPDATE dbo.colors SET is_active = 1, updated_at = SYSDATETIME() WHERE id = @colorId;
  END;

  SELECT @totalStock = SUM(stock)
  FROM #sandbox_sizes
  WHERE seed_key = @seedKey;

  SELECT TOP 1 @productId = id
  FROM dbo.products
  WHERE vendor_id = @vendorId
    AND title = @title;

  IF @productId IS NULL
  BEGIN
    DELETE FROM @insertedIds;
    INSERT INTO dbo.products (
      vendor_id, title, description, price, stock, is_listed, department, category,
      brand_id, category_id, subcategory_id, gender_group_id, color, size, product_code
    )
    OUTPUT INSERTED.id INTO @insertedIds
    VALUES (
      @vendorId, @title, @description, @price, @totalStock, 1, @department, 'test-products',
      @brandId, @categoryId, @subcategoryId, @genderGroupId, @color, @primarySize,
      CONCAT('TST-', UPPER(LEFT(REPLACE(@seedKey, 'sandbox-', ''), 8)))
    );
    SELECT TOP 1 @productId = id FROM @insertedIds;
  END
  ELSE
  BEGIN
    UPDATE dbo.products
    SET description = @description,
        price = @price,
        stock = @totalStock,
        is_listed = 1,
        department = @department,
        category = 'test-products',
        brand_id = @brandId,
        category_id = @categoryId,
        subcategory_id = @subcategoryId,
        gender_group_id = @genderGroupId,
        color = @color,
        size = @primarySize,
        updated_at = SYSDATETIME()
    WHERE id = @productId;
  END;

  DELETE FROM dbo.product_colors WHERE product_id = @productId;
  INSERT INTO dbo.product_colors (product_id, color_id, sort_order)
  VALUES (@productId, @colorId, 0);

  DELETE FROM dbo.product_sizes WHERE product_id = @productId;
  INSERT INTO dbo.product_sizes (product_id, size_id, stock, sku, updated_at)
  SELECT @productId, s.id, ss.stock, CONCAT('TST-', UPPER(LEFT(REPLACE(@seedKey, 'sandbox-', ''), 8)), '-', ss.size_label), SYSDATETIME()
  FROM #sandbox_sizes ss
  INNER JOIN dbo.sizes s
    ON s.size_type_id = @sizeTypeId
   AND s.label = ss.size_label
  WHERE ss.seed_key = @seedKey;

  DELETE FROM dbo.product_images WHERE product_id = @productId;
  INSERT INTO dbo.product_images (product_id, image_url, sort_order)
  VALUES (@productId, @imageUrl, 0);

  SET @productId = NULL;
  SET @brandId = NULL;
  SET @genderGroupId = NULL;
  SET @colorId = NULL;
  SET @totalStock = NULL;

  FETCH NEXT FROM product_cursor INTO @seedKey, @title, @description, @price, @department, @brandName, @genderName, @color, @primarySize, @imageUrl;
END;

CLOSE product_cursor;
DEALLOCATE product_cursor;

COMMIT TRANSACTION;

SELECT
  v.shop_name,
  COUNT(p.id) AS sandbox_product_count
FROM dbo.vendors v
LEFT JOIN dbo.products p ON p.vendor_id = v.id
WHERE v.id = @vendorId
GROUP BY v.shop_name;
