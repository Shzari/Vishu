import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIE_NAME = "vishu_access_token";
const ADMIN_PORT = "8443";

function isAdminPortRequest(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const proxySecret = process.env.ADMIN_PROXY_SECRET?.trim();
  const requestProxySecret = request.headers.get("x-vishu-admin-proxy")?.trim();

  const normalized = forwardedHost?.trim().toLowerCase();
  const isAdminHost =
    normalized === `vishu.shop:${ADMIN_PORT}` ||
    normalized?.endsWith(`:${ADMIN_PORT}`);

  if (!isAdminHost) {
    return false;
  }

  return !proxySecret || requestProxySecret === proxySecret;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/admin") && !isAdminPortRequest(request)) {
    return new NextResponse(null, { status: 404 });
  }

  if (
    pathname.startsWith("/admin") &&
    pathname !== "/admin/login" &&
    !request.cookies.has(AUTH_COOKIE_NAME)
  ) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.search = `?next=${encodeURIComponent(`${pathname}${search}`)}`;
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
