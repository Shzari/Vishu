# Vishu Project Status

Last updated: 2026-04-02

This file is the handoff reference for any account or agent continuing work on this repo.

## Current Position

- Current active phase: `Phase 10`
- App state: `working local MVP-plus`
- Main local URLs:
  - web: `http://localhost:3001`
  - api: `http://localhost:3000`
- Current DB structure reference:
  - `DATABASE-STRUCTURE.md`
- Current AWS deploy reference:
  - `AWS-DEPLOY-CHECKLIST.md`
- Local runtime note:
  - local web is pointed back to `localhost` for API calls
  - old Tailscale local API target should no longer be used for daily local development
  - if the design suddenly disappears on localhost, check whether the running web process is stale and serving an old CSS chunk
  - if the CSS chunk referenced in page HTML does not match the files under `apps/web/.next/static/chunks`, restart the local web server cleanly
  - `local:status` PID reporting can be imperfect after manual restarts; trust the health checks first
- Demo data:
  - repeatable seed command is now `npm run seed:demo`
  - seed creates multiple verified/active vendors with active visibility, demo products, images, and homepage promo banners

## Phase Overview

### Phase 1: Core Stability

- Status: `Done`
- Completed:
  - protected page role guards cleaned up
  - stale session handling improved
  - shared auth/session state now revalidates more cleanly after reopening tabs, switching roles, and logging out
  - local start/stop/status scripts added
  - daily local workflow is more reliable

### Phase 2: Customer Auth And Account

- Status: `Done`
- Completed:
  - customer register/login/reset-password flow
  - customer can buy as guest without creating an account first
  - customer accounts can now also be auto-created from guest checkout
  - guest-created customer accounts stay unactivated until password setup
  - guest checkout now sends:
    - order confirmation email
    - separate account activation email when needed
  - customer account, addresses, saved cards, and password change are in place
- Important rule:
  - customer can buy without login
  - customer account activation is required before sign-in and order-history access

### Phase 3: Vendor Onboarding

- Status: `Done`
- Completed:
  - vendor email verification
  - admin vendor approval
  - vendor onboarding status guidance
  - low-stock email alerts to the vendor only
- Important rule:
  - admin does `not` approve products one by one

### Phase 4: Vendor Product Management

- Status: `Done`

#### Done in Phase 4

- product create/edit/delete is working
- product code readability improved
- department/category logic added
  - customer-facing left rail currently uses `men` and `women`
  - `unisex` is hidden from the customer left rail
- server-side validation prevents bad department/category combinations
- vendor-side product filters improved
  - department filter
  - category filter
  - listed/hidden filter
- vendor can control public product visibility
  - hide product from customers
  - show product again later
- vendor can duplicate a product into a hidden draft copy
- vendor can bulk update stock for selected products
  - one shared stock value across many selected products
  - low-stock email alerts still trigger correctly
- color and size values are normalized more cleanly
  - common values like `grey` become `gray`
  - common values like `one size` become `one-size`
- vendor-side analytics are now visible in the dashboard
  - best sellers
  - slow movers
  - stock watch
- homepage category browsing and rotating hero board improved
- header search moved into the top bar
- customer storefront was cleaned up:
  - removed extra quick stats box
  - removed extra filter box
  - tightened page margins

### Phase 5: Storefront And Product Browsing

- Status: `Done`

#### Done so far in Phase 5

- rotating homepage promo banner system
- left-side customer category rail
- public shops strip/page
- quick-view popup
- quick-view popup now locks background page scroll while open
- customer storefront cleaned further toward a minimal white design
- homepage browsing continuity improved
  - header search lives in the top bar
  - homepage can now read `department` from the URL query
  - homepage now keeps browse filters in the URL more reliably
  - compact inline filters appear inside the product area after choosing a browse path
  - browse summary chips and clear-filter flow are in place
  - homepage now shows popular category shortcuts for the active gender
- public shop detail page improved
  - search inside one shop
  - category chip filtering
  - sorting by featured/newest/price/stock/title
  - richer product quick-view metadata
  - direct link from shop quick-view back into the main marketplace category
- public shops directory improved
  - sort by products, categories, or name
  - optional filter to show only shops with public products
  - shops page now understands department/category browsing too
  - shop discovery stays closer to the current homepage catalog context
  - active shop filters now have a clear summary and reset flow
- public product detail page improved
  - browse-back links into the main catalog
  - category/department chips
  - color and size shown when available
  - related products panel to keep customers browsing
- quick-view flow is now clearly hybrid
  - quick view stays for fast browsing
  - quick view links directly to the full product page
  - full product page remains the canonical detailed product view
- storefront hero is no longer product-based
  - homepage hero now renders uploaded promo banners only
  - hero is managed from admin promotions, not from product content
  - banner clicks open configured URLs
