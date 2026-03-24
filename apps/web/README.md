# Vishu Web

Next.js storefront, vendor, and admin frontend for `Vishu.shop`.

## Local development

Create `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3001
```

Run:

```bash
npm --workspace apps/web run dev -- --port 3001
```

Open:

- `http://localhost:3001`

## Demo / production

Use these values when the real domain is live:

```env
NEXT_PUBLIC_API_URL=https://api.vishu.shop
NEXT_PUBLIC_SITE_URL=https://vishu.shop
```

## Notes

- The frontend automatically falls back to `https://api.vishu.shop` when it is opened on `vishu.shop` and no explicit API URL is provided.
- Admin settings can also store the public app URL for email links and future operational tools.
