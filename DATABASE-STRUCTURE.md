# Vishu Database Structure

Last updated: 2026-03-26

This is the always-current SQL Server structure guide for the Vishu project. Use it together with `apps/api/src/database/schema.ts` whenever tables, columns, relations, or DB-backed workflows change.

## Source Of Truth

- SQL Server is the source of truth for business state.
- Schema bootstrap and additive migrations live in `apps/api/src/database/schema.ts`.
- The normalized catalog tables below are now the source of truth for marketplace structure.
- Legacy compatibility fields still exist on some tables, but new work should prefer the normalized relations first.
- After meaningful schema work, update this file and `PROJECT-STATUS.md` in the same change.

## Database Organization

### Platform And Control

- `platform_settings`
  - global app settings
  - mail configuration
  - homepage hero autoplay configuration
- `homepage_hero_slides`
  - admin-managed promotions/banner slider
  - schedule fields and display order live here
- `admin_notifications`
  - admin queue and action notifications
- `admin_activity_logs`
  - durable admin audit trail

### Identity And Access

- `users`
  - shared login identity for customers, vendors, admins, and vendor team members
  - guest checkout can now create an unactivated `customer` user automatically
- `email_verifications`
  - email verification tokens and usage state
- `password_resets`
  - password reset tokens and usage state
  - also used for customer account activation after guest checkout
- `vendors`
  - one vendor shop profile per owner/shop
  - contains vendor business/profile fields
- `vendor_team_members`
  - shop-level access records
  - roles are `shop_holder` and `employee`
- `vendor_team_invites`
  - pending or accepted vendor team invitations

### Catalog Structure

These tables replace the old generic master-data direction for marketplace structure.

- `gender_groups`
  - user-facing gender grouping for browsing and product assignment
- `categories`
  - top-level catalog grouping
- `subcategories`
  - child catalog grouping
  - each row must belong to one `categories` row through `category_id`
- `brands`
  - admin-managed brand list
- `colors`
  - admin-managed color list
- `size_types`
  - size families such as apparel sizing
- `sizes`
  - size rows under one `size_types` row through `size_type_id`
- `vendor_requests`
  - vendor requests for missing catalog values
  - approval/rejection is tracked here
  - approved requests do not auto-create structure rows; admin must manually create the real value in Settings

### Products And Catalog Content

- `products`
  - main product record
  - owner is `vendor_id`
  - structured foreign keys:
    - `brand_id`
    - `category_id`
    - `subcategory_id`
    - `gender_group_id`
  - compatibility fields still exist:
    - `department`
    - `category`
    - `color`
    - `size`
  - those text fields are still maintained for compatibility, but normalized relations should drive new work
- `product_images`
  - ordered image list for one product
- `product_colors`
  - many-to-many relation between products and colors
  - enables multicolor products
- `product_sizes`
  - variant-style size rows per product
  - stock is tracked here per size
  - this is the correct stock source for size-level inventory work

### Customer Shopping And Orders

- `carts`
  - one active cart per customer
- `cart_items`
  - product rows in a cart
- `customer_addresses`
  - saved shipping addresses
- `customer_payment_methods`
  - saved card/payment snapshots for checkout use
- `orders`
  - order header and customer/payment/shipping snapshot fields
  - guest checkout still stores guest snapshot fields on the order
  - guest orders now also link to `customer_id` by auto-creating or reusing a customer record by email
- `order_items`
  - vendor-facing fulfillment rows and per-item revenue snapshots

### Finance And Legacy Operations

- `vendor_payouts`
  - historical payout tracking table
  - payout-heavy UI is not the active product direction right now, but the table still exists

## Key Relationships

- `users` -> `vendors`
  - vendor owner account
- `vendors` -> `products`
  - each product belongs to one vendor
- `categories` -> `subcategories`
  - one-to-many through `subcategories.category_id`
- `size_types` -> `sizes`
  - one-to-many through `sizes.size_type_id`
- `products` -> `brands`
- `products` -> `categories`
- `products` -> `subcategories`
- `products` -> `gender_groups`
- `products` -> `product_colors` -> `colors`
- `products` -> `product_sizes` -> `sizes`
- `vendors` -> `vendor_requests`
- `users` -> `vendor_team_members`
- `orders` -> `order_items`

## Catalog Rules

- Do not reintroduce one shared generic `option type` table for core catalog structure.
- Admin Settings is the only place where real catalog structure is created and managed.
- Vendors must select structured catalog values; they should not create brands, colors, sizes, or subcategories directly.
- If a value is missing, vendors submit a `vendor_requests` row instead.
- For values already used by products, prefer `is_active = 0` style deactivation instead of hard deletion.
- Storefront filtering and search should use structured catalog relations whenever possible.

## Product Modeling Rules

- `products` is the parent product record.
- `product_sizes` is the correct place for per-size stock.
- `product_colors` is the correct place for multicolor support.
- New product work should treat `brand_id`, `category_id`, `subcategory_id`, and `gender_group_id` as the canonical structure fields.
- Compatibility text columns on `products` should only be treated as bridging fields while older UI/query paths are still being cleaned up.

## Request Workflow Rules

- Vendor submits request into `vendor_requests`.
- Admin reviews request in the admin Requests section.
- Admin marks request `approved` or `rejected`.
- Approval does not create the actual catalog row.
- Admin then manually creates the approved structure entry in Settings.

## Guest Checkout Account Rules

- guest checkout is allowed without pre-registering
- first guest order should create or reuse a `users` row with role `customer`
- customer record should stay unactivated until password setup
- guest order should still store delivery/contact snapshot data on `orders`
- if the same email already belongs to an unactivated customer, reuse that customer row
- if the same email already belongs to an active customer, do not create a duplicate user
- secure activation links are sent through the `password_resets` token flow

## What Must Be Updated Together

When schema or structure changes happen, update all matching layers:

1. `apps/api/src/database/schema.ts`
2. backend DTOs, services, and controllers
3. frontend shared types in `apps/web/src/lib/types.ts`
4. vendor/admin/storefront UI that consumes the changed data
5. e2e coverage if response shapes or workflow behavior changed
6. `PROJECT-STATUS.md`
7. this file

## AWS / Deployment Notes

- Treat API startup as the schema verification step, because bootstrap applies missing additive changes.
- For AWS pulls, check this file first when work mentions SQL, schema, tables, relations, or DB-backed workflow changes.
- Do not consider deploy complete until API startup and key catalog/product queries succeed against the target SQL Server.
- Also verify SMTP and `APP_BASE_URL` when guest checkout/account or verification flows are touched, because account activation and order confirmation emails are now part of the core checkout path.
