# Vishu API

NestJS + SQL Server backend for `Vishu.shop`.

## Local development

Copy `apps/api/.env.example` into `apps/api/.env` and adjust values if needed.

Typical local values:

```env
PORT=3000
JWT_SECRET=change-me
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3001
APP_BASE_URL=http://localhost:3001
UPLOAD_DIR=uploads

DB_SERVER=localhost
DB_INSTANCE=MARKET
DB_NAME=vishu
DB_TRUSTED_CONNECTION=true
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
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://vishu.shop,https://www.vishu.shop
APP_BASE_URL=https://vishu.shop
MAIL_FROM=noreply@vishu.shop
UPLOAD_DIR=uploads
```

## Notes

- SQL schema bootstrap runs from `src/database/schema.ts`.
- Platform email settings can later be managed from `Admin > Settings`.
- In production, enable HTTPS in front of the API with a reverse proxy such as Nginx.