- storefront product cards were redesigned away from a boxed card look
  - image-first listing
  - cleaner text underneath the image
  - premium/open layout direction instead of dashboard-like tiles
- storefront search now supports structured layered results
  - exact combined matches first
  - then broader category matches
  - then broader color matches
  - then fallback products only when no strong results exist
  - API can use Algolia when configured, with SQL/database fallback if Algolia is unavailable or not configured
- desktop product grid still targets 5 products per row in the main listing
- customer order-entry pages improved
  - cart now links back into product detail and the main catalog
  - checkout now has clearer return paths to cart and shopping
  - orders page now lets customers jump back into product detail and keep browsing

### Phase 6: Cart, Checkout, And Orders

- Status: `Done`

#### Done in Phase 6

  - cart
  - checkout
  - COD-oriented ordering
  - order history
  - cart, checkout, and orders now have stronger continue-shopping paths
  - checkout now uses real saved customer data instead of a generic submit flow
    - saved address selection
    - saved card selection for prepaid orders
    - selected address and card are stored as order snapshots
  - customer order history now shows:
    - delivery address snapshot
    - saved card snapshot for prepaid orders
    - item-level shipment progress
  - e2e coverage now proves order snapshot storage for:
    - shipping address
    - saved payment card
  - hidden products are no longer orderable through stale cart/order requests

## Demo Data

- Repeatable demo seed command:
  - `npm run seed:demo`
- Seed currently creates:
  - multiple verified/active demo vendors
  - active visible demo products
  - product images
  - homepage promo banners

## Recent Local Work

- local API/web were brought back to localhost-first development
- demo seeding was expanded with multiple vendors, products, logos, and hero slides
- hidden products are no longer orderable through stale order/cart requests
- vendor quick-view and storefront quick-view now block background scrolling
- product cards and header layout were iterated heavily on 2026-03-24
- homepage hero was converted into a DB-backed admin promotions banner system
- admin now has a dedicated `Promotions` section for banner upload, ordering, activation, scheduling, and autoplay settings
- layered product search was added on 2026-03-25
  - new public API endpoint: `/products/search`
  - search order is intentional, not random
  - Algolia is optional and uses environment config
  - without Algolia credentials, the app falls back safely to database-driven layered search
- API now has a search reindex helper:
  - `npm --workspace apps/api run sync:search-index`
- the marketplace catalog was normalized on 2026-03-26
  - new dedicated tables now exist for:
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
  - `products` now also carries structured foreign keys:
    - `brand_id`
    - `category_id`
    - `subcategory_id`
    - `gender_group_id`
  - vendor product creation now uses admin-managed catalog values instead of free typing structured fields
  - admin settings now acts as the marketplace structure control panel instead of one generic master-data form
  - vendor request review is DB-backed, but approval does not auto-create the structure value
  - `DATABASE-STRUCTURE.md` was added as the new always-current table and relationship guide
- guest checkout customer-account flow was upgraded on 2026-03-26
  - guest orders now create or reuse a `customer` record automatically
  - order is linked to that customer record immediately
  - first guest order sends two separate emails:
    - order confirmation
    - customer account activation
  - unactivated customer records become active through password setup from the secure email link
  - duplicate active customer accounts are not created for the same email
  - `AWS-DEPLOY-CHECKLIST.md` was added because SMTP and `APP_BASE_URL` are now part of checkout-account correctness, not just optional polish
- repeated localhost design breakages were caused by stale Next.js web processes serving old CSS chunk references
- when localhost looks unstyled:
  - compare the CSS chunk referenced in page HTML with files in `apps/web/.next/static/chunks`
  - if they differ, restart the web server cleanly
- auth and recovery security were hardened on 2026-03-29
  - JWT secret now fails closed instead of allowing a default weak secret
  - auth session now supports secure `HttpOnly` cookie handling
  - logout endpoint added for server-side session cleanup
  - password reset, verification, and guest-order claim tokens are now hashed at rest with compatibility for previously issued links
  - public auth and guest claim flows now have app-level rate limiting
  - upload validation now checks actual image content instead of trusting extension and MIME alone
  - admin promotion links are now restricted to internal marketplace URLs
  - stronger security headers were added in API, Next.js, and Caddy
- a senior engineering guidance document was added:
  - `WEB-APP-ENGINEERING-PLAYBOOK.md`
