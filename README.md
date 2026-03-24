# Vishu Marketplace MVP

Monorepo marketplace MVP with:

- `apps/api`: NestJS + direct SQL Server backend
- `apps/web`: Next.js frontend

## Setup

1. Copy `apps/api/.env.example` to `apps/api/.env`
2. Copy `apps/web/.env.example` to `apps/web/.env.local`
3. Make sure SQL Server is running. The backend is configured by default for `localhost\MARKET` using a trusted Windows connection.
4. Start the API: `npm run dev:api`
5. Start the web app: `npm run dev:web`

The API creates the `vishu` database and schema automatically on startup if they do not exist.

## Stable local run commands

For a more reliable daily workflow with automatic rebuild, clean restart, health checks, and logs:

```bash
npm run local:start
```

Useful helpers:

```bash
npm run local:start-fast
npm run local:status
npm run local:stop
```

These commands:

- stop stale listeners on `3000` and `3001`
- rebuild the repo unless you use `local:start-fast`
- start API and web in the background
- write logs under `.codex/run-logs`

## Admin bootstrap

Create or update an admin account with:

```bash
npm --workspace apps/api run create-admin -- admin@example.com strongpassword
```

## Core flows included

- Customer registration and login
- Vendor self-registration with email verification
- Admin vendor activation
- Vendor product CRUD with local image uploads
- Customer cart and checkout
- Multi-vendor orders with commission snapshots
- Vendor order status updates
- Admin user/order/product management

## Project tracking

For current phase progress, completed work, and remaining tasks, see:

- `PROJECT-STATUS.md`
