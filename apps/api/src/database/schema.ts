const DEFAULT_SITE_NAME = 'Vishu.shop';
const DEFAULT_SITE_TAGLINE = 'Unified fashion store';

export const SCHEMA_SQL = `
IF OBJECT_ID('dbo.site_branding', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.site_branding (
    id INT NOT NULL PRIMARY KEY CHECK (id = 1),
    site_name NVARCHAR(120) NOT NULL,
    tagline NVARCHAR(255) NOT NULL,
    logo_image VARBINARY(MAX) NULL,
    logo_mime_type NVARCHAR(80) NULL,
    logo_svg NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF NOT EXISTS (SELECT 1 FROM dbo.site_branding WHERE id = 1)
BEGIN
  INSERT INTO dbo.site_branding (id, site_name, tagline, logo_image, logo_mime_type, logo_svg)
  VALUES (1, '${DEFAULT_SITE_NAME}', '${DEFAULT_SITE_TAGLINE}', NULL, NULL, NULL);
END;

UPDATE dbo.site_branding
SET tagline = '${DEFAULT_SITE_TAGLINE}'
WHERE id = 1
  AND tagline = 'Unified fashion storefront, hidden vendor identity';

IF OBJECT_ID('dbo.platform_settings', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.platform_settings (
    id INT NOT NULL PRIMARY KEY CHECK (id = 1),
    smtp_host NVARCHAR(255) NULL,
    smtp_port INT NULL,
    smtp_secure BIT NOT NULL DEFAULT 0,
    smtp_user NVARCHAR(255) NULL,
    smtp_pass NVARCHAR(255) NULL,
    mail_from NVARCHAR(255) NULL,
    app_base_url NVARCHAR(255) NULL,
    vendor_verification_emails_enabled BIT NOT NULL DEFAULT 1,
    admin_vendor_approval_emails_enabled BIT NOT NULL DEFAULT 1,
    password_reset_emails_enabled BIT NOT NULL DEFAULT 1,
    homepage_hero_autoplay_enabled BIT NOT NULL DEFAULT 1,
    homepage_hero_interval_seconds INT NOT NULL DEFAULT 6,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF COL_LENGTH('dbo.site_branding', 'logo_image') IS NULL
BEGIN
  ALTER TABLE dbo.site_branding ADD logo_image VARBINARY(MAX) NULL;
END;

IF COL_LENGTH('dbo.site_branding', 'logo_mime_type') IS NULL
BEGIN
  ALTER TABLE dbo.site_branding ADD logo_mime_type NVARCHAR(80) NULL;
END;

IF COL_LENGTH('dbo.platform_settings', 'smtp_host') IS NULL
BEGIN
  ALTER TABLE dbo.platform_settings ADD smtp_host NVARCHAR(255) NULL;
END;

IF COL_LENGTH('dbo.platform_settings', 'smtp_port') IS NULL
BEGIN
  ALTER TABLE dbo.platform_settings ADD smtp_port INT NULL;
END;

IF COL_LENGTH('dbo.platform_settings', 'smtp_secure') IS NULL
BEGIN
  ALTER TABLE dbo.platform_settings ADD smtp_secure BIT NOT NULL CONSTRAINT df_platform_settings_smtp_secure DEFAULT 0;
END;

IF COL_LENGTH('dbo.platform_settings', 'smtp_user') IS NULL
BEGIN
  ALTER TABLE dbo.platform_settings ADD smtp_user NVARCHAR(255) NULL;
END;

IF COL_LENGTH('dbo.platform_settings', 'smtp_pass') IS NULL
BEGIN
  ALTER TABLE dbo.platform_settings ADD smtp_pass NVARCHAR(255) NULL;
END;

IF COL_LENGTH('dbo.platform_settings', 'mail_from') IS NULL
BEGIN
  ALTER TABLE dbo.platform_settings ADD mail_from NVARCHAR(255) NULL;
END;

IF COL_LENGTH('dbo.platform_settings', 'app_base_url') IS NULL
BEGIN
  ALTER TABLE dbo.platform_settings ADD app_base_url NVARCHAR(255) NULL;
END;

IF COL_LENGTH('dbo.platform_settings', 'vendor_verification_emails_enabled') IS NULL
BEGIN
  ALTER TABLE dbo.platform_settings ADD vendor_verification_emails_enabled BIT NOT NULL CONSTRAINT df_platform_settings_vendor_verification_emails_enabled DEFAULT 1;
END;

IF COL_LENGTH('dbo.platform_settings', 'admin_vendor_approval_emails_enabled') IS NULL
BEGIN
  ALTER TABLE dbo.platform_settings ADD admin_vendor_approval_emails_enabled BIT NOT NULL CONSTRAINT df_platform_settings_admin_vendor_approval_emails_enabled DEFAULT 1;
END;

IF COL_LENGTH('dbo.platform_settings', 'password_reset_emails_enabled') IS NULL
BEGIN
  ALTER TABLE dbo.platform_settings ADD password_reset_emails_enabled BIT NOT NULL CONSTRAINT df_platform_settings_password_reset_emails_enabled DEFAULT 1;
END;

IF COL_LENGTH('dbo.platform_settings', 'homepage_hero_autoplay_enabled') IS NULL
BEGIN
  ALTER TABLE dbo.platform_settings ADD homepage_hero_autoplay_enabled BIT NOT NULL CONSTRAINT df_platform_settings_homepage_hero_autoplay_enabled DEFAULT 1;
END;

IF COL_LENGTH('dbo.platform_settings', 'homepage_hero_interval_seconds') IS NULL
BEGIN
  ALTER TABLE dbo.platform_settings ADD homepage_hero_interval_seconds INT NOT NULL CONSTRAINT df_platform_settings_homepage_hero_interval_seconds DEFAULT 6;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.platform_settings WHERE id = 1)
BEGIN
  INSERT INTO dbo.platform_settings (id)
  VALUES (1);
END;

IF OBJECT_ID('dbo.users', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.users (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    email NVARCHAR(255) NOT NULL UNIQUE,
    full_name NVARCHAR(255) NULL,
    phone_number NVARCHAR(40) NULL,
    password_hash NVARCHAR(255) NOT NULL,
    role NVARCHAR(20) NOT NULL CHECK (role IN ('admin', 'vendor', 'customer')),
    email_verified_at DATETIME2 NULL,
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF COL_LENGTH('dbo.users', 'email_verified_at') IS NULL
BEGIN
  ALTER TABLE dbo.users ADD email_verified_at DATETIME2 NULL;
END;

DECLARE @usersEmailVerifiedDefaultConstraint NVARCHAR(128);
SELECT @usersEmailVerifiedDefaultConstraint = dc.name
FROM sys.default_constraints dc
INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
INNER JOIN sys.tables t ON t.object_id = c.object_id
WHERE t.name = 'users'
  AND c.name = 'email_verified_at';

IF @usersEmailVerifiedDefaultConstraint IS NOT NULL
BEGIN
  DECLARE @dropUsersEmailVerifiedDefaultSql NVARCHAR(300);
  SET @dropUsersEmailVerifiedDefaultSql =
    N'ALTER TABLE dbo.users DROP CONSTRAINT ' + QUOTENAME(@usersEmailVerifiedDefaultConstraint);
  EXEC sp_executesql @dropUsersEmailVerifiedDefaultSql;
END;

EXEC sp_executesql N'
  UPDATE dbo.users
  SET email_verified_at = created_at
  WHERE email_verified_at IS NULL
    AND role = ''admin'';
';

IF OBJECT_ID('dbo.vendors', 'U') IS NOT NULL
BEGIN
  EXEC sp_executesql N'
    UPDATE u
    SET email_verified_at = u.created_at
    FROM dbo.users u
    INNER JOIN dbo.vendors v ON v.user_id = u.id
    WHERE u.email_verified_at IS NULL
      AND v.is_verified = 1;
  ';
END;

IF OBJECT_ID('dbo.vendors', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.vendors (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL UNIQUE REFERENCES dbo.users(id) ON DELETE CASCADE,
    shop_name NVARCHAR(255) NOT NULL,
    support_email NVARCHAR(255) NULL,
    support_phone NVARCHAR(40) NULL,
    shop_description NVARCHAR(1000) NULL,
    logo_url NVARCHAR(500) NULL,
    banner_url NVARCHAR(500) NULL,
    business_address NVARCHAR(500) NULL,
    return_policy NVARCHAR(2000) NULL,
    business_hours NVARCHAR(500) NULL,
    shipping_notes NVARCHAR(1000) NULL,
    low_stock_threshold INT NOT NULL DEFAULT 5,
    subscription_plan NVARCHAR(20) NULL,
    subscription_status NVARCHAR(20) NOT NULL DEFAULT 'inactive',
    subscription_started_at DATETIME2 NULL,
    subscription_ends_at DATETIME2 NULL,
    subscription_override_plan NVARCHAR(20) NULL,
    subscription_override_status NVARCHAR(20) NULL,
    subscription_override_started_at DATETIME2 NULL,
    subscription_override_ends_at DATETIME2 NULL,
    subscription_override_note NVARCHAR(500) NULL,
    subscription_override_updated_at DATETIME2 NULL,
    bank_account_name NVARCHAR(255) NULL,
    bank_name NVARCHAR(255) NULL,
    bank_iban NVARCHAR(64) NULL,
    is_active BIT NOT NULL DEFAULT 0,
    is_verified BIT NOT NULL DEFAULT 0,
    approved_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF OBJECT_ID('dbo.vendor_subscriptions', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.vendor_subscriptions (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    vendor_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.vendors(id) ON DELETE CASCADE,
    plan_type NVARCHAR(20) NOT NULL CHECK (plan_type IN ('monthly', 'yearly')),
    status NVARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired')),
    amount DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    admin_user_id UNIQUEIDENTIFIER NULL,
    admin_note NVARCHAR(500) NULL,
    starts_at DATETIME2 NOT NULL,
    ends_at DATETIME2 NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF OBJECT_ID('dbo.vendor_team_members', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.vendor_team_members (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    vendor_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.vendors(id) ON DELETE CASCADE,
    user_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.users(id),
    role NVARCHAR(20) NOT NULL CHECK (role IN ('shop_holder', 'employee')),
    status NVARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'removed')),
    invited_by_user_id UNIQUEIDENTIFIER NULL REFERENCES dbo.users(id),
    joined_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF OBJECT_ID('dbo.vendor_team_invites', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.vendor_team_invites (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    vendor_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.vendors(id) ON DELETE CASCADE,
    user_id UNIQUEIDENTIFIER NULL REFERENCES dbo.users(id),
    email NVARCHAR(255) NOT NULL,
    role NVARCHAR(20) NOT NULL CHECK (role IN ('shop_holder', 'employee')),
    note NVARCHAR(500) NULL,
    token NVARCHAR(255) NOT NULL UNIQUE,
    status NVARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    invited_by_user_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.users(id),
    invited_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    last_sent_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    expires_at DATETIME2 NOT NULL,
    responded_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'ux_vendor_team_members_vendor_user'
    AND object_id = OBJECT_ID('dbo.vendor_team_members')
)
BEGIN
  CREATE UNIQUE INDEX ux_vendor_team_members_vendor_user
    ON dbo.vendor_team_members (vendor_id, user_id);
END;

INSERT INTO dbo.vendor_team_members (vendor_id, user_id, role, status, invited_by_user_id, joined_at)
SELECT
  v.id,
  v.user_id,
  'shop_holder',
  'active',
  v.user_id,
  COALESCE(v.approved_at, v.created_at, SYSDATETIME())
FROM dbo.vendors v
WHERE NOT EXISTS (
  SELECT 1
  FROM dbo.vendor_team_members tm
  WHERE tm.vendor_id = v.id
    AND tm.user_id = v.user_id
);

IF OBJECT_ID('dbo.gender_groups', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.gender_groups (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(120) NOT NULL,
    is_active BIT NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF OBJECT_ID('dbo.categories', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.categories (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(120) NOT NULL,
    is_active BIT NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF OBJECT_ID('dbo.subcategories', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.subcategories (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    category_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.categories(id),
    name NVARCHAR(120) NOT NULL,
    is_active BIT NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF OBJECT_ID('dbo.brands', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.brands (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(120) NOT NULL,
    is_active BIT NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF OBJECT_ID('dbo.colors', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.colors (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(120) NOT NULL,
    is_active BIT NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF OBJECT_ID('dbo.size_types', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.size_types (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(120) NOT NULL,
    is_active BIT NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF OBJECT_ID('dbo.sizes', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.sizes (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    size_type_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.size_types(id),
    label NVARCHAR(120) NOT NULL,
    is_active BIT NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'ux_gender_groups_name'
    AND object_id = OBJECT_ID('dbo.gender_groups')
)
BEGIN
  CREATE UNIQUE INDEX ux_gender_groups_name ON dbo.gender_groups(name);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'ux_categories_name'
    AND object_id = OBJECT_ID('dbo.categories')
)
BEGIN
  CREATE UNIQUE INDEX ux_categories_name ON dbo.categories(name);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'ux_subcategories_category_name'
    AND object_id = OBJECT_ID('dbo.subcategories')
)
BEGIN
  CREATE UNIQUE INDEX ux_subcategories_category_name
    ON dbo.subcategories(category_id, name);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'ux_brands_name'
    AND object_id = OBJECT_ID('dbo.brands')
)
BEGIN
  CREATE UNIQUE INDEX ux_brands_name ON dbo.brands(name);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'ux_colors_name'
    AND object_id = OBJECT_ID('dbo.colors')
)
BEGIN
  CREATE UNIQUE INDEX ux_colors_name ON dbo.colors(name);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'ux_size_types_name'
    AND object_id = OBJECT_ID('dbo.size_types')
)
BEGIN
  CREATE UNIQUE INDEX ux_size_types_name ON dbo.size_types(name);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'ux_sizes_type_label'
    AND object_id = OBJECT_ID('dbo.sizes')
)
BEGIN
  CREATE UNIQUE INDEX ux_sizes_type_label ON dbo.sizes(size_type_id, label);
END;

IF OBJECT_ID('dbo.vendor_requests', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.vendor_requests (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    vendor_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.vendors(id) ON DELETE CASCADE,
    request_type NVARCHAR(30) NOT NULL CHECK (request_type IN ('category', 'subcategory', 'brand', 'size', 'color')),
    requested_value NVARCHAR(120) NOT NULL,
    note NVARCHAR(500) NULL,
    category_id UNIQUEIDENTIFIER NULL REFERENCES dbo.categories(id),
    subcategory_id UNIQUEIDENTIFIER NULL REFERENCES dbo.subcategories(id),
    size_type_id UNIQUEIDENTIFIER NULL REFERENCES dbo.size_types(id),
    status NVARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_note NVARCHAR(500) NULL,
    reviewed_by_admin_id UNIQUEIDENTIFIER NULL REFERENCES dbo.users(id),
    reviewed_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF OBJECT_ID('dbo.catalog_master_values', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.catalog_master_values (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    option_type NVARCHAR(30) NOT NULL CHECK (option_type IN ('category', 'subcategory', 'brand', 'size', 'color')),
    department NVARCHAR(40) NULL,
    parent_value NVARCHAR(120) NULL,
    value NVARCHAR(120) NOT NULL,
    is_active BIT NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF OBJECT_ID('dbo.vendor_catalog_requests', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.vendor_catalog_requests (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    vendor_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.vendors(id) ON DELETE CASCADE,
    request_type NVARCHAR(30) NOT NULL CHECK (request_type IN ('category', 'subcategory', 'brand', 'size', 'color')),
    department NVARCHAR(40) NULL,
    parent_value NVARCHAR(120) NULL,
    requested_value NVARCHAR(120) NOT NULL,
    note NVARCHAR(500) NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_note NVARCHAR(500) NULL,
    reviewed_by_admin_id UNIQUEIDENTIFIER NULL REFERENCES dbo.users(id),
    reviewed_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF OBJECT_ID('dbo.products', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.products (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    vendor_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.vendors(id) ON DELETE CASCADE,
    title NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX) NOT NULL,
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    stock INT NOT NULL CHECK (stock >= 0),
    is_listed BIT NOT NULL DEFAULT 1,
    department NVARCHAR(40) NOT NULL DEFAULT 'men',
    category NVARCHAR(120) NOT NULL,
    brand_id UNIQUEIDENTIFIER NULL REFERENCES dbo.brands(id),
    category_id UNIQUEIDENTIFIER NULL REFERENCES dbo.categories(id),
    subcategory_id UNIQUEIDENTIFIER NULL REFERENCES dbo.subcategories(id),
    gender_group_id UNIQUEIDENTIFIER NULL REFERENCES dbo.gender_groups(id),
    color NVARCHAR(80) NULL,
    size NVARCHAR(80) NULL,
    product_code NVARCHAR(80) NULL,
    low_stock_alert_sent_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF COL_LENGTH('dbo.products', 'is_listed') IS NULL
BEGIN
  ALTER TABLE dbo.products ADD is_listed BIT NOT NULL CONSTRAINT df_products_is_listed DEFAULT 1;
END;

IF COL_LENGTH('dbo.products', 'department') IS NULL
BEGIN
  EXEC sp_executesql N'
    ALTER TABLE dbo.products
    ADD department NVARCHAR(40) NOT NULL CONSTRAINT df_products_department DEFAULT ''men'';
  ';
END;

IF COL_LENGTH('dbo.products', 'low_stock_alert_sent_at') IS NULL
BEGIN
  ALTER TABLE dbo.products ADD low_stock_alert_sent_at DATETIME2 NULL;
END;

IF COL_LENGTH('dbo.products', 'brand_id') IS NULL
BEGIN
  ALTER TABLE dbo.products ADD brand_id UNIQUEIDENTIFIER NULL;
END;

IF COL_LENGTH('dbo.products', 'category_id') IS NULL
BEGIN
  ALTER TABLE dbo.products ADD category_id UNIQUEIDENTIFIER NULL;
END;

IF COL_LENGTH('dbo.products', 'subcategory_id') IS NULL
BEGIN
  ALTER TABLE dbo.products ADD subcategory_id UNIQUEIDENTIFIER NULL;
END;

IF COL_LENGTH('dbo.products', 'gender_group_id') IS NULL
BEGIN
  ALTER TABLE dbo.products ADD gender_group_id UNIQUEIDENTIFIER NULL;
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = 'fk_products_brand'
    AND parent_object_id = OBJECT_ID('dbo.products')
)
BEGIN
  ALTER TABLE dbo.products
  ADD CONSTRAINT fk_products_brand FOREIGN KEY (brand_id) REFERENCES dbo.brands(id);
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = 'fk_products_category'
    AND parent_object_id = OBJECT_ID('dbo.products')
)
BEGIN
  ALTER TABLE dbo.products
  ADD CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES dbo.categories(id);
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = 'fk_products_subcategory'
    AND parent_object_id = OBJECT_ID('dbo.products')
)
BEGIN
  ALTER TABLE dbo.products
  ADD CONSTRAINT fk_products_subcategory FOREIGN KEY (subcategory_id) REFERENCES dbo.subcategories(id);
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = 'fk_products_gender_group'
    AND parent_object_id = OBJECT_ID('dbo.products')
)
BEGIN
  ALTER TABLE dbo.products
  ADD CONSTRAINT fk_products_gender_group FOREIGN KEY (gender_group_id) REFERENCES dbo.gender_groups(id);
END;

EXEC sp_executesql N'
  UPDATE dbo.products
  SET department = ''men''
  WHERE department IS NULL OR LTRIM(RTRIM(department)) = '''';
';

IF OBJECT_ID('dbo.product_images', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.product_images (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    product_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.products(id) ON DELETE CASCADE,
    image_url NVARCHAR(500) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0
  );
END;

IF OBJECT_ID('dbo.product_colors', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.product_colors (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    product_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.products(id) ON DELETE CASCADE,
    color_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.colors(id),
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF OBJECT_ID('dbo.product_sizes', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.product_sizes (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    product_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.products(id) ON DELETE CASCADE,
    size_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.sizes(id),
    stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    sku NVARCHAR(80) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'ux_product_colors_product_color'
    AND object_id = OBJECT_ID('dbo.product_colors')
)
BEGIN
  CREATE UNIQUE INDEX ux_product_colors_product_color
    ON dbo.product_colors(product_id, color_id);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'ux_product_sizes_product_size'
    AND object_id = OBJECT_ID('dbo.product_sizes')
)
BEGIN
  CREATE UNIQUE INDEX ux_product_sizes_product_size
    ON dbo.product_sizes(product_id, size_id);
END;

INSERT INTO dbo.gender_groups (name, is_active, sort_order)
SELECT seed.name, 1, seed.sort_order
FROM (
  VALUES
    ('Men', 0),
    ('Women', 1),
    ('Kids', 2),
    ('Babies', 3)
) AS seed(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.gender_groups gg WHERE gg.name = seed.name
);

INSERT INTO dbo.size_types (name, is_active, sort_order)
SELECT 'Apparel', 1, 0
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.size_types st WHERE st.name = 'Apparel'
);

INSERT INTO dbo.categories (name, is_active, sort_order)
SELECT DISTINCT source.name, 1, 0
FROM (
  SELECT value AS name
  FROM dbo.catalog_master_values
  WHERE option_type = 'category'
    AND NULLIF(LTRIM(RTRIM(value)), '') IS NOT NULL
  UNION
  SELECT category
  FROM dbo.products
  WHERE NULLIF(LTRIM(RTRIM(category)), '') IS NOT NULL
) AS source
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.categories c WHERE c.name = source.name
);

INSERT INTO dbo.subcategories (category_id, name, is_active, sort_order)
SELECT DISTINCT c.id, source.name, 1, 0
FROM (
  SELECT
    COALESCE(NULLIF(LTRIM(RTRIM(parent_value)), ''), value) AS category_name,
    value AS name
  FROM dbo.catalog_master_values
  WHERE option_type = 'subcategory'
    AND NULLIF(LTRIM(RTRIM(value)), '') IS NOT NULL
  UNION
  SELECT
    category AS category_name,
    category AS name
  FROM dbo.products
  WHERE NULLIF(LTRIM(RTRIM(category)), '') IS NOT NULL
) AS source
INNER JOIN dbo.categories c ON c.name = source.category_name
WHERE NOT EXISTS (
  SELECT 1
  FROM dbo.subcategories sc
  WHERE sc.category_id = c.id
    AND sc.name = source.name
);

INSERT INTO dbo.brands (name, is_active, sort_order)
SELECT DISTINCT source.name, 1, 0
FROM (
  SELECT value AS name
  FROM dbo.catalog_master_values
  WHERE option_type = 'brand'
    AND NULLIF(LTRIM(RTRIM(value)), '') IS NOT NULL
  UNION
  SELECT shop_name
  FROM dbo.vendors
  WHERE NULLIF(LTRIM(RTRIM(shop_name)), '') IS NOT NULL
) AS source
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.brands b WHERE b.name = source.name
);

INSERT INTO dbo.colors (name, is_active, sort_order)
SELECT DISTINCT source.name, 1, 0
FROM (
  SELECT value AS name
  FROM dbo.catalog_master_values
  WHERE option_type = 'color'
    AND NULLIF(LTRIM(RTRIM(value)), '') IS NOT NULL
  UNION
  SELECT color
  FROM dbo.products
  WHERE NULLIF(LTRIM(RTRIM(color)), '') IS NOT NULL
) AS source
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.colors c WHERE c.name = source.name
);

INSERT INTO dbo.sizes (size_type_id, label, is_active, sort_order)
SELECT DISTINCT st.id, source.label, 1, 0
FROM (
  SELECT value AS label
  FROM dbo.catalog_master_values
  WHERE option_type = 'size'
    AND NULLIF(LTRIM(RTRIM(value)), '') IS NOT NULL
  UNION
  SELECT size AS label
  FROM dbo.products
  WHERE NULLIF(LTRIM(RTRIM(size)), '') IS NOT NULL
) AS source
INNER JOIN dbo.size_types st ON st.name = 'Apparel'
WHERE NOT EXISTS (
  SELECT 1
  FROM dbo.sizes s
  WHERE s.size_type_id = st.id
    AND s.label = source.label
);

INSERT INTO dbo.vendor_requests (
  vendor_id,
  request_type,
  requested_value,
  note,
  category_id,
  subcategory_id,
  size_type_id,
  status,
  admin_note,
  reviewed_by_admin_id,
  reviewed_at,
  created_at,
  updated_at
)
SELECT
  legacy.vendor_id,
  legacy.request_type,
  legacy.requested_value,
  legacy.note,
  categories.id,
  subcategories.id,
  size_types.id,
  legacy.status,
  legacy.admin_note,
  legacy.reviewed_by_admin_id,
  legacy.reviewed_at,
  legacy.created_at,
  legacy.updated_at
FROM dbo.vendor_catalog_requests legacy
LEFT JOIN dbo.categories categories
  ON categories.name = COALESCE(NULLIF(LTRIM(RTRIM(legacy.parent_value)), ''), NULLIF(LTRIM(RTRIM(legacy.department)), ''))
LEFT JOIN dbo.subcategories subcategories
  ON legacy.request_type = 'subcategory'
 AND subcategories.name = legacy.parent_value
LEFT JOIN dbo.size_types size_types
  ON legacy.request_type = 'size'
 AND size_types.name = 'Apparel'
WHERE NOT EXISTS (
  SELECT 1
  FROM dbo.vendor_requests vr
  WHERE vr.vendor_id = legacy.vendor_id
    AND vr.request_type = legacy.request_type
    AND vr.requested_value = legacy.requested_value
    AND vr.created_at = legacy.created_at
);

UPDATE p
SET gender_group_id = gg.id
FROM dbo.products p
INNER JOIN dbo.gender_groups gg
  ON LOWER(gg.name) = LOWER(
    CASE
      WHEN NULLIF(LTRIM(RTRIM(p.department)), '') IS NULL THEN 'men'
      ELSE p.department
    END
  )
WHERE p.gender_group_id IS NULL;

UPDATE p
SET category_id = c.id
FROM dbo.products p
INNER JOIN dbo.categories c ON c.name = p.category
WHERE p.category_id IS NULL
  AND NULLIF(LTRIM(RTRIM(p.category)), '') IS NOT NULL;

UPDATE p
SET subcategory_id = sc.id
FROM dbo.products p
INNER JOIN dbo.categories c ON c.id = p.category_id
INNER JOIN dbo.subcategories sc
  ON sc.category_id = c.id
 AND sc.name = p.category
WHERE p.subcategory_id IS NULL
  AND p.category_id IS NOT NULL
  AND NULLIF(LTRIM(RTRIM(p.category)), '') IS NOT NULL;

UPDATE p
SET brand_id = b.id
FROM dbo.products p
INNER JOIN dbo.vendors v ON v.id = p.vendor_id
INNER JOIN dbo.brands b ON b.name = v.shop_name
WHERE p.brand_id IS NULL;

INSERT INTO dbo.product_colors (product_id, color_id, sort_order)
SELECT p.id, c.id, 0
FROM dbo.products p
INNER JOIN dbo.colors c ON c.name = p.color
WHERE NULLIF(LTRIM(RTRIM(p.color)), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM dbo.product_colors pc
    WHERE pc.product_id = p.id
      AND pc.color_id = c.id
  );

INSERT INTO dbo.product_sizes (product_id, size_id, stock, sku)
SELECT p.id, s.id, p.stock, p.product_code
FROM dbo.products p
INNER JOIN dbo.size_types st ON st.name = 'Apparel'
INNER JOIN dbo.sizes s
  ON s.size_type_id = st.id
 AND s.label = p.size
WHERE NULLIF(LTRIM(RTRIM(p.size)), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM dbo.product_sizes ps
    WHERE ps.product_id = p.id
      AND ps.size_id = s.id
  );

IF OBJECT_ID('dbo.homepage_hero_slides', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.homepage_hero_slides (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    product_id UNIQUEIDENTIFIER NULL REFERENCES dbo.products(id) ON DELETE CASCADE,
    internal_name NVARCHAR(255) NULL,
    headline NVARCHAR(255) NULL,
    subheading NVARCHAR(500) NULL,
    cta_label NVARCHAR(80) NULL,
    button_link NVARCHAR(1000) NULL,
    image_url NVARCHAR(500) NULL,
    desktop_image_url NVARCHAR(500) NULL,
    mobile_image_url NVARCHAR(500) NULL,
    target_url NVARCHAR(1000) NULL,
    is_active BIT NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    starts_at DATETIME2 NULL,
    ends_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF COL_LENGTH('dbo.homepage_hero_slides', 'internal_name') IS NULL
BEGIN
  ALTER TABLE dbo.homepage_hero_slides ADD internal_name NVARCHAR(255) NULL;
END;

IF COL_LENGTH('dbo.homepage_hero_slides', 'button_link') IS NULL
BEGIN
  ALTER TABLE dbo.homepage_hero_slides ADD button_link NVARCHAR(1000) NULL;
END;

IF COL_LENGTH('dbo.homepage_hero_slides', 'image_url') IS NULL
BEGIN
  ALTER TABLE dbo.homepage_hero_slides ADD image_url NVARCHAR(500) NULL;
END;

IF COL_LENGTH('dbo.homepage_hero_slides', 'desktop_image_url') IS NULL
BEGIN
  ALTER TABLE dbo.homepage_hero_slides ADD desktop_image_url NVARCHAR(500) NULL;
END;

IF COL_LENGTH('dbo.homepage_hero_slides', 'mobile_image_url') IS NULL
BEGIN
  ALTER TABLE dbo.homepage_hero_slides ADD mobile_image_url NVARCHAR(500) NULL;
END;

IF COL_LENGTH('dbo.homepage_hero_slides', 'target_url') IS NULL
BEGIN
  ALTER TABLE dbo.homepage_hero_slides ADD target_url NVARCHAR(1000) NULL;
END;

IF COL_LENGTH('dbo.homepage_hero_slides', 'starts_at') IS NULL
BEGIN
  ALTER TABLE dbo.homepage_hero_slides ADD starts_at DATETIME2 NULL;
END;

IF COL_LENGTH('dbo.homepage_hero_slides', 'ends_at') IS NULL
BEGIN
  ALTER TABLE dbo.homepage_hero_slides ADD ends_at DATETIME2 NULL;
END;

IF COL_LENGTH('dbo.homepage_hero_slides', 'product_id') IS NOT NULL
BEGIN
  EXEC sp_executesql N'
    ALTER TABLE dbo.homepage_hero_slides
    ALTER COLUMN product_id UNIQUEIDENTIFIER NULL;
  ';
END;

IF OBJECT_ID('dbo.homepage_hero_slides', 'U') IS NOT NULL
BEGIN
  EXEC sp_executesql N'
    UPDATE hs
    SET image_url = COALESCE(hs.image_url, preview.image_url)
    FROM dbo.homepage_hero_slides hs
    OUTER APPLY (
      SELECT TOP 1 pi.image_url
      FROM dbo.product_images pi
      WHERE pi.product_id = hs.product_id
      ORDER BY pi.sort_order ASC, pi.id ASC
    ) preview
    WHERE hs.image_url IS NULL;
  ';
END;

IF OBJECT_ID('dbo.homepage_hero_slides', 'U') IS NOT NULL
BEGIN
  EXEC sp_executesql N'
    UPDATE dbo.homepage_hero_slides
    SET internal_name = COALESCE(NULLIF(LTRIM(RTRIM(internal_name)), ''''), NULLIF(LTRIM(RTRIM(headline)), ''''), ''Homepage banner''),
        desktop_image_url = COALESCE(desktop_image_url, image_url),
        target_url = COALESCE(target_url, button_link)
    WHERE internal_name IS NULL
       OR desktop_image_url IS NULL
       OR target_url IS NULL;
  ';
END;

IF OBJECT_ID('dbo.orders', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.orders (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    customer_id UNIQUEIDENTIFIER NULL REFERENCES dbo.users(id) ON DELETE CASCADE,
    guest_email NVARCHAR(255) NULL,
    guest_phone_number NVARCHAR(40) NULL,
    guest_claimed_at DATETIME2 NULL,
    guest_claimed_by_user_id UNIQUEIDENTIFIER NULL REFERENCES dbo.users(id),
    total_price DECIMAL(10, 2) NOT NULL CHECK (total_price >= 0),
    special_request NVARCHAR(MAX) NULL,
    shipping_address_id UNIQUEIDENTIFIER NULL,
    shipping_label NVARCHAR(120) NULL,
    shipping_full_name NVARCHAR(255) NULL,
    shipping_phone_number NVARCHAR(40) NULL,
    shipping_line1 NVARCHAR(255) NULL,
    shipping_line2 NVARCHAR(255) NULL,
    shipping_city NVARCHAR(120) NULL,
    shipping_state_region NVARCHAR(120) NULL,
    shipping_postal_code NVARCHAR(40) NULL,
    shipping_country NVARCHAR(120) NULL,
    payment_method_id UNIQUEIDENTIFIER NULL,
    payment_card_nickname NVARCHAR(120) NULL,
    payment_cardholder_name NVARCHAR(255) NULL,
    payment_card_brand NVARCHAR(40) NULL,
    payment_card_last4 NVARCHAR(4) NULL,
    payment_method NVARCHAR(30) NOT NULL DEFAULT 'cash_on_delivery' CHECK (payment_method IN ('cash_on_delivery', 'card')),
    payment_status NVARCHAR(30) NOT NULL DEFAULT 'cod_pending' CHECK (payment_status IN ('cod_pending', 'paid', 'cod_collected', 'cod_refused')),
    confirmed_at DATETIME2 NULL,
    shipped_at DATETIME2 NULL,
    delivered_at DATETIME2 NULL,
    cod_status_note NVARCHAR(500) NULL,
    cod_updated_at DATETIME2 NULL,
    cancel_request_status NVARCHAR(20) NOT NULL DEFAULT 'none',
    cancel_request_note NVARCHAR(500) NULL,
    cancel_requested_at DATETIME2 NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered')),
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF COL_LENGTH('dbo.orders', 'customer_id') IS NOT NULL
BEGIN
  ALTER TABLE dbo.orders ALTER COLUMN customer_id UNIQUEIDENTIFIER NULL;
END;

IF COL_LENGTH('dbo.orders', 'guest_email') IS NULL
BEGIN
  ALTER TABLE dbo.orders ADD guest_email NVARCHAR(255) NULL;
END;

IF COL_LENGTH('dbo.orders', 'guest_phone_number') IS NULL
BEGIN
  ALTER TABLE dbo.orders ADD guest_phone_number NVARCHAR(40) NULL;
END;

IF COL_LENGTH('dbo.orders', 'guest_claimed_at') IS NULL
BEGIN
  ALTER TABLE dbo.orders ADD guest_claimed_at DATETIME2 NULL;
END;

IF COL_LENGTH('dbo.orders', 'guest_claimed_by_user_id') IS NULL
BEGIN
  ALTER TABLE dbo.orders ADD guest_claimed_by_user_id UNIQUEIDENTIFIER NULL;
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = 'fk_orders_guest_claimed_by_user'
    AND parent_object_id = OBJECT_ID('dbo.orders')
)
BEGIN
  ALTER TABLE dbo.orders
  ADD CONSTRAINT fk_orders_guest_claimed_by_user
    FOREIGN KEY (guest_claimed_by_user_id) REFERENCES dbo.users(id);
END;

IF COL_LENGTH('dbo.orders', 'shipping_address_id') IS NULL
BEGIN
  ALTER TABLE dbo.orders ADD shipping_address_id UNIQUEIDENTIFIER NULL;
END;

IF COL_LENGTH('dbo.orders', 'shipping_label') IS NULL
  ALTER TABLE dbo.orders ADD shipping_label NVARCHAR(120) NULL;

IF COL_LENGTH('dbo.orders', 'shipping_full_name') IS NULL
  ALTER TABLE dbo.orders ADD shipping_full_name NVARCHAR(255) NULL;

IF COL_LENGTH('dbo.orders', 'shipping_phone_number') IS NULL
  ALTER TABLE dbo.orders ADD shipping_phone_number NVARCHAR(40) NULL;

IF COL_LENGTH('dbo.orders', 'shipping_line1') IS NULL
  ALTER TABLE dbo.orders ADD shipping_line1 NVARCHAR(255) NULL;

IF COL_LENGTH('dbo.orders', 'shipping_line2') IS NULL
  ALTER TABLE dbo.orders ADD shipping_line2 NVARCHAR(255) NULL;

IF COL_LENGTH('dbo.orders', 'shipping_city') IS NULL
  ALTER TABLE dbo.orders ADD shipping_city NVARCHAR(120) NULL;

IF COL_LENGTH('dbo.orders', 'shipping_state_region') IS NULL
  ALTER TABLE dbo.orders ADD shipping_state_region NVARCHAR(120) NULL;

IF COL_LENGTH('dbo.orders', 'shipping_postal_code') IS NULL
  ALTER TABLE dbo.orders ADD shipping_postal_code NVARCHAR(40) NULL;

IF COL_LENGTH('dbo.orders', 'shipping_country') IS NULL
  ALTER TABLE dbo.orders ADD shipping_country NVARCHAR(120) NULL;

IF COL_LENGTH('dbo.orders', 'payment_method_id') IS NULL
BEGIN
  ALTER TABLE dbo.orders ADD payment_method_id UNIQUEIDENTIFIER NULL;
END;

IF COL_LENGTH('dbo.orders', 'payment_card_nickname') IS NULL
  ALTER TABLE dbo.orders ADD payment_card_nickname NVARCHAR(120) NULL;

IF COL_LENGTH('dbo.orders', 'payment_cardholder_name') IS NULL
  ALTER TABLE dbo.orders ADD payment_cardholder_name NVARCHAR(255) NULL;

IF COL_LENGTH('dbo.orders', 'payment_card_brand') IS NULL
  ALTER TABLE dbo.orders ADD payment_card_brand NVARCHAR(40) NULL;

IF COL_LENGTH('dbo.orders', 'payment_card_last4') IS NULL
  ALTER TABLE dbo.orders ADD payment_card_last4 NVARCHAR(4) NULL;

IF COL_LENGTH('dbo.orders', 'confirmed_at') IS NULL
  ALTER TABLE dbo.orders ADD confirmed_at DATETIME2 NULL;

IF COL_LENGTH('dbo.orders', 'shipped_at') IS NULL
  ALTER TABLE dbo.orders ADD shipped_at DATETIME2 NULL;

IF COL_LENGTH('dbo.orders', 'delivered_at') IS NULL
  ALTER TABLE dbo.orders ADD delivered_at DATETIME2 NULL;

IF OBJECT_ID('dbo.order_items', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.order_items (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    order_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.orders(id) ON DELETE CASCADE,
    product_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.products(id),
    vendor_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.vendors(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
    commission_amount DECIMAL(10, 2) NOT NULL CHECK (commission_amount >= 0),
    vendor_earnings DECIMAL(10, 2) NOT NULL CHECK (vendor_earnings >= 0),
    status NVARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered')),
    shipping_carrier NVARCHAR(120) NULL,
    tracking_number NVARCHAR(120) NULL,
    shipped_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF OBJECT_ID('dbo.vendor_payouts', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.vendor_payouts (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    vendor_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.vendors(id) ON DELETE CASCADE,
    admin_user_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.users(id),
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    reference NVARCHAR(120) NULL,
    note NVARCHAR(500) NULL,
    paid_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF OBJECT_ID('dbo.email_verifications', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.email_verifications (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.users(id) ON DELETE CASCADE,
    token NVARCHAR(255) NOT NULL UNIQUE,
    expires_at DATETIME2 NOT NULL,
    used_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF OBJECT_ID('dbo.password_resets', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.password_resets (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.users(id) ON DELETE CASCADE,
    token NVARCHAR(255) NOT NULL UNIQUE,
    expires_at DATETIME2 NOT NULL,
    used_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF OBJECT_ID('dbo.guest_order_claim_tokens', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.guest_order_claim_tokens (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.users(id) ON DELETE CASCADE,
    email NVARCHAR(255) NOT NULL,
    token NVARCHAR(255) NOT NULL UNIQUE,
    expires_at DATETIME2 NOT NULL,
    used_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF OBJECT_ID('dbo.admin_notifications', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.admin_notifications (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    admin_user_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.users(id) ON DELETE CASCADE,
    vendor_id UNIQUEIDENTIFIER NULL,
    notification_type NVARCHAR(40) NOT NULL,
    title NVARCHAR(255) NOT NULL,
    body NVARCHAR(1000) NOT NULL,
    action_url NVARCHAR(500) NULL,
    read_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF OBJECT_ID('dbo.admin_activity_logs', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.admin_activity_logs (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    admin_user_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.users(id) ON DELETE CASCADE,
    action_type NVARCHAR(80) NOT NULL,
    entity_type NVARCHAR(80) NOT NULL,
    entity_id UNIQUEIDENTIFIER NULL,
    entity_label NVARCHAR(255) NULL,
    description NVARCHAR(1000) NOT NULL,
    metadata_json NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF OBJECT_ID('dbo.carts', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.carts (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    customer_id UNIQUEIDENTIFIER NOT NULL UNIQUE REFERENCES dbo.users(id) ON DELETE CASCADE,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF OBJECT_ID('dbo.customer_addresses', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.customer_addresses (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    customer_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.users(id) ON DELETE CASCADE,
    label NVARCHAR(120) NOT NULL,
    full_name NVARCHAR(255) NOT NULL,
    phone_number NVARCHAR(40) NULL,
    line1 NVARCHAR(255) NOT NULL,
    line2 NVARCHAR(255) NULL,
    city NVARCHAR(120) NOT NULL,
    state_region NVARCHAR(120) NULL,
    postal_code NVARCHAR(40) NOT NULL,
    country NVARCHAR(120) NOT NULL,
    is_default BIT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF OBJECT_ID('dbo.customer_payment_methods', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.customer_payment_methods (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    customer_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.users(id) ON DELETE CASCADE,
    nickname NVARCHAR(120) NULL,
    cardholder_name NVARCHAR(255) NOT NULL,
    brand NVARCHAR(40) NOT NULL,
    last4 NVARCHAR(4) NOT NULL,
    exp_month INT NOT NULL,
    exp_year INT NOT NULL,
    is_default BIT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );
END;

IF EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = 'fk_orders_shipping_address'
    AND parent_object_id = OBJECT_ID('dbo.orders')
)
BEGIN
  ALTER TABLE dbo.orders DROP CONSTRAINT fk_orders_shipping_address;
END;

IF EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = 'fk_orders_payment_method'
    AND parent_object_id = OBJECT_ID('dbo.orders')
)
BEGIN
  ALTER TABLE dbo.orders DROP CONSTRAINT fk_orders_payment_method;
END;

IF OBJECT_ID('dbo.cart_items', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.cart_items (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    cart_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.carts(id) ON DELETE CASCADE,
    product_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.products(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT uq_cart_items_cart_product UNIQUE (cart_id, product_id)
  );
END;

IF COL_LENGTH('dbo.users', 'phone_number') IS NULL
BEGIN
  ALTER TABLE dbo.users ADD phone_number NVARCHAR(40) NULL;
END;

IF COL_LENGTH('dbo.users', 'full_name') IS NULL
BEGIN
  ALTER TABLE dbo.users ADD full_name NVARCHAR(255) NULL;
END;

IF COL_LENGTH('dbo.orders', 'special_request') IS NULL
BEGIN
  ALTER TABLE dbo.orders ADD special_request NVARCHAR(MAX) NULL;
END;

IF COL_LENGTH('dbo.orders', 'payment_method') IS NULL
BEGIN
  ALTER TABLE dbo.orders ADD payment_method NVARCHAR(30) NOT NULL CONSTRAINT df_orders_payment_method DEFAULT 'cash_on_delivery';
END;

IF COL_LENGTH('dbo.orders', 'payment_status') IS NULL
BEGIN
  ALTER TABLE dbo.orders ADD payment_status NVARCHAR(30) NOT NULL CONSTRAINT df_orders_payment_status DEFAULT 'cod_pending';
END;

IF COL_LENGTH('dbo.orders', 'cod_status_note') IS NULL
BEGIN
  ALTER TABLE dbo.orders ADD cod_status_note NVARCHAR(500) NULL;
END;

IF COL_LENGTH('dbo.orders', 'cod_updated_at') IS NULL
BEGIN
  ALTER TABLE dbo.orders ADD cod_updated_at DATETIME2 NULL;
END;

IF COL_LENGTH('dbo.orders', 'cancel_request_status') IS NULL
BEGIN
  ALTER TABLE dbo.orders ADD cancel_request_status NVARCHAR(20) NOT NULL CONSTRAINT df_orders_cancel_request_status DEFAULT 'none';
END;

IF COL_LENGTH('dbo.orders', 'cancel_request_note') IS NULL
BEGIN
  ALTER TABLE dbo.orders ADD cancel_request_note NVARCHAR(500) NULL;
END;

IF COL_LENGTH('dbo.orders', 'cancel_requested_at') IS NULL
BEGIN
  ALTER TABLE dbo.orders ADD cancel_requested_at DATETIME2 NULL;
END;

IF COL_LENGTH('dbo.vendors', 'bank_account_name') IS NULL
BEGIN
  ALTER TABLE dbo.vendors ADD bank_account_name NVARCHAR(255) NULL;
END;

IF COL_LENGTH('dbo.vendors', 'subscription_plan') IS NULL
BEGIN
  ALTER TABLE dbo.vendors ADD subscription_plan NVARCHAR(20) NULL;
END;

IF COL_LENGTH('dbo.vendors', 'subscription_status') IS NULL
BEGIN
  ALTER TABLE dbo.vendors ADD subscription_status NVARCHAR(20) NOT NULL CONSTRAINT df_vendors_subscription_status DEFAULT 'inactive';
END;

IF COL_LENGTH('dbo.vendors', 'subscription_started_at') IS NULL
BEGIN
  ALTER TABLE dbo.vendors ADD subscription_started_at DATETIME2 NULL;
END;

IF COL_LENGTH('dbo.vendors', 'subscription_ends_at') IS NULL
BEGIN
  ALTER TABLE dbo.vendors ADD subscription_ends_at DATETIME2 NULL;
END;

IF COL_LENGTH('dbo.vendors', 'subscription_override_plan') IS NULL
BEGIN
  ALTER TABLE dbo.vendors ADD subscription_override_plan NVARCHAR(20) NULL;
END;

IF COL_LENGTH('dbo.vendors', 'subscription_override_status') IS NULL
BEGIN
  ALTER TABLE dbo.vendors ADD subscription_override_status NVARCHAR(20) NULL;
END;

IF COL_LENGTH('dbo.vendors', 'subscription_override_started_at') IS NULL
BEGIN
  ALTER TABLE dbo.vendors ADD subscription_override_started_at DATETIME2 NULL;
END;

IF COL_LENGTH('dbo.vendors', 'subscription_override_ends_at') IS NULL
BEGIN
  ALTER TABLE dbo.vendors ADD subscription_override_ends_at DATETIME2 NULL;
END;

IF COL_LENGTH('dbo.vendors', 'subscription_override_note') IS NULL
BEGIN
  ALTER TABLE dbo.vendors ADD subscription_override_note NVARCHAR(500) NULL;
END;

IF COL_LENGTH('dbo.vendors', 'subscription_override_updated_at') IS NULL
BEGIN
  ALTER TABLE dbo.vendors ADD subscription_override_updated_at DATETIME2 NULL;
END;

IF COL_LENGTH('dbo.vendors', 'support_email') IS NULL
BEGIN
  ALTER TABLE dbo.vendors ADD support_email NVARCHAR(255) NULL;
END;

IF COL_LENGTH('dbo.vendors', 'support_phone') IS NULL
BEGIN
  ALTER TABLE dbo.vendors ADD support_phone NVARCHAR(40) NULL;
END;

IF COL_LENGTH('dbo.vendors', 'shop_description') IS NULL
BEGIN
  ALTER TABLE dbo.vendors ADD shop_description NVARCHAR(1000) NULL;
END;

IF COL_LENGTH('dbo.vendors', 'logo_url') IS NULL
BEGIN
  ALTER TABLE dbo.vendors ADD logo_url NVARCHAR(500) NULL;
END;

IF COL_LENGTH('dbo.vendors', 'banner_url') IS NULL
BEGIN
  ALTER TABLE dbo.vendors ADD banner_url NVARCHAR(500) NULL;
END;

IF COL_LENGTH('dbo.vendors', 'business_address') IS NULL
BEGIN
  ALTER TABLE dbo.vendors ADD business_address NVARCHAR(500) NULL;
END;

IF COL_LENGTH('dbo.vendors', 'return_policy') IS NULL
BEGIN
  ALTER TABLE dbo.vendors ADD return_policy NVARCHAR(2000) NULL;
END;

IF COL_LENGTH('dbo.vendors', 'business_hours') IS NULL
BEGIN
  ALTER TABLE dbo.vendors ADD business_hours NVARCHAR(500) NULL;
END;

IF COL_LENGTH('dbo.vendors', 'shipping_notes') IS NULL
BEGIN
  ALTER TABLE dbo.vendors ADD shipping_notes NVARCHAR(1000) NULL;
END;

IF COL_LENGTH('dbo.vendor_subscriptions', 'admin_user_id') IS NULL
BEGIN
  ALTER TABLE dbo.vendor_subscriptions ADD admin_user_id UNIQUEIDENTIFIER NULL;
END;

IF COL_LENGTH('dbo.vendor_subscriptions', 'admin_note') IS NULL
BEGIN
  ALTER TABLE dbo.vendor_subscriptions ADD admin_note NVARCHAR(500) NULL;
END;

EXEC sp_executesql N'
UPDATE dbo.vendors
SET
  subscription_plan = COALESCE(subscription_plan, ''yearly''),
  subscription_status = ''active'',
  subscription_started_at = COALESCE(subscription_started_at, approved_at, created_at, SYSDATETIME()),
  subscription_ends_at = COALESCE(subscription_ends_at, DATEADD(YEAR, 1, SYSDATETIME()))
WHERE is_active = 1 AND is_verified = 1 AND (
  subscription_status <> ''active''
  OR subscription_ends_at IS NULL
  OR subscription_plan IS NULL
);

UPDATE dbo.vendors
SET subscription_status = ''expired''
WHERE subscription_status = ''active''
  AND subscription_ends_at IS NOT NULL
  AND subscription_ends_at < SYSDATETIME();

INSERT INTO dbo.vendor_subscriptions (vendor_id, plan_type, status, amount, starts_at, ends_at)
SELECT
  v.id,
  COALESCE(v.subscription_plan, ''yearly''),
  CASE
    WHEN v.subscription_status = ''active''
      AND v.subscription_ends_at IS NOT NULL
      AND v.subscription_ends_at >= SYSDATETIME()
      THEN ''active''
    ELSE ''expired''
  END,
  CASE COALESCE(v.subscription_plan, ''yearly'')
    WHEN ''monthly'' THEN 29.00
    ELSE 290.00
  END,
  COALESCE(v.subscription_started_at, v.approved_at, v.created_at, SYSDATETIME()),
  COALESCE(v.subscription_ends_at, DATEADD(YEAR, 1, SYSDATETIME()))
FROM dbo.vendors v
WHERE v.is_active = 1
  AND v.is_verified = 1
  AND NOT EXISTS (
    SELECT 1
    FROM dbo.vendor_subscriptions s
    WHERE s.vendor_id = v.id
  );
';

IF COL_LENGTH('dbo.vendors', 'low_stock_threshold') IS NULL
BEGIN
  ALTER TABLE dbo.vendors ADD low_stock_threshold INT NOT NULL CONSTRAINT df_vendors_low_stock_threshold DEFAULT 5;
END;

IF COL_LENGTH('dbo.vendors', 'bank_name') IS NULL
BEGIN
  ALTER TABLE dbo.vendors ADD bank_name NVARCHAR(255) NULL;
END;

IF COL_LENGTH('dbo.vendors', 'bank_iban') IS NULL
BEGIN
  ALTER TABLE dbo.vendors ADD bank_iban NVARCHAR(64) NULL;
END;

IF COL_LENGTH('dbo.products', 'color') IS NULL
BEGIN
  ALTER TABLE dbo.products ADD color NVARCHAR(80) NULL;
END;

IF COL_LENGTH('dbo.products', 'size') IS NULL
BEGIN
  ALTER TABLE dbo.products ADD size NVARCHAR(80) NULL;
END;

IF COL_LENGTH('dbo.products', 'product_code') IS NULL
BEGIN
  ALTER TABLE dbo.products ADD product_code NVARCHAR(80) NULL;
END;

EXEC sp_executesql N'
UPDATE p
SET product_code = CONCAT(
  CASE LOWER(LTRIM(RTRIM(ISNULL(p.category, ''''))))
    WHEN ''top'' THEN ''TOP''
    WHEN ''tops'' THEN ''TOP''
    WHEN ''tshirt'' THEN ''TEE''
    WHEN ''t shirt'' THEN ''TEE''
    WHEN ''t-shirt'' THEN ''TEE''
    WHEN ''tee'' THEN ''TEE''
    WHEN ''tees'' THEN ''TEE''
    WHEN ''shirt'' THEN ''SHT''
    WHEN ''shirts'' THEN ''SHT''
    WHEN ''blouse'' THEN ''BLS''
    WHEN ''blouses'' THEN ''BLS''
    WHEN ''pants'' THEN ''PNT''
    WHEN ''trouser'' THEN ''PNT''
    WHEN ''trousers'' THEN ''PNT''
    WHEN ''jeans'' THEN ''JNS''
    WHEN ''outerwear'' THEN ''OUT''
    WHEN ''jacket'' THEN ''JKT''
    WHEN ''jackets'' THEN ''JKT''
    WHEN ''coat'' THEN ''COT''
    WHEN ''coats'' THEN ''COT''
    WHEN ''hoodie'' THEN ''HOD''
    WHEN ''hoodies'' THEN ''HOD''
    WHEN ''sweater'' THEN ''SWT''
    WHEN ''sweaters'' THEN ''SWT''
    WHEN ''dress'' THEN ''DRS''
    WHEN ''dresses'' THEN ''DRS''
    WHEN ''skirt'' THEN ''SKT''
    WHEN ''skirts'' THEN ''SKT''
    WHEN ''suit'' THEN ''SUT''
    WHEN ''suits'' THEN ''SUT''
    ELSE
      CASE
        WHEN LEN(REPLACE(REPLACE(REPLACE(ISNULL(NULLIF(p.category, ''''), ''''), '' '', ''''), ''-'', ''''), ''_'', '''')) = 0 THEN ''GEN''
        ELSE UPPER(LEFT(REPLACE(REPLACE(REPLACE(ISNULL(NULLIF(p.category, ''''), ''''), '' '', ''''), ''-'', ''''), ''_'', ''''), 3))
      END
  END,
  ''-'',
  CASE LOWER(LTRIM(RTRIM(ISNULL(p.color, ''''))))
    WHEN ''black'' THEN ''BLK''
    WHEN ''white'' THEN ''WHT''
    WHEN ''ivory'' THEN ''IVR''
    WHEN ''cream'' THEN ''CRM''
    WHEN ''beige'' THEN ''BEI''
    WHEN ''brown'' THEN ''BRN''
    WHEN ''tan'' THEN ''TAN''
    WHEN ''gray'' THEN ''GRY''
    WHEN ''grey'' THEN ''GRY''
    WHEN ''blue'' THEN ''BLU''
    WHEN ''navy'' THEN ''NVY''
    WHEN ''red'' THEN ''RED''
    WHEN ''orange'' THEN ''ORG''
    WHEN ''yellow'' THEN ''YLW''
    WHEN ''green'' THEN ''GRN''
    WHEN ''pink'' THEN ''PNK''
    WHEN ''purple'' THEN ''PRP''
    WHEN ''gold'' THEN ''GLD''
    WHEN ''silver'' THEN ''SLV''
    ELSE
      CASE
        WHEN LEN(REPLACE(REPLACE(REPLACE(ISNULL(NULLIF(p.color, ''''), ''''), '' '', ''''), ''-'', ''''), ''_'', '''')) = 0 THEN ''NA''
        ELSE UPPER(LEFT(REPLACE(REPLACE(REPLACE(ISNULL(NULLIF(p.color, ''''), ''''), '' '', ''''), ''-'', ''''), ''_'', ''''), 3))
      END
  END,
  ''-'',
  CASE LOWER(LTRIM(RTRIM(ISNULL(p.size, ''''))))
    WHEN ''xs'' THEN ''XSM''
    WHEN ''s'' THEN ''SML''
    WHEN ''m'' THEN ''MED''
    WHEN ''l'' THEN ''LRG''
    WHEN ''xl'' THEN ''XLG''
    WHEN ''xxl'' THEN ''XXL''
    WHEN ''xxxl'' THEN ''3XL''
    WHEN ''one size'' THEN ''ONE''
    WHEN ''onesize'' THEN ''ONE''
    WHEN ''os'' THEN ''ONE''
    ELSE
      CASE
        WHEN LEN(REPLACE(REPLACE(REPLACE(ISNULL(NULLIF(p.size, ''''), ''''), '' '', ''''), ''-'', ''''), ''_'', '''')) = 0 THEN ''NA''
        ELSE UPPER(LEFT(REPLACE(REPLACE(REPLACE(ISNULL(NULLIF(p.size, ''''), ''''), '' '', ''''), ''-'', ''''), ''_'', ''''), 3))
      END
  END,
  ''-'',
  CASE
    WHEN LEN(REPLACE(REPLACE(REPLACE(ISNULL(NULLIF(v.shop_name, ''''), ''''), '' '', ''''), ''-'', ''''), ''_'', '''')) = 0 THEN ''VEN''
    ELSE UPPER(LEFT(REPLACE(REPLACE(REPLACE(ISNULL(NULLIF(v.shop_name, ''''), ''''), '' '', ''''), ''-'', ''''), ''_'', ''''), 3))
  END,
  ''-'',
  UPPER(RIGHT(REPLACE(CONVERT(NVARCHAR(36), p.id), ''-'', ''''), 6))
)
FROM dbo.products p
INNER JOIN dbo.vendors v ON v.id = p.vendor_id
WHERE p.product_code IS NULL
   OR p.product_code = CONCAT(
    UPPER(LEFT(REPLACE(REPLACE(REPLACE(ISNULL(NULLIF(p.category, ''''), ''GEN''), '' '', ''''), ''-'', ''''), ''_'', ''''), 3)),
    ''-'',
    UPPER(LEFT(REPLACE(REPLACE(REPLACE(ISNULL(NULLIF(p.color, ''''), ''NA''), '' '', ''''), ''-'', ''''), ''_'', ''''), 3)),
    ''-'',
    UPPER(LEFT(REPLACE(REPLACE(REPLACE(ISNULL(NULLIF(p.size, ''''), ''NA''), '' '', ''''), ''-'', ''''), ''_'', ''''), 3)),
    ''-'',
    UPPER(LEFT(REPLACE(REPLACE(REPLACE(ISNULL(NULLIF(v.shop_name, ''''), ''VEN''), '' '', ''''), ''-'', ''''), ''_'', ''''), 3)),
    ''-'',
    UPPER(RIGHT(REPLACE(CONVERT(NVARCHAR(36), p.id), ''-'', ''''), 6))
  );
';

IF COL_LENGTH('dbo.order_items', 'shipping_carrier') IS NULL
BEGIN
  ALTER TABLE dbo.order_items ADD shipping_carrier NVARCHAR(120) NULL;
END;

IF COL_LENGTH('dbo.order_items', 'tracking_number') IS NULL
BEGIN
  ALTER TABLE dbo.order_items ADD tracking_number NVARCHAR(120) NULL;
END;

IF COL_LENGTH('dbo.order_items', 'shipped_at') IS NULL
BEGIN
  ALTER TABLE dbo.order_items ADD shipped_at DATETIME2 NULL;
END;

IF COL_LENGTH('dbo.order_items', 'updated_at') IS NULL
BEGIN
  ALTER TABLE dbo.order_items ADD updated_at DATETIME2 NOT NULL CONSTRAINT df_order_items_updated_at DEFAULT SYSDATETIME();
END;

DECLARE @ordersStatusConstraint NVARCHAR(128);
DECLARE @ordersStatusSql NVARCHAR(MAX);
SELECT TOP 1 @ordersStatusConstraint = cc.name
FROM sys.check_constraints cc
INNER JOIN sys.columns c ON c.object_id = cc.parent_object_id AND c.column_id = cc.parent_column_id
WHERE cc.parent_object_id = OBJECT_ID('dbo.orders') AND c.name = 'status';
IF @ordersStatusConstraint IS NOT NULL
BEGIN
  SET @ordersStatusSql = N'ALTER TABLE dbo.orders DROP CONSTRAINT ' + QUOTENAME(@ordersStatusConstraint) + N';';
  EXEC sp_executesql @ordersStatusSql;
END;
ALTER TABLE dbo.orders
ADD CONSTRAINT ck_orders_status
CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered'));

DECLARE @orderItemsStatusConstraint NVARCHAR(128);
DECLARE @orderItemsStatusSql NVARCHAR(MAX);
SELECT TOP 1 @orderItemsStatusConstraint = cc.name
FROM sys.check_constraints cc
INNER JOIN sys.columns c ON c.object_id = cc.parent_object_id AND c.column_id = cc.parent_column_id
WHERE cc.parent_object_id = OBJECT_ID('dbo.order_items') AND c.name = 'status';
IF @orderItemsStatusConstraint IS NOT NULL
BEGIN
  SET @orderItemsStatusSql = N'ALTER TABLE dbo.order_items DROP CONSTRAINT ' + QUOTENAME(@orderItemsStatusConstraint) + N';';
  EXEC sp_executesql @orderItemsStatusSql;
END;
ALTER TABLE dbo.order_items
ADD CONSTRAINT ck_order_items_status
CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered'));

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_products_vendor_id' AND object_id = OBJECT_ID('dbo.products'))
BEGIN
  CREATE INDEX idx_products_vendor_id ON dbo.products(vendor_id);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_products_product_code' AND object_id = OBJECT_ID('dbo.products'))
BEGIN
  EXEC sp_executesql N'CREATE UNIQUE INDEX uq_products_product_code ON dbo.products(product_code) WHERE product_code IS NOT NULL;';
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_orders_customer_id' AND object_id = OBJECT_ID('dbo.orders'))
BEGIN
  CREATE INDEX idx_orders_customer_id ON dbo.orders(customer_id);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_orders_guest_email' AND object_id = OBJECT_ID('dbo.orders'))
BEGIN
  CREATE INDEX idx_orders_guest_email ON dbo.orders(guest_email);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_order_items_order_id' AND object_id = OBJECT_ID('dbo.order_items'))
BEGIN
  CREATE INDEX idx_order_items_order_id ON dbo.order_items(order_id);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_order_items_vendor_id' AND object_id = OBJECT_ID('dbo.order_items'))
BEGIN
  CREATE INDEX idx_order_items_vendor_id ON dbo.order_items(vendor_id);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_vendor_payouts_vendor_id' AND object_id = OBJECT_ID('dbo.vendor_payouts'))
BEGIN
  CREATE INDEX idx_vendor_payouts_vendor_id ON dbo.vendor_payouts(vendor_id, paid_at DESC);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_carts_customer_id' AND object_id = OBJECT_ID('dbo.carts'))
BEGIN
  CREATE INDEX idx_carts_customer_id ON dbo.carts(customer_id);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_cart_items_cart_id' AND object_id = OBJECT_ID('dbo.cart_items'))
BEGIN
  CREATE INDEX idx_cart_items_cart_id ON dbo.cart_items(cart_id);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_customer_addresses_customer_id' AND object_id = OBJECT_ID('dbo.customer_addresses'))
BEGIN
  CREATE INDEX idx_customer_addresses_customer_id ON dbo.customer_addresses(customer_id);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_customer_payment_methods_customer_id' AND object_id = OBJECT_ID('dbo.customer_payment_methods'))
BEGIN
  CREATE INDEX idx_customer_payment_methods_customer_id ON dbo.customer_payment_methods(customer_id);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_guest_order_claim_tokens_user_id' AND object_id = OBJECT_ID('dbo.guest_order_claim_tokens'))
BEGIN
  CREATE INDEX idx_guest_order_claim_tokens_user_id ON dbo.guest_order_claim_tokens(user_id);
END;
`;
