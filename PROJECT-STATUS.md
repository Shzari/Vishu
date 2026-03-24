# Vishu Project Status

Last updated: 2026-03-24

This file is the handoff reference for any account or agent continuing work on this repo.

## Current Position

- Current active phase: `Phase 10`
- App state: `working local MVP-plus`
- Main local URLs:
  - web: `http://localhost:3001`
  - api: `http://localhost:3000`

## Phase Overview

### Phase 1: Core Stability

- Status: `Done`
- Completed:
  - protected page role guards cleaned up
  - stale session handling improved
  - local start/stop/status scripts added
  - daily local workflow is more reliable

### Phase 2: Customer Auth And Account

- Status: `Done`
- Completed:
  - customer register/login/reset-password flow
  - customer can register and buy immediately
  - customer account, addresses, saved cards, and password change are in place
- Important rule:
  - customer email verification is `not required`

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

- rotating homepage hero board
- left-side customer category rail
- public shops strip/page
- quick-view popup
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

### Phase 8: Subscription System

- Status: `Deferred by product decision`
- Already present:
  - monthly/yearly vendor subscription
  - manual admin override
  - active subscription gates public visibility
- Important rule:
  - do not expand subscription work for now
  - wait for the later `fee per purchase` business model guide before changing this area further

### Phase 9: Admin Operations

- Status: `Done`
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
      - verification resend actions for still-unverified vendors
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
      - resend vendor verification email when the vendor is still unverified
      - enable/disable linked login
      - send password reset email
      - delete vendor when the vendor has no order history
      - record vendor payouts against delivered unpaid balance
      - review payout history and payout totals
    - user detail now supports:
      - enable/disable login
      - send password reset email
      - activate/deactivate linked vendor directly
      - delete customer accounts directly
    - order detail now supports:
      - COD status updates
      - COD admin notes for delivery/payment follow-up
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
  - dedicated admin payout queue
    - dashboard now includes a payouts view
    - admins can review bank readiness, delivered unpaid balance, and payout totals in one place
    - payouts can be recorded directly from the admin payout queue
  - admin queue routing polish
    - admin dashboard views and filters now persist in the URL
    - detail pages can send admins back into the correct queue context
    - reporting and activity text polish cleaned visible admin copy issues

### Phase 10: Production And Launch Readiness

- Status: `Not done`
- Current deployment direction:
  - live via AWS
  - public domain deployment is the active path
  - ignore the older Tailscale Funnel demo path
- Already present / decided:
  - public domain split planning for storefront and API
  - deploy/domain notes in `DEPLOY-DEMO.md`
- Remaining focus:
  - domain and production configuration cleanup as needed
  - production validation, monitoring, and launch hardening as needed

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
  - customer email verification is not required
- Vendor auth:
  - vendor email verification is required
  - vendor still needs admin approval
- Product visibility:
  - no per-product admin approval
  - visibility depends on vendor account state and subscription state
  - a hidden product should not hide the whole shop publicly
- COD / finance:
  - COD admin panel was removed from active admin UI
  - payout UI was removed from active UI
  - subscriptions are a stronger business direction than payouts
- Data storage direction:
  - prefer database-first storage for business data and workflow state
  - keep moving important state out of browser/local app storage when practical
  - browser storage should be minimal and temporary, not the source of truth
- Deployment direction:
  - AWS and the public domain are now the real deployment path
  - ignore any older Tailscale Funnel planning unless explicitly revisited

## Next Recommended Work

1. Start Phase 10 production and launch readiness work.
2. Later revisit Phase 8 only after the fee-per-purchase guide is defined.
3. Keep pushing more business data and workflow state into SQL Server instead of local app storage.

## Update Rule

Whenever meaningful work is completed:

- update the relevant phase status here
- move finished items from `Left to finish` into `Done`
- add any new business decision that changes how the app should behave
