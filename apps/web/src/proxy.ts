import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIE_NAME = "vishu_access_token";
const ADMIN_PORT = "8443";
const MERCHANT_HOSTNAME = "merchants.vishu.shop";
const STOREFRONT_HOSTNAMES = new Set(["vishu.shop", "www.vishu.shop"]);

function getRequestHostname(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host") || "";
  return host.trim().toLowerCase().split(":")[0];
}

function buildProductionHostUrl(request: NextRequest, hostname: string, pathname: string, search = "") {
  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.hostname = hostname;
  url.port = "";
  url.pathname = pathname;
  url.search = search;
  return url;
}

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
  const hostname = getRequestHostname(request);

  if (hostname === MERCHANT_HOSTNAME && pathname === "/") {
    return NextResponse.redirect(new URL("/login?portal=vendor", request.url));
  }

  if (STOREFRONT_HOSTNAMES.has(hostname) && pathname.startsWith("/vendor")) {
    return NextResponse.redirect(
      buildProductionHostUrl(request, MERCHANT_HOSTNAME, pathname, search),
    );
  }

  if (
    STOREFRONT_HOSTNAMES.has(hostname) &&
    pathname === "/register" &&
    request.nextUrl.searchParams.get("role") === "vendor"
  ) {
    return NextResponse.redirect(
      buildProductionHostUrl(request, MERCHANT_HOSTNAME, "/register", "?role=vendor"),
    );
  }

  if (
    STOREFRONT_HOSTNAMES.has(hostname) &&
    pathname === "/login" &&
    request.nextUrl.searchParams.get("portal") === "vendor"
  ) {
    return NextResponse.redirect(
      buildProductionHostUrl(request, MERCHANT_HOSTNAME, "/login", "?portal=vendor"),
    );
  }

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
  matcher: ["/", "/admin/:path*", "/vendor/:path*", "/login", "/register"],
};
