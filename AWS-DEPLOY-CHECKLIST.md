# Vishu AWS Deploy Checklist

Last updated: 2026-04-02

Use this file when moving the real project to AWS. Read it together with `PROJECT-STATUS.md` and `DATABASE-STRUCTURE.md`.

## 1. Before Pulling To AWS

- Confirm the AWS server has:
  - Node.js and npm
  - SQL Server access from the AWS host
  - a writable persistent directory for uploads
  - a process manager such as `pm2`, `systemd`, or your platform equivalent
- Confirm the repo on AWS points to the correct branch.
- Do not rely on local PowerShell helper scripts on AWS.

## 2. Required Environment Values

### API

Set these in the production API environment:

```env
PORT=3000
JWT_SECRET=replace-with-strong-secret
PLATFORM_SECRET_ENCRYPTION_KEY=replace-with-separate-secret
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://vishu.shop,https://www.vishu.shop
APP_BASE_URL=https://vishu.shop
MAIL_FROM=noreply@vishu.shop
UPLOAD_DIR=uploads

DB_SERVER=your-sql-host
DB_INSTANCE=
DB_NAME=vishu
DB_TRUSTED_CONNECTION=false
DB_USER=your-db-user
DB_PASSWORD=your-db-password
```

Optional production values:

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
STRIPE_TEST_SECRET_KEY=
STRIPE_LIVE_SECRET_KEY=

ALGOLIA_APP_ID=
ALGOLIA_ADMIN_API_KEY=
ALGOLIA_INDEX_NAME=vishu_products
```

### Web

Set these in the production web environment:

```env
NEXT_PUBLIC_API_URL=https://api.vishu.shop
NEXT_PUBLIC_SITE_URL=https://vishu.shop
```

## 3. Important Production Rules

- `APP_BASE_URL` must point to the real storefront domain.
  - vendor verification emails use it
  - customer password reset emails use it
  - guest checkout account activation emails use it
- `CORS_ORIGIN` must be exact and must match the real web origins.
  - cookie-authenticated write requests now also rely on trusted origin / referer checks
- SMTP must be configured before relying on:
  - vendor verification
  - password reset
  - guest checkout account activation
  - guest order confirmation emails
- In production, prefer env-managed secrets over DB-managed secrets:
  - `SMTP_PASS`
  - `STRIPE_TEST_SECRET_KEY`
  - `STRIPE_LIVE_SECRET_KEY`
- Set `PLATFORM_SECRET_ENCRYPTION_KEY` before first production boot.
  - do not rely on `JWT_SECRET` as the long-term encryption fallback
  - if encrypted platform secrets already exist, do not rotate `JWT_SECRET` unless `PLATFORM_SECRET_ENCRYPTION_KEY` is set and stable
- `UPLOAD_DIR` must be persistent across restarts and deployments.
- The API schema bootstrap still applies additive SQL changes on startup.
  - API startup is part of deployment verification
- API startup now also migrates any old plaintext platform secrets into encrypted storage.
  - watch startup logs for migration or decryption errors
- Reverse proxy must forward the real host/protocol correctly.
  - secure cookie behavior depends on production HTTPS

## 4. Build And Start

From repo root:

```bash
npm install
npm --workspace apps/api run build
npm --workspace apps/web run build
```

Start commands:

```bash
npm --workspace apps/api run start:prod
npm --workspace apps/web run start -- --port 3001
```

Do not use the local PowerShell `local:start` scripts on AWS.

## 5. Reverse Proxy / Public Routing

Recommended public routing:

- `https://vishu.shop` -> Next.js web on port `3001`
- `https://www.vishu.shop` -> redirect to `https://vishu.shop`
- `https://api.vishu.shop` -> NestJS API on port `3000`
- `/media/*` -> API uploads path

Also enable HTTPS before public use.

## 6. Security Migration Checks

Before calling a migration or deploy complete, verify:

- login sets the auth cookie and authenticated pages still work after refresh
- logout clears the auth cookie and session cleanly
- state-changing requests from the real web app succeed
- cross-site or mismatched-origin requests are rejected with `403`
- admin settings still show SMTP state correctly
- SMTP test email still works when secrets are env-managed
- Stripe-backed payment flows only rely on env secrets if those vars are set
- if old plaintext platform secrets existed, confirm they were upgraded to encrypted values after API startup

## 7. Database Checks After Pull

Because schema changes are bootstrapped on API startup, always verify:

- API starts without SQL errors
- normalized catalog tables exist and load:
  - `gender_groups`
  - `categories`
  - `subcategories`
  - `brands`
  - `colors`
  - `size_types`
  - `sizes`
  - `vendor_requests`
  - `product_colors`
  - `product_sizes`
- guest checkout still creates or reuses a customer correctly
- admin settings structure screens load
- vendor product form loads admin-managed options

## 8. Guest Checkout / Customer Activation Checks

This is now a required production smoke test:

1. Place a guest order with a new email.
2. Confirm the order is saved.
3. Confirm a customer record was created in `users` with role `customer`.
4. Confirm the customer is still unactivated until password setup.
5. Confirm two separate emails were sent:
   - order confirmation
   - account activation
6. Open the activation link.
7. Set a password.
8. Confirm the customer can then sign in and see the order history.

Also test:

- guest order with an already active customer email
  - no duplicate account
  - only order confirmation email
- guest order with an existing unactivated customer email
  - order attaches to the same customer
  - activation email is resent

## 9. Search Checks

If Algolia is configured:

```bash
npm --workspace apps/api run sync:search-index
```

Then verify:

- `/products/search` responds
- homepage search works
- exact matches rank above weaker matches

If Algolia is not configured, confirm the database fallback still works.

## 10. Admin / Vendor / Storefront Smoke Tests

- admin login works
- vendor login works
- vendor verification emails point to the real domain
- homepage promotions load
- category navigation works
- product detail pages load
- cart and checkout work
- customer session still survives refresh through secure cookie auth
- vendor request system works

## 11. Phase 10 Production Hardening Checks

Verify after deploy:

- `Content-Security-Policy` header is present on API responses (check with curl or browser DevTools)
- `Content-Security-Policy` header is present on web responses
- `/sitemap.xml` loads and contains product and shop URLs
- `/robots.txt` correctly disallows `/admin/`, `/vendor/`, `/account/`, `/checkout`
- `/terms`, `/privacy`, `/contact` pages render correctly
- Product detail page `<title>` includes the product name (check page source)
- Product detail page has `<script type="application/ld+json">` with Product schema
- Shop detail page `<title>` includes the shop name
- Storefront footer links to Terms, Privacy, Contact
- Account activation email links to `/reset-password?mode=activate` (check via Mailtrap)
- Vendor dashboard shows "pending approval" banner when vendor is verified but not yet active
- Admin reports page shows Export vendors/customers/orders download links
- Error pages: test `/not-found-page` to confirm 404 page renders
- admin requests screen loads
- admin promotions screen loads

## 11. Files To Recheck Before Every AWS Deploy

- `PROJECT-STATUS.md`
- `DATABASE-STRUCTURE.md`
- `apps/api/src/database/schema.ts`
- `apps/api/.env.example`
- `apps/web/.env.example`
- `WEB-APP-ENGINEERING-PLAYBOOK.md`

If a change touches SQL tables, auth, mail, uploads, or search, update this file too.
