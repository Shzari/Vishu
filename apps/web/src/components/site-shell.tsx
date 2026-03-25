"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth, useBranding, useCart } from "@/components/providers";
import { PRODUCT_CATEGORIES, formatCatalogLabel } from "@/lib/catalog";

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { branding } = useBranding();
  const { currentRole, isAuthenticated, loading, clearSession } = useAuth();
  const { items } = useCart();
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const initialHeaderSearch = searchParams.get("search") ?? "";
  const initialHeaderCategory = searchParams.get("category") ?? "all";
  const isAdminRoute = pathname.startsWith("/admin");
  const isAdminLoginRoute = pathname === "/admin/login";
  const isVendor = !loading && currentRole === "vendor";
  const isCustomer = !loading && currentRole === "customer";
  const isAdmin = !loading && currentRole === "admin";
  const showGuestActions = !loading && !isAuthenticated;
  const brandHref = isAdminRoute
    ? "/admin/dashboard"
    : isVendor
      ? "/vendor/dashboard"
      : "/";
  const showMarketplaceSearch =
    !isAdminRoute &&
    !isVendor &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/register") &&
    !pathname.startsWith("/reset-password") &&
    !pathname.startsWith("/verify") &&
    !pathname.startsWith("/vendor");

  const handleLogout = () => {
    const nextPath = currentRole === "admin" ? "/admin/login" : "/";
    clearSession();
    router.replace(nextPath);
  };

  const handleMarketplaceSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const params = new URLSearchParams();
    const nextSearch = String(formData.get("search") ?? "").trim();
    const nextCategory = String(formData.get("category") ?? "all");

    if (nextSearch) {
      params.set("search", nextSearch);
    }

    if (nextCategory !== "all") {
      params.set("category", nextCategory);
    }

    router.push(`/${params.toString() ? `?${params.toString()}` : ""}`);

    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        window.dispatchEvent(new Event("vishu-marketplace-query"));
      }, 0);
    }
  };

  return (
    <div className={isAdminRoute ? "shell admin-shell" : "shell"}>
      <header
        className={
          isAdminRoute
            ? isAdminLoginRoute
              ? "topbar admin-topbar admin-login-topbar"
              : "topbar admin-topbar"
            : "topbar"
        }
      >
        <div
          className={
            isAdminRoute
              ? isAdminLoginRoute
                ? "topbar-inner admin-topbar-inner admin-login-topbar-inner"
                : "topbar-inner admin-topbar-inner"
              : "topbar-inner"
          }
        >
          {isAdminRoute ? (
            <Link
              href={brandHref}
              className={
                isAdminLoginRoute ? "brand admin-login-header-brand" : "brand"
              }
            >
              <strong>{branding.siteName} Admin</strong>
              <span>
                {isAdminLoginRoute
                  ? "Secure marketplace operations"
                  : "Operations, approvals, and order oversight"}
              </span>
            </Link>
          ) : (
            <Link href={brandHref} className="brand compact-brand">
              {branding.logoDataUrl ? (
                <span className="compact-brand-logo-wrap" aria-hidden="true">
                  <img
                    className="compact-brand-logo"
                    src={branding.logoDataUrl}
                    alt={`${branding.siteName} logo`}
                  />
                </span>
              ) : null}
              <strong className="brand-lockup">
                <span className="brand-wordmark-wrap">
                  <span className="brand-wordmark">Vishu</span>
                  <span className="brand-suffix">.shop</span>
                </span>
              </strong>
            </Link>
          )}

          {showMarketplaceSearch && (
            <form
              key={`${pathname}?${searchParams.toString()}`}
              className="header-search-shell"
              onSubmit={handleMarketplaceSearch}
            >
              <div className="header-search-core">
                <label
                  className="header-search-field"
                  htmlFor="header-marketplace-search"
                >
                  <span className="header-search-label">Search</span>
                  <input
                    id="header-marketplace-search"
                    name="search"
                    placeholder="Search products across the marketplace"
                    defaultValue={initialHeaderSearch}
                  />
                </label>
                <div className="header-search-category">
                  <label htmlFor="header-marketplace-category">Category</label>
                  <select
                    id="header-marketplace-category"
                    name="category"
                    defaultValue={initialHeaderCategory}
                  >
                    <option value="all">All categories</option>
                    {PRODUCT_CATEGORIES.map((entry) => (
                      <option key={entry} value={entry}>
                        {formatCatalogLabel(entry)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" className="button header-search-submit">
                Search
              </button>
            </form>
          )}

          <nav className={isAdminRoute ? "nav admin-nav" : "nav"}>
            {isAdminRoute ? (
              <>
                {isAdmin && <Link href="/admin/dashboard">Dashboard</Link>}
                {isAdmin && <Link href="/admin/promotions">Promotions</Link>}
                {isAdmin && <Link href="/admin/settings">Settings</Link>}
                {showGuestActions && pathname !== "/admin/login" && (
                  <Link href="/admin/login">Admin Login</Link>
                )}
              </>
            ) : isVendor ? (
              <>
                <Link href="/vendor/dashboard">Dashboard</Link>
                <Link href="/vendor/settings">Settings</Link>
              </>
            ) : (
              <>
                <Link href="/">Shop</Link>
                <Link href="/cart">Cart ({cartCount})</Link>
                {isCustomer && <Link href="/account">My Account</Link>}
                {isCustomer && <Link href="/orders">My Orders</Link>}
                {showGuestActions && pathname !== "/login" && (
                  <Link href="/login">Login</Link>
                )}
                {showGuestActions && pathname !== "/register" && (
                  <Link href="/register">Register</Link>
                )}
              </>
            )}
            {isAuthenticated && (
              <button type="button" onClick={handleLogout}>
                {isAdminRoute ? "Sign out" : "Logout"}
              </button>
            )}
          </nav>
        </div>
      </header>
      <main className={isAdminRoute ? "page admin-page" : "page"}>
        {children}
      </main>
    </div>
  );
}
