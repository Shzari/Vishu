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

DECLARE @categoryId UNIQUEIDENTIFIER;
DECLARE @subcategoryId UNIQUEIDENTIFIER;
DECLARE @sizeTypeId UNIQUEIDENTIFIER;
DECLARE @brandId UNIQUEIDENTIFIER;
DECLARE @insertedIds TABLE (id UNIQUEIDENTIFIER NOT NULL);

SELECT @categoryId = id
FROM dbo.categories
WHERE LOWER(LTRIM(RTRIM(name))) = 'shoes';

IF @categoryId IS NULL
BEGIN
  DELETE FROM @insertedIds;
  INSERT INTO dbo.categories (name, is_active, sort_order)
  OUTPUT INSERTED.id INTO @insertedIds
  VALUES ('Shoes', 1, 140);
  SELECT TOP 1 @categoryId = id FROM @insertedIds;
END;

UPDATE dbo.categories
SET is_active = 1,
    sort_order = 140,
    updated_at = SYSDATETIME()
WHERE id = @categoryId;

SELECT @subcategoryId = id
FROM dbo.subcategories
WHERE category_id = @categoryId
  AND LOWER(LTRIM(RTRIM(name))) = 'shoes';

IF @subcategoryId IS NULL
BEGIN
  DELETE FROM @insertedIds;
  INSERT INTO dbo.subcategories (category_id, name, is_active, sort_order)
  OUTPUT INSERTED.id INTO @insertedIds
  VALUES (@categoryId, 'Shoes', 1, 0);
  SELECT TOP 1 @subcategoryId = id FROM @insertedIds;
END;

SELECT @sizeTypeId = id
FROM dbo.size_types
WHERE LOWER(LTRIM(RTRIM(name))) = 'shoe eu';

IF @sizeTypeId IS NULL
BEGIN
  DELETE FROM @insertedIds;
  INSERT INTO dbo.size_types (name, is_active, sort_order)
  OUTPUT INSERTED.id INTO @insertedIds
  VALUES ('Shoe EU', 1, 40);
  SELECT TOP 1 @sizeTypeId = id FROM @insertedIds;
END;

UPDATE dbo.size_types
SET is_active = 1,
    sort_order = 40,
    updated_at = SYSDATETIME()
WHERE id = @sizeTypeId;

DECLARE @size INT = 20;
WHILE @size <= 44
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM dbo.sizes
    WHERE size_type_id = @sizeTypeId
      AND label = CONVERT(NVARCHAR(10), @size)
  )
  BEGIN
    INSERT INTO dbo.sizes (size_type_id, label, is_active, sort_order)
    VALUES (@sizeTypeId, CONVERT(NVARCHAR(10), @size), 1, @size * 10);
  END
  ELSE
  BEGIN
    UPDATE dbo.sizes
    SET is_active = 1,
        sort_order = @size * 10,
        updated_at = SYSDATETIME()
    WHERE size_type_id = @sizeTypeId
      AND label = CONVERT(NVARCHAR(10), @size);
  END;

  SET @size += 1;
END;

CREATE TABLE #shoe_products (
  seed_key NVARCHAR(80) NOT NULL PRIMARY KEY,
  vendor_email NVARCHAR(255) NOT NULL,
  brand_name NVARCHAR(120) NOT NULL,
  title NVARCHAR(255) NOT NULL,
  description NVARCHAR(MAX) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  department NVARCHAR(40) NOT NULL,
  color NVARCHAR(80) NOT NULL,
  primary_size NVARCHAR(20) NOT NULL
);

CREATE TABLE #shoe_sizes (
  seed_key NVARCHAR(80) NOT NULL,
  size_label NVARCHAR(20) NOT NULL,
  stock INT NOT NULL
);

CREATE TABLE #shoe_images (
  seed_key NVARCHAR(80) NOT NULL,
  image_url NVARCHAR(500) NOT NULL,
  sort_order INT NOT NULL
);

