# Vishu Desktop Repo

Use this repo as the source of truth for active work:
- `C:\Users\Shkelqimi\Desktop\vishu`

Do not make project changes in:
- `C:\Users\Shkelqimi\Vishu`

## Structure
- `apps/web`: Next.js storefront, checkout, account, admin UI
- `apps/api`: NestJS API, orders, account, payments, admin services
- `scripts/local-start.ps1`: starts API on `:3000` and web on `:3001`

## Common Commands
- `npm.cmd --workspace apps/web run build`
- `npm.cmd --workspace apps/api run build`
- `powershell -ExecutionPolicy Bypass -File scripts/local-start.ps1 -SkipBuild`

## Working Rules
- Prefer `rg` for search.
- Use `apply_patch` for manual edits.
- Preserve unrelated user changes.
- After UI or API work, build the touched workspace.
- If the browser still shows old UI, rebuild Desktop repo and restart `scripts/local-start.ps1`.
- After vendor governance, storefront visibility, or seed-data changes, verify:
  - `http://localhost:3000/products`
  - `http://localhost:3000/products/vendors`
  - `powershell -ExecutionPolicy Bypass -File scripts/local-status.ps1`
- After admin customer detail changes, verify:
  - `GET /admin/users/:id`
  - the customer detail page still loads addresses, cart, favorites, support notes, and risk controls together
- After customer account returns changes, verify:
  - `GET /account/returns`
  - `POST /account/returns`
  - the `/account` Returns section still shows recent orders, item checkboxes, and recent request history together
- After admin order detail or order-support changes, verify:
  - `GET /admin/orders`
  - `GET /admin/orders/:id`
  - creating and updating an order issue still works
  - approved cancel requests only cancel `pending` orders and restock inventory
- After auth, signup, password, or email-delivery changes, verify:
  - customer signup redirects to `/verify?email=...`
  - `POST /auth/verify/code`
  - `POST /auth/verification/resend`
  - password reset and change-password reject weak passwords
- After Stripe checkout changes, verify:
  - `GET /checkout/payment-settings`
  - `POST /orders/stripe-checkout`
  - `POST /orders/stripe-checkout/:sessionId/complete`
  - guest equivalents under `/orders/guest/stripe-checkout`
- If public products/vendors unexpectedly drop to `0`, check `vendors.admin_status` first.
- Existing verified+active vendors should not stay stuck on `admin_status = under_review`.
- Vendor real/test separation is DB-only:
  - `vendors.is_test = 0` means real vendor
  - `vendors.is_test = 1` means testing shop
  - current real vendor is `EL-DO`
  - do not add storefront/UI separation for this unless explicitly requested
  - use `scripts/vendor-test-shops.sql` to review or later delete testing shops

## Current Product Focus
- Checkout uses Stripe hosted checkout for card payments.
- Stripe checkout sessions are persisted in `payment_checkout_sessions`; completed sessions create the real order once.
- Admin login is dedicated to port `8443`: `https://vishu.shop:8443/admin/login`.
- Main-domain admin routes stay hidden:
  - `https://vishu.shop/admin*` returns `404`
  - `https://vishu.shop/api/admin*` returns `404`
- `ADMIN_BASE_URL` must remain `https://vishu.shop:8443` and `ADMIN_PORT` must remain `8443`.
- Admin vendor finance now includes a monthly economic panel for card totals, COD totals, card fees, COD fees, and per-vendor monthly history.
- Vendor order fee is percentage-based per order; do not describe it as a fixed `1.00` euro fee.
- Vendor accounts can be marked as testing via `vendors.is_test`; this is for backend/DB cleanup only and should not change public visibility by itself.
- Logged-in checkout uses saved account contact details automatically.
- Checkout address flow uses one selected address card plus a change modal.
- Account area is sidebar-based and saved cards are removed from manual UI.
- Customer and vendor registration collect `firstName` and `lastName`; `fullName` remains a compatibility field.
- Customer signup verification uses a 6-digit OTP at `/verify?email=...`; vendor verification still uses email links.
- Passwords must include uppercase, lowercase, and a number, and avoid obvious sequences like `123`, `abc`, or `password`.
- Customer favorites use a star toggle on product cards and load from `/account/favorites`.
- Customer account includes a `Favorites` section for saved products.
- Admin payments settings drive Stripe test/live behavior.
- Site typography should stay on one global font:
  - use `Manrope` as the default font across storefront, account, checkout, vendor, and admin UI
  - avoid reintroducing mixed display/body font pairs unless explicitly requested
- Security baseline:
  - API uses Helmet headers and disables `X-Powered-By`
  - API uses proxy-aware throttling with stricter limits on auth endpoints
  - uploaded images are validated by file signature before permanent storage
  - Web sets baseline security headers in `next.config.ts`

## Fast Pointers
- Checkout page: `apps/web/src/app/checkout/page.tsx`
- Global styles: `apps/web/src/app/globals.css`
- Account page: `apps/web/src/app/account/page.tsx`
- Admin settings: `apps/web/src/app/admin/settings/page.tsx`
- Orders/payment backend: `apps/api/src/orders/orders.service.ts`
- Account backend: `apps/api/src/account/account.service.ts`