- Phase 10 production hardening completed on 2026-04-02:
  - rate limiting verified on all auth endpoints
  - Content-Security-Policy headers added to API and Next.js
  - Next.js error boundary pages added: `not-found.tsx`, `error.tsx`, `global-error.tsx`, admin/vendor/account error pages
  - Caddyfile updated for `vishu.shop` with static asset caching
  - Product detail page converted to server component with `generateMetadata` + JSON-LD Product schema
  - Shop detail page converted to server component with `generateMetadata`
  - JSON-LD Organization schema added to root layout
  - `sitemap.ts` dynamically generates sitemap including all product and shop URLs
  - `robots.ts` blocks admin/vendor/account/checkout from crawlers
  - `/terms`, `/privacy`, `/contact` static pages added
  - Site footer with links to legal pages added to storefront shell
  - Customer activation email now links to `/reset-password?mode=activate` for distinct UX
  - Vendor approval waiting state banner added to vendor dashboard
  - Export download links for vendors/customers/orders added to admin reports page
  - `.env.example` files updated with `NODE_ENV` and `SENTRY_DSN` guidance
  - Web build passes cleanly with zero TypeScript errors

### Phase 9: Admin Reporting + Advanced Tools

- Status: `Done`
- Completed:
  - admin reports page: revenue, orders, AOV, new customers/vendors, commission
  - vendor performance table with payouts and commission breakdown
  - vendor monthly fee table
  - top shop and top category highlights
  - export endpoints for vendors, customers, and orders (`GET /admin/exports/:resource`)
  - export download links wired into admin reports UI

### Phase 10: Production Hardening

- Status: `Done`
- Completed:
  - see "Recent Local Work" entry dated 2026-04-02 above


### Phase 7: Fulfillment Workflow

- Status: `Done`

#### Done in Phase 7

  - `pending -> confirmed -> shipped -> delivered`
  - shipment tracking fields
  - order-level fulfillment timestamps are now stored:
    - `placed`
    - `confirmed`
    - `shipped`
    - `delivered`
  - customer order history now shows a clearer delivery timeline with real timestamps
  - customer order history now shows a fulfillment progress note, not just status chips
  - e2e coverage now proves fulfillment timestamps are present after the vendor workflow completes

### Phase 8: Vendor Commercial Model

- Status: `Subscription removed`
- Current rule:
  - public visibility depends on vendor activation and verification only
  - no subscription plan, override, or vendor contract gating remains in the active product
- Next business-model work:
  - if monetization returns later, design it as a fresh feature instead of reviving the old subscription flow

### Phase 9: Admin Operations

- Status: `Partly built, not phase-closed`
- Already present:
  - admin login
  - vendor approval
  - notifications
  - platform email settings
  - admin add-admin flow
  - DB-backed admin activity log
    - recent admin actions now appear in admin dashboard
    - admin settings now shows recent platform/admin activity
    - actions like vendor activation, platform settings changes, test emails, user activation, resets, and notification reads are now traceable in SQL Server
  - stronger admin queue management in dashboard and lists
    - dashboard now surfaces:
      - approval queue
      - order attention queue
      - shipping watch
      - account watch
    - vendor list now has queue filters:
      - pending approval
      - active
      - inactive
      - login disabled
    - customer list now has queue filters:
      - active
      - disabled
  - stronger admin detail-page actions
    - vendor detail now supports:
      - activate/deactivate vendor
      - enable/disable linked login
      - send password reset email
    - user detail now supports:
      - enable/disable login
      - send password reset email
      - activate/deactivate linked vendor directly
  - reporting snapshot added to admin dashboard
    - average order value
    - revenue last 7 days
    - revenue last 30 days
    - new users / customers / vendors in the last 7 days
    - top shop by revenue
    - top category by sold units
    - admin can now switch reporting windows for:
      - 7 days
      - 30 days
      - 90 days
  - export-ready admin summaries
    - vendors CSV export
    - customers CSV export
    - orders CSV export
  - vendor verification resend flow in admin vendor queue
    - vendor list now shows a `Verify` action only for vendors who are still unverified
    - admin can resend a fresh vendor verification email/link without leaving the vendor queue
    - verified vendors do not show the `Verify` button
  - homepage promotions management
    - admin can create, edit, delete, activate, deactivate, reorder, and schedule homepage banners
    - admin can upload desktop and optional mobile banner images
    - admin can configure custom URLs and autoplay timing

### Phase 10: Production And Launch Readiness

- Status: `Not done`
- Already explored:
  - Tailscale Funnel demo path
  - domain planning
  - deploy/demo notes in `DEPLOY-DEMO.md`

## Important Product Decisions

- Branding:
  - preserve the approved compact `Vishu.shop` branding
  - do not redesign branding unless explicitly requested
- Catalog wording:
  - keep the internal field name `department` in code/database
  - show it to users as `Gender` in the product/catalog UI
- Product browsing:
  - keep the hybrid product flow
  - quick view is for fast browsing
  - full product page is the canonical detailed view
- Customer auth:
  - guest checkout is allowed without login
  - customer records created through guest checkout must stay unactivated until password setup
  - customer login requires activation first
- Vendor auth:
  - vendor email verification is required
  - vendor still needs admin approval
- Product visibility:
  - no per-product admin approval
  - visibility depends on vendor account state only
  - a hidden product should not hide the whole shop publicly