INSERT INTO #shoe_products (seed_key, vendor_email, brand_name, title, description, price, department, color, primary_size)
VALUES
  ('metro-runner', 'duafashion@gmail.vom', 'Nike', 'Metro Runner Sneakers', 'Lightweight black running-inspired sneakers with a cushioned everyday sole.', 74.90, 'men', 'black', '40'),
  ('leather-city-boots', 'shzariqi@hotmail.com', 'Timberland', 'Leather City Boots', 'Brown leather boots with a structured profile for denim, coats, and colder days.', 118.00, 'men', 'brown', '40'),
  ('white-court-sneakers', 'duafashion@gmail.vom', 'Adidas', 'Soft White Court Sneakers', 'Clean white sneakers with a low profile, soft lining, and versatile daily styling.', 69.00, 'women', 'white', '36'),
  ('blush-strap-sandals', 'shzariqi@hotmail.com', 'Puma', 'Blush Strap Sandals', 'Light pink strap sandals with a comfortable flat sole for warm-weather outfits.', 42.00, 'women', 'pink', '36'),
  ('kids-playground-trainers', 'duafashion@gmail.vom', 'Skechers', 'Kids Playground Trainers', 'Durable blue trainers for active kids, with easy styling and a grippy sole.', 39.00, 'kids', 'blue', '28'),
  ('baby-first-step', 'shzariqi@hotmail.com', 'Geox', 'Baby First-Step Shoes', 'Soft beige first-step shoes for babies, built for gentle support and easy dressing.', 27.00, 'babies', 'beige', '20');

INSERT INTO #shoe_sizes (seed_key, size_label, stock)
VALUES
  ('metro-runner', '40', 4), ('metro-runner', '41', 6), ('metro-runner', '42', 8), ('metro-runner', '43', 5), ('metro-runner', '44', 3),
  ('leather-city-boots', '40', 2), ('leather-city-boots', '41', 4), ('leather-city-boots', '42', 5), ('leather-city-boots', '43', 4), ('leather-city-boots', '44', 2),
  ('white-court-sneakers', '36', 5), ('white-court-sneakers', '37', 7), ('white-court-sneakers', '38', 8), ('white-court-sneakers', '39', 6), ('white-court-sneakers', '40', 3),
  ('blush-strap-sandals', '36', 3), ('blush-strap-sandals', '37', 5), ('blush-strap-sandals', '38', 5), ('blush-strap-sandals', '39', 4), ('blush-strap-sandals', '40', 2),
  ('kids-playground-trainers', '28', 4), ('kids-playground-trainers', '29', 5), ('kids-playground-trainers', '30', 6), ('kids-playground-trainers', '31', 5), ('kids-playground-trainers', '32', 4), ('kids-playground-trainers', '33', 3),
  ('baby-first-step', '20', 4), ('baby-first-step', '21', 5), ('baby-first-step', '22', 4), ('baby-first-step', '23', 3), ('baby-first-step', '24', 2);

