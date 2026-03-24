# Vishu Demo Launch

This repo is now prepared for a demo domain split:

- storefront: `https://vishu.shop`
- API: `https://api.vishu.shop`

## 1. DNS in GoDaddy

Add these records:

- `A` record
  Name: `@`
  Value: your web server public IP
- `CNAME`
  Name: `www`
  Value: `@`
- `A` record or reverse-proxy target for API
  Name: `api`
  Value: your API server public IP

If web and API run on the same server, both `@` and `api` can point to the same IP.

## 2. Web env

Create production env for the frontend:

```env
NEXT_PUBLIC_API_URL=https://api.vishu.shop
NEXT_PUBLIC_SITE_URL=https://vishu.shop
```

## 3. API env

Create production env for the backend:

```env
PORT=3000
JWT_SECRET=replace-with-strong-secret
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://vishu.shop,https://www.vishu.shop
APP_BASE_URL=https://vishu.shop
MAIL_FROM=noreply@vishu.shop
UPLOAD_DIR=uploads

DB_SERVER=localhost
DB_INSTANCE=MARKET
DB_NAME=vishu
DB_TRUSTED_CONNECTION=true
```

## 4. Build

From repo root:

```bash
npm run build
```

## 5. Run

Web:

```bash
npm --workspace apps/web run start -- --port 3001
```

API:

```bash
npm --workspace apps/api run start:prod
```

## 6. Reverse proxy

Recommended public routing:

- `https://vishu.shop` -> Next.js web app
- `https://www.vishu.shop` -> redirect to `https://vishu.shop`
- `https://api.vishu.shop` -> NestJS API

Also proxy:

- `/media/*` from API so uploaded product and vendor images stay visible

## 7. SSL

Before public demo, enable HTTPS:

- Nginx + Let's Encrypt on VPS
- or your hosting provider / platform SSL

## 8. Admin settings after launch

In `Admin > Settings`, confirm:

- `Mail from` = `noreply@vishu.shop`
- `App base URL` = `https://vishu.shop`
- SMTP / Mailtrap or production mail provider is configured

## 9. Demo-ready checklist

- homepage loads from `vishu.shop`
- API health works on `api.vishu.shop/health`
- logo and favicon show correctly
- registration and login work
- vendor verification emails point to `https://vishu.shop`
- admin login works
- uploaded images load through the public domain
