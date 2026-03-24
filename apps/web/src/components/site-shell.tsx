"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth, useBranding, useCart } from "@/components/providers";
import { PRODUCT_CATEGORIES, formatCatalogLabel } from "@/lib/catalog";

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { branding } = useBranding();
  const { token, user, profile, loading, clearSession } = useAuth();
  const { items } = useCart();
  const [headerSearch, setHeaderSearch] = useState("");
  const [headerCategory, setHeaderCategory] = useState("all");
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const isAdminRoute = pathname.startsWith("/admin");
  const isVendor = !loading && profile?.role === "vendor";
  const isCustomer = !loading && profile?.role === "customer";
  const isAdmin = !loading && profile?.role === "admin";
  const brandHref = isAdminRoute ? "/admin/dashboard" : isVendor ? "/vendor/dashboard" : "/";
  const showMarketplaceSearch =
    !isAdminRoute &&
    !isVendor &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/register") &&
    !pathname.startsWith("/reset-password") &&
    !pathname.startsWith("/verify") &&
    !pathname.startsWith("/vendor");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    setHeaderSearch(params.get("search") ?? "");
    setHeaderCategory(params.get("category") ?? "all");
  }, [pathname]);

  const handleLogout = () => {
    const nextPath = isAdminRoute || isAdmin ? "/admin/login" : "/";
    clearSession();
    router.replace(nextPath);
  };

  const handleMarketplaceSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const params = new URLSearchParams();
    const nextSearch = headerSearch.trim();

    if (nextSearch) {
      params.set("search", nextSearch);
    }

    if (headerCategory !== "all") {
      params.set("category", headerCategory);
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
      <header className={isAdminRoute ? "topbar admin-topbar" : "topbar"}>
        <div className={isAdminRoute ? "topbar-inner admin-topbar-inner" : "topbar-inner"}>
          {isAdminRoute ? (
            <Link href={brandHref} className="brand">
              <strong>{branding.siteName} Admin</strong>
              <span>Operations, approvals, and order oversight</span>
            </Link>
          ) : (
            <Link href={brandHref} className="brand compact-brand">
              {branding.logoDataUrl ? (
                <span className="compact-brand-logo-wrap" aria-hidden="true">
                  <img className="compact-brand-logo" src={branding.logoDataUrl} alt={`${branding.siteName} logo`} />
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
            <form className="header-search-shell" onSubmit={handleMarketplaceSearch}>
              <label className="header-search-field" htmlFor="header-marketplace-search">
                <span className="header-search-label">Search</span>
                <input
                  id="header-marketplace-search"
                  placeholder="Search products across the marketplace"
                  value={headerSearch}
                  onChange={(event) => setHeaderSearch(event.target.value)}
                />
              </label>
              <div className="header-search-category">
                <label htmlFor="header-marketplace-category">Category</label>
                <select
                  id="header-marketplace-category"
                  value={headerCategory}
                  onChange={(event) => setHeaderCategory(event.target.value)}
                >
                  <option value="all">All categories</option>
                  {PRODUCT_CATEGORIES.map((entry) => (
                    <option key={entry} value={entry}>
                      {formatCatalogLabel(entry)}
                    </option>
                  ))}
                </select>
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
                {isAdmin && <Link href="/admin/settings">Settings</Link>}
                {!token && pathname !== "/admin/login" && <Link href="/admin/login">Admin Login</Link>}
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
                {!token && pathname !== "/login" && <Link href="/login">Login</Link>}
                {!token && pathname !== "/register" && <Link href="/register">Register</Link>}
              </>
            )}
            {token && (
              <button type="button" onClick={handleLogout}>
                {isAdminRoute ? "Sign out" : "Logout"}
              </button>
            )}
          </nav>
        </div>
      </header>
      <main className={isAdminRoute ? "page admin-page" : "page"}>{children}</main>
    </div>
  );
}
