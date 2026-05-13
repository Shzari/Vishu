# Admin Port 8443 Setup

The admin panel can be isolated behind port `8443` so AWS Security Groups can allow only your IP address.

## Public Routing

- Public storefront: `https://vishu.shop`
- Admin panel: `https://vishu.shop:8443/admin/login`

Normal `443` should not serve:

- `/admin*`
- `/api/admin*`

## API Environment

```env
APP_BASE_URL=https://vishu.shop
ADMIN_BASE_URL=https://vishu.shop:8443
ADMIN_PORT=8443
CORS_ORIGIN=https://vishu.shop,https://www.vishu.shop
```

`ADMIN_BASE_URL` is trusted for cookie-authenticated admin API writes.

## AWS Security Group

Recommended inbound rules:

- `443/tcp` from `0.0.0.0/0` and `::/0` for storefront traffic.
- `8443/tcp` from your admin IP only.
- Do not expose app internals `3000` or `3001` publicly.

## Caddy Behavior

The repo `Caddyfile`:

- serves storefront/customer/vendor traffic on `vishu.shop`
- returns `404` for `/admin*` and `/api/admin*` on normal `443`
- serves admin UI and API through `vishu.shop:8443`
- returns `404` for non-admin pages on `8443`

## API Enforcement

The API also checks admin access:

- admin login is rejected unless the request arrives through port `8443`
- admin API routes are rejected unless the request arrives through port `8443`

This protects against direct API attempts even if someone discovers an endpoint.