INSERT INTO #shoe_images (seed_key, image_url, sort_order)
VALUES
  ('metro-runner', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80', 0),
  ('metro-runner', 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=900&q=80', 1),
  ('leather-city-boots', 'https://images.unsplash.com/photo-1608256246200-53e8b47b9871?auto=format&fit=crop&w=900&q=80', 0),
  ('white-court-sneakers', 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=900&q=80', 0),
  ('white-court-sneakers', 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=900&q=80', 1),
  ('blush-strap-sandals', 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=900&q=80', 0),
  ('kids-playground-trainers', 'https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=900&q=80', 0),
  ('baby-first-step', 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=900&q=80', 0);

DECLARE @seedKey NVARCHAR(80);
DECLARE @vendorEmail NVARCHAR(255);
DECLARE @brandName NVARCHAR(120);
DECLARE @title NVARCHAR(255);
DECLARE @description NVARCHAR(MAX);
DECLARE @price DECIMAL(10, 2);
DECLARE @department NVARCHAR(40);
DECLARE @color NVARCHAR(80);
DECLARE @primarySize NVARCHAR(20);
DECLARE @vendorId UNIQUEIDENTIFIER;
DECLARE @productId UNIQUEIDENTIFIER;
DECLARE @genderGroupId UNIQUEIDENTIFIER;
DECLARE @colorId UNIQUEIDENTIFIER;
DECLARE @totalStock INT;

DECLARE shoe_cursor CURSOR LOCAL FAST_FORWARD FOR
SELECT seed_key, vendor_email, brand_name, title, description, price, department, color, primary_size
FROM #shoe_products;

OPEN shoe_cursor;
FETCH NEXT FROM shoe_cursor INTO @seedKey, @vendorEmail, @brandName, @title, @description, @price, @department, @color, @primarySize;

WHILE @@FETCH_STATUS = 0
BEGIN
  SELECT TOP 1 @vendorId = v.id
  FROM dbo.vendors v
  INNER JOIN dbo.users u ON u.id = v.user_id
  WHERE u.email = @vendorEmail;

  IF @vendorId IS NULL
  BEGIN
    RAISERROR('Vendor was not found for shoe seed.', 16, 1);
  END;

  SELECT @brandId = id
  FROM dbo.brands
  WHERE LOWER(LTRIM(RTRIM(name))) = LOWER(LTRIM(RTRIM(@brandName)));

  IF @brandId IS NULL
  BEGIN
    DELETE FROM @insertedIds;
    INSERT INTO dbo.brands (name, is_active, sort_order)
    OUTPUT INSERTED.id INTO @insertedIds
    VALUES (@brandName, 1, 900);
    SELECT TOP 1 @brandId = id FROM @insertedIds;
  END
  ELSE
  BEGIN
    UPDATE dbo.brands
    SET is_active = 1,
        updated_at = SYSDATETIME()
    WHERE id = @brandId;
  END;

  SELECT TOP 1 @genderGroupId = id
  FROM dbo.gender_groups
  WHERE LOWER(LTRIM(RTRIM(name))) =
    CASE @department
      WHEN 'men' THEN 'men'
      WHEN 'women' THEN 'women'
      WHEN 'kids' THEN 'kids'
      ELSE 'babies'
    END;

  SELECT @colorId = id
  FROM dbo.colors
  WHERE LOWER(LTRIM(RTRIM(name))) = LOWER(LTRIM(RTRIM(@color)));

  IF @colorId IS NULL
  BEGIN
    DELETE FROM @insertedIds;
    INSERT INTO dbo.colors (name, is_active, sort_order)
    OUTPUT INSERTED.id INTO @insertedIds
    VALUES (UPPER(LEFT(@color, 1)) + SUBSTRING(@color, 2, LEN(@color)), 1, 500);
    SELECT TOP 1 @colorId = id FROM @insertedIds;
  END;

  SELECT @totalStock = SUM(stock)
  FROM #shoe_sizes
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
      @vendorId, @title, @description, @price, @totalStock, 1, @department, 'shoes',
      @brandId, @categoryId, @subcategoryId, @genderGroupId, @color, @primarySize,
      CONCAT('SHO-', UPPER(LEFT(REPLACE(@seedKey, '-', ''), 6)))
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
        category = 'shoes',
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
  SELECT @productId, s.id, ss.stock, NULL, SYSDATETIME()
  FROM #shoe_sizes ss
  INNER JOIN dbo.sizes s
    ON s.size_type_id = @sizeTypeId
   AND s.label = ss.size_label
  WHERE ss.seed_key = @seedKey;

  DELETE FROM dbo.product_images WHERE product_id = @productId;
  INSERT INTO dbo.product_images (product_id, image_url, sort_order)
  SELECT @productId, image_url, sort_order
  FROM #shoe_images
  WHERE seed_key = @seedKey;

  SET @vendorId = NULL;
  SET @productId = NULL;
  SET @genderGroupId = NULL;
  SET @colorId = NULL;
  SET @brandId = NULL;
  SET @totalStock = NULL;

  FETCH NEXT FROM shoe_cursor INTO @seedKey, @vendorEmail, @brandName, @title, @description, @price, @department, @color, @primarySize;
END;

CLOSE shoe_cursor;
DEALLOCATE shoe_cursor;

COMMIT TRANSACTION;

SELECT
  p.title,
  p.department,
  p.stock,
  COUNT(ps.size_id) AS size_count
FROM dbo.products p
LEFT JOIN dbo.product_sizes ps ON ps.product_id = p.id
WHERE p.category = 'shoes'
GROUP BY p.title, p.department, p.stock
ORDER BY p.department, p.title;