- COD / finance:
  - COD admin panel was removed from active admin UI
  - payout UI was removed from active UI
- Data storage direction:
  - prefer database-first storage for business data and workflow state
  - keep moving important state out of browser/local app storage when practical
  - browser storage should be minimal and temporary, not the source of truth
  - authentication should be server-driven and cookie-backed rather than browser token storage
  - normalized catalog tables are now the source of truth for marketplace structure
  - compatibility text fields on `products` still exist, but new work should prefer relations first
- AWS deployment rule:
  - after pulling code on AWS, database/schema changes must be checked first
  - if a change touches tables, columns, SQL bootstrap, or DB-backed workflow state, treat DB verification as the first deployment task
  - do not treat AWS deploy/update as complete until API startup and SQL compatibility are confirmed
  - guest checkout/account flows are now also deployment-sensitive:
    - SMTP must work
    - `APP_BASE_URL` must be correct
    - activation links and order emails must be tested after deploy

## Release Readiness Notes

- GitHub remote provided by user:
  - `https://github.com/Shzari/Vishu`
- Important local repo note:
  - current folder on Desktop is **not** a Git working tree right now
  - before pushing, either clone the GitHub repo cleanly into the deployable folder or connect this workspace to a real `.git` repo first
- Remote branches currently visible:
  - `main`
  - `vishu`

## Database Change Check For AWS

- Search work on 2026-03-25 did **not** add new SQL tables or columns.
- Catalog refactor work on 2026-03-26 **did** add and reorganize SQL structure.
- New SQL tables added in the catalog refactor:
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
- Existing `products` table now also uses structured catalog references:
  - `brand_id`
  - `category_id`
  - `subcategory_id`
  - `gender_group_id`
- Schema bootstrap now also backfills normalized structure data from older product/master-data content where possible.
- Search deployment requires only environment configuration if Algolia is desired:
  - `ALGOLIA_APP_ID`
  - `ALGOLIA_ADMIN_API_KEY`
  - `ALGOLIA_INDEX_NAME`
- The earlier promotions work **did** change DB-backed hero storage and settings:
  - `platform_settings.homepage_hero_autoplay_enabled`
  - `homepage_hero_slides.internal_name`
  - `homepage_hero_slides.desktop_image_url`
  - `homepage_hero_slides.mobile_image_url`
  - `homepage_hero_slides.target_url`
  - `homepage_hero_slides.starts_at`
  - `homepage_hero_slides.ends_at`
- On AWS, API startup against SQL Server must be confirmed after pull because schema bootstrap is still responsible for applying any missing columns.
- On AWS, after this catalog refactor, also verify:
  - admin settings structure lists load
  - vendor product form loads catalog options
  - category/storefront filtering still returns products
  - product create/update succeeds with normalized IDs and relation rows

## Pre-Push / Pre-AWS Checklist

- Confirm the local folder is attached to the real GitHub repo before committing.
- Read `DATABASE-STRUCTURE.md` before reviewing schema-related deployment risk.
- Read `AWS-DEPLOY-CHECKLIST.md` before any real AWS push/pull/update.
- Run:
  - `npm --workspace apps/api run build`
  - `npm --workspace apps/web run build`
  - `npm --workspace apps/web run lint`
- If using Algolia in production, add API env values and run:
  - `npm --workspace apps/api run sync:search-index`
- After pulling on AWS:
  - verify API boots without SQL errors
  - verify normalized catalog tables/bootstrap complete without SQL errors
  - verify homepage promotions load
  - verify `/products/search` responds
  - verify homepage search returns structured results
  - verify admin settings structure sections load
  - verify vendor product form can read brands/categories/subcategories/colors/sizes
  - verify guest checkout sends the correct email flow:
    - order confirmation email
    - activation email only when the customer is still unactivated
  - verify password-setup activation links point to the real public domain

## Next Recommended Work

1. Start Phase 9 admin operations polish.
2. Later revisit Phase 8 only after the fee-per-purchase guide is defined.
3. Keep pushing more business data and workflow state into SQL Server instead of local app storage.
4. Continue storefront product-card design only after confirming the running local web server is using the newest `.next` bundle.

## Current Handoff Notes

- The app is working locally right now.
- The user is still actively iterating on storefront product-card appearance.
- Recent work changed visuals more than business logic.
- If another account resumes and the user says “design is gone,” suspect a stale local web process before suspecting broken CSS syntax.

## Update Rule

Whenever meaningful work is completed:

- update the relevant phase status here
- move finished items from `Left to finish` into `Done`
- add any new business decision that changes how the app should behave
- if the change affects SQL tables or DB-backed logic, mention it clearly so AWS pull/deploy work can check DB changes first
- if the change affects table layout or table ownership, update `DATABASE-STRUCTURE.md` in the same change
