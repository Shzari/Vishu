# Vishu API

NestJS + SQL Server backend for `Vishu.shop`.

## Local development

Copy `apps/api/.env.example` into `apps/api/.env` and adjust values if needed.

Typical local values:

```env
PORT=3000
JWT_SECRET=replace-with-a-long-random-secret
PLATFORM_SECRET_ENCRYPTION_KEY=replace-with-a-separate-long-random-secret
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3001
APP_BASE_URL=http://localhost:3001
UPLOAD_DIR=uploads

DB_SERVER=localhost
DB_INSTANCE=MARKET
DB_NAME=vishu
DB_TRUSTED_CONNECTION=true
SMTP_PASS=
STRIPE_TEST_PUBLISHABLE_KEY=
STRIPE_TEST_SECRET_KEY=
STRIPE_TEST_WEBHOOK_SIGNING_SECRET=
STRIPE_LIVE_PUBLISHABLE_KEY=
STRIPE_LIVE_SECRET_KEY=
STRIPE_LIVE_WEBHOOK_SIGNING_SECRET=
```

Run:

```bash
npm --workspace apps/api run start:dev
```

Health:

- `http://localhost:3000/health`

## Demo / production

Recommended domain split:

- web: `https://vishu.shop`
- api: `https://api.vishu.shop`

Typical production values:

```env
PORT=3000
JWT_SECRET=replace-with-strong-secret
PLATFORM_SECRET_ENCRYPTION_KEY=replace-with-separate-secret
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://vishu.shop,https://www.vishu.shop
APP_BASE_URL=https://vishu.shop
MAIL_FROM=noreply@vishu.shop
SMTP_PASS=
STRIPE_TEST_PUBLISHABLE_KEY=
STRIPE_TEST_SECRET_KEY=
STRIPE_TEST_WEBHOOK_SIGNING_SECRET=
STRIPE_LIVE_PUBLISHABLE_KEY=
STRIPE_LIVE_SECRET_KEY=
STRIPE_LIVE_WEBHOOK_SIGNING_SECRET=
UPLOAD_DIR=uploads
```

## Notes

- SQL schema bootstrap runs from `src/database/schema.ts`.
- Platform email settings can later be managed from `Admin > Settings`.
- In production, enable HTTPS in front of the API with a reverse proxy such as Nginx.
- Auth session is now expected to work through secure cookies as well as API token support.
- Use `PLATFORM_SECRET_ENCRYPTION_KEY` so SMTP and platform secrets are not stored as readable plaintext.
- Prefer `SMTP_PASS`, `STRIPE_TEST_SECRET_KEY`, `STRIPE_LIVE_SECRET_KEY`, and Stripe webhook/env config from env in production so runtime authority stays outside the database.
